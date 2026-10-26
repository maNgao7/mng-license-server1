'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../web');
const out = process.env.MNG_WEBSITE_QA || 'D:/TikMnG-QA-Delivery/7.0.0/website';
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'game-catalog.json'), 'utf8'));
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const route = {'/':'/index.html','/hediye-tasarimi':'/gift-designer.html','/widgetlar':'/widgets.html'}[url.pathname] || url.pathname;
    const file = path.resolve(root, '.' + decodeURIComponent(route));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf'})[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control','no-store');
    fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(400); res.end(); }
});
async function main() {
  const serve = process.argv.includes('--serve');
  await new Promise((resolve, reject) => { server.once('error',reject); server.listen(serve ? Number(process.env.PORT || 4198) : 0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  if (serve) { console.log(origin); return; }
  const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  let browser;
  try {
    fs.mkdirSync(out, {recursive:true});
    browser = await chromium.launch({headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const page = await browser.newPage({viewport:{width:1440,height:960}, reducedMotion:'reduce'});
    const errors = [];
    page.on('pageerror',error => errors.push(error.message));
    await page.route('**/api/version',route => route.fulfill({json:{latestVersion:'7.0.2'}}));
    await page.goto(origin, {waitUntil:'networkidle'});
    await page.waitForSelector('.portal-news-button');
    assert.equal(await page.locator('.catalog-card').count(), 16);
    assert.equal(await page.locator('#games').count(), 1);
    assert.deepEqual(await page.locator('[data-game]').evaluateAll(nodes => nodes.map(node => node.dataset.game)),catalog.games.map(game => game.id));
    assert.equal(await page.locator('#adminEntry').getAttribute('href'),'/admin/');
    assert.equal(await page.locator('#adminEntry').isVisible(),true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
    const covers = await page.locator('.catalog-art img').evaluateAll(async images => { for(const img of images) { img.loading='eager'; await img.decode(); } return images.map(img => ({width:img.naturalWidth,height:img.naturalHeight,src:img.currentSrc})); });
    assert.ok(covers.every(img => img.width >= 300 && img.height > 100),JSON.stringify(covers));
    await page.screenshot({path:path.join(out,'home-1440.png')});
    await page.locator('#games').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(out,'catalog-1440.png')});
    for (const game of catalog.games) {
      await page.locator(`.catalog-card [data-game-open="${game.id}"]`).click();
      assert.equal(await page.locator('#portalDialogTitle').innerText(),game.title);
      assert.equal(await page.locator('#portalDetail .game-dialog-content>ul li').count(),game.features.length);
      assert.equal(await page.locator('#portalDetail .game-setup-notes li').count(),4);
      assert.equal(await page.locator('#portalDetail .game-dialog-requirement').innerText(),game.requirements);
      const details = await page.locator('#portalDetail').evaluate(node => ({height:node.scrollHeight,visible:node.clientHeight}));
      assert.ok(details.height > 0);
      if (game.id === 'caahr') await page.screenshot({path:path.join(out,'game-detail-1440.png')});
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#portalDetail').open);
      assert.equal(await page.locator(`.catalog-card [data-game-open="${game.id}"]`).evaluate(node => node === document.activeElement), true);
    }
    await page.locator('[data-filter="Minecraft"]').click();
    assert.equal(await page.locator('.catalog-card:visible').count(),4);
    await page.locator('#gameSearch').fill('kARTOPU');
    assert.equal(await page.locator('.catalog-card:visible').count(),1);
    await page.locator('#gameSearch').fill('bulunmayan-oyun-123');
    assert.equal(await page.locator('#catalogEmpty').isVisible(),true);
    await page.locator('#clearGameFilters').click();
    assert.equal(await page.locator('.catalog-card:visible').count(),16);
    await page.locator('#gameSearch').fill('surus');
    assert.equal(await page.locator('.catalog-card:visible').count(),1);
    await page.locator('#gameSearch').fill('');
    await page.locator('.portal-news-button').click();
    assert.equal(await page.locator('[data-news-game]').count(),16);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#portalDetail').evaluate(node => node.contains(document.activeElement)),true);
    await page.locator('[data-news-game="caahr"]').click();
    assert.equal(await page.locator('#portalDialogTitle').innerText(),'Sesli Sürüş');
    await page.keyboard.press('Escape');
    await page.locator('.hero-cta-group .btn-tiktok').click();
    assert.equal(await page.locator('#downloadVersion').innerText(),'7.0.2');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.download-stage').isVisible(),false);
    const sizes = [];
    for (const [width,height] of [[1920,1080],[1310,900],[1024,768],[768,1024],[390,844],[360,780]]) {
      await page.setViewportSize({width,height});
      await page.evaluate(() => scrollTo(0,0));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true,`No overflow at ${width}`);
      assert.equal(await page.locator('#adminEntry').isVisible(),true);
      const header = await page.locator('.nav-wrapper').evaluate(node => ({width:node.scrollWidth,visible:node.clientWidth}));
      assert.ok(header.width <= header.visible + 1,`Header fits at ${width}: ${JSON.stringify(header)}`);
      const heroBottom = await page.locator('.hero').evaluate(node => node.getBoundingClientRect().bottom);
      assert.ok(heroBottom < height,`Next band visible at ${width}`);
      await page.screenshot({path:path.join(out,`home-${width}.png`)});
      await page.locator('#games').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(out,`catalog-${width}.png`)});
      for (const game of catalog.games) {
        await page.locator(`.catalog-card [data-game-open="${game.id}"]`).click();
        await page.locator('.game-dialog-art').evaluate(image => image.decode());
        assert.equal(await page.locator('#portalDialogTitle').innerText(),game.title);
        assert.equal(await page.locator('#portalDetail .game-setup-notes li').count(),4);
        assert.equal(await page.locator('#portalDetail').evaluate(node => node.scrollWidth <= node.clientWidth + 1),true,`${game.id} detail fits at ${width}`);
        assert.equal(await page.locator('.game-setup-notes').evaluate(node => node.scrollWidth <= node.clientWidth + 1),true,`${game.id} notes fit at ${width}`);
        if(game.id==='caahr')await page.screenshot({path:path.join(out,`game-detail-${width}.png`)});
        await page.keyboard.press('Escape');
      }
      sizes.push({width,height,heroBottom,header});
    }
    await page.locator('[data-game-open="caahr"]').click();
    await page.screenshot({path:path.join(out,'game-detail-360.png')});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
    await page.keyboard.press('Escape');
    await page.locator('#portalMenu').click();
    assert.equal(await page.locator('#primaryNavigation').isVisible(),true);
    await page.locator('#primaryNavigation a[href="/hediye-tasarimi"]').click();
    await page.waitForSelector('html[data-ready="true"]');
    assert.equal(await page.locator('#layoutType option').count(),6);
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,games:16,coverDecodes:covers.length,gameDetailDialogs:16*(1+sizes.length),setupNotesPerGame:4,initialViewport:{width:1440,height:960},filterSearch:true,notifications:16,designerReachable:true,adminVisible:true,sizes,errors},null,2));
    console.log(`Website QA passed: ${out}`);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => {console.error(error); process.exitCode = 1; if(server.listening)server.close();});
