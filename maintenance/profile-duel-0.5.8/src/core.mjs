const DEFAULT_GIFT_CONFIG = {
  roseGiftIds: ['5655'],
  roseGiftNames: ['rose', 'gül'],
  tiktokGiftIds: ['5269'],
  tiktokGiftNames: ['tiktok'],
};

function giftIdOf(gift) {
  return String(gift?.giftId ?? gift?.gift_id ?? gift?.gift?.id ?? gift?.gift?.giftId
    ?? gift?.extendedGiftInfo?.id ?? gift?.extendedGiftInfo?.giftId ?? '');
}

function giftNameOf(gift) {
  return String(gift?.giftName ?? gift?.name ?? gift?.gift?.name
    ?? gift?.extendedGiftInfo?.name ?? 'Hediye');
}

export function normalizeUsername(value) {
  return String(value ?? '').trim().replace(/^@/, '').toLowerCase().slice(0, 64);
}

function cleanProfile(profile) {
  const username = normalizeUsername(profile?.username ?? profile?.uniqueId ?? profile?.id);
  if (!username) return null;
  return {
    username,
    nickname: String(profile?.nickname ?? profile?.displayName ?? username).trim().slice(0, 80) || username,
    avatarUrl: safeAvatar(profile?.avatarUrl ?? profile?.avatar ?? profile?.image),
  };
}

