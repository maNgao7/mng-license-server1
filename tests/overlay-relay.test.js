import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { readFileSync } from 'node:fs';
import express from "express";
import { WebSocket } from "ws";
import { registerOverlayRelay } from "../overlay-relay.js";
import { gzipSync, gunzipSync } from 'node:zlib';

const SECRET = randomBytes(32);
const INPUT = { licenseCode: "test-license", deviceId: "device-1", installationId: "install-1", channel: "creator" };
const ID = "12345678-1234-4234-9234-123456789abc";
const FILE = "/tikmng/media/file/" + ID;
const MOTION = '/widget/champion-motion.js';
const IMMUTABLE = 'private, max-age=31536000, immutable';
const sha256 = body => createHash('sha256').update(body).digest('hex');
const turn = () => new Promise(resolve => setImmediate(resolve));

function inbox(ws) {
    const frames = [], waiters = [];
    ws.on("message", data => {
        const frame = JSON.parse(data.toString());
        const index = waiters.findIndex(waiter => waiter.type === frame.type && waiter.predicate(frame));
        if (index < 0) frames.push(frame);
        else { const waiter = waiters.splice(index, 1)[0]; clearTimeout(waiter.timer); waiter.resolve(frame); }
    });
    return (type, predicate = () => true) => {
        const index = frames.findIndex(frame => frame.type === type && predicate(frame));
        if (index >= 0) return Promise.resolve(frames.splice(index, 1)[0]);
        return new Promise((resolve, reject) => {
            const waiter = { type, predicate, resolve };
            waiter.timer = setTimeout(() => { waiters.splice(waiters.indexOf(waiter), 1); reject(new Error("Missing " + type + " frame")); }, 4000);
            waiters.push(waiter);
        });
    };
}

