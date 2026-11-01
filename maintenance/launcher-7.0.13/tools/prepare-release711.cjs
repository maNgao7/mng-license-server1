'use strict';
const fs=require('node:fs'),path=require('node:path'),source=path.resolve(__dirname,'..'),stage='D:/TikMnG-Release-7.0.11-build',output='D:/TikMnG-Release-7.0.11-ready';
for(const folder of [stage,output])fs.mkdirSync(folder,{recursive:true});
for(const file of ['main.js','preload.js','license-server.txt','package-lock.json'])fs.copyFileSync(path.join(source,file),path.join(stage,file));
for(const folder of ['lib','renderer','build'])fs.cpSync(path.join(source,folder),path.join(stage,folder),{recursive:true});
fs.copyFileSync('D:/TikMnG-Release-7.0.10-build/lib/admin-games.json',path.join(stage,'lib/admin-games.json'));
const pkg=JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8'));pkg.build.directories.output=output;pkg.build.releaseInfo={releaseNotes:fs.readFileSync(path.join(source,'RELEASE-NOTES-7.0.11.md'),'utf8')};pkg.build.files.push('!lib/portrait-engine/**/*','!node_modules/onnxruntime-node/**/*');fs.writeFileSync(path.join(stage,'package.json'),JSON.stringify(pkg,null,2));
if(!fs.existsSync(path.join(stage,'node_modules')))fs.symlinkSync('D:/TikMnG-Release-7.0.10-build/node_modules',path.join(stage,'node_modules'),'junction');
console.log(JSON.stringify({stage,output,version:pkg.version}));
