const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {_electron}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let application,stage='startup';
(async()=>{
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-clipboard-'));
    const env={...process.env,MNG_TEST_PROFILE:profile,MNG_WIDGET_PORT:'31979'};delete env.ELECTRON_RUN_AS_NODE;
    const executablePath=process.env.MNG_CLIPBOARD_QA_EXE||path.resolve(__dirname,'../node_modules/electron/dist/electron.exe');
    application=await _electron.launch({executablePath,args:process.env.MNG_CLIPBOARD_QA_EXE?[]:[path.resolve(__dirname,'..')],env,timeout:60000});
    const page=await application.firstWindow();await page.waitForFunction(()=>window.mngAPI&&typeof lisansEkraniGoster==='function');
    stage='clipboard';
    await application.evaluate(({clipboard,Menu})=>{
        globalThis.clipboardQA={formats:clipboard.availableFormats().map(format=>({format,bytes:clipboard.readBuffer(format)})),build:Menu.buildFromTemplate,menus:[]};
        Menu.buildFromTemplate=template=>{globalThis.clipboardQA.menus.push(template);return{popup(){}};};
    });
    await page.evaluate(()=>lisansEkraniGoster('Yerel pano testi'));await page.waitForTimeout(300);
    assert.equal(await page.locator('dialog[open]').count(),0,'Login must not be blocked by a hidden modal');
    for(const [id,value] of [['licenseUsername','clipboard_qa'],['licenseInput','MNG7-TEST-0000-1234']]){
        await application.evaluate(({clipboard},value)=>clipboard.writeText(value),value);
        const field=page.locator('#'+id);await field.click();await field.press('Control+A');await field.press('Control+V');
        await page.waitForFunction(({id,value})=>document.getElementById(id).value===value,{id,value});
        await field.press('Control+A');await field.press('Control+C');assert.equal(await application.evaluate(({clipboard})=>clipboard.readText()),value);
        await field.click({button:'right'});
        const menu=await application.evaluate(()=>globalThis.clipboardQA.menus.at(-1));assert.ok(menu.some(item=>item.role==='paste'&&item.enabled));
        await field.fill('');await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.paste());
        await page.waitForFunction(({id,value})=>document.getElementById(id).value===value,{id,value});
    }
    stage='announcement-after-login';
    await page.evaluate(()=>anaEkraniGoster());await page.waitForFunction(()=>document.getElementById('gameAnnouncement')?.open);
    await page.evaluate(()=>lisansEkraniGoster('Girişe dön'));assert.equal(await page.locator('dialog[open]').count(),0);
    await page.locator('#licenseUsername').click();
    await page.evaluate(()=>anaEkraniGoster());await page.waitForFunction(()=>document.getElementById('gameAnnouncement')?.open);
    await page.locator('[data-announcement-close]').click();
    await page.evaluate(()=>{lisansEkraniGoster('Tekrar giriş');anaEkraniGoster();});
    assert.equal(await page.locator('#gameAnnouncement').evaluate(dialog=>dialog.open),false,'Dismissed announcement stays closed');
    console.log(JSON.stringify({passed:true,usernameKeyboardPaste:true,licenseKeyboardPaste:true,copy:true,rightClickMenu:true,nativePaste:true,loginModalBlockFixed:true,announcementDeferredUntilLogin:true,dismissalPreserved:true,realLicenseUsed:false,userProfileUntouched:true}));
})().catch(error=>{console.error(stage+': '+error.message);process.exitCode=1;}).finally(async()=>{
    if(application){await application.evaluate(({clipboard,Menu})=>{const saved=globalThis.clipboardQA;if(saved){Menu.buildFromTemplate=saved.build;clipboard.clear();for(const item of saved.formats)clipboard.writeBuffer(item.format,Buffer.from(item.bytes));}}).catch(()=>{});await application.close();}
});
