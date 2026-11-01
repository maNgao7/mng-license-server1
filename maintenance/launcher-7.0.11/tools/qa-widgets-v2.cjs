'use strict';
// Isolated, public-shaped synthetic fixtures. No launcher services or accounts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../renderer');
const output = process.env.WIDGET_QA_OUTPUT || path.join(os.tmpdir(), 'tikmng-widgets-v2');
const types = ['topgift','coinjar','topliker','topgifter','carousel','coindrop','timer','streambuddies','likefountain','userinfo','wheel','viewercount','tinydiny'];
let state = {}, browser;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
  if (url.pathname === '/api/widget/state') {
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(state)); return;
  }
  const relative = url.pathname.startsWith('/widget/gift-assets/') ? url.pathname.replace('/widget/', '') : url.pathname.replace(/^\/widget\//, 'widgets/');
  const file = path.resolve(root, relative.replace(/^\//, ''));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
  res.end(fs.readFileSync(file));
});
async function main() {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 600, height: 440 } });
  const errors = [], external = [], captures = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(base + '/') || url.startsWith('data:')) return route.continue();
    external.push(url); return route.abort();
  });
  await page.goto(`${base}/widget/overlay.html?type=viewercount`);
  const portraits = await page.evaluate(() => Array.from({ length: 6 }, (_, i) => {
    const c = document.createElement('canvas'); c.width = c.height = 72;
    const x = c.getContext('2d'); x.fillStyle = ['#43877b','#bc766e','#9d8a54'][i % 3]; x.fillRect(0,0,72,72);
    x.fillStyle = '#263031'; x.beginPath(); x.ellipse(36,74,28,25,0,0,Math.PI*2); x.fill();
    x.fillStyle = '#e4b797'; x.beginPath(); x.ellipse(36,29,17,20,0,0,Math.PI*2); x.fill();
    x.fillStyle = '#39302e'; x.fillRect(23,10,26,9); x.fillRect(29,29,3,3); x.fillRect(42,29,3,3);
    return c.toDataURL();
  }));
  const people = Array.from({ length: 10 }, (_, i) => ({ username: ['deniz_oyunda','elif.live','mert_34','zeynep','arda','selin'][i % 6] + (i > 5 ? i : ''), nickname: ['Deniz','Elif','Mert','Zeynep','Arda','Selin'][i % 6], avatar: portraits[i % 6], totalCoins: 15840-i*1100, totalLikes: 32500-i*2300 }));
  const fixture = () => {
    const gift = { ...people[0], id: 'synthetic-gift', type: 'gift', giftName: 'Gul', giftImage: '/widget/gift-assets/5655.png', count: 24, coins: 2400, createdAt: Date.now() };
    return { channel: 'qa_yayini', stats: { viewerCount: 3712, totalLikes: 85214, totalCoins: 12840, totalGifts: 146 }, topGift: gift, topGifters: people, topLikes: people, ranking: people.map(x => ({ ...x, score: x.totalCoins })), activities: [gift, { ...people[1], id: 'like', type: 'like', count: 482, createdAt: Date.now() }, { ...people[2], id: 'wheel', type: 'chat', message: '!wheel', createdAt: Date.now() }], jarGifts: Array.from({ length: 20 }, (_, i) => ({ ...gift, id: `jar-${i}`, count: 1 })) };
  };
  const open = async (type, query = 'preview=1&items=6') => {
    await page.goto(`${base}/widget/overlay.html?type=${type}&${query}`);
    await page.waitForFunction(() => document.querySelector('#stage').children.length > 0);
    await page.waitForTimeout(type === 'coinjar' ? 750 : 60);
  };
  // Exercise seeded previews before adding fixtures, then both broadcast sizes.
  state = {};
  for (const type of types) { await open(type); }
  for (const size of [{ width:260,height:260 }, { width:600,height:440 }, { width:460,height:680 }]) {
    await page.setViewportSize(size);
    for (const type of types) {
      state = fixture(); await open(type);
      await page.evaluate(() => document.getAnimations().filter(a => !a.effect.target.closest('canvas')).forEach(a => { if (a.effect.target.classList.contains('wheel')) a.currentTime=5100; else if (a.effect.target.classList.contains('wheel-result')) a.currentTime=5500; else a.currentTime=700; a.pause(); }));
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgba(0, 0, 0, 0)', `${type}: transparent OBS`);
      if (!['carousel','coindrop','likefountain'].includes(type)) {
        const overflow = await page.evaluate(() => [...document.querySelectorAll('#stage > *, .leader-list .item, .hero-main, .physics-jar-total, .wheel-result')].filter(el => {
          const b = el.getBoundingClientRect(), p = el.parentElement.getBoundingClientRect();
          if (el.closest('.leader-list') && b.top >= p.bottom) return false;
          return b.width > 0 && b.height > 0 && (b.left < -1 || b.top < -1 || b.right > innerWidth+1 || b.bottom > innerHeight+1);
        }).map(el => el.className));
        assert.deepEqual(overflow, [], `${type}: bounds at ${size.width}x${size.height}`);
      }
      assert.equal(await page.locator('img').evaluateAll(imgs => imgs.filter(x => !x.complete || !x.naturalWidth).length), 0, `${type}: local images`);
      const file = `${size.width}-${type}.png`;
      await page.screenshot({ path: path.join(output,file), omitBackground:true });
      if (size.width === 260) captures.push({ type, data: fs.readFileSync(path.join(output,file)).toString('base64') });
    }
  }
  await page.setViewportSize({ width:260,height:260 });
  state = fixture(); await open('viewercount','');
  assert.equal(await page.locator('.viewer-number').textContent(), '3.712');
  state.stats.viewerCount = 0;
  await page.waitForFunction(() => document.querySelector('.viewer-number')?.textContent === '0');
  state = { stats: { viewerCount:27 }, activities:[], jarGifts:[] }; await open('viewercount');
  assert.equal(await page.locator('.viewer-number').textContent(), '27', 'Preview must preserve provided counts');
  state = {}; await open('userinfo','');
  assert.doesNotMatch(await page.locator('#stage').textContent(), /mng_destekci|undefined/);
  state = fixture(); state.activities[0].username = 'very_long_public_synthetic_username_123';
  await open('userinfo');
  assert.ok(await page.locator('.hero').evaluate(el => el.scrollWidth <= el.clientWidth), 'Long username wraps');
  state = fixture(); await open('coinjar');
  const painted = await page.locator('canvas').evaluate(c => [...c.getContext('2d').getImageData(0,0,c.width,c.height).data].some((v,i) => i%4===3 && v>0));
  assert.ok(painted,'Gift cup paints nonblank canvas');
  state = fixture(); await open('topgift','');
  state.topGift.coins = 2501;
  await page.waitForFunction(() => document.querySelector('.flip-coins')?.textContent.includes('2.501'));
  const previousGift = state.topGift; state.topGift = null;
  await page.waitForFunction(() => !document.querySelector('.flip-award'));
  state.topGift = previousGift;
  await page.waitForFunction(() => document.querySelector('.flip-award'));
  for (const type of types) {
    state = {};
    await page.goto(`${base}/widget/overlay.html?type=${type}`);
    await page.waitForFunction(() => typeof lastSignature === 'string' && lastSignature.length > 0);
    assert.doesNotMatch(await page.locator('#stage').textContent(), /mng_destekci|kalp_yagmuru|128/, `${type}: no invented LIVE data`);
  }
  state = fixture();
  await open('userinfo','preview=1&scale=80&opacity=65&position=left&offsetX=3&offsetY=4');
  assert.deepEqual(await page.locator('#stage').evaluate(el => [el.style.transform,el.style.opacity,el.style.justifyItems,el.style.translate]), ['scale(0.8)','0.65','start','3px 4px']);
  assert.deepEqual(errors,[],'No JS errors'); assert.deepEqual(external,[],'Fully offline fixtures');
  await page.setViewportSize({ width:1120,height:1200 });
  await page.setContent(`<body style="margin:0;padding:16px;background:#292d2c;color:#eee;font:13px Segoe UI;display:grid;grid-template-columns:repeat(4,260px);gap:16px">${captures.map(x=>`<section><div style="padding:8px 0">${x.type} · synthetic preview</div><img width="260" height="260" src="data:image/png;base64,${x.data}"></section>`).join('')}</body>`);
  await page.screenshot({ path:path.join(output,'contact-sheet.png'),fullPage:true });
  console.log(JSON.stringify({ passed:true,types:types.length,layouts:39,output }));
}
main().catch(e => { console.error(e); process.exitCode=1; }).finally(async () => { await browser?.close(); await new Promise(resolve=>server.close(resolve)); });
