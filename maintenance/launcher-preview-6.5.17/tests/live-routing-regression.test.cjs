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
  return plain(vm.runInNewContext(source.slice(start, end + 3) + '\nOYUN_TANIMLARI'));
}
class FixtureConnection extends EventEmitter {
  constructor() { super(); this.isConnected = false; this.wsClient = { terminate() {} }; }
  async connect() { this.isConnected = true; return { roomId: '7381234567890123456', isConnected: true }; }
  async disconnect() { this.isConnected = false; }
}
function routing(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-routing-'));
  const values = new Map([['tiktok_active_account', 'host_a'], ['media_root_v1', path.join(directory, 'media')]]);
  const store = { get: (key, fallback) => structuredClone(values.get(key) ?? fallback),
    set: (key, value) => values.set(key, structuredClone(value)) };
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
  const api = vm.runInContext('({profile:widgetTikTokProfiliniOku,gift:widgetTikTokHediyesiniOku,event:widgetGenelOlayEkle,state:widgetBirlesikDurum,change:widgetKanaliniDegistir,start:widgetTikTokYenidenBaglan,close:widgetTikTokBaglantisiniKapat,image:widgetHediyeGorseliBul,url:widgetKatmanUrl,widgets:WIDGET_DEFINITIONS,channel:()=>widgetChannel})', context);
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
  return { api, platform, connections, notifications, emitted,
    advance: ms => { now += ms; }, active: id => { activeGame = id; },
    invoke: async (name, data = {}) => {
      const handler = handlers.get('workspace-' + name); assert.equal(typeof handler, 'function');
      const result = await handler({}, data); assert.equal(result?.error, undefined, name + ' IPC failed'); return result;
    } };
}

test('all 14 catalog games expose separate scoped media routes and only the active game receives exact gift 7934', async t => {
  const f = routing(t), snapshot = f.platform.snapshot();
  assert.equal(snapshot.games.length, 14);
  assert.deepEqual(snapshot.games.map(g => g.id).sort(), catalog.games.map(g => g.id).sort());
  assert.equal(new Set(snapshot.games.map(g => g.overlayUrl)).size, 14);
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
  assert.equal(events.length, 14);
  assert.deepEqual(events.map(n => n.data.item.gameId), snapshot.games.map(g => g.id));
  assert.ok(events.every(n => n.data.item.giftId === '7934'));
});

test('all 13 widget definitions consume shared normalized gift/like/follow/share/viewer state', t => {
  const f = routing(t), a = f.api;
  assert.equal(a.widgets.length, 13);assert.equal(new Set(a.widgets.map(w => w.id)).size, 13);
  for (const widget of a.widgets) {
    const url = new URL(a.url(widget.id));assert.equal(url.hostname, '127.0.0.1');
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

test('supported game handoffs use actual HTTP/WS transports on isolated ports (13 games; Steam is separate)', async t => {
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
      assert.equal(requests.at(-1).path, ['snow-war', 'battle-royale', 'zombie-war'].includes(game.id) ? '/connect' : '/api/connect');
      if (game.id === 'frog-river') assert.equal(requests.at(-1).token, 'synthetic_session');
    }
  });
});
