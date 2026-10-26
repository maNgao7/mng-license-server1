'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCentralSpeech } = require('../lib/central-speech.cjs');
const voices = [{ id: 'tr-TR-EmelNeural', name: 'Emel', gender: 'Female' }, { id: 'tr-TR-AhmetNeural', name: 'Ahmet', gender: 'Male' }];
function wav() { const value = Buffer.alloc(48);value.write('RIFF');value.write('WAVE', 8);return value; }
test('central speech uses licensed POST requests and exact speaker IDs without exposing credentials', async () => {
    const calls = [], service = createCentralSpeech({ serverURL: () => 'https://example.test', getCredentials: () => ({ licenseCode: 'license-private', deviceId: 'device' }),
        fetchImpl: async (url, options) => { const body = JSON.parse(options.body);calls.push({ url, options, body });return url.pathname.endsWith('/voices') ? Response.json({ voices }) : Response.json({ audioBase64: wav().toString('base64'), voice: { id: body.voiceId } }); } });
    const status = await service.listVoices();assert.equal(status.voices.length, 2);assert.equal(status.voices[0].voiceURI, 'tikmng:tr-TR-EmelNeural');
    assert.equal(JSON.stringify(status).includes('license-private'), false);
    for (const voice of status.voices) assert.equal((await service.synthesize({ voiceURI: voice.voiceURI, text: 'Merhaba', rate: 1 })).toString('ascii', 0, 4), 'RIFF');
    assert.deepEqual(calls.slice(1).map(call => call.body.voiceId), voices.map(v => v.id));
    assert.equal(calls.every(call => call.options.method === 'POST' && call.options.redirect === 'error'), true);
    assert.equal(calls.every(call => !call.url.href.includes('license-private')), true);
});
test('central failures never leak server details or silently fall back to a different speaker', async () => {
    for (const [status, code, expected] of [[503, 'CENTRAL_NOT_CONFIGURED', 'CENTRAL_NOT_CONFIGURED'], [429, '', 'CENTRAL_QUOTA'], [401, '', 'CENTRAL_LICENSE'], [500, '', 'CENTRAL_UNAVAILABLE']]) {
        const service = createCentralSpeech({ serverURL: () => 'https://example.test', getCredentials: () => ({ licenseCode: 'license', deviceId: 'device' }), fetchImpl: async () => Response.json({ code, secret: 'must-not-leak' }, { status }) });
        const result = await service.listVoices();assert.equal(result.reason, expected);assert.equal(result.available, false);
        await assert.rejects(service.synthesize({ voiceURI: 'tikmng:emel', text: 'test' }), error => error.code === expected && !error.message.includes('must-not-leak'));
    }
});
test('license change invalidates central catalog cache; absent license makes no request', async () => {
    let credentials = null, requests = 0;
    const service = createCentralSpeech({ serverURL: () => 'https://example.test', getCredentials: () => credentials, fetchImpl: async () => { requests++;return Response.json({ voices }); } });
    assert.equal((await service.listVoices()).reason, 'CENTRAL_LICENSE');assert.equal(requests, 0);
    credentials = { licenseCode: 'one', deviceId: 'device' };await service.listVoices();await service.listVoices();assert.equal(requests, 1);
    credentials = { licenseCode: 'two', deviceId: 'device' };await service.listVoices();assert.equal(requests, 2);
});
