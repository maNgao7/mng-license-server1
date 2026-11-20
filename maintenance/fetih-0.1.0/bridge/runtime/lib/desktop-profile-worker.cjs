'use strict';
// No connector import, owner discovery, settings, cookies or credentials here.
const { app, BrowserWindow, session } = require('electron');
const { createDesktopPortraits } = require('../vendor/portrait-engine.cjs');
const args = process.argv.slice(2);
const parentPid = Number(args[args.indexOf('--parent-pid') + 1]);
const userData = args[args.indexOf('--user-data') + 1];
if (!Number.isSafeInteger(parentPid) || parentPid < 1 || !userData) app.exit(1);
app.setPath('userData', userData);
app.setPath('sessionData', userData);
app.on('window-all-closed', () => {});
let portraits, monitor, stopping = false, active = 0;
function stop() {
    if (stopping) return;
    stopping = true; clearInterval(monitor); portraits?.close(); app.exit(0);
}
const ready = app.whenReady().then(() => {
    portraits = createDesktopPortraits({ BrowserWindow, session });
}).catch(() => app.exit(1));
process.on('message', async job => {
        await ready;
        if (stopping || !job || typeof job !== 'object') return;
        if (!Number.isSafeInteger(job.id) || job.id < 1
            || typeof job.username !== 'string' || !/^[a-z0-9_.]{1,64}$/.test(job.username)) return;
        let sources = [];
        if (active < 2) {
            active++;
            try { sources = await portraits.get(job.username); } catch {}
            finally { active--; }
        }
        if (!stopping && process.connected) process.send({ id: job.id, username: job.username, sources }, error => { if (error) stop(); });
});
process.once('disconnect', stop);
monitor = setInterval(() => {
    try { process.kill(parentPid, 0); } catch { stop(); }
}, 500);
process.once('SIGTERM', stop);
