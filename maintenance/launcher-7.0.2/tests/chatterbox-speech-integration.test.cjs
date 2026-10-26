'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSpeechService } = require('../lib/speech-service.cjs');
const { createSpeechEngine } = require('../renderer/speech-engine.js');

// Match the independently declared reference catalog, not the ten effect presets.
const SPEAKERS = [
    ['d2-00331', 'Ece', 'female'], ['d2-00919', 'Mert', 'male'],
    ['d1-00525', 'Ada', 'female'], ['d1-02311', 'Efe', 'male'],
    ['d1-02057', 'Derya', 'female'], ['d2-00703', 'Arda', 'male'],
    ['d1-01027', 'Neva', 'female'], ['d1-00884', 'Bora', 'male'],
    ['d1-00781', 'Beste', 'female'], ['d1-00727', 'Usta', 'male']
].map(([id, name, gender]) => ({
    id, name, gender, voiceURI: `chatterbox:${id}`, provider: 'chatterbox',
    lang: 'tr-TR', neural: true, localService: true
}));

function wav(marker = 1) {
    // Synthetic PCM fixture only: these samples do not establish speaker quality.
    const audio = Buffer.alloc(48);
    audio.write('RIFF'); audio.writeUInt32LE(audio.length - 8, 4);
    audio.write('WAVEfmt ', 8); audio.writeUInt32LE(16, 16);
    audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
    audio.writeUInt32LE(24000, 24); audio.writeUInt32LE(48000, 28);
    audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34);
    audio.write('data', 36); audio.writeUInt32LE(4, 40);
    audio.writeInt16LE(marker, 44); audio.writeInt16LE(-marker, 46);
    return audio;
}

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function fixture({ installed = true, status, synthesize, packs = [], centralVoices = [] } = {}) {
    const calls = { chatterbox: [], windows: [], offline: [], central: [], cancels: 0 };
    const chatterbox = {
        status: status || (async () => ({ available: installed, reason: installed ? null : 'CHATTERBOX_PACK_MISSING',
            voices: installed ? SPEAKERS.map(voice => ({ ...voice })) : [], installBytes: 123456,
            performance: { device: 'cpu', threads: 6, realtime: false } })),
        async synthesize(input, options) {
            calls.chatterbox.push({ input, options });
            if (synthesize) return synthesize(input, options);
            return wav(SPEAKERS.findIndex(voice => voice.voiceURI === input.voiceURI) + 1);
        },
        cancel() { calls.cancels++; }
    };
    const service = createSpeechService({ env: {}, chatterbox,
        windowsRunner: async (action, payload) => {
            calls.windows.push({ action, payload });
            return action === 'list' ? [{ id: 'tolga', name: 'Microsoft Tolga', lang: 'tr-TR', gender: 'Male' }]
                : wav(100).toString('base64');
        },
        voicePacks: { list: () => packs.map(pack => ({ ...pack })), resolve: id => `/verified/${id}` },
        offlineRunner: async (...args) => { calls.offline.push(args); return wav(101); },
        central: { listVoices: async () => ({ available: centralVoices.length > 0, voices: centralVoices }),
            synthesize: async (...args) => { calls.central.push(args); return wav(102); } },
        fetchImpl: async () => { throw new Error('Integration tests must not access the network.'); }
    });
    return { service, calls };
}

function assertNoOtherSynthesis(calls) {
    assert.equal(calls.windows.filter(call => call.action === 'synthesize').length, 0);
    assert.equal(calls.offline.length, 0);
    assert.equal(calls.central.length, 0);
}

function playbackScope() {
    const played = deferred();
    const audios = [], blobs = [], revoked = [];
    const scope = { setTimeout, clearTimeout, Blob, atob,
        URL: { createObjectURL(blob) { blobs.push(blob); return `blob:chatterbox-${blobs.length}`; },
            revokeObjectURL(url) { revoked.push(url); } },
        Audio: class {
            constructor(src) {
                this.src = src; this._playbackRate = 1; this._preservesPitch = false;
                audios.push(this);
            }
            get playbackRate() { return this._playbackRate; }
            set playbackRate(value) { this._playbackRate = value; }
            get preservesPitch() { return this._preservesPitch; }
            set preservesPitch(value) { this._preservesPitch = value; }
            play() {
                this.atPlay = { rate: this.playbackRate, preservesPitch: this.preservesPitch };
                played.resolve(this);
                return Promise.resolve();
            }
            pause() { this.paused = true; }
            removeAttribute(name) { if (name === 'src') this.src = ''; }
            load() {}
        }
    };
    return { scope, played, audios, blobs, revoked };
}

