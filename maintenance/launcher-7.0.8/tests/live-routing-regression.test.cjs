'use strict';

// Execute the launcher's real routing functions with only in-memory profiles and SDK fixtures.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { EventEmitter } = require('node:events');
const { createPlatform } = require('../lib/platform.cjs');
const { handoffGameAccount } = require('../lib/game-account-handoff.cjs');
const http = require('node:http');
const { WebSocketServer } = require('ws');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const catalog = require('../lib/catalog-defaults.json');
const plain = value => JSON.parse(JSON.stringify(value));

function section(start, end) {
  const first = source.indexOf(start), last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, 'Expected actual main.js routing section: ' + start);
  return source.slice(first, last);
}
function definitions() {
  const start = source.indexOf('const OYUN_TANIMLARI = '), end = source.indexOf('\n};', start);
  assert.ok(start >= 0 && end > start);
  return plain(vm.runInNewContext(source.slice(start, end + 3) + '\nOYUN_TANIMLARI', {
    preview: { enabled: false }, require: createRequire(path.join(root, 'main.js'))
  }));
}
class FixtureConnection extends EventEmitter {
  constructor() { super(); this.isConnected = false; this.wsClient = { terminate() {} }; }
  async connect() { this.isConnected = true; return { roomId: '7381234567890123456', isConnected: true }; }
  async disconnect() { this.isConnected = false; }
}
function routing(t, seed = []) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-routing-'));
  const values = new Map([['tiktok_active_account', 'host_a'], ['media_root_v1', path.join(directory, 'media')]]);
    for (const [key,value] of seed) values.set(key,structuredClone(value));
  const store = { get: (key, fallback) => structuredClone(values.get(key) ?? fallback),
    set: (key, value) => { if(key&&typeof key==='object'){for(const [k,v]of Object.entries(key))values.set(k,structuredClone(v));}else values.set(key, structuredClone(value)); } };
  let now = 1700000000000, activeGame = '';
  class Clock extends Date { static now() { return now; } }
  const connections = [], handlers = new Map(), notifications = [], emitted = [];
  const context = vm.createContext({ fs, path, crypto, URL, Buffer, Date: Clock,
    __dirname: root, process: { env: {}, resourcesPath: path.join(directory, 'resources') },
    require: createRequire(path.join(root, 'main.js')), store, WIDGET_PORT: 65430,
    overlayBridge: null, platform: null, app: { isQuiting: false },
    mainWindow: { webContents: { send: (name, data) => notifications.push({ name, data: plain(data) }) } },
    widgetTikTokModulunuYukle: async () => true, WebcastEvent: {},
    TikTokLiveConnection: class extends FixtureConnection { constructor() { super(); connections.push(this); } },
    onIzlemeArsiviniHazirla() {}, setTimeout, clearTimeout, setInterval, clearInterval });
  vm.runInContext('let widgetLiveSession=null;let widgetLiveStatus={};\n' +
    section('const widgetRecentEvents = ', 'function widgetEulerAnahtariniBul(') +
    section('function widgetEulerAnahtariniBul(', 'function widgetSunucusunuBaslat('), context);
  const api = vm.runInContext('({profile:widgetTikTokProfiliniOku,gift:widgetTikTokHediyesiniOku,event:widgetGenelOlayEkle,state:widgetBirlesikDurum,reset:widgetSahnesiniSifirla,change:widgetKanaliniDegistir,start:widgetTikTokYenidenBaglan,close:widgetTikTokBaglantisiniKapat,image:widgetHediyeGorseliBul,url:widgetKatmanUrl,widgets:WIDGET_DEFINITIONS,channel:()=>widgetChannel})', context);
  const platform = createPlatform({ store, definitions: definitions(), accessKey: 'synthetic-routing-key', port: 65430,
    app: { getPath: () => directory, getVersion: () => 'qa' },
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) }, dialog: {},
    getWindow: () => ({ webContents: { send: (name, data) => notifications.push({ name, data: plain(data) }) } }),
    serverURL: () => 'https://synthetic.invalid', getChannel: api.channel, getActiveGame: () => activeGame,
    profile: api.profile, gift: api.gift, event: api.event, setLiveStatus() {}, closeDirect: async () => {},
    resolveLegacy: () => null, validate: () => false, extract: async () => assert.fail('No game install'), isRunning: () => false,
    speechService: { status: async () => ({ voices: [], providers: {} }), cancel() {} },
    voicePacks: { close() {} } });
  context.platform = { ingest: (...args) => { emitted.push(plain(args)); return platform.ingest(...args); } };
  t.after(async () => {
    await api.close(); platform.close();
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { api, platform, connections, notifications, emitted, values,
    async serveWidgets() {
      let server;
      context.platform.handleRequest = (...args) => platform.handleRequest(...args);
      context.console = console;
      context.http = { createServer(handler) {
        server = http.createServer(handler);
        const listen = server.listen.bind(server);
        server.listen = () => listen(0, '127.0.0.1');
        return server;
      } };
      vm.runInContext('let widgetServer=null;\n' +
        section('function widgetSunucusunuBaslat()', '// =====================================================================') +
        '\nwidgetSunucusunuBaslat()', context);
      await new Promise(resolve => server.once('listening', resolve));
      t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
      });
      return 'http://127.0.0.1:' + server.address().port;
    },
    advance: ms => { now += ms; }, active: id => { activeGame = id; },
    invoke: async (name, data = {}) => {
      const handler = handlers.get('workspace-' + name); assert.equal(typeof handler, 'function');
      const result = await handler({}, data); assert.equal(result?.error, undefined, name + ' IPC failed'); return result;
    } };
}