async function fixture(t, options = {}) {
    const app = express();
    // Verify that generic security middleware cannot leak credentials or block embedding.
    app.use((req, res, next) => {
        res.setHeader("X-Frame-Options", "SAMEORIGIN");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        options.middleware?.(req, res);
        next();
    });
    const relay = registerOverlayRelay(app, { secret: SECRET, authorize: () => ({ ownerId: "owner-1" }), ...options });
    app.get("/health", (req, res) => res.end("ok"));
    const server = http.createServer(app);
    relay.attach(server);
    relay.attach(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    const requests = new Set(), sockets = new Set();
    t.after(async () => {
        t.mock.timers.reset();
        for (const req of requests) req.destroy();
        for (const ws of sockets) ws.terminate();
        await relay.close();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    });
    function start(route, { method = "GET", headers = {}, body } = {}) {
        const req = http.request(base + route, { method, headers });
        requests.add(req);
        req.on("error", () => {});
        req.once("close", () => requests.delete(req));
        req.setTimeout(6000, () => req.destroy(new Error("HTTP test timed out")));
        const response = once(req, "response").then(([res]) => res);
        req.end(body);
        return { req, response };
    }
    async function read(route, options) {
        const { response } = start(route, options);
        const res = await response;
        const chunks = [];
        for await (const chunk of res) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        return { status: res.statusCode, headers: res.headers, body, text: body.toString() };
    }
    async function session(patch = {}) {
        const response = await read("/api/overlay/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...INPUT, ...patch }) });
        assert.equal(response.status, 200, response.text);
        return JSON.parse(response.text);
    }
    async function connect(ticket, { route = "/api/overlay/bridge", headers = {}, ...extra } = {}) {
        const ws = new WebSocket(base.replace("http:", "ws:") + route, {
            headers: { ...(ticket ? { Authorization: "Bearer " + ticket } : {}), ...headers }, ...extra
        });
        sockets.add(ws);
        ws.on("error", () => {});
        const next = inbox(ws);
        await once(ws, "open");
        return { ws, next, send: frame => ws.send(JSON.stringify(frame)) };
    }
    async function rejectUpgrade(ticket, route = "/api/overlay/bridge", headers = {}) {
        const ws = new WebSocket(base.replace("http:", "ws:") + route, { headers: { ...(ticket ? { Authorization: "Bearer " + ticket } : {}), ...headers } });
        sockets.add(ws);
        ws.on("error", () => {});
        return new Promise((resolve, reject) => {
            ws.once("unexpected-response", (req, res) => { res.resume(); ws.terminate(); resolve(res.statusCode); });
            ws.once("open", () => { ws.terminate(); reject(new Error("Unauthorized upgrade succeeded")); });
        });
    }
    return { base, server, relay, start, read, session, connect, rejectUpgrade };
}

function respond(publisher, request, body = "ok", headers = {}, status = 200) {
    const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
    publisher.send({ type: "headers", id: request.id, status, headers: { "content-type": "text/plain", "content-length": String(bytes.length), ...headers } });
    if (bytes.length) publisher.send({ type: "chunk", id: request.id, data: bytes.toString("base64") });
    publisher.send({ type: "end", id: request.id });
}

test('signed cinematic paths forward exact modules and artwork but reject unknown or unsafe files', async t => {
    const f = await fixture(t), session = await f.session(), publisher = await f.connect(session.ticket);
    const revision = 'a'.repeat(64);
    const modules = ['three.module.js','three.core.js','FontLoader.js','TextGeometry.js','RoomEnvironment.js','font.json',
        'pk-impact.js','premium-scenes.js','legacy-scenes.js','pk-character-rig.js','jar-silhouettes.js','loot-opening.js','loot-model.js',
        'assets/pk-expressions-v2.png','assets/pk-companions-v1.png','assets/pk-dragon-wings-v1.png','assets/pk-gloves-atlas.png',
        'assets/jar-mascots-animated-v3.png','posters/notification-sultan.webp'];
    for (const file of modules) for (const version of ['', revision + '/']) {
        const route = '/widget/cinematic/' + version + file;
        const pending = f.read(session.path + route);
        const request = await publisher.next('request');
        assert.equal(new URL(request.path, f.base).pathname, route);
        assert.equal(new URL(request.path, f.base).searchParams.get('channel'), INPUT.channel);
        const body = Buffer.from('fixture-' + file);
        respond(publisher, request, body, {'content-type':file.endsWith('.js')?'text/javascript; charset=utf-8':'application/octet-stream'});
        const response = await pending;
        assert.equal(response.status, 200);assert.deepEqual(response.body, body);
        assert.equal(response.headers['access-control-allow-origin'], '*');
    }
    for (const file of ['secret.js','assets/unknown.png','posters/bad_name.webp','../server.js','assets/%2e%2e/server.js','pk-impact.js/extra']) {
        assert.equal((await f.read(session.path + '/widget/cinematic/' + file)).status,404,file);
    }
    const other = await f.session({channel:'other'});
    assert.equal((await f.read(other.path + '/widget/cinematic/pk-impact.js')).status,503);
    assert.equal(publisher.ws.readyState, WebSocket.OPEN);
});

test('state gzip reduces wire bytes without changing JSON, scopes or private cache policy', async t => {
    const f = await fixture(t), session = await f.session(), publisher = await f.connect(session.ticket);
    const body = JSON.stringify({ channel: INPUT.channel, topLikes: Array.from({ length: 100 }, (_, i) =>
        ({ username: 'viewer-' + i, totalLikes: i, avatar: '/widget/gift-assets/portrait-' + ID + '.png' })) });
    const pending = f.read(session.path + '/api/widget/state?type=topliker', { headers: { 'Accept-Encoding': 'gzip' } });
    const request = await publisher.next('request');
    assert.match(request.path, /channel=creator/);
    respond(publisher, request, body, { 'content-type': 'application/json; charset=utf-8' });
    const response = await pending;
    assert.equal(response.headers['content-encoding'], 'gzip');
    assert.equal(response.headers.vary, 'Accept-Encoding');
    assert.equal(response.headers['content-length'], undefined);
    assert.equal(response.headers['cache-control'], 'no-store, no-transform');
    assert.equal(gunzipSync(response.body).toString(), body);
    assert.ok(response.body.length < Buffer.byteLength(body) / 5);
});

test('state gzip honours negotiation and excludes media, SSE, ranges, small bodies and no-body statuses', async t => {
    const f = await fixture(t), session = await f.session(), publisher = await f.connect(session.ticket);
    for (const [route, encoding, type, status, extra, body] of [
        ['/api/widget/state', 'gzip;q=0, identity', 'application/json', 200, {}, 'x'.repeat(2048)],
        ['/api/widget/state', '', 'application/json', 200, {}, 'x'.repeat(2048)],
        ['/api/widget/state', 'br', 'application/json', 200, {}, 'x'.repeat(2048)],
        ['/api/widget/state', 'gzip', 'application/json', 200, {}, '{}'],
        ['/api/widget/state', 'gzip', 'application/json', 204, {}, ''],
        ['/api/widget/state', 'gzip', 'application/json', 404, {}, 'x'.repeat(2048)],
        ['/api/widget/state', 'gzip', 'application/json', 206, { 'content-range': 'bytes 0-2047/4096' }, 'x'.repeat(2048)],
        ['/tikmng/media/poll', 'gzip', 'application/json', 200, {}, 'x'.repeat(2048)],
        ['/tikmng/media/events', 'gzip', 'text/event-stream', 200, {}, 'data: test\n\n'],
        [FILE, 'gzip', 'video/mp4', 200, {}, 'x'.repeat(2048)]
    ]) {
        const pending = f.read(session.path + route, { headers: { 'Accept-Encoding': encoding } });
        const request = await publisher.next('request');
        respond(publisher, request, body, { 'content-type': type, ...extra }, status);
        const response = await pending;
        assert.equal(response.headers['content-encoding'], undefined, route + ':' + encoding);
        assert.equal(response.text, body);
    }
});

test('compressed chunked state streams validate original length and cancel cleanly', async t => {
    const f = await fixture(t), session = await f.session(), publisher = await f.connect(session.ticket);
    const body = JSON.stringify({ rows: Array(2000).fill({ score: 100, name: 'Test profile' }) });
    const pending = f.read(session.path + '/widget/state', { headers: { 'Accept-Encoding': 'gzip' } });
    const request = await publisher.next('request');
    publisher.send({ type: 'headers', id: request.id, status: 200, headers: { 'content-type': 'application/json' } });
    const bytes = Buffer.from(body);
    for (let start = 0; start < bytes.length; start += 4096)
        publisher.send({ type: 'chunk', id: request.id, data: bytes.subarray(start, start + 4096).toString('base64') });
    publisher.send({ type: 'end', id: request.id });
    const response = await pending;
    assert.equal(gunzipSync(response.body).toString(), body);
    const abandoned = f.start(session.path + '/api/widget/state', { headers: { 'Accept-Encoding': 'gzip' } });
    const next = await publisher.next('request');
    publisher.send({ type: 'headers', id: next.id, status: 200, headers: { 'content-type': 'application/json' } });
    await abandoned.response;
    abandoned.req.destroy();
    await publisher.next('cancel', frame => frame.id === next.id);
});

test('named widget documents keep separate paths through the relay', async t => {
    const f = await fixture(t), session = await f.session();
    assert.equal(session.namedWidgetPaths, true);
    const paths = ['coinjar', 'raconking', 'topliker'].map(id => '/widget/view/' + id);
    for (const path of paths) {
        const offline = await f.read(session.path + path);
        assert.equal(offline.status, 503);
        assert.match(offline.text, /location\.reload/);
    }
    const publisher = await f.connect(session.ticket);
    for (const path of paths) {
        const response = f.read(session.path + path);
        const request = await publisher.next('request');
        assert.equal(request.path, path + '?channel=' + INPUT.channel);
        publisher.send({ type: 'headers', id: request.id, status: 200, headers: { 'content-type': 'text/html' } });
        publisher.send({ type: 'chunk', id: request.id, data: Buffer.from(path).toString('base64') });
        publisher.send({ type: 'end', id: request.id });
        assert.equal((await response).text, path);
    }
    assert.equal((await f.read(session.path + '/widget/view/coinjar/extra')).status, 404);
});

test('successful widget HTML saves wire bytes with exact gzip decoding and remains no-store', async t => {
    const f = await fixture(t), session = await f.session(), publisher = await f.connect(session.ticket);
    const html = Buffer.from('<!doctype html><html><body>' + '<section class="gallery">Gift artwork</section>'.repeat(4000) + '</body></html>');
    for (const route of ['/widget-overlay.html', '/widget/overlay', '/widget/top-gift.html', '/widget-leaderboard.html', '/widget/view/coinjar']) {
        const pending = f.read(session.path + route, { headers: { 'Accept-Encoding': 'gzip' } });
        const request = await publisher.next('request');
        publisher.send({ type: 'headers', id: request.id, status: 200, headers: { 'content-type': 'text/html; charset=utf-8',
            'content-length': String(html.length), 'cache-control': IMMUTABLE } });
        for (let start = 0; start < html.length; start += 16384) {
            publisher.send({ type: 'chunk', id: request.id, data: html.subarray(start, start + 16384).toString('base64') });
            await turn();
        }
        publisher.send({ type: 'end', id: request.id });
        const response = await pending;
        assert.deepEqual(gunzipSync(response.body), html);
        assert.equal(response.headers['content-encoding'], 'gzip');
        assert.equal(response.headers['content-length'], undefined);
        assert.equal(response.headers.vary, 'Accept-Encoding');
        assert.equal(response.headers['cache-control'], 'no-store, no-transform');
        assert.ok(response.body.length < html.length / 10);
        if (route === '/widget-overlay.html') t.diagnostic('Widget HTML gzip: ' + html.length + ' -> ' + response.body.length + ' wire body bytes, exact decode.');
    }
});

test('widget HTML gzip excludes unaccepted encoding, HEAD, ranges, preencoded bodies, errors and media documents', async t => {
    const f = await fixture(t), session = await f.session(), publisher = await f.connect(session.ticket);
    const body = Buffer.from('<div>widget</div>'.repeat(200));
    for (const [route, client, status = 200, upstream = {}, bytes = body, method = 'GET'] of [
        ['/widget-overlay.html', { 'Accept-Encoding': 'gzip;q=0' }],
        ['/widget-overlay.html', { 'Accept-Encoding': 'gzip' }, 200, {}, Buffer.from('<div>small</div>')],
        ['/widget-overlay.html', { 'Accept-Encoding': 'gzip' }, 200, {}, body, 'HEAD'],
        ['/widget-overlay.html', { 'Accept-Encoding': 'gzip', Range: 'bytes=0-99' }],
        ['/widget-overlay.html', { 'Accept-Encoding': 'gzip' }, 206, { 'content-range': 'bytes 0-99/9000' }],
        ['/widget-overlay.html', { 'Accept-Encoding': 'gzip' }, 200, { 'Content-Encoding': 'gzip' }, gzipSync(body)],
        ['/widget-overlay.html', { 'Accept-Encoding': 'gzip' }, 404],
        ['/widget-overlay.html', { 'Accept-Encoding': 'gzip' }, 204, {}, Buffer.alloc(0)],
        ['/tikmng/media', { 'Accept-Encoding': 'gzip' }],
        [MOTION, { 'Accept-Encoding': 'gzip' }]
    ]) {
        const pending = f.read(session.path + route, { method, headers: client }), request = await publisher.next('request');
        respond(publisher, request, bytes, { 'content-type': 'text/html', ...upstream }, status);
        const response = await pending;
        assert.equal(response.headers['content-encoding'], upstream['Content-Encoding']);
        assert.deepEqual(response.body, method === 'HEAD' ? Buffer.alloc(0) : bytes);
        assert.equal(response.headers['cache-control'], 'no-store, no-transform');
    }
});

function signClaims(claims) {
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    return payload + "." + createHmac("sha256", SECRET).update("overlay-ticket-v1:" + payload).digest("base64url");
}

test('hashed bundled JS and viral WebP retain only a publisher-confirmed private immutable cache', async t => {
    const f = await fixture(t), session = await f.session(), publisher = await f.connect(session.ticket);
    const script = Buffer.from('window.championMotion = "' + 'motion-'.repeat(1000) + '";');
    const image = Buffer.from('test-WebP-bytes');
    for (const [route, body, type, encoding] of [
        [MOTION + '?v=' + sha256(script), script, 'application/javascript; charset=utf-8', 'gzip'],
        [MOTION + '?v=' + sha256(script), script, 'text/javascript', 'identity'],
        ['/widget/gift-assets/viral-gift-name_' + '-'.repeat(2) + '-' + sha256(image) + '.webp', image, 'image/webp', 'gzip']
    ]) {
        const pending = f.read(session.path + route + (route.includes('?') ? '&' : '?') + 'key=discard&channel=creator', {
            headers: { 'Accept-Encoding': encoding, Cookie: 'admin=secret', Authorization: 'Bearer secret' }
        });
        const request = await publisher.next('request');
        const query = new URL(request.path, f.base).searchParams;
        assert.equal(query.get('channel'), INPUT.channel);
        assert.equal(query.has('key'), false);
        assert.deepEqual(request.headers, { 'x-tikmng-overlay-base': session.path });
        respond(publisher, request, body, { 'content-type': type, 'Cache-Control': IMMUTABLE, 'set-cookie': 'secret=1' });
        const response = await pending;
        const compressed = route.startsWith(MOTION) && encoding === 'gzip';
        assert.equal(response.headers['content-encoding'], compressed ? 'gzip' : undefined);
        assert.equal(response.headers['cache-control'], IMMUTABLE + ', no-transform');
        assert.equal(response.headers['set-cookie'], undefined);
        assert.deepEqual(compressed ? gunzipSync(response.body) : response.body, body);
        assert.equal(response.headers['content-length'], compressed ? undefined : String(body.length));
        if (route.startsWith(MOTION)) assert.equal(response.headers.vary, 'Accept-Encoding');
        if (compressed) assert.ok(response.body.length < body.length / 10);
    }
});

test('release-sized bundles retain exact bytes and private caching over real WS chunk frames', async t => {
    const f = await fixture(t), session = await f.session(), publisher = await f.connect(session.ticket);
    const script = process.env.OVERLAY_RELAY_BUNDLE_FILE ? readFileSync(process.env.OVERLAY_RELAY_BUNDLE_FILE) : Buffer.alloc(514708, 32);
    if (!process.env.OVERLAY_RELAY_BUNDLE_FILE) {
        Buffer.from('/*' + randomBytes(256 * 1024).toString('base64')).copy(script);
        const tail = Buffer.from('*/\nwindow.championMotion = true;'); tail.copy(script, script.length - tail.length);
    }
    const image = process.env.OVERLAY_RELAY_ASSET_FILE ? readFileSync(process.env.OVERLAY_RELAY_ASSET_FILE) : randomBytes(1800000);
    for (const [route, body, type, compressed] of [
        [MOTION + '?v=' + sha256(script), script, 'text/javascript', true],
        ['/widget/gift-assets/viral-gold-' + sha256(image) + '.webp', image, 'image/webp', false]
    ]) {
        const pending = f.read(session.path + route, { headers: { 'Accept-Encoding': 'gzip' } });
        const request = await publisher.next('request');
        publisher.send({ type: 'headers', id: request.id, status: 200, headers: { 'content-type': type,
            'content-length': String(body.length), 'cache-control': IMMUTABLE } });
        for (let start = 0; start < body.length; start += 32768) {
            publisher.send({ type: 'chunk', id: request.id, data: body.subarray(start, start + 32768).toString('base64') });
            await turn();
        }
        publisher.send({ type: 'end', id: request.id });
        const response = await pending;
        assert.equal(response.status, 200);
        assert.equal(response.headers['cache-control'], IMMUTABLE + ', no-transform');
        assert.equal(response.headers['content-encoding'], compressed ? 'gzip' : undefined);
        assert.deepEqual(compressed ? gunzipSync(response.body) : response.body, body);
        if (compressed) {
            assert.ok(response.body.length < body.length);
            t.diagnostic((process.env.OVERLAY_RELAY_BUNDLE_FILE ? 'Actual module' : 'Module-size fixture') + ': ' + body.length + ' -> ' + response.body.length + ' wire body bytes; SHA256 ' + sha256(body) + '; exact decode.');
        } else {
            assert.equal(response.headers['content-length'], String(body.length));
            t.diagnostic('WebP' + (process.env.OVERLAY_RELAY_ASSET_FILE ? '' : '-size fixture') + ': ' + body.length + ' unchanged wire body bytes, no recompression.');
        }
    }
});

test('immutable cache rejects ambiguous versions, non-hash artwork, legacy publishers and unrelated routes', async t => {
    const f = await fixture(t), session = await f.session(), publisher = await f.connect(session.ticket);
    const hash = 'b'.repeat(64), asset = '/widget/gift-assets/viral-crown-' + hash + '.webp';
    for (const [route, type, policy = IMMUTABLE, status = 200] of [
        [MOTION, 'text/javascript'],
        [MOTION + '?v=', 'text/javascript'],
        [MOTION + '?v=' + hash.slice(1), 'text/javascript'],
        [MOTION + '?v=' + hash + 'b', 'text/javascript'],
        [MOTION + '?v=' + hash.toUpperCase(), 'text/javascript'],
        [MOTION + '?v=' + hash + '&v=' + hash, 'text/javascript'],
        [MOTION + '?v=' + hash + '&unknown=1', 'text/javascript'],
        [MOTION + '?v=' + hash, 'text/html'],
        [MOTION + '?v=' + hash, 'text/javascript', 'no-store'],
        [MOTION + '?v=' + hash, 'text/javascript', 'public, max-age=31536000, immutable'],
        [MOTION + '?v=' + hash, 'text/javascript', 'private, max-age=3600'],
        [MOTION + '?v=' + hash, 'text/javascript', IMMUTABLE, 404],
        [asset + '?unknown=1', 'image/webp'],
        [asset, 'image/png'],
        [asset, 'image/webp', IMMUTABLE, 404],
        [asset.replace('crown-', 'crown.v2-'), 'image/webp'],
        [asset.replace(hash, hash.toUpperCase()), 'image/webp'],
        [asset.replace(hash, hash.slice(1)), 'image/webp'],
        [asset.replace('viral-', ''), 'image/webp'],
        [asset.replace('.webp', '.png'), 'image/png'],
        ['/widget/gift-assets/7934.webp', 'image/webp'],
        ['/api/widget/state?v=' + hash, 'application/json'],
        ['/widget-overlay.html?v=' + hash, 'text/html'],
        ['/widget/physical-jar.js?v=' + hash, 'text/javascript']
    ]) {
        const pending = f.read(session.path + route), request = await publisher.next('request');
        respond(publisher, request, 'unchanged', { 'content-type': type, 'cache-control': policy }, status);
        assert.equal((await pending).headers['cache-control'], 'no-store, no-transform', route + ':' + policy);
    }
    for (const route of [MOTION + '.map', '/widget/%63hampion-motion.js', '/widget/gift-assets/%2e%2e%2f' + asset.split('/').at(-1)]) {
        assert.equal((await f.read(session.path + route)).status, 404, route);
    }
});

test('bundled JS gzip skips ranges, encodings, HEAD, errors, non-JS and non-negotiating clients', async t => {
    const f = await fixture(t), session = await f.session(), publisher = await f.connect(session.ticket);
    const body = Buffer.from('const motion = "' + 'test'.repeat(1000) + '";');
    const route = session.path + MOTION + '?v=' + sha256(body);
    for (const [client, type = 'text/javascript', status = 200, upstream = {}, bytes = body, method = 'GET'] of [
        [{ 'Accept-Encoding': 'gzip;q=0, identity' }],
        [{ 'Accept-Encoding': 'br' }],
        [{}],
        [{ 'Accept-Encoding': 'gzip' }, 'text/javascript', 200, {}, Buffer.from('small')],
        [{ 'Accept-Encoding': 'gzip' }, 'text/javascript', 404],
        [{ 'Accept-Encoding': 'gzip' }, 'text/html'],
        [{ 'Accept-Encoding': 'gzip', Range: 'bytes=0-99' }],
        [{ 'Accept-Encoding': 'gzip' }, 'text/javascript', 206, { 'content-range': 'bytes 0-99/9000' }],
        [{ 'Accept-Encoding': 'gzip' }, 'text/javascript', 200, { 'content-range': 'bytes 0-99/9000' }],
        [{ 'Accept-Encoding': 'gzip' }, 'text/javascript', 200, { 'Content-Encoding': 'gzip' }, gzipSync(body)],
        [{ 'Accept-Encoding': 'gzip' }, 'text/javascript', 200, {}, body, 'HEAD'],
        [{ 'Accept-Encoding': 'gzip' }, 'text/javascript', 204, {}, Buffer.alloc(0)],
        [{ 'Accept-Encoding': 'gzip' }, 'text/javascript', 304, {}, Buffer.alloc(0)]
    ]) {
        const pending = f.read(route, { method, headers: client }), request = await publisher.next('request');
        assert.equal(request.headers.range, client.Range);
        respond(publisher, request, bytes, { 'content-type': type, 'cache-control': IMMUTABLE, ...upstream }, status);
        const response = await pending;
        assert.equal(response.headers['content-encoding'], upstream['Content-Encoding']);
        assert.deepEqual(response.body, method === 'HEAD' ? Buffer.alloc(0) : bytes);
        if (method !== 'HEAD' && ![204, 304].includes(status)) assert.equal(response.headers['content-length'], String(bytes.length));
        if (client.Range || upstream['content-range'] || status !== 200 || type === 'text/html')
            assert.equal(response.headers['cache-control'], 'no-store, no-transform');
    }
});

test('new bundle routes preserve signed publisher authorization, scope and revocation', async t => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: Date.now() });
    let allowed = true;
    const f = await fixture(t, { revalidate: () => allowed }), session = await f.session();
    assert.equal(await f.rejectUpgrade(), 401);
    assert.equal(await f.rejectUpgrade(session.ticket.slice(0, -1) + (session.ticket.endsWith('A') ? 'B' : 'A')), 401);
    const publisher = await f.connect(session.ticket);
    const routes = [MOTION + '?v=' + 'a'.repeat(64), '/widget/gift-assets/viral-crown-' + 'a'.repeat(64) + '.webp'];
    for (const route of routes) {
        assert.equal((await f.read(route)).status, 404);
        assert.equal((await f.read('/overlays/' + 'x'.repeat(43) + route)).status, 503);
        const scoped = session.path + route + (route.includes('?') ? '&' : '?');
        for (const [query, status] of [['channel=other', 403], ['channel=creator&channel=creator', 400], ['key=a&key=b', 400]])
            assert.equal((await f.read(scoped + query)).status, status);
    }
    const ping = once(publisher.ws, 'ping');
    t.mock.timers.tick(30000);
    await ping;
    const pong = once(publisher.ws, 'pong');
    publisher.ws.ping();
    await pong;
    allowed = false;
    const closed = once(publisher.ws, 'close');
    t.mock.timers.tick(30000);
    await closed;
    for (const route of [...routes, '/api/widget/state']) {
        const response = await f.read(session.path + route);
        assert.equal(response.status, 503);
        assert.equal(response.headers['cache-control'], 'no-store, no-transform');
    }
    assert.equal(await f.rejectUpgrade(session.ticket), 403);
});

