param([Parameter(Mandatory=$true)][int]$GameProcessId)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class HediyeBoxWindow {
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string className, string title);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr handle);
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr handle, int command);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr handle);
    public static IntPtr FindRing(uint processId) {
        IntPtr handle = IntPtr.Zero;
        while ((handle = FindWindowEx(IntPtr.Zero, handle, null, "Online Boxing 3D")) != IntPtr.Zero) {
            uint owner;
            GetWindowThreadProcessId(handle, out owner);
            if (owner == processId) return handle;
        }
        return IntPtr.Zero;
    }
}
'@
for ($boxAttempt=0; $boxAttempt -lt 80; $boxAttempt++) {
    $boxGameProcess = Get-Process -Id $GameProcessId -ErrorAction Stop
    if ($boxGameProcess.ProcessName -ne 'boxing') { throw 'Unexpected game process' }
    $ringWindow = [HediyeBoxWindow]::FindRing($GameProcessId)
    if ($ringWindow -ne [IntPtr]::Zero) {
        # SW_RESTORE also unmaximizes a visible window to its previous rectangle.
        if ([HediyeBoxWindow]::IsIconic($ringWindow)) {
            [HediyeBoxWindow]::ShowWindowAsync($ringWindow, 9) | Out-Null
        }
        [HediyeBoxWindow]::SetForegroundWindow($ringWindow) | Out-Null
        exit 0
    }
    Start-Sleep -Milliseconds 100
}
throw 'Oyun penceresi zamanında açılmadı.'
