'use strict';

const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const { desktopTests } = require('../qa/desktop-round-harness.cjs');

// Read the rendered document after the actual preload delivers main's push.
// Poll observations only: keys, clock ticks and game events are sent exactly once.
async function expectView(box, read, expected) {
  const deadline = Date.now() + 2500;
  for (;;) {
    const actual = await box.evaluate(read);
    try { assert.deepEqual(actual, expected); return; }
    catch (error) {
      if (Date.now() >= deadline) throw error;
      await delay(15);
    }
  }
}

const visibleCountdown = () => {
  const counter = document.getElementById('countdown');
  return counter.checkVisibility() ? counter.textContent : null;
};
const visibleWinner = () => {
  const banner = document.getElementById('winner');
  return banner.checkVisibility() ? document.getElementById('winner-name').textContent : null;
};
function chatJoin(box, id, nickname = id) {
  box.events.onChat({ eventId: 'join-' + id, userId: id, nickname, comment: 'katıl' });
}
function nativeFocus(box, focused) {
  box.native.emit('window', { visible: true, focused, bounds: { x: 0, y: 0, width: 1000, height: 700 } });
}
function waiting(box) {
  box.native.emit('state', { phase: 'waiting', lineup: [false, false], health: [null, null] });
}
async function finishCountdown(box) {
  for (let tick = 0; tick < 5; tick++) await box.tick();
}

