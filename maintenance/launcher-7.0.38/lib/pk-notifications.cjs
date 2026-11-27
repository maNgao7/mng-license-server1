'use strict';

/**
 * One combined PK stage per lane; one factory per publisher/live session.
 * No SDK import, network, profile store, timers or persistence.
 *
 * Verified locally against tiktok-live-connector 2.4.4 / tiktok-live-proto 0.2.4:
 * - v3 WebcastLinkMicBattle: armies[{key,value.hostscore}], anchorsInfo,
 *   battleSettings, battleResult, teamBattleResult; WebcastLinkMicArmies: armies[id].hostscore,
 *   teamArmies[].{teamId,teamTotalScore,teamUser[{userId,userIdStr,score}]}.
 * - BattleSettingsBattleStatus: 0 waiting, 1 active, 2/3/4 finished;
 *   LinkMicBattleBattleAction: 4 OPEN, 5 FINISH. BattleResultResult: 0 WIN,
 *   1 LOSE, 2 DRAW. Only complete, explicit result sets announce a winner.
 *   A normally finished team result can identify the winning team by its
 *   settled totals. The untyped BattleTeamResult.result codes are ignored.
 * - Item-card types 2 and 12 describe Boosting Glove and Vault Glove use.
 *   Only explicit effectTimeSec and effectLastDuration can time that use.
 * - live-session.cjs forwards battle/armies/item-card/task as 'pk'; common.method
 *   must retain the exact Webcast method.
 *   Direct SDK listeners may pass 'linkMicBattleItemCard' explicitly.
 * - Battle task START caches reward configuration only. Successful TASK_SETTLE
 *   requires the same room's configuration and an explicit reward start. The
 *   result can precede the start. Expiry uses the configured duration in seconds
 *   (at most 60), and REWARD_SETTLE clears only that room's reward.
 *   Generic boost-card IDs, free text, gifts and Tikfinity cannot activate it.
 *
 * Manual schema: { source:'preview'|'test', type, receiptId, battleId,
 * occurredAt:<epoch ms>, ... }. Types: snapshot (status, players, teams?,
 * endsAt?), glove (participantId, action:'arrival'|'used'), multiplier
 * (multiplier:2|3, participantId?), boost-start (boostId, multiplier:2|3,
 * expiresAt:<epoch ms>, participantId?), boost-end (boostId), round-winner
 * (winnerIds:[] for draw, or participant IDs). Manual scores/results always
 * remain tagged official:false and cannot change the native lane.
 *
 * Integration (existing modules deliberately not edited):
 *   const { createPKNotifications } = require('./lib/pk-notifications.cjs');
 *   const pk = createPKNotifications();
 *   const scope = pk.scope(); // capture when binding a session's listeners
 *   // in onEvent: if (type === 'pk') pk.ingestNative(type, payload, {scope});
 *   // publish alongside the existing PK state: pk.snapshot().live
 *   // poll snapshot() to expire boosts/notices and emit final-seconds once.
 *   // pk.reset() on session change; rebind with its returned scope.
 *
 * snapshot(): {schemaVersion,scope,live,preview,test}; lanes have players,
 * teams, status, endsAt, winner, critical, effects and notifications. Unknown
 * scores/end times/winners are null, never guessed. Score totals expire after
 * scoreTtlMs without new scores (profile/lifecycle packets cannot refresh them).
 * ingest* returns
 * {accepted,reason,receiptId?}; malformed events return invalid-event.
 *
 * Idempotency is scoped by source+battle+receipt, retained for receiptTtlMs.
 * Source timestamps older than that window are rejected even after eviction.
 * Receipt/battle capacity fails closed (no eviction of live receipts). Retired
 * battle IDs stay blocked for that same window. reset clears all lanes but
 * keeps receipts/tombstones; captured old scope tokens are rejected. Callers
 * MUST pass the captured scope on asynchronous callbacks to fence late work.
 */

const SCHEMA_VERSION = 1;
const { readProfile } = require('./pk-profiles.cjs');
const NATIVE_EVENTS = Object.freeze(['linkMicBattle', 'linkMicArmies', 'linkMicBattleItemCard', 'linkMicBattleTask']);
const METHODS = Object.freeze({ WebcastLinkMicBattle: 'linkMicBattle',
    WebcastLinkMicArmies: 'linkMicArmies', WebcastLinkMicBattleItemCard: 'linkMicBattleItemCard',
    WebcastLinkmicBattleTaskMessage: 'linkMicBattleTask' });
