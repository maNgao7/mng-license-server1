$ErrorActionPreference = 'Stop'
$modDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\mod'))
Push-Location -LiteralPath $modDirectory
try {
    & .\gradlew.bat --offline --no-daemon clean regressionTest build
    if ($LASTEXITCODE -ne 0) { throw "SnowWar build failed ($LASTEXITCODE)" }
    Get-Item -LiteralPath (Join-Path $modDirectory 'build\libs\mng_snow_war-1.0.0.jar')
} finally {
    Pop-Location
}
