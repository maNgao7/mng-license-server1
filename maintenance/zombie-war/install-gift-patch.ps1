param(
    [Parameter(Mandatory=$true)][string]$GameRoot,
    [Parameter(Mandatory=$true)][string]$VerifiedPatchDirectory
)
$ErrorActionPreference = 'Stop'
$game = (Resolve-Path -LiteralPath $GameRoot).Path
$patch = (Resolve-Path -LiteralPath $VerifiedPatchDirectory).Path
$verification = Get-Content -LiteralPath (Join-Path $patch 'verification.json') -Raw | ConvertFrom-Json
$mod = Join-Path $game 'game-instance/mods/mng-zombie-strike-1.0.0.jar'
$candidate = Join-Path $patch 'mng-zombie-strike-1.0.0.jar'
if ((Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash.ToLower() -ne $verification.jarSha256) { throw 'Verified patch hash changed.' }
if ((Get-FileHash -LiteralPath $mod -Algorithm SHA256).Hash.ToLower() -ne $verification.sourceSha256) { throw 'Installed mod differs; rebuild against this exact version first.' }
$java = Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^javaw?\.exe$' -and $_.CommandLine -like "*$game*" }
if ($java) { throw 'Close Zombie War before updating its files.' }
$backup = Join-Path $game ('local-patch-backups/gifts-v11-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $backup) { throw 'Backup directory already exists.' }
New-Item -ItemType Directory -Path $backup | Out-Null
Copy-Item -LiteralPath $mod -Destination (Join-Path $backup 'mng-zombie-strike-1.0.0.jar')
$config = Join-Path $game 'game-instance/config/mng-zombie-strike.json'
if (Test-Path -LiteralPath $config) { Copy-Item -LiteralPath $config -Destination (Join-Path $backup 'mng-zombie-strike.json') }
$pending = "$mod.gifts-v11.tmp"
if (Test-Path -LiteralPath $pending) { throw 'A pending update already exists.' }
Copy-Item -LiteralPath $candidate -Destination $pending
[IO.File]::Move($pending, $mod, $true)
Write-Output 'Zombie War gift defaults and downloadable PNG installed. Previous mod and settings backed up.'
