'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { gunzipSync } = require('node:zlib');
const { createWidgetChanges } = require('../lib/widget-changes.cjs');
const { createOverlayBridge } = require('../lib/overlay-bridge.cjs');

const ROOT = path.resolve(__dirname, '..');
const RELAY_ROOT = process.env.DELTA_QA_RELAY_ROOT || 'D:/TikMnG-Release-7.0.0-source';
const KEY = 'isolated-delta-qa';
const CHANNEL = 'delta-qa';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64');
const clone = value => JSON.parse(JSON.stringify(value));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function snapshotOnly(value) {
  const result = { ...value };
  for (const name of ['__stateRevision', '__stateToken', '__statePatch']) delete result[name];
  return result;
}

function opaque(seed, length) {
  let result = '';
  for (let i = 0; result.length < length; i++) result += hash(seed + ':' + i);
  return result.slice(0, length);
}

function buildWorkload({ steps = 36, epoch = 1800000000000 } = {}) {
  assert.ok(Number.isInteger(steps) && steps >= 8 && steps <= 200);
  const people = Array.from({ length: 9 }, (_, i) => ({
    id: 'person-' + i, username: 'viewer_' + i, nickname: 'Viewer ' + i,
    avatar: '/widget/gift-assets/qa-avatar-' + i + '.png?signature=' + opaque('avatar-' + i, 1536),
    totalCoins: 9000 - i * 500, totalLikes: 20000 - i * 700, giftCount: 10 + i
  }));
  const state = {
    channel: CHANNEL, topGifters: clone(people), activities: [], topGift: null,
    stats: { totalCoins: 0, totalLikes: 0, giftCount: 0 },
    studio: {
      settings: { topgifter: { items: 9, layout: 'list', sound: false }, actionwheel: { giftId: '5655', sound: false, duration: 2, resultSeconds: 2 } },
      resets: { topgifter: 0, actionwheel: 0 },
      pk: { battleId: 'qa-battle', status: 'active', endsAt: epoch + 600000,
        players: [{ id: 'left', username: 'viewer_0', score: 0 }, { id: 'right', username: 'viewer_1', score: 0 }],
        teams: [{ id: 'left', memberIds: ['left'], score: 0 }, { id: 'right', memberIds: ['right'], score: 0 }], wins: { left: 0, right: 0 } }
    }
  };
  const frames = [{ label: 'initial', state: clone(state), addedIds: [] }];
  let eventNumber = 0;
  for (let step = 1; step <= steps; step++) {
    if (step === Math.floor(steps / 2)) {
      state.topGifters = [];
      state.activities = [];
      state.topGift = null;
      state.stats = { totalCoins: 0, totalLikes: 0, giftCount: 0 };
      state.studio.resets = { topgifter: epoch + step * 100, actionwheel: epoch + step * 100 };
      for (const row of [...state.studio.pk.players, ...state.studio.pk.teams]) row.score = 0;
      frames.push({ label: 'reset', state: clone(state), addedIds: [] });
      continue;
    }
    if (!state.topGifters.length) state.topGifters = clone(people);
    const actor = state.topGifters.find(row => row.id === 'person-' + step % 9);
    actor.totalCoins += 2000 + step;
    actor.totalLikes += step * 3;
    actor.giftCount += 1;
    state.topGifters.sort((a, b) => b.totalCoins - a.totalCoins || a.id.localeCompare(b.id));
    const added = Array.from({ length: 3 + step % 5 }, (_, burst) => ({
      id: 'activity-' + String(++eventNumber).padStart(4, '0'), type: 'gift',
      username: actor.username, nickname: actor.nickname, avatar: actor.avatar,
      giftId: '5655', giftName: 'QA Rose', giftImage: '/widget/gift-assets/5655.png',
      count: 1 + burst, coins: 1 + burst, createdAt: epoch + step * 100 + burst, actionWheelIndex: step % 8
    }));
    state.activities = [...added.reverse(), ...state.activities].slice(0, 24);
    state.topGift = clone(added[0]);
    state.stats.totalCoins += added.reduce((sum, row) => sum + row.coins, 0);
    state.stats.giftCount += added.length;
    state.stats.totalLikes += step;
    const side = step % 2;
    state.studio.pk.players[side].score = step % 7 === 0 ? 0 : step * 17;
    state.studio.pk.teams[side].score = state.studio.pk.players[side].score;
    frames.push({ label: 'burst-' + step, state: clone(state), addedIds: added.map(row => row.id) });
  }
  frames.push({ label: 'idle-1', state: clone(state), addedIds: [] }, { label: 'idle-2', state: clone(state), addedIds: [] });
  return { frames, eventIds: frames.flatMap(frame => frame.addedIds), visibleRows: 9, historyLimit: 24, avatarURLBytes: people.map(row => Buffer.byteLength(row.avatar)) };
}

