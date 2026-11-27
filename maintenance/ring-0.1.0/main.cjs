'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { setTimeout: delay } = require('node:timers/promises');
const { app, BrowserWindow, Menu, ipcMain, dialog, globalShortcut, screen, clipboard } = require('electron');
const { DesktopController } = require('./src/desktop-controller.cjs');
const { NativeSpectator } = require('./src/native-spectator.cjs');
const { SpectatorSession } = require('./src/spectator-session.cjs');
const { focusNativeGame } = require('./src/native-window.cjs');
const { AudienceQueue } = require('./src/audience-queue.cjs');
const { createGameOptions } = require('./src/game-options.cjs');
app.setName('TikMnG Hediye Box');
app.setPath('userData', process.env.TIKMNG_RING_DATA_DIR ? path.resolve(process.env.TIKMNG_RING_DATA_DIR) : path.join(app.getPath('appData'), 'TikMnG-Hediye-Box-Private'));
function diagnostic(message) {
  try { fs.mkdirSync(app.getPath('userData'), {recursive:true});
    fs.appendFileSync(path.join(app.getPath('userData'), 'startup.log'), `${new Date().toISOString()} ${message}\n`); } catch {}
}
process.on('uncaughtException', error => diagnostic('startup-error: ' + error.message));
process.on('unhandledRejection', error => diagnostic('startup-rejection: ' + String(error?.message || error)));
diagnostic('main-loaded');
const controlsPreview = process.argv.includes('--controls-preview');
const PAGE = pathToFileURL(path.join(__dirname, controlsPreview?'desktop/index.html':'spectator/index.html')).href;
let controller, window, native, spectator, nativeWindow, loadDeadline, audience, audienceState, startJob;
let quitRequested=false, feedbackTimer, audienceTimer, countdown=null, sound=null, soundId=0, stagedMask='', winner=null;
let loadingProgress=5;
let gameOptions, standings, celebration=null, celebrationTimer;
let nativeHud;
let widgetPublisher, widgetJob, widgetChannel='';
async function getWidgetLinks(input){
  const options=input&&typeof input==='object'?input:{username:input};
  const channel=String(options.username||controller.liveState.username||'').trim().replace(/^@/,'').toLowerCase();
  if(!/^[a-z0-9_.]{1,64}$/.test(channel))throw new Error('Önce yayın kullanıcı adını girin.');
  if(!widgetJob){
    widgetJob=require('./src/widget-publisher.cjs').createWidgetPublisher({
      ...require('./src/launcher-widget-access.cjs').createLauncherWidgetAccess({
        documents:app.getPath('documents'),settingsFile:path.join(app.getPath('userData'),'widget-connection.json')
      }),
    }).then(publisher=>{widgetPublisher=publisher;return publisher;}).catch(error=>{
      widgetJob=null;throw error;
    });
  }
  const publisher=await widgetJob;
  publisher.setChannel(channel);widgetChannel=channel;
  publisher.setSnapshot(snapshot());
  return publisher.getWidgetLinks({refresh:options.refresh===true});
}
let stageRevision=0, stageRetry;
let playedMatch=false, resetPending=false;
const { WinStandings }=require('./src/win-standings.cjs');
const SETTINGS_FILE=path.join(app.getPath('userData'),'audience-settings.json');
const giftCatalog=require('./assets/gift-catalog.json').map(gift=>({...gift,
  imageUrl:gift.file?pathToFileURL(path.join(__dirname,'assets/catalog',gift.file)).href:gift.source}));