test('identified comments and gifts stay deduplicated after a full process restart without blocking new identical text', t => {
  const first=routing(t);
  const comment={username:'viewer',message:'Merhaba',eventId:'durable-comment'};
  const event=first.api.event('chat',comment);assert.ok(event);
  first.advance(3600000);assert.equal(first.api.event('chat',comment),null);
  const gift={username:'viewer',giftId:'5655',coins:1,eventId:'durable-gift'};
  const original=first.api.event('gift',gift);assert.ok(original);
  const receipts=first.values.get('widget_event_receipts_v2');
  assert.ok(receipts.length>=2);assert.ok(!JSON.stringify(receipts).includes('Merhaba'));
  const restarted=routing(t,[['widget_event_receipts_v2',receipts]]);
  assert.equal(restarted.api.event('chat',comment),null);assert.equal(restarted.api.event('gift',gift),null);
  assert.ok(restarted.api.event('chat',{...comment,eventId:'new-comment'}));
  restarted.api.change('host_b');assert.ok(restarted.api.event('chat',comment),'A different channel retains an independent receipt namespace');
});

test('Viral Benim promotes higher gifts with profiles, keeps ties, and manual reset permits a new small leader',t=>{
  const f=routing(t),gift=(eventId,username,giftId,coins,avatar)=>f.api.event('gift',{eventId,username,giftId,coins,count:1,avatar});
  gift('rose','first','5655',1,'https://example.invalid/first.png');assert.equal(f.api.state().topGift.username,'first');
  gift('tea','second','5303',50,'https://example.invalid/second.png');assert.equal(f.api.state().topGift.username,'second');assert.match(f.api.state().topGift.avatar,/second/);
  gift('tie','third','5303',50,'https://example.invalid/third.png');assert.equal(f.api.state().topGift.username,'second');
  f.api.reset('topgift');assert.equal(f.api.state().topGift,null);
  f.advance(1);gift('after-reset','fourth','5655',1,'https://example.invalid/fourth.png');assert.equal(f.api.state().topGift.username,'fourth');
});

