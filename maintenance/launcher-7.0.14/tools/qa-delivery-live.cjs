'use strict';

// Real TikTok observation never enters the synthetic stores used by browser QA.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const root = path.resolve(__dirname, '..');
const MAX_LIVE_MS = 30000;
const username = (process.env.MNG_LIVE_QA_USERNAME || 'mlbb_gossipgirl').replace(/^@/, '');

function redact(value) {
  return String(value)
    .replace(/\/overlays\/[A-Za-z0-9_-]+/g, '/overlays/[REDACTED]')
    .replace(/([?&](?:key|token|ticket|signature|api_key|apiKey|sessionid)=)[^\s&#"']+/gi, '$1[REDACTED]')
    .replace(/((?:authorization|signApiKey|apiKey|sessionid|cookie)\s*[:=]\s*)[^\r\n,}]+/gi, '$1[REDACTED]');
}

function signer() {
  const fromEnv = String(process.env.EULER_API_KEY || '').trim();
  if (fromEnv && fromEnv !== 'undefined') return { key: fromEnv, source: 'environment' };
  const candidates = [path.resolve(root, '../apps/tiktok-vs/euler-api-key.txt')];
  if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, 'apps/tiktok-vs/euler-api-key.txt'));
  for (const candidate of candidates) {
    try {
      const key = fs.readFileSync(candidate, 'utf8').trim();
      if (key && key !== 'undefined') return { key, source: 'existing-launcher-file' };
    } catch {}
  }
  return { key: '', source: 'not-configured' };
}

function errorFacts(error) {
  const chain = [], seen = new Set();
  let value = error;
  while (value && !seen.has(value) && chain.length < 6) {
    seen.add(value);
    const safe = value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,90}$/.test(value) ? value : undefined;
    chain.push({ name: safe(value.name || value.constructor?.name), code: safe(value.code),
      httpStatus: [value.statusCode, value.response?.statusCode, value.response?.status].find(v => Number.isInteger(v) && v >= 100 && v <= 599) });
    value = value.exception || value.cause;
  }
  const words = [...seen].map(v => [v?.name, v?.constructor?.name, v?.code, v?.message, v?.response?.statusCode].join(' ')).join(' ');
  const category = /UserOfflineError|not (?:currently )?(?:online|live)|isn't online|\boffline\b/i.test(words) ? 'offline'
    : /429|rate.?limit/i.test(words) ? 'rate-limit'
      : /401|403|auth|api.?key|SignAPI|SignatureMissing/i.test(words) ? 'authorization'
        : /timeout|timed out|ETIMEDOUT/i.test(words) ? 'timeout'
          : /ECONN|ENOTFOUND|EAI_AGAIN|network|socket/i.test(words) ? 'network' : 'connection';
  return { category, chain };
}

