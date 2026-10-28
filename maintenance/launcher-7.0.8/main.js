const { app, BrowserWindow, ipcMain, shell, dialog, protocol, safeStorage } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");
const https = require("https");
const http = require("http");
const os = require("os");
const crypto = require("crypto");
const startupOrigin = process.hrtime.bigint();
const startupMarks = [];
function startupMark(phase) {
    if (!process.env.MNG_QA_STARTUP_FILE) return;
    startupMarks.push({ phase, ms: Number(process.hrtime.bigint() - startupOrigin) / 1e6 });
    try { fs.writeFileSync(process.env.MNG_QA_STARTUP_FILE, JSON.stringify(startupMarks, null, 2)); } catch {}
}
startupMark('main-imported');
const preview = !process.env.MNG_TEST_PROFILE
    ? require('./lib/preview-profile.cjs').preparePreviewProfile(app, process.resourcesPath)
    : { enabled: process.argv.includes('--tikmng-preview'), root: path.resolve(process.env.MNG_TEST_PROFILE) };
app.isTikMNGPreview = preview.enabled;
if (process.env.MNG_TEST_PROFILE) {
    const testRoot = path.resolve(process.env.MNG_TEST_PROFILE);
    for (const [name, directory] of [['userData', testRoot], ['documents', path.join(testRoot, 'Documents')], ['videos', path.join(testRoot, 'Videos')]]) {
        fs.mkdirSync(directory, { recursive: true });
        app.setPath(name, directory);
    }
}
let platform = null;
let appUpdates = null;
let overlayBridge = null;
let gameWidgetHost = null;
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();mainWindow.focus();
});

let TikTokLiveConnection = null;
let WebcastEvent = {};
let widgetTikTokModulePromise = null;
async function widgetTikTokModulunuYukle() {
    if (TikTokLiveConnection) return true;
    if (!widgetTikTokModulePromise) {
        widgetTikTokModulePromise = import("tiktok-live-connector")
            .then(module => {
                TikTokLiveConnection = module.TikTokLiveConnection;
                Object.assign(WebcastEvent, module.WebcastEvent || {});
                return Boolean(TikTokLiveConnection);
            })
            .catch(error => {
                console.warn("Merkezi TikTok widget bağlantısı yüklenemedi:", error.message);
                widgetTikTokModulePromise = null;
                return false;
            });
    }
    return widgetTikTokModulePromise;
}

// Özel video protokolü ayrıcalıkları (App ready öncesi)
protocol.registerSchemesAsPrivileged([
    {
        scheme: "mng-bg",
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true
        }
    }
]);

// =====================================================================
// STORE — Lisans bilgilerini güvenli şekilde sakla
// =====================================================================
let Store;
try {
    Store = require("electron-store");
} catch (e) {
    Store = class {
        constructor() {
            this._file = path.join(app.getPath("userData"), "config.json");
            try { this._data = JSON.parse(fs.readFileSync(this._file, "utf-8")); } catch { this._data = {}; }
        }
        get(k, def) { return this._data[k] !== undefined ? this._data[k] : def; }
        set(k, v) { if (k && typeof k === 'object') Object.assign(this._data, k); else this._data[k] = v; fs.writeFileSync(this._file, JSON.stringify(this._data)); }
        delete(k) { delete this._data[k]; fs.writeFileSync(this._file, JSON.stringify(this._data)); }
    };
}

const store = require('./lib/cached-store.cjs').createCachedStore(new Store({
    name: "mng-config",
    encryptionKey: "mng-electron-secret-key-2024"
}));
require('./lib/preview-profile.cjs').initializePreviewStore(store, preview);
startupMark('store-ready');

const WIDGET_PORT = Number(process.env.MNG_WIDGET_PORT) || (preview.enabled ? 31976 : 31975);
const ARKA_PLAN_PAKET_SURUMU = "6.5.5";
const GELENE_GECENE_SURUMU = "6.5.0";
const GELENE_GECENE_PAKET_REVIZYONU = "650.0";
let widgetServer = null;
let widgetLiveSession = null;
let widgetLiveStatus = { status: "disconnected", username: "", message: "Yayıncı hesabı bekleniyor." };
const widgetRecentEvents = new Map(store.get('widget_event_receipts_v2', []));
const widgetKanaliniTemizle = value => String(value || "varsayilan").replace(/^@/, "").trim().toLocaleLowerCase("tr-TR").replace(/[^a-z0-9._-]/g, "_") || "varsayilan";
let widgetChannel = widgetKanaliniTemizle(store.get("tiktok_active_account", ""));
const widgetStoreKey = (base, channel = widgetChannel) => `${base}__${widgetKanaliniTemizle(channel)}`;
let widgetPool = store.get(widgetStoreKey("widget_top_gifts"), store.get("widget_top_gifts", {}));
let widgetLikePool = store.get(widgetStoreKey("widget_top_likes"), store.get("widget_top_likes", {}));
let widgetLeaderboardPool = store.get(widgetStoreKey("widget_leaderboard"), store.get("widget_leaderboard", {}));
let widgetActivityPool = store.get(widgetStoreKey("widget_activity"), store.get("widget_activity", []));
let widgetJarPool = store.get(widgetStoreKey("widget_jar_gifts"), []);
let widgetMetaPool = store.get(widgetStoreKey("widget_meta"), store.get("widget_meta", {
    totalLikes: 0,
    totalCoins: 0,
    totalGifts: 0,
    totalShares: 0,
    followers: 0,
    subscribers: 0,
    viewerCount: 0,
    topStreak: null
}));

const WIDGET_DEFINITIONS = [
    { id: "likefountain", name: "Beğeni Şelalesi", kind: "BEĞENİ", description: "Beğeniler geldikçe ekranda yükselen kalpler oluşturur." },
    { id: "topgift", name: "Viral Benim", kind: "HEDİYE", description: "Yayının en değerli hediyesini; gönderenin dönen büyük profili, hediye görseli ve coin değeriyle gösterir." },
    { id: "carousel", name: "Etkileşim Şeridi", kind: "TANITIM", description: "Canlı yayın etkinliklerini ve hediye görevlerini kayan şeritte gösterir." },
    { id: "wheel", name: "Şans Çarkı", kind: "OYUN", description: "Tetiklendiğinde renkli çarkı döndürür ve sonucu yayında gösterir." },
    { id: "topgifter", name: "Coin Sıralaması", kind: "SIRALAMA", description: "Destekçileri profil, kullanıcı adı ve toplam coin ile tek bir sıralamada gösterir." },
    { id: "topliker", name: "Beğeni Sıralaması", kind: "SIRALAMA", description: "Beğenileri anlık güncellenen profil ve puan listesinde gösterir." },
    { id: "coindrop", name: "Coin Yağmuru", kind: "ANİMASYON", description: "Hediye geldiğinde ekrana toplanabilir görünen coinler yağdırır." },
    { id: "timer", name: "Yayın Sayacı", kind: "SAYAÇ", description: "Yayında kullanılabilen temiz ve özelleştirilebilir geri sayım gösterir." },
    { id: "viewercount", name: "İzleyici Sayısı", kind: "CANLI", description: "Anlık izleyici sayısını sade ve okunaklı biçimde gösterir." },
    { id: "streambuddies", name: "Yayın Arkadaşları", kind: "PROFİL", description: "En iyi destekçilerin profillerini ekranda hareket eden karakterlere dönüştürür." },
    { id: "coinjar", name: "Hediye Kavanozu", kind: "HEDİYE", description: "Gelen hediye görsellerini şeffaf bir kavanoz içinde biriktirir." }
];

function widgetHavuzlariniKaydet() {
    const values = {
        [widgetStoreKey("widget_top_gifts")]: widgetPool,
        [widgetStoreKey("widget_top_likes")]: widgetLikePool,
        [widgetStoreKey("widget_leaderboard")]: widgetLeaderboardPool,
        [widgetStoreKey("widget_activity")]: widgetActivityPool,
        [widgetStoreKey("widget_jar_gifts")]: widgetJarPool,
        [widgetStoreKey("widget_meta")]: widgetMetaPool
    };
    store.set(values);
}

function widgetKanaliniDegistir(channel) {
    widgetHavuzlariniKaydet();
    widgetChannel = widgetKanaliniTemizle(channel);
    overlayBridge?.start(widgetChannel);
    widgetPool = store.get(widgetStoreKey("widget_top_gifts"), {});
    widgetLikePool = store.get(widgetStoreKey("widget_top_likes"), {});
    widgetLeaderboardPool = store.get(widgetStoreKey("widget_leaderboard"), {});
    widgetActivityPool = store.get(widgetStoreKey("widget_activity"), []);
    widgetJarPool = store.get(widgetStoreKey("widget_jar_gifts"), []);
    widgetMetaPool = store.get(widgetStoreKey("widget_meta"), {
        totalLikes: 0, totalCoins: 0, totalGifts: 0, totalShares: 0,
        followers: 0, subscribers: 0, viewerCount: 0, topStreak: null
    });
    onIzlemeArsiviniHazirla();
}

function widgetKanalHavuzu(base, channel, livePool) {
    const clean = widgetKanaliniTemizle(channel);
    return clean === widgetChannel ? livePool : store.get(widgetStoreKey(base, clean), {});
}

function widgetErisimAnahtariniBul() {
    const testKey = String(process.env.MNG_WIDGET_ACCESS_KEY || "").trim();
    if (/^[a-f0-9]{32}$/.test(testKey)) return testKey;
    const saved = String(store.get("widget_access_key", "")).trim();
    if (/^[a-f0-9]{32}$/.test(saved)) return saved;
    const created = crypto.randomBytes(16).toString("hex");
    store.set("widget_access_key", created);
    return created;
}

const WIDGET_ACCESS_KEY = widgetErisimAnahtariniBul();
const widgetStudioModule = require('./lib/widget-studio.cjs');
const widgetStudio = widgetStudioModule.createStudio(store, widgetHediyeGorseliBul);
const studioDefinitions = widgetStudioModule.definitions;
for (const item of studioDefinitions) {
    const index = WIDGET_DEFINITIONS.findIndex(existing => existing.id === item.id);
    if (index >= 0) WIDGET_DEFINITIONS[index] = item;
    else WIDGET_DEFINITIONS.push(item);
}
WIDGET_DEFINITIONS.sort((a, b) => Number(widgetStudioModule.royalIds.has(b.id)) - Number(widgetStudioModule.royalIds.has(a.id)));

function widgetYerelUrl(pathname, hostname = "127.0.0.1", channel = widgetChannel) {
    return `http://${hostname}:${WIDGET_PORT}${pathname}?key=${WIDGET_ACCESS_KEY}&channel=${encodeURIComponent(widgetKanaliniTemizle(channel))}`;
}

function widgetKatmanUrl(type, hostname = "127.0.0.1", channel = widgetChannel) {
    const route = ["topgifter", "topliker"].includes(type) ? "/widget-leaderboard.html" : "/widget-overlay.html";
    const url = new URL(widgetYerelUrl(route, hostname, channel));
    url.searchParams.set("type", String(type || "myactions"));
    return url.href;
}

function widgetErisimineIzinVar(requestUrl) {
    const supplied = String(requestUrl.searchParams.get("key") || "");
    if (supplied.length !== WIDGET_ACCESS_KEY.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(WIDGET_ACCESS_KEY));
    } catch {
        return false;
    }
}

// Eski sürüm kişilerin coinlerini topluyordu. 6.0.5 tek bir hediye olayının
// rekorunu tuttuğu için örnek/eski havuzu bir kez temizleyerek yeni şemaya geçer.
if (!store.get("widget_gift_v605_migrated", false)) {
    widgetPool = {};
    store.set("widget_top_gifts", widgetPool);
    store.set("widget_gift_v605_migrated", true);
}

function widgetGorselAdresiniDuzelt(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
        const parsed = new URL(raw);
        const localProxy = ["127.0.0.1", "localhost"].includes(parsed.hostname) && parsed.pathname === "/api/gift-image";
        return localProxy ? String(parsed.searchParams.get("url") || raw) : raw;
    } catch {
        return raw;
    }
}

let widgetGiftCatalogCache = null;
function widgetHediyeGorseliBul(giftName, giftId) {
    try {
        if (!widgetGiftCatalogCache) {
            const roots = [
                path.join(__dirname, "renderer", "gift-assets"),
                path.join(__dirname, "..", "apps", "tiktok-vs", "public", "assets", "gift-images"),
                path.join(process.resourcesPath || "", "apps", "tiktok-vs", "public", "assets", "gift-images")
            ];
            const root = roots.find(dir => fs.existsSync(path.join(dir, "katalog_tam.json")));
            const list = root ? JSON.parse(fs.readFileSync(path.join(root, "katalog_tam.json"), "utf8")) : [];
            widgetGiftCatalogCache = { root, list };
        }
        const wanted = String(giftName || "").trim().toLocaleLowerCase("tr-TR");
        const gift = (giftId && widgetGiftCatalogCache.list.find(item => String(item.id) === String(giftId))) ||
            widgetGiftCatalogCache.list.find(item =>
                [item.name, item.trName, ...(item.keywords || [])].some(name => String(name || "").trim().toLocaleLowerCase("tr-TR") === wanted)
            );
        return gift?.file ? widgetYerelUrl(`/widget/gift-assets/${encodeURIComponent(gift.file)}`) : "";
    } catch {
        return "";
    }
}

function widgetLeaderboardKaydiEkle(payload = {}) {
    const username = String(payload.username || payload.nickname || "izleyici").replace(/^@/, "").trim() || "izleyici";
    const key = username.toLocaleLowerCase("tr-TR");
    const coins = Math.max(1, Number(payload.coins ?? payload.totalCoins) || 1);
    const count = Math.max(1, Number(payload.count ?? payload.repeatCount ?? 1));
    const current = widgetLeaderboardPool[key] || { username, nickname: username, totalCoins: 0, giftCount: 0, avatar: "" };
    current.username = username;
    current.nickname = String(payload.nickname || current.nickname || username);
    current.totalCoins = (Number(current.totalCoins) || 0) + coins;
    current.giftCount = (Number(current.giftCount) || 0) + count;
    current.avatar = String(payload.avatar || payload.profilePictureUrl || current.avatar || "");
    current.updatedAt = Date.now();
    widgetLeaderboardPool[key] = current;
    store.set(widgetStoreKey("widget_leaderboard"), widgetLeaderboardPool);
    return current;
}

