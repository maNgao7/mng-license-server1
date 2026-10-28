'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const { WebSocket } = require('ws');

const launcher = path.resolve(__dirname, '..');
const gameSource = path.join(process.env.MNG_TEST_APPS_ROOT||path.resolve(launcher,'../apps'),'tiktok-vs');
const runtime = process.env.GAME_WIDGET_NODE_MODULES || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { chromium } = require(path.join(runtime, 'playwright'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function until(read, predicate, label, timeout = 5000) {
  const end = Date.now() + timeout;
  let value;
  do { value = await read(); if (predicate(value)) return value; await pause(40); } while (Date.now() < end);
  assert.fail(label + ': ' + JSON.stringify(value));
}

async function widgetLauncher(t, key) {
  const source = fs.readFileSync(path.join(launcher, 'main.js'), 'utf8');
  const section = (first, last) => {
    const start = source.indexOf(first), end = source.indexOf(last, start);
    assert.ok(start >= 0 && end > start, first);
    return source.slice(start, end);
  };
  const values = new Map([['tiktok_active_account', 'fixture_host']]);
  const requests = [];
  let server;
  const context = vm.createContext({
    fs, path, crypto, URL, Buffer, __dirname: launcher,
    process: { env: { MNG_WIDGET_ACCESS_KEY: key } },
    require: createRequire(path.join(launcher, 'main.js')),
    store: { get: (k, fallback) => structuredClone(values.get(k) ?? fallback), set: (k, v) => values.set(k, structuredClone(v)) },
    WIDGET_PORT: 0, overlayBridge: null, platform: null,
    onIzlemeArsiviniHazirla() {}, console: { warn() {} },
    http: { createServer(handler) {
      server = http.createServer((req, res) => { requests.push({ method: req.method, url: req.url }); handler(req, res); });
      const listen = server.listen.bind(server);
      server.listen = () => listen(0, '127.0.0.1');
      return server;
    } }
  });
  vm.runInContext(section('const widgetRecentEvents = ', 'function widgetEulerAnahtariniBul(') +
    '\nlet widgetServer=null;\n' + section('function widgetSunucusunuBaslat()', '// =====================================================================') +
    '\nwidgetSunucusunuBaslat();', context);
  await once(server, 'listening');
  context.WIDGET_PORT = server.address().port;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  return { key, origin, requests, state: () => fetch(origin + '/widget/state?key=' + key).then(r => r.json()) };
}

async function gameProcess(t, directory, owner) {
  fs.mkdirSync(path.join(directory, 'public'), { recursive: true });
  for (const file of fs.readdirSync(gameSource)) {
    if (/\.(?:js|cjs)$/.test(file) || file === 'package.json') fs.copyFileSync(path.join(gameSource, file), path.join(directory, file));
  }
  for (const file of fs.readdirSync(path.join(gameSource, 'public'))) {
    if (/^widget.*\.(html|js|css)$/.test(file)) fs.copyFileSync(path.join(gameSource, 'public', file), path.join(directory, 'public', file));
  }
  for (const folder of ['gifts', 'gift-images']) {
    const from = path.join(gameSource, 'public/assets', folder), to = path.join(directory, 'public/assets', folder);
    fs.mkdirSync(to, { recursive: true });
    for (const file of fs.readdirSync(from)) {
      if (folder === 'gifts' || file === 'Rose.png') {
        if (fs.statSync(path.join(from, file)).isFile()) fs.copyFileSync(path.join(from, file), path.join(to, file));
      }
    }
  }
  fs.symlinkSync(path.join(gameSource, 'node_modules'), path.join(directory, 'node_modules'), 'junction');
  fs.writeFileSync(path.join(directory, 'fixture-sdk.mjs'), `
    import { EventEmitter } from 'node:events';
    export const WebcastEvent = Object.fromEntries(['CHAT','MEMBER','FOLLOW','LIKE','GIFT','ROOM_USER','DISCONNECTED','STREAM_END'].map(x=>[x,x.toLowerCase()]));
    const clients=[];
    export class TikTokLiveConnection extends EventEmitter {
      constructor(name){super();this.name=name;clients.push(this);}
      async connect(){process.send?.({fixture:'connected',index:clients.indexOf(this)});return {roomId:'fixture-only'};}
      async disconnect(){}
      async fetchAvailableGifts(){return [];}
    }
    process.on('message',m=>{if(m.fixture!=='emit')return;clients[m.index]?.emit(m.event,m.data);process.send?.({fixture:'emitted',id:m.id});});
  `);
  fs.writeFileSync(path.join(directory, 'fixture-guard.mjs'), `
    import fs from 'node:fs';
    import net from 'node:net';
    import { registerHooks, syncBuiltinESMExports } from 'node:module';
    const read=fs.readFileSync;
    fs.readFileSync=function(p,...a){if(/avatar.cache|euler.api.key/i.test(String(p)))throw new Error('Private fixture read blocked');return read.call(this,p,...a)};
    syncBuiltinESMExports();
    globalThis.fetch=async()=>{throw new Error('External fixture fetch blocked')};
    const connect=net.Socket.prototype.connect;
    net.Socket.prototype.connect=function(...a){const v=Array.isArray(a[0])?a[0][0]:a[0];const o=typeof v==='object'?v:{port:v,host:a[1]};if(!['127.0.0.1','localhost','::1'].includes(o.host||o.hostname)||Number(o.port)!==${new URL(owner.origin).port})throw new Error('Unexpected outbound fixture socket');return connect.apply(this,a)};
    registerHooks({resolve(s,c,next){if(s==='tiktok-live-connector')return {url:new URL('./fixture-sdk.mjs',import.meta.url).href,shortCircuit:true};if(s==='puppeteer')return {url:'data:text/javascript,export default {launch:async()=>{throw new Error("Fixture browser disabled")}}',shortCircuit:true};return next(s,c);}});
  `);
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['--import', pathToFileURL(path.join(directory, 'fixture-guard.mjs')).href, 'server.js'], {
    cwd: directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, PORT: String(port), MNG_WIDGET_PORT: new URL(owner.origin).port,
      MNG_WIDGET_ACCESS_KEY: owner.key, USERPROFILE: directory, APPDATA: directory, MNG_BACKGROUNDS_DIR: directory }
  });
  let logs = '';
  const messages = [];
  child.stdout.on('data', b => logs += b);
  child.stderr.on('data', b => logs += b);
  child.on('message', m => messages.push(m));
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, 'exit'); } });
  const origin = 'http://127.0.0.1:' + port;
  await until(async () => {
    if (child.exitCode !== null) assert.fail(logs);
    try { return (await fetch(origin + '/widget.html')).status; } catch { return 0; }
  }, status => status === 200, 'Fresh game server did not start');
  const socket = new WebSocket('ws://127.0.0.1:' + port);
  const frames = [];
  socket.on('message', b => frames.push(JSON.parse(b)));
  await once(socket, 'open');
  t.after(() => socket.terminate());
  let sequence = 0;
  return {
    origin, frames, messages, logs: () => logs,
    send: m => socket.send(JSON.stringify(m)),
    async emit(index, event, data) {
      const id = ++sequence;
      child.send({ fixture: 'emit', id, index, event, data });
      await until(() => messages, all => all.some(m => m.fixture === 'emitted' && m.id === id), 'Fixture event not acknowledged');
    }
  };
}

