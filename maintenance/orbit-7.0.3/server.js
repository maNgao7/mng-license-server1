import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { WebSocketServer } from "ws";
import { TikTokLiveConnection, WebcastEvent } from "tiktok-live-connector";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3010);
function widgetEventPost(route, payload) {
  const port = Number(process.env.MNG_WIDGET_PORT);
  const key = String(process.env.MNG_WIDGET_ACCESS_KEY || "");
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !/^[a-f0-9]{32}$/.test(key)) return;
  try {
    const body = JSON.stringify(payload);
    const req = http.request({
      hostname: "127.0.0.1", port, path: route + "?key=" + encodeURIComponent(key),
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      timeout: 800
    }, response => response.resume());
    req.on("timeout", () => req.destroy());
    req.on("error", () => {});
    req.end(body);
  } catch {}
}

function widgetGiftPost(payload) {
  widgetEventPost("/api/widget/gift", payload);
}

function widgetLikePost(payload) {
  widgetEventPost("/api/widget/like", payload);
}

function findTikTokVsDir() {
  const candidates = [
    path.join(__dirname, 'shared'),
    path.join(__dirname, "..", "tiktok-vs"),
    path.join(__dirname, "..", "apps", "tiktok-vs"),
    path.join(process.cwd(), "..", "tiktok-vs"),
    path.join(process.cwd(), "apps", "tiktok-vs")
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.join(__dirname, "..", "tiktok-vs");
}

const tiktokVsDir = findTikTokVsDir();
const sharedBackgroundsPath = process.env.MNG_BACKGROUNDS_DIR || path.join(tiktokVsDir, "public", "assets", "backgrounds");
const catalogAssetsPath = path.join(tiktokVsDir, "public", "assets");

const app = express();
createRequire(import.meta.url)("./launcher-widget-links.cjs").mountWidgetLinks(app, { gameId: "orbit" });
app.use(express.static(path.join(__dirname, "public")));
app.use("/catalog-assets", express.static(catalogAssetsPath, { maxAge: "30d", immutable: true }));
app.use("/shared-backgrounds", express.static(sharedBackgroundsPath));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const avatarCache = new Map();
const AVATAR_HOSTS = ["tiktokcdn.com", "byteimg.com", "ibytedtos.com", "tiktokv.com", "pravatar.cc", "unavatar.io"];
const GIFT_CATALOG_PATH = path.join(tiktokVsDir, ".gift-catalog.json");
const GORSEL_KUTUPHANE_PATH = path.join(tiktokVsDir, "public", "assets", "gift-images", "_kutuphane.json");
const LAUNCHER_AVATAR_CACHE = path.join(tiktokVsDir, ".avatar-cache");
let giftCatalog = [];
const gorselKutuphanesi = new Map();

const TURKISH_GIFT_ALIASES = {
  "gul": "Rose.png",
  "gül": "Rose.png",
  "rose": "Rose.png",
  "buket": "Bouquet.png",
  "bouquet": "Bouquet.png",
  "cicek buketi": "Bouquet.png",
  "çiçek buketi": "Bouquet.png",
  "parmak kalp": "Finger_Heart.png",
  "parmakkalp": "Finger_Heart.png",
  "finger heart": "Finger_Heart.png",
  "fingerheart": "Finger_Heart.png",
  "finger_heart": "Finger_Heart.png",
  "cay": "Tea.png",
  "çay": "Tea.png",
  "tea": "Tea.png",
  "sapka ve biyik": "Hat_and_Mustache.png",
  "şapka ve bıyık": "Hat_and_Mustache.png",
  "sapka biyik": "Hat_and_Mustache.png",
  "şapka bıyık": "Hat_and_Mustache.png",
  "hat and mustache": "Hat_and_Mustache.png",
  "hat_and_mustache": "Hat_and_Mustache.png",
  "kalp": "Heart.png",
  "heart": "Heart.png",
  "asa": "Magic_Wand.png",
  "donut": "Doughnut.png",
  "doughnut": "Doughnut.png",
  "panda": "Panda.png",
  "dondurma": "Ice_Cream_Cone.png",
  "ice cream cone": "Ice_Cream_Cone.png",
  "tiktok": "TikTok.png",
  "gg": "GG.png"
};

function normalizeGiftName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\.\.\.$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

try {
  if (fs.existsSync(GORSEL_KUTUPHANE_PATH)) {
    const list = JSON.parse(fs.readFileSync(GORSEL_KUTUPHANE_PATH, "utf8"));
    if (Array.isArray(list)) {
      list.forEach((entry) => {
        if (entry.name && entry.file) {
          gorselKutuphanesi.set(normalizeGiftName(entry.name), entry.file);
        }
      });
    }
  }
} catch (e) {
  console.warn("Görsel kütüphanesi okunamadı:", e);
}

function findLocalGiftImage(name) {
  const norm = normalizeGiftName(name);
  if (!norm) return null;
  if (TURKISH_GIFT_ALIASES[norm]) {
    return `/catalog-assets/gift-images/${TURKISH_GIFT_ALIASES[norm]}`;
  }
  const normSimple = norm.replace(/[^a-z0-9]/g, "");
  for (const [aliasKey, file] of Object.entries(TURKISH_GIFT_ALIASES)) {
    const aliasSimple = aliasKey.replace(/[^a-z0-9]/g, "");
    if (normSimple === aliasSimple || normSimple.includes(aliasSimple) || aliasSimple.includes(normSimple)) {
      return `/catalog-assets/gift-images/${file}`;
    }
  }
  if (gorselKutuphanesi.has(norm)) {
    return `/catalog-assets/gift-images/${gorselKutuphanesi.get(norm)}`;
  }
  for (const [key, file] of gorselKutuphanesi.entries()) {
    if (norm.startsWith(key) || key.startsWith(norm)) {
      return `/catalog-assets/gift-images/${file}`;
    }
  }
  return null;
}

try {
  const parsedCatalog = JSON.parse(fs.readFileSync(GIFT_CATALOG_PATH, "utf8"));
  giftCatalog = Array.isArray(parsedCatalog) ? parsedCatalog : [];
} catch {}

const FALLBACK_GIFT_ASSET = path.join(__dirname, "..", "tiktok-vs", "public", "assets", "gift-catalog", "balon-hediyesi.png");

const TAM_KATALOG_PATH = path.join(tiktokVsDir, "public", "assets", "gift-images", "katalog_tam.json");
let tamHediyeKatalogu = [];
try {
  if (fs.existsSync(TAM_KATALOG_PATH)) {
    tamHediyeKatalogu = JSON.parse(fs.readFileSync(TAM_KATALOG_PATH, "utf8"));
  }
} catch (e) {
  console.warn("Tam hediye kataloğu okunamadı:", e);
}

app.get("/api/gifts", (_req, res) => {
  const rawQuery = String(_req.query.query || "").trim().toLowerCase();
  const query = rawQuery.replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c");
  const requestedLimit = Number(_req.query.limit);
  const limit = Math.max(24, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 650, 650));

  if (!tamHediyeKatalogu.length) {
    return res.json([]);
  }

  let filtered = [];
  if (!query) {
    filtered = tamHediyeKatalogu.slice(0, limit);
  } else {
    filtered = tamHediyeKatalogu.filter((gift) => {
      const nName = String(gift.name || "").toLowerCase().replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c");
      const nTr = String(gift.trName || "").toLowerCase().replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c");
      const nFile = String(gift.file || "").toLowerCase().replace(/_/g, " ");

      if (nName.includes(query) || nTr.includes(query) || nFile.includes(query)) return true;
      if (query === "donut" && (nName.includes("doughnut") || nFile.includes("doughnut"))) return true;
      if (query === "cay" && (nName.includes("tea") || nFile.includes("tea"))) return true;
      if (query === "gul" && (nName.includes("rose") || nFile.includes("rose"))) return true;
      if (query === "para" && (nName.includes("money") || nFile.includes("money"))) return true;
      if (query === "nazar" && (nName.includes("bead") || nFile.includes("blue_bead"))) return true;
      return false;
    });
  }

  // Hediyeleri coin değerine göre küçükten büyüğe (1, 2, 5, ... 44999) sırala
  filtered.sort((a, b) => (Number(a.coins) || 0) - (Number(b.coins) || 0));

  const results = filtered.slice(0, limit).map((gift) => ({
    id: String(gift.id || gift.name),
    name: gift.trName || gift.name,
    origName: gift.name,
    coins: Math.max(1, Number(gift.coins) || 1),
    image: gift.image || `/catalog-assets/gift-images/${gift.file}`
  }));

  res.json(results);
});

