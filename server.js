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
// Render'da MNG_DATA_DIR=/var/data kullanıldığında tüm kayıtlar kalıcı diskte kalır.
// Yerelde çevre değişkeni yoksa mevcut klasör davranışı aynen korunur.
const DATA_DIR = path.resolve(process.env.MNG_DATA_DIR || __dirname);
const DB_DOSYASI = path.join(DATA_DIR, "lisanslar.json");
const LOG_DOSYASI = path.join(DATA_DIR, "aktivasyon_log.json");
const TALEPLER_DOSYASI = path.join(DATA_DIR, "talepler.json");
const KARA_LISTE_DOSYASI = path.join(DATA_DIR, "kara_liste.json");
const DOWNLOADS_DIR = path.join(DATA_DIR, "downloads");

function kaliciVeriyiHazirla() {
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        // İlk kalıcı disk kurulumunda mevcut lisans geçmişini bir kez diske aktarır.
        for (const dosya of ["lisanslar.json", "aktivasyon_log.json", "talepler.json", "kara_liste.json"]) {
            const hedef = path.join(DATA_DIR, dosya);
            const kaynak = path.join(__dirname, dosya);
            if (DATA_DIR !== __dirname && !fs.existsSync(hedef) && fs.existsSync(kaynak)) fs.copyFileSync(kaynak, hedef);
        }
    } catch (e) {
        console.warn("Kalıcı veri klasörü hazırlanamadı:", e.message);
    }
}
kaliciVeriyiHazirla();

let lisanslarVeritabani = [];
let aktivasyonLogVeritabani = [];
let taleplerVeritabani = [];
let karaListeVeritabani = [];

// =====================================================================
// ÜCRETSİZ GITHUB YEDEĞİ
// =====================================================================
// Render Free yeniden başlatıldığında yerel dosyaları siler. Ayrı bir
// özel GitHub deposuna AES-GCM şifreli tek bir durum dosyası yazmak bu
// sınırlamayı ücretsiz olarak aşar. Ana uygulama deposuna yazılmadığı için
// lisans kaydında otomatik Render deploy'u da tetiklenmez.
const GITHUB_BACKUP_TOKEN = String(process.env.GITHUB_LICENSE_TOKEN || "").trim();
const GITHUB_BACKUP_REPO = String(process.env.GITHUB_LICENSE_REPO || "").trim();
const GITHUB_BACKUP_PATH = String(process.env.GITHUB_LICENSE_PATH || "mng-license-backup.enc").trim();
const githubBackupEnabled = Boolean(GITHUB_BACKUP_TOKEN && GITHUB_BACKUP_REPO);
let githubBackupSha = null;
let githubBackupReady = false;
let githubBackupTimer = null;
let githubBackupQueue = Promise.resolve();

function githubBackupKey() {
    return crypto.createHash("sha256").update(`${ADMIN_SIFRE}:mng-license-backup:v1`).digest();
}

function githubBackupEncrypt(value) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", githubBackupKey(), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return JSON.stringify({ v: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") });
}

function githubBackupDecrypt(value) {
    const payload = JSON.parse(value);
    if (payload.v !== 1 || !payload.iv || !payload.tag || !payload.data) throw new Error("Geçersiz GitHub yedek biçimi");
    const decipher = crypto.createDecipheriv("aes-256-gcm", githubBackupKey(), Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]).toString("utf8"));
}

