'use strict';

/**
 * Hediye Box combat adapter for the existing Online Boxing Demo.
 * No timers, rendering, I/O, accounts or autonomous attacks live here.
 *
 * new HediyeBoxMatch({ maxHealth: 100, punchDamage: 5, punchIntervalMs: 300,
 *                     eventCacheSize: 4096, streakCacheSize: 4096 })
 * ingestGift(normalizedEvent) -> { accepted, side, addedPunches, reason? }
 * nextPunch('left'|'right', nowMs) -> punch | null
 * reportHit(punch.punchId) -> { ...punch, damageApplied, health, knockout } | null
 * reportMiss(punch.punchId) -> same result shape, zero damage, no knockout | null
 * snapshot() -> detached state; sides[side].pendingPunches excludes inFlight.
 * resetRound({ preservePending: true }) -> snapshot
 *
 * The controller supplies a monotonic clock and calls nextPunch per side. The
 * first queued punch is immediately eligible, later punches obey the per-side
 * cadence, and at most one punch per side awaits reportHit (native contact) or
 * reportMiss (native swing completion without contact). A miss consumes that
 * punch without damage or retry; stale/double hit and miss reports are ignored.
 * Pending units use counters, never an array/object for each gift unit. Health
 * defaults here are isolated core bookkeeping, not the demo's actual native
 * health; the native adapter must explicitly map native health/KO behavior.
 *
 * IDs are opaque strings (safe numeric IDs are also accepted). A known gift ID
 * takes precedence over its name; an unknown supplied ID is ignored. Only when
 * giftId is absent do exact Rose/Gul/Gül/TikTok names provide a fallback.
 * Catalog verification: ../../gift-catalog.json, 5655 = Gül, 5269 = TikTok.
 *
 * A streakId denotes a cumulative combo; giftType 1 requires that stable ID.
 * Its high-water count is scoped by sender identity, gift and isTest. repeatEnd
 * never delays credit or deletes the high-water mark. New combos need new IDs.
 * Event IDs are global across sides and test/live traffic. Event/streak LRU
 * caches survive round resets; replays older than BOTH retention windows cannot
 * be recognized. Size the caches for the upstream replay window.
 *
 * Leaders count accepted LIVE gift units for this instance/session, including
 * queued gifts, and survive resetRound. Ties retain the incumbent. userId is
 * identity; uniqueId/nickname are separate display fields (uniqueId is the
 * identity fallback only if userId is absent). Test gifts punch but never rank.
 * Profile URLs are supplied by the normalizer; no fetching or quality guessing.
 *
 * KO happens only at reportHit. It freezes the result and returns any other
 * unhit in-flight punch to pending. Gifts arriving while finished also queue,
 * but cannot start another round. Only explicit resetRound reopens combat.
 * Default reset carries ALL unspent units, including arrivals after KO and
 * unresolved in-flight punches, into the new round. preservePending: false
 * discards them and is reserved for a caller's explicit user reset. Neither
 * mode dispatches a punch. Old punch IDs remain invalid after any reset.
 */

const SIDES = ['left', 'right'];
const GIFTS = Object.freeze({
  left: Object.freeze({ giftId: '5655', giftName: 'Gül' }),
  right: Object.freeze({ giftId: '5269', giftName: 'TikTok' }),
});

