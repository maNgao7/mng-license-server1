$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$output=Join-Path $root 'qa\TrackLayoutTests.exe'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:exe ('/out:'+$output) (Join-Path $root 'plugin\TrackLayout.cs') (Join-Path $PSScriptRoot 'TrackLayoutTests.cs')
if($LASTEXITCODE -ne 0){throw 'Track tests did not compile.'}
& $output
if($LASTEXITCODE -ne 0){throw 'Track tests failed.'}