const MAX_NATIVE_EFFECT_LEAD_MS = 10000;
// TikTok's native event clock can be slightly ahead of the local clock.
const NATIVE_EFFECT_CLOCK_SKEW_MS = 1000;
const DEFAULTS = Object.freeze({ maxNotifications: 24, maxReceipts: 2048, maxBattles: 32,
    maxEffects: 8, notificationTtlMs: 8000, receiptTtlMs: 300000,
    stateTtlMs: 300000, scoreTtlMs: 30000, resultTtlMs: 15000, maxEffectMs: 60000, criticalSeconds: 10 });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const copy = value => structuredClone(value);
const text = (value, limit = 128) => typeof value === 'string' ? value.slice(0, limit) : '';
function identifier(value) {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) return '';
    if (!['string', 'number', 'bigint'].includes(typeof value)) return '';
    const key = String(value);
    return /^[1-9]\d{0,31}$/.test(key) ? key : '';
}
function receipt(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value) ? value : '';
}
function integer(value) {
    if (typeof value !== 'number' && !(typeof value === 'string' && /^\d{1,16}$/.test(value))) return null;
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
}
function epoch(value, seconds = false) {
    const n = integer(value);
    if (!n) return null;
    const ms = seconds && n < 1000000000000 ? n * 1000 : n;
    return Number.isSafeInteger(ms) && ms >= 1000000000000 ? ms : null;
}
const missingId = value => value === undefined || value === null || value === '' || value === '0' || value === 0;
function matchingId(a, b) {
    const first = identifier(a), second = identifier(b);
    if (!first && !missingId(a) || !second && !missingId(b)) return '';
    return first && second && first !== second ? '' : first || second;
}
function ordered(rows, previous) {
    const positions = new Map(previous.map((row, index) => [row.id, index]));
    return rows.sort((a, b) => (positions.get(a.id) ?? 99) - (positions.get(b.id) ?? 99));
}
function sameRoster(a, b) {
    return a.length === b.length && a.every(row => b.some(other => row.id === other.id));
}
function readNativeScores(message) {
    const players = [], teams = [], seen = new Set();
    function add(key, value) {
        const id = identifier(key), score = integer(value);
        if (!id || score === null || seen.has(id)) return false;
        seen.add(id); players.push({ id, score }); return true;
    }
    if (message.teamArmies !== undefined && !Array.isArray(message.teamArmies)) return null;
    if (message.teamArmies?.length) {
        if (message.teamArmies.length !== 2) return null;
        for (const group of message.teamArmies) {
            if (!object(group) || !identifier(group.teamId) || integer(group.teamTotalScore) === null ||
                !Array.isArray(group.teamUser) || ![1, 2].includes(group.teamUser.length)) return null;
            const memberIds = [];
            for (const row of group.teamUser) {
                if (!object(row)) return null;
                const key = matchingId(row.userIdStr, row.userId);
                if (!add(key, row.score)) return null;
                memberIds.push(key);
            }
            teams.push({ id: identifier(group.teamId), memberIds, score: integer(group.teamTotalScore),
                scoreSource: 'teamTotalScore' });
        }
        if (teams[0].id === teams[1].id || teams[0].memberIds.length !== teams[1].memberIds.length) return null;
    } else if (message.armies !== undefined) {
        const rows = Array.isArray(message.armies) ? message.armies : object(message.armies) ? Object.entries(message.armies) : null;
        if (!rows || rows.length > 4) return null;
        for (const row of rows) {
            const key = Array.isArray(row) ? row[0] : row?.key;
            const value = Array.isArray(row) ? row[1] : row?.value;
            if (!object(value) || !add(matchingId(key, value.anchorIdStr), value.hostscore)) return null;
        }
    }
    if (players.length && ![2, 4].includes(players.length)) return null;
    if (players.length === 2 && !teams.length) for (const player of players) teams.push({
        id: 'host:' + player.id, memberIds: [player.id], score: player.score, scoreSource: 'hostscore' });
    return { players, teams };
}
function readWinner(message) {
    const teams = message.teamBattleResult;
    if (teams !== undefined && !Array.isArray(teams)) return undefined;
    if (teams?.length) {
        if (teams.length !== 2) return undefined;
        const ids = new Set(), members = new Set();
        for (const team of teams) {
            if (!object(team) || !identifier(team.teamId) || ids.has(String(team.teamId)) ||
                !Number.isSafeInteger(team.result) || integer(team.totalScore) === null ||
                !Array.isArray(team.teamUser) || ![1, 2].includes(team.teamUser.length)) return undefined;
            ids.add(String(team.teamId));
            for (const row of team.teamUser) {
                const id = matchingId(row?.userIdStr, row?.userId);
                if (!id || members.has(id)) return undefined;
                members.add(id);
            }
        }
        return null;
    }
    if (message.battleResult !== undefined && !object(message.battleResult)) return undefined;
    const rows = Object.entries(message.battleResult || {});
    if (!rows.length) return null;
    if (![2, 4].includes(rows.length)) return undefined;
    for (const [key, value] of rows) if (!object(value) || !matchingId(key, value.userId) ||
        ![0, 1, 2].includes(value.result) || integer(value.score) === null) return undefined;
    const wins = rows.filter(([, row]) => row.result === 0);
    if (wins.length === 1 && rows.every(([, row]) => row.result === 0 || row.result === 1)) return {
        kind: 'participant', ids: [wins[0][0]], evidence: 'battleResult', official: true };
    if (rows.every(([, row]) => row.result === 2)) return { kind: 'draw', ids: [], evidence: 'battleResult', official: true };
    return undefined;
}

