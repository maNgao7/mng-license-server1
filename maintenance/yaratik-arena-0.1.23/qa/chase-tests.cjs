'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),q=require('./commands.cjs');
const before=JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8'));
const checks=[],measurements=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
function healthy(s){assert.equal(s.failed,false);assert.equal(s.survivalError,'');assert.equal(s.combatNavigationError,'');}
async function fresh(){await q.send('lock',{enabled:true});await q.send('live-events-pause',{enabled:true});await q.send('reset');await q.send('reset');}
async function restore(){await q.send('reset');await q.send('reset');await q.send('combat-settings',{enabled:before.EnemyAttacks,damage:before.CreatureDamage,interval:before.CreatureAttackInterval});await q.send('view',{x:14,z:-8,yaw:48,pitch:0});await q.send('lock',{enabled:false});await q.send('live-events-pause',{enabled:false});}
async function main(){
 await q.send('native-resume');await q.send('menu',{open:false});await q.send('auto-play',{enabled:false});await q.send('combat-settings',{enabled:true,damage:1,interval:1.2});
 await fresh();await q.send('combat-nav-probe');
 const nav=JSON.parse(fs.readFileSync('combat-navigation-probe.json'));
 assert.ok(nav.retiredFactoryObstacles>=10);assert.ok(nav.routes.every(r=>r.found&&r.status==='PathComplete'));
 checks.push('Removed factory divider and machine carving volumes no longer partition the new arena; all seven floor/stair/catwalk route sections are complete');
 for(const side of [1,-1]){
  await fresh();const rescuesBefore=q.state().liveFallRescues,started=Date.now();await q.send('combat-climb-fixture',{side});let maxY=0,maxStep=0,last=null;
  const end=Date.now()+60000;let s;
  while(Date.now()<end){s=q.state();healthy(s);const c=s.combatTestBodies[0];if(c){maxY=Math.max(maxY,c.y);if(last)maxStep=Math.max(maxStep,Math.hypot(c.x-last.x,c.y-last.y,c.z-last.z));last=c;}
   if(s.health<s.maxHealth&&s.lastAttacker==='qa_climber')break;await sleep(180);}
  assert.ok(s.health<s.maxHealth,'climber reaches player using stair '+side);assert.ok(maxY>9,'physically climbs to catwalk');assert.ok(maxStep<5,'no teleporting between one-second state samples');assert.equal(s.liveFallRescues,rescuesBefore);
  measurements.push({side,seconds:(Date.now()-started)/1000,maxY,maxStep});checks.push('Native creature crosses the old divider, walks up stair '+side+' and reaches the player on the upper walkway without teleport rescue');
  const health=s.health;await q.send('view',{x:12,z:10*side,yaw:180,pitch:0});
  s=await q.wait(t=>t.health<health&&t.combatTestBodies.some(c=>c.y<1),'same creature follows player back to ground '+side,45000);healthy(s);
  checks.push('The same creature replans and follows the player back to the ground from upper walkway '+side);
 }
 await restore();assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8')),before);
 const result={passed:true,checks,measurements,nativePhysics:true};fs.writeFileSync('chase-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(async error=>{const state=q.state();try{await restore();}catch{}fs.writeFileSync('chase-result.json',JSON.stringify({passed:false,checks,measurements,error:error.stack,state},null,2));console.error(error);process.exitCode=1;});
