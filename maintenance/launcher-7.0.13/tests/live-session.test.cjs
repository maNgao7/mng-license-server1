'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createLiveSession } = require('../lib/live-session.cjs');

const flush = () => new Promise(resolve => setImmediate(resolve));
const ROOM_ID = '7381234567890123456';
const EVENTS = {
    CHAT: 'chat', GIFT: 'gift', LIKE: 'like', FOLLOW: 'follow', SHARE: 'share',
    MEMBER: 'member', ROOM_USER: 'roomUser', SOCIAL: 'social', STREAM_END: 'streamEnd',
    SUB_NOTIFY: 'subNotify'
};

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

class ControlledTimers {
    constructor() { this.time = 1700000000000; this.next = 0; this.pending = new Map(); }
    now() { return this.time; }
    setTimeout(callback, delay) {
        const id = this.next++;
        this.pending.set(id, { callback, at: this.time + delay });
        return id;
    }
    clearTimeout(id) { this.pending.delete(id); }
    async advance(ms) {
        const target = this.time + ms;
        for (;;) {
            const due = [...this.pending].filter(([, timer]) => timer.at <= target)
                .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
            if (!due) break;
            this.time = due[1].at;
            this.pending.delete(due[0]);
            due[1].callback();
            await flush();
        }
        this.time = target;
        await flush();
    }
}

class FakeConnection extends EventEmitter {
    constructor(connectImpl = () => ({ roomId: ROOM_ID, isConnected: true })) {
        super();
        this.connectImpl = connectImpl;
        this.isConnected = false;
        this.connectCalls = this.disconnectCalls = this.terminateCalls = 0;
        this.wsClient = { terminate: () => { this.terminateCalls++; } };
    }
    connect() {
        this.connectCalls++;
        return Promise.resolve(this.connectImpl()).then(result => {
            this.isConnected = result?.isConnected !== false;
            return result;
        });
    }
    disconnect() {
        this.disconnectCalls++;
        this.isConnected = false;
        this.emit('disconnected', { code: 1000 });
        return Promise.resolve();
    }
}

function fixture(t, options = {}) {
    const time = new ControlledTimers();
    const statuses = [], received = [], calls = [], connections = [];
    const session = createLiveSession({
        clock: time, timers: time, random: () => 0.5, events: EVENTS,
        ...options,
        createConnection: async username => {
            calls.push(username);
            const connection = options.createConnection ? await options.createConnection(username) : new FakeConnection();
            connections.push(connection);
            return connection;
        },
        onStatus: snapshot => { statuses.push(snapshot); return options.onStatus?.(snapshot); },
        onEvent: (type, payload) => { received.push({ type, payload }); return options.onEvent?.(type, payload); }
    });
    t.after(async () => { session.close(); await flush(); assert.equal(time.pending.size, 0); });
    return { session, time, statuses, received, calls, connections };
}

test('contract exposes independent status snapshots without importing the SDK', t => {
    assert.throws(() => createLiveSession(), /createConnection/);
    const f = fixture(t);
    assert.deepEqual(Object.keys(f.session).sort(), ['close', 'start', 'status', 'stop']);
    const snapshot = f.session.status();
    assert.deepEqual(snapshot, {
        status: 'disconnected', reason: 'idle', username: '', roomId: '', attempt: 0,
        lastConnectedAt: null, lastEventAt: null, nextRetryAt: null,
        message: 'Yay\u0131nc\u0131 hesab\u0131 bekleniyor.'
    });
    snapshot.status = 'connected';
    assert.equal(f.session.status().status, 'disconnected');
    assert.equal(f.time.pending.size, 0);
});