desktopTests(__filename, {
  async 'fresh B menu exposes the 100-like two-punch rule without a forced migration'(box) {
    waiting(box);
    await box.evaluate(() => window.hediyeBox.setPanelOpen(true));
    await expectView(box, () => [document.querySelector('#punch-source').value,
      document.querySelector('#like-threshold').valueAsNumber, document.querySelector('#like-punch-count').valueAsNumber], ['all', 100, 2]);
    assert.deepEqual(await box.evaluate(() => {
      const field = document.querySelector('#like-punch-count');
      return [field.type, field.name, field.min, field.max, field.step, field.labels[0].textContent,
        document.querySelector('#like-settings').checkVisibility(), document.querySelector('#save-audience').disabled,
        document.querySelector('#like-migration')];
    }), ['number', 'likePunchCount', '1', '100', '1', 'Eşik başına yumruk sayısı', true, true, null]);
    const state = await box.state();
    assert.deepEqual([state.gameOptions.gameVolume, state.gameOptions.effectsVolume], [50, 60]);
    assert.equal(box.calls.starts, 0);
  },
  async 'saved like rules survive unrelated B-menu saves, persisted reload and renderer reload'(box) {
    waiting(box);
    await box.evaluate(() => window.hediyeBox.setPanelOpen(true));
    for (const [threshold, count] of [[10, 1], [42, 7]]) {
      await box.evaluate((likeThreshold, likePunchCount) => window.hediyeBox.configureAudience({
        participationMode: 'both', punchSource: 'all', likeThreshold, likePunchCount
      }), threshold, count);
      await expectView(box, () => [document.querySelector('#like-threshold').valueAsNumber,
        document.querySelector('#like-punch-count').valueAsNumber, document.querySelector('#save-audience').disabled], [threshold, count, true]);
      await box.evaluate(() => {
        document.querySelector('#follow-join').click();
        document.querySelector('#audience-form').requestSubmit();
      });
      await expectView(box, () => document.querySelector('#save-audience').disabled, true);
      const fs = require('node:fs'), path = require('node:path');
      const { app, webContents } = require('electron');
      const stored = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'audience-settings.json'), 'utf8'));
      assert.equal(stored.schemaVersion, 2);
      const { AudienceQueue } = require('../src/audience-queue.cjs');
      const restored = new AudienceQueue({ kingOfRing: true, settings: stored.settings }).snapshot().settings;
      assert.deepEqual([restored.likeThreshold, restored.likePunchCount], [threshold, count]);
      const contents = webContents.getAllWebContents().find(view => view.getURL().includes('/spectator/index.html'));
      assert.ok(contents, 'Isolated spectator renderer must be available');
      const loaded = require('node:events').once(contents, 'did-finish-load');
      contents.reload();
      await loaded;
      await expectView(box, () => [document.querySelector('#like-threshold').valueAsNumber,
        document.querySelector('#like-punch-count').valueAsNumber], [threshold, count]);
    }
  },
  async 'count-only B-menu drafts survive state pushes and validate before saving both bounds'(box) {
    waiting(box);
    await box.evaluate(() => window.hediyeBox.setPanelOpen(true));
    await expectView(box, () => document.querySelector('#like-punch-count').valueAsNumber, 2);
    await box.evaluate(() => {
      const field = document.querySelector('#like-punch-count');
      field.value = '3';field.dispatchEvent(new Event('input'));
    });
    box.native.emit('state', { phase: 'waiting', health: [null, null] });
    await expectView(box, () => [document.querySelector('#like-punch-count').valueAsNumber,
      document.querySelector('#save-audience').disabled], [3, false]);
    await box.evaluate(() => document.querySelector('#audience-form').requestSubmit());
    await expectView(box, () => document.querySelector('#settings-status').textContent, 'Geçerli katılım ayarları gösteriliyor.');
    assert.equal((await box.state()).audience.settings.likePunchCount, 3);
    for (const invalid of ['', '0', '1.5', '101']) {
      const view = await box.evaluate(value => {
        const field = document.querySelector('#like-punch-count');
        field.value = value;field.dispatchEvent(new Event('input'));
        document.querySelector('#audience-form').dispatchEvent(new Event('submit', { cancelable: true }));
        return [field.checkValidity(), document.querySelector('#save-audience').disabled];
      }, invalid);
      assert.deepEqual(view, [false, true]);
      assert.equal((await box.state()).audience.settings.likePunchCount, 3);
    }
    for (const count of [1, 100]) {
      await box.evaluate(value => {
        const field = document.querySelector('#like-punch-count');
        field.value = value;field.dispatchEvent(new Event('input'));
        document.querySelector('#audience-form').requestSubmit();
      }, count);
      await expectView(box, () => document.querySelector('#settings-status').textContent, 'Geçerli katılım ayarları gösteriliyor.');
      const saved = (await box.state()).audience.settings;
      assert.deepEqual([saved.likeThreshold, saved.likePunchCount, saved.likeDamage], [100, count, 15]);
    }
  },
  async 'P after KO retains a lone winner and starts only after a fresh challenger joins'(box){
    waiting(box);chatJoin(box,'red');chatJoin(box,'blue');
    await box.key('P');await finishCountdown(box);
    box.native.emit('state',{phase:'fighting',lineup:[true,true],health:[1,1]});
    box.native.emit('state',{phase:'finished',winner:'left',lineup:[true,true],health:[1,0]});
    box.native.emit('state',{phase:'waiting',lineup:[true,false],health:[1,null]});
    await box.key('P');
    const alone=await box.state();
    assert.equal(alone.audience.active.left.userId,'blue');
    assert.equal(alone.audience.active.right,null);
    assert.equal(box.calls.starts,1);
    assert.equal(box.pendingTicks.length,0);
    chatJoin(box,'challenger');
    box.native.emit('state',{phase:'waiting',lineup:[true,true],health:[1,1]});
    await box.key('P');await finishCountdown(box);
    assert.equal(box.calls.starts,2);
    const next=await box.state();
    assert.equal(next.audience.active.left.userId,'blue');
    assert.equal(next.audience.active.right.userId,'challenger');
  },
  async 'widget links prepare on connect, reconnect and manual refresh while B is closed'(box){
    const {ipcMain}=require('electron');const requests=[];
    ipcMain.removeHandler('hediye-box:getWidgetLinks');
    ipcMain.handle('hediye-box:getWidgetLinks',(_event,value)=>{
      requests.push(value);return {ok:true,value:{fighters:'https://mng-license-server1.onrender.com/'+value.username,queue:'',winners:''}};
    });
    waiting(box);
    box.events.onStatus({status:'connected',username:'first',roomId:'1',message:'Bağlı'});
    await expectView(box,()=>document.getElementById('widget-fighters').value,'https://mng-license-server1.onrender.com/first');
    assert.equal(requests.length,1);assert.equal(requests[0].refresh,false);
    box.events.onStatus({status:'connecting',username:'first',message:'Yeniden bağlanıyor'});
    await expectView(box,()=>document.getElementById('live-status').dataset.status,'connecting');
    box.events.onStatus({status:'connected',username:'first',roomId:'1',message:'Bağlı'});
    await expectView(box,()=>document.getElementById('live-status').dataset.status,'connected');
    await delay(25);assert.equal(requests.length,2);
    await box.evaluate(()=>window.hediyeBox.setPanelOpen(true));
    await expectView(box,()=>document.getElementById('widget-fighters').value,'https://mng-license-server1.onrender.com/first');
    await box.evaluate(()=>document.getElementById('refresh-links').click());
    await delay(25);assert.equal(requests.at(-1).refresh,true);
  },
  async 'second P replaces both fighters with waiting users and never starts their match automatically'(box){
    waiting(box);
    for(const name of ['red','blue','next','later'])chatJoin(box,name);
    await box.key('P');await finishCountdown(box);
    await expectView(box,()=>document.getElementById('start-label').textContent,'Sonraki eşleşme');
    box.native.emit('state',{phase:'fighting',lineup:[true,true],health:[.8,.7]});
    await box.key('P');
    await expectView(box,()=>window.hediyeBox.getState().then(s=>[
      s.audience.active.right?.userId,s.audience.active.left?.userId,s.spectator.phase]),['next','later','waiting']);
    assert.equal(box.calls.starts,1);
    assert.equal(box.pendingTicks.length,0);
    await box.key('P');await finishCountdown(box);
    await expectView(box,()=>document.getElementById('start-label').textContent,'Sonraki eşleşme');
    box.native.emit('state',{phase:'fighting',lineup:[true,true],health:[1,1]});
    await box.key('P');
    await expectView(box,()=>window.hediyeBox.getState().then(s=>[
      s.audience.active.left,s.audience.active.right,s.spectator.health]),[null,null,[null,null]]);
  },
  async 'B explains native game capture without opening a second scene and copies widget links'(box) {
    const { ipcMain } = require('electron');
    let copiedKind;
    let links = { fighters: 'https://mng-license-server1.onrender.com/fighters', queue: null, winners: 'https://mng-license-server1.onrender.com/winners' };
    for (const [channel, handler] of Object.entries({
      getWidgetLinks: () => links,
      copyWidgetLink:kind=>{copiedKind=kind;return {copied:true};},
    })) {
      ipcMain.removeHandler('hediye-box:' + channel);
      ipcMain.handle('hediye-box:' + channel, (_event,value) => ({ ok: true, value: handler(value) }));
    }
    waiting(box);
    await box.evaluate(() => window.hediyeBox.setPanelOpen(true));
    await expectView(box, () => Array.from(document.querySelectorAll('[data-copy]'), button => {
      const field = document.querySelector('#widget-' + button.dataset.copy);
      return [field.value || field.placeholder, button.disabled];
    }), [[links.fighters, false], ['Kullanılamıyor', true], [links.winners, false]]);
    await box.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Browser clipboard is denied in the real panel'); } } });
      document.querySelector('[data-copy="winners"]').click();
    });
    await expectView(box, () => document.getElementById('link-status').textContent, 'Bağlantı kopyalandı.');
    assert.equal(copiedKind,'winners');
    const captureHelp = await box.evaluate(() => {
      const panel = document.querySelector('#control-panel');
      const buttons = [...panel.querySelectorAll('button')].filter(b => b.textContent === 'Yayın sahnesini aç');
      return [buttons.length, panel.innerText.includes('boxing.exe'), typeof window.hediyeBox.openBroadcastView];
    });
    assert.deepEqual(captureHelp, [0, true, 'undefined']);
    await box.state();
    links = null;
    await box.evaluate(() => document.querySelector('#refresh-links').click());
    await expectView(box, () => [...document.querySelectorAll('[data-copy]')].every(b => b.disabled)
      && document.querySelector('#link-status').innerText.includes('kullanılamıyor'), true);
  },
  async 'list sizes and visibility survive panel changes and standings reset requires explicit confirmation'(box) {
    waiting(box);
    for (const name of ['red','blue','next','later']) chatJoin(box, name);
    await box.key('P');
    await finishCountdown(box);
    box.native.emit('state', { phase: 'finished', winner: 'right', health: [0,1] });
    const metrics = () => ['standings','audience-queue'].map(id => {
      const node = document.getElementById(id);
      return [node.checkVisibility(), Math.round(node.getBoundingClientRect().width / node.offsetWidth * 100)];
    });
    await expectView(box, metrics, [[true,100],[true,100]]);
    await box.evaluate(() => window.hediyeBox.setPanelOpen(true));
    await box.evaluate(() => document.querySelector('#standings-larger').click());
    await expectView(box,()=>document.querySelector('#standings-percent').textContent,'110%');
    await box.evaluate(() => document.querySelector('#standings-smaller').click());
    await expectView(box,()=>document.querySelector('#standings-percent').textContent,'100%');
    await box.evaluate(() => {
      for (const [name, size] of [['standings',75],['queue',120]]) {
        const slider = document.getElementById(name+'-scale');
        slider.value = size;
        slider.dispatchEvent(new Event('input'));
        slider.dispatchEvent(new Event('change'));
        document.getElementById('show-'+name).click();
      }
      document.querySelector('#reset-standings').click();
      document.querySelector('#cancel-reset').click();
    });
    assert.equal((await box.state()).standings.length, 1);
    await box.evaluate(() => window.hediyeBox.setPanelOpen(false));
    await expectView(box, () => ['standings','audience-queue'].every(id => document.getElementById(id).hidden), true);
    await box.evaluate(() => window.hediyeBox.setPanelOpen(true));
    await box.evaluate(() => {
      document.querySelector('#show-standings').click();
      document.querySelector('#show-queue').click();
      document.querySelector('#reset-standings').click();
    });
    await box.evaluate(() => window.hediyeBox.setPanelOpen(false));
    await expectView(box, metrics, [[true,75],[true,120]]);
    await box.evaluate(() => window.hediyeBox.setPanelOpen(true));
    assert.equal(await box.evaluate(() => document.querySelector('#reset-confirmation').hidden), true);
    await box.evaluate(() => {
      document.querySelector('#reset-standings').click();
      document.querySelector('#confirm-reset').click();
    });
    await expectView(box, () => document.querySelector('#reset-status').innerText, 'Galibiyetler sıfırlandı.');
    assert.deepEqual((await box.state()).standings, []);
  },
  async 'list title buttons collapse and restore independently through IPC and persist for a fresh options instance'(box) {
    waiting(box);
    for(const name of ['red','blue','next','later'])chatJoin(box,name);
    await box.key('P');await finishCountdown(box);
    box.native.emit('state',{phase:'finished',winner:'right',health:[0,1]});
    const collapsed=()=>['standings','queue'].map(name=>{
      const root=document.getElementById(name==='queue'?'audience-queue':'standings');
      return [root.classList.contains('list-collapsed'),document.getElementById(name+'-minimize').getAttribute('aria-expanded')];
    });
    await expectView(box,collapsed,[[false,'true'],[false,'true']]);
    await box.evaluate(()=>document.getElementById('standings-minimize').click());
    await expectView(box,collapsed,[[true,'false'],[false,'true']]);
    await box.evaluate(()=>document.getElementById('queue-minimize').click());
    await expectView(box,collapsed,[[true,'false'],[true,'false']]);
    await expectView(box,()=>[document.getElementById('standings-list').checkVisibility(),document.getElementById('queue-list').checkVisibility()],[false,false]);
    const fs=require('node:fs'),path=require('node:path'),{app}=require('electron');
    const settingsPath=path.join(app.getPath('userData'),'game-options.json');
    const stored=JSON.parse(fs.readFileSync(settingsPath,'utf8'));
    assert.equal(stored.schemaVersion,1);
    const {createGameOptions}=require('../src/game-options.cjs');
    const restored=createGameOptions({settingsPath,getGamePid:()=>null,spawnWorker:null});
    try{assert.deepEqual([restored.snapshot().standingsCollapsed,restored.snapshot().queueCollapsed],[true,true]);}
    finally{restored.close();}
    await box.evaluate(()=>window.hediyeBox.setPanelOpen(true));
    await box.evaluate(()=>window.hediyeBox.setPanelOpen(false));
    await expectView(box,collapsed,[[true,'false'],[true,'false']]);
    await box.evaluate(()=>document.getElementById('standings-minimize').click());
    await expectView(box,collapsed,[[false,'true'],[true,'false']]);
    await box.evaluate(()=>document.getElementById('queue-minimize').click());
    await expectView(box,collapsed,[[false,'true'],[false,'true']]);
    await expectView(box,()=>[document.getElementById('standings-list').checkVisibility(),document.getElementById('queue-list').checkVisibility()],[true,true]);
    const final=(await box.state()).gameOptions;
    assert.deepEqual([final.standingsCollapsed,final.queueCollapsed,final.showStandings,final.showQueue],[false,false,true,true]);
  },
  async 'embedded spectator reads the local bridge, stays silent and ignores control keys'(box) {
    const { BrowserWindow, app } = require('electron');
    const fs = require('node:fs');
    const path = require('node:path');
    const { pathToFileURL } = require('node:url');
    const fixture = path.join(app.getPath('userData'), 'hud-parent.html');
    fs.mkdirSync(path.dirname(fixture), { recursive: true });
    const hud = pathToFileURL(path.resolve(__dirname, '../spectator/index.html')).href;
    fs.writeFileSync(fixture, '<iframe src="'+hud+'"></iframe>');
    const parent = new BrowserWindow({ show: false });
    try {
      await parent.loadFile(fixture);
      const frame = parent.webContents.mainFrame.frames[0];
      const evaluate = fn => frame.executeJavaScript('('+fn.toString()+')()');
      await evaluate(() => {
        window.audioCalls = 0;
        window.hediyeBoxAudio = { play() { window.audioCalls++; }, unlock() { window.audioCalls++; } };
      });
      const snapshot = { ...(await box.state()), audience: { active: { left: { uniqueId:'viewer' } }, queue: [] },
        spectator: { phase:'waiting', panelOpen:true }, standings:[{ label:'Viewer', wins:3 }],
        gameOptions: { showStandings:false }, sound:{ id:99, name:'gong' } };
      await parent.webContents.executeJavaScript("document.querySelector('iframe').contentWindow.postMessage("+JSON.stringify({type:'state', value:snapshot})+", '*')");
      await expectView({evaluate}, () => document.querySelector('#opponent-wait').checkVisibility(), true);
      const result = await evaluate(() => {
        const keys = ['P','B','Escape'].map(key => document.dispatchEvent(new KeyboardEvent('keydown',{ key, cancelable:true })));
        return [keys, window.audioCalls, document.querySelector('#control-panel').hidden, document.querySelector('#standings').hidden];
      });
      assert.deepEqual(result, [[true,true,true],0,true,true]);
    } finally { parent.destroy(); }
  },
  async 'guard feedback and replayed viewer actions never dispatch extra punches'(box) {
    waiting(box);
    await box.evaluate(() => window.hediyeBox.configureAudience({
      participationMode: 'both', punchSource: 'all', giftDamage: { '5655': 12 },
      likeThreshold: 5, likePunchCount: 2, likeDamage: 9
    }));
    chatJoin(box, 'red');
    chatJoin(box, 'blue');
    await box.key('P');
    await finishCountdown(box);
    box.native.emit('state', { phase: 'fighting', lineup: [true, true], health: [1, 1] });

    const comment = { eventId: 'chat', userId: 'red', comment: 'A' };
    box.events.onChat(comment); box.events.onChat(comment);
    const actions = [
      [box.events.onGiftRaw, { eventId: 'gift', userId: 'blue', giftId: '5655', repeatCount: 3 }, 0, 3, 12],
      [box.events.onLike, { eventId: 'likes', userId: 'red', likeCount: 5, isDelta: true }, 1, 2, 9]
    ];
    assert.equal(box.calls.punches.length, 0);
    for (const [deliver, event, side, count, damage] of actions) {
      const previous = box.calls.punches.length;
      deliver(event);
      const command = box.calls.punches[previous];
      assert.ok(command, event.eventId);
      assert.deepEqual([command.eventId, command.side, command.count, command.damage],
        [event.eventId, side, count, damage]);

      const contact = { defender: 1 - side, damage, blocked: true };
      box.native.emit('hit', contact);
      deliver(event);
      box.native.emit('hit', contact);
      assert.equal(box.calls.punches.length, previous + 1, event.eventId);
    }
  },
  async 'saved B-menu damage follows gift identity and like settings; comments never punch'(box){
    waiting(box);nativeFocus(box,true);box.globalKey('B');
    await expectView(box,()=>document.querySelector('#right-selected').textContent.includes('1 jeton'),true);
    await box.evaluate(()=>{
      for(const [id,value] of [['left-damage',23],['right-damage',38]]){
        const field=document.getElementById(id);field.value=value;field.dispatchEvent(new Event('input'));
      }
      document.getElementById('audience-form').requestSubmit();
    });
    await expectView(box,()=>document.getElementById('settings-status').textContent,'Geçerli katılım ayarları gösteriliyor.');
    const {settings}= (await box.state()).audience;
    assert.deepEqual(settings.giftDamage,{'5655':23,'5269':38});
    assert.equal(await box.evaluate(()=>document.querySelector('#chat-damage')),null);
    await box.evaluate(()=>window.hediyeBox.configureAudience({participationMode:'both',punchGiftIdLeft:'5269',punchGiftIdRight:'5655'}));
    await expectView(box,()=>[document.querySelector('#left-damage').valueAsNumber,document.querySelector('#right-damage').valueAsNumber],[38,23]);
    await box.key('Escape');chatJoin(box,'red');chatJoin(box,'blue');box.globalKey('P');await finishCountdown(box);
    box.events.onChat({userId:'red',comment:'A',eventId:'a'});
    box.events.onGiftRaw({userId:'red',giftId:'5655',eventId:'rose'});
    box.events.onGiftRaw({userId:'blue',giftId:'5269',eventId:'other'});
    assert.deepEqual(box.calls.punches.map(p=>p.damage),[23,38]);
    box.globalKey('B');
    await box.evaluate(()=>{
      const source=document.querySelector('#punch-source');source.value='like';source.dispatchEvent(new Event('change'));
      for(const [id,n] of [['like-threshold',100],['like-punch-count',3],['like-damage',11]]){
        const field=document.getElementById(id);field.value=n;field.dispatchEvent(new Event('input'));
      }
      document.getElementById('audience-form').requestSubmit();
    });
    await expectView(box,()=>document.getElementById('settings-status').textContent,'Geçerli katılım ayarları gösteriliyor.');
    box.events.onLike({userId:'red',likeCount:200,isDelta:true,eventId:'2x100'});
    assert.equal((await box.state()).audience.settings.likePunchCount,3);
    assert.deepEqual([box.calls.punches.at(-1).damage,box.calls.punches.at(-1).count],[11,6]);
  },
  async 'Escape opens audio and graphics only, applies settings and closes over an active match'(box){
    waiting(box);nativeFocus(box,true);
    const defaults=(await box.state()).gameOptions;
    assert.deepEqual([defaults.gameVolume,defaults.effectsVolume],[50,60]);
    box.native.emit('state',{phase:'fighting',health:[1,1]});
    box.globalKey('Escape');
    await expectView(box,()=>[document.getElementById('game-options').checkVisibility(),document.getElementById('control-panel').checkVisibility()],[true,false]);
    await box.evaluate(()=>{
      const form=document.querySelector('#options-form');
      document.querySelector('#game-volume').value=27;
      document.querySelector('#effects-volume').value=44;
      document.querySelector('#scene-quality').value='low';
      document.querySelector('#crowd-flashes').checked=false;
      form.dispatchEvent(new Event('input',{bubbles:true}));
      form.requestSubmit();
    });
    await expectView(box,()=>document.getElementById('options-status').textContent,'Ayarlar uygulandı.');
    assert.deepEqual((await box.state()).gameOptions,{gameVolume:27,effectsVolume:44,quality:'low',flashes:false,
      standingsCollapsed:false,queueCollapsed:false,showStandings:true,standingsScale:100,showQueue:true,queueScale:100});
    await box.key('Escape');
    await expectView(box,()=>document.getElementById('game-options').hidden,true);
    assert.equal((await box.state()).spectator.phase,'fighting');
    const heads=[{visible:true,x:.8,y:.5},{visible:true,x:.35,y:.5}];
    box.native.emit('state',{phase:'fighting',heads,health:[1,.85]});
    box.native.emit('hit',{defender:1,damage:15,blocked:false});
    await expectView(box,()=>document.querySelector('#impact-left').getAnimations().length,1);
    assert.equal(await box.evaluate(()=>document.querySelector('#impact-right').getAnimations().length),0);
    await expectView(box,()=>document.querySelector('#damage-1').textContent,'−15');
  },
  async 'B form preserves follow and threshold-like entry across source changes and separates punch thresholds'(box){
    waiting(box);nativeFocus(box,true);
    box.globalKey('B');
    await expectView(box,()=>document.querySelector('#control-panel').checkVisibility(),true);
    assert.deepEqual(await box.evaluate(()=>[
      document.querySelectorAll('#like-join,#follow-join,#like-join-threshold').length,
      document.querySelectorAll('#chat-damage,[name="chatPunches"]').length,
      [...document.querySelector('#punch-source').options].map(o=>o.value)
    ]),[3,0,['all','gift','like']]);
    await box.evaluate(()=>{
      const source=document.querySelector('#punch-source'), threshold=document.querySelector('#like-threshold');
      source.value='like';source.dispatchEvent(new Event('change'));
      threshold.value='5';threshold.dispatchEvent(new Event('input'));
      const count=document.querySelector('#like-punch-count');count.value='1';count.dispatchEvent(new Event('input'));
      document.querySelector('#follow-join').click();
      document.querySelector('#like-join').click();
      const join=document.querySelector('#like-join-threshold');join.value='7';join.dispatchEvent(new Event('input'));
      document.querySelector('#audience-form').requestSubmit();
    });
    await expectView(box,()=>document.getElementById('settings-status').textContent,'Geçerli katılım ayarları gösteriliyor.');
    assert.equal((await box.state()).audience.settings.likeThreshold,5);
    const saved=(await box.state()).audience.settings;
    assert.deepEqual([saved.followJoin,saved.likeJoin,saved.likeJoinThreshold],[true,true,7]);
    await box.key('Escape');
    const follow={eventId:'follow-red',userId:'red',nickname:'red'};
    box.events.onFollow(follow);box.events.onFollow(follow);
    box.events.onLike({eventId:'join-blue-3',userId:'blue',likeCount:3,isDelta:true});
    assert.equal((await box.state()).audience.active.left,null);
    const join={eventId:'join-blue-4',userId:'blue',likeCount:4,isDelta:true};
    box.events.onLike(join);box.events.onLike(join);
    chatJoin(box,'next');
    assert.deepEqual((await box.state()).audience.queue.map(p=>p.userId),['next']);
    box.globalKey('P');await finishCountdown(box);
    for(const [i,count] of [4,8,3].entries()){
      const event={eventId:'like-'+i,userId:'red',likeCount:count,isDelta:true};
      box.events.onLike(event);box.events.onLike(event);
    }
    assert.deepEqual(box.calls.punches.map(p=>[p.side,p.count]),[[1,2],[1,1]]);
    box.globalKey('B');
    await expectView(box,()=>[document.querySelector('#follow-join').checked,document.querySelector('#like-join').checked,
      document.querySelector('#like-join-threshold').valueAsNumber],[true,true,7]);
    await box.evaluate(()=>{
      const source=document.querySelector('#punch-source');source.value='gift';source.dispatchEvent(new Event('change'));
      document.querySelector('#audience-form').requestSubmit();
    });
    await expectView(box,()=>document.getElementById('settings-status').textContent,'Geçerli katılım ayarları gösteriliyor.');
    const updated=(await box.state()).audience.settings;
    assert.deepEqual([updated.punchSource,updated.followJoin,updated.likeJoin,updated.likeJoinThreshold],['gift',true,true,7]);
    const fs=require('node:fs'),path=require('node:path'),{app}=require('electron');
    const stored=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'audience-settings.json'),'utf8')).settings;
    assert.deepEqual([stored.followJoin,stored.likeJoin,stored.likeJoinThreshold],[true,true,7]);
  },
  async 'ringside painter culls distant rows in a 5000-person queue and reuses the pose atlas'(box){
    const metrics=await box.evaluate(()=>{
      const canvas=document.createElement('canvas');
      document.body.append(canvas);
      const display=window.createRingside(canvas),original=window.requestAnimationFrame;
      const queue=Array.from({length:5000},(_,i)=>({nickname:'Test '+i,coins:5000-i}));
      const view={floor:-2.4,position:[0,3,12],rotation:[-.09,0,0,Math.sqrt(1-.09**2)],scale:[1,1,1],fov:.8,aspect:1.6};
      const times=[];let frame,unchanged;
      try{
        window.requestAnimationFrame=callback=>{frame=callback;return 1;};
        for(let i=0;i<90;i++){
          view.position[0]=Math.sin(i*.03)*.4;
          display.update(view,queue,null);
          const start=performance.now();frame();times.push(performance.now()-start);
        }
        frame=null;display.update(view,queue,null);unchanged=!frame;
        return {visible:Number(canvas.dataset.visibleBoxers),unchanged,p95:times.slice(10).sort((a,b)=>a-b)[75],peak:Math.max(...times)};
      }finally{window.requestAnimationFrame=original;display.dispose();canvas.remove();}
    });
    assert.ok(metrics.visible>=8&&metrics.visible<320,'Only nearby queue rows are drawn');
    assert.equal(metrics.unchanged,true,'Stationary camera and unchanged queue must not redraw');
    assert.ok(Number.isFinite(metrics.p95));
    const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
    fs.writeFileSync(path.join(os.tmpdir(),'hediye-box-ringside-benchmark.json'),JSON.stringify(metrics));
  },
  async 'only the two native fighters occupy the ring through the knockout'(box){
    waiting(box);
    chatJoin(box,'red');chatJoin(box,'blue');
    await box.key('P');await finishCountdown(box);
    const stages=box.calls.stages.length;
    const view={position:[0,2,9],rotation:[0,0,0,1],scale:[1,1,1],fov:.8,aspect:1.6,
      floor:-2.4,fighters:[[-1,.5,0],[1,1,0]]};
    box.native.emit('camera',{sceneView:view,camera:{ready:true}});
    box.native.emit('state',{phase:'fighting',health:[0,1],lineup:[true,true]});
    await expectView(box,()=>document.getElementById('ringside').dataset.visibleBoxers,'0');
    assert.equal(box.calls.stages.length,stages);
    assert.equal((await box.state()).audience.active.left.userId,'blue');
    box.native.emit('state',{phase:'finished',winner:'right',health:[0,1]});
    await expectView(box,()=>!document.getElementById('winner').hidden,true);
    assert.deepEqual(box.calls.stages.slice(stages),[[false,true]]);
    assert.equal(box.calls.starts,1);
  },
  async 'combined entry, legacy chat migration, gift-only punches and FPS ranking reach the B panel'(box){
    waiting(box);
    const settings=await box.state();
    assert.equal(settings.audience.settings.participationMode,'both');
    assert.equal(settings.audience.settings.punchSource,'all');
    await box.evaluate(()=>window.hediyeBox.configureAudience({participationMode:'both',punchSource:'chat'}));
    chatJoin(box,'red');box.events.onGiftRaw({eventId:'blue-entry',userId:'blue',giftId:'5655',coinUnit:1});
    assert.equal(await box.key('P'),true);await finishCountdown(box);
    chatJoin(box,'early');
    box.events.onGiftRaw({eventId:'high',userId:'high',nickname:'Yüksek',giftId:'5655',coinUnit:100});
    const strike={eventId:'comment-1',userId:'red',comment:'A'};
    box.events.onChat(strike);box.events.onChat(strike);
    box.events.onChat({...strike,eventId:'comment-2'});
    box.events.onChat({...strike,eventId:'waiting-A',userId:'high'});
    box.events.onGiftRaw({eventId:'red-gift',userId:'red',giftId:'5269',coinUnit:1});
    assert.deepEqual(box.calls.punches.map(p=>[p.side,p.count]),[[0,1],[1,1]]);
    await expectView(box,()=>Array.from(document.querySelectorAll('.queue-coins'),e=>e.textContent),['100 FPS','0 FPS']);
    await box.evaluate(()=>window.hediyeBox.setPanelOpen(true));
    await expectView(box,()=>[document.querySelector('#punch-source').value,document.querySelector('#participation-mode').value],['gift','both']);
  },
  async 'a failed portrait retries the next real candidate while the health bar stays on its fighter'(box){
    waiting(box);
    const portrait=await box.evaluate(()=>new URL('../assets/tikmng.png',document.baseURI).href);
    box.events.onChat({userId:'red',nickname:'Kırmızı',eventId:'viewer',comment:'katıl',
      portrait:portrait+'.missing',profilePictureUrls:[portrait+'.missing',portrait]});
    box.native.emit('state',{phase:'waiting',lineup:[false,true],heads:[null,{visible:true,x:.4,y:.05}],health:[null,1]});
    await expectView(box,()=>{
      const img=document.getElementById('profile-1-image');
      return img.complete&&img.naturalWidth>0&&img.checkVisibility()&&document.getElementById('health-1').checkVisibility();
    },true);
    assert.equal(await box.evaluate(()=>document.getElementById('profile-1-image').src),portrait);
  },
  async 'viewer timestamps do not redraw the panel and reconnects remain visible'(box) {
    const live={status:'connected',username:'kanal',roomId:'123',message:'Bağlı'};
    box.events.onStatus(live);
    await expectView(box,()=>document.getElementById('live-status').dataset.status,'connected');
    await expectView(box,()=>document.getElementById('username').value,'kanal');
    await box.evaluate(()=>{
      const field=document.getElementById('username');
      field.value='yeni_kanal';
      field.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await box.evaluate(()=>{
      window.testLiveStatePushes=0;
      window.hediyeBox.onState(()=>window.testLiveStatePushes++);
    });
    for(let i=1;i<=60;i++)box.events.onStatus({...live,lastEventAt:i});
    box.events.onStatus({...live,status:'connecting',message:'Yeniden bağlanıyor'});
    await expectView(box,()=>document.getElementById('live-status').dataset.status,'connecting');
    await expectView(box,()=>document.getElementById('username').value,'yeni_kanal');
    assert.equal(await box.evaluate(()=>window.testLiveStatePushes),1);
  },
  async 'focused game P needs two corners and shows a single five-second countdown'(box) {
    await expectView(box, () => document.getElementById('loading-screen').checkVisibility(), true);
    waiting(box);
    nativeFocus(box, false);
    await expectView(box, () => document.querySelector('#opponent-wait').hidden, true);
    assert.equal(box.shortcuts.has('P'), false);
    nativeFocus(box, true);
    chatJoin(box, 'red');
    await expectView(box, () => {
      const hint = document.querySelector('#opponent-wait');
      const rect = hint.getBoundingClientRect();
      return hint.checkVisibility() && hint.textContent.trim() === '' && hint.children.length === 3
        && hint.getAttribute('aria-label') === 'Yeni eşleşme bekleniyor'
        && Math.abs(rect.x + rect.width/2 - innerWidth/2) < 1
        && Math.abs(rect.y + rect.height/2 - innerHeight/2) < 1;
    }, true);
    box.globalKey('P');
    await expectView(box, () => {
      const error = document.getElementById('overlay-error');
      return error.checkVisibility() && /iki köşe/i.test(error.textContent);
    }, true);
    assert.equal(box.pendingTicks.length, 0);

    chatJoin(box, 'blue');
    assert.deepEqual(box.calls.stages, [[false, false], [false, true], [true, true]]);
    await expectView(box, () => document.querySelector('#opponent-wait').hidden, true);
    assert.equal((await box.state()).audience.phase, 'staging');
    assert.equal(await box.key('p', null, { repeat: true }), false);
    assert.equal(await box.key('p', null, { ctrlKey: true }), false);
    box.globalKey('B');
    assert.equal(box.shortcuts.has('P'), false, 'Typing in the overlay must not trigger the OS shortcut');
    assert.equal(await box.key('p', 'username'), false);
    assert.equal(await box.key('Escape'), true);
    await expectView(box, () => document.getElementById('control-panel').hidden, true);
    assert.equal(box.pendingTicks.length, 0, 'Joining and typing must not arm a countdown');

    box.globalKey('P');
    const originalHeight = await box.evaluate(() => innerHeight);
    for (let remaining = 5; remaining > 0; remaining--) {
      if (remaining === 3) {
        box.native.emit('window', { visible: true, focused: true, bounds: { x: 0, y: 0, width: 800, height: 480 } });
        await expectView(box, () => innerWidth / innerHeight > 1.6, true);
      }
      await expectView(box, visibleCountdown, String(remaining));
      const placement = await box.evaluate(() => {
        const digit = document.getElementById('countdown');
        const bounds = digit.getBoundingClientRect();
        return { dx: bounds.left + bounds.width / 2 - innerWidth / 2,
          dy: bounds.top + bounds.height / 2 - innerHeight / 2, size: parseFloat(getComputedStyle(digit).fontSize),
          height: innerHeight, crosshair: document.getElementById('crosshair').checkVisibility() };
      });
      assert.ok(Math.abs(placement.dx) < 1 && Math.abs(placement.dy) < 1);
      assert.ok(placement.size >= 52);
      assert.equal(placement.crosshair, false);
      if (remaining < 3) assert.ok(placement.height < originalHeight);
      if (remaining === 4) {
        box.globalKey('P');
        assert.equal(await box.key('p'), true);
      }
      assert.equal(box.calls.starts, 0, 'Native start ran before the countdown expired');
      await box.tick();
    }
    await expectView(box, visibleCountdown, null);
    await expectView(box, () => document.getElementById('crosshair').checkVisibility(), true);
    assert.equal(box.calls.starts, 1);
    assert.equal(box.pendingTicks.length, 0);
    box.native.emit('state', { phase: 'fighting', lineup: [true, true] });
    await expectView(box, () => document.body.dataset.phase, 'fighting');
    const state = await box.state();
    assert.equal(state.audience.round, 1);
    assert.equal(state.sound.name, 'gong');
  },

  async 'gift joins, fight HUD, winner and queued challenger pass through the desktop bridge'(box) {
    waiting(box);
    await box.evaluate(() => window.hediyeBox.configureAudience({ participationMode: 'gift', participationGiftId: '5655' }));
    const portrait = await box.evaluate(() => new URL('../assets/tikmng.png', document.baseURI).href);
    function gift(id, userId, nickname, giftId = '5655', extra = {}) {
      box.events.onGiftRaw({ eventId: id, userId, nickname, giftId, repeatCount: 1, ...extra });
    }
    chatJoin(box, 'chat-only');
    gift('join-red', 'red', 'Deniz', '5655', { profilePictureUrl: portrait,uniqueId:'deniztest' });
    gift('join-blue', 'blue', 'Ece');
    assert.equal(await box.key('P'), true);
    await expectView(box, visibleCountdown, '5');
    await finishCountdown(box);

    const heads = [{ visible: true, x: 0.25, y: 0.4 }, { visible: true, x: 0.75, y: 0.5 }];
    box.native.emit('state', { phase: 'fighting', lineup: [true, true], heads, health: [0.31, 0.84] });
    const fighters = () => [0, 1].map(index => {
      const card = document.getElementById('participant-' + index);
      const health = document.getElementById('health-' + index);
      const image = document.getElementById('profile-' + index + '-image');
      const rect = card.getBoundingClientRect();
      const x = Math.round(100 * (rect.x + rect.width / 2) / innerWidth);
      const y = Math.round(100 * (rect.bottom + 2) / innerHeight);
      return [card.checkVisibility(), document.getElementById('profile-' + index + '-name').textContent,
        card.hidden ? '' : x+'%', card.hidden ? '' : y+'%', health.checkVisibility() ? health.getAttribute('aria-valuenow') : null,
        image.checkVisibility() ? image.src : null];
    });
    await expectView(box, fighters, [[true, 'Ece', '25%', '40%', '31', null], [true, 'Deniz', '75%', '50%', '84', portrait]]);
    const hudSize=await box.evaluate(()=>{
      const dimensions=id=>{const r=document.querySelector(id).getBoundingClientRect();return [r.width,r.height];};
      return {avatar:dimensions('.participant-avatar'),
        bar:dimensions('#health-0')};
    });
    assert.ok(Math.abs(hudSize.avatar[0]-101.2)<.1 && Math.abs(hudSize.bar[0]-193.6)<.1 && Math.abs(hudSize.bar[1]-24.2)<.1);
    const anchor = () => document.querySelector('#participant-0').style.translate;
    const originalAnchor = await box.evaluate(anchor);
    box.native.emit('camera',{heads:[{...heads[0],x:heads[0].x+.00001},heads[1]]});
    await expectView(box,fighters,[[true,'Ece','25%','40%','31',null],[true,'Deniz','75%','50%','84',portrait]]);
    assert.equal(await box.evaluate(anchor), originalAnchor);
    const view = { position:[0,2,36], rotation:[0,0,0,1], scale:[1,1,1], floor:-2.4,
      fov:.8, aspect:1.6, fighters:[[-1,1,0],[1,1,0]] };
    const portraitWidth = () => Math.round(document.querySelector('.participant-avatar').getBoundingClientRect().width);
    box.native.emit('camera', { heads, sceneView:view });
    await expectView(box, portraitWidth, Math.round(hudSize.avatar[0]*.55));
    assert.equal(await box.evaluate(anchor), originalAnchor);
    box.native.emit('camera', { heads, sceneView:{...view, position:[0,2,4]} });
    await expectView(box, portraitWidth, Math.round(hudSize.avatar[0]));
    await expectView(box,fighters,[[true,'Ece','25%','40%','31',null],[true,'Deniz','75%','50%','84',portrait]]);
    box.native.emit('camera', { camera: { ready: true }, heads: [null, { visible: true, x: 0.5, y: 0.25 }] });
    await expectView(box, fighters, [[false, 'Ece', '', '', null, null], [true, 'Deniz', '50%', '25%', '84', portrait]]);

    gift('join-challenger', 'next', 'Ada');
    gift('join-challenger', 'next', 'Ada');
    await expectView(box, () => [...document.querySelectorAll('#queue-list .queue-name')].map(row => row.textContent), ['Ada']);
    gift('red-punch', 'red', 'Deniz', '5269');
    gift('red-punch', 'red', 'Deniz', '5269');
    assert.deepEqual(box.calls.punches.map(action => [action.side, action.count, action.eventId]), [[0,1,'join-challenger'],[1, 1, 'red-punch']]);

    const finished = { phase: 'finished', winner: 'right', health: [0, 0.84], heads };
    box.native.emit('state', finished);
    await expectView(box, visibleWinner, '@deniztest');
    await expectView(box, () => [document.querySelector('#winner-total').textContent, document.querySelector('#standings-list b').textContent], ['Galibiyet ×1','×1']);
    await expectView(box,()=>[document.querySelector('#winner-image').src,document.querySelector('#standings-list li span').textContent,document.querySelector('#handle-1').textContent],[portrait,'@deniztest','@deniztest']);
    const result = await box.state();
    assert.equal(result.sound.name, 'knockout');
    assert.equal(result.audience.active.right.userId, 'red');
    assert.equal(result.audience.active.left.userId, 'next');
    assert.deepEqual(result.audience.queue.map(person=>[person.userId,person.fps]), [['blue',0]]);
    const stageCount = box.calls.stages.length;
    box.native.emit('state', finished);
    assert.equal((await box.state()).sound.id, result.sound.id, 'Duplicate finish replayed the knockout');
    assert.equal(box.calls.stages.length, stageCount);
    assert.equal((await box.state()).standings.find(row=>row.label==='@deniztest').wins,1);

    assert.equal(box.pendingTicks.length, 0);
    assert.equal(box.calls.starts, 1, 'Restaging must wait for a fresh P');
    nativeFocus(box,true);
    box.globalKey('P');
    box.globalKey('P');
    assert.equal(box.pendingTicks.length,0,'Results P waits for native restaging');
    box.native.emit('state', { phase: 'waiting', lineup: [true, true], health: [1, 1], heads });
    await expectView(box, fighters, [[true, 'Ada', '25%', '40%', '100', null], [true, 'Deniz', '75%', '50%', '100', portrait]]);
    await expectView(box, visibleCountdown, '5');
    await expectView(box, visibleWinner, null);
    await finishCountdown(box);
    const second=await box.state();
    assert.equal(second.audience.round, 2);
    assert.deepEqual([second.sound.name,second.sound.id],['gong',result.sound.id+1]);
    assert.equal(box.calls.starts, 2);
    box.native.emit('state', finished);
    assert.equal((await box.state()).sound.id,second.sound.id);
    box.native.emit('state',{phase:'fighting',lineup:[true,true],health:[1,1]});
    gift('red-punch', 'red', 'Deniz', '5269');
    gift('ada-punch','next','Ada','5655');
    assert.deepEqual(box.calls.punches.map(p=>p.eventId),['join-challenger','red-punch','ada-punch']);
    box.native.emit('hit',{defender:1,damage:15});
    assert.equal((await box.state()).sound.name,'hit');
    box.native.emit('state',{phase:'finished',winner:'right',health:[0,1]});
    const nextResult=await box.state();
    assert.equal(nextResult.sound.name,'knockout');
    assert.equal(nextResult.audience.active.right.userId,'red');
    assert.equal(nextResult.audience.active.left,null);
  },

  async 'rejected native start clears the countdown, shows the error and permits another P'(box) {
    waiting(box);
    nativeFocus(box, true);
    chatJoin(box, 'red');
    chatJoin(box, 'blue');
    box.rejectStart(new Error('QA ring rejected start'));
    box.globalKey('P');
    await finishCountdown(box);
    await expectView(box, () => {
      const error = document.getElementById('overlay-error');
      return [error.checkVisibility() && error.textContent, document.getElementById('countdown').checkVisibility()];
    }, ['QA ring rejected start', false]);
    const rejected = await box.state();
    assert.equal(rejected.audience.round, 0);
    assert.equal(rejected.audience.phase, 'staging');
    assert.equal(rejected.sound, null);
    box.rejectStart(null);
    box.globalKey('P');
    await finishCountdown(box);
    assert.equal((await box.state()).audience.round, 1);
    assert.equal(box.calls.starts, 2);
  }
});
