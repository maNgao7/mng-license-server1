'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createVoicePackManager}=require('../lib/voice-pack-manager.cjs'),{createSpeechService}=require('../lib/speech-service.cjs'),offline=require('../lib/offline-speech.cjs');
const output=path.resolve(__dirname,'../qa/710');
function inspect(bytes){assert.equal(bytes.toString('ascii',0,4),'RIFF');let data;for(let p=12;p+8<=bytes.length;){const size=bytes.readUInt32LE(p+4);if(bytes.toString('ascii',p,p+4)==='data'){data=bytes.subarray(p+8,p+8+size);break;}p+=8+size+(size%2);}assert.ok(data?.length>1000);let sum=0;for(let p=0;p+1<data.length;p+=2)sum+=(data.readInt16LE(p)/32768)**2;const rms=Math.sqrt(sum/(data.length/2));assert.ok(rms>.001);return {bytes:bytes.length,rms};}
async function main(){
    fs.mkdirSync(output,{recursive:true});const packs=createVoicePackManager({root:path.join(process.env.APPDATA,'mng-tiktok-game/voices/v1')});
    const speech=createSpeechService({env:{},voicePacks:packs,windowsRunner:async()=>[]});const runs=[];
    try{
        const catalog=await speech.status();assert.equal(catalog.voiceLibrary.length,0);assert.equal(catalog.voices.filter(v=>v.provider==='offline').length,2);
        for(const id of ['okur-tr-v1','ema-tr-v1'])for(const text of ['Merhaba, iyi yayınlar.','Yorumlar sırayla okunuyor.','Desteğiniz için teşekkür ederim.']){
            const started=performance.now(),result=await speech.synthesize({text,provider:'offline',voiceURI:'offline:'+id+':default',voicePreset:'natural',rate:1});
            const bytes=Buffer.from(result.audioBase64,'base64');runs.push({id,milliseconds:Math.round(performance.now()-started),...inspect(bytes)});fs.writeFileSync(path.join(output,id+'.wav'),bytes);
        }
        const job=speech.synthesize({text:'Bu uzun ses iptal edildikten sonra sıradaki yorumun okunmasına devam edilecek.',provider:'offline',voiceURI:'offline:okur-tr-v1:default'});const timer=setTimeout(()=>speech.cancel(),25);await assert.rejects(job);clearTimeout(timer);
        const recovery=await speech.synthesize({text:'Okumaya devam ediyorum.',provider:'offline',voiceURI:'offline:ema-tr-v1:default'});inspect(Buffer.from(recovery.audioBase64,'base64'));
        const result={passed:true,realInference:true,engines:2,runs,cancellationAndRecovery:true,bigEngineAbsent:true};fs.writeFileSync(path.join(output,'fast-speech.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
    }finally{speech.close();packs.close();await offline.closeOffline();}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
