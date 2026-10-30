'use strict';
const {app,BrowserWindow,session}=require('electron'),path=require('node:path'),fs=require('node:fs');
app.setPath('userData',process.env.MNG_CONTEST_NATIVE_DATA);
app.whenReady().then(async()=>{
    const {GameLaunchSession}=require('../lib/game-launch-session.cjs');
    const owned=globalThis.qaContestSession=new GameLaunchSession({game:'profile-contest',title:'Profil Yarışması'});
    await require('../lib/profile-contest-launch.cjs').launchProfileContest({directory:process.env.MNG_CONTEST_NATIVE_PACKAGE,dataDirectory:path.join(app.getPath('userData'),'contest'),session:owned,BrowserWindow,portraitSession:session,createConnection:async()=>{throw new Error('QA is offline');},createOverlay:()=>({start(){},close(){},urlFor(){return '';}})});
}).catch(error=>{console.error(error);app.exit(1);});
app.on('window-all-closed',()=>app.quit());
