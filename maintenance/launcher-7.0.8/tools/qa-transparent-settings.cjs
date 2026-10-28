'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output='D:/TikMnG-Widget-Transparent-20261027/packaged';let app;
async function run(){
    fs.mkdirSync(output,{recursive:true});const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.MNG_TEST_PROFILE;
    app=await _electron.launch({executablePath:'D:/TikMnG-Manager-7.0.0/win-unpacked/TikMnG.exe',args:['--tikmng-preview'],env,timeout:60000});
    const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.waitForFunction(()=>window.mngAPI&&document.querySelector('#workspaceRoot'),null,{timeout:60000});
    const before=await page.evaluate(()=>window.mngAPI.workspace('snapshot'));
    await page.evaluate(()=>widgetAyarlariDogrudanAc('topgift'));
    await page.locator('#widgetWingGallery button').first().waitFor();
    assert.equal(await page.locator('#widgetWingGallery button').count(),6);
    const frame=page.frameLocator('#widgetSettingsPreview');
    for(let tier=0;tier<6;tier++){
        await frame.locator('.champion').waitFor();
        await page.locator('[data-wing-preview="'+tier+'"]').click();
        await frame.locator('.champion[data-tier="'+tier+'"]').waitFor();
        assert.equal(await page.locator('[data-wing-preview="'+tier+'"]').getAttribute('aria-pressed'),'true');
    }
    await page.locator('#widgetSettingsForm [name="wingTier3"]').fill('1200');
    await page.locator('[data-wing-preview="3"]').click();
    await frame.locator('.champion-badge b').filter({hasText:'1.200 coin'}).waitFor();
    const missing=await page.locator('#widgetWingGallery img').evaluateAll(imgs=>imgs.filter(img=>!img.complete||!img.naturalWidth).map(img=>img.src));assert.deepEqual(missing,[]);
    await page.waitForTimeout(1000);
    const wingPreview=await frame.locator('body').evaluate(()=>({background:getComputedStyle(document.body).backgroundColor,diagnostics:window.__widgetDiagnostics}));
    assert.equal(wingPreview.background,'rgba(0, 0, 0, 0)');
    await page.screenshot({path:path.join(output,'wing-settings.png')});
    await page.evaluate(()=>widgetAyarPanelKapat());
    await page.evaluate(()=>widgetAyarlariDogrudanAc('topgifter'));
    await page.frameLocator('#widgetSettingsPreview').locator('.rank-amount').first().waitFor();
    await page.screenshot({path:path.join(output,'coin-settings.png')});
    await page.evaluate(()=>widgetAyarPanelKapat());
    await page.evaluate(()=>widgetAyarlariDogrudanAc('coinjar'));
    await page.waitForTimeout(10000);
    const jarPreview=await page.frameLocator('#widgetSettingsPreview').locator('body').evaluate(()=>({background:getComputedStyle(document.body).backgroundColor,diagnostics:window.__widgetDiagnostics}));
    assert.equal(jarPreview.background,'rgba(0, 0, 0, 0)');
    await page.screenshot({path:path.join(output,'jar-settings.png')});
    await page.evaluate(()=>widgetAyarPanelKapat());
    const after=await page.evaluate(()=>window.mngAPI.workspace('snapshot'));
    assert.deepEqual(before.games.map(g=>({id:g.id,path:g.path,version:g.installedVersion})),after.games.map(g=>({id:g.id,path:g.path,version:g.installedVersion})));
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,version:after.version,sixFrameChoices:true,customThresholdLivePreview:true,allThumbnailsDecoded:true,gamePointersUnchanged:true,draftsNotSaved:true,wingPreview,jarPreview,errors},null,2));
    console.log(JSON.stringify({passed:true,version:after.version,settingsFrameGallery:6,errors}));
}
run().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{await app?.close();});
