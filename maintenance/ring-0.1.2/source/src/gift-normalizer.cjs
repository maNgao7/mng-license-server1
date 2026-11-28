'use strict';

const { createHash } = require('node:crypto');
const clean = value => typeof value === 'string' ? value.trim() : '';
const identifier = value => typeof value === 'string' || typeof value === 'bigint'
  || Number.isSafeInteger(value) ? String(value).trim().slice(0, 256) : '';

// The adapter is deliberately independent of native controls. Gift counts must
// be normalized without waiting for images or the completion of a streak.
// Common profile mapping is the same verified TikMnG vendor function.
function createGiftNormalizer({ readProfile, portraitCandidates }) {
  if (typeof readProfile !== 'function' || typeof portraitCandidates !== 'function') {
    throw new TypeError('Verified shared profile readers are required');
  }
  return function normalizeGift(payload, { roomId, isDelta = false, isTest = false } = {}) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const rawId = identifier(payload.eventId || payload.msgId || payload.common?.msgId);
    const giftId = identifier(payload.giftId ?? payload.gift_id ?? payload.gift?.id ?? payload.gift?.giftId);
    if (!rawId || !giftId) return null;
    const profile = readProfile(payload.user, payload.userIdStr ?? payload.userId)
      || readProfile(payload, payload.userIdStr ?? payload.userId);
    const uniqueId = clean(profile?.username || payload.uniqueId || payload.username)
      .replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_.]{1,64}$/.test(uniqueId)) return null;
    const count = Number(payload.repeatCount ?? payload.repeat_count ?? payload.count ?? 1);
    if (!Number.isSafeInteger(count) || count < 1) return null;
    const rawGroup = [payload.groupId, payload.group_id, payload.comboId, payload.combo_id, payload.streakId]
      .map(identifier).find(value => value && value !== '0') || '';
    const type = payload.giftType ?? payload.gift_type ?? payload.gift?.type ?? payload.gift?.giftType
      ?? payload.giftDetails?.giftType ?? payload.extendedGiftInfo?.giftType ?? payload.extendedGiftInfo?.type;
    const giftType = Number(type ?? 0);
    if (!Number.isSafeInteger(giftType) || giftType < 0) return null;
    // Non-combo gifts can share transport group IDs. Only a streak carries a cumulative count.
    const streak = !isDelta && (type == null || giftType === 1) ? rawGroup : '';
    // An unfinished combo without a stable group cannot be counted safely: a
    // final packet may have a different message ID. Do not guess its identity.
    if (!isDelta && giftType === 1 && !rawGroup) return null;
    const fingerprint = createHash('sha256').update(JSON.stringify([
      String(roomId || ''), isTest, rawId, streak, streak ? count : null,
    ])).digest('hex');
    const urls = portraitCandidates(payload).slice().sort((a, b) => b.rank - a.rank).flatMap(group => group.urls || [])
      .filter(url => typeof url === 'string' && /^https:\/\//i.test(url));
    const profilePictureUrl = urls[0] || profile?.avatar || clean(payload.bestPortraitUrl) || '';
    return {
      eventId: fingerprint,
      streakId: streak ? JSON.stringify([String(roomId || ''), streak]) : '',
      giftId, giftName: clean(payload.giftName || payload.gift?.name),
      giftType: isDelta ? 0 : giftType, repeatCount: count,
      repeatEnd: payload.repeatEnd ?? payload.repeat_end, userId: profile?.id || identifier(payload.userId),
      uniqueId, nickname: clean(profile?.nickname || payload.nickname) || uniqueId,
      profilePictureUrl, profilePictureUrls: [...new Set([profilePictureUrl, ...urls].filter(Boolean))],
      isDelta, isTest,
    };
  };
}

module.exports = { createGiftNormalizer };
