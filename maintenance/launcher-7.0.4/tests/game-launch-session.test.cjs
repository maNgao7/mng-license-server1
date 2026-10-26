'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { GameLaunchSession, terminateOwnedChild } = require('../lib/game-launch-session.cjs');

let nextPid = 900000;
const tick = () => new Promise(resolve => setImmediate(resolve));

function childProcess() {
    return Object.assign(new EventEmitter(), {
        pid: nextPid++, exitCode: null, signalCode: null,
        stdout: new PassThrough(), stderr: new PassThrough()
    });
}

class FakeWindow extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = options;
        this.webContents = new EventEmitter();
        this.calls = [];
        this.destroyed = false;
        this.navigation = Promise.resolve();
    }
    loadURL(url) { this.url = url; return this.navigation; }
    isDestroyed() { return this.destroyed; }
    maximize() { this.calls.push('maximize'); }
    restore() { this.calls.push('restore'); }
    show() { this.calls.push('show'); }
    focus() { this.calls.push('focus'); }
    setMenuBarVisibility() {}
    destroy() { if (!this.destroyed) { this.destroyed = true; this.emit('closed'); } }
}

function fixture(overrides = {}) {
    const killed = [];
    const progress = [];
    const closed = [];
    const session = new GameLaunchSession({
        game: 'test', title: 'Test Game', onProgress: value => progress.push(value),
        onClosed: error => closed.push(error),
        terminate: async child => { killed.push(child); child.exitCode = 0; child.emit('exit', 0); },
        ...overrides
    });
    return { session, killed, progress, closed };
}

test('web window waits for both load and drawable events in either order', async t => {
    for (const first of ['load', 'drawable']) await t.test(first, async () => {
        const { session } = fixture();
        const window = new FakeWindow();
        const loaded = session.loadWindow(window, 'http://game.test', 100);
        const events = {
            load: () => window.webContents.emit('did-finish-load'),
            drawable: () => window.emit('ready-to-show')
        };
        events[first]();
        await tick();
        assert.deepEqual(window.calls, []);
        events[first === 'load' ? 'drawable' : 'load']();
        await loaded;
        assert.deepEqual(window.calls, ['maximize', 'show', 'focus']);
        await session.close();
        assert.equal(window.webContents.listenerCount('did-finish-load'), 0);
    });
});

test('web readiness also awaits navigation completion', async () => {
    const { session } = fixture();
    const window = new FakeWindow();
    let complete;
    window.navigation = new Promise(resolve => { complete = resolve; });
    const loaded = session.loadWindow(window, 'http://game.test', 100);
    window.webContents.emit('did-finish-load');
    window.emit('ready-to-show');
    await tick();
    assert.deepEqual(window.calls, []);
    complete();
    await loaded;
    await session.close();
});

test('native closed event can destroy the BrowserWindow getter before session cleanup', async () => {
    const { session, killed, closed } = fixture();
    const child = session.ownChild(childProcess());
    const window = new FakeWindow(), contents = window.webContents;
    Object.defineProperty(window, 'webContents', {get(){if(this.destroyed)throw new Error('Object has been destroyed');return contents;}});
    const loaded = session.loadWindow(window, 'http://game.test', 100);
    contents.emit('did-finish-load');window.emit('ready-to-show');await loaded;session.markReady();
    window.destroy();await session.close();
    assert.equal(session.cleanupError,null);assert.equal(session.error,null);assert.deepEqual(closed,[null]);
    assert.deepEqual(killed,[child]);assert.equal(contents.listenerCount('did-fail-load'),0);
    assert.equal(contents.listenerCount('render-process-gone'),0);
});

test('web navigation rejection and readiness timeout destroy windows and owned children', async t => {
    for (const mode of ['rejection', 'timeout']) await t.test(mode, async () => {
        const { session, killed } = fixture();
        const child = session.ownChild(childProcess());
        const window = new FakeWindow();
        if (mode === 'rejection') window.navigation = Promise.reject(new Error('ERR_CONNECTION_REFUSED'));
        await assert.rejects(session.loadWindow(window, 'http://game.test', 15),
            mode === 'rejection' ? /ERR_CONNECTION_REFUSED/ : /penceresi hazir olmadi/);
        assert.equal(window.destroyed, true);
        assert.deepEqual(killed, [child]);
        assert.deepEqual(window.calls, []);
    });
});

