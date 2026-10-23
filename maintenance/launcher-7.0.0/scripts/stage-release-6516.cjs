const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const release = path.join(root, 'release-v6.5.16');
const staging = path.join(release, 'staging');
const apps = path.join(root, 'apps');

if (fs.existsSync(release)) throw new Error('release-v6.5.16 already exists; inspect it before staging again.');
fs.mkdirSync(staging, { recursive: true });

const excluded = /(^|[\\/])(?:logs|crash-reports|playerdata|stats|advancements|screenshots)(?:[\\/]|$)|\.(?:log|tmp)$|session\.lock|launch-args\.txt|verify-args\.txt|game-ready\.flag|euler-api-key\.txt|\.env$/i;
const copy = (source, target) => fs.cpSync(source, target, {
  recursive: true, force: true, dereference: true,
  filter: file => !excluded.test(file)
});

function mark(target, game) {
  fs.writeFileSync(path.join(target, '.tikmng-package.json'), JSON.stringify({ game, version: '6.5.16' }, null, 2));
}

function stageMinecraft(game) {
  const source = path.join(apps, game, 'prototype');
  const target = path.join(staging, game);
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name === 'runtime') continue;
    copy(path.join(source, entry.name), path.join(target, entry.name));
  }
  copy(path.join(apps, 'snow-war', 'prototype', 'runtime'), path.join(target, 'runtime'));
  mark(target, game);
  const required = ['launch-game.cjs', 'runtime/java/bin/java.exe', 'runtime/profile.json', 'runtime/client.jar', 'live-bridge/server.js'];
  for (const file of required) if (!fs.existsSync(path.join(target, file))) throw new Error(`${game}: missing ${file}`);
}

stageMinecraft('battle-royale');
stageMinecraft('snow-war');

const orbitTarget = path.join(staging, 'mng-orbit');
copy(path.join(apps, 'mng-orbit'), orbitTarget);
for (const file of ['collision.test.js', 'orbit-round.integration.cjs', 'orbit-round-verified.png']) {
  try { fs.rmSync(path.join(orbitTarget, file), { force: true }); } catch {}
}
mark(orbitTarget, 'mng-orbit');
console.log(staging);
