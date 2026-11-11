'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {setTimeout:wait}=require('node:timers/promises');
const [root,project]=process.argv.slice(2);
const qa=path.join(root,'qa');
const runtime=path.join(qa,'runtime');
const control=path.join(qa,'control');
process.env.MNG_FORZA_QA_CONTROL=control;
const {sendAndWait}=require(path.join(project,'tests/command.cjs'));
const {inspectAudioSample}=require(path.join(project,'tests/qa-vehicle-audio.cjs'));
const settings=path.join(control,'settings.json');
fs.writeFileSync(settings,JSON.stringify({EconomyVersion:7,DynamicsVersion:1,Laps:1,LikeThreshold:100,LikeSpeedGain:10,GiftSpeedPerCoin:10,FullscreenWindow:false,TargetFrameRate:60}));
const child=spawn(path.join(runtime,'iracing-arcade.exe'),['-screen-fullscreen','0','-screen-width','1280','-screen-height','800'],{cwd:runtime,stdio:'ignore'});
function read(){
 try{
  const state=JSON.parse(fs.readFileSync(path.join(control,'status.json'),'utf8'));
  return state.pid===child.pid&&Date.now()-Date.parse(state.utc)<4000?state:null;
 }catch{return null;}
}
async function until(check,seconds,label){
 const deadline=Date.now()+seconds*1000;
 while(Date.now()<deadline){
  assert.equal(child.exitCode,null,label);
  const s=read();
  if(s&&check(s))return s;
  await wait(100);
 }
 throw Error(label+' / '+read()?.phase);
}
const racer=(state, name='likerqa')=>state.viewers.find(row=>row.Username===name);
const like=(name,eventId,likeCount)=>sendAndWait('live-event',{event:{type:'like',username:name,nickname:name,eventId,likeCount}});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
(async()=>{
 await until(s=>s.phase==='staging'&&s.viewers.length===0,90,'empty launch');
 await sendAndWait('board-qa',{run:'likes-and-esc-055'});
 await like('likerqa','first',59);
 let result=await like('likerqa','second',41);
 assert.equal(racer(result).TopSpeedKph,60);
 await like('likerqa','second',41);
 result=await like('likerqa','third',200);
 assert.equal(racer(result).TopSpeedKph,80);
 assert.equal(racer(result).Level,2);
 assert.equal(result.viewers.length,1);
 result=await like('likerqa','high',12000);
 assert.equal(racer(result).TopSpeedKph,1280);
 assert.equal(racer(result).Level,9);
 await like('nextqa','before-reset',59);
 const portraits=path.join(control,'live','portraits');
 fs.mkdirSync(portraits,{recursive:true});
 const avatarFile='tiktok-bridge-avatar-winner-qa.png';
 fs.copyFileSync(path.join(qa,'assets','logo.png'),path.join(portraits,avatarFile));
 const gift=(name,coins)=>sendAndWait('live-event',{event:{type:'gift',username:name,nickname:name,eventId:'car-'+name,coins,repeatCount:1}});
 await gift('secondqa',24);
 await gift('thirdqa',18);
 await gift('fourthqa',1);
 await sendAndWait('audio-meter',{enabled:true});
 await sendAndWait('test-race');
 const motion=await until(s=>s.phase==='racing'&&racer(s)?.speed>2,32,'manual start');
 const open=await sendAndWait('sound-settings');
 assert.equal(open.vehicleAudio.settingsOpen,true);
 const moved=await until(s=>s.phase==='racing'&&s.timeScale===1&&s.vehicleAudio.settingsOpen
   &&racer(s)?.speed>2&&distance(racer(motion).position,racer(s).position)>8
   &&!inspectAudioSample(s,{expectOutput:true}).issues.length,18,'moving with engine audio during settings');
 const closed=await sendAndWait('sound-settings');
 assert.equal(closed.vehicleAudio.settingsOpen,false);
 await until(s=>s.phase==='racing'&&s.timeScale===1&&racer(s)?.speed>2
   &&distance(racer(moved).position,racer(s).position)>8,16,'motion after saving settings');
 await wait(250);
 assert.equal(JSON.parse(fs.readFileSync(settings)).LikeThreshold,100);
 await sendAndWait('map-follow',{username:'fourthqa'});
 await until(s=>s.phase==='racing'&&s.following==='fourthqa',9,'following the fourth car');
 const arrival=await until(s=>s.phase==='podium',115,'automatic third-finisher results');
 assert.equal(arrival.roundEndReason,'top-three-finished');
 assert.equal(arrival.winners.length,3);
 assert.equal(arrival.cameraPresentation.crownVisible,true);
 assert.equal(arrival.cameraPresentation.crownColliders,0);
 assert.ok(arrival.cameraPresentation.transitionBlend<1,'camera blends from the followed car');
 assert.equal(arrival.winners[0].Username,arrival.cameraPresentation.winner);
 const winner=arrival.winners[0].Username;
 await sendAndWait('live-event',{event:{type:'avatar',username:winner,nickname:winner,avatarFile}});
 const orbit=await until(s=>s.phase==='podium'&&s.cameraPresentation.transitionBlend===1&&s.cameraPresentation.winnerHasPortrait,5,'first finisher portrait and settled orbit');
 const movingOrbit=await until(s=>s.phase==='podium'&&distance(orbit.camera,s.camera)>.3,3,'camera orbits after transition');
 assert.equal(movingOrbit.winners[0].Avatar,avatarFile);
 await until(s=>s.phase==='staging'&&s.round===motion.round+1&&s.viewers.length===0,42,'clean next round');
 result=await like('nextqa','after-reset',41);
 assert.equal(racer(result,'nextqa').TopSpeedKph,60);
 assert.equal(result.viewers.length,1);
 const report={passed:true,likes300Kph:80,likes300ModelLevel:2,highLikesKph:1280,settingsOpenMotion:true,motorAudio:true,saveCloseMotion:true,cleanNextRound:true,partialLikesSurviveRound:true,thirdFinisherTriggers:true,blendedWinnerCamera:true,winnerCrownAndPortrait:true};
 fs.writeFileSync(path.join(root,'native-055.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{
 try{await sendAndWait('quit',{},2500);}catch{}
 if(child.exitCode===null)child.kill();
});
