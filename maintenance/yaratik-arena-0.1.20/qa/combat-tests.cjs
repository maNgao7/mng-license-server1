'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {state,send,wait}=require('./commands.cjs');
const checks=[],captures=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const settings=()=>JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8'));
const saved=settings();
async function main(){
  await wait(s=>s.ready&&!s.failed&&'bloodColor' in s,'Combat build startup',45000);
  await send('lock',{enabled:true});
  await send('menu',{tab:3,optionPage:1,open:true});
  await wait(s=>s.menuRendered&&s.optionPage===1&&!s.hudError,'B appearance settings');
  captures.push({kind:'settings-1280',seq:(await send('capture')).seq});
  await send('resolution',{width:800,height:600});await sleep(600);
  captures.push({kind:'settings-800',seq:(await send('capture')).seq});
  checks.push('B appearance settings render at 1280x720 and 800x600');
  await send('resolution',{width:1280,height:720});await sleep(600);
  await send('menu',{open:false});await send('reset');
  const names=['Kirmizi','Pembe','Kahverengi','Turuncu','Beyaz','Siyah'];
  for(let index=0;index<names.length;index++){
    const s=await send('blood-color',{index});
    assert.equal(s.bloodColor,names[index]);assert.equal(s.combatVisualError,'');
    assert.ok(s.bloodMaterialCount>=20);assert.ok(s.bloodParticleCount>0);
    assert.equal(settings().BloodColor,index);
    await send('blood-sample');await sleep(150);
    captures.push({kind:names[index],seq:(await send('capture')).seq});
  }
  checks.push('Six colors update real blood materials and particle systems, and save individually');
  await send('spawn',{count:2});await wait(s=>s.Alive===2,'Damage victims');
  const before=state().confirmedHits;
  await send('hit',{damage:0});assert.equal(state().confirmedHits,before);
  checks.push('Zero damage does not produce an isabet marker');
  await send('hit-marker',{enabled:true});
  const hit=await send('hit',{damage:1});
  assert.equal(hit.confirmedHits,before+1);assert.equal(hit.hitMarkerActive,true);assert.equal(hit.Kills,0);
  captures.push({kind:'actual-hit',seq:(await send('capture')).seq});
  await wait(s=>!s.hitMarkerActive,'Marker expires',3000);
  checks.push('Actual native damage confirms a hit; marker expires without adding a kill');
  await send('hit-marker',{enabled:false});
  const disabled=await send('hit',{damage:1});assert.equal(disabled.confirmedHits,before+2);assert.equal(disabled.hitMarkerActive,false);
  assert.equal(settings().HitMarker,false);checks.push('Marker can be disabled without disabling damage');
  await send('hit-marker',{enabled:true});await send('hit',{damage:100});
  assert.equal(state().Kills,1);assert.equal(state().Alive,1);checks.push('Lethal native damage still counts exactly one kill');
  await send('blood-color',{index:saved.BloodColor});await send('hit-marker',{enabled:saved.HitMarker});await send('reset');await send('lock',{enabled:false});
  fs.writeFileSync('combat-result.json',JSON.stringify({passed:true,checks,captures,final:state()},null,2));
  console.log(JSON.stringify({passed:true,checks,captures}));
}
main().catch(async error=>{fs.writeFileSync('combat-result.json',JSON.stringify({passed:false,error:error.stack,checks,captures},null,2));try{await send('blood-color',{index:saved.BloodColor});await send('hit-marker',{enabled:saved.HitMarker});await send('menu',{open:false});await send('lock',{enabled:false});}catch{}console.error(error);process.exitCode=1;});
