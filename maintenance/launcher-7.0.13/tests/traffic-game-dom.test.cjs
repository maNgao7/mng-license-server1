'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),crypto=require('node:crypto');
const html=fs.readFileSync(path.join(__dirname,'../renderer/widgets/game.html'),'utf8');
const prefix='/overlays/'+'G'.repeat(43),key='isolated game dom key';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const avatar=id=>'/widget/gift-assets/gameavatar-'+hash(String(id))+'.png';

// The original renderer is the control for no-store image traffic and identical screenshots.
const originalScript=String.raw`
const params=new URLSearchParams(location.search),prefix=location.pathname.match(/^\/overlays\/[A-Za-z0-9_-]{43}(?=\/)/)?.[0]||'';
const query=new URLSearchParams({type:'game',game:params.get('game')||'',mode:params.get('mode')||''});
if(!prefix&&params.get('key'))query.set('key',params.get('key'));
const root=document.querySelector('main'),list=document.querySelector('ol'),title=document.querySelector('h1');
let last='',busy=false;
async function poll(){
 if(busy)return;busy=true;
 try{
  const response=await fetch(prefix+'/api/widget/state?'+query,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Unavailable');
  const state=await response.json();
  root.hidden=!state.online||!state.entries?.length;
  const signature=JSON.stringify({entries:state.entries,label:state.label});
  if(signature!==last){
   title.textContent=state.label||'';list.replaceChildren();
   (state.entries||[]).slice(0,30).forEach((item,index)=>{
    const row=document.createElement('li'),rank=document.createElement('span'),face=document.createElement('span'),name=document.createElement('span'),value=document.createElement('strong');
    rank.className='rank';rank.textContent=String(index+1);face.className='face';face.textContent=String(item.name||'?').slice(0,1);name.className='name';name.textContent=item.name||'';
    if(/^\/widget\/gift-assets\/gameavatar-[a-f0-9]{64}\.png$/.test(item.avatar||'')){
     const image=document.createElement('img');image.alt='';image.src=prefix+item.avatar+(prefix?'':'?key='+encodeURIComponent(params.get('key')||''));image.onerror=()=>image.replaceWith(face);row.append(rank,image,name,value);
    }else row.append(rank,face,name,value);
    value.textContent=Number(item.value||0).toLocaleString('tr-TR')+(item.unit?' '+item.unit:'');list.append(row);
   });last=signature;
  }
 }catch{root.hidden=true;}finally{busy=false;}
}
poll();setInterval(poll,1000);
`;
const originalHTML=html.replace(/<script>[\s\S]*?<\/script>/,'<script>'+originalScript+'</script>');
function chromium(){
    const names=[process.env.PLAYWRIGHT_MODULE,'playwright',path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean);
    for(const name of names){try{return require(name).chromium;}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}}
    throw new Error('An installed Playwright module and Chrome are required for game DOM traffic QA');
}
function people(count=9){return Array.from({length:count},(_,id)=>({id:'person-'+id,name:'Player '+id,avatar:avatar(id),value:9000-id*500,unit:'kg'}));}
function snapshot(entries=people()){return {online:true,label:'Game Ranking',entries};}
async function fixture(t){
    const hits=[],requests=[],errors=[],external=[],portraits=new Map(),failures=new Map();let current=snapshot(),status=200,malformed=false;
    const server=http.createServer((req,res)=>{
        const url=new URL(req.url,'http://127.0.0.1'),local=url.pathname.startsWith(prefix+'/')?url.pathname.slice(prefix.length):url.pathname;
        res.setHeader('Cache-Control','no-store');
        if(local==='/api/widget/state'){
            requests.push(url);res.writeHead(status,{'Content-Type':'application/json'});res.end(malformed?'{broken':JSON.stringify(current));return;
        }
        if(local.startsWith('/widget/gift-assets/')){
            const remaining=failures.get(local)||0;if(remaining)failures.set(local,remaining-1);
            const body=remaining?null:portraits.get(local);hits.push({url,bytes:body?.length||0});
            res.writeHead(body?200:404,{'Content-Type':'image/png'});res.end(body);return;
        }
        if(local==='/game.html'||local==='/legacy.html'){
            res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(local==='/legacy.html'?originalHTML:html);return;
        }
        if(local==='/harness'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><body>');return;}
        res.writeHead(404);res.end();
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    let browser;
    t.after(async()=>{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
    const origin='http://127.0.0.1:'+server.address().port;
    browser=await chromium().launch({channel:process.env.WIDGET_QA_BROWSER_CHANNEL||'chrome',headless:true});
    const context=await browser.newContext({viewport:{width:900,height:700}});
    await context.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin===origin||['data:','about:'].includes(url.protocol))return route.continue();
        external.push(url.href);return route.abort();
    });
    // Manual ticks make the 100-update traffic comparison exact.
    await context.addInitScript(()=>{
        const interval=window.setInterval.bind(window);
        window.setInterval=(fn,ms,...args)=>ms===1000?0:interval(fn,ms,...args);
        const create=Document.prototype.createElement;window.qaImageCreations=0;
        Document.prototype.createElement=function(name,...args){if(String(name).toLowerCase()==='img')window.qaImageCreations++;return create.call(this,name,...args);};
    });
    context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
    const seed=await context.newPage();await seed.goto(origin+'/harness');
    const images=(await seed.evaluate(()=>Array.from({length:2},(_,variant)=>{
        const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
        const context=canvas.getContext('2d'),image=context.createImageData(256,256);let seed=variant+17;
        for(let i=0;i<image.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;image.data[i]=seed>>>24;image.data[i+1]=seed>>>16;image.data[i+2]=seed>>>8;image.data[i+3]=255;}
        context.putImageData(image,0,0);return canvas.toDataURL('image/png').split(',')[1];
    }))).map(value=>Buffer.from(value,'base64'));
    await seed.close();
    for(let id=0;id<40;id++)portraits.set(avatar(id),images[id%2]);
    portraits.set(avatar('changed'),images[1]);
    portraits.set(avatar('transient'),images[0]);
    const h={origin,context,hits,requests,errors,external,images,portraits,failures,set(value){current=value;status=200;malformed=false;},
        fail(code=503){status=code;},malformed(){malformed=true;},
        async open(route='/game.html',scoped=false,onResponse){
            const page=await context.newPage();if(onResponse)page.on('response',onResponse);
            await page.goto(origin+(scoped?prefix:'')+route+'?game=orbit&mode=ranking&key='+encodeURIComponent(key));
            await page.waitForFunction(()=>!busy);await loaded(page);return page;
        }};
    return h;
}
async function loaded(page){
    await page.evaluate(async()=>{await Promise.all([...document.images].map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});})));});
}
async function refresh(page){await page.evaluate(()=>poll());await loaded(page);}
async function content(page){return page.locator('ol > li').evaluateAll(rows=>rows.map(row=>({rank:row.querySelector('.rank').textContent,name:row.querySelector('.name').textContent,value:row.querySelector('strong').textContent})));}
function expected(entries){return entries.slice(0,30).map((row,index)=>({rank:String(index+1),name:row.name||'',value:Number(row.value||0).toLocaleString('tr-TR')+(row.unit?' '+row.unit:'')}));}

