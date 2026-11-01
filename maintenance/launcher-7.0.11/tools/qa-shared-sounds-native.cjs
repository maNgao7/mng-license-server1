'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = 'D:/TikMnG-QA-Delivery/shared-sounds-native';
const archive = 'D:/TikMnG-Viral-Sesler-2026-10-23';
const expected = JSON.parse(fs.readFileSync(path.join(archive, 'manifest.json'), 'utf8'));
let app;
const stableFields = items => items.map(({ id, giftId, gameId, title, category, trigger, startSeconds, endSeconds, volume, enabled }) =>
    ({ id, giftId, gameId, title, category, trigger, startSeconds, endSeconds, volume, enabled }));
async function main() {
    const env = { ...process.env };delete env.MNG_TEST_PROFILE;delete env.MNG_WIDGET_PORT;delete env.ELECTRON_RUN_AS_NODE;
    fs.mkdirSync(output, { recursive: true });
    app = await _electron.launch({ executablePath: 'D:/TikMnG-Test-6.5.17/win-unpacked/TikMnG Test.exe', env, args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await app.firstWindow();page.setDefaultTimeout(60000);
    await page.waitForSelector('.library-card', { state: 'attached' });
    assert.equal(await app.evaluate(({ app }) => app.getPath('userData')), 'C:\\Users\\User\\AppData\\Roaming\\TikMnG-Test-6.5.17');
    const call = (action, data) => page.evaluate(({ action, data }) => window.mngAPI.workspace(action, data), { action, data });
    const before = await call('snapshot');assert.equal(before.tts.names, false);
    const sounds = before.audioLibrary.filter(item => expected.some(entry => entry.title === item.title && entry.category === item.category));
    assert.equal(sounds.length, expected.length, 'Every imported sound must be visible on the currently selected account');
    assert.ok(sounds.every(item => !item.giftId && !item.gameId && item.libraryAsset));
    for (const item of sounds) {
        const response = await fetch(new URL(item.mediaUrl, before.overlayUrl));assert.equal(response.status, 200);
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expected.find(entry => entry.title === item.title).sha256);
    }
    await page.locator('[data-workspace-view="sounds"]').click();
    const playback = [];
    for (const category of ['Türkiye Viral', 'Dünya Viral']) {
        await page.locator('[data-media-category]').filter({ hasText: category }).click();
        assert.equal(await page.locator('#soundCatalog .asset-sound-row').count(), 24);
        const categoryCount=expected.filter(item=>item.category===category).length;
        assert.equal(await page.locator('#soundCatalogCount').innerText(), categoryCount + ' / ' + before.audioLibrary.length + ' ses');
        await page.locator('#soundCatalog [data-sound-preview]').first().click();
        const audio = page.frameLocator('.sound-preview-frame').locator('audio');
        await audio.waitFor({ state: 'attached' });
        assert.ok(await audio.evaluate(audio => new Promise(resolve => { const started=Date.now(),timer=setInterval(()=>{
            if(!audio.paused&&audio.currentTime>0&&audio.volume>0){clearInterval(timer);resolve(true);}
            else if(Date.now()-started>8000){clearInterval(timer);resolve(false);}
        },10); })), 'Audio in the separate-origin preview frame must play');
        assert.equal(await page.locator('#mediaEditor[open]').count(), 0, 'Listening must not open an action editor');
        playback.push(category);
        await page.screenshot({ path: path.join(output, category === 'Türkiye Viral' ? 'turkiye-desktop.png' : 'dunya-desktop.png') });
        await page.locator('[data-sound-page="1"]').click();assert.equal(await page.locator('#soundCatalog .asset-sound-row').count(), Math.min(24,categoryCount-24));
        await page.locator('[data-sound-page="0"]').click();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'sounds-mobile.png'), fullPage: true });
    assert.ok(await page.locator('#workspaceRoot').evaluate(root => root.scrollWidth <= innerWidth));
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.locator('#soundCatalog [data-library-asset]').first().click();
    await page.locator('#mediaEditor[open]').waitFor();
    const during = await call('snapshot'), added = during.media.filter(item => !before.media.some(old => old.id === item.id));
    assert.equal(added.length, 1);assert.equal(added[0].giftId, '');
    await page.locator('#mediaEditor [data-action="close-media"]').first().click();
    const after = await call('media-remove', { id: added[0].id });
    assert.deepEqual(stableFields(after.media), stableFields(before.media));
    assert.equal(after.audioLibrary.length, before.audioLibrary.length);
    await page.locator('[data-workspace-view="speech"]').click();
    assert.equal(await page.locator('#speechForm [name="names"]').count(), 0);
    assert.equal((await call('snapshot')).tts.names, false);
    const browserDecoded = [], failures = [];
    const decodeUrl=new URL(sounds[0].overlayUrl);decodeUrl.searchParams.set('hover','1');decodeUrl.searchParams.set('once','1');
    await page.evaluate(src=>{const frame=document.createElement('iframe');frame.id='nativeCatalogAudioCheck';frame.src=src;frame.allow='autoplay';frame.hidden=true;document.body.append(frame);},decodeUrl.href);
    const decodeFrame=page.frameLocator('#nativeCatalogAudioCheck');
    await decodeFrame.locator('body').waitFor({state:'attached'});
    await decodeFrame.locator('body').evaluate(body=>{body.querySelectorAll('audio').forEach(audio=>{audio.pause();audio.remove();});const audio=document.createElement('audio');audio.id='qaCatalogDecoder';body.append(audio);});
    for (const item of sounds) {
        fs.writeFileSync(path.join(output,'decode-progress.json'),JSON.stringify({current:item.title,played:browserDecoded.length,tested:sounds.length}));
        try {
            const state=await decodeFrame.locator('#qaCatalogDecoder').evaluate((audio,src)=>new Promise(resolve=>{
                audio.pause();audio.src=src;audio.load();audio.volume=.8;audio.play().catch(()=>{});
                const started=Date.now(),timer=setInterval(()=>{
                    if(audio.error||(!audio.paused&&audio.currentTime>0)||Date.now()-started>5000){clearInterval(timer);const state={played:!audio.paused&&audio.currentTime>0,error:audio.error?.code||null,duration:audio.duration};audio.pause();resolve(state);}
                },10);
            }),new URL(item.mediaUrl,before.overlayUrl).href);
            if(!state.played)failures.push({title:item.title,...state});else browserDecoded.push(item.title);
        } catch { failures.push({title:item.title,reason:'Audio frame or decode timeout'}); }
    }
    await page.locator('#nativeCatalogAudioCheck').evaluate(frame=>frame.remove());
    fs.writeFileSync(path.join(output,'browser-audio-decode.json'),JSON.stringify({passed:failures.length===0,tested:sounds.length,played:browserDecoded.length,failures},null,2));
    assert.equal(failures.length,0,'Every imported clip must actually play in the installed Electron renderer');
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: true, sharedSounds: sounds.length, exactHashResponses: sounds.length,
        currentAccountNotChanged: true, existingAssignmentsPreserved: true, librarySurvivesActionRemoval: true,
        audibleCategoryPreviews: playback, browserAudioDecodePassed:browserDecoded.length, noEditorOnListen: true, messageOnlyPreference: true, responsive: [1440, 390],
        realLiveGiftToGameNotTested: true, verifiedAt: new Date().toISOString() }, null, 2));
    console.log(`Installed preview: ${sounds.length} shared sounds verified; both previews play without opening editor; action create/remove preserves existing mappings; names disabled.`);
}
main().catch(async error => { console.error(error);try { const page = await app?.firstWindow();await page?.screenshot({ path: path.join(output, 'failure.png') });
    const frame = page?.frameLocator('.sound-preview-frame').locator('audio');console.log(await frame?.evaluate(audio => ({ paused: audio.paused, time: audio.currentTime, ready: audio.readyState, network: audio.networkState, error: audio.error?.code, duration: audio.duration, path: location.pathname }))); } catch {} process.exitCode = 1; }).finally(async () => { await app?.close(); });