test('Viral Benim survives a network drop but clears after a verified stream end',async t=>{
  const network=routing(t);await network.api.start('host_a');network.api.event('gift',{eventId:'before-network',username:'a',giftId:'5655',coins:1});
  network.connections[0].emit('disconnected');assert.equal(network.api.state().topGift.username,'a');
  const ended=routing(t);await ended.api.start('host_a');ended.api.event('gift',{eventId:'before-end',username:'a',giftId:'5655',coins:1});
  ended.connections[0].emit('streamEnd');assert.equal(ended.api.state().topGift,null);
});

test('all catalog games expose separate scoped media routes and only the active game receives exact gift 7934', async t => {
  const f = routing(t), snapshot = f.platform.snapshot();
  assert.equal(snapshot.games.length, catalog.games.length);
  assert.deepEqual(snapshot.games.map(g => g.id).sort(), catalog.games.map(g => g.id).sort());
  assert.equal(new Set(snapshot.games.map(g => g.overlayUrl)).size, catalog.games.length);
  for (const game of snapshot.games) {
    const url = new URL(game.overlayUrl); assert.equal(url.searchParams.get('game'), game.id);
    assert.equal(url.searchParams.get('channel'), 'host_a');
    await f.invoke('media-save', { url: 'https://synthetic.invalid/' + game.id + '.mp4', kind: 'video',
      title: game.id, gameId: game.id, giftId: '7934', enabled: true });
  }
  const before = f.notifications.filter(n => n.name === 'workspace-media-event').length;
  for (const game of snapshot.games) {
    f.active(game.id);
    f.api.event('gift', { username: 'viewer', giftId: '5655', giftName: 'Beni Sev', coins: 1, eventId: game.id + '-wrong' });
    f.api.event('gift', { username: 'viewer', giftId: '7934', giftName: 'Different localized name', coins: 1, eventId: game.id + '-right' });
  }
  const events = f.notifications.filter(n => n.name === 'workspace-media-event').slice(before);
  assert.equal(events.length, catalog.games.length);
  assert.deepEqual(events.map(n => n.data.item.gameId), snapshot.games.map(g => g.id));
  assert.ok(events.every(n => n.data.item.giftId === '7934'));
});

test('all 20 gallery widgets consume normalized events; removed tools retain no gallery entry', t => {
  const f = routing(t), a = f.api;
  assert.equal(a.widgets.length, 20);assert.equal(new Set(a.widgets.map(w => w.id)).size, 20);
  assert.ok(!a.widgets.some(w=>['userinfo','tinydiny'].includes(w.id)));
  for (const widget of a.widgets) {
    const url = new URL(a.url(widget.id));assert.equal(url.hostname, '127.0.0.1');
    assert.equal(url.pathname, ['topgifter','topliker'].includes(widget.id)?'/widget-leaderboard.html':'/widget-overlay.html');
    assert.equal(url.searchParams.get('type'), widget.id);assert.equal(url.searchParams.get('channel'), 'host_a');
  }
  a.event('gift', { username: 'viewer', nickname: 'Viewer', avatar: 'https://synthetic.invalid/avatar.png', giftId: '6064', giftName: 'GG', coins: 7, count: 7, eventId: 'gg-final' });
  a.event('like', { username: 'viewer', likeCount: 123, eventId: 'likes' });
  for (const type of ['follow', 'share', 'subscribe']) a.event(type, { username: 'viewer', eventId: type });
  a.event('viewer', { viewerCount: 31, eventId: 'viewers' });
  const state = plain(a.state());
  assert.equal(state.stats.totalCoins, 7);assert.equal(state.stats.totalLikes, 123);
  assert.equal(state.stats.followers, 1);assert.equal(state.stats.totalShares, 1);assert.equal(state.stats.subscribers, 1);assert.equal(state.stats.viewerCount, 31);
  assert.equal(state.topGift.giftId, '6064');assert.equal(state.topGifters[0].totalCoins, 7);
  assert.equal(state.topLikes[0].totalLikes, 123);assert.equal(state.jarGifts.length, 7);
  assert.equal(state.ranking[0].username, 'viewer');assert.ok(state.activities.some(v => v.type === 'gift'));
});

