'use strict';
const {app,BrowserWindow,desktopCapturer,dialog}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {setTimeout:wait}=require('node:timers/promises');
const root=path.resolve(process.env.RING_QA_APP_ROOT||'work/ring-release-7038/game/Ring/resources/app');
const username=(process.argv[2]||'rasimbisakin').replace(/^@/,'').toLowerCase();
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ring-public-live-'));
app.setPath('appData',temp);process.env.TIKMNG_RING_DATA_DIR=path.join(temp,'saved');
process.env.TIKMNG_RING_GAME_SOURCE='D:/SteamLibrary/steamapps/common/OnlineBoxing3DDemo';
dialog.showErrorBox=(title,message)=>{throw Error(title+': '+message)};
let window,native,controller,origin='',failure,firstMatchingAt=0;
const report={schemaVersion:2,appVersion:require(path.join(root,'package.json')).version,username,startedAt:new Date().toISOString(),connected:false,locallySeated:0,matchingLiveGiftPackets:0,nativeHealthDecreased:false,displayedPortraits:0,visibleHealthBars:0,chatPackets:0,giftPackets:0,likePackets:0,acceptedLiveCommands:0,nativeHits:0,files:{},statusHistory:[]};
const entry=require(path.join(root,'src/desktop-controller.cjs'));
entry.DesktopController=class extends entry.DesktopController{constructor(options){
 const callbacks={...options};for(const [key,counter]of [['onChat','chatPackets'],['onGiftRaw','giftPackets'],['onLike','likePackets'],['onFollow','followPackets']])callbacks[key]=event=>{report[counter]=(report[counter]||0)+1;const old=origin;origin=key;try{return options[key]?.(event);}finally{origin=old}};
 super(callbacks);controller=this;this.on('state',({live})=>{report.connected ||= live.status==='connected';if(report.statusHistory.at(-1)!==live.status){report.statusHistory.push(live.status);console.log('Live',live.status);}});
}};
const adapter=require(path.join(root,'src/native-spectator.cjs'));
adapter.NativeSpectator=class extends adapter.NativeSpectator{constructor(...args){super(...args);native=this;this.on('hit',event=>{report.nativeHits++;if(firstMatchingAt&&Date.now()>=firstMatchingAt){report.nativeHealthDecreased=true;}});}
 async punch(command){const source=origin;const result=await super.punch(command);if(result.accepted&&source){report.acceptedLiveCommands+=command.count;if(source==='onGiftRaw'&&command.source==='gift'){report.matchingLiveGiftPackets++;firstMatchingAt=Date.now();console.log('Selected live gift accepted');}}return result;}
};
require(path.join(root,'main.cjs'));
const state=()=>window.webContents.executeJavaScript('window.hediyeBox.getState()');
const invoke=(method,value)=>window.webContents.executeJavaScript('window.hediyeBox.'+method+'('+JSON.stringify(value)+')');
async function until(fn,label,ms=45000){const end=Date.now()+ms;while(Date.now()<end){const s=await state();if(s.spectator.phase==='error')throw Error(s.spectator.error);if(await fn(s))return s;await wait(150);}throw Error(label);}
async function run(){
 await app.whenReady();for(let i=0;i<200;i++){window=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/spectator/index.html'));if(window&&!window.webContents.isLoading())break;await wait(100);}
 await until(s=>s.spectator.phase==='waiting','Portable startup');assert.ok(Object.values((await state()).audience.active).every(p=>!p));
 const initial=await state();await invoke('configureAudience',{...initial.audience.settings,participationMode:'both',followJoin:true,likeJoin:true,likeJoinThreshold:1,punchSource:'all',likeThreshold:100,likePunchCount:2,punchGiftIdLeft:'5269',punchGiftIdRight:'5655'});
 report.testSettings={likeThreshold:100,likePunchCount:2,blueGift:'5269',redGift:'5655'};
 await invoke('connect',username);await until(()=>report.connected,'LIVE connection');
 const end=Date.now()+150000;let started=false,lastChange=Date.now(),firstStart=true;
 while(Date.now()<end){
  const s=await state();if(s.spectator.phase==='error')throw Error(s.spectator.error);
  if(s.spectator.phase==='waiting'&&s.audience.active.left&&s.audience.active.right&&!started){
   if(firstStart){await wait(15000);firstStart=false;}
   await invoke('startMatch');started=true;lastChange=Date.now();console.log('Natural entrants started');
  }
  if(started&&Date.now()-lastChange>35000&&s.audience.queue.length>=2&&!report.matchingLiveGiftPackets){await invoke('startMatch');started=false;lastChange=Date.now();console.log('Manual P rotates the real queue');continue;}
  const hud=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/native-hud/index.html'));
  const frame=hud?.webContents.mainFrame.frames.find(f=>f.url.endsWith('/spectator/index.html'));
  if(frame){const shown=await frame.executeJavaScript(`({portraits:[0,1].filter(i=>{const n=document.getElementById('profile-'+i+'-image');return n&&!n.hidden&&n.complete&&n.naturalWidth>0}).length,bars:[0,1].filter(i=>!document.getElementById('health-'+i).hidden).length})`);report.displayedPortraits=Math.max(report.displayedPortraits,shown.portraits);report.visibleHealthBars=Math.max(report.visibleHealthBars,shown.bars);}
  if(report.matchingLiveGiftPackets&&report.nativeHealthDecreased&&report.displayedPortraits===2)break;
  if(s.spectator.phase==='waiting'&&started){started=false;}
  await wait(500);
 }
 const sources=await desktopCapturer.getSources({types:['window'],thumbnailSize:{width:1280,height:720}});const game=sources.find(s=>s.name==='Online Boxing 3D');
 if(game){fs.writeFileSync(path.resolve('work/ring-release-7038/qa/portable-live-native.png'),game.thumbnail.toPNG());report.gameCaptureImage=!game.thumbnail.isEmpty();}
 assert.ok(report.matchingLiveGiftPackets>0,'No selected live gift from an active fighter was observed in this window');
 assert.ok(report.nativeHealthDecreased&&report.displayedPortraits===2&&report.visibleHealthBars===2,'Live damage/portraits/HUD incomplete');
 const verifier=fs.readFileSync(path.join(__dirname,'../tests/verify-live-ring.ps1'),'utf8');
 for(const file of [...verifier.matchAll(/'((?:src|assets|tools|spectator|native-hud|broadcast)\/[^']+|main\.cjs|preload\.cjs)'/g)].map(m=>m[1]))report.files[file]=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex').toUpperCase();
 report.passed=true;
 fs.writeFileSync(path.join(__dirname,'live-ring-check.json'),JSON.stringify(report,null,2));
 console.log('Current package natural entry, portraits and selected gift-to-native contact verified.');
}
run().catch(error=>{failure=error;report.passed=false;report.error=error.message;console.error(error.stack);}).finally(async()=>{report.finishedAt=new Date().toISOString();await native?.close();controller?.close();fs.writeFileSync(path.resolve('work/ring-release-7038/qa/public-live-result.json'),JSON.stringify(report,null,2));app.exit(failure?1:0);});
