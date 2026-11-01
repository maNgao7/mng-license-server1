'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { gunzipSync } = require('node:zlib');
const baseline = require('./qa-delta-traffic.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'qa/714');
const RELAY_ROOT = process.env.DELTA_QA_RELAY_ROOT || 'D:/TikMnG-Release-7.0.0-source';
const clone = value => JSON.parse(JSON.stringify(value));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function loopback(value) {
  const url = new URL(value);
  assert.ok(['http:', 'ws:'].includes(url.protocol) && url.hostname === '127.0.0.1' && !url.username && !url.password,
    'Only loopback HTTP/WebSocket requests are permitted');
  return url;
}

async function eventually(check, message, timeout = 5000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) { if (await check()) return; await pause(15); }
  assert.fail(message);
}

function record(name, result) {
  assert.match(name, /^traffic714-[a-z-]+\.json$/);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(result, null, 2) + '\n');
}

async function runBaseline({ browser = true } = {}) {
  const fixture = await baseline.createFixture();
  try {
    const workload = baseline.buildWorkload({ steps: 100 });
    assert.deepEqual(baseline.buildWorkload({ steps: 100 }), workload);
    const result = {
      passed: true, at: new Date().toISOString(), synthetic: true, productionRequests: 0,
      measurement: 'Actual loopback HTTP encoded response body bytes and WebSocket JSON application-message bytes. Excludes HTTP/TCP/TLS/WebSocket framing, provider billing rules and real user workloads; no invoice guarantee.',
      traffic: await baseline.runHttpComparison(fixture, workload),
      recovery: await baseline.runHttpRecovery(fixture)
    };
    if (browser) result.chrome = await baseline.runBrowserVerification(fixture);
    result.webSocketConnections = fixture.websocket.connections;
    record('traffic714-baseline.json', result);
    return result;
  } finally { await fixture.close(); }
}

function buildOversizeWorkload() {
  const workload = baseline.buildWorkload({ steps: 8 });
  const paddingBytes = 750 * 1024 - Buffer.byteLength(JSON.stringify({ ...workload.frames[0].state, qaUnchangedContext: '' }));
  const context = Array.from({ length: Math.ceil(paddingBytes / 64) }, (_, i) => hash('traffic714-oversize:' + i)).join('').slice(0, paddingBytes);
  for (const frame of workload.frames) frame.state.qaUnchangedContext = context;
  return workload;
}

async function runOversize({ browser: measureBrowser = true } = {}) {
  const fixture = await baseline.createFixture();
  let browser, result;
  try {
    const workload = buildOversizeWorkload(), sizes = workload.frames.map(frame => Buffer.byteLength(JSON.stringify(frame.state)));
    assert.equal(sizes[0], 750 * 1024);
    result = { passed: true, at: new Date().toISOString(), synthetic: true, productionRequests: 0, browserVerified: false,
      measurement: 'Actual loopback HTTP encoded response bodies. Deterministic opaque unchanged context creates a roughly 750 KiB snapshot; not a production invoice estimate.',
      sourceHashes: { delta: hash(fs.readFileSync(path.join(ROOT, 'lib/widget-delta.cjs'))), transport: hash(fs.readFileSync(path.join(ROOT, 'renderer/widgets/change-transport.js'))) },
      snapshotJsonBytes: { min: Math.min(...sizes), max: Math.max(...sizes) },
      traffic: await baseline.runHttpComparison(fixture, workload) };
    record('traffic714-oversize-http.json', result);
    if (!measureBrowser) return result;
    browser = await loadChromium().launch({ channel: process.env.WIDGET_QA_BROWSER_CHANNEL || 'chrome', headless: true,
      args: ['--disable-background-networking', '--disable-component-update', '--proxy-server=' + fixture.publisherOrigin, '--proxy-bypass-list=127.0.0.1'] });
    const page = await browser.newPage(), external = [], errors = [];
    page.on('request', req => { const url = new URL(req.url()); if (['http:', 'https:'].includes(url.protocol) && url.origin !== fixture.relayOrigin) external.push(req.url()); });
    page.on('pageerror', error => errors.push(error.message));
    fixture.resetHistory(); fixture.setState(workload.frames[0].state);
    await page.goto(fixture.publicBase + '/widget-overlay.html?qa=probe');
    const start = fixture.responses.length;
    for (const frame of workload.frames) {
      fixture.setState(frame.state);
      assert.deepEqual(baseline.snapshotOnly(await page.evaluate(() => window.qa.next())), frame.state);
    }
    const deliveries = await page.evaluate(() => window.qa.deliveries), responses = fixture.responses.slice(start);
    result.chrome = { browser: await browser.version(), exactSnapshots: workload.frames.length, uniqueGiftIds: deliveries.length,
      duplicateGiftDispatches: deliveries.length - new Set(deliveries).size, patchResponses: responses.filter(row => row.kind === 'patch').length,
      externalRequests: external, errors };
    assert.deepEqual([...deliveries].sort(), [...workload.eventIds].sort());
    assert.equal(deliveries.length, new Set(deliveries).size);
    assert.ok(responses.some(row => row.kind === 'patch'), 'Chrome must retain and negotiate deltas for snapshots over 512 KiB');
    assert.deepEqual(external, []); assert.deepEqual(errors, []);
    result.browserVerified = true;
    record('traffic714-oversize.json', result); return result;
  } catch (error) {
    record('traffic714-oversize-failure.json', { ...result, passed: false, at: new Date().toISOString(), error: error.stack }); throw error;
  } finally { await browser?.close(); await fixture.close(); }
}

