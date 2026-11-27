'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const clean = value => String(value || '').trim().replace(/^@/, '').toLowerCase();
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const number = (value, maximum = 1000000) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(maximum, Math.floor(Number(value)))) : 0;

function normalizeLiveLikes(data, roomId) {
    const user = data.user || data.userInfo || {};
    const username = [user.uniqueId, user.unique_id, user.displayId, user.display_id, user.username,
        data.uniqueId, data.unique_id, data.displayId, data.display_id, data.username]
        .map(clean).find(name => /^[a-z0-9_.]{1,64}$/.test(name));
    const count = number(data.likeCount ?? data.like_count ?? data.count);
    if (!username || !count) return null;
    const common = data.common || {};
    const usable = value => typeof value === 'string' || Number.isSafeInteger(value) ? String(value).trim() : '';
    const validId = value => value && value !== '0' && value.length <= 256;
    const room = [common.roomId, common.room_id, data.roomId, data.room_id, roomId].map(usable).find(validId);
    const id = [data.eventId, data.msgId, data.msg_id, common.msgId, common.msg_id, data.logId, common.logId]
        .map(usable).find(validId);
    const total = [data.totalLikeCount, data.total_like_count, data.total].map(usable).find(value => /^[1-9][0-9]{0,24}$/.test(value));
    const time = [common.createTime, common.create_time, data.createTime, data.create_time].map(usable)
        .find(value => /^[1-9][0-9]{0,19}$/.test(value));
    // The room total identifies a batch only; only the sender's count earns speed.
    const key = id ? ['id', id] : room && total ? ['room-total', room, total] : time ? ['time', room, time, count] : null;
    if (!key) return null;
    return { ...data, username, nickname: user.nickname || data.nickname || username, likeCount: count,
        eventId: hash(['tiktok-like', username, ...key]) };
}

function normalizeEvent(type, payload, channel, progress = false) {
    const username = clean(payload.username || payload.uniqueId || payload.user?.uniqueId);
    if (!['gift', 'like', 'follow', 'chat', 'member'].includes(type) || !/^[a-z0-9_.]{1,64}$/.test(username)) return null;
    const id = payload.eventId || payload.msgId || payload.common?.msgId || payload.logId;
    if ((!id && !(type === 'gift' && payload.groupId)) || String(id || '').length > 256) return null;
    const giftType = payload.giftType ?? payload.gift?.giftType ?? payload.gift?.type;
    if (!progress && type === 'gift' && (Number(giftType) === 1 || giftType === undefined && Object.hasOwn(payload, 'repeatEnd'))
        && ![true, 1, '1', 'true'].includes(payload.repeatEnd)) return null;
    const count = Math.max(1, number(payload.repeatCount ?? payload.count ?? 1, 10000));
    // sharedGameEvents carries publisher totals; native expects unit coins * repeatCount.
    const coins = type === 'gift' ? number(payload.diamondCount ?? payload.unitCoins ?? payload.gift?.diamondCount ?? Number(payload.coins || 0) / count) : 0;
    return { type, username, nickname: String(payload.nickname || payload.user?.nickname || username).slice(0, 128),
        eventId: hash([clean(channel), type, String(id)]), avatarFile: '', channel: 'live',
        giftId: type === 'gift' ? String(payload.giftId || payload.gift?.id || '').slice(0, 64) : '',
        giftName: String(payload.giftName || '').slice(0, 128), coins, repeatCount: type === 'gift' ? count : 0,
        likeCount: type === 'like' ? number(payload.likeCount ?? payload.like_count ?? payload.count ?? 1) : 0,
        comment: type === 'chat' ? String(payload.message || payload.comment || '').slice(0, 4096) : '' };
}

