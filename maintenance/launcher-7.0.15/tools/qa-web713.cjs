'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const web=path.resolve('D:/TikMnG-Release-7.0.0-source/web'),out=path.resolve(__dirname,'../qa/713');let server,browser;
async function main(){
 server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');if(u.pathname==='/api/version'){res.setHeader('Content-Type','application/json');res.end('{"latestVersion":"7.0.12"}');return;}const p=path.resolve(web,'.'+(u.pathname==='/'?'/index.html':u.pathname==='/hediye-tasarimi'?'/gift-designer.html':u.pathname));if(!p.startsWith(web+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404);res.end();return;}const ext=path.extname(p);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream');res.end(fs.readFileSync(p));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 for(const size of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(size);await page.goto(origin);await page.locator('.catalog-features').first().waitFor();
  assert.equal(await page.locator('#sim,#heroCanvas,a[href="#sim"]').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#games').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'web-games-'+size.width+'.png')});
  await page.locator('.catalog-open').first().click();await page.locator('#portalDetail[open]').waitFor();assert.ok(await page.locator('.game-dialog-content li').count()>2);await page.getByRole('button',{name:'Kapat',exact:true}).first().click();
 }
 await page.goto(origin+'/hediye-tasarimi');await page.waitForFunction(()=>!!window.TikMNGGiftDesign);
 const result=await page.evaluate(()=>{const M=TikMNGGiftDesign,s=M.normalizeDesign({layout:'top-only',items:[{uid:'one',region:'top',giftId:'5655',lines:[{text:'Test'}]}]});return M.layoutDesign(s);});
 assert.equal(result.items[0].x,0);assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,demosRemoved:true,desktopAndMobile:true,detailsDialog:true,topGiftStartsAtZero:true,errors}));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}});
