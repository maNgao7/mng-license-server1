import { randomUUID } from 'node:crypto';
import { fold } from './catalog.mjs';
import {avatarFrom} from './avatars.mjs';

const identity = value => /^0*$/.test(String(value ?? '')) ? '' : String(value).slice(0, 120);
export const cleanText = (value, max = 600) => String(value ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim().slice(0, max);
const count = value => Math.min(10000, Math.max(1, Math.floor(Number(value) || 1)));

export function normalize(type, data = {}, source = 'live', now = Date.now()) {
  if (!['chat', 'gift', 'follow', 'like', 'member'].includes(type) || !data || typeof data !== 'object') return null;
  const user = data.user || data;
  const event = { id: randomUUID(), type, username: cleanText(user.uniqueId || user.displayId || data.username || user.nickname || 'Izleyici', 64),
    count: 1, timestamp: now, source, messageId: identity(data.common?.msgId || data.msgId),
    platformTime: identity(data.common?.createTime || data.createTime) };
  event.avatar=avatarFrom(user,data);
  if (['gumball', 'darwin'].includes(data.character)) event.character = data.character;
  if (type === 'chat') {
    event.text = cleanText(data.comment ?? data.text);
    if (!event.text) return null;
  }
  if (type === 'gift') {
    const gift = data.gift || data.giftDetails || data.extendedGiftInfo || {};
    event.giftId = identity(data.giftId || data.gift_id || gift.id || gift.giftId);
    event.giftName = cleanText(gift.name || gift.giftName || data.giftName || '', 120);
    if (!event.giftId && !event.giftName) return null;
    event.count = count(data.repeatCount ?? gift.repeatCount ?? data.count);
    event.coins = Math.max(0, Number(data.diamondCount ?? gift.diamondCount) || 0);
    event.streak = Number(data.giftType ?? gift.type ?? gift.giftType) === 1;
    event.repeatEnd = data.repeatEnd === true || Number(data.repeatEnd) === 1;
    event.groupId = identity(data.groupId || data.group_id);
    event.orderId = identity(data.orderId || data.order_id);
  }
  if (type === 'like') {
    const n = Number(data.count ?? data.likeCount);
    if (!Number.isFinite(n) || n < 1) return null;
    event.count = count(n);
    event.total = identity(data.total ?? data.totalLikeCount);
  }
  return event;
}

export class EventLedger {
  constructor({ now = Date.now, ttl = 10 * 60 * 1000, replayWindow = 2500 } = {}) {
    this.now = now; this.ttl = ttl; this.replayWindow = replayWindow;
    this.seen = new Map(); this.streaks = new Map(); this.finals = new Map();
  }
  remember(map, key, value) {
    map.delete(key); map.set(key, { ...value, at: this.now() });
    while (map.size > 20000) map.delete(map.keys().next().value);
  }
  previous(map, key) {
    const value = map.get(key);
    if (value && this.now() - value.at <= this.ttl) return value;
    map.delete(key); return null;
  }
  accept(event) {
    if (!event) return null;
    const viewer = event.username.toLowerCase();
    const base = `${viewer}:${event.giftId || fold(event.giftName)}`;
    let key = '';
    if (event.type === 'gift') {
      const group = event.groupId || event.orderId;
      if (group) {
        const groupKey = `${base}:${event.groupId ? 'group' : 'order'}:${group}`;
        const previous = this.previous(this.streaks, groupKey)?.count || 0;
        if (event.count <= previous) return null;
        this.remember(this.streaks, groupKey, { count: event.count });
        return { ...event, count: event.count - previous, cumulativeCount: event.count };
      }
      if (event.streak && !event.repeatEnd) {
        // No stable group: defer the running total until its terminal message.
        this.finals.delete(base);
        return null;
      }
      if (event.repeatEnd) {
        const previous = this.previous(this.finals, base);
        // Some connectors replay even a one-item final with a fresh msgId.
        // In the absence of group/order IDs a short terminal fingerprint is
        // the only available identity; interim updates reopen the streak.
        if (previous && previous.count === event.count
          && ((!event.platformTime || event.platformTime === previous.platformTime)
            && this.now() - previous.at < this.replayWindow)) return null;
        this.remember(this.finals, base, { count: event.count, platformTime: event.platformTime });
      }
      if (event.messageId) key = `gift:${base}:${event.messageId}:${event.count}`;
    } else if (event.type === 'follow') key = `follow:${viewer}`;
    else if (event.type === 'like') {
      if (event.total) key = `like:${viewer}:${event.total}:${event.count}`;
      else if (event.messageId) key = `like:${viewer}:${event.messageId}:${event.count}`;
    } else if (event.messageId) key = `${event.type}:${viewer}:${event.messageId}`;
    if (key && this.previous(this.seen, key)) return null;
    if (key) this.remember(this.seen, key, {});
    return event;
  }
}

export class RuleEngine {
  constructor({ now = Date.now, catalog } = {}) { this.now = now; this.catalog = catalog; this.likes = new Map(); this.comments = new Map(); this.pendingCharacter = new Map(); }
  reset() { this.likes.clear(); this.comments.clear(); this.pendingCharacter.clear(); }
  trim(map) { while (map.size > 20000) map.delete(map.keys().next().value); }
  route(action, event, settings) {
    if (action.endsWith('_question')) {
      const character = action.split('_')[0];
      if (!settings.characters[character]) return [];
      const key = event.username.toLowerCase();
      this.pendingCharacter.delete(key); this.pendingCharacter.set(key, character); this.trim(this.pendingCharacter);
      action = `${character}_thanks`;
    }
    return [{ action, event }];
  }
  actions(event, settings) {
    if (event.type === 'gift') {
      const rule = settings.rules.find(rule => rule.giftId
        ? (rule.giftId === event.giftId || this.catalog?.find(rule.giftId)?.id === event.giftId)
        : fold(rule.giftName) === fold(event.giftName));
      return this.route(rule?.action || `${event.character || 'gumball'}_thanks`, event, settings);
    }
    if (event.type === 'follow') return settings.follow.enabled ? this.route(settings.follow.action, event, settings) : [];
    if (event.type === 'like') {
      if (!settings.likes.enabled) return [];
      const key = event.username.toLowerCase(), previous = this.likes.get(key);
      const threshold = settings.likes.threshold;
      const total = (previous?.threshold === threshold ? previous.remainder : 0) + event.count;
      const hits = Math.floor(total / threshold);
      this.likes.delete(key); this.likes.set(key, { threshold, remainder: total % threshold }); this.trim(this.likes);
      return Array.from({ length: Math.min(hits, settings.speech.maxQueue) }, () => this.route(settings.likes.action, { ...event, count: threshold, milestones: hits }, settings)).flat();
    }
    if (event.type === 'chat' && settings.speech.answerComments) {
      const key = event.username.toLowerCase(), last = this.comments.get(key);
      if (last !== undefined && this.now() - last < settings.speech.userCooldownSeconds * 1000) return [];
      this.comments.delete(key); this.comments.set(key, this.now()); this.trim(this.comments);
      const character = event.character || this.pendingCharacter.get(key) || 'gumball';
      this.pendingCharacter.delete(key);
      return settings.characters[character] ? [{ action: `${character}_question`, event: { ...event, character } }] : [];
    }
    return [];
  }
}
