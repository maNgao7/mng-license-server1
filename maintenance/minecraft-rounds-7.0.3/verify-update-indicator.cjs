'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const launcher='C:/Users/User/Desktop/MNG-TikTok-Game/launcher';
const asar=require(path.join(launcher,'node_modules/@electron/asar'));
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const archive=path.join(process.env.LOCALAPPDATA,'Programs/mng-tiktok-game/resources/app.asar');
const output='D:/TikMnG-Minecraft-Oyun-Guncellemesi-7.0.3';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const extract=file=>asar.extractFile(archive,path.normalize(file));
const catalog=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../content-defaults.json'),'utf8'));
const ids=['snow-war','battle-royale'];
const libraryRoot=path.join(process.env.APPDATA,'mng-tiktok-game/games');
const {createGameLibrary}=require(path.join(launcher,'lib/game-library.cjs'));
const library=createGameLibrary({root:libraryRoot,definitions:Object.fromEntries(ids.map(id=>[id,{klasor:id}])),
    getPackage:id=>catalog.games.find(g=>g.id===id),validate:(directory,id)=>fs.existsSync(path.join(directory,'game-instance/mods',id==='snow-war'?'mng-snow-war-1.0.0.jar':'mng_battle_royale-1.0.0.jar'))});
const pointers=Object.fromEntries(ids.map(id=>[id,fs.readFileSync(path.join(libraryRoot,'.game-library',id,'active.json'))]));
const appHash=hash(fs.readFileSync(archive));
const snapshot={games:ids.map(id=>({id,...library.state(id),ad:catalog.games.find(g=>g.id===id).title,minecraft:true,description:'',requirements:'Windows 10/11',downloadReady:true,resources:[]})),
    gameAnnouncements:[],version:JSON.parse(extract('package.json')).version,preview:false,media:[],mediaAssets:[],audioLibrary:[],remoteMedia:[],soundEffects:[],tts:{},source:'direct',mediaDownloads:{active:[],pending:[]}};
const html='<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/workspace-v3.css"><link rel="stylesheet" href="/gift-guide.css"><body><div class="launcher"><main class="main"></main></div><script src="/vendor/lucide.js"></script><script src="/gift-catalog-view.js"></script><script src="/workspace.js"></script></body></html>';
let server,browser;
async function main(){
    assert.equal(snapshot.version,'7.0.6');
    assert.equal(hash(extract('lib/game-library.cjs')),hash(fs.readFileSync(path.join(launcher,'lib/game-library.cjs'))));
    server=http.createServer((req,res)=>{
        const url=new URL(req.url,'http://fixture');
        if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}
        const relative=decodeURIComponent(url.pathname).slice(1);
        if(relative.split('/').some(p=>p==='..'||p==='.')||relative.includes('\\')){res.writeHead(404);return res.end();}
        try{const bytes=extract('renderer/'+relative);res.setHeader('Content-Type',({'.css':'text/css','.js':'text/javascript','.png':'image/png'})[path.extname(relative)]||'application/octet-stream');res.end(bytes);}
        catch{res.writeHead(404);res.end();}
    });
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    browser=await chromium.launch({channel:'chrome',headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.exposeFunction('__workspace',action=>action==='speech-status'?{voices:[],packs:[],voiceLibrary:[],providers:{}}:snapshot);
    await page.addInitScript(()=>{window.mngAPI={workspace:action=>window.__workspace(action),workspaceListen(){},orbitHediyeKatalogu:async()=>[],widgetBilgisi:async()=>({channel:'',widgets:[],liveStatus:{status:'disconnected'}})};});
    await page.goto('http://127.0.0.1:'+server.address().port);
    const results=[];
    for(const id of ids){
        const state=snapshot.games.find(g=>g.id===id);assert.equal(state.updateAvailable,true,id+' should advertise the newer package');
        const card=page.locator('[data-game-id="'+id+'"]');await card.waitFor();
        assert.match(await card.locator('.cover-badge').innerText(),/Güncelleme var/);
        await card.locator('[data-open]').click();
        const button=page.locator('[data-install="'+id+'"]');await button.waitFor();
        assert.match(await button.innerText(),/Oyunu güncelle/);assert.equal(await button.isEnabled(),true);
        await page.locator('.game-detail').screenshot({path:path.join(output,id+'-existing-launcher-update.png')});
        results.push({id,installedVersion:state.installedVersion,availableVersion:state.availableVersion,updateAvailable:true,existingUpdateButtonVisible:true,existingUpdateButtonEnabled:true});
        await page.locator('[data-back]').click();
    }
    assert.deepEqual(errors,[]);assert.equal(hash(fs.readFileSync(archive)),appHash);
    for(const id of ids)assert.deepEqual(fs.readFileSync(path.join(libraryRoot,'.game-library',id,'active.json')),pointers[id]);
    const report={passed:true,checkedAt:new Date().toISOString(),existingLauncherVersion:snapshot.version,
        renderSource:'unmodified installed launcher ASAR',uiStateFixture:true,realCatalogAndInstalledVersionDetection:true,
        installedGamesNotUpdatedByThisCheck:true,stableProgramAndPointersUnchanged:true,launcherRebuildRequired:false,games:results};
    fs.writeFileSync(path.join(output,'existing-launcher-update-indicator.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.closeAllConnections();if(server)await new Promise(r=>server.close(r));});
