'use strict';

const { normalizeNativePKEvent, readNativeScores } = require('./pk-notifications.cjs');
const { collectProfiles } = require('./pk-profiles.cjs');
const id = value => (typeof value !== 'number' || Number.isSafeInteger(value)) &&
    ['string', 'number', 'bigint'].includes(typeof value) && /^[1-9]\d{0,31}$/.test(String(value)) ? String(value) : '';
// Transport receipts belong to the in-memory channel state, not the wire snapshot.
const histories = new WeakMap();
const TTL = 300000;
const PROFILE_METHODS = new Set(['WebcastLinkMicMethod', 'WebcastLinkLayerMessage', 'WebcastLinkMicLayoutStateMessage']);
function ordered(rows, previous = [], preferredId = '') {
    const positions = new Map(previous.map((row, i) => [row.id, i]));
    const result = rows.sort((a, b) => (positions.get(a.id) ?? 99) - (positions.get(b.id) ?? 99));
    if (!previous.length && preferredId) {
        const preferredIndex = result.findIndex(row => row.id === preferredId);
        if (preferredIndex > 0) result.unshift(...result.splice(preferredIndex, 1));
    }
    return result;
}
function legacyScores(message) {
    const scores = readNativeScores(message);
    if (scores || !Array.isArray(message.teamArmies) || message.teamArmies.length !== 2 ||
        message.teamArmies.some(team => !team || id(team.teamId) || !Array.isArray(team.teamUser))) return scores;
    // Older adapters omit team IDs. Retain explicit member scores, without inventing teams.
    const members = readNativeScores({ armies: message.teamArmies.flatMap(team => team.teamUser.map(user => ({
        key: user?.userIdStr && user.userIdStr !== '0' ? user.userIdStr : user?.userId,
        value: { anchorIdStr: user?.userId, hostscore: user?.score } }))) });
    return members ? { players: members.players, teams: [] } : null;
}
function refreshProfiles(previous, message) {
    if (!previous?.players.length) return previous || null;
    const updates = collectProfiles(message), profiles = new Map((previous.profiles || []).map(p => [p.id, p]));
    let changed = false;
    const players = previous.players.map(player => {
        const profile = updates.get(player.id);
        if (!profile) return player;
        const username = profile.username || player.username, nickname = profile.nickname || player.nickname,
            avatar = profile.avatar || player.avatar;
        if (username === player.username && nickname === player.nickname && avatar === player.avatar) return player;
        changed = true;
        profiles.set(player.id, { id: player.id, username, nickname, avatar });
        return { ...player, username, nickname, avatar };
    });
    if (!changed) return previous;
    const state = { ...previous, players, profiles: [...profiles.values()] };
    const history = histories.get(previous);
    if (history) histories.set(state, history);
    return state;
}
function updatePK(previous, message, now = Date.now(), ownerUsername = '') {
    if (!message || typeof message !== 'object' || Array.isArray(message)) return previous || null;
    const method = message.common?.method;
    if (PROFILE_METHODS.has(method) || !method && Array.isArray(message.profileUsers) && !message.battleId)
        return refreshProfiles(previous, message);
    if (method && !['WebcastLinkMicBattle', 'WebcastLinkMicArmies'].includes(method)) return previous || null;
    // Studio enriches anchorsInfo with its channel cache; validate those separately.
    const native = method ? normalizeNativePKEvent('pk', { ...message, anchorsInfo: [] }) : null;
    if (method && !native) return previous || null;
    const battleId = native?.battleId || id(message.battleId || message.battleSettings?.battleId);
    if (!battleId || !native && message.battleId && message.battleSettings?.battleId &&
        id(message.battleSettings.battleId) !== battleId) return previous || null;
    const same = previous?.battleId === battleId;
    const settings = message.battleSettings;
    const explicitStatus = settings && Number.isInteger(settings.status) ? settings.status : null;
    const status = native?.data.status || (explicitStatus === 0 ? 'waiting' : explicitStatus === 1 ? 'active' :
        [2, 3, 4].includes(explicitStatus) ? 'finished' : same ? previous.status || 'active' : 'active');
    if (same && previous.status === 'finished' && (native ? native.data.status !== 'finished' : ![2, 3, 4].includes(explicitStatus))) return previous;
    if (same && (previous.status === 'finished' && status !== 'finished' ||
        previous.status === 'active' && status === 'waiting')) return previous;
    const history = previous && histories.get(previous) || { receipts: new Map(), retired: new Map() };
    for (const entries of [history.receipts, history.retired]) for (const [key, expiry] of entries) if (expiry <= now) entries.delete(key);
    const receipt = native ? battleId + ':' + native.receiptId : '';
    if (history.retired.has(battleId) || receipt && history.receipts.has(receipt)) return previous || null;
    if (native && (native.occurredAt > now || native.occurredAt <= now - TTL || native.data.scoreAt > now)) return previous || null;
    const rawStamp = Number(message.updateBattleScoreTime || message.common?.createTime || 0);
    const stamp = native ? native.occurredAt : rawStamp && rawStamp < 1000000000000 ? rawStamp * 1000 : rawStamp;
    const scoreTime = native?.data.scoreAt || stamp;
    if (previous && stamp && previous.sourceTime > stamp) return previous;
    const scores = native?.data || legacyScores(message);
    if (!scores && previous) return previous;
    const rows = scores?.players || [];
    if (same && rows.length && (previous.scoreTime > scoreTime || previous.players.length &&
        (rows.length !== previous.players.length || rows.some(row => !previous.players.some(p => p.id === row.id))))) return previous;
    if (receipt && history.receipts.size >= 2048 || !same && previous && history.retired.size >= 32) return previous || null;
    const end = native ? native.data.endsAt : Number(settings?.endTimeMs || 0) || Number(settings?.startTimeMs || 0) + Number(settings?.duration || 0) * 1000;
    const lifecycle = { status, seenAt: now, endsAt: end > 1000000000000 ? end : same ? previous.endsAt || 0 : 0,
        finishedAt: status === 'finished' ? same && previous.finishedAt || now : 0 };
    const profiles = new Map(same ? (previous.profiles || previous.players || []).map(p => [p.id, p]) : []);
    collectProfiles({ anchorsInfo: message.anchorsInfo }, profiles);
    const cleanUsername = value => String(value || '').trim().replace(/^@/, '').toLowerCase();
    const owner = cleanUsername(ownerUsername);
    const ownerId = owner ? [...profiles.values()].find(profile => cleanUsername(profile.username) === owner)?.id || '' : '';
    const nextPlayers = rows.length ? ordered(rows.map(p => ({ ...profiles.get(p.id), ...p })), same ? previous.players : [], ownerId)
        : same ? previous.players.map(p => ({ ...p, ...profiles.get(p.id), score: p.score })) : [];
    const nextTeams = rows.length ? scores.teams.map(team => {
        const memberIds = [...team.memberIds];
        const ownerIndex = ownerId ? memberIds.indexOf(ownerId) : -1;
        if (ownerIndex > 0) memberIds.unshift(...memberIds.splice(ownerIndex, 1));
        return { ...team, memberIds, updatedAt: now };
    }) : [];
    const ownerTeamId = ownerId ? nextTeams.find(team => team.memberIds.includes(ownerId))?.id || '' : '';
    const next = { battleId, profiles: [...profiles.values()], ...lifecycle,
        players: status === 'waiting' ? [] : nextPlayers,
        teams: status === 'waiting' ? [] : rows.length ? ordered(nextTeams, same ? previous.teams : [], ownerTeamId)
            : same ? previous.teams || [] : [],
        updatedAt: rows.length ? now : same ? previous.updatedAt : 0,
        scoreTime: rows.length ? scoreTime : same ? previous.scoreTime : 0,
        sourceTime: stamp || (same ? previous.sourceTime : 0) };
    if (receipt) history.receipts.set(receipt, native.occurredAt + TTL);
    if (!same && previous) history.retired.set(previous.battleId, now + TTL);
    histories.set(next, history);
    return next;
}
function visiblePK(state, now = Date.now()) {
    if (!state) return null;
    if (state.status === 'finished' && now - state.finishedAt > 15000 ||
        state.endsAt > 0 && now > state.endsAt + 15000 ||
        now - (state.seenAt || state.updatedAt || 0) > 300000) return null;
    if (now - state.updatedAt >= 30000) return { ...state, players: state.players.map(player => ({ ...player, score: null })), teams: [] };
    return state;
}
module.exports = { updatePK, visiblePK };
