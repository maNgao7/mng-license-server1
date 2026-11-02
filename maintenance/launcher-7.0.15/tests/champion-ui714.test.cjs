'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { normalize, schema, createStudio, ids, royalIds } = require('../lib/widget-studio.cjs');
const { start } = require('../tools/preview-widgets714.cjs');
const art = require('../lib/champion-art.json');
const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

function productionRoutes() {
    let handler;
    const accesses = [], localRequire = createRequire(path.join(root, 'main.js'));
    const trackedFS = { ...fs,
        existsSync(file) { accesses.push(['exists', file]); return fs.existsSync(file); },
        readFileSync(file, encoding) { accesses.push(['read', file]); return fs.readFileSync(file, encoding); },
        createReadStream(file) { accesses.push(['stream', file]); return { pipe(res) { res.end(fs.readFileSync(file)); } }; }
    };
    const context = vm.createContext({
        fs: trackedFS, path, URL, __dirname: root, WIDGET_PORT: 31975, widgetServer: null,
        http: { createServer(callback) { handler = callback; return { listen() {}, on() {} }; } },
        require(name) { accesses.push(['require', name]); return localRequire(name); },
        platform: null, widgetChannel: 'qa', widgetStudioModule: { ids, royalIds }, widgetPortraits: null,
        widgetGiftCatalogCache: null, widgetKanaliniTemizle: value => value || 'qa',
        widgetErisimineIzinVar: url => url.searchParams.get('key') === 'qa-key'
    });
    const helpers = main.slice(main.indexOf('function widgetChampionArt()'), main.indexOf('\nlet widgetPortraits'));
    const server = main.slice(main.indexOf('function widgetSunucusunuBaslat()'), main.indexOf('\n// ===', main.indexOf('function widgetSunucusunuBaslat()')));
    vm.runInContext(helpers + '\n' + server + '\nwidgetSunucusunuBaslat();', context);
    return { accesses, request(resource, method = 'GET', authorized = true) {
        accesses.length = 0;
        const url = new URL(resource, 'http://127.0.0.1:31975');
        if (authorized) url.searchParams.set('key', 'qa-key');
        const res = { status: 200, headers: {}, body: undefined,
            setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
            writeHead(status, headers = {}) { this.status = status; for (const [key, value] of Object.entries(headers)) this.setHeader(key, value); },
            end(body) { this.body = body; }
        };
        handler({ method, url: url.pathname + url.search, headers: {}, socket: { remoteAddress: '127.0.0.1' } }, res);
        return res;
    } };
}

test('one frame selector validates saved edits while private wing thresholds survive', () => {
    const fields = schema('topgift'), selector = fields.filter(field => field.key === 'frameStyle');
    assert.equal(selector.length, 1);
    assert.deepEqual(selector[0].options.map(([value]) => value), ['wings', 'gold', 'crystal', 'ember']);
    assert.equal(fields.some(field => /wingTier|frameTheme/.test(field.key)), false);
    assert.equal(normalize('topgift').frameStyle, 'wings');
    assert.equal(normalize('topgift', { frameStyle: 'bad' }).frameStyle, 'wings');
    for (const frameStyle of ['wings', 'gold', 'crystal', 'ember']) assert.equal(normalize('topgift', { frameStyle }).frameStyle, frameStyle);
    const values = new Map(), store = { get: (key, fallback) => structuredClone(values.get(key) || fallback), set: (key, value) => values.set(key, structuredClone(value)) };
    const studio = createStudio(store, () => '');
    studio.save('qa', 'topgift', { wingTier1: 10, wingTier2: 30, wingTier3: 100, wingTier4: 400, wingTier5: 900, frameStyle: 'gold' });
    studio.save('qa', 'topgift', { entranceSound: 'none' });
    assert.equal(studio.settings('qa', 'topgift').wingTier3, 100);
    assert.equal(createStudio(store, () => '').settings('qa', 'topgift').frameStyle, 'gold');
});

