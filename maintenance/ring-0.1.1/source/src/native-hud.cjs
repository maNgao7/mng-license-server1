'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { BrowserWindow, ipcMain } = require('electron');
const { createHudPixelWriter } = require('./hud-pixel-writer.cjs');
const root = path.join(__dirname, '../native-hud');
const page = pathToFileURL(path.join(root, 'index.html')).href;

// No visible window or screen capture: Chromium paints transparent pixels which
// the private game's Vulkan layer blends into its own swapchain.
function createNativeHud({ state, catalog, onError = () => {} }) {
  const writer = createHudPixelWriter({ onError });
  const view = new BrowserWindow({ width: 1408, height: 880, show: false,
    frame: false, transparent: true, backgroundColor: '#00000000', skipTaskbar: true,
    webPreferences: { preload: path.join(root, 'preload.cjs'), offscreen: true,
      nodeIntegration: false, sandbox: true, contextIsolation: true, backgroundThrottling: false } });
  const present = value => ({ ...value, spectator: { ...value.spectator, panelOpen: false, panelKind: null } });
  let closed = false, loaded = false, lastSize = '', drawingConfirmed = false, readyAt = 0, reported = false;
  const monitor=setInterval(()=>{
    if(closed||drawingConfirmed||!readyAt)return;
    try { drawingConfirmed=fs.readFileSync(writer.file+'.log','utf8').includes('Native HUD recorded'); } catch {}
    if(!drawingConfirmed&&!reported&&Date.now()-readyAt>12000){
      reported=true;onError(new Error('Oyun içi göstergeler çizilemedi. Oyunu kapatıp yeniden açın; sürerse bu bildirimi paylaşın.'));
    }
  },1000);
  monitor.unref();
  function send(channel, value) {
    if (loaded && !closed && !view.isDestroyed()) view.webContents.send(channel, value);
  }
  for (const [name, handler] of Object.entries({ state: () => present(state()), catalog: () => catalog })) {
    ipcMain.handle('box-native-hud:' + name, event => {
      if (closed || event.sender !== view.webContents || event.senderFrame !== view.webContents.mainFrame ||
          event.senderFrame.url !== page) throw new Error('Geçersiz oyun göstergesi.');
      return handler();
    });
  }
  view.webContents.setAudioMuted(true);
  view.webContents.setFrameRate(30);
  view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  view.webContents.on('will-navigate', (event, url) => { if (url !== page) event.preventDefault(); });
  view.webContents.on('paint', (_event, _dirty, image) => {
    if (closed || writer.busy || image.isEmpty()) return;
    try {
      // Offscreen paint sizes can include Windows display scaling. Match the
      // bounded native texture even on a 150%/200% display.
      let { width, height } = image.getSize();
      const scale = Math.min(1, 1920 / width, 1080 / height);
      if (scale < 1) {
        width = Math.max(1, Math.floor(width * scale));
        height = Math.max(1, Math.floor(height * scale));
        image = image.resize({ width, height, quality: 'good' });
      }
      writer.publish(width, height, image.toBitmap());
    } catch (error) { onError(error); }
  });
  view.webContents.once('did-finish-load', () => { loaded = true; send('native-hud:state', present(state())); });
  view.loadURL(page).catch(onError);
  return {
    file: writer.file,
    state(value) {
      if(['waiting','fighting','finished'].includes(value?.spectator?.phase))readyAt ||= Date.now();
      send('native-hud:state', present(value));
    },
    camera(value) { send('native-hud:view', value); },
    geometry(value) {
      const bounds = value?.bounds;
      if (!bounds || bounds.width < 1 || bounds.height < 1 || closed) return;
      const scale = Math.min(1, 1920 / bounds.width, 1080 / bounds.height);
      const width = Math.max(1, Math.round(bounds.width * scale));
      const height = Math.max(1, Math.round(bounds.height * scale));
      const key = width + ':' + height;
      if (key !== lastSize) { lastSize = key; view.setSize(width, height, false); }
    },
    async close() {
      if (closed) return; closed = true;
      clearInterval(monitor);
      for (const name of ['state', 'catalog']) ipcMain.removeHandler('box-native-hud:' + name);
      if (!view.isDestroyed()) view.destroy();
      await writer.close();
    },
  };
}
module.exports = { createNativeHud };
