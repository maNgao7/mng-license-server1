'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const Store = require('electron-store');
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'qa/715');
const executablePath = path.resolve(process.env.MNG_QA_EXE || 'D:/TikMnG-Release-7.0.15-ready/win-unpacked/TikMnG.exe');
const storeURL = 'https://store.steampowered.com/app/5364590/';
const errors = [];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const report = { passed: false, version: '7.0.15', startedAt: new Date().toISOString(), executablePath,
    isolatedProfile: true, originalProfileRead: false, originalProfileCopied: false,
    currentUserCustomSettingsNotChanged: true, uiAuthenticationSimulated: true,
    nativeGameLaunchTestedHere: false, realPaidGiftTest: false, signedPublisher: false };
let application, profile, port;

async function unusedPort() {
    const server = net.createServer();
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const value = server.address().port;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    return value;
}

async function launch() {
    const env = { ...process.env, MNG_TEST_PROFILE: profile, MNG_WIDGET_PORT: String(port) };
    delete env.ELECTRON_RUN_AS_NODE;
    application = await _electron.launch({ executablePath, args: [], env, timeout: 60000 });
    const page = await application.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForFunction(() => window.mngAPI && document.getElementById('workspaceRoot'), null, { timeout: 60000 });
    const paths = await application.evaluate(({ app }) => ({ userData: app.getPath('userData'), documents: app.getPath('documents'),
        videos: app.getPath('videos'), packaged: app.isPackaged, appId: app.getName() }));
    assert.equal(paths.userData, profile);
    assert.equal(paths.documents, path.join(profile, 'Documents'));
    assert.equal(paths.videos, path.join(profile, 'Videos'));
    assert.equal(paths.packaged, true);
    // Exercise the authenticated view with synthetic UI state, without a real license or account.
    await page.waitForFunction(() => window.tikmngAuthenticated === false && document.getElementById('licensePage')?.style.display !== 'none', null, { timeout: 30000 });
    const license = await page.evaluate(() => mngAPI.lisansDurumu());
    assert.notEqual(license.gecerli, true, 'The empty isolated profile must still require a real license');
    await page.evaluate(() => anaEkraniGoster());
    return page;
}

async function openArena(page) {
    await page.locator('[data-workspace-view="games"]').click();
    await page.locator('[data-open="yaratik-arena"]').click();
    await page.locator('[data-action="arena-demo-refresh"]').waitFor();
}