function widgetLeaderboardDurumu(pool = widgetLeaderboardPool) {
    const entries = Object.values(pool)
        .sort((a, b) => (b.totalCoins || 0) - (a.totalCoins || 0) || (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 13);
    return { entries, updatedAt: Date.now() };
}

function widgetKaydiEkle(payload = {}) {
    const username = String(payload.username || payload.nickname || "izleyici").replace(/^@/, "").trim() || "izleyici";
    const coins = Math.max(0, Number(payload.coins ?? payload.totalCoins) || 0);
    const count = Math.max(1, Number(payload.count ?? payload.repeatCount ?? 1));
    widgetLeaderboardKaydiEkle(payload);
    widgetEtkinligiEkle("gift", payload);
    widgetMetaPool.totalCoins = (Number(widgetMetaPool.totalCoins) || 0) + coins;
    widgetMetaPool.totalGifts = (Number(widgetMetaPool.totalGifts) || 0) + count;
    const streak = Math.max(1, Number(payload.repeatCount ?? payload.count) || 1);
    if (!widgetMetaPool.topStreak || streak > Number(widgetMetaPool.topStreak.count || 0)) {
        widgetMetaPool.topStreak = {
            username,
            nickname: String(payload.nickname || username),
            avatar: String(payload.avatar || payload.profilePictureUrl || ""),
            giftName: String(payload.giftName || "Hediye"),
            giftImage: widgetHediyeGorseliBul(payload.giftName, payload.giftId) || widgetGorselAdresiniDuzelt(payload.giftImage),
            count: streak,
            updatedAt: Date.now()
        };
    }
    store.set(widgetStoreKey("widget_meta"), widgetMetaPool);
    const next = {
        username,
        nickname: String(payload.nickname || username),
        count,
        repeatCount: count,
        coins,
        totalCoins: coins,
        giftId: String(payload.giftId || ''),
        giftName: String(payload.giftName || "Hediye"),
        giftImage: widgetHediyeGorseliBul(payload.giftName, payload.giftId) || widgetGorselAdresiniDuzelt(payload.giftImage),
        avatar: String(payload.avatar || payload.profilePictureUrl || ""),
        updatedAt: Date.now()
    };
    widgetPool = require('./lib/top-gift.cjs').recordTopGift(widgetPool, { ...next, giftType: payload.giftType, repeatEnd: payload.repeatEnd });
    store.set(widgetStoreKey("widget_top_gifts"), widgetPool);
    return widgetPool.champion;
}

function widgetDurumu(pool = widgetPool) {
    const top = require('./lib/top-gift.cjs').topGiftState(pool).champion;
    const entries = top ? [{ ...top, giftImage: widgetGorselAdresiniDuzelt(top.giftImage) }] : [];
    return { top: entries[0] || null, entries };
}

function widgetBegeniKaydiEkle(payload = {}) {
    const username = String(payload.username || payload.nickname || "izleyici").replace(/^@/, "").trim() || "izleyici";
    const key = username.toLocaleLowerCase("tr-TR");
    const count = Math.max(1, Number(payload.likeCount ?? payload.count) || 1);
    const current = widgetLikePool[key] || { username, nickname: username, totalLikes: 0, avatar: "" };
    current.username = username;
    current.nickname = String(payload.nickname || current.nickname || username);
    current.totalLikes += count;
    current.avatar = String(payload.avatar || payload.profilePictureUrl || current.avatar || "");
    current.updatedAt = Date.now();
    widgetLikePool[key] = current;
    store.set(widgetStoreKey("widget_top_likes"), widgetLikePool);
    widgetEtkinligiEkle("like", { ...payload, username, nickname: current.nickname, avatar: current.avatar, count });
    widgetMetaPool.totalLikes = (Number(widgetMetaPool.totalLikes) || 0) + count;
    store.set(widgetStoreKey("widget_meta"), widgetMetaPool);
    return current;
}

function widgetBegeniDurumu(pool = widgetLikePool) {
    const entries = Object.values(pool)
        .sort((a, b) => (b.totalLikes || 0) - (a.totalLikes || 0) || (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 13);
    return { entries, updatedAt: Date.now() };
}

function widgetEtkinligiEkle(type, payload = {}) {
    const username = String(payload.username || payload.nickname || "izleyici").replace(/^@/, "").trim() || "izleyici";
    const item = {
        id: (payload.eventId || payload.msgId || payload.common?.msgId || payload.logId || payload.id) ? `live-${crypto.createHash('sha256').update(widgetOlayParmakIzi(type, payload)).digest('hex')}` : `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        type,
        username,
        nickname: String(payload.nickname || username),
        avatar: String(payload.avatar || payload.profilePictureUrl || ""),
        giftName: String(payload.giftName || "Hediye"),
        giftImage: widgetHediyeGorseliBul(payload.giftName, payload.giftId) || widgetGorselAdresiniDuzelt(payload.giftImage),
        coins: Math.max(0, Number(payload.coins ?? payload.totalCoins) || 0),
        giftId: String(payload.giftId || ''),
        count: Math.max(1, Number(payload.count ?? payload.repeatCount ?? payload.likeCount) || 1),
        message: String(payload.message || payload.comment || payload.text || "").slice(0, 240),
        points: Math.max(0, Number(payload.points ?? payload.score) || 0),
        viewerCount: Math.max(0, Number(payload.viewerCount ?? payload.viewers) || 0),
        createdAt: Date.now()
    };
    widgetStudio.ingest(widgetChannel, item);
    widgetActivityPool = [item, ...widgetActivityPool].slice(0, 120);
    store.set(widgetStoreKey("widget_activity"), widgetActivityPool);
    if (type === "gift") {
        widgetJarPool = [...Array(Math.min(item.count, 100)).keys()].map(index => ({ ...item, id: `${item.id}-${index}` })).concat(widgetJarPool).slice(0, 240);
        store.set(widgetStoreKey("widget_jar_gifts"), widgetJarPool);
    }
    return item;
}

function widgetEtkinlikDurumu(pool = widgetActivityPool) {
    return { entries: Array.isArray(pool) ? pool.slice(0, 20) : [], updatedAt: Date.now() };
}

function widgetOlayParmakIzi(type, payload = {}) {
    const directId = payload.eventId || payload.msgId || payload.common?.msgId || payload.logId || payload.id;
    if (directId) return JSON.stringify([widgetChannel, type, 'id', String(directId)]);
    const username = String(payload.username || payload.uniqueId || payload.nickname || "").toLocaleLowerCase("tr-TR");
    const subject = String(payload.giftId || payload.giftName || payload.message || payload.comment || "").toLocaleLowerCase("tr-TR");
    const amount = Number(payload.coins ?? payload.totalCoins ?? payload.likeCount ?? payload.count ?? 0) || 0;
    return JSON.stringify([widgetChannel, type, 'fallback', username, subject, amount, Math.floor(Date.now() / 1800)]);
}

function widgetOlayTekrariMi(type, payload = {}) {
    const now = Date.now();
    const identified = Boolean(payload.eventId || payload.msgId || payload.common?.msgId || payload.logId || payload.id);
    const fingerprint = (identified ? 'id:' : 'fallback:') + crypto.createHash('sha256').update(widgetOlayParmakIzi(type, payload)).digest('hex');
    const previous = widgetRecentEvents.get(fingerprint);
    // Persist source IDs, never comment text. ID-less compatibility events only debounce.
    if (previous !== undefined && now - previous < (identified ? 7 * 86400000 : 2600)) return true;
    widgetRecentEvents.delete(fingerprint);
    widgetRecentEvents.set(fingerprint, now);
    for (const [key, createdAt] of widgetRecentEvents) if (now - createdAt >= (key.startsWith('id:') ? 7 * 86400000 : 2600)) widgetRecentEvents.delete(key);
    while (widgetRecentEvents.size > 16384) widgetRecentEvents.delete(widgetRecentEvents.keys().next().value);
    if (identified) store.set('widget_event_receipts_v2', [...widgetRecentEvents].filter(([key]) => key.startsWith('id:')));
    return false;
}

function widgetGenelOlayEkle(type, payload = {}) {
    const normalized = String(type || payload.type || payload.event || "action").toLocaleLowerCase("tr-TR");
    const giftType = payload.giftType ?? payload.gift?.type ?? payload.gift?.giftType ?? payload.giftDetails?.giftType ?? payload.extendedGiftInfo?.giftType ?? payload.extendedGiftInfo?.type;
    if (normalized === 'gift' && Number(giftType) === 1 && ![true, 1, '1', 'true'].includes(payload.repeatEnd)) return null;
    if (widgetOlayTekrariMi(normalized, payload)) return null;
    platform?.ingest(normalized, payload, widgetChannel);
    if (normalized === "gift") return widgetKaydiEkle(payload);
    if (normalized === "like") return widgetBegeniKaydiEkle(payload);
    const amount = Math.max(1, Number(payload.count ?? payload.shareCount) || 1);
    if (normalized === "follow") widgetMetaPool.followers = (Number(widgetMetaPool.followers) || 0) + 1;
    if (normalized === "share") widgetMetaPool.totalShares = (Number(widgetMetaPool.totalShares) || 0) + amount;
    if (["subscribe", "subscription", "subscriber"].includes(normalized)) widgetMetaPool.subscribers = (Number(widgetMetaPool.subscribers) || 0) + 1;
    if (["viewer", "viewercount", "roomuser"].includes(normalized)) {
        widgetMetaPool.viewerCount = Math.max(0, Number(payload.viewerCount ?? payload.viewers ?? payload.count) || 0);
    }
    widgetMetaPool.updatedAt = Date.now();
    store.set(widgetStoreKey("widget_meta"), widgetMetaPool);
    return widgetEtkinligiEkle(normalized, payload);
}

function widgetSahnesiniSifirla(type, screen) {
    widgetStudio.reset(widgetChannel, type, screen, { ...widgetMetaPool, topGifters: Object.values(widgetLeaderboardPool), topLikes: Object.values(widgetLikePool) });
    if (type === 'topgift') { widgetPool = {}; store.set(widgetStoreKey('widget_top_gifts'), widgetPool); }
}

function widgetBirlesikDurum(channel = widgetChannel) {
    const activitiesRaw = widgetKanalHavuzu("widget_activity", channel, widgetActivityPool);
    const metaRaw = widgetKanalHavuzu("widget_meta", channel, widgetMetaPool);
    const giftRaw = widgetKanalHavuzu("widget_top_gifts", channel, widgetPool);
    const likeRaw = widgetKanalHavuzu("widget_top_likes", channel, widgetLikePool);
    const leadersRaw = widgetKanalHavuzu("widget_leaderboard", channel, widgetLeaderboardPool);
    const activities = Array.isArray(activitiesRaw) ? activitiesRaw.slice(0, 120) : [];
    const topLikes = widgetBegeniDurumu(likeRaw && typeof likeRaw === "object" ? likeRaw : {}).entries;
    const topGifters = widgetLeaderboardDurumu(leadersRaw && typeof leadersRaw === "object" ? leadersRaw : {}).entries;
    const topGift = widgetDurumu(giftRaw && typeof giftRaw === "object" ? giftRaw : {}).top;
    const meta = metaRaw && typeof metaRaw === "object" && !Array.isArray(metaRaw) ? metaRaw : {};
    const oldLikeTotal = topLikes.reduce((total, item) => total + Number(item.totalLikes || 0), 0);
    const oldCoinTotal = topGifters.reduce((total, item) => total + Number(item.totalCoins || 0), 0);
    const oldGiftTotal = topGifters.reduce((total, item) => total + Number(item.giftCount || 0), 0);
    const combined = new Map();
    for (const item of topGifters) combined.set(item.username.toLocaleLowerCase("tr-TR"), { ...item, score: Number(item.totalCoins || 0) * 2 });
    for (const item of topLikes) {
        const key = item.username.toLocaleLowerCase("tr-TR");
        const current = combined.get(key) || { ...item, totalCoins: 0, giftCount: 0, score: 0 };
        current.totalLikes = item.totalLikes;
        current.avatar ||= item.avatar;
        current.score = Number(current.score || 0) + Math.floor(Number(item.totalLikes || 0) / 50);
        combined.set(key, current);
    }
    return {
        channel: widgetKanaliniTemizle(channel),
        studio: widgetStudio.state(channel),
        activities,
        jarGifts: widgetKanalHavuzu("widget_jar_gifts", channel, widgetJarPool),
        topGift,
        topLikes,
        topGifters,
        ranking: [...combined.values()].sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 13),
        stats: {
            totalLikes: Number(meta.totalLikes || oldLikeTotal),
            totalCoins: Number(meta.totalCoins || oldCoinTotal),
            totalGifts: Number(meta.totalGifts || oldGiftTotal),
            totalShares: Number(meta.totalShares || 0),
            followers: Number(meta.followers || 0),
            subscribers: Number(meta.subscribers || 0),
            viewerCount: Number(meta.viewerCount || 0),
            topStreak: meta.topStreak || null
        },
        updatedAt: Math.max(Number(meta.updatedAt || 0), Number(activities[0]?.createdAt || 0), Number(topGift?.updatedAt || 0))
    };
}

function widgetEulerAnahtariniBul() {
    const environmentKey = String(process.env.EULER_API_KEY || '').trim();
    if (environmentKey && environmentKey !== 'undefined') return environmentKey;
    const candidates = [
        path.join(__dirname, "..", "apps", "tiktok-vs", "euler-api-key.txt"),
        path.join(process.resourcesPath || "", "apps", "tiktok-vs", "euler-api-key.txt")
    ];
    for (const file of candidates) {
        try {
            if (!fs.existsSync(file)) continue;
            const value = fs.readFileSync(file, 'utf8').trim();
            if (value && value !== 'undefined') return value;
        } catch {}
    }
    return "";
}

function widgetTikTokProfiliniOku(data = {}) {
    const user = data.user || data.userInfo || data;
    const username = String(user.uniqueId || user.displayId || user.username || data.uniqueId || data.displayId || data.username || user.nickname || data.nickname || "izleyici").replace(/^@/, "").trim();
    const avatarLists = [
        user.avatarLarge?.urlList, user.avatar_large?.url_list, data.avatarLarge?.urlList, data.avatar_large?.url_list,
        user.avatarMedium?.urlList, user.avatar_medium?.url_list, data.avatarMedium?.urlList, data.avatar_medium?.url_list,
        user.profilePictureUrls, data.profilePictureUrls, user.avatarThumb?.urlList, user.avatar_thumb?.url_list
    ];
    const avatar = avatarLists.flatMap(value => Array.isArray(value) ? value : []).find(Boolean) || String(user.avatar || data.avatar || user.profilePictureUrl || data.profilePictureUrl || "");
    return { username, nickname: String(user.nickname || data.nickname || username), avatar,
        fanClubLevel: require('./lib/tts-audience.cjs').extractFanClubLevel(data) };
}

function widgetTikTokHediyesiniOku(data = {}) {
    const gift = data.gift || data.extendedGiftInfo || {};
    const repeatCount = Math.max(1, Number(data.repeatCount || data.count || 1));
    const diamondCount = Math.max(0, Number(data.diamondCount ?? gift.diamondCount ?? gift.diamond_count) || 0);
    const imageLists = [gift.image?.urlList, gift.icon?.urlList, gift.image?.url_list, data.giftPictureUrl ? [data.giftPictureUrl] : []];
    return {
        giftId: String(data.giftId || gift.id || ""),
        giftName: String(data.giftName || gift.name || "Hediye"),
        giftImage: imageLists.flatMap(value => Array.isArray(value) ? value : []).find(Boolean) || "",
        repeatCount,
        count: repeatCount,
        coins: diamondCount * repeatCount,
        eventId: data.eventId || data.msgId || data.common?.msgId || data.logId || ""
    };
}

function widgetTikTokYenidenBaglan(username) {
    if (app.isQuiting) return Promise.resolve(widgetLiveStatus);
    if (!widgetLiveSession) widgetLiveSession = require('./lib/live-session.cjs').createLiveSession({
        events: WebcastEvent,
        createConnection: async clean => {
            if (!await widgetTikTokModulunuYukle()) throw new Error('TikTok module unavailable');
            const options = { processInitialData: false, enableExtendedGiftInfo: false };
            const signApiKey = widgetEulerAnahtariniBul();
            if (signApiKey) options.signApiKey = signApiKey;
            return new TikTokLiveConnection(clean, options);
        },
        onStatus: status => {
            if (['stream-ended', 'offline'].includes(status.reason) && widgetKanaliniTemizle(status.username) === widgetChannel && widgetDurumu().top) widgetSahnesiniSifirla('topgift');
            if (status.status === 'connected' && status.roomId && widgetKanaliniTemizle(status.username) === widgetChannel) {
                platform?.beginLive(widgetChannel,status.roomId);
                widgetStudio.beginSession(widgetChannel, status.roomId, previous => {
                    store.set(widgetStoreKey('widget_previous_session_v1'), { session: previous, gifts: widgetPool, likes: widgetLikePool, leaderboard: widgetLeaderboardPool, activities: widgetActivityPool, jarGifts: widgetJarPool, stats: widgetMetaPool });
                    widgetPool = {}; widgetLikePool = {}; widgetLeaderboardPool = {};
                    widgetActivityPool = []; widgetJarPool = [];
                    widgetMetaPool = { totalLikes: 0, totalCoins: 0, totalGifts: 0, totalShares: 0, followers: 0, subscribers: 0, viewerCount: 0, topStreak: null };
                    widgetHavuzlariniKaydet();
                });
            }
            widgetLiveStatus = status;
            mainWindow?.webContents.send('workspace-live', status);
        },
        onEvent: (type, data) => {
            const profile = widgetTikTokProfiliniOku(data), eventId = data.eventId || data.msgId || data.common?.msgId || data.logId || '';
            if (type === 'gift') widgetGenelOlayEkle(type, { ...profile, ...widgetTikTokHediyesiniOku(data) });
            else if (type === 'like') widgetGenelOlayEkle(type, { ...profile, likeCount: Math.max(1, Number(data.likeCount || data.count || 1)), eventId });
            else if (type === 'chat') widgetGenelOlayEkle(type, { ...profile, message: data.content ?? data.comment ?? data.message ?? '', eventId });
            else if (type === 'viewer') widgetGenelOlayEkle(type, { viewerCount: Math.max(0, Number(data.viewerCount ?? data.viewer_count ?? data.total ?? 0)), eventId });
            else widgetGenelOlayEkle(type, { ...profile, eventId });
        }
    });
    return widgetLiveSession.start(username);
}

async function widgetTikTokBaglantisiniKapat(message = "Bağlantı kapatıldı.") {
    widgetLiveSession?.stop();
    widgetLiveStatus = { status: 'disconnected', username: '', message, nextRetryAt: null };
    mainWindow?.webContents.send('workspace-live', widgetLiveStatus);
}

async function widgetTikTokBagla(username) {
    const clean = String(username || '').replace(/^@/, '').trim();
    if (!clean) return widgetTikTokBaglantisiniKapat('Yayıncı hesabı bekleniyor.');
    return widgetTikTokYenidenBaglan(clean);
}

function widgetSunucusunuBaslat() {
    if (widgetServer) return;
    widgetServer = http.createServer((req, res) => {
        const remoteAddress = String(req.socket.remoteAddress || "");
        const isLoopback = remoteAddress === "::1" || remoteAddress === "127.0.0.1" || remoteAddress === "::ffff:127.0.0.1";
        if (!isLoopback) {
            res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
            return res.end("Widget sunucusuna yalnizca bu bilgisayardan erisilebilir.");
        }
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
        const requestUrl = new URL(req.url, `http://127.0.0.1:${WIDGET_PORT}`);
        const p = requestUrl.pathname;
        const isReadRequest = req.method === "GET" || req.method === "HEAD";
        if (platform?.handleRequest(req, res, requestUrl)) return;
        if (isReadRequest && ['/widget/vendor/matter.js', '/widget/physical-jar.js'].includes(p)) {
            const file = path.join(__dirname, 'renderer', 'widgets', p.endsWith('matter.js') ? 'vendor/matter.js' : 'physical-jar.js');
            res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=86400' });
            return fs.createReadStream(file).pipe(res);
        }
        let refererChannel = "";
        try {
            refererChannel = new URL(String(req.headers.referer || ""), `http://127.0.0.1:${WIDGET_PORT}`).searchParams.get("channel") || "";
        } catch {}
        const requestedChannel = widgetKanaliniTemizle(requestUrl.searchParams.get("channel") || refererChannel || widgetChannel);
        const protectedWidgetRequest = isReadRequest && (
            p.startsWith("/widget/") ||
            p.startsWith("/widget-") ||
            p.startsWith("/api/widget/")
        );
        if (protectedWidgetRequest && !widgetErisimineIzinVar(requestUrl)) {
            res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
            return res.end("Bu widget baglantisi bu kuruluma ait degil.");
        }
        if (typeof gameWidgetHost !== 'undefined' && gameWidgetHost?.handleRequest(req, res, requestUrl, requestedChannel)) return;
        if (isReadRequest && (p === "/widget/top-gift" || p === "/widget-top-gift.html" || p === "/widget/top-gift.html")) {
            const file = path.join(__dirname, "renderer", "widgets", "top-gift.html");
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
            return res.end(fs.readFileSync(file));
        }
        if (isReadRequest && (p === "/widget/top-gift/state" || p === "/api/widget/top-gift/state")) {
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
            return res.end(JSON.stringify(widgetDurumu(widgetKanalHavuzu("widget_top_gifts", requestedChannel, widgetPool))));
        }
        if (isReadRequest && (p === "/widget/top-likes" || p === "/widget-top-likes.html" || p === "/widget/top-likes.html")) {
            const file = path.join(__dirname, "renderer", "widgets", "leaderboard.html");
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
            return res.end(fs.readFileSync(file));
        }
        if (isReadRequest && (p === "/widget/top-likes/state" || p === "/api/widget/top-likes/state")) {
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
            return res.end(JSON.stringify(widgetBegeniDurumu(widgetKanalHavuzu("widget_top_likes", requestedChannel, widgetLikePool))));
        }
        if (isReadRequest && (p === "/widget/leaderboard" || p === "/widget-leaderboard.html" || p === "/widget/leaderboard.html")) {
            const name = widgetStudioModule.ids.has(requestUrl.searchParams.get('type')) ? 'reference-widgets.html' : 'leaderboard.html';
            const file = path.join(__dirname, "renderer", "widgets", name);
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
            return res.end(fs.readFileSync(file));
        }
        if (isReadRequest && (p === "/widget/leaderboard/state" || p === "/api/widget/leaderboard/state")) {
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
            return res.end(JSON.stringify(widgetLeaderboardDurumu(widgetKanalHavuzu("widget_leaderboard", requestedChannel, widgetLeaderboardPool))));
        }
        if (isReadRequest && (p === "/widget/gift-feed" || p === "/widget-gift-feed.html" || p === "/widget/gift-feed.html")) {
            const file = path.join(__dirname, "renderer", "widgets", "gift-feed.html");
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
            return res.end(fs.readFileSync(file));
        }
        if (isReadRequest && (p === "/widget/activity" || p === "/widget-activity.html" || p === "/widget/activity.html")) {
            const file = path.join(__dirname, "renderer", "widgets", "activity.html");
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
            return res.end(fs.readFileSync(file));
        }
        if (isReadRequest && (p === "/widget/activity/state" || p === "/api/widget/activity/state")) {
            const pool = widgetKanalHavuzu("widget_activity", requestedChannel, widgetActivityPool);
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
            return res.end(JSON.stringify(widgetEtkinlikDurumu(Array.isArray(pool) ? pool : [])));
        }
        if (isReadRequest && (p === "/widget/overlay" || p === "/widget-overlay.html" || p === "/widget/overlay.html")) {
            const type = requestUrl.searchParams.get('type');
            const name = widgetStudioModule.royalIds.has(type) ? 'royal-widgets.html' : widgetStudioModule.ids.has(type) ? 'reference-widgets.html' : 'overlay.html';
            const file = path.join(__dirname, "renderer", "widgets", name);
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
            return res.end(fs.readFileSync(file));
        }
        if (isReadRequest && p === "/assets/widgets/glass-gift-jar.png") {
            const file = path.join(__dirname, "renderer", "assets", "widgets", "glass-gift-jar.png");
            if (!fs.existsSync(file)) { res.writeHead(404); return res.end("not found"); }
            res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" });
            return fs.createReadStream(file).pipe(res);
        }
        if (isReadRequest && (p === "/widget/state" || p === "/api/widget/state")) {
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
            const state = widgetBirlesikDurum(requestedChannel);
            if (!["coinjar", "giftpusher"].includes(requestUrl.searchParams.get("type"))) state.jarGifts = [];
            return res.end(JSON.stringify(state));
        }
        if (isReadRequest && requestUrl.pathname.startsWith("/widget/gift-assets/")) {
            const fileName = path.basename(decodeURIComponent(requestUrl.pathname.split("/").pop() || ""));
            if (['royal-racon.png', 'royal-beauty.png', 'royal-handsome.png', 'royal-demo.png'].includes(fileName)) {
                const file = path.join(__dirname, 'renderer', 'widgets', 'royal-assets', fileName);
                res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
                return fs.createReadStream(file).pipe(res);
            }
            const root = widgetGiftCatalogCache?.root || path.join(__dirname, "renderer", "gift-assets");
            const file = path.join(root, fileName);
            if (!fileName || !fs.existsSync(file)) { res.writeHead(404); return res.end("not found"); }
            const ext = path.extname(fileName).toLowerCase();
            const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "image/jpeg";
            res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "public, max-age=86400" });
            return fs.createReadStream(file).pipe(res);
        }
        if (req.method === "POST" && requestUrl.pathname === "/api/widget/gift") {
            let body = "";
            req.on("data", chunk => { if (body.length < 1024 * 1024) body += chunk; });
            req.on("end", () => {
                try { widgetGenelOlayEkle("gift", JSON.parse(body || "{}")); res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true })); }
                catch { res.writeHead(400); res.end("bad request"); }
            });
            return;
        }
        if (req.method === "POST" && requestUrl.pathname === "/api/widget/like") {
            let body = "";
            req.on("data", chunk => { if (body.length < 1024 * 1024) body += chunk; });
            req.on("end", () => {
                try { widgetGenelOlayEkle("like", JSON.parse(body || "{}")); res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true })); }
                catch { res.writeHead(400); res.end("bad request"); }
            });
            return;
        }
        if (req.method === "POST" && requestUrl.pathname === "/api/widget/event") {
            let body = "";
            req.on("data", chunk => { if (body.length < 32768) body += chunk; });
            req.on("end", () => {
                try {
                    const payload = JSON.parse(body || "{}");
                    widgetGenelOlayEkle(payload.type || payload.event, payload);
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ ok: true }));
                } catch {
                    res.writeHead(400);
                    res.end();
                }
            });
            return;
        }
        res.writeHead(404); res.end("not found");
    });
    widgetServer.on("error", error => console.warn("Widget sunucusu başlatılamadı:", error.message));
    widgetServer.listen(WIDGET_PORT);
}