test('Chrome game avatars: original vs keyed DOM across 100 score updates and rank reorders', {timeout:60000},async t=>{
    const h=await fixture(t),results={};
    for(const [mode,route] of [['original','/legacy.html'],['keyed','/game.html']]){
        h.set(snapshot());const start=h.hits.length,requests=h.requests.length,bodies=[];
        const page=await h.open(route,false,response=>{
            if(response.request().resourceType()==='image'&&response.status()===200)bodies.push(response.body().then(body=>assert.deepEqual(body,h.portraits.get(new URL(response.url()).pathname))));
        });
        const initial=await page.screenshot({omitBackground:true});
        if(mode==='keyed')await page.evaluate(()=>{window.originalImages=new Map([...document.querySelectorAll('li')].map(row=>[row.querySelector('.name').textContent,row.querySelector('img')]));});
        for(let step=1;step<=100;step++){
            const entries=people().map((row,index)=>({...row,value:((index+step)%9)*1000+step,unit:step%2?'puan':'kg'})).sort((a,b)=>b.value-a.value);
            h.set(snapshot(entries));await refresh(page);assert.deepEqual(await content(page),expected(entries));
            if(mode==='keyed')assert.equal(await page.evaluate(()=>[...document.querySelectorAll('li')].every(row=>window.originalImages.get(row.querySelector('.name').textContent)===row.querySelector('img'))),true);
        }
        await Promise.all(bodies);
        const images=await page.locator('img').evaluateAll(images=>images.map(image=>({width:image.naturalWidth,height:image.naturalHeight,display:getComputedStyle(image).width,fit:getComputedStyle(image).objectFit})));
        assert.ok(images.every(image=>image.width===256&&image.height===256&&image.display==='38px'&&image.fit==='cover'));
        assert.equal(bodies.length,h.hits.length-start,'Every original PNG response is compared byte-for-byte');
        results[mode]={imageHits:h.hits.length-start,imageBytes:h.hits.slice(start).reduce((sum,hit)=>sum+hit.bytes,0),requests:h.requests.length-requests,imageCreations:await page.evaluate(()=>window.qaImageCreations),
            initial,final:await page.screenshot({omitBackground:true})};
        await page.close();
    }
    assert.equal(results.keyed.imageHits,9,'Only the initial nine full-resolution avatars are downloaded');
    assert.equal(results.original.imageCreations,909,'The original renderer recreates every image on each score tick');
    assert.equal(results.keyed.imageCreations,9,'Keyed reconciliation creates only the initial avatars');
    assert.ok(results.original.imageHits>=results.keyed.imageHits);
    assert.equal(results.original.requests,101);assert.equal(results.keyed.requests,101);
    assert.deepEqual(results.keyed.initial,results.original.initial,'Initial appearance is byte-identical');
    assert.deepEqual(results.keyed.final,results.original.final,'Reordered final appearance is byte-identical');
    assert.ok(results.keyed.imageBytes>9*100000,'Full source PNGs were retained, not replaced by small substitutes');
    assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
    t.diagnostic(JSON.stringify({localOnly:true,scoreUpdates:100,reorders:100,originalImageHits:results.original.imageHits,keyedImageHits:results.keyed.imageHits,
        originalImageBytes:results.original.imageBytes,keyedImageBytes:results.keyed.imageBytes,originalImageCreations:results.original.imageCreations,keyedImageCreations:results.keyed.imageCreations,
        imageHTTPReductionPercent:100*(1-results.keyed.imageBytes/results.original.imageBytes),imageCreationReductionPercent:100*(1-results.keyed.imageCreations/results.original.imageCreations),
        sourcePixels:'256x256',sourceBytesUnchanged:true,identicalScreenshots:true}));
});

