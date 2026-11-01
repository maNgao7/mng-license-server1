'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createSpeechEngine}=require('../renderer/speech-engine.js');
const samples=require('../renderer/speech-previews.js');
const {createSpeechPreviewResources}=require('../lib/speech-preview-resources.cjs');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
test('the packaged preload bridge permits only the registered preview-save IPC action',async()=>{
    let api;const calls=[];
    require('node:vm').runInNewContext(fs.readFileSync(path.join(__dirname,'../preload.js'),'utf8'),{require(name){assert.equal(name,'electron');return{contextBridge:{exposeInMainWorld(_name,value){api=value;}},ipcRenderer:{invoke:(channel,data)=>{calls.push({channel,data});return Promise.resolve({saved:true});}}};},Promise});
    assert.equal((await api.workspace('speech-preview-save',{voiceURI:'chatterbox:d2-00331'})).saved,true);assert.equal(calls[0].channel,'workspace-speech-preview-save');
    await assert.rejects(api.workspace('read-arbitrary-file',{path:'C:/private'}));assert.equal(calls.length,1);
});
function fixture(t){
    const audio=[],calls=[];
    class Audio{constructor(src){this.src=src;audio.push(this);}play(){this.played=true;return Promise.resolve();}pause(){this.paused=true;}removeAttribute(){this.src='';}load(){this.loaded=true;}}
    const scope={Audio,setTimeout,clearTimeout,URL:{revokeObjectURL(){},createObjectURL(){return'blob:qa';}},atob:value=>Buffer.from(value,'base64').toString('binary'),Blob};
    const bridge={synthesize:async data=>{calls.push(['synthesize',data]);return new Promise(()=>{});},cancel:()=>{calls.push(['cancel']);}};
    const engine=createSpeechEngine({scope,bridge});t.after(()=>engine.dispose());return{audio,calls,engine};
}
test('all twelve owned voices have bounded sample paths and the requested welcome message',()=>{
    assert.equal(Object.keys(samples.files).length,12);assert.match(samples.text,/^Tik MNG Game Launcher'a hoş geldiniz\./);assert.ok(!samples.text.startsWith('Merhaba'));
    for(const uri of Object.keys(samples.files))assert.match(samples.source(uri),/^assets\/voice-previews\/[a-z0-9-]+\.wav$/);
    for(const uri of ['__proto__','constructor','chatterbox:../../secret','https://remote.invalid/voice.wav','chatterbox:d1-99999'])assert.equal(samples.source(uri),null);
});
test('previews play immediately without downloading, synthesizing or changing speed',async t=>{
    const f=fixture(t),play=f.engine.preview(samples.source('chatterbox:d2-00331'),{volume:.4,rate:2});
    assert.equal(f.audio.length,1);assert.equal(f.audio[0].played,true);assert.equal(f.audio[0].volume,.4);assert.equal(f.audio[0].playbackRate,1);assert.deepEqual(f.calls,[]);
    f.audio[0].onended();assert.equal((await play).preview,true);assert.equal(f.audio[0].paused,true);
});
test('all twelve shipped audio previews have verified, distinct WAV content',()=>{
    const resources=createSpeechPreviewResources(),hashes=[];
    for(const uri of Object.keys(samples.files)){
        const {data}=resources.get(uri);assert.ok(data.length>1000);assert.equal(data.toString('ascii',0,4),'RIFF');
        hashes.push(crypto.createHash('sha256').update(data).digest('hex'));
    }
    assert.equal(new Set(hashes).size,12);
});
test('starting another preview stops the previous audio and never cancels a nonexistent backend job',async t=>{
    const f=fixture(t),first=f.engine.preview(samples.source('chatterbox:d2-00331')).catch(error=>error);
    const second=f.engine.preview(samples.source('chatterbox:d2-00919')).catch(error=>error);
    assert.equal((await first).code,'SPEECH_CANCELLED');assert.equal(f.audio[0].paused,true);assert.equal(f.audio[1].played,true);
    f.engine.stop();assert.equal((await second).code,'SPEECH_CANCELLED');assert.equal(f.audio[1].paused,true);assert.deepEqual(f.calls,[]);
});
test('preview replaces in-flight speech and cannot play late synthesized audio',async t=>{
    const f=fixture(t),speech=f.engine.speak('Test',{voiceURI:'windows:qa'}).catch(error=>error);await turn();
    const preview=f.engine.preview(samples.source('offline:ema-tr-v1:default'));assert.equal((await speech).code,'SPEECH_CANCELLED');
    assert.equal(f.calls.filter(([type])=>type==='cancel').length,1);assert.equal(f.audio.length,1);f.audio[0].onended();await preview;
});
test('unsafe or missing previews fail explicitly and release playback resources',async t=>{
    const f=fixture(t);await assert.rejects(f.engine.preview('https://external.invalid/audio.wav'),{code:'PREVIEW_UNAVAILABLE'});assert.equal(f.audio.length,0);
    const preview=f.engine.preview(samples.source('chatterbox:d2-00331'));f.audio[0].onerror();await assert.rejects(preview,{code:'PREVIEW_UNAVAILABLE'});assert.equal(f.audio[0].paused,true);
});
test('sample downloads accept only registered IDs and verified bundled audio bytes',t=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-speech-preview-unit-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
    const data=Buffer.alloc(48);data.write('RIFF');data.writeUInt32LE(40,4);data.write('WAVE',8);
    const voiceURI='chatterbox:d2-00331',file=samples.files[voiceURI],sha256=crypto.createHash('sha256').update(data).digest('hex');
    const manifest={text:samples.text,voices:[{voiceURI,file,bytes:data.length,sha256,name:'Ece'}]};
    fs.writeFileSync(path.join(root,file),data);fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest));
    const resources=createSpeechPreviewResources({root});assert.deepEqual(resources.get(voiceURI).data,data);assert.equal(resources.get(voiceURI).filename,'Ece - Tik MNG.wav');
    for(const uri of ['__proto__','../../outside','file://secret','chatterbox:d1-99999'])assert.throws(()=>resources.get(uri),{code:'PREVIEW_UNAVAILABLE'});
    fs.writeFileSync(path.join(root,file),'tampered');assert.throws(()=>resources.get(voiceURI),/doğrulanamadı/);
    manifest.voices[0].file='../outside.wav';fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest));assert.throws(()=>resources.get(voiceURI),/doğrulanamadı/);
});
