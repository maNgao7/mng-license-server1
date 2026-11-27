import * as T from './three.module.js';
import { RoomEnvironment } from './RoomEnvironment.js';

export const LEGACY_TYPES = Object.freeze(['likefountain', 'coindrop', 'firework', 'wheel', 'actionwheel']);
const TAU = Math.PI * 2;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
export const wheelRotation = angle => -(Number.isFinite(Number(angle)) ? Number(angle) : 0);
export const fireworkPhase = progress => progress < .22 ? 'launch' : progress < .64 ? 'burst' : 'name';

export const HEART_STYLES = Object.freeze(['fountain', 'rain', 'spiral', 'wings', 'burst', 'trail', 'aura', 'sweep', 'double-spiral', 'heartstorm']);
export function heartPose(style, age, seed = 0, reduced = false) {
    const k = ((seed % 1) + 1) % 1, side = k < .5 ? -1 : 1;
    const t = reduced ? 1.25 : Math.max(0, Number(age) || 0), a = k * TAU;
    let x, y, z = 0, turn = 0, scale = 1;
    switch (style) {
        case 'rain': x = 50 + k * 800 + Math.sin(t + a) * 16; y = -80 + t * (110 + k * 65); turn = .2; break;
        case 'spiral': {
            const r = Math.max(25, 205 - t * 28), angle = a + t * 1.8;
            x = 450 + Math.cos(angle) * r; y = 300 + Math.sin(angle) * r * .85; z = Math.sin(angle) * 65; turn = angle; break;
        }
        case 'wings': {
            const reach = Math.sin(Math.min(1, t / 1.3) * Math.PI / 2), feather = (k * 2) % 1;
            x = 450 + side * (35 + feather * 335) * reach;
            y = 340 - Math.sin(feather * Math.PI * .85) * 215 * reach + t * 5;
            turn = -side * (.25 + feather * .65); z = feather * 35; break;
        }
        case 'burst': {
            const radius = (1 - Math.exp(-t * 1.3)) * (100 + k * 240);
            x = 450 + Math.cos(a) * radius; y = 285 + Math.sin(a) * radius * .72 + t * t * 5; turn = a; break;
        }
        case 'trail': x = -100 + t * 170 - k * 250; y = 300 + Math.sin((x + k * 55) / 95) * 125; z = Math.cos(x / 95) * 40; scale = .6 + k * .65; turn = Math.cos(x / 95) * .5; break;
        case 'aura': {
            const pulse = 1 + Math.sin(t * 2) * .06;
            x = 450 + 16 * Math.sin(a) ** 3 * 15 * pulse;
            y = 285 - (13 * Math.cos(a) - 5 * Math.cos(2*a) - 2 * Math.cos(3*a) - Math.cos(4*a)) * 14 * pulse;
            z = Math.sin(t + a) * 20; scale = .8; break;
        }
        case 'sweep': x = -140 + t * 210 - k * 140; y = 630 - t * 135 + k * 180; turn = -.7; z = k * 40; break;
        case 'double-spiral': {
            const angle = t * 2.8 + k * 4 * Math.PI;
            x = 450 + Math.cos(angle) * 160; y = 580 - t * 95 - k * 110; z = Math.sin(angle) * 100;
            turn = Math.sin(angle) * .4; scale = .65 + (z + 100) / 400; break;
        }
        case 'heartstorm': {
            const lift = Math.min(1, t / 4.5), radius = 270 * (1 - lift) + 28, angle = a + t * (2.5 + lift);
            x = 450 + Math.cos(angle) * radius; y = 610 - lift * 580 + Math.sin(angle) * radius * .16;
            z = Math.sin(angle) * 100; turn = Math.cos(angle) * .65; scale = .7 + (z + 100) / 250; break;
        }
        default: x = 450 + side * (115 + t * (60 + k * 30)); y = 650 - t * (275 + k * 65) + 39 * t * t; turn = side * t * .15;
    }
    return { x, y, z, turn, scale };
}

