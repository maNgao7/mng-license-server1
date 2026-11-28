'use strict';
globalThis.TikMngSpectatorCamera={create(options){
  const user=Process.getModuleByName('user32.dll');
  const key=new NativeFunction(user.getExportByName('GetAsyncKeyState'),'int16',['int']);
  const foreground=new NativeFunction(user.getExportByName('GetForegroundWindow'),'pointer',[]);
  const windowPid=new NativeFunction(user.getExportByName('GetWindowThreadProcessId'),'uint',['pointer','pointer']);
  const cursorPosition=new NativeFunction(user.getExportByName('GetCursorPos'),'int',['pointer']);
  const moveCursor=new NativeFunction(user.getExportByName('SetCursorPos'),'int',['int','int']);
  const clientRect=new NativeFunction(user.getExportByName('GetClientRect'),'int',['pointer','pointer']);
  const clientToScreen=new NativeFunction(user.getExportByName('ClientToScreen'),'int',['pointer','pointer']);
  const pidBuffer=Memory.alloc(4);
  const cursorBuffer=Memory.alloc(8);
  const rectBuffer=Memory.alloc(16);
  const centerBuffer=Memory.alloc(8);
  const idleMouse=[0,0];
  let mode='free',followSide=null,zoomSteps=0,lastSample=null,lastOutput='';
  let waitingPoint=null,waitingId=null;
  const emptyRingRadius=options.emptyRingRadius??11.5;
  let freeView=null,ringView=null,followView=null,cursorCenter=null,frameAt=0,wheelDolly=0,lastUnzoomed=null;
  let focusDepth=emptyRingRadius;
  let stopped=false,lastPose=null,cursorHidden=false,savedCursor=null,restoringCursor=false;
  const previousKeys=new Map();
  let setCursor=null,cursorHook=null;
  const converter=options.toWorld;
  const validPoint=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
  const visibility=()=>options.getVisibility?options.getVisibility():[true,true];
  const worldHeads=()=>{
    const heads=options.getFramingHeads?.()??options.getHeads?.(),visible=visibility();
    return [0,1].map(side=>{
      if(visible?.[side]!==true||!validPoint(heads?.[side]))return null;
      const point=converter?converter(heads[side].slice(),side):null;
      return validPoint(point)?point:null;
    });
  };
  const normalize=v=>{const n=Math.hypot(...v);return n>1e-8?v.map(x=>x/n):[0,0,1];};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const viewForward=([x,y,z,w])=>[-2*(x*z+y*w),-2*(y*z-x*w),2*(x*x+y*y)-1];
  const smooth=(current,target,elapsed,speed)=>current+(target-current)*(1-Math.exp(-speed*elapsed));
  function adjustZoom(delta){zoomSteps=Math.max(-7,Math.min(10,zoomSteps+delta));return{zoomSteps};}
  function lookRotation(eye,target){
    const z=normalize(eye.map((v,i)=>v-target[i])),x=normalize(cross([0,1,0],z)),y=cross(z,x);
    const m=[x[0],y[0],z[0],x[1],y[1],z[1],x[2],y[2],z[2]],trace=m[0]+m[4]+m[8];
    let q;
    if(trace>0){const s=Math.sqrt(trace+1)*2;q=[(m[7]-m[5])/s,(m[2]-m[6])/s,(m[3]-m[1])/s,s/4];}
    else if(m[0]>m[4]&&m[0]>m[8]){const s=Math.sqrt(1+m[0]-m[4]-m[8])*2;q=[s/4,(m[1]+m[3])/s,(m[2]+m[6])/s,(m[7]-m[5])/s];}
    else if(m[4]>m[8]){const s=Math.sqrt(1+m[4]-m[0]-m[8])*2;q=[(m[1]+m[3])/s,s/4,(m[5]+m[7])/s,(m[2]-m[6])/s];}
    else{const s=Math.sqrt(1+m[8]-m[0]-m[4])*2;q=[(m[2]+m[6])/s,(m[5]+m[7])/s,s/4,(m[3]-m[1])/s];}
    return normalize(q);
  }
  function ownForeground(){
    const hwnd=foreground();
    if(hwnd.isNull())return null;
    windowPid(hwnd,pidBuffer);
    return pidBuffer.readU32()===Process.id?hwnd:null;
  }
  const pressed=code=>(key(code)&0x8000)!==0;
  function cursorInClient(hwnd){
    if(!hwnd||!clientRect(hwnd,rectBuffer)||!cursorPosition(cursorBuffer))return false;
    centerBuffer.writeS32(0);centerBuffer.add(4).writeS32(0);
    if(!clientToScreen(hwnd,centerBuffer))return false;
    const x=cursorBuffer.readS32()-centerBuffer.readS32(),y=cursorBuffer.add(4).readS32()-centerBuffer.add(4).readS32();
    return x>=0&&y>=0&&x<rectBuffer.add(8).readS32()&&y<rectBuffer.add(12).readS32();
  }
  function restoreCursor(){
    if(cursorHidden&&setCursor&&savedCursor&&!savedCursor.isNull()&&ownForeground()){
      restoringCursor=true;
      try{setCursor(savedCursor);}finally{restoringCursor=false;}
    }
    cursorHidden=false;savedCursor=null;
  }
  function hideCursor(hwnd){
    if(!setCursor||!hwnd||cursorHidden||!cursorInClient(hwnd))return;
    savedCursor=setCursor(ptr(0));cursorHidden=true;
  }
  // SetCursor is scoped to this game's client and foreground window. Do not use
  // ShowCursor's display counter, ClipCursor or change a system cursor shape.
  try{
    const address=user.getExportByName('SetCursor');
    setCursor=new NativeFunction(address,'pointer',['pointer']);
    cursorHook=Interceptor.attach(address,{onEnter(args){
      if(stopped||restoringCursor||!options.isReady())return;
      const hwnd=ownForeground();
      if(!cursorInClient(hwnd))return;
      if(!args[0].isNull())savedCursor=args[0];
      args[0]=ptr(0);cursorHidden=true;
    }});
  }catch{setCursor=null;}
  function mouseLook(hwnd){
    if(!hwnd||!clientRect(hwnd,rectBuffer)||!cursorPosition(cursorBuffer)){cursorCenter=null;return idleMouse;}
    const width=rectBuffer.add(8).readS32(),height=rectBuffer.add(12).readS32();
    if(width<2||height<2){cursorCenter=null;return idleMouse;}
    centerBuffer.writeS32(Math.floor(width/2));centerBuffer.add(4).writeS32(Math.floor(height/2));
    if(!clientToScreen(hwnd,centerBuffer)){cursorCenter=null;return idleMouse;}
    const x=centerBuffer.readS32(),y=centerBuffer.add(4).readS32();
    const dx=cursorBuffer.readS32()-x,dy=cursorBuffer.add(4).readS32()-y;
    const stable=cursorCenter?.[0]===x&&cursorCenter?.[1]===y;
    if((dx||dy)&&(!foreground().equals(hwnd)||!moveCursor(x,y))){cursorCenter=null;return idleMouse;}
    if(!stable){cursorCenter=[x,y];return idleMouse;}
    return [Math.max(-100,Math.min(100,dx)),Math.max(-100,Math.min(100,dy))];
  }
  function overview(camera,heads,elapsed){
    const subjects=heads.filter(Boolean),[a,b]=subjects;
    const dx=b?b[0]-a[0]:0,dz=b?b[2]-a[2]:0,separation=Math.hypot(dx,dz);
    const previous=ringView?.side??normalize([4.65,0,6.05]);
    let side=separation>.35?[-dz/separation,0,dx/separation]:previous;
    if(side.reduce((sum,value,i)=>sum+value*previous[i],0)<0)side=side.map(value=>-value);
    const center=b?a.map((value,i)=>(value+b[i])/2):a?.slice()
      ??(validPoint(options.ringCenter)?options.ringCenter.slice():[0,1.1,0]);
    const count=subjects.length;
    const radius=count===0?emptyRingRadius:Math.max(7.8,separation*.7/(Math.tan(camera.fov/2)*Math.min(1,camera.aspect))+1.4);
    if(!ringView||ringView.count!==count)ringView={side,center,radius,count};
    ringView.side=normalize(ringView.side.map((value,i)=>smooth(value,side[i],elapsed,3.2)));
    ringView.center=ringView.center.map((value,i)=>smooth(value,center[i],elapsed,6));
    ringView.radius=smooth(ringView.radius,Math.min(36,radius),elapsed,4);
    const elevation=Math.max(2.75,ringView.radius*(count===0?.48:.3));
    const position=ringView.center.map((value,i)=>value+ringView.side[i]*ringView.radius+(i===1?elevation:0));
    const target=ringView.center.map((value,i)=>value-(i===1?.5:0));
    return aimedView(camera,position,target);
  }
  function aimedView(camera,position,target){
    focusDepth=Math.hypot(...target.map((value,i)=>value-position[i]));
    return {...camera,position,rotation:lookRotation(position,target)};
  }
  function freePose(camera){
    const [x,y,z]=viewForward(camera.rotation);
    return {position:[...camera.position],yaw:Math.atan2(x,-z),pitch:Math.asin(Math.max(-1,Math.min(1,y)))};
  }
  function fly(camera,hwnd,elapsed){
    const axis=(positive,negative)=>hwnd ? Number(pressed(positive))-Number(pressed(negative)) : 0;
    const mouse=mouseLook(hwnd);
    const yaw=freeView.yaw+=axis(39,37)*elapsed*1.2+mouse[0]*.004;
    const pitch=freeView.pitch=Math.max(-1.44,Math.min(1.44,freeView.pitch+axis(38,40)*elapsed*1.2-mouse[1]*.004));
    const forward=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
    const right=[Math.cos(yaw),0,Math.sin(yaw)];
    const speed=elapsed*(hwnd&&pressed(16)?6:2.7);
    const depth=axis(87,83),strafe=axis(68,65),height=axis(32,17)+axis(81,67);
    freeView.position=freeView.position.map((value,i)=>Math.max(i===1?.45:-42,Math.min(i===1?26:42,
      value+speed*(depth*forward[i]+strafe*right[i]+(i===1?height:0)))));
    const position=freeView.position;
    return {...camera,position,rotation:lookRotation(position,position.map((value,i)=>value+forward[i]))};
  }
  const wheelHook=Interceptor.attach(user.getExportByName('DispatchMessageW'),{onEnter(args){
    if(stopped||args[0].add(8).readU32()!==0x20a||!options.isReady()||!ownForeground())return;
    const delta=(args[0].add(16).readS32()>>16)/120;
    if(delta){adjustZoom(delta);this.filtered=args[0].add(8);this.filtered.writeU32(0);}
  },onLeave(){if(this.filtered)this.filtered.writeU32(0x20a);}});
  const observer=TikMngNativeCamera.observe({expectedPid:Process.id,verifiedBuildSha256:options.hash,
    getHeads:options.getHeads,toWorld:converter ? (v,side)=>converter(v,side) : undefined,
    getBacks:options.getBacks,getVisibility:options.getVisibility,
    updateNative(p,camera){
      if(!options.isReady())return camera;
      const now=Date.now(),elapsed=frameAt?Math.max(0,Math.min(.05,(now-frameAt)/1000)):0;
      // Multiple helper invocations in one clock tick reapply the authoritative
      // pose. Never poll/warp the cursor twice or integrate movement twice.
      if(lastPose&&now===frameAt){writePose(p,lastPose);return{...camera,...lastPose};}
      frameAt=now;
      const hwnd=ownForeground();
      const heads=worldHeads();
      lastUnzoomed??=camera;
      const edges=new Map();
      for(const code of [32,70,36,69]){
        const down=!!hwnd&&pressed(code);
        edges.set(code,down&&!previousKeys.get(code));previousKeys.set(code,down);
      }
      if(edges.get(36))setMode('ring');
      else if(edges.get(32)||edges.get(70))setMode('free');
      else if(edges.get(69)&&mode!=='queue'){try{follow();}catch{/* No visible crosshair target; keep the current view. */}}
      if(!hwnd){cursorCenter=null;restoreCursor();}
      if(mode==='follow'&&!heads[followSide])setMode('ring');
      if(mode==='ring')camera=overview(camera,heads,elapsed);
      if(mode==='free'){
        freeView??=freePose(overview(camera,heads,elapsed));
        camera=fly(camera,hwnd,elapsed);
      }
      if(hwnd){
        if(cursorHidden&&!cursorInClient(hwnd))restoreCursor();
        else hideCursor(hwnd);
      }
      if(mode==='follow'){
        const head=heads[followSide],other=heads[1-followSide];
        const facingPoint=other??options.ringCenter??[0,0,0];
        const direction=[facingPoint[0]-head[0],0,facingPoint[2]-head[2]];
        const forward=Math.hypot(direction[0],direction[2])>.1?normalize(direction):(followView?.forward??[0,0,-1]);
        const right=cross(forward,[0,1,0]);
        const separation=other?Math.hypot(other[0]-head[0],other[2]-head[2]):0;
        const distance=Math.max(6.2,separation*.85+3.2);
        const eye=head.map((v,i)=>v-forward[i]*distance+right[i]*2.4+(i===1?1.45:0));
        const target=head.map((v,i)=>v+forward[i]*(other?separation*.4:.5)+(i===1?-.5:0));
        if(!followView)followView={eye,target,forward};
        followView.forward=forward;
        followView.eye=followView.eye.map((value,i)=>smooth(value,eye[i],elapsed,10));
        followView.target=followView.target.map((value,i)=>smooth(value,target[i],elapsed,10));
        camera=aimedView(camera,followView.eye,followView.target);
      }
      if(mode==='queue'&&waitingPoint){
        const center=options.ringCenter??[0,0,0];
        const direction=normalize([waitingPoint[0]-center[0],0,waitingPoint[2]-center[2]]);
        const eye=waitingPoint.map((v,i)=>v+direction[i]*4+(i===1?1.0:0));
        if(!followView)followView={eye:camera.position.slice(),target:waitingPoint.slice()};
        followView.eye=followView.eye.map((v,i)=>smooth(v,eye[i],elapsed,7));
        camera=aimedView(camera,followView.eye,waitingPoint);
      }
      lastUnzoomed=camera;
      const held=!!hwnd&&pressed(2);
      const forward=viewForward(camera.rotation);
      // A manual camera must never move in response to a fighter's animation or
      // a fighter crossing the frustum. Wheel/RMB still dolly along its own axis.
      const subjects=mode==='free'?[]:heads.filter(Boolean);
      const contacts=options.getContacts?.(),floor=options.getFloor?.();
      const feet=mode==='free'?[]:heads.flatMap((head,side)=>{
        if(!head)return [];
        const pair=contacts?.[side];
        if(pair?.length===2&&pair.every(validPoint))return pair;
        return [[head[0],Number.isFinite(floor)?floor:Math.max(.12,head[1]-1.5),head[2]]];
      });
      wheelDolly=TikMngNativeCamera.zoomDolly({camera,forward,subjects,feet,zoomSteps,follow:mode==='follow',current:wheelDolly,elapsed});
      const dolly=held?TikMngNativeCamera.heldZoomDolly(camera,forward,focusDepth,wheelDolly):wheelDolly;
      camera={...camera,position:camera.position.map((value,i)=>value+forward[i]*dolly)};
      lastPose={position:camera.position.slice(),rotation:camera.rotation.slice()};
      writePose(p,lastPose);
      return camera;
    },
    onSample(value){
      lastSample=value;
      const ready=!!value.camera&&value.status!=='blocked'&&options.isReady();
      const heads=[0,1].map(side=>{
        const head=value.anchors?.[side];
        if(!ready||!head?.world)return null;
        const marker=TikMngNativeCamera.projectWorld([head.world[0],head.world[1]+.29,head.world[2]],value.camera);
        const anchor=marker.inViewport?marker:(head.inViewport?head:null);
        return anchor?{x:Math.round(anchor.viewport[0]*2000)/2000,y:Math.round(anchor.viewport[1]*2000)/2000,visible:true}:null;
      });
      const camera=value.camera;
      const sceneView=ready?{position:camera.position,rotation:camera.rotation,scale:camera.scale,
        fov:camera.fov,aspect:camera.aspect,floor:options.getFloor?.()??null,
        fighters:(value.anchors??[]).map(anchor=>anchor?.world??null),contacts:options.getContacts?.()??null}:null;
      const state={heads,backs:ready?(value.backs??[null,null]):[null,null],sceneView,camera:{mode,followSide,waitingId,zoomSteps,ready}};
      const signature=JSON.stringify(state);
      if(signature!==lastOutput){lastOutput=signature;options.onSample?.(state);}
    },
  });
  function writePose(p,camera){
    camera.rotation.forEach((v,i)=>p.transform.add(i*4).writeFloat(v));
    camera.position.forEach((v,i)=>p.transform.add(0x10+i*4).writeFloat(v));
  }
  function setMode(value){
      if(!['free','ring'].includes(value))throw new Error('Geçersiz kamera.');
      if(stopped)throw new Error('Kamera kapandı.');
      if(mode===value)return{mode};
      if(value==='free'&&mode!=='free'){
        const camera=lastUnzoomed;
        if(!camera)throw new Error('Kamera henüz hazır değil.');
        freeView=freePose(camera);
      }
      if(value==='ring')ringView=null;
      mode=value;followSide=null;waitingPoint=null;waitingId=null;followView=null;cursorCenter=null;
      lastPose=null;
      return{mode};
  }
  function follow(value){
      if(stopped)throw new Error('Kamera kapandı.');
      if(value!=null){
        if(!validPoint(value.point)||value.point.some(v=>Math.abs(v)>100)||typeof value.waitingId!=='string'||!value.waitingId)throw new Error('Geçersiz bekleyen kişi.');
        waitingPoint=value.point.slice();waitingId=value.waitingId;
        mode='queue';followSide=null;followView=null;cursorCenter=null;lastPose=null;
        return{mode,waitingId};
      }
      if(!lastSample?.anchors?.length||Date.now()-lastSample.at>300)throw new Error('Oyuncu konumu henüz hazır değil.');
      const visible=visibility();
      const candidates=lastSample.anchors.filter(a=>a&&visible?.[a.side]===true&&a.viewport).map(a=>{
        const body=TikMngNativeCamera.projectWorld([a.world[0],a.world[1]-.65,a.world[2]],lastSample.camera);
        const aX=a.viewport[0],aY=a.viewport[1],bX=body.viewport?.[0]??aX,bY=body.viewport?.[1]??aY;
        const dx=bX-aX,dy=bY-aY;
        const t=Math.max(0,Math.min(1,((.5-aX)*dx+(.5-aY)*dy)/Math.max(1e-6,dx*dx+dy*dy)));
        return {side:a.side,d:Math.hypot(aX+dx*t-.5,aY+dy*t-.5)};
      }).sort((a,b)=>a.d-b.d);
      if(!candidates.length||candidates[0].d>.24)throw new Error('Kameranın ortasını bir boksöre yöneltin.');
      if(mode==='follow'&&followSide===candidates[0].side)return{mode,followSide};
      waitingPoint=null;waitingId=null;followSide=candidates[0].side;mode='follow';followView=null;cursorCenter=null;lastPose=null;return{mode,followSide};
  }
  return{
    setMode,follow,
    zoom(delta){if(!Number.isFinite(delta))throw new Error('Geçersiz yakınlaştırma.');return adjustZoom(Math.max(-4,Math.min(4,delta)));},
    sample(){return lastSample;},
    stop(){if(stopped)return;stopped=true;restoreCursor();cursorHook?.detach();wheelHook.detach();observer.stop();},
  };
}};