test('actual widget HTTP handlers serve all generated links and legacy schemas with account isolation', async t => {
  const f = routing(t), origin = await f.serveWidgets();
  f.api.event('gift', { username: 'fixture_viewer', giftId: '5655', giftName: 'Rose', coins: 12, count: 2, eventId: 'http-gift' });
  f.api.event('like', { username: 'fixture_viewer', likeCount: 37, eventId: 'http-like' });
  f.api.event('viewer', { viewerCount: 23, eventId: 'http-viewers' });
  const auth = new URL(f.api.url('topgift')).search;
  const jarQuery = new URLSearchParams(auth);
  jarQuery.set('type', 'coinjar');
  async function read(route, query = auth) {
    const response = await fetch(origin + route + query);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get('content-type'), /application\/json/, route);
    return response.json();
  }
  for (const widget of f.api.widgets) {
    const url = new URL(f.api.url(widget.id));
    const response = await fetch(origin + url.pathname + url.search);
    assert.equal(response.status, 200, widget.id);
    assert.match(response.headers.get('content-type'), /text\/html/, widget.id);
    assert.match(await response.text(), /<script/, widget.id);
  }
  for (const prefix of ['/widget', '/api/widget']) {
    assert.equal((await read(prefix + '/top-gift/state')).top.username, 'fixture_viewer');
    assert.equal((await read(prefix + '/top-likes/state')).entries[0].totalLikes, 37);
    assert.equal((await read(prefix + '/leaderboard/state')).entries[0].totalCoins, 12);
    assert.ok((await read(prefix + '/activity/state')).entries.some(item => item.type === 'gift'));
    const state = await read(prefix + '/state');
    assert.equal(state.stats.viewerCount, 23);
    assert.equal(state.topGift.giftId, '5655');
    assert.deepEqual(state.jarGifts, [], 'Only the jar route carries jar history');
    assert.equal((await read(prefix + '/state', '?' + jarQuery)).jarGifts.length, 2);
  }
  const gift = await read('/api/widget/state');
  const image = new URL(gift.topGift.giftImage);
  const artwork = await fetch(origin + image.pathname + image.search);
  assert.equal(artwork.status, 200);
  assert.equal(artwork.headers.get('content-type'), 'image/png');
  assert.equal(Buffer.from(await artwork.arrayBuffer()).subarray(1, 4).toString(), 'PNG');
  assert.equal((await fetch(origin + '/api/widget/state')).status, 403);
  assert.equal((await fetch(origin + '/api/widget/state?key=wrong')).status, 403);
  f.api.change('host_b');
  const nextAuth = new URL(f.api.url('topgift')).search;
  assert.equal((await read('/api/widget/state', nextAuth)).topGift, null);
  assert.equal((await read('/api/widget/state', auth)).topGift.username, 'fixture_viewer');
});

