'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const call = action => async value => {
  const result = await ipcRenderer.invoke('hediye-box:' + action, value);
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
contextBridge.exposeInMainWorld('hediyeBox', {
  controlsOnly: process.argv.includes('--native-hud-controls'),
  getState: call('getState'), connect: call('connect'), launchGame: call('launchGame'),
  closeGame: call('closeGame'), testGift: call('testGift'), setCamera: call('setCamera'),
  startMatch: call('startMatch'), setPanelOpen: call('setPanelOpen'),
  openGameOptions:call('openGameOptions'), configureGameOptions:call('configureGameOptions'),
  getGiftCatalog:call('getGiftCatalog'),configureAudience:call('configureAudience'),
  followTarget:call('followTarget'),
  resetStandings:call('resetStandings'), getWidgetLinks:call('getWidgetLinks'), copyWidgetLink:call('copyWidgetLink'),
  onView(callback) {
    const listener = (_event, view) => callback(view);
    ipcRenderer.on('hediye-box:view', listener);
    return () => ipcRenderer.removeListener('hediye-box:view', listener);
  },
  onState(callback) {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('hediye-box:state', listener);
    return () => ipcRenderer.removeListener('hediye-box:state', listener);
  },
});