test('Chrome keyed game rows retain profiles, replace changed avatar URLs and handle entrants, leavers and fallback images', {timeout:30000},async t=>{
    const h=await fixture(t);h.set(snapshot());const page=await h.open('/game.html',true),start=h.hits.length;
    assert.equal(h.requests.at(-1).searchParams.get('items'),'30');assert.equal(h.requests.at(-1).searchParams.has('key'),false);
    assert.ok(h.hits.every(hit=>hit.url.pathname.startsWith(prefix+'/widget/gift-assets/')&&!hit.url.search));
    await page.evaluate(()=>{window.savedRows=new Map([...document.querySelectorAll('li')].map(row=>[row.querySelector('.name').textContent,{row,image:row.querySelector('img')}]));});
    let entries=people();entries[0]={...entries[0],name:'Renamed Player',value:0,unit:'x'};h.set({...snapshot(entries),label:'New Label'});await refresh(page);
    assert.deepEqual(await content(page),expected(entries));assert.equal(await page.locator('h1').textContent(),'New Label');
    assert.equal(await page.evaluate(()=>document.querySelector('li img')===window.savedRows.get('Player 0').image),true);
    assert.equal(h.hits.length,start,'A display name, explicit zero and unit change do not redownload an unchanged avatar');
    entries[0]={...entries[0],avatar:avatar('changed')};h.set(snapshot(entries));await refresh(page);
    assert.equal(h.hits.length,start+1);assert.equal(await page.evaluate(()=>document.querySelector('li img')!==window.savedRows.get('Player 0').image),true);
    await page.evaluate(()=>window.savedRows.get('Player 0').image.onerror());
    assert.equal(await page.locator('li').first().locator('img').count(),1,'Late errors from the replaced image cannot remove its successor');
    assert.equal(await page.evaluate(()=>document.querySelector('li')===window.savedRows.get('Player 0').row),true);
    entries=[{id:'new',name:'New Entrant',avatar:avatar(9),value:20000,unit:'kg'},...entries.slice(1).reverse()];h.set(snapshot(entries));await refresh(page);
    assert.deepEqual(await content(page),expected(entries));assert.equal(h.hits.length,start+2);
    assert.equal(await page.evaluate(()=>!window.savedRows.get('Player 0').row.isConnected),true);
    assert.equal(await page.evaluate(()=>[...document.querySelectorAll('li')].slice(1).every(row=>window.savedRows.get(row.querySelector('.name').textContent).image===row.querySelector('img'))),true);
    entries=[{id:'new',name:'Broken Portrait',avatar:avatar('missing'),value:1}];h.set(snapshot(entries));await refresh(page);
    assert.equal(await page.locator('.face').textContent(),'B');assert.equal(await page.locator('img').count(),0);const failedHits=h.hits.length;
    entries[0]={...entries[0],name:'Fallback Name',value:2};h.set(snapshot(entries));await refresh(page);
    assert.equal(await page.locator('.face').textContent(),'F');assert.equal(h.hits.length,failedHits,'A known failed URL is not retried on score updates');
    entries[0]={...entries[0],avatar:avatar(0)};h.set(snapshot(entries));await refresh(page);
    assert.equal(await page.locator('img').count(),1);assert.equal(await page.locator('img').getAttribute('src'),prefix+avatar(0));
    entries=[{id:'unsafe',name:'<img src="https://external.invalid/x">',avatar:'https://external.invalid/portrait.png',value:3}];h.set(snapshot(entries));await refresh(page);
    assert.equal(await page.locator('.name').textContent(),entries[0].name);assert.equal(await page.locator('img').count(),0);
    assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);await page.close();
});

