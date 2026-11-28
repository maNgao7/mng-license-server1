'use strict';

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { createGiftNormalizer } = require('./gift-normalizer.cjs');
const GIFT_COINS = new Map(require('../assets/gift-catalog.json').map(gift => [String(gift.id), gift.coins]));
const clean = value => typeof value === 'string' ? value.trim() : '';
const identifier = value => typeof value === 'string' ? value.trim()
  : typeof value === 'bigint' || Number.isSafeInteger(value) ? String(value) : '';
const historical = value => value?.initial === true || value?.isInitial === true
  || value?.replay === true || value?.isReplay === true
  || value?.historical === true || value?.isHistorical === true;
const OWNER_POLL_MS = 100;
const OWNER_RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000];

// This private prototype deliberately reuses installed, verified TikMnG code.
// It is not a distributable package and never reads launcher account files.
const LOCAL_SHARED_ROOT = path.resolve(__dirname, '../runtime/shared');
const SHARED_ROOT = fs.existsSync(path.join(LOCAL_SHARED_ROOT, 'vendor/live-session.cjs'))
  ? LOCAL_SHARED_ROOT : 'D:/TikMnG/Animal-Times-Live/bridge';
function sharedModules(root = SHARED_ROOT) {
  return {
    ...require(path.join(root, 'vendor/live-session.cjs')),
    ...require(path.join(root, 'vendor/pk-profiles.cjs')),
    ...require(path.join(root, 'vendor/portrait-engine.cjs')),
    ...require(path.join(root, 'lib/owner.cjs')),
  };
}

