param([switch]$Apply, [switch]$IncludeDownloadCaches)
$ErrorActionPreference = 'Stop'
$Project = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$TempRoot = (Resolve-Path -LiteralPath $env:TEMP).Path
if ($Project -ne 'C:\Users\User\Desktop\MNG-TikTok-Game\launcher' -or $TempRoot -ne 'C:\Users\User\AppData\Local\Temp') { throw 'Unexpected cleanup roots.' }
$BuildNames = @('dist-admin-preview','dist-admin-preview-final','dist-manager-candidate','dist-preview-fixed','dist-manager-delivery')
$CachePaths = @('C:\Users\User\AppData\Local\npm-cache\_cacache','C:\Users\User\AppData\Local\npm-cache\_npx')
if ($IncludeDownloadCaches) { $CachePaths += @('C:\Users\User\AppData\Local\electron\Cache','C:\Users\User\AppData\Local\electron-builder\Cache') }
$TempPattern = '^tikmng-(agency-test|designer-qa|chatterbox-install|content-browser|license-entry-qa|license-v3|admin-demo|admin-preview)-[A-Za-z0-9]+$'
$Candidates = @($BuildNames | ForEach-Object { Join-Path $Project $_ }) + $CachePaths
$Candidates += @(Get-ChildItem -LiteralPath $TempRoot -Directory | Where-Object { $_.Name -match $TempPattern -and $_.LastWriteTime -lt (Get-Date).AddHours(-1) } | ForEach-Object FullName)
$Processes = @(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.Name -notmatch '^(pwsh|powershell|cmd)\.exe$' })
$Report = @()
foreach ($Candidate in $Candidates) {
    if (-not (Test-Path -LiteralPath $Candidate)) { continue }
    $Resolved = (Resolve-Path -LiteralPath $Candidate).Path
    $AllowedBuild = [IO.Path]::GetDirectoryName($Resolved) -eq $Project -and $BuildNames -contains [IO.Path]::GetFileName($Resolved)
    $AllowedTemp = [IO.Path]::GetDirectoryName($Resolved) -eq $TempRoot -and [IO.Path]::GetFileName($Resolved) -match $TempPattern
    if (-not ($AllowedBuild -or $AllowedTemp -or $CachePaths -contains $Resolved) -or [IO.Path]::GetPathRoot($Resolved) -ne 'C:\') { throw 'Cleanup path escaped its explicit allowlist.' }
    $Entry = Get-Item -LiteralPath $Resolved -Force
    if ($Entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
    $Files = @(Get-ChildItem -LiteralPath $Resolved -Recurse -Force -ErrorAction Stop)
    if ($Files | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint } | Select-Object -First 1) { continue }
    if ($Processes | Where-Object { ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($Resolved + '\',[StringComparison]::OrdinalIgnoreCase)) -or ($_.CommandLine -and $_.CommandLine.Replace('/','\').IndexOf($Resolved + '\',[StringComparison]::OrdinalIgnoreCase) -ge 0) } | Select-Object -First 1) { continue }
    if ([IO.Path]::GetFileName($Resolved) -eq 'dist-manager-delivery') {
        $Installed = 'D:\TikMnG-Test-6.5.17\win-unpacked\resources\app.asar'
        $Built = Join-Path $Resolved 'win-unpacked\resources\app.asar'
        if (-not (Test-Path -LiteralPath $Installed) -or -not (Test-Path -LiteralPath $Built) -or (Get-FileHash -LiteralPath $Installed).Hash -ne (Get-FileHash -LiteralPath $Built).Hash) { continue }
    }
    $Bytes = ($Files | Where-Object { -not $_.PSIsContainer } | Measure-Object Length -Sum).Sum
    $State = 'candidate'
    if ($Apply) {
        try { Remove-Item -LiteralPath $Resolved -Recurse -Force -ErrorAction Stop; $State = 'removed' }
        catch { $State = 'locked-or-skipped' }
    }
    $Report += [pscustomobject]@{ Path=$Resolved; Bytes=[long]$Bytes; State=$State }
}
$ReportRoot = 'D:\TikMnG-QA-Delivery\disk-cleanup'
New-Item -ItemType Directory -Path $ReportRoot -Force | Out-Null
$Report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $ReportRoot ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $(if($Apply){'applied'}else{'audit'}) + '.json')) -Encoding UTF8
[pscustomobject]@{ Applied=[bool]$Apply; Targets=$Report.Count; CandidateGB=[math]::Round(($Report | Measure-Object Bytes -Sum).Sum/1GB,3); RemovedGB=[math]::Round(($Report | Where-Object State -eq 'removed' | Measure-Object Bytes -Sum).Sum/1GB,3); Details=$Report } | ConvertTo-Json -Depth 4
