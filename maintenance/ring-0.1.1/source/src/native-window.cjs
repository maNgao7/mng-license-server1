'use strict';
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const runFile = promisify(execFile);

// Product window activation. No key injection, game-state writes or hooks.
async function focusNativeGame(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('Geçersiz oyun süreci.');
  await runFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-File',
    path.join(__dirname, '../tools/focus-game.ps1'), '-GameProcessId', String(pid)],
  { windowsHide: true, timeout: 15000 });
}
module.exports = { focusNativeGame };
