'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),q=require('./commands.cjs');
const before=JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8')),nativeBefore=fs.readFileSync('../userdata/settings.sav');
const checks=[],captures=[],dashMeasurements=[],sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));let mount,nativeFarVacuum;
function healthy(s){assert.equal(s.failed,false);for(const key of ['autoError','hudError','missionBoardError','dashError','boardFloorError'])assert.equal(s[key],'',key);}
async function fresh(){await q.send('lock',{enabled:true});await q.send('live-events-pause',{enabled:true});await q.send('auto-play',{enabled:false});await q.send('reset');await q.send('reset');await q.send('view',{x:0,z:0,yaw:0,pitch:0});}
async function snap(label){const s=await q.send('capture');captures.push({label,file:'capture-'+s.seq+'.png'});return s;}
async function restore(){
 await q.send('menu',{open:false});await q.send('native-resume');await q.send('vacuum-unblock');await q.send('auto-play',{enabled:false});await q.send('reset');await q.send('reset');
 await q.send('crowd-settings',{timed:before.TimedMode,seconds:before.RoundSeconds,target:before.KillTarget,winGoal:before.WinGoal});
 await q.send('combat-settings',{enabled:before.EnemyAttacks});
 await q.send('view',{x:0,z:0,yaw:90,pitch:-6});await q.send('lock',{enabled:false});await q.send('live-events-pause',{enabled:false});
}
async function main(){
 await q.wait(s=>s.ready&&s.version===(process.env.TIKMNG_QA_VERSION||'0.1.19')&&Date.now()-fs.statSync('state.json').mtimeMs<2500,'fresh requested build',45000);
 await q.send('lock',{enabled:true});await q.send('live-events-pause',{enabled:true});await q.send('native-resume');await q.send('menu',{open:false});
 await q.send('combat-settings',{enabled:false});
 await q.send('crowd-settings',{timed:true,seconds:3600,target:10000});await fresh();await q.send('board-mount-probe');mount=JSON.parse(fs.readFileSync('board-mount-probe.json'));
 await q.send('board-floor-probe');const floor=JSON.parse(fs.readFileSync('board-floor-probe.json'));
 assert.equal(floor.sealedFloor,true);assert.equal(floor.samples.length,15);assert.ok(floor.samples.every(sample=>sample.found&&Math.abs(sample.y-floor.boardFloorY)<.08));
 checks.push('Fifteen downward rays find solid floor across the full accessible board base');
 for(const z of [-5.5,0,5.5]){
  await fresh();await q.send('board-floor-pressure',{z});const s=await q.wait(s=>!s.boardFloorPressureRunning,'board floor pressure '+z,7000);healthy(s);
  assert.ok(s.boardFloorPlayerMinimum>=floor.boardFloorY-.1);assert.ok(s.boardFloorCreatureMinimum>=floor.boardFloorY-.1);
  assert.ok(s.position.x<mount.board.x);assert.equal(s.behindBoardCreatures,0);
 }
 await q.send('view',{x:18,z:-9,yaw:65,pitch:18});await sleep(300);await snap('sealed-board-base');
 checks.push('Player and a dead native creature remain above ground when forced against the board at centre and both edges');
 for(const area of [{x:-3,z:0,yaw:90},{x:3,z:0,yaw:-90},{x:0,z:-3,yaw:0},{x:0,z:3,yaw:180}]){
  await fresh();const base=q.state().vacuumCollected,sounds=q.state().vacuumIntakeSounds;
  await q.send('vacuum-hold',{...area,distance:6});const s=await q.wait(s=>s.vacuumCollected===base+1,'manual cross-region intake '+JSON.stringify(area),12000);healthy(s);
  assert.equal(s.autoPlaying,false);assert.equal(s.vacuumIntakeSounds,sounds+1);assert.equal(s.Collected,1);
 }
 checks.push('Manual suction physically consumes corpses across both central axes in all four directions, with exactly one intake and sound');
 await fresh();let base=q.state().vacuumCollected;
 await q.send('vacuum-hold',{distance:6,blocked:true});await sleep(1500);await q.send('board-floor-probe');assert.equal(q.state().vacuumCollected,base);
 await q.send('vacuum-unblock');await q.wait(s=>s.vacuumCollected===base+1,'collection after removing physical obstruction',10000);
 checks.push('A solid wall blocks suction; removing it restores physical collection without changing region');
 // The native suction can exceed its configured range. Record that behavior rather than claim a strict centre-distance limit.
 await fresh();base=q.state().vacuumCollected;await q.send('vacuum-hold',{distance:18});await sleep(1500);await q.send('board-floor-probe');
 nativeFarVacuum={configuredRange:q.state().vacuumRange,startDistance:q.state().qaVacuumStartDistance,collected:q.state().vacuumCollected-base};
 await fresh();await q.send('view',{x:0,z:-14,yaw:0,pitch:0});await sleep(600);await q.send('board-floor-probe');assert.equal(q.state().playerGrounded,true);
 let count=q.state().dashCount;await q.send('dash-jump');await sleep(160);const start=q.state().position;let s=await q.send('dash-press');assert.equal(s.dashCount,count+1);await q.send('dash-press');
 s=await q.wait(s=>!s.dashActive,'clear-corridor dash completion',4000);healthy(s);
 const distance=Math.hypot(s.dashEnd.x-s.dashOrigin.x,s.dashEnd.y-s.dashOrigin.y,s.dashEnd.z-s.dashOrigin.z);assert.ok(distance>=24.7&&distance<=25.2,'dash distance '+distance);assert.equal(s.dashCount,count+1);
 dashMeasurements.push({label:'horizontal',distance,origin:s.dashOrigin,end:s.dashEnd,obstacle:s.dashObstacle});
 await snap('dash-corridor');checks.push('The second airborne Space-path input travels twenty-five metres; repeated presses cannot chain dashes');
 await fresh();await q.send('view',{x:0,z:-14,yaw:0,pitch:-15});await sleep(600);await q.send('board-floor-probe');
 await q.send('dash-jump');await sleep(160);await q.send('dash-press');s=await q.wait(s=>!s.dashActive,'upward aimed dash completion',4000);healthy(s);
 const aimedDistance=Math.hypot(s.dashEnd.x-s.dashOrigin.x,s.dashEnd.y-s.dashOrigin.y,s.dashEnd.z-s.dashOrigin.z);
 assert.ok(aimedDistance>=24.7&&aimedDistance<=25.2,'aimed distance '+aimedDistance);assert.ok(s.dashEnd.y-s.dashOrigin.y>6,'upward dash gains height');
 assert.ok(Math.abs(s.dashDirection.y-Math.sin(Math.PI/12))<.015);assert.ok(s.velocity.y<2,'dash does not leave a sustained launch velocity');
 dashMeasurements.push({label:'upward-aimed',distance:aimedDistance,origin:s.dashOrigin,end:s.dashEnd,obstacle:s.dashObstacle});
 await snap('dash-upward');checks.push('Looking upward aims the full twenty-five-metre dash into the air; vertical launch velocity ends with the dash');
 await fresh();await q.send('view',{x:mount.board.x-1.4,z:0,yaw:90,pitch:0});await sleep(600);await q.send('board-floor-probe');
 const stops=q.state().dashCollisionStops;await q.send('dash-jump');await sleep(160);await q.send('dash-press');s=await q.wait(s=>!s.dashActive,'dash against board',4000);healthy(s);
 assert.ok(s.position.x<mount.board.x-.15);assert.ok(s.dashCollisionStops>stops);checks.push('Capsule sweep stops the dash before the board rather than crossing its collider');
 dashMeasurements.push({label:'board-stop',distance:s.dashDistance,origin:s.dashOrigin,end:s.dashEnd,obstacle:s.dashObstacle});
 await fresh();await q.send('view',{x:0,z:0,yaw:0,pitch:-85});await sleep(600);await q.send('dash-jump');await sleep(160);let ceilingStops=q.state().dashCollisionStops;
 await q.send('dash-press');s=await q.wait(s=>!s.dashActive,'ceiling collision stop',4000);healthy(s);
 assert.ok(s.dashCollisionStops>ceilingStops);assert.ok(s.dashDistance<24.7);assert.ok(s.dashEnd.y>2);
 dashMeasurements.push({label:'ceiling-stop',distance:s.dashDistance,origin:s.dashOrigin,end:s.dashEnd,obstacle:s.dashObstacle});
 checks.push('Looking almost straight up stops the dash beneath the real factory ceiling');
 await fresh();await q.send('view',{x:0,z:0,yaw:0,pitch:70});await sleep(600);await q.send('dash-jump');await sleep(160);let floorStops=q.state().dashCollisionStops;
 await q.send('dash-press');s=await q.wait(s=>!s.dashActive,'downward floor collision stop',4000);healthy(s);
 assert.ok(s.dashCollisionStops>floorStops);assert.ok(s.position.y>=floor.boardFloorY+.5);
 dashMeasurements.push({label:'floor-stop',distance:s.dashDistance,origin:s.dashOrigin,end:s.dashEnd,obstacle:s.dashObstacle});
 checks.push('A downward aimed dash stops above the floor instead of tunnelling below the map');
 await fresh();count=q.state().dashCount;await q.send('menu',{open:true});await q.send('dash-press');assert.equal(q.state().dashCount,count);await q.send('menu',{open:false});
 checks.push('Menu controls cannot trigger an air dash');
 await restore();assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8')),before);assert.deepEqual(fs.readFileSync('../userdata/settings.sav'),nativeBefore);healthy(q.state());
 const result={passed:true,version:'0.1.19',checks,dashMeasurements,nativeFarVacuum,captures,settingsPreserved:true,nativePhysics:true,spaceInputsInjectedThroughSharedHandler:true,physicalKeyboardTest:false,realPaidGifts:false};
 fs.writeFileSync('floor-vacuum-dash-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(async error=>{const state=q.state();try{await restore();}catch{}fs.writeFileSync('floor-vacuum-dash-result.json',JSON.stringify({passed:false,checks,dashMeasurements,nativeFarVacuum,captures,error:error.stack,state},null,2));console.error(error);process.exitCode=1;});
