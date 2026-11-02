const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.join(__dirname,'public');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end('[]');return;}
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
 fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.requestAnimationFrame=()=>0;
  window.WebSocket=class {static OPEN=1;readyState=0;addEventListener(){}send(){}close(){}};
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.waitForFunction(()=>typeof update==='function');
 const result=await page.evaluate(()=>{
  start();reset();settings.minPlayersToConsume=5;settings.protectionSeconds=0;
  for(let i=0;i<4;i++){const p=player({id:'qa-'+i,nickname:'Test '+i},'follow');p.x=500+i*700;p.y=600;}
  const before=[...world.players.values()].map(p=>[p.x,p.y]);
  const first=world.players.get('qa-0'),oldMass=first.mass;
  growth(first,250);
  for(let i=0;i<200;i++)update(.05);
  const waitingStable=JSON.stringify(before)===JSON.stringify([...world.players.values()].map(p=>[p.x,p.y]));
  const waitingGrowth=first.mass>oldMass,waitingTimer=byId('roundTimer').querySelector('b').textContent;
  const fifth=player({id:'qa-4',nickname:'Test 4'},'follow');fifth.x=3500;fifth.y=600;
  update(.05);const began=combatGate.started;
  const moved=JSON.stringify(before)!==JSON.stringify([...world.players.values()].slice(0,4).map(p=>[p.x,p.y]));
  for(const p of [...world.players.values()].slice(2))world.players.delete(p.id);
  first.mass=1000;first.x=1000;first.y=1000;first.spawnProtectedUntil=0;first.vx=first.vy=0;
  const second=world.players.get('qa-1');second.mass=100;second.x=1050;second.y=1000;second.spawnProtectedUntil=0;second.vx=second.vy=0;
  update(.001);const finalTwoConsumed=world.players.size===1&&swallows.length===1;
  reset();settings.minPlayersToConsume=2;
  for(let i=0;i<2;i++){const p=player({id:'equal-'+i,nickname:'Equal '+i},'follow');p.mass=250;p.x=1000+i*150;p.y=1000;p.spawnProtectedUntil=0;}
  update(.001);const equalSplit=[...world.players.values()].every(p=>p.split);
  reset();settings.minPlayersToConsume=7;renderGameSettings();saveGameSettings();
  const saved=JSON.parse(localStorage.getItem('mng_orbit_game_settings'));
  settings.minPlayersToConsume=5;loadGameSettings();
  return {waitingStable,waitingGrowth,waitingTimer,began,moved,finalTwoConsumed,equalSplit,
   savedThreshold:saved.minPlayersToConsume,reloadedThreshold:settings.minPlayersToConsume,resetWaits:!combatGate.started};
 });
 assert.deepEqual(result,{waitingStable:true,waitingGrowth:true,waitingTimer:'05:00',began:true,moved:true,finalTwoConsumed:true,equalSplit:true,savedThreshold:7,reloadedThreshold:7,resetWaits:true});
 assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(__dirname,'orbit-round-verified.png')});
 console.log('ORBIT_ROUND_INTEGRATION',JSON.stringify(result));
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
