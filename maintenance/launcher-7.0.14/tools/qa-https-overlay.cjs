'use strict';
// Uses a short-lived test-only certificate. No public deployment or real accounts.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const https=require('node:https');
const {Readable}=require('node:stream');
const {pathToFileURL}=require('node:url');
const {execFileSync}=require('node:child_process');
const {createOverlayBridge}=require('../lib/overlay-bridge.cjs');
const {createMediaStudio}=require('../lib/media-studio.cjs');
const WebSocket=require('ws');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-real-https-qa-'));
const serverRoot=process.env.MNG_RELAY_SOURCE||path.resolve(__dirname,'../../license-server');
let relay,publicServer,localServer,browser,bridge,studio;
const values=new Map(),store={get:(key,fallback)=>values.get(key)??fallback,set:(key,value)=>values.set(key,value)};
const checks=[];
const wait=async(predicate,message)=>{for(let index=0;index<160;index++){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error(message);};
(async()=>{
    execFileSync(process.env.OPENSSL_PATH||'C:/Program Files/Git/usr/bin/openssl.exe',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(directory,'test.key'),'-out',path.join(directory,'test.crt'),'-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1,DNS:localhost','-days','1'],{windowsHide:true,stdio:'ignore'});
    const cert=fs.readFileSync(path.join(directory,'test.crt'));
    const app=require(path.join(serverRoot,'node_modules/express'))();
    const {registerOverlayRelay}=await import(pathToFileURL(path.join(serverRoot,'overlay-relay.js')));
    relay=registerOverlayRelay(app,{secret:'only-isolated-qa-relay-secret-32-bytes-long',authorize:input=>input.licenseCode==='synthetic-license'&&input.deviceId==='synthetic-device'?{ownerId:'qa-owner'}:false});
    publicServer=https.createServer({key:fs.readFileSync(path.join(directory,'test.key')),cert},app);relay.attach(publicServer);
    await new Promise(resolve=>publicServer.listen(0,'127.0.0.1',resolve));
    const origin='https://127.0.0.1:'+publicServer.address().port;
    const localKey='isolated-local-media-key';let activeGame='qa-game';
    studio=createMediaStudio({store,root:path.join(directory,'media'),accessKey:localKey,getChannel:()=> 'qa',getActiveGame:()=>activeGame});
    const clip=path.join(directory,'clip.mp4');
    execFileSync(process.env.FFMPEG_PATH||'C:/Users/User/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=320x180:rate=24','-t','4','-an','-c:v','libx264','-pix_fmt','yuv420p',clip],{windowsHide:true});
    const [raw]=await studio.importFiles([clip]);const item=studio.save({id:raw.id,title:'HTTPS gift video',giftId:'5655',startSeconds:0,endSeconds:1.2,volume:0.4});
    const scoped=studio.duplicate(item.id,{gameId:'qa-game',title:'Game HTTPS video'});
    const localRequests=[],renderer=path.resolve(__dirname,'../renderer');
    const person={username:'qa_viewer',nickname:'QA Viewer',avatar:'',totalCoins:150,totalLikes:200};
    const gift={...person,id:'qa-gift',type:'gift',giftName:'Gül',giftImage:'/widget/gift-assets/5655.png?key='+localKey+'&channel=qa',coins:150,count:1,createdAt:Date.now()};
    const widgetState={channel:'qa',stats:{viewerCount:123,totalLikes:200,totalCoins:150,totalGifts:1},topGift:gift,topGifters:[person],topLikes:[person],ranking:[{...person,score:150}],activities:[gift,{...person,id:'qa-like',type:'like',count:3},{...person,id:'qa-wheel',type:'chat',message:'!wheel'}],jarGifts:[gift]};
    localServer=http.createServer((req,res)=>{
        const url=new URL(req.url,'http://127.0.0.1');localRequests.push({path:url.pathname,channel:url.searchParams.get('channel')});
        if(studio.handleRequest(req,res))return;
        if(url.searchParams.get('key')!==localKey||url.searchParams.get('channel')!=='qa'){res.writeHead(403);res.end();return;}
        if(url.pathname==='/api/widget/state'||url.pathname==='/widget/state'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...widgetState,activities:widgetState.activities.map(event=>({...event,createdAt:Date.now()}))}));return;}
        const relative=url.pathname==='/widget-overlay.html'?'widgets/overlay.html':url.pathname.startsWith('/widget/gift-assets/')?url.pathname.replace('/widget/',''):url.pathname.startsWith('/widget/')?url.pathname.replace('/widget/','widgets/'):url.pathname.replace(/^\//,'');
        const file=path.resolve(renderer,relative);if(!file.startsWith(renderer+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
        res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'text/html; charset=utf-8');res.end(fs.readFileSync(file));
    });
    await new Promise(resolve=>localServer.listen(0,'127.0.0.1',resolve));
    function trustedFetch(url,options={}){
        if(new URL(url).protocol!=='https:')return fetch(url,options);
        return new Promise((resolve,reject)=>{const req=https.request(url,{method:options.method||'GET',headers:options.headers,ca:cert,signal:options.signal},res=>resolve(new Response(options.method==='HEAD'?null:Readable.toWeb(res),{status:res.statusCode,headers:res.headers})));req.on('error',reject);req.end(options.body);});
    }
    class TrustedWebSocket extends WebSocket {constructor(url,options){super(url,{...options,ca:cert});}}
    const options={store,serverURL:origin,port:localServer.address().port,accessKey:localKey,getCredentials:()=>({licenseCode:'synthetic-license',deviceId:'synthetic-device'}),getChannel:()=> 'qa',fetchImpl:trustedFetch,WebSocketImpl:TrustedWebSocket};
    bridge=createOverlayBridge(options);bridge.start();await wait(()=>bridge.status().ready,'HTTPS bridge did not connect');
    const localURL=`http://127.0.0.1:${localServer.address().port}/tikmng/media?key=${localKey}&channel=qa`;
    const source=bridge.urlFor(localURL);assert.ok(source.startsWith(origin+'/overlays/'));assert.ok(!source.includes(localKey));assert.ok(!source.includes('channel='));
    const html=await trustedFetch(source);assert.equal(html.status,200);const text=await html.text();assert.ok(text.includes('/overlays/'));checks.push('actual HTTPS page and WSS publisher');
    const fileURL=bridge.urlFor(`http://127.0.0.1:${localServer.address().port}${item.mediaUrl}`);
    const range=await trustedFetch(fileURL,{headers:{range:'bytes=0-15'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,16);checks.push('binary Range over HTTPS/WSS');
    assert.equal((await trustedFetch(source.replace('/tikmng/media','/api/widget/gift'),{method:'POST'})).status,405);checks.push('public writes denied');
    browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const context=await browser.newContext({ignoreHTTPSErrors:true});const page=await context.newPage();const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{window.__played=[];document.addEventListener('playing',event=>window.__played.push(event.target.getAttribute('aria-label')),true);});
    await page.goto(source,{waitUntil:'domcontentloaded'});await wait(()=>studio.status().receivers===1,'HTTPS media source did not register');
    assert.deepEqual(studio.ingest('gift',{giftId:'999',eventId:'wrong-qa'}),[]);
    studio.ingest('gift',{giftId:'5655',eventId:'correct-qa'});
    await page.waitForFunction(()=>window.__played.includes('HTTPS gift video'),{},{timeout:15000});checks.push('gift → HTTP polling → real browser MP4 playback');
    const gamePage=await context.newPage();await gamePage.addInitScript(()=>{window.__played=[];document.addEventListener('playing',event=>window.__played.push(event.target.getAttribute('aria-label')),true);});
    const gameSource=new URL(source);gameSource.searchParams.set('game','qa-game');
    await gamePage.goto(gameSource.href);await wait(()=>studio.status('qa-game').receivers===1,'Game source missing');
    studio.ingest('gift',{giftId:'5655',eventId:'game-qa'});await gamePage.waitForFunction(()=>window.__played.includes('Game HTTPS video'),{},{timeout:15000});
    assert.ok(!(await page.evaluate(()=>window.__played)).includes(scoped.title));checks.push('game/global isolation');
    const widgetPage=await context.newPage();widgetPage.on('pageerror',error=>errors.push(error.message));
    for(const type of ['topgift','coinjar','topliker','topgifter','carousel','coindrop','timer','streambuddies','likefountain','userinfo','wheel','viewercount','tinydiny']){
        const widgetURL=bridge.urlFor(`http://127.0.0.1:${localServer.address().port}/widget-overlay.html?type=${type}&key=${localKey}&channel=qa`);
        await widgetPage.goto(widgetURL);await widgetPage.waitForFunction(()=>document.querySelector('#stage')?.children.length>0,{},{timeout:12000}).catch(async error=>{throw new Error(type+': '+error.message+' '+JSON.stringify({errors,body:(await widgetPage.locator('body').innerText()).slice(0,250)}));});
        if(type==='coinjar')await widgetPage.waitForFunction(()=>document.querySelector('canvas')?.width>0,{},{timeout:12000});
        assert.ok(await widgetPage.locator('#stage').isVisible());
    }
    checks.push('all 13 real widget pages and gift jar over HTTPS/WSS');
    const before=bridge.status().publicBase;await relay.close();await wait(()=>!bridge.status().ready,'Relay disconnect was not detected');
    const playedBeforeOutage=await gamePage.evaluate(()=>window.__played.length);
    studio.ingest('gift',{giftId:'5655',eventId:'gift-during-short-outage'});
    // Use a fresh Express listener after shutdown so route handlers cannot retain the closed relay.
    const app2=require(path.join(serverRoot,'node_modules/express'))();relay=registerOverlayRelay(app2,{secret:'only-isolated-qa-relay-secret-32-bytes-long',authorize:()=>({ownerId:'qa-owner'})});
    publicServer.removeAllListeners('request');publicServer.on('request',app2);relay.attach(publicServer);
    await wait(()=>bridge.status().ready,'Bridge did not reconnect');assert.equal(bridge.status().publicBase,before);checks.push('automatic reconnect keeps exact source address');
    await gamePage.waitForFunction(count=>window.__played.length>count,playedBeforeOutage,{timeout:15000});
    checks.push('recent gift received during short relay outage plays after recovery');
    assert.ok(localRequests.every(request=>request.channel==='qa'));assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,checks,realLiveGift:false,liveStudioAcceptance:false}));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
    bridge?.close();await browser?.close();studio?.close();await relay?.close();
    for(const server of [publicServer,localServer])if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    if(path.dirname(directory)===path.resolve(os.tmpdir()))fs.rmSync(directory,{recursive:true,force:true});
});