// =====================================================================
// AYARLAR — Merkezi Lisans Sunucu URL'si
// =====================================================================
function lisansSunucuUrlBul() {
    // 1. Ortam değişkeni (Test veya VPS için)
    if (process.env.MNG_LICENSE_SERVER) return process.env.MNG_LICENSE_SERVER.trim().replace(/\/+$/, "");

    // 2. Harici dosya (license-server.txt) — Canlı sunucu adresi buraya yazılır
    const txtYollari = [
        path.join(process.resourcesPath, "license-server.txt"),
        path.join(__dirname, "license-server.txt"),
        path.join(process.cwd(), "license-server.txt"),
        path.join(app.getPath("userData"), "license-server.txt")
    ];

    for (const p of txtYollari) {
        try {
            if (fs.existsSync(p)) {
                const url = fs.readFileSync(p, "utf-8").trim();
                if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
                    return url.replace(/\/+$/, "");
                }
            }
        } catch {}
    }

    // 3. Varsayılan yerel veya bulut sunucu URL'si
    return "http://localhost:4000";
}

// =====================================================================
// CİHAZ KİMLİĞİ — Donanım bazlı benzersiz ID (Device Binding)
// =====================================================================
function cihazKimliginiHesapla() {
    try {
        const mac = Object.values(os.networkInterfaces())
            .flat()
            .filter(i => i && !i.internal && i.mac !== "00:00:00:00:00:00")
            .map(i => i.mac)[0] || "unknown";

        const hostname = os.hostname() || "unknown";
        const platform = os.platform() || "unknown";

        const raw = `${mac}|${hostname}|${platform}`;
        return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
    } catch (e) {
        return crypto.randomBytes(16).toString("hex");
    }
}

const CIHAZ_KIMLIK = store.get("cihaz_kimlik") || (() => {
    const id = cihazKimliginiHesapla();
    store.set("cihaz_kimlik", id);
    return id;
})();

// Güncelleme kurulumları kullanıcı verisini korur. Bu ikinci kayıt, bozuk bir
// yerel ayar dosyasında lisansın aynı cihazda tekrar doğrulanabilmesini sağlar.
const LISANS_YEDEK_DOSYASI = path.join(app.getPath("documents"), "MNG TikTok Game", "license-backup.json");
function lisansYedegiKaydet() {
    const kod = store.get("lisans_kod");
    if (!kod) return;
    try {
        fs.mkdirSync(path.dirname(LISANS_YEDEK_DOSYASI), { recursive: true });
        const yedek = {
            code: kod,
            expiresAt: store.get("lisans_bitis") || null,
            isUnlimited: Boolean(store.get("is_unlimited")),
            activationToken: store.get("lisans_token") || "",
            deviceId: CIHAZ_KIMLIK,
            updatedAt: Date.now()
        };
        const gecici = `${LISANS_YEDEK_DOSYASI}.tmp`;
        fs.writeFileSync(gecici, JSON.stringify(yedek), "utf8");
        fs.renameSync(gecici, LISANS_YEDEK_DOSYASI);
    } catch (err) {
        console.warn("Lisans yedeği yazılamadı:", err.message);
    }
}
function lisansYedeginiSil() {
    try { if (fs.existsSync(LISANS_YEDEK_DOSYASI)) fs.unlinkSync(LISANS_YEDEK_DOSYASI); } catch {}
}
function lisansYedeginiGeriYukle() {
    if (store.get("lisans_kod")) return;
    try {
        const yedek = JSON.parse(fs.readFileSync(LISANS_YEDEK_DOSYASI, "utf8"));
        if (!yedek?.code || yedek.deviceId !== CIHAZ_KIMLIK) return;
        store.set("lisans_kod", yedek.code);
        store.set("lisans_bitis", yedek.expiresAt || null);
        store.set("is_unlimited", Boolean(yedek.isUnlimited));
        if (yedek.activationToken) store.set("lisans_token", yedek.activationToken);
    } catch {}
}

// =====================================================================
// UYGULAMA PROSESLERİ
// =====================================================================
let vsServerProcess = null;
let orbitServerProcess = null;
let crowdControlServerProcess = null;
let battleGameServerProcess = null;
let ponyLifeServerProcess = null;
let duckHuntServerProcess = null;
let frogRiverServerProcess = null;
let penaltyKickServerProcess = null;
let tightropeBalanceServerProcess = null;
let zombieWarProcess = null;
let unturnedBridgeProcess = null;
const APP_PORT = 3000;
const ORBIT_PORT = 3010;
const CROWD_CONTROL_PORT = 3020;
const BATTLE_GAME_PORT = 3030;
const DUCK_HUNT_PORT = 3040;
const PONY_LIFE_PORT = 3050;
const PONY_WIDGET_PORT = 3051;
const FROG_RIVER_PORT = 3060;
const PENALTY_KICK_PORT = 3070;
const TIGHTROPE_BALANCE_PORT = 3080;


// =====================================================================
// OYUN TANIMLARI VE DİNAMİK YOL BULUCU
// =====================================================================
const OYUN_TANIMLARI = {
    ...Object.fromEntries([...require('./lib/published-games.json').games, ...(preview.enabled ? require('./lib/admin-games.json').games : [])]
        .map(game => [game.id, { ...game.definition, ad: game.title }])),
    "battle-royale": {
        id: "battle-royale", ad: "Minecraft, PUBG", klasor: "battle-royale",
        boyut: "1.1 GB", paketSurumu: "6.5.16", minecraft: true,
        modFile: "mng_battle_royale-1.0.0.jar", configFile: "mng-battle-royale.json"
    },
    "snow-war": {
        id: "snow-war", ad: "Minecraft Kartopu Savaşı", klasor: "snow-war",
        boyut: "1 GB", paketSurumu: "6.5.16", minecraft: true,
        modFile: "mng-snow-war-1.0.0.jar", configFile: "mng-snow-war.json"
    },
    vs: {
        id: "vs",
        ad: "TikTok VS Profil",
        klasor: "tiktok-vs",
        boyut: "58 MB",
        paketSurumu: "6.5.7"
    },
    puanlama: {
        id: "puanlama",
        ad: "Profil Puanlama",
        klasor: "tiktok-vs",
        boyut: "58 MB",
        paketSurumu: "6.5.7"
    },
    orbit: {
        id: "orbit",
        ad: "MNG Orbit",
        klasor: "mng-orbit",
        boyut: "435 MB",
        paketSurumu: "6.5.16"
    },
    "crowd-control": {
        id: "crowd-control",
        ad: "MNG Crowd Control",
        klasor: "crowd-control",
        boyut: "6 MB",
        paketSurumu: "6.5.5"
    },
    crowdControl: {
        id: "crowd-control",
        ad: "MNG Crowd Control",
        klasor: "crowd-control",
        boyut: "6 MB",
        paketSurumu: "6.5.5"
    },
    "battle-game": {
        id: "battle-game",
        ad: "Şövalye Savaşı",
        klasor: "battle-game",
        boyut: "9 MB",
        paketSurumu: "6.5.5"
    },
    "gelene-gecene": {
        id: "gelene-gecene",
        ad: "Gelene Geçene",
        klasor: "gelene-gecene",
        boyut: "65 MB",
        steamAppId: "304930"
    },
    "duck-hunt": {
        id: "duck-hunt",
        ad: "MNG Dodge Hunter",
        klasor: "duck-hunt",
        boyut: "15 MB",
        paketSurumu: "6.5.5"
    },
    "pony-life": {
        id: "pony-life",
        ad: "Pony Katırı",
        klasor: "pony-life",
        boyut: "29 MB",
        paketSurumu: "6.5.5"
    },
    "frog-river": {
        id: "frog-river",
        ad: "Vak Vak Jump",
        klasor: "frog-river",
        boyut: "58 MB",
        paketSurumu: "6.5.5"
    },
    "penalty-kick": {
        id: "penalty-kick",
        ad: "Süper Lig (Penaltı)",
        klasor: "penalty-kick",
        boyut: "52 MB",
        paketSurumu: "6.5.10"
    },
    "tightrope-balance": {
        id: "tightrope-balance",
        ad: "Dengesiz Yayıncı",
        klasor: "tightrope-balance",
        boyut: "56 MB",
        paketSurumu: "6.5.10"
    },
    "caahr": {
        id: "caahr", ad: "Sesli Sürüş", klasor: "caahr",
        boyut: "Yerel CAAAHR kurulumu", paketSurumu: "0.6.11",
        nativeExecutable: "CAAAHR.exe"
    },
    "zombie-war": {
        id: "zombie-war", ad: "Zombie War", klasor: "zombie-war",
        boyut: "904 MB", paketSurumu: "6.5.17",
        paketUrl: "https://github.com/maNgao7/mng-license-server1/releases/download/zombie-war-6.5.17/zombie-war.zip"
    }
};

function unturnedKlasoruBul() {
    const adaylar = [
        store.get("unturned_path", ""),
        "D:\\SteamLibrary\\steamapps\\common\\Unturned",
        "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Unturned",
        "C:\\Program Files\\Steam\\steamapps\\common\\Unturned"
    ].filter(Boolean);
    try {
        const steamPath = require("child_process").execSync('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', { encoding: "utf8", windowsHide: true });
        const match = steamPath.match(/SteamPath\s+REG_SZ\s+(.+)/i);
        if (match) adaylar.unshift(path.join(match[1].trim(), "steamapps", "common", "Unturned"));
    } catch {}
    for (const aday of adaylar) {
        try {
            if (fs.existsSync(path.join(aday, "Unturned.exe"))) {
                store.set("unturned_path", aday);
                return aday;
            }
        } catch {}
    }
    return "";
}

function geleneGeceneModKlasoru() {
    const unturned = unturnedKlasoruBul();
    return unturned ? path.join(unturned, "Modules", "UnturnedModEdition") : "";
}

function geleneGecenePaketiniDogrulaVeIsaretle(modDir) {
    const gerekli = ["UnturnedModEdition.dll", "UnturnedModEdition.module"];
    const gecerli = dir => gerekli.every(dosya => {
        const hedef = path.join(dir, dosya);
        return fs.existsSync(hedef) && fs.statSync(hedef).size > 0;
    });
    if (!gecerli(modDir)) {
        const altKlasor = fs.readdirSync(modDir, { withFileTypes: true })
            .filter(entry => entry.isDirectory())
            .map(entry => path.join(modDir, entry.name))
            .find(gecerli);
        if (altKlasor) fs.cpSync(altKlasor, modDir, { recursive: true, force: true });
    }
    if (!gecerli(modDir)) return false;
    fs.writeFileSync(path.join(modDir, "mng-version.json"), JSON.stringify({
        version: GELENE_GECENE_SURUMU,
        revision: GELENE_GECENE_PAKET_REVIZYONU,
        channel: "stable",
        game: "gelene-gecene",
        installedAt: new Date().toISOString()
    }, null, 2), "utf8");
    return true;
}

function eskiGeleneGeceneDllleriniAyikla(modDir) {
    if (!modDir || !fs.existsSync(modDir)) return [];
    const anaDll = path.resolve(modDir, "UnturnedModEdition.dll").toLowerCase();
    const bulunanlar = [];
    const tara = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) tara(fullPath);
            else if (entry.isFile() && /^unturnedmodedition.*\.dll$/i.test(entry.name) && path.resolve(fullPath).toLowerCase() !== anaDll) bulunanlar.push(fullPath);
        }
    };
    tara(modDir);
    if (!bulunanlar.length) return [];
    const hedef = path.join(app.getPath("documents"), "MNG TikTok Game", "Gelene Gecene Eski Mod Yedekleri", String(Date.now()));
    fs.mkdirSync(hedef, { recursive: true });
    for (const dll of bulunanlar) {
        const relative = path.relative(modDir, dll).replace(/[\\/:*?"<>|]/g, "_");
        fs.renameSync(dll, path.join(hedef, relative));
    }
    return bulunanlar;
}

function oyunAnaDosyalariVar(dir, oyunId) {
    if(oyunId==='caahr'&&dir){
        try{const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));if(manifest.type==='tikmng-caaahr-support'&&manifest.platform==='win32-x64'&&fs.existsSync(path.join(dir,'backend/server.mjs')))return true;}catch{}
    }
    if (!dir) return false;
    if (OYUN_TANIMLARI[oyunId]?.nativeExecutable) {
        return fs.existsSync(path.join(dir, OYUN_TANIMLARI[oyunId].nativeExecutable));
    }
    if (OYUN_TANIMLARI[oyunId]?.minecraft) {
        if(oyunId==='minecraft-snake-arena'){
            const base=["launch-game.cjs","runtime/java/bin/java.exe","runtime/profile.json","runtime/client.jar","live-bridge/server.js"];
            if(!base.every(relative=>fs.existsSync(path.join(dir,relative))))return false;
            // Keep an older installed version playable while a new JAR is advertised.
            try{return fs.readdirSync(path.join(dir,'game-instance/mods')).filter(name=>/^tikmng_snake_arena(?:-\d+\.\d+\.\d+)?\.jar$/.test(name)).length===1;}catch{return false;}
        }
        return ["launch-game.cjs", "runtime/java/bin/java.exe", "runtime/profile.json",
            "runtime/client.jar", "live-bridge/server.js",
            `game-instance/mods/${OYUN_TANIMLARI[oyunId].modFile}`]
            .every(relative => fs.existsSync(path.join(dir, relative)));
    }
    if (oyunId === "zombie-war") return fs.existsSync(path.join(dir, "launch-game.cjs")) && fs.existsSync(path.join(dir, "game-instance", "mods", "mng-zombie-strike-1.0.0.jar"));
    return oyunId === "pony-life"
        ? fs.existsSync(path.join(dir, "server", "index.js")) && fs.existsSync(path.join(dir, "dist", "index.html"))
        : fs.existsSync(path.join(dir, "server.js")) && fs.existsSync(path.join(dir, "public", "index.html"));
}

function oyunKlasoruBul(oyunId, legacyOnly = false) {
    if(oyunId === 'caahr') {
        const native = require('./lib/native-game.cjs').findVoiceDrivingGame();
        if(native) return native;
    }
    if (!legacyOnly && platform) {
        const installed = platform.pathFor(oyunId);
        if (installed) return installed;
    }
    const tanim = OYUN_TANIMLARI[oyunId] || { klasor: oyunId };
    const klasorAdi = tanim.klasor;
    const previous = store.get('library_previous_paths_v1', {})[oyunId];
    if (previous && oyunAnaDosyalariVar(previous, oyunId)) return previous;

    // 1. Kullanıcı indirme / modüler konumu (userData/games/...)
    try {
        const userDataPath = path.join(app.getPath("userData"), "games", klasorAdi);
        if (oyunAnaDosyalariVar(userDataPath, oyunId)) {
            return userDataPath;
        }
    } catch {}

    // 2. Paket içi resources konumu (resources/apps/...)
    if (app.isPackaged) {
        const packagedPath = path.join(process.resourcesPath, "apps", klasorAdi);
        if (oyunAnaDosyalariVar(packagedPath, oyunId)) {
            return packagedPath;
        }
    }

    // 3. Geliştirme modu konumu (../apps/...)
    const devPath = path.join(__dirname, "..", "apps", klasorAdi);
    if (!app.isPackaged && OYUN_TANIMLARI[oyunId]?.minecraft && oyunAnaDosyalariVar(path.join(devPath, "prototype"), oyunId)) return path.join(devPath, "prototype");
    if (oyunAnaDosyalariVar(devPath, oyunId)) {
        return devPath;
    }

    // Bulunamadıysa varsayılan döner
    return app.isPackaged
        ? path.join(process.resourcesPath, "apps", klasorAdi)
        : devPath;
}

