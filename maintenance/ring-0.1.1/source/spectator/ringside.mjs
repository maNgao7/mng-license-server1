import { Quaternion, Vector3 } from 'three';
import {readBoxerMesh,guardSway,guardCrown,softwareGuard,poseSteps} from './queue-model.mjs';
import {createArenaRenderer} from './arena-model.mjs';
import layout from '../assets/ring-layout.js';
import queueLayout from '../assets/queue-layout.js';

// All dimensions are in the native camera's Y-up world. This layer only paints.
const TAU = Math.PI * 2;
const UP = new Vector3(0, 1, 0);
const NEAR = .1;
const EMPTY = [];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const point = (x, y, z) => new Vector3(x, y, z);
const validPoint = p => p?.length === 3 && p.every(Number.isFinite);
const presets = {
  high:   { distance: 50, pixels: 72 },
  medium: { distance: 39, pixels: 56 },
  low:    { distance: 29, pixels: 42 }
};
const money = new Intl.NumberFormat('tr-TR');
// Rasterize the same native geometry for computers using the software renderer.
function boxerSprite(yaw,elevation,side,pixels,step=0) {
  const {triangles,light,material,rgba:shades,height,shoes}=readBoxerMesh(side);
  const position=softwareGuard(side,step);
  pixels*=1.96/height;
  const cy=Math.cos(yaw), sy=Math.sin(yaw), cp=Math.cos(elevation), sp=Math.sin(elevation);
  const count=position.length/3;
  const xs=new Float32Array(count), ys=new Float32Array(count), zs=new Float32Array(count);
  let left=Infinity, right=-Infinity, top=Infinity, bottom=-Infinity;
  for (let i=0;i<count;i++) {
    const x=position[i*3], y=position[i*3+1], z=position[i*3+2], depth=cy*z-sy*x;
    xs[i]=(cy*x+sy*z)*pixels;
    ys[i]=(sp*depth-cp*y)*pixels;
    zs[i]=cp*depth+sp*y;
    left=Math.min(left,xs[i]);right=Math.max(right,xs[i]);
    top=Math.min(top,ys[i]);bottom=Math.max(bottom,ys[i]);
  }
  const x0=Math.floor(left)-1, y0=Math.floor(top)-1;
  const tile=document.createElement('canvas');
  tile.width=Math.ceil(right)-x0+1;
  tile.height=Math.ceil(bottom)-y0+1;
  const ctx=tile.getContext('2d'), img=ctx.createImageData(tile.width,tile.height);
  const depthBuffer=new Float32Array(tile.width*tile.height).fill(-Infinity);
  const rgba=new Uint32Array(img.data.buffer);
  for (let f=0;f<triangles.length;f+=3) {
    const a=triangles[f], b=triangles[f+1], c=triangles[f+2];
    const dxB=xs[b]-xs[a], dyB=ys[b]-ys[a], dxC=xs[c]-xs[a], dyC=ys[c]-ys[a];
    const det=dxB*dyC-dyB*dxC;
    if (Math.abs(det)<1e-7) continue;
    const xmin=Math.ceil(Math.min(xs[a],xs[b],xs[c])-.5), xmax=Math.floor(Math.max(xs[a],xs[b],xs[c])-.5);
    const ymin=Math.ceil(Math.min(ys[a],ys[b],ys[c])-.5), ymax=Math.floor(Math.max(ys[a],ys[b],ys[c])-.5);
    for (let y=ymin;y<=ymax;y++) {
      for (let x=xmin;x<=xmax;x++) {
        const dx=x+.5-xs[a], dy=y+.5-ys[a];
        const wb=(dx*dyC-dy*dxC)/det, wc=(dxB*dy-dyB*dx)/det, wa=1-wb-wc;
        if (wa<0 || wb<0 || wc<0) continue;
        const depth=wa*zs[a]+wb*zs[b]+wc*zs[c], index=(y-y0)*tile.width+x-x0;
        if (depth<=depthBuffer[index]) continue;
        depthBuffer[index]=depth;
        const level=Math.round(wa*light[a]+wb*light[b]+wc*light[c]);
        rgba[index]=shades[material[a]*32+level];
      }
    }
  }
  ctx.putImageData(img,0,0);
  const pixel=([x,y,z])=>({x:(cy*x+sy*z)*pixels-x0,y:(sp*(cy*z-sy*x)-cp*y)*pixels-y0});
  return {tile,pixels,shoes:shoes.map(pixel),crown:pixel(guardCrown(side,step/poseSteps))};
}

