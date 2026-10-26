'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const renderer = path.resolve(__dirname, '../renderer');
const output = process.env.WIDGET_SHOWCASE_OUTPUT || path.join(os.tmpdir(), 'tikmng-widgets-showcase');
const before = process.argv.includes('--before');
const phase = before ? 'before' : 'after';
const types = ['topgift','coinjar','topliker','topgifter','carousel','coindrop','timer','streambuddies','likefountain','userinfo','wheel','viewercount','tinydiny'];
const overlay = path.join(renderer, 'widgets/overlay.html');
let data = {}, browser;
const errors = [], external = [], checks = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
  if (url.pathname === '/api/widget/state') {
    res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); return;
  }
  const relative = url.pathname.startsWith('/widget/gift-assets/') ? url.pathname.replace('/widget/', '') : url.pathname.replace(/^\/widget\//, 'widgets/');
  const file = path.resolve(renderer, relative.replace(/^\//, ''));
  if (!file.startsWith(renderer + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type',file.endsWith('.png')?'image/png':file.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');
  res.end(fs.readFileSync(file));
});
async function main() {
  fs.mkdirSync(output,{recursive:true});
  if (before) fs.copyFileSync(overlay,path.join(output,'before-overlay.html'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({channel:'chrome',headless:true});
  const context = await browser.newContext({viewport:{width:260,height:260}});
  await context.route('**/*',route=>{
    const url=route.request().url();
    if(url.startsWith(origin+'/') || url.startsWith('data:')) return route.continue();
    external.push(url); return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    let seed=41; Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  });
  await page.goto(`${origin}/widget/overlay.html?type=viewercount`);
  const portraits=await page.evaluate(()=>Array.from({length:6},(_,i)=>{
    const c=document.createElement('canvas');c.width=c.height=144;const x=c.getContext('2d');
    const colors=['#178c97','#c64d69','#6b58aa','#bc843c','#448765','#a34a7d'];
    const gradient=x.createLinearGradient(0,0,144,144);gradient.addColorStop(0,colors[i]);gradient.addColorStop(1,'#152430');x.fillStyle=gradient;x.fillRect(0,0,144,144);
    x.fillStyle='#e5b292';x.beginPath();x.ellipse(72,67,31,38,0,0,Math.PI*2);x.fill();
    x.fillStyle='#272633';x.beginPath();x.ellipse(72,147,55,43,0,0,Math.PI*2);x.fill();
    x.fillStyle='#3b292d';x.beginPath();x.ellipse(72,37,34,20,0,Math.PI,Math.PI*2);x.fill();
    x.fillRect(56,63,5,5);x.fillRect(84,63,5,5);x.fillStyle='#a95260';x.fillRect(65,85,15,3);
    return c.toDataURL();
  }));
  const people=['deniz_oyunda','elif.live','mert_34','zeynep','arda','selin'].map((username,i)=>({username,nickname:['Deniz','Elif','Mert','Zeynep','Arda','Selin'][i],avatar:portraits[i],totalCoins:15840-i*2100,totalLikes:32500-i*3500}));
  const asset=id=>`/widget/gift-assets/${id}.png`;
  function fixture() {
    const gift={...people[0],id:'gift-1',type:'gift',giftName:'Kristal Taç',giftImage:asset(13447),count:8,coins:16000,createdAt:Date.now()};
    return {channel:'qa_yayini',updatedAt:1,stats:{viewerCount:3712,totalCoins:3280,totalGifts:74,totalLikes:85214},topGift:gift,topGifters:people,topLikes:people,activities:[gift,{...people[1],id:'like-1',type:'like',count:482,createdAt:Date.now()},{...people[2],id:'wheel-1',type:'chat',message:'!wheel',createdAt:Date.now()}],jarGifts:Array.from({length:28},(_,i)=>({...gift,id:`jar-${i}`,count:1,giftImage:asset([5655,5502,11046,6064][i%4])}))};
  }
  async function open(type, preview=true) {
    await page.goto(`${origin}/widget/overlay.html?type=${type}&items=6${preview?'&preview=1':''}`);
    await page.waitForFunction(()=>lastSignature.length>0);
    await page.waitForFunction(()=>[...document.querySelectorAll('img')].every(img=>img.complete));
  }
  async function freeze() {
    await page.evaluate(()=>document.getAnimations().forEach(a=>{
      const target=a.effect.target;
      a.currentTime=target.classList.contains('wheel')||target.classList.contains('wheel-result')?5500:target.classList.contains('heart')?1700:1050;
      a.pause();
    }));
  }
  for(const size of [{width:260,height:260},{width:600,height:440}]) {
    await page.setViewportSize(size);
    for(const type of types) {
      data=fixture();await open(type);await page.waitForTimeout(type==='coinjar'?3800:100);await freeze();
      assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
      assert.equal(await page.locator('img').evaluateAll(imgs=>imgs.filter(x=>!x.naturalWidth&&!x.hidden).length),0,`${type}: raster assets load`);
      await page.screenshot({path:path.join(output,`${phase}-${size.width}-${type}.png`),omitBackground:true});
    }
  }
  if(!before) {
    await page.setViewportSize({width:600,height:440});
    for(const type of types) {
      data=fixture();await open(type,false);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.evaluate(()=>{
        window.__node=document.querySelector('#stage').firstElementChild;
        window.__motion=document.getAnimations()[0]||null;
        window.__started=window.__motion?.startTime;
      });
      data.updatedAt++;data.stats.totalShares=9;
      if(type!=='viewercount')data.stats.viewerCount++;
      if(type!=='tinydiny')data.stats.totalCoins++;
      await page.waitForTimeout(950);
      assert.ok(await page.evaluate(()=>window.__node===document.querySelector('#stage').firstElementChild),`${type}: no remount on unrelated poll`);
      assert.ok(await page.evaluate(()=>!window.__motion||document.getAnimations().includes(window.__motion)),`${type}: animation object retained`);
      assert.ok(await page.evaluate(()=>!window.__motion||window.__motion.startTime===window.__started),`${type}: animation start retained`);
    }
    checks.push('All 13 retain DOM and animation clock on unrelated polling');
    for(const [type,selector,activity] of [['wheel','.wheel','chat'],['coindrop','.coins','gift'],['likefountain','.heart','like'],['topgift','.flip-award','gift']]) {
      data=fixture();await open(type,false);
      await page.evaluate(selector=>window.__effect=document.querySelector(selector),selector);
      const target=data.activities.find(x=>x.type===activity);target.id+='-new';target.createdAt=Date.now();
      await page.waitForFunction(selector=>document.querySelector(selector)!==window.__effect,selector);
    }
    checks.push('New gift, like, top gift and wheel events trigger new animations');
    data=fixture();await open('wheel',false);await page.waitForTimeout(5500);
    const expired=data.activities.find(x=>x.type==='chat');expired.createdAt=Date.now()-20000;
    data.updatedAt++;
    await page.waitForFunction(()=>!document.querySelector('#stage>*'),null,{timeout:2500});
    data.stats.totalCoins++;await page.waitForTimeout(950);
    assert.equal(await page.locator('.wheel').count(),0,'Expired event is not replayed by stats update');
    checks.push('Expired effects clear and never replay from stats updates');
    data=fixture();await open('viewercount',false);data.stats.viewerCount=0;
    await page.waitForFunction(()=>document.querySelector('.viewer-number')?.textContent==='0');
    checks.push('Real zero viewer count preserved');
    for(const type of types) {
      data={};await open(type,false);
      assert.doesNotMatch(await page.locator('#stage').textContent(),/mng_destekci|kalp_yagmuru|128|undefined/);
    }
    checks.push('No synthetic production LIVE content');
    data=fixture();await open('coinjar',false);await page.waitForTimeout(2200);
    const painted=await page.locator('.physics-jar canvas').evaluate(c=>[...c.getContext('2d').getImageData(0,0,c.width,c.height).data].some((n,i)=>i%4===3&&n>0));
    assert.ok(painted,'Gift physics renders pixels');checks.push('Existing Matter physics renders raster gifts');
  }
  const sheet=await context.newPage();
  const embed=(which,type)=>`data:image/png;base64,${fs.readFileSync(path.join(output,`${which}-260-${type}.png`)).toString('base64')}`;
  const css=`body{margin:0;padding:24px;background:#11151c;color:#f1f5f6;font:13px Segoe UI}h1{font-size:24px;margin:0 0 5px}p{color:#8d9eab;margin:0 0 24px}.grid{display:grid;grid-template-columns:repeat(4,260px);gap:18px}.tile{width:260px}.title{padding:9px 0;color:#b8c9d3}.art{height:260px;background:repeating-conic-gradient(#1b2330 0 25%,#202a37 0 50%) 0 0/24px 24px}.art img{width:260px;height:260px}em{color:#45eee0;font-style:normal}`;
  await sheet.setViewportSize({width:1142,height:1200});
  const tiles=types.map(type=>`<section class="tile"><div class="title">${type}</div><div class="art"><img src="${embed(phase,type)}"></div></section>`).join('');
  await sheet.setContent(`<style>${css}</style><h1>${before?'Before':'Broadcast Showcase'}</h1><p>13 widgets · 260 px · synthetic public-shaped QA fixtures · original bundled raster gifts</p><div class="grid">${tiles}</div>`);
  await sheet.screenshot({path:path.join(output,`${phase}-contact-sheet.png`),fullPage:true});
  if(!before&&fs.existsSync(path.join(output,'before-260-topgift.png'))) {
    const pairs=types.map(type=>['before','after'].map(which=>`<section class="tile"><div class="title">${type} · <em>${which}</em></div><div class="art"><img src="${embed(which,type)}"></div></section>`).join('')).join('');
    await sheet.setContent(`<style>${css}</style><h1>Before / After</h1><p>Identical data and viewport; transparent OBS captures shown over a checkerboard.</p><div class="grid">${pairs}</div>`);
    await sheet.screenshot({path:path.join(output,'before-after-contact-sheet.png'),fullPage:true});
  }
  assert.deepEqual(errors,[],'No JavaScript errors');assert.deepEqual(external,[],'No external requests');
  fs.writeFileSync(path.join(output,`${phase}-result.json`),JSON.stringify({passed:true,types:13,phase,checks,external,errors,sha256:crypto.createHash('sha256').update(fs.readFileSync(overlay)).digest('hex')},null,2));
  console.log(JSON.stringify({passed:true,phase,checks,output}));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