function oyunKuruluMu(oyunId) {
    try {
        if (platform && oyunId !== 'gelene-gecene') return Boolean(platform.statuses()[oyunId]?.installed);
        if (oyunId === "gelene-gecene") {
            const modDir = geleneGeceneModKlasoru();
            if (!modDir || !fs.existsSync(path.join(modDir, "UnturnedModEdition.dll")) || !fs.existsSync(path.join(modDir, "UnturnedModEdition.module"))) return false;
            const marker = path.join(modDir, "mng-version.json");
            if (!fs.existsSync(marker)) return false;
            const info = JSON.parse(fs.readFileSync(marker, "utf8"));
            return String(info.version || "") === GELENE_GECENE_SURUMU && String(info.revision || "") === GELENE_GECENE_PAKET_REVIZYONU;
        }
        const appDir = oyunKlasoruBul(oyunId);
        const temelGecerli = oyunAnaDosyalariVar(appDir, oyunId);
        if (!temelGecerli) return false;
        if (!app.isPackaged) return true;
        const marker = path.join(appDir, ".tikmng-package.json");
        if (!fs.existsSync(marker)) return false;
        const info = JSON.parse(fs.readFileSync(marker, "utf8"));
        return String(info.version || "") === String(OYUN_TANIMLARI[oyunId]?.paketSurumu || "");
    } catch {
        return false;
    }
}

function oyunPaketKokuBul(kok, oyunId) {
    const gecerli = dir => oyunAnaDosyalariVar(dir, oyunId);

    if (gecerli(kok)) return kok;
    const kuyruk = fs.readdirSync(kok, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && !entry.name.startsWith("."))
        .map(entry => path.join(kok, entry.name));
    while (kuyruk.length) {
        const aday = kuyruk.shift();
        if (gecerli(aday)) return aday;
        if (path.relative(kok, aday).split(path.sep).length >= 3) continue;
        for (const entry of fs.readdirSync(aday, { withFileTypes: true })) {
            if (entry.isDirectory() && !entry.name.startsWith(".")) kuyruk.push(path.join(aday, entry.name));
        }
    }
    return "";
}

async function zipArsiviniAc(zipKaynagi, hedefKlasor) {
    const cp = require("child_process");
    const execFile = require("util").promisify(cp.execFile);
    fs.mkdirSync(hedefKlasor, { recursive: true });
    try {
        await execFile("tar.exe", ["-xf", zipKaynagi, "-C", hedefKlasor], { timeout: 180000, windowsHide: true });
    } catch (tarErr) {
        const escapedZip = zipKaynagi.replace(/'/g, "''");
        const escapedTarget = hedefKlasor.replace(/'/g, "''");
        await execFile("powershell.exe", [
            "-NoProfile", "-NonInteractive", "-Command",
            `Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedTarget}' -Force`
        ], { timeout: 240000, windowsHide: true });
    }
}

// Mevcut uygulamanın bulunduğu yol
function appKlasoruBul() {
    return oyunKlasoruBul("vs");
}

function orbitKlasoruBul() {
    return oyunKlasoruBul("orbit");
}

function crowdControlKlasoruBul() {
    return oyunKlasoruBul("crowd-control");
}

// Node.js executable yolu ve çalıştırma ortamı
function nodeBilgisiBul() {
    const widgetEnv = { MNG_WIDGET_PORT: String(WIDGET_PORT), MNG_WIDGET_ACCESS_KEY: WIDGET_ACCESS_KEY };
    if (app.isPackaged) {
        return {
            komut: process.execPath,
            env: { ...process.env, ...widgetEnv, ELECTRON_RUN_AS_NODE: "1", PORT: APP_PORT }
        };
    }

    const adaylar = [
        "node",
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Program Files (x86)\\nodejs\\node.exe",
        path.join(os.homedir(), "AppData", "Roaming", "nvm", "current", "node.exe")
    ];

    for (const yol of adaylar) {
        try {
            require("child_process").execSync(`"${yol}" --version`, { stdio: "ignore", timeout: 3000 });
            return {
                komut: yol,
                env: { ...process.env, ...widgetEnv, PORT: APP_PORT }
            };
        } catch {}
    }

    return {
        komut: process.execPath,
        env: { ...process.env, ...widgetEnv, ELECTRON_RUN_AS_NODE: "1", PORT: APP_PORT }
    };
}

async function geleneGeceneKoprusunuBaslat(modDir) {
    try {
        const status = await httpGet("http://127.0.0.1:8088/status");
        if (status && (status.bridgeVersion || status.status)) return;
        try { await httpGet("http://127.0.0.1:8088/shutdown"); } catch {}
        await new Promise(resolve => setTimeout(resolve, 500));
    } catch {}

    killProcessOnPort(8088);

    const adaylar = [
        path.join(modDir, "tiktok_unturned_bridge.js"),
        app.isPackaged ? path.join(process.resourcesPath, "apps", "tiktok-vs", "tiktok_unturned_bridge.js") : "",
        path.join(__dirname, "..", "apps", "tiktok-vs", "tiktok_unturned_bridge.js")
    ].filter(Boolean);
    const bridgeFile = adaylar.find(file => fs.existsSync(file) && fs.existsSync(path.join(path.dirname(file), "node_modules")));
    if (!bridgeFile) throw new Error("TikTok canlı yayın köprüsü veya bağımlılıkları bulunamadı. Launcher'ı yeniden kurun.");

    const bridgeDir = path.dirname(bridgeFile);
    try {
        const pkgPath = path.join(bridgeDir, "package.json");
        let valid = false;
        if (fs.existsSync(pkgPath)) {
            let raw = fs.readFileSync(pkgPath, "utf8");
            if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
            try {
                const parsed = JSON.parse(raw);
                if (parsed.type === "module") valid = true;
            } catch {}
        }
        if (!valid) {
            fs.writeFileSync(pkgPath, JSON.stringify({ name: "unturned-mng-bridge", version: "6.5.0", type: "module" }, null, 2), "utf8");
        }
    } catch {}
    const nodeBilgi = nodeBilgisiBul();
    const logDir = path.join(app.getPath("userData"), "logs");
    const logFile = path.join(logDir, "gelene-gecene-bridge.log");
    fs.mkdirSync(logDir, { recursive: true });
    const logStream = fs.createWriteStream(logFile, { flags: "a" });
    logStream.write(`\n[${new Date().toISOString()}] 6.5.0 köprü başlatılıyor: ${bridgeFile}\n`);

    unturnedBridgeProcess = spawn(nodeBilgi.komut, [bridgeFile], {
        cwd: bridgeDir,
        env: {
            ...nodeBilgi.env,
            PORT: "8088",
            NODE_PATH: path.join(bridgeDir, "node_modules"),
            MNG_UNTURNED_MOD_DIR: modDir
        },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
    });
    unturnedBridgeProcess.stdout?.pipe(logStream, { end: false });
    unturnedBridgeProcess.stderr?.pipe(logStream, { end: false });
    unturnedBridgeProcess.on("exit", code => {
        logStream.write(`[${new Date().toISOString()}] Köprü kapandı: ${code}\n`);
        logStream.end();
        unturnedBridgeProcess = null;
    });

    for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 250));
        try {
            const status = await httpGet("http://127.0.0.1:8088/status");
            if (status && (status.bridgeVersion || status.status)) return;
        } catch {}
        if (!unturnedBridgeProcess) break;
    }
    throw new Error(`TikTok canlı yayın köprüsü başlatılamadı. Ayrıntı: ${logFile}`);
}

function sunucuyuBaslat() {
    return new Promise((resolve, reject) => {
        if (vsServerProcess) {
            resolve();
            return;
        }

        const appDir = appKlasoruBul();
        const serverDosya = path.join(appDir, "server.js");

        if (!fs.existsSync(serverDosya)) {
            reject(new Error(`Uygulama dosyası bulunamadı: ${serverDosya}`));
            return;
        }

        const nodeBilgi = nodeBilgisiBul();

        vsServerProcess = spawn(nodeBilgi.komut, [serverDosya], {
            cwd: appDir,
            env: {
                ...nodeBilgi.env,
                MNG_BACKGROUNDS_DIR: arkaPlanKlasoru()
            },
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"]
        });

        vsServerProcess.on("error", (err) => {
            vsServerProcess = null;
            reject(err);
        });

        vsServerProcess.on("exit", (code) => {
            vsServerProcess = null;
        });

        // Sunucunun hazır olmasını bekle
        const baslangic = Date.now();
        const kontrol = setInterval(() => {
            const client = new http.ClientRequest({
                hostname: "127.0.0.1",
                port: APP_PORT,
                path: "/",
                method: "HEAD"
            });

            client.on("response", () => {
                clearInterval(kontrol);
                resolve();
            });

            client.on("error", () => {
                if (Date.now() - baslangic > 30000) {
                    clearInterval(kontrol);
                    sunucuyuDurdur();
                    reject(new Error("Sunucu 30 saniyede başlamadı."));
                }
            });

            client.end();
        }, 500);
    });
}

function killProcessOnPort(port) {
    if (preview.enabled) return;
    try {
        if (process.platform === "win32") {
            const cp = require("child_process");
            const output = cp.execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 });
            const lines = output.split("\n");
            const pids = new Set();
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 5 && parts[1].includes(`:${port}`) && parts[3] === "LISTENING") {
                    const pid = parseInt(parts[4], 10);
                    if (pid && pid !== process.pid) pids.add(pid);
                }
            }
            for (const pid of pids) {
                try { cp.execSync(`taskkill /pid ${pid} /f /t`, { stdio: "ignore", timeout: 3000 }); } catch {}
            }
        }
    } catch {}
}

async function sunuculariDurdur() {
    if (!preview.enabled || vsServerProcess) try { await httpPost(`http://127.0.0.1:${APP_PORT}/api/disconnect`, {}).catch(() => {}); } catch {}
    if (!preview.enabled || orbitServerProcess) try { await httpPost(`http://127.0.0.1:${ORBIT_PORT}/api/disconnect`, {}).catch(() => {}); } catch {}
    if (!preview.enabled || crowdControlServerProcess) try { await httpPost(`http://127.0.0.1:${CROWD_CONTROL_PORT}/api/disconnect`, {}).catch(() => {}); } catch {}

    if (vsServerProcess) {
        try {
            if (process.platform === "win32") {
                require("child_process").execSync(`taskkill /pid ${vsServerProcess.pid} /f /t`, { stdio: "ignore", timeout: 3000 });
            } else {
                vsServerProcess.kill("SIGKILL");
            }
        } catch {}
        vsServerProcess = null;
    }

    if (orbitServerProcess) {
        try {
            if (process.platform === "win32") {
                require("child_process").execSync(`taskkill /pid ${orbitServerProcess.pid} /f /t`, { stdio: "ignore", timeout: 3000 });
            } else {
                orbitServerProcess.kill("SIGKILL");
            }
        } catch {}
        orbitServerProcess = null;
    }

    if (crowdControlServerProcess) {
        try {
            if (process.platform === "win32") {
                require("child_process").execSync(`taskkill /pid ${crowdControlServerProcess.pid} /f /t`, { stdio: "ignore", timeout: 3000 });
            } else {
                crowdControlServerProcess.kill("SIGKILL");
            }
        } catch {}
        crowdControlServerProcess = null;
    }

    for (const entry of [[ponyLifeServerProcess, PONY_LIFE_PORT], [duckHuntServerProcess, DUCK_HUNT_PORT], [frogRiverServerProcess, FROG_RIVER_PORT], [penaltyKickServerProcess, PENALTY_KICK_PORT], [tightropeBalanceServerProcess, TIGHTROPE_BALANCE_PORT]]) {
        const child = entry[0];
        if (child) {
            try {
                if (process.platform === "win32") require("child_process").execSync(`taskkill /pid ${child.pid} /f /t`, { stdio: "ignore", timeout: 3000 });
                else child.kill("SIGKILL");
            } catch {}
        }
        killProcessOnPort(entry[1]);
    }
    ponyLifeServerProcess = null;
    duckHuntServerProcess = null;
    frogRiverServerProcess = null;
    penaltyKickServerProcess = null;
    tightropeBalanceServerProcess = null;

    if (unturnedBridgeProcess) {
        try {
            if (process.platform === "win32") require("child_process").execSync(`taskkill /pid ${unturnedBridgeProcess.pid} /f /t`, { stdio: "ignore", timeout: 3000 });
            else unturnedBridgeProcess.kill("SIGKILL");
        } catch {}
        unturnedBridgeProcess = null;
    }

    killProcessOnPort(APP_PORT);
    killProcessOnPort(ORBIT_PORT);
    killProcessOnPort(CROWD_CONTROL_PORT);
    killProcessOnPort(DUCK_HUNT_PORT);
    killProcessOnPort(PONY_LIFE_PORT);
    killProcessOnPort(PONY_WIDGET_PORT);
    killProcessOnPort(FROG_RIVER_PORT);
    killProcessOnPort(PENALTY_KICK_PORT);
    killProcessOnPort(8088);

    await new Promise(r => setTimeout(r, 350));
}

function sunucuyuDurdur() {
    sunuculariDurdur().catch(() => {});
}

function orbitSunucuyuDurdur() {
    sunuculariDurdur().catch(() => {});
}

function crowdControlSunucuyuDurdur() {
    sunuculariDurdur().catch(() => {});
}

function crowdControlSunucuyuBaslat() {
    return new Promise((resolve, reject) => {
        if (crowdControlServerProcess) return resolve();
        const appDir = crowdControlKlasoruBul();
        const serverDosya = path.join(appDir, "server.js");
        if (!fs.existsSync(serverDosya)) return reject(new Error(`MNG Crowd Control dosyası bulunamadı: ${serverDosya}`));
        const nodeBilgi = nodeBilgisiBul();
        crowdControlServerProcess = spawn(nodeBilgi.komut, [serverDosya], {
            cwd: appDir,
            env: { ...nodeBilgi.env, PORT: CROWD_CONTROL_PORT },
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"]
        });
        crowdControlServerProcess.on("error", (err) => { crowdControlServerProcess = null; reject(err); });
        crowdControlServerProcess.on("exit", () => { crowdControlServerProcess = null; });
        const started = Date.now();
        const check = setInterval(() => {
            const client = new http.ClientRequest({ hostname: "127.0.0.1", port: CROWD_CONTROL_PORT, path: "/api/health", method: "GET" });
            client.on("response", () => { clearInterval(check); resolve(); });
            client.on("error", () => {
                if (Date.now() - started > 30000) { clearInterval(check); crowdControlSunucuyuDurdur(); reject(new Error("MNG Crowd Control 30 saniyede başlamadı.")); }
            });
            client.end();
        }, 500);
    });
}

function battleGameSunucuyuDurdur() {
    if (battleGameServerProcess) {
        try { require("child_process").execSync(`taskkill /pid ${battleGameServerProcess.pid} /f /t`, { stdio: "ignore" }); } catch {}
        battleGameServerProcess = null;
    }
    killProcessOnPort(BATTLE_GAME_PORT);
    killProcessOnPort(PONY_WIDGET_PORT);
}

function battleGameSunucuyuBaslat() {
    return new Promise((resolve, reject) => {
        if (battleGameServerProcess) return resolve();
        const klasorler = [
            path.join(__dirname, "..", "apps", "battle-game"),
            path.join(app.getPath("userData"), "games", "battle-game"),
        ];
        let appDir = null;
        for (const k of klasorler) { if (fs.existsSync(path.join(k, "server.js"))) { appDir = k; break; } }
        if (!appDir) return reject(new Error("Battle Game dosyası bulunamadı."));
        const nodeBilgi = nodeBilgisiBul();
        battleGameServerProcess = spawn(nodeBilgi.komut, [path.join(appDir, "server.js")], {
            cwd: appDir,
            env: { ...nodeBilgi.env, PORT: BATTLE_GAME_PORT },
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"]
        });
        battleGameServerProcess.on("error", (err) => { battleGameServerProcess = null; reject(err); });
        battleGameServerProcess.on("exit", () => { battleGameServerProcess = null; });
        const started = Date.now();
        const check = setInterval(() => {
            const client = new http.ClientRequest({ hostname: "127.0.0.1", port: BATTLE_GAME_PORT, path: "/api/health", method: "GET" });
            client.on("response", () => { clearInterval(check); resolve(); });
            client.on("error", () => {
                if (Date.now() - started > 30000) { clearInterval(check); battleGameSunucuyuDurdur(); reject(new Error("Battle Game 30 saniyede başlamadı.")); }
            });
            client.end();
        }, 500);
    });
}

