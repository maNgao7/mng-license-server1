'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createOverlayBridge, allowedPath } = require('../lib/overlay-bridge.cjs');

const SERVER = 'https://relay.example.test';
const PORT = 19876;
const KEY = 'synthetic-local-access-key';
const LICENSE = 'synthetic-license-secret';
const DEVICE = 'synthetic-device-secret';
const TICKET = 'synthetic-private-ticket';
const TOKEN = 'Ab_9-'.repeat(8) + 'XyZ';
const BASE = SERVER + '/overlays/' + TOKEN;
const UUID = '01234567-89ab-4cde-8fab-0123456789ab';
const STORE_KEY = 'overlay_installation_v1';
const flush = () => new Promise(resolve => setImmediate(resolve));

const SAFE_PATHS = [
    '/widget-overlay.html', '/widget/overlay', '/widget/overlay.html',
    '/widget-top-gift.html', '/widget/top-gift', '/widget/top-gift.html',
    '/widget-top-likes.html', '/widget/top-likes', '/widget/top-likes.html',
    '/widget-leaderboard.html', '/widget/leaderboard', '/widget/leaderboard.html',
    '/widget-gift-feed.html', '/widget/gift-feed', '/widget/gift-feed.html',
    '/widget-activity.html', '/widget/activity', '/widget/activity.html',
    '/widget/state', '/api/widget/state',
    '/widget/top-gift/state', '/api/widget/top-gift/state',
    '/widget/top-likes/state', '/api/widget/top-likes/state',
    '/widget/leaderboard/state', '/api/widget/leaderboard/state',
    '/widget/activity/state', '/api/widget/activity/state',
    '/widget/vendor/matter.js', '/widget/physical-jar.js',
    '/assets/widgets/glass-gift-jar.png',
    '/widget/gift-assets/5655.png', '/widget/gift-assets/gift-a.jpg',
    '/widget/gift-assets/gift_b.jpeg', '/widget/gift-assets/animated.gif',
    '/widget/gift-assets/gift.webp',
    '/tikmng/media', '/tikmng/media/client.js', '/tikmng/media/client.css',
    '/tikmng/media/events', '/tikmng/media/poll',
    '/tikmng/media/' + UUID, '/tikmng/media/file/' + UUID
];

const UNSAFE_PATHS = [
    '', 'widget/state', 'https://attacker.test/widget/state',
    'http://127.0.0.1:' + PORT + '/widget/state',
    '//attacker.test/widget/state', '///attacker.test/widget/state',
    '/\\attacker.test/widget/state', '/widget\\state',
    '/widget/state#fragment', '/widget/state\n', '/widget/state\r',
    '/widget/state\0', '/widget/state\u007f', '/widget/state?x=bad value',
    '/widget/../widget/state', '/widget/./state', '/widget/state/..',
    '/widget/%2e%2e/state', '/widget/%2E%2E/state',
    '/widget/%252e%252e/state', '/widget%2fstate', '/widget%5cstate',
    '/%2f%2fattacker.test/widget/state', '/widget/%00state',
    '/api/accounts', '/api/widget/gift', '/api/widget/like',
    '/widget/settings', '/widget/state/extra', '/widget/state.json',
    '/widget/state/', '/widget//state', '/widget/gift-feed/state',
    '/widget/gift-assets/evil.js', '/widget/gift-assets/nested/gift.png',
    '/widget/gift-assets/../gift.png', '/widget/gift-assets/%2e%2e/gift.png',
    '/widget/gift-assets/gift.svg', '/widget/vendor/other.js',
    '/tikmng/media/settings', '/tikmng/media/upload',
    '/tikmng/media/file/' + UUID + '.mp4', '/tikmng/media/' + UUID + '/settings',
    '/tikmng/media/file/not-a-uuid',
    '/tikmng/media/file/01234567-89ab-0cde-8fab-0123456789ab',
    '/overlays/' + TOKEN + '/widget/state',
    '/widget/state?x=' + 'a'.repeat(4096)
];

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

// Track the actual module's global timers without rewriting or evaluating its source.
class ControlledTimers {
    constructor() {
        this.now = 1800000000000;
        this.next = 0;
        this.pending = new Map();
    }
    add(callback, delay, interval, args) {
        const handle = { id: ++this.next, unref() { return this; } };
        this.pending.set(handle, { callback, args, at: this.now + delay, interval });
        return handle;
    }
    setTimeout(callback, delay = 0, ...args) { return this.add(callback, delay, 0, args); }
    setInterval(callback, delay, ...args) { return this.add(callback, delay, delay, args); }
    clear(handle) { this.pending.delete(handle); }
    async advance(ms) {
        const target = this.now + ms;
        let count = 0;
        for (;;) {
            const due = [...this.pending].filter(([, timer]) => timer.at <= target)
                .sort((a, b) => a[1].at - b[1].at || a[0].id - b[0].id)[0];
            if (!due) break;
            assert.ok(++count < 1000, 'timer callbacks must not loop indefinitely');
            const [handle, timer] = due;
            this.now = timer.at;
            if (timer.interval) timer.at += timer.interval;
            else this.pending.delete(handle);
            timer.callback(...timer.args);
            await flush();
        }
        this.now = target;
        await flush();
    }
}

class FakeWebSocket extends EventEmitter {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    constructor(url, options) {
        super();
        this.url = url;
        this.options = options;
        this.readyState = FakeWebSocket.CONNECTING;
        this.bufferedAmount = 0;
        this.messages = [];
        this.closeCalls = this.terminateCalls = this.pingCalls = 0;
    }
    open() { this.readyState = FakeWebSocket.OPEN; this.emit('open'); }
    receive(message) { this.emit('message', Buffer.from(JSON.stringify(message))); }
    send(raw) {
        assert.equal(this.readyState, FakeWebSocket.OPEN, 'send requires an open WebSocket');
        this.messages.push(JSON.parse(raw));
    }
    close() {
        this.closeCalls++;
        this.readyState = FakeWebSocket.CLOSED;
        this.emit('close', 1000);
    }
    terminate() { this.terminateCalls++; this.close(); }
    ping() { this.pingCalls++; }
}

