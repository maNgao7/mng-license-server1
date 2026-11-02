$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path -LiteralPath 'D:\TikMnG-Minecraft-Kurulum-Duzeltmesi-7.0.4').Path
if ($Root -ne 'D:\TikMnG-Minecraft-Kurulum-Duzeltmesi-7.0.4') { throw 'Unexpected cleanup root' }
$Reports = @('fresh-install-verification.json','public-fresh-install-verification.json')
$Processes = @(Get-CimInstance Win32_Process | Where-Object ProcessId -ne $PID)
$Result = @()
foreach ($ReportName in $Reports) {
    $Report = Get-Content -LiteralPath (Join-Path $Root $ReportName) -Raw | ConvertFrom-Json
    if (-not $Report.passed) { throw 'The QA report did not pass' }
    $QaRoot = (Resolve-Path -LiteralPath $Report.isolatedLibraryRoot).Path
    if ([IO.Path]::GetDirectoryName($QaRoot) -ne $Root -or [IO.Path]::GetFileName($QaRoot) -notmatch '^(local|public)-fresh-[A-Za-z0-9]{6}$') { throw 'Unapproved QA directory' }
    if ($Processes | Where-Object { $_.CommandLine -and $_.CommandLine.Replace('/','\').IndexOf($QaRoot,[StringComparison]::OrdinalIgnoreCase) -ge 0 }) { throw 'QA directory is in use' }
    foreach ($Game in @('snow-war','battle-royale')) {
        $Downloads = Join-Path $QaRoot ".game-library\$Game\downloads"
        if (-not (Test-Path -LiteralPath $Downloads)) { continue }
        $Original = Join-Path $Root "assets\$Game-7.0.4.zip"
        $OriginalHash = (Get-FileHash -LiteralPath $Original -Algorithm SHA256).Hash
        foreach ($File in Get-ChildItem -LiteralPath $Downloads -File -Filter '*.zip') {
            $Resolved = (Resolve-Path -LiteralPath $File.FullName).Path
            if (-not $Resolved.StartsWith($QaRoot + '\',[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetDirectoryName($Resolved) -ne $Downloads) { throw 'File escaped QA downloads' }
            $Ancestor = Get-Item -LiteralPath $Resolved -Force
            while ($Ancestor -and $Ancestor.FullName.Length -ge $Root.Length) {
                if ($Ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse point is not allowed' }
                $Ancestor = if ($Ancestor.PSIsContainer) { $Ancestor.Parent } else { $Ancestor.Directory }
            }
            if ($File.Length -ne (Get-Item -LiteralPath $Original).Length -or (Get-FileHash -LiteralPath $Resolved -Algorithm SHA256).Hash -ne $OriginalHash) { throw 'Cache is not an identical retained archive' }
            Remove-Item -LiteralPath $Resolved -Force
            $Result += [pscustomobject]@{Removed=$Resolved;Bytes=$File.Length;RetainedOriginal=$Original;SHA256=$OriginalHash}
        }
    }
}
$Output = Join-Path $PSScriptRoot '..\qa\20261030\verified-cleanup.json'
$Result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $Output -Encoding UTF8
[pscustomobject]@{RemovedFiles=$Result.Count;RecoveredGB=[math]::Round(($Result | Measure-Object Bytes -Sum).Sum/1GB,3);Report=(Resolve-Path -LiteralPath $Output).Path} | ConvertTo-Json
