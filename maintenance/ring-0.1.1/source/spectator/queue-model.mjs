import {BufferGeometry, BufferAttribute, CanvasTexture, InstancedMesh, Object3D,
  MeshBasicMaterial, PlaneGeometry, DoubleSide} from 'three';
import baked from './queue-boxer.json';

const bytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const swayDistance=.20, dipDistance=.15;
export const poseSteps=4; // Nine shared guard silhouettes in the software atlas.

export function guardSway(index,timeMs) {
  return Math.sin(timeMs*(.0028+(index%3)*.0002)+index*2.4);
}

function rigGuard(position,side) {
  const sway=new Float32Array(position.length), dip=new Float32Array(position.length);
  const shoes=[[0,0,0],[0,0,0]], samples=[0,0];
  // Each captured arm is an upper-arm block, forearm block and round glove.
  // The blue kit's capture starts at a shoe, so the two arm runs start later.
  const firstArm=side===0?144:264, armLength=24+24+362;
  for(let i=0;i<position.length;i+=3) {
    const x=position[i], y=position[i+1], z=position[i+2];
    if(y<.025) {
      const shoe=Number(x>0);
      shoes[shoe][0]+=x; shoes[shoe][2]+=z; samples[shoe]++;
    }
    const t=Math.max(0,Math.min(1,(y-.32)/2.45)), weight=t*t*(3-2*t);
    sway[i]=swayDistance*weight;
    dip[i+1]=-dipDistance*weight;
    const arm=i/3-firstArm;
    if(arm>=0 && arm<2*armLength) {
      // Keep each glove rigid. Let the guard travel from shoulder to wrist.
      const part=arm%armLength;
      const lift=part<24?0:part<48?Math.max(0,Math.min(1,(y-3.10)/.48)):1;
      const reach=arm<armLength?lift:-lift;
      sway[i+1]=.13*reach;
      sway[i+2]=.23*reach;
    }
  }
  shoes.forEach((shoe,i)=>{shoe[0]/=samples[i];shoe[2]/=samples[i];});
  return {sway,dip,shoes};
}

const decoded = baked.kits.map((kit,side) => {
  const shades=bytes(kit.shades);
  const rgba=new Uint32Array(shades.length/3);
  for(let i=0;i<rgba.length;i++) rgba[i]=(0xff000000 | shades[i*3+2]<<16 | shades[i*3+1]<<8 | shades[i*3])>>>0;
  const position=Float32Array.from(new Int16Array(bytes(kit.position).buffer),n=>n/4096);
  return {height:kit.height,crown:kit.crown,parts:kit.parts,position,...rigGuard(position,side),
    triangles:new Uint16Array(bytes(kit.triangles).buffer),material:bytes(kit.material),
    light:bytes(kit.light),shades,rgba};
});
export const readBoxerMesh = side => decoded[side % decoded.length];

export function guardCrown(side,sway) {
  const [x,y,z]=readBoxerMesh(side).crown;
  return [x+swayDistance*sway,y-dipDistance*sway*sway,z];
}

const poses=decoded.map(()=>new Map());
export function softwareGuard(side,step) {
  const kit=readBoxerMesh(side);
  if(step===0)return kit.position;
  const cache=poses[side];
  if(!cache.has(step)) {
    const sway=step/poseSteps;
    cache.set(step,kit.position.map((v,i)=>v+kit.sway[i]*sway+kit.dip[i]*sway*sway));
  }
  return cache.get(step);
}

export function createQueueInstances(scene,capacity) {
  const influences={morphTargetInfluences:[0,0]};
  const linear=Float32Array.from({length:256},(_,i)=>{
    const c=i/255;
    return c<=.04045 ? c/12.92 : ((c+.055)/1.055)**2.4;
  });
  const groups=decoded.map(data=>{
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new BufferAttribute(data.position,3));
    geometry.morphTargetsRelative=true;
    geometry.morphAttributes.position=[data.sway,data.dip].map(delta=>new BufferAttribute(delta,3));
    const colors=new Float32Array(data.position.length);
    data.material.forEach((material,i)=>{
      const first=(material*32+data.light[i])*3;
      for(let c=0;c<3;c++) colors[i*3+c]=linear[data.shades[first+c]];
    });
    geometry.setAttribute('color',new BufferAttribute(colors,3));
    geometry.setIndex(new BufferAttribute(data.triangles,1));
    const mesh=new InstancedMesh(geometry,new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),Math.ceil(capacity/2));
    // Three sizes the instance morph texture from count on the first write.
    mesh.setMorphAt(0,influences);
    mesh.frustumCulled=false; mesh.count=0; scene.add(mesh);
    return mesh;
  });
  const patch=document.createElement('canvas');
  patch.width=patch.height=32;
  const brush=patch.getContext('2d'),radial=brush.createRadialGradient(16,16,1,16,16,16);
  radial.addColorStop(0,'rgba(13,12,11,.36)'); radial.addColorStop(1,'rgba(13,12,11,0)');
  brush.fillStyle=radial; brush.fillRect(0,0,32,32);
  const groundMaterial=new MeshBasicMaterial({map:new CanvasTexture(patch),transparent:true,depthWrite:false});
  const ground=new InstancedMesh(new PlaneGeometry(2.65,2.25).rotateX(-Math.PI/2),groundMaterial,capacity);
  ground.frustumCulled=false; ground.count=0; scene.add(ground);
  const pose=new Object3D();
  return {
    place(entries) {
      for (const group of groups) group.count=0;
      ground.count=0;
      for (const {index,foot,heading,sway=0} of entries) {
        const group=groups[index%groups.length];
        pose.position.copy(foot); pose.rotation.y=heading;
        pose.updateMatrix();
        influences.morphTargetInfluences[0]=sway;
        influences.morphTargetInfluences[1]=sway*sway;
        group.setMorphAt(group.count,influences);
        group.setMatrixAt(group.count++,pose.matrix);
        pose.position.y+=.012; pose.updateMatrix();
        ground.setMatrixAt(ground.count++,pose.matrix);
      }
      for (const group of groups) if (group.count) {
        group.instanceMatrix.needsUpdate=true;
        group.morphTexture.needsUpdate=true;
      }
      if (ground.count) ground.instanceMatrix.needsUpdate=true;
    },
    dispose() {
      for (const group of groups) {
        scene.remove(group);
        group.geometry.dispose(); group.material.dispose(); group.dispose();
      }
      scene.remove(ground); groundMaterial.map.dispose(); groundMaterial.dispose(); ground.geometry.dispose(); ground.dispose();
    }
  };
}