function loadChromium() {
  for (const name of [process.env.DELTA_QA_PLAYWRIGHT, 'playwright', path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) {
    try { return require(name).chromium; } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error('Playwright is required for real Chrome QA');
}

function documentHTML() {
  const scripts = ['state-patch.js', 'change-transport.js'].map(name => '<script>' + fs.readFileSync(path.join(ROOT, 'renderer/widgets', name), 'utf8') + '</script>').join('');
  let html = fs.readFileSync(path.join(ROOT, 'renderer/widgets/reference-widgets.html'), 'utf8')
    .replace(/<script(?=[\s>])/, scripts + '<script')
    .replace('/*PORTRAIT_FRAME_CATALOG*/[]', JSON.stringify(require('../lib/portrait-frames.cjs').frames));
  const manifest = path.join(ROOT, 'lib/champion-art.json');
  if (fs.existsSync(manifest)) html = html.replace('/*CHAMPION_ART*/{}', fs.readFileSync(manifest, 'utf8').trim());
  return html;
}

function assetFile(name) {
  return path.join(ROOT, /^viral-/.test(name) ? 'renderer/widgets/royal-assets' : 'renderer/gift-assets', name);
}

async function createCustomFixture() {
  const { createWidgetChanges } = require('../lib/widget-changes.cjs');
  const { createOverlayBridge } = require('../lib/overlay-bridge.cjs');
  const [{ default: express }, { registerOverlayRelay }, { createHttpTraffic }] = await Promise.all([
    import(pathToFileURL(path.join(RELAY_ROOT, 'node_modules/express/index.js')).href),
    import(pathToFileURL(path.join(RELAY_ROOT, 'overlay-relay.js')).href),
    import(pathToFileURL(path.join(RELAY_ROOT, 'http-traffic.js')).href)
  ]);
  const key = 'isolated-traffic714', resources = [], sockets = new Set(), requests = [], responses = [];
  const websocket = { connections: 0, sentFrameBytes: 0, receivedFrameBytes: 0 };
  const traffic = createHttpTraffic(), app = express(); app.use(traffic.middleware);
  const relay = registerOverlayRelay(app, { secret: crypto.randomBytes(32), authorize: () => ({ ownerId: 'isolated-traffic714' }) });
  let current = baseline.buildWorkload().frames[0].state, feed = createWidgetChanges({ interval: 10, waitMs: 90 }), bridge, closed = false;
  async function listen(server) {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    resources.push(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    return 'http://127.0.0.1:' + server.address().port;
  }
  async function close() {
    if (closed) return; closed = true; feed.close(); bridge?.close();
    for (const socket of sockets) socket.terminate();
    await relay.close();
    for (const cleanup of resources.reverse()) await cleanup();
  }
  try {
    const relayServer = http.createServer(app); relay.attach(relayServer);
    const relayOrigin = await listen(relayServer);
    const publisher = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const entry = { path: url.pathname, query: Object.fromEntries([...url.searchParams].filter(([name]) => name !== 'key')), bytes: 0, status: 0 };
      requests.push(entry);
      res.setHeader('Cache-Control', 'no-store');
      const end = res.end;
      res.end = function (body, ...args) {
        entry.bytes = body ? Buffer.byteLength(body) : 0; entry.status = res.statusCode;
        if (body && /\/widget\/state$/.test(url.pathname)) {
          const value = JSON.parse(body.toString());
          responses.push({ kind: value.__statePatch ? 'patch' : 'full', bytes: entry.bytes, query: entry.query });
        }
        return end.call(this, body, ...args);
      };
      if (url.searchParams.get('key') !== key) { res.writeHead(403); res.end(); return; }
      if (url.pathname === '/api/widget/state') {
        if (feed.handle(req, res, url, () => clone(current))) return;
        res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(current)); return;
      }
      if (url.pathname === '/widget-overlay.html') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(documentHTML()); return;
      }
      const moduleRequest = url.pathname === '/widget/champion-motion.js';
      const assetRequest = /^\/widget\/gift-assets\/[A-Za-z0-9_-]+\.(?:png|webp)$/.test(url.pathname);
      if (moduleRequest || assetRequest) {
        const file = moduleRequest ? path.join(ROOT, 'renderer/widgets/champion-motion.js') : assetFile(path.basename(url.pathname));
        if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
        const body = fs.readFileSync(file), sha = hash(body);
        const immutable = moduleRequest ? url.searchParams.getAll('v').length === 1 && url.searchParams.get('v') === sha : /^viral-[a-z0-9-]+-[a-f0-9]{64}\.webp$/.test(path.basename(file)) && path.basename(file).endsWith('-' + sha + '.webp');
        res.setHeader('Content-Type', moduleRequest ? 'text/javascript; charset=utf-8' : file.endsWith('.webp') ? 'image/webp' : 'image/png');
        res.setHeader('Content-Length', body.length);
        res.setHeader('Cache-Control', immutable ? 'private, max-age=31536000, immutable' : moduleRequest ? 'no-store' : 'public, max-age=86400');
        entry.sha256 = sha; entry.immutable = immutable;
        res.end(req.method === 'HEAD' ? undefined : body); return;
      }
      res.writeHead(404); res.end();
    });
    const publisherOrigin = await listen(publisher), WebSocket = require('ws');
    class LocalSocket extends WebSocket {
      constructor(url, options) {
        loopback(url); super(url, options); sockets.add(this); websocket.connections++;
        this.on('message', data => { websocket.receivedFrameBytes += data.length; });
        this.on('close', () => sockets.delete(this));
      }
      send(data, ...args) { websocket.sentFrameBytes += Buffer.byteLength(data); return super.send(data, ...args); }
    }
    const values = new Map();
    bridge = createOverlayBridge({
      store: { get: (name, fallback) => values.get(name) ?? fallback, set: (name, value) => values.set(name, value) },
      serverURL: relayOrigin, port: publisher.address().port, accessKey: key,
      getCredentials: () => ({ licenseCode: 'isolated-qa-only', deviceId: 'traffic714-device' }),
      namespace: 'traffic714', allowInsecureForTests: true, WebSocketImpl: LocalSocket,
      fetchImpl: (url, options) => { loopback(url); return fetch(url, options); }
    });
    bridge.start('delta-qa');
    await eventually(() => bridge.status().ready, 'Actual local publisher WebSocket did not connect');
    return { relayOrigin, publisherOrigin, publicBase: bridge.status().publicBase, requests, responses, traffic, websocket,
      setState(value) { current = clone(value); }, state: () => clone(current), pending: () => feed.pending(), close,
      resetHistory() { feed.close(); feed = createWidgetChanges({ interval: 10, waitMs: 90 }); } };
  } catch (error) { await close(); throw error; }
}