function isolatedStore(initial = {}) {
    const entries = new Map(Object.entries(initial));
    const writes = [];
    return {
        entries, writes,
        get(key, fallback) { return entries.has(key) ? structuredClone(entries.get(key)) : fallback; },
        set(key, value) { entries.set(key, structuredClone(value)); writes.push({ key, value }); }
    };
}

function sessionData(patch = {}) {
    return { token: TOKEN, ticket: TICKET, expiresAt: Date.now() + 3600000,
        path: '/overlays/' + TOKEN, protocolVersion: 1, ...patch };
}

function sessionResponse(status = 200, data = sessionData()) {
    const response = {
        status, ok: status >= 200 && status < 300, cancelCalls: 0, jsonCalls: 0,
        async json() { response.jsonCalls++; return data; },
        body: { async cancel() { response.cancelCalls++; } }
    };
    return response;
}

function fixture(t, options = {}) {
    const time = new ControlledTimers();
    for (const name of ['setTimeout', 'setInterval']) t.mock.method(globalThis, name, time[name].bind(time));
    for (const name of ['clearTimeout', 'clearInterval']) t.mock.method(globalThis, name, time.clear.bind(time));
    t.mock.method(Date, 'now', () => time.now);
    t.mock.method(Math, 'random', () => 0);
    const calls = [], sockets = [], statuses = [], bridges = [];
    const store = options.store || isolatedStore();
    const f = {
        time, calls, sockets, statuses, store,
        credentials: () => ({ licenseCode: LICENSE, deviceId: DEVICE }),
        session: () => sessionResponse(),
        local: () => new Response('ok', { headers: { 'content-type': 'text/plain' } })
    };
    class Socket extends FakeWebSocket {
        constructor(...args) { super(...args); sockets.push(this); }
    }
    f.create = (extra = {}) => {
        const bridge = createOverlayBridge({
            store, serverURL: SERVER, port: PORT, accessKey: KEY,
            getCredentials: () => f.credentials(), getChannel: () => 'signed-room',
            fetchImpl: async (url, init) => {
                const call = { url: String(url), init };
                calls.push(call);
                return new URL(url).pathname === '/api/overlay/session' ? f.session(call) : f.local(call);
            },
            WebSocketImpl: Socket,
            onStatus: snapshot => statuses.push(snapshot),
            ...options, ...extra
        });
        bridges.push(bridge);
        return bridge;
    };
    f.bridge = f.create();
    f.connect = async (channel = 'signed-room', bridge = f.bridge) => {
        bridge.start(channel);
        await flush();
        const ws = sockets.at(-1);
        assert.ok(ws, 'session must create a WebSocket');
        assert.equal(ws.readyState, FakeWebSocket.CONNECTING);
        assert.equal(bridge.status().ready, false, 'HTTP session success alone is not ready');
        ws.open();
        await flush();
        assert.equal(bridge.status().ready, true);
        return ws;
    };
    f.request = async (ws, patch = {}) => {
        const request = { type: 'request', id: 'request-1', method: 'GET', path: '/widget/state', ...patch };
        ws.receive(request);
        await flush();
        return ws.messages.filter(message => message.id === request.id);
    };
    t.after(async () => {
        for (const bridge of bridges) bridge.stop();
        await flush();
        assert.equal(time.pending.size, 0, 'stop must clear every bridge retry, renewal, heartbeat and request timer');
    });
    return f;
}

function assertPrivateStatus(f, extraSecrets = []) {
    for (const status of [...f.statuses, f.bridge.status()]) {
        assert.deepEqual(Object.keys(status).sort(), ['channel', 'message', 'nextRetryAt', 'publicBase', 'ready', 'status']);
        for (const secret of [KEY, LICENSE, DEVICE, TICKET, ...extraSecrets]) {
            assert.equal(JSON.stringify(status).includes(secret), false, 'status must not contain ' + secret);
        }
    }
}

function pendingUntilAbort(signal) {
    return new Promise((resolve, reject) => {
        const abort = () => reject(new Error('synthetic aborted fetch'));
        if (signal.aborted) abort();
        else signal.addEventListener('abort', abort, { once: true });
    });
}

test('allowlist accepts every root-relative widget, asset and media read route', () => {
    for (const path of SAFE_PATHS) {
        assert.equal(allowedPath(path), true, path);
        assert.equal(allowedPath(path + '?game=game%2Fone&v=2'), true, path + ': encoded query is harmless');
    }
    assert.equal(allowedPath('/widget/state?next=https%3A%2F%2Fattacker.test'), true);
});

test('allowlist rejects arbitrary hosts, paths, encoded traversal and non-string input', () => {
    for (const path of [...UNSAFE_PATHS, undefined, null, 42, {}, [], Buffer.from('/widget/state')]) {
        assert.equal(allowedPath(path), false, 'must reject ' + String(path));
    }
});

test('session POST requires license and device and persists a stable private installation ID', async t => {
    const f = fixture(t);
    const ws = await f.connect('@Signed.Room ');
    const call = f.calls[0];
    assert.equal(call.url, SERVER + '/api/overlay/session');
    assert.equal(call.init.method, 'POST');
    assert.deepEqual(call.init.headers, { 'Content-Type': 'application/json' });
    assert.equal(call.init.redirect, 'error');
    assert.ok(call.init.signal instanceof AbortSignal);
    const payload = JSON.parse(call.init.body);
    const installation = f.store.entries.get(STORE_KEY);
    assert.match(installation, /^[a-f0-9]{32}$/);
    assert.deepEqual(payload, { licenseCode: LICENSE, deviceId: DEVICE,
        installationId: installation + '_stable', channel: 'signed.room' });
    assert.equal(ws.url, 'wss://relay.example.test/api/overlay/bridge');
    assert.deepEqual(ws.options, { headers: { Authorization: 'Bearer ' + TICKET },
        maxPayload: 128 * 1024, handshakeTimeout: 15000 });
    assertPrivateStatus(f, [installation]);
    f.bridge.stop();
    const restarted = f.create();
    await f.connect('second-room', restarted);
    assert.equal(JSON.parse(f.calls[1].init.body).installationId, payload.installationId);
    assert.equal(f.store.writes.length, 1, 'restarting must reuse the stored installation');
    restarted.stop();
    const preview = f.create({ namespace: 'preview' });
    await f.connect('signed.room', preview);
    assert.equal(JSON.parse(f.calls[2].init.body).installationId, installation + '_preview');
    assert.equal(f.store.writes.length, 1);
});

