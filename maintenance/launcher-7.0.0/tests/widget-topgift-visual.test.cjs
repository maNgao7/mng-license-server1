'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');

test('Viral Benim keeps transparent circular artwork, tiers and its animation clock', { timeout: 90000 }, async t => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE ||
    'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const root = path.resolve(__dirname, '../renderer');
  const output = process.env.TOPGIFT_QA_OUTPUT || path.join(os.tmpdir(), 'tikmng-topgift-premium');
  const relay = '/overlays/' + 'a'.repeat(43);
  let state = {}, browser, origin;
  const errors = [], external = [], captures = [];
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    const url = new URL(req.url, 'http://fixture.test');
    const local = url.pathname.startsWith(relay) ? url.pathname.slice(relay.length) : url.pathname;
    if (local === '/api/widget/state') {
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(state)); return;
    }
    const relative = local === '/widget-overlay.html' ? 'widgets/overlay.html' :
      local.replace(/^\/widget\/gift-assets\//, 'gift-assets/');
    const file = path.resolve(root, relative.replace(/^\//, ''));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    res.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8');
    res.end(fs.readFileSync(file));
  });
  t.after(async () => {
    await browser?.close(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: process.env.WIDGET_QA_BROWSER_CHANNEL || 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 600, height: 440 } });
  await context.route('**/*', route => {
    if (route.request().url().startsWith(origin + '/') || route.request().url().startsWith('data:')) return route.continue();
    external.push(route.request().url()); return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/widget-overlay.html?type=topgift');
  const portrait = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = c.height = 192;
    const x = c.getContext('2d');
    x.fillStyle = '#3b7a87'; x.fillRect(0, 0, 192, 192);
    x.fillStyle = '#22272d'; x.beginPath(); x.ellipse(96, 198, 78, 68, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#e1b495'; x.beginPath(); x.ellipse(96, 78, 44, 55, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#342b30'; x.beginPath(); x.ellipse(96, 39, 49, 30, 0, Math.PI, Math.PI * 2); x.fill();
    x.fillRect(78, 75, 5, 5); x.fillRect(110, 75, 5, 5); x.fillRect(88, 102, 17, 3);
    return c.toDataURL();
  });
  async function transparentCorners(screenshot) {
    return page.evaluate(async data => {
      const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
      const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
      const x = c.getContext('2d'); x.drawImage(image, 0, 0);
      return [[0,0],[c.width-1,0],[0,c.height-1],[c.width-1,c.height-1]].every(([a,b]) => x.getImageData(a,b,1,1).data[3] === 0);
    }, screenshot.toString('base64'));
  }
  function fixture(coins = 16000, username = 'deniz_oyunda') {
    return { stats: { viewerCount: 128 }, topGift: { id: 'award-1', username, nickname: 'Deniz', avatar: portrait,
      giftName: 'Kristal Taç', giftImage: '/widget/gift-assets/13447.png', count: 8, coins } };
  }
  async function open(extra = '', prefix = '') {
    await page.goto(`${origin}${prefix}/widget-overlay.html?type=topgift${extra}`);
    await page.waitForFunction(() => document.querySelector('.flip-award'));
    await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth));
  }
  async function pose(time = 1000) {
    await page.evaluate(time => document.getAnimations().forEach(a => { a.pause(); a.currentTime = time; }), time);
  }
  async function bounds() {
    return page.evaluate(() => [...document.querySelectorAll('.flip-award,.award-emblem,.award-username,.award-footer')].filter(el => {
      const b = el.getBoundingClientRect();
      return b.left < -1 || b.top < -1 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1 ||
        (el.classList.contains('award-username') && el.scrollWidth > el.clientWidth + 1);
    }).map(el => el.className));
  }
  for (const [coins, tier] of [[0,1],[99,1],[100,2],[999,2],[1000,3],[9999,3],[10000,4],[16000,4]]) {
    state = fixture(coins); await open();
    assert.equal(await page.locator('.flip-award').getAttribute('data-tier'), String(tier));
    assert.equal(await page.locator('.flip-award').getAttribute('data-coins'), String(coins));
    assert.equal(await page.locator('.award-flame').count(), tier >= 3 ? 12 : 0);
  }
  for (const size of [{width:600,height:440},{width:360,height:300},{width:260,height:260},{width:460,height:680}]) {
    await page.setViewportSize(size);
    for (const coins of [50,500,2500,16000]) {
      state = fixture(coins); await open(); await pose();
      assert.deepEqual(await bounds(), [], `Award fits ${size.width}x${size.height} at ${coins} coins`);
      const surfaces = await page.locator('body,#stage,.flip-award').evaluateAll(els => els.map(el => {
        const s = getComputedStyle(el); return [s.backgroundColor, s.backgroundImage];
      }));
      assert.ok(surfaces.every(([color, image]) => color === 'rgba(0, 0, 0, 0)' && image === 'none'), 'No opaque broadcast surface');
      const file = path.join(output, `${size.width}-tier-${await page.locator('.flip-award').getAttribute('data-tier')}.png`);
      const screenshot = await page.screenshot({ path: file, omitBackground: true });
      assert.ok(await transparentCorners(screenshot), 'Broadcast screenshot corners have zero alpha');
      if (size.width === 600) captures.push({ coins, data: screenshot.toString('base64') });
    }
  }
  await page.setViewportSize({ width: 360, height: 340 });
  state = fixture(16000, 'full_readable_username_1234567890'); await open(); await pose();
  assert.deepEqual(await bounds(), [], 'Full username wraps instead of truncating');
  assert.equal(await page.locator('.award-username').evaluate(el => getComputedStyle(el).whiteSpace), 'normal');
  await page.screenshot({ path: path.join(output, 'long-username.png'), omitBackground: true });
  await page.setViewportSize({ width: 600, height: 440 });
  state = fixture(); await open();
  const circle = await page.locator('.flip-face.profile-face').evaluate(el => {
    const b = el.getBoundingClientRect(), s = getComputedStyle(el);
    return { width:el.clientWidth, height:el.clientHeight, radius:s.borderRadius, backface:s.backfaceVisibility };
  });
  assert.equal(circle.width, circle.height);
  assert.equal(circle.radius, '50%'); assert.equal(circle.backface, 'hidden');
  await page.waitForFunction(() => document.querySelector('.flip-surface').getAnimations()[0]?.startTime !== null &&
    typeof document.querySelector('.flip-surface').getAnimations()[0]?.startTime === 'number');
  await page.evaluate(() => {
    window.__award = document.querySelector('.flip-award');
    window.__flip = document.querySelector('.flip-surface').getAnimations()[0];
    window.__start = window.__flip.startTime;
  });
  state.stats.viewerCount++; state.topGift.updatedAt = 2;
  await page.waitForTimeout(1000);
  assert.ok(await page.evaluate(() => window.__award === document.querySelector('.flip-award') &&
    window.__flip === document.querySelector('.flip-surface').getAnimations()[0] && window.__flip.startTime === window.__start),
  'Stats and metadata polling preserve the existing flip and animation start');
  state.topGift.count = 9; state.topGift.coins = 18000;
  await page.waitForFunction(() => document.querySelector('.flip-award')?.dataset.coins === '18000');
  assert.ok(await page.evaluate(() => window.__award !== document.querySelector('.flip-award')), 'Contribution change refreshes award');
  state.topGift.username = 'elif.live';
  await page.waitForFunction(() => document.querySelector('.award-username')?.textContent === '@elif.live');
  await pose(6000);
  assert.ok(await page.locator('.flip-surface').evaluate(el => getComputedStyle(el).transform.startsWith('matrix3d(')), 'Gift back rotates into view');
  assert.ok(await page.locator('.gift-face img').evaluate(el => el.clientWidth >= el.parentElement.clientWidth * .75), 'Gift fills its circular face');
  await page.screenshot({ path: path.join(output, 'gift-back.png'), omitBackground: true });
  const back = await page.screenshot({ omitBackground: true });
  captures.push({ coins: 18000, data: back.toString('base64') });
  state = fixture(); await open('', relay);
  assert.ok(await page.locator('.gift-face img').evaluate(el => new URL(el.src).pathname.startsWith('/overlays/')), 'Gift uses existing relay URL helper');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.flip-surface').evaluate(el => el.getAnimations().length), 0);
  await page.screenshot({ path: path.join(output, 'reduced-motion.png'), omitBackground: true });
  state = fixture(1000, '<script>alert(1)</script>'); await open();
  assert.equal(await page.locator('#stage script').count(), 0);
  assert.equal(await page.locator('.award-username').textContent(), '@<script>alert(1)</script>');
  state = { stats: {}, topGift: null };
  await page.waitForFunction(() => !document.querySelector('.flip-award'));
  assert.equal(await page.locator('#stage').textContent(), '', 'Empty live broadcast is transparent and blank');
  state = fixture();
  await page.waitForFunction(() => document.querySelector('.flip-award'));
  assert.equal(await page.locator('.flip-surface').count(), 1, 'Same award returns after reset');
  const sheet = await context.newPage(); await sheet.setViewportSize({ width:1248, height:760 });
  await sheet.setContent(`<style>body{margin:0;padding:18px;background:#171e25;color:white;font:14px Segoe UI}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.art{background:repeating-conic-gradient(#202c36 0 25%,#1c2630 0 50%) 0 0/24px 24px}.art img{width:100%;display:block}h1{font-size:20px}small{display:block;padding:12px}</style><h1>Viral Benim · Circular Broadcast Award</h1><div class="grid">${captures.map(x => `<div><small>${x.coins.toLocaleString('tr-TR')} coin</small><div class="art"><img src="data:image/png;base64,${x.data}"></div></div>`).join('')}</div>`);
  await sheet.screenshot({ path: path.join(output, 'contact-sheet.png'), fullPage: true });
  assert.deepEqual(errors, [], 'No browser script errors'); assert.deepEqual(external, [], 'No external actions or resources');
  t.diagnostic('Tier boundaries, 16 layouts, transparent surfaces, both faces, animation retention, relay, reset and reduced motion passed. Screenshots: ' + output);
});