test('production bundle and exact manifest assets authenticate before reads, cache privately, and handle HEAD', () => {
    const routes = productionRoutes(), assets = [...Object.values(art.frames), ...Object.values(art.textures)];
    for (const resource of ['/widget/champion-motion.js?v=' + art.moduleHash, ...assets.map(name => '/widget/gift-assets/' + name)]) {
        for (const method of ['GET', 'HEAD']) {
            assert.equal(routes.request(resource, method, false).status, 403);
            assert.deepEqual(routes.accesses, [], 'unauthorized requests perform no asset or manifest access');
            const result = routes.request(resource, method);
            assert.equal(result.status, 200);
            assert.equal(result.headers['cache-control'], 'private, max-age=31536000, immutable');
            assert.equal(result.headers['content-type'], resource.startsWith('/widget/champion') ? 'text/javascript; charset=utf-8' : 'image/webp');
            if (method === 'HEAD') {
                assert.equal(result.body, undefined);
                assert.equal(routes.accesses.some(([kind]) => kind === 'stream' || kind === 'read'), false);
            } else assert.ok(result.body.length > 0);
        }
    }
    for (const query of ['', '?v=old', '?v=' + art.moduleHash + '&v=old']) assert.equal(routes.request('/widget/champion-motion.js' + query).headers['cache-control'], 'no-store');
    for (const resource of ['/widget/champion-motion.js.map', '/widget/champion-motion.js/extra', '/widget/gift-assets/viral-gold-' + '0'.repeat(64) + '.webp', '/widget/gift-assets/nested/' + art.frames.gold]) assert.equal(routes.request(resource).status, 404);
    const html = routes.request('/widget/overlay?type=topgift').body;
    assert.ok(html.includes('const championArt=' + JSON.stringify(art)));
    assert.equal(html.includes('/*CHAMPION_ART*/'), false);
});

test('only immutable Viral image URLs drop the widget type at local and relay paths', () => {
    const html = fs.readFileSync(path.join(root, 'renderer/widgets/reference-widgets.html'), 'utf8');
    const helpers = html.slice(html.indexOf('function endpoint('), html.indexOf('\nfunction image(raw)'));
    for (const prefix of ['', '/overlays/' + 'a'.repeat(43)]) {
        const context = vm.createContext({ prefix, URL, params: new URLSearchParams('type=topgift&key=qa-key&channel=qa'), location: { origin: 'https://relay.test', href: 'https://relay.test' + prefix + '/widget' } });
        vm.runInContext(helpers, context);
        for (const name of [...Object.values(art.frames), ...Object.values(art.textures)]) {
            const url = new URL(vm.runInContext('imageURL(giftURL(' + JSON.stringify(name) + '))', context));
            assert.equal(url.pathname, prefix + '/widget/gift-assets/' + name);
            assert.equal(url.searchParams.has('type'), false);
            assert.equal(url.searchParams.get('channel'), 'qa');
            assert.equal(url.searchParams.get('key'), prefix ? null : 'qa-key');
        }
        assert.equal(new URL(vm.runInContext("imageURL(giftURL('5655.png'))", context)).searchParams.get('type'), 'topgift');
    }
});

function fixture(frameStyle = 'gold', overrides = {}) {
    return { activities: [], topGift: { id: 'champion', username: 'deniz', nickname: 'Deniz', avatar: '/widget/gift-assets/royal-demo.png', giftImage: '/widget/gift-assets/5655.png', giftName: 'Rose', coins: 1000, count: 1, createdAt: Date.now(), ...overrides }, studio: { settings: { topgift: normalize('topgift', { frameStyle, sound: false }) } } };
}

async function browserFixture(t, args = []) {
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    const host = await start();
    t.after(() => host.close());
    const browser = await chromium.launch({ channel: 'chrome', headless: true, args });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith(host.origin + '/') ? route.continue() : route.abort());
    return { host, page, errors, browser };
}

