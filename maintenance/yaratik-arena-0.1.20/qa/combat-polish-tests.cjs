'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),q=require('./commands.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],captures=[],measurements=[];
let before;
async function fresh(){await q.send('lock',{enabled:true});await q.send('live-events-pause',{enabled:true});await q.send('menu',{open:false});await q.send('auto-play',{enabled:false});await q.send('reset');await q.send('reset');await q.send('view',{x:0,z:-10,yaw:0,pitch:0});}
function healthy(s){assert.equal(s.failed,false);for(const name of ['hudError','survivalError','combatNavigationError','autoError']) assert.equal(s[name],'',name);}
async function snap(label){const s=await q.send('capture');healthy(s);captures.push({label,file:'capture-'+s.seq+'.png'});return s;}
async function hitAfter(count,label,timeout){const end=Date.now()+timeout;while(Date.now()<end){const s=await q.send('report');if(s.creatureHits>count)return s;await sleep(90);}throw new Error(label);}
async function restore(){if(!before)return;
 await q.send('menu',{open:false});await q.send('reset');await q.send('reset');
 await q.send('combat-settings',{enabled:before.EnemyAttacks,playerHealth:500,damage:1,interval:before.CreatureAttackInterval,scale:1.5});
 await q.send('crowd-settings',{timed:before.TimedMode,seconds:before.RoundSeconds,target:before.KillTarget,winGoal:before.WinGoal});
 await q.send('resolution',{width:1280,height:720});await q.send('view',{x:14,z:-8,yaw:48,pitch:0});
 await q.send('live-events-pause',{enabled:false});await q.send('lock',{enabled:false});
}
async function main(){
 await q.wait(s=>s.ready&&s.version===(process.env.TIKMNG_QA_VERSION||'0.1.19')&&(!process.argv[2]||s.processId===Number(process.argv[2]))&&Date.now()-fs.statSync('state.json').mtimeMs<2500,'fresh version',40000);
 before=JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8'));
 await q.send('combat-settings',{enabled:true,playerHealth:500,damage:1,interval:1.2});await q.send('crowd-settings',{timed:true,seconds:3600,target:10000});
 for(const [kind,damage,maxHealth,minPeriod] of [['spawn',5,12,1.7],['boss',150,120,3.3],['bigboss',400,240,5]]){
  await fresh();const hits=q.state().creatureHits;
  await q.send('team-fixture',{kind,user:'qa_'+kind,x:0,z:kind==='spawn'?-7.5:-5});
  await q.wait(s=>s.combatTestBodies.some(c=>c.Kind===kind),'class spawned');
  assert.equal(q.state().combatTestBodies[0].maxHealth,maxHealth);
  let s=await hitAfter(hits,'first '+kind+' actual hit',14000);healthy(s);
  assert.equal(s.health,500-damage);assert.equal(s.playerLastDamage,damage);const first=s.playerHitAt;
  // Hits are counted in Update; the vignette is first drawn by the following OnGUI.
  const feedbackDeadline=Date.now()+600;
  while(s.damageVignetteOpacity<=0&&Date.now()<feedbackDeadline){await sleep(30);s=await q.send('report');}
  assert.ok(s.damageVignetteOpacity>0,'visible red damage feedback');await snap(kind+'-first-damage-and-vitals');
  s=await hitAfter(hits+1,'second '+kind+' hit',14000);healthy(s);
  const period=s.playerHitAt-first;assert.ok(period>=minPeriod,kind+' must recover more slowly');
  measurements.push({kind,damage,period,enemyHealth:maxHealth,remaining:s.health});
 }
 checks.push('Actual native attacks deal 5, 150 and 400 damage at 500 maximum health; large-enemy windup and recovery are progressively slower');
 await fresh();await q.send('combat-settings',{enabled:false});
 await q.send('team-fixture',{kind:'helper',user:'qa_grip',x:0,z:-4});
 let s=await q.send('report');assert.ok(s.combatTestBodies[0].ClubOnHand);assert.equal(s.combatTestBodies[0].clubParent,'TikMnG_Right_Hand_Grip');assert.ok(s.combatTestBodies[0].gripGap<.001);
 await snap('native-bat-in-gloved-hand');
 checks.push('Support bat reuses the original textured bat meshes and is parented at the visible gloved grip with no gap');
 await q.send('team-fixture',{kind:'spawn',user:'qa_normal_bar',x:-2,z:-2});
 await q.send('team-fixture',{kind:'boss',user:'qa_boss_bar',x:3,z:0});
 await q.send('team-fixture',{kind:'bigboss',user:'qa_big_bar',x:-5,z:3});
 await q.send('view',{x:0,z:-14,yaw:0,pitch:-10});await sleep(300);s=await snap('all-class-healthbars');assert.ok(s.drawnCreatureBars>=3);
 await fresh();await q.send('team-fixture',{kind:'boss',user:'qa_boss_bar',x:0,z:0});await q.send('view',{x:0,z:-14,yaw:0,pitch:-10});await q.send('hit',{damage:30});
 s=await q.send('report');assert.equal(s.combatTestBodies.find(c=>c.Kind==='boss').health,90);
 await snap('damaged-boss-healthbar');checks.push('Normal, support, Boss and Big Boss health bars show class health and update after real damage');
 for(const width of [1280,800]){
  await q.send('resolution',{width,height:width===800?600:720});await sleep(250);
  await q.send('gift',{id:'5655',user:'qa_sender'});s=await q.wait(s=>s.giftNoticeDrawn,'gift notice');
  assert.equal(s.giftNoticeBounds.x,12);assert.ok(s.giftNoticeBounds.y>= (width>=1180?164:296));assert.ok(s.giftNoticeBounds.y+s.giftNoticeBounds.height< (width===800?600:720)-110);
  await snap('upper-left-gift-'+width);
 }
 checks.push('Gift balloons stay upper-left under the timed panel at desktop and compact resolutions without covering the health meter');
 fs.writeFileSync('combat-polish-result.json',JSON.stringify({passed:true,checks,captures,measurements},null,2));console.log(JSON.stringify({passed:true,checks,captures,measurements}));
}
main().catch(e=>{console.error(e);fs.writeFileSync('combat-polish-failure.json',JSON.stringify({error:e.stack,state:q.state()},null,2));process.exitCode=1;}).finally(restore);
