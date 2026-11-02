'use strict';

// Contract: the relay strips /overlays/<43-char token>, injects local auth/channel,
// and forwards read-only widget paths. HTML is served byte-for-byte without rewriting.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../renderer');
const widgetFiles = ['overlay.html', 'top-gift.html', 'top-likes.html', 'leaderboard.html', 'gift-feed.html', 'activity.html'];
const base = '/overlays/' + 'Ab_9-'.repeat(8) + 'XyZ';
const publicOrigin = 'https://ownedhost.test';
const query = 'channel=fixture-room&v=a%2Fb';
const protectedGift = '/widget/gift-assets/animated.gif?key=synthetic-local-only&' + query;
const output = process.env.WIDGET_RELAY_QA_OUTPUT || path.join(os.tmpdir(), 'tikmng-widget-relay-qa');

function helperSource(file) {
  const html = fs.readFileSync(path.join(root, 'widgets', file), 'utf8');
  const start = html.indexOf('const overlayBase=');
  const end = html.indexOf('\n}', html.indexOf('function widgetImageURL(value){', start)) + 2;
  assert.ok(start >= 0 && end > start, file + ': inline URL helpers');
  return html.slice(start, end);
}

function helpers(file, pathname, origin = publicOrigin) {
  const context = vm.createContext({ location: { pathname, origin, href: origin + pathname }, URL });
  vm.runInContext(helperSource(file), context);
  return context;
}

test('every widget keeps local URLs and narrowly prefixes public widget resources', () => {
  const source = helperSource(widgetFiles[0]);
  const paths = ['/api/widget/state', '/widget/state', '/widget/top-gift/state', '/widget/top-likes/state',
    '/widget/leaderboard/state', '/api/widget/activity/state', '/widget/activity/state',
    '/api/widget/top-gift/state', '/api/widget/top-likes/state', '/api/widget/leaderboard/state',
    '/widget/vendor/matter.js', '/widget/physical-jar.js', '/assets/widgets/glass-gift-jar.png',
    '/widget/gift-assets/5655.png', '/widget/gift-assets/animated.gif', '/widget/gift-assets/gift-a.webp'];
  for (const file of widgetFiles) {
    assert.equal(helperSource(file), source, file + ': consistent allowlist');
    const local = helpers(file, '/widget-' + file);
    const relay = helpers(file, base + '/widget-' + file);
    for (const resource of paths) {
      const input = resource + '?key=synthetic-local-only&' + query + '#image';
      assert.equal(local.prefixURL(input), input, file + ': local path/auth preserved');
      const expected = base + resource + '?' + query + '#image';
      assert.equal(relay.prefixURL(input), expected, file + ': public path without local key');
      assert.equal(relay.prefixURL(expected), expected, file + ': no duplicate prefix');
    }
    for (const input of ['/api/widget/gift', '/api/widget/like', '/api/accounts', '/widget/gift-assets/evil.js',
      '/widget/gift-assets/nested/gift.png', '//cdn.test/widget/gift-assets/a.png',
      '/\\cdn.test/widget/gift-assets/a.png', '/\n/widget/state', 'widget/state',
      publicOrigin + '/widget/state', 'https://cdn.test/widget/gift-assets/a.png',
      '/overlays/' + 'z'.repeat(43) + '/widget/state', 'data:image/gif;base64,R0lGODlh']) {
      assert.equal(relay.prefixURL(input), input, file + ': outside root-relative widget allowlist');
    }
    const expectedGift = base + '/widget/gift-assets/animated.gif?' + query;
    for (const prefix of ['', 'http://127.0.0.1:19876', 'http://localhost:19876', 'http://[::1]:19876', publicOrigin]) {
      assert.equal(relay.widgetImageURL(prefix + protectedGift), expectedGift, file + ': protected gift image');
      assert.equal(local.widgetImageURL(prefix + protectedGift), prefix + protectedGift, file + ': local gift unchanged');
    }
    for (const input of ['https://cdn.test' + protectedGift, 'http://localhost.evil.test' + protectedGift,
      'http://127.0.0.1:19876/avatar.png', 'http://localhost/widget/gift-assets/evil.js',
      'http://user:pass@localhost' + protectedGift, '//localhost' + protectedGift,
      'data:image/gif;base64,R0lGODlh', 'blob:https://ownedhost.test/example']) {
      assert.equal(relay.widgetImageURL(input), input, file + ': unrelated image unchanged');
    }
    for (const token of ['a'.repeat(42), 'a'.repeat(44), 'a'.repeat(42) + '.', 'a'.repeat(43) + 'tail']) {
      assert.equal(helpers(file, '/overlays/' + token + '/widget-overlay.html').prefixURL('/api/widget/state'), '/api/widget/state');
    }
    assert.equal(helpers(file, base).prefixURL('/api/widget/state'), '/api/widget/state', 'token requires a following slash');
  }
});