async function main() {
    fs.mkdirSync(out, { recursive: true });
    assert.ok(fs.existsSync(executablePath), 'Packaged EXE missing; build 7.0.15 first');
    const archive = path.join(path.dirname(executablePath), 'resources/app.asar');
    const asar = require('@electron/asar');
    const descriptor = require('D:/TikMnG-Yaratik-Arena-0.1.20-final2/package-descriptor.json');
    const catalog = JSON.parse(asar.extractFile(archive, 'lib/catalog-defaults.json'));
    const packagedArena = catalog.games.find(game => game.id === 'yaratik-arena');
    for (const key of ['version', 'bytes', 'sha256', 'url']) assert.equal(packagedArena?.[key], descriptor[key], 'Packaged Arena ' + key);
    assert.deepEqual(JSON.parse(asar.extractFile(archive, 'lib/admin-games.json')).games, []);
    report.appAsarSha256 = hash(fs.readFileSync(archive));
    report.arenaPackageSha256 = descriptor.sha256;
    report.administratorPackagesStripped = true;
    profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-packaged715-'));
    assert.equal(path.dirname(profile), path.resolve(os.tmpdir()));
    port = await unusedPort();
    report.profile = profile;
    const custom = { assignments: [{ giftId: '5655', amount: 37 }], borderless: false, likes: 173 };
    const customFile = path.join(profile, 'games/preservation-fixture/settings.json');
    fs.mkdirSync(path.dirname(customFile), { recursive: true });
    fs.writeFileSync(customFile, JSON.stringify(custom));
    const customHash = hash(fs.readFileSync(customFile));
    const settings = new Store({ cwd: profile, name: 'mng-config', projectVersion: '7.0.14', encryptionKey: 'mng-electron-secret-key-2024' });
    settings.set({ preview_initialized_v1: true, library_root_v1: path.join(profile, 'games'), library_previous_paths_v1: {},
        media_root_v1: path.join(profile, 'media'), entry_video_root_v1: path.join(profile, 'entry'),
        media_studio_v1: { version: 1, items: [] }, entry_videos_v1: { version: 2, rules: [], sessions: {} },
        media_background_downloads_enabled: false, tiktok_active_account: '', tiktok_accounts: [],
        widget_announcements_v1: { [require('../lib/widget-announcements.cjs').ID]: true },
        game_announcements_v1: {}, release715_custom_preferences: custom,
        tts_settings_v1: { volume: 0.43, cooldownSeconds: 7, maxLength: 163, names: false },
        overlay_installation_v1: crypto.randomBytes(16).toString('hex') });
    let page = await launch();
    const snapshot = await page.evaluate(() => mngAPI.workspace('snapshot'));
    assert.equal(snapshot.version, '7.0.15');
    assert.equal(snapshot.preview, false);
    assert.equal(snapshot.libraryRoot, path.join(profile, 'games'));
    assert.deepEqual(snapshot.gameAnnouncements, [{ id: 'yaratik-arena-0.1.20', gameId: 'yaratik-arena' }]);
    assert.deepEqual(snapshot.widgetAnnouncements, []);
    const arena = snapshot.games.find(game => game.id === 'yaratik-arena');
    assert.ok(arena);
    assert.equal(arena.availableVersion, '0.1.20');
    assert.equal(arena.downloadReady, true);
    assert.equal(arena.installed, false);
    assert.equal(arena.steamDemo.appId, '5364590');
    assert.equal(arena.steamDemo.storeUrl, storeURL);
    assert.equal(typeof arena.steamDemo.installed, 'boolean');
    assert.ok(arena.giftGuide?.bytes > 0);
    report.realPackagedIPC = true;
    report.actualSteamDemoInstalled = arena.steamDemo.installed;
    await page.locator('#gameAnnouncement[open]').waitFor();
    assert.equal(await page.locator('#gameAnnouncement').getAttribute('data-announcement-id'), 'yaratik-arena-0.1.20');
    await page.locator('[data-announcement-open="yaratik-arena"]').click();
    await page.locator('[data-action="arena-demo-refresh"]').waitFor();
    await page.waitForFunction(async () => (await mngAPI.workspace('snapshot')).gameAnnouncements.length === 0);
    const title = await page.locator('#workspaceTitle').textContent();
    assert.match(title, /Arena/);
    const steamButton = page.locator('.detail-commands [data-url="' + storeURL + '"]');
    await steamButton.waitFor();
    const instructions = await page.locator('.game-setup').textContent();
    for (const term of ['Steam', '100', 'WASD', 'Space', 'Ctrl', 'Esc']) assert.ok(instructions.includes(term), 'Missing instruction ' + term);
    assert.equal(await page.locator('.game-detail-cover img').evaluate(image => image.complete && image.naturalWidth > 0), true);
    const opened = await application.evaluate(({ shell }) => {
        globalThis.qa715OpenedURLs = [];
        globalThis.qa715OriginalOpenExternal = shell.openExternal;
        shell.openExternal = async url => { globalThis.qa715OpenedURLs.push(url); };
        return true;
    });
    assert.equal(opened, true);
    await steamButton.click();
    await page.waitForFunction(() => true);
    assert.deepEqual(await application.evaluate(() => globalThis.qa715OpenedURLs), [storeURL]);
    report.steamDetail = true;
    report.externalBrowserOpenIntercepted = true;
    await page.locator('[data-action="arena-demo-refresh"]').click();
    await page.locator('[data-action="arena-demo-refresh"]:enabled').waitFor();
    const refreshed = await page.evaluate(() => mngAPI.workspace('arena-demo-refresh'));
    assert.equal(refreshed.games.find(game => game.id === 'yaratik-arena').steamDemo.installed, arena.steamDemo.installed);
    await application.evaluate(({ app }) => {
        const require = process.getBuiltinModule('node:module').createRequire(app.getAppPath() + '/package.json');
        globalThis.qa715ArenaModule = require('./lib/arena-package.cjs');
        globalThis.qa715OriginalFindSteamDemo = globalThis.qa715ArenaModule.findSteamDemo;
        globalThis.qa715ArenaModule.findSteamDemo = () => null;
    });
    await page.locator('[data-action="arena-demo-refresh"]').click();
    await page.locator('[data-action="arena-demo-refresh"]:enabled').waitFor();
    const missing = await page.evaluate(() => mngAPI.workspace('arena-demo-refresh'));
    assert.equal(missing.games.find(game => game.id === 'yaratik-arena').steamDemo.installed, false);
    assert.match(await page.locator('.game-detail-info [role="status"]').textContent(), /Steam/);
    assert.equal(await steamButton.isEnabled(), true);
    await application.evaluate(() => { globalThis.qa715ArenaModule.findSteamDemo = globalThis.qa715OriginalFindSteamDemo; });
    await page.locator('[data-action="arena-demo-refresh"]').click();
    await page.locator('[data-action="arena-demo-refresh"]:enabled').waitFor();
    report.demoStatusRefresh = true;
    report.demoMissingDiscoveryStubbed = true;
    const destination = path.join(profile, 'Documents/TikMnG-Yaratik-Arena-Hediyeler.png');
    await application.evaluate(({ dialog }, file) => {
        globalThis.qa715GuideDialogs = [];
        dialog.showSaveDialog = async (_window, options) => {
            globalThis.qa715GuideDialogs.push(options);
            return { canceled: false, filePath: file };
        };
    }, destination);
    await page.locator('[data-gift-guide="yaratik-arena"]').click();
    await page.waitForFunction(() => document.querySelector('#workspaceNotice')?.textContent.includes('indirildi'));
    assert.equal(fs.statSync(destination).size, arena.giftGuide.bytes);
    assert.equal(hash(fs.readFileSync(destination)), arena.giftGuide.sha256);
    assert.equal(fs.readFileSync(destination).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const dialogs = await application.evaluate(() => globalThis.qa715GuideDialogs);
    assert.equal(dialogs.length, 1);
    assert.equal(dialogs[0].defaultPath, arena.giftGuide.filename);
    report.guidePNGVerified = true;
    const widgetSave = await page.evaluate(() => mngAPI.widgetStudioKaydet('topgift', { title: 'QA715 custom title', frameStyle: 'crystal', entranceSound: 'gift-arrive', scale: 113 }));
    assert.equal(widgetSave.basarili, true, widgetSave.hata);
    await page.screenshot({ path: path.join(out, 'packaged-arena-desktop.png'), fullPage: true });
    await application.close();
    application = null;
    page = await launch();
    const restarted = await page.evaluate(() => mngAPI.workspace('snapshot'));
    assert.deepEqual(restarted.gameAnnouncements, []);
    assert.equal(await page.locator('#gameAnnouncement[open]').count(), 0);
    assert.equal(restarted.tts.volume, 0.43);
    assert.equal(restarted.tts.cooldownSeconds, 7);
    assert.equal(restarted.tts.maxLength, 163);
    const widget = await page.evaluate(() => mngAPI.widgetBilgisi());
    assert.equal(widget.studio.settings.topgift.title, 'QA715 custom title');
    assert.equal(widget.studio.settings.topgift.frameStyle, 'crystal');
    assert.equal(widget.studio.settings.topgift.scale, 113);
    const unknown = await page.evaluate(() => mngAPI.workspace('not-allowed').then(() => false, () => true));
    assert.equal(unknown, true, 'Preload allowlist must still reject unknown commands');
    await openArena(page);
    await page.screenshot({ path: path.join(out, 'packaged-arena-restarted.png'), fullPage: true });
    await application.close();
    application = null;
    const after = new Store({ cwd: profile, name: 'mng-config', encryptionKey: 'mng-electron-secret-key-2024' });
    assert.deepEqual(after.get('release715_custom_preferences'), custom);
    assert.equal(after.get('game_announcements_v1')['game:yaratik-arena'], true);
    assert.equal(after.get('library_root_v1'), path.join(profile, 'games'));
    assert.equal(hash(fs.readFileSync(customFile)), customHash);
    assert.deepEqual(errors, []);
    report.newGameOnlyAnnouncement = true;
    report.settingsSurviveRestart = true;
    report.preloadAllowlistEnforced = true;
    report.licensingStillRequired = true;
    assert.equal(hash(fs.readFileSync(archive)), report.appAsarSha256, 'Packaged files changed during QA');
    report.passed = true;
}

main().catch(error => { report.error = error.stack; console.error(error.stack); process.exitCode = 1; }).finally(async () => {
    try { await application?.close(); } catch (error) { report.closeError = error.message; report.passed = false; process.exitCode = 1; }
    report.errors = errors;
    report.finishedAt = new Date().toISOString();
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'packaged-result.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
});