app.get("/api/backgrounds", (_req, res) => {
  try {
    const files = fs.readdirSync(sharedBackgroundsPath).filter((file) => /\.mp4$/i.test(file)).sort();
    res.json(files.map((file) => ({ name: file.replace(/\.mp4$/i, ""), src: `/shared-backgrounds/${encodeURIComponent(file)}` })));
  } catch { res.json([]); }
});

function trustedAvatarUrl(value) {
  try {
    const parsed = new URL(value);
    const trustedHost = AVATAR_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
    return parsed.protocol === "https:" && trustedHost ? parsed : null;
  } catch {
    return null;
  }
}

function trustedGiftUrl(value) {
  try {
    const parsed = new URL(value);
    const trustedHost = [
      "tiktokcdn.com", "byteimg.com", "ibytedtos.com", "tiktokv.com",
      "muscdn.com", "ttwstatic.com", "akamaized.net", "byteoversea.com",
      "ibyteimg.com", "tiktok.com"
    ].some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && trustedHost ? parsed : null;
  } catch {
    return null;
  }
}

app.get("/api/gift-image", async (req, res) => {
  const giftUrl = trustedGiftUrl(req.query.url);
  if (!giftUrl) {
    if (fs.existsSync(FALLBACK_GIFT_ASSET)) {
      res.set("Content-Type", "image/png");
      return res.sendFile(FALLBACK_GIFT_ASSET);
    }
    return res.status(400).send("Geçersiz hediye görseli adresi.");
  }
  try {
    const response = await fetch(giftUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Referer": "https://www.tiktok.com/"
      },
      signal: AbortSignal.timeout(8000)
    });
    const contentType = response.headers.get("content-type") || "";
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok || !contentType.startsWith("image/") || !buffer.length || buffer.length > 8 * 1024 * 1024) {
      if (fs.existsSync(FALLBACK_GIFT_ASSET)) {
        res.set("Content-Type", "image/png");
        return res.sendFile(FALLBACK_GIFT_ASSET);
      }
      return res.status(502).send("Hediye görseli alınamadı.");
    }
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch {
    if (fs.existsSync(FALLBACK_GIFT_ASSET)) {
      res.set("Content-Type", "image/png");
      return res.sendFile(FALLBACK_GIFT_ASSET);
    }
    res.status(502).send("Hediye görseli alınamadı.");
  }
});

