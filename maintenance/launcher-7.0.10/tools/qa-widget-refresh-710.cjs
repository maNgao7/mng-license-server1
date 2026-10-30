'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {frames}=require('../lib/portrait-frames.cjs'),root=path.resolve(__dirname,'..');let server,browser;
async function main(){
    const output=path.join(root,'qa/710');fs.mkdirSync(output,{recursive:true});let style='sultan',kind='raconking';
    const photo=fs.readFileSync(path.join(root,'../profil-yarismasi-onizleme/dist/assets/photos/4.jpg'));
    server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');
        if(u.pathname==='/api/widget/state'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({activities:[{type:'gift',id:'gift-1',username:'a_very_long_tiktok_username',nickname:'Destekçi',avatar:'/widget/gift-assets/portrait-test.png',giftId:'5655',count:1,coins:1,createdAt:Date.now()}],studio:{settings:{[kind==='myactions'?'myactions:1':kind]:{portraitFrame:style,giftId:'5655',duration:15,sound:false,showUsername:true,showGift:true,lighting:true}},royalLeaders:{[kind]:{id:'gift-1',username:'a_very_long_tiktok_username',nickname:'Destekçi',avatar:'/widget/gift-assets/portrait-test.png',giftId:'5655'}}}}));}
        if(u.pathname==='/widget/gift-assets/portrait-test.png'){res.setHeader('Content-Type','image/jpeg');return res.end(photo);}
        const name=path.basename(u.pathname);if(frames.some(frame=>frame.file===name)){res.setHeader('Content-Type','image/webp');return res.end(fs.readFileSync(path.join(root,'renderer/widgets/royal-assets',name)));}
        if(name==='5655.png'){res.setHeader('Content-Type','image/jpeg');return res.end(photo);}
        if(u.pathname==='/widget-overlay.html'){res.setHeader('Content-Type','text/html');return res.end(fs.readFileSync(path.join(root,'renderer/widgets',kind==='myactions'?'reference-widgets.html':'royal-widgets.html'),'utf8').replace('/*PORTRAIT_FRAME_CATALOG*/[]',JSON.stringify(frames)));}
        res.statusCode=404;res.end();
    });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:900,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
    const checks=[];for(kind of ['raconking','streambeauty','streamhandsome'])for(const frame of frames){style=frame.id;await page.goto(base+'/widget-overlay.html?type='+kind);await page.waitForFunction(()=>document.querySelector('.avatar-photo')?.naturalWidth===1080&&document.querySelector('.art').naturalWidth===1024);
        await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.portrait')).opacity)>.99);
        assert.equal(await page.locator('body').getAttribute('data-frame-custom'),'true');assert.equal(await page.locator('.owner-name').textContent(),'@a_very_long_tiktok_username');
        const geometry=await page.evaluate(()=>{const p=document.querySelector('.portrait-window').getBoundingClientRect(),a=document.querySelector('.art').getBoundingClientRect(),name=document.querySelector('.owner-name');return {photoWidth:p.width,artWidth:a.width,within:p.x>=a.x&&p.right<=a.right&&p.top>=a.top&&p.bottom<=a.bottom,nameFits:name.scrollWidth<=name.clientWidth+1,transparent:getComputedStyle(document.body).backgroundColor==='rgba(0, 0, 0, 0)'};});
        assert.ok(geometry.within&&geometry.nameFits&&geometry.transparent,JSON.stringify(geometry));checks.push({kind,frame:frame.id,...geometry});
        if(kind==='raconking')await page.screenshot({path:path.join(output,frame.id+'.png'),omitBackground:true});
    }
    await page.setViewportSize({width:360,height:740});await page.reload();await page.waitForFunction(()=>document.querySelector('.avatar-photo')?.naturalWidth===1080);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'mobile.png'),omitBackground:true});
    await page.setViewportSize({width:900,height:600});kind='myactions';
    for(const frame of frames){style=frame.id;await page.goto(base+'/widget-overlay.html?type=myactions');await page.evaluate(()=>localStorage.clear());await page.reload();await page.locator('.notification-frame').waitFor({timeout:6000}).catch(async error=>{console.error(JSON.stringify({errors,diagnostic:await page.evaluate(()=>({type,slot,config,queue,current,frames:frameCatalog.length,content:content.innerHTML}))}));throw error;});await page.waitForFunction(()=>[...document.querySelectorAll('.notification-frame img')].every(image=>image.complete&&image.naturalWidth>0));assert.equal(await page.locator('.alert-frame-art').isVisible(),false);assert.equal(await page.locator('.notification-photo .portrait').evaluate(image=>image.naturalWidth),1080);await page.screenshot({path:path.join(output,'notification-'+frame.id+'.png'),omitBackground:true});}
    assert.deepEqual(errors,[]);const result={passed:true,variants:checks.length,notificationFrames:6,checks,errors};fs.writeFileSync(path.join(output,'widget-refresh.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
