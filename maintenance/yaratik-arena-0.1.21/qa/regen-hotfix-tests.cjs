'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const q=require('./commands.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const root=path.resolve(process.env.TIKMNG_ARENA_QA_ROOT||__dirname);
const settingsFile=path.resolve(root,'../userdata/mod-settings.json');
const checks=[],measurements=[],captures=[];
let original,lastSettings,started=false;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function readSettings(){return fs.readFileSync(settingsFile);}
function healthy(s){assert.equal(s.failed,false);for(const key of ['hudError','survivalError','combatNavigationError'])assert.equal(s[key],'',key);}
async function report(){const s=await q.send('report');healthy(s);return s;}
async function settings(op,fields){await q.send(op,fields);lastSettings=readSettings();}
async function capture(label){const s=await q.send('capture');healthy(s);captures.push({label,file:'capture-'+s.seq+'.png'});return s;}
async function fresh(){
 await q.send('menu',{open:false});await q.send('reset');await q.send('view',{x:0,z:-10,yaw:0,pitch:0});
 await sleep(2100);
}
async function realHit(kind,user){
 const before=await report();
 await q.send('team-fixture',{kind,user,x:0,z:kind==='spawn'?-7.5:-5});
 const end=Date.now()+18000;
 while(Date.now()<end){const s=await report();if(s.creatureHits>before.creatureHits)return s;await sleep(80);}
 throw new Error('No actual native '+kind+' hit');
}
async function until(predicate,label,timeout=10000){
 const end=Date.now()+timeout;
 while(Date.now()<end){const s=await report();if(predicate(s))return s;await sleep(100);}
 throw new Error(label);
}
async function restore(){
 if(!started)return;
 await q.send('menu',{open:false});await q.send('reset');
 const current=readSettings();
 assert.equal(hash(current),hash(lastSettings),'Concurrent settings edits detected; original bytes were not restored over them');
 const saved=JSON.parse(original.toString('utf8'));
 await settings('combat-settings',{enabled:saved.EnemyAttacks,playerHealth:saved.PlayerHealth,damage:saved.CreatureDamage,interval:saved.CreatureAttackInterval});
 await settings('crowd-settings',{timed:saved.TimedMode,seconds:saved.RoundSeconds,target:saved.KillTarget,winGoal:saved.WinGoal});
 assert.deepEqual(JSON.parse(readSettings().toString('utf8')),saved,'Every saved setting must match the original');
 if(!readSettings().equals(original))fs.writeFileSync(settingsFile,original);
 assert.equal(hash(readSettings()),hash(original),'User settings preserved byte-for-byte');
 await q.send('reset');await q.send('live-events-pause',{enabled:false});await q.send('lock',{enabled:false});
 checks.push('All original settings restored byte-for-byte; no original Steam files or account settings replaced');
}
async function main(){
 assert.ok(process.env.TIKMNG_ARENA_QA_ROOT,'Run only against an explicitly selected isolated QA root');
 assert.notEqual(root.toLowerCase(),path.resolve(__dirname).toLowerCase(),'Do not mutate the desktop prototype configuration');
 const initial=await q.wait(s=>s.ready&&s.version===(process.env.TIKMNG_QA_VERSION||'0.1.21')&&(!process.argv[2]||s.processId===Number(process.argv[2]))&&Date.now()-fs.statSync(path.join(root,'state.json')).mtimeMs<2500,'Fresh hotfix engine',40000);
 assert.equal(initial.failed,false);
 original=readSettings();lastSettings=original;started=true;
 await q.send('lock',{enabled:true});await q.send('live-events-pause',{enabled:true});await q.send('menu',{open:false});await q.send('auto-play',{enabled:false});
 await settings('combat-settings',{enabled:true,playerHealth:500,damage:1,interval:1.2});
 await settings('crowd-settings',{timed:true,seconds:3600,target:10000});
 await fresh();
 let s=await realHit('boss','qa_regeneration');
 assert.equal(s.health,350);const appliedHit=s.playerHitAt;
 await q.send('kill',{count:1000});
 await sleep(5000);s=await report();
 assert.equal(s.playerHitAt,appliedHit);assert.equal(s.health,350,'No health restoration during the first five seconds after a real applied hit');
 checks.push('A real Boss hit applies 150 damage and does not regenerate before the seven-second delay');
 s=await until(s=>s.health>350,'Health must begin gradual restoration after seven undamaged gameplay seconds',6500);
 assert.ok(s.health<375,'Regeneration must not jump back to full health');
 const firstHeal=s.health;const observed=Date.now();
 await sleep(1200);s=await report();
 assert.ok(s.health>firstHeal&&s.health<=firstHeal+12,'Five hundred maximum health restores slowly, not instantly');
 measurements.push({phase:'gradual-native-healing',first:firstHeal,after:s.health,observedMilliseconds:Date.now()-observed});
 checks.push('The native health meter rises gradually at the one-percent-of-maximum rate');
 s=await capture('larger-higher-health-hud');
 assert.equal(s.healthDrawn,true);assert.ok(s.healthBounds.width>=420&&s.healthBounds.width<=426);
 assert.ok(s.healthBounds.height>=75&&s.healthBounds.height<=76);
 assert.ok(Math.abs(s.healthBounds.y+s.healthBounds.height-(s.height-52))<1);
 assert.ok(s.healthBounds.x>=0&&s.healthBounds.x+s.healthBounds.width<=s.width);
 checks.push('The health HUD is eighteen percent larger, raised twenty-four pixels, and reports its actual safe bounds');
 await q.send('menu',{open:true});s=await report();const pausedHealth=s.health;
 await sleep(8200);s=await report();assert.equal(s.health,pausedHealth,'Menu pause cannot regenerate health');
 s=await q.send('menu',{open:false});
 assert.ok(s.health<=pausedHealth+1,'Resuming must not catch up healing from paused time');
 await sleep(1200);s=await report();assert.ok(s.health>pausedHealth&&s.health<=pausedHealth+12);
 checks.push('More than seven wall-clock seconds in the menu cause no healing and no catch-up burst on resume');
 await fresh();s=await realHit('boss','qa_new_delay');await q.send('kill',{count:1000});
 await q.send('menu',{open:true});const waitingHealth=(await report()).health;
 await sleep(8200);assert.equal((await report()).health,waitingHealth);
 await q.send('menu',{open:false});await sleep(5000);
 assert.equal((await report()).health,waitingHealth,'A menu pause cannot consume the damage delay');
 await until(s=>s.health>waitingHealth,'Healing resumes only after the remaining active gameplay delay',6500);
 checks.push('Pausing during the damage cooldown preserves its remaining active-time delay');
 await fresh();
 const deathHit=await realHit('bigboss','qa_regen_killer');assert.equal(deathHit.health,100);
 s=await until(s=>s.roundDied,'Second Big Boss hit must be lethal',15000);
 assert.equal(s.health,0);assert.equal(s.killedBy,'qa_regen_killer');const deathRound=s.Round;
 await q.send('menu',{open:true});await sleep(8200);s=await report();
 assert.equal(s.health,0);assert.equal(s.roundDied,true);assert.equal(s.killedBy,'qa_regen_killer');assert.equal(s.Round,deathRound);
 await q.send('menu',{open:false});
 s=await until(s=>s.Round>deathRound&&!s.roundDied,'The normal defeat flow must start a clean round',10000);
 assert.equal(s.health,500);assert.equal(s.killedBy,'');assert.equal(s.Alive,0);assert.equal(s.pending,0);
 checks.push('A dead player never regenerates or loses killer attribution; only the normal clean new round restores health');
}
(async()=>{
 let failure;
 try{await main();}catch(error){failure=error;}
 try{await restore();}catch(error){failure=failure?new AggregateError([failure,error],'Test and settings restoration failed'):error;}
 const result={passed:!failure,checks,measurements,captures,settingsHash:original?hash(original):undefined,error:failure?.stack};
 fs.writeFileSync(path.join(root,'regen-hotfix-result.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));if(failure)process.exitCode=1;
})();
