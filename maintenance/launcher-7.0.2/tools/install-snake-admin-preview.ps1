$ErrorActionPreference = 'Stop'
$source = [IO.Path]::GetFullPath('D:\TikMnG-Manager-Snake-0.15.0-candidate\win-unpacked')
$parent = [IO.Path]::GetFullPath('D:\TikMnG-Manager-7.0.0')
$target = [IO.Path]::GetFullPath((Join-Path $parent 'win-unpacked'))
if ([IO.Path]::GetDirectoryName($target) -ne $parent -or $target -eq $source) { throw 'Unexpected preview target.' }
if (!(Test-Path -LiteralPath (Join-Path $source 'TikMnG.exe')) -or !(Test-Path -LiteralPath (Join-Path $source 'resources\app.asar'))) { throw 'Candidate incomplete.' }
$exe = Join-Path $target 'TikMnG.exe'
$running = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.Equals($exe, [StringComparison]::OrdinalIgnoreCase) }
if ($running) { throw 'Administrator preview is still running. Close it before replacement.' }
$backup = Join-Path $parent ('win-unpacked-before-snake-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $target) { Move-Item -LiteralPath $target -Destination $backup }
try {
    Copy-Item -LiteralPath $source -Destination $target -Recurse
    foreach ($name in @('TikMnG.exe', 'resources\app.asar')) {
        if ((Get-FileHash -LiteralPath (Join-Path $source $name) -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath (Join-Path $target $name) -Algorithm SHA256).Hash) { throw "Preview copy integrity failed: $name" }
    }
} catch {
    if (Test-Path -LiteralPath $backup) {
        $failed = Join-Path $parent ('win-unpacked-incomplete-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
        if (Test-Path -LiteralPath $target) { Move-Item -LiteralPath $target -Destination $failed }
        Move-Item -LiteralPath $backup -Destination $target
    }
    throw
}
@{ installed = $true; target = $target; backup = $backup; officialLauncherChanged = $false; userDataChanged = $false } | ConvertTo-Json -Compress
