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
const events=[];const studio=createMediaStudio({store,root:path.join(temporary,'media'),accessKey:'synthetic-workspace-qa-key',getChannel:()=> 'qa',onEvent:event=>events.push(event)});
const catalog=require('../lib/catalog-defaults.json');
const calls=[];let origin,browser,server;
const games=catalog.games.map((g,index)=>({id:g.id,ad:g.title,installed:index<4,installedVersion:index<4?'6.5.16':null,availableVersion:g.version,boyut:g.bytes?Math.round(g.bytes/1048576)+' MB':'',requirements:g.requirements||'Windows 10/11',resources:g.resources,description:'',updateAvailable:false}));
const gifts=JSON.parse(fs.readFileSync(path.join(renderer,'gift-assets/katalog_tam.json'),'utf8')).map(g=>({id:String(g.id),name:g.trName||g.name,coins:g.coins,image:'/gift-assets/'+g.file}));
function snapshot(){return{games,media:studio.list().map(item=>({...item,overlayUrl:origin+item.previewUrl})),remoteMedia:[],overlayUrl:origin+'/tikmng/media?key=synthetic-workspace-qa-key&channel=qa',version:'6.5.17',preview:true,tts:values.get('tts')||{...TTS_DEFAULTS},source:'direct',tikfinityUrl:'ws://127.0.0.1:21213/',libraryRoot:'D:/Isolated-QA/Games',mediaRoot:'D:/Isolated-QA/Media'};}
async function api(action,data={}){
    calls.push([action,data]);
    if(action==='media-save'){studio.save(data);return snapshot();}
    if(action==='media-test'){studio.test(data.id);return{ok:true};}
    if(action==='media-remove'){studio.remove(data.id);return snapshot();}
    if(action==='tts'){values.set('tts',data);return snapshot();}
    if(action==='install'){games.find(g=>g.id===data.id).installed=true;return{basarili:true};}
    if(action==='folder')return{canceled:true};
    return snapshot();
}
async function main(){
    const clip=path.join(temporary,'sample.mp4');
    execFileSync(process.env.FFMPEG_PATH||'C:/Users/User/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=640x360:rate=24','-t','5','-an','-c:v','libx264','-pix_fmt','yuv420p',clip],{windowsHide:true});
    for(let index=0;index<26;index++){
        const [item]=await studio.importFiles([clip],[{title:index===0?'Racon · Deneme Videosu':'Yayın Videosu '+(index+1),category:index<13?'Racon':'Takım Videoları'}]);
        if(index===0)studio.save({id:item.id,giftId:'5655'});
    }
    server=http.createServer((req,res)=>{
        const url=new URL(req.url,'http://127.0.0.1');
        if(studio.handleRequest(req,res,url))return;
        if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/workspace-v3.css"><body><div class="launcher"><main class="main"></main></div><script src="/vendor/lucide.js"></script><script src="/workspace.js"></script></body></html>');return;}
        const file=path.resolve(renderer,'.'+decodeURIComponent(url.pathname));
        if(!file.startsWith(renderer+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
        res.setHeader('Content-Type',({'.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.exposeFunction('__qaCall',api);
    await page.exposeFunction('__qaGifts',()=>gifts);
    await page.addInitScript(()=>{
        window.mngAPI={workspace:(a,d)=>window.__qaCall(a,d),workspaceListen:()=>{},orbitHediyeKatalogu:()=>window.__qaGifts(),widgetBilgisi:async()=>({channel:'qa',widgets:[],liveStatus:{status:'disconnected'}})};
        window.oynaButonu=async id=>window.__qaCall('play',{id});window.tiktokHesapPanelAc=()=>{};
    });
    await page.goto(origin);await page.locator('.library-card').nth(13).waitFor();
    await page.locator('.library-card').last().scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>[...document.querySelectorAll('.cover-button>img')].every(img=>img.complete&&img.naturalWidth>0));
    assert.equal(await page.locator('.library-band').first().locator('.library-card').count(),4);
    assert.equal(await page.locator('.library-band').nth(1).locator('.library-card').count(),10);
    assert.equal(new Set(await page.locator('.cover-button>img').evaluateAll(nodes=>nodes.map(node=>node.src))).size,14);
    await page.evaluate(()=>document.querySelector('.main').scrollTop=0);
    await page.screenshot({path:path.join(output,'oyun-kutuphanesi-1440.png'),fullPage:true});
    await page.locator('[data-open="vs"]').click();assert.equal(calls.filter(([a])=>a==='install').length,0);
    await page.locator('[data-play="vs"]').click();assert.equal(calls.at(-1)[0],'play');
    await page.screenshot({path:path.join(output,'oyun-detay.png')});
    await page.locator('[data-back]').click();await page.locator('[data-category="minecraft"]').click();assert.equal(await page.locator('.library-card').count(),3);
    await page.locator('#librarySearch').fill('kartopu');assert.equal(await page.locator('.library-card').count(),1);
    await page.locator('[data-open="snow-war"]').click();await page.locator('[data-install="snow-war"]').click();await page.locator('[data-play="snow-war"]').waitFor();
    await page.locator('[data-workspace-view="media"]').click();assert.equal(await page.locator('#mediaLibrary .media-row').count(),24);
    const firstPoster=page.frameLocator('#mediaLibrary iframe').first();await firstPoster.locator('video').waitFor();
    await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(frame=>frame.contentDocument?.querySelector('video')?.readyState>=2));
    await page.screenshot({path:path.join(output,'video-studyosu.png')});
    await page.locator('[data-media-page="1"]').click();assert.equal(await page.locator('#mediaLibrary .media-row').count(),2);
    await page.locator('#mediaSearch').fill('Deneme');assert.equal(await page.locator('#mediaLibrary .media-row').count(),1);
    await page.locator('[data-edit-media]').first().click();await page.locator('#mediaEditor[open]').waitFor();
    await page.locator('[data-action="choose-gift"]').click();await page.locator('#giftSearch').fill('GG');
    await page.locator('[data-gift-choice="6064"]').click();assert.match(await page.locator('#chosenGift').innerText(),/GG/);
    await page.locator('input[name="volume"]').evaluate(input=>{input.value='0.35';input.dispatchEvent(new Event('input',{bubbles:true}));});await page.locator('[data-action="editor-test"]').click();
    const preview=page.frameLocator('#mediaEditor iframe');await preview.locator('video').waitFor();
    await page.waitForFunction(()=>{const v=document.querySelector('#mediaEditor iframe').contentDocument?.querySelector('video');return v&&!v.paused&&v.currentTime>0;});
    assert.equal(studio.list().find(item=>item.title.startsWith('Racon')).giftId,'6064');
    assert.equal(studio.list().find(item=>item.title.startsWith('Racon')).volume,0.35);
    const count=events.length;assert.equal(studio.ingest('gift',{giftId:'5655',repeatEnd:true,eventId:'wrong'}).length,0);assert.equal(events.length,count);
    assert.equal(studio.ingest('gift',{giftId:'6064',repeatEnd:true,eventId:'correct'}).length,1);
    await page.screenshot({path:path.join(output,'video-hediye-eslestirmesi.png')});
    await page.locator('[data-action="choose-gift"]').click();await page.locator('#giftSearch').fill('Gül');await page.screenshot({path:path.join(output,'hediye-katalogu.png')});
    await page.locator('[data-action="close-gifts"]').click();await page.locator('#giftPicker[open]').waitFor({state:'hidden'});
    await page.locator('#mediaEditor header [data-action="close-media"]').click();await page.locator('#mediaEditor[open]').waitFor({state:'hidden'});
    await page.locator('[data-workspace-view="speech"]').click();await page.locator('input[name="names"]').uncheck();await page.locator('#speechForm [type="submit"]').click();assert.equal(values.get('tts').names,false);
    await page.locator('[data-workspace-view="games"]').click();await page.locator('#librarySearch').fill('');await page.locator('[data-category="all"]').click();
    for(const width of [1920,960,390]){
        await page.setViewportSize({width,height:width===390?844:1080});
        await page.screenshot({path:path.join(output,'oyun-kutuphanesi-'+width+'.png'),fullPage:true});
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,'Horizontal overflow at '+width);
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'ui-test-sonucu.json'),JSON.stringify({passed:true,gameCovers:14,mediaPagination:true,realVideoDecoding:true,giftMapping:true,syntheticGiftToPlayback:true,responsiveWidths:[1920,1440,960,390],liveTikTokTest:false,errors},null,2));
    console.log('UI QA passed: 14 covers, installed-first, details, install/play controls, real MP4 preview, gift selection, exact gift playback, pagination, saved TTS, four widths.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();studio.close();server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));if(path.dirname(temporary)===path.resolve(os.tmpdir()))fs.rmSync(temporary,{recursive:true,force:true});});
