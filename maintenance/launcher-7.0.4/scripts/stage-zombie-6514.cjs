const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const sourceRoot = path.join(path.dirname(root), 'MNG-Zombie-Strike');
const source = path.join(root, 'release-v6.5.13', 'staging', 'zombie-war');
const target = path.join(root, 'release-v6.5.14', 'staging', 'zombie-war');
if (fs.existsSync(target)) throw Error('Staging already exists; inspect it before restaging.');
if (!fs.existsSync(path.join(source, 'runtime', 'java', 'bin', 'java.exe'))) throw Error('Bundled Java 17 runtime is missing.');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.cpSync(source, target, {
  recursive: true,
  filter: file => !/(^|[\\/])(?:logs|crash-reports|playerdata|stats|advancements)(?:[\\/]|$)|\.(?:log|tmp)$|launch-args\.txt|verify-args\.txt|session\.lock|euler-api-key\.txt|\.env/i.test(file)
});
fs.copyFileSync(path.join(sourceRoot, 'forge-mod', 'build', 'libs', 'mng_zombie_strike-1.0.0.jar'), path.join(target, 'game-instance', 'mods', 'mng-zombie-strike-1.0.0.jar'));
for (const file of ['server.js', 'events.js', 'live-session.js', 'package.json', 'package-lock.json']) {
  fs.copyFileSync(path.join(sourceRoot, 'live-bridge', file), path.join(target, 'live-bridge', file));
}
fs.copyFileSync(path.join(sourceRoot, 'launch-game.cjs'), path.join(target, 'launch-game.cjs'));
const configFile = path.join(target, 'game-instance', 'config', 'mng-zombie-strike.json');
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
config.username = '';
fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
fs.writeFileSync(path.join(target, '.tikmng-package.json'), JSON.stringify({ version: '6.5.14' }, null, 2));
console.log(target);
