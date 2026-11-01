'use strict';
const identity = value => String(value || '').trim().replace(/^@/, '').toLowerCase();
const keyFor = item => JSON.stringify([identity(item.username), String(item.giftId || '').trim() || identity(item.giftName)]);
const positive = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Number(value))) : 0;

function topGiftState(value = {}) {
    if (value.schemaVersion === 3 && Array.isArray(value.candidates)) return value;
    const rows = Array.isArray(value.candidates) ? value.candidates : Object.values(value);
    const candidates = rows.filter(item => item && typeof item === 'object' && item.username).map(item => {
        const count = Math.max(1, positive(item.count ?? item.repeatCount));
        const totalCoins = positive(item.totalCoins ?? item.coins);
        const unitCoins = positive(item.unitCoins ?? item.diamondCount ?? totalCoins / count);
        return { ...item, count, repeatCount: count, coins: unitCoins, unitCoins, totalCoins };
    });
    // Prefer the old incumbent on equal unit prices when migrating saved rankings.
    const incumbent = candidates.find(item => value.champion && keyFor(item) === keyFor(value.champion));
    const champion = candidates.reduce((best, item) => !best || item.unitCoins > best.unitCoins ? item : best, incumbent || null);
    return { schemaVersion: 3, champion, candidates };
}

function recordTopGift(value, payload, { now = Date.now(), limit = 5000 } = {}) {
    const state = topGiftState(value);
    const totalCoins = positive(payload.coins ?? payload.totalCoins);
    const count = Math.max(1, positive(payload.count ?? payload.repeatCount));
    const unitCoins = positive(payload.unitCoins ?? payload.diamondCount ?? totalCoins / count);
    if (!totalCoins || !unitCoins || !identity(payload.username)) return state;
    if (Number(payload.giftType) === 1 && ![true, 1, '1', 'true'].includes(payload.repeatEnd)) return state;
    const key = keyFor(payload);
    const previous = state.candidates.find(item => keyFor(item) === key);
    const next = { ...previous, ...payload, coins: unitCoins, unitCoins,
        totalCoins: Math.min(Number.MAX_SAFE_INTEGER, positive(previous?.totalCoins) + totalCoins),
        count: Math.min(Number.MAX_SAFE_INTEGER, positive(previous?.count) + count), updatedAt: now };
    next.repeatCount = next.count;
    const candidates = state.candidates.filter(item => keyFor(item) !== key);
    candidates.push(next);
    // Repeats do not raise gift value; equal prices keep the existing leader.
    const champion = !state.champion || next.unitCoins > state.champion.unitCoins || keyFor(state.champion) === key
        ? next : state.champion;
    if (candidates.length > limit) candidates.sort((a, b) => positive(b.coins) - positive(a.coins)).splice(limit);
    return { schemaVersion: 3, champion, candidates };
}
module.exports = { recordTopGift, topGiftState };
