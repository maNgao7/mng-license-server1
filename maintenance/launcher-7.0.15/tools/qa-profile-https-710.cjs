'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const deps='C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules',{chromium}=require(deps+'/playwright'),sharp=require(deps+'/sharp');
const runtime=require('../../profil-yarismasi-onizleme/lib/runtime.cjs'),root=path.resolve(__dirname,'..');let host,browser;
class Connection extends EventEmitter{async connect(){return {isConnected:true,roomId:'7381234567890123456'};}disconnect(){}}
async function main(){
    let connection;const data=fs.mkdtempSync(path.join(root,'qa/710/https-'));
    host=await require('D:/TikMnG-Release-7.0.10-ready/games/profile-contest/host.cjs').createHost({port:0,record:false,dataDir:data,createConnection:async()=>connection=new Connection(),createOverlay:runtime.createOverlay});
    await host.listen();const id=crypto.randomUUID(),room=host.getRoom(id);await room.live.start('synthetic_host');
    const photo=await sharp({create:{width:1080,height:1080,channels:3,background:'#458bba'}}).png().toBuffer();
    for(let slot=0;slot<3;slot++){const name='synthetic_person'+slot;connection.emit('chat',{user:{uniqueId:name,nickname:'QA '+slot},comment:'Merhaba'});room.command('assign',{slot,id:name});assert.equal(room.importPortrait(name,photo).ok,true);}
    room.command('frame-style',{id:'meteor-trail'});room.command('prepare-widget');
    const end=Date.now()+60000;while(!room.overlayStatus.ready&&Date.now()<end)await new Promise(resolve=>setTimeout(resolve,300));assert.equal(room.overlayStatus.ready,true,'Actual HTTPS relay ready: '+room.overlayStatus.status+' '+room.overlayStatus.message);
    const url=room.overlayStatus.publicBase+'/widget-overlay.html?room='+id;
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('.portrait-aperture img').length===3&&[...document.querySelectorAll('.portrait-aperture img')].every(image=>image.naturalWidth===1080));
    await page.waitForFunction(()=>document.querySelector('.frame-art')?.naturalWidth===1024);assert.equal(await page.locator('#widget-board').getAttribute('data-frame-material'),'sculpture');
    room.command('toggle');connection.emit('chat',{user:{uniqueId:'synthetic_voter'},comment:'2',common:{msgId:'71001'}});connection.emit('gift',{user:{uniqueId:'synthetic_voter'},giftId:'999999',giftType:0,repeatCount:2,diamondCount:37,common:{msgId:'71002'}});
    await page.waitForFunction(()=>document.querySelector('[data-score="1"]')?.textContent==='75');
    const imageSrc=await page.locator('.portrait-aperture img').first().getAttribute('src'),bytes=Buffer.from(await(await fetch(new URL(imageSrc,url))).arrayBuffer());assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),crypto.createHash('sha256').update(photo).digest('hex'));
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
    await page.screenshot({path:path.join(root,'qa/710/profile-https.png'),omitBackground:true});assert.deepEqual(errors,[]);
    const result={passed:true,actualDeployedHTTPS:true,bundledReleaseGame:true,threePlayers:true,arbitraryGiftPoints:true,original1080Bytes:true,newSculptedFrame:true,syntheticEvents:true,realPaidGift:false,errors};fs.writeFileSync(path.join(root,'qa/710/profile-https.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{await browser?.close();await host?.close();});
