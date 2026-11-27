const TAU = Math.PI * 2;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));

export const SCENE_FAMILIES = Object.freeze({
    podium: 'podium', vault: 'vault', carousel: 'gallery', orbit: 'orrery', scepter: 'regalia', spotlight: 'regalia',
    list: 'glass', cards: 'glass', marquee: 'glass', mosaic: 'glass', rail: 'glass', ticker: 'glass', strip: 'glass', wall: 'glass', quote: 'glass', arrival: 'glass',
    portal: 'portal', ticket: 'ticket', radar: 'radar', ribbon: 'ribbon', comet: 'comet', wave: 'wave', theater: 'theater', seal: 'seal', meteor: 'meteor',
    unbox: 'unbox', receipt: 'ticket', combo: 'combo', tower: 'tower', bloom: 'bloom', bubble: 'glass',
    gauge: 'dial', ring: 'dial', steps: 'stairs', bridge: 'bridge', stars: 'constellation', thermo: 'thermometer', quest: 'quest', odometer: 'odometer',
    equalizer: 'equalizer', reactor: 'turbine', pulse: 'oscilloscope', poll: 'votes', race: 'votes'
});

const THEMES = Object.freeze({
    inferno: { metal: 0xb97848, edge: 0xffd69b, enamel: 0x301514, glass: 0x5d2924, accent: 0xff5738, key: 0xffe1b7, rim: 0xff593d },
    rose: { metal: 0xc68e81, edge: 0xffe4d4, enamel: 0x29141f, glass: 0x623046, accent: 0xf48fb0, key: 0xffe6df, rim: 0xb87eeb },
    botanical: { metal: 0xbba66a, edge: 0xffefbb, enamel: 0x102b22, glass: 0x315c49, accent: 0x79d9a7, key: 0xfff0ce, rim: 0x5bbfa2 },
    platinum: { metal: 0xadbfc6, edge: 0xf0faff, enamel: 0x15242b, glass: 0x354e5b, accent: 0x88d9ea, key: 0xf2f5ff, rim: 0x719ae6 }
});

export function themeFor(layout, requested = '') {
    const name = String(requested).toLowerCase();
    if (Object.hasOwn(THEMES, name)) return name;
    if (/inferno|fire|ember|lava/.test(name)) return 'inferno';
    if (/rose|pink|bloom|sakura/.test(name)) return 'rose';
    if (/botanic|forest|garden|paper|leaf|cloud/.test(name)) return 'botanical';
    if (/chrome|platinum|ice|silver/.test(name)) return 'platinum';
    if (['unbox', 'bloom', 'ribbon', 'bubble', 'seal', 'cards', 'mosaic', 'theater'].includes(layout)) return 'rose';
    if (['stairs', 'steps', 'bridge', 'quest', 'wall', 'arrival', 'thermo'].includes(layout)) return 'botanical';
    if (['vault', 'meteor', 'comet', 'tower', 'reactor', 'scepter', 'podium'].includes(layout)) return 'inferno';
    return 'platinum';
}

// DOM bounds are converted to stage coordinates so profiles never drift with the camera.
export function stageRect(rect, hostRect, width, height) {
    const sx = width / (hostRect.width || width), sy = height / (hostRect.height || height);
    return { x: (rect.left - hostRect.left + rect.width / 2) * sx - width / 2,
        y: height / 2 - (rect.top - hostRect.top + rect.height / 2) * sy,
        w: rect.width * sx, h: rect.height * sy };
}

export function qualityFor(requested, { devicePixelRatio = 1, hardwareConcurrency = 8 } = {}) {
    return requested === 'low' || requested === 'auto' && (hardwareConcurrency <= 4 || devicePixelRatio > 2) ? 'low' : 'high';
}

export function profileStyleFor(layout, theme) {
    if (layout === 'portal' || theme === 'botanical') return 'cloud';
    if (layout === 'seal') return 'seal';
    if (theme === 'rose' || layout === 'bloom') return 'cameo';
    if (layout === 'scepter' || layout === 'theater' || theme === 'inferno') return 'winged';
    return 'fluted';
}

export async function createUnboxRenderer(host, options = {}) {
    const { createLootOpening } = await import('./loot-opening.js');
    const opening = createLootOpening(host, options);
    const onError = error => { opening.useFallback(error); options.onError?.(error); };
    try {
        const { createLootModel } = await import('./loot-model.js');
        opening.attachModel(createLootModel(opening.surface, { variant: opening.getState().variant, quality: options.config?.quality || 'auto', onError }));
    } catch (error) { onError(error); }
    return { update: input => opening.update(typeof input === 'number' ? input : input?.progress || 0),
        dispose: opening.dispose, getState: opening.getState };
}

