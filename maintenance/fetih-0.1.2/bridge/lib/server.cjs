'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { createLiveSession } = require('../vendor/live-session.cjs');
const { normalizeIncoming, clean } = require('./events.cjs');
const { createJournal } = require('./journal.cjs');
const { loadCatalog } = require('./catalog.cjs');
const { createProfiles } = require('./profiles.cjs');
const { createRuntimeProfiles } = require('./runtime-profiles.cjs');
const { requestJSON, detectOwner, localURL } = require('./owner.cjs');
const idle = { status: 'disconnected', username: '', message: 'Yayıncı hesabı bekleniyor.' };
const validUsername = value => /^[a-z0-9_.]{1,64}$/.test(value);
const fail = (code, message) => Object.assign(new Error(message), { code });

async function createBridge(options = {}) {
    const catalog = options.catalog || loadCatalog(options.catalogDirectory || path.join(__dirname, '../gift-assets'));
    const journal = createJournal(options.journalFile);
    const shared = options.sharedOwner;
    const owner = options.owner ? { ...options.owner, url: localURL(options.owner.url) } : null;
    // Compatible owners serve portraits themselves. Keep their authenticated
    // fetch path and avoid a second cache or public lookup for relayed gifts.
    const relaysPortraits = owner?.kind === 'owner';
    const profileSources = relaysPortraits ? null
        : options.profileSources || (options.enableProfileLookup ? createRuntimeProfiles() : null);
    const portraitDirectory = relaysPortraits ? null
        : options.portraitDirectory || (options.journalFile ? options.journalFile + '.portraits' : null);
    const profiles = createProfiles(portraitDirectory, { ...options.portraitCacheOptions, sources: profileSources,
        getCachedPortrait: relaysPortraits ? null : options.getCachedPortrait });
    const token = crypto.randomBytes(32).toString('hex');
    const guard = options.detectOwner || (() => detectOwner(options.ownerPorts));
    let state = { ...idle }, fault = '', closed = false, requested = '', remoteGeneration = 0;
    let remoteTimer, guardTimer, guardBusy = false, session, unsub;
    const sdkEvents = {};
    const operations = { tail: Promise.resolve() };
    const serialize = fn => {
        const next = operations.tail.then(fn);
        operations.tail = next.catch(() => {});
        return next;
    };
    function status() {
        const current = shared ? shared.getStatus() || idle : state;
        return { status: fault ? 'error' : String(current.status || 'disconnected'),
            username: clean(current.username || requested || (shared && shared.getChannel())),
            message: fault || profiles.issue || String(current.message || idle.message).slice(0, 512) };
    }
    function ingest(type, payload, channel) {
        if (closed || fault) return;
        let entry;
        try { entry = normalizeIncoming(type, payload, channel, journal.receipts); }
        catch (error) {
            // Incomplete packets must not poison a connection or authorize a
            // guessed identity. A later valid delivery can still be applied.
            if (/^(event-identity|event-id|gift-count|gift-id|chat-comment|event-count)$/.test(error.message)) return;
            fault = 'Yayın olayı okunamadı. Bağlantı durduruldu; bekleyen olaylar korundu.';
            session?.stop();
            return;
        }
        if (!entry) return;
        try { entry.value = profiles.observe(entry.value, payload); }
        catch { Object.assign(entry.value, { avatarUrl: '', bestPortraitUrl: '' }); }
        try {
            journal.push(entry);
        } catch (error) {
            fault = error.code && /^(EACCES|EPERM|ENOSPC|EIO)$/.test(error.code)
                ? 'Olay günlüğü yazılamadı. Bekleyen olaylar silinmedi; disk alanını ve izinleri kontrol edin.'
                : 'Yayın olayı güvenle işlenemedi (' + (/^[a-z-]+$/.test(error.message) ? error.message : 'storage') + '). Bağlantı durduruldu; bekleyen olaylar korundu.';
            session?.stop();
        }
    }
    const createConnection = options.createConnection || (async username => {
        // Resolve only from this self-contained runtime; never import launcher
        // settings, saved sessions, cookies, API keys, or credential files.
        const sdk = await import('tiktok-live-connector');
        Object.assign(sdkEvents, sdk.WebcastEvent, sdk.ControlEvent);
        return new sdk.TikTokLiveConnection(username, { processInitialData: false, enableExtendedGiftInfo: false });
    });
    async function assertNoOwner() {
        const ports = await guard();
        if (ports.length) throw fail(409, 'Launcher yayın sahibi çalışıyor. Paylaşılan publisher adresi sağlanmadığı için ikinci TikTok bağlantısı açılmadı. Launcher ön izlemesine owner-helper.cjs adaptörünü bağlayın.');
    }
    function ensureSession() {
        session ||= createLiveSession({ ...options.liveOptions, events: options.events || sdkEvents,
            createConnection: async username => {
                await assertNoOwner();
                if (closed || requested !== username) throw new Error('cancelled');
                return createConnection(username);
            }, onStatus: value => { state = value; },
            onGiftProgress: payload => ingest('gift', payload, requested),
            onEvent: (type, payload) => ingest(type, payload, requested) });
        return session;
    }
    function cancelRemote() {
        remoteGeneration++;
        clearTimeout(remoteTimer); remoteTimer = undefined;
    }
    function remoteFault() {
        state = { status: 'error', username: requested, message: 'Launcher paylaşımına ulaşılamıyor. İkinci TikTok bağlantısı açılmadı; paylaşım yeniden deneniyor.' };
    }
    async function startRemote(username) {
        cancelRemote();
        const generation = remoteGeneration;
        state = { status: 'connecting', username, message: 'Launcher yayın paylaşımına bağlanılıyor.' };
        let cursor = 0, remoteSession = '';
        let portraitCursor = 0, portraitSession = '';
        const portraitQuery = () => '&portraitAfter=' + portraitCursor
            + (portraitSession ? '&portraitSessionId=' + encodeURIComponent(portraitSession) : '');
        if (owner.kind !== 'forza') {
            try {
                await requestJSON(owner.url, '/connect', { token: owner.token, method: 'POST', body: { username }, timeout: 3000 });
            } catch { if (generation === remoteGeneration) remoteFault(); }
        }
        const poll = async () => {
            if (closed || generation !== remoteGeneration || !requested) return;
            try {
                const route = owner.kind === 'forza'
                    ? `/poll?username=${encodeURIComponent(username)}&after=${cursor}`
                    : `/state?after=${cursor}${remoteSession ? '&sessionId=' + encodeURIComponent(remoteSession) : ''}${portraitQuery()}`;
                let data;
                try { data = await requestJSON(owner.url, route, { token: owner.token }); }
                catch (error) {
                    // Owner restart: retain our durable receipts, reset its cursor.
                    if (error.message !== 'owner-http-409' || owner.kind === 'forza') throw error;
                    cursor = 0; remoteSession = '';
                    data = await requestJSON(owner.url, '/state?after=0' + portraitQuery(), { token: owner.token });
                }
                if (closed || generation !== remoteGeneration) return;
                if (data.schemaVersion !== 1 || !data.status || !Array.isArray(data.events)) throw new Error('owner-schema');
                if (data.status.username && clean(data.status.username) !== username) {
                    state = { status: 'error', username, message: 'Launcher farklı bir yayın hesabına bağlı. Oyunda aynı hesabı seçin.' };
                } else {
                    state = { status: data.status.status, username, message: String(data.status.message || 'Launcher yayın paylaşımı.').slice(0, 512) };
                    if (data.sessionId) remoteSession = data.sessionId;
                    for (const row of data.events) {
                        if (!Number.isSafeInteger(row.seq) || row.seq <= cursor || !row.value) throw new Error('owner-event');
                        // Legacy Forza /poll already expresses unit coins. The
                        // raw shared bus instead expresses coins * repeatCount.
                        const value = owner.kind === 'forza' && row.value.type === 'gift'
                            ? { ...row.value, giftCoinValue: row.value.giftCoinValue ?? row.value.coins } : row.value;
                        ingest(value.type, value, username);
                        if (fault) break;
                        cursor = row.seq; // Acknowledge upstream only after durable local append.
                    }
                    if (relaysPortraits && typeof data.portraitSessionId === 'string'
                        && /^[a-f0-9-]{36}$/.test(data.portraitSessionId)
                        && Number.isSafeInteger(data.portraitCursor) && data.portraitCursor >= 0
                        && Array.isArray(data.portraitUpdates)) {
                        profiles.relayUpdates(data.portraitUpdates, portraitSession !== data.portraitSessionId);
                        portraitSession = data.portraitSessionId;
                        portraitCursor = data.portraitCursor;
                    }
                }
            } catch (error) {
                if (!closed && generation === remoteGeneration) {
                    if (owner.kind === 'forza' && error.message === 'owner-http-409') state = {
                        status: 'error', username, message: 'Publisher başka bir yayın hesabına ait. B menüsünde launcher ile aynı hesabı seçin.'
                    };
                    else remoteFault();
                }
            }
            if (!closed && generation === remoteGeneration && !fault) remoteTimer = setTimeout(poll, 200);
        };
        if (generation === remoteGeneration) void poll();
    }
    if (shared) {
        if (typeof shared.subscribeSharedEvents !== 'function' || typeof shared.ensureLive !== 'function'
            || typeof shared.getStatus !== 'function' || typeof shared.getChannel !== 'function') throw new Error('owner-adapter');
        unsub = shared.subscribeSharedEvents((type, payload, meta = {}) => {
            if (meta.source !== 'live' || clean(meta.channel) !== clean(shared.getChannel())) return;
            // The launcher sends the original SDK like here before the flattened
            // like. Use its extra photo candidates without journaling a second like.
            if (type === 'forza-like') {
                try {
                    const entry = normalizeIncoming('like', payload, meta.channel, journal.receipts);
                    if (entry) profiles.observe(entry.value, payload);
                } catch {}
                return;
            }
            ingest(type === 'forza-gift-progress' ? 'gift' : type, payload, meta.channel);
        });
    }
    async function connect(value) {
        const username = clean(value);
        if (!validUsername(username)) throw fail(400, 'Geçerli bir TikTok kullanıcı adı girin.');
        if (closed) throw fail(503, 'Köprü kapalı.');
        if (fault) throw fail(503, fault);
        if (requested === username && status().status !== 'disconnected') return status();
        if (shared) {
            requested = username;
            const current = shared.getStatus();
            if (clean(current?.username) === username && ['connected', 'connecting', 'waiting'].includes(current.status)) return status();
            // ensureLive belongs to the existing launcher owner. It must itself
            // return the current session for repeated requests to the same name.
            void Promise.resolve().then(() => shared.ensureLive(username)).catch(() => {
                fault = 'Launcher yayın bağlantısını başlatamadı.';
            });
        } else if (owner) {
            requested = username;
            void startRemote(username);
        } else {
            try { await assertNoOwner(); }
            catch (error) { state = { status: 'error', username, message: error.message }; throw error; }
            requested = username;
            void ensureSession().start(username);
        }
        return status();
    }
    function disconnect() {
        if (shared) return status(); // A game never disconnects the launcher owner.
        requested = ''; cancelRemote(); session?.stop(); state = { ...idle, message: 'Bağlantı kapatıldı.' };
        return status();
    }
    if (!owner && !shared) {
        guardTimer = setInterval(async () => {
            if (closed || !requested || guardBusy) return;
            guardBusy = true;
            try { await assertNoOwner(); }
            catch {
                session?.stop(); requested = '';
                state = { status: 'error', username: '', message: 'Launcher yayın sahibi açıldı. Bağımsız bağlantı kapatıldı; launcher paylaşımı gerekli.' };
            } finally { guardBusy = false; }
        }, options.guardIntervalMs || 1000);
        guardTimer.unref();
    }
    const server = http.createServer(async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        const reply = (code, body) => { if (!res.destroyed) { res.writeHead(code); res.end(JSON.stringify(body)); } };
        const provided = Buffer.from(String(req.headers.authorization || ''));
        const expected = Buffer.from('Bearer ' + token);
        if (!['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
            || provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return reply(401, { error: 'Yetkisiz istek.' });
        try {
            const url = new URL(req.url, 'http://127.0.0.1');
            if (req.method === 'GET' && url.pathname === '/capabilities') {
                return reply(200, { schemaVersion: 1, publicPortraits: relaysPortraits
                    ? { backend: 'shared-owner', available: true, liveConnection: false }
                    : profileSources?.capability?.() || { backend: 'provided-or-disabled', available: !!profileSources } });
            }
            if (req.method === 'GET' && url.pathname === '/state') {
                const after = integer(url.searchParams.get('after') ?? '0', 0, journal.sequence);
                const clientSession = url.searchParams.get('sessionId');
                if (clientSession && clientSession !== journal.sessionId) throw fail(409, 'Olay oturumu değişti. İmleci sıfırlayın.');
                const portraitAfter = url.searchParams.get('portraitAfter');
                const portraitState = portraitAfter === null ? {}
                    : profiles.changes(integer(portraitAfter, 0, Number.MAX_SAFE_INTEGER), url.searchParams.get('portraitSessionId'));
                // after is the last successfully applied sequence, hence an ack.
                // Merely reading a batch with after=0 does not consume it.
                journal.ack(after);
                return reply(200, { schemaVersion: 1, status: status(), events: journal.rows(after),
                    sessionId: journal.sessionId, ...portraitState });
            }
            if (req.method === 'GET' && url.pathname === '/gifts') {
                const offset = integer(url.searchParams.get('offset') ?? '0', 0, Number.MAX_SAFE_INTEGER);
                const limit = integer(url.searchParams.get('limit') ?? '60', 1, 250);
                return reply(200, catalog.query((url.searchParams.get('search') || '').slice(0, 128), offset, limit));
            }
            const image = /^\/gift\/(\d{1,20})\.png$/.exec(url.pathname);
            const portrait = /^\/portrait\/([a-z0-9_.]{1,64})$/.exec(url.pathname);
            if (req.method === 'GET' && portrait) {
                const excluded = url.searchParams.get('excludeQualityVersion');
                const excludeVersion = /^[a-f0-9]{64}$/.test(excluded) ? excluded : '';
                if (relaysPortraits) {
                    const route = url.pathname + (excludeVersion ? '?excludeQualityVersion=' + excludeVersion : '');
                    const upstream = await requestJSON(owner.url, route, { token: owner.token, image: true });
                    if (!upstream) return reply(202, { status: 'pending-or-unavailable' });
                    res.setHeader('Content-Type', upstream.mime); res.writeHead(200); return res.end(upstream.bytes);
                }
                const file = profiles.file(portrait[1], excludeVersion);
                if (!file) return reply(profiles.loading(portrait[1]) ? 202 : 404, { status: 'pending-or-unavailable' });
                const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }[path.extname(file)];
                const bytes = await fs.promises.readFile(file);
                res.setHeader('Content-Type', mime); res.writeHead(200); return res.end(bytes);
            }
            if (req.method === 'GET' && image) {
                const file = catalog.file(image[1]);
                if (!file) return reply(404, { error: 'Hediye görseli bulunamadı.' });
                // Read the trusted catalog-mapped file, never a request path.
                const bytes = await fs.promises.readFile(file);
                const mime = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
                    : bytes.subarray(0, 4).toString() === 'RIFF' ? 'image/webp' : 'image/jpeg';
                res.setHeader('Content-Type', mime); res.writeHead(200); return res.end(bytes);
            }
            if (req.method === 'POST' && ['/connect', '/disconnect', '/ack'].includes(url.pathname)) {
                const body = await readJSON(req);
                if (url.pathname === '/connect') return reply(200, { schemaVersion: 1, status: await serialize(() => connect(body.username)) });
                if (url.pathname === '/disconnect') return reply(200, { schemaVersion: 1, status: await serialize(disconnect) });
                if (body.sessionId !== journal.sessionId) throw fail(409, 'Olay oturumu değişti.');
                if (!Number.isSafeInteger(body.seq) || body.seq < 0 || body.seq > journal.sequence) throw fail(400, 'Geçersiz olay imleci.');
                journal.ack(body.seq); return reply(200, { schemaVersion: 1, acknowledged: journal.acknowledged });
            }
            reply(404, { error: 'Yol bulunamadı.' });
        } catch (error) {
            reply(error.code >= 400 && error.code <= 599 ? error.code : 500,
                { error: error.code >= 400 && error.code <= 599 ? error.message : 'Köprü isteği tamamlanamadı; olaylar onaylanmadı.' });
        }
    });
    server.requestTimeout = 5000; server.headersTimeout = 5000; server.keepAliveTimeout = 1000;
    try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); }
    catch (error) { clearInterval(guardTimer); unsub?.(); profiles.close(); journal.close(); throw error; }
    async function close() {
        if (closed) return;
        closed = true; clearInterval(guardTimer); cancelRemote(); session?.close(); unsub?.(); profiles.close();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        journal.close();
    }
    return { url: `http://127.0.0.1:${server.address().port}`, token, status, close,
        connect: username => serialize(() => connect(username)), disconnect: () => serialize(disconnect),
        get pendingCount() { return journal.pendingCount; } };
}
function integer(text, minimum, maximum) {
    if (!/^\d+$/.test(text)) throw fail(400, 'Geçersiz sayı veya imleç.');
    const value = Number(text);
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw fail(400, 'Geçersiz sayı veya imleç.');
    return value;
}
async function readJSON(req) {
    let size = 0; const chunks = [];
    for await (const chunk of req) {
        size += chunk.length;
        if (size > 8192) throw fail(413, 'İstek çok büyük.');
        chunks.push(chunk);
    }
    try {
        const value = JSON.parse(Buffer.concat(chunks).toString() || '{}');
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
        return value;
    } catch { throw fail(400, 'Geçersiz JSON.'); }
}
module.exports = { createBridge };
