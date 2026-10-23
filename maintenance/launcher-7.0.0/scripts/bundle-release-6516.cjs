const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const release = path.join(root, 'release-v6.5.16');
const zip = path.join(__dirname, '../node_modules/7zip-bin/win/x64/7za.exe');
for (const name of ['battle-royale', 'snow-war', 'mng-orbit']) {
  const source = path.join(release, 'staging', name);
  const archive = path.join(release, `${name}.zip`);
  if (!fs.existsSync(source)) throw new Error(`Missing staging: ${name}`);
  if (fs.existsSync(archive)) throw new Error(`Archive already exists: ${archive}`);
  execFileSync(zip, ['a', '-tzip', '-mx=3', archive, '.'], { cwd: source, windowsHide: true, stdio: 'inherit' });
  execFileSync(zip, ['t', archive], { windowsHide: true, stdio: 'inherit' });
  console.log(`${name}.zip ${fs.statSync(archive).size}`);
}
