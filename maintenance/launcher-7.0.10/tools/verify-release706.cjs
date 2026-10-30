'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const repo='maNgao7/mng-license-server1',root='D:/TikMnG-Release-7.0.6-candidate',game='D:/TikMnG-Release-Snake-0.16.0';
const sha=async file=>{const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');};
async function run(){
    const releases=JSON.parse(execFileSync('gh',['api',`repos/${repo}/releases?per_page=30`,'--jq','map(select(.tag_name=="v7.0.6" or .tag_name=="game-snake-0.16.0")) | map({tag_name,draft,assets:[.assets[]|{name,size,digest}]})'],{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024}));
    const checks=[];
    for(const [tag,directory,names]of [
        ['game-snake-0.16.0',game,fs.readdirSync(game)],
        ['v7.0.6',root,['TikMnG-Setup-7.0.6.exe','TikMnG-Setup-7.0.6.exe.blockmap','TikMnG-7.0.6-Portable.exe','latest.yml','manifest-7.0.6.json','KONTROL-RAPORU.json']]
    ]){
        const release=releases.find(r=>r.tag_name===tag);assert.ok(release,tag);
        if(process.argv.includes('--public'))assert.equal(release.draft,false);
        for(const name of names){const asset=release.assets.find(a=>a.name===name),file=path.join(directory,name);assert.ok(asset,name);assert.equal(asset.size,fs.statSync(file).size);assert.equal(asset.digest,'sha256:'+await sha(file),name);checks.push({tag,name,bytes:asset.size,digestVerified:true});}
    }
    if(process.argv.includes('--public')){
        const {readRelease}=require('../lib/update-release.cjs'),r=await readRelease();assert.equal(r.version,'7.0.6');
        const {downloadFile}=require('../lib/download.cjs'),directory='D:/TikMnG-Widget-Transparent-20261027/public-download';fs.mkdirSync(directory,{recursive:true});
        const result=await downloadFile(r.url,path.join(directory,r.name),{bytes:r.bytes,sha256:r.sha256});
        const response=await fetch(r.url.replace(r.name,'latest.yml'));assert.equal(response.status,200);
        const feed=require('js-yaml').load(await response.text());assert.equal(feed.version,r.version);assert.equal(feed.path,r.name);
        const hash=crypto.createHash('sha512');for await(const b of fs.createReadStream(result.path))hash.update(b);assert.equal(hash.digest('base64'),feed.sha512);
        const catalog=require('../lib/catalog-defaults.json'),descriptor=catalog.games.find(g=>g.id==='minecraft-snake-arena');
        const manifestResponse=await fetch(descriptor.files[0].url);assert.ok(manifestResponse.ok);const data=Buffer.from(await manifestResponse.arrayBuffer());assert.equal(crypto.createHash('sha256').update(data).digest('hex'),descriptor.files[0].sha256);
        const manifest=JSON.parse(data);assert.equal(manifest.version,'0.16.0');
        for(const file of manifest.files.filter(f=>f.url.includes('/game-snake-0.16.0/')&&f.path.endsWith('.jar'))){await downloadFile(file.url,path.join(directory,file.sha256+'.jar'),{bytes:file.bytes,sha256:file.sha256});}
    }
    const output='D:/TikMnG-Widget-Transparent-20261027/'+(process.argv.includes('--public')?'public-assets':'draft-assets')+'.json';
    fs.writeFileSync(output,JSON.stringify({passed:true,public:process.argv.includes('--public'),checks},null,2));console.log(JSON.stringify({passed:true,public:process.argv.includes('--public'),assets:checks.length}));
}
run().catch(e=>{console.error(e.stack);process.exitCode=1;});
