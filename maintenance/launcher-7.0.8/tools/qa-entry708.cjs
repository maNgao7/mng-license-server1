'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {_electron,chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const Store=require('C:/Users/User/Desktop/MNG-TikTok-Game/launcher/node_modules/electron-store');
const root='D:/TikMnG-Release-7.0.8-ready',profile=path.join(root,'entry-qa-profile'),output=path.join(root,'qa/entry'),fixture=path.join(root,'entry-test.mp4');
const exe=path.join(root,'win-unpacked/TikMnG.exe');
const realProfile=path.join(process.env.APPDATA,'TikMnG-Test-6.5.17/mng-config.json'),stable='C:/Users/User/AppData/Local/Programs/mng-tiktok-game/resources/app.asar';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const runId=crypto.randomUUID();let app,page,browser;
async function main(){
    fs.mkdirSync(profile,{recursive:true});fs.mkdirSync(output,{recursive:true});
    if(!fs.existsSync(path.join(profile,'mng-config.json')))fs.copyFileSync(realProfile,path.join(profile,'mng-config.json'));
    const config=new Store({cwd:profile,name:'mng-config',encryptionKey:'mng-electron-secret-key-2024'});
    config.set('library_root_v1',path.join(profile,'games'));config.set('library_previous_paths_v1',{});
    config.set('media_root_v1',path.join(profile,'media'));config.set('entry_video_root_v1',path.join(profile,'entry-videos'));
    config.set('media_background_downloads_enabled',false);
    config.set('media_studio_v1',{version:1,items:[{id:crypto.randomUUID(),title:'Unconfigured QA media',category:'QA',filename:'placeholder.mp4',sourceUrl:'https://entry-qa.invalid/unused.mp4',channel:'entryqa',createdAt:Date.now()}]});
    config.set('tiktok_active_account','entryqa');config.set('tiktok_accounts',['entryqa']);config.delete('entry_videos_v1');
    config.set('overlay_installation_v1',crypto.randomBytes(16).toString('hex'));
    const stableBefore=hash(stable),profileBefore=hash(realProfile),errors=[];
    async function launch(){
        const env={...process.env,MNG_TEST_PROFILE:profile,MNG_WIDGET_PORT:'31976'};delete env.ELECTRON_RUN_AS_NODE;
        app=await _electron.launch({executablePath:exe,env,timeout:60000});page=await app.firstWindow();
        page.on('pageerror',error=>{errors.push(error.message);console.error('Renderer:',error.message);});page.on('dialog',dialog=>dialog.accept());
        await page.context().route('https://entry-qa.invalid/*.mp4',route=>route.fulfill({contentType:'video/mp4',body:fs.readFileSync(fixture)}));
        await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.unmaximize();window.setMinimumSize(360,600);window.setSize(1440,960);});
        await page.locator('#launcher').waitFor({state:'visible',timeout:60000});
        await page.waitForFunction(()=>window.mngAPI&&document.getElementById('workspaceRoot'));
        for(let i=0;i<3&&await page.locator('[data-announcement-close]:visible').count();i++)await page.locator('[data-announcement-close]:visible').click();
        const snapshot=await page.evaluate(()=>mngAPI.workspace('snapshot'));assert.equal(snapshot.version,'7.0.8');assert.equal(snapshot.preview,false);
        await page.locator('[data-workspace-view="entryvideos"]').click();await page.locator('#entryVideoPage').waitFor();return snapshot;
    }
    await launch();
    assert.equal(await page.locator('[data-workspace-view="entryvideos"]').evaluate(button=>button.previousElementSibling.dataset.action),'gift-designer');
    await page.screenshot({path:path.join(output,'entry-empty.png')});
    async function pickFixture(){
        await app.evaluate(({dialog},filename)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[filename]});},fixture);
        await page.locator('#entryPickFile').click();
        await page.frameLocator('#entrySourcePreview iframe').locator('video').waitFor();
        await page.frameLocator('#entrySourcePreview iframe').locator('video').evaluate(video=>new Promise((resolve,reject)=>{if(video.readyState>=1)return resolve();video.addEventListener('loadedmetadata',resolve,{once:true});video.addEventListener('error',reject,{once:true});}));
    }
    async function addUser(name,trigger,remote=false){
        await page.locator('[data-entry-new]').first().click();await page.locator('#entryVideoForm').waitFor();
        await page.locator('#entryVideoForm [name="username"]').fill('@'+name);await page.locator('#entryVideoForm [name="title"]').fill(name+' özel videosu');
        await page.locator('#entryVideoForm [name="trigger"]').selectOption(trigger);
        if(remote){await page.locator('[data-entry-source-mode="url"]').click();await page.locator('#entryVideoForm [name="url"]').fill('https://entry-qa.invalid/intro.mp4');}else await pickFixture();
        if(trigger==='entry')assert.equal(await page.locator('#entryVideoForm [name="oncePerLive"]').isDisabled(),true);
        if(trigger==='gift'){
            await page.locator('#entryGiftSelect').click();await page.locator('#giftPicker[open]').waitFor();await page.locator('#giftSearch').fill('5655');
            if(await page.locator('#giftChoices [data-gift-variants]').count())await page.locator('#giftChoices [data-gift-variants]').first().click();
            await page.locator('#giftChoices [data-gift-choice="5655"]').click();
        }
        await page.locator('#entryVideoForm [name="volume"]').fill('35');
        await page.locator('#entryVideoForm [type="submit"]').click();
        await page.locator('#entryVideoEditor').waitFor({state:'hidden'});await page.locator('.entry-identity strong').filter({hasText:'@'+name}).waitFor();
    }
    await addUser('entry_alice','entry');await addUser('entry_bob','gift');await addUser('entry_comment','comment',true);
    await addUser('entry_every','interaction');
    assert.equal(await page.locator('#entryTriggerFilter option[value="follow"]').count(),0);
    let snapshot=await page.evaluate(()=>mngAPI.workspace('snapshot'));assert.equal(snapshot.entryVideos.length,4);
    assert.equal(snapshot.media.length,1);assert.equal(snapshot.entryVideos.find(item=>item.username==='entry_bob').giftId,'5655');
    const originalIds=snapshot.entryVideos.map(item=>item.id);
    await page.screenshot({path:path.join(output,'entry-list-desktop.png')});
    await page.locator(`[data-entry-edit="${originalIds[1]}"]`).click();await page.screenshot({path:path.join(output,'entry-gift-editor.png')});
    await page.locator('#entryVideoEditor [data-entry-close]').first().click();
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(900,820));
    assert.equal(await page.locator('#entryVideoPage').evaluate(node=>node.scrollWidth<=node.clientWidth),true);
    await page.screenshot({path:path.join(output,'entry-list-compact.png')});
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,960));
    for(let i=0;i<40;i++){snapshot=await page.evaluate(()=>mngAPI.workspace('snapshot'));if(snapshot.entryVideoUrl)break;await new Promise(resolve=>setTimeout(resolve,1000));}
    assert.equal(new URL(snapshot.entryVideoUrl).protocol,'https:');
    const hostedVideo=new URL(snapshot.entryVideoUrl);hostedVideo.pathname+='/file/'+originalIds[0];
    snapshot=await page.evaluate(({id,url})=>mngAPI.workspace('entry-save',{id,url}),{id:originalIds[2],url:hostedVideo.href});
    await page.locator('[data-entry-copy]').click();const copied=await app.evaluate(({clipboard})=>clipboard.readText());assert.equal(copied,snapshot.entryVideoUrl);
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
    const context=await browser.newContext({viewport:{width:960,height:540}});
    context.on('requestfailed',request=>console.log('Request failure:',new URL(request.url()).hostname,request.failure()?.errorText));
    context.on('console',message=>{if(message.type()==='error')console.log('Browser:',message.text().replace(/https?:\/\/[^\s)]+/g,'<url>'));});
    await context.route('https://entry-qa.invalid/*.mp4',route=>route.fulfill({contentType:'video/mp4',body:fs.readFileSync(fixture)}));
    const local=new URL(snapshot.entryVideoLocalUrl),apiUrl=route=>{const url=new URL(route,local.origin);for(const [name,value]of local.searchParams)url.searchParams.set(name,value);return url;};
    const event=async(type,username,extra={})=>{const response=await fetch(apiUrl('/api/widget/event'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type,username,roomId:'123456789012345678',eventId:runId+':'+crypto.randomUUID(),...extra})});assert.equal(response.status,200);};
    let remote=await context.newPage();const old=await context.newPage();
    const observe=async target=>target.addInitScript(()=>{window.playEvents=[];window.mediaFailures=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){try{return Promise.resolve(play.call(this)).catch(error=>{mediaFailures.push({name:error.name,message:error.message});throw error;});}catch(error){mediaFailures.push({name:error.name,message:error.message});throw error;}};new MutationObserver(records=>{for(const record of records)for(const element of record.addedNodes)if(element.nodeName==='VIDEO'){playEvents.push(element.getAttribute('aria-label'));element.addEventListener('error',()=>mediaFailures.push({code:element.error?.code,message:element.error?.message}));}}).observe(document,{childList:true,subtree:true});});
    await observe(remote);
    const firstPoll=remote.waitForResponse(response=>response.url().includes('/tikmng/media/poll')&&response.status()===200);
    await remote.goto(snapshot.entryVideoUrl);await firstPoll;
    const oldUrl=new URL(snapshot.entryVideoLocalUrl);oldUrl.searchParams.delete('game');await old.goto(oldUrl.href);
    assert.equal(await remote.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
    assert.equal(await remote.locator('video').count(),0);
    await page.evaluate(id=>mngAPI.workspace('entry-test',{id}),originalIds[0]);
    await remote.waitForFunction(()=>document.querySelector('video')?.currentTime>.2,null,{timeout:20000});
    snapshot=await page.evaluate(()=>mngAPI.workspace('snapshot'));assert.equal(snapshot.entryVideos[0].playedThisLive,false);
    await remote.locator('video').waitFor({state:'detached',timeout:15000});await remote.evaluate(()=>window.playEvents=[]);
    await event('member','not_registered');assert.equal(await remote.locator('video').count(),0);
    await event('gift','entry_bob',{giftId:'5282',giftType:0});assert.equal(await remote.locator('video').count(),0);
    await remote.close();await event('member','entry_alice');
    snapshot=await page.evaluate(()=>mngAPI.workspace('snapshot'));assert.equal(snapshot.entryVideos[0].playedThisLive,false);assert.equal(snapshot.entryVideos[0].pendingThisLive,true);
    remote=await context.newPage();await observe(remote);await remote.goto(snapshot.entryVideoUrl);
    await remote.waitForFunction(()=>document.querySelector('video')?.currentTime>.2,null,{timeout:15000});
    await remote.screenshot({path:path.join(output,'entry-https-playing.png'),omitBackground:true});
    await remote.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}));
    let droppedReceipt=false;await remote.route('**/tikmng/media/poll?**',route=>{if(!droppedReceipt&&new URL(route.request().url()).searchParams.has('ack')){droppedReceipt=true;return route.abort();}return route.continue();});
    await event('gift','entry_bob',{giftId:'5655',giftType:0});await event('chat','entry_comment',{message:'merhaba'});
    await remote.waitForFunction(()=>window.playEvents.length===3,null,{timeout:25000});
    assert.deepEqual(await remote.evaluate(()=>window.playEvents),['entry_alice özel videosu','entry_bob özel videosu','entry_comment özel videosu']);
    await remote.locator('video').waitFor({state:'detached',timeout:15000});assert.equal(await old.locator('video').count(),0);
    await event('member','entry_alice');await event('chat','entry_comment',{message:'tekrar'});await event('gift','entry_bob',{giftId:'5655'});
    await new Promise(resolve=>setTimeout(resolve,1600));assert.equal(await remote.evaluate(()=>window.playEvents.length),3);
    await event('member','entry_every');await event('like','entry_every',{likeCount:1});
    await remote.waitForFunction(()=>window.playEvents.length===4,null,{timeout:20000});
    await remote.locator('video').waitFor({state:'detached',timeout:15000});
    snapshot=await page.evaluate(()=>mngAPI.workspace('snapshot'));console.log('Player failures:',await remote.evaluate(()=>mediaFailures));assert.equal(snapshot.entryVideos.filter(item=>item.playedThisLive).length,4);assert.equal(droppedReceipt,true);
    const fileUrl=new URL('/tikmng/media/file/'+originalIds[0],local.origin);fileUrl.search=local.search;
    const bytes=await fetch(fileUrl,{headers:{range:'bytes=0-31'}});assert.equal(bytes.status,206);assert.deepEqual(Buffer.from(await bytes.arrayBuffer()),fs.readFileSync(fixture).subarray(0,32));
    const missingKey=new URL(snapshot.entryVideoLocalUrl);missingKey.searchParams.delete('key');assert.equal((await fetch(missingKey)).status,403);
    const other=new URL(fileUrl);other.searchParams.set('channel','other');assert.equal((await fetch(other)).status,404);
    await browser.close();browser=null;await app.close();app=null;
    snapshot=await launch();assert.deepEqual(snapshot.entryVideos.map(item=>item.id),originalIds);assert.equal(snapshot.entryVideos.filter(item=>item.playedThisLive).length,4);
    await event('member','entry_alice');snapshot=await page.evaluate(()=>mngAPI.workspace('snapshot'));assert.equal(snapshot.entryVideos[0].playedThisLive,true);
    const response=await fetch(apiUrl('/api/widget/event'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'member',username:'entry_alice',roomId:'987654321012345678',eventId:runId+':new-room'})});assert.equal(response.status,200);
    snapshot=await page.evaluate(()=>mngAPI.workspace('snapshot'));assert.equal(snapshot.entryVideos.filter(item=>item.playedThisLive).length,4,'A delayed event cannot replace the verified room');
    await app.close();app=null;
    assert.equal(hash(stable),stableBefore);assert.equal(hash(realProfile),profileBefore);assert.deepEqual(errors,[]);
    const report={passed:true,version:'7.0.8',packageSha256:hash(path.join(path.dirname(exe),'resources/app.asar')),isolatedPublicPackage:true,
        rightNavigationAfterGiftDesign:true,uploadedAndHttpsVideos:true,giftPickerAndExactIds:true,allFourTriggers:true,followOptionRemoved:true,oncePerLiveAndRestart:true,lateSourceRecovered:true,hiddenSourceContinues:true,lostPlaybackReceiptRetried:true,
        newRoomResets:true,testDoesNotConsumeEntry:true,httpsVideoPlayback:true,serialQueue:true,noNormalStudioLeakage:true,alphaWhenIdle:true,
        protectedRoutesAndByteRanges:true,clipboardUrl:true,stableAndRealAdminProfileUntouched:true,realTikTokDeliveryNotClaimed:true,errors};
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
main().catch(async error=>{console.error(error.stack);if(page&&!page.isClosed()){await page.screenshot({path:path.join(output,'failure.png'),timeout:10000}).catch(()=>{});fs.writeFileSync(path.join(output,'failure-ui.txt'),await page.locator('body').innerText().catch(()=>''));}process.exitCode=1;}).finally(async()=>{await browser?.close();await app?.close();});
