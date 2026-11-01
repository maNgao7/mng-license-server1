'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ||
  'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const output = process.env.LEADERBOARD_QA_OUTPUT || path.join(os.tmpdir(), 'tikmng-leaderboard-podium-qa');
const relay = '/overlays/' + 'L'.repeat(43);

// Exercise production event accumulation and its updatedAt tie-breaker in memory.
// Loading main.js itself would start Electron and touch the user's saved profile.
function eventSession() {
  const source = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const context = vm.createContext({
    widgetLeaderboardPool: {}, widgetLikePool: {}, widgetMetaPool: { totalLikes: 0 },
    widgetStoreKey: key => key, store: { set() {} }, widgetEtkinligiEkle() {},
    Date: { now: () => context.tick++ }, tick: 1
  });
  for (const name of ['widgetLeaderboardKaydiEkle', 'widgetLeaderboardDurumu', 'widgetBegeniKaydiEkle', 'widgetBegeniDurumu']) {
    const start = source.indexOf('function ' + name + '(');
    assert.ok(start >= 0, 'Production function exists: ' + name);
    vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), context);
  }
  return context;
}

test('coin and likes podium: production events, browser contracts and screenshot QA', { timeout: 180000 }, async t => {
  let browser, state = { coins: [], likes: [] }, responseStatus = 200, portraits = [];
  const requests = [], errors = [], external = [], captures = [];
  const html = fs.readFileSync(path.join(root, 'renderer/widgets/leaderboard.html'));
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://fixture.test');
    const local = url.pathname.startsWith(relay + '/') ? url.pathname.slice(relay.length) : url.pathname;
    requests.push({ method: req.method, path: url.pathname, local, query: Object.fromEntries(url.searchParams) });
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    if (local === '/widget/leaderboard/state' || local === '/widget/top-likes/state') {
      res.writeHead(responseStatus, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ entries: state[local.includes('top-likes') ? 'likes' : 'coins'], updatedAt: Date.now() }));
      return;
    }
    if (/^\/widget\/gift-assets\/qa-avatar-\d+\.png$/.test(local)) {
      const image = portraits[Number(local.match(/(\d+)\.png$/)[1]) % portraits.length];
      res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(image); return;
    }
    if (local === '/widget/gift-assets/missing.png') { res.writeHead(404); res.end(); return; }
    if (['/widget-leaderboard.html', '/widget/leaderboard', '/widget/leaderboard.html'].includes(local)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); return;
    }
    if (local === '/harness') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><body>'); return; }
    res.writeHead(404); res.end();
  });
  t.after(async () => {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ channel: process.env.WIDGET_QA_BROWSER_CHANNEL || 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 600, height: 540 } });
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/') || url.startsWith('data:')) return route.continue();
    if (url === 'https://avatar.fixture.test/portrait.png') {
      return route.fulfill({ contentType: 'image/png', body: portraits[0] });
    }
    external.push(url); return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/harness');
  portraits = (await page.evaluate(() => Array.from({ length: 10 }, (_, i) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const c = canvas.getContext('2d');
    c.fillStyle = ['#397d76', '#b56f80', '#668eae', '#8f7c5c', '#826997'][i % 5]; c.fillRect(0, 0, 128, 128);
    c.fillStyle = '#22272d'; c.beginPath(); c.ellipse(64, 135, 53, 46, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = ['#e1b495', '#c78d70', '#e8c4a3'][i % 3];
    c.beginPath(); c.ellipse(64, 53, 29, 36, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#342b30'; c.beginPath(); c.ellipse(64, 26, 33, 19, 0, Math.PI, Math.PI * 2); c.fill();
    c.fillRect(52, 52, 4, 4); c.fillRect(73, 52, 4, 4); c.fillRect(58, 70, 12, 2);
    return canvas.toDataURL().split(',')[1];
  }))).map(data => Buffer.from(data, 'base64'));
  const people = ['deniz_oyunda', 'elif.live', 'mert_34', 'zeynep', 'arda', 'selin', 'ipek', 'baris', 'ece', 'cem'];
  const nicknames = ['Deniz', 'Elif', 'Mert', 'Zeynep', 'Arda', 'Selin', 'İpek', 'Barış', 'Ece', 'Cem'];
  function fixture(count = 6) {
    const session = eventSession();
    for (let i = 0; i < count; i++) {
      const person = { username: people[i], nickname: nicknames[i], avatar: '/widget/gift-assets/qa-avatar-' + i + '.png?key=isolated-qa&channel=qa-room' };
      session.widgetLeaderboardKaydiEkle({ ...person, coins: 15840 - i * 1100, count: 2 });
      session.widgetBegeniKaydiEkle({ ...person, likeCount: 32500 - i * 2300 });
    }
    return { coins: session.widgetLeaderboardDurumu().entries, likes: session.widgetBegeniDurumu().entries };
  }
  async function open(type = 'topgifter', extra = '', prefix = '') {
    await page.goto(origin + prefix + '/widget-leaderboard.html?type=' + type + '&channel=qa-room&key=isolated-qa&background=transparent' + extra);
    await page.waitForFunction(() => lastSignature !== '' && !polling);
    await page.waitForFunction(() => [...document.images].every(image => image.complete));
  }
  async function refresh() {
    await page.waitForFunction(() => !polling);
    await page.evaluate(() => refresh());
    await page.waitForFunction(() => [...document.images].every(image => image.complete));
  }
  const names = () => page.locator('[data-rank] .user-name').allTextContents();
  async function layout() {
    const result = await page.evaluate(() => {
      const issues = [], body = document.getElementById('rankingBody');
      const rect = el => el.getBoundingClientRect();
      const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
      const board = rect(body);
      if (body.scrollWidth > body.clientWidth + 1) issues.push('horizontal scroll');
      const header = rect(document.querySelector('.header'));
      if (header.bottom > board.top + 1) issues.push('header overlaps ranking');
      const people = [...document.querySelectorAll('.podium-person')];
      for (const [i, person] of people.entries()) {
        const circle = person.querySelector('.profile-ring'), r = rect(circle);
        if (Math.abs(r.width - r.height) > .5 || getComputedStyle(circle).borderRadius !== '50%') issues.push('noncircular profile');
        for (const other of people.slice(i + 1)) if (overlaps(rect(person), rect(other))) issues.push('podium overlap');
        if (r.left < board.left || r.right > board.right) issues.push('profile outside board');
      }
      const first = document.querySelector('.rank-1 .profile-ring');
      const second = document.querySelector('.rank-2 .profile-ring');
      const third = document.querySelector('.rank-3 .profile-ring');
      if (first && Math.abs((rect(first).left + rect(first).right) / 2 - (board.left + board.right) / 2) > 1) issues.push('winner off center');
      if (second && (rect(second).right >= rect(first).left || rect(second).width >= rect(first).width || rect(second).top <= rect(first).top)) issues.push('second placement');
      if (third && (rect(third).left <= rect(first).right || rect(third).width >= rect(first).width || rect(third).top <= rect(first).top)) issues.push('third placement');
      const list = document.getElementById('rankingList');
      if (people.length && !list.hidden && rect(list).top < Math.max(...people.map(p => rect(p).bottom)) - 1) issues.push('rows overlap podium');
      for (const row of document.querySelectorAll('.rank-card')) {
        const children = [...row.children];
        for (const [i, child] of children.entries()) {
          if (children.slice(i + 1).some(other => overlaps(rect(child), rect(other)))) issues.push('row overlap');
        }
      }
      for (const score of document.querySelectorAll('.score-value')) if (score.scrollWidth > score.clientWidth + 1) issues.push('score overflow');
      for (const surface of [document.documentElement, document.body, document.getElementById('stage'), document.querySelector('.widget'), document.querySelector('.podium')]) {
        if (getComputedStyle(surface).backgroundColor !== 'rgba(0, 0, 0, 0)') issues.push('opaque broadcast surface');
      }
      return issues;
    });
    assert.deepEqual(result, []);
  }
  async function capture(name, contact = false) {
    const screenshot = await page.screenshot({ path: path.join(output, name + '.png'), omitBackground: true });
    const pixels = await page.evaluate(async data => {
      const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const c = canvas.getContext('2d'); c.drawImage(image, 0, 0);
      const corners = [[0, 0], [canvas.width - 1, 0], [0, canvas.height - 1], [canvas.width - 1, canvas.height - 1]];
      const painted = [...c.getImageData(0, 0, canvas.width, canvas.height).data].filter((v, i) => i % 4 === 3 && v > 0).length;
      const portrait = document.querySelector('.rank-1 .avatar-img:not([hidden])');
      const r = portrait?.getBoundingClientRect();
      return { corners: corners.map(([x, y]) => c.getImageData(x, y, 1, 1).data[3]), painted,
        portrait: r ? [...c.getImageData(Math.floor(r.left + r.width / 2), Math.floor(r.top + r.height / 2), 1, 1).data] : null };
    }, screenshot.toString('base64'));
    assert.deepEqual(pixels.corners, [0, 0, 0, 0], name + ': transparent corners');
    assert.ok(pixels.painted > 200, name + ': nonblank render');
    if (pixels.portrait) assert.deepEqual(pixels.portrait, [225, 180, 149, 255], name + ': actual portrait pixels');
    if (contact) captures.push({ name, data: screenshot.toString('base64') });
  }
  fs.mkdirSync(output, { recursive: true });

  await t.test('both modes use the correct endpoint and only server data, including preview URLs', async () => {
    for (const type of ['topgifter', 'topliker']) {
      state = fixture(); const start = requests.length; await open(type);
      const mode = type === 'topliker' ? 'likes' : 'coins';
      assert.equal(await page.locator('body').getAttribute('data-metric'), mode);
      assert.deepEqual(await names(), people.slice(0, 6).map(name => '@' + name));
      assert.equal(await page.locator('.rank-1 .score-value').textContent(), mode === 'likes' ? '32.500' : '15.840');
      const request = requests.slice(start).find(r => r.local.endsWith('/state'));
      assert.equal(request.local, type === 'topliker' ? '/widget/top-likes/state' : '/widget/leaderboard/state');
      assert.equal(request.query.channel, 'qa-room'); assert.equal(request.query.key, 'isolated-qa');
      state = { coins: [], likes: [] }; await open(type, '&preview=1');
      assert.deepEqual(await names(), []); assert.equal(await page.locator('#emptyState').isVisible(), true);
      assert.equal(await page.locator('#podium').isVisible(), false);
    }
  });

  await t.test('actual event accumulation, server tie order and repeated events retain their rank', async () => {
    for (const type of ['topgifter', 'topliker']) {
      const session = eventSession();
      for (const username of ['zeta', 'alpha']) {
        session.widgetLeaderboardKaydiEkle({ username, coins: 100 });
        session.widgetBegeniKaydiEkle({ username, likeCount: 100 });
      }
      state = { coins: session.widgetLeaderboardDurumu().entries, likes: session.widgetBegeniDurumu().entries };
      await open(type); assert.deepEqual(await names(), ['@alpha', '@zeta']);
      session.widgetLeaderboardKaydiEkle({ username: 'zeta', coins: 50, count: 3 });
      session.widgetBegeniKaydiEkle({ username: 'zeta', likeCount: 50 });
      state = { coins: session.widgetLeaderboardDurumu().entries, likes: session.widgetBegeniDurumu().entries };
      assert.equal(state.coins[0].giftCount, 4);
      await page.waitForFunction(() => document.querySelector('.rank-1 .score-value')?.textContent === '150');
      assert.deepEqual(await names(), ['@zeta', '@alpha']);
      assert.equal(await page.locator('.rank-1 .score-value').textContent(), '150');
    }
  });

  await t.test('0/1/2/3/10 users fit desktop, mobile and embedded sizes without overlaps', async () => {
    const sizes = [{ width: 600, height: 540 }, { width: 390, height: 844 }, { width: 320, height: 480 },
      { width: 260, height: 260 }, { width: 480, height: 360 }, { width: 1280, height: 720 }];
    for (const type of ['topgifter', 'topliker']) {
      for (const size of sizes) {
        await page.setViewportSize(size);
        for (const count of [0, 1, 2, 3, 10]) {
          state = fixture(count); await open(type, '&items=10'); await layout();
          assert.equal(await page.locator('[data-rank]').count(), count);
          assert.equal(await page.locator('#rankingList').isVisible(), count > 3);
          if (count === 10) {
            await page.locator('[data-rank="10"]').scrollIntoViewIfNeeded();
            assert.ok(await page.locator('[data-rank="10"]').evaluate(el => {
              const r = el.getBoundingClientRect(), clip = document.getElementById('rankingBody').getBoundingClientRect();
              return r.top >= clip.top - 1 && r.bottom <= clip.bottom + 1;
            }), 'Final row remains reachable within widget');
          }
        }
      }
      for (const size of sizes.slice(0, 4).filter(s => s.width !== 320)) {
        await page.setViewportSize(size); state = fixture(); await open(type); await layout();
        await capture(type + '-' + size.width + 'x' + size.height, size.width !== 260);
      }
      await page.setViewportSize({ width: 390, height: 520 });
      for (const count of [0, 1, 2]) {
        state = fixture(count); await open(type); await layout(); await capture(type + '-' + count + '-users');
      }
    }
  });

  await t.test('polls retain DOM for metadata, refresh nicknames/scores and honor session resets', async () => {
    for (const type of ['topgifter', 'topliker']) {
      const mode = type === 'topliker' ? 'likes' : 'coins';
      state = fixture(); await open(type);
      await page.evaluate(() => { window.previousWinner = document.querySelector('.rank-1'); });
      state[mode][0].updatedAt = 999; await refresh();
      assert.ok(await page.evaluate(() => previousWinner === document.querySelector('.rank-1')), 'Metadata poll retains profiles');
      state[mode][0].nickname = 'Yeni İsim'; await refresh();
      assert.equal(await page.locator('.rank-1 .user-sub').textContent(), 'Yeni İsim');
      state[mode][0][mode === 'likes' ? 'totalLikes' : 'totalCoins'] = 0;
      state[mode][0].coins = 999; await refresh();
      assert.equal(await page.locator('.rank-1 .score-value').textContent(), '0', 'Explicit zero is preserved');
      responseStatus = 503; await refresh();
      assert.equal(await page.locator('[data-rank]').count(), 6, 'Failed request retains last valid state');
      responseStatus = 200;
      const before = state; state = { coins: [], likes: [] }; await refresh();
      assert.equal(await page.locator('[data-rank]').count(), 0);
      state = before; await refresh(); assert.equal(await page.locator('[data-rank]').count(), 6);
    }
  });

  await t.test('missing/broken avatars, long identities, large scores and text escaping', async () => {
    await page.setViewportSize({ width: 260, height: 360 });
    for (const type of ['topgifter', 'topliker']) {
      state = fixture(); const mode = type === 'topliker' ? 'likes' : 'coins';
      state[mode][0].avatar = ''; state[mode][0].nickname = 'İpek';
      state[mode][1].avatar = '/widget/gift-assets/missing.png';
      state[mode][3].avatar = '/widget/gift-assets/missing.png';
      state[mode][2].username = 'very_long_public_username_12345678901234567890';
      state[mode][4].username = '<script>alert(1)</script>" & name';
      state[mode][4].nickname = '<img src=x onerror=alert(1)>';
      for (const person of state[mode]) person[type === 'topliker' ? 'totalLikes' : 'totalCoins'] = 9007199254740991;
      await open(type); await layout();
      assert.equal(await page.locator('.rank-1 .avatar-fallback').textContent(), 'İ');
      assert.ok(await page.locator('.rank-2 img').evaluate(image => image.hidden));
      assert.ok(await page.locator('[data-rank="4"] img').evaluate(image => image.hidden));
      assert.equal(await page.locator('[data-rank="5"] .user-name').textContent(), '@<script>alert(1)</script>" & name');
      assert.equal(await page.locator('#rankingBody script, #rankingBody img[src="x"]').count(), 0);
      assert.equal(await page.locator('.rank-3 .user-name').getAttribute('title'), '@very_long_public_username_12345678901234567890');
      await capture(type + '-missing-long-large');
    }
  });

  await t.test('item limits and customized title/accent/position/scale/opacity are preserved', async () => {
    state = fixture(10);
    for (const [items, expected] of [['3', 3], ['4.9', 4], ['99', 10], ['-1', 3]]) {
      await open('topgifter', '&items=' + items); assert.equal(await page.locator('[data-rank]').count(), expected);
    }
    await open('topliker', '&title=' + encodeURIComponent('<b>Özel Başlık</b>') + '&accent=%2322ccee&scale=80&opacity=65&position=left&offsetX=3&offsetY=4');
    assert.equal(await page.locator('#titleText').textContent(), '<b>Özel Başlık</b>');
    assert.deepEqual(await page.locator('#stage').evaluate(el => [el.style.transform, el.style.opacity, el.style.justifyItems, el.style.translate]),
      ['scale(0.8)', '0.65', 'start', '3px 4px']);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--primary-accent')), '#22ccee');
  });

  await t.test('relay state and protected avatars stay under token, external avatars remain external', async () => {
    await page.setViewportSize({ width: 600, height: 540 });
    for (const type of ['topgifter', 'topliker']) {
      state = fixture(); const mode = type === 'topliker' ? 'likes' : 'coins';
      state[mode][0].avatar = origin + state[mode][0].avatar;
      state[mode][1].avatar = 'https://avatar.fixture.test/portrait.png';
      const start = requests.length; await open(type, '', relay); await layout();
      const localRequests = requests.slice(start).filter(r => r.local.endsWith('/state') || r.local.startsWith('/widget/gift-assets/'));
      assert.ok(localRequests.length >= 6);
      assert.ok(localRequests.every(r => r.path.startsWith(relay + '/') && !('key' in r.query) && r.query.channel === 'qa-room'));
      assert.equal(await page.locator('.rank-2 img').getAttribute('src'), 'https://avatar.fixture.test/portrait.png');
      assert.ok(await page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth)));
      await capture(type + '-relay');
    }
  });

  const sheet = await context.newPage();
  await sheet.setViewportSize({ width: 1040, height: 1050 });
  await sheet.setContent('<!doctype html><style>body{margin:0;padding:24px;background:#202328;color:#fff;font:14px Segoe UI}h1{font-size:20px;margin:0 0 6px}p{color:#bfc7cb;margin:0 0 20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0;min-width:0}figcaption{padding-bottom:8px}.art{height:430px;overflow:hidden;background:repeating-conic-gradient(#282d32 0 25%,#30363b 0 50%) 0 0/24px 24px}.art img{display:block;width:100%;height:430px;object-fit:contain}</style><h1>TikMnG | Circular Leaderboard</h1><p>Isolated synthetic QA fixtures. Transparent desktop and mobile captures.</p><div class="grid">' +
    captures.map(capture => '<figure><figcaption>' + capture.name + '</figcaption><div class="art"><img src="data:image/png;base64,' + capture.data + '"></div></figure>').join('') + '</div>');
  await sheet.screenshot({ path: path.join(output, 'contact-sheet.png'), fullPage: true });
  assert.deepEqual(errors, [], 'No browser script errors');
  assert.deepEqual(external, [], 'No unmocked external requests');
  assert.ok(requests.every(r => r.method === 'GET'), 'No state writes');
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ passed: true, browser: 'Chromium/Chrome', modes: ['coins', 'likes'],
    layoutCases: 60, screenshotCount: 17, errors, external, output }, null, 2));
  t.diagnostic('60 layout cases; production coin/like accumulation and tie order; missing avatars; reset; relay; transparent and painted pixels. Screenshots: ' + output);
});
