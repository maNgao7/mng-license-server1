'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const base = path.resolve(__dirname, '..', 'bridge');
const { username, numericId, normalizeProfile, terminalGift, normalizeGift, normalizeAudience, CommandCursor } = require('../bridge/normalize.cjs');
const { OWN_EVENT, atomicWrite, optionalJson, layout, DedupeJournal, EventSpool } = require('../bridge/storage.cjs');
const { MAX_BYTES, avatarUrl, publicAddress, downloadAvatar, convertAvatar, AvatarCache } = require('../bridge/avatars.cjs');
const { createBridge, parseArgs, readApiKey, loadSdk, createSdkFactory } = require('../bridge/index.cjs');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==', 'base64');
const CDN = 'https://p16-sign.tiktokcdn-us.com/avatar.png';
const settle = () => new Promise(resolve => setImmediate(resolve));
const gift = patch => ({ common: { msgId: '10001' }, giftId: 5655, giftType: 0, repeatCount: 1,
    user: { userId: '123', uniqueId: 'viewer', nickname: 'Same display name' }, ...patch });

function fixture(t) {
    const root = fs.mkdtempSync(path.join(base, '.test-'));
    const cleanups = [];
    t.after(async () => {
        for (const cleanup of cleanups.reverse()) await cleanup();
        const resolved = fs.realpathSync(root);
        assert.equal(path.dirname(resolved), fs.realpathSync(base));
        assert.ok(path.basename(resolved).startsWith('.test-'));
        fs.rmSync(resolved, { recursive: true });
    });
    return { root, cleanup: fn => cleanups.push(fn) };
}

class FakeConnection extends EventEmitter {
    constructor(connect) { super(); this.isConnected = false; this.disconnections = 0; this.connectImpl = connect; }
    async connect() {
        const result = this.connectImpl ? await this.connectImpl() : { roomId: '987654321123456789' };
        this.isConnected = true;
        return result;
    }
    disconnect() { this.disconnections++; this.isConnected = false; return Promise.resolve(); }
}

class FakeTimers {
    constructor() { this.time = 1000; this.next = 0; this.tasks = new Map(); }
    setTimeout(fn, delay) { const id = ++this.next; this.tasks.set(id, { fn, at: this.time + delay }); return id; }
    clearTimeout(id) { this.tasks.delete(id); }
    async advance(delay) {
        const end = this.time + delay;
        while (true) {
            const item = [...this.tasks].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
            if (!item) break;
            this.time = item[1].at;
            this.tasks.delete(item[0]);
            item[1].fn();
            await settle();
        }
        this.time = end;
        await settle();
    }
}

function harness(t, options = {}) {
    const owned = fixture(t);
    const connections = [];
    const logs = [];
    const bridge = createBridge({ root: owned.root, log: value => logs.push(value),
        createConnection: async () => { const connection = new FakeConnection(); connections.push(connection); return connection; }, ...options });
    owned.cleanup(() => bridge.close());
    return { ...owned, bridge, connections, logs, events: () => fs.readdirSync(bridge.paths.events)
        .filter(name => OWN_EVENT.test(name)).sort().map(name => optionalJson(path.join(bridge.paths.events, name))) };
}

async function connected(h, seq = 1, name = 'first') {
    h.bridge.command({ seq, op: 'connect', username: name });
    await settle();
    h.bridge.tick();
    assert.equal(h.bridge.status().status, 'connected');
}

function fakeRequest(responses, visits = []) {
    return (url, options, callback) => {
        visits.push(url.href);
        const req = new EventEmitter();
        req.destroy = error => { if (error) req.emit('error', error); };
        queueMicrotask(() => {
            const config = responses.shift();
            if (!config) return req.emit('error', new Error('unexpected-request'));
            const response = Readable.from(config.chunks || [config.bytes || PNG]);
            response.statusCode = config.status || 200;
            response.headers = config.headers || { 'content-type': 'image/png' };
            callback(response);
        });
        assert.equal(typeof options.lookup, 'function');
        return req;
    };
}

