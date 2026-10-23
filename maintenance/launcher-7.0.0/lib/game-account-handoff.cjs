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
const NATIVE = new Set(['snow-war', 'battle-royale', 'zombie-war']);
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

function requestJSON(url, { signal, parentSignal, payload, token, deadline }) {
    return new Promise((resolve, reject) => {
        if (signal.aborted) { reject(aborted(signal)); return; }
        const body = payload === undefined ? null : JSON.stringify(payload);
        let sent = false;
        const request = http.request(url, {
            method: body === null ? 'GET' : 'POST', agent: false, lookup,
            headers: body === null ? {} : { 'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body), ...(token ? { 'X-Session-Token': token } : {}) }
        });
        const cancel = () => request.destroy(aborted(signal));
        const parentCancel = () => request.destroy(aborted(parentSignal));
        const timer = setTimeout(() => request.destroy(error('ETIMEDOUT', 'Game account handoff timed out.')), Math.max(1, deadline - Date.now()));
        const cleanup = () => {
            clearTimeout(timer);
            signal.removeEventListener('abort', cancel);
            parentSignal?.removeEventListener('abort', parentCancel);
        };
        signal.addEventListener('abort', cancel, { once: true });
        parentSignal?.addEventListener('abort', parentCancel, { once: true });
        request.on('error', failure => { cleanup(); if (!sent) reject(failure); });
        request.once('close', cleanup);
        request.once('response', response => {
            if (body !== null) { response.resume(); return; }
            if (response.statusCode !== 200) {
                response.resume(); reject(error('EHTTP', 'Game session endpoint did not accept the request.')); request.destroy(); return;
            }
            let data = '';
            response.setEncoding('utf8');
            response.on('data', chunk => {
                data += chunk;
                if (data.length > 65536) request.destroy(error('EPROTO', 'Game session response is too large.'));
            });
            response.on('error', reject);
            response.once('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { reject(error('EPROTO', 'Invalid game session response.')); }
            });
        });
        // Tightrope responds after its TikTok handshake. Report only that our request was flushed.
        if (body !== null) request.once('finish', () => { sent = true; resolve(); });
        request.end(body);
    });
}

function sendWebSocket(url, messages, signal) {
    return new Promise((resolve, reject) => {
        if (signal.aborted) { reject(aborted(signal)); return; }
        let settled = false;
        const socket = new WebSocket(url, { origin: url.origin.replace(/^ws:/, 'http:'),
            followRedirects: false, maxPayload: 65536, handshakeTimeout: TIMEOUT_MS, lookup });
        const cancel = () => finish(aborted(signal));
        const finish = failure => {
            if (settled) return;
            settled = true;
            signal.removeEventListener('abort', cancel);
            // send callbacks below run before close(), preserving frame ordering and the connect request.
            if (failure) socket.terminate(); else {
                socket.close();
                const closeTimer = setTimeout(() => socket.terminate(), 250);
                closeTimer.unref();
                socket.once('close', () => clearTimeout(closeTimer));
            }
            if (failure) reject(failure); else resolve();
        };
        signal.addEventListener('abort', cancel, { once: true });
        socket.on('error', () => finish(error('ETRANSPORT', 'Game WebSocket handoff failed.')));
        socket.once('close', () => { if (!settled) finish(error('ETRANSPORT', 'Game WebSocket closed before handoff.')); });
        socket.once('open', () => {
            const send = index => {
                if (settled) return;
                if (index === messages.length) { finish(); return; }
                socket.send(JSON.stringify(messages[index]), failure => {
                    if (failure) finish(error('ETRANSPORT', 'Game account request could not be sent.'));
                    else send(index + 1);
                });
            };
            send(0);
        });
    });
}

async function handoffGameAccount({ gameId, baseURL, username, signal, sessionId } = {}) {
    const clean = String(username || '').trim().replace(/^@/, '');
    if (!clean) return { requested: false };
    if (!WS_TYPES.has(gameId) && !NATIVE.has(gameId) && !['frog-river', 'tightrope-balance', 'pony-life', 'caahr'].includes(gameId)) {
        throw error('ENOTSUP', 'Unsupported game account handoff.');
    }
    if (!/^[a-zA-Z0-9_.]{2,32}$/.test(clean)) throw error('EINVAL', 'Invalid TikTok username.');
    const base = localBase(baseURL);
    if (signal?.aborted) throw aborted(signal);
    const controller = new AbortController();
    const cancel = () => controller.abort(aborted(signal));
    signal?.addEventListener('abort', cancel, { once: true });
    const deadline = Date.now() + TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(error('ETIMEDOUT', 'Game account handoff timed out.')), TIMEOUT_MS);
    const transport = { signal: controller.signal, parentSignal: signal, deadline };
    try {
        if (WS_TYPES.has(gameId)) {
            const url = new URL(base); url.protocol = 'ws:';
            await sendWebSocket(url, [{ type: WS_TYPES.get(gameId), username: clean }], controller.signal);
        } else if (gameId === 'frog-river' || gameId === 'pony-life') {
            const session = await requestJSON(new URL('/api/session', base), transport);
            if (typeof session?.token !== 'string' || !/^[a-zA-Z0-9_-]{1,256}$/.test(session.token)) throw error('EPROTO', 'Game session token is missing or invalid.');
            if (gameId === 'frog-river') {
                await requestJSON(new URL('/api/connect', base), { ...transport, token: session.token, payload: { username: clean } });
            } else {
                const url = new URL('/live', base); url.protocol = 'ws:';
                await sendWebSocket(url, [{ token: session.token }, { type: 'connect', username: clean }], controller.signal);
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
