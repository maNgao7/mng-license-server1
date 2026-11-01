'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const renderer = path.resolve(__dirname, '../renderer');
const output = process.env.WIDGET_QA_OUTPUT || path.join(os.tmpdir(), 'tikmng-widget-visuals');
const types = ['topgift', 'coinjar', 'topliker', 'topgifter', 'carousel', 'coindrop', 'timer', 'streambuddies', 'likefountain', 'userinfo', 'wheel', 'viewercount', 'tinydiny'];
const baseline = process.argv.includes('--baseline');
let current = {}, browser;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  assert.equal(req.method, 'GET', 'QA must never write settings or send events');
  if (url.pathname === '/api/widget/state') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(current));
    return;
  }
  const relative = url.pathname.startsWith('/widget/gift-assets/') ? url.pathname.replace('/widget/', '')
    : url.pathname.startsWith('/widget/') ? url.pathname.replace('/widget/', 'widgets/') : url.pathname;
  const file = path.resolve(renderer, '.' + path.sep + relative.replace(/^\//, ''));
  if (!file.startsWith(renderer + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end(); return;
  }
  res.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
  res.end(fs.readFileSync(file));
});
async function main() {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 600, height: 440 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const root = `http://127.0.0.1:${server.address().port}`;
  const open = (type, query = 'preview=1') => page.goto(`${root}/widget/overlay.html?type=${type}&${query}`);
  for (const type of types) {
    await open(type);
    await page.waitForTimeout(type === 'coinjar' ? 1800 : 180);
    await page.screenshot({ path: path.join(output, `${baseline ? 'before' : 'seeded'}-${type}.png`), omitBackground: true });
    assert.ok(await page.locator('#stage').textContent() || await page.locator('#stage canvas').count(), `${type}: blank preview`);
  }
  if (!baseline) await verify(page, root, open);
  assert.deepEqual(errors, [], 'No JavaScript errors');
  console.log(JSON.stringify({ passed: true, baseline, widgets: types.length, output }));
}
async function verify(page, root, open) {
  // Deterministic local raster portraits keep the fixture independent of network/accounts.
  const avatars = await page.evaluate(() => Array.from({ length: 8 }, (_, i) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = ['#367c85', '#c16b7c', '#4f7c58', '#7971a6'][i % 4]; ctx.fillRect(0, 0, 96, 96);
    ctx.fillStyle = '#20262e'; ctx.beginPath(); ctx.ellipse(48, 95, 37, 33, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ['#e8b18e', '#bd8060', '#f3c4a6'][i % 3]; ctx.beginPath(); ctx.ellipse(48, 43, 23, 28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#342821'; ctx.beginPath(); ctx.ellipse(48, 25, 25, 16, -.1, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillRect(38, 41, 3, 3); ctx.fillRect(56, 41, 3, 3); ctx.fillRect(44, 57, 10, 2);
    return canvas.toDataURL('image/png');
  }));
  const people = Array.from({ length: 13 }, (_, i) => ({ username: ['deniz_oyunda', 'elif.live', 'mert_34', 'zeynep', 'arda', 'selin', 'can', 'ece'][i % 8] + (i > 7 ? i : ''), nickname: ['Deniz', 'Elif', 'Mert', 'Zeynep', 'Arda', 'Selin', 'Can', 'Ece'][i % 8], avatar: avatars[i % 8], totalCoins: 15840 - i * 1181, totalLikes: 32500 - i * 2371, giftCount: 32 - i }));
  const gift = { ...people[0], id: 'gift-1', type: 'gift', giftName: 'Gul', giftImage: '/widget/gift-assets/5655.png', count: 24, coins: 2400, createdAt: Date.now() };
  const seed = () => ({ channel: 'qa_yayini', stats: { viewerCount: 3712, totalCoins: 12840, totalGifts: 146, totalLikes: 85214 }, topGift: { ...gift }, topGifters: people.map(x => ({ ...x })), topLikes: people.map(x => ({ ...x })), activities: [{ ...gift }, { ...people[1], id: 'like-1', type: 'like', count: 482, createdAt: Date.now() }, { ...people[2], id: 'wheel-1', type: 'chat', message: '!wheel', createdAt: Date.now() }], jarGifts: Array.from({ length: 24 }, (_, i) => ({ ...gift, id: `jar-${i}`, count: 1, giftImage: `/widget/gift-assets/${i % 3 ? '5655' : '6064'}.png` })) });
  current = seed();
  for (const size of [{ width: 600, height: 440 }, { width: 360, height: 300 }]) {
    await page.setViewportSize(size);
    for (const type of types) {
      await open(type, 'preview=1&items=10');
      await page.waitForTimeout(220);
      await page.screenshot({ path: path.join(output, `${size.width}-${type}.png`), omitBackground: true });
      const overflow = await page.locator('#stage').evaluate(stage => [...stage.querySelectorAll('[data-fit]')].filter(el => {
        const b = el.getBoundingClientRect();
        return b.width && b.height && (b.left < -1 || b.top < -1 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1);
      }).map(el => el.className));
      assert.deepEqual(overflow, [], `${type}: visible content must fit ${size.width}x${size.height}`);
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgba(0, 0, 0, 0)', `${type}: OBS background`);
    }
  }
  await page.setViewportSize({ width: 460, height: 680 });
  for (const type of ['topgifter', 'topliker', 'coinjar']) {
    await open(type, 'preview=1&items=10'); await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(output, `tall-${type}.png`), omitBackground: true });
  }
  await page.setViewportSize({ width: 600, height: 440 });
  await open('viewercount', '');
  assert.equal(await page.locator('.viewer-number').textContent(), '3.712');
  current.stats.viewerCount = 0;
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.viewer-number').textContent(), '0', 'A true zero must not become sample/cumulative viewers');
  current.stats.viewerCount = 12;
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.viewer-number').textContent(), '12');
  current = { stats: { viewerCount: 27 }, activities: [], jarGifts: [] };
  await open('viewercount');
  assert.equal(await page.locator('.viewer-number').textContent(), '27', 'Preview must preserve a real viewer count even without events');
  current = seed();
  await open('topgift', '');
  current.topGift.coins = 2501;
  await page.waitForTimeout(1000);
  assert.match(await page.locator('.award-amount').textContent(), /2\.501/, 'topGift-only changes must refresh');
  current.topGift = null;
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.award-amount').count(), 0, 'Reset removes the last award');
  current.topGift = seed().topGift;
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.award-amount').count(), 1, 'Same award can return after reset');
  current = {};
  for (const type of types) {
    await open(type, ''); await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(output, `empty-${type}.png`), omitBackground: true });
    assert.doesNotMatch(await page.locator('#stage').textContent(), /mng_destekci|kalp_yagmuru|128/, `${type}: no invented live data`);
  }
  current = seed();
  current.topGift.username = '<script>alert(1)</script>';
  current.topGift.avatar = '/missing-avatar.png';
  await open('topgift', 'preview=1&accent=%23ff6685&scale=80&opacity=65&position=left&offsetX=3&offsetY=4');
  assert.equal(await page.locator('#stage script').count(), 0);
  assert.match(await page.locator('#stage').textContent(), /<script>/);
  const style = await page.locator('#stage').evaluate(el => ({ opacity: el.style.opacity, transform: el.style.transform, translate: el.style.translate, justify: el.style.justifyItems }));
  assert.deepEqual(style, { opacity: '0.65', transform: 'scale(0.8)', translate: '3px 4px', justify: 'start' });
  await page.screenshot({ path: path.join(output, 'customization.png'), omitBackground: true });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  current = seed();
  await open('wheel', 'segments=A%0AB%0AC%0AD&wheelColors=%23ffffff,%23000000');
  await page.waitForTimeout(5500);
  assert.equal(await page.locator('.wheel-result').evaluate(el => getComputedStyle(el).opacity), '1');
  await page.screenshot({ path: path.join(output, 'wheel-result-motion.png'), omitBackground: true });
  const wheelCount = await page.locator('.wheel').evaluate(el => el.getAnimations().length);
  current.stats.totalCoins++;
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.wheel').evaluate(el => el.getAnimations().length), wheelCount, 'Unrelated stats must not restart the wheel');
  await open('coinjar', 'preview=1&capacity=20&giftSize=38&jarTint=%23ff6685');
  await page.waitForTimeout(4000);
  const pixels = await page.locator('.physics-jar canvas').evaluate(canvas => [...canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data].filter((_, i) => i % 4 === 3).some(a => a > 0));
  assert.ok(pixels, 'Physics canvas must render gift pixels');
  await page.screenshot({ path: path.join(output, 'jar-motion.png'), omitBackground: true });
  console.log('Verified populated/empty layouts, exact viewers, award updates/reset, escaping, customization, wheel and physics.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); server.close(); });
