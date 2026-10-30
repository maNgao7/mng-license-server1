'use strict';
const { EventEmitter } = require('node:events');
const WebSocket = require('ws');

function localEndpoint(value) {
    const url = new URL(value || 'ws://127.0.0.1:21213/');
    if (url.protocol !== 'ws:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        || url.username || url.password || url.hash) throw new Error('TikFinity adresi bu bilgisayardaki bir WebSocket olmalı.');
    return url.href;
}

class TikfinityBridge extends EventEmitter {
    constructor() { super(); this.generation = 0; this.socket = null; this.timer = null; this.attempt = 0; }
    connect(endpoint, username) {
        this.close();
        this.endpoint = localEndpoint(endpoint);
        this.username = String(username || '').replace(/^@/, '').toLowerCase();
        this.open(this.generation);
    }
    open(generation) {
        if (generation !== this.generation) return;
        this.emit('status', { status: 'connecting', username: this.username, message: 'TikFinity Desktop bağlantısı aranıyor.' });
        const socket = new WebSocket(this.endpoint, { handshakeTimeout: 7000, maxPayload: 1024 * 1024 });
        this.socket = socket;
        socket.on('open', () => {
            if (generation !== this.generation) return socket.close();
            this.attempt = 0;
            this.emit('status', { status: 'ready', username: this.username, message: 'TikFinity açık. Canlı yayın etkinliği bekleniyor.' });
        });
        socket.on('message', raw => {
            if (generation !== this.generation) return;
            let packet;
            try { packet = JSON.parse(raw.toString()); } catch { return; }
            if (!packet || typeof packet !== 'object' || Array.isArray(packet) || typeof packet.event !== 'string') return;
            const names = { roomUser: 'viewer', roomuser: 'viewer', subscribe: 'subscribe', member: 'member', chat: 'chat', gift: 'gift', like: 'like', follow: 'follow', share: 'share' };
            const name = packet.event.toLowerCase();
            const type = Object.hasOwn(names, name) ? names[name] : null;
            if (!type) return;
            const data = packet.data;
            if (!data || typeof data !== 'object' || Array.isArray(data)) return;
            const broadcaster = String(data.broadcasterUsername || data.roomOwner?.uniqueId || '').replace(/^@/, '').toLowerCase();
            if (broadcaster && this.username && broadcaster !== this.username) {
                this.emit('status', { status: 'error', username: this.username, message: 'TikFinity başka bir yayıncıya bağlı. Aynı hesabı seçin.' });
                return;
            }
            if (type === 'gift') {
                const giftType = data.giftType ?? data.gift?.type ?? data.gift?.giftType ?? data.giftDetails?.giftType ?? data.extendedGiftInfo?.giftType ?? data.extendedGiftInfo?.type;
                if (Number(giftType) === 1 && ![true, 1, '1', 'true'].includes(data.repeatEnd)) return;
            }
            const roomId=String(data.roomId??data.room_id??data.common?.roomId??'');
            this.emit('status', { status: 'connected', username: this.username,roomId:/^\d{1,32}$/.test(roomId)?roomId:'', message: 'TikFinity canlı etkinlikleri alınıyor.' });
            this.emit('event', type, data);
        });
        socket.on('error', () => {
            if (generation === this.generation) this.emit('status', { status: 'error', username: this.username, message: 'TikFinity Desktop açık mı? Bağlantı otomatik yeniden denenecek.' });
        });
        socket.on('close', () => {
            if (generation !== this.generation) return;
            this.socket = null;
            this.emit('status', { status: 'disconnected', username: this.username, message: 'TikFinity bağlantısı kesildi. Yeniden deneniyor.' });
            this.timer = setTimeout(() => this.open(generation), Math.min(30000, 1500 * 2 ** this.attempt++));
            this.timer.unref?.();
        });
    }
    close() {
        this.generation++;
        clearTimeout(this.timer);
        this.timer = null;
        const old = this.socket;
        this.socket = null;
        if (old) { old.removeAllListeners(); old.on('error', () => {}); old.terminate(); }
    }
}

module.exports = { TikfinityBridge, localEndpoint };
