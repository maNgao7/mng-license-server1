'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const { createHash } = require('node:crypto');

const busy = () => new Error('Turkish Forza başka bir pencerede başlatılıyor. Açık oyunu kapatıp tekrar deneyin.');
function processExists(pid) {
    if (!Number.isSafeInteger(pid) || pid <= 0) return false;
    try { process.kill(pid, 0); return true; }
    catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}

async function acquireForzaLaunchLock(directory, assertSafePath, checkProcess) {
    const canonical = await fs.realpath(assertSafePath(directory));
    const key = createHash('sha256').update(canonical.toLowerCase()).digest('hex').slice(0, 24);
    const pipe = String.raw`\\.\pipe\tikmng-forza-` + key;
    const server = net.createServer(socket => socket.destroy());
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen({ path: pipe, exclusive: true }, () => {
            server.removeListener('error', reject);
            resolve();
        });
    }).catch(error => { if (error.code === 'EADDRINUSE' || error.code === 'EACCES') throw busy(); throw error; });
    const closePipe = () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    const lock = assertSafePath(path.join(canonical, '.launch-lock'));
    let handle;
    async function acquireFile() {
        try { return await fs.open(lock, 'wx'); }
        catch (error) { if (error.code !== 'EEXIST') throw error; }
        let existing;
        try { existing = await fs.open(lock, 'r'); }
        catch (error) { if (error.code === 'ENOENT') throw busy(); throw error; }
        try {
            const stat = await existing.stat();
            let pid;
            if (stat.size < 1024) {
                try { pid = JSON.parse(await existing.readFile('utf8')).pid; }
                catch (error) { if (!(error instanceof SyntaxError)) throw error; }
            }
            if (processExists(pid) || (!pid && Date.now() - stat.mtimeMs < 10_000)) throw busy();
        } finally { await existing.close(); }
        checkProcess();
        // The pipe serializes recovery. Move the obsolete file aside before acquiring
        // a new file so a legacy launcher using exclusive creation is also respected.
        const stale = assertSafePath(lock + '.stale-' + process.pid);
        await fs.rename(lock, stale);
        try {
            try { return await fs.open(lock, 'wx'); }
            catch (error) { if (error.code === 'EEXIST') throw busy(); throw error; }
        } finally { await fs.rm(stale, { force: true }); }
    }
    let releasePromise;
    const release = () => releasePromise ??= (async () => {
        try {
            if (handle) {
                await handle.close();
                await fs.rm(lock, { force: true });
            }
        } finally { await closePipe(); }
    })();
    try {
        checkProcess();
        handle = await acquireFile();
        await handle.writeFile(JSON.stringify({ schemaVersion: 1, pid: process.pid }));
        return release;
    } catch (error) {
        await release();
        throw error;
    }
}

module.exports = { acquireForzaLaunchLock };
