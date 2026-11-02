'use strict';

const { createHash } = require('node:crypto');

function text(value, limit = 256) {
    return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function username(value) {
    const result = typeof value === 'string' ? value.trim().replace(/^@/, '').toLowerCase() : '';
    return /^[a-z0-9_.]{1,128}$/.test(result) ? result : '';
}

function identifier(value) {
    if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0)) return '';
    if (!['string', 'number', 'bigint'].includes(typeof value)) return '';
    const result = String(value).trim();
    return result.length <= 256 && result !== '0' && /^[\w.:-]+$/.test(result) ? result : '';
}

function numericId(value) {
    const result = identifier(value);
    return /^\d{1,32}$/.test(result) && BigInt(result) > 0n ? result : '';
}

const first = (values, normalize) => values.map(normalize).find(Boolean) || '';

function imageUrls(value) {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.filter(item => typeof item === 'string').slice(0, 8);
    if (!value || typeof value !== 'object') return [];
    return imageUrls(value.urlList || value.urls || value.url_list || value.url);
}

function normalizeProfile(payload) {
    const user = payload?.user && typeof payload.user === 'object' ? payload.user : {};
    const name = first([user.uniqueId, user.displayId, payload?.uniqueId, payload?.username], username);
    const senderId = first([user.userId, user.id, payload?.userId], numericId) || name;
    const nickname = first([user.nickname, user.nickName, payload?.nickname], value => text(value, 128)) || name;
    const avatarUrls = [user.avatarLarger, user.avatar_larger, user.avatarLarge, user.avatar_large, user.avatarMedium, user.avatarThumb, user.profilePicture,
        payload?.avatarLarger, payload?.avatar_larger, payload?.avatarLarge, payload?.avatar_large,
        user.profilePictureUrl, user.profilePictureUrls, payload?.profilePictureUrl,
        payload?.profilePictureUrls, payload?.profilePicture, payload?.avatar]
        .flatMap(imageUrls).filter(value => value.length <= 4096).slice(0, 16);
    return { username: name, senderId, nickname, avatarUrls };
}

function terminalGift(payload) {
    const type = payload?.giftType ?? payload?.gift?.type ?? payload?.gift?.giftType
        ?? payload?.giftDetails?.giftType ?? payload?.giftDetails?.type
        ?? payload?.extendedGiftInfo?.giftType ?? payload?.extendedGiftInfo?.type;
    const combo = Number(type) === 1 || (type === undefined && Object.hasOwn(payload || {}, 'repeatEnd'));
    return !combo || [true, 1, '1', 'true'].includes(payload.repeatEnd);
}

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function normalizeGift(payload, epoch, roomId = '') {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !terminalGift(payload)) return null;
    const profile = normalizeProfile(payload);
    const giftId = first([payload.giftId, payload.gift_id, payload.gift?.id, payload.gift?.giftId,
        payload.giftDetails?.id, payload.giftDetails?.giftId, payload.extendedGiftInfo?.id], numericId);
    const msgId = first([payload.common?.msgId, payload.msgId, payload.event?.msgId, payload.eventId], identifier);
    if (!profile.username || !profile.senderId || !giftId || !msgId) return null;
    const rawCount = payload.repeatCount ?? 1;
    const repeatCount = typeof rawCount === 'number' || typeof rawCount === 'string' ? Number(rawCount) : NaN;
    if (!Number.isSafeInteger(repeatCount) || repeatCount < 1 || repeatCount > 2147483647) return null;
    const eventId = hash(['message', msgId, profile.senderId, giftId]);
    const keys = [eventId];
    const groupId = identifier(payload.groupId ?? payload.gift?.groupId);
    // A native combo group survives changes to the terminal message ID on reconnect.
    if (groupId) keys.push(hash(['combo', String(roomId), groupId, profile.senderId, giftId]));
    return {
        event: { kind: 'gift', epoch: String(epoch), username: profile.username,
            nickname: profile.nickname, giftId, repeatCount, eventId, avatarFile: '' },
        keys, profile
    };
}

function normalizeAudience(type, payload, epoch, roomId = '') {
    if (!['like', 'follow'].includes(type) || !payload || Array.isArray(payload)) return null;
    const profile = normalizeProfile(payload);
    const msgId = first([payload.common?.msgId, payload.msgId, payload.eventId], identifier);
    if (!profile.username || !msgId) return null;
    const rawCount = type === 'like' ? payload.likeCount ?? payload.like_count ?? payload.count : 1;
    const count = typeof rawCount === 'number' || typeof rawCount === 'string' ? Number(rawCount) : NaN;
    if (!Number.isSafeInteger(count) || count < 1 || count > 2147483647) return null;
    const eventId = hash([type, String(roomId), profile.senderId, msgId]);
    return { event: { kind: type, epoch: String(epoch), username: profile.username, nickname: profile.nickname,
        eventId, likeCount: type === 'like' ? count : 0 }, keys: [eventId], profile };
}

class CommandCursor {
    constructor(bootCommand) {
        this.seq = Number.isSafeInteger(bootCommand?.seq) && bootCommand.seq >= 0 ? bootCommand.seq : -1;
    }

    take(value) {
        if (!value || !Number.isSafeInteger(value.seq) || value.seq < 0 || value.seq <= this.seq) return null;
        this.seq = value.seq;
        if (!['connect', 'disconnect', 'shutdown'].includes(value.op) || typeof value.username !== 'string') {
            return { seq: value.seq, op: 'invalid', username: '' };
        }
        return { seq: value.seq, op: value.op, username: username(value.username) };
    }
}

module.exports = { username, identifier, numericId, normalizeProfile, terminalGift, normalizeGift, normalizeAudience, CommandCursor };
