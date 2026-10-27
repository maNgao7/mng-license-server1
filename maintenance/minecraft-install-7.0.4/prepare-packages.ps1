param([string]$Output = 'D:\TikMnG-Minecraft-Kurulum-Duzeltmesi-7.0.4')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$baseline = 'D:\TikMnG-Minecraft-Oyun-Guncellemesi-7.0.3\assets'
$repository = 'D:\TikMnG-Release-7.0.0-source'
$version = '7.0.4'
$publicBase = 'https://github.com/maNgao7/mng-license-server1/releases/download/minecraft-install-20261027/'
if (Test-Path -LiteralPath $Output) { throw "Output already exists: $Output" }
$assets = Join-Path $Output 'assets'
[IO.Directory]::CreateDirectory($assets) | Out-Null
$catalog = Get-Content -LiteralPath (Join-Path $repository 'content-defaults.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$before = $catalog | ConvertTo-Json -Depth 100 -Compress
$report = @()
foreach ($game in @('snow-war', 'battle-royale')) {
    $entry = $catalog.games | Where-Object id -EQ $game
    if ($entry.version -ne '7.0.3') { throw "Unexpected published baseline: $game" }
    $oldZip = Join-Path $baseline "$game-7.0.3.zip"
    if ((Get-FileHash -LiteralPath $oldZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw "Archive baseline hash mismatch: $game" }
    $manifest = Get-Content -LiteralPath (Join-Path $baseline "game-content-$game-7.0.3.json") -Raw -Encoding UTF8 | ConvertFrom-Json
    $temporary = @($manifest.files | Where-Object { $_.path -match '^runtime/natives/jna[0-9]+\.dll\.x$' })
    if ($temporary.Count -ne 1 -or $temporary[0].bytes -ne 0) { throw "Unexpected transient file set: $game" }
    $manifest.files = @($manifest.files | Where-Object { $_.path -notmatch '^runtime/natives/jna[0-9]+\.dll\.x$' })
    $manifest.version = $version
    $manifestName = "game-content-$game-$version.json"
    $manifestPath = Join-Path $assets $manifestName
    [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 100 -Compress), [Text.UTF8Encoding]::new($false))
    $archive = Join-Path $assets "$game-$version.zip"
    Copy-Item -LiteralPath $oldZip -Destination $archive
    $zip = [IO.Compression.ZipFile]::Open($archive, [IO.Compression.ZipArchiveMode]::Update)
    try {
        foreach ($file in $temporary) {
            $item = $zip.GetEntry($file.path)
            if (-not $item -or $item.Length -ne 0) { throw "Transient archive entry mismatch: $game" }
            $item.Delete()
        }
        $marker = $zip.GetEntry('.tikmng-package.json')
        if (-not $marker) { throw "Missing package marker: $game" }
        $reader = [IO.StreamReader]::new($marker.Open())
        try { $value = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
        $value.version = $version
        $marker.Delete()
        $replacement = $zip.CreateEntry('.tikmng-package.json')
        $writer = [IO.StreamWriter]::new($replacement.Open(), [Text.UTF8Encoding]::new($false))
        try { $writer.Write(($value | ConvertTo-Json -Compress)) } finally { $writer.Dispose() }
    } finally { $zip.Dispose() }
    $entry.version = $version
    $entry.url = "$publicBase$game-$version.zip"
    $entry.bytes = (Get-Item -LiteralPath $archive).Length
    $entry.sha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    $entry.files[0].url = "$publicBase$manifestName"
    $entry.files[0].bytes = (Get-Item -LiteralPath $manifestPath).Length
    $entry.files[0].sha256 = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $report += [ordered]@{ game = $game; version = $version; removedTemporaryPath = $temporary[0].path;
        contentFiles = $manifest.files.Count; archiveBytes = $entry.bytes; archiveSha256 = $entry.sha256; gameplayBytesChanged = $false }
}
$previous = $before | ConvertFrom-Json
if ((@($previous.games | Where-Object id -NotIn @('snow-war', 'battle-royale')) | ConvertTo-Json -Depth 100 -Compress) -cne
    (@($catalog.games | Where-Object id -NotIn @('snow-war', 'battle-royale')) | ConvertTo-Json -Depth 100 -Compress)) { throw 'Unrelated game records changed' }
$catalog.revision++
$catalog.publishedAt = [DateTime]::UtcNow.ToString('o')
[IO.File]::WriteAllText((Join-Path $Output 'catalog-candidate.json'), ($catalog | ConvertTo-Json -Depth 100), [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $Output 'package-report.json'), ($report | ConvertTo-Json -Depth 100), [Text.UTF8Encoding]::new($false))
Write-Output ($report | ConvertTo-Json -Depth 100)
Write-Output 'Prepared only. Full strict ZIP verification and fresh launcher installs are required before publication.'
