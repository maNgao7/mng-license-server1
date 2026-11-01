'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const directory = path.resolve(process.argv[2] || 'D:/TikMnG-Release-7.0.0-media');
const manifest = JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
const repo = 'maNgao7/mng-license-server1';
const tag = 'media-7.0.0';
function gh(args) { return execFileSync('gh',args,{encoding:'utf8',maxBuffer:8*1024*1024,timeout:180000,windowsHide:true}); }
function release() { try{return JSON.parse(gh(['release','view',tag,'--repo',repo,'--json','id,isDraft,assets,url']));}catch{return null;} }
if(manifest.tag !== tag || manifest.media.length !== 285)throw new Error('Unexpected media release.');
let current = release();
if(!current){gh(['release','create',tag,'--repo',repo,'--draft','--title','TikMnG 7.0.0 - Media Library','--notes','Media assets are downloaded separately from the launcher. The accompanying manifest retains source labels and attribution notices. Distribution permission was confirmed by the project owner on 2026-10-23.','--latest=false']);current=release();}
const existing = new Map(current.assets.map(asset=>[asset.name,asset]));
const files = [];
for(const item of manifest.media){
  if(item.filename !== item.sha256 + path.extname(item.filename))throw new Error('Unexpected asset name.');
  const file = path.join(directory,item.filename),bytes=fs.readFileSync(file);
  if(bytes.length !== item.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== item.sha256)throw new Error('Invalid staged asset '+item.id);
  if(existing.has(item.filename)){if(existing.get(item.filename).size !== item.bytes)throw new Error('Existing asset size differs.');}
  else files.push(file);
}
for(let start=0;start<files.length;start+=8){
  gh(['release','upload',tag,'--repo',repo,...files.slice(start,start+8)]);
  console.log(`Media upload ${Math.min(start+8,files.length)}/${files.length}`);
}
if(!existing.has('manifest.json'))gh(['release','upload',tag,'--repo',repo,path.join(directory,'manifest.json')]);
current=release();
for(const item of manifest.media){const asset=current.assets.find(asset=>asset.name===item.filename);if(!asset||asset.size!==item.bytes)throw new Error('Release verification failed: '+item.id);}
if(current.isDraft)gh(['release','edit',tag,'--repo',repo,'--draft=false','--latest=false']);
console.log(JSON.stringify({published:true,url:release().url,files:285,bytes:manifest.summary.mediaBytes}));
