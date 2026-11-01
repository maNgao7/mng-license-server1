'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { _electron } = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = 'D:/TikMnG-Snake-Arena-Prototype/qa/preview5-delivery';
const exe = 'D:/TikMnG-Manager-7.0.0/win-unpacked/TikMnG.exe';
let application;

async function main() {
    fs.mkdirSync(output, {recursive:true});
    let announcementRepair = null;
    if (process.argv.includes('--restore-qa-announcement')) {
        // Run while the preview is closed, using its normal structured store API.
        const Store = require('electron-store');
        const store = new Store({cwd:path.join(process.env.APPDATA,'TikMnG-Test-6.5.17'),projectVersion:'7.0.2-preview.5',name:'mng-config',encryptionKey:'mng-electron-secret-key-2024'});
        const channel = String(store.get('tiktok_active_account','')).trim().replace(/^@/,'').toLowerCase() || 'installation';
        const scope = require('node:crypto').createHash('sha256').update(channel).digest('hex');
        const id = 'minecraft-snake-arena-0.15.0';
        const key = scope+':'+id;
        const seen = store.get('game_announcements_v1',{});
        const changed = Object.hasOwn(seen,key);
        if (changed) { delete seen[key]; store.set('game_announcements_v1',seen); }
        announcementRepair = {id,restoredPreviouslyUnseen:changed,otherFlagsPreserved:true};
    }
    const env = {...process.env};
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.MNG_TEST_PROFILE;
    application = await _electron.launch({executablePath:exe,args:['--tikmng-preview'],env,timeout:60000});
    const page = await application.firstWindow();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForFunction(() => window.mngAPI && document.querySelector('#workspaceRoot'), null, {timeout:60000});
    const before = await page.evaluate(() => window.mngAPI.workspace('snapshot'));
    assert.equal(before.version,'7.0.2-preview.5');
    assert.equal(before.preview,true);
    const expected = {'minecraft-snake-arena':'0.15.2','battle-royale':'7.0.2-preview.5','snow-war':'7.0.2-preview.5'};
    for (const [id,version] of Object.entries(expected)) {
        const game = before.games.find(game => game.id===id);
        assert.equal(game.installedVersion,version,id);
        assert.equal(game.installed,true,id);
    }
    if (process.argv.includes('--restore-qa-announcement')) {
        await page.locator('#gameAnnouncement[open]').waitFor({timeout:45000});
    }
    await page.screenshot({path:path.join(output,'installed-preview5.png')});
    const after = await page.evaluate(() => window.mngAPI.workspace('snapshot'));
    // Publisher readiness adds a derived HTTPS URL after startup; it is not a saved mapping change.
    const mediaDigest = items => crypto.createHash('sha256').update(JSON.stringify(items.map(({broadcastUrl,...saved})=>saved))).digest('hex');
    assert.equal(mediaDigest(after.media),mediaDigest(before.media),'saved media definitions must stay unchanged');
    assert.deepEqual(after.tts,before.tts);
    assert.deepEqual(after.games.map(g=>({id:g.id,path:g.path,installedVersion:g.installedVersion})),before.games.map(g=>({id:g.id,path:g.path,installedVersion:g.installedVersion})));
    assert.deepEqual(errors,[]);
    const result = {passed:true,exe,version:after.version,preview:true,installedVersions:expected,
        mediaAndSpeechUnchanged:true,gamePointersUnchanged:true,announcementRepair,errors};
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(async()=>{await application?.close();});
