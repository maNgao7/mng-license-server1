param(
    [Parameter(Mandatory=$true)][string]$OriginalArchive,
    [Parameter(Mandatory=$true)][string]$VerifiedPatchDirectory,
    [Parameter(Mandatory=$true)][string]$OutputArchive
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$original = (Resolve-Path -LiteralPath $OriginalArchive).Path
$patch = (Resolve-Path -LiteralPath $VerifiedPatchDirectory).Path
$output = [IO.Path]::GetFullPath($OutputArchive)
if (Test-Path -LiteralPath $output) { throw 'Output already exists; do not overwrite a released package.' }
$verify = Get-Content -LiteralPath (Join-Path $patch 'verification.json') -Raw | ConvertFrom-Json
$mod = Join-Path $patch 'mng-zombie-strike-1.0.0.jar'
if ((Get-FileHash -LiteralPath $mod -Algorithm SHA256).Hash.ToLower() -ne $verify.jarSha256) { throw 'Patch verification failed.' }
$standard = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'standard-gifts.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$rules = [ordered]@{
    like=@{action='ZOMBIE';amount=5;threshold=100;target='zombie'};
    follow=@{action='ZOMBIE';amount=5;threshold=1;target='zombie'}
}
foreach ($gift in $standard.gifts) {
    $rules["gift:$($gift.id)"] = @{action=$gift.action;amount=$gift.amount;threshold=$gift.threshold;target=$gift.target}
}
$settings = [ordered]@{
    username='';initialWeapon='tabanca';selectedMap='dust2';maxHealth=60;zombieLimit=1000;
    settingsVersion=11;standardRulesInstalled=$true;rules=$rules
}
New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($output)) -Force | Out-Null
$temporary = "$output.tmp"
if (Test-Path -LiteralPath $temporary) { throw 'Temporary package already exists.' }
Copy-Item -LiteralPath $original -Destination $temporary
function ReplaceEntry($zip, [string]$name, [byte[]]$bytes) {
    $entry = $zip.GetEntry($name)
    if (!$entry) { throw "Required original entry missing: $name" }
    $entry.Delete()
    $entry = $zip.CreateEntry($name, [IO.Compression.CompressionLevel]::Optimal)
    $stream = $entry.Open()
    try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
}
$zip = [IO.Compression.ZipFile]::Open($temporary, [IO.Compression.ZipArchiveMode]::Update)
try {
    $oldMod = $zip.GetEntry('game-instance/mods/mng-zombie-strike-1.0.0.jar')
    if (!$oldMod) { throw 'Original game mod missing.' }
    $oldStream = $oldMod.Open(); $oldHash = [Security.Cryptography.SHA256]::Create()
    try { $originalHash = [Convert]::ToHexString($oldHash.ComputeHash($oldStream)).ToLower() } finally { $oldStream.Dispose(); $oldHash.Dispose() }
    if ($originalHash -ne $verify.sourceSha256) { throw 'Original package mod differs from the verified patch source.' }
    foreach ($entry in $zip.Entries) {
        if ($entry.FullName -match '(?i)(^|/)(\.env|euler-api-key\.txt|license-backup\.json|session\.lock)$') { throw 'Private runtime file in source archive.' }
    }
    ReplaceEntry $zip 'game-instance/mods/mng-zombie-strike-1.0.0.jar' ([IO.File]::ReadAllBytes($mod))
    ReplaceEntry $zip 'game-instance/config/mng-zombie-strike.json' ([Text.Encoding]::UTF8.GetBytes(($settings | ConvertTo-Json -Depth 8)))
    ReplaceEntry $zip '.tikmng-package.json' ([Text.Encoding]::UTF8.GetBytes('{"version":"6.5.17"}'))
    ReplaceEntry $zip 'launch-game.cjs' ([IO.File]::ReadAllBytes((Join-Path $PSScriptRoot 'launch-game.cjs')))
} finally { $zip.Dispose() }
$reader = [IO.Compression.ZipFile]::OpenRead($temporary)
try {
    $entry = $reader.GetEntry('game-instance/mods/mng-zombie-strike-1.0.0.jar')
    $stream = $entry.Open(); $hash = [Security.Cryptography.SHA256]::Create()
    try { $actual = [Convert]::ToHexString($hash.ComputeHash($stream)).ToLower() } finally { $stream.Dispose(); $hash.Dispose() }
    if ($actual -ne $verify.jarSha256) { throw 'Packaged mod hash differs.' }
    if (!$reader.GetEntry('runtime/java/bin/java.exe')) { throw 'Bundled Java missing.' }
} finally { $reader.Dispose() }
[IO.File]::Move($temporary, $output)
$manifest = [ordered]@{version='6.5.17';file=[IO.Path]::GetFileName($output);bytes=(Get-Item -LiteralPath $output).Length;
    sha256=(Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLower();settingsVersion=11;giftMappings=15}
[IO.File]::WriteAllText((Join-Path ([IO.Path]::GetDirectoryName($output)) 'game-manifest.json'), ($manifest | ConvertTo-Json))
$manifest | ConvertTo-Json
