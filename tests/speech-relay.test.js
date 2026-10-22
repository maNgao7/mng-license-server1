import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import express from 'express';
import { registerSpeechRelay } from '../speech-relay.js';
import { createOverlayAuthorization } from '../overlay-authorization.js';

const KEY = 'fake-server-key-only-do-not-distribute';
const ENV = { MNG_AZURE_SPEECH_KEY: KEY, MNG_AZURE_SPEECH_REGION: 'westeurope' };
const CREDENTIALS = { licenseCode: 'TEST', deviceId: 'device-1' };
const VOICE = 'tr-TR-EmelNeural';
const SPEAK = { ...CREDENTIALS, voiceId: VOICE, text: 'Merhaba TikMnG!', rate: 1 };
const CATALOG = [
    { ShortName: VOICE, LocalName: 'Emel', Gender: 'Female', Locale: 'tr-TR', VoiceType: 'Neural', Secret: KEY },
    { ShortName: 'tr-TR-AhmetNeural', DisplayName: 'Ahmet', Gender: 'Male', Locale: 'tr-TR', VoiceType: 'Neural' },
    { ShortName: 'en-US-AvaMultilingualNeural', DisplayName: 'Ava', Gender: 'Female', Locale: 'en-US', VoiceType: 'Neural', SecondaryLocaleList: ['de-DE', 'tr-TR'] },
    { ShortName: 'en-US-OnlyEnglishNeural', DisplayName: 'English', Locale: 'en-US', VoiceType: 'Neural' },
    { ShortName: 'tr-TR-Old', DisplayName: 'Old', Locale: 'tr-TR', VoiceType: 'Standard' },
    { ShortName: 'https://bad.invalid', Locale: 'tr-TR', VoiceType: 'Neural' }
];
function wave() {
    const buffer = Buffer.alloc(48);
    buffer.write('RIFF'); buffer.writeUInt32LE(40, 4); buffer.write('WAVEfmt ', 8);
    buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(24000, 24); buffer.writeUInt32LE(48000, 28);
    buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(4, 40);
    return buffer;
}
const catalogResponse = (items = CATALOG) => Response.json(items);
const waveResponse = (audio = wave()) => new Response(audio, { headers: { 'content-type': 'audio/wav' } });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

