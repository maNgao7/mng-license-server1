'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output='D:/TikMnG-QA-Delivery/gift-designer-native';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-designer-qa-'));let application;
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const env={...process.env,MNG_TEST_PROFILE:profile,MNG_WIDGET_PORT:'31978'};delete env.ELECTRON_RUN_AS_NODE;
  application=await _electron.launch({executablePath:'D:/TikMnG-Test-6.5.17/win-unpacked/TikMnG Test.exe',env});
  const page=await application.firstWindow();await page.waitForSelector('.library-card');
  const button=page.locator('[data-action="gift-designer"]');assert.equal(await button.count(),1);
  // The synthetic profile has no paid license; exercise this public designer's navigation handler without altering licensing.
  await button.evaluate(element=>element.click());
  const frame=page.frameLocator('#giftDesignerV2 iframe');await frame.locator('html[data-ready="true"]').waitFor();
  assert.equal(await frame.locator('#layoutType option').count(),6);
  await frame.locator('#designName').fill('QA Masaüstü');await frame.locator('[data-add="top"]').click();await frame.locator('#giftSearch').fill('5655');await frame.locator('[data-gift="5655"]').click();await frame.locator('[data-caption="0"]').fill('2X ZOMBİ');await frame.locator('#saveBtn').click();
  await frame.locator('#designsBtn').click();assert.equal(await frame.locator('.saved-item').count(),1);await frame.locator('[data-edit]').click();
  await frame.locator('#designCanvas').evaluate(async canvas=>{await document.fonts.ready;await new Promise(resolve=>setTimeout(resolve,100));const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;if(!pixels.some((value,index)=>index%4===3&&value>0))throw new Error('Native preview is blank');});
  const pngPath=path.join(output,'QA Masaüstü.png');
  await application.evaluate(({BrowserWindow},target)=>{
    globalThis.designerDownload={state:'waiting'};
    BrowserWindow.getAllWindows()[0].webContents.session.once('will-download',(_event,item)=>{
      item.setSavePath(target);item.once('done',(_event,state)=>{globalThis.designerDownload={state};});
    });return true;
  },pngPath);
  await frame.locator('#downloadBtn').click();
  for(let attempt=0;attempt<50;attempt++){if((await application.evaluate(()=>globalThis.designerDownload)).state==='completed')break;await new Promise(resolve=>setTimeout(resolve,100));}
  assert.equal((await application.evaluate(()=>globalThis.designerDownload)).state,'completed');
  const png=fs.readFileSync(pngPath);assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');assert.ok(png.length>1000);
  await page.screenshot({path:path.join(output,'desktop-designer.png')});
  await frame.locator('#closeDesigner').click();await page.waitForFunction(()=>getComputedStyle(document.getElementById('giftDesignerV2')).display==='none');
  await button.evaluate(element=>element.click());await frame.locator('#designsBtn').click();assert.equal(await frame.locator('.saved-item').count(),1);await frame.locator('[data-close="designsModal"]').click();await frame.locator('#closeDesigner').click();
  const actual=await application.evaluate(({app})=>app.getPath('userData'));assert.equal(actual,profile);
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,installedApp:true,rightNavigationHandler:true,licenseLoginNotTested:true,iframeCatalog:true,nativeFontsAndCanvas:true,nativePNGDownload:true,saveAndReopen:true,closeAndReopen:true,isolatedProfile:true},null,2));
  console.log('Installed desktop designer QA passed.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await application?.close();});
