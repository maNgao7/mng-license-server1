'use strict';
const { createHash } = require('node:crypto');
const { readProfile } = require('../vendor/pk-profiles.cjs');
const { normalizeEvent } = require('../vendor/forza-publisher.cjs');
const clean = value => typeof value === 'string' ? value.trim().replace(/^@/, '').toLowerCase() : '';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const completed = value => [true, 1, '1', 'true'].includes(value);
const identifier = value => typeof value === 'string' || typeof value === 'bigint'
    || typeof value === 'number' && Number.isSafeInteger(value) ? String(value).slice(0, 256) : '';

// No time-window dedupe: a replay stays a replay after reconnect and after ack.
// A completed combo can subsequently arrive with a larger cumulative total.
// Emit its positive delta, never discard that additional count.
function normalizeIncoming(type, payload, channel, receipts) {
    if (type === 'comment') type = 'chat';
    if (!['gift', 'like', 'follow', 'share', 'chat', 'member', 'subscribe', 'viewer'].includes(type)) return null;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const giftType = payload.giftType ?? payload.gift?.type ?? payload.gift?.giftType
        ?? payload.giftDetails?.giftType ?? payload.extendedGiftInfo?.giftType ?? payload.extendedGiftInfo?.type;
    if (type === 'gift' && (Number(giftType) === 1 || giftType === undefined && Object.hasOwn(payload, 'repeatEnd'))
        && !completed(payload.repeatEnd)) return null;
    const rawId = identifier(payload.eventId || payload.msgId || payload.common?.msgId || payload.logId);
    const profile = readProfile(payload.user, payload.userId ?? payload.userIdStr)
        || readProfile(payload, payload.userIdStr ?? payload.viewerId);
    const username = clean(profile?.username || payload.username || payload.uniqueId || payload.displayId
        || payload.user?.uniqueId || payload.user?.displayId || payload.user?.display_id);
    if (type !== 'viewer' && !/^[a-z0-9_.]{1,64}$/.test(username)) {
        if (type === 'gift') throw new Error('event-identity');
        return null;
    }
    const nickname = String(profile?.nickname || payload.nickname || payload.user?.nickname || username).slice(0, 128);
    const giftId = identifier(payload.giftId ?? payload.gift_id ?? payload.gift?.id ?? payload.gift?.giftId);
    const group = identifier(payload.groupId ?? payload.group_id ?? payload.comboId ?? payload.combo_id);
    if (!rawId && !(type === 'gift' && group)) throw new Error('event-id');
    const total = type === 'gift' ? Number(payload.repeatCount ?? payload.count ?? 1) : 1;
    if (!Number.isSafeInteger(total) || total < 1) throw new Error('gift-count');
    if (type === 'gift' && !/^\d{1,20}$/.test(giftId)) throw new Error('gift-id');
    const receipt = hash([clean(channel), type, group && type === 'gift' ? ['combo', username, giftId, group] : ['id', rawId]]);
    const previous = receipts.get(receipt) || 0;
    if (previous && !(type === 'gift' && group)) return null;
    if (total <= previous) return null;
    // Reuse the verified publisher mapping for the common event shape.
    const mapped = normalizeEvent(type, { ...payload, username, nickname, eventId: rawId || group,
        giftId, giftType, giftName: payload.giftName || payload.gift?.name || payload.extendedGiftInfo?.name,
        repeatCount: total, repeatEnd: payload.repeatEnd }, channel);
    const value = { type, giftId: type === 'gift' ? giftId : '',
        giftName: type === 'gift' ? String(mapped?.giftName || 'Hediye').slice(0, 128) : '',
        repeatCount: type === 'gift' ? total - previous : 0,
        eventId: hash([receipt, total]), username, nickname,
        userId: profile?.id || '', viewerId: profile?.id || '' };
    if (type === 'gift') {
        const unit = payload.giftCoinValue ?? payload.diamondCount ?? payload.diamond_count
            ?? payload.gift?.diamondCount ?? payload.gift?.diamond_count
            ?? payload.giftDetails?.diamondCount ?? payload.giftDetails?.diamond_count
            ?? payload.extendedGiftInfo?.diamondCount ?? payload.extendedGiftInfo?.diamond_count;
        // Launcher shared events carry total coins; our normalized owner carries
        // explicit unit coins. Preserve unknown prices as null, never invent one.
        const amount = unit ?? (payload.coins == null ? null : Number(payload.coins) / total);
        value.giftCoinValue = amount == null ? null : positiveCount(amount, true);
    }
    if (type === 'chat') {
        const comment = payload.comment ?? payload.content ?? payload.message ?? '';
        if (typeof comment !== 'string') throw new Error('chat-comment');
        value.comment = comment;
    }
    if (type === 'like') {
        value.likeCount = positiveCount(payload.likeCount ?? payload.like_count ?? payload.count ?? 1);
        value.broadcastChannel = clean(channel);
    }
    if (type === 'viewer') value.viewerCount = positiveCount(payload.viewerCount ?? payload.viewer_count ?? payload.total ?? 0, true);
    // Game actions remain keyed by giftId. Profiles are enriched separately so
    // network image work never delays a normalized event or its durable append.
    return { value, receipt, total };
}
function positiveCount(value, zero = false) {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < (zero ? 0 : 1)) throw new Error('event-count');
    return n;
}
module.exports = { normalizeIncoming, clean };
