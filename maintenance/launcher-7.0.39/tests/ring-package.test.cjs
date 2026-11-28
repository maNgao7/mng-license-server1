'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const ring = require('../lib/ring-package.cjs');
const { GameLaunchSession } = require('../lib/game-launch-session.cjs');
const { createSharedGameEvents } = require('../lib/shared-game-events.cjs');
const vdf = require('../lib/vendor/steam-vdf/lib/index.js');

async function put(file, value = 'fixture') {
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, value);
}

async function fixture(t) {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'tikmng-ring-test-'));
    const directory = path.join(root, 'Ring'), source = path.join(root, 'Steam/steamapps/common/OnlineBoxing3DDemo');
    const dataDirectory = path.join(root, 'profile/ring');
    const events = createSharedGameEvents(), children = [], received = [];
    let owners = 0, closed = 0, connectCount = 0, spawnOptions;
    const session = new GameLaunchSession({ game: 'ring', title: 'Ring', terminate: async child => { child.exitCode = 0; } });
    session.ensureLive = async () => { connectCount++; };
    t.after(async () => {
        await session.close(); events.close();
        assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
        assert.match(path.basename(root), /^tikmng-ring-test-/);
        await fsp.rm(root, { recursive: true, force: true });
    });
    for (const file of ['Ring.exe', 'resources/app/main.cjs', 'bridge/runtime/owner-helper.cjs', 'bridge/runtime/gift-assets/katalog_tam.json']) await put(path.join(directory, file));
    await put(path.join(directory, 'resources/app/package.json'), JSON.stringify({ main: 'main.cjs' }));
    await put(path.join(source, 'boxing.exe'));
    const steam = { directory: source, buildId: '26880802' };
    const getChannel = () => 'fixture-channel', getStatus = () => ({ status: 'connected' });
    const deps = {
        findSteam: () => steam,
        hashSource: async file => { assert.equal(file, path.join(source, 'boxing.exe')); return ring.STEAM_SHA256; },
        createOwner: async options => {
            owners++;
            assert.equal(options.ensureLive, session.ensureLive);
            assert.equal(options.getChannel, getChannel); assert.equal(options.getStatus, getStatus);
            assert.equal(options.journalFile, path.join(dataDirectory, 'launcher-live.jsonl'));
            assert.equal(options.portraitDirectory, path.join(dataDirectory, 'launcher-portraits'));
            const unsubscribe = options.subscribeSharedEvents((...args) => received.push(args));
            return { childEnvironment: { MNG_LIVE_OWNER_URL: 'http://127.0.0.1:45678', MNG_LIVE_OWNER_TOKEN: 'fixture-token' },
                close: async () => { closed++; unsubscribe(); } };
        },
        spawnProcess: (file, args, options) => {
            assert.equal(file, path.join(directory, 'Ring.exe')); assert.deepEqual(args, []);
            spawnOptions = options;
            const child = Object.assign(new EventEmitter(), { pid: 123456789, exitCode: null, signalCode: null,
                stdout: new EventEmitter(), stderr: new EventEmitter() });
            children.push(child);
            return child;
        }
    };
    const launch = (overrides = {}) => ring.launchRing({ directory, dataDirectory, session, events, getChannel, getStatus }, { ...deps, ...overrides });
    const waitForSpawn = async () => {
        for (let i = 0; i < 100 && !spawnOptions; i++) await new Promise(resolve => setTimeout(resolve, 5));
        assert.ok(spawnOptions, 'child spawned'); return spawnOptions;
    };
    return { root, directory, source, dataDirectory, events, session, steam, deps, children, received, launch, waitForSpawn,
        counts: () => ({ owners, closed, connectCount }) };
}

test('Ring metadata has its independent package, selected cover, Steam prerequisite and no gift PNG', () => {
    const catalog = require('../lib/catalog-defaults.json');
    const game = catalog.games.find(game => game.id === 'ring');
    const published = require('../lib/published-games.json').games.find(game => game.id === 'ring');
    assert.equal(game.version, '0.1.0'); assert.equal(published.definition.paketSurumu, '0.1.0');
    assert.equal(game.url, 'https://github.com/maNgao7/mng-license-server1/releases/download/ring-0.1.0/Ring-Windows-x64.zip');
    assert.match(game.requirements, /4793540/);
    assert.deepEqual(game.resources, [
        { title: 'Kurulum ve kullanım videosu', url: 'https://www.youtube.com/watch?v=Il6t2jrBy1c' },
        { title: 'Steam · Online Boxing 3D Demo indir', url: ring.STORE_URL }
    ]);
    // Parent release work supplies integrity metadata; never invent a digest here.
    assert.ok(game.sha256 === null || /^[a-f0-9]{64}$/.test(game.sha256));
    assert.equal(published.cover, 'ring-v1');
    const artwork = require('../renderer/assets/game-covers/artwork-current.json').covers.find(row => row.id === 'ring');
    assert.equal(artwork.currentFile, 'ring-v1.png');
    const cover = fs.readFileSync(path.join(__dirname, '../renderer/assets/game-covers/ring-v1.png'));
    assert.equal(crypto.createHash('sha256').update(cover).digest('hex'), artwork.sha256);
    assert.equal(require('../lib/game-resources.cjs').getGuide('ring'), null);
    const { validateCatalog } = require('../lib/content-catalog.cjs');
    assert.ok(validateCatalog(catalog, { serverURL: 'https://example.org' }).games.some(game => game.id === 'ring'));
});

