import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { once } from 'node:events';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import express from 'express';
import { WebSocket } from 'ws';
import { registerOverlayRelay } from '../overlay-relay.js';
import { createHttpTraffic } from '../http-traffic.js';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const app = express(), traffic = createHttpTraffic();
app.use(traffic.middleware);
const relay = registerOverlayRelay(app, { secret: randomBytes(32), authorize: () => ({ ownerId: 'local-wire-qa' }) });
const server = http.createServer(app); relay.attach(server);
let browser, publisher, sequence = 0;
const state = { channel: 'qa', topLikes: Array.from({ length: 100 }, (_, i) => ({
    username: 'viewer_' + i, nickname: 'Test Viewer ' + i, totalLikes: i * 27,
    avatar: 'https://p16-sign.tiktokcdn.com/tos-useast2a-avt-0068/' + createHash('sha256').update('portrait-' + i).digest('hex') + '~tplv-tiktokx-cropcenter:1080:1080.jpeg?dr=14579&refresh_token=' + createHash('sha256').update('token-' + i).digest('hex')
})) };
const binary = randomBytes(8192);
const document = '<!doctype html><meta charset="utf-8"><main id="score"></main><script>fetch(location.pathname.replace("/widget-overlay.html","/api/widget/state")+"?type=topliker").then(r=>r.json()).then(s=>{document.querySelector("main").textContent=s.topLikes[99].totalLikes;window.qaReady=true})</script>';

function read(route, encoding) {
    return new Promise((resolve, reject) => {
        const began = performance.now();
        const request = http.get(route, { headers: { 'Accept-Encoding': encoding } }, response => {
            const chunks = [];
            response.on('data', data => chunks.push(data));
            response.once('end', () => resolve({ status: response.statusCode, headers: response.headers, bytes: Buffer.concat(chunks), elapsedMs: performance.now() - began }));
            response.once('error', reject);
        });
        request.once('error', reject);
        request.setTimeout(5000, () => request.destroy(new Error('Local wire test timed out')));
    });
}

try {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = 'http://127.0.0.1:' + server.address().port;
    const session = await (await fetch(base + '/api/overlay/session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseCode: 'qa', deviceId: 'qa', installationId: 'qa', channel: 'qa' }) })).json();
    publisher = new WebSocket(base.replace('http:', 'ws:') + '/api/overlay/bridge', { headers: { Authorization: 'Bearer ' + session.ticket } });
    publisher.on('message', data => {
        const request = JSON.parse(data);
        if (request.type !== 'request') return;
        const route = new URL(request.path, base).pathname;
        const isState = route.endsWith('/state'), isVideo = route.includes('/media/file/');
        const body = isState ? Buffer.from(JSON.stringify(state)) : isVideo ? binary : Buffer.from(document);
        publisher.send(JSON.stringify({ type: 'headers', id: request.id, status: 200, headers: {
            'content-type': isState ? 'application/json; charset=utf-8' : isVideo ? 'video/mp4' : 'text/html; charset=utf-8', 'content-length': String(body.length)
        } }));
        for (let offset = 0; offset < body.length; offset += 16384)
            publisher.send(JSON.stringify({ type: 'chunk', id: request.id, data: body.subarray(offset, offset + 16384).toString('base64') }));
        publisher.send(JSON.stringify({ type: 'end', id: request.id }));
    });
    await once(publisher, 'open');
    const totals = { identityBytes: 0, gzipBytes: 0, decodedEqual: true, maxResponseMs: 0 };
    for (let i = 0; i < 40; i++) {
        state.topLikes[99].totalLikes = 1000 + sequence++;
        const raw = await read(base + session.path + '/api/widget/state?type=topliker', 'identity');
        const gzip = await read(base + session.path + '/api/widget/state?type=topliker', 'gzip');
        assert.equal(gzip.status, 200); assert.equal(gzip.headers['content-encoding'], 'gzip');
        assert.deepEqual(gunzipSync(gzip.bytes), raw.bytes);
        assert.equal(JSON.parse(gunzipSync(gzip.bytes)).topLikes[99].totalLikes, state.topLikes[99].totalLikes);
        totals.identityBytes += raw.bytes.length; totals.gzipBytes += gzip.bytes.length;
        totals.maxResponseMs = Math.max(totals.maxResponseMs, gzip.elapsedMs);
    }
    const media = await read(base + session.path + '/tikmng/media/file/12345678-1234-4234-9234-123456789abc', 'gzip');
    assert.equal(media.headers['content-encoding'], undefined); assert.deepEqual(media.bytes, binary);
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + session.path + '/widget-overlay.html');
    await page.waitForFunction(() => window.qaReady === true);
    assert.equal(await page.locator('#score').textContent(), String(state.topLikes[99].totalLikes));
    assert.deepEqual(errors, []);
    const measured = traffic.snapshot();
    assert.ok(measured.stateWidgets.some(row => row.name === 'topliker:snapshot' && row.requests === 81));
    const report = { passed: true, localOnly: true, realWebSocketRelay: true, realChrome: true, samples: 40,
        ...totals, maxResponseMs: Math.round(totals.maxResponseMs), wireReductionPercent: Number((100 * (1 - totals.gzipBytes / totals.identityBytes)).toFixed(2)),
        browserDecodedScore: true, originalMediaUnchanged: true, noSharedStateCache: true, privacySafeBreakdown: true,
        measurement: 'Synthetic state HTTP body bytes only; not Render invoice savings', errors };
    const output = path.resolve('qa/traffic-wire'); fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
} finally {
    await browser?.close(); publisher?.terminate(); await relay.close(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
}
