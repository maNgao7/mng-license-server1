'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {_electron}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),Store=require('electron-store');
const root=path.resolve(__dirname,'..'),output=path.join(root,'qa/710'),source=path.join(process.env.APPDATA,'TikMnG-Test-6.5.17/mng-config.json');let app;
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function main(){
    const before=hash(source),profile=fs.mkdtempSync(path.join(output,'packaged-')),games=path.join(profile,'games'),game=path.join(games,'profile-contest');
    fs.copyFileSync(source,path.join(profile,'mng-config.json'));
    fs.cpSync('D:/TikMnG-Release-7.0.10-ready/games/profile-contest',game,{recursive:true});fs.writeFileSync(path.join(game,'.tikmng-package.json'),JSON.stringify({version:'0.3.0'}));
    const config=new Store({cwd:profile,name:'mng-config',encryptionKey:'mng-electron-secret-key-2024'});
    config.set('library_root_v1',games);config.set('library_previous_paths_v1',{'profile-contest':game});config.set('media_root_v1',path.join(profile,'media'));config.set('entry_video_root_v1',path.join(profile,'entry'));
    config.set('media_studio_v1',{version:1,items:[]});config.set('media_background_downloads_enabled',false);config.set('tiktok_active_account','');config.set('tiktok_accounts',[]);
    config.set('tts_settings_v1',{enabled:false,provider:'chatterbox',voiceURI:'chatterbox:d2-00331',audience:'fanclub'});
    config.delete('game_announcements_v1');config.delete('widget_access_key');config.set('overlay_installation_v1',crypto.randomBytes(16).toString('hex'));
    await require('../lib/preview-ports.cjs').assertPreviewPortsAvailable([31975]);
    const env={...process.env,MNG_TEST_PROFILE:profile,MNG_WIDGET_PORT:'31975'};delete env.ELECTRON_RUN_AS_NODE;
    app=await _electron.launch({executablePath:'D:/TikMnG-Release-7.0.10-ready/win-unpacked/TikMnG.exe',env,timeout:60000});
    const page=await app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.waitForFunction(()=>window.mngAPI&&document.getElementById('workspaceRoot'),null,{timeout:60000});
    const snapshot=await page.evaluate(()=>mngAPI.workspace('snapshot'));assert.equal(snapshot.version,'7.0.10');assert.equal(snapshot.preview,false);
    const contest=snapshot.games.find(game=>game.id==='profile-contest');assert.ok(contest?.installed);assert.equal(contest.installedVersion,'0.3.0');assert.ok(snapshot.gameAnnouncements.some(a=>a.gameId==='profile-contest'));
    assert.equal(snapshot.tts.provider,'offline');assert.equal(snapshot.tts.audience,'fanclub');assert.deepEqual(snapshot.voiceLibrary,[]);
    await page.waitForSelector('#launcher',{state:'visible',timeout:45000});
    await page.locator('#loadingOverlay').waitFor({state:'hidden',timeout:45000});
    await page.screenshot({path:path.join(output,'packaged-launcher.png')});
    await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close()));
    await page.locator('[data-workspace-view="speech"]').click();await page.locator('#speechForm').waitFor();
    assert.equal(await page.locator('[data-natural-voice]').count(),0);assert.equal(await page.locator('[data-action="speech-local-select"]').count(),0);
    assert.equal(await page.locator('[data-voice-select^="chatterbox:"]').count(),0);assert.equal(await page.locator('[data-voice-uri^="offline:"]').count(),2);
    await page.screenshot({path:path.join(output,'packaged-speech.png')});
    const info=await page.evaluate(()=>mngAPI.widgetBilgisi());
    for(const [i,id] of ['raconking','streambeauty','streamhandsome','myactions'].entries()){
        assert.equal(info.widgets.find(w=>w.id===id).fields.find(f=>f.key==='portraitFrame').options.length,7);
        const saved=await page.evaluate(({id,i})=>mngAPI.widgetStudioKaydet(id,{giftId:'7934',portraitFrame:['sultan','ruby','olympus','imperial'][i]}),{id,i});assert.equal(saved.basarili,true);
    }
    const local=new URL(info.widgets.find(w=>w.id==='raconking').url);const event=new URL('/api/widget/gift',local.origin);event.search=local.search;
    const delivered=await fetch(event,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:crypto.randomUUID(),giftId:'7934',giftType:0,count:2,coins:2,username:'qa_supporter',nickname:'QA Supporter'})});assert.equal(delivered.status,200);
    const stateURL=new URL('/api/widget/state',local.origin);stateURL.search=local.search;stateURL.searchParams.delete('type');const state=await(await fetch(stateURL)).json();
    for(const id of ['raconking','streambeauty','streamhandsome'])assert.equal(state.studio.royalLeaders[id].username,'qa_supporter');
    const file=new URL('/widget/gift-assets/frame-olympus-v1.webp',local.origin);file.search=local.search;assert.equal((await fetch(file)).status,200);
    const launch=await page.evaluate(()=>mngAPI.uygulamaAc('profile-contest',{tiktokUser:''}));assert.equal(launch.basarili,true,launch.hata);
    const gameWindow=app.windows().find(window=>window!==page);assert.ok(gameWindow);await gameWindow.waitForSelector('#frame-style-button');assert.match(gameWindow.url(),/room=[a-f0-9-]{36}/);
    await gameWindow.screenshot({path:path.join(output,'packaged-profile-contest.png')});await gameWindow.close();
    await app.close();app=null;assert.equal(hash(source),before);assert.deepEqual(errors,[]);
    const stored=new Store({cwd:profile,name:'mng-config',encryptionKey:'mng-electron-secret-key-2024'});assert.equal(stored.get('tts_settings_v1').audience,'fanclub');
    const result={passed:true,packagedExecutable:true,newGameInLibrary:true,newGameAnnouncement:true,launchThroughRealIPC:true,frameSettingsSaved:true,exactGiftDelivery:true,fastVoicesOnly:true,savedAudiencePreserved:true,originalProfileUnchanged:true,errors};fs.writeFileSync(path.join(output,'packaged-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(async()=>{await app?.close();});
