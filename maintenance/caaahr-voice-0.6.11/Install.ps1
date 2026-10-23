param([string]$GameDirectory='D:\SteamLibrary\steamapps\common\CAAAHR! Demo',[switch]$Unattended)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
function FileDigest([string]$file){$stream=[IO.File]::OpenRead($file);$sha=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($sha.ComputeHash($stream))}finally{$sha.Dispose();$stream.Dispose()}}
try {
  if(!(Test-Path -LiteralPath (Join-Path $GameDirectory 'CAAAHR.exe'))){
    $dialog=New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description='Steam CAAAHR! Demo oyun klasorunu secin'
    if($dialog.ShowDialog() -ne 'OK'){exit 0}
    $GameDirectory=$dialog.SelectedPath
  }
  $game=(Resolve-Path -LiteralPath $GameDirectory).Path.TrimEnd('\')
  if(!(Test-Path -LiteralPath (Join-Path $game 'CAAAHR.exe')) -or !(Test-Path -LiteralPath (Join-Path $game 'CAAAHR_Data\Managed\Assembly-CSharp.dll'))){throw 'Bu klasor orijinal CAAAHR! Demo kurulumu degil.'}
  if(Get-Process -Name CAAAHR -ErrorAction SilentlyContinue){throw 'Kurulumdan once CAAAHR! oyununu kapatin.'}
  $dll=Join-Path $PSScriptRoot 'plugin\build\TikMnG.Caaahr.Voice.dll'
  if(!(Test-Path -LiteralPath $dll)){throw 'Derlenmis mod dosyasi eksik.'}
  if(!(Test-Path -LiteralPath (Join-Path $game 'BepInEx\core\BepInEx.dll'))){throw 'BepInEx 5 Mono x64 kurulumu gerekli. Bu beta paketi oyun motorunu icermez.'}
  if(!$Unattended){$answer=[System.Windows.Forms.MessageBox]::Show('Eski CAAAHR TikTok/Sandbox eklentisi kaldirilacak ve yeni Sesli Surus beta kurulacak. Orijinal oyun, kayitlar ve diger oyunlar korunacak. Devam edilsin mi?','TikMnG Sesli Surus','YesNo','Question');if($answer -ne 'Yes'){return}}
  $original=Join-Path $game 'CAAAHR_Data\Managed\Assembly-CSharp.dll'
  $before=FileDigest $original
  foreach($relative in @('BepInEx\plugins\CaaahrTikTokMod.dll','BepInEx\plugins\CaaahrTikTokMod.pdb','BepInEx\config\com.mng.caaahr.mod.cfg')){
    $target=[IO.Path]::GetFullPath((Join-Path $game $relative))
    if(!$target.StartsWith($game+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Guvenli kurulum yolu disinda.'}
    if(Test-Path -LiteralPath $target){Remove-Item -LiteralPath $target}
  }
  $oldBridge=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\caaahr-bridge'))
  $apps=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
  if($oldBridge -ne (Join-Path $apps 'caaahr-bridge')){throw 'Eski kopru yolu dogrulanamadi.'}
  $oldEntry=Join-Path $oldBridge 'bridge.js'
  Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -and $_.CommandLine.Contains('"'+$oldEntry+'"') } | ForEach-Object { Stop-Process -Id $_.ProcessId }
  foreach($name in @('bridge.js','package.json','bridge_settings.json')){ $file=Join-Path $oldBridge $name;if(Test-Path -LiteralPath $file){Remove-Item -LiteralPath $file} }
  if((Test-Path -LiteralPath $oldBridge) -and @(Get-ChildItem -LiteralPath $oldBridge -Force).Count -eq 0){Remove-Item -LiteralPath $oldBridge}
  $oldShortcut=Join-Path ([Environment]::GetFolderPath('Desktop')) 'CAAAHR-TikTok-Mod.bat'
  if(Test-Path -LiteralPath $oldShortcut){$text=Get-Content -LiteralPath $oldShortcut -Raw;if($text.Contains('caaahr-bridge')){Remove-Item -LiteralPath $oldShortcut}}
  $destination=Join-Path $game 'BepInEx\plugins\TikMnG.Caaahr.Voice.dll'
  Copy-Item -LiteralPath $dll -Destination $destination -Force
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'plugin\deps\newtonsoft-13.0.3\lib\net45\Newtonsoft.Json.dll') -Destination (Join-Path $game 'BepInEx\plugins\Newtonsoft.Json.dll') -Force
  if((FileDigest $destination) -ne (FileDigest $dll)){throw 'Mod dosyasi kontrolu basarisiz.'}
  if((FileDigest $original) -ne $before){throw 'Orijinal oyun butunluk kontrolu basarisiz.'}
  [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'game-path.txt'),$game)
  $bootstrap=@{launcher=(Join-Path $PSScriptRoot 'Start.ps1');dataDirectory=(Join-Path $env:LOCALAPPDATA 'TikMnG-CAAAHR')} | ConvertTo-Json
  [IO.File]::WriteAllText((Join-Path $game 'BepInEx\config\TikMnG.Bootstrap.json'),$bootstrap)
  if(!$Unattended){[System.Windows.Forms.MessageBox]::Show('Sesli Surus kuruldu. Masaustundeki TikMnG Sesli Surus kisayolundan acabilirsiniz. Oyun icinde B menusunde harita, mikrofon ve hediye ayarlari bulunur.','TikMnG') | Out-Null}
} catch {if($Unattended){throw};[System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'Kurulum tamamlanamadi') | Out-Null;exit 1}
