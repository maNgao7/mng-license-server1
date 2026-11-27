import * as THREE from './three.module.js';
import { FontLoader } from './FontLoader.js';
import { TextGeometry } from './TextGeometry.js';
import { RoomEnvironment } from './RoomEnvironment.js';
import { CHARACTER_MOTIFS, createPKCharacterRig } from './pk-character-rig.js';

const THEMES = {
    inferno: { face: 0xffb43b, edge: 0x8b2409, light: 0xff5c16, spark: 0xffb34e },
    rose: { face: 0xf887c0, edge: 0x961a5a, light: 0xff92ca, spark: 0xffb8e2 },
    botanical: { face: 0xffdea0, edge: 0x87612d, light: 0xffcd86, spark: 0xbd2854 },
    platinum: { face: 0xe8f2ff, edge: 0x54606c, light: 0xbbf4ff, spark: 0xedffff }
};
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const number = (n, fallback, min, max) => n !== null && n !== '' && Number.isFinite(Number(n)) ? clamp(Number(n), min, max) : fallback;
export const IMPACT_MOTIFS = Object.freeze(['flame', 'inferno', 'rose', 'botanical', 'floral', 'floral-rose', 'floral-lotus', 'platinum', 'crystal', 'rainbow', ...CHARACTER_MOTIFS, 'gloves']);
export const IMPACT_ENTRANCES = Object.freeze(['bottom', 'top', 'left', 'right', 'burst']);
export function normalizeImpactSettings(raw = {}) {
    return { theme: Object.hasOwn(THEMES, raw.theme) ? raw.theme : 'inferno',
        motif: IMPACT_MOTIFS.includes(raw.motif) ? raw.motif : raw.theme === 'botanical' ? 'floral' : raw.theme === 'rose' ? 'rose' : raw.theme === 'platinum' ? 'platinum' : 'flame',
        entrance: IMPACT_ENTRANCES.includes(raw.entrance) ? raw.entrance : 'bottom',
        notification: ['multiplier', 'glove', 'both'].includes(raw.notification) ? raw.notification : 'both',
        impactScale: number(raw.impactScale, 100, 70, 140),
        quality: ['auto', 'high', 'low'].includes(raw.quality) ? raw.quality : 'auto',
        opacity: number(raw.opacity, 100, 0, 100) };
}
export function entrancePose(elapsed, duration, entrance, reduced = false) {
    if (reduced) return { x: 0, y: 0, z: 0, roll: 0 };
    const t = clamp(elapsed / Math.max(1, duration), 0, 1), enter = (1 - clamp(t / .20, 0, 1)) ** 3;
    const exit = clamp((t - .83) / .17, 0, 1) ** 2, travel = enter + exit;
    return { x: entrance === 'left' ? -10 * travel : entrance === 'right' ? 10 * travel : 0,
        y: entrance === 'top' ? 8 * travel : entrance === 'bottom' ? -8 * travel : 0,
        z: entrance === 'burst' ? -9 * enter + exit * 3 : 0,
        roll: (entrance === 'left' ? -.2 : entrance === 'right' ? .2 : 0) * enter };
}
export function glovePose(elapsed, duration, reduced = false) {
    const t = clamp(elapsed / Math.max(1, duration), 0, 1);
    const approach = clamp(t / .22, 0, 1), recoil = clamp((t - .25) / .18, 0, 1);
    const contact = reduced ? 0 : Math.exp(-(((t - .23) / .033) ** 2));
    return { separation: reduced ? 3.1 : 5.8 - 3.6 * (1 - (1 - approach) ** 3) + .9 * (1 - (1 - recoil) ** 3),
        rotation: reduced ? 0 : .25 * (1 - approach) - .16 * recoil,
        contact, sparks: reduced ? 0 : clamp((t - .22) / .24, 0, 1),
        phase: t < .20 ? 'approach' : t < .28 ? 'contact' : t < .5 ? 'recoil' : 'sustain' };
}
export function creaturePose(elapsed, reduced = false) {
    if (reduced) return { jaw: 1, roar: 0, head: 0, mane: 0, breath: 0 };
    const t = Math.max(0, elapsed) / 1000, cycle = (t % 2.6) / 2.6;
    const roar = Math.exp(-(((cycle - .45) / .16) ** 4));
    return { jaw: .94 + 1.08 * roar, roar, head: Math.sin(t * 1.9) * .045 - roar * .09,
        mane: .3 + roar * 1.15, breath: Math.sin(t * 2.8) * .5 + .5 };
}
export function impactEnvelope(elapsed, duration = 6000, reduced = false) {
    const t = clamp(elapsed / Math.max(1000, duration), 0, 1);
    if (reduced) return { scale: 1, opacity: Math.min(1, t * 15, (1 - t) * 8), turn: 0 };
    const enter = clamp(t / .15, 0, 1), exit = clamp((t - .81) / .19, 0, 1);
    const spring = 1 + 2.70158 * (enter - 1) ** 3 + 1.70158 * (enter - 1) ** 2;
    return { scale: (.12 + .88 * spring) * (1 + exit * .28),
        opacity: Math.min(1, enter * 5) * (1 - exit) ** 2,
        turn: (1 - enter) * -.95 + exit * .28 };
}