test('Chatterbox exposes ten independent catalog URIs without replacing them with effect profiles', async () => {
    const { service } = fixture();
    const status = await service.status();
    const voices = status.voices.filter(voice => voice.provider === 'chatterbox');
    assert.deepEqual(voices, SPEAKERS);
    assert.equal(new Set(voices.map(voice => voice.voiceURI)).size, 10);
    assert.equal(status.providers.chatterbox.speakers, 10);
    assert.equal(status.providers.chatterbox.available, true);
    assert.equal(status.providers.chatterbox.installBytes, 123456);
    assert.deepEqual(status.providers.chatterbox.performance, { device: 'cpu', threads: 6, realtime: false });
    voices[0].voiceURI = 'chatterbox:mutated';
    assert.equal((await service.status()).voices[0].voiceURI, SPEAKERS[0].voiceURI);
});

test('all ten exact Chatterbox selections reach synthesis unchanged with natural backend rate', async t => {
    for (const voice of SPEAKERS) {
        await t.test(voice.voiceURI, async () => {
            const { service, calls } = fixture();
            for (const provider of ['chatterbox', undefined]) {
                const result = await service.synthesize({ text: 'Merhaba, yayina hos geldin.', voiceURI: voice.voiceURI,
                    provider, voicePreset: 'natural', rate: 1.5 });
                const last = calls.chatterbox.at(-1);
                assert.deepEqual(last.input, { text: 'Merhaba, yayina hos geldin.', voiceURI: voice.voiceURI, rate: 1 });
                assert.ok(last.options.signal instanceof AbortSignal);
                assert.equal(last.options.signal.aborted, false);
                assert.equal(result.voice.voiceURI, voice.voiceURI);
                assert.equal(result.voice.id, voice.id);
                assert.equal(result.voice.provider, 'chatterbox');
                assert.equal(result.voice.style, 'natural');
                assert.equal(result.playbackRate, 1.5);
                assert.equal(result.fallbackUsed, false);
                assert.equal(result.mimeType, 'audio/wav');
                assert.deepEqual(Buffer.from(result.audioBase64, 'base64'), wav(SPEAKERS.indexOf(voice) + 1));
            }
            assert.equal(calls.chatterbox.length, 1, 'Explicit and inferred provider share the same verified local audio cache');
            assertNoOtherSynthesis(calls);
        });
    }
});

test('effect presets cannot substitute another Chatterbox speaker or distort its generated rate', async () => {
    const { service, calls } = fixture();
    for (const voicePreset of ['female', 'girl', 'boy', 'deep', 'tiny']) {
        const result = await service.synthesize({ text: 'Test', provider: 'chatterbox', voiceURI: SPEAKERS[1].voiceURI,
            voicePreset, rate: 1.5 });
        assert.deepEqual(calls.chatterbox.at(-1).input, { text: 'Test', voiceURI: SPEAKERS[1].voiceURI, rate: 1 });
        assert.equal(result.voice.id, SPEAKERS[1].id);
        assert.equal(result.playbackRate, 1.5);
        assert.deepEqual(Buffer.from(result.audioBase64, 'base64'), wav(2));
    }
    assertNoOtherSynthesis(calls);
});