app.get("/api/avatar", async (req, res) => {
  const avatarUrl = trustedAvatarUrl(req.query.url);
  if (!avatarUrl) return res.status(400).send("Geçersiz profil görseli adresi.");

  // Reuse MNG Launcher's high-resolution disk cache before a CDN thumbnail.
  const username = String(req.query.user || "").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 100);
  if (username) {
    try {
      const base = path.join(LAUNCHER_AVATAR_CACHE, `user_${username}`);
      const metadata = JSON.parse(fs.readFileSync(`${base}.json`, "utf8"));
      const buffer = fs.readFileSync(`${base}.bin`);
      if (buffer.length >= 10000) {
        res.set("Content-Type", metadata.contentType || "image/jpeg");
        res.set("Cache-Control", "public, max-age=900");
        return res.send(buffer);
      }
    } catch {}
  }

  if (req.query.highres === "1" && username) {
    try {
      // MNG TikTok Game already has the proven Puppeteer + disk-cache avatar engine.
      // Ask it first so Orbit gets the same full-resolution image used in score widgets.
      const launcherResponse = await fetch(
        `http://127.0.0.1:3000/api/image?highres=1&user=${encodeURIComponent(username)}&url=${encodeURIComponent(avatarUrl.href)}`,
        { signal: AbortSignal.timeout(30000) }
      );
      const launcherType = launcherResponse.headers.get("content-type") || "image/jpeg";
      const launcherBuffer = Buffer.from(await launcherResponse.arrayBuffer());
      if (launcherResponse.ok && launcherType.startsWith("image/") && launcherBuffer.length >= 10000 && launcherBuffer.length <= 8 * 1024 * 1024) {
        avatarCache.set(avatarUrl.href, { buffer: launcherBuffer, contentType: launcherType });
        res.set("Content-Type", launcherType);
        res.set("Cache-Control", "public, max-age=900");
        return res.send(launcherBuffer);
      }
    } catch {}
  }

  const cacheKey = avatarUrl.href;
  const cached = avatarCache.get(cacheKey);
  if (cached) {
    res.set("Content-Type", cached.contentType);
    res.set("Cache-Control", "public, max-age=900");
    return res.send(cached.buffer);
  }

  try {
    const response = await fetch(avatarUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Referer": "https://www.tiktok.com/"
      },
      signal: AbortSignal.timeout(10000)
    });
    const contentType = response.headers.get("content-type") || "";
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (!response.ok || !contentType.startsWith("image/") || contentLength > 8 * 1024 * 1024) {
      return res.status(502).send("Profil görseli alınamadı.");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) return res.status(502).send("Profil görseli alınamadı.");
    const entry = { buffer, contentType };
    avatarCache.set(cacheKey, entry);
    if (avatarCache.size > 300) avatarCache.delete(avatarCache.keys().next().value);
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=900");
    res.send(buffer);
  } catch {
    res.status(502).send("Profil görseli alınamadı.");
  }
});

