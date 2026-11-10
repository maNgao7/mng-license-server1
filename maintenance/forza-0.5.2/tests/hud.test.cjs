'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawn}=require('node:child_process');
const sharp=require('../bridge/vendor/bridge/sdk.cjs').loadSharp();
const root=path.resolve(__dirname,'..');
test('dial artwork is high resolution with transparent corners',async()=>{
  const {data,info}=await sharp(path.join(root,'assets/speed-dial.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,512);assert.equal(info.height,512);
  assert.equal(data[3],0);assert.equal(data[(info.width-1)*4+3],0);
  assert.ok(data[(256*info.width+256)*4+3]>200);
});
test('cached portraits have circular alpha, not rectangular corners',async()=>{
  const files=await fs.readdir(path.join(root,'control/live/portraits'));
  assert.ok(files.length>0);
  for(const file of files.slice(0,8)){
    const {data,info}=await sharp(path.join(root,'control/live/portraits',file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width,info.height);
    for(const i of [0,info.width-1,(info.height-1)*info.width,info.width*info.height-1])assert.equal(data[i*4+3],0);
  }
});
test('live worker closes cleanly without connecting or making network requests',async()=>{
  await new Promise((resolve,reject)=>{
    const worker=spawn(process.execPath,[path.join(root,'bridge/service.cjs')],{cwd:root,stdio:['pipe','ignore','pipe']});
    const timeout=setTimeout(()=>{worker.kill();reject(Error('live-worker-close-timeout'));},5000);
    worker.on('error',reject);
    worker.on('exit',code=>{clearTimeout(timeout);try{assert.equal(code,0);resolve();}catch(e){reject(e);}});
    worker.stdin.end('{"command":"close"}\n');
  });
});

test('followed driver identity sits above the gauge and car labels stay fixed to their vehicles',async()=>{
 const code=await fs.readFile(path.join(root,'src/RacingHud.cs'),'utf8');
 assert.match(code,/DrawPortrait\(followed,new Rect\(x0-2,y0-49,36,36\)\)/);
 assert.match(code,/new Rect\(x0\+44,y0-56,160,29\)/);
 assert.match(code,/hudDriverName.fontSize>11/);
 assert.match(code,/WorldToScreenPoint\(target\)/);
 assert.match(code,/DrawPortrait\(entry,new Rect\(-size\/2,0,size,size\)\)/);
 assert.match(code,/OrderBy\(e=>e==followed\?0:1\)/);
 assert.match(code,/var identityScale=Mathf\.Lerp\(1f,\.30f,Mathf\.InverseLerp\(18f,100f,distance\)\)/);
 assert.match(code,/labelWidth=164,nameHeight=22,speedHeight=23/);
 assert.match(code,/var rim=Mathf\.Min\(3f,rect\.width\*\.08f\)/);
 assert.match(code,/var badgeY=y-\(size\+44\)\*identityScale/);
 assert.match(code,/var labelX=Mathf\.Clamp\(x,labelWidth\*identityScale\/2\+4,1276-labelWidth\*identityScale\/2\)/);
 assert.doesNotMatch(code,/IdentitySlots|occupiedIdentities|fallback\.OrderBy|BuildIdentitySlots/);
 assert.match(code,/renderedCarIdentities\.Add\(entry\.Username\)/);
 assert.doesNotMatch(code,/VehicleLabelOverlaps|visibleVehicleLabels/);
 assert.match(code,/ThenBy\(e=>e\.Slot\)\.ThenBy\(e=>e\.Username,StringComparer\.Ordinal\)/);
 assert.doesNotMatch(code,/HudLine\([^;]*target/i);
});

test('compact identities omit the @ prefix and live standings use clean single-pass text',async()=>{
 const code=await fs.readFile(path.join(root,'src/RacingHud.cs'),'utf8');
 const standings=await fs.readFile(path.join(root,'src/LiveStandings.cs'),'utf8');
 assert.match(code,/var displayName=entry.Username.TrimStart\('@'\)/);
 assert.match(code,/nameHeight\),displayName,hudName/);
 assert.doesNotMatch(code,/"@"\+entry.Username/);
 assert.match(standings,/Take\(10\)/);
 assert.match(standings,/width=180,rowHeight=27/);
 assert.match(standings,/if\(i==0\)DrawStandingsCrown/);
 assert.doesNotMatch(standings,/HudText\(/);
});

test('modeless ESC settings keep car identities and live speeds rendering',async()=>{
 const menu=await fs.readFile(path.join(root,'src/Menu.cs'),'utf8');
 assert.match(menu,/if\(!showPanel&&!trackMapOpen&&!IntroActive\)\s*\{[\s\S]*?DrawRacingHud\(scale\);/);
 assert.doesNotMatch(menu,/if\(!showPanel&&!trackMapOpen&&!IntroActive&&!quickSettingsOpen\)/);
});
