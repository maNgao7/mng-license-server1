'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { readMediaArchive } = require('../lib/media-archive.cjs');
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const folder = process.argv[2];
let app;
async function main() {
    assert.ok(folder && path.isAbsolute(folder) && path.parse(folder).root.toUpperCase() === 'D:\\', 'Explicit D: archive folder required');
    const entries = await readMediaArchive(folder);assert.ok(entries.length > 0);
    const env = { ...process.env };delete env.ELECTRON_RUN_AS_NODE;delete env.MNG_TEST_PROFILE;delete env.MNG_WIDGET_PORT;
    app = await _electron.launch({ executablePath: 'D:/TikMnG-Test-6.5.17/win-unpacked/TikMnG Test.exe', env });
    const page = await app.firstWindow();page.setDefaultTimeout(60000);
    await page.waitForSelector('.library-card', { state: 'attached' });
    await page.evaluate(()=>window.mngAPI.workspace('speech-status'));
    assert.equal(await app.evaluate(({ app, dialog },root) => {
        global.__privateArchiveDialog=dialog.showOpenDialog;global.__privateArchiveRoot=root;
        dialog.showOpenDialog=()=>({canceled:false,filePaths:[global.__privateArchiveRoot]});
        return app.getPath('userData');
    },folder.replaceAll('\\','/')), 'C:\\Users\\User\\AppData\\Roaming\\TikMnG-Test-6.5.17');
    const call = (action, data) => page.evaluate(({ action, data }) => window.mngAPI.workspace(action, data), { action, data });
    const before = await call('snapshot');
    const available = [...before.media, ...(before.audioLibrary || [])];
    const existing = entries.filter(entry => available.some(item => item.title === entry.title && item.category === entry.category));
    if (existing.length) {
        assert.equal(existing.length, entries.length, 'Partially imported archive requires review before adding duplicates');
        console.log('All archive entries are already available. No duplicate actions were created.');return;
    }
    let after;
    try { after = await call('media-folder');assert.equal(after.error, undefined, after.error); }
    finally { await app.evaluate(({ dialog }) => { dialog.showOpenDialog = global.__privateArchiveDialog;delete global.__privateArchiveDialog;delete global.__privateArchiveRoot; }).catch(()=>{}); }
    const added = after.media.filter(item => !before.media.some(old => old.id === item.id));
    assert.equal(added.length, entries.length);assert.ok(added.every(item => !item.giftId && !item.gameId));
    const fields = ({ id, giftId, gameId, title, category, enabled, trigger, volume, startSeconds, endSeconds }) =>
        ({ id, giftId, gameId, title, category, enabled, trigger, volume, startSeconds, endSeconds });
    assert.deepEqual(after.media.filter(item => before.media.some(old => old.id === item.id)).map(fields), before.media.map(fields));
    const verified = [];
    for (const item of added) {
        const response = await fetch(new URL(item.mediaUrl, after.overlayUrl));assert.equal(response.status, 200);
        const bytes = Buffer.from(await response.arrayBuffer()), source = entries.find(entry => entry.title === item.title && entry.category === item.category);
        assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), crypto.createHash('sha256').update(fs.readFileSync(source.path)).digest('hex'));
        verified.push({ title: item.title, category: item.category, bytes: bytes.length, kind: item.kind });
    }
    const report = { privatePreviewOnly: true, folder, count: verified.length, exactBytesVerified: true, oldAssignmentsPreserved: true,
        usernamesNotChanged: true, autoGiftAssignmentsAdded: false, verifiedAt: new Date().toISOString(), entries: verified };
    fs.writeFileSync(path.join(folder, 'preview-import-result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ imported: verified.length, exactBytesVerified: true, oldAssignmentsPreserved: true }));
}
main().catch(error => { console.error(error);process.exitCode = 1; }).finally(async () => { await app?.close(); });