test('entering a username, loading the SDK and SDK connected events cannot assert connected', async t => {
    const factory = deferred(), connected = deferred();
    const connection = new FakeConnection(() => connected.promise);
    const f = fixture(t, { createConnection: () => factory.promise });
    const result = f.session.start('  @Test.Host  ');
    assert.equal(f.session.status().status, 'connecting');
    assert.equal(f.session.status().username, 'Test.Host');
    assert.equal(f.session.status().attempt, 1);
    assert.equal(f.session.status().lastConnectedAt, null);
    factory.resolve(connection);
    await flush();
    connection.emit('connected', { roomId: ROOM_ID });
    connection.emit('websocketConnected', {});
    connection.emit('chat', { comment: 'too early' });
    assert.equal(f.session.status().status, 'connecting');
    assert.equal(f.received.length, 0);
    connected.resolve({ roomId: ROOM_ID, isConnected: true });
    const snapshot = await result;
    assert.equal(snapshot.status, 'connected');
    assert.equal(snapshot.roomId, ROOM_ID);
    assert.equal(snapshot.lastConnectedAt, f.time.now());
    assert.equal(snapshot.nextRetryAt, null);
    assert.deepEqual(f.calls, ['Test.Host']);
    assert.deepEqual(f.statuses.map(value => value.status), ['connecting', 'connected']);
});

test('missing, malformed, unsafe and zero room IDs never become connected', async t => {
    for (const value of [undefined, null, {}, { roomId: '' }, { roomId: '   ' }, { roomId: '0' },
        { roomId: '000' }, { roomId: 0 }, { roomId: -1 }, { roomId: true },
        { roomId: 'invalid' }, { roomId: '123?signApiKey=SECRET' }, { roomId: {} },
        { roomId: 1.5 }, { roomId: Infinity }, { roomId: Number(ROOM_ID) },
        { roomId: ROOM_ID, isConnected: false }]) {
        await t.test(String(value?.roomId), async sub => {
            const connection = new FakeConnection(() => value);
            const f = fixture(sub, { createConnection: () => connection });
            const snapshot = await f.session.start('host');
            assert.equal(snapshot.status, 'error');
            assert.equal(snapshot.reason, 'invalid-room');
            assert.equal(snapshot.roomId, '');
            assert.equal(snapshot.lastConnectedAt, null);
            assert.equal(snapshot.nextRetryAt, f.time.now() + 2000);
            assert.equal(f.statuses.some(item => item.status === 'connected'), false);
            assert.ok(connection.disconnectCalls >= 1);
        });
    }
});

test('safe numeric, bigint and string room IDs are preserved as decimal strings', async t => {
    for (const roomId of [123, 7381234567890123456n, ROOM_ID]) await t.test(String(roomId), async sub => {
        const f = fixture(sub, { createConnection: () => new FakeConnection(() => ({ roomId })) });
        assert.equal((await f.session.start('host')).roomId, String(roomId));
    });
});

test('a false documented isConnected getter vetoes a successful-looking connect result', async t => {
    const connection = new FakeConnection();
    connection.connect = async () => ({ roomId: ROOM_ID, isConnected: true });
    const f = fixture(t, { createConnection: () => connection });
    assert.equal((await f.session.start('host')).reason, 'invalid-room');
});

test('empty and invalid usernames do not invoke the factory or echo untrusted input', async t => {
    const f = fixture(t);
    for (const username of ['', ' ', '@', null, undefined, {}, 'bad name', 'https://user:SECRET@host/live', 'host?token=SECRET']) {
        const snapshot = await f.session.start(username);
        assert.equal(snapshot.status, 'disconnected');
        assert.equal(snapshot.username, '');
        assert.equal(JSON.stringify(snapshot).includes('SECRET'), false);
        assert.equal(f.time.pending.size, 0);
    }
    assert.equal(f.calls.length, 0);
});

test('SDK event names map to normalized types while payload objects and viewer counts remain raw', async t => {
    const custom = { ...EVENTS, CHAT: 'sdk-chat', ROOM_USER: 'sdk-room-users' };
    const f = fixture(t, { events: custom });
    await f.session.start('host');
    const connection = f.connections[0];
    const entries = [
        ['sdk-chat', 'chat'], ['gift', 'gift'], ['like', 'like'], ['follow', 'follow'],
        ['share', 'share'], ['member', 'member'], ['subscribe', 'subscribe'],
        ['subNotify', 'subscribe'], ['sdk-room-users', 'viewer']
    ];
    const payloads = entries.map(([event], index) => ({ event, user: { uniqueId: 'viewer' }, viewerCount: index === 8 ? 0 : 12 }));
    await f.time.advance(500);
    entries.forEach(([event], index) => connection.emit(event, payloads[index]));
    assert.deepEqual(f.received.map(item => item.type), entries.map(([, type]) => type));
    f.received.forEach((item, index) => assert.equal(item.payload, payloads[index]));
    assert.equal(f.received.at(-1).payload.viewerCount, 0);
    assert.equal(f.session.status().lastEventAt, f.time.now());
    assert.equal(f.statuses.at(-1).lastEventAt, f.time.now());
    assert.equal(f.session.status().lastConnectedAt, f.time.now() - 500);
    for (const payload of [undefined, null, [], 'text', 1]) connection.emit('sdk-chat', payload);
    connection.emit('unknown', {});
    assert.equal(f.received.length, entries.length);
});