function yeniOyunSunucusunuBaslat(oyunId) {
    const pony = oyunId === "pony-life";
    const appDir = oyunKlasoruBul(oyunId);
    const serverDosya = path.join(appDir, pony ? "server" : "", pony ? "index.js" : "server.js");
    const port = pony ? PONY_LIFE_PORT : oyunId === "duck-hunt" ? DUCK_HUNT_PORT : oyunId === "frog-river" ? FROG_RIVER_PORT : oyunId === "penalty-kick" ? PENALTY_KICK_PORT : TIGHTROPE_BALANCE_PORT;
    const current = pony ? ponyLifeServerProcess : oyunId === "duck-hunt" ? duckHuntServerProcess : oyunId === "frog-river" ? frogRiverServerProcess : oyunId === "penalty-kick" ? penaltyKickServerProcess : tightropeBalanceServerProcess;
    if (current) return Promise.resolve();
    if (!fs.existsSync(serverDosya)) return Promise.reject(new Error(`${OYUN_TANIMLARI[oyunId].ad} dosyası bulunamadı.`));
    return new Promise((resolve, reject) => {
        const nodeBilgi = nodeBilgisiBul();
        const env = { ...nodeBilgi.env, PORT: port };
        if (pony) Object.assign(env, { PONY_PORT: port, PONY_WIDGET_PORT, PONY_STATE_FILE: path.join(app.getPath("userData"), "pony-life.json") });
        if (oyunId === "frog-river") env.FROG_PORT = String(port);
        const child = spawn(nodeBilgi.komut, [serverDosya], { cwd: appDir, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        if (pony) ponyLifeServerProcess = child;
        else if (oyunId === "duck-hunt") duckHuntServerProcess = child;
        else if (oyunId === "frog-river") frogRiverServerProcess = child;
        else if (oyunId === "penalty-kick") penaltyKickServerProcess = child;
        else if (oyunId === "tightrope-balance") tightropeBalanceServerProcess = child;
        child.on("error", reject);
        child.on("exit", () => {
            if (pony) ponyLifeServerProcess = null;
            else if (oyunId === "duck-hunt") duckHuntServerProcess = null;
            else if (oyunId === "frog-river") frogRiverServerProcess = null;
            else if (oyunId === "penalty-kick") penaltyKickServerProcess = null;
            else if (oyunId === "tightrope-balance") tightropeBalanceServerProcess = null;
        });
        const started = Date.now();
        const check = setInterval(() => {
            const client = new http.ClientRequest({ hostname: "127.0.0.1", port, path: "/api/health", method: "GET" });
            client.on("response", response => { response.resume(); clearInterval(check); resolve(); });
            client.on("error", () => { if (Date.now() - started > 30000) { clearInterval(check); reject(new Error(`${OYUN_TANIMLARI[oyunId].ad} 30 saniyede başlamadı.`)); } });
            client.end();
        }, 500);
    });
}

function orbitSunucuyuBaslat() {
    return new Promise((resolve, reject) => {
        if (orbitServerProcess) return resolve();
        const appDir = orbitKlasoruBul();
        const serverDosya = path.join(appDir, "server.js");
        if (!fs.existsSync(serverDosya)) return reject(new Error(`MNG Orbit dosyası bulunamadı: ${serverDosya}`));

        orbitServerProcess = spawn(process.execPath, [serverDosya], {
            cwd: appDir,
            env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: ORBIT_PORT, MNG_BACKGROUNDS_DIR: arkaPlanKlasoru() },
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"]
        });
        orbitServerProcess.on("error", (err) => { orbitServerProcess = null; reject(err); });
        orbitServerProcess.on("exit", () => { orbitServerProcess = null; });
        const started = Date.now();
        const check = setInterval(() => {
            const client = new http.ClientRequest({ hostname: "127.0.0.1", port: ORBIT_PORT, path: "/", method: "HEAD" });
            client.on("response", () => { clearInterval(check); resolve(); });
            client.on("error", () => {
                if (Date.now() - started > 30000) { clearInterval(check); orbitSunucuyuDurdur(); reject(new Error("MNG Orbit 30 saniyede başlamadı.")); }
            });
            client.end();
        }, 500);
    });
}

// =====================================================================
// PENCERELER
// =====================================================================
let mainWindow = null;
let appWindow = null;

function anaEkraniOlustur() {
    startupMark('window-create-start');
    mainWindow = new BrowserWindow({
        width: 1040,
        height: 680,
        minWidth: 920,
        minHeight: 560,
        frame: true,
        resizable: true,
        title: preview.enabled ? "TikMnG Yönetici Ön İzleme" : "TikMnG",
        icon: path.join(__dirname, "renderer", "assets", "icon-v4.ico"),
        backgroundColor: "#111315",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webSecurity: true,
            autoplayPolicy: 'no-user-gesture-required',
            backgroundThrottling: false
        }
    });

    mainWindow.setMenuBarVisibility(false);
    require('./lib/edit-context-menu.cjs').attachEditContextMenu(mainWindow,require('electron').Menu);
    mainWindow.maximize();
    mainWindow.webContents.once('did-finish-load', () => startupMark('window-loaded'));
    mainWindow.once('ready-to-show', () => startupMark('window-drawable'));
    mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

    mainWindow.on("closed", () => {
        mainWindow = null;
        if (appWindow && !appWindow.isDestroyed()) {
            try { appWindow.close(); } catch {}
            appWindow = null;
        }
        sunuculariDurdur().catch(() => {});
    });
}

// =====================================================================
// IPC — MERKEZİ LİSANS DOĞRULAMA (Admin Secret Yok, Tamamen Güvenli)
// =====================================================================

ipcMain.handle("harici-link-ac", async (_event, { url } = {}) => {
    if (typeof url !== "string" || url.length > 4096) throw new Error("Geçerli bir HTTPS bağlantısı gerekli.");
    let target;
    try { target = new URL(url); } catch { throw new Error("Geçerli bir HTTPS bağlantısı gerekli."); }
    if (target.protocol !== "https:" || target.username || target.password) throw new Error("Güvenli HTTPS bağlantısı gerekli.");
    await shell.openExternal(target.href);
    return { basarili: true };
});

// Lisans Doğrula ve Aktifleştir
ipcMain.handle("lisans-dogrula", async (event, { kod }) => {
    try {
        const serverUrl = lisansSunucuUrlBul();
        const clientVer = app.getVersion() || "1.0.2";
        const sonuc = await httpPost(`${serverUrl}/api/license/verify`, {
            code: kod.trim().toUpperCase(),
            deviceId: CIHAZ_KIMLIK,
            clientVersion: clientVer
        });

        if (sonuc.valid) {
            sunucuyuDurdur();
            // Başarılı lisansı yerel kasada sakla
            store.set("lisans_kod", kod.trim().toUpperCase());
            store.set("lisans_bitis", sonuc.expiresAt);
            store.set("is_unlimited", sonuc.isUnlimited);
            if (sonuc.activationToken) {
                store.set("lisans_token", sonuc.activationToken);
            }
            store.delete("lisans_durum");
            lisansYedegiKaydet();

            lisansKorumasiBaslat();
            overlayBridge?.start(widgetChannel);

            return {
                gecerli: true,
                bitis_zamani: sonuc.expiresAt,
                kalan_saniye: sonuc.remainingSeconds,
                kalan_gun: sonuc.remainingDays,
                is_unlimited: sonuc.isUnlimited,
                mesaj: sonuc.message || "Lisans başarıyla aktifleştirildi."
            };
        } else {
            return {
                gecerli: false,
                hata: sonuc.message || "Geçersiz lisans kodu.",
                reason: sonuc.reason
            };
        }
    } catch (hata) {
        return {
            gecerli: false,
            hata: "Lisans sunucusuna ulaşılamıyor. İnternet bağlantınızı kontrol edin."
        };
    }
});

// Mevcut Lisans Durumunu Kontrol Et
ipcMain.handle("lisans-durumu", async () => {
    const kod = store.get("lisans_kod");
    if (!kod) {
        return { gecerli: false, sebep: "kayitli_lisans_yok" };
    }

    try {
        const serverUrl = lisansSunucuUrlBul();
        const clientVer = app.getVersion() || "1.0.2";
        const sonuc = await httpPost(`${serverUrl}/api/license/check`, {
            code: kod,
            deviceId: CIHAZ_KIMLIK,
            activationToken: store.get("lisans_token") || "",
            expiresAt: store.get("lisans_bitis") || null,
            clientVersion: clientVer
        });

        if (sonuc.valid) {
            store.set("lisans_bitis", sonuc.expiresAt);
            store.set("is_unlimited", sonuc.isUnlimited);
            if (sonuc.activationToken) {
                store.set("lisans_token", sonuc.activationToken);
            }
            store.delete("lisans_durum");
            lisansYedegiKaydet();

            lisansKorumasiBaslat();

            return {
                gecerli: true,
                kod,
                bitis_zamani: sonuc.expiresAt,
                kalan_saniye: sonuc.remainingSeconds,
                kalan_gun: sonuc.remainingDays,
                is_unlimited: sonuc.isUnlimited
            };
        } else {
            // Lisans iptal edilmiş veya süresi dolmuşsa
            if (sonuc.reason !== "update_required") {
                if (sonuc.reason === "expired") {
                    store.set("lisans_durum", "expired");
                } else if (sonuc.reason === "revoked" || sonuc.reason === "device_mismatch") {
                    store.delete("lisans_kod");
                    store.delete("lisans_bitis");
                    store.delete("lisans_token");
                    store.delete("is_unlimited");
                    lisansYedeginiSil();
                }
            }
            return {
                gecerli: false,
                kod,
                hata: sonuc.message || "Lisansınız geçersiz veya süresi dolmuş.",
                reason: sonuc.reason
            };
        }
    } catch (hata) {
        // İnternet bağlantısı yoksa uygulama açılamaz kuralı
        return {
            gecerli: false,
            sebep: "internet_yok",
            hata: "İnternet bağlantısı kurulamadı. Lisans doğrulaması için internet bağlantısı gereklidir."
        };
    }
});

// Lisansı Temizle
ipcMain.handle("lisans-temizle", async () => {
    store.delete("lisans_kod");
    store.delete("lisans_bitis");
    store.delete("lisans_token");
    store.delete("is_unlimited");
    store.delete("lisans_durum");
    lisansYedeginiSil();
    return { basarili: true };
});

// Lisans Çalışma Zamanı Süre Koruması (Oyun Açıkken Süre Dolarsa Anında Kapatır)
let lisansKontrolZamanlayici = null;
function lisansKorumasiBaslat() {
    if (lisansKontrolZamanlayici) clearInterval(lisansKontrolZamanlayici);
    lisansKontrolZamanlayici = setInterval(() => {
        const kod = store.get("lisans_kod");
        const bitis = store.get("lisans_bitis");
        const isUnlimited = store.get("is_unlimited");

        if (!kod) return;
        if (!isUnlimited && bitis && Date.now() > Number(bitis)) {
            console.log("Lisans süresi doldu! Oyun pencereleri ve sunucu durduruluyor...");
            sunucuyuDurdur();
            if (appWindow && !appWindow.isDestroyed()) {
                appWindow.close();
                appWindow = null;
            }
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("durum", {
                    tip: "hata",
                    mesaj: "⚠️ Lisans kullanım süreniz doldu! Uygulama kapatıldı."
                });
            }
        }
    }, 10000); // Her 10 saniyede bir süre kontrolü
}

// Uygulamayı Başlat
ipcMain.handle("orbit-hediye-katalogu", async () => {
    try {
        const vsDir = appKlasoruBul();
        let catalog = [];
        const fullCatPath = path.join(vsDir, "public", "assets", "gift-images", "katalog_tam.json");
        const dotCatPath = path.join(vsDir, ".gift-catalog.json");
        const bundledPath = path.join(__dirname, 'renderer', 'gift-assets', 'katalog_tam.json');
        if (fs.existsSync(bundledPath)) {
            catalog = JSON.parse(fs.readFileSync(bundledPath, 'utf8'));
        } else if (fs.existsSync(fullCatPath)) {
            catalog = JSON.parse(fs.readFileSync(fullCatPath, "utf8"));
        } else if (fs.existsSync(dotCatPath)) {
            catalog = JSON.parse(fs.readFileSync(dotCatPath, "utf8"));
        }
        let visualGroups = new Map();
        try {
            const groups = JSON.parse(fs.readFileSync(path.join(__dirname,'renderer/gift-assets/visual-groups.json'),'utf8')).groups;
            visualGroups = new Map(groups.flatMap(group=>group.ids.map(id=>[String(id),String(group.id)])));
        } catch {}
        return Array.isArray(catalog) ? catalog.map(gift => {
            const fileName = gift.file || (gift.image ? path.basename(String(gift.image)) : "");
            return {
                id: String(gift.id || ""),
                name: String(gift.trName || gift.name || "Hediye"),
                coins: Math.max(0, Number(gift.coins) || 0),
                visualGroup: visualGroups.get(String(gift.id)) || String(gift.id),
                image: fileName ? `mng-bg://gift/${fileName}` : null
            };
        }).filter(gift => gift.id && gift.image) : [];
    } catch (e) {
        console.error("Hediye kataloğu yüklenemedi:", e);
        return [];
    }
});

ipcMain.handle("tiktok-hesaplari", async () => ({
    accounts: store.get("tiktok_accounts", []),
    active: store.get("tiktok_active_account", "")
}));
ipcMain.handle("tiktok-hesap-kaydet", async (_event, { username }) => {
    const clean = String(username || "").replace(/^@/, "").trim();
    if (!/^[a-zA-Z0-9_.]{1,24}$/.test(clean)) return { basarili: false, hata: "Geçerli TikTok kullanıcı adını yazın. Yalnızca harf, rakam, nokta ve alt çizgi kullanın." };
    const accounts = store.get("tiktok_accounts", []).filter(item => String(item).toLocaleLowerCase("tr-TR") !== clean.toLocaleLowerCase("tr-TR"));
    accounts.unshift(clean);
    store.set("tiktok_accounts", accounts.slice(0, 10));
    store.set("tiktok_active_account", clean);
    platform?.disconnect();
    widgetKanaliniDegistir(clean);
    await widgetTikTokBaglantisiniKapat("Hesap seçildi. Yayına bağlanmak için Bağlan'a basın.");
    return { basarili: true, accounts: accounts.slice(0, 10), active: clean };
});
ipcMain.handle("tiktok-hesap-sec", async (_event, { username }) => {
    const clean = String(username || "").replace(/^@/, "").trim();
    const accounts = store.get("tiktok_accounts", []);
    if (!accounts.includes(clean)) return { basarili: false, hata: "Hesap bulunamadı." };
    store.set("tiktok_active_account", clean);
    platform?.disconnect();
    widgetKanaliniDegistir(clean);
    await widgetTikTokBaglantisiniKapat("Hesap seçildi. Yayına bağlanmak için Bağlan'a basın.");
    return { basarili: true, active: clean };
});
ipcMain.handle("tiktok-hesap-sil", async (_event, { username }) => {
    const clean = String(username || "").replace(/^@/, "").trim().toLocaleLowerCase("tr-TR");
    let accounts = store.get("tiktok_accounts", []).filter(item => String(item).replace(/^@/, "").trim().toLocaleLowerCase("tr-TR") !== clean);
    store.set("tiktok_accounts", accounts);
    let active = store.get("tiktok_active_account", "");
    if (String(active).replace(/^@/, "").trim().toLocaleLowerCase("tr-TR") === clean) {
        active = accounts[0] || "";
        store.set("tiktok_active_account", active);
    }
    widgetKanaliniDegistir(active);
    platform?.disconnect();
    await widgetTikTokBaglantisiniKapat("Hesap listesi değişti. Yayına bağlanmak için Bağlan'a basın.");
    return { basarili: true, accounts, active };
});
ipcMain.handle("tiktok-baglan", async (_event, { username }) => {
    const clean = String(username || store.get("tiktok_active_account", "")).replace(/^@/, "").trim();
    if (!clean) return { basarili: false, hata: "Önce TikTok kullanıcı adını ekleyin." };
    const accounts = store.get("tiktok_accounts", []);
    if (!accounts.some(item => String(item).toLowerCase() === clean.toLowerCase())) return { basarili: false, hata: "Kullanıcı adı önce hesap listesine eklenmeli." };
    store.set("tiktok_active_account", clean);
    widgetKanaliniDegistir(clean);
    if (platform?.source() === 'tikfinity') platform.connectTikfinity(clean);
    else widgetTikTokBagla(clean).catch(() => {});
    return { basarili: true, username: clean };
});
ipcMain.handle("tiktok-baglantiyi-kes", async () => {
    platform?.disconnect();
    await widgetTikTokBaglantisiniKapat("Bağlantı kesildi. Yeniden başlatmak için Bağlan'a basın.");
    return { basarili: true };
});
ipcMain.handle("widget-bilgisi", async () => ({
    studio: widgetStudio.state(widgetChannel),
    overlayTransport: overlayBridge?.status(),
    url: widgetYerelUrl("/widget-top-gift.html"),
    topGiftUrl: widgetYerelUrl("/widget-top-gift.html"),
    topLikesUrl: widgetYerelUrl("/widget-top-likes.html"),
    topLeaderboardUrl: widgetYerelUrl("/widget-leaderboard.html"),
    giftFeedUrl: widgetYerelUrl("/widget-gift-feed.html"),
    activityUrl: widgetYerelUrl("/widget-activity.html"),
    altGiftUrl: widgetYerelUrl("/widget-top-gift.html", "127.0.0.1"),
    altLikesUrl: widgetYerelUrl("/widget-top-likes.html", "127.0.0.1"),
    altLeaderboardUrl: widgetYerelUrl("/widget-leaderboard.html", "127.0.0.1"),
    previewGiftUrl: widgetYerelUrl("/widget/top-gift", "127.0.0.1"),
    previewLikesUrl: widgetYerelUrl("/widget/top-likes", "127.0.0.1"),
    previewLeaderboardUrl: widgetYerelUrl("/widget/leaderboard", "127.0.0.1"),
    previewGiftFeedUrl: widgetYerelUrl("/widget/gift-feed", "127.0.0.1"),
    previewActivityUrl: widgetYerelUrl("/widget/activity", "127.0.0.1"),
    widgets: WIDGET_DEFINITIONS.map(item => ({
        ...item,
        url: widgetKatmanUrl(item.id),
        broadcastUrl: overlayBridge?.urlFor(widgetKatmanUrl(item.id)) || '',
        previewUrl: widgetKatmanUrl(item.id, "127.0.0.1")
    })),
    widgetId: WIDGET_ACCESS_KEY.slice(0, 8),
    channel: widgetChannel,
    active: widgetChannel !== "varsayilan",
    liveStatus: widgetLiveStatus,
    ...widgetDurumu()
}));
ipcMain.handle('widget-studio-save', async (_event, { type, settings, screen } = {}) => {
    try { return { basarili: true, settings: widgetStudio.save(widgetChannel, type, settings, screen) }; }
    catch (error) { return { basarili: false, hata: error.message }; }
});
ipcMain.handle('widget-studio-test', async (_event, { type, screen } = {}) => {
    try { return { basarili: true, test: widgetStudio.test(widgetChannel, type, screen) }; }
    catch (error) { return { basarili: false, hata: error.message }; }
});
ipcMain.handle('widget-studio-reset', async (_event, { type, screen } = {}) => {
    try {
        widgetSahnesiniSifirla(type, screen);
        return { basarili: true };
    } catch (error) { return { basarili: false, hata: error.message }; }
});
ipcMain.handle("widget-test", async () => { widgetKaydiEkle({ username: "onizleme", nickname: "Önizleme", giftName: "TikTok", count: 2, coins: 2 }); return { basarili: true, ...widgetDurumu() }; });
ipcMain.handle("widget-sifirla", async () => { widgetPool = {}; store.set(widgetStoreKey("widget_top_gifts"), widgetPool); return { basarili: true }; });
ipcMain.handle("widget-like-test", async () => {
    const samples = [
        ["mng_lider", "MNG Lider", 2450], ["oyun_sever", "Oyun Sever", 1980], ["canli_yayin", "Canlı Yayın", 1640],
        ["neon_kral", "Neon Kral", 1220], ["terminalci", "Terminalci", 980], ["hediye_avcisi", "Hediye Avcısı", 860],
        ["orbit_fani", "Orbit Fanı", 740], ["gece_yayini", "Gece Yayını", 610], ["mavi_kalkan", "Mavi Kalkan", 530],
        ["hizli_kosucu", "Hızlı Koşucu", 420], ["son_savasci", "Son Savaşçı", 350], ["yayin_dostu", "Yayın Dostu", 260], ["oyuncu_13", "Oyuncu 13", 180]
    ];
    widgetLikePool = {};
    for (const [username, nickname, totalLikes] of samples) widgetBegeniKaydiEkle({ username, nickname, likeCount: totalLikes });
    return { basarili: true, ...widgetBegeniDurumu() };
});
ipcMain.handle("widget-like-sifirla", async () => { widgetLikePool = {}; store.set(widgetStoreKey("widget_top_likes"), widgetLikePool); return { basarili: true }; });
ipcMain.handle("widget-leaderboard-test", async () => {
    const samples = [
        ["mng_sampiyon", "MNG Şampiyon", 15400, 45],
        ["yildiz_destekci", "Yıldız Destekçi", 9800, 32],
        ["efsane_oyuncu", "Efsane Oyuncu", 6200, 20],
        ["kral_hediyeci", "Kral Hediyeci", 3500, 14],
        ["gece_kartali", "Gece Kartalı", 2100, 9],
        ["canli_yayin_dostu", "Canlı Dost", 1400, 6],
        ["altin_kalp", "Altın Kalp", 850, 4]
    ];
    widgetLeaderboardPool = {};
    for (const [username, nickname, totalCoins, count] of samples) {
        widgetLeaderboardKaydiEkle({ username, nickname, coins: totalCoins, count });
    }
    return { basarili: true, ...widgetLeaderboardDurumu() };
});
ipcMain.handle("widget-leaderboard-sifirla", async () => {
    widgetLeaderboardPool = {};
    store.set(widgetStoreKey("widget_leaderboard"), widgetLeaderboardPool);
    return { basarili: true };
});
ipcMain.handle("widget-activity-sifirla", async () => {
    widgetActivityPool = [];
    store.set(widgetStoreKey("widget_activity"), widgetActivityPool);
    return { basarili: true };
});
ipcMain.handle("widget-universal-test", async (_event, { type } = {}) => {
    const id = String(type || "myactions");
    const giftTypes = new Set(["cannon", "firework", "gifts", "transactionviewer", "userinfo", "topgift", "myactions", "carousel", "topgifter", "ranking", "coindrop", "streambuddies", "coinjar", "tinydiny"]);
    if (giftTypes.has(id)) {
        widgetKaydiEkle({ username: "mng_destekci", nickname: "MNG Destekçi", giftId: "5655", giftName: "Gül", count: 5, repeatCount: 5, coins: 5 });
    } else if (["likefountain", "topliker"].includes(id)) {
        widgetBegeniKaydiEkle({ username: "kalp_yagmuru", nickname: "Kalp Yağmuru", likeCount: 240 });
    } else if (["chat", "emojify", "commandinfo", "songrequests", "wheel"].includes(id)) {
        widgetGenelOlayEkle("chat", { username: "yayin_dostu", nickname: "Yayın Dostu", message: id === "songrequests" ? "!play En sevdiğim şarkı" : id === "commandinfo" ? "!puan" : id === "wheel" ? "!wheel" : "Harika yayın! ❤️🔥👏" });
    } else if (id === "viewercount") {
        widgetGenelOlayEkle("viewer", { username: "TikTok LIVE", viewerCount: 128, count: 128 });
    } else {
        widgetGenelOlayEkle("follow", { username: "yeni_takipci", nickname: "Yeni Takipçi" });
    }
    return { basarili: true, state: widgetBirlesikDurum() };
});
ipcMain.handle("widget-universal-reset", async (_event, { type } = {}) => {
    const id = String(type || "");
    if (id === "topgift") {
        widgetPool = {};
        store.set(widgetStoreKey("widget_top_gifts"), widgetPool);
    }
    if (["topgifter", "ranking", "streambuddies"].includes(id)) {
        widgetLeaderboardPool = {};
        store.set(widgetStoreKey("widget_leaderboard"), widgetLeaderboardPool);
    }
    if (["topliker", "likefountain", "ranking"].includes(id)) {
        widgetLikePool = {};
        store.set(widgetStoreKey("widget_top_likes"), widgetLikePool);
    }
    if (id === "coinjar") {
        widgetJarPool = [];
        store.set(widgetStoreKey("widget_jar_gifts"), widgetJarPool);
    }
    if (["cannon", "firework", "gifts", "transactionviewer", "userinfo", "commandinfo", "myactions", "carousel", "wheel", "coindrop", "songrequests", "tinydiny", "chat", "emojify"].includes(id)) {
        widgetActivityPool = [];
        store.set(widgetStoreKey("widget_activity"), widgetActivityPool);
    }
    if (["viewercount", "tinydiny", "likefountain"].includes(id)) {
        widgetMetaPool = { ...widgetMetaPool, totalLikes: 0, totalCoins: 0, totalGifts: 0, totalShares: 0, viewerCount: 0 };
        store.set(widgetStoreKey("widget_meta"), widgetMetaPool);
    }
    return { basarili: true };
});

