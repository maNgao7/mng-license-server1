$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:winexe /platform:x64 /optimize+ /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll ("/out:" + (Join-Path $PSScriptRoot 'TikMnG.Arena.Startup.exe')) (Join-Path $PSScriptRoot 'Startup.cs')
if ($LASTEXITCODE -ne 0) { throw 'Startup host build failed.' }
