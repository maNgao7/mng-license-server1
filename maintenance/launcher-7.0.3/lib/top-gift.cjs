'use strict';
const identity = value => String(value || '').trim().replace(/^@/, '').toLowerCase();
const keyFor = item => JSON.stringify([identity(item.username), String(item.giftId || '').trim() || identity(item.giftName)]);
const positive = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Number(value))) : 0;

function topGiftState(value = {}) {
    if (value.schemaVersion === 2 && Array.isArray(value.candidates)) return value;
    const champion = Object.values(value).filter(item => item && typeof item === 'object' && item.username)
        .sort((a, b) => positive(b.coins ?? b.totalCoins) - positive(a.coins ?? a.totalCoins))[0] || null;
    return { schemaVersion: 2, champion, candidates: champion ? [champion] : [] };
}

function recordTopGift(value, payload, { now = Date.now(), limit = 5000 } = {}) {
    const state = topGiftState(value);
    const coins = positive(payload.coins ?? payload.totalCoins);
    if (!coins || !identity(payload.username)) return state;
    if (Number(payload.giftType) === 1 && ![true, 1, '1', 'true'].includes(payload.repeatEnd)) return state;
    const key = keyFor(payload);
    const previous = state.candidates.find(item => keyFor(item) === key);
    const next = { ...previous, ...payload, coins: Math.min(Number.MAX_SAFE_INTEGER, positive(previous?.coins) + coins),
        count: Math.min(Number.MAX_SAFE_INTEGER, positive(previous?.count) + Math.max(1, positive(payload.count ?? payload.repeatCount))), updatedAt: now };
    next.totalCoins = next.coins;
    next.repeatCount = next.count;
    const candidates = state.candidates.filter(item => keyFor(item) !== key);
    candidates.push(next);
    // A tie keeps the incumbent; an additional gift must actually exceed it.
    const champion = !state.champion || next.coins > positive(state.champion.coins ?? state.champion.totalCoins) ? next : state.champion;
    if (candidates.length > limit) candidates.sort((a, b) => positive(b.coins) - positive(a.coins)).splice(limit);
    return { schemaVersion: 2, champion, candidates };
}
module.exports = { recordTopGift, topGiftState };
