'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createSharedGameEvents } = require('../lib/shared-game-events.cjs');
const { createForzaPublisher, normalizeEvent } = require('../lib/forza-publisher.cjs');

async function fixture(t, options = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-forza-feed-')), events = createSharedGameEvents();
    let channel = 'bencezehra';
    const feed = await createForzaPublisher({ events, getChannel: () => channel, getStatus: () => ({ username: channel, status: 'connected' }), username: channel, directory: root, ...options });
    t.after(async () => { await feed.close(); events.close(); assert.equal(path.dirname(root), os.tmpdir()); assert.ok(path.basename(root).startsWith('tikmng-forza-feed-')); fs.rmSync(root, { recursive: true, force: true }); });
    const poll = (after = 0, username = 'bencezehra', token = feed.token, method = 'GET') => fetch(feed.url + '/poll?after=' + after + '&username=' + username, { method, headers: { Authorization: 'Bearer ' + token } });
    const publish = (type, payload, meta = {}) => events.publish(type, payload, { source: 'live', channel, ...meta });
    return { feed, events, root, poll, publish, setChannel(value) { channel = value; } };
}

test('publisher totals become native unit coins; profiles retain username/nickname and stable receipts', () => {
    const event = normalizeEvent('gift', { username: 'Viewer', nickname: 'Display', eventId: 'gift-123', giftId: '5303', repeatCount: 3, coins: 90 }, 'bencezehra');
    assert.equal(event.coins, 30); assert.equal(event.repeatCount, 3); assert.equal(event.username, 'viewer'); assert.equal(event.nickname, 'Display');
    assert.equal(normalizeEvent('gift', { username: 'v', eventId: 'a', giftType: 1, repeatEnd: false }, 'bencezehra'), null);
    assert.equal(normalizeEvent('follow', { username: 'v' }, 'bencezehra'), null);
    assert.equal(normalizeEvent('viewer', { viewerCount: 100, eventId: 'a' }, 'bencezehra'), null);
});

test('authenticated local stream filters synthetic/cross-channel events, deduplicates gifts and retains unacknowledged events', async t => {
    const x = await fixture(t);
    assert.equal((await x.poll(0, 'bencezehra', 'wrong')).status, 403);
    assert.equal((await x.poll(0, 'other')).status, 409);
    assert.equal((await x.poll(0, 'bencezehra', x.feed.token, 'POST')).status, 405);
    x.publish('gift', { username: 'viewer', eventId: 'synthetic', giftId: '5303', coins: 30 }, { source: 'synthetic' });
    x.publish('gift', { username: 'viewer', eventId: 'cross', giftId: '5303', coins: 30 }, { channel: 'other' });
    const gift = { username: 'viewer', nickname: 'Display', eventId: 'real', groupId: 'streak-1', giftId: '5303', repeatCount: 2, coins: 60 };
    x.publish('gift', gift); x.publish('gift', gift); x.publish('gift', { ...gift, eventId: 'reconnect-same-streak' });
    const first = await (await x.poll()).json();
    assert.equal(first.events.length, 1); assert.equal(first.events[0].value.coins, 30);
    assert.deepEqual((await (await x.poll()).json()).events, first.events, 'Unacknowledged delivery is available on reconnect');
    x.publish('like', { username: 'viewer', eventId: 'like', likeCount: 120 });
    const next = await (await x.poll(first.events[0].seq)).json(); assert.equal(next.events.length, 1); assert.equal(next.events[0].value.type, 'like');
    assert.equal(x.feed.pendingCount, 1);
    x.setChannel('other');
    const changed = await (await x.poll()).json(); assert.equal(changed.status.status, 'error'); assert.equal(changed.events.length, 0);
});

test('profile completion adds a portrait event without losing the original reward or identity', async t => {
    const png = Buffer.from('fixture png bytes');
    const x = await fixture(t, { portrait: async () => png });
    x.publish('follow', { username: 'viewer', nickname: 'Display', eventId: 'follow' });
    await new Promise(resolve => setTimeout(resolve, 30));
    const rows = (await (await x.poll()).json()).events;
    assert.equal(rows.length, 2); assert.equal(rows[0].value.type, 'follow'); assert.equal(rows[1].value.type, 'avatar');
    assert.equal(rows[1].value.username, rows[0].value.username);
    assert.deepEqual(fs.readFileSync(path.join(x.root, 'control/live/portraits', rows[1].value.avatarFile)), png);
    x.publish('like', { username: 'viewer', nickname: 'Display', eventId: 'like', likeCount: 100 });
    const later = (await (await x.poll(rows[1].seq)).json()).events;
    assert.equal(later[0].value.avatarFile, rows[1].value.avatarFile, 'An existing avatar accompanies later events immediately');
    assert.equal(later[0].value.type, 'like');
});

