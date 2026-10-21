param(
    [Parameter(Mandatory=$true)][string]$GameRoot,
    [Parameter(Mandatory=$true)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$game = (Resolve-Path -LiteralPath $GameRoot).Path
$out = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $out) { throw 'Choose a new empty output directory.' }
New-Item -ItemType Directory -Path $out | Out-Null
$classes = Join-Path $out 'classes'
$libraries = Get-ChildItem -LiteralPath (Join-Path $game 'runtime/libraries') -Recurse -File -Filter '*.jar'
$asm = ($libraries | Where-Object Name -eq 'asm-9.9.1.jar' | Select-Object -First 1).FullName
$gson = ($libraries | Where-Object Name -eq 'gson-2.10.jar' | Select-Object -First 1).FullName
$mod = Join-Path $game 'game-instance/mods/mng-zombie-strike-1.0.0.jar'
if (!$asm -or !$gson -or !(Test-Path -LiteralPath $mod)) { throw 'Required original mod/runtime libraries missing.' }
& javac --release 17 -encoding UTF-8 -cp "$mod;$gson" -d $classes (Join-Path $root 'java/StandardGiftRules.java')
if ($LASTEXITCODE -ne 0) { throw 'Gift migration compilation failed.' }
& javac --release 17 -encoding UTF-8 -cp $asm -d $classes (Join-Path $root 'java/PatchGiftStandards.java')
if ($LASTEXITCODE -ne 0) { throw 'Resource patch tool compilation failed.' }
$result = Join-Path $out 'mng-zombie-strike-1.0.0.jar'
& java -cp "$classes;$asm" PatchGiftStandards $mod $result $classes (Join-Path $root 'standard-gifts.json') (Join-Path $root 'assets/tikmng_zombie_war_gift_guide.png')
if ($LASTEXITCODE -ne 0) { throw 'Gift patch build failed.' }
$tests = Join-Path $out 'checks'
$testSources = Get-ChildItem -LiteralPath (Join-Path $root 'checks') -Recurse -File -Filter '*.java' | ForEach-Object FullName
& javac --release 17 -encoding UTF-8 -cp "$result;$gson" -d $tests @testSources
if ($LASTEXITCODE -ne 0) { throw 'Regression check compilation failed.' }
$classpath = "$tests;$result;" + (($libraries | ForEach-Object FullName) -join ';')
$new = Join-Path $out 'fixture-new'
$existing = Join-Path $out 'fixture-existing'
New-Item -ItemType Directory -Path $new,$existing | Out-Null
$fixture = @{
    username=''; initialWeapon='tabanca'; selectedMap='office'; maxHealth=74; zombieLimit=800;
    settingsVersion=10; standardRulesInstalled=$true;
    rules=@{
        like=@{action='ZOMBIE';amount=9;threshold=100;target='zombie'};
        follow=@{action='ZOMBIE';amount=6;threshold=1;target='zombie'};
        share=@{action='HEAL';amount=2;threshold=1;target='zombie'};
        'gift:5319'=@{action='ZOMBIE';amount=10;threshold=1;target='zombie'};
        'gift:54558'=@{action='INFINITE';amount=300;threshold=1;target='zombie'};
        'gift:99999'=@{action='ZOMBIE';amount=500;threshold=1;target='zombie'}
    }
}
[IO.File]::WriteAllText((Join-Path $existing 'mng-zombie-strike.json'), ($fixture | ConvertTo-Json -Depth 6))
foreach ($case in @(@('new',$new),@('existing',$existing),@('reload',$existing))) {
    & java "-Dmng.fixture.config=$($case[1])" -cp $classpath com.tikmng.zombiestrike.StandardGiftRulesChecks $case[0]
    if ($LASTEXITCODE -ne 0) { throw "Gift regression check failed: $($case[0])" }
}
$manifest = @{
    version='6.5.17'; settingsVersion=11;
    sourceSha256=(Get-FileHash -LiteralPath $mod -Algorithm SHA256).Hash.ToLower();
    jarSha256=(Get-FileHash -LiteralPath $result -Algorithm SHA256).Hash.ToLower();
    pngSha256=(Get-FileHash -LiteralPath (Join-Path $root 'assets/tikmng_zombie_war_gift_guide.png') -Algorithm SHA256).Hash.ToLower();
    tests=@('fresh-install','existing-settings','restart-preservation')
}
[IO.File]::WriteAllText((Join-Path $out 'verification.json'), ($manifest | ConvertTo-Json -Depth 4))
Write-Output "Verified game-only patch: $result"
