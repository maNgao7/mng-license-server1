'use strict';

// No installed launcher, private third-party source, saved profiles or real gifts are used.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const root = path.resolve(__dirname, '..');
const { redact } = require('./qa-delivery-live.cjs');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.resolve(process.env.MNG_ROUTING_QA_OUTPUT || 'D:/TikMnG-QA-Delivery/routing-' + stamp);
const catalog = require('../lib/catalog-defaults.json');
const imageRoot = path.join(root, 'renderer/gift-assets');
const gifts = JSON.parse(fs.readFileSync(path.join(imageRoot, 'katalog_tam.json'), 'utf8'));

function hashes() {
  return Object.fromEntries(['main.js', 'lib/live-session.cjs', 'lib/platform.cjs', 'lib/game-launch-session.cjs',
    'lib/game-account-handoff.cjs', 'lib/media-studio.cjs', 'lib/tikfinity.cjs', 'lib/tts-audience.cjs', 'renderer/widgets/overlay.html',
    'renderer/gift-assets/katalog_tam.json', 'tests/live-routing-regression.test.cjs'].map(file =>
    [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
}

function run(args, timeoutMs, env = {}) {
  return new Promise(resolve => {
    const start = performance.now();
    const child = spawn(process.execPath, args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
    let stdout = '', stderr = '', timedOut = false;
    child.stdout.on('data', value => { if (stdout.length < 4 * 1024 * 1024) stdout += value.toString(); });
    child.stderr.on('data', value => { if (stderr.length < 1024 * 1024) stderr += value.toString(); });
    const timer = setTimeout(() => { timedOut = true;child.kill(); }, timeoutMs);
    child.on('error', error => { stderr += error.name; });
    child.on('close', exitCode => {
      clearTimeout(timer);resolve({ exitCode, timedOut, elapsedMs: Math.round(performance.now() - start), stdout: redact(stdout), stderr: redact(stderr) });
    });
  });
}

async function giftAudit() {
  const errors = [], warnings = [], ids = new Set(), names = new Map();
  for (const gift of gifts) {
    const id = String(gift.id), label = String(gift.trName || gift.name || '').trim();
    if (!/^\d+$/.test(id) || ids.has(id)) errors.push({ id, issue: 'invalid-or-duplicate-id' });
    ids.add(id);
    if (!label || !String(gift.name || '').trim()) errors.push({ id, issue: 'missing-name' });
    if (!Number.isSafeInteger(gift.coins) || gift.coins < 0) errors.push({ id, issue: 'invalid-coins' });
    if (gift.file !== id + '.png') errors.push({ id, issue: 'filename-id-mismatch' });
    if (gift.image !== '/catalog-assets/gift-images/' + gift.file) errors.push({ id, issue: 'image-metadata-mismatch' });
    if (path.basename(String(gift.file)) !== gift.file || !fs.existsSync(path.join(imageRoot, gift.file))) errors.push({ id, issue: 'missing-or-unsafe-file' });
    const key = label.toLocaleLowerCase('tr');names.set(key, [...(names.get(key) || []), id]);
  }
  const sorted = [...gifts].sort((a, b) => a.coins - b.coins || String(a.trName || a.name).localeCompare(String(b.trName || b.name), 'tr'));
  const sortedOnDisk = gifts.every((gift, index) => !index || gifts[index - 1].coins <= gift.coins);
  if (!sortedOnDisk) warnings.push('Catalog JSON order is not coin ascending; visual pickers must sort metadata at render time.');
  const repeatedLabels = [...names].filter(([, list]) => list.length > 1).map(([name, ids]) => ({ name, ids }));
  const spots = ['5655', '6064', '7934', '5319', '5879', '5303', '7168', '11046'].map(id => {
    const gift = gifts.find(g => String(g.id) === id);
    return gift ? { id, name: gift.name, trName: gift.trName, coins: gift.coins, file: gift.file } : { id, missing: true };
  });
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const allowed = new Set(gifts.map(g => g.file));let browser;
  const server = http.createServer((req, res) => {
    const file = req.url.slice(1);
    if (req.url === '/') { res.setHeader('content-type', 'text/html');return res.end('<!doctype html><title>Isolated gift decoder</title>'); }
    if (!allowed.has(file)) { res.writeHead(404);return res.end(); }
    fs.createReadStream(path.join(imageRoot, file)).on('error', () => { res.destroy(); }).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let decoded;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage();await page.goto('http://127.0.0.1:' + server.address().port);
    decoded = await page.evaluate(async files => {
      const results = [];
      for (let i = 0; i < files.length; i += 24) {
        results.push(...await Promise.all(files.slice(i, i + 24).map(async file => {
          const image = new Image();image.src = '/' + file;
          try { await image.decode();return { file, width: image.naturalWidth, height: image.naturalHeight }; }
          catch { return { file, error: 'browser-decode-failed' }; }
        })));
      }
      return results;
    }, gifts.map(g => g.file));
    errors.push(...decoded.filter(v => v.error || !v.width || !v.height));
  } finally {
    await browser?.close();server.closeAllConnections();await new Promise(resolve => server.close(resolve));
  }
  return { passed: errors.length === 0, entries: gifts.length, uniqueIds: ids.size,
    decodedImages: decoded.filter(v => !v.error && v.width && v.height).length, sortedOnDisk,
    sortedMetadataFirst: sorted.slice(0, 6).map(g => ({ id: g.id, coins: g.coins })), repeatedLabels, spots, errors, warnings };
}

async function health() {
  const origin = new URL(fs.readFileSync(path.join(root, 'license-server.txt'), 'utf8').trim());
  if (origin.protocol !== 'https:') throw new Error('Public origin requires HTTPS');
  const results = [];
  for (const route of ['/api/health', '/api/overlay/health', '/api/version', '/api/content/catalog']) {
    try {
      const response = await fetch(new URL(route, origin), { redirect: 'error', signal: AbortSignal.timeout(18000) });
      const body = await response.json().catch(() => ({}));
      results.push({ route, status: response.status, tlsVerified: true,
        healthy: response.ok, available: typeof body.available === 'boolean' ? body.available : undefined,
        protocolVersion: body.protocolVersion, version: /^\d+\.\d+\.\d+$/.test(body.version || '') ? body.version : undefined });
    } catch (error) { results.push({ route, healthy: false, error: error.name }); }
  }
  return results;
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const report = { startedAt: new Date().toISOString(), output, sourceBefore: hashes(),
    scope: 'Read-only real room, isolated synthetic contracts. No installed games or saved profiles launched.',
    games: catalog.games.map(({ id, title }) => ({ id, title, actualRuntimeTested: false })),
    publicHealth: [], live: null, jobs: [], liveStudioAcceptance: false, realGiftToProductionPlayback: false };
  const save = () => fs.writeFileSync(path.join(output, 'routing-result.json'), JSON.stringify(report, null, 2));
  const log = value => process.stdout.write(JSON.stringify(value) + '\n');
  save();const pendingHealth = health();
  if (!process.argv.includes('--skip-live')) {
    const live = await run(['tools/qa-delivery-live.cjs', '--live-child'], 30000, { MNG_LIVE_QA_USERNAME: 'mlbb_gossipgirl' });
    try { report.live = JSON.parse(live.stdout.trim()); }
    catch { report.live = { connected: false, roomVerified: false, reason: live.timedOut ? 'hard-30s-deadline' : 'no-result' }; }
    report.live.process = { exitCode: live.exitCode, timedOut: live.timedOut, elapsedMs: live.elapsedMs };
    log({ phase: 'real-room', connected: report.live.connected, roomVerified: report.live.roomVerified, counts: report.live.forwardedEventCounts, endReason: report.live.endReason });
  } else report.live = { status: 'not-repeated', roomVerified: false };
  report.publicHealth = await pendingHealth;save();
  report.giftCatalog = await giftAudit();save();
  log({ phase: 'gift-catalog', entries: report.giftCatalog.entries, decoded: report.giftCatalog.decodedImages, passed: report.giftCatalog.passed });
  const jobs = [
    { id: 'routing-regression', args: ['--test', '--test-reporter=tap', 'tests/live-routing-regression.test.cjs'], timeout: 45000 },
    { id: 'existing-contracts', args: ['--test', '--test-reporter=tap', 'tests/live-session.test.cjs', 'tests/platform.test.cjs', 'tests/game-launch-session.test.cjs',
      'tests/game-account-handoff.test.cjs', 'tests/overlay-bridge.test.cjs', 'tests/tikfinity.test.cjs', 'tests/media-studio.test.cjs', 'tests/tts-audience.test.cjs', 'tests/top-gift.test.cjs'], timeout: 100000 },
    { id: 'https-overlay', args: ['tools/qa-https-overlay.cjs'], timeout: 150000 },
    { id: 'widget-relay', args: ['--test', '--test-reporter=tap', 'tests/widget-relay-paths.test.cjs'], timeout: 60000,
      env: { WIDGET_RELAY_QA_OUTPUT: path.join(output, 'widget-relay') } },
    { id: 'workspace', args: ['tools/qa-workspace.cjs'], timeout: 60000, env: { MNG_QA_OUTPUT: path.join(output, 'workspace') } }
  ];
  for (const job of jobs) {
    const result = await run(job.args, job.timeout, job.env);
    const content = result.stdout + '\nSTDERR\n' + result.stderr;
    fs.writeFileSync(path.join(output, job.id + '.log'), content);
    const failures = content.split(/\r?\n/).filter(line => /^\s*not ok \d+ - /.test(line)).map(line => line.trim());
    const counts = Object.fromEntries(['tests', 'pass', 'fail', 'skipped'].map(key => [key, Number(new RegExp('^# ' + key + ' (\\d+)$', 'm').exec(content)?.[1]) || 0]));
    const record = { id: job.id, passed: result.exitCode === 0 && !result.timedOut, exitCode: result.exitCode,
      timedOut: result.timedOut, elapsedMs: result.elapsedMs, counts, failures };
    report.jobs.push(record);save();log(record);
  }
  report.sourceAfter = hashes();
  report.concurrentChanges = Object.keys(report.sourceBefore).filter(file => report.sourceBefore[file] !== report.sourceAfter[file]);
  report.finishedAt = new Date().toISOString();
  report.passed = report.giftCatalog.passed && report.jobs.every(job => job.passed);
  save();
  log({ phase: 'complete', passed: report.passed, output, concurrentChanges: report.concurrentChanges,
    actualGameRuntimesTested: 0, liveStudioAcceptance: false });
  if (!report.passed) process.exitCode = 1;
}
main().catch(error => { process.stderr.write(redact(error.stack || error.name) + '\n');process.exitCode = 1; });
