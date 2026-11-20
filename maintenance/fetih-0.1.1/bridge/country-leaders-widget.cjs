'use strict';

const { createHash, randomUUID } = require('node:crypto');
const { open, readFile, writeFile, rename } = require('node:fs/promises');
const { createServer } = require('node:http');
const path = require('node:path');

const host = '127.0.0.1';
const pageRoute = '/ulke-liderleri';
const dataRoute = `${pageRoute}/data`;
const pageFile = path.join(__dirname, '../assets/widgets/country-leaders.html');
const armyFile = path.join(__dirname, '../assets/widgets/fetih-armies.html');
const documentRoutes = {
    'fetih-liderler': '/widget/view/fetih-liderler',
    'fetih-ordular': '/widget/view/fetih-ordular'
};
const compareNames = new Intl.Collator('tr').compare;

function publicRows(world) {
    const leaders = world?.countryLeaders;
    if (!leaders || typeof leaders !== 'object' || Array.isArray(leaders)) return [];

    const rows = [];
    for (const leader of Object.values(leaders)) {
        if (!Number.isSafeInteger(leader?.wins) || leader.wins < 1) continue;
        const uniqueId = typeof leader.uniqueId === 'string' ? leader.uniqueId.trim() : '';
        const displayName = typeof leader.displayName === 'string' ? leader.displayName.trim() : '';
        if (uniqueId || displayName) rows.push({ uniqueId, displayName, wins: leader.wins });
    }
    return rows.sort((a, b) => b.wins - a.wins || compareNames(a.displayName || a.uniqueId, b.displayName || b.uniqueId)
        || compareNames(a.uniqueId, b.uniqueId));
}

function publicArmies(state) {
    if (!Array.isArray(state?.rows)) return [];
    const units = ['soldiers', 'tanks', 'helicopters', 'jets'];
    return state.rows.filter(row => typeof row?.name === 'string' && row.name.trim() &&
        units.every(key => Number.isSafeInteger(row[key]) && row[key] >= 0) && row.soldiers > 0)
        .map(({ name, soldiers, tanks, helicopters, jets }) => ({
            name: name.trim().slice(0, 80), soldiers, tanks, helicopters, jets
        }))
        .sort((a, b) => b.soldiers - a.soldiers || b.tanks - a.tanks || b.helicopters - a.helicopters ||
            b.jets - a.jets || compareNames(a.name, b.name)).slice(0, 6);
}

function openStandings(worldFile, selectRows = publicRows) {
    let stamp;
    let snapshot;
    let pending;

    function update(rows) {
        const body = JSON.stringify(rows);
        if (body !== snapshot?.body) {
            const etag = `"${createHash('sha256').update(body).digest('hex')}"`;
            snapshot = { body, etag };
        }
        return snapshot;
    }

    async function refresh() {
        const file = await open(worldFile, 'r').catch(error => {
            if (error.code !== 'ENOENT') throw error;
            return null;
        });
        if (!file) {
            stamp = undefined;
            return update([]);
        }
        try {
            // Tie the metadata and read to the same file across atomic replacements.
            const { dev, ino, size, mtimeNs, ctimeNs } = await file.stat({ bigint: true });
            const currentStamp = `${dev}:${ino}:${size}:${mtimeNs}:${ctimeNs}`;
            if (currentStamp === stamp) return snapshot;

            if (size > 16n * 1024n * 1024n) throw new Error('Widget state too large');
            const source = await file.readFile('utf8');
            const next = update(selectRows(JSON.parse(source.replace(/^\uFEFF/, ''))));
            stamp = currentStamp;
            return next;
        } finally {
            await file.close();
        }
    }

    return () => {
        pending ??= refresh().finally(() => { pending = undefined; });
        return pending;
    };
}

async function readLicense(file) {
    if (!file || !path.isAbsolute(file)) return null;
    const handle = await open(file, 'r').catch(() => null);
    if (!handle) return null;
    try {
        if ((await handle.stat()).size > 8192) return null;
        const { code, deviceId } = JSON.parse(await handle.readFile('utf8'));
        if (typeof code !== 'string' || !code.trim() || code.length > 512 ||
            typeof deviceId !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(deviceId)) return null;
        return { licenseCode: code.trim(), deviceId };
    } catch { return null; }
    finally { await handle.close(); }
}

