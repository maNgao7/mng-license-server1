import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const loader=new THREE.TextureLoader(),textures=new Map();
function texture(url){
    if(!textures.has(url))textures.set(url,loader.loadAsync(url).then(value=>{value.colorSpace=THREE.SRGBColorSpace;return value;}).catch(error=>{textures.delete(url);throw error;}));
    return textures.get(url);
}
const material=(color,metalness=.9,roughness=.2)=>new THREE.MeshPhysicalMaterial({color,metalness,roughness,clearcoat:1,clearcoatRoughness:.1});
const gold=()=>material('#edb841',.94,.19),silver=()=>material('#d5e3fa',.92,.13);

function bezel(state,color){
    const radius=state.kind==='gold'?.705:.665;
    const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.019,12,112),material(color));
    ring.position.y=state.centerY;ring.position.z=.1;state.scene.add(ring);
    return ring;
}
function buildGold(state){
    const group=new THREE.Group();group.position.y=state.centerY;state.scene.add(group);
    const rim=bezel(state,'#ffd879');
    const coins=[];
    for(let i=0;i<8;i++){
        const coin=new THREE.Group(),radius=.073+(i%2)*.009;
        const edge=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,.017,40),gold());edge.rotation.x=Math.PI/2;coin.add(edge);
        for(const side of [-1,1]){
            const face=new THREE.Mesh(new THREE.CircleGeometry(radius*.98,40),new THREE.MeshStandardMaterial({map:state.coinTexture,metalness:.6,roughness:.26,transparent:true,alphaTest:.12,side:THREE.DoubleSide}));
            face.position.z=side*.01;coin.add(face);
        }
        const lip=new THREE.Mesh(new THREE.TorusGeometry(radius,.004,6,40),gold());lip.position.z=.01;coin.add(lip);
        coin.userData.angle=i/8*Math.PI*2+.2;coins.push(coin);group.add(coin);
    }
    const jewels=new THREE.Group();jewels.position.y=state.centerY;state.scene.add(jewels);
    for(let i=0;i<12;i++){
        const a=i/12*Math.PI*2,gem=new THREE.Mesh(new THREE.OctahedronGeometry(.022),material(i%3?'#fff2bf':'#bf2747',.3,.12));
        gem.position.set(Math.cos(a)*.714,Math.sin(a)*.714,.13);gem.rotation.z=a;jewels.add(gem);
    }
    state.update=time=>{
        group.rotation.z=Math.sin(time*.3)*.025;
        for(let i=0;i<coins.length;i++){
            const coin=coins[i],angle=coin.userData.angle,r=.875+.016*Math.sin(time*1.6-i*.5);
            coin.position.set(Math.cos(angle)*r,Math.sin(angle)*r,.13);
            coin.rotation.y=time*.95+i*.65;coin.rotation.z=Math.sin(time*.7+i)*.1;
        }
        jewels.rotation.z=time*.13;rim.rotation.z=time*.08;
        state.keyLight.position.x=1.4+Math.sin(time*.45)*1.8;
    };
}
function buildCrystal(state){
    bezel(state,'#e5eaff');const rings=[];
    for(let i=0;i<3;i++){
        const group=new THREE.Group(),radius=.87+i*.035;
        const body=new THREE.Mesh(new THREE.TorusGeometry(radius,.018,12,112),silver());group.add(body);
        for(const offset of [-.025,.025]){
            const rail=new THREE.Mesh(new THREE.TorusGeometry(radius+offset,.004,5,112),material('#ba91d5',.8,.18));group.add(rail);
        }
        for(let j=0;j<8;j++){
            const a=j/8*Math.PI*2,gem=new THREE.Mesh(new THREE.OctahedronGeometry(j%2?.025:.04),material(j%2?'#c2f6ff':'#9288f2',.25,.08));
            gem.position.set(Math.cos(a)*radius,Math.sin(a)*radius,.021);gem.rotation.z=a;group.add(gem);
        }
        group.position.y=state.centerY;state.scene.add(group);rings.push(group);
    }
    state.update=time=>{
        rings.forEach((ring,i)=>{
            ring.rotation.set(.35+Math.sin(time*.45+i*2)*.6,Math.cos(time*.35+i*2)*.55,time*(i%2?-.24:.2)+i*1.05);
            ring.position.z=Math.sin(time*.5+i*2)*.2;
        });
        state.keyLight.position.set(Math.cos(time*.4)*3,2,3);
    };
}
const fireVertex=`varying vec2 vUv;uniform float time;uniform float seed;void main(){vUv=uv;vec3 p=position;p.x+=sin(uv.y*8.-time*3.+seed)*.018*uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const fireFragment=`varying vec2 vUv;uniform sampler2D map;uniform float time;uniform float seed;uniform float intensity;void main(){vec2 uv=vUv;uv.x+=sin(uv.y*11.-time*4.+seed)*.018*uv.y;uv.y*=.96+.035*sin(time*3.+seed);vec4 c=texture2D(map,uv);c.a*=intensity*smoothstep(0.,.08,vUv.y);if(c.a<.006)discard;gl_FragColor=c;#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include');
function buildEmber(state){
    const rim=bezel(state,'#dc8f39'),flames=[];
    for(let i=0;i<18;i++){
        const shader=new THREE.ShaderMaterial({uniforms:{map:{value:state.flameTexture},time:{value:0},seed:{value:i*.61},intensity:{value:.8}},vertexShader:fireVertex,fragmentShader:fireFragment,transparent:true,depthWrite:false,side:THREE.DoubleSide});
        const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.38,.63,8,12),shader);
        const a=.12+i/17*(Math.PI-.24),x=Math.cos(a)*.84,y=Math.sin(a)*.73-.12;
        mesh.position.set(x,y+.14,0);mesh.rotation.z=-Math.cos(a)*.16;state.scene.add(mesh);flames.push({mesh,x,y,i});
    }
    const positions=new Float32Array(36*3),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const sparks=new THREE.Points(geometry,new THREE.PointsMaterial({color:'#ffcd7a',size:.012,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending}));state.scene.add(sparks);
    state.update=time=>{
        for(const {mesh,y,i} of flames){
            mesh.material.uniforms.time.value=time;mesh.material.uniforms.intensity.value=.72+Math.sin(time*2.1+i)*.14;
            mesh.scale.set(.86+Math.sin(time*1.6+i)*.1,.78+Math.sin(time*2.6+i*.7)*.17,1);mesh.position.y=y+.14+Math.sin(time*1.3+i)*.015;
        }
        for(let i=0;i<36;i++){
            const phase=(time*(.12+i%4*.02)+i*.618)%1,side=i%2?1:-1;
            positions[i*3]=side*(.73+i%5*.035)+Math.sin(time+i)*.015;positions[i*3+1]=-.75+phase*1.7;positions[i*3+2]=.12;
        }
        geometry.attributes.position.needsUpdate=true;
        rim.material.emissive.set('#9b3100');rim.material.emissiveIntensity=.18+Math.sin(time*3)*.07;
    };
}
export async function mount(node,options={}){
    const kind=options.kind;
    if(!['gold','crystal','ember'].includes(kind))throw new Error('Unknown champion frame');
    const state={node,kind,inView:true,clock:1,frames:0,work:0,ready:false,disposed:false};
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let raf=0,last=0,observer=null;
    const active=()=>!state.disposed&&state.ready&&!reduced.matches&&(!options.preview||state.inView&&!document.hidden);
    function render(time){
        if(!state.ready||state.disposed)return;
        const start=performance.now();state.update(time);state.renderer.render(state.scene,state.camera);
        state.frames++;state.work=performance.now()-start;
    }
    function schedule(){if(!raf&&active())raf=requestAnimationFrame(frame);}
    function frame(now){
        raf=0;if(!active()){last=0;return;}
        if(last&&now-last<1000/30-1){schedule();return;}
        const dt=last?Math.min(.07,(now-last)/1000):1/30;last=now;state.clock+=dt;render(state.clock);schedule();
    }
    function sync(){cancelAnimationFrame(raf);raf=0;last=0;schedule();}
    function dispose(){
        if(state.disposed)return;
        state.disposed=true;cancelAnimationFrame(raf);observer?.disconnect();
        reduced.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);removeEventListener('pagehide',dispose);
        const geometries=new Set(),materials=new Set();
        state.scene?.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)for(const item of [object.material].flat())materials.add(item);});
        for(const item of geometries)item.dispose();for(const item of materials)item.dispose();
        state.environment?.dispose();state.renderer?.dispose();state.renderer?.forceContextLoss();state.renderer?.domElement.remove();state.ready=false;
    }
    const controller={dispose,stats:()=>({kind,ready:state.ready,disposed:state.disposed,frames:state.frames,lastDrawMs:state.work,error:state.error||null}),drawAt:render,pixelStats:()=>{
        if(!state.ready||state.disposed)return {painted:0,center:0,hash:0};
        const gl=state.renderer.getContext(),bytes=new Uint8Array(600*600*4);gl.readPixels(0,0,600,600,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
        let painted=0,hash=0;for(let i=0;i<bytes.length;i+=16){if(bytes[i+3])painted++;hash=(Math.imul(hash,31)+bytes[i]+bytes[i+3])>>>0;}
        return {painted,hash,center:bytes[(300*600+300)*4+3]};
    }};
    try{
        // Only the selected design's extra texture is requested; score updates reuse this scene.
        if(kind==='gold')state.coinTexture=await texture(options.assetURL(options.textures.coin));
        if(kind==='ember')state.flameTexture=await texture(options.assetURL(options.textures.flame));
        if(!node.isConnected)return controller;
        const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:true});
        renderer.setSize(600,600,false);renderer.setPixelRatio(1);renderer.setClearColor(0,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
        renderer.domElement.dataset.motionLayer='sculpted';node.append(renderer.domElement);
        const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1.05,1.05,1.05,-1.05,.1,20);camera.position.z=5;
        const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04,0.1,10);scene.environment=environment.texture;room.dispose();pmrem.dispose();
        const keyLight=new THREE.DirectionalLight('#fff4de',3);keyLight.position.set(-2,3,4);scene.add(keyLight);
        const fill=new THREE.DirectionalLight('#d0eaff',1.6);fill.position.set(2,-1,3);scene.add(fill);scene.add(new THREE.AmbientLight('#fff',.45));
        state.centerY=state.kind==='gold'?0:.042;
        // A depth-only disc protects the complete circular photo aperture, including during tilted orbits.
        const shield=new THREE.Mesh(new THREE.CircleGeometry(state.kind==='gold'?.69:.65,96),new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true}));
        shield.position.set(0,state.centerY,2);shield.renderOrder=-100;scene.add(shield);
        Object.assign(state,{renderer,scene,camera,keyLight,environment});
        ({gold:buildGold,crystal:buildCrystal,ember:buildEmber})[state.kind](state);
        state.ready=true;node.dataset.motion='sculpted';render(1);
        if(options.preview){observer=new IntersectionObserver(entries=>{state.inView=entries[0]?.isIntersecting!==false;sync();},{threshold:.01});observer.observe(node);document.addEventListener('visibilitychange',sync);}
        reduced.addEventListener('change',sync);addEventListener('pagehide',dispose,{once:true});schedule();
    }catch(error){
        state.error=String(error.message);dispose();node.dataset.motion='static';
    }
    return controller;
}
