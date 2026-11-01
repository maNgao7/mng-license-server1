param([string]$Source = (Join-Path $PSScriptRoot '..\dist-manager-delivery\win-unpacked'))
$ErrorActionPreference = 'Stop'
$Source = (Resolve-Path -LiteralPath $Source).Path
$Parent = (Resolve-Path -LiteralPath 'D:\TikMnG-Test-6.5.17').Path
$Target = [IO.Path]::GetFullPath((Join-Path $Parent 'win-unpacked'))
$Backup = [IO.Path]::GetFullPath((Join-Path $Parent ('win-unpacked-before-manager-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))))
foreach ($Path in @($Target, $Backup)) {
    if ([IO.Path]::GetDirectoryName($Path) -ne $Parent) { throw 'Beklenmeyen hedef klasoru.' }
}
if (-not (Test-Path -LiteralPath (Join-Path $Source 'TikMnG Test.exe'))) { throw 'Kaynak paket eksik.' }
$Open = Get-CimInstance Win32_Process | Where-Object {
    $_.ExecutablePath -and $_.ExecutablePath.StartsWith($Target + '\', [StringComparison]::OrdinalIgnoreCase)
}
if ($Open) { throw 'Once acik TikMnG on izleme penceresini kapatin.' }
if (Test-Path -LiteralPath $Backup) { throw 'Yedek klasoru zaten var.' }
if (Test-Path -LiteralPath $Target) { Move-Item -LiteralPath $Target -Destination $Backup }
try {
    Copy-Item -LiteralPath $Source -Destination $Target -Recurse
    foreach ($Relative in @('TikMnG Test.exe', 'resources\app.asar')) {
        $Expected = (Get-FileHash -LiteralPath (Join-Path $Source $Relative) -Algorithm SHA256).Hash
        $Actual = (Get-FileHash -LiteralPath (Join-Path $Target $Relative) -Algorithm SHA256).Hash
        if ($Actual -ne $Expected) { throw 'Kurulu paket dogrulanamadi.' }
    }
} catch {
    if (Test-Path -LiteralPath $Target) {
        $Incomplete = Join-Path $Parent ('incomplete-' + [Guid]::NewGuid().ToString())
        if ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Incomplete)) -ne $Parent) { throw 'Beklenmeyen kurtarma klasoru.' }
        Move-Item -LiteralPath $Target -Destination $Incomplete
    }
    if (Test-Path -LiteralPath $Backup) { Move-Item -LiteralPath $Backup -Destination $Target }
    throw
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '..\renderer\assets\icon-v4.ico') -Destination (Join-Path $Parent 'icon-v4.ico') -Force
& (Join-Path $PSScriptRoot 'install-preview-shortcut.ps1')
Write-Output "Preview installed. Previous app backup: $Backup"
