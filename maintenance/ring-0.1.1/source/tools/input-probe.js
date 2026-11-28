'use strict';
// Read-only observations of the pinned game's own native input mapping.
const game = Process.getModuleByName('boxing.exe');
const seen = new Map();
let count = 0, lastSummary = 0;
function bytes(p, size) { return Array.from(new Uint8Array(p.readByteArray(size))); }
function floats(p, size) {
  return Array.from({length:size}, (_,i) => p.add(i*4).readFloat());
}
Interceptor.attach(game.base.add(0x2B64340), {
  onEnter(args) { this.state = args[0]; },
  onLeave() {
    const key = this.state.toString();
    const data = bytes(this.state, 0x1b0);
    const old = seen.get(key);
    if (!old) send({type:'input-instance',index:seen.size,bytes:data});
    else {
      const changed=[];
      for(let i=0x148;i<data.length;i++) if(data[i]!==old[i]) changed.push([i,old[i],data[i]]);
      if(changed.length && Date.now()-lastSummary>100) {
        send({type:'input-change',index:[...seen.keys()].indexOf(key),changes:changed.slice(0,64)});
        lastSummary=Date.now();
      }
    }
    seen.set(key,data); count++;
  },
});
Interceptor.attach(game.base.add(0x2B62070), {
  onEnter(args) { this.out = args[0]; this.source = args[1]; this.mode = args[2].toInt32()&255; },
  onLeave() {
    const key='snapshot-'+this.source.toString()+'-'+this.mode;
    const data=bytes(this.out,0x140);
    const old=seen.get(key);
    if(!old) send({type:'snapshot',mode:this.mode,bytes:data,floatValues:floats(this.out,0x50)});
    else if(JSON.stringify(old.slice(0xd8))!==JSON.stringify(data.slice(0xd8))&&Date.now()-lastSummary>100) {
      const changed=[];
      for(let i=0xd8;i<data.length;i++) if(data[i]!==old[i])changed.push([i,old[i],data[i]]);
      send({type:'snapshot-change',mode:this.mode,changes:changed.slice(0,80)});
      lastSummary=Date.now();
    }
    seen.set(key,data);
  },
});
rpc.exports = {
  sample() { return {frames:count,instances:seen.size}; },
};
send({type:'attached',mode:'original-input-read-only'});
