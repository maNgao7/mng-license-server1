'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { assertSafePath } = require('../lib/download.cjs');
const source = path.resolve(__dirname, '..'), stage = 'D:/TikMnG-Release-7.0.9-build', output = 'D:/TikMnG-Release-7.0.9-ready';
const baseline = 'D:/TikMnG-Release-7.0.8-build';
for (const directory of [stage, output]) { assertSafePath(directory); fs.mkdirSync(directory, { recursive: true }); }
for (const name of ['main.js', 'preload.js', 'license-server.txt', 'package-lock.json']) fs.copyFileSync(path.join(source, name), path.join(stage, name));
for (const name of ['lib', 'renderer', 'build']) fs.cpSync(path.join(source, name), path.join(stage, name), { recursive: true });
// Public builds retain the already shipped administrator manifest, not this
// workstation's new private test paths or a dependency on its D: drive.
fs.copyFileSync(path.join(baseline, 'lib/admin-games.json'), path.join(stage, 'lib/admin-games.json'));
const pkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
pkg.version = '7.0.9'; pkg.build.directories.output = output;
pkg.build.releaseInfo = { releaseNotes: fs.readFileSync(path.join(source, 'RELEASE-NOTES-7.0.9.md'), 'utf8') };
fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
const deps = path.join(stage, 'node_modules');
if (!fs.existsSync(deps)) fs.symlinkSync(path.join(baseline, 'node_modules'), deps, 'junction');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if (hash(path.join(stage, 'lib/admin-games.json')) !== hash(path.join(baseline, 'lib/admin-games.json'))) throw new Error('Private manifest entered public stage');
fs.writeFileSync(path.join(output, 'build-source.json'), JSON.stringify({ prepared: true, published: false, version: '7.0.9', stage, output,
    source, privatePathsExcluded: true, sharedPackageRolloutEnabled: false }, null, 2));
console.log(JSON.stringify({ stage, output, publicMetadataUnchanged: true }));