test('production frames move, preserve foreground circles and stable DOM, and reuse loaded images', { timeout: 90000 }, async t => {
    const { host, page, errors } = await browserFixture(t), requests = [];
    page.on('request', request => requests.push(request.url()));
    host.setState('topgift', fixture());
    await page.goto(host.origin + '/widget?type=topgift&key=qa-key&channel=qa');
    await page.waitForFunction(() => __championMotionDiagnostics().ready);
    await page.evaluate(() => { clearTimeout(pollTimer); window.__apply = (style, row = {}) => { config.frameStyle = style; renderData({ topGift: { ...state.topGift, ...row } }); }; });
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'champion-ui714-'));
    t.diagnostic('Screenshots: ' + output);
    for (const [index, style] of ['gold', 'crystal', 'ember'].entries()) {
        await page.evaluate(style => __apply(style), style);
        await page.waitForFunction(style => __championMotionDiagnostics().ready && __championMotionDiagnostics().kind === style, style);
        await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
        await page.evaluate(() => { window.__host = document.querySelector('.champion-custom-host'); window.__canvas = __host.querySelector('canvas'); window.__photo = document.querySelector('.champion-avatar .portrait'); window.__art = document.querySelector('.champion-art'); });
        const pixels = await page.evaluate(() => { const controller = __championMotionController; controller.drawAt(1); const a = controller.pixelStats(); controller.drawAt(2.3); return [a, controller.pixelStats()]; });
        assert.ok(pixels[0].painted > 50, style + ': motion paints');
        assert.notEqual(pixels[0].hash, pixels[1].hash, style + ': motion changes');
        assert.equal(pixels[0].center, 0, style + ': portrait aperture remains clear');
        const imageRequests = requests.filter(url => url.includes('/gift-assets/')).length;
        await page.evaluate(() => { for (let i = 1; i <= 12; i++) __apply(config.frameStyle, { coins: 1000 + i * 1000, count: i, nickname: 'Changed ' + i }); });
        assert.equal(await page.evaluate(() => __host === document.querySelector('.champion-custom-host') && __canvas === __host.querySelector('canvas') && __photo === document.querySelector('.champion-avatar .portrait') && __art === document.querySelector('.champion-art')), true);
        assert.equal((await page.evaluate(() => __championMotionDiagnostics())).mounts, index + 1);
        assert.equal(requests.filter(url => url.includes('/gift-assets/')).length, imageRequests, 'updates do not request images again');
        assert.equal(await page.locator('.champion-name').textContent(), 'Changed 12');
        assert.equal(await page.locator('.champion-badge small').textContent(), 'Rose \u00b7 12\u00d7');
        assert.equal(await page.evaluate(() => { ctx.clearRect(0, 0, 900, 600); championLightFrame(500); return ctx.getImageData(450, 180, 1, 1).data[3]; }), 0);
        for (const viewport of [{ width: 900, height: 600 }, { width: 390, height: 360 }]) {
            await page.setViewportSize(viewport);
            await page.evaluate(() => { document.querySelector('.champion').style.animation = 'none'; fit(); });
            const geometry = await page.evaluate(() => {
                const photo = document.querySelector('.champion-photo'), p = photo.getBoundingClientRect(), h = document.querySelector('.champion-custom-host').getBoundingClientRect();
                return { width: p.width, height: p.height, ratio: p.width / h.width, left: (p.left - h.left) / h.width, top: (p.top - h.top) / h.height, layers: [document.querySelector('.champion-art'), h && document.querySelector('.champion-custom-host canvas'), photo].map(node => getComputedStyle(node).zIndex), bounds: ['.champion-heading', '.champion-custom-host', '.champion-name', '.champion-badge'].map(selector => { const r = document.querySelector(selector).getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }) };
            });
            assert.ok(Math.abs(geometry.width - geometry.height) < 1);
            assert.ok(Math.abs(geometry.ratio - (style === 'gold' ? .66 : .62)) < .002);
            assert.ok(Math.abs(geometry.left - (style === 'gold' ? .17 : .19)) < .002);
            assert.ok(Math.abs(geometry.top - .17) < .002);
            assert.deepEqual(geometry.layers, ['2', '4', '6']);
            assert.ok(geometry.bounds.every(([l, top, r, b]) => l >= -1 && top >= -1 && r <= viewport.width + 1 && b <= viewport.height + 1), JSON.stringify(geometry));
            assert.ok(geometry.bounds[0][3] <= geometry.bounds[1][1] && geometry.bounds[1][3] <= geometry.bounds[2][1] && geometry.bounds[2][3] <= geometry.bounds[3][1], 'heading, art, name and badge do not overlap');
            await page.screenshot({ path: path.join(output, style + '-' + viewport.width + '.png'), omitBackground: true });
        }
        await page.setViewportSize({ width: 900, height: 600 });
    }
    assert.equal(requests.filter(url => url.includes('/widget/champion-motion.js')).length, 1);
    const bundleURL = new URL(requests.find(url => url.includes('/widget/champion-motion.js')));
    assert.equal(bundleURL.searchParams.has('type'), false);
    assert.equal(bundleURL.searchParams.get('v'), art.moduleHash);
    assert.equal(bundleURL.searchParams.get('key'), 'qa-key');
    assert.ok(requests.filter(url => /viral-(?:gold|crystal|ember|coin|flame)-/.test(url)).every(url => !new URL(url).searchParams.has('type')));
    assert.ok(requests.filter(url => url.includes('viral-coin-')).every(url => new URL(url).searchParams.get('key') === 'qa-key'));
    assert.ok(requests.filter(url => url.includes('viral-flame-')).length === 1);
    const beforeVisibilityImages = requests.filter(url => url.includes('/gift-assets/')).length;
    const hidden = await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); return { frames: __championMotionDiagnostics().frames, visible }; });
    await page.waitForFunction(frames => __championMotionDiagnostics().frames > frames + 2, hidden.frames);
    assert.equal(hidden.visible, true, 'broadcast remains active while hidden');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(requests.filter(url => url.includes('/gift-assets/')).length, beforeVisibilityImages, 'visibility changes reuse all images');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); __apply('wings'); });
    assert.equal(await page.locator('.champion-frame').count(), 3);
    assert.equal(await page.locator('.champion-flip').count(), 1);
    assert.equal(await page.evaluate(() => __championMotionController), null);
    await page.evaluate(() => { window.__flip = document.querySelector('.champion-flip'); __apply('wings', { coins: 50000, count: 4, nickname: 'Wing update' }); });
    assert.equal(await page.evaluate(() => __flip === document.querySelector('.champion-flip')), true);
    assert.deepEqual(errors, []);
});

