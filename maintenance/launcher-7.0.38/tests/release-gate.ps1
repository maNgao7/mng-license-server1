$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    & node --check main.js
    if ($LASTEXITCODE -ne 0) { throw 'Launcher syntax check failed.' }
    & node --check renderer/workspace.js
    if ($LASTEXITCODE -ne 0) { throw 'Library syntax check failed.' }
    $checks = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.test.cjs' | ForEach-Object { $_.FullName })
    & node --test --test-concurrency=1 --test-reporter=spec @checks
    if ($LASTEXITCODE -ne 0) { throw 'Release regression checks failed.' }
} finally { Pop-Location }
