import {BufferGeometry,BufferAttribute,Mesh,MeshBasicMaterial,DoubleSide,Scene,Camera,PerspectiveCamera,WebGLRenderer,DynamicDrawUsage} from 'three';
import {createQueueInstances} from './queue-model.mjs';

export function createArenaRenderer(canvas,queueCapacity) {
  if(!canvas)return null;
  let renderer;
  try{renderer=new WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});}
  catch{return null;}
  renderer.autoClear=false;renderer.setClearColor(0,0);
  const scene=new Scene(),depthScene=new Scene(),camera=new PerspectiveCamera(),screenCamera=new Camera();
  const depthMat=new MeshBasicMaterial({colorWrite:false,side:DoubleSide});
  const depthMesh=new Mesh(new BufferGeometry(),depthMat);
  depthMesh.frustumCulled=false;depthScene.add(depthMesh);
  let maskBuffer,boxers;
  function draw(view,masks,width,height,entries){
    if(renderer.getContext().isContextLost()){canvas.hidden=true;return false;}
    if(!entries.length){canvas.hidden=true;return true;}
    if(canvas.width!==width||canvas.height!==height)renderer.setSize(width,height,false);
    canvas.hidden=false;
    camera.fov=view.fov*180/Math.PI;camera.aspect=view.aspect;camera.near=.1;camera.far=10000;
    camera.position.fromArray(view.position);camera.quaternion.fromArray(view.rotation);camera.scale.fromArray(view.scale);
    camera.updateProjectionMatrix();camera.updateMatrixWorld();
    const near=camera.near,far=camera.far;
    const count=masks.reduce((n,m)=>n+m.faces.reduce((s,f)=>s+Math.max(0,f.length-2)*3,0),0);
    if(!maskBuffer||maskBuffer.count<count){
      depthMesh.geometry.dispose();depthMesh.geometry=new BufferGeometry();
      maskBuffer=new BufferAttribute(new Float32Array(Math.max(count*2,512)*3),3).setUsage(DynamicDrawUsage);
      depthMesh.geometry.setAttribute('position',maskBuffer);
    }
    let index=0;
    for(const mask of masks)for(const face of mask.faces)for(let j=2;j<face.length;j++){
      for(const p of [face[0],face[j-1],face[j]])maskBuffer.setXYZ(index++,2*p.x/width-1,1-2*p.y/height,
        (far+near-2*far*near*p.q)/(far-near));
    }
    maskBuffer.needsUpdate=true;depthMesh.geometry.setDrawRange(0,count);
    if(!boxers)boxers=createQueueInstances(scene,queueCapacity);
    boxers?.place(entries);
    renderer.clear();renderer.render(depthScene,screenCamera);renderer.render(scene,camera);
    return true;
  }
  return {draw,hide(){canvas.hidden=true;},
    dispose(){boxers?.dispose();depthMesh.geometry.dispose();depthMat.dispose();renderer.dispose();}};
}
