'use strict';
// Private-machine read-only acceptance. Never print account names or protected URLs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let application;
(async () => {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.MNG_TEST_PROFILE;
    application = await _electron.launch({ executablePath: 'D:/TikMnG-Test-6.5.17/win-unpacked/TikMnG Test.exe', env, timeout: 30000 });
    const page = await application.firstWindow();
    await page.waitForSelector('#launcher', { state: 'visible' });
    await page.waitForSelector('.library-card');
    const result = await page.evaluate(async () => {
        const api = window.mngAPI, snapshot = await api.workspace('snapshot');
        if (!snapshot.preview) throw new Error('Private preview required');
        const urls = [snapshot.overlayUrl, ...snapshot.games.map(g => g.overlayUrl), ...snapshot.media.map(m => m.overlayUrl)];
        if (!urls.every(raw => { const url = new URL(raw); return url.hostname === '127.0.0.1' && url.port === '31976'; })) throw new Error('Incompatible source hostname');
        const voices = await api.workspace('speech-status');
        if (voices.error) throw new Error('Speech catalog failed');
        const voice = voices.voices.find(v => v.provider === 'windows');
        if (!voice) throw new Error('Installed Turkish voice is unavailable');
        const styleHashes=[];
        for(const profile of voices.profiles){const audio=await api.workspace('speech-synthesize',{text:'Merhaba, TikMnG sesli yorum testi.',voiceURI:voice.voiceURI,voicePreset:profile.id,provider:'windows',rate:1});
            if(audio.error||audio.mimeType!=='audio/wav'||atob(audio.audioBase64).slice(0,4)!=='RIFF')throw new Error('Actual offline speech synthesis failed: '+profile.id);
            const raw=Uint8Array.from(atob(audio.audioBase64),char=>char.charCodeAt(0));const digest=await crypto.subtle.digest('SHA-256',raw);styleHashes.push([...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join(''));
        }
        if(new Set(styleHashes).size!==voices.profiles.length)throw new Error('Speech styles did not produce distinct audio');
        return { links: urls.length, media: snapshot.media.length, games: snapshot.games.length, localVoiceCount: voices.voices.filter(v => v.provider === 'windows').length,
            naturalVoicesConfigured: Boolean(voices.providers.azure?.configured), distinctWindowsStyles: new Set(styleHashes).size,
            speechStyles: voices.profiles.length, allStylesAvailable: voices.profiles.every(profile => profile.available) };
    });
    const urls = await page.evaluate(async () => { const snapshot = await window.mngAPI.workspace('snapshot'), widgets = await window.mngAPI.widgetBilgisi(); return [snapshot.overlayUrl, ...snapshot.games.map(g => g.overlayUrl), ...snapshot.media.map(m => m.overlayUrl), ...widgets.widgets.map(w => w.url)]; });
    const http = await application.evaluate(async ({ net }, urls) => {
        let passed = 0;
        for (const url of urls) { const response = await net.fetch(url, { method: 'HEAD' }); if (response.status !== 200) throw new Error('Source HTTP check: '+new URL(url).pathname+' returned '+response.status); passed++; }
        return passed;
    }, urls);
    assert.equal(http, urls.length);
    await page.locator('[data-open="vs"]').click();
    await page.locator('[data-action="media-library"]').click();
    assert.ok(await page.locator('#assetChoices [data-asset]').count() > 0);
    const tile = page.locator('#assetChoices [data-asset]').first();
    await tile.hover();
    const video = page.frameLocator('#assetChoices iframe').first().locator('video');
    await video.waitFor();
    await video.evaluate(video => new Promise((resolve, reject) => {
        const timer = setTimeout(() => { video.removeEventListener('timeupdate', check); reject(new Error('Actual catalog hover did not play')); }, 12000);
        function check() { if (!video.paused && video.muted && video.currentTime > 0.5) { clearTimeout(timer); video.removeEventListener('timeupdate', check); resolve(); } }
        video.addEventListener('timeupdate', check);check();
    })).catch(async error => {
        const details = await page.frameLocator('#assetChoices iframe').first().locator('body').evaluate(body => {
            const video = body.querySelector('video'); return { videoPresent: Boolean(video), paused: video?.paused, readyState: video?.readyState,
                error: video?.error?.code, time: video?.currentTime, duration: video?.duration, muted: video?.muted, width: video?.videoWidth,
                hover: new URL(location.href).searchParams.get('hover') === '1', poster: new URL(location.href).searchParams.get('poster') === '1' };
        });
        throw new Error(error.message+' '+JSON.stringify(details));
    });
    const output = 'D:/TikMnG-Launcher-Test-Raporu'; fs.mkdirSync(output, { recursive: true });
    const geometry=await tile.evaluate(tile=>{const poster=tile.querySelector('.asset-poster').getBoundingClientRect(),card=tile.getBoundingClientRect(),title=tile.querySelector('.asset-title').getBoundingClientRect();return{posterHeight:poster.height,posterWidth:poster.width,cardHeight:card.height,titleVisible:title.bottom<=card.bottom+1};});
    assert.ok(geometry.posterHeight>200);assert.ok(geometry.cardHeight>280);assert.equal(geometry.titleVisible,true);assert.ok(Math.abs(geometry.posterHeight/geometry.posterWidth-9/16)<0.01);
    await page.locator('#mediaAssetPicker').screenshot({ path: path.join(output, 'test-yeni-medya-katalogu.png') });
    await page.locator('[data-action="close-assets"]').click();
    await page.locator('[data-workspace-view="speech"]').click();
    await page.waitForFunction(() => !document.getElementById('speechAvailability').textContent.includes('kontrol ediliyor'));
    for (const style of ['natural','deep','male','female','warm','energetic','girl','boy','tiny','storybook']) {
        await page.locator('[name="voicePreset"]').selectOption(style);
        assert.equal(await page.locator('[data-action="speech-test"]').isDisabled(), false);
    }
    await page.locator('[name="voicePreset"]').selectOption('natural');
    await page.screenshot({ path: path.join(output, 'test-gercek-sesler.png') });
    await page.locator('[data-workspace-view="downloads"]').click();
    assert.ok(await page.locator('.installed-list article').count() > 0);
    console.log(JSON.stringify({ passed: true, ...result, httpSourceChecks: http, realHoverPlayback: true, missingVoiceCannotBeTested: true, installedGamesVisible: true, liveStudioAcceptance: false }));
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => { await application?.close(); });