function delayedMotion() {
    window.__pendingMounts = [];
    window.TikMnGChampionMotion = { mount(host, options) {
        const canvas = document.createElement('canvas'); host.append(canvas);
        const controller = { disposed: false, dispose() { this.disposed = true; canvas.remove(); }, stats() { return { ready: !this.disposed, frames: 1, kind: options.kind }; } };
        return new Promise(resolve => __pendingMounts.push({ host, options, controller, finish: () => resolve(controller) }));
    } };
}

test('async style and clear races dispose stale controllers; drafts validate; script loads once', { timeout: 30000 }, async t => {
    const { host, page, errors } = await browserFixture(t);
    host.setState('topgift', fixture());
    let bundles = 0;
    await page.route('**/widget/champion-motion.js?*', route => { bundles++; return route.fulfill({ contentType: 'text/javascript', body: '(' + delayedMotion.toString() + ')();' }); });
    await page.goto(host.origin + '/widget?type=topgift&preview=1');
    await page.waitForFunction(() => window.__pendingMounts?.length === 1);
    await page.evaluate(() => { clearTimeout(pollTimer); config.frameStyle = 'ember'; renderData(demoState()); });
    await page.waitForFunction(() => __pendingMounts.length === 2);
    await page.evaluate(() => { __pendingMounts[1].finish(); __pendingMounts[0].finish(); });
    await page.waitForFunction(() => __championMotionDiagnostics().ready);
    assert.equal(await page.evaluate(() => __pendingMounts[0].controller.disposed && __championMotionController === __pendingMounts[1].controller), true);
    assert.equal(await page.evaluate(() => __pendingMounts[1].options.preview), true);
    assert.deepEqual(await page.evaluate(() => __pendingMounts[1].options.textures), art.textures);
    await page.evaluate(() => { config.frameStyle = 'crystal'; renderData(demoState()); });
    await page.waitForFunction(() => __pendingMounts.length === 3);
    await page.evaluate(() => { clearScene(); __pendingMounts[2].finish(); });
    await page.waitForFunction(() => __pendingMounts[2].controller.disposed);
    assert.equal(await page.locator('.champion').count(), 0);
    assert.equal(await page.evaluate(() => __championMotionController), null);
    await page.evaluate(() => dispatchEvent(new MessageEvent('message', { source: window, data: { type: 'tikmng-widget-draft', settings: { frameStyle: 'invalid' } } })));
    assert.equal(await page.locator('.champion').getAttribute('data-frame-style'), 'wings');
    assert.equal(bundles, 1);
    assert.deepEqual(errors, []);
});

test('script failures and unavailable WebGL retain the large static frame and portrait', { timeout: 45000 }, async t => {
    const { host, page, errors, browser } = await browserFixture(t);
    host.setState('topgift', fixture());
    let attempts = 0;
    await page.route('**/widget/champion-motion.js?*', route => { attempts++; return route.abort(); });
    await page.goto(host.origin + '/widget?type=topgift');
    await page.waitForFunction(() => __championMotionDiagnostics().error);
    for (const frameStyle of ['gold', 'ember']) {
        await page.evaluate(style => { clearTimeout(pollTimer); config.frameStyle = style; renderData(state); }, frameStyle);
        await page.waitForFunction(() => !__championMotionDiagnostics().pending);
        assert.equal(await page.locator('.champion-custom-host').getAttribute('data-motion'), 'static');
        assert.equal(await page.locator('.champion-custom-host canvas').count(), 0);
        assert.equal(await page.locator('.champion-avatar .portrait').count(), 1);
    }
    assert.equal(attempts, 1, 'failed bundle is not repeatedly requested');
    const noGL = await browser.newPage();
    await noGL.addInitScript(() => { const getContext = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(kind, ...args) { return /webgl/i.test(kind) ? null : getContext.call(this, kind, ...args); }; });
    await noGL.goto(host.origin + '/widget?type=topgift');
    await noGL.waitForFunction(() => __championMotionDiagnostics().mounts === 1 && !__championMotionDiagnostics().pending);
    assert.equal(await noGL.locator('.champion-custom-host').getAttribute('data-motion'), 'static');
    assert.equal(await noGL.locator('.champion-custom-host canvas').count(), 0);
    assert.equal(await noGL.locator('.champion-avatar .portrait').count(), 1);
    assert.deepEqual(errors, []);
});
