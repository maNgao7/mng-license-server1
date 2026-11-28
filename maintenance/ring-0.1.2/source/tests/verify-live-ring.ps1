param([Parameter(Mandatory=$true)][string]$AppRoot)
$recordPath = Join-Path $PSScriptRoot '../qa/live-ring-check.json'
if (-not (Test-Path -LiteralPath $recordPath)) { return $false }
$record = Get-Content -Raw -LiteralPath $recordPath | ConvertFrom-Json
$version = (Get-Content -Raw -LiteralPath (Join-Path $AppRoot 'package.json') | ConvertFrom-Json).version
if ($record.schemaVersion -ne 2 -or $record.appVersion -ne $version -or $record.locallySeated -ne 0 -or
    $record.visibleHealthBars -ne 2 -or $record.connected -ne $true -or
    $record.displayedPortraits -ne 2 -or $record.matchingLiveGiftPackets -lt 1 -or
    $record.nativeHealthDecreased -ne $true) { return $false }
$files = @('main.cjs','preload.cjs','src/runtime-paths.cjs','assets/loading-ring-gold-v1.png','src/channel-field.js','src/win-standings.cjs','assets/audio/ring-contact.wav','src/audience-queue.cjs','src/live-client.cjs','src/gift-normalizer.cjs',
    'src/native-spectator.cjs','tools/spectator-worker.py','tools/spectator-native.js','tools/spectator-camera.js',
    'tools/native-camera.js','spectator/renderer.js','spectator/index.html','spectator/style.css','spectator/ringside.bundle.js',
    'src/game-options.cjs','src/desktop-controller.cjs','src/spectator-session.cjs','tools/game-volume.ps1','spectator/game-audio.js',
    'assets/corner-colors/VkLayer_TikMnG_corner_colors.json','assets/corner-colors/tikmng-corner-colors.dll',
    'src/native-hud.cjs','src/hud-pixel-writer.cjs','native-hud/index.html','native-hud/style.css','native-hud/preload.cjs','native-hud/renderer.js','broadcast/hud-bridge.js',
    'assets/native-hud/native-hud.json','assets/native-hud/tikmng-native-hud.dll',
    'src/queue-target.cjs','assets/queue-layout.js','src/widget-publisher.cjs','src/widgets/snapshot.cjs','src/widgets/portraits.cjs','src/widgets/overlay-bridge.cjs','src/widgets/view.html')
foreach ($file in $files) {
    $installedPath = Join-Path $AppRoot $file
    if (-not (Test-Path -LiteralPath $installedPath -PathType Leaf)) { return $false }
    if ($record.files.$file -ne (Get-FileHash -LiteralPath $installedPath).Hash) { return $false }
}
return $true