async function observeLive() {
  // SDK diagnostics may contain signed URLs. Only the explicit whitelist below is emitted.
  for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = () => {};
  const start = performance.now();
  const data = { kind: 'real-read-only-observation', username, startedAt: new Date().toISOString(),
    maximumMs: MAX_LIVE_MS, connected: false, roomVerified: false, websocketConnected: false,
    rawEventCounts: {}, forwardedEventCounts: {}, samples: [], statuses: [], errors: [],
    writesToTikTok: 0, launcherProfileUsed: false, syntheticEventsInjected: 0 };
  let session, finished = false, deadline;
  const counts = (target, type) => { target[type] = (target[type] || 0) + 1; };
  const facts = (type, payload) => {
    const fields = type === 'gift' ? ['giftId', 'giftType', 'repeatCount', 'repeatEnd', 'diamondCount']
      : type === 'like' ? ['likeCount', 'totalLikeCount'] : type === 'viewer' ? ['viewerCount'] : [];
    const result = { type, elapsedMs: Math.round(performance.now() - start) };
    for (const key of fields) {
      const value = payload?.[key];
      if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) result[key] = value;
      else if (typeof value === 'string' && /^\d{1,24}$/.test(value)) result[key] = value;
    }
    if (type === 'chat') result.messageLength = String(payload?.content ?? payload?.comment ?? payload?.message ?? '').length;
    return result;
  };
  const complete = reason => {
    if (finished) return;
    finished = true;
    clearTimeout(deadline);
    data.endReason = reason;
    data.finalState = session ? { status: session.status().status, reason: session.status().reason } : null;
    session?.close();
    data.elapsedMs = Math.round(performance.now() - start);
    data.endedAt = new Date().toISOString();
    process.stdout.write(JSON.stringify(data) + '\n', () => process.exit(0));
  };
  deadline = setTimeout(() => complete(data.connected ? 'observation-window-complete' : 'diagnostic-deadline'), 28500);
  process.on('SIGTERM', () => complete('parent-deadline'));
  try {
    if (!/^[A-Za-z0-9_.]{1,64}$/.test(username)) throw new Error('Invalid diagnostic username');
    const sdk = await import('tiktok-live-connector');
    const { createLiveSession } = require('../lib/live-session.cjs');
    const credential = signer();
    data.signer = { configured: Boolean(credential.key), source: credential.source };
    data.sdkVersion = require('tiktok-live-connector/package.json').version;
    session = createLiveSession({
      events: sdk.WebcastEvent,
      createConnection: () => {
        const options = { processInitialData: false, enableExtendedGiftInfo: false };
        if (credential.key) options.signApiKey = credential.key;
        const connection = new sdk.TikTokLiveConnection(username, options);
        const events = sdk.WebcastEvent || {};
        for (const [name, fallback, type] of [['CHAT', 'chat', 'chat'], ['GIFT', 'gift', 'gift'],
          ['LIKE', 'like', 'like'], ['FOLLOW', 'follow', 'follow'], ['SHARE', 'share', 'share'],
          ['MEMBER', 'member', 'member'], ['ROOM_USER', 'roomUser', 'viewer'],
          ['SUBSCRIBE', 'subscribe', 'subscribe'], ['SUB_NOTIFY', 'subNotify', 'subNotify']]) {
          connection.on(events[name] || fallback, payload => counts(data.rawEventCounts, type));
        }
        connection.on('websocketConnected', () => { data.websocketConnected = true; });
        connection.on('error', error => { if (data.errors.length < 8) data.errors.push(errorFacts(error)); });
        return connection;
      },
      onStatus: status => {
        if (finished) return;
        if (data.statuses.length < 12 && data.statuses.at(-1)?.status !== status.status) {
          data.statuses.push({ status: status.status, reason: status.reason, attempt: status.attempt,
            elapsedMs: Math.round(performance.now() - start) });
        }
      },
      onEvent: (type, payload) => {
        if (finished) return;
        counts(data.forwardedEventCounts, type);
        if (data.samples.length < 24) data.samples.push(facts(type, payload));
      }
    });
    const state = await session.start(username);
    if (finished) return;
    data.connected = state.status === 'connected';
    data.roomVerified = data.connected && /^\d+$/.test(state.roomId || '') && /[1-9]/.test(state.roomId);
    if (!data.connected) complete('connection-attempt-' + state.reason);
  } catch (error) {
    data.errors.push(errorFacts(error));
    complete('diagnostic-error');
  }
}

function runChild(args, timeoutMs, env = {}) {
  return new Promise(resolve => {
    const started = performance.now();
    const child = spawn(process.execPath, args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env } });
    let stdout = '', stderr = '', timedOut = false;
    child.stdout.on('data', data => { if (stdout.length < 2 * 1024 * 1024) stdout += data.toString(); });
    child.stderr.on('data', data => { if (stderr.length < 512 * 1024) stderr += data.toString(); });
    const timeout = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.on('error', error => { stderr += '\n' + error.name; });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timeout);
      resolve({ exitCode, signal, timedOut, elapsedMs: Math.round(performance.now() - started),
        stdout: redact(stdout), stderr: redact(stderr) });
    });
  });
}

