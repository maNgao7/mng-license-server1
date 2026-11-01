'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {_electron}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output='D:/TikMnG-Snake-Arena-Prototype/qa/installed-admin-v015';fs.mkdirSync(output,{recursive:true});
const exe=process.env.MNG_QA_EXE||'D:/TikMnG-Manager-Snake-0.15.0-candidate/win-unpacked/TikMnG.exe';
const username=process.env.MNG_QA_TIKTOK_USER||'king_jux';if(!/^[a-z0-9_.]{2,32}$/.test(username))throw new Error('Invalid test channel');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
let application;
async function main(){
    const profile=path.join(process.env.APPDATA,'TikMnG-Test-6.5.17');
    const stored=path.join(profile,'mng-config.json');if(fs.existsSync(stored)&&!fs.existsSync(path.join(output,'profile-before.enc')))fs.copyFileSync(stored,path.join(output,'profile-before.enc'));
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.MNG_TEST_PROFILE;
    application=await _electron.launch({executablePath:exe,args:['--tikmng-preview'],env,timeout:60000});
    console.log('MAIN_CONTEXT',await application.evaluate(({app})=>({name:app.getName(),ready:app.isReady()})));
    const page=await application.firstWindow({timeout:60000});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.waitForFunction(()=>window.mngAPI&&document.querySelector('#workspaceRoot'),null,{timeout:60000});
    let before=await page.evaluate(()=>window.mngAPI.workspace('snapshot'));assert.equal(before.preview,true);assert.equal(before.games.length,16);
    const previous=before.games.filter(g=>g.installed&&g.id!=='minecraft-snake-arena').map(g=>({id:g.id,path:g.path,version:g.installedVersion}));
    const ttsHash=digest(JSON.stringify(before.tts)),mediaIds=before.media.map(m=>m.id).sort();
    let relocated=false;
    if(!/^D:[\\/]/i.test(before.libraryRoot)){
        const target='D:/TikMnG-OnIzleme-Oyunlar';fs.mkdirSync(target,{recursive:true});
        await application.evaluate(({dialog},target)=>{globalThis.qaOpen=dialog.showOpenDialog;dialog.showOpenDialog=async()=>({canceled:false,filePaths:[target]});return true;},target);
        const selected=await page.evaluate(()=>window.mngAPI.workspace('folder',{kind:'games'}));assert.equal(selected.error,undefined,selected.error);assert.equal(selected.libraryRoot,target);relocated=true;
    }
    let snap=await page.evaluate(()=>window.mngAPI.workspace('snapshot'));let snake=snap.games.find(g=>g.id==='minecraft-snake-arena');assert.ok(snake.downloadReady,'trusted archive descriptor ready');
    await page.evaluate(()=>{window.qaInstallProgress=[];window.mngAPI.workspaceListen('progress',p=>window.qaInstallProgress.push(p));});
    const installStarted=Date.now();
    const installed=snake.installedVersion==='0.15.2'?{basarili:true}:await page.evaluate(()=>window.mngAPI.workspace('install',{id:'minecraft-snake-arena'}));assert.equal(installed.basarili,true,installed.hata||installed.error);
    const installMs=Date.now()-installStarted;
    const updateProgress=await page.evaluate(()=>window.qaInstallProgress);
    snap=await page.evaluate(()=>window.mngAPI.workspace('snapshot'));snake=snap.games.find(g=>g.id==='minecraft-snake-arena');assert.equal(snake.installed,true);assert.equal(snake.installedVersion,'0.15.2');assert.ok(/^D:[\\/]/i.test(snake.path));
    const sourceGuide='D:/TikMnG-Snake-Arena-Prototype/assets/snake-gift-guide.png',guideFile=path.join(output,'gift-guide.png');
    await application.evaluate(({dialog},target)=>{globalThis.qaSave=dialog.showSaveDialog;dialog.showSaveDialog=async()=>({canceled:false,filePath:target});return true;},guideFile);
    const saved=await page.evaluate(()=>window.mngAPI.workspace('gift-guide-save',{id:'minecraft-snake-arena'}));assert.equal(saved.saved,true,saved.error);assert.equal(digest(fs.readFileSync(guideFile)),digest(fs.readFileSync(sourceGuide)));
    await page.screenshot({path:path.join(output,'installed-admin.png')});
    const launchStarted=Date.now();
    const launched=await page.evaluate(username=>window.mngAPI.uygulamaAc('minecraft-snake-arena',{tiktokUser:username}),username);assert.equal(launched.basarili,true,launched.hata);
    const launchMs=Date.now()-launchStarted;
    const args=fs.readFileSync(path.join(snake.path,'game-instance/launch-args.txt'),'utf8').split(/\r?\n/).filter(Boolean).map(v=>JSON.parse(v));
    const port=args.find(v=>v.startsWith('-Dmng.snake.widget.port='))?.split('=')[1],key=args.find(v=>v.startsWith('-Dmng.snake.widget.key='))?.split('=')[1];assert.ok(port&&key);
    let status,state;
    for(let i=0;i<80;i++){
        status=await fetch(`http://127.0.0.1:${port}/status?key=${key}`).then(r=>r.json());
        state=await fetch(`http://127.0.0.1:${port}/api/widget/state?key=${key}`).then(r=>r.json());
        if(status.secure&&state.online)break;await new Promise(r=>setTimeout(r,500));
    }
    assert.equal(state.online,true);assert.equal(status.secure,true,status.message);
    let liveObservation;
    const observeSeconds=Math.min(60,Math.max(0,Number(process.env.MNG_QA_OBSERVE_SECONDS)||0));
    if(observeSeconds){
        const bridgePort=args.find(v=>v.startsWith('-Dmng.bridge.port='))?.split('=')[1];
        const until=Date.now()+observeSeconds*1000;let maxSnakes=0,maxProfiles=0,liveState;const states=new Set();
        while(Date.now()<until){
            state=await fetch(`http://127.0.0.1:${port}/api/widget/state?key=${key}`).then(r=>r.json());
            maxSnakes=Math.max(maxSnakes,state.snakes?.length||0);maxProfiles=Math.max(maxProfiles,state.snakes?.filter(s=>s.profile).length||0);
            liveState=await fetch(`http://127.0.0.1:${bridgePort}/health`).then(r=>r.json());
            states.add(liveState?.state);
            await new Promise(resolve=>setTimeout(resolve,1000));
        }
        liveObservation={username,seconds:observeSeconds,liveState:liveState?.state,liveMessage:liveState?.message,observedStates:[...states],maxSnakes,maxProfiles,syntheticParticipants:false};
    }
    const sourceStatus=[];for(const url of [status.sizeURL,status.winsURL]){const r=await fetch(url,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);sourceStatus.push(r.status);}
    const config=JSON.parse(fs.readFileSync(path.join(snake.path,'game-instance/config/tikmng-snake-arena.json'),'utf8'));
    assert.equal(config.username,username);assert.equal(config.schemaVersion,15);assert.equal(config.multiplier1,.8);assert.equal(config.multiplier1000,2.5);
    const adoption=path.join(snake.path,'game-instance/config/.prototype-settings-adopted.json');
    if(fs.existsSync(adoption)){
        const old=JSON.parse(fs.readFileSync('D:/TikMnG-Snake-Arena-Prototype/instance/config/tikmng-snake-arena.json','utf8'));
        for(const key of ['gifts','musicVolume','effectsVolume','leaderboardWins'])assert.deepEqual(config[key],old[key],key+' adopted from existing prototype');
        const oldWidget=JSON.parse(fs.readFileSync('D:/TikMnG-Snake-Arena-Prototype/instance/config/snake-widget.json','utf8'));
        const newWidget=JSON.parse(fs.readFileSync(path.join(snake.path,'game-instance/config/snake-widget.json'),'utf8'));
        assert.equal(newWidget.localKey,oldWidget.localKey);assert.equal(newWidget.overlay_installation_v1,oldWidget.overlay_installation_v1);
    }
    const log=fs.readFileSync(path.join(snake.path,'game-instance/launch.log'),'utf8');assert.match(log,/MNG_SNAKE_ARENA_READY/);
    const after=await page.evaluate(()=>window.mngAPI.workspace('snapshot'));assert.equal(digest(JSON.stringify(after.tts)),ttsHash);assert.deepEqual(after.media.map(m=>m.id).sort(),mediaIds);
    for(const game of previous){const actual=after.games.find(g=>g.id===game.id);assert.equal(actual.installed,true);assert.equal(actual.path,game.path);assert.equal(actual.installedVersion,game.version);}
    assert.deepEqual(errors,[]);
    const metrics=updateProgress.findLast(p=>p.updateMode==='content');
    const result={passed:true,version:after.version,preview:true,sourceExe:exe,gameInstalledVersion:snake.installedVersion,gamePath:snake.path,installMs,launchMs,
        contentUpdate:metrics?{updateMode:metrics.updateMode,packageBytes:metrics.packageBytes,reusedBytes:metrics.reusedBytes,changedFiles:metrics.changedFiles,transferredBytes:metrics.totalBytes}:null,
        libraryRelocatedToD:relocated,oldInstalledGamesPreserved:previous.length,mediaIdsPreserved:true,ttsSettingsPreserved:true,
        giftGuideSameBytes:true,nativeLauncherPlayReady:true,accountDeliveredToJava:true,publicWidgetStatus:sourceStatus,onlineNativeWidgetState:true,
        existingPrototypeSettingsAdopted:fs.existsSync(adoption),liveObservation,
        liveEventCountsNotClaimed:true,liveStudioAcceptanceNotTested:true,errors};
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{await application?.close();});