async function createForzaPublisher({ events, getChannel, getStatus, portrait, username, directory, limit = 10000, onError = () => {} }) {
    if (!events?.subscribe || typeof getChannel !== 'function' || typeof getStatus !== 'function') throw new Error('Forza requires the existing publisher event owner.');
    const channel = clean(username || getChannel()), token = crypto.randomBytes(32).toString('hex');
    const pending = [], seen = new Set(), waiters = new Set();
    const streakCounts = new Map();
    const avatarFiles = new Map(), loadingPortraits = new Map(), portraitRetries = new Map();
    const portraitWrites = new Map();
    let sequence = 0, acknowledged = 0, closed = false, fault = '', profileIssue = '';
    let attached;
    const clientAttached = new Promise(resolve => { attached = resolve; });
    const status = () => {
        const owner = getStatus() || {};
        if (fault) return { status: 'error', username: channel, message: fault };
        if (clean(getChannel()) !== channel || (owner.username && clean(owner.username) !== channel)) return { status: 'error', username: channel, message: 'Yayinci hesabi degisti. Oyunu dogru hesapla yeniden acin.' };
        return { status: owner.status || 'disconnected', username: channel,
            message: String(profileIssue || owner.message || 'Launcher yayin baglantisini kontrol edin.').slice(0, 512) };
    };
    const wake = () => { for (const finish of [...waiters]) finish(); };
    function push(value) {
        if (closed) return;
        if (pending.length >= limit) {
            fault = 'Forza yayin olay kuyrugu doldu. Olaylar silinmedi; oyunun baglantisini kontrol edin.';
            onError(new Error(fault)); wake(); return;
        }
        pending.push({ seq: ++sequence, kind: 'event', value }); wake();
    }
    function storePortrait(avatarFile, bytes) {
        if (portraitWrites.has(avatarFile)) return portraitWrites.get(avatarFile);
        const job = (async () => {
            const target = path.join(directory, 'control/live/portraits', avatarFile);
            const { assertSafePath } = require('./download.cjs');
            assertSafePath(target);
            await fs.promises.mkdir(path.dirname(target), { recursive: true });
            // A content-addressed photo is shared by all users with the same image.
            // Do not overwrite a verified PNG while the native game is reading it.
            try {
                const existing = await fs.promises.stat(target);
                if (existing.size === bytes.length && (await fs.promises.readFile(target)).equals(bytes)) return;
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
            }
            const temporary = target + '.' + crypto.randomUUID() + '.tmp';
            try {
                await fs.promises.writeFile(temporary, bytes, { flag: 'wx' });
                await fs.promises.rename(temporary, target);
            } finally {
                await fs.promises.rm(temporary, { force: true }).catch(() => {});
            }
        })().finally(() => portraitWrites.delete(avatarFile));
        portraitWrites.set(avatarFile, job);
        return job;
    }
    const unsubscribe = events.subscribe((type, payload, meta) => {
        if (meta.source !== 'live' || clean(meta.channel) !== channel || clean(getChannel()) !== channel) return;
        const progress = type === 'forza-gift-progress';
        const rawLike = type === 'forza-like';
        const normalized = rawLike ? normalizeLiveLikes(payload, getStatus()?.roomId) : payload;
        if (!normalized || type === 'like' && payload.forzaRawLike === true) return;
        const value = normalizeEvent(progress ? 'gift' : rawLike ? 'like' : type, normalized, channel, progress);
        if (!value) return;
        if (value.type === 'gift' && payload.groupId) {
            if (value.coins <= 0) return;
            const combo = hash([channel, 'combo', String(payload.groupId), value.username, value.giftId]);
            const previous = streakCounts.get(combo) || 0;
            const received = value.repeatCount;
            if (received <= previous) return;
            streakCounts.delete(combo);
            streakCounts.set(combo, received);
            while (streakCounts.size > 16000) streakCounts.delete(streakCounts.keys().next().value);
            value.repeatCount = received - previous;
            value.eventId = hash([combo, received]);
        } else if (progress || seen.has(value.eventId)) return;
        seen.add(value.eventId);
        while (seen.size > 16000) seen.delete(seen.values().next().value);
        value.avatarFile = avatarFiles.get(value.username) || '';
        push(value);
        requestPortrait(value, normalized, value.type === 'gift' || value.type === 'like' || value.type === 'follow');
    });
    function requestPortrait(value, payload, priority, attempt = 0) {
        const username = value.username;
        if (!portrait || closed || avatarFiles.has(username) || clean(getChannel()) !== channel) return;
        const loading = loadingPortraits.get(username);
        if (loading) {
            loading.next = payload;
            loading.priority ||= priority;
            return;
        }
        const scheduled = portraitRetries.get(username);
        if (scheduled) { scheduled.payload = payload; return; }
        if (loadingPortraits.size >= (priority ? 64 : 16)) {
            if (priority && attempt < 3) retryPortrait(value, payload, attempt);
            return;
        }
        const job = { next: null, priority };
        loadingPortraits.set(username, job);
        void Promise.resolve().then(() => portrait(username, payload, job.priority)).then(async bytes => {
            if (closed || clean(getChannel()) !== channel || !Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 4 * 1024 ** 2) return;
            const avatarFile = 'tiktok-bridge-avatar-' + hash(bytes.toString('base64')) + '.png';
            await storePortrait(avatarFile, bytes);
            if (closed || clean(getChannel()) !== channel) return;
            avatarFiles.set(username, avatarFile);
            while (avatarFiles.size > 1500) avatarFiles.delete(avatarFiles.keys().next().value);
            profileIssue = '';
            push({ ...value, type: 'avatar', eventId: hash(['avatar', username, avatarFile]), avatarFile });
        }).catch(error => { profileIssue = 'Profil onbellegi okunamadi: ' + error.message; wake(); })
            .finally(() => {
                loadingPortraits.delete(username);
                if (!avatarFiles.has(username) && job.priority && attempt < 3)
                    retryPortrait(value, job.next || payload, attempt);
            });
    }
    function retryPortrait(value, payload, attempt) {
        if (closed || portraitRetries.size >= 64) return;
        const job = { payload, timer: null };
        job.timer = setTimeout(() => {
            portraitRetries.delete(value.username);
            requestPortrait(value, job.payload, true, attempt + 1);
        }, [500, 5000, 65000][attempt]);
        job.timer.unref();
        portraitRetries.set(value.username, job);
    }
    const server = http.createServer(async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/json');
        const reply = (code, value) => { res.writeHead(code); res.end(JSON.stringify(value)); };
        const url = new URL(req.url, 'http://127.0.0.1');
        if (!['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
            || req.headers.authorization !== 'Bearer ' + token) return reply(403, { error: 'Forbidden' });
        if (req.method !== 'GET' || url.pathname !== '/poll') return reply(405, { error: 'Only publisher polling is supported.' });
        if (clean(url.searchParams.get('username')) !== channel) return reply(409, { error: 'Oyunda launcher ile ayni yayin hesabini secin.' });
        const after = Number(url.searchParams.get('after'));
        if (!Number.isSafeInteger(after) || after < 0 || after > sequence) return reply(400, { error: 'Invalid cursor.' });
        attached();
        acknowledged = Math.max(acknowledged, after);
        while (pending[0]?.seq <= acknowledged) pending.shift();
        if (!pending.length && !closed) await new Promise(resolve => {
            const done = () => { clearTimeout(timer); waiters.delete(done); res.removeListener('close', done); resolve(); };
            const timer = setTimeout(done, 1000); waiters.add(done); res.once('close', done);
        });
        const liveStatus = status();
        if (!res.destroyed) reply(200, { schemaVersion: 1, status: liveStatus, events: liveStatus.status === 'error' ? [] : pending.filter(row => row.seq > after).slice(0, 100) });
    });
    try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); }
    catch (error) { unsubscribe(); throw error; }
    return { token, url: `http://127.0.0.1:${server.address().port}`, status, clientAttached,
        get pendingCount() { return pending.length; },
        async close() { if (closed) return; closed = true; unsubscribe(); for (const job of portraitRetries.values()) clearTimeout(job.timer); portraitRetries.clear(); wake(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
module.exports = { createForzaPublisher, normalizeEvent, normalizeLiveLikes };