test('legacy VS widget proxies authenticate to their owning launcher and preserve upstream failures', async t => {
  const f = routing(t), origin = await f.serveWidgets();
  const key = new URL(f.api.url('topgift')).searchParams.get('key');
  const legacy = fs.readFileSync(path.join(process.env.MNG_TEST_APPS_ROOT||path.join(root,'../apps'), 'tiktok-vs/server.js'), 'utf8');
  const start = legacy.indexOf('function widgetStateProxy(') >= 0 ? legacy.indexOf('function widgetStateProxy(') : legacy.indexOf('app.get("/widget/top-gift/state"');
  const end = legacy.indexOf('app.get("/api/backgrounds"', start);
  assert.ok(start >= 0 && end > start);
  const routes = new Map(), upstreams = [];
  const env = { MNG_WIDGET_PORT: new URL(origin).port, MNG_WIDGET_ACCESS_KEY: key };
  let mode = 'normal';
  vm.runInNewContext(legacy.slice(start, end), {
    URL, Buffer, process: { env },
    app: { get(paths, handler) { for (const route of [paths].flat()) routes.set(route, handler); } },
    http: { get(target, callback) {
      const url = new URL(target); upstreams.push(new URL(url));
      // Keep even the broken fixed-port implementation away from installed services.
      url.port = new URL(origin).port;
      if (mode === 'denied') url.searchParams.set('key', 'wrong');
      if (mode === 'html') return http.get(origin + '/widget-overlay.html' + new URL(f.api.url('topgift')).search, callback);
      if (mode === 'schema') return http.get(origin + '/api/widget/state' + new URL(f.api.url('topgift')).search, callback);
      if (mode === 'offline') {
        const request = http.get(url, callback);
        queueMicrotask(() => request.destroy(new Error('Synthetic publisher offline')));
        return request;
      }
      return http.get(url, callback);
    } }
  });
  f.api.event('gift', { username: 'proxy_viewer', coins: 9, giftId: '5655', eventId: 'proxy-gift' });
  const proxy = http.createServer((req, res) => {
    res.status = status => { res.statusCode = status; return res; };
    res.json = data => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(data)); };
    routes.get(new URL(req.url, origin).pathname)(req, res);
  });
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  t.after(async () => { proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve)); });
  const base = 'http://127.0.0.1:' + proxy.address().port;
  for (const route of ['/widget/top-gift/state', '/widget/top-likes/state', '/widget/leaderboard/state']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /application\/json/);
    const data = await response.json(); assert.ok(Array.isArray(data.entries));
    if (route.includes('top-gift/')) assert.equal(data.top.username, 'proxy_viewer');
  }
  assert.ok(upstreams.every(url => url.port === new URL(origin).port && url.searchParams.get('key') === key));
  mode = 'denied';
  const denied = await fetch(base + '/widget/top-gift/state');
  assert.equal(denied.status, 403);assert.equal((await denied.json()).top, null);
  mode = 'html';
  const invalid = await fetch(base + '/widget/leaderboard/state');
  assert.equal(invalid.status, 502);assert.deepEqual((await invalid.json()).entries, []);
  mode = 'schema';
  assert.equal((await fetch(base + '/widget/leaderboard/state')).status, 502);
  mode = 'offline';
  assert.equal((await fetch(base + '/widget/top-likes/state')).status, 503);
  const before = upstreams.length;
  env.MNG_WIDGET_ACCESS_KEY = '';
  assert.equal((await fetch(base + '/widget/top-gift/state')).status, 503);
  assert.equal(upstreams.length, before, 'Missing credentials never probe another installation');
});

test('Node runtime selection supplies the owning stable or preview widget endpoint', () => {
  for (const port of [31975, 31976]) {
    for (const mode of ['packaged', 'node', 'fallback']) {
      const runtime = vm.runInNewContext(section('function nodeBilgisiBul()', 'async function geleneGeceneKoprusunuBaslat(') + '\nnodeBilgisiBul()', {
        WIDGET_PORT: port, WIDGET_ACCESS_KEY: 'a'.repeat(32), APP_PORT: 3000,
        app: { isPackaged: mode === 'packaged' }, process: { execPath: 'synthetic-electron', env: { MNG_WIDGET_PORT: '9999', MNG_WIDGET_ACCESS_KEY: 'wrong' } },
        path, os, require: () => ({ execSync() { if (mode === 'fallback') throw new Error('No standalone Node'); } })
      });
      assert.equal(runtime.env.MNG_WIDGET_PORT, String(port), mode);
      assert.equal(runtime.env.MNG_WIDGET_ACCESS_KEY, 'a'.repeat(32), mode);
    }
  }
});

