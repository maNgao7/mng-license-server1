'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { EventEmitter, once } = require('node:events');
const WebSocket = require('ws');
const { createPlatform, TTS_DEFAULTS } = require('../lib/platform.cjs');

const options = { timeout: 10000 };
const KEY = 'isolated-platform-test-key';
const STORE_KEYS = new Set(['library_root_v1', 'library_previous_paths_v1', 'media_root_v1',
    'media_studio_v1', 'content_catalog_v1', 'live_source_v1', 'tikfinity_url_v1', 'tts_settings_v1']);

// Evaluate only these pure helpers; importing main.js would boot Electron and user settings.
const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const helperStart = mainSource.indexOf('function widgetTikTokProfiliniOku(');
const helperEnd = mainSource.indexOf('function widgetTikTokYenidenBaglan(', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'main.js profile/gift contracts must be available');
const mainHelpers = vm.runInNewContext(mainSource.slice(helperStart, helperEnd)
    + '\n({ profile: widgetTikTokProfiliniOku, gift: widgetTikTokHediyesiniOku })');

function waitFor(emitter, name, predicate = () => true) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            emitter.off(name, listener);
            reject(new Error(`Timed out waiting for ${name}`));
        }, 4000);
        function listener(...args) {
            if (!predicate(...args)) return;
            clearTimeout(timer);
            emitter.off(name, listener);
            resolve(args);
        }
        emitter.on(name, listener);
    });
}

function fixture(t, initial = {}) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-platform-test-'));
    const libraryRoot = path.join(temporary, 'games');
    const mediaRoot = path.join(temporary, 'media');
    const values = new Map(Object.entries({ library_root_v1: libraryRoot, media_root_v1: mediaRoot, ...initial }));
    const writes = [];
    const store = {
        get(key, fallback) {
            assert.ok(STORE_KEYS.has(key), `Unexpected store read: ${key}`);
            return structuredClone(values.has(key) ? values.get(key) : fallback);
        },
        set(key, value) {
            assert.ok(STORE_KEYS.has(key), `Unexpected store write: ${key}`);
            values.set(key, structuredClone(value));
            writes.push({ key, value: structuredClone(value) });
        }
    };
    const handlers = new Map();
    const selections = [];
    const dialogs = [];
    const notifications = [];
    const statuses = [];
    const events = [];
    const observer = new EventEmitter();
    const legacyPaths = new Map();
    let directCloses = 0;
    const window = { webContents: { send: (name, data) => notifications.push({ name, data: structuredClone(data) }) } };
    const context = {
        app: {
            getPath(name) {
                assert.ok(['userData', 'videos'].includes(name));
                return path.join(temporary, name);
            },
            getVersion: () => 'test-version'
        },
        ipcMain: { handle(name, handler) { assert.equal(handlers.has(name), false); handlers.set(name, handler); } },
        store,
        dialog: { async showOpenDialog(owner, configuration) {
            assert.equal(owner, window);
            dialogs.push(configuration);
            assert.ok(selections.length, 'A fake dialog selection is required');
            return selections.shift();
        } },
        definitions: {
            alpha: { id: 'alpha', klasor: 'alpha', ad: 'Alpha', paketSurumu: '1.0.0', boyut: '1 MB' },
            'crowd-control': { id: 'crowd-control', klasor: 'crowd-control', ad: 'Crowd Control', paketSurumu: '1.0.0' },
            crowdControl: { id: 'crowd-control', klasor: 'crowd-control', ad: 'Crowd Control', paketSurumu: '1.0.0' }
        },
        getWindow: () => window,
        serverURL: () => 'https://catalog.invalid',
        accessKey: KEY,
        port: 18181,
        getChannel: () => 'testhost',
        profile: mainHelpers.profile,
        gift: mainHelpers.gift,
        setLiveStatus(status) { statuses.push(structuredClone(status)); observer.emit('status', status); },
        event(type, data) {
            const entry = structuredClone({ type, data });
            events.push(entry);
            observer.emit('event', type, data);
        },
        closeDirect: async () => { directCloses++; },
        resolveLegacy(id) {
            return store.get('library_previous_paths_v1', {})[id] || legacyPaths.get(id) || null;
        },
        validate: directory => Boolean(directory && fs.existsSync(path.join(directory, 'run.txt'))),
        extract: async () => assert.fail('No archive extraction is expected in these tests'),
        isRunning: () => false
    };
    let platform = createPlatform(context);
    t.after(() => {
        platform.close();
        assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
        fs.rmSync(temporary, { recursive: true, force: true });
    });
    return {
        temporary, libraryRoot, mediaRoot, store, writes, dialogs, notifications, statuses, events, observer, legacyPaths, context,
        get platform() { return platform; },
        get directCloses() { return directCloses; },
        select(...filePaths) { selections.push({ canceled: false, filePaths }); },
        cancel() { selections.push({ canceled: true, filePaths: [] }); },
        async invoke(name, data) {
            const handler = handlers.get('workspace-' + name);
            assert.equal(typeof handler, 'function', name);
            return handler({}, data);
        },
        write(relative, content = 'synthetic test content') {
            const file = path.join(temporary, relative);
            const resolved = path.relative(temporary, file);
            assert.ok(resolved && !resolved.startsWith('..') && !path.isAbsolute(resolved));
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, content);
            return file;
        },
        restart() { platform.close(); handlers.clear(); platform = createPlatform(context); }
    };
}

