'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=path.resolve(__dirname,'..'),stage='D:/TikMnG-Release-7.0.14-build',destination='D:/TikMnG-Release-7.0.0-source/maintenance/launcher-7.0.14';
assert.equal(fs.existsSync(path.join(destination,'package.json')),false,'Do not overwrite a source snapshot');
fs.mkdirSync(destination,{recursive:true});
function filter(file){
 const relative=path.relative(source,file).split(path.sep).join('/');
 return !/(^|\/)(node_modules|qa|\.git|portrait-engine)(\/|$)/.test(relative)&&
  !/(^|\/)(\.env(?:\..*)?|mng-config\.json|lisanslar(?:_backup)?\.json|admin_sifre\.txt)$/.test(relative)&&
  !/\.(?:log|exe|dll|onnx|pth|safetensors|mp4|wav)$/i.test(relative);
}
for(const file of ['main.js','preload.js','license-server.txt','package.json','package-lock.json','RELEASE-NOTES-7.0.14.md','WORK-714.md'])fs.copyFileSync(path.join(source,file),path.join(destination,file));
for(const directory of ['lib','renderer','build','tests','tools'])fs.cpSync(path.join(source,directory),path.join(destination,directory),{recursive:true,filter});
fs.copyFileSync(path.join(stage,'lib/admin-games.json'),path.join(destination,'lib/admin-games.json'));
console.log(JSON.stringify({sourceSnapshot:destination,includesCredentials:false,includesUserProfiles:false}));
