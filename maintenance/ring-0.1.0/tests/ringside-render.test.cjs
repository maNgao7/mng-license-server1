'use strict';

// Run directly against the source, in an empty Electron window with a private
// profile. The normal desktop entry point and the generated bundle are never loaded.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const electronPath = path.resolve(root, '../../frog-river/node_modules/electron');
const toolsRoot = 'D:/TikMnG-GitHub-Araclari';

async function exercise() {
  const { app, BrowserWindow } = require('electron');
  app.disableHardwareAcceleration();
  await app.whenReady();
  const window = new BrowserWindow({ width:960, height:600, useContentSize:true, show:false });
  await window.loadURL('data:text/html,<style>*{margin:0}body{background:%23111921}</style><canvas></canvas>');
  const esbuild = require(path.join(toolsRoot,'runtime/npm-tools/node_modules/esbuild'));
  const source = fs.readFileSync(path.join(root,'spectator/ringside.mjs'),'utf8');
  const compiled = esbuild.buildSync({ stdin:{ contents:source+
    "\nimport {Scene,Matrix4} from 'three'; import {createQueueInstances} from './queue-model.mjs';" +
    '\nwindow.probe = {cameraProjection,nativeMasks,maskInFront,point,boxerSprite,queueSeats,RING_X,RING_Z,HALF_RING,DECK_HALF,Scene,Matrix4,readBoxerMesh,createQueueInstances};',resolveDir:path.join(root,'spectator') },
    alias:{three:path.join(toolsRoot,'three-r170/src/Three.js')},bundle:true,write:false,format:'iife' });
  const run = code => window.webContents.executeJavaScript(code);
  await run(compiled.outputFiles[0].text);
  const results = await run('('+browserChecks.toString()+')()');
  assert.deepEqual(results.errors,[]);
  assert.ok(results.warmP95>=0);
  console.log('Source renderer passed; 5,000-entry warm draw p95 = %s ms; visible = %s',
    results.warmP95.toFixed(1),results.visible);
  // Optional out-of-tree image for visual inspection of the tested poses/views.
  if (process.env.RINGSIDE_PREVIEW_PNG) {
    fs.writeFileSync(process.env.RINGSIDE_PREVIEW_PNG,Buffer.from(results.preview,'base64'));
  }
  window.destroy();
}

