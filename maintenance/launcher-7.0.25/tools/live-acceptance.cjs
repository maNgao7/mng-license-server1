'use strict';
const fs=require('node:fs');const path=require('node:path');
const {TikTokLiveConnection,WebcastEvent}=require('tiktok-live-connector');
const {createLiveSession}=require('../lib/live-session.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const output=path.resolve(__dirname,'../../qa/live-tests.json');fs.mkdirSync(path.dirname(output),{recursive:true});
 const report={utc:new Date().toISOString(),tests:[],note:'Read-only connection and observed event counts. No messages or gifts sent.'};
 for(const username of ['lola.wqq','bencezehra','keremusers','king_jux']){
  const counts={chat:0,gift:0,like:0,follow:0};const started=Date.now();
  const session=createLiveSession({events:WebcastEvent,createConnection:clean=>new TikTokLiveConnection(clean,{processInitialData:false,enableExtendedGiftInfo:false}),onEvent:type=>{if(type in counts)counts[type]++;}});
  try{
   const result=await session.start(username);
   if(result.status==='connected')await sleep(12000);
   const status=session.status();
   const row={username,initialStatus:result.status,status:status.status,reason:status.reason,elapsedMs:Date.now()-started,events:counts};
   report.tests.push(row);console.log(JSON.stringify(row));
  }catch(error){report.tests.push({username,status:'error',error:error.message});}
  finally{session.close();fs.writeFileSync(output,JSON.stringify(report,null,2));}
 }
})().catch(error=>{console.error(error.message);process.exitCode=1});