async function websocket(t) {
    const server = new WebSocket.Server({ host: '127.0.0.1', port: 0 });
    t.after(async () => {
        for (const socket of server.clients) socket.terminate();
        await new Promise(resolve => server.close(resolve));
    });
    await once(server, 'listening');
    return { server, endpoint: `ws://127.0.0.1:${server.address().port}/` };
}

async function connect(f, server) {
    const connected = once(server, 'connection');
    const ready = waitFor(f.observer, 'status', status => status.status === 'ready');
    f.platform.connectTikfinity('@TESTHOST');
    const [socket] = await connected;
    await ready;
    return socket;
}

test('snapshot exposes isolated roots, defaults, unique games and protected overlay URLs', options, async t => {
    const f = fixture(t);
    const snapshot = await f.invoke('snapshot');
    assert.equal(snapshot.libraryRoot, f.libraryRoot);
    assert.equal(snapshot.mediaRoot, f.mediaRoot);
    assert.equal(snapshot.source, 'direct');
    assert.equal(snapshot.tikfinityUrl, 'ws://127.0.0.1:21213/');
    assert.deepEqual(snapshot.tts, TTS_DEFAULTS);
    assert.equal(snapshot.version, 'test-version');
    assert.deepEqual(snapshot.games.map(game => game.id), ['alpha', 'crowd-control']);
    assert.equal(f.platform.statuses().crowdControl.id, 'crowd-control');
    const overlay = new URL(snapshot.overlayUrl);
    assert.equal(overlay.hostname, '127.0.0.1');
    assert.equal(overlay.searchParams.get('key'), KEY);
    assert.equal(overlay.searchParams.get('channel'), 'testhost');
    assert.deepEqual(f.writes, []);
});

test('invalid source names and nonlocal endpoints leave settings and direct connections intact', options, async t => {
    const f = fixture(t);
    for (const data of [{ source: 'other' }, {}, { source: 'tikfinity', endpoint: 'ws://example.com/' },
        { source: 'tikfinity', endpoint: 'wss://localhost/' }, { source: 'tikfinity', endpoint: 'ws://user@localhost/' }]) {
        const result = await f.invoke('source', data);
        assert.equal(typeof result.error, 'string');
        assert.ok(result.error);
    }
    assert.equal(f.directCloses, 0);
    assert.deepEqual(f.writes, []);
    assert.equal(f.platform.source(), 'direct');
});

