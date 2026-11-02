'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),q=require('./commands.cjs');
const before=JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8'));
async function restore(){await q.send('reset');await q.send('reset');await q.send('combat-settings',{enabled:before.EnemyAttacks,damage:before.CreatureDamage,interval:before.CreatureAttackInterval});await q.send('view',{x:14,z:-8,yaw:48,pitch:0});await q.send('lock',{enabled:false});await q.send('live-events-pause',{enabled:false});}
async function main(){
 await q.send('lock',{enabled:true});await q.send('live-events-pause',{enabled:true});await q.send('auto-play',{enabled:false});await q.send('reset');await q.send('reset');
 await q.send('combat-settings',{enabled:true,damage:1,interval:1.2});await q.send('view',{x:0,z:-10,yaw:0,pitch:0});await q.send('effect-test',{effect:'prison',count:50});
 await q.send('spawn',{count:300,user:'qa_crowd'});await q.wait(s=>s.Alive===300&&s.pending===0,'three hundred native opponents',45000);
 const paths=q.state().combatPaths;await q.send('performance',{label:'survival-chase-300',seconds:10});await q.wait(s=>!s.performanceRunning,'crowd path performance',18000);
 const s=q.state();assert.equal(s.failed,false);assert.equal(s.survivalError,'');assert.equal(s.combatNavigationError,'');assert.equal(s.health,100);assert.equal(s.creaturesInCage,0);assert.ok(s.combatPaths>paths);assert.equal(s.liveFallRescues,0);
 const file=fs.readdirSync('.').filter(f=>/^performance-\d+\.json$/.test(f)).map(f=>({f,s:fs.statSync(f).mtimeMs})).sort((a,b)=>b.s-a.s)[0].f;
 const performance=JSON.parse(fs.readFileSync(file));assert.equal(performance.label,'survival-chase-300');assert.equal(performance.live,300);
 await restore();assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8')),before);
 const result={passed:true,creatures:300,healthProtected:true,creaturesInCage:0,pathQueries:s.combatPaths-paths,performance,scope:'Local 300-creature smoke test, not a 2500-creature performance guarantee'};
 fs.writeFileSync('survival-crowd-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(async error=>{try{await restore();}catch{}console.error(error);process.exitCode=1;});