// Two opaque 1px frames, red and green, at 100ms each. Canvas pixel checks prove
// that GIF artwork is decoded and drawn, rather than only the fallback marker.
const gif = Buffer.from([
  ...Buffer.from('GIF89a'), 1, 0, 1, 0, 0x80, 0, 0, 255, 0, 0, 0, 255, 0,
  0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0,
  0x21, 0xf9, 4, 0, 10, 0, 0, 0, 0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 1, 0,
  0x21, 0xf9, 4, 0, 10, 0, 0, 0, 0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x4c, 1, 0, 0x3b
]);

test('real browser frames load state, public assets and the GIF physics jar at root and relay paths', { timeout: 90000 }, async t => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE ||
    'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  let state = {}, browser, origin;
  const requests = [], errors = [], escapes = [];
  const files = new Map(widgetFiles.flatMap(file => [
    ['/widget-' + file, path.join(root, 'widgets', file)],
    ['/widget/' + file, path.join(root, 'widgets', file)]
  ]));
  files.set('/widget/vendor/matter.js', path.join(root, 'widgets/vendor/matter.js'));
  files.set('/widget/physical-jar.js', path.join(root, 'widgets/physical-jar.js'));
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://fixture.test');
    const isPublic = url.pathname.startsWith(base + '/');
    const localPath = isPublic ? url.pathname.slice(base.length) : url.pathname;
    requests.push({ isPublic, path: localPath, query: new URLSearchParams(url.search), method: req.method });
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    if (localPath === '/harness') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><body style="margin:0;background:#222">'); return;
    }
    if (/^\/(?:api\/)?widget\/(?:state|(?:top-gift|top-likes|leaderboard|activity)\/state)$/.test(localPath)) {
      res.setHeader('Content-Type', 'application/json');
      const data = localPath.endsWith('/top-gift/state') ? { top: state.topGift } :
        /\/(top-likes|leaderboard)\/state$/.test(localPath) ? { entries: state.topLikes } :
          localPath.endsWith('/activity/state') ? { entries: state.activities } : state;
      res.end(JSON.stringify(data)); return;
    }
    if (localPath.startsWith('/widget/gift-assets/')) {
      res.setHeader('Content-Type', 'image/gif'); res.end(gif); return;
    }
    const file = files.get(localPath);
    if (!file) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
    res.end(fs.readFileSync(file));
  });
  t.after(async () => {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ channel: process.env.WIDGET_QA_BROWSER_CHANNEL || 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 620, height: 470 } });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.isNavigationRequest() && url.pathname === '/favicon.ico') return route.abort();
    if (url.origin === publicOrigin) {
      if (url.pathname !== '/harness' && !url.pathname.startsWith(base + '/')) {
        escapes.push('unprefixed public resource'); return route.abort();
      }
      return route.fulfill({ response: await route.fetch({ url: origin + url.pathname + url.search }) });
    }
    if (url.hostname === 'cdn.test') return route.fulfill({ contentType: 'image/gif', body: gif });
    const frame = request.frame();
    if (frame.url().startsWith(publicOrigin) || frame.parentFrame()?.url().startsWith(publicOrigin)) {
      escapes.push('public frame requested loopback or unrelated origin'); return route.abort();
    }
    if (url.origin === origin) return route.continue();
    if (url.hostname === 'localhost' && url.port === String(server.address().port)) {
      return route.fulfill({ response: await route.fetch({ url: origin + url.pathname + url.search }) });
    }
    escapes.push('unexpected external request'); return route.abort();
  });
  function fixture(variant = 0) {
    const images = [protectedGift, origin + protectedGift, 'http://localhost:' + server.address().port + protectedGift];
    const people = Array.from({ length: 5 }, (_, i) => ({ username: 'fixture_user_' + i, nickname: 'Fixture ' + i,
      avatar: i === 0 ? 'https://cdn.test/avatar.gif' : protectedGift, totalCoins: 4321 - i, totalLikes: 5432 - i }));
    const gift = { ...people[0], id: 'gift-' + variant, type: 'gift', giftImage: images[variant % images.length],
      giftName: 'Fixture GIF', count: 1, coins: 4321 + variant, updatedAt: variant + 1, createdAt: Date.now() };
    return { channel: 'fixture-room', stats: { viewerCount: 128, totalCoins: gift.coins, totalGifts: 1 },
      topGift: gift, topGifters: people, topLikes: people, activities: [gift], ranking: people, jarGifts: [gift] };
  }
  async function openFrame(file, isPublic, extra = '') {
    const page = await context.newPage();
    page.on('pageerror', () => errors.push(file + ': browser script error'));
    const targetOrigin = isPublic ? publicOrigin : origin;
    await page.goto(targetOrigin + '/harness');
    const localAuth = isPublic ? '' : '&key=synthetic-local-only';
    const target = targetOrigin + (isPublic ? base : '') + '/widget-' + file + '?channel=fixture-room' + localAuth + extra;
    await page.evaluate(url => {
      const iframe = document.createElement('iframe');
      iframe.width = '600'; iframe.height = '440'; iframe.style.border = '0'; iframe.src = url; document.body.append(iframe);
    }, target);
    const frame = await (await page.$('iframe')).contentFrame();
    await frame.waitForURL(target);
    await frame.waitForFunction(() => document.body.textContent.includes('fixture_user_0'));
    await frame.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
    return { page, frame };
  }
  const endpoints = ['/api/widget/state', '/widget/top-gift/state', '/widget/top-likes/state',
    '/widget/leaderboard/state', '/api/widget/activity/state', '/api/widget/activity/state'];
  fs.mkdirSync(output, { recursive: true });
  for (const isPublic of [false, true]) {
    for (const [index, file] of widgetFiles.entries()) {
      state = fixture(index % 3);
      const start = requests.length;
      const { page, frame } = await openFrame(file, isPublic, file === 'overlay.html' ? '&type=topgift' : '');
      assert.ok(requests.slice(start).some(r => r.isPublic === isPublic && r.path === endpoints[index]), file + ': state endpoint');
      if (isPublic) {
        assert.ok(await frame.locator('img').evaluateAll(imgs => imgs.every(img =>
          img.src.startsWith('https://cdn.test/') || (new URL(img.src).pathname.startsWith('/overlays/') && !new URL(img.src).searchParams.has('key')))), file + ': prefixed images without local key');
      }
      const next = fixture((index % 3) + 3);
      next.topGift.username = 'fixture_updated'; next.activities[0].username = 'fixture_updated'; next.topLikes[0].username = 'fixture_updated';
      state = next;
      await frame.waitForFunction(() => document.body.textContent.includes('fixture_updated'));
      await page.close();
    }
    for (const variant of [0, 1, 2]) {
      state = fixture(variant);
      // The jar intentionally renders no username; wait for its real state total.
      const page = await context.newPage();
      page.on('pageerror', () => errors.push('coinjar: browser script error'));
      const targetOrigin = isPublic ? publicOrigin : variant === 2 ? origin.replace('127.0.0.1', 'localhost') : origin;
      await page.goto(targetOrigin + '/harness');
      const target = targetOrigin + (isPublic ? base : '') + '/widget-overlay.html?type=coinjar&channel=fixture-room' + (isPublic ? '' : '&key=synthetic-local-only');
      await page.evaluate(url => { const el = document.createElement('iframe'); el.width = '600'; el.height = '440'; el.src = url; document.body.append(el); }, target);
      const frame = await (await page.$('iframe')).contentFrame();
      await frame.waitForURL(target);
      await frame.waitForFunction(() => document.querySelector('.physics-jar-total')?.textContent.includes('4.32'));
      const pixels = () => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return { colored: 0, y: 0 };
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let colored = 0, y = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 200 && ((data[i] > 230 && data[i + 1] < 20 && data[i + 2] < 20) ||
            (data[i + 1] > 230 && data[i] < 20 && data[i + 2] < 20))) { colored++; y += Math.floor(i / 4 / canvas.width); }
        }
        return { colored, y: colored ? y / colored : 0 };
      };
      await frame.waitForFunction(new Function('return (' + pixels.toString() + ')().colored > 100'));
      const first = await frame.evaluate(pixels);
      await page.waitForTimeout(250);
      const second = await frame.evaluate(pixels);
      assert.ok(second.colored > 100 && second.y > first.y + 2, 'GIF artwork falls in the physics canvas');
      assert.deepEqual(await frame.locator('script[src]').evaluateAll(scripts => scripts.map(s => new URL(s.src).pathname)),
        ['/widget/vendor/matter.js', '/widget/physical-jar.js'].map(p => (isPublic ? base : '') + p), 'ordered dynamic script loader');
      await frame.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
      if (variant === 0) await page.screenshot({ path: path.join(output, (isPublic ? 'relay' : 'root') + '-gif-jar.png') });
      state.stats.totalCoins = 9876;
      await frame.waitForFunction(() => document.querySelector('.physics-jar-total')?.textContent.includes('9.876'));
      await page.close();
    }
  }
  assert.ok(requests.filter(r => r.isPublic && r.path.startsWith('/widget/gift-assets/')).length > 0, 'public gift assets requested');
  assert.ok(requests.filter(r => r.isPublic).every(r => !r.query.has('key')), 'no local key in any public state or asset request');
  assert.ok(requests.every(r => r.method === 'GET'), 'read-only browser requests');
  assert.deepEqual(errors, [], 'no frame script errors');
  assert.deepEqual(escapes, [], 'no public resources escape the relay prefix');
  t.diagnostic('12 live widget frames and 6 GIF jar frames passed; screenshots: ' + output);
});
