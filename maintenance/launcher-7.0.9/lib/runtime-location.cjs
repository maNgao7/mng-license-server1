'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Also shipped beside game launch scripts: no Electron or third-party dependency.
function safe(file) {
    const absolute = path.resolve(file);
    let current = path.parse(absolute).root;
    for (const part of path.relative(current, absolute).split(path.sep).filter(Boolean)) {
        current = path.join(current, part);
        if (fs.existsSync(current)) {
            const stat = fs.lstatSync(current);
            if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) throw new Error('Unsafe runtime path');
        }
    }
    return absolute;
}

function runtimeDirectory(gameDirectory) {
    const game = safe(gameDirectory);
    const reference = safe(path.join(game, '.tikmng-runtime.json'));
    if (!fs.existsSync(reference)) return path.join(game, 'runtime');
    if (fs.statSync(reference).size > 1024) throw new Error('Invalid runtime reference');
    const data = JSON.parse(fs.readFileSync(reference, 'utf8'));
    if (data.schema !== 1 || !/^[a-f0-9]{64}$/.test(data.sha256 || '')) throw new Error('Invalid runtime reference');
    const container = path.dirname(game), gameRoot = path.dirname(container), library = path.dirname(gameRoot);
    if (!['versions', 'staging'].includes(path.basename(container)) || path.basename(library) !== '.game-library' ||
        !/^[a-f0-9-]{36}$/.test(path.basename(game))) throw new Error('Runtime reference is outside managed installation');
    const component = safe(path.join(library, 'shared-runtimes', data.sha256));
    const receipt = safe(path.join(component, '.tikmng-runtime-complete.json'));
    if (!fs.existsSync(receipt) || fs.statSync(receipt).size > 1024) throw new Error('Shared runtime is incomplete; repair the game');
    const complete = JSON.parse(fs.readFileSync(receipt, 'utf8'));
    if (complete.schema !== 1 || complete.sha256 !== data.sha256) throw new Error('Shared runtime receipt mismatch');
    const runtime = safe(path.join(component, 'runtime'));
    for (const relative of ['java/bin/java.exe', 'profile.json', 'client.jar']) {
        if (!fs.statSync(safe(path.join(runtime, relative))).isFile()) throw new Error('Shared runtime file missing');
    }
    return runtime;
}

function isolatedNativeArguments(args, gameDirectory) {
    const cache = safe(path.join(gameDirectory, '.native-cache'));
    fs.mkdirSync(cache, { recursive: true });
    return args.map(value => /^-D(?:jna\.tmpdir|org\.lwjgl\.system\.SharedLibraryExtractPath|io\.netty\.native\.workdir)=/.test(value)
        ? value.slice(0, value.indexOf('=') + 1) + cache : value);
}

module.exports = { runtimeDirectory, isolatedNativeArguments };
