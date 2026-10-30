'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Store=require('electron-store');
const {_electron}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output=process.env.MNG_NATIVE_QA_OUTPUT||'D:/TikMnG-QA-Delivery/7.0.2/native-public',profile=path.resolve('D:/TikMnG-QA-Delivery/7.0.2/final-public-game-install/profile-I5W9lu');
const ids=(process.env.MNG_NATIVE_QA_GAMES||'minecraft-snake-arena,snow-war,battle-royale').split(',');
const options={projectVersion:'7.0.2',name:'mng-config',encryptionKey:'mng-electron-secret-key-2024'};
const original=new Store({...options,cwd:path.join(process.env.APPDATA,'TikMnG-Test-6.5.17')}),store=new Store({...options,cwd:profile});
for(const key of ['lisans_kod','cihaz_kimlik','lisans_token','lisans_bitis','son_dogrulama','is_unlimited'])if(original.has(key))store.set(key,original.get(key));
const result={passed:false,isolated:true,games:[],errors:[],realTikTokGiftNotClaimed:true};let app;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
    fs.mkdirSync(output,{recursive:true});const env={...process.env,MNG_TEST_PROFILE:profile,MNG_WIDGET_PORT:'31976'};delete env.ELECTRON_RUN_AS_NODE;
    app=await _electron.launch({executablePath:process.env.MNG_NATIVE_QA_EXE||'D:/TikMnG-Release-7.0.2-verified/win-unpacked/TikMnG.exe',env,timeout:60000});
    const page=await app.firstWindow();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.hide()));
    await page.waitForFunction(()=>window.mngAPI&&document.querySelector('#workspaceRoot'),null,{timeout:60000});
    const call=(action,data)=>page.evaluate(({action,data})=>window.mngAPI.workspace(action,data),{action,data});
    const initial=await call('snapshot');assert.equal(initial.preview,false);assert.equal(initial.games.length,16);
    const preserved=initial.games.filter(g=>g.installed&&!ids.includes(g.id)).map(g=>({id:g.id,path:g.path,version:g.installedVersion}));
    for(const id of ids){
        const before=initial.games.find(g=>g.id===id),configName=id==='minecraft-snake-arena'?'tikmng-snake-arena.json':null;
        const configFile=configName&&before.path?path.join(before.path,'game-instance/config',configName):null;
        const oldConfig=configFile&&fs.existsSync(configFile)?fs.readFileSync(configFile):null;
        await page.evaluate(()=>{window.nativeUpdateProgress=[];window.mngAPI.workspaceListen('progress',p=>window.nativeUpdateProgress.push(p));});
        let started=Date.now();const install=await call('install',{id});assert.equal(install.basarili,true,id+': '+install.hata);const installMs=Date.now()-started;
        const state=(await call('snapshot')).games.find(g=>g.id===id);assert.ok(state.installed);assert.ok(state.path.startsWith(profile));console.log('INSTALLED',id,installMs);
        const update=await page.evaluate(()=>window.nativeUpdateProgress.findLast(p=>p.updateMode==='content'));
        if(oldConfig)assert.deepEqual(fs.readFileSync(path.join(state.path,'game-instance/config',configName)),oldConfig,'Existing settings retained through game update');
        if(id==='minecraft-snake-arena')assert.deepEqual(fs.readdirSync(path.join(state.path,'game-instance/mods')).filter(n=>n.includes('snake')),['tikmng_snake_arena-0.15.3.jar']);
        started=Date.now();const launched=await page.evaluate(id=>window.mngAPI.uygulamaAc(id,{tiktokUser:'benyigit61'}),id);assert.equal(launched.basarili,true,id+': '+launched.hata);
        const launchMs=Date.now()-started;
        const args=fs.readFileSync(path.join(state.path,'game-instance/launch-args.txt'),'utf8').split(/\r?\n/).filter(Boolean).map(line=>{try{return JSON.parse(line);}catch{return '';}});
        const bridgePort=args.find(v=>v.startsWith('-Dmng.bridge.port='))?.split('=')[1];assert.ok(bridgePort);
        let health;for(let n=0;n<40;n++){health=await fetch(`http://127.0.0.1:${bridgePort}/health`).then(r=>r.json());if(health.state==='connected')break;await sleep(500);}
        assert.equal(health.username,'benyigit61',id+' Java client delivered selected account');
        assert.ok(health.clients>0,id+' Java event receiver connected');
        const log=fs.readFileSync(path.join(state.path,'game-instance/launch.log'),'utf8');assert.match(log,/MNG_(?:SNAKE|SNOW|BATTLE)_ARENA_READY/);
        const widgetResponses=[];
        if(id==='minecraft-snake-arena'){
            const port=args.find(v=>v.startsWith('-Dmng.snake.widget.port='))?.split('=')[1],key=args.find(v=>v.startsWith('-Dmng.snake.widget.key='))?.split('=')[1];assert.ok(port&&key);
            let status;for(let i=0;i<60;i++){status=await fetch(`http://127.0.0.1:${port}/status?key=${key}`).then(r=>r.json());if(status.secure)break;await sleep(500);}
            assert.equal(status.secure,true);
            for(const url of [status.sizeURL,status.winsURL]){const response=await fetch(url,{signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);widgetResponses.push(response.status);}
        }
        result.games.push({id,version:state.installedVersion,installMs,launchMs,nativeReady:true,accountDelivered:true,nativeEventReceiverConnected:true,liveState:health.state,httpsWidgets:widgetResponses,existingConfigPreserved:!!oldConfig,contentUpdate:update?{changedFiles:update.changedFiles,transferredBytes:update.totalBytes,reusedBytes:update.reusedBytes,packageBytes:update.packageBytes}:null});console.log('VERIFIED',id,health.state);
        assert.equal((await page.evaluate(()=>window.mngAPI.uygulamaAc('crowd-control'))).basarili,true);
        const web=app.windows().find(w=>/^http:\/\/localhost:/.test(w.url()));assert.ok(web);await web.close();
    }
    const after=await call('snapshot');for(const old of preserved){const actual=after.games.find(g=>g.id===old.id);assert.equal(actual.path,old.path);assert.equal(actual.installedVersion,old.version);}
    result.otherGamesPreserved=preserved.length;result.passed=true;
}
main().catch(error=>{result.error=error.stack;console.error(error);process.exitCode=1;}).finally(async()=>{await app?.close();fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));});
