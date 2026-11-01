'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{execFileSync}=require('node:child_process');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createWidgetChanges}=require('../lib/widget-changes.cjs'),{createMediaStudio}=require('../lib/media-studio.cjs'),{createOverlayBridge}=require('../lib/overlay-bridge.cjs'),{normalize}=require('../lib/widget-studio.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa/712'),key='isolated-traffic-qa',channel='qa';
const stores=()=>{const values=new Map();return {get:(key,fallback)=>values.get(key)??fallback,set:(key,value)=>values.set(key,value)};};
const resources=[];let browser;
async function listen(server){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));resources.push(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});return 'http://127.0.0.1:'+server.address().port;}
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const {default:express}=await import(pathToFileURL('D:/TikMnG-Release-7.0.0-source/node_modules/express/index.js').href);
 const {registerOverlayRelay}=await import(pathToFileURL('D:/TikMnG-Release-7.0.0-source/overlay-relay.js').href);
 const {createHttpTraffic}=await import(pathToFileURL('D:/TikMnG-Release-7.0.0-source/http-traffic.js').href);
 const traffic=createHttpTraffic(),app=express();app.use(traffic.middleware);
 const relay=registerOverlayRelay(app,{secret:crypto.randomBytes(32),authorize:()=>({ownerId:'isolated-qa'})}),relayServer=http.createServer(app);relay.attach(relayServer);
 const publicOrigin=await listen(relayServer);resources.push(()=>relay.close());
 const source=path.join(out,'traffic-sample.mp4');
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=160x96:rate=15','-t','1.5','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','-y',source],{windowsHide:true});
 const media=createMediaStudio({store:stores(),root:path.join(out,'traffic-media'),accessKey:key,getChannel:()=>channel}),[imported]=await media.importFiles([source]);
 const item=media.save({id:imported.id,giftId:'5655'});resources.push(()=>media.close());
 const helper=fs.readFileSync(path.join(root,'renderer/widgets/change-transport.js'),'utf8'),feeds=[];
 let state={channel,studio:{settings:{streamtimer:normalize('streamtimer',{sound:false})},streamTimer:{running:true,endsAt:Date.now()+300000,remainingMs:300000,serverNow:Date.now()}}};
 const snapshots=()=>{const next=structuredClone(state);if(next.studio?.streamTimer){next.studio.streamTimer.remainingMs=Math.max(0,next.studio.streamTimer.endsAt-Date.now());next.studio.streamTimer.serverNow=Date.now();}return next;};
 async function publisher(version){
  const old=version==='old',base=old?path.resolve(root,'../launcher-update-7.0.11'):root,feed=createWidgetChanges();feeds.push(feed);
  const server=http.createServer((req,res)=>{
   const url=new URL(req.url,'http://localhost');
   if(url.searchParams.get('key')!==key){res.writeHead(403);return res.end();}
   if(media.handleRequest(req,res,url))return;
   if(url.pathname==='/api/widget/state'){
    if(!old&&feed.handle(req,res,url,snapshots))return;
    res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(snapshots()));
   }
   if(url.pathname==='/widget-overlay.html'){
    const file=url.searchParams.get('type')==='pk'?'live-score-widgets.html':'reference-widgets.html';
    let html=fs.readFileSync(path.join(base,'renderer/widgets',file),'utf8');
    if(!old)html=html.replace(/<script(?=[\s>])/,`<script>${helper}</script><script`);
    res.setHeader('Content-Type','text/html');return res.end(html);
   }
   res.writeHead(404);res.end();
  });
  await listen(server);
  const bridge=createOverlayBridge({store:stores(),serverURL:publicOrigin,port:server.address().port,accessKey:key,getCredentials:()=>({licenseCode:'isolated-qa',deviceId:'qa'}),namespace:'traffic-'+version,allowInsecureForTests:true});
  resources.push(()=>bridge.close());bridge.start(channel);
  const until=Date.now()+5000;while(!bridge.status().ready&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,20));assert.equal(bridge.status().ready,true);
  return bridge.status().publicBase;
 }
 const oldBase=await publisher('old'),newBase=await publisher('new');resources.push(()=>feeds.forEach(feed=>feed.close()));
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:900,height:600}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const category=name=>traffic.snapshot().categories.find(row=>row.name===name);
 async function measure(base){
  const before={...category('overlay-state')};await page.goto(base+'/widget-overlay.html?type=streamtimer');await page.locator('.stream-timer strong').waitFor();
  const initial=await page.locator('.stream-timer strong').textContent();await page.waitForTimeout(12000);const final=await page.locator('.stream-timer strong').textContent();assert.notEqual(initial,final,'Timer continues without full state messages');
  await page.screenshot({path:path.join(out,base===newBase?'traffic-new.png':'traffic-old.png'),omitBackground:true});await page.goto('about:blank');await page.waitForTimeout(100);
  const after=category('overlay-state');return {requests:after.requests-before.requests,bodyBytes:after.bodyBytes-before.bodyBytes,initial,final};
 }
 const old=await measure(oldBase),current=await measure(newBase),reduction=1-current.bodyBytes/old.bodyBytes;
 assert.ok(old.requests>=10);assert.ok(current.requests<=3);assert.ok(reduction>.8,JSON.stringify({old,current}));
 state={channel,activities:[],studio:{settings:{actionwheel:normalize('actionwheel',{giftId:'5655',sound:false,duration:2,resultSeconds:2})}}};
 await page.goto(newBase+'/widget-overlay.html?type=actionwheel');await page.waitForTimeout(300);
 const giftAt=Date.now();state.activities=[{id:'traffic-wheel',type:'gift',giftId:'5655',count:1,coins:1,username:'qa',createdAt:Date.now(),actionWheelIndex:0}];
 await page.locator('.wheel-face').waitFor({timeout:2000});const giftLatency=Date.now()-giftAt;assert.ok(giftLatency<1500);
 await page.locator('.result-panel').waitFor();await page.locator('.result-panel').waitFor({state:'detached',timeout:7000});
 const pk={battleId:'qa',status:'active',endsAt:Date.now()+60000,wins:{left:1,right:2},players:[{id:'a',username:'one',score:10},{id:'b',username:'two',score:20}],teams:[{id:'left',memberIds:['a'],score:10},{id:'right',memberIds:['b'],score:20}]};
 state={channel,studio:{settings:{pk:normalize('pk',{sound:false})},pk}};
 await page.goto(newBase+'/widget-overlay.html?type=pk');await page.locator('.team-member').first().waitFor();assert.equal(await page.locator('.team-member').count(),2);
 pk.players[0].score=777;pk.teams[0].score=777;await page.getByText('777',{exact:true}).first().waitFor({timeout:2000});
 await page.goto(newBase+'/tikmng/media?channel='+channel);await page.waitForTimeout(300);
 const mediaBefore={...category('overlay-media')};media.ingest('gift',{giftId:'5655',eventId:'video-first'});
 await page.locator('video').waitFor();await page.locator('video').evaluate(video=>window.__firstVideo=video);
 await page.waitForFunction(()=>window.__firstVideo.buffered.length&&window.__firstVideo.buffered.end(0)>=1.45);
 await page.locator('video').waitFor({state:'detached',timeout:5000});const afterFirst={...category('overlay-media')};assert.ok(afterFirst.bodyBytes>mediaBefore.bodyBytes);
 media.ingest('gift',{giftId:'5655',eventId:'video-second'});await page.locator('video').waitFor();assert.equal(await page.locator('video').evaluate(video=>video===window.__firstVideo),true,'A fully buffered native video is reused');
 await page.locator('video').waitFor({state:'detached',timeout:5000});const afterSecond=category('overlay-media');assert.equal(afterSecond.bodyBytes,afterFirst.bodyBytes,'Second play does not transfer the video again');
 await page.goto('about:blank');await page.waitForTimeout(100);assert.ok(feeds.every(feed=>feed.pending()===0));assert.deepEqual(errors,[]);
 const result={passed:true,realBrowser:true,realWebSocketRelay:true,localOnlyNoRenderTraffic:true,intervalMs:12000,old,current,stateBodyReductionPercent:Number((reduction*100).toFixed(2)),giftLatencyMs:giftLatency,pkScoreUpdates:true,videoFirstBodyBytes:afterFirst.bodyBytes-mediaBefore.bodyBytes,videoSecondBodyBytes:afterSecond.bodyBytes-afterFirst.bodyBytes,nativeVideoElementReused:true,timerContinuesLocally:true,errors};
 fs.writeFileSync(path.join(out,'traffic.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();for(const close of resources.reverse())await close();});
