'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {_electron}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const samples=require('../renderer/speech-previews.js');
const output='D:/TikMnG-QA-Delivery/voice-previews-native';
const profile=path.join(output,'profile-'+Date.now());let application;
(async()=>{
    fs.mkdirSync(output,{recursive:true});
    const env={...process.env,MNG_TEST_PROFILE:profile,MNG_WIDGET_PORT:'31978'};delete env.ELECTRON_RUN_AS_NODE;
    application=await _electron.launch({executablePath:'D:/TikMnG-Test-6.5.17/win-unpacked/TikMnG Test.exe',env,args:['--autoplay-policy=no-user-gesture-required']});
    const page=await application.firstWindow();await page.waitForSelector('.library-card');
    await page.evaluate(()=>{const NativeAudio=window.Audio;window.__qaAudio=[];window.Audio=function(...args){const audio=new NativeAudio(...args);window.__qaAudio.push(audio);return audio;};});
    // The synthetic profile has no paid license. Only exercise the owned renderer's preview handlers; no login is asserted.
    await page.locator('[data-workspace-view="speech"]').evaluate(button=>button.click());
    await page.waitForFunction(()=>document.querySelectorAll('[data-voice-sample-download]').length===12);
    const played=[];
    for(const uri of Object.keys(samples.files)){
        const start=Date.now();await page.locator(`[data-voice-test="${uri}"]`).evaluate(button=>button.click());
        await page.waitForFunction(()=>window.__qaAudio.at(-1)?.currentTime>0&&!window.__qaAudio.at(-1)?.paused);
        const audio=await page.evaluate(()=>{const audio=window.__qaAudio.at(-1);return{src:audio.currentSrc,duration:audio.duration,rate:audio.playbackRate};});
        assert.ok(audio.src.endsWith('/'+samples.files[uri]));assert.ok(audio.duration>1);assert.equal(audio.rate,1);
        played.push({uri,firstSoundMs:Date.now()-start,duration:audio.duration});
        await page.locator('[data-action="speech-stop"]').evaluate(button=>button.click());
    }
    assert.equal(fs.existsSync(path.join(profile,'voices/chatterbox-v3')),false,'Previewing must not download the 3.4 GiB engine');
    const target=path.join(output,'Ece - Tik MNG - '+Date.now()+'.wav');
    await application.evaluate(({dialog},file)=>{globalThis.originalPreviewSave=dialog.showSaveDialog;dialog.showSaveDialog=async()=>({canceled:false,filePath:file});return true;},target);
    try{
        await page.locator('[data-voice-sample-download="chatterbox:d2-00331"]').evaluate(button=>button.click());
        for(let i=0;i<50&&!fs.existsSync(target);i++)await new Promise(resolve=>setTimeout(resolve,100));
        assert.ok(fs.existsSync(target),await page.locator('#workspaceNotice').innerText());
        const actual=crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
        const expected=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../renderer',samples.source('chatterbox:d2-00331')))).digest('hex');assert.equal(actual,expected);
    }finally{await application.evaluate(({dialog})=>{dialog.showSaveDialog=globalThis.originalPreviewSave;return true;});}
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,installedApp:true,licenseLoginNotTested:true,isolatedProfile:true,previews:played,sampleDownload:true,sampleFile:target,modelNotRequired:true,welcome:samples.text},null,2));
    console.log('Installed preview QA passed: twelve immediate audio samples, native WAV saving, no model download.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await application?.close();});