test('missing license or device never sends a session request or creates a socket', async t => {
    for (const credentials of [undefined, null, {}, { deviceId: DEVICE }, { licenseCode: LICENSE },
        { licenseCode: '', deviceId: DEVICE }, { licenseCode: LICENSE, deviceId: '' }]) {
        await t.test(JSON.stringify(credentials) || 'undefined', async sub => {
            const f = fixture(sub);
            f.credentials = () => credentials;
            f.bridge.start('signed-room');
            await flush();
            assert.equal(f.bridge.status().status, 'license-required');
            assert.equal(f.bridge.status().ready, false);
            assert.equal(f.bridge.status().publicBase, '');
            assert.equal(f.calls.length, 0);
            assert.equal(f.sockets.length, 0);
            assert.equal(f.store.writes.length, 0);
            assert.equal(f.time.pending.size, 0);
            assertPrivateStatus(f);
        });
    }
});

test('invalid channels remain idle and the default channel callback is supported', async t => {
    const f = fixture(t);
    for (const channel of ['', ' ', '@', 'varsayilan', 'bad room', 'https://attacker.test',
        'room?license=' + LICENSE, 'a'.repeat(65)]) {
        assert.equal(f.bridge.start(channel).status, 'idle');
    }
    await flush();
    assert.equal(f.calls.length, 0);
    f.bridge.start();
    await flush();
    assert.equal(JSON.parse(f.calls[0].init.body).channel, 'signed-room');
});

test('unsafe server origins never receive credentials', async t => {
    for (const serverURL of ['http://relay.example.test', 'http://127.0.0.1:12345',
        'ws://relay.example.test', 'wss://relay.example.test', 'file:///widget/state',
        'https://user:password@relay.example.test', SERVER + '?ticket=' + TICKET,
        SERVER + '#fragment', 'not a URL']) {
        await t.test(serverURL, async sub => {
            const f = fixture(sub, { serverURL });
            f.bridge.start('signed-room');
            await flush();
            assert.equal(f.bridge.status().ready, false);
            assert.equal(f.bridge.status().status, 'retrying');
            assert.equal(f.calls.length, 0);
            assert.equal(f.sockets.length, 0);
            assertPrivateStatus(f);
        });
    }
    await t.test('test-only HTTP exception still denies remote hosts', async sub => {
        const f = fixture(sub, { serverURL: 'http://attacker.test', allowInsecureForTests: true });
        f.bridge.start('signed-room');
        await flush();
        assert.equal(f.calls.length, 0);
        assert.equal(f.bridge.status().ready, false);
    });
});

test('readiness and public URLs appear only after an actual current socket open', async t => {
    const f = fixture(t);
    const local = 'http://127.0.0.1:' + PORT + '/widget-overlay.html';
    const snapshot = f.bridge.status();
    snapshot.ready = true;
    assert.equal(f.bridge.status().ready, false, 'status returns a copy');
    assert.equal(f.bridge.urlFor(local), '');
    assert.equal(f.bridge.start('signed-room').status, 'connecting');
    await flush();
    assert.equal(f.bridge.status().status, 'connecting');
    assert.equal(f.bridge.status().ready, false);
    assert.equal(f.bridge.status().publicBase, '');
    assert.equal(f.bridge.urlFor(local), '');
    assert.equal(f.time.pending.size, 0, 'renewal and heartbeat wait for open');
    f.sockets[0].open();
    assert.equal(f.bridge.status().status, 'connected');
    assert.equal(f.bridge.status().publicBase, BASE);
    assert.equal(f.bridge.urlFor(local), BASE + '/widget-overlay.html');
    assert.equal(f.time.pending.size, 2);
    f.bridge.start('@SIGNED-ROOM');
    await flush();
    assert.equal(f.calls.length, 1, 'starting the same normalized room is idempotent');
    assertPrivateStatus(f);
    f.bridge.stop();
    assert.equal(f.bridge.status().status, 'idle');
    assert.equal(f.bridge.status().ready, false);
    assert.equal(f.bridge.status().publicBase, '');
    assert.equal(f.bridge.urlFor(local), '');
});

test('urlFor maps all safe local routes and strips every key/channel while retaining game scope', async t => {
    const f = fixture(t);
    await f.connect();
    for (const hostname of ['127.0.0.1', 'localhost']) {
        for (const path of SAFE_PATHS) {
            const input = 'http://' + hostname + ':' + PORT + path +
                '?key=' + KEY + '&channel=attacker&game=game%2Fone&key=other&channel=other&v=2#fragment';
            const actual = f.bridge.urlFor(input);
            assert.equal(actual, BASE + path + '?game=game%2Fone&v=2', path);
            const publicURL = new URL(actual);
            assert.equal(publicURL.searchParams.has('key'), false);
            assert.equal(publicURL.searchParams.has('channel'), false);
            assert.equal(publicURL.searchParams.get('game'), 'game/one');
        }
    }
});