test('subframe load failure is ignored; main-frame failure supplies a useful result', async () => {
    const { session } = fixture();
    const window = new FakeWindow();
    const result = assert.rejects(session.loadWindow(window, 'http://game.test', 100), /ERR_FAILED.*-2/);
    window.webContents.emit('did-fail-load', {}, -3, 'subframe', '', false);
    assert.equal(session.closed, false);
    window.webContents.emit('did-fail-load', {}, -2, 'ERR_FAILED', '', true);
    await result;
    assert.equal(window.destroyed, true);
});

test('closing a starting window cancels pending readiness and stops only owned children once', async () => {
    const { session, killed, closed } = fixture();
    const owned = session.ownChild(childProcess());
    const unrelated = childProcess();
    const window = new FakeWindow();
    const result = assert.rejects(session.loadWindow(window, 'http://game.test', 100), /iptal/);
    window.destroy();
    await result;
    await session.close();
    await session.close();
    assert.deepEqual(killed, [owned]);
    assert.equal(unrelated.exitCode, null);
    assert.equal(closed.length, 1);
    assert.equal(session.waiters.size, 0);
});

test('renderer crash after readiness tears down the session', async () => {
    const { session, killed, closed } = fixture();
    const owned = session.ownChild(childProcess());
    const window = new FakeWindow();
    const loaded = session.loadWindow(window, 'http://game.test', 100);
    window.webContents.emit('did-finish-load');
    window.emit('ready-to-show');
    await loaded;
    session.markReady();
    window.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
    await session.close();
    assert.deepEqual(killed, [owned]);
    assert.match(closed[0].message, /crashed/);
});

test('all native ready markers work across output chunk boundaries', async t => {
    for (const marker of ['MNG_GAME_READY', 'MNG_WORLD_LOADED', 'MNG_STARTUP_WORLD_SECONDS=12', 'MNG_SNOW_ARENA_READY', 'MNG_BATTLE_ARENA_READY']) {
        await t.test(marker, async () => {
            const { session } = fixture();
            const child = session.ownChild(childProcess(), { normalExit: true });
            const loaded = session.waitForMarker(child, 100);
            child.stdout.emit('data', marker.slice(0, 7));
            child.stdout.emit('data', marker.slice(7) + '\n');
            await loaded;
            session.markReady();
            child.exitCode = 0;
            child.emit('exit', 0);
            await session.close();
            assert.equal(session.error, null);
        });
    }
});

test('native missing marker, spawn error without exit, and premature clean exit all fail and clean up', async t => {
    for (const mode of ['timeout', 'error', 'exit']) await t.test(mode, async () => {
        const { session, killed, closed } = fixture();
        const child = session.ownChild(childProcess(), { normalExit: true });
        const pending = session.waitForMarker(child, mode === 'timeout' ? 15 : 100);
        const rejected = assert.rejects(pending, mode === 'timeout' ? /launch.log/ : mode === 'error' ? /ENOENT/ : /hazir olmadan.*Java missing/s);
        if (mode === 'error') child.emit('error', new Error('ENOENT'));
        if (mode === 'exit') {
            child.stderr.emit('data', 'Java missing');
            child.exitCode = 0;
            child.emit('exit', 0);
        }
        await rejected;
        assert.deepEqual(killed, [child]);
        assert.equal(closed.length, 1);
        assert.equal(child.stdout.listenerCount('data'), 0);
        child.emit('error', new Error('late error'));
    });
});

test('a hung preparation stage is bounded, cleans up, and reports real phases without percentages', async () => {
    const { session, killed, progress } = fixture();
    const child = session.ownChild(childProcess());
    await assert.rejects(session.stage('assets', 'Preparing assets', () => new Promise(() => {}), 15), /Zaman asimi/);
    assert.deepEqual(killed, [child]);
    assert.equal(progress[0].phase, 'assets');
    assert.equal(progress[0].mesaj, 'Preparing assets');
    assert.equal('percent' in progress[0], false);
});