app.get("/api/tiktok-avatar", async (req, res) => {
  const username = String(req.query.user || "").replace(/^@/, "").trim();
  if (!/^[a-zA-Z0-9._-]{2,80}$/.test(username)) return res.status(400).send("Geçersiz kullanıcı adı.");
  try {
    const profileUrl = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
    const response = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(profileUrl)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36" },
      signal: AbortSignal.timeout(10000)
    });
    const result = await response.json();
    if (!response.ok || !trustedAvatarUrl(result.thumbnail_url)) return res.status(404).send("Profil fotoğrafı bulunamadı.");
    res.redirect(`/api/avatar?url=${encodeURIComponent(result.thumbnail_url)}`);
  } catch {
    res.status(404).send("Profil fotoğrafı bulunamadı.");
  }
});

let connection = null;
let activeUsername = "";
let lastLeaderboard = [];
let lastWinner = null;
let allWinnersMap = new Map();

function broadcast(message) {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
}

function imageUrlFrom(...sources) {
  for (const source of sources) {
    if (typeof source === "string" && source.startsWith("http")) return source;
    if (Array.isArray(source) && typeof source[0] === "string") return source[0];
    if (source && typeof source === "object") {
      const list = source.url_list || source.urlList || source.urls;
      if (Array.isArray(list) && typeof list[0] === "string") return list[0];
      if (typeof source.url === "string") return source.url;
    }
  }
  return null;
}

function avatarFrom(user = {}) {
  return imageUrlFrom(
    user.avatarLarger, user.avatarLarge, user.avatarMedium, user.avatarThumb, user.profilePictureUrl,
    user.avatar_larger, user.avatar_large, user.avatar_medium, user.avatar_thumb, user.profilePicture
  );
}

function playerFrom(data = {}) {
  const user = data.user || {};
  const profileId = user.uniqueId || user.displayId || user.userId || user.nickname;
  const id = profileId;
  if (!id) return null;
  return {
    id: String(id),
    nickname: user.nickname || user.displayId || String(id),
    avatar: avatarFrom(user),
    avatarFallback: `/api/tiktok-avatar?user=${encodeURIComponent(String(profileId).replace(/^@/, ""))}`,
    avatarLastResort: `https://unavatar.io/tiktok/${encodeURIComponent(String(profileId).replace(/^@/, ""))}`
  };
}

