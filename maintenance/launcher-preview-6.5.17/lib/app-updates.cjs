'use strict';

function createAppUpdates({ app, notify }) {
    let updater;
    let checked = null;
    let downloaded = false;
    let pending = null;
    function setup() {
        if (updater) return updater;
        updater = require('electron-updater').autoUpdater;
        updater.autoDownload = false;
        updater.autoInstallOnAppQuit = false;
        updater.allowDowngrade = false;
        updater.disableWebInstaller = true;
        updater.setFeedURL({ provider: 'github', owner: 'maNgao7', repo: 'mng-license-server1' });
        updater.on('download-progress', p => notify('guncelleme-ilerleme', {
            percent: p.percent, transferredMB: (p.transferred / 1048576).toFixed(1), totalMB: (p.total / 1048576).toFixed(1),
            speedBps: p.bytesPerSecond, mesaj: 'Uygulama güncellemesi indiriliyor. Oyunlar ve ayarlar korunuyor.'
        }));
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
            const newer = checked && require('semver').gt(checked.version, currentVersion);
            return { guncellemeVar: Boolean(newer), currentVersion, latestVersion: checked?.version || currentVersion,
                changelog: typeof checked?.releaseNotes === 'string' ? [checked.releaseNotes.replace(/<[^>]*>/g, '').slice(0, 2000)] : [],
                webUrl: 'https://github.com/maNgao7/mng-license-server1/releases/latest' };
        } catch {
            return { guncellemeVar: false, currentVersion, latestVersion: currentVersion, changelog: [],
                hata: 'Güvenli güncelleme bilgisi alınamadı. Mevcut uygulama ve oyunlar değişmedi.' };
        }
    }
    async function install() {
        if (pending) return pending;
        pending = (async () => {
            if (app.isTikMNGPreview || !app.isPackaged) throw new Error('Test sürümü genel güncelleme kurmaz.');
            const result = await check();
            if (!result.guncellemeVar) throw new Error(result.hata || 'Yeni bir uygulama sürümü bulunamadı.');
            await setup().downloadUpdate();
            if (!downloaded) throw new Error('Güncelleme tamamlanmadı. Mevcut sürüm korunuyor.');
            notify('guncelleme-bitti', { mesaj: 'Güncelleme doğrulandı. Uygulama yeniden başlatılıyor; oyunlar korunuyor.' });
            setTimeout(() => updater.quitAndInstall(false, true), 1000);
            return { basarili: true };
        })().catch(error => ({ basarili: false, hata: error.message })).finally(() => { pending = null; });
        return pending;
    }
    return { check, install };
}
module.exports = { createAppUpdates };
