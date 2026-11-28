'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { createHash, randomBytes } = require('node:crypto');
const { existsSync } = require('node:fs');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { setTimeout: delay } = require('node:timers/promises');
const { createWidgetPublisher } = require('../src/widget-publisher.cjs');

// Exercise the actual server relay without loading server.js, credentials, a
// broadcast connection, or the game. The server checkout is an optional fixture.
const relayFile = path.resolve(process.env.TIKMNG_WIDGET_RELAY_PROJECT ||
  path.join(__dirname, '../../../work/snake-video-launcher-7034'), 'overlay-relay.js');

test('real loopback relay serves packaged widget HTML, JSON and private cached portraits',
  { skip: !existsSync(relayFile), timeout: 15000 }, async t => {
    const requireServer = createRequire(relayFile);
    const express = requireServer('express'), { WebSocket } = requireServer('ws');
    const { registerOverlayRelay } = await import(pathToFileURL(relayFile).href);
    const app = express();
    const relay = registerOverlayRelay(app, { secret: randomBytes(32), authorize: input => {
      assert.equal(input.licenseCode, 'integration-fake-license');
      return { ownerId: 'integration-fake-owner' };
    } });
    const server = createServer(app);
    let publisher, directory;
    t.after(async () => {
      await publisher?.close();
      await relay.close();
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
      if (directory) await fs.rm(directory, { recursive: true, force: true });
    });
    relay.attach(server);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const origin = 'http://127.0.0.1:' + server.address().port;
    const localFetch = async (url, options) => {
      assert.equal(new URL(url).hostname, '127.0.0.1', 'All integration traffic stays on loopback');
      return fetch(url, { ...options, signal: options?.signal || AbortSignal.timeout(5000) });
    };
    publisher = await createWidgetPublisher({ channel: 'integration_creator', testRelayOrigin: origin,
      store: { get: () => 'a'.repeat(32), set() {} }, WebSocketImpl: WebSocket, fetchImpl: localFetch,
      getCredentials: async () => ({ licenseCode: 'integration-fake-license', deviceId: 'integration-fake-device' }),
    });
    const urls = await publisher.getWidgetLinks();
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hediye-box-portraits-relay-test-'));
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
    const cachedFile = path.join(directory, createHash('sha256').update(bytes).digest('hex') + '.png');
    await fs.writeFile(cachedFile, bytes);
    const person = { uniqueId: 'integration_viewer', nickname: 'Integration portrait', portrait: pathToFileURL(cachedFile).href };
    const input = { audience: { active: { left: person }, queue: [{ ...person, fps: 23 }],
      settings: { punchGiftIdLeft: '5655', punchGiftIdRight: '5269' } },
      spectator: { health: [.8, 1] }, celebration: { fighter: person, wins: 2 }, secret: 'must-not-escape' };
    publisher.setSnapshot(input);
    const template = (await fs.readFile(path.join(__dirname, '../src/widgets/view.html'), 'utf8'))
      .replaceAll('{{boxerArtwork}}', 'data:image/webp;base64,' +
        (await fs.readFile(path.join(__dirname, '../assets/widgets/cartoon-boxers-v1.webp'))).toString('base64'));
    const titles = { fighters: 'Ringdeki boksörler', queue: 'Ring sırası', winners: 'Kazananlar' };
    for (const [kind, url] of Object.entries(urls)) {
      assert.match(new URL(url).pathname, new RegExp('^/overlays/[A-Za-z0-9_-]{43}/widget/view/hediye-box-' + kind + '$'));
      const page = await localFetch(url);
      assert.equal(page.status, 200);
      assert.equal(await page.text(), template.replaceAll('{{kind}}', kind).replaceAll('{{title}}', titles[kind]),
        'The relay must return the exact packaged HTML, rather than a server-generated widget');
      assert.match(page.headers.get('cache-control'), /no-store/);
      assert.match(page.headers.get('content-security-policy'), /sandbox allow-scripts/);
      assert.match(page.headers.get('content-security-policy'), /img-src 'self' data:/);
      const api = new URL('../../api/widget/state', url);
      api.searchParams.set('type', 'hediye-box-' + kind);
      let response, data, identity;
      for (let attempt = 0; attempt < 80; attempt++) {
        response = await localFetch(api); assert.equal(response.status, 200);
        data = await response.json();
        identity = kind === 'fighters' ? data.rows[0].fighter : kind === 'queue' ? data.rows[0] : data.champion;
        if (identity.portrait) break;
        await delay(10);
      }
      assert.match(identity.portrait, /^\.\.\/gift-assets\/portrait-[a-f0-9-]{36}\.png$/);
      assert.doesNotMatch(JSON.stringify(data), /file:|must-not-escape|integration-fake|hediye-box-portraits/);
      assert.match(response.headers.get('cache-control'), /no-store/);
      api.searchParams.set('revision', data.revision);
      assert.equal((await localFetch(api)).status, 204);
      const asset = new URL(identity.portrait, url);
      const photo = await localFetch(asset);
      assert.equal(photo.status, 200); assert.equal(photo.headers.get('content-type'), 'image/png');
      assert.equal(photo.headers.get('cache-control'), 'private, max-age=86400, no-transform');
      assert.equal(photo.headers.get('access-control-allow-origin'), '*');
      assert.equal(photo.headers.has('access-control-allow-credentials'), false);
      assert.deepEqual(Buffer.from(await photo.arrayBuffer()), bytes);
      const head = await localFetch(asset, { method: 'HEAD' });
      assert.equal(head.status, 200); assert.equal((await head.arrayBuffer()).byteLength, 0);
      const denied = new URL(asset); denied.searchParams.set('channel', 'other_creator');
      assert.equal((await localFetch(denied)).status, 403);
      assert.equal((await localFetch(asset, { method: 'POST' })).status, 405);
    }
    publisher.setSnapshot(null);
    assert.equal((await localFetch(urls.queue)).status, 200, 'The accepted URLs remain available after a roster clear');
    assert.deepEqual(publisher.getUrls(), urls);
  });
