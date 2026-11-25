import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileDuelController, mergeProfile } from './launcher-adapter.mjs';
import { normalizePointsPerGift } from './core.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = path.join(projectRoot, 'web');
const host = process.env.HOST || '127.0.0.1';
const requestedPort = Number(process.env.PORT || 44180);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.png':'image/png' };
const csp = "default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'";

function safeJson(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}

async function readJson(req, maxBytes = 64 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('İstek gövdesi çok büyük.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function validProfile(value) {
  const username = String(value?.username ?? '').trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9_.]{1,64}$/.test(username)) return null;
  const avatarUrl = String(value?.avatarUrl || value?.avatar || '').trim();
  return {
    username,
    nickname: String(value?.nickname ?? username).trim().slice(0, 80) || username,
    avatarUrl: avatarUrl.startsWith('/') || avatarUrl.startsWith('./') ? avatarUrl : httpsUrl(avatarUrl) || '',
  };
}

function httpsUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export async function createPreviewServer({ port = requestedPort } = {}) {
  const subscribers = new Set();
  const profiles = new Map();
  let controller = null;
  let controllerUnsubscribe = null;
  let snapshot = null;
  let closing = false;

  function publish(next) {
    snapshot = next;
    const message = `data: ${JSON.stringify(next)}\n\n`;
    for (const res of subscribers) {
      try { res.write(message); } catch { subscribers.delete(res); }
    }
  }

  function createPreviewBus() {
    const listeners = new Set();
    return {
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      emit(event) { let result; for (const listener of listeners) result = listener(event); return result; },
    };
  }

  let bus = createPreviewBus();
  function replaceController(owner) {
    controllerUnsubscribe?.();
    controller?.close();
    bus = createPreviewBus();
    controller = createProfileDuelController({
      channel: owner.username,
      subscribe: bus.subscribe,
      getProfile: username => profiles.get(username) || null,
      onChange: publish,
    });
    controllerUnsubscribe = controller.subscribe(publish);
    controller.updateOwnerProfile(owner);
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (closing) return safeJson(res, 503, { error: 'Sunucu kapatılıyor.' });
      const expectedHost = `${host}:${server.address()?.port}`;
      if (req.headers.host !== expectedHost && req.headers.host !== `localhost:${server.address()?.port}`) {
        return safeJson(res, 403, { error: 'Yerel bağlantı gerekli.' });
      }
      const origin = req.headers.origin;
      if (origin && origin !== `http://${expectedHost}` && origin !== `http://localhost:${server.address()?.port}`) {
        return safeJson(res, 403, { error: 'Kaynak reddedildi.' });
      }
      const url = new URL(req.url, `http://${expectedHost}`);

      if (req.method === 'GET' && url.pathname === '/api/health') {
        return safeJson(res, 200, { app: 'profile-duel-preview', mode: 'synthetic-preview', sessionOwner: 'launcher-only' });
      }
      if (req.method === 'GET' && url.pathname === '/api/state') {
        return safeJson(res, 200, snapshot || { phase: 'idle', owner: null, opponent: null, scores: { left: 0, right: 0 }, remainingMs: 0 });
      }
      if (req.method === 'GET' && url.pathname === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(': connected\n\n');
        if (snapshot) res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
        subscribers.add(res);
        const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
        heartbeat.unref?.();
        req.on('close', () => { clearInterval(heartbeat); subscribers.delete(res); });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/preview/start') {
        const body = await readJson(req);
        const owner = validProfile(body.owner);
        const opponent = validProfile(body.opponent);
        if (!owner || !opponent || owner.username === opponent.username) return safeJson(res, 400, { error: 'Yayıncı ve farklı rakip profili gerekli.' });
        profiles.set(owner.username, owner);
        profiles.set(opponent.username, opponent);
        replaceController(owner);
        controller.chooseOpponent(opponent);
        const result = controller.start(body.durationSeconds);
        if (!result.ok) return safeJson(res, 409, result);
        return safeJson(res, 200, { result, snapshot: controller.snapshot() });
      }
      if (req.method === 'POST' && url.pathname === '/api/preview/event') {
        const event = await readJson(req);
        if (!controller) return safeJson(res, 409, { error: 'Önce test turunu başlat.' });
        const profile = validProfile(event.profile ?? event.user ?? event);
        if (profile) profiles.set(profile.username, profile);
        const result = bus.emit({ ...event, type: 'gift' });
        return safeJson(res, 200, { accepted: true, result, snapshot: controller.snapshot() });
      }
      if (req.method === 'POST' && url.pathname === '/api/preview/pause') {
        return controller ? safeJson(res, 200, { result: controller.pause(), snapshot: controller.snapshot() }) : safeJson(res, 409, { error: 'Tur henüz başlamadı.' });
      }
      if (req.method === 'POST' && url.pathname === '/api/preview/reset') {
        controller?.reset();
        return safeJson(res, 200, { snapshot: controller?.snapshot() ?? null });
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, { Allow: 'GET, HEAD, POST' });
        return res.end();
      }

      const requested = url.pathname === '/' ? 'index.html' : url.pathname === '/widget' ? 'widget.html' : decodeURIComponent(url.pathname.slice(1));
      const file = path.resolve(webRoot, requested);
      const relative = path.relative(webRoot, file);
      if (relative.startsWith('..') || path.isAbsolute(relative)) return safeJson(res, 403, { error: 'Dosya yolu reddedildi.' });
      const stat = await fs.promises.stat(file).catch(() => null);
      if (!stat?.isFile()) return safeJson(res, 404, { error: 'Dosya bulunamadı.' });
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': csp,
        'Referrer-Policy': 'no-referrer',
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    } catch (error) {
      if (!res.headersSent) safeJson(res, 400, { error: error.message === 'Unexpected end of JSON input' ? 'Geçerli JSON gerekli.' : 'İstek işlenemedi.' });
      else res.end();
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.removeListener('error', reject); resolve(); });
  });
  const address = server.address();
  const baseUrl = `http://${host}:${address.port}`;
  const tickTimer = setInterval(() => controller?.tick(), 100);
  tickTimer.unref?.();

  return {
    baseUrl,
    server,
    async close() {
      if (closing) return;
      closing = true;
      clearInterval(tickTimer);
      controllerUnsubscribe?.();
      controller?.close();
      for (const res of subscribers) res.end();
      subscribers.clear();
      server.closeAllConnections?.();
      await new Promise(resolve => server.close(resolve));
    },
  };
}

