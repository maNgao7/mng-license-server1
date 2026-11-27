'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { test } = require('node:test');
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const Conf = require('conf');
const { games } = require('../lib/published-games.json');

test('Electron shows the full license, warns at 30 minutes and opens the Hapisten Kaç guide', async t => {
    const root = path.resolve(__dirname, '..');
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-license-preview-'));
    const deadline = Date.now() + (2 * 86400 + 3 * 3600 + 41 * 60) * 1000;
    const store = new Conf({ cwd: profile, configName: 'mng-config', projectVersion: '7.0.27',
        encryptionKey: 'mng-electron-secret-key-2024' });
    store.set({
        lisans_kod: 'LOCAL-QA-LICENSE',
        preview_initialized_v1: true,
        library_root_v1: path.join(profile, 'games'),
        media_root_v1: path.join(profile, 'media'),
        tiktok_active_account: '',
        tiktok_accounts: [],
        widget_announcements_v1: { 'royal-widgets-20261028': true },
        game_announcements_v1: Object.fromEntries(games.map(game => ['game:' + game.id, true])),
    });
    const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.url === '/api/license/check') {
            req.resume();
            return res.end(JSON.stringify({ valid: true, expiresAt: deadline, isUnlimited: false,
                remainingSeconds: Math.floor((deadline - Date.now()) / 1000) }));
        }
        if (req.url === '/api/version') {
            return res.end(JSON.stringify({ latestVersion: '7.0.27', minVersion: '1.0.0' }));
        }
        res.statusCode = 404;
        res.end('{}');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const widgetReservation = http.createServer().listen(0, '127.0.0.1');
    await once(widgetReservation, 'listening');
    const widgetPort = widgetReservation.address().port;
    await new Promise(resolve => widgetReservation.close(resolve));
    let app;
    t.after(async () => {
        await app?.close();
        await new Promise(resolve => server.close(resolve));
        if (path.dirname(profile) === os.tmpdir()) fs.rmSync(profile, { recursive: true, force: true });
    });
    const env = { ...process.env, MNG_TEST_PROFILE: profile, MNG_WIDGET_PORT: String(widgetPort),
        MNG_LICENSE_SERVER: `http://127.0.0.1:${server.address().port}` };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await _electron.launch({ executablePath: process.env.MNG_QA_ELECTRON, args: process.env.MNG_QA_PACKAGED === '1' ? ['--tikmng-preview'] : [root, '--tikmng-preview'], env });
    const page = await app.firstWindow();
    await app.evaluate(({ shell }) => {
        shell.openExternal = async url => { globalThis.previewOpenedUrl = url; };
    });
    const card = page.locator('.workspace-sidebar #headerLicense');
    const read = () => card.getByRole('timer').textContent();
    const state = () => card.getAttribute('data-license-state');
    const animation = () => card.locator('#licenseDot').evaluate(dot => getComputedStyle(dot).animationName);
    await page.waitForFunction(() => /^2 gün 3 sa /.test(document.getElementById('licenseRemaining')?.textContent || ''), null, { timeout: 15000 });
    assert.equal(await state(), 'active');
    assert.equal(await animation(), 'none');

    const prison = page.locator('[data-open="hapisten-kac"]').first();
    await prison.waitFor({ state: 'visible', timeout: 10000 });
    const announcement = page.locator('dialog[open] [data-announcement-close]');
    for (let i = 0; i < 10 && await announcement.isVisible(); i++) await announcement.click();
    if (process.env.MNG_QA_PALETTE === '1') {
        const theme = () => page.evaluate(() => {
            const style = selector => getComputedStyle(document.querySelector(selector));
            const sidebar = document.querySelector('.workspace-sidebar').getBoundingClientRect();
            return {
                library: style('#workspaceRoot').backgroundColor,
                sidebar: style('.workspace-sidebar').backgroundColor,
                detail: style('.workspace-content').backgroundImage,
                logo: document.querySelector('.workspace-brand img')?.naturalWidth,
                sidebarRight: sidebar.right,
                contentRight: document.querySelector('.launcher > .main').getBoundingClientRect().right,
            };
        });
        const home = await theme();
        assert.equal(home.library, 'rgb(255, 227, 77)');
        assert.equal(home.sidebar, 'rgb(255, 127, 157)');
        assert.ok(Math.abs(home.sidebarRight - home.contentRight) <= 12);
        assert.ok(home.logo > 0);
        const screenshot = name => page.screenshot({path:path.join(process.env.MNG_QA_OUTPUT,name),animations:'disabled'});
        await screenshot('launcher-kutuphane.png');
        await prison.click();
        assert.match((await theme()).detail,/121, 84, 232/);
        assert.equal((await theme()).sidebar,home.sidebar);
        await screenshot('launcher-oyun-detayi.png');
        await page.locator('[data-back]').click();
        assert.equal((await theme()).detail,'none');
        await page.evaluate(() => updateModalAc({
            currentVersion:'7.0.27', latestVersion:'7.0.28',
            changelog:['Sarı oyun kütüphanesi.', 'Pembe sağ menü ve mor oyun detayları.'],
        }));
        await page.locator('#updateModal').waitFor({state:'visible'});
        assert.match(await page.locator('#updateModal').evaluate(el=>getComputedStyle(el).backgroundImage),/121, 84, 232/);
        await screenshot('launcher-guncelleme.png');
        await page.locator('#btnUpdateLater').click();
        await page.locator('#updateModal').waitFor({state:'hidden'});
    }
    await prison.click({ timeout: 8000 });
    const guide = page.getByRole('button', { name: /Kurulum videosunu izle/ });
    await guide.waitFor({ state: 'visible' });
    await guide.click({ timeout: 8000 });
    await assert.doesNotReject(() => page.waitForFunction(() => document.querySelector('.game-guide-video')?.dataset.url === 'https://youtu.be/hoiHgBzdCaY'));
    assert.equal(await app.evaluate(() => globalThis.previewOpenedUrl), 'https://youtu.be/hoiHgBzdCaY');
    const capture = (name, locator) => process.env.MNG_QA_OUTPUT && locator.screenshot({
        path: path.join(process.env.MNG_QA_OUTPUT, name), animations: 'disabled',
    });
    if (process.env.MNG_QA_OUTPUT) fs.mkdirSync(process.env.MNG_QA_OUTPUT, { recursive: true });
    await capture('hapisten-kac-kurulum-videosu.png', guide);

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(920, 560));
    const bounds = await card.boundingBox();
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    assert.ok(bounds.x > viewport.width * .7 && bounds.y > viewport.height * .5);
    assert.ok(bounds.y + bounds.height <= viewport.height);
    await capture('lisans-tam-sure.png', card);

    const setRemaining = ms => page.evaluate(({ deadline, ms }) => {
        const fakeNow = deadline - ms;
        Date.now = () => fakeNow;
    }, { deadline, ms });
    await setRemaining(1800_001);
    await page.waitForFunction(() => document.getElementById('licenseRemaining').textContent === '30 dk 1 sn');
    assert.equal(await state(), 'active');
    await setRemaining(1800_000);
    await page.waitForFunction(() => document.getElementById('headerLicense').dataset.licenseState === 'warning');
    assert.equal(await read(), '30 dk 0 sn');
    assert.equal(await animation(), 'license-warning-pulse');
    await capture('lisans-son-yarim-saat.png', card);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await animation(), 'none');

    await page.evaluate(() => lisansUIGuncelle({ gecerli: true, is_unlimited: true }));
    assert.equal(await read(), 'Süresiz kullanım');
    assert.equal(await state(), 'active');
    await page.evaluate(deadline => lisansUIGuncelle({ gecerli: true, bitis_zamani: deadline }), deadline);
    await setRemaining(0);
    await page.locator('#licensePage').waitFor({ state: 'visible' });
    assert.equal(await state(), 'expired');
    assert.match(await page.locator('#licenseDesc').textContent(), /süresi dolmuş/);
});