// Match the two shoe contacts and crown in a cached (orthographic) tile to
// the current perspective view. Near a side-on or overhead view the anchors
// can line up. The tangent basis then supplies the missing scale and roll.
function placeSprite(pose,contacts,head,ax,ay,bx,by) {
  const [l,r]=pose.shoes, [left,right]=contacts;
  const mx=(l.x+r.x)/2, my=(l.y+r.y)/2;
  const sx=(left.x+right.x)/2, sy=(left.y+right.y)/2;
  const hx=pose.crown.x-mx, hy=pose.crown.y-my, fx=r.x-mx, fy=r.y-my;
  const prior=(pose.pixels*.18)**2;
  const xx=hx*hx+fx*fx+prior, xy=hx*hy+fx*fy, yy=hy*hy+fy*fy+prior;
  const det=xx*yy-xy*xy;
  function fit(a,b,headDelta,footDelta) {
    const u=hx*headDelta+fx*footDelta+prior*a, v=hy*headDelta+fy*footDelta+prior*b;
    return [(u*yy-v*xy)/det,(v*xx-u*xy)/det];
  }
  [ax,bx]=fit(ax,bx,head.x-sx,right.x-sx);
  [ay,by]=fit(ay,by,head.y-sy,right.y-sy);
  return {ax,ay,bx,by,x:sx-ax*mx-bx*my,y:sy-ay*mx-by*my};
}

