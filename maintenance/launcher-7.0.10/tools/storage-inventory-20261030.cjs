'use strict';
const fs=require('node:fs'),path=require('node:path');
const output=path.resolve(__dirname,'../qa/20261030');fs.mkdirSync(output,{recursive:true});
function size(root){
    const stack=[root],top=[];let bytes=0,files=0,skipped=0;
    while(stack.length){const dir=stack.pop();let entries;try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{skipped++;continue;}
        for(const entry of entries){const file=path.join(dir,entry.name);if(entry.isSymbolicLink()){skipped++;continue;}if(entry.isDirectory())stack.push(file);else if(entry.isFile()){try{const stat=fs.statSync(file);bytes+=stat.size;files++;if(stat.size>100*1024*1024){top.push({file,bytes:stat.size});top.sort((a,b)=>b.bytes-a.bytes);if(top.length>5)top.length=5;}}catch{skipped++;}}}
    }return {root,bytes,files,skipped,largest:top};
}
const roots=fs.readdirSync('D:/',{withFileTypes:true}).filter(e=>e.isDirectory()&&!e.isSymbolicLink()&&/^(TikMnG|MNG-TikTok-Game-build)/i.test(e.name)).map(e=>path.join('D:/',e.name));
roots.push(path.join(process.env.APPDATA,'mng-tiktok-game/games'),path.join(process.env.USERPROFILE,'Desktop/MNG-TikTok-Game/apps'));
const rows=[];for(const root of roots){if(fs.existsSync(root)){rows.push(size(root));if(rows.length%20===0)console.log('Scanned '+rows.length+' project directories (read-only).');}}
rows.sort((a,b)=>b.bytes-a.bytes);fs.writeFileSync(path.join(output,'storage-inventory.json'),JSON.stringify({createdAt:new Date().toISOString(),deletionPerformed:false,rows},null,2));
console.log(JSON.stringify(rows.slice(0,15).map(r=>({root:r.root,GB:Number((r.bytes/1073741824).toFixed(2)),files:r.files,skipped:r.skipped})),null,2));