test('native stdio bridge consumes the publisher stream, disconnects locally and never opens a TikTok owner', async t => {
    const x = await fixture(t), output = [];
    const child = spawn(process.execPath, [path.join(__dirname, '../tools/forza-publisher-service.cjs')], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, MNG_FORZA_PUBLISHER_URL: x.feed.url, MNG_FORZA_PUBLISHER_TOKEN: x.feed.token } });
    let buffer = '';
    child.stdout.on('data', bytes => { buffer += bytes; let line; while ((line = buffer.indexOf('\n')) >= 0) { output.push(JSON.parse(buffer.slice(0, line))); buffer = buffer.slice(line + 1); } });
    const exited = new Promise(resolve => child.once('exit', resolve));
    t.after(async () => { if (child.exitCode === null) child.stdin.end(); await exited; });
    child.stdin.write(JSON.stringify({ command: 'connect', username: 'bencezehra' }) + '\n');
    await Promise.race([x.feed.clientAttached, new Promise((_, reject) => setTimeout(() => reject(new Error('bridge did not attach')), 5000).unref())]);
    x.publish('gift', { username: 'viewer', eventId: 'native-gift', giftId: '5303', coins: 30 });
    const deadline = Date.now() + 5000;
    while (!output.some(row => row.kind === 'event') && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 15));
    const row = output.find(row => row.kind === 'event'); assert.ok(row); assert.equal(row.value.giftId, '5303'); assert.equal(row.value.coins, 30);
    child.stdin.write('{"command":"disconnect"}\n');
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.ok(output.some(row => row.kind === 'status' && row.value.status === 'disconnected'));
    assert.equal(x.events.size, 1, 'Native disconnect does not close the publisher owner');
    child.stdin.end('{"command":"close"}\n'); await exited;
});

test('portrait failures keep identity and rewards flowing through the publisher', async t => {
    const x = await fixture(t, { portrait: async () => { throw new Error('cache unavailable'); } });
    x.publish('gift', { username: 'viewer', eventId: 'portrait-failure', giftId: '5303', coins: 30 });
    await new Promise(resolve => setTimeout(resolve, 10));
    const first = await (await x.poll()).json();
    assert.equal(first.status.status, 'connected'); assert.equal(first.events[0].value.username, 'viewer');
    assert.equal(first.events[0].value.coins, 30); assert.match(first.status.message, /cache unavailable/);
    x.publish('like', { username: 'viewer', eventId: 'after-portrait-failure', likeCount: 100 });
    assert.equal((await (await x.poll(first.events[0].seq)).json()).events[0].value.type, 'like');
});

test('race portraits use the live event image while the normal widget lookup is busy', async t => {
    const { createWidgetPortraits } = require('../lib/widget-portraits.cjs');
    const requested = [];
    const image = './tikmng/media/file/00112233-4455-6677-8899-aabbccddeeff';
    class Cache {
        async get(urls, options) { requested.push({ urls, options }); return image; }
        info() { return { width: 96, height: 96 }; }
        file(id) { return 'cached-' + id; }
        close() {}
    }
    class Sources {
        get() { return new Promise(() => {}); }
        close() {}
    }
    class Vs {
        cached() {}
        get() { return new Promise(() => {}); }
        close() {}
    }
    const engine = { PortraitCache: Cache, ProfileSources: Sources, VsPortraits: Vs,
        portraitCandidates: data => data.avatar ? [{ rank: 2, urls: [data.avatar] }] : [] };
    const portraits = createWidgetPortraits({ folder: os.tmpdir(), engine });
    t.after(() => portraits.close());
    for (let index = 0; index < 8; index++) portraits.observe({ username: 'widget' + index });
    const avatar = 'https://p16-common-sign.tiktokcdn.com/test.webp';
    assert.equal(await portraits.racePortrait('racer', { avatar }), 'cached-00112233-4455-6677-8899-aabbccddeeff');
    assert.deepEqual(requested, [{ urls: [avatar], options: { priority: true } }]);
});

test('a replay can attach a newly available portrait without awarding a second gift', async t => {
    const photo = Buffer.from('test portrait');
    const x = await fixture(t, { portrait: async (_username, payload) => payload.avatar ? photo : null });
    const gift = { username: 'viewer', eventId: 'single-gift', coins: 10 };
    x.publish('gift', gift);
    const first = (await (await x.poll()).json()).events;
    assert.deepEqual(first.map(row => row.value.type), ['gift']);
    await new Promise(resolve => setImmediate(resolve));
    x.publish('gift', { ...gift, avatar: 'present' });
    const later = (await (await x.poll(first[0].seq)).json()).events;
    assert.deepEqual(later.map(row => row.value.type), ['avatar']);
});

test('identical portraits share one immutable file across viewers and reopening a race', async t => {
    const logo = Buffer.from('shared test portrait');
    const x = await fixture(t, { portrait: async () => logo });
    async function portraits(feed, expected, after = 0) {
        const names = [];
        while (names.length < expected) {
            const rows = (await (await fetch(feed.url + '/poll?after=' + after + '&username=bencezehra',
                { headers: { Authorization: 'Bearer ' + feed.token }, signal: AbortSignal.timeout(3000) })).json()).events;
            assert.ok(rows.length, 'Expected queued portrait events');
            for (const row of rows) {
                after = row.seq;
                if (row.value.type === 'avatar') names.push(row.value.avatarFile);
            }
        }
        return names;
    }
    for (let index = 0; index < 6; index++) x.publish('member', { username: 'viewer_' + index, eventId: 'member_' + index });
    const names = await portraits(x.feed, 6);
    assert.equal(new Set(names).size, 1);
    const file = path.join(x.root, 'control/live/portraits', names[0]);
    const first = fs.statSync(file).mtimeMs;
    await x.feed.close();
    const second = await createForzaPublisher({ events: x.events, getChannel: () => 'bencezehra',
        getStatus: () => ({ status: 'connected' }), directory: x.root, portrait: async () => logo });
    try {
        x.publish('member', { username: 'returning', eventId: 'next-session' });
        assert.deepEqual(await portraits(second, 1), [names[0]]);
        assert.equal(fs.statSync(file).mtimeMs, first, 'A valid file from a previous session is reused');
    } finally { await second.close(); }
});