export async function createLauncherServer({ port = 0, host = '127.0.0.1', channel,
  ownerProfile, subscribeSharedEvents, getCachedProfile = () => null,
  getPortrait = () => null, getParticipants = () => [], getGiftCatalog = () => [], getGiftImage = () => null,
  getLiveStatus = () => ({ status: 'disconnected', message: 'Yayın bağlantısı bekleniyor.' }),
  connectLive = null, autoSelectOwner = true, getBroadcastURL = null,
  allowSyntheticTest = false, giftConfig = {}, onGiftConfig = () => {} } = {}) {
  let owner = validProfile(ownerProfile || { username: channel });
  if (!owner && typeof connectLive !== 'function') throw new TypeError('Geçerli yayıncı profili gerekli.');
  if (typeof subscribeSharedEvents !== 'function') throw new TypeError('Launcher ortak olay akışı gerekli.');

  const token = crypto.randomBytes(24).toString('base64url');
  const subscribers = new Set();
  let snapshot = null;
  let closing = false;
  let controller = null;
  let controllerUnsubscribe = null;
  let sharedUnsubscribe = null;
  const syntheticListeners = new Set();
  const processedGiftIdsByChannel = new Map();
  let activeGiftConfig = giftConfig;
  let connecting = false;

  function publish(next) {
    snapshot = next;
    const message = `data: ${JSON.stringify(next)}\n\n`;
    for (const response of subscribers) {
      try { response.write(message); } catch { subscribers.delete(response); }
    }
  }

  function replaceController(nextOwner, selectOwner = true) {
    controllerUnsubscribe?.(); controller?.close(); owner = nextOwner;
    if (owner && !processedGiftIdsByChannel.has(owner.username)) {
      processedGiftIdsByChannel.set(owner.username, new Set());
    }
    controller = createProfileDuelController({
      channel: owner?.username || 'tikmng_no_channel',
      subscribe: listener => {
        sharedUnsubscribe = subscribeSharedEvents((type, event, metadata = {}) => {
          if (nextOwner && metadata.source === 'live' && String(metadata.channel || '').replace(/^@/, '').toLowerCase() === nextOwner.username) {
            listener(type, event);
          }
        });
        syntheticListeners.add(listener);
        return () => {
          sharedUnsubscribe?.();
          sharedUnsubscribe = null;
          syntheticListeners.delete(listener);
        };
      },
      getProfile: owner ? getCachedProfile : undefined,
      giftConfig: activeGiftConfig,
      processedEventIds: processedGiftIdsByChannel.get(owner?.username),
    });
    if (owner) controller.updateOwnerProfile(owner);
    if (!owner || !selectOwner) controller.choosePlayer('left', null);
    controllerUnsubscribe = controller.subscribe(publish);
  }
  replaceController(owner, autoSelectOwner);

  function participantProfiles() {
    const profiles = new Map();
    if (!owner) return profiles;
    for (const row of [owner, ...getParticipants(), ...controller.participants()]) {
      const profile = validProfile(row);
      if (!profile) continue;
      const old = profiles.get(profile.username);
      profiles.set(profile.username, {
        ...mergeProfile(old, profile),
        commented: !!(old?.commented || row.commented),
        totalLikes: Math.max(old?.totalLikes || 0, Number(row.totalLikes) || 0),
        coins: Math.max(old?.coins || 0, Number(row.coins) || 0),
      });
    }
    return profiles;
  }

  function withCachedProfile(profile) {
    const cached = validProfile({ ...getCachedProfile(profile.username), username: profile.username });
    return mergeProfile(profile, cached);
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (closing) return safeJson(res, 503, { error: 'Oyun kapatılıyor.' });
      const expectedHost = `${host}:${server.address()?.port}`;
      const remote = String(req.socket.remoteAddress || '');
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)
        || (req.headers.host !== expectedHost && req.headers.host !== `localhost:${server.address()?.port}`)) {
        return safeJson(res, 403, { error: 'Yalnızca bu bilgisayardaki oyun penceresi kullanılabilir.' });
      }
      const url = new URL(req.url, `http://${expectedHost}`);
      const origin = req.headers.origin;
      if (origin && origin !== `http://${expectedHost}` && origin !== `http://localhost:${server.address()?.port}`) {
        return safeJson(res, 403, { error: 'Kaynak reddedildi.' });
      }
      const authorized = url.searchParams.get('key') === token;

      if (req.method === 'GET' && url.pathname === '/api/health') {
        return safeJson(res, 200, { app: 'profile-duel', mode: 'launcher-shared-session', sessionOwner: 'launcher' });
      }
      if (req.method === 'GET' && url.pathname === '/api/meta') {
        if (!authorized) return safeJson(res, 403, { error: 'Oyun oturumu doğrulanamadı.' });
        let live = {};
        try { live = getLiveStatus() || {}; } catch {}
        const broadcastUrlSupported = typeof getBroadcastURL === 'function';
        let broadcastUrl = null;
        if (broadcastUrlSupported) {
          const requestedOwner = owner;
          try {
            const url = await getBroadcastURL(owner?.username || '');
            if (requestedOwner === owner) broadcastUrl = httpsUrl(url);
          } catch {}
        }
        return safeJson(res, 200, { owner, giftConfig: controller.snapshot().giftConfig, diagnostics:controller.diagnostics(),live: { status: String(live.status || 'disconnected'), username:live.username,reason:live.reason, message: String(live.message || '').slice(0, 160) }, allowSyntheticTest,
          broadcastUrlSupported, ...(broadcastUrl ? { broadcastUrl } : {}) });
      }
      if (req.method === 'GET' && url.pathname === '/api/participants') {
        if (!authorized) return safeJson(res, 403, { error: 'Oyun oturumu doğrulanamadı.' });
        const participants = [...participantProfiles().values()].slice(0, 5000).map(withCachedProfile);
        return safeJson(res, 200, { participants });
      }
      if (req.method === 'GET' && url.pathname === '/api/state') return safeJson(res, 200, snapshot);
      if (req.method === 'GET' && url.pathname === '/api/gifts') {
        if (!authorized) return safeJson(res, 403, { error: 'Oyun oturumu doğrulanamadı.' });
        return safeJson(res, 200, { gifts: getGiftCatalog() });
      }
      if (req.method === 'GET' && url.pathname === '/api/gift-image') {
        const id = url.searchParams.get('id');
        const bytes = /^[0-9]{1,12}$/.test(id || '') ? getGiftImage(id) : null;
        if (!Buffer.isBuffer(bytes)) return safeJson(res,404,{error:'Hediye görseli bulunamadı.'});
        res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=86400'});return res.end(bytes);
      }
      if (req.method === 'GET' && url.pathname === '/api/portrait') {
        const username = String(url.searchParams.get('username') || '').replace(/^@/, '').toLowerCase();
        if (!/^[a-z0-9_.]{1,64}$/.test(username)) return safeJson(res, 400, { error: 'Kullanıcı adı geçersiz.' });
        const portrait = await getPortrait(username);
        if (!Buffer.isBuffer(portrait) || portrait.length > 2 * 1024 * 1024) return safeJson(res, 404, { error: 'Profil fotoğrafı önbellekte bulunamadı.' });
        const mimeType = portrait.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
          : portrait[0] === 255 && portrait[1] === 216 && portrait[2] === 255 ? 'image/jpeg'
            : portrait.subarray(0, 4).toString() === 'RIFF' && portrait.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : '';
        if (!mimeType) return safeJson(res, 415, { error: 'Profil görseli biçimi desteklenmiyor.' });
        res.writeHead(200, { 'Content-Type': mimeType, 'Content-Length': portrait.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        return res.end(portrait);
      }
      if (req.method === 'GET' && url.pathname === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(': connected\n\n');
        if (snapshot) res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
        subscribers.add(res);
        const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
        heartbeat.unref?.();
        req.on('close', () => { clearInterval(heartbeat); subscribers.delete(res); });
        return;
      }
      if (req.method === 'POST' && url.pathname.startsWith('/api/live/') && url.pathname !== '/api/live/test-event') {
        if (!authorized) return safeJson(res, 403, { error: 'Oyun oturumu doğrulanamadı.' });
        const body = await readJson(req);
        if (connecting && ['/api/live/connect', '/api/live/start', '/api/live/pause'].includes(url.pathname)) {
          return safeJson(res, 409, { error: 'Yayın hesabı değiştiriliyor. Bağlantının tamamlanmasını bekleyin.' });
        }
        if (url.pathname === '/api/live/connect') {
          if (typeof connectLive !== 'function') return safeJson(res, 409, { error: 'Yayın hesabı bu ekrandan değiştirilemiyor.' });
          const requested = validProfile({ username: body.username });
          if (!requested) return safeJson(res, 400, { error: 'Geçerli bir TikTok kullanıcı adı girin.' });
          if (controller.snapshot().phase === 'running') return safeJson(res, 409, { error: 'Yayın hesabını tur bittikten sonra değiştirin.' });
          connecting = true;
          try {
            const live = await connectLive(requested.username);
            if (closing) return safeJson(res, 503, { error: 'Oyun kapatılıyor.' });
            const cached = validProfile({ ...getCachedProfile(requested.username), username: requested.username });
            replaceController(cached, false);
            return safeJson(res, 200, { live, owner: cached, snapshot: controller.snapshot() });
          } finally {
            connecting = false;
          }
        }
        if (url.pathname === '/api/live/player') {
          const identity = validProfile({ username: body.username });
          const profile = identity && (participantProfiles().get(identity.username) || identity);
          if (body.username != null && !profile) return safeJson(res, 400, { error: 'Geçerli bir profil seçin.' });
          const result = controller.choosePlayer(body.side, profile);
          return safeJson(res, result ? 200 : 409, { error: result ? undefined : 'Hazır durumda iki farklı profil seçin.', snapshot: controller.snapshot() });
        }
        if (url.pathname === '/api/live/start') {
          if (!owner) return safeJson(res, 409, { error: 'Önce bir yayın hesabı seçin.' });
          if (body.left) {
            const left = validProfile({ username: body.left });
            const right = validProfile({ username: body.opponent });
            if (!left || !right || !controller.choosePlayers(left, right)) return safeJson(res, 409, { error: 'Hazır durumda iki farklı profil seçin.' });
          }
          const opponent = validProfile({ username: body.opponent, nickname: body.opponentName || body.opponent });
          if (!opponent || opponent.username === controller.snapshot().owner?.username) return safeJson(res, 400, { error: 'Şampiyondan farklı bir rakip kullanıcı adı gerekli.' });
          if (!controller.chooseOpponent(opponent)) return safeJson(res, 409, { error: 'Rakip, tur sürerken değiştirilemez.' });
          const result = controller.start(body.durationSeconds);
          return safeJson(res, result.ok ? 200 : 409, { result, snapshot: controller.snapshot() });
        }
        if (url.pathname === '/api/live/pause') return safeJson(res, 200, { result: controller.pause(), snapshot: controller.snapshot() });
        if (url.pathname === '/api/live/settings') {
          if (controller.snapshot().phase === 'running') return safeJson(res, 409, { error: 'Hediye ayarları tur sırasında değiştirilemez.' });
          const pointValues = [body.rosePointsPerGift, body.tiktokPointsPerGift];
          if (pointValues.some(value => value != null && normalizePointsPerGift(value) === null)) {
            return safeJson(res, 400, { error: 'Hediye başına puan pozitif bir tam sayı olmalıdır. Coin puanlaması için alanı boş bırakın.' });
          }
          const catalog = getGiftCatalog();
          const leftGift = catalog.find(g => String(g.id) === String(body.roseGiftIds?.[0]));
          const rightGift = catalog.find(g => String(g.id) === String(body.tiktokGiftIds?.[0]));
          if (leftGift && rightGift && leftGift.id === rightGift.id) return safeJson(res,409,{error:'İki taraf için farklı hediyeler seçin.'});
          const result = controller.configureGifts({...body,
            ...(leftGift ? {roseUnitCoins:leftGift.coins} : {}), ...(rightGift ? {tiktokUnitCoins:rightGift.coins} : {})});
          if (!result) return safeJson(res, 409, { error: 'Hediye ayarları kaydedilemedi.' });
          const updated = controller.snapshot();
          activeGiftConfig = updated.giftConfig;
          try { onGiftConfig(activeGiftConfig); } catch {}
          return safeJson(res, 200, { giftConfig: activeGiftConfig, snapshot: updated });
        }
        if (url.pathname === '/api/live/next') return safeJson(res, controller.nextRound() ? 200 : 409, { snapshot: controller.snapshot() });
        if (url.pathname === '/api/live/reset') {
          controller.reset();
          return safeJson(res, 200, { snapshot: controller.snapshot() });
        }
      }
      if (req.method === 'POST' && (url.pathname === '/api/preview/event' || url.pathname === '/api/live/test-event')) {
        if (!authorized || !allowSyntheticTest) return safeJson(res, 404, { error: 'Sentetik test yalnızca yönetici ön izlemesinde kullanılabilir.' });
        const event = await readJson(req);
        for (const listener of syntheticListeners) listener('gift', { ...event, test: true });
        return safeJson(res, 200, { snapshot: controller.snapshot() });
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, { Allow: 'GET, HEAD, POST' });
        return res.end();
      }

      const name = url.pathname === '/' || url.pathname === '/control' ? 'launcher.html'
        : url.pathname === '/widget' ? 'widget.html' : decodeURIComponent(url.pathname.slice(1));
      const file = path.resolve(webRoot, name);
      const relative = path.relative(webRoot, file);
      if (relative.startsWith('..') || path.isAbsolute(relative)) return safeJson(res, 403, { error: 'Dosya yolu reddedildi.' });
      const stat = await fs.promises.stat(file).catch(() => null);
      if (!stat?.isFile()) return safeJson(res, 404, { error: 'Dosya bulunamadı.' });
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': csp,
        'Referrer-Policy': 'no-referrer',
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    } catch (error) {
      if (!res.headersSent) safeJson(res, 400, { error: error.message === 'Unexpected end of JSON input' ? 'Geçerli JSON gerekli.' : 'İstek işlenemedi.' });
      else res.end();
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.removeListener('error', reject); resolve(); });
  });
  const address = server.address();
  const baseUrl = `http://${host}:${address.port}`;
  const tickTimer = setInterval(() => controller?.tick(), 100);
  tickTimer.unref?.();

  return {
    baseUrl,
    controlUrl: `${baseUrl}/control?key=${encodeURIComponent(token)}`,
    widgetUrl: `${baseUrl}/widget`,
    getBroadcastState: () => snapshot,
    getChannel: () => owner?.username || '',
    server,
    async close() {
      if (closing) return;
      closing = true;
      clearInterval(tickTimer);
      controllerUnsubscribe?.();
      controller?.close();
      sharedUnsubscribe?.();
      for (const response of subscribers) response.end();
      subscribers.clear();
      server.closeAllConnections?.();
      await new Promise(resolve => server.close(resolve));
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createPreviewServer().then(({ baseUrl, close }) => {
    process.stdout.write(`Profile Duel preview: ${baseUrl}\n`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => close().finally(() => process.exit(0)));
  }).catch(() => {
    process.stderr.write('Profile Duel preview could not start.\n');
    process.exitCode = 1;
  });
}
