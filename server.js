import express from "express";
import cors from "cors";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// =====================================================================
// ADMIN ÅİFRESİ
// =====================================================================
function adminSifreBul() {
    if (process.env.ADMIN_SIFRE) return process.env.ADMIN_SIFRE.trim();
    const sifreDosyasi = path.join(__dirname, "admin_sifre.txt");
    try {
        if (fs.existsSync(sifreDosyasi)) {
            const okunan = fs.readFileSync(sifreDosyasi, "utf-8").trim();
            if (okunan) return okunan;
        }
    } catch {}
    return "mng-admin-2024-gizli";
}

const ADMIN_SIFRE = adminSifreBul();

// =====================================================================
// KALICI VERİTABANI (JSON Dosya Tabanlı)
// =====================================================================
const DB_DOSYASI = path.join(__dirname, "lisanslar.json");
const LOG_DOSYASI = path.join(__dirname, "aktivasyon_log.json");
const TALEPLER_DOSYASI = path.join(__dirname, "talepler.json");
const KARA_LISTE_DOSYASI = path.join(__dirname, "kara_liste.json");
const DOWNLOADS_DIR = path.join(__dirname, "downloads");

let lisanslarVeritabani = [];
let aktivasyonLogVeritabani = [];
let taleplerVeritabani = [];
let karaListeVeritabani = [];

function dbYukle() {
    try {
        if (fs.existsSync(DB_DOSYASI)) {
            lisanslarVeritabani = JSON.parse(fs.readFileSync(DB_DOSYASI, "utf-8"));
        } else {
            lisanslarVeritabani = [];
            dbKaydet();
        }
    } catch (e) {
        lisanslarVeritabani = [];
    }

    try {
        if (fs.existsSync(LOG_DOSYASI)) {
            aktivasyonLogVeritabani = JSON.parse(fs.readFileSync(LOG_DOSYASI, "utf-8"));
        } else {
            aktivasyonLogVeritabani = [];
            logKaydet();
        }
    } catch (e) {
        aktivasyonLogVeritabani = [];
    }

    try {
        if (fs.existsSync(TALEPLER_DOSYASI)) {
            taleplerVeritabani = JSON.parse(fs.readFileSync(TALEPLER_DOSYASI, "utf-8"));
        } else {
            taleplerVeritabani = [];
            talepKaydet();
        }
    } catch (e) {
        taleplerVeritabani = [];
    }

    try {
        if (fs.existsSync(KARA_LISTE_DOSYASI)) {
            karaListeVeritabani = JSON.parse(fs.readFileSync(KARA_LISTE_DOSYASI, "utf-8"));
        } else {
            karaListeVeritabani = [];
            karaListeKaydet();
        }
    } catch (e) {
        karaListeVeritabani = [];
    }
}

function dbKaydet() {
    try {
        const tmp = DB_DOSYASI + ".tmp";
        fs.writeFileSync(tmp, JSON.stringify(lisanslarVeritabani, null, 2), "utf-8");
        fs.renameSync(tmp, DB_DOSYASI);
    } catch (e) {}
}

function logKaydet() {
    try {
        const tmp = LOG_DOSYASI + ".tmp";
        fs.writeFileSync(tmp, JSON.stringify(aktivasyonLogVeritabani.slice(-1000), null, 2), "utf-8");
        fs.renameSync(tmp, LOG_DOSYASI);
    } catch (e) {}
}

function talepKaydet() {
    try {
        const tmp = TALEPLER_DOSYASI + ".tmp";
        fs.writeFileSync(tmp, JSON.stringify(taleplerVeritabani, null, 2), "utf-8");
        fs.renameSync(tmp, TALEPLER_DOSYASI);
    } catch (e) {}
}

function karaListeKaydet() {
    try {
        const tmp = KARA_LISTE_DOSYASI + ".tmp";
        fs.writeFileSync(tmp, JSON.stringify(karaListeVeritabani, null, 2), "utf-8");
        fs.renameSync(tmp, KARA_LISTE_DOSYASI);
    } catch (e) {}
}

dbYukle();

// =====================================================================
// MIDDLEWARE & STATİK DOSYALAR
// =====================================================================
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Admin-Token"]
}));

app.use(express.json());

// Web Sitesi & Statik Dosyalar (Önbellek Engelleme ve Çift Konum Koruması)
app.use((req, res, next) => {
    if (req.url === "/" || req.url.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
    }
    next();
});

app.get("/", (req, res) => {
    const webPath = path.join(__dirname, "web", "index.html");
    const rootPath = path.join(__dirname, "index.html");
    if (fs.existsSync(webPath)) return res.sendFile(webPath);
    if (fs.existsSync(rootPath)) return res.sendFile(rootPath);
    res.send("MNG TikTok Game Web Portal");
});

app.use(express.static(path.join(__dirname, "web")));
app.use(express.static(__dirname));
// Admin Paneli
app.use("/admin", express.static(path.join(__dirname, "admin", "public")));
app.get(["/admin", "/admin/*"], (req, res) => {
    res.sendFile(path.join(__dirname, "admin", "public", "index.html"));
});
app.use("/admin-assets", express.static(path.join(__dirname, "admin", "public")));

