'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'../assets/audio');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));

test('three approved presentation recordings are hashed separately from native engines',()=>{
 const file=path.join(root,'startup-music.mp3');
 assert.ok(fs.statSync(file).size>10_000);
 const splash=fs.readFileSync(path.resolve(__dirname,'../splash.html'),'utf8');
 const desktop=fs.readFileSync(path.resolve(__dirname,'../desktop.cjs'),'utf8');
 assert.match(splash,/assets\/audio\/startup-music\.mp3/);
 assert.match(desktop,/OpeningVolume/);
 assert.deepEqual(manifest.files.map(item=>item.file),['startup-music.mp3','track-intro.wav','race-countdown.wav','spaceship-boost.wav','rocket-boost.wav']);
 for(const item of manifest.files)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,item.file))).digest('hex'),item.sha256);
 const bytes=fs.readFileSync(file);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.files[0].sha256);
});

test('manual countdown has no custom clip and native engine events remain in use',()=>{
 const plugin=fs.readFileSync(path.resolve(__dirname,'../src/Plugin.cs'),'utf8');
 const presentation=fs.readFileSync(path.resolve(__dirname,'../src/Presentation.cs'),'utf8');
 const audio=fs.readFileSync(path.resolve(__dirname,'../src/VehicleAudio.cs'),'utf8');
 const clips=fs.readFileSync(path.resolve(__dirname,'../src/PresentationClips.cs'),'utf8');
 const forward=fs.readFileSync(path.resolve(__dirname,'../src/ForwardSpaceship.cs'),'utf8');
 assert.match(plugin,/NativeCountdownStarted\(3\)/);
 assert.doesNotMatch(presentation,/PlayPresentationClip/);
 assert.doesNotMatch(clips+forward,/createSound|playSound/);
 assert.match(audio,/effects\.engineFmodInstance/);
 assert.doesNotMatch(audio,/createSound|playSound|setPitch/);
});
test('quick audio settings expose only current sound controls',()=>{
 const presentation=fs.readFileSync(path.resolve(__dirname,'../src/Presentation.cs'),'utf8');
 for(const name of ['Açılış müziği','Oyunun motor sesleri','Seyirci sesi'])assert.ok(presentation.includes(name));
 assert.doesNotMatch(presentation,/SoundSlider\([^\n]*"(?:Pist giriş sesi|Geri sayım sesi)"/);
});
