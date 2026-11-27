'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../tools/spectator-native.js'),'utf8');
const place=source.slice(source.indexOf('function placeCorners('),source.indexOf('function readGuardJoints('));
const requests=source.slice(source.indexOf('  start(){'),source.indexOf('  reset(lineup){'));
class Pointer {
  constructor(buffer=Buffer.alloc(912),offset=0){this.buffer=buffer;this.offset=offset;}
  add(n){return new Pointer(this.buffer,this.offset+n);}
  readByteArray(n){return this.buffer.subarray(this.offset,this.offset+n);}
  writeByteArray(bytes){Buffer.from(bytes).copy(this.buffer,this.offset);}
  readDouble(){return this.buffer.readDoubleLE(this.offset);}
  writeDouble(n){this.buffer.writeDoubleLE(n,this.offset);}
}
test('joining during native placement cannot discard the next roster or expose a parked boxer',()=>{
  let interrupt=true,clock=125.5,resets=0;const applied=[];
  const ctx={desiredLineup:[false,true],visibleLineup:[false,false],stageVersion:1,stageDirty:true,
    staged:new Pointer(),reference:new Pointer(),stanceClock:new Pointer(),qposCount:114,rootOffsets:[0,57],corners:[[-4.25,-4.25,0],[4.25,4.25,0]],
    guards:[null,null],guardRepairs:[{},{}],contacts:[[[0,0,0]],[[0,0,0]]],neutralFeet:[null,null],
    ready:true,started:true,finished:true,resumePhysics:false,
    resetMatch(){resets++;ctx.started=false;ctx.finished=false;},
    position(){return[0,0,0];},resetData(){clock=0;},kinematics(){},faceOpponent(){},updateStandingContacts(){},
    getState(model,data,pose,spec){if(spec===1)pose.writeDouble(clock);},readGuardJoints(){return[];},
    setState(model,data,pose,spec){
      if(spec===1){clock=pose.readDouble();return;}
      assert.equal(ctx.finished,false,'Late KO staging clears finished before writing the next pose');
      applied.push([pose.readDouble(),pose.add(57*8).readDouble()]);
      if(interrupt){interrupt=false;ctx.api.stage([true,true]);}
    },
  };
  vm.createContext(ctx);vm.runInContext(place+'\nvar api={'+requests+'};',ctx);
  vm.runInContext('placeCorners(null,null)',ctx);
  assert.deepEqual(Array.from(ctx.visibleLineup),[false,true]);
  assert.equal(ctx.stageDirty,true);
  assert.equal(clock,125.5,'Round placement preserves the native animation clock');
  assert.deepEqual(applied[0],[-16388.25,4.25]);
  assert.throws(()=>ctx.api.start(),/köşe/);
  vm.runInContext('placeCorners(null,null)',ctx);
  assert.deepEqual(Array.from(ctx.visibleLineup),[true,true]);
  assert.deepEqual(applied[1],[-4.25,4.25]);
  assert.equal(ctx.stageDirty,false);
  assert.equal(clock,125.5);
  assert.equal(resets,1);
  assert.equal(ctx.started,false);
  assert.equal(ctx.resumePhysics,false);
  assert.equal(ctx.api.start().started,true);
  assert.equal(ctx.started,true);
  assert.equal(ctx.resumePhysics,true);
});
