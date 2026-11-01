'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),semver=require('semver');
const {_electron}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const current=process.env.MNG_UPDATER_CURRENT||require('../package.json').version,latest=process.env.MNG_UPDATER_LATEST||require('../package.json').version;
const out=process.env.MNG_UPDATER_QA_OUTPUT||`D:/TikMnG-QA-Delivery/${latest}/updater-${current}`;fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(out,'profile-')),result={passed:false,installedNothing:true,userProfileUntouched:true};let app;
(async()=>{
  const env={...process.env,MNG_TEST_PROFILE:profile,MNG_WIDGET_PORT:'31979'};delete env.ELECTRON_RUN_AS_NODE;
  app=await _electron.launch({executablePath:process.env.MNG_UPDATER_QA_EXE||`D:/TikMnG-Release-${current}-ready/win-unpacked/TikMnG.exe`,env,timeout:60000});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.hide()));
  const page=await app.firstWindow();await page.waitForFunction(()=>window.mngAPI?.surumKontrolEt);
  await page.evaluate(()=>window.mngAPI.workspace('media-background',{enabled:false}));
  const update=await page.evaluate(()=>window.mngAPI.surumKontrolEt());
  result.update={available:update.guncellemeVar,current:update.currentVersion,latest:update.latestVersion,error:update.hata};
  result.runtimeSemver=await app.evaluate(()=>process.mainModule.require('semver/package.json').version);
  assert.equal(update.hata,undefined);assert.equal(update.currentVersion,current);assert.equal(update.latestVersion,latest);assert.equal(update.guncellemeVar,semver.gt(latest,current));
  if(update.guncellemeVar){
    const shown=await page.evaluate(async()=>{await guncellemeKontrolEt();return {visible:getComputedStyle(document.getElementById('updateModal')).display,version:document.getElementById('newVerTag').textContent};});
    assert.equal(shown.visible,'flex');assert.equal(shown.version,'v'+latest);result.updateDialog=shown;
  }
  result.passed=true;
})().catch(error=>{result.error=String(error.message).replace(/https?:\/\/\S+/g,'[url]').slice(0,700);process.exitCode=1;}).finally(async()=>{await app?.close();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));});