test('social legacy labels and SDK display keys become follow/share only', async t => {
    const f = fixture(t);
    await f.session.start('host');
    const payloads = [
        { label: 'follow' }, { displayType: 'share' }, { event: 'takip' },
        { common: { displayText: { key: 'pm_mt_guidance_share' } } },
        { common: { displayText: { key: 'pm_main_follow_message' } } }
    ];
    for (const payload of payloads) f.connections[0].emit('social', payload);
    f.connections[0].emit('social', { label: 'unknown' });
    assert.deepEqual(f.received.map(item => item.type), ['follow', 'share', 'follow', 'share', 'follow']);
    f.received.forEach((item, index) => assert.equal(item.payload, payloads[index]));
});

test('streak progress is suppressed for legacy and current SDK gift types', async t => {
    const f = fixture(t);
    await f.session.start('host');
    const flags = [false, 0, '0', 'false', undefined, null, true, 1, '1', 'true'];
    for (const gift of [{ giftType: 1 }, { giftType: '1' }, { giftDetails: { giftType: 1 } }, { extendedGiftInfo: { giftType: 1 } }]) {
        for (const repeatEnd of flags) f.connections[0].emit('gift', { ...gift, repeatEnd });
    }
    assert.equal(f.received.length, 16);
    assert.ok(f.received.every(item => [true, 1, '1', 'true'].includes(item.payload.repeatEnd)));
    f.connections[0].emit('gift', { giftDetails: { giftType: 2 }, repeatEnd: false });
    assert.equal(f.received.length, 17);
});

test('nested SDK offline errors enter waiting and repeat near 10 seconds', async t => {
    class UserOfflineError extends Error {}
    const f = fixture(t, { createConnection: () => new FakeConnection(function () {
        const exception = new UserOfflineError("The requested user isn't online :(");
        this.emit('error', { info: 'Error while connecting', exception });
        return Promise.reject(exception);
    }) });
    const first = await f.session.start('host');
    assert.equal(first.status, 'waiting');
    assert.equal(first.reason, 'offline');
    assert.equal(first.nextRetryAt, f.time.now() + 10000);
    assert.equal(f.time.pending.size, 1);
    await f.time.advance(9999);
    assert.equal(f.calls.length, 1);
    await f.time.advance(1);
    assert.equal(f.calls.length, 2);
    assert.equal(f.session.status().attempt, 2);
    assert.equal(f.session.status().nextRetryAt, f.time.now() + 10000);
    assert.equal(f.statuses.filter(item => item.status === 'waiting').length, 2);
});

test('SDK loading failures retry with a sanitized explicit reason and can recover', async t => {
    let count = 0;
    const f = fixture(t, { createConnection: () => {
        if (++count === 1) throw new Error('ERR_MODULE_NOT_FOUND signApiKey=SECRET');
        return new FakeConnection();
    } });
    const failed = await f.session.start('host');
    assert.equal(failed.status, 'error');
    assert.equal(failed.reason, 'sdk-load');
    assert.match(failed.message, /mod\u00fcl\u00fc/);
    assert.equal(JSON.stringify(f.statuses).includes('SECRET'), false);
    await f.time.advance(2000);
    assert.equal(f.session.status().status, 'connected');
    assert.equal(f.session.status().attempt, 2);
});

test('factories returning no SDK connection retry instead of silently returning', async t => {
    const f = fixture(t, { createConnection: () => undefined });
    assert.equal((await f.session.start('host')).reason, 'invalid-connection');
    await f.time.advance(2000);
    assert.equal(f.calls.length, 2);
    assert.equal(f.session.status().reason, 'invalid-connection');
});