test('urlFor denies wrong ports, protocols, credentials, arbitrary hosts and non-allowlisted paths', async t => {
    const f = fixture(t);
    await f.connect();
    for (const input of [
        'http://127.0.0.1:' + (PORT + 1) + '/widget/state',
        'http://localhost/widget/state', 'https://localhost:' + PORT + '/widget/state',
        'ws://127.0.0.1:' + PORT + '/widget/state', 'file:///widget/state',
        'http://user:password@localhost:' + PORT + '/widget/state',
        'http://attacker.test:' + PORT + '/widget/state',
        'http://localhost.attacker.test:' + PORT + '/widget/state',
        'http://127.0.0.2:' + PORT + '/widget/state',
        '//127.0.0.1:' + PORT + '/widget/state', '/widget/state',
        'http://127.0.0.1:' + PORT + '/api/accounts',
        'http://127.0.0.1:' + PORT + '/widget%2fstate',
        'http://127.0.0.1:' + PORT + '/widget/gift-assets/evil.js',
        BASE + '/widget/state', null, undefined
    ]) assert.equal(f.bridge.urlFor(input), '', String(input));
});

test('urlFor rejects encoded traversal before URL normalization can turn it into an allowed route', async t => {
    const f = fixture(t);
    await f.connect();
    for (const path of ['/private/%2e%2e/widget/state', '/private/%2E%2E/widget/state',
        '/widget/%2e%2e/widget/state', '/widget/gift-assets/%2e%2e/state']) {
        assert.equal(f.bridge.urlFor('http://127.0.0.1:' + PORT + path), '', path);
    }
});

test('404 explicitly reports an undeployed HTTPS service and remains unready until a later socket opens', async t => {
    const f = fixture(t);
    const response = sessionResponse(404);
    f.session = () => response;
    f.bridge.start('signed-room');
    await flush();
    const status = f.bridge.status();
    assert.equal(status.status, 'retrying');
    assert.equal(status.ready, false);
    assert.equal(status.publicBase, '');
    assert.match(status.message, /HTTPS servisi hen\u00fcz g\u00fcncellenmemi\u015f/);
    assert.equal(status.nextRetryAt, f.time.now + 60000);
    assert.equal(response.cancelCalls, 1);
    assert.equal(response.jsonCalls, 0);
    assert.equal(f.sockets.length, 0);
    await f.time.advance(59999);
    assert.equal(f.calls.length, 1);
    f.session = () => sessionResponse();
    await f.time.advance(1);
    assert.equal(f.calls.length, 2);
    assert.equal(f.bridge.status().ready, false);
    f.sockets[0].open();
    assert.equal(f.bridge.status().ready, true);
});

test('401/403 are license failures without WebSockets or automatic retry loops', async t => {
    for (const status of [401, 403]) await t.test(String(status), async sub => {
        const f = fixture(sub);
        const response = sessionResponse(status);
        f.session = () => response;
        f.bridge.start('signed-room');
        await flush();
        assert.equal(f.bridge.status().status, 'license-required');
        assert.equal(f.bridge.status().ready, false);
        assert.equal(f.bridge.status().publicBase, '');
        assert.equal(f.bridge.status().nextRetryAt, null);
        assert.equal(response.cancelCalls, 1);
        assert.equal(response.jsonCalls, 0);
        assert.equal(f.sockets.length, 0);
        assert.equal(f.time.pending.size, 0);
        await f.time.advance(120000);
        assert.equal(f.calls.length, 1);
        assertPrivateStatus(f);
    });
});

test('malformed, expired or incompatible sessions cannot construct a WebSocket', async t => {
    const patches = [
        { token: 'a'.repeat(42) }, { token: 'a'.repeat(44) }, { token: 'a'.repeat(42) + '.' },
        { ticket: null }, { ticket: 'x'.repeat(4097) },
        { path: 'https://attacker.test/overlays/' + TOKEN }, { path: '/overlays/other' },
        { expiresAt: 1800000000000 }, { expiresAt: 1800000030000 },
        { expiresAt: '1800003600000' }, { expiresAt: Infinity }, { protocolVersion: 2 }
    ];
    for (const [index, patch] of patches.entries()) await t.test('invalid session ' + index, async sub => {
        const f = fixture(sub);
        f.session = () => sessionResponse(200, sessionData(patch));
        f.bridge.start('signed-room');
        await flush();
        assert.equal(f.bridge.status().ready, false);
        assert.equal(f.bridge.status().status, 'retrying');
        assert.equal(f.sockets.length, 0);
        assert.equal(f.time.pending.size, 1);
        assertPrivateStatus(f);
    });
});

test('credential, fetch and JSON failures never leak secrets through status or callbacks', async t => {
    const secretError = [KEY, LICENSE, DEVICE, TICKET].join(':');
    for (const phase of ['credentials', 'fetch', 'json', 'server']) await t.test(phase, async sub => {
        const f = fixture(sub);
        const fail = () => { throw new Error(secretError); };
        if (phase === 'credentials') f.credentials = fail;
        if (phase === 'fetch') f.session = fail;
        if (phase === 'json') f.session = () => ({ ...sessionResponse(), json: fail });
        if (phase === 'server') f.session = () => sessionResponse(503);
        f.bridge.start('signed-room');
        await flush();
        assert.equal(f.bridge.status().status, 'retrying');
        assert.equal(f.bridge.status().ready, false);
        assertPrivateStatus(f, [secretError]);
    });
});

test('stale async credentials after a channel change never POST old credentials under either room', async t => {
    for (const order of ['old-first', 'new-first']) await t.test(order, async sub => {
        const f = fixture(sub);
        const old = deferred(), current = deferred();
        let reads = 0;
        f.credentials = () => ++reads === 1 ? old.promise : current.promise;
        f.bridge.start('old-room');
        f.bridge.start('new-room');
        const oldCredentials = { licenseCode: 'obsolete-license-secret', deviceId: 'obsolete-device-secret' };
        if (order === 'old-first') {
            old.resolve(oldCredentials);
            await flush();
            assert.equal(f.calls.length, 0, 'obsolete credentials must never fetch');
            current.resolve({ licenseCode: LICENSE, deviceId: DEVICE });
        } else {
            current.resolve({ licenseCode: LICENSE, deviceId: DEVICE });
            await flush();
            old.resolve(oldCredentials);
        }
        await flush();
        assert.equal(f.calls.length, 1);
        assert.deepEqual(JSON.parse(f.calls[0].init.body), {
            licenseCode: LICENSE, deviceId: DEVICE, channel: 'new-room',
            installationId: f.store.entries.get(STORE_KEY) + '_stable'
        });
        assert.equal(f.sockets.length, 1);
        f.sockets[0].open();
        assert.equal(f.bridge.status().channel, 'new-room');
        assertPrivateStatus(f, Object.values(oldCredentials));
    });
});

