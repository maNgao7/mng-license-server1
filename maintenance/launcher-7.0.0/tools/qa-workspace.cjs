'use strict';
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {createMediaStudio}=require('../lib/media-studio.cjs');
const {TTS_DEFAULTS}=require('../lib/platform.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const renderer=path.resolve(__dirname,'../renderer');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-workspace-qa-'));
const output=process.env.MNG_QA_OUTPUT||'D:/TikMnG-Launcher-Test-Raporu';fs.mkdirSync(output,{recursive:true});
const values=new Map();const store={get:(key,fallback)=>values.get(key)??fallback,set:(key,value)=>values.set(key,structuredClone(value))};
const events=[];let activeGame='',remoteMedia=[],importSelection=[];const studio=createMediaStudio({store,root:path.join(temporary,'media'),accessKey:'synthetic-workspace-qa-key',getChannel:()=> 'qa',getActiveGame:()=>activeGame,onEvent:event=>events.push(event)});
const catalog=require('../lib/catalog-defaults.json');
const gameResources=require('../lib/game-resources.cjs');
const calls=[];let origin,browser,server,speechAudio,overlayMode='legacy',naturalReady=true,fastReady=true;
const speechVoices=[...require('../lib/voice-pack-manager.cjs').CATALOG.map(pack=>({...pack,provider:'offline',lang:'tr-TR',neural:true})),...require('../lib/chatterbox-voices.json').map(voice=>({...voice,voiceURI:'chatterbox:'+voice.id,provider:'chatterbox',lang:'tr-TR',neural:true})),{name:'QA Windows',voiceURI:'windows:qa-voice',provider:'windows',lang:'tr-TR',gender:'male'}];
const installedNatural=new Set();
const games=catalog.games.map((g,index)=>({id:g.id,ad:g.title,installed:index<4,installedVersion:index<4?'6.5.16':null,availableVersion:g.version,boyut:g.bytes?Math.round(g.bytes/1048576)+' MB':'',requirements:g.requirements||'Windows 10/11',resources:g.resources,giftGuide:gameResources.getGuide(g.id),description:'',updateAvailable:false}));
const gifts=JSON.parse(fs.readFileSync(path.join(renderer,'gift-assets/katalog_tam.json'),'utf8')).map(g=>({id:String(g.id),name:g.trName||g.name,coins:g.coins,image:'/gift-assets/'+g.file}));
function broadcastFields(local){
    if(overlayMode==='legacy')return {};
    const url=new URL(local);url.searchParams.delete('key');url.searchParams.delete('channel');
    return {broadcastUrl:overlayMode==='ready'?'https://overlay.invalid/overlays/'+'a'.repeat(43)+url.pathname+url.search:''};
}
function snapshot(){
    const overlayUrl=origin+'/tikmng/media?key=synthetic-workspace-qa-key&channel=qa';
    return{games:games.map(game=>{const url=overlayUrl+'&game='+game.id;return{...game,overlayUrl:url,...broadcastFields(url)};}),
        media:studio.list().map(item=>({...item,overlayUrl:origin+item.previewUrl,...broadcastFields(origin+item.previewUrl)})),
        remoteMedia,mediaAssets:studio.listAssets().map(item=>({...item,overlayUrl:origin+item.previewUrl})),audioLibrary:studio.listSounds().map(item=>({...item,overlayUrl:origin+item.previewUrl})),soundEffects:require('../lib/sound-effects.cjs').CATALOG,overlayUrl,...broadcastFields(overlayUrl),
        ...(overlayMode==='legacy'?{}:{overlayTransport:{ready:overlayMode==='ready',status:overlayMode==='ready'?'connected':'retrying',message:overlayMode==='ready'?'HTTPS hazır':'Yayın servisi bekleniyor'}}),
        version:'6.5.17',preview:true,tts:values.get('tts')||{...TTS_DEFAULTS},source:'direct',tikfinityUrl:'ws://127.0.0.1:21213/',libraryRoot:'D:/Isolated-QA/Games',mediaRoot:'D:/Isolated-QA/Media'};
}
async function api(action,data={}){
    calls.push([action,data]);
    if(action==='speech-status')return{voices:speechVoices.filter(voice=>voice.provider==='chatterbox'?naturalReady||installedNatural.has(voice.id):voice.provider==='offline'?fastReady:true),profiles:[],providers:{chatterbox:{available:naturalReady||installedNatural.size>0,engineReady:naturalReady||installedNatural.size>0,speakers:naturalReady?10:installedNatural.size},offline:{available:fastReady},windows:{available:true}},packs:require('../lib/voice-pack-manager.cjs').CATALOG.map(pack=>({...pack,installed:fastReady})),voiceLibrary:speechVoices.filter(voice=>voice.provider==='chatterbox'),downloadPack:{downloadReady:true,downloadBytes:3676920620,commonBytes:3674856415,voices:require('../lib/chatterbox-pack-manager.cjs').PACK.references.map(file=>({id:file.id,downloadBytes:file.bytes}))}};
    if(action==='speech-natural-install'){assert.ok(require('../lib/chatterbox-voices.json').some(voice=>voice.id===data.voiceId));installedNatural.add(data.voiceId);return api('speech-status');}
    if(action==='speech-pack-install'){fastReady=true;return api('speech-status');}
    if(action==='speech-synthesize'){const voice=speechVoices.find(v=>v.voiceURI===data.voiceURI);assert.ok(voice,'Synthesis must request an actual catalog voiceURI');assert.equal(data.voicePreset,'natural','Speaker changes must not use pitch presets');return{audioBase64:speechAudio,mimeType:'audio/wav',voice,fallbackUsed:false};}
    if(action==='speech-cancel')return{ok:true};
    if(action==='speech-preview-save')return{saved:true};
    if(action==='gift-guide-save')return{saved:true};
    if(action==='media-status')return studio.status(data.gameId);
    if(action==='overlay-status')return {...studio.status(data.gameId),transport:snapshot().overlayTransport,url:broadcastFields(snapshot().overlayUrl+(data.gameId?'&game='+data.gameId:'')).broadcastUrl};
    if(action==='media-save'){studio.save(data);return snapshot();}
    if(action==='media-import'){if(importSelection.length){const imported=await studio.importFiles(importSelection,data.kind==='video'?importSelection.map(()=>({category:'Kendi Videolarım'})):[]);for(const item of imported)studio.save({...item,gameId:data.gameId||''});}return snapshot();}
    if(action==='media-test'){studio.test(data.id);return{ok:true};}
    if(action==='media-remove'){studio.remove(data.id);return snapshot();}
    if(action==='media-duplicate'){studio.duplicate(data.id,{gameId:data.gameId,giftId:'',enabled:true});return snapshot();}
    if(action==='media-library-add'){studio.addAsset(data.id,{gameId:data.gameId});return snapshot();}
    if(action==='media-sound-add'){const sound=require('../lib/sound-effects.cjs').getSound(data.id);const[item]=await studio.importFiles([sound.path],[{title:sound.title,category:sound.category}]);studio.save({...item,gameId:data.gameId||''});return snapshot();}
    if(action==='play'){activeGame=data.id;return{basarili:true};}
    if(action==='tts'){values.set('tts',data);return snapshot();}
    if(action==='install'){games.find(g=>g.id===data.id).installed=true;return{basarili:true};}
    if(action==='folder')return{canceled:true};
    return snapshot();
}
async function main(){
    const clip=path.join(temporary,'sample.mp4');
    execFileSync(process.env.FFMPEG_PATH||'C:/Users/User/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=640x360:rate=24','-f','lavfi','-i','sine=frequency=330:sample_rate=44100','-t','5','-c:a','aac','-c:v','libx264','-pix_fmt','yuv420p',clip],{windowsHide:true});
    const wav=path.join(temporary,'speech.wav');execFileSync(process.env.FFMPEG_PATH||'C:/Users/User/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe',['-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=440:sample_rate=24000','-t','0.15',wav],{windowsHide:true});speechAudio=fs.readFileSync(wav).toString('base64');
    for(let index=0;index<26;index++){
        const [item]=await studio.importFiles([clip],[{title:index===0?'Racon · Deneme Videosu':'Yayın Videosu '+(index+1),category:index<13?'Racon':'Takım Videoları'}]);
        if(index===0)studio.save({id:item.id,giftId:'5655'});
    }
    server=http.createServer((req,res)=>{
        const url=new URL(req.url,'http://127.0.0.1');
        if(studio.handleRequest(req,res,url))return;
        if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/workspace-v3.css"><link rel="stylesheet" href="/gift-guide.css"><link rel="stylesheet" href="/speech-library.css"><link rel="stylesheet" href="/sound-library.css"><body><div class="launcher"><main class="main"></main></div><script src="/vendor/lucide.js"></script><script src="/speech-engine.js"></script><script src="/speech-previews.js"></script><script src="/workspace.js"></script></body></html>');return;}
        const file=path.resolve(renderer,'.'+decodeURIComponent(url.pathname));
        if(!file.startsWith(renderer+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
        res.setHeader('Content-Type',({'.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.wav':'audio/wav'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--autoplay-policy=no-user-gesture-required']});
    const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.exposeFunction('__qaCall',api);
    await page.exposeFunction('__qaGifts',()=>gifts);
    await page.addInitScript(()=>{
        window.__qaListeners={};window.__spoken=[];
        const NativeAudio=window.Audio;window.__qaAudio=[];window.Audio=function(...args){const audio=new NativeAudio(...args);window.__qaAudio.push(audio);return audio;};
        Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{name:'QA Tolga Male',lang:'tr-TR',voiceURI:'qa-male'},{name:'QA Emel Female',lang:'tr-TR',voiceURI:'qa-female'}],addEventListener:()=>{},cancel:()=>{},speak:u=>{window.__spoken.push({text:u.text,pitch:u.pitch,rate:u.rate,voice:u.voice?.voiceURI});queueMicrotask(()=>u.onend?.());}}});
        window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
        window.mngAPI={workspace:(a,d)=>window.__qaCall(a,d),workspaceListen:(name,fn)=>{window.__qaListeners[name]=fn;},orbitHediyeKatalogu:()=>window.__qaGifts(),widgetBilgisi:async()=>({channel:'qa',widgets:[],liveStatus:{status:'disconnected'}})};
        window.oynaButonu=async id=>window.__qaCall('play',{id});window.tiktokHesapPanelAc=()=>{};window.hediyeTasarimiAc=()=>window.__qaCall('gift-designer-open');
    });
    await page.goto(origin);await page.locator('.library-card').nth(catalog.games.length-1).waitFor();
    assert.equal(await page.locator('.library-card').count(),catalog.games.length);
    await page.locator('[data-action="gift-designer"]').click();assert.equal(calls.at(-1)[0],'gift-designer-open');
    await page.locator('.library-card').last().scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>[...document.querySelectorAll('.cover-button>img')].every(img=>img.complete&&img.naturalWidth>0));
    const coverDecodes=await page.locator('.library-card').evaluateAll(async cards=>Promise.all(cards.map(async card=>{
        const image=card.querySelector('.cover-button>img');image.loading='eager';await image.decode();
        return{gameId:card.dataset.gameId,file:new URL(image.src).pathname,width:image.naturalWidth,height:image.naturalHeight};
    })));
    assert.deepEqual(coverDecodes.map(cover=>cover.gameId).sort(),catalog.games.map(game=>game.id).sort());
    assert.ok(coverDecodes.every(cover=>cover.width>0&&cover.height>0),'Every catalog game cover must decode');
    fs.writeFileSync(path.join(output,'cover-decodes.json'),JSON.stringify({passed:true,gameCovers:catalog.games.length,coverDecodes},null,2));
    assert.equal(await page.locator('.library-band').first().locator('.library-card').count(),4);
    assert.equal(await page.locator('.library-band').nth(1).locator('.library-card').count(),catalog.games.length-4);
    assert.equal(new Set(await page.locator('.cover-button>img').evaluateAll(nodes=>nodes.map(node=>node.src))).size,catalog.games.length);
    await page.evaluate(()=>document.querySelector('.main').scrollTop=0);
    await page.screenshot({path:path.join(output,'oyun-kutuphanesi-1440.png'),fullPage:true});
    await page.locator('[data-open="vs"]').click();assert.equal(calls.filter(([a])=>a==='install').length,0);
    await page.locator('[data-play="vs"]').click();assert.equal(calls.at(-1)[0],'play');
    await page.screenshot({path:path.join(output,'oyun-detay.png')});
    await page.locator('[data-back]').click();await page.locator('[data-category="minecraft"]').click();assert.equal(await page.locator('.library-card').count(),3);
    await page.locator('#librarySearch').fill('kartopu');assert.equal(await page.locator('.library-card').count(),1);
    await page.locator('[data-open="snow-war"]').click();await page.locator('[data-install="snow-war"]').click();await page.locator('[data-play="snow-war"]').waitFor();
    const guide=page.locator('[data-gift-guide="snow-war"]');
    assert.ok((await guide.innerText()).includes('Hazır hediye görselini indir'));
    await page.emulateMedia({reducedMotion:'no-preference'});
    assert.equal(await guide.evaluate(button=>getComputedStyle(button).animationName),'guide-border-shift');
    assert.ok(await guide.evaluate(button=>button.scrollWidth<=button.clientWidth));
    await page.screenshot({path:path.join(output,'hazir-hediye-gorseli-indir.png')});
    await guide.click();assert.equal(calls.at(-1)[0],'gift-guide-save');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await guide.evaluate(button=>getComputedStyle(button).animationName),'none');
    await page.locator('[data-workspace-view="media"]').click();assert.equal(await page.locator('#mediaLibrary .media-row').count(),24);
    assert.equal(await page.locator('#videoCatalog [data-library-media]').count(), 1, 'File catalog deduplicates repeated uses of the same local video');
    await page.locator('#videoCatalog [data-library-media]').first().hover();
    await page.waitForFunction(()=>{const video=document.querySelector('#videoCatalog iframe')?.contentDocument?.querySelector('video');return video&&!video.paused&&video.currentTime>0;});
    assert.equal(await page.locator('#mediaCategory').count(),0);
    await page.locator('[data-media-category="Racon"]').click();assert.equal(await page.locator('#mediaLibrary .media-row').count(),13);
    await page.locator('[data-media-category=""]').click();assert.equal(await page.locator('#mediaLibrary .media-row').count(),24);
    const firstPoster=page.frameLocator('#mediaLibrary iframe').first();await firstPoster.locator('video').waitFor();
    await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(frame=>frame.contentDocument?.querySelector('video')?.readyState>=2));
    await page.screenshot({path:path.join(output,'video-studyosu.png')});
    await page.locator('[data-media-page="1"]').click();assert.equal(await page.locator('#mediaLibrary .media-row').count(),2);
    await page.locator('#mediaSearch').fill('Deneme');assert.equal(await page.locator('#mediaLibrary .media-row').count(),1);
    await page.locator('[data-edit-media]').first().click();await page.locator('#mediaEditor[open]').waitFor();
    await page.waitForFunction(()=>Number(document.querySelector('[name="endSeconds"]').value)>4);
    await page.locator('#trimStart').evaluate(input=>{input.value='1';input.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.locator('#trimEnd').evaluate(input=>{input.value='4';input.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal(Number(await page.locator('[name="startSeconds"]').inputValue()),1);
    assert.equal(Number(await page.locator('[name="endSeconds"]').inputValue()),4);
    await page.locator('[data-action="preview-clip"]').click();
    await page.waitForFunction(()=>{const v=document.querySelector('#mediaEditor iframe').contentDocument?.querySelector('video');return v&&!v.paused&&v.currentTime>=1;});
    await page.locator('[name="interrupt"]').check();await page.locator('[name="fade"]').check();
    assert.equal(await page.locator('#trimEnd').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
    await page.locator('[data-action="choose-gift"]').click();await page.locator('#giftSearch').fill('GG');
    await page.locator('[data-gift-choice="6064"]').click();assert.match(await page.locator('#chosenGift').innerText(),/GG/);
    await page.locator('input[name="volume"]').evaluate(input=>{input.value='0.35';input.dispatchEvent(new Event('input',{bubbles:true}));});await page.locator('[data-action="editor-test"]').click();
    const preview=page.frameLocator('#mediaEditor iframe');await preview.locator('video').waitFor();
    await page.waitForFunction(()=>{const v=document.querySelector('#mediaEditor iframe').contentDocument?.querySelector('video');return v&&!v.paused&&v.currentTime>0;});
    assert.equal(studio.list().find(item=>item.title.startsWith('Racon')).giftId,'6064');
    assert.equal(studio.list().find(item=>item.title.startsWith('Racon')).volume,0.35);
    assert.equal(studio.list().find(item=>item.title.startsWith('Racon')).startSeconds,1);
    assert.equal(studio.list().find(item=>item.title.startsWith('Racon')).endSeconds,4);
    assert.equal(studio.list().find(item=>item.title.startsWith('Racon')).interrupt,true);
    const count=events.length;assert.equal(studio.ingest('gift',{giftId:'5655',repeatEnd:true,eventId:'wrong'}).length,0);assert.equal(events.length,count);
    assert.equal(studio.ingest('gift',{giftId:'6064',repeatEnd:true,eventId:'correct'}).length,1);
    await page.waitForFunction(()=>{const v=document.querySelector('#mediaEditor iframe').contentDocument?.querySelector('video');return v&&!v.paused&&v.currentTime>1.2;});
    await page.screenshot({path:path.join(output,'video-hediye-eslestirmesi.png')});
    await page.locator('[data-action="choose-gift"]').click();await page.locator('#giftSearch').fill('Gül');await page.screenshot({path:path.join(output,'hediye-katalogu.png')});
    await page.locator('[data-action="close-gifts"]').click();await page.locator('#giftPicker[open]').waitFor({state:'hidden'});
    await page.locator('#mediaEditor header [data-action="close-media"]').click();await page.locator('#mediaEditor[open]').waitFor({state:'hidden'});
    await page.locator('[data-workspace-view="games"]').click();await page.locator('#librarySearch').fill('');await page.locator('[data-category="all"]').click();
    await page.locator('[data-open="vs"]').click();assert.match(await page.locator('#allMediaLink').inputValue(),/game=vs/);
    await page.locator('[data-action="media-library"]').click();assert.equal(await page.locator('#assetChoices [data-asset]').count(),24);
    const cardSize=await page.locator('#assetChoices [data-asset]').first().evaluate(tile=>{const poster=tile.querySelector('.asset-poster').getBoundingClientRect(),title=tile.querySelector('.asset-title').getBoundingClientRect(),card=tile.getBoundingClientRect();return{width:poster.width,height:poster.height,cardHeight:card.height,titleBottom:title.bottom,cardBottom:card.bottom,scroll:tile.parentElement.scrollHeight>tile.parentElement.clientHeight};});
    assert.ok(cardSize.height>200,'Catalog previews must stay large with all 24 cards mounted');assert.ok(Math.abs(cardSize.height/cardSize.width-9/16)<0.01);assert.ok(cardSize.titleBottom<=cardSize.cardBottom+1,'Title must not be clipped');assert.equal(cardSize.scroll,true);
    await page.screenshot({path:path.join(output,'gorsel-medya-katalogu-tumu.png')});
    await page.locator('[data-asset-category="Racon"]').click();assert.equal(await page.locator('#assetChoices [data-asset]').count(),13);
    await page.locator('#assetSearch').fill('Deneme');await page.locator('[data-asset]').first().hover();
    assert.match(await page.locator('#assetChoices iframe').first().getAttribute('allow'),/autoplay/);
    await page.waitForFunction(()=>{const v=document.querySelector('#assetChoices iframe').contentDocument?.querySelector('video');return v&&!v.paused&&!v.muted&&v.volume>0&&v.currentTime>0.2;});
    const hoverAudio=await page.frameLocator('#assetChoices iframe').first().locator('video').evaluate(v=>{const stream=v.captureStream();const tracks=stream.getAudioTracks();const result={audioTracks:tracks.length,audioDecodedBytes:v.webkitAudioDecodedByteCount||0,volume:v.volume,muted:v.muted};stream.getTracks().forEach(track=>track.stop());return result;});
    assert.ok(hoverAudio.audioTracks>0,'Hover fixture must have a decoded audio track');assert.ok(hoverAudio.audioDecodedBytes>0,'Hover must decode AAC samples');assert.equal(hoverAudio.muted,false);
    assert.equal(studio.status().receivers,0,'Catalog hover must not subscribe as a broadcast receiver');
    await page.screenshot({path:path.join(output,'gorsel-medya-katalogu.png')});
    await page.locator('#assetSearch').hover();
    await page.waitForFunction(()=>{const frame=document.querySelector('#assetChoices iframe'),v=frame.contentDocument?.querySelector('video');return new URL(frame.src).searchParams.get('poster')==='1'&&v?.paused&&v.muted;});
    assert.equal(studio.status().receivers,0,'Leaving hover must keep the catalog outside broadcast subscriptions');
    await page.locator('[data-asset]').first().click();
    await page.locator('#mediaEditor[open]').waitFor();await page.locator('[data-action="choose-gift"]').click();await page.locator('#giftSearch').fill('GG');await page.locator('[data-gift-choice="6064"]').click();
    await page.locator('[name="enabled"]').check();await page.locator('#mediaEditor [type="submit"]').click();await page.locator('#mediaEditor[open]').waitFor({state:'hidden'});
    assert.equal(await page.locator('#mediaLibrary .media-row').count(),1);assert.equal(studio.list().filter(item=>item.gameId==='vs').length,1);
    await page.screenshot({path:path.join(output,'oyuna-ozel-medya.png'),fullPage:true});
    await page.locator('[data-workspace-view="media"]').click();await page.locator('#mediaSearch').fill('Deneme');assert.equal(await page.locator('#mediaLibrary .media-row').count(),1);
    await page.locator('[data-workspace-view="speech"]').click();assert.equal(await page.locator('input[name="names"]').count(),0);await page.locator('#speechForm [type="submit"]').click();assert.equal(values.get('tts').names,false);
    assert.equal(await page.locator('#speechForm select[name="voicePreset"]').count(),0,'Pitch styles must not masquerade as speakers');
    assert.equal(await page.locator('#speechForm input[type="hidden"][name="voicePreset"]').inputValue(),'natural');
    assert.equal(await page.locator('#speechForm [name="voiceURI"] option[value="girl"]').count(),0);
    assert.equal(await page.locator('[name="provider"]').isVisible(),false);
    assert.equal(await page.locator('.speech-account').count(),0);
    assert.equal(await page.locator('.speech-voice-row').count(),speechVoices.length);
    const previewSources=[];
    for(const voice of speechVoices){
        await page.locator(`[data-voice-select="${voice.voiceURI}"]`).click();
        assert.equal(await page.locator('[data-action="speech-test"]').isDisabled(),false);
        assert.ok((await page.locator('#speechAvailability').innerText()).includes(voice.name));
        const before=calls.filter(([action])=>action==='speech-synthesize').length;
        await page.locator('[data-action="speech-test"]').click();
        if(voice.provider!=='windows'){
            await page.waitForFunction(()=>window.__qaAudio.at(-1)?.currentTime>0&&!window.__qaAudio.at(-1)?.paused);
            const source=await page.evaluate(()=>window.__qaAudio.at(-1).currentSrc);previewSources.push(source);
            assert.ok(source.includes('/assets/voice-previews/'));assert.equal(await page.evaluate(()=>window.__qaAudio.at(-1).playbackRate),1);
            await page.locator('[data-action="speech-stop"]').click();
            assert.equal(calls.filter(([action])=>action==='speech-synthesize').length,before,'Bundled previews must not synthesize or download a model');
        }else{
            await page.waitForFunction(()=>document.getElementById('speechStatus').textContent==='0 yorum sırada');
            assert.equal(calls.filter(([action])=>action==='speech-synthesize').length,before+1);
        }
    }
    const spoken=calls.filter(([action])=>action==='speech-synthesize');assert.equal(spoken.length,1);assert.equal(spoken[0][1].voiceURI,'windows:qa-voice');assert.match(spoken[0][1].text,/^Tik\. Em\. En\. Ge\. Geym lonçır/);
    assert.equal(new Set(previewSources).size,12);
    assert.equal(await page.locator('[data-voice-sample-download]').count(),12);
    await page.locator('[data-voice-sample-download="chatterbox:d2-00331"]').click();assert.deepEqual(calls.at(-1),['speech-preview-save',{voiceURI:'chatterbox:d2-00331'}]);
    await page.locator('[data-voice-select="chatterbox:d2-00331"]').click();
    await page.locator('[name="audience"]').selectOption('gift');
    assert.equal(await page.locator('#speechForm select[name="giftId"]').count(),0);
    assert.equal(await page.locator('#speechForm input[type="hidden"][name="giftId"]').count(),1);
    await page.locator('#speechGift').click();await page.locator('#giftPicker[open]').waitFor();
    assert.equal(await page.locator('#giftPicker').getAttribute('data-target'),'speech');
    assert.equal(await page.locator('#giftChoices [data-gift-choice=""]').count(),0,'Speech picker must require a real gift');
    const sortedGifts=[...gifts].sort((a,b)=>Number(a.coins||0)-Number(b.coins||0)||String(a.name).localeCompare(String(b.name),'tr'));
    for(let offset=0;offset<sortedGifts.length;offset+=60){
        const choices=await page.locator('#giftChoices [data-gift-choice]').evaluateAll(nodes=>nodes.map(node=>({id:node.dataset.giftChoice,coins:Number(node.dataset.coins),image:!!node.querySelector('img'),label:node.querySelector('span')?.textContent})));
        assert.deepEqual(choices.map(({id,coins})=>({id,coins})),sortedGifts.slice(offset,offset+60).map(g=>({id:String(g.id),coins:Number(g.coins||0)})),'Visual speech gifts must be sorted across every 60-item page');
        assert.ok(choices.every(choice=>choice.image&&choice.label),'Every gift must show artwork and a name');
        assert.ok(choices.length<=60);
        if(offset+60<sortedGifts.length)await page.locator('#giftPicker [data-gift-page="'+(offset/60+1)+'"]').click();
    }
    await page.locator('#giftSearch').fill('5655');await page.locator('[data-gift-choice="5655"]').click();
    assert.equal(await page.locator('#speechForm [name="giftId"]').inputValue(),'5655');
    await page.locator('#speechGift').click();await page.locator('#giftSearch').fill('7934');
    const speechGift=page.locator('#giftChoices [data-gift-choice="7934"]');await speechGift.scrollIntoViewIfNeeded();
    await speechGift.locator('img').evaluate(img=>img.decode());
    assert.ok(await speechGift.locator('img').evaluate(img=>img.naturalWidth>0&&img.getBoundingClientRect().height>0),'Speech gift artwork must render');
    await speechGift.click();await page.locator('#giftPicker[open]').waitFor({state:'hidden'});
    assert.equal(await page.locator('#speechForm [name="giftId"]').inputValue(),'7934');
    assert.ok((await page.locator('#speechGift').innerText()).includes(gifts.find(g=>g.id==='7934').name));
    assert.equal(studio.list().find(item=>item.title.startsWith('Racon')).giftId,'6064','Shared picker must not overwrite a media gift');
    await page.locator('#speechForm [type="submit"]').click();
    assert.equal(values.get('tts').audience,'gift');assert.equal(values.get('tts').giftId,'7934');assert.equal(values.get('tts').voicePreset,'natural');assert.equal(values.get('tts').voiceURI,'chatterbox:d2-00331');
    await page.screenshot({path:path.join(output,'sesli-yorum-ayarlari.png')});
    await page.locator('#speechForm [name="audience"]').selectOption('fanclub');
    assert.equal(await page.locator('#speechGift').isVisible(),false);
    assert.equal(await page.locator('#speechForm [name="allowedUsers"]').isVisible(),false);
    assert.match(await page.locator('#audienceNote').innerText(),/Üyelik bilgisi bulunmayan/);
    await page.locator('#speechForm [type="submit"]').click();
    assert.equal(values.get('tts').audience,'fanclub');
    await page.screenshot({path:path.join(output,'hayran-kulubu-ses-filtresi.png')});
    naturalReady=false;fastReady=false;
    await page.locator('[data-action="speech-refresh"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('[data-voice-test]').length===13);
    assert.equal(await page.locator('.speech-voice-row').count(),13,'Missing packs remain visible');
    assert.equal(await page.locator('[data-voice-select^="chatterbox:"]:disabled').count(),10);
    assert.equal(await page.locator('[data-natural-voice]').count(),10);
    assert.equal(await page.locator('[data-natural-voice="d2-00331"]').isDisabled(),false);
    assert.equal(await page.locator('[data-action="speech-natural-install"]').count(),0,'No mandatory ten-voice bundle control');
    assert.equal(await page.locator('[data-voice-install="okur-tr-v1"]').isDisabled(),false);
    const beforeUninstalled=calls.length;await page.locator('[data-voice-test="chatterbox:d1-02057"]').click();
    await page.waitForFunction(()=>window.__qaAudio.at(-1)?.currentTime>0&&!window.__qaAudio.at(-1)?.paused);await page.locator('[data-action="speech-stop"]').click();
    assert.equal(calls.slice(beforeUninstalled).filter(([action])=>['speech-synthesize','speech-natural-install','speech-pack-install'].includes(action)).length,0,'An uninstalled voice preview is immediately playable');
    await page.screenshot({path:path.join(output,'indirilebilir-ses-paketleri.png'),fullPage:true});
    assert.match(await page.locator('[data-voice-uri="chatterbox:d2-00331"] small').innerText(),/GB · motor dahil/);
    assert.match(await page.locator('[data-voice-uri="offline:okur-tr-v1:default"] small').innerText(),/22\.1 MB/);
    const beforeBigInstall=calls.filter(([action])=>action==='speech-natural-install').length;
    page.once('dialog',dialog=>{assert.match(dialog.message(),/GB ortak motor/);return dialog.dismiss();});
    await page.locator('[data-natural-voice="d2-00331"]').click();
    assert.equal(calls.filter(([action])=>action==='speech-natural-install').length,beforeBigInstall,'Canceling the large motor must not install anything');
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('[data-natural-voice="d2-00331"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('[data-voice-select^="chatterbox:"]:not(:disabled)').length===1);
    assert.equal(await page.locator('[data-voice-select^="chatterbox:"]:disabled').count(),9);
    assert.deepEqual(calls.filter(([action])=>action==='speech-natural-install').at(-1)[1],{voiceId:'d2-00331'});
    await page.locator('[data-voice-select="chatterbox:d2-00331"]').click();
    await page.locator('#speechForm [name="rate"]').fill('2');
    await page.locator('[data-voice-test="chatterbox:d2-00331"]').click();
    await page.waitForFunction(()=>window.__qaAudio.at(-1)?.currentTime>0);assert.equal(await page.evaluate(()=>window.__qaAudio.at(-1).playbackRate),1);
    await page.locator('[data-action="speech-stop"]').click();
    assert.equal(await page.locator('#speechForm [name="rate"]').inputValue(),'2','Test speed must not change the live-comment setting');
    await page.locator('#speechForm [data-action="speech-test"]').click();await page.waitForFunction(()=>window.__qaAudio.at(-1)?.currentTime>0);
    assert.equal(await page.evaluate(()=>window.__qaAudio.at(-1).playbackRate),1);await page.locator('[data-action="speech-stop"]').click();
    for(const voice of require('../lib/chatterbox-voices.json').slice(1))await page.locator(`[data-natural-voice="${voice.id}"]`).click();
    await page.waitForFunction(()=>document.querySelectorAll('[data-voice-test^="chatterbox:"]').length===10);
    await page.locator('[data-voice-install="okur-tr-v1"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('[data-voice-test]').length===13);
    await page.locator('#speechTryText').fill('MERHABA @KING_JUX');await page.locator('[data-action="speech-read"]').click();
    await page.waitForFunction(()=>window.__qaAudio.at(-1)?.currentTime>0);
    assert.equal(calls.filter(([action])=>action==='speech-synthesize').at(-1)[1].voiceURI,'offline:okur-tr-v1:default');
    await page.locator('[data-action="speech-stop"]').click();
    await page.locator('#speechForm [name="audience"]').selectOption('all');
    await page.locator('#speechForm [name="enabled"]').evaluate(input=>{input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.locator('#speechForm [type="submit"]').click();
    assert.equal(values.get('tts').enabled,true);
    values.set('tts',{...values.get('tts'),names:true});
    await page.evaluate(()=>window.__qaListeners.catalog({}));
    await page.locator('#speechForm [name="enabled"]:checked').waitFor({state:'attached'});
    const chatCalls=calls.filter(([action])=>action==='speech-synthesize').length;
    await page.evaluate(()=>window.__qaListeners.chat({username:'QA_NAME_MUST_NOT_BE_SPOKEN',message:'Yalnızca bu yorum okunsun.'}));
    await page.waitForFunction(()=>window.__qaAudio.at(-1)?.currentTime>0&&!window.__qaAudio.at(-1)?.paused);
    const commentRequest=calls.filter(([action])=>action==='speech-synthesize');
    assert.equal(commentRequest.length,chatCalls+1);assert.equal(commentRequest.at(-1)[1].text,'Yalnızca bu yorum okunsun.');
    await page.locator('[data-action="speech-stop"]').click();
    await page.locator('[data-workspace-view="sounds"]').click();await page.locator('#mediaSearch').fill('');
    assert.equal(await page.locator('[data-builtin-preview]').count(),10);
    await page.locator('[data-builtin-preview]').first().click();
    await page.waitForFunction(()=>window.__qaAudio.at(-1)?.currentTime>0&&!window.__qaAudio.at(-1)?.paused);
    await page.locator('[data-sound-add]').first().click();await page.locator('#mediaEditor[open]').waitFor();
    await page.locator('[data-action="choose-gift"]').click();await page.locator('#giftSearch').fill('5655');await page.locator('[data-gift-choice="5655"]').click();
    await page.locator('#mediaEditor [type="submit"]').click();await page.locator('#mediaEditor[open]').waitFor({state:'hidden'});
    assert.equal(await page.locator('#mediaLibrary .sound-row').count(),1);
    await page.locator('#mediaLibrary [data-sound-preview]').click();
    await page.waitForFunction(()=>{const audio=document.querySelector('.sound-preview-frame')?.contentDocument?.querySelector('audio');return audio&&!audio.paused&&audio.currentTime>0;});
    await page.screenshot({path:path.join(output,'ses-efektleri-1440.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'ses-efektleri-390.png'),fullPage:true});
    assert.ok(await page.locator('#workspaceRoot').evaluate(root=>root.scrollWidth<=innerWidth));
    await page.setViewportSize({width:1440,height:960});
    await page.locator('[data-workspace-view="games"]').click();assert.equal(await page.locator('.sound-preview-frame').count(),0);
    await page.locator('[data-open="vs"]').click();await page.locator('[data-action="sound-library"]').click();
    assert.equal(await page.locator('#assetChoices .asset-sound-row').count(),1);
    await page.locator('#assetChoices [data-asset]').click();await page.locator('#mediaEditor[open]').waitFor();
    assert.equal(studio.list().filter(item=>item.kind==='audio'&&item.gameId==='vs').length,1);
    await page.locator('#mediaEditor header [data-action="close-media"]').click();
    const sound=studio.list().find(item=>item.kind==='audio'&&!item.gameId);assert.equal(sound.giftId,'5655');
    assert.equal(studio.ingest('gift',{giftId:'5655',repeatEnd:true,eventId:'sound-works'}).filter(event=>event.item.kind==='audio').length,1);
    overlayMode='waiting';await page.evaluate(()=>window.__qaListeners.catalog({}));
    await page.locator('[data-workspace-view="media"]').click();
    await page.waitForFunction(()=>document.getElementById('allMediaLink')?.value==='');
    assert.equal(await page.locator('#allMediaLink').locator('..').locator('[data-copy]').isDisabled(),true);
    assert.equal(await page.locator('[data-media-id] [data-copy]').first().isDisabled(),true);
    overlayMode='ready';await page.evaluate(()=>window.__qaListeners.overlay({ready:true,status:'connected',message:'HTTPS hazır'}));
    await page.waitForFunction(()=>document.getElementById('allMediaLink')?.value.startsWith('https://overlay.invalid/'));
    assert.equal(await page.locator('#allMediaLink').locator('..').locator('[data-copy]').isDisabled(),false);
    assert.ok(!(await page.locator('#allMediaLink').inputValue()).includes('synthetic-workspace-qa-key'));
    await page.locator('[data-edit-media]').first().click();await page.locator('#mediaEditor[open]').waitFor();
    assert.ok(!(await page.locator('#mediaEditor').innerHTML()).includes('data-copy="http://127.0.0.1:'));
    await page.locator('#mediaEditor header [data-action="close-media"]').click();
    const world=path.join(temporary,'world.wav');fs.copyFileSync(wav,world);
    await studio.importFiles([wav,world],[{title:'Türkiye ses denemesi',category:'Türkiye Viral'},{title:'Dünya ses denemesi',category:'Dünya Viral'}]);
    await studio.importFiles([path.join(renderer,'assets/game-covers/vs-v4.png')],[{title:'Görsel denemesi',category:'Yalnızca Görseller'}]);
    remoteMedia=[{id:'remote-audio',title:'Yayımlanan ses',category:'Uzak Sesler',url:'https://cdn.invalid/effect.MP3?version=2'},
        {id:'remote-video',title:'Yayımlanan video',category:'Uzak Videolar',url:'https://cdn.invalid/clip.mp4'},
        {id:'remote-image',title:'Yayımlanan görsel',category:'Uzak Görseller',url:'https://cdn.invalid/image.gif'}];
    const preserved=structuredClone(studio.list());
    await page.evaluate(()=>window.__qaListeners.catalog({}));
    await page.locator('[data-remote-media-id="remote-video"]').waitFor();
    await page.locator('[data-workspace-view="media"]').click();
    const mediaUrl=await page.locator('#allMediaLink').inputValue();
    for(const category of ['Türkiye Viral','Dünya Viral','Hediyeler','Uzak Sesler'])assert.equal(await page.locator(`[data-media-category="${category}"]`).count(),0,'Audio categories must not leak into Video Studio');
    assert.equal(await page.locator('[data-media-kind="audio"]').count(),0);
    assert.equal(await page.locator('#mediaLibrary .sound-row').count(),0);
    assert.equal(await page.locator('[data-remote-media-id="remote-audio"]').count(),0);
    assert.equal(await page.locator('[data-remote-media-id="remote-video"]').count(),1);
    await page.locator('[data-media-category="Yalnızca Görseller"]').click();
    assert.equal(await page.locator('#videoCatalog [data-library-media]').count(),1);
    await page.locator('[data-media-kind="video"]').click();
    assert.equal(await page.locator('[data-media-category="Yalnızca Görseller"]').count(),0);
    assert.equal(await page.locator('[data-media-category=""]').getAttribute('aria-selected'),'true','Changing media kind clears an incompatible category');
    assert.ok(await page.locator('#videoCatalog [data-library-media]').count()>0);
    await page.locator('[data-action="media-new"]').click();
    assert.deepEqual(await page.locator('#mediaEditor [name="kind"] option').evaluateAll(options=>options.map(option=>option.value)),['video','image']);
    await page.locator('#mediaEditor header [data-action="close-media"]').click();
    await page.screenshot({path:path.join(output,'video-only-categories.png'),fullPage:true});
    await page.locator('[data-workspace-view="sounds"]').click();
    assert.equal(await page.locator('#allMediaLink').inputValue(),mediaUrl,'Video and sounds must retain the same general overlay URL');
    assert.equal(await page.locator('[data-media-category="Racon"]').count(),0);
    assert.equal(await page.locator('[data-media-category="Yalnızca Görseller"]').count(),0);
    assert.equal(await page.locator('[data-media-category="Uzak Videolar"]').count(),0);
    assert.equal(await page.locator('[data-media-category="Uzak Sesler"]').count(),1);
    await page.locator('[data-media-category="Türkiye Viral"]').click();
    assert.equal(await page.locator('#soundCatalog .asset-sound-row').count(),1);
    assert.equal(await page.locator('#mediaLibrary .media-row:not(.sound-row)').count(),0);
    await page.locator('#soundCatalog [data-sound-preview]').click();
    await page.waitForFunction(()=>{const audio=document.querySelector('.sound-preview-frame')?.contentDocument?.querySelector('audio');return audio&&!audio.paused&&audio.currentTime>0;});
    await page.locator('[data-action="media-new"]').click();
    assert.deepEqual(await page.locator('#mediaEditor [name="kind"] option').evaluateAll(options=>options.map(option=>option.value)),['audio']);
    await page.locator('#mediaEditor header [data-action="close-media"]').click();
    await page.locator('#mediaSearch').fill('Türkiye ses');
    await page.locator('[data-workspace-view="media"]').click();
    assert.equal(await page.locator('#mediaSearch').inputValue(),'');
    assert.equal(await page.locator('[data-media-category="Türkiye Viral"]').count(),0);
    await page.locator('[data-workspace-view="games"]').click();await page.locator('[data-open="vs"]').click();
    assert.equal(await page.locator('[data-media-kind="audio"]').count(),1,'Per-game actions continue to support sound');
    await page.locator('[data-media-kind="audio"]').click();
    assert.equal(await page.locator('#mediaLibrary .sound-row').count(),1);
    await page.locator('[data-media-kind="video"]').click();
    assert.equal(await page.locator('#mediaLibrary .sound-row').count(),0);
    assert.deepEqual(studio.list(),preserved,'Filtering and switching views never modify saved mappings');
    await page.locator('[data-workspace-view="media"]').click();
    const personalClip=path.join(temporary,'my-personal-video.mp4');fs.copyFileSync(clip,personalClip);importSelection=[personalClip];
    await page.locator('#mediaSearch').fill('This filter must not hide the new upload');
    await page.getByRole('button',{name:'Kendi videonu ekle',exact:true}).click();
    await page.locator('#mediaEditor[open]').waitFor();
    assert.equal(calls.filter(([action])=>action==='media-import').at(-1)[1].kind,'video');
    assert.equal(await page.locator('#mediaEditor [name="title"]').inputValue(),'my-personal-video');
    assert.equal(await page.locator('#mediaEditor [name="category"]').inputValue(),'Kendi Videolarım');
    assert.equal(await page.locator('#mediaSearch').inputValue(),'');
    fs.unlinkSync(personalClip);
    await page.locator('#mediaEditor [data-action="preview-clip"]').click();
    await page.waitForFunction(()=>{const video=document.querySelector('#mediaEditor iframe')?.contentDocument?.querySelector('video');return video&&!video.paused&&video.currentTime>0;});
    await page.locator('#mediaEditor header [data-action="close-media"]').click();
    await page.locator('[data-media-category="Kendi Videolarım"]').click();
    assert.equal(await page.locator('#videoCatalog [data-library-media]').count(),1);
    await page.locator('#videoCatalog [data-library-media]').hover();
    await page.waitForFunction(()=>{const video=document.querySelector('#videoCatalog iframe')?.contentDocument?.querySelector('video');return video&&!video.paused&&video.currentTime>0;});
    await page.screenshot({path:path.join(output,'personal-video-upload.png'),fullPage:true});
    for(const original of preserved)assert.deepEqual(studio.list().find(item=>item.id===original.id),original,'Uploading a personal video preserves every existing mapping');
    await page.evaluate(()=>window.__qaListeners.live({status:'waiting',username:'qa',message:'Yayın henüz açık değil.'}));
    assert.match(await page.locator('#workspaceLive').innerText(),/Yayın bekleniyor/);
    await page.evaluate(()=>window.__qaListeners.live({status:'connected',username:'qa',message:'Gerçek oda doğrulandı.'}));
    assert.match(await page.locator('#workspaceLive').innerText(),/Canlı/);
    await page.locator('[data-workspace-view="games"]').click();await page.locator('#librarySearch').fill('');await page.locator('[data-category="all"]').click();
    for(const width of [1920,960,390]){
        await page.setViewportSize({width,height:width===390?844:1080});
        await page.screenshot({path:path.join(output,'oyun-kutuphanesi-'+width+'.png'),fullPage:true});
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,'Horizontal overflow at '+width);
        await page.locator('[data-open="snow-war"]').click();
        assert.ok(await page.locator('[data-gift-guide]').evaluate(button=>button.scrollWidth<=button.clientWidth));
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Gift guide button overflow at '+width);
        await page.locator('[data-back]').click();
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'ui-test-sonucu.json'),JSON.stringify({passed:true,gameCovers:catalog.games.length,coverDecodes,mediaPagination:true,realVideoDecoding:true,personalVideoUpload:{button:true,videoOnlyDialog:true,preview:true,ownCategory:true,filtersCleared:true,sourceRemovalSafe:true,mappingsPreserved:true},mediaKindIsolation:{categories:true,localAndRemoteActions:true,typeSwitchClearsCategory:true,urlEditors:true,sameOverlayUrl:true,savedMappingsPreserved:true},audibleHover:{...hoverAudio,stopsOnLeave:true},giftMapping:true,visualSpeechGiftPicker:{coinAscending:true,pageSize:60,total:gifts.length,selectedGiftId:'7934'},explicitVoiceRequests:spoken.map(([,request])=>({voiceURI:request.voiceURI,voicePreset:request.voicePreset})),noFakeStyleDropdown:true,syntheticGiftToPlayback:true,responsiveWidths:[1920,1440,960,390],liveTikTokTest:false,errors},null,2));
    console.log(`UI QA passed: ${catalog.games.length} covers decoded, installed-first, details, install/play controls, real MP4 preview, gift selection, exact gift playback, pagination, saved TTS, four widths.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();studio.close();server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));if(path.dirname(temporary)===path.resolve(os.tmpdir()))fs.rmSync(temporary,{recursive:true,force:true});});
