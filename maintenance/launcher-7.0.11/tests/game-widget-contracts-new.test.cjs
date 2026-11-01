const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const root = process.env.MNG_GAME_SOURCE_ROOT||path.resolve(__dirname, '../..');
const runtime = process.env.GAME_WIDGET_NODE_MODULES || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { chromium } = require(path.join(runtime, 'playwright'));
const WebSocket = createRequire(path.join(root, 'launcher/package.json'))('ws');
const png = fs.readFileSync(path.join(root, 'apps/tiktok-vs/public/assets/gift-images/Rose.png'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const p = s.address().port; await new Promise(r => s.close(r)); return p; }

test('widget socket URLs preserve the serving origin and HTTPS scheme', async t => {
  for (const file of ['mng-orbit/public/widget.js', 'mng-orbit/public/winner-widget.html', 'battle-game/public/army-widget.html', 'battle-game/public/tournament-widget.html']) {
    await t.test(file, () => {
      const source = fs.readFileSync(path.join(root, 'apps', file), 'utf8');
      const match = file.startsWith('mng-orbit') ? source.match(/const host =[^;]+;\s*const wsUrl =[^;]+;/)[0] + 'capture(wsUrl)' : source.match(/function connect\(\)\{const ws=new WebSocket\([^;]+;/)[0] + '}connect()';
      let actual;
      vm.runInNewContext(match, { location: { host: 'widgets.example', protocol: 'https:' }, capture: x => actual = x, WebSocket: function(x) { actual = x; } });
      assert.equal(actual, 'wss://widgets.example');
    });
  }
});

test('real game servers deliver synthetic widget contracts without external requests', { timeout: 120000 }, async t => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-game-widgets-'));
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  t.after(async () => { await browser.close(); fs.rmSync(sandbox, { recursive: true, force: true }); });
  fs.symlinkSync(path.join(root,'apps/node_modules'),path.join(sandbox,'node_modules'),'junction');
  const sentinel = '<img src=//leak.x>';
  const avatar = '/_contract-source.png';
  const games = [
    { id: 'mng-orbit', pages: ['/widget.html', '/winner-widget.html'], messages: [{ type:'leaderboard', entries:[{id:'synthetic',nickname:'Synthetic Orbit',mass:42,avatar}] }, {type:'winner',winner:{id:'synthetic',nickname:'Synthetic Orbit',count:2,avatar}}], text:'Synthetic Orbit', selector:'#leaderboard, #winners-list, #list' },
    { id:'crowd-control', pages:['/widget.html'], messages:[{type:'killer',killer:{id:'synthetic',nickname:'Synthetic Crowd',kills:3,avatar}}], text:'Synthetic Crowd' },
    { id:'battle-game', pages:['/army-widget.html','/tournament-widget.html'], messages:[{type:'army-leaderboard',entries:[{name:'Synthetic Battle',soldiers:12,avatar}]},{type:'tournament-win',player:{id:'synthetic',name:'Synthetic Battle',avatar}}], text:'Synthetic Battle' },
    { id:'duck-hunt', pages:['/widget.html?mode=victims','/widget.html?mode=survivors'], messages:[{type:'update-leaderboard',victims:[{nickname:'Synthetic Duck',deathCount:3,avatar}],survivors:[{nickname:'Synthetic Duck',escapeCount:5,avatar}]}], text:'Synthetic Duck' },
    { id:'penalty-kick', pages:['/widget','/widget.html','/widget-keepers','/widget-teams'], messages:[{type:'update-leaderboard',goalkeepers:[{username:'Synthetic Keeper',saves:7,avatar}],teams:{turkiye:9}}], text:'Synthetic Keeper' },
    { id:'tightrope-balance', pages:['/widget.html?side=left','/widget.html?side=right','/widget.html?mode=top'], messages:[{type:'sync_leaderboard',data:{left:[['Synthetic Rope',{nickname:'Synthetic Rope',totalKg:4,lastGift:'Rose',avatar}]],right:[['Synthetic Rope',{nickname:'Synthetic Rope',totalKg:6,lastGift:'Rose',avatar}]],leftTotal:4,rightTotal:6}}], text:'Synthetic Rope' },
    { id:'tiktok-vs', pages:['/widget.html','/widget-vs.html','/widget-vs-winners.html','/widget-top-gift.html','/widget-top-likes.html','/widget-leaderboard.html'], messages:[{type:'battle-score',side:'left',value:17}], text:'17' },
    { id:'pony-life', pages:['/widget.html?mode=ranking','/widget.html?mode=winners'], text:'synthetic_pony' }
  ];
  for (const game of games) await t.test(game.id, async t => {
    const directory = path.join(sandbox, game.id); fs.mkdirSync(path.join(directory,'public'), {recursive:true});
    fs.copyFileSync(path.join(root,'apps',game.id,'package.json'),path.join(directory,'package.json'));
    fs.symlinkSync(path.join(root,'apps',game.id,'node_modules'),path.join(directory,'node_modules'),'junction');
    for (const entry of fs.readdirSync(path.join(root,'apps',game.id),{withFileTypes:true})) {
      if (entry.isFile() && /\.(?:js|cjs)$/.test(entry.name)) fs.copyFileSync(path.join(root,'apps',game.id,entry.name),path.join(directory,entry.name));
      if (entry.isDirectory() && ['server','shared','lib','src'].includes(entry.name)) fs.cpSync(path.join(root,'apps',game.id,entry.name),path.join(directory,entry.name),{recursive:true,filter:p=>!p.includes('node_modules')});
    }
    for (const file of fs.readdirSync(path.join(root,'apps',game.id,'public'))) if (/widget.*\.(html|js|css)$/.test(file)) fs.copyFileSync(path.join(root,'apps',game.id,'public',file),path.join(directory,'public',file));
    fs.writeFileSync(path.join(directory,'public/_contract-source.png'),png);
    const port = await freePort(), widgetPort = game.id === 'pony-life' ? await freePort() : port;
    // The copied sources cannot read real avatar caches/keys or contact any live service.
    const guard = path.join(directory,'contract-guard.cjs');
    fs.writeFileSync(guard, `const fs=require('node:fs'),net=require('node:net');const originalRead=fs.readFileSync;fs.readFileSync=function(p,...a){if(/avatar.cache|euler.api.key/i.test(String(p)))throw new Error('Private fixture read blocked');return originalRead.call(this,p,...a)};global.fetch=async()=>{throw new Error('External fetch blocked')};net.Socket.prototype.connect=function(...a){const x=typeof a[0]==='object'?a[0]:{port:a[0],host:a[1]};if(!['127.0.0.1','localhost','::1'].includes(x.host)||![${port},${widgetPort}].includes(Number(x.port)))throw new Error('External socket blocked');throw new Error('Unexpected server outbound socket')};`);
    const child = spawn(process.execPath,['--require',guard,game.id==='pony-life'?'server/index.js':'server.js'],{cwd:directory,windowsHide:true,env:{...process.env,PORT:String(port),PONY_PORT:String(port),PONY_WIDGET_PORT:String(widgetPort),PONY_STATE_FILE:path.join(directory,'data/state.json'),APPDATA:directory,USERPROFILE:directory,MNG_BACKGROUNDS_DIR:directory,MNG_WIDGET_PORT:String(port),MNG_WIDGET_ACCESS_KEY:'synthetic-only'}});
    let logs=''; child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
    t.after(async()=>{child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));});
    const origin = `http://127.0.0.1:${widgetPort}`;
    let ready=false;for(let i=0;i<100;i++){try{await fetch(origin+game.pages[0]);ready=true;break;}catch{}if(child.exitCode!==null)break;await pause(50);}assert.ok(ready,logs);
    let ws;
    if(game.id==='pony-life'){
      const session=await (await fetch(`http://127.0.0.1:${port}/api/session`)).json();
      ws=new WebSocket(`ws://127.0.0.1:${port}/live`,{origin:`http://127.0.0.1:${port}`});await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j)});ws.send(JSON.stringify({token:session.token}));await pause(30);ws.send(JSON.stringify({type:'test-gift',username:'synthetic_pony',count:5}));
    }else{ws=new WebSocket(`ws://127.0.0.1:${port}`);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j)});}
    const messages=[];ws.on('message',b=>{try{messages.push(JSON.parse(b))}catch{}});t.after(()=>ws.terminate());
    for(const m of game.messages||[])ws.send(JSON.stringify(m));await pause(80);
    const context=await browser.newContext();t.after(()=>context.close());const escaped=[];
    await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin){if(!['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname))escaped.push(url.href);return route.abort();}return route.continue();});
    for(const route of game.pages)await t.test(route,async()=>{
      const page=await context.newPage();await page.goto(origin+route);
      await page.waitForTimeout(200);
      if(game.id==='pony-life'&&route.includes('ranking'))await page.getByText('@synthetic_pony',{exact:true}).waitFor();
      if(['mng-orbit','crowd-control','battle-game','duck-hunt','tightrope-balance'].includes(game.id))await page.getByText(new RegExp(game.text)).filter({visible:true}).first().waitFor({timeout:3000});
      if(game.id==='penalty-kick'&&!route.includes('teams'))await page.getByText('@Synthetic Keeper',{exact:true}).waitFor({timeout:3000});
      const decoded=await page.evaluate(async()=>{const image=new Image();image.src='/_contract-source.png';await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d');x.drawImage(image,0,0);return {width:image.naturalWidth,height:image.naturalHeight,ink:x.getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)};});assert.ok(decoded.width>0&&decoded.height>0&&decoded.ink);
      await page.close();
    });
    await t.test('payload and reset/privacy regression',async()=>{
      const page=await context.newPage();await page.goto(origin+game.pages[0]);await page.waitForTimeout(150);
      if(game.id==='duck-hunt'){ws.send(JSON.stringify({type:'update-leaderboard',victims:[],survivors:[]}));await page.waitForTimeout(100);assert.equal(await page.locator('.rank-item').count(),0);}
      if(game.id==='crowd-control'){ws.send(JSON.stringify({type:'killer',killer:{id:'unsafe',nickname:sentinel,kills:1,avatar}}));}
      if(game.id==='battle-game'){ws.send(JSON.stringify({type:'army-leaderboard',entries:[{name:'safe',avatar:'/missing" onerror="window.contractInjected=1',soldiers:1}]}));}
      if(game.id==='duck-hunt'){ws.send(JSON.stringify({type:'update-leaderboard',victims:[{nickname:sentinel,deathCount:1,avatar}]}));}
      if(game.id==='penalty-kick'){ws.send(JSON.stringify({type:'update-leaderboard',goalkeepers:[{username:sentinel,saves:1,avatar}],teams:{turkiye:9}}));}
      if(game.id==='tightrope-balance'){ws.send(JSON.stringify({type:'sync_leaderboard',data:{left:[['safe',{nickname:'safe',avatar:'/missing" onerror="window.contractInjected=1',totalKg:1}]],right:[],leftTotal:1,rightTotal:0}}));}
      if(game.id==='pony-life'){const state=await(await fetch(origin+'/api/widget-state')).json();assert.ok(Array.isArray(state.players)&&Array.isArray(state.wins));assert.equal(state.settings.trackLength>0,true);for(const key of ['audience','live','token','widgetUrl','tunnelMessage'])assert.equal(key in state,false,key+' must stay private');assert.deepEqual(Object.keys(state.settings),['trackLength']);assert.equal((await fetch(origin+'/api/session')).status,404);}
      await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.contractInjected||0),0);assert.deepEqual(escaped,[]);await page.close();
      if(game.messages)assert.ok(messages.some(m=>['leaderboard','winner','killers','army-leaderboard','tournament-winners','sync-leaderboard','sync_leaderboard','battleState'].includes(m.type)),'Expected gameplay JSON was received');
    });
  });
});
