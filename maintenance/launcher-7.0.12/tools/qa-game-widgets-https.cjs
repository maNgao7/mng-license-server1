'use strict';
// Real game servers and real TLS/WSS relay; all gameplay input is isolated synthetic QA.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),https=require('node:https');
const assert=require('node:assert/strict'),{Readable}=require('node:stream'),{pathToFileURL}=require('node:url');
const {spawn,execFileSync}=require('node:child_process'),{once}=require('node:events');
const WebSocket=require('ws'),{createGameWidgetHost}=require('../lib/game-widget-host.cjs'),specs=require('../lib/game-widget-specs.cjs');
const {createOverlayBridge}=require('../lib/overlay-bridge.cjs');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const publicRun=process.argv.includes('--public');
const apps=path.resolve(__dirname,'../../apps'),output='D:/TikMnG-Widget-QA-20261025/'+(publicRun?'public-e2e':'https-e2e');
const relayRoot='D:/TikMnG-Release-7.0.0-source',key='synthetic-isolated-game-widget-key';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,message){for(let i=0;i<150;i++){if(await fn())return;await sleep(100);}throw new Error(message||'Expected widget state missing');}
async function listen(server,port=0){await new Promise((r,j)=>{server.once('error',j);server.listen(port,'127.0.0.1',r);});return server.address().port;}
async function freePort(){const s=http.createServer();const p=await listen(s);await new Promise(r=>s.close(r));return p;}
let localServer,publicServer,relay,host,bridge,browser,context,gameServer,control;
let channel='qa_host',target=null,identity=0;
const checks=[],games=[],errors=[],requests=[],children=new Set();
async function socket(port,authenticated=false){
    const ws=new WebSocket(`ws://127.0.0.1:${port}${authenticated?'/live':''}`,{origin:`http://127.0.0.1:${port}`});
    ws.on('error',()=>{});await once(ws,'open');
    if(authenticated){const s=await fetch(`http://127.0.0.1:${port}/api/session`).then(r=>r.json());ws.send(JSON.stringify({token:s.token}));await sleep(50);}
    return ws;
}
async function startChild(game,port,extra={}){
    const env={...process.env,PORT:String(port),PONY_PORT:String(port),TIGHTROPE_SETTINGS_FILE:path.join(output,'tightrope-settings.json'),APPDATA:path.join(output,'profile'),LOCALAPPDATA:path.join(output,'local-profile'),MNG_WIDGET_PORT:String(localServer.address().port),MNG_WIDGET_ACCESS_KEY:key,MNG_GAME_ID:game,...extra};
    delete env.ELECTRON_RUN_AS_NODE;delete env.EULER_API_KEY;
    const cwd=game==='vs'?extra.QA_DIRECTORY:path.join(apps,game);
    const child=spawn(process.execPath,[game==='pony-life'?'server/index.js':'server.js'],{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});children.add(child);
    let logs='';child.stdout.on('data',b=>logs=(logs+b).slice(-2000));child.stderr.on('data',b=>logs=(logs+b).slice(-2000));
    await wait(async()=>{if(child.exitCode!==null)throw new Error(game+' exited: '+logs);try{return(await fetch(`http://127.0.0.1:${port}/api/health`)).ok;}catch{return false;}},game+' server readiness');
    return {port,async stop(){if(child.exitCode==null&&child.signalCode==null){const done=once(child,'exit');child.kill();await done;}children.delete(child);}};
}
async function pageProof(game,mode,expected){
    const url=host.links(game).links[mode];assert.ok(url?.startsWith('https://'));assert.ok(!url.includes(key));
    const page=await context.newPage();page.on('pageerror',e=>errors.push({game,mode,error:e.message}));
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.locator('li').filter({hasText:expected}).first().waitFor({timeout:15000});
    const value=await page.locator('li strong').first().innerText();
    await page.screenshot({path:path.join(output,game+'-'+mode+'.png'),omitBackground:true});
    const text=await page.locator('main').innerText();
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
    return {page,record:{game,mode,path:new URL(url).pathname.replace(/\/overlays\/[^/]+/,'/overlays/<test-session>'),value,text}};
}
async function run(){
    fs.mkdirSync(output,{recursive:true});
    const certDir=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-widget-tls-'));
    execFileSync('C:/Program Files/Git/usr/bin/openssl.exe',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(certDir,'test.key'),'-out',path.join(certDir,'test.crt'),'-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1,DNS:localhost','-days','1'],{windowsHide:true,stdio:'ignore'});
    const cert=fs.readFileSync(path.join(certDir,'test.crt')),privateKey=fs.readFileSync(path.join(certDir,'test.key'));
    assert.equal(path.dirname(certDir),os.tmpdir());fs.rmSync(certDir,{recursive:true,force:true});
    const {registerOverlayRelay}=await import(pathToFileURL(path.join(relayRoot,'overlay-relay.js')));
    const express=require(path.join(relayRoot,'node_modules/express'));
    const app=express();relay=registerOverlayRelay(app,{secret:'qa-only-widget-relay-synthetic-signing-secret',authorize:()=>({ownerId:'synthetic-widget-owner'})});
    publicServer=https.createServer({key:privateKey,cert},app);relay.attach(publicServer);const localOrigin='https://127.0.0.1:'+await listen(publicServer);
    const origin=publicRun?fs.readFileSync(path.join(__dirname,'../license-server.txt'),'utf8').trim():localOrigin;
    let credentials=()=>({licenseCode:'synthetic-license',deviceId:'synthetic-device'});
    if(publicRun){
        const Store=require('electron-store');
        const saved=new Store({cwd:path.join(process.env.APPDATA,'TikMnG-Test-6.5.17'),projectVersion:'7.0.2-preview.5',name:'mng-config',encryptionKey:'mng-electron-secret-key-2024'});
        credentials=()=>({licenseCode:saved.get('lisans_kod',''),deviceId:saved.get('cihaz_kimlik','')});
        assert.ok(credentials().licenseCode&&credentials().deviceId,'Authorized preview credentials required');
    }
    localServer=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');requests.push({path:url.pathname,game:url.searchParams.get('game'),channel:url.searchParams.get('channel')});if(url.searchParams.get('key')!==key){res.writeHead(403).end();return;}if(!host?.handleRequest(req,res,url,url.searchParams.get('channel')||channel))res.writeHead(404).end();});
    const port=await listen(localServer);
    function trustedFetch(url,options={}){
        if(publicRun||new URL(url).protocol!=='https:')return fetch(url,options);
        return new Promise((resolve,reject)=>{const req=https.request(url,{method:options.method||'GET',headers:options.headers,ca:cert,signal:options.signal},res=>resolve(new Response(options.method==='HEAD'?null:Readable.toWeb(res),{status:res.statusCode,headers:res.headers})));req.on('error',reject);req.end(options.body);});
    }
    class TrustedSocket extends WebSocket{constructor(url,options){super(url,{...options,...(!publicRun?{ca:cert}:{})});}}
    const values=new Map(),store={get:(k,f)=>values.get(k)??f,set:(k,v)=>values.set(k,v)};
    bridge=createOverlayBridge({store,port,accessKey:key,serverURL:origin,namespace:'game-widget-qa',getChannel:()=>channel,getCredentials:credentials,fetchImpl:trustedFetch,WebSocketImpl:TrustedSocket});
    host=createGameWidgetHost({specs,getTarget:game=>target?.game===game?target:null,getChannel:()=>channel,getSharedState:()=>({topGifters:[{username:'qa_supporter',totalCoins:125}]}),publicURL:url=>bridge.urlFor(url),port,accessKey:key,retryMs:100});
    bridge.start();await wait(()=>bridge.status().ready,'TLS/WSS publisher not ready');
    browser=await chromium.launch({channel:'chrome',headless:true});context=await browser.newContext({ignoreHTTPSErrors:!publicRun,viewport:{width:440,height:700}});
    await context.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===origin?route.continue():route.abort();});
    const harness=await import(pathToFileURL(path.join(apps,'mng-orbit/qa/widget-qa.mjs')));
    for(const name of ['mng-orbit','crowd-control','battle-game','duck-hunt']){
        console.log('GAME',name);
        const game=name==='mng-orbit'?'orbit':name,dir=path.join(output,game);fs.mkdirSync(dir,{recursive:true});
        const report={serverLogs:[],serverAddresses:[],clientMessages:[],controlReceived:[]};
        const fixture=harness.fixtureFor(name,dir);gameServer=await harness.startServer(name,fixture.fixture,0,report);
        Object.assign(gameServer.relayEnvironment,{MNG_WIDGET_PORT:String(port),MNG_WIDGET_ACCESS_KEY:key,MNG_GAME_ID:game});
        target={game,port:gameServer.port,channel,identity:++identity};
        host.snapshot(game,Object.keys(specs[game].modes)[0],channel);
        const controller=await harness.control(name,gameServer,report);control=controller.socket;
        await controller.send(harness.stateMessages(name,'updated'));
        const pages=[];
        for(const mode of Object.keys(specs[game].modes)){
            const expected=name==='mng-orbit'?(mode==='ranking'?'QA_Orbit_Update':'QA_Winner_Update'):name==='crowd-control'?'QA_Supporter_Update':name==='battle-game'?(mode==='armies'?'QA_Army_Update':'QA_Champion_Update'):(mode==='victims'?'QA_Victim_Update':'QA_Survivor_Update');
            const proof=await pageProof(game,mode,expected);pages.push(proof.page);games.push(proof.record);
        }
        const copied=await fetch(gameServer.origin+'/api/launcher-widget-links').then(r=>r.json());assert.equal(copied.ready,true);assert.deepEqual(copied.links,host.links(game).links);
        for(const client of gameServer.wss.clients)if(client._socket?.remotePort!==control._socket?.localPort)client.terminate();
        await sleep(300);await controller.send(harness.stateMessages(name,'updated'));
        await wait(()=>host.snapshot(game,Object.keys(specs[game].modes)[0],channel).entries.length>0,game+' WS recovery');
        checks.push(game+': real game WS → broker → TLS/WSS relay → browser; exact copied HTTPS links; reconnect');
        control.terminate();control=null;target=null;
        for(const page of pages){await page.waitForFunction(()=>document.querySelector('main').hidden,{},{timeout:8000});await page.close();}
        await gameServer.stop();gameServer=null;
    }
    for(const game of ['pony-life','penalty-kick','tightrope-balance','vs','puanlama']){
        console.log('GAME',game);
        const portGame=await freePort(),extra={};
        if(game==='pony-life'){
            extra.PONY_WIDGET_PORT=String(await freePort());extra.PONY_STATE_FILE=path.join(output,'pony-settings.json');
            fs.writeFileSync(extra.PONY_STATE_FILE,JSON.stringify({settings:{trackLength:800,quality:'low'},wins:{qa_champion:{id:'qa_champion',username:'qa_champion',count:4}}}));
        }
        if(game==='vs'||game==='puanlama'){
            const sandbox=path.join(output,'isolated-vs');fs.mkdirSync(sandbox,{recursive:true});
            for(const file of ['server.js','package.json','launcher-widget-links.cjs'])fs.copyFileSync(path.join(apps,'tiktok-vs',file),path.join(sandbox,file));
            fs.mkdirSync(path.join(sandbox,'public'),{recursive:true});
            if(!fs.existsSync(path.join(sandbox,'node_modules')))fs.symlinkSync(path.join(apps,'tiktok-vs/node_modules'),path.join(sandbox,'node_modules'),'junction');
            extra.QA_DIRECTORY=sandbox;extra.MNG_GAME_ID=game;
        }
        gameServer=await startChild(game==='puanlama'?'vs':game,portGame,extra);
        const upstreamPort=game==='pony-life'?Number(extra.PONY_WIDGET_PORT):portGame;
        target={game,port:upstreamPort,channel,identity:++identity};
        host.snapshot(game,Object.keys(specs[game].modes)[0],channel);
        control=await socket(portGame,game==='pony-life');
        const send=data=>control.send(JSON.stringify(data));
        if(game==='pony-life')send({type:'test-follow',username:'qa_rider'});
        if(game==='penalty-kick')send({type:'update-leaderboard',goalkeepers:[{username:'qa_keeper',saves:7}],teams:{galatasaray:8}});
        if(game==='tightrope-balance')await fetch(`http://127.0.0.1:${portGame}/api/leaderboard`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({left:[['qa_left',{nickname:'qa_left',totalKg:11}]],right:[['qa_right',{nickname:'qa_right',totalKg:4}]],leftTotal:11,rightTotal:4})});
        if(game==='vs'){
            send({type:'battle-assign',side:'left',username:'qa_left'});send({type:'battle-assign',side:'right',username:'qa_right'});send({type:'battle-start',duration:30});send({type:'battle-score',side:'left',value:15});send({type:'battle-toggle-pause'});
        }
        if(game==='puanlama'){send({type:'puanlama-goster',uniqueId:'qa_profile',nickname:'QA Profile'});send({type:'puanlama-basla',saniye:30});send({type:'puanlama-durdur'});}
        const pages=[];
        for(const mode of Object.keys(specs[game].modes)){
            if(game==='vs'&&mode==='winners'){send({type:'battle-start',duration:5});send({type:'battle-score',side:'left',value:2000});await sleep(5500);}
            const expected=game==='pony-life'?(mode==='winners'?'qa_champion':'qa_rider'):game==='penalty-kick'?(mode==='teams'?'galatasaray':'qa_keeper'):game==='tightrope-balance'?(mode==='right'?'qa_right':'qa_left'):game==='vs'?'qa_left':mode==='profile'?'QA Profile':'qa_supporter';
            const proof=await pageProof(game,mode,expected);pages.push(proof.page);games.push(proof.record);
        }
        const actual=await fetch(`http://127.0.0.1:${portGame}/api/launcher-widget-links?game=${game}`).then(r=>r.json());assert.equal(actual.ready,true);assert.deepEqual(actual.links,host.links(game).links);
        checks.push(game+': real game HTTP/WS → broker → TLS/WSS relay → browser; exact copied HTTPS links');
        control.terminate();control=null;target=null;for(const page of pages){await page.waitForFunction(()=>document.querySelector('main').hidden,{},{timeout:8000});await page.close();}
        await gameServer.stop();gameServer=null;
    }
    assert.deepEqual(errors,[]);assert.ok(requests.filter(r=>r.path==='/api/widget/state').every(r=>r.channel==='qa_host'));
    return {passed:true,checks,games,gameModesShown:games.length,actualGameServers:true,publicRenderRelay:publicRun,certificateVerification:publicRun,realTLS:true,realPublisherWSS:true,realBrowser:true,syntheticGameplay:true,realTikTokGiftsSent:false,liveStudioAcceptance:false,errors};
}
run().then(report=>{fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}).catch(error=>{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:false,error:error.stack,checks,games,errors},null,2));console.error(error.stack);process.exitCode=1;}).finally(async()=>{
    control?.terminate();target=null;await gameServer?.stop();for(const child of children)child.kill();host?.close();bridge?.close();await browser?.close();await relay?.close();for(const server of [publicServer,localServer])if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
});
