'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {frames}=require('../lib/portrait-frames.cjs'),{normalize}=require('../lib/widget-studio.cjs'),{createEntryVideos}=require('../lib/entry-videos.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa/713'),key='q'.repeat(32),values=new Map();fs.mkdirSync(out,{recursive:true});
const source=path.join(out,'intro.mp4');execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=160x96:rate=15','-t','1.5','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','-y',source],{windowsHide:true});
const service=createEntryVideos({store:{get:(k,d)=>values.get(k)||d,set:(k,v)=>values.set(k,structuredClone(v))},root:path.join(out,'media'),accessKey:key,getChannel:()=> 'qa'});
let server,browser,state={},origin;const errors=[],results={};
async function main(){
 const asset=await service.importAsset(source),item=service.save({username:'viewer',assetId:asset.id,title:'Test videosu'});
 server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/tikmng/media')){service.handleRequest(req,res,url);return;}
  if(url.pathname==='/api/widget/state'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(state));return;}
  const name=path.basename(url.pathname);let file,mime='text/html';
  if(url.pathname==='/fixture'){res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="workspaceRoot"><main id="body"></main></div></body></html>');return;}
  if(url.pathname==='/widget'){file=path.join(root,'renderer/widgets',url.searchParams.get('type')==='pk'?'live-score-widgets.html':['raconking','streambeauty','streamhandsome'].includes(url.searchParams.get('type'))?'royal-widgets.html':'reference-widgets.html');}
  else if(name==='matter.js'){file=require.resolve('matter-js/build/matter.min.js');mime='text/javascript';}
  else if(url.pathname.startsWith('/widget/gift-assets/')){file=path.join(root,'renderer/widgets/royal-assets',name);if(!fs.existsSync(file))file=path.join(root,'renderer/gift-assets',name);if(!fs.existsSync(file))file=path.join(root,'renderer/assets',name);mime=name.endsWith('.webp')?'image/webp':'image/png';}
  else{file=path.join(root,'renderer/widgets',name);mime='text/javascript';}
  if(!file||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',mime);res.end(mime==='text/html'?fs.readFileSync(file,'utf8').replace('/*PORTRAIT_FRAME_CATALOG*/[]',JSON.stringify(frames)):fs.readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext({viewport:{width:900,height:600}});await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const rows=Array.from({length:9},(_,i)=>({username:'viewer'+i,nickname:'Destekci '+i,avatar:'/widget/gift-assets/5655.png',totalLikes:1000-i*50,totalCoins:1000-i*50}));
 for(const type of ['topliker','topgifter']){
  state={topLikes:rows.map(r=>({...r})),topGifters:rows.map(r=>({...r})),studio:{settings:{[type]:normalize(type,{title:'Canli destekciler',sound:false})}}};
  await page.goto(origin+'/widget?type='+type);await page.locator('.podium').waitFor();
  await page.evaluate(()=>{window.__rankList=document.querySelector('.rank-list');window.__firstPortrait=document.querySelector('[data-rank-person="viewer0"] .portrait');});
  state[type==='topliker'?'topLikes':'topGifters'][0][type==='topliker'?'totalLikes':'totalCoins']=100001;
  await page.waitForFunction(()=>document.querySelector('.rank-amount')?.textContent==='100.001');
  assert.equal(await page.evaluate(()=>window.__firstPortrait===document.querySelector('[data-rank-person="viewer0"] .portrait')),true,'Portrait DOM retained');
  assert.equal(await page.evaluate(()=>window.__rankList===document.querySelector('.rank-list')),true,'Only counters update when ranks stay unchanged');
  const geometry=await page.locator('.rank-row').first().evaluate(n=>{const a=n.querySelector('b').getBoundingClientRect(),b=n.querySelector('small').getBoundingClientRect();return {gap:b.left-a.right,overlap:a.right>b.left,width:n.getBoundingClientRect().width};});
  assert.ok(!geometry.overlap&&geometry.gap<=12,JSON.stringify(geometry));
  await page.screenshot({path:path.join(out,type+'.png'),omitBackground:true});results[type]={stablePortrait:true,geometry};
 }
 state={channel:'connected',studio:{settings:{pk:normalize('pk',{leftTop:'partner'})},pk:{status:'active',players:[{id:'1',username:'rival1',score:50},{id:'2',username:'rival2',score:70},{id:'3',username:'connected',score:80},{id:'4',username:'partner',score:100}].map(r=>({...r,avatar:'/widget/gift-assets/5655.png'})),teams:[{id:'rival',memberIds:['1','2'],score:120},{id:'own',memberIds:['3','4'],score:180}],wins:{own:2}}}};
 await page.setViewportSize({width:1080,height:1500});await page.goto(origin+'/widget?type=pk');await page.locator('.team-member').first().waitFor();
 assert.equal(await page.locator('.left-team').getAttribute('data-team'),'own');assert.equal(await page.locator('.left-team .team-member').first().getAttribute('data-person'),'4');
 for(const size of [{width:1080,height:1500},{width:360,height:740}]){await page.setViewportSize(size);await page.screenshot({path:path.join(out,'pk-'+size.width+'.png'),omitBackground:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 results.pk={broadcasterLeft:true,manualTopSlot:true,mobileFits:true};
 state={activities:[],studio:{settings:{actionwheel:normalize('actionwheel',{giftId:'5655',duration:2,resultSeconds:2,sound:false})}}};
 await page.setViewportSize({width:900,height:600});await page.goto(origin+'/widget?type=actionwheel');await page.waitForTimeout(100);
 assert.equal(await page.locator('#content').textContent(),'');
 await page.evaluate(()=>{receive({id:'wrong',type:'gift',giftId:'999',coins:1,createdAt:Date.now()});receive({id:'chat',type:'chat',message:'!wheel',createdAt:Date.now()});if(queue.length)throw Error('Wrong wheel trigger');receive({id:'right',type:'gift',giftId:'5655',coins:1,username:'viewer',createdAt:Date.now()});});
 await page.locator('.wheel-face').waitFor();await page.locator('.result-panel').waitFor();await page.screenshot({path:path.join(out,'wheel.png'),omitBackground:true});await page.locator('.result-panel').waitFor({state:'detached',timeout:6000});
 assert.equal(await page.evaluate(()=>document.querySelector('canvas').getContext('2d').getImageData(450,275,1,1).data[3]),0);results.wheel={selectedGiftOnly:true,hiddenBeforeAndAfter:true};
 state={studio:{settings:{coinjar:normalize('coinjar',{sound:false})}}};await page.goto(origin+'/widget?type=coinjar');await page.waitForFunction(()=>!!window.__widgetDiagnostics);
 const sizes=await page.evaluate(async()=>{await new Promise(r=>{const t=setInterval(()=>{if(physics){clearInterval(t);r();}},10);});let n=0;for(const [id,unitCoins,count]of [['one',1,1],['five',5,1],['many',1,501],['large',10000,1]]){drop({id,type:'gift',unitCoins,coins:unitCoins*count,count:1,createdAt:Date.now()});spawnJarGift(performance.now()+10000+n++*100);}return [...physicsEntries.values()].map(e=>[e.event.id,e.visualRadius]);});
 const sizesMap=Object.fromEntries(sizes);assert.ok(sizesMap.five>sizesMap.one);assert.equal(sizesMap.one,sizesMap.many);assert.ok(sizesMap.large<=32);results.jar={sizes:sizesMap};
 for(const theme of ['wings','storm','flame']){
  state={topGift:{username:'viewer',nickname:'Destekci',avatar:'/widget/gift-assets/5655.png',giftId:'5655',giftImage:'/widget/gift-assets/5655.png',coins:1000,count:1},studio:{settings:{topgift:normalize('topgift',{title:'Benim yayınım',frameTheme3:theme,sound:false})}}};
  await page.goto(origin+'/widget?type=topgift');await page.locator('.champion').waitFor();assert.equal(await page.locator('.champion').getAttribute('data-theme'),theme);await page.waitForTimeout(500);await page.screenshot({path:path.join(out,'viral-'+theme+'.png'),omitBackground:true});
 }results.themes=true;
 state={studio:{settings:{streambeauty:normalize('streambeauty',{title:'Yeni başlık'})},royalLeaders:{streambeauty:{id:'royal',username:'viewer',nickname:'Destekci',avatar:'/widget/gift-assets/5655.png',giftId:'5655'}}}};
  await page.goto(origin+'/widget?type=streambeauty');await page.waitForFunction(()=>document.querySelector('.title')?.getAttribute('aria-label')==='Yeni başlık');assert.equal(await page.locator('.owner-name').isVisible(),false);results.royal={customTitle:true,noExtraUsername:true};
 const live=await context.newPage();live.on('pageerror',e=>errors.push(e.message));await live.goto(origin+'/tikmng/media?key='+key+'&channel=qa&game=entry-videos');
 await page.goto(origin+'/fixture');await page.addStyleTag({path:path.join(root,'renderer/workspace.css')});await page.addStyleTag({path:path.join(root,'renderer/workspace-v3.css')});await page.addScriptTag({path:path.join(root,'renderer/entry-videos.js')});
 await page.exposeFunction('entrySnapshot',()=>({entryVideos:service.list(),entryVideoStatus:service.status(),entryVideoUrl:origin+'/tikmng/media?key='+key+'&channel=qa&game=entry-videos'}));
 await page.exposeFunction('entryCall',action=>{if(action==='entry-play'){service.play(item.id);return {entryVideos:service.list(),entryVideoStatus:service.status()};}throw Error(action);});
 await page.evaluate(async()=>{const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));window.ui=TikMnGEntryVideos.create({call:window.entryCall,icon:()=>'',esc,notify:()=>{},onSaved:data=>ui.update(data),giftMarkup:()=>'',chooseGift:()=>{}});ui.render(document.getElementById('body'),await entrySnapshot());});
 await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'Oynat',exact:true}).click();await live.locator('video').waitFor();const deadline=Date.now()+5000;while(service.list()[0].manualPending&&Date.now()<deadline)await page.waitForTimeout(50);assert.equal(service.list()[0].playedThisLive,false);assert.equal(service.list()[0].manualPending,false);results.entry={realVideoReachedExistingSource:true,automaticCooldownUnaffected:true};
 await page.evaluate(async()=>ui.update(await entrySnapshot()));await page.screenshot({path:path.join(out,'entry-desktop.png')});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'entry-mobile.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,...results,errors},null,2));console.log(JSON.stringify({passed:true,...results,errors}));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();service.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}});
