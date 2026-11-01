'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');let app;
async function main(){
    const data=fs.mkdtempSync(path.join(root,'qa/710/native-')),env={...process.env,MNG_CONTEST_NATIVE_DATA:data,MNG_CONTEST_NATIVE_PACKAGE:'D:/TikMnG-Release-7.0.10-ready/games/profile-contest'};delete env.ELECTRON_RUN_AS_NODE;
    app=await _electron.launch({executablePath:'C:/Users/User/Desktop/MNG-TikTok-Game/launcher/node_modules/electron/dist/electron.exe',args:[path.join(__dirname,'profile-contest-native-driver.cjs')],env});
    const page=await app.firstWindow();await page.waitForSelector('#frame-style-button');const url=new URL(page.url());const room=url.searchParams.get('room'),base=url.origin;
    const command=async(action,args={})=>{const result=await(await fetch(base+'/api/sessions/'+room+'/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,args})})).json();assert.ok(result.snapshot);return result;};
    await command('examples');const state=await(await fetch(base+'/api/sessions/'+room+'/state')).json();
    for(let slot=0;slot<3;slot++)await command('assign',{slot,id:state.profiles[slot].id});
    await command('frame-style',{id:'meteor-trail'});await command('toggle');await command('vote',{user:'alice',text:'2'});await command('gift',{user:'alice',giftId:'5303',repeat:2});
    await page.waitForFunction(()=>document.querySelector('[data-score="1"]')?.textContent==='101');
    assert.equal(await page.locator('[data-contestant]').count(),3);await page.screenshot({path:path.join(root,'qa/710/profile-contest-native.png')});
    const sandbox=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.isVisible()).map(w=>w.webContents.getLastWebPreferences()));assert.ok(sandbox.every(p=>p.sandbox&&p.contextIsolation&&!p.nodeIntegration));
    await app.evaluate(async()=>{await globalThis.qaContestSession.close();});
    await app.close();app=null;
    const saved=JSON.parse(fs.readFileSync(path.join(data,'contest/rooms',room+'.json')));assert.equal(saved.state.slots.filter(Boolean).length,3);assert.equal(saved.state.giftPoints[1],100);
    const result={passed:true,launcherAdapter:true,packagedHost:true,threePlayers:true,scoring:true,sandbox:true,savedOnClose:true};fs.writeFileSync(path.join(root,'qa/710/profile-contest-native.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(async()=>{await app?.close();});
