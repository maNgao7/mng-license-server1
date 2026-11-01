'use strict';
const fs=require('node:fs'),path=require('node:path');
const {TikTokLiveConnection}=require('tiktok-live-connector');
const {extractFanClubLevel,createSpeechAudience}=require('../lib/tts-audience.cjs');
const {failureReason}=require('../lib/live-session.cjs');
const key=fs.readFileSync('C:/Users/User/Desktop/MNG-TikTok-Game/apps/tiktok-vs/euler-api-key.txt','utf8').trim();
const hosts=process.argv.slice(2).length?process.argv.slice(2):['burcum331','bazidliferom'];
const output=path.resolve(__dirname,'../qa/20261030');fs.mkdirSync(output,{recursive:true});
const connections=[];
function compact(value,depth=0){
    if(depth>9)return undefined;
    if(Array.isArray(value))return value.slice(0,16).map(v=>compact(v,depth+1));
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['userArmies','supportUsers','supporters','signature','cookie','secUid','secUserId','content','comment','message','displayText','description'].includes(k)).map(([k,v])=>[k,compact(v,depth+1)]));
    return typeof value==='bigint'?String(value):value;
}
async function main(){
    const reports=[];
    for(const host of hosts){
        const c=new TikTokLiveConnection(host,{processInitialData:false,signApiKey:key});connections.push(c);
        const audience=createSpeechAudience(),r={host,readOnly:true,status:'connecting',pkEvents:0,samples:[],messages:0,positiveMembership:0,inactiveMembership:0,unknownMembership:0,memberMessagesAllowed:0,membershipExamples:[]};
        reports.push(r);c.on('error',()=>{});
        for(const event of ['linkMicBattle','linkMicArmies','linkMicMethod','linkLayer','linkMicLayoutState'])c.on(event,data=>{
            r.pkEvents++;if(r.samples.length>=30)r.samples.splice(10,1);r.samples.push({event,at:Date.now(),data:compact(data)});
        });
        c.on('chat',data=>{
            r.messages++;const level=extractFanClubLevel(data),user=data.user||data;
            if(level>0)r.positiveMembership++;else if(level===0)r.inactiveMembership++;else r.unknownMembership++;
            if(level>0&&audience.allows(data,{audience:'fanclub'},host))r.memberMessagesAllowed++;
            const info={rootKeys:Object.keys(data),userKeys:Object.keys(user),fansClubInfo:compact(user.fansClubInfo),fansClub:compact(user.fansClub),badges:compact(user.badges||user.userBadges||user.badgeList),badgesV2:compact(user.badgesV2),extractedLevel:level};
            if(r.membershipExamples.length<8&&!r.membershipExamples.some(x=>JSON.stringify(x)===JSON.stringify(info)))r.membershipExamples.push(info);
        });
        let timer;try{await Promise.race([c.connect(),new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error('timeout')),25000))]);r.status='connected';const owner=c.roomInfo?.owner||c.roomInfo?.data?.owner;if(owner)r.owner={id:String(owner.id_str||owner.id||owner.userId||''),username:owner.display_id||owner.displayId||host,nickname:owner.nickname||owner.nickName||host,avatar:owner.avatar_thumb?.url_list?.[0]||owner.avatarThumb?.urlList?.[0]||''};console.log(host+' connected (read only)');}
        catch(e){r.status=failureReason(e);console.log(host+' '+r.status);}finally{clearTimeout(timer);}
    }
    await new Promise(resolve=>setTimeout(resolve,Number(process.env.MNG_LIVE_OBSERVE_MS)||75000));
    fs.writeFileSync(path.join(output,process.env.MNG_LIVE_REPORT||'live-pk-teams-report.json'),JSON.stringify({createdAt:new Date().toISOString(),reports},null,2));
    console.log(JSON.stringify(reports.map(({samples,membershipExamples,...r})=>({...r,samples:samples.length,membershipExamples:membershipExamples.length}))));
}
main().catch(e=>{console.error(failureReason(e));process.exitCode=1;}).finally(async()=>{for(const c of connections){try{await c.disconnect();c.wsClient?.terminate();}catch{}}});
