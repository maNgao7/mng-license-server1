'use strict';
const { createBridge } = require('./lib/server.cjs');
// All connection ownership
// remains in ensureLive; this helper never imports or constructs the TikTok SDK.
async function createLauncherOwner({ subscribeSharedEvents, ensureLive, getStatus, getChannel, catalogDirectory, journalFile }) {
    const bridge = await createBridge({ catalogDirectory, journalFile,
        sharedOwner: { subscribeSharedEvents, ensureLive, getStatus, getChannel } });
    return { ...bridge, childEnvironment: {
        MNG_LIVE_OWNER_URL: bridge.url, MNG_LIVE_OWNER_TOKEN: bridge.token
    } };
}
module.exports = { createLauncherOwner };