const vertexShader = `varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const flameShader = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uOpacity;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=a*noise(p);p=p*2.03+vec2(4.7,1.3);a*=.5;}return n;}
void main(){
vec2 p=vUv;float t=uTime;
float warp=fbm(vec2(p.x*5.,p.y*4.-t*1.8));
float streak=fbm(vec2(p.x*15.+warp*2.8,p.y*6.-t*3.2));
float fan=pow(abs(p.x-.5)*1.75,1.6);
float fire=(1.-p.y)*1.35-fan+streak*.72+warp*.24-.52;
float alpha=smoothstep(.03,.28,fire)*smoothstep(.05,.34,p.y)*(1.-smoothstep(.87,1.,p.y));
alpha*=smoothstep(0.,.18,p.x)*(1.-smoothstep(.82,1.,p.x));
float hot=clamp(fire*1.55,0.,1.);
vec3 color=mix(vec3(.78,.035,.004),vec3(1.,.36,.012),smoothstep(.08,.42,hot));
color=mix(color,vec3(1.,.92,.5),smoothstep(.48,.9,hot));
gl_FragColor=vec4(color,alpha*uOpacity);
}`;

const artworkShader = `varying vec2 vUv;
uniform sampler2D uMap;uniform vec4 uRect;uniform float uTime;uniform float uReady;uniform vec3 uTint;
uniform float uAlpha;uniform float uBlink;uniform vec2 uEyeA;uniform vec2 uEyeB;
void main(){vec2 local=vUv;
float eyes=max(1.-smoothstep(.75,1.,length((local-uEyeA)/vec2(.055,.025))),1.-smoothstep(.75,1.,length((local-uEyeB)/vec2(.055,.025))));
local.y+=eyes*uBlink*.045;
vec2 uv=mix(uRect.xy,uRect.xy+uRect.zw,mix(vec2(.004),vec2(.996),local));
vec4 art=texture2D(uMap,uv);float sweep=pow(max(0.,1.-abs(vUv.x+vUv.y*.23-fract(uTime*.19)*1.6)),28.);
vec3 lit=art.rgb*(.92+.08*sin(vUv.y*3.14))+uTint*sweep*.18;
gl_FragColor=vec4(lit,art.a*uReady*uAlpha);
#include <colorspace_fragment>
}`;
// Atlas artwork is deformed locally; this is a 2.5D portrait, not a rigged animal model.
const creatureVertexShader = `varying vec2 vUv;
uniform float uTime;uniform float uJaw;uniform float uHead;uniform float uMane;uniform float uBreath;
uniform vec4 uMouth;
void main(){vUv=uv;vec2 p=uv;
float jawMask=(1.-smoothstep(uMouth.z*.6,uMouth.z,abs(p.x-uMouth.x)))
    *smoothstep(uMouth.w-.23,uMouth.w-.10,p.y)*(1.-smoothstep(uMouth.y-.015,uMouth.y+.02,p.y));
p.y-=(uJaw-1.)*max(0.,uMouth.y-p.y)*jawMask;
float head=smoothstep(.28,.65,uv.y);vec2 pivot=vec2(.53,.38),d=p-pivot;
float turn=uHead*head,c=cos(turn),s=sin(turn);p=pivot+mat2(c,s,-s,c)*d;
float fringe=smoothstep(.12,.35,abs(uv.x-.52))*(1.-smoothstep(.76,.96,uv.y));
p.x+=sin(uv.y*24.-uTime*4.2+uv.x*9.)*.014*fringe*uMane;
p.y+=sin(uv.x*31.+uTime*3.5)*.009*fringe*uMane;
p.x+=(uv.x-.5)*uBreath*.025*(1.-smoothstep(.25,.57,uv.y));
vec3 transformed=position;transformed.xy+=(p-uv)*8.8;
transformed.z+=head*.10*sin(uTime*1.9)+uBreath*.08*(1.-head);
gl_Position=projectionMatrix*modelViewMatrix*vec4(transformed,1.);}`;
const breathShader = `varying vec2 vUv;uniform float uTime;uniform float uRoar;uniform vec3 uColor;
void main(){vec2 p=vUv;float lengthFade=smoothstep(0.,.15,p.y)*(1.-smoothstep(.58,1.,p.y));
float spread=.055+p.y*.32;float wave=sin(p.y*28.-uTime*16.)*.018*p.y;
float core=exp(-pow((p.x-.5-wave)/spread,2.)*3.);
float wisps=.65+.35*sin(p.y*43.-uTime*21.+sin(p.x*32.)*2.);
float alpha=core*lengthFade*wisps*uRoar*.7;if(alpha<.012)discard;
gl_FragColor=vec4(mix(uColor,vec3(1.,.94,.75),core*.75),alpha);
#include <colorspace_fragment>
}`;
const auraShader = `varying vec2 vUv;uniform float uTime;uniform float uContact;uniform vec3 uColor;uniform float uStyle;
void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);
float bend=.18*sin(p.x*(4.+uStyle*.08)+uTime*.7);
float ribbon=exp(-abs(p.y-bend)*110.)+exp(-abs(p.y+bend+.08)*150.)*.45;
float trail=ribbon*(1.-smoothstep(.3,.95,abs(p.x)))*.24;
float rays=pow(max(0.,cos(a*17.+uTime)),42.)*exp(-r*9.)*uContact;
float flash=uContact*exp(-r*22.)*1.5;
float alpha=trail+rays+flash;
if(alpha<.018)discard;
gl_FragColor=vec4(mix(uColor,vec3(1.),min(1.,flash)),min(.85,alpha));
#include <colorspace_fragment>
}`;

