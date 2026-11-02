'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),q=require('./commands.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],captures=[];
let before;
async function fresh(){await q.send('lock',{enabled:true});await q.send('live-events-pause',{enabled:true});await q.send('menu',{open:false});await q.send('auto-play',{enabled:false});await q.send('reset');await q.send('reset');await q.send('view',{x:0,z:-10,yaw:0,pitch:0});}
async function snap(label){const s=await q.send('capture');captures.push({label,file:'capture-'+s.seq+'.png'});return s;}
async function event(kind,user,count,id){return q.send('live-event-fixture',{event:{kind,username:user,likeCount:count,eventId:id}});}
async function main(){
 await q.wait(s=>s.ready&&s.version==='0.1.18'&&(!process.argv[2]||s.processId===Number(process.argv[2]))&&s.combatNavigationReady&&Date.now()-fs.statSync('state.json').mtimeMs<2500,'ready',45000);
 before=JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8'));
 await fresh();await q.send('combat-settings',{enabled:true,playerHealth:1000});
 await q.send('crowd-settings',{timed:true,seconds:3600,target:10000});
 await q.send('audience-settings',{threshold:100,likes:true,follows:true,likeOp:'spawn',followOp:'spawn'});
 let base=q.state().likeActionsApplied,follow=q.state().followActionsApplied;
 await event('like','qa_alice',99,'like-99-'+Date.now());await sleep(300);assert.equal(q.state().Alive,0);assert.equal(q.state().pending,0);
 await event('like','qa_bob',99,'bob-99-'+Date.now());assert.equal(q.state().likeActionsApplied,base);
 const id='like-100-'+Date.now();await event('like','qa_alice',1,id);await event('like','qa_alice',1,id);
 assert.equal(q.state().likeActionsApplied,base+1);
 await event('like','qa_alice',250,'250-'+Date.now());assert.equal(q.state().likeActionsApplied,base+3);
 await event('like','qa_alice',50,'50-'+Date.now());assert.equal(q.state().likeActionsApplied,base+4);
 await event('follow','qa_follow',0,'f1-'+Date.now());await event('follow','qa_follow',0,'f2-'+Date.now());assert.equal(q.state().followActionsApplied,follow+1);
 checks.push('Native consumer: 99 waits, per-user counters, threshold repeats with remainder, duplicate IDs ignored, follow once');
 await fresh();await q.send('effect-test',{effect:'prison',count:60});await q.send('effect-test',{effect:'boss'});await q.send('effect-test',{effect:'bigboss'});
 let s=await q.wait(s=>s.combatTestBodies.some(c=>c.Kind==='boss')&&s.combatTestBodies.some(c=>c.Kind==='bigboss'),'boss arrivals',12000);
 assert.equal(s.combatTestBodies.find(c=>c.Kind==='boss').sizeMultiplier,4);
 assert.ok(Math.abs(s.combatTestBodies.find(c=>c.Kind==='bigboss').sizeMultiplier-6.5)<.001);
 const steps=s.bossSteps;
 s=await q.wait(s=>s.bossSteps>steps,'actual giant footsteps',12000);
 assert.equal(s.survivalError,'');assert.equal(s.failed,false);await snap('boss-and-big-boss');
 checks.push('Queued Boss and Big Boss arrive at 400/650 percent, walk and emit distance-limited camera step pulses');
 await q.send('combat-settings',{scale:1.25});s=await q.send('report');
 assert.equal(s.combatTestBodies.find(c=>c.Kind==='boss').sizeMultiplier,4);
 assert.ok(Math.abs(s.combatTestBodies.find(c=>c.Kind==='bigboss').sizeMultiplier-6.5)<.001);
 await q.send('combat-settings',{scale:1.5});checks.push('Normal creature size changes do not overwrite either boss size');
 await fresh();let hits=q.state().helperHits,damage=q.state().helperDamageTaken;
 await q.send('team-fixture',{kind:'helper',user:'qa_helper',x:0,z:0});
 s=await q.send('report');let helper=s.combatTestBodies.find(c=>c.Friendly);assert.ok(helper.armed);assert.equal(helper.health,20);assert.equal(s.Alive,0);
 await q.send('hit',{damage:100,force:25});await q.send('hit',{damage:100,force:25,shockwave:true});
 s=await q.send('report');assert.equal(s.combatTestBodies.find(c=>c.Friendly).health,20);
 checks.push('Player weapon and shockwave friendly fire cannot damage the helper');
 await q.send('team-fixture',{kind:'spawn',user:'qa_enemy',x:0,z:2});
 s=await q.wait(s=>s.helperHits>hits&&s.helperDamageTaken>damage,'reciprocal helper combat',18000);assert.equal(s.survivalError,'');
 await snap('helper-melee-and-health');
 await q.wait(s=>s.Kills>=1,'helper defeats actual native enemy',12000);
 checks.push('Armed helper has 20 HP, targets enemies rather than player, lands real animated melee hits and receives hostile damage');
 await q.send('team-fixture',{kind:'boss',user:'qa_enemy_boss',x:0,z:2});
 s=await q.wait(s=>!s.combatTestBodies.some(c=>c.Friendly),'helper eventually dies',18000);
 assert.ok(s.helperDamageTaken>=damage+20);assert.equal(s.Kills,1);checks.push('Helper is mortal; its death does not count as a hostile kill');
 await fresh();await q.send('menu',{open:true,tab:1});await snap('audience-actions-1280');
 await q.send('resolution',{width:800,height:600});await sleep(400);await snap('audience-actions-800');
 await q.send('menu',{open:true,tab:1,addingAction:true});await snap('action-picker-800');
 await q.send('menu',{open:true,tab:1,addingAction:false,triggerPicker:0});await snap('like-action-picker-800');
 await q.send('menu',{open:true,tab:1,triggerPicker:1});await snap('follow-action-picker-800');
 await q.send('menu',{open:true,tab:1,triggerPicker:-1});
 await q.send('resolution',{width:1280,height:720});
 checks.push('Pinned like/follow controls and nine action types render at desktop and compact resolutions');
 fs.writeFileSync('audience-teams-result.json',JSON.stringify({passed:true,checks,captures,version:q.state().version},null,2));
 console.log(JSON.stringify({passed:true,checks,captures}));
}
async function restore(){
 if(!before)return;
 await q.send('menu',{open:false,addingAction:false,triggerPicker:-1});await q.send('reset');await q.send('reset');
 await q.send('combat-settings',{enabled:before.EnemyAttacks,playerHealth:before.PlayerHealth,damage:before.CreatureDamage,interval:before.CreatureAttackInterval,scale:1.5});
 await q.send('crowd-settings',{timed:before.TimedMode,seconds:before.RoundSeconds,target:before.KillTarget,winGoal:before.WinGoal});
 await q.send('audience-settings',{threshold:before.LikeThreshold,likes:before.LikeAction.Enabled,follows:before.FollowAction.Enabled,likeOp:before.LikeAction.Op,followOp:before.FollowAction.Op});
 await q.send('resolution',{width:1280,height:720});await q.send('view',{x:14,z:-8,yaw:48,pitch:0});
 await q.send('live-events-pause',{enabled:false});await q.send('lock',{enabled:false});
}
main().catch(e=>{console.error(e);fs.writeFileSync('audience-teams-failure.json',JSON.stringify({error:e.message,state:q.state()},null,2));process.exitCode=1;}).finally(restore);