async function fixture(t, options = {}) {
    const app = express(), calls = [], authorizations = [];
    const clock = { value: Date.UTC(2026, 9, 22, 10) };
    const rows = [{ kod: 'TEST', durum: 'aktif', cihaz_kimlik: 'device-1', bitis_zamani: null }], blacklist = [];
    const policy = createOverlayAuthorization({ licenses: () => rows, blacklist: () => blacklist, now: () => clock.value });
    if (options.globalParser) app.use(express.json({ limit: '64kb' }));
    const relay = registerSpeechRelay(app, {
        env: { ...ENV, ...options.env }, now: () => clock.value,
        authorize: async input => { authorizations.push(input); return options.authorize ? options.authorize(input) : policy(input); },
        fetchImpl: async (url, init) => {
            calls.push({ url, ...init });
            if (options.fetchImpl) return options.fetchImpl(url, init);
            return url.endsWith('/voices/list') ? catalogResponse() : waveResponse();
        }
    });
    // Registration must also work before the application's general parser.
    if (!options.globalParser) app.use(express.json({ limit: '64kb' }));
    const server = http.createServer(app).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    t.after(async () => { relay.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    async function raw(route, { method = 'POST', body = JSON.stringify(CREDENTIALS), headers = { 'Content-Type': 'application/json' } } = {}) {
        const response = await fetch(base + route, { method, body: method === 'GET' ? undefined : body, headers, signal: AbortSignal.timeout(6000) });
        const text = await response.text();
        assert.ok(!text.includes(KEY), 'central key never appears in responses');
        return { status: response.status, headers: response.headers, data: JSON.parse(text), text };
    }
    const post = (route, input) => raw('/api/speech/' + route, { body: JSON.stringify(input) });
    return { app, base, relay, raw, post, calls, rows, blacklist, clock, authorizations };
}

test('authenticated catalog exposes actual native and Turkish-capable multilingual neural voices only', async t => {
    const f = await fixture(t);
    const response = await f.post('voices', CREDENTIALS);
    assert.equal(response.status, 200); assert.equal(response.data.configured, true); assert.equal(response.data.available, true);
    assert.equal(response.data.reason, null); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(response.data.voices.map(v => v.id), ['tr-TR-AhmetNeural', VOICE, 'en-US-AvaMultilingualNeural']);
    assert.deepEqual(response.data.voices.find(v => v.id === VOICE), { id: VOICE, name: 'Emel', lang: 'tr-TR', nativeLang: 'tr-TR', multilingual: false, gender: 'female', provider: 'tikmng', neural: true });
    assert.equal(response.data.voices[2].nativeLang, 'en-US'); assert.equal(response.data.voices[2].multilingual, true);
    assert.equal(f.calls[0].url, 'https://westeurope.tts.speech.microsoft.com/cognitiveservices/voices/list');
    assert.equal(f.calls[0].headers['Ocp-Apim-Subscription-Key'], KEY); assert.equal(f.calls[0].redirect, 'manual');
    await f.post('voices', CREDENTIALS); assert.equal(f.calls.length, 1, 'catalog cached after authorization');
    assert.ok(f.authorizations.length >= 2);
});

test('synthesizes selected actual speaker to WAV, escapes SSML and leaves pitch natural', async t => {
    const f = await fixture(t);
    const text = 'Merhaba <audio src="https://bad.invalid/"/> & \'dünya\'';
    const result = await f.post('synthesize', { ...SPEAK, text, voiceId: 'en-US-AvaMultilingualNeural', rate: 1.25 });
    assert.equal(result.status, 200); assert.equal(result.data.mimeType, 'audio/wav');
    assert.deepEqual(Buffer.from(result.data.audioBase64, 'base64'), wave());
    assert.equal(result.data.voice.id, 'en-US-AvaMultilingualNeural');
    const call = f.calls[1];
    assert.equal(call.url, 'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');
    assert.equal(call.headers['X-Microsoft-OutputFormat'], 'riff-24khz-16bit-mono-pcm');
    assert.match(call.body, /name="en-US-AvaMultilingualNeural"/); assert.match(call.body, /<lang xml:lang="tr-TR">/);
    assert.match(call.body, /rate="\+25%" pitch="\+0%"/);
    assert.match(call.body, /&lt;audio src=&quot;https:\/\/bad.invalid\/&quot;\/&gt; &amp; &apos;dünya&apos;/);
    assert.ok(!call.body.includes('<audio')); assert.ok(!call.url.includes(KEY)); assert.ok(!call.body.includes(CREDENTIALS.licenseCode));
    assert.equal(result.data.voice.provider, 'tikmng');
});

test('missing, invalid, revoked, expired, blacklisted and wrong-device licenses fail before network use', async t => {
    const f = await fixture(t);
    for (const endpoint of ['voices', 'synthesize']) {
        const base = endpoint === 'voices' ? CREDENTIALS : SPEAK;
        assert.equal((await f.post(endpoint, { ...base, licenseCode: '' })).status, 401);
        for (const input of [{ ...base, licenseCode: 'MISSING' }, { ...base, deviceId: 'other' }]) {
            assert.equal((await f.post(endpoint, input)).status, 403);
        }
        f.rows[0].durum = 'iptal'; assert.equal((await f.post(endpoint, base)).status, 403); f.rows[0].durum = 'aktif';
        f.rows[0].bitis_zamani = f.clock.value - 1; assert.equal((await f.post(endpoint, base)).status, 403); f.rows[0].bitis_zamani = null;
        f.blacklist.push('TEST'); assert.equal((await f.post(endpoint, base)).status, 403); f.blacklist.pop();
    }
    assert.equal(f.calls.length, 0);
    const snapshot = structuredClone(f.rows);
    await f.post('voices', CREDENTIALS); assert.deepEqual(f.rows, snapshot, 'authorization cannot activate/change licenses');
    f.rows[0].durum = 'iptal'; assert.equal((await f.post('voices', CREDENTIALS)).status, 403, 'cached voices remain protected');
});

test('unconfigured central service fails closed after authorization, ignoring alternate/client credentials', async t => {
    const f = await fixture(t, { env: { MNG_AZURE_SPEECH_KEY: '', AZURE_SPEECH_KEY: KEY, AZURE_SPEECH_REGION: 'westeurope' } });
    for (const endpoint of ['voices', 'synthesize']) {
        const body = endpoint === 'voices' ? CREDENTIALS : SPEAK;
        const response = await f.post(endpoint, body);
        assert.equal(response.status, 503); assert.deepEqual(response.data, { configured: false, available: false, reason: 'CENTRAL_NOT_CONFIGURED', code: 'CENTRAL_NOT_CONFIGURED' });
        assert.equal((await f.post(endpoint, { ...body, licenseCode: 'NO' })).status, 403);
        assert.equal((await f.post(endpoint, { ...body, key: KEY })).status, 400);
    }
    assert.equal(f.calls.length, 0);
});

test('invalid region cannot inject a URL or headers', async t => {
    for (const region of ['https://bad.invalid', 'westeurope@bad.invalid', 'west\r\nX-Key: leak', 'west.evil', 'westeurope/path']) {
        const f = await fixture(t, { env: { MNG_AZURE_SPEECH_REGION: region } });
        assert.equal((await f.post('voices', CREDENTIALS)).data.code, 'CENTRAL_NOT_CONFIGURED'); assert.equal(f.calls.length, 0);
    }
});

test('routes reject query credentials, non-POST methods, invalid JSON, compression, oversized bodies and unknown inputs', async t => {
    const f = await fixture(t);
    assert.equal((await f.raw('/api/speech/voices?licenseCode=TEST&deviceId=device-1')).status, 400);
    assert.equal((await f.raw('/api/speech/voices', { method: 'GET' })).status, 405);
    assert.equal((await f.raw('/api/speech/voices', { headers: { 'Content-Type': 'text/plain' } })).status, 415);
    for (const body of ['{', '[]', 'null', JSON.stringify({ ...CREDENTIALS, unknown: true })]) {
        assert.equal((await f.raw('/api/speech/voices', { body })).status, 400);
    }
    assert.equal((await f.raw('/api/speech/voices', { body: JSON.stringify({ padding: 'x'.repeat(9000) }) })).status, 413);
    assert.equal((await f.raw('/api/speech/voices', { headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' } })).status, 415);
    assert.equal(f.calls.length, 0);
});

test('works after global JSON parser, still validates route body size and credential fields', async t => {
    const f = await fixture(t, { globalParser: true });
    assert.equal((await f.post('voices', CREDENTIALS)).status, 200);
    assert.equal((await f.post('voices', { ...CREDENTIALS, padding: 'x'.repeat(9000) })).status, 413);
    assert.equal((await f.post('voices', { ...CREDENTIALS, licenseCode: {} })).status, 400);
});

test('rejects invalid voice, unsupported language, SSML voice injection, overlong text and invalid rates', async t => {
    const f = await fixture(t);
    for (const patch of [
        { voiceId: 'tr-TR-NonexistentNeural' }, { voiceId: 'en-US-OnlyEnglishNeural' },
        { voiceId: 'tr-TR-EmelNeural"/><audio src="https://bad.invalid"/>' }, { text: 'x'.repeat(501) },
        { text: '' }, { text: '   ' }, { text: 'bad\u0000' }, { text: '\ud800' }, { rate: 0.49 }, { rate: 2.1 }, { rate: '1' },
        { rate: null }, { url: 'https://bad.invalid' }, { pitch: 20 }
    ]) assert.equal((await f.post('synthesize', { ...SPEAK, ...patch })).status, 400);
    assert.equal(f.calls.filter(c => c.method === 'POST').length, 0);
    assert.equal((await f.post('synthesize', { ...SPEAK, text: '😀'.repeat(500), rate: 0.5 })).status, 200, 'Unicode scalar character limit');
});

test('sanitizes all Azure failures, rejects redirects and never forwards provider error bodies', async t => {
    for (const [status, expected, code] of [[401, 503, 'CENTRAL_UNAVAILABLE'], [403, 503, 'CENTRAL_UNAVAILABLE'],
        [429, 429, 'CENTRAL_QUOTA'], [500, 502, 'CENTRAL_UPSTREAM'], [302, 502, 'CENTRAL_UPSTREAM']]) {
        const f = await fixture(t, { fetchImpl: async () => new Response(KEY + ' private provider detail', { status, headers: { location: 'https://bad.invalid' } }) });
        const response = await f.post('voices', CREDENTIALS);
        assert.equal(response.status, expected); assert.equal(response.data.code, code); assert.ok(!response.text.includes('private provider'));
        if (status === 429) assert.equal(response.headers.get('retry-after'), '60');
        assert.equal(f.calls.length, 1);
    }
    const f = await fixture(t, { fetchImpl: async () => { throw new Error(KEY + SPEAK.text); } });
    assert.equal((await f.post('synthesize', SPEAK)).data.code, 'CENTRAL_UPSTREAM');
});

test('rejects malformed, oversized, unsupported and non-neural catalogs; negative caches errors briefly', async t => {
    for (const response of [
        () => new Response('{', { headers: { 'content-type': 'application/json' } }),
        () => Response.json({ voices: CATALOG }),
        () => new Response('[]', { headers: { 'content-type': 'application/json', 'content-length': String(5 * 1024 * 1024) } }),
        () => new Response('[]', { headers: { 'content-type': 'text/html' } })
    ]) {
        const f = await fixture(t, { fetchImpl: async () => response() });
        assert.equal((await f.post('voices', CREDENTIALS)).data.code, 'CENTRAL_RESPONSE_INVALID');
        await f.post('voices', CREDENTIALS); assert.equal(f.calls.length, 1);
        f.clock.value += 5001; await f.post('voices', CREDENTIALS); assert.equal(f.calls.length, 2);
    }
    const f = await fixture(t, { fetchImpl: async () => catalogResponse(CATALOG.slice(3)) });
    assert.equal((await f.post('voices', CREDENTIALS)).data.code, 'CENTRAL_NO_VOICES');
});

test('validates real RIFF/WAVE structure, size and content type before returning base64', async t => {
    const malformed = wave(); malformed.writeUInt32LE(999, 40);
    const wrongFormat = wave(); wrongFormat.writeUInt16LE(3, 20);
    for (const result of [
        () => waveResponse(Buffer.from('RIFFfakeWAVE')),
        () => waveResponse(malformed), () => waveResponse(wrongFormat),
        () => new Response(wave(), { headers: { 'content-type': 'text/html' } }),
        () => new Response(wave(), { headers: { 'content-type': 'audio/wav', 'content-length': String(8 * 1024 * 1024 + 1) } }),
        () => waveResponse(Buffer.alloc(8 * 1024 * 1024 + 1))
    ]) {
        const f = await fixture(t, { fetchImpl: async url => url.endsWith('/voices/list') ? catalogResponse() : result() });
        const response = await f.post('synthesize', SPEAK);
        assert.equal(response.status, 502); assert.equal(response.data.code, 'CENTRAL_RESPONSE_INVALID'); assert.equal(response.data.audioBase64, undefined);
    }
});

test('Azure timeout aborts both the request and slow body reads', async t => {
    for (const mode of ['headers', 'body']) {
        let signal, aborted = false;
        const f = await fixture(t, { env: { MNG_SPEECH_AZURE_TIMEOUT_MS: '100' }, fetchImpl: async (_url, init) => {
            signal = init.signal;
            if (mode === 'headers') return new Promise((_, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new Error(KEY)); }, { once: true }));
            return new Response(new ReadableStream({ start(controller) {
                signal.addEventListener('abort', () => { aborted = true; controller.error(new Error(KEY)); }, { once: true });
            } }), { headers: { 'content-type': 'application/json' } });
        } });
        const result = await f.post('voices', CREDENTIALS);
        assert.equal(result.status, 504); assert.equal(result.data.code, 'CENTRAL_TIMEOUT'); assert.ok(signal.aborted && aborted);
    }
});

test('bounded concurrency, queue and queue timeout reject overload without starting additional synthesis', async t => {
    const started = deferred(), finish = deferred();
    let concurrent = 0, peak = 0;
    const f = await fixture(t, { env: { MNG_SPEECH_CONCURRENCY: '1', MNG_SPEECH_QUEUE_SIZE: '1', MNG_SPEECH_QUEUE_TIMEOUT_MS: '100', MNG_SPEECH_DEVICE_PENDING: '8' },
        fetchImpl: async url => {
            if (url.endsWith('/voices/list')) return catalogResponse();
            concurrent++; peak = Math.max(peak, concurrent); started.resolve(); await finish.promise; concurrent--; return waveResponse();
        } });
    const first = f.post('synthesize', SPEAK); await started.promise;
    const queued = f.post('synthesize', SPEAK);
    const overflow = await f.post('synthesize', SPEAK);
    assert.equal(overflow.status, 503); assert.equal(overflow.data.code, 'CENTRAL_BUSY');
    const expired = await queued; assert.equal(expired.status, 503); assert.equal(expired.data.code, 'CENTRAL_BUSY');
    finish.resolve(); assert.equal((await first).status, 200); assert.equal(peak, 1);
    assert.equal(f.calls.filter(c => c.method === 'POST').length, 1);
    assert.equal((await f.post('synthesize', SPEAK)).status, 200, 'slots released after queue timeout');
});

test('queued work reauthorizes before spending: revoked license cannot start another synthesis', async t => {
    const started = deferred(), finish = deferred();
    const f = await fixture(t, { env: { MNG_SPEECH_CONCURRENCY: '1' }, fetchImpl: async url => {
        if (url.endsWith('/voices/list')) return catalogResponse(); started.resolve(); await finish.promise; return waveResponse();
    } });
    const first = f.post('synthesize', SPEAK); await started.promise;
    const next = f.post('synthesize', SPEAK);
    // Wait until the second request has completed its admission authorization.
    const expires = Date.now() + 2000;
    while (f.authorizations.length < 4 && Date.now() < expires) await new Promise(resolve => setImmediate(resolve));
    assert.ok(f.authorizations.length >= 4, 'queued admission authorized');
    f.rows[0].durum = 'iptal'; finish.resolve();
    assert.equal((await first).status, 403, 'revoke also blocks returning in-flight audio');
    assert.equal((await next).status, 403); assert.equal(f.calls.filter(c => c.method === 'POST').length, 1);
});

test('per-device pending cap prevents one caller monopolizing capacity', async t => {
    const started = deferred(), finish = deferred();
    const f = await fixture(t, { env: { MNG_SPEECH_DEVICE_PENDING: '1' }, fetchImpl: async url => {
        if (url.endsWith('/voices/list')) return catalogResponse(); started.resolve(); await finish.promise; return waveResponse();
    } });
    const first = f.post('synthesize', SPEAK); await started.promise;
    assert.equal((await f.post('voices', CREDENTIALS)).data.code, 'CENTRAL_BUSY');
    finish.resolve(); assert.equal((await first).status, 200);
});

test('owner hourly budget is shared across agency devices and hour rollover preserves daily usage', async t => {
    const f = await fixture(t, { env: { MNG_SPEECH_OWNER_HOURLY_CHARS: '10', MNG_SPEECH_OWNER_DAILY_CHARS: '15' }, authorize: () => ({ ownerId: 'agency' }) });
    assert.equal((await f.post('synthesize', { ...SPEAK, text: '123456' })).status, 200);
    const second = { ...SPEAK, deviceId: 'device-2', text: '12345' };
    assert.equal((await f.post('synthesize', second)).data.code, 'CENTRAL_QUOTA');
    f.clock.value += 60 * 60 * 1000;
    assert.equal((await f.post('synthesize', second)).status, 200);
    assert.equal((await f.post('synthesize', second)).data.code, 'CENTRAL_QUOTA');
    f.clock.value += 24 * 60 * 60 * 1000;
    assert.equal((await f.post('synthesize', second)).status, 200);
});

test('device character caps and server global daily cap are enforced independently', async t => {
    for (const budget of ['MNG_SPEECH_DEVICE_HOURLY_CHARS', 'MNG_SPEECH_DEVICE_DAILY_CHARS', 'MNG_SPEECH_GLOBAL_DAILY_CHARS']) {
        const f = await fixture(t, { env: { [budget]: '8' }, authorize: input => ({ ownerId: input.licenseCode }) });
        assert.equal((await f.post('synthesize', { ...SPEAK, text: '12345' })).status, 200);
        const input = { ...SPEAK, text: '1234', ...(budget.includes('GLOBAL') ? { licenseCode: 'OTHER', deviceId: 'other' } : {}) };
        const result = await f.post('synthesize', input); assert.equal(result.status, 429); assert.equal(result.data.code, 'CENTRAL_QUOTA');
        assert.ok(Number(result.headers.get('retry-after')) > 0);
        assert.equal(f.calls.filter(c => c.method === 'POST').length, 1);
    }
});

test('owner, device and global request rates cover catalog cache hits and reset each minute', async t => {
    for (const budget of ['MNG_SPEECH_OWNER_REQUESTS_PER_MINUTE', 'MNG_SPEECH_DEVICE_REQUESTS_PER_MINUTE', 'MNG_SPEECH_GLOBAL_REQUESTS_PER_MINUTE']) {
        const f = await fixture(t, { env: { [budget]: '1' }, authorize: input => ({ ownerId: input.licenseCode }) });
        assert.equal((await f.post('voices', CREDENTIALS)).status, 200);
        const next = { ...CREDENTIALS, ...(budget.includes('GLOBAL') ? { licenseCode: 'OTHER', deviceId: 'other' } : budget.includes('OWNER') ? { deviceId: 'other' } : {}) };
        assert.equal((await f.post('voices', next)).status, 429);
        f.clock.value += 60000; assert.equal((await f.post('voices', next)).status, 200);
    }
});

test('failed upstream syntheses reserve budget conservatively; unknown voices do not spend characters', async t => {
    const f = await fixture(t, { env: { MNG_SPEECH_OWNER_HOURLY_CHARS: '5' }, fetchImpl: async url => url.endsWith('/voices/list') ? catalogResponse() : new Response(KEY, { status: 429 }) });
    assert.equal((await f.post('synthesize', { ...SPEAK, voiceId: 'tr-TR-UnknownNeural', text: '12345' })).status, 400);
    assert.equal((await f.post('synthesize', { ...SPEAK, text: '12345' })).status, 429);
    assert.equal((await f.post('synthesize', { ...SPEAK, text: '1' })).status, 429);
    assert.equal(f.calls.filter(c => c.method === 'POST').length, 1);
});

test('callback failures and non-owner authorization results never grant access', async t => {
    for (const authorize of [() => true, () => 'owner', () => ({}), () => { throw new Error(KEY); }]) {
        const f = await fixture(t, { authorize });
        const response = await f.post('voices', CREDENTIALS);
        assert.ok([403, 503].includes(response.status)); assert.equal(f.calls.length, 0);
    }
});

test('invalid configuration bounds fail at startup without including values in errors', () => {
    for (const env of [{ MNG_SPEECH_CONCURRENCY: '0' }, { MNG_SPEECH_QUEUE_SIZE: '999' }, { MNG_SPEECH_GLOBAL_DAILY_CHARS: KEY }]) {
        assert.throws(() => registerSpeechRelay(express(), { authorize: () => false, env }), error => error instanceof TypeError && !error.message.includes(KEY));
    }
});

test('simultaneous requests reserve owner budget atomically across multiple devices', async t => {
    const started = deferred(), finish = deferred();
    const f = await fixture(t, { env: { MNG_SPEECH_OWNER_DAILY_CHARS: '5' }, authorize: () => ({ ownerId: 'shared-owner' }), fetchImpl: async url => {
        if (url.endsWith('/voices/list')) return catalogResponse(); started.resolve(); await finish.promise; return waveResponse();
    } });
    const first = f.post('synthesize', { ...SPEAK, text: '12345' }); await started.promise;
    const second = await f.post('synthesize', { ...SPEAK, deviceId: 'second-device', text: '1' });
    assert.equal(second.status, 429); assert.equal(second.data.code, 'CENTRAL_QUOTA');
    finish.resolve(); assert.equal((await first).status, 200);
    assert.equal(f.calls.filter(c => c.method === 'POST').length, 1);
});

test('owner pending cap spans multiple devices, while other licenses retain access', async t => {
    const started = deferred(), finish = deferred();
    const f = await fixture(t, { env: { MNG_SPEECH_OWNER_PENDING: '1' }, authorize: input => ({ ownerId: input.licenseCode }), fetchImpl: async url => {
        if (url.endsWith('/voices/list')) return catalogResponse(); started.resolve(); await finish.promise; return waveResponse();
    } });
    const first = f.post('synthesize', SPEAK); await started.promise;
    assert.equal((await f.post('voices', { ...CREDENTIALS, deviceId: 'second-device' })).data.code, 'CENTRAL_BUSY');
    assert.equal((await f.post('voices', { licenseCode: 'OTHER', deviceId: 'second-device' })).status, 200);
    finish.resolve(); assert.equal((await first).status, 200);
});

test('disconnected caller aborts Azure and releases its concurrency slot', async t => {
    const started = deferred();
    let upstreamAborted = false;
    const f = await fixture(t, { env: { MNG_SPEECH_CONCURRENCY: '1' }, fetchImpl: async (url, init) => {
        if (url.endsWith('/voices/list')) return catalogResponse();
        return new Promise((_, reject) => { started.resolve(); init.signal.addEventListener('abort', () => {
            upstreamAborted = true; reject(new Error(KEY));
        }, { once: true }); });
    } });
    const request = http.request(f.base + '/api/speech/synthesize', { method: 'POST', headers: { 'content-type': 'application/json' } });
    request.on('error', () => {}); request.end(JSON.stringify(SPEAK)); await started.promise; request.destroy();
    const expires = Date.now() + 2000;
    while (!upstreamAborted && Date.now() < expires) await new Promise(resolve => setImmediate(resolve));
    assert.ok(upstreamAborted); assert.equal((await f.post('voices', CREDENTIALS)).status, 200);
});

test('authorization deadline and non-cooperative fetch cannot keep an HTTP request open indefinitely', async t => {
    const auth = await fixture(t, { authorize: () => new Promise(() => {}) });
    assert.equal((await auth.post('voices', CREDENTIALS)).data.code, 'CENTRAL_UNAVAILABLE'); assert.equal(auth.calls.length, 0);
    const provider = await fixture(t, { env: { MNG_SPEECH_AZURE_TIMEOUT_MS: '100', MNG_SPEECH_CONCURRENCY: '1' }, fetchImpl: () => new Promise(() => {}) });
    assert.equal((await provider.post('voices', CREDENTIALS)).data.code, 'CENTRAL_TIMEOUT');
    provider.clock.value += 5001;
    assert.equal((await provider.post('voices', CREDENTIALS)).data.code, 'CENTRAL_BUSY');
    assert.equal(provider.calls.length, 1, 'non-cooperative transports keep their bounded upstream slot');
});

test('catalog expiry refreshes the actual list; backward clock changes cannot reset consumed budgets', async t => {
    let fetches = 0;
    const f = await fixture(t, { env: { MNG_SPEECH_OWNER_DAILY_CHARS: '5' }, fetchImpl: async url => {
        if (!url.endsWith('/voices/list')) return waveResponse();
        fetches++; return catalogResponse(fetches === 1 ? CATALOG : CATALOG.slice(1));
    } });
    assert.equal((await f.post('synthesize', { ...SPEAK, text: '12345' })).status, 200);
    const initialTime = f.clock.value; f.clock.value -= 24 * 60 * 60 * 1000;
    assert.equal((await f.post('synthesize', { ...SPEAK, text: '1' })).data.code, 'CENTRAL_QUOTA');
    f.clock.value = initialTime + 300001;
    const refreshed = await f.post('voices', CREDENTIALS);
    assert.equal(refreshed.status, 200); assert.equal(fetches, 2);
    assert.equal(refreshed.data.voices.some(v => v.id === VOICE), false);
    assert.equal((await f.post('synthesize', SPEAK)).data.code, 'CENTRAL_INVALID_VOICE');
});

test('close aborts active upstream work and rejects future requests', async t => {
    const started = deferred();
    const f = await fixture(t, { fetchImpl: async (_url, init) => new Promise((_, reject) => {
        started.resolve(); init.signal.addEventListener('abort', () => reject(new Error(KEY)), { once: true });
    }) });
    const pending = f.post('voices', CREDENTIALS); await started.promise; f.relay.close();
    assert.equal((await pending).status, 504); assert.equal((await f.post('voices', CREDENTIALS)).data.code, 'CENTRAL_BUSY');
});
