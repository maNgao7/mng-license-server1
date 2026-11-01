'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { _electron } = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const Store = require('C:/Users/User/Desktop/MNG-TikTok-Game/launcher/node_modules/electron-store');
const output = path.resolve(__dirname, '../qa/20261030');
const previous = JSON.parse(fs.readFileSync(path.join(output, 'shared-install-report.json')));
const root = fs.mkdtempSync('D:/TikMnG-Update-QA-20261030/component-ipc-');
const profile = path.join(root, 'profile'), library = path.join(root, 'games');
let app;
async function main() {
    // Copy only the already verified shared engine; this game has never been installed here.
    fs.cpSync(path.join(previous.root, '.game-library/shared-runtimes'), path.join(library, '.game-library/shared-runtimes'), { recursive: true });
    fs.mkdirSync(profile, { recursive: true });
    fs.copyFileSync(path.join(process.env.APPDATA, 'TikMnG-Test-6.5.17/mng-config.json'), path.join(profile, 'mng-config.json'));
    const store = new Store({ cwd: profile, name: 'mng-config', encryptionKey: 'mng-electron-secret-key-2024' });
    for (const [key, value] of Object.entries({ preview_initialized_v1: true, library_root_v1: library,
        library_previous_paths_v1: {}, media_root_v1: path.join(root, 'media'), entry_video_root_v1: path.join(root, 'entry'),
        media_studio_v1: { version: 1, items: [] }, entry_videos_v1: { version: 2, rules: [], sessions: {} },
        media_background_downloads_enabled: false, tiktok_active_account: '', tiktok_accounts: [] })) store.set(key, value);
    const env = { ...process.env, MNG_TEST_PROFILE: profile, MNG_WIDGET_PORT: '31986' };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await _electron.launch({ executablePath: 'D:/TikMnG-Update-QA-20261030/preview-build/win-unpacked/TikMnG Update Preview.exe',
        args: ['--tikmng-preview'], env, timeout: 60000 });
    const page = await app.firstWindow();
    await page.waitForFunction(() => window.mngAPI && document.getElementById('workspaceRoot'));
    const id = 'minecraft-snake-arena';
    const before = await page.evaluate(() => mngAPI.workspace('snapshot'));
    assert.equal(before.games.find(game => game.id === 'minecraft-snake-arena').installed, false);
    const started = Date.now();
    const result = await page.evaluate(id => mngAPI.workspace('install', { id }), id);
    assert.equal(result.basarili, true, result.hata || result.error);
    const after = await page.evaluate(() => mngAPI.workspace('snapshot'));
    const game = after.games.find(game => game.id === id);
    assert.equal(game.installed, true); assert.equal(game.installedVersion, '0.17.0');
    const checked = execFileSync(process.execPath, [path.join(game.path, 'launch-game.cjs'), '--check'], {
        cwd: game.path, windowsHide: true, encoding: 'utf8', timeout: 15000,
        env: { ...process.env, JAVA_HOME: '', MINECRAFT_HOME: '', TLAUNCHER_HOME: '' }
    });
    assert.equal(JSON.parse(checked).ok, true);
    const report = { passed: true, packagedIPC: true, freshGameInstall: true, existingSharedEngine: true,
        id, installedVersion: game.installedVersion, elapsedMs: Date.now() - started, noExternalLauncherRequired: true, root };
    fs.writeFileSync(path.join(output, 'packaged-component-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(async () => { await app?.close(); });
