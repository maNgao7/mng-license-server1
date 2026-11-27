'use strict';

function releaseNotes(value) {
    const notes = Array.isArray(value) ? value.map(item => typeof item === 'string' ? item : item?.note || '').join('\n') : String(value || '');
    return notes.replace(/^\s*#{1,6}\s+.*$/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/<\/(?:p|li|h[1-6])\s*>/gi, '\n').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '')
        .slice(0, 6000).split(/\r?\n/).map(line => line.replace(/^\s*(?:#{1,6}\s+|[-*]\s+)/, '').trim()).filter(Boolean).slice(0, 24);
}

function recordPerformance(app, event) {
    try {
        const fs = require('node:fs'), path = require('node:path');
        const directory = app.getPath('logs'), file = path.join(directory, 'launcher-update-performance.jsonl');
        fs.mkdirSync(directory, { recursive: true });
        if (fs.existsSync(file) && fs.statSync(file).size > 1024 * 1024) return;
        fs.appendFile(file, JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n', () => {});
    } catch { /* Diagnostics must not affect updating. */ }
}

function createAppUpdates({ app, notify, loadUpdater=()=>require('electron-updater').autoUpdater,
    readRelease=require('./update-release.cjs').readRelease, download=require('./download.cjs').downloadFile,
    launchInstaller=file=>new Promise((resolve,reject)=>{const child=require('node:child_process').spawn(file,['/S'],{detached:true,stdio:'ignore',windowsHide:true});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});}),
    schedule=(fn,delay)=>setTimeout(fn,delay), record=event=>recordPerformance(app,event) }) {
    let updater;
    let checked = null;
    let downloaded = false;
    let pending = null;
    let downloadStarted = 0, lastProgress = 0, lastRecordedProgress = 0;
    const diagnose = event => { try { record(event); } catch {} };
    function setup() {
        if (updater) return updater;
        updater = loadUpdater();
        updater.autoDownload = false;
        updater.autoInstallOnAppQuit = false;
        updater.allowDowngrade = false;
        updater.disableWebInstaller = true;
        const mode = message => {
            if (typeof message !== 'string') return;
            if (/Cannot download differentially|fallback to full download/i.test(message)) diagnose({ phase: 'download-mode', mode: 'full-fallback' });
            else if (/^Differential download:/.test(message)) diagnose({ phase: 'download-mode', mode: 'differential' });
        };
        // Record only classifications, never updater messages containing signed URLs.
        updater.logger = { info: mode, warn: mode, error: mode, debug: () => {} };
        updater.setFeedURL({ provider: 'github', owner: 'maNgao7', repo: 'mng-license-server1' });
        updater.on('download-progress', p => {
            lastProgress = Date.now();
            if (lastProgress - lastRecordedProgress >= 10000) {
                lastRecordedProgress = lastProgress;
                diagnose({ phase: 'download-progress', elapsedMs: lastProgress - downloadStarted,
                    transferredBytes: p.transferred, totalBytes: p.total, speedBps: p.bytesPerSecond });
            }
            notify('guncelleme-ilerleme', {
            percent: p.percent, transferredMB: (p.transferred / 1048576).toFixed(1), totalMB: (p.total / 1048576).toFixed(1),
            speedBps: p.bytesPerSecond, mesaj: 'Uygulama güncellemesi indiriliyor. Oyunlar ve ayarlar korunuyor.'
            });
        });
        updater.on('update-downloaded', () => { downloaded = true; });
        updater.on('error', () => { /* The initiating operation reports its own error without exposing signed URLs. */ });
        return updater;
    }
    async function check() {
        const currentVersion = app.getVersion();
        if (app.isTikMNGPreview) return { guncellemeVar: false, currentVersion, latestVersion: currentVersion, changelog: [], mesaj: 'Test sürümü. Genel güncelleme henüz yayımlanmadı.' };
        if (!app.isPackaged) return { guncellemeVar: false, currentVersion, latestVersion: currentVersion, changelog: [], mesaj: 'Kaynak deneme sürümü. Kurulum paketi henüz yayımlanmadı.' };
        try {
            const result = await setup().checkForUpdates();
            checked = result?.updateInfo || null;
            const newer = checked && require('./update-release.cjs').newer(checked.version, currentVersion);
            return { guncellemeVar: Boolean(newer), currentVersion, latestVersion: checked?.version || currentVersion,
                changelog: releaseNotes(checked?.releaseNotes),
                webUrl: 'https://github.com/maNgao7/mng-license-server1/releases/latest' };
        } catch {
            try{
                const release=await readRelease();
                return {guncellemeVar:require('./update-release.cjs').newer(release.version,currentVersion),currentVersion,
                    latestVersion:release.version,changelog:releaseNotes(release.notes),downloadUrl:release.url,webUrl:release.url,fallback:true};
            }catch{}
            return { guncellemeVar: false, currentVersion, latestVersion: currentVersion, changelog: [],
                checkFailed:true,hata: 'Güncelleme kontrol edilemedi; uygulamanın güncel olduğu doğrulanamadı. Ağ bağlantısını kontrol edip yeniden deneyin.' };
        }
    }
    async function install() {
        if (pending) return pending;
        pending = (async () => {
            if (app.isTikMNGPreview || !app.isPackaged) throw new Error('Test sürümü genel güncelleme kurmaz.');
            const checkStarted = Date.now();
            const result = await check();
            diagnose({ phase: 'check-complete', elapsedMs: Date.now() - checkStarted, fallback: Boolean(result.fallback) });
            if (!result.guncellemeVar) throw new Error(result.hata || 'Yeni bir uygulama sürümü bulunamadı.');
            if(result.fallback){
                diagnose({ phase: 'download-mode', mode: 'full-api-fallback' });
                const release=await readRelease();
                if(!require('./update-release.cjs').newer(release.version,app.getVersion())||!release.sha256)throw Error('Güvenli kurulum özeti doğrulanamadı. Resmi kurulum dosyasını indirin.');
                const file=require('node:path').join(app.getPath('temp'),'TikMnG-Updates',release.name);
                await download(release.url,file,{sha256:release.sha256,bytes:release.bytes,onProgress:p=>notify('guncelleme-ilerleme',{
                    percent:p.percent,transferredMB:(p.transferredBytes/1048576).toFixed(1),totalMB:(p.totalBytes/1048576).toFixed(1),speedBps:p.speedBps})});
                await launchInstaller(file);app.quit();return {basarili:true};
            }
            downloaded=false;
            downloadStarted = Date.now(); lastProgress = 0; lastRecordedProgress = 0;
            diagnose({ phase: 'download-start', version: checked?.version });
            await setup().downloadUpdate();
            if (!downloaded) throw new Error('Güncelleme tamamlanmadı. Mevcut sürüm korunuyor.');
            diagnose({ phase: 'download-verified', elapsedMs: Date.now() - downloadStarted,
                finalizationMs: lastProgress ? Date.now() - lastProgress : null });
            notify('guncelleme-bitti', { mesaj: 'Güncelleme doğrulandı. Uygulama yeniden başlatılıyor; oyunlar korunuyor.' });
            schedule(() => { diagnose({ phase: 'installer-start' }); updater.quitAndInstall(false, true); }, 1000);
            return { basarili: true };
        })().catch(error => ({ basarili: false, hata: error.message })).finally(() => { pending = null; });
        return pending;
    }
    return { check, install };
}
module.exports = { createAppUpdates };
