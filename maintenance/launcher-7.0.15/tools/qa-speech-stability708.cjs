'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const stage='D:/TikMnG-Release-7.0.8-build',output='D:/TikMnG-Release-7.0.8-ready/qa/speech';
const {createSpeechService}=require(path.join(stage,'lib/speech-service.cjs'));
const {createVoicePackManager}=require(path.join(stage,'lib/voice-pack-manager.cjs'));
const offline=require(path.join(stage,'lib/offline-speech.cjs'));
const profile=path.join(process.env.APPDATA,'mng-tiktok-game/mng-config.json');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function audioStats(bytes){
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');
    let data=null;for(let offset=12;offset+8<=bytes.length;){const size=bytes.readUInt32LE(offset+4);if(bytes.toString('ascii',offset,offset+4)==='data'){data=bytes.subarray(offset+8,offset+8+size);break;}offset+=8+size+(size%2);}
    assert.ok(data&&data.length>1000);let sum=0;for(let offset=0;offset+1<data.length;offset+=2)sum+=(data.readInt16LE(offset)/32768)**2;
    const rms=Math.sqrt(sum/(data.length/2));assert.ok(rms>.001);return {bytes:bytes.length,rms};
}
async function main(){
    fs.mkdirSync(output,{recursive:true});const before=hash(profile);
    const voicePacks=createVoicePackManager({root:path.join(process.env.APPDATA,'mng-tiktok-game/voices/v1')});
    assert.equal(voicePacks.list().find(pack=>pack.id==='okur-tr-v1')?.installed,true);
    const service=createSpeechService({env:{},voicePacks,windowsRunner:async()=>[]});
    const settings={provider:'offline',voiceURI:'offline:okur-tr-v1:default',voicePreset:'natural',rate:1};
    const runs=[];
    try{
        for(const text of ['Merhaba, iyi yayinlar.','Yorumlar sirayla okunuyor.','Yeni hediyeler icin tesekkurler.']){
            const start=performance.now(),result=await service.synthesize({text,...settings});
            runs.push({...audioStats(Buffer.from(result.audioBase64,'base64')),milliseconds:Math.round(performance.now()-start)});
        }
        const pending=service.synthesize({text:'Bu ses iptal edilerek sonraki yorumun devam etmesi denenecek.',...settings});
        const timer=setTimeout(()=>service.cancel(),40);
        await assert.rejects(pending);clearTimeout(timer);
        const recovered=await service.synthesize({text:'Sesli yorumlar devam ediyor.',...settings});audioStats(Buffer.from(recovered.audioBase64,'base64'));
        fs.writeFileSync(path.join(output,'recovered.wav'),Buffer.from(recovered.audioBase64,'base64'));
        assert.equal(hash(profile),before);
        const report={passed:true,actualInstalledOkurModel:true,realInference:true,sequentialComments:runs.length,nonSilentWav:true,cancellationThenRecovery:true,normalSettingsUnchanged:true,runs};
        fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
    }finally{service.close();voicePacks.close();await offline.closeOffline();}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
