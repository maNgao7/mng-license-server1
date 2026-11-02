'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
const repo='maNgao7/mng-license-server1',tag=process.env.MNG_GAME_RELEASE_TAG||'games-7.0.2',directory=process.env.MNG_GAME_RELEASE_DIR||'D:/TikMnG-Release-7.0.2-games';
const gh=args=>execFileSync('gh',args,{encoding:'utf8',maxBuffer:12*1024*1024,stdio:['ignore','pipe','pipe']});
const release=()=>JSON.parse(gh(['release','view',tag,'--repo',repo,'--json','id,isDraft,assets,url']));
async function main(){
    try{release();}catch{gh(['release','create',tag,'--repo',repo,'--target','ab2138a5f9541e4ea8c797a52de38e8e0b8e8bc0','--draft','--latest=false','--title','TikMnG 7.0.2 - Game Packages and Verified Content','--notes','Independent game archives and SHA-256 content objects. Launcher and game downloads are separate; existing saves and gift assignments are retained.']);}
    const names=fs.readdirSync(directory).filter(name=>/^[a-z0-9.-]+\.(?:bin|zip|json)$/.test(name));
    const remote=new Map(release().assets.map(asset=>[asset.name,asset.size])),pending=[];
    for(const name of names){const file=path.join(directory,name),bytes=fs.statSync(file).size;if(remote.has(name))assert.equal(remote.get(name),bytes,'Existing immutable asset differs '+name);else pending.push(file);}
    for(let i=0;i<pending.length;i+=8){
        const batch=pending.slice(i,i+8);
        let lastError;
        for(let attempt=0;attempt<4;attempt++){
            try{
                const current=new Map(release().assets.map(asset=>[asset.name,asset.size]));
                const missing=batch.filter(file=>!current.has(path.basename(file)));
                if(missing.length)gh(['release','upload',tag,'--repo',repo,...missing]);lastError=null;break;
            }catch(error){lastError=error;await new Promise(resolve=>setTimeout(resolve,2000*2**attempt));}
        }
        if(lastError)throw new Error('GitHub batch upload failed: '+String(lastError.stderr||lastError.message).slice(0,1200));
        console.log(JSON.stringify({uploaded:Math.min(i+8,pending.length),pending:pending.length,total:names.length}));
    }
    const result=release(),byName=new Map(result.assets.map(asset=>[asset.name,asset.size]));
    for(const name of names)assert.equal(byName.get(name),fs.statSync(path.join(directory,name)).size,'Remote asset size '+name);
    fs.writeFileSync('D:/TikMnG-Release-7.0.2-content/github-game-upload.json',JSON.stringify({verified:true,draft:result.isDraft,url:result.url,assets:names.length,bytes:names.reduce((n,name)=>n+fs.statSync(path.join(directory,name)).size,0)},null,2));
    console.log(JSON.stringify({verified:true,draft:result.isDraft,assets:names.length}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
