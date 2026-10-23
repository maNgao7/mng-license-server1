'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createChatterboxPackManager,PACK}=require('../lib/chatterbox-pack-manager.cjs');
const {createChatterboxRuntime}=require('../lib/chatterbox-runtime.cjs');
const {download}=require('../lib/download.cjs');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const output=path.join('D:/TikMnG-QA-Delivery/individual-voices',stamp);
const base=path.join('D:/TikMnG-Individual-Voice-QA',stamp),root=path.join(base,'voices/chatterbox-v3');
let manager,runtime;
async function main(){
  fs.mkdirSync(output,{recursive:true});const checked=[];
  for(const file of [PACK.referenceManifest,...PACK.references]){
    const response=await fetch(file.url,{signal:AbortSignal.timeout(45000)});assert.equal(response.status,200);
    const data=Buffer.from(await response.arrayBuffer());assert.equal(data.length,file.bytes);
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'),file.sha256);
    if(file!==PACK.referenceManifest)assert.equal(data.toString('ascii',0,4),'fLaC');
    checked.push({id:file.id||'manifest',bytes:data.length});
  }
  console.log('All ten independent voice downloads and the attribution manifest verified.');
  const cache=path.join(base,'voices/.chatterbox-v3.downloads');fs.mkdirSync(cache,{recursive:true});
  // Reuse already downloaded immutable engine assets to avoid spending another 3.7 GB of bandwidth.
  for(const file of [PACK.archives[0],...PACK.models]){
    const source=file.kind==='runtime'?path.join('D:/TikMnG-Chatterbox-assets-v1',file.name):path.join('D:/TikMnG-Chatterbox-v3-ready/model-v3',file.name);
    fs.linkSync(source,path.join(cache,file.name));
  }
  const requests=[],progress=[];
  manager=createChatterboxPackManager({root,downloadFile:async(...args)=>{requests.push(args[0]);return download(...args);},onProgress:event=>{
    if(progress.at(-1)?.phase!==event.phase){progress.push({phase:event.phase,voiceId:event.voiceId,bytes:event.completedBytes,total:event.totalBytes});console.log(event.voiceId||'',event.phase,event.percent+'%');}
  }});
  const first=await manager.install({voiceId:'d2-00331'});assert.equal(first.voices.length,1);assert.equal(first.voices[0].name,'Ece');
  assert.equal(requests.length,2);assert.ok(requests.some(url=>url.endsWith('tikmng-chatterbox-voices-tr-v1.json')));
  assert.ok(requests.some(url=>url.endsWith('tikmng-chatterbox-voice-d2-00331-v1.flac')));
  const before=Object.fromEntries(['runtime/python.exe','model-v3/s3gen.pt','model-v3/t3_mtl23ls_v3.safetensors','references/d2-00331.flac'].map(file=>{const stat=fs.statSync(path.join(root,file));return[file,{size:stat.size,ino:stat.ino,mtime:stat.mtimeMs}];}));
  const sample='Merhaba! Em. En. Ge. Sesli yorum sistemine hoş geldiniz.';
  const audio=[];
  async function synthesize(voiceId){
    runtime=createChatterboxRuntime({root});const start=Date.now();
    const wav=await runtime.synthesize({text:sample,voiceURI:'chatterbox:'+voiceId,rate:1});
    assert.equal(wav.toString('ascii',0,4),'RIFF');fs.writeFileSync(path.join(output,voiceId+'.wav'),wav);
    audio.push({id:voiceId,bytes:wav.length,elapsedMs:Date.now()-start,sha256:crypto.createHash('sha256').update(wav).digest('hex')});
    runtime.close();runtime=null;console.log('Real voice sample generated:',voiceId);
  }
  await synthesize('d2-00331');
  const second=await manager.install({voiceId:'d2-00919'});assert.equal(second.voices.length,2);assert.equal(requests.length,3);
  assert.ok(requests[2].endsWith('tikmng-chatterbox-voice-d2-00919-v1.flac'));
  for(const [file,expected]of Object.entries(before)){const stat=fs.statSync(path.join(root,file));assert.deepEqual({size:stat.size,ino:stat.ino,mtime:stat.mtimeMs},expected);}
  assert.equal(manager.info().progress.totalBytes,192041);
  for(const voice of PACK.references.slice(2))assert.equal(fs.existsSync(path.join(root,'references',voice.name)),false);
  await synthesize('d2-00919');assert.notEqual(audio[0].sha256,audio[1].sha256);
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,downloadFiles:checked,firstInstallVoices:1,secondInstallVoices:2,firstNetworkFiles:2,secondNetworkFiles:1,engineCacheReused:true,engineBytesUnchanged:true,secondDownloadBytes:192041,unselectedVoicesNotInstalled:8,actualAudio:audio,sampleText:sample,progress,root},null,2));
  console.log('REAL INDIVIDUAL VOICE QA PASSED:',output);
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{runtime?.close();manager?.close();});
