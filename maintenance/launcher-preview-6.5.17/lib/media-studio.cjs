'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const STORE_KEY = 'media_studio_v1';
const BASE = '/tikmng/media';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TYPES = Object.freeze({
    '.mp4': ['video', 'video/mp4'], '.webm': ['video', 'video/webm'],
    '.mp3': ['audio', 'audio/mpeg'], '.wav': ['audio', 'audio/wav'], '.ogg': ['audio', 'audio/ogg']
});
const LIMITS = Object.freeze({ items: 1000, clients: 50, events: 100, dedupe: 4096, listeners: 50 });
const ASSETS = path.join(__dirname, '..', 'renderer', 'studio');
const DEFAULTS = Object.freeze({ trigger: 'gift', giftId: '', likeThreshold: 100,
    startSeconds: 0, endSeconds: null, volume: 1, cooldownSeconds: 0, enabled: true });

function remoteMetadata(value, requestedKind) {
    if (typeof value !== 'string' || value.length > 8192 || /[\x00-\x20\x7f]/.test(value)) throw new TypeError('Invalid HTTPS media URL');
    let url;
    try { url = new URL(value); } catch { throw new TypeError('Invalid HTTPS media URL'); }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new TypeError('HTTPS media URL without credentials required');
    url.hash = '';
    const extension = path.extname(url.pathname).toLowerCase();
    const detected = TYPES[extension];
    const kind = requestedKind ?? detected?.[0] ?? 'video';
    if (!['video', 'audio'].includes(kind) || (detected && detected[0] !== kind)) throw new TypeError('Invalid remote media kind');
    let filename;
    try { filename = decodeURIComponent(url.pathname.split('/').pop() || ''); } catch { filename = ''; }
    filename = filename.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 255).trim() || `Remote ${kind}`;
    return { sourceUrl: url.href, kind, mime: detected?.[1] || null, filename, file: null, bytes: null };
}

function normalizeChannel(value) {
    return String(value || 'varsayilan').replace(/^@/, '').trim().toLocaleLowerCase('tr-TR')
        .replace(/[^a-z0-9._-]/g, '_').slice(0, 128) || 'varsayilan';
}

function giftId(value) {
    if (value === '' || value === undefined || value === null) return '';
    if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0)) throw new TypeError('Invalid giftId');
    if (!['string', 'number', 'bigint'].includes(typeof value)) throw new TypeError('Invalid giftId');
    const text = String(value).trim();
    if (!/^\d{1,32}$/.test(text) || BigInt(text) <= 0n) throw new TypeError('Invalid giftId');
    return BigInt(text).toString();
}

function textField(value, name, max, allowEmpty = false) {
    if (typeof value !== 'string' || /[\x00-\x1f\x7f]/.test(value) || value.trim().length > max || (!allowEmpty && !value.trim())) {
        throw new TypeError(`Invalid ${name}`);
    }
    return value.trim();
}

function numberField(value, name, max, integer = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value))) {
        throw new TypeError(`Invalid ${name}`);
    }
    return value;
}

function validateSettings(input, previous) {
    const next = { ...previous };
    for (const name of ['title', 'category', 'trigger', 'giftId', 'likeThreshold', 'startSeconds', 'endSeconds', 'volume', 'cooldownSeconds', 'enabled']) {
        if (Object.hasOwn(input, name)) next[name] = input[name];
    }
    next.title = textField(next.title, 'title', 160);
    next.category = textField(next.category, 'category', 80, true);
    if (!['gift', 'follow', 'like'].includes(next.trigger)) throw new TypeError('Invalid trigger');
    next.giftId = giftId(next.giftId);
    numberField(next.likeThreshold, 'likeThreshold', 1000000, true);
    if (next.likeThreshold < 1) throw new TypeError('Invalid likeThreshold');
    numberField(next.startSeconds, 'startSeconds', 86400);
    if (next.endSeconds !== null) {
        numberField(next.endSeconds, 'endSeconds', 86400);
        if (next.endSeconds <= next.startSeconds) throw new TypeError('endSeconds must exceed startSeconds');
    }
    numberField(next.volume, 'volume', 1);
    numberField(next.cooldownSeconds, 'cooldownSeconds', 86400);
    if (typeof next.enabled !== 'boolean') throw new TypeError('Invalid enabled');
    return next;
}