test('Chrome game rows clear on offline, empty, malformed and failed snapshots and resume without stale DOM', {timeout:30000},async t=>{
    const h=await fixture(t),page=await h.open();
    assert.equal(h.requests.at(-1).searchParams.get('items'),'30');assert.equal(h.requests.at(-1).searchParams.get('key'),key);
    assert.ok(h.hits.every(hit=>hit.url.searchParams.get('key')===key));
    for(const fail of [()=>h.set({...snapshot(),online:false}),()=>h.set(snapshot([])),()=>h.set({...snapshot(),entries:null}),()=>h.malformed(),()=>h.fail()]){
        await page.evaluate(()=>{window.staleRow=document.querySelector('li');});const hits=h.hits.length;
        fail();await refresh(page);
        assert.equal(await page.locator('main').evaluate(element=>element.hidden),true);assert.equal(await page.locator('li').count(),0);assert.equal(await page.locator('h1').textContent(),'');
        assert.equal(await page.evaluate(()=>!window.staleRow.isConnected),true);assert.equal(h.hits.length,hits);
        h.set(snapshot());await refresh(page);assert.equal(await page.locator('main').evaluate(element=>element.hidden),false);assert.deepEqual(await content(page),expected(people()));
    }
    h.set(snapshot(people(35)));await refresh(page);assert.equal(await page.locator('li').count(),30);
    assert.ok(h.hits.every(hit=>![30,31,32,33,34].some(id=>hit.url.pathname.endsWith(avatar(id)))),'Entries beyond the visible cap never request avatars');
    const entries=[{id:0,name:'Numeric Zero',avatar:avatar(0),value:0},{id:1,name:'String One',avatar:avatar(1),value:1},
        {id:'1',name:'Other One',avatar:avatar(2),value:2},{name:'No ID',avatar:avatar(3),value:3},
        {id:'duplicate',name:'Duplicate A',avatar:avatar(4),value:4},{id:'duplicate',name:'Duplicate B',avatar:avatar(5),value:5}];
    h.set(snapshot(entries));await refresh(page);assert.deepEqual(await content(page),expected(entries));
    await page.evaluate(()=>{window.images=[...document.images];window.profiles=new Map([...document.querySelectorAll('li')].map(row=>[row.querySelector('.name').textContent,row.querySelector('img')]));});h.set(snapshot(entries.map(row=>({...row,value:10}))));await refresh(page);
    assert.equal(await page.evaluate(()=>[...document.images].every((image,index)=>image===window.images[index])),true);
    h.set(snapshot(entries.slice().reverse()));await refresh(page);assert.deepEqual(await content(page),expected(entries.slice().reverse()));
    assert.equal(await page.evaluate(()=>[...document.querySelectorAll('li')].every(row=>window.profiles.get(row.querySelector('.name').textContent)===row.querySelector('img'))),true,'Duplicate IDs remain separate stable profiles through reorders');
    assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);await page.close();
});

