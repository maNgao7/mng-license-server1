$ErrorActionPreference = 'Stop'
$Target = 'D:\TikMnG-Test-6.5.17\win-unpacked\TikMnG Test.exe'
if (-not (Test-Path -LiteralPath $Target -PathType Leaf)) { throw 'Test launcher paketi bulunamadi.' }
$Desktop = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $Desktop 'TikMnG Test Launcher.lnk'
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $Target
$Shortcut.WorkingDirectory = Split-Path -Parent $Target
$Shortcut.IconLocation = "$Target,0"
$Shortcut.Description = 'TikMnG 6.5.17 - ayri test surumu'
$Shortcut.Save()
Write-Output $ShortcutPath
