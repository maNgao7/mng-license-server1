'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = 'D:/TikMnG-QA-Delivery/installed-speech';
let app;
(async () => {
    fs.mkdirSync(output, { recursive: true });
    const env = { ...process.env };delete env.ELECTRON_RUN_AS_NODE;delete env.MNG_TEST_PROFILE;
    app = await _electron.launch({ executablePath: 'D:/TikMnG-Test-6.5.17/win-unpacked/TikMnG Test.exe', env });
    const page = await app.firstWindow();
    await page.waitForSelector('.library-card', { timeout: 30000 });
    await page.locator('[data-workspace-view="speech"]').click();
    assert.equal(await page.locator('[data-voice-select^="chatterbox:"]').count(), 10, 'All names are visible during initial verification');
    await page.waitForFunction(() => document.querySelectorAll('[data-voice-test^="chatterbox:"]').length === 10, {}, { timeout: 180000 });
    assert.equal(await page.locator('[name="provider"]').isVisible(), false);
    assert.equal(await page.locator('.speech-account').count(), 0);
    assert.equal(await page.locator('[data-voice-test^="offline:"]').count(), 2);
    for (const voice of require('../lib/chatterbox-voices.json')) {
        const row = page.locator(`[data-voice-uri="chatterbox:${voice.id}"]`);
        assert.match(await row.innerText(), new RegExp(voice.name));
        assert.equal(await row.locator('[data-voice-select]').isDisabled(), false);
    }
    await page.locator('[data-voice-select="chatterbox:d2-00919"]').click();
    assert.match(await page.locator('#speechAvailability').innerText(), /Mert/);
    await page.locator('[data-voice-select="chatterbox:d2-00331"]').click();
    assert.match(await page.locator('#speechAvailability').innerText(), /Ece/);
    await page.locator('[name="audience"]').selectOption('fanclub');
    assert.equal(await page.locator('#speechGift').isVisible(), false);
    assert.match(await page.locator('#audienceNote').innerText(), /Üyelik bilgisi bulunmayan/);
    await page.screenshot({ path: path.join(output, 'speech-library.png'), fullPage: true });
    const audio = await page.evaluate(() => window.mngAPI.workspace('speech-synthesize', {
        text: 'Merhaba, TikMnG ses denemesi.', voiceURI: 'chatterbox:d2-00331', provider: 'chatterbox', voicePreset: 'natural'
    }));
    assert.equal(audio.error, undefined, audio.error);
    assert.equal(audio.voice.voiceURI, 'chatterbox:d2-00331');
    const wav = Buffer.from(audio.audioBase64, 'base64');assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    fs.writeFileSync(path.join(output, 'ece.wav'), wav);
    const guides = await page.evaluate(async () => (await window.mngAPI.workspace('snapshot')).games.filter(game => game.giftGuide).length);
    assert.equal(guides, 8);
    const result = { passed: true, installedExecutable: true, naturalSpeakersReady: 10, fastSpeakersReady: 2,
        visibleEngineSelector: false, fanclubSelection: true, giftGuides: guides, actualWavBytes: wav.length,
        changedSavedAudience: false, stableReleasePublished: false };
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));console.log(JSON.stringify(result));
})().catch(error => { console.error(error);process.exitCode = 1; }).finally(async () => { await app?.close(); });
