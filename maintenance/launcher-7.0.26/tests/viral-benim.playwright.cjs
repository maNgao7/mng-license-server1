'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');
const Store = createRequire(require.resolve('electron-store'))('conf');
const { createOverlayBridge } = require('../lib/overlay-bridge.cjs');
const { recordTopGift } = require('../lib/top-gift.cjs');
const { createStudio } = require('../lib/widget-studio.cjs');
const { createWidgetAnnouncements, ID: widgetAnnouncement } = require('../lib/widget-announcements.cjs');
const { createGameAnnouncements } = require('../lib/game-announcements.cjs');

const root = path.resolve(__dirname, '..');
const wingId = 'topgift-frame-wings';
const prices = [1, 100, 500, 1000, 5000, 10000];
const artNames = ['100', '100', '500', 'wings', '5000', '10000'];
const frameStyles = ['gold', 'crystal', 'ember', 'laurel', 'prism'];
const customTiers = { wingTier1: 20, wingTier2: 75, wingTier3: 250, wingTier4: 800, wingTier5: 1500 };
const coinLabel = coins => coins.toLocaleString('tr-TR') + ' coin';

async function listen(server, port = 0) {
    server.listen(port, '127.0.0.1');
    await once(server, 'listening');
    return server.address().port;
}

async function close(server) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
}

async function capturePose(page, scene, phase, filename) {
    const transforms = await scene.evaluate((node, phase) => {
        for (const animation of node.getAnimations({ subtree: true })) {
            animation.pause();
            const duration = animation.effect.getComputedTiming().duration;
            animation.currentTime = animation.effect.target.matches('.wing-left,.wing-right') ? duration * phase : duration;
        }
        return ['.wing-left', '.wing-right', '.wing-ring', '.champion-photo'].map(selector => {
            const element = node.querySelector(selector);
            return getComputedStyle(element).transform;
        });
    }, phase);
    const image = await page.screenshot({ path: filename, omitBackground: true });
    return { transforms, image };
}

async function checkWings(scene, tier, coins) {
    await scene.waitFor();
    await scene.locator('.wing-ring').evaluate(img => img.decode());
    assert.equal(await scene.getAttribute('data-tier'), String(tier));
    assert.equal(await scene.locator('.champion-badge b').textContent(), coinLabel(coins));
    const parts = await scene.locator('.champion-frame').evaluateAll(images => images.map(img => ({
        path: new URL(img.src).pathname, motion: getComputedStyle(img).animationName, clip: getComputedStyle(img).clipPath,
        mask: getComputedStyle(img).maskImage
    })));
    assert.equal(parts.length, 3);
    for (const part of parts) {
        assert.ok(part.path.endsWith(`/tikmng-champion-${artNames[tier]}-v1-runtime.webp`));
        assert.equal(part.clip, 'none', 'wing roots must not be hard-clipped');
        assert.match(part.mask, /linear-gradient/);
    }
    assert.notEqual(parts[0].motion, 'none');
    assert.notEqual(parts[1].motion, 'none');
    assert.equal(parts[2].motion, 'none');
}

