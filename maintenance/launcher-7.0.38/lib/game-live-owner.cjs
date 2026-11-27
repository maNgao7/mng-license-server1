'use strict';

const clean = value => String(value || '').trim().replace(/^@/, '').toLowerCase();

function createGameLiveOwner() {
    let revision = 0;
    let stopped = false;
    return {
        manualConnect() { revision++; stopped = false; },
        manualDisconnect() { revision++; stopped = true; },
        bind({ getChannel, setChannel, ensureLive }) {
            const initial = revision;
            return async username => {
                const name = clean(username);
                if (revision !== initial && (stopped || name !== clean(getChannel()))) {
                    throw new Error('Yayın hesabı launcher’dan değiştirildi. Seçili hesapla yeniden bağlanın.');
                }
                if (clean(getChannel()) !== name) setChannel(name);
                return ensureLive(name);
            };
        }
    };
}

module.exports = { createGameLiveOwner };
