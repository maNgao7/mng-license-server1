'use strict';
const fs=require('node:fs');
const catalog=require('../lib/catalog-defaults.json');
(async()=>{
    const result=[];
    for(const game of catalog.games){
        const existing=result.find(item=>item.url===game.url);
        if(existing){result.push({...existing,id:game.id});continue;}
        try{
            const response=await fetch(game.url,{method:'HEAD',signal:AbortSignal.timeout(20000),redirect:'follow'});
            result.push({id:game.id,url:game.url,status:response.status,bytes:Number(response.headers.get('content-length'))||null,expectedBytes:game.bytes||null,reachable:response.ok});
        }catch(error){result.push({id:game.id,url:game.url,reachable:false,error:error.name});}
    }
    const output='D:/TikMnG-Launcher-Test-Raporu/download-links.json';fs.mkdirSync(require('node:path').dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2));
    console.log(JSON.stringify(result.map(({id,status,reachable,bytes,expectedBytes})=>({id,status,reachable,sizeMatches:expectedBytes?bytes===expectedBytes:null}))));
})().catch(error=>{console.error(error);process.exitCode=1;});
