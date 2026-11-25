import {
  applyGift,
  advanceWinner,
  createDuelState,
  normalizeUsername,
  pauseRound,
  publicSnapshot,
  resetRound,
  setOpponent,
  setGiftConfig,
  setOwner,
  selectPlayer,
  startRound,
  tick,
} from './core.mjs';

function giftIds(event) {
  const eventId = String(event?.eventId ?? event?.id ?? event?.msgId ?? event?.common?.msgId ?? '').trim();
  const ids = eventId && eventId.length <= 200 ? [eventId] : [];
  if (!ids.length && Number(event?.giftType) === 1 && [true,1,'1','true'].includes(event?.repeatEnd) && event?.groupId) {
    const group = 'combo:'+JSON.stringify([event.username||event.user?.uniqueId,event.giftId,String(event.groupId)]);
    if(group.length<=200)ids.push(group);
  }
  return ids;
}

function giftProfile(event) {
  const raw = event?.profile ?? event?.user ?? event;
  const username = normalizeUsername(raw?.username ?? raw?.uniqueId ?? raw?.displayId ?? event?.username);
  if (!username) return null;
  return {
    username,
    nickname: raw?.nickname ?? raw?.nickName ?? event?.nickname ?? username,
    avatarUrl: raw?.avatarUrl || raw?.avatarLarger || raw?.avatarLarge || raw?.profilePictureUrl
      || raw?.profilePicture || raw?.avatar || event?.avatarUrl || event?.avatar || '',
  };
}