const CREATURE_CELLS = { dragon: [0, .5, .5, .5], wolf: [.5, .5, .5, .5], lion: [0, 0, .5, .5], serpent: [.5, 0, .5, .5] };
// Mouth center, upper lip, half width and chin in cell-local bottom-up UVs.
const CREATURE_MOUTHS = { dragon: [.755, .707, .16, .485], wolf: [.596, .676, .13, .49],
    lion: [.642, .672, .15, .465], serpent: [.49, .785, .15, .54] };
const MOTIF_COLORS = { dragon: { face: 0xffcf71, edge: 0x752218, light: 0xff5737, spark: 0xffc968 },
    wolf: { face: 0xd9f6ff, edge: 0x225784, light: 0x48c9ff, spark: 0xb4edff },
    lion: { face: 0xffe3a0, edge: 0x805010, light: 0xffc847, spark: 0xffe394 },
    serpent: { face: 0x9affd0, edge: 0x15583e, light: 0x47f6b0, spark: 0xc6ff78 },
    rainbow: { face: 0xffc5df, edge: 0x443173, light: 0x74f7df, spark: 0xffb3e8 } };
const floralMotif = motif => ['floral', 'botanical', 'floral-rose', 'floral-lotus'].includes(motif);
const fireMotif = motif => ['flame', 'inferno', 'dragon'].includes(motif);

function releaseObject(root, sharedTextures = new Set()) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    root.traverse(node => {
        if (node.geometry) geometries.add(node.geometry);
        for (const material of [].concat(node.material || [])) {
            materials.add(material);
            for (const value of Object.values(material)) if (value?.isTexture && !sharedTextures.has(value)) textures.add(value);
        }
    });
    geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); textures.forEach(item => item.dispose());
    root.clear();
}

// The fallback is intentionally labelled: it never claims CSS text is a 3D render.
export function showImpactFallback(host, multiplier, reason = '3D unavailable', opacity = 1) {
    host.replaceChildren(); host.dataset.renderer = 'fallback'; host.hidden = false;
    host.style.opacity = String(opacity);
    const value = document.createElement('strong'), status = document.createElement('small');
    value.className = 'pk-impact-fallback-value'; value.textContent = multiplier === 'glove' ? 'ELDIVEN' : 'X' + multiplier;
    status.textContent = reason; status.className = 'pk-impact-fallback-status';
    host.append(value, status);
}

