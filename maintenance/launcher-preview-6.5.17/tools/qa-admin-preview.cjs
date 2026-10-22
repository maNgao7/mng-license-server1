'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = 'D:/TikMnG-QA-Delivery/admin-preview';
let app;
(async () => {
    fs.mkdirSync(output, { recursive: true });
    const env = { ...process.env };delete env.ELECTRON_RUN_AS_NODE;delete env.MNG_TEST_PROFILE;
    app = await _electron.launch({ executablePath: process.env.MNG_QA_EXE || path.resolve(__dirname, '../dist-admin-preview/win-unpacked/TikMnG Test.exe'), env });
    app.process().on('exit', (code, signal) => console.log('Preview process exited:', code, signal || ''));
    const page = await app.firstWindow();
    page.on('crash', () => console.error('Preview renderer crashed'));
    await page.waitForSelector('.library-card', { timeout: 30000 });
    const guides = await page.evaluate(async () => (await window.mngAPI.workspace('snapshot')).games.filter(game => game.giftGuide).map(game => ({ id: game.id, ...game.giftGuide })));
    assert.equal(guides.length, 8);
    const guideOutput = path.join(output, 'gift-guides');fs.mkdirSync(guideOutput, { recursive: true });
    for (const guide of guides) {
        const target = path.join(guideOutput, guide.filename);
        await app.evaluate(({ dialog }, target) => { globalThis.qaSaveDialog = dialog.showSaveDialog;dialog.showSaveDialog = async () => ({ canceled: false, filePath: target });return true; }, target);
        try {
            const saved = await page.evaluate(id => window.mngAPI.workspace('gift-guide-save', { id }), guide.id);
            assert.equal(saved.saved, true, saved.error);
            assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(target)).digest('hex'), guide.sha256);
        } finally { await app.evaluate(({ dialog }) => { dialog.showSaveDialog = globalThis.qaSaveDialog;delete globalThis.qaSaveDialog;return true; }); }
    }
    if (process.env.MNG_QA_CHATTERBOX_ROOT) {
        await app.evaluate(({ dialog }, root) => {
            globalThis.qaOriginalOpenDialog = dialog.showOpenDialog;
            dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [root] });
            return true;
        }, path.resolve(process.env.MNG_QA_CHATTERBOX_ROOT));
        try {
            const selected = await page.evaluate(() => window.mngAPI.workspace('speech-local-select'));
            assert.equal(selected.error, undefined, selected.error);
            assert.equal(selected.providers.chatterbox?.speakers, 10);
            console.log('Natural Turkish pack verified:', selected.providers.chatterbox.speakers);
        } finally {
            await app.evaluate(({ dialog }) => { dialog.showOpenDialog = globalThis.qaOriginalOpenDialog;delete globalThis.qaOriginalOpenDialog;return true; });
        }
    }
    await page.evaluate(async () => {
        await window.mngAPI.tiktokHesapKaydet('mlbb_gossipgirl');
        await window.mngAPI.tiktokBaglan('mlbb_gossipgirl');
    });
    await page.waitForFunction(async () => (await window.mngAPI.workspace('snapshot')).media.length >= 159, {}, { timeout: 45000 });
    const count = await page.evaluate(async () => {
        const api = window.mngAPI;
        let status = await api.workspace('speech-status');
        if (status.error) throw Error(status.error);
        for (const pack of status.packs) {
            if (!pack.installed) {
                status = await api.workspace('speech-pack-install', { id: pack.id });
                if (status.error) throw Error(status.error);
            }
        }
        status = await api.workspace('speech-status', { refresh: true });
        const hashes = [];
        for (const voice of status.voices.filter(v => v.provider === 'offline')) {
            const audio = await api.workspace('speech-synthesize', { text: 'Merhaba, TikMnG çevrimdışı ses denemesi.', voiceURI: voice.voiceURI, provider: 'offline' });
            if (audio.error) throw Error(audio.error);
            if (atob(audio.audioBase64).slice(0, 4) !== 'RIFF') throw Error('WAV missing');
            hashes.push(audio.audioBase64.slice(0, 100) + audio.audioBase64.length);
        }
        return { voices: status.voices.length, installedOffline: status.packs.filter(p => p.installed).length, audioOutputs: hashes.length };
    });
    assert.equal(count.installedOffline, 2);assert.equal(count.audioOutputs, 2);
    const naturalAudio = [];
    const naturalVoices = await page.evaluate(async () => (await window.mngAPI.workspace('speech-status')).voices.filter(v => v.provider === 'chatterbox'));
    if (process.env.MNG_QA_CHATTERBOX_ROOT) assert.equal(naturalVoices.length, 10);
    for (const voice of naturalVoices) {
        const started = Date.now();
        const result = await page.evaluate(voice => window.mngAPI.workspace('speech-synthesize', {
            text: 'Merhaba, yayına hoş geldiniz.', voiceURI: voice.voiceURI, provider: 'chatterbox', voicePreset: 'natural', rate: 1
        }), voice);
        assert.equal(result.error, undefined, `${voice.name}: ${result.error}`);
        assert.equal(result.voice.voiceURI, voice.voiceURI);
        const audio = Buffer.from(result.audioBase64, 'base64');
        assert.equal(audio.toString('ascii', 0, 4), 'RIFF');
        fs.writeFileSync(path.join(output, 'voice-' + voice.id + '.wav'), audio);
        naturalAudio.push({ name: voice.name, voiceURI: voice.voiceURI, bytes: audio.length,
            sha256: require('node:crypto').createHash('sha256').update(audio).digest('hex'), elapsedMs: Date.now() - started });
        console.log('Natural voice verified:', voice.name, Date.now() - started, 'ms');
    }
    assert.equal(new Set(naturalAudio.map(audio => audio.sha256)).size, naturalVoices.length);
    await page.locator('[data-workspace-view="speech"]').click();
    await page.locator('[data-action="speech-refresh"]').click();
    await page.waitForFunction(expected => document.querySelectorAll('[data-voice-test]').length === expected, count.voices);
    assert.equal(await page.locator('[name="provider"]').isVisible(), false);
    assert.equal(await page.locator('.speech-account').count(), 0);
    assert.equal(await page.locator('[data-voice-test^="offline:"]').count(), 2);
    assert.equal(await page.locator('select[name="voicePreset"]').count(), 0);
    if (naturalVoices.length) {
        await page.locator('[data-voice-select="chatterbox:d2-00331"]').click();
        assert.equal(await page.locator('[name="voiceURI"] option:not([disabled])').count(), 10);
        assert.equal(await page.locator('[data-voice-test^="chatterbox:"]').count(), 10);
        await page.screenshot({ path: path.join(output, 'ten-natural-speakers.png'), fullPage: true });
    }
    await page.locator('[name="audience"]').selectOption('fanclub');
    assert.equal(await page.locator('#speechGift').isVisible(), false);
    await page.screenshot({ path: path.join(output, 'fanclub-filter.png'), fullPage: true });
    await page.locator('[name="audience"]').selectOption('gift');
    await page.locator('#speechGift').click();
    const coins = await page.locator('#giftChoices [data-coins]').evaluateAll(items => items.map(item => Number(item.dataset.coins)));
    assert.deepEqual(coins, [...coins].sort((a, b) => a - b));
    assert.equal(coins.length, 60);
    await page.locator('#giftSearch').fill('7934');
    await page.locator('[data-gift-choice="7934"]').click();
    assert.equal(await page.locator('#speechForm [name="giftId"]').inputValue(), '7934');
    await page.locator('[name="audience"]').selectOption('selected');
    await page.locator('[name="allowedUsers"]').fill('@mlbb_gossipgirl');
    await page.screenshot({ path: path.join(output, 'speech.png'), fullPage: true });
    await page.locator('[data-workspace-view="media"]').click();
    await page.waitForSelector('[data-media-id]', { timeout: 15000 });
    assert.equal(await page.locator('[data-media-id]').count(), 24);
    for (let index = 0; index < 4; index++) {
        const video = page.frameLocator('.media-thumb iframe').nth(index).locator('video');
        await video.waitFor({ timeout: 30000 });
        await video.evaluate(element => new Promise((resolve, reject) => {
            const check = () => { if (element.readyState >= 2 && element.videoWidth > 0) { clearInterval(timer);clearTimeout(timeout);resolve(); } };
            const timer = setInterval(check, 100), timeout = setTimeout(() => { clearInterval(timer);reject(Error('Poster did not decode: ' + element.readyState + '/' + element.error?.code)); }, 20000);
            check();
        }));
    }
    await page.screenshot({ path: path.join(output, 'media.png') });
    const firstTile = page.locator('[data-media-id]').first();
    await firstTile.hover();
    const hoverVideo = page.frameLocator('.media-thumb iframe').first().locator('video');
    await hoverVideo.waitFor({ timeout: 15000 });
    await hoverVideo.evaluate(video => new Promise((resolve, reject) => {
        const timer = setInterval(() => { if (!video.paused && !video.muted && video.currentTime > 0.3) { clearInterval(timer);clearTimeout(timeout);resolve(); } }, 100);
        const timeout = setTimeout(() => { clearInterval(timer);reject(Error('Audible hover did not play')); }, 15000);
    }));
    await page.locator('#mediaSearch').hover();
    const urls = await page.evaluate(async () => {
        const state = await window.mngAPI.workspace('snapshot');
        const widgets = await window.mngAPI.widgetBilgisi();
        return [state.overlayUrl, ...state.games.map(g => g.overlayUrl), ...state.media.map(m => m.overlayUrl), ...widgets.widgets.map(w => w.url)];
    });
    const checked = await app.evaluate(async ({ net }, urls) => {
        let count = 0;
        for (const url of urls) {
            const response = await net.fetch(url, { method: 'HEAD' });
            if (response.status !== 200) throw Error(new URL(url).pathname + ': ' + response.status);
            count++;
        }
        return count;
    }, urls);
    await page.waitForFunction(async () => (await window.mngAPI.workspace('snapshot')).overlayTransport?.ready === true, {}, { timeout: 45000 });
    const publicURLs = await page.evaluate(async () => {
        const state = await window.mngAPI.workspace('snapshot'), widgets = await window.mngAPI.widgetBilgisi();
        return [state.broadcastUrl, ...state.games.map(g => g.broadcastUrl), ...state.media.map(m => m.broadcastUrl), ...widgets.widgets.map(w => w.broadcastUrl)];
    });
    const publicChecked = await app.evaluate(async ({ net }, urls) => {
        let checked = 0;
        for (let start = 0; start < urls.length; start += 4) {
            await Promise.all(urls.slice(start, start + 4).map(async url => {
                if (!url?.startsWith('https://')) throw Error('Public HTTPS source missing');
                const response = await net.fetch(url, { method: 'HEAD' });
                if (response.status !== 200) throw Error('Public source HTTP ' + response.status);
                checked++;
            }));
        }
        return checked;
    }, publicURLs);
    await page.locator('[data-workspace-view="widgets"]').click();
    await page.locator('.workspace-widget iframe').first().waitFor();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(output, 'widgets.png') });
    const widgetURLs = await page.evaluate(async () => (await window.mngAPI.widgetBilgisi()).widgets.map(w => ({ id: w.id, url: w.previewUrl })));
    const pendingWindow = app.waitForEvent('window');
    await app.evaluate(({ BrowserWindow }) => { const win = new BrowserWindow({ width: 480, height: 620, show: true, webPreferences: { nodeIntegration: false, contextIsolation: true } });win.loadURL('about:blank'); });
    const widgetPage = await pendingWindow;
    for (const widget of widgetURLs) {
        const url = new URL(widget.url);url.searchParams.set('preview', '1');
        await widgetPage.goto(url.href);
        await widgetPage.waitForSelector('#stage > *');
        await widgetPage.waitForTimeout(300);
        await widgetPage.screenshot({ path: path.join(output, 'widget-' + widget.id + '.png') });
    }
    await widgetPage.close();
    const live = await page.evaluate(async () => { const info = await window.mngAPI.widgetBilgisi();return { status: info.liveStatus?.status, roomVerified: Boolean(info.liveStatus?.roomId) }; });
    const result = { passed: true, ...count, giftGuidesSaved: guides.length, naturalSpeakers: naturalVoices.length, naturalAudio, fanclubUI: true,
        localLinksChecked: checked, publicHttpsLinksChecked: publicChecked, widgetScreenshots: widgetURLs.length, live, liveStudioAcceptance: false };
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
})().catch(error => { console.error(error);process.exitCode = 1; }).finally(async () => { await app?.close(); });
