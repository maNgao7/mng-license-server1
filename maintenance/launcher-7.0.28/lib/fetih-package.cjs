'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { assertSafePath } = require('./download.cjs');

const EXECUTABLE = 'Fetih.exe';
const OWNER_HELPER = 'bridge/runtime/owner-helper.cjs';

function validatePackageDirectory(directory) {
    if (!directory) return false;
    try {
        const files = [EXECUTABLE, 'Fetih.pck',
            'bridge/runtime/node.exe', OWNER_HELPER, 'bridge/runtime/gift-assets/katalog_tam.json'];
        return files.every(file => fs.statSync(assertSafePath(path.join(directory, file))).isFile());
    } catch { return false; }
}

async function launchFetih({ directory, dataDirectory, session, events, getChannel, getStatus }) {
    if (!validatePackageDirectory(directory)) throw new Error('Fetih paketi eksik. Launcher’dan dosyaları onarın.');
    await fs.promises.mkdir(dataDirectory, { recursive: true });
    const signalPath = path.join(dataDirectory, `startup-${randomUUID()}.signal`);
    const { createLauncherOwner } = require(path.join(directory, OWNER_HELPER));
    const owner = await createLauncherOwner({
        subscribeSharedEvents: events.subscribe,
        ensureLive: session.ensureLive,
        getChannel,
        getStatus,
        catalogDirectory: path.join(directory, 'bridge/runtime/gift-assets'),
        journalFile: path.join(dataDirectory, 'launcher-live.jsonl'),
        portraitDirectory: path.join(dataDirectory, 'launcher-portraits')
    });
    if (session.closed) {
        await owner.close();
        throw new Error('Fetih açılışı iptal edildi.');
    }
    session.disposers.add(() => owner.close());
    const env = { ...process.env, ...owner.childEnvironment,
        TIKMNG_ANIMAL_PROFILE: dataDirectory, TIKMNG_FETIH_STARTUP_SIGNAL: signalPath };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    delete env.NODE_PATH;
    try {
        const child = spawn(path.join(directory, EXECUTABLE), [], {
            cwd: directory, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
        });
        session.ownChild(child, { normalExit: true });
        session.nativeChild = child;
        await session.stage('game-ready', 'Türkiye haritası ve Fetih menüsü yükleniyor…', async () => {
            while (!session.closed) {
                try {
                    if ((await fs.promises.readFile(signalPath, 'utf8')).trim() === '4') return;
                } catch (error) {
                    if (!['ENOENT', 'EBUSY', 'EPERM'].includes(error.code)) throw error;
                }
                await delay(100);
            }
            throw session.error || new Error('Fetih açılışı iptal edildi.');
        }, 45000);
        session.markReady('Fetih hazır.');
        return { basarili: true };
    } finally {
        await fs.promises.rm(signalPath, { force: true });
    }
}

module.exports = { validatePackageDirectory, launchFetih };