async function githubBackupRequest(method, body) {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_BACKUP_REPO}/contents/${encodeURIComponent(GITHUB_BACKUP_PATH).replace(/%2F/g, "/")}`, {
        method,
        headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${GITHUB_BACKUP_TOKEN}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "mng-tiktok-game-license-server"
        },
        body: body ? JSON.stringify(body) : undefined
    });
    if (response.status === 404 && method === "GET") return null;
    if (!response.ok) throw new Error(`GitHub yedek hatası (${response.status})`);
    return response.json();
}

function githubBackupSnapshot() {
    return {
        version: 1,
        savedAt: Date.now(),
        licenses: lisanslarVeritabani,
        activationLogs: aktivasyonLogVeritabani.slice(-1000),
        requests: taleplerVeritabani,
        blacklist: karaListeVeritabani
    };
}

async function githubBackupLoad() {
    if (!githubBackupEnabled) return false;
    const remote = await githubBackupRequest("GET");
    if (!remote?.content) return false;
    const state = githubBackupDecrypt(Buffer.from(String(remote.content).replace(/\n/g, ""), "base64").toString("utf8"));
    if (!Array.isArray(state.licenses) || !Array.isArray(state.activationLogs) || !Array.isArray(state.requests) || !Array.isArray(state.blacklist)) throw new Error("GitHub yedeği eksik veri içeriyor");
    lisanslarVeritabani = state.licenses;
    aktivasyonLogVeritabani = state.activationLogs;
    taleplerVeritabani = state.requests;
    karaListeVeritabani = state.blacklist;
    githubBackupSha = remote.sha || null;
    return true;
}

async function githubBackupSave() {
    if (!githubBackupEnabled || !githubBackupReady) return;
    const content = Buffer.from(githubBackupEncrypt(githubBackupSnapshot()), "utf8").toString("base64");
    const body = { message: "MNG lisans verisi yedegi", content };
    if (githubBackupSha) body.sha = githubBackupSha;
    try {
        const result = await githubBackupRequest("PUT", body);
        githubBackupSha = result?.content?.sha || githubBackupSha;
        console.log("GitHub lisans yedeği güncellendi.");
    } catch (error) {
        // Eşzamanlı nadir bir kayıt varsa son SHA ile bir kez daha dene.
        if (String(error.message).includes("409")) {
            const current = await githubBackupRequest("GET");
            githubBackupSha = current?.sha || null;
            return githubBackupSave();
        }
        console.warn("GitHub lisans yedeği güncellenemedi:", error.message);
    }
}

function githubBackupSchedule() {
    if (!githubBackupEnabled || !githubBackupReady) return;
    clearTimeout(githubBackupTimer);
    githubBackupTimer = setTimeout(() => {
        githubBackupQueue = githubBackupQueue.then(githubBackupSave).catch(error => console.warn("GitHub yedek kuyruğu hatası:", error.message));
    }, 900);
}

async function dbYukle() {
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
    try {
        const restored = await githubBackupLoad();
        if (restored) {
            dbKaydet();
            logKaydet();
            talepKaydet();
            karaListeKaydet();
            console.log("GitHub lisans yedeği başarıyla yüklendi.");
        } else if (githubBackupEnabled) {
            console.log("GitHub lisans yedeği henüz bulunamadı; ilk kayıtla oluşturulacak.");
        }
    } catch (error) {
        console.warn("GitHub lisans yedeği yüklenemedi, yerel veriler kullanılacak:", error.message);
    }
    githubBackupReady = true;
    if (githubBackupEnabled) githubBackupSchedule();
}

function dbKaydet() {
    try {
        const tmp = DB_DOSYASI + ".tmp";
        fs.writeFileSync(tmp, JSON.stringify(lisanslarVeritabani, null, 2), "utf-8");
        fs.renameSync(tmp, DB_DOSYASI);
    } catch (e) {}
    githubBackupSchedule();
}

function logKaydet() {
    try {
        const tmp = LOG_DOSYASI + ".tmp";
        fs.writeFileSync(tmp, JSON.stringify(aktivasyonLogVeritabani.slice(-1000), null, 2), "utf-8");
        fs.renameSync(tmp, LOG_DOSYASI);
    } catch (e) {}
    githubBackupSchedule();
}

function talepKaydet() {
    try {
        const tmp = TALEPLER_DOSYASI + ".tmp";
        fs.writeFileSync(tmp, JSON.stringify(taleplerVeritabani, null, 2), "utf-8");
        fs.renameSync(tmp, TALEPLER_DOSYASI);
    } catch (e) {}
    githubBackupSchedule();
}

function karaListeKaydet() {
    try {
        const tmp = KARA_LISTE_DOSYASI + ".tmp";
        fs.writeFileSync(tmp, JSON.stringify(karaListeVeritabani, null, 2), "utf-8");
        fs.renameSync(tmp, KARA_LISTE_DOSYASI);
    } catch (e) {}
    githubBackupSchedule();
}

await dbYukle();

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

app.get("/hediye-tasarimi", (req, res) => {
    res.sendFile(path.join(__dirname, "web", "gift-designer.html"));
});

app.get("/robots.txt", (req, res) => {
    res.type("text/plain").send("User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: https://mng-license-server1.onrender.com/sitemap.xml\n");
});

app.get("/sitemap.xml", (req, res) => {
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://mng-license-server1.onrender.com/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://mng-license-server1.onrender.com/hediye-tasarimi</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>
</urlset>`);
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
const EN_GUNCEL_SURUM = "6.0.6";
const EN_DUSUK_SURUM = "1.0.0";
const SETUP_INDIRME_LINKI = "https://drive.usercontent.google.com/download?id=1g-dEVnq_8ksvCTuHq9q7Ur-MGiFBpzND&export=download&confirm=t";
const SETUP_WEB_LINKI = "https://drive.google.com/file/d/1g-dEVnq_8ksvCTuHq9q7Ur-MGiFBpzND/view?usp=sharing";

