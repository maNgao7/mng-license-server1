'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const { CancellationToken } = require('builder-util-runtime');
const { NodeHttpExecutor } = require('builder-util/out/nodeHttpExecutor');
const { GenericDifferentialDownloader } = require('electron-updater/out/differentialDownloader/GenericDifferentialDownloader');
const { computeOperations } = require('electron-updater/out/differentialDownloader/downloadPlanBuilder');

const fromVersion = process.env.MNG_DIFF_FROM || '7.0.7', toVersion = process.env.MNG_DIFF_TO || '7.0.8';
const root = `D:/TikMnG-Release-${toVersion}-ready`;
const oldFile = `D:/TikMnG-Release-${fromVersion}-ready/TikMnG-Setup-${fromVersion}.exe`;
const newFile = path.join(root, `TikMnG-Setup-${toVersion}.exe`);
const output = path.join(root, 'qa');
const logger = { info() {}, warn() {}, error() {}, debug: null };
const readMap = file => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function main() {
    fs.mkdirSync(output, { recursive: true });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, `manifest-${toVersion}.json`)));
    const installer = manifest.files.find(file => file.name === path.basename(newFile));
    const oldMap = readMap(oldFile + '.blockmap'), newMap = readMap(newFile + '.blockmap');
    const plan = computeOperations(oldMap, newMap, logger);
    const downloadBytes = plan.filter(operation => operation.kind === 1).reduce((sum, operation) => sum + operation.end - operation.start, 0);
    const reusedBytes = plan.filter(operation => operation.kind === 0).reduce((sum, operation) => sum + operation.end - operation.start, 0);
    assert.equal(downloadBytes + reusedBytes, installer.bytes);
    const before = hash(oldFile);
    let requests = 0, servedBytes = 0;
    const server = http.createServer((request, response) => {
        const range = /^bytes=(\d+)-(\d+)$/.exec(request.headers.range || '');
        if (!range) { response.writeHead(416); response.end(); return; }
        const start = Number(range[1]), end = Number(range[2]);
        assert.ok(end < installer.bytes && start <= end);
        requests++; servedBytes += end - start + 1;
        response.writeHead(206, { 'Content-Length': end - start + 1,
            'Content-Range': `bytes ${start}-${end}/${installer.bytes}`, 'Accept-Ranges': 'bytes' });
        fs.createReadStream(newFile, { start, end }).pipe(response);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const rebuilt = path.join(output, `rebuilt-${toVersion}.exe`);
    const began = performance.now();
    const publicURL = process.env.MNG_PUBLIC_DIFFERENTIAL_URL;
    // Electron net follows redirects; NodeHttpExecutor does not in this code path.
    // Resolve GitHub's signed asset URL before using the Node-only test executor.
    let downloadURL = publicURL;
    if (publicURL) {
        const response = await fetch(publicURL, { method: 'HEAD' });
        assert.equal(response.status, 200);
        assert.equal(Number(response.headers.get('content-length')), installer.bytes);
        const resolved = new URL(response.url);
        assert.equal(resolved.protocol, 'https:');
        assert.ok(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(resolved.hostname));
        downloadURL = resolved.href;
    }
    try {
        const downloader = new GenericDifferentialDownloader({ size: installer.bytes, sha512: installer.sha512 }, new NodeHttpExecutor(), {
            oldFile, newFile: rebuilt, newUrl: new URL(downloadURL || `http://127.0.0.1:${server.address().port}/setup.exe`),
            logger, cancellationToken: new CancellationToken(), isUseMultipleRangeRequest: false, requestHeaders: {}
        });
        await downloader.download(oldMap, newMap);
    } finally { await new Promise(resolve => server.close(resolve)); }
    const elapsedMs = Math.round(performance.now() - began);
    assert.equal(hash(rebuilt), installer.sha256);
    assert.equal(hash(oldFile), before);
    if (!publicURL) assert.equal(servedBytes, downloadBytes);
    const report = { passed: true, fromVersion, toVersion, realElectronUpdaterDownloader: true,
        publicGitHubDownload: Boolean(publicURL), installerLaunched: false, elapsedMs,
        fullInstallerBytes: installer.bytes, downloadBytes, reusedBytes, httpRequests: publicURL ? null : requests,
        rebuiltSha256: installer.sha256, previousInstallerBytePreserved: true,
        note: 'This tests changed-byte transfer and installer checksums, not a guaranteed internet download speed.' };
    fs.writeFileSync(path.join(output, publicURL ? 'public-differential-verification.json' : 'differential-verification.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(error.stack); process.exitCode = 1; });
