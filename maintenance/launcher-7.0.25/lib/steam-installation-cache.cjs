'use strict';
const { Worker } = require('node:worker_threads');
const path = require('node:path');

function createSteamInstallationCache({ onChange = () => {}, ttl = 60000 } = {}) {
    const cache = new Map();
    function status(moduleName, appId, storeUrl) {
        let entry = cache.get(moduleName);
        if (!entry) { entry = { installed: false, checkedAt: 0, pending: false }; cache.set(moduleName, entry); }
        if (!entry.pending && Date.now() - entry.checkedAt >= ttl) {
            entry.pending = true;
            const worker = new Worker(
                'const {parentPort,workerData}=require("node:worker_threads");try{parentPort.postMessage(Boolean(require(workerData).findSteamDemo()))}catch{parentPort.postMessage(false)}',
                { eval: true, workerData: path.join(__dirname, moduleName) });
            const timer = setTimeout(() => { void worker.terminate(); }, 10000);
            worker.unref();
            worker.once('message', installed => { entry.installed = installed === true; });
            worker.once('error', () => {});
            worker.once('exit', () => {
                clearTimeout(timer);
                entry.checkedAt = Date.now();
                entry.pending = false;
                try { onChange(); } catch { /* A retired window must not break the cache. */ }
            });
        }
        return { appId, storeUrl, installed: entry.installed, checking: entry.pending };
    }
    status.invalidate = () => { for (const entry of cache.values()) entry.checkedAt = 0; };
    return status;
}
module.exports = { createSteamInstallationCache };
