param([switch]$PrepareOnly,[switch]$VerifyStartup)
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Net.Http
$http=New-Object System.Net.Http.HttpClient
$http.Timeout=[TimeSpan]::FromSeconds(6)
function ReadLocalJson([string]$uri,[hashtable]$headers=@{},[int]$seconds=3){
  $request=New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Get,$uri)
  $cancel=New-Object System.Threading.CancellationTokenSource
  $cancel.CancelAfter($seconds*1000)
  $response=$null
  try{
    foreach($key in $headers.Keys){$request.Headers.TryAddWithoutValidation($key,[string]$headers[$key]) | Out-Null}
    $pending=$http.SendAsync($request,$cancel.Token)
    while(!$pending.IsCompleted){[System.Windows.Forms.Application]::DoEvents();[Threading.Thread]::Sleep(20)}
    $response=$pending.GetAwaiter().GetResult();$response.EnsureSuccessStatusCode() | Out-Null
    $body=$response.Content.ReadAsStringAsync()
    while(!$body.IsCompleted){[System.Windows.Forms.Application]::DoEvents();[Threading.Thread]::Sleep(20)}
    return ($body.GetAwaiter().GetResult() | ConvertFrom-Json)
  }finally{if($response){$response.Dispose()};$request.Dispose();$cancel.Dispose()}
}
$mutex=New-Object System.Threading.Mutex($false,'Local\TikMnG.CAAAHRSesliSurus.Start')
if(!$mutex.WaitOne(0)){return}
$splash=$null
$logDirectory=Join-Path $env:LOCALAPPDATA 'TikMnG-CAAAHR'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$launchLog=Join-Path $logDirectory 'launcher.log'
function WriteLaunchLog([string]$message){[IO.File]::AppendAllText($launchLog,([DateTime]::UtcNow.ToString('O')+' '+$message+[Environment]::NewLine))}
function FileDigest([string]$file){$stream=[IO.File]::OpenRead($file);$sha=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($sha.ComputeHash($stream))}finally{$sha.Dispose();$stream.Dispose()}}
WriteLaunchLog 'Launcher started.'
try {
  if(!$PrepareOnly){
    $splash=New-Object System.Windows.Forms.Form
    $splash.Text='TikMnG Sesli Surus';$splash.ClientSize=New-Object System.Drawing.Size(460,155)
    $splash.StartPosition='CenterScreen';$splash.FormBorderStyle='FixedDialog';$splash.MaximizeBox=$false;$splash.MinimizeBox=$false
    $splash.BackColor=[System.Drawing.Color]::White;$splash.TopMost=$true
    $title=New-Object System.Windows.Forms.Label;$title.Text='TikMnG  CAAAHR!';$title.Font=New-Object System.Drawing.Font('Segoe UI',20,[System.Drawing.FontStyle]::Bold);$title.SetBounds(24,20,420,42)
    $status=New-Object System.Windows.Forms.Label;$status.Text='Sesli Surus hazirlaniyor...';$status.Font=New-Object System.Drawing.Font('Segoe UI',11);$status.SetBounds(26,74,410,30)
    $bar=New-Object System.Windows.Forms.ProgressBar;$bar.Style='Marquee';$bar.MarqueeAnimationSpeed=24;$bar.SetBounds(26,116,405,8)
    $splash.Controls.AddRange(@($title,$status,$bar));$splash.Show();[System.Windows.Forms.Application]::DoEvents()
  }
  function ShowStatus([string]$message){WriteLaunchLog $message;if($splash -and !$splash.IsDisposed){$status.Text=$message;[System.Windows.Forms.Application]::DoEvents()}}
  $game='D:\SteamLibrary\steamapps\common\CAAAHR! Demo'
  $pathFile=Join-Path $root 'game-path.txt'
  if(Test-Path -LiteralPath $pathFile){$game=(Get-Content -LiteralPath $pathFile -Raw).Trim()}
  if(!(Test-Path -LiteralPath (Join-Path $game 'CAAAHR.exe'))){throw 'Orijinal CAAAHR! Demo bulunamadi. Steam uzerinden kurun.'}
  $source=Join-Path $root 'plugin\build\TikMnG.Caaahr.Voice.dll'
  $installed=Join-Path $game 'BepInEx\plugins\TikMnG.Caaahr.Voice.dll'
  $needsInstall=!(Test-Path -LiteralPath $installed)
  if(!$needsInstall){$needsInstall=(FileDigest $source) -ne (FileDigest $installed)}
  $needsInstall=$needsInstall -or (Test-Path -LiteralPath (Join-Path $game 'BepInEx\plugins\CaaahrTikTokMod.dll'))
  $needsInstall=$needsInstall -or !(Test-Path -LiteralPath (Join-Path $game 'BepInEx\plugins\Newtonsoft.Json.dll'))
  if($needsInstall){ShowStatus 'Oyun modu kuruluyor...'; & (Join-Path $root 'Install.ps1') -GameDirectory $game -Unattended}
  $node=(Get-Command node -ErrorAction SilentlyContinue).Source
  if(!$node){throw 'Calistirma ortami bulunamadi. Node.js gerekli.'}
  ShowStatus 'Yayin baglantisi hazirlaniyor...'
  $state=$null
  try{$state=ReadLocalJson 'http://127.0.0.1:4051/api/state' @{} 2}catch{}
  $localToken=Join-Path $env:LOCALAPPDATA 'TikMnG-CAAAHR\token'
  $authenticated=$false
  if($state -and $state.product -eq 'tikmng-caaahr-voice'){
    try{$auth=@{Authorization=('Bearer '+[IO.File]::ReadAllText($localToken).Trim())};$check=ReadLocalJson 'http://127.0.0.1:4051/mod/state' $auth 2;$authenticated=$check.product -eq 'tikmng-caaahr-voice'}catch{}
  }
  if($state -and $state.product -ne 'tikmng-caaahr-voice'){throw '4051 portu baska uygulama tarafindan kullaniliyor.'}
  if($state -and ($state.protocol -ne 15 -or !$authenticated)){
    $entry=Join-Path $root 'server.mjs'
    $owned=@(Get-CimInstance Win32_Process | Where-Object {$_.Name -eq 'node.exe' -and $_.CommandLine -and $_.CommandLine.Contains('"'+$entry+'"')})
    if(!$owned.Count){throw 'Yerel hizmet farkli bir klasorden calisiyor. Bu uygulamanin kisayolundan yeniden acin.'}
    ShowStatus 'Yerel baglanti onariliyor...'
    foreach($process in $owned){Stop-Process -Id $process.ProcessId}
    $state=$null
    $portDeadline=(Get-Date).AddSeconds(5)
    while([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object Port -eq 4051){if((Get-Date) -gt $portDeadline){throw 'Yerel hizmet kapanamadi.'};Start-Sleep -Milliseconds 100}
  }
  if(!$state){
    if([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object Port -eq 4051){throw '4051 portu baska uygulama tarafindan kullaniliyor.'}
    $logs=Join-Path $env:LOCALAPPDATA 'TikMnG-CAAAHR'
    New-Item -ItemType Directory -Path $logs -Force | Out-Null
    Start-Process -FilePath $node -ArgumentList ('"'+(Join-Path $root 'server.mjs')+'"') -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'bridge.log') -RedirectStandardError (Join-Path $logs 'bridge-error.log')
    for($i=0;$i -lt 50;$i++){
      Start-Sleep -Milliseconds 180;[System.Windows.Forms.Application]::DoEvents()
      try{$state=ReadLocalJson 'http://127.0.0.1:4051/api/state' @{} 1;if($state.product -eq 'tikmng-caaahr-voice' -and $state.protocol -eq 15){break}}catch{}
    }
    if(!$state -or $state.protocol -ne 15){throw 'Yayin hizmeti baslatilamadi. Gunluk: '+(Join-Path $logs 'bridge-error.log')}
  }
  $connectionFile=Join-Path $game 'BepInEx\config\TikMnG.LocalConnection.token'
  $auth=@{Authorization=('Bearer '+[IO.File]::ReadAllText($localToken).Trim())}
  $verified=ReadLocalJson 'http://127.0.0.1:4051/mod/state' $auth 3
  if($verified.product -ne 'tikmng-caaahr-voice' -or $verified.protocol -ne 15){throw 'Yerel baglanti dogrulanamadi.'}
  [IO.File]::WriteAllText($connectionFile,[IO.File]::ReadAllText($localToken).Trim())
  $cache=@{settings=$verified.settings;actions=$verified.actions;catalogCount=$verified.catalogCount}
  [IO.File]::WriteAllText((Join-Path $game 'BepInEx\config\TikMnG.MenuCache.json'),($cache | ConvertTo-Json -Depth 20))
  ShowStatus 'Hediye katalogu hazirlaniyor...'
  $catalog=ReadLocalJson 'http://127.0.0.1:4051/mod/gifts' $auth 5
  [IO.File]::WriteAllText((Join-Path $game 'BepInEx\config\TikMnG.GiftCatalog.json'),($catalog | ConvertTo-Json -Depth 20))
  if($PrepareOnly){'Mod kurulumu ve arka plan hizmeti hazir.';return}
  ShowStatus 'CAAAHR! Sesli Surus aciliyor...'
  if(!(Get-Process -Name CAAAHR -ErrorAction SilentlyContinue)){if($VerifyStartup){Start-Process -FilePath (Join-Path $game 'CAAAHR.exe') -ArgumentList '--tikmng-smoke' -WorkingDirectory $game -WindowStyle Normal}else{Start-Process -FilePath (Join-Path $game 'CAAAHR.exe') -WorkingDirectory $game -WindowStyle Normal}}
  $deadline=(Get-Date).AddSeconds(60);$found=$false
  do {
    Start-Sleep -Milliseconds 180;[System.Windows.Forms.Application]::DoEvents()
    if($splash.IsDisposed){return}
    if(Get-Process -Name CAAAHR -ErrorAction SilentlyContinue){$found=$true;break}
  }until((Get-Date) -ge $deadline)
  if(!$found){throw 'Steam oyunu baslatamadi. Steam oturumunuzun acik oldugunu kontrol edin.'}
  $gameProcess=Get-Process -Name CAAAHR | Select-Object -First 1
  $deadline=(Get-Date).AddSeconds(35)
  do {
    Start-Sleep -Milliseconds 200;[System.Windows.Forms.Application]::DoEvents()
    if($splash.IsDisposed){return}
    try{$current=ReadLocalJson 'http://127.0.0.1:4051/api/state' @{} 1;if($current.game.processId -eq $gameProcess.Id -and $current.game.menuReady -and $current.game.catalogCount -ge 680 -and (([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-$current.game.receivedAt) -lt 3000){break}}catch{}
  }until((Get-Date) -ge $deadline)
  if(!$current -or $current.game.processId -ne $gameProcess.Id -or !$current.game.menuReady -or $current.game.catalogCount -lt 680 -or (([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-$current.game.receivedAt) -ge 3000){throw 'Oyun acildi; yerel hizmet hazir degil. Oyunu cevrimdisi oynayabilir, B menusunden Baglantiyi onar dugmesini kullanabilirsiniz.'}
  WriteLaunchLog ('Game startup verified: process='+$gameProcess.Id+'; menu ready; catalog='+$current.game.catalogCount)
} catch {
  WriteLaunchLog ('FAILED: '+$_.Exception.Message+' '+$_.ScriptStackTrace)
  if($PrepareOnly){throw}
  [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'TikMnG Sesli Surus') | Out-Null
} finally {
  if($splash -and !$splash.IsDisposed){$splash.Close();$splash.Dispose()}
  $http.Dispose()
  $mutex.ReleaseMutex();$mutex.Dispose()
}
