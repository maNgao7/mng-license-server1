'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createGameLiveServer } = require('../lib/game-live-server.cjs');
const { createGameLiveClient } = require('../lib/game-live-client.cjs');

async function fixture(t) {
    const subscribers = new Set();
    let status = { status: 'connected', username: 'host', roomId: '73213' };
    const starts = [];
    const server = await createGameLiveServer({
        ensureLive: async name => { starts.push(name); return status; },
        observe: observer => { subscribers.add(observer); return () => subscribers.delete(observer); },
        getStatus: () => status
    });
    t.after(() => server.close());
    const client = createGameLiveClient('host', { url: server.url, token: server.token });
    t.after(() => client.disconnect());
    return {
        client, subscribers, starts, server,
        move(value) {
            status = value;
            for (const observer of subscribers) observer.status(status);
        },
        event(type, value) {
            for (const observer of subscribers) observer.event(type, value, status);
        }
    };
}

test('child consumes the owner once, raw payloads survive and child disconnect keeps the owner', async t => {
    const f = await fixture(t);
    const connected = await Promise.all([f.client.connect(), f.client.connect()]);
    assert.deepEqual(f.starts, ['host']);
    assert.equal(connected[0].roomId, '73213');
    const received = once(f.client, 'gift');
    f.event('gift', { user: { uniqueId: 'viewer' }, msgId: 'unique', repeatCount: 2 });
    assert.deepEqual((await received)[0], { user: { uniqueId: 'viewer' }, msgId: 'unique', repeatCount: 2 });
    f.client.disconnect();
    assert.equal(f.client.isConnected, false);
    for (let attempt = 0; attempt < 20 && f.subscribers.size; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(f.subscribers.size, 0);
    assert.deepEqual(f.starts, ['host']);
});

test('game reports a changed owner and cannot keep stale room data', async t => {
    const f = await fixture(t);
    await f.client.connect();
    const stopped = once(f.client, 'disconnected');
    f.move({ status: 'connected', username: 'other', roomId: '73214' });
    await stopped;
    assert.equal(f.client.isConnected, false);
    assert.equal(f.subscribers.size, 0);
});

test('wrong bearer and unavailable LIVE are explicit failures', async t => {
    const f = await fixture(t);
    const unauthorized = createGameLiveClient('host', { url: f.server.url, token: 'a'.repeat(64) });
    t.after(() => unauthorized.disconnect());
    await assert.rejects(unauthorized.connect(), /akışı/);
    f.move({ status: 'waiting', username: 'host', reason: 'offline', roomId: '' });
    await assert.rejects(f.client.connect(), /not online/);
    assert.equal(f.client.isConnected, false);
});

test('remote addresses and embedded credentials are rejected', () => {
    const token = 'a'.repeat(64);
    for (const url of ['https://127.0.0.1', 'http://example.com', 'http://name:secret@127.0.0.1']) {
        assert.throws(() => createGameLiveClient('host', { url, token }), /adres/);
    }
});

test('complete real-sized SDK profiles flow across socket backpressure without disconnecting', async t => {
    const f = await fixture(t);
    await f.client.connect();
    const received = once(f.client, 'chat');
    const payload = { content: 'test', user: { badges: 'a'.repeat(256 * 1024) } };
    f.event('chat', payload);
    assert.deepEqual((await received)[0], payload);
    assert.equal(f.client.isConnected, true);
    const next = once(f.client, 'like');
    f.event('like', { count: 3 });
    assert.deepEqual((await next)[0], { count: 3 });
});

test('repeated real disconnect and reconnect releases every old stream slot', async t => {
    const f = await fixture(t);
    for (let cycle = 0; cycle < 6; cycle++) {
        f.move({ status: 'connected', username: 'host', roomId: String(73213 + cycle) });
        await f.client.connect();
        const stopped = once(f.client, 'disconnected');
        f.move({ status: 'disconnected', username: 'host', roomId: '' });
        await stopped;
        await new Promise(resolve => setTimeout(resolve, 10));
        assert.equal(f.subscribers.size, 0);
    }
});
