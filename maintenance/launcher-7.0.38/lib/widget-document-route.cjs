'use strict';

const PATH = /^\/widget\/view\/([a-z0-9-]{1,100})$/;
const LEADERBOARDS = new Set(['topgifter', 'topliker']);

function legacyPath(type) {
    return LEADERBOARDS.has(type) ? '/widget-leaderboard.html' : '/widget-overlay.html';
}

function applyRoute(url, definition) {
    url.searchParams.set('type', definition.id);
    url.searchParams.delete('base');
    url.searchParams.delete('engine');
    if (definition.baseId) {
        url.searchParams.set(definition.scenePreset ? 'engine' : 'base', definition.baseId);
    }
    return url;
}

module.exports = { PATH, legacyPath, applyRoute };
