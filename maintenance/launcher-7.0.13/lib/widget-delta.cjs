'use strict';
const crypto = require('node:crypto');
const { diff } = require('../renderer/widgets/state-patch.js');
const tokenFor = body => crypto.createHash('sha256').update(body).digest('hex').slice(0, 32);
function scope(url) {
    const copy = new URL(url);
    for (const key of ['transport', 'after', 'wait', 't', 'patch', 'base', 'eventsAfter', 'history']) copy.searchParams.delete(key);
    copy.searchParams.sort();
    return copy.pathname + copy.search;
}
function createWidgetDelta({ now = Date.now, maxEntries = 128, maxBytes = 8 * 1024 * 1024,
    maxSnapshotBytes = 512 * 1024, ttlMs = 90000 } = {}) {
    const states = new Map(); let bytes = 0;
    function remove(key) { const saved = states.get(key); if (saved) { bytes -= saved.bytes; states.delete(key); } }
    function prune() {
        for (const [key, value] of states) if (now() - value.at >= ttlMs) remove(key);
        while (states.size > maxEntries || bytes > maxBytes) remove(states.keys().next().value);
    }
    function encode(value, revision, url) {
        if (url.searchParams.get('patch') !== '1') return JSON.stringify({ ...value, __stateRevision: revision });
        prune();
        const raw = JSON.stringify(value), size = Buffer.byteLength(raw), token = tokenFor(raw);
        const full = JSON.stringify({ ...value, __stateRevision: revision, __stateToken: token });
        if (size > maxSnapshotBytes) return full;
        const owner = scope(url), base = url.searchParams.get('base'), old = states.get(owner + '\0' + base);
        const normalized = JSON.parse(raw);
        let body = full;
        if (old && old.revision === url.searchParams.get('after')) {
            const operations = diff(old.value, normalized);
            if (operations) {
                const patch = JSON.stringify({ __stateRevision: revision, __stateToken: token,
                    __statePatch: { version: 1, base, operations } });
                if (Buffer.byteLength(patch) + 64 < Buffer.byteLength(full) * 0.85) body = patch;
            }
        }
        const key = owner + '\0' + token;
        remove(key);
        states.set(key, { value: normalized, revision, bytes: size, at: now() }); bytes += size;
        prune();
        return body;
    }
    function clear() { states.clear(); bytes = 0; }
    return { encode, clear, stats() { prune(); return { entries: states.size, bytes }; } };
}
module.exports = { createWidgetDelta };
