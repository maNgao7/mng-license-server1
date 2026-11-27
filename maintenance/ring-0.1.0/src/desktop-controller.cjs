'use strict';
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { HediyeBoxMatch } = require('./match-core.cjs');
const { createHediyeBoxLive } = require('./live-client.cjs');
const { NATIVE_CAPABILITIES } = require('./native-capabilities.cjs');
const { focusNativeGame } = require('./native-window.cjs');
const runFile = promisify(execFile);
const GAME_PATH = require('./runtime-paths.cjs').gamePath();

async function runningBoxingGames() {
  const { stdout } = await runFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "@(Get-Process -Name boxing -ErrorAction SilentlyContinue | ForEach-Object { @{pid=$_.Id; path=$_.Path} }) | ConvertTo-Json -Compress"],
  { windowsHide: true, timeout: 5000 });
  const data = stdout.trim() ? JSON.parse(stdout) : [];
  return Array.isArray(data) ? data : [data];
}

class DesktopController extends EventEmitter {
  constructor({ gamePath = GAME_PATH, spawnGame = spawn, findGames = runningBoxingGames,
    createLive = createHediyeBoxLive, capabilities = NATIVE_CAPABILITIES, focusGame = focusNativeGame,
    onChat = () => {}, onGiftRaw = () => {}, onLike = () => {}, onFollow = () => {}, onPortrait } = {}) {
    super();
    this.gamePath = gamePath; this.spawnGame = spawnGame; this.findGames = findGames;
    this.capabilities = capabilities; this.match = new HediyeBoxMatch(); this.focusGame = focusGame;
    this.child = null; this.launching = null; this.closed = false;
    this.externalGame = null; this.externalMonitor = null;
    this.phase = 'idle'; this.message = 'Yayın hesabını bağla veya orijinal oyunu aç.';
    this.camera = 'free'; this.liveState = { status: 'disconnected', username: '', message: 'Yayına bağlı değil.' };
    this.live = createLive({ match: this.match,
      onStatus: value => { this.liveState = value; this.notify(); },
      onGift: () => this.notify(),
      onChat, onGiftRaw, onLike, onFollow, onPortrait,
    });
  }
  snapshot() {
    return { phase: this.phase, message: this.message, live: { ...this.liveState },
      native: { ...this.capabilities }, camera: this.camera,
      match: this.match.snapshot(), gameRunning: !!this.externalGame || (!!this.child && this.child.exitCode === null) };
  }
  notify() { if (!this.closed) this.emit('state', this.snapshot()); }
  assertOpen() { if (this.closed) throw new Error('Uygulama kapanıyor.'); }
  async connect(username) {
    this.assertOpen();
    const result = await this.live.start(username);
    this.notify(); return result;
  }
  launchGame() {
    this.assertOpen();
    if ((this.child && this.child.exitCode === null) || this.externalGame) {
      return this.focusGame((this.child || this.externalGame).pid).then(() => this.snapshot());
    }
    if (this.launching) return this.launching;
    this.launching = this.launch().finally(() => { this.launching = null; });
    return this.launching;
  }
  async launch() {
    this.phase = 'starting'; this.message = 'Orijinal Online Boxing ringi açılıyor…'; this.notify();
    try {
      const active = await this.findGames();
      this.assertOpen();
      const existing = active.length === 1 && path.resolve(active[0].path || '') === path.resolve(this.gamePath)
        ? active[0] : null;
      if (active.length && !existing) throw new Error('Online Boxing başka bir kurulumdan açık. İkinci oyun kopyası açılmadı.');
      const actual = crypto.createHash('sha256').update(await fs.promises.readFile(this.gamePath)).digest('hex');
      if (actual !== this.capabilities.buildSha256) throw new Error('Oyun sürümü değişmiş. Uyum kontrolü gerekiyor.');
      this.assertOpen();
      if (existing) {
        await this.focusGame(existing.pid);
        this.assertOpen(); this.externalGame = existing;
        this.phase = 'open'; this.message = 'Ring açık.';
        this.watchExternal(); this.notify(); return this.snapshot();
      }
      const child = this.spawnGame(this.gamePath, ['player_vs_player'], {
        cwd: path.dirname(this.gamePath), windowsHide: true, stdio: 'ignore',
      });
      this.child = child;
      child.once('exit', (code) => {
        if (this.child !== child) return;
        this.child = null;
        this.phase = code === 0 ? 'idle' : 'error';
        this.message = code === 0 ? 'Oyun kapandı.' : `Oyun kapandı (kod: ${code ?? 'bilinmiyor'}).`;
        this.notify();
      });
      await new Promise((resolve, reject) => {
        child.once('spawn', resolve); child.once('error', reject);
        child.once('exit', code => reject(new Error(`Oyun açılırken kapandı (kod: ${code ?? 'bilinmiyor'}).`)));
      });
      this.assertOpen();
      await this.focusGame(child.pid);
      this.assertOpen();
      if (this.child !== child || child.exitCode !== null) throw new Error('Oyun penceresi açılmadan kapandı.');
      this.phase = this.capabilities.ready ? 'ready' : 'open';
      this.message = 'Ring açık.';
      this.notify(); return this.snapshot();
    } catch (error) {
      if (this.closed) throw error;
      this.phase = 'error';
      this.message = error.code === 'ENOENT' ? 'Online Boxing test kurulumu bulunamadı.' : error.message;
      this.notify(); throw new Error(this.message);
    }
  }
  watchExternal() {
    clearTimeout(this.externalMonitor);
    this.externalMonitor = setTimeout(async () => {
      if (this.closed || !this.externalGame) return;
      try {
        const active = await this.findGames();
        if (this.closed || !this.externalGame) return;
        if (!active.some(game => game.pid === this.externalGame.pid && path.resolve(game.path || '') === path.resolve(this.gamePath))) {
          this.externalGame = null; this.phase = 'idle'; this.message = 'Oyun kapandı.'; this.notify(); return;
        }
      } catch (error) { this.message = 'Oyun durumu okunamadı: ' + error.message; this.notify(); }
      this.watchExternal();
    }, 2500);
    this.externalMonitor.unref();
  }
  testGift(side) {
    this.assertOpen();
    if (!['left', 'right'].includes(side)) throw new Error('Geçersiz taraf.');
    if (!this.capabilities.ready || !this.child) throw new Error('Oyundaki yumruk kontrolü henüz hazır değil.');
    // No test credits can enter live leader standings.
    const result = this.match.ingestGift({ eventId: `test-${crypto.randomUUID()}`,
      giftId: side === 'left' ? '5655' : '5269', repeatCount: 1,
      userId: `test-${side}`, uniqueId: `test_${side}`, nickname: 'Test', isTest: true });
    this.notify(); return result;
  }
  setCamera(mode) {
    if (!['free', 'back', 'first'].includes(mode)) throw new Error('Geçersiz kamera.');
    throw new Error('Kamera kısayolu henüz bağlanmadı. Oyun içindeki kamera menüsünü kullan.');
  }
  closeGame() {
    clearTimeout(this.externalMonitor); this.externalGame = null;
    if (this.child && this.child.exitCode === null) {
      const child = this.child; this.child = null; child.kill();
    }
    this.phase = 'idle'; this.message = 'Oyun kapatıldı.'; this.notify();
    return this.snapshot();
  }
  close() {
    if (this.closed) return;
    this.closed = true; this.live.close(); this.closeGame(); this.removeAllListeners();
  }
}
module.exports = { DesktopController, runningBoxingGames, GAME_PATH };
