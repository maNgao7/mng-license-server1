'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { _electron } = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const Conf = require('conf');
const root = path.resolve(__dirname, '..'), qa = path.resolve(root, '../qa');
const profile = fs.mkdtempSync(path.join(qa, 'steam-link-profile-'));
const catalog = require('../lib/catalog-defaults.json');
const store = new Conf({ cwd: profile, configName: 'mng-config', encryptionKey: 'mng-electron-secret-key-2024' });
store.set({ lisans_kod: 'LOCAL-STEAM-UI-FIXTURE', preview_initialized_v1: true,
    library_root_v1: path.join(profile, 'games'), media_root_v1: path.join(profile, 'media'),
    tiktok_active_account: '', tiktok_accounts: [], widget_announcements_v1: { 'royal-widgets-20261028': true },
    game_announcements_v1: Object.fromEntries(require('../lib/published-games.json').games.map(game => ['game:' + game.id, true])) });
const server = http.createServer((req, res) => {
    req.resume(); res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/content/catalog') return res.end(JSON.stringify(catalog));
    if (/^\/api\/license\/(?:check|verify)/.test(req.url)) return res.end(JSON.stringify({ valid: true, isUnlimited: false, expiresAt: Date.now() + 7200000, remainingSeconds: 7200 }));
    if (req.url === '/api/version') return res.end(JSON.stringify({ latestVersion: '7.0.39', minVersion: '1.0.0' }));
    res.writeHead(404).end('{}');
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const env = { ...process.env, MNG_TEST_PROFILE: profile, MNG_WIDGET_PORT: '0', MNG_LICENSE_SERVER: 'http://127.0.0.1:' + server.address().port };
    delete env.ELECTRON_RUN_AS_NODE;
    let app;
    try {
        app = await _electron.launch({ executablePath: path.resolve(root, '../release/win-unpacked/TikMnG.exe'), env, timeout: 60000 });
        const page = await app.firstWindow();
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.addLocatorHandler(page.locator('#gameAnnouncement[open] [data-announcement-close]'), locator => locator.click(), { noWaitAfter: true });
        await page.waitForFunction(() => Boolean(window.mngAPI?.workspace));
        const close = page.locator('[data-announcement-close]:visible');
        for (let i = 0; i < 8 && await close.count(); i++) await close.first().click();
        await page.locator('[data-open="ring"]').first().click();
        await page.locator('.game-detail-info h2').waitFor();
        await app.evaluate(({ shell }) => {
            globalThis.steamLinks = [];
            globalThis.failSteam = false;
            shell.openExternal = async url => {
                globalThis.steamLinks.push(url);
                if (globalThis.failSteam && url.startsWith('steam:')) throw Error('synthetic failed Steam protocol');
            };
        });
        const installed = await require('../lib/external-links.cjs').steamProtocolAvailable();
        const demo = 'https://store.steampowered.com/app/4793540/';
        const button = page.locator('.detail-commands [data-url="' + demo + '"]');
        await button.click();
        await page.waitForTimeout(300);
        assert.deepEqual(await app.evaluate(() => globalThis.steamLinks), [installed ? 'steam://store/4793540' : demo]);
        // Clicking the nested icon must dispatch exactly as the button text does.
        await app.evaluate(() => { globalThis.steamLinks = []; globalThis.failSteam = true; });
        await button.locator('svg').click();
        await page.waitForTimeout(300);
        assert.deepEqual(await app.evaluate(() => globalThis.steamLinks), installed ? ['steam://store/4793540', demo] : [demo]);
        await app.evaluate(() => { globalThis.steamLinks = []; globalThis.failSteam = false; });
        await page.locator('.resource-list [data-url="' + demo + '"]').click();
        await page.waitForTimeout(300);
        assert.deepEqual(await app.evaluate(() => globalThis.steamLinks), [installed ? 'steam://store/4793540' : demo]);
        assert.deepEqual(errors, []);
        await page.screenshot({ path: path.join(qa, 'ring-steam-detail.png'), fullPage: true });
        const result = { passed: true, version: '7.0.39', packaged: await app.evaluate(({ app }) => app.isPackaged), isolatedProfile: true, steamRegistered: installed, tested: ['Ring detail Steam button', 'nested icon click and failed-protocol fallback', 'Ring resource Steam button'], nativeStoreOpened: false, liveGiftTested: false, pageErrors: errors };
        fs.writeFileSync(path.join(qa, 'steam-ui-result.json'), JSON.stringify(result, null, 2) + '\n');
        console.log(JSON.stringify(result));
    } finally {
        await app?.close();
        await new Promise(resolve => server.close(resolve));
        assert.equal(path.dirname(profile), qa);
        assert.ok(path.basename(profile).startsWith('steam-link-profile-'));
        fs.rmSync(profile, { recursive: true, force: true });
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