function giftFrom(data = {}) {
  const gift = data.gift || {};
  const detail = data.giftDetails || data.giftInfo || {};
  const extended = data.extendedGiftInfo || {};
  const count = Number(data.repeatCount || gift.repeatCount || gift.repeat_count || data.comboCount || 1) || 1;
  const coin = Number(
    extended.diamondCount || extended.diamond_count ||
    detail.diamondCount || detail.diamond_count ||
    data.diamondCount || data.diamond_count ||
    gift.diamondCount || gift.diamond_count || 0
  ) || 0;
  const giftId = extended.id || data.giftId || data.gift_id || detail.giftId || detail.gift_id || gift.id || null;
  const giftName = extended.name || extended.giftName || detail.name || detail.giftName || data.giftName || gift.name || "Hediye";
  const catalogGift = giftCatalog.find((entry) =>
    String(entry.id) === String(giftId) || (entry.tiktokIds || []).some((id) => String(id) === String(giftId)) ||
    String(entry.name || "").toLowerCase() === String(giftName).toLowerCase()
  );
  const liveGiftImage = imageUrlFrom(extended.image, detail.image, data.image, gift.image, gift.icon);
  let catalogGiftImage = null;
  if (catalogGift?.image) {
    catalogGiftImage = String(catalogGift.image).startsWith("http")
      ? `/api/gift-image?url=${encodeURIComponent(String(catalogGift.image))}`
      : `/catalog-assets/${String(catalogGift.image).replace(/^assets\//, "")}`;
  }
  let finalGiftImage = null;
  if (liveGiftImage) {
    finalGiftImage = String(liveGiftImage).startsWith("http")
      ? `/api/gift-image?url=${encodeURIComponent(String(liveGiftImage))}`
      : liveGiftImage;
  } else {
    finalGiftImage = catalogGiftImage || "/catalog-assets/gift-catalog/balon-hediyesi.png";
  }
  return {
    count,
    coins: count * coin,
    giftId: String(catalogGift?.id || giftId || giftName),
    catalogCoins: Number(catalogGift?.coins || coin) || 0,
    giftName,
    giftImage: finalGiftImage
  };
}

function eulerKey() {
  const candidates = [
    path.join(__dirname, "euler-api-key.txt"),
    path.join(__dirname, "..", "tiktok-vs", "euler-api-key.txt")
  ];
  for (const candidate of candidates) {
    try {
      const key = fs.readFileSync(candidate, "utf8").trim();
      if (key) return key;
    } catch {}
  }
  return undefined;
}

function disconnect() {
  if (!connection) return;
  try { connection.disconnect(); } catch {}
  connection = null;
}