test('compressed bundled JS validates original lengths, supports unknown lengths and cancels on disconnect', async t => {
    const f = await fixture(t), session = await f.session(), publisher = await f.connect(session.ticket);
    const body = Buffer.from('export const motion = "' + 'frame'.repeat(3000) + '";');
    const route = session.path + MOTION + '?v=' + sha256(body);
    const pending = f.read(route, { headers: { 'Accept-Encoding': 'gzip' } });
    const request = await publisher.next('request');
    publisher.send({ type: 'headers', id: request.id, status: 200, headers: { 'content-type': 'text/javascript' } });
    for (let start = 0; start < body.length; start += 4096)
        publisher.send({ type: 'chunk', id: request.id, data: body.subarray(start, start + 4096).toString('base64') });
    publisher.send({ type: 'end', id: request.id });
    assert.deepEqual(gunzipSync((await pending).body), body);
    for (const length of [body.length - 1, body.length + 1]) {
        const started = f.start(route, { headers: { 'Accept-Encoding': 'gzip' } });
        const next = await publisher.next('request');
        publisher.send({ type: 'headers', id: next.id, status: 200, headers: { 'content-type': 'text/javascript', 'content-length': String(length) } });
        const response = await started.response;
        const incomplete = (async () => {
            try { for await (const chunk of response) {} return false; } catch { return true; }
        })();
        publisher.send({ type: 'chunk', id: next.id, data: body.toString('base64') });
        publisher.send({ type: 'end', id: next.id });
        await publisher.next('cancel', frame => frame.id === next.id);
        assert.equal(await incomplete, true, 'A mismatched original length must abort compressed output');
    }
    const abandoned = f.start(route, { headers: { 'Accept-Encoding': 'gzip' } });
    const next = await publisher.next('request');
    publisher.send({ type: 'headers', id: next.id, status: 200, headers: { 'content-type': 'text/javascript' } });
    await abandoned.response;
    abandoned.req.destroy();
    await publisher.next('cancel', frame => frame.id === next.id);
    assert.equal(publisher.ws.readyState, WebSocket.OPEN);
});

