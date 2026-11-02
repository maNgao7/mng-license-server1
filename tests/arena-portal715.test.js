import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const root=path.resolve(import.meta.dirname,'..');
test('Arena public catalog keeps existing layout, free demo and original downloadable gift guide', {skip:!process.env.PLAYWRIGHT_MODULE},async t=>{
  const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE);
  const data=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-arena-portal715-'));
  const output=path.resolve(process.env.MNG_ARENA_PORTAL_QA_OUTPUT||path.join(root,'qa/arena-portal715'));fs.mkdirSync(output,{recursive:true});
  const port=await new Promise(resolve=>{const probe=net.createServer().listen(0,'127.0.0.1',()=>{const port=probe.address().port;probe.close(()=>resolve(port));});});
  const child=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,HOST:'127.0.0.1',PORT:String(port),MNG_DATA_DIR:data,
    ADMIN_SIFRE:crypto.randomBytes(24).toString('hex'),GITHUB_TOKEN:'',GITHUB_LICENSE_TOKEN:'',GITHUB_LICENSE_REPO:'',BACKUP_REPO:''}});
  let browser;
  t.after(async()=>{
    await browser?.close();
    if(child.exitCode===null&&child.signalCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill();});
    assert.ok(path.resolve(data).startsWith(path.join(os.tmpdir(),'tikmng-arena-portal715-')));
    fs.rmSync(data,{recursive:true,force:true});
  });
  const base=`http://127.0.0.1:${port}`;
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,50));}
  assert.ok(ready);
  browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const size of [{width:1440,height:1000},{width:390,height:844}]){
    await page.setViewportSize(size);await page.goto(base+'/',{waitUntil:'networkidle'});
    const card=page.locator('[data-game="yaratik-arena"]');await card.scrollIntoViewIfNeeded();
    assert.equal(await card.count(),1);assert.ok(await card.locator('img').evaluate(image=>image.complete&&image.naturalWidth>0));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await page.screenshot({path:path.join(output,`catalog-${size.width}.png`)});
    await card.getByRole('button').click();
    const dialog=page.locator('#portalDetail');await dialog.waitFor({state:'visible'});
    assert.equal(await dialog.getByRole('link',{name:"Steam'den ücretsiz demoyu indir"}).getAttribute('href'),'https://store.steampowered.com/app/5364590/');
    assert.equal(await dialog.getByRole('link',{name:'Hediye görselini indir'}).getAttribute('href'),'/gift-guides/yaratik-arena.png');
    assert.ok(await dialog.locator('.game-dialog-art').evaluate(image=>image.complete&&image.naturalWidth>0));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await page.screenshot({path:path.join(output,`detail-${size.width}.png`)});
  }
  assert.deepEqual(errors,[]);
  const guide=Buffer.from(await(await fetch(base+'/gift-guides/yaratik-arena.png')).arrayBuffer());
  assert.deepEqual(guide,fs.readFileSync('D:/TikMnG-CanEmAll-Prototype/assets/publishing/yaratik-arena-gifts.png'));
});
