param(
    [string]$Output = 'D:\TikMnG-Minecraft-Oyun-Guncellemesi-7.0.3',
    [string]$Version = '7.0.3',
    [string]$ReleaseTag = 'minecraft-rounds-20261027'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$apps = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$outputRoot = [IO.Path]::GetFullPath($Output)
if (Test-Path -LiteralPath $outputRoot) { throw "Output already exists: $outputRoot" }
[IO.Directory]::CreateDirectory($outputRoot) | Out-Null
$assets = Join-Path $outputRoot 'assets'
[IO.Directory]::CreateDirectory($assets) | Out-Null
$publicBase = "https://github.com/maNgao7/mng-license-server1/releases/download/$ReleaseTag/"
$catalog = Get-Content 'D:\TikMnG-Release-7.0.0-source\content-defaults.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$before = $catalog | ConvertTo-Json -Depth 100 -Compress
$report = @()

foreach ($game in @('snow-war', 'battle-royale')) {
    $modName = if ($game -eq 'snow-war') { 'mng_snow_war' } else { 'mng_battle_royale' }
    $jar = Join-Path $apps "$game\mod\build\libs\$modName-1.0.0.jar"
    $oldZip = "D:\TikMnG-Release-7.0.2-installers\$game-7.0.2.zip"
    $entry = $catalog.games | Where-Object id -EQ $game
    if ((Get-FileHash -LiteralPath $oldZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) {
        throw "Baseline ZIP does not match published catalog: $game"
    }
    $manifest = Get-Content "D:\TikMnG-Release-7.0.2-games\game-content-$game-7.0.2.json" -Raw -Encoding UTF8 | ConvertFrom-Json
    $matches = @($manifest.files | Where-Object { $_.path -match "^game-instance/mods/mng.*\.jar$" })
    if ($matches.Count -ne 1) { throw "Expected exactly one game mod in manifest: $game" }
    $mod = $matches[0]
    $oldHash = $mod.sha256
    $hash = (Get-FileHash -LiteralPath $jar -Algorithm SHA256).Hash.ToLowerInvariant()
    $mod.sha256 = $hash
    $mod.bytes = (Get-Item -LiteralPath $jar).Length
    $mod.url = "$publicBase$hash.bin"
    Copy-Item -LiteralPath $jar -Destination (Join-Path $assets "$hash.bin")
    $manifest.version = $Version
    $manifestName = "game-content-$game-$Version.json"
    $manifestPath = Join-Path $assets $manifestName
    [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 100 -Compress), [Text.UTF8Encoding]::new($false))

    $newZip = Join-Path $assets "$game-$Version.zip"
    Copy-Item -LiteralPath $oldZip -Destination $newZip
    $zip = [IO.Compression.ZipFile]::Open($newZip, [IO.Compression.ZipArchiveMode]::Update)
    try {
        $old = $zip.GetEntry($mod.path)
        if (-not $old) { throw "Game mod missing from baseline archive: $game" }
        $old.Delete()
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $jar, $mod.path,
            [IO.Compression.CompressionLevel]::Optimal) | Out-Null
        $marker = $zip.GetEntry('.tikmng-package.json')
        if (-not $marker) { throw "Package marker missing: $game" }
        $reader = [IO.StreamReader]::new($marker.Open())
        try { $markerData = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
        $markerData.version = $Version
        $marker.Delete()
        $replacement = $zip.CreateEntry('.tikmng-package.json')
        $writer = [IO.StreamWriter]::new($replacement.Open(), [Text.UTF8Encoding]::new($false))
        try { $writer.Write(($markerData | ConvertTo-Json -Compress)) } finally { $writer.Dispose() }
    } finally { $zip.Dispose() }
    $entry.version = $Version
    $entry.url = "$publicBase$game-$Version.zip"
    $entry.sha256 = (Get-FileHash -LiteralPath $newZip -Algorithm SHA256).Hash.ToLowerInvariant()
    $entry.bytes = (Get-Item -LiteralPath $newZip).Length
    $entry.files[0].url = "$publicBase$manifestName"
    $entry.files[0].sha256 = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $entry.files[0].bytes = (Get-Item -LiteralPath $manifestPath).Length
    $report += [ordered]@{
        game = $game; version = $Version; previousModSha256 = $oldHash; modSha256 = $hash
        updateBytes = $mod.bytes; archiveBytes = $entry.bytes; manifestBytes = $entry.files[0].bytes
        archiveSha256 = $entry.sha256; manifestSha256 = $entry.files[0].sha256
        changedContentFiles = 1
    }
}
$previous = $before | ConvertFrom-Json
$unrelatedBefore = @($previous.games | Where-Object id -NotIn @('snow-war', 'battle-royale')) | ConvertTo-Json -Depth 100 -Compress
$unrelatedAfter = @($catalog.games | Where-Object id -NotIn @('snow-war', 'battle-royale')) | ConvertTo-Json -Depth 100 -Compress
if ($unrelatedBefore -cne $unrelatedAfter) { throw 'Unrelated game metadata changed' }
if (($previous.launcher | ConvertTo-Json -Compress) -cne ($catalog.launcher | ConvertTo-Json -Compress)) { throw 'Launcher metadata changed' }
$catalog.revision++
$catalog.publishedAt = [DateTime]::UtcNow.ToString('o')
[IO.File]::WriteAllText((Join-Path $outputRoot 'catalog-candidate.json'), ($catalog | ConvertTo-Json -Depth 100), [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $outputRoot 'package-report.json'), ($report | ConvertTo-Json -Depth 100), [Text.UTF8Encoding]::new($false))
Write-Output ($report | ConvertTo-Json -Depth 100)
Write-Output 'Prepared only. Not published; launcher and installed game settings were not changed.'
