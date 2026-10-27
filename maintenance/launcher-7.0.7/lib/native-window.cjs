'use strict';
const { execFile } = require('node:child_process');
const path = require('node:path');

function showNativeWindow(pid, { execute = execFile, platform = process.platform, timeoutMs = 20000 } = {}) {
    if (!Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid) return Promise.reject(new Error('Invalid owned game PID.'));
    if (platform !== 'win32') return Promise.resolve({ visible: true, pid });
    const script = `
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class TikMnGGameWindow {
  public delegate bool WindowCallback(IntPtr window, IntPtr parameter);
  [DllImport("user32.dll")] public static extern bool EnumWindows(WindowCallback callback, IntPtr parameter);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr window, int command);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
}
'@
$gamePid=${pid}
$until=[DateTime]::UtcNow.AddMilliseconds(${Math.max(1000, Math.min(60000, timeoutMs))})
$handle=[IntPtr]::Zero
do {
  $process=Get-Process -Id $gamePid -ErrorAction Stop
  $process.Refresh()
  $handle=$process.MainWindowHandle
  if($handle -ne [IntPtr]::Zero){break}
  Start-Sleep -Milliseconds 150
} while([DateTime]::UtcNow -lt $until)
if($handle -eq [IntPtr]::Zero){throw 'Oyun penceresi olusmadi.'}
[TikMnGGameWindow]::ShowWindowAsync($handle,9) | Out-Null
Start-Sleep -Milliseconds 100
$foreground=[TikMnGGameWindow]::SetForegroundWindow($handle)
$visible=[TikMnGGameWindow]::IsWindowVisible($handle)
if(!$visible){throw 'Oyun penceresi gorunur hale gelmedi.'}
@{visible=$visible;pid=$gamePid;foreground=$foreground} | ConvertTo-Json -Compress
`;
    const executable = path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
    return new Promise((resolve, reject) => execute(executable, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
        { windowsHide: true, timeout: timeoutMs + 10000, maxBuffer: 65536 }, (error, stdout) => {
            if (error) return reject(new Error('Oyun penceresi a\u00e7\u0131lamad\u0131: ' + error.message));
            try {
                const result = JSON.parse(stdout.trim());
                if (result.pid !== pid || result.visible !== true) throw new Error('Invalid game window response.');
                resolve(result);
            } catch (failure) { reject(failure); }
        }));
}
module.exports = { showNativeWindow };
