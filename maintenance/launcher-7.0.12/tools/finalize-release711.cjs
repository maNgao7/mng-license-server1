'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const buildRequire=require('node:module').createRequire('C:/Users/User/Desktop/MNG-TikTok-Game/launcher/package.json');
const asar=buildRequire('@electron/asar'),yaml=buildRequire('js-yaml');
const source=path.resolve(__dirname,'..'),root='D:/TikMnG-Release-7.0.11-ready',stage='D:/TikMnG-Release-7.0.11-build';
const hash=(data,algorithm='sha256',encoding='hex')=>crypto.createHash(algorithm).update(data).digest(encoding);
const archive=path.join(root,'win-unpacked/resources/app.asar');
assert.equal(JSON.parse(asar.extractFile(archive,'package.json')).version,'7.0.11');
for(const file of ['main.js','preload.js','lib/platform.cjs','lib/widget-studio.cjs','lib/widget-snapshot.cjs','lib/stream-timer.cjs','lib/pk-state.cjs','lib/pk-profiles.cjs','lib/speech-emoji.cjs','lib/vendor/okur-worker.cjs','lib/vendor/ema-worker.cjs','lib/vendor/speech-inference-worker.cjs','lib/vendor/onnx-wasm/NOTICE.txt','lib/widget-portraits.cjs','lib/portrait-engine.cjs','lib/profile-contest-launch.cjs','lib/admin-games.json','renderer/app.js','renderer/workspace.js','renderer/widgets/royal-widgets.html','renderer/widgets/reference-widgets.html','renderer/widgets/live-score-widgets.html']){
 const packaged=hash(asar.extractFile(archive,path.normalize(file)));
 assert.equal(packaged,hash(fs.readFileSync(path.join(stage,file))),file);
 if(file!=='lib/admin-games.json')assert.equal(packaged,hash(fs.readFileSync(path.join(source,file))),file+' source');
}
assert.equal(hash(asar.extractFile(archive,'lib/admin-games.json')),hash(fs.readFileSync('D:/TikMnG-Release-7.0.10-build/lib/admin-games.json')));
for(const name of ['ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'])assert.equal(hash(fs.readFileSync(path.join(root,'win-unpacked/resources/app.asar.unpacked/lib/vendor/onnx-wasm',name))),hash(fs.readFileSync(path.join(source,'lib/vendor/onnx-wasm',name))));
for(const report of ['packaged-result','packaged-speech','widgets'])assert.equal(JSON.parse(fs.readFileSync(path.join(source,'qa/711',report+'.json'))).passed,true,report);
assert.equal(JSON.parse(fs.readFileSync(path.join(source,'qa/710/widget-refresh.json'))).passed,true);
const xml=fs.readFileSync(path.join(source,'qa/711/all-tests-verified.xml'),'utf8');assert.equal(/<failure\b|<skipped\b|<error\b/.test(xml),false);
const tests=(xml.match(/<testcase\b/g)||[]).length;assert.ok(tests>=995);
const files=[];
for(const [from,name] of [['TikMnG Setup 7.0.11.exe','TikMnG-Setup-7.0.11.exe'],['TikMnG Setup 7.0.11.exe.blockmap','TikMnG-Setup-7.0.11.exe.blockmap'],['TikMnG 7.0.11.exe','TikMnG-7.0.11-Portable.exe']]){
 const data=fs.readFileSync(path.join(root,from));fs.copyFileSync(path.join(root,from),path.join(root,name));files.push({name,bytes:data.length,sha256:hash(data),sha512:hash(data,'sha512','base64')});
}
const feed=yaml.load(fs.readFileSync(path.join(root,'latest.yml'),'utf8'));assert.equal(feed.version,'7.0.11');assert.equal(feed.sha512,files[0].sha512);assert.equal(feed.files[0].size,files[0].bytes);
feed.path=files[0].name;feed.files[0].url=files[0].name;fs.writeFileSync(path.join(root,'latest.yml'),yaml.dump(feed,{lineWidth:-1}));
const report={passed:true,version:'7.0.11',createdAt:new Date().toISOString(),launcherTests:{passed:tests,failed:0,skipped:0},packagedIPC:true,eightIndependentGiftPickers:true,actualHTTPSWidget:true,realLive2v2Observed:true,recorded2v2Replay:true,fourOriginalPKProfiles:true,portableWASMSpeechBothVoices:true,royalFrameVariants:18,notificationFrames:6,realPaidGiftTest:false,otherCustomerHardwareTest:false,signedPublisher:false,publicAdminMetadataPreserved:true,existingGamesUnchanged:true};
fs.writeFileSync(path.join(root,'KONTROL-RAPORU.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(root,'manifest-7.0.11.json'),JSON.stringify({version:'7.0.11',createdAt:new Date().toISOString(),files},null,2)+'\n');
fs.copyFileSync(path.join(source,'RELEASE-NOTES-7.0.11.md'),path.join(root,'RELEASE-NOTES-7.0.11.md'));
fs.writeFileSync(path.join(root,'YUKLEME-TALIMATI.txt'),'TikMnG 7.0.11\r\n\r\nBu klasordeki dort dosyayi mevcut Drive klasorune yukleyin. Ayni adlilarda mevcut dosyayi degistirin. Eski EXE ve kayitlari silmeyin.\r\n\r\nGitHub ana guncelleme kaynagidir; Drive yedektir. Mevcut oyun paketleri degismemistir.\r\n\r\nDrive tamamlaninca Render > Manual Deploy > Deploy latest commit. Surum 7.0.11 olmali. Uygulamayi kaldirmayin.\r\nWindows yayinci sertifikasi yoktur; SmartScreen uyarisi gorulebilir.\r\n');
const folders=['D:/TikMnG-Drive-7.0.11-Hazir',path.join(process.env.USERPROFILE,'Desktop/TikMnG-Drive-7.0.11')];
for(const folder of folders){fs.mkdirSync(folder,{recursive:true});for(const name of [files[0].name,'latest.yml','manifest-7.0.11.json','YUKLEME-TALIMATI.txt']){fs.copyFileSync(path.join(root,name),path.join(folder,name));assert.equal(hash(fs.readFileSync(path.join(folder,name))),hash(fs.readFileSync(path.join(root,name))));}}
console.log(JSON.stringify({report,folders,files}));