test('cleanup failure is surfaced and repeated close cannot kill twice', async () => {
    let attempts = 0;
    const { session, closed } = fixture({ terminate: async () => { attempts++; throw new Error('Access denied'); } });
    session.ownChild(childProcess());
    await session.close(new Error('Startup failed'));
    await session.close();
    assert.match(session.error.message, /Startup failed.*Access denied/s);
    assert.match(session.cleanupError.message, /Access denied/);
    assert.equal(closed.length, 1);
    assert.equal(attempts, 1);
});

test('a failing disposer cannot prevent child termination or leave close pending', async () => {
    const { session, killed } = fixture();
    const child = session.ownChild(childProcess());
    session.disposers.add(() => { throw new Error('Log cleanup failed'); });
    await session.close();
    assert.deepEqual(killed, [child]);
    assert.match(session.cleanupError.message, /Log cleanup failed/);
});

test('Windows tree termination targets only a live owned PID with bounded arguments', async () => {
    const calls = [];
    const execute = (...args) => { calls.push(args.slice(0, 3)); args[3](null); };
    const child = childProcess();
    await terminateOwnedChild(child, { platform: 'win32', execFile: execute });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0][1], ['/pid', String(child.pid), '/f', '/t']);
    assert.equal(calls[0][2].windowsHide, true);
    assert.equal(calls[0][2].timeout, 5000);
    child.exitCode = 0;
    await terminateOwnedChild(child, { platform: 'win32', execFile: execute });
    await terminateOwnedChild({ ...child, exitCode: null, pid: process.pid }, { platform: 'win32', execFile: execute });
    await terminateOwnedChild({ ...child, exitCode: null, pid: undefined }, { platform: 'win32', execFile: execute });
    assert.equal(calls.length, 1);
});

test('HTTP readiness timeout aborts its outstanding request without using a real service', async () => {
    const requests = [];
    const fakeHttp = { get: () => {
        const request = new EventEmitter();
        request.destroy = () => { request.destroyed = true; };
        requests.push(request);
        return request;
    } };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../lib/game-launch-session.cjs'), 'utf8'), {
        module, require: name => name === 'node:http' ? fakeHttp : require(name),
        process, setTimeout, clearTimeout
    });
    const session = new module.exports.GameLaunchSession({ game: 'mock', title: 'Mock' });
    await assert.rejects(session.waitForHttp('http://mock.test', { timeoutMs: 15 }), /sunucusu hazir olmadi/);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].destroyed, true);
    assert.equal(session.disposers.size, 0);
    await session.close();
});

