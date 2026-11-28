'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../tools/spectator-native.js'),'utf8');
const recovery=source.slice(source.indexOf('function restoreLivingGuard('),source.indexOf('function livingRootForce('));
class Pointer{
 constructor(n,buffer=Buffer.alloc(n*8),offset=0){this.buffer=buffer;this.offset=offset;}
 add(n){return new Pointer(0,this.buffer,this.offset+n);}
 readDouble(){return this.buffer.readDoubleLE(this.offset);}
 writeDouble(n){this.buffer.writeDoubleLE(n,this.offset);}
 readByteArray(n){return Buffer.from(this.buffer.subarray(this.offset,this.offset+n));}
 writeByteArray(bytes){Buffer.from(bytes).copy(this.buffer,this.offset);}
}
function fixture(){
 const reference=new Pointer(114),state=new Pointer(204),warm=new Pointer(90),saved=new Pointer(90);
 for(let i=0;i<204;i++)state.add(i*8).writeDouble(.01*i);
 for(let side=0;side<2;side++){
  reference.add((side*57+2)*8).writeDouble(1);reference.add((side*57+3)*8).writeDouble(1);
  for(let i=7;i<57;i++)reference.add((side*57+i)*8).writeDouble(i*.002);
  const p=state.add(side*57*8);p.writeDouble(1+side);p.add(8).writeDouble(-4);p.add(16).writeDouble(1);
  [Math.cos(.3),0,0,Math.sin(.3)].forEach((q,i)=>p.add(24+i*8).writeDouble(q));
 }
 for(let i=0;i<90;i++)warm.add(i*8).writeDouble(i+1);
 const points=[[[1,-4,1],[1,-4,1.7],[1,-4,2.2]],[[2,-4,1],[2,-4,1.7],[2,-4,2.2]]],writes=[];
 const ctx={ready:true,started:true,finished:false,knockoutAt:0,qposCount:114,rootOffsets:[0,57],
  visibleLineup:[true,true],ringHealth:[100,100],corners:[[0,0,1],[0,0,1]],reference,safetyState:new Pointer(204),savedForces:saved,
  livingSafety:[{recovering:false,count:0},{recovering:false,count:0}],TikMngRingLayout:require('../assets/ring-layout.js'),
  position(_d,id){const side=id>=26?1:0;return points[side][(id-21*side)===5?0:(id-21*side)===8?1:2];},
  bodyLean(a,b){return Math.atan2(Math.hypot(b[0]-a[0],b[1]-a[1]),b[2]-a[2]);},
  getState(_m,_d,out,spec){out.writeByteArray((spec===8?warm:state).readByteArray((spec===8?90:204)*8));},
  setState(_m,_d,out,spec){writes.push(spec);(spec===8?warm:state).writeByteArray(out.readByteArray((spec===8?90:204)*8));}};
 return{ctx,state,warm,points,writes,run:()=>vm.runInNewContext(recovery+'\nrestoreLivingGuard(null,null)',ctx)};
}
test('a prone or inverted living fighter returns to its own stock guard before snapshot without moving the opponent',()=>{
 for(const lean of [Math.PI/2,Math.PI]){
  const f=fixture(),other=Buffer.from(f.state.buffer.subarray(57*8,114*8)),otherVel=Buffer.from(f.state.buffer.subarray((114+45)*8));
  f.points[0][1]=[1+Math.sin(lean),-4,1+Math.cos(lean)];
  assert.equal(f.run(),true);assert.deepEqual(f.writes,[6,8]);
  assert.equal(f.state.readDouble(),1);assert.equal(f.state.add(8).readDouble(),-4);assert.equal(f.state.add(16).readDouble(),1);
  assert.ok(Math.abs(f.state.add(24).readDouble()-Math.cos(.3))<1e-8,'Horizontal heading is preserved');
  assert.deepEqual(f.state.buffer.subarray(57*8,114*8),other);assert.deepEqual(f.state.buffer.subarray((114+45)*8),otherVel);
  assert.ok(f.state.buffer.subarray(114*8,(114+45)*8).every(byte=>byte===0));
  assert.equal(f.warm.readDouble(),0);assert.equal(f.warm.add(45*8).readDouble(),46);
  assert.deepEqual(f.ctx.ringHealth,[100,100]);
 }
});
test('healthy locomotion and actual knockouts are never rewritten, while an escaped living root is brought inside',()=>{
 const f=fixture();assert.equal(f.run(),false);assert.deepEqual(f.writes,[]);
 f.points[0][1]=[4,-4,0];f.ctx.ringHealth[0]=0;assert.equal(f.run(),false);
 const edge=fixture();edge.points[0][0][0]=20;edge.state.writeDouble(20);assert.equal(edge.run(),true);
 assert.ok(edge.state.readDouble()<edge.ctx.TikMngRingLayout.centerX+edge.ctx.TikMngRingLayout.halfRing);
});
