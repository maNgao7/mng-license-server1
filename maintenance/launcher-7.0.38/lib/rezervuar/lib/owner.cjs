'use strict';
const http = require('node:http');
function localURL(value) {
    const url = new URL(value);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
        throw new Error('owner-url');
    return url.origin;
}
function requestJSON(base, route, { token, method = 'GET', body, timeout = 2500 } = {}) {
    return new Promise((resolve, reject) => {
        const bytes = body === undefined ? null : Buffer.from(JSON.stringify(body));
        const req = http.request(base + route, { method, headers: {
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
            ...(bytes ? { 'Content-Type': 'application/json', 'Content-Length': bytes.length } : {})
        } }, res => {
            const chunks = []; let size = 0;
            res.on('data', chunk => { size += chunk.length; if (size > 4 * 1024 ** 2) req.destroy(new Error('owner-response-size')); else chunks.push(chunk); });
            res.on('end', () => {
                if (res.statusCode !== 200) return reject(new Error('owner-http-' + res.statusCode));
                try { resolve(JSON.parse(Buffer.concat(chunks))); } catch { reject(new Error('owner-response')); }
            });
            res.on('error', reject);
        });
        req.setTimeout(timeout, () => req.destroy(new Error('owner-timeout')));
        req.on('error', reject); req.end(bytes);
    });
}
// An actual HTTP response is evidence of a running owner, not merely an env var.
// A TCP connection that cannot complete HTTP is also unsafe to take over.
function responds(port) {
    return new Promise(resolve => {
        let connected = false, settled = false;
        const finish = value => { if (!settled) { settled = true; resolve(value); req.destroy(); } };
        const req = http.get({ hostname: '127.0.0.1', port, path: '/', agent: false }, res => { res.resume(); finish(true); });
        req.on('socket', socket => socket.once('connect', () => { connected = true; }));
        req.setTimeout(450, () => finish(connected));
        req.on('error', () => finish(connected));
    });
}
async function detectOwner(ports = [31975, 31976, 44181]) {
    const unique = [...new Set(ports)].filter(port => Number.isInteger(port) && port > 0 && port < 65536);
    const states = await Promise.all(unique.map(responds));
    return unique.filter((_, i) => states[i]);
}
function ownerFromEnvironment(env = process.env) {
    for (const [prefix, kind] of [['MNG_LIVE_OWNER', 'owner'], ['MNG_FORZA_PUBLISHER', 'forza']]) {
        const url = env[prefix + '_URL'], token = env[prefix + '_TOKEN'];
        if (!url && !token) continue;
        if (!url || !token) throw new Error('owner-config');
        return { url: localURL(url), token, kind };
    }
    return null;
}
module.exports = { requestJSON, detectOwner, ownerFromEnvironment, localURL };