// Admin yetkilendirme middleware
function adminKontrol(req, res, next) {
    const token = req.headers["x-admin-token"];
    if (!token) return res.status(401).json({ error: "Admin token gerekli" });

    const beklenen = crypto.createHmac("sha256", ADMIN_SIFRE).update("mng-admin").digest("hex");
    if (token !== beklenen) return res.status(403).json({ error: "Geçersiz admin token" });
    next();
}

// =====================================================================
// YARDIMCI SÜRE FONKSİYONLARI (Dakika, Gün, Sınırsız)
// =====================================================================
// sureObj: { birim: "dakika"|"gun"|"sinirsiz", miktar: number }
function sureMsHesapla(sureObj) {
    if (!sureObj || sureObj.birim === "sinirsiz" || sureObj.miktar === -1) {
        return -1; // Sınırsız
    }
    if (sureObj.birim === "dakika") {
        return sureObj.miktar * 60 * 1000;
    }
    // Varsayılan gün
    return sureObj.miktar * 24 * 60 * 60 * 1000;
}

function lisansKoduUret(sureObj) {
    let prefix = "MNG";
    if (sureObj.birim === "sinirsiz") prefix = "MNGINF";
    else if (sureObj.birim === "dakika") prefix = `MNG${sureObj.miktar}M`;
    else prefix = `MNG${sureObj.miktar}D`;

    const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
    const sig = crypto.createHmac("sha256", ADMIN_SIFRE)
                      .update(`${prefix}-${rand}`)
                      .digest("hex")
                      .substring(0, 6)
                      .toUpperCase();
    return `${prefix}-${rand}-${sig}`;
}

function kodKriptoKontrol(kod) {
    if (!kod || typeof kod !== "string") return null;
    const parcalar = kod.trim().toUpperCase().split("-");
    if (parcalar.length !== 3) return null;
    const [prefix, rand, sig] = parcalar;
    const beklenenSig = crypto.createHmac("sha256", ADMIN_SIFRE)
                              .update(`${prefix}-${rand}`)
                              .digest("hex")
                              .substring(0, 6)
                              .toUpperCase();
    if (sig !== beklenenSig) return null;

    if (prefix === "MNGINF") {
        return { birim: "sinirsiz", miktar: -1 };
    }
    const matchMin = prefix.match(/^MNG(\d+)M$/);
    if (matchMin) {
        return { birim: "dakika", miktar: parseInt(matchMin[1], 10) };
    }
    const matchDay = prefix.match(/^MNG(\d+)D$/);
    if (matchDay) {
        return { birim: "gun", miktar: parseInt(matchDay[1], 10) };
    }
    return null;
}

function aktivasyonTokenUret(kod, deviceId, bitisZamani) {
    const raw = `${kod.trim().toUpperCase()}:${deviceId.trim()}:${bitisZamani || "INF"}`;
    return crypto.createHmac("sha256", ADMIN_SIFRE).update(raw).digest("hex");
}

function aktivasyonTokenDogrula(kod, deviceId, bitisZamani, token) {
    if (!kod || !deviceId || !token) return false;
    const beklenen = aktivasyonTokenUret(kod, deviceId, bitisZamani);
    return token === beklenen;
}

function sureliDurumGuncelle(lisans) {
    if (lisans.sure_birim === "sinirsiz" || lisans.sure_miktar === -1) {
        return lisans;
    }

    if (lisans.durum === "aktif" && lisans.bitis_zamani && Date.now() > lisans.bitis_zamani) {
        lisans.durum = "suresi_doldu";
        dbKaydet();
    }
    return lisans;
}

function logEkle(lisansKod, cihazKimlik, islem, ip) {
    try {
        aktivasyonLogVeritabani.push({
            id: Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            lisans_kod: lisansKod,
            cihaz_kimlik: cihazKimlik,
            islem: islem,
            zaman: Date.now(),
            ip: ip || null
        });
        logKaydet();
    } catch (e) {}
}

// =====================================================================
// SÜRÜM BİLGİLERİ & İNDİRME LİNKLERİ
// =====================================================================
const EN_GUNCEL_SURUM = "4.0.0";
const EN_DUSUK_SURUM = "1.0.0";
const SETUP_INDIRME_LINKI = "https://drive.usercontent.google.com/download?id=1g-dEVnq_8ksvCTuHq9q7Ur-MGiFBpzND&export=download&confirm=t";
const SETUP_WEB_LINKI = "https://drive.google.com/file/d/1g-dEVnq_8ksvCTuHq9q7Ur-MGiFBpzND/view?usp=sharing";