test('switching sources persists the endpoint and closes an active Tikfinity socket', options, async t => {
    const f = fixture(t);
    const { server, endpoint } = await websocket(t);
    let snapshot = await f.invoke('source', { source: 'tikfinity', endpoint });
    assert.equal(snapshot.source, 'tikfinity');
    assert.equal(snapshot.tikfinityUrl, endpoint);
    assert.equal(f.directCloses, 1);
    assert.equal(server.clients.size, 0);
    const socket = await connect(f, server);
    assert.deepEqual(f.statuses.map(status => status.status), ['connecting', 'ready']);
    const closed = once(socket, 'close');
    snapshot = await f.invoke('source', { source: 'direct' });
    await closed;
    assert.equal(snapshot.source, 'direct');
    assert.equal(f.platform.source(), 'direct');
    assert.equal(snapshot.tikfinityUrl, endpoint);
    assert.equal(f.directCloses, 2);
    f.restart();
    assert.equal(f.platform.source(), 'direct');
    assert.equal(f.platform.snapshot().tikfinityUrl, endpoint);
});

test('Tikfinity events use main.js profile/gift contracts and forward typed live payloads', options, async t => {
    const f = fixture(t);
    const { server, endpoint } = await websocket(t);
    await f.invoke('source', { source: 'tikfinity', endpoint });
    const socket = await connect(f, server);
    const packets = [
        { event: 'chat', data: { msgId: 'chat-id', comment: 'hello', user: { uniqueId: '@Viewer', nickname: 'Viewer Name', avatarThumb: { urlList: ['https://images.invalid/avatar.png'] } } } },
        { event: 'gift', data: { msgId: 'gift-id', uniqueId: '@Gifter', giftId: 5655, repeatCount: '3', diamondCount: '2', giftName: 'Rose', giftType: 1, repeatEnd: true } },
        { event: 'like', data: { msgId: 'like-id', uniqueId: 'Liker', likeCount: 7 } },
        { event: 'follow', data: { logId: 'follow-id', uniqueId: 'Follower' } },
        { event: 'share', data: { msgId: 'share-id', uniqueId: 'Sharer', shareCount: 2 } },
        { event: 'member', data: { msgId: 'member-id', uniqueId: 'Member' } },
        { event: 'subscribe', data: { msgId: 'subscribe-id', uniqueId: 'Subscriber' } },
        { event: 'roomUser', data: { msgId: 'viewer-id', viewerCount: 42 } }
    ];
    const done = waitFor(f.observer, 'event', (_type, data) => data.eventId === 'viewer-id');
    for (const packet of packets) socket.send(JSON.stringify(packet));
    await done;
    assert.deepEqual(f.events.map(event => event.type), ['chat', 'gift', 'like', 'follow', 'share', 'member', 'subscribe', 'viewer']);
    for (const { type, data } of f.events) {
        assert.equal(typeof type, 'string');
        assert.equal(typeof data.username, 'string');
        assert.equal(typeof data.nickname, 'string');
        assert.equal(typeof data.avatar, 'string');
        assert.equal(typeof data.eventId, 'string');
        assert.doesNotThrow(() => JSON.stringify(data));
    }
    assert.equal(f.events[0].data.username, 'Viewer');
    assert.equal(f.events[0].data.message, 'hello');
    assert.equal(f.events[0].data.avatar, 'https://images.invalid/avatar.png');
    assert.deepEqual(f.events[1].data, { username: 'Gifter', nickname: 'Gifter', avatar: '', giftId: '5655', giftName: 'Rose', giftImage: '', repeatCount: 3, count: 3, coins: 6, eventId: 'gift-id' });
    assert.equal(typeof f.events[2].data.likeCount, 'number');
    assert.equal(f.events[3].data.eventId, 'follow-id');
    assert.equal(typeof f.events.at(-1).data.viewerCount, 'number');
    assert.equal(f.statuses.at(-1).status, 'connected');
    assert.equal(f.statuses.at(-1).username, 'testhost');
});

