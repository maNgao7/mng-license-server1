'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createVoicePackManager, CATALOG } = require('../lib/voice-pack-manager.cjs');
const { createSpeechService } = require('../lib/speech-service.cjs');

test('voice packs verify content, reuse downloads, survive restart, and reject unknown IDs', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-voice-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const bytes = Buffer.from('synthetic-model-content');
    const catalog = [{ id: 'qa-tr', version: '1', voiceURI: 'offline:qa-tr:default', files: [{ name: 'model.onnx', bytes: bytes.length,
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'), url: 'https://example.invalid/model' }] }];
    let downloads = 0;
    const options = { root, catalog, downloadFile: async (_url, file) => { downloads++; fs.writeFileSync(file, bytes); } };
    const manager = createVoicePackManager(options);
    await assert.rejects(manager.install('../other'), { code: 'VOICE_PACK_UNKNOWN' });
    await manager.install('qa-tr');
    assert.ok(await manager.verify('qa-tr'));
    assert.ok(createVoicePackManager(options).list()[0].installed);
    await manager.install('qa-tr');
    assert.equal(downloads, 1);
    fs.writeFileSync(path.join(manager.resolve('qa-tr'), 'model.onnx'), Buffer.alloc(bytes.length));
    await assert.rejects(manager.verify('qa-tr'), /bozuk/);
    await manager.install('qa-tr');
    assert.ok(await manager.verify('qa-tr'));
    await manager.remove('qa-tr');
    assert.equal(manager.list()[0].installed, false);
});

test('a failed voice install preserves the old working pack', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-voice-fail-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const data = Buffer.from('good');
    const catalog = [{ id: 'qa-tr', version: '1', files: [{ name: 'model', bytes: 4, sha256: crypto.createHash('sha256').update(data).digest('hex'), url: 'https://example.invalid/model' }] }];
    const manager = createVoicePackManager({ root, catalog, downloadFile: async (_url, file) => fs.writeFileSync(file, data) });
    await manager.install('qa-tr');
    const failing = createVoicePackManager({ root, catalog: [{ ...catalog[0], version: '2', files: [{ ...catalog[0].files[0], sha256: 'a'.repeat(64) }] }], downloadFile: async () => { throw Error('network down'); } });
    await assert.rejects(failing.install('qa-tr'), /network down/);
    assert.ok(await manager.verify('qa-tr'));
});

test('offline speaking selects actual pack, propagates cancellation and creates distinct style audio', async () => {
    const fake = Buffer.alloc(100);fake.write('RIFF');fake.write('WAVE', 8);fake.writeUInt32LE(48000, 24);fake.writeUInt16LE(2, 32);
    const service = createSpeechService({ env: {}, windowsRunner: async () => [],
        voicePacks: { list: () => CATALOG.map(pack => ({ ...pack, installed: true })), verify: async id => '/verified/' + id },
        offlineRunner: async (root, input, options) => { assert.ok(root.startsWith('/verified/'));assert.ok(options.signal);return fake; } });
    const catalog = await service.status();
    assert.equal(catalog.voices.filter(v => v.provider === 'offline').length, 2);
    const natural = await service.synthesize({ text: 'Merhaba', voiceURI: CATALOG[1].voiceURI });
    const child = await service.synthesize({ text: 'Merhaba', voiceURI: CATALOG[1].voiceURI, voicePreset: 'girl' });
    assert.equal(natural.voice.id, 'ema-tr-v1');
    assert.notEqual(child.audioBase64, natural.audioBase64);
});

test('selected-user reading grants only the configured usernames', () => {
    const audience = require('../lib/tts-audience.cjs').createSpeechAudience();
    const settings = { audience: 'selected', allowedUsers: '@Alice, bob; celine' };
    for (const username of ['ALICE', '@bob', 'celine']) assert.equal(audience.allows({ username }, settings, 'host'), true);
    assert.equal(audience.allows({ username: 'other' }, settings, 'host'), false);
});
