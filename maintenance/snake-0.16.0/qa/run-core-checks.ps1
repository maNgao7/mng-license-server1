$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$jdk = Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE '.gradle/jdks') -Filter javac.exe -Recurse |
    Where-Object FullName -Match '17.*[\\/]bin[\\/]javac.exe$' | Select-Object -First 1
if (-not $jdk) { throw 'JDK 17 bulunamadi.' }
$bin = Split-Path -Parent $jdk.FullName
$output = Join-Path $PSScriptRoot 'classes-v016'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$production = @('ArenaEngine','ArenaRules','ArenaSpace','ArenaLabels','ArenaLandscape','ArenaWeave','AvatarMask','SnakeEffectMath') |
    ForEach-Object { Join-Path $root "mod/src/main/java/com/tikmng/snake/$_.java" } |
    Where-Object { Test-Path -LiteralPath $_ }
$names = @('ReleasePursuitCheck','ArenaCheck','HuntCheck','BiteCheck','RulesCheck','SeparationCheck','CircleCheck','LabelsCheck','WinCheck','GalaxyCheck','PursuitCheck','WeaveCheck','ChaseMotionCheck','NearMassCombatCheck','PlayRulesCheck','LandscapeCheck','AvatarMaskCheck','ManualBattleCheck','EdibleGalaxyCheck','SnakeVisualEffectsCheck','SnakeCrownCheck') |
    Where-Object { Test-Path -LiteralPath (Join-Path $PSScriptRoot "$_.java") }
$tests = $names | ForEach-Object { Join-Path $PSScriptRoot "$_.java" }
& (Join-Path $bin 'javac.exe') --release 17 -encoding UTF-8 -d $output @production @tests
if ($LASTEXITCODE -ne 0) { throw 'Core test compilation failed.' }
$results = foreach ($name in $names) {
    $source = [IO.File]::ReadAllText((Join-Path $PSScriptRoot "$name.java"))
    $package = [regex]::Match($source, '(?m)^package\s+([a-zA-Z0-9_.]+);')
    $class = if ($package.Success) { $package.Groups[1].Value + '.' + $name } else { $name }
    if ($name -in @('AvatarMaskCheck','SnakeVisualEffectsCheck')) {
        $lines = & (Join-Path $bin 'java.exe') (Join-Path $PSScriptRoot "$name.java") 2>&1
    } else {
        $lines = & (Join-Path $bin 'java.exe') -cp $output $class 2>&1
    }
    $code = $LASTEXITCODE
    [pscustomobject]@{test=$name;passed=$code -eq 0;output=($lines -join "`n")}
}
$report = [pscustomobject]@{version='0.16.0';passed=@($results | Where-Object { -not $_.passed }).Count -eq 0;tests=@($results)}
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'core-checks-0.16.0.json') -Encoding utf8
$results | Format-Table -Wrap
if (-not $report.passed) { throw 'Core checks failed; see core-checks-0.16.0.json.' }