function normalizeNativePKEvent(eventName, message, { receiptId } = {}) {
    if (!object(message)) return null;
    const method = message.common?.method;
    if (eventName === 'pk') eventName = Object.hasOwn(METHODS, method) ? METHODS[method] : '';
    if (!NATIVE_EVENTS.includes(eventName) || (method && METHODS[method] !== eventName)) return null;
    const battleId = matchingId(message.battleId, message.battleSettings?.battleId);
    const eventId = identifier(message.common?.msgId) || receipt(receiptId);
    const occurredAt = epoch(message.common?.createTime, true);
    if (!battleId || !eventId || !occurredAt) return null;
    const base = { source: 'native', battleId, receiptId: eventId, occurredAt };
    if (eventName === 'linkMicBattleTask') {
        const roomId = identifier(message.common?.roomId);
        if (!roomId) return null;
        if (message.taskMessageType === 0) {
            const reward = message.start?.config?.rewardConfig;
            const duration = integer(reward?.duration), multiplier = reward?.rewardMultiple;
            return duration > 0 && duration <= 60 && [2, 3].includes(multiplier)
                ? { ...base, roomId, kind: 'bonus-config', data: { duration: duration * 1000, multiplier } } : null;
        }
        if (message.taskMessageType === 2) {
            const settle = message.taskSettle;
            const startsAt = epoch(settle?.rewardStartTimestamp, true) || epoch(settle?.rewardStartTime, true);
            return [0, 2].includes(settle?.result) && startsAt && startsAt <= occurredAt + MAX_NATIVE_EFFECT_LEAD_MS
                ? { ...base, roomId, kind: 'bonus-activate', data: { startsAt } } : null;
        }
        return message.taskMessageType === 3 ? { ...base, roomId, kind: 'bonus-clear', data: {} } : null;
    }
    if (eventName === 'linkMicBattleItemCard') {
        const evidence = { 2: 'useCriticalStrikeCard', 12: 'useVaultGloveCard' }[message.msgType];
        if (!Number.isInteger(message.msgType) || !evidence) return null;
        const card = message[evidence], info = message.msgType === 2 ? card?.cardInfo : card?.cardInfo?.common;
        const target = matchingId(info?.toAnchorIdStr, info?.toAnchorId);
        const participantId = matchingId(target, card?.anchorId);
        if (!object(info) || !participantId || !target && (!missingId(info.toAnchorIdStr) || !missingId(info.toAnchorId))) return null;
        const data = { participantId, action: 'used', evidence };
        const seconds = integer(info.effectTimeSec), duration = integer(info.effectLastDuration);
        const startsAt = seconds && seconds < 1000000000000 ? epoch(seconds, true) : null;
        if (startsAt && startsAt <= occurredAt + MAX_NATIVE_EFFECT_LEAD_MS && duration > 0 && duration <= 60 && startsAt + duration * 1000 > occurredAt) {
            data.effectStartsAt = startsAt;
            data.effectExpiresAt = startsAt + duration * 1000;
        }
        return { ...base, kind: 'glove', data };
    }
    if (message.battleSettings !== undefined && !object(message.battleSettings)) return null;
    const settings = message.battleSettings;
    if (settings && ![0, 1, 2, 3, 4].includes(settings.status)) return null;
    let status = settings ? ['waiting', 'active', 'finished', 'finished', 'finished'][settings.status] : null;
    if (eventName === 'linkMicBattle' && message.action !== undefined) {
        if (!Number.isInteger(message.action) || message.action < 0 || message.action > 11) return null;
        const actionStatus = message.action === 4 ? 'active' : message.action === 5 ? 'finished' : null;
        if (status && actionStatus && status !== actionStatus) return null;
        status ||= actionStatus;
    }
    let endsAt = null;
    if (settings?.endTimeMs && settings.endTimeMs !== '0') {
        endsAt = epoch(settings.endTimeMs);
        if (!endsAt) return null;
    } else if (settings?.startTimeMs && settings.startTimeMs !== '0' && settings.duration) {
        const start = epoch(settings.startTimeMs), duration = integer(settings.duration);
        if (!start || !duration || duration > 86400) return null;
        endsAt = start + duration * 1000;
    }
    let scores = readNativeScores(message);
    if (!scores) return null;
    const profiles = [];
    if (message.anchorsInfo !== undefined && (!Array.isArray(message.anchorsInfo) || message.anchorsInfo.length > 4)) return null;
    for (const row of message.anchorsInfo || []) {
        const p = readProfile(row?.value?.user, row?.key);
        if (!p || profiles.some(other => other.id === p.id)) return null;
        profiles.push(p);
    }
    let winner = readWinner(message);
    const hasResults = Boolean(message.teamBattleResult?.length || Object.keys(message.battleResult || {}).length);
    if (winner === undefined || hasResults && (eventName !== 'linkMicBattle' || status !== 'finished')) return null;
    // Settlement can carry final totals without repeating armies.
    if (hasResults) {
        const results = message.teamBattleResult?.length ? readNativeScores({ teamArmies: message.teamBattleResult.map(row => ({
            teamId: row.teamId, teamUser: row.teamUser, teamTotalScore: row.totalScore })) })
            : readNativeScores({ armies: Object.fromEntries(Object.entries(message.battleResult).map(([key, row]) =>
                [key, { hostscore: row.score, anchorIdStr: row.userId }])) });
        if (!results || scores.players.length && !sameRoster(scores.players, results.players)) return null;
        for (const team of results.teams) team.scoreSource = message.teamBattleResult?.length
            ? 'teamBattleResult.totalScore' : 'battleResult.score';
        if (message.teamBattleResult?.length && (settings?.status === 2 || message.action === 5) &&
            ![3, 6, 11].includes(message.action) && results.teams.length === 2) {
            const [left, right] = results.teams;
            if (left.score !== right.score) winner = { kind: 'team', ids: [left.score > right.score ? left.id : right.id],
                evidence: 'teamBattleResult.totalScore', official: true };
        }
        scores = results;
    }
    const scoreAt = message.updateBattleScoreTime && message.updateBattleScoreTime !== '0'
        ? epoch(message.updateBattleScoreTime, true) : occurredAt;
    if (!scoreAt || (!status && !scores.players.length && !profiles.length && !winner)) return null;
    return { ...base, kind: 'snapshot', data: { ...scores, profiles, status, endsAt, winner, scoreAt } };
}

