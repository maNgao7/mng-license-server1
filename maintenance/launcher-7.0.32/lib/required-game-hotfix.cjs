'use strict';
'use strict';
const semver = require('semver');

// Minimum packages that speak the launcher's shared live-event protocol.
const minimumVersions = {
    vs: '7.0.3', puanlama: '7.0.3', orbit: '7.0.4', 'duck-hunt': '7.0.3',
    'pony-life': '7.0.3', 'frog-river': '7.0.6', caahr: '0.6.12'
};

async function ensureRequiredGameHotfix({ gameId, getState, install, onRequired }) {
    if (!Object.hasOwn(minimumVersions, gameId)) return false;
    const state = getState(gameId);
    if (!state?.installed || !state.updateAvailable) return false;
    const installed = semver.valid(state.installedVersion);
    if (installed && semver.gte(installed, minimumVersions[gameId])) return false;
    onRequired();
    const result = await install(gameId);
    if (!result?.basarili) throw Error(result?.hata || 'Oyun düzeltmesi indirilemedi. Eski dosyalar korunuyor. Yeniden deneyin.');
    return true;
}
module.exports = { ensureRequiredGameHotfix };
