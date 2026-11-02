'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),sharp=require('../bridge/node_modules/sharp'),q=require('./commands.cjs');
const checks=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));let before,nativeBefore;
async function main(){
 await q.wait(s=>s.ready&&s.version==='0.1.20'&&s.firstFrameRendered,'startup ready',40000);
 await sleep(350);
 const launch=JSON.parse(fs.readFileSync('startup-launch.json'));
 assert.equal(launch.outcome,'ready');assert.equal(launch.gameProcessId,q.state().processId);
 assert.ok(Date.parse(launch.firstPaintUtc)<=Date.parse(launch.gameStartedUtc));
 assert.equal(launch.gameInitiallyVisible,false);assert.ok(launch.ownerAttachedUtc&&launch.revealedUnderCoverUtc);
 const releaseMs=Date.parse(launch.closedUtc)-Date.parse(launch.readyFrameUtc);
 assert.ok(releaseMs>=150&&releaseMs<650,'short readiness-based handoff, no multi-second hold');assert.ok(launch.paintedFrames>20);
 checks.push('Cover paints before the native game starts; hidden Unity client is revealed only under its owned cover; correct process first-frame readiness releases it in under 650ms');
 const pixels=[];
 for(const width of [1280,800]){
  const a=await sharp('startup-preview-'+width+'-a.png').removeAlpha().raw().toBuffer({resolveWithObject:true});
  const b=await sharp('startup-preview-'+width+'-b.png').removeAlpha().raw().toBuffer();
  assert.equal(a.info.width,width);assert.equal(a.info.height,width===1280?720:600);
  let changed=0,white=0;for(let i=0;i<a.data.length;i+=3){if(Math.abs(a.data[i]-b[i])+Math.abs(a.data[i+1]-b[i+1])+Math.abs(a.data[i+2]-b[i+2])>20)changed++;if(a.data[i]>245&&a.data[i+1]>245&&a.data[i+2]>245)white++;}
  assert.ok(changed>1000);assert.ok(white/(a.info.width*a.info.height)<.25);
  pixels.push({width,changedPixels:changed,whiteFraction:white/(a.info.width*a.info.height)});
 }
 assert.equal(JSON.parse(fs.readFileSync('startup-error-preview.json')).outcome,'error');
 assert.ok(JSON.parse(fs.readFileSync('startup-no-art-preview.json')).paintedFrames>10);
 checks.push('Bitmap and actual form previews render at desktop/compact sizes; animation frames differ; missing-art and error layouts remain nonwhite and legible');
 before=JSON.parse(fs.readFileSync('../userdata/mod-settings.json'));nativeBefore=fs.readFileSync('../userdata/settings.sav');
 assert.deepEqual(nativeBefore,fs.readFileSync('before-0.1.20-startup-20261101/settings-user-audio-approved.sav'));
 await q.send('lock',{enabled:true});await q.send('live-events-pause',{enabled:true});await q.send('native-resume');await q.send('menu',{open:false});await q.send('auto-play',{enabled:false});await q.send('reset');
 await q.send('audio-probe');let audio=JSON.parse(fs.readFileSync('audio-probe.json'));
 assert.equal(audio.nativeMaster,71);assert.equal(audio.nativeMusic,3);assert.equal(audio.nativeSfx,80);
 assert.equal(audio.listenerPaused,false);assert.equal(audio.listenerVolume,before.Volume);assert.equal(audio.audioError,'');
 await q.send('audio-defaults-probe');const defaults=JSON.parse(fs.readFileSync('audio-defaults-probe.json'));
 const old=JSON.parse(defaults.before),seeded=JSON.parse(defaults.after);
 assert.equal(seeded.masterVolume,71);assert.equal(seeded.musicVolume,3);assert.equal(seeded.sfxVolume,80);
 for(const key of ['masterVolume','musicVolume','sfxVolume']){delete old[key];delete seeded[key];}assert.deepEqual(seeded,old,'default audio leaves all native graphics/control fields alone');
 checks.push('Actual restored sliders are master 71, music 3, effects 80; first-install preset changes only those three fields, not graphics or controls');
 await q.send('audio-sample');await q.send('spawn',{count:2,user:'qa_startup_sound'});await q.wait(s=>s.Alive===2&&s.pending===0,'post-intro native gameplay',15000);await sleep(400);await q.send('audio-probe');audio=JSON.parse(fs.readFileSync('audio-probe.json'));
 assert.ok(audio.qaAudioPeak>.00001,'real engine audio output is nonzero');assert.equal(audio.audioError,'');
 const s=await q.send('capture');assert.equal(s.hudError,'');assert.equal(s.survivalError,'');assert.equal(s.failed,false);
 checks.push('After handoff normal native spawning, HUD and real engine sound output work; startup host adds no intro audio');
 assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json')),before);assert.deepEqual(fs.readFileSync('../userdata/settings.sav'),nativeBefore);
 const result={passed:true,version:s.version,checks,pixels,releaseMs,launch,gameCapture:'capture-'+s.seq+'.png',audio:{master:audio.nativeMaster,music:audio.nativeMusic,effects:audio.nativeSfx,listener:audio.listenerVolume,enginePeak:audio.qaAudioPeak},settingsPreserved:true,nativeSettingsBaseline:'User changed audio to 71/3/80 during this task; that newer saved file, not the earlier backup, is the baseline.',notPublished:true};
 fs.writeFileSync('startup-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
async function restore(){if(!before)return;await q.send('reset');await q.send('menu',{open:false});await q.send('lock',{enabled:false});await q.send('live-events-pause',{enabled:false});assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json')),before);assert.deepEqual(fs.readFileSync('../userdata/settings.sav'),nativeBefore);}
main().catch(e=>{console.error(e);fs.writeFileSync('startup-failure.json',JSON.stringify({error:e.stack,checks,state:q.state()},null,2));process.exitCode=1;}).finally(restore);
