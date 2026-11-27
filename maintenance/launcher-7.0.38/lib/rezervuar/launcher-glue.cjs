'use strict';
const { spawn } = require('node:child_process');
const { createLauncherOwner } = require('./owner-helper.cjs');
const sessions = new WeakMap();

// Called by the Uslu Yaratık launcher branch.
// The existing launcher still owns its TikTok connection, native-game path
// validation, game lifecycle and window management. This wrapper injects the
// shared owner endpoint into the one game child and closes only the adapter.
function launchRezervuarWithSharedLive(options) {
    const { session, directory, executable = 'Rezervuar.exe', launchNativeGame,
        sharedGameEvents, ensureLive, getStatus, getChannel, catalogDirectory,
        journalFile, spawnProcess = spawn } = options;
    if (!session || typeof session.ownChild !== 'function' || !session.disposers?.add
        || typeof launchNativeGame !== 'function' || typeof sharedGameEvents?.subscribe !== 'function'
        || typeof journalFile !== 'string' || !journalFile) return Promise.reject(new Error('Rezervuar launcher adapter arguments required'));
    if (sessions.has(session)) return sessions.get(session);
    const job = (async () => {
        const owner = await createLauncherOwner({
            subscribeSharedEvents: listener => sharedGameEvents.subscribe(listener),
            ensureLive, getStatus, getChannel, catalogDirectory, journalFile });
        let closed = false;
        const close = async () => {
            if (closed) return;
            closed = true; await owner.close(); session.disposers.delete(close);
        };
        session.disposers.add(close);
        try {
            if (session.closed) throw new Error('Rezervuar launch cancelled');
            const child = await launchNativeGame({ session, directory, executable,
                spawnProcess: (file, args, childOptions = {}) => spawnProcess(file, args, {
                    ...childOptions,
                    env: { ...process.env, ...childOptions.env, ...owner.childEnvironment }
                }) });
            session.nativeChild = child;
            child.once('exit', () => { void close(); });
            child.once('error', () => { void close(); });
            return child;
        } catch (error) { await close(); throw error; }
    })();
    sessions.set(session, job);
    return job;
}
module.exports = { launchRezervuarWithSharedLive };
