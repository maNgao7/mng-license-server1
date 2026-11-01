'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { definitions, createStudio } = require('../lib/widget-studio.cjs');
const root = path.resolve(__dirname, '../renderer'), output = 'D:/TikMnG-Widget-Preview12-20261026/qa';
const prefix = '/overlays/' + 'R'.repeat(43), key = 'a'.repeat(32), db = new Map();
const studio = createStudio({ get:(k,d)=>structuredClone(db.get(k)??d), set:(k,v)=>db.set(k,structuredClone(v)) },(_n,id)=>`http://127.0.0.1:31976/widget/gift-assets/${id}.png?key=${key}`);
let data = {}, browser, origin, fail = false;
const metrics=[];
const errors = [], missing = [], requests = [], checks = [];
const server = http.createServer((req,res)=>{
    const url = new URL(req.url,'http://qa'), local = url.pathname.startsWith(prefix)?url.pathname.slice(prefix.length):url.pathname;
    requests.push({path:url.pathname,key:url.searchParams.get('key')});res.setHeader('Cache-Control','no-store');
    if(local==='/api/widget/state'){res.writeHead(fail?503:200,{'Content-Type':'application/json'});res.end(JSON.stringify({...data,studio:studio.state('qa')}));return;}
    const file = ['/widget-overlay.html','/widget-leaderboard.html'].includes(local)?path.join(root,'widgets/reference-widgets.html'):local.startsWith('/widget/gift-assets/')?path.join(root,'gift-assets',path.basename(local)):local==='/widget/vendor/matter.js'?path.join(root,'widgets/vendor/matter.js'):local==='/assets/widgets/glass-gift-jar.png'?path.join(root,local):null;
    if(!file||!fs.existsSync(file)){if(local!=='/favicon.ico')missing.push(local);res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':file.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');res.end(fs.readFileSync(file));
});
const asset = id => `http://127.0.0.1:31976/widget/gift-assets/${id}.png?key=${key}`;
const people = ['Deniz','Elif','Mert','Zeynep','Arda','Selin','Nehir','Atlas','Yildiz'].map((name,i)=>({username:name.toLowerCase(),nickname:name,avatar:asset(5655),totalCoins:1500-i*110,totalLikes:3200-i*250}));
const gift = i => ({...people[i%people.length],id:`gift-${i}-${Date.now()}`,type:'gift',giftName:['Gul','TikTok','Dondurma'][i%3],giftId:String([5655,5269,5827][i%3]),giftImage:asset([5655,5269,5827][i%3]),coins:i+3,count:1,createdAt:Date.now()});
function fixture(){return{channel:'qa',activities:Array.from({length:5},(_,i)=>gift(i)),topGifters:people,topLikes:people,ranking:people,jarGifts:Array.from({length:50},(_,i)=>gift(i)),stats:{totalCoins:489,totalLikes:30000}};}
async function run(){
    fs.mkdirSync(output,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});const page=await browser.newPage({viewport:{width:900,height:600}});
    page.on('pageerror',error=>errors.push(error.message));
    const url=(id,extra='')=>`${origin}${prefix}/widget-overlay.html?type=${id}&channel=qa&studio=1${extra}`;
    for(const {id}of definitions){
        data=fixture();await page.goto(url(id,'&preview=1'));await page.waitForFunction(()=>window.__widgetDiagnostics?.frameCount>5);
        await page.waitForTimeout(['coinjar','giftpusher'].includes(id)?8500:id==='firework'?1700:1000);
        if(id==='coinjar')assert.ok(await page.evaluate(()=>window.__widgetDiagnostics.inJarBodies)>40,'Gifts enter and remain inside the jar rather than being ejected before entry');
        assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),id==='coinjar'?'rgba(0, 0, 0, 0)':'rgb(0, 0, 0)',id+' background');
        const before=await page.evaluate(()=>window.__widgetDiagnostics.frameCount);await page.waitForTimeout(350);assert.ok(await page.evaluate(()=>window.__widgetDiagnostics.frameCount)>before,id+' active animation loop');
        const painted=await page.evaluate(()=>{const c=document.getElementById('scene');return [...c.getContext('2d').getImageData(0,0,900,600).data].filter((n,i)=>i%4===3&&n>0).length;});
        assert.ok(painted>0||await page.locator('#content>*').count()>0,id+' nonblank');
        await page.screenshot({path:path.join(output,id+'.png'),omitBackground:true});
        await page.setViewportSize({width:375,height:667});await page.screenshot({path:path.join(output,id+'-mobile.png'),omitBackground:true});await page.setViewportSize({width:900,height:600});
        if(['topgifter','topliker'].includes(id)){
            const places=await page.locator('.podium-place').evaluateAll(nodes=>nodes.map(node=>{const p=node.querySelector('.portrait').getBoundingClientRect();return {place:node.dataset.place,x:p.x,w:p.width};}));
            assert.equal(places.length,3);assert.ok(places[1].x<places[0].x&&places[2].x>places[0].x&&places[0].w>places[1].w*1.4,'Large #1 center, #2 left, #3 right');
            const centers=places.map(p=>p.x+p.w/2);assert.ok(centers[0]-centers[1]<160&&centers[2]-centers[0]<160,'Podium profiles stay close together');
            assert.equal(await page.locator('.rank-row .rank-num').first().textContent(),'4');
            const gaps=await page.locator('.rank-copy').evaluateAll(nodes=>nodes.map(node=>node.querySelector('small').getBoundingClientRect().left-node.querySelector('b').getBoundingClientRect().right));assert.ok(gaps.every(gap=>gap>=16&&gap<=20),'Name and value stay close');
        }
        if(id==='topgift')assert.equal(await page.locator('.champion-frame').first().evaluate(img=>img.complete&&img.naturalWidth>0),true,'Original wing frame renders');
        metrics.push(await page.evaluate(()=>window.__widgetDiagnostics));
        checks.push(id+': desktop/mobile, '+(id==='coinjar'?'transparent':'black')+', nonblank, running');
    }
    const frames=[];
    for(const [coins,tier]of [[1,0],[99,0],[100,1],[499,1],[500,2],[999,2],[1000,3],[4999,3],[5000,4],[9999,4],[10000,5],[25000,5]]){
        data={...fixture(),topGift:{...gift(200),coins,updatedAt:Date.now()}};await page.goto(url('topgift'));await page.waitForFunction(()=>document.querySelector('.champion'));
        assert.equal(await page.locator('.champion').getAttribute('data-tier'),String(tier));
        {await page.waitForFunction(()=>document.querySelectorAll('.champion-frame').length===3&&[...document.querySelectorAll('.champion-frame')].every(img=>img.complete&&img.naturalWidth>0));
            const transforms=await page.locator('.wing-left').evaluate(node=>getComputedStyle(node).transform);await page.waitForTimeout(300);assert.notEqual(await page.locator('.wing-left').evaluate(node=>getComputedStyle(node).transform),transforms,'Wings flap');
            assert.equal(await page.locator('.wing-ring').evaluate(node=>getComputedStyle(node).transform),'none','Center ring stays still');
            const name=await page.locator('.champion-name').boundingBox();assert.ok(name.y>400&&name.y+name.height<600,'Name remains inside scene');
            if(coins===[100,500,1000,5000,10000][tier-1]){frames.push(await page.locator('.wing-ring').getAttribute('src'));await page.screenshot({path:path.join(output,`champion-${coins}.png`)});}
        }
    }
    assert.equal(new Set(frames).size,5,'Every wing tier has distinct artwork');checks.push('All champion coin boundaries, distinct frames, independent wing motion and stationary profile ring');
    studio.save('qa','actionwheel',{giftId:'5655',duration:2});data={activities:[]};await page.goto(url('actionwheel'));
    await page.waitForFunction(()=>window.__widgetDiagnostics?.config.giftId==='5655');
    const ignored={...gift(420),giftId:'5269'};data.activities=[ignored];
    await page.waitForFunction(()=>window.__widgetDiagnostics.seen===1);assert.equal(await page.evaluate(()=>window.__widgetDiagnostics.current),null,'Wrong gift cannot spin the selected-gift wheel');
    const chosen={...gift(421),giftId:'5655'};data.activities=[chosen,ignored];
    await page.waitForFunction(id=>window.__widgetDiagnostics.current===id,chosen.id);
    studio.save('qa','actionwheel',{giftId:'',duration:2});data={activities:[]};await page.reload();
    await page.waitForFunction(()=>window.__widgetDiagnostics?.config.giftId==='');
    const any={...gift(422),giftId:'5269'};data.activities=[any];await page.waitForFunction(id=>window.__widgetDiagnostics.current===id,any.id);
    checks.push('Selected gift ID triggers wheel, other IDs are rejected; all-gift mode accepts another gift');
    data=fixture();await page.goto(url('firework'));await page.waitForFunction(()=>window.__widgetDiagnostics?.frameCount>5);data.activities=[gift(410)];await page.waitForFunction(()=>document.querySelector('.firework-sender img.portrait')?.naturalWidth>0);checks.push('Firework renders decoded sender portrait alongside name and gift');
    // Production links start empty, and preview/demo activity never enters them.
    data={activities:[],topGifters:[],topLikes:[],jarGifts:[],stats:{totalCoins:0}};
    for(const id of ['coinjar','streambuddies','topgift','gifts']){
        await page.goto(url(id));await page.waitForFunction(()=>window.__widgetDiagnostics?.frameCount>5);
        assert.equal(await page.evaluate(()=>window.__widgetDiagnostics.bodies),0);assert.equal(await page.evaluate(()=>window.__widgetDiagnostics.seen),0);
        assert.equal(await page.locator('.champion,.feed-row,.buddy-name').count(),0,id+' no demo entries');
    }
    checks.push('Empty public jar, buddies, champion and feed contain no demo users or gifts');
    data={activities:[],topGifters:[],topLikes:[],jarGifts:[]};await page.goto(url('giftpusher'));await page.waitForFunction(()=>window.__widgetDiagnostics?.frameCount>5);data.activities=[gift(40)];
    await page.waitForFunction(()=>window.__widgetDiagnostics.launchCount>0);assert.ok(await page.evaluate(()=>window.__widgetDiagnostics.bodies)>0);checks.push('Real event launches central physics ball and adds gift tokens');
    for(const id of ['myactions','penalty','wheel','coindrop','coinjar']){
        data={activities:[],topGifters:[],topLikes:[],jarGifts:[]};await page.goto(url(id,'&duration=2'));await page.waitForFunction(()=>window.__widgetDiagnostics?.frameCount>5);
        const event=gift(90);event.penaltyGoal=true;data.activities=[event];
        await page.waitForFunction(()=>window.__widgetDiagnostics.soundCount>0);assert.equal(await page.evaluate(()=>window.__widgetDiagnostics.audioState),'running');
        if(id==='penalty'){await page.waitForFunction(()=>document.querySelector('.goal-copy')?.textContent==='GOAAAL!');await page.waitForFunction(()=>window.__widgetDiagnostics.soundCount>=2);}
    }
    checks.push('Alerts, wheel ticks, penalty kick/goal, coin rain and jar create running audio graphs');
    for(const [eventType,expected]of [['follow','follow'],['subscribe','subscribe'],['gift','gift-alert']]){
        data={activities:[]};await page.goto(url('myactions'));await page.waitForFunction(()=>window.__widgetDiagnostics?.frameCount>5);
        data.activities=[{...gift(95),type:eventType}];await page.waitForFunction(name=>window.__widgetDiagnostics.lastSoundName===name,expected);
        await page.screenshot({path:path.join(output,`alert-${eventType}.png`)});
    }
    checks.push('Follow, subscription and gift events each select their own matching audible notification');
    // Live event queues process distinct events once, never repeat on a heartbeat.
    data={activities:[],topGifters:[],topLikes:[]};await page.goto(url('myactions','&duration=2'));
    await page.waitForFunction(()=>window.__widgetDiagnostics?.frameCount>5);
    const events=[0,1,2].map(i=>({...gift(i),type:['follow','gift','subscribe'][i]}));data.activities=events.slice().reverse();
    await page.waitForFunction(()=>window.__widgetDiagnostics.seen===3);assert.equal(await page.evaluate(()=>window.__widgetDiagnostics.queue),2);
    const active=await page.evaluate(()=>window.__widgetDiagnostics.current);await page.waitForTimeout(850);assert.equal(await page.evaluate(()=>window.__widgetDiagnostics.current),active);
    await page.waitForTimeout(6500);assert.equal(await page.evaluate(()=>window.__widgetDiagnostics.current),null);assert.equal(await page.locator('#content>*').count(),0);
    checks.push('Three alerts queued, deduplicated and clear after playback');
    studio.save('qa','myactions',{screen:'2',event:'follow',duration:3},'2');data.activities=[];await page.goto(url('myactions','&screen=2'));
    await page.waitForFunction(()=>window.__widgetDiagnostics?.config.event==='follow');studio.save('qa','myactions',{screen:'2',event:'gift',duration:7},'2');await page.waitForFunction(()=>window.__widgetDiagnostics?.config.duration===7);
    await page.reload();await page.waitForFunction(()=>window.__widgetDiagnostics?.config.duration===7);checks.push('Saved configuration updates same URL and survives reload; screen isolation');
    data.activities=[];await page.goto(url('firework'));await page.waitForFunction(()=>window.__widgetDiagnostics?.frameCount>5);studio.test('qa','firework');await page.waitForFunction(()=>window.__widgetDiagnostics.seen>0);assert.equal(data.activities.length,0);checks.push('Public-shaped individual test runs without altering LIVE events');
    fail=true;await page.waitForFunction(()=>window.__widgetDiagnostics.failures>0);fail=false;await page.waitForFunction(()=>window.__widgetDiagnostics.failures===0);checks.push('Transient outage recovers automatically');
    data=fixture();studio.ingest('qa',gift(1));await page.goto(url('penalty','&mode=scores'));await page.waitForFunction(()=>document.querySelector('.rank-row'));assert.match(await page.locator('#content').textContent(),/gol/);checks.push('Separate penalty leaderboard URL renders persistent score');
    assert.deepEqual(errors,[],'No browser errors');assert.deepEqual(missing,[],'Every asset resolves');assert.ok(requests.filter(r=>r.path.includes('/widget/')).every(r=>r.path.startsWith(prefix)&&!r.key),'Public requests retain relay prefix, omit local access key');
    const sheet=await browser.newPage({viewport:{width:1260,height:1000}});
    await sheet.setContent(`<style>body{margin:0;padding:20px;background:#121719;color:#ecf1f2;font:15px Arial}.grid{display:grid;grid-template-columns:repeat(3,400px);gap:12px}.tile{background:#1c2427;border:1px solid #354247}.tile img{width:400px;height:267px;object-fit:contain}.tile b{display:block;padding:10px}</style><h1>TikMnG Reference Widgets</h1><div class="grid">${definitions.map(({id,name})=>`<section class="tile"><img src="data:image/png;base64,${fs.readFileSync(path.join(output,id+'.png')).toString('base64')}"><b>${name}</b></section>`).join('')}</div>`);
    await sheet.screenshot({path:path.join(output,'contact-sheet.png'),fullPage:true});
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,checks,metrics,errors,missing,liveStudioAcceptance:false},null,2));console.log(JSON.stringify({passed:true,checks,output}));
}
run().catch(error=>{console.error(error);process.exitCode=1;fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:error.stack,errors,missing},null,2));}).finally(async()=>{await browser?.close();server.closeAllConnections();server.close();});