test('transient failures back off exponentially and cap the jittered delay at 60 seconds', async t => {
    const f = fixture(t, { createConnection: () => new FakeConnection(() => { throw new Error('ECONNRESET'); }) });
    await f.session.start('host');
    for (const delay of [2000, 4000, 8000, 16000, 32000, 60000, 60000]) {
        assert.equal(f.session.status().reason, 'network');
        assert.equal(f.session.status().nextRetryAt - f.time.now(), delay);
        assert.equal(f.time.pending.size, 1);
        await f.time.advance(delay);
    }
    assert.equal(f.calls.length, 8);
});

test('jitter changes retry delays within bounds for offline and transient failures', async t => {
    for (const [sample, offline, expected] of [[0, false, 1600], [1, false, 2400], [0, true, 8000], [1, true, 12000]]) {
        await t.test(`${sample}/${offline}`, async sub => {
            const f = fixture(sub, { random: () => sample,
                createConnection: () => new FakeConnection(() => { throw new Error(offline ? 'not live' : 'ECONNRESET'); }) });
            const snapshot = await f.session.start('host');
            assert.equal(snapshot.nextRetryAt - f.time.now(), expected);
            for (let i = 0; i < 7; i++) {
                const delay = f.session.status().nextRetryAt - f.time.now();
                assert.ok(delay > 0 && delay <= 60000);
                await f.time.advance(delay);
            }
        });
    }
});

test('errors expose useful allowlisted reasons without exception text or credentials', async t => {
    for (const [message, reason] of [
        ['401 Authorization: Bearer PRIVATE-TOKEN', 'auth'],
        ['429 rate limit apiKey=PRIVATE-TOKEN', 'rate-limit'],
        ['ETIMEDOUT https://user:PRIVATE-TOKEN@server/', 'timeout'],
        ['ECONNREFUSED Cookie: sessionid=PRIVATE-TOKEN', 'network'],
        ['unrecognized failure PRIVATE-TOKEN', 'connection']
    ]) await t.test(reason, async sub => {
        const f = fixture(sub, { createConnection: () => new FakeConnection(() => { throw new Error(message); }) });
        const snapshot = await f.session.start('host');
        assert.equal(snapshot.reason, reason);
        assert.equal(JSON.stringify(f.statuses).includes('PRIVATE-TOKEN'), false);
        assert.match(snapshot.message, /yeniden denenecek/);
        assert.equal(Object.hasOwn(snapshot, 'error'), false);
    });
});

test('25-second connect timeout aborts the old transport and ignores its late success and errors', async t => {
    const pending = deferred();
    const old = new FakeConnection(() => pending.promise);
    let count = 0;
    const f = fixture(t, { createConnection: () => ++count === 1 ? old : new FakeConnection() });
    const first = f.session.start('host');
    await flush();
    await f.time.advance(24999);
    assert.equal(f.session.status().status, 'connecting');
    await f.time.advance(1);
    assert.equal((await first).reason, 'timeout');
    assert.equal(old.disconnectCalls, 1);
    assert.equal(old.terminateCalls, 1);
    assert.equal(f.time.pending.size, 1);
    await f.time.advance(2000);
    const active = f.session.status();
    pending.resolve({ roomId: '999', isConnected: true });
    await flush();
    assert.ok(old.disconnectCalls >= 2);
    assert.equal(old.isConnected, false);
    assert.doesNotThrow(() => old.emit('error', new Error('late PRIVATE-TOKEN')));
    old.emit('streamEnd', {});
    old.emit('chat', { comment: 'stale' });
    assert.deepEqual(f.session.status(), active);
    assert.equal(f.received.length, 0);
    assert.equal(f.calls.length, 2);
});

test('25-second deadline also covers SDK loading and disposes factories resolving after timeout', async t => {
    const factory = deferred();
    const f = fixture(t, { createConnection: () => factory.promise });
    const result = f.session.start('host');
    await f.time.advance(25000);
    assert.equal((await result).reason, 'timeout');
    const late = new FakeConnection();
    factory.resolve(late);
    await flush();
    assert.equal(late.connectCalls, 0);
    assert.equal(late.disconnectCalls, 1);
    assert.equal(f.session.status().reason, 'timeout');
});