test('only revision-scoped private media may cache; state, HTML, duplicates and redirects never cache', async t => {
    const f = await fixture(t), session = await f.session(), publisher = await f.connect(session.ticket);
    const revision = 'a'.repeat(24);
    for (const [route, cache, status = 200] of [
        [FILE + '?revision=' + revision, true],
        [FILE, false],
        [FILE + '?revision=' + revision + '&revision=' + revision, false],
        [FILE + '?revision=' + revision + '&unknown=1', false],
        ['/api/widget/state?revision=' + revision, false],
        ['/tikmng/media?revision=' + revision, false],
        [FILE + '?revision=' + revision, false, 404]
    ]) {
        const pending = f.read(session.path + route);
        const request = await publisher.next('request');
        respond(publisher, request, 'test', { 'cache-control': 'private, max-age=3600' }, status);
        const response = await pending;
        assert.equal(response.headers['cache-control'], cache ? 'private, max-age=3600, no-transform' : 'no-store, no-transform');
    }
});

test('static gift artwork can use a private cache, but errors, HTML and live state never do', async t => {
    const f=await fixture(t),session=await f.session(),publisher=await f.connect(session.ticket);
    for(const [route,type,status,cache] of [
        ['/widget/gift-assets/racon-list-seat-v2.png','image/png',200,true],
        ['/widget/gift-assets/7934.png','image/png',200,true],
        ['/widget/gift-assets/7934.png','image/png',404,false],
        ['/widget/gift-assets/7934.png','text/html',200,false],
        ['/api/widget/state','image/png',200,false],
        ['/widget-overlay.html','text/html',200,false]
    ]){
        const pending=f.read(session.path+route),request=await publisher.next('request');
        respond(publisher,request,'test',{'content-type':type,'cache-control':'public, max-age=86400'},status);
        const response=await pending;
        assert.equal(response.headers['cache-control'],cache?'private, max-age=3600, no-transform':'no-store, no-transform');
    }
});

test('new private media cache age and empty change responses survive the relay unchanged', async t => {
    const f=await fixture(t),session=await f.session(),publisher=await f.connect(session.ticket);
    let pending=f.read(session.path+FILE+'?revision='+'a'.repeat(24)),request=await publisher.next('request');
    respond(publisher,request,'unchanged-original-video',{'cache-control':'private, max-age=86400','content-type':'video/mp4'});
    let response=await pending;assert.equal(response.headers['cache-control'],'private, max-age=86400, no-transform');assert.equal(response.text,'unchanged-original-video');
    pending=f.read(session.path+'/api/widget/state?transport=changes&after='+'b'.repeat(32));request=await publisher.next('request');
    assert.match(request.path,/transport=changes/);respond(publisher,request,'',{'content-type':'application/json'},204);
    response=await pending;assert.equal(response.status,204);assert.equal(response.body.length,0);assert.equal(response.headers['cache-control'],'no-store, no-transform');
    pending=f.read(session.path+'/tikmng/media/poll?client='+ID+'&wait=1');request=await publisher.next('request');assert.match(request.path,/wait=1/);
    respond(publisher,request,'{"events":[]}',{'content-type':'application/json'});assert.equal((await pending).status,200);
});

test('original private portrait images retain a browser-only cache without caching live state', async t => {
    const f = await fixture(t), session = await f.session(), publisher = await f.connect(session.ticket);
    const portrait = '/widget/gift-assets/portrait-' + ID + '.png';
    for (const [route, contentType, status, cache] of [
        [portrait, 'image/jpeg', 200, true],
        [portrait, 'image/png', 404, false],
        [portrait, 'text/html', 200, false],
        ['/widget/gift-assets/7934.png', 'image/png', 200, false],
        ['/api/widget/state', 'application/json', 200, false],
        [FILE, 'image/jpeg', 200, false]
    ]) {
        const pending = f.read(session.path + route), request = await publisher.next('request');
        respond(publisher, request, 'original-portrait-bytes', { 'content-type': contentType, 'cache-control': 'private, max-age=86400' }, status);
        const response = await pending;
        assert.equal(response.headers['cache-control'], cache ? 'private, max-age=86400, no-transform' : 'no-store, no-transform');
        assert.equal(response.text, 'original-portrait-bytes');
    }
});

test('a real browser reuses an original portrait instead of downloading it after each DOM replacement', {
    skip: !process.env.OVERLAY_RELAY_PLAYWRIGHT
}, async t => {
    const { chromium } = await import(pathToFileURL(process.env.OVERLAY_RELAY_PLAYWRIGHT).href);
    const f = await fixture(t), session = await f.session(), publisher = await f.connect(session.ticket);
    const portrait = '/widget/gift-assets/portrait-' + ID + '.png';
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZQkAAAAASUVORK5CYII=', 'base64');
    let downloads = 0;
    publisher.ws.on('message', raw => {
        const request = JSON.parse(raw); if (request.type !== 'request') return;
        if (request.path.split('?')[0] === portrait) { downloads++; respond(publisher, request, png, { 'content-type': 'image/png', 'cache-control': 'private, max-age=86400' }); }
        else respond(publisher, request, `<img src="${session.path + portrait}">`, { 'content-type': 'text/html' });
    });
    const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
    try {
        const context = await browser.newContext(), page = await context.newPage();
        await page.goto(f.base + session.path + '/widget-overlay.html');
        await page.locator('img').evaluate(img => img.decode());
        await page.locator('img').evaluate(async img => { const next = new Image(); next.src = img.src; img.replaceWith(next); await next.decode(); });
        assert.equal(downloads, 1, 'Same photo must come from the browser cache');
        const isolated = await browser.newContext(), other = await isolated.newPage();
        await other.goto(f.base + session.path + '/widget-overlay.html'); await other.locator('img').evaluate(img => img.decode());
        assert.equal(downloads, 2, 'An independent browser context obtains its own private copy');
    } finally { await browser.close(); }
});