function counter(fixture) {
  const snapshot = fixture.traffic.snapshot();
  return { publisherRequests: fixture.requests.length, publisherBytes: fixture.requests.reduce((n, r) => n + r.bytes, 0),
    http: snapshot.categories, websocket: { ...fixture.websocket } };
}

function difference(before, after) {
  return { publisherRequests: after.publisherRequests - before.publisherRequests, publisherBodyBytes: after.publisherBytes - before.publisherBytes,
    httpResponseBodyBytes: after.http.reduce((n, r) => n + r.bodyBytes, 0) - before.http.reduce((n, r) => n + r.bodyBytes, 0),
    publisherToRelayWSApplicationBytes: after.websocket.sentFrameBytes - before.websocket.sentFrameBytes,
    relayToPublisherWSApplicationBytes: after.websocket.receivedFrameBytes - before.websocket.receivedFrameBytes };
}

async function trackNetwork(page) {
  const cdp = await page.context().newCDPSession(page), rows = [], byId = new Map();
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
  cdp.on('Network.requestWillBeSent', event => {
    const row = { url: event.request.url, type: event.type, fromDiskCache: false, fromMemoryCache: false, encodedBytes: 0 };
    rows.push(row); byId.set(event.requestId, row);
  });
  cdp.on('Network.requestServedFromCache', event => { const row = byId.get(event.requestId); if (row) row.fromMemoryCache = true; });
  cdp.on('Network.responseReceived', event => {
    const row = byId.get(event.requestId);
    if (row) Object.assign(row, { status: event.response.status, headers: event.response.headers, fromDiskCache: !!event.response.fromDiskCache });
  });
  cdp.on('Network.loadingFinished', event => { const row = byId.get(event.requestId); if (row) row.encodedBytes = event.encodedDataLength; });
  cdp.on('Network.loadingFailed', event => { const row = byId.get(event.requestId); if (row) row.error = event.errorText; });
  return { rows, cdp };
}

