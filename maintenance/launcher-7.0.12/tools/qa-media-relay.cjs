'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createMediaStudio } = require('../lib/media-studio.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-media-relay-fixture-'));
const output = process.env.MNG_MEDIA_RELAY_QA_OUTPUT || path.join(os.tmpdir(), 'tikmng-media-relay-report');
const base = '/tikmng/media';
const prefix = `/overlays/${crypto.randomBytes(32).toString('base64url')}`;
const publicOrigin = 'https://media-relay.test';
const key = 'synthetic-relay-local-access-key';
const values = new Map();
const requests = [], errors = [], checks = [];
const studio = createMediaStudio({ root: path.join(temporary, 'media'), accessKey: key, getChannel: () => 'qa',
    store: { get: (name, fallback) => values.get(name) ?? fallback, set: (name, value) => values.set(name, structuredClone(value)) } });
let browser, server, localOrigin;

async function check(name, run) {
    await run();
    checks.push(name);
    console.log('PASS ' + name);
}

async function instrument(page) {
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => errors.push(error.message));
    // A synthetic HTTPS origin exercises secure-context browser behavior without a public tunnel.
    await page.route('**/*', async route => {
        const request = route.request();
        if (request.url().startsWith(localOrigin + '/')) return route.continue();
        if (!request.url().startsWith(publicOrigin + '/')) {
            errors.push('Unexpected request: ' + request.url());
            return route.abort();
        }
        const url = new URL(request.url());
        const range = request.headers().range;
        const response = await fetch(localOrigin + url.pathname + url.search, { headers: range ? { range } : {}, redirect: 'manual' });
        const headers = Object.fromEntries(response.headers);
        delete headers.connection;
        delete headers['keep-alive'];
        delete headers['transfer-encoding'];
        await route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
    });
    await page.addInitScript(() => {
        window.__plays = [];
        window.__sources = [];
        window.__polls = [];
        window.__pollResponses = 0;
        window.__pending = 0;
        window.__maxPending = 0;
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            window.__polls.push(String(args[0]));
            window.__maxPending = Math.max(window.__maxPending, ++window.__pending);
            try {
                const response = await originalFetch(...args);
                window.__pollResponses++;
                return response;
            } finally { window.__pending--; }
        };
        const Original = window.EventSource;
        window.EventSource = class extends Original {
            constructor(...args) { super(...args); window.__sources.push(this); }
        };
        document.addEventListener('playing', event => {
            const element = event.target;
            if (element.__recorded) return;
            element.__recorded = true;
            window.__plays.push({ title: element.getAttribute('aria-label'), at: performance.now(), time: element.currentTime, volume: element.volume });
        }, true);
    });
}

async function openPublic(page, suffix = '') {
    await page.goto(publicOrigin + prefix + base + suffix, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__pollResponses >= 1);
}

async function playing(page, title) {
    await page.waitForFunction(title => {
        const video = document.querySelector('#stage video');
        return video?.getAttribute('aria-label') === title && !video.paused && video.readyState >= 2;
    }, title);
}

async function empty(page) {
    await page.waitForFunction(() => !document.querySelector('#stage>*'));
}

