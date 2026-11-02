'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// Read-only QA: capture the user-config hash before editing and supply it here.
// node qa/defaults-gift-guide-check.cjs --launcher <root> --source-guide <png> --expected-user-config-sha256 <hash>
const args = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  assert.ok(index >= 0 && args[index + 1] && !args[index + 1].startsWith('--'), `Required: ${name}`);
  return args[index + 1];
}
const root = path.resolve(__dirname, '..');
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const checks = [];
function check(name, action) {
  action();
  checks.push(name);
}

function main() {
  const launcher = path.resolve(option('--launcher'));
  const sourceGuide = path.resolve(option('--source-guide'));
  const expectedUserHash = option('--expected-user-config-sha256').toLowerCase();
  assert.match(expectedUserHash, /^[a-f0-9]{64}$/);
  const userFile = path.join(root, 'userdata', 'mod-settings.json');
  const userBytes = fs.readFileSync(userFile);
  const userStat = fs.statSync(userFile);
  const user = JSON.parse(userBytes.toString('utf8'));
  check('Existing user config matches the supplied baseline SHA-256', () => {
    assert.equal(sha256(userBytes), expectedUserHash);
  });
  const mtimeIndex = args.indexOf('--expected-user-config-mtime-ms');
  if (mtimeIndex >= 0) check('Existing user config modification time is unchanged', () => {
    assert.equal(userStat.mtimeMs, Number(args[mtimeIndex + 1]));
  });

  const defaults = readJSON(path.join(root, 'defaults', 'game-settings.json'));
  const source = fs.readFileSync(path.join(root, 'src', 'Settings.cs'), 'utf8');
  const catalog = readJSON(path.join(root, 'catalog', 'gifts.json'));
  check('Gift IDs come from existing spawn bindings and the stored catalog', () => {
    for (const [id, name] of [['5319', 'Blue Bead'], ['5658', 'Parf\u00fcm']]) {
      const bindings = user.Actions.filter(action => action.GiftId === id);
      assert.equal(bindings.length, 1, `Existing binding: ${id}`);
      assert.equal(bindings[0].Op, 'spawn');
      const gifts = catalog.filter(gift => gift.id === id);
      assert.equal(gifts.length, 1, `Catalog gift: ${id}`);
      assert.equal(gifts[0].name, name);
    }
  });
  check('Every 100 likes and first follow default to five creatures', () => {
    assert.equal(defaults.LikeThreshold, 100);
    for (const key of ['LikeAction', 'FollowAction']) {
      assert.deepEqual(defaults[key], { Enabled: true, Name: '', GiftId: '', Op: 'spawn', Count: 5 });
      assert.ok(source.includes(`public TriggerBinding ${key} { get; set; } = new() { Enabled = true, Count = 5 };`));
      assert.ok(source.includes(`settings.${key} ??= new() { Enabled = true, Count = 5 };`));
    }
  });
  check('Twelve gift mappings are preserved with only Blue Bead 10 and Perfume 25 updated', () => {
    assert.deepEqual(defaults.Actions.map(({ GiftId, Op, Count }) => [GiftId, Op, Count]), [
      ['5655', 'spawn', 2], ['5319', 'spawn', 10], ['5658', 'spawn', 25],
      ['5282', 'down', 1], ['8913', 'up', 1], ['17473', 'flash', 3],
      ['6064', 'prison', 1], ['5827', 'release', 1], ['7168', 'bigboss', 1],
      ['5303', 'spawn', 50], ['6427', 'boss', 1], ['7934', 'helper', 1]
    ]);
    const bindings = [...source.matchAll(/new\(\) \{ Name = "([^"]*)", GiftId = "([0-9]+)", Op = "([^"]*)", Count = ([0-9]+) \}/g)]
      .map(([, Name, GiftId, Op, Count]) => ({ Name, GiftId, Op, Count: Number(Count) }));
    assert.deepEqual(bindings, defaults.Actions, 'C# gift fallbacks match JSON defaults');
  });
  check('Health and other gameplay defaults remain intact', () => {
    for (const [key, value] of Object.entries({ BroadcasterUsername: '', PlayerHealth: 500,
      CreatureDamage: 1, CreatureScale: 1.5, CreatureAttackInterval: 1.2,
      MaxCreatures: 2500, PhysicalCreatures: 2500, RoundSeconds: 180,
      KillTarget: 500, WinGoal: 21, FirstWeaponKills: 60, WeaponKillStep: 20 })) {
      assert.equal(defaults[key], value, key);
    }
    assert.ok(source.includes('public int PlayerHealth { get; set; } = CombatBalance.StartingHealth;'));
  });
  check('Existing user config still takes precedence over first-install defaults (source check)', () => {
    assert.match(source, /var file = Path\.Combine\(Data, "mod-settings\.json"\);\s*if \(!File\.Exists\(file\)\) file = Path\.Combine\(Root, "defaults", "game-settings\.json"\);/);
  });

  const original = fs.readFileSync(sourceGuide);
  assert.equal(original.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const guide = { bytes: original.length, width: original.readUInt32BE(16),
    height: original.readUInt32BE(20), sha256: sha256(original) };
  const manifest = readJSON(path.join(root, 'assets', 'publishing', 'manifest.json'));
  const resources = readJSON(path.join(launcher, 'lib', 'game-resources.json'));
  const entries = resources.games.filter(game => game.id === 'yaratik-arena');
  assert.equal(entries.length, 1);
  const launcherGuide = entries[0].guide;
  check('Both gift guides are lossless byte-for-byte copies of the supplied PNG', () => {
    assert.deepEqual(fs.readFileSync(path.join(root, manifest.giftGuide.file)), original);
    assert.deepEqual(fs.readFileSync(path.join(launcher, 'renderer', 'assets', 'gift-guides', launcherGuide.file)), original);
  });
  check('Both guide manifests match PNG bytes, SHA-256 and actual dimensions', () => {
    assert.equal(manifest.giftGuide.alpha, true);
    assert.ok([4, 6].includes(original[25]), 'PNG has an alpha channel');
    for (const metadata of [manifest.giftGuide, launcherGuide]) {
      for (const [key, value] of Object.entries(guide)) assert.equal(metadata[key], value, key);
    }
  });
  check('README and launcher instructions show the updated first-install actions', () => {
    const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
    assert.ok(readme.includes('100 begenide 5 yaratik, ilk takipte 5 yaratik, Blue Bead (5319) 10 yaratik, Parfum (5658) 25 yaratik'));
    const workspace = fs.readFileSync(path.join(launcher, 'renderer', 'workspace.js'), 'utf8');
    assert.ok(workspace.includes('her 100 be\u011feni ve ilk takip 5 yarat\u0131k g\u00f6nderir.'));
  });
  check('Read-only QA leaves existing user config bytes and modification time unchanged', () => {
    assert.deepEqual(fs.readFileSync(userFile), userBytes);
    assert.equal(fs.statSync(userFile).mtimeMs, userStat.mtimeMs);
  });
  console.log(JSON.stringify({ passed: true, mode: 'read-only-static', checks, guide,
    userConfigSha256: expectedUserHash, gameStarted: false, built: false, published: false }, null, 2));
}

try { main(); }
catch (error) {
  console.error(JSON.stringify({ passed: false, checks, error: error.message }, null, 2));
  process.exitCode = 1;
}