test('username normalization uses account identity and rejects display labels', () => {
    assert.equal(username(' @Viewer.Name_1 '), 'viewer.name_1');
    for (const value of ['bad name', 'https://tiktok.com/@a', '../x', {}, '', 'x'.repeat(129)]) assert.equal(username(value), '');
});

test('audience likes use the individual batch, not total broadcast likes', () => {
    const payload = { common: { msgId: '778' }, user: { uniqueId: 'viewer', id: '123' }, likeCount: 7, totalLikeCount: 9000 };
    const result = normalizeAudience('like', payload, 'epoch', 'room');
    assert.equal(result.event.likeCount, 7);
    assert.equal(result.event.kind, 'like');
    assert.equal(normalizeAudience('like', { ...payload, likeCount: undefined }, 'e'), null);
    assert.equal(normalizeAudience('like', { ...payload, likeCount: -1 }, 'e'), null);
    assert.equal(normalizeAudience('like', { ...payload, likeCount: true }, 'e'), null);
    assert.equal(normalizeAudience('like', { ...payload, likeCount: [100] }, 'e'), null);
    assert.equal(normalizeAudience('like', { ...payload, likeCount: undefined, count: 13 }, 'e').event.likeCount, 13);
    assert.equal(normalizeAudience('follow', { user: payload.user }, 'e'), null);
    assert.notEqual(result.event.eventId, normalizeAudience('follow', payload, 'epoch', 'room').event.eventId);
});

test('bridge delivers likes and follows once with native IDs across reconnects', async t => {
    const h = harness(t);
    await connected(h);
    const payload = { common: { msgId: '4455' }, user: { uniqueId: 'alice', id: '123' }, likeCount: 99 };
    h.connections[0].emit('like', payload); h.connections[0].emit('like', payload);
    h.connections[0].emit('follow', payload); h.connections[0].emit('follow', payload);
    assert.deepEqual(h.events().map(e => e.kind).sort(), ['follow', 'like']);
    assert.equal(h.events().find(e => e.kind === 'like').likeCount, 99);
    await connected(h, 2);
    h.connections[1].emit('like', payload);
    assert.equal(h.events().length, 0);
});

test('numeric IDs preserve native strings and reject unsafe or invented values', () => {
    assert.equal(numericId('987654321123456789'), '987654321123456789');
    assert.equal(numericId(5655n), '5655');
    for (const value of [Number.MAX_SAFE_INTEGER + 1, {}, 'Rose', '-1', 0, '', true]) assert.equal(numericId(value), '');
});

test('profile normalization supports native v1 and v2 image shapes', () => {
    const v1 = normalizeProfile({ user: { userId: '3', uniqueId: '@ALICE', nickname: 'Alice', profilePicture: { urls: [CDN] } } });
    assert.deepEqual(v1, { username: 'alice', senderId: '3', nickname: 'Alice', avatarUrls: [CDN] });
    const v2 = normalizeProfile({ user: { id: '4', displayId: 'bob', avatarLarge: { urlList: [CDN] } } });
    assert.equal(v2.username, 'bob');
    assert.equal(v2.senderId, '4');
    assert.deepEqual(v2.avatarUrls, [CDN]);
});

test('flat profiles use usernames and bound nicknames and avatar lists', () => {
    const profile = normalizeProfile({ uniqueId: 'viewer', nickname: 'a'.repeat(200), profilePictureUrls: Array(100).fill(CDN) });
    assert.equal(profile.nickname.length, 128);
    assert.ok(profile.avatarUrls.length <= 16);
    assert.equal(normalizeProfile({ nickname: 'not an identity' }).username, '');
});

test('terminal combos require a native repeat end marker', () => {
    for (const repeatEnd of [true, 1, '1', 'true']) assert.equal(terminalGift({ giftDetails: { giftType: 1 }, repeatEnd }), true);
    for (const repeatEnd of [false, 0, '0', undefined]) assert.equal(terminalGift({ giftType: 1, repeatEnd }), false);
    assert.equal(terminalGift({ repeatEnd: 0 }), false);
    assert.equal(normalizeGift(gift({ giftType: 1, repeatEnd: false }), 'epoch'), null);
});

