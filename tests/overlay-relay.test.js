import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createHmac, randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import express from "express";
import { WebSocket } from "ws";
import { registerOverlayRelay } from "../overlay-relay.js";

const SECRET = randomBytes(32);
const INPUT = { licenseCode: "test-license", deviceId: "device-1", installationId: "install-1", channel: "creator" };
const ID = "12345678-1234-4234-9234-123456789abc";
const FILE = "/tikmng/media/file/" + ID;
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

function signClaims(claims) {
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    return payload + "." + createHmac("sha256", SECRET).update("overlay-ticket-v1:" + payload).digest("base64url");
}

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