test('known raw profile paths preserve identity and avatar, including v3 displayId', async t => {
  const f = routing(t), avatar = 'https://synthetic.invalid/viewer.png';
  const variants = [
    { uniqueId: '@viewer', nickname: 'Friendly Display', profilePictureUrls: [avatar] },
    { user: { uniqueId: '@viewer', nickname: 'Friendly Display', avatarThumb: { urlList: [avatar] } } },
    { userInfo: { uniqueId: 'viewer', nickname: 'Friendly Display', avatar_large: { url_list: [avatar] } } },
    { user: { displayId: 'viewer', nickname: 'Friendly Display', avatarThumb: { urlList: [avatar] } } },
    { username: 'viewer', nickname: 'Friendly Display', avatar }
  ];
  for (const [index, payload] of variants.entries()) await t.test('profile shape ' + index, () => {
    assert.deepEqual(plain(f.api.profile(payload)), { username: 'viewer', nickname: 'Friendly Display', avatar, fanClubLevel: null });
  });
});
test('widget profiles prefer real large and medium photos over small thumbnails', t => {
  const f=routing(t),large='https://synthetic.invalid/large.png',medium='https://synthetic.invalid/medium.png',thumb='https://synthetic.invalid/thumb.png';
  assert.equal(f.api.profile({user:{uniqueId:'viewer',avatarLarge:{urlList:[large]},avatarMedium:{urlList:[medium]},avatarThumb:{urlList:[thumb]},profilePictureUrls:[thumb]}}).avatar,large);
  assert.equal(f.api.profile({userInfo:{uniqueId:'viewer',avatar_medium:{url_list:[medium]},avatar_thumb:{url_list:[thumb]}}}).avatar,medium);
  assert.equal(f.api.profile({user:{uniqueId:'viewer',avatarLarge:{urlList:[]},avatarThumb:{urlList:[thumb]}}}).avatar,thumb);
});

test('real SDK v3 chat content and common.msgId survive direct callback routing', async t => {
  const f = routing(t);await f.api.start('host_a');
  f.connections[0].emit('chat', { common: { msgId: 'sdk-chat-1' }, user: { uniqueId: 'viewer' }, content: 'A non-empty viewer question' });
  const event = f.emitted.find(([type]) => type === 'chat');
  assert.ok(event);assert.equal(event[1].message, 'A non-empty viewer question');assert.equal(event[1].eventId, 'sdk-chat-1');
});

test('real SDK v3 roomUser total becomes the viewer count', async t => {
  const f = routing(t);await f.api.start('host_a');
  f.connections[0].emit('roomUser', { common: { msgId: 'sdk-viewer-1' }, total: '42', totalUser: '900' });
  assert.equal(f.api.state().stats.viewerCount, 42);
});

test('distinct common.msgId like batches both count while a repeated common.msgId does not', async t => {
  const f = routing(t);await f.api.start('host_a');
  const payload = { user: { uniqueId: 'viewer' }, count: 7, total: '7' };
  f.connections[0].emit('like', { ...payload, common: { msgId: 'likes-one' } });
  f.connections[0].emit('like', { ...payload, common: { msgId: 'likes-two' } });
  f.connections[0].emit('like', { ...payload, common: { msgId: 'likes-two' } });
  assert.equal(f.api.state().stats.totalLikes, 14, 'Two real batches must not collapse to one same-second fallback fingerprint');
});

test('real SDK v3 gift.type=1 progress is ignored and final repetition is delivered once', async t => {
  const f = routing(t);await f.api.start('host_a');
  const payload = { common: { msgId: 'gift-common' }, logId: 'gift-final-log', giftId: '5655', repeatCount: 3,
    user: { uniqueId: 'viewer' }, gift: { id: '5655', name: 'Rose', type: 1, diamondCount: 1 }, repeatEnd: 0 };
  f.connections[0].emit('gift', payload);
  assert.equal(f.api.state().stats.totalCoins, 0, 'Unfinished v3 streak must not count coins or trigger effects');
  f.connections[0].emit('gift', { ...payload, repeatEnd: 1 });
  f.connections[0].emit('gift', { ...payload, repeatEnd: 1 });
  assert.equal(f.api.state().stats.totalCoins, 3);
  assert.equal(f.emitted.filter(([type]) => type === 'gift').length, 1);
});

