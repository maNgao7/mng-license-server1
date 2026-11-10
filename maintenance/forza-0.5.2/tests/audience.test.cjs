const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8');
test('likes and follows are independent entry routes with repeat-follow protection',()=>{
 const live=source('LiveControl.cs');
 assert.match(live,/rewardedFollows.Add\(username\)/);
 assert.doesNotMatch(live,/settings.EntryFeeCoins==0&&settings.(LikesEnter|FollowsEnter)/);
 assert.match(live,/batches-\(admitted\?0:1\)/);
 assert.match(source('RaceSafety.cs'),/p.Value.FreeEntry\|\|p.Value.Coins>=settings.EntryFeeCoins/);
});
test('gift catalog is optional and active settings have no difficulty jargon',()=>{
 const menu=source('Menu.cs'),action=source('ActionMenu.cs');
 assert.doesNotMatch(menu+action,/Yükseltme zorluğu|Hediye çarpanları/);
 assert.match(action,/Hediye listesi/);
 assert.match(menu,/if\(showPanel&&!quickSettingsOpen\)[\s\S]*if\(giftCatalogOpen\)DrawGiftCatalog\(\)/);
});
test('every visible target-speed label stays anchored and distant labels scale instead of disappearing',()=>{
 const hud=source('RacingHud.cs');
 assert.doesNotMatch(hud,/distance>180/);
 assert.match(hud,/displaySpeed=!Running\?entry.TopSpeedKph/);
 assert.match(hud,/Mathf\.Lerp\(1f,\.30f,Mathf\.InverseLerp\(18f,100f,distance\)\)/);
 assert.match(hud,/var badgeY=y-\(size\+44\)\*identityScale/);
 assert.match(hud,/DrawPortrait\(entry,new Rect\(-size\/2,0,size,size\)\)/);
 assert.match(hud,/renderedCarIdentities\.Add\(entry\.Username\)/);
 assert.doesNotMatch(hud,/IdentitySlots|occupiedIdentities|fallback\.OrderBy|VehicleLabelOverlaps|visibleVehicleLabels/);
 assert.match(hud,/WorldToScreenPoint\(target\)/);
 assert.doesNotMatch(hud,/labelOffset|leaderLine|HudLine\([^;]*target/i);
 assert.match(source('TrackMap.cs'),/EventType.MouseDown/);
 assert.match(source('Plugin.cs'),/keyboard.mKey.wasPressedThisFrame/);
});
test('grid sorting never teleports racing cars and upgrade vibration is cosmetic',()=>{
 const grid=source('StartingGrid.cs');
 assert.match(grid,/Running\|\|startRequested\|\|RoundTransitioning/);
 assert.match(grid,/entry.Slot==i\+1\)continue/);
 const feedback=source('UpgradeFeedback.cs');
 assert.match(feedback,/model.Root.transform.localPosition=/);
 assert.doesNotMatch(feedback,/line.loop=true|Car.transform.position=/);
});
test('results board shows twelve racers with one win total and separate podium rows',()=>{
 const board=source('ResultsBoard.cs');
 assert.match(board,/ResultsBoardRows = 12/);
 assert.match(board,/new\[\] \{ "#", "YARI\\u015e\\u00c7I", "GAL\\u0130B\\u0130YET" \}/);
 assert.match(board,/user\.First\.ToString\(CultureInfo\.InvariantCulture\) \+ "X"/);
 assert.match(board,/var podiumX = new\[\] \{ -13\.6f, -18\.05f, -9\.15f \}/);
 assert.match(board,/RefreshResultsBoardPortraits\(\)/);
});
