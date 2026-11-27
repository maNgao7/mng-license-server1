'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createSpeechEngine}=require('../renderer/speech-engine.js');
const source=fs.readFileSync(path.join(__dirname,'../renderer/workspace.js'),'utf8');
const begin=source.indexOf('    let voiceLoad='),end=source.indexOf('    let widgetPreviewObserver',begin);
function fixture({voices=[],listVoices=async()=>({voices:[{voiceURI:'offline:test'}]}),speak=async()=>({})}={}){
    const state={data:{tts:{enabled:true,cooldownSeconds:0,maxLength:180}},voices,queue:[],speaking:false,speechGeneration:0,lastUsers:new Map(),view:'games'};
    const notices=[],spoken=[];
    const engine={listVoices,speak:async(text,settings)=>{spoken.push({text,settings});return speak(text,settings);},stop(){}};
    const api=vm.runInNewContext(source.slice(begin,end)+'\n({chat,stopSpeech,updateVoices,speakNext})',{state,speechEngine:engine,speechAvailable:()=>state.voices.length>0,updateSpeechStatus(){},updateSpeechVoiceOptions(){},render(){},notify:message=>notices.push(message),setTimeout,clearTimeout,queueMicrotask,Date});
    return {state,notices,spoken,...api};
}
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
test('eligible comments begin synthesis immediately while the voice picker is loading',async()=>{
    let resolve;const f=fixture({listVoices:()=>new Promise(done=>{resolve=done;})});
    const loading=f.updateVoices();
    f.chat({username:'first',message:'Birinci yorum'});
    assert.equal(f.spoken.length,1);
    f.chat({username:'first',message:'Ikinci yorum'});await settle();
    assert.deepEqual(f.spoken.map(item=>item.text),['Birinci yorum','Ikinci yorum']);assert.ok(f.spoken.every(item=>item.settings.names===false));assert.equal(f.state.queue.length,0);
    resolve({voices:[{voiceURI:'offline:test'}]});await loading;
});
test('a transient synthesis failure never holds the next comment behind a retry delay',async()=>{
    let calls=0;const f=fixture({voices:[{}],speak:async()=>{if(++calls===1)throw Object.assign(new Error('Temporary failure'),{code:'OFFLINE_UNAVAILABLE'});return {};}});
    f.chat({username:'first',message:'Birinci'});f.chat({username:'second',message:'Ikinci'});await settle();
    assert.deepEqual(f.spoken.map(item=>item.text),['Birinci','Ikinci']);assert.equal(f.state.queue.length,0);f.stopSpeech();
});
test('permanent audio failure skips only that comment and leaves the queue running',async()=>{
    const f=fixture({voices:[{}],speak:async text=>{if(text==='Bozuk')throw Object.assign(new Error('Invalid audio'),{code:'INVALID_AUDIO'});return {};}});
    f.chat({username:'first',message:'Bozuk'});f.chat({username:'second',message:'Saglam'});await settle();
    assert.deepEqual(f.spoken.map(item=>item.text),['Bozuk','Saglam']);assert.equal(f.notices.length,1);assert.equal(f.state.queue.length,0);
});
test('temporary voice lookup failure retains previously discovered voices',async()=>{
    const f=fixture({voices:[{voiceURI:'offline:ready'}],listVoices:async()=>{throw new Error('Temporary lookup failure');}});
    await f.updateVoices(true);assert.equal(f.state.voices[0].voiceURI,'offline:ready');
});
test('stopping during synthesis discards queued comments',async()=>{
    let resolve;const f=fixture({speak:()=>new Promise(done=>{resolve=done;})});
    f.chat({username:'first',message:'Eski yorum'});f.chat({username:'second',message:'Siradaki yorum'});
    f.stopSpeech();resolve({});await settle();assert.equal(f.spoken.length,1);assert.equal(f.state.queue.length,0);
});
test('renderer timeout cancels backend work and ignores late audio',async()=>{
    let resolve,cancelled=0;const audios=[];
    const scope={setTimeout,clearTimeout,Blob,atob,URL:{createObjectURL:()=> 'blob:qa',revokeObjectURL(){}},Audio:class{constructor(){audios.push(this);}play(){return Promise.resolve();}pause(){}removeAttribute(){}load(){}}};
    const engine=createSpeechEngine({timeoutMs:15,scope,bridge:{synthesize:()=>new Promise(done=>{resolve=done;}),cancel:async()=>{cancelled++;}}});
    await assert.rejects(engine.speak('Test'),{code:'SPEECH_TIMEOUT'});assert.equal(cancelled,1);
    resolve({mimeType:'audio/wav',audioBase64:'AAAA'});await settle();assert.equal(audios.length,0);
});