// Sutherland-Hodgman, used in eye space for the near plane and in screen
// space for the depth crossing of two projected planes (1/z is affine).
function clipPolygon(vertices, distance, mix) {
  const out = [];
  let a = vertices.at(-1), da = distance(a);
  for (const b of vertices) {
    const db = distance(b);
    if ((da>=0)!==(db>=0)) out.push(mix(a,b,da/(da-db)));
    if (db>=0) out.push(b);
    a=b; da=db;
  }
  return out;
}
function cameraProjection(view,width,height) {
  const eye = new Vector3().fromArray(view.position);
  const inverse = new Quaternion().fromArray(view.rotation).invert();
  const scale = new Vector3().fromArray(view.scale);
  const fy = height/(2*Math.tan(view.fov/2)), fx = fy*width/(height*view.aspect);
  function local(p) {
    const v=p.clone().sub(eye).applyQuaternion(inverse).divide(scale);
    v.z=-v.z; return v;
  }
  function screen(p) { return {x:width*.5+fx*p.x/p.z,y:height*.5-fy*p.y/p.z,q:1/p.z}; }
  function project(p) { const v=local(p); return v.z>=NEAR ? screen(v) : null; }
  function polygon(points) {
    return clipPolygon(points.map(local),p=>p.z-NEAR,(a,b,t)=>a.clone().lerp(b,t)).map(screen);
  }
  return { eye, local, screen, project, polygon, width, height, fx, fy };
}
function bounds(points) {
  const b={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity,nearQ:0,farQ:Infinity};
  for (const p of points) {
    b.left=Math.min(b.left,p.x); b.right=Math.max(b.right,p.x);
    b.top=Math.min(b.top,p.y); b.bottom=Math.max(b.bottom,p.y);
    b.nearQ=Math.max(b.nearQ,p.q); b.farQ=Math.min(b.farQ,p.q);
  }
  return b;
}
const overlaps = (a,b) => a.left<b.right && b.left<a.right && a.top<b.bottom && b.top<a.bottom;
function pathOf(points,path=new Path2D()) {
  path.moveTo(points[0].x,points[0].y);
  for (let i=1;i<points.length;i++) path.lineTo(points[i].x,points[i].y);
  path.closePath(); return path;
}
function screenHull(points) {
  const sorted=points.slice().sort((a,b)=>a.x-b.x||a.y-b.y);
  const half=sequence=>{
    const chain=[];
    for (const p of sequence) {
      while (chain.length>=2) {
        const [a,b]=chain.slice(-2);
        if ((b.x-a.x)*(p.y-a.y)>(b.y-a.y)*(p.x-a.x)) break;
        chain.pop();
      }
      chain.push(p);
    }
    chain.pop(); return chain;
  };
  return half(sorted).concat(half(sorted.reverse()));
}
function depthPlane(poly) {
  const [a,b]=poly;
  for (const c of poly.slice(2)) {
    const det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);
    if (Math.abs(det)<1e-7) continue;
    const dx=((b.q-a.q)*(c.y-a.y)-(c.q-a.q)*(b.y-a.y))/det;
    const dy=((b.x-a.x)*(c.q-a.q)-(c.x-a.x)*(b.q-a.q))/det;
    return p=>a.q+(p.x-a.x)*dx+(p.y-a.y)*dy;
  }
  return ()=>a.q;
}
function outsidePath(cam,poly) {
  const path=new Path2D();
  path.rect(-1,-1,cam.width+2,cam.height+2);
  return pathOf(poly,path);
}
const boxFaces=[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]];
// The visible ring in this demo is offset from the physics origin. Values in
// game units, measured against the same pads and ropes from two camera angles.
const {centerX:RING_X,centerZ:RING_Z,halfRing:HALF_RING,halfDeck:DECK_HALF}=layout;
function nativeMasks(cam,view) {
  const masks=[];
  const viewport={left:0,top:0,right:cam.width,bottom:cam.height};
  function box(center,sx,sy,sz,rotation) {
    const verts=Array.from({length:8},(_,i)=>{
      const v=point((i&1?.5:-.5)*sx,(i&2?.5:-.5)*sy,(i&4?.5:-.5)*sz);
      if (rotation) v.applyQuaternion(rotation);
      return cam.local(v.add(center));
    });
    if (verts.every(v=>v.z<NEAR)) return;
    const faces=boxFaces.map(ids=>clipPolygon(ids.map(i=>verts[i]),p=>p.z-NEAR,(a,b,t)=>a.clone().lerp(b,t)).map(cam.screen))
      .filter(face=>face.length>=3);
    const points=faces.flat(), b=bounds(points);
    if (!overlaps(b,viewport)) return;
    // Close the clipped solid when the eye crosses a post, rope, body or apron.
    const cap=points.filter(p=>Math.abs(p.q-1/NEAR)<1e-6);
    if (cap.length>=3) faces.push(screenHull(cap));
    masks.push({b,faces,all:outsidePath(cam,screenHull(points))});
  }
  // Rope height and thickness are independent of the horizontal arena dimensions.
  // The view stream carries the mat Y plus heads and (in staging) shoe contacts.
  const floor=view.floor, rope=.785/5;
  // The native deck also occludes the waiting boxers when viewed from below.
  box(point(RING_X,floor-.049,RING_Z),DECK_HALF*2,.102,DECK_HALF*2);
  box(point(RING_X,floor-.28,RING_Z),HALF_RING*2+.8,.56,HALF_RING*2+.8);
  for (const s of [-1,1]) {
    for (const t of [-1,1]) {
      const yaw=new Quaternion().setFromAxisAngle(UP,s*t*Math.PI/4);
      box(point(RING_X+s*(HALF_RING-.32),floor+1.65,RING_Z+t*(HALF_RING-.32)),1.0,3.30,.50,yaw);
    }
    for (let i=0;i<4;i++) {
      const y=floor+.48+i*.75;
      box(point(RING_X+s*HALF_RING,y,RING_Z),rope,rope,2*HALF_RING);
      box(point(RING_X,y,RING_Z+s*HALF_RING),2*HALF_RING,rope,rope);
    }
  }
  // Keep the queue and arena behind the native fighters throughout the match.
  for (const [side,h] of (view.fighters||EMPTY).entries()) {
    if (!validPoint(h) || Math.max(Math.abs(h[0]),Math.abs(h[2]))>HALF_RING+1) continue;
    const head=new Vector3().fromArray(h), other=view.fighters[1-side];
    const yaw=validPoint(other)?Math.atan2(other[0]-h[0],other[2]-h[2]):Math.atan2(-h[0],-h[2]);
    const facing=new Quaternion().setFromAxisAngle(UP,yaw);
    const height=clamp(h[1]-floor,.6,4.5);
    const world=(x,fromFloor,z)=>point(x*height,(fromFloor-1)*height,z*height).applyQuaternion(facing).add(head);
    const segment=(a,b,width,depth)=>{
      const d=b.clone().sub(a);
      box(a.clone().lerp(b,.5),width,d.length()+.04,depth,new Quaternion().setFromUnitVectors(UP,d.normalize()));
    };
    box(head,height*.18,height*.23,height*.18,facing);
    box(world(0,.69,-.025),height*.34,height*.40,height*.21,facing);
    for (const [i,s] of [-1,1].entries()) {
      const sole=view.contacts?.[side]?.[i];
      const foot=validPoint(sole)?new Vector3().fromArray(sole):world(s*.135,.035,s*.095);
      segment(world(s*.09,.52,0),foot,height*.13,height*.14);
      segment(world(s*.16,.83,0),world(s*.22,.64,.09),height*.12,height*.13);
      segment(world(s*.22,.64,.09),world(s*.13,.87,.17),height*.12,height*.13);
      box(world(s*.13,.87,.17),height*.17,height*.17,height*.17,facing);
    }
  }
  return masks;
}
function maskInFront(ctx,cam,masks,b,at) {
  for (const mask of masks) {
    if (mask.b.nearQ<=b.farQ || !overlaps(mask.b,b)) continue;
    if (mask.b.farQ>=b.nearQ) { ctx.clip(mask.all,'evenodd'); continue; }
    for (const face of mask.faces) {
      const poly=clipPolygon(face,p=>p.q-at(p)-1e-7,(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,q:a.q+(b.q-a.q)*t}));
      if (poly.length>=3 && overlaps(bounds(poly),b)) ctx.clip(outsidePath(cam,poly),'evenodd');
    }
  }
}