test('renderer and real speech service preserve each exact URI and play at 1.5 with pitch preservation', async t => {
    for (const voice of SPEAKERS) {
        await t.test(voice.name, { timeout: 5000 }, async t => {
            const { service, calls } = fixture();
            const playback = playbackScope();
            const engine = createSpeechEngine({ bridge: service, scope: playback.scope });
            t.after(() => engine.dispose());
            const speaking = engine.speak('Test', { provider: 'chatterbox', voiceURI: voice.voiceURI,
                voicePreset: 'natural', rate: 1.5, volume: 0.35 });
            const audio = await playback.played.promise;
            assert.deepEqual(audio.atPlay, { rate: 1.5, preservesPitch: true });
            assert.equal(audio.volume, 0.35);
            assert.deepEqual(calls.chatterbox[0].input, { text: 'Test', voiceURI: voice.voiceURI, rate: 1 });
            assert.deepEqual(Buffer.from(await playback.blobs[0].arrayBuffer()), wav(SPEAKERS.indexOf(voice) + 1));
            audio.onended();
            const result = await speaking;
            assert.equal(result.voice.voiceURI, voice.voiceURI);
            assert.equal(result.fallbackUsed, false);
            assert.equal(audio.paused, true);
            assert.equal(audio.src, '');
            assert.deepEqual(playback.revoked, ['blob:chatterbox-1']);
            assertNoOtherSynthesis(calls);
        });
    }
});

test('Chatterbox playback rate is bounded and non-Chatterbox audio keeps normal playback speed', async () => {
    for (const [rate, expected] of [[0.1, 0.5], [3, 2], ['1.5', 1.5], [NaN, 1]]) {
        const { service, calls } = fixture();
        const result = await service.synthesize({ text: 'Test', voiceURI: SPEAKERS[0].voiceURI, rate });
        assert.equal(result.playbackRate, expected);
        assert.equal(calls.chatterbox[0].input.rate, 1);
    }
    const { service } = fixture();
    const playback = playbackScope();
    const engine = createSpeechEngine({ bridge: service, scope: playback.scope });
    const speaking = engine.speak('Test', { provider: 'windows', voiceURI: 'windows:tolga', rate: 1.5 });
    const audio = await playback.played.promise;
    assert.deepEqual(audio.atPlay, { rate: 1, preservesPitch: false });
    audio.onended(); await speaking;
});

test('a missing Chatterbox pack never silently falls back to Windows, even with fallback enabled', async () => {
    const { service, calls } = fixture({ installed: false });
    const status = await service.status();
    assert.equal(status.providers.chatterbox.available, false);
    assert.equal(status.providers.chatterbox.speakers, 0);
    assert.equal(status.providers.chatterbox.reason, 'CHATTERBOX_PACK_MISSING');
    for (const provider of ['chatterbox', undefined]) {
        for (const allowOfflineFallback of [false, true]) {
            await assert.rejects(service.synthesize({ text: 'Test', provider, voiceURI: SPEAKERS[0].voiceURI,
                allowOfflineFallback }), { code: 'CHATTERBOX_NOT_INSTALLED' });
        }
    }
    assert.equal(calls.chatterbox.length, 0);
    assertNoOtherSynthesis(calls);
});

test('unavailable or empty catalogs cannot leak stale Chatterbox voices into selection', async () => {
    for (const status of [{ available: false, voices: SPEAKERS, reason: 'CHATTERBOX_PACK_INVALID' },
        { available: true, voices: [] }]) {
        const { service, calls } = fixture({ status: async () => status });
        const catalog = await service.status();
        assert.equal(catalog.providers.chatterbox.available, false);
        assert.equal(catalog.providers.chatterbox.speakers, 0);
        assert.equal(catalog.voices.some(voice => voice.provider === 'chatterbox'), false);
        await assert.rejects(service.synthesize({ text: 'Test', provider: 'chatterbox', allowOfflineFallback: true }),
            { code: 'CHATTERBOX_NOT_INSTALLED' });
        assertNoOtherSynthesis(calls);
    }
});

test('unknown or mismatched exact voice URIs fail instead of choosing a nearby speaker', async () => {
    const { service, calls } = fixture();
    for (const settings of [{ voiceURI: 'chatterbox:d2-99999' },
        { provider: 'windows', voiceURI: SPEAKERS[0].voiceURI },
        { provider: 'chatterbox', voiceURI: 'windows:tolga' }]) {
        await assert.rejects(service.synthesize({ text: 'Test', allowOfflineFallback: true, ...settings }),
            { code: 'VOICE_UNAVAILABLE' });
    }
    assert.equal(calls.chatterbox.length, 0);
    assertNoOtherSynthesis(calls);
});

