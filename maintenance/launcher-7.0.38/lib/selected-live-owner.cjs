'use strict';

function createSelectedLiveOwner({ source, getStatus, connectDirect, connectBridge, closeDirect, observe, timeoutMs = 30000 }) {
    const pending = new Map();
    const clean = value => String(value || '').trim().replace(/^@/, '').toLowerCase();
    return username => {
        const name = clean(username);
        if (source() !== 'tikfinity') return connectDirect(name);
        const current = getStatus();
        if (clean(current?.username) === name && current?.status === 'connected' && /^[1-9]\d*$/.test(String(current.roomId || ''))) {
            return Promise.resolve(current);
        }
        if (pending.has(name)) return pending.get(name);
        const operation = (async () => {
            await closeDirect();
            return new Promise((resolve, reject) => {
                let timer, unsubscribe = () => {};
                const finish = (error, status) => {
                    clearTimeout(timer);
                    unsubscribe();
                    if (error) reject(error); else resolve(status);
                };
                const changed = status => {
                    if (source() !== 'tikfinity') return finish(new Error('Yayın kaynağı değişti.'));
                    if (clean(status?.username) !== name) return;
                    if (status.status === 'connected' && /^[1-9]\d*$/.test(String(status.roomId || ''))) finish(null, status);
                    if (status.status === 'error') finish(new Error(status.message || 'TikFinity bağlantısı kurulamadı.'));
                };
                unsubscribe = observe({ status: changed, event() {} });
                timer = setTimeout(() => finish(new Error('TikFinity canlı yayın etkinliği bekleniyor.')), timeoutMs);
                try { connectBridge(name); changed(getStatus()); }
                catch (error) { finish(error); }
            });
        })();
        const settled = operation.finally(() => pending.delete(name));
        pending.set(name, settled);
        return settled;
    };
}

module.exports = { createSelectedLiveOwner };
