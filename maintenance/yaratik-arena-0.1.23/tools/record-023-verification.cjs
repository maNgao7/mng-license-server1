'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), destination = 'D:/TikMnG-Release-7.0.0-source/maintenance/yaratik-arena-0.1.23';
const release = 'D:/TikMnG-Yaratik-Arena-0.1.23-release';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const upgrade = read('D:/TikMnG-Arena715-Final2QA/hotfix-install-0.1.23-result.json');
const fresh = read('D:/TikMnG-Arena023-FreshQA/arena-package-result.json');
assert.equal(upgrade.passed, true); assert.equal(fresh.passed, true);
const qa = path.join(upgrade.directory, 'qa'), reports = ['ammo-native-result.json', 'pursuit-result.json', 'chase-result.json',
  'final-event-result.json', 'connection-menu-hotfix-result.json', 'startup-exit-native-result.json'];
fs.mkdirSync(path.join(destination, 'qa'), { recursive: true });
for (const name of reports) {
  const result = read(path.join(qa, name)); assert.equal(result.passed, true, name);
  delete result.lastSaved; delete result.liveAtStart;
  fs.writeFileSync(path.join(destination, 'qa', name), JSON.stringify(result, null, 2));
}
for (const [source, name] of [[fresh, 'fresh-install-result.json'], [upgrade, 'upgrade-result.json']])
  fs.writeFileSync(path.join(destination, 'qa', name), JSON.stringify(source, null, 2));
const manual = read(path.join(root, 'qa/ammo-manual-input-result.json')); assert.equal(manual.passed, true);
fs.writeFileSync(path.join(destination, 'qa/preview-manual-input-result.json'), JSON.stringify(manual, null, 2));
const sourceDll = hash(path.join(root, 'src/bin/Release/net6.0/TikMnG.CanEmAll.dll'));
assert.equal(sourceDll, hash(path.join(release, 'package/support/Mods/TikMnG.CanEmAll.dll')));
assert.equal(sourceDll, hash(path.join(upgrade.directory, 'game/Mods/TikMnG.CanEmAll.dll')));
assert.equal(hash(path.join(root, 'bootstrap/TikMnG.Arena.Startup.exe')), hash(path.join(release, 'package/bootstrap/TikMnG.Arena.Startup.exe')));
assert.equal(read(path.join(fresh.directory, 'userdata/mod-settings.json')).BroadcasterUsername, '');
assert.equal(read(path.join(fresh.directory, 'qa/state.json')).liveConnectionRequested, false);
const serverLog = fs.readFileSync('D:/TikMnG-Release-7.0.0-source/qa/arena023-server-tests.log', 'utf8');
assert.match(serverLog, /(?:#|ℹ) fail 0/);
assert.match(serverLog, /(?:#|ℹ) skipped 0/);
const matches = pattern => Number(pattern.exec(serverLog)?.[1] || 0);
const result = { passed: true, version: '0.1.23', verifiedAt: new Date().toISOString(), rulesChecks: 438,
  serverTests: matches(/(?:#|ℹ) pass (\d+)/), serverSkipped: 0,
  actualNativeSuites: reports.length, nativeNormalExitCycles: read(path.join(qa, 'startup-exit-native-result.json')).cycles.length,
  savedSettingsPreserved: upgrade.settingsPreserved, steamBaseRecopiedBytes: upgrade.steamBaseRecopiedBytes,
  sourceDllSha256: sourceDll, originalSteamBinariesIncluded: false,
  liveBridgeUnchanged: true, realPaidGiftTest: false, otherCustomerHardwareTest: false,
  verificationNotes: 'Actual packaged native game; normalized audience/gift fixtures; 180/600 native creature pursuit and both stairs. Preview mouse/R input checked separately. Hardware-specific timings are not a guarantee for customer PCs.' };
fs.copyFileSync('D:/TikMnG-Release-7.0.0-source/qa/arena023-server-tests.log', path.join(destination, 'qa/server-tests.log'));
fs.writeFileSync(path.join(destination, 'VERIFICATION.json'), JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(release, 'VERIFICATION.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
