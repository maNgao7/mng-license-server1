'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter, once } = require('node:events');
const WebSocket = require('ws');
const { TikfinityBridge, localEndpoint } = require('../lib/tikfinity.cjs');

const options = { timeout: 10000 };

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

async function fixture(t) {
    const server = new WebSocket.Server({ host: '127.0.0.1', port: 0 });
    const bridge = new TikfinityBridge();
    const statuses = [];
    const events = [];
    bridge.on('status', status => statuses.push(status));
    bridge.on('event', (type, data) => events.push({ type, data }));
    t.after(async () => {
        bridge.close();
        for (const client of server.clients) client.terminate();
        await new Promise(resolve => server.close(resolve));
    });
    await once(server, 'listening');
    const endpoint = `ws://127.0.0.1:${server.address().port}/`;
    async function connect(username = '@TestHost') {
        const connected = once(server, 'connection');
        const ready = waitFor(bridge, 'status', status => status.status === 'ready');
        bridge.connect(endpoint, username);
        const [socket] = await connected;
        await ready;
        return socket;
    }
    async function drain(socket, packets) {
        const done = waitFor(bridge, 'event', (_type, data) => data.msgId === 'barrier');
        for (const packet of packets) socket.send(typeof packet === 'string' ? packet : JSON.stringify(packet));
        socket.send(JSON.stringify({ event: 'chat', data: { msgId: 'barrier', comment: 'finished' } }));
        await done;
    }
    return { server, bridge, statuses, events, endpoint, connect, drain };
}

test('Tikfinity endpoints permit only local uncredentialed ws addresses', () => {
    assert.equal(localEndpoint(), 'ws://127.0.0.1:21213/');
    for (const endpoint of ['ws://localhost:21213/events', 'ws://127.0.0.1:1234/', 'ws://[::1]:21213/']) {
        assert.equal(localEndpoint(endpoint), endpoint);
    }
    for (const endpoint of ['not a URL', 'https://localhost:21213/', 'wss://localhost:21213/',
        'ws://example.com/', 'ws://192.168.1.10:21213/', 'ws://localhost.evil.invalid/',
        'ws://user@localhost/', 'ws://user:password@127.0.0.1/', 'ws://localhost/#fragment']) {
        assert.throws(() => localEndpoint(endpoint), undefined, endpoint);
    }
});

test('Tikfinity transitions from connecting to ready to connected and maps supported event types', options, async t => {
    const f = await fixture(t);
    const socket = await f.connect();
    assert.deepEqual(f.statuses.map(status => status.status), ['connecting', 'ready']);
    await f.drain(socket, ['chat', 'gift', 'like', 'follow', 'share', 'member', 'subscribe', 'roomUser', 'ROOMUSER'].map(event => ({
        event, data: { msgId: event, broadcasterUsername: '@TESTHOST', viewerCount: 12 }
    })));
    assert.deepEqual(f.events.map(event => event.type), ['chat', 'gift', 'like', 'follow', 'share', 'member', 'subscribe', 'viewer', 'viewer', 'chat']);
    for (const status of f.statuses) {
        assert.equal(typeof status.status, 'string');
        assert.equal(status.username, 'testhost');
        assert.equal(typeof status.message, 'string');
        assert.ok(status.message.length > 0);
    }
    assert.equal(f.statuses.at(-1).status, 'connected');
    assert.equal(f.events[0].data.broadcasterUsername, '@TESTHOST');
});

test('malformed JSON and invalid data payloads are ignored without losing the socket', options, async t => {
    const f = await fixture(t);
    const socket = await f.connect();
    await f.drain(socket, ['{', 'null', '42', 'true', '"text"', '[]',
        { event: 'chat' }, { event: 'chat', data: null }, { event: 'chat', data: [] },
        { event: 'chat', data: 'text' }, { event: 'chat', data: 2 }]);
    assert.deepEqual(f.events.map(event => event.data.msgId), ['barrier']);
    assert.equal(socket.readyState, WebSocket.OPEN);
    assert.deepEqual(f.statuses.map(status => status.status), ['connecting', 'ready', 'connected']);
});

test('unknown events including object prototype names never become live events', options, async t => {
    const f = await fixture(t);
    const socket = await f.connect();
    await f.drain(socket, ['heartbeat', 'constructor', 'toString', '__proto__', 'hasOwnProperty'].map(event => ({ event, data: { msgId: event } })));
    assert.deepEqual(f.events.map(event => event.type), ['chat']);
    assert.equal(f.statuses.filter(status => status.status === 'connected').length, 1);
});