function localURL(value) {
  const url = new URL(value);
  assert.ok(['http:', 'ws:'].includes(url.protocol) && url.hostname === '127.0.0.1' && !url.username && !url.password,
    'QA only permits loopback HTTP/WebSocket URLs: ' + url.origin);
  return url;
}

function request(value, { gzip = true, timeout = 5000 } = {}) {
  const url = localURL(value);
  assert.equal(url.protocol, 'http:');
  return new Promise((resolve, reject) => {
    const req = http.get(url, { agent: false, headers: { 'Accept-Encoding': gzip ? 'gzip' : 'identity' } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('aborted', () => reject(new Error('HTTP response aborted')));
      res.on('end', () => {
        try {
          const encoded = Buffer.concat(chunks);
          const decoded = res.headers['content-encoding'] === 'gzip' ? gunzipSync(encoded) : encoded;
          resolve({ status: res.statusCode, headers: res.headers, wireBytes: encoded.length, decodedBytes: decoded.length,
            value: decoded.length ? JSON.parse(decoded.toString('utf8')) : null });
        } catch (error) { reject(error); }
      });
    });
    req.setTimeout(timeout, () => req.destroy(new Error('Local QA request timed out')));
    req.on('error', reject);
  });
}

async function eventually(check, message, timeout = 5000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) { if (await check()) return; await pause(15); }
  assert.fail(message);
}

