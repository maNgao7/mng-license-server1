(function(root) {
  class RoundGate {
    started = false;
    advance(count, threshold) {
      if (count >= Math.max(2, Math.min(100, Number(threshold)||5))) this.started = true;
      return this.started;
    }
    reset() { this.started = false; }
  }
  function contact(first, second, radius, ratio) {
    const distance = Math.hypot(first.x-second.x,first.y-second.y);
    const large=first.mass>=second.mass?first:second, small=large===first?second:first;
    if(distance>radius(first.mass)+radius(second.mass))return {kind:'none',distance,large,small};
    if(large.mass<small.mass*ratio)return {kind:'split',distance,large,small};
    return {kind:distance<radius(large.mass)+radius(small.mass)*0.4?'eat':'touch',distance,large,small};
  }
  function separate(first,second,radius) {
    const distance=Math.hypot(first.x-second.x,first.y-second.y);
    const minimum=(radius(first.mass)+radius(second.mass))*0.98;
    if(distance>=minimum)return;
    const dx=distance>0.001?(first.x-second.x)/distance:1;
    const dy=distance>0.001?(first.y-second.y)/distance:0;
    const correction=(minimum-distance)/2;
    first.x+=dx*correction;first.y+=dy*correction;second.x-=dx*correction;second.y-=dy*correction;
    first.vx+=dx*55;first.vy+=dy*55;second.vx-=dx*55;second.vy-=dy*55;
  }
  root.OrbitCollision={RoundGate,contact,separate};
})(globalThis);
