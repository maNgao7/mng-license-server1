'use strict';
const fs=require('node:fs'),path=require('node:path');
const {GameLaunchSession}=require('../lib/game-launch-session.cjs');
const {createSharedGameEvents}=require('../lib/shared-game-events.cjs');
const {launchPrison}=require('../lib/prison-package.cjs');
const out=path.resolve(__dirname,'../../qa');fs.mkdirSync(out,{recursive:true});
const done=path.join(out,'prison-ui-done');
const session=new GameLaunchSession({game:'hapisten-kac',title:'Hapisten Kaç',onProgress:p=>console.log(JSON.stringify(p)),onClosed:()=>{}});
const events=createSharedGameEvents();
(async()=>{
 const started=Date.now();
 await launchPrison({directory:path.resolve(__dirname,'../../hapisten-kac-package'),session,username:'',events,getChannel:()=>'',getStatus:()=>({status:'disconnected',username:'',roomId:''}),ensureLive:async()=>({status:'disconnected',reason:'qa-offline',message:'Yerel açılış testi; yayına bağlanılmadı.'})});
 const result={ready:session.ready,pid:session.nativeChild?.pid,elapsedMs:Date.now()-started,utc:new Date().toISOString(),mode:'native package, offline UI acceptance'};
 fs.writeFileSync(path.join(out,'prison-native-ready.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 const until=Date.now()+12*60000;
 while(!session.closed&&!fs.existsSync(done)&&Date.now()<until)await new Promise(r=>setTimeout(r,500));
})().catch(e=>{console.error(e.stack);fs.writeFileSync(path.join(out,'prison-native-error.txt'),e.message);process.exitCode=1}).finally(async()=>{await session.close();events.close()});