async function nextState(page, fixture, state) {
  fixture.setState(state);
  const actual = await page.evaluate(async () => {
    clearTimeout(pollTimer); await poll(); clearTimeout(pollTimer); return state;
  });
  assert.deepEqual(baseline.snapshotOnly(actual), state, 'Shipped poll/transport/acceptState returns the exact snapshot');
}

function isImmutableURL(url) {
  const value = new URL(url);
  return value.pathname.endsWith('/widget/champion-motion.js') || /\/viral-[a-z0-9-]+-[a-f0-9]{64}\.webp$/.test(value.pathname);
}

async function sourceReady(page) {
  await page.waitForFunction(() => typeof state === 'object' && state.channel === 'delta-qa' && document.querySelector('.champion-sculpture canvas, .champion-custom-host canvas') &&
    typeof window.__championMotionController?.pixelStats === 'function');
  await page.evaluate(() => clearTimeout(pollTimer));
  await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth));
}

function rawRequest(value, gzip) {
  return new Promise((resolve, reject) => {
    const req = http.get(loopback(value), { agent: false, headers: { 'Accept-Encoding': gzip ? 'gzip' : 'identity' } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('error', reject);
      res.on('aborted', () => reject(new Error('Response aborted')));
      res.on('end', () => {
        try {
          const encoded = Buffer.concat(chunks), decoded = res.headers['content-encoding'] === 'gzip' ? gunzipSync(encoded) : encoded;
          resolve({ status: res.statusCode, headers: res.headers, encoded, decoded });
        } catch (error) { reject(error); }
      });
    });
    req.setTimeout(5000, () => req.destroy(new Error('Local request timed out'))); req.on('error', reject);
  });
}

async function verifyImmutableProtocol(fixture) {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/champion-art.json'), 'utf8'));
  const body = fs.readFileSync(path.join(ROOT, 'renderer/widgets/champion-motion.js'));
  assert.equal(manifest.moduleHash, hash(body));
  const moduleURL = fixture.publicBase + '/widget/champion-motion.js?v=' + manifest.moduleHash;
  const plain = await rawRequest(moduleURL, false), gzip = await rawRequest(moduleURL, true);
  assert.equal(plain.status, 200); assert.equal(gzip.status, 200);
  assert.equal(plain.headers['content-encoding'], undefined); assert.equal(gzip.headers['content-encoding'], 'gzip');
  assert.deepEqual(plain.decoded, body); assert.deepEqual(gzip.decoded, body);
  assert.ok(gzip.encoded.length < plain.encoded.length);
  for (const response of [plain, gzip]) {
    assert.match(response.headers['cache-control'], /^private, max-age=31536000, immutable/);
    assert.ok(!response.headers['cache-control'].includes('public'));
  }
  const documentURL = fixture.publicBase + '/widget-overlay.html?type=topgift';
  const htmlPlain = await rawRequest(documentURL, false), htmlGzip = await rawRequest(documentURL, true);
  assert.equal(htmlPlain.status, 200); assert.equal(htmlGzip.status, 200);
  assert.equal(htmlGzip.headers['content-encoding'], 'gzip');
  assert.deepEqual(htmlPlain.decoded, htmlGzip.decoded);
  assert.deepEqual(htmlGzip.decoded, Buffer.from(documentHTML()));
  assert.match(htmlGzip.headers['cache-control'], /no-store/);
  const rejectedCacheQueries = [];
  for (const query of ['&unexpected=1', '&type=topgift', '&v=' + manifest.moduleHash]) {
    const response = await rawRequest(moduleURL + query, true);
    assert.equal(response.status, 200); assert.deepEqual(response.decoded, body);
    assert.match(response.headers['cache-control'], /no-store/);
    rejectedCacheQueries.push({ query, cacheControl: response.headers['cache-control'] });
  }
  const assets = [];
  for (const [kind, value] of Object.entries({ ...manifest.frames, ...manifest.textures })) {
    const file = typeof value === 'string' ? value : value.file;
    assert.match(file, /^viral-[a-z0-9-]+-[a-f0-9]{64}\.webp$/);
    const expected = fs.readFileSync(assetFile(file));
    assert.ok(file.endsWith('-' + hash(expected) + '.webp'));
    const response = await rawRequest(fixture.publicBase + '/widget/gift-assets/' + file, true);
    assert.equal(response.status, 200); assert.deepEqual(response.decoded, expected);
    assert.match(response.headers['cache-control'], /^private, max-age=31536000, immutable/);
    assets.push({ kind, file, sourceBytes: expected.length, encodedBodyBytes: response.encoded.length, sha256: hash(expected), cacheControl: response.headers['cache-control'] });
  }
  const unknownAssetQuery = await rawRequest(fixture.publicBase + '/widget/gift-assets/' + assets[0].file + '?unexpected=1', true);
  assert.match(unknownAssetQuery.headers['cache-control'], /no-store/);
  return { module: { sourceBytes: body.length, identityBodyBytes: plain.encoded.length, gzipBodyBytes: gzip.encoded.length,
    sha256: hash(body), cacheControl: gzip.headers['cache-control'], exactDecodedBody: true }, assets, rejectedCacheQueries,
    unknownAssetQueryNoStore: true, document: { identityBodyBytes: htmlPlain.encoded.length, gzipBodyBytes: htmlGzip.encoded.length,
      exactDecodedBody: true, cacheControl: htmlGzip.headers['cache-control'] } };
}