// A rank follows one continuous lap before the next lane opens behind it.
// The queue can grow beyond the floor capacity; the panel retains every rank.
const QUEUE_SPACING=2.85, BOXER_HEIGHT=Math.max(readBoxerMesh(0).height,readBoxerMesh(1).height);
// Leave space for both shoes at the edge of the native wooden deck.
const LAST_QUEUE_RADIUS=DECK_HALF-1.5;
const perimeter=[[-.62,-1],[.62,-1],[1,-.62],[1,.62],[.62,1],[-.62,1],[-1,.62],[-1,-.62]];
function rowPlace(row) {
  return HALF_RING+4.8+row*2.5;
}
function seatPoint(radius,section,col,count) {
  const [x,z]=perimeter[section], [nextX,nextZ]=perimeter[(section+1)%perimeter.length];
  const dx=nextX-x, dz=nextZ-z, t=(col+.5)/count;
  return {x:RING_X+(x+t*dx)*radius,z:RING_Z+(z+t*dz)*radius,heading:Math.atan2(-dz,dx)};
}
function floorQueue() {
  const seats=[];
  for (let row=0;rowPlace(row)<=LAST_QUEUE_RADIUS;row++) {
    const radius=rowPlace(row);
    for (let section=0;section<perimeter.length;section++) {
      const [x,z]=perimeter[section], [nextX,nextZ]=perimeter[(section+1)%perimeter.length];
      const count=Math.max(1,Math.floor(radius*Math.hypot(nextX-x,nextZ-z)/QUEUE_SPACING));
      for (let col=0;col<count;col++) seats.push(seatPoint(radius,section,col,count));
    }
  }
  return seats;
}
const queueSeats=queueLayout.waitingSeats(layout);
function visitQueue(cam,floor,length,quality,visit) {
  const y=floor, dy=cam.eye.y-(y+BOXER_HEIGHT*.5);
  const horizontalRange=quality.distance**2-dy**2;
  const count=Math.min(length,queueSeats.length);
  for (let rank=0;rank<count;rank++) {
    const {x,z,heading}=queueSeats[rank];
    if ((x-cam.eye.x)**2+(z-cam.eye.z)**2<=horizontalRange)
      visit(rank,point(x,y,z),heading);
  }
}
function paintBadge(ctx,profile,img,x,y,size,side,rank) {
  const radius=clamp(size*.105,6,24), font=clamp(radius*.9,10,16);
  const cy=y-radius-3-(rank?2*(font+3):0);
  ctx.beginPath(); ctx.arc(x,cy,radius,0,TAU);
  ctx.fillStyle='#17232c'; ctx.fill();
  ctx.save(); ctx.clip();
  if (img?.naturalWidth) {
    const span=Math.min(img.naturalWidth,img.naturalHeight);
    ctx.drawImage(img,(img.naturalWidth-span)/2,(img.naturalHeight-span)/2,span,span,x-radius,cy-radius,2*radius,2*radius);
  } else {
    ctx.fillStyle='#fff'; ctx.font='bold '+Math.round(radius)+'px "Segoe UI"'; ctx.textAlign='center';
    ctx.fillText((profile?.nickname||profile?.uniqueId||'?').slice(0,1),x,cy+radius*.36);
  }
  ctx.restore(); ctx.strokeStyle=rank?'#d6bd8c':side?'#fb7875':'#78adff'; ctx.lineWidth=1.5; ctx.stroke();
  if (!rank) return;
  // Keep the number adjacent to its own portrait and legible without a photo.
  const label='#'+rank;
  ctx.font='bold '+font+'px "Segoe UI"'; ctx.textAlign='left';
  const w=ctx.measureText(label).width+6, left=x+radius*.65;
  ctx.fillStyle='#e7cd97'; ctx.fillRect(left,cy-font*.65,w,font+3);
  ctx.fillStyle='#18212a'; ctx.fillText(label,left+3,cy+font*.36);
  const handle=profile?.uniqueId?'@'+profile.uniqueId.replace(/^@/,''):profile?.nickname||'';
  const labelText=handle.length>20?handle.slice(0,19)+'…':handle;
  ctx.textAlign='center';
  const width=Math.min(146,ctx.measureText(labelText).width+8);
  ctx.fillStyle='#101923';ctx.fillRect(x-width/2,cy+radius-1,width,font+3);
  ctx.fillStyle='#fff';ctx.fillText(labelText,x,cy+radius+font-1,140);
  const score=money.format(profile?.fps??profile?.coins??0)+' FPS';
  ctx.font='600 '+clamp(font-1,9,14)+'px "Segoe UI"'; ctx.textAlign='center';
  const sw=ctx.measureText(score).width+6;
  ctx.fillStyle='#16212b'; ctx.fillRect(x-sw*.5,cy+radius+font+2,sw,font+3);
  ctx.fillStyle='#ffe5ad'; ctx.fillText(score,x,cy+radius+2*font+2);
}

