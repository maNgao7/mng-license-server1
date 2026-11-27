'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const nonAscii = /[^\x00-\x7f]/;
const escapeArgPath = value => value.replaceAll('\\', '\\\\');

function relativizeArgumentFile(text, instance, roots, paths = path) {
    for (const root of roots) {
        if (!nonAscii.test(root)) continue;
        const relative = paths.relative(instance, root) || '.';
        if (paths.isAbsolute(relative) || nonAscii.test(relative)) continue;
        text = text.replaceAll(escapeArgPath(root + paths.sep), escapeArgPath(relative + paths.sep));
        text = text.replaceAll('"' + escapeArgPath(root) + '"', '"' + escapeArgPath(relative) + '"');
    }
    return text;
}

function enablePathCompatibility(gameScript) {
    if (process.platform !== 'win32' || path.basename(gameScript || '') !== 'launch-game.cjs') return;
    const gameRoot = path.dirname(gameScript);
    if (!nonAscii.test(gameRoot)) return;
    const instance = path.join(gameRoot, 'game-instance');
    const argumentFile = path.join(instance, 'launch-args.txt');
    const library = path.resolve(gameRoot, '../../..');
    const roots = [instance, gameRoot];
    if (path.basename(library) === '.game-library') roots.push(library);

    // Java reads @files using the Windows native encoding. Resolve Forge paths
    // from its working directory so an existing Unicode install can stay put.
    // Only intercept the Java launch in this dedicated game wrapper process.
    const spawn = childProcess.spawn;
    childProcess.spawn = function (file, args, options) {
        if (path.basename(file).toLowerCase() === 'java.exe' && args?.length === 1 &&
            args[0] === '@' + argumentFile && options?.cwd === instance) {
            childProcess.spawn = spawn;
            const original = fs.readFileSync(argumentFile, 'utf8');
            const compatible = relativizeArgumentFile(original, instance, roots);
            if (compatible !== original) fs.writeFileSync(argumentFile, compatible, 'utf8');
            args = ['@launch-args.txt'];
        }
        return spawn.call(this, file, args, options);
    };
}

if (process.argv[1]) enablePathCompatibility(process.argv[1]);
module.exports = { relativizeArgumentFile };
