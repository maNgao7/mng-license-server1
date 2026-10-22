import { createHash } from 'node:crypto';
import express from 'express';

const PREFIX = '/api/speech';
const MINUTE = 60_000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
const BODY_BYTES = 8192, AUDIO_BYTES = 8 * 1024 * 1024, CATALOG_BYTES = 4 * 1024 * 1024;
const VOICE_ID = /^[a-z]{2,3}-[A-Za-z0-9]{2,8}-[A-Za-z0-9:-]{1,120}$/;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const plain = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max
    && !/[\x00-\x1f\x7f]/.test(value);
const hash = value => createHash('sha256').update(value).digest('hex');
const xml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);

class SpeechError extends Error {
    constructor(status, code, retryAfter) { super(code); this.status = status; this.code = code; this.retryAfter = retryAfter; }
}
const failure = (status, code, retryAfter) => new SpeechError(status, code, retryAfter);

function setting(env, name, fallback, min, max) {
    const value = env[name];
    if (value === undefined || value === '') return fallback;
    if (!/^\d{1,12}$/.test(String(value))) throw new TypeError(`Invalid ${name}`);
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < min || number > max) throw new TypeError(`Invalid ${name}`);
    return number;
}

function configFrom(env) {
    const key = typeof env.MNG_AZURE_SPEECH_KEY === 'string' ? env.MNG_AZURE_SPEECH_KEY.trim() : '';
    const region = typeof env.MNG_AZURE_SPEECH_REGION === 'string' ? env.MNG_AZURE_SPEECH_REGION.trim() : '';
    return key.length >= 16 && key.length <= 512 && /^[\x21-\x7e]+$/.test(key)
        && /^[a-z][a-z0-9]{1,31}$/.test(region) ? { key, base: `https://${region}.tts.speech.microsoft.com` } : null;
}

async function readBounded(response, maxBytes) {
    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d{1,10}$/.test(length) || Number(length) > maxBytes)) {
        throw failure(502, 'CENTRAL_RESPONSE_INVALID');
    }
    if (!response.body?.getReader) throw failure(502, 'CENTRAL_RESPONSE_INVALID');
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0, complete = false;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > maxBytes) throw failure(502, 'CENTRAL_RESPONSE_INVALID');
            chunks.push(Buffer.from(value));
        }
        if (length !== null && bytes !== Number(length)) throw failure(502, 'CENTRAL_RESPONSE_INVALID');
        complete = true;
        return Buffer.concat(chunks, bytes);
    } finally {
        if (!complete) void reader.cancel().catch(() => {});
        reader.releaseLock();
    }
}

function validWave(audio) {
    if (audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE'
        || audio.readUInt32LE(4) + 8 !== audio.length) return false;
    let offset = 12, format = false, data = false;
    while (offset + 8 <= audio.length) {
        const type = audio.toString('ascii', offset, offset + 4), size = audio.readUInt32LE(offset + 4);
        const start = offset + 8, end = start + size;
        if (end > audio.length) return false;
        if (type === 'fmt ') {
            if (format || size < 16 || audio.readUInt16LE(start) !== 1 || audio.readUInt16LE(start + 2) !== 1
                || audio.readUInt32LE(start + 4) !== 24000 || audio.readUInt32LE(start + 8) !== 48000
                || audio.readUInt16LE(start + 12) !== 2 || audio.readUInt16LE(start + 14) !== 16) return false;
            format = true;
        }
        if (type === 'data') {
            if (data || !format || size === 0 || size % 2 !== 0) return false;
            data = true;
        }
        offset = end + (size % 2);
    }
    return format && data && offset === audio.length;
}

