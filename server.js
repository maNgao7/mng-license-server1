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
// ADMIN ÅÄ°FRESÄ°
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
// KALICI VERÄ°TABANI (JSON Dosya TabanlÄ±)
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
// MIDDLEWARE & STATÄ°K DOSYALAR
// =====================================================================
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Admin-Token"]
}));

app.use(express.json());

// Web Sitesi Ana SayfasÄ±: web/ klasÃ¶rÃ¼
app.use(express.static(path.join(__dirname, "web")));
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
    if (token !== beklenen) return res.status(403).json({ error: "GeÃ§ersiz admin token" });
    next();
}

// =====================================================================
// YARDIMCI SÃœRE FONKSÄ°YONLARI (Dakika, GÃ¼n, SÄ±nÄ±rsÄ±z)
// =====================================================================
// sureObj: { birim: "dakika"|"gun"|"sinirsiz", miktar: number }
function sureMsHesapla(sureObj) {
    if (!sureObj || sureObj.birim === "sinirsiz" || sureObj.miktar === -1) {
        return -1; // SÄ±nÄ±rsÄ±z
    }
    if (sureObj.birim === "dakika") {
        return sureObj.miktar * 60 * 1000;
    }
    // VarsayÄ±lan gÃ¼n
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
// SÃœRÃœM BÄ°LGÄ°LERÄ° & Ä°NDÄ°RME LÄ°NKLERÄ°
// =====================================================================
const EN_GUNCEL_SURUM = "1.9.1";
const EN_DUSUK_SURUM = "1.0.0";
const SETUP_INDIRME_LINKI = "https://drive.usercontent.google.com/download?id=1g-dEVnq_8ksvCTuHq9q7Ur-MGiFBpzND&export=download&confirm=t";
const SETUP_WEB_LINKI = "https://drive.google.com/file/d/1g-dEVnq_8ksvCTuHq9q7Ur-MGiFBpzND/view?usp=sharing";

// Her gÃ¼ncellemede eklenen/deÄŸiÅŸen Ã¶zellikler listesi
const SURUM_NOTLARI = [
    "v1.9.1 â€” MNG Orbit Donma DÃ¼zeltildi: Ayarlar aÃ§Ä±lÄ±nca oyun artÄ±k donmuyor; hediye gÃ¶rselleri sadece seÃ§im aÃ§Ä±ldÄ±ÄŸÄ±nda yÃ¼kleniyor.",
    "v1.9.1 â€” KullanÄ±cÄ± AdÄ± HatÄ±rlama: BaÄŸlan ekranÄ±nda son kullanÄ±cÄ± adÄ± otomatik dolu geliyor.",
    "v1.9.1 â€” Oyun BÃ¼yÃ¼k Ekran: TÃ¼m oyunlar artÄ±k tam ekran (maximize) aÃ§Ä±lÄ±yor.",
    "v1.9.1 â€” WebSocket KararlÄ±lÄ±k: BaÄŸlantÄ± koptuÄŸunda baloncuklar kaybolmuyor, yeniden baÄŸlantÄ± daha hÄ±zlÄ±.",
    "v1.9.0 â€” KUR / YÃœKLE Butonu: Oyunlar artÄ±k isteÄŸe baÄŸlÄ± kurulabilir; mevcut kurulu oyunlara asla dokunmaz.",
    "v1.9.0 â€” MNG Orbit AyarlarÄ± BÃ¼yÃ¼tÃ¼ldÃ¼: Ayarlar paneli tam geniÅŸliÄŸe alÄ±ndÄ±, sÃ¼rÃ¼kleme iptal edildi.",
    "v1.9.0 â€” MNG Orbit Yutma Sesi: Biri iÃ§ine Ã§ekildiÄŸinde 0 ms gecikmeyle anÄ±nda yutma sesi Ã§alar.",
    "v1.9.0 â€” MNG Orbit Kazanan EkranÄ±: Profil fotoÄŸrafÄ± ekranÄ±n 2/3'Ã¼nÃ¼ kaplayacak bÃ¼yÃ¼klÃ¼kte gÃ¶sterilir.",
    "v1.9.0 â€” MNG Orbit KalÄ±cÄ± Kurallar: Takip = 250 kÃ¼tle, Ä°lk 100 beÄŸeni = 200 kÃ¼tle giriÅŸi, Her 100 beÄŸeni = +150 kÃ¼tle.",
    "TikTok Profil VS 1.7: OBS VS widget'Ä±na canlÄ± geri sayÄ±m ve tur sonu kazanan ekranÄ± eklendi.",
    "MNG Orbit Final: Oyun iÃ§i hediye ayarlarÄ±, Ã§alÄ±ÅŸan hediye gÃ¶rselleri ve HaritayÄ± ParÃ§ala testi eklendi.",
    "MNG Orbit AyarlarÄ±: Takip, beÄŸeni ve hediye bÃ¼yÃ¼me deÄŸerleri launcher'dan dÃ¼zenlenebilir.",
    "MNG Orbit: Hediye, beÄŸeni ve takip etkileÅŸimleriyle bÃ¼yÃ¼yen canlÄ± arena oyunu.",
    "Tek TÄ±kla BaÄŸlan: TikTok kullanÄ±cÄ± adÄ±nÄ± bir kez kaydet â€” oyun aÃ§Ä±ldÄ±ÄŸÄ±nda otomatik baÄŸlanÄ±r.",
    "Otomatik Yeniden BaÄŸlanma: Ä°nternet koptuÄŸunda uygulama kendiliÄŸinden yayÄ±na tekrar baÄŸlanÄ±r."
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

// SÃ¼rÃ¼m KontrolÃ¼ API'si (Launcher kontrol eder)
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
// MÃœÅTERÄ° LÄ°SANS DOÄRULAMA APÄ°SÄ° (Launcher BaÄŸlantÄ±sÄ±)
// =====================================================================

app.post("/api/license/verify", (req, res) => {
    const { code, deviceId, clientVersion } = req.body;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // SÃ¼rÃ¼m kontrolÃ¼ (Ã‡ok eski sÃ¼rÃ¼mleri engelle)
    if (clientVersion && surumKarsilastir(clientVersion, EN_DUSUK_SURUM) < 0) {
        return res.json({
            valid: false,
            reason: "update_required",
            latestVersion: EN_GUNCEL_SURUM,
            downloadUrl: SETUP_INDIRME_LINKI,
            changelog: SURUM_NOTLARI,
            message: `âš ï¸ YENÄ° GÃœNCELLEME MEVCUT (v${EN_GUNCEL_SURUM})! LÃ¼tfen gÃ¼ncel sÃ¼rÃ¼mÃ¼ indirin.`
        });
    }

    if (!code || !deviceId) {
        return res.json({
            valid: false,
            reason: "invalid_license",
            message: "LÃ¼tfen lisans kodunuzu eksiksiz girin."
        });
    }

    const temizKod = String(code).trim().toUpperCase();

    // Kara liste kontrolÃ¼
    if (karaListeVeritabani.includes(temizKod)) {
        logEkle(temizKod, deviceId, "red_kara_liste", ip);
        return res.json({
            valid: false,
            reason: "revoked",
            message: "Bu lisans kalÄ±cÄ± olarak iptal edilmiÅŸtir."
        });
    }

    let lisans = lisanslarVeritabani.find(l => l.kod === temizKod);

    // Kendi Kendini Kurtaran Lisans: EÄŸer sunucu yeniden baÅŸladÄ±ÄŸÄ±nda lisanslar.json sÄ±fÄ±rlandÄ±ysa
    // kriptografik olarak imzalanmÄ±ÅŸ geÃ§erli kodlarÄ± anÄ±nda otomatik kurtarÄ±r!
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
                notlar: "Kriptografik DoÄŸrulandÄ±"
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
            message: "GeÃ§ersiz lisans kodu."
        });
    }

    sureliDurumGuncelle(lisans);

    if (lisans.durum === "iptal") {
        logEkle(temizKod, deviceId, "red_iptal", ip);
        return res.json({
            valid: false,
            reason: "revoked",
            message: "Bu lisans iptal edilmiÅŸ."
        });
    }

    if (lisans.durum === "suresi_doldu") {
        logEkle(temizKod, deviceId, "red_sure_doldu", ip);
        return res.json({
            valid: false,
            reason: "expired",
            message: "LisansÄ±nÄ±zÄ±n sÃ¼resi dolmuÅŸ."
        });
    }

    // 1. Ä°LK AKTÄ°VASYON (SÃ¼re sadece ilk aktivasyonda baÅŸlar!)
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
            message: "Lisans baÅŸarÄ±yla aktifleÅŸtirildi."
        });
    }

    // 2. DAHA Ã–NCE AKTÄ°F EDÄ°LMÄ°Å LÄ°SANS
    if (lisans.durum === "aktif") {
        if (lisans.cihaz_kimlik && lisans.cihaz_kimlik !== deviceId) {
            logEkle(temizKod, deviceId, "red_cihaz_uyusmazligi", ip);
            return res.json({
                valid: false,
                reason: "device_mismatch",
                message: "Bu lisans baÅŸka bir bilgisayara kayÄ±tlÄ±."
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
                    message: "LisansÄ±nÄ±zÄ±n sÃ¼resi dolmuÅŸ."
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
            message: "Lisans geÃ§erli."
        });
    }

    return res.json({ valid: false, reason: "invalid_license", message: "GeÃ§ersiz lisans kodu." });
});

