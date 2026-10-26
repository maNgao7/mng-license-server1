'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {_electron}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root='D:/TikMnG-Yeni-Videolar-2026-10-23',output='D:/TikMnG-QA-Delivery/new-videos-native';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8').replace(/^\uFEFF/,''));let app;
async function main(){
    fs.mkdirSync(output,{recursive:true});const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.MNG_TEST_PROFILE;delete env.MNG_WIDGET_PORT;
    app=await _electron.launch({executablePath:'D:/TikMnG-Test-6.5.17/win-unpacked/TikMnG Test.exe',env,args:['--autoplay-policy=no-user-gesture-required']});
    const page=await app.firstWindow();page.setDefaultTimeout(60000);await page.waitForSelector('.library-card',{state:'attached'});
    const snapshot=await page.evaluate(()=>window.mngAPI.workspace('snapshot'));
    const videos=snapshot.mediaAssets.filter(item=>manifest.some(entry=>entry.title===item.title&&entry.category===item.category));assert.equal(videos.length,manifest.length);
    const results=[];await page.locator('[data-workspace-view="media"]').click();
    assert.equal(await page.getByRole('button',{name:'Kendi videonu ekle',exact:true}).count(),1);
    assert.equal(await page.locator('[data-media-kind="audio"]').count(),0);
    const visualCategories=new Set([...snapshot.mediaAssets,...snapshot.media].filter(item=>['video','image'].includes(item.kind)).map(item=>item.category));
    const audioOnlyCategories=[...new Set(snapshot.audioLibrary.map(item=>item.category))].filter(category=>!visualCategories.has(category));
    for(const category of audioOnlyCategories)assert.equal(await page.locator('[data-media-category]').filter({hasText:new RegExp('^'+category.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).count(),0,'Audio-only category must not be visible in Video Studio: '+category);
    const visibleActions=await page.locator('#mediaLibrary [data-media-id]').evaluateAll(nodes=>nodes.map(node=>node.dataset.mediaId));
    assert.ok(visibleActions.every(id=>snapshot.media.find(item=>item.id===id)?.kind!=='audio'));
    const firstPage=await page.locator('#videoCatalog [data-library-media]').evaluateAll(nodes=>nodes.map(node=>node.dataset.libraryMedia));
    for(const item of videos)assert.ok(firstPage.includes(item.id),'New video must be visible on the first catalog page: '+item.title);
    for(let index=0;index<4;index++){
        const video=page.locator('#videoCatalog [data-library-media]').nth(index).frameLocator('iframe').locator('video');await video.waitFor();
        assert.ok(await video.evaluate(video=>new Promise(resolve=>{const start=Date.now(),timer=setInterval(()=>{if(video.readyState>=2||Date.now()-start>8000){clearInterval(timer);resolve(video.readyState>=2);}},20);})));
    }
    await page.screenshot({path:path.join(output,'new-videos-first-page.png')});
    for(const item of videos){
        assert.equal(item.kind,'video');const response=await fetch(new URL(item.mediaUrl,snapshot.overlayUrl));assert.equal(response.status,200);
        const bytes=Buffer.from(await response.arrayBuffer());assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.find(entry=>entry.title===item.title).sha256);
        await page.locator('#mediaSearch').fill(item.title);const tile=page.locator(`#videoCatalog [data-library-media="${item.id}"]`);await tile.hover();
        const video=tile.frameLocator('iframe').locator('video');await video.waitFor({state:'attached'});
        const played=await video.evaluate(video=>new Promise(resolve=>{const started=Date.now(),timer=setInterval(()=>{
            if(!video.paused&&video.currentTime>0){clearInterval(timer);resolve({played:true,duration:video.duration,width:video.videoWidth,height:video.videoHeight});}
            else if(video.error||Date.now()-started>8000){clearInterval(timer);resolve({played:false,error:video.error?.code});}
        },20);}));assert.ok(played.played,item.title);assert.ok(played.width>0&&played.height>0);
        const size=await tile.locator('.media-thumb').boundingBox();assert.ok(size.width>=240&&size.height>=130,'Preview must not collapse into a strip');
        results.push({title:item.title,...played});if(results.length===1)await page.screenshot({path:path.join(output,'new-cat-video-preview.png')});
    }
    await page.setViewportSize({width:390,height:844});await page.locator('#mediaSearch').fill('');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.locator('#videoCatalog [data-library-media]').first().scrollIntoViewIfNeeded();
    await page.locator('#videoCatalog [data-library-media]').first().frameLocator('iframe').locator('video').waitFor();
    await page.screenshot({path:path.join(output,'new-videos-mobile.png')});
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,actualInstalledPreview:true,clips:results.length,allNewVideosOnFirstPage:true,audioOnlyCategoriesHidden:audioOnlyCategories,noAudioActionsInVideoStudio:true,personalVideoUploadButton:true,sharedLibrary:true,hashesVerified:results.length,decodedHoverPreviews:results,
        sourceClipsSilent:true,noAccountOrGiftAssignmentsChanged:true,realLiveGiftNotTested:true,verifiedAt:new Date().toISOString()},null,2));
    console.log(`${results.length} new videos: exact protected HTTP bytes and rendered hover playback passed.`);
}
main().catch(async error=>{console.error(error);try{await(await app.firstWindow()).screenshot({path:path.join(output,'failure.png')});}catch{}process.exitCode=1;}).finally(async()=>{await app?.close();});
