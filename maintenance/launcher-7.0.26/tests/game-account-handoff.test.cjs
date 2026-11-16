'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { WebSocketServer } = require('ws');
const { handoffGameAccount } = require('../lib/game-account-handoff.cjs');

async function fixture(t, handler = (_req, res) => res.end('{}'), websocket = false) {
    const server = http.createServer(handler);
    const sockets = websocket ? new WebSocketServer({ server }) : null;
    const connections = new Set();
    server.on('connection', socket => {
        connections.add(socket);
        socket.once('close', () => connections.delete(socket));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(async () => {
        for (const socket of sockets?.clients || []) socket.terminate();
        sockets?.close();
        server.closeAllConnections();
        for (const socket of connections) socket.destroy();
        await new Promise(resolve => server.close(resolve));
    });
    return { server, sockets, baseURL: `http://127.0.0.1:${server.address().port}` };
}

function captureJSON(req) {
    return new Promise(resolve => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => resolve(JSON.parse(body)));
    });
}

test('all root WebSocket contracts deliver exactly one connect message and close their own socket', async t => {
    for (const [gameId, type] of [['vs', 'connect-live'], ['puanlama', 'puanlama-baglan'],
        ['orbit', 'connect'], ['crowd-control', 'connect'], ['crowdControl', 'connect'],
        ['battle-game', 'connect'], ['duck-hunt', 'connect'], ['penalty-kick', 'connect']]) {
        await t.test(gameId, async t => {
            const f = await fixture(t, undefined, true);
            const messages = [];
            let closed;
            const ended = new Promise(resolve => { closed = resolve; });
            f.sockets.on('connection', (socket, req) => {
                assert.equal(req.url, '/');
                assert.equal(req.headers.origin, f.baseURL);
                const status = gameId === 'puanlama' ? 'puanlamaStatus' : 'status';
                socket.send(JSON.stringify({ type: status, state: 'connected', username: 'synthetic_user' }));
                socket.on('message', raw => {
                    messages.push(JSON.parse(raw));
                    socket.send(JSON.stringify(gameId === 'puanlama'
                        ? { type: status, message: 'Bağlanıyor...' }
                        : { type: status, state: 'connecting', username: 'SYNTHETIC_USER' }));
                });
                socket.on('close', closed);
            });
            const result = await handoffGameAccount({ gameId, baseURL: f.baseURL, username: ' @synthetic_user ' });
            assert.deepEqual(result, { requested: true });
            await ended;
            assert.deepEqual(messages, [{ type, username: 'synthetic_user' }]);
        });
    }
});

