'use strict';
// Exact pinned native build only. The original game owns movement and contacts.
const gameModule=Process.getModuleByName('boxing.exe');
const updateAddress=gameModule.base.add(0x2953c40);
let started=false,ready=false,lastPublish=0,steps=0,waitingCalls=0,stopped=false,resumePhysics=false;
let standingTicks=0,lastSignature='';
let guardScanTicks=0;
const punches=[0,1].map(()=>({pending:0,pendingA:0,pendingB:0,control:7,until:0,nextAt:0,issued:0,awaitingContact:false,filtered:0}));
const seenPunches=new Set();
const nativeAllocate=new NativeFunction(gameModule.base.add(0x38a7fd0),'pointer',['uint','uint64']);
const windowsHeap=Process.getModuleByName('kernel32.dll');
const getHeap=new NativeFunction(windowsHeap.getExportByName('GetProcessHeap'),'pointer',[]);
const freeHeap=new NativeFunction(windowsHeap.getExportByName('HeapFree'),'int',['pointer','uint','pointer']);
const lastChannelHealth=[[Infinity,Infinity],[Infinity,Infinity]];
const nativeStunPeaks=[0,0];
// A commanded swing spends its damage once, including on a raised guard.
const scoredSwing=[0,0], ringHealth=[100,100];
let healthChanged=false;
const damagePerHit=15;
const finishGraceMs=75;
const punchMotionMs=350;
const punchRecoveryMs=100;

// Consecutive identical commands share a batch even for very large gift streaks.
// Keep the configured damage from the instant of the viewer action.
const orders=[[],[]],orderCursor=[0,0];
let finished=false,knockoutAt=0,winner=null;
let restoreBoxerStatus=false,boxerStatus=null;
const nativeRoundCleanup=new NativeFunction(gameModule.base.add(0x2994390),'void',['pointer']);
const refreshNativeSnapshot=new NativeFunction(gameModule.base.add(0x296f380),'void',['pointer','uint8']);
let nativePhysics=null,pendingStagedSample=false;
let cleanedStageVersion=-1;
function clearNativeInputHistory(base){
  // The stock input updater 297f190 stores press/absence durations in four
  // separate Rust HashMap<K,u32> tables. The referee cleanup does not own
  // these maps. Reset their plain scalar entries without freeing allocations,
  // changing hash seeds or replacing any pointer in a live Rust object.
  for(const offset of [0x2a00,0x2a40,0x2a98,0x2ad8]){
    const table=base.add(offset);
    const mask=table.add(8).readU64().toNumber();
    if(!Number.isSafeInteger(mask)||mask<0||mask>65535||((mask+1)&mask)!==0)
      throw new Error('Geçersiz yerel komut geçmişi tablosu.');
    if(mask>0){
      const controls=table.readPointer();
      controls.writeByteArray(new Uint8Array(mask+17).fill(255));
    }
    table.add(24).writeU64(0);
    table.add(16).writeU64(mask<8?mask:(mask+1)*7/8);
  }
}
function resetMatch(){
  started=false;finished=false;knockoutAt=0;winner=null;
  restoreBoxerStatus=true;
  punches.forEach(p=>Object.assign(p,{pending:0,pendingA:0,pendingB:0,until:0,nextAt:0,issued:0,awaitingContact:false}));
  lastChannelHealth.forEach(channels=>channels.fill(Infinity));
  scoredSwing.fill(0);ringHealth.fill(100);nativeStunPeaks.fill(0);healthChanged=true;
  for(let i=0;i<2;i++){orders[i].length=0;orderCursor[i]=0;}
}
function retainManualRound(game){
  if(!ready)return;
  if(stageDirty&&finished)resetMatch();
  if(!boxerStatus){
    if(game.add(0x9018).readU8()!==2)return;
    // The stock round restart writes state tick 1 and standing enum 0.
    // A snapshot from warmup has an unrelated state age.
    boxerStatus=[0,1].map(()=>new Uint8Array([1,0,0,0,0]));
  }
  // In the pinned build, referee enum 2 skips the stock countdown, round
  // results and replay scheduler (tick RVAs 295fb3b and 2961723), while the
  // original movement, AI and physics continue. TikMnG owns match results.
  // Keeping counters at zero is insufficient: a fall can finish a native
  // round inside one tick before an entry/exit hook can restore them.
  game.add(0x9108).writeU32(2);
  if(resumePhysics||(!started||finished)&&cleanedStageVersion!==stageVersion){
    nativeRoundCleanup(game);
    // Clear durations as well as held keys at each manual round boundary,
    // including P after warmup, so each input has a fresh press edge.
    for(let side=0;side<2;side++){
      const base=game.add(side*0x2e20);
      clearNativeInputHistory(base);
      base.add(0x2c68).writeU64(0);
      base.add(0x2c80).writeU64(0);
    }
    cleanedStageVersion=stageVersion;
  }
  if(restoreBoxerStatus){
    boxerStatus.forEach((status,side)=>{
      const base=game.add(side*0x2e20);
      base.add(0x2d30).writeByteArray(status);
    });
    restoreBoxerStatus=false;
  }

}
let desiredLineup=[false,false],visibleLineup=[false,false],stageDirty=true,stageVersion=0;
let rootDistance=null,bodyHeight=null,rawHeadWorld=[null,null],backs=[null,null],lastPhysicsRead=0;
let stagedHeads=[null,null];
const mujoco=Process.getModuleByName('mujoco.dll');
const toGlobal=new NativeFunction(mujoco.getExportByName('mj_local2Global'),'void',
  ['pointer','pointer','pointer','pointer','pointer','int','uint8']);
