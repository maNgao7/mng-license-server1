'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output='D:/TikMnG-Widget-Transparent-20261027/existing-update';let app;
async function run(){
    fs.mkdirSync(output,{recursive:true});const profile=fs.mkdtempSync(path.join(output,'profile-'));
    const env={...process.env,MNG_TEST_PROFILE:profile,MNG_WIDGET_PORT:'32975'};delete env.ELECTRON_RUN_AS_NODE;
    app=await _electron.launch({executablePath:'D:/TikMnG-Release-7.0.5-final/win-unpacked/TikMnG.exe',env,timeout:60000});
    const page=await app.firstWindow();await page.waitForFunction(()=>window.mngAPI&&document.querySelector('#workspaceRoot'),null,{timeout:60000});
    const result=await page.evaluate(()=>window.mngAPI.surumKontrolEt());
    assert.equal(result.currentVersion,'7.0.5');assert.equal(result.latestVersion,'7.0.6');assert.equal(result.guncellemeVar,true);assert.ok(!result.checkFailed);
    const report={passed:true,installedVersion:result.currentVersion,detectedVersion:result.latestVersion,updateAvailable:result.guncellemeVar,fallback:result.fallback||false,isolatedProfile:true,installerNotLaunched:true};
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
run().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{await app?.close();});
