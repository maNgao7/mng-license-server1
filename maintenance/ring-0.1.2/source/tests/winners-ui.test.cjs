'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

if (!process.versions.electron) {
  require('node:test')('narrow winners fit long names and counts; HUD minimizes and restores', () => {
    const electron = process.env.HEDIYE_BOX_TEST_ELECTRON || path.resolve(__dirname, '../../../frog-river/node_modules/electron/dist/electron.exe');
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const result = require('node:child_process').spawnSync(electron, [__filename], { env, windowsHide:true, encoding:'utf8', timeout:30000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    console.log(result.stdout.trim());
  });
} else {
  const { app, BrowserWindow } = require('electron');
  const http = require('node:http');
  const root = path.resolve(__dirname, '..');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'box-winners-ui-'));
  app.setPath('userData', profile);
  app.on('window-all-closed', () => {});
  const names = ['@uzun_kullanici_adi_istanbul_2026', 'Çağrı Şentürk Uzun İsimli Şampiyon', 'Şule', '@' + 'uzun'.repeat(16), 'Deniz'];
  const standings = names.map((label, i) => ({ label, wins:[999, 42, 12, 3, 1][i] }));
  const state = { live:{status:'idle'}, gameOptions:{showStandings:true, standingsScale:100, effectsVolume:0},
    spectator:{phase:'waiting', panelOpen:false, lineup:[false,false], health:[1,1]},
    audience:{active:{},queue:[],settings:{}}, standings };
  const preload = path.join(profile, 'fixture.cjs');
  fs.writeFileSync(preload, `const state=${JSON.stringify(state)};
    let notify=()=>{};
    window.winnersFixture={state,push:()=>notify(state)};
    window.hediyeBox={getState:async()=>state,getGiftCatalog:async()=>[],onState:fn=>(notify=fn,()=>{}),
      configureGameOptions:async patch=>{Object.assign(state.gameOptions,patch);return {ok:true};}};`);
  let hud, widget, server;
  const errors = [];
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function until(view, expression) {
    for (let i=0;i<100;i++) {
      if (await view.webContents.executeJavaScript(expression)) return;
      await delay(30);
    }
    throw Error('UI did not settle: ' + expression);
  }
  function windowFor(options={}) {
    const view = new BrowserWindow({show:false,width:1280,height:720,useContentSize:true,
      webPreferences:{contextIsolation:false,nodeIntegration:false,sandbox:false,backgroundThrottling:false,...options}});
    view.webContents.on('console-message', (_event, level, message) => { if(level===3 && !message.includes('Failed to load resource')) errors.push(message); });
    return view;
  }
  async function geometry(view, selector, nameSelector, countSelector) {
    return view.webContents.executeJavaScript(`(()=>{
      const nodes=[...document.querySelectorAll(${JSON.stringify(selector)})];
      return nodes.map(n=>{const label=n.querySelector(${JSON.stringify(nameSelector)}),count=n.querySelector(${JSON.stringify(countSelector)});
        const a=label.getBoundingClientRect(),b=count.getBoundingClientRect(),r=n.getBoundingClientRect(),css=getComputedStyle(label);
        return {name:label.textContent,count:count.textContent,x:r.x,y:r.y,bottom:r.bottom,
          fits:label.scrollWidth<=label.clientWidth+1&&count.scrollWidth<=count.clientWidth+1,
          alongside:b.left>=a.right-1&&Math.abs(a.top-b.top)<2,
          wrapped:css.whiteSpace==='normal',font:parseFloat(css.fontSize),right:b.right};});})()`);
  }
  function checkRows(rows) {
    assert.equal(rows.length, names.length);
    rows.forEach((row,i) => {
      assert.equal(row.name,names[i]);
      assert.equal(row.count,'×'+standings[i].wins);
      assert.ok(row.fits && row.alongside && row.wrapped && row.font>=18,JSON.stringify(row));
      if(i) {assert.equal(row.x,rows[0].x);assert.ok(row.y>=rows[i-1].bottom-1);}
    });
  }
  async function run() {
    await app.whenReady();
    hud=windowFor({preload});
    await hud.loadFile(path.join(root,'spectator/index.html'));
    await until(hud,"document.querySelectorAll('#standings-list li').length===5 && !document.querySelector('#standings').hidden");
    for(const [width,height] of [[1280,720],[640,480]]) {
      hud.setContentSize(width,height);
      for(const scale of [60,100,140]) {
        await hud.webContents.executeJavaScript(`winnersFixture.state.gameOptions.standingsScale=${scale};winnersFixture.push()`);
        await delay(35);
        checkRows(await geometry(hud,'#standings-list li','span','b'));
        assert.ok(await hud.webContents.executeJavaScript("(()=>{const r=document.querySelector('#standings').getBoundingClientRect();return r.right<=innerWidth&&r.bottom<=innerHeight;})()"),'scaled HUD stays in viewport');
      }
    }
    await hud.webContents.executeJavaScript("document.querySelector('#standings-minimize').click()");
    await until(hud,"document.querySelector('#standings-minimize').getAttribute('aria-expanded')==='false'");
    assert.equal(await hud.webContents.executeJavaScript("document.querySelector('#standings-list').getBoundingClientRect().height"),0);
    await hud.webContents.executeJavaScript("document.querySelector('#standings-minimize').click()");
    await until(hud,"document.querySelector('#standings-minimize').getAttribute('aria-expanded')==='true'");
    assert.ok(await hud.webContents.executeJavaScript("(()=>{const list=document.querySelector('#standings-list');list.scrollTop=list.scrollHeight;return list.lastElementChild.getBoundingClientRect().bottom<=list.getBoundingClientRect().bottom+1;})()"),'last winner remains reachable');
    hud.setContentSize(1280,720);
    await hud.webContents.executeJavaScript("winnersFixture.state.gameOptions.standingsScale=100;winnersFixture.push();document.querySelector('#standings-list').scrollTop=0");
    await delay(80);
    fs.writeFileSync(path.join(profile,'hud.png'),(await hud.webContents.capturePage()).toPNG());
    let data={rows:standings.map(({label,wins})=>({name:label,wins})),champion:{name:names[0],wins:999}};
    const template=fs.readFileSync(path.join(root,'src/widgets/view.html'),'utf8').replaceAll('{{kind}}','winners').replaceAll('{{title}}','Kazananlar').replaceAll('{{boxerArtwork}}','');
    server=http.createServer((req,res)=>{
      if(req.url.startsWith('/api/widget/state')) {res.setHeader('Content-Type','application/json');res.end(JSON.stringify({revision:'fixture',...data}));}
      else {res.setHeader('Content-Type','text/html; charset=utf-8');res.end(template);}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    widget=windowFor();
    await widget.loadURL('http://127.0.0.1:'+server.address().port+'/widget/view/hediye-box-winners');
    await until(widget,"document.querySelectorAll('.line').length===6");
    for(const width of [240,320,1280]) {
      widget.setContentSize(width,900);await delay(35);
      checkRows(await geometry(widget,'.line:not(.champ)','.name','.value'));
      assert.ok(await widget.webContents.executeJavaScript("(()=>{const main=document.querySelector('main').getBoundingClientRect();return main.width<=256&&main.right<=innerWidth&&document.documentElement.scrollWidth===innerWidth;})()"),'widget stays narrow without horizontal clipping');
      const champion=(await geometry(widget,'.champ','.name','.value'))[0];
      assert.ok(champion.fits&&champion.alongside&&champion.wrapped);
    }
    widget.setContentSize(260,900);await delay(80);
    fs.writeFileSync(path.join(profile,'widget.png'),(await widget.webContents.capturePage()).toPNG());
    await widget.webContents.executeJavaScript("render({rows:[],champion:null})");
    assert.equal(await widget.webContents.executeJavaScript("document.querySelector('#status').textContent"),'Henüz galibiyet yok.');
    await hud.webContents.executeJavaScript("winnersFixture.state.standings=[];winnersFixture.push()");
    assert.equal(await hud.webContents.executeJavaScript("document.querySelector('#standings').hidden"),true);
    assert.deepEqual(errors,[]);
    console.log('PASS: HUD 640/1280px at 60/100/140%, minimize/restore/scroll/empty; widget 240/320/1280px, champion/long names/counts/empty.');
    console.log('Screenshots: '+path.join(profile,'hud.png')+' ; '+path.join(profile,'widget.png'));
  }
  run().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{
    hud?.destroy();widget?.destroy();server?.close();app.exit(process.exitCode||0);
  });
}