test('streamEnd/disconnected pairs schedule exactly one reconnect in either order', async t => {
    for (const first of ['streamEnd', 'disconnected']) await t.test(first, async sub => {
        const f = fixture(sub);
        await f.session.start('host');
        const connection = f.connections[0];
        connection.emit(first, {});
        const snapshot = f.session.status();
        connection.emit(first === 'streamEnd' ? 'disconnected' : 'streamEnd', {});
        connection.emit('error', new Error('also failed'));
        assert.deepEqual(f.session.status(), snapshot);
        assert.equal(snapshot.reason, first === 'streamEnd' ? 'stream-ended' : 'disconnected');
        assert.equal(snapshot.status, first === 'streamEnd' ? 'waiting' : 'error');
        assert.equal(f.time.pending.size, 1);
        assert.equal(connection.disconnectCalls, 1);
        await f.time.advance(snapshot.nextRetryAt - f.time.now());
        assert.equal(f.calls.length, 2);
        assert.equal(f.session.status().status, 'connected');
        assert.equal(f.session.status().attempt, 2);
    });
});

test('error event, disconnect and rejected connect promise count as one failed attempt', async t => {
    const pending = deferred();
    const connection = new FakeConnection(() => pending.promise);
    const f = fixture(t, { createConnection: () => connection });
    const first = f.session.start('host');
    await flush();
    connection.emit('error', { exception: new Error('ECONNRESET') });
    connection.emit('disconnected', {});
    connection.emit('streamEnd', {});
    pending.reject(new Error('ECONNRESET again'));
    await flush();
    assert.equal((await first).reason, 'network');
    assert.equal(f.statuses.filter(item => item.status === 'error').length, 1);
    assert.equal(f.session.status().nextRetryAt - f.time.now(), 2000);
    assert.equal(f.time.pending.size, 1);
});

test('a quiet connected stream stays connected; only actual SDK state triggers health recovery', async t => {
    const f = fixture(t);
    await f.session.start('host');
    const connectedAt = f.session.status().lastConnectedAt;
    await f.time.advance(600000);
    assert.equal(f.session.status().status, 'connected');
    assert.equal(f.session.status().lastEventAt, null);
    assert.equal(f.session.status().lastConnectedAt, connectedAt);
    assert.equal(f.calls.length, 1);
    f.connections[0].isConnected = false;
    await f.time.advance(10000);
    assert.equal(f.session.status().reason, 'disconnected');
    await f.time.advance(2000);
    assert.equal(f.session.status().status, 'connected');
    assert.equal(f.calls.length, 2);
});

test('health checks do not invent a missing SDK connectivity flag or rely on getState', async t => {
    const f = fixture(t);
    await f.session.start('host');
    delete f.connections[0].isConnected;
    f.connections[0].getState = () => { throw new Error('must not call'); };
    await f.time.advance(120000);
    assert.equal(f.session.status().status, 'connected');
    assert.equal(f.calls.length, 1);
});

test('timestamps survive automatic retries and reset when the user starts another account', async t => {
    const f = fixture(t);
    await f.session.start('first');
    const lastConnectedAt = f.time.now();
    await f.time.advance(100);
    f.connections[0].emit('chat', { comment: 'hello' });
    const lastEventAt = f.time.now();
    f.connections[0].emit('disconnected', {});
    assert.equal(f.session.status().lastConnectedAt, lastConnectedAt);
    assert.equal(f.session.status().lastEventAt, lastEventAt);
    await f.time.advance(2000);
    assert.equal(f.session.status().lastConnectedAt, f.time.now());
    assert.equal(f.session.status().lastEventAt, lastEventAt);
    const next = f.session.start('second');
    assert.equal(f.session.status().lastConnectedAt, null);
    assert.equal(f.session.status().lastEventAt, null);
    await next;
    assert.equal(f.session.status().attempt, 1);
});