// =====================================================================
// OYUN DURUMLARI VE MODÜLER KURULUM IPC
// =====================================================================

// Oyunların Kurulum Durumları (Kurulu mu, boyutu nedir)
ipcMain.handle("oyun-durumlari", async () => {
    if (platform) return platform.statuses();
    return {
        "battle-royale": {
            kurulu: oyunKuruluMu("battle-royale"), ad: OYUN_TANIMLARI["battle-royale"].ad,
            boyut: OYUN_TANIMLARI["battle-royale"].boyut
        },
        "snow-war": {
            kurulu: oyunKuruluMu("snow-war"), ad: OYUN_TANIMLARI["snow-war"].ad,
            boyut: OYUN_TANIMLARI["snow-war"].boyut
        },
        vs: {
            kurulu: oyunKuruluMu("vs"),
            ad: OYUN_TANIMLARI.vs.ad,
            boyut: OYUN_TANIMLARI.vs.boyut
        },
        puanlama: {
            kurulu: oyunKuruluMu("puanlama"),
            ad: OYUN_TANIMLARI.puanlama.ad,
            boyut: OYUN_TANIMLARI.puanlama.boyut
        },
        orbit: {
            kurulu: oyunKuruluMu("orbit"),
            ad: OYUN_TANIMLARI.orbit.ad,
            boyut: OYUN_TANIMLARI.orbit.boyut
        },
        "crowd-control": {
            kurulu: oyunKuruluMu("crowd-control"),
            ad: OYUN_TANIMLARI["crowd-control"].ad,
            boyut: OYUN_TANIMLARI["crowd-control"].boyut
        },
        crowdControl: {
            kurulu: oyunKuruluMu("crowd-control"),
            ad: OYUN_TANIMLARI["crowd-control"].ad,
            boyut: OYUN_TANIMLARI["crowd-control"].boyut
        },
        "battle-game": {
            kurulu: oyunKuruluMu("battle-game"),
            ad: OYUN_TANIMLARI["battle-game"].ad,
            boyut: OYUN_TANIMLARI["battle-game"].boyut
        },
        "gelene-gecene": {
            kurulu: oyunKuruluMu("gelene-gecene"),
            steamKurulu: Boolean(unturnedKlasoruBul()),
            ad: OYUN_TANIMLARI["gelene-gecene"].ad,
            boyut: OYUN_TANIMLARI["gelene-gecene"].boyut
        },
        "duck-hunt": {
            kurulu: oyunKuruluMu("duck-hunt"),
            ad: OYUN_TANIMLARI["duck-hunt"].ad,
            boyut: OYUN_TANIMLARI["duck-hunt"].boyut
        },
        "pony-life": {
            kurulu: oyunKuruluMu("pony-life"),
            ad: OYUN_TANIMLARI["pony-life"].ad,
            boyut: OYUN_TANIMLARI["pony-life"].boyut
        },
        "frog-river": {
            kurulu: oyunKuruluMu("frog-river"),
            ad: OYUN_TANIMLARI["frog-river"].ad,
            boyut: OYUN_TANIMLARI["frog-river"].boyut
        },
        "penalty-kick": {
            kurulu: oyunKuruluMu("penalty-kick"),
            ad: OYUN_TANIMLARI["penalty-kick"].ad,
            boyut: OYUN_TANIMLARI["penalty-kick"].boyut
        },
        "tightrope-balance": {
            kurulu: oyunKuruluMu("tightrope-balance"),
            ad: OYUN_TANIMLARI["tightrope-balance"].ad,
            boyut: OYUN_TANIMLARI["tightrope-balance"].boyut
        },
        "zombie-war": {
            kurulu: oyunKuruluMu("zombie-war"), ad: OYUN_TANIMLARI["zombie-war"].ad,
            boyut: OYUN_TANIMLARI["zombie-war"].boyut
        }
    };
});

// Modüler Oyun Kurulumu / İndirme (Fail-safe, 0 bozulma riski)
ipcMain.handle("oyun-kur", async (event, { oyun }) => {
    if (platform && oyun !== 'gelene-gecene') return platform.install(oyun);
    const tanim = OYUN_TANIMLARI[oyun];
    if (!tanim) {
        return { basarili: false, hata: "Geçersiz oyun seçimi!" };
    }

    // Oyun zaten kuruluysa hiçbir işlem yapma, anında başarılı dön
    if (oyunKuruluMu(oyun)) {
        return { basarili: true, mesaj: `${tanim.ad} zaten kurulu ve oynamaya hazır!` };
    }


    if (oyun === "gelene-gecene" && !unturnedKlasoruBul()) {
        await shell.openExternal("steam://install/304930");
        return { basarili: false, steamGerekli: true, hata: "Önce ücretsiz Unturned kurulmalı. Steam kurulum sayfası açıldı; kurulum bitince KUR düğmesine yeniden basın." };
    }

    try {
        const serverUrl = lisansSunucuUrlBul();
        const pinnedRelease = ['zombie-war', 'penalty-kick', 'tightrope-balance', 'orbit', 'battle-royale', 'snow-war'].includes(oyun);
        const indirmeUrl = pinnedRelease
            ? (tanim.paketUrl || `https://github.com/maNgao7/mng-license-server1/releases/download/v${tanim.paketSurumu}/${tanim.klasor}.zip`)
            : `${serverUrl}/download/game/${tanim.klasor}.zip`;
        const tempZip = path.join(os.tmpdir(), `mng_game_${tanim.klasor}.zip`);
        const hedefKlasor = oyun === "gelene-gecene"
            ? geleneGeceneModKlasoru()
            : path.join(app.getPath("userData"), "games", tanim.klasor);

        if (!fs.existsSync(hedefKlasor)) {
            fs.mkdirSync(hedefKlasor, { recursive: true });
        }

        mainWindow?.webContents.send("oyun-kurulum-ilerleme", {
            oyun,
            percent: 0,
            transferredMB: "0.0",
            totalMB: tanim.boyut,
            mesaj: `${tanim.ad} indiriliyor...`
        });

        let zipKaynagi = tempZip;
        let indirmeBasarili = false;

        try {
            await dosyaIndir(indirmeUrl, tempZip, (prog) => {
                mainWindow?.webContents.send("oyun-kurulum-ilerleme", {
                    oyun,
                    percent: prog.percent,
                    transferredMB: prog.transferredMB,
                    totalMB: prog.totalMB,
                    mesaj: `${tanim.ad} indiriliyor...`
                });
            });
            indirmeBasarili = true;
        } catch (downloadErr) {
            console.warn("Sunucudan indirme başarısız, yerel paket kontrol ediliyor:", downloadErr.message);
            const yerelAdaylar = [
                path.join(process.resourcesPath, "packages", `${tanim.klasor}.zip`),
                path.join(__dirname, "packages", `${tanim.klasor}.zip`),
                path.join(__dirname, "..", "packages", `${tanim.klasor}.zip`),
                path.join(process.cwd(), "packages", `${tanim.klasor}.zip`)
            ];
            const bulunanPaket = yerelAdaylar.find(p => fs.existsSync(p));
            if (bulunanPaket) {
                for (let p = 20; p <= 85; p += 25) {
                    mainWindow?.webContents.send("oyun-kurulum-ilerleme", {
                        oyun,
                        percent: p,
                        transferredMB: `${(p * 2.8).toFixed(1)}`,
                        totalMB: tanim.boyut,
                        mesaj: `${tanim.ad} hazırlanıyor...`
                    });
                    await new Promise(r => setTimeout(r, 120));
                }
                zipKaynagi = bulunanPaket;
                indirmeBasarili = true;
            } else {
                throw downloadErr;
            }
        }

        mainWindow?.webContents.send("oyun-kurulum-ilerleme", {
            oyun,
            percent: 92,
            transferredMB: "",
            totalMB: "",
            mesaj: "Paket açılıyor ve kuruluyor..."
        });

        // Gelene Geçene yeniden kurulurken yayıncının seçtiği hediyeleri ve
        // canavar ayarlarını koru; yalnızca paket dosyaları yenilensin.
        let korunanGeleneGeceneAyari = "";
        const geleneConfigPath = path.join(hedefKlasor, "unturned_mng_config.json");
        if (oyun === "gelene-gecene" && fs.existsSync(geleneConfigPath)) {
            try {
                const current = fs.readFileSync(geleneConfigPath, "utf8");
                JSON.parse(current);
                korunanGeleneGeceneAyari = current;
            } catch {}
        }

        // Paketi önce geçici bir alana aç ve çalıştığını doğrula. Böylece yarım
        // indirme veya arşiv içindeki fazladan üst klasör mevcut oyunu bozmaz.
        const stagingKlasoru = path.join(os.tmpdir(), `tikmng_install_${tanim.klasor}_${Date.now()}`);
        try {
            await zipArsiviniAc(zipKaynagi, stagingKlasoru);
            if (oyun === "gelene-gecene") {
                fs.cpSync(stagingKlasoru, hedefKlasor, { recursive: true, force: true });
            } else {
                const paketKoku = oyunPaketKokuBul(stagingKlasoru, oyun);
                if (!paketKoku) {
                    throw new Error("Oyun paketinin ana dosyaları bulunamadı. Paket eksik veya yanlış klasör yapısında.");
                }
                if (pinnedRelease) {
                    const markerPath = path.join(paketKoku, '.tikmng-package.json');
                    const packageInfo = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
                    if (String(packageInfo.version) !== String(tanim.paketSurumu)) {
                        throw new Error(`İndirilen oyun sürümü ${packageInfo.version || 'bilinmiyor'}, gereken sürüm ${tanim.paketSurumu}. Lütfen yeniden deneyin.`);
                    }
                }
                const preserved = new Map();
                const settingsFiles = tanim.minecraft
                    ? [`game-instance/config/${tanim.configFile}`, 'game-instance/options.txt']
                    : oyun === 'tightrope-balance' ? ['settings.json'] : oyun === 'zombie-war' ? ['game-instance/config/mng-zombie-strike.json','game-instance/options.txt'] : [];
                for (const relative of settingsFiles) {
                    const file = path.join(hedefKlasor, relative);
                    if (fs.existsSync(file)) preserved.set(relative, fs.readFileSync(file));
                }
                fs.cpSync(paketKoku, hedefKlasor, { recursive: true, force: true });
                for (const [relative, content] of preserved) fs.writeFileSync(path.join(hedefKlasor, relative), content);
            }
        } catch (extractErr) {
            throw new Error("Dosya arşivden kurulamadı: " + extractErr.message);
        } finally {
            try { fs.rmSync(stagingKlasoru, { recursive: true, force: true }); } catch {}
        }

        if (oyun === "gelene-gecene") {
            if (!geleneGecenePaketiniDogrulaVeIsaretle(hedefKlasor)) {
                throw new Error("Modun ana dosyaları paketten çıkarılamadı. Paket bozuk veya eksik.");
            }
            eskiGeleneGeceneDllleriniAyikla(hedefKlasor);
            if (korunanGeleneGeceneAyari) fs.writeFileSync(geleneConfigPath, korunanGeleneGeceneAyari, "utf8");
        } else {
            fs.writeFileSync(path.join(hedefKlasor, ".tikmng-package.json"), JSON.stringify({
                game: tanim.klasor,
                version: tanim.paketSurumu || app.getVersion(),
                installedAt: new Date().toISOString()
            }, null, 2), "utf8");
        }

        if (zipKaynagi === tempZip) {
            try { fs.unlinkSync(tempZip); } catch {}
        }

        if (!oyunKuruluMu(oyun)) {
            throw new Error("Oyun paketinden çıkarıldı fakat doğrulanamadı.");
        }

        mainWindow?.webContents.send("oyun-kurulum-bitti", {
            oyun,
            mesaj: `${tanim.ad} başarıyla kuruldu!`
        });

        return { basarili: true, mesaj: `${tanim.ad} başarıyla kuruldu!` };
    } catch (hata) {
        return { basarili: false, hata: hata.message };
    }
});

// İsteğe Bağlı Oyun Kaldırma (Sadece userData içindeki indirilenleri siler, ana pakete asla dokunmaz)
ipcMain.handle("oyun-kaldir", async (event, { oyun }) => {
    const tanim = OYUN_TANIMLARI[oyun];
    if (!tanim) return { basarili: false, hata: "Geçersiz oyun!" };
    try {
        const userDataPath = path.join(app.getPath("userData"), "games", tanim.klasor);
        if (fs.existsSync(userDataPath)) {
            fs.rmSync(userDataPath, { recursive: true, force: true });
        }
        return { basarili: true };
    } catch (e) {
        return { basarili: false, hata: e.message };
    }
});

let aktifOyun = null;
const minecraftProcesses = new Map();
const { GameLaunchSession } = require('./lib/game-launch-session.cjs');
let oyunOturumu = null;
let oyunBaslatmaSirasi = Promise.resolve();

function oyunDurumunuGonder(payload) {
    try { if (!mainWindow?.isDestroyed()) mainWindow?.webContents.send('durum', payload); } catch {}
}

function oyunOturumuOlustur(oyun) {
    const session = new GameLaunchSession({
        game: oyun, title: OYUN_TANIMLARI[oyun]?.ad || oyun,
        onProgress: oyunDurumunuGonder,
        onClosed: error => {
            if (oyunOturumu !== session) return;
            aktifOyun = null;
            if (appWindow === session.window) appWindow = null;
            if (!session.cleanupError) oyunOturumu = null;
            try { mainWindow?.webContents.send('oyun-kapandi'); } catch {}
            if (error) oyunDurumunuGonder({ oyun, tip: 'hata', phase: 'failed', mesaj: error.message });
        }
    });
    oyunOturumu = session;
    aktifOyun = oyun;
    const owner = mainWindow;
    const close = () => { void session.close(); };
    owner?.once('closed', close);
    session.disposers.add(() => owner?.removeListener('closed', close));
    return session;
}

