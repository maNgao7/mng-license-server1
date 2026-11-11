'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.resolve(__dirname,'../src',name),'utf8');
test('new participant camera yields to explicit follow, input and race start',()=>{
 const camera=read('CameraPresentation.cs'),control=read('CameraControl.cs'),plugin=read('Plugin.cs');
 assert.match(camera,/CameraPresentationPolicy.AllowJoin\(phase,startRequested,followed!=null/);
 assert.match(plugin,/entries.Add\(entry\);\s*RegisterResultsBoardParticipant\(entry\);\s*QueueJoinShowcase\(entry\)/);
 assert.match(control,/private void Follow\(ViewerCar entry\)[\s\S]*?CancelJoinShowcase\(false\)/);
 assert.match(plugin,/CancelJoinShowcase\(true\);/);
 assert.match(plugin,/mouse.delta.ReadValue\(\).sqrMagnitude>1/);
});
test('results orbit the actual first finisher with a collider-free crown and clean reset',()=>{
 const camera=read('CameraPresentation.cs'),round=read('RoundLifecycle.cs');
 assert.match(round,/BeginWinnerCelebration\(order\[0\]\)/);
 assert.match(round,/RaceEconomy.PodiumComplete\(required,finished.Length\)/);
 assert.match(round,/CompleteRound\(order,data,"manual-p"\)/);
 assert.match(camera,/phase=="podium"&&IsCarAlive\(celebrationWinner\)/);
 assert.match(camera,/winnerOrbitAngle\+travel\*\.34f/);
 assert.match(camera,/Vector3.Lerp\(winnerApproachStart,orbit,winnerCameraBlend\)\+lift/);
 assert.match(camera,/Quaternion.Slerp\(winnerApproachRotation,rotation,winnerCameraBlend\)/);
 assert.match(camera,/DrawPortrait\(celebrationWinner,/);
 assert.match(camera,/winnerCrown.transform.position=car.position/);
 assert.doesNotMatch(camera,/AddComponent<(?:BoxCollider|SphereCollider|Rigidbody)>|CreatePrimitive/);
 assert.match(round,/cameraReady=false;\s*ClearCinematicCamera\(\)/);
});
test('results show the actual 3D car with a compact corner HUD and no reference thumbnails',()=>{
 const round=read('RoundLifecycle.cs');
 const podium=round.slice(round.indexOf('private void DrawRoundPodium()'),round.indexOf('private void DrawRoundReset()'));
 assert.doesNotMatch(podium,/"vehicles\/"|ModelIds|new Rect\(-2000|portraitSize=first\?132/);
 assert.match(podium,/new Rect\(24,500,352,260\)/);
 const fov=Number(read('CameraPresentation.cs').match(/WinnerOrbitFov=(\d+)/)?.[1]);
 assert.ok(fov>=40&&fov<=55,'orbit keeps the winner in a close, wide-enough shot');
});
