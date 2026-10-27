'use strict';

const username = value => String(value || '').trim().replace(/^@/, '').toLowerCase();
const MODES = new Set(['all', 'gift', 'follow', 'gift-or-follow', 'selected', 'fanclub']);

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const owns = (value, key) => object(value) && Object.prototype.hasOwnProperty.call(value, key);
function levelNumber(value, allowString = false) {
    if (allowString && typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) value = Number(value);
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

// Connector 2.4.4 imports tiktok-live-proto/v3. Its User has FansClubInfo.fansLevel
// (int64 string) and FansClubMember.data.{level,userFansClubStatus}; status 1 is
// ACTIVE, 0 NOT_JOINED, 2 INACTIVE. Never infer club membership from other badges.
// Backend profile contract: fanClubLevel: number | null, derived here from the
// current, trusted connector event. null is unknown; 0 is explicitly ineligible.
function extractFanClubLevel(payload = {}) {
    if (!object(payload)) return null;
    const user = owns(payload, 'user') && object(payload.user) ? payload.user : payload;
    const levels = [];
    if (owns(user, 'fansClubInfo') && user.fansClubInfo != null) {
        const info = user.fansClubInfo;
        if (!object(info)) levels.push(null);
        else if (owns(info, 'isSleeping') && info.isSleeping === true) levels.push(0);
        else if (owns(info, 'isSleeping') && typeof info.isSleeping !== 'boolean') levels.push(null);
        else levels.push(owns(info, 'fansLevel') ? levelNumber(info.fansLevel, true) : null);
    }
    if (owns(user, 'fansClub') && user.fansClub != null) {
        const data = owns(user.fansClub, 'data') ? user.fansClub.data : null;
        if (!object(data)) levels.push(null);
        else if (owns(data, 'userFansClubStatus') && [0, 2].includes(data.userFansClubStatus)) levels.push(0);
        else if (!owns(data, 'userFansClubStatus') || data.userFansClubStatus !== 1) levels.push(null);
        else levels.push(owns(data, 'level') ? levelNumber(data.level) : null);
    }
    // Current raw evidence takes precedence over a stale normalized field.
    if (levels.includes(0)) return 0;
    if (levels.includes(null)) return null;
    if (levels.length) return Math.min(...levels);
    return owns(payload, 'fanClubLevel') ? levelNumber(payload.fanClubLevel) : null;
}

function createSpeechAudience({ limit = 10000 } = {}) {
    let channel = '';
    const viewers = new Map();
    let selectedGift = null;
    function select(value) {
        const next = username(value);
        if (next !== channel) { channel = next; viewers.clear(); }
    }
    return {
        configure(settings = {}) {
            const next = String(settings.giftId || '7934');
            if (selectedGift !== null && next !== selectedGift) for (const record of viewers.values()) record.gifts.clear();
            selectedGift = next;
        },
        observe(type, payload = {}, activeChannel = '') {
            select(activeChannel);
            if (type !== 'gift' && type !== 'follow') return;
            const user = username(payload.username || payload.uniqueId);
            if (!user) return;
            const record = viewers.get(user) || { followed: false, gifts: new Set() };
            if (type === 'follow') record.followed = true;
            if (type === 'gift' && /^\d{1,20}$/.test(String(payload.giftId || ''))) {
                const streak = Number(payload.giftType) === 1;
                if (streak && ![true, 1, '1', 'true'].includes(payload.repeatEnd)) return;
                record.gifts.add(String(payload.giftId));
                if (record.gifts.size > 128) record.gifts.delete(record.gifts.values().next().value);
            }
            viewers.delete(user);viewers.set(user, record);
            if (viewers.size > limit) viewers.delete(viewers.keys().next().value);
        },
        allows(payload = {}, settings = {}, activeChannel = '') {
            select(activeChannel);
            const mode = MODES.has(settings.audience) ? settings.audience : 'all';
            if (mode === 'all') return true;
            if (mode === 'fanclub') {
                const user = username(payload.username || payload.uniqueId || payload.user?.uniqueId || payload.user?.displayId);
                // No cache: absent metadata cannot re-use a prior membership grant.
                return Boolean(user) && extractFanClubLevel(payload) > 0;
            }
            const user = username(payload.username || payload.uniqueId);
            if (mode === 'selected') return Boolean(user) && String(settings.allowedUsers || '').split(/[\s,;]+/).map(username).includes(user);
            const record = viewers.get(user);
            const gifted = Boolean(record?.gifts.has(String(settings.giftId || '')));
            return mode === 'gift' ? gifted : mode === 'follow' ? Boolean(record?.followed) : gifted || Boolean(record?.followed);
        },
        clear() { viewers.clear(); }
    };
}

module.exports = { createSpeechAudience, MODES, extractFanClubLevel };
