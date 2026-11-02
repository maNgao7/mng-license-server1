'use strict';
const fs=require('node:fs');
const {TikTokLiveConnection}=require('tiktok-live-connector');
const {extractFanClubLevel}=require('../lib/tts-audience.cjs');
const {failureReason}=require('../lib/live-session.cjs');
const keyPath='C:/Users/User/Desktop/MNG-TikTok-Game/apps/tiktok-vs/euler-api-key.txt';
const apiKey=fs.existsSync(keyPath)?fs.readFileSync(keyPath,'utf8').trim():'';
const results=[];
async function check(username){
    const result={username,status:'connecting',events:{},fanclub:{positive:0,inactive:0,unknown:0},pkEvents:0};
    const connection=new TikTokLiveConnection(username,{processInitialData:false,enableExtendedGiftInfo:false,...(apiKey?{signApiKey:apiKey}:{})});
    connection.on('error',()=>{});
    for(const event of ['chat','like','member','gift','linkMicArmies','linkMicBattle'])connection.on(event,data=>{
        result.events[event]=(result.events[event]||0)+1;
        if(event.startsWith('linkMic'))result.pkEvents++;
        const level=extractFanClubLevel(data);result.fanclub[level===null?'unknown':level>0?'positive':'inactive']++;
    });
    let timeout;
    try{
        await Promise.race([connection.connect(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('timeout')),25000);})]);
        clearTimeout(timeout);result.status='connected';
        await new Promise(resolve=>setTimeout(resolve,12000));
    }catch(error){result.status=failureReason(error);}finally{clearTimeout(timeout);connection.disconnect();}
    results.push(result);process.stdout.write(JSON.stringify(result)+'\n');
}
(async()=>{for(const name of ['barbarpm','rapidxp','batuhallive','ahmetyyilldizz'])await check(name);process.exitCode=0;})().catch(()=>{process.exitCode=1;});
