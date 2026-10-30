'use strict';
function componentAssetURL(publicBase, name) {
    if (!/^[a-f0-9]{64}\.(bin|zip|json)$/.test(name)) throw new Error('Invalid content-addressed asset name');
    const origin = new URL(publicBase.endsWith('/') ? publicBase : publicBase + '/');
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash) throw new Error('Invalid publication base');
    const url = new URL(name, origin);
    // GitHub permits at most 1000 assets in one release. Hash-prefix buckets keep
    // shared files at one stable address without thousands of assets on one tag.
    if (origin.hostname === 'github.com' && /^\/[^/]+\/[^/]+\/releases\/download\/[^/]+\/$/.test(origin.pathname)) {
        url.pathname = origin.pathname.slice(0, -1) + '-' + name[0] + '/' + name;
    }
    return url.href;
}
module.exports = { componentAssetURL };
