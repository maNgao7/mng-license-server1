'use strict';
const { ProfileSources } = require('../vendor/portrait-engine.cjs');
const { createDesktopSource } = require('./desktop-profile-source.cjs');

// Direct Godot/Node entry uses the same public resolver as the Electron owner.
// This process owns LIVE; the auxiliary process has only public portrait work.
function createRuntimeProfiles(options) {
    const desktop = createDesktopSource(options);
    const sources = new ProfileSources({ render: username => desktop.get(username) });
    return {
        get: (username, options) => sources.get(username, options),
        render: sources.render,
        capability: desktop.capability,
        close() { sources.close(); desktop.close(); }
    };
}
module.exports = { createRuntimeProfiles };