async function createFixture({ relayRoot = RELAY_ROOT, waitMs = 90 } = {}) {
  const patchFile = path.join(ROOT, 'renderer/widgets/state-patch.js');
  assert.ok(fs.existsSync(patchFile), 'Parent must provide renderer/widgets/state-patch.js before running QA');
  const patch = require(patchFile);
  const [{ default: express }, { registerOverlayRelay }, { createHttpTraffic }] = await Promise.all([
    import(pathToFileURL(path.join(relayRoot, 'node_modules/express/index.js')).href),
    import(pathToFileURL(path.join(relayRoot, 'overlay-relay.js')).href),
    import(pathToFileURL(path.join(relayRoot, 'http-traffic.js')).href)
  ]);
  const resources = [], sockets = new Set(), responses = [], websocket = { connections: 0, sentFrameBytes: 0, receivedFrameBytes: 0 };
  let current = buildWorkload().frames[0].state, feed, fault = null, closing = false;
  const newFeed = () => createWidgetChanges({ interval: 10, waitMs });
  feed = newFeed();
  const traffic = createHttpTraffic(), app = express();
  app.use(traffic.middleware);
  const relay = registerOverlayRelay(app, { secret: crypto.randomBytes(32), authorize: () => ({ ownerId: 'isolated-delta-qa' }) });
  async function listen(server) {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    resources.push(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    return 'http://127.0.0.1:' + server.address().port;
  }
  const relayServer = http.createServer(app);
  relay.attach(relayServer);
  try {
    const relayOrigin = await listen(relayServer);
    const publisherServer = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      res.setHeader('Cache-Control', 'no-store');
      if (url.searchParams.get('key') !== KEY) { res.writeHead(403); res.end(); return; }
      if (/^\/(?:api\/)?widget\/(?:state|(?:leaderboard|activity)\/state)$/.test(url.pathname)) {
        const end = res.end;
        res.end = function (body, ...args) {
          let value;
          try { value = body && JSON.parse(body.toString()); } catch {}
          const kind = value?.__statePatch ? 'patch' : res.statusCode === 204 ? 'idle' : 'full';
          const entry = { query: Object.fromEntries(url.searchParams), status: res.statusCode, kind, bytes: body ? Buffer.byteLength(body) : 0 };
          responses.push(entry);
          if (kind === 'patch' && fault) {
            const selected = fault; fault = null; entry.fault = selected;
            if (selected === 'drop') { res.destroy(); return res; }
            if (selected === 'bad-base') value.__statePatch.base = opaque('wrong-base', 32);
            else if (selected === 'bad-operation') value.__statePatch.operations = [[99, []]];
            body = JSON.stringify(value);
          }
          return end.call(this, body, ...args);
        };
        if (feed.handle(req, res, url, () => clone(current))) return;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(current)); return;
      }
      if (url.pathname === '/widget-overlay.html') {
        const scripts = ['state-patch.js', 'change-transport.js'].map(name => '<script>' + fs.readFileSync(path.join(ROOT, 'renderer/widgets', name), 'utf8') + '</script>').join('');
        let html;
        if (url.searchParams.get('qa') === 'probe') {
          html = '<!doctype html><html><body>' + scripts + '<script>window.qa={seen:new Set(),deliveries:[],snapshots:[],async next(){const r=await fetch(new URL(location.pathname.replace(/widget-overlay.html$/,"api/widget/state")+"?type=topgifter",location.href),{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);const v=await r.json();if(v.__statePatch)throw Error("Patch leaked to consumer");this.snapshots.push(v);for(const e of [...(v.activities||[])].reverse())if(!this.seen.has(e.id)){this.seen.add(e.id);this.deliveries.push(e.id);}return v;}};</script></body></html>';
        } else {
          const file = url.searchParams.get('type') === 'pk' ? 'live-score-widgets.html' : 'reference-widgets.html';
          html = fs.readFileSync(path.join(ROOT, 'renderer/widgets', file), 'utf8').replace(/<script(?=[\s>])/, scripts + '<script');
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return;
      }
      if (/^\/widget\/gift-assets\//.test(url.pathname)) {
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' }); res.end(PNG); return;
      }
      res.writeHead(404); res.end();
    });
    const publisherOrigin = await listen(publisherServer);
    const WebSocket = require('ws');
    class LocalSocket extends WebSocket {
      constructor(url, options) {
        localURL(url); super(url, options); sockets.add(this); websocket.connections++;
        this.on('message', data => { websocket.receivedFrameBytes += data.length; });
        this.on('close', () => sockets.delete(this));
      }
      send(data, ...args) { websocket.sentFrameBytes += Buffer.byteLength(data); return super.send(data, ...args); }
    }
    const values = new Map();
    const bridge = createOverlayBridge({
      store: { get: (name, fallback) => values.get(name) ?? fallback, set: (name, value) => values.set(name, value) },
      serverURL: relayOrigin, port: publisherServer.address().port, accessKey: KEY,
      getCredentials: () => ({ licenseCode: 'isolated-delta-qa', deviceId: 'qa-device' }),
      namespace: 'delta-qa', allowInsecureForTests: true, WebSocketImpl: LocalSocket,
      fetchImpl: (url, options) => { localURL(url); return fetch(url, options); }
    });
    resources.push(() => bridge.close());
    bridge.start(CHANNEL);
    await eventually(() => bridge.status().ready, 'Local WebSocket publisher did not connect');
    const publicBase = bridge.status().publicBase;
    return {
      patch, publicBase, publisherOrigin, relayOrigin, responses, traffic, websocket,
      setState(value) { current = clone(value); },
      state: () => clone(current), pending: () => feed.pending(),
      armFault(value) { assert.ok(['drop', 'bad-base', 'bad-operation'].includes(value)); fault = value; },
      resetHistory() { feed.close(); feed = newFeed(); },
      async reconnect() {
        bridge.stop();
        await eventually(() => sockets.size === 0, 'Old publisher WebSocket did not close');
        feed.close(); feed = newFeed(); bridge.start(CHANNEL);
        await eventually(() => bridge.status().ready, 'Local publisher failed to reconnect');
        assert.equal(bridge.status().publicBase, publicBase, 'Reconnect retains the relay URL');
      },
      async close() {
        if (closing) return; closing = true; feed.close();
        bridge.close(); for (const socket of sockets) socket.terminate();
        await relay.close();
        for (const close of resources.reverse()) await close();
      }
    };
  } catch (error) {
    feed.close(); for (const socket of sockets) socket.terminate(); await relay.close();
    for (const close of resources.reverse()) await close();
    throw error;
  }
}

