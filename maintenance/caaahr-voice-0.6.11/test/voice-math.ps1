$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$output=Join-Path $root 'qa\VoiceMathTests.exe'
New-Item -ItemType Directory -Path (Split-Path $output -Parent) -Force | Out-Null
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:exe ('/out:'+$output) (Join-Path $root 'plugin\VoiceMath.cs') (Join-Path $root 'plugin\DefaultMicrophone.cs') (Join-Path $PSScriptRoot 'VoiceMathTests.cs')
if($LASTEXITCODE -ne 0){throw 'Voice tests did not compile.'}
& $output
if($LASTEXITCODE -ne 0){throw 'Voice tests failed.'}
