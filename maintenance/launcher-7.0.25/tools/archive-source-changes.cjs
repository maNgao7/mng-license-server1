'use strict';
const fs=require('node:fs'),path=require('node:path');
const asar=require('D:/TikMnG-Genel-Guncelleme-20261112/launcher-release/node_modules/@electron/asar');
const root=path.resolve(__dirname,'..'),destination='D:/TikMnG-Genel-Guncelleme-20261112/github-release/maintenance/launcher-7.0.25';
const original='C:/Users/User/AppData/Local/Programs/mng-tiktok-game/resources/app.asar';
const changed=[];
function copy(file){const target=path.join(destination,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);changed.push(file);}
function walk(directory){for(const item of fs.readdirSync(path.join(root,directory),{withFileTypes:true})){
 const file=directory+'/'+item.name;if(item.isDirectory()){if(['vendor','voice-assets'].includes(item.name))continue;walk(file);}
 else if(/\.(?:js|cjs|mjs|json|css)$/.test(file)){
  let prior;try{prior=asar.extractFile(original,path.normalize(file));}catch{}
  if(!prior||!prior.equals(fs.readFileSync(path.join(root,file))))copy(file);
 }
}}
for(const file of ['main.js','package.json','package-lock.json'])copy(file);
walk('lib');for(const file of ['renderer/workspace.js','renderer/entry-videos.js'])copy(file);
for(const item of fs.readdirSync(path.join(root,'tests')))if(/\.(?:cjs|ps1)$/.test(item))copy('tests/'+item);
for(const item of fs.readdirSync(path.join(root,'tools')))if(/\.cjs$/.test(item))copy('tools/'+item);
fs.writeFileSync(path.join(destination,'README.md'),'# TikMnG 7.0.25 launcher changes\n\nChanges are based on the installed 7.0.24 app.asar. Unchanged source and runtime assets remain in that released baseline. This folder contains changed source, dependency lock and regression checks; it is not a standalone installer. Build configuration is in package.json. User data, credentials, profiles and caches are excluded.\n');
console.log(JSON.stringify({files:changed.length,paths:changed}));
