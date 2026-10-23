'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output='D:/TikMnG-QA-Delivery/speech-sounds-native',profile=path.join(output,'profile-'+Date.now());
const {CATALOG}=require('../lib/voice-pack-manager.cjs');
let app;
async function waitPlaying(locator){await locator.waitFor({state:'attached'});assert.ok(await locator.evaluate(audio=>new Promise(resolve=>{const started=Date.now(),timer=setInterval(()=>{if(!audio.paused&&audio.currentTime>0&&audio.volume>0){clearInterval(timer);resolve(true);}else if(Date.now()-started>3000){clearInterval(timer);resolve(false);}},10);})));}
async function main(){
    fs.mkdirSync(profile,{recursive:true});
    for(const pack of CATALOG)fs.cpSync(path.join(process.env.APPDATA,'TikMnG-Test-6.5.17/voices/v1',pack.id),path.join(profile,'voices/v1',pack.id),{recursive:true});
    const env={...process.env,MNG_TEST_PROFILE:profile,MNG_WIDGET_PORT:'31976'};delete env.ELECTRON_RUN_AS_NODE;
    app=await _electron.launch({executablePath:'D:/TikMnG-Test-6.5.17/win-unpacked/TikMnG Test.exe',env,args:['--autoplay-policy=no-user-gesture-required']});
    const page=await app.firstWindow();await page.waitForSelector('.library-card');
    const call=(action,data)=>page.evaluate(({action,data})=>window.mngAPI.workspace(action,data),{action,data});
    const timings=[];
    for(const pack of CATALOG){
        for(let i=0;i<2;i++){
            const started=Date.now(),result=await call('speech-synthesize',{text:i?'MERHABA @KING_JUX İYİ YAYINLAR':'Tik MNG Game Launcher\'a hoş geldiniz.',voiceURI:pack.voiceURI,provider:'offline',voicePreset:'natural',rate:1});
            assert.equal(result.error,undefined,JSON.stringify(result));assert.equal(result.voice.voiceURI,pack.voiceURI);
            const audio=Buffer.from(result.audioBase64,'base64');assert.equal(audio.toString('ascii',0,4),'RIFF');assert.ok(audio.length>1000);
            fs.writeFileSync(path.join(output,pack.id+'-'+i+'.wav'),audio);timings.push({voice:pack.name,run:i+1,ms:Date.now()-started,bytes:audio.length});
        }
    }
    const snapshot=await call('snapshot');assert.ok(snapshot.soundEffects.length>=8);assert.ok(path.resolve(snapshot.mediaRoot).startsWith(path.resolve(profile)+path.sep));
    await page.locator('[data-workspace-view="sounds"]').evaluate(button=>button.click());
    await page.locator('[data-sound-add]').first().evaluate(button=>button.click());
    await page.locator('#mediaEditorForm').waitFor({state:'attached'});
    await page.locator('#mediaEditorForm').evaluate(form=>{form.elements.giftId.value='5655';form.requestSubmit();});
    await page.locator('#mediaEditor[open]').waitFor({state:'hidden'});
    const imported=await call('snapshot');const sound=imported.media.find(item=>item.title===snapshot.soundEffects[0].title);assert.equal(sound.kind,'audio');assert.equal(sound.giftId,'5655');
    await page.waitForSelector('[data-sound-preview]',{state:'attached'});
    await page.locator('[data-sound-preview]').first().evaluate(button=>button.click());
    await waitPlaying(page.frameLocator('.sound-preview-frame').locator('audio'));
    await page.locator('[data-workspace-view="speech"]').evaluate(button=>button.click());
    assert.equal(await page.locator('.sound-preview-frame').count(),0);
    const overlay=snapshot.overlayUrl;
    await page.evaluate(url=>{const frame=document.createElement('iframe');frame.id='nativeSoundOverlay';frame.src=url;frame.allow='autoplay';frame.hidden=true;document.body.append(frame);},overlay);
    for(let i=0;i<50;i++){const s=await call('media-status');if(s.receivers>0)break;await new Promise(r=>setTimeout(r,100));}
    assert.ok((await call('media-status')).receivers>0);
    const eventUrl=new URL('/api/widget/gift',overlay);
    const gift=async(payload)=>{const response=await fetch(eventUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,repeatEnd:true,eventId:'qa-'+Math.random()})});assert.equal(response.status,200);};
    await gift({username:'qa_wrong',giftId:'5303',coins:50,count:1});
    assert.equal(await page.frameLocator('#nativeSoundOverlay').locator('audio').count(),0);
    await gift({username:'qa_sound',giftId:'5655',coins:1,count:1});
    await waitPlaying(page.frameLocator('#nativeSoundOverlay').locator('audio'));
    for(const [username,coins]of[['qa_one',100],['qa_two',80],['qa_three',60]])await gift({username,giftId:'6064',coins,count:1});
    const rankUrl=new URL('/widget-overlay.html',overlay);rankUrl.search=new URL(overlay).search;rankUrl.searchParams.set('type','topgifter');
    await page.evaluate(url=>{const frame=document.createElement('iframe');frame.id='nativeLeaderboard';frame.src=url;frame.style='position:fixed;inset:0;width:600px;height:540px;background:#172021;z-index:2147483647';document.body.append(frame);},rankUrl.href);
    const frame=page.frameLocator('#nativeLeaderboard');await frame.locator('.podium-person').nth(2).waitFor();
    const first=await frame.locator('.rank-1 .profile-ring').boundingBox(),second=await frame.locator('.rank-2 .profile-ring').boundingBox();assert.ok(first.width>second.width);assert.ok(first.x>second.x);
    await frame.locator('body').screenshot({path:path.join(output,'installed-coin-podium.png')});
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,installedApp:true,isolatedProfile:true,licenseLoginNotTested:true,timings,soundPreview:true,wrongGiftIgnored:true,exactGiftPlaysSound:true,legacyLeaderboardUrlUsesPodium:true},null,2));
    console.log('Native speech/sound QA passed:',JSON.stringify(timings));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await app?.close();});