test('Ring uses six existing numbered rule paragraphs and its tutorial', () => {
    const script = fs.readFileSync(path.join(__dirname, '../renderer/workspace.js'), 'utf8');
    const instructions = vm.runInNewContext('(' + /const gameInstructions = (\{[\s\S]*?\n    \});/.exec(script)[1] + ')');
    assert.equal(instructions.ring.steps.length, 6);
    const text = instructions.ring.steps.flat().join(' ');
    for (const token of ['0 FPS', '5 FPS', '100 beğeni 1 FPS', '100 beğeni 2 yumruk', '5655', '5269', 'P', 'B', 'OBS', 'Üç widget']) assert.ok(text.includes(token), token);
    assert.match(script, /'ring': 'https:\/\/www.youtube.com\/watch\?v=Il6t2jrBy1c'/);
    const main = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
    assert.match(main, /oyunId === 'ring'\) return require\('\.\/lib\/ring-package.cjs'\).validatePackageDirectory\(dir\)/);
    assert.match(main, /uygulama === 'ring'[\s\S]*?launchRing\(\{[\s\S]*?dataDirectory: path.join\(app.getPath\('userData'\), 'ring'\)/);
});

test('Ring validates root Electron layout and safe entry point without shipping the Steam executable', async t => {
    const f = await fixture(t);
    assert.equal(ring.validatePackageDirectory(f.directory), true);
    assert.equal(fs.existsSync(path.join(f.directory, 'boxing.exe')), false);
    for (const file of ['Ring.exe', 'resources/app/main.cjs', 'bridge/runtime/owner-helper.cjs', 'bridge/runtime/gift-assets/katalog_tam.json']) {
        const full = path.join(f.directory, file), original = await fsp.readFile(full);
        await fsp.writeFile(full, ''); assert.equal(ring.validatePackageDirectory(f.directory), false, file);
        await fsp.writeFile(full, original);
    }
    await put(path.join(f.directory, 'resources/app/package.json'), '{"main":"../../outside.cjs"}');
    assert.equal(ring.validatePackageDirectory(f.directory), false);
    assert.equal(ring.validatePackageDirectory(null), false);
});

test('Ring finds installed app 4793540 through Steam libraryfolders and rejects unsafe or wrong manifests', async t => {
    const f = await fixture(t), library = path.join(f.root, 'Steam'), launcher = path.join(f.root, 'Steam client');
    await put(path.join(launcher, 'steamapps/libraryfolders.vdf'), vdf.stringify({ libraryfolders: { 0: { path: library } } }));
    const manifest = path.join(library, 'steamapps/appmanifest_4793540.acf');
    const state = { appid: '4793540', StateFlags: '4', buildid: f.steam.buildId, installdir: 'OnlineBoxing3DDemo' };
    await put(manifest, vdf.stringify({ AppState: state }));
    assert.deepEqual(ring.findSteamDemo({ roots: [launcher] }), f.steam);
    for (const change of [{ appid: '1' }, { StateFlags: '2' }, { installdir: '../outside' }, { installdir: '..\\outside' }, { buildid: 'bad' }]) {
        await put(manifest, vdf.stringify({ AppState: { ...state, ...change } }));
        assert.equal(ring.findSteamDemo({ roots: [launcher] }), null);
    }
    await put(manifest, vdf.stringify({ AppState: state }));
    await fsp.rm(path.join(f.source, 'boxing.exe'));
    assert.equal(ring.findSteamDemo({ roots: [launcher] }), null);
});

test('Ring requires the hash-pinned external Steam demo before any owner or process', async t => {
    const f = await fixture(t);
    await assert.rejects(f.launch({ findSteam: () => null }), /4793540.*https:\/\/store\.steampowered.com\/app\/4793540\//);
    await assert.rejects(f.launch({ hashSource: async () => '0'.repeat(64) }), /bütünlüğünü doğrula/);
    await assert.rejects(ring.resolveSteamDemo({ directory: f.directory, steam: { directory: f.directory }, hashSource: f.deps.hashSource }), /ayrı klasör/);
    assert.deepEqual(f.counts(), { owners: 0, closed: 0, connectCount: 0 });
    assert.equal(f.children.length, 0);
});

test('Ring accepts exactly the old native and current Steam source hashes without modifying Steam', async t => {
    const f = await fixture(t), executable = path.join(f.source, 'boxing.exe');
    const before = await fsp.readFile(executable);
    assert.deepEqual(ring.STEAM_SOURCE_HASHES, [
        '9132d5631f59661f8bde912d6b1e5b9788c24fd7031bb1aa81d16b298b293e67',
        'fe6f213d0f8eabc4674f9160fcee128f448727c255a8ed8a1a029b5a58d782ed'
    ]);
    for (const hash of ring.STEAM_SOURCE_HASHES) {
        assert.equal(await ring.resolveSteamDemo({ directory: f.directory, steam: f.steam,
            hashSource: async file => { assert.equal(file, executable); return hash; } }), f.source);
    }
    assert.deepEqual(await fsp.readFile(executable), before);
    assert.deepEqual(await fsp.readdir(f.source), ['boxing.exe']);
    assert.equal(f.children.length, 0);
});

test('Ring shares one owner, preserves event identities, waits for 4 and cleans its signal on success', async t => {
    const f = await fixture(t);
    const launch = f.launch();
    const options = await f.waitForSpawn();
    assert.equal(options.cwd, f.directory);
    assert.equal(options.env.TIKMNG_RING_DATA_DIR, f.dataDirectory);
    assert.equal(options.env.TIKMNG_RING_GAME_SOURCE, f.source);
    assert.equal(options.env.MNG_LIVE_OWNER_TOKEN, 'fixture-token');
    for (const name of ['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'NODE_PATH']) assert.equal(Object.hasOwn(options.env, name), false);
    assert.equal(f.session.nativeChild, f.children[0]);
    assert.equal(f.events.size, 1); assert.equal(f.session.children.size, 1);
    const event = { eventId: 'same-live-event', username: 'viewer', giftId: '5655', repeatCount: 2 };
    f.events.publish('gift', event, { channel: 'fixture-channel', source: 'live' });
    f.events.publish('gift', event, { channel: 'fixture-channel', source: 'live' });
    assert.equal(f.received.length, 2);
    assert.equal(f.received[0][1], event); assert.equal(f.received[1][1].eventId, event.eventId);
    // Deduplication remains with the existing owner/game; launch never invents IDs or rewards.
    await put(options.env.TIKMNG_RING_STARTUP_SIGNAL, '3');
    await new Promise(resolve => setTimeout(resolve, 130)); assert.equal(f.session.ready, false);
    await put(options.env.TIKMNG_RING_STARTUP_SIGNAL, '4');
    assert.deepEqual(await launch, { basarili: true });
    assert.equal(f.session.ready, true); assert.equal(fs.existsSync(options.env.TIKMNG_RING_STARTUP_SIGNAL), false);
    assert.deepEqual(f.counts(), { owners: 1, closed: 0, connectCount: 0 });
    f.children[0].emit('exit', 0, null); await f.session.close();
    assert.equal(f.events.size, 0); assert.equal(f.counts().closed, 1);
});

test('Ring readiness has a 45-second deadline and cleans up on timeout', async t => {
    const f = await fixture(t), stage = f.session.stage.bind(f.session);
    f.session.stage = (phase, message, operation, timeout) => {
        assert.equal(phase, 'game-ready'); assert.equal(timeout, 45000);
        return stage(phase, message, operation, 25);
    };
    await assert.rejects(f.launch(), /Zaman asimi/);
    assert.equal(f.session.closed, true); assert.equal(f.events.size, 0); assert.equal(f.counts().closed, 1);
    assert.equal(f.children[0].exitCode, 0);
    assert.deepEqual((await fsp.readdir(f.dataDirectory)).filter(name => name.endsWith('.signal')), []);
});

test('Ring early process failure is visible and releases the owner', async t => {
    const f = await fixture(t), launch = f.launch();
    await f.waitForSpawn();
    f.children[0].emit('error', new Error('fixture spawn failure'));
    await assert.rejects(launch, /fixture spawn failure/);
    assert.equal(f.events.size, 0); assert.equal(f.counts().closed, 1);
});

test('Ring cancellation while creating an owner closes it without spawning', async t => {
    const f = await fixture(t);
    await assert.rejects(f.launch({ createOwner: async options => {
        const owner = await f.deps.createOwner(options); await f.session.close(); return owner;
    } }), /iptal/);
    assert.equal(f.children.length, 0); assert.equal(f.counts().closed, 1); assert.equal(f.events.size, 0);
});