function mainHarness(options = {}) {
    const spawned = [];
    const killed = [];
    const windows = [];
    const messages = [];
    const checkedPorts = [];
    const handoffs = [];
    const handlers = {};
    const app = Object.assign(new EventEmitter(), { getPath: () => 'C:/isolated-profile', quit: () => { app.quitCount++; }, quitCount: 0 });
    const mainWindow = Object.assign(new EventEmitter(), {
        isDestroyed: () => false,
        webContents: { send: (channel, payload) => messages.push({ channel, payload }) }
    });
    const licenses = { lisans_kod: 'synthetic-license', is_unlimited: true, ...options.licenses };
    class Session extends GameLaunchSession {
        constructor(config) {
            super({ ...config, terminate: async child => {
                killed.push(child);
                if (options.terminate) await options.terminate(child);
                child.exitCode = 0;
                child.emit('exit', 0);
            } });
        }
        stage(phase, message, operation) { return super.stage(phase, message, operation, 500); }
        waitForHttp() { return Promise.resolve(); }
        waitForMarker(child) { return super.waitForMarker(child, 100); }
        loadWindow(window, url) { return super.loadWindow(window, url, 100); }
    }
    const context = vm.createContext({
        require: name => {
            if (name === './lib/game-launch-session.cjs') return { GameLaunchSession: Session };
            if (name === './lib/preview-ports.cjs') return { assertPreviewPortsAvailable: async ports => {
                checkedPorts.push([...ports]);
                if (options.occupied) throw new Error('Occupied by stable launcher');
            } };
            if (name === './lib/shared-game-assets.cjs') return { prepareSharedGameAssets: async () => {} };
            if (name === './lib/native-game.cjs') return { nativeOwnsLiveSession: game =>
                game === 'minecraft-snake-arena' || (Boolean(options.currentNative || options.preview) && ['snow-war','battle-royale'].includes(game)) };
            if (name === './lib/game-account-handoff.cjs') return { handoffGameAccount: async data => { handoffs.push(data);if(options.handoffFailure)throw new Error('Synthetic handoff failed');return{requested:true}; } };
            throw new Error(`Unexpected dependency: ${name}`);
        },
        path, Buffer, AbortController, process: { resourcesPath: 'C:/isolated-resources' }, __dirname: 'C:/isolated-launcher',
        fs: { existsSync: () => true, readFileSync: file => String(file).endsWith('launch-args.txt') ? (options.bridgeArguments ?? '"-Dmng.bridge.port=59821"\n') : '{"type":"module"}', writeFileSync: () => {},
            mkdirSync: () => {}, createWriteStream: () => new PassThrough() },
        app, mainWindow, appWindow: null, zombieWarProcess: null,
        preview: { enabled: Boolean(options.preview) },
        ipcMain: { handle: (name, handler) => { handlers[name] = handler; } },
        BrowserWindow: class extends FakeWindow {
            constructor(config) { super(config); windows.push(this); }
            loadURL(url) {
                const result = super.loadURL(url);
                queueMicrotask(() => { this.webContents.emit('did-finish-load'); this.emit('ready-to-show'); });
                return result;
            }
        },
        spawn: (command, args, config) => {
            const child = childProcess();
            spawned.push({ command, args, config, child });
            if (args[0].endsWith('launch-game.cjs') && options.autoNativeReady !== false) setImmediate(() => child.stdout.emit('data', 'MNG_GAME_READY\n'));
            return child;
        },
        store: { get: (key, fallback) => licenses[key] ?? fallback },
        oyunKuruluMu: () => true,
        oyunKlasoruBul: id => `C:/isolated-games/${id}`,
        appKlasoruBul: () => 'C:/isolated-games/vs',
        arkaPlanKlasoru: () => 'C:/isolated-media',
        nodeBilgisiBul: () => ({ komut: 'mock-node', env: { SYNTHETIC: '1' } }),
        geleneGeceneModKlasoru: () => 'C:/isolated-mod', eskiGeleneGeceneDllleriniAyikla: () => {},
        httpGet: async () => ({}), shell: { openExternal: options.openExternal || (async () => {}) },
        platform: { snapshot: () => ({ libraryRoot: 'C:/isolated-games' }), install: async () => ({ basarili: true }) },
        OYUN_TANIMLARI: Object.fromEntries(['vs', 'puanlama', 'orbit', 'crowd-control', 'battle-game', 'duck-hunt', 'pony-life', 'frog-river', 'penalty-kick', 'tightrope-balance', 'zombie-war', 'gelene-gecene', 'snow-war', 'battle-royale']
            .map(id => [id, { ad: id, minecraft: ['snow-war', 'battle-royale'].includes(id) }])),
        APP_PORT: 3000, ORBIT_PORT: 3010, CROWD_CONTROL_PORT: 3020, BATTLE_GAME_PORT: 3030,
        DUCK_HUNT_PORT: 3040, PONY_LIFE_PORT: 3050, PONY_WIDGET_PORT: 3051,
        FROG_RIVER_PORT: 3060, PENALTY_KICK_PORT: 3070, TIGHTROPE_BALANCE_PORT: 3080
    });
    const main = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
    const start = main.indexOf('let aktifOyun = null;');
    const end = main.indexOf('// HTTP / HTTPS YARDIMCILARI', start);
    assert.ok(start !== -1 && end > start, 'main lifecycle section exists');
    vm.runInContext(main.slice(start, end), context);
    return { spawned, killed, windows, messages, checkedPorts, handoffs, app, mainWindow,
        launch: data => handlers['uygulamayi-ac']({}, data),
        snapshot: () => vm.runInContext('({ aktifOyun, session: oyunOturumu, minecraftProcesses, zombieWarProcess })', context) };
}

