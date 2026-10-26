'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Store=require('electron-store');
const {_electron}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output=process.env.MNG_QA_OUTPUT||'D:/TikMnG-Widget-Preview12-20261026',executable='D:/TikMnG-Manager-7.0.0/win-unpacked/TikMnG.exe';
const version=JSON.parse(require('@electron/asar').extractFile(path.join(path.dirname(executable),'resources/app.asar'),'package.json')).version;
const expectedVersion=process.env.MNG_QA_VERSION||'7.0.2-preview.12';
assert.equal(version,expectedVersion);
const saved=new Store({cwd:path.join(process.env.APPDATA,'TikMnG-Test-6.5.17'),name:'mng-config',projectVersion:expectedVersion,encryptionKey:'mng-electron-secret-key-2024'});
const preserve=['media_studio_v1','tts_settings_v1','library_root_v1','library_previous_paths_v1','media_root_v1','chatterbox_root_v1'];
const baseline=path.join(output,'preservation-baseline');fs.mkdirSync(baseline,{recursive:true});fs.copyFileSync(path.join(output,process.env.MNG_QA_PROFILE_BACKUP||'admin-profile-before-preview12.encrypted'),path.join(baseline,'mng-config.json'));
const original=new Store({cwd:baseline,name:'mng-config',projectVersion:expectedVersion,encryptionKey:'mng-electron-secret-key-2024'});
const before=Object.fromEntries(preserve.map(key=>[key,original.get(key)]));
const originalAccount=original.get('tiktok_active_account');
const widgetSettings=Object.fromEntries(Object.entries(original.store).filter(([key])=>key.startsWith('widget_studio_v1__')).map(([key,value])=>[key,value.settings||{}]));
let app;
async function run(){
    const start=Date.now(),env={...process.env,MNG_QA_STARTUP_FILE:path.join(output,'installed-startup-timing.json')};
    delete env.ELECTRON_RUN_AS_NODE;delete env.MNG_TEST_PROFILE;delete env.MNG_WIDGET_ACCESS_KEY;delete env.MNG_WIDGET_PORT;
    app=await _electron.launch({executablePath:executable,args:['--tikmng-preview'],env,timeout:60000});
    const page=await app.firstWindow();
    await page.waitForFunction(()=>typeof window.mngAPI?.tiktokBaglan==='function');
    const info=await page.evaluate(()=>window.mngAPI.widgetBilgisi());
    if(await page.locator('[data-workspace-view="widgets"]').isVisible()){
        const close=page.locator('[data-announcement-close]');if(await close.isVisible())await close.click();
        await page.locator('[data-workspace-view="widgets"]').click();await page.waitForTimeout(1500);
        await page.screenshot({path:path.join(output,'installed-admin-widgets.png')});
    }
    if(process.env.MNG_QA_GAME_SETUP==='1'){
        await page.locator('[data-workspace-view="games"]').click();
        await page.locator('[data-open="minecraft-snake-arena"]').first().click();
        await page.locator('.game-setup').waitFor();
        assert.deepEqual(await page.locator('.setup-step-number').allTextContents(),['1','2','3','4','5','6']);
        assert.equal(await page.locator('.game-setup h2').evaluate(node=>getComputedStyle(node).fontSize),'22px');
        assert.equal(await page.locator('.game-setup p').first().evaluate(node=>getComputedStyle(node).fontSize),'14px');
        await page.locator('.game-setup').screenshot({path:path.join(output,'installed-game-setup.png')});
    }
    const after=Object.fromEntries(preserve.map(key=>[key,saved.get(key)]));
    for(const key of preserve.filter(key=>key!=='media_studio_v1'))assert.deepEqual(after[key],before[key],'Preserved setting '+key);
    assert.equal(saved.get('tiktok_active_account'),originalAccount,'Selected broadcast account preserved');
    for(const [key,settings]of Object.entries(widgetSettings))assert.deepEqual(saved.get(key)?.settings||{},settings,'Saved widget settings preserved');
    for(const field of ['items','assetLibrary','audioLibrary']){
        const rows=new Map((after.media_studio_v1?.[field]||[]).map(row=>[row.id,row]));
        for(const row of before.media_studio_v1?.[field]||[])assert.deepEqual(rows.get(row.id),row,'Preserved media record '+row.id);
    }
    assert.equal(info.widgets.length,17);
    const result={version,status:info.liveStatus?.status,widgetCount:info.widgets.length,preservedKeys:preserve,preservedWidgetAccounts:Object.keys(widgetSettings).length,broadcastAccountPreserved:true,existingMappingsPreserved:before.media_studio_v1?.items?.length||0,newAccountSeededMedia:(after.media_studio_v1?.items?.length||0)-(before.media_studio_v1?.items?.length||0),elapsedMs:Date.now()-start};
    fs.writeFileSync(path.join(output,'installed-activation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
run().catch(error=>{console.error(String(error.message).split('\n')[0]);process.exitCode=1;}).finally(async()=>{await app?.close();});
