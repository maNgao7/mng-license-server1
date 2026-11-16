'use strict';

const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { EventEmitter } = require('node:events');

function createGameLiveClient(username, { url = process.env.MNG_SHARED_LIVE_URL, token = process.env.MNG_SHARED_LIVE_TOKEN } = {}) {
    const base = new URL(url);
    if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.username || base.password ||
        base.pathname !== '/' || base.search || base.hash || !/^[a-f0-9]{64}$/.test(token || '')) {
        throw new Error('Geçersiz ortak yayın adresi.');
    }
    const name = String(username || '').trim().replace(/^@/, '');
    if (!/^[a-zA-Z0-9_.]{2,32}$/.test(name)) throw new Error('Geçerli bir TikTok kullanıcı adı yazın.');
    const client = new EventEmitter();
    let controller;
    let connected = false;
    let roomId = '';
    let pending;
    let gifts = [];
    Object.defineProperties(client, {
        isConnected: { get: () => connected },
        roomId: { get: () => roomId },
        availableGifts: { get: () => gifts }
    });
    client.fetchAvailableGifts = async () => gifts;
    client.disconnect = () => {
        controller?.abort();
        controller = undefined;
        connected = false;
        roomId = '';
        pending = undefined;
    };
    client.connect = () => {
        if (connected) return Promise.resolve({ roomId, isConnected: true });
        if (pending) return pending;
        const run = new AbortController();
        controller = run;
        let dropped = false;
        const disconnected = () => {
            if (dropped || controller !== run || run.signal.aborted) return;
            dropped = true;
            client.disconnect();
            client.emit('disconnected');
        };
        const id = randomUUID();
        const headers = { Authorization: 'Bearer ' + token };
        const endpoint = route => {
            const target = new URL(route, base);
            target.searchParams.set('id', id);
            target.searchParams.set('username', name);
            return target;
        };
        const operation = (async () => {
            await new Promise((resolve, reject) => {
                let ready = false;
                const request = http.get(endpoint('/events'), { headers, signal: run.signal }, response => {
                    if (response.statusCode !== 200) {
                        response.resume();
                        return reject(new Error('Ortak yayın akışı açılamadı.'));
                    }
                    response.setEncoding('utf8');
                    let buffer = '';
                    response.on('data', chunk => {
                        buffer += chunk;
                        if (Buffer.byteLength(buffer) > 3 * 1024 * 1024) {
                            request.destroy(new Error('Ortak yayın paketi çok büyük.'));
                            return;
                        }
                        let end;
                        while ((end = buffer.indexOf('\n\n')) >= 0) {
                            const frame = buffer.slice(0, end);
                            buffer = buffer.slice(end + 2);
                            if (!frame.startsWith('data: ')) continue;
                            let data;
                            try { data = JSON.parse(frame.slice(6)); }
                            catch { request.destroy(new Error('Ortak yayın paketi okunamadı.')); return; }
                            if (data.ready) { ready = true; resolve(); }
                            else if (data.event && controller === run && !run.signal.aborted) {
                                if (['disconnected', 'streamEnd'].includes(data.event)) {
                                    dropped = true;
                                    client.disconnect();
                                }
                                client.emit(data.event, data.data);
                            }
                        }
                    });
                    const closed = () => {
                        if (!ready) reject(new Error('Ortak yayın akışı kapandı.'));
                        disconnected();
                    };
                    response.on('error', closed);
                    response.on('end', closed);
                });
                request.setTimeout(25000, () => request.destroy(new Error('Ortak yayın akışı zaman aşımı.')));
                request.on('error', error => {
                    if (!ready) reject(error);
                    else disconnected();
                });
            });
            const state = await new Promise((resolve, reject) => {
                const request = http.request(endpoint('/connect'), { method: 'POST', headers, signal: run.signal }, response => {
                    let body = '';
                    response.setEncoding('utf8');
                    response.on('data', chunk => {
                        body += chunk;
                        if (Buffer.byteLength(body) > 2 * 1024 * 1024) request.destroy(new Error('Ortak yayın yanıtı çok büyük.'));
                    });
                    response.on('error', reject);
                    response.once('end', () => {
                        try {
                            const data = JSON.parse(body);
                            if (response.statusCode !== 200 || !data.ok) throw new Error(data.error || 'Ortak yayın bağlanamadı.');
                            resolve(data);
                        } catch (error) { reject(error); }
                    });
                });
                request.setTimeout(45000, () => request.destroy(new Error('Ortak yayın bağlantısı zaman aşımı.')));
                request.on('error', reject);
                request.end();
            });
            if (controller !== run || run.signal.aborted || dropped) throw new Error('Ortak yayın bağlantısı iptal edildi.');
            connected = true;
            roomId = state.roomId;
            gifts = state.gifts || [];
            return { roomId, isConnected: true };
        })();
        pending = operation.catch(error => {
            if (controller === run) client.disconnect();
            throw error;
        }).finally(() => { if (controller === run) pending = undefined; });
        return pending;
    };
    return client;
}

module.exports = { createGameLiveClient };