test('every web game uses the hidden readiness flow and window close releases its services', async t => {
    for (const game of ['vs', 'puanlama', 'orbit', 'crowd-control', 'battle-game', 'duck-hunt', 'pony-life', 'frog-river', 'penalty-kick', 'tightrope-balance']) {
        await t.test(game, async () => {
            const harness = mainHarness();
            const result = await harness.launch({ uygulama: game });
            assert.equal(result.basarili, true);
            assert.equal(harness.windows.length, 1);
            assert.equal(harness.windows[0].options.show, false);
            assert.equal(harness.snapshot().aktifOyun, game);
            const session = harness.snapshot().session;
            harness.windows[0].destroy();
            await session.close();
            assert.equal(harness.killed.length, game === 'orbit' ? 2 : 1);
            assert.equal(harness.snapshot().aktifOyun, null);
            assert.equal(harness.messages.some(message => message.channel === 'durum' && message.payload.tip === 'hazir'), true);
        });
    }
});

test('account handoff reaches non-query games and native bridge without changing game options', async t => {
    for(const gameId of ['duck-hunt','penalty-kick','frog-river','pony-life','tightrope-balance','snow-war','battle-royale','zombie-war'])await t.test(gameId,async()=>{
        const harness=mainHarness({licenses:{tiktok_active_account:'saved_host'}});
        const result=await harness.launch({uygulama:gameId});assert.equal(result.basarili,true);
        assert.equal(harness.handoffs.length,1);assert.equal(harness.handoffs[0].username,'saved_host');assert.equal(harness.handoffs[0].gameId,gameId);
        assert.match(harness.handoffs[0].baseURL,/^http:\/\/localhost:|^http:\/\/127\.0\.0\.1:/);
        if(['snow-war','battle-royale','zombie-war'].includes(gameId))assert.equal(harness.handoffs[0].baseURL,'http://127.0.0.1:59821/');
        await harness.snapshot().session.close();
    });
});

test('account transport failure warns without pretending LIVE or blocking offline game entry', async()=>{
    const harness=mainHarness({handoffFailure:true});
    assert.equal((await harness.launch({uygulama:'frog-river',tiktokUser:'test_host'})).basarili,true);
    assert.ok(harness.messages.some(message=>message.payload.tip==='hesap-uyari'));
    await harness.snapshot().session.close();
});

test('updated stable and preview Minecraft clients own their native LIVE session without a competing launcher connect', async t=>{
    for(const preview of [false,true])for(const gameId of ['snow-war','battle-royale'])await t.test(gameId+'/'+preview,async()=>{
        const harness=mainHarness({preview,currentNative:true});
        assert.equal((await harness.launch({uygulama:gameId,tiktokUser:'selected_host'})).basarili,true);
        assert.equal(harness.spawned[0].config.env.MNG_TIKTOK_USER,'selected_host');
        assert.equal(harness.handoffs.length,0);
        await harness.snapshot().session.close();
    });
});

test('native missing bridge metadata never guesses a port or contacts another game',async()=>{
    const harness=mainHarness({bridgeArguments:'"-Xmx4G"\n"-Dmng.bridge.port=99999"\n'});
    assert.equal((await harness.launch({uygulama:'snow-war',tiktokUser:'test_host'})).basarili,true);
    assert.equal(harness.handoffs.length,0);assert.ok(harness.messages.some(message=>message.payload.tip==='hesap-uyari'));
    await harness.snapshot().session.close();
});

test('switching games waits for owned child termination and late old events cannot clear the new game', async () => {
    let release;
    let stops = 0;
    const harness = mainHarness({ terminate: async () => {
        if (stops++ === 0) await new Promise(resolve => { release = resolve; });
    } });
    await harness.launch({ uygulama: 'battle-game' });
    const old = harness.spawned[0].child;
    const next = harness.launch({ uygulama: 'pony-life' });
    await tick();
    assert.equal(harness.spawned.length, 1);
    release();
    assert.equal((await next).basarili, true);
    old.emit('exit', 1);
    old.emit('error', new Error('late old process error'));
    assert.equal(harness.snapshot().aktifOyun, 'pony-life');
    await harness.snapshot().session.close();
});

test('orbit configuration and TikTok user survive the new readiness flow; duplicate launch reuses the ready session', async () => {
    const harness = mainHarness();
    const data = { uygulama: 'orbit', tiktokUser: '@tester', orbitSettings: { speed: 4 }, orbitTest: true, orbitTestLabel: 'sample' };
    await harness.launch(data);
    const url = new URL(harness.windows[0].url);
    assert.equal(url.searchParams.get('autoUser'), 'tester');
    assert.deepEqual(JSON.parse(Buffer.from(url.searchParams.get('orbitConfig'), 'base64url').toString()), { speed: 4, test: true, testLabel: 'sample' });
    await harness.launch(data);
    assert.equal(harness.spawned.length, 2);
    assert.equal(harness.windows.length, 1);
    await harness.snapshot().session.close();
});

