'use strict';
const fs=require('node:fs'),path=require('node:path'),{TikTokLiveConnection}=require('tiktok-live-connector');
const key=fs.readFileSync('C:/Users/User/Desktop/MNG-TikTok-Game/apps/tiktok-vs/euler-api-key.txt','utf8').trim();
async function main(){const c=new TikTokLiveConnection(process.argv[2]||'barbarpm',{processInitialData:false,signApiKey:key});c.on('error',()=>{});try{await c.connect();const info=c.roomInfo,profiles=[];
 function walk(v,depth=0,at='room'){if(!v||typeof v!=='object'||depth>9)return;const name=v.display_id||v.displayId||v.uniqueId||v.nickname||v.nickName;if(name)profiles.push({at,id:String(v.id_str||v.id||v.userId||''),username:v.display_id||v.displayId||v.uniqueId,nickname:v.nickname||v.nickName,avatar:(v.avatar_large?.url_list||v.avatarLarge?.urlList||v.avatar_thumb?.url_list||v.avatarThumb?.urlList||[])[0]});for(const [k,x]of Object.entries(v))if(!/cookie|token|signature|sec_uid|secUid|extra|description/i.test(k))walk(x,depth+1,at+'.'+k);}
 walk(info);const report={keys:Object.keys(info?.data||info||{}),linkMic:info?.data?.link_mic||null,profiles};fs.mkdirSync(path.resolve(__dirname,'../qa/711'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../qa/711/pk-room.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await c.disconnect();c.wsClient?.terminate();}}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