// Only children created by this session are stopped; port owners are never killed here.
async function oyunOturumuSunucusunuBaslat(session, oyun) {
    const runtime = nodeBilgisiBul();
    const gameDir = oyunKlasoruBul(oyun);
    const pony = oyun === 'pony-life';
    const port = oyun === 'orbit' ? ORBIT_PORT
        : oyun === 'crowd-control' || oyun === 'crowdControl' ? CROWD_CONTROL_PORT
        : oyun === 'battle-game' ? BATTLE_GAME_PORT
        : oyun === 'duck-hunt' ? DUCK_HUNT_PORT
        : pony ? PONY_LIFE_PORT : oyun === 'frog-river' ? FROG_RIVER_PORT
        : oyun === 'penalty-kick' ? PENALTY_KICK_PORT
        : oyun === 'tightrope-balance' ? TIGHTROPE_BALANCE_PORT : APP_PORT;
    const file = path.join(gameDir, pony ? 'server' : '', pony ? 'index.js' : 'server.js');
    if (!fs.existsSync(file)) throw new Error(`Oyun sunucusu bulunamadı: ${file}`);
    const env = { ...runtime.env, PORT: port, MNG_GAME_ID: oyun };
    if (oyun === 'vs' || oyun === 'puanlama' || oyun === 'orbit') env.MNG_BACKGROUNDS_DIR = arkaPlanKlasoru();
    if (pony) Object.assign(env, { PONY_PORT: port, PONY_WIDGET_PORT, PONY_STATE_FILE: path.join(app.getPath('userData'), 'pony-life.json') });
    if (oyun === 'frog-river') env.FROG_PORT = String(port);
    const child = session.ownChild(spawn(runtime.komut, [file], {
        cwd: gameDir, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    }), { name: `${OYUN_TANIMLARI[oyun]?.ad || oyun} sunucusu` });
    child.mngWidgetGame = { game: oyun, port: pony ? PONY_WIDGET_PORT : port };
    const healthPath = ['vs', 'puanlama', 'orbit'].includes(oyun) ? '/' : '/api/health';
    await session.waitForHttp(`http://127.0.0.1:${port}${healthPath}`);
}

async function geleneGeceneOturumKoprusunuBaslat(session, modDir) {
    const candidates = [path.join(modDir, 'tiktok_unturned_bridge.js'),
        app.isPackaged ? path.join(process.resourcesPath, 'apps', 'tiktok-vs', 'tiktok_unturned_bridge.js') : '',
        path.join(__dirname, '..', 'apps', 'tiktok-vs', 'tiktok_unturned_bridge.js')].filter(Boolean);
    const file = candidates.find(candidate => fs.existsSync(candidate) && fs.existsSync(path.join(path.dirname(candidate), 'node_modules')));
    if (!file) throw new Error('TikTok canlı yayın köprüsü veya bağımlılıkları bulunamadı. Launcherı yeniden kurun.');
    const directory = path.dirname(file);
    const packageFile = path.join(directory, 'package.json');
    let validPackage = false;
    try { validPackage = JSON.parse(fs.readFileSync(packageFile, 'utf8').replace(/^\uFEFF/, '')).type === 'module'; } catch {}
    if (!validPackage) fs.writeFileSync(packageFile, JSON.stringify({ name: 'unturned-mng-bridge', version: '6.5.0', type: 'module' }, null, 2), 'utf8');
    const runtime = nodeBilgisiBul();
    const logDir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    const log = fs.createWriteStream(path.join(logDir, 'gelene-gecene-bridge.log'), { flags: 'a' });
    const logError = error => { void session.close(new Error(`Köprü kaydı yazılamadı: ${error.message}`)); };
    log.on('error', logError);
    session.disposers.add(() => log.end());
    const child = session.ownChild(spawn(runtime.komut, [file], {
        cwd: directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...runtime.env, PORT: '8088', NODE_PATH: path.join(directory, 'node_modules'), MNG_UNTURNED_MOD_DIR: modDir }
    }), { name: 'TikTok canlı yayın köprüsü' });
    child.stdout?.pipe(log, { end: false });
    child.stderr?.pipe(log, { end: false });
    session.disposers.add(() => { child.stdout?.unpipe(log); child.stderr?.unpipe(log); });
    await session.waitForHttp('http://127.0.0.1:8088/status', { validate: status => Boolean(status.bridgeVersion || status.status) });
}

async function minecraftOyunuAc(oyun, session) {
    const gameDir = oyunKlasoruBul(oyun);
    const runtime = nodeBilgisiBul();
    const javaOwnedLive = require('./lib/native-game.cjs').nativeOwnsLiveSession(oyun, gameDir);
    session.progress('engine', 'Oyun motoru başlatılıyor; hazır sinyali bekleniyor...');
    const child = session.ownChild(spawn(runtime.komut, [path.join(gameDir, 'launch-game.cjs')], {
        cwd: gameDir, env: { ...runtime.env,
            ...(javaOwnedLive && session.tiktokUser ? { MNG_TIKTOK_USER: session.tiktokUser } : {}),
            ...(oyun === 'minecraft-snake-arena' ? {
                MNG_SNAKE_RELAY_CONTEXT: JSON.stringify({ serverURL: lisansSunucuUrlBul(),
                    licenseCode: store.get('lisans_kod', ''), deviceId: CIHAZ_KIMLIK })
            } : {}) },
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    }), { normalExit: true });
    if (oyun === 'zombie-war') zombieWarProcess = child;
    else minecraftProcesses.set(oyun, child);
    session.disposers.add(() => {
        if (minecraftProcesses.get(oyun) === child) minecraftProcesses.delete(oyun);
        if (zombieWarProcess === child) zombieWarProcess = null;
    });
    await session.waitForMarker(child);
    // These Java clients own the event session; a second /connect would orphan it.
    if (session.tiktokUser && !javaOwnedLive) {
        try {
            const argumentsText = fs.readFileSync(path.join(gameDir, 'game-instance', 'launch-args.txt'), 'utf8');
            if (argumentsText.length > 1024 * 1024) throw new Error('Invalid launch arguments');
            const args = argumentsText.split(/\r?\n/).map(line => { try { return JSON.parse(line); } catch { return null; } });
            const argument = args.find(value => typeof value === 'string' && /^-Dmng\.bridge\.port=\d{1,5}$/.test(value));
            const port = Number(argument?.split('=')[1]);
            if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Missing owned bridge port');
            session.accountBaseURL = `http://127.0.0.1:${port}/`;
            await oyunYayinHesabiniIlet(session, oyun, session.accountBaseURL, session.tiktokUser);
        } catch {
            oyunDurumunuGonder({ oyun, tip: 'hesap-uyari', mesaj: 'Oyunun yayın bağlantısı otomatik bulunamadı. Oyun içindeki yayın hesabını kontrol edin.' });
        }
    }
    session.markReady();
    return { basarili: true };
}

async function oyunYayinHesabiniIlet(session, gameId, baseURL, username) {
    if (!username) return;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    session.disposers.add(cancel);
    try {
        session.progress('account', 'Yayın hesabı oyuna iletiliyor...');
        await require('./lib/game-account-handoff.cjs').handoffGameAccount({ gameId, baseURL, username, signal: controller.signal });
    } catch {
        if (!session.closed) oyunDurumunuGonder({ oyun: gameId, tip: 'hesap-uyari', mesaj: 'Yayın hesabı oyuna otomatik iletilemedi. Oyun içindeki bağlantı durumunu kontrol edin.' });
    } finally { session.disposers.delete(cancel); }
}

let oyunKapanisiBekleniyor = false;
app.on('before-quit', event => {
    if (!oyunOturumu) return;
    event.preventDefault();
    if (oyunKapanisiBekleniyor) return;
    oyunKapanisiBekleniyor = true;
    oyunOturumu.close().then(() => { oyunOturumu = null; oyunKapanisiBekleniyor = false; app.quit(); });
});

ipcMain.handle('uygulamayi-ac', (event, options) => {
    const launch = oyunBaslatmaSirasi.then(() => uygulamayiAc(options || {}));
    oyunBaslatmaSirasi = launch.catch(() => {});
    return launch;
});

async function sesliSurusPaketiniHazirla(session) {
    const supportDirectory = platform?.pathFor('caahr');
    const hasPackage = supportDirectory && fs.existsSync(path.join(supportDirectory, 'manifest.json'));
    const gameDirectory = require('./lib/native-game.cjs').findVoiceDrivingGame({ requireMod: !hasPackage });
    if (!gameDirectory) throw new Error('Önce Steam\'den indir düğmesiyle ücretsiz CAAAHR! Demo oyununu kurun.');
    if (!hasPackage) return gameDirectory;
    const dataDirectory = preview.enabled ? path.join(app.getPath('userData'), 'voice-driving') : path.join(app.getPath('appData'), '..', 'Local', 'TikMnG-CAAAHR');
    const support = require('./lib/voice-driving-package.cjs');
    let service;
    try { const response = await fetch('http://127.0.0.1:4051/api/state', { signal: AbortSignal.timeout(2000) }); if(response.ok)service=await response.json(); else throw new Error('Port kullanımda.'); }
    catch(error) { if(error.message==='Port kullanımda.')throw new Error('4051 portu başka bir hizmet tarafından kullanılıyor.'); }
    if(service && service.product!=='tikmng-caaahr-voice')throw new Error('4051 portu başka bir uygulama tarafından kullanılıyor.');
    const tokenFile = path.join(dataDirectory, 'token');
    if(service){
        let accepted=false;
        try{const token=fs.readFileSync(tokenFile,'utf8').trim();const response=await fetch('http://127.0.0.1:4051/mod/state',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(2000)});accepted=response.ok;}catch{}
        if(!accepted)throw new Error('Başka bir Sesli Sürüş oturumu açık. Onu kapatıp yeniden deneyin.');
    }
    const prepared = await session.stage('mod', 'Sesli Sürüş eklentisi doğrulanıyor...', () => support.prepareLaunch({
        gameDirectory, packageDirectory: supportDirectory, dataDirectory, ...(!service ? {electronPath:process.execPath} : {})
    }), 60000);
    console.info('[Sesli Surus startup]', JSON.stringify(prepared.timings));
    if(!service){
        const launch=prepared.backend;
        session.ownChild(spawn(launch.file,launch.args,launch.options),{name:'Sesli Sürüş yayın hizmeti'});
        await session.waitForHttp(launch.url+'/api/state',{timeoutMs:30000,validate:state=>state.product==='tikmng-caaahr-voice'});
    }
    fs.writeFileSync(path.join(gameDirectory,'BepInEx/config/TikMnG.LocalConnection.token'),fs.readFileSync(tokenFile,'utf8').trim());
    return gameDirectory;
}

async function uygulamayiAc({ uygulama, tiktokUser, orbitSettings, orbitTest, orbitTestLabel }) {
    if (['crowd-control', 'crowdControl'].includes(uygulama)) return { basarili: false, hata: 'MNG Crowd Control oyun kütüphanesinden kaldırıldı.' };
    let session = null;
    try {
        // 1. Lisans Kontrolü (Süre bittiyse kesinlikle başlatılamaz!)
        const kod = store.get("lisans_kod");
        const bitis = store.get("lisans_bitis");
        const isUnlimited = store.get("is_unlimited");

        if (!kod) {
            return { basarili: false, hata: "Lisans kodu bulunamadı. Lütfen geçerli bir lisans girin." };
        }

        if (!isUnlimited && bitis && Date.now() > Number(bitis)) {
            return { basarili: false, hata: "Lisans süreniz dolmuştur! Uygulamaya giriş engellendi. Lütfen yeni bir lisans anahtarı temin edin." };
        }

        // 2. Oyun Kurulum Kontrolü (Kurulmadıysa çalıştırma)
        if (!oyunKuruluMu(uygulama)) {
            return { basarili: false, hata: "Bu oyun henüz yüklenmemiş! Lütfen kart üzerindeki 'KUR / YÜKLE' butonuna basarak oyunu yükleyin." };
        }


        if (app.isQuiting) throw new Error('Launcher kapanırken oyun başlatılamaz.');
        const launchKey = JSON.stringify({ uygulama, tiktokUser, orbitSettings, orbitTest, orbitTestLabel });
        if (oyunOturumu?.ready && !oyunOturumu.closed && oyunOturumu.launchKey === launchKey) {
            if (appWindow && !appWindow.isDestroyed()) { appWindow.restore(); appWindow.show(); appWindow.focus(); }
            else if (oyunOturumu.nativeChild?.pid) await require('./lib/native-window.cjs').showNativeWindow(oyunOturumu.nativeChild.pid);
            oyunOturumu.markReady();
            return { basarili: true };
        }
        if (oyunOturumu) {
            oyunDurumunuGonder({ oyun: uygulama, tip: 'baslatiliyor', phase: 'stopping', mesaj: 'Önceki oyun kapatılıyor...' });
            const previous = oyunOturumu;
            await previous.close();
            if (previous.cleanupError) throw previous.cleanupError;
        }

        if(platform&&['frog-river','caahr'].includes(uygulama)){
            oyunDurumunuGonder({oyun:uygulama,tip:'baslatiliyor',phase:'game-update',mesaj:'Oyunun gerekli düzeltmesi hazırlanıyor. Ayarlarınız korunuyor...'});
            await require('./lib/required-game-hotfix.cjs').ensureRequiredGameHotfix({gameId:uygulama,state:platform.statuses()[uygulama],install:id=>platform.install(id)});
        }
        session = oyunOturumuOlustur(uygulama);
        session.launchKey = launchKey;
        session.tiktokUser = String(tiktokUser || store.get('tiktok_active_account', '') || '').trim().replace(/^@/, '');
        const nativeExecutable = OYUN_TANIMLARI[uygulama]?.nativeExecutable;
        const nativeGame = nativeExecutable || OYUN_TANIMLARI[uygulama]?.minecraft || uygulama === 'zombie-war';
        const ports = nativeGame ? [] : uygulama === 'gelene-gecene' ? [8088]
            : uygulama === 'orbit' ? [APP_PORT, ORBIT_PORT]
            : uygulama === 'crowd-control' || uygulama === 'crowdControl' ? [CROWD_CONTROL_PORT]
            : uygulama === 'battle-game' ? [BATTLE_GAME_PORT]
            : uygulama === 'duck-hunt' ? [DUCK_HUNT_PORT]
            : uygulama === 'pony-life' ? [PONY_LIFE_PORT, PONY_WIDGET_PORT]
            : uygulama === 'frog-river' ? [FROG_RIVER_PORT]
            : uygulama === 'penalty-kick' ? [PENALTY_KICK_PORT]
            : uygulama === 'tightrope-balance' ? [TIGHTROPE_BALANCE_PORT] : [APP_PORT];
        await session.stage('connections', 'Oyun bağlantıları kontrol ediliyor...', () =>
            require('./lib/preview-ports.cjs').assertPreviewPortsAvailable(preview.enabled ? [31975, ...ports] : ports));
        if (nativeExecutable) {
            const nativeDirectory = await sesliSurusPaketiniHazirla(session);
            const child = await session.stage('engine', 'Oyun başlatılıyor...', () =>
                require('./lib/native-game.cjs').launchNativeGame({
                    session, directory: nativeDirectory, executable: nativeExecutable
                }));
            session.nativeChild = child;
            await session.stage('window', 'Oyun penceresi hazırlanıyor...', () => require('./lib/native-window.cjs').showNativeWindow(child.pid), 40000);
            await session.stage('game-ready', 'Hediye bağlantısı ve oyun menüsü hazırlanıyor...', () => session.waitForHttp('http://127.0.0.1:4051/api/state', {
                timeoutMs: 60000, validate: status => status.product === 'tikmng-caaahr-voice' && status.game?.processId === child.pid && status.game.menuReady && Date.now() - status.game.receivedAt < 3000 && status.game.catalogCount >= 1
            }), 65000);
            session.accountBaseURL = 'http://127.0.0.1:4051/';
            await oyunYayinHesabiniIlet(session, uygulama, session.accountBaseURL, session.tiktokUser);
            session.markReady('Oyun penceresi ve hediye bağlantısı hazır.');
            return { basarili: true };
        }
        if (nativeGame) return await minecraftOyunuAc(uygulama, session);
        if (uygulama === "gelene-gecene") {
            const modDir = geleneGeceneModKlasoru();
            eskiGeleneGeceneDllleriniAyikla(modDir);
            const configPath = path.join(modDir, "unturned_mng_config.json");
            if (tiktokUser && fs.existsSync(configPath)) {
                try {
                    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
                    config.username = String(tiktokUser).replace(/^@/, "").trim();
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
                } catch {}
            }
            await session.stage('server', 'Canlı yayın köprüsü başlatılıyor...', () => geleneGeceneOturumKoprusunuBaslat(session, modDir));
            const autoUser = String(tiktokUser || store.get("tiktok_active_account", "") || "").replace(/^@/, "").trim();
            if (autoUser) {
                httpGet(`http://127.0.0.1:8088/connect?username=${encodeURIComponent(autoUser)}`).catch(() => {});
            }
            await session.stage('external', 'Steam oyun başlatma isteği gönderiliyor...', () => shell.openExternal('steam://run/304930'));
            session.markReady('Steam oyun başlatma isteği gönderildi.');
            return { basarili: true };
        }

        await session.stage('assets', 'Oyun görselleri hazırlanıyor...', () =>
            require('./lib/shared-game-assets.cjs').prepareSharedGameAssets({
                gameDirectory: oyunKlasoruBul(uygulama), libraryRoot: platform.snapshot().libraryRoot,
                bundledAssets: path.join(__dirname, 'renderer', 'gift-assets')
            }), 120000);

        if (uygulama === "orbit") {
            if (!fs.existsSync(path.join(appKlasoruBul(), 'server.js'))) {
                const dependency = await session.stage('dependency', 'Ortak profil servisi hazırlanıyor...', () => platform.install('vs'), 180000);
                if (!dependency.basarili) throw new Error(dependency.hata);
            }
            await session.stage('profile-server', 'Ortak profil sunucusu başlatılıyor...', () => oyunOturumuSunucusunuBaslat(session, 'vs'));
        }
        await session.stage('server', 'Oyun sunucusu başlatılıyor...', () => oyunOturumuSunucusunuBaslat(session, uygulama));

        const gameTitle = uygulama === "vs" ? "TikTok VS Profil"
            : (uygulama === "crowd-control" || uygulama === "crowdControl") ? "Crowd Control"
            : uygulama === "orbit" ? "Orbit Balonları"
            : uygulama === "battle-game" ? "Şövalye Savaşı"
            : uygulama === "duck-hunt" ? "MNG Dodge Hunter"
            : uygulama === "pony-life" ? "Pony Katırı"
            : uygulama === "frog-river" ? "Vak Vak Jump"
            : uygulama === "penalty-kick" ? "Süper Lig (Penaltı)"
            : uygulama === "tightrope-balance" ? "Dengesiz Yayıncı"
            : "Profil Puanlama";
        let baseUrl = (uygulama === "crowd-control" || uygulama === "crowdControl")
            ? `http://localhost:${CROWD_CONTROL_PORT}`
            : uygulama === "orbit" ? `http://localhost:${ORBIT_PORT}`
            : uygulama === "battle-game" ? `http://localhost:${BATTLE_GAME_PORT}`
            : uygulama === "duck-hunt" ? `http://localhost:${DUCK_HUNT_PORT}`
            : uygulama === "pony-life" ? `http://localhost:${PONY_LIFE_PORT}`
            : uygulama === "frog-river" ? `http://localhost:${FROG_RIVER_PORT}`
            : uygulama === "penalty-kick" ? `http://localhost:${PENALTY_KICK_PORT}`
            : uygulama === "tightrope-balance" ? `http://localhost:${TIGHTROPE_BALANCE_PORT}`
            : `http://localhost:${APP_PORT}`;
        if (uygulama === "puanlama") baseUrl += "?app=puanlama";
        let targetUrl = baseUrl;
        if (uygulama === "orbit") {
            const raw = JSON.stringify({ ...(orbitSettings || {}), test: orbitTest, testLabel: orbitTestLabel });
            if (raw.length <= 12000) targetUrl += "?orbitConfig=" + encodeURIComponent(Buffer.from(raw).toString("base64url"));
        }
        const autoUser = session.tiktokUser;
        if (autoUser) targetUrl += (targetUrl.includes("?") ? "&" : "?") + "autoUser=" + encodeURIComponent(autoUser);
        session.accountBaseURL = baseUrl.split('?')[0] + '/';

        // These packages do not consume the legacy autoUser query parameter.
        if (['duck-hunt', 'penalty-kick', 'frog-river', 'pony-life', 'tightrope-balance'].includes(uygulama)) {
            await oyunYayinHesabiniIlet(session, uygulama, baseUrl.split('?')[0] + '/', session.tiktokUser);
        }

        session.progress('window', 'Oyun penceresi yükleniyor...');
        appWindow = new BrowserWindow({
            width: 1280,
            height: 900,
            show: false,
            title: gameTitle,
            icon: path.join(__dirname, "renderer", "assets", "icon-v4.ico"),
            backgroundColor: "#000000",
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });


        session.window = appWindow;
        appWindow.setMenuBarVisibility(false);
        await session.loadWindow(appWindow, targetUrl);
        session.markReady();
        return { basarili: true };

    } catch (hata) {
        if (session) await session.close(hata);
        const message = session?.error?.message || hata.message;
        oyunDurumunuGonder({ oyun: uygulama, tip: 'hata', phase: 'failed', mesaj: message });
        return { basarili: false, hata: message };
    }
}