test('gift event contract contains only native gift fields and an empty avatar file', () => {
    const result = normalizeGift(gift({ repeatCount: '5' }), 'epoch');
    assert.deepEqual(Object.keys(result.event).sort(), ['avatarFile', 'epoch', 'eventId', 'giftId', 'kind', 'nickname', 'repeatCount', 'username'].sort());
    assert.equal(result.event.giftId, '5655');
    assert.equal(result.event.repeatCount, 5);
    assert.equal(result.event.avatarFile, '');
    assert.equal(result.event.epoch, 'epoch');
});

test('gift IDs can come from real nested gift details but never names', () => {
    assert.equal(normalizeGift(gift({ giftId: 0, giftDetails: { id: '999' } }), 'e').event.giftId, '999');
    for (const patch of [{ giftId: undefined, giftName: 'Rose' }, { giftId: {} }, { common: {}, msgId: undefined }, { user: { nickname: 'viewer' } }]) {
        assert.equal(normalizeGift(gift(patch), 'e'), null);
    }
});

test('malformed repeat counts are rejected without clamping or inflating', () => {
    for (const repeatCount of [0, -1, 2.5, Infinity, true, 'bad', 2147483648]) assert.equal(normalizeGift(gift({ repeatCount }), 'e'), null);
    assert.equal(normalizeGift(gift({ repeatCount: undefined }), 'e').event.repeatCount, 1);
});

test('message ID dedupe is stable across epochs, renames, and repeat count changes', () => {
    const a = normalizeGift(gift(), 'first');
    const b = normalizeGift(gift({ repeatCount: 9, user: { userId: '123', uniqueId: 'newname', nickname: 'New label' } }), 'second');
    assert.equal(a.event.eventId, b.event.eventId);
    assert.notEqual(a.event.eventId, normalizeGift(gift({ common: { msgId: '10002' } }), 'first').event.eventId);
});

test('same display names and gifts do not collapse different senders or messages', () => {
    const a = normalizeGift(gift(), 'e');
    const b = normalizeGift(gift({ user: { userId: '124', uniqueId: 'other', nickname: 'Same display name' } }), 'e');
    assert.notEqual(a.event.eventId, b.event.eventId);
    assert.notEqual(a.event.eventId, normalizeGift(gift({ giftId: 999 }), 'e').event.eventId);
});

test('native combo group dedupe survives terminal message ID changes', t => {
    const owned = fixture(t);
    const journal = new DedupeJournal(path.join(owned.root, 'journal.json'));
    const a = normalizeGift(gift({ giftType: 1, repeatEnd: 1, groupId: '888' }), 'e', '1');
    const b = normalizeGift(gift({ giftType: 1, repeatEnd: 1, groupId: '888', common: { msgId: 'new' } }), 'e', '1');
    journal.remember(a.keys);
    assert.equal(journal.has(b.keys), true);
    assert.equal(journal.has(normalizeGift(gift({ groupId: '889', common: { msgId: 'other' } }), 'e', '1').keys), false);
    assert.equal(normalizeGift(gift({ groupId: '0' }), 'e').keys.length, 1);
});

test('dedupe journal persists and evicts only the oldest bounded records', t => {
    const owned = fixture(t);
    const file = path.join(owned.root, 'journal.json');
    let journal = new DedupeJournal(file, 2);
    const rows = [1, 2, 3].map(id => normalizeGift(gift({ common: { msgId: String(id) } }), 'e').keys);
    rows.forEach(keys => journal.remember(keys));
    journal = new DedupeJournal(file, 2);
    assert.equal(journal.entries.length, 2);
    assert.equal(journal.has(rows[0]), false);
    assert.equal(journal.has(rows[1]), true);
    assert.equal(journal.remember(rows[2]), false);
});