export function mergeProfile(previous, next) {
  const username = next.username;
  const avatar = next.avatarUrl;
  // The launcher emits v=0 before the shared cache has any image bytes.
  const pending = /^(?:\.?\/)api\/portrait\?(?:[^#]*&)?v=0(?:[&#]|$)/.test(avatar || '');
  return {
    ...previous, ...next,
    nickname: next.nickname && next.nickname !== username ? next.nickname : previous?.nickname || username,
    avatarUrl: avatar && (!pending || !previous?.avatarUrl) ? avatar : previous?.avatarUrl || '',
  };
}

function readSharedProfile(getProfile, username, fallback) {
  try {
    const cached = getProfile?.(username);
    if (cached && typeof cached === 'object') return mergeProfile(fallback, { ...cached, username });
  } catch {}
  return fallback;
}

/**
 * Adapts the launcher's already-owned live session and portrait cache to this game.
 * `subscribe` must attach to the shared event feed; this module never opens a connection.
 */
export function createProfileDuelController({
  channel,
  subscribe,
  getProfile,
  giftConfig,
  processedEventIds,
  onChange = () => {},
  now = Date.now,
} = {}) {
  const ownerUsername = normalizeUsername(channel);
  if (!ownerUsername) throw new TypeError('A normalized TikTok channel owner is required.');
  if (typeof subscribe !== 'function') throw new TypeError('A shared-session event subscription is required.');

  let state = createDuelState({ owner: { username: ownerUsername }, giftConfig, processedEventIds });
  let closed = false;
  let lastProfileRefresh = 0;
  const listeners = new Set();
  const receipts = { gifts:0, accepted:0, lastReason:'' };
  const participants = new Map([[ownerUsername, { username: ownerUsername }]]);
  const notify = () => {
    if (closed) return;
    const snapshot = publicSnapshot(state, now());
    for (const listener of listeners) listener(snapshot);
    onChange(snapshot);
  };

  const owner = readSharedProfile(getProfile, ownerUsername, { username: ownerUsername });
  setOwner(state, owner);

  function updateObservedProfile(profile) {
    if (!profile) return;
    const selected = [state.owner, state.opponent].find(player => player?.username === profile.username);
    if (!selected) return;
    const cached = readSharedProfile(getProfile, profile.username, mergeProfile(selected, profile));
    if (selected === state.owner) setOwner(state, cached);
    else setOpponent(state, cached);
  }

  function receive(typeOrEvent, maybeEvent) {
    if (closed) return { ok: false, reason: 'Denetleyici kapalı.' };
    const type = typeof typeOrEvent === 'string' ? typeOrEvent : typeOrEvent?.type;
    const event = typeof typeOrEvent === 'string' ? maybeEvent : typeOrEvent;
    const profile = giftProfile(event);
    if (profile && ['chat', 'like', 'gift'].includes(type)) {
      const old = participants.get(profile.username) || {};
      participants.set(profile.username, { ...mergeProfile(old, profile),
        commented: old.commented || type === 'chat',
        totalLikes: (old.totalLikes || 0) + (type === 'like' ? Math.max(1, Number(event.likeCount || event.count) || 1) : 0),
        coins: (old.coins || 0) + (type === 'gift' ? Math.max(0, Number(event.coins) || 0) : 0) });
      while (participants.size > 5000) participants.delete(participants.keys().next().value);
    }
    updateObservedProfile(profile);
    if (type !== 'gift') {
      notify();
      return { ok: false, reason: 'Hediye dışı olay.' };
    }

    const eventIds = giftIds(event);
    receipts.gifts++;
    if (!eventIds.length) { receipts.lastReason='Hediye olay kimliği alınamadı.'; return { ok: false, reason: receipts.lastReason }; }
    const result = applyGift(state, { ...event, eventIds }, now());
    if(result.ok)receipts.accepted++;receipts.lastReason=result.ok?'Puan eklendi.':result.reason;
    if (result.ok || result.reason === 'Tur etkin değil.') notify();
    return result;
  }

  const unsubscribe = subscribe(receive);
  return {
    snapshot: () => publicSnapshot(state, now()),
    diagnostics: () => ({...receipts}),
    participants: () => [...participants.values()],
    choosePlayer(side, profile) {
      const username = normalizeUsername(profile?.username);
      const cached = profile == null ? null : readSharedProfile(getProfile, username, mergeProfile(participants.get(username), { ...profile, username }));
      const result = selectPlayer(state, side, cached);
      if (result) notify();
      return result;
    },
    choosePlayers(left, right) {
      if (state.phase !== 'idle') return false;
      const l = normalizeUsername(left?.username), r = normalizeUsername(right?.username);
      if (!l || !r || l === r) return false;
      setOwner(state, readSharedProfile(getProfile, l, left));
      const result = setOpponent(state, readSharedProfile(getProfile, r, right));
      if (result) notify();
      return result;
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('A snapshot listener is required.');
      listeners.add(listener);
      listener(publicSnapshot(state, now()));
      return () => listeners.delete(listener);
    },
    updateOwnerProfile(profile) {
      if (normalizeUsername(profile?.username ?? profile?.uniqueId ?? profile?.id) !== state.owner?.username) return false;
      const cached = readSharedProfile(getProfile, state.owner.username, profile);
      const result = setOwner(state, cached);
      if (result) notify();
      return result;
    },
    chooseOpponent(profile) {
      const cached = readSharedProfile(getProfile, normalizeUsername(profile?.username ?? profile?.id), profile);
      const result = setOpponent(state, cached);
      if (result) notify();
      return result;
    },
    configureGifts(config) {
      const result = setGiftConfig(state, config);
      if (result) notify();
      return result;
    },
    start(durationSeconds) {
      const result = startRound(state, { durationSeconds, now: now() });
      if (result.ok) notify();
      return result;
    },
    pause() {
      const result = pauseRound(state, now());
      if (result) notify();
      return result;
    },
    reset() {
      resetRound(state);
      notify();
    },
    nextRound() {
      const result = advanceWinner(state);
      if (result) notify();
      return result;
    },
    tick() {
      const ended = tick(state, now());
      let refreshed = false;
      if(now()-lastProfileRefresh>=1000){
        lastProfileRefresh=now();
        for(const profile of [state.owner,state.opponent].filter(Boolean)){
          const cached=readSharedProfile(getProfile,profile.username,profile);
          if(cached.avatarUrl!==profile.avatarUrl||cached.nickname!==profile.nickname){
            if(profile===state.owner)setOwner(state,cached);else setOpponent(state,cached);refreshed=true;
          }
        }
      }
      if (ended || refreshed) notify();
      return ended;
    },
    close() {
      if (closed) return;
      closed = true;
      if (typeof unsubscribe === 'function') unsubscribe();
      listeners.clear();
    },
  };
}