test('runtime failure and invalid WAV never trigger silent Chatterbox substitution', async () => {
    for (const code of ['CHATTERBOX_PACK_MISSING', 'CHATTERBOX_WORKER_EXIT', 'CHATTERBOX_TIMEOUT']) {
        const { service, calls } = fixture({ synthesize: async () => { throw Object.assign(new Error(code), { code }); } });
        await assert.rejects(service.synthesize({ text: 'Test', voiceURI: SPEAKERS[0].voiceURI, allowOfflineFallback: true }), { code });
        assertNoOtherSynthesis(calls);
    }
    const { service, calls } = fixture({ synthesize: async () => Buffer.from('not audio') });
    await assert.rejects(service.synthesize({ text: 'Test', voiceURI: SPEAKERS[0].voiceURI }), { code: 'INVALID_AUDIO' });
    assertNoOtherSynthesis(calls);
});

test('service cancellation aborts synthesis, calls runtime cancel, and allows the next request', { timeout: 5000 }, async () => {
    const started = deferred(); let cancelled = false;
    const { service, calls } = fixture({ synthesize: async (_input, { signal }) => {
        if (cancelled) return wav(2);
        started.resolve(signal);
        return new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
            cancelled = true; reject(new Error('backend aborted'));
        }, { once: true }));
    } });
    const speaking = service.synthesize({ text: 'Test', voiceURI: SPEAKERS[0].voiceURI });
    const rejected = assert.rejects(speaking, { code: 'SPEECH_CANCELLED' });
    const signal = await started.promise;
    service.cancel(); await rejected;
    assert.equal(signal.aborted, true);
    assert.equal(calls.cancels, 1);
    const next = await service.synthesize({ text: 'Again', voiceURI: SPEAKERS[1].voiceURI });
    assert.equal(next.voice.voiceURI, SPEAKERS[1].voiceURI);
    assert.equal(next.fallbackUsed, false);
    assertNoOtherSynthesis(calls);
});

test('renderer cancellation cannot play late Chatterbox audio and a fresh request still works', { timeout: 5000 }, async () => {
    const started = deferred(), late = deferred();
    let first = true;
    const { service, calls } = fixture({ synthesize: async () => {
        if (!first) return wav(2);
        first = false; started.resolve(); return late.promise;
    } });
    const playback = playbackScope();
    const engine = createSpeechEngine({ bridge: service, scope: playback.scope });
    const speaking = engine.speak('Test', { voiceURI: SPEAKERS[0].voiceURI });
    const rejected = assert.rejects(speaking, { code: 'SPEECH_CANCELLED' });
    await started.promise;
    engine.stop(); await rejected;
    assert.equal(calls.chatterbox[0].options.signal.aborted, true);
    assert.equal(calls.cancels, 1);
    late.resolve(wav());
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(playback.audios.length, 0);
    assert.equal(playback.blobs.length, 0);
    const next = engine.speak('Again', { voiceURI: SPEAKERS[1].voiceURI, rate: 1.5 });
    const audio = await playback.played.promise;
    assert.deepEqual(audio.atPlay, { rate: 1.5, preservesPitch: true });
    audio.onended();
    assert.equal((await next).voice.voiceURI, SPEAKERS[1].voiceURI);
    assertNoOtherSynthesis(calls);
});

test('cancelling while the Chatterbox catalog loads prevents synthesis after catalog completion', { timeout: 5000 }, async () => {
    const started = deferred(), catalog = deferred();
    const { service, calls } = fixture({ status: async () => { started.resolve(); return catalog.promise; } });
    const speaking = service.synthesize({ text: 'Test', voiceURI: SPEAKERS[0].voiceURI });
    const rejected = assert.rejects(speaking, { code: 'SPEECH_CANCELLED' });
    await started.promise; service.cancel();
    catalog.resolve({ available: true, voices: SPEAKERS });
    await rejected;
    assert.equal(calls.chatterbox.length, 0);
    assert.equal(calls.cancels, 1);
    assertNoOtherSynthesis(calls);
});

