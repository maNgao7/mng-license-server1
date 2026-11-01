'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const asar = require('@electron/asar');

const source = path.resolve(__dirname, '..');
const baseline = 'D:/TikMnG-Release-7.0.6-candidate/win-unpacked/resources/app.asar';
const stage = 'D:/TikMnG-Release-7.0.7-build';
const output = 'D:/TikMnG-Release-7.0.7-candidate';
const replacements = ['main.js', 'lib/voice-driving-package.cjs', 'lib/app-updates.cjs', 'lib/catalog-defaults.json', 'renderer/app.js'];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

assert.equal(fs.existsSync(stage), false, 'Never overwrite an existing build directory');
assert.equal(JSON.parse(asar.extractFile(baseline, 'package.json')).version, '7.0.6');
assert.equal(JSON.parse(fs.readFileSync(path.join(source, 'package.json'))).version, '7.0.7');
asar.extractAll(baseline, stage);
for (const relative of replacements) fs.copyFileSync(path.join(source, relative), path.join(stage, relative));
for (const relative of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(source, relative), path.join(stage, relative));
fs.cpSync(path.join(source, 'build'), path.join(stage, 'build'), { recursive: true });

const metadata = JSON.parse(fs.readFileSync(path.join(stage, 'lib/admin-games.json')));
assert.deepEqual(metadata, JSON.parse(asar.extractFile(baseline, 'lib/admin-games.json')),
    'Private preview package paths must not leak into the public build');
const report = { prepared: true, baselineVersion: '7.0.6', version: '7.0.7', stage, output,
    baselineArchiveSha256: sha256(fs.readFileSync(baseline)), replacements,
    publicAdminMetadataPreserved: true, runtimeDependenciesFromPublishedBaseline: true };
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'build-source.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
