'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {_electron}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output='D:/TikMnG-QA-Delivery/voice-driving-0611';fs.mkdirSync(output,{recursive:true});
let application;
(async()=>{
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.MNG_TEST_PROFILE;
  application=await _electron.launch({executablePath:'D:/TikMnG-Test-6.5.17/win-unpacked/TikMnG Test.exe',env,timeout:40000});
  const page=await application.firstWindow();await page.waitForSelector('[data-game-id="caahr"]',{timeout:40000});
  const snapshot=await page.evaluate(()=>window.mngAPI.workspace('snapshot'));
  const game=snapshot.games.find(game=>game.id==='caahr');assert.equal(snapshot.preview,true);assert.equal(game.installed,true);assert.equal(game.giftGuide.bytes,204516);assert.equal(game.installedVersion,'0.6.11');assert.equal(game.updateAvailable,false);
  await page.locator('[data-game-id="caahr"] .cover-new').waitFor();
  await page.locator('[data-open="caahr"]').click();await page.locator('[data-play="caahr"]').waitFor();
  const steamURL='https://store.steampowered.com/app/4745400/CAAAHR_Demo/';
  const steam=page.getByRole('button',{name:"Steam'den indir",exact:true});
  assert.equal(await steam.getAttribute('data-url'),steamURL);
  const playBounds=await page.locator('[data-play="caahr"]').boundingBox(),steamBounds=await steam.boundingBox();
  assert.ok(steamBounds.x>playBounds.x&&Math.abs(steamBounds.y-playBounds.y)<2,'Steam button must be next to Play');
  await application.evaluate(({shell})=>{globalThis.voiceSteamOpen=shell.openExternal;globalThis.voiceSteamURLs=[];shell.openExternal=async url=>{globalThis.voiceSteamURLs.push(url);};});
  try{await steam.click();await page.waitForTimeout(150);assert.deepEqual(await application.evaluate(()=>globalThis.voiceSteamURLs),[steamURL]);}
  finally{await application.evaluate(({shell})=>{shell.openExternal=globalThis.voiceSteamOpen;delete globalThis.voiceSteamOpen;delete globalThis.voiceSteamURLs;});}
  const image=page.locator('.game-detail-cover img');await image.evaluate(img=>img.decode());assert.match(await image.getAttribute('src'),/caahr-v2/);
  const destination=path.join(output,'Sesli-Surus-Hediyeler.png');
  await application.evaluate(({dialog},destination)=>{globalThis.voiceGuideDialog=dialog.showSaveDialog;dialog.showSaveDialog=async()=>({canceled:false,filePath:destination});},destination);
  try{await page.locator('[data-gift-guide="caahr"]').click();await page.waitForFunction(()=>document.body.textContent.includes('Hazır hediye görseli indirildi'));}
  finally{await application.evaluate(({dialog})=>{dialog.showSaveDialog=globalThis.voiceGuideDialog;delete globalThis.voiceGuideDialog;});}
  const hash=crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex');assert.equal(hash,game.giftGuide.sha256);
  await page.screenshot({path:path.join(output,'game-detail.png'),mask:[page.locator('#allMediaLink')]});
  const result={passed:true,previewOnly:true,gameCount:snapshot.games.length,gameInstalled:true,coverDecoded:true,guideDownloaded:true,guideHash:hash,steamLinkNextToPlay:true,steamLinkOpensCorrectDemo:true,stableReleasePublished:false};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await application?.close();});
