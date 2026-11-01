'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness({ service, prepareError, authenticated = true } = {}) {
    const prepared = [], spawned = [], writes = [], owned = [], waits = [];
    const backend = { file: 'C:/launcher/TikMnG.exe', args: ['server.mjs'], options: {}, url: 'http://127.0.0.1:4051' };
    const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
    const start = source.indexOf('async function sesliSurusPaketiniHazirla(');
    const end = source.indexOf('async function uygulamayiAc(', start);
    assert.ok(start > 0 && end > start);
    const context = vm.createContext({
        path, AbortSignal, preview: { enabled: false }, process: { execPath: backend.file },
        platform: { pathFor: () => 'C:/package' }, app: { getPath: () => 'C:/profile' },
        fs: { existsSync: () => true, readFileSync: () => 'isolated-local-token', writeFileSync: (file, value) => writes.push({ file, value }) },
        console: { info: () => {} },
        fetch: async url => {
            if (!service) throw new Error('ECONNREFUSED');
            return { ok: url.endsWith('/mod/state') ? authenticated : true, json: async () => service };
        },
        require: name => {
            if (name === './lib/native-game.cjs') return { findVoiceDrivingGame: () => 'C:/SteamDemo' };
            assert.equal(name, './lib/voice-driving-package.cjs');
            return { prepareLaunch: async options => {
                prepared.push(options);
                if (prepareError) throw prepareError;
                return { backend: options.electronPath ? backend : null, timings: { verifiedFiles: 8176 } };
            } };
        },
        spawn: (...args) => { spawned.push(args); return { pid: 12345 }; }
    });
    vm.runInContext(source.slice(start, end), context);
    const session = { stage: async (_phase, _message, operation) => operation(),
        ownChild: child => owned.push(child), waitForHttp: async (...args) => waits.push(args) };
    return { prepared, spawned, owned, writes, waits,
        launch: () => context.sesliSurusPaketiniHazirla(session) };
}

test('real launcher cold-start path prepares once and spawns its verified backend specification', async () => {
    const qa = harness();
    assert.equal(await qa.launch(), 'C:/SteamDemo');
    assert.equal(qa.prepared.length, 1);
    assert.equal(qa.prepared[0].electronPath, 'C:/launcher/TikMnG.exe');
    assert.equal(qa.spawned.length, 1);
    assert.equal(qa.spawned[0][0], qa.prepared[0].electronPath);
    assert.equal(qa.owned.length, 1); assert.equal(qa.waits.length, 1);
    assert.equal(qa.writes.length, 1); assert.match(qa.writes[0].file, /TikMnG.LocalConnection.token$/);
});

test('real launcher authenticated service reuse prepares once without another backend', async () => {
    const qa = harness({ service: { product: 'tikmng-caaahr-voice' } });
    await qa.launch();
    assert.equal(qa.prepared.length, 1); assert.equal(qa.prepared[0].electronPath, undefined);
    assert.equal(qa.spawned.length, 0); assert.equal(qa.waits.length, 0);
});

test('real launcher verification failure never starts a backend or writes credentials', async () => {
    const qa = harness({ prepareError: new Error('Package SHA-256 mismatch') });
    await assert.rejects(qa.launch(), /SHA-256 mismatch/);
    assert.equal(qa.spawned.length, 0); assert.equal(qa.writes.length, 0);
});

test('real launcher never adopts another product or unauthenticated service', async () => {
    for (const options of [{ service: { product: 'unrelated' } },
        { service: { product: 'tikmng-caaahr-voice' }, authenticated: false }]) {
        const qa = harness(options);
        await assert.rejects(qa.launch(), /başka|Başka/);
        assert.equal(qa.prepared.length, 0); assert.equal(qa.spawned.length, 0);
    }
});