test('corrupt dedupe journal fails visibly rather than silently replaying', t => {
    const owned = fixture(t);
    const file = path.join(owned.root, 'journal.json');
    atomicWrite(file, { version: 1, entries: [['not-a-hash']] });
    assert.throws(() => new DedupeJournal(file), /invalid-journal/);
});

test('command replacement ignores boot and out-of-order seq and consumes only newer commands', () => {
    const cursor = new CommandCursor({ seq: 50, op: 'connect', username: 'stale' });
    assert.equal(cursor.take({ seq: 50, op: 'connect', username: 'stale' }), null);
    assert.equal(cursor.take({ seq: 49, op: 'connect', username: 'old' }), null);
    assert.deepEqual(cursor.take({ seq: 52, op: 'connect', username: '@NEW' }), { seq: 52, op: 'connect', username: 'new' });
    assert.equal(cursor.take({ seq: 51, op: 'disconnect', username: '' }), null);
});

test('invalid commands cannot reuse their sequence or turn into a connect', () => {
    const cursor = new CommandCursor();
    assert.equal(cursor.take({ seq: 1, op: 'execute', username: 'a' }).op, 'invalid');
    assert.equal(cursor.take({ seq: 1, op: 'connect', username: 'a' }), null);
    assert.equal(cursor.take({ seq: 1.5, op: 'connect', username: 'a' }), null);
    assert.equal(cursor.take({ seq: 2, op: 'disconnect' }).op, 'invalid');
});

test('atomic event files are independent, sortable, and contain no partial JSON', t => {
    const owned = fixture(t);
    const spool = new EventSpool(owned.root, 2000, () => 123);
    const first = spool.enqueue({ kind: 'gift', epoch: 'e', eventId: 'one' });
    const second = spool.enqueue({ kind: 'gift', epoch: 'e', eventId: 'two' });
    assert.ok(OWN_EVENT.test(first));
    assert.ok(first < second);
    assert.equal(optionalJson(path.join(owned.root, first)).eventId, 'one');
    assert.equal(optionalJson(path.join(owned.root, second)).eventId, 'two');
    assert.equal(fs.readdirSync(owned.root).length, 2);
});

test('stale event pruning touches only owned files and respects the current epoch', t => {
    const owned = fixture(t);
    const spool = new EventSpool(owned.root);
    const old = spool.enqueue({ kind: 'gift', epoch: 'old' });
    const current = spool.enqueue({ kind: 'avatar', epoch: 'current' });
    atomicWrite(path.join(owned.root, 'foreign.json'), { kind: 'gift', epoch: 'old' });
    spool.prune('current');
    assert.equal(fs.existsSync(path.join(owned.root, old)), false);
    assert.equal(fs.existsSync(path.join(owned.root, current)), true);
    assert.equal(fs.existsSync(path.join(owned.root, 'foreign.json')), true);
});

test('spool cap counts foreign JSON too and never deletes it to make space', t => {
    const owned = fixture(t);
    const spool = new EventSpool(owned.root, 2);
    atomicWrite(path.join(owned.root, 'foreign.json'), {});
    spool.enqueue({ kind: 'gift', epoch: 'e' });
    assert.throws(() => spool.enqueue({ kind: 'gift', epoch: 'e' }), { code: 'EVENT_OVERFLOW' });
    assert.equal(spool.count(), 2);
});