/**
 * Parent contract (no Electron dependency):
 * - store supplies synchronous get(key, fallback)/set(key, value); root is the absolute,
 *   user-selected media directory. Only STORE_KEY is written, with relative owned files.
 * - list/save/remove/test use getChannel(); ingest(type, ORIGINAL payload, channel)
 *   runs after the parent's existing dedupe, before widget display records lose giftId.
 * - importFiles(paths) is asynchronous; other methods, including handleRequest, are sync.
 * - handleRequest(req, res, WHATWG_URL) returns true iff it owns the route, including
 *   rejected requests. Mount before generic static routes; retain parent's loopback gate.
 * - list returns redacted current-channel records. previewUrl and mediaUrl are
 *   origin-relative protected URLs including key/channel. url is the HTTPS source
 *   for remote items, otherwise ''. save({title,url,...}) without id creates a remote
 *   item; save({id,url,...}) replaces its source while preserving its UUID. Extensionless
 *   URLs default to video; pass kind:'audio' when needed. Remote file requests redirect
 *   to HTTPS for browser playback (no server fetch/download or range proxy).
 * - SSE event "studio:play" and onEvent/addListener receive the same JSON-safe object:
 *   {type:'studio:play', id, channel, createdAt, test, item, trigger:{type,eventId,
 *    giftId,count}}. Profile data is omitted; parent owns renderer/TTS enrichment.
 *   addListener(fn) returns an unsubscribe function. Listener exceptions are isolated.
 * - test(id) bypasses enabled/trigger/cooldown; ingest emits once per final gift per
 *   matching item (never by gift name), with independent cooldowns. Like remainders
 *   are per item/channel, threshold defaults to 100; excess over the burst cap is dropped.
 * - No event history or offline queue is stored. close() before recreating for a new
 *   root/key or shutting down. Runtime dedupe/remainders/cooldowns reset on restart.
 */