class BoundedLru {
  #entries = new Map();
  constructor(capacity) { this.capacity = capacity; }
  get(key) {
    if (!this.#entries.has(key)) return undefined;
    const value = this.#entries.get(key);
    this.#entries.delete(key);
    this.#entries.set(key, value);
    return value;
  }
  set(key, value) {
    this.#entries.delete(key);
    this.#entries.set(key, value);
    if (this.#entries.size > this.capacity) {
      this.#entries.delete(this.#entries.keys().next().value);
    }
  }
}

function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function id(value) {
  if (typeof value === 'string') return text(value);
  if (typeof value === 'bigint' || Number.isSafeInteger(value)) return String(value);
  return '';
}
function giftSide(event) {
  const giftId = id(event.giftId);
  if (giftId) return SIDES.find(side => GIFTS[side].giftId === giftId) || null;
  // Invalid supplied IDs must not be rescued by a potentially conflicting name.
  if (event.giftId !== undefined && event.giftId !== null && event.giftId !== '') return null;
  const name = text(event.giftName).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (name === 'rose' || name === 'gul') return 'left';
  return name === 'tiktok' ? 'right' : null;
}
function rejected(reason) { return { accepted: false, side: null, addedPunches: 0, reason }; }
function copySender(sender) {
  return sender ? { ...sender, profilePictureUrls: [...sender.profilePictureUrls] } : null;
}
function updatedSender(previous, event, giftCount) {
  const urls = Array.isArray(event.profilePictureUrls)
    ? [...new Set(event.profilePictureUrls.map(text).filter(Boolean))] : [];
  return {
    userId: id(event.userId) || previous?.userId || '',
    uniqueId: text(event.uniqueId) || previous?.uniqueId || '',
    nickname: text(event.nickname) || previous?.nickname || '',
    profilePictureUrl: text(event.profilePictureUrl) || urls[0] || previous?.profilePictureUrl || '',
    profilePictureUrls: urls.length ? urls : [...(previous?.profilePictureUrls || [])],
    giftCount,
  };
}

class HediyeBoxMatch {
  #config;
  #events;
  #streaks;
  #round = 1;
  #status = 'active';
  #winner = null;
  #sequence = 0n;
  #sides;

