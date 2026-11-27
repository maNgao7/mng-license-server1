import * as T from './three.module.js';
import { RoomEnvironment } from './RoomEnvironment.js';

export function createLootModel(host, { variant = 'case', quality = 'auto', onError = () => {} } = {}) {
    const win = host.ownerDocument.defaultView;
    const low = quality === 'low' || quality === 'auto' && win.navigator.hardwareConcurrency <= 4;
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: !low, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, low ? 1 : 1.5));
    renderer.setSize(820, 280, false); renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
    const canvas = renderer.domElement; canvas.className = 'loot-model'; canvas.setAttribute('aria-hidden', 'true'); host.prepend(canvas);
    const scene = new T.Scene(), model = new T.Group(), camera = new T.OrthographicCamera(-410, 410, 140, -140, .1, 2000);
    camera.position.set(0, 110, 700); camera.lookAt(0, 0, 0); scene.add(model);
    const key = new T.DirectionalLight(0xfff3d7, 3.4); key.position.set(-220, 320, 400); scene.add(key);
    const rim = new T.DirectionalLight(0xc6f8ee, 2.4); rim.position.set(230, 80, 120); scene.add(rim, new T.HemisphereLight(0xffffff, 0x283a37, 1.7));
    const geometries = new Set(), materials = new Set();
    const material = options => { const m = new T.MeshPhysicalMaterial({ clearcoat: .8, ...options }); materials.add(m); return m; };
    const silver = material({ color: 0xc6d9dc, metalness: .85, roughness: .24 });
    const gold = material({ color: 0xefce79, metalness: .8, roughness: .2 });
    const enamel = material({ color: 0x1d6658, metalness: .45, roughness: .3 });
    const interior = material({ color: 0x102521, metalness: .22, roughness: .65 });
    const foil = material({ color: 0xa6d7c0, metalness: .92, roughness: .19, iridescence: .8, iridescenceIOR: 1.5 });
    const light = new T.MeshBasicMaterial({ color: 0xe4ffc0, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }); materials.add(light);
    const unit = new T.BoxGeometry(1, 1, 1); geometries.add(unit);
    function mesh(parent, geometry, surface, x=0, y=0, z=0) { const m = new T.Mesh(geometry, surface); m.position.set(x,y,z); parent.add(m); return m; }
    function box(parent,w,h,d,surface,x=0,y=0,z=0) { const m = mesh(parent,unit,surface,x,y,z);m.scale.set(w,h,d);return m; }
    function bevel(w,h,d,r=5) {
        const shape = new T.Shape(), a=w/2,b=h/2;
        shape.moveTo(-a+r,-b);shape.lineTo(a-r,-b);shape.quadraticCurveTo(a,-b,a,-b+r);shape.lineTo(a,b-r);shape.quadraticCurveTo(a,b,a-r,b);
        shape.lineTo(-a+r,b);shape.quadraticCurveTo(-a,b,-a,b-r);shape.lineTo(-a,-b+r);shape.quadraticCurveTo(-a,-b,-a+r,-b);
        const g = new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelSize:2,bevelThickness:2,bevelSegments:2,curveSegments:4});g.translate(0,0,-d/2);geometries.add(g);return g;
    }
    let lid, locks=[], pack, tear;
    if (variant === 'case') {
        model.rotation.y = -.26; model.position.y = -29;
        box(model,274,16,133,silver,0,-47,0);box(model,248,4,109,interior,0,-36,0);
        for (const side of [-1,1]) { box(model,16,76,130,enamel,side*129,-4,0);box(model,268,76,12,enamel,0,-4,side*61); }
        for (const side of [-1,1]) for (const z of [-1,1]) box(model,20,80,8,silver,side*128,-3,z*69);
        for (let i=0;i<7;i++) box(model,2,55,3,silver,(i-3)*32,-3,69);
        lid = new T.Group(); lid.position.set(0,35,-65);model.add(lid);
        box(lid,278,18,136,silver,0,3,65);box(lid,254,9,115,enamel,0,16,65);
        const badge = box(lid,49,3,35,gold,0,23,65);badge.rotation.y = .4;
        box(lid,34,3,21,enamel,0,25,65);
        for (const side of [-1,1]) { const lock=box(model,18,29,9,gold,side*80,25,72);locks.push(lock); }
    } else if (variant === 'pack') {
        pack = new T.Group(); model.add(pack);pack.rotation.z=.08;
        mesh(pack,bevel(146,194,8),foil);
        mesh(pack,bevel(120,154,1),enamel,0,-3,6);
        for (const side of [-1,1]) for (let i=0;i<22;i++) box(pack,2.2,12,2,silver,-69+i*6.5,side*92,6);
        const badge=mesh(pack,bevel(54,54,2),gold,0,-2,9);badge.rotation.z=Math.PI/4;
        const inner=mesh(pack,bevel(39,39,2),foil,0,-2,12);inner.rotation.z=Math.PI/4;
        for (const side of [-1,1]) box(pack,4,126,2,gold,side*53,-3,8);
        tear = new T.Group();tear.position.set(0,89,0);pack.add(tear);
        box(tear,148,19,10,foil,0,8,0);
        for(let i=0;i<22;i++)box(tear,2,16,2,silver,-68+i*6.5,8,7);
    } else {
        for (const side of [-1,1]) {
            mesh(model,bevel(750,11,12),silver,0,side*116,-30);
            box(model,700,3,3,gold,0,side*105,-20);
            for(let i=0;i<16;i++)box(model,3,8,3,i%4?enamel:gold,-340+i*45,side*119,-18);
        }
    }
    const beams = new T.Group();scene.add(beams);
    const beamGeo = new T.PlaneGeometry(36,230);geometries.add(beamGeo);
    for(let i=0;i<7;i++){const beam=mesh(beams,beamGeo,light,(i-3)*19,10,-35);beam.rotation.z=(i-3)*.16;}
    const shardGeo=new T.OctahedronGeometry(1);geometries.add(shardGeo);
    const shards=new T.InstancedMesh(shardGeo,gold,low?20:40);scene.add(shards);shards.frustumCulled=false;
    const dummy=new T.Object3D();
    let environment, disposed=false, failed=false, frames=0, lastTimeline, width=820, height=280;
    try {
        const room=new RoomEnvironment(), generator=new T.PMREMGenerator(renderer);
        try{environment=generator.fromScene(room,.04);scene.environment=environment.texture;}
        finally{room.dispose();generator.dispose();}
    } catch(error){dispose();throw error;}
    function update(t) {
        if(disposed||failed)return;lastTimeline=t;
        try{
            const w=Math.max(240,Math.min(900,host.clientWidth||820)),h=Math.max(180,Math.min(400,host.clientHeight||280));
            if(w!==width||h!==height){width=w;height=h;renderer.setSize(w,h,false);camera.left=-w/2;camera.right=w/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();}
            if(variant!=='reel')model.scale.setScalar(Math.min(1,(h-28)/270,(w-42)/330));
            else model.scale.y=Math.min(1,(h-24)/250);
            if(lid){lid.rotation.x=-t.open*1.95;locks.forEach(lock=>{lock.position.y=25-t.unlock*22;lock.scale.y=29*(1-t.unlock*.7);});model.rotation.y=-.26+t.open*.13;}
            if(pack){pack.position.y=-t.open*30;pack.rotation.z=.08+t.open*.12;pack.rotation.y=-.22+t.open*.15;tear.position.set(t.unlock*54,89+t.unlock*36,0);tear.rotation.z=-t.unlock*.3;pack.visible=t.reveal<.98;}
            light.opacity = Math.sin(t.open*Math.PI)*.12+(1-t.reveal)*t.open*.09;
            beams.scale.x=.7+t.open*.6;
            shards.count=t.open>0&&t.reveal<1?(low?20:40):0;
            for(let i=0;i<shards.count;i++){const a=i*2.39996,r=35+t.open*150*(.4+(i%7)/10);dummy.position.set(Math.cos(a)*r,-40+t.open*210+Math.sin(a)*r*.48,(i%5)*12);dummy.rotation.set(a,t.open*4,a+t.open*3);dummy.scale.set(1.4,3.4,1);dummy.updateMatrix();shards.setMatrixAt(i,dummy.matrix);}
            shards.instanceMatrix.needsUpdate=true;renderer.render(scene,camera);frames++;
        }catch(error){failed=true;canvas.hidden=true;onError(error);}
    }
    function resize(){if(!disposed&&lastTimeline)update(lastTimeline);}
    function contextLost(event){event.preventDefault();failed=true;canvas.hidden=true;onError(new Error('Loot WebGL context lost'));}
    function dispose(){
        if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',contextLost);win.removeEventListener('resize',resize);
        geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());shards.dispose();environment?.dispose();scene.environment=null;scene.clear();
        renderer.renderLists.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
    }
    canvas.addEventListener('webglcontextlost',contextLost);win.addEventListener('resize',resize);
    return {update,dispose,getState:()=>({frames,disposed,failed,geometries:geometries.size,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,variant,dpr:renderer.getPixelRatio()})};
}
