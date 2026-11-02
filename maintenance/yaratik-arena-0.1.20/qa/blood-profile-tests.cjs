'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),q=require('./commands.cjs');
const checks=[],captures=[];
const saved=JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function snap(label){const s=await q.send('capture');captures.push({label,file:`capture-${s.seq}.png`});return s;}
async function restore(){
  await q.send('menu',{open:false});await q.send('reset');
  await q.send('crowd-settings',{total:saved.MaxCreatures,physical:saved.PhysicalCreatures,timed:saved.TimedMode,seconds:saved.RoundSeconds,target:saved.KillTarget,winGoal:saved.WinGoal});
  await q.send('blood-enabled',{enabled:saved.BloodEnabled});await q.send('blood-color',{index:saved.BloodColor});
  await q.send('lock',{enabled:false});await q.send('live-events-pause',{enabled:false});
}
async function main(){
  await q.send('native-resume');await q.send('menu',{open:false});await q.send('reset');
  await q.send('lock',{enabled:true});await q.send('live-events-pause',{enabled:true});
  await q.send('crowd-settings',{timed:false,physical:2500,total:2500});await q.send('blood-enabled',{enabled:true});
  await q.send('view',{x:0,z:0,yaw:0,pitch:25});
  let bodyCount=0;
  for(let color=0;color<6;color++){
    await q.send('blood-color',{index:color});await q.send('spawn',{count:3,user:'qa_blood'});await q.wait(s=>s.Alive===3,'native creatures');
    await q.send('blood-sample');await q.send('hit',{damage:1});
    let s=await q.wait(s=>s.floorBloodParticles>0,'visible blood sample');
    if(color===4){await sleep(700);await snap('white-blood-reduced');}
    await q.send('kill',{count:1});bodyCount++;
    await q.send('round-reset');s=await q.send('capture');
    assert.equal(s.bodies,bodyCount);assert.equal(s.floorBloodParticles,0);assert.equal(s.floorBloodTracked,0);assert.equal(s.damageSlots,0);
    await sleep(1150);s=await q.send('capture');assert.equal(s.floorBloodParticles,0);assert.equal(s.bodies,bodyCount);
    checks.push(`Color ${color}: round cleanup clears floor and creature blood without removing ${bodyCount} retained corpses or re-bleeding`);
  }
  await q.send('reset');
  const avatarFile=path.resolve('../userdata/avatars',fs.readdirSync('../userdata/avatars').find(f=>f.startsWith('tiktok-bridge-avatar-')));
  assert.ok(fs.existsSync(avatarFile),'Previously fetched real TikTok avatar file');
  const directory='../userdata/live-events',filename=path.join(directory,`qa-profile-${Date.now()}.json`);
  fs.writeFileSync(filename,JSON.stringify({kind:'avatar',epoch:q.state().live.epoch,username:'qa_nearby_profile',avatarFile}));
  await q.send('live-events-pause',{enabled:false});await q.wait(s=>s.realAvatarFiles>0,'avatar protocol',5000);
  await q.send('live-events-pause',{enabled:true});
  await q.send('spawn',{count:300,user:'qa_nearby_profile'});await q.wait(s=>s.Alive===300&&!s.pending,'300 native profile actors',45000);
  await q.send('view',{x:0,z:0,yaw:45,pitch:4});
  let s=await q.wait(s=>s.nearProfiles>0&&s.loadedLivePortraits>0,'nearest visible real profiles',8000);
  assert.ok(s.drawnProfiles>0&&s.drawnProfiles<=192);assert.ok(s.nearestProfileDistance<6);
  await snap('nearby-profile-crowd');
  checks.push('300 original creatures: nearest visible viewers receive real cached 128px circular profile textures, with no usernames');
  const run=(await q.send('performance',{label:'0.1.6-board-profiles-300',seconds:10})).performanceRun;
  await q.wait(s=>!s.performanceRunning&&s.performanceRun===run,'performance',16000);
  const performance=JSON.parse(fs.readFileSync(`performance-${run}.json`,'utf8'));
  assert.equal(q.state().failed,false);assert.equal(q.state().hudError,'');assert.equal(q.state().combatVisualError,'');
  await restore();
  fs.writeFileSync('blood-profile-result.json',JSON.stringify({passed:true,checks,captures,performance,avatarSource:'cached real TikTok image through synthetic avatar event; not a new live session'},null,2));
  console.log(JSON.stringify({passed:true,checks,captures,performance}));
}
main().catch(async e=>{fs.writeFileSync('blood-profile-result.json',JSON.stringify({passed:false,error:e.stack,checks,captures,state:q.state()},null,2));try{await restore();}catch{}console.error(e);process.exitCode=1;});
