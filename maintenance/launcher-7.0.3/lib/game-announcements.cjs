'use strict';
const KEY = 'game_announcements_v1';

function createGameAnnouncements({ store, games }) {
    const keyFor = game => 'game:' + game.id;
    function pending() {
        if (!games.length) return [];
        const seen = { ...store.get(KEY, {}) }; let migrated = false;
        // A dismissed game stays dismissed for this installation, even after an account or version change.
        const dismissed = game => {
            if (seen[keyFor(game)]) return true;
            if (!Object.keys(seen).some(key => seen[key] && key.endsWith(':' + game.announcementId))) return false;
            seen[keyFor(game)] = true; migrated = true; return true;
        };
        const result = games.filter(game => game.announcementId && !dismissed(game)).map(game => ({ id: game.announcementId, gameId: game.id }));
        if (migrated) store.set(KEY, seen);
        return result;
    }
    function dismiss(id) {
        const game = games.find(game => game.announcementId === id);
        if (!game) throw new Error('Duyuru bulunamadi.');
        store.set(KEY, { ...store.get(KEY, {}), [keyFor(game)]: true });
        return { ok: true };
    }
    return { pending, dismiss };
}
module.exports = { createGameAnnouncements };
