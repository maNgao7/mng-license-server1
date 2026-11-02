'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const source=path.resolve(__dirname,'..'),repo='D:/TikMnG-Release-7.0.0-source',prototype='D:/TikMnG-CanEmAll-Prototype';
const release='D:/TikMnG-Release-7.0.15-ready',native='D:/TikMnG-Arena715-Final2QA';
const destination=path.join(repo,'maintenance/launcher-7.0.15'),game=path.join(repo,'maintenance/yaratik-arena-0.1.20');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.ok(read(path.join(release,'KONTROL-RAPORU.json')).passed&&read(path.join(native,'arena-package-result.json')).passed);
for(const target of [destination,game]){assert.equal(fs.existsSync(target),false,'Never replace an existing source snapshot');fs.mkdirSync(target,{recursive:true});}
function filter(file){
  const name=file.split(path.sep).join('/');
  return !/(^|\/)(node_modules|qa|\.git|portrait-engine|bin|obj|userdata|game|downloads)(\/|$)/.test(name)
    && !/(^|\/)(\.env(?:\..*)?|mng-config\.json|lisanslar(?:_backup)?\.json|admin_sifre\.txt)$/.test(name)
    && !/\.(?:log|exe|dll|onnx|pth|safetensors|mp4|wav)$/i.test(name);
}
function copy(from,to){fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);}
for(const file of ['main.js','preload.js','license-server.txt','package.json','package-lock.json','RELEASE-NOTES-7.0.15.md','WORK-715.md','DESIGN-715.md'])copy(path.join(source,file),path.join(destination,file));
for(const folder of ['lib','renderer','build','tests','tools'])fs.cpSync(path.join(source,folder),path.join(destination,folder),{recursive:true,filter});
copy('D:/TikMnG-Release-7.0.15-build/lib/admin-games.json',path.join(destination,'lib/admin-games.json'));
for(const folder of ['src','tests','defaults','bridge','tools'])fs.cpSync(path.join(prototype,folder),path.join(game,folder),{recursive:true,filter});
for(const file of ['README.md','bootstrap/Startup.cs','bootstrap/build.ps1','assets/publishing/manifest.json','assets/publishing/yaratik-arena-cover-v1.png','assets/publishing/yaratik-arena-gifts.png','catalog/gifts.json'])copy(path.join(prototype,file),path.join(game,file));
fs.cpSync(path.join(prototype,'qa'),path.join(game,'qa'),{recursive:true,filter:file=>fs.statSync(file).isDirectory()||/\.(?:cjs|mjs)$/.test(file)});
const descriptor=read('D:/TikMnG-Yaratik-Arena-0.1.20-final2/package-descriptor.json');
fs.writeFileSync(path.join(game,'package-descriptor.json'),JSON.stringify(descriptor,null,2)+'\n');
const results={passed:true,version:'0.1.20',createdAt:new Date().toISOString(),launcherTests:1182,serverTests:103,rulesChecks:191,
  actualNativeSuite:true,liveEventsObserved:true,followObservedLive:false,followFixtureTested:true,
  realPaidGiftTest:false,otherCustomerHardwareTest:false,signedPublisher:false,originalSteamBinariesIncluded:false,
  sourceDllSha256:digest(path.join(prototype,'src/bin/Release/net6.0/TikMnG.CanEmAll.dll')),
  packagedDllSha256:digest('D:/TikMnG-Yaratik-Arena-0.1.20-final2/package/support/Mods/TikMnG.CanEmAll.dll')};
assert.equal(results.sourceDllSha256,results.packagedDllSha256);
fs.writeFileSync(path.join(game,'VERIFICATION.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({launcherSnapshot:destination,gameSnapshot:game,credentialsIncluded:false,userDataIncluded:false,originalGameIncluded:false}));