test('voice pack availability and counts exclude central and Chatterbox providers', async t => {
    for (const installed of [false, true]) {
        for (const centralCount of [0, 2]) {
            for (const packCount of [0, 1, 2]) {
                await t.test(`Chatterbox=${installed}, central=${centralCount}, offline=${packCount}`, async () => {
                    const packs = [0, 1].map(index => ({ id: `qa-tr-${index}`, name: `Pack ${index}`,
                        voiceURI: `offline:qa-tr-${index}:default`, language: 'tr-TR', gender: 'neutral', installed: index < packCount }));
                    const centralVoices = Array.from({ length: centralCount }, (_, index) => ({ id: `central-${index}`,
                        voiceURI: `tikmng:central-${index}`, name: `Central ${index}`, lang: 'tr-TR', gender: 'female',
                        provider: 'tikmng', neural: true, localService: false }));
                    const { service } = fixture({ installed, packs, centralVoices });
                    const status = await service.status();
                    assert.equal(status.providers.offline.available, packCount > 0);
                    assert.equal(status.providers.offline.reason, packCount ? null : 'VOICE_PACK_REQUIRED');
                    assert.deepEqual(status.packs, packs);
                    assert.equal(status.packs.filter(pack => pack.installed).length, packCount);
                    assert.deepEqual(status.voices.filter(voice => voice.provider === 'offline').map(voice => voice.voiceURI),
                        packs.filter(pack => pack.installed).map(pack => pack.voiceURI));
                    assert.equal(status.voices.filter(voice => voice.provider === 'tikmng').length, centralCount);
                    assert.equal(status.providers.chatterbox.speakers, installed ? 10 : 0);
                    assert.equal(status.voices.length, packCount + centralCount + (installed ? 10 : 0) + 1);
                });
            }
        }
    }
});

test('URI-only Chatterbox selection wins over available central, offline and Windows voices', async () => {
    const packs = [{ id: 'okur-tr-v1', name: 'Okur', language: 'tr-TR', installed: true,
        voiceURI: 'offline:okur-tr-v1:default', gender: 'neutral' }];
    const centralVoices = [{ id: 'central-female', name: 'Central', provider: 'tikmng', neural: true,
        voiceURI: 'tikmng:central-female', lang: 'tr-TR', gender: 'female' }];
    const { service, calls } = fixture({ packs, centralVoices });
    for (const voice of SPEAKERS) {
        const result = await service.synthesize({ text: 'Test', provider: '', voiceURI: voice.voiceURI,
            voicePreset: 'natural', rate: 1.5 });
        assert.equal(result.voice.voiceURI, voice.voiceURI);
        assert.equal(result.playbackRate, 1.5);
        assert.deepEqual(calls.chatterbox.at(-1).input, { text: 'Test', voiceURI: voice.voiceURI, rate: 1 });
    }
    assert.equal(calls.chatterbox.length, SPEAKERS.length);
    assertNoOtherSynthesis(calls);
});

test('missing download packs retain catalog IDs, sizes and licenses without appearing as playable voices', async () => {
    const { CATALOG } = require('../lib/voice-pack-manager.cjs');
    const packs = CATALOG.map(({ files, ...pack }) => ({ ...pack, installed: false, installing: false }));
    const { service, calls } = fixture({ installed: false, packs });
    const catalog = await service.status();
    assert.deepEqual(catalog.packs.map(pack => pack.id), ['okur-tr-v1', 'ema-tr-v1']);
    for (const pack of catalog.packs) {
        assert.ok(pack.voiceURI.startsWith('offline:'));
        assert.equal(typeof pack.name, 'string');
        assert.ok(pack.name.length > 0);
        assert.ok(Number.isSafeInteger(pack.size) && pack.size > 0);
        assert.ok(pack.license.length > 0);
        assert.equal(pack.installed, false);
        assert.equal(pack.installing, false);
        assert.equal(catalog.voices.some(voice => voice.voiceURI === pack.voiceURI), false);
        await assert.rejects(service.synthesize({ text: 'Test', voiceURI: pack.voiceURI,
            allowOfflineFallback: true }), { code: 'VOICE_UNAVAILABLE' });
    }
    assert.equal(catalog.providers.offline.available, false);
    assert.equal(catalog.providers.chatterbox.speakers, 0);
    assertNoOtherSynthesis(calls);
});