async function main() {
    fs.mkdirSync(output, { recursive: true });
    const ffmpeg = process.env.FFMPEG_PATH || 'C:/Users/User/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe';
    const generate = args => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { windowsHide: true, timeout: 20000 });
    const mp4 = path.join(temporary, 'synthetic.mp4');
    const png = path.join(temporary, 'synthetic.png');
    const gif = path.join(temporary, 'synthetic.gif');
    generate(['-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24', '-t', '5', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
    generate(['-f', 'lavfi', '-i', 'color=c=teal:s=96x96', '-frames:v', '1', png]);
    generate(['-f', 'lavfi', '-i', 'testsrc2=size=96x96:rate=8', '-t', '1', gif]);
    const [a, b, still, animated] = await studio.importFiles([mp4, mp4, png, gif], [
        { title: 'Relay A', giftId: '5655', startSeconds: 1, endSeconds: 2.4, volume: 0.35 },
        { title: 'Relay B', giftId: '6064', startSeconds: 0.5, endSeconds: 1.3, volume: 0.6 },
        { title: 'Relay PNG', giftId: '7934', displaySeconds: 1.2 },
        { title: 'Relay GIF', giftId: '7935', displaySeconds: 1.2 }
    ]);
    server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname.startsWith(prefix + base)) {
            requests.push({ pathname: url.pathname, query: url.search });
            url.pathname = url.pathname.slice(prefix.length);
            if (!['GET', 'HEAD'].includes(req.method) || !/^\/tikmng\/media(?:\/(?:poll|events|client\.(?:js|css)|(?:file\/)?[a-f0-9-]{36}))?$/.test(url.pathname)) {
                res.writeHead(404); res.end(); return;
            }
            url.searchParams.set('key', key);
            url.searchParams.set('channel', 'qa');
            req.headers['x-tikmng-overlay-base'] = prefix;
        } else delete req.headers['x-tikmng-overlay-base'];
        if (!studio.handleRequest(req, res, url)) { res.writeHead(404); res.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    localOrigin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true,
        executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    await instrument(page);
    studio.test(a.id);
    await openPublic(page);
    await check('HTTPS keyless initial poll drops historic gifts and prefixes both assets', async () => {
        await page.waitForFunction(() => window.__pollResponses >= 2);
        assert.equal(await page.locator('#stage>*').count(), 0);
        assert.equal(await page.evaluate(() => location.protocol), 'https:');
        assert.equal(await page.evaluate(() => new URLSearchParams(location.search).has('key')), false);
        assert.equal(await page.evaluate(() => window.__sources.length), 0);
        const assets = await page.evaluate(() => [document.querySelector('script').src, document.querySelector('link').href]);
        for (const asset of assets) assert.ok(asset.startsWith(publicOrigin + prefix + base));
        assert.equal(studio.status().receivers, 1);
    });
    await check('keyless range request preserves byte offsets and MIME', async () => {
        const result = await page.evaluate(async url => {
            const response = await fetch(url, { headers: { Range: 'bytes=2-5' } });
            return { status: response.status, range: response.headers.get('content-range'), type: response.headers.get('content-type'), bytes: [...new Uint8Array(await response.arrayBuffer())] };
        }, prefix + base + '/file/' + a.id);
        assert.equal(result.status, 206);
        assert.equal(result.type, 'video/mp4');
        assert.match(result.range, /^bytes 2-5\//);
        assert.deepEqual(result.bytes, [...fs.readFileSync(mp4).subarray(2, 6)]);
    });
    await check('public polls play decoded MP4 clips in order with trim and volume', async () => {
        studio.test(a.id); studio.test(b.id);
        await playing(page, a.title);
        const state = await page.locator('video').evaluate(video => ({ time: video.currentTime, volume: video.volume, duration: video.duration, src: video.src }));
        assert.ok(state.time >= 0.98 && state.time < 2);
        assert.equal(state.volume, 0.35);
        assert.ok(state.duration >= 4.9);
        assert.ok(state.src.startsWith(publicOrigin + prefix + base + '/file/'));
        assert.equal(new URL(state.src).searchParams.has('key'), false);
        await playing(page, b.title);
        assert.equal(await page.locator('video').evaluate(video => video.volume), 0.6);
        await page.screenshot({ path: path.join(output, 'public-video.png'), omitBackground: true });
        await empty(page);
        assert.deepEqual(await page.evaluate(() => window.__plays.map(play => play.title)), [a.title, b.title]);
    });
    await check('interrupt clears the public queue during playback', async () => {
        studio.save({ id: a.id, endSeconds: 4.5 });
        studio.save({ id: b.id, interrupt: true });
        await openPublic(page);
        studio.test(a.id); await playing(page, a.title);
        studio.test(a.id); studio.test(b.id); await playing(page, b.title);
        await empty(page);
        assert.deepEqual(await page.evaluate(() => window.__plays.map(play => play.title)), [a.title, b.title]);
    });
    await check('public PNG and animated GIF decode and expire', async () => {
        for (const item of [still, animated]) {
            studio.test(item.id);
            await page.waitForFunction(title => {
                const image = document.querySelector('#stage img');
                return image?.getAttribute('aria-label') === title && image.complete && image.naturalWidth === 96;
            }, item.title);
            await page.screenshot({ path: path.join(output, item.id === still.id ? 'public-png.png' : 'public-gif.png'), omitBackground: true });
            await empty(page);
        }
        assert.equal(await page.evaluate(() => window.__maxPending), 1);
    });
    await check('public editor preview loads embedded local metadata without a page key', async () => {
        await openPublic(page, '/' + a.id + '?preview=1');
        await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1);
        const state = await page.locator('video').evaluate(video => ({ controls: video.controls, src: video.src }));
        assert.equal(state.controls, true);
        assert.ok(state.src.startsWith(publicOrigin + prefix + base + '/file/'));
        assert.equal(new URL(state.src).searchParams.has('key'), false);
        assert.equal(studio.status().previews, 1);
    });
    await check('local SSE still authenticates and plays; public requests never transmit the local key', async () => {
        for (const suffix of ['', '/events', '/poll?client=' + crypto.randomUUID()]) {
            assert.equal((await fetch(localOrigin + base + suffix)).status, 403);
        }
        await page.goto(localOrigin + base + '?' + new URLSearchParams({ key, channel: 'qa' }), { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__sources[0]?.readyState === 1);
        assert.equal(await page.evaluate(() => window.__polls.length), 0);
        studio.test(a.id); await playing(page, a.title);
        assert.ok(requests.every(request => !new URLSearchParams(request.query).has('key')));
        assert.deepEqual(errors, []);
    });
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: true, checks, errors, publicRequests: requests.length, liveAccounts: false }, null, 2));
    console.log(JSON.stringify({ passed: true, checks: checks.length, output }));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    await browser?.close();
    studio.close();
    server?.closeAllConnections();
    if (server) await new Promise(resolve => server.close(resolve));
    const resolved = path.resolve(temporary);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('tikmng-media-relay-fixture-')) throw new Error('Unsafe fixture cleanup');
    fs.rmSync(resolved, { recursive: true, force: true });
});
