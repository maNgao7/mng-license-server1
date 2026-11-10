'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
test('manual start cancels the flyover instead of dropping P and always uses the native 3 second clock',()=>{
 const code=source('Plugin.cs').split('private void BeginCountdown()')[1].split('private void WriteStatus()')[0];
 assert.doesNotMatch(code.split('SortStartingGrid()')[0],/IntroActive/);
 assert.match(code,/entries.Count == 0/);
 assert.match(code,/introStartedAt=-100/);
 assert.match(code,/NativeCountdownStarted\(3\)/);
});
test('overtaking ignores only viewer body pairs and preserves native steering and road collision layers',()=>{
 const safety=source('RaceSafety.cs').split('private void ConfigureModelCollision')[1].split('private void VerifyNearLineJoin')[0];
 assert.match(safety,/Physics.IgnoreCollision\(body,other.CollisionHull,true\)/);
 assert.doesNotMatch(safety,/IgnoreLayerCollision|\.enabled=false|\.isTrigger\s*=/);
 const passing=source('Passing.cs');
 assert.match(passing,/target.maxOffsetLeft-1.1f/);
 assert.match(passing,/target.maxOffsetRight-1.1f/);
 assert.match(passing,/Mathf.MoveTowards/);
 assert.doesNotMatch(passing,/linearVelocity\s*=|ServerTeleport|transform.position\s*=/);
});
test('distant identity text scales in the same space as its portrait and restores the HUD matrix',()=>{
 const code=source('RacingHud.cs');
 assert.match(code,/new Vector3\(identityScale,identityScale,1\)/);
 assert.match(code,/finally \{GUI.matrix=identityMatrix;\}/);
 assert.match(code,/displayName=entry.Username.TrimStart\('@'\)/);
});