test('a real browser privately reuses repeated hashed bundle loads while state stays fresh', {
    skip: !process.env.OVERLAY_RELAY_PLAYWRIGHT
}, async t => {
    const { chromium } = await import(pathToFileURL(process.env.OVERLAY_RELAY_PLAYWRIGHT).href);
    const f = await fixture(t), session = await f.session(), publisher = await f.connect(session.ticket);
    const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
    try {
        const context = await browser.newContext(), page = await context.newPage();
        const webp = Buffer.from(await page.evaluate(() => {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 2;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#16aa75'; ctx.fillRect(0, 0, 2, 2);
            return canvas.toDataURL('image/webp').split(',')[1];
        }), 'base64');
        const asset = '/widget/gift-assets/viral-crown-' + sha256(webp) + '.webp';
        const statePath = session.path + '/api/widget/state?type=topliker';
        const source = version => `window.motionVersion = ${version};\n` +
            '/* bundled motion frame */\n'.repeat(300) +
            `fetch('${statePath}').then(r=>r.json()).then(state=>{document.querySelector('#result').textContent=String(state.value);});`;
        let script = source(1), documents = 0, states = 0, images = 0;
        const modules = [];
        const csp = "default-src 'none'; script-src 'nonce-bundle123'; img-src 'self'; connect-src 'self'";
        publisher.ws.on('message', raw => {
            const request = JSON.parse(raw); if (request.type !== 'request') return;
            const url = new URL(request.path, f.base);
            if (url.pathname === '/widget-overlay.html') {
                documents++;
                respond(publisher, request, `<div id="result">waiting</div><img src="${session.path + asset}"><script nonce="bundle123" src="${session.path + MOTION}?v=${sha256(script)}"></script>`,
                    { 'content-type': 'text/html', 'content-security-policy': csp, 'cache-control': IMMUTABLE });
            } else if (url.pathname === MOTION) {
                modules.push(url.searchParams.get('v'));
                respond(publisher, request, script, { 'content-type': 'text/javascript',
                    'cache-control': url.searchParams.get('v') === sha256(script) ? IMMUTABLE : 'no-store' });
            } else if (url.pathname === asset) {
                images++;
                respond(publisher, request, webp, { 'content-type': 'image/webp', 'cache-control': IMMUTABLE });
            } else if (url.pathname === '/api/widget/state') {
                respond(publisher, request, JSON.stringify({ value: ++states }), { 'content-type': 'application/json', 'cache-control': IMMUTABLE });
            } else respond(publisher, request, 'missing', {}, 404);
        });
        const visit = async (target, expected) => {
            const document = await target.goto(f.base + session.path + '/widget-overlay.html?load=' + expected);
            assert.equal(document.headers()['cache-control'], 'no-store, no-transform');
            await target.locator('#result').filter({ hasText: String(expected) }).waitFor({ timeout: 10000 });
            await target.locator('img').evaluate(img => img.decode());
        };
        const firstModule = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(MOTION));
        const firstImage = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(asset));
        await visit(page, 1);
        const moduleResponse = await firstModule, imageResponse = await firstImage;
        assert.equal(moduleResponse.headers()['content-encoding'], 'gzip');
        assert.equal(moduleResponse.headers()['cache-control'], IMMUTABLE + ', no-transform');
        assert.equal(moduleResponse.headers().vary, 'Accept-Encoding');
        assert.equal(await moduleResponse.text(), script);
        assert.deepEqual(await imageResponse.body(), webp);
        assert.equal(imageResponse.headers()['cache-control'], IMMUTABLE + ', no-transform');
        const loadAssets = async expected => {
            await page.evaluate(async ({ script, asset }) => {
                const image = new Image(); image.src = asset;
                document.querySelector('img').replaceWith(image);
                const next = document.createElement('script'); next.nonce = 'bundle123'; next.src = script;
                document.body.append(next);
                await image.decode();
            }, { script: session.path + MOTION + '?v=' + sha256(script), asset: session.path + asset });
            await page.locator('#result').filter({ hasText: String(expected) }).waitFor({ timeout: 10000 });
        };
        await loadAssets(2);
        assert.equal(modules.length, 1, 'Repeated script loads in the same document must reuse the bundle');
        assert.equal(images, 1, 'Repeated image loads in the same document must reuse immutable artwork');
        const isolated = await browser.newContext(), other = await isolated.newPage();
        await visit(other, 3);
        assert.equal(modules.length, 2, 'A separate browser context downloads its own module');
        assert.equal(images, 2, 'A separate browser context downloads its own artwork');
        script = source(2);
        await loadAssets(4);
        assert.equal(await page.evaluate(() => window.motionVersion), 2);
        assert.equal(modules.length, 3, 'Changed content hash must fetch the new module');
        assert.equal(modules.at(-1), sha256(script));
        assert.equal(images, 2);
        assert.equal(documents, 2);
        assert.equal(states, 4, 'Every script load obtains fresh uncached state');
        const beforeNavigation = { modules: modules.length, images };
        await visit(page, 5);
        assert.equal(modules.length, beforeNavigation.modules + 1);
        assert.equal(images, beforeNavigation.images + 1);
        const closed = once(publisher.ws, 'close'); publisher.ws.terminate(); await closed;
        const offline = await page.evaluate(async route => {
            const response = await fetch(route);
            return { status: response.status, cache: response.headers.get('cache-control') };
        }, f.base + statePath);
        assert.deepEqual(offline, { status: 503, cache: 'no-store, no-transform' });
        t.diagnostic('Repeated subresource loads: one module/WebP transfer per sandbox document; a new browser context and a changed hash each fetch privately. Full navigation creates a new opaque sandbox and refetches assets. Five state loads remain fresh; offline state returns 503.');
    } finally { await browser.close(); }
});

test("session authorizes exact input and issues stable owner/device/install/channel tokens", async t => {
    const seen = [];
    const f = await fixture(t, { authorize: input => { seen.push(input); return { ownerId: input.licenseCode === "other" ? "owner-2" : "owner-1" }; } });
    const first = await f.session();
    assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
    assert.ok(first.ticket.length < 4096);
    assert.ok(first.expiresAt > Date.now() + 3590000);
    assert.equal(first.path, "/overlays/" + first.token);
    assert.equal(first.protocolVersion, 1);
    assert.deepEqual(seen[0], INPUT);
    assert.equal((await f.session()).token, first.token);
    assert.equal((await f.session({ licenseCode: "alias" })).token, first.token);
    for (const patch of [{ deviceId: "device-2" }, { installationId: "install-2" }, { channel: "other" }, { licenseCode: "other" }]) {
        assert.notEqual((await f.session(patch)).token, first.token);
    }
    const claims = JSON.parse(Buffer.from(first.ticket.split(".")[0], "base64url"));
    assert.equal(claims.ownerId, "owner-1");
    assert.equal(claims.channel, INPUT.channel);
    assert.ok(!Object.hasOwn(claims, "licenseCode"));
    assert.equal((await f.read(first.path + "/tikmng/media")).status, 503);
});

