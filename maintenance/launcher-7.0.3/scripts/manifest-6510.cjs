const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname,'../..');
const dir = path.join(root,'release-v6.5.10');
const files = [
 ['TikMnG-Setup-6.5.10.exe',path.join(root,'launcher/dist/TikMnG Setup 6.5.10.exe')],
 ['TikMnG-6.5.10-Portable.exe',path.join(root,'launcher/dist/TikMnG 6.5.10.exe')],
 ...['tightrope-balance','mng-orbit','penalty-kick','zombie-war'].map(id=>[id+'.zip',path.join(dir,id+'.zip')])
];
(async()=>{
 const manifest={version:'6.5.10',releaseDate:'2026-10-16',files:[]};
 for(const[name,file]of files){
  const hash=crypto.createHash('sha256');
  for await(const chunk of fs.createReadStream(file))hash.update(chunk);
  manifest.files.push({name,bytes:fs.statSync(file).size,sha256:hash.digest('hex')});
 }
 fs.writeFileSync(path.join(dir,'manifest-6.5.10.json'),JSON.stringify(manifest,null,2));
 console.log('6 dagitim dosyasi SHA-256 ile dogrulandi.');
})();
