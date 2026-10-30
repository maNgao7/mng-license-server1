'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {_electron}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const Store=require('C:/Users/User/Desktop/MNG-TikTok-Game/launcher/node_modules/electron-store');
const output=path.resolve(__dirname,'../qa/20261030'),profile=path.join(output,'packaged-qa-profile'),exe=process.env.MNG_PREVIEW_EXE||'D:/TikMnG-Update-QA-20261030/preview-build/win-unpacked/TikMnG Update Preview.exe';
const source=path.join(process.env.APPDATA,'TikMnG-Test-6.5.17/mng-config.json'),stable=path.join(process.env.APPDATA,'mng-tiktok-game/mng-config.json');
const hash=file=>fs.existsSync(file)?crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'):null;
const before=[hash(source),hash(stable)];let app;
const stableMode=process.env.MNG_QA_STABLE==='1',expectedVersion=process.env.MNG_QA_VERSION||'7.0.9-preview.20261030';
(async()=>{
    fs.mkdirSync(profile,{recursive:true});if(!fs.existsSync(path.join(profile,'mng-config.json')))fs.copyFileSync(source,path.join(profile,'mng-config.json'));
    const config=new Store({cwd:profile,name:'mng-config',encryptionKey:'mng-electron-secret-key-2024'});
    config.set('preview_initialized_v1',true);config.set('library_root_v1',path.join(profile,'games'));config.set('library_previous_paths_v1',{});
    config.set('media_root_v1',path.join(profile,'media'));config.set('entry_video_root_v1',path.join(profile,'entry-videos'));
    config.set('media_studio_v1',{version:1,items:[]});config.set('entry_videos_v1',{version:2,rules:[],sessions:{}});
    config.set('media_background_downloads_enabled',false);config.set('tiktok_active_account','');config.set('tiktok_accounts',[]);
    config.delete('widget_access_key');config.set('overlay_installation_v1',crypto.randomBytes(16).toString('hex'));
    const port=stableMode?31975:31976;
    await require('../lib/preview-ports.cjs').assertPreviewPortsAvailable([port]);
    // Exercise the shipped CSP's approved loopback port without weakening it for QA.
    const env={...process.env,MNG_TEST_PROFILE:profile,MNG_WIDGET_PORT:String(port),MNG_QA_STARTUP_FILE:path.join(output,'packaged-startup.json')};delete env.ELECTRON_RUN_AS_NODE;
    const start=Date.now();app=await _electron.launch({executablePath:exe,args:stableMode?[]:['--tikmng-preview'],env,timeout:60000});
    const page=await app.firstWindow();await page.waitForFunction(()=>window.mngAPI&&document.getElementById('workspaceRoot'),null,{timeout:60000});
    const snapshot=await page.evaluate(()=>mngAPI.workspace('snapshot')),info=await page.evaluate(()=>mngAPI.widgetBilgisi());
    assert.equal(snapshot.version,expectedVersion);assert.equal(snapshot.preview,!stableMode);assert.ok(info.widgets.find(w=>w.id==='raconlist'));assert.ok(info.widgets.find(w=>w.id==='pk'));
    for(const id of ['raconking','streambeauty','streamhandsome','raconlist']){
        const result=await page.evaluate(id=>mngAPI.widgetStudioKaydet(id,{giftId:'7934'}),id);assert.equal(result.basarili,true);
        await page.evaluate(id=>mngAPI.widgetStudioSifirla(id),id);
    }
    const local=new URL(info.widgets.find(w=>w.id==='raconlist').url),event=new URL('/api/widget/gift',local.origin);event.search=local.search;
    const sent=await fetch(event,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({eventId:crypto.randomUUID(),giftId:'7934',giftType:0,count:2,repeatCount:2,coins:2,username:'qa_viewer',nickname:'QA Viewer'})});assert.equal(sent.status,200);
    const stateUrl=new URL('/api/widget/state',local.origin);stateUrl.search=local.search;stateUrl.searchParams.delete('type');const state=await fetch(stateUrl).then(r=>r.json());
    for(const id of ['raconking','streambeauty','streamhandsome'])assert.equal(state.studio.royalLeaders[id].username,'qa_viewer');
    assert.equal(state.studio.raconRanking[0].count,2);
    for(const file of ['royal-racon.png','racon-list-seat-v2.png','logo-v3.png','7934.png']){const asset=new URL('/widget/gift-assets/'+file,local.origin);asset.search=local.search;assert.equal((await fetch(asset)).status,200);asset.searchParams.delete('key');assert.equal((await fetch(asset)).status,403);}
    const sendGift=async(username,count)=>{
        const response=await fetch(event,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({eventId:crypto.randomUUID(),giftId:'7934',giftType:0,count,repeatCount:count,coins:count,username,nickname:username})});assert.equal(response.status,200);
    };
    await sendGift('qa_viewer',2);await sendGift('qa_remove',1);
    await page.evaluate(()=>widgetAyarlariDogrudanAc('raconlist'));
    const row=page.locator('[data-ranking-row]').filter({has:page.locator('[data-ranking-user][value="qa_viewer"]')});
    assert.equal(await row.locator('[data-ranking-count]').inputValue(),'4');
    await row.locator('[data-ranking-step="1"]').click();assert.equal(await row.locator('[data-ranking-count]').inputValue(),'5');
    await row.locator('[data-ranking-step="-1"]').click();assert.equal(await row.locator('[data-ranking-count]').inputValue(),'4');
    await row.locator('[data-ranking-count]').fill('3');
    await page.locator('[data-ranking-row]').filter({has:page.locator('[data-ranking-user][value="qa_remove"]')}).locator('[data-ranking-remove]').click();
    await sendGift('qa_viewer',2);await sendGift('qa_new',3);
    await page.locator('#widgetSettingsForm [type="submit"]').click();await page.locator('#widgetSettingsModal').waitFor({state:'hidden'});
    const edited=await fetch(stateUrl).then(r=>r.json());
    assert.deepEqual(edited.studio.raconRanking.map(r=>[r.username,r.count]),[['qa_viewer',5],['qa_new',3]]);
    await page.evaluate(()=>widgetAyarlariDogrudanAc('raconlist'));
    await page.locator('[data-ranking-search]').fill('qa_new');
    assert.equal(await page.locator('[data-ranking-row]:visible').count(),1);
    await page.locator('[data-ranking-search]').fill('');
    try{await page.frameLocator('#widgetSettingsPreview').locator('.racon-chair').first().waitFor({timeout:20000});}
    catch(error){console.error('IFRAME_SRC',await page.locator('#widgetSettingsPreview').evaluate(n=>n.src.replace(/key=[^&]+/,'key=redacted')));for(const frame of page.frames())if(frame!==page.mainFrame())console.error('FRAME_DIAGNOSTIC',await frame.evaluate(()=>({url:location.href.replace(/key=[^&]+/,'key=redacted'),body:document.body.innerText.slice(0,500),paint:typeof paint,last:typeof last==='undefined'?null:last?.studio?.raconRanking,draft:typeof draft==='undefined'?null:draft})).catch(e=>e.message));throw error;}
    assert.equal(await page.frameLocator('#widgetSettingsPreview').locator('.racon-chair').count(),2);
    await page.frameLocator('#widgetSettingsPreview').locator('.chair-art').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
    await page.waitForTimeout(550);
    await page.screenshot({path:path.join(output,'racon-persistent-pool-settings.png')});
    await page.evaluate(()=>widgetAyarPanelKapat());
    const saved=await page.evaluate(()=>mngAPI.workspace('tts',{enabled:false,audience:'fanclub',prefixEnabled:true,messagePrefix:'.',profanityFilter:true}));assert.equal(saved.tts.messagePrefix,'.');assert.equal(saved.tts.audience,'fanclub');
    let updateDialog;
    if(stableMode){
        const notes=fs.readFileSync(path.resolve(__dirname,'../RELEASE-NOTES-7.0.9.md'),'utf8');
        const information=await app.evaluate(async(_electron,notes)=>{
            const updater=new(process.mainModule.require('node:events').EventEmitter)();
            updater.setFeedURL=()=>{};
            updater.checkForUpdates=async()=>({updateInfo:{version:'7.0.9',releaseNotes:notes}});
            return process.mainModule.require('./lib/app-updates.cjs').createAppUpdates({
                app:{isPackaged:true,getVersion:()=>'7.0.8'},notify(){},loadUpdater:()=>updater,record(){}
            }).check();
        },notes);
        assert.ok(information.changelog.join(' ').includes('Racon Listesi'));
        assert.ok(information.changelog.join(' ').includes('WhatsApp'));
        await page.evaluate(value=>updateModalAc(value),information);
        await page.screenshot({path:path.join(output,'release709-turkish-notes.png')});
        await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('guncelleme-indir-ve-kur');ipcMain.handle('guncelleme-indir-ve-kur',async()=>({basarili:true,qaOnly:true}));});
        await page.evaluate(()=>guncellemeBaslat());
        await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('guncelleme-ilerleme',{percent:9.123456789,transferredMB:'10.5',totalMB:'144.2',mesaj:'QA'}));
        await page.waitForFunction(()=>document.getElementById('updatePercent').textContent==='%9,1');
        updateDialog={turkishNotesItems:information.changelog.length,allFeatureSectionsRetained:true,roundedProgress:'%9,1',installerLaunched:false};
    }
    assert.deepEqual([hash(source),hash(stable)],before,'existing profiles must remain byte-identical');
    await app.close();app=null;
    app=await _electron.launch({executablePath:exe,args:stableMode?[]:['--tikmng-preview'],env,timeout:60000});
    const reopened=await app.firstWindow();await reopened.waitForFunction(()=>window.mngAPI&&document.getElementById('workspaceRoot'),null,{timeout:60000});
    const persisted=await reopened.evaluate(()=>mngAPI.widgetBilgisi());
    assert.deepEqual(persisted.studio.raconRanking.map(r=>[r.username,r.count]),[['qa_viewer',5],['qa_new',3]]);
    const report={passed:true,version:snapshot.version,packaged:true,elapsedQaMs:Date.now()-start,newWidgetsRegistered:true,royalGiftRouting:true,raconCount:2,authenticatedAssets:true,speechSettingsSaved:true,raconPool:{incrementDecrement:true,remove:true,search:true,concurrentGiftsPreserved:true,persistedAfterAppRestart:true},stableAndManagerProfilesUntouched:true,...(updateDialog?{updateDialog}:{})};
    fs.writeFileSync(path.join(output,stableMode?'packaged-stable-report.json':'packaged-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(async()=>{await app?.close();});
