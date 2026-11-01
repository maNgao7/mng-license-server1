'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createStudio}=require('../lib/widget-studio.cjs');
const output=path.resolve(__dirname,'../qa/20261030'),store=new Map();
const studio=createStudio({get:(key,value)=>structuredClone(store.get(key)??value),set:(key,value)=>store.set(key,structuredClone(value))},()=>'/widget/gift-assets/7934.png');
studio.save('qa','raconlist',{giftId:'7934'});
let serial=0;
const gift=(username,count=1,giftId='7934',extra={})=>({id:'qa-'+(++serial),type:'gift',username,nickname:username,avatar:'/widget/gift-assets/logo-v3.png',giftId,count,coins:count,createdAt:Date.now(),...extra});
for(const [username,count] of [['efe',12],['deniz',9],['kerem',7],['selin',5],['eren',2]])studio.ingest('qa',gift(username,count));
let data={studio:studio.state('qa')},server,browser;
async function main(){
    server=http.createServer((req,res)=>{
        const pathname=new URL(req.url,'http://localhost').pathname;
        if(pathname==='/api/widget/state'){res.setHeader('content-type','application/json');res.end(JSON.stringify(data));return;}
        const assets={
            '/widget/gift-assets/logo-v3.png':'renderer/assets/logo-v3.png',
            '/widget/gift-assets/7934.png':'renderer/gift-assets/7934.png',
            '/widget/gift-assets/racon-list-seat-v2.png':'renderer/widgets/royal-assets/racon-list-seat-v2.png'
        };
        const relative=pathname==='/'?'renderer/widgets/live-score-widgets.html':assets[pathname];
        if(!relative){res.writeHead(404);res.end();return;}
        res.setHeader('content-type',pathname==='/'?'text/html; charset=utf-8':'image/png');
        fs.createReadStream(path.resolve(__dirname,'..',relative)).pipe(res);
    });
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    browser=await chromium.launch({channel:'chrome',headless:true});
    const page=await browser.newPage({viewport:{width:760,height:660}}),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?type=raconlist');
    await page.locator('.racon-chair').first().waitFor();
    await page.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
    await page.waitForTimeout(550);
    assert.equal(await page.locator('.racon-chair').count(),3);assert.equal(await page.locator('.racon-row').count(),2);
    assert.equal(await page.locator('.racon-chair .avatar img').count(),3);assert.equal(await page.locator('.racon-row .avatar').count(),0);
    assert.deepEqual(await page.locator('.racon-row .name').allTextContents(),['@selin','@eren']);
    assert.deepEqual(await page.locator('.count b').allTextContents(),['12X','9X','7X','5X','2X']);
    const geometry=await page.evaluate(()=>{
        const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
        return {first:box('.seat-1'),second:box('.seat-2'),third:box('.seat-3'),avatar:box('.seat-1 .avatar'),tail:box('.racon-tail')};
    });
    assert.ok(geometry.third.left<geometry.first.left&&geometry.first.left<geometry.second.left);
    assert.ok(geometry.first.width>geometry.second.width*1.5);assert.ok(geometry.avatar.width>=150,'profile larger than the old 96px portrait');
    assert.ok(geometry.tail.top>=geometry.first.bottom);assert.equal(Math.round(geometry.avatar.width),Math.round(geometry.avatar.height));
    const alpha=await page.locator('.chair-art').first().evaluate(img=>{
        const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
        const c=canvas.getContext('2d');c.drawImage(img,0,0);
        const pixel=(x,y)=>[...c.getImageData(x,y,1,1).data];
        return {width:canvas.width,height:canvas.height,corner:pixel(0,0),body:pixel(Math.floor(canvas.width*.5),Math.floor(canvas.height*.7)),profile:pixel(Math.floor(canvas.width*.49),Math.floor(canvas.height*.32))};
    });
    assert.equal(alpha.corner[3],0,'chair background must have real alpha');assert.ok(alpha.body[3]>240);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
    await page.screenshot({path:path.join(output,'racon-podium-760.png'),omitBackground:true});
    await page.locator('[data-person="efe"] .avatar img').evaluate(n=>{window.qaAvatar=n;});
    const countRequests=requests.length;
    studio.ingest('qa',gift('efe'));data={studio:studio.state('qa')};await page.evaluate(data=>paint(data),data);
    assert.equal(await page.locator('.seat-1 .count b').textContent(),'13X');
    assert.equal(await page.locator('[data-person="efe"] .avatar img').evaluate(n=>n===window.qaAvatar),true);
    assert.equal(requests.length,countRequests,'gift-count updates must not reload chair/profile assets');
    const receipt=gift('kerem',20);studio.ingest('qa',receipt);studio.ingest('qa',receipt);studio.ingest('qa',gift('intruder',999,'5655'));
    data={studio:studio.state('qa')};await page.evaluate(data=>paint(data),data);
    assert.equal(await page.locator('.seat-1 [data-person]').getAttribute('data-person'),'kerem');
    assert.equal(await page.locator('.seat-1 .count b').textContent(),'27X');
    assert.equal(await page.locator('[data-person="efe"] .avatar img').evaluate(n=>n===window.qaAvatar),true,'seat changes must preserve existing profile elements');
    assert.equal(new Set(await page.locator('[data-person]').evaluateAll(nodes=>nodes.map(n=>n.dataset.person))).size,5);
    assert.equal(await page.locator('[data-person="intruder"]').count(),0);
    const pending=gift('deniz',100,'7934',{giftType:1,repeatEnd:false});studio.ingest('qa',pending);
    assert.equal(studio.state('qa').raconRanking.find(r=>r.username==='deniz').count,9);
    studio.ingest('qa',{...pending,repeatEnd:true});assert.equal(studio.state('qa').raconRanking.find(r=>r.username==='deniz').count,109);
    data.studio.raconRanking[0].username='very.long_username_123456789';data.studio.raconRanking[0].count=1000000000000;
    await page.setViewportSize({width:360,height:640});await page.evaluate(data=>paint(data),data);
    const fits=await page.evaluate(()=>[...document.querySelectorAll('.count b,.name')].every(n=>n.scrollWidth<=n.clientWidth+1)&&[...document.querySelectorAll('.seat,.racon-row')].every(n=>{const r=n.getBoundingClientRect();return r.left>=-.5&&r.right<=innerWidth+.5;}));
    assert.equal(fits,true,'long handles and totals must fit at small size');
    await page.screenshot({path:path.join(output,'racon-podium-360.png'),omitBackground:true});
    data.studio.settings.raconlist.lighting=false;data.studio.settings.raconlist.animation=false;await page.evaluate(data=>paint(data),data);
    assert.equal(await page.locator('.chair-glint').first().evaluate(n=>getComputedStyle(n).display),'none');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.racon-chair').first().evaluate(n=>getComputedStyle(n).animationName),'none');
    for(const amount of [2,1,0]){data.studio.raconRanking=data.studio.raconRanking.slice(0,amount);await page.evaluate(data=>paint(data),data);assert.equal(await page.locator('.racon-chair').count(),amount);}
    assert.equal(await page.locator('.waiting').count(),1);
    assert.equal(requests.some(url=>url.includes('royal-racon.png')),false,'new list must not use the existing Racon Krali throne');
    assert.deepEqual(errors,[]);
    const result={passed:true,threeChairs:true,firstCenterSecondRightThirdLeft:true,largerCircularProfiles:geometry.avatar.width,
        lowerRowsUsernameOnly:true,countsAccumulatePerGift:true,terminalStreaksOnce:true,duplicateReceiptsIgnored:true,
        wrongGiftsIgnored:true,avatarsPreserved:true,transparent:true,asset:alpha,smallAndDesktopFit:true,emptyAndPartialLists:true,reducedMotion:true,errors};
    fs.writeFileSync(path.join(output,'racon-podium-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}});
