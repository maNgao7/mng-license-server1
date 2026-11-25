param([switch]$SkipPackage)

$ErrorActionPreference = 'Stop'
$base = Split-Path -Parent $PSScriptRoot
$project = Join-Path $base 'project'
$engine = 'D:/TikMnG-GitHub-Araclari/runtime/godot-4.7.2/Godot_v4.7.2-stable_win64_console.exe'
$suffix = [Guid]::NewGuid().ToString('N').Substring(0, 8)
$proof = Join-Path $base "release-015-check-$suffix"
New-Item -ItemType Directory -Path $proof | Out-Null

function Assert-Pass([string]$log, [int]$code, [string]$marker) {
    if ($code -ne 0 -or -not (Select-String -LiteralPath $log -SimpleMatch -Quiet -Pattern $marker) -or
            (Select-String -LiteralPath $log -Quiet -Pattern '^ERROR:|SCRIPT ERROR|SHADER ERROR')) {
        Get-Content -LiteralPath $log -Tail 35
        throw "Fetih check failed: $marker"
    }
    Write-Output "OK $marker"
}

function Invoke-Check([string]$test, [string]$marker, [string[]]$argsForGame = @(), [switch]$Graphical, [switch]$NormalStartup) {
    $name = [IO.Path]::GetFileNameWithoutExtension($test)
    $log = Join-Path $proof "$name.log"
    $argsForEngine = @('--path', $project, '--script', (Join-Path $project $test), '--log-file', $log)
    if (-not $Graphical) { $argsForEngine = @('--headless') + $argsForEngine }
    if (-not $NormalStartup) { $argsForGame = @('--self-test') + $argsForGame }
    & $engine @argsForEngine -- @argsForGame *> (Join-Path $proof "$name-console.log")
    Assert-Pass $log $LASTEXITCODE $marker
}

$import = Join-Path $proof 'godot-import.log'
& $engine --headless --path $project --import --log-file $import *> (Join-Path $proof 'godot-import-console.log')
if ($LASTEXITCODE -ne 0 -or (Select-String -LiteralPath $import -Quiet -Pattern '^ERROR:|SCRIPT ERROR|SHADER ERROR')) {
    Get-Content -LiteralPath $import -Tail 40
    throw 'Fetih resource import failed'
}

$oldProfile = $env:TIKMNG_ANIMAL_PROFILE
try {
    $env:TIKMNG_ANIMAL_PROFILE = Join-Path $proof 'rules-profile'
    $output = Join-Path $base 'paket-0.1.5'
    if (-not $SkipPackage) {
        & python (Join-Path $base 'package.py') --output $output
        if ($LASTEXITCODE -ne 0) { throw 'Fetih packaging failed' }
    }
    Invoke-Check 'qa/rules/check-war-rules.gd' 'PASS: WarRules:'
    Invoke-Check 'qa/rules/check-unit-gifts.gd' 'ANIMAL_UNIT_GIFTS_OK'
    Invoke-Check 'qa/rules/check-turkiye-aviation.gd' 'TURKIYE_AVIATION_OK'
    Invoke-Check 'qa/rules/check-missile-rules.gd' 'FETIH_MISSILE_RULES_OK'
    Invoke-Check 'qa/check-mixed-battle-visuals.gd' '0 failures'
    Invoke-Check 'qa/check-infantry-density.gd' '0 failures'
    Invoke-Check 'qa/check-aircraft-audio-cutoff.gd' 'FETIH_AIRCRAFT_AUDIO_OK: 0 failures' -Graphical
    Invoke-Check 'qa/check-missile-audio.gd' 'FETIH_MISSILE_AUDIO_OK: 0 failures' -Graphical
    $env:TIKMNG_ANIMAL_PROFILE = Join-Path $proof 'missile-visual-v3'
    Invoke-Check 'qa/check-missile-salvo-visuals.gd' 'MISSILE_VISUAL_QA: failures=0' -Graphical -argsForGame "--capture=$proof/missile-camera"
    $env:TIKMNG_ANIMAL_PROFILE = Join-Path $proof 'round-update-v3'
    Invoke-Check 'qa/check-round-update.gd' 'FETIH_ROUND_UPDATE_OK' -Graphical
    $env:TIKMNG_ANIMAL_PROFILE = Join-Path $proof 'gift-playtest-v4'
    Invoke-Check 'qa/check-gift-playtest.gd' 'FETIH_GIFT_PLAYTEST_OK' -Graphical
    $env:TIKMNG_ANIMAL_PROFILE = Join-Path $proof 'missile-proof-v3'
    Invoke-Check 'qa/check-missile-gift.gd' 'FETIH_MISSILE_GIFT_OK' -Graphical -argsForGame "--capture=$proof/missile"
    $env:TIKMNG_ANIMAL_PROFILE = Join-Path $proof 'missile-intro-proof-release'
    Invoke-Check 'qa/check-missile-intro.gd' 'FETIH_MISSILE_INTRO_OK' -Graphical -NormalStartup
    $env:TIKMNG_ANIMAL_PROFILE = Join-Path $proof 'chat-join-proof-release'
    Invoke-Check 'qa/check-chat-join.gd' 'FETIH_CHAT_JOIN_OK' -Graphical
    $env:TIKMNG_ANIMAL_PROFILE = Join-Path $proof 'held-gifts-release'
    Invoke-Check 'qa/check-held-gifts.gd' 'FETIH_HELD_GIFTS_OK' -Graphical
    $env:TIKMNG_ANIMAL_PROFILE = Join-Path $proof 'air-show-proof-release'
    Invoke-Check 'qa/check-air-show.gd' 'FETIH_AIR_SHOW_OK' -Graphical

    $node = Join-Path $base 'payload/bridge/runtime/node.exe'
    & $node --test (Join-Path $project 'qa/gift-progress.test.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'Gift progress test failed' }

    if (-not $SkipPackage) {
        $env:TIKMNG_ANIMAL_PROFILE = Join-Path $proof 'export-profile'
        $payload = Join-Path $proof 'installed'
        $archive = Join-Path $output 'Fetih-Windows-x64.zip'
        & python -m zipfile -e $archive $payload
        if ($LASTEXITCODE -ne 0) { throw 'Could not extract release ZIP' }
        $exportLog = Join-Path $proof 'export-game.log'
        $arguments = @('--log-file', ('"{0}"' -f $exportLog), '--', '--qa-scene', '--qa-exit', ('"--qa-output={0}/export"' -f $proof))
        $game = Start-Process -FilePath (Join-Path $payload 'Fetih.exe') -WorkingDirectory $payload `
            -ArgumentList $arguments -WindowStyle Hidden -PassThru
        if (-not $game.WaitForExit(30000)) {
            Stop-Process -Id $game.Id
            throw 'Packaged Fetih test timed out'
        }
        Assert-Pass $exportLog $game.ExitCode 'FETIH_PACKAGED_GUIDES_OK'
        Assert-Pass $exportLog $game.ExitCode 'FETIH_STANDALONE_ROUND_OK'
    }
} finally {
    $env:TIKMNG_ANIMAL_PROFILE = $oldProfile
}
Write-Output "Fetih proof: $proof"