function publicVoices(items) {
    if (!Array.isArray(items) || items.length > 10000) throw failure(502, 'CENTRAL_RESPONSE_INVALID');
    const voices = new Map();
    for (const voice of items) {
        if (!object(voice) || voice.VoiceType !== 'Neural' || typeof voice.ShortName !== 'string'
            || !VOICE_ID.test(voice.ShortName)) continue;
        const native = voice.Locale === 'tr-TR';
        const multilingual = !native && Array.isArray(voice.SecondaryLocaleList) && voice.SecondaryLocaleList.includes('tr-TR');
        if (!native && !multilingual) continue;
        if (!plain(voice.Locale, 35)) continue;
        const name = [voice.LocalName, voice.DisplayName, voice.ShortName].find(value => plain(value, 160));
        voices.set(voice.ShortName, { id: voice.ShortName, name, lang: 'tr-TR', nativeLang: voice.Locale, multilingual,
            gender: voice.Gender === 'Female' ? 'female' : voice.Gender === 'Male' ? 'male' : 'unknown',
            provider: 'tikmng', neural: true });
    }
    return [...voices.values()].sort((a, b) => Number(a.multilingual) - Number(b.multilingual) || a.id.localeCompare(b.id));
}

/** Central credentials stay in this server. Counters and catalog cache are process-local. */
export function registerSpeechRelay(app, { authorize, env = process.env, fetchImpl = fetch, now = Date.now } = {}) {
    if (typeof authorize !== 'function' || typeof fetchImpl !== 'function' || typeof now !== 'function') {
        throw new TypeError('Speech relay callbacks must be functions');
    }
    const config = configFrom(env);
    const limits = {
        ownerHour: setting(env, 'MNG_SPEECH_OWNER_HOURLY_CHARS', 10000, 1, 1_000_000),
        ownerDay: setting(env, 'MNG_SPEECH_OWNER_DAILY_CHARS', 30000, 1, 10_000_000),
        deviceHour: setting(env, 'MNG_SPEECH_DEVICE_HOURLY_CHARS', 6000, 1, 1_000_000),
        deviceDay: setting(env, 'MNG_SPEECH_DEVICE_DAILY_CHARS', 20000, 1, 10_000_000),
        globalDay: setting(env, 'MNG_SPEECH_GLOBAL_DAILY_CHARS', 500000, 1, 100_000_000),
        ownerRate: setting(env, 'MNG_SPEECH_OWNER_REQUESTS_PER_MINUTE', 60, 1, 600),
        deviceRate: setting(env, 'MNG_SPEECH_DEVICE_REQUESTS_PER_MINUTE', 30, 1, 300),
        globalRate: setting(env, 'MNG_SPEECH_GLOBAL_REQUESTS_PER_MINUTE', 600, 1, 6000),
        concurrency: setting(env, 'MNG_SPEECH_CONCURRENCY', 4, 1, 16),
        queue: setting(env, 'MNG_SPEECH_QUEUE_SIZE', 8, 0, 64),
        queueMs: setting(env, 'MNG_SPEECH_QUEUE_TIMEOUT_MS', 5000, 100, 15000),
        timeout: setting(env, 'MNG_SPEECH_AZURE_TIMEOUT_MS', 15000, 100, 30000),
        ownerPending: setting(env, 'MNG_SPEECH_OWNER_PENDING', 4, 1, 16),
        devicePending: setting(env, 'MNG_SPEECH_DEVICE_PENDING', 2, 1, 8)
    };
    const owners = new Map(), devices = new Map(), queue = [], controllers = new Set();
    let clock = 0, active = 0, admissions = 0, authPending = 0, upstreamPending = 0, closed = false, lastCleanup = 0;
    let catalog = null, catalogUntil = 0, catalogPending = null, catalogError = null, catalogRetry = 0;
    const timestamp = () => {
        const value = now();
        if (!Number.isSafeInteger(value) || value < 0) throw failure(503, 'CENTRAL_UNAVAILABLE');
        clock = Math.max(clock, value);
        return clock;
    };
    function renew(record, time) {
        for (const [name, duration] of [['minute', MINUTE], ['hour', HOUR], ['day', DAY]]) {
            const window = Math.floor(time / duration);
            if (record[name] !== window) { record[name] = window; record[name + 'Used'] = 0; }
        }
        record.lastSeen = time;
        return record;
    }
    const global = renew({ pending: 0 }, timestamp());
    function ledger(map, id, max, time) {
        if (!map.has(id)) {
            if (map.size >= max) throw failure(503, 'CENTRAL_BUSY', 60);
            map.set(id, { pending: 0 });
        }
        return renew(map.get(id), time);
    }
    function cleanup(time) {
        if (time - lastCleanup < MINUTE) return;
        lastCleanup = time;
        for (const map of [owners, devices]) for (const [id, record] of map) {
            if (record.pending === 0 && time - record.lastSeen >= DAY) map.delete(id);
        }
    }
    function rate(owner, device, time) {
        renew(global, time);
        if (global.minuteUsed >= limits.globalRate || owner.minuteUsed >= limits.ownerRate || device.minuteUsed >= limits.deviceRate) {
            throw failure(429, 'CENTRAL_QUOTA', Math.max(1, Math.ceil((MINUTE - time % MINUTE) / 1000)));
        }
        global.minuteUsed++; owner.minuteUsed++; device.minuteUsed++;
    }
    function charge(owner, device, count) {
        const time = timestamp();
        for (const record of [global, owner, device]) renew(record, time);
        if (global.dayUsed + count > limits.globalDay || owner.dayUsed + count > limits.ownerDay
            || device.dayUsed + count > limits.deviceDay) {
            throw failure(429, 'CENTRAL_QUOTA', Math.max(1, Math.ceil((DAY - time % DAY) / 1000)));
        }
        if (owner.hourUsed + count > limits.ownerHour || device.hourUsed + count > limits.deviceHour) {
            throw failure(429, 'CENTRAL_QUOTA', Math.max(1, Math.ceil((HOUR - time % HOUR) / 1000)));
        }
        // Reserve before sending to Azure; failed/aborted calls may still be billable.
        global.dayUsed += count; owner.dayUsed += count; device.dayUsed += count;
        owner.hourUsed += count; device.hourUsed += count;
    }
    function release() {
        active--;
        const next = queue.shift();
        if (next) { next.dispose(); active++; next.resolve(release); }
    }
    function acquire(signal) {
        if (closed || signal.aborted) return Promise.reject(failure(503, 'CENTRAL_BUSY', 1));
        if (active < limits.concurrency) { active++; return Promise.resolve(release); }
        if (queue.length >= limits.queue) return Promise.reject(failure(503, 'CENTRAL_BUSY', 1));
        return new Promise((resolve, reject) => {
            const entry = { resolve, reject, dispose: () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); } };
            const cancel = () => {
                const index = queue.indexOf(entry);
                if (index !== -1) queue.splice(index, 1);
                entry.dispose(); reject(failure(503, 'CENTRAL_BUSY', 1));
            };
            const timer = setTimeout(cancel, limits.queueMs);
            signal.addEventListener('abort', cancel, { once: true });
            queue.push(entry);
        });
    }
    async function check(input, expectedOwner) {
        if (authPending >= 64 || closed) throw failure(503, 'CENTRAL_BUSY', 1);
        authPending++;
        const pending = Promise.resolve().then(() => authorize({ licenseCode: input.licenseCode, deviceId: input.deviceId }));
        pending.then(() => authPending--, () => authPending--);
        let timer;
        try {
            const result = await Promise.race([pending, new Promise((_, reject) => {
                timer = setTimeout(() => reject(failure(503, 'CENTRAL_UNAVAILABLE')), 2000);
            })]);
            if (!object(result) || !plain(result.ownerId, 256) || (expectedOwner && result.ownerId !== expectedOwner)) {
                throw failure(403, 'CENTRAL_FORBIDDEN');
            }
            return result.ownerId;
        } catch (error) {
            throw error instanceof SpeechError ? error : failure(503, 'CENTRAL_UNAVAILABLE');
        } finally { clearTimeout(timer); }
    }
    async function azure(path, { body, signal, maxBytes }) {
        if (upstreamPending >= limits.concurrency || closed) throw failure(503, 'CENTRAL_BUSY', 1);
        const controller = new AbortController();
        controllers.add(controller);
        let timeout;
        const abort = () => controller.abort();
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
        const deadline = new Promise((_, reject) => {
            controller.signal.addEventListener('abort', () => reject(failure(504, 'CENTRAL_TIMEOUT')), { once: true });
            if (controller.signal.aborted) reject(failure(504, 'CENTRAL_TIMEOUT'));
            timeout = setTimeout(abort, limits.timeout);
        });
        upstreamPending++;
        const pending = (async () => {
                if (controller.signal.aborted) throw failure(504, 'CENTRAL_TIMEOUT');
                const response = await fetchImpl(config.base + path, {
                    method: body === undefined ? 'GET' : 'POST', redirect: 'manual', signal: controller.signal,
                    headers: { 'Ocp-Apim-Subscription-Key': config.key, 'User-Agent': 'TikMnG-Speech-Relay',
                        ...(body === undefined ? { Accept: 'application/json' } : {
                            'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm'
                        }) }, ...(body === undefined ? {} : { body })
                });
                if (response.status !== 200) {
                    void response.body?.cancel().catch(() => {});
                    if (response.status === 429) throw failure(429, 'CENTRAL_QUOTA', 60);
                    if (response.status === 401 || response.status === 403) throw failure(503, 'CENTRAL_UNAVAILABLE');
                    throw failure(502, 'CENTRAL_UPSTREAM');
                }
                const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
                if (body === undefined ? contentType !== 'application/json'
                    : !['audio/wav', 'audio/x-wav', 'audio/wave', 'application/octet-stream'].includes(contentType)) {
                    void response.body?.cancel().catch(() => {});
                    throw failure(502, 'CENTRAL_RESPONSE_INVALID');
                }
                return await readBounded(response, maxBytes);
            })();
        // A transport that ignores abort must keep occupying its upstream slot.
        pending.then(() => upstreamPending--, () => upstreamPending--);
        try {
            return await Promise.race([deadline, pending]);
        } catch (error) {
            controller.abort();
            throw error instanceof SpeechError ? error : failure(502, 'CENTRAL_UPSTREAM');
        } finally {
            clearTimeout(timeout); signal.removeEventListener('abort', abort); controllers.delete(controller);
        }
    }
    async function voices(signal) {
        const time = timestamp();
        if (catalog && time < catalogUntil) return catalog;
        if (catalogError && time < catalogRetry) throw catalogError;
        if (!catalogPending) catalogPending = (async () => {
            try {
                const data = await azure('/cognitiveservices/voices/list', { signal, maxBytes: CATALOG_BYTES });
                let items;
                try { items = JSON.parse(data.toString('utf8')); } catch { throw failure(502, 'CENTRAL_RESPONSE_INVALID'); }
                const result = publicVoices(items);
                if (!result.length) throw failure(503, 'CENTRAL_NO_VOICES');
                catalog = result; catalogUntil = timestamp() + 5 * MINUTE; catalogError = null;
                return result;
            } catch (error) {
                catalogError = error; catalogRetry = timestamp() + 5000; throw error;
            } finally { catalogPending = null; }
        })();
        return catalogPending;
    }
    function reply(res, error) {
        if (res.destroyed || res.writableEnded) return;
        const safe = error instanceof SpeechError ? error : failure(503, 'CENTRAL_UNAVAILABLE');
        if (safe.retryAfter) res.setHeader('Retry-After', String(safe.retryAfter));
        res.status(safe.status).json({ configured: Boolean(config), available: false, reason: safe.code, code: safe.code });
    }
    function validate(body, synthesis) {
        if (!object(body)) throw failure(400, 'CENTRAL_INPUT');
        if (Buffer.byteLength(JSON.stringify(body)) > BODY_BYTES) throw failure(413, 'CENTRAL_BODY_TOO_LARGE');
        if (!body.licenseCode || !body.deviceId) throw failure(401, 'CENTRAL_UNAUTHORIZED');
        if (!plain(body.licenseCode, 160) || !plain(body.deviceId, 256)) throw failure(400, 'CENTRAL_INPUT');
        const allowed = synthesis ? ['licenseCode', 'deviceId', 'voiceId', 'text', 'rate'] : ['licenseCode', 'deviceId'];
        if (Object.keys(body).some(key => !allowed.includes(key))) throw failure(400, 'CENTRAL_INPUT');
        if (synthesis && (typeof body.voiceId !== 'string' || !VOICE_ID.test(body.voiceId)
            || typeof body.text !== 'string' || !body.text.trim() || [...body.text].length > 500
            || /[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(body.text)
            || (body.rate !== undefined && (typeof body.rate !== 'number' || !Number.isFinite(body.rate) || body.rate < 0.5 || body.rate > 2)))) {
            throw failure(400, 'CENTRAL_INPUT');
        }
        return { ...body, licenseCode: body.licenseCode.trim(), deviceId: body.deviceId.trim() };
    }
    const parser = express.json({ limit: BODY_BYTES, strict: true, inflate: false });
    for (const synthesis of [false, true]) app.all(PREFIX + (synthesis ? '/synthesize' : '/voices'), (req, res, next) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return reply(res, failure(405, 'CENTRAL_METHOD')); }
        if (req.originalUrl.includes('?')) return reply(res, failure(400, 'CENTRAL_INPUT'));
        if (!req.is('application/json')) return reply(res, failure(415, 'CENTRAL_JSON_REQUIRED'));
        if (closed || admissions >= 64) return reply(res, failure(503, 'CENTRAL_BUSY', 1));
        parser(req, res, next);
    }, async (req, res) => {
        let releaseSlot, owner, device;
        const controller = new AbortController();
        const onClose = () => { if (!res.writableEnded) controller.abort(); };
        res.once('close', onClose);
        admissions++;
        try {
            if (admissions > 64 || closed) throw failure(503, 'CENTRAL_BUSY', 1);
            const input = validate(req.body, synthesis);
            const ownerId = await check(input);
            if (!config) throw failure(503, 'CENTRAL_NOT_CONFIGURED');
            const time = timestamp();
            cleanup(time);
            owner = ledger(owners, hash(ownerId), 4096, time);
            device = ledger(devices, hash(ownerId + '\0' + input.deviceId), 8192, time);
            rate(owner, device, time);
            if (owner.pending >= limits.ownerPending || device.pending >= limits.devicePending) throw failure(503, 'CENTRAL_BUSY', 1);
            owner.pending++; device.pending++;
            try {
                releaseSlot = await acquire(controller.signal);
                await check(input, ownerId);
                const available = await voices(controller.signal);
                if (controller.signal.aborted || closed) throw failure(503, 'CENTRAL_BUSY', 1);
                if (!synthesis) {
                    await check(input, ownerId);
                    return res.json({ configured: true, available: true, reason: null, voices: available });
                }
                const voice = available.find(item => item.id === input.voiceId);
                if (!voice) throw failure(400, 'CENTRAL_INVALID_VOICE');
                await check(input, ownerId);
                charge(owner, device, [...input.text].length);
                const percent = Math.round(((input.rate ?? 1) - 1) * 100);
                const content = voice.multilingual ? `<lang xml:lang="tr-TR">${xml(input.text)}</lang>` : xml(input.text);
                const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="tr-TR"><voice name="${xml(voice.id)}"><prosody rate="${percent >= 0 ? '+' : ''}${percent}%" pitch="+0%">${content}</prosody></voice></speak>`;
                const audio = await azure('/cognitiveservices/v1', { body: ssml, signal: controller.signal, maxBytes: AUDIO_BYTES });
                if (!validWave(audio)) throw failure(502, 'CENTRAL_RESPONSE_INVALID');
                await check(input, ownerId);
                if (closed || controller.signal.aborted) throw failure(503, 'CENTRAL_BUSY', 1);
                res.json({ audioBase64: audio.toString('base64'), mimeType: 'audio/wav', voice });
            } finally { owner.pending--; device.pending--; }
        } catch (error) { reply(res, error); }
        finally { releaseSlot?.(); admissions--; res.removeListener('close', onClose); }
    }, (error, _req, res, _next) => reply(res, failure(error.type === 'entity.too.large' ? 413 : error.status === 415 ? 415 : 400,
        error.type === 'entity.too.large' ? 'CENTRAL_BODY_TOO_LARGE' : 'CENTRAL_INPUT')));

    return { close() {
        closed = true;
        for (const controller of controllers) controller.abort();
        for (const entry of queue.splice(0)) { entry.dispose(); entry.reject(failure(503, 'CENTRAL_BUSY', 1)); }
    } };
}