test('native launch waits for marker, uses no separate spinner, and spawn error without exit resets active state', async t => {
    for (const game of ['snow-war', 'battle-royale', 'zombie-war']) await t.test(game, async () => {
        const harness = mainHarness({ autoNativeReady: false });
        const pending = harness.launch({ uygulama: game });
        await tick();
        assert.equal(harness.windows.length, 0);
        assert.equal(harness.snapshot().session.ready, false);
        harness.spawned[0].child.emit('error', new Error('spawn ENOENT'));
        const result = await pending;
        assert.equal(result.basarili, false);
        assert.match(result.hata, /spawn ENOENT/);
        assert.equal(harness.snapshot().aktifOyun, null);
        assert.equal(harness.snapshot().zombieWarProcess, null);
        assert.equal(harness.snapshot().minecraftProcesses.size, 0);
    });
});

test('switching away from native games terminates their owned wrapper before starting the web service', async () => {
    const harness = mainHarness();
    await harness.launch({ uygulama: 'zombie-war' });
    const native = harness.spawned[0].child;
    await harness.launch({ uygulama: 'duck-hunt' });
    assert.equal(harness.killed[0], native);
    assert.equal(harness.snapshot().zombieWarProcess, null);
    assert.equal(harness.snapshot().aktifOyun, 'duck-hunt');
    await harness.snapshot().session.close();
});

test('preview refuses occupied ports without spawning or stopping a stable process', async () => {
    const harness = mainHarness({ preview: true, occupied: true });
    const result = await harness.launch({ uygulama: 'battle-game' });
    assert.equal(result.basarili, false);
    assert.match(result.hata, /stable launcher/);
    assert.deepEqual(harness.checkedPorts, [[31975, 3030]]);
    assert.deepEqual(harness.spawned, []);
    assert.deepEqual(harness.killed, []);
    assert.equal(harness.snapshot().aktifOyun, null);
});

test('failed cleanup prevents a replacement game from spawning', async () => {
    const harness = mainHarness({ terminate: async () => { throw new Error('Access denied'); } });
    await harness.launch({ uygulama: 'battle-game' });
    const result = await harness.launch({ uygulama: 'pony-life' });
    assert.equal(result.basarili, false);
    assert.match(result.hata, /Access denied/);
    assert.equal(harness.spawned.length, 1);
    assert.equal(harness.snapshot().aktifOyun, null);
});

test('external Steam launch rejection cleans up the owned bridge and returns the actual failure', async () => {
    const harness = mainHarness({ openExternal: async () => { throw new Error('Steam unavailable'); } });
    const result = await harness.launch({ uygulama: 'gelene-gecene' });
    assert.equal(result.basarili, false);
    assert.match(result.hata, /Steam unavailable/);
    assert.equal(harness.killed.length, 1);
    assert.equal(harness.snapshot().aktifOyun, null);
});

test('missing and expired licenses still block all process creation', async t => {
    for (const licenses of [{ lisans_kod: '' }, { is_unlimited: false, lisans_bitis: 1 }]) await t.test(JSON.stringify(licenses), async () => {
        const harness = mainHarness({ licenses });
        const result = await harness.launch({ uygulama: 'zombie-war' });
        assert.equal(result.basarili, false);
        assert.match(result.hata, /Lisans/);
        assert.deepEqual(harness.spawned, []);
    });
});

test('before-quit waits for cleanup and launcher closure also stops native games', async () => {
    const harness = mainHarness();
    await harness.launch({ uygulama: 'snow-war' });
    const session = harness.snapshot().session;
    let prevented = false;
    harness.app.emit('before-quit', { preventDefault: () => { prevented = true; } });
    await session.close();
    await tick();
    assert.equal(prevented, true);
    assert.equal(harness.killed.length, 1);
    assert.equal(harness.app.quitCount, 1);
    await harness.launch({ uygulama: 'zombie-war' });
    const second = harness.snapshot().session;
    harness.mainWindow.emit('closed');
    await second.close();
    assert.equal(harness.killed.length, 2);
});
