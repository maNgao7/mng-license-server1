'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { GameLaunchSession } = require('../lib/game-launch-session.cjs');
const { launchUnturned, createUnturnedProcessControl } = require('../lib/unturned-startup.cjs');

const tick = () => new Promise(resolve => setImmediate(resolve));
const executablePath = 'D:\\SteamLibrary\\steamapps\\common\\Unturned\\Unturned.exe';
const UNTURNED_DIRECTORY = 'D:/SteamLibrary/steamapps/common/Unturned';
const otherToken = 'e'.repeat(32);
function row(overrides = {}) {
    return { pid: 890001, executablePath, startedAt: Date.now() + 5, startTicks: '639000000000000001',
        launchToken: otherToken, windowHandle: '123', responding: true, ...overrides };
}
function fixture(t, { probe, openExternal, stop, timeoutMs = 250, pollIntervalMs = 1 } = {}) {
    const progress = [], stopped = [], requests = [], states = [];
    let token;
    const session = new GameLaunchSession({ game: 'gelene-gecene', title: 'Gelene Geçene', onProgress: event => progress.push(event) });
    const control = {
        probe: async options => {
            if (options.signal?.aborted) throw new Error('Aborted discovery');
            return probe ? probe({ token, requests, states, session, options }) : states;
        },
        stop: async identity => { stopped.push(identity); if (stop) return stop(identity); states.splice(0); }
    };
    const options = { session, directory: UNTURNED_DIRECTORY, timeoutMs, pollIntervalMs, control, openExternal: async url => {
        requests.push(url);
        token = /-tikmng-launch=([0-9a-f]{32})\/$/.exec(url)?.[1];
        assert.match(token, /^[0-9a-f]{32}$/);
        if (openExternal) return openExternal({ token, states, session });
        states.push(row({ launchToken: token }));
    } };
    t.after(() => session.close());
    return { session, progress, stopped, requests, states, options, launch: () => launchUnturned(options) };
}

test('Steam dispatch is insufficient: ready requires our process, nonzero window and responding state', async t => {
    const x = fixture(t, { openExternal: ({ token, states }) => states.push(row({ launchToken: token, windowHandle: '0' })) });
    let done = false;
    const pending = x.launch().then(result => { done = true; return result; });
    while (!x.states.length) await tick();
    await tick();
    assert.equal(done, false);
    assert.equal(x.session.ready, false);
    assert.ok(!x.progress.some(event => event.tip === 'hazir'));
    x.states[0].windowHandle = '44'; x.states[0].responding = false;
    await tick(); assert.equal(done, false);
    x.states[0].responding = true;
    const result = await pending;
    assert.equal(result.pid, 890001); assert.equal(result.owned, true);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(x.session.unturnedProcess, result);
    assert.equal(x.session.ready, false, 'main must explicitly markReady after the helper resolves');
    x.session.markReady();
    await x.session.close();
    assert.equal(x.stopped.length, 1);
    assert.equal(x.session.unturnedProcess, undefined);
});

test('a pre-existing game is neither launched again nor adopted nor stopped', async t => {
    const x = fixture(t); x.states.push(row());
    await assert.rejects(x.launch(), { code: 'UNTURNED_ALREADY_RUNNING' });
    assert.deepEqual(x.requests, []); assert.deepEqual(x.stopped, []);
    assert.equal(x.session.closed, true);
});

test('only the exact installation executable is accepted, including separator and case normalization', async t => {
    const accepted = fixture(t, { openExternal: ({ token, states }) => states.push(row({ launchToken: token,
        executablePath: 'd:/steamlibrary/steamapps/common/UNTURNED/Unturned.exe' })) });
    await accepted.launch(); await accepted.session.close();
    for (const wrong of ['D:/other/Unturned.exe', UNTURNED_DIRECTORY + '-copy/Unturned.exe',
        UNTURNED_DIRECTORY + '/server/Unturned.exe', UNTURNED_DIRECTORY + '/Unturned.exe.bak']) {
        const x = fixture(t, { openExternal: ({ token, states }) => states.push(row({ launchToken: token, executablePath: wrong })) });
        await assert.rejects(x.launch(), /kimliği/);
        assert.deepEqual(x.stopped, []);
        assert.ok(x.session.cleanupError, 'unverifiable cleanup is visible to the launcher');
    }
});

test('discovery failure before dispatch is visible and never launches Steam', async t => {
    const x = fixture(t, { probe: () => { throw new Error('Access denied to executable path'); } });
    await assert.rejects(x.launch(), /Access denied/);
    assert.equal(x.requests.length, 0); assert.equal(x.session.ready, false);
});

test('a same-path new PID without the private launch token is never owned', async t => {
    const x = fixture(t, { openExternal: ({ states }) => states.push(row()) });
    await assert.rejects(x.launch(), { code: 'UNTURNED_OWNERSHIP_UNVERIFIED' });
    assert.deepEqual(x.stopped, []);
});