// Her güncellemede eklenen/değişen özellikler listesi
const SURUM_NOTLARI = [
    "v4.0.0 — MNG Orbit Kütle ve Büyüme Devrimi: Gönderilen coin değeriyle tam orantılı ve belirgin kütle artışı; 2x Hızlan Çay ve Herkesi Parçala Money Gun sabit izleyici kartları.",
    "v4.0.0 — Süre Alanı Büyütmesi ve Kalıcı Reklam: @maNgao7tv reklamı ve genişletilmiş süre alanı.",
    "v4.0.0 — Kendi Arka Planını Yükleme: Orbit, TikTok VS ve Crowd Control oyunlarına video ve resim yükleme özelliği.",
    "v4.0.0 — OBS Widget Kusursuz Bağlantı: Profil resmi hatası giderildi, Launcher'a OBS Link Kopyala butonları eklendi.",
    "v4.0.0 — MNG Crowd Control Gelişmiş Can ve Akıllı Saldırı: Engellere can havuzu, takipçi saldırı mekaniği ve canlı HUD eklendi.",
    "v4.0.0 — TikTok VS Siyah-Beyaz ve Işık Efekti: CSS kuralları ve slot efektleri tamir edildi.",
    "v3.5.5 — Yeni Oyun Tanıtımı: Savaş Alanı strateji oyunu launcher ve web sitesine eklendi; izleyiciler hediyeleriyle asker birlikleri üretip canlı yayında savaşacak!",
    "v3.5.5 — Kusursuz Yükleme & Oyna Akışı: YÜKLE butonu bağımsız dahili kurulum motoruyla güçlendirildi; %0-%100 kesintisiz indirme ve anında OYNA geçişi garanti altına alındı.",
    "v3.5.5 — Özgün Kart Işıkları & Ateş Turuncusu Efekti: MNG Crowd Control kartına özel canlı ateş turuncusu hover ve neon parlama eklendi.",
    "v3.5.5 — Web İnteraktif Oyun Demoları: Web sitesinde tüm oyunların bilgileri, dinamik demo alanları ve anlık simülasyonları eklendi.",
    "v3.5.1 — Modüler Oyun Kurulumu: MNG Crowd Control artık harici indirilebilir modüler paket olarak sunulur; kurulum dosyası hafifletildi ve 'KUR / YÜKLE' butonu ile tek tıkla yüklenir.",
    "v3.5.1 — Oyun Kapanış & Yeniden Giriş Onarımı: Oyundan çıkıldığında arka plan sunucusu ve bağlantılar anında temizlenir; butonlar serbest bırakılarak tekrar oyuna giriş pürüzsüz hale getirildi.",
    "v3.5.1 — Profil, İsim & Engel Boyut Ayarları: Ayarlar paneline 'Genel Engel Boyutu' ve 'Profil & İsim Boyutu' sürgüleri eklendi. Geniş ekranlarda bile profil resimleri ve kullanıcı adları devasa ve net ölçeklenebilir.",
    "v3.5.0 — Yeni Oyunumuz: MNG Crowd Control İnteraktif Hayatta Kalma Oyunu yayına alındı!",
    "v3.5.0 — 1v1 Arena Düellosu & Mega Boss: 50 hediye puanında veya Para Tabancası ile en çok hediye atan izleyici dev patron olarak sahaya iner, çevre temizlenir, ekran genişler ve yayıncının hasarı 1.5x katına çıkar!",
    "v3.5.0 — Belirgin Kullanıcı Adları & Hediye Rozetleri: Engel ve bossların üzerinde gönderen kişinin net kullanıcı adı ve hediye puanı gösterilir.",
    "v3.5.0 — Arka Plan Kararma Koruması: Video döngüsü, hata algılama ve görünürlük kurtarıcıları ile arka plan asla kaybolmaz.",
    "v3.5.0 — TikTok VS Yeni Hediye Efektleri: Beyaz Parlama, Siyah-Beyaz ve Neon efektleri hem oyunda hem de OBS widget'larında çalışır.",
    "v3.5.0 — Launcher 4'lü Yan Yana Kart Düzeni: Tüm oyun kartları tek satırda yan yana dizildi, pencere boyutu optimize edildi.",
    "v3.0.0 — MNG Orbit Profesyonel Ayarlar & Özel Kütle: Her hediyeye istenen kütle elle yazılabilir, önerilen kütle butonları eklendi (+150 Gül, +300 Kalp, +500 Buket, +1100 Çay, +1600 Şapka ve Bıyık).",
    "v3.0.0 — MNG Orbit Hediye & Görsel Donması Çözüldü: Buket, Çay, Şapka ve popüler tüm Türkçe hediyelerin PNG eşleşmesi düzeltildi; hediye seçimi asla dondurmaz.",
    "v3.0.0 — MNG Orbit Beğeni & Takip Giriş Kuralları: Takip giriş kütlesi, beğeni giriş barajı (ör. 100 beğeni) ve sonrasında sürekli beğendikçe kütle artışı eksiksiz ayarlanabilir.",
    "v3.0.0 — Haritayı Parçala Güçlendirildi: Harita parçalama tetiklendiğinde arenadaki tüm oyuncular anında parçalanır.",
    "v3.0.0 — MNG Orbit Arka Plan Sorunu Düzeltildi: Arka plan seçiminde 40+ video eşzamanlı oynatma kaldırıldı, GPU kilitlenmesi bitti; arka plan seçimi kusursuz ve kalıcı çalışır.",
    "v3.0.0 — OBS Kazananlar & Sıralama Widget'ı: Kazananlar widget'ı küçük profil avatarları, kullanıcı adı ve X galibiyet sayacıyla en çok kazanandan küçüğe sıralanır.",
    "v3.0.0 — TikTok VS OBS Widget & Profil Puanlama: OBS VS widget altındaki hediye slotları onarıldı; puanlamada eksik/kırık avatarlar için renkli baş harf SVG sistemi ve takipçileri otomatik ekleme devreye alındı.",
    "v2.0.3 - MNG Orbit Hediye Değiştir: Her hediye için tek, sade bir görsel seçme penceresi eklendi. Seçim ve arama oyun akışını dondurmaz.",
    "v2.0.3 - Kaliteli Hediye Görselleri: Hediye küçük resimleri yerel yüksek kaliteli katalogdan hızlı yüklenir ve önbelleğe alınır.",
    "v2.0.3 - Lisans Koruması: Güncelleme kurulurken aktif lisans bilgisi aynı bilgisayarda yedeklenir; lisans ve oyun ayarları korunur.",
    "v2.0.2 — MNG Orbit Hediye Seçimi: Hediye görselleri artık küçük, hızlı ve aranabilir sayfalarla yüklenir; seçim sonrası oyun donmaz veya çökmez.",
    "v2.0.2 — Güncelleme Ekranı: İndirme tamamlandığında MNG TikTok Game markalı tam ekran güncelleniyor ekranı ve hareketli ilerleme göstergesi görünür.",
    "v2.0.1 — Otomatik Başlatma Düzeltildi: Launcher açıldığında TikTok VS Profil oyununa otomatik girme sorunu çözüldü, kullanıcı istediği oyunu seçer.",
    "v2.0.1 — MNG Orbit Tüm Hediyeler Aktif: TikTok VS Profil kütüphanesindeki tüm popüler yerel hediyeler entegre edildi, aranabilir ve eksiksiz görünüyor.",
    "v2.0.1 — Anında Ses Tepkisi (0 ms): Yutma ve büyüme sesleri donanımsal 0 ms Web Audio ile anında çalar.",
    "v2.0.0 — Büyük Sürüm: MNG Orbit hediye listesi donması tamamen giderildi, sessiz güncelleme sistemi, kıvılcım rozet sistemi ve web sitesi temizliği.",
    "v2.0.0 — MNG Orbit Hediye Donma Giderildi: Hediye seçim listesi açılırken oyun artık asla donmuyor; görsel sayısı optimize edildi, DOM güncellemesi ertelendi.",
    "v2.0.0 — Sessiz & Temiz Güncelleme: Güncellemeler hiçbir kurulum penceresi açmadan, lisans ve verileriniz korunarak arka planda uygulanır.",
    "v2.0.0 — Kıvılcım Rozeti: Yeni eklenen oyunlar parlak animasyonlu rozet ile gösterilir.",
    "v2.0.0 — Web Sitesi Temizliği: Henüz çıkmayan oyun kartları kaldırıldı; yeni oyun eklendiğinde site güncellenecek.",
    "v1.9.2 — Türkçe Karakter ve Yazı Düzeltmeleri: Tüm oyun içi ve arayüzdeki bozuk Türkçe karakterler tamamen onarıldı.",
    "v1.9.2 — Web Sitesi & Soru/Öneri Sistemi: TikTok & Discord temalı yeni interaktif web portalı ve geri bildirim sistemi eklendi.",
    "v1.9.1 — MNG Orbit Donma Düzeltildi: Ayarlar açılınca oyun artık donmuyor; hediye görselleri sadece seçim açıldığında yükleniyor.",
    "v1.9.1 — Kullanıcı Adı Hatırlama: Bağlan ekranında son kullanıcı adı otomatik dolu geliyor.",
    "v1.9.1 — Oyun Büyük Ekran: Tüm oyunlar artık tam ekran (maximize) açılıyor.",
    "v1.9.1 — WebSocket Kararlılık: Bağlantı koptuğunda baloncuklar kaybolmuyor, yeniden bağlantı daha hızlı.",
    "v1.9.0 — KUR / YÜKLE Butonu: Oyunlar artık isteğe bağlı kurulabilir; mevcut kurulu oyunlara asla dokunmaz.",
    "v1.9.0 — MNG Orbit Ayarları Büyütüldü: Ayarlar paneli tam genişliğe alındı, sürükleme iptal edildi.",
    "v1.9.0 — MNG Orbit Yutma Sesi: Biri içine çekildiğinde 0 ms gecikmeyle anında yutma sesi çalar.",
    "v1.9.0 — MNG Orbit Kazanan Ekranı: Profil fotoğrafı ekranın 2/3'ünü kaplayacak büyüklükte gösterilir.",
    "v1.9.0 — MNG Orbit Kalıcı Kurallar: Takip = 250 kütle, İlk 100 beğeni = 200 kütle girişi, Her 100 beğeni = +150 kütle.",
    "TikTok Profil VS 1.7: OBS VS widget'ına canlı geri sayım ve tur sonu kazanan ekranı eklendi.",
    "MNG Orbit Final: Oyun içi hediye ayarları, çalışan hediye görselleri ve Haritayı Parçala testi eklendi.",
    "MNG Orbit Ayarları: Takip, beğeni ve hediye büyüme değerleri launcher'dan düzenlenebilir.",
    "MNG Orbit: Hediye, beğeni ve takip etkileşimleriyle büyüyen canlı arena oyunu.",
    "Tek Tıkla Bağlan: TikTok kullanıcı adını bir kez kaydet — oyun açıldığında otomatik bağlanır.",
    "Otomatik Yeniden Bağlanma: İnternet koptuğunda uygulama kendiliğinden yayına tekrar bağlanır."
];