// Generic callbacks receive normalized events, not match acceptance envelopes.
// Raw gifts retain cumulative repeatCount/streakId; owner gifts have isDelta.
// Consumers (AudienceQueue or the legacy match) own dedupe and streak deltas.
function createHediyeBoxLive({ match, onStatus = () => {}, onGift = () => {},
  onChat = () => {}, onGiftRaw = () => {}, onLike = () => {}, onFollow = () => {}, onPortrait,
  forzaPortraitDirectory = path.resolve('control/live/portraits'),
  shared = sharedModules(), createConnection, events = {}, env = process.env,
  timers = globalThis } = {}) {
  if (match != null && typeof match.ingestGift !== 'function') throw new TypeError('Match required');
  const normalize = createGiftNormalizer(shared);
  let connection = null, removeRawGift = null, closed = false, pollTimer = null;
  let owner = null, ownerCursor = 0, ownerSession = '', generation = 0;
  let ownerHistoryDrained = false;
  const pendingPortraits = new Map();
  let portraitDirectory, portraitReads = 0;
  let status = { status: 'disconnected', username: '', message: 'Yayın bağlantısı bekleniyor.' };
  const publish = value => { status = { ...status, ...value }; onStatus({ ...status }); };
  const isCurrent = run => !closed && generation === run;
  function receive(payload, roomId, isDelta = false) {
    const normalized = normalize(payload, { roomId, isDelta, isTest: payload?.isTest === true });
    if (!normalized) return;
    // The existing normalizer intentionally omits prices. Read per-unit coins
    // from the original payload BEFORE losing those fields, then the catalog.
    const rawUnit = payload.coinUnit ?? payload.diamondCount ?? payload.giftDetails?.diamondCount
      ?? payload.gift?.diamondCount ?? payload.extendedGiftInfo?.diamondCount ?? payload.coins;
    const price = Number(rawUnit ?? GIFT_COINS.get(normalized.giftId) ?? 0);
    const coinUnit = Number.isSafeInteger(price) && price >= 0 ? price : GIFT_COINS.get(normalized.giftId) || 0;
    const event = { ...normalized, id: normalized.userId || normalized.uniqueId,
      portrait: normalized.profilePictureUrl, coinUnit, isDelta };
    // Keep callback mutation from changing the legacy match's input.
    onGiftRaw({ ...event, profilePictureUrls: [...event.profilePictureUrls] });
    if (match) {
      const result = match.ingestGift(normalized);
      if (result.accepted) onGift({ event: normalized, result, receivedAt: Date.now() });
    }
  }
  function supporterEvent(type, payload, roomId) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
    const rawId = identifier(payload.eventId || payload.msgId || payload.common?.msgId || payload.logId);
    const senderId = payload.userIdStr || payload.userId || payload.viewerId;
    const sender = payload.user || payload;
    const profile = shared.readProfile(sender, senderId);
    if (!profile && payload.user && senderId && (sender.id || sender.userId || sender.id_str)) return;
    const userId = identifier(profile?.id || senderId || sender.id);
    const uniqueId = clean(profile?.username || sender.uniqueId || sender.displayId || payload.uniqueId || payload.username)
      .replace(/^@/, '').toLowerCase();
    if (!rawId || (!userId && !uniqueId)) return;
    const urls = shared.portraitCandidates(payload).slice().sort((a, b) => b.rank - a.rank)
      .flatMap(group => group.urls || []).filter(url => typeof url === 'string' && /^https:\/\//i.test(url));
    const fallback = clean(profile?.avatar || payload.profilePictureUrl || payload.portrait || payload.bestPortraitUrl || payload.avatarUrl);
    const portrait = urls[0] || (/^https:\/\//i.test(fallback) ? fallback : '');
    return {
      id: userId || uniqueId, userId, uniqueId,
      eventId: createHash('sha256').update(JSON.stringify([String(roomId || ''), type, rawId])).digest('hex'),
      nickname: clean(profile?.nickname || sender.nickname || payload.nickname) || uniqueId || userId,
      portrait, profilePictureUrl: portrait,
      profilePictureUrls: [...new Set([portrait, ...urls].filter(Boolean))],
    };
  }
  function receiveChat(payload, roomId) {
    if (payload?.isTest === true) return;
    const comment = clean(payload?.comment) || clean(payload?.content);
    if (!comment) return;
    const event = supporterEvent('chat', payload, roomId);
    if (event) onChat({ ...event, comment });
  }
  function receiveFollow(payload, roomId) {
    const event = supporterEvent('follow', payload, roomId);
    if (!event) return;
    addLocalPortrait(event,payload);
    queueOwnerPortrait(event,payload);
    onFollow(event);
  }
  function addLocalPortrait(event,payload) {
    const localPortrait = forzaPortrait(payload);
    if (localPortrait) {
      event.portrait = event.profilePictureUrl = localPortrait;
      event.profilePictureUrls.unshift(localPortrait);
    }
  }
  function queueOwnerPortrait(event,payload) {
    const route = '/portrait/' + event.uniqueId;
    if (onPortrait && owner?.kind === 'owner' && /^[a-z0-9_.]{1,64}$/.test(event.uniqueId)
        && (payload.bestPortraitUrl === route || payload.avatarUrl === route)) {
      pendingPortraits.set(event.uniqueId, { route, userId: event.userId, uniqueId: event.uniqueId, attempts: 0, nextRead: 0 });
    }
  }
  function forzaPortrait(payload) {
    if (owner?.kind !== 'forza' || !/^tiktok-bridge-avatar-[a-f0-9]{64}\.png$/.test(payload.avatarFile || '')) return '';
    return pathToFileURL(path.join(forzaPortraitDirectory, payload.avatarFile)).href;
  }

  // Owner portraits require a bearer header which must stay in this process.
  // A pending photo (202) never delays the join or the next journal row.
  async function readPortrait(target) {
    portraitReads++;
    target.nextRead = Infinity;
    try {
      const image = await shared.requestJSON(owner.url, target.route, { token: owner.token, image: true });
      if (closed || pendingPortraits.get(target.uniqueId) !== target) return;
      if (!image) return;
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[image.mime];
      if (!extension || !Buffer.isBuffer(image.bytes) || !image.bytes.length || image.bytes.length > 4 * 1024 * 1024) return;
      portraitDirectory ||= fs.mkdtempSync(path.join(os.tmpdir(), 'hediye-box-portraits-'));
      const name = createHash('sha256').update(image.bytes).digest('hex') + '.' + extension;
      const file = path.join(portraitDirectory, name);
      if (!fs.existsSync(file)) fs.writeFileSync(file, image.bytes);
      pendingPortraits.delete(target.uniqueId);
      onPortrait({ userId: target.userId, uniqueId: target.uniqueId, portrait: pathToFileURL(file).href });
    } catch {
      // A portrait fetch failure does not interrupt journal delivery.
    } finally {
      portraitReads--;
      if (pendingPortraits.get(target.uniqueId) === target) {
        target.attempts++;
        if (target.attempts === 6) pendingPortraits.delete(target.uniqueId);
        else target.nextRead = Date.now() + 500 * 2 ** (target.attempts - 1);
      }
    }
  }
  function receiveLike(payload, roomId) {
    if (!payload || payload.isDelta === false) return;
    // Shared live-session and owner likeCount are packet deltas. Room-wide
    // totalLikeCount is a snapshot, never a fighter's contribution.
    const likeCount = Number(payload.likeCount ?? payload.like_count ?? payload.count);
    if (!Number.isSafeInteger(likeCount) || likeCount < 1) return;
    const event = supporterEvent('like', payload, roomId);
    if (!event) return;
    addLocalPortrait(event,payload);
    if (onLike({ ...event, likeCount, isDelta: true })?.joined) queueOwnerPortrait(event,payload);
  }
  const session = shared.createLiveSession({ events,
    createConnection: async username => {
      const run = generation, attempt = session.status().attempt;
      const activeAttempt = () => isCurrent(run) && session.status().status === 'connecting'
        && session.status().attempt === attempt;
      const owners = await shared.detectOwner();
      if (!activeAttempt()) throw new Error('Replaced live connection attempt');
      if (owners.length) throw new Error('Existing shared live owner requires its adapter');
      let sdk;
      if (!createConnection) {
        sdk = await import(pathToFileURL(require.resolve(path.join(SHARED_ROOT, 'runtime/node_modules/tiktok-live-connector'))).href);
        if (!activeAttempt()) throw new Error('Replaced live connection attempt');
        Object.assign(events, sdk.WebcastEvent, sdk.ControlEvent);
      }
      const current = createConnection ? await createConnection(username)
        : new sdk.TikTokLiveConnection(username, { processInitialData: false, enableExtendedGiftInfo: false });
      // The shared session retires late factory results. Leave the active
      // socket's raw listener in place if this result belongs to an old attempt.
      if (!activeAttempt()) return current;
      removeRawGift?.();
      connection = current;
      const eventName = events.GIFT || 'gift';
      const listener = (payload, meta) => {
        if (closed || current !== connection || session.status().status !== 'connected'
            || historical(meta) || historical(payload)) return;
        // This raw listener is intentionally before the shared session's final-
        // streak filter. It counts cumulative deltas without a second socket.
        receive(payload, session.status().roomId);
      };
      current.on(eventName, listener);
      removeRawGift = () => current.removeListener(eventName, listener);
      return current;
    },
    onStatus: publish, timers,
    onEvent(type, payload, meta) {
      if (closed || historical(meta) || historical(payload)) return;
      if (type === 'chat') receiveChat(payload, session.status().roomId);
      if (type === 'like') receiveLike(payload, session.status().roomId);
      if (type === 'follow') receiveFollow(payload, session.status().roomId);
      // Gifts still use only the raw listener, before the final-streak filter.
    },
  });

  function retryOwner(username, run, failures, retry) {
    if (!isCurrent(run)) return;
    const delay = OWNER_RETRY_DELAYS_MS[failures];
    if (delay) pollTimer = timers.setTimeout(retry, delay);
    publish({ status: 'error', reason: 'owner-unavailable', username, roomId: '',
      nextRetryAt: delay ? Date.now() + delay : null,
      message: delay ? 'Launcher yayın paylaşımına ulaşılamıyor. Yeniden denenecek.'
        : 'Launcher yayın paylaşımına ulaşılamıyor. Yeniden bağlanmayı deneyin.' });
  }

  async function connectOwner(username, run, failures = 0) {
    if (!isCurrent(run)) return;
    try {
      await shared.requestJSON(owner.url, '/connect', {
        token: owner.token, method: 'POST', body: { username },
      });
    } catch {
      retryOwner(username, run, failures, () => void connectOwner(username, run, failures + 1));
      return;
    }
    void pollOwner(username, run);
  }

  async function pollOwner(username, tokenGeneration, failures = 0) {
    if (!isCurrent(tokenGeneration)) return;
    try {
      const route = owner.kind === 'forza'
        ? `/poll?username=${encodeURIComponent(username)}&after=${ownerCursor}`
        : `/state?after=${ownerCursor}${ownerSession ? '&sessionId=' + encodeURIComponent(ownerSession) : ''}`;
      const data = await shared.requestJSON(owner.url, route, { token: owner.token });
      if (!isCurrent(tokenGeneration)) return;
      if (data.schemaVersion !== 1 || !data.status || !Array.isArray(data.events)) throw new Error('owner-schema');
      if (data.status.username && data.status.username.toLowerCase() !== username) throw new Error('owner-channel');
      if (data.sessionId && data.sessionId !== ownerSession) {
        ownerHistoryDrained = false;
        ownerCursor = 0;
        pendingPortraits.clear();
      }
      ownerSession = data.sessionId || ownerSession;
      publish({ reason: data.status.status, nextRetryAt: null, ...data.status, username, deliveryMode: 'shared-owner-deltas' });
      for (const row of data.events) {
        if (!isCurrent(tokenGeneration)) return;
        if (!Number.isSafeInteger(row?.seq) || row.seq <= ownerCursor) continue;
        if (row.value && ownerHistoryDrained && data.status.status === 'connected'
            && !historical(row) && !historical(row.value)) {
          if (row.value.type === 'gift') receive(row.value, ownerSession || username, true);
          if (row.value.type === 'chat') receiveChat(row.value, ownerSession || username);
          if (row.value.type === 'like') receiveLike(row.value, ownerSession || username);
          if (row.value.type === 'follow') receiveFollow(row.value, ownerSession || username);
          if (row.value.type === 'avatar' && onPortrait) {
            const portrait = forzaPortrait(row.value);
            if (portrait) onPortrait({ uniqueId: row.value.username, portrait });
          }
        }
        if (!isCurrent(tokenGeneration)) return;
        ownerCursor = row.seq;
      }
      if (!isCurrent(tokenGeneration)) return;
      // Both verified owner endpoints page their journal (250 rows, Forza 100).
      // A short connected page establishes the baseline for the next poll.
      if (data.status.status === 'connected' && data.events.length < (owner.kind === 'forza' ? 100 : 250)) ownerHistoryDrained = true;
      for (const target of pendingPortraits.values()) {
        if (portraitReads >= 4) break;
        if (target.nextRead <= Date.now()) void readPortrait(target);
      }
    } catch (error) {
      if (!isCurrent(tokenGeneration)) return;
      if (owner.kind !== 'forza' && error.message === 'owner-http-409') {
        ownerSession = ''; ownerCursor = 0; ownerHistoryDrained = false;
        pendingPortraits.clear();
      }
      retryOwner(username, tokenGeneration, failures, () => void pollOwner(username, tokenGeneration, failures + 1));
      return;
    }
    if (isCurrent(tokenGeneration)) pollTimer = timers.setTimeout(() => void pollOwner(username, tokenGeneration), OWNER_POLL_MS);
  }
  return {
    status: () => ({ ...status }),
    async start(input) {
      if (closed) throw new Error('Live adapter closed');
      const username = String(input || '').trim().replace(/^@/, '').toLowerCase();
      if (!/^[a-z0-9_.]{1,64}$/.test(username)) throw new Error('Geçerli kullanıcı adı gerekli.');
      if (username === status.username && ['connected', 'connecting', 'waiting'].includes(status.status)) return { ...status };
      const run = ++generation;
      timers.clearTimeout(pollTimer); removeRawGift?.(); connection = null;
      session.stop(); ownerCursor = 0; ownerSession = ''; ownerHistoryDrained = false;
      pendingPortraits.clear();
      publish({ status: 'connecting', reason: 'connecting', username, roomId: '', nextRetryAt: null,
        message: 'Yayın bağlantısı aranıyor.' });
      try {
        if (!isCurrent(run)) return { ...status };
        owner = shared.ownerFromEnvironment(env);
        if (owner) {
          if (owner.kind === 'forza') void pollOwner(username, run);
          else await connectOwner(username, run);
        } else {
          const owners = await shared.detectOwner();
          if (!isCurrent(run)) return { ...status };
          if (owners.length) {
            publish({ status: 'error', reason: 'owner-required', username, message: 'Launcher yayını zaten yönetiyor. Paylaşım adaptörü olmadan ikinci bağlantı açılmadı.' });
          } else {
            await session.start(username);
          }
        }
      } catch {
        if (isCurrent(run)) publish({ status: 'error', reason: 'owner-configuration', username,
          message: 'Yayın bağlantısı başlatılamadı. Launcher paylaşım ayarlarını kontrol edin.' });
      }
      return { ...status };
    },
    close() {
      closed = true; generation++; timers.clearTimeout(pollTimer);
      removeRawGift?.(); connection = null; session.close();
      pendingPortraits.clear();
      if (portraitDirectory) fs.rmSync(portraitDirectory, { recursive: true, force: true });
    },
  };
}

module.exports = { createHediyeBoxLive, sharedModules };
