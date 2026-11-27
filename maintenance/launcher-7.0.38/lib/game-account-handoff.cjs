'use strict';

const http = require('node:http');
const { randomUUID } = require('node:crypto');
const WebSocket = require('ws');

const TIMEOUT_MS = 5000;
const WS_TYPES = new Map([
    ['vs', 'connect-live'], ['puanlama', 'puanlama-baglan'], ['orbit', 'connect'],
    ['crowd-control', 'connect'], ['crowdControl', 'connect'], ['battle-game', 'connect'],
    ['duck-hunt', 'connect'], ['penalty-kick', 'connect']
]);
const NATIVE = new Set(['snow-war', 'battle-royale', 'zombie-war', 'minecraft-snake-arena']);
const error = (code, message) => Object.assign(new Error(message), { code });
const aborted = signal => signal.reason instanceof Error ? signal.reason : error('ABORT_ERR', 'Game account handoff aborted.');
const lookup = (hostname, options, callback) => {
    if (hostname !== 'localhost') return callback(error('EINVAL', 'Only loopback addresses are allowed.'));
    callback(null, options?.all ? [{ address: '127.0.0.1', family: 4 }] : '127.0.0.1', 4);
};

function localBase(value) {
    let url;
    try { url = new URL(value); } catch { throw error('EINVAL', 'Invalid game base URL.'); }
    if (!['http:', 'ws:'].includes(url.protocol)) throw error('EINVAL', 'Game handoff requires an http: or ws: loopback URL.');
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) throw error('EINVAL', 'Game handoff requires a loopback base URL without credentials, path or query.');
    url.protocol = 'http:';
    return url;
}

// A flushed request proves nothing about the endpoint's response. Own the entire
// response, including resets, malformed/truncated bodies and delayed failures.
function requestJSON(url, { signal, payload, token }) {
    return new Promise((resolve, reject) => {
        if (signal.aborted) return reject(aborted(signal));
        const body = payload === undefined ? null : JSON.stringify(payload);
        let settled = false;
        const request = http.request(url, {
            method: body === null ? 'GET' : 'POST', agent: false, lookup,
            headers: { ...(token ? { 'X-Session-Token': token } : {}),
                ...(body === null ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }) }
        });
        const finish = (failure, value) => {
            if (settled) return;
            settled = true;
            signal.removeEventListener('abort', cancel);
            if (failure) { request.destroy(); reject(failure); } else resolve(value);
        };
        const cancel = () => finish(aborted(signal));
        signal.addEventListener('abort', cancel, { once: true });
        request.on('error', failure => finish(failure));
        request.once('response', response => {
            response.on('error', () => finish(error('ETRANSPORT', 'Game HTTP response failed.')));
            response.once('aborted', () => finish(error('ETRANSPORT', 'Game HTTP response was interrupted.')));
            if (response.statusCode < 200 || response.statusCode >= 300) {
                const failure = error('EHTTP', 'Game endpoint rejected the account request.');
                failure.statusCode = response.statusCode;
                response.resume(); finish(failure); return;
            }
            const chunks = [];
            let bytes = 0;
            response.on('data', chunk => {
                bytes += chunk.length;
                if (bytes > 65536) return finish(error('EPROTO', 'Game response is too large.'));
                chunks.push(chunk);
            });
            response.once('end', () => {
                if (settled) return;
                let value;
                try { value = response.statusCode === 204 && bytes === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8')); }
                catch { return finish(error('EPROTO', 'Invalid game response.')); }
                if (!value || typeof value !== 'object' || Array.isArray(value)) return finish(error('EPROTO', 'Invalid game response.'));
                if (value.ok === false || value.success === false || value.error || ['error', 'failed'].includes(value.status)) {
                    return finish(error('EACCOUNT', 'Game could not accept the account request.'));
                }
                finish(null, value);
            });
        });
        request.once('close', () => { if (!settled) finish(error('ETRANSPORT', 'Game HTTP connection closed before acknowledgement.')); });
        request.end(body);
    });
}

function accountIn(message) {
    return String(message.username || String(message.message || '').match(/@([a-zA-Z0-9_.]+)/)?.[1] || '').toLowerCase();
}

