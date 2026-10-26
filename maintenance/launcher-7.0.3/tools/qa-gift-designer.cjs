'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(process.env.MNG_DESIGNER_ROOT||path.join(__dirname,'../renderer'));
const output=process.env.MNG_QA_OUTPUT||'D:/TikMnG-QA-Delivery/gift-designer';
const KEY='tikmng-gift-designs-v1';let browser,server;
async function main(){
  fs.mkdirSync(output,{recursive:true});
  server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1');const relative=url.pathname==='/hediye-tasarimi'?'/gift-designer.html':url.pathname;
    const file=path.resolve(root,'.'+decodeURIComponent(relative));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:1440,height:960},acceptDownloads:true});const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/hediye-tasarimi');await page.waitForSelector('html[data-ready="true"]');
  assert.equal(await page.locator('#layoutType option').count(),6);
  assert.equal(await page.locator('#fontFamily option').count(),8);
  for(const font of ['Luckiest Guy','Roboto','Open Sans','Lato','Poppins']){
    assert.equal(await page.evaluate(async name=>{await document.fonts.load('24px "'+name+'"');return document.fonts.check('24px "'+name+'"');},font),true);
  }
  await page.locator('#designName').fill('Minecraft Yayını');
  async function add(region,id,text){
    await page.locator(`[data-add="${region}"]`).click();
    await page.locator('#giftSearch').fill(id);
    await page.locator(`[data-gift="${id}"]`).click();
    if(text)await page.locator(`[data-zone="${region}"] [data-caption="0"]`).last().fill(text);
  }
  for(const [region,id,text] of [['top','5655','2X ZOMBİ'],['top','5319','5X ZOMBİ'],['top','5879','3X KORUYUCU'],['left','5658','FLASH BOMBASI'],['left','17473','SINIRSIZ MERMİ'],['right','8913','SİLAH YÜKSELT'],['right','5282','SİLAH DÜŞÜR']])await add(region,id,text);
  const first=page.locator('[data-zone="top"] .zone-item').first();await first.locator('[data-add-line]').click();await first.locator('[data-caption="1"]').fill('GÜL GÖNDER');
  await first.locator('[data-color="1"]').click();
  await page.locator('#lineColor').evaluate(input=>{input.value='#45d6c4';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('[data-close="colorsModal"]').click();
  await page.locator('#giftSize').fill('120');await page.locator('#giftSize').press('Tab');
  await page.locator('#saveBtn').click();await page.locator('#saveBtn').click();
  let records=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(records.length,1,'Editing must replace the same ID');assert.equal(records[0].items.length,7);
  assert.equal(records[0].items[0].lines[1].textColor,'#45d6c4');
  await page.locator('#designsBtn').click();await assert.rejects(()=>page.locator('#newBtn').click({timeout:500}),/Timeout/);
  await page.locator('[data-edit]').click();
  await first.locator('[data-move="1"]').click();await page.locator('#saveBtn').click();
  records=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);assert.equal(records[0].items[0].giftId,'5319');
  await page.reload();await page.waitForSelector('html[data-ready="true"]');
  await page.locator('#designsBtn').click();await page.locator('[data-edit]').click();
  assert.equal(await page.locator('#designName').inputValue(),'Minecraft Yayını');assert.equal(await page.locator('.zone-item').count(),7);
  await page.waitForFunction(()=>document.querySelector('#canvasSize').textContent.includes('1080'));
  await page.screenshot({path:path.join(output,'designer-1440.png'),fullPage:true});
  const pixelInfo=await page.locator('canvas').evaluate(canvas=>{const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let opaque=0,transparent=0;for(let i=3;i<data.length;i+=4){if(data[i])opaque++;else transparent++;}return{width:canvas.width,height:canvas.height,opaque,transparent};});
  assert.ok(pixelInfo.opaque>1000);assert.ok(pixelInfo.transparent>pixelInfo.opaque);
  for(const [layout,count] of [['top-only',1],['side-only',1],['both-sides',2],['double-side',2],['double-top',2],['classic',3]]){
    await page.locator('#layoutType').selectOption(layout);assert.equal(await page.locator('.zone').count(),count);
  }
  await page.locator('#layoutType').selectOption('double-top');await add('top-secondary','5303','SESLE ATEŞ');
  await page.locator('#grayscale').check();
  const downloadPromise=page.waitForEvent('download');await page.locator('#downloadBtn').click();const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),'Minecraft Yayını.png');const pngPath=path.join(output,download.suggestedFilename());await download.saveAs(pngPath);
  const png=fs.readFileSync(pngPath);assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');assert.ok(png.length>10000);
  await page.locator('#saveBtn').click();await page.locator('#layoutType').selectOption('classic');await page.locator('#saveBtn').click();
  records=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);assert.equal(records[0].items.length,8,'Inactive regions must not lose their gifts');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'designer-390.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal mobile overflow');
  await page.setViewportSize({width:1024,height:768});await page.screenshot({path:path.join(output,'designer-1024.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.setViewportSize({width:1440,height:960});
  await page.locator('#designsBtn').click();await page.locator('[data-delete]').click();await page.locator('#confirmCancel').click();
  assert.equal(await page.locator('.saved-item').count(),1);await page.locator('[data-delete]').click();await page.locator('#confirmAccept').click();assert.equal(await page.locator('.saved-item').count(),0);
  await page.locator('[data-close="designsModal"]').click();
  await page.evaluate(key=>{localStorage.removeItem(key);localStorage.setItem('mng-gift-designs-v605',JSON.stringify([{id:'legacy',name:'Eski kayıt',settings:{layoutType:'top',fontFamily:'Arial',textSize:24},items:[{uid:'old',region:'top',gift:{id:'5655',name:'Gül',coins:1},caption:'Eski satır'}]}]));},KEY);
  await page.reload();await page.waitForSelector('html[data-ready="true"]');await page.locator('#designsBtn').click();await page.locator('[data-edit]').click();assert.equal(await page.locator('[data-caption]').count(),3);assert.equal(await page.locator('[data-caption="2"]').inputValue(),'Eski satır');
  assert.ok(await page.evaluate(()=>localStorage.getItem('mng-gift-designs-v605')),'Original legacy records remain untouched');
  await page.evaluate(key=>{const records=Array.from({length:23},(_,i)=>({version:1,id:'qa-'+i,name:'Tasarım '+i,updatedAt:Date.now()+i,layout:'classic',settings:{},items:[]}));localStorage.setItem(key,JSON.stringify(records));},KEY);
  await page.locator('#designsBtn').click();assert.equal(await page.locator('.saved-item').count(),20);await page.locator('[data-page="1"]').click();assert.equal(await page.locator('.saved-item').count(),3);
  await page.locator('#savedSearch').fill('Tasarım 22');assert.equal(await page.locator('.saved-item').count(),1);
  await page.locator('#resetSearch').click();assert.equal(await page.locator('.saved-item').count(),20);
  await page.screenshot({path:path.join(output,'saved-designs.png')});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,root,layouts:6,fonts:8,gifts:7,multiline:true,perLineColors:true,stableSaveId:true,reload:true,transparentPNG:pixelInfo,mobileNoOverflow:true,legacyMigration:true,pagination:true,errors},null,2));
  console.log('Gift designer browser QA passed:',output);
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));});
