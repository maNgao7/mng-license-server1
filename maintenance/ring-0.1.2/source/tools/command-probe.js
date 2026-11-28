'use strict';
// Private runtime test, pinned native game only. Dispatches the game's original
// Jab command into its own verified command vector, without changing physics.
const game = Process.getModuleByName('boxing.exe');
const allocate = new NativeFunction(game.base.add(0x38A7FD0), 'pointer', ['uint','uint64']);
const localReturn = game.base.add(0x5B2BE);
let until=0, command=7, injected=0, observed=0;
const mj=Process.getModuleByName('mujoco.dll');
const velocity=new NativeFunction(mj.getExportByName('mj_objectVelocity'),'void',['pointer','pointer','int','int','pointer','int']);
const speedBuffer=Memory.alloc(48);
let motionFrames=0, peak=[0,0], motionUntil=0;
const motionHook=Interceptor.attach(mj.getExportByName('mj_step2'),{
  onEnter(args){this.model=args[0];this.data=args[1];},
  onLeave(){
    if(Date.now()>motionUntil)return;
    motionFrames++;
    for(const [side,id] of [[0,12],[1,33]]){
      velocity(this.model,this.data,1,id,speedBuffer,0);
      const speed=Math.hypot(...[3,4,5].map(i=>speedBuffer.add(i*8).readDouble()));
      peak[side]=Math.max(peak[side],speed);
    }
  },
});
const hook=Interceptor.attach(game.base.add(0x2B62070),{
  onEnter(args){this.out=args[0];this.local=this.returnAddress.equals(localReturn);},
  onLeave(){
    if(!this.local)return;
    observed++;
    if(Date.now()>=until)return;
    const cap=this.out.add(0xd8),pointer=this.out.add(0xe0),length=this.out.add(0xe8);
    if(length.readU64().toNumber()!==0)return;
    const memory=allocate(0,1);
    if(memory.isNull())throw new Error('Original native allocation failed');
    memory.writeU8(command);
    cap.writeU64(1);pointer.writePointer(memory);length.writeU64(1);
    injected++;
  },
});
rpc.exports={
  jab(){until=Date.now()+1000;command=7;motionUntil=Date.now()+2000;peak=[0,0];motionFrames=0;return{queued:true,control:'original-Jab-7',durationMs:1000};},
  cross(){until=Date.now()+1000;command=12;motionUntil=Date.now()+2000;peak=[0,0];motionFrames=0;return{queued:true,control:'original-Cross-12',durationMs:1000};},
  baseline(){motionUntil=Date.now()+2000;peak=[0,0];motionFrames=0;return{measuring:true};},
  sample(){return{observed,injected,active:Date.now()<until,motionFrames,peakGloveSpeed:peak};},
  stop(){until=0;hook.detach();motionHook.detach();},
};
send({type:'command-hook-attached',mode:'isolated-original-input-test'});
