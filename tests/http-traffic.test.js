import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import express from 'express';
import { createHttpTraffic } from '../http-traffic.js';

test('HTTP meter counts actual UTF-8/chunk bodies, excludes HEAD and stores only fixed categories', async t => {
    const traffic = createHttpTraffic(), app = express();
    app.use(traffic.middleware);
    app.use((req, res) => { res.write('Merhaba '); res.end(Buffer.from('dünya')); });
    const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = 'http://127.0.0.1:' + server.address().port;
    const response = await fetch(base + '/overlays/private-token/api/widget/state?key=SECRET&channel=PRIVATE');
    const text = await response.text(); await (await fetch(base + '/overlays/other/api/widget/state', { method: 'HEAD' })).text();
    const snapshot = traffic.snapshot(), row = snapshot.categories.find(row => row.name === 'overlay-state');
    assert.equal(row.bodyBytes, Buffer.byteLength(text)); assert.equal(row.requests, 2); assert.equal(row.completed, 2);
    assert.equal(/SECRET|PRIVATE|private-token/.test(JSON.stringify(snapshot)), false);
    assert.equal(snapshot.personalDataRecorded, false);
});

test('HTTP meter has bounded hourly retention and classifies media separately from state', async t => {
    let time = 0; const traffic = createHttpTraffic({ now: () => time }), app = express(); app.use(traffic.middleware);
    app.use((req, res) => res.end('12345'));
    const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = 'http://127.0.0.1:' + server.address().port;
    await (await fetch(base + '/overlays/TOKEN/tikmng/media/file/123')).text();
    assert.equal(traffic.snapshot().categories.find(row => row.name === 'overlay-media').bodyBytes, 5);
    time = 49 * 3600000;
    await (await fetch(base + '/download/setup')).text();
    assert.equal(traffic.snapshot(48).categories.find(row => row.name === 'overlay-media').bodyBytes, 0);
    assert.equal(traffic.snapshot(48).categories.find(row => row.name === 'downloads').bodyBytes, 5);
});

test('HTTP meter does not invent bodies for 204/304 and separates errors from completed responses', async t => {
    const traffic = createHttpTraffic(), app = express(); app.use(traffic.middleware);
    app.use((req, res) => { res.statusCode = Number(req.query.status) || 404; res.end(res.statusCode === 404 ? 'missing' : undefined); });
    const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = 'http://127.0.0.1:' + server.address().port;
    for (const status of [204, 304, 404]) await (await fetch(base + '/?status=' + status)).text();
    const row = traffic.snapshot().categories.find(row => row.name === 'website');
    assert.equal(row.bodyBytes, 7); assert.equal(row.requests, 3); assert.equal(row.completed, 3); assert.equal(row.errors, 1);
});

test('state breakdown uses only bounded widget/transport labels and never stores scope or query contents', async t => {
    const traffic = createHttpTraffic(), app = express(); app.use(traffic.middleware);
    app.use((req, res) => res.end('12345'));
    const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = 'http://127.0.0.1:' + server.address().port;
    for (const route of [
        '/overlays/PRIVATE/api/widget/state?type=coinjar&key=SECRET',
        '/overlays/PRIVATE/api/widget/state?type=coinjar&transport=changes&channel=USERNAME',
        '/overlays/PRIVATE/api/widget/state?type=topliker&transport=changes&patch=1&base=PRIVATE',
        '/overlays/PRIVATE/widget/top-likes/state',
        '/overlays/PRIVATE/api/widget/state?type=SECRET',
        '/overlays/PRIVATE/api/widget/state?channel=USERNAME'
    ]) await (await fetch(base + route)).text();
    const snapshot = traffic.snapshot();
    assert.equal(snapshot.categories.find(row => row.name === 'overlay-state').bodyBytes, 30);
    assert.deepEqual(snapshot.stateWidgets.map(row => row.name).sort(), ['coinjar:changes', 'coinjar:snapshot', 'legacy-top-likes:snapshot', 'topliker:delta', 'unknown:snapshot', 'unscoped:snapshot']);
    assert.equal(/PRIVATE|SECRET|USERNAME/.test(JSON.stringify(snapshot)), false);
});