test("session denies unauthorized input, caller-selected tokens, bad JSON and unavailable authorization", async t => {
    let calls = 0;
    const f = await fixture(t, { authorize: input => { calls++; if (input.licenseCode === "throw") throw new Error("private details"); return false; } });
    const post = body => f.read("/api/overlay/session", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    assert.equal((await post(JSON.stringify(INPUT))).status, 403);
    assert.equal((await post(JSON.stringify({ ...INPUT, token: "chosen" }))).status, 400);
    assert.equal((await post(JSON.stringify({ ...INPUT, ownerId: "chosen" }))).status, 400);
    assert.equal((await post(JSON.stringify({ ...INPUT, deviceId: "\n" }))).status, 400);
    assert.equal((await post("{")).status, 400);
    assert.equal((await post("[1]")).status, 400);
    assert.equal((await post(JSON.stringify({ ...INPUT, licenseCode: "x".repeat(9000) }))).status, 413);
    const unavailable = await post(JSON.stringify({ ...INPUT, licenseCode: "throw" }));
    assert.equal(unavailable.status, 503);
    assert.ok(!unavailable.text.includes("private details"));
    assert.equal(calls, 2);
    assert.equal((await f.read("/api/overlay/session")).status, 405);
    assert.equal((await f.read("/api/overlay/session", { method: "POST", body: "{}" })).status, 415);
});

test('offline browser documents retry transparently but media and state keep error responses', async t => {
    const f = await fixture(t);
    const session = await f.session();
    for (const route of ['/tikmng/media', '/tikmng/media/' + ID, '/widget-overlay.html', '/widget/top-gift']) {
        const response = await f.read(session.path + route);
        assert.equal(response.status, 503);
        assert.match(response.headers['content-type'], /^text\/html/);
        assert.equal(response.headers['retry-after'], '3');
        assert.match(response.text, /setTimeout\(\(\)=>location.reload\(\),3000\)/);
        assert.match(response.text, /background:transparent/);
        const nonce = /<script nonce="([a-f0-9]+)">/.exec(response.text)[1];
        assert.ok(response.headers['content-security-policy'].includes("script-src 'nonce-" + nonce + "'"));
        assert.ok(!response.text.includes(session.token));
        assert.ok(!response.text.includes(INPUT.licenseCode));
    }
    for (const route of [FILE, '/tikmng/media/poll', '/widget/state', '/widget/vendor/matter.js']) {
        const response = await f.read(session.path + route);
        assert.equal(response.status, 503);
        assert.match(response.headers['content-type'], /^text\/plain/);
        assert.ok(!response.text.includes('<script'));
    }
    const head = await f.read(session.path + '/tikmng/media', { method: 'HEAD' });
    assert.equal(head.status, 503);
    assert.equal(head.body.length, 0);
});

test('a real browser source opened offline recovers after publisher connects without refresh', {
    skip: process.env.OVERLAY_RELAY_PLAYWRIGHT ? false : 'Set OVERLAY_RELAY_PLAYWRIGHT for browser verification'
}, async t => {
    const { chromium } = await import(pathToFileURL(process.env.OVERLAY_RELAY_PLAYWRIGHT).href);
    const f = await fixture(t);
    const session = await f.session();
    const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
    t.after(() => browser.close());
    const page = await browser.newPage();
    const url = f.base + session.path + '/tikmng/media';
    assert.equal((await page.goto(url)).status(), 503);
    const publisher = await f.connect(session.ticket);
    const request = await publisher.next('request');
    respond(publisher, request, '<!doctype html><html><body><main id="recovered">TikMnG ready</main></body></html>', { 'content-type': 'text/html; charset=utf-8' });
    await page.locator('#recovered').waitFor({ timeout: 10000 });
    assert.equal(page.url(), url);
});

test("bridge requires signed unexpired bound tickets in Authorization, never in URLs", async t => {
    const f = await fixture(t, { publicOrigin: "https://overlays.example" });
    const session = await f.session();
    const claims = JSON.parse(Buffer.from(session.ticket.split(".")[0], "base64url"));
    assert.equal(await f.rejectUpgrade(), 401);
    assert.equal(await f.rejectUpgrade(session.ticket.slice(0, -1) + (session.ticket.endsWith("a") ? "b" : "a")), 401);
    assert.equal(await f.rejectUpgrade(null, "/api/overlay/bridge?ticket=" + session.ticket), 400);
    assert.equal(await f.rejectUpgrade(signClaims({ ...claims, issuedAt: Date.now() - 7200000, expiresAt: Date.now() - 3600000 })), 401);
    assert.equal(await f.rejectUpgrade(signClaims({ ...claims, token: "x".repeat(43) })), 401);
    assert.equal(await f.rejectUpgrade(session.ticket, undefined, { Origin: "https://evil.example" }), 403);
    await f.connect(session.ticket, { headers: { Origin: "https://overlays.example" } });
});

test("public reads forward only scoped paths and safe headers, preserving exact body and CSP nonce", async t => {
    const f = await fixture(t);
    const session = await f.session();
    const p = await f.connect(session.ticket);
    const pending = f.read(session.path + "/tikmng/media?game=game-1&key=discard", { headers: {
        Cookie: "admin=secret", Authorization: "Bearer private", "X-Tikmng-Overlay-Base": "/evil", Referer: "https://private.example"
    } });
    const request = await p.next("request");
    assert.equal(request.path, "/tikmng/media?game=game-1&channel=creator");
    assert.equal(request.method, "GET");
    assert.deepEqual(request.headers, { "x-tikmng-overlay-base": session.path });
    const html = `<script nonce="abc123">const base='${session.path}';</script>`;
    respond(p, request, html, { "content-type": "text/html; charset=utf-8", "content-security-policy": "default-src 'none'; script-src 'nonce-abc123'; frame-ancestors 'self' file: http://127.0.0.1:*",
        "set-cookie": "evil=1", "x-frame-options": "DENY", "access-control-allow-credentials": "true", location: "http://localhost/private", "x-private": "secret" });
    const response = await pending;
    assert.equal(response.status, 200);
    assert.equal(response.text, html);
    assert.equal(response.headers["content-length"], String(Buffer.byteLength(html)));
    assert.ok(response.headers["content-security-policy"].includes("script-src 'nonce-abc123'"));
    assert.ok(response.headers["content-security-policy"].includes("sandbox allow-scripts"));
    assert.ok(response.headers["content-security-policy"].includes("frame-ancestors *"));
    assert.ok(!response.headers["content-security-policy"].includes("127.0.0.1"));
    for (const name of ["set-cookie", "x-frame-options", "access-control-allow-credentials", "location", "x-private"]) assert.equal(response.headers[name], undefined);
    assert.equal(response.headers["access-control-allow-origin"], "*");
    assert.equal(response.headers["referrer-policy"], "no-referrer");
});

test("media Range, HEAD and binary bodies retain HTTP semantics", async t => {
    const f = await fixture(t);
    const session = await f.session();
    const p = await f.connect(session.ticket);
    const pending = f.read(session.path + FILE, { headers: { Range: "bytes=2-5" } });
    const request = await p.next("request");
    assert.equal(request.headers.range, "bytes=2-5");
    const bytes = Buffer.from([0, 255, 1, 254]);
    respond(p, request, bytes, { "content-type": "video/mp4", "content-range": "bytes 2-5/10", "accept-ranges": "bytes" }, 206);
    const response = await pending;
    assert.equal(response.status, 206);
    assert.deepEqual(response.body, bytes);
    assert.equal(response.headers["content-range"], "bytes 2-5/10");
    const head = f.read(session.path + FILE, { method: "HEAD" });
    const headRequest = await p.next("request");
    assert.equal(headRequest.method, "HEAD");
    p.send({ type: "headers", id: headRequest.id, status: 200, headers: { "content-type": "video/mp4", "content-length": "100" } });
    assert.equal((await head).body.length, 0);
    assert.equal((await p.next("cancel")).id, headRequest.id);
    assert.equal((await f.read(session.path + FILE, { headers: { Range: "bytes=0-1,3-4" } })).status, 416);
});

test("allowlist includes media polling and legacy widget reads, and blocks APIs/traversal/writes", async t => {
    const f = await fixture(t);
    const session = await f.session();
    const p = await f.connect(session.ticket);
    const routes = ["/tikmng/media", "/tikmng/media/" + ID, FILE, "/tikmng/media/client.js", "/tikmng/media/client.css", "/tikmng/media/events", "/tikmng/media/poll",
        "/widget-overlay.html", "/widget/overlay", "/widget/overlay.html", "/widget/state", "/api/widget/state", "/widget/vendor/matter.js", "/widget/physical-jar.js", "/assets/widgets/glass-gift-jar.png", "/widget/gift-assets/Rose.png"];
    for (const name of ["top-gift", "top-likes", "leaderboard", "gift-feed", "activity"]) {
        routes.push(`/widget/${name}`, `/widget-${name}.html`, `/widget/${name}.html`);
        if (name !== "gift-feed") routes.push(`/widget/${name}/state`, `/api/widget/${name}/state`);
    }
    for (const route of routes) {
        const pending = f.read(session.path + route);
        const request = await p.next("request");
        assert.equal(request.path.split("?")[0], route);
        respond(p, request);
        assert.equal((await pending).status, 200, route);
    }
    for (const route of ["/api/admin/lisanslar", "/api/widget/gift", "/tikmng/media/test", "/tikmng/media/file/not-a-uuid", "/widget/gift-assets/catalog.json", "/widget/gift-assets/../secret.png", "/widget/gift-assets/%2e%2e%2fsecret.png", "/tikmng/media/%2e%2e/client.js", "/tikmng/media//client.js", "/http://127.0.0.1/private"]) {
        assert.equal((await f.read(session.path + route)).status, 404, route);
    }
    for (const method of ["POST", "PUT", "DELETE", "PATCH", "OPTIONS"]) assert.equal((await f.read(session.path + "/widget/state", { method })).status, 405);
    for (const query of ["channel=other", "channel=creator&channel=other", "key=one&key=two"]) assert.ok([400, 403].includes((await f.read(session.path + "/widget/state?" + query)).status));
});

test("only validated HTTPS 307 media-file redirects pass through", async t => {
    const f = await fixture(t);
    const session = await f.session();
    const p = await f.connect(session.ticket);
    for (const [route, location, status, expected] of [[FILE, "https://cdn.example/video.mp4?sig=123", 307, 307],
        [FILE, "http://127.0.0.1:9999/private", 307, 502], [FILE, "https://user:pass@cdn.example/video", 307, 502],
        [FILE, "/private", 307, 502], [FILE, "https://cdn.example/video", 302, 502], ["/widget-overlay.html", "https://cdn.example/video", 307, 502]]) {
        const pending = f.read(session.path + route);
        const request = await p.next("request");
        respond(p, request, "", { location }, status);
        const response = await pending;
        assert.equal(response.status, expected);
        assert.equal(response.headers.location, expected === 307 ? location : undefined);
    }
});

test("SSE streams immediately, forwards Last-Event-ID and cancels on reader disconnect", async t => {
    const f = await fixture(t);
    const session = await f.session();
    const p = await f.connect(session.ticket);
    const { req, response } = f.start(session.path + "/tikmng/media/events", { headers: { "Last-Event-ID": "event-9", Origin: "null" } });
    const request = await p.next("request");
    assert.equal(request.headers["last-event-id"], "event-9");
    p.send({ type: "headers", id: request.id, status: 200, headers: { "content-type": "text/event-stream", connection: "keep-alive", "set-cookie": "bad=1" } });
    const res = await response;
    assert.equal(res.headers["access-control-allow-origin"], "*");
    assert.equal(res.headers["x-accel-buffering"], "no");
    assert.equal(res.headers["set-cookie"], undefined);
    const data = once(res, "data");
    p.send({ type: "chunk", id: request.id, data: Buffer.from("id: event-10\ndata: {}\n\n").toString("base64") });
    assert.equal((await data)[0].toString(), "id: event-10\ndata: {}\n\n");
    req.destroy();
    assert.equal((await p.next("cancel")).id, request.id);
});

test("publisher errors and disconnects release requests; replacement bridge owns future reads", async t => {
    const f = await fixture(t);
    const session = await f.session();
    const p = await f.connect(session.ticket);
    const pending = f.read(session.path + "/widget/state");
    const request = await p.next("request");
    p.send({ type: "error", id: request.id, message: "private local filesystem" });
    assert.equal((await pending).status, 502);
    const second = f.read(session.path + "/widget/state");
    await p.next("request");
    const oldClose = once(p.ws, "close");
    const replacement = await f.connect(session.ticket);
    await oldClose;
    assert.equal((await second).status, 503);
    const next = f.read(session.path + "/widget/state");
    respond(replacement, await replacement.next("request"), "replacement");
    assert.equal((await next).text, "replacement");
    const disconnected = once(replacement.ws, "close");
    replacement.ws.close();
    await disconnected;
    assert.equal((await f.read(session.path + "/widget/state")).status, 503);
});

test("64 inflight requests bound each publisher and cancellation frees capacity", async t => {
    const f = await fixture(t);
    const session = await f.session();
    const p = await f.connect(session.ticket);
    const held = [];
    for (let index = 0; index < 64; index++) {
        const pending = f.read(session.path + "/widget/state");
        held.push({ pending, request: await p.next("request") });
    }
    assert.equal((await f.read(session.path + "/widget/state")).status, 503);
    respond(p, held[0].request);
    assert.equal((await held[0].pending).status, 200);
    const admitted = f.read(session.path + "/widget/state");
    respond(p, await p.next("request"));
    assert.equal((await admitted).status, 200);
    p.ws.terminate();
    for (const heldRequest of held.slice(1)) assert.equal((await heldRequest.pending).status, 503);
});

test("backpressure emits flow paused/resumed without changing binary output", async t => {
    const f = await fixture(t);
    const session = await f.session();
    const p = await f.connect(session.ticket);
    const pending = f.read(session.path + FILE);
    const request = await p.next("request");
    const chunk = randomBytes(80 * 1024);
    p.send({ type: "headers", id: request.id, status: 200, headers: { "content-type": "video/mp4", "content-length": String(chunk.length) } });
    p.send({ type: "chunk", id: request.id, data: chunk.toString("base64") });
    assert.equal((await p.next("flow", frame => frame.paused)).id, request.id);
    assert.equal((await p.next("flow", frame => !frame.paused)).id, request.id);
    p.send({ type: "end", id: request.id });
    assert.deepEqual((await pending).body, chunk);
});

for (const [label, route, type] of [
    ['state', '/api/widget/state', 'application/json'],
    ['bundled JS', MOTION + '?v=' + 'a'.repeat(64), 'text/javascript']
]) test('gzip ' + label + ' applies upstream flow control and keeps concurrent responses separate', async t => {
    const f = await fixture(t), session = await f.session(), publisher = await f.connect(session.ticket);
    const body = Buffer.from(JSON.stringify({ data: randomBytes(50 * 1024).toString('base64') }));
    const pending = f.read(session.path + route, { headers: { 'Accept-Encoding': 'gzip' } });
    const request = await publisher.next('request');
    publisher.send({ type: 'headers', id: request.id, status: 200, headers: { 'content-type': type, 'content-length': String(body.length) } });
    publisher.send({ type: 'chunk', id: request.id, data: body.toString('base64') });
    await publisher.next('flow', frame => frame.id === request.id && frame.paused);
    await publisher.next('flow', frame => frame.id === request.id && !frame.paused);
    publisher.send({ type: 'end', id: request.id });
    assert.deepEqual(gunzipSync((await pending).body), body);
    const responses = Array.from({ length: 12 }, (_, index) => ({ index,
        pending: f.read(session.path + route + (route.includes('?') ? '&' : '?') + 'type=topliker&screen=' + index, { headers: { 'Accept-Encoding': 'gzip' } }) }));
    for (let i = 0; i < responses.length; i++) {
        const next = await publisher.next('request');
        const index = Number(new URL(next.path, f.base).searchParams.get('screen'));
        respond(publisher, next, JSON.stringify({ index, rows: Array(1000).fill(index) }), { 'content-type': type });
    }
    for (const { index, pending } of responses) {
        const response = await pending;
        assert.equal(response.headers['content-encoding'], 'gzip');
        const decoded = gunzipSync(response.body);
        assert.equal(JSON.parse(decoded).index, index);
    }
});

for (const [label, route, type] of [
    ['state', '/api/widget/state', 'application/json'],
    ['bundled JS', MOTION + '?v=' + 'a'.repeat(64), 'text/javascript']
]) test('stalled gzip ' + label + ' still times out after the upstream end frame and releases its slot', async t => {
    let block = true;
    const f = await fixture(t, { middleware(req, res) {
        if (block && req.url.includes(route.split('?')[0])) res.write = () => false;
    } });
    const session = await f.session(), publisher = await f.connect(session.ticket);
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const pending = f.start(session.path + route, { headers: { 'Accept-Encoding': 'gzip' } });
    const request = await publisher.next('request');
    const body = JSON.stringify({ data: randomBytes(80 * 1024).toString('base64') });
    publisher.send({ type: 'headers', id: request.id, status: 200, headers: { 'content-type': type, 'content-length': String(Buffer.byteLength(body)) } });
    const response = await pending.response; response.on('error', () => {});
    for (let start = 0; start < body.length; start += 4096) {
        publisher.send({ type: 'chunk', id: request.id, data: Buffer.from(body.slice(start, start + 4096)).toString('base64') });
        await turn();
    }
    publisher.send({ type: 'end', id: request.id });
    await turn(); await turn();
    const closed = new Promise(resolve => response.once('close', resolve));
    t.mock.timers.tick(30001); await turn();
    await publisher.next('cancel', frame => frame.id === request.id);
    await closed;
    t.mock.timers.reset(); block = false;
    assert.equal(publisher.ws.readyState, WebSocket.OPEN);
    const nextResponse = f.read(session.path + route);
    const next = await publisher.next('request'); respond(publisher, next, '{}', { 'content-type': type });
    assert.equal((await nextResponse).text, '{}');
});

test("malformed frames, invalid headers and oversized WS payloads terminate only their publisher", async t => {
    const f = await fixture(t);
    const session = await f.session();
    for (const makeFrame of [id => ({ type: "chunk", id, data: "!!!!" }), id => ({ type: "headers", id, status: 200, headers: { "content-type": "text/plain\r\nSet-Cookie: evil" } }),
        id => ({ type: "headers", id, status: 200, headers: { "content-length": "999999999999" } }),
        id => ({ type: "headers", id, status: 200, headers: { "Content-Type": "text/plain", "content-type": "text/html" } }),
        id => ({ type: "chunk", id, data: "x".repeat(128 * 1024) })]) {
        const p = await f.connect(session.ticket);
        const pending = f.read(session.path + "/widget/state");
        const request = await p.next("request");
        const closed = once(p.ws, "close");
        p.send(makeFrame(request.id));
        await closed;
        assert.equal((await pending).status, 503);
        assert.equal((await f.read("/health")).text, "ok");
    }
});

test("headers have a deadline while SSE remains open beyond the normal response lifetime", async t => {
    const f = await fixture(t);
    const session = await f.session();
    const p = await f.connect(session.ticket);
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const pending = f.read(session.path + "/widget/state");
    await p.next("request");
    t.mock.timers.tick(15001);
    assert.equal((await pending).status, 504);
    const cancel = await p.next("cancel");
    assert.ok(cancel.id);
    const sse = f.start(session.path + "/tikmng/media/events");
    const request = await p.next("request");
    p.send({ type: "headers", id: request.id, status: 200, headers: { "content-type": "text/event-stream" } });
    const res = await sse.response;
    t.mock.timers.tick(20 * 60 * 1000);
    await turn();
    assert.equal(res.destroyed, false);
    const data = once(res, "data");
    p.send({ type: "chunk", id: request.id, data: Buffer.from(": still live\n\n").toString("base64") });
    assert.equal((await data)[0].toString(), ": still live\n\n");
    sse.req.destroy();
    assert.equal((await p.next("cancel")).id, request.id);
});

test("aggregate buffering is capped at 2 MiB when a publisher ignores flow control", async t => {
    const f = await fixture(t, { middleware(req, res) {
        if (!req.url.startsWith("/overlays/")) return;
        let bytes = 0;
        Object.defineProperty(res, "writableLength", { get: () => bytes });
        res.write = chunk => { bytes += chunk.length; return false; };
    } });
    const session = await f.session();
    const p = await f.connect(session.ticket);
    const started = f.start(session.path + FILE);
    const request = await p.next("request");
    p.send({ type: "headers", id: request.id, status: 200, headers: { "content-type": "video/mp4" } });
    const res = await started.response;
    res.on("error", () => {});
    res.resume();
    const chunk = Buffer.alloc(80 * 1024).toString("base64");
    p.send({ type: "chunk", id: request.id, data: chunk });
    await p.next("flow", frame => frame.paused);
    const closed = once(p.ws, "close");
    for (let index = 0; index < 26; index++) p.send({ type: "chunk", id: request.id, data: chunk });
    await closed;
    assert.equal((await f.read(session.path + "/widget/state")).status, 503);
});

test("heartbeat accepts pong and optional license revalidation disconnects revoked publishers", async t => {
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now: Date.now() });
    let allowed = true;
    const f = await fixture(t, { revalidate: claims => { assert.equal(claims.ownerId, "owner-1"); return allowed; } });
    const session = await f.session();
    const p = await f.connect(session.ticket);
    const ping = once(p.ws, "ping");
    t.mock.timers.tick(30000);
    await ping;
    const pong = once(p.ws, "pong");
    p.ws.ping();
    await pong;
    assert.equal(p.ws.readyState, WebSocket.OPEN);
    allowed = false;
    const closed = once(p.ws, "close");
    t.mock.timers.tick(30000);
    await closed;
    assert.equal((await f.read(session.path + "/widget/state")).status, 503);
    assert.equal(await f.rejectUpgrade(session.ticket), 403);
});

