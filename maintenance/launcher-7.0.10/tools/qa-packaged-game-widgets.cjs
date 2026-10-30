'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {once}=require('node:events'),net=require('node:net');
const Store=require('electron-store');
const {_electron}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output=process.env.MNG_QA_OUTPUT||'D:/TikMnG-Widget-QA-20261025/packaged';
fs.mkdirSync(output,{recursive:true});
const profile=process.env.MNG_QA_PROFILE?path.resolve(process.env.MNG_QA_PROFILE):fs.mkdtempSync(path.join(output,'profile-'));
assert.equal(path.dirname(profile),path.resolve(output),'Only this QA run can reuse its isolated profile');
assert.ok(path.basename(profile).startsWith('profile-'));
const sourceProfile=path.join(process.env.APPDATA,'TikMnG-Test-6.5.17');
const savedFile=path.join(sourceProfile,'mng-config.json');
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const before=digest(savedFile),version=process.env.MNG_QA_VERSION||'7.0.2-preview.6',key=crypto.randomBytes(16).toString('hex');
const saved=new Store({cwd:sourceProfile,projectVersion:'7.0.2-preview.5',name:'mng-config',encryptionKey:'mng-electron-secret-key-2024'});
const store=new Store({cwd:profile,projectVersion:version,name:'mng-config',encryptionKey:'mng-electron-secret-key-2024'});
for(const name of ['lisans_kod','cihaz_kimlik','lisans_token','lisans_bitis','son_dogrulama','is_unlimited'])if(saved.has(name))store.set(name,saved.get(name));
store.set('preview_initialized_v1',true);
store.set('library_root_v1',path.join(profile,'games'));
store.set('media_root_v1',path.join(profile,'media'));
store.set('media_background_enabled_v1',false);
store.set('tiktok_active_account','qa_host');
store.set('tts_settings_v1',{enabled:false,names:false});
const ids=['vs','puanlama','orbit','crowd-control','battle-game','duck-hunt','pony-life','penalty-kick','tightrope-balance'];
const ports={vs:3000,puanlama:3000,orbit:3010,'crowd-control':3020,'battle-game':3030,'duck-hunt':3040,'pony-life':3050,'penalty-kick':3070,'tightrope-balance':3080};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(fn,message,ms=30000){const until=Date.now()+ms;while(Date.now()<until){if(await fn())return;await sleep(200);}throw Error(message);}
async function freePort(){const server=net.createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
let app;
const result={passed:false,version,isolatedProfile:true,installations:[],games:[],rendererErrors:[],realTikTokGiftsSent:false,liveStudioAcceptance:false};
async function run(){
    const port=await freePort(),env={...process.env,MNG_TEST_PROFILE:profile,MNG_WIDGET_PORT:String(port),MNG_WIDGET_ACCESS_KEY:key};delete env.ELECTRON_RUN_AS_NODE;
    app=await _electron.launch({executablePath:process.env.MNG_QA_EXE||'D:/TikMnG-Manager-Snake-0.15.0-candidate/win-unpacked/TikMnG.exe',args:process.env.MNG_QA_STABLE==='1'?[]:['--tikmng-preview'],env,timeout:60000});
    const page=await app.firstWindow({timeout:60000});page.on('pageerror',error=>result.rendererErrors.push(error.message));
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(window=>window.hide()));
    await page.waitForFunction(()=>window.mngAPI&&document.querySelector('#workspaceRoot'),null,{timeout:60000});
    const snapshot=()=>page.evaluate(()=>window.mngAPI.workspace('snapshot'));
    const initial=await snapshot();assert.equal(initial.version,version);assert.equal(initial.preview,process.env.MNG_QA_STABLE!=='1');assert.equal(initial.libraryRoot,path.join(profile,'games'));
    const dialog=page.locator('[data-announcement-close]');if(await dialog.isVisible())await dialog.click();
    await wait(async()=>(await snapshot()).overlayTransport?.ready,'Authenticated HTTPS publisher not ready',60000);
    for(const id of ids){
        const started=Date.now(),installed=await page.evaluate(id=>window.mngAPI.workspace('install',{id}),id);
        assert.equal(installed.basarili,true,id+': '+installed.hata);
        const state=(await snapshot()).games.find(game=>game.id===id);assert.equal(state.installedVersion,require('../lib/catalog-defaults.json').games.find(game=>game.id===id).version,id+' independent package version');
        assert.ok(state.path.startsWith(profile),id+' isolated installed path');
        assert.ok(fs.existsSync(path.join(state.path,'launcher-widget-links.cjs')));
        const packageRoot=state.path;
        const wasInstalled=initial.games.find(game=>game.id===id)?.installed;
        for(const name of ['euler-api-key.txt','.env',...wasInstalled?[]:['.coin-data.json','.gift-slots.json']])assert.equal(fs.existsSync(path.join(packageRoot,name)),false,'Private source file packaged: '+id+'/'+name);
        result.installations.push({id,ms:Date.now()-started,version:state.installedVersion});console.log('INSTALLED',id,Date.now()-started);
    }
    const installed=await snapshot();assert.equal(installed.games.find(g=>g.id==='vs').path,installed.games.find(g=>g.id==='puanlama').path,'Aliases share one physical version');
    for(const id of ids){
        const started=Date.now(),opened=await page.evaluate(id=>window.mngAPI.uygulamaAc(id,{tiktokUser:'qa_host'}),id);assert.equal(opened.basarili,true,id+': '+opened.hata);
        const game=app.windows().find(window=>/^http:\/\/localhost:/.test(window.url()));assert.ok(game,id+' game window');
        game.on('pageerror',error=>result.rendererErrors.push(id+': '+error.message));
        const local=`http://127.0.0.1:${port}`,actual=await fetch(`http://127.0.0.1:${ports[id]}/api/launcher-widget-links?game=${id}`).then(response=>response.json());assert.equal(actual.ready,true,id+' game copy links ready');
        const meta=(await snapshot()).games.find(g=>g.id===id).gameWidgets;assert.deepEqual(actual.links,meta.links);
        for(const widget of meta.widgets){
            const stateURL=new URL('/api/widget/state',local);for(const [name,value] of Object.entries({type:'game',game:id,mode:widget.mode,key,channel:'qa_host'}))stateURL.searchParams.set(name,value);
            await wait(async()=>{const response=await fetch(stateURL);assert.equal(response.status,200);return(await response.json()).online;},id+'/'+widget.mode+' owning game feed offline');
            const response=await fetch(widget.url,{signal:AbortSignal.timeout(20000)});assert.equal(response.status,200,id+'/'+widget.mode+' public document');assert.match(await response.text(),/api\/widget\/state/);
            const publicState=new URL(widget.url);publicState.pathname=publicState.pathname.replace('widget-overlay.html','api/widget/state');
            const remote=await fetch(publicState,{signal:AbortSignal.timeout(20000)});assert.equal(remote.status,200);assert.equal((await remote.json()).online,true);
        }
        await page.locator('[data-workspace-view="games"]').click();await page.locator(`[data-open="${id}"]`).click();
        await page.locator('#gameWidgets').waitFor({state:'visible'});assert.equal(await page.locator('#gameWidgets [data-copy]').count(),meta.widgets.length);
        await page.locator('#gameWidgets').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,id+'-widget-controls.png')});
        await game.screenshot({path:path.join(output,id+'-game.png')});
        await game.close();await wait(async()=>!(await snapshot()).activeGame,id+' session cleanup');
        const stateURL=new URL('/api/widget/state',local);for(const [name,value] of Object.entries({type:'game',game:id,key,channel:'qa_host'}))stateURL.searchParams.set(name,value);
        const closed=await fetch(stateURL).then(response=>response.json());assert.equal(closed.online,false);assert.deepEqual(closed.entries,[]);
        result.games.push({id,launchAndWidgetMs:Date.now()-started,httpsModes:meta.widgets.length,realGameWindow:true,owningPackagedFeed:true,publicHTTPS:true,closedStateCleared:true});console.log('VERIFIED',id,meta.widgets.length);
        await page.locator('[data-back]').click();
    }
    assert.deepEqual(result.rendererErrors,[]);assert.equal(digest(savedFile),before,'Real administrator profile unchanged');
    result.passed=true;result.userProfileUnchanged=true;result.sharedAliases=true;result.totalModes=result.games.reduce((sum,game)=>sum+game.httpsModes,0);
}
run().catch(error=>{result.error=error.stack;console.error(error.stack);process.exitCode=1;}).finally(async()=>{await app?.close();result.userProfileUnchanged=digest(savedFile)===before;fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));});
