'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { _electron } = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = 'D:/TikMnG-Snake-Arena-Prototype/qa/installed-0.16.0';
const exe = 'D:/TikMnG-Manager-7.0.0/win-unpacked/TikMnG.exe';
const id = 'minecraft-snake-arena';
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const stableFile = path.join(process.env.APPDATA, 'mng-tiktok-game/mng-config.json');
const stableDigest = fs.existsSync(stableFile) ? digest(fs.readFileSync(stableFile)) : null;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let application, restoreConfig, installedConfig;
async function open() {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.MNG_TEST_PROFILE;
    application = await _electron.launch({ executablePath: exe, args: ['--tikmng-preview'], env, timeout: 60000 });
    const page = await application.firstWindow();
    await page.waitForFunction(() => window.mngAPI && document.querySelector('#workspaceRoot'), null, { timeout: 60000 });
    return page;
}
async function main() {
    fs.mkdirSync(output, { recursive: true });
    const openedAt = Date.now(), page = await open();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const before = await page.evaluate(() => window.mngAPI.workspace('snapshot'));
    assert.equal(before.preview, true); assert.equal(before.version, '7.0.6-preview.1');
    const startupMs = Date.now() - openedAt;
    const prior = before.games.find(g => g.id === id);
    const previousConfig = prior?.installed ? path.join(prior.path, 'game-instance/config/tikmng-snake-arena.json') : null;
    const previousBytes = previousConfig && fs.existsSync(previousConfig) ? fs.readFileSync(previousConfig) : null;
    await page.evaluate(() => { window.hotfixProgress = []; window.mngAPI.workspaceListen('progress', p => window.hotfixProgress.push({...p, at: Date.now()})); });
    const started = Date.now();
    const result = await page.evaluate(({id, repair}) => window.mngAPI.workspace('install', { id, repair }), {id, repair: process.argv.includes('--repair')});
    assert.equal(result.basarili, true, result.hata || result.error);
    const installMs = Date.now() - started;
    const after = await page.evaluate(() => window.mngAPI.workspace('snapshot'));
    const game = after.games.find(g => g.id === id);
    assert.equal(game.installedVersion, '0.16.0'); assert.equal(game.installed, true);
    installedConfig = path.join(game.path, 'game-instance/config/tikmng-snake-arena.json');
    if (previousBytes) assert.deepEqual(fs.readFileSync(installedConfig), previousBytes, 'exact game settings retained during update');
    const mod = path.join(game.path, 'game-instance/mods/tikmng_snake_arena-0.16.0.jar');
    assert.equal(digest(fs.readFileSync(mod)), digest(fs.readFileSync('D:/TikMnG-Snake-Arena-Prototype/mod/build/libs/tikmng_snake_arena-0.16.0.jar')));
    assert.deepEqual(fs.readdirSync(path.dirname(mod)).filter(f => /^tikmng_snake_arena.*\.jar$/.test(f)), [path.basename(mod)]);
    const preserved = before.games.filter(g => g.installed && g.id !== id);
    for (const old of preserved) {
        const current = after.games.find(g => g.id === old.id);
        assert.equal(current.path, old.path); assert.equal(current.installedVersion, old.installedVersion);
    }
    const mediaState = items => digest(JSON.stringify(items.map(({ broadcastUrl, ...saved }) => saved)));
    assert.equal(mediaState(after.media), mediaState(before.media));
    assert.deepEqual(after.tts, before.tts);
    const progress = await page.evaluate(() => window.hotfixProgress);
    const content = progress.findLast(p => p.updateMode === 'content');
    await page.screenshot({ path: path.join(output, 'launcher-installed.png') });
    restoreConfig = fs.readFileSync(installedConfig);
    const launchedAt = Date.now();
    const launched = await page.evaluate(id => window.mngAPI.uygulamaAc(id, { tiktokUser: 'siilaaoo' }), id);
    assert.equal(launched.basarili, true, launched.hata);
    const log = path.join(game.path, 'game-instance/launch.log');
    let ready = false;
    for (let n = 0; n < 360; n++) {
        if (fs.existsSync(log) && fs.readFileSync(log, 'utf8').includes('MNG_SNAKE_ARENA_READY')) { ready = true; break; }
        await sleep(500);
    }
    assert.equal(ready, true, 'packaged native arena must render and signal readiness');
    const launchMs = Date.now() - launchedAt;
    await application.close(); application = null;
    // Restore only this QA launch's temporary channel selection after its owned game has exited.
    fs.writeFileSync(installedConfig, restoreConfig); restoreConfig = null;
    const reopened = await open();
    const persisted = await reopened.evaluate(() => window.mngAPI.workspace('snapshot'));
    const persistedGame = persisted.games.find(g => g.id === id);
    assert.equal(persistedGame.path, game.path); assert.equal(persistedGame.installedVersion, '0.16.0');
    if (previousBytes) assert.deepEqual(fs.readFileSync(installedConfig), previousBytes);
    assert.deepEqual(errors, []);
    if (stableDigest) assert.equal(digest(fs.readFileSync(stableFile)), stableDigest);
    const report = { passed: true, version: persisted.version, gameVersion: persistedGame.installedVersion,
        startupMs, installMs, launchMs, nativeArenaReady: ready, exactPriorSettingsPreserved: Boolean(previousBytes),
        otherGamesPreserved: preserved.length, mediaAndSpeechPreserved: true, stableProfileUntouched: true,
        singleModVersion: true, installedModMatchesTestedBuild: true, installationSurvivesRestart: true,
        phases: progress.filter((p, i) => i === 0 || progress[i - 1].phase !== p.phase).map(p => ({phase:p.phase, atMs:p.at-started})),
        transfer: content ? { reusedBytes: content.reusedBytes, transferredBytes: content.transferredBytes,
            changedFiles: content.changedFiles, packageBytes: content.packageBytes } : null, errors };
    fs.writeFileSync(path.join(output, process.argv.includes('--repair') ? 'result-repair.json' : 'result.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; }).finally(async () => {
    await application?.close();
    if (restoreConfig && installedConfig) fs.writeFileSync(installedConfig, restoreConfig);
});
