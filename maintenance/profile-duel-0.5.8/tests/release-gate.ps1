$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$entry = Get-Content (Join-Path $projectRoot 'src/launcher-entry.mjs') -Raw
if ($entry -notmatch 'subscribeSharedEvents' -or $entry -notmatch 'getCachedProfile') {
  throw 'Launcher-owned session/profile-cache contract is missing.'
}
if ($entry -match 'TikTokLiveConnector|connectTikTok|new WebSocket|https?\.request') {
  throw 'Standalone connector/network code must not exist in the launcher entry.'
}
if (-not (Test-Path (Join-Path $projectRoot 'launcher-widget.json'))) {
  throw 'Launcher widget manifest is missing.'
}

& npm test
if ($LASTEXITCODE -ne 0) { throw 'Profile Duel tests failed.' }
Write-Output 'Profile Duel release gate passed.'
