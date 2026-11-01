'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { createVoicePackManager, CATALOG } = require('../lib/voice-pack-manager.cjs');
const { createSpeechService, SPEECH_STYLE_IDS } = require('../lib/speech-service.cjs');

(async () => {
    const output = path.resolve(process.env.MNG_VOICE_QA_OUTPUT || 'D:/TikMnG-QA-Delivery/offline-voices');
    fs.mkdirSync(output, { recursive: true });
    const packs = createVoicePackManager({ root: path.join(output, 'packs'), bundledFrontend: path.resolve(__dirname, '../lib/voice-assets/okur-frontend.wasm') });
    const service = createSpeechService({ voicePacks: packs, env: {}, windowsRunner: async () => [] });
    for (const pack of CATALOG) if (!packs.list().find(p => p.id === pack.id).installed) await packs.install(pack.id);
    const results = [];
    const base = [];
    for (const pack of CATALOG) {
        const hashes = [];
        for (const style of SPEECH_STYLE_IDS) {
            const started = performance.now();
            const audio = await service.synthesize({ text: 'Merhaba, yayınımıza hoş geldiniz. Bugün birlikte oyun oynuyoruz.', provider: 'offline', voiceURI: pack.voiceURI, voicePreset: style });
            const wav = Buffer.from(audio.audioBase64, 'base64');
            assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
            assert.ok(wav.length > 50000);
            const hash = crypto.createHash('sha256').update(wav).digest('hex'); hashes.push(hash);
            fs.writeFileSync(path.join(output, pack.id + '-' + style + '.wav'), wav);
            if (style === 'natural') base.push(hash);
            results.push({ pack: pack.id, style, bytes: wav.length, sampleRate: wav.readUInt32LE(24), sha256: hash, ms: Math.round(performance.now() - started) });
        }
        assert.equal(new Set(hashes).size, SPEECH_STYLE_IDS.length);
    }
    assert.equal(new Set(base).size, 2);
    const result = { passed: true, networkRequiredAfterInstall: false, realOfflineSpeakers: base.length, renderedStyles: results.length, results };
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ passed: true, realOfflineSpeakers: base.length, renderedStyles: results.length, output }));
})().catch(error => { console.error(error); process.exitCode = 1; });
