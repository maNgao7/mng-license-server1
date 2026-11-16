'use strict';

const http = require('node:http');
const { randomBytes, timingSafeEqual } = require('node:crypto');
const { createSharedLiveConnection } = require('./shared-live-connection.cjs');
const eventNames = ['chat', 'gift', 'like', 'follow', 'share', 'member', 'subscribe', 'roomUser', 'disconnected', 'streamEnd'];

async function createGameLiveServer({ ensureLive, observe, getStatus, getGifts = () => [] }) {
    const token = randomBytes(32).toString('hex');
    const clients = new Map();
    const sockets = new Set();
    const encode = value => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item);
    const server = http.createServer(async (request, response) => {
        const answer = (status, body) => {
            response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            response.end(encode(body));
        };
        const supplied = Buffer.from(String(request.headers.authorization || ''));
        const expected = Buffer.from('Bearer ' + token);
        if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return answer(403, { ok: false });
        const url = new URL(request.url, 'http://127.0.0.1');
        const id = url.searchParams.get('id') || '';
        if (!/^[a-f0-9-]{36}$/.test(id)) return answer(400, { ok: false });

        if (request.method === 'GET' && url.pathname === '/events') {
            const username = url.searchParams.get('username') || '';
            if (!/^[a-zA-Z0-9_.]{2,32}$/.test(username) || clients.size >= 4 || clients.has(id)) return answer(400, { ok: false });
            const connection = createSharedLiveConnection(username, { ensureLive, observe, getStatus });
            response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
            const write = value => {
                const frame = 'data: ' + encode(value) + '\n\n';
                if (response.destroyed) return;
                if (Buffer.byteLength(frame) > 2 * 1024 * 1024 || response.writableLength > 4 * 1024 * 1024) {
                    response.destroy();
                    return;
                }
                response.write(frame);
            };
            for (const event of eventNames) connection.on(event, data => write({ event, data }));
            const heartbeat = setInterval(() => response.write(': alive\n\n'), 15000);
            heartbeat.unref();
            const dispose = () => {
                clearInterval(heartbeat);
                connection.disconnect();
                clients.delete(id);
            };
            response.once('close', dispose);
            clients.set(id, { connection, response });
            write({ ready: true });
            return;
        }
        const client = clients.get(id);
        if (!client) return answer(409, { ok: false, error: 'Oyun yayın bağlantısı kapandı.' });
        if (request.method === 'POST' && url.pathname === '/connect') {
            try {
                const status = await client.connection.connect();
                if (response.destroyed) return;
                const gifts = getGifts();
                return answer(200, { ok: true, ...status, gifts });
            } catch (error) {
                return answer(503, { ok: false, error: error.message });
            }
        }
        return answer(404, { ok: false });
    });
    server.on('connection', socket => {
        sockets.add(socket);
        socket.once('close', () => sockets.delete(socket));
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    return {
        url: 'http://127.0.0.1:' + server.address().port,
        token,
        close: () => new Promise(resolve => {
            for (const { connection, response } of clients.values()) {
                connection.disconnect();
                response.destroy();
            }
            for (const socket of sockets) socket.destroy();
            server.close(resolve);
        })
    };
}

module.exports = { createGameLiveServer };
