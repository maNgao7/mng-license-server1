param([string]$GameDirectory='D:\SteamLibrary\steamapps\common\CAAAHR! Demo')
$ErrorActionPreference='Stop'
$managed=Join-Path $GameDirectory 'CAAAHR_Data\Managed'
$core=Join-Path $GameDirectory 'BepInEx\core'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$output=Join-Path $PSScriptRoot 'build'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$references=@('mscorlib.dll','netstandard.dll','System.dll','System.Core.dll','Assembly-CSharp.dll','UnityEngine.dll','UnityEngine.CoreModule.dll','UnityEngine.PhysicsModule.dll','UnityEngine.ParticleSystemModule.dll','UnityEngine.AudioModule.dll','UnityEngine.IMGUIModule.dll','UnityEngine.InputLegacyModule.dll','UnityEngine.UnityWebRequestModule.dll','UnityEngine.UnityWebRequestWWWModule.dll','UnityEngine.JSONSerializeModule.dll','Unity.RenderPipelines.Core.Runtime.dll','Unity.RenderPipelines.Universal.Runtime.dll','Fusion.Runtime.dll')
$args=@('/nologo','/noconfig','/target:library','/optimize+','/nostdlib+',('/out:'+(Join-Path $output 'TikMnG.Caaahr.Voice.dll')))
foreach($name in $references){$file=Join-Path $managed $name;if(Test-Path -LiteralPath $file){$args+=('/reference:'+$file)}}
foreach($file in Get-ChildItem -LiteralPath $managed -Filter 'Fusion*.dll'){$reference='/reference:'+$file.FullName;if($args -notcontains $reference){$args+=$reference}}
foreach($name in @('UnityEngine.UnityWebRequestTextureModule.dll','UnityEngine.ImageConversionModule.dll','UnityEngine.ScreenCaptureModule.dll','UnityEngine.TextRenderingModule.dll','UnityEngine.UI.dll','UnityEngine.UIModule.dll','Unity.RenderPipelines.GPUDriven.Runtime.dll')){$args+=('/reference:'+(Join-Path $managed $name))}
$args+=('/reference:'+(Join-Path $core 'BepInEx.dll'))
$args+=('/reference:'+(Join-Path $core '0Harmony.dll'))
$args+=('/reference:'+(Join-Path $PSScriptRoot 'deps\newtonsoft-13.0.3\lib\net45\Newtonsoft.Json.dll'))
$args+=(Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.cs' | ForEach-Object FullName)
& $compiler $args
if($LASTEXITCODE -ne 0){throw 'Mod derlenemedi.'}
Get-FileHash -LiteralPath (Join-Path $output 'TikMnG.Caaahr.Voice.dll')
