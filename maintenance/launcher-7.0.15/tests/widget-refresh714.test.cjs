'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {normalize,schema,createStudio}=require('../lib/widget-studio.cjs');
const {start}=require('../tools/preview-widgets714.cjs');
const out=path.resolve(__dirname,'../qa/714');

test('simplified Viral settings keep private thresholds, and jar defaults migrate without losing custom values',()=>{
    assert.equal(schema('topgift').filter(f=>/frameTheme|wingTier/.test(f.key)).length,0);
    assert.ok(schema('topgift').some(f=>f.key==='entranceSound'));
    assert.equal(normalize('coinjar').capacity,200);
    const values=new Map([['widget_studio_v1__one',{designVersion:3,settings:{coinjar:{capacity:140,giftSize:31,sound:false},topgift:{wingTier1:10,wingTier2:50,wingTier3:200,wingTier4:800,wingTier5:2000,frameTheme3:'flame'}}}],['widget_studio_v1__two',{designVersion:3,settings:{coinjar:{capacity:175}}}]]);
    const studio=createStudio({get:(key,fallback)=>structuredClone(values.get(key)??fallback),set:(key,value)=>values.set(key,structuredClone(value))},()=> '');
    assert.equal(studio.settings('one','coinjar').capacity,200);
    assert.equal(studio.settings('one','coinjar').giftSize,31);
    assert.equal(studio.settings('one','coinjar').sound,false);
    assert.equal(studio.settings('two','coinjar').capacity,175);
    studio.save('one','coinjar',{capacity:140});assert.equal(studio.settings('one','coinjar').capacity,140);
    studio.save('one','topgift',{entranceSound:'gift-arrive'});
    assert.equal(studio.settings('one','topgift').wingTier3,200);
    assert.equal(studio.settings('one','topgift').entranceSound,'gift-arrive');
    assert.equal(studio.settings('one','topgift').frameTheme3,undefined);
    assert.equal(normalize('topgift',{entranceSound:'invalid'}).entranceSound,'shimmer');
});

