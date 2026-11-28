'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Each child opens the real packaged HTML in a fresh Electron process.
if (process.versions.electron) {
  const { app, BrowserWindow } = require('electron');
  app.disableHardwareAcceleration();
  app.whenReady().then(async () => {
    const [view, expected, entered] = JSON.parse(process.env.BOX_CHANNEL_CASE);
    const root = process.env.BOX_CHANNEL_APP_ROOT || path.join(__dirname, '..');
    const win = new BrowserWindow({ show: false });
    await win.loadFile(path.join(root, view, 'index.html'));
    const read = () => win.webContents.executeJavaScript("document.getElementById('username').value");
    assert.equal(await read(), expected);
    await win.webContents.executeJavaScript(`{
      const field = document.getElementById('username');
      field.value = ${JSON.stringify(entered)};
      field.dispatchEvent(new Event('input', {bubbles:true}));
    }`);
    app.quit();
  }).catch(error => { console.error(error); app.exit(1); });
} else {
  const test = require('node:test');
  const run = require('node:util').promisify(require('node:child_process').execFile);
  test('last channel survives relaunch across both views without connecting', async t => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'box-channel-'));
    t.after(() => fs.rmSync(profile, { recursive:true, force:true, maxRetries:8, retryDelay:100 }));
    const electron = require(path.resolve(__dirname, '../../../frog-river/node_modules/electron'));
    for (const scenario of [
      ['spectator', '', ' @Boxer.01 '],
      ['desktop', 'boxer.01', 'second_02'],
      ['spectator', 'second_02', 'invalid name!'],
      ['spectator', 'second_02', ''],
      ['spectator', '', '']
    ]) {
      const env = { ...process.env, BOX_CHANNEL_CASE: JSON.stringify(scenario) };
      delete env.ELECTRON_RUN_AS_NODE;
      await run(electron, [__filename, '--user-data-dir='+profile, '--disable-background-networking'], {env, windowsHide:true, timeout:15000});
    }
  });
}