function safeAvatar(value) {
  if (typeof value !== 'string' || value.length > 4096) return '';
  if (value.startsWith('/') || value.startsWith('./')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function idList(value) {
  return [...new Set((Array.isArray(value) ? value : [value])
    .map(id => String(id ?? '').trim()).filter(id => id.length > 0 && id.length <= 200))];
}

export function normalizePointsPerGift(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function normalizeGiftConfig(config = {}) {
  const clean = (values, fallback) => [...new Set((Array.isArray(values) ? values : fallback)
    .map(value => String(value ?? '').trim()).filter(value => value.length > 0 && value.length <= 100))];
  return {
    roseGiftIds: clean(config.roseGiftIds, DEFAULT_GIFT_CONFIG.roseGiftIds),
    roseGiftNames: clean(config.roseGiftNames, DEFAULT_GIFT_CONFIG.roseGiftNames),
    tiktokGiftIds: clean(config.tiktokGiftIds, DEFAULT_GIFT_CONFIG.tiktokGiftIds),
    tiktokGiftNames: clean(config.tiktokGiftNames, DEFAULT_GIFT_CONFIG.tiktokGiftNames),
    roseGiftLabel: String(config.roseGiftLabel || 'Gül').trim().slice(0, 40) || 'Gül',
    tiktokGiftLabel: String(config.tiktokGiftLabel || 'TikTok').trim().slice(0, 40) || 'TikTok',
    roseGiftImage: safeAvatar(config.roseGiftImage || ''),
    tiktokGiftImage: safeAvatar(config.tiktokGiftImage || ''),
    roseUnitCoins: Math.max(1, Number(config.roseUnitCoins) || 1),
    tiktokUnitCoins: Math.max(1, Number(config.tiktokUnitCoins) || 1),
    rosePointsPerGift: normalizePointsPerGift(config.rosePointsPerGift),
    tiktokPointsPerGift: normalizePointsPerGift(config.tiktokPointsPerGift),
  };
}

function normalizedGiftName(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('tr-TR').trim();
}

function giftSide(gift, config) {
  const id = giftIdOf(gift);
  const name = normalizedGiftName(giftNameOf(gift));
  if (config.roseGiftIds.includes(id) || config.roseGiftNames.some(value => name === normalizedGiftName(value))) return 'left';
  if (config.tiktokGiftIds.includes(id) || config.tiktokGiftNames.some(value => name === normalizedGiftName(value))) return 'right';
  return null;
}

function giftPoints(gift, catalogUnit, pointsPerGift) {
  const rawCount = gift?.repeatCount ?? gift?.count ?? 1;
  if (pointsPerGift != null) {
    const count = Number(rawCount);
    const quantity = Math.max(1, Number.isFinite(count) ? Math.floor(count) : 1);
    return Math.min(Number.MAX_SAFE_INTEGER, pointsPerGift * quantity);
  }

  const rawTotal = gift?.coins ?? gift?.totalCoins ?? gift?.valueCoins;
  if (rawTotal != null && Number(rawTotal) !== 0) {
    const explicit = Number(rawTotal);
    return Number.isFinite(explicit) && explicit > 0
      ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(explicit)) : 0;
  }
  const rawUnitValue = gift?.coinValue ?? gift?.diamondCount ?? gift?.diamond_count ?? gift?.gift?.diamondCount;
  const unitValue = Number(rawUnitValue) || catalogUnit;
  const count = Number(rawCount);
  const total = Math.floor(Math.max(0, Number.isFinite(unitValue) ? unitValue : 0)
    * Math.max(1, Number.isFinite(count) ? count : 1));
  return Math.min(Number.MAX_SAFE_INTEGER, total);
}

export function isCompletedGift(gift) {
  const type = Number(gift?.giftType ?? gift?.gift?.type ?? gift?.gift?.giftType
    ?? gift?.extendedGiftInfo?.giftType ?? gift?.extendedGiftInfo?.type);
  if (type === 0) return true;
  const completion = gift?.completed ?? gift?.repeatEnd;
  if (type !== 1 && completion == null) return true;
  return [true, 1, '1', 'true'].includes(completion);
}

export function createDuelState({ owner, opponent = null, durationSeconds = 120, giftConfig, processedEventIds = new Set() } = {}) {
  const left = cleanProfile(owner);
  return {
    schema: 1,
    phase: 'idle',
    owner: left,
    opponent: cleanProfile(opponent),
    durationSeconds: boundedSeconds(durationSeconds),
    startedAt: null,
    endsAt: null,
    remainingMs: boundedSeconds(durationSeconds) * 1000,
    scores: { left: 0, right: 0 },
    giftConfig: normalizeGiftConfig(giftConfig),
    lastResult: null,
    processedEventIds,
    activity: [],
    revision: 0,
  };
}

function boundedSeconds(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(10, Math.min(3600, Math.trunc(seconds))) : 120;
}

export function setOwner(state, profile) {
  const owner = cleanProfile(profile);
  if (!owner) return false;
  state.owner = owner;
  if (state.opponent?.username === owner.username) state.opponent = null;
  state.revision++;
  return true;
}

export function selectPlayer(state, side, profile) {
  if (!['idle','finished'].includes(state.phase) || !['left', 'right'].includes(side)) return false;
  const selected = profile == null ? null : cleanProfile(profile);
  if (profile != null && !selected) return false;
  const other = side === 'left' ? state.opponent : state.owner;
  if (selected && selected.username === other?.username) return false;
  if (state.phase === 'finished') resetRound(state);
  state[side === 'left' ? 'owner' : 'opponent'] = selected;
  state.revision++;
  return true;
}

export function setOpponent(state, profile) {
  const opponent = cleanProfile(profile);
  if (!opponent || opponent.username === state.owner?.username || (state.phase !== 'idle' && opponent.username !== state.opponent?.username)) return false;
  state.opponent = opponent;
  state.revision++;
  return true;
}

export function setGiftConfig(state, config) {
  if (state.phase === 'running') return false;
  state.giftConfig = normalizeGiftConfig(config);
  state.revision++;
  return true;
}

export function startRound(state, { durationSeconds = state.durationSeconds, now = Date.now() } = {}) {
  if (!state.owner || !state.opponent) return { ok: false, reason: 'Yayıncı ve rakip profili seçilmelidir.' };
  if (state.phase === 'running') return { ok: false, reason: 'Tur zaten devam ediyor.' };
  state.durationSeconds = boundedSeconds(durationSeconds);
  state.scores = { left: 0, right: 0 };
  state.lastResult = null;
  state.activity = [];
  state.startedAt = now;
  state.endsAt = now + state.durationSeconds * 1000;
  state.remainingMs = state.durationSeconds * 1000;
  state.phase = 'running';
  state.revision++;
  return { ok: true };
}

export function pauseRound(state, now = Date.now()) {
  if (state.phase === 'running') {
    state.remainingMs = Math.max(0, state.endsAt - now);
    state.endsAt = null;
    state.phase = 'paused';
  } else if (state.phase === 'paused') {
    state.endsAt = now + state.remainingMs;
    state.phase = 'running';
  } else {
    return false;
  }
  state.revision++;
  return true;
}

export function resetRound(state) {
  state.phase = 'idle';
  state.startedAt = null;
  state.endsAt = null;
  state.remainingMs = state.durationSeconds * 1000;
  state.scores = { left: 0, right: 0 };
  state.lastResult = null;
  state.activity = [];
  state.revision++;
}

export function remainingMs(state, now = Date.now()) {
  return state.phase === 'running' ? Math.max(0, state.endsAt - now) : state.remainingMs;
}

export function tick(state, now = Date.now()) {
  if (state.phase !== 'running') return false;
  state.remainingMs = Math.max(0, state.endsAt - now);
  if (state.remainingMs > 0) return false;
  state.phase = 'finished';
  state.endsAt = null;
  const winnerSide = state.scores.left === state.scores.right ? null
    : state.scores.left > state.scores.right ? 'left' : 'right';
  const winner = winnerSide === 'left' ? state.owner : winnerSide === 'right' ? state.opponent : null;
  const loser = winnerSide === 'left' ? state.opponent : winnerSide === 'right' ? state.owner : null;
  state.lastResult = { winnerSide, winner, loser, scores: { ...state.scores }, endedAt: now };
  if (winnerSide === 'left') state.opponent = null;
  if (winnerSide === 'right') state.owner = null;
  state.revision++;
  return true;
}

export function advanceWinner(state) {
  if (state.phase !== 'finished' || !state.lastResult) return false;
  state.phase = 'idle';
  state.startedAt = null;
  state.endsAt = null;
  state.remainingMs = state.durationSeconds * 1000;
  state.scores = { left: 0, right: 0 };
  state.activity = [];
  state.revision++;
  return true;
}

export function applyGift(state, gift, now = Date.now()) {
  tick(state, now);
  if (state.phase !== 'running') return { ok: false, reason: 'Tur etkin değil.' };
  if (!isCompletedGift(gift)) return { ok: false, reason: 'Hediye serisi henüz tamamlanmadı.' };

  const eventIds = idList(gift.eventIds ?? gift.eventId ?? gift.id);
  if (!eventIds.length) return { ok: false, reason: 'Tekil hediye olay kimliği yok.' };
  if (eventIds.some(id => state.processedEventIds.has(id))) return { ok: false, duplicate: true, reason: 'Olay zaten işlendi.' };

  const side = giftSide(gift, state.giftConfig);
  if (!side) return { ok: false, reason: 'Yalnızca seçili hediyeler puanlanır.' };
  const { roseUnitCoins, tiktokUnitCoins, rosePointsPerGift, tiktokPointsPerGift } = state.giftConfig;
  const points = side === 'left' ? giftPoints(gift, roseUnitCoins, rosePointsPerGift)
    : giftPoints(gift, tiktokUnitCoins, tiktokPointsPerGift);
  if (!points) return { ok: false, reason: 'Hediye coin değeri alınamadı.' };
  state.scores[side] = Math.min(Number.MAX_SAFE_INTEGER, state.scores[side] + points);
  for (const id of eventIds) state.processedEventIds.add(id);
  const entry = {
    side,
    eventId: eventIds[0],
    giftId: giftIdOf(gift),
    giftName: giftNameOf(gift).slice(0, 80),
    giftImage: safeAvatar(gift?.giftImage ?? gift?.image ?? ''),
    points,
    at: now,
  };
  state.activity.unshift(entry);
  state.activity.length = Math.min(state.activity.length, 12);
  state.revision++;
  return { ok: true, ...entry };
}

export function publicSnapshot(state, now = Date.now()) {
  return {
    schema: state.schema,
    phase: state.phase,
    owner: state.owner,
    opponent: state.opponent,
    durationSeconds: state.durationSeconds,
    remainingMs: remainingMs(state, now),
    scores: { ...state.scores },
    lastResult: state.lastResult ? { ...state.lastResult, scores: { ...state.lastResult.scores } } : null,
    giftConfig: { ...state.giftConfig },
    activity: state.activity.slice(),
    revision: state.revision,
    time: now,
  };
}