async function publicHealth() {
  const origin = new URL(fs.readFileSync(path.join(root, 'license-server.txt'), 'utf8').trim());
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash) {
    throw new Error('Public health origin must be plain HTTPS');
  }
  const result = [];
  for (const route of ['/api/health', '/api/overlay/health', '/api/version', '/api/content/catalog']) {
    const started = performance.now();
    try {
      const response = await fetch(new URL(route, origin), { signal: AbortSignal.timeout(18000), redirect: 'error' });
      const body = await response.text();
      let parsed;
      try { parsed = JSON.parse(body); } catch {}
      const exposed = {};
      for (const key of ['status', 'available', 'protocolVersion', 'version', 'schemaVersion']) {
        const value = parsed?.[key];
        if (typeof value === 'boolean' || typeof value === 'number' ||
            (typeof value === 'string' && /^[A-Za-z0-9._-]{1,50}$/.test(value))) exposed[key] = value;
      }
      result.push({ origin: origin.origin, route, status: response.status, tlsVerified: true,
        contentType: response.headers.get('content-type'), body: exposed, elapsedMs: Math.round(performance.now() - started) });
    } catch (error) {
      result.push({ origin: origin.origin, route, tlsVerified: false, error: errorFacts(error), elapsedMs: Math.round(performance.now() - started) });
    }
  }
  return result;
}

