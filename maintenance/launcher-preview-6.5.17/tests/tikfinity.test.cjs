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
