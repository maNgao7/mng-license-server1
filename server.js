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
// ADMIN ŞİFRESİ
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
const DOWNLOADS_DIR = path.join(__dirname, "downloads");

let lisanslarVeritabani = [];
let aktivasyonLogVeritabani = [];
let taleplerVeritabani = [];

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

// Web Sitesi Ana Sayfası: web/ klasörü
app.use(express.static(path.join(__dirname, "web")));
// Admin Paneli
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
    if (sureObj.birim === "sinirsiz") prefix = "MNG-INF";
    else if (sureObj.birim === "dakika") prefix = `MNG${sureObj.miktar}M`;
    else prefix = `MNG${sureObj.miktar}D`;

    const rastgele = () => crypto.randomBytes(2).toString("hex").toUpperCase();
    return `${prefix}-${rastgele()}-${rastgele()}`;
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
// MÜŞTERİ LİSANS DOĞRULAMA APİSİ (Launcher Bağlantısı)
// =====================================================================

app.post("/api/license/verify", (req, res) => {
    const { code, deviceId } = req.body;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    if (!code || !deviceId) {
        return res.json({
            valid: false,
            reason: "invalid_license",
            message: "Lütfen lisans kodunuzu eksiksiz girin."
        });
    }

    const temizKod = String(code).trim().toUpperCase();
    const lisans = lisanslarVeritabani.find(l => l.kod === temizKod);

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

    // 1. İLK AKTİVASYON (Süre burada başlar!)
    if (lisans.durum === "beklemede") {
        const simdi = Date.now();
        const sureMs = sureMsHesapla({ birim: lisans.sure_birim, miktar: lisans.sure_miktar });
        let bitisZamani = null;

        if (sureMs !== -1) {
            bitisZamani = simdi + sureMs;
        }

        lisans.durum = "aktif";
        lisans.aktivasyon_zamani = simdi;
        lisans.bitis_zamani = bitisZamani;
        lisans.cihaz_kimlik = deviceId;

        dbKaydet();
        logEkle(temizKod, deviceId, "ilk_aktivasyon", ip);

        const remainingSeconds = bitisZamani ? Math.max(0, Math.floor((bitisZamani - simdi) / 1000)) : -1;
        const isUnlimited = (lisans.sure_birim === "sinirsiz" || lisans.sure_miktar === -1);

        return res.json({
            valid: true,
            expiresAt: bitisZamani,
            remainingDays: lisans.sure_birim === "gun" ? lisans.sure_miktar : 0,
            remainingSeconds: remainingSeconds,
            isUnlimited: isUnlimited,
            message: "Lisans başarıyla aktifleştirildi."
        });
    }

    // 2. DAHA ÖNCE AKTİF EDİLMİŞ LİSANS
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

        return res.json({
            valid: true,
            expiresAt: lisans.bitis_zamani,
            remainingDays: Math.ceil(remainingSeconds / 86400),
            remainingSeconds: remainingSeconds,
            isUnlimited: isUnlimited,
            message: "Lisans geçerli."
        });
    }

    return res.json({ valid: false, reason: "invalid_license", message: "Geçersiz lisans kodu." });
});

app.post("/api/license/check", (req, res) => {
    const { code, deviceId } = req.body;
    if (!code || !deviceId) return res.json({ valid: false, reason: "invalid_license" });

    const temizKod = String(code).trim().toUpperCase();
    const lisans = lisanslarVeritabani.find(l => l.kod === temizKod);

    if (!lisans) return res.json({ valid: false, reason: "invalid_license", message: "Geçersiz lisans kodu." });

    sureliDurumGuncelle(lisans);

    if (lisans.durum === "iptal") return res.json({ valid: false, reason: "revoked", message: "Bu lisans iptal edilmiş." });
    if (lisans.durum === "suresi_doldu") return res.json({ valid: false, reason: "expired", message: "Lisansınızın süresi dolmuş." });
    if (lisans.cihaz_kimlik && lisans.cihaz_kimlik !== deviceId) {
        return res.json({ valid: false, reason: "device_mismatch", message: "Bu lisans başka bir bilgisayara kayıtlı." });
    }

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
        return res.json({
            valid: true,
            expiresAt: lisans.bitis_zamani,
            remainingDays: Math.ceil(remainingSeconds / 86400),
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
    const { ad, tiktok_kullanici, iletisim, mesaj } = req.body;
    if (!ad || !iletisim) {
        return res.status(400).json({ error: "Lütfen adınızı ve iletişim bilginizi girin." });
    }

    const yeniTalep = {
        id: Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        ad: ad.trim(),
        tiktok_kullanici: (tiktok_kullanici || "").trim(),
        iletisim: iletisim.trim(),
        mesaj: (mesaj || "").trim(),
        tarih: Date.now(),
        durum: "bekliyor" // bekliyor | onaylandi
    };

    taleplerVeritabani.unshift(yeniTalep);
    talepKaydet();

    res.json({ basarili: true, mesaj: "Talebiniz yöneticiye iletildi! En kısa sürede sizinle iletişime geçilecektir." });
});

// =====================================================================
// DOSYA İNDİRME ENDPOINTLERİ
// =====================================================================

app.get("/download/setup", (req, res) => {
    const setupYolu = path.join(DOWNLOADS_DIR, "MNG-TikTok-Game-Setup.exe");
    if (fs.existsSync(setupYolu)) {
        res.download(setupYolu, "MNG-TikTok-Game-Setup.exe");
    } else {
        res.status(404).send("Kurulum dosyası henüz oluşturulmadı. Lütfen yöneticiyle iletişime geçin.");
    }
});

app.get("/download/portable", (req, res) => {
    const portableYolu = path.join(DOWNLOADS_DIR, "MNG-TikTok-Game-Portable.exe");
    if (fs.existsSync(portableYolu)) {
        res.download(portableYolu, "MNG-TikTok-Game-Portable.exe");
    } else {
        res.status(404).send("Taşınabilir dosya henüz oluşturulmadı.");
    }
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
    dbKaydet();
    res.json({ mesaj: "Lisans iptal edildi." });
});

app.post("/api/admin/lisans/:kod/aktif-et", adminKontrol, (req, res) => {
    const kod = req.params.kod.toUpperCase();
    const lisans = lisanslarVeritabani.find(l => l.kod === kod);
    if (!lisans) return res.status(404).json({ error: "Lisans bulunamadı." });

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

// Admin Paneli Sayfası
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "admin", "public", "index.html"));
});

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
