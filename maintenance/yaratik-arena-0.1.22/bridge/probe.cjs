'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { atomicWrite, optionalJson, OWN_EVENT } = require('./storage.cjs');

const ACCOUNTS = ['benyigit61', 'hamzagrs', 'kysbekir', 'pekeronline'];
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function until(check, milliseconds) {
    const end = Date.now() + milliseconds;
    while (Date.now() < end) {
        const value = check();
        if (value) return value;
        await pause(100);
    }
    throw new Error('probe-wait-timeout');
}

async function probe(username) {
    const root = fs.mkdtempSync(path.join(__dirname, '.probe-'));
    const runtime = path.join(__dirname, 'runtime', 'node.exe');
    const child = spawn(fs.existsSync(runtime) ? runtime : process.execPath,
        [path.join(__dirname, 'index.cjs'), '--root', root, '--parent-pid', String(process.pid)],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let exited = false;
    let exitCode = null;
    let outputBytes = 0;
    child.stdout.on('data', chunk => { outputBytes += chunk.length; });
    child.stderr.on('data', chunk => { outputBytes += chunk.length; });
    child.on('exit', code => { exited = true; exitCode = code; });
    const exitedPromise = once(child, 'exit');
    const statusFile = path.join(root, 'userdata', 'live-status.json');
    const commandFile = path.join(root, 'userdata', 'live-command.json');
    const read = () => {
        try { return optionalJson(statusFile, 16384); } catch { return null; }
    };
    const result = { username, startedAt: new Date().toISOString(), connected: false,
        terminalGiftsObserved: 0, avatarEventsObserved: 0, received: 0, transitions: [] };
    let seq = Date.now();
    try {
        const initial = await until(() => read()?.epoch && read(), 10000);
        result.bootEpoch = initial.epoch;
        atomicWrite(commandFile, { seq: ++seq, op: 'connect', username });
        let previous = '';
        const state = await until(() => {
            if (exited) throw new Error('sidecar-exited');
            const current = read();
            if (!current || current.epoch === initial.epoch) return null;
            const signature = `${current.status}:${current.reason}`;
            if (signature !== previous) {
                result.transitions.push({ at: new Date().toISOString(), status: current.status, reason: current.reason });
                previous = signature;
            }
            return ['connected', 'waiting', 'error'].includes(current.status) ? current : null;
        }, 35000);
        result.connected = state.status === 'connected';
        result.epoch = state.epoch;
        if (result.connected) await pause(8000);
        const observed = read() || state;
        result.status = observed.status;
        result.reason = observed.reason;
        result.roomId = observed.roomId;
        result.received = observed.received;
        result.giftEvents = observed.giftEvents;
        result.lastEventAt = observed.lastEventAt;
        result.epochStableDuringObservation = observed.epoch === state.epoch;
        const directory = path.join(root, 'userdata', 'live-events');
        for (const name of fs.readdirSync(directory).filter(name => OWN_EVENT.test(name))) {
            const event = optionalJson(path.join(directory, name), 16384);
            if (event?.epoch !== state.epoch) continue;
            if (event.kind === 'gift') result.terminalGiftsObserved++;
            if (event.kind === 'avatar') {
                result.avatarEventsObserved++;
                if (!path.isAbsolute(event.avatarFile) || !event.avatarFile.startsWith(path.join(root, 'userdata', 'avatars') + path.sep)
                    || !fs.existsSync(event.avatarFile)) throw new Error('avatar-file-evidence-invalid');
            }
        }
        atomicWrite(commandFile, { seq: ++seq, op: 'disconnect', username: '' });
        const disconnected = await until(() => {
            const current = read();
            return current?.status === 'disconnected' && current.epoch !== state.epoch ? current : null;
        }, 5000);
        result.disconnectObserved = disconnected.status === 'disconnected';
        result.epochRotatedOnDisconnect = disconnected.epoch !== state.epoch;
    } catch (error) { result.failure = error.message; }
    finally {
        if (!exited && fs.existsSync(path.dirname(commandFile))) {
            atomicWrite(commandFile, { seq: ++seq, op: 'shutdown', username: '' });
            try { await until(() => exited, 6000); }
            catch { child.kill(); await exitedPromise; result.forcedOwnSidecarStop = true; }
        }
        result.sidecarExitCode = exitCode;
        result.sidecarOutputBytes = outputBytes;
        result.finishedAt = new Date().toISOString();
        const exactRoot = fs.realpathSync(root);
        if (path.dirname(exactRoot) !== fs.realpathSync(__dirname) || !path.basename(exactRoot).startsWith('.probe-')) {
            throw new Error('probe-cleanup-outside-owned-directory');
        }
        fs.rmSync(exactRoot, { recursive: true });
    }
    return result;
}

async function main() {
    const report = { startedAt: new Date().toISOString(), sdkVersion: '2.4.4',
        mode: 'sequential isolated actual SDK connections through file IPC; receive only',
        accounts: [], finishedAt: null };
    const output = path.resolve(__dirname, '..', 'qa', 'bridge-live-result.json');
    atomicWrite(output, report);
    for (const username of ACCOUNTS) {
        process.stdout.write(`Probing @${username} through IPC...\n`);
        const result = await probe(username);
        report.accounts.push(result);
        atomicWrite(output, report);
        process.stdout.write(`@${username}: ${result.status || 'failed'} / ${result.reason || result.failure}; received=${result.received}, gifts=${result.terminalGiftsObserved}, avatars=${result.avatarEventsObserved}\n`);
    }
    report.finishedAt = new Date().toISOString();
    atomicWrite(output, report);
    process.stdout.write(`Evidence: ${output}\n`);
    if (report.accounts.some(result => result.failure || result.forcedOwnSidecarStop || result.sidecarExitCode !== 0)) process.exitCode = 1;
}

if (require.main === module) main().catch(() => {
    process.stderr.write('Live probe failed; inspect the evidence file.\n');
    process.exitCode = 1;
});

module.exports = { probe, ACCOUNTS };
