'use strict';
// The HUD and camera target exactly the same waiting seats.
function waitingSeats(layout) {
  const seats=[], perimeter=[[-.62,-1],[.62,-1],[1,-.62],[1,.62],[.62,1],[-.62,1],[-1,.62],[-1,-.62]];
  for(let radius=layout.halfRing+4.8;radius<=layout.halfDeck-1.5;radius+=2.5){
    for(let section=0;section<perimeter.length;section++){
      const [x,z]=perimeter[section],[nx,nz]=perimeter[(section+1)%perimeter.length];
      const dx=nx-x,dz=nz-z,count=Math.max(1,Math.floor(radius*Math.hypot(dx,dz)/2.85));
      for(let col=0;col<count;col++){
        const t=(col+.5)/count;
        seats.push({x:layout.centerX+(x+t*dx)*radius,z:layout.centerZ+(z+t*dz)*radius,heading:Math.atan2(-dz,dx)});
      }
    }
  }
  return seats;
}
if(typeof module==='object'&&module.exports)module.exports={waitingSeats};
else globalThis.TikMngQueueLayout={waitingSeats};