test('success and offline waiting reset transient backoff', async t => {
    const f = fixture(t);
    await f.session.start('host');
    f.connections[0].emit('error', new Error('network'));
    await f.time.advance(2000);
    f.connections[1].emit('error', new Error('network'));
    assert.equal(f.session.status().nextRetryAt - f.time.now(), 2000);
    f.session.stop();
    let count = 0;
    const other = fixture(t, { createConnection: () => new FakeConnection(() => {
        count++;
        throw new Error(count === 2 ? 'not online' : 'network');
    }) });
    await other.session.start('host');
    await other.time.advance(2000);
    assert.equal(other.session.status().status, 'waiting');
    await other.time.advance(10000);
    assert.equal(other.session.status().nextRetryAt - other.time.now(), 2000);
});

test('stop cancels connecting, retrying and connected sessions and permits a subsequent start', async t => {
    for (const mode of ['connecting', 'retrying', 'connected']) await t.test(mode, async sub => {
        const pending = deferred();
        const connection = new FakeConnection(() => mode === 'connecting' ? pending.promise
            : mode === 'retrying' ? Promise.reject(new Error('network')) : { roomId: ROOM_ID });
        const f = fixture(sub, { createConnection: () => connection });
        const first = f.session.start('host');
        await flush();
        const snapshot = f.session.stop();
        assert.equal(snapshot.status, 'disconnected');
        assert.equal(snapshot.reason, 'stopped');
        assert.equal(snapshot.username, '');
        assert.equal(snapshot.roomId, '');
        assert.equal(snapshot.nextRetryAt, null);
        assert.equal(f.time.pending.size, 0);
        await first;
        await f.time.advance(120000);
        assert.equal(f.calls.length, 1);
        if (mode === 'connecting') {
            pending.resolve({ roomId: ROOM_ID });
            await flush();
            assert.equal(connection.isConnected, false);
        }
        connection.emit('error', new Error('late'));
        connection.emit('chat', { comment: 'late' });
        assert.deepEqual(f.session.status(), snapshot);
        assert.equal(f.received.length, 0);
        await f.session.start('next');
        assert.equal(f.calls.length, 2);
    });
});

test('close settles pending start and permanently disables restarts and retries', async t => {
    const factory = deferred();
    const f = fixture(t, { createConnection: () => factory.promise });
    const first = f.session.start('host');
    const snapshot = f.session.close();
    assert.equal((await first).reason, 'closed');
    assert.equal(f.time.pending.size, 0);
    assert.deepEqual(f.session.close(), snapshot);
    assert.deepEqual(await f.session.start('another'), snapshot);
    const late = new FakeConnection();
    factory.resolve(late);
    await flush();
    await f.time.advance(120000);
    assert.equal(f.calls.length, 1);
    assert.equal(late.connectCalls, 0);
    assert.equal(late.disconnectCalls, 1);
});

test('switching accounts guards against late connection results, rejection and stale SDK events', async t => {
    for (const outcome of ['resolve', 'reject']) await t.test(outcome, async sub => {
        const pending = deferred();
        const old = new FakeConnection(() => pending.promise);
        const f = fixture(sub, { createConnection: username => username === 'old' ? old : new FakeConnection() });
        const first = f.session.start('old');
        await flush();
        await f.session.start('new');
        assert.equal((await first).reason, 'replaced');
        const snapshot = f.session.status();
        pending[outcome](outcome === 'resolve' ? { roomId: '999', isConnected: true } : new Error('late offline'));
        await flush();
        for (const event of ['error', 'disconnected', 'streamEnd', 'chat', 'gift']) old.emit(event, {});
        assert.deepEqual(f.session.status(), snapshot);
        assert.equal(f.received.length, 0);
        assert.equal(old.isConnected, false);
        assert.ok(old.disconnectCalls >= 2);
        assert.equal(old.listenerCount('chat'), 0);
        assert.equal(old.listenerCount('error'), 1);
    });
});

test('late SDK factories never connect after replacement, including repeated same-user starts', async t => {
    const factory = deferred();
    let count = 0;
    const f = fixture(t, { createConnection: () => ++count === 1 ? factory.promise : new FakeConnection() });
    const first = f.session.start('host');
    await f.session.start('host');
    assert.equal((await first).reason, 'replaced');
    const late = new FakeConnection();
    factory.resolve(late);
    await flush();
    assert.equal(late.connectCalls, 0);
    assert.equal(late.disconnectCalls, 1);
    assert.equal(f.session.status().status, 'connected');
    assert.equal(f.session.status().attempt, 1);
});

