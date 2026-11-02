'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),base='D:/TikMnG-mng-orbit-Widgets-7.0.2-preview.6';
const destination='D:/TikMnG-Orbit-7.0.3-release',stage=path.join(destination,'package');
if(fs.existsSync(destination))throw new Error('Release directory already exists');
const old=JSON.parse(fs.readFileSync('D:/TikMnG-Release-7.0.2-games/game-content-mng-orbit-7.0.2.json'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const release='https://github.com/maNgao7/mng-license-server1/releases/download/orbit-7.0.3/';
const changed=new Set(['public/index.html','public/panel-visibility.js','public/panel-visibility.css','public/icons/panels-top-left.svg','public/icons/lucide-LICENSE.txt']);
const entries=[];let changedBytes=0;
for(const file of old.files){
 const updated=changed.has(file.path),source=path.join(updated?root:base,file.path),bytes=fs.readFileSync(source);
 if(!updated&&(hash(bytes)!==file.sha256||bytes.length!==file.bytes))throw new Error('Baseline integrity mismatch: '+file.path);
 const target=path.join(stage,file.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);
 if(updated){const sha256=hash(bytes);fs.writeFileSync(path.join(destination,sha256+'.bin'),bytes);entries.push({path:file.path,sha256,bytes:bytes.length,url:release+sha256+'.bin'});changedBytes+=bytes.length;}else entries.push(file);
}
for(const relative of changed)if(!old.files.some(f=>f.path===relative)){
 const bytes=fs.readFileSync(path.join(root,relative)),sha256=hash(bytes),target=path.join(stage,relative);
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);fs.writeFileSync(path.join(destination,sha256+'.bin'),bytes);
 entries.push({path:relative,sha256,bytes:bytes.length,url:release+sha256+'.bin'});changedBytes+=bytes.length;
}
const marker=Buffer.from(JSON.stringify({id:'mng-orbit',version:'7.0.3'}));
fs.writeFileSync(path.join(stage,'.tikmng-package.json'),marker);
const content=Buffer.from(JSON.stringify({...old,version:'7.0.3',files:entries}));
fs.writeFileSync(path.join(destination,'game-content-mng-orbit-7.0.3.json'),content);
execFileSync('tar.exe',['-a','-cf',path.join(destination,'mng-orbit-7.0.3.zip'),'-C',stage,...fs.readdirSync(stage)],{stdio:'inherit'});
const zip=fs.readFileSync(path.join(destination,'mng-orbit-7.0.3.zip'));
const descriptor={id:'orbit',version:'7.0.3',url:release+'mng-orbit-7.0.3.zip',sha256:hash(zip),bytes:zip.length,
 files:[{path:'.tikmng-content.json',url:release+'game-content-mng-orbit-7.0.3.json',sha256:hash(content),bytes:content.length}],
 changedFiles:changed.size,changedFileBytes:changedBytes,updateTransferBytes:changedBytes+content.length,reusedFiles:old.files.length-1};
fs.writeFileSync(path.join(destination,'package-descriptor.json'),JSON.stringify(descriptor,null,2));
console.log(JSON.stringify(descriptor,null,2));
