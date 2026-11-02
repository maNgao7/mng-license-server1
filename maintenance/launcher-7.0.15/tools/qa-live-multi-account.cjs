'use strict';

// Explicitly authorized QA accounts only. Never imported by the launcher.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = 'D:/TikMnG-QA-Delivery/live-multi-account-2026-10-23';
const ACCOUNTS = Object.freeze(['benyigit61', 'esssero', 'pekeronlinee', 'mrofluu']);
const OPTIONS = Object.freeze({ processInitialData: false, enableExtendedGiftInfo: false });
const OBSERVE_MS = 20000;
const HARD_CHILD_MS = 52000;
const BACKOFF_MS = 5000;
const WATCHED = ['main.js', 'lib/live-session.cjs', 'lib/platform.cjs', 'lib/media-studio.cjs',
  'lib/tts-audience.cjs', 'lib/top-gift.cjs', 'lib/game-account-handoff.cjs',
  'lib/catalog-defaults.json', 'lib/game-resources.json', 'tests/live-routing-regression.test.cjs',
  'tools/qa-delivery-live.cjs', 'tools/qa-all-connections.cjs', 'package.json',
  'node_modules/tiktok-live-connector/package.json', 'node_modules/tiktok-live-connector/README.md',
  'node_modules/tiktok-live-connector/dist/lib-QI8aOkkz.js'];

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const increment = (counts, type) => { counts[type] = (counts[type] || 0) + 1; };
const plain = value => JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? String(item) : item));
const safeName = value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,90}$/.test(value) ? value : undefined;
function numericId(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return '';
  const text = ['string', 'number', 'bigint'].includes(typeof value) ? String(value) : '';
  return /^\d{1,30}$/.test(text) && /[1-9]/.test(text) ? text : '';
}
function section(source, start, end) {
  const first = source.indexOf(start), last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, 'Actual main.js section missing');
  return source.slice(first, last);
}
function sourceParts() {
  const source = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  const ts = require('typescript');
  const tree = ts.createSourceFile('main.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const factory = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'widgetTikTokYenidenBaglan');
  assert.ok(factory, 'Actual live factory missing');
  let callback;
  function visit(node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'onEvent') callback = node.initializer.getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(factory);
  assert.ok(callback, 'Actual onEvent callback missing');
  return { source, callback,
    pure: section(source, 'function widgetTikTokProfiliniOku(', 'function widgetTikTokYenidenBaglan('),
    widgets: section(source, 'const widgetRecentEvents = ', 'function widgetEulerAnahtariniBul('),
    callbackSha256: crypto.createHash('sha256').update(callback).digest('hex') };
}

// Record classifications and public numeric facts, never exception text/URLs/headers.
function errorFacts(error) {
  const nodes = [], seen = new Set();
  function walk(value) {
    if (!value || typeof value !== 'object' || seen.has(value) || nodes.length >= 18) return;
    seen.add(value);
    const text = [value.name, value.constructor?.name, value.code, value.message].join(' ');
    const status = [value.statusCode, value.response?.statusCode, value.response?.status]
      .find(v => Number.isInteger(v) && v >= 100 && v <= 599);
    const evidence = [];
    if (/UserOfflineError|isn't online|is not online|not (?:currently )?live|\boffline\b/i.test(text)) evidence.push('offline');
    if (status === 429 || /SignatureRateLimitError|rate.?limit|too many connections/i.test(text)) evidence.push('rate-limit');
    if ([401, 402, 403].includes(status) || /lack of permission|unauthorized|forbidden|PremiumFeatureError|AuthenticatedWebSocket|api.?key|SignatureMissingTokensError/i.test(text)) evidence.push('access');
    if (/blocked|captcha|SIGI_STATE|extract.*(?:HTML|LiveRoom)/i.test(text)) evidence.push('access-or-page-shape');
    if (/timeout|timed out|ETIMEDOUT/i.test(text)) evidence.push('timeout');
    if (/ECONN|ENOTFOUND|EAI_AGAIN|network|socket|fetch failed|certificate|TLS|SSL/i.test(text)) evidence.push('transport');
    nodes.push({ name: safeName(value.constructor?.name) || safeName(value.name), code: safeName(value.code),
      httpStatus: status, route: safeName(value.config?.routeId), evidence,
      retryAfterMs: Number.isFinite(value.retryAfter) && value.retryAfter >= 0 ? value.retryAfter : undefined });
    walk(value.exception); walk(value.cause);
    for (const child of value.config?.requestErrs || []) walk(child);
    if (Array.isArray(value.errors)) value.errors.forEach(walk);
  }
  walk(error);
  const evidence = new Set(nodes.flatMap(node => node.evidence));
  const category = evidence.has('rate-limit') ? 'rate-limit' : evidence.has('access') ? 'access'
    : evidence.has('offline') ? 'offline' : evidence.has('transport') ? 'transport'
      : evidence.has('timeout') ? 'timeout' : evidence.has('access-or-page-shape') ? 'access-or-page-shape' : 'connection';
  return { category, nodes };
}

function cleanEnvironment(extra = {}) {
  const result = {};
  for (const key of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'windir', 'ComSpec', 'COMSPEC', 'OS',
    'Path', 'PATH', 'PATHEXT', 'TEMP', 'TMP', 'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS']) {
    if (process.env[key] !== undefined) result[key] = process.env[key];
  }
  return { ...result, ...extra };
}

function sanitizedFixture(type, payload, identifiers, index) {
  const result = { type, payload: { username: 'qa_viewer', nickname: 'QA viewer', avatar: '' } };
  for (const key of ['count', 'repeatCount', 'coins', 'likeCount', 'viewerCount', 'fanClubLevel']) {
    const value = payload[key];
    if (value === null || (typeof value === 'number' && Number.isFinite(value))) result.payload[key] = value;
  }
  if (type === 'gift') result.payload.giftId = numericId(payload.giftId);
  if (payload.eventId) {
    const id = String(payload.eventId);
    if (!identifiers.has(id)) identifiers.set(id, 'observed-' + index + '-' + identifiers.size);
    result.payload.eventId = identifiers.get(id);
  } else result.payload.eventId = '';
  if (type === 'chat') {
    result.messageWasNonEmpty = Boolean(String(payload.message || '').trim());
    result.payload.message = '';
  }
  return result;
}

async function observe(username) {
  assert.ok(ACCOUNTS.includes(username), 'Unauthorized QA account');
  for (const method of ['log', 'warn', 'error', 'info', 'debug']) console[method] = () => {};
  const start = performance.now();
  const report = { username, startedAt: new Date().toISOString(), sdk: 'tiktok-live-connector',
    sdkVersion: require('tiktok-live-connector/package.json').version, options: OPTIONS,
    attempts: 0, connected: false, connectedRoomId: '', discoveredRoomId: '', roomStatus: null,
    onlineEvidence: 'unknown', observationTargetMs: OBSERVE_MS, rawEventCounts: {},
    forwardedEventCounts: {}, normalizedEventCounts: {}, giftIds: [], fixtures: [],
    fixturesDroppedByLimit: 0, statuses: [], errors: [], writesToTikTok: 0,
    credentialsUsed: false, savedProfileUsed: false, externalSecretFilesRead: false };
  const giftIds = new Set(), identifiers = new Map();
  const parts = sourceParts();
  report.callbackSha256 = parts.callbackSha256;
  const context = vm.createContext({ require: createRequire(path.join(ROOT, 'main.js')),
    widgetGenelOlayEkle(type, payload) {
      increment(report.normalizedEventCounts, type);
      if (report.fixtures.length < 1000) report.fixtures.push(sanitizedFixture(type, payload, identifiers, ACCOUNTS.indexOf(username)));
      else report.fixturesDroppedByLimit++;
    } });
  const normalize = vm.runInContext(parts.pure + '\n(' + parts.callback + ')', context);
  const sdk = await import('tiktok-live-connector');
  assert.equal(sdk.SignConfig.apiKey, undefined, 'Anonymous child must not inherit a signing key');
  assert.equal(sdk.SignConfig.basePath, 'https://api.eulerstream.com');
  const { createLiveSession } = require('../lib/live-session.cjs');
  let connection, session, stopping = false, stopReason, observationStart, deadline;
  let finishObservation;
  const done = new Promise(resolve => { finishObservation = resolve; });
  function stop(reason) {
    if (stopping) return;
    stopping = true; stopReason = reason;
    session?.close();
    finishObservation();
  }
  function trackError(error) {
    if (!stopping && report.errors.length < 10) report.errors.push(errorFacts(error));
  }
  function roomFacts() {
    const id = numericId(connection?.roomId);
    if (id) report.discoveredRoomId = id;
    const status = connection?.roomInfo?.data?.status;
    if (typeof status === 'number' && Number.isFinite(status)) {
      report.roomStatus = status;
      report.onlineEvidence = status === 4 ? 'offline-room-status-4' : status === 2 ? 'online-room-status-2' : 'other-room-status';
    }
  }
  session = createLiveSession({ events: sdk.WebcastEvent,
    createConnection: () => {
      report.attempts++;
      assert.equal(report.attempts, 1, 'QA cannot retry an account');
      connection = new sdk.TikTokLiveConnection(username, { ...OPTIONS });
      for (const event of new Set(Object.values(sdk.WebcastEvent))) connection.on(event, payload => {
        if (stopping) return;
        increment(report.rawEventCounts, event);
        if (event === sdk.WebcastEvent.GIFT) {
          const id = numericId(payload?.giftId || payload?.gift?.id);
          if (id) giftIds.add(id);
        }
      });
      connection.on('websocketConnected', () => { report.websocketConnected = true; });
      connection.on('error', trackError);
      // Transparent public-method observation; SDK routes and requests stay intact.
      for (const name of ['fetchRoomId', 'fetchRoomInfo', 'connect']) {
        const original = connection[name].bind(connection);
        connection[name] = async (...args) => {
          try {
            const value = await original(...args);
            roomFacts();
            if (name === 'fetchRoomId' && numericId(value)) report.discoveredRoomId = numericId(value);
            return value;
          } catch (error) { roomFacts(); trackError(error); throw error; }
        };
      }
      return connection;
    },
    onStatus: status => {
      if (stopping) return;
      roomFacts();
      if (report.statuses.at(-1)?.status !== status.status) report.statuses.push({ status: status.status,
        reason: status.reason, attempt: status.attempt, elapsedMs: Math.round(performance.now() - start) });
      // close() cancels the retry scheduled by the real session on any failure.
      if (['waiting', 'error'].includes(status.status)) stop('session-' + status.reason);
    },
    onEvent: (type, payload) => {
      if (stopping) return;
      increment(report.forwardedEventCounts, type);
      try { normalize(type, payload); }
      catch (error) { trackError(error); stop('normalization-error'); }
    } });
  const onSignal = () => stop('owned-child-signal');
  process.once('SIGTERM', onSignal); process.once('SIGINT', onSignal);
  try {
    const state = await session.start(username);
    if (!stopping && state.status === 'connected' && numericId(state.roomId)) {
      report.connected = true; report.connectedRoomId = numericId(state.roomId);
      report.onlineEvidence = 'connected-live-room';
      report.connectedAt = new Date().toISOString();
      observationStart = performance.now();
      deadline = setTimeout(() => stop('observation-complete'), OBSERVE_MS);
    } else if (!stopping) stop('session-' + state.reason);
    await done;
  } catch (error) { trackError(error); stop('probe-error'); }
  finally {
    clearTimeout(deadline);
    report.observedMs = observationStart ? Math.round(performance.now() - observationStart) : 0;
    roomFacts(); session.close();
    const transport = connection?.wsClient;
    let disconnectResolved = false;
    const disconnect = Promise.resolve().then(() => connection?.disconnect()).then(() => { disconnectResolved = true; }).catch(() => {});
    await Promise.race([disconnect, pause(2500)]);
    if (!disconnectResolved || connection?.isConnected || connection?.isConnecting) {
      try { transport?.terminate(); } catch {}
      try { connection?.wsClient?.terminate(); } catch {}
      await Promise.race([Promise.resolve(connection?.disconnect()).catch(() => {}), pause(300)]);
    }
    report.cleanup = { sessionClosed: true, retryDisabled: true, disconnectResolved,
      isConnectedAfter: connection?.isConnected ?? false, isConnectingAfter: connection?.isConnecting ?? false,
      ownedChildExitClosesOutstandingTransports: true };
    process.removeListener('SIGTERM', onSignal); process.removeListener('SIGINT', onSignal);
  }
  report.giftIds = [...giftIds]; report.endReason = stopReason;
  const categories = report.errors.map(error => error.category);
  report.outcome = report.connected ? 'connected' : categories.includes('rate-limit') ? 'rate-limit'
    : categories.includes('access') ? 'access' : report.onlineEvidence === 'offline-room-status-4' || categories.includes('offline') ? 'offline'
      : categories.includes('transport') ? 'transport' : stopReason === 'session-timeout' || categories.includes('timeout') ? 'timeout'
        : categories.includes('access-or-page-shape') ? 'access-or-page-shape' : 'connection';
  if (report.outcome === 'offline') report.onlineEvidence = 'sdk-offline-evidence';
  report.finishedAt = new Date().toISOString(); report.elapsedMs = Math.round(performance.now() - start);
  process.stdout.write(JSON.stringify(report) + '\n', () => process.exit(0));
}

function childRun(args, timeoutMs, extraEnv = {}) {
  return new Promise(resolve => {
    const start = performance.now();
    const child = spawn(process.execPath, args, { cwd: ROOT, windowsHide: true,
      env: cleanEnvironment(extraEnv), stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderrBytes = 0, timedOut = false, spawnError;
    child.stdout.on('data', chunk => { if (stdout.length < 4 * 1024 * 1024) stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderrBytes += chunk.length; });
    child.once('error', error => { spawnError = safeName(error.code || error.name); });
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.once('close', (exitCode, signal) => {
      clearTimeout(timer);
      resolve({ stdout, process: { exitCode, signal, timedOut, stderrBytes, spawnError,
        elapsedMs: Math.round(performance.now() - start), environment: 'OS-allowlist-no-secrets-no-custom-proxy' } });
    });
  });
}

async function replayFixtures(accounts, output) {
  const fixtures = accounts.flatMap(account => account.fixtures || []);
  if (!accounts.some(account => account.connected)) return { status: 'skipped-no-direct-connection', actualFixtures: 0 };
  if (!fixtures.length) return { status: 'skipped-no-observed-events', actualFixtures: 0 };
  const { createMediaStudio } = require('../lib/media-studio.cjs');
  const parts = sourceParts();
  const values = new Map([['tiktok_active_account', 'qa_replay']]);
  const store = { get: (key, fallback) => structuredClone(values.get(key) ?? fallback),
    set: (key, value) => values.set(key, structuredClone(value)) };
  const notifications = [], accepted = [], counts = {};
  const studio = createMediaStudio({ store, root: path.join(output, 'isolated-media'),
    accessKey: 'synthetic-qa-only', getChannel: () => 'qa_replay', onEvent: event => notifications.push(event) });
  const context = vm.createContext({ fs, path, crypto, URL, Buffer, __dirname: ROOT,
    require: createRequire(path.join(ROOT, 'main.js')), store, WIDGET_PORT: 65429,
    process: { env: {}, resourcesPath: path.join(output, 'unused-resources') }, overlayBridge: null,
    platform: { ingest(type, payload, channel) { accepted.push({ type, payload: plain(payload) }); studio.ingest(type, payload, channel); } },
    onIzlemeArsiviniHazirla() {} });
  const api = vm.runInContext(parts.widgets + '\n({event:widgetGenelOlayEkle,state:widgetBirlesikDurum})', context);
  const ids = [...new Set(fixtures.filter(f => f.type === 'gift').map(f => f.payload.giftId).filter(Boolean))];
  const summary = { status: 'passed', actualFixtures: fixtures.length, giftIds: ids, attemptedByType: counts,
    acceptedByType: {}, ignoredByWidgetDedupe: 0, mediaReceiver: 'isolated-createMediaStudio-onEvent',
    widgetReceiver: 'actual-main.js-functions-with-in-memory-store', renderedPlaybackTested: false,
    realGiftToGameEndToEnd: false, chatContentsPersisted: false, eventIdentifiers: 'pseudonymized-stable-within-account' };
  try {
    for (const id of ids) await studio.save({ url: 'https://synthetic.invalid/qa.mp4', kind: 'video', giftId: id, enabled: true });
    if (fixtures.some(f => f.type === 'like')) await studio.save({ url: 'https://synthetic.invalid/qa-like.mp4', kind: 'video', trigger: 'like', likeThreshold: 1, enabled: true });
    if (fixtures.some(f => f.type === 'follow')) await studio.save({ url: 'https://synthetic.invalid/qa-follow.mp4', kind: 'video', trigger: 'follow', enabled: true });
    let wrongId = '999999999'; while (ids.includes(wrongId)) wrongId += '9';
    const wrong = await studio.save({ url: 'https://synthetic.invalid/qa-wrong.mp4', kind: 'video', giftId: wrongId, enabled: true });
    for (const fixture of fixtures) { increment(counts, fixture.type); api.event(fixture.type, fixture.payload); }
    const expected = { totalLikes: 0, totalCoins: 0, totalGifts: 0, totalShares: 0, followers: 0, subscribers: 0, viewerCount: 0 };
    for (const { type, payload } of accepted) {
      increment(summary.acceptedByType, type);
      if (type === 'gift') { expected.totalCoins += Math.max(0, Number(payload.coins) || 0); expected.totalGifts += Math.max(1, Number(payload.count ?? payload.repeatCount) || 1); }
      if (type === 'like') expected.totalLikes += Math.max(1, Number(payload.likeCount ?? payload.count) || 1);
      if (type === 'follow') expected.followers++;
      if (type === 'share') expected.totalShares += Math.max(1, Number(payload.count ?? payload.shareCount) || 1);
      if (type === 'subscribe') expected.subscribers++;
      if (type === 'viewer') expected.viewerCount = Math.max(0, Number(payload.viewerCount ?? payload.count) || 0);
    }
    const state = plain(api.state());
    for (const [key, value] of Object.entries(expected)) assert.equal(state.stats[key], value, 'Observed fixture widget ' + key);
    assert.equal(notifications.filter(event => event.item.id === wrong.id).length, 0, 'Wrong gift ID must not route');
    const acceptedGifts = accepted.filter(event => event.type === 'gift');
    assert.equal(notifications.filter(event => event.trigger.type === 'gift').length, acceptedGifts.length, 'Actual normalized gifts reach isolated media receiver');
    for (const gift of acceptedGifts) assert.ok(notifications.some(event => event.trigger.giftId === gift.payload.giftId), 'Exact observed gift ID delivered');
    const duplicate = fixtures.find(fixture => fixture.payload.eventId);
    if (duplicate) {
      const before = { accepted: accepted.length, media: notifications.length };
      api.event(duplicate.type, duplicate.payload);
      assert.equal(accepted.length, before.accepted); assert.equal(notifications.length, before.media);
      summary.duplicateObservedIdSuppressed = true;
    }
    summary.ignoredByWidgetDedupe = fixtures.length - accepted.length;
    summary.widgetTotals = Object.fromEntries(Object.keys(expected).map(key => [key, state.stats[key]]));
    summary.mediaEventsByType = {};
    notifications.forEach(event => increment(summary.mediaEventsByType, event.trigger.type));
    summary.negativeGiftIdRejected = true;
  } catch (error) { summary.status = 'failed'; summary.error = errorFacts(error); }
  finally { studio.close(); }
  return summary;
}

const hashes = () => Object.fromEntries(WATCHED.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')]));
function markdown(report) {
  const lines = ['# Passive multi-account live QA', '', 'Started: ' + report.startedAt,
    'Finished: ' + (report.finishedAt || 'running'), '',
    '| Public test account | Result | Discovered room ID | Connected room ID | Observed ms | Gift IDs |',
    '| --- | --- | --- | --- | ---: | --- |'];
  for (const account of report.accounts) lines.push('| @' + account.username + ' | ' + account.outcome + ' | ' +
    (account.discoveredRoomId || 'none') + ' | ' + (account.connectedRoomId || 'none') + ' | ' +
    (account.observedMs || 0) + ' | ' + ((account.giftIds || []).join(', ') || 'none') + ' |');
  lines.push('', '## Connection options', '',
    '- Same installed public SDK and method as main.js: tiktok-live-connector 2.4.4, new TikTokLiveConnection(username, options), connect().',
    '- Same explicit options: processInitialData=false; enableExtendedGiftInfo=false. fetchRoomInfoOnConnect=true remains the SDK default.',
    '- Main optionally reads EULER_API_KEY / euler-api-key.txt; QA reads neither. SIGN_API_KEY, SIGN_API_URL, NODE_OPTIONS and custom proxy/session settings are excluded by an OS-only child environment.',
    '- The SDK default anonymous signing provider remains api.eulerstream.com. Built-in public route fallbacks are unchanged; there is no custom bypass or external secret key.',
    '- Same createLiveSession event/streak filtering and exact main.js normalization callback. QA closes on first failure to cancel production retry scheduling; one connection attempt per account.',
    '- Connect deadline: real session 25 seconds. Observation: 20 seconds after successful connection. Child hard limit: 52 seconds including cleanup. Backoff: 5 seconds, 15 seconds after a rate-limit result.', '',
    '## Live evidence', '');
  for (const account of report.accounts) lines.push('- @' + account.username + ': raw=' + JSON.stringify(account.rawEventCounts || {}) +
    '; forwarded=' + JSON.stringify(account.forwardedEventCounts || {}) + '; normalized=' + JSON.stringify(account.normalizedEventCounts || {}) +
    '; onlineEvidence=' + (account.onlineEvidence || 'unknown') + '; endReason=' + (account.endReason || 'unknown') +
    '; error categories=' + [...new Set((account.errors || []).map(error => error.category))].join(', ') + '.');
  lines.push('', '## Separate isolated validation', '',
    '- Actual observed fixture replay: ' + (report.fixtureReplay?.status || 'pending') + '; fixtures=' + (report.fixtureReplay?.actualFixtures || 0) + '.',
    '- Existing tests/live-routing-regression.test.cjs: ' + (report.routingRegression?.status || 'pending') +
      '; counts=' + JSON.stringify(report.routingRegression?.counts || {}) + '.',
    '- Regression coverage: 14 game media routes, 13 widgets, SDK v3 profile/chat/viewer/gift fields, gift streak completion/deduplication, account separation, exact gift IDs, fan-club/TTS metadata, and 13 game account HTTP/WS handoffs on isolated ports. These are synthetic receivers, not running game engines.', '',
    '## Explicit gaps', '',
    '- No game was launched or contacted by the live probe. Real gift-to-running-game end-to-end acceptance is not established.',
    '- An account is offline only with explicit SDK offline evidence; access/rate-limit/transport/timeouts never establish offline status.',
    '- No saved/encrypted launcher profile, license, session cookies or external secret file was read. No accounts/settings were changed. No outgoing chat, likes, gifts, purchases, installs or publication.',
    '- Only room IDs, event counts, gift IDs and numeric normalized fixtures are persisted. Viewer identities/avatars, chat contents, original event IDs, signed URLs, headers and error messages are excluded.',
    '- Replay substitutes a QA viewer and stable QA event IDs. Chat text is empty in fixtures. Media callbacks validate routing only; no rendered audio/video or game effects are asserted.',
    '- Source hash changes observed during the run: ' + JSON.stringify(report.sourceChanges || []) + '. Concurrent changes belong to other work; this helper writes only itself and this report directory.',
    '', 'See report.json for timestamped attempts, sanitized error trees, cleanup evidence, fixtures, option comparison, and source hashes.');
  return lines.join('\n') + '\n';
}

async function main() {
  if (process.argv[2] === '--observe') return observe(process.argv[3]);
  if (process.argv[2] === '--replay-only') {
    const reportPath = path.join(OUTPUT, 'report.json');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    report.fixtureReplay = await replayFixtures(report.accounts, OUTPUT);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(path.join(OUTPUT, 'REPORT.md'), markdown(report));
    process.stdout.write(JSON.stringify(report.fixtureReplay) + '\n');
    return;
  }
  assert.equal(process.argv.length, 2, 'No arbitrary accounts or output paths accepted');
  fs.mkdirSync(OUTPUT, { recursive: true });
  assert.equal(fs.existsSync(path.join(OUTPUT, 'report.json')), false, 'Do not overwrite an existing live run; inspect or replay it');
  const report = { startedAt: new Date().toISOString(), nodeVersion: process.version, output: OUTPUT,
    purpose: 'Explicitly authorized test accounts; passive SDK subscription only', accounts: [],
    sourceBefore: hashes(), actualGameRuntimesTested: 0, realGiftToGameEndToEnd: false,
    scope: { helper: path.join(ROOT, 'tools/qa-live-multi-account.cjs'), reports: OUTPUT,
      savedProfileRead: false, externalSecretKeysUsed: false, accountSettingsChanged: false,
      outgoingChat: 0, outgoingGifts: 0, purchases: 0, appsStopped: 0 },
    optionComparison: { sdk: 'tiktok-live-connector', version: '2.4.4', method: 'TikTokLiveConnection.connect()',
      mainExplicitOptions: OPTIONS, probeExplicitOptions: OPTIONS, fetchRoomInfoOnConnect: 'SDK default true',
      mainOptionalCredential: 'EULER_API_KEY or apps/tiktok-vs/euler-api-key.txt; not inspected',
      probeCredentials: 'none; inherited secrets and overrides excluded',
      routing: 'same createLiveSession + exact main.js onEvent callback', retryDifference: 'QA closes on first failure; main retries' } };
  const save = () => {
    fs.writeFileSync(path.join(OUTPUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(path.join(OUTPUT, 'REPORT.md'), markdown(report));
  };
  save();
  for (const [index, username] of ACCOUNTS.entries()) {
    process.stdout.write(JSON.stringify({ phase: 'probe-start', username, at: new Date().toISOString() }) + '\n');
    const result = await childRun([__filename, '--observe', username], HARD_CHILD_MS);
    let account;
    try { account = JSON.parse(result.stdout.trim()); assert.equal(account.username, username); }
    catch { account = { username, outcome: result.process.timedOut ? 'timeout' : 'probe-process-error',
      connected: false, onlineEvidence: 'unknown', endReason: 'no-complete-whitelisted-result',
      cleanup: { ownedChildExited: true, disconnectConfirmationAvailable: false } }; }
    account.process = result.process; report.accounts.push(account); save();
    process.stdout.write(JSON.stringify({ phase: 'probe-result', username, outcome: account.outcome,
      roomId: account.connectedRoomId || '', rawEventCounts: account.rawEventCounts || {}, giftIds: account.giftIds || [] }) + '\n');
    if (index < ACCOUNTS.length - 1) {
      const backoff = account.outcome === 'rate-limit' ? 15000 : BACKOFF_MS;
      account.backoffAfterMs = backoff; save(); await pause(backoff);
    }
  }
  report.fixtureReplay = await replayFixtures(report.accounts, OUTPUT); save();
  const temp = path.join(OUTPUT, 'regression-tmp'); fs.mkdirSync(temp, { recursive: true });
  const result = await childRun(['--test', '--test-reporter=tap', 'tests/live-routing-regression.test.cjs'], 60000, { TEMP: temp, TMP: temp });
  fs.writeFileSync(path.join(OUTPUT, 'live-routing-regression.tap'), result.stdout);
  const counts = Object.fromEntries(['tests', 'suites', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(key =>
    [key, Number(new RegExp('^# ' + key + ' (\\d+)$', 'm').exec(result.stdout)?.[1] || 0)]));
  report.routingRegression = { status: result.process.exitCode === 0 && !result.process.timedOut && counts.tests > 0 ? 'passed' : 'failed',
    command: 'node --test --test-reporter=tap tests/live-routing-regression.test.cjs', counts,
    process: result.process, failures: result.stdout.split(/\r?\n/).filter(line => /^\s*not ok \d+ - /.test(line)).map(line => line.trim()),
    evidence: 'live-routing-regression.tap', actualGamesRunning: false };
  report.sourceAfter = hashes();
  report.sourceChanges = WATCHED.filter(file => report.sourceBefore[file] !== report.sourceAfter[file]);
  report.helperSha256 = crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
  report.finishedAt = new Date().toISOString(); save();
  process.stdout.write(JSON.stringify({ phase: 'complete', outcomes: report.accounts.map(a => ({ username: a.username, outcome: a.outcome })),
    fixtureReplay: report.fixtureReplay.status, routingRegression: report.routingRegression, output: OUTPUT }) + '\n');
  if (report.routingRegression.status !== 'passed' || report.fixtureReplay.status === 'failed') process.exitCode = 1;
}

if (require.main === module) main().catch(error => {
  process.stderr.write(JSON.stringify({ phase: 'qa-error', error: errorFacts(error) }) + '\n');
  process.exit(1);
});
module.exports = { errorFacts, sanitizedFixture, sourceParts };
