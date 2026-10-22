'use strict';

const CONNECT_TIMEOUT_MS = 25000;
const HEALTH_INTERVAL_MS = 10000;
const ignoreError = () => {};

function failureReason(error) {
    const seen = new Set();
    function describe(value) {
        if (!value || seen.has(value) || seen.size >= 8) return '';
        seen.add(value);
        if (typeof value === 'string') return value;
        return [value.name, value.constructor?.name, value.code, value.message,
            value.statusCode, value.response?.statusCode, value.response?.status,
            describe(value.exception), describe(value.cause)].join(' ');
    }
    const text = describe(error);
    if (/UserOfflineError|isn't online|is not online|not online|not (?:currently )?live|LIVE (?:has )?ended|\boffline\b/i.test(text)) return 'offline';
    if (/ConnectTimeoutError|ETIMEDOUT|timeout|timed out/i.test(text)) return 'timeout';
    if (/429|rate.?limit/i.test(text)) return 'rate-limit';
    if (/401|403|auth|credential|api.?key|SignatureMissingTokensError|SignAPIError/i.test(text)) return 'auth';
    if (/ECONN|ENOTFOUND|EAI_AGAIN|network|fetch failed|socket/i.test(text)) return 'network';
    return 'connection';
}

function validRoomId(value) {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) return '';
    if (!['string', 'number', 'bigint'].includes(typeof value)) return '';
    const roomId = String(value).trim();
    return /^[0-9]+$/.test(roomId) && /[1-9]/.test(roomId) ? roomId : '';
}

/**
 * start(username) immediately reports connecting and returns a Promise of the
 * first attempt's snapshot (also settled on timeout, stop or replacement).
 * stop(), status(), close() return snapshots; close permanently disables start.
 * Snapshots: { status, reason, username, roomId, attempt, lastConnectedAt,
 * lastEventAt, nextRetryAt, message }. Times are epoch milliseconds or null.
 * States: disconnected, connecting, connected, waiting (offline), error (retry).
 * attempt is 1-based within each start; history survives retries, not a new start.
 * onEvent(type, payload) receives chat/gift/like/follow/share/member/subscribe/
 * viewer with the original SDK object. Profile/gift/viewer mapping stays upstream.
 * Inject clock: { now() } (or a function), timers: { setTimeout, clearTimeout },
 * random: () => [0, 1]. No SDK import, credentials or network access lives here.
 */
