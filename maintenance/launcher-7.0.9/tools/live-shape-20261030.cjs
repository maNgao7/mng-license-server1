'use strict';
const fs=require('node:fs');
const {TikTokLiveConnection}=require('tiktok-live-connector');
const file='C:/Users/User/Desktop/MNG-TikTok-Game/apps/tiktok-vs/euler-api-key.txt';
const connection=new TikTokLiveConnection('barbarpm',{processInitialData:false,signApiKey:fs.readFileSync(file,'utf8').trim()});
function shape(value,depth=0){if(depth>5)return typeof value;if(Array.isArray(value))return {length:value.length,first:value.length?shape(value[0],depth+1):null};if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['common','userArmies','displayText','avatarThumb','avatarMedium','avatarLarge'].includes(key)).map(([key,value])=>[key,shape(value,depth+1)]));return typeof value;}
let chat=false,pk=false;
connection.on('chat',data=>{if(chat)return;chat=true;process.stdout.write(JSON.stringify({event:'chat-shape',rootKeys:Object.keys(data),user:shape(data.user),fanClubLevelType:typeof data.fanClubLevel})+'\n');});
connection.on('linkMicArmies',data=>{if(pk)return;pk=true;process.stdout.write(JSON.stringify({event:'pk-shape',shape:shape(data),hostScores:Object.values(data.armies||{}).map(row=>({hasHostscore:Object.hasOwn(row,'hostscore'),nonnegative:Number(row.hostscore)>=0})),teamCount:data.teamArmies?.length})+'\n');});
connection.on('error',()=>{});
const timer=setTimeout(()=>{connection.disconnect();process.exit(0);},22000);
connection.connect().catch(()=>{clearTimeout(timer);connection.disconnect();process.exit(1);});
