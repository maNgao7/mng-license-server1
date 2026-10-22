'use strict';

const username = value => String(value || '').trim().replace(/^@/, '').toLowerCase();
const MODES = new Set(['all', 'gift', 'follow', 'gift-or-follow', 'selected']);

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
            const user = username(payload.username || payload.uniqueId);
            if (mode === 'selected') return Boolean(user) && String(settings.allowedUsers || '').split(/[\s,;]+/).map(username).includes(user);
            const record = viewers.get(user);
            const gifted = Boolean(record?.gifts.has(String(settings.giftId || '')));
            return mode === 'gift' ? gifted : mode === 'follow' ? Boolean(record?.followed) : gifted || Boolean(record?.followed);
        },
        clear() { viewers.clear(); }
    };
}

module.exports = { createSpeechAudience, MODES };
