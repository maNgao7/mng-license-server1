const { contextBridge, ipcRenderer } = require("electron");

// =====================================================================
// PRELOAD — Güvenli IPC köprüsü
// Renderer sadece bu API'ye erişebilir, Node.js API'lerine erişemez.
// =====================================================================
contextBridge.exposeInMainWorld("mngAPI", {
    workspace: (action, data) => {
        const allowed = ['snapshot', 'refresh', 'install', 'cancel', 'remove', 'folder', 'media-import', 'media-folder', 'media-save', 'media-remove', 'media-test', 'media-remote', 'media-duplicate', 'source', 'tts'];
        if (!allowed.includes(action)) return Promise.reject(new Error('Geçersiz işlem.'));
        return ipcRenderer.invoke('workspace-' + action, data);
    },
    workspaceListen: (name, callback) => {
        if (!['progress', 'catalog', 'chat', 'media-event'].includes(name)) return () => {};
        const channel = 'workspace-' + name;
        const listener = (_event, data) => callback(data);
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
    },
    // Lisans işlemleri
    lisansDogrula: (kod) => ipcRenderer.invoke("lisans-dogrula", { kod }),
    lisansDurumu: () => ipcRenderer.invoke("lisans-durumu"),
    lisansTemizle: () => ipcRenderer.invoke("lisans-temizle"),

    // Uygulama başlatma
    uygulamaAc: (uygulama, options) => ipcRenderer.invoke("uygulamayi-ac", {
        uygulama,
        tiktokUser: typeof options === "object" ? options.tiktokUser : options,
        orbitSettings: typeof options === "object" ? options.orbitSettings : undefined,
        orbitTest: typeof options === "object" ? options.orbitTest : undefined,
        orbitTestLabel: typeof options === "object" ? options.orbitTestLabel : undefined
    }),
    orbitHediyeKatalogu: () => ipcRenderer.invoke("orbit-hediye-katalogu"),
    tiktokHesaplari: () => ipcRenderer.invoke("tiktok-hesaplari"),
    tiktokHesapKaydet: (username) => ipcRenderer.invoke("tiktok-hesap-kaydet", { username }),
    tiktokHesapSec: (username) => ipcRenderer.invoke("tiktok-hesap-sec", { username }),
    tiktokHesapSil: (username) => ipcRenderer.invoke("tiktok-hesap-sil", { username }),
    tiktokBaglan: (username) => ipcRenderer.invoke("tiktok-baglan", { username }),
    tiktokBaglantiyiKes: () => ipcRenderer.invoke("tiktok-baglantiyi-kes"),
    widgetBilgisi: () => ipcRenderer.invoke("widget-bilgisi"),
    widgetTest: () => ipcRenderer.invoke("widget-test"),
    widgetSifirla: () => ipcRenderer.invoke("widget-sifirla"),
    widgetLikeTest: () => ipcRenderer.invoke("widget-like-test"),
    widgetLikeSifirla: () => ipcRenderer.invoke("widget-like-sifirla"),
    widgetLeaderboardTest: () => ipcRenderer.invoke("widget-leaderboard-test"),
    widgetLeaderboardSifirla: () => ipcRenderer.invoke("widget-leaderboard-sifirla"),
    widgetActivitySifirla: () => ipcRenderer.invoke("widget-activity-sifirla"),
    widgetUniversalTest: (type) => ipcRenderer.invoke("widget-universal-test", { type }),
    widgetUniversalSifirla: (type) => ipcRenderer.invoke("widget-universal-reset", { type }),

    // Modüler Oyun Kurulum ve Durum Yönetimi
    oyunDurumlari: () => ipcRenderer.invoke("oyun-durumlari"),
    oyunKur: (oyun) => ipcRenderer.invoke("oyun-kur", { oyun }),
    oyunKaldir: (oyun) => ipcRenderer.invoke("oyun-kaldir", { oyun }),
    oyunKurulumIlerlemeDinle: (callback) => {
        ipcRenderer.on("oyun-kurulum-ilerleme", (event, data) => callback(data));
        return () => ipcRenderer.removeAllListeners("oyun-kurulum-ilerleme");
    },
    oyunKurulumBittiDinle: (callback) => {
        ipcRenderer.on("oyun-kurulum-bitti", (event, data) => callback(data));
        return () => ipcRenderer.removeAllListeners("oyun-kurulum-bitti");
    },

    // Yardımcılar
    hariciLinkAc: (url) => ipcRenderer.invoke("harici-link-ac", { url }),
    cihazKimlik: () => ipcRenderer.invoke("cihaz-kimlik"),
    arkaPlanVideolari: () => ipcRenderer.invoke("arka-plan-videolari"),
    onArkaPlanHazir: callback => ipcRenderer.on('arka-planlar-hazir', () => callback()),

    // Sunucudan durum olaylarını dinle
    durumDinle: (callback) => {
        ipcRenderer.on("durum", (event, data) => callback(data));
        return () => ipcRenderer.removeAllListeners("durum");
    },
    onOyunKapandi: (callback) => {
        ipcRenderer.on("oyun-kapandi", (event, data) => callback(data));
        return () => ipcRenderer.removeAllListeners("oyun-kapandi");
    },

    // Otomatik Güncelleme
    surumKontrolEt: () => ipcRenderer.invoke("surum-kontrol-et"),
    guncellemeIndirVeKur: (downloadUrl) => ipcRenderer.invoke("guncelleme-indir-ve-kur", { downloadUrl }),
    guncellemeIlerlemeDinle: (callback) => {
        ipcRenderer.on("guncelleme-ilerleme", (event, data) => callback(data));
        return () => ipcRenderer.removeAllListeners("guncelleme-ilerleme");
    },
    guncellemeBittiDinle: (callback) => {
        ipcRenderer.on("guncelleme-bitti", () => callback());
        return () => ipcRenderer.removeAllListeners("guncelleme-bitti");
    }
});
