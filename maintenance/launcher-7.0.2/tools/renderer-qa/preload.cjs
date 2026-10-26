'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const listeners = {};
const requests = [];
const accountWaiters = [];
let settings = { holdAccount: false, accountError: false, active: '', connected: '' };
const listen = name => callback => { listeners[name] = callback; return () => { delete listeners[name]; }; };

contextBridge.exposeInMainWorld('mngAPI', {
    workspace: (action, data) => ipcRenderer.invoke('renderer-qa-workspace', action, data),
    workspaceListen: () => () => {},
    durumDinle: listen('status'),
    onOyunKapandi: listen('closed'),
    onArkaPlanHazir: () => {},
    oyunKurulumIlerlemeDinle: () => {},
    oyunDurumlari: () => ipcRenderer.invoke('renderer-qa-game-status'),
    lisansDurumu: async () => ({ gecerli: true, is_unlimited: true }),
    lisansDogrula: async () => { throw new Error('QA must never submit a license'); },
    tiktokHesaplari: async () => ({ active: settings.active, accounts: settings.active ? [settings.active] : [] }),
    widgetBilgisi: async () => {
        if (settings.holdAccount) await new Promise(resolve => accountWaiters.push(resolve));
        if (settings.accountError) throw new Error('QA account lookup failed');
        return { widgets: [], channel: '', liveStatus: { status: settings.connected ? 'connected' : 'disconnected', username: settings.connected } };
    },
    tiktokBaglan: async () => ({ basarili: true }),
    orbitHediyeKatalogu: async () => [],
    surumKontrolEt: async () => ({ guncellemeVar: false }),
    uygulamaAc: (game, options) => new Promise((resolve, reject) => requests.push({ game, options, resolve, reject })),
    arkaPlanVideolari: async () => []
});

contextBridge.exposeInMainWorld('rendererQA', {
    configure: next => {
        settings = { ...settings, ...next };
        if (!settings.holdAccount) accountWaiters.splice(0).forEach(resolve => resolve());
    },
    emit: data => listeners.status?.(data),
    closed: () => listeners.closed?.(),
    finish: (index, result, error) => {
        if (error) requests[index].reject(new Error(error));
        else requests[index].resolve(result);
    },
    inspect: () => requests.map(({ game, options }) => ({ game, options }))
});
