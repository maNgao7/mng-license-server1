import fs from 'node:fs';
import path from 'node:path';

export function componentCatalog(published, capability, rollout) {
    if (capability !== 'shared-runtime-v2' || rollout?.enabled !== true ||
        !Number.isSafeInteger(rollout.revision) || !Array.isArray(rollout.games)) return published;
    const allowed = new Map();
    for (const game of rollout.games) {
        if (!['battle-royale', 'snow-war', 'minecraft-snake-arena', 'zombie-war'].includes(game.id) ||
            !/^\d+\.\d+\.\d+$/.test(game.version || '') || !/^\d+\.\d+\.\d+$/.test(game.previousVersion || '') ||
            !/^[a-f0-9]{64}$/.test(game.sha256 || '') || !Number.isSafeInteger(game.bytes) || game.bytes <= 0 ||
            !Array.isArray(game.files) || game.files.length !== 1 || game.files[0].path !== '.tikmng-content.json') continue;
        const file = game.files[0];
        if (!/^[a-f0-9]{64}$/.test(file.sha256 || '') || !Number.isSafeInteger(file.bytes) || file.bytes <= 0 || file.bytes > 16 * 1024 * 1024) continue;
        try {
            for (const value of [game.url, file.url]) {
                const url = new URL(value);
                if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Invalid component URL');
            }
            allowed.set(game.id, game);
        } catch {}
    }
    if (!allowed.size) return published;
    return { ...published, revision: Math.max(published.revision, rollout.revision), games: published.games.map(game => {
        const patch = allowed.get(game.id);
        // A newer administrator publication always takes precedence over this rollout.
        if (!patch || game.version !== patch.previousVersion) return game;
        return { ...game, version: patch.version, url: patch.url, sha256: patch.sha256, bytes: patch.bytes,
            files: patch.files, format: 'shared-runtime-v2' };
    }) };
}

export function readComponentRollout(directory) {
    const file = path.join(directory, 'content-components.json');
    try {
        if (fs.statSync(file).size > 128 * 1024) return null;
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch { return null; }
}
