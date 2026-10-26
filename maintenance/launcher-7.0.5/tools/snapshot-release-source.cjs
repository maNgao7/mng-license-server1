'use strict';
const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const repository = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(path.join(repository, '.git'))) throw new Error('Explicit release repository is required.');
const destination = path.join(repository, 'maintenance', 'launcher-' + version);
fs.mkdirSync(destination, { recursive: true });
const roots = ['main.js', 'preload.js', 'package.json', 'package-lock.json', 'license-server.txt', 'AGENTS.md', 'lib', 'renderer', 'tests', 'tools', 'scripts', 'build'];
for (const name of roots) {
    const from = path.join(source, name);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(destination, name), { recursive: true, filter(file) {
        return !file.split(path.sep).some(part => part === 'node_modules' || part === 'artifacts');
    } });
}
const problems = [];
function audit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name), relative = path.relative(destination, file).split(path.sep).join('/');
        const ownedPreview = /^renderer\/assets\/voice-previews\/(?:d[12]-\d{5}|okur-tr-v1|ema-tr-v1)\.wav$/.test(relative);
        const ownedSound = /^renderer\/assets\/sound-effects\/[a-z0-9-]+\.wav$/.test(relative) && require('../lib/sound-effects.cjs').CATALOG.some(sound => relative === 'renderer/assets/sound-effects/' + sound.file);
        if (entry.isSymbolicLink() || /^(?:mng-config|license-backup|config)\.json$|(?:api-key|secret|\.env$)/i.test(entry.name) || /\.(?:exe|mp4|webm|mp3|zip|asar)$/i.test(entry.name) || (/\.(?:wav|ogg)$/i.test(entry.name) && !ownedPreview && !ownedSound)) problems.push(relative);
        if (entry.isDirectory()) audit(file);
    }
}
audit(destination);
if (problems.length) throw new Error('Forbidden release source files: ' + problems.join(', '));
console.log('Sanitized source snapshot: ' + destination);