async function startPublisher({ statusFile, licenseFile, port,
    serverURL = 'https://mng-license-server1.onrender.com', allowInsecureForTests = false }) {
    const { createOverlayBridge } = require('./runtime/vendor/overlay-bridge.cjs');
    const installationFile = path.join(path.dirname(statusFile), 'widget-installation-id.txt');
    let installationId = (await readFile(installationFile, 'utf8').catch(() => '')).trim();
    if (!/^[a-f0-9]{32}$/.test(installationId)) {
        installationId = randomUUID().replaceAll('-', '');
        await writeFile(installationFile, installationId);
    }
    const store = new Map([['overlay_installation_v1', installationId]]);
    const localURL = route => `http://${host}:${port}${route}`;
    let pending = Promise.resolve();
    const bridge = createOverlayBridge({
        store, port, namespace: 'fetih', serverURL, allowInsecureForTests,
        getCredentials: () => readLicense(licenseFile),
        onStatus: ({ status, ready }) => {
            const links = ready ? Object.fromEntries(Object.entries(documentRoutes)
                .map(([id, route]) => [id, bridge.urlFor(localURL(route))])) : {};
            const body = JSON.stringify({ status, links, pid: process.pid });
            pending = pending.then(async () => {
                const temp = statusFile + '.' + process.pid + '.tmp';
                await writeFile(temp, body);
                await rename(temp, statusFile);
            }).catch(() => {});
        }
    });
    bridge.start('fetih');
    return bridge;
}

function parentAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        if (error.code === 'ESRCH') return false;
        if (error.code === 'EPERM') return true;
        throw error;
    }
}

async function main([worldFile, parentArg, portArg = '32187', licenseFile, ...extra]) {
    const parentPid = Number(parentArg);
    const port = Number(portArg);
    if (!worldFile || !path.isAbsolute(worldFile) || !/^\d+$/.test(parentArg ?? '') || parentPid < 1
        || parentPid > 0x7fff_ffff || parentPid === process.pid || !/^\d+$/.test(portArg) || port > 65535 || extra.length) {
        throw new Error('Usage: node country-leaders-widget.cjs <absolute-world-v1.json> <parent-pid> [port]');
    }

    if (!parentAlive(parentPid)) return;
    const [page, armyPage] = await Promise.all([readFile(pageFile), readFile(armyFile)]);
    const readStandings = openStandings(worldFile);
    const readArmies = openStandings(path.join(path.dirname(worldFile), 'widget-armies-v1.json'), publicArmies);
    const server = createServer(async (request, response) => {
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('X-Content-Type-Options', 'nosniff');
        const localPort = request.socket.localPort;
        if (![`${host}:${localPort}`, `localhost:${localPort}`].includes(request.headers.host)) {
            response.writeHead(403).end();
            return;
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, { Allow: 'GET, HEAD' }).end();
            return;
        }
        if (!request.url?.startsWith('/') || request.url.startsWith('//') || request.url.includes('\\')) {
            response.writeHead(400).end();
            return;
        }
        const url = new URL(request.url, `http://${host}`);
        switch (url.pathname) {
            case pageRoute:
            case '/ordu-siralamasi':
            case documentRoutes['fetih-liderler']:
            case documentRoutes['fetih-ordular']:
                response.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; base-uri 'none'; form-action 'none'"
                }).end(request.method === 'HEAD' ? undefined :
                    [pageRoute, documentRoutes['fetih-liderler']].includes(url.pathname) ? page : armyPage);
                break;
            case dataRoute:
            case '/api/widget/state':
                try {
                    const kind = url.pathname === dataRoute ? 'fetih-liderler' : url.searchParams.get('type');
                    if (!Object.hasOwn(documentRoutes, kind)) { response.writeHead(404).end(); return; }
                    const { body, etag } = await (kind === 'fetih-ordular' ? readArmies : readStandings)();
                    if (url.searchParams.get('revision') === etag.slice(1, -1)) {
                        response.writeHead(204).end();
                        return;
                    }
                    if (request.headers['if-none-match'] === etag) {
                        response.writeHead(304, { ETag: etag }).end();
                        return;
                    }
                    const shared = url.pathname !== dataRoute;
                    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ETag: etag })
                        .end(request.method === 'HEAD' ? undefined : shared ?
                            `{"revision":${etag},"rows":${body}}` : body);
                } catch {
                    response.writeHead(503).end();
                }
                break;
            default:
                response.writeHead(404).end();
        }
    });

    server.once('error', error => {
        console.error(`Country leaders widget: ${error.code || 'server error'}`);
        process.exitCode = 1;
    });
    server.listen(port, host, () => {
        console.log(`http://${host}:${server.address().port}${pageRoute}`);
        if (licenseFile) {
            startPublisher({ port: server.address().port, licenseFile,
                statusFile: path.join(path.dirname(worldFile), 'widget-link-v1.json') })
                .catch(() => console.error('HTTPS widget publisher could not start.'));
        }
    });
    setInterval(() => {
        if (!parentAlive(parentPid)) process.exit(0);
    }, 1000).unref();
}

if (require.main === module) main(process.argv.slice(2)).catch(error => {
    console.error(`Country leaders widget: ${error.message}`);
    process.exitCode = 1;
});
module.exports = { startPublisher };
