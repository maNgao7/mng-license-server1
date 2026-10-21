'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { createMediaStudio } = require('../lib/media-studio.cjs');

const KEY = '0123456789abcdef0123456789abcdef';
const BASE = '/tikmng/media';
const options = { timeout: 10000 };

function fixture(t, { disk = false, activeGame = '' } = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'media-studio-test-'));
    const root = path.join(directory, 'library');
    const config = path.join(directory, 'config.json');
    let data = {};
    let channel = 'alice';
    const notifications = [];
    const store = {
        get(key, fallback) {
            if (disk && fs.existsSync(config)) data = JSON.parse(fs.readFileSync(config, 'utf8'));
            return structuredClone(data[key] ?? fallback);
        },
        set(key, value) {
            data[key] = structuredClone(value);
            if (disk) fs.writeFileSync(config, JSON.stringify(data));
        }
    };
    const services = [];
    const make = (extra = {}) => {
        const service = createMediaStudio({ store, root, accessKey: KEY, getChannel: () => channel, getActiveGame: () => activeGame,
            onEvent: event => notifications.push(event), ...extra });
        services.push(service);
        return service;
    };
    t.after(() => {
        services.forEach(service => service.close());
        assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    const studio = make();
    return { studio, make, store, root, directory, config, notifications,
        setChannel(value) { channel = value; },
        setActiveGame(value) { activeGame = value; },
        source(name = 'clip.mp4', content = '0123456789') {
            const source = path.join(directory, name);
            fs.writeFileSync(source, content);
            return source;
        }
    };
}

async function mapped(f, settings = {}, source) {
    const [item] = await f.studio.importFiles([source || f.source()]);
    return f.studio.save({ id: item.id, giftId: '5655', ...settings });
}

async function startServer(t, studio) {
    const server = http.createServer((req, res) => {
        if (!studio.handleRequest(req, res, new URL(req.url, 'http://127.0.0.1'))) {
            res.writeHead(404);
            res.end('Not found');
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => {
        studio.close();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    });
    return `http://127.0.0.1:${server.address().port}`;
}

function request(base, route, { key = KEY, channel = 'alice', headers = {}, method = 'GET' } = {}) {
    const url = new URL(route, base);
    if (key !== null) url.searchParams.set('key', key);
    if (channel !== null) url.searchParams.set('channel', channel);
    return new Promise((resolve, reject) => {
        const req = http.request(url, { headers, method }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.once('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
            res.once('error', reject);
        });
        req.once('error', reject);
        req.setTimeout(3000, () => req.destroy(new Error('Request timed out')));
        req.end();
    });
}

function fakeRequest(studio, route, { channel = 'alice', key = KEY, backpressure = false, headers = {} } = {}) {
    const res = new EventEmitter();
    res.headers = {};
    res.frames = [];
    res.setHeader = (name, value) => { res.headers[name.toLowerCase()] = value; };
    res.writeHead = (status, headers) => { res.status = status; Object.entries(headers || {}).forEach(([name, value]) => res.setHeader(name, value)); };
    res.end = body => { res.body = body; res.writableEnded = true; res.emit('close'); };
    res.destroy = () => { res.destroyed = true; res.emit('close'); };
    res.write = frame => { res.frames.push(frame); return !backpressure; };
    const url = new URL(route, 'http://127.0.0.1');
    url.searchParams.set('key', key);
    url.searchParams.set('channel', channel);
    const handled = studio.handleRequest({ method: 'GET', headers, socket: { setTimeout() {} } }, res, url);
    return { handled, res, events: () => res.frames.filter(frame => frame.startsWith('event:')).map(frame => JSON.parse(frame.split('\ndata: ')[1])) };
}

test('imports copy all supported types, preserve sources and redact paths', options, async t => {
    const f = fixture(t);
    const paths = ['clip.MP4', 'movie.webm', 'sound.mp3', 'tone.wav', 'music.ogg'].map(name => f.source(name));
    const imported = await f.studio.importFiles(paths);
    assert.equal(imported.length, 5);
    assert.equal(new Set(imported.map(item => item.id)).size, 5);
    for (const [index, item] of imported.entries()) {
        assert.match(item.id, /^[a-f0-9-]{36}$/);
        assert.equal(item.filename, path.basename(paths[index]));
        assert.equal(item.bytes, 10);
        assert.equal(item.configured, false);
        assert.equal(item.likeThreshold, 100);
        assert.equal(item.kind, index < 2 ? 'video' : 'audio');
        assert.equal(fs.readFileSync(paths[index], 'utf8'), '0123456789');
        const copied = path.join(f.root, item.id + path.extname(paths[index]).toLowerCase());
        assert.equal(fs.readFileSync(copied, 'utf8'), '0123456789');
        assert.equal(item.url, '');
        assert.equal(item.remote, false);
        assert.equal(new URL(item.previewUrl, 'http://localhost').pathname, `${BASE}/${item.id}`);
        assert.equal(new URL(item.mediaUrl, 'http://localhost').pathname, `${BASE}/file/${item.id}`);
    }
    const json = JSON.stringify(f.studio.list());
    assert.ok(!json.includes(f.directory));
    assert.ok(!json.includes('sourcePath'));
    assert.ok(!Object.hasOwn(imported[0], 'file'));
    const [second] = await f.studio.importFiles([paths[0]]);
    assert.notEqual(second.id, imported[0].id);
    assert.equal(f.studio.list().length, 6);
});

test('rejects invalid imports before copying and rolls back on persistence failure', options, async t => {
    const f = fixture(t);
    const valid = f.source();
    await assert.rejects(f.studio.importFiles([valid, f.source('secret.txt')]), /Unsupported/);
    assert.equal(f.studio.list().length, 0);
    await assert.rejects(f.studio.importFiles(['relative.mp4']), /Absolute/);
    await assert.rejects(f.studio.importFiles([f.directory]), /Unsupported/);
    await assert.rejects(f.studio.importFiles([]), /batch/);
    const bad = f.make({ store: { get: (_, fallback) => fallback, set() { throw new Error('disk full'); } } });
    await assert.rejects(bad.importFiles([valid]), /disk full/);
    assert.deepEqual(fs.readdirSync(f.root), []);
    assert.equal(fs.readFileSync(valid, 'utf8'), '0123456789');
});

test('validates editable settings, retains UUID/file ownership and removes only configuration', options, async t => {
    const f = fixture(t);
    const source = f.source();
    const item = await mapped(f, {}, source);
    for (const change of [
        { id: '../clip' }, { title: '' }, { title: 'x'.repeat(161) }, { category: 'bad\ntext' },
        { giftId: 'Rose' }, { giftId: 1.2 }, { giftId: Number.MAX_SAFE_INTEGER + 1 }, { giftId: {} },
        { volume: 1.01 }, { volume: -1 }, { volume: '0.5' }, { volume: NaN },
        { startSeconds: -1 }, { startSeconds: Infinity }, { endSeconds: 0 }, { startSeconds: 5, endSeconds: 4 },
        { cooldownSeconds: -1 }, { enabled: 1 }, { trigger: 'chat' }, { likeThreshold: 0 }, { likeThreshold: 1.5 }
    ]) assert.throws(() => f.studio.save({ id: item.id, ...change }));
    const saved = f.studio.save({ ...item, title: 'New title', category: 'Effects', giftId: 5655,
        startSeconds: 1, endSeconds: 3, volume: 0.4, cooldownSeconds: 2, file: source, channel: 'bob' });
    assert.equal(saved.id, item.id);
    assert.equal(saved.channel, 'alice');
    assert.equal(saved.giftId, '5655');
    assert.equal(saved.volume, 0.4);
    assert.equal(saved.configured, true);
    assert.equal(f.studio.remove(item.id), true);
    assert.equal(f.studio.list().length, 0);
    assert.ok(fs.existsSync(source));
    assert.ok(fs.existsSync(path.join(f.root, `${item.id}.mp4`)));
    assert.throws(() => f.studio.test(item.id), /Unknown/);
});

test('gift matching uses exact normalized ID regardless of name and independent mappings', options, async t => {
    const f = fixture(t);
    const a = await mapped(f, { cooldownSeconds: 20 });
    const b = await mapped(f);
    await mapped(f, { giftId: '56550' });
    assert.equal(f.studio.ingest('gift', { giftId: '565', giftName: 'Rose', eventId: 'wrong' }).length, 0);
    const first = f.studio.ingest('gift', { giftId: 5655, giftName: 'Renamed', eventId: 'a' });
    assert.deepEqual(first.map(event => event.item.id), [a.id, b.id]);
    assert.equal(f.studio.ingest('gift', { gift: { id: '05655', name: 'Another name' }, eventId: 'b' }).length, 1);
    assert.equal(f.studio.ingest('gift', { giftName: 'Rose', eventId: 'name-only' }).length, 0);
    assert.equal(f.studio.ingest('gift', { giftId: '5655bad', eventId: 'invalid' }).length, 0);
    assert.equal(first[0].trigger.giftId, '5655');
});

test('streak progress does not consume final event ID; raw nonstreak and normalized parent payloads work', options, async t => {
    const f = fixture(t);
    await mapped(f);
    for (const repeatEnd of [false, 0, '0', 'false', undefined]) {
        assert.equal(f.studio.ingest('gift', { giftId: '5655', giftType: 1, repeatEnd, msgId: 'streak' }).length, 0);
    }
    const final = f.studio.ingest('gift', { giftId: '5655', giftType: 1, repeatEnd: true, repeatCount: 9, msgId: 'streak' });
    assert.equal(final.length, 1);
    assert.equal(final[0].trigger.count, 9);
    assert.equal(f.studio.ingest('gift', { giftId: '5655', giftType: 1, repeatEnd: true, msgId: 'streak' }).length, 0);
    assert.equal(f.studio.ingest('gift', { extendedGiftInfo: { id: 5655, type: 1 }, repeatEnd: '1', logId: 'nested' }).length, 1);
    assert.equal(f.studio.ingest('gift', { giftId: '5655', giftType: 0, repeatEnd: false, id: 'normal' }).length, 1);
    assert.equal(f.studio.ingest('gift', { giftId: '5655', count: 4, eventId: 'parent' }).length, 1);
});

test('like threshold is exact, retains remainder and supports per-mapping thresholds', options, async t => {
    const f = fixture(t);
    const a = await mapped(f, { trigger: 'like' });
    const b = await mapped(f, { trigger: 'like', likeThreshold: 250 });
    assert.equal(f.studio.ingest('like', { likeCount: 99, eventId: 'a' }).length, 0);
    assert.deepEqual(f.studio.ingest('like', { likeCount: 1, eventId: 'b' }).map(event => event.item.id), [a.id]);
    const burst = f.studio.ingest('like', { likeCount: 250, eventId: 'c' });
    assert.deepEqual(burst.map(event => event.item.id), [a.id, a.id, b.id]);
    assert.equal(f.studio.ingest('like', { likeCount: 250, eventId: 'c' }).length, 0);
    assert.equal(f.studio.ingest('like', { count: 49, eventId: 'd' }).length, 0);
    assert.equal(f.studio.ingest('like', { count: 1, eventId: 'e' }).length, 1);
    assert.equal(f.studio.ingest('like', { count: 0, eventId: 'invalid' }).length, 0);
    f.studio.save({ id: a.id, enabled: false });
    assert.equal(f.studio.ingest('like', { count: 100, eventId: 'f' }).length, 1);
});

test('huge like batches produce bounded work, consume exact remainder and cooldowns are independent', options, async t => {
    const f = fixture(t);
    const a = await mapped(f, { trigger: 'like' });
    assert.equal(f.studio.ingest('like', { count: 1000000050, eventId: 'huge' }).length, 100);
    assert.equal(f.studio.ingest('like', { count: 49, eventId: 'small' }).length, 0);
    assert.equal(f.studio.ingest('like', { count: 1, eventId: 'exact' }).length, 1);
    f.studio.save({ id: a.id, cooldownSeconds: 10 });
    const b = await mapped(f, { trigger: 'like', cooldownSeconds: 10 });
    assert.deepEqual(f.studio.ingest('like', { count: 300, eventId: 'cooldown' }).map(event => event.item.id), [b.id]);
    assert.equal(f.studio.ingest('like', { count: 100, eventId: 'blocked' }).length, 0);
});

test('configuration survives service restart without replaying events or storing absolute paths', options, async t => {
    const f = fixture(t, { disk: true });
    const item = await mapped(f, { title: 'Persisted', volume: 0.2, startSeconds: 2, endSeconds: 4 });
    f.studio.ingest('gift', { giftId: '5655', eventId: 'old' });
    f.studio.close();
    const restartedEvents = [];
    const restarted = f.make({ onEvent: event => restartedEvents.push(event) });
    assert.deepEqual(restarted.list(), [item]);
    assert.deepEqual(restartedEvents, []);
    const serialized = fs.readFileSync(f.config, 'utf8');
    assert.ok(!serialized.includes(f.directory));
    assert.ok(!serialized.includes(KEY));
    const client = fakeRequest(restarted, `${BASE}/events`);
    assert.equal(client.events().length, 0);
    restarted.test(item.id);
    assert.equal(client.events().length, 1);
});

test('channels isolate list, mutation, dedupe, thresholds, cooldowns, SSE and explicit ingest', options, async t => {
    const f = fixture(t);
    const alice = await mapped(f);
    f.setChannel('@BOB');
    assert.deepEqual(f.studio.list(), []);
    assert.throws(() => f.studio.save({ id: alice.id, title: 'No' }), /Unknown/);
    assert.throws(() => f.studio.remove(alice.id), /Unknown/);
    assert.throws(() => f.studio.test(alice.id), /Unknown/);
    const bob = await mapped(f, { trigger: 'like' });
    const bobGift = await mapped(f);
    const ac = fakeRequest(f.studio, `${BASE}/events`, { channel: 'alice' });
    const bc = fakeRequest(f.studio, `${BASE}/events`, { channel: 'bob' });
    const one = fakeRequest(f.studio, `${BASE}/events?item=${alice.id}`, { channel: 'alice' });
    assert.equal(f.studio.ingest('gift', { giftId: '5655', eventId: 'same' }, 'alice')[0].item.id, alice.id);
    assert.equal(f.studio.ingest('gift', { giftId: '5655', eventId: 'same' }, 'bob')[0].item.id, bobGift.id);
    assert.equal(ac.events().length, 1);
    assert.equal(bc.events().length, 1);
    assert.equal(one.events().length, 1);
    assert.equal(f.studio.ingest('like', { count: 99 }, 'alice').length, 0);
    assert.equal(f.studio.ingest('like', { count: 1 }, 'bob').length, 0);
    assert.equal(f.studio.ingest('like', { count: 99 }, 'bob')[0].item.id, bob.id);
    assert.equal(ac.events().length, 1);
    assert.equal(bc.events().length, 2);
});

test('parent notifications can subscribe/unsubscribe, are isolated, and tests bypass mapping state', options, async t => {
    const f = fixture(t);
    const item = await mapped(f, { enabled: false, giftId: '' });
    let calls = 0;
    const stop = f.studio.addListener(event => { calls++; event.item.title = 'mutated'; });
    f.studio.addListener(() => { throw new Error('renderer gone'); });
    f.studio.addListener(async () => { throw new Error('async renderer gone'); });
    const result = f.studio.test(item.id);
    assert.equal(calls, 1);
    assert.equal(result.test, true);
    assert.equal(result.type, 'studio:play');
    assert.equal(result.item.title, item.title);
    assert.equal(f.notifications[0].item.title, item.title);
    stop();
    f.studio.test(item.id);
    assert.equal(calls, 1);
    assert.equal(f.studio.ingest('gift', { giftId: '5655' }).length, 0);
    const follow = f.studio.save({ id: item.id, enabled: true, trigger: 'follow' });
    assert.equal(f.studio.ingest('follow', { eventId: 'follow', username: 'viewer' })[0].item.id, follow.id);
    assert.equal(f.studio.ingest('follow', { eventId: 'follow' }).length, 0);
    const notified = f.studio.ingest('follow', { eventId: 'private', username: 'private-user', nickname: 'private-name',
        avatar: 'https://private.invalid/avatar', user: { uniqueId: 'private-user' } });
    assert.ok(!JSON.stringify(notified).includes('private-user'));
    assert.ok(!JSON.stringify(notified).includes('private-name'));
    assert.ok(!JSON.stringify(notified).includes('avatar'));
});

test('HTTPS catalog items save without download, preserve links and redirect only after key/channel validation', options, async t => {
    const f = fixture(t, { disk: true });
    const url = 'https://catalog.example/video.mp4?token=abc';
    const item = await f.studio.save({ title: 'Catalog video', category: 'Catalog', url, giftId: 5655 });
    assert.equal(item.remote, true);
    assert.equal(item.url, url);
    assert.equal(item.kind, 'video');
    assert.equal(item.mime, 'video/mp4');
    assert.equal(item.bytes, null);
    assert.equal(fs.existsSync(f.root), false);
    const updated = await f.studio.save({ ...item, title: 'Updated', url: 'https://catalog.example/new.webm' });
    assert.equal(updated.id, item.id);
    assert.equal(updated.previewUrl, item.previewUrl);
    assert.equal(updated.mediaUrl, item.mediaUrl);
    const audio = f.studio.save({ title: 'Remote audio', url: 'https://catalog.example/stream?id=1', kind: 'audio' });
    assert.equal(audio.kind, 'audio');
    const extensionless = f.studio.save({ title: 'Remote stream', url: 'https://catalog.example/stream?id=2' });
    assert.equal(extensionless.kind, 'video');
    for (const url of ['http://catalog.example/clip.mp4', 'file:///C:/secret.mp4', 'javascript:alert(1)',
        'https://user:password@catalog.example/clip.mp4', '//catalog.example/clip.mp4', 'https://catalog.example/clip.mp4\n']) {
        assert.throws(() => f.studio.save({ title: 'Unsafe', url }), /HTTPS/);
    }
    assert.throws(() => f.studio.save({ title: 'No source' }), /HTTPS/);
    assert.throws(() => f.studio.save({ title: 'Kind mismatch', url: 'https://catalog.example/sound.wav', kind: 'video' }), /kind/);
    f.studio.close();
    const restarted = f.make();
    assert.deepEqual(restarted.list(), [updated, audio, extensionless]);
    const base = await startServer(t, restarted);
    const route = `${BASE}/file/${item.id}`;
    assert.equal((await request(base, route, { key: 'bad' })).status, 403);
    assert.equal((await request(base, route, { channel: 'bob' })).status, 404);
    const response = await request(base, route, { headers: { Range: 'bytes=2-5' } });
    assert.equal(response.status, 307);
    assert.equal(response.headers.location, updated.url);
    assert.equal(response.headers['referrer-policy'], 'no-referrer');
    assert.equal((await request(base, route, { method: 'HEAD' })).status, 307);
    const overlay = await request(base, `${BASE}/${item.id}`);
    assert.match(overlay.headers['content-security-policy'], /media-src 'self' https:/);
    assert.equal(fs.existsSync(f.root), false);
    restarted.remove(item.id);
    assert.equal((await request(base, route)).status, 404);
});

test('HTTP protects every route and asset, serves overlays, isolates channels and denies traversal', options, async t => {
    const f = fixture(t);
    const item = await mapped(f);
    const base = await startServer(t, f.studio);
    for (const route of [BASE, `${BASE}/${item.id}`, `${BASE}/events`, `${BASE}/file/${item.id}`, `${BASE}/client.js`, `${BASE}/client.css`]) {
        for (const key of [null, 'bad', 'x'.repeat(KEY.length), '\u0131'.repeat(KEY.length)]) {
            assert.equal((await request(base, route, { key })).status, 403, route);
        }
    }
    for (const route of [BASE, `${BASE}/${item.id}`]) {
        const response = await request(base, route);
        assert.equal(response.status, 200);
        assert.match(response.body, /id="stage"/);
        assert.ok(!response.body.includes('{{'));
        assert.match(response.body, /key=0123456789abcdef0123456789abcdef&amp;channel=alice/);
        assert.match(response.headers['content-security-policy'], /default-src 'none'/);
        assert.ok(!response.body.includes(f.directory));
    }
    assert.equal((await request(base, `${BASE}/client.js`)).headers['content-type'], 'text/javascript; charset=utf-8');
    assert.equal((await request(base, `${BASE}/client.css`)).status, 200);
    assert.equal((await request(base, BASE, { method: 'POST' })).status, 405);
    assert.equal((await request(base, BASE, { method: 'HEAD' })).body, '');
    for (const route of [`${BASE}/${item.id}`, `${BASE}/file/${item.id}`, `${BASE}/events?item=${item.id}`]) {
        assert.equal((await request(base, route, { channel: 'bob' })).status, 404);
    }
    for (const suffix of ['%2e%2e%2fconfig.json', '..%5cconfig.json', item.id + '%2f..%2fconfig.json', 'config.json', item.id + '/extra']) {
        const response = await request(base, `${BASE}/file/${suffix}`);
        assert.equal(response.status, 404);
        assert.ok(!response.body.includes(KEY));
    }
    assert.equal(fakeRequest(f.studio, '/unrelated').handled, false);
    const filtered = fakeRequest(f.studio, `${BASE}/events?item=${item.id}`);
    const another = await mapped(f);
    f.studio.test(another.id);
    assert.equal(filtered.events().length, 0);
});

test('streaming supports byte ranges, suffix/open ranges, HEAD, MIME and clean errors', options, async t => {
    const f = fixture(t);
    const item = await mapped(f);
    const base = await startServer(t, f.studio);
    const route = `${BASE}/file/${item.id}`;
    const full = await request(base, route);
    assert.equal(full.status, 200);
    assert.equal(full.body, '0123456789');
    assert.equal(full.headers['content-type'], 'video/mp4');
    assert.equal(full.headers['accept-ranges'], 'bytes');
    for (const [range, body, contentRange] of [
        ['bytes=2-5', '2345', 'bytes 2-5/10'], ['bytes=8-', '89', 'bytes 8-9/10'],
        ['bytes=-3', '789', 'bytes 7-9/10'], ['bytes=0-999', '0123456789', 'bytes 0-9/10'],
        ['bytes=-20', '0123456789', 'bytes 0-9/10']
    ]) {
        const response = await request(base, route, { headers: { Range: range } });
        assert.equal(response.status, 206);
        assert.equal(response.body, body);
        assert.equal(response.headers['content-range'], contentRange);
        assert.equal(Number(response.headers['content-length']), body.length);
    }
    for (const range of ['bytes=10-', 'bytes=3-2', 'bytes=-0', 'bytes=-', 'bytes=0-1,3-4', 'items=0-2', 'bytes=9007199254740992-']) {
        const response = await request(base, route, { headers: { Range: range } });
        assert.equal(response.status, 416, range);
        assert.equal(response.headers['content-range'], 'bytes */10');
    }
    const head = await request(base, route, { method: 'HEAD', headers: { Range: 'bytes=1-3' } });
    assert.equal(head.status, 206);
    assert.equal(head.body, '');
    assert.equal(head.headers['content-length'], '3');
    const empty = await mapped(f, {}, f.source('empty.mp3', ''));
    assert.equal((await request(base, `${BASE}/file/${empty.id}`)).status, 200);
    assert.equal((await request(base, `${BASE}/file/${empty.id}`, { headers: { Range: 'bytes=0-' } })).status, 416);
    fs.unlinkSync(path.join(f.root, `${item.id}.mp4`));
    assert.equal((await request(base, route)).status, 404);
});

test('streaming rejects replacement links that escape the chosen root', options, async t => {
    const f = fixture(t);
    const item = await mapped(f);
    const file = path.join(f.root, `${item.id}.mp4`);
    fs.unlinkSync(file);
    fs.symlinkSync(f.directory, file, 'junction');
    const base = await startServer(t, f.studio);
    assert.equal((await request(base, `${BASE}/file/${item.id}`)).status, 404);
});

test('SSE caps clients, drops slow clients, heartbeats and cleans up on close', options, async t => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    const f = fixture(t);
    const item = await mapped(f);
    const clients = Array.from({ length: 50 }, () => fakeRequest(f.studio, `${BASE}/events`));
    assert.ok(clients.every(client => client.res.status === 200));
    assert.equal(fakeRequest(f.studio, `${BASE}/events`).res.status, 503);
    t.mock.timers.tick(15000);
    assert.ok(clients[0].res.frames.includes(': heartbeat\n\n'));
    clients[0].res.destroy();
    const slow = fakeRequest(f.studio, `${BASE}/events`, { backpressure: true });
    assert.equal(slow.res.status, 200);
    assert.equal(slow.res.destroyed, true);
    const replacement = fakeRequest(f.studio, `${BASE}/events`);
    f.studio.test(item.id);
    assert.equal(replacement.events().length, 1);
    const reconnected = (() => { replacement.res.destroy(); return fakeRequest(f.studio, `${BASE}/events`); })();
    assert.equal(reconnected.events().length, 0);
    f.studio.close();
    assert.ok(clients.every(client => client.res.destroyed));
    assert.equal(reconnected.res.destroyed, true);
    const count = reconnected.res.frames.length;
    t.mock.timers.tick(30000);
    assert.equal(reconnected.res.frames.length, count);
    assert.throws(() => f.studio.list(), /closed/);
    assert.equal(fakeRequest(f.studio, BASE).res.status, 503);
    f.studio.close();
});

test('SSE travels over HTTP and an unknown Last-Event-ID does not replay old events', options, async t => {
    const f = fixture(t);
    const item = await mapped(f);
    const base = await startServer(t, f.studio);
    f.studio.test(item.id);
    const { req, res, chunks } = await new Promise((resolve, reject) => {
        const chunks = [];
        const req = http.get(`${base}${BASE}/events?key=${KEY}&channel=alice`, { headers: { 'Last-Event-ID': 'old' } }, res => {
            res.on('data', chunk => {
                chunks.push(chunk.toString());
                if (chunks.length === 1) resolve({ req, res, chunks });
            });
        });
        req.on('error', reject);
    });
    t.after(() => req.destroy());
    assert.equal(res.statusCode, 200);
    assert.match(chunks.join(''), /^: connected/);
    assert.ok(!chunks.join('').includes('studio:play'));
    const delivered = new Promise(resolve => res.once('data', resolve));
    const event = f.studio.test(item.id);
    const frame = (await delivered).toString();
    assert.ok(frame.includes(event.id));
    assert.ok(frame.includes('event: studio:play'));
    assert.ok(!frame.includes(f.directory));
    req.destroy();
});

test('source diagnostics exclude posters, hover previews, editor previews and other scopes', options, async t => {
    const f = fixture(t);
    const item = await mapped(f);
    assert.deepEqual(f.studio.status(), { receivers: 0, previews: 0, configured: 1, gameId: '', activeGame: '' });
    const preview = fakeRequest(f.studio, `${BASE}/events?preview=1&item=${item.id}`);
    const global = fakeRequest(f.studio, `${BASE}/events`);
    const game = fakeRequest(f.studio, `${BASE}/events?game=alpha`);
    fakeRequest(f.studio, `${BASE}/events`, { channel: 'bob' });
    assert.equal(f.studio.status().receivers, 1);assert.equal(f.studio.status().previews, 1);
    assert.equal(f.studio.status('alpha').receivers, 1);
    global.res.destroy();assert.equal(f.studio.status().receivers, 0);
    preview.res.destroy();game.res.destroy();
});

test('SSE reconnect recovers only missed same-scope events, never historic events for a new source', options, async t => {
    const f = fixture(t);
    const item = await mapped(f),other = await mapped(f, { gameId: 'alpha' });
    const first=f.studio.test(item.id),missed=f.studio.test(item.id);
    f.studio.test(other.id);
    const recovered=fakeRequest(f.studio, `${BASE}/events`, { headers: { 'last-event-id': first.id } });
    assert.deepEqual(recovered.events().map(event=>event.id),[missed.id]);
    assert.deepEqual(fakeRequest(f.studio, `${BASE}/events`).events(),[]);
    assert.deepEqual(fakeRequest(f.studio, `${BASE}/events`, { channel:'bob', headers: { 'last-event-id': first.id } }).events(),[]);
});

test('v1 defaults remain global and all new settings validate before persisting or importing', options, async t => {
    const f = fixture(t);
    const item = await mapped(f);
    const defaults = { gameId: '', interrupt: false, fade: false, playLimit: 0, combineGifts: false, displaySeconds: 5 };
    for (const [key, value] of Object.entries(defaults)) assert.equal(item[key], value);
    const saved = f.store.get('media_studio_v1');
    for (const key of Object.keys(defaults)) delete saved.items[0][key];
    f.store.set('media_studio_v1', saved);
    f.studio.close();
    const restarted = f.make();
    assert.deepEqual(restarted.list(), [item]);
    for (const patch of [
        { gameId: '../game' }, { gameId: 'GAME' }, { gameId: '-game' }, { gameId: 'a'.repeat(65) },
        { gameId: 'game\n' }, { gameId: null }, { gameId: 1 }, { interrupt: 1 }, { fade: 'true' },
        { combineGifts: null }, { playLimit: -1 }, { playLimit: 1.5 }, { playLimit: Infinity },
        { playLimit: '2' }, { playLimit: Number.MAX_SAFE_INTEGER + 1 }, { displaySeconds: 0 },
        { displaySeconds: -1 }, { displaySeconds: 86401 }, { displaySeconds: NaN }
    ]) assert.throws(() => restarted.save({ id: item.id, ...patch }));
    assert.deepEqual(restarted.list(), [item]);
    const changed = restarted.save({ id: item.id, gameId: 'a'.repeat(64), interrupt: true, fade: true,
        playLimit: 2, combineGifts: true, displaySeconds: 2.5 });
    assert.equal(new URL(changed.previewUrl, 'http://localhost').searchParams.get('game'), changed.gameId);
    assert.equal(new URL(changed.mediaUrl, 'http://localhost').searchParams.has('game'), false);
    await assert.rejects(restarted.importFiles([f.source('bad.gif')], [{ displaySeconds: 0 }]), /displaySeconds/);
    assert.equal(fs.readdirSync(f.root).length, 1);
    const [image] = await restarted.importFiles([f.source('good.gif')], [{ gameId: 'game-2', displaySeconds: 3, interrupt: true }]);
    assert.equal(image.gameId, 'game-2');
    assert.equal(image.interrupt, true);
    assert.equal(image.displaySeconds, 3);
});

test('image imports and HTTPS kinds serve exact MIME, reject mismatches and preserve authentication', options, async t => {
    const f = fixture(t);
    const formats = [['GIF', 'image/gif'], ['png', 'image/png'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'], ['webp', 'image/webp']];
    const images = await f.studio.importFiles(formats.map(([extension]) => f.source(`image.${extension}`)));
    const base = await startServer(t, f.studio);
    for (const [index, image] of images.entries()) {
        assert.equal(image.kind, 'image');
        assert.equal(image.mime, formats[index][1]);
        assert.equal(image.category, 'Image');
        const response = await request(base, `${BASE}/file/${image.id}`);
        assert.equal(response.headers['content-type'], formats[index][1]);
        assert.equal(response.headers['referrer-policy'], 'no-referrer');
        const remote = f.studio.save({ title: 'Remote image', url: `https://cdn.example/image.${formats[index][0]}?token=remote-only`, kind: 'image' });
        assert.equal(remote.kind, 'image');
        assert.equal(remote.mime, formats[index][1]);
        assert.equal((await request(base, `${BASE}/file/${remote.id}`, { key: 'bad' })).status, 403);
        const redirect = await request(base, `${BASE}/file/${remote.id}`);
        assert.equal(redirect.status, 307);
        assert.equal(redirect.headers.location, remote.url);
        assert.ok(!redirect.headers.location.includes(KEY));
    }
    const stream = f.studio.save({ title: 'Image endpoint', kind: 'image', url: 'https://cdn.example/render?id=1' });
    assert.equal(stream.kind, 'image');
    assert.equal(stream.mime, null);
    assert.equal(f.studio.save({ title: 'Inferred', url: 'https://cdn.example/image.png' }).kind, 'image');
    for (const [extension, kind] of [['mp4', 'image'], ['png', 'video'], ['jpg', 'audio'], ['mp3', 'image'], ['png', 'svg']]) {
        assert.throws(() => f.studio.save({ title: 'Mismatch', url: `https://cdn.example/image.${extension}`, kind }), /kind/);
    }
    const overlay = await request(base, `${BASE}/${images[0].id}`);
    assert.match(overlay.headers['content-security-policy'], /img-src 'self' https:/);
    assert.match(overlay.body, /name="referrer" content="no-referrer"/);
});

test('duplicate keeps shared owned assets through removal and restart, rejects source and channel replacement', options, async t => {
    const f = fixture(t, { disk: true });
    const original = await mapped(f, { volume: 0.25 });
    const clone = f.studio.duplicate(original.id, { gameId: 'race', giftId: '', enabled: false,
        id: original.id, file: '../config.json', assetId: '../config', channel: 'bob', url: 'file:///secret', kind: 'image' });
    assert.notEqual(clone.id, original.id);
    assert.equal(clone.channel, 'alice');
    assert.equal(clone.gameId, 'race');
    assert.equal(clone.giftId, '');
    assert.equal(clone.enabled, false);
    assert.equal(clone.volume, 0.25);
    assert.equal(clone.kind, 'video');
    assert.equal(clone.url, '');
    assert.equal(fs.readdirSync(f.root).length, 1);
    assert.ok(!Object.hasOwn(clone, 'assetId'));
    assert.ok(!Object.hasOwn(clone, 'file'));
    assert.equal(f.studio.list()[0].gameId, '');
    const grandchild = f.studio.duplicate(clone.id, { gameId: 'runner' });
    f.studio.remove(original.id);
    f.studio.remove(clone.id);
    f.studio.close();
    const restarted = f.make();
    assert.deepEqual(restarted.list(), [grandchild]);
    const base = await startServer(t, restarted);
    assert.equal((await request(base, `${BASE}/file/${grandchild.id}`)).body, '0123456789');
    assert.equal((await request(base, `${BASE}/${grandchild.id}?game=runner`)).status, 200);
    f.setChannel('bob');
    assert.throws(() => restarted.duplicate(grandchild.id), /Unknown/);
    f.setChannel('alice');
    assert.throws(() => restarted.duplicate(grandchild.id, null), /settings/);
    assert.throws(() => restarted.duplicate(grandchild.id, { gameId: '../escape' }), /gameId/);
    const remote = restarted.save({ title: 'Remote', url: 'https://cdn.example/image.webp', kind: 'image' });
    assert.equal(restarted.duplicate(remote.id, { gameId: 'race' }).url, remote.url);
    assert.ok(!fs.readFileSync(f.config, 'utf8').includes(f.directory));
    assert.ok(!fs.readFileSync(f.config, 'utf8').includes(KEY));
});

test('shared asset loader denies traversal and mismatched ownership; failed duplicate is atomic', options, async t => {
    const f = fixture(t);
    const item = await mapped(f);
    const saved = f.store.get('media_studio_v1');
    const bad = [
        { file: '../config.json', assetId: item.id }, { file: `${item.id}.mp4`, assetId: '../escape' },
        { file: `${item.id}.mp4`, assetId: crypto.randomUUID() }, { file: `${item.id}.svg`, assetId: item.id }
    ].map(patch => ({ ...saved.items[0], id: crypto.randomUUID(), ...patch }));
    f.store.set('media_studio_v1', { version: 1, items: [...saved.items, ...bad] });
    const restarted = f.make();
    assert.deepEqual(restarted.list(), [item]);
    const failing = f.make({ store: { get: () => saved, set() { throw new Error('disk full'); } } });
    assert.throws(() => failing.duplicate(item.id, { gameId: 'race' }), /disk full/);
    assert.deepEqual(failing.list(), [item]);
    assert.equal(fs.readdirSync(f.root).length, 1);
});

test('game-scoped SSE excludes global and other games; only explicit tests bypass active game', options, async t => {
    const f = fixture(t, { activeGame: 'race' });
    const global = await mapped(f);
    const race = f.studio.duplicate(global.id, { gameId: 'race' });
    const runner = f.studio.duplicate(global.id, { gameId: 'runner' });
    const clients = ['', 'race', 'runner'].map(game => fakeRequest(f.studio, `${BASE}/events?game=${game}`));
    const preview = fakeRequest(f.studio, `${BASE}/events?game=runner&item=${runner.id}`);
    const first = f.studio.ingest('gift', { giftId: '5655', eventId: 'a', test: true });
    assert.deepEqual(first.map(event => event.item.id), [global.id, race.id]);
    assert.ok(first.every(event => event.test === false));
    assert.deepEqual(clients.map(client => client.events().length), [1, 1, 0]);
    const tested = f.studio.test(runner.id);
    assert.equal(tested.test, true);
    assert.deepEqual(clients.map(client => client.events().length), [1, 1, 1]);
    assert.equal(preview.events()[0].item.id, runner.id);
    f.setActiveGame('runner');
    assert.deepEqual(f.studio.ingest('gift', { giftId: '5655', eventId: 'b' }).map(event => event.item.id), [global.id, runner.id]);
    f.setActiveGame('RUNNER');
    assert.deepEqual(f.studio.ingest('gift', { giftId: '5655', eventId: 'c' }).map(event => event.item.id), [global.id]);
    assert.equal(fakeRequest(f.studio, `${BASE}/events?item=${race.id}`).res.status, 404);
    assert.equal(fakeRequest(f.studio, `${BASE}/events?game=runner&item=${race.id}`).res.status, 404);
    for (const suffix of ['game=../escape', 'game=Race', 'game=-bad', 'game=a&game=b']) {
        const response = fakeRequest(f.studio, `${BASE}/events?${suffix}`).res;
        assert.equal(response.status, 400);
        assert.ok(!response.body.includes(KEY));
    }
    const base = await startServer(t, f.studio);
    assert.equal((await request(base, `${BASE}/${race.id}`)).status, 404);
    const response = await request(base, `${BASE}/${race.id}?game=race&preview=1`);
    assert.equal(response.status, 200);
    assert.match(response.body, /data-game="race"/);
    const unavailable = f.make({ getActiveGame() { throw new Error('closed game'); } });
    assert.deepEqual(unavailable.ingest('gift', { giftId: '5655' }).map(event => event.item.id), [global.id]);
});

test('inactive game likes do not accumulate remainders or consume playback limits', options, async t => {
    const f = fixture(t);
    const item = await mapped(f, { gameId: 'race', trigger: 'like', playLimit: 1 });
    assert.equal(f.studio.ingest('like', { count: 99 }).length, 0);
    f.setActiveGame('race');
    assert.equal(f.studio.ingest('like', { count: 1 }).length, 0);
    assert.equal(f.studio.ingest('like', { count: 99 })[0].item.id, item.id);
    assert.equal(f.studio.ingest('like', { count: 100 }).length, 0);
});

test('play limits are per action/session, gift repetitions bounded, and tests do not consume limits', options, async t => {
    const f = fixture(t);
    const once = await mapped(f, { playLimit: 2 });
    const combo = await mapped(f, { combineGifts: true, playLimit: 3 });
    const first = f.studio.ingest('gift', { giftId: '5655', repeatCount: 20 });
    assert.deepEqual(first.map(event => event.item.id), [once.id, combo.id, combo.id, combo.id]);
    assert.ok(first.every(event => event.trigger.count === 20));
    assert.deepEqual(f.studio.ingest('gift', { giftId: '5655', repeatCount: 20 }).map(event => event.item.id), [once.id]);
    assert.equal(f.studio.ingest('gift', { giftId: '5655' }).length, 0);
    assert.equal(f.studio.test(combo.id).test, true);
    assert.equal(f.studio.ingest('gift', { giftId: '5655' }).length, 0);
    f.studio.save({ id: combo.id, playLimit: 0 });
    assert.equal(f.studio.ingest('gift', { giftId: '5655', repeatCount: Number.MAX_SAFE_INTEGER }).length, 100);
    f.studio.save({ id: combo.id, playLimit: 4 });
    assert.equal(f.studio.ingest('gift', { giftId: '5655' }).length, 0);
    f.studio.close();
    const restarted = f.make();
    restarted.test(once.id);
    assert.equal(restarted.ingest('gift', { giftId: '5655' }).length, 2);
    const cool = restarted.duplicate(combo.id, { cooldownSeconds: 10, playLimit: 0 });
    assert.equal(restarted.ingest('gift', { giftId: '5655', repeatCount: 9 }).filter(event => event.item.id === cool.id).length, 1);
});

function overlayHarness({ mode = '', item = null, game = item?.gameId || '', extraQuery = '' } = {}) {
    const elements = [];
    const timeouts = new Map();
    const messages = [];
    const windowHandlers = new Map();
    let timerId = 0;
    let now = 0;
    let receive;
    let eventsUrl;
    let sourceClosed = false;
    const classList = () => {
        const classes = new Set();
        return { add(...names) { names.forEach(name => classes.add(name)); },
            remove(...names) { names.forEach(name => classes.delete(name)); }, contains: name => classes.has(name) };
    };
    const bodyClasses = classList();
    const parent = { postMessage(message, origin) { messages.push({ message: JSON.parse(JSON.stringify(message)), origin }); } };
    const stage = { children: [], replaceChildren(element) { this.children = [element]; } };
    class Element {
        constructor(kind) { this.kind = kind; this.handlers = new Map(); this.classList = classList(); this.attributes = {};
            this.currentTime = 0; this.duration = 10; this.paused = true; elements.push(this); }
        addEventListener(name, fn) { this.handlers.set(name, fn); }
        removeEventListener(name) { this.handlers.delete(name); }
        dispatch(name) { this.handlers.get(name)?.(); }
        setAttribute(name, value) { this.attributes[name] = value; }
        removeAttribute(name) { delete this[name]; }
        load() {}
        pause() { this.paused = true; }
        play() { this.played = true; this.paused = false; this.playCalls = (this.playCalls || 0) + 1; return Promise.resolve(); }
        remove() { this.removed = true; if (stage.children[0] === this) stage.children = []; }
    }
    const context = {
        document: { getElementById: () => stage, body: { dataset: { channel: 'alice', item: item?.id || '', game, media: item ? JSON.stringify(item) : '' }, classList: bodyClasses }, createElement: kind => new Element(kind) },
        location: { origin: 'http://127.0.0.1:1234', search: `?key=${KEY}&channel=alice${mode?'&'+mode+'=1':''}${game?'&game='+game:''}${extraQuery}` },
        URL, URLSearchParams, queueMicrotask,
        setTimeout(fn, ms) { const id = ++timerId; timeouts.set(id, { fn, at: now + ms }); return id; }, clearTimeout(id) { timeouts.delete(id); },
        EventSource: class { constructor(url) { eventsUrl = url; } addEventListener(name, fn) { assert.equal(name, 'studio:play'); receive = fn; } close() { sourceClosed = true; } },
        window: { parent, addEventListener(name, fn) { windowHandlers.set(name, fn); } }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../renderer/studio/overlay.js'), 'utf8'), context);
    return { elements, timeouts, stage, messages, bodyClasses, eventsUrl, parent,
        send(event) { receive({ data: JSON.stringify(event) }); },
        message(data, source = parent) { windowHandlers.get('message')?.({ source, data }); },
        hide() { windowHandlers.get('pagehide')(); }, isClosed: () => sourceClosed,
        async advance(ms) {
            const target = now + ms;
            for (;;) {
                const next = [...timeouts.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
                if (!next) break;
                const [id, timer] = next;
                now = timer.at;
                timeouts.delete(id);
                timer.fn();
                await Promise.resolve();
            }
            now = target;
        } };
}

test('poster previews load authenticated clips without a live-event subscription or sound', options, async t => {
    const f=fixture(t);const item=await mapped(f,{startSeconds:2,volume:0.4});
    const h=overlayHarness({mode:'poster',item});
    assert.equal(h.elements.length,1);assert.equal(h.elements[0].muted,true);
    assert.equal(h.elements[0].controls,false);assert.equal(h.elements[0].played,undefined);
    h.elements[0].dispatch('loadedmetadata');assert.equal(h.elements[0].currentTime,2.1);
    h.hide();assert.equal(h.elements[0].paused,true);assert.equal(h.isClosed(),false);
});

test('editor previews expose playback controls and still accept gift-triggered playback', options, async t => {
    const f=fixture(t);const item=await mapped(f,{startSeconds:1,volume:0.4});
    const h=overlayHarness({mode:'preview',item});
    assert.equal(h.elements[0].controls,true);assert.equal(h.elements[0].volume,0.4);
    h.send(f.studio.test(item.id));assert.equal(h.elements.length,2);
    assert.equal(h.elements[0].paused,true);h.elements[1].dispatch('loadedmetadata');
    h.elements[1].dispatch('seeked');assert.equal(h.elements[1].played,true);h.hide();
});

test('overlay plays clips sequentially with seek/volume/end, audio, error recovery and teardown', options, async t => {
    const f = fixture(t);
    const video = await mapped(f, { startSeconds: 2, endSeconds: 5, volume: 0.3 });
    const audio = await mapped(f, {}, f.source('sound.wav'));
    const h = overlayHarness();
    const first = f.studio.test(video.id);
    h.send(first);
    h.send(first);
    h.send(f.studio.test(audio.id));
    assert.equal(h.elements.length, 1);
    const element = h.elements[0];
    assert.equal(element.kind, 'video');
    assert.equal(element.volume, 0.3);
    assert.equal(new URL(element.src).pathname, `${BASE}/file/${video.id}`);
    element.dispatch('loadedmetadata');
    assert.equal(element.currentTime, 2);
    element.dispatch('seeked');
    assert.equal(element.played, true);
    element.currentTime = 5;
    element.dispatch('timeupdate');
    await Promise.resolve();
    assert.equal(element.removed, true);
    assert.equal(h.elements.length, 2);
    assert.equal(h.elements[1].kind, 'audio');
    h.send(f.studio.test(video.id));
    h.elements[1].dispatch('error');
    await Promise.resolve();
    assert.equal(h.elements.length, 3);
    h.hide();
    assert.equal(h.isClosed(), true);
    assert.equal(h.elements[2].removed, true);
    assert.equal(h.timeouts.size, 0);
});

test('overlay rejects unsafe URLs/channels and bounds pending playback', options, async t => {
    const f = fixture(t);
    const item = await mapped(f);
    const h = overlayHarness();
    const event = f.studio.test(item.id);
    for (const mediaUrl of ['file:///C:/secret.mp4', 'http://evil.invalid/clip.mp4', `${BASE}/file/../secret`, event.item.mediaUrl + '&extra=1']) {
        h.send({ ...event, id: crypto.randomUUID(), item: { ...event.item, mediaUrl } });
    }
    h.send({ ...event, channel: 'bob' });
    assert.equal(h.elements.length, 0);
    for (let index = 0; index < 200; index++) h.send({ ...event, id: crypto.randomUUID() });
    for (let index = 0; index < 70; index++) {
        h.elements.at(-1).dispatch('error');
        await Promise.resolve();
    }
    assert.equal(h.elements.length, 65);
    h.hide();
});