test('an older process carrying the same token is not attributed to this dispatch', async t => {
    const x = fixture(t, { openExternal: ({ token, states }) => states.push(row({ launchToken: token, startedAt: 1 })) });
    await assert.rejects(x.launch(), { code: 'UNTURNED_OWNERSHIP_UNVERIFIED' });
    assert.deepEqual(x.stopped, []);
});

test('multiple matching processes never produce readiness; cleanup stops only nonce-matched processes', async t => {
    const x = fixture(t, { openExternal: ({ token, states }) => states.push(row({ launchToken: token }), row({ pid: 890002, launchToken: token })) });
    await assert.rejects(x.launch(), { code: 'UNTURNED_OWNERSHIP_UNVERIFIED' });
    assert.deepEqual(x.stopped.map(item => item.pid), [890001, 890002]);
});

test('a foreign process alongside our game is left untouched', async t => {
    const x = fixture(t, { openExternal: ({ token, states }) => states.push(row({ launchToken: token }), row({ pid: 890002 })) });
    await assert.rejects(x.launch(), { code: 'UNTURNED_OWNERSHIP_UNVERIFIED' });
    assert.deepEqual(x.stopped.map(item => item.pid), [890001]);
});

test('same-session concurrent calls coalesce; a second owner never dispatches Steam', async t => {
    const x = fixture(t), other = fixture(t);
    const first = x.launch();
    assert.equal(x.launch(), first);
    await assert.rejects(other.launch(), { code: 'UNTURNED_ALREADY_OWNED' });
    assert.equal(other.requests.length, 0);
    const result = await first;
    assert.equal(await x.launch(), result);
    assert.equal(x.requests.length, 1);
    await x.session.close();
    await other.launch();
});

test('no process, no window, or a hung Steam request times out with no false ready', async t => {
    for (const mode of ['no-process', 'no-window', 'hung-request']) await t.test(mode, async t => {
        const x = fixture(t, { timeoutMs: 25, openExternal: ({ token, states }) => {
            if (mode === 'no-window') states.push(row({ launchToken: token, windowHandle: '0' }));
            if (mode === 'hung-request') return new Promise(() => {});
        } });
        await assert.rejects(x.launch(), /Zaman asimi/);
        assert.equal(x.session.ready, false);
        assert.equal(x.session.closed, true);
        assert.equal(x.stopped.length, mode === 'no-window' ? 1 : 0);
    });
});

test('a dispatch failure cleans up only an already-created owned game and preserves the actual error', async t => {
    const x = fixture(t, { openExternal: ({ token, states }) => {
        states.push(row({ launchToken: token, windowHandle: '0' })); throw new Error('Steam unavailable');
    } });
    await assert.rejects(x.launch(), /Steam unavailable/);
    assert.equal(x.stopped.length, 1);
});

test('early exit and PID reuse before window creation are reported without killing a replacement', async t => {
    for (const mode of ['exit', 'reuse']) await t.test(mode, async t => {
        let polls = 0;
        const x = fixture(t, { openExternal: ({ token, states }) => states.push(row({ launchToken: token, windowHandle: '0' })),
            probe: ({ states, requests }) => {
                if (requests.length && polls++ === 1) {
                    if (mode === 'exit') states.splice(0);
                    else states[0] = row({ launchToken: states[0].launchToken, startTicks: '639000000000000002', windowHandle: '0' });
                }
                return states;
            }
        });
        await assert.rejects(x.launch(), /hazır olmadan|kimliği değişti/);
        assert.equal(x.stopped.length, 0);
    });
});

test('cancellation before dispatch prevents launch, and late discovery cannot become ready', async t => {
    let release;
    const x = fixture(t, { probe: ({ requests, states }) => requests.length ? states : new Promise(resolve => { release = resolve; }) });
    const pending = x.launch();
    const rejected = assert.rejects(pending, /iptal/);
    await tick(); await x.session.close(); release([]);
    await rejected; await tick();
    assert.equal(x.requests.length, 0); assert.equal(x.session.unturnedProcess, undefined);
});

test('cancellation after dispatch aborts pending discovery and uses an independent cleanup probe', async t => {
    let waiting;
    const x = fixture(t, { probe: ({ requests, states, options }) => {
        if (!requests.length || !options.signal) return states;
        waiting = true;
        return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('cancelled native probe')), { once: true }));
    } });
    const pending = x.launch(); const rejected = assert.rejects(pending, /iptal/);
    while (!waiting) await tick();
    await x.session.close(); await rejected;
    assert.equal(x.stopped.length, 1); assert.equal(x.session.ready, false);
});

test('closed sessions and invalid paths/bounds cannot dispatch Steam', async t => {
    const x = fixture(t);
    for (const directory of ['relative/Unturned', '', undefined, 'C:/Bad\nUnturned']) {
        assert.throws(() => launchUnturned({ ...x.options, directory }), /directory/);
    }
    assert.throws(() => launchUnturned({ ...x.options, timeoutMs: Infinity }), /bounds/);
    await x.session.close(); await assert.rejects(x.launch(), /iptal/);
    assert.equal(x.requests.length, 0);
});

