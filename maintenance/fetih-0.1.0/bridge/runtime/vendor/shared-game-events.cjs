'use strict';

function createSharedGameEvents() {
    const listeners = new Set();
    let closed = false;

    function subscribe(listener) {
        if (closed) throw new Error('Paylaşılan oyun olay akışı kapalı.');
        if (typeof listener !== 'function') throw new TypeError('Olay dinleyicisi gerekli.');
        listeners.add(listener);
        let subscribed = true;
        return () => {
            if (!subscribed) return false;
            subscribed = false;
            return listeners.delete(listener);
        };
    }

    function publish(type, payload, { channel, source } = {}) {
        if (closed || source !== 'live' || !payload || typeof payload !== 'object') return 0;
        let delivered = 0;
        for (const listener of [...listeners]) {
            try {
                listener(type, payload, { channel: String(channel || ''), source });
                delivered++;
            } catch {}
        }
        return delivered;
    }

    function close() {
        if (closed) return;
        closed = true;
        listeners.clear();
    }

    return { subscribe, publish, close, get size() { return listeners.size; } };
}

module.exports = { createSharedGameEvents };
