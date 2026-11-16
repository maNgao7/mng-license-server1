'use strict';

const path = require('node:path');
const { execFile } = require('node:child_process');
const { randomBytes } = require('node:crypto');

const STARTUP_TIMEOUT_MS = 120000;
const active = new Map();
const launches = new WeakMap();
const normalize = value => path.win32.normalize(String(value)).toLowerCase();
const psString = value => "'" + String(value).replace(/'/g, "''") + "'";
const failure = (code, message) => Object.assign(new Error(message), { code });

// Read only process metadata for this executable. Never read game configs, logs,
// Steam/user profiles or credentials. The command line is reduced to our nonce.
// Prefer the launch nonce; older Steam paths also use an empty baseline + time.
function createUnturnedProcessControl({ directory, execute = execFile,
    platform = process.platform, queryTimeoutMs = 5000 } = {}) {
    validateDirectory(directory);
    const executable = path.win32.join(directory, 'Unturned.exe');
    const processFilter = "Name = 'Unturned.exe' AND ExecutablePath = '" + executable.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    const powershell = path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
    const prelude = `
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$expectedPath=${psString(executable)}
function Read-Game($row) {
  if([string]::IsNullOrEmpty($row.ExecutablePath)){throw 'Unturned process path cannot be verified.'}
  if(![string]::Equals([IO.Path]::GetFullPath($row.ExecutablePath),$expectedPath,[StringComparison]::OrdinalIgnoreCase)){return}
  try {$game=[Diagnostics.Process]::GetProcessById([int]$row.ProcessId)}
  catch [ArgumentException] {return}
  try {
    $null=$game.Handle
    if($game.HasExited){return}
    if(![string]::Equals($game.MainModule.FileName,$expectedPath,[StringComparison]::OrdinalIgnoreCase)){throw 'Unturned process identity changed.'}
    $started=$game.StartTime.ToUniversalTime()
    if([Math]::Abs(($started-$row.CreationDate.ToUniversalTime()).TotalMilliseconds) -gt 1){throw 'Unturned process identity changed.'}
    if([string]::IsNullOrEmpty($row.CommandLine)){throw 'Unturned launch identity cannot be verified.'}
    $token=''
    if($row.CommandLine -match '(?:^|\\s)"?-tikmng-launch=([0-9a-f]{32})"?(?=\\s|$)'){$token=$Matches[1]}
    [pscustomobject]@{pid=[int]$game.Id;executablePath=$expectedPath;startedAt=([DateTimeOffset]$started).ToUnixTimeMilliseconds();startTicks=$started.Ticks.ToString();launchToken=$token;windowHandle=$game.MainWindowHandle.ToInt64().ToString();responding=[bool]$game.Responding}
  } finally {$game.Dispose()}
}
`;
    function run(script, { signal } = {}) {
        if (platform !== 'win32') return Promise.reject(new Error('Unturned startup requires Windows.'));
        return new Promise((resolve, reject) => {
            execute(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(prelude + script, 'utf16le').toString('base64')],
                { windowsHide: true, timeout: queryTimeoutMs, maxBuffer: 65536, signal }, (error, stdout) => {
                    if (error) return reject(failure('UNTURNED_PROCESS_QUERY_FAILED', 'Unturned süreç doğrulaması başarısız: ' + error.message));
                    try { resolve(JSON.parse(String(stdout).replace(/^\uFEFF/, '').trim())); }
                    catch { reject(failure('UNTURNED_PROCESS_QUERY_FAILED', 'Unturned süreç doğrulaması geçersiz yanıt verdi.')); }
                });
        });
    }
    return {
        probe: options => run(`
$rows=@(Get-CimInstance -ClassName Win32_Process -Filter ${psString(processFilter)} -Property ProcessId,ExecutablePath,CreationDate,CommandLine)
$result=@(foreach($row in $rows){$info=Read-Game $row;if($null -ne $info){$info | Select-Object pid,executablePath,startedAt,startTicks,launchToken,windowHandle,responding}})
ConvertTo-Json -InputObject $result -Compress
`, options),
        // This is deliberately separate from discovery and never kills by name,
        // tree or bare PID. Hold the native handle before checking identity, so
        // PID reuse cannot turn cleanup into terminating somebody else's game.
        stop: identity => {
            validateIdentity(identity, executable, { requireToken: false });
            return run(`
$rows=@(Get-CimInstance -ClassName Win32_Process -Filter ${psString(processFilter + ' AND ProcessId = ' + identity.pid)} -Property ProcessId,ExecutablePath,CreationDate,CommandLine)
if($rows.Count -eq 0){@{stopped=$false;absent=$true}|ConvertTo-Json -Compress;exit}
$row=$rows[0]
try {$game=[Diagnostics.Process]::GetProcessById(${identity.pid})}
catch [ArgumentException] {@{stopped=$false;absent=$true}|ConvertTo-Json -Compress;exit}
try {
  $null=$game.Handle
  if($game.HasExited){@{stopped=$false;absent=$true}|ConvertTo-Json -Compress;exit}
  $token=''
  if($row.CommandLine -match '(?:^|\\s)"?-tikmng-launch=([0-9a-f]{32})"?(?=\\s|$)'){$token=$Matches[1]}
  if(![string]::Equals($row.ExecutablePath,$expectedPath,[StringComparison]::OrdinalIgnoreCase) -or ![string]::Equals($game.MainModule.FileName,$expectedPath,[StringComparison]::OrdinalIgnoreCase) -or $game.StartTime.ToUniversalTime().Ticks.ToString() -cne ${psString(identity.startTicks)} -or $token -cne ${psString(identity.launchToken)}){throw 'Unturned cleanup refused: process identity changed.'}
  $game.Kill()
  if(!$game.WaitForExit(2000)){throw 'Owned Unturned process did not stop.'}
  @{stopped=$true;absent=$false}|ConvertTo-Json -Compress
} catch {
  if($game.HasExited){@{stopped=$false;absent=$true}|ConvertTo-Json -Compress}
  else {throw}
} finally {$game.Dispose()}
`).then(result => {
                if (!result || (result.stopped !== true && result.absent !== true)) throw new Error('Unturned süreç temizliği doğrulanamadı.');
                return result;
            });
        }
    };
}

