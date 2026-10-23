import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import express from "express";
import { WebSocket, WebSocketServer } from "ws";

const BRIDGE = "/api/overlay/bridge";
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const MEDIA = new RegExp(`^/tikmng/media(?:/(?:${UUID}|client\\.js|client\\.css|events|poll|file/${UUID}))?$`, "i");
const MEDIA_DOCUMENT = new RegExp(`^/tikmng/media(?:/${UUID})?$`, "i");
const WIDGET = new Set([
    "/widget-overlay.html", "/widget/overlay", "/widget/overlay.html",
    "/widget/state", "/api/widget/state", "/widget/vendor/matter.js",
    "/widget/physical-jar.js", "/assets/widgets/glass-gift-jar.png"
]);
for (const name of ["top-gift", "top-likes", "leaderboard", "gift-feed", "activity"]) {
    WIDGET.add(`/widget/${name}`);
    WIDGET.add(`/widget-${name}.html`);
    WIDGET.add(`/widget/${name}.html`);
    if (name !== "gift-feed") {
        WIDGET.add(`/widget/${name}/state`);
        WIDGET.add(`/api/widget/${name}/state`);
    }
}
const GIFT = /^\/widget\/gift-assets\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,199}\.(?:png|webp|gif|jpe?g)$/i;
const MAX_BUFFER = 2 * 1024 * 1024;
const MAX_BODY = 512 * 1024 * 1024;
const HOUR = 60 * 60 * 1000;
const SAFE_HEADERS = new Set([
    "content-type", "content-length", "content-range", "accept-ranges",
    "etag", "last-modified", "content-language", "content-security-policy", "location"
]);
const FALLBACK_CSP = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' blob: https:; connect-src 'self'; font-src 'self' data:";
const ISOLATION_CSP = "sandbox allow-scripts; base-uri 'none'; object-src 'none'; form-action 'none'";

function publicCsp(value) {
    const policies = (value || FALLBACK_CSP).split(",").map(policy => policy.split(";")
        .filter(directive => !/^\s*frame-ancestors(?:\s|$)/i.test(directive)).join(";").trim()).filter(Boolean);
    return [...policies, ISOLATION_CSP + "; frame-ancestors *"].join(", ");
}

function object(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value, max) {
    return typeof value === "string" && value.length > 0 && value.length <= max
        && value === value.trim() && !/[\x00-\x1f\x7f]/.test(value);
}

function deadline(promise, ms) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Authorization timed out")), ms);
        timer.unref?.();
    })]).finally(() => clearTimeout(timer));
}

/**
 * Mount before general CORS/static middleware. TLS belongs to the hosting proxy.
 * authorize(input): false | true | ownerId | {ownerId}; no license policy lives here.
 * Optional revalidate(claims): same return shape, checked on connect and every minute.
 * Frames: request{id,method,path,headers}, headers{id,status,headers},
 * chunk{id,data:base64}, end{id}, error{id}, cancel{id}, flow{id,paused:boolean}.
 * expiresAt is Unix milliseconds. Publishers inject their own local key, never follow
 * redirects, and enforce the signed channel. x-tikmng-overlay-base scopes asset URLs.
 */
