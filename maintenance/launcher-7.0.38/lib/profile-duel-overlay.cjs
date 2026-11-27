'use strict';

const fs = require('node:fs');
const path = require('node:path');

const idle = { phase: 'idle', owner: null, opponent: null, scores: { left: 0, right: 0 }, remainingMs: 120000 };
const type = 'profile-duel';

function createProfileDuelOverlay({ directory, host, getPortraitPath }) {
    const read = name => fs.readFileSync(path.join(directory, 'web', name), 'utf8');
    const styles = read('styles.css');
    const view = read('widget-view.mjs').replace('export function mountDuelWidget', 'function mountDuelWidget');
    const transport = fs.readFileSync(path.join(__dirname, '../renderer/widgets/profile-duel-transport.js'), 'utf8');
    const document = read('widget.html')
        .replace('<link rel="stylesheet" href="./styles.css">', () => '<style>' + styles + '</style>')
        .replace('<script type="module" src="./widget.mjs"></script>', () => '<script>\n' + view + '\n' + transport + '\n</script>');

    function snapshot(channel) {
        if (!channel || channel !== host.getChannel()) return idle;
        const state = host.getBroadcastState();
        if (!state) return idle;
        const player = profile => {
            if (!profile) return null;
            const { username, nickname } = profile;
            const avatarUrl = getPortraitPath(username);
            return { username, nickname, avatarUrl: /^\/widget\/gift-assets\/portrait-[a-f0-9-]{36}\.png$/.test(avatarUrl || '') ? avatarUrl : '' };
        };
        const giftPath = (ids, fallback) => {
            const id = ids?.find(value => /^\d{1,12}$/.test(value)) || fallback;
            return '/widget/gift-assets/' + id + '.png';
        };
        const config = state.giftConfig || {};
        return {
            ...state,
            owner: player(state.owner),
            opponent: player(state.opponent),
            giftConfig: {
                roseGiftLabel: config.roseGiftLabel,
                tiktokGiftLabel: config.tiktokGiftLabel,
                roseGiftImage: giftPath(config.roseGiftIds, '5655'),
                tiktokGiftImage: giftPath(config.tiktokGiftIds, '5269')
            },
            activity: (state.activity || []).slice(0, 1).map(({ eventId, side, giftName, points, at }) => ({ eventId, side, giftName, points, at })),
            lastResult: state.lastResult ? { winner: player(state.lastResult.winner) } : null
        };
    }
    return { document, snapshot };
}

module.exports = { type, idle, createProfileDuelOverlay };
