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
        const installed = voices.voices.filter(v => ['windows','offline'].includes(v.provider));
        if (!installed.length) throw new Error('Installed Turkish voice is unavailable');
        const available = voices.voices.filter(v => installed.includes(v) || voices.providers[v.provider]?.available);
        if(new Set(available.map(v=>v.voiceURI)).size!==available.length)throw new Error('Duplicate speaker identities in speech catalog');
        const testedSpeakers=[];
        for(const voice of available){
            const audio=await api.workspace('speech-synthesize',{text:'Merhaba, TikMnG sesli yorum testi.',voiceURI:voice.voiceURI,voicePreset:'natural',provider:voice.provider,rate:1});
            if(audio.error||audio.mimeType!=='audio/wav'||atob(audio.audioBase64).slice(0,4)!=='RIFF')throw new Error('Actual speaker synthesis failed');
            if(audio.voice?.voiceURI!==voice.voiceURI||audio.fallbackUsed)throw new Error('Selected speaker was replaced during synthesis');
            testedSpeakers.push({voiceURI:voice.voiceURI,provider:voice.provider,voicePreset:'natural'});
        }
        return { links: urls.length, media: snapshot.media.length, games: snapshot.games.length, localVoiceCount: voices.voices.filter(v => v.provider === 'windows').length,
            naturalVoicesConfigured: Boolean(voices.providers.azure?.configured), testedSpeakers,
            actualSpeakerCount: testedSpeakers.length, multipleActualSpeakers: testedSpeakers.length>1 };
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
        function check() { if (!video.paused && !video.muted && video.volume > 0 && video.currentTime > 0.5) { clearTimeout(timer); video.removeEventListener('timeupdate', check); resolve(); } }
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
    await page.locator('#assetSearch').hover();
    await page.waitForFunction(()=>{const frame=document.querySelector('#assetChoices iframe'),video=frame.contentDocument?.querySelector('video');return new URL(frame.src).searchParams.get('poster')==='1'&&video?.paused&&video.muted;});
    await page.locator('[data-action="close-assets"]').click();
    await page.locator('[data-workspace-view="speech"]').click();
    await page.waitForFunction(() => !document.getElementById('speechAvailability').textContent.includes('kontrol ediliyor'));
    assert.equal(await page.locator('#speechForm select[name="voicePreset"]').count(),0);
    assert.equal(await page.locator('#speechForm input[type="hidden"][name="voicePreset"]').inputValue(),'natural');
    assert.equal(await page.locator('#speechForm [name="voiceURI"] option[value="girl"]').count(),0);
    for (const voice of result.testedSpeakers) {
        await page.locator('[name="provider"]').selectOption(voice.provider);
        await page.locator('[name="voiceURI"]').selectOption(voice.voiceURI);
        assert.equal(await page.locator('[data-action="speech-test"]').isDisabled(), false);
    }
    await page.locator('[name="audience"]').selectOption('gift');
    assert.equal(await page.locator('#speechForm select[name="giftId"]').count(),0);
    await page.locator('#speechGift').click();await page.locator('#giftPicker[open]').waitFor();
    const giftCoins=await page.locator('#giftChoices [data-coins]').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.coins)));
    assert.ok(giftCoins.length>0&&giftCoins.length<=60);
    assert.deepEqual(giftCoins,[...giftCoins].sort((a,b)=>a-b));
    assert.equal(await page.locator('#giftChoices [data-coins] img').count(),giftCoins.length);
    await page.locator('#giftSearch').fill('7934');await page.locator('[data-gift-choice="7934"]').click();
    assert.equal(await page.locator('#speechForm [name="giftId"]').inputValue(),'7934');
    await page.screenshot({ path: path.join(output, 'test-gercek-sesler.png') });
    await page.locator('[data-workspace-view="downloads"]').click();
    assert.ok(await page.locator('.installed-list article').count() > 0);
    console.log(JSON.stringify({ passed: true, ...result, httpSourceChecks: http, audibleHoverPlayback: true, hoverStopsOnLeave:true, noFakeStyleDropdown:true, visualSpeechGiftPicker:true, selectedSpeechGiftId:'7934', installedGamesVisible: true, liveStudioAcceptance: false }));
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => { await application?.close(); });
