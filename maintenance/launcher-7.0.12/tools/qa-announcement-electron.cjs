'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = 'D:/TikMnG-Widget-Preview12-20261026/announcement-qa';
fs.mkdirSync(output, { recursive: true });
let app, prepared = false;
async function fresh(page) {
    await app.evaluate(() => { globalThis.qaAnnouncementStore.delete('game_announcements_v1'); });
    await page.reload();
    await page.locator('#gameAnnouncement[open]').waitFor();
}
async function main() {
    const profile=fs.mkdtempSync(path.join(output,'isolated-'));
    const original=path.join(process.env.APPDATA,'TikMnG-Test-6.5.17/mng-config.json');
    fs.copyFileSync(original,path.join(profile,'mng-config.json'));
    const Store=require('electron-store');
    const settings=new Store({cwd:profile,name:'mng-config',projectVersion:'7.0.1',encryptionKey:'mng-electron-secret-key-2024'});
    settings.set('media_root_v1',path.join(profile,'media'));settings.set('library_root_v1',path.join(profile,'games'));
    settings.set('library_previous_paths_v1',{});settings.set('game_announcements_v1',{});
    settings.set('tiktok_active_account','');settings.set('tiktok_accounts',[]);settings.delete('widget_access_key');settings.delete('overlay_installation_v1');
    const port=await new Promise((resolve,reject)=>{const server=require('node:net').createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
    const env = { ...process.env,MNG_TEST_PROFILE:profile,MNG_WIDGET_PORT:String(port) }; delete env.ELECTRON_RUN_AS_NODE;
    app = await _electron.launch({ executablePath: process.env.MNG_QA_SOURCE ? require('electron') : process.env.MNG_QA_EXE || 'D:/TikMnG-Manager-7.0.0/win-unpacked/TikMnG.exe', args: [...(process.env.MNG_QA_SOURCE ? [path.resolve(__dirname, '..')] : []), '--tikmng-preview'], env, timeout: 60000 });
    const page = await app.firstWindow();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.waitForFunction(() => document.querySelector('#workspaceRoot'), null, { timeout: 45000 });
    await app.evaluate(({app}) => {
        const require = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/package.json');
        const Store = require('electron-store');
        globalThis.qaAnnouncementStore = new Store({ name: 'mng-config', encryptionKey: 'mng-electron-secret-key-2024' });
        globalThis.qaOriginalAnnouncements = globalThis.qaAnnouncementStore.get('game_announcements_v1');
    });
    prepared = true;
    await fresh(page);
    console.log('SNAPSHOT', JSON.stringify(await page.evaluate(async () => {
        const s = await window.mngAPI.workspace('snapshot');
        return { version: s.version, pending: s.gameAnnouncements, game: s.games.find(g => g.id === 'minecraft-snake-arena')?.installed };
    })));
    console.log('HIT', JSON.stringify(await page.locator('[data-announcement-close]').evaluate(el => {
        const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { rect: r.toJSON(), hit: hit?.outerHTML, disabled: el.disabled };
    })));
    await page.screenshot({ path: path.join(output, 'before.png') });
    await page.locator('[data-announcement-close]').click({ timeout: 5000 });
    await page.waitForTimeout(2000);
    const open = await page.locator('#gameAnnouncement').evaluate(d => d.open);
    const result = { open, errors, notice: await page.locator('#workspaceNotice').textContent() };
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
    console.log('RESULT', JSON.stringify(result));
    assert.equal(open, false, 'X must close the real packaged launcher announcement');
    await page.waitForFunction(async () => !(await window.mngAPI.workspace('snapshot')).gameAnnouncements.length);
    await page.reload(); await page.locator('.library-card').first().waitFor();
    assert.equal(await page.locator('#gameAnnouncement[open]').count(), 0, 'dismissal survives a real snapshot/reload');
    await page.evaluate(()=>window.mngAPI.tiktokHesapKaydet('qa_announcement_other'));
    await page.reload();await page.locator('.library-card').first().waitFor();
    assert.equal(await page.locator('#gameAnnouncement[open]').count(),0,'Switching accounts must not reopen a dismissed game announcement');
    await fresh(page);
    await page.locator('[data-announcement-open]').click();
    await page.locator('[data-back]').waitFor();
    assert.equal(await page.locator('#workspaceTitle').textContent(), 'Minecraft Yılan Oyunu');
    assert.equal(await page.locator('#gameAnnouncement[open]').count(), 0);
    await fresh(page);
    // Keep the real preload and renderer; replace only the large archive installer.
    await app.evaluate(({ipcMain}) => {
        globalThis.qaInstallCalls=[];
        ipcMain.removeHandler('workspace-install');
        ipcMain.handle('workspace-install', async (_event, data) => {
            globalThis.qaInstallCalls.push(data);
            await new Promise(resolve => setTimeout(resolve, 250));
            return {basarili:true};
        });
    });
    await page.locator('[data-announcement-download]').click();
    await page.waitForFunction(() => document.querySelector('#workspaceNotice').textContent.includes('kurulumu tamamlandı'));
    const installs = await app.evaluate(() => globalThis.qaInstallCalls);
    assert.equal(installs.length, 1); assert.equal(installs[0].id, 'minecraft-snake-arena');
    assert.equal(await page.locator('#gameAnnouncement[open]').count(), 0);
    for(const mode of ['reject','hang']) {
        await fresh(page);
        await app.evaluate(({ipcMain},mode) => {
            ipcMain.removeHandler('workspace-announcement-dismiss');
            ipcMain.handle('workspace-announcement-dismiss', () => mode==='hang' ? new Promise(()=>{}) : {error:'QA persistence failed'});
        },mode);
        await page.locator('[data-announcement-close]').click();
        await page.waitForFunction(() => !document.querySelector('#gameAnnouncement').open);
        await page.locator('[data-workspace-view="downloads"]').click();
        assert.equal(await page.locator('#workspaceTitle').textContent(), 'İndirmeler');
    }
    assert.deepEqual(errors, []);
    const complete={passed:true,isolatedProfile:true,realNativeDocument:true,realPreload:true,realDismissPersistence:true,close:true,inspect:true,downloadSingleRequest:true,downloadArchiveStubbed:true,writeFailureNonBlocking:true,hungWriteNonBlocking:true,errors};
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(complete,null,2)+'\n');console.log(JSON.stringify(complete));
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; }).finally(async () => {
    if(prepared)await app.evaluate(() => {
        const key='game_announcements_v1';
        if(globalThis.qaOriginalAnnouncements===undefined)globalThis.qaAnnouncementStore.delete(key);
        else globalThis.qaAnnouncementStore.set(key,globalThis.qaOriginalAnnouncements);
    }).catch(()=>{});
    await app?.close();
});
