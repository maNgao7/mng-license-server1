'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const dependencies=require('node:module').createRequire('C:/Users/User/Desktop/MNG-TikTok-Game/launcher/package.json');
const asar=dependencies('@electron/asar'),yaml=dependencies('js-yaml');
const source=path.resolve(__dirname,'..'),stage='D:/TikMnG-Release-7.0.14-build',root='D:/TikMnG-Release-7.0.14-ready';
const hash=(data,algorithm='sha256',encoding='hex')=>crypto.createHash(algorithm).update(data).digest(encoding);
const archive=path.join(root,'win-unpacked/resources/app.asar');
function suite(file,minimum){
 const text=fs.readFileSync(file,'utf8').replaceAll('\r',''),count=Number(/^.*\bpass (\d+)$/m.exec(text)?.[1]);
 assert.ok(count>=minimum,file);assert.match(text,/^.*\bfail 0$/m);assert.match(text,/^.*\bskipped 0$/m);return {passed:count,failed:0,skipped:0};
}
const launcherTests=suite(path.join(source,'test-714-final.log'),1145),serverTests=suite('D:/TikMnG-Release-7.0.0-source/qa/traffic714-server-tests.log',90);
const read=file=>JSON.parse(fs.readFileSync(path.join(source,file),'utf8'));
const packaged=read('qa-packaged714-stable.log'),speech=read('qa/714/packaged-speech.json'),baseline=read('qa/714/traffic714-baseline.json'),custom=read('qa/714/traffic714-custom.json');
assert.ok(packaged.passed&&packaged.exactDeltaProtocol&&packaged.originalProfileUnchanged&&packaged.packagedFrames.length===3);
assert.ok(speech.passed&&baseline.passed&&custom.passed);
assert.equal(JSON.parse(asar.extractFile(archive,'package.json')).version,'7.0.14');
const art=require('../lib/champion-art.json');
for(const file of ['main.js','preload.js','lib/widget-changes.cjs','lib/widget-delta.cjs','lib/widget-snapshot.cjs','lib/overlay-bridge.cjs','lib/widget-studio.cjs','lib/entry-videos.cjs','lib/champion-art.json','renderer/widgets/state-patch.js','renderer/widgets/change-transport.js','renderer/widgets/reference-widgets.html','renderer/widgets/royal-widgets.html','renderer/widgets/champion-motion.js',...Object.values(art.frames).concat(Object.values(art.textures)).map(name=>'renderer/widgets/royal-assets/'+name)]){
 const digest=hash(asar.extractFile(archive,path.normalize(file)));assert.equal(digest,hash(fs.readFileSync(path.join(stage,file))),file+' stage');assert.equal(digest,hash(fs.readFileSync(path.join(source,file))),file+' source');
}
const files=[];
for(const [from,to] of [['TikMnG Setup 7.0.14.exe','TikMnG-Setup-7.0.14.exe'],['TikMnG Setup 7.0.14.exe.blockmap','TikMnG-Setup-7.0.14.exe.blockmap'],['TikMnG 7.0.14.exe','TikMnG-7.0.14-Portable.exe']]){
 const data=fs.readFileSync(path.join(root,from));fs.copyFileSync(path.join(root,from),path.join(root,to));files.push({name:to,bytes:data.length,sha256:hash(data),sha512:hash(data,'sha512','base64')});
}
const feed=yaml.load(fs.readFileSync(path.join(root,'latest.yml'),'utf8'));
assert.equal(feed.version,'7.0.14');assert.equal(feed.sha512,files[0].sha512);assert.equal(feed.files[0].size,files[0].bytes);
feed.path=files[0].name;feed.files[0].url=files[0].name;fs.writeFileSync(path.join(root,'latest.yml'),yaml.dump(feed,{lineWidth:-1}));
const report={passed:true,version:'7.0.14',createdAt:new Date().toISOString(),launcherTests,serverTests,packaged,speech,
 traffic:baseline.traffic,trafficMeasurement:baseline.measurement,customStyles:Object.fromEntries(Object.entries(custom.styles).map(([kind,row])=>[kind,{stableCanvas:row.stableCanvas,scoreGiftChanges:row.scoreGiftChanges,duplicateGiftDispatches:row.duplicateGiftDispatches,initial:row.initial,updates:row.updates,reload:row.reload}])),
 originalProfilesUnchanged:true,invoiceReductionGuaranteed:false,realPaidGiftTest:false,otherCustomerHardwareTest:false,signedPublisher:false};
fs.writeFileSync(path.join(root,'KONTROL-RAPORU.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(root,'manifest-7.0.14.json'),JSON.stringify({version:'7.0.14',createdAt:new Date().toISOString(),files},null,2)+'\n');
fs.copyFileSync(path.join(source,'RELEASE-NOTES-7.0.14.md'),path.join(root,'RELEASE-NOTES-7.0.14.md'));
console.log(JSON.stringify({passed:true,root,launcherTests,serverTests,files}));