function loadAudienceSettings(){
  try{
    const value=JSON.parse(fs.readFileSync(SETTINGS_FILE,'utf8'));
    if(value.schemaVersion===2)return value.settings;
    if(value.schemaVersion===1)return {...value.settings,participationMode:value.settings?.participationMode==='gift'?'gift':'both'};
    return {};
  }
  catch{return{};}
}
function configureAudience(value){
  if(!value||!['both','chat','gift'].includes(value.participationMode))throw new Error('Geçerli katılım ayarı gerekli.');
  for(const key of ['participationGiftId','punchGiftIdLeft','punchGiftIdRight']){
    if(value[key]&&!giftCatalog.some(gift=>gift.id===String(value[key])))throw new Error('Hediye katalogda bulunamadı.');
  }
  const next=audience.configure({...value,punchGiftId:'',chatPunches:false});
  fs.mkdirSync(path.dirname(SETTINGS_FILE),{recursive:true});
  const temp=SETTINGS_FILE+'.tmp';fs.writeFileSync(temp,JSON.stringify({schemaVersion:2,settings:next.settings}));fs.renameSync(temp,SETTINGS_FILE);
  audienceState=next;sendState();return snapshot();
}
function acceptAudience(method,event){
  const result=audience[method](event);
  for(const action of result.actions||[]){
    native.punch({...action,side:action.side==='left'?0:1}).catch(showFeedback);
  }
  if(!result.accepted||(!result.joined&&!result.rosterChanged&&!result.addedCoins))return result;
  audienceState=null;
  if(result.joined)syncLineup();
  if(!audienceTimer)audienceTimer=setTimeout(()=>{
    audienceTimer=null;
    if(!quitRequested)sendState();
  },32);
  return result;
}
function syncLineup(force=false){
  if(!native?.worker||!['loading','waiting','finished'].includes(spectator.value.phase))return;
  const lineup=audience.lineup();
  const mask=lineup.join();
  if(!force&&mask===stagedMask)return;
  stagedMask=mask;
  clearTimeout(stageRetry);
  const revision=++stageRevision;
  const attempt=async (number)=>{
    if(quitRequested||revision!==stageRevision||spectator.value.phase==='fighting')return;
    try { await native.stage(lineup); }
    catch(error){
      if(revision!==stageRevision||quitRequested)return;
      if(number>=3){stagedMask='';showFeedback(error);return;}
      stageRetry=setTimeout(()=>void attempt(number+1),250*2**number);
    }
  };
  void attempt(0);
}
function playSound(name, detail={}){sound={id:++soundId,name,...detail};sendState();}
function startMatch(){
  if(startJob)return startJob;
  startJob=startOneMatch().finally(()=>{startJob=null;});
  return startJob;
}
async function startOneMatch(){
  if(playedMatch || resetPending){
    if(!resetPending){
      audienceState=audience.advanceRound();
      playedMatch=false;
    }
    resetPending=true;
    clearTimeout(stageRetry);stageRevision++;
    clearTimeout(celebrationTimer);celebration=null;winner=null;countdown=null;
    spectator.receive({phase:'loading',health:[null,null],heads:[null,null]});
    await native.resetRound(audience.lineup());
    await waitForRing(native);
    stagedMask=audience.lineup().join();
    resetPending=false;sendState();
    return snapshot();
  }
  if(spectator?.value.phase==='finished'){
    syncLineup(true);
    await waitForRing(native);
  }
  if(spectator?.value.phase==='loading')await waitForRing(native);
  if(spectator?.value.phase==='fighting')return snapshot();
  if(spectator?.value.phase!=='waiting')throw new Error('Ring henüz hazır değil.');
  const {active}=audience.snapshot();
  if(!active.left||!active.right)throw new Error('P ile başlatmak için iki köşenin dolmasını bekle.');
  const current=native;
  clearTimeout(celebrationTimer); celebration=null; winner=null;
  try{
    for(let remaining=5;remaining>0;remaining--){
      countdown=remaining;sendState();await delay(1000);
      if(quitRequested||native!==current||!current.worker)throw new Error('Maç hazırlanırken oyun kapandı.');
    }
    await spectator.startMatch();
    audienceState=audience.startRound();
    playedMatch=true;
    countdown=null;playSound('gong');
    return snapshot();
  }finally{
    if(countdown!==null){countdown=null;sendState();}
  }
}
function waitForRing(current){
  if(spectator.value.phase==='waiting')return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>finish(new Error('Ring zamanında hazırlanmadı.')),25000);
    function finish(error){
      clearTimeout(timer);current.removeListener('state',check);current.removeListener('closed',closed);
      if(error)reject(error);else resolve();
    }
    function closed(){finish(new Error('Oyun kapandı.'));}
    function check(value){
      if(value.phase==='waiting')finish();
      else if(value.phase==='error')finish(new Error(value.error));
    }
    current.on('state',check);current.once('closed',closed);
  });
}
function snapshot(){
  const state=controller.snapshot();
  return spectator?{...state,loadingProgress,gameRunning:!!native.gamePid,spectator:spectator.snapshot(),audience:audienceState??=audience.snapshot(),gameOptions:gameOptions?.snapshot(),countdown,sound,winner,celebration,standings:standings.top,pAction:playedMatch?'next':'start'}:state;
}
function sendState() {
  if (window && !window.isDestroyed()) {
    const state = snapshot();
    window.webContents.send('hediye-box:state', state);
    nativeHud?.state(state);
    widgetPublisher?.setSnapshot(state);
  }
}
function showFeedback(error){
  if(!spectator||spectator.value.phase==='error')return;
  const session=spectator;
  session.value.error=error.message;sendState();clearTimeout(feedbackTimer);
  feedbackTimer=setTimeout(()=>{
    if(spectator===session&&session.value.error===error.message){session.value.error='';sendState();}
  },3200);
}
function refreshShortcuts(){
  globalShortcut.unregisterAll();
  if(!nativeWindow?.focused || spectator?.value.phase==='loading' ||
      spectator?.value.panelOpen || !window || window.isDestroyed())return;
  globalShortcut.register('B',()=>setPanelOpen(true));
  globalShortcut.register('Escape',()=>setPanelOpen(true,'settings'));
  globalShortcut.register('P',()=>void startMatch().catch(showFeedback));
  globalShortcut.register('F',()=>void native.setCamera('free').catch(showFeedback));
  globalShortcut.register('E',()=>void native.followTarget().catch(showFeedback));
  globalShortcut.register('Home',()=>void native.setCamera('ring').catch(showFeedback));
}
function setPanelOpen(open,kind='broadcast'){
  if(!spectator||!window)return;
  if(spectator.value.phase==='loading')return snapshot();
  spectator.setPanelOpen(open===true,kind);
  window.setIgnoreMouseEvents(!open);
  if(open){window.show();window.focus();}
  else {window.hide();if(native.gamePid)void focusNativeGame(native.gamePid).catch(error=>diagnostic(error.message));}
  refreshShortcuts();return snapshot();
}
function placeOverlay(value){
  nativeWindow=value;
  nativeHud?.geometry(value);
  if(!window||window.isDestroyed())return;
  const bounds=value.bounds;
  if(bounds&&bounds.width>0&&bounds.height>0){
    window.setBounds(screen.screenToDipRect(null,bounds),false);
    if(spectator?.value.panelOpen&&value.visible&&(value.hudOwned||value.focused||window.isFocused())){
      if(!window.isVisible())window.showInactive();
      if(value.focused)window.moveTop();
      if(value.focused&&spectator?.value.panelOpen&&!window.isFocused())window.focus();
    }
    else window.hide();
  }else if(!value.visible)window.hide();
  refreshShortcuts();
}
function configureIpc() {
  if(!controlsPreview)nativeHud=require('./src/native-hud.cjs').createNativeHud({state:snapshot,catalog:giftCatalog,
    onError:error=>{diagnostic('native-hud: '+error.message);showFeedback(error);if(window&&!window.isDestroyed())setPanelOpen(true);}});
  for (const [action, handler] of Object.entries({
    getState: snapshot, connect: name => controller.connect(name),
    launchGame: () => controller.launchGame(), closeGame: () => controller.closeGame(),
    testGift: side => controller.testGift(side), setCamera: mode => native?native.setCamera(mode):controller.setCamera(mode),
    startMatch, setPanelOpen, openGameOptions:()=>setPanelOpen(true,'settings'), getGiftCatalog:()=>giftCatalog, configureAudience,
    configureGameOptions:async patch=>{await gameOptions.configure(patch);sendState();return snapshot();},
    followTarget:()=>native.followTarget(),
    resetStandings:()=>{standings.reset();celebration=null;sendState();return snapshot();},
    getWidgetLinks,
    copyWidgetLink:kind=>require('./src/widget-clipboard.cjs').copyWidgetLink(kind,{
      getLinks:()=>getWidgetLinks(widgetChannel||controller.liveState.username),clipboard}),
  })) ipcMain.handle('hediye-box:' + action, async (event, value) => {
    if (event.sender !== window?.webContents || event.senderFrame?.url !== PAGE) throw new Error('Geçersiz pencere.');
    try { return { ok: true, value: await handler(value) }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
}
function createWindow() {
  diagnostic('creating-window');
  window = new BrowserWindow({ width: 1250, height: 820, minWidth: 860, minHeight: 620,
    show: false, backgroundColor: '#090d12', title: 'TikMnG · Hediye Box',
    icon: path.join(__dirname, 'assets/tikmng.ico'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true,
      contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, webSecurity: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== PAGE) event.preventDefault(); });
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.session.setPermissionRequestHandler((_sender, _permission, callback) => callback(false));
  window.once('ready-to-show', () => { diagnostic('ready-to-show'); window.show(); });
  window.webContents.on('did-fail-load', (_event, code) => diagnostic('page-load-failed: ' + code));
  window.webContents.once('did-finish-load', () => { diagnostic('page-loaded'); window.show(); });
  controller.on('state', sendState); configureIpc(); window.loadURL(PAGE);
  window.on('closed', () => { controller?.close(); window = null; });
}
function createNativeSession(){
  native=new NativeSpectator();spectator=new SpectatorSession({native,live:controller.live});
  const current=native;
  native.on('diagnostic',value=>diagnostic('native: '+JSON.stringify(value)));
  let volumePid=null;
  spectator.on('state',()=>{
    if(current.gamePid&&volumePid!==current.gamePid&&spectator.value.phase==='waiting'){
      volumePid=current.gamePid;Promise.resolve(gameOptions.syncNative()).catch(showFeedback);
    }
    if(spectator.value.phase!=='loading'){
      clearTimeout(loadDeadline);
      if(spectator.value.phase==='waiting'&&loadingProgress<100){
        if(process.env.TIKMNG_RING_STARTUP_SIGNAL){try{fs.writeFileSync(process.env.TIKMNG_RING_STARTUP_SIGNAL,'4');}catch(error){diagnostic('startup-signal: '+error.message);}}
        loadingProgress=100;
        refreshShortcuts();
      }
    }
    if(spectator.value.phase==='finished'&&audience.snapshot().phase==='active'){
      const side=spectator.value.winner;
      const fighter=audience.snapshot().active[side];
      winner=fighter?.nickname||fighter?.uniqueId||null;
      audienceState=audience.finishRound(side);
      // KO already retires the loser and seats a challenger. The next P starts
      // this staged pair, or keeps the winner waiting when the queue is empty.
      playedMatch=false;
      if(fighter){
        const wins=standings.record(fighter);
        celebration={fighter,side,wins};
        clearTimeout(celebrationTimer);
        celebrationTimer=setTimeout(()=>{celebration=null;sendState();},4200);
      }
      playSound('knockout');syncLineup(true);
    }
    if(spectator.value.phase==='error'&&(loadingProgress<100||!nativeWindow?.visible)){
      dialog.showErrorBox('Hediye Box',spectator.value.error);
      app.quit();
      return;
    }
    sendState();
  });
  native.on('window',value=>{
    if(native!==current)return;
    placeOverlay(value);
    if(value.visible&&spectator.value.phase==='loading'&&loadingProgress<65){
      loadingProgress=65;
      sendState();
    }
  });
  native.on('hit',event=>{if(native===current&&spectator.value.phase==='fighting')playSound('hit',{defender:event?.defender,blocked:event?.blocked===true,damage:event?.damage});});
  native.on('camera',value=>{
    if(native!==current)return;
    if(value.heads)spectator.value.heads=value.heads;
    if(value.backs)spectator.value.backs=value.backs;
    if(Object.hasOwn(value,'sceneView'))spectator.value.sceneView=value.sceneView;
    spectator.value.camera=value.camera;
    if(window&&!window.isDestroyed())window.webContents.send('hediye-box:view',value);
    nativeHud?.camera(value);
  });
  native.on('closed',details=>{
    diagnostic('native-closed: '+JSON.stringify(details||{}));
    if(native!==current||quitRequested)return;
    if(['loading','error'].includes(spectator.value.phase)){
      dialog.showErrorBox('Hediye Box',spectator.value.error||'Ring yüklenirken oyun kapandı.');
    }
    app.quit();
  });
}
function openRing(){
  clearTimeout(loadDeadline);
  const session=spectator;
  loadDeadline=setTimeout(()=>{
    if(spectator===session&&session.value.phase==='loading'){
      session.receive({phase:'error',error:'Ring zamanında yüklenemedi. Oyunu kapatıp yeniden açın.'});
    }
  },25000);
  const handle=window.getNativeWindowHandle();
  const overlayHandle=handle.length===8?handle.readBigUInt64LE().toString():String(handle.readUInt32LE());
  loadingProgress=30;sendState();native.open(overlayHandle,nativeHud?.file);syncLineup();
}
function createSpectatorWindow(){
  createNativeSession();
  window=new BrowserWindow({width:1408,height:880,minWidth:360,minHeight:240,show:false,
    transparent:true,frame:false,hasShadow:false,resizable:false,skipTaskbar:true,
    title:'Hediye Box · Ayarlar',backgroundColor:'#00000000',
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),additionalArguments:['--native-hud-controls'],sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,autoplayPolicy:'no-user-gesture-required'}});
  window.setIgnoreMouseEvents(true);
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(url!==PAGE)event.preventDefault();});
  window.webContents.session.setPermissionCheckHandler(()=>false);
  window.webContents.session.setPermissionRequestHandler((_s,_p,callback)=>callback(false));
  configureIpc();
  let displayedLive;
  controller.on('state',({live})=>{
    // The shared connector updates lastEventAt for every viewer event. The
    // audience handler already delivers those events and batches roster changes.
    if(displayedLive && ['status','username','roomId','reason','message'].every(key=>displayedLive[key]===live[key]))return;
    displayedLive=live;
    if(live.status==='connected'&&live.username)void getWidgetLinks(live.username).catch(error=>diagnostic('widget-ready: '+error.message));
    sendState();
  });
  window.on('blur',refreshShortcuts);
  window.webContents.once('did-finish-load',()=>{
    openRing();
  });
  window.loadURL(PAGE);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if(native?.gamePid)void focusNativeGame(native.gamePid).catch(error=>dialog.showErrorBox('Hediye Box',error.message));
    else if (window) { if (window.isMinimized()) window.restore(); window.focus(); }
    else controller?.launchGame().catch(error => dialog.showErrorBox('Hediye Box', error.message));
  });
  app.whenReady().then(async () => {
    diagnostic('app-ready'); Menu.setApplicationMenu(null);
    standings=new WinStandings(path.join(app.getPath('userData'),'win-standings.json'),diagnostic);
    gameOptions=createGameOptions({settingsPath:path.join(app.getPath('userData'),'game-options.json'),getGamePid:()=>native?.gamePid});
    try{audience=new AudienceQueue({settings:{punchSource:'all',...loadAudienceSettings(),chatPunches:false},kingOfRing:true});}catch{audience=new AudienceQueue({kingOfRing:true,settings:{punchSource:'all'}});}
    controller = new DesktopController({onChat:event=>acceptAudience('ingestChat',event),onGiftRaw:event=>acceptAudience('ingestGift',event),
      onLike:event=>acceptAudience('ingestLike',event),onFollow:event=>acceptAudience('ingestFollow',event),
      onPortrait:event=>{if(audience.updatePortrait(event)){audienceState=null;sendState();}}});
    if (controlsPreview) { createWindow(); return; }
    try{
      process.env.TIKMNG_RING_NATIVE_GAME=await require('./src/runtime-paths.cjs').prepareNative({dataDirectory:app.getPath('userData')});
      createSpectatorWindow();
    }catch(error){diagnostic('native-prepare: '+error.message);dialog.showErrorBox('Ring',error.message);app.quit();}
  });
  app.on('window-all-closed', () => { if (controlsPreview) app.quit(); });
  app.on('before-quit', () => {quitRequested=true;clearTimeout(loadDeadline);clearTimeout(feedbackTimer);clearTimeout(audienceTimer);clearTimeout(celebrationTimer);clearTimeout(stageRetry);globalShortcut.unregisterAll();widgetPublisher?.close().catch(()=>{});gameOptions?.close();spectator?.close();controller?.close();nativeHud?.close().catch(error=>diagnostic(error.message));});
}
