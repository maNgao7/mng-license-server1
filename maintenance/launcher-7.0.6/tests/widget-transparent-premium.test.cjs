'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {definitions}=require('../lib/widget-studio.cjs');
const root=path.resolve(__dirname,'../renderer'),output='D:/TikMnG-Widget-Transparent-20261027';
test('production widget pages keep alpha, readable totals, independently flapping wings and isolated tier previews',{timeout:90000},async t=>{
    let state={activities:[],studio:{settings:{}}};const errors=[],missing=[];
    const prefix='/overlays/'+'T'.repeat(43);
    const server=http.createServer((req,res)=>{
        const url=new URL(req.url,'http://qa'),local=url.pathname.startsWith(prefix)?url.pathname.slice(prefix.length):url.pathname;
        if(local==='/api/widget/state'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(state));return;}
        const relative=local==='/frame'?'widgets/reference-widgets.html':local==='/legacy'?'widgets/overlay.html':local==='/harness'?null:local==='/widget/vendor/matter.js'?'widgets/vendor/matter.js':local.replace(/^\/widget\/gift-assets\//,'gift-assets/').replace(/^\//,'');
        if(local==='/harness'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><iframe style="width:900px;height:600px;border:0" id="preview"></iframe>');return;}
        const file=path.resolve(root,relative||'');
        if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){missing.push(local);res.writeHead(404);res.end();return;}
        res.setHeader('Content-Type',file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':file.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');res.end(fs.readFileSync(file));
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+server.address().port;
    const browser=await chromium.launch({channel:'chrome',headless:true});
    t.after(async()=>{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
    fs.mkdirSync(output,{recursive:true});const page=await browser.newPage({viewport:{width:900,height:600}});
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    for(const id of [...definitions.map(d=>d.id),'timer','viewercount','carousel']){
        state={activities:[],studio:{settings:{[id]:{background:'black'}}}};
        await page.goto(origin+(definitions.some(d=>d.id===id)?prefix+'/frame':'/legacy')+'?type='+id+'&background=black');
        await page.waitForTimeout(40);
        assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)',id+' old black link');
        const screenshot=await page.screenshot({omitBackground:true});
        const corners=await page.evaluate(async data=>{const i=new Image();i.src='data:image/png;base64,'+data;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);return [[0,0],[c.width-1,0],[0,c.height-1],[c.width-1,c.height-1]].map(([a,b])=>x.getImageData(a,b,1,1).data[3]);},screenshot.toString('base64'));
        assert.deepEqual(corners,[0,0,0,0],id+' alpha corners');
    }
    const gift={username:'deniz',nickname:'Deniz',coins:1,count:1,giftId:'5655',giftImage:'/widget/gift-assets/5655.png',createdAt:Date.now()};
    for(const [coins,tier]of [[1,0],[100,1],[500,2],[1000,3],[5000,4],[10000,5]]){
        state={topGift:{...gift,coins},studio:{settings:{}}};
        await page.goto(origin+prefix+'/frame?type=topgift');
        await page.waitForFunction(()=>document.querySelectorAll('.champion-frame').length===3&&[...document.querySelectorAll('.champion-frame')].every(i=>i.naturalWidth>0));
        assert.equal(await page.locator('.champion').getAttribute('data-tier'),String(tier));
        const transform=await page.locator('.wing-left').evaluate(el=>getComputedStyle(el).transform);await page.waitForTimeout(400);
        assert.notEqual(await page.locator('.wing-left').evaluate(el=>getComputedStyle(el).transform),transform,'wing flaps tier '+tier);
        assert.equal(await page.locator('.wing-ring').evaluate(el=>getComputedStyle(el).transform),'none');
        const framePixels=await page.locator('.wing-ring').evaluate(img=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d');x.drawImage(img,0,0);const data=x.getImageData(0,0,c.width,c.height).data;let clear=0,paint=0;for(let n=3;n<data.length;n+=4){if(data[n]===0)clear++;else paint++;}return{clear,paint};});
        assert.ok(framePixels.clear>10000&&framePixels.paint>10000,'decoded RGBA wing art');
        await page.screenshot({path:path.join(output,'wing-'+coins+'.png'),omitBackground:true});
    }
    state={topGift:{...gift,coins:200},studio:{settings:{topgift:{wingTier1:5,wingTier2:20,wingTier3:100,wingTier4:500,wingTier5:1000}}}};
    await page.goto(origin+'/frame?type=topgift');await page.waitForSelector('.champion[data-tier="3"]');
    await page.evaluate(()=>postMessage({type:'tikmng-widget-wing-preview',tier:5},location.origin));
    assert.equal(await page.locator('.champion').getAttribute('data-tier'),'3','public cannot switch tier with preview message');
    await page.goto(origin+'/harness');
    await page.locator('#preview').evaluate((el,src)=>el.src=src,origin+'/frame?type=topgift&preview=1');
    const frame=page.frameLocator('#preview');await frame.locator('.champion').waitFor();
    for(let tier=0;tier<6;tier++){
        await page.evaluate(tier=>document.querySelector('iframe').contentWindow.postMessage({type:'tikmng-widget-wing-preview',tier},location.origin),tier);
        await frame.locator('.champion[data-tier="'+tier+'"]').waitFor();
    }
    for(const id of ['topgifter','topliker'])for(const viewport of [{width:900,height:600},{width:460,height:360},{width:360,height:300}]){
        const rows=Array.from({length:9},(_,i)=>({username:'viewer-'+i,nickname:i===3?'Cok uzun kullanici adi ornegi':'Izleyici '+(i+1),totalCoins:12345678-i*100000,totalLikes:98765432-i*10000}));
        state={topGifters:rows,topLikes:rows,studio:{settings:{}}};await page.setViewportSize(viewport);await page.goto(origin+'/frame?type='+id);
        await page.waitForSelector('.rank-amount');
        const checks=await page.locator('.rank-copy,.podium-place').evaluateAll(nodes=>nodes.map(node=>{const value=node.querySelector('.rank-amount'),name=node.querySelector('b'),r=value.getBoundingClientRect(),n=name.getBoundingClientRect();return{inside:r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,visible:getComputedStyle(value).color!=='rgba(0, 0, 0, 0)',font:parseFloat(getComputedStyle(value).fontSize),gap:r.left-n.right};}));
        assert.ok(checks.every(c=>c.inside&&c.visible&&c.font>=24),'readable totals '+id+' '+viewport.width);
        assert.ok(await page.locator('.rank-unit').first().textContent()=== (id==='topliker'?'beğeni':'coin'));
        await page.screenshot({path:path.join(output,id+'-'+viewport.width+'.png'),omitBackground:true});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(missing.filter(p=>p!=='/favicon.ico'),[]);
    t.diagnostic('17 alpha sources, 6 flapping tiers, exact thresholds, preview isolation and 6 readable ranking layouts. '+output);
});
