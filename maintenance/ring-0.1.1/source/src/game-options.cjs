'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');

const defaults = Object.freeze({ gameVolume: 50, effectsVolume: 60, quality: 'high', flashes: true,
  standingsCollapsed: false, queueCollapsed: false, showStandings: true, standingsScale: 100, showQueue: true, queueScale: 100 });
const helper = path.join(__dirname, '../tools/game-volume.ps1');

function normalize(key, value) {
  if (key === 'flashes' && typeof value === 'boolean') return value;
  if (['showStandings','showQueue','standingsCollapsed','queueCollapsed'].includes(key) && typeof value === 'boolean') return value;
  if (['standingsScale','queueScale'].includes(key) && Number.isFinite(value)) {
    return Math.round(Math.max(60, Math.min(140, value)) / 5) * 5;
  }
  if (key === 'quality' && ['low', 'medium', 'high'].includes(value)) return value;
  if ((key === 'gameVolume' || key === 'effectsVolume') && Number.isFinite(value)) {
    return Math.round(Math.max(0, Math.min(100, value)));
  }
  throw new TypeError('Invalid game setting: ' + key);
}

function load(settingsPath) {
  const settings = { ...defaults };
  let saved;
  try {
    saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return settings;
    throw error;
  }
  if (saved?.schemaVersion !== 1 || !saved.settings) return settings;
  for (const key of Object.keys(defaults)) {
    if (!Object.hasOwn(saved.settings, key)) continue;
    try { settings[key] = normalize(key, saved.settings[key]); } catch { /* Keep the field default. */ }
  }
  return settings;
}

function save(settingsPath, settings) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  const temp = settingsPath + '.' + randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temp, JSON.stringify({ schemaVersion: 1, settings }), { flag: 'wx', flush: true });
    fs.renameSync(temp, settingsPath);
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

// Main calls syncNative when the native PID appears, changes or disappears.
// Repeated state notifications for the same PID and volume are inexpensive.
function createGameOptions({ settingsPath, getGamePid, spawnWorker = process.platform === 'win32' ? spawn : null }) {
  let settings = load(settingsPath);
  let session = null;
  let closed = false;

  function stop() {
    const previous = session;
    session = null;
    if (!previous) return;
    clearTimeout(previous.timer);
    previous.child?.kill();
  }

  function schedule(target, delay) {
    clearTimeout(target.timer);
    target.timer = setTimeout(() => send(target), delay);
    target.timer.unref?.();
  }

  function retry(target, reason) {
    if (target.retry === 500) console.warn('[Hediye Box audio] Volume helper unavailable:', reason);
    schedule(target, target.retry);
    target.retry = Math.min(target.retry * 2, 15000);
  }

  function send(target) {
    // The game can exit or restart during debounce or a helper retry.
    syncNative();
    if (session !== target || target.ended) return;
    if (!target.child) {
      let child;
      try {
        child = spawnWorker('powershell.exe', ['-NoProfile', '-NonInteractive', '-Mta', '-File',
          helper, '-GameProcessId', String(target.pid)], { windowsHide: true, stdio: ['pipe', 'ignore', 'inherit'] });
      } catch (error) {
        retry(target, error.message);
        return;
      }
      target.child = child;
      const disconnected = (reason, code) => {
        if (session !== target || target.child !== child) return;
        target.child = null;
        child.kill();
        if (code === 3) target.ended = true; // PID exited or did not identify boxing.
        else retry(target, reason);
      };
      child.once('error', error => disconnected(error.message));
      child.once('exit', code => disconnected(code, code));
      child.stdin.on('error', error => disconnected(error.message));
    }
    target.child.stdin.write(String(target.volume) + '\n');
  }

  function syncNative() {
    if (closed || !spawnWorker) return;
    const pid = getGamePid();
    if (session && session.pid !== pid) stop();
    if (!Number.isInteger(pid) || pid < 1 || pid > 0x7fffffff) return;
    if (!session) session = { pid, child: null, retry: 500 };
    if (session.ended || session.volume === settings.gameVolume) return;
    session.volume = settings.gameVolume;
    schedule(session, 100);
  }

  function configure(patch) {
    if (closed) throw new Error('Game options are closed');
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Expected a settings patch');
    const next = { ...settings };
    for (const key of Object.keys(defaults)) {
      if (Object.hasOwn(patch, key)) next[key] = normalize(key, patch[key]);
    }
    const changedVolume = next.gameVolume !== settings.gameVolume;
    if (Object.keys(defaults).some(key => next[key] !== settings[key])) {
      save(settingsPath, next);
      settings = next;
      if (changedVolume) syncNative();
    }
    return { ...settings };
  }

  return {
    snapshot: () => ({ ...settings }),
    configure,
    syncNative,
    close() { closed = true; stop(); },
  };
}

module.exports = { createGameOptions };
