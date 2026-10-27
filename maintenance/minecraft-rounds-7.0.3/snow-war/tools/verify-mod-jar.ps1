param([string]$JarPath)

$ErrorActionPreference = 'Stop'
$appRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $JarPath) { $JarPath = Join-Path $appRoot 'mod\build\libs\mng_snow_war-1.0.0.jar' }
$sourceRoot = Join-Path $appRoot 'mod\src\main\resources'
$catalogPath = 'assets/mng_snow_war/gifts/katalog_tam.json'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead([IO.Path]::GetFullPath($JarPath))
try {
    $catalogEntry = $archive.GetEntry($catalogPath)
    if ($null -eq $catalogEntry) { throw 'Missing packaged gift catalog' }
    $reader = [IO.StreamReader]::new($catalogEntry.Open())
    try { $catalog = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
    $sourceCatalog = Get-Content -LiteralPath (Join-Path $sourceRoot $catalogPath) -Raw | ConvertFrom-Json
    $expected = @($sourceCatalog).Count
    if (@($catalog).Count -ne $expected) { throw ('Expected ' + $expected + ' catalog entries, found ' + @($catalog).Count) }

    $sourceCatalogHash = (Get-FileHash -LiteralPath (Join-Path $sourceRoot $catalogPath) -Algorithm SHA256).Hash
    $catalogStream = $catalogEntry.Open()
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $packagedCatalogHash = [BitConverter]::ToString($sha.ComputeHash($catalogStream)).Replace('-', '') }
    finally { $catalogStream.Dispose(); $sha.Dispose() }
    if ($sourceCatalogHash -ne $packagedCatalogHash) { throw 'Packaged catalog differs from source' }

    $sourcePngs = @(Get-ChildItem -LiteralPath $sourceRoot -Recurse -File -Filter '*.png' |
        ForEach-Object { $_.FullName.Substring($sourceRoot.Length + 1).Replace('\', '/') } | Sort-Object)
    $packagedPngs = @($archive.Entries | Where-Object { $_.FullName.EndsWith('.png') } |
        ForEach-Object { $_.FullName } | Sort-Object)
    $differences = @(Compare-Object -ReferenceObject $sourcePngs -DifferenceObject $packagedPngs)
    if ($differences.Count -gt 0) {
        $differences | Format-Table | Out-String | Write-Output
        throw 'Packaged PNG names differ from source; obsolete or missing images found'
    }
    $giftPngs = @($packagedPngs | Where-Object { $_ -match '^assets/mng_snow_war/gifts/[^/]+\.png$' })
    if ($giftPngs.Count -ne $expected) { throw ('Expected ' + $expected + ' gift PNGs, found ' + $giftPngs.Count) }
    Write-Output ('Verified catalog=' + $expected + ', gift PNGs=' + $giftPngs.Count + ', all PNG paths=' + $packagedPngs.Count + ', obsolete PNGs=0')
} finally {
    $archive.Dispose()
}
Get-FileHash -LiteralPath $JarPath -Algorithm SHA256 | Format-List Path,Hash
