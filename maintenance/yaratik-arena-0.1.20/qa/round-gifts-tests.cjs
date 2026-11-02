'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const q=require('./commands.cjs');
const saved=JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8'));
const checks=[];
async function freezeResult(){await q.send('menu',{tab:0,open:true});}
async function queueGifts(){
  await q.send('gift',{id:'5655',repeatCount:3,user:'qa_next_round'});
  await q.send('gift',{id:'6064',repeatCount:3});
  await q.send('gift',{id:'5827',repeatCount:1});
  const s=q.state();
  assert.equal(s.queuedRoundCreatures,6);assert.equal(s.queuedRoundBatches,1);
  assert.equal(s.nextRoundWeaponLevel,2);
  return s;
}
async function nextRound(previous){
  await q.send('menu',{open:false});
  const s=await q.wait(s=>s.Round===previous.Round+1&&s.Alive===6&&s.pending===0,'Gifts carried into next round',10000);
  assert.equal(s.level,2);assert.equal(s.Kills,0);assert.equal(s.queuedRoundCreatures,0);
  assert.equal(s.nextRoundWeaponLevel,0);assert.ok(s.roundStartedAt>=0);
  return s;
}
async function main(){
  await q.wait(s=>s.ready&&!s.failed&&s.version==='0.1.7','New native mod startup',45000);
  await q.send('live-events-pause',{enabled:true});
  await q.send('lock',{enabled:true});await q.send('native-resume');await q.send('menu',{open:false});
  await q.send('crowd-settings',{total:1000000,physical:60,timed:false});await q.send('reset');
  for(let i=0;i<saved.Actions.length;i++)await q.send('binding',{index:i,giftId:''});
  await q.send('binding',{index:0,giftId:'5655',count:2});
  await q.send('binding',{index:3,giftId:'6064'});await q.send('binding',{index:4,giftId:'5827'});
  await q.send('spawn',{count:1});await q.wait(s=>s.Alive===1,'First creature');await q.send('kill',{count:1});
  await q.wait(s=>s.Won,'Native winner countdown',16000);await freezeResult();
  const winner=await queueGifts();assert.equal(winner.Alive,0);assert.equal(winner.level,0);
  checks.push('Result-screen gifts are staged once; native creatures do not spawn behind WINNER');
  await nextRound(winner);
  checks.push('Six gift creatures and ordered +3/-1 weapon actions carry into the next round');
  await q.send('reset');assert.equal(q.state().Alive+q.state().pending+q.state().queuedRoundCreatures,0);
  checks.push('A later reset does not replay previously carried gifts');
  await q.send('crowd-settings',{timed:true,seconds:1});await q.send('spawn',{count:1});await q.send('challenge-start');
  await q.wait(s=>s.roundTimedOut,'Native timed round ends',16000);await freezeResult();
  const timeout=await queueGifts();assert.equal(timeout.Alive,1);
  await nextRound(timeout);
  checks.push('Timed-out rounds also carry gift creatures and weapon actions without reusing old kills');
  await q.send('crowd-settings',{timed:false});
  await q.send('lock',{enabled:true});await q.send('reset');await q.send('spawn',{count:1});await q.wait(s=>s.Alive===1,'Late clear creature');
  await new Promise(resolve=>setTimeout(resolve,5000));await q.send('kill',{count:1});
  await q.wait(s=>s.Alive===0&&s.Kills===1&&s.Deadline!==null,'Confirmed final native death',3000);
  await new Promise(resolve=>setTimeout(resolve,6000));
  assert.equal(q.state().Won,false);assert.equal(q.state().roundTimedOut,false);
  await q.wait(s=>s.Won,'Full countdown after the timed deadline',14000);
  checks.push('After returning to free mode, clearing still requires the complete ten-second winner countdown');
  assert.equal(q.state().hudError,'');assert.equal(q.state().failed,false);
  checks.push('No mod or HUD errors after both round transitions');
  await restore();
  fs.writeFileSync('round-gifts-result.json',JSON.stringify({passed:true,checks,syntheticSavedGiftTests:true},null,2));
  console.log(JSON.stringify({passed:true,checks}));
}
async function restore(){
  await q.send('menu',{open:false});await q.send('reset');
  for(let index=0;index<saved.Actions.length;index++)await q.send('binding',{index,giftId:saved.Actions[index].GiftId,count:saved.Actions[index].Count});
  await q.send('crowd-settings',{total:saved.MaxCreatures,physical:saved.PhysicalCreatures,timed:saved.TimedMode,seconds:saved.RoundSeconds});
  await q.send('reset');await q.send('lock',{enabled:false});
  await q.send('live-events-pause',{enabled:false});
}
main().catch(async error=>{fs.writeFileSync('round-gifts-result.json',JSON.stringify({passed:false,error:error.stack,checks,state:q.state()},null,2));try{await restore();}catch{}console.error(error);process.exitCode=1;});
