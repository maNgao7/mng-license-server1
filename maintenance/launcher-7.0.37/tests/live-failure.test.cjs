'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classifyLiveFailure } = require('../lib/live-failure.cjs');

// Match SDK 2.4.4: most SDK classes leave Error.name untouched; SignAPIError
// uses its constructor name and flattens nested Error messages into text.
class UserOfflineError extends Error {}
class ConnectTimeoutError extends Error {}
class InvalidResponseError extends Error {
    constructor(config, ...args) { super(`[${config.routeId}] ${args.join(' ')}`); this.config = config; }
}
class InvalidResponseCompositeError extends Error {
    constructor(config, ...args) { super(...args); this.config = config; }
}
class SignAPIError extends Error {
    constructor(reason, requestId, agentId, ...args) {
        super([`[${reason}]`, ...args.filter(a => a !== undefined).map(a => a instanceof Error ? a.message : a)].join(' '));
        this.name = this.constructor.name;
        this.reason = reason; this.requestId = requestId; this.agentId = agentId;
    }
}
class SignatureMissingTokensError extends SignAPIError {
    constructor(...args) { super('Empty Payload', undefined, undefined, ...args); }
}
const expected = (reason, stage = 'connection', codes = [], httpStatuses = []) =>
    ({ reason, diagnostic: { stage, codes, httpStatuses } });
const composite = requestErrs => new InvalidResponseCompositeError(
    { routeId: 'fetchRoomIdRoute', requestErrs }, 'Failed to retrieve Room ID from all sources.');

test('wrapped transport, HTTP, offline and timeout errors preserve precise evidence', async t => {
    const cases = [
        ['DNS cause', { exception: { cause: Object.assign(new Error('getaddrinfo failed'), { code: 'ENOTFOUND' }) } }, expected('dns', 'connection', ['ENOTFOUND'])],
        ['TLS cause', { cause: { exception: { code: 'ERR_TLS_CERT_ALTNAME_INVALID' } } }, expected('tls', 'connection', ['ERR_TLS_CERT_ALTNAME_INVALID'])],
        ['HTTP 429 beats signing class', { exception: Object.assign(new SignAPIError('Sign Error'), { cause: { response: { status: 429 } } }) }, expected('rate-limit', 'signing', [], [429])],
        ['HTTP 403', { exception: { cause: { response: { statusCode: '403' } } } }, expected('auth', 'connection', [], [403])],
        ['typed offline with Error.name', { exception: new UserOfflineError('opaque') }, expected('offline', 'room-info')],
        ['SDK offline wording', { cause: new Error("The requested user isn't online :(") }, expected('offline')],
        ['typed SDK timeout', { cause: new ConnectTimeoutError('opaque') }, expected('timeout', 'websocket')],
        ['timeout code', { cause: { code: 'ETIMEDOUT', stage: 'websocket' } }, expected('timeout', 'websocket', ['ETIMEDOUT'])],
        ['network code', { exception: { code: 'ECONNRESET' } }, expected('network', 'connection', ['ECONNRESET'])]
    ];
    for (const [label, error, result] of cases) await t.test(label, () => assert.deepEqual(classifyLiveFailure(error), result));
});

test('flattened SDK messages and legacy messages parse only known codes/status forms', async t => {
    const cases = [
        ['401 Authorization: Bearer PRIVATE-TOKEN', expected('auth', 'connection', [], [401])],
        ['429 rate limit apiKey=PRIVATE-TOKEN', expected('rate-limit', 'connection', [], [429])],
        ['ETIMEDOUT https://user:PRIVATE-TOKEN@server/', expected('timeout', 'connection', ['ETIMEDOUT'])],
        ['ECONNREFUSED Cookie: sessionid=PRIVATE-TOKEN', expected('network', 'connection', ['ECONNREFUSED'])],
        ['not live', expected('offline')],
        ['Timed out whilst connecting to WebSocket', expected('timeout', 'websocket')],
        ['Response code 403 (Forbidden)', expected('auth', 'connection', [], [403])],
        ['Unexpected server response: 429', expected('rate-limit', 'connection', [], [429])],
        [new SignAPIError('Connect Error', 'private-request', 'private-agent', new Error('getaddrinfo ENOTFOUND private.example')), expected('dns', 'signing', ['ENOTFOUND'])],
        [new SignAPIError('Connect Error', undefined, undefined, new Error('UNABLE_TO_VERIFY_LEAF_SIGNATURE')), expected('tls', 'signing', ['UNABLE_TO_VERIFY_LEAF_SIGNATURE'])],
        [new SignAPIError('Sign Error', undefined, undefined, '[fetchSignedWebSocketFromEulerRoute] Unexpected sign server status 429. Payload: PRIVATE'), expected('rate-limit', 'signing', [], [429])]
    ];
    for (let i = 0; i < cases.length; i++) await t.test(String(i), () => assert.deepEqual(classifyLiveFailure(cases[i][0]), cases[i][1]));
});