test('mismatched broadcasters are rejected while matching nested room owners and absent owners work', options, async t => {
    const f = await fixture(t);
    const socket = await f.connect();
    await f.drain(socket, [
        { event: 'chat', data: { msgId: 'foreign', broadcasterUsername: 'another-host' } },
        { event: 'chat', data: { msgId: 'nested-foreign', roomOwner: { uniqueId: '@AnotherHost' } } },
        { event: 'chat', data: { msgId: 'nested-match', roomOwner: { uniqueId: '@TESTHOST' } } },
        { event: 'follow', data: { msgId: 'no-owner' } }
    ]);
    assert.equal(f.statuses.filter(status => status.status === 'error').length, 2);
    assert.deepEqual(f.events.map(event => event.data.msgId), ['nested-match', 'no-owner', 'barrier']);
});

test('streak gifts emit only when repeatEnd explicitly indicates completion', options, async t => {
    const f = await fixture(t);
    const socket = await f.connect();
    const flags = [false, 0, '0', 'false', null, undefined, true, 1, '1', 'true'];
    await f.drain(socket, flags.map((repeatEnd, index) => ({ event: 'gift', data: { giftType: '1', repeatEnd, msgId: `gift-${index}` } })));
    assert.deepEqual(f.events.filter(event => event.type === 'gift').map(event => event.data.msgId), ['gift-6', 'gift-7', 'gift-8', 'gift-9']);
});

test('nested streak variants use the live-session completion flags and field precedence', options, async t => {
    const variants = [
        { name: 'gift.type', fields: { gift: { type: 1 } } },
        { name: 'gift.giftType', fields: { gift: { giftType: '1' } } },
        { name: 'giftDetails.giftType', fields: { giftDetails: { giftType: 1 } } },
        { name: 'extendedGiftInfo.giftType', fields: { extendedGiftInfo: { giftType: '1' } } },
        { name: 'extendedGiftInfo.type', fields: { extendedGiftInfo: { type: 1 } } },
        { name: 'null top-level falls through', fields: { giftType: null, gift: { type: '1' } } },
        { name: 'null gift.type falls through', fields: { gift: { type: null, giftType: 1 } } },
        { name: 'gift.type precedes gift.giftType', fields: { gift: { type: '1', giftType: 2 } } },
        { name: 'top-level precedes nested type', fields: { giftType: 1, gift: { type: 2 } } }
    ];
    for (const { name, fields } of variants) await t.test(name, async t => {
        const f = await fixture(t);
        const socket = await f.connect();
        const flags = [false, 0, '0', 'false', null, undefined, true, 1, '1', 'true'];
        await f.drain(socket, flags.map((repeatEnd, index) => ({ event: 'gift', data: {
            ...fields, repeatEnd, msgId: `nested-${index}`
        } })));
        assert.deepEqual(f.events.filter(event => event.type === 'gift').map(event => event.data.msgId),
            ['nested-6', 'nested-7', 'nested-8', 'nested-9']);
        assert.equal(f.statuses.filter(status => status.status === 'connected').length, 5);
    });
});

test('non-streak gifts and non-gift events retain their original payloads', options, async t => {
    const f = await fixture(t);
    const socket = await f.connect();
    const fields = [
        { giftType: 2 }, { gift: { type: 2 } }, { gift: { giftType: '2' } },
        { giftDetails: { giftType: 2 } }, { extendedGiftInfo: { giftType: 2 } },
        { extendedGiftInfo: { type: 2 } }, { giftType: 0, gift: { type: 1 } },
        { giftType: '2', gift: { type: 1 } }, { gift: { type: 2, giftType: 1 } },
        { gift: null }, {}
    ];
    const packets = fields.map((gift, index) => ({ event: 'gift', data: {
        ...gift, repeatEnd: false, repeatCount: 1, msgId: `ordinary-${index}`
    } }));
    packets.push({ event: 'like', data: { gift: { type: 1 }, repeatEnd: false, msgId: 'ordinary-like' } });
    await f.drain(socket, packets);
    assert.deepEqual(f.events.slice(0, -1), packets.map(packet => ({ type: packet.event, data: packet.data })));
});

