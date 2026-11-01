[CmdletBinding()]
param(
    [string]$PackRoot = 'D:\TikMnG-Chatterbox-v3-ready',
    [string]$Destination = 'D:\TikMnG-Chatterbox-assets-v1'
)
$ErrorActionPreference = 'Stop'
$pack = (Resolve-Path -LiteralPath $PackRoot).Path
$target = [IO.Path]::GetFullPath($Destination)
$parent = Split-Path -Parent $target
if ([IO.Path]::GetPathRoot($target) -ne 'D:\' -or $target -eq 'D:\' -or (Test-Path -LiteralPath $target) -or -not (Test-Path -LiteralPath $parent)) {
    throw 'Assets require a new named destination on D:. Existing artifacts are never overwritten.'
}
$staging = Join-Path $parent ((Split-Path -Leaf $target) + '.staging-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging | Out-Null
$seven = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\node_modules\7zip-bin\win\x64\7za.exe'))
if (-not (Test-Path -LiteralPath $seven)) { throw 'Bundled 7-Zip is missing.' }
$pin = 'bbe50d9d515bee7f0cc4d78f8352c55efce20f16c1137b33e994b7884edc8dc6'
if ((Get-FileHash -LiteralPath (Join-Path $pack 'runtime-manifest.json') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $pin) { throw 'Prepared runtime manifest does not match the trusted pin.' }
$model = Get-Content -LiteralPath (Join-Path $pack 'model-v3\tikmng-model-manifest.json') -Raw | ConvertFrom-Json
$refs = Get-Content -LiteralPath (Join-Path $pack 'references\manifest.json') -Raw | ConvertFrom-Json
if ($refs.voices.Count -ne 10) { throw 'Exactly ten references are required.' }

Push-Location -LiteralPath $pack
try {
    Write-Output 'Compressing runtime and retained third-party license notices...'
    $runtime = Join-Path $staging 'tikmng-chatterbox-runtime-win-x64-v1.zip'
    & $seven a -tzip $runtime 'runtime' 'runtime-manifest.json' 'licenses' -mx=5 -mmt=4 -mtc=off -bsp0 -bso0 -bse1
    if ($LASTEXITCODE -ne 0) { throw 'Runtime archive creation failed.' }
    Write-Output 'Compressing ten reference clips and their attribution manifest...'
    $references = Join-Path $staging 'tikmng-chatterbox-references-tr-v1.zip'
    & $seven a -tzip $references 'references' -mx=5 -mmt=2 -mtc=off -bsp0 -bso0 -bse1
    if ($LASTEXITCODE -ne 0) { throw 'Reference archive creation failed.' }
    foreach ($zip in @($runtime, $references)) {
        if ((Get-Item -LiteralPath $zip).Length -ge 2147483648) { throw 'Archive exceeds the individual GitHub asset limit.' }
        & $seven t $zip -bsp0 -bso0 -bse1
        if ($LASTEXITCODE -ne 0) { throw 'Archive CRC verification failed.' }
    }
    $release = 'https://github.com/maNgao7/mng-license-server1/releases/download/voice-pack-chatterbox-tr-v1/'
    $assets = foreach ($zip in @($runtime, $references)) {
        $file = Get-Item -LiteralPath $zip
        [ordered]@{ name = $file.Name; bytes = $file.Length; sha256 = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant(); url = $release + $file.Name }
    }
    $metadata = [ordered]@{
        schemaVersion = 1
        id = 'chatterbox-tr-v1'
        version = '1.0.0'
        releaseTag = 'voice-pack-chatterbox-tr-v1'
        runtimeManifestSha256 = $pin
        referencesManifestSha256 = (Get-FileHash -LiteralPath (Join-Path $pack 'references\manifest.json') -Algorithm SHA256).Hash.ToLowerInvariant()
        model = $model
        archives = @($assets)
        networkBytes = [long](($assets | Measure-Object -Property bytes -Sum).Sum) + [long](($model.files | Measure-Object -Property bytes -Sum).Sum)
        published = $false
    }
    [IO.File]::WriteAllText((Join-Path $staging 'chatterbox-assets.json'), ($metadata | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
    if ([IO.Path]::GetFullPath($staging).StartsWith($parent.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -ne $true -or (Test-Path -LiteralPath $target)) { throw 'Unsafe final move.' }
    Move-Item -LiteralPath $staging -Destination $target
    Write-Output ('ASSET_ROOT=' + $target)
    Write-Output ($assets | ConvertTo-Json -Depth 3)
} finally { Pop-Location }