function sendWebSocket(url, { signal, gameId, username, token }) {
    return new Promise((resolve, reject) => {
        if (signal.aborted) return reject(aborted(signal));
        let settled = false, sent = false, bootstrapped = false, accepting;
        // VS sends its complete gift catalogue on connection (currently ~345 KB).
        const socket = new WebSocket(url, { origin: url.origin.replace(/^ws:/, 'http:'),
            followRedirects: false, maxPayload: 2 * 1024 * 1024, handshakeTimeout: TIMEOUT_MS, lookup });
        const finish = failure => {
            if (settled) return;
            settled = true;
            clearImmediate(accepting);
            signal.removeEventListener('abort', cancel);
            if (failure) socket.terminate(); else {
                socket.close();
                const closeTimer = setTimeout(() => socket.terminate(), 250);
                closeTimer.unref();
                socket.once('close', () => clearTimeout(closeTimer));
            }
            if (failure) reject(failure); else resolve();
        };
        const cancel = () => finish(aborted(signal));
        const send = value => socket.send(JSON.stringify(value), failure => {
            if (failure) finish(error('ETRANSPORT', 'Game account request could not be sent.'));
        });
        const accept = () => {
            // Let other frames in this same batch report an immediate rejection.
            if (!accepting) accepting = setImmediate(() => finish());
        };
        signal.addEventListener('abort', cancel, { once: true });
        socket.on('error', () => finish(error('ETRANSPORT', 'Game WebSocket handoff failed.')));
        socket.once('close', () => { if (!settled) finish(error('ETRANSPORT', 'Game WebSocket closed before acknowledgement.')); });
        socket.once('open', () => { if (token) send({ token }); });
        socket.on('message', raw => {
            if (settled) return;
            let data;
            try { data = JSON.parse(raw); } catch { finish(error('EPROTO', 'Invalid game WebSocket response.')); return; }
            if (!data || typeof data !== 'object') return;
            const pony = gameId === 'pony-life';
            if (pony && data.error) return finish(error('EACCOUNT', 'Game rejected the account request.'));
            const relevant = pony ? data.live && typeof data.live === 'object'
                : data.type === (gameId === 'puanlama' ? 'puanlamaStatus' : 'status');
            if (!bootstrapped) {
                if (!relevant) return;
                bootstrapped = true;
                // Read initial/authenticated state BEFORE sending the command.
                // Orbit/Duck's initial "connected" only means an SDK object exists.
                if (pony && data.live.status === 'connected' && accountIn(data.live) === username.toLowerCase()) return accept();
                sent = true;
                send({ type: pony ? 'connect' : WS_TYPES.get(gameId), username });
                return;
            }
            if (!sent) return;
            if (!relevant) return;
            const status = pony ? data.live : data;
            const account = accountIn(status);
            if (account && account !== username.toLowerCase()) return;
            const state = status.state || status.status;
            const message = String(status.message || '');
            if (state === 'error' || /^(?:Hata:|Bağlanılamadı:)/u.test(message)) return finish(error('EACCOUNT', 'Game could not accept the account request.'));
            if (pony) {
                if (account === username.toLowerCase() && ['connecting', 'connected'].includes(state)) accept();
            } else if (gameId === 'puanlama') {
                // The installed package sends just this text. Updated hosts can also identify the account.
                if ((account && state === 'connecting') || (!account && !state && message === 'Bağlanıyor...')) accept();
            } else if (account === username.toLowerCase() && (state === 'connecting' || /yayınına bağlanılıyor/u.test(message))) accept();
        });
    });
}

// "requested" means the game acknowledged the account request. It never means
// TikTok is connected or a gift/profile was delivered. One total deadline covers
// session retrieval, authentication, command acceptance and cancellation.
async function handoffGameAccount({ gameId, baseURL, username, signal, sessionId, timeoutMs = TIMEOUT_MS } = {}) {
    const clean = String(username || '').trim().replace(/^@/, '');
    if (!clean) return { requested: false };
    if (!WS_TYPES.has(gameId) && !NATIVE.has(gameId) && !['frog-river', 'tightrope-balance', 'pony-life', 'caahr'].includes(gameId)) {
        throw error('ENOTSUP', 'Unsupported game account handoff.');
    }
    if (!/^[a-zA-Z0-9_.]{2,32}$/.test(clean)) throw error('EINVAL', 'Invalid TikTok username.');
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > TIMEOUT_MS) throw error('EINVAL', 'Invalid game account deadline.');
    const base = localBase(baseURL);
    if (signal?.aborted) throw aborted(signal);
    const controller = new AbortController();
    const cancel = () => controller.abort(aborted(signal));
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => controller.abort(error('ETIMEDOUT', 'Game account handoff timed out.')), timeoutMs);
    const transport = { signal: controller.signal };
    try {
        if (WS_TYPES.has(gameId)) {
            const url = new URL(base); url.protocol = 'ws:';
            await sendWebSocket(url, { ...transport, gameId, username: clean });
        } else if (gameId === 'frog-river' || gameId === 'pony-life') {
            const session = await requestJSON(new URL('/api/session', base), transport);
            if (typeof session?.token !== 'string' || !/^[a-zA-Z0-9_-]{1,256}$/.test(session.token)) throw error('EPROTO', 'Game session token is missing or invalid.');
            if (gameId === 'frog-river') {
                const reply = await requestJSON(new URL('/api/connect', base), { ...transport, token: session.token, payload: { username: clean } });
                if (reply.ok !== true) throw error('EPROTO', 'Game did not acknowledge the account request.');
            } else {
                const url = new URL('/live', base); url.protocol = 'ws:';
                await sendWebSocket(url, { ...transport, gameId, username: clean, token: session.token });
            }
        } else {
            const payload = { username: clean };
            if (NATIVE.has(gameId)) {
                if (sessionId !== undefined && (typeof sessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(sessionId))) throw error('EINVAL', 'Invalid game session identifier.');
                payload.session = sessionId || randomUUID();
            }
            await requestJSON(new URL(NATIVE.has(gameId) ? '/connect' : '/api/connect', base), { ...transport, payload });
        }
        return { requested: true };
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
    }
}

module.exports = { handoffGameAccount };
