'use strict';

const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { EventEmitter, once } = require('node:events');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const vm = require('node:vm');

const root = process.env.HEDIYE_BOX_QA_APP_ROOT
  ? path.resolve(process.env.HEDIYE_BOX_QA_APP_ROOT) : path.resolve(__dirname, '..');
const mainFile = path.join(root, 'main.cjs');
const load = createRequire(mainFile);
const completed = 'Desktop round assertions passed';

async function openDesktop(profile) {
  const { app, BrowserWindow, ipcMain, Menu, screen, session } = require('electron');
  app.disableHardwareAcceleration();
  app.setPath('appData', profile);
  await app.whenReady();
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (_request, callback) => callback({ cancel: true }));

  let contents, events, startError;
  const shortcuts = new Map();
  const pendingTicks = [];
  const calls = { starts: 0, stages: [], punches: [], windowShows: [], cameras: [] };
  const native = new EventEmitter();
  const opened = once(native, 'opened');
  Object.assign(native, {
    open() { this.worker = true; this.gamePid = 1; this.emit('opened'); },
    close() { this.worker = false; this.gamePid = null; },
    async stage(lineup) { calls.stages.push([...lineup]); },
    async resetRound(lineup) {
      calls.stages.push([...lineup]);
      native.emit('state',{phase:'waiting',lineup,health:lineup.map(on=>on?1:null)});
    },
    async startMatch() {
      calls.starts++;
      if (startError) throw startError;
      return { started: true };
    },
    async punch(action) { calls.punches.push(action); },
    async setCamera(mode) { calls.cameras.push(mode);return {mode}; }
  });

  // Keep Electron's renderer, sender identity, sandboxed preload and IPC intact.
  // Suppress OS focus, global key grabs, native processes and live connections.
  class HiddenWindow extends BrowserWindow {
    constructor(options) {
      super({ ...options, show: false, webPreferences:{...options.webPreferences,
        additionalArguments:(options.webPreferences?.additionalArguments||[]).filter(arg=>arg!=='--native-hud-controls')} });
      contents = this.webContents;
      contents.on('console-message', (_event, level, message) => {
        if (level >= 2) console.error(message);
      });
      contents.setAudioMuted(true);
    }
    show() { calls.windowShows.push('show'); }
    showInactive() { calls.windowShows.push('showInactive'); }
    focus() {}
    moveTop() {}
    setAlwaysOnTop() {}
  }
  const { DesktopController } = load('./src/desktop-controller.cjs');
  class OfflineController extends DesktopController {
    constructor(options) {
      super({ ...options, createLive(callbacks) { events = callbacks; return { close() {} }; },
        findGames: async () => { throw new Error('Unexpected native launch'); },
        spawnGame: () => { throw new Error('Unexpected native process'); }
      });
    }
  }
  const replacements = new Map([
    ['electron', { app, BrowserWindow: HiddenWindow, ipcMain, Menu, screen,
      dialog: { showErrorBox(_title, message) { throw new Error(message); } },
      globalShortcut: {
        unregisterAll() { shortcuts.clear(); },
        register(key, handler) { shortcuts.set(key, handler); return true; }
      }
    }],
    ['./src/desktop-controller.cjs', { DesktopController: OfflineController }],
    ['./src/native-spectator.cjs', { NativeSpectator: class { constructor() { return native; } } }],
    ['./src/native-window.cjs', { focusNativeGame: async () => {} }],
    ['./src/native-hud.cjs', {createNativeHud:()=>({file:null,state(){},camera(){},geometry(){},async close(){}})}],
    ['./src/launcher-widget-access.cjs', {createLauncherWidgetAccess:()=>({store:{get:()=>'',set(){}},getCredentials:async()=>null})}],
    ['./src/game-options.cjs', { createGameOptions: options =>
      load('./src/game-options.cjs').createGameOptions({...options,spawnWorker:null}) }],
    ['node:timers/promises', {
      setTimeout: ms => new Promise(resolve => pendingTicks.push({ ms, resolve }))
    }]
  ]);
  const runMain = vm.compileFunction(fs.readFileSync(mainFile, 'utf8'), ['require', '__dirname', '__filename'], { filename: mainFile });
  runMain(id => replacements.get(id) ?? load(id), root, mainFile);
  await opened;

  const evaluate = (fn, ...args) => contents.executeJavaScript('(' + fn.toString() + ')(...' + JSON.stringify(args) + ')');
  return {
    evaluate, events, native, calls, shortcuts, pendingTicks,
    capture: async () => { contents.invalidate(); await new Promise(resolve=>setTimeout(resolve,100)); return contents.capturePage(undefined,{stayHidden:true,stayAwake:true}); },
    state: () => evaluate(() => window.hediyeBox.getState()),
    rejectStart(error) { startError = error; },
    globalKey(key) {
      assert.ok(shortcuts.has(key), 'Missing registered shortcut ' + key);
      shortcuts.get(key)();
    },
    async key(key, targetId, options = {}) {
      return evaluate((key, targetId, options) => {
        const target = targetId ? document.getElementById(targetId) : document.body;
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
        target.dispatchEvent(event);
        return event.defaultPrevented;
      }, key, targetId, options);
    },
    async tick() {
      assert.equal(pendingTicks.length, 1, 'Expected one pending countdown timer');
      const timer = pendingTicks.shift();
      assert.equal(timer.ms, 1000, 'Each displayed countdown value lasts one second');
      timer.resolve();
      await new Promise(resolve => setImmediate(resolve));
    }
  };
}

function desktopTests(entry, scenarios) {
  if (process.versions.electron) {
    const { app } = require('electron');
    const profile = app.commandLine.getSwitchValue('user-data-dir');
    const run = async () => {
      assert.ok(profile, 'An isolated Electron profile is required');
      await scenarios[process.env.HEDIYE_BOX_QA_CASE](await openDesktop(profile));
      process.stdout.write(completed + '\n', () => app.exit(0));
    };
    run().catch(error => process.stderr.write(error.stack + '\n', () => app.exit(1)));
    return;
  }

  const test = require('node:test');
  for (const name of Object.keys(scenarios)) {
    test(name, async t => {
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hediye-box-round-'));
      t.after(() => fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }));
      // Same installed Electron used by tools/package-desktop.ps1.
      const electron = require(path.resolve(__dirname, '../../../frog-river/node_modules/electron'));
      const env = { ...process.env, HEDIYE_BOX_QA_CASE: name };
      delete env.ELECTRON_RUN_AS_NODE;
      const { stdout } = await promisify(execFile)(electron, [entry, '--user-data-dir=' + profile, '--mute-audio',
        '--disable-background-networking'], { env, windowsHide: true, timeout: 25000 });
      assert.ok(stdout.includes(completed), 'Electron exited before the round assertions completed');
    });
  }
}

module.exports = { desktopTests };