// Her güncellemede eklenen/değişen özellikler listesi
const SURUM_NOTLARI = [
    "v6.0.6 — Gelene Geçene Canlı Yayın Etkileşim Onarımı: Yayına bağlandıktan sonra hediye, beğeni ve takip ile canavarların spawn olmasını engelleyen motor zombi döngüsü (ZombieManager) ve JSON deserialization/regex eşleme hatası giderildi; unmapped hediyeler için otomatik canavar yönlendirmesi ve havuzlu beğeni sayacı eklendi.",
    "v6.0.5 — Gelene Geçene Kesin Bağlantı Kontrolü: TikTok köprüsü cevap vermeden oyun açılmaz; temiz kurulumlarda doğru bağımlılık klasörü kullanılır ve ayrıntılı bağlantı günlüğü tutulur.",
    "v6.0.5 — Anlık Canlı Etkileşim: Hediye, beğeni ve takip olaylarının oyuna ulaşmasını engelleyen eski paket algılama sorunu giderildi; yayıncı ayarları güncellemede korunur.",
    "v6.0.5 — Yeni Hediye Tasarımcısı: Üst, sol ve sağ hediye alanları; tam ekran 630 hediyelik katalog; özel alt yazı, renk ve küçük görsel desteği web ve launcher'a birlikte eklendi.",
    "v6.0.5 — Canlı Yayın Widgetları: Gelen Hediye artık tek olayın en yüksek coin rekorunu profil ve hediye görseliyle gösterir; beğeni kürsüsü büyütüldü ve sıkılaştırıldı.",
    "v6.0.2 — Gelene Geçene Canlı Olay Düzeltmesi: Eski mod DLL'lerinin olay kuyruğunu tüketmesi engellendi; hediye, beğeni ve takip olayları güvenli biçimde işleniyor.",
    "v6.0.2 — Ortak 630 Hediyelik Katalog: Gerçek görseller, adlar ve coin değerleri bütün oyunlarda tek kaynaktan sunuluyor.",
    "v6.0.2 — Tasarım ve Widgetlar: Hediye alt yazısı/küçük görsel düzenleme, widget önizleme düzeltmesi ve localhost bağlantıları eklendi.",
    "v6.0.2 — Şövalye Savaşı: Her kılıç darbesi yalnızca tek hedefe vurur ve savaş sesi yenilendi.",
    "v6.0.1 — Gelene Geçene Canlı Olay Onarımı: TikTok'un gerçek hediye kimliği ile yerel katalog kimliği farklı olduğunda Türkçe/İngilizce ad ve görsel dosyası üzerinden güvenli eşleştirme eklendi.",
    "v6.0.1 — Kesintisiz Yayın Bağlantısı: Hediye, beğeni ve takip bağlantısı koptuğunda oyun otomatik yeniden bağlanır; takip olaylarının çift işlenmesi engellendi ve olay kuyruğu korumaya alındı.",
    "v6.0.1 — TikTok Login Kit Hazırlığı: Gizlilik Politikası ve Kullanım Koşulları yayıma hazırlandı; resmî hesap girişi için güvenli OAuth altyapısı hazırlanıyor.",
    "v6.0.0 — Gelene Geçene: Unturned tabanlı yeni hayatta kalma oyunu launcher'a eklendi. Steam kurulumu denetlenir, mod KUR düğmesiyle otomatik yerleştirilir ve OYNA ile başlatılır.",
    "v6.0.0 — Canlı Etkileşim Güvenilirliği: Değiştirilen hediyelerin kimlik eşleşmesi, Türkçe ad eşleşmesi ve kişi bazlı beğeni sayaçları düzeltildi; 100'ü aşan beğeniler artık kaybolmaz.",
    "v6.0.0 — Ortak Yayıncı Hesabı ve Widget Havuzu: Launcher'da hesap ekleme/değiştirme, kalıcı En İyi Hediye widget'ı ve TikTok Live Studio bağlantısı eklendi.",
    "v6.0.0 — 67 Sessiz Video Arka Planı: 19 yeni video sessiz, döngüye uygun biçimde eklendi; MNG Orbit seçicisinde hareketli ön izlemeler gösterilir.",
    "v5.0.5 — Coin → Kütle Ayarları: Orbit'te 1 coin başına kütle ve 1/50/100/500/1000 coin çarpanları kalıcı ayarlara taşındı. Büyük coinli tek hediyeler, aynı coin toplamındaki küçük hediyelerden daha güçlü büyür.",
    "v5.0.5 — Kalıcı Lisans Geçmişi: Lisanslar, aktivasyonlar ve talepler Render kalıcı diskte saklanır; süresi dolan kodlar silinmez, listede geçmişiyle kalır.",
    "v5.0.5 — Şövalye Savaşı Tur Kontrolü: Süre, başlat/duraklat/yeniden başlat, seçilebilir haritalar, savaş sesleri ve En Çok Asker Sahibi OBS widget'ı eklendi.",
    "v5.0.2 — MNG Orbit Alan Büyüklüğü & Koruma Kalkanı: Orbit ayarlarından oyun alanı boyutu ayarlanabilir; yeni katılan oyunculara kalkan ve sekme mekaniği eklendi; P tuşuyla profil silme bilgilendirmesi eklendi. PNG Hediye Tasarımcısı görsel yükleme hatası düzeltildi. Şövalye Savaşı başlangıçta temiz harita ile başlar; Yeni Oyun rozeti Şövalye Savaşı'na devredildi. Yönetici panelinde lisans listesi ve kalan süreler eksiksiz görülebilir.",
    "v5.0.1 — MNG Orbit Açılış Onarımı: Orbit sunucusunun açılmasını engelleyen sözdizimi hatası giderildi; oyun ve hediye kataloğu yeniden sorunsuz başlar.",
    "v5.0.1 — Hediye Tasarım Oluştur: Launcher içindeki PNG tasarım aracı tam hediye kataloğunu gösterir; yatay, soldan dikey ve sağdan dikey düzenler eklendi.",
    "v5.0.1 — Şövalye Turnuvası: Tur galibiyetleri canlı listeye bağlandı ve OBS için ayrı Şövalye Galipleri widget bağlantısı eklendi.",
    "v5.0.0 — Şövalye Savaşı & PNG Hediye Tasarımcısı Dev Güncellemesi: Yeni 'Şövalye Savaşı' strateji oyunu entegre edildi; askerlerin üzerinde canlı profil avatarları; hediye-asker kuralları ve galip sayacı (+/-); Launcher'a 'Hediye Tasarımı (PNG)' motoru eklendi; Admin Paneli'ne Dakika/Saat/Gün/Ay/Yıl özel süre belirleme eklendi; TikTok VS filtre animasyonları tamir edildi; MNG Crowd Control hediye ve arama sistemi eksiksiz yenilendi.",
    "v4.0.6 — MNG Orbit Gelişmiş Tur & Hediye Güncellemesi: Türkiye'ye özel 630 hediyelik tam Türkçe hediye kataloğu entegre edildi; arama motoru güçlendirildi; Yörünge Liderleri bağlantıyı kesin altına hizalandı; Turu Bitir butonu ve patlama ses efektleri eklendi.",
    "v4.0.5 — MNG Orbit Tam Onarım: Bağlantı ve oyun alanı çizim döngüsü hatasız başlatıldı; 48 canlı video arka planı eksiksiz açıldı; özel video/resim yükleme garanti altına alındı.",
    "v4.0.5 — MNG Orbit Devasa Özel Hediye Kartları: Ekranın sağ dikey ortasında dev Çay ve Money Gun kartları; 600+ hediye içerisinden istenen hediye ile değiştirilebilir dinamik eylem sistemi!",
    "v4.0.5 — MNG Crowd Control Temiz UI: Alttaki hediye butonları kaldırıldı; ayarlar menüsünden tüm hediye eylemleri detaylı liste halinde yapılandırılabilir.",
    "v4.0.2 — Launcher Temizleme: OBS Widget Linki butonları launcher kartlarından kaldırıldı; widget linkleri artık oyun içinden kopyalanabilir.",
    "v4.0.2 — Widget'lar Herkese Özel: Her kullanıcı kendi bilgisayarında çalıştırdığında widget bağlantıları yalnızca o kullanıcıya özel olarak çalışır.",
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
        if (!lisans.cihaz_kimlik) {
            lisans.cihaz_kimlik = deviceId;
            lisans.activation_token = aktivasyonTokenUret(temizKod, deviceId, lisans.bitis_zamani);
            dbKaydet();
            logEkle(temizKod, deviceId, "cihaz_baglandi", ip);
        } else if (lisans.cihaz_kimlik !== deviceId) {
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
    const rootZip = path.join(__dirname, dosya);
    if (fs.existsSync(rootZip)) {
        return res.download(rootZip);
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

    const simdi = Date.now();
    const sureMs = sureMsHesapla(sureObj);
    const bitisZamani = sureMs === -1 ? null : simdi + sureMs;

    const yeniLisans = {
        id: Date.now() + "_" + Math.random().toString(36).substr(2, 6),
        kod: kod,
        sure_birim: birim,
        sure_miktar: miktar,
        durum: "aktif",
        olusturma_zamani: simdi,
        aktivasyon_zamani: simdi,
        bitis_zamani: bitisZamani,
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

