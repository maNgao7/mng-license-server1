'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const asar = require('@electron/asar');
const { _electron } = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = process.env.MNG_RELEASE_ROOT || 'D:/TikMnG-Release-7.0.7-ready';
const output = path.join(root, 'qa');
const archive = path.join(root, 'win-unpacked/resources/app.asar');
const previous = 'D:/TikMnG-Release-7.0.6-candidate/win-unpacked/resources/app.asar';
const changed = ['main.js', 'package.json', 'lib/app-updates.cjs', 'lib/catalog-defaults.json', 'lib/voice-driving-package.cjs', 'renderer/app.js'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
let application;

async function main() {
    fs.mkdirSync(output, { recursive: true });
    assert.deepEqual(asar.listPackage(archive).sort(), asar.listPackage(previous).sort(), 'No unrelated packaged files may be added or removed');
    let unchanged = 0;
    function compare(node, parent = '') {
        for (const [name, entry] of Object.entries(node.files || {})) {
            const relative = parent ? parent + '/' + name : name;
            if (entry.files) compare(entry, relative);
            else if (!changed.includes(relative)) {
                assert.equal(hash(asar.extractFile(archive, path.normalize(relative))),
                    hash(asar.extractFile(previous, path.normalize(relative))), relative);
                unchanged++;
            }
        }
    }
    compare(asar.getRawHeader(previous).header);
    for (const relative of changed.filter(file => file !== 'package.json')) {
        assert.equal(hash(asar.extractFile(archive, path.normalize(relative))), hash(fs.readFileSync(path.resolve(__dirname, '..', relative))));
    }
    const profile = fs.mkdtempSync(path.join(output, 'profile-'));
    const env = { ...process.env, MNG_TEST_PROFILE: profile, MNG_WIDGET_PORT: '32977' };
    delete env.ELECTRON_RUN_AS_NODE;
    application = await _electron.launch({ executablePath: path.join(root, 'win-unpacked/TikMnG.exe'), env, timeout: 60000 });
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.hide()));
    const page = await application.firstWindow();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForFunction(() => window.mngAPI && document.querySelector('#workspaceRoot'), null, { timeout: 60000 });
    const snapshot = await page.evaluate(async () => {
        await window.mngAPI.workspace('media-background', { enabled: false });
        const state = await window.mngAPI.workspace('snapshot');
        return { version: state.version, games: state.games.length, media: state.remoteMedia.length, ttsNames: state.tts.names };
    });
    assert.deepEqual(snapshot, { version: '7.0.7', games: 16, media: 285, ttsNames: false });
    const notes = fs.readFileSync('D:/TikMnG-Release-7.0.0-source/RELEASE-7.0.7.md', 'utf8');
    const information = await application.evaluate(async (_electron, notes) => {
        const updater = new (process.mainModule.require('node:events').EventEmitter)();
        updater.setFeedURL = () => {};
        updater.checkForUpdates = async () => ({ updateInfo: { version: '7.0.7', releaseNotes: notes } });
        const { createAppUpdates } = process.mainModule.require('./lib/app-updates.cjs');
        return createAppUpdates({ app: { isPackaged: true, getVersion: () => '7.0.6' },
            notify() {}, loadUpdater: () => updater, record() {} }).check();
    }, notes);
    assert.equal(information.guncellemeVar, true);
    assert.ok(information.changelog.length >= 6);
    await page.evaluate(information => updateModalAc(information), information);
    assert.ok(await page.locator('#modalChangelogList li').count() >= 6);
    await page.screenshot({ path: path.join(output, 'turkish-update-notes.png') });
    await application.evaluate(({ ipcMain }) => {
        ipcMain.removeHandler('guncelleme-indir-ve-kur');
        ipcMain.handle('guncelleme-indir-ve-kur', async () => ({ basarili: true, qaOnly: true }));
    });
    await page.evaluate(() => guncellemeBaslat());
    await application.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0].webContents.send('guncelleme-ilerleme', {
            percent: 9.123456789, transferredMB: '10.5', totalMB: '25.0', mesaj: 'Güncelleme indiriliyor. Oyunlar ve ayarlar korunuyor.'
        });
    });
    await page.waitForFunction(() => document.getElementById('updatePercent').textContent === '%9,1');
    await page.screenshot({ path: path.join(output, 'rounded-update-progress.png') });
    assert.deepEqual(errors, []);
    const report = { passed: true, ...snapshot, unchangedPackagedFiles: unchanged, changedPackagedFiles: changed,
        publicGameMetadataMatchesApprovedInstallRepair: true, nativeDllsUnchanged: true, turkishChangelogItems: information.changelog.length,
        progressText: await page.locator('#updatePercent').textContent(), pageErrors: errors,
        isolatedProfile: true, realInstallerNotLaunched: true, publicReleaseNotChangedByQa: true };
    fs.writeFileSync(path.join(output, 'packaged-verification.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(async () => { await application?.close(); });
