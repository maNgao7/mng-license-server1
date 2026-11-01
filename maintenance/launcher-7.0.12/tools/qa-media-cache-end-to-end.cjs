'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { createMediaStudio } = require('../lib/media-studio.cjs');
const { createOverlayBridge } = require('../lib/overlay-bridge.cjs');
const root = fs.mkdtempSync('D:/TikMnG-Update-QA-20261030/cache-check-');
const values = new Map(), store = { get: (k, f) => values.get(k) ?? f, set: (k, v) => values.set(k, structuredClone(v)) };
const studio = createMediaStudio({ store, root: path.join(root, 'media'), accessKey: 'synthetic-cache-check', getChannel: () => 'qa' });
let local, publicServer, bridge, relay, browser;
let mediaRequests = 0;
async function main() {
    const source = path.join(root, 'cache-test.mp4');
    execFileSync('C:/Users/User/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe', ['-hide_banner','-loglevel','error','-y',
        '-f','lavfi','-i','testsrc2=size=1280x720:rate=30','-t','3','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',source], { windowsHide: true, timeout: 30000 });
    const [item] = await studio.importFiles([source], [{ title: 'Cache QA', volume: 0 }]);
    local = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname.startsWith('/tikmng/media/file/')) mediaRequests++;
        if (!studio.handleRequest(req, res, url)) res.writeHead(404).end();
    });
    await new Promise(resolve => local.listen(0, '127.0.0.1', resolve));
    const serverRoot = path.resolve(__dirname, '../../server-update-20261030');
    const serverRequire = createRequire(path.join(serverRoot, 'package.json'));
    const express = serverRequire('express'), app = express();
    const { registerOverlayRelay } = await import(pathToFileURL(path.join(serverRoot, 'overlay-relay.js')));
    relay = registerOverlayRelay(app, { secret: 'synthetic-cache-qa-secret-at-least-32-bytes', authorize: () => ({ ownerId: 'synthetic-qa' }) });
    publicServer = http.createServer(app); relay.attach(publicServer);
    await new Promise(resolve => publicServer.listen(0, '127.0.0.1', resolve));
    const publicOrigin = 'http://127.0.0.1:' + publicServer.address().port;
    bridge = createOverlayBridge({ store, port: local.address().port, serverURL: publicOrigin,
        accessKey: 'synthetic-cache-check', getCredentials: () => ({ licenseCode: 'synthetic', deviceId: 'synthetic' }),
        getChannel: () => 'qa', allowInsecureForTests: true });
    bridge.start('qa');
    const deadline = Date.now() + 10000;
    while (!bridge.status().ready && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    assert.ok(bridge.status().ready);
    browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required','--mute-audio'] });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(bridge.urlFor('http://127.0.0.1:' + local.address().port + '/tikmng/media?key=synthetic-cache-check&channel=qa'));
    await page.waitForTimeout(1200);
    let firstRequests;
    for (let i = 0; i < 3; i++) {
        studio.test(item.id);
        await page.waitForFunction(() => document.querySelector('video')?.currentTime > .1);
        await page.waitForFunction(() => !document.querySelector('#stage>*'));
        if (i === 0) firstRequests = mediaRequests;
    }
    assert.equal(mediaRequests, firstRequests, 'Repeated playback must use browser cache, not the relay');
    assert.deepEqual(errors, []);
    const report = { passed: true, realRelay: true, browserCacheNotIntercepted: true, plays: 3,
        firstPlayMediaRequests: firstRequests, subsequentMediaRequests: mediaRequests - firstRequests,
        sourceBytes: fs.statSync(source).size, errors };
    fs.writeFileSync(path.resolve(__dirname, '../qa/20261030/media-cache-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    await browser?.close(); bridge?.close(); studio.close(); await relay?.close();
    for (const server of [local, publicServer]) if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