test("ticket expiration and missing heartbeat pong disconnect publishers", async t => {
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now: Date.now() });
    const f = await fixture(t);
    const session = await f.session();
    const claims = JSON.parse(Buffer.from(session.ticket.split(".")[0], "base64url"));
    const p = await f.connect(signClaims({ ...claims, issuedAt: Date.now() - 3600000 + 1000, expiresAt: Date.now() + 1000 }));
    const expired = once(p.ws, "close");
    t.mock.timers.tick(1001);
    await expired;
    assert.equal((await f.read(session.path + "/widget/state")).status, 503);
    const silent = await f.connect(session.ticket, { autoPong: false });
    const closed = once(silent.ws, "close");
    t.mock.timers.tick(60000);
    await closed;
    assert.equal((await f.read(session.path + "/widget/state")).status, 503);
});

test("close is idempotent, detaches upgrades and leaves the HTTP server usable", async t => {
    const f = await fixture(t);
    const session = await f.session();
    const p = await f.connect(session.ticket);
    const closed = once(p.ws, "close");
    const pending = f.read(session.path + "/widget/state");
    await p.next("request");
    await f.relay.close();
    await f.relay.close();
    await closed;
    assert.equal((await pending).status, 503);
    assert.equal(f.server.listenerCount("upgrade"), 0);
    assert.equal((await f.read("/health")).text, "ok");
    assert.equal((await f.read(session.path + "/widget/state")).status, 503);
    assert.throws(() => f.relay.attach(f.server), /closed/);
});