function createLiveSession({ createConnection, events = {}, onStatus, onEvent,
    clock = Date, timers = globalThis, random = Math.random } = {}) {
    if (typeof createConnection !== 'function') throw new TypeError('createConnection must be a function');
    const now = typeof clock === 'function' && clock !== Date ? clock : () => clock.now();
    const schedule = timers.setTimeout.bind(timers);
    const unschedule = timers.clearTimeout.bind(timers);
    let generation = 0;
    let current = null;
    let retryTimer = null;
    let failures = 0;
    let closed = false;
    let state = {
        status: 'disconnected', reason: 'idle', username: '', roomId: '', attempt: 0,
        lastConnectedAt: null, lastEventAt: null, nextRetryAt: null,
        message: 'Yay\u0131nc\u0131 hesab\u0131 bekleniyor.'
    };

    const status = () => ({ ...state });
    const isCurrent = token => !closed && current === token && token.generation === generation;

    function notify(callback, ...args) {
        try { Promise.resolve(callback?.(...args)).catch(ignoreError); } catch {}
    }

    function publish(patch) {
        state = { ...state, ...patch };
        const snapshot = status();
        notify(onStatus, { ...snapshot });
        return snapshot;
    }

    function clearAttemptTimers(token) {
        if (token.timeout !== null) unschedule(token.timeout);
        if (token.health !== null) unschedule(token.health);
        token.timeout = token.health = null;
    }

    function retire(connection, listeners = []) {
        if (!connection) return;
        // Keep only a closure-free error sink for errors emitted after retirement.
        try {
            if (!connection.listeners('error').includes(ignoreError)) connection.on('error', ignoreError);
        } catch {}
        for (const [event, listener] of listeners) {
            try { connection.removeListener(event, listener); } catch {}
        }
        try { Promise.resolve(connection.disconnect()).catch(ignoreError); } catch {}
        // SDK disconnect cannot cancel an in-flight connect. Kill its current
        // transport too, and retire again when a late connect finally settles.
        try { connection.wsClient?.terminate(); } catch {}
    }

    function finish(token, snapshot) {
        token.resolve(snapshot);
    }

    function retry(token, reason) {
        if (!isCurrent(token)) return;
        current = null;
        clearAttemptTimers(token);
        const offline = reason === 'offline' || reason === 'stream-ended';
        if (offline) failures = 0;
        const base = offline ? 10000 : Math.min(60000, 2000 * 2 ** Math.min(failures++, 5));
        const sample = Number(random());
        const jitter = Number.isFinite(sample) ? Math.max(0, Math.min(1, sample)) : 0.5;
        const delay = Math.min(60000, Math.round(base * (0.8 + 0.4 * jitter)));
        const messages = {
            offline: `@${token.username} \u015fu anda canl\u0131 yay\u0131nda de\u011fil.`,
            'stream-ended': 'Canl\u0131 yay\u0131n sona erdi. Yeni yay\u0131n bekleniyor.',
            disconnected: 'Yay\u0131n ba\u011flant\u0131s\u0131 kesildi.',
            timeout: 'TikTok ba\u011flant\u0131s\u0131 zaman a\u015f\u0131m\u0131na u\u011frad\u0131.',
            'sdk-load': 'TikTok ba\u011flant\u0131 mod\u00fcl\u00fc y\u00fcklenemedi.',
            'invalid-connection': 'TikTok ba\u011flant\u0131 mod\u00fcl\u00fc ge\u00e7erli bir ba\u011flant\u0131 olu\u015fturamad\u0131.',
            'invalid-room': 'TikTok ba\u011flant\u0131s\u0131 ge\u00e7erli bir yay\u0131n odas\u0131 do\u011frulamad\u0131.',
            auth: 'TikTok ba\u011flant\u0131 yetkilendirmesi ba\u015far\u0131s\u0131z. Ba\u011flant\u0131 ayarlar\u0131n\u0131 kontrol edin.',
            'rate-limit': 'TikTok ba\u011flant\u0131 isteklerini s\u0131n\u0131rlad\u0131.',
            network: 'TikTok a\u011f ba\u011flant\u0131s\u0131 kurulamad\u0131.',
            connection: 'TikTok yay\u0131n\u0131na ba\u011flan\u0131lamad\u0131.'
        };
        retryTimer = schedule(() => {
            retryTimer = null;
            if (!closed && token.generation === generation) begin(token.username, generation);
        }, delay);
        const snapshot = publish({
            status: offline ? 'waiting' : 'error', reason, roomId: '', nextRetryAt: now() + delay,
            message: `${messages[reason]} ${Math.ceil(delay / 1000)} saniye sonra yeniden denenecek.`
        });
        finish(token, snapshot);
        retire(token.connection, token.listeners);
    }

    function healthCheck(token) {
        if (!isCurrent(token)) return;
        token.health = schedule(() => {
            token.health = null;
            if (!isCurrent(token)) return;
            try {
                // Documented SDK boolean getter; silence is never evidence of loss.
                if (token.connection.isConnected === false) return retry(token, 'disconnected');
            } catch { return retry(token, 'connection'); }
            healthCheck(token);
        }, HEALTH_INTERVAL_MS);
    }

    function bind(token) {
        const connection = token.connection;
        connection.on('error', ignoreError);
        function on(event, handler) {
            if (!event) return;
            const listener = payload => {
                if (!isCurrent(token)) return;
                try { handler(payload); } catch { retry(token, 'connection'); }
            };
            token.listeners.push([event, listener]);
            connection.on(event, listener);
        }
        function forward(type, payload) {
            if (state.status !== 'connected' || !payload || typeof payload !== 'object' || Array.isArray(payload)) return;
            if (type === 'gift') {
                const giftType = payload.giftType ?? payload.giftDetails?.giftType ?? payload.extendedGiftInfo?.giftType;
                if (Number(giftType) === 1 && ![true, 1, '1', 'true'].includes(payload.repeatEnd)) return;
            }
            publish({ lastEventAt: now() });
            if (isCurrent(token)) notify(onEvent, type, payload);
        }
        on(events.ERROR || 'error', error => retry(token, failureReason(error)));
        on(events.DISCONNECTED || 'disconnected', () => retry(token, 'disconnected'));
        on(events.STREAM_END || 'streamEnd', () => retry(token, 'stream-ended'));
        for (const [key, fallback, type] of [
            ['CHAT', 'chat', 'chat'], ['GIFT', 'gift', 'gift'], ['LIKE', 'like', 'like'],
            ['FOLLOW', 'follow', 'follow'], ['SHARE', 'share', 'share'],
            ['MEMBER', 'member', 'member'], ['ROOM_USER', 'roomUser', 'viewer']
        ]) on(events[key] || fallback, payload => forward(type, payload));
        for (const event of new Set([events.SUBSCRIBE || 'subscribe', events.SUB_NOTIFY || 'subNotify'])) {
            on(event, payload => forward('subscribe', payload));
        }
        on(events.SOCIAL || 'social', payload => {
            const label = String(payload?.common?.displayText?.key || payload?.label || payload?.displayType || payload?.event || '');
            if (/share|payla/i.test(label)) forward('share', payload);
            else if (/follow|takip/i.test(label)) forward('follow', payload);
        });
    }

    async function connect(token) {
        let loading = true;
        try {
            const connection = await createConnection(token.username);
            if (!isCurrent(token)) { retire(connection); return; }
            token.connection = connection;
            loading = false;
            if (!connection || typeof connection.on !== 'function' || typeof connection.connect !== 'function'
                || typeof connection.disconnect !== 'function' || typeof connection.removeListener !== 'function') {
                retry(token, 'invalid-connection');
                return;
            }
            bind(token);
            const result = await connection.connect();
            if (!isCurrent(token)) { retire(connection, token.listeners); return; }
            const roomId = validRoomId(result?.roomId);
            if (!roomId || result.isConnected === false || connection.isConnected === false) {
                retry(token, 'invalid-room');
                return;
            }
            clearAttemptTimers(token);
            failures = 0;
            healthCheck(token);
            finish(token, publish({ status: 'connected', reason: 'connected', roomId,
                lastConnectedAt: now(), nextRetryAt: null, message: `@${token.username} yay\u0131n\u0131na ba\u011fl\u0131.` }));
        } catch (error) {
            if (!isCurrent(token)) { retire(token.connection, token.listeners); return; }
            retry(token, loading ? 'sdk-load' : failureReason(error));
        }
    }

    function begin(username, run) {
        let resolve;
        const promise = new Promise(done => { resolve = done; });
        const token = { username, generation: run, resolve, connection: null, listeners: [], timeout: null, health: null };
        current = token;
        token.timeout = schedule(() => retry(token, 'timeout'), CONNECT_TIMEOUT_MS);
        publish({ status: 'connecting', reason: 'connecting', username, roomId: '',
            attempt: state.attempt + 1, nextRetryAt: null, message: `@${username} yay\u0131n\u0131 aran\u0131yor.` });
        if (isCurrent(token)) void connect(token);
        return promise;
    }

    function cancel() {
        generation++;
        if (retryTimer !== null) unschedule(retryTimer);
        retryTimer = null;
        const old = current;
        current = null;
        if (old) clearAttemptTimers(old);
        return old;
    }

    function start(value) {
        if (closed) return Promise.resolve(status());
        const old = cancel();
        failures = 0;
        const username = typeof value === 'string' ? value.trim().replace(/^@/, '').trim() : '';
        state = { ...state, username: '', roomId: '', attempt: 0, lastConnectedAt: null,
            lastEventAt: null, nextRetryAt: null };
        if (old) finish(old, { ...state, status: 'disconnected', reason: 'replaced', message: 'Yay\u0131nc\u0131 hesab\u0131 de\u011fi\u015ftirildi.' });
        const result = !username || !/^[a-zA-Z0-9_.]+$/.test(username)
            ? Promise.resolve(publish({ status: 'disconnected', reason: username ? 'invalid-username' : 'idle',
                message: username ? 'Ge\u00e7erli bir TikTok kullan\u0131c\u0131 ad\u0131 girin.' : 'Yay\u0131nc\u0131 hesab\u0131 bekleniyor.' }))
            : begin(username, generation);
        retire(old?.connection, old?.listeners);
        return result;
    }

    function stop() {
        if (!current && retryTimer === null && state.status === 'disconnected'
            && state.reason === (closed ? 'closed' : 'stopped')) return status();
        const old = cancel();
        failures = 0;
        const snapshot = publish({ status: 'disconnected', reason: closed ? 'closed' : 'stopped',
            username: '', roomId: '', nextRetryAt: null, message: 'Ba\u011flant\u0131 kapat\u0131ld\u0131.' });
        if (old) finish(old, snapshot);
        retire(old?.connection, old?.listeners);
        return snapshot;
    }

    function close() {
        if (closed) return status();
        closed = true;
        return stop();
    }

    return { start, stop, status, close };
}

module.exports = { createLiveSession };