const zeroPosition=Memory.alloc(24),identityQuat=Memory.alloc(32),globalMatrix=Memory.alloc(72);
identityQuat.writeDouble(1);
const positionOutputs=[0,1,2,3].map(()=>Memory.alloc(24));
const stateSize=new NativeFunction(mujoco.getExportByName('mj_stateSize'),'int',['pointer','int']);
const getState=new NativeFunction(mujoco.getExportByName('mj_getState'),'void',['pointer','pointer','pointer','int']);
const setState=new NativeFunction(mujoco.getExportByName('mj_setState'),'void',['pointer','pointer','pointer','int']);
const kinematics=new NativeFunction(mujoco.getExportByName('mj_kinematics'),'void',['pointer','pointer']);
const forwardPhysics=new NativeFunction(mujoco.getExportByName('mj_forward'),'void',['pointer','pointer']);
const resetPhysics=new NativeFunction(mujoco.getExportByName('mj_resetData'),'void',['pointer','pointer']);
const guardVelocity=new NativeFunction(mujoco.getExportByName('mj_differentiatePos'),'void',['pointer','pointer','double','pointer','pointer']);
const interpolatePose=new NativeFunction(mujoco.getExportByName('mj_integratePos'),'void',['pointer','pointer','pointer','double']);
const bodyName=new NativeFunction(mujoco.getExportByName('mj_id2name'),'pointer',['pointer','int','int']);
const mjVersion=new NativeFunction(mujoco.getExportByName('mj_version'),'int',[]);
const geomDistance=new NativeFunction(mujoco.getExportByName('mj_geomDistance'),'double',
  ['pointer','pointer','int','int','double','pointer']);
const closestPoints=Memory.alloc(48);
const bodyOut=Memory.alloc(24);
const qposCount=114,qvelCount=90,rootOffsets=[0,57];
const reference=Memory.alloc(qposCount*8),staged=Memory.alloc((qposCount+qvelCount)*8);
const guardCurrent=Memory.alloc(qposCount*8),guardTarget=Memory.alloc(qposCount*8);
const guardSpeeds=Memory.alloc(qvelCount*8),guardControls=Memory.alloc(78*8);
const punchFrom=Memory.alloc(qposCount*8),punchTo=Memory.alloc(qposCount*8),punchSpeeds=Memory.alloc(qvelCount*8);
const originalPunches={7:null,12:null};
let recordingPunch=null;
const guardRepairs=[0,1].map(()=>({arms:false,since:0,count:0}));
const stanceClock=Memory.alloc(8);
let simulationSeconds=null;
let combatMs=0;
const inputCodes=[[],[]], nativeInputs=[[],[]], inputPolicy=[null,null];
let observeFeet=false, feet=null, footWidths=null,torsoLeans=null,hands=null,handsDepth=null;
const motionState=Memory.alloc((qposCount+qvelCount)*8);
let motion=null;
// Enabled only by the QA sampler. Verify actual displacement against the
// simulator's free-joint velocity without imposing a speed limit on its steps.
const traceState=Memory.alloc((1+qposCount+qvelCount)*8);
let previousTrace=null,traceSteps=0,maxTraceError=0;
function traceNativeStep(model,data){
  getState(model,data,traceState,1|2|4);
  const time=traceState.readDouble();
  const roots=rootOffsets.map(offset=>[0,1].map(axis=>traceState.add(8*(1+offset+axis)).readDouble()));
  if(previousTrace&&time>previousTrace.time){
    const dt=time-previousTrace.time;
    for(let side=0;side<2;side++){
      const error=roots[side].map((value,axis)=>{
        const speed=traceState.add(8*(1+qposCount+45*side+axis)).readDouble();
        return value-previousTrace.roots[side][axis]-speed*dt;
      });
      maxTraceError=Math.max(maxTraceError,Math.hypot(...error));
    }
    traceSteps++;
  }
  previousTrace={time,roots};
}
const corners=[null,null],guards=[null,null];
const guardCandidates=[null,null];
const neutralFeet=[null,null];
let floorGaps=[null,null], canvasHeight=null;
let shoeGaps=[null,null],contacts=[null,null],guardStartedAt=0;
const rearAxes=[null,null];
const headForwardSign=[0,0];
let facingErrorDeg=[null,null];
const facingPose=Memory.alloc(qposCount*8);

function calibrateHead(data,side){
  // Both boot toes point forward in the saved standing guard. The anatomical
  // depth axis of the cuboid head is local Y (X is shoulder width, Z is up).
  const base=side*21;
  const [heelL,toeL,heelR,toeR]=[20,21,24,25].map(id=>position(data,base+id));
  const bootX=toeL[0]+toeR[0]-heelL[0]-heelR[0];
  const bootY=toeL[1]+toeR[1]-heelL[1]-heelR[1];
  position(data,17+base);
  return Math.sign(globalMatrix.add(8).readDouble()*bootX+globalMatrix.add(32).readDouble()*bootY)||1;
}

function facingError(data,side,target,origin){
  const head=position(data,17+side*21);
  const x=globalMatrix.add(8).readDouble()*headForwardSign[side];
  const y=globalMatrix.add(32).readDouble()*headForwardSign[side];
  const from=origin??head;
  const dx=target[0]-from[0],dy=target[1]-from[1];
  if(Math.hypot(x,y)<.35||Math.hypot(dx,dy)<.25)return null;
  return Math.atan2(x*dy-y*dx,x*dx+y*dy);
}

