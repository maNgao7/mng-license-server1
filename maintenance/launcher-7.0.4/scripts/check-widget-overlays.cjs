const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = path.resolve(__dirname,'../renderer/widgets');
const server = http.createServer((req,res)=>{
 const url = new URL(req.url,'http://localhost');
 if(url.pathname==='/api/widget/state'){res.setHeader('Content-Type','application/json');res.end('{}');return}
 const relative = url.pathname.replace(/^\/widget\//,'');
 const file = path.resolve(base,relative);
 if(!file.startsWith(base+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:600,height:440}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const root=`http://127.0.0.1:${server.address().port}`;
 for(const type of ['topgift','coinjar','topliker','topgifter','carousel','coindrop','timer','streambuddies','likefountain','userinfo','wheel','viewercount','tinydiny']){
  await page.goto(root+`/widget/overlay.html?preview=1&type=${type}`);
  await page.waitForTimeout(type==='coinjar'?2400:300);
  if(!await page.locator('#stage').textContent()&&!await page.locator('#stage canvas').count())throw Error(type+' blank');
  if(type==='topgift'&&await page.locator('.flip-surface').count()!==1)throw Error('Duplicate flip faces');
  if(type==='timer') {await page.waitForTimeout(1200);const text=await page.locator('#clock').textContent();if(!/^00:00:0[1-9]$/.test(text))throw Error('Timer not counting up: '+text)}
  if(['topgift','coinjar','streambuddies','topliker','topgifter'].includes(type))await page.screenshot({path:path.resolve(__dirname,`../../release-v6.5.9/widget-${type}.png`)});
  console.log('OK '+type);
 }
 await browser.close();server.close();if(errors.length)throw Error(errors.join('\n'));
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