test('native discovery sends only a bounded hidden read-only path-filtered query and reports errors', async () => {
    const calls = [];
    const execute = (file, args, options, callback) => { calls.push({ file, args, options }); callback(null, '[]'); };
    const native = createUnturnedProcessControl({ directory: UNTURNED_DIRECTORY, execute, platform: 'win32' });
    assert.deepEqual(await native.probe(), []);
    const call = calls[0], script = Buffer.from(call.args.at(-1), 'base64').toString('utf16le');
    assert.equal(call.options.windowsHide, true); assert.equal(call.options.timeout, 5000);
    assert.equal(call.options.maxBuffer, 65536);
    assert.match(script.replace(/''/g, "'"), /Name = 'Unturned\.exe' AND ExecutablePath = '/);
    assert.match(script, /D:\\SteamLibrary\\steamapps\\common\\Unturned\\Unturned.exe/);
    assert.doesNotMatch(script, /Get-Content|ReadAllText|Get-ChildItem|Stop-Process|\.Kill\(|Start-Process/);
    const denied = createUnturnedProcessControl({ directory: UNTURNED_DIRECTORY, platform: 'win32', execute: (_file, _args, _options, callback) => callback(new Error('Access denied')) });
    await assert.rejects(denied.probe(), /Access denied/);
    const broken = createUnturnedProcessControl({ directory: UNTURNED_DIRECTORY, platform: 'win32', execute: (_file, _args, _options, callback) => callback(null, 'not json') });
    await assert.rejects(broken.probe(), /geçersiz/);
    await assert.rejects(createUnturnedProcessControl({ directory: UNTURNED_DIRECTORY, platform: 'linux', execute }).probe(), /Windows/);
    assert.equal(calls.length, 1);
});

test('native cleanup validates all identity fields and opens a handle before the guarded kill', async () => {
    let script;
    const native = createUnturnedProcessControl({ directory: UNTURNED_DIRECTORY, platform: 'win32', execute: (_file, args, _options, callback) => {
        script = Buffer.from(args.at(-1), 'base64').toString('utf16le'); callback(null, '{"stopped":true}');
    } });
    await native.stop(row());
    assert.match(script, /ProcessId = 890001/); assert.match(script, /startTicks|Ticks.ToString\(\)/);
    assert.match(script, /cleanup refused: process identity changed/);
    assert.ok(script.indexOf('$null=$game.Handle', script.indexOf('$rows=@')) < script.indexOf('$game.Kill()'));
    assert.doesNotMatch(script, /taskkill|Stop-Process|Kill\([^)]*true/);
    for (const invalid of [{ pid: process.pid }, { pid: 0 }, { launchToken: 'invalid' }, { startTicks: 'x' }, { executablePath: 'C:/other.exe' }]) {
        assert.throws(() => native.stop(row(invalid)), /kimliği/);
    }
});

test('discovered C and custom E installations work without a hardcoded Steam library', async t => {
    for (const directory of ['C:/Program Files (x86)/Steam/steamapps/common/Unturned', 'E:/My Games/SteamCustom/Unturned']) {
        const x = fixture(t, { openExternal: ({ token, states }) => states.push(row({
            executablePath: directory + '/Unturned.exe', launchToken: token })) });
        x.options.directory = directory;
        assert.equal((await x.launch()).ownership, 'nonce');
        await x.session.close(); assert.equal(x.stopped.length, 1);
    }
});

test('Steam without an OS nonce uses the unique exact-path process created after dispatch', async t => {
    const x = fixture(t, { openExternal: ({ states }) => states.push(row({ launchToken: '' })) });
    const result = await x.launch();
    assert.equal(result.ownership, 'path-and-start-time');
    await x.session.close(); assert.equal(x.stopped.length, 1);
    assert.equal(x.stopped[0].startTicks, result.startTicks);
});

test('game exit after readiness closes the owner session and its bridge disposer', { timeout: 5000 }, async t => {
    const x = fixture(t);
    await x.launch(); x.session.markReady();
    let bridgeClosed = false;
    x.session.disposers.add(() => { bridgeClosed = true; });
    const closed = new Promise(resolve => { x.session.onClosed = resolve; });
    x.states.splice(0);
    assert.equal(await closed, null);
    assert.equal(bridgeClosed, true); assert.deepEqual(x.stopped, []);
    assert.equal(x.session.unturnedProcess, undefined);
});

test('PID reuse after readiness closes the session without killing the new owner', { timeout: 5000 }, async t => {
    const x = fixture(t);
    await x.launch(); x.session.markReady();
    const closed = new Promise(resolve => { x.session.onClosed = resolve; });
    x.states[0] = row({ startTicks: '639000000000000002' });
    assert.match((await closed).message, /kimliği değişti/);
    assert.deepEqual(x.stopped, []); assert.ok(x.session.cleanupError);
});

test('cleanup failure stays visible to the launcher instead of pretending the game closed', async t => {
    const x = fixture(t, { stop: () => { throw new Error('Access denied stopping owned game'); } });
    await x.launch(); await x.session.close();
    assert.match(x.session.cleanupError.message, /Access denied/);
    assert.match(x.session.error.message, /Access denied/);
});
