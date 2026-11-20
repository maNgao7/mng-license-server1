'use strict';
const path = require('node:path');
const { createBridge } = require('./lib/server.cjs');
const { ProfileSources, VsPortraits, createDesktopPortraits } = require('./vendor/portrait-engine.cjs');
// Import this helper in an isolated launcher preview. All connection ownership
// remains in ensureLive; this helper never imports or constructs the TikTok SDK.
async function createLauncherOwner({ subscribeSharedEvents, ensureLive, getStatus, getChannel, catalogDirectory, journalFile,
    portraitDirectory, portraitCacheOptions, profileSources, getCachedPortrait }) {
    // The current launcher can call this helper without a cache callback. Read
    // the same username-bound VS cache used by its portrait widgets in that case.
    if (process.versions.electron && (!getCachedPortrait || !profileSources)) {
        const { app, BrowserWindow, session } = require('electron');
        if (app?.isReady()) {
            if (!getCachedPortrait) {
                const shared = new VsPortraits({ folders: [path.join(app.getPath('userData'), 'games/tiktok-vs/.avatar-cache')] });
                getCachedPortrait = username => shared.cached(username)?.bytes;
            }
            if (!profileSources) {
                let browser;
                const sources = new ProfileSources({ render: username => {
                    browser ||= createDesktopPortraits({ BrowserWindow, session });
                    return browser.get(username);
                } });
                profileSources = {
                    get: (username, options) => sources.get(username, options),
                    // createProfiles checks this capability before requesting
                    // renderOnly after measuring a small public "large" image.
                    render: sources.render,
                    close() { sources.close(); browser?.close(); }
                };
            }
        }
    }
    const bridge = await createBridge({ catalogDirectory, journalFile, portraitDirectory, portraitCacheOptions,
        enableProfileLookup: true, profileSources, getCachedPortrait,
        sharedOwner: { subscribeSharedEvents, ensureLive, getStatus, getChannel } });
    return { ...bridge, childEnvironment: {
        MNG_LIVE_OWNER_URL: bridge.url, MNG_LIVE_OWNER_TOKEN: bridge.token
    } };
}
module.exports = { createLauncherOwner };