function normalizeManualPKEvent(message, { enabled = false, maxEffectMs = DEFAULTS.maxEffectMs } = {}) {
    if (enabled !== true || !object(message) || !['preview', 'test'].includes(message.source)) return null;
    const battleId = identifier(message.battleId), eventId = receipt(message.receiptId), occurredAt = epoch(message.occurredAt);
    if (!battleId || !eventId || !occurredAt) return null;
    const base = { source: message.source, battleId, receiptId: eventId, occurredAt, kind: message.type };
    const participantId = message.participantId === undefined ? null : identifier(message.participantId);
    if (participantId === '') return null;
    switch (message.type) {
    case 'snapshot': {
        if (!['waiting', 'active', 'finished'].includes(message.status) || !Array.isArray(message.players) ||
            ![2, 4].includes(message.players.length)) return null;
        const players = [], teams = [], seen = new Set();
        for (const row of message.players) {
            if (!object(row) || !identifier(row.id) || seen.has(String(row.id)) ||
                (row.score !== null && row.score !== undefined && integer(row.score) === null)) return null;
            const id = identifier(row.id); seen.add(id);
            players.push({ id, username: text(row.username, 64), nickname: text(row.nickname, 64),
                avatar: typeof row.avatar === 'string' && /^https:\/\//i.test(row.avatar) ? text(row.avatar, 2048) : '',
                score: row.score === undefined || row.score === null ? null : integer(row.score) });
        }
        if (message.teams !== undefined) {
            if (!Array.isArray(message.teams) || ![0, 2].includes(message.teams.length)) return null;
            const members = new Set();
            for (const team of message.teams) {
                if (!object(team) || !identifier(team.id) || integer(team.score) === null ||
                    !Array.isArray(team.memberIds) || team.memberIds.length !== players.length / 2) return null;
                const memberIds = team.memberIds.map(identifier);
                for (const id of memberIds) { if (!seen.has(id) || members.has(id)) return null; members.add(id); }
                teams.push({ id: identifier(team.id), memberIds, score: integer(team.score), scoreSource: 'manual' });
            }
            if (teams.length && teams[0].id === teams[1].id) return null;
        }
        const endsAt = message.endsAt === undefined || message.endsAt === null ? null : epoch(message.endsAt);
        if (message.endsAt != null && !endsAt) return null;
        return { ...base, data: { players, teams, profiles: [], status: message.status, endsAt, winner: null, scoreAt: occurredAt } };
    }
    case 'glove':
        return participantId && ['arrival', 'used'].includes(message.action)
            ? { ...base, data: { participantId, action: message.action, evidence: 'manual' } } : null;
    case 'multiplier':
        return [2, 3].includes(message.multiplier) ? { ...base, data: { participantId, multiplier: message.multiplier } } : null;
    case 'boost-start': {
        const boostId = receipt(message.boostId), expiresAt = epoch(message.expiresAt);
        return boostId && [2, 3].includes(message.multiplier) && expiresAt > occurredAt && expiresAt - occurredAt <= maxEffectMs
            ? { ...base, data: { boostId, participantId, multiplier: message.multiplier, expiresAt } } : null;
    }
    case 'boost-end':
        return receipt(message.boostId) ? { ...base, data: { boostId: message.boostId } } : null;
    case 'round-winner': {
        if (!Array.isArray(message.winnerIds) || message.winnerIds.length > 2) return null;
        const ids = message.winnerIds.map(identifier);
        return ids.every(Boolean) && new Set(ids).size === ids.length ? { ...base,
            data: { kind: ids.length ? 'participant' : 'draw', ids, evidence: 'manual', official: false } } : null;
    }
    default: return null;
    }
}

