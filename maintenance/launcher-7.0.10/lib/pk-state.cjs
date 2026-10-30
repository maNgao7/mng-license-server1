'use strict';

const id = value => /^[1-9]\d{0,24}$/.test(String(value || '')) ? String(value) : '';
const score = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
function ordered(rows, previous = []) {
    const positions = new Map(previous.map((row, i) => [row.id, i]));
    return rows.sort((a, b) => (positions.get(a.id) ?? 99) - (positions.get(b.id) ?? 99));
}
function readTeams(message, players, previous, now) {
    const groups = Array.isArray(message.teamArmies) ? message.teamArmies : [];
    if (!groups.length && players.length === 2) return ordered(players.map(player => ({ id: 'host:' + player.id,
        memberIds: [player.id], score: player.score, scoreSource: 'host', updatedAt: now })), previous);
    if (groups.length !== 2) return null;
    const teams = [], seen = new Set(), available = new Set(players.map(player => player.id));
    for (const group of groups) {
        const members = Array.isArray(group.teamUser) ? group.teamUser : [];
        if (members.length < 1 || members.length > 2) return null;
        const memberIds = members.map(member => id(member.userIdStr || member.userId));
        if (new Set(memberIds).size !== memberIds.length) return null;
        if (memberIds.some(member => !member || seen.has(member) || !available.has(member))) return null;
        for (const member of memberIds) seen.add(member);
        const total = score(group.teamTotalScore);
        if (total === null) return null;
        teams.push({ id: id(group.teamId) || 'members:' + [...memberIds].sort().join(','), memberIds,
            score: total, scoreSource: 'teamTotalScore', updatedAt: now });
    }
    if (seen.size !== players.length || new Set(teams.map(team => team.id)).size !== 2) return null;
    return ordered(teams, previous);
}
function updatePK(previous, message, now = Date.now()) {
    const battleId = id(message.battleId || message.battleSettings?.battleId);
    if (!battleId) return previous || null;
    const same = previous?.battleId === battleId;
    const settings = message.battleSettings;
    const explicitStatus = settings && Number.isInteger(settings.status) ? settings.status : null;
    const status = explicitStatus === 0 ? 'waiting' : explicitStatus === 1 ? 'active' :
        [2, 3, 4].includes(explicitStatus) ? 'finished' : same ? previous.status || 'active' : 'active';
    const end = Number(settings?.endTimeMs || 0);
    const lifecycle = { status, seenAt: now, endsAt: end > 1000000000000 ? end : same ? previous.endsAt || 0 : 0,
        finishedAt: status === 'finished' ? same && previous.finishedAt || now : 0 };
    const stamp = Number(message.updateBattleScoreTime || message.common?.createTime || 0);
    if (same && stamp && previous.sourceTime > stamp) return previous;
    const profiles = new Map(same ? (previous.profiles || previous.players || []).map(p => [p.id, p]) : []);
    for (const row of (Array.isArray(message.anchorsInfo) ? message.anchorsInfo : [])) {
        const user = row.value?.user, key = id(user?.userId || row.key);
        if (key && user) profiles.set(key, { id: key, username: user.displayId || '', nickname: user.nickName || '',
            avatar: (user.avatarThumb?.urlList || []).find(url => /^https:\/\//i.test(url)) || '' });
    }
    const players = new Map();
    function add(key, value) {
        key = id(key); const count = score(value);
        if (key && count !== null) players.set(key, { ...profiles.get(key), id: key, score: count });
    }
    // Host totals, not supporter scores or team totals, are the official PK score.
    for (const [key, value] of Object.entries(message.armies || {})) {
        if (Array.isArray(message.armies)) add(value.key, value.value?.hostscore);
        else add(value.anchorIdStr || key, value.hostscore);
    }
    for (const team of (Array.isArray(message.teamArmies) ? message.teamArmies : [])) for (const host of (Array.isArray(team.teamUser) ? team.teamUser : [])) add(host.userIdStr || host.userId, host.score);
    if (players.size !== 2 && players.size !== 4) return { battleId, profiles: [...profiles.values()], ...lifecycle,
        players: same && status !== 'waiting' ? previous.players.map(p => ({...p,...profiles.get(p.id),score:p.score})) : [],
        teams: same && status !== 'waiting' ? previous.teams || [] : [],
        updatedAt: same ? previous.updatedAt : 0, sourceTime: same ? previous.sourceTime : 0 };
    const nextPlayers = ordered([...players.values()], same ? previous.players : []);
    const teams = readTeams(message, nextPlayers, same ? previous.teams : [], now);
    return { battleId, profiles: [...profiles.values()], ...lifecycle,
        players: status === 'waiting' ? [] : nextPlayers,
        teams: status === 'waiting' ? [] : teams || (same ? previous.teams || [] : []),
        updatedAt: now, sourceTime: stamp || (same ? previous.sourceTime : 0) };
}
function visiblePK(state, now = Date.now()) {
    if (!state) return null;
    if (state.status === 'finished' && now - state.finishedAt > 15000 ||
        state.endsAt > 0 && now > state.endsAt + 15000 ||
        now - (state.seenAt || state.updatedAt || 0) > 300000) return null;
    if (state.players?.length === 4 && state.teams?.some(team => now - team.updatedAt > 30000)) return { ...state, teams: [] };
    return state;
}
module.exports = { updatePK, visiblePK };
