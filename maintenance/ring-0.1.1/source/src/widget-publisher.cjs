'use strict';

const { createHash, randomBytes } = require('node:crypto');
const { existsSync } = require('node:fs');
const { readFile } = require('node:fs/promises');
const { createServer } = require('node:http');
const path = require('node:path');
const { createOverlayBridge } = require('./widgets/overlay-bridge.cjs');
const { kinds, gifts, portraitHosts, widgetSnapshot } = require('./widgets/snapshot.cjs');
const { createWidgetPortraits } = require('./widgets/portraits.cjs');

const relayOrigin = 'https://mng-license-server1.onrender.com';
const host = '127.0.0.1';
const titles = { fighters: 'Ringdeki boksörler', queue: 'Ring sırası', winners: 'Kazananlar' };
const route = kind => '/widget/view/hediye-box-' + kind;

function sharedWebSocket() {
  const packaged = path.join(__dirname, '../runtime/shared/runtime/node_modules/ws');
  return require(existsSync(packaged) ? packaged : 'D:/TikMnG/Animal-Times-Live/bridge/runtime/node_modules/ws');
}

// One instance per broadcast account. store is a persistent synchronous get/set
// store for the installation ID. getCredentials belongs to the licensed host.
async function createWidgetPublisher({ channel = '', store, getCredentials, onStatus = () => {}, testRelayOrigin, WebSocketImpl=sharedWebSocket(),fetchImpl=globalThis.fetch } = {}) {
  if (typeof store?.get !== 'function' || typeof store?.set !== 'function' || typeof getCredentials !== 'function') {
    throw new TypeError('An installation store and a credential provider are required');
  }
  const origin = testRelayOrigin ?? relayOrigin;
  if (origin !== relayOrigin && !/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(origin)) throw new TypeError('Invalid relay origin');
  const artwork=await readFile(path.join(__dirname,'../assets/widgets/cartoon-boxers-v1.webp'));
  const template = (await readFile(path.join(__dirname, 'widgets/view.html'), 'utf8'))
    .replaceAll('{{boxerArtwork}}','data:image/webp;base64,'+artwork.toString('base64'));
  const pages = new Map(kinds.map(kind => [route(kind), template.replaceAll('{{title}}', titles[kind]).replaceAll('{{kind}}', kind)]));
  const images = portraitHosts.flatMap(host => ['https://' + host, 'https://*.' + host]).join(' ');
  const policy = viewerOrigin => `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: ${viewerOrigin} ${images}; connect-src 'self' ${viewerOrigin}; base-uri 'none'; form-action 'none'`;
  const accessKey = randomBytes(32).toString('base64url');
  const statusWaiters = new Set();
  let selected = '';
  let closing;
  let state = {};
  let source;
  const portraits = createWidgetPortraits(publishSnapshot);
  function setSnapshot(snapshot) {
    if (closing) return;
    // Capture the sanitized profile data, rather than retaining mutable/private
    // game state across asynchronous cache reads.
    source = widgetSnapshot(snapshot, value => value);
    publishSnapshot();
  }
  function publishSnapshot() {
    if (closing) return;
    const next = structuredClone(source);
    const people = Object.values(next).flatMap(data => [...data.rows.map(row => row.fighter || row), data.champion]).filter(Boolean);
    const files = new Set(people.flatMap(person => [person.portrait, ...(person.portraitAlternatives || [])])
      .filter(value => typeof value === 'string' && value.startsWith('file:')));
    const preferred = new Set(people.map(person => person.portrait).filter(value => value?.startsWith('file:')));
    portraits.retain(files, preferred);
    // Reserve each visible person's preferred image before older alternatives
    // can consume the bounded cache (two corners, ten queue rows, one winner).
    for (const value of preferred) portraits.resolve(value);
    for (const person of people) {
      if (!person.portrait) continue;
      const values = [person.portrait, ...(person.portraitAlternatives || [])]
        .map(value => value.startsWith('file:') ? portraits.resolve(value) : value).filter(Boolean);
      person.portrait = values[0] || '';
      person.portraitAlternatives = [...new Set(values)].slice(1);
    }
    for (const kind of kinds) {
      const json = JSON.stringify(next[kind]);
      if (json === state[kind]?.json) continue;
      const revision = createHash('sha256').update(json).digest('base64url');
      state[kind] = { json, revision, body: JSON.stringify({ revision, ...next[kind] }) };
    }
  }
  setSnapshot(null);

  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.headers.host !== host + ':' + req.socket.localPort) return res.writeHead(403).end();
    if (!['GET', 'HEAD'].includes(req.method)) return res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    if (!req.url.startsWith('/') || req.url.startsWith('//') || req.url.includes('\\')) return res.writeHead(400).end();
    const { pathname, searchParams } = new URL(req.url, 'http://' + host);
    if (!selected || searchParams.get('key') !== accessKey || searchParams.get('channel') !== selected) {
      return res.writeHead(403).end();
    }
    const portrait = /^\/widget\/gift-assets\/portrait-([a-f0-9-]{36})\.png$/.exec(pathname);
    if (portrait) {
      const image = portraits.get(portrait[1]);
      if (!image) return res.writeHead(404).end();
      return res.writeHead(200, { 'Content-Type': image.mime, 'Content-Length': image.bytes.length,
        'Cache-Control': 'private, max-age=86400' }).end(req.method === 'HEAD' ? undefined : image.bytes);
    }
    if (pages.has(pathname)) {
      const csp = policy(origin);
      return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': csp })
        .end(req.method === 'HEAD' ? undefined : pages.get(pathname));
    }
    const icon = /^\/widget\/gift-assets\/(\d+)\.png$/.exec(pathname);
    if (icon && gifts.has(icon[1])) {
      try {
        const bytes = await readFile(path.join(__dirname, '../assets/catalog', icon[1] + '.png'));
        return res.writeHead(200, { 'Content-Type': 'image/png' }).end(req.method === 'HEAD' ? undefined : bytes);
      } catch { return res.writeHead(404).end(); }
    }
    const kind = kinds.find(kind => searchParams.get('type') === 'hediye-box-' + kind);
    if (pathname !== '/api/widget/state' || !kind) return res.writeHead(404).end();
    const { revision, body } = state[kind];
    if (searchParams.get('revision') === revision) return res.writeHead(204).end();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(req.method === 'HEAD' ? undefined : body);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, () => { server.off('error', reject); resolve(); });
  });
  const port = server.address().port;
  const bridge = createOverlayBridge({ store, port, accessKey, getCredentials, serverURL: origin, namespace: 'hediye-box',
    WebSocketImpl,fetchImpl, allowInsecureForTests: origin !== relayOrigin,
    onStatus: ({ status, ready, message }) => {
      if (status !== 'connecting') for (const done of statusWaiters) done();
      onStatus({ status, ready, message, urls: getUrls() });
    }
  });
  function getUrls() {
    return Object.fromEntries(kinds.map(kind => [kind, bridge.urlFor(`http://${host}:${port}${route(kind)}?studio=1`)]));
  }
  function setChannel(name) {
    const normalized = typeof name === 'string' ? name.trim().replace(/^@/, '').toLowerCase() : '';
    const next = /^[a-z0-9._-]{1,64}$/.test(normalized) && normalized !== 'varsayilan' ? normalized : '';
    if (closing || selected === next) return;
    bridge.stop();
    selected = next;
    portraits.clear();
    setSnapshot(null);
    if (selected) bridge.start(selected);
  }
  async function getWidgetLinks({refresh=false}={}) {
    if (closing) return getUrls();
    if(selected&&refresh&&!['connected','connecting'].includes(bridge.status().status)){bridge.stop();bridge.start(selected);}
    else if (selected && bridge.status().status === 'license-required') bridge.start(selected);
    if (bridge.status().status === 'connecting') await new Promise(resolve => {
      const done = () => { clearTimeout(timer); statusWaiters.delete(done); resolve(); };
      const timer = setTimeout(done, 16000);
      statusWaiters.add(done);
    });
    const urls = getUrls();
    if(!urls.fighters)throw new Error(bridge.status().message);
    return urls;
  }
  function close() {
    if (closing) return closing;
    closing = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    bridge.close();
    server.closeAllConnections();
    state = {};
    source = null;
    portraits.clear();
    return closing;
  }
  setChannel(channel);
  return { setChannel, setSnapshot, getUrls, getWidgetLinks, close };
}

module.exports = { createWidgetPublisher };