// Four sections of the crowd take photos in small, staggered bursts. Only
// the individual light tiles are animated; the scene keeps its native exposure.
function phoneFlashes(firstTile) {
  if (!firstTile) return null;
  const sites=Array.from({length:64},(_,i)=>{
    const angle=(i+.2+.6*Math.random())*TAU/64;
    const radius=30+Math.random()*8;
    return point(RING_X+radius*Math.sin(angle),3.8+Math.random()*4,RING_Z+radius*Math.cos(angle));
  });
  const lights=Array.from({length:12},(_,i)=>{
    const tile=i===0 ? firstTile : firstTile.cloneNode(false);
    if (i) { tile.removeAttribute('id'); firstTile.before(tile); }
    tile.width=tile.height=36;
    return {tile,ctx:tile.getContext('2d'),site:null,fade:null};
  });
  let origin=Math.floor(Math.random()*sites.length);
  let enabled=false,timer=0,cam=null,masks=null,floor=0;
  function paint({tile,ctx,site}) {
    if (!site || !cam) { tile.hidden=true; return; }
    const p=cam.project(point(site.x,site.y+floor,site.z));
    if (!p || p.x<0 || p.y<0 || p.x>=cam.width || p.y>=cam.height) { tile.hidden=true; return; }
    const left=Math.floor(p.x)-18, top=Math.floor(p.y)-18;
    const radius=clamp(cam.fy*p.q*.38,5,15);
    const b={left:p.x-radius,right:p.x+radius,top:p.y-radius,bottom:p.y+radius,nearQ:p.q,farQ:p.q};
    ctx.clearRect(0,0,36,36);
    ctx.save();
    ctx.translate(-left,-top);
    maskInFront(ctx,cam,masks,b,()=>p.q);
    const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);
    glow.addColorStop(0,'white');
    glow.addColorStop(.29,'white');
    glow.addColorStop(.54,'rgba(205,227,255,.68)');
    glow.addColorStop(1,'rgba(167,205,255,0)');
    ctx.fillStyle=glow;
    ctx.fillRect(b.left,b.top,radius*2,radius*2);
    ctx.restore();
    tile.style.transform='translate('+left+'px,'+top+'px)';
    tile.hidden=false;
  }
  function dark(light) {
    light.fade?.cancel(); light.fade=null;
    light.site=null; light.tile.hidden=true;
  }
  function burst() {
    origin=(origin+9)%sites.length;
    lights.forEach((light,i)=>{
      dark(light);
      const section=Math.floor(i/3), order=i%3;
      light.site=sites[(origin+section*16+2*order)%sites.length];
      paint(light);
      const fade=light.tile.animate([{opacity:0},{opacity:1,offset:.07},{opacity:.94,offset:.38},{opacity:0}],
        {delay:order*48+Math.random()*40,duration:200+Math.random()*60,fill:'both'});
      light.fade=fade;
      fade.onfinish=()=>{ if (light.fade===fade) dark(light); };
    });
    timer=setTimeout(burst,420+Math.random()*260);
  }
  function setEnabled(value) {
    if (enabled===value) return;
    enabled=value;
    if (enabled) timer=setTimeout(burst,220);
    else { clearTimeout(timer); lights.forEach(dark); }
  }
  return {
    setEnabled,
    setView(camera,occluders,matHeight) {
      cam=camera; masks=occluders; floor=matHeight;
      for (const light of lights) if (light.site) paint(light);
    },
    dispose() {
      setEnabled(false);
      for (const {tile} of lights) if (tile!==firstTile) tile.remove();
    }
  };
}