function surumKarsilastir(v1, v2) {
    if (!v1) return -1;
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

// Sürüm Kontrolü API'si (Launcher kontrol eder)
app.get("/api/version", (req, res) => {
    res.json({
        latestVersion: EN_GUNCEL_SURUM,
        minVersion: EN_DUSUK_SURUM,
        downloadUrl: SETUP_INDIRME_LINKI,
        webUrl: SETUP_WEB_LINKI,
        changelog: SURUM_NOTLARI
    });
});

// =====================================================================
// MÜÅTERİ LİSANS DOÄRULAMA APİSİ (Launcher Bağlantısı)
// =====================================================================

app.post("/api/license/verify", (req, res) => {
    const { code, deviceId, clientVersion } = req.body;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // Sürüm kontrolü (Çok eski sürümleri engelle)
    if (clientVersion && surumKarsilastir(clientVersion, EN_DUSUK_SURUM) < 0) {
        return res.json({
            valid: false,
            reason: "update_required",
            latestVersion: EN_GUNCEL_SURUM,
            downloadUrl: SETUP_INDIRME_LINKI,
            changelog: SURUM_NOTLARI,
            message: `âš ï¸ YENİ GÜNCELLEME MEVCUT (v${EN_GUNCEL_SURUM})! Lütfen güncel sürümü indirin.`
        });
    }

    if (!code || !deviceId) {
        return res.json({
            valid: false,
            reason: "invalid_license",
            message: "Lütfen lisans kodunuzu eksiksiz girin."
        });
    }

    const temizKod = String(code).trim().toUpperCase();

    // Kara liste kontrolü
    if (karaListeVeritabani.includes(temizKod)) {
        logEkle(temizKod, deviceId, "red_kara_liste", ip);
        return res.json({
            valid: false,
            reason: "revoked",
            message: "Bu lisans kalıcı olarak iptal edilmiştir."
        });
    }

    let lisans = lisanslarVeritabani.find(l => l.kod === temizKod);

    // Kendi Kendini Kurtaran Lisans: Eğer sunucu yeniden başladığında lisanslar.json sıfırlandıysa
    // kriptografik olarak imzalanmış geçerli kodları anında otomatik kurtarır!
    if (!lisans) {
        const kriptoBilgi = kodKriptoKontrol(temizKod);
        if (kriptoBilgi) {
            lisans = {
                id: Date.now() + "_" + Math.random().toString(36).substr(2, 6),
                kod: temizKod,
                sure_birim: kriptoBilgi.birim,
                sure_miktar: kriptoBilgi.miktar,
                durum: "beklemede",
                olusturma_zamani: Date.now(),
                aktivasyon_zamani: null,
                bitis_zamani: null,
                cihaz_kimlik: null,
                notlar: "Kriptografik Doğrulandı"
            };
            lisanslarVeritabani.unshift(lisans);
            dbKaydet();
        }
    }

    if (!lisans) {
        logEkle(temizKod, deviceId, "red_gecersiz", ip);
        return res.json({
            valid: false,
            reason: "invalid_license",
            message: "Geçersiz lisans kodu."
        });
    }

    sureliDurumGuncelle(lisans);

    if (lisans.durum === "iptal") {
        logEkle(temizKod, deviceId, "red_iptal", ip);
        return res.json({
            valid: false,
            reason: "revoked",
            message: "Bu lisans iptal edilmiş."
        });
    }

    if (lisans.durum === "suresi_doldu") {
        logEkle(temizKod, deviceId, "red_sure_doldu", ip);
        return res.json({
            valid: false,
            reason: "expired",
            message: "Lisansınızın süresi dolmuş."
        });
    }

    // 1. İLK AKTİVASYON (Süre sadece ilk aktivasyonda başlar!)
    if (lisans.durum === "beklemede") {
        const simdi = Date.now();
        const sureMs = sureMsHesapla({ birim: lisans.sure_birim, miktar: lisans.sure_miktar });
        let bitisZamani = null;

        if (sureMs !== -1) {
            bitisZamani = simdi + sureMs;
        }

        const token = aktivasyonTokenUret(temizKod, deviceId, bitisZamani);

        lisans.durum = "aktif";
        lisans.aktivasyon_zamani = simdi;
        lisans.bitis_zamani = bitisZamani;
        lisans.cihaz_kimlik = deviceId;
        lisans.activation_token = token;

        dbKaydet();
        logEkle(temizKod, deviceId, "ilk_aktivasyon", ip);

        const remainingSeconds = bitisZamani ? Math.max(0, Math.floor((bitisZamani - simdi) / 1000)) : -1;
        const isUnlimited = (lisans.sure_birim === "sinirsiz" || lisans.sure_miktar === -1);

        return res.json({
            valid: true,
            expiresAt: bitisZamani,
            activationToken: token,
            remainingDays: lisans.sure_birim === "gun" ? lisans.sure_miktar : (isUnlimited ? -1 : Math.ceil(remainingSeconds / 86400)),
            remainingSeconds: remainingSeconds,
            isUnlimited: isUnlimited,
            message: "Lisans başarıyla aktifleştirildi."
        });
    }

    // 2. DAHA ÖNCE AKTİF EDİLMİÅ LİSANS
    if (lisans.durum === "aktif") {
        if (lisans.cihaz_kimlik && lisans.cihaz_kimlik !== deviceId) {
            logEkle(temizKod, deviceId, "red_cihaz_uyusmazligi", ip);
            return res.json({
                valid: false,
                reason: "device_mismatch",
                message: "Bu lisans başka bir bilgisayara kayıtlı."
            });
        }

        const simdi = Date.now();
        let remainingSeconds = -1;

        if (lisans.bitis_zamani) {
            const kalanMs = lisans.bitis_zamani - simdi;
            if (kalanMs <= 0) {
                lisans.durum = "suresi_doldu";
                dbKaydet();
                return res.json({
                    valid: false,
                    reason: "expired",
                    message: "Lisansınızın süresi dolmuş."
                });
            }
            remainingSeconds = Math.max(0, Math.floor(kalanMs / 1000));
        }

        logEkle(temizKod, deviceId, "dogrulama", ip);
        const isUnlimited = (lisans.sure_birim === "sinirsiz" || lisans.sure_miktar === -1);
        const token = lisans.activation_token || aktivasyonTokenUret(temizKod, deviceId, lisans.bitis_zamani);
        lisans.activation_token = token;
        dbKaydet();

        return res.json({
            valid: true,
            expiresAt: lisans.bitis_zamani,
            activationToken: token,
            remainingDays: isUnlimited ? -1 : Math.ceil(remainingSeconds / 86400),
            remainingSeconds: remainingSeconds,
            isUnlimited: isUnlimited,
            message: "Lisans geçerli."
        });
    }

    return res.json({ valid: false, reason: "invalid_license", message: "Geçersiz lisans kodu." });
});

app.post("/api/license/check", (req, res) => {
    const { code, deviceId, activationToken, expiresAt, clientVersion } = req.body;

    // Sürüm kontrolü (Çok eski sürümleri engelle)
    if (clientVersion && surumKarsilastir(clientVersion, EN_DUSUK_SURUM) < 0) {
        return res.json({
            valid: false,
            reason: "update_required",
            latestVersion: EN_GUNCEL_SURUM,
            downloadUrl: SETUP_INDIRME_LINKI,
            changelog: SURUM_NOTLARI,
            message: `âš ï¸ YENİ GÜNCELLEME MEVCUT (v${EN_GUNCEL_SURUM})! Lütfen güncel sürümü indirin.`
        });
    }

    if (!code || !deviceId) return res.json({ valid: false, reason: "invalid_license" });

    const temizKod = String(code).trim().toUpperCase();

    // Kara liste kontrolü
    if (karaListeVeritabani.includes(temizKod)) {
        return res.json({ valid: false, reason: "revoked", message: "Bu lisans kalıcı olarak iptal edilmiştir." });
    }

    let lisans = lisanslarVeritabani.find(l => l.kod === temizKod);

    // Kendi Kendini Onaran / Kurtaran Senkronizasyon:
    // Eğer Render yeniden başladıysa ve lisanslar.json sıfırlandıysa,
    // istemcinin sunduğu aktivasyon tokeni ile bitiş zamanı matematiksel olarak doğrulanır.
    if (!lisans && activationToken) {
        const tokenGecerli = aktivasyonTokenDogrula(temizKod, deviceId, expiresAt, activationToken);
        if (tokenGecerli) {
            lisans = {
                id: "restore_" + Date.now(),
                kod: temizKod,
                sure_birim: expiresAt ? "gun" : "sinirsiz",
                sure_miktar: 0,
                durum: (expiresAt && Date.now() > Number(expiresAt)) ? "suresi_doldu" : "aktif",
                olusturma_zamani: Date.now(),
                aktivasyon_zamani: Date.now(),
                bitis_zamani: expiresAt ? Number(expiresAt) : null,
                cihaz_kimlik: deviceId,
                activation_token: activationToken,
                notlar: "Otomatik Kurtarılan Lisans"
            };
            lisanslarVeritabani.unshift(lisans);
            dbKaydet();
        }
    }

    if (!lisans) return res.json({ valid: false, reason: "invalid_license", message: "Geçersiz lisans kodu." });

    sureliDurumGuncelle(lisans);

    if (lisans.durum === "iptal") return res.json({ valid: false, reason: "revoked", message: "Bu lisans iptal edilmiş." });
    if (lisans.cihaz_kimlik && lisans.cihaz_kimlik !== deviceId) {
        return res.json({ valid: false, reason: "device_mismatch", message: "Bu lisans başka bir bilgisayara kayıtlı." });
    }

    if (lisans.durum === "suresi_doldu") return res.json({ valid: false, reason: "expired", message: "Lisansınızın süresi dolmuş." });

    if (lisans.durum === "aktif") {
        const simdi = Date.now();
        let remainingSeconds = -1;

        if (lisans.bitis_zamani) {
            const kalanMs = lisans.bitis_zamani - simdi;
            if (kalanMs <= 0) {
                lisans.durum = "suresi_doldu";
                dbKaydet();
                return res.json({ valid: false, reason: "expired", message: "Lisansınızın süresi dolmuş." });
            }
            remainingSeconds = Math.max(0, Math.floor(kalanMs / 1000));
        }

        const isUnlimited = (lisans.sure_birim === "sinirsiz" || lisans.sure_miktar === -1);
        const token = lisans.activation_token || aktivasyonTokenUret(temizKod, deviceId, lisans.bitis_zamani);

        return res.json({
            valid: true,
            expiresAt: lisans.bitis_zamani,
            activationToken: token,
            remainingDays: isUnlimited ? -1 : Math.ceil(remainingSeconds / 86400),
            remainingSeconds: remainingSeconds,
            isUnlimited: isUnlimited
        });
    }

    return res.json({ valid: false, reason: "invalid_license", message: "Lisans aktif değil." });
});

// =====================================================================
// WEB SİTESİ LİSANS TALEP APİSİ
// =====================================================================

app.post("/api/talep-gonder", (req, res) => {
    const { ad, tiktok_kullanici, iletisim, mesaj, tur, konu } = req.body;
    if (!ad || !iletisim) {
        return res.status(400).json({ error: "Lütfen adınızı ve iletişim bilginizi girin." });
    }

    const yeniTalep = {
        id: Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        tur: tur || "lisans", // lisans | soru | oneri
        konu: (konu || "").trim(),
        ad: ad.trim(),
        tiktok_kullanici: (tiktok_kullanici || "").trim(),
        iletisim: iletisim.trim(),
        mesaj: (mesaj || "").trim(),
        tarih: Date.now(),
        durum: "bekliyor" // bekliyor | onaylandi
    };

    taleplerVeritabani.unshift(yeniTalep);
    talepKaydet();

    const cevapMesaji = yeniTalep.tur === "oneri"
        ? "Harika öneriniz için çok teşekkür ederiz! Yönetim ekibimiz önerinizi inceleyecek."
        : yeniTalep.tur === "soru"
        ? "Sorunuz başarıyla iletildi! En kısa sürede sizinle iletişime geçilecektir."
        : "Talebiniz yöneticiye iletildi! En kısa sürede sizinle iletişime geçilecektir.";

    res.json({ basarili: true, mesaj: cevapMesaji });
});

// =====================================================================
// DOSYA İNDİRME ENDPOINTLERİ
// =====================================================================

app.get("/download/setup", (req, res) => {
    res.redirect(SETUP_INDIRME_LINKI);
});

app.get("/download/setup-direct", (req, res) => {
    res.redirect(SETUP_INDIRME_LINKI);
});

app.get("/download/portable", (req, res) => {
    const portableYolu = path.join(DOWNLOADS_DIR, "MNG-TikTok-Game-Portable.exe");
    if (fs.existsSync(portableYolu)) {
        res.download(portableYolu, "MNG-TikTok-Game-Portable.exe");
    } else {
        res.status(404).send("Taşınabilir dosya henüz oluşturulmadı.");
    }
});

app.get("/download/game/:gameZip", (req, res) => {
    const dosya = req.params.gameZip;
    const zipYolu = path.join(DOWNLOADS_DIR, "games", dosya);
    if (fs.existsSync(zipYolu)) {
        return res.download(zipYolu);
    }
    const altYolu = path.join(DOWNLOADS_DIR, dosya);
    if (fs.existsSync(altYolu)) {
        return res.download(altYolu);
    }
    res.status(404).json({ error: "Oyun paketi bulunamadı: " + dosya });
});

// =====================================================================
// ADMİN APİLERİ
// =====================================================================

app.post("/api/admin/giris", (req, res) => {
    const { sifre } = req.body;
    if (!sifre || sifre !== ADMIN_SIFRE) return res.status(403).json({ error: "Yanlış şifre" });
    const token = crypto.createHmac("sha256", ADMIN_SIFRE).update("mng-admin").digest("hex");
    res.json({ token });
});

// Yeni Lisans Oluştur (1 dk, 10 dk, 20 dk, 1 gün, 3 gün, 7 gün, 30 gün, sınırsız)
app.post("/api/admin/lisans-olustur", adminKontrol, (req, res) => {
    const { sure_birim, sure_miktar, notlar } = req.body;
    // sure_birim: "dakika" | "gun" | "sinirsiz"
    // sure_miktar: number (örn 1, 10, 20, 1, 3, 7, 30, -1)

    const birim = sure_birim || "gun";
    const miktar = Number(sure_miktar);

    if (isNaN(miktar) && birim !== "sinirsiz") {
        return res.status(400).json({ error: "Geçersiz süre miktarı!" });
    }

    const sureObj = { birim, miktar: birim === "sinirsiz" ? -1 : miktar };

    let kod;
    let deneme = 0;
    while (deneme < 30) {
        const aday = lisansKoduUret(sureObj);
        if (!lisanslarVeritabani.some(l => l.kod === aday)) {
            kod = aday;
            break;
        }
        deneme++;
    }

    const yeniLisans = {
        id: Date.now() + "_" + Math.random().toString(36).substr(2, 6),
        kod: kod,
        sure_birim: birim,
        sure_miktar: miktar,
        durum: "beklemede",
        olusturma_zamani: Date.now(),
        aktivasyon_zamani: null,
        bitis_zamani: null,
        cihaz_kimlik: null,
        notlar: notlar || ""
    };

    lisanslarVeritabani.unshift(yeniLisans);
    dbKaydet();

    let sureEtiketi = "";
    if (birim === "sinirsiz") sureEtiketi = "Sınırsız";
    else if (birim === "dakika") sureEtiketi = `${miktar} Dakikalık`;
    else sureEtiketi = `${miktar} Günlük`;

    res.json({
        kod,
        durum: "beklemede",
        sure_etiketi: sureEtiketi,
        mesaj: `${sureEtiketi} lisans oluşturuldu: ${kod}`
    });
});

app.get("/api/admin/lisanslar", adminKontrol, (req, res) => {
    lisanslarVeritabani.forEach(l => sureliDurumGuncelle(l));
    res.json(lisanslarVeritabani);
});

app.post("/api/admin/lisans/:kod/iptal", adminKontrol, (req, res) => {
    const kod = req.params.kod.toUpperCase();
    const lisans = lisanslarVeritabani.find(l => l.kod === kod);
    if (!lisans) return res.status(404).json({ error: "Lisans bulunamadı." });

    lisans.durum = "iptal";
    if (!karaListeVeritabani.includes(kod)) {
        karaListeVeritabani.push(kod);
        karaListeKaydet();
    }
    dbKaydet();
    res.json({ mesaj: "Lisans iptal edildi." });
});

app.post("/api/admin/lisans/:kod/aktif-et", adminKontrol, (req, res) => {
    const kod = req.params.kod.toUpperCase();
    const lisans = lisanslarVeritabani.find(l => l.kod === kod);
    if (!lisans) return res.status(404).json({ error: "Lisans bulunamadı." });

    karaListeVeritabani = karaListeVeritabani.filter(k => k !== kod);
    karaListeKaydet();

    if (lisans.aktivasyon_zamani) {
        if (lisans.sure_birim === "sinirsiz" || (lisans.bitis_zamani && Date.now() < lisans.bitis_zamani)) {
            lisans.durum = "aktif";
        } else {
            lisans.durum = "suresi_doldu";
        }
    } else {
        lisans.durum = "beklemede";
    }

    dbKaydet();
    res.json({ mesaj: "Lisans tekrar aktif edildi.", durum: lisans.durum });
});

app.delete("/api/admin/lisans/:kod", adminKontrol, (req, res) => {
    const kod = req.params.kod.toUpperCase();
    const index = lisanslarVeritabani.findIndex(l => l.kod === kod);
    if (index === -1) return res.status(404).json({ error: "Lisans bulunamadı." });

    lisanslarVeritabani.splice(index, 1);
    karaListeVeritabani = karaListeVeritabani.filter(k => k !== kod);
    karaListeKaydet();
    dbKaydet();
    res.json({ mesaj: "Lisans silindi." });
});

// Gelen Talepleri Listele
app.get("/api/admin/talepler", adminKontrol, (req, res) => {
    res.json(taleplerVeritabani);
});

app.delete("/api/admin/talep/:id", adminKontrol, (req, res) => {
    const id = req.params.id;
    taleplerVeritabani = taleplerVeritabani.filter(t => t.id !== id);
    talepKaydet();
    res.json({ mesaj: "Talep silindi." });
});

app.get("/api/admin/istatistikler", adminKontrol, (req, res) => {
    lisanslarVeritabani.forEach(l => sureliDurumGuncelle(l));
    const toplam = lisanslarVeritabani.length;
    const aktif = lisanslarVeritabani.filter(l => l.durum === "aktif").length;
    const beklemede = lisanslarVeritabani.filter(l => l.durum === "beklemede").length;
    const iptal = lisanslarVeritabani.filter(l => l.durum === "iptal").length;
    const doldu = lisanslarVeritabani.filter(l => l.durum === "suresi_doldu").length;
    const bekleyenTalep = taleplerVeritabani.length;
    res.json({ toplam, aktif, beklemede, iptal, doldu, bekleyenTalep });
});

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: Date.now() });
});

// =====================================================================
// CANLI TUTMA BOTU (Render 7/24 Uyanık Tutucu - KeepAlive Bot)
// =====================================================================
const CANLI_URL = "https://mng-license-server1.onrender.com/";

function pingBot() {
    try {
        const lib = CANLI_URL.startsWith("https") ? https : http;
        lib.get(CANLI_URL, (res) => {
            // Sunucu uyanık tutuldu
        }).on("error", () => {});
    } catch {}
}

// Her 10 dakikada bir istek atarak Render'ı asla uyutmaz
setInterval(pingBot, 10 * 60 * 1000);

// Sunucuyu Başlat
app.listen(PORT, "0.0.0.0", () => {
    console.log("");
    console.log("==================================================");
    console.log("  MNG TikTok Game — Web Sitesi & Lisans Sunucusu");
    console.log(`  Web Portalı : http://localhost:${PORT}`);
    console.log(`  Admin Paneli : http://localhost:${PORT}/admin`);
    console.log(`  İndirme Linki: http://localhost:${PORT}/download/setup`);
    console.log("==================================================");
    console.log("");
});