function createPKNotifications({ clock = Date, allowManual = false, ...options } = {}) {
    if (typeof allowManual !== 'boolean') throw new TypeError('allowManual must be a boolean');
    const config = { ...DEFAULTS };
    for (const key of Object.keys(options)) {
        const maximum = key.startsWith('max') ? key.endsWith('Ms') ? 86400000 : 10000 : 86400000;
        if (!Object.hasOwn(config, key) || !Number.isSafeInteger(options[key]) || options[key] < 1 || options[key] > maximum)
            throw new TypeError('Invalid PK notification option: ' + key);
        config[key] = options[key];
    }
    if (config.receiptTtlMs < Math.max(config.stateTtlMs, config.scoreTtlMs, config.resultTtlMs, config.maxEffectMs, config.notificationTtlMs))
        throw new TypeError('receiptTtlMs must cover state, results, effects and notifications');
    const readClock = typeof clock === 'function' && clock !== Date ? clock : () => clock.now();
    let lastNow = 0, generation = 0;
    const lanes = { native: null, preview: null, test: null }, receipts = new Map(), battles = new Map();
    const nativeProfiles = new Map();
    const bonusRooms = new WeakMap();
    const earlyBonuses = new Map();
    function now() {
        const value = readClock();
        if (!Number.isSafeInteger(value) || value < 1000000000000) throw new TypeError('clock must return epoch milliseconds');
        lastNow = Math.max(lastNow, value); return lastNow;
    }
    const battleKey = event => event.source + ':' + event.battleId;
    function notify(stage, kind, data, at, eventId, expiresAt = at + config.notificationTtlMs) {
        if (expiresAt <= lastNow) return;
        stage.notifications.push({ id: eventId + ':' + kind, receiptId: eventId, source: stage.source, official: stage.official,
            battleId: stage.battleId, scope: generation, kind, occurredAt: at, expiresAt, data: copy(data) });
        if (stage.notifications.length > config.maxNotifications) stage.notifications.shift();
    }
    function retire(stage, at) {
        if (!stage) return;
        battles.set(battleKey(stage), { retired: true, expiresAt: at + config.receiptTtlMs });
    }
    function startDueBonuses(stage, at) {
        for (const room of bonusRooms.get(stage)?.values() || []) {
            const effect = room.pending;
            if (!effect || effect.startsAt > at) continue;
            room.pending = null;
            const expiresAt = Math.min(effect.expiresAt, stage.endsAt ?? Infinity);
            if (stage.status !== 'active' || expiresAt <= at) continue;
            const active = { ...effect, expiresAt };
            stage.effects.push(active);
            notify(stage, 'boost-start', active, active.startsAt, active.receiptId,
                Math.min(active.expiresAt, active.startsAt + config.notificationTtlMs));
        }
    }
    function sweep(at) {
        for (const [key, expiresAt] of receipts) if (expiresAt <= at) receipts.delete(key);
        for (const [key, row] of battles) if (row.expiresAt <= at) battles.delete(key);
        for (const [key, entry] of earlyBonuses) if (entry.expiresAt <= at) earlyBonuses.delete(key);
        for (const source of Object.keys(lanes)) {
            const stage = lanes[source];
            if (!stage) continue;
            if (at >= stage.seenAt + config.stateTtlMs || stage.finishedAt !== null && at >= stage.finishedAt + config.resultTtlMs ||
                stage.endsAt !== null && at >= stage.endsAt + config.resultTtlMs) {
                retire(stage, at); lanes[source] = null; continue;
            }
            if (stage.scoresUpdatedAt !== null && at >= stage.scoresUpdatedAt + config.scoreTtlMs) {
                stage.players = stage.players.map(p => ({ ...p, score: null })); stage.teams = [];
                stage.scoresUpdatedAt = null;
            }
            stage.notifications = stage.notifications.filter(row => row.expiresAt > at);
            for (const effect of stage.effects.filter(row => row.expiresAt <= at)) notify(stage, 'boost-end',
                { boostId: effect.boostId, participantId: effect.participantId, reason: 'expired' }, effect.expiresAt,
                'expiry:' + effect.receiptId);
            stage.effects = stage.effects.filter(row => row.expiresAt > at);
            startDueBonuses(stage, at);
            const remaining = stage.endsAt === null ? null : Math.ceil((stage.endsAt - at) / 1000);
            stage.critical = stage.status === 'active' && remaining > 0 && remaining <= config.criticalSeconds
                ? { remainingSeconds: remaining, endsAt: stage.endsAt, evidence: 'announced-end-time' } : null;
            if (stage.critical && !stage.criticalAnnounced) {
                stage.criticalAnnounced = true;
                notify(stage, 'critical', stage.critical, at, 'critical:' + stage.battleId,
                    Math.min(stage.endsAt, at + config.notificationTtlMs));
            }
        }
    }
    function ingestBonus(stage, event, at, receiptKey, reject) {
        if (stage.status === 'finished') return reject('battle-finished');
        if (stage.status !== 'active' || stage.endsAt !== null && stage.endsAt <= at) return reject('battle-not-active');
        const rooms = bonusRooms.get(stage) || new Map();
        const room = rooms.get(event.roomId) || { sourceTime: 0, config: null, pending: null, lastStart: 0 };
        if (event.occurredAt < room.sourceTime) return reject('out-of-order');
        if (receipts.size >= config.maxReceipts || !rooms.has(event.roomId) && rooms.size >= config.maxEffects) return reject('capacity');
        if (event.kind === 'bonus-config') {
            room.config = { ...event.data, occurredAt: event.occurredAt };
        } else if (event.kind === 'bonus-clear') {
            room.config = room.pending = null;
            stage.effects = stage.effects.filter(row => row.roomId !== event.roomId);
            stage.notifications = stage.notifications.filter(row => row.kind !== 'boost-start' || row.data.roomId !== event.roomId);
        } else {
            const { startsAt } = event.data, reward = room.config;
            if (!reward || startsAt < reward.occurredAt) return reject('missing-bonus-config');
            if (startsAt <= room.lastStart || room.pending) return reject('boost-already-active');
            const expiresAt = startsAt + reward.duration, effectiveEnd = Math.min(expiresAt, stage.endsAt ?? Infinity);
            if (effectiveEnd <= Math.max(at, startsAt)) return reject('invalid-expiry');
            const pending = [...rooms.values()].filter(row => row.pending).length;
            if (pending + stage.effects.length >= config.maxEffects) return reject('capacity');
            room.lastStart = startsAt;
            room.pending = { boostId: 'bonus:' + event.roomId + ':' + startsAt, roomId: event.roomId,
                multiplier: reward.multiplier, startsAt, expiresAt, evidence: 'native-task-settle',
                receiptId: event.receiptId, source: 'native', official: true };
        }
        room.sourceTime = event.occurredAt;
        rooms.set(event.roomId, room); bonusRooms.set(stage, rooms);
        receipts.set(receiptKey, event.occurredAt + config.receiptTtlMs);
        startDueBonuses(stage, at);
        return { accepted: true, reason: 'accepted', receiptId: event.receiptId };
    }
    function ingest(event, context = {}) {
        const at = now(); sweep(at);
        const reject = reason => ({ accepted: false, reason, ...(event ? { receiptId: event.receiptId } : {}) });
        if (context.scope !== undefined && context.scope !== generation) return reject('scope-mismatch');
        if (!event) return reject('invalid-event');
        const nativeEffect = event.source === 'native' && (event.kind.startsWith('bonus-') || event.kind === 'glove');
        const ahead = nativeEffect ? NATIVE_EFFECT_CLOCK_SKEW_MS : 0;
        if (event.occurredAt > at + ahead || event.occurredAt <= at - config.receiptTtlMs) return reject('stale-event');
        const key = battleKey(event), receiptKey = key + ':' + event.receiptId;
        if (receipts.has(receiptKey) || earlyBonuses.has(receiptKey)) return reject('duplicate');
        if (battles.get(key)?.retired) return reject('battle-retired');
        let stage = lanes[event.source];
        const same = stage?.battleId === event.battleId;
        if (event.kind.startsWith('bonus-') && (!same || stage.status === 'waiting' || !stage.players.length && stage.status === 'active')) {
            if (earlyBonuses.size >= config.maxBattles * config.maxEffects) return reject('capacity');
            earlyBonuses.set(receiptKey, { event, expiresAt: event.occurredAt + config.receiptTtlMs });
            return { accepted: true, reason: 'waiting-for-battle', receiptId: event.receiptId };
        }
        if (!same && event.kind !== 'snapshot') return reject('missing-battle');
        if (event.kind.startsWith('bonus-')) return ingestBonus(stage, event, at, receiptKey, reject);
        if (stage && event.occurredAt < stage.sourceTime) return reject('out-of-order');
        if (same && stage.status === 'finished' && (event.kind !== 'snapshot' && event.kind !== 'round-winner' ||
            event.kind === 'snapshot' && event.data.status !== 'finished')) return reject('battle-finished');
        if (same && stage.status === 'active' && event.kind === 'snapshot' && event.data.status === 'waiting') return reject('out-of-order');
        if (same && event.kind === 'snapshot' && event.data.players.length && event.data.scoreAt < stage.scoreTime) return reject('out-of-order');
        if (event.kind === 'snapshot' && event.data.scoreAt > at) return reject('stale-event');
        if (same && event.kind === 'snapshot' && stage.players.length && event.data.players.length &&
            !sameRoster(stage.players, event.data.players)) return reject('roster-changed');
        const players = event.kind === 'snapshot' && event.data.players.length ? event.data.players : same ? stage.players : [];
        const winner = event.kind === 'round-winner' ? event.data : event.kind === 'snapshot' ? event.data.winner : null;
        if (winner && (winner.kind === 'participant' && winner.ids.some(id => !players.some(p => p.id === id)) ||
            winner.kind === 'team' && winner.ids.some(id => !event.data.teams.some(t => t.id === id)))) return reject('unknown-winner');
        if (winner && same && stage.winner) return reject('winner-already-set');
        if (event.kind === 'round-winner' && stage.status !== 'finished') return reject('battle-not-finished');
        if (!['snapshot', 'round-winner'].includes(event.kind)) {
            if (stage.status !== 'active' || stage.endsAt !== null && stage.endsAt <= at) return reject('battle-not-active');
            if (event.data.participantId && !players.some(p => p.id === event.data.participantId)) return reject('unknown-participant');
        }
        if (event.kind === 'boost-start' && (event.data.expiresAt <= at || stage.endsAt !== null && event.data.expiresAt > stage.endsAt)) return reject('invalid-expiry');
        if (event.kind === 'boost-start' && stage.effects.some(row => row.boostId === event.data.boostId)) return reject('boost-already-active');
        if (event.kind === 'boost-end' && !stage.effects.some(row => row.boostId === event.data.boostId)) return reject('unknown-boost');
        if (receipts.size >= config.maxReceipts || !battles.has(key) && battles.size >= config.maxBattles ||
            event.kind === 'boost-start' && stage.effects.length >= config.maxEffects) return reject('capacity');
        receipts.set(receiptKey, event.occurredAt + config.receiptTtlMs);
        if (!same) {
            retire(stage, at);
            stage = { battleId: event.battleId, source: event.source, official: event.source === 'native',
                status: 'unknown', players: [], teams: [], endsAt: null, winner: null, critical: null,
                criticalAnnounced: false, notifications: [], effects: [], sourceTime: 0, scoreTime: 0,
                seenAt: at, finishedAt: null, scoresUpdatedAt: null };
            lanes[event.source] = stage;
        }
        battles.set(key, { retired: false, expiresAt: at + config.receiptTtlMs });
        stage.sourceTime = event.occurredAt; stage.seenAt = at;
        if (event.kind === 'snapshot') {
            const data = event.data;
            if (event.source === 'native') for (const p of data.profiles) {
                const profile = { ...nativeProfiles.get(p.id), id: p.id };
                for (const key of ['username', 'nickname', 'avatar']) if (p[key]) profile[key] = p[key];
                nativeProfiles.set(p.id, profile);
                while (nativeProfiles.size > 500) nativeProfiles.delete(nativeProfiles.keys().next().value);
            }
            const before = JSON.stringify([stage.players.map(p => [p.id, p.score]), stage.teams]);
            if (data.players.length) {
                const previous = new Map(stage.players.map(p => [p.id, p]));
                stage.players = ordered(data.players.map(p => ({ ...(event.source === 'native' ? nativeProfiles.get(p.id) : {}),
                    ...previous.get(p.id), ...p })), stage.players);
                stage.teams = ordered(copy(data.teams), stage.teams); stage.scoreTime = data.scoreAt;
                stage.scoresUpdatedAt = at;
            }
            for (const p of data.profiles) {
                const player = stage.players.find(row => row.id === p.id);
                if (player) for (const key of ['username', 'nickname', 'avatar']) if (p[key]) player[key] = p[key];
            }
            if (!stage.players.length && [2, 4].includes(data.profiles.length)) stage.players = data.profiles.map(p => ({
                ...(event.source === 'native' ? nativeProfiles.get(p.id) : p), id: p.id, score: null }));
            stage.status = data.status || stage.status;
            if (data.endsAt !== null) stage.endsAt = data.endsAt;
            if (stage.endsAt !== null) for (const effect of stage.effects) effect.expiresAt = Math.min(effect.expiresAt, stage.endsAt);
            if (stage.status === 'waiting') {
                stage.players = stage.players.map(p => ({ ...p, score: null })); stage.teams = [];
            }
            if (stage.status === 'finished') {
                stage.finishedAt ??= at; stage.effects = []; stage.critical = null;
                bonusRooms.delete(stage);
                stage.notifications = stage.notifications.filter(row => row.kind !== 'boost-start' && row.kind !== 'glove');
            }
            if (event.source === 'native' && (stage.status === 'finished' || stage.status === 'active' && stage.players.length)) {
                const pending = [];
                for (const [receiptKey, entry] of earlyBonuses) {
                    if (entry.event.battleId !== stage.battleId) continue;
                    earlyBonuses.delete(receiptKey);
                    pending.push([receiptKey, entry.event]);
                }
                if (stage.status === 'active') for (const [receiptKey, queued] of pending.sort((a, b) => a[1].occurredAt - b[1].occurredAt)) {
                    ingestBonus(stage, queued, at, receiptKey, reject);
                }
            }
            if (before !== JSON.stringify([stage.players.map(p => [p.id, p.score]), stage.teams])) notify(stage, 'score',
                { players: stage.players, teams: stage.teams }, event.occurredAt, event.receiptId);
        } else if (event.kind === 'boost-start') {
            stage.effects.push({ ...event.data, receiptId: event.receiptId, source: event.source, official: event.source === 'native' });
            notify(stage, event.kind, event.data, event.occurredAt, event.receiptId);
        } else if (event.kind === 'boost-end') {
            stage.effects = stage.effects.filter(row => row.boostId !== event.data.boostId);
            notify(stage, event.kind, { ...event.data, reason: 'explicit' }, event.occurredAt, event.receiptId);
        } else if (event.kind !== 'round-winner') notify(stage, event.kind, event.data, event.occurredAt, event.receiptId);
        if (winner) { stage.winner = copy(winner); notify(stage, 'round-winner', winner, event.occurredAt, event.receiptId); }
        sweep(at);
        return { accepted: true, reason: 'accepted', receiptId: event.receiptId };
    }
    function snapshot() {
        sweep(now());
        return copy({ schemaVersion: SCHEMA_VERSION, scope: generation, live: lanes.native,
            preview: lanes.preview, test: lanes.test });
    }
    function reset() {
        const at = now(); sweep(at);
        for (const source of Object.keys(lanes)) { retire(lanes[source], at); lanes[source] = null; }
        nativeProfiles.clear();
        earlyBonuses.clear();
        generation++; return generation;
    }
    return { scope: () => generation, reset, snapshot,
        ingestNative: (type, payload, context) => ingest(normalizeNativePKEvent(type, payload, context), context),
        ingestManual: (payload, context) => !allowManual ? { accepted: false, reason: 'manual-disabled' }
            : ingest(normalizeManualPKEvent(payload, { enabled: true, maxEffectMs: config.maxEffectMs }), context) };
}

module.exports = { SCHEMA_VERSION, NATIVE_EVENTS, DEFAULTS, NATIVE_EFFECT_CLOCK_SKEW_MS, normalizeNativePKEvent,
    normalizeManualPKEvent, createPKNotifications, readNativeScores };