test('Viral Benim animation through the isolated desktop publisher, relay and settings panel', { timeout: 115000 }, async () => {
    const { _electron, chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
    const relayFile = path.resolve(process.env.MNG_QA_RELAY || path.join(root,
        '../../widget-overhaul-preview-20261105/outputs/backend-review/overlay-relay.js'));
    const express = createRequire(relayFile)('express');
    const { registerOverlayRelay } = await import(pathToFileURL(relayFile));
    const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'tikmng-viral-qa-'));
    const output = process.env.MNG_VIRAL_VISUALS && path.resolve(process.env.MNG_VIRAL_VISUALS);
    const visual = name => output ? path.join(output, name + '.png') : undefined;
    const accessKey = randomBytes(16).toString('hex');
    let app, browser, bridge, relay, relayServer;
    try {
        if (output) await fs.mkdir(output, { recursive: true });
        const store = new Store({ cwd: profile, configName: 'mng-config', projectVersion: require('../package.json').version,
            encryptionKey: 'mng-electron-secret-key-2024' });
        store.set({ preview_initialized_v1: true, tiktok_accounts: [], tiktok_active_account: '',
            library_root_v1: path.join(profile, 'games'), media_root_v1: path.join(profile, 'media') });
        createWidgetAnnouncements(store).dismiss(widgetAnnouncement);
        const announcedGames = [...require('../lib/published-games.json').games, ...require('../lib/forza-preview.cjs').adminGames()];
        const announcements = createGameAnnouncements({ store, games: announcedGames });
        for (const { id } of announcements.pending()) announcements.dismiss(id);
        const studio = createStudio(store, () => '');
        studio.save('varsayilan', 'topgift', { ...customTiers, sound: false });
        for (const [tier, coins] of prices.entries()) {
            const channel = 'wing_qa_' + tier;
            studio.save(channel, wingId, { sound: false });
            store.set('widget_top_gifts__' + channel, recordTopGift({}, {
                username: 'wing_qa', nickname: 'Viral QA', unitCoins: coins, coins: coins * 3, count: 3,
                giftId: '11046', giftName: 'Galaksi', giftImage: '/widget/gift-assets/11046.png',
                avatar: '/widget/gift-assets/logo-v3.png'
            }));
        }

        const portProbe = http.createServer();
        // The desktop CSP allows the standard administrator-preview widget port.
        const port = await listen(portProbe, 31976);
        await close(portProbe);
        const publisher = `http://127.0.0.1:${port}`;
        const relayApp = express();
        relay = registerOverlayRelay(relayApp, { secret: randomBytes(32), authorize: () => ({ ownerId: 'viral-qa' }) });
        relayServer = http.createServer(relayApp);
        relay.attach(relayServer);
        const relayOrigin = `http://127.0.0.1:${await listen(relayServer)}`;

        const env = { ...process.env, MNG_TEST_PROFILE: profile, MNG_WIDGET_PORT: String(port),
            MNG_WIDGET_ACCESS_KEY: accessKey, MNG_LICENSE_SERVER: relayOrigin };
        delete env.ELECTRON_RUN_AS_NODE;
        app = await _electron.launch({ executablePath: process.env.MNG_QA_ELECTRON, args: [root, '--tikmng-preview'], env });
        const desktop = await app.firstWindow();
        desktop.setDefaultTimeout(12000);
        const errors = [];
        desktop.on('pageerror', error => errors.push(error.message));
        await desktop.waitForFunction(() => typeof widgetAyarlariDogrudanAc === 'function');
        const info = await desktop.evaluate(() => window.mngAPI.widgetBilgisi());
        const wingItem = info.widgets.find(item => item.id === wingId);
        assert.equal(wingItem.catalogHidden, false);
        const localURL = wingItem.previewUrl;
        assert.equal(info.channel, 'varsayilan');
        assert.equal(info.top, null);

        bridge = createOverlayBridge({ store: { get: (_key, fallback) => fallback, set() {} }, serverURL: relayOrigin,
            port, accessKey, getCredentials: () => ({ deviceId: 'viral-qa-device', licenseCode: 'viral-qa-license' }),
            allowInsecureForTests: true });
        browser = await chromium.launch({ channel: 'chrome', headless: true });
        const broadcast = await browser.newPage({ viewport: { width: 900, height: 600 } });
        broadcast.setDefaultTimeout(12000);
        broadcast.on('pageerror', error => errors.push(error.message));
        const badAssets = [];
        broadcast.on('response', response => {
            if (response.url().includes('/widget/gift-assets/') && !response.ok()) badAssets.push(response.status());
        });
        await broadcast.route('**/*', route => {
            const origin = new URL(route.request().url()).origin;
            return [publisher, relayOrigin].includes(origin) ? route.continue() : route.abort();
        });
        async function openBroadcast(channel) {
            await new Promise((resolve, reject) => {
                const poll = setInterval(() => {
                    if (!bridge.status().ready) return;
                    clearTimeout(timer);
                    clearInterval(poll);
                    resolve();
                }, 50);
                const timer = setTimeout(() => {
                    clearInterval(poll);
                    reject(Error('Local publisher bridge did not connect'));
                }, 10000);
                bridge.start(channel);
            });
            const url = bridge.urlFor(localURL, { namedWidget: wingId });
            assert.match(url, /\/overlays\/[^/]+\//);
            assert.equal(new URL(url).searchParams.has('preview'), false);
            assert.equal(new URL(url).searchParams.has('key'), false);
            assert.equal((await broadcast.goto(url)).status(), 200);
        }

        await openBroadcast('wing_qa_empty');
        await broadcast.waitForFunction(() => window.__widgetDiagnostics?.type === 'topgift');
        assert.equal(await broadcast.locator('.champion').count(), 0);
        for (const [tier, coins] of prices.entries()) {
            await openBroadcast('wing_qa_' + tier);
            const scene = broadcast.locator(`.champion[data-frame-style="wings"][data-tier="${tier}"]`);
            await checkWings(scene, tier, coins);
            assert.equal(await scene.locator('.champion-name').textContent(), 'Viral QA');
            assert.match(await scene.locator('.champion-badge small').textContent(), /3×$/);
            assert.match(await scene.locator('.wing-ring').getAttribute('src'), /\/overlays\//);
            await scene.locator('.champion-avatar img').evaluate(img => img.decode());
            if (tier === 3) {
                const initial = await capturePose(broadcast, scene, 0, visual('broadcast-wings-open'));
                const flap = await capturePose(broadcast, scene, .45, visual('broadcast-wings-flap'));
                assert.notEqual(initial.transforms[0], flap.transforms[0]);
                assert.notEqual(initial.transforms[1], flap.transforms[1]);
                assert.deepEqual(initial.transforms.slice(2), flap.transforms.slice(2));
                assert.notDeepEqual(initial.image, flap.image);
            }
        }
        await broadcast.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await broadcast.locator('.wing-left').isVisible(), false);
        assert.equal(await broadcast.locator('.wing-right').isVisible(), false);
        assert.equal(await broadcast.locator('.wing-ring').evaluate(img => getComputedStyle(img).maskImage), 'none');

        await desktop.evaluate(() => {
            // Reveal the ordinary settings UI in the throwaway profile without a license request.
            anaEkraniGoster();
        });
        await desktop.locator('[data-workspace-view="widgets"]').click();
        await desktop.locator('[data-hub-search]').fill('Viral Benim');
        await desktop.locator(`.wh-grid [data-widget="${wingId}"]`).click();
        const gallery = desktop.locator('#widgetWingGallery');
        const frame = desktop.frameLocator('#widgetSettingsPreview');
        assert.equal(await desktop.locator('#widgetSettingsFields [name="frameStyle"]').count(), 0);
        await checkWings(frame.locator('.champion[data-tier="3"]'), 3, customTiers.wingTier3);
        const options = [1, ...Object.values(customTiers)];
        for (const [tier, coins] of options.entries()) {
            const tile = gallery.locator(`[data-wing-preview="${tier}"]`);
            assert.equal(await tile.locator('span').textContent(), coinLabel(coins).replace(' coin', '+ coin'));
            await tile.locator('img').evaluate(img => img.decode());
            await tile.click();
            assert.equal(await tile.getAttribute('aria-pressed'), 'true');
            await checkWings(frame.locator(`.champion[data-frame-style="wings"][data-tier="${tier}"]`), tier, coins);
        }
        await gallery.locator('[data-wing-preview="3"]').click();
        const scene = frame.locator('.champion[data-frame-style="wings"][data-tier="3"]');
        await checkWings(scene, 3, 250);
        await capturePose(desktop, scene, .45, visual('settings-wings'));
        await desktop.locator('#widgetStudioTest').click();
        await desktop.waitForFunction(async id => Boolean((await window.mngAPI.widgetBilgisi()).studio.tests[id]), wingId);
        await broadcast.goto(localURL);
        await broadcast.locator('.champion-name').filter({ hasText: 'TikMnG Test' }).waitFor();
        assert.equal((await desktop.evaluate(() => window.mngAPI.widgetBilgisi())).top, null);
        await desktop.evaluate(() => widgetAyarPanelKapat());
        for (const style of frameStyles) {
            await desktop.evaluate(id => widgetAyarlariDogrudanAc(id), 'topgift-frame-' + style);
            const other = frame.locator(`.champion[data-frame-style="${style}"]`);
            await other.waitFor();
            if (['gold', 'crystal', 'ember'].includes(style)) await other.locator('.champion-art').evaluate(img => img.decode());
            else assert.equal(await other.locator('.medal-art').count(), 1);
            assert.equal(await gallery.count(), 0);
            await desktop.evaluate(() => widgetAyarPanelKapat());
        }
        await desktop.evaluate(() => widgetAyarPanelKapat());
        assert.equal(await desktop.locator('#widgetSettingsPreview').getAttribute('src'), 'about:blank');
        assert.deepEqual(badAssets, []);
        assert.deepEqual(errors, []);
    } finally {
        try { await browser?.close(); }
        finally {
            bridge?.stop();
            try { await app?.close(); }
            finally {
                await relay?.close();
                if (relayServer?.listening) await close(relayServer);
                if (path.dirname(path.resolve(profile)) === path.resolve(os.tmpdir()) &&
                    path.basename(profile).startsWith('tikmng-viral-qa-')) {
                    await fs.rm(profile, { recursive: true, force: true, maxRetries: 5 });
                }
            }
        }
    }
});
