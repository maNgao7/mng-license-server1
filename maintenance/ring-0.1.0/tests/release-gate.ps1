param([switch]$FoundationOnly)
$ErrorActionPreference = 'Stop'
$boxProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location -LiteralPath $boxProjectRoot
try {
    $boxFiles = @(Get-ChildItem -LiteralPath 'src','tests','tools' -Filter '*.cjs' -File)
    $boxFiles += @(Get-Item -LiteralPath 'main.cjs','preload.cjs','desktop/renderer.js','spectator/renderer.js')
    $boxFiles += @(Get-ChildItem -LiteralPath 'tools' -Filter '*.js' -File)
    $boxFiles += @(Get-ChildItem -LiteralPath 'broadcast' -File | Where-Object Extension -in '.js','.cjs')
    $boxFiles += @(Get-ChildItem -LiteralPath 'native-hud' -File | Where-Object Extension -in '.js','.cjs')
    foreach ($boxFile in $boxFiles) {
        & node --check $boxFile.FullName
        if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: $($boxFile.Name)" }
    }
    $boxTests = @(Get-ChildItem -LiteralPath 'tests' -Filter '*.test.cjs' -File | ForEach-Object { $_.FullName })
    & node --test @boxTests
    if ($LASTEXITCODE -ne 0) { throw 'Foundation regression failed' }
    & python -c "import ast,pathlib; [ast.parse(p.read_text(encoding='utf-8-sig')) for p in pathlib.Path('tools').rglob('*.py')]; print('Native tools Python syntax OK')"
    if ($LASTEXITCODE -ne 0) { throw 'Native probe syntax failed' }
    & node tools/native-camera.js --self-test
    if ($LASTEXITCODE -ne 0) { throw 'Native camera projection regression failed' }
    if (-not $FoundationOnly) {
        if (-not (& (Join-Path $PSScriptRoot 'verify-live-ring.ps1') -AppRoot $boxProjectRoot)) {
            throw 'This build still needs a live gift-to-punch and portrait check.'
        }
        & node tools/spectator-smoke.cjs --round
        if ($LASTEXITCODE -ne 0) { throw 'Native ring and second match regression failed' }
        Write-Output 'Private desktop preview passed the live evidence and native match checks.'
    }
    Write-Output 'Private preview foundation and camera checks passed.'
} finally { Pop-Location }
