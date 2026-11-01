'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = fs.promises;
const http = require('node:http');
const path = require('node:path');
const { promisify } = require('node:util');
const { spawn, execFile: execFileCallback } = require('node:child_process');
const execFile = promisify(execFileCallback);
const { createGameLibrary } = require('../lib/game-library.cjs');
const { parseContentPackage } = require('../lib/game-content.cjs');
const { hashFile } = require('../lib/download.cjs');
const { runtimeDirectory } = require('../lib/runtime-location.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'qa/713');
const PREVIOUS = 'D:/TikMnG-Update-QA-20261030/shared-packages';
const CANDIDATE = 'D:/TikMnG-Release-7.0.13-ready/games/snow-war';
const SHARED_REPORT = path.resolve(ROOT, '../launcher-update-20261030/qa/20261030/shared-install-report.json');
const CHANGED = ['game-instance/mods/mng-snow-war-1.0.0.jar', 'live-bridge/events.js'];
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));

async function nativeSender(report, log) {
  const isolatedRoot = fs.realpathSync(report.root);
  assert.ok(/^TikMnG-Snow-Package713-QA-/.test(path.basename(isolatedRoot)), 'Native QA requires its own generated installation');
  const active = readJSON(path.join(isolatedRoot, '.game-library/snow-war/active.json'));
  assert.equal(active.version, '7.0.6');
  assert.match(active.directory, /^[a-f0-9-]{36}$/);
  const directory = path.join(isolatedRoot, '.game-library/snow-war/versions', active.directory);
  const instance = path.join(directory, 'game-instance');
  const runtime = runtimeDirectory(directory);
  const java = path.join(runtime, 'java/bin/java.exe');
  assert.equal(path.resolve(runtime), path.resolve(report.runtime));
  const manifest = readJSON(path.join(CANDIDATE, 'snow-war-manifest.json'));
  const files = [];
  for (const relative of CHANGED) {
    const expected = manifest.files.find(file => file.path === relative);
    const sha256 = await hashFile(path.join(directory, relative));
    assert.equal(sha256, expected.sha256, 'Launch the exact installed candidate: ' + relative);
    files.push({ path: relative, sha256, bytes: expected.bytes });
  }
  const preserved = new Map();
  const preservedPaths = ['game-instance/options.txt', 'game-instance/config/mng-snow-war.json',
    'game-instance/config/qa-package713-sentinel.json', 'settings.json'];
  for (const relative of preservedPaths) preserved.set(relative, fs.readFileSync(path.join(directory, relative)));
  const options = preserved.get('game-instance/options.txt').toString('utf8');
  assert.match(options, /^fullscreen:false$/m); assert.match(options, /^pauseOnLostFocus:false$/m);
  const nativeLog = path.join(OUTPUT, 'snow-package-native-sender.log');
  const argumentFile = path.join(OUTPUT, 'snow-package-native-sender.args');
  fs.writeFileSync(nativeLog, 'Packaged SnowWar 7.0.6 sender smoke\n');
  const blockedNetwork = [];
  // Redirect Java's HTTP/HTTPS/SOCKS clients to loopback while the offline arena runs.
  const proxy = http.createServer((req, res) => {
    blockedNetwork.push(req.method + ' ' + req.url.split('?')[0]);
    res.writeHead(502, { Connection: 'close', 'Content-Length': '0' }); res.end();
  });
  const proxySockets = new Set();
  proxy.on('connection', socket => { proxySockets.add(socket); socket.on('close', () => proxySockets.delete(socket)); });
  proxy.on('connect', (req, socket) => {
    blockedNetwork.push('CONNECT ' + req.url); socket.end('HTTP/1.1 502 Offline QA\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
  });
  proxy.on('clientError', (_error, socket) => { blockedNetwork.push('Non-HTTP proxy connection blocked'); socket.destroy(); });
  let child;
  let result;
  const started = performance.now();
  try {
    await new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen(0, '127.0.0.1', resolve); });
    const proxyPort = proxy.address().port;
    const args = require(path.join(directory, 'launch-game.cjs')).launchArguments(0);
    args.unshift('-Dmng.snowwar.senderSmoke=true', '-Djava.net.useSystemProxies=false',
      '-Dhttp.proxyHost=127.0.0.1', '-Dhttp.proxyPort=' + proxyPort,
      '-Dhttps.proxyHost=127.0.0.1', '-Dhttps.proxyPort=' + proxyPort,
      '-DsocksProxyHost=127.0.0.1', '-DsocksProxyPort=' + proxyPort);
    fs.writeFileSync(argumentFile, args.map(value => '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join('\n'));
    log('Launching installed 7.0.6 sender smoke with ' + java);
    result = await new Promise((resolve, reject) => {
      let tail = '', sceneReady = null, smokeResult = null, timedOut = false, spawnError;
      const env = { ...process.env, JAVA_HOME: '', JRE_HOME: '', MINECRAFT_HOME: '', TLAUNCHER_HOME: '',
        MNG_TIKTOK_USER: '', JAVA_TOOL_OPTIONS: '', JDK_JAVA_OPTIONS: '', _JAVA_OPTIONS: '' };
      child = spawn(java, ['@' + argumentFile], { cwd: instance, windowsHide: true, env, stdio: ['ignore', 'pipe', 'pipe'] });
      const pid = child.pid;
      const timeout = setTimeout(() => {
        timedOut = true; log('Native sender smoke reached 180 seconds; terminating own Java PID ' + pid);
        if (child.exitCode === null) child.kill();
      }, 180000);
      function output(data) {
        fs.appendFileSync(nativeLog, data);
        tail = (tail + data.toString()).slice(-32000);
        const ready = /MNG_SNOW_ARENA_READY[^\r\n]*/.exec(tail)?.[0];
        if (ready && !sceneReady) { sceneReady = ready; log(ready); }
        const smoke = /MNG_SENDER_SMOKE_RESULT[^\r\n]*/.exec(tail)?.[0];
        if (smoke && !smokeResult) { smokeResult = smoke; log(smoke); }
      }
      child.stdout.on('data', output); child.stderr.on('data', output);
      child.once('error', error => { spawnError = error; });
      child.once('close', (exitCode, signal) => {
        clearTimeout(timeout); child = null;
        if (spawnError) return reject(spawnError);
        resolve({ directory, java, pid, exitCode, signal, timedOut, elapsedMs: Math.round(performance.now() - started),
          sceneReady, smokeResult, log: nativeLog, flag: '-Dmng.snowwar.senderSmoke=true', files,
          offlineProxyRequestsBlocked: blockedNetwork.length });
      });
    });
    report.nativeSender = result;
    assert.equal(result.timedOut, false, 'Packaged native sender smoke must finish before 180 seconds');
    assert.ok(result.sceneReady, 'Packaged native scene must emit MNG_SNOW_ARENA_READY');
    assert.equal(result.smokeResult, 'MNG_SENDER_SMOKE_RESULT passed=true alpha400=true beta1=true boundedWave=true rivalShots=true rivalDamage=true broadcasterSafe=true');
    assert.equal(result.exitCode, 0, 'Packaged native Java process must exit successfully');
    for (const file of files) assert.equal(await hashFile(path.join(directory, file.path)), file.sha256);
    result.passed = true;
    return result;
  } finally {
    if (child && child.exitCode === null) {
      const owned = child;
      await new Promise(resolve => { owned.once('close', resolve); owned.kill(); });
    }
    for (const [relative, data] of preserved) fs.writeFileSync(path.join(directory, relative), data);
    for (const [relative, data] of preserved) assert.deepEqual(fs.readFileSync(path.join(directory, relative)), data);
    if (result) result.qaSettingsRestoredExactly = true;
    for (const socket of proxySockets) socket.destroy();
    proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve));
  }
}