window.createRingside=function createRingside(canvas) {
  const ctx=canvas?.getContext('2d');
  if (!ctx) return null;
  const arenaRenderer=createArenaRenderer(canvas.id==='ringside'?document.getElementById('stadium'):null,queueSeats.length);
  const flashes=phoneFlashes(document.getElementById('phone-flash'));
  let view,queue=EMPTY,quality=presets.high;
  let raf=0,disposed=false,previousKey='',previousQueue;
  let guardTimer=0, cameraKey, cam, masks;
  const portraits=new Map(), atlas=new Map(), pendingPictures=new Map();
  let inFlight=0;
  function schedule() { if (!raf && !disposed && view) raf=requestAnimationFrame(draw); }
  function animateQueue(visible) {
    if(visible && !guardTimer) guardTimer=setInterval(schedule,80);
    if(!visible && guardTimer) { clearInterval(guardTimer); guardTimer=0; }
  }
  function loadPictures() {
    while (!disposed && inFlight<4 && pendingPictures.size) {
      const [key,{img,urls}]=pendingPictures.entries().next().value;
      pendingPictures.delete(key);
      let i=0; inFlight++;
      const complete=()=>{ img.onload=null; img.onerror=null; inFlight--; schedule(); loadPictures(); };
      img.onload=complete;
      img.onerror=()=>{ if (!disposed && ++i<urls.length) img.src=urls[i]; else complete(); };
      img.src=urls[0];
    }
  }
  function picture(profile) {
    const urls=[...new Set([profile?.portrait,profile?.profilePictureUrl,...(profile?.profilePictureUrls||EMPTY)])]
      .filter(url=>typeof url==='string'&&/^(https:|file:)/i.test(url));
    if (!urls.length) return null;
    const key=urls.join('\n');
    if (portraits.has(key)) return portraits.get(key);
    if (portraits.size>=512) {
      const oldest=portraits.keys().next().value;
      pendingPictures.delete(oldest); portraits.delete(oldest);
    }
    const img=new Image(); img.referrerPolicy='no-referrer';
    portraits.set(key,img); pendingPictures.set(key,{img,urls}); loadPictures(); return img;
  }
  function sprite(yaw,pitch,side,step) {
    const a=((Math.round(yaw*8/Math.PI)%16)+16)%16, e=Math.round(pitch*8);
    const key=[quality.pixels,a,e,side,step].join('/');
    let value=atlas.get(key);
    if (!value) {
      if (atlas.size>=256) atlas.delete(atlas.keys().next().value);
      value=boxerSprite(a*Math.PI/8,e/8,side,quality.pixels,step);
    } else atlas.delete(key);
    atlas.set(key,value);
    return value;
  }
  function draw(time=performance.now()) {
    raf=0;
    if (disposed||!view||!Number.isFinite(view.floor)) return;
    const width=innerWidth,height=innerHeight;
    if (!width||!height) return;
    if (canvas.width!==width) canvas.width=width;
    if (canvas.height!==height) canvas.height=height;
    ctx.clearRect(0,0,width,height);
    if(cameraKey!==previousKey || cam?.width!==width || cam?.height!==height) {
      cam=cameraProjection(view,width,height); masks=nativeMasks(cam,view); cameraKey=previousKey;
    }
    flashes?.setView(cam,masks,view.floor);
    const viewport={left:0,top:0,right:width,bottom:height};
    const commands=[];
    let visible=0;
    function surface(world,color) {
      const poly=cam.polygon(world);
      if (poly.length<3) return;
      const b=bounds(poly);
      if (!overlaps(b,viewport)) return;
      const path=pathOf(poly);
      commands.push({b,at:depthPlane(poly),depth:poly.reduce((sum,p)=>sum+1/p.q,0)/poly.length,
        paint(){ctx.fillStyle=color;ctx.fill(path);}});
    }
    const entries=[];
    visitQueue(cam,view.floor,queue.length,quality,(index,foot,heading)=>{
      const mid=cam.local(point(foot.x,foot.y+BOXER_HEIGHT*.5,foot.z)),r=BOXER_HEIGHT*.65;
      if(mid.z+r<NEAR || Math.abs(mid.x)>r+(mid.z+r)*width/(2*cam.fx) ||
         Math.abs(mid.y)>r+(mid.z+r)*height/(2*cam.fy))return;
      entries.push({index,foot,heading,sway:guardSway(index,time)});
    });
    const gpuDrawn=arenaRenderer?.draw(view,masks,width,height,entries);
    function addBody(profile,{foot,heading,index,sway}) {
      const side=index%2, rank=index+1, kit=readBoxerMesh(side), h=kit.height;
      const mid=foot.clone(); mid.y+=h*.5;
      const m=cam.local(mid);
      if (m.z<=NEAR) return;
      const center=cam.screen(m), size=cam.fy*h/m.z/view.scale[1];
      if (size<6 || size>height*3 || center.x < -size || center.x>width+size || center.y < -size || center.y>height+size) return;
      const projectLocal=xyz=>cam.project(new Vector3().fromArray(xyz).applyAxisAngle(UP,heading).add(foot));
      const head=projectLocal(guardCrown(side,sway));
      if(!head)return;
      const badge={left:head.x-72,right:head.x+90,top:head.y-99,bottom:head.y,nearQ:head.q,farQ:head.q};
      const paintHead=()=>paintBadge(ctx,profile,picture(profile),head.x,head.y,size,side,rank);
      if(gpuDrawn) {
        visible++;
        commands.push({b:badge,at:()=>head.q,depth:1/head.q,paint:paintHead});
        return;
      }
      const ray=cam.eye.clone().sub(mid);
      const yaw=Math.atan2(ray.x,ray.z), pitch=Math.atan2(ray.y,Math.hypot(ray.x,ray.z));
      const right=point(Math.cos(yaw),0,-Math.sin(yaw));
      const up=ray.normalize().cross(right).normalize();
      const px=cam.project(mid.clone().add(right)), py=cam.project(mid.clone().add(up));
      if (!px||!py) return;
      const at=depthPlane([center,px,py]);
      const contacts=kit.shoes.map(projectLocal);
      if (!contacts.every(Boolean)) return;
      const pose=sprite(heading-yaw,pitch,side,Math.round(sway*poseSteps));
      const {x,y,ax,ay,bx,by}=placeSprite(pose,contacts,head,(px.x-center.x)/pose.pixels,
        (px.y-center.y)/pose.pixels,(center.x-py.x)/pose.pixels,(center.y-py.y)/pose.pixels);
      const {width:w,height:t}=pose.tile;
      const corners=[{x,y},{x:x+ax*w,y:y+ay*w},{x:x+bx*t,y:y+by*t},{x:x+ax*w+bx*t,y:y+ay*w+by*t}];
      const b=bounds(corners.map(p=>({...p,q:at(p)})));
      if (!overlaps(b,viewport)) return;
      commands.push({b,at,depth:m.z,paint(){
        ctx.transform(ax,ay,bx,by,x,y);ctx.drawImage(pose.tile,0,0);
      }});
      commands.push({b:badge,at:()=>head.q,depth:1/head.q,paint:paintHead});
      visible++;
    }
    for(const entry of entries){
      const profile=queue[entry.index];
      if (profile) addBody(profile,entry);
    }
    for (const pair of view.contacts||EMPTY) for (const contact of pair||EMPTY) {
      if (!validPoint(contact)) continue;
      const [x,y,z]=contact;
      // Two concentric footprints sit just above the sampled canvas plane.
      for (const [r,alpha] of [[.27,.09],[.18,.16]]) {
        const outline=Array.from({length:12},(_,i)=>point(x+Math.cos(i*TAU/12)*r,y+.012,z+Math.sin(i*TAU/12)*r*1.35));
        surface(outline,'rgba(9,14,17,'+alpha+')');
      }
    }
    commands.sort((a,b)=>b.depth-a.depth);
    for (const c of commands) {
      ctx.save(); maskInFront(ctx,cam,masks,c.b,c.at); c.paint(); ctx.restore();
    }
    canvas.dataset.visibleBoxers=String(visible); canvas.hidden=!commands.length;
    animateQueue(visible>0);
  }
  function resize() { previousKey='';schedule(); }
  window.addEventListener('resize',resize);
  return {
    update(nextView,nextQueue,settings={}) {
      if (disposed) return;
      view=nextView; queue=nextQueue||EMPTY;
      flashes?.setEnabled(Number.isFinite(view?.floor) && settings?.flashes!==false);
      quality=Object.hasOwn(presets,settings?.quality)?presets[settings.quality]:presets.high;
      if (!view||!Number.isFinite(view.floor)) {
        animateQueue(false);
        cancelAnimationFrame(raf); raf=0;
        canvas.hidden=true; arenaRenderer?.hide(); canvas.dataset.visibleBoxers='0'; previousKey=''; return;
      }
      const key=[view.position,view.rotation,view.scale,view.fov,view.aspect,view.floor,view.contacts,view.fighters,
        quality.pixels].join('|');
      if (key===previousKey && queue===previousQueue) return;
      previousKey=key;previousQueue=queue;schedule();
    },
    dispose() {
      animateQueue(false);
      flashes?.dispose();
      disposed=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);arenaRenderer?.dispose();
      pendingPictures.clear();atlas.clear();portraits.clear();
    }
  };
};
