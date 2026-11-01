'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {_electron}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const Store=require('C:/Users/User/Desktop/MNG-TikTok-Game/launcher/node_modules/electron-store');
const profile=path.join(process.env.APPDATA,'TikMnG-Test-6.5.17');
const open=()=>new Store({cwd:profile,name:'mng-config',encryptionKey:'mng-electron-secret-key-2024'});
const before=open().store,background=before.media_background_enabled_v1;
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const licenses=data=>Object.fromEntries(Object.entries(data).filter(([k])=>/lisans|license|device/i.test(k)));
const ids=value=>(value||[]).map(x=>x.id).sort();
const output=path.resolve(__dirname,'../qa/20261030');let app;
async function main(){
    const record=JSON.parse(fs.readFileSync(path.join(output,'existing-manager-update.json')));
    fs.copyFileSync(path.join(profile,'mng-config.json'),path.join(record.backup,'mng-config.before-preview-qa.json'));
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.MNG_TEST_PROFILE;delete env.MNG_WIDGET_PORT;
    app=await _electron.launch({executablePath:record.manager,args:['--tikmng-preview'],env,timeout:60000});
    const page=await app.firstWindow();
    await page.waitForFunction(()=>window.mngAPI&&document.getElementById('workspaceRoot'),null,{timeout:60000});
    await page.evaluate(()=>mngAPI.workspace('media-background',{enabled:false}));
    const snapshot=await page.evaluate(()=>mngAPI.workspace('snapshot'));
    assert.equal(snapshot.version,'7.0.9-preview.20261030');assert.equal(snapshot.preview,true);
    assert.equal(snapshot.libraryRoot,before.library_root_v1);
    const info=await page.evaluate(()=>mngAPI.widgetBilgisi());assert.equal(info.studio.settings.pk.layout,'teams');
    await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
    await page.locator('[data-workspace-view="widgets"]').click();
    await page.locator('#workspaceWidgetSearch').fill('PK');
    await page.locator('[data-widget="pk"]').click();
    await page.locator('#widgetSettingsForm [name="layout"]').waitFor();
    assert.equal(await page.locator('#widgetSettingsForm [name="swapSides"]').count(),1);
    await page.screenshot({path:path.join(output,'existing-manager-pk-settings.png')});
    await page.evaluate(()=>window.widgetAyarPanelKapat());
    await page.locator('#workspaceWidgetSearch').fill('Racona');
    await page.locator('[data-widget="raconlist"]').click();
    assert.equal(await page.evaluate(()=>window.widgetGiftSummary('')),'<span>Hediye seçilmedi</span>');
    assert.match(await page.locator('.widget-ranking-heading').textContent(),/Kalıcı havuz/);
    assert.equal(await page.locator('[data-ranking-search]').count(),1);
    assert.match(await page.locator('#widgetStudioReset').textContent(),/Havuzu sıfırla/);
    assert.equal(typeof info.studio.raconRevision,'number');
    const frame=page.frameLocator('#widgetSettingsPreview');
    await frame.locator('#title').waitFor();
    await frame.locator('body').evaluate(()=>{
        clearTimeout(timer);disposed=true;
        paint({studio:{settings:{raconlist:{giftId:'7934'}},raconRanking:[
            {username:'qa_center',count:12,avatar:'/widget/gift-assets/logo-v3.png'},
            {username:'qa_right',count:9,avatar:'/widget/gift-assets/logo-v3.png'},
            {username:'qa_left',count:7,avatar:'/widget/gift-assets/logo-v3.png'},
            {username:'qa_list',count:4}
        ]}});
    });
    assert.equal(await frame.locator('.racon-chair').count(),3);
    assert.equal(await frame.locator('.racon-row .name').textContent(),'@qa_list');
    assert.equal(await frame.locator('.racon-row .avatar').count(),0);
    await frame.locator('.chair-art').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
    assert.equal(await frame.locator('.seat-1 .avatar').evaluate(n=>n.offsetWidth),152);
    const local=new URL(info.widgets.find(w=>w.id==='raconlist').url);
    const asset=new URL('/widget/gift-assets/racon-list-seat-v2.png',local.origin);asset.search=local.search;
    assert.equal((await fetch(asset)).status,200);asset.searchParams.delete('key');assert.equal((await fetch(asset)).status,403);
    await page.waitForTimeout(550);
    await page.screenshot({path:path.join(output,'existing-manager-racon-settings.png')});
    await app.close();app=null;
    const store=open();if(background===undefined)store.delete('media_background_enabled_v1');else store.set('media_background_enabled_v1',background);
    const after=open().store;
    assert.equal(digest(licenses(after)),digest(licenses(before)));
    assert.deepEqual(ids(after.media_studio_v1?.items),ids(before.media_studio_v1?.items));
    assert.deepEqual(ids(after.entry_videos_v1?.rules),ids(before.entry_videos_v1?.rules));
    assert.equal(after.library_root_v1,before.library_root_v1);
    const result={passed:true,existingManager:true,noSeparateApplication:true,version:snapshot.version,
        teamSettingsVisible:true,raconThreeSeatPodium:true,profileDiameter:152,lowerRowsUsernameOnly:true,newAssetAuthenticated:true,persistentPoolControls:true,originalMediaItems:before.media_studio_v1?.items?.length||0,
        originalEntryRules:before.entry_videos_v1?.rules?.length||0,licenseMediaEntriesAndLibraryPreserved:true};
    fs.writeFileSync(path.join(output,'existing-manager-pk-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{await app?.close();const store=open();if(background===undefined)store.delete('media_background_enabled_v1');else store.set('media_background_enabled_v1',background);});