async function nativeOnly() {
  const reportFile = path.join(OUTPUT, 'snow-package.json');
  const report = readJSON(reportFile);
  assert.equal(report.passed, true, 'Installation/upgrade QA must pass before native-only QA');
  const log = message => { fs.appendFileSync(path.join(OUTPUT, 'snow-package.log'), new Date().toISOString() + ' ' + message + '\n'); console.log(message); };
  report.passed = false;
  try {
    const result = await nativeSender(report, log);
    report.remaining = report.remaining.filter(message => !message.startsWith('Optional native packaged sender smoke was not launched'));
    report.passingSteps.push({ name: 'Actual installed 7.0.6 native scene ready and sender smoke passed with QA settings restored', ...result });
    report.passed = true;
    log('PASS Actual installed 7.0.6 native sender smoke');
  } catch (error) {
    report.remaining.push('Packaged native sender smoke: ' + error.message);
    log('REMAINING ' + error.message); process.exitCode = 1;
  } finally {
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: report.passed, nativeSender: report.nativeSender, remaining: report.remaining }, null, 2));
  }
}

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const report = { passed: false, localOnly: true, passingSteps: [], remaining: [], transfers: [],
    packageId: 'snow-war', previousVersion: '7.0.5', candidateVersion: '7.0.6' };
  const logFile = path.join(OUTPUT, 'snow-package.log');
  fs.writeFileSync(logFile, 'SnowWar 7.0.6 isolated package QA\n');
  const log = message => { fs.appendFileSync(logFile, new Date().toISOString() + ' ' + message + '\n'); console.log(message); };
  const pass = (name, evidence) => { report.passingSteps.push({ name, ...evidence }); log('PASS ' + name); };
  let server;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(new Error('Bounded package QA exceeded 180 seconds')), 180000);
  try {
    const oldManifest = readJSON(path.join(PREVIOUS, 'snow-war-manifest.json'));
    const newBytes = fs.readFileSync(path.join(CANDIDATE, 'snow-war-manifest.json'));
    const candidate = JSON.parse(newBytes);
    const summary = readJSON(path.join(CANDIDATE, 'snow-war-summary.json'));
    assert.equal(oldManifest.version, '7.0.5'); assert.equal(candidate.version, '7.0.6');
    assert.equal(digest(newBytes), summary.descriptor.sha256);
    assert.equal(newBytes.length, summary.descriptor.bytes);
    const oldFiles = new Map(oldManifest.files.map(file => [file.path, file]));
    assert.deepEqual(candidate.files.map(file => file.path).sort(), oldManifest.files.map(file => file.path).sort());
    assert.deepEqual(candidate.files.filter(file => file.sha256 !== oldFiles.get(file.path).sha256).map(file => file.path).sort(), CHANGED);
    assert.deepEqual(candidate.runtime, oldManifest.runtime);
    const content = parseContentPackage(candidate, { packageId: 'snow-war', version: '7.0.6' });
    assert.equal(content.runtime.id, summary.runtimeId);
    const newArchive = path.join(CANDIDATE, 'assets', candidate.payloadArchive.sha256 + '.zip');
    assert.equal(await hashFile(newArchive), candidate.payloadArchive.sha256);
    assert.equal(fs.statSync(newArchive).size, candidate.payloadArchive.bytes);
    pass('Candidate descriptor and payload SHA-256; exactly jar/events changed; runtime unchanged', {
      descriptorSha256: summary.descriptor.sha256, archiveSha256: candidate.payloadArchive.sha256, changed: CHANGED, runtimeId: content.runtime.id
    });

    const sourceReport = readJSON(SHARED_REPORT);
    assert.equal(sourceReport.passed, true);
    const sourceComponent = path.join(sourceReport.root, '.game-library/shared-runtimes', content.runtime.id);
    const isolatedRoot = fs.mkdtempSync('D:/TikMnG-Snow-Package713-QA-');
    report.root = isolatedRoot;
    const componentCopy = path.join(isolatedRoot, '.game-library/shared-runtimes', content.runtime.id);
    if (fs.existsSync(sourceComponent)) {
      const sourceReceipt = readJSON(path.join(sourceComponent, '.tikmng-runtime-complete.json'));
      assert.equal(sourceReceipt.sha256, content.runtime.id);
      log('Copying previously verified runtime to ' + componentCopy);
      await fsp.cp(sourceComponent, componentCopy, { recursive: true, force: false, errorOnExist: true, mode: fs.constants.COPYFILE_FICLONE });
      report.runtimeSource = sourceComponent;
      pass('Verified shared QA runtime copied into a fresh installation; source retained', { sourceReport: SHARED_REPORT });
    } else {
      const archive = path.join(PREVIOUS, 'assets', candidate.runtime.archive.sha256 + '.zip');
      log('Old QA runtime directory is absent; verifying and extracting its retained local runtime archive');
      assert.equal(await hashFile(archive), candidate.runtime.archive.sha256);
      assert.equal(fs.statSync(archive).size, candidate.runtime.archive.bytes);
      const runtime = path.join(componentCopy, 'runtime');
      fs.mkdirSync(runtime, { recursive: true });
      await require('extract-zip')(archive, { dir: runtime });
      await require('../lib/transfer-pool.cjs').transferPool(content.runtime.files, async file => {
        const target = path.join(runtime, file.path);
        assert.equal(fs.statSync(target).size, file.bytes, file.path);
        assert.equal(await hashFile(target), file.sha256, file.path);
      }, { signal: controller.signal, concurrency: 4 });
      fs.writeFileSync(path.join(componentCopy, '.tikmng-runtime-complete.json'), JSON.stringify({ schema: 1, sha256: content.runtime.id }));
      report.runtimeSource = archive;
      report.remaining.push('The original shared-install-report.json.root directory has been removed. Direct reuse of that directory could not be repeated; the identical retained runtime archive was verified and used to seed the isolated shared cache instead.');
      pass('Retained local shared runtime archive and every extracted runtime file verified before cache reuse', { archive,
        archiveSha256: candidate.runtime.archive.sha256, verifiedRuntimeFiles: content.runtime.files.length });
    }
    controller.signal.throwIfAborted();
    report.runtime = path.join(componentCopy, 'runtime');

    const routes = new Map();
    const blocked = [];
    const runtimeName = candidate.runtime.archive.sha256 + '.zip';
    server = http.createServer((req, res) => {
      const route = routes.get(req.url);
      if (req.url === '/' + runtimeName || !route) {
        blocked.push(req.url); res.writeHead(404); res.end(); return;
      }
      const size = route.data ? route.data.length : fs.statSync(route.file).size;
      report.transfers.push({ path: req.url, bytes: size });
      res.writeHead(200, { 'Content-Length': size, 'Content-Type': route.data ? 'application/json' : 'application/octet-stream' });
      if (route.data) res.end(route.data);
      else { const stream = fs.createReadStream(route.file); stream.on('error', error => res.destroy(error)); stream.pipe(res); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const origin = 'http://127.0.0.1:' + server.address().port;
    const packages = new Map();
    function localize(input, source) {
      const manifest = structuredClone(input);
      function visit(value) {
        if (!value || typeof value !== 'object') return;
        for (const [key, child] of Object.entries(value)) {
          if (key === 'url' && typeof child === 'string') {
            const name = path.basename(new URL(child).pathname);
            value[key] = origin + '/' + name;
            if (name === runtimeName) continue;
            const file = [path.join(source, 'assets', name), path.join(PREVIOUS, 'assets', name)].find(file => fs.existsSync(file));
            assert.ok(file, 'Offline package asset exists: ' + name);
            routes.set('/' + name, { file });
          } else visit(child);
        }
      }
      visit(manifest);
      const data = Buffer.from(JSON.stringify(manifest));
      assert.ok(!data.includes(Buffer.from('https://')), 'All descriptor URLs must be loopback before installation');
      const url = '/manifest/' + manifest.version;
      routes.set(url, { data });
      packages.set(manifest.version, { version: manifest.version, files: [{ path: '.tikmng-content.json', url: origin + url, bytes: data.length, sha256: digest(data) }] });
    }
    localize(oldManifest, PREVIOUS); localize(candidate, CANDIDATE);
    let version = '7.0.5', previousPhase;
    const library = createGameLibrary({
      root: isolatedRoot, definitions: { 'snow-war': { minecraft: true } }, getPackage: () => packages.get(version),
      validate: directory => fs.existsSync(path.join(directory, 'launch-game.cjs')) && fs.existsSync(path.join(runtimeDirectory(directory), 'java/bin/java.exe')),
      onProgress(event) { if (event.phase !== previousPhase) { previousPhase = event.phase; log(version + ' ' + event.phase + ': ' + event.message); } }
    });
    const old = await library.install('snow-war', { signal: controller.signal });
    assert.equal(old.installedVersion, '7.0.5');
    const oldDirectory = library.pathFor('snow-war');
    assert.equal(runtimeDirectory(oldDirectory), report.runtime);
    for (const relative of CHANGED) assert.equal(await hashFile(path.join(oldDirectory, relative)), oldFiles.get(relative).sha256);
    pass('createGameLibrary installed actual 7.0.5 over local HTTP with the existing shared runtime', { directory: oldDirectory });

    const configPath = 'game-instance/config/mng-snow-war.json';
    const config = { ...readJSON(path.join(oldDirectory, configPath)), username: '', musicVolume: 0, effectsVolume: 0, qaPackage713Marker: 'preserve-config' };
    const sentinels = new Map([
      [configPath, Buffer.from(JSON.stringify(config, null, 2) + '\n')],
      ['game-instance/config/qa-package713-sentinel.json', Buffer.from('{"preserve":"additional config"}\n')],
      ['game-instance/options.txt', Buffer.from('fullscreen:false\nguiScale:3\npauseOnLostFocus:false\nfov:73.0\nrenderDistance:6\nsimulationDistance:4\nmaxFps:40\nsoundCategory_master:0.0\n')],
      ['settings.json', Buffer.from('{"qaPackage713Marker":"preserve-settings"}\n')]
    ]);
    for (const [relative, data] of sentinels) { fs.mkdirSync(path.dirname(path.join(oldDirectory, relative)), { recursive: true }); fs.writeFileSync(path.join(oldDirectory, relative), data); }
    const beforeUpgrade = report.transfers.length;
    version = '7.0.6';
    const upgraded = await library.install('snow-war', { signal: controller.signal });
    assert.equal(upgraded.installedVersion, '7.0.6');
    const directory = library.pathFor('snow-war');
    assert.notEqual(directory, oldDirectory);
    assert.equal(runtimeDirectory(directory), report.runtime);
    for (const [relative, data] of sentinels) assert.deepEqual(fs.readFileSync(path.join(directory, relative)), data, relative + ' preserved across upgrade');
    const active = readJSON(path.join(isolatedRoot, '.game-library/snow-war/active.json'));
    assert.equal(active.previous.version, '7.0.5');
    pass('createGameLibrary upgraded to 7.0.6 and preserved config/options/settings bytes and previous version', { directory,
      updateBytes: report.transfers.slice(beforeUpgrade).reduce((sum, transfer) => sum + transfer.bytes, 0),
      preserved: [...sentinels.keys()].map(relative => ({ path: relative, sha256: digest(sentinels.get(relative)) })) });

    const verified = [];
    for (const relative of CHANGED) {
      const expected = candidate.files.find(file => file.path === relative);
      const file = path.join(directory, relative), sha256 = await hashFile(file);
      assert.equal(sha256, expected.sha256); assert.equal(fs.statSync(file).size, expected.bytes);
      assert.notEqual(sha256, oldFiles.get(relative).sha256);
      verified.push({ path: relative, sha256, bytes: expected.bytes });
    }
    assert.deepEqual(blocked, [], 'No runtime download, missing route or unexpected local request');
    assert.ok(report.transfers.every(transfer => !transfer.path.includes(runtimeName)));
    pass('Installed jar and events.js match the actual new manifest hashes; zero runtime downloads', { files: verified, runtimeDownloads: 0 });

    const check = await execFile(process.execPath, [path.join(directory, 'launch-game.cjs'), '--check'], {
      cwd: directory, windowsHide: true, timeout: 20000, encoding: 'utf8',
      env: { ...process.env, JAVA_HOME: '', JRE_HOME: '', MINECRAFT_HOME: '', TLAUNCHER_HOME: '' }
    });
    fs.writeFileSync(path.join(OUTPUT, 'snow-package-launch-check.log'), check.stdout + check.stderr);
    const launchResult = JSON.parse(check.stdout.trim()); assert.equal(launchResult.ok, true);
    for (const [relative, data] of sentinels) assert.deepEqual(fs.readFileSync(path.join(directory, relative)), data, relative + ' retained after --check');
    pass('Packaged launch-game.cjs --check reports ok with external runtime/profile variables empty', launchResult);

    const smokeSource = path.resolve(ROOT, '../snow-war-update-713/mod/src/main/java/com/tikmng/snowwar/game/SnowWarSenderSmoke.java');
    const smokeText = fs.readFileSync(smokeSource, 'utf8');
    const flag = /Boolean\.getBoolean\("(mng\.snowwar\.[^"]+)"\)/.exec(smokeText)?.[1];
    assert.equal(flag, 'mng.snowwar.senderSmoke');
    pass('Confirmed actual packaged sender-smoke JVM property from mod source', { source: smokeSource, flag: '-D' + flag + '=true' });
    report.remaining.push('Optional native packaged sender smoke was not launched in this bounded offline check; source native sender/combat smoke was reported separately by the parent.');
    report.passed = true;
  } catch (error) {
    report.remaining.push(error.stack || String(error));
    log('REMAINING ' + error.message); process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    fs.writeFileSync(path.join(OUTPUT, 'snow-package.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  }
}

if (require.main === module) (process.argv.includes('--native-only') ? nativeOnly() : main()).catch(error => { console.error(error.stack); process.exitCode = 1; });
module.exports = { main, nativeSender, nativeOnly };
