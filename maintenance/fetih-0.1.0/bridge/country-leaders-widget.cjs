'use strict';

const { createHash } = require('node:crypto');
const { open, readFile } = require('node:fs/promises');
const { createServer } = require('node:http');
const path = require('node:path');

const host = '127.0.0.1';
const pageRoute = '/ulke-liderleri';
const dataRoute = `${pageRoute}/data`;
const pageFile = path.join(__dirname, 'assets/widgets/country-leaders.html');
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

function openStandings(worldFile) {
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

            const source = await file.readFile('utf8');
            const next = update(publicRows(JSON.parse(source.replace(/^\uFEFF/, ''))));
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

async function main([worldFile, parentArg, portArg = '32187', ...extra]) {
    const parentPid = Number(parentArg);
    const port = Number(portArg);
    if (!worldFile || !path.isAbsolute(worldFile) || !/^\d+$/.test(parentArg ?? '') || parentPid < 1
        || parentPid > 0x7fff_ffff || parentPid === process.pid || !/^\d+$/.test(portArg) || port > 65535 || extra.length) {
        throw new Error('Usage: node country-leaders-widget.cjs <absolute-world-v1.json> <parent-pid> [port]');
    }

    if (!parentAlive(parentPid)) return;
    const page = await readFile(pageFile);
    const readStandings = openStandings(worldFile);
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
        switch (request.url.split('?', 1)[0]) {
            case pageRoute:
                response.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; base-uri 'none'; form-action 'none'",
                }).end(request.method === 'HEAD' ? undefined : page);
                break;
            case dataRoute:
                try {
                    const { body, etag } = await readStandings();
                    if (request.headers['if-none-match'] === etag) {
                        response.writeHead(304, { ETag: etag }).end();
                        return;
                    }
                    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ETag: etag })
                        .end(request.method === 'HEAD' ? undefined : body);
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
    });
    setInterval(() => {
        if (!parentAlive(parentPid)) process.exit(0);
    }, 1000).unref();
}

main(process.argv.slice(2)).catch(error => {
    console.error(`Country leaders widget: ${error.message}`);
    process.exitCode = 1;
});