test('flat SDK streak final, duplicate ID and retired-account events are handled once', async t => {
  const f = routing(t);await f.api.start('host_a');const old = f.connections[0];
  const gift = { msgId: 'flat-final', uniqueId: 'viewer', giftId: '5655', giftName: 'Rose', diamondCount: 1, repeatCount: 3, giftType: 1 };
  old.emit('gift', { ...gift, repeatEnd: false });assert.equal(f.api.state().stats.totalCoins, 0);
  old.emit('gift', { ...gift, repeatEnd: true });old.emit('gift', { ...gift, repeatEnd: true });
  assert.equal(f.api.state().stats.totalCoins, 3);
  f.api.change('host_b');await f.api.start('host_b');
  old.emit('gift', { ...gift, msgId: 'late-old-event', repeatEnd: true });
  assert.equal(f.api.state().stats.totalCoins, 0);
  f.connections.at(-1).emit('gift', { ...gift, msgId: 'new-room-event', repeatEnd: true });
  assert.equal(f.api.state().stats.totalCoins, 3);assert.equal(f.api.state('host_a').stats.totalCoins, 3);
});

test('same legitimate event ID in a different account is not suppressed by the previous account cache', t => {
  const f = routing(t), gift = { username: 'viewer', giftId: '7934', coins: 1, eventId: 'room-local-id' };
  f.api.event('gift', gift);f.api.change('host_b');f.api.event('gift', gift);
  assert.equal(f.api.state('host_a').stats.totalCoins, 1);assert.equal(f.api.state('host_b').stats.totalCoins, 1);
});

test('a retried gift ID after three seconds cannot double widget totals while media suppresses it', async t => {
  const f = routing(t);await f.invoke('media-save', { kind: 'video', url: 'https://synthetic.invalid/retry.mp4', giftId: '5655', enabled: true });
  const gift = { username: 'viewer', giftId: '5655', coins: 2, eventId: 'retry-id' };
  f.api.event('gift', gift);f.advance(3000);f.api.event('gift', gift);
  assert.equal(f.notifications.filter(n => n.name === 'workspace-media-event').length, 1);
  assert.equal(f.api.state().stats.totalCoins, 2, 'Widget/media must agree on replayed gift IDs');
});

test('explicit gift ID wins over a conflicting localized gift name for widget artwork', t => {
  const f = routing(t);
  assert.equal(new URL(f.api.image('Gül', '6064')).pathname, '/widget/gift-assets/6064.png');
  assert.equal(new URL(f.api.image('GG', '5655')).pathname, '/widget/gift-assets/5655.png');
  assert.equal(new URL(f.api.image('unknown', '7934')).pathname, '/widget/gift-assets/7934.png');
});

test('speech entitlement requires exact gift ID and is cleared across accounts without an overlay connection', async t => {
  const f = routing(t);
  await f.invoke('tts', { enabled: true, audience: 'gift', giftId: '7934', voicePreset: 'natural' });
  f.api.event('gift', { username: 'viewer', giftId: '5655', giftName: 'Beni Sev', coins: 1, eventId: 'wrong-tts-gift' });
  f.api.event('chat', { username: 'viewer', message: 'blocked', eventId: 'blocked-chat' });
  assert.equal(f.notifications.filter(n => n.name === 'workspace-chat').length, 0);
  f.api.event('gift', { username: 'viewer', giftId: '7934', coins: 1, eventId: 'correct-tts-gift' });
  f.api.event('chat', { username: 'viewer', message: 'allowed', eventId: 'allowed-chat' });
  assert.equal(f.notifications.filter(n => n.name === 'workspace-chat').length, 1);
  f.api.change('host_b');f.api.event('chat', { username: 'viewer', message: 'other account', eventId: 'foreign-chat' });
  assert.equal(f.notifications.filter(n => n.name === 'workspace-chat').length, 1);
});

