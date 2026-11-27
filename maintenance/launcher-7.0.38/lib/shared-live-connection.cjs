'use strict';

const { EventEmitter } = require('node:events');

const events = new Map([
    ['chat', 'chat'], ['gift', 'gift'], ['like', 'like'], ['follow', 'follow'],
    ['share', 'share'], ['member', 'member'], ['subscribe', 'subscribe'], ['viewer', 'roomUser']
]);
const account = value => String(value || '').trim().replace(/^@/, '').toLowerCase();

function statusError(status) {
    const message = {
        offline: 'TikTok LIVE is not online',
        'stream-ended': 'TikTok LIVE has ended',
        timeout: 'TikTok connection timed out',
        'rate-limit': 'TikTok rate limit',
        auth: 'TikTok connection authentication failed',
        network: 'TikTok network connection failed'
    }[status?.reason];
    return new Error(message || 'Ortak yayın bağlantısı kurulamadı.');
}

// The game consumes the same SDK event payloads via its existing connection
// factory. Disconnecting the game detaches its observers, not the publisher.
function createSharedLiveConnection(username, { ensureLive, observe, getStatus }) {
    const name = account(username);
    const connection = new EventEmitter();
    let unsubscribe;
    let generation = 0;
    let joinedRoom = '';
    let pending;
    const matches = status => account(status?.username) === name && status?.status === 'connected' &&
        /^[1-9]\d{0,31}$/.test(String(status.roomId || ''));

    Object.defineProperties(connection, {
        isConnected: { get: () => Boolean(joinedRoom && matches(getStatus()) && String(getStatus().roomId) === joinedRoom) },
        roomId: { get: () => joinedRoom }
    });

    connection.disconnect = () => {
        generation++;
        pending = undefined;
        joinedRoom = '';
        unsubscribe?.();
        unsubscribe = undefined;
    };

    connection.connect = () => {
        if (connection.isConnected) return Promise.resolve({ roomId:joinedRoom, isConnected:true });
        if (pending) return pending;
        const run = ++generation;
        const operation = (async () => {
            const initial = await ensureLive(name);
            const current = getStatus();
            if (run !== generation) throw new Error('Oyun yayın bağlantısı iptal edildi.');
            if (!matches(current)) throw statusError(initial);
            joinedRoom = String(current.roomId);
            unsubscribe = observe({
                status(status) {
                    if (run !== generation || !joinedRoom) return;
                    if (matches(status) && String(status.roomId) === joinedRoom) return;
                    connection.disconnect();
                    connection.emit(status?.reason === 'stream-ended' ? 'streamEnd' : 'disconnected');
                },
                event(type, payload, status) {
                    const event = events.get(type);
                    if (event && run === generation && matches(status) && String(status.roomId) === joinedRoom) {
                        connection.emit(event, payload);
                    }
                }
            });
            return { roomId:joinedRoom, isConnected:true };
        })();
        pending = operation.finally(() => { if (run === generation) pending = undefined; });
        return pending;
    };
    return connection;
}

module.exports = { createSharedLiveConnection };
