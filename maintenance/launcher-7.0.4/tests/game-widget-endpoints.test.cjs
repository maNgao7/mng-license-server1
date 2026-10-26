'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { randomBytes } = require('node:crypto');

const apps = path.resolve(__dirname, '../../apps');
const games = ['tiktok-vs', 'mng-orbit', 'crowd-control', 'battle-game', 'duck-hunt', 'penalty-kick'];

function loadHelpers(game, env, request) {
  const source = fs.readFileSync(path.join(apps, game, 'server.js'), 'utf8');
  const start = source.indexOf('function widgetEventPost(') >= 0
    ? source.indexOf('function widgetEventPost(') : source.indexOf('function widgetGiftPost(');
  const marker = game === 'tiktok-vs' ? '\n// ===' : game === 'mng-orbit' ? '\nfunction findTikTokVsDir(' : '\nconst app =';
  const end = source.indexOf(marker, start);
  assert.ok(start >= 0 && end > start, game + ' event helpers found');
  return vm.runInNewContext(source.slice(start, end) + '\n({ gift: widgetGiftPost, like: typeof widgetLikePost === "function" ? widgetLikePost : null })', {
    process: { env }, http: { request }, Buffer, URL, WIDGET_PORT: 31975
  });
}

for (const game of games) {
  test(game + ': event posts reach only the configured keyed launcher', async t => {
    const key = randomBytes(16).toString('hex'), received = [], requests = [], completions = [];
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.searchParams.get('key') !== key) { res.writeHead(403).end('Forbidden'); return; }
      let body = '';
      req.setEncoding('utf8');
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        received.push({ route: url.pathname, payload: JSON.parse(body) });
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const port = server.address().port;
    const helpers = loadHelpers(game, { MNG_WIDGET_PORT: String(port), MNG_WIDGET_ACCESS_KEY: key }, (options, callback) => {
      requests.push(options);
      // A broken fixed-port helper must never contact an installed launcher.
      if (Number(options.port) !== port || options.hostname !== '127.0.0.1') {
        return Object.assign(new EventEmitter(), { end() {}, destroy() {} });
      }
      const req = http.request(options, response => {
        callback(response);
        completions.push(new Promise(resolve => response.on('end', resolve)));
      });
      completions.push(new Promise((resolve, reject) => { req.on('close', resolve); req.on('error', reject); }));
      return req;
    });
    const gift = { username: 'fixture_viewer', nickname: 'Fixture', giftName: 'Rose', coins: 7 };
    const like = { username: 'fixture_viewer', likeCount: 9 };
    helpers.gift(gift);
    if (helpers.like) helpers.like(like);
    assert.equal(requests.length, helpers.like ? 2 : 1);
    for (const request of requests) {
      assert.equal(Number(request.port), port, 'No hardcoded/stable fallback port');
      assert.equal(new URL(request.path, 'http://127.0.0.1').searchParams.get('key'), key);
    }
    await Promise.all(completions);
    assert.deepEqual(received, [{ route: '/api/widget/gift', payload: gift }, ...(helpers.like ? [{ route: '/api/widget/like', payload: like }] : [])]);
  });

  test(game + ': absent or invalid endpoint credentials never send to another installation', () => {
    for (const env of [{}, { MNG_WIDGET_ACCESS_KEY: 'a'.repeat(32) },
      { MNG_WIDGET_PORT: '31976' }, { MNG_WIDGET_PORT: '31976', MNG_WIDGET_ACCESS_KEY: 'wrong' },
      { MNG_WIDGET_PORT: '0', MNG_WIDGET_ACCESS_KEY: 'a'.repeat(32) },
      { MNG_WIDGET_PORT: '65536', MNG_WIDGET_ACCESS_KEY: 'a'.repeat(32) }]) {
      let attempts = 0;
      const helpers = loadHelpers(game, env, () => { attempts++; throw new Error('Unexpected request'); });
      helpers.gift({ username: 'fixture' });
      helpers.like?.({ username: 'fixture' });
      assert.equal(attempts, 0, JSON.stringify(env));
    }
  });

  test(game + ': a stalled post destroys its socket and consumes responses', async t => {
    let resolveRequest, resolveClosed;
    const arrived = new Promise(resolve => resolveRequest = resolve);
    const closed = new Promise(resolve => resolveClosed = resolve);
    const server = http.createServer(req => { req.on('close', resolveClosed); resolveRequest(); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    let request;
    const helpers = loadHelpers(game, { MNG_WIDGET_PORT: String(server.address().port), MNG_WIDGET_ACCESS_KEY: 'a'.repeat(32) }, (options, callback) => {
      assert.equal(Number(options.port), server.address().port);
      return request = http.request(options, callback);
    });
    helpers.gift({ username: 'fixture' });
    await arrived;
    let timer;
    try {
      await Promise.race([closed, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Widget POST socket did not time out')), 2500); })]);
      assert.equal(request.destroyed, true);
    } finally { clearTimeout(timer); request?.destroy(); }
  });
}
