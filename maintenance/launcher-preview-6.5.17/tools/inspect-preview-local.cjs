'use strict';
// Private-machine acceptance check. Never print account names, keys or license data.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {_electron}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let application;
(async()=>{
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.MNG_TEST_PROFILE;
    application=await _electron.launch({executablePath:'D:/TikMnG-Test-6.5.17/win-unpacked/TikMnG Test.exe',env,timeout:30000});
    const page=await application.firstWindow();await page.waitForSelector('#workspaceRoot');
    console.log('Packaged test launcher opened.');
    await page.waitForFunction(async()=>{const d=await window.mngAPI.workspace('snapshot');return d.preview&&d.media.length>=159;},{},{timeout:60000});
    const initial=await page.evaluate(async()=>{const d=await window.mngAPI.workspace('snapshot');return{preview:d.preview,media:d.media.length,games:d.games.length};});
    assert.equal(initial.preview,true);assert.equal(initial.games,14);
    await page.locator('#launcher').waitFor({state:'visible',timeout:30000});
    const installed=await page.evaluate(async()=>window.mngAPI.workspace('install',{id:'crowd-control',repair:false}));assert.equal(installed.basarili,true,installed.hata);
    console.log('Real game package is installed.');
    const gameWindow=application.waitForEvent('window',{timeout:45000});gameWindow.catch(()=>{});
    const opened=await page.evaluate(()=>window.mngAPI.uygulamaAc('crowd-control',{}));assert.equal(opened.basarili,true,opened.hata);
    console.log('Game launch accepted.');
    const game=await gameWindow;
    console.log('Game window opened.');
    await game.locator('#startOfflineBtn').click({timeout:30000});
    await game.waitForFunction(()=>{const canvas=document.getElementById('gameCanvas');if(!canvas?.width)return false;return canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some(value=>value>0);});
    console.log('Game canvas is rendering.');
    await game.close();
    await page.waitForFunction(async()=>!(await window.mngAPI.workspace('snapshot')).activeGame);
    let gamePortClosed=false;
    for(let attempt=0;attempt<50;attempt++){
        try{await fetch('http://127.0.0.1:3020/api/health',{signal:AbortSignal.timeout(200)});}catch{gamePortClosed=true;break;}
        await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.equal(gamePortClosed,true,'Closing the game must release its owned server');
    console.log('Game window closed.');
    await page.locator('[data-workspace-view="media"]').click();
    let decoded=false;
    for(let attempt=0;attempt<5&&!decoded;attempt++){
        try{
            const video=page.frameLocator('#mediaLibrary iframe').first().locator('video');await video.waitFor();
            await video.evaluate(video=>new Promise((resolve,reject)=>{if(video.readyState>=2)return resolve();video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',()=>reject(new Error('Local video decoding failed')),{once:true});}));decoded=true;
        }catch(error){if(attempt===4)throw error;}
    }
    await page.screenshot({path:'D:/TikMnG-Launcher-Test-Raporu/test-launcher-video.png',mask:[page.locator('#allMediaLink')]});
    await page.locator('[data-workspace-view="games"]').click();await page.locator('[data-game-id="crowd-control"]').waitFor();
    await page.screenshot({path:'D:/TikMnG-Launcher-Test-Raporu/test-launcher-gercek.png'});
    const profile=await application.evaluate(({app})=>app.getPath('userData'));assert.ok(profile.endsWith('TikMnG-Test-6.5.17'));
    const update=await page.evaluate(()=>window.mngAPI.surumKontrolEt());
    console.log(JSON.stringify({passed:true,...initial,privateProfile:true,realDownloadInstalled:'crowd-control',actualGameWindowAndCanvas:true,gamePortClosed,realArchivePreviews:true,publicUpdateOff:!update.guncellemeVar}));
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{await application?.close();});