function validateDirectory(directory) {
    if (typeof directory !== 'string' || !path.win32.isAbsolute(directory) || /[\r\n\0]/.test(directory)) throw new Error('Invalid Unturned directory.');
}

function validateIdentity(row, executable, { requireToken = true } = {}) {
    if (!row || !Number.isSafeInteger(row.pid) || row.pid <= 0 || row.pid === process.pid ||
        normalize(row.executablePath) !== normalize(executable) ||
        !Number.isSafeInteger(row.startedAt) || row.startedAt <= 0 ||
        !/^[1-9]\d{15,19}$/.test(row.startTicks) ||
        typeof row.launchToken !== 'string' || !/^(?:[0-9a-f]{32})?$/.test(row.launchToken) || (requireToken && !row.launchToken) ||
        typeof row.windowHandle !== 'string' || !/^\d+$/.test(row.windowHandle) || typeof row.responding !== 'boolean') {
        throw failure('UNTURNED_PROCESS_IDENTITY_INVALID', 'Unturned süreç kimliği doğrulanamadı.');
    }
    return row;
}

function sameProcess(a, b) {
    return a.pid === b.pid && a.startTicks === b.startTicks && a.launchToken === b.launchToken &&
        normalize(a.executablePath) === normalize(b.executablePath);
}

/**
 * Replace main.js's openExternal stage with this call, then markReady only after
 * it resolves. Owns only the nonce-matched game; the existing bridge remains a
 * normal GameLaunchSession child. Do not wrap this in a shorter session.stage.
 * Steam URL arguments: https://partner.steamgames.com/doc/api/ISteamApps#GetLaunchCommandLine
 * Prefer the nonce when Steam exposes it. Otherwise require an empty preflight,
 * exactly one process at the discovered executable path, created after dispatch.
 * Once captured, PID + start ticks + executable + observed token guard cleanup.
 * Returns process/window evidence, NOT a mod/world/LIVE readiness assertion.
 */
