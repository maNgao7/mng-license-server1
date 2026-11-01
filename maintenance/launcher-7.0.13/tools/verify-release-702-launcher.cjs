'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=process.env.MNG_RELEASE_DIR||'D:/TikMnG-Release-7.0.2-ready',repo='maNgao7/mng-license-server1';
const releases=JSON.parse(execFileSync('gh',['api',`repos/${repo}/releases?per_page=100`],{encoding:'utf8',maxBuffer:24*1024*1024}));
const release=releases.find(r=>r.tag_name==='v7.0.2');assert.ok(release);
const names=['TikMnG-Setup-7.0.2.exe','TikMnG-Setup-7.0.2.exe.blockmap','TikMnG-7.0.2-Portable.exe','latest.yml','manifest-7.0.2.json','YUKLEME-TALIMATI.txt'];
for(const name of names){const bytes=fs.readFileSync(path.join(root,name)),asset=release.assets.find(a=>a.name===name);assert.ok(asset,name);assert.equal(asset.size,bytes.length,name);assert.equal(asset.digest,'sha256:'+crypto.createHash('sha256').update(bytes).digest('hex'),name);}
const result={passed:true,tag:'v7.0.2',draft:release.draft,assets:names.length,installerBytes:fs.statSync(path.join(root,names[0])).size};
fs.writeFileSync('D:/TikMnG-QA-Delivery/7.0.2/ready-github-integrity.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