test('VS/Puanlama copied widget URLs consume real local transports on two fresh keyed launches', { timeout: 90000 }, async t => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const directories = [];
  t.after(async () => {
    await browser.close();
    for (const directory of directories) {
      assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
  let previousKey;
  for (const launch of [1, 2]) await t.test('fresh launch ' + launch, async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-vs-widget-'));
    directories.push(directory);
    const owner = await widgetLauncher(t, crypto.randomBytes(16).toString('hex'));
    assert.notEqual(owner.key, previousKey);
    previousKey = owner.key;
    const game = await gameProcess(t, directory, owner);
    const context = await browser.newContext();
    t.after(() => context.close());
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return [game.origin, owner.origin].includes(url.origin) ? route.continue() : route.abort();
    });
    const pages = new Map(), sockets = [];
    for (const route of ['/widget.html', '/widget-vs.html', '/widget-vs-winners.html', '/widget-top-gift.html', '/widget-top-likes.html', '/widget-leaderboard.html']) {
      const page = await context.newPage();
      page.on('websocket', socket => sockets.push(socket.url()));
      const response = await page.goto(game.origin + route);
      assert.equal(response.status(), 200, route);
      assert.match(response.headers()['content-type'], /text\/html/);
      pages.set(route, page);
    }
    game.send({ type: 'puanlama-goster', uniqueId: 'fixture_profile', nickname: 'Fixture Profile' });
    game.send({ type: 'puanlama-basla', saniye: 60 });
    await pages.get('/widget.html').locator('#profileName').filter({ hasText: '@fixture_profile' }).waitFor();
    assert.ok(sockets.every(url => url === game.origin.replace('http:', 'ws:') + '/'), JSON.stringify(sockets));
    assert.equal(sockets.length, 3);
    game.send({ type: 'connect-live', username: 'fixture_host' });
    await until(() => game.messages, all => all.filter(m => m.fixture === 'connected').length === 2, 'Main and Puanlama SDK fixtures connected');
    const user = { displayId: 'fixture_viewer', uniqueId: 'fixture_viewer', nickname: 'Fixture Viewer' };
    await game.emit(1, 'chat', { user, content: '8' });
    await pages.get('/widget.html').locator('#scoreAvg').filter({ hasText: '8.0' }).waitFor();
    await game.emit(1, 'follow', { user: {...user,displayId:'fixture_follower',nickname:'Fixture Follower'} });
    await until(() => game.frames, all => all.some(m => m.type === 'puanlamaViewers' && JSON.stringify(m).includes('fixture_follower')), 'Puanlama follow reached game clients');
    const gift = { user, giftId: 5655, giftName: 'Rose', diamondCount: 7, repeatCount: 1, giftType: 0 };
    await game.emit(0, 'gift', gift);
    await game.emit(1, 'gift', gift);
    await game.emit(0, 'like', { user, likeCount: 9 });
    await game.emit(1, 'like', { user, likeCount: 9 });
    const state = await until(owner.state, s => s.stats.totalCoins === 7 && s.stats.totalLikes === 9, 'Game events did not reach owning launcher');
    assert.equal(state.stats.totalGifts, 1, 'Dual game connections deliver each gift once');
    for (const route of ['/widget-top-gift.html', '/widget-top-likes.html', '/widget-leaderboard.html']) {
      await pages.get(route).getByText('@fixture_viewer', { exact: true }).first().waitFor({ timeout: 5000 });
    }
    for (const name of ['top-gift', 'top-likes', 'leaderboard']) {
      for (const prefix of ['/widget/', '/api/widget/']) {
        const response = await fetch(game.origin + prefix + name + '/state');
        assert.equal(response.status, 200);
        assert.ok(Array.isArray((await response.json()).entries));
      }
    }
    game.send({ type: 'battle-start', duration: 5 });
    game.send({ type: 'battle-score', side: 'left', value: 17 });
    await pages.get('/widget-vs.html').locator('#leftScore').filter({ hasText: '17' }).waitFor();
    await pages.get('/widget-vs-winners.html').locator('.row .name').first().waitFor({ timeout: 8000 });
    for (const request of owner.requests.filter(r => r.method === 'POST')) {
      assert.equal(new URL(request.url, owner.origin).searchParams.get('key'), owner.key);
    }
    const before = owner.requests.filter(r => r.method === 'POST').length;
    game.send({ type: 'disconnect-live' });
    await until(() => game.frames, all => all.some(m => m.type === 'status' && /kesildi/.test(m.message)), 'Main connection closed');
    await game.emit(1, 'gift', { ...gift, diamondCount: 11 });
    await game.emit(1, 'like', { user, likeCount: 4 });
    await until(owner.state, s => s.stats.totalCoins === 18 && s.stats.totalLikes === 13, 'Puanlama-only events reached launcher');
    assert.equal(owner.requests.filter(r => r.method === 'POST').length - before, 2);
    await game.emit(1, 'gift', { ...gift, giftType:1, repeatCount:3, repeatEnd:false, diamondCount:11, msgId:'fixture-streak-'+launch });
    await pause(100);
    assert.equal((await owner.state()).stats.totalCoins,18,'Unfinished root-level gift streak is not credited');
    await game.emit(1, 'gift', { ...gift, giftType:1, repeatCount:3, repeatEnd:true, diamondCount:11, msgId:'fixture-streak-'+launch });
    await until(owner.state, s=>s.stats.totalCoins===51,'Completed streak reaches owning launcher with its exact repeat value');
    assert.doesNotMatch(game.logs(), /Cannot access 'kimlik'|hediye is not defined|Unexpected outbound fixture socket/);
    await t.test('owning launcher rejects absent and wrong read keys', async () => {
      assert.equal((await fetch(owner.origin + '/widget/top-gift/state?key=wrong')).status, 403);
      const deniedOwner = await fetch(owner.origin + '/widget/top-gift/state');
      assert.equal(deniedOwner.status, 403);
    });
  });
});