function createMediaStudio({ store, root, accessKey, getChannel = () => 'varsayilan', onEvent } = {}) {
    if (!store || typeof store.get !== 'function' || typeof store.set !== 'function') throw new TypeError('store.get/set required');
    if (typeof root !== 'string' || !path.isAbsolute(root)) throw new TypeError('Absolute media root required');
    if (typeof accessKey !== 'string' || !accessKey.length || accessKey.length > 512) throw new TypeError('accessKey required');
    if (typeof getChannel !== 'function') throw new TypeError('getChannel must be a function');
    const mediaRoot = path.resolve(root);
    const keyHash = crypto.createHash('sha256').update(accessKey).digest();
    const clients = new Set();
    const listeners = new Set();
    const recent = new Map();
    const cooldowns = new Map();
    const remainders = new Map();
    let closed = false;
    let items = [];
    const saved = store.get(STORE_KEY, { version: 1, items: [] });
    if (saved?.version === 1 && Array.isArray(saved.items)) {
        for (const entry of saved.items.slice(0, LIMITS.items)) {
            try {
                if (!entry || !UUID.test(entry.id) || items.some(item => item.id === entry.id)) continue;
                let media;
                if (entry.sourceUrl) media = remoteMetadata(entry.sourceUrl, entry.kind);
                else {
                    const extension = path.extname(entry.file || '');
                    if (!TYPES[extension] || entry.file !== entry.id + extension) continue;
                    media = { file: entry.file, bytes: numberField(entry.bytes, 'bytes', Number.MAX_SAFE_INTEGER, true) };
                }
                const clean = validateSettings(entry, { id: entry.id, ...DEFAULTS });
                items.push({ ...clean, ...media, channel: normalizeChannel(entry.channel),
                    filename: textField(entry.filename, 'filename', 255),
                    createdAt: numberField(entry.createdAt, 'createdAt', Number.MAX_SAFE_INTEGER, true) });
            } catch { /* Ignore corrupt records without making them addressable. */ }
        }
    }

    const currentChannel = () => normalizeChannel(getChannel());
    const assertOpen = () => { if (closed) throw new Error('Media Studio is closed'); };
    const configured = item => item.trigger !== 'gift' || Boolean(item.giftId);
    const active = item => item.enabled && configured(item);
    const protectedUrl = (route, channel) => `${route}?${new URLSearchParams({ key: accessKey, channel })}`;
    function publicItem(item) {
        const [kind, mime] = item.sourceUrl ? [item.kind, item.mime] : TYPES[path.extname(item.file)];
        return {
            id: item.id, title: item.title, category: item.category, channel: item.channel,
            trigger: item.trigger, giftId: item.giftId, likeThreshold: item.likeThreshold,
            startSeconds: item.startSeconds, endSeconds: item.endSeconds, volume: item.volume,
            cooldownSeconds: item.cooldownSeconds, enabled: item.enabled, configured: configured(item),
            filename: item.filename, bytes: item.bytes, createdAt: item.createdAt, kind, mime,
            url: item.sourceUrl || '', remote: Boolean(item.sourceUrl),
            previewUrl: protectedUrl(`${BASE}/${item.id}`, item.channel),
            mediaUrl: protectedUrl(`${BASE}/file/${item.id}`, item.channel)
        };
    }
    function commit(next) {
        store.set(STORE_KEY, { version: 1, items: next.map(item => ({ ...item })) });
        items = next;
    }
    function find(id, channel = currentChannel()) {
        return typeof id === 'string' && UUID.test(id) ? items.find(item => item.id === id && item.channel === channel) : undefined;
    }
    function requireItem(id) {
        const item = find(id);
        if (!item) throw new Error('Unknown media item');
        return item;
    }
    function addListener(listener) {
        assertOpen();
        if (typeof listener !== 'function') throw new TypeError('listener must be a function');
        if (!listeners.has(listener) && listeners.size >= LIMITS.listeners) throw new Error('Too many Media Studio listeners');
        listeners.add(listener);
        return () => listeners.delete(listener);
    }
    if (onEvent !== undefined) addListener(onEvent);

    async function importFiles(paths, metadata = []) {
        assertOpen();
        if (!Array.isArray(paths) || !paths.length || paths.length > 128 || items.length + paths.length > LIMITS.items) {
            throw new TypeError('Invalid import batch');
        }
        if (!Array.isArray(metadata) || (metadata.length && metadata.length !== paths.length)) throw new TypeError('Invalid import metadata');
        const channel = currentChannel();
        const sources = [];
        for (const [index, source] of paths.entries()) {
            if (typeof source !== 'string' || !path.isAbsolute(source)) throw new TypeError('Absolute source path required');
            const extension = path.extname(source).toLowerCase();
            if (!TYPES[extension]) throw new TypeError('Unsupported media type');
            const stat = await fs.promises.stat(source);
            if (!stat.isFile()) throw new TypeError('Source must be a file');
            const filename = textField(path.basename(source), 'filename', 255);
            const title = textField(metadata[index]?.title ?? path.basename(filename, path.extname(filename)).slice(0, 160), 'title', 160);
            const category = textField(metadata[index]?.category ?? (TYPES[extension][0] === 'video' ? 'Video' : 'Audio'), 'category', 80, true);
            sources.push({ source, extension, filename, bytes: stat.size, title, category });
        }
        await fs.promises.mkdir(mediaRoot, { recursive: true });
        const added = [];
        const copies = [];
        try {
            for (const source of sources) {
                assertOpen();
                const id = crypto.randomUUID();
                const file = id + source.extension;
                const destination = path.join(mediaRoot, file);
                await fs.promises.copyFile(source.source, destination, fs.constants.COPYFILE_EXCL);
                copies.push(destination);
                added.push({ id, file, channel, filename: source.filename, bytes: source.bytes, createdAt: Date.now(),
                    title: source.title, category: source.category, ...DEFAULTS });
            }
            assertOpen();
            if (items.length + added.length > LIMITS.items) throw new Error('Media library is full');
            commit([...items, ...added]);
            return added.map(publicItem);
        } catch (error) {
            await Promise.allSettled(copies.map(file => fs.promises.unlink(file)));
            throw error;
        }
    }

    function list() { assertOpen(); return items.filter(item => item.channel === currentChannel()).map(publicItem); }
    function save(input) {
        assertOpen();
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Media settings required');
        const previous = input.id === undefined ? null : requireItem(input.id);
        const source = Object.hasOwn(input, 'url') && input.url !== '' ? remoteMetadata(input.url, input.kind) : null;
        if (!previous && !source) throw new TypeError('New items require a HTTPS media URL');
        if (!previous && items.length >= LIMITS.items) throw new Error('Media library is full');
        const next = validateSettings(input, { ...(previous || { id: crypto.randomUUID(), channel: currentChannel(),
            createdAt: Date.now(), ...DEFAULTS, title: source.filename.slice(0, 160), category: source.kind === 'audio' ? 'Audio' : 'Video' }),
            ...(source || {}) });
        commit(previous ? items.map(item => item.id === next.id ? next : item) : [...items, next]);
        if (!previous) return publicItem(next);
        if (next.likeThreshold !== previous.likeThreshold || next.trigger !== previous.trigger || next.enabled !== previous.enabled) remainders.delete(next.id);
        return publicItem(next);
    }
    function remove(id) {
        assertOpen();
        requireItem(id);
        commit(items.filter(item => item.id !== id));
        remainders.delete(id);
        cooldowns.delete(id);
        return true;
    }

    function disconnect(client) {
        clients.delete(client);
        if (!client.res.destroyed && !client.res.writableEnded) client.res.destroy();
    }
    function write(client, frame) {
        try {
            if (client.res.destroyed || client.res.writableEnded || !client.res.write(frame)) disconnect(client);
        } catch { disconnect(client); }
    }
    function emit(item, trigger, isTest = false) {
        const event = { type: 'studio:play', id: crypto.randomUUID(), channel: item.channel,
            createdAt: Date.now(), test: isTest, item: publicItem(item), trigger };
        const frame = `event: studio:play\ndata: ${JSON.stringify(event)}\n\n`;
        for (const client of clients) {
            if (client.channel === item.channel && (!client.itemId || client.itemId === item.id)) write(client, frame);
        }
        for (const listener of listeners) {
            try {
                const result = listener(structuredClone(event));
                if (result && typeof result.catch === 'function') result.catch(() => {});
            } catch { /* A renderer notification must not interrupt media delivery. */ }
        }
        return event;
    }
    function test(id) {
        assertOpen();
        return emit(requireItem(id), { type: 'test', eventId: '', giftId: '', count: 1 }, true);
    }
    function ingest(type, payload = {}, channel = currentChannel()) {
        assertOpen();
        type = String(type || '').toLowerCase();
        if (!['gift', 'follow', 'like'].includes(type) || !payload || typeof payload !== 'object') return [];
        channel = normalizeChannel(channel);
        const gift = payload.gift || payload.extendedGiftInfo || {};
        const rawGiftType = payload.giftType ?? gift.giftType ?? gift.type;
        const streak = Number(rawGiftType) === 1 || (rawGiftType === undefined && Object.hasOwn(payload, 'repeatEnd'));
        if (type === 'gift' && streak && ![true, 1, '1', 'true'].includes(payload.repeatEnd)) return [];
        let normalizedGift = '';
        try { if (type === 'gift') normalizedGift = giftId(payload.giftId ?? payload.gift_id ?? gift.id ?? gift.giftId); } catch { return []; }
        if (type === 'gift' && !normalizedGift) return [];
        const count = Number(type === 'like' ? (payload.likeCount ?? payload.count ?? 1) : (payload.repeatCount ?? payload.count ?? 1));
        if (!Number.isSafeInteger(count) || count < 1) return [];
        const eventId = String(payload.eventId || payload.msgId || payload.logId || payload.id || '').slice(0, 256);
        const now = Date.now();
        if (eventId) {
            const key = JSON.stringify([channel, type, eventId]);
            if (recent.has(key) && now - recent.get(key) < 300000) return [];
            recent.delete(key);
            recent.set(key, now);
            while (recent.size > LIMITS.dedupe) recent.delete(recent.keys().next().value);
        }
        const trigger = { type, eventId, giftId: normalizedGift, count };
        const events = [];
        for (const item of items) {
            if (item.channel !== channel || !active(item) || item.trigger !== type || (type === 'gift' && item.giftId !== normalizedGift)) continue;
            let plays = 1;
            if (type === 'like') {
                const sum = (remainders.get(item.id) || 0) + count % item.likeThreshold;
                plays = Math.floor(count / item.likeThreshold) + Math.floor(sum / item.likeThreshold);
                remainders.set(item.id, sum % item.likeThreshold);
            }
            plays = Math.min(plays, LIMITS.events - events.length);
            for (let index = 0; index < plays; index++) {
                if (item.cooldownSeconds > 0 && cooldowns.has(item.id) && now - cooldowns.get(item.id) < item.cooldownSeconds * 1000) break;
                cooldowns.set(item.id, now);
                events.push(emit(item, trigger));
            }
        }
        return events;
    }

    function reply(req, res, status, type, body = '') {
        res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
        res.end(req.method === 'HEAD' ? undefined : body);
    }
    function stream(req, res, item) {
        if (item.sourceUrl) {
            res.writeHead(307, { Location: item.sourceUrl, 'Content-Length': 0 });
            res.end();
            return;
        }
        let descriptor;
        try {
            const rootPath = fs.realpathSync(mediaRoot);
            const filePath = fs.realpathSync(path.join(mediaRoot, item.file));
            const relative = path.relative(rootPath, filePath);
            if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) throw new Error('Outside root');
            descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
            const stat = fs.fstatSync(descriptor);
            if (!stat.isFile()) throw new Error('Not a regular file');
            let start = 0;
            let end = stat.size - 1;
            const range = req.headers.range;
            const headers = { 'Accept-Ranges': 'bytes', 'Content-Type': TYPES[path.extname(item.file)][1] };
            if (range !== undefined) {
                const match = /^bytes=(\d*)-(\d*)$/.exec(range);
                if (!match || (!match[1] && !match[2]) || stat.size === 0) throw Object.assign(new Error('Range'), { range: stat.size });
                if (!match[1]) {
                    const suffix = Number(match[2]);
                    if (!Number.isSafeInteger(suffix) || suffix <= 0) throw Object.assign(new Error('Range'), { range: stat.size });
                    start = Math.max(0, stat.size - suffix);
                } else {
                    start = Number(match[1]);
                    end = match[2] ? Math.min(Number(match[2]), end) : end;
                    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(Number(match[2] || end)) || start >= stat.size || start > end) {
                        throw Object.assign(new Error('Range'), { range: stat.size });
                    }
                }
                headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
            }
            headers['Content-Length'] = Math.max(0, end - start + 1);
            res.writeHead(range === undefined ? 200 : 206, headers);
            if (req.method === 'HEAD' || stat.size === 0) {
                fs.closeSync(descriptor);
                descriptor = undefined;
                res.end();
                return;
            }
            const source = fs.createReadStream(null, { fd: descriptor, autoClose: true, start, end });
            descriptor = undefined;
            res.once('close', () => source.destroy());
            source.once('error', () => res.destroy());
            source.pipe(res);
        } catch (error) {
            if (descriptor !== undefined) fs.closeSync(descriptor);
            if (error.range !== undefined) {
                res.setHeader('Content-Range', `bytes */${error.range}`);
                reply(req, res, 416, 'text/plain; charset=utf-8', 'Invalid range');
            } else reply(req, res, 404, 'text/plain; charset=utf-8', 'Media unavailable');
        }
    }

    function handleRequest(req, res, url) {
        if (!(url instanceof URL)) url = new URL(url || req.url, 'http://127.0.0.1');
        if (url.pathname !== BASE && !url.pathname.startsWith(BASE + '/')) return false;
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        const supplied = url.searchParams.get('key') || '';
        const authorized = crypto.timingSafeEqual(keyHash, crypto.createHash('sha256').update(supplied).digest());
        if (!authorized) { reply(req, res, 403, 'text/plain; charset=utf-8', 'Forbidden'); return true; }
        if (closed) { reply(req, res, 503, 'text/plain; charset=utf-8', 'Media Studio closed'); return true; }
        if (!['GET', 'HEAD'].includes(req.method)) {
            res.setHeader('Allow', 'GET, HEAD');
            reply(req, res, 405, 'text/plain; charset=utf-8', 'Method not allowed'); return true;
        }
        const channel = normalizeChannel(url.searchParams.get('channel') || currentChannel());
        const route = url.pathname.slice(BASE.length);
        if (route.startsWith('/file/')) {
            const item = find(route.slice(6), channel);
            if (item) stream(req, res, item);
            else reply(req, res, 404, 'text/plain; charset=utf-8', 'Unknown media item');
            return true;
        }
        if (route === '/client.js' || route === '/client.css') {
            const name = route === '/client.js' ? 'overlay.js' : 'overlay.css';
            try { reply(req, res, 200, name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8', fs.readFileSync(path.join(ASSETS, name))); }
            catch { reply(req, res, 404, 'text/plain; charset=utf-8', 'Asset unavailable'); }
            return true;
        }
        if (route === '/events') {
            const itemId = url.searchParams.get('item') || '';
            if (itemId && !find(itemId, channel)) { reply(req, res, 404, 'text/plain; charset=utf-8', 'Unknown media item'); return true; }
            if (req.method === 'HEAD') { reply(req, res, 200, 'text/event-stream'); return true; }
            if (clients.size >= LIMITS.clients) { reply(req, res, 503, 'text/plain; charset=utf-8', 'Too many media clients'); return true; }
            res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
            res.flushHeaders?.();
            const client = { res, channel, itemId };
            clients.add(client);
            res.once('close', () => clients.delete(client));
            res.once('error', () => disconnect(client));
            req.socket?.setTimeout(0);
            write(client, ': connected\nretry: 2000\n\n');
            return true;
        }
        const itemId = route ? route.slice(1) : '';
        const selectedItem = itemId ? find(itemId, channel) : null;
        if (route && !selectedItem) { reply(req, res, 404, 'text/plain; charset=utf-8', 'Unknown media item'); return true; }
        try {
            const scriptUrl = protectedUrl(`${BASE}/client.js`, channel);
            const cssUrl = protectedUrl(`${BASE}/client.css`, channel);
            const nonce = crypto.randomBytes(18).toString('base64');
            res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'self'; media-src 'self' https:; connect-src 'self'; base-uri 'none'; frame-ancestors 'self' file: http://127.0.0.1:* http://localhost:* http://tikmng.localhost:*`);
            const attribute = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
            const html = fs.readFileSync(path.join(ASSETS, 'overlay.html'), 'utf8')
                .replaceAll('{{NONCE}}', attribute(nonce)).replace('{{CLIENT_CSS}}', attribute(cssUrl)).replace('{{CLIENT_JS}}', attribute(scriptUrl))
                .replace('{{CHANNEL}}', attribute(channel)).replace('{{ITEM}}', attribute(itemId))
                .replace('{{MEDIA}}', attribute(selectedItem ? JSON.stringify(publicItem(selectedItem)) : ''));
            reply(req, res, 200, 'text/html; charset=utf-8', html);
        } catch { reply(req, res, 500, 'text/plain; charset=utf-8', 'Overlay unavailable'); }
        return true;
    }

    const heartbeat = setInterval(() => {
        for (const client of clients) write(client, ': heartbeat\n\n');
    }, 15000);
    heartbeat.unref?.();
    function close() {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        for (const client of clients) disconnect(client);
        listeners.clear(); recent.clear(); cooldowns.clear(); remainders.clear();
    }
    return { list, importFiles, save, remove, ingest, test, handleRequest, addListener, close };
}

module.exports = { createMediaStudio };
