'use strict';

const catalog = require('../assets/gift-catalog.json');
const COINS = new Map(catalog.map(gift => [String(gift.id), gift.coins]));
const DEFAULT_SETTINGS = Object.freeze({
  participationMode: 'chat', participationGiftId: '5655', punchGiftId: '', chatPunches: false,
  punchGiftIdLeft: '5655', punchGiftIdRight: '5269',
  punchSource: 'gift', likeThreshold: 100, likePunchCount: 2, followJoin: false, likeJoin: false, likeJoinThreshold: 1,
  chatDamage:15, likeDamage:15, giftDamage:Object.freeze({}),
});
const text = value => typeof value === 'string' ? value.trim() : '';
const id = value => typeof value === 'string' ? value.trim()
  : typeof value === 'bigint' || Number.isSafeInteger(value) ? String(value) : '';
const handle = value => text(value).replace(/^@/, '').toLowerCase();
function validDamage(value) {
  if (!Number.isInteger(value)||value<1||value>100) throw new RangeError('Hasar 1 ile 100 arasında bir tam sayı olmalı.');
  return value;
}
// The live adapter puts the handle in id when it has no account ID.
function accountId(event) {
  const supplied = id(event.id);
  return id(event.userId) || (handle(supplied) === handle(event.uniqueId) ? '' : supplied);
}
const result = (accepted, extra = {}) => ({ accepted, joined: false, delta: 0, addedCoins: 0, actions: [], ...extra });
const cornerGift = (settings, side) =>
  (side === 'left' ? settings.punchGiftIdLeft : settings.punchGiftIdRight) || settings.punchGiftId;

function restoreKingGifts(next, saved) {
  const { punchGiftIdLeft: blue, punchGiftIdRight: red } = DEFAULT_SETTINGS;
  // The original desktop version saved its common selection alongside the
  // two factory IDs. Keep that selection on one corner when opening the save.
  if (next.punchGiftId && saved.punchSource === undefined) {
    if (!saved.punchGiftIdLeft && saved.punchGiftIdRight) next.punchGiftIdLeft = next.punchGiftId;
    else if (!saved.punchGiftIdRight && saved.punchGiftIdLeft) next.punchGiftIdRight = next.punchGiftId;
    else if ((!next.punchGiftIdLeft || next.punchGiftIdLeft === blue)
        && (!next.punchGiftIdRight || next.punchGiftIdRight === red)) {
      next.punchGiftIdLeft = next.punchGiftId === red ? blue : next.punchGiftId;
      next.punchGiftIdRight = red;
      next.punchGiftId = '';
    }
  }
  const shared = cornerGift(next, 'left');
  if (!shared || shared !== cornerGift(next, 'right')) return;
  // Keep an explicitly assigned side if only one was saved. For two equal
  // selections keep the usual red gift on red, otherwise keep the ID on blue.
  const keepRight = id(saved.punchGiftIdRight) === shared
    && (id(saved.punchGiftIdLeft) !== shared || shared === red);
  if (keepRight) next.punchGiftIdLeft = shared === blue ? red : blue;
  else next.punchGiftIdRight = shared === red ? blue : red;
}

