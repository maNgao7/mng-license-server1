'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const listen = channel => callback => {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
contextBridge.exposeInMainWorld('nativeHud', {
  state: () => ipcRenderer.invoke('box-native-hud:state'),
  catalog: () => ipcRenderer.invoke('box-native-hud:catalog'),
  onState: listen('native-hud:state'), onView: listen('native-hud:view'),
});
