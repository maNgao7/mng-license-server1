'use strict';

const { readProfile } = require('./pk-profiles.cjs');
const REQUEST_INTERVAL = 45000;
const COUNT_TTL = 60000;
const MAX_REQUESTS = 64;
const id = value => (typeof value === 'string' || typeof value === 'bigint' || Number.isSafeInteger(value)) &&
    /^[1-9]\d{0,31}$/.test(String(value)) ? String(value) : '';
const count = value => (typeof value === 'number' || typeof value === 'string' && /^\d{1,16}$/.test(value)) &&
    Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;

function readRoom(response, roomId) {
    const room = response?.data ?? response;
    const roomIds = [room?.id_str, room?.room_id_str, room?.id, room?.room_id].filter(value => value != null);
    if (response?.status_code != null && response.status_code !== 0 ||
        room?.status != null && room.status !== 2 || !roomIds.some(value => id(value) === roomId) ||
        roomIds.some(value => id(value) !== roomId &&
            !(typeof value === 'number' && !Number.isSafeInteger(value) && value === Number(roomId)))) return null;
    const owner = readProfile(room.owner, room.owner_user_id_str ?? room.owner_user_id);
    return owner && { ownerId: owner.id, count: count(room.user_count ?? room.userCount) };
}

function createPKViewerCounts({ now = Date.now } = {}) {
    let session = null;
    const requests = new Map();
    const active = (battle, at) => battle?.status === 'active' && (!battle.endsAt || at < battle.endsAt) &&
        at - battle.seenAt < 300000;
    const sample = (value, at) => ({ viewerCount: value, viewerCountExpiresAt: at + COUNT_TTL });

    function setSession(channel, roomId, connection, route) {
        if (!id(roomId) || !connection) { session = null; return; }
        if (session?.channel === channel && session.roomId === roomId && session.connection === connection) return;
        const room = readRoom(connection.roomInfo, roomId);
        session = { channel, roomId, connection, route, ownerId: room?.ownerId,
            ownerCount: room?.count != null ? sample(room.count, now()) : null, battle: null };
    }

    function ingestViewer(channel, message) {
        if (session?.channel !== channel || !session.ownerId || id(message?.common?.roomId) !== session.roomId ||
            message.common.method !== 'WebcastRoomUserSeqMessage') return;
        const value = count(message.total ?? message.viewerCount ?? message.viewer_count);
        if (value !== null) session.ownerCount = sample(value, now());
    }

    async function fetchCount(source, battle, participantId, roomId, at) {
        const { route, connection } = source, client = connection.webClient;
        if (!route || typeof client?.getJsonObjectFromWebcastApi !== 'function' || requests.has(participantId) ||
            requests.size >= MAX_REQUESTS) return;
        const request = { at, pending: true };
        requests.set(participantId, request);
        try {
            // Use the existing SDK client with a per-request policy. The low-level route
            // leaves the connected room ID and the SDK's cached room info alone.
            const webClient = { clientParams: client.clientParams,
                getJsonObjectFromWebcastApi: (path, params, sign) =>
                    client.getJsonObjectFromWebcastApi(path, params, sign, {
                        retry: { limit: 0 }, followRedirect: false, timeout: { request: 8000 }
                    }) };
            const info = readRoom(await route({ webClient, roomId }), roomId);
            const receivedAt = now();
            if (session === source && source.battle === battle && active(battle, receivedAt) &&
                battle.rooms.get(participantId) === roomId) {
                if (info?.ownerId === participantId && info.count !== null) {
                    battle.counts.set(participantId, sample(info.count, receivedAt));
                } else {
                    battle.counts.delete(participantId);
                }
            }
        } catch {
            // A failed request leaves the last verified count available until it expires.
        } finally {
            request.pending = false;
        }
    }

    function ingestBattle(channel, stage, message) {
        const source = session;
        if (source?.channel !== channel || id(message.common?.roomId) !== source.roomId ||
            !['WebcastLinkMicBattle', 'WebcastLinkMicArmies'].includes(message.common.method)) return;
        if (!stage || id(message.battleId || message.battleSettings?.battleId) !== stage.battleId) return;
        if (source.battle?.id !== stage.battleId) {
            source.battle = { id: stage.battleId, rooms: new Map(), counts: new Map() };
        }
        const battle = source.battle, at = now();
        Object.assign(battle, { status: stage.status, seenAt: stage.seenAt, endsAt: stage.endsAt });
        const participants = new Set(stage.players.map(player => player.id));
        for (const anchor of message.anchorsInfo || []) {
            const user = anchor.value?.user, participantId = id(anchor.key), roomId = id(user?.roomId);
            if (!participants.has(participantId) || id(user?.userId) !== participantId || !roomId) continue;
            if (battle.rooms.get(participantId) !== roomId) battle.counts.delete(participantId);
            battle.rooms.set(participantId, roomId);
        }
        if (!active(battle, at)) return;
        for (const [participantId, request] of requests) {
            if (!request.pending && at - request.at >= REQUEST_INTERVAL) requests.delete(participantId);
        }
        for (const [participantId, roomId] of battle.rooms) {
            if (participants.has(participantId) && participantId !== source.ownerId && roomId !== source.roomId) {
                void fetchCount(source, battle, participantId, roomId, at);
            }
        }
    }

    function project(channel, roomId, native, stage = native) {
        const at = now(), source = session, battle = source?.battle;
        if (source?.channel !== channel || source.roomId !== roomId || !active(battle, at) ||
            native?.status !== 'active' || native.battleId !== battle.id ||
            stage?.status !== 'active' || stage.battleId !== battle.id) return stage;
        const participants = new Set(native.players.map(player => player.id));
        return { ...stage, players: stage.players.map(player => {
            if (!participants.has(player.id)) return player;
            const row = player.id === source.ownerId ? source.ownerCount : battle.counts.get(player.id);
            return row?.viewerCountExpiresAt > at ? { ...player, ...row } : player;
        }) };
    }

    return { setSession, ingestViewer, ingestBattle, project };
}

module.exports = { createPKViewerCounts };