test('callbacks throwing or rejecting cannot escape SDK events or break the session', async t => {
    for (const asynchronous of [false, true]) await t.test(String(asynchronous), async sub => {
        const fail = () => {
            if (asynchronous) return Promise.reject(new Error('callback failed'));
            throw new Error('callback failed');
        };
        const f = fixture(sub, { onStatus: fail, onEvent: fail });
        await f.session.start('host');
        assert.doesNotThrow(() => f.connections[0].emit('chat', { comment: 'hello' }));
        await flush();
        assert.equal(f.session.status().status, 'connected');
        assert.equal(f.received.length, 1);
    });
});

test('callback mutation cannot change internal status or the snapshot returned by start', async t => {
    const f = fixture(t, { onStatus: snapshot => { snapshot.status = 'corrupted'; snapshot.roomId = 'bad'; } });
    const snapshot = await f.session.start('host');
    assert.equal(snapshot.status, 'connected');
    assert.equal(snapshot.roomId, ROOM_ID);
    assert.deepEqual(f.session.status(), snapshot);
});

test('callbacks may stop during connecting or replace an account during a retry notification', async t => {
    let f;
    f = fixture(t, { onStatus: snapshot => { if (snapshot.status === 'connecting') f.session.stop(); } });
    assert.equal((await f.session.start('host')).reason, 'stopped');
    assert.equal(f.calls.length, 0);
    assert.equal(f.time.pending.size, 0);
    let next;
    next = fixture(t, {
        createConnection: username => new FakeConnection(() => {
            if (username === 'old') throw new Error('network');
            return { roomId: ROOM_ID };
        }),
        onStatus: snapshot => { if (snapshot.status === 'error') void next.session.start('new'); }
    });
    await next.session.start('old');
    await flush();
    assert.equal(next.session.status().username, 'new');
    assert.equal(next.session.status().status, 'connected');
    await next.time.advance(5000);
    assert.deepEqual(next.calls, ['old', 'new']);
});

test('foreign disconnect callbacks can start another session during failure or explicit cleanup', async t => {
    for (const action of ['error', 'stop', 'start']) await t.test(action, async sub => {
        const f = fixture(sub);
        await f.session.start('old');
        f.connections[0].once('disconnected', () => { void f.session.start('new'); });
        if (action === 'error') f.connections[0].emit('error', new Error('network'));
        else if (action === 'stop') f.session.stop();
        else await f.session.start('middle');
        await flush();
        assert.equal(f.session.status().username, 'new');
        assert.equal(f.session.status().status, 'connected');
        await f.time.advance(5000);
        assert.equal(f.calls.filter(username => username === 'old').length, 1);
        assert.equal(f.calls.filter(username => username === 'new').length, 1);
    });
});

test('stopping from event telemetry prevents event forwarding and cancels health checks', async t => {
    let f;
    f = fixture(t, { onStatus: snapshot => { if (snapshot.lastEventAt !== null) f.session.stop(); } });
    await f.session.start('host');
    f.connections[0].emit('chat', { comment: 'hello' });
    assert.equal(f.session.status().status, 'disconnected');
    assert.equal(f.received.length, 0);
    assert.equal(f.time.pending.size, 0);
});

test('cleanup does not await a stuck disconnect, absorbs rejection, and preserves foreign listeners', async t => {
    for (const cleanup of ['reject', 'throw', 'hang']) await t.test(cleanup, async sub => {
        const connection = new FakeConnection();
        const external = () => {};
        connection.on('chat', external);
        connection.disconnect = () => {
            if (cleanup === 'throw') throw new Error('cleanup');
            return cleanup === 'hang' ? new Promise(() => {}) : Promise.reject(new Error('cleanup'));
        };
        const f = fixture(sub, { createConnection: () => connection });
        await f.session.start('host');
        const snapshot = f.session.stop();
        assert.equal(snapshot.status, 'disconnected');
        assert.equal(f.time.pending.size, 0);
        assert.deepEqual(connection.listeners('chat'), [external]);
        assert.equal(connection.terminateCalls, 1);
        assert.doesNotThrow(() => connection.emit('error', new Error('late cleanup error')));
        await flush();
    });
});