test('userdata junctions cannot redirect bridge writes outside the exact root', t => {
    const owned = fixture(t);
    const other = fixture(t);
    fs.symlinkSync(other.root, path.join(owned.root, 'userdata'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => layout(owned.root), /unsafe-directory/);
});

test('avatar allowlist rejects HTTP, credentials, ports, and hostname suffix tricks', () => {
    assert.equal(avatarUrl(CDN).href, CDN);
    for (const value of ['http://p16.tiktokcdn.com/a', 'https://evil-tiktokcdn.com/a', 'https://tiktokcdn.com.evil.com/a',
        'https://127.0.0.1/a', 'https://user:secret@p16.tiktokcdn.com/a', 'https://p16.tiktokcdn.com:8443/a']) assert.equal(avatarUrl(value), null);
});

test('avatar DNS validation excludes private, loopback, and mapped IPs', () => {
    for (const value of ['127.0.0.1', '10.0.0.1', '169.254.1.1', '172.16.0.1', '192.168.0.1', '100.64.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', '2001:db8::1']) assert.equal(publicAddress(value), false);
    assert.equal(publicAddress('8.8.8.8'), true);
    assert.equal(publicAddress('2606:4700:4700::1111'), true);
});

test('avatar downloader accepts actual raster bytes from an approved HTTPS host', async () => {
    const result = await downloadAvatar(CDN, { request: fakeRequest([{ bytes: PNG }]) });
    assert.equal(result.extension, 'png');
    assert.deepEqual(result.bytes, PNG);
});

test('each avatar redirect is validated before a second network request', async () => {
    const visits = [];
    await assert.rejects(downloadAvatar(CDN, { request: fakeRequest([{ status: 302, headers: { location: 'http://127.0.0.1/secret' } }], visits) }), /url-rejected/);
    assert.equal(visits.length, 1);
    const result = await downloadAvatar(CDN, { request: fakeRequest([{ status: 302, headers: { location: '/redirect.png' } }, { bytes: PNG }]) });
    assert.equal(result.extension, 'png');
});

test('avatar downloader enforces a 2 MiB streaming limit and rejects nonimages', async () => {
    await assert.rejects(downloadAvatar(CDN, { request: fakeRequest([{ chunks: [PNG, Buffer.alloc(MAX_BYTES)] }]) }), /too-large/);
    await assert.rejects(downloadAvatar(CDN, { request: fakeRequest([{ bytes: Buffer.from('<svg/>') }]) }), /format-rejected/);
    await assert.rejects(downloadAvatar(CDN, { request: fakeRequest([{ headers: { 'content-type': 'image/png', 'content-length': String(MAX_BYTES + 1) } }]) }), /response-rejected/);
});

test('gift enqueue does not wait for avatar download; avatar is a separate native event', async t => {
    let resolveImage;
    const h = harness(t, { avatarOptions: { download: () => new Promise(resolve => { resolveImage = resolve; }), convert: async image => image } });
    await connected(h);
    const epoch = h.bridge.status().epoch;
    h.connections[0].emit('gift', gift({ user: { userId: '123', uniqueId: 'viewer', avatarThumb: { urlList: [CDN] } } }));
    assert.equal(h.events().length, 1);
    assert.equal(h.events()[0].kind, 'gift');
    assert.equal(h.events()[0].avatarFile, '');
    resolveImage({ bytes: PNG, extension: 'png' });
    await settle();
    const avatar = h.events().find(event => event.kind === 'avatar');
    assert.equal(avatar.epoch, epoch);
    assert.ok(path.isAbsolute(avatar.avatarFile));
    assert.ok(avatar.avatarFile.startsWith(h.bridge.paths.avatars + path.sep));
    assert.deepEqual(fs.readFileSync(avatar.avatarFile), PNG);
});

test('late avatar from a replaced channel cannot acquire or emit the new epoch', async t => {
    let resolveImage;
    const h = harness(t, { avatarOptions: { download: () => new Promise(resolve => { resolveImage = resolve; }), convert: async image => image } });
    await connected(h);
    const oldEpoch = h.bridge.status().epoch;
    h.connections[0].emit('gift', gift({ user: { userId: '123', uniqueId: 'viewer', profilePicture: { urls: [CDN] } } }));
    await connected(h, 2, 'second');
    assert.notEqual(h.bridge.status().epoch, oldEpoch);
    resolveImage({ bytes: PNG, extension: 'png' });
    await settle();
    assert.deepEqual(h.events(), []);
});

test('avatar queue and on-disk cache are bounded without deleting foreign files', async t => {
    const owned = fixture(t);
    let resolveImage;
    const issues = [];
    const cache = new AvatarCache(owned.root, { maxQueue: 1, maxFiles: 1,
        onIssue: reason => issues.push(reason), download: () => new Promise(resolve => { resolveImage = resolve; }), convert: async image => image });
    owned.cleanup(() => cache.close());
    atomicWrite(path.join(owned.root, 'foreign.json'), {});
    cache.request({ username: 'one', avatarUrls: [CDN] }, 'e');
    cache.request({ username: 'two', avatarUrls: [CDN] }, 'e');
    assert.deepEqual(issues, ['avatar-overflow']);
    assert.equal(cache.pending.size, 1);
    resolveImage({ bytes: PNG, extension: 'png' });
    await settle();
    assert.equal(cache.files().length, 1);
    cache.trim(PNG.length, 1);
    assert.equal(cache.files().length, 0);
    assert.equal(fs.existsSync(path.join(owned.root, 'foreign.json')), true);
});

test('bridge startup ignores an existing command and publishes the exact ready contract', async t => {
    const owned = fixture(t);
    const paths = layout(owned.root);
    atomicWrite(paths.command, { seq: 5, op: 'connect', username: 'stale' });
    let calls = 0;
    const bridge = createBridge({ root: owned.root, createConnection: () => { calls++; return new FakeConnection(); }, log: () => {} });
    owned.cleanup(() => bridge.close());
    bridge.tick();
    assert.equal(calls, 0);
    assert.deepEqual(Object.keys(optionalJson(paths.status)).sort(), ['status', 'reason', 'message', 'username', 'roomId', 'epoch', 'lastEventAt', 'received', 'giftEvents', 'likeEvents', 'followEvents'].sort());
    atomicWrite(paths.command, { seq: 6, op: 'connect', username: 'fresh' });
    bridge.tick();
    await settle();
    assert.equal(calls, 1);
    assert.equal(bridge.status().username, 'fresh');
});

test('explicit disconnect rotates epoch, prunes old owned events, and retires the connection', async t => {
    const h = harness(t);
    await connected(h);
    h.connections[0].emit('gift', gift());
    const epoch = h.bridge.status().epoch;
    h.bridge.command({ seq: 2, op: 'disconnect', username: '' });
    assert.notEqual(h.bridge.status().epoch, epoch);
    assert.equal(h.bridge.status().status, 'disconnected');
    assert.ok(h.connections[0].disconnections > 0);
    assert.deepEqual(h.events(), []);
});

test('automatic reconnect preserves epoch and suppresses already delivered gifts and combos', async t => {
    const timers = new FakeTimers();
    const h = harness(t, { now: () => timers.time, sessionOptions: { timers, clock: { now: () => timers.time }, random: () => 0.5 } });
    await connected(h);
    const epoch = h.bridge.status().epoch;
    h.connections[0].emit('gift', gift({ giftType: 1, repeatEnd: 1, groupId: 'combo' }));
    h.connections[0].emit('disconnected');
    await timers.advance(2000);
    assert.equal(h.connections.length, 2);
    assert.equal(h.bridge.status().status, 'connected');
    assert.equal(h.bridge.status().epoch, epoch);
    h.connections[1].emit('gift', gift({ giftType: 1, repeatEnd: 1, groupId: 'combo', common: { msgId: 'another-terminal' } }));
    h.connections[1].emit('gift', gift());
    assert.equal(h.events().length, 1);
    assert.equal(h.bridge.status().giftEvents, 1);
});

test('persisted dedupe prevents replay after sidecar restart', async t => {
    const h = harness(t);
    await connected(h);
    h.connections[0].emit('gift', gift());
    await h.bridge.close();
    const connection = new FakeConnection();
    const next = createBridge({ root: h.root, createConnection: async () => connection, log: () => {} });
    h.cleanup(() => next.close());
    next.command({ seq: 2, op: 'connect', username: 'first' });
    await settle();
    connection.emit('gift', gift());
    assert.equal(next.status().giftEvents, 0);
    assert.deepEqual(fs.readdirSync(next.paths.events), []);
});

test('overflow stops the stream with an explicit status and preserves the bound', async t => {
    const h = harness(t, { eventLimit: 1 });
    await connected(h);
    h.connections[0].emit('gift', gift());
    h.connections[0].emit('gift', gift({ common: { msgId: 'new' } }));
    assert.equal(h.bridge.status().reason, 'overflow');
    assert.equal(h.bridge.status().status, 'error');
    assert.equal(h.bridge.status().giftEvents, 1);
    assert.equal(h.events().length, 1);
    assert.ok(h.logs.some(line => line.includes('not queued')));
    assert.ok(h.connections[0].disconnections > 0);
});

test('replacement cancels a pending connection and ignores its late result and gifts', async t => {
    let resolveFirst;
    const connections = [new FakeConnection(() => new Promise(resolve => { resolveFirst = resolve; })), new FakeConnection()];
    let index = 0;
    const h = harness(t, { createConnection: async () => connections[index++] });
    h.bridge.command({ seq: 1, op: 'connect', username: 'first' });
    await settle();
    await connected(h, 2, 'second');
    resolveFirst({ roomId: '111' });
    await settle();
    connections[0].emit('gift', gift());
    assert.equal(h.bridge.status().username, 'second');
    assert.equal(h.bridge.status().roomId, '987654321123456789');
    assert.deepEqual(h.events(), []);
    assert.ok(connections[0].disconnections >= 2);
});

test('the proven helper enforces connect timeout and retries without rotating epoch', async t => {
    const timers = new FakeTimers();
    const connection = new FakeConnection(() => new Promise(() => {}));
    const h = harness(t, { createConnection: async () => connection, now: () => timers.time,
        sessionOptions: { timers, clock: { now: () => timers.time }, random: () => 0.5 } });
    h.bridge.command({ seq: 1, op: 'connect', username: 'first' });
    await settle();
    const epoch = h.bridge.status().epoch;
    await timers.advance(25000);
    assert.equal(h.bridge.status().reason, 'timeout');
    assert.equal(h.bridge.status().epoch, epoch);
    assert.ok(connection.disconnections > 0);
});

test('health checks keep silent connected rooms and detect actual transport loss', async t => {
    const timers = new FakeTimers();
    const h = harness(t, { sessionOptions: { timers, clock: { now: () => timers.time }, random: () => 0.5 } });
    await connected(h);
    await timers.advance(10000);
    assert.equal(h.bridge.status().status, 'connected');
    h.connections[0].isConnected = false;
    await timers.advance(10000);
    assert.equal(h.bridge.status().reason, 'disconnected');
    assert.equal(h.bridge.status().status, 'error');
});

test('parent death gracefully disconnects, cancels polling, and releases only its own lock', async t => {
    let alive = true;
    const h = harness(t, { parentPid: 123, isParentAlive: () => alive });
    await connected(h);
    alive = false;
    h.bridge.tick();
    await h.bridge.done;
    assert.equal(h.bridge.closed, true);
    assert.equal(h.bridge.status().reason, 'parent-dead');
    assert.equal(fs.existsSync(h.bridge.paths.lock), false);
    assert.ok(h.connections[0].disconnections > 0);
});

test('a second bridge cannot write into a root owned by a running sidecar', t => {
    const h = harness(t);
    assert.throws(() => createBridge({ root: h.root, createConnection: async () => new FakeConnection() }), /already-running/);
});

test('argument parsing accepts the Unity launch contract and rejects invalid PIDs', () => {
    assert.deepEqual(parseArgs(['--root', base, '--parent-pid', '456']), { root: base, parentPid: 456 });
    for (const args of [['--parent-pid', '0'], ['--parent-pid', '-1'], ['--parent-pid', 'abc'], ['--root'], ['--other', 'x']]) assert.throws(() => parseArgs(args));
});

test('optional credentials prefer environment and never become part of IPC status', t => {
    const owned = fixture(t);
    const keyFile = path.join(owned.root, 'private-key.txt');
    fs.writeFileSync(keyFile, 'fixture-key-not-real');
    assert.equal(readApiKey({ EULER_API_KEY: ' env-key-not-real ' }, keyFile), 'env-key-not-real');
    assert.equal(readApiKey({}, keyFile), 'fixture-key-not-real');
    assert.equal(readApiKey({}, path.join(owned.root, 'missing')), '');
});

test('actual installed SDK loads at pinned 2.4.4 and disables initial-data replay', async () => {
    const sdk = await loadSdk({});
    assert.equal(typeof sdk.TikTokLiveConnection, 'function');
    assert.equal(require('../bridge/node_modules/tiktok-live-connector/package.json').version, '2.4.4');
    const factory = createSdkFactory({ env: {}, keyFile: path.join(base, 'nonexistent-test-key') });
    const connection = await factory.createConnection('test_account_no_network');
    assert.equal(connection.options.processInitialData, false);
    assert.equal(connection.options.enableExtendedGiftInfo, false);
    await factory.close();
});

test('actual pinned Sharp converts WebP into a Unity-readable bounded PNG', async () => {
    const sharp = require('../bridge/node_modules/sharp');
    assert.equal(require('../bridge/node_modules/sharp/package.json').version, '0.34.5');
    const webp = await sharp({ create: { width: 512, height: 384, channels: 3, background: '#24a78d' } }).webp().toBuffer();
    assert.equal((await sharp(webp).metadata()).format, 'webp');
    const image = await convertAvatar({ bytes: webp, extension: 'webp' });
    const metadata = await sharp(image.bytes).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 256);
    assert.equal(metadata.height, 256);
    assert.equal(image.extension, 'png');
    assert.ok(image.bytes.length <= MAX_BYTES);
});

