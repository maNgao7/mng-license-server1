'use strict';

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const runFile = promisify(execFile);

async function steamProtocolAvailable() {
    if (process.platform !== 'win32') return false;
    try {
        // Read only the public protocol registration, never Steam account data.
        const { stdout } = await runFile('reg.exe', ['query', 'HKCR\\steam\\shell\\open\\command', '/ve'], {
            windowsHide: true, timeout: 1500, maxBuffer: 16384
        });
        return /\bREG_(?:EXPAND_)?SZ\s+\S/.test(stdout);
    } catch { return false; }
}

function createExternalLinkOpener({ openExternal, steamAvailable = steamProtocolAvailable }) {
    return async function openExternalLink(value) {
        if (typeof value !== 'string' || value.length > 4096) throw new Error('Geçerli bir HTTPS bağlantısı gerekli.');
        let target;
        try { target = new URL(value); } catch { throw new Error('Geçerli bir HTTPS bağlantısı gerekli.'); }
        if (target.protocol !== 'https:' || target.username || target.password) throw new Error('Güvenli HTTPS bağlantısı gerekli.');
        const app = target.hostname === 'store.steampowered.com' && !target.port
            ? /^\/app\/([1-9]\d{0,9})(?:\/[^?#]*)?$/.exec(target.pathname) : null;
        if (app) {
            let available = false;
            try { available = await steamAvailable(); } catch { /* HTTPS fallback */ }
            if (available) {
                try {
                    await openExternal('steam://store/' + app[1]);
                    return { basarili: true, target: 'steam' };
                } catch { /* A stale/broken registration must not strand the button. */ }
            }
        }
        await openExternal(target.href);
        return { basarili: true, target: 'browser' };
    };
}

module.exports = { createExternalLinkOpener, steamProtocolAvailable };