  constructor(options = {}) {
    const config = {
      maxHealth: 100, punchDamage: 5, punchIntervalMs: 300,
      eventCacheSize: 4096, streakCacheSize: 4096, ...options,
    };
    for (const key of ['maxHealth', 'punchDamage', 'punchIntervalMs']) {
      if (typeof config[key] !== 'number' || !Number.isFinite(config[key]) ||
          config[key] < 0 || (key !== 'punchIntervalMs' && config[key] === 0)) {
        throw new RangeError(`${key} must be a finite ${key === 'punchIntervalMs' ? 'nonnegative' : 'positive'} number`);
      }
    }
    for (const key of ['eventCacheSize', 'streakCacheSize']) {
      if (!Number.isSafeInteger(config[key]) || config[key] < 1) {
        throw new RangeError(`${key} must be a positive safe integer`);
      }
    }
    this.#config = Object.freeze(config);
    this.#events = new BoundedLru(config.eventCacheSize);
    this.#streaks = new BoundedLru(config.streakCacheSize);
    this.#sides = Object.fromEntries(SIDES.map(side => [side, {
      health: config.maxHealth, pendingPunches: 0, inFlight: null,
      nextAt: -Infinity, giftUnits: 0, senders: new Map(), leaderKey: null,
    }]));
  }

  ingestGift(event) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) return rejected('invalid-event');
    const eventId = id(event.eventId);
    if (!eventId) return rejected('missing-event-id');
    if (this.#events.get(eventId)) return rejected('duplicate-event');
    const side = giftSide(event);
    if (!side) return rejected('unsupported-gift');
    const userId = id(event.userId);
    const uniqueId = text(event.uniqueId);
    if (!userId && !uniqueId) return rejected('missing-sender');
    const senderKey = JSON.stringify(userId ? ['userId', userId] : ['uniqueId', uniqueId]);
    const count = event.repeatCount === undefined ? 1
      : (typeof event.repeatCount === 'string' && text(event.repeatCount)
        ? Number(event.repeatCount) : event.repeatCount);
    if (!Number.isSafeInteger(count) || count < 1) return rejected('invalid-repeat-count');
    const isDelta = event.isDelta === true;
    const streakId = isDelta ? '' : id(event.streakId);
    if (!isDelta && (event.giftType === 1 || event.giftType === '1') && !streakId) {
      return rejected('missing-streak-id');
    }
    const isTest = event.isTest === true;
    const streakKey = streakId
      ? JSON.stringify([senderKey, GIFTS[side].giftId, isTest, streakId]) : null;
    const previousCount = streakKey ? (this.#streaks.get(streakKey) || 0) : 0;
    const delta = Math.max(0, count - previousCount);
    const state = this.#sides[side];
    const previousSender = state.senders.get(senderKey);
    const senderCount = (previousSender?.giftCount || 0) + delta;
    if (![state.pendingPunches + delta, state.giftUnits + delta,
      ...(isTest ? [] : [senderCount])].every(Number.isSafeInteger)) {
      return rejected('count-overflow');
    }

    this.#events.set(eventId, true);
    if (streakKey) this.#streaks.set(streakKey, Math.max(previousCount, count));
    state.pendingPunches += delta;
    state.giftUnits += delta;
    if (!isTest && senderCount > 0) {
      const sender = updatedSender(previousSender, event, senderCount);
      state.senders.set(senderKey, sender);
      const leader = state.senders.get(state.leaderKey);
      if (!leader || sender.giftCount > leader.giftCount) state.leaderKey = senderKey;
    }
    return { accepted: true, side, addedPunches: delta };
  }

  nextPunch(side, now) {
    if (!SIDES.includes(side)) throw new RangeError('side must be left or right');
    if (typeof now !== 'number' || !Number.isFinite(now) || now < 0) {
      throw new RangeError('now must be finite nonnegative milliseconds');
    }
    const state = this.#sides[side];
    if (this.#status === 'finished' || !state.pendingPunches || state.inFlight || now < state.nextAt) {
      return null;
    }
    const punch = {
      punchId: `round-${this.#round}-punch-${++this.#sequence}`,
      round: this.#round, side, targetSide: side === 'left' ? 'right' : 'left',
      damage: this.#config.punchDamage, issuedAt: now,
    };
    state.pendingPunches -= 1;
    state.inFlight = punch;
    state.nextAt = now + this.#config.punchIntervalMs;
    return { ...punch };
  }

  reportHit(punchId) {
    if (this.#status === 'finished') return null;
    const side = SIDES.find(candidate => this.#sides[candidate].inFlight?.punchId === punchId);
    if (!side) return null;
    const state = this.#sides[side];
    const punch = state.inFlight;
    const target = this.#sides[punch.targetSide];
    const damageApplied = Math.min(target.health, punch.damage);
    target.health = Math.max(0, target.health - punch.damage);
    state.inFlight = null;
    const knockout = target.health === 0;
    if (knockout) {
      this.#status = 'finished';
      this.#winner = side;
      this.#returnInFlight();
    }
    return { ...punch, damageApplied, health: target.health, knockout };
  }

  reportMiss(punchId) {
    if (this.#status === 'finished') return null;
    const side = SIDES.find(candidate => this.#sides[candidate].inFlight?.punchId === punchId);
    if (!side) return null;
    const state = this.#sides[side];
    const punch = state.inFlight;
    state.inFlight = null;
    return {
      ...punch, damageApplied: 0, health: this.#sides[punch.targetSide].health, knockout: false,
    };
  }

  #returnInFlight() {
    for (const side of SIDES) {
      const state = this.#sides[side];
      if (state.inFlight) {
        state.pendingPunches += 1;
        state.inFlight = null;
      }
    }
  }

  snapshot() {
    return {
      round: this.#round, status: this.#status, winner: this.#winner,
      maxHealth: this.#config.maxHealth, punchDamage: this.#config.punchDamage,
      punchIntervalMs: this.#config.punchIntervalMs,
      sides: Object.fromEntries(SIDES.map(side => {
        const state = this.#sides[side];
        return [side, {
          ...GIFTS[side], health: state.health, pendingPunches: state.pendingPunches,
          inFlight: state.inFlight ? { ...state.inFlight } : null,
          giftUnits: state.giftUnits, leader: copySender(state.senders.get(state.leaderKey)),
        }];
      })),
    };
  }

  resetRound({ preservePending = true } = {}) {
    if (typeof preservePending !== 'boolean') throw new TypeError('preservePending must be boolean');
    this.#returnInFlight();
    for (const side of SIDES) {
      const state = this.#sides[side];
      state.health = this.#config.maxHealth;
      if (!preservePending) state.pendingPunches = 0;
      state.nextAt = -Infinity;
    }
    this.#round += 1;
    this.#status = 'active';
    this.#winner = null;
    return this.snapshot();
  }
}

module.exports = { HediyeBoxMatch };
