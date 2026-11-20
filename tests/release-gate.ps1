param([switch]$RequireReleaseIntegrity)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $repoRoot
try {
    $testFiles = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.test.js' | Sort-Object Name | ForEach-Object FullName)
    if (Get-Command rtk -ErrorAction SilentlyContinue) {
        & rtk test node --test @testFiles
    } else {
        & node --test @testFiles
    }
    if ($LASTEXITCODE -ne 0) { throw 'Server regression tests failed. See the test output.' }
    if ($RequireReleaseIntegrity) {
        @'
import fs from 'node:fs';
for (const file of ['content-defaults.json', 'web/content-catalog-7.0.0.json']) {
    const catalog = JSON.parse(fs.readFileSync(file));
    for (const id of ['hapisten-kac', 'profile-duel', 'fetih']) {
        const game = catalog.games.find(game => game.id === id);
        if (!game || !/^[a-f0-9]{64}$/.test(game.sha256) || !Number.isSafeInteger(game.bytes) || game.bytes <= 0)
            throw Error(file + ': real release SHA-256/bytes required for ' + id);
    }
}
'@ | & node --input-type=module
        if ($LASTEXITCODE -ne 0) { throw 'Main must fill the real release package integrity before publishing.' }
    }
    Write-Output 'Server release gate passed.'
} finally {
    Pop-Location
}