test('Chrome transient avatar failures retry only on polls after 15s then 60s and reset after success or URL changes', {timeout:30000},async t=>{
    const h=await fixture(t);let entry=people(1)[0];h.set(snapshot([entry]));const page=await h.open(),start=h.hits.length;
    await page.evaluate(()=>{window.qaNow=0;Object.defineProperty(performance,'now',{value:()=>window.qaNow});});
    const advance=now=>page.evaluate(value=>{window.qaNow=value;},now);
    h.failures.set(avatar('transient'),2);entry={...entry,avatar:avatar('transient')};h.set(snapshot([entry]));await refresh(page);
    assert.equal(h.hits.length,start+1);assert.equal(await page.locator('img').count(),0);assert.equal(await page.locator('.face').textContent(),'P');
    const initialCreations=await page.evaluate(()=>window.qaImageCreations);
    for(let value=1;value<=100;value++){entry={...entry,value};h.set(snapshot([entry]));await refresh(page);}
    assert.equal(h.hits.length,start+1);assert.equal(await page.evaluate(()=>window.qaImageCreations),initialCreations,'100 score changes create no retry image during backoff');
    await advance(14999);await refresh(page);assert.equal(h.hits.length,start+1);
    await advance(15000);await refresh(page);assert.equal(h.hits.length,start+2);assert.equal(await page.locator('img').count(),0);
    await advance(74999);await refresh(page);assert.equal(h.hits.length,start+2);
    await advance(75000);await refresh(page);assert.equal(h.hits.length,start+3);assert.equal(await page.locator('img').count(),1);
    assert.equal(await page.locator('img').evaluate(image=>image.naturalWidth),256,'The unchanged URL recovers its original full-resolution PNG');
    await page.evaluate(()=>{window.recoveredImage=document.querySelector('img');});
    for(let value=101;value<=200;value++){entry={...entry,value};h.set(snapshot([entry]));await refresh(page);}
    assert.equal(h.hits.length,start+3);assert.equal(await page.evaluate(()=>document.querySelector('img')===window.recoveredImage),true);
    await page.evaluate(()=>document.querySelector('img').onerror());
    await advance(89999);await refresh(page);assert.equal(await page.locator('img').count(),0);
    await advance(90000);await refresh(page);assert.equal(await page.locator('img').count(),1,'Success resets the next retry to 15 seconds');
    h.failures.set(avatar('missing'),1);h.portraits.set(avatar('missing'),h.images[1]);entry={...entry,avatar:avatar('missing')};h.set(snapshot([entry]));await refresh(page);
    assert.equal(await page.locator('img').count(),0);
    entry={...entry,avatar:avatar('changed')};h.set(snapshot([entry]));await refresh(page);
    assert.equal(await page.locator('img').count(),1,'A genuine URL change loads immediately during the previous URL backoff');
    assert.equal(await page.locator('img').getAttribute('src'),avatar('changed')+'?key='+encodeURIComponent(key));
    const hits=h.hits.length;await page.goto('about:blank');await page.evaluate(()=>Promise.resolve());assert.equal(h.hits.length,hits);
    assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);await page.close();
    t.diagnostic(JSON.stringify({localOnly:true,failedAttempts:2,firstRetryMs:15000,laterRetryMs:60000,scoreUpdatesWithoutImageChurn:200,eventualRecovery:true}));
});
