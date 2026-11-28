param([switch]$NoShortcut)
$ErrorActionPreference = 'Stop'
$boxRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
& node (Join-Path $PSScriptRoot 'build-ringside.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Ringside renderer could not be built' }
& node (Join-Path $PSScriptRoot 'build-ring-mat.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Ring artwork could not be prepared' }
& 'C:/Python314/python.exe' (Join-Path $PSScriptRoot 'prepare-spectator.py')
if ($LASTEXITCODE -ne 0) { throw 'Spectator game configuration failed' }
& 'C:/Python314/python.exe' (Join-Path $PSScriptRoot 'prepare-native-bells.py') --apply
if ($LASTEXITCODE -ne 0) { throw 'Native automatic bell preparation failed' }
$boxDesktopApp = [System.IO.Path]::GetFullPath('D:/TikMnG/Hediye-Box-Private/desktop-app')
$boxAllowedRoot = [System.IO.Path]::GetFullPath('D:/TikMnG/Hediye-Box-Private') + [System.IO.Path]::DirectorySeparatorChar
if (-not $boxDesktopApp.StartsWith($boxAllowedRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected desktop destination' }
$boxElectron = [System.IO.Path]::GetFullPath((Join-Path $boxRoot '../../frog-river/node_modules/electron/dist'))
if (-not (Test-Path -LiteralPath (Join-Path $boxElectron 'electron.exe'))) { throw 'Installed Electron runtime missing' }
foreach ($boxRequired in @('main.cjs','preload.cjs','desktop/index.html','desktop/style.css','desktop/renderer.js','assets/loading-ring-v2.png','native-hud/index.html','src/native-hud.cjs','src/hud-pixel-writer.cjs','assets/native-hud/native-hud.json','assets/native-hud/tikmng-native-hud.dll')) {
    if (-not (Test-Path -LiteralPath (Join-Path $boxRoot $boxRequired))) { throw "Missing app file: $boxRequired" }
}
New-Item -ItemType Directory -Path $boxDesktopApp -Force | Out-Null
foreach ($boxItem in Get-ChildItem -LiteralPath $boxElectron -Force) {
    if ($boxItem.Name -eq 'electron.exe') {
        Copy-Item -LiteralPath $boxItem.FullName -Destination (Join-Path $boxDesktopApp 'HediyeBox.exe') -Force
    } else { Copy-Item -LiteralPath $boxItem.FullName -Destination $boxDesktopApp -Recurse -Force }
}
$boxAppSource = Join-Path $boxDesktopApp 'resources/app'
New-Item -ItemType Directory -Path $boxAppSource -Force | Out-Null
foreach ($boxName in @('main.cjs','preload.cjs','package.json','src','desktop','spectator','broadcast','native-hud','assets')) {
    Copy-Item -LiteralPath (Join-Path $boxRoot $boxName) -Destination $boxAppSource -Recurse -Force
}
New-Item -ItemType Directory -Path (Join-Path $boxAppSource 'tools') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $boxRoot 'tools/focus-game.ps1') -Destination (Join-Path $boxAppSource 'tools') -Force
foreach ($boxTool in @('spectator-worker.py','spectator-native.js','native-camera.js','spectator-camera.js','game-volume.ps1')) {
    Copy-Item -LiteralPath (Join-Path $boxRoot "tools/$boxTool") -Destination (Join-Path $boxAppSource 'tools') -Force
}
$boxProbeRuntime = Join-Path $boxRoot '../../tools/hediye-box-probe-runtime/frida'
$boxProbeTarget = Join-Path $boxAppSource 'runtime/probe-runtime'
New-Item -ItemType Directory -Path $boxProbeTarget -Force | Out-Null
Copy-Item -LiteralPath $boxProbeRuntime -Destination $boxProbeTarget -Recurse -Force
$boxSharedSource = 'D:/TikMnG/Animal-Times-Live/bridge'
$boxSharedTarget = Join-Path $boxAppSource 'runtime/shared'
New-Item -ItemType Directory -Path (Join-Path $boxSharedTarget 'vendor'),(Join-Path $boxSharedTarget 'lib'),(Join-Path $boxSharedTarget 'runtime') -Force | Out-Null
foreach ($boxName in @('live-session.cjs','pk-profiles.cjs','portrait-engine.cjs')) {
    Copy-Item -LiteralPath (Join-Path $boxSharedSource "vendor/$boxName") -Destination (Join-Path $boxSharedTarget 'vendor') -Force
}
Copy-Item -LiteralPath (Join-Path $boxSharedSource 'lib/owner.cjs') -Destination (Join-Path $boxSharedTarget 'lib') -Force
Copy-Item -LiteralPath (Join-Path $boxSharedSource 'runtime/node_modules') -Destination (Join-Path $boxSharedTarget 'runtime') -Recurse -Force
$boxLicenseSource = Join-Path $boxSharedSource 'runtime/NODE-LICENSE.txt'
if (Test-Path -LiteralPath $boxLicenseSource) { Copy-Item -LiteralPath $boxLicenseSource -Destination $boxSharedTarget -Force }
$boxManifest = [ordered]@{schemaVersion=1;appVersion=(Get-Content -LiteralPath (Join-Path $boxRoot 'package.json') -Raw | ConvertFrom-Json).version;mode='private-spectator-preview';nativeGame='Online Boxing 3D Demo';liveGiftVerification='pending';publicReleaseReady=$false;gamePath='D:/TikMnG/Hediye-Box-Private/native-game/boxing.exe';sdk='tiktok-live-connector 2.4.4';launchMode='sparring_cpu_vs_cpu';python='C:/Python314/python.exe'}
if (& (Join-Path $boxRoot 'tests/verify-live-ring.ps1') -AppRoot $boxAppSource) {
    $boxManifest.liveGiftVerification = 'verified-in-private-ring'
}
$boxManifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $boxDesktopApp 'preview-manifest.json') -Encoding utf8
if (-not $NoShortcut) {
    $boxDesktopPath = [Environment]::GetFolderPath('Desktop')
    $boxShell = New-Object -ComObject WScript.Shell
    $boxLink = $boxShell.CreateShortcut((Join-Path $boxDesktopPath 'TikMnG - Hediye Box.lnk'))
    $boxLink.TargetPath = Join-Path $boxDesktopApp 'HediyeBox.exe'
    $boxLink.WorkingDirectory = $boxDesktopApp
    $boxLink.IconLocation = Join-Path $boxAppSource 'assets/tikmng.ico'
    $boxLink.Description = 'TikMnG Hediye Box ringini aç.'
    $boxLink.Save()
}
Write-Output (Join-Path $boxDesktopApp 'HediyeBox.exe')