test('stop during credentials, session, JSON or WebSocket handshake ignores late completions and opens', async t => {
    for (const phase of ['credentials', 'session', 'json', 'socket']) await t.test(phase, async sub => {
        const f = fixture(sub);
        const pending = deferred();
        if (phase === 'credentials') f.credentials = () => pending.promise;
        if (phase === 'session') f.session = () => pending.promise;
        if (phase === 'json') f.session = () => ({ ...sessionResponse(), json: () => pending.promise });
        f.bridge.start('signed-room');
        await flush();
        const signal = f.calls[0]?.init.signal;
        const ws = f.sockets[0];
        f.bridge.stop();
        const statusCount = f.statuses.length;
        if (signal && phase !== 'socket') assert.equal(signal.aborted, true);
        if (phase === 'credentials') pending.resolve({ licenseCode: LICENSE, deviceId: DEVICE });
        if (phase === 'session') pending.resolve(sessionResponse());
        if (phase === 'json') pending.resolve(sessionData());
        if (ws) {
            assert.equal(ws.closeCalls, 1);
            ws.open();
            ws.receive({ type: 'request', id: 'late', method: 'GET', path: '/widget/state' });
            ws.emit('error', new Error('late socket error'));
            ws.emit('close', 1006);
        }
        await flush();
        assert.equal(f.bridge.status().status, 'idle');
        assert.equal(f.bridge.status().ready, false);
        assert.equal(f.bridge.status().channel, '');
        assert.equal(f.statuses.length, statusCount, 'late callbacks must not publish state');
        assert.equal(f.calls.length, phase === 'credentials' ? 0 : 1);
        assert.equal(f.sockets.length, phase === 'socket' ? 1 : 0);
        assert.equal(f.time.pending.size, 0);
    });
});

test('old sockets cannot open, fetch or change readiness after the selected room changes', async t => {
    const f = fixture(t);
    const old = await f.connect('old-room');
    f.bridge.start('new-room');
    await flush();
    const current = f.sockets[1];
    const count = f.statuses.length;
    old.open();
    old.receive({ type: 'request', id: 'stale-request', method: 'GET', path: '/widget/state' });
    old.emit('error', new Error('stale'));
    old.emit('close', 1006);
    await flush();
    assert.equal(f.calls.length, 2, 'only the two session requests are allowed');
    assert.equal(f.statuses.length, count);
    assert.equal(f.bridge.status().ready, false);
    assert.equal(f.bridge.status().channel, 'new-room');
    current.open();
    await f.request(current);
    assert.equal(new URL(f.calls[2].url).searchParams.get('channel'), 'new-room');
    assert.equal(f.bridge.status().ready, true);
});

test('close plus error schedules exactly one retry and leaves no timers after stop', async t => {
    for (const first of ['close', 'error']) await t.test(first, async sub => {
        const f = fixture(sub);
        const ws = await f.connect();
        assert.equal(f.time.pending.size, 2);
        ws.emit(first, first === 'error' ? new Error(TICKET) : 1006);
        ws.emit(first === 'error' ? 'close' : 'error', new Error(TICKET));
        assert.equal(f.bridge.status().status, 'retrying');
        assert.equal(f.bridge.status().ready, false);
        assert.equal(f.bridge.status().publicBase, '');
        assert.equal(f.bridge.status().nextRetryAt, f.time.now + 3000);
        assert.equal(f.statuses.filter(status => status.status === 'retrying').length, 1);
        assert.equal(f.time.pending.size, 1, 'only one retry timer survives a lost socket');
        await f.time.advance(2999);
        assert.equal(f.calls.length, 1);
        await f.time.advance(1);
        assert.equal(f.calls.length, 2);
        assert.equal(f.sockets.length, 2);
        assert.equal(f.bridge.status().ready, false);
        assert.equal(f.time.pending.size, 0);
        ws.open();
        assert.equal(f.bridge.status().ready, false);
        f.sockets[1].open();
        assert.equal(f.time.pending.size, 2);
        f.bridge.stop();
        await f.time.advance(3600000);
        assert.equal(f.calls.length, 2);
        assert.equal(f.time.pending.size, 0);
        assertPrivateStatus(f);
    });
});

test('heartbeat pong keeps the socket alive; missing pong terminates once and retries', async t => {
    const f = fixture(t);
    const ws = await f.connect();
    await f.time.advance(20000);
    assert.equal(ws.pingCalls, 1);
    ws.emit('pong');
    await f.time.advance(20000);
    assert.equal(ws.pingCalls, 2);
    assert.equal(ws.terminateCalls, 0);
    await f.time.advance(20000);
    assert.equal(ws.terminateCalls, 1);
    assert.equal(f.bridge.status().status, 'retrying');
    assert.equal(f.time.pending.size, 1);
    f.bridge.stop();
    await f.time.advance(60000);
    assert.equal(ws.terminateCalls, 1);
    assert.equal(f.calls.length, 1);
});

test('ticket renewal replaces the socket and waits for its open without accumulating timers', async t => {
    const f = fixture(t);
    f.session = () => sessionResponse(200, sessionData({ expiresAt: Date.now() + 60000 }));
    const ws = await f.connect();
    await f.time.advance(20000);
    ws.emit('pong');
    await f.time.advance(10000);
    assert.equal(f.calls.length, 2);
    assert.equal(ws.closeCalls, 1);
    assert.equal(f.bridge.status().ready, false);
    assert.equal(f.time.pending.size, 0);
    const current = f.sockets[1];
    current.open();
    assert.equal(f.time.pending.size, 2);
    ws.open();
    assert.equal(f.time.pending.size, 2, 'a stale open must not start heartbeat or renewal');
});