function faceOpponent(model,data,lineup){
  if(started&&!finished)throw new Error('Aktif maçta köşe pozu değiştirilemez.');
  const heads=[0,1].map(side=>lineup[side]?position(data,17+side*21):null);
  let changed=false;
  for(let side=0;side<2;side++){
    if(!heads[side])continue;
    const error=facingError(data,side,heads[1-side]??[0,0]);
    if(error===null||Math.abs(error)<.035)continue;
    const turn=error;
    if(!changed)getState(model,data,facingPose,2);
    changed=true;
    // Only the parked, zero-velocity corner pose is rotated here.
    const quat=facingPose.add((rootOffsets[side]+3)*8);
    const [w,x,y,z]=[0,1,2,3].map(i=>quat.add(i*8).readDouble());
    const c=Math.cos(turn/2),s=Math.sin(turn/2);
    [c*w-s*z,c*x-s*y,c*y+s*x,c*z+s*w].forEach((v,i)=>quat.add(i*8).writeDouble(v));
  }
  if(changed){
    setState(model,data,facingPose,2);
    kinematics(model,data);
  }
}
function shoeContacts(model,data,side){
  return [[20,21],[24,25]].map(pair=>{
    let nearest=null;
    for(const id of pair){
      const gap=geomDistance(model,data,0,id+side*21,2,closestPoints);
      if(!nearest||gap<nearest.gap){
        const xyz=[0,1,2].map(axis=>closestPoints.add(axis*8).readDouble());
        nearest={gap,point:[xyz[0],xyz[2],-xyz[1]]};
      }
    }
    return nearest;
  });
}
function position(data,id,out=bodyOut){
  toGlobal(data,out,globalMatrix,zeroPosition,identityQuat,id,0);
  return [0,1,2].map(axis=>out.add(axis*8).readDouble());
}
function bodyLean(root,upper){
  return Math.atan2(Math.hypot(upper[0]-root[0],upper[1]-root[1]),upper[2]-root[2]);
}
function groundedGuardScore(root,spine,head,feet){
  if(!TikMngNativeCamera.balancedGuard(root,head,feet))return Infinity;
  // The feet can both be grounded while the torso is folded at the waist.
  // Favor a native stance with the head and upper spine stacked over the hip.
  return Math.max(bodyLean(root,spine),bodyLean(root,head));
}
function closedGuard(head,gloves){
  return Math.hypot(...gloves[0].map((value,axis)=>value-gloves[1][axis]))<1.8&&
    gloves.every(glove=>Math.hypot(...glove.map((value,axis)=>value-head[axis]))<1.35);
}
function captureCorners(model,data){
  if(stateSize(model,2)!==qposCount||stateSize(model,4)!==qvelCount||
    bodyName(model,1,5).readCString()!=='Player1SkeletonRoot_body'||bodyName(model,1,26).readCString()!=='Player2SkeletonRoot_body'){
    throw new Error('Ring iskeleti bu sürümle uyuşmuyor.');
  }
  const roots=[position(data,5),position(data,26)];
  const direction=[roots[1][0]-roots[0][0],roots[1][1]-roots[0][1]];
  const length=Math.hypot(...direction);
  if(length<1)return;
  guardScanTicks++;
  for(const [side,offset] of rootOffsets.entries()){
    if(corners[side])continue;
    const feet=shoeContacts(model,data,side);
    const head=position(data,17+21*side);
    const gloves=[12,15].map(id=>position(data,id+21*side));
    if(!closedGuard(head,gloves))continue;
    const score=groundedGuardScore(roots[side],position(data,8+side*21),head,feet);
    const best=guardCandidates[side];
    if(Number.isFinite(score)&&(!best||score<best.score)){
      getState(model,data,staged,2);
      const lower=feet[0].gap<=feet[1].gap?feet[0]:feet[1];
      guardCandidates[side]={
        score,pose:staged.add(offset*8).readByteArray(qposCount/2*8),
        facing:calibrateHead(data,side),canvas:lower.point[1],height:roots[side][2]-lower.gap
      };
    }
    const candidate=guardCandidates[side];
    if(guardScanTicks<90||!candidate)continue;
    reference.add(offset*8).writeByteArray(candidate.pose);
    headForwardSign[side]=candidate.facing;
    // The blue pad lies at positive physics X/Y, the red pad at negative X/Y.
    const sign=side?-1:1;
    canvasHeight=candidate.canvas;
    const arena=TikMngRingLayout, diagonal=sign*(arena.halfRing-arena.cornerInset);
    corners[side]=[arena.centerX+diagonal,-arena.centerZ+diagonal,candidate.height];
  }
}
function placeCorners(model,data){
  // Stage RPCs can arrive after tick entry while a native call releases the
  // JS lock. Complete the reset here as well before consuming that roster.
  if(finished)resetMatch();
  guardRepairs.forEach(repair=>Object.assign(repair,{arms:false,since:0,count:0}));
  // RPC stage can arrive while a native function temporarily releases the JS
  // lock. One placement must use one immutable roster, including visibility.
  const lineup=[...desiredLineup],version=stageVersion;
  staged.writeByteArray(reference.readByteArray(qposCount*8));
  for(let side=0;side<2;side++){
    const root=rootOffsets[side]*8;
    // A hidden boxer below the floor looks knocked down to the demo referee.
    // Park the unused body beyond the ring at standing height until a viewer joins.
    const offstage=lineup[side]?0:(side===0?-16384:16384);
    corners[side].forEach((value,axis)=>{
      staged.add(root+axis*8).writeDouble(axis===0?value+offstage:value);
    });
  }
  // Match the native round placement path. Replacing the entire simulation
  // data here also clears actuator state that the live controller still owns.
  setState(model,data,staged,2|4);
  kinematics(model,data);
  faceOpponent(model,data,lineup);
  visibleLineup=lineup;stageDirty=stageVersion!==version;
  restoreBoxerStatus=true;
  updateStandingContacts(model,data);
  getState(model,data,staged,2);
  for(let side=0;side<2;side++){
    neutralFeet[side]=Math.max(...[20,21,24,25].map(id=>position(data,id+21*side)[2]));
  }
  guardStartedAt=Date.now();
  for(const [side,offset] of rootOffsets.entries()){
    guards[side]=visibleLineup[side]?{
      root:Array.from({length:7},(_,i)=>staged.add((offset+i)*8).readDouble()),
      soles:contacts[side].map(([x,y,z])=>[x,-z,y]),
      joints:readGuardJoints(model,side),
    }:null;
  }
}
function readGuardJoints(model,side){
  // Win64 offsets compiled from the official MuJoCo 3.3.7 mjModel header.
  if(mjVersion()!==337)throw new Error('Isınma için fizik sürümü uyuşmuyor.');
  const count=model.add(36).readS32();
  if(count<1||count>100)throw new Error('Geçersiz ring eklem sayısı.');
  const types=model.add(1656).readPointer(),addresses=model.add(1664).readPointer(),bodies=model.add(1680).readPointer();
  const joints=[];
  for(let i=0;i<count;i++){
    const body=bodies.add(i*4).readS32(),type=types.add(i*4).readS32(),address=addresses.add(i*4).readS32();
    if(body<9+side*21||body>16+side*21||![1,3].includes(type))continue;
    const name=bodyName(model,1,body).readCString();
    if(!/arm|hand|shoulder|elbow/i.test(name))continue;
    const length=type===1?4:1;
    if(address<rootOffsets[side]+7||address+length>rootOffsets[side]+57)throw new Error('Geçersiz gard eklem adresi.');
    joints.push({address,neutral:Array.from({length},(_,k)=>staged.add((address+k)*8).readDouble())});
  }
  return joints;
}
function updateStandingContacts(model,data){
  const soles=visibleLineup.map((visible,side)=>visible?shoeContacts(model,data,side):null);
  contacts=soles.map(pair=>pair?.map(foot=>foot.point)??null);
  shoeGaps=soles.map(pair=>pair?.map(foot=>foot.gap)??null);
  floorGaps=shoeGaps.map(pair=>pair?Math.min(...pair):null);
}
function applyStandingGuard(model,data,seconds){
  for(const [side,guard] of guards.entries()){
    if(!guard)continue;
    const pose=TikMngNativeCamera.idleGuardRoot(guard.root,guard.soles,seconds,side);
    pose.forEach((value,i)=>staged.add((rootOffsets[side]+i)*8).writeDouble(value));
    guard.joints.forEach((joint,index)=>{
      TikMngNativeCamera.idleGuardJoint(joint.neutral,seconds,side,index)
        .forEach((value,i)=>staged.add((joint.address+i)*8).writeDouble(value));
    });
  }
  setState(model,data,staged,2);
  kinematics(model,data);
}
function backCorners(data,side,roots){
  if(!visibleLineup[side])return null;
  const spine=position(data,8+side*21);
  const opponent=roots[1-side];
  const direction=visibleLineup[1-side]?[opponent[0]-spine[0],opponent[1]-spine[1]]:[-spine[0],-spine[1]];
  const mag=Math.hypot(...direction);
  if(mag<.3)return null;
  const vx=direction[0]/mag,vy=direction[1]/mag;
  const lateral=[0,1].map(axis=>[globalMatrix.add(axis*8).readDouble(),globalMatrix.add((3+axis)*8).readDouble(),globalMatrix.add((6+axis)*8).readDouble()]);
  const dot=axis=>axis[0]*vx+axis[1]*vy;
  // Identify the torso's rear face in its starting guard and keep that local
  // face through turns. Choosing it from the opponent each frame flips the ink.
  if(!rearAxes[side]){
    const axis=Math.abs(dot(lateral[0]))>=Math.abs(dot(lateral[1]))?0:1;
    rearAxes[side]={axis,sign:Math.sign(dot(lateral[axis]))||1};
  }
  const {axis,sign}=rearAxes[side],front=lateral[axis];
  const worldUp=[globalMatrix.add(16).readDouble(),globalMatrix.add(40).readDouble(),globalMatrix.add(64).readDouble()];
  const rear=front.map(value=>-value*sign);
  const right=[worldUp[1]*rear[2]-worldUp[2]*rear[1],worldUp[2]*rear[0]-worldUp[0]*rear[2],worldUp[0]*rear[1]-worldUp[1]*rear[0]];
  return [[-.29,.085],[.29,.085],[.29,-.085],[-.29,-.085]].map(([horizontal,vertical])=>{
    const [x,y,z]=spine.map((value,i)=>value+rear[i]*.22+right[i]*horizontal+worldUp[i]*vertical);
    return [x,z,-y];
  });
}
const step2Address=mujoco.getExportByName('mj_step2');
const nativeStep2=new NativeFunction(step2Address,'void',['pointer','pointer']);
function scoreContact(defender,attack,blocked=false,contact='native',simulationMs){
  if(!attack.awaitingContact||scoredSwing[defender]===attack.issued||ringHealth[defender]===0)return;
  scoredSwing[defender]=attack.issued;
  const damage=Math.min(ringHealth[defender],attack.damage);
  ringHealth[defender]-=damage;
  healthChanged=true;
  attack.awaitingContact=false;
  send({type:'hit',defender,damage,blocked,contact,simulationMs});
}
function checkGloves(model,data,now){
  for(let striker=0;striker<2;striker++){
    const attack=punches[striker],defender=1-striker;
    if(!attack.awaitingContact)continue;
    const gloves=[12+21*striker,15+21*striker];
    const touches=parts=>gloves.some(glove=>parts.some(part=>
      geomDistance(model,data,glove,part+21*defender,.06,closestPoints)<.035));
    if(touches([17,9,8,7,6]))scoreContact(defender,attack,false,'body',now);
    else if(touches([12,15,11,14]))scoreContact(defender,attack,true,'guard',now);
    // The swing was issued in range. Settle it even if a physics sample
    // skipped contact, including when the next sample arrives after the deadline.
    else if(now>=attack.until+finishGraceMs)scoreContact(defender,attack,false,'settled',now);
  }
}
function nativeMatchControls(original,viewerPunch,footwork=0,plant=!!viewerPunch,closeForPunch=false){
  const controls=[];
  let attackPlaced=false;
  for(const code of original){
    // The stock AI does not schedule the viewer's swing itself. Let the
    // game's punch stance plant its feet during that short window instead
    // of combining it with another full walking/pivoting leg target.
    if(plant&&code>=22&&code<=29)continue;
    // A received viewer action must not wait behind an unrelated lateral or
    // retreat step while its target is out of reach. Use the same native
    // forward step until in range; never move a body or change its animation.
    if(closeForPunch&&code>=22&&code<=29)continue;
    // Use the native high guard instead of low block and deliberate evasions.
    // Keep analog aim (21) and the original footwork so the AI can face and close.
    if(code<7||code>=13&&code<=17||code===19)continue;
    if(code===18||code===20){
      if(!viewerPunch&&!controls.includes(18))controls.push(18);
      continue;
    }
    if(code<7||code>12){
      controls.push(code);
    }else if(viewerPunch&&!attackPlaced){
      controls.push(viewerPunch);
      attackPlaced=true;
    }
  }
  if(closeForPunch&&!plant)controls.push(22);
  else if(footwork&&!plant&&!controls.some(code=>code>=22&&code<=29))controls.push(footwork);
  if(viewerPunch&&!attackPlaced)controls.push(viewerPunch);
  if(!viewerPunch&&!controls.includes(18))controls.push(18);
  return controls;
}
function activeStrike(now){
  return punches.some(punch=>now<punch.until);
}
function canStrike(distance,heads){
  // Upright native guards can settle just outside the old 2.244-root gate.
  // A received action must still reach the native punch controller there.
  return distance!==null&&Number.isFinite(distance)&&distance<=2.8;
}
function issuePunch(side,now){
  const punch=punches[side],opponent=punches[1-side];
  // Let the glove retract before the short recovery. If both corners have orders,
  // give the next opening to the corner that has waited longer.
  if(opponent.pending>0&&opponent.nextAt<punch.nextAt)return;
  if(!punch.pending||
      punches.some(queued=>queued.awaitingContact||now<queued.nextAt)||
      !canStrike(rootDistance,rawHeadWorld))return;
  const queue=orders[side],order=queue[orderCursor[side]];
  punch.pending--;
  punch.damage=order.damage;
  if(order.action==='B'){punch.pendingB--;punch.control=12;}
  else{punch.pendingA--;punch.control=punch.issued%2===0?7:12;}
  if(--order.count===0){
    orderCursor[side]++;
    if(orderCursor[side]===queue.length){queue.length=0;orderCursor[side]=0;}
    else if(orderCursor[side]>=128){queue.splice(0,orderCursor[side]);orderCursor[side]=0;}
  }
  punch.awaitingContact=true;
  punch.until=now+punchMotionMs;
  punch.nextAt=punch.until+punchRecoveryMs;
  punch.issued++;
  send({type:'punch',side,issued:punch.issued,pending:punch.pending,simulationMs:now});
}
function needsNativeGuard(span,behind,punchActive,sincePunch){
  return !punchActive&&sincePunch>=40&&(span>2.1||behind<-.45);
}
function punchFramePair(frames,time){
  if(time<=frames[0].time)return[frames[0],frames[0],0];
  for(let i=1;i<frames.length;i++)if(time<=frames[i].time){
    const a=frames[i-1],b=frames[i];return[a,b,(time-a.time)/(b.time-a.time)];
  }
  return[frames[frames.length-1],frames[frames.length-1],0];
}
function captureOriginalPunch(model,data,now){
  if(recordingPunch&&now>=recordingPunch.start+punchMotionMs){
    if(recordingPunch.valid&&recordingPunch.frames.length>=10&&recordingPunch.frames.at(-1).time>=300)
      originalPunches[recordingPunch.control]=recordingPunch.frames;
    recordingPunch=null;
  }
  for(let side=0;side<2;side++){
    const punch=punches[side];
    if(!punch.issued||now>=punch.until||originalPunches[punch.control])continue;
    // Learn only the original solver-driven swing. Never train a new clip
    // from our recovery controller or from an already recorded replacement.
    if(guardRepairs[side].arms&&Object.values(originalPunches).some(Boolean))continue;
    const start=punch.until-punchMotionMs;
    if(!recordingPunch||recordingPunch.start!==start){
      recordingPunch={side,control:punch.control,start,valid:true,frames:[{
        time:0,pose:reference.add((rootOffsets[side]+23)*8).readByteArray(80)}]};
    }
    if(now-start-recordingPunch.frames.at(-1).time<10)continue;
    const gloves=[12,15].map(id=>position(data,id+21*side)),chest=position(data,8+21*side);
    position(data,17+21*side);
    const x=globalMatrix.add(8).readDouble()*headForwardSign[side];
    const y=globalMatrix.add(32).readDouble()*headForwardSign[side],norm=Math.hypot(x,y)||1;
    const depth=Math.min(...gloves.map(glove=>((glove[0]-chest[0])*x+(glove[1]-chest[1])*y)/norm));
    const span=Math.hypot(...gloves[0].map((value,axis)=>value-gloves[1][axis]));
    if(span>3||depth<-.45)recordingPunch.valid=false;
    getState(model,data,guardCurrent,2);
    recordingPunch.frames.push({time:now-start,pose:guardCurrent.add((rootOffsets[side]+23)*8).readByteArray(80)});
  }
}
function originalPunchTarget(model,side,now){
  const punch=punches[side],frames=originalPunches[punch.control]??originalPunches[7]??originalPunches[12];
  if(!frames)return false;
  const [a,b,mix]=punchFramePair(frames,now-(punch.until-punchMotionMs)+25);
  const bytes=guardCurrent.readByteArray(qposCount*8),offset=(rootOffsets[side]+23)*8;
  punchFrom.writeByteArray(bytes);punchTo.writeByteArray(bytes);
  punchFrom.add(offset).writeByteArray(a.pose);punchTo.add(offset).writeByteArray(b.pose);
  guardVelocity(model,punchSpeeds,1,punchFrom,punchTo);
  interpolatePose(model,punchFrom,punchSpeeds,mix);
  guardTarget.add(offset).writeByteArray(punchFrom.add(offset).readByteArray(80));
  return true;
}
function maintainNativeGuard(model,data){
  if(!ready||!started||finished||knockoutAt)return;
  getState(model,data,stanceClock,1);
  const now=stanceClock.readDouble()*1000;
  captureOriginalPunch(model,data,now);
  const repairing=[false,false];
  for(let side=0;side<2;side++){
    if(ringHealth[side]<=0)continue;
    const gloves=[12,15].map(id=>position(data,id+21*side));
    const chest=position(data,8+side*21);
    position(data,17+21*side);
    const x=globalMatrix.add(8).readDouble()*headForwardSign[side];
    const y=globalMatrix.add(32).readDouble()*headForwardSign[side],norm=Math.hypot(x,y)||1;
    const behind=Math.min(...gloves.map(glove=>((glove[0]-chest[0])*x+(glove[1]-chest[1])*y)/norm));
    const span=Math.hypot(...gloves[0].map((value,axis)=>value-gloves[1][axis]));
    const repair=guardRepairs[side],punch=punches[side];
    const punching=now<punch.until;
    const invalid=needsNativeGuard(span,behind,punching,now-punch.until);
    if(invalid){
      if(!repair.since)repair.since=now;
      if(now-repair.since>=80&&!repair.arms){repair.arms=true;repair.count++;}
    }else repair.since=0;
    // An invalid native arm target can persist for the rest of the bout.
    // Reuse this fighter's own captured guard and an original healthy swing,
    // rather than continuing the invalid target after each new viewer punch.
    repairing[side]=repair.arms&&(!punching||Object.values(originalPunches).some(Boolean));
  }
  if(!repairing.some(Boolean))return;
  if(stateSize(model,32)!==78)throw new Error('Gard motorları bu sürümle uyuşmuyor.');
  getState(model,data,guardCurrent,2);
  guardTarget.writeByteArray(guardCurrent.readByteArray(qposCount*8));
  for(let side=0;side<2;side++){
    if(!repairing[side])continue;
    // Shoulder ball joints and forearm hinges only. Root, spine, head,
    // legs, contacts and the native walking targets remain untouched.
    const offset=rootOffsets[side]+23;
    if(now>=punches[side].until||!originalPunchTarget(model,side,now))
      guardTarget.add(offset*8).writeByteArray(reference.add(offset*8).readByteArray(10*8));
  }
  // Follow the game's captured healthy swing during its original time window;
  // return to the same game's guard during recovery. Only velocity motor
  // intent changes; MuJoCo still resolves every contact and body movement.
  guardVelocity(model,guardSpeeds,1,guardCurrent,guardTarget);
  getState(model,data,guardControls,32);
  for(let side=0;side<2;side++){
    if(!repairing[side])continue;
    for(let i=0;i<8;i++){
      const horizon=now<punches[side].until?.08:.20;
      const speed=guardSpeeds.add((side*45+18+i)*8).readDouble()/horizon;
      guardControls.add((side*39+12+i)*8).writeDouble(Math.max(-12,Math.min(12,speed)));
    }
  }
  // Correct motor intent before the solver. Never move a joint or rewrite
  // position/velocity state to hide a bad frame after contact resolution.
  setState(model,data,guardControls,32);
}
function prepareNativeTick(game){
  retainManualRound(game);
  if(ready)protectHealth(game);
  if(!nativePhysics)return;
  const {model,data}=nativePhysics;
  let placed=false;
  // A roster RPC arriving inside a native frame must wait for the next
  // frame. Motor targets and bone snapshots have already been calculated
  // by mj_step2; moving a KO body there mixes two different poses in a frame.
  if(stageDirty&&corners.every(Boolean)&&(!started||finished)){
    // A new bout must not inherit the KO body's solver warmstart, external
    // forces or actuator data. Reset only at the frame boundary, before the
    // stock controller builds its targets, and retain its monotonic clock.
    getState(model,data,stanceClock,1);
    const savedTime=stanceClock.readDouble();
    resetPhysics(model,data);
    stanceClock.writeDouble(savedTime);
    setState(model,data,stanceClock,1);
    placeCorners(model,data);
    ready=true;pendingStagedSample=true;placed=true;
    retainManualRound(game);
    protectHealth(game);
  }
  const warmup=ready&&!started&&!finished&&!stageDirty&&!placed;
  if(warmup){
    applyStandingGuard(model,data,(Date.now()-guardStartedAt)/1000);
    updateStandingContacts(model,data);
  }
  if(placed||resumePhysics||warmup){
    forwardPhysics(model,data);
    // Rebuild both stock bone snapshots from the staged pose before the
    // original AI/controller reads them, using the game's own snapshot path.
    refreshNativeSnapshot(game,0);
    refreshNativeSnapshot(game,1);
  }
  if(resumePhysics){
    getState(model,data,stanceClock,1);
    simulationSeconds=stanceClock.readDouble();combatMs=simulationSeconds*1000;
    previousTrace=null;traceSteps=0;maxTraceError=0;
    resumePhysics=false;
  }
}
const step2=new NativeCallback((model,data)=>{
    nativePhysics={model,data};
    if(!ready&&standingTicks>=140)captureCorners(model,data);
    const changed=pendingStagedSample;pendingStagedSample=false;
    if(resumePhysics)return;
    if((!ready&&!changed)||(started&&!finished)){
      maintainNativeGuard(model,data);
      nativeStep2(model,data);
    }
    if(observeFeet&&started&&!finished&&!knockoutAt)traceNativeStep(model,data);
    getState(model,data,stanceClock,1);
    simulationSeconds=stanceClock.readDouble();
    if(started&&!finished)combatMs=simulationSeconds*1000;
    const now=combatMs;
    // Contact scoring follows every native solve. The 25 ms UI sampling below
    // must not miss a brief glove contact and settle damage after retraction.
    if(started&&!knockoutAt&&!finished)checkGloves(model,data,now);
    const wallTime=Date.now();
    const elapsedMs=wallTime-lastPhysicsRead;
    if(!changed&&elapsedMs<25)return;
    lastPhysicsRead=wallTime;
    // Live body poses belong to the native controller/solver. Do not rewrite
    // the free-root quaternion or joint poses after its contact solve.
    const values=[5,26,17,38].map((id,index)=>position(data,id,positionOutputs[index]));
    if(observeFeet)
      feet=[0,1].map(side=>[20,21,24,25].map(id=>position(data,id+side*21)[2]));
    if(observeFeet)footWidths=[0,1].map(side=>{
      const [left,right]=[20,24].map(id=>position(data,id+side*21));
      return Math.hypot(left[0]-right[0],left[1]-right[1]);
    });
    if(observeFeet)hands=[0,1].map(side=>[12,15].map(id=>position(data,id+21*side)));
    if(observeFeet)handsDepth=hands.map((gloves,side)=>{
      const chest=position(data,8+21*side);
      position(data,17+21*side);
      const x=globalMatrix.add(8).readDouble()*headForwardSign[side];
      const y=globalMatrix.add(32).readDouble()*headForwardSign[side];
      const norm=Math.hypot(x,y)||1;
      return gloves.map(glove=>((glove[0]-chest[0])*x+(glove[1]-chest[1])*y)/norm);
    });
    if(observeFeet)torsoLeans=values.slice(0,2).map((root,side)=>
      bodyLean(root,position(data,8+side*21))*180/Math.PI);
    getState(model,data,motionState,2|4);
    const sampledVelocity=new Float64Array(motionState.add(qposCount*8).readByteArray(qvelCount*8));
    if(!values.flat().every(Number.isFinite))throw new Error('Invalid native body positions');
    rootDistance=Math.hypot(values[0][0]-values[1][0],values[0][1]-values[1][1]);
    bodyHeight=Math.max(Math.abs(values[2][2]-values[0][2]),Math.abs(values[3][2]-values[1][2]));
    rawHeadWorld=values.slice(2);
    motion={sampleTime:simulationSeconds,roots:values.slice(0,2),maxVelocity:[0,1].map(side=>sampledVelocity.subarray(side*45,(side+1)*45).reduce((max,v)=>Math.max(max,Math.abs(v)),0))};
    if(changed)stagedHeads=rawHeadWorld;
    facingErrorDeg=visibleLineup.map((visible,side)=> {
      if(!visible||!visibleLineup[1-side])return null;
      const error=started?facingError(data,side,values[1-side],values[side]):
        facingError(data,side,rawHeadWorld[1-side]);
      return error===null?null:error*180/Math.PI;
    });
    backs=[0,1].map(side=>backCorners(data,side,values.slice(0,2)));
    if(changed)ready=true;
},'void',['pointer','pointer']);
// Stop integrating the waiting pose while the original renderer and camera run.
Interceptor.replace(step2Address,step2);
const controlsHook=Interceptor.attach(gameModule.base.add(0x2995e80),{
  onEnter(args){
    // This native function CONSUMES and frees the supplied Vec<u8>. Mutate the
    // original owned vector; never hand a Frida allocation to Rust's HeapFree.
    const incoming=args[2];
    if(finished){incoming.add(16).writeU64(0);return;}
    const side=args[1].toInt32()&255;
    if(side>1)throw new Error('Unsupported boxer side');
    const length=incoming.add(16).readU64().toNumber();
    if(length<0||length>64)throw new Error('Unsupported native controls');
    const bytes=incoming.add(8).readPointer();
    const original=Array.from({length},(_,i)=>bytes.add(i).readU8());
    const punch=punches[side],now=combatMs;
    if(started&&!resumePhysics&&!knockoutAt)issuePunch(side,now);
    // Keep the original input active through its strike window, just like the
    // native button control, then release it for recovery.
    const viewerPunch=started&&!resumePhysics&&!knockoutAt&&now<punch.until?punch.control:0;
    // The stock CPU can wait indefinitely in range after a viewer strike.
    // Its own lateral step controls keep footwork active during that wait.
    let footwork=0;
    if(started&&!resumePhysics&&!knockoutAt&&rootDistance!==null){
      footwork=Math.floor(now/1600)%2===0?24:25;
      if(rootDistance>2.6)footwork=22;
      if(rootDistance<1.4)footwork=23;
    }
    const plant=!knockoutAt&&activeStrike(now);
    const closeForPunch=started&&!resumePhysics&&!knockoutAt&&!plant&&
      punches.some(queued=>queued.pending>0)&&!canStrike(rootDistance,rawHeadWorld);
    const result=started?nativeMatchControls(original,viewerPunch,footwork,plant,closeForPunch):[18];
    if(started)punch.filtered+=original.filter(code=>code>=7&&code<=12).length;
    nativeInputs[side]=original;
    inputCodes[side]=result;
    inputPolicy[side]={plant,closeForPunch};
    const capacity=incoming.readU64().toNumber();
    if(capacity<length||capacity>65536)throw new Error('Invalid native vector capacity');
    let owned=bytes;
    if(result.length>capacity){
      owned=nativeAllocate(0,result.length);
      if(owned.isNull())throw new Error('Native control allocation failed');
      if(capacity>0&&!freeHeap(getHeap(),0,bytes))throw new Error('Native control release failed');
      incoming.writeU64(result.length);incoming.add(8).writePointer(owned);
    }
    for(let i=0;i<result.length;i++)owned.add(i).writeU8(result[i]);
    incoming.add(16).writeU64(result.length);
  },
});
let latest={phase:'loading',health:[null,null]};
function health(game){
  return [0,1].map(side=>{
    const base=game.add(side*0x2e20);
    if(base.readU64().toString()==='2' && base.add(8).readU64().toString()==='0')return null;
    const values=[0x9ec,0x9f0,0xa2c,0xa30].map(offset=>base.add(offset).readFloat());
    if(!values.every(Number.isFinite)||values[0]<=0||values[2]<=0||values[0]>1e7||values[2]>1e7)return null;
    // One health bar summarizes the weaker of the original two health channels.
    return Math.max(0,Math.min(1,values[1]/values[0],values[3]/values[2]));
  });
}
function protectHealth(game){
  if(!health(game).every(value=>value!==null))return;
  const now=combatMs;
  for(let side=0;side<2;side++){
    const base=game.add(side*0x2e20), opponent=punches[1-side];
    const channels=[[0x9ec,0x9f0],[0xa2c,0xa30]];
    if(started && !knockoutAt && opponent.issued && now<opponent.until+400){
      const lostHealth=channels.some(([,offset],i)=>{
        const previous=lastChannelHealth[side][i];
        return Number.isFinite(previous) && base.add(offset).readFloat()<previous-.001;
      });
      if(lostHealth)scoreContact(side,opponent,false,'native',now);
    }
    for(const [i,[maxOffset,offset]] of channels.entries()){
      // Match HP is kept separately; native injury channels also weaken stance.
      const hp=ringHealth[side]>0?base.add(maxOffset).readFloat():-1;
      base.add(offset).writeFloat(hp);
      lastChannelHealth[side][i]=hp;
    }
    // The stock controller also weakens every joint when its short-term and
    // round stamina run out. Those meters outlive a TikMnG bout. Keep a living
    // fighter's native strength until match HP reaches zero.
    if(ringHealth[side]>0){
      for(const offset of [0x2d88,0x2d90]){
        nativeStunPeaks[side]=Math.max(nativeStunPeaks[side],base.add(offset).readFloat());
        base.add(offset).writeFloat(0);
      }
      for(const [maximum,current] of [[0x9ac,0x9b0],[0x9bc,0x9c0],[0x9fc,0xa00],[0xa3c,0xa40]]){
        base.add(current).writeFloat(base.add(maximum).readFloat());
      }
    }
  }
}
function publish(game){
  if(!healthChanged&&Date.now()-lastPublish<100)return;
  healthChanged=false;
  lastPublish=Date.now();
  // Only a scored contact changes match HP. Native limb meters can keep
  // settling across several frames after that very same contact.
  const ratios=health(game).map((value,side)=>visibleLineup[side]&&value!==null?ringHealth[side]/100:null);
  if(started&&!knockoutAt){
    const down=ratios.map(ratio=>ratio!==null&&ratio<=.005);
    if(down.some(Boolean)){
      knockoutAt=Date.now();
      winner=down[0]===down[1]?null:down[0]?'right':'left';
    }
  }
  // Leave both original models in play while the demo resolves the final hit.
  if(knockoutAt && Date.now()-knockoutAt>=3400)finished=true;
  latest={phase:ready?(finished?'finished':started?'fighting':'waiting'):'loading',winner,health:ratios,lineup:visibleLineup,floorGaps,shoeGaps,steps,waitingCalls,nativePhase:game.add(0x9018).readU8(),nativeCounts:[game.add(0x910c).readS32(),game.add(0x911c).readS32()],nativeDown:[0,1].map(side=>game.add(side*0x2e20+0x2d34).readU8()),punches:punches.map(p=>({...p})),rootDistance,bodyHeight,rawHeadWorld};
  const signature=JSON.stringify([latest.phase,winner,visibleLineup,ratios.map(value=>value===null?null:Math.round(value*1000))]);
  if(signature!==lastSignature){lastSignature=signature;send({type:'state',value:latest});}
}
// Observe the original tick in place. Never call the Rust tick from a JS/C
// trampoline: that disrupts its exception/unwind context on this demo build.
// The input hook allows guard only while P is still pending.
const tickHook=Interceptor.attach(updateAddress,{
  onEnter(args){
    this.game=args[0];
    prepareNativeTick(this.game);
  },
  onLeave(){
    if(stopped)return;
    if(!ready){
      const standing=this.game.add(0x9018).readU8()===2&&rawHeadWorld.every(head=>head?.[2]>.95);
      standingTicks=standing?standingTicks+1:0;
    }else if(!started)waitingCalls++;
    if(started&&!finished)steps++;
    protectHealth(this.game);
    publish(this.game);
    retainManualRound(this.game);
  },
});
// The original tick can queue a down-state transition before onLeave restores
// the injury meters. Protect them at the verified branch that evaluates those
// meters, so a living TikMnG fighter keeps the native fighting controller.
const injuryHook=Interceptor.attach(gameModule.base.add(0x295cf7c),{
  onEnter(){if(ready)protectHealth(this.context.rbx);},
});
const stanceHook=Interceptor.attach(gameModule.base.add(0x296f380),{
  // A frame can contain several native controller/physics substeps. Restore
  // injury and stamina before the next controller builds its motor targets.
  onEnter(args){if(ready)protectHealth(args[0]);},
});
const cameraController=TikMngSpectatorCamera.create({
  hash:'9132d5631f59661f8bde912d6b1e5b9788c24fd7031bb1aa81d16b298b293e67',
  isReady:()=>ready,
  getHeads:()=>rawHeadWorld,
  getFramingHeads:()=>started?rawHeadWorld:stagedHeads,
  getBacks:()=>backs,
  getFloor:()=>canvasHeight,
  ringCenter:[TikMngRingLayout.centerX,1.1,TikMngRingLayout.centerZ],
  emptyRingRadius:TikMngRingLayout.halfRing*2.7,
  getContacts:()=>started?null:contacts,
  getVisibility:()=>visibleLineup,
  // Physics is Z-up; the game view keeps X and maps (Y,Z) to (−Z,Y).
  toWorld:([x,y,z])=>[x,z,-y],
  onSample:value=>send({type:'camera',value}),
});
rpc.exports={
  start(){
    if(!ready)throw new Error('Ring henüz hazır değil.');
    if(!visibleLineup.every(Boolean)||stageDirty||finished)throw new Error('İki köşe henüz hazır değil.');
    if(started)return{started:true,alreadyStarted:true};
    resumePhysics=true;started=true;return{started:true};
  },
  stage(lineup){
    if(!Array.isArray(lineup)||lineup.length!==2||lineup.some(value=>typeof value!=='boolean'))throw new Error('Geçersiz köşe bilgisi.');
    if(started&&!finished)throw new Error('Maç sırasında köşeler değişemez.');
    desiredLineup=[...lineup];stageVersion++;stageDirty=true;
    return{staged:true};
  },
  reset(lineup){
    if(!Array.isArray(lineup)||lineup.length!==2||lineup.some(value=>typeof value!=='boolean'))throw new Error('Geçersiz köşe bilgisi.');
    started=false;finished=true;winner=null;resumePhysics=false;
    desiredLineup=[...lineup];stageVersion++;stageDirty=true;
    return{staged:true};
  },
  sample(){
    observeFeet=true;
    const now=combatMs;
    return {...latest,facingErrorDeg,motion,simulationSeconds:started&&!resumePhysics ? simulationSeconds : null,
      inputCodes,nativeInputs,inputPolicy,inReach:canStrike(rootDistance,rawHeadWorld),traceSteps,maxTraceError,nativeStunPeaks,
      exchanging:activeStrike(now),strikeActive:activeStrike(now),feet,footWidths,torsoLeans,neutralFeet,hands,handsDepth,
      guardRepairs:guardRepairs.map(repair=>({...repair})),originalPunchFrames:Object.fromEntries(Object.entries(originalPunches).map(([code,frames])=>[code,frames?.length??0]))};
  },
  cameraSample(){return cameraController.sample();},
  camera(value){return cameraController.setMode(value);},
  follow(){return cameraController.follow();},
  zoom(delta){return cameraController.zoom(delta);},
  punch(request){
    if(!request||![0,1].includes(request.side)||!Number.isSafeInteger(request.count)||request.count<1||request.count>1000000||typeof request.eventId!=='string'||!request.eventId)
      throw new Error('Geçersiz yumruk olayı.');
    if(!started||finished||knockoutAt)return{accepted:false,inactive:true};
    if(seenPunches.has(request.eventId))return{accepted:false,duplicate:true};
    const damage=request.damage??damagePerHit, action=request.action==='B'?'B':'A';
    if(!Number.isInteger(damage)||damage<1||damage>100)throw new Error('Geçersiz vuruş hasarı.');
    const punch=punches[request.side];
    if(!Number.isSafeInteger(punch.pending+request.count))throw new Error('Yumruk kuyruğu sınırı aşıldı.');
    seenPunches.add(request.eventId);if(seenPunches.size>4096)seenPunches.delete(seenPunches.values().next().value);
    punch.pending+=request.count;
    const queue=orders[request.side],last=queue[queue.length-1];
    if(last&&last.action===action&&last.damage===damage)last.count+=request.count;
    else queue.push({action,damage,count:request.count});
    punch[request.action==='B'?'pendingB':'pendingA']+=request.count;
    return{accepted:true,pending:punch.pending};
  },
  stop(){stopped=true;controlsHook.detach();Interceptor.revert(step2Address);tickHook.detach();injuryHook.detach();stanceHook.detach();cameraController.stop();},
};
send({type:'state',value:latest});
