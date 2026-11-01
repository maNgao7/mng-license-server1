'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const runtime='C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {_electron,chromium}=require(path.join(runtime,'playwright'));
const Store=require('C:/Users/User/Desktop/MNG-TikTok-Game/launcher/node_modules/electron-store');
const root='D:/TikMnG-Release-7.0.8-ready',profile=path.join(root,'royal-profile'),output=path.join(root,'qa/royal');
const executable=path.join(root,'win-unpacked/TikMnG.exe');
const stable='C:/Users/User/AppData/Local/Programs/mng-tiktok-game/resources/app.asar';
const adminProfile=path.join(process.env.APPDATA,'TikMnG-Test-6.5.17/mng-config.json');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ids=['raconking','streambeauty','streamhandsome'];
const runId=crypto.randomBytes(8).toString('hex');
let app,browser,page;
async function main(){
    fs.mkdirSync(profile,{recursive:true});fs.mkdirSync(output,{recursive:true});
    if(!fs.existsSync(path.join(profile,'mng-config.json')))fs.copyFileSync(adminProfile,path.join(profile,'mng-config.json'));
    const saved=new Store({cwd:profile,name:'mng-config',projectVersion:'7.0.8',encryptionKey:'mng-electron-secret-key-2024'});
    saved.set('library_root_v1',path.join(profile,'games'));saved.set('library_previous_paths_v1',{});
    saved.set('media_root_v1',path.join(profile,'media'));saved.set('media_studio_v1',{version:1,items:[]});saved.set('media_background_downloads_enabled',false);
    saved.set('tiktok_active_account','royalqa');saved.set('tiktok_accounts',['royalqa']);
    saved.set('overlay_installation_v1',crypto.randomBytes(16).toString('hex'));
    saved.set('widget_studio_v1__royalqa',{settings:{},scores:{},resets:{},designVersion:3});
    saved.delete('widget_announcements_v1');
    const stableBefore=hash(stable),adminBefore=hash(adminProfile);
    const errors=[];
    async function launch(){
        const env={...process.env,MNG_TEST_PROFILE:profile,MNG_WIDGET_PORT:'31976'};delete env.ELECTRON_RUN_AS_NODE;
        app=await _electron.launch({executablePath:executable,env,timeout:60000});
        page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));
        await page.waitForFunction(()=>window.mngAPI&&document.getElementById('workspaceRoot'),null,{timeout:60000});
        return page.evaluate(()=>window.mngAPI.widgetBilgisi());
    }
    let info=await launch();assert.equal(info.widgets.length,20);
    for(const id of ids)assert.ok(info.widgets.find(widget=>widget.id===id&&widget.studio));
    const snapshot=await page.evaluate(()=>window.mngAPI.workspace('snapshot'));
    assert.equal(snapshot.version,'7.0.8');assert.equal(snapshot.preview,false);assert.equal(snapshot.games.length,15);assert.equal(snapshot.widgetAnnouncements.length,1);
    // Existing validated profile is used only in an isolated QA directory.
    await page.locator('#launcher').waitFor({state:'visible',timeout:60000});
    await page.locator('[data-announcement-widgets]').waitFor({state:'visible',timeout:30000});
    await page.screenshot({path:path.join(output,'new-widgets-announcement.png')});
    await page.locator('[data-announcement-widgets]').click();
    await page.locator('[data-widget="raconking"]').waitFor();
    for(const id of ids){
        const card=page.locator('[data-widget-card]').filter({has:page.locator(`[data-widget="${id}"]`)});
        await card.locator('iframe').scrollIntoViewIfNeeded();
        await card.frameLocator('iframe').locator('.portrait-window:not([hidden])').waitFor({timeout:20000});
        await card.frameLocator('iframe').locator('.art').first().evaluate(image=>image.decode());
    }
    await page.screenshot({path:path.join(output,'admin-widget-gallery.png')});
    const url=new URL(info.widgets.find(widget=>widget.id==='raconking').url);
    const api=route=>{const target=new URL(route,url.origin);target.search=url.search;return target;};
    const state=async()=>{const response=await fetch(api('/api/widget/state'));assert.equal(response.status,200);return response.json();};
    const inject=async(id,giftId)=>{
        const response=await fetch(api('/api/widget/gift'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:runId+':'+id+':'+giftId,username:id,nickname:id,avatar:'https://royal-qa.invalid/avatar.png',giftId,giftName:'QA gift',coins:1,count:1})});
        assert.equal(response.status,200);
    };
    assert.deepEqual((await state()).studio.royalLeaders,{});
    browser=await chromium.launch({channel:'chrome',headless:true});
    const context=await browser.newContext({viewport:{width:900,height:900}});
    await context.route('https://royal-qa.invalid/avatar.png',route=>route.fulfill({contentType:'image/png',body:fs.readFileSync(path.resolve(__dirname,'../renderer/widgets/royal-assets/royal-demo.png'))}));
    const viral=await context.newPage();
    const viralUrl=new URL(info.widgets.find(item=>item.id==='topgift').url);viralUrl.searchParams.set('preview','1');
    await viral.goto(viralUrl.href);await viral.locator('.champion').waitFor();
    for(const tier of [0,1,2,3,4,5]){
        await viral.evaluate(tier=>window.postMessage({type:'tikmng-widget-wing-preview',tier},location.origin),tier);
        await viral.locator(`.champion[data-tier="${tier}"]`).waitFor();
        await viral.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.champion')).opacity)>.99);
        await viral.locator('.champion-frame').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
        await viral.locator('.champion-gift-face .gift-icon').evaluate(image=>image.decode());
        await viral.locator('.champion-flip').evaluate(flip=>{for(const animation of flip.getAnimations()){animation.pause();animation.currentTime=6000;}});
        const geometry=await viral.evaluate(()=>{
            const photo=document.querySelector('.champion-photo').getBoundingClientRect(),gift=document.querySelector('.champion-gift-face .gift-icon').getBoundingClientRect();
            return {headingSize:parseFloat(getComputedStyle(document.querySelector('.champion-heading')).fontSize),dx:Math.abs(photo.x+photo.width/2-gift.x-gift.width/2),dy:Math.abs(photo.y+photo.height/2-gift.y-gift.height/2),fits:gift.width<=photo.width&&gift.height<=photo.height};
        });
        assert.ok(geometry.headingSize>=36);assert.ok(geometry.dx<1&&geometry.dy<1&&geometry.fits,JSON.stringify(geometry));
        if(tier===3)await viral.screenshot({path:path.join(output,'viral-title-and-gift-centered.png'),omitBackground:true});
    }
    await viral.close();
    const surfaces=[];
    for(const id of ids){
        const widget=info.widgets.find(widget=>widget.id===id),surface=await context.newPage();
        surface.on('pageerror',error=>errors.push(error.message));
        await surface.goto(widget.url+'&studio=1');
        await surface.waitForFunction(()=>[...document.querySelectorAll('.art')].every(image=>image.complete&&image.naturalWidth));
        assert.equal(await surface.locator('.portrait-window').isVisible(),false,'Broadcast URLs must never show demo profiles');
        assert.equal(await surface.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
        await surface.screenshot({path:path.join(output,id+'-empty.png'),omitBackground:true});
        surfaces.push({id,surface,widget});
    }
    await page.evaluate(()=>window.mngAPI.widgetStudioTest('raconking'));
    assert.deepEqual((await state()).studio.royalLeaders,{});
    await inject('first-king','6427');await inject('beauty','5655');await inject('handsome','5282');
    const before=(await state()).studio.royalLeaders;
    assert.equal(Object.keys(before).length,3);
    await inject('ignored','999999');assert.deepEqual((await state()).studio.royalLeaders,before);
    await inject('new-king','6427');
    assert.equal((await state()).studio.royalLeaders.raconking.username,'new-king');
    assert.equal((await state()).studio.royalLeaders.streambeauty.username,'beauty');
    for(const {id,surface}of surfaces){
        await surface.locator('.avatar-photo').waitFor({state:'visible',timeout:15000});
        await surface.locator('.avatar-photo').evaluate(image=>image.decode());
        await surface.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.portrait')).opacity)>.99);
        await surface.screenshot({path:path.join(output,id+'-real-event.png'),omitBackground:true});
        const noKey=new URL(surface.url());noKey.searchParams.delete('key');
        assert.equal((await fetch(noKey)).status,403);
        const other=new URL(surface.url());other.searchParams.set('channel','otherqa');
        const otherPage=await context.newPage();await otherPage.goto(other.href);await otherPage.waitForTimeout(1500);
        assert.equal(await otherPage.locator('.portrait-window').isVisible(),false);await otherPage.close();
    }
    for(let attempt=0;attempt<30;attempt++){
        info=await page.evaluate(()=>window.mngAPI.widgetBilgisi());
        if(info.overlayTransport?.ready)break;
        await new Promise(resolve=>setTimeout(resolve,1000));
    }
    assert.equal(info.overlayTransport?.ready,true,'The existing HTTPS relay must be ready');
    const broadcastLinks=new Set();
    for(const id of ids){
        const link=info.widgets.find(item=>item.id===id).broadcastUrl;
        assert.equal(new URL(link).protocol,'https:');broadcastLinks.add(link);
        const remote=await context.newPage();
        const response=await remote.goto(link,{timeout:60000});assert.equal(response.status(),200);
        await remote.locator('.art').first().evaluate(image=>image.decode());
        await remote.locator('.avatar-photo').waitFor({state:'visible',timeout:30000});
        await remote.locator('.avatar-photo').evaluate(image=>image.decode());
        await remote.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.portrait')).opacity)>.99);
        assert.equal(await remote.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
        await remote.screenshot({path:path.join(output,id+'-https.png'),omitBackground:true});
        await remote.close();
    }
    assert.equal(broadcastLinks.size,3);
    await Promise.all(surfaces.map(async({id,surface})=>{
        const username={raconking:'new-king',streambeauty:'beauty',streamhandsome:'handsome'}[id];
        await surface.waitForFunction(name=>document.querySelector('.title').getAttribute('aria-label')==='@'+name,username,{timeout:15000});
        await surface.waitForFunction(()=>[...document.querySelectorAll('.letter')].every(letter=>letter.getAnimations().every(animation=>animation.playState==='finished')));
        assert.equal(await surface.locator('.title').evaluate(title=>{const text=title.getBoundingClientRect(),well=document.querySelector('.title-well').getBoundingClientRect();return text.top>=well.top&&text.bottom<=well.bottom&&Math.abs((text.left+text.right-well.left-well.right)/2)<1;}),true);
        await surface.screenshot({path:path.join(output,id+'-short-username-fit.png'),omitBackground:true});
    }));
    const longUsername='yayincinin_uzun_kullanici_adi';
    for(const giftId of ['6427','5655','5282'])await inject(longUsername,giftId);
    await Promise.all(surfaces.map(async({id,surface})=>{
        await surface.waitForFunction(name=>document.querySelector('.title').getAttribute('aria-label')==='@'+name,longUsername,{timeout:15000});
        await surface.waitForFunction(()=>[...document.querySelectorAll('.letter')].every(letter=>letter.getAnimations().every(animation=>animation.playState==='finished')));
        assert.equal(await surface.locator('.title').evaluate(title=>title.getBoundingClientRect().width<=document.querySelector('.title-well').getBoundingClientRect().width+1),true);
        assert.equal(await surface.locator('.title').evaluate(title=>{const text=title.getBoundingClientRect(),well=document.querySelector('.title-well').getBoundingClientRect();return text.top>=well.top&&text.bottom<=well.bottom&&Math.abs((text.left+text.right-well.left-well.right)/2)<1;}),true);
        await surface.screenshot({path:path.join(output,id+'-username-fit.png'),omitBackground:true});
        await surface.waitForFunction(()=>!document.querySelector('.title').getAttribute('aria-label').startsWith('@'),null,{timeout:15000});
    }));
    await browser.close();browser=null;
    const r=await page.evaluate(()=>window.mngAPI.widgetStudioKaydet('raconking',{giftId:'5655',titleAnimation:true,lighting:true}));assert.equal(r.basarili,true);
    assert.equal((await state()).studio.royalLeaders.raconking,undefined);
    await inject('new-selected','5655');
    const current=(await state()).studio.royalLeaders;
    assert.equal(current.raconking.username,'new-selected');assert.equal(current.streambeauty.username,'new-selected');
    // Exercise the existing settings UI and its gift picker on the packaged application.
    await page.locator('[data-widget="raconking"]').click();
    await page.locator('#widgetSettingsModal').waitFor({state:'visible'});
    assert.equal(await page.locator('#widgetSettingsFields [name="giftId"]').inputValue(),'5655');
    await page.frameLocator('#widgetSettingsPreview').locator('.portrait-window:not([hidden])').waitFor({timeout:20000});
    await page.frameLocator('#widgetSettingsPreview').locator('.art').first().evaluate(image=>image.decode());
    await page.frameLocator('#widgetSettingsPreview').locator('body').evaluate(()=>{
        window.qaMessages=[];addEventListener('message',event=>qaMessages.push({origin:event.origin,parent:event.source===parent,type:event.data?.type,lighting:event.data?.settings?.lighting}));
    });
    await page.evaluate(()=>{window.qaCloseReasons=[];const close=window.widgetAyarPanelKapat;window.widgetAyarPanelKapat=()=>{qaCloseReasons.push(new Error().stack);return close();};});
    await page.locator('#widgetSettingsFields [name="lighting"]').uncheck();
    await page.frameLocator('#widgetSettingsPreview').locator('.widget.no-lighting').waitFor();
    await page.locator('#widgetSettingsFields [name="lighting"]').check();
    await page.frameLocator('#widgetSettingsPreview').locator('.widget:not(.no-lighting)').waitFor();
    await page.locator('[data-widget-gift]').click();
    await page.locator('#giftPicker[open]').waitFor();
    assert.equal(await page.locator('#giftChoices [data-gift-choice=""]').innerText(),'Hediye seçilmedi');
    await page.locator('#giftSearch').fill('5655');
    const group=page.locator('#giftChoices [data-gift-variants]');
    if(await group.count())await group.first().click();
    await page.locator('#giftChoices [data-gift-choice="5655"]').click();
    await page.locator('#giftPicker').waitFor({state:'hidden'});
    assert.equal(await page.locator('#widgetSettingsFields [name="giftId"]').inputValue(),'5655');
    await page.locator('.widget-settings-dialog').screenshot({path:path.join(output,'admin-royal-settings.png'),animations:'disabled',timeout:15000});
    await page.evaluate(()=>widgetAyarPanelKapat());
    await app.close();app=null;
    info=await launch();
    assert.equal((await state()).studio.settings.raconking.giftId,'5655');
    assert.equal((await state()).studio.royalLeaders.raconking.username,'new-selected');
    const reopened=await page.evaluate(()=>window.mngAPI.workspace('snapshot'));
    assert.equal(reopened.widgetAnnouncements.length,0,'Dismissed announcement must not return after restart');
    await app.close();app=null;
    assert.equal(hash(stable),stableBefore);assert.equal(hash(adminProfile),adminBefore);assert.deepEqual(errors,[]);
    const report={passed:true,version:'7.0.8',packageSha256:hash(path.join(path.dirname(executable),'resources/app.asar')),widgetCount:20,newWidgets:ids,packagedActualRoutes:true,authenticatedUrls:true,
        noBroadcastDemoProfiles:true,matchingGiftOnly:true,lastSenderWins:true,independentChannelsAndSettings:true,httpsRelayRenderedAllThree:true,allThreeAlternatingUsernamesFit:true,viralHeadingAndGiftCenterAllSixTiers:true,
        previewTestsDoNotChangeLiveOwner:true,profileAndGiftPersistence:true,announcementOnceAcrossRestart:true,
        stableApplicationAndAdminProfileUnchanged:true,publicRelease:false,realTikTokGiftDeliveryNotClaimed:true,errors};
    fs.writeFileSync(path.join(output,'packaged-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
main().catch(async error=>{console.error(error.stack);if(page&&!page.isClosed()){console.error(await page.evaluate(()=>({modalHidden:document.getElementById('widgetSettingsModal').hidden,closeReasons:window.qaCloseReasons})).catch(()=>({})));for(const frame of page.frames().slice(1))console.error(await frame.evaluate(()=>({design:document.body.dataset.design,messages:window.qaMessages})).catch(()=>({})));await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(output,'failure-ui.txt'),await page.locator('body').innerText().catch(()=>''));}process.exitCode=1;}).finally(async()=>{await browser?.close();await app?.close();});
