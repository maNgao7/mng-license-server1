$ErrorActionPreference = 'Stop'
$root = 'C:\Users\User\AppData\Roaming\mng-tiktok-game\games\.game-library'
$destination = 'D:\TikMnG-Update-QA-20261030\retained-download-cache'
$entries = @(
    'zombie-war\downloads\56816d7c4bd65108ae5f0a11dc076d5c66117dec55472e72a097ac3be570412e.zip',
    'minecraft-snake-arena\downloads\fe0fcf3819f47c52f011c74e8b5f85d6915db53401a516fae7455621df64cd91.zip',
    'mng-orbit\downloads\711317ce889af48488d3619bedcf06a3785302ba957c41e0f6353a4651cdfe8b.zip'
)
function Assert-Unlinked([string]$file) {
    $current = [IO.Path]::GetFullPath($file)
    while ($current) {
        if (Test-Path -LiteralPath $current) {
            if ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked path: $current" }
        }
        $parent = [IO.Directory]::GetParent($current)
        $current = if ($null -ne $parent) { $parent.FullName } else { $null }
    }
}
Assert-Unlinked $root
Assert-Unlinked $destination
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$results = @()
foreach ($relative in $entries) {
    $source = [IO.Path]::GetFullPath((Join-Path $root $relative))
    if (-not $source.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase) -or $source -notmatch '\\downloads\\[a-f0-9]{64}\.zip$') { throw 'Unexpected source path' }
    if (-not (Test-Path -LiteralPath $source)) { continue }
    Assert-Unlinked $source
    $handle = [IO.File]::Open($source, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None)
    $handle.Dispose()
    $hash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    $bytes = (Get-Item -LiteralPath $source).Length
    $target = [IO.Path]::GetFullPath((Join-Path $destination ($hash.ToLowerInvariant() + '.zip')))
    if (-not $target.StartsWith($destination + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected target path' }
    Assert-Unlinked $target
    if (-not (Test-Path -LiteralPath $target)) { Copy-Item -LiteralPath $source -Destination $target }
    if ((Get-Item -LiteralPath $target).Length -ne $bytes -or (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $hash) { throw 'Retained cache copy failed verification' }
    if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $hash) { throw 'Source changed during verification' }
    # Remove only the verified duplicate download, never a version or user-data tree.
    Remove-Item -LiteralPath $source
    $results += [pscustomobject]@{ Source = $source; Retained = $target; Bytes = $bytes; SHA256 = $hash }
}
$report = Join-Path $PSScriptRoot '..\qa\20261030\c-cache-relocation.json'
$results | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $report -Encoding utf8
$results | Select-Object Source, Bytes
Get-PSDrive -Name C,D | Select-Object Name,Free
