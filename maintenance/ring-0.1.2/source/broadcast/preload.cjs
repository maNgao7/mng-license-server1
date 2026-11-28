'use strict';
const { contextBridge, ipcRenderer } = require('electron');
function listen(channel, callback) {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}
contextBridge.exposeInMainWorld('hediyeBox', {
  getState: () => ipcRenderer.invoke('box-broadcast:state'),
  getGiftCatalog: () => ipcRenderer.invoke('box-broadcast:catalog'),
  onState: fn => listen('box-broadcast:state', fn),
  onView: fn => listen('hediye-box:view', fn),
});
contextBridge.exposeInMainWorld('ringCapture', {
  source: () => ipcRenderer.invoke('box-broadcast:source'),
  onGeometry: fn => listen('box-broadcast:geometry', fn),
});