// =====================================================================
// HTTP / HTTPS YARDIMCILARI
// =====================================================================
function httpPost(url, payload = {}) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === "https:";
        const lib = isHttps ? https : http;

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(data)
            },
            timeout: 10000,
            rejectUnauthorized: true
        };

        const req = lib.request(options, (res) => {
            let body = "";
            res.on("data", chunk => body += chunk);
            res.on("end", () => {
                try { resolve(JSON.parse(body)); }
                catch { reject(new Error("Geçersiz sunucu yanıtı")); }
            });
        });

        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("Bağlantı zaman aşımı")); });
        req.write(data);
        req.end();
    });
}

function httpGet(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === "https:";
        const lib = isHttps ? https : http;

        const req = lib.get(url, { timeout: 10000, headers: { "User-Agent": "TikMnG-Launcher" } }, (res) => {
            let body = "";
            res.on("data", chunk => body += chunk);
            res.on("end", () => {
                try { resolve(JSON.parse(body)); }
                catch { reject(new Error("Geçersiz yanıt")); }
            });
        });

        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("Zaman aşımı")); });
    });
}

// Dosya İndirme Yardımcısı (Yönlendirmeleri takip eder ve ilerleme bildirir)
function dosyaIndir(url, hedefYol, ilerlemeCb, redirects = 0) {
    return new Promise((resolve, reject) => {
        if (redirects > 10) return reject(new Error("Çok fazla yönlendirme!"));

        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === "https:";
        const lib = isHttps ? https : http;

        const req = lib.get(url, { headers: { "User-Agent": "MNG-TikTok-Game-Launcher" } }, (res) => {
            // Yönlendirme kontrolü (301, 302, 303, 307, 308)
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                let nextUrl = res.headers.location;
                if (!nextUrl.startsWith("http")) {
                    nextUrl = new URL(nextUrl, url).href;
                }
                return resolve(dosyaIndir(nextUrl, hedefYol, ilerlemeCb, redirects + 1));
            }

            if (res.statusCode !== 200) {
                return reject(new Error(`İndirme başarısız (HTTP ${res.statusCode})`));
            }

            const totalBytes = parseInt(res.headers["content-length"] || 0, 10);
            let transferredBytes = 0;
            const fileStream = fs.createWriteStream(hedefYol);

            res.on("data", (chunk) => {
                transferredBytes += chunk.length;
                if (ilerlemeCb) {
                    const percent = totalBytes > 0 ? Math.min(100, Math.round((transferredBytes / totalBytes) * 100)) : 0;
                    const transferredMB = (transferredBytes / (1024 * 1024)).toFixed(1);
                    const totalMB = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : "?";
                    ilerlemeCb({ percent, transferredBytes, totalBytes, transferredMB, totalMB });
                }
            });

            res.pipe(fileStream);

            fileStream.on("finish", () => {
                fileStream.close();
                resolve(hedefYol);
            });

            fileStream.on("error", (err) => {
                try { fs.unlinkSync(hedefYol); } catch {}
                reject(err);
            });
        });

        req.on("error", (err) => {
            try { fs.unlinkSync(hedefYol); } catch {}
            reject(err);
        });
    });
}

function arkaPlanKlasoru() {
    return path.join(app.getPath("userData"), "content", "backgrounds");
}

async function arkaPlanPaketiniHazirla() {
    const hedef = arkaPlanKlasoru();
    try {
        const mevcut = fs.existsSync(hedef)
            ? fs.readdirSync(hedef).filter(file => /\.(mp4|webm)$/i.test(file))
            : [];
        if (mevcut.length >= 67 && store.get("background_pack_version") === ARKA_PLAN_PAKET_SURUMU) return;

        fs.mkdirSync(hedef, { recursive: true });
        const tempZip = path.join(os.tmpdir(), `tikmng-backgrounds-${ARKA_PLAN_PAKET_SURUMU}.zip`);
        await dosyaIndir(`${lisansSunucuUrlBul()}/download/backgrounds.zip`, tempZip);
        if (!fs.existsSync(tempZip) || fs.statSync(tempZip).size < 1024 * 1024) throw new Error("Arka plan paketi eksik indirildi.");

        const cp = require("child_process");
        cp.execFileSync("tar", ["-xf", tempZip, "-C", hedef], { windowsHide: true, stdio: "ignore", timeout: 180000 });
        const kurulan = fs.readdirSync(hedef).filter(file => /\.(mp4|webm)$/i.test(file));
        if (kurulan.length < 1) throw new Error("Arka plan paketi açıldı fakat video bulunamadı.");
        store.set("background_pack_version", ARKA_PLAN_PAKET_SURUMU);
        mainWindow?.webContents.send('arka-planlar-hazir');
        try { fs.unlinkSync(tempZip); } catch {}
    } catch (error) {
        console.warn("Arka plan paketi daha sonra yeniden denenecek:", error.message);
    }
}

function surumKarsilastirHelper(v1, v2) {
    if (!v1 || !v2) return 0;
    const p1 = String(v1).split(".").map(n => parseInt(n, 10) || 0);
    const p2 = String(v2).split(".").map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const n1 = p1[i] || 0;
        const n2 = p2[i] || 0;
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
    }
    return 0;
}

// Sürüm Kontrolü
ipcMain.handle("surum-kontrol-et", async () => {
    if (appUpdates) return appUpdates.check();
    const currentVersion = app.getVersion() || "1.0.2";
    try {
        const serverUrl = lisansSunucuUrlBul();
        const [serverResult, githubResult] = await Promise.allSettled([
            httpGet(`${serverUrl}/api/version`),
            httpGet("https://api.github.com/repos/maNgao7/mng-license-server1/releases/latest")
        ]);
        const info = serverResult.status === "fulfilled" ? serverResult.value : {};
        const github = githubResult.status === "fulfilled" ? githubResult.value : {};
        const githubVersion = String(github.tag_name || "").replace(/^v/i, "");
        const serverVersion = info.latestVersion || currentVersion;
        const latestVersion = surumKarsilastirHelper(githubVersion, serverVersion) > 0 ? githubVersion : serverVersion;
        const githubSetup = Array.isArray(github.assets)
            ? github.assets.find(asset => new RegExp(`TikMnG-Setup-${latestVersion.replace(/\./g, "\\.")}\\.exe$`, "i").test(asset.name || ""))
            : null;
        const guncellemeVar = surumKarsilastirHelper(latestVersion, currentVersion) > 0;

        return {
            guncellemeVar,
            currentVersion,
            latestVersion,
            downloadUrl: githubSetup?.browser_download_url || info.downloadUrl || `${serverUrl}/download/setup-direct`,
            webUrl: info.webUrl,
            changelog: info.changelog || []
        };
    } catch (e) {
        return { guncellemeVar: false, currentVersion, changelog: [] };
    }
});

// Güncellemeyi İndir ve Kur
ipcMain.handle("guncelleme-indir-ve-kur", async (event, { downloadUrl }) => {
    if (appUpdates) return platform?.priorityDownload ? platform.priorityDownload(() => appUpdates.install()) : appUpdates.install();
    try {
        const serverUrl = lisansSunucuUrlBul();
        const url = downloadUrl || `${serverUrl}/download/setup-direct`;
        const tempExe = path.join(os.tmpdir(), "MNG_TikTok_Game_Update_Setup.exe");

        mainWindow.webContents.send("guncelleme-ilerleme", {
            percent: 0,
            transferredMB: "0.0",
            totalMB: "...",
            mesaj: "Güncelleme indiriliyor..."
        });

        await dosyaIndir(url, tempExe, (prog) => {
            mainWindow.webContents.send("guncelleme-ilerleme", prog);
        });

        mainWindow.webContents.send("guncelleme-bitti", {
            mesaj: "İndirme tamamlandı! Uygulama güncelleniyor ve yeniden başlatılıyor..."
        });

        // 1.5 saniye sonra kurulumu başlat ve launcher'ı kapat
        setTimeout(() => {
            try {
                lisansYedegiKaydet();
                sunucuyuDurdur();
                orbitSunucuyuDurdur();

                // Kurulum programını sessiz modda (/S) arka planda başlat (Pencere açılmaz, temiz günceller)
                const child = spawn(tempExe, ["/S"], {
                    detached: true,
                    stdio: "ignore"
                });
                child.unref();

                // Mevcut uygulamayı kapat
                app.quit();
            } catch (err) {
                shell.openPath(tempExe);
                app.quit();
            }
        }, 1500);

        return { basarili: true };
    } catch (err) {
        return { basarili: false, hata: err.message };
    }
});

// =====================================================================
// ARKA PLAN VİDEOLARI LİSTESİ IPC
// =====================================================================
ipcMain.handle("arka-plan-videolari", async () => {
    const adayKlasorler = [
        arkaPlanKlasoru(),
        path.join(appKlasoruBul(), "public", "assets", "backgrounds")
    ];

    try {
        for (const basePath of adayKlasorler) {
            if (!fs.existsSync(basePath)) continue;
            const files = fs.readdirSync(basePath)
                .filter(f => /\.(mp4|webm)$/i.test(f))
                .sort();
            if (files.length > 0) {
                return files.map(f => `mng-bg://video/${f}`);
            }
        }
    } catch (e) {
        console.error("Video listesi taranamadı:", e);
    }

    return [];
});

// =====================================================================
// UYGULAMA BAŞLANGICI
// =====================================================================
let previewArchiveTask = null;
function onIzlemeArsiviniHazirla() {
    const archive = 'D:/TikMNG-Medya-Arsivi-2026-10-21';
    if (!preview.enabled || !platform || previewArchiveTask || !fs.existsSync(path.join(archive, 'manifest.json')) || platform.snapshot().media.length > 0) return;
    const channel = widgetChannel;
    previewArchiveTask = platform.importArchive(archive).then(() => {
        mainWindow?.webContents.send('workspace-catalog', {});
    }).catch(() => {
        if (channel === widgetChannel) mainWindow?.webContents.send('durum', { tip: 'hata', mesaj: 'Video arşivi eklenemedi. Video Stüdyosu içinden Arşiv ekle ile yeniden seçebilirsiniz.' });
    }).finally(() => {
        previewArchiveTask = null;
        if (channel !== widgetChannel) onIzlemeArsiviniHazirla();
    });
}
app.whenReady().then(() => {
    startupMark('app-ready');
    if (!primaryInstance) return;
    lisansYedeginiGeriYukle();
    overlayBridge = require('./lib/overlay-bridge.cjs').createOverlayBridge({
        store, serverURL: lisansSunucuUrlBul, port: WIDGET_PORT, accessKey: WIDGET_ACCESS_KEY,
        namespace: app.isTikMNGPreview ? 'preview' : 'stable', getChannel: () => widgetChannel,
        getCredentials: () => ({ licenseCode: store.get('lisans_kod', ''), deviceId: CIHAZ_KIMLIK }),
        onStatus: status => mainWindow?.webContents.send('workspace-overlay', status)
    });
    appUpdates = require('./lib/app-updates.cjs').createAppUpdates({ app, notify: (name, data) => mainWindow?.webContents.send(name, data) });
    gameWidgetHost = require('./lib/game-widget-host.cjs').createGameWidgetHost({
        specs: require('./lib/game-widget-specs.cjs'), port: WIDGET_PORT, accessKey: WIDGET_ACCESS_KEY,
        getChannel: () => widgetChannel, publicURL: url => overlayBridge.urlFor(url),
        getSharedState: () => widgetBirlesikDurum(),
        getTarget: game => {
            const session = oyunOturumu;
            if (!session || session.closed || session.game !== game) return null;
            const child = [...session.children].find(child => child.mngWidgetGame?.game === game && child.exitCode == null && child.signalCode == null);
            return child ? { port: child.mngWidgetGame.port, channel: session.tiktokUser, identity: child } : null;
        }
    });
    startupMark('platform-create-start');
    platform = require('./lib/platform.cjs').createPlatform({
        traceStartup: startupMark,
        app, ipcMain, store, dialog, definitions: OYUN_TANIMLARI, getWindow: () => mainWindow,
        speechCredentials: require('./lib/speech-credentials.cjs').createSpeechCredentials({ store, safeStorage }),
        getSpeechCredentials: () => ({ licenseCode: store.get('lisans_kod', ''), deviceId: CIHAZ_KIMLIK }),
        serverURL: lisansSunucuUrlBul, accessKey: WIDGET_ACCESS_KEY, port: WIDGET_PORT,
        getOverlayStatus: () => overlayBridge.status(), broadcastURL: url => overlayBridge.urlFor(url),
        gameWidgetLinks: id => gameWidgetHost.links(id),
        reconnectOverlay: () => { overlayBridge.stop(); return overlayBridge.start(widgetChannel); },
        getChannel: () => widgetChannel, getActiveGame: () => aktifOyun || '', event: widgetGenelOlayEkle,
        profile: widgetTikTokProfiliniOku, gift: widgetTikTokHediyesiniOku,
        setLiveStatus: status => { widgetLiveStatus = status; }, closeDirect: widgetTikTokBaglantisiniKapat,
        resolveLegacy: id => id === 'gelene-gecene' ? geleneGeceneModKlasoru() : oyunKlasoruBul(id, true),
        validate: (dir, id) => id === 'gelene-gecene' ? Boolean(dir && fs.existsSync(path.join(dir, 'UnturnedModEdition.dll'))) : oyunAnaDosyalariVar(dir, id),
        extract: require('./lib/archive.cjs').extractGameArchive,
        isRunning: id => Boolean(aktifOyun === id || minecraftProcesses.has(id) || (id === 'zombie-war' && zombieWarProcess))
    });
    startupMark('platform-created');
    widgetSunucusunuBaslat();
    overlayBridge.start(widgetChannel);
    // Özel dosya protokolünü kaydet (mng-bg://video/bg01.mp4)
    try {
        protocol.registerFileProtocol("mng-bg", (request, callback) => {
            let rawUrl = request.url.replace(/^mng-bg:\/\//i, "");
            const isGift = /^gift\//i.test(rawUrl);
            let cleaned = rawUrl.replace(/^(video|gift)\//i, "");
            cleaned = decodeURIComponent(cleaned).replace(/^\/+/, "");
            const fileName = path.basename(cleaned);

            const folderName = isGift ? "gift-images" : "backgrounds";
            const adayYollar = [
                ...(isGift ? [path.join(__dirname, 'renderer', 'gift-assets', fileName)] : []),
                ...(!isGift ? [path.join(arkaPlanKlasoru(), fileName)] : []),
                path.join(appKlasoruBul(), "public", "assets", folderName, fileName),
                path.join(__dirname, "..", "apps", "tiktok-vs", "public", "assets", folderName, fileName),
                path.join(process.resourcesPath || "", "apps", "tiktok-vs", "public", "assets", folderName, fileName)
            ];

            const bulunan = adayYollar.find(p => fs.existsSync(p));
            if (bulunan) {
                return callback({ path: path.normalize(bulunan) });
            }
            callback({ error: -6 });
        });
    } catch (err) {
        console.error("Protokol kayıt hatası:", err);
    }

    anaEkraniOlustur();
    startupMark('window-created');
    onIzlemeArsiviniHazirla();
    platform.refreshCatalog().catch(() => {});
});

app.on("window-all-closed", () => {
    sunucuyuDurdur();
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        anaEkraniOlustur();
    }
});

app.on("before-quit", () => {
    app.isQuiting = true;
    platform?.close();
    overlayBridge?.close();
    gameWidgetHost?.close();
    widgetLiveSession?.close();
    sunucuyuDurdur();
    widgetTikTokBaglantisiniKapat("Uygulama kapatılıyor.").catch(() => {});
    try { widgetServer?.close(); } catch {}
});

process.on("uncaughtException", (err) => {
    console.error("Beklenmedik hata:", err);
});
