'use strict';
const {waitingSeats}=require('../assets/queue-layout.js');
const seats=waitingSeats(require('../assets/ring-layout.js'));
function waitingTarget(queue,view){
  if(!Array.isArray(queue)||!view||!Number.isFinite(view.floor)||!Array.isArray(view.rotation)||view.rotation.length!==4
    ||!Array.isArray(view.position)||view.position.length!==3||!view.rotation.every(Number.isFinite)||!view.position.every(Number.isFinite)
    ||!(view.fov>0&&view.fov<Math.PI&&view.aspect>0)||!Array.isArray(view.scale)||view.scale.some(s=>!Number.isFinite(s)||Math.abs(s)<1e-6))return null;
  const norm=Math.hypot(...view.rotation);if(Math.abs(norm-1)>.002)return null;
  const [qx,qy,qz,qw]=view.rotation.map(v=>v/norm),f=1/Math.tan(view.fov/2);
  let best=null;
  for(let i=0;i<Math.min(queue.length,seats.length);i++){
    const point=[seats[i].x,view.floor+1.25,seats[i].z];
    const [x,y,z]=point.map((v,j)=>v-view.position[j]);
    const tx=2*(-qy*z+qz*y),ty=2*(-qz*x+qx*z),tz=2*(-qx*y+qy*x);
    const local=[(x+qw*tx-qy*tz+qz*ty)/view.scale[0],(y+qw*ty-qz*tx+qx*tz)/view.scale[1],(z+qw*tz-qx*ty+qy*tx)/view.scale[2]];
    if(local[2]>=-.1)continue;
    const dx=local[0]*f/view.aspect/-local[2]/2,dy=local[1]*f/-local[2]/2,d=Math.hypot(dx,dy);
    if(d<.12&&(!best||d<best.distance-0.00001||(Math.abs(d-best.distance)<0.00001&&-local[2]<best.depth)))best={userId:queue[i].id,point,distance:d,depth:-local[2]};
  }
  return best;
}
module.exports={waitingTarget};
