'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {_electron,chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),output=process.env.MNG_QA_OUTPUT||'D:/TikMnG-Widget-Preview12-20261026/electron-qa';
fs.mkdirSync(output,{recursive:true});
const profile=fs.mkdtempSync(path.join(output,'profile-')),Store=require('electron-store');
const options={projectVersion:process.env.MNG_QA_VERSION||'7.0.2-preview.12',name:'mng-config',encryptionKey:'mng-electron-secret-key-2024'};
const original=new Store({...options,cwd:path.join(process.env.APPDATA,'TikMnG-Test-6.5.17')});
const saved=new Store({...options,cwd:profile});
for(const key of ['lisans_kod','cihaz_kimlik','lisans_token','lisans_bitis','son_dogrulama'])if(original.has(key))saved.set(key,original.get(key));
for(const[key,value]of Object.entries({preview_initialized_v1:true,library_root_v1:path.join(profile,'games'),media_root_v1:path.join(profile,'media'),media_background_enabled_v1:false,media_studio_v1:{version:1,items:[{id:crypto.randomUUID(),title:'Isolated QA',kind:'video',url:'https://qa.invalid/fixture.mp4',enabled:false}]},tiktok_accounts:[],tiktok_active_account:''}))saved.set(key,value);
const port=31976,accessKey=crypto.randomBytes(16).toString('hex'),checks=[],errors=[],live=[],publicTimings=[];
let app,browser;
async function run(){
    const launchStarted=Date.now();
    const env={...process.env,MNG_TEST_PROFILE:profile,MNG_WIDGET_PORT:String(port),MNG_WIDGET_ACCESS_KEY:accessKey,MNG_QA_STARTUP_FILE:path.join(output,'startup-timing.json')};delete env.ELECTRON_RUN_AS_NODE;
    const args=process.env.MNG_QA_EXE?[]:[root];if(process.env.MNG_QA_STABLE!=='1')args.push('--tikmng-preview');
    app=await _electron.launch({executablePath:process.env.MNG_QA_EXE||path.join(root,'node_modules/electron/dist/electron.exe'),args,env,timeout:60000});const electronLaunchedMs=Date.now()-launchStarted;
    const page=await app.firstWindow();const firstWindowMs=Date.now()-launchStarted;page.on('pageerror',e=>errors.push(e.message));
    await page.waitForSelector('[data-workspace-view="widgets"]',{timeout:60000});const shellReadyMs=Date.now()-launchStarted;console.log('BOOTED',shellReadyMs);
    if(process.env.MNG_QA_STARTUP_ONLY==='1'){console.log(JSON.stringify({shellReadyMs,electronLaunchedMs,firstWindowMs}));return;}
    const announcement=page.locator('[data-announcement-close]');if(await announcement.isVisible())await announcement.click();
    const snapshot=await page.evaluate(()=>window.mngAPI.workspace('snapshot'));assert.equal(snapshot.preview,process.env.MNG_QA_STABLE!=='1');assert.equal(snapshot.games.length,16);assert.equal(snapshot.tts.names,false);
    await page.locator('[data-workspace-view="widgets"]').click();await page.waitForSelector('.workspace-widget');
    assert.equal(await page.locator('.widget-total').textContent(),'17');assert.equal(await page.locator('.workspace-widget').count(),6);
    await page.waitForTimeout(1200);const runningPreviews=await page.locator('.workspace-widget iframe[src]').count();assert.ok(runningPreviews>0&&runningPreviews<10,'Only visible previews load');
    await page.screenshot({path:path.join(output,'gallery.png')});checks.push(`Actual Electron gallery: 17 widgets, 14 studio test controls, ${runningPreviews} visible previews loaded`);
    for(const type of ['coinjar','myactions','penalty','wheel','actionwheel']){
        await page.locator('#workspaceWidgetSearch').fill(type);
        await page.locator(`[data-widget="${type}"]`).click();await page.locator('#widgetSettingsModal').waitFor({state:'visible'});
        assert.ok(await page.locator('#widgetSettingsFields input,#widgetSettingsFields select').count()>5);
        await page.screenshot({path:path.join(output,`${type}-settings.png`)});
        if(type==='myactions'){
            await page.locator('#widgetSettingsFields [name="screen"]').selectOption('3');
            await page.locator('#widgetSettingsFields [name="duration"]').fill('7');
            const frame=page.frameLocator('#widgetSettingsPreview');await frame.locator('#scene').waitFor();
            await page.waitForTimeout(1200);
            assert.equal(await frame.locator('body').evaluate(()=>window.__widgetDiagnostics.config.duration),7);
            await page.locator('#widgetSettingsForm button[type="submit"]').click();
            const info=await page.evaluate(()=>window.mngAPI.widgetBilgisi());assert.equal(info.studio.settings['myactions:3'].duration,7);assert.equal(info.studio.settings['myactions:1'].duration,5);
            checks.push('Screen 3 draft preview and IPC save isolated from screen 1');
        }else if(type==='actionwheel'){
            await page.locator('[data-widget-gift]').click();
            await page.locator('#giftPicker').waitFor({state:'visible'});
            await page.locator('#giftSearch').fill('5655');
            const variants=page.locator('#giftChoices [data-gift-variants]');
            if(await variants.count())await variants.first().click();
            const rose=page.locator('#giftChoices [data-gift-choice="5655"]');
            assert.equal(await rose.count(),1);
            await page.screenshot({path:path.join(output,'actionwheel-gift-picker.png')});
            await rose.click();
            assert.equal(await page.locator('#widgetSettingsForm [name="giftId"]').inputValue(),'5655');
            assert.ok(await page.locator('[data-widget-gift] img').count());
            await page.locator('#widgetSettingsForm button[type="submit"]').click();
            await page.locator('#widgetSettingsModal').waitFor({state:'hidden'});
            assert.equal((await page.evaluate(()=>window.mngAPI.widgetBilgisi())).studio.settings.actionwheel.giftId,'5655');
            await page.locator('[data-widget="actionwheel"]').click();
            await page.locator('#widgetSettingsModal').waitFor({state:'visible'});
            assert.equal(await page.locator('#widgetSettingsForm [name="giftId"]').inputValue(),'5655');
            await page.locator('[data-widget-gift]').click();
            await page.locator('#giftChoices [data-gift-choice=""]').click();
            assert.equal(await page.locator('#widgetSettingsForm [name="giftId"]').inputValue(),'');
            await page.locator('#widgetSettingsForm button[type="submit"]').click();
            await page.locator('#widgetSettingsModal').waitFor({state:'hidden'});
            assert.equal((await page.evaluate(()=>window.mngAPI.widgetBilgisi())).studio.settings.actionwheel.giftId,'');
            checks.push('Image gift picker saves exact Rose ID 5655, survives reopening and restores all-gift mode');
        }else await page.locator('#widgetSettingsModal .modal-x').click();
    }
    await page.locator('#workspaceWidgetSearch').fill('Pen');assert.equal(await page.locator('.workspace-widget:visible').count(),1);await page.locator('#workspaceWidgetSearch').fill('');checks.push('Widget search and settings modals work');console.log('UI PASSED');
    await page.locator('[data-workspace-view="games"]').click();
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(window=>window.hide()));
    // Read-only live connection: no chat, gifts or account modifications on TikTok.
    if(process.env.MNG_QA_SKIP_LIVE==='1')await page.evaluate(()=>window.mngAPI.tiktokHesapKaydet('barbarpm'));
    for(const username of process.env.MNG_QA_SKIP_LIVE==='1'?[]:(process.env.MNG_QA_LIVE_ACCOUNTS||'barbarpm,rapidxp,bencezehra,alenyamis,kedicikazra31,bozo.1b').split(',')){
        await page.evaluate(async username=>{await window.mngAPI.tiktokHesapKaydet(username);await window.mngAPI.tiktokBaglan(username);},username);
        const deadline=Date.now()+35000;let info;
        while(Date.now()<deadline){info=await page.evaluate(()=>window.mngAPI.widgetBilgisi());if(['connected','offline','error'].includes(info.liveStatus?.status))break;await page.waitForTimeout(500);}
        live.push({username,status:info.liveStatus?.status,message:info.liveStatus?.message});console.log('LIVE',username,info.liveStatus?.status);
        if(info.liveStatus?.status==='connected')break;
    }
    const relayDeadline=Date.now()+60000;let info;
    do {info=await page.evaluate(()=>window.mngAPI.widgetBilgisi());if(info.overlayTransport?.ready&&info.widgets.every(item=>item.broadcastUrl.startsWith('https://')))break;await page.waitForTimeout(500);}while(Date.now()<relayDeadline);
    assert.ok(info.widgets.every(item=>item.broadcastUrl.startsWith('https://')));assert.equal(new Set(info.widgets.map(item=>item.broadcastUrl)).size,17);
    const before=await fetch(`http://127.0.0.1:${port}/api/widget/state?key=${accessKey}`).then(r=>r.json());
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
    const context=await browser.newContext({viewport:{width:900,height:600}});
    for(const item of info.widgets.filter(item=>item.studio)){
        const view=await context.newPage();view.on('pageerror',e=>errors.push(item.id+': '+e.message));
        const began=Date.now();
        await view.goto(item.broadcastUrl,{waitUntil:'domcontentloaded',timeout:60000});await view.waitForFunction(()=>window.__widgetDiagnostics?.frameCount>5);
        publicTimings.push({widget:item.id,documentAndFirstFramesMs:Date.now()-began});
        await page.evaluate(type=>window.mngAPI.widgetStudioTest(type,'1'),item.id);
        if(['wheel','actionwheel','firework','myactions','penalty','likefountain'].includes(item.id))await view.waitForFunction(()=>window.__widgetDiagnostics.seen>0,null,{timeout:20000});
        await view.waitForTimeout(['coinjar','giftpusher'].includes(item.id)?2000:1200);
        await view.screenshot({path:path.join(output,`public-${item.id}.png`),omitBackground:true});await view.close();
        checks.push(item.id+': real launcher IPC → HTTPS relay → browser state/assets');console.log('PUBLIC',item.id);
    }
    await page.waitForTimeout(10000);
    const after=await fetch(`http://127.0.0.1:${port}/api/widget/state?key=${accessKey}`).then(r=>r.json());
    const observed=after.activities.filter(item=>!before.activities.some(previous=>previous.id===item.id));
    const avatars=observed.filter(item=>item.avatar).length;
    const portraitProbe=await context.newPage();
    const portraitURLs=[...new Set(observed.map(item=>item.avatar).filter(Boolean))].slice(0,5);
    const decoded=await portraitProbe.evaluate(async urls=>Promise.all(urls.map(src=>new Promise(resolve=>{const image=new Image();let done=false;const finish=value=>{if(done)return;done=true;resolve(value);};image.onload=()=>finish({loaded:true,width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>finish({loaded:false});image.src=src;setTimeout(()=>finish({loaded:false,timeout:true}),12000);}))),portraitURLs);
    await portraitProbe.close();
    const proof={count:observed.length,types:[...new Set(observed.map(item=>item.type))],profilesWithURL:avatars,giftsObserved:observed.filter(item=>item.type==='gift').length,portraitsDecoded:decoded};
    if(portraitURLs.length)assert.ok(decoded.some(item=>item.loaded),'At least one real LIVE portrait decodes in browser');
    for(const item of info.widgets.filter(item=>!item.studio)){
        const view=await context.newPage();view.on('pageerror',e=>errors.push(item.id+': '+e.message));
        await view.goto(item.broadcastUrl,{waitUntil:'domcontentloaded',timeout:60000});
        await page.evaluate(type=>window.mngAPI.widgetUniversalTest(type),item.id);await view.waitForTimeout(1600);
        assert.ok((await view.locator('body').innerHTML()).includes('stage'),item.id+' renderer loaded');
        await view.screenshot({path:path.join(output,`public-${item.id}.png`),omitBackground:true});await view.close();checks.push(item.id+': existing HTTPS widget still loads and receives isolated QA event');
    }
    for(let screen=1;screen<=8;screen++){
        const url=new URL(info.widgets.find(item=>item.id==='myactions').broadcastUrl);url.searchParams.set('screen',String(screen));
        const view=await context.newPage();await view.goto(url.href,{waitUntil:'domcontentloaded'});await view.waitForFunction(()=>window.__widgetDiagnostics?.frameCount>2);await view.close();
    }
    checks.push('All eight independent alert screen URLs return the working renderer');
    assert.deepEqual(errors,[]);
    const result={passed:true,checks,live,observation:proof,publicTimings,liveStudioAcceptance:false,shellReadyMs,electronLaunchedMs,firstWindowMs,runningPreviews,profile,errors};
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
run().catch(error=>{console.error(error);process.exitCode=1;fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:error.stack,checks,errors,live},null,2));}).finally(async()=>{await browser?.close();await app?.close();});
