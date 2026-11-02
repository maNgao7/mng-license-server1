'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),q=require('./commands.cjs');
const before=JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8')),native=fs.readFileSync('../userdata/settings.sav');
const checks=[],captures=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
function healthy(s){assert.equal(s.failed,false);for(const key of ['survivalError','combatNavigationError','hudError','autoError','missionBoardError'])assert.equal(s[key],'',key);}
async function fresh(){await q.send('lock',{enabled:true});await q.send('live-events-pause',{enabled:true});await q.send('auto-play',{enabled:false});await q.send('menu',{open:false});await q.send('reset');await q.send('reset');await q.send('view',{x:0,z:-10,yaw:0,pitch:0});}
async function snap(label){const s=await q.send('capture');captures.push({label,file:'capture-'+s.seq+'.png'});healthy(s);return s;}
async function restore(){
 await q.send('menu',{open:false});await q.send('native-resume');await q.send('auto-play',{enabled:false});await q.send('reset');await q.send('reset');
 await q.send('combat-settings',{enabled:before.EnemyAttacks,damage:before.CreatureDamage,interval:before.CreatureAttackInterval});
 await q.send('crowd-settings',{timed:before.TimedMode,seconds:before.RoundSeconds,target:before.KillTarget,winGoal:before.WinGoal});
 await q.send('resolution',{width:1280,height:720});await q.send('view',{x:14,z:-8,yaw:48,pitch:0});
 await q.send('lock',{enabled:false});await q.send('live-events-pause',{enabled:false});
}
async function main(){
 await q.wait(s=>s.ready&&s.version==='0.1.16'&&(!process.argv[2]||s.processId===Number(process.argv[2]))&&s.combatNavigationReady&&Date.now()-fs.statSync('state.json').mtimeMs<2500,'survival ready',45000);
 await q.send('native-resume');await q.send('crowd-settings',{timed:true,seconds:3600,target:10000});await q.send('combat-settings',{enabled:true,damage:8,interval:1.2});
 await fresh();let base=q.state().creatureHits;
 await q.send('combat-fixture',{distance:8,user:'qa_chaser'});
 let s=await q.wait(s=>s.health<100,'native creature follows path and hits player',25000);healthy(s);
 assert.ok(s.combatPaths>0);assert.equal(s.lastAttacker,'qa_chaser');assert.ok(s.creatureHits>base);
 checks.push('A live native creature navigates from eight metres away and deals attributed melee damage after approaching');await snap('native-attack-health');
 await q.send('menu',{open:true});let health=q.state().health;await sleep(1400);await q.send('board-floor-probe');assert.equal(q.state().health,health);await q.send('menu',{open:false});
 checks.push('Opening the control menu pauses attacks and health loss');
 await fresh();await q.send('combat-fixture',{distance:1.5,user:'qa_wall'});await q.send('combat-wall',{enabled:true});
 await sleep(1800);await q.send('board-floor-probe');assert.equal(q.state().health,100);await q.send('combat-wall',{enabled:false});
 await q.wait(s=>s.health<100,'attack after removing solid barrier',10000);checks.push('A physical wall prevents contact damage; removing it permits the next real melee strike');
 await fresh();await q.send('combat-fixture',{distance:1.5,user:'qa_jail'});await q.wait(s=>s.Alive===1,'jail opponent');
 await q.send('effect-test',{effect:'prison',count:20});s=await q.wait(s=>s.cageActive&&s.creaturesInCage===0,'cage exclusion');health=s.health;
 await q.send('prison-move');s=await q.wait(s=>!s.prisonMovementRunning&&s.prisonMovementTravel>.5,'free movement inside cage',6000);healthy(s);
 assert.ok(s.prisonMovementTravel<=1.5);assert.equal(s.prisonMovementError,'');assert.equal(s.creaturesInCage,0);assert.equal(s.health,health);
 await sleep(2100);s=await q.send('capture');captures.push({label:'prison-walking-protected',file:'capture-'+s.seq+'.png'});assert.equal(s.creaturesInCage,0);assert.equal(s.health,health);
 checks.push('Player physics can move inside the cage but not across its walls; surrounding live creatures cannot enter or damage the prisoner');
 await q.send('effect-test',{effect:'release',count:3600});await q.wait(s=>!s.cageActive,'release');await q.wait(s=>s.health<health,'creatures attack again after release',18000);
 checks.push('Release removes the collider and navigation obstacle; enemies can approach and damage the player again');
 await fresh();await q.send('combat-settings',{enabled:true,damage:60,interval:.5});
 await q.send('combat-fixture',{distance:1.5,user:'qa_first'});s=await q.wait(s=>s.health===40,'first nonlethal native hit',8000);assert.equal(s.lastAttacker,'qa_first');
 await q.send('kill',{count:1});
 let avatar;
 const sharp=require('../bridge/node_modules/sharp');
 for(const name of fs.readdirSync('../userdata/avatars').filter(name=>name.startsWith('tiktok-bridge-avatar-'))){const m=await sharp('../userdata/avatars/'+name).metadata();if(Math.min(m.width,m.height)>=256){avatar=name;break;}}
 assert.ok(avatar,'cached real avatar fixture');
 await q.send('live-avatar-fixture',{user:'qa_final',avatarFile:require('node:path').resolve('../userdata/avatars',avatar)});
 await q.send('combat-fixture',{distance:1.5,user:'qa_final'});s=await q.wait(s=>s.roundDied&&s.defeatDrawn,'lethal native hit and death overlay',8000);healthy(s);
 assert.equal(s.health,0);assert.equal(s.killedBy,'qa_final');assert.equal(s.lastAttacker,'qa_final');assert.ok(s.defeatPortraitWidth>=200);assert.equal(s.weaponActive,false);
 const deadRound=s.Round;await snap('killer-portrait-1280');
 await q.send('resolution',{width:800,height:600});await sleep(350);await snap('killer-portrait-800');
 s=await q.wait(s=>s.Round>deadRound&&s.health===100&&!s.roundDied,'automatic full-health restart',10000);healthy(s);assert.equal(s.killedBy,'');assert.equal(s.Alive,0);
 checks.push('Only the lethal attacker appears in a large source-resolution circular portrait; after five seconds a new round starts with full health');
 await q.send('resolution',{width:1280,height:720});await q.send('combat-settings',{enabled:true,damage:8,interval:1.2});
 await fresh();await q.send('spawn',{count:12,user:'qa_auto_survival'});await q.wait(s=>s.Alive===12&&s.pending===0,'automatic opponents');
 await q.send('auto-play',{enabled:true});await sleep(8000);s=await q.send('capture');captures.push({label:'auto-survival',file:'capture-'+s.seq+'.png'});healthy(s);
 assert.ok(s.autoAttacks>0);checks.push('Automatic play continues using native weapon attacks while the survival controller is active');
 await fresh();await q.send('resolution',{width:800,height:600});await sleep(300);await snap('health-hud-800');
 await q.send('menu',{open:true,tab:3,optionPage:5});await snap('combat-options-800');
 await restore();assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8')),before);assert.deepEqual(fs.readFileSync('../userdata/settings.sav'),native);healthy(q.state());
 const result={passed:true,version:'0.1.16',checks,captures,settingsPreserved:true,nativePhysics:true,realPaidGifts:false,portraitFixture:'cached real avatar assigned to local QA attacker; not a live gift test'};
 fs.writeFileSync('survival-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(async error=>{const state=q.state();try{await restore();}catch{}fs.writeFileSync('survival-result.json',JSON.stringify({passed:false,checks,captures,error:error.stack,state},null,2));console.error(error);process.exitCode=1;});
