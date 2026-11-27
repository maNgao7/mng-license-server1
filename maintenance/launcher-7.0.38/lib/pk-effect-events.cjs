'use strict';

/**
 * Native gift and card notices; never applies score multiplication.
 * Local primary sources: connector 2.4.4 dist/lib-QI8aOkkz.js event map and
 * processDecodedData; proto 0.2.4 dist/node/v3.d.ts MatchInfo (1774),
 * MatchInfoMultiplierType (562), WebcastGiftMessage (6968), and item cards (7209).
 * renderer/gift-assets/katalog_tam.json identifies 6007 as Boxing Gloves and
 * 5853 as Golden Boxing Gloves. Receipt of either GIFT is not acquisition of
 * a vault-glove inventory card. Names, images, prices and enum ordinals are
 * never used to infer a multiplier or identify a gift.
 *
 * One factory per publisher. Bind listeners with a CAPTURED scope token.
 * ingestNative(type, raw, {scope, battleId, status:'active', participantIds,
 * activeSince, endsAt?}) returns {accepted,reason,events:[notice,...]}.
 * activeSince is the native source timestamp when this battle was observed
 * active (or its verified native start), not a freshly assigned arrival time.
 * Gifts have no native battleId: their battle association is explicitly
 * evidence='active-room-context', guarded by room, roster and active interval.
 * Do not reuse a factory/context across accounts. reset({roomId}) fences old
 * callbacks and retains bounded receipts, including completed streak groups.
 *
 * Wire notices follow pkStage.notifications: source:'native', official:true,
 * receiptId, id, scope, roomId, battleId, occurredAt, expiresAt, kind and data.
 * expiresAt is notice retention. A timed glove use can remain in the snapshot
 * after its presentation TTL so the renderer can count down its native end.
 * multiplier data.appliesTo='gift': an explicit per-gift native multiplier,
 * NOT a prediction of the next gift or a battle-wide boost activation.
 * Publish these notices with the matching live stage; do not route them
 * through ingestManual or apply them to stored/native scores.
 *
 * Not mapped: awardCardNotice/cardObtainGuide (no typed awarded card),
 * useTop2Card/useTop3Card (top-gifter card names are not x2/x3 values),
 * probabilistic cardInfo.multiple, untyped BattleEffect.effectExtra, boostCard
 * (IDs only), and task START rewardConfig (configuration, not activation).
 */

const { normalizeNativePKEvent, NATIVE_EFFECT_CLOCK_SKEW_MS } = require('./pk-notifications.cjs');
const GLOVE_GIFT_IDS = Object.freeze(['6007', '5853']);
const MULTIPLIER_TYPES = Object.freeze({ 1: 'CRITICAL_STRIKE', 2: 'TOP_2', 3: 'TOP_3', 4: 'VAULT_GLOVE' });
const METHODS = Object.freeze({ gift: 'WebcastGiftMessage', linkMicBattleItemCard: 'WebcastLinkMicBattleItemCard' });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const missing = value => value === undefined || value === null || value === '' || value === '0' || value === 0;
function id(value) {
    if (!['string', 'number', 'bigint'].includes(typeof value) || typeof value === 'number' && !Number.isSafeInteger(value)) return '';
    return /^[1-9]\d{0,31}$/.test(String(value)) ? String(value) : '';
}
function aliases(...values) {
    const present = values.filter(value => !missing(value)), ids = present.map(id);
    return ids.length && ids.every(key => key && key === ids[0]) ? ids[0] : '';
}
function userId(user) {
    return object(user) ? aliases(user.id, user.userId, user.id_str, user.userIdStr) : '';
}
function epoch(value) {
    if (!['string', 'number', 'bigint'].includes(typeof value) || !/^\d{1,16}$/.test(String(value))) return null;
    const n = Number(value), ms = n < 1000000000000 ? n * 1000 : n;
    return Number.isSafeInteger(ms) && ms >= 1000000000000 ? ms : null;
}
function milliseconds(value) {
    return Number.isSafeInteger(value) && value >= 1000000000000 ? value : null;
}