function reconstruct(previous, message, patch) {
  if (!message.__statePatch) return message;
  assert.ok(previous, 'Delta requires a cached full snapshot');
  assert.equal(message.__statePatch.version, 1);
  assert.equal(message.__statePatch.base, previous.__stateToken);
  return { ...patch.apply(snapshotOnly(previous), message.__statePatch.operations),
    __stateRevision: message.__stateRevision, __stateToken: message.__stateToken };
}

async function runHttpComparison(fixture, workload = buildWorkload()) {
  const modes = {};
  for (const mode of ['full', 'gzip', 'gzipDelta']) {
    fixture.resetHistory();
    const before = fixture.traffic.snapshot().categories.find(row => row.name === 'overlay-state');
    const wsBefore = { ...fixture.websocket };
    const metrics = { requests: 0, httpResponseBodyBytes: 0, decodedBodyBytes: 0, gzipResponses: 0, fullResponses: 0, patchResponses: 0, idle204: 0,
      exactSnapshots: 0, uniqueActivityIds: 0, duplicateDispatches: 0, unchangedLeaderboardAvatarBytesInPatches: 0 };
    let previous;
    const seen = new Set(), dispatches = [];
    for (const frame of workload.frames) {
      fixture.setState(frame.state);
      const url = new URL(fixture.publicBase + '/api/widget/state?type=topgifter&items=9');
      if (mode === 'gzipDelta') {
        url.searchParams.set('transport', 'changes'); url.searchParams.set('patch', '1');
        if (previous) { url.searchParams.set('after', previous.__stateRevision); url.searchParams.set('base', previous.__stateToken); }
      }
      const result = await request(url, { gzip: mode !== 'full' });
      metrics.requests++; metrics.httpResponseBodyBytes += result.wireBytes; metrics.decodedBodyBytes += result.decodedBytes;
      if (result.headers['content-encoding'] === 'gzip') metrics.gzipResponses++;
      if (result.status === 204) {
        metrics.idle204++; assert.equal(result.wireBytes, 0); assert.ok(frame.label.startsWith('idle-')); assert.ok(previous);
      } else {
        assert.equal(result.status, 200, mode + ': ' + frame.label);
        if (result.value.__statePatch) {
          metrics.patchResponses++;
          const rankOperations = result.value.__statePatch.operations.filter(operation => operation[1]?.[0] === 'topGifters');
          const text = JSON.stringify(rankOperations);
          for (const row of frame.state.topGifters) if (text.includes(row.avatar)) metrics.unchangedLeaderboardAvatarBytesInPatches += Buffer.byteLength(row.avatar);
        } else metrics.fullResponses++;
        previous = reconstruct(previous, result.value, fixture.patch);
      }
      assert.deepEqual(snapshotOnly(previous), frame.state, mode + ' must reconstruct every field at ' + frame.label);
      metrics.exactSnapshots++;
      for (const event of [...previous.activities].reverse()) if (!seen.has(event.id)) { seen.add(event.id); dispatches.push(event.id); }
    }
    assert.deepEqual([...seen].sort(), [...workload.eventIds].sort(), mode + ': all burst IDs survive the sliding history and reset');
    assert.equal(dispatches.length, seen.size);
    const after = fixture.traffic.snapshot().categories.find(row => row.name === 'overlay-state');
    assert.equal(after.bodyBytes - before.bodyBytes, metrics.httpResponseBodyBytes, 'Real relay traffic counter matches encoded HTTP bytes');
    assert.equal(after.requests - before.requests, metrics.requests);
    metrics.uniqueActivityIds = seen.size;
    metrics.relayCounterBodyBytes = after.bodyBytes - before.bodyBytes;
    metrics.publisherToRelayWebSocketFrameBytes = fixture.websocket.sentFrameBytes - wsBefore.sentFrameBytes;
    metrics.relayToPublisherWebSocketFrameBytes = fixture.websocket.receivedFrameBytes - wsBefore.receivedFrameBytes;
    modes[mode] = metrics;
  }
  assert.ok(modes.gzip.gzipResponses > 0, 'Comparison must exercise the actual relay gzip compressor');
  assert.ok(modes.gzipDelta.patchResponses > 0, 'Comparison must exercise real v2 deltas');
  assert.equal(modes.gzipDelta.idle204, 2);
  assert.ok(modes.gzipDelta.httpResponseBodyBytes < modes.gzip.httpResponseBodyBytes * 0.55, 'Delta must substantially improve busy-state gzip bytes');
  const reduction = (a, b) => Number((100 * (1 - b / a)).toFixed(2));
  return { workload: { deterministic: true, frames: workload.frames.length, uniqueActivityIds: workload.eventIds.length, visibleRows: 9,
    slidingHistoryLimit: workload.historyLimit, unchangedAvatarURLBytes: workload.avatarURLBytes },
    baseline: 'Full identical synthetic payload without compression; a same-payload reference, not an installed 7.0.12 binary measurement',
    modes, reductionPercent: { gzipVsFull: reduction(modes.full.httpResponseBodyBytes, modes.gzip.httpResponseBodyBytes),
      gzipDeltaVsFull: reduction(modes.full.httpResponseBodyBytes, modes.gzipDelta.httpResponseBodyBytes),
      gzipDeltaVsGzip: reduction(modes.gzip.httpResponseBodyBytes, modes.gzipDelta.httpResponseBodyBytes) } };
}

