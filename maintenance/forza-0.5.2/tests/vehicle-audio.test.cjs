'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {inspectAudioSample,inspectAudioTimeline}=require('./qa-vehicle-audio.cjs');
const root=path.resolve(__dirname,'..');

function sample(username='driver',level=1,utc='2026-11-08T10:00:00.000Z'){
 const group={volumeResult:'OK',volume:.8,muteResult:'OK',muted:false,pauseResult:'OK',paused:false,audibilityResult:'OK',audibility:.5};
 const bus=(path,volume)=>({valid:true,pathResult:'OK',path,volumeResult:'OK',volume,finalVolume:volume,muteResult:'OK',muted:false,pauseResult:'OK',paused:false});
 return {utc,phase:'racing',following:username,vehicleAudio:{schemaVersion:2,faulted:false,errors:{},requested:{master:.8,engine:.8,crowd:.25,paused:false},
  core:{channelsResult:'OK',realChannels:8,masterResult:'OK',master:group},engineBus:bus('bus:/World SFX/Engines',.8),crowdBus:bus('bus:/Crowd',.25),masterBus:bus('bus:/',.8),
  listenerResult:'OK',listenerCount:1,camera:{x:5,y:3,z:20},listeners:[{index:0,result:'OK',weightResult:'OK',weight:1,position:{x:5,y:3,z:20},attenuation:{x:5,y:3,z:20}}],
  nativeEngines:[['tofas',1],['bmw',6]].map(([name,carLevel])=>({username:name,level:carLevel,valid:true,playbackResult:'OK',playback:'PLAYING',
   virtualResult:'OK',virtualized:false,maskResult:'OK',listenerMask:1,groupResult:'OK',group,replacementMuted:false})),
  custom:[],presentation:{intro:{playing:false},countdown:{playing:false}}}};
}

test('Tofas and other cars both retain native FMOD engine playback',()=>{
 for(const [name,level] of [['tofas',1],['bmw',6]]){
  const state=sample(name,level);
  assert.deepEqual(inspectAudioSample(state,{now:Date.parse(state.utc),expectedMode:level===1?'tofas':'native',expectOutput:true}).issues,[]);
 }
});

test('audio QA flags lost native playback, muted buses and listener drift',()=>{
 let state=sample();state.vehicleAudio.nativeEngines[0].playback='STOPPED';
 assert.ok(inspectAudioSample(state,{now:Date.parse(state.utc),expectOutput:true}).issues.some(issue=>issue.includes('not playing')));
 state=sample();state.vehicleAudio.engineBus.muted=true;
 assert.ok(inspectAudioSample(state,{now:Date.parse(state.utc)}).issues.some(issue=>issue.includes('Engine bus is muted')));
 state=sample();state.vehicleAudio.listeners[0].position.x=90;
 assert.ok(inspectAudioSample(state,{now:Date.parse(state.utc)}).issues.some(issue=>issue.includes('positionError')));
});

test('audio QA rejects any added replacement sound channel',()=>{
 const state=sample();state.vehicleAudio.custom=[{username:'tofas',channel:{playing:true}}];
 assert.ok(inspectAudioSample(state,{now:Date.parse(state.utc)}).issues.some(issue=>issue.includes('replacement audio')));
});

test('free camera keeps panning at the view and attenuation within reach of a native engine',()=>{
 const state=sample(null);
 const audio=state.vehicleAudio;
 audio.nativeEngines[0].position={x:205,y:3,z:20};
 audio.listeners[0].attenuation={x:193,y:3,z:20};
 const options={now:Date.parse(state.utc),expectOutput:true};
 assert.deepEqual(inspectAudioSample(state,options).issues,[]);
 audio.listeners[0].attenuation=audio.camera;
 assert.ok(inspectAudioSample(state,options).issues.some(issue=>issue.includes('free-camera engine range')));
});

test('PLAYING alone cannot hide zero engine bus gain or presentation/crowd bleed',()=>{
 let state=sample();state.vehicleAudio.engineBus.finalVolume=0;
 assert.ok(inspectAudioSample(state,{now:Date.parse(state.utc),expectOutput:true}).issues.some(issue=>issue.includes('final gain is zero')));
 state=sample();state.presentationClips={countdownPlaying:true};
 assert.ok(inspectAudioSample(state,{now:Date.parse(state.utc)}).issues.some(issue=>issue.includes('leaked into racing')));
 state=sample();state.vehicleAudio.presentation.engineOnly=true;
 assert.ok(inspectAudioSample(state,{now:Date.parse(state.utc)}).issues.some(issue=>issue.includes('Crowd audio leaked')));
});

test('successful audio channels do not hide an independent FMOD error',()=>{
 const audio=fs.readFileSync(path.join(root,'src/VehicleAudio.cs'),'utf8');
 assert.match(audio,/private void RefreshAudioFaultState\(\)=>vehicleAudioFaulted=vehicleAudioErrors\.Keys\.Any/);
 assert.match(audio,/RecordAudioError\(operation\+":exception",ex\.Message\);/);
 assert.doesNotMatch(audio,/action\(\);vehicleAudioErrors.Remove\(operation\)/);
 assert.doesNotMatch(audio,/vehicleAudioFaulted=false/);
});

test('native engine playback stays active across camera switches and settings',()=>{
 const states=[sample('tofas',1),sample('bmw',6,'2026-11-08T10:00:01.000Z'),sample('tofas',1,'2026-11-08T10:00:02.000Z')];
 const report=inspectAudioTimeline(states,{now:Date.parse(states.at(-1).utc)});
 assert.equal(report.passed,true,report.issues.join('; '));
 states[2].vehicleAudio.nativeEngines[0].playback='STOPPED';
 assert.ok(inspectAudioTimeline(states,{now:Date.parse(states.at(-1).utc)}).issues.some(issue=>issue.includes('Native engine playback stopped')));
});

test('camera changes never replace native engine events with custom race samples',()=>{
 const camera=fs.readFileSync(path.join(root,'src/CameraControl.cs'),'utf8');
 const presentation=fs.readFileSync(path.join(root,'src/Presentation.cs'),'utf8');
 const plugin=fs.readFileSync(path.join(root,'src/Plugin.cs'),'utf8');
 const audio=fs.readFileSync(path.join(root,'src/VehicleAudio.cs'),'utf8');
 assert.doesNotMatch(camera,/ClearEngineVoices|StopVehicleAudio/);
 assert.match(audio,/entry\.Car\.engineEffects/);
 assert.match(audio,/effects\.engineFmodInstance/);
 assert.match(plugin,/NativeCountdownStarted\(3\)/);
 assert.doesNotMatch(presentation,/FMOD\.Channel|race-countdown|track-intro|createSound|playSound/);
 assert.doesNotMatch(audio,/setPaused\(true\)|setMute\(true\)|STOP_MODE\.IMMEDIATE/);
});
