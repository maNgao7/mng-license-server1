'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-stable-6517-'));
let application;
(async () => {
    const env = { ...process.env, MNG_TEST_PROFILE: temporary, MNG_WIDGET_PORT: '32076' };
    delete env.ELECTRON_RUN_AS_NODE;
    application = await _electron.launch({ executablePath: path.resolve(__dirname, '../dist/win-unpacked/TikMnG.exe'), env, timeout: 30000 });
    const page = await application.firstWindow();
    await page.waitForSelector('.library-card');
    const actual = await page.evaluate(async () => {
        const data = await window.mngAPI.workspace('snapshot');
        const voices = await window.mngAPI.workspace('speech-status');
        return { games: data.games.length, preview: data.preview, version: data.version, styles: voices.profiles.length,
            allStylesAvailable: voices.profiles.every(profile => profile.available) };
    });
    assert.deepEqual(actual, { games: 14, preview: false, version: '6.5.17', styles: 10, allStylesAvailable: true });
    console.log(JSON.stringify({ passed: true, ...actual, isolatedProfile: true }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    await application?.close();
    if (path.dirname(temporary) === path.resolve(os.tmpdir())) fs.rmSync(temporary, { recursive: true, force: true });
});
