$ErrorActionPreference = 'Stop'
$Target = 'D:\TikMnG-Test-6.5.17\win-unpacked\TikMnG Test.exe'
$Icon = 'D:\TikMnG-Test-6.5.17\icon-v4.ico'
if (-not (Test-Path -LiteralPath $Target -PathType Leaf)) { throw 'Test launcher paketi bulunamadi.' }
$Desktop = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $Desktop 'TikMnG Yonetici On Izleme.lnk'
$OldShortcutPath = Join-Path $Desktop 'TikMnG Test Launcher.lnk'
if ((Test-Path -LiteralPath $OldShortcutPath) -and -not (Test-Path -LiteralPath $ShortcutPath)) {
    Move-Item -LiteralPath $OldShortcutPath -Destination $ShortcutPath
}
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $Target
$Shortcut.WorkingDirectory = Split-Path -Parent $Target
$Shortcut.IconLocation = if (Test-Path -LiteralPath $Icon) { "$Icon,0" } else { "$Target,0" }
$Shortcut.Description = 'TikMnG - yonetici on izleme; kararli yayindan ayri'
$Shortcut.Save()
Write-Output $ShortcutPath