class BoundedLru {
  #entries = new Map();
  constructor(capacity) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new RangeError('Cache size must be a positive safe integer');
    this.capacity = capacity;
  }
  get(key) {
    if (!this.#entries.has(key)) return undefined;
    const value = this.#entries.get(key);
    this.#entries.delete(key); this.#entries.set(key, value);
    return value;
  }
  set(key, value) {
    this.#entries.delete(key); this.#entries.set(key, value);
    if (this.#entries.size > this.capacity) this.#entries.delete(this.#entries.keys().next().value);
  }
  delete(key) { this.#entries.delete(key); }
  clear() { this.#entries.clear(); }
}

/**
 * Audience selection only; no native controls, timers, storage or connections.
 * Initially joins occupy right then left. P calls startRound(), selecting the
 * highest live coin totals across staged users AND the queue, then locking that
 * pair. Ties use joinOrder ASC. Later joins queue by the same order. Finishing
 * retains the result pair; only explicit startRound/resetRound picks successors.
 * A round requires two people. Departed fighters must join again to re-enter.
 * Likes and the side's selected gift (A, count=delta) act only during
 * an active round and only for its fighters. onPunch(action) is optional; the
 * same actions are returned by ingest, so hosts should use ONE delivery path.
 * coinUnit is per gift, repeatCount cumulative when streakId is present unless
 * isDelta=true. Test gifts never join/rank. Missing coinUnit uses the catalog.
 * Event IDs and streak high-water marks survive round/settings changes in
 * bounded LRU caches (4096 each by default). Replays beyond BOTH retention
 * windows cannot be recognized; size these caches for upstream replay history.
 *
 * Opt-in kingOfRing: right/red then left/blue stay in their assigned corners;
 * coins order only waiting users filling vacancies. startRound pins that pair.
 * finishRound('left'|'right'|null) retains the winner in the same corner, removes
 * the loser (both on a draw), fills vacancies and stages the next manual start.
 * Repeated finish calls while staging do nothing. resetRound restages the same
 * pair in this mode, preserving a winner through a native ring reset.
 * The join command, qualifying gifts and enabled follow/like entry can join.
 * Comments never punch. Old chat/both sources migrate to gift; all enables
 * gifts and likes. Gifts must match the fighter's corner selection.
 * Side IDs override an old common ID.
 * punchSource='like' uses ingestLike({id,eventId,likeCount,isDelta:true,...});
 * Only active fighters earn likePunchCount punches per likeThreshold in like or all mode.
 * Saved thresholds and punch counts override new-install defaults.
 * Remainders belong to the fighter and round.
 * Follow/like entry is opt-in. Like entry has its own bounded per-user counter,
 * cleared on entry or entry-setting changes, separate from fight remainders.
 * Initial/cumulative likes never join or punch. In kingOfRing each 100 personal
 * likes adds one queue FPS and the first real follow adds five, independently
 * of the configurable punch/entry thresholds. Gift coin totals remain separate.
 */
class AudienceQueue {
  #settings;
  #events;
  #streaks;
  #users = new Map();
  #accounts = new Map();
  #handles = new Map();
  #active = { left: null, right: null };
  #waiting = new Set();
  #phase = 'staging';
  #round = 0;
  #joinOrder = 0;
  #initial = true;
  #onPunch;
  #kingOfRing;
  #likes = new Map();
  #joinLikes;
  #rankLikes;
  #played = new Map();

  constructor({ settings = {}, onPunch, kingOfRing = false, eventCacheSize = 4096, streakCacheSize = 4096 } = {}) {
    if (onPunch !== undefined && typeof onPunch !== 'function') throw new TypeError('onPunch must be a function');
    if (typeof kingOfRing !== 'boolean') throw new TypeError('kingOfRing must be boolean');
    this.#kingOfRing = kingOfRing;
    this.#onPunch = onPunch;
    this.#events = new BoundedLru(eventCacheSize);
    this.#streaks = new BoundedLru(streakCacheSize);
    this.#joinLikes = new BoundedLru(eventCacheSize);
    this.#rankLikes = new BoundedLru(eventCacheSize);
    this.#settings = { ...DEFAULT_SETTINGS };
    if (kingOfRing) this.#settings.participationMode = 'both';
    this.#applySettings(settings, true);
  }

  configure(patch = {}) {
    return this.#applySettings(patch, false);
  }

  #applySettings(patch, restoring) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Settings must be an object');
    const next = { ...this.#settings };
    for(const key of ['chatDamage','likeDamage']){
      if(patch[key]!==undefined)next[key]=validDamage(patch[key]);
    }
    if(patch.giftDamage!==undefined){
      if(!patch.giftDamage||typeof patch.giftDamage!=='object'||Array.isArray(patch.giftDamage))throw new Error('Geçersiz hediye hasarları.');
      next.giftDamage={...next.giftDamage};
      for(const [gift,value] of Object.entries(patch.giftDamage)){
        if(!COINS.has(gift))throw new Error('Hasar için geçerli bir katalog hediyesi seçin.');
        next.giftDamage[gift]=validDamage(value);
      }
    }
    if (patch.participationMode !== undefined) {
      if (!['both', 'chat', 'gift'].includes(patch.participationMode)) throw new RangeError('participationMode must be both, chat or gift');
      next.participationMode = patch.participationMode;
    }
    if (patch.chatPunches !== undefined) {
      if (typeof patch.chatPunches !== 'boolean') throw new TypeError('chatPunches must be boolean');
      next.chatPunches = false;
    }
    for (const key of ['followJoin','likeJoin']) {
      if (patch[key] === undefined) continue;
      if (typeof patch[key] !== 'boolean') throw new TypeError(key+' must be boolean');
      next[key] = patch[key];
    }
    if (patch.punchSource !== undefined) {
      if (!['gift', 'like', 'chat', 'both', 'all'].includes(patch.punchSource)) throw new RangeError('Geçersiz yumruk kaynağı.');
      // Restore old saves and tolerate stale clients without reviving chat punches.
      next.punchSource = ['chat', 'both'].includes(patch.punchSource) ? 'gift' : patch.punchSource;
    }
    for (const key of ['likeJoinThreshold', 'likeThreshold']) {
      if (patch[key] === undefined) continue;
      if (!Number.isSafeInteger(patch[key]) || patch[key] < 1) throw new RangeError(key + ' must be a positive safe integer');
      next[key] = patch[key];
    }
    if (patch.likePunchCount !== undefined) {
      if (!Number.isInteger(patch.likePunchCount) || patch.likePunchCount < 1 || patch.likePunchCount > 100) {
        throw new RangeError('Eşik başına yumruk sayısı 1 ile 100 arasında olmalı.');
      }
      next.likePunchCount = patch.likePunchCount;
    }
    for (const key of ['participationGiftId', 'punchGiftId', 'punchGiftIdLeft', 'punchGiftIdRight']) {
      if (patch[key] === undefined) continue;
      const value = id(patch[key]);
      if (!value && patch[key] !== '' && patch[key] !== null) throw new TypeError(`${key} must be a gift ID or empty`);
      next[key] = value;
    }
    if (this.#kingOfRing) {
      if (restoring) restoreKingGifts(next, patch);
      const leftGift = cornerGift(next, 'left');
      if (leftGift && leftGift === cornerGift(next, 'right')) {
        throw new RangeError('İki köşe için aynı yumruk hediyesi seçilemez. Her köşe için farklı bir hediye seçin.');
      }
    }
    if (next.punchSource !== this.#settings.punchSource || next.likeThreshold !== this.#settings.likeThreshold
        || next.likePunchCount !== this.#settings.likePunchCount) this.#likes.clear();
    if (next.likeJoin !== this.#settings.likeJoin || next.likeJoinThreshold !== this.#settings.likeJoinThreshold) this.#joinLikes.clear();
    this.#settings = next;
    return this.snapshot();
  }

  // Keep roster slots, streaks and like remainders on the same internal key
  // when a later packet supplies the account ID for a handle-only sender.
  #identity(event) {
    const account = accountId(event);
    const byAccount = this.#accounts.get(account);
    if (byAccount !== undefined) return byAccount;
    const byHandle = this.#handles.get(handle(event.uniqueId));
    if (byHandle !== undefined && (!account || !this.#users.get(byHandle).userId)) return byHandle;
    return this.#users.size + 1;
  }

  #check(event) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) return 'invalid-event';
    if (!id(event.eventId)) return 'missing-event-id';
    if (!accountId(event) && !handle(event.uniqueId)) return 'missing-sender';
    if (this.#events.get(id(event.eventId))) return 'duplicate-event';
    const initial = event.initial === true || event.isInitial === true;
    if (initial || event.replay === true || event.isReplay === true) {
      this.#events.set(id(event.eventId), true);
      return initial ? 'initial-event' : 'replay-event';
    }
    return '';
  }

  #user(event, key) {
    const previous = this.#users.get(key);
    const userId = accountId(event) || previous?.userId || '';
    const uniqueId = handle(event.uniqueId) || previous?.uniqueId || '';
    if (userId) this.#accounts.set(userId, key);
    if (uniqueId && handle(event.uniqueId)) {
      if (previous?.uniqueId !== uniqueId && this.#handles.get(previous?.uniqueId) === key) {
        this.#handles.delete(previous.uniqueId);
      }
      this.#handles.set(uniqueId, key);
    }
    const urls = Array.isArray(event.profilePictureUrls)
      ? event.profilePictureUrls.map(text).filter(Boolean) : [];
    const portrait = text(event.portrait) || text(event.profilePictureUrl) || urls[0] || previous?.portrait || '';
    const user = {
      id: userId || uniqueId, userId, uniqueId,
      nickname: text(event.nickname) || previous?.nickname || uniqueId || userId,
      portrait, profilePictureUrl: portrait,
      profilePictureUrls: [...new Set([portrait, ...urls, ...(previous?.profilePictureUrls || [])].filter(Boolean))].slice(0,8),
      coins: previous?.coins || 0, likeFps:previous?.likeFps||0, followFps:previous?.followFps||0,
      joinOrder: previous?.joinOrder ?? null,
    };
    this.#users.set(key, user);
    return user;
  }

  #join(key) {
    if (this.#waiting.has(key) || this.#fighterSide(key)) return false;
    this.#joinLikes.delete(key);
    this.#users.get(key).joinOrder = ++this.#joinOrder;
    if (this.#kingOfRing) {
      this.#waiting.add(key);
      if (this.#phase === 'staging') this.#select();
      return true;
    }
    const side = this.#initial && this.#phase === 'staging'
      ? ['right', 'left'].find(candidate => this.#active[candidate] === null) : null;
    if (side) this.#active[side] = key;
    else this.#waiting.add(key);
    return true;
  }

  updatePortrait(event) {
    if (!text(event?.portrait)) return false;
    const key=this.#identity(event), previous=this.#users.get(key);
    if (!previous || previous.portrait===event.portrait) return false;
    this.#user(event,key);
    return true;
  }

  #fighterSide(userId) {
    return ['right', 'left'].find(side => this.#active[side] === userId);
  }

  lineup() {
    return [this.#active.left !== null, this.#active.right !== null];
  }

  #giftSide(key, giftId) {
    const side = this.#fighterSide(key);
    if (!side) return;
    if (this.#kingOfRing) {
      if (['gift','both','all'].includes(this.#settings.punchSource) && cornerGift(this.#settings, side) === giftId) return side;
      return;
    }
    if ((this.#settings.punchGiftId || cornerGift(this.#settings, side)) === giftId) return side;
  }

  #punch(side, user, event, action, count, source) {
    if (!side || this.#phase !== 'active' || count < 1) return [];
    const command={ type: 'punch', side, action, count, userId: user.id, eventId: id(event.eventId), source };
    if(this.#kingOfRing){
      command.damage=source==='gift'?(this.#settings.giftDamage[id(event.giftId)]??15)
        :this.#settings.likeDamage;
    }
    return [command];
  }

  #deliver(value) {
    for (const action of value.actions) this.#onPunch?.({ ...action });
    return value;
  }

  ingestFollow(event) {
    const reason = this.#check(event);
    if (reason) return result(false, { reason });
    this.#events.set(id(event.eventId), true);
    if (event.isTest === true) return result(true);
    const key = this.#identity(event);
    if (!this.#settings.followJoin && !this.#fighterSide(key) && !this.#waiting.has(key)) return result(true);
    const previous = this.#users.get(key);
    const user = this.#user(event, key);
    const addedFps=this.#kingOfRing&&!user.followFps?5:0;
    user.followFps+=addedFps;
    const joined = this.#settings.followJoin && this.#join(key);
    return result(true, { joined, addedFps, rosterChanged: addedFps>0 || previous?.id !== user.id
      || previous?.uniqueId !== user.uniqueId || previous?.nickname !== user.nickname || previous?.portrait !== user.portrait });
  }

  ingestChat(event) {
    const reason = this.#check(event);
    if (reason) return result(false, { reason });
    if (typeof event.comment !== 'string') return result(false, { reason: 'invalid-comment' });
    const comment = event.comment.trim().normalize('NFKC');
    this.#events.set(id(event.eventId), true);
    const key = this.#identity(event);
    const joinCommand = this.#settings.participationMode !== 'gift'
      && comment.toLocaleLowerCase('tr-TR').replaceAll('ı', 'i') === 'katil';
    if (this.#kingOfRing && !joinCommand && !this.#users.has(key)) return result(true);
    const previous = this.#users.get(key);
    const user = this.#user(event, key);
    const joined = joinCommand && event.isTest !== true && this.#join(key);
    return result(true, { joined, rosterChanged: previous?.portrait !== user.portrait || previous?.nickname !== user.nickname });
  }

  ingestGift(event) {
    const reason = this.#check(event);
    if (reason) return result(false, { reason });
    const giftId = id(event.giftId);
    if (!giftId) return result(false, { reason: 'missing-gift-id' });
    const count = Number(event.repeatCount ?? event.count ?? 1);
    if (!Number.isSafeInteger(count) || count < 1) return result(false, { reason: 'invalid-repeat-count' });
    const streakId = id(event.streakId);
    if (!event.isDelta && Number(event.giftType) === 1 && !streakId) return result(false, { reason: 'missing-streak-id' });
    const unit = Number(event.coinUnit ?? event.coinValue ?? event.diamondCount ?? COINS.get(giftId) ?? 0);
    if (!Number.isSafeInteger(unit) || unit < 0) return result(false, { reason: 'invalid-coin-unit' });
    const key = this.#identity(event);
    const streakKey = !event.isDelta && streakId ? JSON.stringify([key, giftId, event.isTest === true, streakId]) : null;
    const previous = streakKey ? this.#streaks.get(streakKey) || 0 : 0;
    const delta = Math.max(0, count - previous);
    const addedCoins = event.isTest === true ? 0 : unit * delta;
    if (!Number.isSafeInteger(addedCoins) || !Number.isSafeInteger((this.#users.get(key)?.coins || 0) + addedCoins)) {
      return result(false, { reason: 'coin-overflow' });
    }
    this.#events.set(id(event.eventId), true);
    if (streakKey) this.#streaks.set(streakKey, Math.max(previous, count));
    if (this.#kingOfRing && event.isTest === true) return result(true, { delta });
    const user = this.#user(event, key);
    user.coins += addedCoins;
    const { participationMode, participationGiftId } = this.#settings;
    const joinsByGift = participationMode === 'both' || (participationMode === 'gift' && giftId === participationGiftId);
    const joined = event.isTest !== true && delta > 0 && joinsByGift && this.#join(key);
    return this.#deliver(result(true, { joined, delta, addedCoins,
      actions: this.#punch(this.#giftSide(key, giftId), user, event, 'A', delta, 'gift'),
    }));
  }

  ingestLike(event) {
    const reason = this.#check(event);
    if (reason) return result(false, { reason });
    if (event.isDelta === false) return result(false, { reason: 'likes-must-be-deltas' });
    const delta = Number(event.likeCount ?? event.count);
    if (!Number.isSafeInteger(delta) || delta < 1) return result(false, { reason: 'invalid-like-count' });
    const key = this.#identity(event);
    this.#events.set(id(event.eventId), true);
    if (event.isTest === true) return result(true, { delta });
    const side = this.#fighterSide(key);
    const seated = side || this.#waiting.has(key);
    const canJoin = this.#settings.likeJoin && !seated;
    if (!seated && !canJoin) return result(true, { delta });
    const canPunch = this.#kingOfRing && side && this.#phase === 'active' && ['like','all'].includes(this.#settings.punchSource);
    const previousProfile = this.#users.get(key);
    const user = this.#user(event, key);
    let addedFps=0;
    if(this.#kingOfRing){
      const previous=this.#rankLikes.get(key)||0,residual=delta%100;
      const carry=residual>=100-previous;
      const earned=Math.floor(delta/100)+(carry?1:0);
      this.#rankLikes.set(key,carry?residual-(100-previous):residual+previous);
      addedFps=Math.min(earned,Number.MAX_SAFE_INTEGER-user.likeFps);
      user.likeFps+=addedFps;
    }
    let joined = false;
    if (canJoin) {
      const previous = this.#joinLikes.get(key) || 0;
      // Compare before adding: even MAX_SAFE_INTEGER packets stay exact.
      if (delta >= this.#settings.likeJoinThreshold - previous) joined = this.#join(key);
      else this.#joinLikes.set(key, previous + delta);
    }
    const rosterChanged = Boolean(seated || joined) && (addedFps>0 || previousProfile?.id !== user.id || previousProfile?.uniqueId !== user.uniqueId
      || previousProfile?.nickname !== user.nickname || previousProfile?.portrait !== user.portrait);
    if (!canPunch) return result(true, { joined, delta, addedFps, rosterChanged });
    const threshold = this.#settings.likeThreshold;
    // Divide first so even MAX_SAFE_INTEGER deltas cannot overflow a remainder.
    const previous = this.#likes.get(key) || 0;
    const residual = delta % threshold;
    const carry = residual >= threshold - previous;
    const batches = Math.floor(delta / threshold) + (carry ? 1 : 0);
    // A round has at most 100 scoring hits per boxer. Keep even anomalous
    // upstream batches within the native command limit without per-hit loops.
    const count = Math.min(1_000_000, batches * this.#settings.likePunchCount);
    this.#likes.set(key, carry ? residual - (threshold - previous) : residual + previous);
    return this.#deliver(result(true, { delta, addedFps, rosterChanged, actions: this.#punch(side, user, event, 'A', count, 'like') }));
  }

  #fps(key){
    const user=this.#users.get(key);
    return Math.min(Number.MAX_SAFE_INTEGER,user.coins+user.likeFps+user.followFps);
  }

  #ordered() {
    return [...this.#waiting].sort((a, b) => this.#fps(b)-this.#fps(a)
      || this.#users.get(a).joinOrder - this.#users.get(b).joinOrder);
  }

  #select() {
    for (const side of ['right', 'left']) {
      if (this.#active[side] !== null) continue;
      const key = this.#ordered()[0];
      if (key === undefined) break;
      this.#active[side] = key; this.#waiting.delete(key);
    }
  }

  startRound() {
    if (this.#phase === 'active') return { accepted: false, reason: 'round-active', ...this.snapshot() };
    const available = this.#waiting.size + (this.#phase === 'finished' ? 0 : Object.values(this.#active).filter(Boolean).length);
    if (available < 2) return { accepted: false, reason: 'need-two-participants', ...this.snapshot() };
    if (!this.#kingOfRing && this.#phase === 'staging') {
      for (const key of Object.values(this.#active)) if (key !== null) this.#waiting.add(key);
    }
    if (!this.#kingOfRing) this.#active = { left: null, right: null };
    this.#select();
    this.#likes.clear();
    this.#initial = false; this.#phase = 'active'; this.#round++;
    this.#played = new Map(Object.values(this.#active).filter(key=>key!==null)
      .map(key=>[key,this.#users.get(key).joinOrder]));
    return { accepted: true, ...this.snapshot() };
  }

  finishRound(winnerSide = null) {
    if (this.#kingOfRing) {
      if (winnerSide !== null && !['left', 'right'].includes(winnerSide)) throw new RangeError('winnerSide must be left, right or null');
      if (this.#phase !== 'active') return this.snapshot();
      for (const side of ['right', 'left']) if (side !== winnerSide) this.#active[side] = null;
      this.#phase = 'staging'; this.#likes.clear(); this.#select();
      return this.snapshot();
    }
    if (this.#phase === 'active') this.#phase = 'finished';
    return this.snapshot();
  }

  resetRound() {
    // Legacy retires fighters; kingOfRing preserves the staged/active pair for
    // a native ring reset. Neither mode starts a fight or clears dedupe history.
    this.#initial = false; this.#phase = 'staging';
    if (!this.#kingOfRing) this.#active = { left: null, right: null };
    this.#likes.clear();
    this.#select();
    return this.snapshot();
  }

  advanceRound() {
    // A challenger seated after KO has not fought yet and keeps their queue priority.
    for(const key of Object.values(this.#active)){
      if(key!==null && this.#played.get(key)!==this.#users.get(key).joinOrder)this.#waiting.add(key);
    }
    this.#active={left:null,right:null};
    this.#phase='staging';
    this.#initial=false;
    this.#likes.clear();
    this.#played.clear();
    this.#select();
    return this.snapshot();
  }

  snapshot() {
    const copy = key => {
      if (key === null) return null;
      const user = this.#users.get(key);
      return { ...user, fps:this.#fps(key),userId: user.userId || user.id, profilePictureUrls: [...user.profilePictureUrls] };
    };
    return {
      settings: { ...this.#settings, giftDamage:{...this.#settings.giftDamage} }, phase: this.#phase, round: this.#round,
      active: { left: copy(this.#active.left), right: copy(this.#active.right) },
      queue: this.#ordered().map(copy),
    };
  }
}

module.exports = { AudienceQueue };