test('actual profile fanClubLevel survives direct routing to platform and missing/inactive club data cannot reuse eligibility', async t => {
  const f = routing(t);
  await f.invoke('tts', { enabled: true, audience: 'fanclub', voicePreset: 'natural' });
  await f.api.start('host_a');const connection = f.connections[0];
  const user = { uniqueId: 'viewer', nickname: 'Viewer' };
  const active = { user: { ...user, fansClubInfo: { fansLevel: '4', isSleeping: false } } };
  assert.equal(f.api.profile(active).fanClubLevel, 4);
  connection.emit('chat', { ...active, comment: 'club member', msgId: 'club-active' });
  const accepted = f.notifications.filter(n => n.name === 'workspace-chat');
  assert.equal(accepted.length, 1);assert.equal(accepted[0].data.fanClubLevel, 4);
  assert.equal(f.emitted.at(-1)[1].fanClubLevel, 4, 'Normalized metadata must reach platform ingest');
  connection.emit('chat', { user, comment: 'no evidence', msgId: 'club-unknown' });
  connection.emit('chat', { user: { ...user, fansClub: { data: { level: 4, userFansClubStatus: 2 } } }, comment: 'inactive', msgId: 'club-inactive' });
  assert.equal(f.notifications.filter(n => n.name === 'workspace-chat').length, 1);
  f.api.change('host_b');await f.api.start('host_b');
  f.connections.at(-1).emit('chat', { user, comment: 'new account without evidence', msgId: 'club-other-account' });
  assert.equal(f.notifications.filter(n => n.name === 'workspace-chat').length, 1);
});

test('supported game handoffs use actual HTTP/WS transports on isolated ports (external Steam launch is separate)', async t => {
  const wsTypes = { vs: 'connect-live', puanlama: 'puanlama-baglan', orbit: 'connect', 'crowd-control': 'connect', 'battle-game': 'connect', 'duck-hunt': 'connect', 'penalty-kick': 'connect' };
  for (const game of catalog.games.filter(g => g.id !== 'gelene-gecene')) await t.test(game.id, async t => {
    const messages = [], requests = [], sockets = new Set();let delivered;
    const received = new Promise(resolve => { delivered = resolve; });
    const server = http.createServer((req, res) => {
      requests.push({ path: req.url, method: req.method, token: req.headers['x-session-token'] });
      if (req.url === '/api/session') return res.end(JSON.stringify({ token: 'synthetic_session' }));
      let body = '';req.on('data', chunk => { body += chunk; });req.on('end', () => { delivered(JSON.parse(body));res.end('{}'); });
    });
    const websocket = new WebSocketServer({ server });
    server.on('connection', socket => { sockets.add(socket);socket.on('close', () => sockets.delete(socket)); });
    websocket.on('connection', (socket, req) => {
      socket.on('message', raw => { const body = JSON.parse(raw);messages.push({ path: req.url, body });if (body.username) delivered(body); });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { for (const client of websocket.clients) client.terminate();for (const socket of sockets) socket.destroy();await new Promise(resolve => websocket.close(resolve));await new Promise(resolve => server.close(resolve)); });
    const result = await handoffGameAccount({ gameId: game.id, username: '@synthetic_host', baseURL: 'http://127.0.0.1:' + server.address().port });
    assert.deepEqual(result, { requested: true });const payload = await received;
    assert.equal(payload.username, 'synthetic_host');
    if (wsTypes[game.id]) { assert.equal(messages.length, 1);assert.equal(messages[0].body.type, wsTypes[game.id]);assert.equal(messages[0].path, '/'); }
    else if (game.id === 'pony-life') { assert.deepEqual(messages.map(m => m.path), ['/live', '/live']);assert.deepEqual(messages[0].body, { token: 'synthetic_session' }); }
    else {
      assert.equal(requests.at(-1).path, ['snow-war', 'battle-royale', 'zombie-war', 'minecraft-snake-arena'].includes(game.id) ? '/connect' : '/api/connect');
      if (game.id === 'frog-river') assert.equal(requests.at(-1).token, 'synthetic_session');
    }
  });
});
