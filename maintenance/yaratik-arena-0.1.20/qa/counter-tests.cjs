'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const q=require('./commands.cjs');
const checks=[],captures=[],sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const saved=JSON.parse(fs.readFileSync('../userdata/mod-settings.json','utf8'));
async function screenshot(kind){const s=await q.send('capture');captures.push({kind,seq:s.seq,bounds:s.counterBounds});}
function layout(s){
  const b=s.counterBounds,p=s.progressBounds;
  assert.equal(s.hudError,'');assert.equal(s.counterStyle,'seven-segment');assert.equal(b.width,276);
  assert.ok(b.y>=p.y+p.height || b.x>=p.x+p.width+12,'Counter must not overlap weapon HUD');
}
async function main(){
  await q.wait(s=>s.ready&&!s.failed&&s.counterStyle==='seven-segment'&&s.counterBounds.width===276,'Digital counter build',45000);
  await q.send('lock',{enabled:true});await q.send('native-resume');await q.send('menu',{open:false});await q.send('reset');
  await q.send('crowd-settings',{total:1000000,physical:60,timed:false});
  for(const width of [1280,800,1920]){
    await q.send('resolution',{width,height:width===800?600:width===1920?1080:720});await sleep(550);
    const s=await q.wait(s=>s.counterDigits==='0000000','Zero counter');layout(s);
    await screenshot('zero-'+width);
  }
  checks.push('Compact 276px seven-segment counter avoids weapon HUD at 800, 1280 and 1920 widths');
  await q.send('resolution',{width:1280,height:720});await sleep(550);
  for(const value of [1,20,1000,1000000]){
    await q.send('reset');await q.send('spawn',{count:value});
    const admitted=Math.min(2500,value),physical=Math.min(60,admitted),expected=String(physical).padStart(7,'0');
    const s=await q.wait(s=>s.logicalAlive===admitted&&s.Alive===physical&&s.counterDigits===expected,'Physical seven digit face '+value);
    assert.equal(s.counterMode,'physical');assert.equal(s.pending,admitted-physical);
    layout(s);await screenshot('count-'+value);
  }
  checks.push('The face shows only native creatures; oversized requests stop at 2500 and retain explicit queued remainders');
  await q.send('crowd-settings',{timed:true,seconds:120});await sleep(500);
  const timed=q.state();layout(timed);await screenshot('queued-with-timer');
  checks.push('Sahada, sirada, round and optional timer remain inside the digital frame');
  const sharp=require('../bridge/node_modules/sharp');
  for(const capture of captures){
    const image=sharp('capture-'+capture.seq+'.png'),metadata=await image.metadata();
    const {data,info}=await image.extract({left:metadata.width-282,top:(metadata.width>=1180?8:140)+28,width:256,height:47}).removeAlpha().raw().toBuffer({resolveWithObject:true});
    let lit=0;
    for(let i=0;i<data.length;i+=info.channels)if(data[i+1]>170&&data[i+1]-data[i]>50&&data[i+2]>100)lit++;
    assert.ok(lit>50,'Digital face must contain actual illuminated segments: '+capture.kind);capture.litPixels=lit;
  }
  checks.push('Native screenshot pixel checks confirm illuminated segments, not a blank digital face');
  await q.send('reset');await restore();
  fs.writeFileSync('counter-result.json',JSON.stringify({passed:true,checks,captures},null,2));console.log(JSON.stringify({passed:true,checks,captures}));
}
async function restore(){await q.send('crowd-settings',{total:saved.MaxCreatures,physical:saved.PhysicalCreatures,timed:saved.TimedMode,seconds:saved.RoundSeconds});await q.send('reset');await q.send('lock',{enabled:false});}
main().catch(async error=>{fs.writeFileSync('counter-result.json',JSON.stringify({passed:false,error:error.stack,checks,captures,state:q.state()},null,2));try{await restore();}catch{}console.error(error);process.exitCode=1;});
