'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../renderer'),output='D:/TikMnG-Widget-Preview12-20261026/targeted-qa';
async function fixture(t){
    let state={activities:[],studio:{settings:{}}};const errors=[];
    const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://fixture'),local=url.pathname;
        if(local==='/api/widget/state'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(state));return;}
        const relative=local==='/widget-overlay.html'?'widgets/reference-widgets.html':local==='/widget/vendor/matter.js'?'widgets/vendor/matter.js':local.replace(/^\/widget\/gift-assets\//,'gift-assets/').replace(/^\//,'');
        const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
        res.setHeader('Content-Type',file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':file.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');res.end(fs.readFileSync(file));
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']}),page=await browser.newPage({viewport:{width:900,height:600}});
    page.on('pageerror',error=>errors.push(error.message));
    t.after(async()=>{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});fs.mkdirSync(output,{recursive:true});
    return {page,origin:`http://127.0.0.1:${server.address().port}`,setState:value=>{state=value;},errors};
}
test('jar keeps settled gifts through long runs and capacity bursts, without legacy labels',{timeout:90000},async t=>{
    const {page,origin,setState,errors}=await fixture(t);
    await page.goto(origin+'/widget-overlay.html?type=coinjar&preview=1&showAlert=true&showCount=true&showJarRanking=true');
    await page.waitForFunction(()=>physics&&physicsEntries.size>=70);await page.waitForFunction(()=>cachedImage(endpoint('/assets/widgets/glass-gift-jar.png'))?.naturalWidth>0);
    const simulate=seconds=>page.evaluate(seconds=>{let time=window.__simTime||performance.now();for(let i=0;i<seconds*60;i++){time+=1000/60;physicsFrame(time,1/60);}window.__simTime=time;ctx.clearRect(0,0,900,600);physicsFrame(time,0);return [...physicsEntries].map(([id,e])=>({id,entered:e.entered,settled:e.settled,overflow:e.overflow,landed:!!e.landedAt,x:e.body.position.x,y:e.body.position.y,r:e.visualRadius}));},seconds);
    const initial=await simulate(45),kept=initial.filter(e=>e.entered&&e.settled&&e.y<445&&e.x>340&&e.x<560);
    assert.ok(kept.length>=60,'Most seeded gifts settle visibly inside, above the glass base');assert.ok(kept.some(e=>e.y+e.r>438),'Gifts fill the bottom of the glass, without the old empty strip');
    await page.screenshot({path:path.join(output,'jar-settled.png')});
    await page.evaluate(()=>{for(let i=0;i<40;i++)drop({id:'burst-'+i,type:'gift',count:8,giftImage:giftURL(5655),createdAt:Date.now()});});
    const spilling=await simulate(14);assert.ok(spilling.some(e=>e.overflow&&e.y>150&&(e.x<335||e.x>565)),'Full jar spills visible gifts outside its sides');await page.screenshot({path:path.join(output,'jar-overflow.png'),omitBackground:true});
    const after=await simulate(90),remaining=new Map(after.map(e=>[e.id,e]));
    assert.ok(after.every(e=>!e.overflow),'Overflow cannot fall back into the jar and become trapped: '+JSON.stringify(after.filter(e=>e.overflow).slice(0,5)));
    assert.ok(kept.every(e=>remaining.get(e.id)?.settled),'Capacity eviction never removes the settled bottom layer');
    assert.ok(after.filter(e=>e.entered&&e.x>340&&e.x<560&&e.y<445).length>=kept.length,'Jar does not drain after repeated gifts');
    assert.ok(after.length<=204,'Contents plus temporary overflow remain bounded');assert.ok(await page.evaluate(()=>physics.overflowTotal>0&&physics.landedTotal>0),'Overflow reaches the ground before cleanup');assert.equal(await page.locator('#content>*').count(),0,'Jar has no sender, rank or coin labels even on legacy URLs');
    await page.screenshot({path:path.join(output,'jar-after-burst.png')});
    await page.evaluate(()=>drop({id:'latest-at-full-capacity',type:'gift',count:1,giftImage:giftURL(5269),createdAt:Date.now()}));
    const fresh=await simulate(2);assert.ok(fresh.some(e=>e.id==='latest-at-full-capacity:0'),'Newest gift remains visible while falling out of the full jar');
    assert.ok(kept.every(e=>fresh.some(row=>row.id===e.id)),'Refreshing top layer preserves the settled base');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)','Jar background is transparent');
    setState({activities:[],jarGifts:Array.from({length:70},(_,i)=>({id:`saved-${i}`,type:'gift',giftId:'5655',giftImage:'/widget/gift-assets/5655.png',count:1,coins:1,createdAt:Date.now()})),studio:{settings:{}}});
    await page.goto(origin+'/widget-overlay.html?type=coinjar');await page.waitForFunction(()=>physicsEntries.size===70);const restored=await simulate(45);
    assert.ok(restored.filter(e=>e.entered&&e.y<445).length>=60,'Saved real gift history restores contents on public-shaped link');assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'jar-result.json'),JSON.stringify({passed:true,settledBefore:kept.length,remainingAfterBurst:after.length,retainedOriginals:kept.length,latestGiftAtFullCapacity:true,restoredInside:restored.filter(e=>e.entered&&e.y<420).length,simulatedSeconds:200,noLabels:true,errors},null,2));
});
test('interaction portrait frame animates independently, fits desktop/mobile and respects reduced motion',{timeout:60000},async t=>{
    const {page,origin,setState,errors}=await fixture(t);
    for(const type of ['follow','subscribe','gift']){
        setState({activities:[{id:'event-'+type,type,username:'qa',nickname:'Deniz',avatar:'/widget/gift-assets/5655.png',giftName:'Gul',giftImage:'/widget/gift-assets/5655.png',coins:1,count:1,createdAt:Date.now()}],studio:{settings:{}}});
        await page.goto(origin+'/widget-overlay.html?type=myactions&duration=12');await page.waitForFunction(()=>document.querySelector('.alert-frame-art')?.naturalWidth>0);
        const before=await page.locator('.alert-frame-art').evaluate(node=>getComputedStyle(node).transform);await page.waitForTimeout(200);assert.notEqual(await page.locator('.alert-frame-art').evaluate(node=>getComputedStyle(node).transform),before);
        assert.equal(await page.locator('.alert-avatar>.portrait').evaluate(node=>getComputedStyle(node).transform),'none','Portrait remains stationary');
        for(const size of [{width:900,height:600},{width:375,height:667}]){await page.setViewportSize(size);const frame=await page.locator('.alert-avatar').boundingBox(),name=await page.locator('.alert h1').boundingBox();assert.ok(frame.y+frame.height<name.y,'Frame does not overlap name');assert.ok(frame.x>=0&&frame.x+frame.width<=size.width);await page.screenshot({path:path.join(output,`frame-${type}-${size.width}.png`)});}
        await page.setViewportSize({width:900,height:600});
    }
    await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.alert-frame-art').evaluate(node=>node.getAnimations().length),0);assert.equal(await page.locator('.alert-avatar').evaluate(node=>getComputedStyle(node,':after').animationName),'none');assert.deepEqual(errors,[]);
});

