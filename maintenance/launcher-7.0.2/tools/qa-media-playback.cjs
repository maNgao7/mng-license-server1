'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { createMediaStudio } = require('../lib/media-studio.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-playback-fixture-'));
const output = process.env.MNG_MEDIA_QA_OUTPUT || path.join(os.tmpdir(), 'tikmng-media-playback-report');
const values = new Map();
const store = { get: (key, fallback) => values.get(key) ?? fallback, set: (key, value) => values.set(key, structuredClone(value)) };
const events = [], errors = [], network = [], passed = [];
let activeGame = '', browser, server, origin;
const key = 'synthetic-media-playback-qa-key';
const studio = createMediaStudio({ store, root: path.join(temporary, 'media'), accessKey: key, getChannel: () => 'qa', getActiveGame: () => activeGame, onEvent: event => events.push(event) });
const check = async (name, run) => { await run(); passed.push(name); console.log('PASS ' + name); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function instrument(page) {
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (route.request().url().startsWith(origin + '/')) return route.continue();
    network.push(route.request().url()); return route.abort();
  });
  await page.addInitScript(() => {
    window.__plays = []; window.__removed = []; window.__received = []; window.__sources = [];
    const Original = window.EventSource;
    window.EventSource = class extends Original {
      constructor(...args) {
        super(...args); window.__sources.push(this);
        this.addEventListener('studio:play', event => window.__received.push(JSON.parse(event.data)));
      }
    };
    document.addEventListener('playing', event => {
      const el = event.target;
      el.__lastTime = el.currentTime;
      if (!el.__recorded) {
        el.__recorded = true;
        window.__plays.push({ title: el.getAttribute('aria-label'), time: el.currentTime, at: performance.now(), volume: el.volume, duration: el.duration });
      }
    }, true);
    document.addEventListener('timeupdate', event => {
      const el = event.target;
      el.__lastTime = Math.max(el.__lastTime || 0, el.currentTime || 0);
    }, true);
    document.addEventListener('DOMContentLoaded', () => new MutationObserver(records => {
      for (const record of records) for (const el of record.removedNodes) if (el.nodeType === 1) window.__removed.push({ title: el.getAttribute('aria-label'), at: performance.now(), time: Math.max(el.__lastTime || 0, el.currentTime || 0) });
    }).observe(document.getElementById('stage'), { childList: true }));
  });
}
async function open(page, game = '') {
  await page.goto(origin + '/tikmng/media?' + new URLSearchParams({ key, channel: 'qa', ...(game ? { game } : {}) }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__sources[0]?.readyState === 1, null, { timeout: 5000 });
}
async function playing(page, title) {
  await page.waitForFunction(title => {
    const v = document.querySelector('#stage video');
    return v?.getAttribute('aria-label') === title && !v.paused && v.readyState >= 2;
  }, title, { timeout: 6500 });
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const ffmpeg = process.env.FFMPEG_PATH || 'C:/Users/User/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe';
  const generate = args => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { windowsHide: true, timeout: 20000 });
  const mp4 = path.join(temporary, 'synthetic-5s.mp4'), png = path.join(temporary, 'synthetic.png'), gif = path.join(temporary, 'synthetic.gif');
  generate(['-f','lavfi','-i','testsrc2=size=320x180:rate=24','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','5','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',mp4]);
  generate(['-f','lavfi','-i','color=c=teal:s=96x96','-frames:v','1',png]);
  generate(['-f','lavfi','-i','testsrc2=size=96x96:rate=8','-t','1',gif]);
  const [a,b,p,g,scoped] = await studio.importFiles([mp4,mp4,png,gif,png], [
    { title:'QA A', giftId:'5655', startSeconds:1, endSeconds:2.3, volume:.35 },
    { title:'QA B', giftId:'6064', startSeconds:.5, endSeconds:1.4, volume:.6 },
    { title:'QA PNG', giftId:'7934', displaySeconds:.6 },
    { title:'QA GIF', giftId:'7935', displaySeconds:.6 },
    { title:'QA Game', giftId:'7936', gameId:'qa-game', displaySeconds:.6 }
  ]);
  server = http.createServer((req,res) => {
    if (studio.handleRequest(req,res,new URL(req.url,'http://127.0.0.1'))) return;
    res.writeHead(404); res.end();
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless:true, executablePath:process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args:['--autoplay-policy=no-user-gesture-required','--mute-audio'] });
  const page = await browser.newPage({ viewport:{width:640,height:360} });
  page.setDefaultTimeout(6500); await instrument(page); await open(page);
  await check('wrong gift emits no event or playback', async () => {
    const before = events.length;
    assert.equal(studio.ingest('gift',{giftId:'999999',repeatEnd:true,eventId:'wrong'}).length,0);
    await sleep(150); assert.equal(events.length,before); assert.equal(await page.locator('#stage>*').count(),0);
  });
  await check('two actions queue sequentially with decoded 5s MP4, trim and volume', async () => {
    studio.test(a.id); await playing(page,'QA A');
    const v = await page.locator('video').evaluate(v => ({time:v.currentTime,volume:v.volume,duration:v.duration}));
    assert.ok(v.time>=.98 && v.time<1.7); assert.equal(v.volume,.35); assert.ok(v.duration>=4.9 && v.duration<=5.2);
    studio.test(b.id); await sleep(180);
    assert.equal(await page.locator('video').getAttribute('aria-label'),'QA A');
    await playing(page,'QA B');
    const bState = await page.locator('video').evaluate(v => ({time:v.currentTime,volume:v.volume}));
    assert.ok(bState.time>=.48 && bState.time<1.2); assert.equal(bState.volume,.6);
    const end = await page.evaluate(() => {
      const end=window.__removed.find(x=>x.title==='QA A'), start=window.__plays.find(x=>x.title==='QA A');
      return end && { ...end, elapsed:end.at-start.at };
    });
    assert.ok(end && end.elapsed>=1000 && end.elapsed<=1800 && end.time<=2.6, 'Trimmed A must play 1.3s: '+JSON.stringify(end));
    await page.screenshot({path:path.join(output,'sequential-b.png'),omitBackground:true});
    await page.waitForFunction(()=>!document.querySelector('#stage>*'));
  });
  await check('interrupt cuts another action and clears its queued replay', async () => {
    studio.save({id:a.id,endSeconds:4.5}); studio.save({id:b.id,interrupt:true});
    await open(page); studio.test(a.id); await playing(page,'QA A');
    studio.test(a.id); studio.test(b.id); await playing(page,'QA B');
    const cut = await page.evaluate(()=>window.__removed.find(x=>x.title==='QA A'));
    assert.ok(cut && cut.time<3, 'A interrupted before trim end');
    await page.waitForFunction(()=>!document.querySelector('#stage>*')); await sleep(180);
    assert.deepEqual(await page.evaluate(()=>window.__plays.map(x=>x.title)),['QA A','QA B']);
  });
  await check('playLimit caps actual playback; explicit test bypasses exhausted limit', async () => {
    studio.save({id:a.id,startSeconds:1,endSeconds:1.55,playLimit:2,combineGifts:true});
    await open(page);
    assert.equal(studio.ingest('gift',{giftId:'5655',repeatEnd:true,repeatCount:5,eventId:'limit'}).length,2);
    await page.waitForFunction(()=>window.__plays.length===2);
    await page.waitForFunction(()=>!document.querySelector('#stage>*'));
    assert.equal(studio.ingest('gift',{giftId:'5655',repeatEnd:true,eventId:'limit-again'}).length,0);
    studio.test(a.id); await page.waitForFunction(()=>window.__plays.length===3);
    await page.waitForFunction(()=>!document.querySelector('#stage>*'));
  });
  await check('local PNG and animated GIF decode on broadcast route and expire', async () => {
    for (const item of [p,g]) {
      const response = await fetch(origin+item.mediaUrl);
      assert.equal(response.status,200); assert.equal(response.headers.get('content-type'),item.id===p.id?'image/png':'image/gif');
      assert.ok((await response.arrayBuffer()).byteLength>0);
      studio.test(item.id);
      await page.waitForFunction(title=>{const img=document.querySelector('#stage img');return img?.getAttribute('aria-label')===title&&img.complete&&img.naturalWidth===96;},item.title);
      await page.screenshot({path:path.join(output,item.id===p.id?'png.png':'gif.png'),omitBackground:true});
      await page.waitForFunction(()=>!document.querySelector('#stage>*'));
    }
  });
  const gamePage = await browser.newPage(); await instrument(gamePage); await open(gamePage,'qa-game');
  await check('game action fires only for active game and only on game-scoped route', async () => {
    const before=events.length;
    assert.equal(studio.ingest('gift',{giftId:'7936',repeatEnd:true,eventId:'inactive-game'}).length,0);
    activeGame='other-game';
    assert.equal(studio.ingest('gift',{giftId:'7936',repeatEnd:true,eventId:'wrong-game'}).length,0);
    assert.equal(events.length,before); assert.equal(await gamePage.locator('#stage>*').count(),0);
    activeGame='qa-game';
    assert.equal(studio.ingest('gift',{giftId:'7936',repeatEnd:true,eventId:'active-game'}).length,1);
    await gamePage.waitForFunction(()=>document.querySelector('#stage img')?.naturalWidth===96);
    assert.equal(await page.locator('#stage>*').count(),0);
    await gamePage.waitForFunction(()=>!document.querySelector('#stage>*'));
  });
  await check('manual game test bypasses inactive/disabled/limit filters but preserves route scope', async () => {
    activeGame=''; studio.save({id:scoped.id,enabled:false,playLimit:1});
    for(let i=0;i<2;i++) {
      studio.test(scoped.id);
      await gamePage.waitForFunction(()=>document.querySelector('#stage img')?.naturalWidth===96);
      assert.equal(await page.locator('#stage>*').count(),0);
      await gamePage.waitForFunction(()=>!document.querySelector('#stage>*'));
    }
    assert.equal(await gamePage.evaluate(()=>window.__received.length),3);
  });
  assert.deepEqual(errors,[],'No page JavaScript errors'); assert.deepEqual(network,[],'No external network');
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,checks:passed,errors,externalRequests:network,liveAccounts:false},null,2));
  console.log(JSON.stringify({passed:true,checks:passed.length,output}));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  await browser?.close(); studio.close(); server?.closeAllConnections();
  if(server) await new Promise(resolve=>server.close(resolve));
  const resolved=path.resolve(temporary), parent=path.resolve(os.tmpdir());
  if(path.dirname(resolved)!==parent || !path.basename(resolved).startsWith('tikmng-playback-fixture-')) throw new Error('Unsafe fixture cleanup');
  fs.rmSync(resolved,{recursive:true,force:true});
  console.log('Fixture server, browser, media and synthetic store cleaned up.');
});