function connect(username) {
  const cleanUsername = String(username || "").replace(/^@/, "").trim();
  if (!cleanUsername) {
    broadcast({ type: "status", state: "error", message: "TikTok kullanıcı adı gerekli." });
    return;
  }

  disconnect();
  activeUsername = cleanUsername;
  broadcast({ type: "status", state: "connecting", message: `@${cleanUsername} yayınına bağlanılıyor...` });

  connection = new TikTokLiveConnection(cleanUsername, { signApiKey: eulerKey() });
  const activeConnection = connection;

  connection.on("error", (error) => {
    if (connection !== activeConnection) return;
    broadcast({ type: "status", state: "error", message: error?.message || "TikTok bağlantısı kurulamadı." });
  });

  connection.connect()
    .then(() => {
      if (connection !== activeConnection) return;
      broadcast({ type: "status", state: "connected", message: `@${cleanUsername} yayınına bağlandı.` });
    })
    .catch((error) => {
      if (connection !== activeConnection) return;
      broadcast({ type: "status", state: "error", message: error?.message || "Yayın bulunamadı veya bağlantı kurulamadı." });
    });

  if (WebcastEvent.GIFT) connection.on(WebcastEvent.GIFT, (data) => {
    const player = playerFrom(data);
    if (!player) return;
    const gift = giftFrom(data);
    widgetGiftPost({username:player.id,nickname:player.nickname,avatar:player.avatar,giftName:gift.giftName||"Hediye",giftImage:String(gift.giftImage||"").startsWith("/")?"http://127.0.0.1:3010"+gift.giftImage:gift.giftImage,coins:Number(gift.coins)||0});
    broadcast({ type: "orbit-event", event: "gift", player, ...gift });
  });

  if (WebcastEvent.LIKE) connection.on(WebcastEvent.LIKE, (data) => {
    const player = playerFrom(data);
    if (!player) return;
    const likeBatch = Math.max(1, Number(data.count ?? data.likeCount ?? 1) || 1);
    widgetLikePost({ username: player.id, nickname: player.nickname, avatar: player.avatar, likeCount: likeBatch });
    broadcast({ type: "orbit-event", event: "like", player, count: likeBatch });
  });

  if (WebcastEvent.SOCIAL) connection.on(WebcastEvent.SOCIAL, (data) => {
    const action = String(data.displayType || data.action || data.label || "").toLowerCase();
    if (!action.includes("follow")) return;
    const player = playerFrom(data);
    if (player) broadcast({ type: "orbit-event", event: "follow", player });
  });

  // The connector emits a dedicated follow event on current TikTok rooms.
  // Listening here avoids relying on the varying social-action labels.
  if (WebcastEvent.FOLLOW) connection.on(WebcastEvent.FOLLOW, (data) => {
    const player = playerFrom(data);
    if (player) broadcast({ type: "orbit-event", event: "follow", player });
  });

  connection.on(WebcastEvent.DISCONNECTED, () => {
    if (connection === activeConnection) {
      broadcast({ type: "status", state: "disconnected", message: "TikTok bağlantısı kesildi." });
    }
  });
}

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "status", state: connection ? "connected" : "idle", message: activeUsername ? `@${activeUsername} yayını izleniyor.` : "Yayın kullanıcı adını girin." }));
  ws.send(JSON.stringify({ type: "leaderboard", entries: lastLeaderboard }));
  const sortedWinners = [...allWinnersMap.values()].sort((a, b) => b.count - a.count);
  ws.send(JSON.stringify({ type: "winner", winner: lastWinner || sortedWinners[0] || null, winnersList: sortedWinners }));
  ws.on("message", (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    if (message.type === "connect") connect(message.username);
    if (message.type === "leaderboard" && Array.isArray(message.entries)) {
      lastLeaderboard = message.entries.slice(0, 10).map((entry) => ({
        id: String(entry.id || ""),
        nickname: String(entry.nickname || entry.id || "İzleyici").slice(0, 80),
        avatar: typeof entry.avatar === "string" ? entry.avatar.slice(0, 2000) : null,
        mass: Math.max(0, Math.round(Number(entry.mass) || 0))
      }));
      broadcast({ type: "leaderboard", entries: lastLeaderboard });
    }
    if (message.type === "winner" && message.winner) {
      const w = message.winner;
      const wId = String(w.id || w.nickname || "Kazanan");
      const existing = allWinnersMap.get(wId) || {
        id: wId,
        nickname: String(w.nickname || "Kazanan"),
        avatar: typeof w.avatar === "string" ? w.avatar : null,
        count: 0
      };
      existing.count = Math.max(existing.count + 1, Number(w.count) || (existing.count + 1));
      if (w.nickname) existing.nickname = w.nickname;
      if (w.avatar) existing.avatar = w.avatar;
      allWinnersMap.set(wId, existing);
      lastWinner = existing;

      const winnersList = Array.isArray(message.winnersList) && message.winnersList.length
        ? message.winnersList
        : [...allWinnersMap.values()].sort((a, b) => b.count - a.count);

      broadcast({ type: "winner", winner: lastWinner, winnersList: winnersList });
    }
    if (message.type === "winner-update" && Array.isArray(message.winnersList)) {
      allWinnersMap = new Map();
      message.winnersList.forEach(w => {
        const wId = String(w.id || w.nickname || "Kazanan");
        if (wId && (w.count || 0) > 0) allWinnersMap.set(wId, w);
      });
      lastWinner = [...allWinnersMap.values()].sort((a, b) => b.count - a.count)[0] || null;
      broadcast({ type: "winner-update", winnersList: message.winnersList });
    }
    if (message.type === "disconnect") {
      disconnect();
      activeUsername = "";
      broadcast({ type: "status", state: "idle", message: "Bağlantı kapatıldı." });
    }
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, app: "mng-orbit", connected: !!connection, activeUsername });
});

app.all("/api/disconnect", (_req, res) => {
  disconnect();
  activeUsername = "";
  broadcast({ type: "status", state: "idle", message: "Bağlantı kapatıldı." });
  res.json({ ok: true });
});

function guvenliKapat() {
  disconnect();
  try { server.close(); } catch {}
}
process.on("SIGINT", () => { guvenliKapat(); process.exit(0); });
process.on("SIGTERM", () => { guvenliKapat(); process.exit(0); });

server.listen(PORT, "0.0.0.0", () => {
  console.log(`MNG Orbit: http://127.0.0.1:${PORT}`);
});
