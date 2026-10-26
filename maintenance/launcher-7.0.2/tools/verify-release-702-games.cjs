'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=process.env.MNG_GAME_RELEASE_DIR||'D:/TikMnG-Release-7.0.2-games',repo='maNgao7/mng-license-server1',tag=process.env.MNG_GAME_RELEASE_TAG||'games-7.0.2';
const gh=args=>JSON.parse(execFileSync('gh',args,{encoding:'utf8',maxBuffer:16*1024*1024}));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
    const releases=gh(['api',`repos/${repo}/releases?per_page=100`]);
    const release=releases.find(r=>r.tag_name===tag);assert.ok(release);
    const pages=gh(['api',`repos/${repo}/releases/${release.id}/assets?per_page=100`,'--paginate','--slurp']);
    const assets=new Map(pages.flat().map(a=>[a.name,a]));let total=0,count=0;
    for(const name of fs.readdirSync(root)){
        if(!/\.(bin|json|zip)$/.test(name))continue;
        const file=path.join(root,name),bytes=fs.readFileSync(file),asset=assets.get(name);
        assert.ok(asset,'Missing asset '+name);assert.equal(asset.size,bytes.length,name);
        assert.equal(asset.digest,'sha256:'+sha(bytes),'GitHub stored digest '+name);
        total+=bytes.length;count++;
    }
    const plan=JSON.parse(fs.readFileSync('D:/TikMnG-Release-7.0.2-content/plan.json','utf8'));
    const objectDirectory='D:/TikMnG-Release-7.0.2-content/repository/objects';
    const objects=fs.readdirSync(objectDirectory);
    const samples=[objects[0],objects[Math.floor(objects.length/2)],objects.at(-1)];
    for(const name of samples){
        const url=`https://raw.githubusercontent.com/${repo}/a2ca60e1b1f69b14d0c1fd70557eb1a96a270510/objects/${name}`;
        const response=await fetch(url,{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);
        assert.equal(sha(Buffer.from(await response.arrayBuffer())),name.replace('.bin',''));
    }
    const result={passed:true,githubStoredDigestsVerified:count,releaseBytes:total,smallObjects:objects.length,immutableRawProbes:samples.length,gameCatalog:require('../lib/catalog-defaults.json').games.length,draft:release.draft};
    fs.writeFileSync(`D:/TikMnG-QA-Delivery/7.0.2/${tag}-integrity.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