function sourceSnapshot() {
  const files = ['main.js', 'lib/live-session.cjs', 'lib/overlay-bridge.cjs', 'lib/media-studio.cjs',
    'renderer/widgets/overlay.html', 'renderer/widgets/physical-jar.js', 'tools/qa-https-overlay.cjs'];
  return Object.fromEntries(files.map(file => [file, fs.existsSync(path.join(root, file))
    ? crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') : null]));
}

async function delivery() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = path.resolve(process.env.MNG_DELIVERY_QA_OUTPUT || path.join('D:/TikMnG-QA-Delivery', stamp));
  fs.mkdirSync(output, { recursive: true });
  const report = { startedAt: new Date().toISOString(), root, output,
    scope: 'One read-only real connection; isolated synthetic media/widget QA; no profile changes or releases.',
    sourceBefore: sourceSnapshot(), actualLive: null, publicHealth: [], synthetic: [],
    liveStudioAcceptance: { status: 'unverified', reason: 'No TikTok Live Studio UI acceptance was exercised by this diagnostic.' },
    realGiftToPublicPlayback: { status: 'unverified', reason: 'Real events are not injected into the synthetic relay or a saved user profile.' } };
  const save = () => fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
  const log = value => process.stdout.write(JSON.stringify(value) + '\n');
  save();
  const healthPromise = publicHealth();
  const live = await runChild([__filename, '--live-child'], MAX_LIVE_MS);
  try { report.actualLive = JSON.parse(live.stdout.trim()); }
  catch { report.actualLive = { kind: 'real-read-only-observation', username, connected: false,
    endReason: live.timedOut ? 'hard-30s-deadline' : 'no-structured-result', rawEventCounts: {}, forwardedEventCounts: {} }; }
  report.actualLive.process = { exitCode: live.exitCode, timedOut: live.timedOut, elapsedMs: live.elapsedMs };
  report.publicHealth = await healthPromise;
  save();
  log({ phase: 'real-observation', connected: report.actualLive.connected, endReason: report.actualLive.endReason,
    realEventCounts: report.actualLive.forwardedEventCounts, publicHealth: report.publicHealth.map(v => ({ route: v.route, status: v.status, body: v.body })) });
  const jobs = [
    { id: 'https-overlay', args: ['tools/qa-https-overlay.cjs'], timeoutMs: 150000 },
    { id: 'connection-media-contracts', args: ['--test', '--test-reporter=tap', 'tests/live-session.test.cjs',
      'tests/connection-key.test.cjs', 'tests/overlay-bridge.test.cjs', 'tests/media-studio.test.cjs',
      'tests/tts-audience.test.cjs', 'tests/tikfinity.test.cjs'], timeoutMs: 120000 },
    { id: 'widget-relay-paths', args: ['--test', '--test-reporter=tap', 'tests/widget-relay-paths.test.cjs'],
      timeoutMs: 120000, env: { WIDGET_RELAY_QA_OUTPUT: path.join(output, 'widget-relay') } },
    { id: 'media-playback', args: ['tools/qa-media-playback.cjs'], timeoutMs: 120000,
      env: { MNG_MEDIA_QA_OUTPUT: path.join(output, 'media-playback') } }
  ];
  // Sequential browser runs avoid contention with other agents' visual checks.
  for (const job of jobs) {
    const run = await runChild(job.args, job.timeoutMs, job.env);
    fs.writeFileSync(path.join(output, job.id + '.log'), run.stdout + '\nSTDERR\n' + run.stderr);
    const tail = (run.stdout + '\n' + run.stderr).split(/\r?\n/).filter(Boolean).slice(-14);
    report.synthetic.push({ id: job.id, kind: 'synthetic-isolated-fixture', args: job.args,
      passed: run.exitCode === 0 && !run.timedOut, exitCode: run.exitCode, timedOut: run.timedOut,
      elapsedMs: run.elapsedMs, tail });
    save();
    log({ phase: 'synthetic', id: job.id, passed: run.exitCode === 0 && !run.timedOut, elapsedMs: run.elapsedMs });
  }
  report.sourceAfter = sourceSnapshot();
  report.changedDuringRun = Object.keys(report.sourceBefore).filter(file => report.sourceBefore[file] !== report.sourceAfter[file]);
  report.finishedAt = new Date().toISOString();
  report.syntheticPassed = report.synthetic.every(v => v.passed);
  report.deliveryFullyVerified = false;
  save();
  const lines = ['# TikMnG delivery connection QA', '', 'Started: ' + report.startedAt,
    'Finished: ' + report.finishedAt, '', '## Real observation', '',
    '- Account: @' + username,
    '- Connected: ' + Boolean(report.actualLive.connected),
    '- Room verified: ' + Boolean(report.actualLive.roomVerified),
    '- End reason: ' + report.actualLive.endReason,
    '- Duration: ' + report.actualLive.process.elapsedMs + ' ms (hard cap 30000 ms)',
    '- Real forwarded event counts: ' + JSON.stringify(report.actualLive.forwardedEventCounts),
    '- Real raw event counts: ' + JSON.stringify(report.actualLive.rawEventCounts),
    '- Signer configured: ' + Boolean(report.actualLive.signer?.configured),
    '- No chat, gifts, follows or profile changes were sent.', '', '## Public service', '',
    ...report.publicHealth.map(v => '- ' + v.route + ': HTTP ' + (v.status ?? 'unreachable') + ', valid TLS: ' + v.tlsVerified + ', ' + JSON.stringify(v.body || v.error)),
    '', '## Synthetic fixtures (not real gifts)', '',
    ...report.synthetic.map(v => '- ' + v.id + ': ' + (v.passed ? 'PASS' : 'FAIL') + ' (' + v.elapsedMs + ' ms); see ' + v.id + '.log'),
    '', '## Not verified', '', '- Acceptance in TikTok Live Studio or OBS UI.',
    '- A real live gift triggering playback on a saved, public, production source URL.',
    '- Real TTS audio quality, voice diversity, or the installed desktop build.',
    '- Long-running uptime; this is a point-in-time test.', '',
    'Source files changed concurrently: ' + JSON.stringify(report.changedDuringRun),
    'The QA runner only writes this tool and its output/report. It never publishes an update.', ''];
  fs.writeFileSync(path.join(output, 'report.md'), lines.join('\n'));
  log({ phase: 'complete', output, syntheticPassed: report.syntheticPassed,
    realConnectionVerified: Boolean(report.actualLive.connected && report.actualLive.roomVerified), liveStudioAcceptance: false });
  if (!report.syntheticPassed) process.exitCode = 1;
}

if (require.main === module) {
  (process.argv.includes('--live-child') ? observeLive() : delivery()).catch(error => {
    process.stderr.write(JSON.stringify(errorFacts(error)) + '\n');
    process.exitCode = 1;
  });
}

module.exports = { errorFacts, redact };