async function runSources() {
  const fixture = await createCustomFixture();
  let browser;
  try {
    browser = await loadChromium().launch({ channel: process.env.WIDGET_QA_BROWSER_CHANNEL || 'chrome', headless: true,
      args: ['--disable-background-networking', '--disable-component-update', '--proxy-server=' + fixture.publisherOrigin, '--proxy-bypass-list=127.0.0.1'] });
    const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
    const external = [], errors = [];
    context.on('request', req => { const url = new URL(req.url()); if (['http:', 'https:'].includes(url.protocol) && url.origin !== fixture.relayOrigin) external.push(req.url()); });
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    let state = baseline.buildWorkload().frames[0].state;
    const files = ['5655', '5269', '5827', '5487'];
    state.topGifters.forEach((row, i) => { row.avatar = '/widget/gift-assets/' + files[i % files.length] + '.png'; });
    fixture.setState(state);
    const page = await context.newPage(), network = await trackNetwork(page);
    const url = fixture.publicBase + '/widget-overlay.html?type=topgifter';
    const start = counter(fixture);
    const ready = async page => {
      await page.waitForFunction(() => document.querySelectorAll('[data-rank-person]').length === 9 && [...document.images].every(img => img.complete && img.naturalWidth));
      await page.evaluate(() => clearTimeout(pollTimer));
    };
    await page.goto(url); await ready(page);
    const original = await page.evaluate(() => {
      window.qaRows = new Map([...document.querySelectorAll('[data-rank-person]')].map(row => [row.dataset.rankPerson, row.querySelector('img')]));
      return [...window.qaRows].map(([id, img]) => ({ id, url: img.currentSrc || img.src }));
    });
    const externalURL = 'https://original-avatar.invalid/full-resolution.webp?signature=original-unchanged';
    assert.equal(await page.evaluate(url => imageURL(url), externalURL), externalURL, 'Original HTTPS avatar URL is not resized, recompressed or rewritten');
    const firstLoad = difference(start, counter(fixture)), beforeScores = counter(fixture), requestAt = fixture.requests.length;
    for (let step = 1; step <= 100; step++) {
      state = clone(state); const row = state.topGifters[step % 9]; row.totalCoins += 10000 + step;
      state.topGifters.sort((a, b) => b.totalCoins - a.totalCoins);
      await nextState(page, fixture, state);
      assert.ok(await page.evaluate(() => [...document.querySelectorAll('[data-rank-person]')].every(row => window.qaRows.get(row.dataset.rankPerson) === row.querySelector('img'))), '100 score changes retain all original avatar elements');
    }
    const updates = difference(beforeScores, counter(fixture));
    const updatesImages = fixture.requests.slice(requestAt).filter(row => row.path.startsWith('/widget/gift-assets/'));
    assert.deepEqual(updatesImages, [], '100 rank changes do not re-download unchanged avatar bytes');
    const beforeReload = counter(fixture), reloadAt = network.rows.length, publisherAt = fixture.requests.length;
    await page.reload(); await ready(page); await pause(100);
    const reload = difference(beforeReload, counter(fixture));
    const reloaded = await page.evaluate(() => [...document.querySelectorAll('[data-rank-person]')].map(row => ({ id: row.dataset.rankPerson, url: row.querySelector('img').src })));
    assert.deepEqual(reloaded.sort((a, b) => a.id.localeCompare(b.id)), [...original].sort((a, b) => a.id.localeCompare(b.id)), 'A reloaded source reuses exact original avatar URLs');
    const reloadImages = network.rows.slice(reloadAt).filter(row => row.type === 'Image');
    const sourceReloadPublisherImages = fixture.requests.slice(publisherAt).filter(row => row.path.startsWith('/widget/gift-assets/')).map(row => ({ ...row }));
    const secondStart = counter(fixture), secondPage = await context.newPage(), secondNetwork = await trackNetwork(secondPage);
    await secondPage.goto(url); await ready(secondPage); await pause(100);
    const secondSource = difference(secondStart, counter(fixture));
    const servedImages = fixture.requests.filter(row => row.sha256 && row.path.startsWith('/widget/gift-assets/'));
    for (const row of servedImages) {
      assert.equal(row.sha256, hash(fs.readFileSync(path.join(ROOT, 'renderer/gift-assets', path.basename(row.path)))));
      assert.equal(row.bytes, fs.statSync(path.join(ROOT, 'renderer/gift-assets', path.basename(row.path))).size);
    }
    assert.deepEqual(external, []); assert.deepEqual(errors, []);
    const result = { passed: true, at: new Date().toISOString(), synthetic: true, productionRequests: 0, realChrome: await browser.version(),
      measurement: 'Actual relay HTTP response body bytes, including gzip where negotiated. WS counts are application messages. CDP encodedBytes includes response headers. Not production billing.',
      scoreChanges: 100, exactSnapshots: 100, retainedAvatarElements: 9, originalHTTPSURLPreservedWithoutRequest: true,
      originalAvatarURLs: original, imageBodiesByteIdenticalToSource: true, cacheEnabled: true,
      firstLoad, updates, reload, secondSource,
      unchangedImagePublisherRequestsDuringUpdates: updatesImages, sourceReloadImageRequests: reloadImages,
      sourceReloadPublisherImageRequests: sourceReloadPublisherImages,
      sourceReloadImageBodyBytes: sourceReloadPublisherImages.reduce((sum, row) => sum + row.bytes, 0),
      secondSourceImageRequests: secondNetwork.rows.filter(row => row.type === 'Image'), externalRequests: external, errors };
    await page.close(); await secondPage.close();
    await eventually(() => fixture.pending() === 0, 'Closing sources releases pending requests');
    record('traffic714-sources.json', result); return result;
  } finally { await browser?.close(); await fixture.close(); }
}

