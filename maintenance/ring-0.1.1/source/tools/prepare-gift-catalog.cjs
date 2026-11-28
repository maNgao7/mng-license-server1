'use strict';
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const source='C:/Users/User/Desktop/MNG-TikTok-Game/launcher/renderer/gift-assets';
const file=path.join(source,'katalog_tam.json');
const data=fs.readFileSync(file);
const rows=JSON.parse(data.toString('utf8').replace(/^\uFEFF/,''));
if(!Array.isArray(rows)||rows.length<100)throw new Error('Launcher gift catalog is invalid');
const target=path.join(root,'assets/catalog');fs.mkdirSync(target,{recursive:true});
const seen=new Set();let images=0;
const result=rows.map(row=>{
  const id=String(row.id);
  if(!/^\d+$/.test(id)||seen.has(id)||!Number.isSafeInteger(row.coins)||row.coins<0)throw new Error('Invalid or duplicate gift row');
  seen.add(id);
  const filename=path.basename(String(row.file||''));
  const local=filename&&fs.existsSync(path.join(source,filename));
  if(local){fs.copyFileSync(path.join(source,filename),path.join(target,filename));images++;}
  return {id,name:String(row.trName||row.name),coins:row.coins,file:local?filename:'',source:/^https:\/\//.test(row.source||'')?row.source:''};
});
fs.writeFileSync(path.join(root,'assets/gift-catalog.json'),JSON.stringify(result));
fs.writeFileSync(path.join(root,'assets/gift-catalog-origin.json'),JSON.stringify({schemaVersion:1,source:'installed-launcher/katalog_tam.json',sha256:crypto.createHash('sha256').update(data).digest('hex'),gifts:result.length,images},null,2));
console.log(`Shared launcher catalog: ${result.length} gifts, ${images} local images.`);
