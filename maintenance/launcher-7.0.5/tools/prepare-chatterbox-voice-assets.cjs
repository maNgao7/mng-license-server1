'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PACK}=require('../lib/chatterbox-pack-manager.cjs');
const source=process.argv[2],destination=process.argv[3];
if(!source||!destination||!path.isAbsolute(source)||!path.isAbsolute(destination))throw new Error('Absolute reference and output directories required');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
fs.mkdirSync(destination,{recursive:true});
for(const file of [PACK.referenceManifest,...PACK.references]){
  const from=path.join(source,file===PACK.referenceManifest?'manifest.json':file.name),data=fs.readFileSync(from);
  if(data.length!==file.bytes||hash(data)!==file.sha256)throw new Error('Unverified reference asset: '+file.name);
  const target=path.join(destination,new URL(file.url).pathname.split('/').at(-1));
  if(fs.existsSync(target)&&!fs.readFileSync(target).equals(data))throw new Error('Refusing to replace an existing different asset');
  fs.copyFileSync(from,target);console.log(path.basename(target),data.length);
}
