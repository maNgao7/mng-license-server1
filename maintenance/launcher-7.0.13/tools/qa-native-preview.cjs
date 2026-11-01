'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const {_electron}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-native-preview-'));
let application;
(async()=>{
    const env={...process.env,MNG_TEST_PROFILE:temporary,MNG_WIDGET_PORT:'31976'};delete env.ELECTRON_RUN_AS_NODE;
    application=await _electron.launch({executablePath:'D:/TikMnG-Test-6.5.17/win-unpacked/TikMnG Test.exe',env,timeout:30000});
    const page=await application.firstWindow();await page.waitForSelector('.library-card');
    const actual=await page.evaluate(async()=>{
        const data=await window.mngAPI.workspace('snapshot');
        const gifts=await window.mngAPI.orbitHediyeKatalogu();
        return{games:data.games.map(g=>({id:g.id,installed:g.installed})),gifts:gifts.length,url:data.overlayUrl,root:data.libraryRoot};
    });
    assert.equal(actual.games.length,14);assert.ok(actual.gifts>600);assert.ok(actual.root.startsWith(temporary));
    for(const image of await page.locator('.cover-button>img').all())await image.evaluate(img=>{img.loading='eager';return img.decode();});
    const giftImage=await page.evaluate(()=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img.naturalWidth);img.onerror=()=>resolve(0);img.src='mng-bg://gift/5655.png';}));
    assert.ok(giftImage>0,'Bundled gift protocol must work without any game installed');
    const forbidden=await fetch('http://127.0.0.1:31976/tikmng/media');assert.equal(forbidden.status,403);
    const protectedStatus=await application.evaluate(async({net},url)=>(await net.fetch(url)).status,actual.url);assert.equal(protectedStatus,200);
    const profile=await application.evaluate(({app})=>app.getPath('userData'));assert.equal(profile,temporary);
    console.log(JSON.stringify({passed:true,packagedBoot:true,games:actual.games.length,gifts:actual.gifts,giftImage,isolatedProfile:true,protectedOverlay:true}));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await application?.close();if(path.dirname(temporary)===path.resolve(os.tmpdir()))fs.rmSync(temporary,{recursive:true,force:true});});
