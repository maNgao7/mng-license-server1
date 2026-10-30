'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {_electron}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output='D:/TikMnG-Minecraft-Admin-Test-20261027';
const exe='D:/TikMnG-Manager-7.0.0/win-unpacked/TikMnG.exe';
const stable='C:/Users/User/AppData/Roaming/mng-tiktok-game/games/.game-library';
const specs=[
    {id:'snow-war',config:'mng-snow-war.json',mod:'mng-snow-war-1.0.0.jar',sha256:'cf1458cc9dc0e2a72db31f4215e5d917a777012c940285066cb2976bd7fb907f',count:16,ready:'MNG_SNOW_ARENA_READY'},
    {id:'battle-royale',config:'mng-battle-royale.json',mod:'mng_battle_royale-1.0.0.jar',sha256:'6a69b5f994c39bee9f0f812cb3b426bfa0f8f1bd5a25d6ec3592ed552759e9d6',count:10,ready:'MNG_BATTLE_ARENA_READY'}
];
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
let app;
async function main(){
    const stableBefore=Object.fromEntries(specs.map(s=>[s.id,fs.readFileSync(path.join(stable,s.id,'active.json'))]));
    const stableAsar=path.join(process.env.LOCALAPPDATA,'Programs/mng-tiktok-game/resources/app.asar');
    const stableProgramHash=hash(fs.readFileSync(stableAsar));
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.MNG_TEST_PROFILE;delete env.JAVA_TOOL_OPTIONS;
    app=await _electron.launch({executablePath:exe,args:['--tikmng-preview'],env,timeout:60000});
    const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.waitForFunction(()=>window.mngAPI&&document.querySelector('#workspaceRoot'),null,{timeout:60000});
    await page.locator('#launcher').waitFor({state:'visible',timeout:60000});
    await page.waitForTimeout(1500);
    const before=await page.evaluate(()=>window.mngAPI.workspace('snapshot'));assert.equal(before.preview,true);
    const results=[];
    for(const spec of specs){
        if(process.env.MNG_QA_ONLY&&spec.id!==process.env.MNG_QA_ONLY)continue;
        const old=before.games.find(g=>g.id===spec.id);
        const oldFile=old.path&&path.join(old.path,'game-instance/config',spec.config);
        const saved=oldFile&&fs.existsSync(oldFile)?fs.readFileSync(oldFile):null;
        await page.evaluate(()=>{window.qaRoundProgress=[];window.mngAPI.workspaceListen('progress',p=>window.qaRoundProgress.push(p));});
        console.log('INSTALL',spec.id);
        const installed=await page.evaluate(id=>window.mngAPI.workspace('install',{id}),spec.id);
        assert.equal(installed.basarili,true,installed.hata||installed.error);
        const snapshot=await page.evaluate(()=>window.mngAPI.workspace('snapshot'));
        const game=snapshot.games.find(g=>g.id===spec.id);
        assert.equal(game.installedVersion,'7.0.3-preview.1');assert.equal(game.installed,true);
        assert.ok(game.path.startsWith('D:\\TikMnG-OnIzleme-Oyunlar\\'));
        const config=fs.readFileSync(path.join(game.path,'game-instance/config',spec.config));
        if(saved)assert.deepEqual(config,saved,'Existing settings changed');
        const rules=JSON.parse(config).giftRules;assert.equal(rules.length,spec.count);
        assert.equal(new Set(rules.map(r=>r.giftId)).size,spec.count);
        assert.equal(hash(fs.readFileSync(path.join(game.path,'game-instance/mods',spec.mod))),spec.sha256);
        console.log('INSTALLED',spec.id,game.installedVersion);
        const start=Date.now();
        const username=process.env.MNG_QA_TIKTOK_USER||'';
        const launch=await page.evaluate(({id,username})=>window.mngAPI.uygulamaAc(id,{tiktokUser:username}),{id:spec.id,username});
        assert.equal(launch.basarili,true,launch.hata);
        const logFile=path.join(game.path,'game-instance/launch.log');let ready=false;
        for(let i=0;i<360;i++){
            const log=fs.existsSync(logFile)?fs.readFileSync(logFile,'utf8'):'';
            if(log.includes(spec.ready)){ready=true;break;}
            if(/Mod loading error has occurred|Failed to start the minecraft server/.test(log))throw new Error('Native mod load failed: '+spec.id);
            await new Promise(r=>setTimeout(r,500));
        }
        assert.ok(ready,spec.id+' native arena did not become ready');
        console.log('ARENA_READY',spec.id);
        fs.copyFileSync(logFile,path.join(output,spec.id+'-installed-native.log'));
        const args=fs.readFileSync(path.join(game.path,'game-instance/launch-args.txt'),'utf8').split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s));
        const port=args.find(s=>s.startsWith('-Dmng.bridge.port='))?.split('=')[1];assert.ok(port);
        let health;
        for(let i=0;i<30;i++){
            health=await(await fetch('http://127.0.0.1:'+port+'/health')).json();
            if(health.clients>0&&(!username||health.state==='connected'||health.state==='waiting'||health.state==='error'))break;
            await new Promise(r=>setTimeout(r,500));
        }
        assert.ok(health.clients>0,'Java receiver is not connected');
        if(username){
            assert.equal(health.username,username,'Native client did not receive selected broadcaster');
            assert.match(health.session,/^[a-f0-9]+$/,'Java must own the event session');
            console.log('NATIVE_LIVE',spec.id,health.state,health.message);
        }
        const progress=await page.evaluate(()=>window.qaRoundProgress);
        const metrics=progress.findLast(p=>p.updateMode==='content');
        results.push({id:spec.id,version:game.installedVersion,nativeArenaReady:true,
            nativeLoadMs:Date.now()-start,javaReceiverConnected:true,savedRules:rules.length,
            settingsBytePreserved:Boolean(saved),modSha256:spec.sha256,
            live:username?{username,state:health.state,message:health.message}:null,
            contentUpdate:metrics?{changedFiles:metrics.changedFiles,transferredBytes:metrics.transferredBytes,reusedBytes:metrics.reusedBytes}:null});
    }
    const after=await page.evaluate(()=>window.mngAPI.workspace('snapshot'));
    for(const old of before.games.filter(g=>!specs.some(s=>s.id===g.id))){
        const same=after.games.find(g=>g.id===old.id);assert.equal(same.path,old.path);assert.equal(same.installedVersion,old.installedVersion);
    }
    const mediaIds=new Set(after.media.map(m=>m.id));
    for(const media of before.media)assert.ok(mediaIds.has(media.id),'An existing media item disappeared');
    assert.deepEqual(after.tts,before.tts);
    for(const spec of specs)assert.deepEqual(fs.readFileSync(path.join(stable,spec.id,'active.json')),stableBefore[spec.id]);
    assert.equal(hash(fs.readFileSync(stableAsar)),stableProgramHash);assert.deepEqual(errors,[]);
    const close=page.locator('[data-announcement-close]');if(await close.isVisible())await close.click();
    await page.locator('[data-workspace-view="games"]').click();
    const category=page.locator('[data-category="minecraft"]');if(await category.isVisible())await category.click();
    await page.screenshot({path:path.join(output,'installed-manager-minecraft.png')});
    const report={passed:true,preview:true,sourceExe:exe,launcherVersion:after.version,games:results,
        otherGamesPreserved:true,mediaAndSpeechPreserved:true,stableLauncherAndPointersUnchanged:true,
        publicRelease:false,realTikTokGiftDeliveryNotClaimed:true,errors};
    fs.writeFileSync(path.join(output,process.env.MNG_QA_ONLY?'installed-test-'+process.env.MNG_QA_ONLY+'.json':'installed-test-result.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{await app?.close();});