function launchUnturned({ session, openExternal, directory,
    timeoutMs = STARTUP_TIMEOUT_MS, pollIntervalMs = 500, control = null } = {}) {
    if (!session || typeof session.stage !== 'function' || !session.disposers || typeof openExternal !== 'function') {
        throw new TypeError('Unturned requires a GameLaunchSession and openExternal callback.');
    }
    validateDirectory(directory);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 180000 ||
        !Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 1 || pollIntervalMs > 5000) throw new Error('Invalid Unturned wait bounds.');
    if (session.closed) return Promise.reject(session.error || new Error('Unturned başlatma işlemi iptal edildi.'));
    if (launches.has(session)) return launches.get(session);
    const key = normalize(directory);
    if (active.has(key)) return Promise.reject(failure('UNTURNED_ALREADY_OWNED', 'Unturned başka bir launcher oturumunda açık veya başlatılıyor.'));
    const executable = path.win32.join(directory, 'Unturned.exe');
    const native = control || createUnturnedProcessControl({ directory });
    const abort = new AbortController();
    const token = randomBytes(16).toString('hex');
    let identity = null, requestedAt = null, requested = false, monitorTimer = null;
    const assertOpen = () => {
        if (session.closed || abort.signal.aborted) throw session.error || new Error('Unturned başlatma işlemi iptal edildi.');
    };
    const read = async (signal = abort.signal) => {
        const rows = await native.probe({ signal: signal || undefined });
        if (!Array.isArray(rows)) throw failure('UNTURNED_PROCESS_QUERY_FAILED', 'Unturned süreç listesi doğrulanamadı.');
        return rows.map(row => validateIdentity(row, executable, { requireToken: false }));
    };
    const delay = () => new Promise((resolve, reject) => {
        const cancel = () => { clearTimeout(timer); reject(session.error || new Error('Unturned bekleme işlemi iptal edildi.')); };
        const timer = setTimeout(() => { abort.signal.removeEventListener('abort', cancel); resolve(); }, pollIntervalMs);
        abort.signal.addEventListener('abort', cancel, { once: true });
        if (abort.signal.aborted) { abort.signal.removeEventListener('abort', cancel); cancel(); }
    });
    const dispose = async () => {
        abort.abort();
        clearTimeout(monitorTimer);
        try {
            // Discover a nonce-matched process even if the request/window wait
            // failed before a PID was captured. Steam itself is never stopped.
            if (requested) {
                const rows = await read(null);
                const owned = rows.filter(row => identity ? sameProcess(row, identity) : row.launchToken === token && row.startedAt >= requestedAt);
                for (const row of owned) await native.stop(validateIdentity(row, executable, { requireToken: false }));
                if (identity && rows.some(row => (row.pid === identity.pid || row.launchToken === token) && !sameProcess(row, identity))) {
                    throw new Error('Unturned süreç kimliği değişti; mevcut süreç kapatılmadı.');
                }
            }
            delete session.unturnedProcess;
        } finally {
            // The caller's cleanupError blocks replacement in GameLaunchSession;
            // a new session also performs preflight, never trusting this map alone.
            if (active.get(key) === session) active.delete(key);
            launches.delete(session);
        }
    };
    session.disposers.add(dispose);
    active.set(key, session);
    const monitor = async () => {
        try {
            const rows = await read();
            if (session.closed) return;
            if (!rows.some(row => sameProcess(row, identity))) { await session.close(); return; }
            monitorTimer = setTimeout(monitor, Math.max(1000, pollIntervalMs));
            monitorTimer.unref?.();
        } catch (error) { if (!session.closed) await session.close(error); }
    };
    const pending = session.stage('window', 'Gelene Geçene oyun süreci ve penceresi doğrulanıyor...', async () => {
        const before = await read();
        assertOpen();
        if (before.length) throw failure('UNTURNED_ALREADY_RUNNING', 'Unturned zaten açık. Mevcut oyunu kapatıp yeniden deneyin; ikinci kopya açılmadı.');
        requestedAt = Date.now();
        requested = true;
        session.progress('external', 'Steam oyun başlatma isteği gönderiliyor...');
        await openExternal(`steam://run/304930//-tikmng-launch=${token}/`);
        assertOpen();
        session.progress('window', 'Unturned oyun süreci ve gerçek penceresi bekleniyor...');
        while (true) {
            const rows = await read();
            assertOpen();
            const matches = rows.filter(row => (row.launchToken === token || row.launchToken === '') && row.startedAt >= requestedAt);
            if (matches.length > 1 || rows.some(row => !matches.includes(row))) {
                throw failure('UNTURNED_OWNERSHIP_UNVERIFIED', 'Unturned açıldı ancak bu başlatmaya ait tek süreç doğrulanamadı; mevcut süreç sahiplenilmedi.');
            }
            const current = matches[0];
            if (identity && (!current || !sameProcess(identity, current))) {
                throw failure('UNTURNED_EXITED_BEFORE_READY', 'Unturned oyun penceresi hazır olmadan kapandı veya süreç kimliği değişti.');
            }
            if (current) {
                identity = Object.freeze({ ...validateIdentity(current, executable, { requireToken: false }), owned: true,
                    ownership: current.launchToken === token ? 'nonce' : 'path-and-start-time' });
                if (current.windowHandle !== '0' && current.responding) {
                    session.unturnedProcess = identity;
                    monitorTimer = setTimeout(monitor, Math.max(1000, pollIntervalMs));
                    monitorTimer.unref?.();
                    return identity;
                }
            }
            await delay();
        }
    }, timeoutMs);
    launches.set(session, pending);
    return pending;
}

module.exports = { STARTUP_TIMEOUT_MS, createUnturnedProcessControl, launchUnturned };
