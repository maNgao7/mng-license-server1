'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {state,send,wait}=require('./commands.cjs');
async function main(){
  const checks=[];
  await send('lock',{enabled:true});
  for(const distance of [2,8,12,8,12]){
    await send('reset');
    await send('spawn',{count:1,user:'Canli kontrol'});
    await wait(s=>s.Alive===1&&s.pending===0,'Live control');
    const before=state().vacuumCollected;
    await send('vacuum-hold',{distance});
    await wait(s=>s.vacuumCollected===before+1&&s.bodies===0,'Vacuum at '+distance,10000);
    const s=state();
    assert.equal(s.Alive,1);assert.equal(s.Kills,1);assert.equal(s.vacuumStored,0);
    assert.ok(s.qaVacuumStartDistance>=distance-1);assert.equal(s.vacuumRange,14);
    checks.push({requestedDistance:distance,actualDistance:s.qaVacuumStartDistance,liveUnharmed:true,collected:s.vacuumCollected});
  }
  await send('reset');
  fs.writeFileSync('vacuum-range-result.json',JSON.stringify({passed:true,checks},null,2));
  console.log(JSON.stringify({passed:true,checks}));
}
main().catch(e=>{fs.writeFileSync('vacuum-range-result.json',JSON.stringify({passed:false,error:e.stack,state:state()},null,2));console.error(e);process.exitCode=1;});