test('actual Sharp converter enforces compressed-byte and decoded-pixel limits', async () => {
    const sharp = require('../bridge/node_modules/sharp');
    const large = await sharp({ create: { width: 4097, height: 4097, channels: 3, background: '#123456' } }).png().toBuffer();
    assert.ok(large.length < MAX_BYTES);
    await assert.rejects(convertAvatar({ bytes: large, extension: 'png' }), /pixel limit/i);
    await assert.rejects(convertAvatar({ bytes: Buffer.alloc(MAX_BYTES + 1), extension: 'png' }), /input-rejected/);
});

test('old-channel conversion completion cannot publish an avatar in the new epoch', async t => {
    let resolveConversion;
    const h = harness(t, { avatarOptions: { download: async () => ({ bytes: PNG, extension: 'png' }),
        convert: () => new Promise(resolve => { resolveConversion = resolve; }) } });
    await connected(h);
    h.connections[0].emit('gift', gift({ user: { userId: '123', uniqueId: 'viewer', profilePicture: { urls: [CDN] } } }));
    await settle();
    assert.equal(typeof resolveConversion, 'function');
    await connected(h, 2, 'second');
    resolveConversion({ bytes: PNG, extension: 'png' });
    await settle();
    assert.deepEqual(h.events(), []);
});

test('CLI sidecar ignores stale boot command and exits after a newer IPC shutdown', async t => {
    const owned = fixture(t);
    const paths = layout(owned.root);
    atomicWrite(paths.command, { seq: 8, op: 'connect', username: 'must_not_connect' });
    const child = spawn(process.execPath, [path.join(base, 'index.cjs'), '--root', owned.root, '--parent-pid', String(process.pid)],
        { windowsHide: true, stdio: 'ignore' });
    owned.cleanup(() => { if (child.exitCode === null) child.kill(); });
    const exit = once(child, 'exit');
    const deadline = Date.now() + 5000;
    while (!fs.existsSync(paths.status) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(optionalJson(paths.status).status, 'disconnected');
    atomicWrite(paths.command, { seq: 9, op: 'shutdown', username: '' });
    const [code] = await Promise.race([exit, new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('sidecar-exit-timeout')), 5000);
        timer.unref();
    })]);
    assert.equal(code, 0);
    assert.equal(optionalJson(paths.status).reason, 'shutdown');
    assert.equal(fs.existsSync(paths.lock), false);
});
