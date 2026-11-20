'use strict';
const { execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { assertSafePath } = require('./download.cjs');

async function forceMinecraftWindowed(directory) {
    const file = assertSafePath(path.join(directory, 'game-instance', 'options.txt'));
    let original;
    try { original = await fs.readFile(file, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    const windowed = original.replace(/^fullscreen:true(?=\r?$)/gm, 'fullscreen:false');
    if (windowed === original) return;
    const temporary = file + '.' + randomUUID() + '.tmp';
    try {
        await fs.writeFile(temporary, windowed, { flag: 'wx' });
        await fs.rename(temporary, file);
    } finally { await fs.rm(temporary, { force: true }); }
}

function showNativeWindow(pid, { execute = execFile, platform = process.platform, timeoutMs = 20000,
    maximize = false, restoreFrame = maximize, javaChild = false } = {}) {
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
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr window);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr window);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr window, int command);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll", EntryPoint="GetWindowLongW")] static extern int GetWindowLong(IntPtr window, int index);
  [DllImport("user32.dll", EntryPoint="SetWindowLongW")] static extern int SetWindowLong(IntPtr window, int index, int value);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
  public static void RestoreFrame(IntPtr window) {
    int style = GetWindowLong(window, -16);
    int framed = (style & Int32.MaxValue) | 0x00CF0000;
    if (style != framed) {
      SetWindowLong(window, -16, framed);
      SetWindowPos(window, IntPtr.Zero, 0, 0, 0, 0, 0x37);
    }
  }
}
'@
$gamePid=${pid}
$until=[DateTime]::UtcNow.AddMilliseconds(${Math.max(1000, Math.min(60000, timeoutMs))})
$handle=[IntPtr]::Zero
do {
  $process=Get-Process -Id $gamePid -ErrorAction Stop
  ${javaChild ? `$java=Get-CimInstance -ClassName Win32_Process -Filter ("ParentProcessId={0} AND (Name='java.exe' OR Name='javaw.exe')" -f $gamePid)
  foreach($item in $java){
    $native=Get-Process -Id $item.ProcessId -ErrorAction SilentlyContinue
    if($native -and $native.MainWindowHandle -ne [IntPtr]::Zero){$handle=$native.MainWindowHandle;$windowPid=$native.Id;break}
  }` : '$process.Refresh(); $handle=$process.MainWindowHandle; $windowPid=$gamePid'}
  if($handle -ne [IntPtr]::Zero){break}
  Start-Sleep -Milliseconds 150
} while([DateTime]::UtcNow -lt $until)
if($handle -eq [IntPtr]::Zero){throw 'Oyun penceresi olusmadi.'}
${restoreFrame ? '[TikMnGGameWindow]::RestoreFrame($handle)' : ''}
$showCommand=${maximize ? '3' : '$(if([TikMnGGameWindow]::IsIconic($handle)){9}else{5})'}
[TikMnGGameWindow]::ShowWindowAsync($handle,$showCommand) | Out-Null
Start-Sleep -Milliseconds 100
$foreground=[TikMnGGameWindow]::SetForegroundWindow($handle)
$visible=[TikMnGGameWindow]::IsWindowVisible($handle)
if(!$visible){throw 'Oyun penceresi gorunur hale gelmedi.'}
@{visible=$visible;pid=$gamePid;windowPid=$windowPid;foreground=$foreground;maximized=[TikMnGGameWindow]::IsZoomed($handle)} | ConvertTo-Json -Compress
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
module.exports = { showNativeWindow, forceMinecraftWindowed };