test('every allowlisted route supports only GET/HEAD to the fixed owned loopback port', async t => {
    const f = fixture(t);
    const ws = await f.connect();
    let index = 0;
    for (const path of SAFE_PATHS) for (const method of ['GET', 'HEAD']) {
        const messages = await f.request(ws, { id: 'safe-' + index++, method,
            path: path + '?game=game%2Fone&key=attacker&channel=other' });
        const call = f.calls.at(-1);
        const url = new URL(call.url);
        assert.equal(url.origin, 'http://127.0.0.1:' + PORT);
        assert.equal(url.pathname, path);
        assert.deepEqual(url.searchParams.getAll('key'), [KEY]);
        assert.deepEqual(url.searchParams.getAll('channel'), ['signed-room']);
        assert.equal(url.searchParams.get('game'), 'game/one');
        assert.equal(call.init.method, method);
        assert.equal(call.init.redirect, 'manual');
        assert.equal(messages[0].type, 'headers');
        assert.equal(messages[0].status, 200);
        assert.equal(messages.at(-1).type, 'end');
        if (method === 'HEAD') assert.equal(messages.length, 2);
        assert.equal(f.time.pending.size, 2, path + ': response timers are disposed');
    }
    assert.equal(f.calls.length, 1 + SAFE_PATHS.length * 2);
});

test('malicious duplicate or encoded query credentials cannot override the local key or signed channel', async t => {
    const f = fixture(t);
    const ws = await f.connect('signed-room');
    await f.request(ws, { path: '/widget/state?key=evil&%6bey=second&channel=evil&%63hannel=second' +
        '&game=one%2Ftwo&next=https%3A%2F%2Fattacker.test%2Fapi%2Faccounts' });
    const call = f.calls[1];
    const url = new URL(call.url);
    assert.equal(url.origin, 'http://127.0.0.1:' + PORT);
    assert.equal(url.pathname, '/widget/state');
    assert.deepEqual(url.searchParams.getAll('key'), [KEY]);
    assert.deepEqual(url.searchParams.getAll('channel'), ['signed-room']);
    assert.equal(url.searchParams.get('game'), 'one/two');
    assert.equal(call.init.headers['x-tikmng-overlay-base'], '/overlays/' + TOKEN);
});

test('forwarded request headers allow Range/event cursors but never Authorization, cookies or supplied scope', async t => {
    const f = fixture(t);
    const ws = await f.connect();
    await f.request(ws, { headers: {
        range: 'bytes=2-7', 'last-event-id': UUID, authorization: 'Bearer ' + LICENSE,
        Authorization: 'Bearer ' + TICKET, cookie: 'key=' + KEY,
        host: 'attacker.test:1', origin: 'https://attacker.test',
        'x-tikmng-overlay-base': '/overlays/attacker', 'x-forwarded-host': 'attacker.test'
    } });
    assert.deepEqual(f.calls[1].init.headers, {
        'x-tikmng-overlay-base': '/overlays/' + TOKEN, range: 'bytes=2-7', 'last-event-id': UUID
    });
    assert.equal(f.calls[1].init.body, undefined);
    assert.equal(f.calls[1].init.signal.aborted, false);
});

test('forwarded headers reject CR/LF, non-strings and oversized values', async t => {
    const f = fixture(t);
    const ws = await f.connect();
    const values = ['bytes=0-1\r\nAuthorization: secret', 'cursor\nsecret', 'x'.repeat(300), 42, {}, null];
    for (const [index, value] of values.entries()) {
        await f.request(ws, { id: 'header-' + index, headers: { range: value, 'last-event-id': value } });
        assert.deepEqual(f.calls.at(-1).init.headers, { 'x-tikmng-overlay-base': '/overlays/' + TOKEN });
    }
});

