'use strict';
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {BrowserWindow, desktopCapturer, ipcMain} = require('electron');
const root = path.join(__dirname, '../broadcast');
const page = pathToFileURL(path.join(root, 'index.html')).href;

function createBroadcastView({geometry, state, catalog}) {
  let view;
  const present = value => ({...value, spectator: {...value.spectator, panelOpen:false, panelKind:null}});
  function send(channel, value) {
    if (view && !view.isDestroyed()) view.webContents.send(channel, value);
  }
  function handle(name, handler) {
    ipcMain.handle('box-broadcast:'+name, event => {
      if (!view || event.sender !== view.webContents || event.senderFrame !== view.webContents.mainFrame ||
          event.senderFrame.url !== page) throw new Error('Geçersiz yayın penceresi.');
      return handler();
    });
  }
  handle('state', () => present(state()));
  handle('catalog', () => catalog);
  handle('source', async () => {
    const current = geometry();
    if (!current?.handle || !current.bounds) throw new Error('Ring penceresi bekleniyor.');
    const sources = await desktopCapturer.getSources({types:['window'], thumbnailSize:{width:0,height:0}, fetchWindowIcons:false});
    const source = sources.find(row => row.id.split(':')[1] === current.handle && row.name === 'Online Boxing 3D');
    if (!source || geometry()?.handle !== current.handle) throw new Error('Ring görüntüsü alınamadı.');
    return {id:source.id, geometry:current};
  });
  return {
    open() {
      if (view && !view.isDestroyed()) { view.show(); return true; }
      view = new BrowserWindow({title:'Hediye Box · Yayın Sahnesi', width:960,height:600,
        minWidth:320,minHeight:240,backgroundColor:'#05070b',autoHideMenuBar:true,
        webPreferences:{partition:'hediye-box-broadcast',preload:path.join(root,'preload.cjs'),
          nodeIntegration:false,sandbox:true,contextIsolation:true,backgroundThrottling:false}});
      view.webContents.setAudioMuted(true);
      view.webContents.setWindowOpenHandler(() => ({action:'deny'}));
      view.webContents.on('will-navigate',(event,url) => { if (url !== page) event.preventDefault(); });
      view.on('closed', () => { view = null; });
      return view.loadURL(page).then(() => true);
    },
    state(value) { if (view) send('box-broadcast:state',present(value)); },
    camera(value) { send('hediye-box:view',value); },
    geometry(value) { send('box-broadcast:geometry',value); },
  };
}
module.exports = {createBroadcastView};
