'use strict';
const {app,BrowserWindow,desktopCapturer,dialog}=require('electron');
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict'),{setTimeout:wait}=require('timers/promises');
const appRoot=process.env.RING_QA_APP_ROOT || (process.env.RING_QA_INSTALLED==='1'?'D:/TikMnG/Hediye-Box-Private/desktop-app/resources/app':path.resolve(__dirname,'..'));
const evidence=path.join(__dirname,'posture-0018');
fs.mkdirSync(evidence,{recursive:true});
const arena=require(path.join(appRoot,'assets/ring-layout.js'));
const nativeSource=fs.readFileSync(path.join(appRoot,'tools/spectator-native.js'),'utf8');
const minimumStrikeInterval=['punchMotionMs','punchRecoveryMs'].reduce((sum,key)=>
 sum+Number(nativeSource.match(new RegExp('const '+key+'=(\\d+);'))[1]),0);
const matchMotion=require('./fighting-motion.cjs').fightingMotion();
function cornerError(root,side){
 const offset=(side?-1:1)*(arena.halfRing-arena.cornerInset);
 return Math.hypot(root[0]-arena.centerX-offset,root[1]+arena.centerZ-offset);
}
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'ring-video-0017-'));
app.setPath('appData',profile);dialog.showErrorBox=(t,e)=>console.error(t,e);
let events,native,window,failed=false,busy=false,monitor,stage='boot';
const rows=[],diagnostics=[],screens=[],hits=[],strikeStarts=[];
const unexpectedWindows=[];
let panelAllowed=false;
app.on('browser-window-created',(_event,view)=>{
  view.on('show',()=>{if(!panelAllowed)unexpectedWindows.push(view.getTitle());});
});
const entry=require(path.join(appRoot,'src/desktop-controller.cjs'));
entry.DesktopController=class extends entry.DesktopController{constructor(options){super({...options,createLive:()=>({close(){}})});events=options;}};
const adapter=require(path.join(appRoot,'src/native-spectator.cjs'));
adapter.NativeSpectator=class extends adapter.NativeSpectator{constructor(...args){super(...args);native=this;this.on('diagnostic',d=>diagnostics.push(d));this.on('hit',hit=>hits.push(hit));this.on('punch',punch=>strikeStarts.push(punch.simulationMs));}};
require(path.join(appRoot,'main.cjs'));
async function state(){return window.webContents.executeJavaScript('window.hediyeBox.getState()');}
async function until(fn,label,ms=30000){const end=Date.now()+ms;while(Date.now()<end){const s=await state();if(s.spectator.phase==='error')throw Error(s.spectator.error);if(await fn(s))return s;await wait(100);}throw Error(label);}
const pressP=()=>window.webContents.executeJavaScript("document.dispatchEvent(new KeyboardEvent('keydown',{key:'p',bubbles:true,cancelable:true}))");
const join=id=>events.onChat({userId:id,nickname:id,eventId:id,comment:'KATIL'});
async function capture(name){if(process.env.RING_QA_NO_SCREENSHOTS==='1')return;const sources=await desktopCapturer.getSources({types:['window'],thumbnailSize:{width:1280,height:720}});const game=sources.find(s=>s.name==='Online Boxing 3D');if(game){const file=path.join(evidence,name+'.png');fs.writeFileSync(file,game.thumbnail.toPNG());screens.push(file);}}
async function run(){await app.whenReady();for(let i=0;i<100;i++){window=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/spectator/index.html'));if(window&&!window.webContents.isLoading())break;await wait(100);}
await until(s=>s.spectator.phase==='waiting','empty ring');
if(process.env.RING_QA_STARTUP_ONLY==='1'){
 await wait(400);
 const sources=await desktopCapturer.getSources({types:['window'],thumbnailSize:{width:0,height:0}});
 assert.equal(sources.filter(s=>s.name==='Online Boxing 3D').length,1,'One visible native game window');
 assert.deepEqual(unexpectedWindows,[],'No auxiliary window appeared during launch');
 assert.ok(BrowserWindow.getAllWindows().every(view=>!view.isVisible()),'All auxiliary windows remain hidden');
 panelAllowed=true;
 await window.webContents.executeJavaScript('window.hediyeBox.setPanelOpen(true)');
 assert.ok(window.isVisible(),'Settings can be shown on demand');
 await window.webContents.executeJavaScript('window.hediyeBox.setPanelOpen(false)');
 assert.ok(!window.isVisible(),'Settings hide after close');
 console.log('Startup presents one native game window. Settings show only on demand.');
 return;
}
monitor=setInterval(async()=>{
 if(busy||!native)return;
 busy=true;
 try{
   const s=await native.command('sample');
   matchMotion.sample(s);
   rows.push({stage,at:Date.now(),time:s.motion?.sampleTime??s.simulationSeconds,
     phase:s.phase,health:s.health,heads:s.rawHeadWorld,angles:s.facingErrorDeg,
     inputCodes:s.inputCodes,nativeInputs:s.nativeInputs,inputPolicy:s.inputPolicy,strikeActive:s.strikeActive,
     hands:s.hands,handsDepth:s.handsDepth,nativeDown:s.nativeDown,guardRepairs:s.guardRepairs,
     pendingPunches:s.punches?.map(p=>p.pending),rootDistance:s.rootDistance,...s.motion});
 }catch{}finally{busy=false;}
},100);
join('red');join('blue');await until(s=>s.spectator.health.every(h=>h===1),'two entrants');
const {settings}=(await state()).audience;
const testSettings={...settings,punchSource:'all',punchGiftIdLeft:'5655',punchGiftIdRight:'5269',
 likeThreshold:10,likePunchCount:1,likeDamage:1,giftDamage:{...settings.giftDamage,'5655':1,'5269':1}};
await window.webContents.executeJavaScript('window.hediyeBox.configureAudience('+JSON.stringify(testSettings)+')');
const manualResetOnly=process.env.RING_QA_MANUAL_RESET==='only';
const fpsOnly=process.env.RING_QA_FPS_ONLY==='1';
const roundLimit=manualResetOnly||fpsOnly?0:Number(process.env.RING_QA_ROUNDS||4);
assert.ok(manualResetOnly||fpsOnly||Number.isSafeInteger(roundLimit)&&roundLimit>=2&&roundLimit<=30);
for(let round=0;round<roundLimit;round++){
 stage='waiting-'+round;await wait(round===0?3000:850);const before=await native.command('sample');
 assert.ok(before.motion.roots.every((r,i)=>cornerError(r,i)<.08),'Fixed opposite corners');
 if(before.neutralFeet)assert.ok(before.torsoLeans?.every(angle=>angle<27),'Stage guard is already bent at the waist');
 if(process.env.RING_QA_GUARD_MOTION==='1')
   assert.ok(before.hands.every(pair=>Math.hypot(...pair[0].map((v,k)=>v-pair[1][k]))<1.8),
     'The corner pose staged open arms');
 await capture('corners-'+round);await pressP();await until(s=>s.spectator.phase==='fighting','P start');stage='fight-'+round;
 const previousHits=hits.length;
 const firstStrike=strikeStarts.length;
 await until(async()=>{const s=await native.command('sample');return s.inReach;},'Native boxers approached without viewer input',35000);
 assert.equal(hits.length,previousHits,'No scoring from autonomous punches');
 await capture('moving-'+round);
 const {active: fighters}=(await state()).audience;
 const asViewer=key=>({id:fighters[key].id,userId:fighters[key].userId,nickname:fighters[key].nickname});
 if(process.env.RING_QA_HUNDRED==='1'&&round===roundLimit-1){
   const streak=(count,suffix,repeatEnd=false)=>({...asViewer('left'),giftId:'5655',
     eventId:'hundred-'+suffix,giftType:1,streakId:'final-hundred',repeatCount:count,repeatEnd,coinUnit:1});
   events.onGiftRaw(streak(5,'first'));
   events.onGiftRaw(streak(20,'next'));
   events.onGiftRaw(streak(100,'last'));
   events.onGiftRaw(streak(100,'end',true));
   events.onGiftRaw(streak(20,'late'));
   await until(()=>hits.length>=previousHits+100,'100 separate cumulative-streak punches',185000);
   assert.equal(hits.length,previousHits+100,'A cumulative gift streak duplicated a hit');
   assert.ok(hits.slice(previousHits).every(hit=>hit.defender===1&&hit.damage===1));
   assert.equal(strikeStarts.length-firstStrike,100);
   const starts=strikeStarts.slice(firstStrike);
   assert.ok(starts.slice(1).every((value,i)=>value-starts[i]>=minimumStrikeInterval),'Gift streak bypassed recovery timing');
   await capture('hundred-gifts');
   stage='ko-'+round;
   await until(s=>s.spectator.phase==='waiting'&&s.audience.active.right===null,'Streak KO and winner return',45000);
   const winner=await native.command('sample');
   assert.ok(cornerError(winner.motion.roots[0],0)<.08,'Streak winner returns to own corner');
   join('challenger-'+round);await until(s=>s.spectator.health.every(h=>h===1),'Post-streak replacement');
   assert.equal(hits.length,previousHits+100,'An old gift hit the next challenger');
   console.log('100 cumulative gifts produced exactly 100 separate hits; duplicate/end/late frames added none.');
   console.log('Round transition',round+1);
   continue;
 }
 const giftCorner=round===0?'left':'right';
 const likeCorner=round===0?'right':'left';
 const giftId=round===0?'5655':'5269';
 events.onGiftRaw({...asViewer(giftCorner),eventId:'gift-'+round,giftId,coinUnit:1,repeatCount:2});
 events.onLike({...asViewer(likeCorner),eventId:'like-a-'+round,likeCount:9,isDelta:true});
 events.onLike({...asViewer(likeCorner),eventId:'like-b-'+round,likeCount:1,isDelta:true});
 events.onLike({...asViewer(likeCorner),eventId:'like-c-'+round,likeCount:10,isDelta:true});
 await until(s=>s.spectator.health.every(h=>h===.98),'Gift and like batches did not score twice per corner',27000);
 const trace=await native.command('sample');
 console.log('Native physics steps and largest unexplained displacement:',trace.traceSteps,trace.maxTraceError);
 console.log('Native stun prevented before KO:',trace.nativeStunPeaks);
 console.log('Original native punch keyframes:',trace.originalPunchFrames);
 assert.ok(trace.traceSteps>100&&trace.maxTraceError<.025,'Live root movement discontinuity');
 assert.equal(hits.length,previousHits+4);
 assert.equal(hits.slice(previousHits).filter(hit=>hit.defender===0).length,2);
 const starts=strikeStarts.slice(firstStrike);
 if(starts.every(Number.isFinite)){
   assert.equal(starts.length,4);
   const delays=starts.slice(1).map((time,i)=>time-starts[i]);
   assert.ok(delays.every(delay=>delay>=minimumStrikeInterval),'Punches overlapped the allowed recovery');
   console.log('Punch start intervals (simulation milliseconds):',delays.map(Math.round));
 }
 await capture('contact-'+round);
 if(process.env.RING_QA_HIT_TIMING==='1'){
   const hud=BrowserWindow.getAllWindows().find(view=>view.webContents.getURL().endsWith('/native-hud/index.html'));
   assert.ok(hud,'The native game HUD must be loaded');
   const frame=hud.webContents.mainFrame.frames.find(frame=>frame.url.endsWith('/spectator/index.html'));
   assert.ok(frame,'The in-game HUD iframe must be loaded');
   const bars=await frame.executeJavaScript(`Array.from(document.querySelectorAll('.health-fill'),fill=>({
     transition:getComputedStyle(fill).transitionDuration,transform:getComputedStyle(fill).transform,
     health:fill.parentElement.getAttribute('aria-valuenow')}))`);
   assert.equal(bars.length,2);
   assert.ok(bars.every(bar=>bar.transition==='0s'&&bar.health==='98'&&bar.transform.startsWith('matrix(0.98,')),
     'The captured game HUD must show the current HP without a delayed shrink');
   console.log('Both in-game health bars show 98 HP without a transform transition.');
 }
 const swings=rows.filter(row=>row.stage==='fight-'+round&&row.strikeActive&&row.hands);
 const gloveMotion=[0,1].map(side=>{
   const distances=swings.flatMap(row=>row.hands[side].map(hand=>
     Math.hypot(...hand.map((value,axis)=>value-row.heads[side][axis]))));
   return Math.max(...distances)-Math.min(...distances);
 });
 console.log('Native glove motion relative to the head:',gloveMotion);
 assert.ok(gloveMotion.every(distance=>Number.isFinite(distance)&&distance>.25),'A native punch did not move the gloves');
 if(process.env.RING_QA_GUARD_MOTION==='1'){
   const from=await native.command('sample'),observations=[];
   for(let n=0;n<65;n++){await wait(100);observations.push(await native.command('sample'));}
   const travel=[0,1].map(side=>observations.reduce((sum,s,i)=>{
     const previous=i?observations[i-1]:from;
     return sum+Math.hypot(s.motion.roots[side][0]-previous.motion.roots[side][0],
       s.motion.roots[side][1]-previous.motion.roots[side][1]);
   },0));
   const openArms=observations.map(s=>s.hands.map(pair=>Math.hypot(...pair[0].map((v,k)=>v-pair[1][k]))));
   console.log('Post-hit native travel and widest glove separation:',travel,
     [0,1].map(side=>Math.max(...openArms.map(spans=>spans[side]))));
   if(observations[0].handsDepth){
     const forward=[0,1].map(side=>{
       const depth=observations.map(s=>Math.min(...s.handsDepth[side])).sort((a,b)=>a-b);
       return depth[Math.floor(depth.length*.1)];
     });
     console.log('Post-hit glove depth in front of the chest (10th percentile):',forward);
     assert.ok(forward.every(depth=>depth>-.25),'A glove stayed behind the boxer after the punch');
   }
   await capture('post-hit-guard-'+round);
   assert.ok(travel.every(distance=>distance>.20),'A boxer stopped native footwork after viewer punches');
   for(const side of [0,1]){
     const typical=openArms.map(spans=>spans[side]).sort((a,b)=>a-b)[Math.floor(openArms.length/2)];
     assert.ok(typical<1.9,'A boxer stayed with both arms extended after viewer punches');
   }
 }
 await native.punch({side:0,eventId:'low-red-'+round,count:1,damage:97});
 await native.punch({side:1,eventId:'low-blue-'+round,count:1,damage:97});
 await until(s=>s.spectator.health.every(h=>h===.01),'Both boxers can still strike with one HP',30000);
 await wait(1400);
 const lastGuard=await native.command('sample');
 assert.ok(lastGuard.rawHeadWorld.every((head,i)=>head[2]-lastGuard.motion.roots[i][2]>.8),
   'A living boxer stopped holding the native guard at one HP');
 console.log('Both corners held their native guard with one HP.');
 const side=round%2;stage='ko-'+round;await native.punch({side,eventId:'ko-'+round,count:1,damage:100});
 await until(s=>s.spectator.phase==='waiting'&&s.audience.active[side===0?'right':'left']===null,'KO and winner return',45000);
 const winner=await native.command('sample');assert.ok(cornerError(winner.motion.roots[side],side)<.08,'Winner returns to own corner');
 join('challenger-'+round);await until(s=>s.spectator.health.every(h=>h===1),'replacement');console.log('Round transition',round+1);
}
if(!manualResetOnly&&!fpsOnly){
const active=rows.filter(r=>r.stage.startsWith('fight-'));
assert.ok(active.every(row=>row.nativeDown?.every((down,side)=>!row.health[side]||down===0)),
 'A living boxer entered a native fallen/recovery state');
const exchanges=active.filter(row=>row.health.every(h=>h>0)&&row.health.some(h=>h<1));
const median=data=>data.sort((a,b)=>a-b)[Math.floor(data.length/2)];
const centerDistances=exchanges.map(({roots:[a,b]})=>Math.hypot((a[0]+b[0])/2-arena.centerX,
 (a[1]+b[1])/2+arena.centerZ));
const gaps=exchanges.map(({roots:[a,b]})=>Math.hypot(a[0]-b[0],a[1]-b[1]));
const rates=[[],[]];
let maxTravelSpeed=0;
for(let i=1;i<rows.length;i++){
 const previous=rows[i-1],current=rows[i];
 if(previous.phase!=='fighting'||current.phase!=='fighting'||current.stage!==previous.stage)continue;
 if(!current.health.every(h=>h>0)||!previous.health.every(h=>h>0))continue;
 const dt=current.time-previous.time;
 if(!(dt>0))continue;
 const wall=(current.at-previous.at)/1000;
 if(wall>.06&&wall<.22&&current.strikeActive===previous.strikeActive)
   rates[Number(Boolean(current.strikeActive))].push(dt/wall);
 current.roots.forEach(([x,y],side)=>{
  const from=previous.roots[side];
  maxTravelSpeed=Math.max(maxTravelSpeed,Math.hypot(x-from[0],y-from[1])/dt);
 });
}
console.log('Fastest measured horizontal travel:',maxTravelSpeed.toFixed(2));
console.log('Median fight spacing, center drift, and physics rates:',JSON.stringify({
 spacing:median(gaps),centerDrift:median(centerDistances),betweenStrikes:median(rates[0]),duringStrikes:median(rates[1])}));
const movement=codes=>codes.filter(code=>code>=22&&code<=29);
for(const row of active.filter(r=>r.phase==='fighting')){
  for(const side of [0,1]){
    const original=movement(row.nativeInputs[side]),applied=movement(row.inputCodes[side]);
    // Input policy belongs to the sampled native vector. A strike can end
    // before telemetry reads the current clock, while that vector is unchanged.
    if(row.inputPolicy[side].plant)assert.equal(applied.length,0,'A walking target overlapped the native punch stance');
    else if(row.inputPolicy[side].closeForPunch)
      assert.deepEqual(applied,[22],'A pending out-of-range punch must use only native approach');
    else if(original.length)assert.deepEqual(applied,original,'An active native step changed');
    else assert.ok(applied.length<=1&&applied.every(code=>code>=22&&code<=25),'Unsupported idle footwork command');
  }
}
console.log('Motion across both matches:',JSON.stringify(matchMotion.report()));
let openArmStart=[null,null],openArmStage='',longestOpenArms=0;
for(const row of active){
 if(row.stage!==openArmStage){openArmStart=[null,null];openArmStage=row.stage;}
 for(let side=0;side<2;side++){
  const open=row.health[side]>0&&row.hands&&Math.hypot(...row.hands[side][0].map((v,i)=>v-row.hands[side][1][i]))>3.2;
  if(!open){openArmStart[side]=null;continue;}
  openArmStart[side]??=row.time;
  longestOpenArms=Math.max(longestOpenArms,row.time-openArmStart[side]);
 }
}
console.log('Longest extended-arm anomaly (simulation seconds):',longestOpenArms);
assert.ok(longestOpenArms<.15,'A living boxer stayed in a T-pose');
assert.ok(matchMotion.report().longestLean<.5,'A living boxer stayed folded');
assert.ok(matchMotion.report().maxShoeOverHip!==null&&matchMotion.report().maxShoeOverHip<.30,
 'A shoe passed a living boxer’s hips during a strike');
assert.ok(matchMotion.report().longestHighStep<.2,'A high shoe lingered during close footwork');
assert.ok(Number.isFinite(maxTravelSpeed)&&maxTravelSpeed>0,'No measured game movement');
assert.ok(active.length>150);
assert.ok(active.every(r=>r.heads.every(h=>h.every(Number.isFinite)&&h[2]<2.6)&&r.roots.every(root=>Math.abs(root[0]-arena.centerX)<arena.halfRing+.2&&Math.abs(root[1]+arena.centerZ)<arena.halfRing+.2)),'No airborne or out-of-ring fighter');
assert.ok(active.some(r=>r.inputCodes?.some(codes=>codes.includes(22))),'Original AI supplied forward movement');
assert.ok(!diagnostics.some(d=>/NaN|huge value|unstable|panic/i.test(d.text||'')),'No unstable physics warning');
console.log(roundLimit+' full-app bouts, fixed corners, KO, winner and challenger passed.');
}
if(manualResetOnly||process.env.RING_QA_MANUAL_RESET==='1'){
 stage='manual-reset';
 join('reserve-1');join('reserve-2');
 await pressP();await until(s=>s.spectator.phase==='fighting','Start before manual P reset');
 await native.punch({side:0,count:20,damage:1,eventId:'discard-this-batch'});
 await pressP();
 await until(s=>s.spectator.phase==='waiting'&&s.audience.active.right?.userId==='reserve-1'&&
   s.audience.active.left?.userId==='reserve-2','Both queued players must take the corners after P');
 await wait(500);
 const reset=await native.command('sample');
 assert.deepEqual(reset.health,[1,1]);
 assert.ok(reset.torsoLeans.every(angle=>angle<27),'Reset corners are bent before the new bell');
 assert.ok(reset.punches.every(punch=>punch.pending===0&&punch.issued===0),'Old punches survived P');
 await pressP();await until(s=>s.spectator.phase==='fighting','New match after manual P reset');
 const oldHits=hits.length;
 await until(async()=>{const s=await native.command('sample');return s.inReach;},'Post-reset approach',35000);
 assert.equal(hits.length,oldHits,'An old order landed after the reset');
 await native.punch({side:1,count:1,damage:1,eventId:'first-post-reset'});
 await until(s=>s.spectator.health[0]===.99,'First post-reset hit');
 assert.equal(hits.length,oldHits+1);
 console.log('Manual P reset staged the queue, cleared old strikes and started the new match.');
 if(manualResetOnly)return;
}
if(process.env.RING_QA_FPS==='1'){
 stage='queue-fps';
 const identity=name=>({userId:name,uniqueId:name,nickname:name});
 let fpsEventSequence=0;
 const fire=(kind,name,extra={})=>events[kind]({...identity(name),eventId:'fps-'+kind+'-'+name+'-'+(++fpsEventSequence),...extra});
 const fpsSettings={...(await state()).audience.settings,followJoin:true,likeJoin:true,likeJoinThreshold:100};
 await window.webContents.executeJavaScript('window.hediyeBox.configureAudience('+JSON.stringify(fpsSettings)+')');
 join('fps-commenter');fire('onFollow','fps-follower');
 fire('onLike','fps-liker',{likeCount:99,isDelta:true});
 fire('onLike','fps-liker',{likeCount:501,isDelta:true});
 fire('onGiftRaw','fps-commenter',{giftId:'5655',repeatCount:2,coinUnit:1});
 const expected=[['fps-liker',6],['fps-follower',5],['fps-commenter',2]];
 await until(s=>JSON.stringify(s.audience.queue.filter(p=>p.userId.startsWith('fps-')).map(p=>[p.userId,p.fps]))===JSON.stringify(expected),'Updated FPS priority');
 const query=`[...document.querySelectorAll('#queue-list li')].filter(r=>r.textContent.includes('fps-')).map(r=>[r.querySelector('.queue-name').textContent,r.querySelector('.queue-coins').textContent])`;
 const want=expected.map(([name,fps])=>[name,fps+' FPS']);
 await until(async()=>JSON.stringify(await window.webContents.executeJavaScript(query))===JSON.stringify(want),'Queue panel FPS text');
 const hud=BrowserWindow.getAllWindows().find(view=>view.webContents.getURL().endsWith('/native-hud/index.html'));
 assert.ok(hud,'Game HUD exists');
 const frame=hud.webContents.mainFrame.frames.find(frame=>frame.url.endsWith('/spectator/index.html'));
 assert.ok(frame,'Game HUD embeds the queue');
 await until(async()=>JSON.stringify(await frame.executeJavaScript(query))===JSON.stringify(want),'In-game FPS text');
 assert.ok(!hud.isVisible(),'The game HUD must not open an auxiliary window');
 console.log('Installed queue and in-game HUD show likes 6 FPS, first follow 5 FPS and gift 2 FPS in order.');
}

}
run().catch(async e=>{failed=true;console.error(e.stack);if(native)console.error(JSON.stringify(await native.command('sample').catch(()=>null)));}).finally(async()=>{clearInterval(monitor);await native?.close();fs.writeFileSync(path.join(evidence,'full-app.json'),JSON.stringify({passed:!failed,rows,diagnostics,screens}));app.exit(failed?1:0);});