test('write methods and arbitrary or encoded paths produce 400/end frames without any local fetch', async t => {
    const f = fixture(t);
    const ws = await f.connect();
    const rejected = [
        ...['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'CONNECT', 'TRACE', 'get', '', null]
            .map(method => ({ method })),
        ...[...UNSAFE_PATHS, null, 42, {}, []].map(path => ({ path }))
    ];
    for (const [index, patch] of rejected.entries()) {
        const id = 'rejected-' + index;
        assert.deepEqual(await f.request(ws, { id, ...patch }), [
            { type: 'headers', id, status: 400, headers: { 'content-type': 'text/plain' } },
            { type: 'end', id }
        ], JSON.stringify(patch));
        assert.equal(f.calls.length, 1, 'blocked request must not call fetch');
    }
    assert.equal(f.time.pending.size, 2);
});

test('range response preserves binary bytes, status, safe headers and the final end frame', async t => {
    const f = fixture(t);
    const ws = await f.connect();
    const bytes = Buffer.alloc(120000);
    for (let index = 0; index < bytes.length; index++) bytes[index] = index % 256;
    f.local = () => new Response(bytes, { status: 206, headers: {
        'content-type': 'video/mp4', 'content-length': String(bytes.length),
        'content-range': 'bytes 100-120099/200000', 'accept-ranges': 'bytes',
        'cache-control': 'private, max-age=0', 'content-security-policy': "default-src 'self'",
        'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff',
        authorization: 'Bearer ' + LICENSE, 'set-cookie': 'key=' + KEY,
        'x-private-secret': TICKET, location: 'http://127.0.0.1:' + PORT + '/private'
    } });
    const messages = await f.request(ws, { path: '/tikmng/media/file/' + UUID,
        headers: { range: 'bytes=100-120099' } });
    assert.equal(f.calls[1].init.headers.range, 'bytes=100-120099');
    assert.deepEqual(messages[0], { type: 'headers', id: 'request-1', status: 206, headers: {
        'content-type': 'video/mp4', 'content-length': String(bytes.length),
        'content-range': 'bytes 100-120099/200000', 'accept-ranges': 'bytes',
        'cache-control': 'private, max-age=0', 'content-security-policy': "default-src 'self'",
        'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff'
    } });
    const chunks = messages.filter(message => message.type === 'chunk');
    assert.equal(chunks.length, 3, 'large reader chunks must be split into bounded WebSocket frames');
    assert.ok(chunks.every(message => Buffer.from(message.data, 'base64').length <= 48 * 1024));
    assert.deepEqual(Buffer.concat(chunks.map(message => Buffer.from(message.data, 'base64'))), bytes);
    assert.deepEqual(messages.map(message => message.type), ['headers', 'chunk', 'chunk', 'chunk', 'end']);
    assert.deepEqual(messages.at(-1), { type: 'end', id: 'request-1' });
    for (const secret of [KEY, LICENSE, TICKET]) assert.equal(JSON.stringify(messages).includes(secret), false);
    assert.equal(f.time.pending.size, 2);
});

test('multiple reader chunks preserve order and cancel the reader after successful completion', async t => {
    const f = fixture(t);
    const ws = await f.connect();
    const chunks = [Uint8Array.from([0, 255, 128]), Uint8Array.from([1, 2, 3]), Uint8Array.from([254])];
    let reads = 0, cancels = 0;
    f.local = () => ({ status: 200, headers: new Headers({ 'content-type': 'application/octet-stream' }),
        body: { getReader: () => ({
            async read() { return reads < chunks.length ? { value: chunks[reads++], done: false } : { done: true }; },
            async cancel() { cancels++; }
        }) }
    });
    const messages = await f.request(ws);
    assert.deepEqual(messages.filter(message => message.type === 'chunk').map(message =>
        [...Buffer.from(message.data, 'base64')]), chunks.map(chunk => [...chunk]));
    assert.equal(messages.at(-1).type, 'end');
    assert.equal(cancels, 1);
});

test('HEAD never reads a body, and bodyless/error statuses propagate as headers/end', async t => {
    const f = fixture(t);
    const ws = await f.connect();
    f.local = () => ({ status: 206, headers: new Headers({ 'content-range': 'bytes 0-1/5' }),
        body: { getReader() { assert.fail('HEAD must not read a response body'); } } });
    assert.deepEqual(await f.request(ws, { method: 'HEAD' }), [
        { type: 'headers', id: 'request-1', status: 206, headers: { 'content-range': 'bytes 0-1/5' } },
        { type: 'end', id: 'request-1' }
    ]);
    for (const status of [204, 304, 404, 416, 500]) {
        f.local = () => new Response(null, { status });
        const id = 'status-' + status;
        assert.deepEqual(await f.request(ws, { id }), [
            { type: 'headers', id, status, headers: {} }, { type: 'end', id }
        ]);
    }
    assert.equal(f.time.pending.size, 2);
});

test('approved HTTPS media redirects are sent as metadata and never followed', async t => {
    const f = fixture(t);
    const ws = await f.connect();
    f.local = () => new Response(null, { status: 307, headers: { location: 'https://cdn.example.test/file.mp4' } });
    const messages = await f.request(ws, { path: '/tikmng/media/file/' + UUID });
    assert.deepEqual(messages, [
        { type: 'headers', id: 'request-1', status: 307, headers: { location: 'https://cdn.example.test/file.mp4' } },
        { type: 'end', id: 'request-1' }
    ]);
    assert.equal(f.calls.length, 2);
    assert.equal(f.calls[1].init.redirect, 'manual');
});

test('unsafe redirects and local fetch failures send only an opaque error frame', async t => {
    const f = fixture(t);
    const ws = await f.connect();
    const locations = ['http://attacker.test/file', 'https://user:password@attacker.test/file',
        '/api/accounts', 'file:///private'];
    for (const [index, location] of locations.entries()) {
        f.local = () => new Response(null, { status: 307, headers: { location } });
        const id = 'redirect-' + index;
        assert.deepEqual(await f.request(ws, { id }), [{ type: 'error', id }]);
    }
    f.local = () => { throw new Error([KEY, LICENSE, TICKET].join(':')); };
    assert.deepEqual(await f.request(ws), [{ type: 'error', id: 'request-1' }]);
    assert.equal(f.time.pending.size, 2);
});

test('malformed frames, invalid IDs and duplicate pending request IDs cannot start arbitrary fetches', async t => {
    const f = fixture(t);
    const ws = await f.connect();
    ws.emit('message', Buffer.from('{broken JSON'));
    ws.receive({ type: 'unknown', id: 'unknown' });
    for (const id of ['', 'bad id', '../private', 'a'.repeat(81), null]) {
        await f.request(ws, { id });
    }
    assert.equal(f.calls.length, 1);
    assert.deepEqual(ws.messages, []);
    f.local = ({ init }) => pendingUntilAbort(init.signal);
    await f.request(ws, { id: 'duplicate' });
    await f.request(ws, { id: 'duplicate', path: '/tikmng/media/events' });
    assert.equal(f.calls.length, 2);
    assert.equal(f.time.pending.size, 3);
    ws.receive({ type: 'cancel', id: 'duplicate' });
    await flush();
    assert.equal(f.calls[1].init.signal.aborted, true);
    assert.deepEqual(ws.messages, [{ type: 'error', id: 'duplicate' }]);
    assert.equal(f.time.pending.size, 2);
});

test('flow pause/resume and socket backpressure defer chunks without leaving polling timers', async t => {
    for (const reason of ['flow', 'buffered']) await t.test(reason, async sub => {
        const f = fixture(sub);
        const ws = await f.connect();
        const pending = deferred();
        f.local = () => pending.promise;
        const inFlight = f.request(ws);
        if (reason === 'flow') ws.receive({ type: 'flow', id: 'request-1', paused: true });
        else ws.bufferedAmount = 2 * 1024 * 1024;
        pending.resolve(new Response(Uint8Array.from([0, 128, 255])));
        await inFlight;
        assert.deepEqual(ws.messages.map(message => message.type), ['headers']);
        assert.equal(f.time.pending.size, 4, 'response deadline and backpressure poll are both tracked');
        if (reason === 'flow') ws.receive({ type: 'flow', id: 'request-1', paused: false });
        else { ws.bufferedAmount = 0; await f.time.advance(25); }
        await flush();
        assert.deepEqual(ws.messages.map(message => message.type), ['headers', 'chunk', 'end']);
        assert.equal(f.time.pending.size, 2);
    });
});

test('canceling a paused request aborts its local fetch and clears deadline/poll timers', async t => {
    const f = fixture(t);
    const ws = await f.connect();
    const pending = deferred();
    f.local = () => pending.promise;
    const inFlight = f.request(ws);
    ws.receive({ type: 'flow', id: 'request-1', paused: true });
    pending.resolve(new Response(Uint8Array.from([1, 2, 3])));
    await inFlight;
    assert.equal(f.time.pending.size, 4);
    ws.receive({ type: 'cancel', id: 'request-1' });
    await flush();
    assert.equal(f.calls[1].init.signal.aborted, true);
    assert.deepEqual(ws.messages.map(message => message.type), ['headers', 'error']);
    assert.equal(f.time.pending.size, 2);
});

test('stop aborts pending local fetches and suppresses late response frames', async t => {
    const f = fixture(t);
    const ws = await f.connect();
    const pending = deferred();
    f.local = () => pending.promise;
    await f.request(ws);
    const signal = f.calls[1].init.signal;
    f.bridge.stop();
    assert.equal(signal.aborted, true);
    pending.resolve(new Response(Uint8Array.from([0, 255])));
    await flush();
    assert.deepEqual(ws.messages, []);
    assert.equal(f.time.pending.size, 0);
    assert.equal(f.bridge.status().status, 'idle');
});

test('local fetch timeout sends one error and releases the request for reuse', async t => {
    const f = fixture(t);
    const ws = await f.connect();
    f.local = ({ init }) => pendingUntilAbort(init.signal);
    await f.request(ws);
    await f.time.advance(20000);
    ws.emit('pong');
    await f.time.advance(10000);
    assert.equal(f.calls[1].init.signal.aborted, true);
    assert.deepEqual(ws.messages, [{ type: 'error', id: 'request-1' }]);
    assert.equal(f.time.pending.size, 2);
    ws.messages.length = 0;
    f.local = () => new Response(null, { status: 204 });
    assert.deepEqual(await f.request(ws), [
        { type: 'headers', id: 'request-1', status: 204, headers: {} }, { type: 'end', id: 'request-1' }
    ]);
});

test('stop while a response is paused disposes the reader and every backpressure timer', async t => {
    const f = fixture(t);
    const ws = await f.connect();
    const pending = deferred();
    let cancels = 0;
    f.local = () => pending.promise;
    const inFlight = f.request(ws);
    ws.receive({ type: 'flow', id: 'request-1', paused: true });
    pending.resolve({ status: 200, headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: { getReader: () => ({
            read() { assert.fail('paused SSE must not read a body chunk'); },
            async cancel() { cancels++; }
        }) }
    });
    await inFlight;
    assert.equal(f.time.pending.size, 3, 'SSE has a capacity poll but no finite body deadline');
    const count = ws.messages.length;
    f.bridge.stop();
    await flush();
    assert.equal(f.calls[1].init.signal.aborted, true);
    assert.equal(cancels, 1);
    assert.equal(ws.messages.length, count, 'stopped requests cannot send more frames');
    assert.equal(f.time.pending.size, 0);
});

test('the simultaneous request limit rejects overflow and stop aborts all 64 owned fetches', async t => {
    const f = fixture(t);
    const ws = await f.connect();
    f.local = ({ init }) => pendingUntilAbort(init.signal);
    for (let index = 0; index < 64; index++) await f.request(ws, { id: 'pending-' + index });
    assert.equal(f.calls.length, 65);
    assert.equal(f.time.pending.size, 66);
    assert.deepEqual(await f.request(ws, { id: 'overflow' }), [
        { type: 'headers', id: 'overflow', status: 400, headers: { 'content-type': 'text/plain' } },
        { type: 'end', id: 'overflow' }
    ]);
    assert.equal(f.calls.length, 65, 'overflow must not fetch');
    f.bridge.stop();
    await flush();
    assert.ok(f.calls.slice(1).every(call => call.init.signal.aborted));
    assert.equal(f.time.pending.size, 0);
    assert.equal(ws.messages.length, 2, 'aborted requests cannot send on the closed socket');
});

test('late old-room reader cleanup cannot remove a new-room request that reuses its ID', async t => {
    for (const action of ['cancel', 'stop']) await t.test(action, async sub => {
        const f = fixture(sub);
        const oldCleanup = deferred(), currentResponse = deferred();
        let cancels = 0;
        f.local = ({ url, init }) => new URL(url).searchParams.get('channel') === 'old-room'
            ? { status: 200, headers: new Headers({ 'content-type': 'application/octet-stream' }),
                body: { getReader: () => ({
                    read: () => pendingUntilAbort(init.signal),
                    cancel() { cancels++; return oldCleanup.promise; }
                }) } }
            : Promise.race([currentResponse.promise, pendingUntilAbort(init.signal)]);
        const old = await f.connect('old-room');
        await f.request(old, { id: 'reused-id' });
        const oldSignal = f.calls.at(-1).init.signal;
        const current = await f.connect('new-room');
        assert.equal(oldSignal.aborted, true);
        assert.equal(cancels, 1, 'old reader cancellation is still awaiting cleanup');
        await f.request(current, { id: 'reused-id' });
        const signal = f.calls.at(-1).init.signal;
        oldCleanup.resolve();
        await flush();
        if (action === 'cancel') current.receive({ type: 'cancel', id: 'reused-id' });
        else f.bridge.stop();
        await flush();
        const aborted = signal.aborted;
        // Release the synthetic fetch even when the regression leaves it untracked.
        currentResponse.resolve(new Response(null, { status: 204 }));
        await flush();
        assert.equal(aborted, true, action + ' must still reach the current request controller');
    });
});
