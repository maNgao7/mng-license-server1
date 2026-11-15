const OWNER = 'maNgao7';
const REPO = 'mng-license-server1';
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const INSTALLER = /^TikMnG-Setup-v?((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))(?:-x64)?\.exe$/;

function versionParts(value) {
    if (!VERSION.test(value)) return null;
    const parts = value.split('.').map(Number);
    return parts.every(Number.isSafeInteger) ? parts : null;
}

function compare(a, b) {
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    return 0;
}

function installer(url, owner, repo) {
    try {
        const parsed = new URL(url);
        if (parsed.origin !== 'https://github.com' || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
        const [empty, actualOwner, actualRepo, releases, download, tag, name, ...extra] = parsed.pathname.split('/');
        if (empty || actualOwner !== owner || actualRepo !== repo || releases !== 'releases' || download !== 'download' || extra.length) return null;
        const match = INSTALLER.exec(name || '');
        const version = match && versionParts(match[1]);
        if (!version || tag.replace(/^v/, '') !== match[1]) return null;
        return { url: parsed.href, tag, name, version };
    } catch { return null; }
}

// One cache and one in-flight request per server, independent of browser caches.
// No backup credentials or caller-provided URL is sent to GitHub.
export function createLatestInstallerResolver({ owner = OWNER, repo = REPO, fallbackUrl,
    fetchImpl = globalThis.fetch, now = Date.now, ttlMs = 300_000, retryMs = 30_000, timeoutMs = 4_000 } = {}) {
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner) ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(repo)) throw new Error('Invalid release repository.');
    let best = installer(fallbackUrl, owner, repo);
    if (!best) throw new Error('Invalid fallback installer.');
    let expiresAt = 0;
    let pending;
    const endpoint = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    return function resolveLatestInstaller() {
        if (now() < expiresAt) return Promise.resolve(best.url);
        if (pending) return pending;
        pending = (async () => {
            try {
                const response = await fetchImpl(endpoint, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
                    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'TikMnG-release-download' } });
                if (!response.ok) throw new Error('Release lookup failed.');
                const release = await response.json();
                if (release.draft !== false || release.prerelease !== false || !Array.isArray(release.assets) || release.assets.length > 1000) throw new Error('Invalid release.');
                const candidates = release.assets.map(asset => {
                    const candidate = installer(asset?.browser_download_url, owner, repo);
                    return candidate && asset.name === candidate.name && release.tag_name === candidate.tag &&
                        Number.isSafeInteger(asset.size) && asset.size > 0 && asset.state === 'uploaded' ? candidate : null;
                }).filter(Boolean);
                candidates.sort((a, b) => compare(b.version, a.version));
                if (!candidates.length) throw new Error('Installer missing.');
                if (compare(candidates[0].version, best.version) >= 0) best = candidates[0];
                expiresAt = now() + ttlMs;
            } catch {
                // Keep the newest verified installer during outages/rate limits;
                // retry soon without multiplying failed requests under load.
                expiresAt = now() + retryMs;
            }
            return best.url;
        })().finally(() => { pending = undefined; });
        return pending;
    };
}

export function registerInstallerDownloads(app, resolveLatestInstaller) {
    app.get(['/download/setup', '/download/setup-direct'], async (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.redirect(302, await resolveLatestInstaller());
    });
}
