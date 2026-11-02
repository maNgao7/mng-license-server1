'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),q=require('./commands.cjs');
const saved=JSON.parse(fs.readFileSync('settings-before-0.1.7.json','utf8'));
const checks=[],captures=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function aim(id){
  const c=q.state().boardControls.find(c=>c.Id===id);assert.ok(c,id);
  const dx=10.4,dz=-c.x*.012,dy=4.65+c.y*.012-1.8;
  await q.send('view',{x:10,z:0,yaw:Math.atan2(dx,dz)*180/Math.PI,pitch:-Math.atan2(dy,Math.hypot(dx,dz))*180/Math.PI});
  await sleep(500);
}
async function snap(label){const s=await q.send('capture');captures.push({label,file:`capture-${s.seq}.png`});return s;}
async function restore(){
  await q.send('menu',{open:false});await q.send('reset');
  await q.send('crowd-settings',{total:saved.MaxCreatures,physical:saved.PhysicalCreatures,timed:saved.TimedMode,seconds:saved.RoundSeconds,target:saved.KillTarget,winGoal:saved.WinGoal});
  await q.send('lock',{enabled:false});await q.send('live-events-pause',{enabled:false});
}
async function main(){
  await q.wait(s=>s.ready&&!s.failed&&s.version==='0.1.7'&&Date.now()-fs.statSync('state.json').mtimeMs<2000,'0.1.7 startup',45000);
  await q.send('native-resume');await q.send('menu',{open:false});await q.send('lock',{enabled:true});await q.send('live-events-pause',{enabled:true});await q.send('reset');
  await q.send('crowd-settings',{timed:true,seconds:5,target:1000});
  assert.equal(q.state().boardControls.find(c=>c.Id==='pause').enabled,false);
  await aim('start');await q.send('board-click');assert.equal(q.state().challenge.phase,'Preparing');
  await aim('pause');let s=await q.send('board-click');assert.equal(s.challenge.IsPaused,true);
  const prep=s.challenge.remaining;
  await sleep(2200);s=await snap('preparation-paused');
  assert.equal(s.challenge.remaining,prep);assert.equal(s.challenge.phase,'Preparing');assert.equal(s.menu,false);
  checks.push('The physical pause button freezes preparation and remains usable without opening a menu');
  await q.send('challenge-start');assert.equal(q.state().challenge.IsPaused,true);assert.equal(q.state().challenge.remaining,prep);
  await q.send('board-click');s=await q.wait(s=>s.challenge.phase==='Active','resumed preparation',14000);
  assert.equal(s.challenge.IsPaused,false);
  await q.send('board-click');s=q.state();assert.equal(s.challenge.IsPaused,true);
  const remaining=s.challenge.remaining,round=s.Round,wins=s.Wins;
  await sleep(6200);s=await snap('active-paused');
  assert.equal(s.challenge.remaining,remaining);assert.equal(s.Round,round);assert.equal(s.Wins,wins);assert.equal(s.roundTimedOut,false);
  assert.equal(s.boardControls.find(c=>c.Id==='pause').enabled,true);assert.equal(s.boardControls.find(c=>c.Id==='minute-up').enabled,false);
  checks.push('An active clock stays fixed past its original deadline, with no false loss, restart or editable task settings');
  await q.send('spawn',{count:2,user:'qa_pause'});await q.wait(s=>s.Alive===2&&!s.pending,'gameplay while timer stopped');await q.send('kill',{count:1});
  assert.equal(q.state().challenge.IsPaused,true);assert.equal(q.state().challenge.Kills,1);
  checks.push('Only the challenge clock pauses: creatures and real kill progress continue');
  await q.send('board-click');s=q.state();assert.equal(s.challenge.IsPaused,false);
  assert.ok(s.challenge.remaining<=remaining&&s.challenge.remaining>remaining-.5);
  s=await q.wait(s=>s.roundTimedOut,'resumed clock expires',9000);assert.equal(s.Wins,wins-1);
  assert.equal(s.boardControls.find(c=>c.Id==='pause').enabled,false);
  checks.push('Resume keeps the remaining seconds and produces exactly one normal timeout after they elapse');
  await q.send('reset');assert.equal(q.state().challenge.IsPaused,false);
  await q.send('resolution',{width:800,height:600});await sleep(500);await q.send('view',{x:0,z:0,yaw:90,pitch:-6});await sleep(500);await snap('compact-board');
  await q.send('resolution',{width:1280,height:720});await sleep(500);
  assert.equal(q.state().failed,false);assert.equal(q.state().hudError,'');assert.equal(q.state().missionBoardError,'');
  await restore();
  assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8')),saved);
  fs.writeFileSync('pause-result.json',JSON.stringify({passed:true,checks,captures,settingsPreserved:true},null,2));
  console.log(JSON.stringify({passed:true,checks,captures}));
}
main().catch(async e=>{fs.writeFileSync('pause-result.json',JSON.stringify({passed:false,error:e.stack,checks,captures,state:q.state()},null,2));try{await restore();}catch{}console.error(e);process.exitCode=1;});
