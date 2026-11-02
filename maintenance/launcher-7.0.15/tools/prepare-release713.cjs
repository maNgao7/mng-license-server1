'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const source = path.resolve(__dirname, '..');
const stage = 'D:/TikMnG-Release-7.0.13-build';
const output = path.resolve(process.env.MNG_RELEASE713_OUTPUT || 'D:/TikMnG-Release-7.0.13-ready');
assert.equal(fs.existsSync(path.join(output, 'latest.yml')), false, 'Do not overwrite a finalized candidate');
for (const directory of [stage, output]) fs.mkdirSync(directory, { recursive: true });
for (const file of ['main.js', 'preload.js', 'license-server.txt']) fs.copyFileSync(path.join(source, file), path.join(stage, file));
for (const directory of ['lib', 'renderer', 'build']) fs.cpSync(path.join(source, directory), path.join(stage, directory), { recursive: true });
// Preview-only game paths must never replace the production game definitions.
fs.copyFileSync('D:/TikMnG-Release-7.0.12-build/lib/admin-games.json', path.join(stage, 'lib/admin-games.json'));
const pkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
pkg.version = '7.0.13';
pkg.build.directories.output = output;
pkg.build.releaseInfo = { releaseNotes: fs.readFileSync(path.join(source, 'RELEASE-NOTES-7.0.13.md'), 'utf8') };
pkg.build.files.push('!lib/portrait-engine/**/*', '!node_modules/onnxruntime-node/**/*');
fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
const lock = JSON.parse(fs.readFileSync(path.join(source, 'package-lock.json'), 'utf8'));
lock.version = pkg.version;
lock.packages[''].version = pkg.version;
fs.writeFileSync(path.join(stage, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n');
if (!fs.existsSync(path.join(stage, 'node_modules'))) fs.symlinkSync('D:/TikMnG-Release-7.0.12-build/node_modules', path.join(stage, 'node_modules'), 'junction');
fs.writeFileSync(path.join(output, 'build-source.json'), JSON.stringify({ version: pkg.version, source, stage, output, published: false, productionAppId: pkg.build.appId }, null, 2));
console.log(JSON.stringify({ stage, output, version: pkg.version, published: false }));