async function runHttpRecovery(fixture) {
  const workload = buildWorkload({ steps: 8 });
  fixture.resetHistory(); fixture.setState(workload.frames[0].state);
  const baseURL = fixture.publicBase + '/api/widget/state?type=topgifter&transport=changes&patch=1';
  let previous = (await request(baseURL)).value;
  assert.ok(previous.__stateToken && previous.__stateRevision);
  const urlFor = cached => baseURL + '&after=' + cached.__stateRevision + '&base=' + cached.__stateToken;
  const waiting = request(urlFor(previous));
  await eventually(() => fixture.pending() === 1, 'Expected a real pending HTTP long poll');
  fixture.setState(workload.frames[1].state);
  const changed = await waiting;
  assert.ok(changed.value.__statePatch, 'A pending long poll returns a v2 patch when state changes');
  previous = reconstruct(previous, changed.value, fixture.patch);
  assert.deepEqual(snapshotOnly(previous), workload.frames[1].state);
  const idle = await request(urlFor(previous));
  assert.equal(idle.status, 204); assert.equal(idle.wireBytes, 0);
  fixture.setState(workload.frames[2].state);
  const unknown = new URL(urlFor(previous)); unknown.searchParams.set('base', '0'.repeat(32));
  const full = await request(unknown);
  assert.equal(full.status, 200); assert.equal(full.value.__statePatch, undefined);
  assert.deepEqual(snapshotOnly(full.value), workload.frames[2].state);
  fixture.setState(workload.frames[3].state);
  const discarded = await request(urlFor(previous));
  assert.ok(discarded.value.__statePatch, 'Discard a real delta without acknowledging its token');
  fixture.setState(workload.frames[5].state);
  const recovered = await request(urlFor(previous));
  assert.deepEqual(snapshotOnly(reconstruct(previous, recovered.value, fixture.patch)), workload.frames[5].state);
  previous = reconstruct(previous, recovered.value, fixture.patch);
  const connections = fixture.websocket.connections;
  await fixture.reconnect(); fixture.setState(workload.frames[6].state);
  const reconnect = await request(urlFor(previous));
  assert.equal(reconnect.value.__statePatch, undefined, 'Lost history after a WebSocket reconnect requires full resync');
  assert.deepEqual(snapshotOnly(reconnect.value), workload.frames[6].state);
  assert.equal(fixture.websocket.connections, connections + 1);
  const v1 = await request(fixture.publicBase + '/api/widget/state?type=topgifter&transport=changes');
  assert.ok(v1.value.__stateRevision); assert.equal(v1.value.__stateToken, undefined); assert.equal(v1.value.__statePatch, undefined);
  assert.deepEqual(snapshotOnly(v1.value), workload.frames[6].state);
  await eventually(() => fixture.pending() === 0, 'No HTTP long poll may remain after recovery');
  return { pendingChangePatch: true, idle204BodyBytes: idle.wireBytes, badBaseFullFallback: true, discardedDeltaRecoveredExactly: true,
    realWebSocketReconnect: true, reconnectFullResync: true, v1Unchanged: true, pendingAtEnd: fixture.pending() };
}