async function runCustom() {
  assert.ok(fs.existsSync(path.join(ROOT, 'renderer/widgets/champion-motion.js')), 'Parent champion-motion bundle must be integrated first');
  const fixture = await createCustomFixture();
  let browser;
  try {
    browser = await loadChromium().launch({ channel: process.env.WIDGET_QA_BROWSER_CHANNEL || 'chrome', headless: true,
      args: ['--disable-background-networking', '--disable-component-update', '--proxy-server=' + fixture.publisherOrigin, '--proxy-bypass-list=127.0.0.1'] });
    const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
    const external = [], errors = [];
    context.on('request', req => { const url = new URL(req.url()); if (['http:', 'https:'].includes(url.protocol) && url.origin !== fixture.relayOrigin) external.push(req.url()); });
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    fs.mkdirSync(OUT, { recursive: true });
    const result = { passed: true, at: new Date().toISOString(), synthetic: true, productionRequests: 0,
      measurement: 'Actual local relay HTTP encoded response bodies and WS JSON application messages. CDP encodedBytes includes HTTP response headers and is reported separately. No provider billing or invoice guarantee.',
      cacheEnabled: true, styles: {}, cachePolicyFailures: [], sourceHashes: { renderer: hash(fs.readFileSync(path.join(ROOT, 'renderer/widgets/reference-widgets.html'))),
        manifest: hash(fs.readFileSync(path.join(ROOT, 'lib/champion-art.json'))), module: hash(fs.readFileSync(path.join(ROOT, 'renderer/widgets/champion-motion.js'))) } };
    for (const kind of ['gold', 'crystal', 'ember']) {
      fixture.resetHistory();
      let state = baseline.buildWorkload({ epoch: Date.now(), steps: 8 }).frames[0].state;
      state.studio.settings.topgift = { frameStyle: kind, title: 'TRAFFIC QA', sound: false, entranceSound: 'none', showGift: true };
      state.topGift = { id: kind + '-initial', username: 'original_viewer', nickname: 'Original Viewer', avatar: '/widget/gift-assets/5655.png',
        giftId: '5655', giftName: 'QA Rose', giftImage: '/widget/gift-assets/5655.png', coins: 1000, count: 1, createdAt: Date.now() };
      fixture.setState(state);
      const page = await context.newPage(), network = await trackNetwork(page), start = counter(fixture);
      const url = fixture.publicBase + '/widget-overlay.html?type=topgift';
      await page.goto(url); await sourceReady(page);
      const initial = difference(start, counter(fixture));
      const expected = await page.evaluate(() => {
        window.qaOriginalHost = document.querySelector('.champion-sculpture, .champion-custom-host');
        window.qaOriginalCanvas = window.qaOriginalHost.querySelector('canvas');
        window.qaOriginalImages = [...document.images].map(img => img.currentSrc || img.src);
        window.qaOriginalController = window.__championMotionController;
        window.qaOriginalDiagnostics = window.__championMotionDiagnostics();
        window.qaWebGL = 0; const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (kind, ...args) { if (String(kind).startsWith('webgl')) window.qaWebGL++; return original.call(this, kind, ...args); };
        window.qaGiftDispatches = []; const claim = claimPlayback;
        claimPlayback = id => { const accepted = claim(id); if (accepted && id.startsWith('traffic714-')) window.qaGiftDispatches.push(id); return accepted; };
        return { images: window.qaOriginalImages, diagnostics: window.qaOriginalDiagnostics,
          moduleURL: [...performance.getEntriesByType('resource')].find(row => row.name.includes('/widget/champion-motion.js'))?.name };
      });
      assert.match(expected.moduleURL || '', /\/widget\/champion-motion\.js\?[^#]*v=[a-f0-9]{64}/);
      assert.equal(new URL(expected.moduleURL).searchParams.get('v'), result.sourceHashes.module);
      assert.equal(expected.diagnostics.kind, kind);
      assert.equal(expected.diagnostics.ready, true);
      assert.ok(Number.isInteger(expected.diagnostics.mounts) && expected.diagnostics.mounts > 0);
      await pause(150); const warmAt = counter(fixture), warmRequests = fixture.requests.length, warmNetwork = network.rows.length;
      const eventIds = [], latenciesMs = [];
      for (let i = 1; i <= 100; i++) {
        state = clone(state); const id = 'traffic714-' + kind + '-' + i; eventIds.push(id);
        const gift = { ...state.topGift, id, type: 'gift', username: i % 2 ? 'original_viewer' : 'second_viewer',
          nickname: i % 2 ? 'Original Viewer' : 'Second Viewer', coins: 1000 + i, count: i + 1, createdAt: Date.now(), updatedAt: Date.now() };
        state.topGift = gift; state.stats.totalCoins += gift.coins; state.stats.giftCount++;
        state.topGifters[0].totalCoins += gift.coins;
        state.activities = [gift, ...state.activities].slice(0, 24);
        const at = Date.now(); await nextState(page, fixture, state); latenciesMs.push(Date.now() - at);
        const identity = await page.evaluate(() => ({ host: window.qaOriginalHost === document.querySelector('.champion-sculpture, .champion-custom-host'),
          canvas: window.qaOriginalCanvas === document.querySelector('.champion-sculpture canvas, .champion-custom-host canvas'), newWebGLContexts: window.qaWebGL,
          controller: window.qaOriginalController === window.__championMotionController, diagnostics: window.__championMotionDiagnostics(),
          images: [...document.images].map(img => img.currentSrc || img.src) }));
        assert.ok(identity.host && identity.canvas, kind + ': all 100 gift/score changes retain custom host and canvas');
        assert.ok(identity.controller, '100 gift/score changes retain the original 3D controller');
        assert.equal(identity.diagnostics.mounts, expected.diagnostics.mounts, 'Updates never mount a replacement 3D scene');
        for (const key of ['sceneId', 'rendererId']) if (expected.diagnostics[key] !== undefined) assert.equal(identity.diagnostics[key], expected.diagnostics[key]);
        assert.equal(identity.newWebGLContexts, 0, 'No new WebGL context after warmup');
        assert.deepEqual(identity.images, expected.images, 'Score and gift changes reuse exact image URLs');
        assert.equal(await page.locator('.champion-badge b').textContent(), (1000 + i).toLocaleString('tr-TR') + ' coin');
      }
      const dispatched = await page.evaluate(() => window.qaGiftDispatches);
      assert.deepEqual(dispatched, eventIds, 'Actual renderer accepts every gift exactly once across overlapping histories');
      const repeatedAssets = fixture.requests.slice(warmRequests).filter(row => row.path === '/widget/champion-motion.js' || row.path.startsWith('/widget/gift-assets/'));
      assert.deepEqual(repeatedAssets, [], '100 updates must not re-download unchanged assets from publisher');
      const assetNetwork = network.rows.slice(warmNetwork).filter(row => isImmutableURL(row.url));
      assert.equal(assetNetwork.filter(row => row.encodedBytes > 0).length, 0, '100 updates do not download immutable module/frame bodies');
      const updates = difference(warmAt, counter(fixture));
      const diagnosticsAfterUpdates = await page.evaluate(() => window.__championMotionDiagnostics());
      const pixels = await page.evaluate(() => {
        const controller = window.__championMotionController;
        controller.drawAt(1); const first = controller.pixelStats(); controller.drawAt(2.2); const second = controller.pixelStats();
        return { first, second };
      });
      assert.ok(pixels.first.painted > 1000 && pixels.second.painted > 1000, 'Actual custom WebGL frame is nonblank');
      assert.notEqual(pixels.first.hash, pixels.second.hash, 'Custom frame geometry visibly moves');
      assert.equal(pixels.first.center, 0); assert.equal(pixels.second.center, 0);
      const beforeReload = counter(fixture), reloadAt = network.rows.length, publisherBeforeReload = fixture.requests.length;
      await page.reload(); await sourceReady(page); await pause(150);
      const reload = difference(beforeReload, counter(fixture));
      const reloadResources = network.rows.slice(reloadAt).filter(row => isImmutableURL(row.url) || row.type === 'Image');
      const reloadImmutablePublisherRequests = fixture.requests.slice(publisherBeforeReload)
        .filter(row => row.path === '/widget/champion-motion.js' || /^\/widget\/gift-assets\/viral-/.test(row.path)).map(row => ({ ...row }));
      const reloadImmutableDownloads = reloadResources.filter(row => isImmutableURL(row.url) && row.encodedBytes > 0);
      for (const row of network.rows.filter(row => isImmutableURL(row.url) && row.status === 200)) {
        const policy = Object.entries(row.headers || {}).find(([name]) => name.toLowerCase() === 'cache-control')?.[1] || '';
        if (!/^private, max-age=31536000, immutable/.test(policy)) result.cachePolicyFailures.push({ kind, url: row.url, cacheControl: policy, encodedBytesIncludingHeaders: row.encodedBytes });
      }
      const imageURLsAfterReload = await page.evaluate(() => [...document.images].map(img => img.currentSrc || img.src));
      assert.deepEqual(imageURLsAfterReload, expected.images, 'Source reload preserves original image URLs');
      const screenshot = await page.screenshot({ path: path.join(OUT, 'traffic714-' + kind + '.png'), omitBackground: true });
      result.styles[kind] = { scoreGiftChanges: 100, uniqueGiftDispatches: dispatched.length, duplicateGiftDispatches: dispatched.length - new Set(dispatched).size,
        stableHost: true, stableCanvas: true, stableController: true, newWebGLContextsDuringUpdates: 0, unchangedImageURLs: expected.images,
        diagnosticsBeforeUpdates: expected.diagnostics, diagnosticsAfterUpdates, pixels,
        initial, updates, reload, reloadResources, reloadImmutablePublisherRequests, reloadImmutableDownloads, immutableRequestsDuringUpdates: assetNetwork,
        publisherAssetRequestsDuringUpdates: repeatedAssets, latencyMs: { min: Math.min(...latenciesMs), max: Math.max(...latenciesMs) },
        screenshotSha256: hash(screenshot), screenshotBytes: screenshot.length, network: network.rows };
      await page.close(); await eventually(() => fixture.pending() === 0, 'Closing source releases long polls');
    }
    assert.deepEqual(external, []); assert.deepEqual(errors, []);
    result.browser = await browser.version(); result.externalRequests = external; result.errors = errors;
    result.immutableProtocol = await verifyImmutableProtocol(fixture);
    result.realWebSocketConnections = fixture.websocket.connections;
    result.passed = result.cachePolicyFailures.length === 0;
    result.fullNavigationNote = 'Actual sandboxed document reload creates a fresh opaque origin. Immutable cache headers do not guarantee cache reuse across full navigation; reload requests and encoded bytes are recorded above. Within-page score/gift updates must not transfer unchanged assets.';
    assert.equal(hash(fs.readFileSync(path.join(ROOT, 'renderer/widgets/reference-widgets.html'))), result.sourceHashes.renderer, 'Renderer did not change during QA');
    assert.equal(hash(fs.readFileSync(path.join(ROOT, 'lib/champion-art.json'))), result.sourceHashes.manifest, 'Manifest did not change during QA');
    record('traffic714-custom.json', result);
    assert.deepEqual(result.cachePolicyFailures, [], 'Actual renderer module/hashed-image URLs must receive private immutable browser cache headers');
    return result;
  } finally { await browser?.close(); await fixture.close(); }
}

module.exports = { runBaseline, runSources, runCustom, runOversize, buildOversizeWorkload, createCustomFixture, verifyImmutableProtocol, record, loopback };

if (require.main === module) {
  const mode = process.argv.includes('--custom-only') ? 'custom' : process.argv.includes('--sources-only') ? 'sources' : process.argv.includes('--oversize-only') ? 'oversize' : 'baseline';
  const run = mode === 'custom' ? () => runCustom() : mode === 'sources' ? () => runSources() : mode === 'oversize' ? () => runOversize({ browser: !process.argv.includes('--http-only') }) : () => runBaseline({ browser: !process.argv.includes('--http-only') });
  run().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    record('traffic714-' + mode + '-failure.json', { passed: false, at: new Date().toISOString(), error: error.stack });
    console.error(error.stack); process.exitCode = 1;
  });
}