test('archive IPC imports more than one batch while preserving original titles, categories and filenames after restart', options, async t => {
    const f = fixture(t);
    const entries = Array.from({ length: 65 }, (_unused, index) => {
        const relativePath = `Racon/${String(index).padStart(3, '0')}-id${164 + index}-ESREF-TEK.mp4`;
        const bytes = Buffer.from(`synthetic video ${index}`);
        f.write(`archive/${relativePath}`, bytes);
        return { title: index ? `Original title ${index}` : 'E\u015eREF TEK', category: 'Racon \u00d6zg\u00fcn', relativePath,
            localPath: 'Z:/stale-unused-location.mp4', bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    });
    f.write('archive/manifest.json', JSON.stringify(entries));
    f.select(path.join(f.temporary, 'archive'));
    const snapshot = await f.invoke('media-folder');
    assert.equal(snapshot.error, undefined);
    assert.equal(snapshot.media.length, entries.length);
    const byFilename = new Map(snapshot.media.map(item => [item.filename, item]));
    for (const entry of entries) {
        const item = byFilename.get(path.basename(entry.relativePath));
        assert.ok(item);
        assert.equal(item.title, entry.title);
        assert.equal(item.category, entry.category);
        assert.equal(item.kind, 'video');
        assert.equal(item.bytes, entry.bytes);
    }
    const progress = f.notifications.filter(item => item.name === 'workspace-progress').map(item => item.data);
    assert.deepEqual(progress.filter(item => item.phase === 'importing').map(item => [item.completed, item.total]), [[64, 65], [65, 65]]);
    assert.equal(progress.filter(item => item.phase === 'verifying').length, 65);
    assert.equal(progress.at(-1).phase, 'complete');
    assert.equal(f.dialogs[0].properties[0], 'openDirectory');
    f.restart();
    assert.deepEqual(f.platform.snapshot().media, snapshot.media);
});

test('archive validation errors and canceled dialogs do not import or persist media', options, async t => {
    const f = fixture(t);
    const file = f.write('archive/clip.mp4', 'synthetic video');
    f.write('archive/manifest.json', JSON.stringify([{ title: 'Original name', category: 'Racon', relativePath: 'clip.mp4',
        bytes: fs.statSync(file).size, sha256: '0'.repeat(64) }]));
    f.select(path.dirname(file));
    const rejected = await f.invoke('media-folder');
    assert.equal(typeof rejected.error, 'string');
    assert.deepEqual(f.platform.snapshot().media, []);
    assert.equal(fs.existsSync(f.mediaRoot), false);
    f.cancel();
    assert.deepEqual((await f.invoke('media-import')).media, []);
    f.cancel();
    assert.deepEqual((await f.invoke('media-folder')).media, []);
    f.cancel();
    assert.deepEqual(await f.invoke('folder', { kind: 'media' }), { canceled: true });
    assert.deepEqual(f.writes, []);
});

test('changing the game root preserves managed and legacy paths using the main.js previous-path contract', options, async t => {
    const f = fixture(t, { library_previous_paths_v1: { older: 'Z:/synthetic-previous-game' } });
    const directory = crypto.randomUUID();
    const active = path.join(f.libraryRoot, '.game-library', 'alpha', 'versions', directory);
    f.write(path.relative(f.temporary, path.join(active, 'run.txt')), 'managed executable');
    f.write(path.relative(f.temporary, path.join(active, 'settings.json')), 'managed preferences');
    f.write('games/.game-library/alpha/active.json', JSON.stringify({ schema: 1, directory, version: '1.0.0' }));
    const legacy = path.dirname(f.write('legacy/crowd-control/run.txt', 'legacy executable'));
    f.legacyPaths.set('crowd-control', legacy);
    assert.equal(f.platform.pathFor('alpha'), active);
    assert.equal(f.platform.pathFor('crowd-control'), legacy);
    const selected = path.join(f.temporary, 'another-disk');
    fs.mkdirSync(selected);
    f.select(selected);
    const snapshot = await f.invoke('folder', { kind: 'games' });
    assert.equal(snapshot.libraryRoot, selected);
    assert.deepEqual(f.store.get('library_previous_paths_v1'), { older: 'Z:/synthetic-previous-game', alpha: active, 'crowd-control': legacy });
    assert.equal(f.platform.pathFor('alpha'), active);
    assert.equal(f.platform.pathFor('crowd-control'), legacy);
    assert.equal(fs.readFileSync(path.join(active, 'settings.json'), 'utf8'), 'managed preferences');
    assert.equal(fs.existsSync(path.join(selected, '.game-library')), false);
    f.restart();
    assert.equal(f.platform.pathFor('alpha'), active);
    assert.equal(f.platform.pathFor('crowd-control'), legacy);
});

test('changing the media root copies owned files and preserves IDs, filenames, preview and overlay URLs', options, async t => {
    const f = fixture(t);
    f.select(f.write('input/Original Clip.mp4', 'original clip bytes'));
    const original = (await f.invoke('media-import')).media[0];
    const savedFile = f.store.get('media_studio_v1').items[0].file;
    f.write('media/notes.txt', 'unrelated file');
    f.write('media/Katalog/unowned.mp4', 'unowned source');
    const selected = path.join(f.temporary, 'new-media');
    fs.mkdirSync(selected);
    f.select(selected);
    const snapshot = await f.invoke('folder', { kind: 'media' });
    assert.equal(snapshot.error, undefined);
    assert.equal(snapshot.mediaRoot, selected);
    assert.deepEqual(snapshot.media[0], original);
    assert.equal(fs.readFileSync(path.join(selected, savedFile), 'utf8'), 'original clip bytes');
    assert.equal(fs.readFileSync(path.join(f.mediaRoot, savedFile), 'utf8'), 'original clip bytes');
    assert.equal(fs.existsSync(path.join(selected, 'notes.txt')), false);
    assert.equal(fs.existsSync(path.join(selected, 'Katalog')), false);
    f.restart();
    assert.deepEqual(f.platform.snapshot().media[0], original);
});

test('media root collisions return an IPC error and keep the original library selected', options, async t => {
    const f = fixture(t);
    f.select(f.write('input/clip.mp4', 'original bytes'));
    const original = (await f.invoke('media-import')).media[0];
    const savedFile = f.store.get('media_studio_v1').items[0].file;
    const conflict = f.write(`conflict/${savedFile}`, 'different bytes');
    f.select(path.dirname(conflict));
    const result = await f.invoke('folder', { kind: 'media' });
    assert.equal(typeof result.error, 'string');
    assert.equal(f.store.get('media_root_v1'), f.mediaRoot);
    assert.deepEqual(f.platform.snapshot().media[0], original);
    assert.equal(fs.readFileSync(conflict, 'utf8'), 'different bytes');
});

test('media save validation is returned through IPC and test/ingest emit object payloads', options, async t => {
    const f = fixture(t);
    f.select(f.write('input/clip.mp4'));
    const original = (await f.invoke('media-import')).media[0];
    const invalid = await f.invoke('media-save', { id: original.id, title: '' });
    assert.equal(typeof invalid.error, 'string');
    assert.equal(f.platform.snapshot().media[0].title, original.title);
    const snapshot = await f.invoke('media-save', { id: original.id, giftId: '5655', title: 'Edited name' });
    assert.equal(snapshot.media[0].id, original.id);
    assert.equal(snapshot.media[0].previewUrl, original.previewUrl);
    assert.deepEqual(await f.invoke('media-test', { id: original.id }), { ok: true, receivers: 0 });
    const preview = f.notifications.find(item => item.name === 'workspace-media-event').data;
    assert.equal(preview.type, 'studio:play');
    assert.equal(preview.test, true);
    assert.equal(preview.item.id, original.id);
    f.platform.ingest('gift', { eventId: 'test-gift', giftId: '5655', count: 2 }, 'testhost');
    const emitted = f.notifications.filter(item => item.name === 'workspace-media-event').at(-1).data;
    assert.equal(emitted.test, false);
    assert.deepEqual(emitted.trigger, { type: 'gift', eventId: 'test-gift', giftId: '5655', count: 2 });
    f.platform.ingest('chat', { username: 'viewer', message: 'hello' }, 'testhost');
    assert.deepEqual(f.notifications.at(-1), { name: 'workspace-chat', data: { username: 'viewer', message: 'hello' } });
});

test('TTS settings are clamped, truncated and retained after restart', options, async t => {
    const f = fixture(t);
    const snapshot = await f.invoke('tts', { enabled: 1, names: 0, volume: 5, rate: -3, pitch: 99, maxLength: 900,
        cooldownSeconds: -5, voiceURI: 'v'.repeat(250), blockedWords: 'w'.repeat(2500) });
    assert.deepEqual(snapshot.tts, { ...TTS_DEFAULTS, enabled: true, names: false, volume: 1, rate: 0.5, pitch: 2, maxLength: 500,
        cooldownSeconds: 1, voiceURI: 'v'.repeat(200), blockedWords: 'w'.repeat(2000) });
    f.restart();
    assert.deepEqual(f.platform.snapshot().tts, snapshot.tts);
});

test('game overlay URLs, imports and duplicate actions preserve global mappings', options, async t => {
    const f = fixture(t);
    f.context.getActiveGame = () => 'alpha';
    f.restart();
    f.select(f.write('input/clip.mp4', 'synthetic bytes'));
    const imported = await f.invoke('media-import');
    const original = imported.media[0];
    await f.invoke('media-save', { id: original.id, giftId: '5655', enabled: true });
    const duplicated = await f.invoke('media-duplicate', { id: original.id, gameId: 'alpha' });
    assert.equal(duplicated.error, undefined);
    const copy = duplicated.media.find(item => item.id !== original.id);
    assert.equal(copy.gameId, 'alpha');assert.equal(copy.giftId, '');assert.equal(copy.enabled, true);
    const global = duplicated.media.find(item => item.id === original.id);
    assert.equal(global.gameId, '');assert.equal(global.giftId, '5655');assert.equal(global.enabled, true);
    assert.equal(new URL(copy.overlayUrl).searchParams.get('game'), 'alpha');
    assert.equal(new URL(duplicated.games.find(game => game.id === 'alpha').overlayUrl).searchParams.get('game'), 'alpha');
    assert.equal(duplicated.activeGame, 'alpha');
    const count = duplicated.media.length;
    const invalid = await f.invoke('media-duplicate', { id: original.id, gameId: 'not-a-game' });
    assert.ok(invalid.error);assert.equal(f.platform.snapshot().media.length, count);
    const rejected = await f.invoke('media-save', { id: original.id, gameId: '../escape' });
    assert.ok(rejected.error);assert.equal(f.platform.snapshot().media.find(item => item.id === original.id).gameId, '');
    f.select(f.write('input/own-image.png', 'synthetic image bytes'));
    const withImage = await f.invoke('media-import', { gameId: 'alpha' });
    const image = withImage.media.find(item => item.kind === 'image');
    assert.equal(image.gameId, 'alpha');
    assert.ok(f.dialogs.at(-1).filters[0].extensions.includes('gif'));
    const next = path.join(f.temporary, 'new-images');fs.mkdirSync(next);f.select(next);
    const moved = await f.invoke('folder', { kind: 'media' });
    assert.equal(moved.error, undefined);
    const record = f.store.get('media_studio_v1').items.find(item => item.id === image.id);
    assert.equal(fs.readFileSync(path.join(next, record.file), 'utf8'), 'synthetic image bytes');
    f.restart();assert.equal(f.platform.snapshot().media.find(item => item.id === image.id).gameId, 'alpha');
});

test('central chat speech requires configured gift/follow events from the active channel', options, async t => {
    const f = fixture(t);
    await f.invoke('tts', { ...TTS_DEFAULTS, enabled: true, audience: 'gift', giftId: '7934', voicePreset: 'child' });
    const messages = () => f.notifications.filter(item => item.name === 'workspace-chat');
    f.platform.ingest('chat', { username: 'viewer', message: 'not yet' }, 'testhost');
    assert.equal(messages().length, 0);
    f.platform.ingest('gift', { username: 'viewer', giftId: '5655' }, 'testhost');
    f.platform.ingest('chat', { username: 'viewer', message: 'wrong gift' }, 'testhost');
    assert.equal(messages().length, 0);
    f.platform.ingest('gift', { username: 'viewer', giftId: '7934' }, 'anotherhost');
    f.platform.ingest('chat', { username: 'viewer', message: 'wrong channel' }, 'testhost');
    assert.equal(messages().length, 0);
    f.platform.ingest('gift', { username: 'viewer', giftId: '7934' }, 'testhost');
    f.platform.ingest('chat', { username: '@VIEWER', message: 'allowed' }, 'testhost');
    assert.equal(messages().length, 1);
    await f.invoke('tts', { ...TTS_DEFAULTS, enabled: true, audience: 'follow', voicePreset: 'female' });
    f.platform.ingest('chat', { username: 'viewer', message: 'gift is insufficient now' }, 'testhost');
    assert.equal(messages().length, 1);
    f.platform.ingest('follow', { username: 'viewer' }, 'testhost');
    f.platform.ingest('chat', { username: 'viewer', message: 'following now' }, 'testhost');
    assert.equal(messages().length, 2);
    assert.equal(f.platform.snapshot().tts.voicePreset, 'female');
});

test('catalog refresh validates responses and retains the cached catalog on errors', options, async t => {
    const f = fixture(t);
    let body = { schemaVersion: 1, revision: 7, games: [{ id: 'alpha', title: 'Published Alpha', version: '2.0.0', url: '/game.zip', sha256: 'a'.repeat(64) }], media: [] };
    t.mock.method(globalThis, 'fetch', async url => {
        assert.equal(url, 'https://catalog.invalid/api/content/catalog');
        return Response.json(body);
    });
    const refreshed = await f.invoke('refresh');
    assert.equal(refreshed.catalogRevision, 7);
    assert.equal(refreshed.games.find(game => game.id === 'alpha').ad, 'Published Alpha');
    assert.equal(refreshed.games.find(game => game.id === 'alpha').availableVersion, '2.0.0');
    const validCatalog = f.store.get('content_catalog_v1');
    for (const invalid of [
        { schemaVersion: 2, games: [], media: [] },
        { schemaVersion: 1, games: [{ id: 'alpha', url: 'http://unsafe.invalid/game.zip' }], media: [] },
        { schemaVersion: 1, games: [{ id: 'alpha', sha256: 'invalid' }], media: [] }
    ]) {
        body = invalid;
        const rejected = await f.invoke('refresh');
        assert.ok(rejected.catalogError);
        assert.equal(rejected.catalogRevision, 7);
        assert.deepEqual(f.store.get('content_catalog_v1'), validCatalog);
    }
});

test('missing catalog service reports a usable local fallback without a raw 404 error', options, async t => {
    const f = fixture(t);
    t.mock.method(globalThis, 'fetch', async () => new Response('Cannot GET', { status: 404 }));
    const result = await f.invoke('refresh');
    assert.equal(result.catalogStatus.source, 'bundled');assert.equal(result.catalogStatus.code, 'not-published');
    assert.ok(!result.catalogError.includes('404'));assert.ok(result.games.length > 0);
    assert.equal(f.writes.some(write=>write.key==='content_catalog_v1'),false);
});

test('speech IPC forwards only supported voice settings and never returns saved credentials', options, async t => {
    const f = fixture(t);const seen=[];let canceled=0;
    const status={ voices:[{ voiceURI:'azure:tr-TR-EmelNeural', gender:'female' }], providers:{ azure:{ configured:true,available:true } }, profiles:[] };
    f.context.speechService={status:async()=>status,synthesize:async input=>{seen.push(input);return {audioBase64:'synthetic-only',mimeType:'audio/wav'};},configure:config=>seen.push(config),cancel:()=>canceled++};
    f.context.speechCredentials={read:()=>({key:'private-key-only-in-main',region:'testregion'}),write:()=>({key:'replacement-private',region:'testregion'})};f.restart();
    assert.deepEqual(await f.invoke('speech-status'),{...status,credentialError:''});
    await f.invoke('speech-synthesize',{text:'Merhaba',voiceURI:'azure:tr-TR-EmelNeural',voicePreset:'female',provider:'azure',rate:1,allowOfflineFallback:false,key:'must-not-forward',url:'https://must-not-forward.invalid'});
    assert.equal(seen[0].voicePreset,'female');assert.equal(Object.hasOwn(seen[0],'key'),false);assert.equal(Object.hasOwn(seen[0],'url'),false);
    const configured=await f.invoke('speech-configure',{key:'new-private',region:'testregion'});assert.ok(!JSON.stringify(configured).includes('private'));
    await f.invoke('speech-cancel');assert.ok(canceled>0);
    f.context.speechCredentials.read=()=>{throw new Error('private-sensitive-failure');};f.restart();
    const recovered=await f.invoke('speech-status');assert.ok(recovered.credentialError);assert.ok(!recovered.credentialError.includes('sensitive'));
});

test('broadcast links stay empty until HTTPS publisher is ready and never expose the local key', options, async t => {
    const f = fixture(t);let ready=false,retries=0;
    f.context.getOverlayStatus=()=>({ready,status:ready?'connected':'retrying'});
    f.context.broadcastURL=local=>{
        if(!ready)return '';
        const url=new URL(local);url.searchParams.delete('key');url.searchParams.delete('channel');
        return 'https://overlay.invalid/overlays/'+'a'.repeat(43)+url.pathname+url.search;
    };
    f.context.reconnectOverlay=()=>{retries++;};f.restart();
    f.select(f.write('input/clip.mp4','synthetic bytes'));await f.invoke('media-import');
    let snapshot=f.platform.snapshot();
    assert.equal(snapshot.broadcastUrl,'');assert.equal(snapshot.games[0].broadcastUrl,'');
    assert.equal(snapshot.media[0].broadcastUrl,'');assert.equal(snapshot.overlayTransport.ready,false);
    assert.ok(snapshot.overlayUrl.includes(KEY),'Internal preview keeps its protected local URL');
    ready=true;snapshot=f.platform.snapshot();
    for(const url of [snapshot.broadcastUrl,...snapshot.games.map(game=>game.broadcastUrl),snapshot.media[0].broadcastUrl]){
        assert.ok(url.startsWith('https://overlay.invalid/overlays/'));assert.ok(!url.includes(KEY));
        assert.equal(new URL(url).searchParams.has('channel'),false);
    }
    assert.equal(new URL(snapshot.games[0].broadcastUrl).searchParams.get('game'),'alpha');
    const status=await f.invoke('overlay-status',{gameId:'alpha'});
    assert.equal(status.transport.ready,true);assert.equal(status.url,snapshot.games[0].broadcastUrl);
    await f.invoke('overlay-reconnect');assert.equal(retries,1);
});
