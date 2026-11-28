'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { setTimeout: delay } = require('node:timers/promises');
const { createWidgetPublisher } = require('../src/widget-publisher.cjs');
const { createWidgetPortraits } = require('../src/widgets/portraits.cjs');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hediye-box-portraits-widget-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  async function image(bytes = png, extension = 'png') {
    const file = path.join(directory, createHash('sha256').update(bytes).digest('hex') + '.' + extension);
    await fs.writeFile(file, bytes);
    return pathToFileURL(file).href;
  }
  return { directory, image };
}

async function waitFor(read, accept) {
  const deadline = Date.now() + 3000;
  do {
    const value = await read();
    if (accept(value)) return value;
    await delay(10);
  } while (Date.now() < deadline);
  assert.fail('Portrait state did not settle');
}

async function publisherFixture(t) {
  let transport, seq = 0;
  class Relay extends EventEmitter {
    readyState = 1; bufferedAmount = 0;
    constructor() { super(); transport = this; setImmediate(() => this.emit('open')); }
    send(value) { this.emit('outgoing', JSON.parse(value)); }
    close() { this.readyState = 3; }
    ping() { this.emit('pong'); }
  }
  const token = 'q'.repeat(43);
  const publisher = await createWidgetPublisher({ channel: 'tester',
    store: { get: () => 'a'.repeat(32), set() {} }, WebSocketImpl: Relay,
    getCredentials: async () => ({ licenseCode: 'private-test-license', deviceId: 'private-test-device' }),
    fetchImpl: async (url, options) => {
      if (url === 'https://mng-license-server1.onrender.com/api/overlay/session') {
        return Response.json({ token, ticket: 'fake-ticket', expiresAt: Date.now() + 120000,
          path: '/overlays/' + token, protocolVersion: 1, namedWidgetPaths: true });
      }
      assert.equal(new URL(url).hostname, '127.0.0.1', 'Tests must never fetch external images or credentials');
      return fetch(url, options);
    },
  });
  t.after(() => publisher.close());
  const urls = await publisher.getWidgetLinks();
  async function request(route, method = 'GET') {
    return new Promise((resolve, reject) => {
      const socket = transport, id = 'portrait' + ++seq, chunks = [];
      let status, headers;
      const timer = setTimeout(() => { socket.off('outgoing', receive); reject(Error('Relay timeout')); }, 3000);
      function receive(frame) {
        if (frame.id !== id) return;
        if (frame.type === 'headers') { status = frame.status; headers = frame.headers; }
        if (frame.type === 'chunk') chunks.push(Buffer.from(frame.data, 'base64'));
        if (frame.type === 'end' || frame.type === 'error') {
          clearTimeout(timer); socket.off('outgoing', receive);
          resolve({ status, headers, bytes: Buffer.concat(chunks) });
        }
      }
      socket.on('outgoing', receive);
      socket.emit('message', JSON.stringify({ type: 'request', id, path: route, method }));
    });
  }
  const state = async kind => JSON.parse((await request('/api/widget/state?type=hediye-box-' + kind)).bytes);
  return { publisher, urls, request, state };
}

test('cached owner portraits reach fighters, queue and champion through existing authenticated relay paths', async t => {
  const { image } = await fixture(t), local = await image();
  const { publisher, urls, request, state } = await publisherFixture(t);
  const person = { uniqueId: 'portrait_user', nickname: 'Portrait user', portrait: local,
    profilePictureUrls: [local, 'https://p16.ibyteimg.com/fallback.jpg'], privateToken: 'private-profile-secret' };
  publisher.setSnapshot({ audience: { active: { left: person }, queue: [{ ...person, fps: 73 }],
    settings: { punchGiftIdLeft: '5655', punchGiftIdRight: '5269' } }, spectator: { health: [.72, 1] },
    celebration: { fighter: person, wins: 4 }, privateToken: 'private-snapshot-secret' });
  person.nickname = 'Later mutation'; person.portrait = 'file:///private-replacement.png';
  const fighters = await waitFor(() => state('fighters'), value => value.rows[0].fighter.portrait.startsWith('../gift-assets/'));
  const profile = fighters.rows[0].fighter;
  assert.equal(profile.name, 'Portrait user');
  assert.equal(fighters.rows[0].hp, 72); assert.equal(fighters.rows[0].gift.id, '5655');
  assert.deepEqual(profile.portraitAlternatives, ['https://p16.ibyteimg.com/fallback.jpg']);
  assert.match(profile.portrait, /^\.\.\/gift-assets\/portrait-[a-f0-9-]{36}\.png$/);
  const queue = await state('queue'), winners = await state('winners');
  assert.equal(queue.rows[0].portrait, profile.portrait); assert.equal(queue.rows[0].coins, 73);
  assert.equal(winners.champion.portrait, profile.portrait); assert.equal(winners.champion.wins, 4);
  assert.doesNotMatch(JSON.stringify([fighters, queue, winners]), /file:|hediye-box-portraits|private-|base64/);
  const imageUrl = new URL(profile.portrait, urls.fighters);
  assert.equal(imageUrl.pathname, '/overlays/' + 'q'.repeat(43) + '/widget/gift-assets/' + profile.portrait.split('/').pop());
  const asset = '/widget/gift-assets/' + profile.portrait.split('/').pop();
  const photo = await request(asset);
  assert.equal(photo.status, 200); assert.equal(photo.headers['content-type'], 'image/png');
  assert.equal(photo.headers['cache-control'], 'private, max-age=86400'); assert.deepEqual(photo.bytes, png);
  const head = await request(asset, 'HEAD');
  assert.equal(head.status, 200); assert.equal(head.bytes.length, 0); assert.equal(+head.headers['content-length'], png.length);
  assert.equal((await request(asset, 'POST')).status, 400);
  assert.equal((await request('/widget/gift-assets/portrait-' + 'f'.repeat(36) + '.png')).status, 400);
  assert.equal((await request('/widget/gift-assets/portrait-ffffffff-ffff-ffff-ffff-ffffffffffff.png')).status, 404);
  assert.equal((await request('/widget/gift-assets/%2e%2e/private.png')).status, 400);
  const unchanged = await request('/api/widget/state?type=hediye-box-fighters&revision=' + fighters.revision);
  assert.equal(unchanged.status, 204);
  const page = await request('/widget/view/hediye-box-fighters');
  assert.match(page.headers['content-security-policy'], /img-src 'self' data:/);
  assert.match(page.headers['content-security-policy'], /https:\/\/\*\.ibyteimg\.com/);
  assert.match(page.headers['content-security-policy'], /connect-src 'self'/);
  assert.deepEqual(publisher.getUrls(), urls, 'Portrait updates must preserve accepted widget URLs');
  publisher.setChannel('other'); await publisher.getWidgetLinks();
  assert.equal((await state('fighters')).rows[0].fighter, null);
  assert.equal((await request(asset)).status, 404, 'Old channel cache is no longer exposed');
});

