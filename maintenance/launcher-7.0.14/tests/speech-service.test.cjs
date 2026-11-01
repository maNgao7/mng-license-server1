'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSpeechService } = require('../lib/speech-service.cjs');
const { createSpeechEngine } = require('../renderer/speech-engine.js');

const installed = [{ id: 'tolga', name: 'Microsoft Tolga', lang: 'tr-TR', gender: 'Male', age: 'Adult' },
    { id: 'english', name: 'English', lang: 'en-US', gender: 'Female', age: 'Adult' }];
const remote = [{ ShortName: 'tr-TR-EmelNeural', LocalName: 'Emel', Locale: 'tr-TR', Gender: 'Female', VoiceType: 'Neural' },
    { ShortName: 'tr-TR-AhmetNeural', Locale: 'tr-TR', Gender: 'Male', VoiceType: 'Neural' }];
function wav() {
    const data = Buffer.alloc(48); data.write('RIFF'); data.writeUInt32LE(40, 4); data.write('WAVEfmt ', 8);
    data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
    data.writeUInt32LE(24000, 24); data.writeUInt32LE(48000, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
    data.write('data', 36); data.writeUInt32LE(4, 40); return data;
}
const windowsRunner = async action => action === 'list' ? installed : wav().toString('base64');

test('ordinary capitalized words and optional handles reach the model as words; repeated local sentences reuse bounded audio', async () => {
    const texts = [];
    const service = createSpeechService({ env: {}, windowsRunner: async (action, payload) => {
        if (action === 'list') return installed;
        texts.push(payload.text); return wav().toString('base64');
    } });
    const sentence = { text: 'KING_JUX: MERHABA İYİ YAYINLAR', voiceURI: 'windows:tolga' };
    await service.synthesize(sentence); await service.synthesize(sentence);
    assert.deepEqual(texts, ['king jux: merhaba iyi yayınlar']);
    for (let i = 0; i < 17; i++) await service.synthesize({ ...sentence, text: 'Farklı yorum ' + i });
    await service.synthesize(sentence); assert.equal(texts.length, 19);
    service.close();
});

test('local catalog exposes ten distinct styles over installed Turkish voices', async () => {
    let requests = 0;
    const synthesized = [];
    const service = createSpeechService({ env: {}, windowsRunner: async (action, payload) => {
        if (action === 'list') return installed;
        synthesized.push(payload.ssml);
        return wav().toString('base64');
    }, fetchImpl: async () => { requests++; throw Error('unexpected'); } });
    const catalog = await service.listVoices();
    assert.equal(catalog.voices.length, 1);
    assert.equal(catalog.voices[0].voiceURI, 'windows:tolga');
    assert.equal(catalog.profiles.length, 10);
    assert.equal(catalog.profiles.every(profile => profile.available), true);
    for (const voicePreset of ['natural', 'female', 'girl', 'deep', 'tiny']) await service.synthesize({ text: 'Test', voicePreset });
    assert.equal(new Set(synthesized).size, 5);
    await assert.rejects(service.synthesize({ text: 'Test', voicePreset: 'robot' }), { code: 'VOICE_UNAVAILABLE' });
    await assert.rejects(service.synthesize({ text: 'Test', voiceURI: 'deleted' }), { code: 'VOICE_UNAVAILABLE' });
    assert.equal(requests, 0);
    assert.equal((await service.synthesize({ text: 'Merhaba', voicePreset: 'male' })).voice.id, 'tolga');
    catalog.voices[0].gender = 'female';
    assert.equal((await service.listVoices()).voices[0].gender, 'male');
});

test('Azure uses documented authenticated REST, real catalog IDs and escaped SSML', async () => {
    const calls = [];
    const service = createSpeechService({ env: { MNG_AZURE_SPEECH_KEY: 'test-secret', MNG_AZURE_SPEECH_REGION: 'westeurope' }, windowsRunner,
        fetchImpl: async (url, options) => {
            calls.push({ url, options });
            return url.endsWith('/voices/list') ? Response.json([...remote, remote[0], { ...remote[0], Locale: 'en-US' }]) : new Response(wav());
        } });
    const catalog = await service.listVoices();
    assert.equal(catalog.voices.length, 3);
    assert.equal(catalog.profiles.find(p => p.id === 'natural').voiceURI, 'azure:tr-TR-EmelNeural');
    assert.equal(catalog.profiles.length, 10);
    assert.equal(catalog.profiles.find(p => p.id === 'girl').available, true);
    assert.ok(!JSON.stringify(catalog).includes('test-secret'));
    const result = await service.synthesize({ text: '<voice> & "merhaba"', voicePreset: 'female', provider: 'azure', pitch: 2 });
    assert.equal(result.voice.id, 'tr-TR-EmelNeural');
    assert.equal(calls[1].url, 'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');
    assert.equal(calls[1].options.headers['Ocp-Apim-Subscription-Key'], 'test-secret');
    assert.equal(calls[1].options.redirect, 'error');
    assert.match(calls[1].options.body, /&lt;voice&gt; &amp; &quot;merhaba&quot;/);
    assert.match(calls[1].options.body, /xmlns="http:\/\/www.w3.org\/2001\/10\/synthesis"/);
    assert.match(calls[1].options.body, /pitch="\+18%"/);
    const manuallySelected = await service.synthesize({ text: 'Test', voiceURI: 'azure:tr-TR-AhmetNeural', voicePreset: 'female' });
    assert.equal(manuallySelected.voice.id, 'tr-TR-AhmetNeural');
    assert.equal(manuallySelected.voice.style, 'female');
});

test('actual multilingual speakers advertising Turkish are offered and selected by exact voice ID', async () => {
    const bodies = [];
    const service = createSpeechService({ env: {}, azure: { key: 'hidden', region: 'westeurope' }, windowsRunner,
        fetchImpl: async (url, options) => url.endsWith('/voices/list') ? Response.json([
            ...remote,
            { ShortName: 'en-US-AvaMultilingualNeural', DisplayName: 'Ava', Locale: 'en-US', SecondaryLocaleList: ['tr-TR', 'de-DE'], Gender: 'Female', VoiceType: 'Neural' },
            { ShortName: 'en-US-OnlyEnglishNeural', Locale: 'en-US', VoiceType: 'Neural' }
        ]) : (bodies.push(options.body), new Response(wav())) });
    const catalog = await service.listVoices();
    const ava = catalog.voices.find(v => v.id === 'en-US-AvaMultilingualNeural');
    assert.equal(ava.multilingual, true);assert.equal(ava.lang, 'tr-TR');
    assert.equal(catalog.voices.some(v => v.id === 'en-US-OnlyEnglishNeural'), false);
    for (const id of ['tr-TR-AhmetNeural', 'tr-TR-EmelNeural', ava.id]) {
        const result = await service.synthesize({ text: 'Merhaba', provider: 'azure', voiceURI: 'azure:' + id, voicePreset: 'natural' });
        assert.equal(result.voice.id, id);assert.equal(result.fallbackUsed, false);
    }
    assert.match(bodies[2], /<lang xml:lang="tr-TR">Merhaba<\/lang>/);
    assert.equal(new Set(bodies).size, 3);
});

test('Azure HTTP failures are sanitized; there are no retries or fallback voices', async () => {
    for (const [status, code] of [[401, 'AZURE_AUTH'], [403, 'AZURE_AUTH'], [429, 'AZURE_LIMIT'], [500, 'AZURE_UNAVAILABLE']]) {
        const service = createSpeechService({ env: {}, azure: { key: 'hidden', region: 'westeurope' }, windowsRunner,
            fetchImpl: async url => url.endsWith('/voices/list') ? Response.json(remote) : new Response('hidden', { status }) });
        await assert.rejects(service.synthesize({ text: 'Test', provider: 'azure' }), error => error.code === code && !String(error).includes('hidden'));
    }
    const service = createSpeechService({ env: {}, azure: { key: 'hidden', region: 'bad.example/path' }, windowsRunner,
        fetchImpl: async () => { throw Error('must not request'); } });
    assert.equal((await service.listVoices()).providers.azure.reason, 'AZURE_CONFIGURATION');
});

test('configuration changes invalidate cached catalogs and never return keys', async () => {
    const service = createSpeechService({ env: {}, windowsRunner, fetchImpl: async () => Response.json(remote) });
    await service.listVoices();
    assert.deepEqual(service.configureAzure({ key: 'hidden', region: 'westeurope' }), { configured: true });
    assert.equal((await service.listVoices()).voices.length, 3);
    service.configureAzure();
    assert.equal((await service.listVoices()).voices.length, 1);
});

test('all styles remain available with one installed voice; bad text/audio fail explicitly', async () => {
    const service = createSpeechService({ env: {}, windowsRunner: async action => action === 'list'
        ? [...installed, { id: 'actual-child', name: 'Child', lang: 'tr-TR', gender: 'Female', age: 'Child' }] : 'not-wav' });
    assert.equal((await service.listVoices()).profiles.length, 10);
    assert.equal((await service.listVoices()).profiles.find(p => p.id === 'girl').voiceURI, 'windows:actual-child');
    for (const text of ['', ' '.repeat(5), 'a'.repeat(501), '\u0000']) await assert.rejects(service.synthesize({ text }), { code: 'INVALID_TEXT' });
    await assert.rejects(service.synthesize({ text: 'Test' }), { code: 'INVALID_AUDIO' });
});

function playbackScope() {
    const audios = []; const revoked = [];
    return { audios, revoked, setTimeout, clearTimeout, Blob, atob,
        URL: { createObjectURL: () => 'blob:test', revokeObjectURL: url => revoked.push(url) },
        Audio: class {
            constructor() { audios.push(this); }
            play() { return Promise.resolve(); }
            pause() { this.paused = true; }
            removeAttribute() {} load() {}
        } };
}
test('renderer plays returned audio and frees resources; ignores pitch and credentials', async () => {
    const scope = playbackScope(); let forwarded;
    const engine = createSpeechEngine({ scope, bridge: { synthesize: async settings => {
        forwarded = settings; return { audioBase64: wav().toString('base64'), mimeType: 'audio/wav', voice: { id: 'Emel' } };
    } } });
    const speaking = engine.speak('Test', { volume: 0.4, pitch: 2, key: 'hidden' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(scope.audios[0].volume, 0.4);
    assert.equal(forwarded.key, undefined); assert.equal(forwarded.pitch, undefined);
    scope.audios[0].onended();
    assert.deepEqual(await speaking, { voice: { id: 'Emel' }, fallbackUsed: false });
    assert.equal(scope.revoked.length, 1);
});

test('stop during synthesis prevents late audio playback and settles the caller', async () => {
    const scope = playbackScope(); let finish;
    const engine = createSpeechEngine({ scope, bridge: { synthesize: () => new Promise(resolve => { finish = resolve; }) } });
    const speaking = engine.speak('Test');
    const rejected = assert.rejects(speaking, { code: 'SPEECH_CANCELLED' });
    await new Promise(resolve => setImmediate(resolve)); engine.stop();
    finish({ audioBase64: wav().toString('base64'), mimeType: 'audio/wav' });
    await rejected; await new Promise(resolve => setImmediate(resolve));
    assert.equal(scope.audios.length, 0);
    const absent = createSpeechEngine();
    assert.equal((await absent.listVoices()).profiles.every(p => !p.available), true);
});

test('Azure fallback requires explicit opt-in and preserves the selected style', async () => {
    const service = createSpeechService({ env: {}, azure: { key: 'hidden', region: 'westeurope' }, windowsRunner,
        fetchImpl: async () => new Response('offline', { status: 503 }) });
    await assert.rejects(service.synthesize({ text: 'Test' }), { code: 'AZURE_UNAVAILABLE' });
    const result = await service.synthesize({ text: 'Test', allowOfflineFallback: true });
    assert.equal(result.voice.id, 'tolga'); assert.equal(result.fallbackUsed, true);
    const female = await service.synthesize({ text: 'Test', voicePreset: 'female', allowOfflineFallback: true });
    const child = await service.synthesize({ text: 'Test', voicePreset: 'child', allowOfflineFallback: true });
    assert.equal(female.voice.style, 'female');
    assert.equal(child.voice.style, 'girl');
});

test('cancel aborts backend production and a later request can still succeed', async () => {
    let started;
    let cancelledOnce = false;
    const ready = new Promise(resolve => { started = resolve; });
    const service = createSpeechService({ env: {}, windowsRunner: async (action, payload, { signal } = {}) => {
        if (action === 'list') return installed;
        if (cancelledOnce) return wav().toString('base64');
        started();
        return new Promise((resolve, reject) => signal.addEventListener('abort', () => { cancelledOnce = true; reject(Error('aborted')); }, { once: true }));
    } });
    const speaking = service.synthesize({ text: 'Test' });
    const rejected = assert.rejects(speaking, { code: 'SPEECH_CANCELLED' });
    await ready; service.cancel(); await rejected;
    assert.equal((await service.status()).voices.length, 1);
    assert.equal((await service.synthesize({ text: 'Again' })).voice.id, 'tolga');
});