function loadChromium() {
  const choices = [process.env.DELTA_QA_PLAYWRIGHT, 'playwright', path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean);
  for (const name of choices) { try { return require(name).chromium; } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; } }
  throw new Error('Playwright is required for Chrome QA; set DELTA_QA_PLAYWRIGHT to its installed module');
}

async function runBrowserVerification(fixture) {
  const browser = await loadChromium().launch({ channel: process.env.WIDGET_QA_BROWSER_CHANNEL || 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
    const errors = [], external = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === fixture.relayOrigin || ['data:', 'about:'].includes(url.protocol)) return route.continue();
      external.push(url.origin); return route.abort();
    });
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    const probe = await context.newPage();
    const workload = buildWorkload({ epoch: Date.now(), steps: 16 });
    fixture.resetHistory();
    await probe.goto(fixture.publicBase + '/widget-overlay.html?qa=probe');
    assert.equal(await probe.evaluate(() => typeof window.TikMnGStatePatch?.apply), 'function');
    const browserBegin = fixture.responses.length;
    for (const frame of workload.frames) {
      fixture.setState(frame.state);
      const value = await probe.evaluate(() => window.qa.next());
      assert.deepEqual(snapshotOnly(value), frame.state, 'Chrome consumer snapshot: ' + frame.label);
    }
    const delivered = await probe.evaluate(() => window.qa.deliveries);
    assert.deepEqual([...delivered].sort(), [...workload.eventIds].sort());
    assert.equal(delivered.length, new Set(delivered).size, 'Each activity is dispatched exactly once despite overlapping history');
    assert.ok(fixture.responses.slice(browserBegin).some(row => row.kind === 'patch'), 'Chrome must negotiate actual delta responses');
    const recoveries = {};
    let recoveryStep = 0;
    for (const fault of ['bad-base', 'bad-operation', 'drop']) {
      const next = clone(fixture.state()); next.stats.totalCoins += ++recoveryStep;
      fixture.setState(next); fixture.armFault(fault);
      const start = fixture.responses.length;
      let value;
      try { value = await probe.evaluate(() => window.qa.next()); }
      catch (error) { assert.equal(fault, 'drop', 'Malformed patches must trigger automatic full fallback: ' + error.message); value = await probe.evaluate(() => window.qa.next()); }
      assert.deepEqual(snapshotOnly(value), next, 'Chrome recovers exact state after ' + fault);
      const rows = fixture.responses.slice(start);
      assert.ok(rows.some(row => row.fault === fault), 'Fault must actually affect a delta response');
      if (fault !== 'drop') assert.ok(rows.some(row => row.kind === 'full' && !row.query.base), 'Bad patches must cause an uncached full resync');
      recoveries[fault] = { exactSnapshot: true, requests: rows.length, fullResync: rows.some(row => row.kind === 'full') };
    }
    const beforeReconnect = fixture.websocket.connections;
    await fixture.reconnect();
    const reconnected = clone(fixture.state()); reconnected.stats.totalLikes += 71; fixture.setState(reconnected);
    const reconnectStart = fixture.responses.length;
    assert.deepEqual(snapshotOnly(await probe.evaluate(() => window.qa.next())), reconnected);
    assert.ok(fixture.responses.slice(reconnectStart).some(row => row.kind === 'full'));
    assert.equal(fixture.websocket.connections, beforeReconnect + 1);
    await probe.close();

    // These pages use the shipped widget renderer and its own polling/rendering code.
    const page = await context.newPage();
    let state = buildWorkload({ epoch: Date.now() }).frames[0].state;
    fixture.resetHistory(); fixture.setState(state);
    await page.goto(fixture.publicBase + '/widget-overlay.html?type=topgifter');
    await page.waitForFunction(() => document.querySelectorAll('[data-rank-person]').length === 9);
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth));
    await page.evaluate(() => { window.qaAvatars = new Map([...document.querySelectorAll('[data-rank-person]')].map(row => [row.dataset.rankPerson, row.querySelector('img')])); });
    const initialCapture = await page.screenshot({ omitBackground: true });
    const scoreLatencies = [];
    for (let step = 1; step <= 6; step++) {
      state = clone(state);
      const actor = state.topGifters.find(row => row.id === 'person-' + step);
      actor.totalCoins += 50000 + step;
      state.topGifters.sort((a, b) => b.totalCoins - a.totalCoins);
      const leader = state.topGifters[0].username;
      const at = Date.now(); fixture.setState(state);
      await page.waitForFunction(({ username, score, leader }) => {
        const row = [...document.querySelectorAll('[data-rank-person]')].find(row => row.dataset.rankPerson === username);
        return document.querySelector('[data-rank-person]')?.dataset.rankPerson === leader && row?.querySelector('.rank-amount')?.textContent === Number(score).toLocaleString('tr-TR');
      }, { username: actor.username, score: actor.totalCoins, leader }, { timeout: 2500 });
      scoreLatencies.push(Date.now() - at);
      assert.equal(await page.locator('[data-rank-person]').count(), 9);
    }
    const avatarsRetained = await page.evaluate(() => [...document.querySelectorAll('[data-rank-person]')].every(row => window.qaAvatars.get(row.dataset.rankPerson) === row.querySelector('img')));
    assert.ok(avatarsRetained, 'Busy score changes retain all nine avatar DOM elements');
    const changedCapture = await page.screenshot({ omitBackground: true });
    assert.notEqual(hash(initialCapture), hash(changedCapture), 'Busy leaderboard screenshot must change');
    const paintedPixels = await page.evaluate(async base64 => {
      const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0; for (let i = 0; i < data.length; i += 4) if (data[i + 3] && data[i] + data[i + 1] + data[i + 2] > 100) count++;
      return count;
    }, changedCapture.toString('base64'));
    assert.ok(paintedPixels > 1000, 'Actual Chrome screenshot contains rendered content');
    const layouts = [];
    for (const size of [{ width: 900, height: 700 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      const rows = await page.locator('[data-rank-person]').evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; }));
      assert.equal(rows.length, 9);
      assert.ok(rows.every(row => row.width > 0 && row.height > 0 && row.x >= 0 && row.y >= 0 && row.right <= size.width + 1 && row.bottom <= size.height + 1), 'All nine leaderboard rows fit ' + size.width);
      for (let i = 1; i < rows.length; i++) assert.ok(rows[i].y >= rows[i - 1].bottom - 1, 'Leaderboard rows must not overlap');
      layouts.push({ ...size, visibleRows: rows.length });
    }
    state = clone(state); state.topGifters = []; state.activities = []; state.topGift = null;
    state.studio.resets.topgifter = Date.now(); fixture.setState(state);
    await page.waitForFunction(() => document.querySelectorAll('[data-rank-person]').length === 0);
    await page.goto('about:blank');

    const rendererWorkload = buildWorkload({ epoch: Date.now(), steps: 8 });
    state = rendererWorkload.frames[0].state;
    fixture.resetHistory(); fixture.setState(state);
    await page.goto(fixture.publicBase + '/widget-overlay.html?type=actionwheel');
    await page.waitForFunction(() => typeof state === 'object' && state.channel === 'delta-qa');
    await page.evaluate(() => {
      window.qaEnqueued = [];
      const original = enqueue;
      enqueue = event => { window.qaEnqueued.push(event.id); return original(event); };
    });
    for (const frame of rendererWorkload.frames.slice(1).filter(frame => !frame.label.startsWith('idle-'))) {
      fixture.setState(frame.state);
      await page.waitForFunction(expected => {
        const value = { ...state }; delete value.__stateRevision; delete value.__stateToken;
        return JSON.stringify(value) === JSON.stringify(expected);
      }, frame.state, { timeout: 2500 });
      assert.deepEqual(snapshotOnly(await page.evaluate(() => state)), frame.state, 'Shipped renderer receives exact state at ' + frame.label);
    }
    const enqueued = await page.evaluate(() => window.qaEnqueued);
    assert.deepEqual([...enqueued].sort(), [...rendererWorkload.eventIds].sort(), 'Shipped receive/enqueue dispatches every burst ID exactly once');
    assert.equal(enqueued.length, new Set(enqueued).size);
    state = clone(fixture.state()); state.activities = [];
    state.studio.resets.actionwheel = Date.now(); fixture.setState(state);
    await page.waitForFunction(() => !document.querySelector('.wheel-face'));
    const giftAt = Date.now();
    state.activities = [{ id: 'latency-gift', type: 'gift', giftId: '5655', giftName: 'QA Rose', count: 1, coins: 1,
      username: 'latency_viewer', nickname: 'Latency Viewer', avatar: state.topGifters[0].avatar, createdAt: giftAt, actionWheelIndex: 0 }];
    fixture.setState(state);
    await page.locator('.wheel-face').waitFor({ timeout: 2500 });
    const giftLatencyMs = Date.now() - giftAt;
    assert.ok(giftLatencyMs < 1800, 'Gift should become visible within one normal polling interval plus relay time');
    assert.ok(await page.locator('.wheel-caption').textContent().then(text => text.includes('Latency Viewer')));
    await page.goto('about:blank');

    state.studio.pk.players[0].score = 777; state.studio.pk.teams[0].score = 777; fixture.setState(state);
    await page.goto(fixture.publicBase + '/widget-overlay.html?type=pk');
    await page.getByText('777', { exact: true }).first().waitFor({ timeout: 2500 });
    state.studio.pk.players[0].score = 0; state.studio.pk.teams[0].score = 0; fixture.setState(state);
    await page.waitForFunction(() => !document.body.textContent.includes('777'), null, { timeout: 2500 });
    await page.goto('about:blank');
    await eventually(() => fixture.pending() === 0, 'Chrome exit must release pending HTTP requests');
    assert.deepEqual(errors, [], 'Chrome has no script errors'); assert.deepEqual(external, [], 'No external network request is permitted');
    return { browser: await browser.version(), realChrome: true, exactSnapshots: workload.frames.length,
      uniqueActivityIds: delivered.length, duplicateActivityDispatches: delivered.length - new Set(delivered).size,
      slidingHistoryAllIdsExactlyOnce: true, shippedRendererActivityIdsExactlyOnce: enqueued.length,
      resetClearsVisibleRows: true, recovery: recoveries, reconnectFullResync: true,
      visibleLeaderboardRows: 9, layouts, stableAvatarElements: avatarsRetained, paintedScreenshotPixels: paintedPixels,
      screenshotBytes: changedCapture.length, screenshotSha256: hash(changedCapture), scoreLatenciesMs: scoreLatencies,
      giftLatencyMs, giftVisible: true, pkScoreAndExplicitZero: true, externalRequests: external, errors, pendingAtEnd: fixture.pending() };
  } finally { await browser.close(); }
}

async function runQA({ browser = true, http: measureHTTP = true } = {}) {
  const fixture = await createFixture();
  try {
    const result = { passed: true, synthetic: true, localOnlyNoRenderTraffic: true, productionRequests: 0,
      measurement: 'Actual loopback relay HTTP response body bytes, including gzip. Excludes HTTP/TLS/TCP headers, hosting billing rules, users and real Render usage. WebSocket numbers are JSON application-frame bytes, not network frame overhead.',
      relaySource: RELAY_ROOT };
    if (measureHTTP) { result.traffic = await runHttpComparison(fixture); result.httpRecovery = await runHttpRecovery(fixture); }
    if (browser) result.chrome = await runBrowserVerification(fixture);
    result.realWebSocketConnections = fixture.websocket.connections;
    return result;
  } finally { await fixture.close(); }
}

module.exports = { buildWorkload, createFixture, request, reconstruct, snapshotOnly, runHttpComparison, runHttpRecovery, runBrowserVerification, runQA };

if (require.main === module) {
  runQA({ browser: !process.argv.includes('--http-only'), http: !process.argv.includes('--browser-only') })
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}