export function createLegacyRenderer(host, { type, preview = false, quality = 'auto', resolveImage = () => '', onError = () => {} } = {}) {
    if (!host || !LEGACY_TYPES.includes(type)) throw new TypeError('Unsupported legacy scene');
    const doc = host.ownerDocument, win = doc.defaultView;
    const low = quality === 'low' || quality === 'auto' && (win.navigator.hardwareConcurrency <= 4 || win.devicePixelRatio > 2);
    const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: !low, powerPreference: 'low-power' });
    renderer.setSize(900, 600, false); renderer.setPixelRatio(Math.min(low ? 1 : 1.5, win.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
    const canvas = renderer.domElement; canvas.className = 'legacy-scene'; canvas.setAttribute('aria-hidden', 'true');
    const portraits = doc.createElement('div'); portraits.className = 'legacy-portraits'; portraits.setAttribute('aria-hidden', 'true');
    host.prepend(canvas); host.append(portraits);
    const scene = new T.Scene(), camera = new T.OrthographicCamera(-450, 450, 300, -300, 1, 3000);
    camera.position.z = 1200;
    const key = new T.DirectionalLight(0xffedcf, 2.8); key.position.set(-300, 460, 700);
    const fill = new T.DirectionalLight(0xace4ff, 1.2); fill.position.set(450, -100, 500);
    scene.add(key, fill, new T.HemisphereLight(0xe5f7ff, 0x362224, 1.1));
    let environment = null, disposed = false, failed = false, frames = 0, last = -Infinity, signature = '', rotor = null;
    let input = {}, phase = 'idle', instanceCount = 0, displayedAngle = 0;
    const geometries = new Set(), materials = new Set(), textures = new Set(), pools = new Map(), avatarNodes = new Map();
    const wheel = new T.Group(), particles = new T.Group(); scene.add(wheel, particles);
    const geo = shape => { geometries.add(shape); return shape; };
    const material = options => { const m = new T.MeshPhysicalMaterial(options); materials.add(m); return m; };
    const gold = material({ color: 0xdab76c, metalness: .88, roughness: .24, clearcoat: .8 });
    const silver = material({ color: 0xc4d9df, metalness: .9, roughness: .2, clearcoat: 1 });
    const dark = material({ color: 0x15252a, metalness: .5, roughness: .32, clearcoat: .7 });
    const enamel = material({ color: 0xffffff, metalness: .32, roughness: .24, clearcoat: 1 });
    const ember = material({ color: 0xffca80, emissive: 0xff5515, emissiveIntensity: 1.6, metalness: .55, roughness: .25 });
    const pink = material({ color: 0xffffff, metalness: .28, roughness: .22, clearcoat: 1, sheen: .35 });
    const unitDisk = geo(new T.CylinderGeometry(1, 1, .2, low ? 24 : 40).rotateX(Math.PI / 2));
    const unitRim = geo(new T.TorusGeometry(.88, .055, 6, low ? 24 : 40));
    const gem = geo(new T.OctahedronGeometry(1));
    const thumbnail = geo(new T.PlaneGeometry(2, 2));
    const pin = geo(new T.CylinderGeometry(1, 1, 1, 6));
    const heartShape = new T.Shape();
    heartShape.moveTo(0, -.9); heartShape.bezierCurveTo(-1.7, .15, -.9, 1.45, 0, .55);
    heartShape.bezierCurveTo(.9, 1.45, 1.7, .15, 0, -.9);
    const heart = geo(new T.ExtrudeGeometry(heartShape, { depth: .28, bevelEnabled: true, bevelThickness: .16, bevelSize: .12, bevelSegments: 3, curveSegments: low ? 6 : 10 }));
    heart.translate(0, 0, -.14);
    const stampShape = new T.Shape();
    stampShape.moveTo(-.37,.5); stampShape.lineTo(.37,.5); stampShape.lineTo(.37,.31); stampShape.lineTo(.11,.31);
    stampShape.lineTo(.11,-.48); stampShape.lineTo(-.11,-.48); stampShape.lineTo(-.11,.31); stampShape.lineTo(-.37,.31); stampShape.closePath();
    const stamp = geo(new T.ExtrudeGeometry(stampShape, { depth: .04, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 2 }));
    const dummy = new T.Object3D(), color = new T.Color(), up = new T.Vector3(0, 1, 0);
    const palette = ['#ff608c', '#79d8de', '#f5cf79', '#a8e0b5', '#dca4c5', '#ff9f6a'];
    const particleBirths = new WeakMap(), giftImages = new Map();
    const requestedStyle = new URLSearchParams(win.location?.search || '').get('scene') || new URLSearchParams(win.location?.search || '').get('type') || '';
    let imageSerial = 0, giftImageErrors = 0;

    function giftSurface(raw) {
        const url = resolveImage(raw);
        if (!url) return null;
        let entry = giftImages.get(url);
        if (entry) { entry.used = frames; return entry.loaded ? entry : null; }
        if (giftImages.size >= 12) {
            const [oldURL, old] = [...giftImages].sort((a, b) => a[1].used - b[1].used)[0];
            if (old.used === frames) return null;
            const oldPool = pools.get(old.name);
            if (oldPool) { particles.remove(oldPool.item); oldPool.item.dispose(); pools.delete(old.name); }
            old.dead = true; old.texture.dispose(); textures.delete(old.texture);
            old.surface.dispose(); materials.delete(old.surface); giftImages.delete(oldURL);
        }
        entry = { name: 'gift-image-' + imageSerial++, used: frames, loaded: false, dead: false };
        const surface = new T.MeshBasicMaterial({ transparent: true, alphaTest: .03, side: T.DoubleSide, depthWrite: false, toneMapped: false });
        materials.add(surface); entry.surface = surface; giftImages.set(url, entry);
        entry.texture = new T.TextureLoader().load(url, texture => {
            if (disposed || entry.dead) { texture.dispose(); return; }
            texture.colorSpace = T.SRGBColorSpace; surface.map = texture; surface.needsUpdate = true; entry.loaded = true;
        }, undefined, () => { if (!disposed && !entry.dead) giftImageErrors++; });
        textures.add(entry.texture);
        return null;
    }
    function giftInstance(raw, pose) {
        const entry = giftSurface(raw);
        if (!entry) return false;
        const aspect = entry.texture.image.width / Math.max(1, entry.texture.image.height);
        instance(entry.name, thumbnail, entry.surface, { ...pose, sx: pose.sx * Math.min(1, aspect), sy: pose.sx * Math.min(1, 1 / aspect), sz: 1 });
        return true;
    }

    function mesh(parent, geometry, surface, x = 0, y = 0, z = 0) {
        const item = new T.Mesh(geometry, surface); item.position.set(x, y, z); parent.add(item); return item;
    }
    function roundedBox(parent, w, h, depth, surface, x, y, z) {
        const s = new T.Shape(), a = w / 2, b = h / 2, r = Math.min(5, w / 5, h / 5);
        s.moveTo(-a+r,-b); s.lineTo(a-r,-b); s.quadraticCurveTo(a,-b,a,-b+r); s.lineTo(a,b-r); s.quadraticCurveTo(a,b,a-r,b);
        s.lineTo(-a+r,b); s.quadraticCurveTo(-a,b,-a,b-r); s.lineTo(-a,-b+r); s.quadraticCurveTo(-a,-b,-a+r,-b);
        return mesh(parent, geo(new T.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 2, bevelThickness: 2, bevelSegments: 2 })), surface, x, y, z);
    }
    function pool(name, geometry, surface, capacity = 240) {
        if (!pools.has(name)) {
            const item = new T.InstancedMesh(geometry, surface, capacity); item.count = 0; item.frustumCulled = false;
            item.instanceMatrix.setUsage(T.DynamicDrawUsage); particles.add(item); pools.set(name, { item, count: 0, capacity });
        }
        return pools.get(name);
    }
    function instance(name, geometry, surface, { x, y, z = 0, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0, tint = null, direction = null }) {
        const p = pool(name, geometry, surface); if (p.count >= p.capacity) return;
        dummy.position.set(x - 450, 300 - y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(rx, ry, rz);
        if (direction) dummy.quaternion.setFromUnitVectors(up, direction);
        dummy.updateMatrix(); p.item.setMatrixAt(p.count, dummy.matrix);
        if (tint) p.item.setColorAt(p.count, color.set(tint)); p.count++;
    }
    function releaseWheel() {
        const usedGeo = new Set(), usedMat = new Set(), usedTex = new Set();
        wheel.traverse(item => {
            if (!item.isMesh) return; usedGeo.add(item.geometry);
            for (const m of Array.isArray(item.material) ? item.material : [item.material]) {
                if ([gold, silver, dark, enamel, ember, pink].includes(m)) continue;
                usedMat.add(m); if (m.map) usedTex.add(m.map);
            }
        });
        wheel.clear(); rotor = null;
        for (const g of usedGeo) { g.dispose(); geometries.delete(g); }
        for (const m of usedMat) { m.dispose(); materials.delete(m); }
        for (const t of usedTex) { t.dispose(); textures.delete(t); }
    }
    function buildWheel(labels, colors) {
        releaseWheel(); wheel.position.set(0, 25, 0);
        roundedBox(wheel, 264, 15, 46, gold, 0, -253, -36);
        for (const side of [-1, 1]) { roundedBox(wheel, 16, 84, 28, silver, side * 91, -217, -24); }
        mesh(wheel, geo(new T.CylinderGeometry(224, 224, 24, low ? 64 : 96).rotateX(Math.PI / 2)), dark, 0, 0, -16);
        for (const [radius, tube, surface, z] of [[220, 10, gold, 2], [232, 2.5, silver, -3], [207, 2.5, silver, 26]]) {
            mesh(wheel, geo(new T.TorusGeometry(radius, tube, 10, low ? 72 : 112)), surface, 0, 0, z);
        }
        rotor = new T.Group(); wheel.add(rotor);
        const arc = TAU / labels.length;
        labels.forEach((_label, i) => {
            const s = new T.Shape(), gap = Math.min(.009, arc * .035), a0 = i * arc + gap, a1 = (i + 1) * arc - gap;
            s.moveTo(Math.cos(a0) * 53, -Math.sin(a0) * 53); s.lineTo(Math.cos(a0) * 204, -Math.sin(a0) * 204);
            for (let j = 1; j <= 16; j++) { const a = a0 + (a1 - a0) * j / 16; s.lineTo(Math.cos(a) * 204, -Math.sin(a) * 204); }
            s.lineTo(Math.cos(a1) * 53, -Math.sin(a1) * 53);
            for (let j = 15; j >= 0; j--) { const a = a0 + (a1 - a0) * j / 16; s.lineTo(Math.cos(a) * 53, -Math.sin(a) * 53); }
            s.closePath();
            const surface = material({ color: colors[i % colors.length] || palette[i % palette.length], metalness: .38, roughness: .28, clearcoat: 1 });
            mesh(rotor, geo(new T.ExtrudeGeometry(s, { depth: 16, bevelEnabled: true, bevelThickness: 2, bevelSize: Math.min(1.5, 30 / labels.length), bevelSegments: 2 })), surface, 0, 0, 2);
        });
        const labelCanvas = doc.createElement('canvas'); labelCanvas.width = labelCanvas.height = low ? 1024 : 1536;
        const ctx = labelCanvas.getContext('2d'), scale = labelCanvas.width / 440;
        ctx.scale(scale, scale); ctx.translate(220, 220); ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#111820'; ctx.shadowBlur = 3;
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.font = '600 ' + (labels.length > 20 ? 18 : 23) + 'px Arial';
        labels.forEach((label, i) => {
            ctx.save(); ctx.rotate((i + .5) * arc); let text = String(label).slice(0, 120);
            while (ctx.measureText(text).width > 132 && text.length > 2) text = text.slice(0, -2);
            ctx.fillText(text, 185, 0); ctx.restore();
        });
        const labelTexture = new T.CanvasTexture(labelCanvas); labelTexture.colorSpace = T.SRGBColorSpace; textures.add(labelTexture);
        const labelMaterial = new T.MeshBasicMaterial({ map: labelTexture, transparent: true, depthWrite: false, toneMapped: false }); materials.add(labelMaterial);
        mesh(rotor, geo(new T.PlaneGeometry(440, 440)), labelMaterial, 0, 0, 23);
        for (let i = 0; i < 48; i++) {
            const a = i / 48 * TAU;
            mesh(wheel, geo(new T.SphereGeometry(2.8, 6, 4)), i % 4 ? gold : silver, Math.cos(a) * 220, Math.sin(a) * 220, 13);
        }
        mesh(wheel, geo(new T.CylinderGeometry(53, 53, 26, 48).rotateX(Math.PI / 2)), dark, 0, 0, 18);
        mesh(wheel, geo(new T.TorusGeometry(52, 4, 8, 64)), silver, 0, 0, 33);
        const pointerShape = new T.Shape(); pointerShape.moveTo(-17,242); pointerShape.lineTo(17,242); pointerShape.lineTo(0,197); pointerShape.closePath();
        const pointer = material({ color: 0xef5979, metalness: .48, roughness: .22, clearcoat: 1 });
        mesh(wheel, geo(new T.ExtrudeGeometry(pointerShape, { depth: 10, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 2 })), pointer, 0, 0, 36);
    }
    function avatar(p, x, y, keep) {
        keep.add(p); let node = avatarNodes.get(p);
        if (!node) {
            node = doc.createElement('div'); node.className = 'legacy-avatar';
            const fallback = doc.createElement('span'); fallback.textContent = String(p.label || '').slice(0, 2); node.append(fallback);
            const url = resolveImage(p.image);
            if (url) {
                const img = doc.createElement('img'); img.alt = ''; img.referrerPolicy = 'no-referrer';
                img.onload = () => { fallback.hidden = true; }; img.onerror = () => img.remove(); img.src = url; node.append(img);
            }
            portraits.append(node); avatarNodes.set(p, node);
        }
        const r = clamp(p.r, 6, 60);
        Object.assign(node.style, { left: (x - r) + 'px', top: (y - r) + 'px', width: r * 2 + 'px', height: r * 2 + 'px', opacity: String(clamp(p.life)) });
        instance('avatar-rim', unitRim, gold, { x, y, z: 10, sx: r * 1.15 });
    }
    function drawParticles() {
        const keep = new Set();
        for (const [i, p] of (input.particles || []).slice(-240).entries()) {
            if (!(p.life > 0)) continue;
            let x = p.x, y = p.y, z = Math.sin(i * 2.3) * 24, effectTurn = 0, effectScale = 1;
            const style = p.effectStyle || input.effectStyle || requestedStyle.replace(/^effect-/, '');
            if (type === 'likefountain' && HEART_STYLES.includes(style)) {
                if (!particleBirths.has(p)) particleBirths.set(p, { life: p.life, seed: Number.isFinite(p.wave) ? p.wave / TAU : i * .61803398875 });
                const birth = particleBirths.get(p), pose = heartPose(style, birth.life - p.life, birth.seed, reduced.matches);
                ({ x, y, z, turn: effectTurn, scale: effectScale } = pose);
            }
            if (p.kind !== 'coin' && !reduced.matches) x += Math.sin(p.life * 2 + (p.wave || 0)) * 12;
            if (reduced.matches && !HEART_STYLES.includes(style)) { x = 75 + i * 67 % 750; y = 90 + i * 43 % 390; }
            const r = clamp(p.r, 3, 60) * clamp(p.life, .02, 1) * effectScale, turn = reduced.matches ? .2 : (p.wave || 0) + p.life * .8;
            if (p.kind === 'avatar') { avatar(p, x, y, keep); continue; }
            if (p.kind === 'heart') instance('hearts', heart, pink, { x, y, z, sx: r, rx: .16, ry: reduced.matches ? .1 : Math.sin(turn) * .6, rz: effectTurn + (reduced.matches ? 0 : Math.sin(turn * .6) * .18), tint: p.color || palette[i % 6] });
            if (p.kind === 'confetti') instance('confetti', gem, enamel, { x, y, z: Math.sin(i)*25, sx:r*.5,sy:r*.9,sz:r*.15,rx:turn*2,ry:turn*3,rz:turn,tint:p.color||palette[i%6] });
            if (p.kind === 'coin') {
                const pose = { x, y, z: Math.sin(i) * 22, sx: r, rx: Math.sin(turn) * .35, ry: reduced.matches ? -.32 : turn * 4, rz: turn * .5 };
                instance('coins', unitDisk, gold, pose);
                // Separate raised rims and mint marks share the exact body transform.
                dummy.position.set(x - 450, 300 - y, pose.z); dummy.rotation.set(pose.rx, pose.ry, pose.rz); dummy.scale.setScalar(r); dummy.updateMatrix();
                for (const [name, shape, surface, offset] of [['coin-rim-front', unitRim, silver, .13], ['coin-rim-back', unitRim, gold, -.13], ['coin-stamp', stamp, gold, .14]]) {
                    const entry = pool(name, shape, surface), matrix = dummy.matrix.clone().multiply(new T.Matrix4().makeTranslation(0, 0, offset));
                    if (entry.count < entry.capacity) entry.item.setMatrixAt(entry.count++, matrix);
                }
            }
        }
        for (const [p, node] of avatarNodes) if (!keep.has(p)) { node.remove(); avatarNodes.delete(p); }
    }
    function firework() {
        if (!input.firework?.active) { phase = 'idle'; return; }
        const t = clamp(input.firework.progress); phase = fireworkPhase(t);
        if(input.firework.style==='confetti'){
            phase='confetti';const count=low?48:90;
            for(let i=0;i<count;i++){
                const k=(i*.61803398875)%1,progress=reduced.matches?k:(t*1.5+k)%1,x=45+(i*137)%810+(reduced.matches?0:Math.sin(t*8+i)*24),y=-50+progress*660;
                const turn=reduced.matches?.12:Math.sin(t*4+i)*.45;
                if(i%3!==0 && giftInstance(input.firework.giftImage,{x,y,z:30+Math.sin(i)*20,sx:17+i%4*4,ry:turn,rz:turn*.6}))continue;
                instance('gift-ribbons',gem,enamel,{x,y,z:-10,sx:3,sy:9,sz:1,rx:turn,ry:turn,rz:turn+i,tint:palette[i%6]});
            }return;
        }
        if (phase === 'name') return;
        if (phase === 'launch') {
            const progress = reduced.matches ? .65 : t / .22, y = 630 - 430 * (1 - (1 - progress) ** 2);
            if (!giftInstance(input.firework.giftImage, { x: 450, y, z: 10, sx: 29 })) instance('rocket', gem, gold, { x: 450, y, z: 10, sx: 13, sy: 27, sz: 13 });
            for (let i = 0; i < 18; i++) instance('embers', gem, ember, { x: 450 + Math.sin(i * 2.4) * i * .7, y: y + i * 7, sx: Math.max(1.5, 5 - i * .2), rz: i });
            return;
        }
        const age = reduced.matches ? .45 : (t - .22) / .42, seed = Number(input.firework.seed) || 0;
        const count = Math.round(clamp(input.firework.count || 32, 8, low ? 64 : 100));
        for (let i = 0; i < count; i++) {
            const a = i / count * TAU, variation = .55 + ((Math.imul(i + 1, 1597) ^ seed) >>> 0) % 50 / 100;
            const radius = (1 - (1 - age) ** 2) * 265 * variation;
            const x = 450 + Math.cos(a) * radius, y = 225 + Math.sin(a) * radius * .72 + age * age * 110;
            const z = Math.sin(i * 2.4) * radius * .26, size = Math.max(.5, (1 - age) * (i % 3 ? 5 : 8));
            if (i % 3 || !giftInstance(input.firework.giftImage, { x, y, z, sx: Math.max(9, size * 3), rz: a * age * .3 })) instance('sparks', gem, enamel, { x, y, z, sx: size, sy: size * 1.7, sz: size, ry: a + age * 2, tint: palette[i % 6] });
            const length = Math.max(1, 25 * (1 - age)), direction = new T.Vector3(Math.cos(a), -Math.sin(a) * .72, Math.sin(i * 2.4) * .26).normalize();
            instance('ember-tails', pin, ember, { x: x - Math.cos(a) * length / 2, y: y - Math.sin(a) * length * .36, z, sx: size * .2, sy: length, sz: size * .2, direction });
        }
    }
    function update(next = {}, time = win.performance.now()) {
        if (disposed || failed) return false;
        input = next;
        if (preview && doc.hidden) return true;
        if (time - last < 1000 / 30 - 1) return true;
        last = time;
        try {
            for (const entry of pools.values()) entry.count = 0;
            if (['wheel', 'actionwheel'].includes(type)) {
                const labels = (input.wheel?.labels || []).slice(0, 60).map(label => String(label).slice(0, 120));
                const colors = (input.wheel?.colors || []).filter(value => /^#[a-f0-9]{6}$/i.test(value));
                const key = JSON.stringify([labels, colors]);
                if (labels.length && signature !== key) { signature = key; buildWheel(labels, colors); }
                wheel.visible = !!input.wheel?.active && labels.length > 0;
                displayedAngle = reduced.matches && !input.wheel?.finished ? 0 : Number(input.wheel?.angle) || 0;
                if (rotor) rotor.rotation.z = wheelRotation(displayedAngle);
            } else if (type === 'firework') firework();
            else drawParticles();
            instanceCount = 0;
            for (const entry of pools.values()) {
                entry.item.count = entry.count; instanceCount += entry.count;
                entry.item.instanceMatrix.needsUpdate = true;
                if (entry.item.instanceColor) entry.item.instanceColor.needsUpdate = true;
            }
            renderer.render(scene, camera); frames++; canvas.hidden = false; portraits.hidden = false;
            host.dataset.legacyCinematic = 'ready'; return true;
        } catch (error) { fail(error); return false; }
    }
    function clear() {
        input = {}; wheel.visible = false; instanceCount = 0; phase = 'idle'; last = -Infinity;
        for (const entry of pools.values()) entry.item.count = entry.count = 0;
        for (const node of avatarNodes.values()) node.remove(); avatarNodes.clear(); renderer.clear();
    }
    function fail(error) {
        if (disposed) return; failed = true; canvas.hidden = portraits.hidden = true;
        delete host.dataset.legacyCinematic; host.dataset.legacyCinematicError = String(error.message || error).slice(0, 160); onError(error);
    }
    function contextLost(event) { event.preventDefault(); fail(new Error('Legacy WebGL context lost')); }
    function dispose() {
        if (disposed) return; clear(); disposed = true;
        canvas.removeEventListener('webglcontextlost', contextLost); win.removeEventListener('pagehide', dispose);
        geometries.forEach(g => g.dispose()); geometries.clear(); materials.forEach(m => m.dispose()); materials.clear();
        textures.forEach(t => t.dispose()); textures.clear(); scene.environment = null; environment?.dispose(); scene.clear();
        renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); portraits.remove();
        pools.forEach(entry => entry.item.dispose()); pools.clear(); giftImages.clear(); delete host.dataset.legacyCinematic;
    }
    try {
        const room = new RoomEnvironment(), generator = new T.PMREMGenerator(renderer);
        try { environment = generator.fromScene(room, .04); scene.environment = environment.texture; scene.environmentIntensity = .85; }
        finally { generator.dispose(); room.dispose(); }
    } catch (error) { dispose(); throw error; }
    canvas.addEventListener('webglcontextlost', contextLost); win.addEventListener('pagehide', dispose, { once: true });
    return { update, clear, dispose, getState: () => ({ type, ready: !failed && !disposed, failed, disposed, frames, phase,
        instances: instanceCount, geometries: geometries.size, textures: renderer.info.memory.textures,
        triangles: renderer.info.render.triangles, drawCalls: renderer.info.render.calls, dpr: renderer.getPixelRatio(),
        width: 900, height: 600, wheelAngle: Number(input.wheel?.angle) || 0, displayedAngle,
        effectStyle: input.effectStyle || requestedStyle.replace(/^effect-/, ''), giftImages: giftImages.size, giftImagesReady: [...giftImages.values()].filter(entry => entry.loaded).length, giftImageErrors,
        rotorAngle: rotor?.rotation.z || 0, segments: input.wheel?.labels?.length || 0, reducedMotion: reduced.matches }) };
}