function createPKEffectEvents({ roomId, clock = Date, receiptTtlMs = 300000, notificationTtlMs = 8000, maxReceipts = 2048 } = {}) {
    if (!id(roomId)) throw new TypeError('A verified native roomId is required');
    if (!Number.isSafeInteger(receiptTtlMs) || receiptTtlMs < 1 || receiptTtlMs > 86400000 ||
        !Number.isSafeInteger(notificationTtlMs) || notificationTtlMs < 1 || notificationTtlMs > receiptTtlMs ||
        !Number.isSafeInteger(maxReceipts) || maxReceipts < 1 || maxReceipts > 10000) throw new TypeError('Invalid PK effect limits');
    let room = id(roomId), generation = 0, lastNow = 0;
    const receipts = new Map();
    const readClock = typeof clock === 'function' && clock !== Date ? clock : () => clock.now();
    function now() {
        const at = readClock();
        if (!milliseconds(at)) throw new TypeError('clock must return epoch milliseconds');
        lastNow = Math.max(lastNow, at);
        for (const [key, expiry] of receipts) if (expiry <= lastNow) receipts.delete(key);
        return lastNow;
    }
    function ingestNative(eventName, message, context = {}) {
        const at = now(), reject = reason => ({ accepted: false, reason, events: [] });
        if (!object(context)) return reject('invalid-context');
        if (context.scope !== generation) return reject('scope-mismatch');
        if (!object(message) || !object(message.common)) return reject('invalid-event');
        if (eventName === 'pk') eventName = 'linkMicBattleItemCard';
        if (!Object.hasOwn(METHODS, eventName) || message.common.method !== METHODS[eventName]) return reject('unsupported-event');
        const receiptId = id(message.common.msgId), occurredAt = epoch(message.common.createTime);
        if (!receiptId || !occurredAt) return reject('invalid-event');
        if (id(message.common.roomId) !== room) return reject('room-mismatch');
        const ahead = eventName === 'linkMicBattleItemCard' ? NATIVE_EFFECT_CLOCK_SKEW_MS : 0;
        if (occurredAt > at + ahead || occurredAt <= at - receiptTtlMs) return reject('stale-event');
        const battleId = id(context.battleId), activeSince = milliseconds(context.activeSince);
        const endsAt = context.endsAt == null ? null : milliseconds(context.endsAt);
        const participants = Array.isArray(context.participantIds) ? context.participantIds.map(id) : [];
        const initialCard = eventName === 'linkMicBattleItemCard' && context.initial === true;
        if (!battleId || !initialCard && !activeSince || context.endsAt != null && !endsAt ||
            ![2, 4].includes(participants.length) || participants.some(key => !key) || new Set(participants).size !== participants.length)
            return reject('invalid-context');
        if (context.status !== 'active' || !initialCard && activeSince > occurredAt ||
            endsAt !== null && (occurredAt >= endsAt || at >= endsAt))
            return reject('battle-not-active');
        const presentationExpiresAt = Math.min(occurredAt + notificationTtlMs, endsAt ?? Infinity);
        if (presentationExpiresAt <= at && eventName === 'gift') return reject('expired-notice');
        const receiptKey = room + ':message:' + receiptId;
        if (receipts.has(receiptKey)) return reject('duplicate');
        const facts = []; let groupKey = '';
        if (eventName === 'gift') {
            const giftId = aliases(message.giftId, message.gift?.id);
            const senderId = userId(message.user), targetId = userId(message.toUser);
            if (!giftId || !senderId || !targetId || message.monitorInfo &&
                !missing(message.monitorInfo.toUserId) && aliases(targetId, message.monitorInfo.toUserId) !== targetId)
                return reject('invalid-gift');
            if (!participants.includes(targetId)) return reject('unknown-participant');
            const quantity = message.repeatCount, type = message.gift?.type;
            const terminal = message.repeatEnd === 1 || message.repeatEnd === true;
            if (type !== undefined && (!Number.isSafeInteger(type) || type < 0) ||
                ![0, 1, false, true].includes(message.repeatEnd) || !Number.isSafeInteger(quantity) || quantity < 1)
                return reject('invalid-gift');
            const streak = type === 1 || message.gift?.combo === true;
            if ((streak || !Number.isSafeInteger(type) || type < 0) && !terminal) return reject('incomplete-gift');
            if (streak) {
                if (!id(message.groupId)) return reject('invalid-gift');
                groupKey = [room, 'streak', id(message.groupId), senderId, targetId, giftId].join(':');
                if (receipts.has(groupKey)) return reject('duplicate');
            }
            const common = { participantId: targetId, senderId, giftId, quantity, battleEvidence: 'active-room-context' };
            if (GLOVE_GIFT_IDS.includes(giftId)) facts.push({ kind: 'glove', data: { ...common, action: 'arrival',
                arrivalType: 'gift', evidence: 'WebcastGiftMessage.giftId', catalogEvidence: 'renderer/gift-assets/katalog_tam.json#' + giftId } });
            const match = message.matchInfo;
            if (object(match) && match.effectCardInUse === true && Number.isInteger(match.multiplierType) &&
                Object.hasOwn(MULTIPLIER_TYPES, match.multiplierType) && ['2', '3', 2, 3, 2n, 3n].includes(match.multiplierValue)) {
                facts.push({ kind: 'multiplier', data: { ...common, multiplier: Number(match.multiplierValue), appliesTo: 'gift',
                    multiplierType: Number(match.multiplierType), multiplierTypeName: MULTIPLIER_TYPES[match.multiplierType],
                    effectCardInUse: true, evidence: 'WebcastGiftMessage.matchInfo' } });
            }
        } else {
            const event = normalizeNativePKEvent('linkMicBattleItemCard', message);
            if (!event || event.kind !== 'glove') return reject('no-verified-effect');
            if (event.battleId !== battleId) return reject('battle-mismatch');
            if (!participants.includes(event.data.participantId)) return reject('unknown-participant');
            if (initialCard && !(event.data.effectExpiresAt > at)) return reject('expired-notice');
            facts.push({ kind: 'glove', data: { ...event.data, battleEvidence: 'native-battleId' } });
        }
        if (!facts.length) return reject('no-verified-effect');
        const effectExpiresAt = eventName === 'linkMicBattleItemCard' ? facts[0].data.effectExpiresAt : null;
        const expiresAt = Math.max(presentationExpiresAt, Math.min(effectExpiresAt || 0, endsAt ?? Infinity));
        if (expiresAt <= at) return reject('expired-notice');
        const keys = [receiptKey, ...(groupKey ? [groupKey] : [])];
        if (receipts.size + keys.length > maxReceipts) return reject('capacity');
        for (const key of keys) receipts.set(key, occurredAt + receiptTtlMs);
        return { accepted: true, reason: 'accepted', events: facts.map(fact => ({
            id: ['native', room, receiptId, fact.kind].join(':'), receiptId, scope: generation,
            source: 'native', official: true, roomId: room, battleId, occurredAt, expiresAt,
            ...(effectExpiresAt ? { presentationExpiresAt } : {}), ...fact })) };
    }
    function reset({ roomId: nextRoom } = {}) {
        if (!id(nextRoom)) throw new TypeError('A verified native roomId is required');
        now(); room = id(nextRoom); return ++generation;
    }
    return { scope: () => generation, reset, ingestNative };
}

module.exports = { GLOVE_GIFT_IDS, MULTIPLIER_TYPES, createPKEffectEvents };