export async function createRenderer(host, { layout = 'podium', theme = '', quality = 'auto', onError = () => {} } = {}) {
    if (!host || !Object.hasOwn(SCENE_FAMILIES, layout)) throw new TypeError('A stage and supported layout are required');
    const T = await import('./three.module.js');
    const doc = host.ownerDocument, win = doc.defaultView;
    const preview = new URLSearchParams(win.location.search).get('preview') === '1';
    const paletteName = themeFor(layout, theme), palette = THEMES[paletteName];
    const resolvedQuality = qualityFor(quality, { devicePixelRatio: win.devicePixelRatio, hardwareConcurrency: win.navigator.hardwareConcurrency });
    const low = resolvedQuality === 'low', segment = low ? 32 : 64;
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: !low, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(low ? 1 : 1.5, win.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !low;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const canvas = renderer.domElement;
    canvas.className = 'premium-scene';
    canvas.setAttribute('aria-hidden', 'true');
    host.prepend(canvas);
    const scene = new T.Scene(), model = new T.Group();
    scene.add(model);
    const camera = new T.OrthographicCamera(-450, 450, 320, -320, 1, 5000);
    camera.position.set(0, 0, 1600);
    const key = new T.DirectionalLight(palette.key, 2.3); key.position.set(-400, 650, 900);
    key.castShadow = !low; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0003;
    Object.assign(key.shadow.camera, { left: -720, right: 720, top: 820, bottom: -820, near: 1, far: 2400 });
    key.shadow.camera.updateProjectionMatrix();
    const fill = new T.DirectionalLight(0xc5e8ff, .8); fill.position.set(500, 70, 500);
    const rim = new T.PointLight(palette.rim, 1600000, 2200, 2); rim.position.set(-180, -160, 450);
    scene.add(key, fill, rim, new T.HemisphereLight(0xe3f5ff, 0x181018, 1.05));

    // A local HDR studio gives metals broad reflections without a remote texture dependency.
    const studio = new T.Scene();
    studio.background = new T.Color(0x454c52);
    const roomGeometry = new T.BoxGeometry(20, 20, 20);
    const roomMaterial = new T.MeshBasicMaterial({ color: 0x7c8793, side: T.BackSide });
    studio.add(new T.Mesh(roomGeometry, roomMaterial));
    const softGeometry = new T.PlaneGeometry(1, 1), softMaterials = [];
    for (const [x, y, z, w, h, color, intensity] of [[-6, 4, 5, 4, 9, 0xffffff, 7], [6, 1, 3, 2, 8, palette.key, 5], [0, 8, 0, 10, 3, 0xffffff, 8], [0, -4, -6, 8, 2, palette.rim, 3]]) {
        const mat = new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(intensity), side: T.DoubleSide });
        softMaterials.push(mat); const panel = new T.Mesh(softGeometry, mat);
        panel.position.set(x, y, z); panel.scale.set(w, h, 1); panel.lookAt(0, 0, 0); studio.add(panel);
    }
    const pmrem = new T.PMREMGenerator(renderer);
    let environment;
    try { environment = pmrem.fromScene(studio, 0.06, 0.1, 100); }
    catch (error) {
        pmrem.dispose(); roomGeometry.dispose(); roomMaterial.dispose(); softGeometry.dispose(); softMaterials.forEach(m => m.dispose());
        renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); throw error;
    }
    scene.environment = environment.texture;
    scene.environmentIntensity = .8;
    pmrem.dispose(); roomGeometry.dispose(); roomMaterial.dispose(); softGeometry.dispose(); softMaterials.forEach(m => m.dispose());

    const materials = {
        metal: new T.MeshPhysicalMaterial({ color: palette.metal, metalness: .86, roughness: .26, clearcoat: .6, clearcoatRoughness: .18 }),
        edge: new T.MeshPhysicalMaterial({ color: palette.edge, metalness: .92, roughness: .18, clearcoat: 1 }),
        dark: new T.MeshPhysicalMaterial({ color: palette.enamel, metalness: .48, roughness: .3, clearcoat: .8 }),
        glass: new T.MeshPhysicalMaterial({ color: palette.glass, metalness: .12, roughness: .12, clearcoat: 1, clearcoatRoughness: .07, transparent: true, opacity: .58, depthWrite: false }),
        crystal: new T.MeshPhysicalMaterial({ color: palette.accent, metalness: .12, roughness: .1, transmission: low ? 0 : .55, thickness: 12, ior: 1.46, clearcoat: 1, transparent: true, opacity: .8 }),
        accent: new T.MeshPhysicalMaterial({ color: palette.accent, emissive: palette.accent, emissiveIntensity: .22, metalness: .5, roughness: .23, clearcoat: .9 }),
        fabric: new T.MeshPhysicalMaterial({ color: palette.accent, metalness: .34, roughness: .39, sheen: .8, sheenColor: new T.Color(palette.edge), side: T.DoubleSide }),
        ivory: new T.MeshPhysicalMaterial({ color: 0xe8edf0, metalness: .16, roughness: .28, clearcoat: .75 }),
        pearl: new T.MeshPhysicalMaterial({ color: 0xe4eff0, metalness: .32, roughness: .24, clearcoat: 1, iridescence: .24, iridescenceIOR: 1.3 }),
        satin: new T.MeshPhysicalMaterial({ color: palette.metal, metalness: .78, roughness: .38, clearcoat: .3, side: T.DoubleSide })
    };
    const geometryCache = new Map();
    let disposed = false, suspended = false, lost = false, width = 0, height = 0, raf = 0, timer = 0, last = -Infinity, frames = 0, elapsed = 0, signature = '', input = {}, meshes = 0;
    let animations = [], progressParts = [], rebuilds = 0;
    let texture = null, textureMaterial = null, assetController = null;
    const usedGeometry = new Set();
    const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
    const geometry = (id, make) => { usedGeometry.add(id); if (!geometryCache.has(id)) geometryCache.set(id, make()); return geometryCache.get(id); };
    function mesh(parent, shape, material, x = 0, y = 0, z = 0) {
        if (meshes >= 620) return new T.Group();
        const item = new T.Mesh(shape, typeof material === 'string' ? materials[material] : material);
        item.castShadow = item.receiveShadow = !low && !item.material.transparent;
        item.position.set(x, y, z); parent.add(item); meshes++; return item;
    }
    function group(parent, x = 0, y = 0, z = 0) { const g = new T.Group(); g.position.set(x, y, z); parent.add(g); return g; }
    function box(parent, w, h, d, material, x = 0, y = 0, z = 0, bevel = 3) {
        w = Math.max(1, w); h = Math.max(1, h); d = Math.max(1, d); bevel = Math.min(bevel, w / 5, h / 5, d / 3);
        const id = `box:${w.toFixed(1)}:${h.toFixed(1)}:${d.toFixed(1)}:${bevel.toFixed(1)}`;
        const geo = geometry(id, () => {
            const shape = new T.Shape(), r = Math.min(6, w / 8, h / 8), a = w / 2, b = h / 2;
            shape.moveTo(-a + r, -b); shape.lineTo(a - r, -b); shape.quadraticCurveTo(a, -b, a, -b + r);
            shape.lineTo(a, b - r); shape.quadraticCurveTo(a, b, a - r, b); shape.lineTo(-a + r, b);
            shape.quadraticCurveTo(-a, b, -a, b - r); shape.lineTo(-a, -b + r); shape.quadraticCurveTo(-a, -b, -a + r, -b);
            const result = new T.ExtrudeGeometry(shape, { depth: d, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, steps: 1, curveSegments: 4 });
            result.translate(0, 0, -d / 2); return result;
        });
        return mesh(parent, geo, material, x, y, z);
    }
    function torus(parent, radius, tube, material, x = 0, y = 0, z = 0, arc = TAU) {
        return mesh(parent, geometry(`torus:${radius}:${tube}:${arc}`, () => new T.TorusGeometry(Math.max(1, radius), Math.max(.5, tube), low ? 6 : 10, segment, arc)), material, x, y, z);
    }
    function cylinder(parent, radius, h, material, x = 0, y = 0, z = 0, top = radius) {
        return mesh(parent, geometry(`cyl:${radius}:${h}:${top}`, () => new T.CylinderGeometry(top, radius, Math.max(1, h), segment)), material, x, y, z);
    }
    function tube(parent, points, radius, material, closed = false) {
        const key = 'tube:' + JSON.stringify([points, radius, closed]);
        return mesh(parent, geometry(key, () => new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)), closed), low ? 24 : 48, radius, 6, closed)), material);
    }
    function gem(parent, radius, x, y, z, material = 'accent') {
        return mesh(parent, geometry('gem:' + radius, () => new T.OctahedronGeometry(radius, 0)), material, x, y, z);
    }
    function screws(parent, w, h, z = 12) {
        for (const x of [-1, 1]) for (const y of [-1, 1]) {
            const screw = cylinder(parent, 2.5, 3, 'edge', x * (w / 2 - 9), y * (h / 2 - 9), z); screw.rotation.x = Math.PI / 2;
        }
    }
    function panel(rect, material = 'glass', ornate = false) {
        const g = group(model, rect.x, rect.y, -10);
        g.rotation.set(.035, -.035, 0);
        box(g, rect.w + 6, rect.h + 4, 16, 'metal', 0, 0, -6);
        box(g, rect.w - 4, rect.h - 6, 10, 'dark', 0, 0, 2);
        box(g, rect.w - 8, rect.h - 10, 3, material, 0, 0, 10, 1);
        box(g, rect.w - 14, 2, 3, 'edge', 0, rect.h / 2 - 5, 14, .7);
        box(g, rect.w - 14, 2, 3, 'accent', 0, -rect.h / 2 + 4, 14, .7);
        screws(g, rect.w, rect.h, 13);
        if (ornate && rect.h > 110) for (const side of [-1, 1]) {
            tube(g, [[side * (rect.w / 2 - 7), -rect.h / 3, 8], [side * (rect.w / 2 + 6), 0, 17], [side * (rect.w / 2 - 7), rect.h / 3, 8]], 2, 'edge');
        }
        return g;
    }
    function medallion(rect, ornate = false) {
        const r = Math.max(8, Math.min(rect.w, rect.h) / 2), g = group(model, rect.x, rect.y, 0);
        if (['cards','mosaic','wall'].includes(layout)) {
            const rim=relief(g,'square-profile',roundedProfile(1.1,.25),'metal',.14,.035,roundedProfile(.975,.2));rim.scale.setScalar(r);
            const lip=relief(g,'square-profile-lip',roundedProfile(1.04,.23),'edge',.035,.012,roundedProfile(1.01,.21));lip.scale.setScalar(r);lip.position.z=9;
            return g;
        }
        const disk = cylinder(g, r, 9, 'dark'); disk.rotation.x = Math.PI / 2;
        torus(g, r - 1, Math.max(1.2, r * .025), 'edge', 0, 0, 8);
        if (!ornate || r < 26) {
            torus(g, r + 3, Math.max(1, r * .018), 'satin', 0, 0, 1);
            return g;
        }
        const style = profileStyleFor(layout, paletteName);
        const body = relief(g, 'profile-' + style, profileOutline(style), 'metal', .12, .035, .965);
        body.scale.setScalar(r); body.position.z = -5;
        const inlay = relief(g, 'profile-inlay-' + style, profileOutline(style), style === 'cloud' ? 'pearl' : 'dark', .035, .012, .99);
        inlay.scale.set(r * .975, r * .975, r); inlay.position.z = 7;
        torus(g, r * 1.025, r * .019, 'edge', 0, 0, 13);
        if (style === 'cloud') {
            // One continuous scalloped shell, with chased curls attached to its shoulders.
            for (const side of [-1, 1]) {
                const curl = group(g, side * r * 1.06, r * .08, 14);
                tube(curl, [[0,-r*.29,0],[side*r*.13,-r*.09,2],[side*r*.12,r*.13,3],[0,r*.19,4],[-side*r*.07,r*.1,3],[0,r*.05,2]], r*.014, 'edge');
                animate(curl, (o,t) => { o.rotation.y = Math.sin(t*.75+side*.35)*.13; });
            }
        } else if (style === 'winged') {
            for (const side of [-1, 1]) featherWing(g, r, side);
            crest(g, r * .3, r * 1.02);
        } else if (style === 'cameo') {
            for (const side of [-1, 1]) {
                const rose = group(g, side*r*.86, r*.65, 15);
                for (let i=0;i<5;i++) {
                    const petal = relief(rose, 'rose-petal', petalOutline(), i%2 ? 'fabric' : 'satin', .09, .025, 0, .32);
                    petal.scale.set(r*.16,r*.23,r*.2); petal.rotation.set(.38, .32, i/5*TAU);
                }
                animate(rose,(o,t)=>{o.rotation.y=Math.sin(t*.65+side)*.12;});
            }
            pendant(g, r, -.99);
        } else if (style === 'fluted') {
            for (const side of [-1,1]) for (let i=0;i<3;i++) {
                const a=side*(.64+i*.18), rib=torus(g,r*(1.08+i*.035),r*.012,'edge',0,0,10,1.15);
                rib.rotation.z=a+(side<0?Math.PI:0);
            }
            crest(g,r*.21,r*1.01);
        } else {
            ribbonTail(g,r,-1); ribbonTail(g,r,1);
        }
        return g;
    }

    function profileOutline(style) {
        const s = new T.Shape();
        if (style === 'cloud') {
            s.moveTo(0,-1.09);
            s.bezierCurveTo(-.26,-1.2,-.57,-1.14,-.64,-.99);
            s.bezierCurveTo(-1.02,-1.12,-1.27,-.81,-1.16,-.55);
            s.bezierCurveTo(-1.54,-.38,-1.43,.09,-1.23,.18);
            s.bezierCurveTo(-1.49,.52,-1.14,.91,-.91,.88);
            s.bezierCurveTo(-.84,1.26,-.43,1.32,-.23,1.17);
            s.bezierCurveTo(.01,1.5,.47,1.34,.56,1.13);
            s.bezierCurveTo(.9,1.29,1.24,1.02,1.17,.77);
            s.bezierCurveTo(1.5,.62,1.48,.2,1.25,.08);
            s.bezierCurveTo(1.5,-.23,1.26,-.61,1.08,-.65);
            s.bezierCurveTo(1.11,-1.02,.71,-1.16,.49,-1.04);
            s.bezierCurveTo(.31,-1.21,.11,-1.17,0,-1.09);
        } else {
            const count = style === 'seal' ? 48 : 96;
            for (let i=0;i<count;i++) {
                const a=i/count*TAU;
                const radius=style==='seal' ? (i%2?1.09:1.19) : style==='cameo' ? 1.10+.035*Math.cos(a*8) : style==='winged' ? 1.07+.035*Math.cos(a*4) : 1.085+.018*Math.cos(a*32);
                const x=Math.cos(a)*radius,y=Math.sin(a)*radius;
                if(i)s.lineTo(x,y);else s.moveTo(x,y);
            }
        }
        s.closePath(); return s;
    }
    function roundedProfile(radius,corner) {
        const s=new T.Shape(),r=radius,c=corner;
        s.moveTo(-r+c,-r);s.lineTo(r-c,-r);s.quadraticCurveTo(r,-r,r,-r+c);s.lineTo(r,r-c);s.quadraticCurveTo(r,r,r-c,r);s.lineTo(-r+c,r);s.quadraticCurveTo(-r,r,-r,r-c);s.lineTo(-r,-r+c);s.quadraticCurveTo(-r,-r,-r+c,-r);s.closePath();return s;
    }
    function relief(parent, id, shape, material, depth=.12, bevel=.02, aperture=0, dome=0) {
        const geo = geometry('relief:'+id, () => {
            if (aperture) {
                const hole=typeof aperture==='number'?new T.Path():aperture;
                if(typeof aperture==='number')hole.absarc(0,0,aperture,0,TAU,true);
                shape.holes.push(hole);
            }
            const result=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:low?2:3,steps:1,curveSegments:low?12:24});
            result.translate(0,0,-depth/2);
            if(dome){
                result.computeBoundingBox();const bounds=result.boundingBox,p=result.attributes.position;
                for(let i=0;i<p.count;i++){
                    const x=(p.getX(i)-bounds.min.x)/(bounds.max.x-bounds.min.x)*2-1;
                    const y=(p.getY(i)-bounds.min.y)/(bounds.max.y-bounds.min.y);
                    p.setZ(i,p.getZ(i)+dome*Math.max(0,1-x*x)*Math.sin(y*Math.PI));
                }
                p.needsUpdate=true;result.computeVertexNormals();
            }
            return result;
        });
        return mesh(parent,geo,material);
    }
    function petalOutline() {
        const s=new T.Shape(); s.moveTo(0,0); s.bezierCurveTo(-.68,.28,-.68,.97,0,1.28); s.bezierCurveTo(.68,.97,.68,.28,0,0); return s;
    }
    function featherWing(parent,r,side) {
        const wing=group(parent,side*r*.82,r*.35,-3);
        for(let i=0;i<5;i++) {
            const s=new T.Shape();s.moveTo(0,0);s.bezierCurveTo(.05,.35,.55,.67,.37,1.12);s.bezierCurveTo(.94,.83,.73,.29,0,0);
            const feather=relief(wing,'feather',s,i%2?'satin':'metal',.085,.018,0,.26);
            feather.scale.set(side*r*(.48-i*.04),r*(.87-i*.09),r*.5);
            feather.position.set(side*i*r*.055,-i*r*.14,i*2);feather.rotation.z=-side*i*.08;
        }
        tube(wing,[[0,-r*.35,0],[side*r*.2,0,4],[side*r*.26,r*.42,4]],r*.016,'edge');
        animate(wing,(o,t)=>{o.rotation.y=side*(.12+Math.sin(t*.8)*.11);o.rotation.z=side*Math.sin(t*.8)*.025;});
    }
    function crest(parent,r,y) {
        const g=group(parent,0,y,9),s=new T.Shape();
        s.moveTo(-1,0);s.bezierCurveTo(-1,.4,-.6,.5,-.65,.95);s.lineTo(-.27,.55);s.lineTo(0,1.45);s.lineTo(.27,.55);s.lineTo(.65,.95);s.bezierCurveTo(.6,.5,1,.4,1,0);s.closePath();
        const body=relief(g,'crest',s,'edge',.2,.035,0,.26);body.scale.setScalar(r);
        const jewel=gem(g,r*.19,0,r*.63,r*.18,'pearl');jewel.scale.set(.7,1.4,.6);
        animate(jewel,(o,t)=>{o.rotation.y=Math.sin(t*.65)*.3;});
    }
    function pendant(parent,r,y) {
        const g=group(parent,0,r*y,12);
        tube(g,[[0,0,0],[0,-r*.12,0],[0,-r*.18,0]],r*.012,'edge');
        const drop=relief(g,'pendant',petalOutline(),'pearl',.2,.035);drop.scale.set(r*.085,-r*.17,r*.08);drop.position.y=-r*.13;
        animate(g,(o,t)=>{o.rotation.z=Math.sin(t*1.4)*.065;});
    }
    function ribbonTail(parent,r,side) {
        const s=new T.Shape();s.moveTo(-.16,0);s.lineTo(.16,0);s.bezierCurveTo(.1,-.3,.24,-.56,.16,-.77);s.lineTo(0,-.65);s.lineTo(-.16,-.77);s.bezierCurveTo(-.09,-.5,-.23,-.23,-.16,0);
        const tail=relief(parent,'ribbon-tail',s,'fabric',.045,.01);tail.scale.setScalar(r);tail.position.set(side*r*.55,-r*.83,-10);tail.rotation.z=side*.23;
        animate(tail,(o,t)=>{o.rotation.x=Math.sin(t*1.2+side*.7)*.13;});
    }

    function displayPanel(rect, kind=layout) {
        const g=group(model,rect.x,rect.y,-16), w=rect.w/2,h=rect.h/2;
        const shape=new T.Shape(), c=Math.min(18,h*.32), ticket=['ticket','receipt'].includes(kind);
        shape.moveTo(-w+c,-h);shape.lineTo(w-c,-h);shape.quadraticCurveTo(w,-h,w,-h+c);
        if(ticket){shape.lineTo(w,-c);shape.bezierCurveTo(w-c*1.5,-c,w-c*1.5,c,w,c);}
        shape.lineTo(w,h-c);shape.quadraticCurveTo(w,h,w-c,h);shape.lineTo(-w+c,h);shape.quadraticCurveTo(-w,h,-w,h-c);
        if(ticket){shape.lineTo(-w,c);shape.bezierCurveTo(-w+c*1.5,c,-w+c*1.5,-c,-w,-c);}
        shape.lineTo(-w,-h+c);shape.quadraticCurveTo(-w,-h,-w+c,-h);shape.closePath();
        const key=[kind,rect.w.toFixed(1),rect.h.toFixed(1)].join(':');
        relief(g,'display:'+key,shape,'satin',12,1.7);
        const face=relief(g,'display-face:'+key,shape.clone(),'dark',5,.8);face.scale.set(.985,.95,1);face.position.z=8;
        const top=box(g,Math.max(4,rect.w-c*2),1.2,2,'edge',0,h-3,12,.4);
        if(['quote','bubble'].includes(kind)){
            const tail=new T.Shape();tail.moveTo(0,0);tail.lineTo(16,-15);tail.quadraticCurveTo(10,-4,24,0);tail.closePath();
            const fin=relief(g,'speech-tail',tail,'satin',8,.8);fin.position.set(-w+c,-h+1,0);
        }
        if(['quest','arrival','rail'].includes(kind)){
            box(g,3,rect.h*.56,5,'accent',-w+3,0,12,.7);
        }
        // The narrow highlight tilts within the rim; the text-bearing face remains stationary.
        animate(top,(o,t)=>{o.rotation.x=Math.sin(t*.65)*.12;});
        return g;
    }
    function laurel(parent, radius) {
        const leafGeo = geometry('leaf', () => new T.SphereGeometry(1, 8, 5));
        for (const side of [-1, 1]) {
            tube(parent, [[side * 12, -radius, 0], [side * radius, -radius * .6, 1], [side * radius * 1.08, radius * .35, 2], [side * radius * .62, radius, 0]], 2, 'metal');
            for (let i = 0; i < 7; i++) {
                const a = -.8 + i * .24, leaf = mesh(parent, leafGeo, 'edge', side * Math.cos(a) * radius, Math.sin(a) * radius, 4);
                leaf.scale.set(radius * .07, radius * .17, radius * .025); leaf.rotation.z = side * (.8 - a);
            }
        }
    }
    function crown(parent, r, y) {
        const base = cylinder(parent, r, 12, 'metal', 0, y, 0); base.rotation.x = .14;
        for (let i = 0; i < 5; i++) {
            const x = (i - 2) * r * .38, peak = i === 2 ? 34 : i % 2 ? 23 : 17;
            const tooth = box(parent, r * .2, peak, 10, 'edge', x, y + peak / 2 + 5, 2, 2); tooth.rotation.z = -(i - 2) * .13;
            gem(parent, 5, x, y + peak + 7, 2);
        }
    }
    function trophy(rect) {
        const r = Math.min(rect.w, rect.h) * .57, g = group(model, rect.x, rect.y, 95);
        const points = [[.22, -1.25], [.4, -1.2], [.25, -1.05], [.14, -.65], [.22, -.48], [.62, -.28], [.95, .12], [1, .68], [.94, .74]];
        const bowl = geometry('trophy:' + r, () => new T.LatheGeometry(points.map(([x,y]) => new T.Vector2(x*r,y*r)), segment));
        mesh(g, bowl, 'metal'); torus(g, r * .98, 3.5, 'edge', 0, r * .7).rotation.x = Math.PI / 2;
        for (const side of [-1,1]) tube(g, [[side*r*.8,r*.5,0],[side*r*1.4,r*.55,0],[side*r*1.48,-r*.15,0],[side*r*.64,-r*.38,0]], 4.5, 'edge');
        cylinder(g, r*.46, 12, 'dark', 0, -r*1.3, 0);
        crown(g, r*.64, r*.84);
        g.rotation.x = .12;
    }
    function rects(selector) {
        const hostBounds = host.getBoundingClientRect();
        return [...host.querySelectorAll(selector)].slice(0, 24).filter(n => n.getClientRects().length).map(n => ({ node: n, ...stageRect(n.getBoundingClientRect(), hostBounds, width, height) }));
    }
    const first = selector => rects(selector)[0];
    function animate(object, fn) { animations.push({ object, fn }); }

    function buildPodium() {
        rects('.pedestal,.vault-column').forEach((r, i) => {
            const g = group(model, r.x, r.y, -12), depth = Math.min(90, r.w * .38);
            box(g, r.w - 12, r.h - 6, depth, 'dark');
            box(g, r.w + 2, 12, depth + 8, 'metal', 0, r.h / 2 - 1, 0);
            box(g, r.w + 8, 13, depth + 14, 'edge', 0, -r.h / 2, 0);
            box(g, r.w - 32, r.h - 26, 5, 'glass', 0, -1, depth / 2 + 1);
            for (const side of [-1, 1]) {
                box(g, 5, r.h - 22, 8, 'metal', side * (r.w / 2 - 13), 0, depth / 2 + 7, 1);
                if (layout === 'vault') for (let j=0;j<3;j++) box(g, 3, r.h-30, 6, 'edge', side*(r.w/2-20-j*6),0,depth/2+3,1);
            }
            g.rotation.set(.10, i % 2 ? .06 : -.06, 0);
        });
        rects('.podium-place>.portrait,.vault-column>.portrait').forEach((r, i) => {
            medallion(r, true);
            if (layout === 'podium' && r.node.parentElement.dataset.place === '1') {
                const pedestal = first('.podium-place[data-place="1"] .pedestal');
                if (pedestal) trophy({ ...pedestal, w: 34, h: 34, x: pedestal.x - pedestal.w * .35, y: pedestal.y + pedestal.h / 2 + 20 });
            }
            if (layout === 'vault') crown(group(model, r.x, r.y), r.w*.42, r.h*.6);
        });
        rects('.rank-tail .portrait').forEach(r => medallion(r));
    }
    function buildPanels() {
        const selectors = { list: '.rank-row', cards: '.collector', marquee: '.marquee-person', mosaic: '.mosaic-cell', rail: '.activity', ticker: '.ticker-item', strip: '.strip-stat', wall: '.wall-person', quote: '.layout-quote', arrival: '.arrival-row', bubble: '.event-copy', quest: '.quest-row', odometer: '.digit' };
        rects(selectors[layout] || '.focus').forEach((r, i) => {
            const g = layout === 'odometer' ? panel(r, 'dark') : displayPanel(r);
            if (layout === 'cards') g.rotation.y = (i - 2) * .025;
            if (layout === 'odometer') { box(g, r.w-6, 2, 5, 'metal',0,0,15,1); screws(g,r.w,r.h,18); }
        });
        rects('.portrait').slice(0,12).forEach(r => medallion(r, ['cards','wall','mosaic','quote','bubble'].includes(layout)));
    }
    function buildRegalia() {
        const r = first('.medallion>.portrait,.layout-spotlight>.portrait,.orbit-leader>.portrait,.focus>.portrait');
        if (!r) return;
        const g = group(model, r.x, r.y, -8), radius = r.w * .5;
        medallion(r, true);
        if (layout === 'scepter') {
            const staff=group(g,radius*1.42,-radius*.05,0);
            tube(staff,[[0,-radius*.83,0],[0,0,0],[0,radius*.58,0]],radius*.025,'satin');
            const head=relief(staff,'staff-head',petalOutline(),'metal',.16,.025);
            head.scale.set(radius*.21,radius*.29,radius*.3);head.position.y=radius*.52;
            animate(head,(o,t)=>{o.rotation.y=Math.sin(t*.7)*.2;});
        }
        if (layout === 'orbit') {
            for(let i=0;i<2;i++){
                const orbit = torus(g, radius*1.5+i*12, 1.8, i?'satin':'edge',0,0,-25);
                orbit.scale.y=.56; orbit.rotation.set(.4+i*.2,.12,i?.28:-.28);
                animate(orbit, (o,t)=>{o.rotation.z=(i?.28:-.28)+Math.sin(t*.18)*.035;});
            }
            rects('.satellite>.portrait').forEach(p=>medallion(p,true));
        }
        if (layout === 'carousel') rects('.thumb>.portrait').forEach(p=>medallion(p));
        rects('.scepter-side>.portrait').forEach(p=>medallion(p,true));
    }
    function buildGift(r) {
        const scale = Math.min(r.w / 300, r.h / 320), g = group(model, r.x - 15*scale, r.y - 42*scale, -10);
        g.scale.setScalar(scale); g.rotation.set(.2, -.28, -.035);
        box(g, 190, 14, 136, 'dark', 0, -62, 0);
        box(g, 190, 112, 8, 'dark', 0, -4, -66);
        box(g, 190, 112, 8, 'fabric', 0, -4, 66);
        for (const side of [-1,1]) box(g, 8, 112, 136, 'fabric',side*94,-4,0);
        box(g, 26, 116, 3, 'edge', 0, -4, 73, 1);
        for (const side of [-1, 1]) {
            tube(g, [[side*5,16,76],[side*32,39,79],[side*48,16,81],[side*28,4,82],[side*5,16,76]], 4, 'edge');
            tube(g, [[side*6,12,78],[side*16,-10,82],[side*28,-42,84]], 3, 'fabric');
        }
        box(g, 194, 6, 6, 'metal', 0, 54, 69, 1);
        const lid = group(g, 0, 58, -67);
        box(lid, 204, 21, 147, 'fabric', 0, 8, 70);
        box(lid, 210, 5, 151, 'edge', 0, -2, 70, 1);
        box(lid, 28, 24, 150, 'edge', 0, 10, 70, 1);
        box(lid, 205, 5, 24, 'edge', 0, 24, 70, 1);
        for (const side of [-1,1]) {
            tube(lid, [[0,30,70],[side*22,68,67],[side*62,61,72],[side*53,33,77],[0,30,70]], 7, 'fabric');
            tube(lid, [[side*10,30,70],[side*32,25,106],[side*38,5,143]], 5, 'edge');
        }
        gem(lid, 12, 0, 34, 74, 'edge');
        animate(lid, (o,t)=>{const opening=reduced.matches?1:(1-Math.cos(Math.min(1,t/1.25)*Math.PI))/2;o.rotation.x=-.94*opening-Math.sin(t*.8)*.06;});
        for (let i=0;i<5;i++) {
            const jewel=gem(g,7+i%2*3,(i-2)*30,105+(i%3)*23,15+i*5);
            animate(jewel,(o,t)=>{o.position.y=105+(i%3)*23+Math.sin(t+i)*8;o.rotation.y=t*.35+i;});
        }
    }
    function buildEvents() {
        const art = first('.event-art'); if (!art) return;
        const profile = first('.event-art .portrait');
        const r = Math.min(art.w, art.h) * .42, g = group(model, art.x, art.y, -10);
        if (layout === 'unbox') { buildGift(art); return; }
        if (profile) medallion(profile, true);
        if (['ticket','receipt','ribbon','bubble'].includes(layout)) {
            const copy=first('.event-copy');
            if (copy) {
                const p=displayPanel({...copy,w:copy.w+12,h:copy.h+16});
                if (layout==='ribbon') for(const side of [-1,1]) {
                    const s=new T.Shape();s.moveTo(0,0);s.lineTo(27,10);s.bezierCurveTo(21,-5,36,-19,29,-34);s.lineTo(14,-26);s.lineTo(0,-34);s.closePath();
                    const tail=relief(p,'display-ribbon',s,'fabric',5,1);tail.position.set(side*(copy.w/2-12),-copy.h/2+12,-6);tail.scale.x=side;
                    animate(tail,(o,t)=>{o.rotation.y=side*Math.sin(t*.9)*.16;});
                }
                if (layout==='receipt') for(let i=0;i<14;i++)box(p,1+i%3,8,2,'edge',-copy.w*.3+i*4,-copy.h/2+2,14,.4);
            }
            return;
        }
        if (['portal','theater'].includes(layout)) {
            const copy=first('.event-copy');
            if(copy)displayPanel({...copy,w:copy.w+20,h:copy.h+12},layout);
            // The portrait is the entrance: a shaped, open shell instead of a second oversized arch.
            if(layout==='theater'&&profile)for(const side of [-1,1]){
                const swag=group(model,profile.x+side*profile.w*.63,profile.y+profile.h*.18,-12);
                tube(swag,[[0,profile.h*.23,0],[side*profile.w*.06,0,4],[0,-profile.h*.33,0]],profile.w*.045,'fabric');
                animate(swag,(o,t)=>{o.rotation.y=side*Math.sin(t*.8)*.15;});
            }
        } else if (layout === 'radar') {
            const back=cylinder(g,r,17,'dark'); back.rotation.x=Math.PI/2;
            torus(g,r,6,'metal',0,0,12);torus(g,r*.77,2,'edge',0,0,15);
            for(let i=0;i<24;i++){
                const a=i/24*TAU,tick=box(g,2,i%3?5:11,3,'edge',Math.sin(a)*r*.88,Math.cos(a)*r*.88,16,1);tick.rotation.z=-a;
            }
            const arm=group(g,0,0,18);box(arm,3,r*.85,3,'accent',0,r*.425,0,1);
            animate(arm,(o,t)=>{o.rotation.z=-t*.45;});
        } else if (['wave','comet','meteor'].includes(layout)) {
            if(layout==='wave')for(let i=0;i<3;i++){
                const ring=torus(g,r*(.86+i*.2),3+i,'metal',0,0,-i*15);ring.rotation.set(.2+i*.08,.13,0);
                animate(ring,(o,t)=>{o.rotation.y=.13+Math.sin(t*.6+i)*.12;});
            }
            else {
                const meteor=gem(g,r*.7,-15,12,-8,'crystal'); meteor.scale.set(1.1,.82,.8);meteor.rotation.z=.5;
                animate(meteor,(o,t)=>{o.rotation.y=.35+Math.sin(t*.5)*.16;});
                for(let i=0;i<5;i++){
                    const rail=box(g,9-i, r*(1.15+i*.15),9-i,i%2?'metal':'accent',-r*.5-i*13,r*.35+i*7,-20-i*3,2);rail.rotation.z=-.9;
                }
            }
        } else if (layout === 'seal' || layout === 'bloom') {
            const copy=first('.event-copy');if(copy)displayPanel({...copy,w:copy.w+18,h:copy.h+12});
        } else if (layout === 'tower') {
            const tower=group(g,-r*.65,-r*.75,0);
            for(let i=0;i<10;i++){
                const plate=box(tower,r*.65,12,r*.6,i<6?'accent':'dark',0,i*17,0,3);plate.rotation.y=-.22;
                progressParts.push({kind:'tower',item:plate,index:i});
            }
        } else if (layout === 'combo') {
            const value=first('.event-value');if(value)panel({...value,w:value.w+35,h:value.h+6},'dark',true);
            torus(g,r*.8,8,'metal',0,0,0);laurel(g,r*.97);
        }
    }
    function buildDial(r) {
        const radius=Math.min(r.w*.39,r.h*.43), cy=r.y-r.h*.08, g=group(model,r.x,cy,-12), gauge=layout==='gauge';
        const back=cylinder(g,radius+11,20,'dark');back.rotation.x=Math.PI/2;
        torus(g,radius+9,8,'metal',0,0,10);torus(g,radius-3,2,'edge',0,0,22);torus(g,radius-18,1.3,'metal',0,0,24);
        if(gauge) {
            const arc=torus(g,radius*.77,7,'accent',0,0,23,Math.PI);arc.rotation.z=0;
        }
        const count=gauge?31:48;
        for(let i=0;i<count;i++){
            const a=gauge?Math.PI-i/(count-1)*Math.PI:i/count*TAU;
            const x=Math.cos(a), y=Math.sin(a), rr=radius*.89;
            const tick=box(g,i%5?2:3,i%5?8:15,3,'metal',x*rr,y*rr,26,1);tick.rotation.z=a-Math.PI/2;
            progressParts.push({kind:'tick',item:tick,index:i,count});
        }
        if(gauge){
            const needle=group(g,0,0,29);box(needle,3,radius*.73,4,'accent',0,radius*.32,0,1);gem(needle,8,0,0,3,'edge');
            progressParts.push({kind:'needle',item:needle});
        }else{
            for(let i=0;i<4;i++){
                const a=i/4*TAU+.785;gem(g,4,Math.cos(a)*(radius+9),Math.sin(a)*(radius+9),20,'edge');
            }
        }
        g.rotation.set(.045,-.045,0);
    }
    function buildStairs(r) {
        const span=r.w*.82, bw=span/8, base=r.y-r.h*.4, g=group(model,r.x,base,-10);
        for(let i=0;i<8;i++){
            const h=r.h*(.11+i*.063), x=-span/2+bw*(i+.5), step=group(g,x,h/2,0);
            box(step,bw-9,h,65,'dark');box(step,bw-4,8,71,'metal',0,h/2,0);
            box(step,bw-17,3,3,'accent',0,h/2+6,37,1);
            progressParts.push({kind:'step',item:step,index:i,count:8});
            step.rotation.set(.08,-.12,0);
        }
        box(g,span+24,10,90,'metal',0,-7,0);
    }
    function buildBridge(r) {
        const span=r.w*.78, deck=r.y-r.h*.31, g=group(model,r.x,deck,-10), towerH=r.h*.56;
        box(g,span+25,16,75,'metal');box(g,span,4,64,'dark',0,12,0);
        for(const side of [-1,1]){
            box(g,15,towerH,24,'metal',side*span*.36,towerH/2,0);
            gem(g,9,side*span*.36,towerH+7,0,'edge');
        }
        const cable=[];
        for(let i=0;i<=16;i++){
            const x=-span*.36+i/16*span*.72,h=towerH*(1-Math.sin(i/16*Math.PI)*.55);
            cable.push([x,h,0]);
            cylinder(g,1.4,h-12,'edge',x,h/2+6,0);
            const p=box(g,span/17-3,4,70,'accent',-span/2+span/17*(i+.5),13,0,1);
            progressParts.push({kind:'step',item:p,index:i,count:17});
        }
        tube(g,cable,3,'metal');g.rotation.set(.12,-.05,0);
    }
    function buildThermometer(r) {
        const h=r.h*.7, radius=Math.max(14,r.w*.047), x=r.x-r.w*.25, y=r.y, g=group(model,x,y,-12);
        cylinder(g,radius+5,h+20,'glass');
        cylinder(g,radius+9,11,'metal',0,h/2+9);cylinder(g,radius+10,13,'metal',0,-h/2-8);
        const liquid=cylinder(g,radius-3,1,'accent',0,-h/2,0);progressParts.push({kind:'liquid',item:liquid,h});
        for(let i=0;i<=10;i++)box(g,i%5?12:23,2,3,'edge',radius+19,-h/2+h*i/10,5,1);
        for(const side of [-1,1])cylinder(g,2.5,h,'metal',side*(radius+5),0,-5);
        cylinder(g,radius*1.7,12,'metal',0,-h/2-22);
        const bulb=mesh(g,geometry('bulb:'+radius,()=>new T.SphereGeometry(radius*1.24,24,16)),'accent',0,-h/2-13,0);bulb.scale.y=.7;
        g.rotation.y=-.12;
    }
    function buildConstellation(r) {
        const points=[[-.36,-.15],[-.23,.07],[-.12,-.2],[.01,.1],[.15,-.12],[.28,.13],[.37,-.08],[.2,-.36],[-.12,-.4]];
        const g=group(model,r.x,r.y,-12), path=points.map(([x,y])=>[x*r.w,y*r.h,0]);tube(g,path,2,'metal');
        path.forEach(([x,y,z],i)=>{
            const star=gem(g,14,x,y,z,'crystal');star.scale.z=.55;star.rotation.z=.3;
            progressParts.push({kind:'step',item:star,index:i,count:path.length});
            torus(g,20,1,'edge',x,y,-5);
        });
    }
    function buildVotes() {
        rects('.poll-option').forEach(r=>displayPanel(r));
        rects('.poll-track,.race-track,.meter').forEach((r,i)=>{
            const g=group(model,r.x,r.y,-6), h=Math.max(12,r.h), depth=20;
            box(g,r.w+4,h+6,depth,'dark');
            const bar=box(g,Math.max(8,r.w-6),h-2,depth+5,i%2?'metal':'accent',0,0,5,2);
            progressParts.push({kind:'bar',item:bar,w:r.w-6,node:r.node.closest('.poll-option,.race-lane,.quest-row')});
            screws(g,r.w,h+20,17);
        });
        rects('.poll-voters .portrait').forEach(r=>medallion(r));
    }
    function buildEnergy(r) {
        const g=group(model,r.x,r.y,-12), radius=Math.min(r.h*.4,r.w*.26);
        if(layout==='reactor'){
            const rotor=group(g);torus(g,radius,12,'metal');torus(g,radius-17,3,'edge',0,0,12);
            torus(g,radius+13,4,'dark',0,0,-12);
            for(let i=0;i<16;i++){
                const a=i/16*TAU,bolt=cylinder(g,3,5,'edge',Math.sin(a)*(radius+1),Math.cos(a)*(radius+1),13);
                bolt.rotation.x=Math.PI/2;
            }
            for(let i=0;i<3;i++){
                const a=i/3*TAU,strut=box(g,9,radius*.8,12,'dark',Math.sin(a)*radius*.52,Math.cos(a)*radius*.52,-18,2);
                strut.rotation.z=-a;
            }
            for(let i=0;i<12;i++){
                const a=i/12*TAU,blade=box(rotor,18,radius*.55,8,i%3?'metal':'accent',Math.sin(a)*radius*.48,Math.cos(a)*radius*.48,0);
                blade.rotation.set(.38,.25,-a+.34);
            }
            const hub=cylinder(g,radius*.2,28,'dark',0,0,22);hub.rotation.x=Math.PI/2;torus(g,radius*.18,4,'edge',0,0,37);
            animate(rotor,(o,t)=>{o.rotation.z=t*.18;});
        }else if(layout==='equalizer'){
            box(g,r.w*.9,12,62,'metal',0,-r.h*.36,0);
            for(let i=0;i<24;i++){
                const bw=r.w*.84/24,h=r.h*.6,bar=box(g,bw-6,h,18,i%4?'metal':'accent',-r.w*.42+bw*(i+.5),0,0,2);
                animate(bar,(o,t,p)=>{const size=.12+(.2+p*.7)*Math.abs(Math.sin(i*.61+t*1.7));o.scale.y=size;o.position.y=-r.h*.33+h*size/2;});
            }
        }else{
            panel({...r,h:r.h*.8},'dark');
            for(let i=0;i<42;i++){
                const x=(i/41-.5)*r.w*.87,y=Math.sin(i*.9)*Math.pow(Math.max(0,Math.cos(i*.28)),8)*r.h*.3;
                const pin=cylinder(g,2,Math.max(4,Math.abs(y)*2),'accent',x,0,25);
                animate(pin,(o,t,p)=>{o.scale.y=.25+(p+.2)*Math.abs(Math.sin(t*1.3-i*.2));});
            }
        }
    }

    const boundsSelector = '.pedestal,.vault-column,.portrait,.rank-row,.collector,.marquee-person,.mosaic-cell,.activity,.ticker-item,.strip-stat,.wall-person,.layout-quote,.arrival-row,.event-art,.event-copy,.event-value,.instrument,.quest-row,.digit,.poll-option,.poll-track,.race-track,.meter';
    function rebuild() {
        model.clear(); usedGeometry.clear(); animations = []; progressParts = []; meshes = 0;
        const family = SCENE_FAMILIES[layout], instrument = first('.instrument');
        if (family === 'podium' || family === 'vault') buildPodium();
        else if (['gallery', 'orrery', 'regalia'].includes(family)) buildRegalia();
        else if (['glass', 'quest', 'odometer'].includes(family)) buildPanels();
        else if (family === 'votes') buildVotes();
        else if (instrument) {
            if (family === 'dial') buildDial(instrument);
            else if (family === 'stairs') buildStairs(instrument);
            else if (family === 'bridge') buildBridge(instrument);
            else if (family === 'thermometer') buildThermometer(instrument);
            else if (family === 'constellation') buildConstellation(instrument);
            else buildEnergy(instrument);
        } else buildEvents();
        if (family === 'quest') buildVotes();
        // Reuse unchanged geometry, but release geometry from old pages and formats.
        for (const [id, shape] of geometryCache) if (!usedGeometry.has(id)) { shape.dispose(); geometryCache.delete(id); }
        rebuilds++;
    }
    function resize() {
        const w = Math.max(1, Math.min(1920, host.clientWidth || 900));
        const h = Math.max(1, Math.min(1920, host.clientHeight || 640));
        if (width === w && height === h) return;
        width = w; height = h; renderer.setSize(w, h, false);
        camera.left = -w / 2; camera.right = w / 2; camera.top = h / 2; camera.bottom = -h / 2;
        camera.updateProjectionMatrix(); signature = '';
    }
    function update(next = {}) {
        if (disposed || lost) return;
        if (next.eventId && next.eventId !== input.eventId) elapsed = 0;
        input = { ...input, ...next }; resize();
        if (host.hidden || !host.querySelector('.layout')) { stop(); renderer.clear(); return; }
        host.dataset.cinematic = 'ready'; canvas.hidden = false;
        const bounds = rects(boundsSelector).map(r => [r.node.className, r.node.dataset.key || '', ...[r.x, r.y, r.w, r.h].map(n => Math.round(n * 2) / 2)]);
        const nextSignature = JSON.stringify([width, height, bounds]);
        if (signature !== nextSignature) { signature = nextSignature; rebuild(); }
        suspended = preview && doc.hidden;
        if (!suspended && !raf && !timer) draw(win.performance.now());
    }
    function applyProgress() {
        const p = clamp(input.progress);
        for (const part of progressParts) {
            const o = part.item, own = part.node ? clamp(parseFloat(part.node.style.getPropertyValue('--progress'))) : p;
            if (part.kind === 'bar') { o.scale.x = Math.max(.002, own); o.position.x = -part.w * (1 - own) / 2; }
            else if (part.kind === 'liquid') { o.scale.y = Math.max(.01, part.h * p); o.position.y = -part.h / 2 + part.h * p / 2; }
            else if (part.kind === 'needle') o.rotation.z = Math.PI / 2 - p * Math.PI;
            else if (part.kind === 'step') {
                const lit = (part.index + 1) / part.count <= p;
                o.traverse(n => { if (n.isMesh) n.material = lit ? materials.accent : materials.dark; });
            } else if (part.kind === 'tick') o.material = part.index / part.count < p ? materials.accent : materials.metal;
            else if (part.kind === 'tower') o.material = part.index < Math.min(10, Math.max(1, Number(input.combo) || 1)) ? materials.accent : materials.dark;
        }
    }
    function stop() { win.cancelAnimationFrame(raf); win.clearTimeout(timer); raf = timer = 0; last = -Infinity; }
    function schedule() {
        if (disposed || lost || host.hidden || reduced.matches || preview && doc.hidden) return;
        if (doc.hidden) timer = win.setTimeout(() => { timer = 0; draw(win.performance.now()); }, 1000 / 30);
        else raf = win.requestAnimationFrame(draw);
    }
    function draw(at) {
        raf = 0;
        if (disposed || lost || host.hidden || preview && doc.hidden) return;
        try {
            if (at - last >= 1000 / 30 - .5 || reduced.matches) {
                elapsed += Number.isFinite(last) ? Math.min(.075, (at - last) / 1000) : 0;
                last = at; applyProgress();
                const t = reduced.matches ? 0 : elapsed;
                for (const { object, fn } of animations) fn(object, t, clamp(input.progress));
                renderer.render(scene, camera); frames++;
            }
            schedule();
        } catch (error) { fail(error); }
    }
    function fail(error) {
        if (disposed) return;
        lost = true; stop(); canvas.hidden = true; delete host.dataset.cinematic;
        host.dataset.cinematicError = String(error?.message || error).slice(0, 160);
        onError(error);
    }
    function contextLost(event) { event.preventDefault(); fail(new Error('WebGL context lost')); }
    function contextRestored() {
        if (disposed) return;
        const generator = new T.PMREMGenerator(renderer);
        try {
            const restored = generator.fromScene(studio, .06, .1, 100);
            environment.dispose(); environment = restored; scene.environment = restored.texture;
            lost = false; signature = ''; delete host.dataset.cinematicError; update();
        } catch (error) { fail(error); }
        finally { generator.dispose(); }
    }
    function visibility() {
        stop(); suspended = preview && doc.hidden;
        if (!suspended) update();
    }
    function motionChanged() { stop(); update(); }
    function dispose() {
        if (disposed) return;
        disposed = true; stop(); observer.disconnect(); assetController?.abort();
        doc.removeEventListener('visibilitychange', visibility); reduced.removeEventListener('change', motionChanged);
        win.removeEventListener('pagehide', dispose);
        canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored);
        model.clear(); geometryCache.forEach(shape => shape.dispose()); geometryCache.clear();
        Object.values(materials).forEach(material => material.dispose()); textureMaterial?.dispose();
        const bitmap = texture?.image; texture?.dispose(); bitmap?.close?.();
        scene.environment = null; environment.dispose(); key.shadow.dispose(); scene.clear(); renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss();
        canvas.remove(); delete host.dataset.cinematic; delete host.dataset.cinematicOrnament; delete host.dataset.cinematicError;
        animations = []; progressParts = []; input = {};
    }
    const observer = new win.ResizeObserver(() => { if (!disposed) update(); }); observer.observe(host);
    canvas.addEventListener('webglcontextlost', contextLost); canvas.addEventListener('webglcontextrestored', contextRestored);
    doc.addEventListener('visibilitychange', visibility); reduced.addEventListener('change', motionChanged);
    win.addEventListener('pagehide', dispose, { once: true });
    {
        assetController = new win.AbortController();
        const asset = paletteName === 'inferno' ? 'inferno-crown.png' : 'botanical-crown.png';
        win.fetch(new URL('assets/' + asset, import.meta.url), { signal: assetController.signal })
            .then(response => { if (!response.ok) throw new Error('Ornament HTTP ' + response.status); return response.blob(); })
            .then(blob => win.createImageBitmap(blob, { imageOrientation: 'flipY' }))
            .then(bitmap => {
                if (disposed) { bitmap.close(); return; }
                texture = new T.Texture(bitmap); texture.flipY = false; texture.colorSpace = T.SRGBColorSpace; texture.needsUpdate = true;
                textureMaterial = new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });
                host.dataset.cinematicOrnament = asset; signature = ''; update();
            }).catch(error => { if (!disposed && error.name !== 'AbortError') host.dataset.cinematicOrnament = 'unavailable: ' + error.message; });
    }
    return { update, resize: update, dispose, getState: () => ({ layout, family: SCENE_FAMILIES[layout], theme: paletteName,
        quality: resolvedQuality, dpr: renderer.getPixelRatio(), width, height, frames, meshes, rebuilds, geometries: geometryCache.size,
        textures: renderer.info.memory.textures, triangles: renderer.info.render.triangles, drawCalls: renderer.info.render.calls,
        elapsed, progress: clamp(input.progress), animatedParts: animations.length, profileStyle: profileStyleFor(layout, paletteName),
        suspended, lost, disposed, reducedMotion: reduced.matches }) };
}