app.post("/api/license/check", (req, res) => {
    const { code, deviceId, activationToken, expiresAt, clientVersion } = req.body;

    // SÃ¼rÃ¼m kontrolÃ¼ (Ã‡ok eski sÃ¼rÃ¼mleri engelle)
    if (clientVersion && surumKarsilastir(clientVersion, EN_DUSUK_SURUM) < 0) {
        return res.json({
            valid: false,
            reason: "update_required",
            latestVersion: EN_GUNCEL_SURUM,
            downloadUrl: SETUP_INDIRME_LINKI,
            changelog: SURUM_NOTLARI,
            message: `âš ï¸ YENÄ° GÃœNCELLEME MEVCUT (v${EN_GUNCEL_SURUM})! LÃ¼tfen gÃ¼ncel sÃ¼rÃ¼mÃ¼ indirin.`
        });
    }

    if (!code || !deviceId) return res.json({ valid: false, reason: "invalid_license" });

    const temizKod = String(code).trim().toUpperCase();

    // Kara liste kontrolÃ¼
    if (karaListeVeritabani.includes(temizKod)) {
        return res.json({ valid: false, reason: "revoked", message: "Bu lisans kalÄ±cÄ± olarak iptal edilmiÅŸtir." });
    }

    let lisans = lisanslarVeritabani.find(l => l.kod === temizKod);

    // Kendi Kendini Onaran / Kurtaran Senkronizasyon:
    // EÄŸer Render yeniden baÅŸladÄ±ysa ve lisanslar.json sÄ±fÄ±rlandÄ±ysa,
    // istemcinin sunduÄŸu aktivasyon tokeni ile bitiÅŸ zamanÄ± matematiksel olarak doÄŸrulanÄ±r.
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
                notlar: "Otomatik KurtarÄ±lan Lisans"
            };
            lisanslarVeritabani.unshift(lisans);
            dbKaydet();
        }
    }

    if (!lisans) return res.json({ valid: false, reason: "invalid_license", message: "GeÃ§ersiz lisans kodu." });

    sureliDurumGuncelle(lisans);

    if (lisans.durum === "iptal") return res.json({ valid: false, reason: "revoked", message: "Bu lisans iptal edilmiÅŸ." });
    if (lisans.cihaz_kimlik && lisans.cihaz_kimlik !== deviceId) {
        return res.json({ valid: false, reason: "device_mismatch", message: "Bu lisans baÅŸka bir bilgisayara kayÄ±tlÄ±." });
    }

    if (lisans.durum === "suresi_doldu") return res.json({ valid: false, reason: "expired", message: "LisansÄ±nÄ±zÄ±n sÃ¼resi dolmuÅŸ." });

    if (lisans.durum === "aktif") {
        const simdi = Date.now();
        let remainingSeconds = -1;

        if (lisans.bitis_zamani) {
            const kalanMs = lisans.bitis_zamani - simdi;
            if (kalanMs <= 0) {
                lisans.durum = "suresi_doldu";
                dbKaydet();
                return res.json({ valid: false, reason: "expired", message: "LisansÄ±nÄ±zÄ±n sÃ¼resi dolmuÅŸ." });
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

    return res.json({ valid: false, reason: "invalid_license", message: "Lisans aktif deÄŸil." });
});

// =====================================================================
// WEB SÄ°TESÄ° LÄ°SANS TALEP APÄ°SÄ°
// =====================================================================

app.post("/api/talep-gonder", (req, res) => {
    const { ad, tiktok_kullanici, iletisim, mesaj } = req.body;
    if (!ad || !iletisim) {
        return res.status(400).json({ error: "LÃ¼tfen adÄ±nÄ±zÄ± ve iletiÅŸim bilginizi girin." });
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

    res.json({ basarili: true, mesaj: "Talebiniz yÃ¶neticiye iletildi! En kÄ±sa sÃ¼rede sizinle iletiÅŸime geÃ§ilecektir." });
});

// =====================================================================
// DOSYA Ä°NDÄ°RME ENDPOINTLERÄ°
// =====================================================================

app.get("/download/setup", (req, res) => {
    res.redirect(SETUP_WEB_LINKI);
});

app.get("/download/setup-direct", (req, res) => {
    res.redirect(SETUP_INDIRME_LINKI);
});

app.get("/download/portable", (req, res) => {
    const portableYolu = path.join(DOWNLOADS_DIR, "MNG-TikTok-Game-Portable.exe");
    if (fs.existsSync(portableYolu)) {
        res.download(portableYolu, "MNG-TikTok-Game-Portable.exe");
    } else {
        res.status(404).send("TaÅŸÄ±nabilir dosya henÃ¼z oluÅŸturulmadÄ±.");
    }
});

// =====================================================================
// ADMÄ°N APÄ°LERÄ°
// =====================================================================

app.post("/api/admin/giris", (req, res) => {
    const { sifre } = req.body;
    if (!sifre || sifre !== ADMIN_SIFRE) return res.status(403).json({ error: "YanlÄ±ÅŸ ÅŸifre" });
    const token = crypto.createHmac("sha256", ADMIN_SIFRE).update("mng-admin").digest("hex");
    res.json({ token });
});

// Yeni Lisans OluÅŸtur (1 dk, 10 dk, 20 dk, 1 gÃ¼n, 3 gÃ¼n, 7 gÃ¼n, 30 gÃ¼n, sÄ±nÄ±rsÄ±z)
app.post("/api/admin/lisans-olustur", adminKontrol, (req, res) => {
    const { sure_birim, sure_miktar, notlar } = req.body;
    // sure_birim: "dakika" | "gun" | "sinirsiz"
    // sure_miktar: number (Ã¶rn 1, 10, 20, 1, 3, 7, 30, -1)

    const birim = sure_birim || "gun";
    const miktar = Number(sure_miktar);

    if (isNaN(miktar) && birim !== "sinirsiz") {
        return res.status(400).json({ error: "GeÃ§ersiz sÃ¼re miktarÄ±!" });
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
    if (birim === "sinirsiz") sureEtiketi = "SÄ±nÄ±rsÄ±z";
    else if (birim === "dakika") sureEtiketi = `${miktar} DakikalÄ±k`;
    else sureEtiketi = `${miktar} GÃ¼nlÃ¼k`;

    res.json({
        kod,
        durum: "beklemede",
        sure_etiketi: sureEtiketi,
        mesaj: `${sureEtiketi} lisans oluÅŸturuldu: ${kod}`
    });
});

app.get("/api/admin/lisanslar", adminKontrol, (req, res) => {
    lisanslarVeritabani.forEach(l => sureliDurumGuncelle(l));
    res.json(lisanslarVeritabani);
});

app.post("/api/admin/lisans/:kod/iptal", adminKontrol, (req, res) => {
    const kod = req.params.kod.toUpperCase();
    const lisans = lisanslarVeritabani.find(l => l.kod === kod);
    if (!lisans) return res.status(404).json({ error: "Lisans bulunamadÄ±." });

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
    if (!lisans) return res.status(404).json({ error: "Lisans bulunamadÄ±." });

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
    if (index === -1) return res.status(404).json({ error: "Lisans bulunamadÄ±." });

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
// CANLI TUTMA BOTU (Render 7/24 UyanÄ±k Tutucu - KeepAlive Bot)
// =====================================================================
const CANLI_URL = "https://mng-license-server1.onrender.com/";

function pingBot() {
    try {
        const lib = CANLI_URL.startsWith("https") ? https : http;
        lib.get(CANLI_URL, (res) => {
            // Sunucu uyanÄ±k tutuldu
        }).on("error", () => {});
    } catch {}
}

// Her 10 dakikada bir istek atarak Render'Ä± asla uyutmaz
setInterval(pingBot, 10 * 60 * 1000);

// Sunucuyu BaÅŸlat
app.listen(PORT, "0.0.0.0", () => {
    console.log("");
    console.log("==================================================");
    console.log("  MNG TikTok Game â€” Web Sitesi & Lisans Sunucusu");
    console.log(`  Web PortalÄ± : http://localhost:${PORT}`);
    console.log(`  Admin Paneli : http://localhost:${PORT}/admin`);
    console.log(`  Ä°ndirme Linki: http://localhost:${PORT}/download/setup`);
    console.log("==================================================");
    console.log("");
});