test('every supported SDK alternative container is traversed', () => {
    const dns = { cause: { code: 'EAI_AGAIN' } };
    for (const error of [
        { errors: [dns] }, { requestErrs: [dns] },
        { context: { routeId: 'fetchRoomIdRoute', requestErrs: [dns] } }, composite([dns])
    ]) {
        const result = classifyLiveFailure(error);
        assert.equal(result.reason, 'dns');
        assert.deepEqual(result.diagnostic.codes, ['EAI_AGAIN']);
    }
});

test('composite alternatives do not turn one failed fallback into root auth or offline', () => {
    const html = new InvalidResponseError({ routeId: 'fetchRoomInfoHtmlRoute' }, 'Failed to extract the SIGI_STATE HTML tag');
    const api = new InvalidResponseError({ routeId: 'fetchRoomInfoApiLiveRoute' }, 'Invalid response from API');
    for (const fallback of [
        new Error('signature provider failure'), new SignAPIError('Sign Error'),
        new SignatureMissingTokensError('Failed to sign a request'), new UserOfflineError('opaque'),
        { response: { status: 403 } }
    ]) {
        const result = classifyLiveFailure(composite([html, api, fallback]));
        assert.equal(result.reason, 'room-discovery');
        assert.equal(result.diagnostic.stage, 'room-discovery');
    }
    assert.deepEqual(classifyLiveFailure(composite([{ statusCode: 403 }, { statusCode: 401 }])),
        expected('auth', 'room-discovery', [], [401, 403]));
    assert.equal(classifyLiveFailure(composite([new UserOfflineError('a'), new UserOfflineError('b')])).reason, 'offline');
    for (const [evidence, reason, codes, statuses] of [
        [{ code: 'ENOTFOUND' }, 'dns', ['ENOTFOUND'], []],
        [{ code: 'CERT_HAS_EXPIRED' }, 'tls', ['CERT_HAS_EXPIRED'], []],
        [{ code: 'ETIMEDOUT' }, 'timeout', ['ETIMEDOUT'], []],
        [{ response: { status: 429 } }, 'rate-limit', [], [429]]
    ]) assert.deepEqual(classifyLiveFailure(composite([html, api, evidence])), expected(reason, 'room-discovery', codes, statuses));
});

test('stages use exact route IDs, typed errors, or allowlisted explicit stages', () => {
    for (const [routeId, stage] of [
        ['fetchRoomIdRoute', 'room-discovery'], ['fetchIsLiveRoute', 'room-discovery'],
        ['fetchRoomIdFromEulerRoute', 'room-discovery'], ['fetchRoomInfoRoute', 'room-info'],
        ['fetchRoomInfoFromEulerRoute', 'room-info'], ['fetchRoomInfoHtmlRoute', 'room-info'],
        ['fetchRoomInfoApiLiveRoute', 'room-info'], ['fetchSignedWebSocketFromEulerRoute', 'signing'],
        ['fetchWebcastSignatureFromEulerRoute', 'signing']
    ]) {
        assert.equal(classifyLiveFailure({ config: { routeId }, code: 'ENOTFOUND' }).diagnostic.stage, stage);
        assert.equal(classifyLiveFailure(new Error(`[${routeId}] failure`)).diagnostic.stage, stage);
    }
    assert.equal(classifyLiveFailure({ stage: 'websocket', code: 'ECONNRESET' }).diagnostic.stage, 'websocket');
    assert.deepEqual(classifyLiveFailure({ config: { routeId: 'private-user-signing' }, stage: 'private-stage' }), expected('connection'));
    assert.deepEqual(classifyLiveFailure(new SignAPIError('Sign Error')), expected('connection', 'signing'));
});