test('public alerts and champion audio do not replay on reload; fresh IDs still play',{timeout:60000},async t=>{
    const {page,origin,setState,errors}=await fixture(t);
    const event={id:'once-follow',type:'follow',username:'qa',nickname:'Deniz',count:1,createdAt:Date.now()};
    setState({activities:[event],studio:{session:{roomId:'123456'},settings:{}}});
    await page.goto(origin+'/widget-overlay.html?type=myactions&duration=2');await page.waitForSelector('.alert');
    assert.equal(await page.evaluate(()=>soundCount),1);
    await page.reload();await page.waitForFunction(()=>window.__widgetDiagnostics?.frameCount>5);
    assert.equal(await page.locator('.alert').count(),0);assert.equal(await page.evaluate(()=>soundCount),0);
    setState({activities:[{...event,id:'fresh-follow',createdAt:Date.now()}],studio:{session:{roomId:'123456'},settings:{}}});
    await page.waitForSelector('.alert');assert.equal(await page.evaluate(()=>soundCount),1);
    const champion={id:'champion-10',username:'qa',nickname:'Deniz',coins:10,giftId:'5655',count:1,createdAt:Date.now()};
    setState({topGift:champion,activities:[],studio:{session:{roomId:'123456'},settings:{}}});
    await page.goto(origin+'/widget-overlay.html?type=topgift');await page.waitForFunction(()=>document.querySelector('.wing-left')?.naturalWidth>0);
    assert.equal(await page.evaluate(()=>soundCount),1);await page.waitForTimeout(850);await page.screenshot({path:path.join(output,'champion-10.png')});
    await page.reload();await page.waitForFunction(()=>window.__widgetDiagnostics?.frameCount>5);assert.equal(await page.evaluate(()=>soundCount),0);assert.equal(await page.locator('.champion-frame').count(),3);
    assert.deepEqual(errors,[]);
});

test('public interaction alerts suppress sub-threshold likes and label Beni Sev separately from subscriptions',{timeout:60000},async t=>{
    const {page,origin,setState,errors}=await fixture(t);
    setState({activities:[],studio:{settings:{}}});await page.goto(origin+'/widget-overlay.html?type=myactions&duration=2');await page.waitForFunction(()=>window.__widgetDiagnostics?.frameCount>5);
    const base={username:'qa',nickname:'Deniz',createdAt:Date.now()};
    setState({activities:[{...base,id:'small-like',type:'like',count:15,likeAlerts:{}}],studio:{settings:{}}});
    await page.waitForFunction(()=>seen.has('small-like'));assert.equal(await page.locator('.alert').count(),0);
    setState({activities:[{...base,id:'like-100',type:'like',count:15,likeAlerts:{'1':100}}],studio:{settings:{}}});
    await page.waitForSelector('.alert');assert.match(await page.locator('.alert p').textContent(),/100/);
    await page.waitForSelector('.alert',{state:'detached'});
    setState({activities:[{...base,id:'beni-sev',type:'gift',giftId:'7934',coins:1,count:1}],studio:{settings:{}}});
    await page.waitForFunction(()=>document.querySelector('.alert-event')?.textContent==='BENİ SEV');assert.equal(await page.locator('.alert p').textContent(),'Beni Sev gönderdi!');
    await page.waitForTimeout(650);await page.screenshot({path:path.join(output,'beni-sev.png')});await page.waitForSelector('.alert',{state:'detached'});
    setState({activities:[{...base,id:'actual-sub',type:'subscribe',count:1}],studio:{settings:{}}});
    await page.waitForFunction(()=>document.querySelector('.alert-event')?.textContent==='YENİ ABONE');assert.equal(await page.locator('.alert p').textContent(),'Abone oldu!');assert.deepEqual(errors,[]);
});
