'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {chromium} = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = process.env.MNG_ORBIT_TEST_PUBLIC || path.resolve(__dirname, '../public'), key = 'mng_orbit_panel_visibility_v1';
const checks = [], panels = {gifts:'orbitSideSpecials', winners:'orbitWinnersPanel', ranking:'orbitRankingPanel', timer:'roundTimer'};
const server = http.createServer((req,res) => {
  const pathname = new URL(req.url,'http://localhost').pathname;
  if (pathname.startsWith('/api/')) {res.setHeader('Content-Type','application/json');res.end('[]');return;}
  const file = path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if (!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404);res.end();return;}
  const ext = path.extname(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg','.mp4':'video/mp4'})[ext]||'text/html');fs.createReadStream(file).pipe(res);
});
function check(label,condition) {assert.ok(condition,label);checks.push(label);}
(async () => {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:720}}), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;window.WebSocket=class{static OPEN=1;readyState=0;addEventListener(){}send(){}close(){}};});
    const url = `http://127.0.0.1:${server.address().port}/`;
    await page.goto(url);await page.evaluate(()=>start());await page.waitForTimeout(500);
    for (const id of Object.values(panels)) check('initially visible: '+id,await page.locator('#'+id).isVisible());
    await page.locator('#panelVisibilityButton').click();
    for (const [name,id] of Object.entries(panels)) {
      await page.locator(`[data-orbit-panel="${name}"]`).uncheck();
      check('can hide '+name,!(await page.locator('#'+id).isVisible()));
    }
    check('control remains reachable with every panel hidden',await page.locator('#panelVisibilityButton').isVisible());
    const gameResult = await page.evaluate(()=>{
      reset();settings.minPlayersToConsume=2;settings.protectionSeconds=0;
      for(let i=0;i<2;i++){const p=player({id:'visibility-'+i,nickname:'Test '+i},'follow');p.x=500+i*1200;p.y=500;}
      const mass=world.players.get('visibility-0').mass;growth(world.players.get('visibility-0'),200);
      for(let i=0;i<30;i++)update(.05);return {started:combatGate.started,players:world.players.size,grew:world.players.get('visibility-0').mass>mass};
    });
    check('hiding UI does not stop gameplay or growth',gameResult.started&&gameResult.players===2&&gameResult.grew);
    await page.reload();await page.evaluate(()=>start());await page.waitForTimeout(500);
    for (const id of Object.values(panels)) check('hidden state survives reload: '+id,!(await page.locator('#'+id).isVisible()));
    await page.locator('#panelVisibilityButton').click();
    for (const [name,id] of Object.entries(panels)) {await page.locator(`[data-orbit-panel="${name}"]`).check();check('can reopen '+name,await page.locator('#'+id).isVisible());}
    await page.keyboard.press('Escape');
    check('Escape closes menu and returns focus',await page.locator('#panelVisibilityButton').evaluate(e=>e===document.activeElement&&e.getAttribute('aria-expanded')==='false'));
    for (const [width,height] of [[800,600],[1280,720],[1920,1080]]) {
      await page.setViewportSize({width,height});await page.locator('#panelVisibilityButton').click();
      await page.evaluate(()=>{for(let i=0;i<5;i++){const p=player({id:'visible-'+i,nickname:'Test '+i},'follow');p.x=world.width/2+(i-2)*250;p.y=world.height/2;}draw();});
      check('game canvas is rendered at '+width,await page.evaluate(()=>ctx.getImageData(0,0,innerWidth,innerHeight).data.some((v,i)=>i%4===3&&v>0)));
      for(const id of ['panelVisibilityButton','panelVisibilityMenu']) {const b=await page.locator('#'+id).boundingBox();check(id+' fits '+width,b.x>=0&&b.y>=0&&b.x+b.width<=width&&b.y+b.height<=height);}
      await page.screenshot({path:path.join(__dirname,`panel-visibility-${width}.png`)});await page.keyboard.press('Escape');
    }
    await page.evaluate(k=>localStorage.setItem(k,'bad-json'),key);await page.reload();await page.evaluate(()=>start());
    check('invalid storage restores visible defaults',await page.locator('#orbitSideSpecials').isVisible());
    await page.evaluate(k=>localStorage.setItem(k,JSON.stringify({gifts:'false',winners:false,ranking:true,arbitrary:false})),key);
    await page.reload();await page.evaluate(()=>start());
    check('only recognised boolean preferences apply',await page.locator('#orbitSideSpecials').isVisible()&&!(await page.locator('#orbitWinnersPanel').isVisible()));
    // Exercise the display controller independently: legacy game startup assumes available storage.
    await page.evaluate(()=>{
      Storage.prototype.getItem=()=>{throw new Error('blocked')};Storage.prototype.setItem=()=>{throw new Error('blocked')};
      for(const id of ['panelVisibilityButton','panelVisibilityMenu'])document.getElementById(id).replaceWith(document.getElementById(id).cloneNode(true));
    });
    await page.addScriptTag({path:path.join(root,'panel-visibility.js')});
    await page.locator('#panelVisibilityButton').click();await page.locator('[data-orbit-panel="gifts"]').uncheck();
    check('display controls tolerate denied storage',!(await page.locator('#orbitSideSpecials').isVisible()));
    check('no browser exceptions',errors.length===0);
    fs.writeFileSync(path.join(__dirname,'panel-visibility-result.json'),JSON.stringify({passed:true,testedRoot:root,checks},null,2));
    console.log(JSON.stringify({passed:true,checks:checks.length}));
  } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
