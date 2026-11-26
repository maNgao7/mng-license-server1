'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once, EventEmitter } = require('node:events');
const { createTikTokConnection } = require('../lib/tiktok-connection.cjs');

function fixture() {
    class ApiClient { constructor(config) { this.config = config; } }
    class Connection extends EventEmitter {
        constructor(username, options) { super(); this.username = username; this.options = options; this.sockets = 0; }
        async fetchRoomId() { return '123456'; }
        async fetchRoomInfo() { return { status: 2 }; }
        async setupWebsocket() { this.sockets++; }
        async disconnect() {}
    }
    const sdk = { TikTokLiveConnection: Connection, SignConfig: {
        basePath: 'https://api.example', apiKey: 'PRIVATE', cachedInstance: {},
        baseOptions: { headers: { 'User-Agent': 'test' }, validateStatus: () => true }
    } };
    return { sdk, ApiClient, connection: createTikTokConnection({ sdk, ApiClient, username: 'test' }) };
}

test('abandoned handshake cannot create a late socket or change the next attempt', async () => {
    const a = fixture(), b = fixture();
    await a.connection.fetchRoomId();
    await a.connection.disconnect();
    await assert.rejects(a.connection.setupWebsocket(), { name: 'AbortError' });
    assert.equal(a.connection.sockets, 0);
    await b.connection.setupWebsocket();
    assert.equal(b.connection.sockets, 1);
    assert.equal(b.connection.options.webClientOptions.signal.aborted, false);
    await b.connection.disconnect();
});

test('attempt disposal cancels HTTP and signing together while preserving SDK global state', async () => {
    const { connection, sdk } = fixture();
    const options = connection.options;
    assert.equal(options.eulerApiInstance.config.baseOptions.signal, options.webClientOptions.signal);
    assert.equal(options.eulerApiInstance.config.apiKey, 'PRIVATE');
    assert.ok(sdk.SignConfig.cachedInstance);
    assert.equal(sdk.SignConfig.baseOptions.signal, undefined);
    assert.equal(options.webClientOptions.agent.https.options.autoSelectFamily, true);
    assert.equal(options.wsClientOptions.agent.options.rejectUnauthorized, undefined);
    await connection.disconnect();
    await connection.disconnect();
    assert.equal(options.eulerApiInstance.config.baseOptions.signal.aborted, true);
});

test('pinned SDK cancels a real pending HTTP request and performs no hidden 503 retry', async t => {
    const sdk = await import('tiktok-live-connector');
    const { default: ApiClient } = await import('tiktok-live-api-sdk');
    const server = http.createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => { server.closeAllConnections(); server.close(); });
    const connection = createTikTokConnection({ sdk, ApiClient, username: 'test.host' });
    t.after(() => connection.disconnect());
    let calls = 0;
    server.on('request', (req, res) => { calls++; if (req.url.startsWith('/fail')) res.writeHead(503).end(); });
    const host = `http://127.0.0.1:${server.address().port}`;
    assert.equal(connection.webClient.getBaseUrl('www.tiktok.com'), 'https://www.tiktok.com');
    assert.equal(connection.webClient.getBaseUrl('http://www.tiktok.com'), 'https://www.tiktok.com');
    assert.equal(connection.webClient.getBaseUrl('https://webcast.tiktok.com'), 'https://webcast.tiktok.com');
    assert.throws(() => connection.webClient.getBaseUrl('https://secret@www.tiktok.com'));
    await assert.rejects(connection.webClient.request({ host, path: 'fail' }), error => error.response?.statusCode === 503);
    assert.equal(calls, 1);
    const received = once(server, 'request');
    const pending = connection.webClient.request({ host, path: 'wait' });
    const rejected = assert.rejects(pending, error => /abort/i.test(error.name));
    await received;
    await connection.disconnect();
    await rejected;
    assert.equal(calls, 2);
});