test('actual widget renderer phases, compact stable ranks, centered portraits, jar sizing and new concept alpha',{timeout:90000},async t=>{
    fs.mkdirSync(out,{recursive:true});const host=await start(),errors=[],missing=[];
    const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
    t.after(async()=>{await browser.close();await host.close();});
    const page=await browser.newPage({viewport:{width:900,height:600}});
    page.on('pageerror',error=>errors.push(error.message));page.on('response',res=>{if(res.status()>=400&&!res.url().endsWith('/favicon.ico'))missing.push(res.url());});
    page.on('console',message=>{if(message.type()==='error'&&/shader|WebGLProgram|VALIDATE_STATUS/i.test(message.text()))errors.push(message.text());});
    await page.route('**/*',route=>route.request().url().startsWith(host.origin)?route.continue():route.abort());
    const event={id:'firework-714',username:'deniz',nickname:'Deniz',type:'gift',giftId:'5655',giftImage:'/widget/gift-assets/5655.png',avatar:'/widget/gift-assets/royal-demo.png',giftName:'Gül',count:1,coins:1,createdAt:Date.now()};
    await page.goto(host.origin+'/widget?type=firework');await page.waitForFunction(()=>window.__widgetDiagnostics);
    await page.evaluate(event=>{clearTimeout(pollTimer);visible=false;clearScene();config.sound=false;current={event,start:0,until:5000};fireworkFrame(500);},event);
    assert.equal(await page.locator('.firework-sender').count(),0,'launch has no label');
    await page.evaluate(()=>{ctx.clearRect(0,0,900,600);fireworkFrame(2000);});
    assert.equal(await page.locator('.firework-sender').count(),0,'burst has no label or avatar');
    await page.screenshot({path:path.join(out,'firework-burst.png'),omitBackground:true});
    await page.evaluate(()=>{ctx.clearRect(0,0,900,600);fireworkFrame(3700);});
    assert.equal(await page.locator('.firework-sender').textContent(),'Deniz');
    assert.equal(await page.locator('.firework-sender img,.firework-sender small,.portrait').count(),0);
    assert.equal(await page.locator('.firework-sender').evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)');
    await page.screenshot({path:path.join(out,'firework-name.png'),omitBackground:true});
    await page.evaluate(()=>nextEvent(5100));assert.equal(await page.locator('.firework-sender').count(),0);
    for(const type of ['topgifter','topliker']){
        const rows=Array.from({length:9},(_,i)=>({username:'viewer'+i,nickname:i===3?'Çok Uzun Kullanıcı Adı':'İzleyici '+i,avatar:'',totalCoins:20000-i*100,totalLikes:10000-i*100}));
        const state={topGifters:rows.map(r=>({...r})),topLikes:rows.map(r=>({...r})),studio:{settings:{[type]:normalize(type)}}};host.setState(type,state);
        await page.goto(host.origin+'/widget?type='+type);await page.locator('.podium').waitFor();
        assert.equal(await page.locator('.rank-unit').count(),0);
        const geometry=await page.locator('.rank-list').evaluate(n=>({width:n.getBoundingClientRect().width,portraitGap:(()=>{const p=[...n.querySelectorAll('.podium-place .portrait')].map(x=>x.getBoundingClientRect()).sort((a,b)=>a.x-b.x);return p[1].left-p[0].right;})()}));
        assert.ok(geometry.width<=400&&geometry.portraitGap>=0&&geometry.portraitGap<=12,JSON.stringify(geometry));
        await page.evaluate(()=>{window.__rank=document.querySelector('.rank-list');window.__portrait=document.querySelector('.portrait');});
        state[type==='topliker'?'topLikes':'topGifters'][0][type==='topliker'?'totalLikes':'totalCoins']+=1;
        await page.waitForFunction(expected=>document.querySelector('.rank-amount').textContent===expected,(type==='topliker'?10001:20001).toLocaleString('tr-TR'));
        assert.equal(await page.evaluate(()=>__rank===document.querySelector('.rank-list')&&__portrait===document.querySelector('.portrait')),true);
        for(const viewport of [{width:900,height:600},{width:390,height:360}]){
            await page.setViewportSize(viewport);
            await page.waitForFunction(()=>document.querySelector('#stage').getBoundingClientRect().right<=innerWidth+1);
            const bounds=await page.locator('.rank-amount').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent,left:r.left,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight};}));
            assert.ok(bounds.every(r=>r.left>=0&&r.right<=r.width&&r.bottom<=r.height),JSON.stringify(bounds));
            await page.screenshot({path:path.join(out,type+'-'+viewport.width+'.png'),omitBackground:true});
        }
        await page.setViewportSize({width:900,height:600});
    }
    for(const type of ['raconking','streambeauty','streamhandsome']){
        await page.goto(host.origin+'/widget?type='+type+'&preview=1');await page.locator('.portrait-window:not([hidden])').waitFor();
        const geometry=await page.locator('.portrait-window').evaluate(n=>{const r=n.getBoundingClientRect(),w=document.querySelector('.widget').getBoundingClientRect();return {width:r.width,height:r.height,center:(r.x+r.width/2-w.x)/w.width};});
        assert.ok(Math.abs(geometry.width-geometry.height)<1,'round portrait '+type);
        assert.ok(Math.abs(geometry.center-.5)<.025,JSON.stringify(geometry));
        await page.waitForTimeout(850);
        await page.screenshot({path:path.join(out,type+'.png'),omitBackground:true});
    }
    await page.goto(host.origin+'/widget?type=coinjar');await page.waitForFunction(()=>window.__widgetDiagnostics&&physics);
    const sizes=await page.evaluate(()=>[1,5,10,50,1000].map(unitCoins=>jarGiftSize({unitCoins,coins:unitCoins,count:1})));
    assert.deepEqual(sizes,[25,26,27,35,64]);
    assert.equal(await page.evaluate(()=>jarGiftSize({unitCoins:1,coins:501,count:501})),25);
    assert.equal(await page.evaluate(()=>jarGiftSize({coins:501,count:501})),25);
    const jar=await page.evaluate(()=>{visible=false;clearScene();for(let i=0;i<201;i++){drop({id:'jar-'+i,type:'gift',unitCoins:1,coins:1,count:1,createdAt:Date.now()});spawnJarGift(10000+i*100);}return {capacity:config.capacity,total:physicsEntries.size,overflow:[...physicsEntries.values()].filter(e=>e.overflow).length,firstSize:[...physicsEntries.values()][0].visualRadius*2};});
    assert.deepEqual(jar,{capacity:200,total:201,overflow:1,firstSize:25});
    await page.goto(host.origin+'/');await page.locator('.frame-art').last().waitFor();
    await page.waitForFunction(()=>[...document.querySelectorAll('.frame-art')].every(img=>img.complete&&img.naturalWidth>0));
    const alpha=await page.locator('.frame-art').evaluateAll(nodes=>nodes.map(img=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,32,32);return {center:ctx.getImageData(16,16,1,1).data[3],corner:ctx.getImageData(0,0,1,1).data[3]};}));
    assert.ok(alpha.every(a=>a.center===0&&a.corner===0),JSON.stringify(alpha));
    await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>scrollTo(0,0));
    await page.waitForFunction(()=>window.__prototypeAnimations?.snapshot().every(s=>s.frames>6));
    const circles=await page.locator('.prototype .profile').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect(),p=n.parentElement.getBoundingClientRect();return {width:r.width,height:r.height,ratio:r.width/p.width,center:(r.left+r.width/2-p.left)/p.width};}));
    for(const circle of circles){assert.ok(Math.abs(circle.width-circle.height)<1,JSON.stringify(circles));assert.ok(circle.ratio>=.61,JSON.stringify(circles));assert.ok(Math.abs(circle.center-.5)<.005,JSON.stringify(circles));}
    await page.locator('#motion').uncheck();
    const paused=await page.evaluate(()=>__prototypeAnimations.snapshot().map(s=>s.frames));
    await page.waitForTimeout(150);assert.deepEqual(await page.evaluate(()=>__prototypeAnimations.snapshot().map(s=>s.frames)),paused);
    const paint=async time=>page.evaluate(time=>{
        __prototypeAnimations.drawAt(time);
        if(__prototypeAnimations.version===2)return __prototypeAnimations.pixelStats();
        return [...document.querySelectorAll('.prototype')].map(node=>{
            let hash=0,painted=0,center=0;
            for(const canvas of node.querySelectorAll('canvas')){
                const ctx=canvas.getContext('2d'),bytes=ctx.getImageData(0,0,canvas.width,canvas.height).data;
                center+=ctx.getImageData(300,300,1,1).data[3];
                for(let i=0;i<bytes.length;i+=16){hash=(Math.imul(hash,31)+bytes[i]+bytes[i+3])>>>0;if(bytes[i+3])painted++;}
            }
            return {kind:node.dataset.frame,hash,painted,center};
        });
    },time);
    const phaseA=await paint(1),phaseB=await paint(2.3);
    for(let i=0;i<3;i++){assert.ok(phaseA[i].painted>50,JSON.stringify(phaseA));assert.notEqual(phaseA[i].hash,phaseB[i].hash,'actual moving pieces '+phaseA[i].kind);assert.equal(phaseA[i].center,0,'portrait stays clear');}
    await page.emulateMedia({reducedMotion:'reduce'});
    const still=await page.evaluate(()=>__prototypeAnimations.snapshot().map(s=>s.frames));
    await page.waitForTimeout(150);assert.deepEqual(await page.evaluate(()=>__prototypeAnimations.snapshot().map(s=>s.frames)),still);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.locator('#motion').check();await page.waitForTimeout(300);
    const originalProfiles=await page.locator('.prototype .profile').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));
    await page.locator('#portrait-file').setInputFiles(path.resolve(__dirname,'../renderer/widgets/royal-assets/royal-demo.png'));
    await page.waitForFunction(()=>[...document.querySelectorAll('.prototype .profile img')].every(img=>img.complete&&img.naturalWidth>0));
    const imageFit=await page.locator('.prototype .profile').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect(),i=n.querySelector('img').getBoundingClientRect();return {width:r.width,height:r.height,imageWidth:i.width,imageHeight:i.height,fit:getComputedStyle(n.querySelector('img')).objectFit};}));
    for(let i=0;i<imageFit.length;i++){assert.ok(Math.abs(imageFit[i].width-imageFit[i].height)<1,JSON.stringify(imageFit));assert.ok(Math.abs(imageFit[i].width-originalProfiles[i])<1);assert.ok(Math.abs(imageFit[i].imageWidth-imageFit[i].imageHeight)<1);assert.equal(imageFit[i].fit,'cover');}
    await page.evaluate(()=>{for(const n of document.querySelectorAll('.prototype .profile'))n.innerHTML='<i data-lucide="user-round"></i>';lucide.createIcons();});
    await page.screenshot({path:path.join(out,'gallery-desktop.png'),fullPage:true});
    await page.locator('.concepts').screenshot({path:path.join(out,'frames-v2-desktop.png')});
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:path.join(out,'gallery-mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,fireworkPhases:true,stableRanks:true,centeredRoundPortraits:true,jarSizes:sizes,jar,transparentConcepts:alpha,animatedConcepts:phaseA,pauseWorks:true,errors,missing},null,2));
});