export async function createPKImpact(host, options = {}) {
    if (!(host instanceof HTMLElement)) throw new TypeError('PK impact host required');
    let config = normalizeImpactSettings(options.settings), disposed = false, failed = false, active = null;
    let renderer, frame = 0, envTimer = 0, lastFrame = -Infinity, environment = null, environmentReady = false;
    let root = new THREE.Group(), flames = null, particles = null, crown = null, glyph = null, aura = null, gloves = [], breath = null;
    let creatureMotion = null, character = null;
    let glyphWidth = 5, glyphHeight = 2.8, frames = 0, particleData = [];
    const textures = new Map(), sharedTextures = new Set(), artwork = [];
    const seen = new Set(), clock = options.now || (() => performance.now());
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, .1, 80);
    camera.position.set(0, 0, 14); scene.add(root);
    const keyLight = new THREE.DirectionalLight(0xfff2d5, 5.5); keyLight.position.set(-4, 6, 7);
    const rimLight = new THREE.DirectionalLight(0xffffff, 7); rimLight.position.set(5, 2, -1);
    const fillLight = new THREE.DirectionalLight(0xff9b39, 3); fillLight.position.set(-5, -2, 4);
    scene.add(keyLight, rimLight, fillLight, new THREE.HemisphereLight(0xffffff, 0x343039, 2.2));
    const fontController = new AbortController();
    const fontDeadline = setTimeout(() => fontController.abort(), 8000);
    let font;
    try {
        const response = await fetch(new URL('./font.json', import.meta.url), { signal: fontController.signal, cache: 'force-cache' });
        if (!response.ok) throw new Error('PK font unavailable (' + response.status + ')');
        font = new FontLoader().parse(await response.json());
    } finally { clearTimeout(fontDeadline); }

    function quality() {
        const low = config.quality === 'low' || config.quality === 'auto' && (innerWidth < 600 || (navigator.hardwareConcurrency || 4) <= 4);
        return { low, dpr: Math.min(devicePixelRatio || 1, low ? 1 : 1.5), count: low ? 42 : 100 };
    }
    function fit() {
        if (!renderer || disposed || failed) return;
        const rect = host.getBoundingClientRect(), width = Math.max(1, Math.round(rect.width)), height = Math.max(1, Math.round(rect.height));
        renderer.setPixelRatio(quality().dpr); renderer.setSize(width, height, false);
        camera.aspect = width / height;
        const visibleWidth = Math.max(glyphWidth, flames ? glyphWidth * 1.65 : 0);
        const visibleHeight = Math.max(glyphHeight / .46, visibleWidth / (camera.aspect * .78), 10.5,
            10.5 / (camera.aspect * .91)) * Math.max(1, config.impactScale / 100);
        camera.position.z = visibleHeight / (2 * Math.tan(THREE.MathUtils.degToRad(16)));
        camera.far = Math.max(80, camera.position.z + 40);
        camera.updateProjectionMatrix();
        host.dataset.dpr = String(renderer.getPixelRatio());
    }
    function fail(error) {
        if (disposed || failed) return;
        failed = true; cancelAnimationFrame(frame); frame = 0; clearTimeout(envTimer);
        releaseObject(root, sharedTextures); environment?.dispose(); environment = null;
        renderer?.dispose();
        showImpactFallback(host, active?.kind === 'glove' ? 'glove' : active?.multiplier || 3, '3D unavailable', config.opacity / 100);
        host.dataset.error = error?.message || 'WebGL context lost'; options.onError?.(error);
        if (!active) host.hidden = true;
    }
    function makeEnvironment() {
        if (disposed || failed || environmentReady) return;
        const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
        try {
            environment = pmrem.fromScene(room, .025, .1, 60);
            scene.environment = environment.texture; scene.environmentIntensity = 1.65; environmentReady = true;
        } catch (error) { host.dataset.environment = 'direct-light'; options.onError?.(error); }
        finally { room.dispose(); pmrem.dispose(); }
    }
    function makePetal() {
        const shape = new THREE.Shape(); shape.moveTo(0, -.12);
        shape.bezierCurveTo(-.20, .02, -.16, .28, 0, .22); shape.bezierCurveTo(.16, .28, .21, .02, 0, -.12);
        return new THREE.ExtrudeGeometry(shape, { depth: .018, bevelEnabled: true, bevelSize: .015, bevelThickness: .018, bevelSegments: 2, steps: 1, curveSegments: 5 });
    }
    function textureFor(file, label) {
        if (textures.has(file)) return textures.get(file);
        const entry = { ready: false, failed: false, texture: null, timer: 0 };
        const unavailable = error => {
            clearTimeout(entry.timer); entry.failed = true;
            if (!disposed) { host.dataset[label] = 'unavailable'; options.onError?.(error); }
        };
        entry.texture = new THREE.TextureLoader().load(new URL('./assets/' + file, import.meta.url).href, texture => {
            clearTimeout(entry.timer);
            if (disposed || failed || entry.failed) { texture.dispose(); return; }
            entry.ready = true; host.dataset[label] = 'ready';
            if (active && motion.matches) { cancelAnimationFrame(frame); lastFrame = -Infinity; draw(clock()); }
        }, undefined, unavailable);
        entry.timer = setTimeout(() => unavailable(new Error('PK artwork load timed out: ' + file)), 8000);
        entry.texture.colorSpace = THREE.SRGBColorSpace;
        // Image rows are top-to-bottom; Three's default flipY makes the top cells v=.5..1.
        entry.texture.flipY = true; entry.texture.minFilter = THREE.LinearFilter;
        entry.texture.generateMipmaps = false;
        textures.set(file, entry); sharedTextures.add(entry.texture); return entry;
    }
    function preload() {
        if (Object.hasOwn(CREATURE_CELLS,config.motif)) textureFor('pk-expressions-v2.png', 'expressionAsset');
        if (['butterfly','turtle','rabbit'].includes(config.motif)) textureFor('pk-companions-v1.png', 'companionAsset');
        if (config.notification !== 'multiplier') textureFor('pk-gloves-atlas.png', 'gloveAsset');
    }
    function artMesh(file, label, rect, width, height, colors, creature = false) {
        const asset = textureFor(file, label);
        const segments = creature ? quality().low ? 72 : 112 : 16;
        const geometry = new THREE.PlaneGeometry(width, height, segments, creature ? segments : 12), positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i) / width, y = positions.getY(i) / height;
            positions.setZ(i, -.22 * (x * x + y * y));
        }
        geometry.computeVertexNormals();
        const material = new THREE.ShaderMaterial({ vertexShader: creature ? creatureVertexShader : vertexShader, fragmentShader: artworkShader, transparent: true, toneMapped: false,
            depthWrite: false, side: THREE.DoubleSide, uniforms: { uMap: { value: asset.texture },
                uRect: { value: new THREE.Vector4(...rect) }, uTime: { value: 0 }, uReady: { value: asset.ready ? 1 : 0 },
                uAlpha: { value: 1 }, uBlink: { value: 0 }, uEyeA: { value: new THREE.Vector2(-1,-1) }, uEyeB: { value: new THREE.Vector2(-1,-1) },
                ...(creature ? { uJaw: { value: 1 }, uHead: { value: 0 }, uMane: { value: 0 }, uBreath: { value: 0 },
                    uMouth: { value: new THREE.Vector4(...CREATURE_MOUTHS[config.motif]) } } : {}),
                uTint: { value: new THREE.Color(colors.light) } } });
        const mesh = new THREE.Mesh(geometry, material); artwork.push({ mesh, asset }); return mesh;
    }
    function build(multiplier, kind = active?.kind || 'multiplier') {
        releaseObject(root, sharedTextures); flames = particles = crown = glyph = aura = breath = null; creatureMotion = null; character = null; gloves = []; particleData = []; artwork.length = 0;
        const botanical = floralMotif(config.motif), gem = ['rose', 'crystal', 'platinum', 'rainbow'].includes(config.motif);
        const colors = { ...(MOTIF_COLORS[config.motif] || THEMES[botanical ? 'botanical' : ['crystal', 'platinum'].includes(config.motif) ? 'platinum' : config.motif === 'rose' ? 'rose' : config.theme]) };
        if(config.motif==='floral-rose')Object.assign(colors,{face:0xffd3ed,edge:0xa34f7d,light:0xff98c8,spark:0xf55b9f});
        if(config.motif==='floral-lotus')Object.assign(colors,{face:0xe5dfff,edge:0x7376ad,light:0xc3b8ff,spark:0x9bd9cb});
        fillLight.color.setHex(colors.light); rimLight.color.setHex(config.theme === 'inferno' ? 0xffd78b : 0xffffff);
        if(kind==='glove') { aura = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 10.4), new THREE.ShaderMaterial({ vertexShader, fragmentShader: auraShader,
            transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 },
                uContact: { value: 0 }, uColor: { value: new THREE.Color(colors.light) },
                uStyle: { value: config.motif === 'serpent' ? 2 : config.motif === 'lion' ? 11 : config.motif === 'wolf' ? 4 : 7 } } }));
        aura.position.z = -1.3; root.add(aura); }
        if (kind === 'glove') {
            glyphWidth = 10; glyphHeight = 3.7;
            for (let i = 0; i < 2; i++) {
                const glove = artMesh('pk-gloves-atlas.png', 'gloveAsset', [i * .5, 0, .5, 1], 5.4, 3.6, colors);
                glove.name = i ? 'right-boxing-glove' : 'left-boxing-glove'; glove.position.z = .8;
                root.add(glove); gloves.push(glove);
            }
        } else {
        const front = new THREE.MeshPhysicalMaterial({ color: colors.face, metalness: config.motif === 'rainbow' ? .9 : gem ? .48 : .93, roughness: gem ? .13 : .19,
            clearcoat: 1, clearcoatRoughness: .09, envMapIntensity: 2, flatShading: gem,
            iridescence: config.motif === 'rainbow' ? 1 : .15, iridescenceIOR: 1.6 });
        if (config.motif === 'rainbow') {
            front.onBeforeCompile = shader => {
                shader.uniforms.uPrismTime = { value: 0 };
                shader.vertexShader = 'varying vec3 vMetalPosition;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMetalPosition=position;');
                shader.fragmentShader = 'varying vec3 vMetalPosition;uniform float uPrismTime;\n' + shader.fragmentShader.replace('#include <color_fragment>',
                    '#include <color_fragment>\ndiffuseColor.rgb*=.55+.45*cos(vMetalPosition.x*1.6+uPrismTime*.7+vec3(0.,2.094,4.188));');
                front.userData.prism = shader;
            };
            front.customProgramCacheKey = () => 'pk-prismatic-metal';
        }
        const edge = new THREE.MeshPhysicalMaterial({ color: colors.edge, metalness: .96, roughness: .22, clearcoat: 1 });
        const geometry = new TextGeometry('X' + multiplier, { font, size: 2.8, depth: .52, bevelEnabled: true,
            bevelSize: .105, bevelThickness: .12, bevelSegments: quality().low ? 3 : 5, curveSegments: gem ? 5 : 12, steps: 1 });
        geometry.computeBoundingBox(); const box = geometry.boundingBox;
        geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -.26);
        glyphWidth = box.max.x - box.min.x; glyphHeight = box.max.y - box.min.y;
        glyph = new THREE.Group(); glyph.name = 'extruded-X' + multiplier;
        const back = new THREE.Mesh(geometry, edge); back.position.z = -.20; back.scale.set(1.025, 1.045, 1.06);
        const face = new THREE.Mesh(geometry, [front, edge]); glyph.add(back, face); root.add(glyph);
        }
        if ((gem || config.theme === 'platinum') && !botanical && kind !== 'glove') {
            const diamond = new THREE.OctahedronGeometry(.12, 0);
            const jewel = new THREE.MeshPhysicalMaterial({ color: gem ? 0xffb1df : 0xf2ffff, metalness: .4, roughness: .04,
                clearcoat: 1, iridescence: .6, envMapIntensity: 3.5, flatShading: true });
            for (let i = 0; i < 6; i++) {
                const cut = new THREE.Mesh(diamond, jewel), a = i / 6 * Math.PI * 2;
                cut.position.set((i%2 ? -1 : 1)*(glyphWidth*.43), (Math.floor(i/2)-1)*1.1, .3);
                cut.rotation.set(a, a * .7, a * 1.8); cut.scale.setScalar(i % 3 === 0 ? 1.8 : .8); root.add(cut);
            }
        }
        if (config.motif === 'platinum') {
            const band = new THREE.Mesh(new THREE.TorusGeometry(3.3, .045, 8, 96),
                new THREE.MeshPhysicalMaterial({ color: 0xd3efff, metalness: 1, roughness: .12, clearcoat: 1 }));
            band.rotation.set(.42, -.16, .2); band.scale.y = .65; band.position.z = -.3; root.add(band);
        }
        if (fireMotif(config.motif)) {
            const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader: flameShader,
                uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide });
            flames = new THREE.Mesh(new THREE.PlaneGeometry(glyphWidth * 1.65, 5.8), material);
            flames.position.set(0, .55, -.8); flames.renderOrder = -1; root.add(flames);
        }
        if (CHARACTER_MOTIFS.includes(config.motif)) {
            character=createPKCharacterRig(config.motif,{artMesh,colors,low:quality().low});root.add(character.group);
            if(glyph){glyph.position.y=-2.1;glyph.scale.setScalar(.85);}
        }
        if(botanical && glyph){
            glyph.scale.setScalar(1.12);
            const petal=makePetal(),petalMat=new THREE.MeshPhysicalMaterial({color:colors.spark,roughness:.28,clearcoat:.7,side:THREE.DoubleSide}),gold=new THREE.MeshPhysicalMaterial({color:0xffe3a3,metalness:.75,roughness:.2});
            for(const [x,y] of [[-glyphWidth*.45,1.0],[glyphWidth*.43,-.95]]){
                const blossom=new THREE.Group();blossom.position.set(x,y,.6);
                const count=config.motif==='floral-lotus'?10:7;
                for(let i=0;i<count;i++){const p=new THREE.Mesh(petal,petalMat);p.rotation.z=i/count*Math.PI*2;p.scale.set(1.3,config.motif==='floral-rose'?1.6:2,1);blossom.add(p);}
                const core=new THREE.Mesh(new THREE.SphereGeometry(.13,12,8),gold);core.position.z=.08;blossom.add(core);glyph.add(blossom);
            }
        }
        const count = kind==='glove' ? 55 : botanical ? Math.min(38,quality().count) : fireMotif(config.motif) ? quality().count : 0;
        const particleGeo = botanical ? makePetal() : new THREE.SphereGeometry(.035, 4, 3);
        const particleMat = new THREE.MeshPhysicalMaterial({ color: colors.spark, metalness: botanical ? .15 : .7,
            roughness: botanical ? .37 : .12, clearcoat: 1, side: THREE.DoubleSide,
            emissive: colors.spark, emissiveIntensity: kind === 'glove' ? 4 : 1.6, flatShading: !botanical });
        particles = new THREE.InstancedMesh(particleGeo, particleMat, count); particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        if (config.motif === 'rainbow') for (let i = 0; i < count; i++) particles.setColorAt(i, new THREE.Color().setHSL(i / count, .9, .65));
        particles.frustumCulled = false; root.add(particles);
        for (let i = 0; i < count; i++) particleData.push({ seed: (i * .61803398875) % 1, angle: i * 2.39996, speed: .35 + (i % 9) * .09 });
        host.dataset.theme = config.theme; host.dataset.motif = config.motif; host.dataset.entrance = config.entrance;
        host.dataset.geometry = kind === 'glove' ? 'atlas-gloves' : 'TextGeometry';
        host.dataset.multiplier = kind === 'glove' ? '' : String(multiplier); host.dataset.kind = kind;
        host.dataset.creatureRepresentation = character ? 'layered-articulated-rig' : 'none';
        fit();
    }
    const dummy = new THREE.Object3D();
    function draw() {
        const at=clock();
        frame = 0;
        if (disposed || failed || !active) return;
        if (at >= active.expiresAt) { stop(); return; }
        if (options.preview && document.hidden) return;
        if (artwork.some(row => row.asset.failed)) {
            host.dataset.assetsReady = 'false';
            showImpactFallback(host, active.kind === 'glove' ? 'glove' : active.multiplier, 'Artwork unavailable', config.opacity / 100);
            return;
        }
        if (artwork.some(row => !row.asset.ready)) {
            host.hidden = true; host.dataset.assetsReady = 'false'; host.dataset.phase = 'loading'; frame = requestAnimationFrame(draw); return;
        }
        if (active.startedAt === null) { active.startedAt = at; active.duration = active.expiresAt - at; }
        host.dataset.assetsReady = 'true'; host.dataset.duration = String(Math.round(active.duration));
        const elapsed = at - active.startedAt;
        if (host.hidden) { host.hidden = false; fit(); }
        frame = requestAnimationFrame(draw);
        if (at - lastFrame < 1000 / 30 - .5) return;
        lastFrame = at;
        const motionDuration = active.hold ? Math.min(5000, active.duration) : active.duration;
        const motionElapsed = active.hold ? Math.min(elapsed, motionDuration * .7) : elapsed;
        const envelope = impactEnvelope(motion.matches ? Math.max(motionElapsed, Math.min(500, motionDuration / 2)) : motionElapsed, motionDuration, motion.matches);
        const t = motion.matches ? 0 : elapsed / 1000;
        host.style.opacity = String(envelope.opacity * config.opacity / 100);
        root.scale.setScalar(envelope.scale * config.impactScale / 100);
        if (glyph) glyph.rotation.set(motion.matches ? -.04 : Math.sin(t * 1.2) * .065, envelope.turn + (motion.matches ? -.12 : -.12 + Math.sin(t * .95) * .20), motion.matches ? 0 : Math.sin(t * .7) * .025);
        if (glyph) for (const material of [].concat(glyph.children[1].material)) if (material.userData.prism) material.userData.prism.uniforms.uPrismTime.value = t;
        const pose = entrancePose(motionElapsed, motionDuration, config.entrance, motion.matches);
        const boxing = glovePose(elapsed, active.duration, motion.matches);
        root.position.set(pose.x, pose.y + (motion.matches ? 0 : Math.sin(t * 1.7) * .035), pose.z);
        root.rotation.z = pose.roll;
        for (let i = 0; i < gloves.length; i++) {
            const sign = i ? 1 : -1, glove = gloves[i];
            glove.position.x = sign * boxing.separation;
            glove.rotation.set(0, sign * -.10, sign * boxing.rotation);
            glove.scale.set(1 + boxing.contact * .05, 1 - boxing.contact * .07, 1);
            if (!motion.matches) root.position.x += Math.sin(t * 90) * boxing.contact * .025;
        }
        if (gloves.length) { host.dataset.glovePhase = boxing.phase; host.dataset.gloveSeparation = boxing.separation.toFixed(3); }
        if(character){creatureMotion=character.update(elapsed,motion.matches);host.dataset.expression=creatureMotion.expression.toFixed(3);host.dataset.wingAngle=creatureMotion.wings.toFixed(3);host.dataset.blink=creatureMotion.blink.toFixed(3);}
        for (const { mesh, asset } of artwork) { mesh.material.uniforms.uTime.value = t; mesh.material.uniforms.uReady.value = asset.ready ? 1 : 0; }
        if (breath && crown) {
            creatureMotion = creaturePose(elapsed, motion.matches);
            const uniforms = crown.material.uniforms, mouth = CREATURE_MOUTHS[config.motif];
            uniforms.uJaw.value = creatureMotion.jaw; uniforms.uHead.value = creatureMotion.head;
            uniforms.uMane.value = motion.matches ? 0 : creatureMotion.mane; uniforms.uBreath.value = creatureMotion.breath;
            breath.material.uniforms.uTime.value = t;
            breath.material.uniforms.uRoar.value = creatureMotion.roar * (['dragon', 'wolf', 'lion'].includes(config.motif) ? .78 : .34);
            breath.position.x = (mouth[0] - .5) * 8.8 + (config.motif === 'dragon' ? .65 : .15);
            breath.position.y = .8 + (mouth[1] - .5) * 8.8 - 1.45;
            host.dataset.jawOpen = creatureMotion.jaw.toFixed(3); host.dataset.roar = creatureMotion.roar.toFixed(3);
        }
        if (aura) { aura.material.uniforms.uTime.value = t; aura.material.uniforms.uContact.value = gloves.length ? boxing.contact : 0; }
        if (flames) { flames.material.uniforms.uTime.value = t; flames.material.uniforms.uOpacity.value = .96; }
        if (crown && !breath) { crown.rotation.y = motion.matches ? 0 : Math.sin(t * .7) * .025; crown.rotation.z = motion.matches ? 0 : Math.sin(t * .65) * .018; }
        particleData.forEach((p, i) => {
            const botanical = floralMotif(config.motif), progress = (p.seed + t * p.speed * .22) % 1;
            if (gloves.length) { const r = boxing.sparks * (3.5 + p.seed * 3);
                dummy.position.set(Math.cos(p.angle) * r, Math.sin(p.angle) * r - boxing.sparks ** 2 * 2, Math.sin(p.angle * 2) * r * .22 + .9); }
            else if (fireMotif(config.motif)) dummy.position.set(Math.sin(p.angle) * (1.3 + p.seed * 2.9) + Math.sin(t * .7 + i) * .2, -1.7 + progress * 5.5, Math.cos(p.angle) * 1.4);
            else if (botanical) dummy.position.set(Math.sin(p.angle) * (2.4 + p.seed * 1.2) + Math.sin(t + i) * .25, 3.8 - progress * 7.4, Math.cos(p.angle) * .8 + .5);
            else { const a = p.angle + t * .13; dummy.position.set(Math.cos(a) * (2.8 + p.seed), Math.sin(a) * (1.8 + p.seed * .6), Math.sin(a * 2) * 1.1); }
            dummy.rotation.set(t * p.speed + i, t * .6 + i * 2, p.angle + t * p.speed);
            dummy.scale.setScalar((botanical ? .2 : .5) + Math.sin(progress * Math.PI) * (botanical ? .5 : 1));
            if (gloves.length) dummy.scale.set(.7, 2.5, .7).multiplyScalar(boxing.sparks > 0 ? Math.sin(boxing.sparks * Math.PI) : 0);
            dummy.updateMatrix(); particles.setMatrixAt(i, dummy.matrix);
        });
        particles.instanceMatrix.needsUpdate = true;
        renderer.render(scene, camera); frames++;
        host.dataset.frames = String(frames); host.dataset.phase = motionElapsed < motionDuration * .15 ? 'arrival' : motionElapsed > motionDuration * .81 ? 'exit' : 'sustain';
        if (!environmentReady && !envTimer) envTimer = setTimeout(() => { envTimer = 0; makeEnvironment(); }, 20);
        if (motion.matches) { cancelAnimationFrame(frame); frame = 0; }
    }
    let endTimer = 0;
    function stop() {
        active = null; cancelAnimationFrame(frame); frame = 0; clearTimeout(endTimer); host.hidden = true; host.dataset.phase = 'idle';
        renderer?.clear();
    }
    function trigger(note = {}) {
        const kind = note.kind === 'glove' ? 'glove' : 'multiplier';
        if (disposed || kind === 'multiplier' && (![2, 3].includes(note.multiplier) || config.notification === 'glove') || kind === 'glove' && config.notification === 'multiplier') return false;
        const id = String(note.id || ''); if (!id || seen.has(id)) return false;
        seen.add(id); if (seen.size > 512) seen.delete(seen.values().next().value);
        const duration = number(note.duration, 6000, 1, 60000);
        active = { id, kind, multiplier: note.multiplier, startedAt: null, expiresAt: clock() + duration, duration, hold: note.hold === true };
        clearTimeout(endTimer); cancelAnimationFrame(frame); lastFrame = -Infinity;
        host.hidden = true; host.setAttribute('aria-label', kind === 'glove' ? 'Eldiven' : 'X' + note.multiplier); host.dataset.eventId = id;
        host.dataset.duration = String(duration); host.dataset.assetsReady = 'false';
        if (failed) showImpactFallback(host, kind === 'glove' ? 'glove' : note.multiplier, '3D unavailable', config.opacity / 100);
        else { host.replaceChildren(renderer.domElement); host.dataset.renderer = 'three'; build(note.multiplier, kind); draw(clock()); }
        endTimer = setTimeout(stop, Math.max(0, active.expiresAt - clock())); return true;
    }
    function update(raw = {}) {
        if (disposed) return;
        const next = normalizeImpactSettings({ ...config, ...raw }), rebuild = ['theme', 'quality', 'motif', 'entrance'].some(key => next[key] !== config[key]);
        config = next; host.dataset.entrance = config.entrance; if (failed) return; preload();
        if (active && (active.kind === 'glove' ? config.notification === 'multiplier' : config.notification === 'glove')) stop();
        if (rebuild && active) build(active.multiplier, active.kind); else fit();
        if (active && motion.matches) { cancelAnimationFrame(frame); lastFrame = -Infinity; draw(clock()); }
    }
    function resume() {
        if (options.preview && document.hidden) { cancelAnimationFrame(frame); frame = 0; return; }
        if (active && !frame && !failed) { lastFrame = -Infinity; draw(clock()); }
    }
    function dispose() {
        if (disposed) return; disposed = true;
        cancelAnimationFrame(frame); clearTimeout(envTimer); clearTimeout(endTimer); observer.disconnect();
        motion.removeEventListener('change', resume); document.removeEventListener('visibilitychange', resume);
        removeEventListener('pagehide', dispose); renderer?.domElement.removeEventListener('webglcontextlost', contextLost);
        releaseObject(root, sharedTextures); textures.forEach(entry => { clearTimeout(entry.timer); entry.texture.dispose(); }); textures.clear(); sharedTextures.clear();
        scene.environment = null; environment?.dispose(); renderer?.dispose(); renderer?.forceContextLoss();
        host.replaceChildren(); host.hidden = true; host.dataset.renderer = 'disposed'; active = null; seen.clear();
    }
    function contextLost(event) { event.preventDefault(); fail(new Error('WebGL context lost')); }
    try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !quality().low, powerPreference: 'low-power' });
        renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
        renderer.domElement.setAttribute('aria-hidden', 'true'); renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
        renderer.domElement.addEventListener('webglcontextlost', contextLost);
        host.replaceChildren(renderer.domElement); host.dataset.renderer = 'three'; host.hidden = true; fit();
    } catch (error) { fail(error); }
    const observer = new ResizeObserver(fit); observer.observe(host);
    if (!failed) { preload(); makeEnvironment(); }
    motion.addEventListener('change', resume); document.addEventListener('visibilitychange', resume);
    addEventListener('pagehide', dispose, { once: true });
    return { update, trigger, fit, resize: fit, stop, dispose,
        getState: () => ({ disposed, failed, active: active?.id || null, frames, theme: config.theme, environment: environmentReady,
            geometry: gloves.length ? 'atlas-gloves' : glyph?.name || null, motif: config.motif, entrance: config.entrance,
            notification: config.notification, kind: active?.kind || null, artworkReady: artwork.every(row => row.asset.ready),
            creatureRepresentation: character ? 'layered-articulated-rig' : null, creatureMotion: creatureMotion ? { ...creatureMotion } : null, character: character?.getState() || null,
            assetsReady: artwork.every(row => row.asset.ready), duration: active?.duration || 0,
            dpr: renderer?.getPixelRatio() || 0, particles: particleData.length }) };
}

export default createPKImpact;
