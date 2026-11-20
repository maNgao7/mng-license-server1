'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createBridge } = require('./lib/server.cjs');
const { ownerFromEnvironment } = require('./lib/owner.cjs');

function parentAlive(pid) {
    try { process.kill(pid, 0); return true; }
    catch (error) { return error.code !== 'ESRCH'; }
}
function atomicJSON(file, value) {
    const temporary = file + '.' + process.pid + '.tmp';
    try {
        fs.writeFileSync(temporary, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
        fs.renameSync(temporary, file);
    } finally { fs.rmSync(temporary, { force: true }); }
}
async function run(argv = process.argv.slice(2)) {
    const args = {};
    for (let i = 0; i < argv.length; i += 2) {
        if (!['--descriptor', '--parent-pid'].includes(argv[i]) || !argv[i + 1] || args[argv[i]]) throw new Error('arguments');
        args[argv[i]] = argv[i + 1];
    }
    if (!args['--descriptor']) throw new Error('descriptor-required');
    const descriptor = path.resolve(args['--descriptor']);
    const parentPid = Number(args['--parent-pid'] || process.ppid);
    if (!Number.isSafeInteger(parentPid) || parentPid < 1 || parentPid === process.pid || !parentAlive(parentPid)) throw new Error('parent-pid');
    fs.mkdirSync(path.dirname(descriptor), { recursive: true });
    const lock = descriptor + '.lock';
    let lockFd;
    try { lockFd = fs.openSync(lock, 'wx', 0o600); }
    catch (error) {
        if (error.code !== 'EEXIST') throw error;
        let old;
        try { old = JSON.parse(fs.readFileSync(lock, 'utf8')); } catch { throw new Error('descriptor-lock'); }
        if (!Number.isSafeInteger(old.pid) || old.pid < 1 || parentAlive(old.pid)) throw new Error('descriptor-in-use');
        fs.rmSync(lock); lockFd = fs.openSync(lock, 'wx', 0o600);
    }
    fs.writeFileSync(lockFd, JSON.stringify({ pid: process.pid })); fs.closeSync(lockFd);
    let bridge, monitor, stopping = false, ready = false;
    async function stop() {
        if (stopping) return;
        stopping = true; clearInterval(monitor);
        await bridge?.close();
        try {
            const saved = JSON.parse(fs.readFileSync(descriptor, 'utf8'));
            if (bridge && saved.token === bridge.token) fs.rmSync(descriptor, { force: true });
        } catch {}
        fs.rmSync(lock, { force: true });
        // An in-flight SDK HTTP request cannot keep an orphan alive after the
        // descriptor, journal and server have been cleanly closed.
        if (ready && require.main === module) process.exit(0);
    }
    try {
        const owner = ownerFromEnvironment();
        const extraPort = Number(process.env.MNG_WIDGET_PORT);
        bridge = await createBridge({ owner, journalFile: descriptor + '.events.jsonl', enableProfileLookup: true,
            ownerPorts: [31975, 31976, 44181, extraPort] });
        atomicJSON(descriptor, { url: bridge.url, token: bridge.token });
        ready = true;
        monitor = setInterval(() => { if (!parentAlive(parentPid)) void stop(); }, 500);
        process.once('SIGTERM', () => { void stop(); });
        process.once('SIGINT', () => { void stop(); });
        process.stdout.write('[bridge] ready\n');
        return { bridge, stop };
    } catch (error) { await stop(); throw error; }
}
if (require.main === module) run().catch(error => {
    // Never print SDK exception bodies, inherited env, descriptor contents or tokens.
    process.stderr.write('[bridge] startup failed: ' + (/^[a-z-]+$/.test(error.message) ? error.message : 'runtime-or-storage') + '\n');
    process.exitCode = 1;
});
module.exports = { run, parentAlive };