export function registerOverlayRelay(app, { secret, authorize, publicOrigin, revalidate } = {}) {
    if ((!Buffer.isBuffer(secret) && typeof secret !== "string") || Buffer.byteLength(secret) < 32) {
        throw new TypeError("Overlay relay secret must contain at least 32 bytes");
    }
    if (typeof authorize !== "function" || (revalidate !== undefined && typeof revalidate !== "function")) {
        throw new TypeError("Overlay authorization callbacks must be functions");
    }
    if (publicOrigin !== undefined) {
        const origin = new URL(publicOrigin);
        if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/"
            || origin.search || origin.hash) throw new TypeError("publicOrigin must be an HTTPS origin");
        publicOrigin = origin.origin;
    }
    const key = Buffer.from(secret);
    const sign = value => createHmac("sha256", key).update(value).digest("base64url");
    const tokenFor = claims => sign("overlay-public-v1:" + JSON.stringify([
        claims.ownerId, claims.deviceId, claims.installationId, claims.channel
    ]));
    const ownerFor = (result, fallback) => {
        const owner = result === true ? fallback : typeof result === "string" ? result : result?.ownerId;
        return text(owner, 256) ? owner : null;
    };
    const publishers = new Map();
    const connections = new Set();
    const attempts = new Map();
    const upgrades = new Set();
    const wss = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024, perMessageDeflate: false });
    let server, closed = false, closing, authorizations = 0;

    async function check(callback, input) {
        if (authorizations >= 64) throw new Error("Authorization busy");
        authorizations++;
        const pending = Promise.resolve().then(() => callback(input));
        pending.then(() => authorizations--, () => authorizations--);
        return deadline(pending, 10000);
    }

    function safeHeaders(res) {
        for (const name of ["set-cookie", "location", "access-control-allow-credentials", "x-frame-options"]) res.removeHeader(name);
        res.setHeader("Cache-Control", "no-store, no-transform");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Referrer-Policy", "no-referrer");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Content-Security-Policy", ISOLATION_CSP);
    }

    function reply(res, status, message) {
        if (res.destroyed) return;
        if (res.writableEnded) { if (!res.writableFinished) res.destroy(); return; }
        if (res.headersSent) return res.destroy();
        safeHeaders(res);
        res.removeHeader("content-length");
        res.removeHeader("content-range");
        res.statusCode = status;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(message);
    }

    function publisherOffline(req, res, route) {
        const document = MEDIA_DOCUMENT.test(route) || route === '/widget-overlay.html' ||
            /^\/widget\/(?:overlay|top-gift|top-likes|leaderboard|gift-feed|activity)(?:\.html)?$/.test(route) ||
            /^\/widget-(?:top-gift|top-likes|leaderboard|gift-feed|activity)\.html$/.test(route);
        if (!document) return reply(res, 503, 'Overlay publisher offline');
        const nonce = randomUUID().replaceAll('-', '');
        safeHeaders(res);
        res.statusCode = 503;
        res.setHeader('Retry-After', '3');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; ${ISOLATION_CSP}; frame-ancestors *`);
        // A browser source opened before its publisher must recover without user input.
        const html = `<!doctype html><html lang="tr"><meta charset="utf-8"><title>TikMnG - Baglanti bekleniyor</title><style nonce="${nonce}">html,body{margin:0;background:transparent}</style><body><script nonce="${nonce}">setTimeout(()=>location.reload(),3000)</script></body></html>`;
        res.end(req.method === 'HEAD' ? undefined : html);
    }

    const parseSession = express.json({ limit: "8kb", strict: true, inflate: false });
    app.all("/api/overlay/session", (req, res, next) => {
        if (closed) return reply(res, 503, "Overlay relay closed");
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            return reply(res, 405, "Method not allowed");
        }
        if (!req.is("application/json")) return reply(res, 415, "JSON required");
        parseSession(req, res, next);
    }, async (req, res) => {
        const input = req.body;
        const fields = ["licenseCode", "deviceId", "installationId", "channel"];
        if (!object(input) || Object.keys(input).length !== fields.length
            || !fields.every(name => Object.hasOwn(input, name) && text(input[name], name === "licenseCode" ? 512 : name === "channel" ? 128 : 256))
            || Buffer.byteLength(JSON.stringify(input)) > 8192) return reply(res, 400, "Invalid session input");
        const ip = req.ip || req.socket.remoteAddress;
        const now = Date.now();
        let rate = attempts.get(ip);
        if (!rate || now - rate.start >= 60000) {
            if (!rate && attempts.size >= 4096) return reply(res, 503, "Overlay relay busy");
            attempts.set(ip, rate = { start: now, count: 0 });
        }
        if (++rate.count > 60) return reply(res, 429, "Too many session requests");
        try {
            const result = await check(authorize, { ...input });
            const ownerId = ownerFor(result, sign("overlay-owner-v1:" + input.licenseCode));
            if (!ownerId) return reply(res, 403, "Overlay authorization denied");
            if (closed) return reply(res, 503, "Overlay relay closed");
            const issuedAt = Date.now();
            const claims = { protocolVersion: 1, ownerId, deviceId: input.deviceId,
                installationId: input.installationId, channel: input.channel, issuedAt, expiresAt: issuedAt + HOUR };
            const token = tokenFor(claims);
            const payload = Buffer.from(JSON.stringify({ ...claims, token })).toString("base64url");
            const ticket = payload + "." + sign("overlay-ticket-v1:" + payload);
            if (ticket.length >= 4096) return reply(res, 400, "Session input too large");
            safeHeaders(res);
            res.json({ token, ticket, expiresAt: claims.expiresAt, path: "/overlays/" + token, protocolVersion: 1 });
        } catch {
            reply(res, 503, "Overlay authorization unavailable");
        }
    }, (error, req, res, next) => {
        reply(res, error.type === "entity.too.large" ? 413 : error.status === 415 ? 415 : 400, "Invalid session JSON");
    });

    function readTicket(ticket) {
        if (typeof ticket !== "string" || ticket.length >= 4096) return null;
        const parts = ticket.match(/^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/);
        if (!parts) return null;
        if (!timingSafeEqual(Buffer.from(sign("overlay-ticket-v1:" + parts[1])), Buffer.from(parts[2]))) return null;
        try {
            const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
            if (!object(claims) || claims.protocolVersion !== 1 || !TOKEN.test(claims.token)
                || !text(claims.ownerId, 256) || !text(claims.deviceId, 256) || !text(claims.installationId, 256)
                || !text(claims.channel, 128) || !Number.isSafeInteger(claims.issuedAt) || !Number.isSafeInteger(claims.expiresAt)
                || claims.issuedAt > Date.now() || claims.expiresAt <= Date.now()
                || claims.expiresAt - claims.issuedAt !== HOUR || tokenFor(claims) !== claims.token) return null;
            return claims;
        } catch { return null; }
    }

    function send(bridge, frame) {
        if (bridge.ws.readyState !== WebSocket.OPEN || bridge.ws.bufferedAmount > MAX_BUFFER) return false;
        bridge.ws.send(JSON.stringify(frame), error => { if (error) disconnect(bridge); });
        return true;
    }

    function dispose(context, cancel = false) {
        if (!context.bridge.requests.delete(context.id)) return;
        clearTimeout(context.timer);
        clearTimeout(context.totalTimer);
        clearTimeout(context.blockTimer);
        if (cancel) send(context.bridge, { type: "cancel", id: context.id });
    }

    function fail(context, status, message) {
        dispose(context, true);
        reply(context.res, status, message);
    }

    function disconnect(bridge) {
        if (!connections.delete(bridge)) return;
        if (publishers.get(bridge.claims.token) === bridge) publishers.delete(bridge.claims.token);
        clearTimeout(bridge.expiry);
        for (const context of bridge.requests.values()) fail(context, 503, "Overlay publisher offline");
        bridge.ws.terminate();
    }

    function protocolError(bridge) {
        bridge.ws.close(1008, "Invalid relay protocol");
        disconnect(bridge);
    }

    function idle(context, ms = 30000) {
        clearTimeout(context.timer);
        context.timer = setTimeout(() => fail(context, 504, "Overlay publisher timed out"), ms);
        context.timer.unref?.();
    }

    function responseHeaders(value) {
        if (!object(value) || Object.keys(value).length > 40) throw new Error("Invalid headers");
        const headers = {};
        let size = 0;
        for (const [name, val] of Object.entries(value)) {
            if (!/^[A-Za-z0-9-]{1,64}$/.test(name) || typeof val !== "string" || /[\x00-\x1f\x7f\u0100-\uffff]/.test(val)) throw new Error("Invalid header");
            size += name.length + val.length;
            if (size > 16384) throw new Error("Headers too large");
            const lower = name.toLowerCase();
            if (SAFE_HEADERS.has(lower)) {
                if (Object.hasOwn(headers, lower)) throw new Error("Duplicate header");
                headers[lower] = val;
            }
        }
        if (headers["content-length"] !== undefined && (!/^\d{1,12}$/.test(headers["content-length"])
            || Number(headers["content-length"]) > MAX_BODY)) throw new Error("Invalid body length");
        return headers;
    }

    function message(bridge, data, binary) {
        try {
            const now = Date.now();
            if (now - bridge.window >= 1000) { bridge.window = now; bridge.bytes = 0; bridge.frames = 0; }
            bridge.bytes += data.length;
            if (binary || bridge.bytes > 24 * 1024 * 1024 || ++bridge.frames > 2048) return protocolError(bridge);
            const frame = JSON.parse(data.toString("utf8"));
            if (!object(frame) || !["headers", "chunk", "end", "error"].includes(frame.type) || !text(frame.id, 64)) return protocolError(bridge);
            const context = bridge.requests.get(frame.id);
            // Late data is normal after cancellation or a completed HEAD request.
            if (!context || context.ended) return;
            if (frame.type === "error") return fail(context, 502, "Overlay upstream failed");
            if (frame.type === "headers") {
                if (context.headers || !Number.isInteger(frame.status) || frame.status < 200 || frame.status > 599) return protocolError(bridge);
                const headers = responseHeaders(frame.headers);
                const redirect = frame.status >= 300 && frame.status < 400 && frame.status !== 304;
                if (redirect) {
                    let target;
                    try { target = new URL(headers.location); } catch {}
                    if (frame.status !== 307 || !/^\/tikmng\/media\/file\//.test(context.pathname)
                        || !target || target.protocol !== "https:" || target.username || target.password
                        || /[\x00-\x20\x7f\\]/.test(headers.location)) return fail(context, 502, "Invalid overlay redirect");
                    headers.location = target.href;
                } else delete headers.location;
                context.headers = true;
                context.sse = context.pathname === "/tikmng/media/events" && /^text\/event-stream(?:;|$)/i.test(headers["content-type"] || "");
                context.length = headers["content-length"] === undefined ? null : Number(headers["content-length"]);
                safeHeaders(context.res);
                for (const [name, val] of Object.entries(headers)) context.res.setHeader(name, val);
                context.res.setHeader("Content-Security-Policy", publicCsp(headers["content-security-policy"]));
                context.res.setHeader("Content-Type", headers["content-type"] || "application/octet-stream");
                context.res.statusCode = frame.status;
                if (context.method === "HEAD" || [204, 205, 304].includes(frame.status)) {
                    context.ended = true;
                    dispose(context, true);
                    return context.res.end();
                }
                if (context.sse) {
                    clearTimeout(context.timer);
                    clearTimeout(context.totalTimer);
                    context.res.removeHeader("content-length");
                    context.length = null;
                    context.res.setHeader("X-Accel-Buffering", "no");
                    context.res.socket?.setTimeout(0);
                } else idle(context);
                return context.res.flushHeaders();
            }
            if (!context.headers) return protocolError(bridge);
            if (frame.type === "end") {
                if (context.length !== null && context.bytes !== context.length) return fail(context, 502, "Invalid upstream body length");
                context.ended = true;
                clearTimeout(context.timer);
                clearTimeout(context.totalTimer);
                return context.res.end();
            }
            if (typeof frame.data !== "string" || frame.data.length > 128 * 1024
                || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(frame.data)) return protocolError(bridge);
            const chunk = Buffer.from(frame.data, "base64");
            context.bytes += chunk.length;
            if ((!context.sse && context.bytes > MAX_BODY) || (context.length !== null && context.bytes > context.length)) return fail(context, 502, "Overlay body limit exceeded");
            const buffered = [...bridge.requests.values()].reduce((sum, item) => sum + item.res.writableLength, bridge.ws.bufferedAmount);
            if (buffered + chunk.length > MAX_BUFFER) return protocolError(bridge);
            if (!context.sse) idle(context);
            if (!context.res.write(chunk) && !context.paused) {
                context.paused = true;
                if (!send(bridge, { type: "flow", id: context.id, paused: true })) return disconnect(bridge);
                context.blockTimer = setTimeout(() => fail(context, 504, "Overlay reader stalled"), 30000);
                context.blockTimer.unref?.();
            }
        } catch { protocolError(bridge); }
    }

    app.use("/overlays", (req, res) => {
        if (!["GET", "HEAD"].includes(req.method)) {
            res.setHeader("Allow", "GET, HEAD");
            return reply(res, 405, "Read-only overlay");
        }
        const raw = req.originalUrl;
        if (raw.length > 4096 || /[\x00-\x20\x7f\\#]/.test(raw)) return reply(res, 400, "Invalid overlay path");
        const [pathname] = raw.split("?");
        const match = pathname.match(/^\/overlays\/([A-Za-z0-9_-]{43})(\/.*)$/);
        if (!match || (!MEDIA.test(match[2]) && !WIDGET.has(match[2]) && (!GIFT.test(match[2]) || match[2].includes("..")))) return reply(res, 404, "Unknown overlay route");
        const bridge = publishers.get(match[1]);
        if (closed || !bridge || bridge.ws.readyState !== WebSocket.OPEN || bridge.claims.expiresAt <= Date.now()) return publisherOffline(req, res, match[2]);
        const query = new URLSearchParams(raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : "");
        if (query.getAll("channel").length > 1 || query.getAll("key").length > 1) return reply(res, 400, "Duplicate overlay scope");
        if (query.has("channel") && query.get("channel") !== bridge.claims.channel) return reply(res, 403, "Invalid overlay channel");
        query.delete("key");
        query.set("channel", bridge.claims.channel);
        const headers = { "x-tikmng-overlay-base": "/overlays/" + match[1] };
        if (req.headers.range !== undefined) {
            if (!/^bytes=(?:\d{1,16}-\d{0,16}|-\d{1,16})$/.test(req.headers.range)) return reply(res, 416, "Invalid byte range");
            headers.range = req.headers.range;
        }
        if (req.headers["last-event-id"] !== undefined) {
            if (!text(req.headers["last-event-id"], 256)) return reply(res, 400, "Invalid event id");
            headers["last-event-id"] = req.headers["last-event-id"];
        }
        if (bridge.requests.size >= 64) return reply(res, 503, "Overlay publisher busy");
        const id = randomUUID();
        const context = { id, bridge, res, method: req.method, pathname: match[2], headers: false,
            sse: false, bytes: 0, paused: false, ended: false };
        bridge.requests.set(id, context);
        idle(context, 15000);
        context.totalTimer = setTimeout(() => fail(context, 504, "Overlay response timed out"), 15 * 60 * 1000);
        context.totalTimer.unref?.();
        res.once("finish", () => dispose(context));
        res.once("close", () => dispose(context, !res.writableFinished));
        res.once("error", () => dispose(context, true));
        res.on("drain", () => {
            if (!context.paused || !bridge.requests.has(id)) return;
            context.paused = false;
            clearTimeout(context.blockTimer);
            if (!context.ended && !send(bridge, { type: "flow", id, paused: false })) disconnect(bridge);
        });
        if (!send(bridge, { type: "request", id, method: req.method, path: match[2] + "?" + query.toString(), headers })) disconnect(bridge);
    });

    function reject(socket, status) {
        const reason = { 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 503: "Service Unavailable" }[status];
        if (!socket.destroyed) socket.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    }

    async function upgrade(req, socket, head) {
        if (req.url.split("?")[0] !== BRIDGE) return;
        if (closed || connections.size + upgrades.size >= 256) return reject(socket, 503);
        if (req.url !== BRIDGE || req.method !== "GET") return reject(socket, 400);
        const bearer = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.headers.authorization || "");
        const claims = bearer && readTicket(bearer[1]);
        if (!claims) return reject(socket, 401);
        if (req.headers.origin && (!publicOrigin || req.headers.origin !== publicOrigin)) return reject(socket, 403);
        upgrades.add(socket);
        socket.setTimeout(10000, () => socket.destroy());
        try {
            if (revalidate && ownerFor(await check(revalidate, { ...claims }), claims.ownerId) !== claims.ownerId) return reject(socket, 403);
            if (closed || socket.destroyed || claims.expiresAt <= Date.now()) return reject(socket, 401);
            socket.setTimeout(0);
            wss.handleUpgrade(req, socket, head, ws => {
                const bridge = { ws, claims, requests: new Map(), alive: true, window: Date.now(), bytes: 0, frames: 0, validating: false, checkedAt: Date.now() };
                const previous = publishers.get(claims.token);
                if (previous) disconnect(previous);
                connections.add(bridge);
                publishers.set(claims.token, bridge);
                bridge.expiry = setTimeout(() => disconnect(bridge), claims.expiresAt - Date.now());
                bridge.expiry.unref?.();
                ws.on("pong", () => { bridge.alive = true; });
                ws.on("message", (data, binary) => message(bridge, data, binary));
                ws.on("close", () => disconnect(bridge));
                ws.on("error", () => disconnect(bridge));
            });
        } catch { reject(socket, 503); }
        finally { upgrades.delete(socket); }
    }

    const heartbeat = setInterval(() => {
        const now = Date.now();
        for (const [ip, rate] of attempts) if (now - rate.start >= 60000) attempts.delete(ip);
        for (const bridge of connections) {
            if (!bridge.alive || bridge.claims.expiresAt <= now) { disconnect(bridge); continue; }
            bridge.alive = false;
            bridge.ws.ping(error => { if (error) disconnect(bridge); });
            if (revalidate && !bridge.validating && now - (bridge.checkedAt || 0) >= 60000) {
                bridge.validating = true;
                bridge.checkedAt = now;
                check(revalidate, { ...bridge.claims }).then(result => {
                    if (ownerFor(result, bridge.claims.ownerId) !== bridge.claims.ownerId) disconnect(bridge);
                }, () => disconnect(bridge)).finally(() => { bridge.validating = false; });
            }
        }
    }, 30000);
    heartbeat.unref?.();

    function attach(httpServer) {
        if (closed) throw new Error("Overlay relay closed");
        if (server && server !== httpServer) throw new Error("Overlay relay already attached");
        if (server) return;
        server = httpServer;
        server.on("upgrade", upgrade);
        server.once("close", close);
    }

    function close() {
        if (closing) return closing;
        closed = true;
        clearInterval(heartbeat);
        server?.off("upgrade", upgrade);
        server?.off("close", close);
        for (const socket of upgrades) socket.destroy();
        upgrades.clear();
        for (const bridge of connections) disconnect(bridge);
        attempts.clear();
        closing = new Promise(resolve => wss.close(() => resolve()));
        return closing;
    }

    return { attach, close };
}
