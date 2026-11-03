'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),q=require('./commands.cjs');
const {normalizeAudience,normalizeGift}=require('../bridge/normalize.cjs');
const {DedupeJournal}=require('../bridge/storage.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),run=Date.now().toString(),checks=[],giftChecks=[],birthChecks=[],captures=[];
const journal=new DedupeJournal('final-replay-dedupe.json',2000);
let before,initial,serial=0,temporary=[];
const user=suffix=>'qa_final_'+suffix+'_'+run.slice(-6);
function healthy(s){assert.equal(s.failed,false);for(const name of ['hudError','survivalError','combatNavigationError','autoError','missionBoardError'])assert.equal(s[name],'',name);}
async function hold(){await q.send('lock',{enabled:true});await q.send('live-events-pause',{enabled:true});await q.send('menu',{open:true,tab:1,triggerPicker:-1,addingAction:false});await q.send('reset');await q.send('reset');healthy(q.state());}
function nativeBase(who){return {common:{msgId:run+String(++serial).padStart(5,'0')},user:{uniqueId:who,userId:'987654321'},repeatCount:1};}
async function deliver(normalized,duplicate=false){assert.ok(normalized);if(!duplicate&&journal.has(normalized.keys))return q.state();const s=await q.send('live-event-fixture',{event:normalized.event});if(!duplicate)journal.remember(normalized.keys);healthy(s);return s;}
async function likes(who,count){const s=q.state();return deliver(normalizeAudience('like',{...nativeBase(who),count,total:999999},s.live.epoch,s.live.roomId));}
async function follow(who){const s=q.state();return deliver(normalizeAudience('follow',nativeBase(who),s.live.epoch,s.live.roomId));}
async function gift(id,repeats,who=user('gift'),patch={}){const s=q.state();return deliver(normalizeGift({...nativeBase(who),giftId:id,giftType:0,repeatCount:repeats,...patch},s.live.epoch,s.live.roomId));}
async function snap(label){const s=await q.send('capture');captures.push({label,file:'capture-'+s.seq+'.png'});return s;}
async function waitBirths(expected,label,timeout=35000){
 const path=[[0,-10],[10,-8],[12,8],[0,12],[-12,8],[-12,-8]];let nextMove=0,move=0;
 await q.send('menu',{open:false});const end=Date.now()+timeout;
 while(Date.now()<end){let s=await q.send('report');healthy(s);assert.equal(s.Alive+s.pending,expected,label+' total remains exact');
  if(s.Alive===expected&&s.pending===0)return s;
  if(Date.now()>=nextMove){const [x,z]=path[move++%path.length];await q.send('view',{x,z,yaw:0,pitch:0});nextMove=Date.now()+1800;}
  await sleep(200);
 }
 throw new Error(label+' native spawn queue did not fully drain: '+JSON.stringify({alive:q.state().Alive,pending:q.state().pending,memoryHold:q.state().crowdMemoryHold}));
}
async function main(){
 initial=await q.send('report');healthy(initial);assert.equal(initial.version,process.env.TIKMNG_QA_VERSION||'0.1.19');
 before=JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8'));
 fs.writeFileSync('final-event-settings-before.json',JSON.stringify(before,null,2));
 await q.send('lock',{enabled:true});await q.send('live-events-pause',{enabled:true});await q.send('auto-play',{enabled:false});await hold();
 assert.equal(before.LikeThreshold,100);assert.ok(before.LikeAction.Enabled&&before.FollowAction.Enabled);
 assert.equal(before.LikeAction.Op,'spawn');assert.equal(before.FollowAction.Op,'spawn');
 const a=user('like_a'),b=user('like_b'),amount=before.LikeAction.Count,base=q.state().likeActionsApplied;
 await likes(a,99);assert.equal(q.state().pending,0);assert.equal(q.state().likeActionsApplied,base);
 await likes(b,99);assert.equal(q.state().pending,0);
 await likes(a,1);assert.equal(q.state().pending,amount);assert.equal(q.state().likeActionsApplied,base+1);
 await likes(a,99);assert.equal(q.state().pending,amount);
 await likes(a,1);assert.equal(q.state().pending,amount*2);assert.equal(q.state().likeActionsApplied,base+2);
 await likes(a,250);assert.equal(q.state().pending,amount*4);await likes(a,50);assert.equal(q.state().pending,amount*5);
 await likes(b,1);assert.equal(q.state().pending,amount*6);
 checks.push('99 personal likes: zero actions; like 100: one; 199: still one; 200: two; later batches repeat with their remainder; viewers do not share counters');
 await likes(a,99);await hold();await likes(a,1);assert.equal(q.state().pending,amount);
 checks.push('A new round preserves partial like progress, and the next hundredth like still triggers');
 await hold();let followBase=q.state().followActionsApplied;
 await follow(user('follower'));assert.equal(q.state().pending,before.FollowAction.Count);assert.equal(q.state().followActionsApplied,followBase+1);
 await follow(user('follower'));assert.equal(q.state().pending,before.FollowAction.Count);
 await follow(user('second'));assert.equal(q.state().pending,before.FollowAction.Count*2);
 checks.push('First follow executes the selected action; repeated follow by the same viewer does not duplicate it; a second viewer works');

 const mapped=[...new Set(before.Actions.map(a=>a.GiftId).filter(Boolean))];
 for(const id of mapped){for(const repeats of [1,3]){
  await hold();const bindings=before.Actions.filter(a=>a.GiftId===id),spawns=bindings.filter(a=>['spawn','boss','bigboss','helper'].includes(a.Op)).reduce((n,a)=>n+a.Count*repeats,0);
  let startLevel=0;
  if(bindings.some(a=>a.Op==='down')){for(let i=0;i<4;i++)await q.send('up');startLevel=4;}
  const releases=bindings.filter(a=>a.Op==='release').reduce((n,a)=>n+a.Count*repeats,0);
  if(releases>0)await q.send('effect-test',{effect:'prison',count:releases+7});
  const s=await gift(id,repeats);
  assert.equal(s.pending,spawns,'configured gift '+id+' x'+repeats);
  let expectedLevel=startLevel;
  for(const action of bindings){const amount=action.Count*repeats;
   if(action.Op==='up')expectedLevel=Math.min(7,expectedLevel+amount);
   if(action.Op==='down')expectedLevel=Math.max(0,expectedLevel-amount);
   if(action.Op==='flash')assert.equal(s.FlashSeconds,amount);
   if(action.Op==='prison')assert.equal(s.PrisonSeconds,amount);
   if(action.Op==='release')assert.equal(s.PrisonSeconds,7);
  }
  assert.equal(s.level,expectedLevel);giftChecks.push({giftId:id,repeats,configured:bindings.map(a=>({op:a.Op,count:a.Count})),acceptedCreatures:spawns});
 }}
 checks.push('Every currently assigned gift ID executes its configured action and exact amount, for one gift and three repeats, including weapon, flash and prison actions');

 await hold();const mappedSpawn=before.Actions.find(a=>a.Op==='spawn'&&a.GiftId);
 const native={...nativeBase(user('combo')),giftId:mappedSpawn.GiftId,giftType:1,repeatCount:3,repeatEnd:false,groupId:run+'91'};
 assert.equal(normalizeGift(native,q.state().live.epoch,q.state().live.roomId),null);assert.equal(q.state().pending,0);
 const terminal=normalizeGift({...native,repeatEnd:true},q.state().live.epoch,q.state().live.roomId);
 await deliver(terminal);await deliver(terminal,true);assert.equal(q.state().pending,mappedSpawn.Count*3);
 const alternate=normalizeGift({...native,common:{msgId:run+'999'},repeatEnd:true},q.state().live.epoch,q.state().live.roomId);
 await deliver(alternate);assert.equal(q.state().pending,mappedSpawn.Count*3);
 checks.push('An unfinished combo does not execute; its terminal repeat total executes once; duplicate messages and replayed combo groups do not double-count');

 const catalog=JSON.parse(fs.readFileSync('../catalog/gifts.json','utf8'));
 const unused=catalog.find(g=>!mapped.includes(g.id));assert.ok(unused);
 await hold();await gift(unused.id,1);assert.equal(q.state().pending,0);
 checks.push('An unassigned gift cannot accidentally spawn creatures or run another gift action');

 await q.send('combat-settings',{enabled:false});
 for(const action of before.Actions.filter(a=>a.Op==='spawn'&&a.GiftId)){
  await hold();const who=user('birth_'+action.Count);await gift(action.GiftId,1,who);
  const s=await waitBirths(action.Count,'gift '+action.GiftId,45000);
  assert.ok(s.combatTestBodies.every(c=>c.Username===who&&c.Kind==='spawn'));
  birthChecks.push({giftId:action.GiftId,expected:action.Count,actualAlive:s.Alive,remainingQueue:s.pending});
 }
 checks.push('Each configured creature gift was physically spawned in the native scene at its saved amount, with zero remaining queue and correct sender attribution');

 for(const kind of ['boss','bigboss','helper']){
  const index=before.Actions.findIndex(a=>a.Op===kind&&a.GiftId);assert.ok(index>=0);
  await hold();const repeats=kind==='helper'?3:2;
  const who=user(kind);await gift(before.Actions[index].GiftId,repeats,who);const count=before.Actions[index].Count*repeats;
  await q.send('menu',{open:false});let s=await q.wait(s=>s.pending===0&&s.combatTestBodies.filter(c=>c.Kind===kind).length===count,'configured '+kind+' births',15000);healthy(s);
  assert.equal(s.Alive,kind==='helper'?0:count);
  for(const c of s.combatTestBodies){assert.equal(c.Username,who);assert.equal(c.Kind,kind);assert.ok(Math.abs(c.sizeMultiplier-(kind==='boss'?4:kind==='bigboss'?6.5:1.5))<.001);}
  await snap('configured-gift-'+kind);birthChecks.push({kind,giftId:before.Actions[index].GiftId,repeats,expected:count,physical:s.combatTestBodies.length,temporaryGift:false});
 }
 checks.push('Saved actual gift bindings spawn exactly two Boss, two Big Boss and three armed supports without changing any gift selections');
 await hold();await q.send('menu',{open:false});await q.send('gift',{id:mappedSpawn.GiftId,user:user('balloon')});
 await q.wait(s=>s.giftNoticeDrawn,'balloon visible');await snap('final-gift-balloon');
 await q.send('reset');await q.send('menu',{open:true,tab:1});await snap('final-actions-desktop');
 await q.send('resolution',{width:800,height:600});await sleep(300);await snap('final-actions-compact');
 checks.push('Desktop and compact action panels, physical creature health bars and upper-left gift balloon render without HUD errors');
 const result={passed:true,checks,giftChecks,birthChecks,captures,realPaidGiftTest:false,unassignedActions:before.Actions.filter(a=>!a.GiftId).map(a=>({name:a.Name,op:a.Op,count:a.Count})),liveAtStart:initial.live};
 fs.writeFileSync('final-event-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
async function restore(){if(!before)return;
 for(const index of temporary)await q.send('binding',{index,giftId:before.Actions[index].GiftId,count:before.Actions[index].Count});
 await q.send('menu',{open:false});await q.send('auto-play',{enabled:false});await q.send('reset');await q.send('reset');
 await q.send('combat-settings',{enabled:before.EnemyAttacks,damage:before.CreatureDamage,interval:before.CreatureAttackInterval,playerHealth:before.PlayerHealth,scale:before.CreatureScale});
 await q.send('resolution',{width:1280,height:720});await q.send('view',{x:14,z:-8,yaw:48,pitch:0});
 await q.send('lock',{enabled:false});await q.send('live-events-pause',{enabled:false});
 assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8')),before,'all persistent settings restored');
}
main().catch(error=>{console.error(error);fs.writeFileSync('final-event-failure.json',JSON.stringify({error:error.stack,state:q.state(),checks,giftChecks,birthChecks},null,2));process.exitCode=1;}).finally(restore);
