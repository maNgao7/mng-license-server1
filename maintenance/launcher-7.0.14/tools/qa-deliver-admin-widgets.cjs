'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {_electron}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output='D:/TikMnG-Widget-QA-20261025/installed-admin';fs.mkdirSync(output,{recursive:true});
const ids=['vs','puanlama','orbit','crowd-control','battle-game','duck-hunt','pony-life','penalty-kick','tightrope-balance'];
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hashValue=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const mutable=['settings.json','config.json','state.json','public/settings.json','.gift-slots.json','.coin-data.json','.gift-catalog.json','euler-api-key.txt','data/pony-live.json'];
function saves(root){return mutable.filter(name=>fs.existsSync(path.join(root,name))).map(name=>({name,hash:hash(path.join(root,name))}));}
const result={passed:false,version:'7.0.2-preview.6',updates:[],unchangedGames:[],stableLauncherChanged:false,liveStudioAcceptance:false};
let app;
async function run(){
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.MNG_TEST_PROFILE;delete env.MNG_WIDGET_PORT;delete env.MNG_WIDGET_ACCESS_KEY;
    app=await _electron.launch({executablePath:'D:/TikMnG-Manager-7.0.0/win-unpacked/TikMnG.exe',args:['--tikmng-preview'],env,timeout:60000});
    const page=await app.firstWindow({timeout:60000});const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.waitForFunction(()=>window.mngAPI&&document.querySelector('#workspaceRoot'),null,{timeout:60000});
    const snapshot=()=>page.evaluate(()=>window.mngAPI.workspace('snapshot'));
    const before=await snapshot();assert.equal(before.preview,true);assert.equal(before.version,result.version);
    const previous=before.games.filter(game=>game.installed).map(game=>({id:game.id,path:game.path,version:game.installedVersion,saves:saves(game.path)}));
    const tts=hashValue(before.tts),media=hashValue(before.media.map(item=>({id:item.id,giftId:item.giftId,gameId:item.gameId})).sort((a,b)=>a.id.localeCompare(b.id)));
    for(const id of ids){
        const current=(await snapshot()).games.find(game=>game.id===id);if(!current.installed)continue;
        if(current.installedVersion!==result.version){
            const started=Date.now(),installed=await page.evaluate(id=>window.mngAPI.workspace('install',{id}),id);assert.equal(installed.basarili,true,id+': '+installed.hata);
            result.updates.push({id,ms:Date.now()-started});console.log('UPDATED',id,Date.now()-started);
        }
        const after=(await snapshot()).games.find(game=>game.id===id);assert.equal(after.installedVersion,result.version);
        const original=previous.find(game=>game.id===id);
        for(const entry of original.saves)assert.equal(hash(path.join(after.path,entry.name)),entry.hash,id+' preserved '+entry.name);
        assert.equal(hash(path.join(after.path,'launcher-widget-links.cjs')),hash(path.resolve(__dirname,'../lib/game-widget-links.cjs')));
    }
    const after=await snapshot();
    for(const original of previous.filter(game=>!ids.includes(game.id))){const actual=after.games.find(game=>game.id===original.id);assert.equal(actual.path,original.path);assert.equal(actual.installedVersion,original.version);for(const entry of original.saves)assert.equal(hash(path.join(actual.path,entry.name)),entry.hash);result.unchangedGames.push(original.id);}
    assert.equal(hashValue(after.tts),tts);
    assert.equal(hashValue(after.media.map(item=>({id:item.id,giftId:item.giftId,gameId:item.gameId})).sort((a,b)=>a.id.localeCompare(b.id))),media);
    const announcement=page.locator('[data-announcement-close]');if(await announcement.isVisible())await announcement.click();
    await page.locator('[data-workspace-view="games"]').click();await page.locator('[data-open="orbit"]').click();await page.locator('#gameWidgets').waitFor({state:'visible'});
    await page.locator('#gameWidgets').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'widget-controls.png')});
    assert.deepEqual(errors,[]);result.passed=true;result.settingsPreserved=true;result.mediaAssignmentsPreserved=true;result.ttsSettingsPreserved=true;result.errors=errors;
}
run().catch(error=>{result.error=error.stack;console.error(error.stack);process.exitCode=1;}).finally(async()=>{await app?.close();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));});