test('download completion and explicit catalog refresh make the same offline voice selectable', async t => {
    for (const [id, name, worker] of [['okur-tr-v1', 'Okur', 'okur-worker.cjs'],
        ['ema-tr-v1', 'EMA', 'ema-worker.cjs']]) {
        await t.test(name, async () => {
            const pack = { id, name, language: 'tr-TR', gender: 'neutral', installed: false,
                voiceURI: `offline:${id}:default` };
            const { service, calls } = fixture({ installed: false, packs: [pack] });
            const before = await service.status();
            assert.equal(before.packs[0].installed, false);
            pack.installed = true;
            const after = await service.status({ refresh: true });
            assert.equal(after.packs[0].installed, true);
            assert.equal(after.providers.offline.available, true);
            assert.equal(after.voices.filter(voice => voice.provider === 'offline').length, 1);
            const result = await service.synthesize({ text: 'Test', voiceURI: pack.voiceURI, rate: 1.5 });
            assert.equal(result.voice.voiceURI, pack.voiceURI);
            assert.equal(result.fallbackUsed, false);
            assert.equal(calls.offline.length, 1);
            assert.equal(calls.offline[0][0], `/verified/${id}`);
            assert.deepEqual(calls.offline[0][1], { text: 'Test', rate: 1.5, pitchFactor: 1 });
            assert.ok(calls.offline[0][2].worker.endsWith(worker));
            assert.equal(calls.chatterbox.length, 0);
            assert.equal(calls.windows.filter(call => call.action === 'synthesize').length, 0);
        });
    }
});

test('Chatterbox pack installation and removal refresh all ten voices without stale playable selections', async () => {
    let installed = false;
    const { service, calls } = fixture({ status: async () => ({ available: installed,
        reason: installed ? null : 'CHATTERBOX_PACK_MISSING', voices: installed ? SPEAKERS : [] }) });
    assert.equal((await service.status()).providers.chatterbox.speakers, 0);
    installed = true;
    const ready = await service.status({ refresh: true });
    assert.equal(ready.providers.chatterbox.speakers, 10);
    assert.deepEqual(ready.voices.filter(voice => voice.provider === 'chatterbox').map(voice => voice.voiceURI),
        SPEAKERS.map(voice => voice.voiceURI));
    for (const voice of SPEAKERS) {
        const result = await service.synthesize({ text: 'Test', voiceURI: voice.voiceURI });
        assert.equal(result.voice.voiceURI, voice.voiceURI);
    }
    installed = false;
    const removed = await service.status({ refresh: true });
    assert.equal(removed.providers.chatterbox.speakers, 0);
    assert.equal(removed.voices.some(voice => voice.provider === 'chatterbox'), false);
    for (const voice of SPEAKERS) {
        await assert.rejects(service.synthesize({ text: 'Test', voiceURI: voice.voiceURI,
            allowOfflineFallback: true }), { code: 'CHATTERBOX_NOT_INSTALLED' });
    }
    assert.equal(calls.chatterbox.length, 10);
    assertNoOtherSynthesis(calls);
});

test('stopping active playback releases audio and the next selected voice uses a new audio instance', { timeout: 5000 }, async () => {
    const { service, calls } = fixture();
    const playback = playbackScope();
    const engine = createSpeechEngine({ bridge: service, scope: playback.scope });
    const first = engine.speak('First', { voiceURI: SPEAKERS[0].voiceURI, rate: 1.5 });
    const cancelled = assert.rejects(first, { code: 'SPEECH_CANCELLED' });
    const firstAudio = await playback.played.promise;
    engine.stop(); await cancelled;
    assert.equal(firstAudio.paused, true);
    assert.equal(firstAudio.onended, null);
    assert.equal(firstAudio.onerror, null);
    assert.equal(firstAudio.src, '');
    assert.deepEqual(playback.revoked, ['blob:chatterbox-1']);
    const second = engine.speak('Second', { voiceURI: SPEAKERS[9].voiceURI, rate: 1.5 });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(playback.audios.length, 2);
    assert.notEqual(playback.audios[1], firstAudio);
    assert.deepEqual(playback.audios[1].atPlay, { rate: 1.5, preservesPitch: true });
    assert.equal(calls.chatterbox.at(-1).input.voiceURI, SPEAKERS[9].voiceURI);
    playback.audios[1].onended();
    assert.equal((await second).voice.voiceURI, SPEAKERS[9].voiceURI);
    assert.deepEqual(playback.revoked, ['blob:chatterbox-1', 'blob:chatterbox-2']);
    assertNoOtherSynthesis(calls);
});
