'use strict';
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {createRequire}=require('node:module');
const username=String(process.argv[2]||'').replace(/^@/,'').trim().toLowerCase();
if(!/^[a-z0-9_.]{2,32}$/.test(username))throw new Error('Invalid test username');
const bridge=path.resolve(__dirname,'../../apps/snow-war/prototype/live-bridge');
const {TikTokLiveConnection,WebcastEvent}=createRequire(path.join(bridge,'package.json'))('tiktok-live-connector');
const output='D:/TikMnG-Minecraft-Admin-Test-20261027';
const scrub=value=>String(value||'').replace(/https?:\/\/\S+/g,'[service URL]').slice(0,500);
let connection;
async function main(){
    const {normalize,explain}=await import(pathToFileURL(path.join(bridge,'events.js')).href);
    connection=new TikTokLiveConnection(username,{processInitialData:false,enableExtendedGiftInfo:false});
    const result={testedAt:new Date().toISOString(),username,connected:false,events:{gift:0,like:0,follow:0},profileEvents:0,errors:[]};
    connection.on('error',e=>result.errors.push({message:scrub(e?.message||e?.exception?.message||e?.info||e),code:e?.code}));
    for(const [event,type] of [[WebcastEvent.GIFT,'gift'],[WebcastEvent.LIKE,'like'],[WebcastEvent.FOLLOW,'follow']])
        connection.on(event,data=>{const value=normalize(type,data);if(value){result.events[type]++;if(value.profile)result.profileEvents++;}});
    let timer;
    try{
        await Promise.race([connection.connect(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Diagnostic connection timeout')),35000);})]);
        clearTimeout(timer);result.connected=true;console.log('CONNECTED',username);
        await new Promise(r=>setTimeout(r,10000));
    }catch(e){clearTimeout(timer);result.reason=explain(e);result.error={name:e?.name,message:scrub(e?.message||e),code:e?.code};console.log(JSON.stringify(result.error));}
    finally{connection.disconnect();}
    fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'live-'+username+'.json'),JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>connection?.disconnect());