test('missing, oversized, non-image and unrelated local files preserve safe HTTPS portrait fallbacks', async t => {
  const { directory, image } = await fixture(t);
  const invalid = await image(Buffer.from('<html>private secret</html>'));
  const missing = pathToFileURL(path.join(directory, 'f'.repeat(64) + '.png')).href;
  const oversizedPath = path.join(directory, 'e'.repeat(64) + '.png');
  const file = await fs.open(oversizedPath, 'w');
  await file.truncate(4 * 1024 * 1024 + 1); await file.close();
  const unrelated = pathToFileURL(path.join(os.tmpdir(), 'private-avatar.png')).href;
  const { publisher, state } = await publisherFixture(t);
  const people = [invalid, missing, pathToFileURL(oversizedPath).href, unrelated].map((portrait, index) => ({
    nickname: 'Person ' + index, portrait, profilePictureUrls: ['https://p16.tiktokcdn.com/safe.jpg'],
  }));
  publisher.setSnapshot({ audience: { active: { left: people[0], right: people[1] }, queue: people.slice(2) } });
  await delay(60);
  const fighters = await state('fighters'), queue = await state('queue');
  for (const person of [...fighters.rows.map(row => row.fighter), ...queue.rows]) {
    assert.equal(person.portrait, 'https://p16.tiktokcdn.com/safe.jpg');
    assert.deepEqual(person.portraitAlternatives, []);
  }
});

test('replacing or clearing a pending cache cannot restore old portraits, and reads are reused', async t => {
  const { image } = await fixture(t), local = await image();
  let changes = 0;
  const cache = createWidgetPortraits(() => changes++);
  t.after(() => cache.clear());
  cache.resolve(local); cache.clear();
  await delay(40); assert.equal(changes, 0);
  const resolved = await waitFor(() => cache.resolve(local), Boolean);
  assert.equal(changes, 1);
  for (let i = 0; i < 30; i++) assert.equal(cache.resolve(local), resolved);
  assert.equal(changes, 1, 'Normal health/score ticks reuse the cached bytes');
  cache.retain(new Set()); assert.equal(cache.get(resolved.match(/portrait-(.+)\.png/)[1]), null);
});

test('all visible queue profiles load before older local alternatives can fill the bounded cache', async t => {
  const { image } = await fixture(t), people = [];
  for (let index = 0; index < 13; index++) {
    const urls = [];
    for (let variant = 0; variant < 3; variant++) urls.push(await image(Buffer.concat([png, Buffer.from(index + ':' + variant)])));
    people.push({ nickname: 'Person ' + index, portrait: urls[0], profilePictureUrls: urls });
  }
  const { publisher, state } = await publisherFixture(t);
  const input = { audience: { active: { left: people[0] }, queue: people.slice(2, 12) },
    celebration: { fighter: people[12], wins: 1 } };
  publisher.setSnapshot(input);
  const queue = await waitFor(() => state('queue'), data => data.rows.every(row => row.portrait.startsWith('../gift-assets/')));
  assert.equal(queue.rows.length, 10);
  assert.ok((await state('winners')).champion.portrait.startsWith('../gift-assets/'));
  // Fill the second corner after older fallback images have occupied the cache.
  await delay(40);
  input.audience.active.right = people[1]; publisher.setSnapshot(input);
  const fighters = await waitFor(() => state('fighters'), data => data.rows.every(row => row.fighter?.portrait.startsWith('../gift-assets/')));
  assert.equal(fighters.rows.length, 2);
  assert.ok((await state('queue')).rows.every(row => row.portrait.startsWith('../gift-assets/')));
});
