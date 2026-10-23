'use strict';
const fs=require('node:fs');
const path=require('node:path');
const source=path.resolve(__dirname,'..');
const repository=path.resolve(source,'../license-server');
const destination=path.join(repository,'maintenance','launcher-preview-6.5.17');
if(!fs.existsSync(path.join(repository,'.git')))throw new Error('Expected source repository is missing');
if(fs.existsSync(destination)&&!process.argv.includes('--update'))throw new Error('Snapshot already exists; inspect it before replacing');
fs.mkdirSync(destination,{recursive:true});
for(const name of ['main.js','preload.js','package.json','package-lock.json','license-server.txt','AGENTS.md','PREVIEW-ACCEPTANCE.md','DELIVERY-2026-10-22.md','QA-ROUTING-2026-10-22.md','GIFT-DESIGNER-PREVIEW.md','VOICE-DOWNLOAD-PREVIEW.md','SPEECH-SOUNDS-PREVIEW.md','LEADERBOARD-PODIUM-QA.md','build-preview.json','lib','renderer','tests','tools','scripts']){
    const from=path.join(source,name);
    if(fs.existsSync(from))fs.cpSync(from,path.join(destination,name),{recursive:true,errorOnExist:false,force:true});
}
const forbidden=[];
function audit(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const full=path.join(directory,entry.name);
    const relative=path.relative(destination,full).split(path.sep).join('/');
    const ownedVoicePreview=/^renderer\/assets\/voice-previews\/(?:d[12]-\d{5}|okur-tr-v1|ema-tr-v1)\.wav$/.test(relative);
    const ownedSound=/^renderer\/assets\/sound-effects\/[a-z0-9-]+\.wav$/.test(relative)&&require('../lib/sound-effects.cjs').CATALOG.some(sound=>relative==='renderer/assets/sound-effects/'+sound.file);
    if(entry.isSymbolicLink()||entry.name==='node_modules'||/^(mng-config|license-backup|config)\.json$/i.test(entry.name)||(/\.(exe|mp4|webm|mp3|wav|ogg|zip|asar)$/i.test(entry.name)&&!ownedVoicePreview&&!ownedSound))forbidden.push(relative);
    if(entry.isDirectory())audit(full);
}}
audit(destination);if(forbidden.length)throw new Error('Snapshot contains forbidden private/build files: '+forbidden.join(', '));
console.log('Sanitized launcher source snapshot created. No installed games, user profiles, videos or installers included.');