test("configuration rejects weak secrets and non-origin public URLs", () => {
    assert.throws(() => registerOverlayRelay(express(), { secret: "short", authorize: () => true }), /32 bytes/);
    for (const publicOrigin of ["http://localhost", "https://user:pass@example.com", "https://example.com/path", "https://example.com/?q=1"]) {
        assert.throws(() => registerOverlayRelay(express(), { secret: SECRET, authorize: () => true, publicOrigin }));
    }
});

test("sandboxed HTML polls from an opaque origin, loads nonce scripts/CSS and embeds across origins", {
    skip: process.env.OVERLAY_RELAY_PLAYWRIGHT ? false : "Set OVERLAY_RELAY_PLAYWRIGHT to a Playwright module for browser verification"
}, async t => {
    const { chromium } = await import(pathToFileURL(process.env.OVERLAY_RELAY_PLAYWRIGHT).href);
    const incoming = [];
    const f = await fixture(t, { middleware(req) {
        if (req.url.includes("/poll")) incoming.push({ origin: req.headers.origin, cookie: req.headers.cookie });
    } });
    const session = await f.session();
    const p = await f.connect(session.ticket);
    const html = `<link rel="stylesheet" href="${session.path}/tikmng/media/client.css"><div id="result">waiting</div><script nonce="test123" src="${session.path}/tikmng/media/client.js"></script>`;
    const csp = "default-src 'none'; script-src 'nonce-test123'; style-src 'self'; connect-src 'self'; frame-ancestors 'self' file: http://127.0.0.1:*";
    p.ws.on("message", raw => {
        const request = JSON.parse(raw);
        if (request.type !== "request") return;
        const pathname = request.path.split("?")[0];
        if (pathname === "/tikmng/media") respond(p, request, html, { "content-type": "text/html", "content-security-policy": csp });
        else if (pathname.endsWith("client.css")) respond(p, request, "#result { color: rgb(12, 34, 56); }", { "content-type": "text/css" });
        else if (pathname.endsWith("client.js")) respond(p, request,
            `fetch('${session.path}/tikmng/media/poll').then(r=>r.json()).then(data=>{document.querySelector('#result').textContent=data.value;window.opaqueOrigin=self.origin;}).catch(error=>document.querySelector('#result').textContent=error.message);`, { "content-type": "text/javascript" });
        else if (pathname.endsWith("poll")) respond(p, request, JSON.stringify({ value: "poll works" }), { "content-type": "application/json" });
        else respond(p, request, "not found", {}, 404);
    });
    const embed = http.createServer((req, res) => {
        res.setHeader("Content-Type", "text/html");
        res.end(`<iframe src="${f.base}${session.path}/tikmng/media"></iframe>`);
    });
    embed.listen(0, "127.0.0.1");
    await once(embed, "listening");
    t.after(() => new Promise(resolve => { embed.closeAllConnections(); embed.close(resolve); }));
    const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
    try {
        const context = await browser.newContext();
        await context.addCookies([{ name: "admin", value: "private", url: f.base }]);
        const page = await context.newPage();
        await page.goto(`http://127.0.0.1:${embed.address().port}/`);
        const frame = page.frameLocator("iframe");
        await frame.locator("#result").filter({ hasText: "poll works" }).waitFor({ timeout: 10000 });
        assert.equal(await frame.locator("#result").evaluate(element => getComputedStyle(element).color), "rgb(12, 34, 56)");
        assert.equal(await frame.locator("#result").evaluate(() => window.opaqueOrigin), "null");
        assert.deepEqual(incoming, [{ origin: "null", cookie: undefined }]);
    } finally { await browser.close(); }
});