function browserChecks() {
  const errors=[];
  const check=(value,message)=>{ if (!value) errors.push(message); };
  const canvas=document.querySelector('canvas'), ctx=canvas.getContext('2d');
  const {cameraProjection,nativeMasks,maskInFront,point,boxerSprite}=window.probe;
  const queue=Array.from({length:5000},(_,i)=>({nickname:'Viewer '+(i+1),coins:5000-i}));
  const view={floor:-2.4,position:[0,3,12],rotation:[-.09,0,0,Math.sqrt(1-.09**2)],scale:[1,1,1],fov:.8,aspect:1.6};
  const tile=document.createElement('canvas');
  tile.id='phone-flash'; tile.className='phone-flash'; tile.width=16; tile.height=16; tile.hidden=true;
  document.body.append(tile);
  const random=Math.random;
  Math.random=()=>.5;
  const display=window.createRingside(canvas);
  Math.random=random;
  const ranks=new Set(), scores=new Set();
  const text=ctx.fillText.bind(ctx);
  ctx.fillText=(s,...args)=>{ if(s.startsWith('#')) ranks.add(s); if(s.endsWith(' FPS')) scores.add(s); text(s,...args); };
  let frame=null,timer=null,guardTick=null,now=20000;
  window.setInterval=(cb,delay)=>{check(delay>=32,'warmup has a bounded frame rate');guardTick=cb;return 2;};
  window.clearInterval=()=>{guardTick=null;};
  window.requestAnimationFrame=cb=>{frame=cb;return 1;};
  window.cancelAnimationFrame=()=>{frame=null;};
  window.setTimeout=(cb,delay)=>{timer={cb,delay};return 1;};
  window.clearTimeout=()=>{timer=null;};
  Date.now=()=>now;
  function flush() {
    check(!!frame,'expected draw');
    const cb=frame; frame=null; cb?.();
  }
  function update(v,q,settings) { display.update(v,q,settings);flush(); }
  const preview=document.createElement('canvas');
  preview.width=960;preview.height=600;
  const sheet=preview.getContext('2d');
  sheet.fillStyle='#252732';sheet.fillRect(0,0,960,600);
  const snap=(x,y)=>sheet.drawImage(canvas,x,y,480,300);

  update(view,queue,{flashes:false});
  const visible=Number(canvas.dataset.visibleBoxers);
  check(visible>=8 && visible<320,'bounded visible count '+visible);
  check(ranks.size===visible && ranks.has('#1') && !ranks.has('#0'),'one global rank per visible head');
  check(scores.has('5.000 FPS'),'contribution retained');
  check(typeof guardTick==='function','visible boxers warm up with a stationary camera');
  guardTick();flush();
  check(!timer && !frame && tile.hidden,'disabled effect has no idle work');
  snap(0,0);
  display.update({...view},queue,{quality:'high',flashes:true});
  check(!frame && timer?.delay===220,'enabling the shutter does not redraw the queue');
  const tileAlpha=()=>tile.getContext('2d').getImageData(0,0,36,36).data.filter((v,i)=>i%4===3&&v>0);
  const emptyQueue=[];
  for(let i=1;i<=16;i++){
    const sector=(32+i*9)%64, angle=(sector+.5)*Math.PI/32, yaw=angle+Math.PI;
    const levelView={...view,position:[window.probe.RING_X,view.floor+5.8,window.probe.RING_Z],
      rotation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)]};
    update(levelView,emptyQueue,{flashes:true});
    timer.cb();
    const alpha=tileAlpha();
    check(!tile.hidden && alpha.length>65 && alpha.length<800 && Math.max(...alpha)===255,
      'bright localized shutter in world sector '+sector);
    const visibleLights=[...document.querySelectorAll('.phone-flash')].filter(light=>!light.hidden);
    check(visibleLights.length>=3 && visibleLights.length<=12,'several local lights share a burst');
    check(new Set(visibleLights.map(light=>light.style.transform)).size===visibleLights.length,'separate phones in the crowd');
    check(timer.delay>=420 && timer.delay<=680 && !frame,'crowd burst does not redraw the queue');
    const x=Number(tile.style.transform.match(/translate\((-?[\d.]+)/)?.[1]);
    const shifted={...levelView,position:[levelView.position[0]+2*Math.cos(yaw),levelView.position[1],
      levelView.position[2]-2*Math.sin(yaw)]};
    update(shifted,emptyQueue,{flashes:true});
    const moved=Number(tile.style.transform.match(/translate\((-?[\d.]+)/)?.[1]);
    check(!tile.hidden && moved<x-10,'shutter stays in world space when camera slides');
    update({...levelView,position:[levelView.position[0],view.floor-1,levelView.position[2]]},emptyQueue,{flashes:true});
    check(tile.hidden || !tileAlpha().length,'native mat hides the flash from below');
    for (const light of document.querySelectorAll('.phone-flash')) light.getAnimations()[0]?.finish();
    check(!frame,'a camera flash has no ongoing scene draw');
  }
  const distant={...view,position:[0,4,34]};
  let previousCount=Infinity;
  for (const quality of ['high','medium','low']) {
    update(distant,queue,{quality,flashes:false});
    const count=Number(canvas.dataset.visibleBoxers);
    check(!timer && !frame && count>0 && count<previousCount,'quality distance / idle '+quality);
    previousCount=count;
  }
  const quiet={quality:'high',flashes:false};
  update(view,[],quiet);
  check(!guardTick,'empty queue stops warmup updates');
  for(const x of [0,6,-12,20]){
    update({...view,position:[x,3,8]},[],quiet);
    check(canvas.hidden && !ctx.getImageData(0,0,canvas.width,canvas.height).data.some(Boolean),
      'empty native background stays unobstructed as the camera moves');
  }
  const onlyLeft=queue.slice(0,8);
  const rolled={...view,position:[7.0,4.55,9.12],rotation:[-.151,.312,.052,.936],fighters:[[-1,.9,0],[1,.9,0]]};
  update(rolled,onlyLeft,quiet);snap(480,0);

  // The final hit is presented by the game, even while both head anchors are moving.
  const close={...rolled,position:[0,.85,7.3],fighters:[[-1,.3,0],[1,.9,0]]};
  update(close,[],quiet);snap(0,300);
  check(canvas.dataset.visibleBoxers==='0' && !timer && !frame,'no substitute fighters over the native ending');

  const {queueSeats,RING_X,RING_Z,HALF_RING,DECK_HALF}=window.probe;
  const scene=new window.probe.Scene(), group=window.probe.createQueueInstances(scene,queueSeats.length);
  const entries=queueSeats.slice(0,3).map(({x,z,heading},index)=>({foot:point(x,-2.4,z),index,heading}));
  group.place(entries);
  const [red,blue,shadow]=scene.children;
  const nativeKits=[0,1].map(window.probe.readBoxerMesh);
  for(const kit of nativeKits){
    let moving=0;
    for(let i=0;i<kit.position.length;i+=3) {
      const motion=Math.hypot(...kit.sway.subarray(i,i+3))+Math.hypot(...kit.dip.subarray(i,i+3));
      if(kit.position[i+1]<.025)check(motion===0,'shoe soles stay planted through warmup');
      else if(motion>.2)moving++;
    }
    check(moving>100,'upper body and gloves move while waiting');
  }
  check(red.geometry!==blue.geometry && red.count===2 && blue.count===1,'independent poses shared within each kit');
  for (const [side,mesh] of [red,blue].entries()) {
    const kit=nativeKits[side];
    check(kit.parts===23 && mesh.geometry.index.count===1692*3,'21 block parts and two original round gloves');
    const ys=kit.position.filter((_,i)=>i%3===1);
    check(Math.min(...ys)===0 && Math.abs(Math.max(...ys)-kit.height)<.001 && kit.height>3.8 &&
      Math.abs(kit.crown[1]-kit.height)<.001,'sole, native scale and head badge stay aligned');
  }
  const matrix=new window.probe.Matrix4();red.getMatrixAt(1,matrix);
  check(Math.abs(matrix.elements[12]-entries[2].foot.x)<.001 && Math.abs(matrix.elements[13]+2.4)<.001 &&
    Math.abs(matrix.elements[14]-entries[2].foot.z)<.001 && shadow.count===3,'third boxer stands in its queue slot on the deck');
  group.place([]);check(scene.children.every(mesh=>mesh.count===0),'leaving ranks clear both kits and shadows');
  group.dispose();check(scene.children.length===0,'queue GPU resources released');
  const first=queueSeats.slice(0,4);
  check(first.every((p,i)=>p.z===first[0].z && (!i||p.x>first[i-1].x)),'consecutive ranks start side by side');
  for (const [i,p] of queueSeats.entries()) {
    const kit=nativeKits[i%2], sn=Math.sin(p.heading), cs=Math.cos(p.heading);
    for(let k=0;k<kit.position.length;k+=3) {
      const vx=p.x+kit.position[k]*cs+kit.position[k+2]*sn;
      const vz=p.z-kit.position[k]*sn+kit.position[k+2]*cs;
      if((Math.abs(vx-RING_X)<HALF_RING+.45 && Math.abs(vz-RING_Z)<HALF_RING+.45) ||
          Math.max(Math.abs(vx-RING_X),Math.abs(vz-RING_Z))>=DECK_HALF) {
        check(false,'native boxer intersects ropes or leaves the deck at rank '+i);break;
      }
    }
    check(!i || Math.hypot(p.x-queueSeats[i-1].x,p.z-queueSeats[i-1].z)<4.6,'adjacent ranks '+i);
  }
  // Every model fits inside its measured rectangle. The separating axis
  // check also covers corners and adjacent waiting lanes.
  const footprints=queueSeats.map((seat,i)=>{
    const position=nativeKits[i%2].position;
    const rx=Math.max(...position.filter((_,j)=>j%3===0).map(Math.abs));
    const rz=Math.max(...position.filter((_,j)=>j%3===2).map(Math.abs));
    const sn=Math.sin(seat.heading),cs=Math.cos(seat.heading);
    return {x:seat.x,z:seat.z,axes:[[cs,-sn],[sn,cs]],radius:[rx,rz]};
  });
  for(let i=0;i<footprints.length;i++)for(let j=0;j<i;j++){
    const a=footprints[i],b=footprints[j];
    const clear=[...a.axes,...b.axes].some(([x,z])=>{
      const width=k=>k.radius.reduce((sum,v,n)=>sum+v*Math.abs(k.axes[n][0]*x+k.axes[n][1]*z),0);
      return Math.abs((a.x-b.x)*x+(a.z-b.z)*z)>width(a)+width(b);
    });
    check(clear,'native boxer footprints overlap at ranks '+(j+1)+' and '+(i+1));
  }
  ranks.clear(); let reads=0;
  const watched=new Proxy(queue,{get(target,key){if (/^\d+$/.test(String(key))) reads++;return target[key];}});
  update(view,watched,quiet);
  check(reads<=queueSeats.length && reads<320 && ranks.has('#1'),'bounded floor queue reads: '+reads);
  const tail=queueSeats.at(-1), tailView={...view,position:[tail.x,2,tail.z+10]};
  scores.clear(); ranks.clear();
  update(tailView,queue.slice(1),quiet);
  check(ranks.has('#'+queueSeats.length) && scores.has((5000-queueSeats.length).toLocaleString('tr-TR')+' FPS'),
    'next waiting profile moves into the last floor slot on promotion');

  // Exercise the actual Canvas clip, at known test pixels. A sheet behind
  // a native solid must leave the native pixel transparent. In front it must survive.
  const pad=document.createElement('canvas');pad.width=400;pad.height=250;
  const g=pad.getContext('2d',{willReadFrequently:true});
  const nearRope=RING_Z+HALF_RING, farRope=RING_Z-HALF_RING;
  const level={...view,floor:0,position:[RING_X,1.5,nearRope+3],rotation:[0,0,0,1],fov:1};
  function ink(v,world,depthBias) {
    const cam=cameraProjection(v,pad.width,pad.height), p=cam.project(point(...world));
    if (!p) throw Error('probe behind eye');
    const q=1/(1/p.q+depthBias);
    const b={left:p.x-2,right:p.x+2,top:p.y-2,bottom:p.y+2,nearQ:q,farQ:q};
    g.clearRect(0,0,pad.width,pad.height);g.save();
    maskInFront(g,cam,nativeMasks(cam,v),b,()=>q);
    g.fillRect(0,0,pad.width,pad.height);g.restore();
    return g.getImageData(Math.floor(p.x),Math.floor(p.y),1,1).data[3];
  }
  check(ink(level,[RING_X,1.23,nearRope],.3)===0,'near rope masks rear sprite');
  check(ink(level,[RING_X,1.23,nearRope],-.3)===255,'sprite in front of rope');
  check(ink(level,[RING_X,1.61,nearRope],.3)===255,'gap between ropes is open');
  check(ink(level,[0,1.5,7.2],.3)===255,'no phantom rope at the physics origin');
  const reversed={...level,position:[RING_X,1.5,farRope-4],rotation:[0,1,0,0]};
  check(ink(reversed,[RING_X,1.23,farRope],.3)===0,'opposite side rope');
  const above={...level,position:[0,10,0],rotation:[-Math.SQRT1_2,0,0,Math.SQRT1_2]};
  check(ink(above,[0,0,0],.3)===0 && ink(above,[0,0,0],-.3)===255,'overhead mat depth');
  const deckView={...above,position:[12,10,0]};
  check(ink(deckView,[12,0,0],.3)===0 && ink(deckView,[12,0,0],-.3)===255,
    'native wooden deck covers the concrete below and shows the waiting boxer above');
  const inside={...level,position:[0,2.8,4],fighters:[[0,2.8,0],null]};
  check(ink(inside,[0,2.8,0],.4)===0 && ink(inside,[0,2.8,0],-.5)===255,'fighter occludes only at closer depth');
  const across={...level,position:[RING_X+4,1.23,nearRope],rotation:[0,Math.SQRT1_2,0,Math.SQRT1_2]};
  check(ink(across,[RING_X,1.23,nearRope],1)===0,'rope crossing camera near plane');

  const alphaBounds=pose=>{
    const {tile}=pose, data=tile.getContext('2d').getImageData(0,0,tile.width,tile.height).data;
    let l=tile.width,r=0,t=tile.height,b=0;
    for(let y=0;y<tile.height;y++) for(let x=0;x<tile.width;x++) if(data[(y*tile.width+x)*4+3]>30){
      l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
    }
    check(r>l && b>t && l>0 && t>0 && r<tile.width-1 && b<tile.height-1,'nonempty, uncropped pose');
    return {w:r-l,h:b-t};
  };
  for(const [i,yaw] of [0,Math.PI/2,Math.PI].entries()){
    const pose=boxerSprite(yaw,0,i%2,72), bounds=alphaBounds(pose);
    check(bounds.h>=138 && bounds.w<=bounds.h*1.08,'standing guard silhouette');
    sheet.drawImage(pose.tile,540+i*125,365);
  }
  alphaBounds(boxerSprite(.75,Math.PI/2,1,42));
  const times=[];
  for(let i=0;i<36;i++) {
    view.position[0]=Math.sin(i*.06)*.3;
    display.update(view,queue,quiet);
    const start=performance.now();flush();if(i>=8) times.push(performance.now()-start);
  }
  const warmP95=times.sort((a,b)=>a-b)[Math.floor(times.length*.95)];
  display.update(null,queue,null);
  check(canvas.hidden && !frame && !timer,'inactive view cancels work');
  display.dispose();
  check(document.querySelectorAll('.phone-flash').length===1 && tile.hidden,'flash tiles released');
  return {errors,visible,warmP95,preview:preview.toDataURL().split(',')[1]};
}

if (process.versions.electron) {
  const {app}=require('electron');
  exercise().then(()=>app.exit(0),error=>{console.error(error);app.exit(1);});
} else {
  require('node:test')('ringside source, camera depth, poses, ranks and idle budgets',async t=>{
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'ringside-source-'));
    t.after(()=>fs.rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:100}));
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
    const {stdout}=await require('node:util').promisify(require('node:child_process').execFile)(
      require(electronPath),[__filename,'--user-data-dir='+profile,'--mute-audio','--disable-background-networking'],
      {env,windowsHide:true,timeout:45000});
    assert.match(stdout,/Source renderer passed/);t.diagnostic(stdout.trim());
  });
}
