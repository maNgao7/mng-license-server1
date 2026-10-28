const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const sourceRoot = path.join(path.dirname(root), 'MNG-Zombie-Strike');
const sourceStage = path.join(root, 'release-v6.5.10', 'staging', 'zombie-war');
const releaseDir = path.join(root, 'release-v6.5.11');
const target = path.join(releaseDir, 'staging', 'zombie-war');
const excluded = /(^|[\\/])(?:logs|crash-reports|\.git|\.gradle|\.map-import|video-frames)(?:[\\/]|$)|\.(?:log|tmp)$/i;

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.cpSync(sourceStage, target, { recursive: true, force: true, filter: file => !excluded.test(file) });
fs.copyFileSync(path.join(sourceRoot, 'forge-mod', 'build', 'libs', 'mng_zombie_strike-1.0.0.jar'), path.join(target, 'game-instance', 'mods', 'mng-zombie-strike-1.0.0.jar'));
fs.copyFileSync(path.join(sourceRoot, 'live-bridge', 'server.js'), path.join(target, 'live-bridge', 'server.js'));
fs.copyFileSync(path.join(sourceRoot, 'game-instance', 'config', 'mng-zombie-strike.json'), path.join(target, 'game-instance', 'config', 'mng-zombie-strike.json'));
fs.writeFileSync(path.join(target, '.tikmng-package.json'), JSON.stringify({ version: '6.5.11' }, null, 2));
console.log(target);