test('missing discovery data, generic signature and offline speculation are not auth/offline proof', () => {
    for (const error of [
        new Error('signature verification failed'), new Error('check apiKey configuration'),
        new Error('Could not determine whether user is offline'), new Error('offline status unavailable'),
        new Error('Could not determine whether LIVE has ended'),
        { status: 4 }, { response: { statusCode: 404 } }, { name: 'private-name' }
    ]) assert.equal(classifyLiveFailure(error).reason, 'connection');
    assert.deepEqual(classifyLiveFailure(composite([])), expected('room-discovery', 'room-discovery'));
    assert.deepEqual(classifyLiveFailure(new Error('LIVE has ended')), expected('offline'));
});

test('cycles, repeated references, malformed input and throwing getters are safe', () => {
    const error = composite([]);
    const dns = { code: 'ENOTFOUND', cause: error };
    error.config.requestErrs.push(error, dns, dns);
    error.exception = error;
    assert.deepEqual(classifyLiveFailure(error), expected('dns', 'room-discovery', ['ENOTFOUND']));
    const getter = { cause: { code: 'EAI_AGAIN' } };
    for (const key of ['message', 'name', 'constructor', 'config', 'response', 'code', 'errors']) {
        Object.defineProperty(getter, key, { get() { throw new Error('PRIVATE'); } });
    }
    assert.deepEqual(classifyLiveFailure(getter), expected('dns', 'connection', ['EAI_AGAIN']));
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    for (const value of [null, undefined, 42, 42n, Symbol('PRIVATE'), revoked.proxy]) {
        assert.deepEqual(classifyLiveFailure(value), expected('connection'));
    }
});

test('bounded traversal ignores excessive depth, breadth and message tails', () => {
    let deep = { code: 'ENOTFOUND' };
    for (let i = 0; i < 1000; i++) deep = { cause: deep };
    assert.deepEqual(classifyLiveFailure(deep), expected('connection'));
    const wide = Array(10000).fill({});
    wide[9999] = { code: 'ENOTFOUND' };
    assert.deepEqual(classifyLiveFailure(composite(wide)), expected('room-discovery', 'room-discovery'));
    assert.deepEqual(classifyLiveFailure(new Error('x'.repeat(100000) + ' ENOTFOUND')), expected('connection'));
    // Truncation must not claim that *all* uninspected alternatives rejected auth.
    assert.equal(classifyLiveFailure(composite(Array(100).fill({ status: 403 }))).reason, 'room-discovery');
    let reads = 0;
    function branch(depth) {
        const node = {};
        Object.defineProperty(node, 'message', { get() { reads++; return 'unknown'; } });
        if (depth) node.errors = Array.from({ length: 8 }, () => branch(depth - 1));
        return node;
    }
    classifyLiveFailure(branch(4));
    assert.ok(reads <= 64, `read ${reads} nodes`);
});

test('diagnostics are bounded, deduplicated, immutable from input and exclude secrets', () => {
    const secret = 'PRIVATE-USER-TOKEN';
    const error = Object.freeze({
        message: `ENOTFOUND https://user:${secret}@private.example/429?apiKey=${secret} Cookie: sessionid=${secret}`,
        name: secret, code: secret, stack: secret, userId: '7384014034299999999',
        config: Object.freeze({ routeId: secret }),
        cause: Object.freeze({ code: 'ENOTFOUND', response: Object.freeze({ status: 403 }) })
    });
    const result = classifyLiveFailure(error);
    assert.deepEqual(result, expected('dns', 'connection', ['ENOTFOUND'], [403]));
    assert.ok(!JSON.stringify(result).includes(secret));
    assert.deepEqual(classifyLiveFailure({ code: 'ERR_TLS_PRIVATE_USER', message: 'userId=401403429 url=https://private/403 token=429' }), expected('connection'));
    const codes = ['ENOTFOUND', 'EAI_AGAIN', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID',
        'CERT_REVOKED', 'EPROTO', 'ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENETDOWN'];
    const many = classifyLiveFailure({ message: `${codes.join(' ')} ${Array.from({ length: 100 }, (_, i) => `HTTP ${400 + i}`).join(' ')}` });
    assert.equal(many.diagnostic.codes.length, 8);
    assert.equal(many.diagnostic.httpStatuses.length, 8);
    assert.ok(JSON.stringify(many).length < 600);
    result.diagnostic.codes.push(secret);
    assert.deepEqual(classifyLiveFailure(error), expected('dns', 'connection', ['ENOTFOUND'], [403]));
});
