'use strict';

// Explicit manual smoke test; never run by release-gate.ps1. No bridge,
// credentials, live events, settings writes or test gifts are involved.
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { GameLaunchSession } = require('../lib/game-launch-session.cjs');
const { launchUnturned, createUnturnedProcessControl } = require('../lib/unturned-startup.cjs');

async function main() {
    const [flag, directory] = process.argv.slice(2);
    if (flag !== '--launch-steam' || !directory || process.platform !== 'win32') {
        throw new Error('Manual only: node tests/unturned-steam-qa.cjs --launch-steam <discovered absolute Unturned directory>');
    }
    const print = data => console.log(JSON.stringify(data));
    const control = createUnturnedProcessControl({ directory });
    const before = await control.probe();
    if (before.length) throw new Error('Existing Unturned process detected; refusing real Steam QA.');
    print({ phase: 'preflight', processes: 0, directory });
    const session = new GameLaunchSession({ game: 'gelene-gecene', title: 'Gelene Geçene',
        onProgress: event => print({ phase: event.phase, message: event.mesaj }) });
    const execute = promisify(execFile);
    let requests = 0;
    const started = Date.now();
    const finish = async reason => {
        await session.close();
        const after = await control.probe();
        print({ phase: 'closed', reason, processes: after.length, cleanupError: session.cleanupError?.message || null });
        if (session.cleanupError || after.length) process.exitCode = 1;
    };
    process.once('SIGINT', () => { void finish('SIGINT'); });
    process.once('SIGTERM', () => { void finish('SIGTERM'); });
    try {
        const options = { session, directory, control, openExternal: async url => {
            requests++;
            const script = "$ErrorActionPreference='Stop'; Start-Process -FilePath '" + url.replace(/'/g, "''") + "' -WindowStyle Hidden";
            await execute(path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
                ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
                { windowsHide: true, timeout: 10000, maxBuffer: 65536 });
        } };
        const owned = await launchUnturned(options);
        session.markReady('Gerçek Unturned süreci ve penceresi doğrulandı; görsel kontrol bekleniyor.');
        const again = await launchUnturned(options);
        if (again.pid !== owned.pid || requests !== 1) throw new Error('Duplicate launch was not coalesced.');
        print({ phase: 'ready-evidence', elapsedMs: Date.now() - started, steamRequests: requests, ...owned });
        print({ phase: 'awaiting-visual-check', instruction: 'Inspect the actual game window. The owned PID closes automatically in 30 seconds.' });
        await new Promise(resolve => setTimeout(resolve, 30000));
        await finish('automatic-finite-close');
    } catch (error) { await finish('startup-failure'); throw error; }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