test('nested combo progress 1/2/3 then duplicate final 3 produces one normalized media delivery', options, async t => {
    const fs = require('node:fs');
    const path = require('node:path');
    const vm = require('node:vm');
    const { createMediaStudio } = require('../lib/media-studio.cjs');
    const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
    const start = source.indexOf('function widgetTikTokHediyesiniOku(');
    const end = source.indexOf('function widgetTikTokYenidenBaglan(', start);
    assert.ok(start >= 0 && end > start);
    const normalizeGift = vm.runInNewContext(source.slice(start, end) + '\nwidgetTikTokHediyesiniOku');
    const values = new Map();
    const deliveries = [];
    const studio = createMediaStudio({
        store: { get: (key, fallback) => structuredClone(values.get(key) ?? fallback),
            set: (key, value) => values.set(key, structuredClone(value)) },
        root: path.resolve(__dirname, '../unused-tikfinity-qa-media'), accessKey: 'synthetic-tikfinity-test',
        getChannel: () => 'testhost', onEvent: event => deliveries.push(event)
    });
    t.after(() => studio.close());
    studio.save({ kind: 'video', url: 'https://synthetic.invalid/combo.mp4', giftId: '5655', enabled: true });
    const f = await fixture(t);
    const socket = await f.connect();
    f.bridge.on('event', (type, data) => {
        if (type === 'gift') studio.ingest(type, normalizeGift(data), 'testhost');
    });
    const gift = { msgId: 'combo-final', giftId: '5655',
        gift: { type: 1, name: 'Rose', diamondCount: 1 } };
    await f.drain(socket, [1, 2, 3].map(repeatCount => ({ event: 'gift', data: {
        ...gift, repeatCount, repeatEnd: false
    } })));
    assert.equal(f.events.filter(event => event.type === 'gift').length, 0);
    assert.equal(deliveries.length, 0, 'Progress cannot consume the final event ID downstream');
    const final = { event: 'gift', data: { ...gift, repeatCount: 3, repeatEnd: true } };
    await f.drain(socket, [final, final]);
    const finals = f.events.filter(event => event.type === 'gift');
    assert.equal(finals.length, 2, 'Bridge preserves final packets for shared downstream deduplication');
    assert.deepEqual(finals.map(event => event.data), [final.data, final.data]);
    const normalized = normalizeGift(finals[0].data);
    assert.equal(normalized.count, 3);
    assert.equal(normalized.coins, 3);
    assert.equal(normalized.eventId, 'combo-final');
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].trigger.count, 3);
    assert.equal(deliveries[0].trigger.giftId, '5655');
});

test('unexpected disconnect reconnects locally and explicit close cancels a pending retry', options, async t => {
    const f = await fixture(t);
    let socket = await f.connect();
    const disconnected = waitFor(f.bridge, 'status', status => status.status === 'disconnected');
    const nextConnection = once(f.server, 'connection');
    const readyAgain = waitFor(f.bridge, 'status', status => status.status === 'ready');
    socket.terminate();
    await disconnected;
    [socket] = await nextConnection;
    await readyAgain;
    assert.deepEqual(f.statuses.map(status => status.status), ['connecting', 'ready', 'disconnected', 'connecting', 'ready']);
    const retryScheduled = waitFor(f.bridge, 'status', status => status.status === 'disconnected');
    socket.terminate();
    await retryScheduled;
    assert.ok(f.bridge.timer);
    f.bridge.close();
    assert.equal(f.bridge.timer, null);
    assert.equal(f.bridge.socket, null);
    const afterClose = f.statuses.length;
    await new Promise(resolve => setTimeout(resolve, 1650));
    assert.equal(f.statuses.length, afterClose);
    assert.equal(f.server.clients.size, 0);
});

test('switching sessions closes the previous socket and routes only the current publisher', options, async t => {
    const f = await fixture(t);
    const oldSocket = await f.connect('first-host');
    const oldClosed = once(oldSocket, 'close');
    const newSocket = await f.connect('@SECOND-HOST');
    await oldClosed;
    await f.drain(newSocket, [{ event: 'chat', data: { broadcasterUsername: 'second-host', msgId: 'new-session' } }]);
    assert.deepEqual(f.events.map(event => event.data.msgId), ['new-session', 'barrier']);
    assert.equal(f.statuses.at(-1).username, 'second-host');
    assert.equal(f.statuses.some(status => status.status === 'disconnected'), false);
});

test('a failed local handshake reports error and disconnected, then can be closed', options, async t => {
    const f = await fixture(t);
    const { createServer } = require('node:http');
    const http = createServer((_request, response) => response.writeHead(503).end());
    t.after(() => new Promise(resolve => http.close(resolve)));
    http.listen(0, '127.0.0.1');
    await once(http, 'listening');
    const failed = waitFor(f.bridge, 'status', status => status.status === 'disconnected');
    f.bridge.connect(`ws://127.0.0.1:${http.address().port}/`, 'testhost');
    await failed;
    assert.deepEqual(f.statuses.map(status => status.status), ['connecting', 'error', 'disconnected']);
    f.bridge.close();
    assert.equal(f.bridge.timer, null);
});
