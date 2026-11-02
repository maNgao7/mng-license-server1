'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const previous = 'D:/TikMnG-Release-7.0.0-source/maintenance/yaratik-arena-0.1.22';
const destination = 'D:/TikMnG-Release-7.0.0-source/maintenance/yaratik-arena-0.1.23';
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? ['bin', 'obj', 'node_modules'].includes(entry.name) ? [] : walk(path.join(directory, entry.name))
    : [path.join(directory, entry.name)]);
}
function copy(relative) {
  const source = path.join(root, relative), target = path.join(destination, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target);
}
for (const folder of ['src', 'tests', 'bridge', 'catalog', 'defaults', 'assets', 'bootstrap']) {
  const current = ['src', 'tests'].includes(folder), inventory = path.join(current ? root : previous, folder);
  for (const file of walk(inventory)) {
    const relative = path.relative(current ? root : previous, file);
    if (/\.(?:exe|dll|zip|pdb|log)$/i.test(relative)) continue;
    if (fs.existsSync(path.join(root, relative))) copy(relative);
  }
}
for (const file of ['ammo-native-tests.cjs', 'pursuit-tests.cjs', 'chase-tests.cjs', 'final-event-tests.cjs',
  'startup-exit-native-tests.cjs', 'connection-menu-hotfix-tests.cjs', 'commands.cjs', 'install-hotfix.cjs']) copy('qa/' + file);
for (const file of ['prepare-launcher-package.cjs', 'snapshot-023.cjs', 'record-023-verification.cjs']) copy('tools/' + file);
copy('README.md');
fs.copyFileSync('D:/TikMnG-Yaratik-Arena-0.1.23-release/package-descriptor.json', path.join(destination, 'package-descriptor.json'));
console.log(destination);