test('HTTP handoff waits for the endpoint acknowledgement', async t => {
    let received, acknowledge;
    const delivered = new Promise(resolve => { received = resolve; });
    const f = await fixture(t, async (req, res) => {
        assert.equal(req.method, 'POST');
        assert.equal(req.url, '/api/connect');
        acknowledge = () => res.end('{"ok":true}');
        received(await captureJSON(req));
    });
    let settled = false;
    const pending = handoffGameAccount({ gameId: 'tightrope-balance', baseURL: f.baseURL, username: 'tester' })
        .finally(() => { settled = true; });
    assert.deepEqual(await delivered, { username: 'tester' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(settled, false);
    acknowledge();
    assert.deepEqual(await pending, { requested: true });
});

test('frog fetches its token and sends the exact connect header and payload', async t => {
    const requests = [];
    let received;
    const delivered = new Promise(resolve => { received = resolve; });
    const f = await fixture(t, async (req, res) => {
        requests.push([req.method, req.url]);
        if (req.url === '/api/session') return res.end(JSON.stringify({ token: 'synthetic_token' }));
        assert.equal(req.headers['x-session-token'], 'synthetic_token');
        received(await captureJSON(req));
        res.end('{"ok":true}');
    });
    await handoffGameAccount({ gameId: 'frog-river', baseURL: f.baseURL, username: 'tester' });
    assert.deepEqual(await delivered, { username: 'tester' });
    assert.deepEqual(requests, [['GET', '/api/session'], ['POST', '/api/connect']]);
});

test('parent abort after a flushed HTTP request rejects and closes the outstanding transport', async t => {
    let received, closed;
    const delivered = new Promise(resolve => { received = resolve; });
    const disconnected = new Promise(resolve => { closed = resolve; });
    const f = await fixture(t, async (req, _res) => {
        req.socket.once('close', closed);
        await captureJSON(req);
        received();
    });
    const controller = new AbortController();
    const rejected = assert.rejects(handoffGameAccount({ gameId: 'tightrope-balance', baseURL: f.baseURL,
        username: 'tester', signal: controller.signal }), { name: 'AbortError' });
    await delivered;
    const start = Date.now();
    controller.abort();
    await rejected;
    await disconnected;
    assert.ok(Date.now() - start < 1000);
});

test('pony authenticates first on /live with a local Origin, then sends connect', async t => {
    const f = await fixture(t, (req, res) => {
        assert.equal(req.url, '/api/session');
        res.end(JSON.stringify({ token: 'pony_token' }));
    }, true);
    const messages = [];
    let finished;
    const closed = new Promise(resolve => { finished = resolve; });
    f.sockets.on('connection', (socket, req) => {
        assert.equal(req.url, '/live');
        assert.equal(req.headers.origin, f.baseURL);
        socket.on('message', raw => {
            const message = JSON.parse(raw);
            messages.push(message);
            socket.send(JSON.stringify({ live: message.token ? { status: 'disconnected', username: '' }
                : { status: 'connecting', username: 'tester' } }));
        });
        socket.on('close', finished);
    });
    await handoffGameAccount({ gameId: 'pony-life', baseURL: f.baseURL, username: 'tester' });
    await closed;
    assert.deepEqual(messages, [{ token: 'pony_token' }, { type: 'connect', username: 'tester' }]);
});

test('Frog rejects HTTP errors, negative acknowledgements and unrelated successful responses', async t => {
    for (const [statusCode, body, failure] of [
        [403, 'Forbidden', { code: 'EHTTP', statusCode: 403 }],
        [500, '{"ok":true}', { code: 'EHTTP', statusCode: 500 }],
        [200, '{"ok":false}', { code: 'EACCOUNT' }],
        [200, '{"status":"error"}', { code: 'EACCOUNT' }],
        [200, '{"unrelated":true}', { code: 'EPROTO' }],
        [200, '<html>game page</html>', { code: 'EPROTO' }],
        [204, '', { code: 'EPROTO' }]
    ]) {
        await t.test(`${statusCode} ${body}`, async t => {
            const f = await fixture(t, (req, res) => {
                if (req.url === '/api/session') return res.end('{"token":"synthetic_token"}');
                req.resume();
                req.once('end', () => {
                    res.writeHead(statusCode);
                    res.end(body);
                });
            });
            await assert.rejects(handoffGameAccount({ gameId: 'frog-river', baseURL: f.baseURL, username: 'tester' }), failure);
        });
    }
});

test('Orbit ignores the bootstrap status and accepts only a fresh acknowledgement for the requested account', async t => {
    const f = await fixture(t, undefined, true);
    f.sockets.on('connection', socket => {
        socket.send(JSON.stringify({ type: 'status', state: 'connected', username: 'tester' }));
        socket.on('message', () => {
            socket.send(JSON.stringify({ type: 'status', state: 'connecting', username: 'another_host' }));
            socket.send(JSON.stringify({ type: 'status', state: 'connected', username: 'tester' }));
        });
    });
    await assert.rejects(handoffGameAccount({ gameId: 'orbit', baseURL: f.baseURL, username: 'tester', timeoutMs: 150 }),
        { code: 'ETIMEDOUT' });
});

test('Puanlama accepts the structured response only for the requested account', async t => {
    const f = await fixture(t, undefined, true);
    f.sockets.on('connection', socket => {
        socket.send(JSON.stringify({ type: 'puanlamaStatus', state: 'disconnected' }));
        socket.on('message', () => {
            socket.send(JSON.stringify({ type: 'puanlamaStatus', state: 'connecting', username: 'other' }));
            setTimeout(() => {
                if (socket.readyState === socket.OPEN) {
                    socket.send(JSON.stringify({ type: 'puanlamaStatus', state: 'connecting', username: 'tester' }));
                }
            }, 30);
        });
    });
    assert.deepEqual(await handoffGameAccount({ gameId: 'puanlama', baseURL: f.baseURL, username: 'tester' }), { requested: true });
    await assert.rejects(handoffGameAccount({ gameId: 'puanlama', baseURL: f.baseURL, username: 'unrelated', timeoutMs: 150 }),
        { code: 'ETIMEDOUT' });
});

test('WebSocket rejection in the same response batch wins over a connecting status', async t => {
    const f = await fixture(t, undefined, true);
    f.sockets.on('connection', socket => {
        socket.send(JSON.stringify({ type: 'status', message: 'Sunucuya bağlanıldı, yayın kullanıcı adını gir.' }));
        socket.on('message', () => {
            socket.send(JSON.stringify({ type: 'status', message: '@tester yayınına bağlanılıyor...' }));
            socket.send(JSON.stringify({ type: 'status', message: 'Bağlanılamadı: internal failure' }));
        });
    });
    await assert.rejects(handoffGameAccount({ gameId: 'vs', baseURL: f.baseURL, username: 'tester' }), { code: 'EACCOUNT' });
});

test('all native bridges use the supplied dynamic port and safe session IDs', async t => {
    for (const gameId of ['snow-war', 'battle-royale', 'zombie-war', 'minecraft-snake-arena']) await t.test(gameId, async t => {
        let received;
        const delivered = new Promise(resolve => { received = resolve; });
        const f = await fixture(t, async (req, res) => {
            assert.equal(req.url, '/connect');
            assert.equal(req.headers.origin, undefined);
            received(await captureJSON(req));
            res.writeHead(202); res.end('{}');
        });
        await handoffGameAccount({ gameId, baseURL: f.baseURL, username: 'tester' });
        const body = await delivered;
        assert.equal(body.username, 'tester');
        assert.match(body.session, /^[a-f0-9-]{36}$/);
        assert.deepEqual(Object.keys(body).sort(), ['session', 'username']);
    });
});

test('native accepts a caller session ID and rejects unsafe values', async t => {
    let received;
    const delivered = new Promise(resolve => { received = resolve; });
    const f = await fixture(t, async (req, res) => { received(await captureJSON(req)); res.end('{}'); });
    await handoffGameAccount({ gameId: 'snow-war', baseURL: f.baseURL, username: 'tester', sessionId: 'owned_session-1' });
    assert.equal((await delivered).session, 'owned_session-1');
    await assert.rejects(handoffGameAccount({ gameId: 'snow-war', baseURL: f.baseURL, username: 'tester', sessionId: 'bad\r\nvalue' }), { code: 'EINVAL' });
});

test('empty account is a no-op; unsupported games and invalid names fail without transport', async () => {
    assert.deepEqual(await handoffGameAccount({ username: ' @ ' }), { requested: false });
    await assert.rejects(handoffGameAccount({ gameId: 'unknown', username: 'tester', baseURL: 'http://127.0.0.1' }), { code: 'ENOTSUP' });
    await assert.rejects(handoffGameAccount({ gameId: 'vs', username: 'bad user', baseURL: 'http://127.0.0.1' }), { code: 'EINVAL' });
});

test('remote, credentialed, redirected and unsupported protocol URLs are rejected', async t => {
    for (const baseURL of ['http://example.com:3000', 'http://192.168.1.1', 'http://127.0.0.1.example.com',
        'http://[::ffff:192.168.1.1]', 'file:///tmp/game', 'https://127.0.0.1', 'ftp://localhost',
        'http://user:password@127.0.0.1', 'http://127.0.0.1/path', 'http://127.0.0.1/?redirect=x', 'invalid']) {
        await assert.rejects(handoffGameAccount({ gameId: 'vs', baseURL, username: 'tester' }), { code: 'EINVAL' });
    }
    const f = await fixture(t, (_req, res) => { res.writeHead(302, { Location: 'http://example.com' }); res.end(); });
    await assert.rejects(handoffGameAccount({ gameId: 'frog-river', baseURL: f.baseURL, username: 'tester' }), { code: 'EHTTP' });
    await assert.rejects(handoffGameAccount({ gameId: 'vs', baseURL: f.baseURL, username: 'tester' }), { code: 'ETRANSPORT' });
});

test('invalid session JSON and tokens do not proceed to connect or leak response data', async t => {
    for (const body of ['not-json', '{}', '{"token":"bad token"}', '{"token":"secret\\r\\nvalue"}']) {
        const f = await fixture(t, (_req, res) => res.end(body));
        await assert.rejects(handoffGameAccount({ gameId: 'frog-river', baseURL: f.baseURL, username: 'tester' }), failure => {
            assert.equal(failure.code, 'EPROTO');
            assert.equal(failure.message.includes('secret'), false);
            return true;
        });
    }
});

test('abort works before transport and during HTTP and WebSocket handshakes', async t => {
    const prior = new AbortController(); prior.abort();
    await assert.rejects(handoffGameAccount({ gameId: 'vs', baseURL: 'http://127.0.0.1', username: 'tester', signal: prior.signal }), { name: 'AbortError' });
    for (const gameId of ['frog-river', 'vs']) {
        const f = await fixture(t, () => {});
        f.server.on('upgrade', () => {});
        const controller = new AbortController();
        const pending = handoffGameAccount({ gameId, baseURL: f.baseURL, username: 'tester', signal: controller.signal });
        const rejected = assert.rejects(pending, { name: 'AbortError' });
        setTimeout(() => controller.abort(), 20);
        await rejected;
    }
});

test('session and WebSocket transport handshakes have a five second deadline', async t => {
    const f = await fixture(t, () => {});
    f.server.on('upgrade', () => {});
    const start = Date.now();
    await Promise.all(['frog-river', 'vs'].map(gameId => assert.rejects(
        handoffGameAccount({ gameId, baseURL: f.baseURL, username: 'tester' }), { code: 'ETIMEDOUT' })));
    assert.ok(Date.now() - start >= 4900);
    assert.ok(Date.now() - start < 6500);
});
