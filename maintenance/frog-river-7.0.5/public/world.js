import * as THREE from 'three';

const PI = Math.PI, TAU = PI * 2, STEP = 7.2;
const sphere = new THREE.SphereGeometry(1, 16, 12);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
const cone = new THREE.ConeGeometry(1, 1, 8);
const box = new THREE.BoxGeometry(1, 1, 1);

const colors = {
  grass: 0x72b84e,
  light: 0x9ed36b,
  dark: 0x347c4e,
  leaf: 0x3d8844,
  pink: 0xf29dc0,
  pale: 0xffc4d6,
  rose: 0xd876a3,
  bark: 0x825938,
  rock: 0x9ba998,
  sand: 0xddd79e,
  white: 0xfff6ea,
  black: 0x223032,
  gold: 0xf0c961,
  bear: 0xdca778,
  teal: 0x6ab2a2,
  steel: 0x788a96
};

const materials = Object.fromEntries(
  Object.entries(colors).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.82 })])
);

function part(parent, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rotation) {
  const m = new THREE.Mesh(geo, typeof mat === 'string' ? materials[mat] : mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  if (rotation) m.rotation.set(...rotation);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function blob(parent, mat, x, y, z, sx, sy = sx, sz = sx) {
  return part(parent, sphere, mat, x, y, z, sx, sy, sz);
}

function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// --- DENSE BOTANICAL TREES & RIVERBANK VEGETATION ---
function sakuraTree(g, x, z, r) {
  const h = 3.5 + r() * 1.8;
  part(g, cylinder, 'bark', x, h / 2 + 0.3, z, 0.22, h, 0.22);
  for (let j = 0; j < 7; j++) {
    const a = j * 2.1;
    blob(g, j % 2 ? 'pale' : 'pink', x + Math.cos(a) * 1.1, h + Math.sin(j) * 0.35, z + Math.sin(a) * 1.05, 1.45, 1.05, 1.35);
  }
  blob(g, 'white', x, h + 1.1, z, 1.3, 0.9, 1.25);
}

function willowTree(g, x, z, r) {
  const h = 4.2 + r() * 2.0;
  part(g, cylinder, 'bark', x, h / 2 + 0.4, z, 0.26, h, 0.26);
  blob(g, 'dark', x, h + 0.6, z, 1.8, 1.2, 1.8);
  for (let j = 0; j < 8; j++) {
    const a = (j * TAU) / 8;
    const wx = x + Math.cos(a) * 1.4, wz = z + Math.sin(a) * 1.4;
    part(g, cylinder, 'light', wx, h - 0.5, wz, 0.12, 2.6, 0.12);
    blob(g, 'grass', wx, h - 1.8, wz, 0.35, 0.45, 0.35);
  }
}

function pineTree(g, x, z, r) {
  const h = 4.5 + r() * 2.2;
  part(g, cylinder, 'bark', x, h / 2, z, 0.2, h, 0.2);
  for (let j = 0; j < 4; j++) {
    const cy = 1.6 + j * 1.2;
    const rad = 1.6 - j * 0.32;
    part(g, cone, 'dark', x, cy, z, rad, 1.4, rad);
  }
}

function riverCattails(g, x, z) {
  for (let i = 0; i < 4; i++) {
    const cx = x + (i - 1.5) * 0.16, cz = z + (i % 2) * 0.18;
    part(g, cylinder, 'grass', cx, 0.75, cz, 0.025, 1.5, 0.025);
    part(g, cylinder, 'bark', cx, 1.35, cz, 0.055, 0.45, 0.055);
  }
}

function flowerBush(g, x, z, r) {
  blob(g, 'grass', x, 0.35, z, 0.85, 0.55, 0.85);
  for (let j = 0; j < 6; j++) {
    const a = (j * TAU) / 6;
    blob(g, r() > 0.3 ? 'pink' : 'white', x + Math.cos(a) * 0.38, 0.55, z + Math.sin(a) * 0.38, 0.16, 0.14, 0.16);
    blob(g, 'gold', x + Math.cos(a) * 0.38, 0.6, z + Math.sin(a) * 0.38, 0.07, 0.07, 0.07);
  }
}

function bear(g, x, z, r) {
  const y = 0.65;
  blob(g, 'bear', x, y + 0.6, z, 0.46, 0.65, 0.36);
  blob(g, 'bear', x, y + 1.38, z, 0.5, 0.46, 0.41);
  for (const s of [-1, 1]) {
    blob(g, 'bear', x + s * 0.36, y + 1.72, z, 0.19, 0.2, 0.14);
    blob(g, 'pink', x + s * 0.36, y + 1.74, z + 0.11, 0.1, 0.1, 0.04);
    blob(g, 'bear', x + s * 0.48, y + 0.65, z + 0.05, 0.18, 0.33, 0.2);
    blob(g, 'bear', x + s * 0.25, y + 0.1, z + 0.2, 0.23, 0.19, 0.29);
    blob(g, 'black', x + s * 0.17, y + 1.43, z + 0.385, 0.042, 0.055, 0.03);
  }
  blob(g, 'white', x, y + 1.25, z + 0.38, 0.21, 0.14, 0.1);
  blob(g, 'black', x, y + 1.31, z + 0.47, 0.07, 0.045, 0.045);
  blob(g, 'white', x, y + 0.6, z + 0.33, 0.28, 0.38, 0.05);
}

const activeBankFrogs = [];
function spectatorFrog(g, x, y, z, rotY = 0, color = 'grass') {
  const f = new THREE.Group();
  f.position.set(x, y, z);
  f.rotation.y = rotY;
  blob(f, color, 0, 0.2, 0, 0.28, 0.22, 0.25);
  blob(f, 'gold', 0, 0.14, 0.14, 0.18, 0.14, 0.1);
  blob(f, color, -0.14, 0.36, 0.05, 0.1, 0.12, 0.1);
  blob(f, color, 0.14, 0.36, 0.05, 0.1, 0.12, 0.1);
  blob(f, 'white', -0.14, 0.36, 0.11, 0.07, 0.08, 0.05);
  blob(f, 'white', 0.14, 0.36, 0.11, 0.07, 0.08, 0.05);
  blob(f, 'black', -0.14, 0.36, 0.14, 0.04, 0.04, 0.03);
  blob(f, 'black', 0.14, 0.36, 0.14, 0.04, 0.04, 0.03);
  blob(f, color, -0.22, 0.1, -0.05, 0.12, 0.1, 0.16);
  blob(f, color, 0.22, 0.1, -0.05, 0.12, 0.1, 0.16);
  g.add(f);
  activeBankFrogs.push({ group: f, baseY: y, phase: Math.random() * TAU, freq: 2.8 + Math.random() * 2 });
  return f;
}

// Modular rich riverbank tile (lush trees, reeds, rocks, spectator frogs)
function tile(seed) {
  const r = random(seed), g = new THREE.Group();

  // LEFT BANK (Sandy shore, weeping willows, cherry blossoms, water reeds)
  blob(g, 'sand', -13.5, -0.4, 0, 6.5, 1.2, 12.5);
  blob(g, 'grass', -15.5, -0.05, 0, 7.0, 1.25, 12.5);

  for (let i = 0; i < 7; i++) {
    const x = -(9.2 + r() * 9.5), z = (r() - 0.5) * 23;
    blob(g, 'grass', x, 0.25, z, 1.1 + r() * 1.2, 0.7, 1.2 + r() * 1.2);
    if (i % 3 === 0) sakuraTree(g, x, z, r);
    else if (i % 3 === 1) willowTree(g, x, z, r);
    else pineTree(g, x, z, r);
  }

  for (let i = 0; i < 8; i++) {
    const rx = -(7.8 + r() * 2.2), rz = (r() - 0.5) * 22;
    blob(g, 'rock', rx, 0.16, rz, 0.55 + r() * 0.4, 0.42, 0.7);
    if (i % 2 === 0) riverCattails(g, rx + 0.6, rz);
    if (i === 1) spectatorFrog(g, rx, 0.46, rz, PI / 2 + (r() - 0.5) * 0.4, 'teal');
  }

  for (let i = 0; i < 5; i++) {
    flowerBush(g, -(8.8 + r() * 6), (r() - 0.5) * 22, r);
  }
  if (seed % 2 === 0) bear(g, -11.2, -3 + r() * 6, r);

  // RIGHT BANK (Rugged rocky embankment, dense oaks, pines, wild cattails)
  blob(g, 'rock', 14.0, -0.35, 0, 6.5, 1.3, 12.5);
  blob(g, 'grass', 15.8, -0.02, 0, 7.2, 1.25, 12.5);

  for (let i = 0; i < 8; i++) {
    const x = 9.4 + r() * 9.8, z = (r() - 0.5) * 23;
    blob(g, 'grass', x, 0.25, z, 1.1 + r() * 1.3, 0.7, 1.2 + r() * 1.2);
    if (i % 3 === 0) pineTree(g, x, z, r);
    else if (i % 3 === 1) willowTree(g, x, z, r);
    else sakuraTree(g, x, z, r);
  }

  for (let i = 0; i < 9; i++) {
    const rx = 7.9 + r() * 2.4, rz = (r() - 0.5) * 22;
    blob(g, 'rock', rx, 0.18, rz, 0.58 + r() * 0.45, 0.45, 0.75);
    if (i % 2 !== 0) riverCattails(g, rx - 0.6, rz);
    if (i === 2) spectatorFrog(g, rx, 0.48, rz, -PI / 2 + (r() - 0.5) * 0.4, 'grass');
  }

  for (let i = 0; i < 6; i++) {
    flowerBush(g, 9.0 + r() * 6.5, (r() - 0.5) * 22, r);
  }
  bear(g, 11.5, -3 + r() * 6, r);
  if (seed % 2 !== 0) bear(g, 13.2, 4, r);

  return g;
}

// --- BOTANICAL NATURAL WATER LILY PAD (Nymphaea) ---
function naturalLilyPad() {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  const numPoints = 52;
  const notchAngle = 0.38; // Natural V-notch
  for (let i = 0; i <= numPoints; i++) {
    const a = notchAngle / 2 + ((TAU - notchAngle) * i) / numPoints;
    const rx = 1.58 * Math.sin(a);
    const rz = 1.45 * Math.cos(a);
    shape.lineTo(rx, rz);
  }
  shape.lineTo(0, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.045,
    bevelThickness: 0.035
  });
  geo.rotateX(-PI / 2);

  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x3d8844,
    roughness: 0.45,
    metalness: 0.04
  });
  const leaf = new THREE.Mesh(geo, leafMat);
  leaf.receiveShadow = true;
  g.add(leaf);

  // Branching natural leaf veins radiating from sinus center
  for (let i = 0; i < 9; i++) {
    const a = (notchAngle / 2) + 0.35 + i * 0.62;
    const curve = new THREE.LineCurve3(
      new THREE.Vector3(0, 0.09, 0),
      new THREE.Vector3(Math.sin(a) * 1.48, 0.09, -Math.cos(a) * 1.35)
    );
    const vein = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 2, 0.015, 3, false),
      new THREE.MeshStandardMaterial({ color: 0x6dbf60, roughness: 0.5 })
    );
    g.add(vein);
  }

  // Glistening hydrophobic water droplets sitting on the leaf
  const dropMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.08,
    transmission: 0.88,
    transparent: true,
    opacity: 0.92,
    clearcoat: 1
  });
  const drops = [[0.45, 0.11, 0.32, 0.065], [-0.55, 0.11, -0.38, 0.08], [0.68, 0.11, -0.45, 0.05], [-0.32, 0.11, 0.62, 0.07]];
  drops.forEach(([dx, dy, dz, dr]) => {
    blob(g, dropMat, dx, dy, dz, dr, dr * 0.65, dr);
  });

  return g;
}

// Real layered water lotus blossom (sepals, cupped pink petals, gold stamen core)
function botanicalLotus() {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = (i * TAU) / 4;
    const s = blob(g, 'leaf', Math.cos(a) * 0.28, 0.08, Math.sin(a) * 0.28, 0.16, 0.06, 0.24);
    s.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
  }
  for (let j = 0; j < 3; j++) {
    const layerPetals = 8;
    const layerRadius = 0.32 - j * 0.07;
    const layerHeight = 0.14 + j * 0.1;
    for (let i = 0; i < layerPetals; i++) {
      const a = (i * TAU) / layerPetals + j * 0.25;
      const p = blob(g, j === 2 ? 'pale' : 'pink', Math.cos(a) * layerRadius, layerHeight, Math.sin(a) * layerRadius, 0.14 - j * 0.02, 0.32 - j * 0.03, 0.22 - j * 0.02);
      p.rotation.set(Math.sin(a) * (0.6 - j * 0.18), 0, -Math.cos(a) * (0.6 - j * 0.18));
    }
  }
  blob(g, 'gold', 0, 0.26, 0, 0.18, 0.14, 0.18);
  return g;
}

export function padX(i) {
  return Math.sin(i * 1.12) * 3.25 + Math.sin(i * 0.37) * 1.35;
}

export function makeWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaedfd8);
  scene.fog = new THREE.Fog(0xaedfd8, 110, 290);

  const camera = new THREE.PerspectiveCamera(53, 1, 0.2, 420);
  let zoom = 1, playing = false, currentGoal = 1000;

  scene.add(new THREE.HemisphereLight(0xe9faff, 0x577447, 1.5));
  const sun = new THREE.DirectionalLight(0xffe8c5, 2.7);
  sun.position.set(-20, 32, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 26, bottom: -22, far: 90 });
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.025;
  scene.add(sun);

  // Modular riverbank terrain chunks (22 chunks covering full visible extent at high speed)
  const tiles = [];
  for (let i = 0; i < 22; i++) {
    const t = tile(i + 71);
    t.scale.x = 1.8;
    scene.add(t);
    tiles.push(t);
  }

  // STYLIZED MAJESTIC MOUNTAINS BEHIND PLAYER & HORIZON SKY (Framing starting valley, forward fairway open!)
  const horizonGroup = new THREE.Group();
  scene.add(horizonGroup);

  const mountainColors = [0x5f808e, 0x3d6b5e, 0x2d5747];
  for (let layer = 0; layer < 3; layer++) {
    // Majestic mountain peaks behind the player (+Z) framing the river start
    const layerZ = 85 + layer * 36;
    const mColor = mountainColors[layer];
    const mMat = new THREE.MeshStandardMaterial({ color: mColor, roughness: 0.9, flatShading: true });
    const count = 16 - layer * 2;
    for (let i = 0; i < count; i++) {
      const mx = (i - count / 2) * (28 - layer * 3) + (layer % 2 ? 10 : -10);
      const mHeight = 38 + ((i * 7 + layer * 13) % 25) - layer * 4;
      const mRad = 18 + ((i * 5) % 10);
      const mPeak = new THREE.Mesh(new THREE.ConeGeometry(mRad, mHeight, 5), mMat);
      mPeak.position.set(mx, mHeight / 2 - 2, layerZ);
      mPeak.rotation.y = (i * 1.7 + layer) % TAU;
      horizonGroup.add(mPeak);
    }
  }

  // Flanking mountain ridges far on the left and right in front (Leaving river corridor open!)
  for (const s of [-1, 1]) {
    for (let layer = 0; layer < 3; layer++) {
      const fMat = new THREE.MeshStandardMaterial({ color: mountainColors[layer], roughness: 0.9, flatShading: true });
      for (let j = 0; j < 5; j++) {
        const fPeak = new THREE.Mesh(new THREE.ConeGeometry(22, 42 - j * 4, 5), fMat);
        fPeak.position.set(s * (48 + j * 16), 18 - j * 2, -120 - layer * 40 - j * 15);
        horizonGroup.add(fPeak);
      }
    }
  }

  // Drifting Stylized Low-Poly Fluffy Clouds
  const mistClouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.88, flatShading: true });
  for (let i = 0; i < 8; i++) {
    const cg = new THREE.Group();
    for (let c = 0; c < 5; c++) {
      blob(cg, cloudMat, (c - 2) * 5.2, Math.sin(c) * 1.8, (c % 2) * 2.2, 5.5, 3.8, 4.5);
    }
    cg.position.set((i - 3.5) * 44, 42 + (i % 3) * 8, -165 + (i % 2) * 25);
    horizonGroup.add(cg);
    mistClouds.push(cg);
  }

  // FESTIVE START LINE ARCHWAY (Yarış Başlangıç Çizgisi & Tezahürat Eden Kurbağalar)
  const startArch = new THREE.Group();
  startArch.position.set(0, 0, 3.8);
  scene.add(startArch);
  for (const s of [-1, 1]) {
    part(startArch, cylinder, new THREE.MeshStandardMaterial({ color: 0x5a3e2a, roughness: 0.7 }), s * 5.4, 2.8, 0, 0.35, 5.6, 0.35);
    blob(startArch, 'gold', s * 5.4, 5.8, 0, 0.5);
    const dock = part(startArch, box, new THREE.MeshStandardMaterial({ color: 0x6e472e, roughness: 0.7 }), s * 5.4, 0.28, 0, 2.4, 0.4, 2.4);
    spectatorFrog(startArch, s * 5.4, 0.52, 0, s === 1 ? -PI / 2 : PI / 2, s === 1 ? 'gold' : 'teal');
  }
  part(startArch, box, new THREE.MeshStandardMaterial({ color: 0x245f51, roughness: 0.6 }), 0, 5.2, 0, 11.2, 0.9, 0.22);
  for (let i = 0; i < 11; i++) {
    part(startArch, box, i % 2 ? 'white' : 'black', -4.8 + i * 0.96, 5.2, 0.12, 0.92, 0.7, 0.05);
  }

  // HIGH-PERFORMANCE ANIMATED WATER SURFACE (Locked 120 FPS, No expensive scene reflection)
  const normalData = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const o = (y * 128 + x) * 4;
      normalData[o] = 128 + Math.round(40 * Math.sin((x * TAU) / 16) * Math.cos((y * TAU) / 32));
      normalData[o + 1] = 128 + Math.round(40 * Math.cos((x * TAU) / 32) * Math.sin((y * TAU) / 16));
      normalData[o + 2] = 245;
      normalData[o + 3] = 255;
    }
  }
  const normals = new THREE.DataTexture(normalData, 128, 128);
  normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
  normals.magFilter = normals.minFilter = THREE.LinearFilter;
  normals.repeat.set(16, 36);
  normals.needsUpdate = true;

  const waterGeo = new THREE.PlaneGeometry(360, 800, 32, 64);
  waterGeo.rotateX(-PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x08828c,
    roughness: 0.12,
    metalness: 0.22,
    transparent: true,
    opacity: 0.94,
    normalMap: normals
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = -0.12;
  water.position.z = -150;
  water.receiveShadow = true;
  scene.add(water);

  const riverBed = part(scene, box, new THREE.MeshStandardMaterial({ color: 0x5aafa0, roughness: 0.8 }), 0, -1, -150, 360, 0.2, 800);
  riverBed.castShadow = false;

  // Botanical Lily Pads on Fairway
  const pads = [];
  const baseLily = naturalLilyPad(), blossom = botanicalLotus();
  for (let i = 0; i < 48; i++) {
    const p = baseLily.clone();
    p.scale.set(2.1, 1, 2.1);
    if (i % 5 === 0) {
      const blo = blossom.clone();
      blo.position.set(0.65, 0.08, -0.48);
      blo.scale.setScalar(0.72);
      p.add(blo);
    }
    scene.add(p);
    pads.push(p);
  }

  const decor = [];
  for (let i = 0; i < 18; i++) {
    const p = baseLily.clone();
    p.scale.setScalar(0.58 + (i % 3) * 0.15);
    p.add(blossom.clone());
    scene.add(p);
    decor.push(p);
  }

  // --- FINISH LINE FROG ISLAND (ADA) & WELCOME ARRIVAL PLATFORM ---
  const finishArch = new THREE.Group();
  scene.add(finishArch);

  // 1. Organic Island Base centered 14m behind the arrival lotus (Never clips fairway pads!)
  const islandCenterZ = -14;
  part(finishArch, cylinder, new THREE.MeshStandardMaterial({ color: 0xdfd498, roughness: 0.85 }), 0, 0.28, islandCenterZ, 18.5, 0.75, 18.5);
  part(finishArch, cylinder, materials.grass, 0, 0.78, islandCenterZ, 16.2, 0.65, 16.2);
  blob(finishArch, 'dark', 0, 1.05, islandCenterZ, 13.5, 0.5, 13.5);

  // Arrival Landing Pier & Golden Victory Lotus (Right at Z = 0!)
  part(finishArch, box, new THREE.MeshStandardMaterial({ color: 0x6e472e, roughness: 0.65 }), 0, 0.45, 0, 6.2, 0.5, 5.8);
  part(finishArch, cylinder, new THREE.MeshStandardMaterial({ color: 0xe6ca70, roughness: 0.3, metalness: 0.5 }), 0, 0.72, 0, 3.8, 0.35, 3.8);
  const goldenLotus = botanicalLotus();
  goldenLotus.scale.setScalar(2.6);
  goldenLotus.position.set(0, 0.95, 0);
  goldenLotus.traverse(o => { if (o.isMesh) o.material = materials.gold; });
  finishArch.add(goldenLotus);

  // Golden archway with lanterns
  const archWoodMat = new THREE.MeshStandardMaterial({ color: 0x6e472e, roughness: 0.7 });
  for (const s of [-1, 1]) {
    part(finishArch, cylinder, archWoodMat, s * 4.6, 3.4, 0, 0.4, 6.8, 0.4);
    blob(finishArch, 'gold', s * 4.6, 6.9, 0, 0.6, 0.6, 0.6);
  }
  part(finishArch, box, archWoodMat, 0, 6.6, 0, 10.2, 0.55, 0.55);
  for (let i = 0; i < 9; i++) {
    const fx = -3.8 + i * 0.95;
    blob(finishArch, i % 2 ? 'pink' : 'gold', fx, 6.2, 0.35, 0.28, 0.25, 0.25);
  }

  // Shore rocks & vegetation on the island (Behind arrival platform, entrance is wide open!)
  for (let i = 0; i < 14; i++) {
    const a = (i * TAU) / 14;
    const rDist = 14.8 + Math.sin(i * 3) * 1.5;
    const rx = Math.cos(a) * rDist, rz = islandCenterZ + Math.sin(a) * rDist;
    if (rz < -3) {
      blob(finishArch, 'rock', rx, 0.55, rz, 1.2 + (i % 3) * 0.4, 0.8, 1.1 + (i % 2) * 0.4);
      if (i % 3 === 0) flowerBush(finishArch, rx * 0.85, rz * 0.85, random(80 + i));
    }
  }
  willowTree(finishArch, -10.5, islandCenterZ - 4.5, random(101));
  sakuraTree(finishArch, 10.5, islandCenterZ - 4.5, random(102));
  sakuraTree(finishArch, -8.5, islandCenterZ + 4.5, random(103));
  willowTree(finishArch, 8.5, islandCenterZ + 4.5, random(104));

  // --- CROWD OF SPECTATOR FROGS (Adanın Yanlarında Dans Eden Kurbağalar!) ---
  const spectatorFrogs = [];
  const frogColors = [0x72c954, 0x48bb78, 0x38b2ac, 0xecd045, 0xe2847a, 0x68d391, 0x4fd1c5, 0xf6ad55, 0x9ae6b4, 0x63b3ed, 0x81e6d9, 0xf687b3];

  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12 + 0.18;
    const sRad = 6.8 + (i % 2) * 1.6;
    const sx = Math.cos(a) * sRad, sz = islandCenterZ + Math.sin(a) * sRad;
    const specGroup = new THREE.Group();
    specGroup.position.set(sx, 0.95, sz);
    specGroup.rotation.y = Math.atan2(-sx, -(sz - islandCenterZ));
    finishArch.add(specGroup);

    const sMat = new THREE.MeshPhysicalMaterial({ color: frogColors[i % frogColors.length], roughness: 0.35, clearcoat: 0.4 });
    const sBelly = new THREE.MeshStandardMaterial({ color: 0xfbf8e6, roughness: 0.6 });
    // Body & head
    blob(specGroup, sMat, 0, 0.32, 0, 0.52, 0.38, 0.56);
    blob(specGroup, sBelly, 0, 0.26, 0.28, 0.38, 0.26, 0.18);
    blob(specGroup, sMat, 0, 0.52, 0.12, 0.52, 0.28, 0.48);
    // Big expressive eyes
    for (const side of [-1, 1]) {
      blob(specGroup, sMat, side * 0.26, 0.68, 0.12, 0.18, 0.19, 0.18);
      const sEye = blob(specGroup, 'gold', side * 0.26, 0.70, 0.22, 0.13, 0.14, 0.1);
      blob(sEye, 'black', 0, 0, 0.68, 0.55, 0.2, 0.3);
      blob(sEye, 'white', -0.15, 0.18, 0.85, 0.12, 0.12, 0.1);
    }
    // Arms for waving & cheering
    const sArms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.32, 0.32, 0.2);
      specGroup.add(arm);
      blob(arm, sMat, 0, 0.12, 0, 0.08, 0.22, 0.08);
      blob(arm, 'gold', 0, 0.24, 0, 0.1, 0.1, 0.1);
      sArms.push(arm);
    }
    // Legs
    for (const side of [-1, 1]) {
      blob(specGroup, sMat, side * 0.35, 0.18, -0.1, 0.28, 0.22, 0.36);
    }

    spectatorFrogs.push({ group: specGroup, arms: sArms, baseY: 0.95, phase: i * 0.65, colorIdx: i });
  }

  finishArch.position.set(padX(currentGoal), 0, -currentGoal * STEP);

  // --- PARTNER FROG ON GOLDEN PODIUM ---
  const partnerFrog = new THREE.Group();
  finishArch.add(partnerFrog);
  partnerFrog.position.set(0.95, 0.82, 0);

  const partnerSkin = new THREE.MeshPhysicalMaterial({ color: 0x72c954, roughness: 0.36, clearcoat: 0.45 });
  const partnerBelly = new THREE.MeshStandardMaterial({ color: 0xf7fae1, roughness: 0.6 });
  const partnerBody = blob(partnerFrog, partnerSkin, 0, 0.42, 0, 0.72, 0.46, 0.76);
  blob(partnerFrog, partnerBelly, 0, 0.34, 0.38, 0.52, 0.32, 0.24);
  blob(partnerFrog, partnerSkin, 0, 0.64, 0.16, 0.72, 0.36, 0.66);

  const partnerEyes = [];
  for (const s of [-1, 1]) {
    blob(partnerFrog, partnerSkin, s * 0.38, 0.88, 0.12, 0.26, 0.28, 0.26);
    const eye = blob(partnerFrog, 'gold', s * 0.38, 0.9, 0.26, 0.18, 0.19, 0.14);
    partnerEyes.push(eye);
    blob(eye, 'black', 0, 0, 0.68, 0.58, 0.22, 0.3);
    blob(eye, 'white', -0.15, 0.18, 0.85, 0.14, 0.14, 0.12);
  }

  const partnerSmile = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.35, 0.54, 0.55), new THREE.Vector3(0, 0.5, 0.62), new THREE.Vector3(0.35, 0.54, 0.55)]);
  part(partnerFrog, new THREE.TubeGeometry(partnerSmile, 16, 0.016, 5, false), 'dark', 0, 0, 0);

  const partnerArms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.42, 0.42, 0.35);
    partnerFrog.add(arm);
    blob(arm, partnerSkin, 0, -0.15, 0.06, 0.12, 0.24, 0.14);
    blob(arm, partnerSkin, 0, -0.32, 0.18, 0.1, 0.18, 0.12);
    for (let j = 0; j < 4; j++) {
      const fx = (j - 1.5) * 0.07;
      part(arm, cylinder, partnerSkin, fx, -0.4, 0.28, 0.025, 0.16, 0.025, [PI / 2, 0, fx * 1.5]);
      blob(arm, 'gold', fx * 1.2, -0.4, 0.37, 0.035, 0.03, 0.035);
    }
    partnerArms.push(arm);
  }

  const partnerLegs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.5, 0.28, -0.15);
    partnerFrog.add(leg);
    blob(leg, partnerSkin, s * 0.16, 0.06, -0.04, 0.42, 0.32, 0.52);
    const shin = blob(leg, partnerSkin, s * 0.22, -0.1, 0.26, 0.24, 0.18, 0.62);
    shin.rotation.set(-0.32, s * 0.16, 0);
    partnerLegs.push(leg);
  }

  // Partner Female Accessories (Pink satin bow ribbon, blush cheeks, fluttery eyelashes)
  const partnerFemaleAcc = new THREE.Group();
  partnerFrog.add(partnerFemaleAcc);
  blob(partnerFemaleAcc, 'pink', 0.22, 1.16, 0.08, 0.24, 0.16, 0.1);
  blob(partnerFemaleAcc, 'pink', -0.08, 1.16, 0.08, 0.24, 0.16, 0.1);
  blob(partnerFemaleAcc, 'rose', 0.07, 1.16, 0.11, 0.11, 0.12, 0.1);
  blob(partnerFemaleAcc, 'rose', -0.35, 0.52, 0.44, 0.12, 0.08, 0.08);
  blob(partnerFemaleAcc, 'rose', 0.35, 0.52, 0.44, 0.12, 0.08, 0.08);

  // Partner Male Accessories (Gentleman emerald/teal hat & scarf)
  const partnerMaleAcc = new THREE.Group();
  partnerFrog.add(partnerMaleAcc);
  part(partnerMaleAcc, cylinder, new THREE.MeshStandardMaterial({ color: 0x315d58, roughness: 0.6 }), 0, 1.26, 0.05, 0.44, 0.3, 0.44);
  part(partnerMaleAcc, cylinder, 'teal', 0, 1.12, 0.09, 0.66, 0.06, 0.54);
  blob(partnerMaleAcc, 'teal', -0.12, 0.48, 0.48, 0.18, 0.1, 0.06);
  blob(partnerMaleAcc, 'teal', 0.12, 0.48, 0.48, 0.18, 0.1, 0.06);
  partnerMaleAcc.visible = false;
  partnerFrog.scale.setScalar(1.05);

  function updatePartnerAppearance(playerIsFemale) {
    if (playerIsFemale) {
      partnerSkin.color.setHex(0x5da829);
      partnerBelly.color.setHex(0xf0f7ba);
      partnerFemaleAcc.visible = false;
      partnerMaleAcc.visible = true;
    } else {
      partnerSkin.color.setHex(0x72c954);
      partnerBelly.color.setHex(0xf7fae1);
      partnerFemaleAcc.visible = true;
      partnerMaleAcc.visible = false;
    }
  }

  // --- REALISTIC ANATOMICAL FROG CHARACTER ---
  const frog = new THREE.Group();
  scene.add(frog);
  let femaleMode = false;
  const skin = new THREE.MeshPhysicalMaterial({ color: 0x5da829, roughness: 0.36, clearcoat: 0.45, clearcoatRoughness: 0.2 });
  const belly = new THREE.MeshStandardMaterial({ color: 0xf0f7ba, roughness: 0.6 });

  // Sleek aerodynamic amphibian torso in natural crouch
  const body = blob(frog, skin, 0, 0.42, 0, 0.72, 0.46, 0.76);
  blob(frog, belly, 0, 0.34, 0.38, 0.52, 0.32, 0.24);

  // Triangular broad snout
  blob(frog, skin, 0, 0.64, 0.16, 0.72, 0.36, 0.66);
  // Nostrils
  blob(frog, 'dark', -0.09, 0.72, 0.58, 0.024, 0.016, 0.02);
  blob(frog, 'dark', 0.09, 0.72, 0.58, 0.024, 0.016, 0.02);

  // Bulging dome eyes on top of head with horizontal slit pupils
  const eyes = [];
  for (const s of [-1, 1]) {
    blob(frog, skin, s * 0.38, 0.88, 0.12, 0.26, 0.28, 0.26);
    const eye = blob(frog, 'gold', s * 0.38, 0.9, 0.26, 0.18, 0.19, 0.14);
    eyes.push(eye);
    // Horizontal slit pupil
    blob(eye, 'black', 0, 0, 0.68, 0.58, 0.22, 0.3);
    blob(eye, 'white', -0.15, 0.18, 0.85, 0.14, 0.14, 0.12);
    // Tympanic membrane eardrum circle
    blob(frog, 'dark', s * 0.55, 0.62, -0.05, 0.08, 0.11, 0.04);
  }

  // Wide mouth slit
  const smile = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.35, 0.54, 0.55), new THREE.Vector3(0, 0.5, 0.62), new THREE.Vector3(0.35, 0.54, 0.55)]);
  part(frog, new THREE.TubeGeometry(smile, 16, 0.016, 5, false), 'dark', 0, 0, 0);

  const tongue = new THREE.Group();
  frog.add(tongue);
  part(tongue, box, 'pink', 0, 0.48, 0.74, 0.12, 0.04, 0.25, [0.18, 0, 0]);
  blob(tongue, 'rose', 0, 0.44, 0.95, 0.13, 0.06, 0.14);

  const femaleBow = new THREE.Group();
  frog.add(femaleBow);
  femaleBow.position.set(0.42, 1.15, 0.08);
  blob(femaleBow, 'pink', -0.16, 0, 0, 0.22, 0.15, 0.09);
  blob(femaleBow, 'pink', 0.16, 0, 0, 0.22, 0.15, 0.09);
  blob(femaleBow, 'rose', 0, 0, 0.05, 0.1, 0.11, 0.09);

  const femaleFlower = new THREE.Group();
  frog.add(femaleFlower);
  femaleFlower.position.set(-0.44, 1.1, 0.06);
  for (let i = 0; i < 5; i++) {
    const a = (i * TAU) / 5;
    blob(femaleFlower, 'pale', Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0, 0.1, 0.065, 0.045);
  }
  blob(femaleFlower, 'gold', 0, 0, 0.04, 0.065, 0.065, 0.045);

  const femaleCheeks = new THREE.Group();
  frog.add(femaleCheeks);
  blob(femaleCheeks, 'rose', -0.36, 0.52, 0.45, 0.12, 0.08, 0.08);
  blob(femaleCheeks, 'rose', 0.36, 0.52, 0.45, 0.12, 0.08, 0.08);

  const femaleEyelashes = new THREE.Group();
  frog.add(femaleEyelashes);
  for (const s of [-1, 1]) {
    blob(femaleEyelashes, 'dark', s * 0.38, 1.05, 0.22, 0.16, 0.04, 0.08);
    blob(femaleEyelashes, 'dark', s * 0.46, 1.02, 0.2, 0.12, 0.04, 0.06);
  }
  femaleBow.visible = femaleFlower.visible = femaleCheeks.visible = femaleEyelashes.visible = false;

  const maleScarf = new THREE.Group();
  frog.add(maleScarf);
  maleScarf.position.set(0, 0.48, 0.48);
  blob(maleScarf, 'teal', -0.12, 0, 0, 0.18, 0.1, 0.06);
  blob(maleScarf, 'teal', 0.12, 0, 0, 0.18, 0.1, 0.06);
  blob(maleScarf, 'dark', 0, 0, 0.03, 0.08, 0.08, 0.06);

  const maleHat = new THREE.Group();
  frog.add(maleHat);
  maleHat.position.set(0, 1.12, 0.05);
  part(maleHat, cylinder, new THREE.MeshStandardMaterial({ color: 0x315d58, roughness: 0.6 }), 0, 0.14, 0, 0.44, 0.3, 0.44);
  part(maleHat, cylinder, 'teal', 0, 0, 0.04, 0.66, 0.06, 0.54);
  part(maleHat, box, 'gold', 0, 0.14, 0.42, 0.28, 0.06, 0.035);

  // Anatomical Forelimbs (Front Arms with webbed hands)
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.42, 0.42, 0.35);
    frog.add(arm);
    // Upper arm angled forward
    blob(arm, skin, 0, -0.15, 0.06, 0.12, 0.24, 0.14);
    // Forearm resting on lily pad
    blob(arm, skin, 0, -0.32, 0.18, 0.1, 0.18, 0.12);
    // 4 Splayed webbed fingers with sticky pads
    for (let j = 0; j < 4; j++) {
      const fx = (j - 1.5) * 0.07;
      part(arm, cylinder, skin, fx, -0.4, 0.28, 0.025, 0.16, 0.025, [PI / 2, 0, fx * 1.5]);
      blob(arm, 'gold', fx * 1.2, -0.4, 0.37, 0.035, 0.03, 0.035);
    }
    arms.push(arm);
  }

  // Realistic Z-Folded Hind Limbs (Thigh, folded shin, long webbed foot)
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.5, 0.28, -0.15);
    frog.add(leg);

    // Thick muscular thigh (femur)
    const thigh = blob(leg, skin, s * 0.16, 0.06, -0.04, 0.42, 0.32, 0.52);
    // Folded long shin (tibia/fibula)
    const shin = blob(leg, skin, s * 0.22, -0.1, 0.26, 0.24, 0.18, 0.62);
    shin.rotation.set(-0.32, s * 0.16, 0);

    // Long webbed foot with 5 elongated webbed toes
    const foot = new THREE.Group();
    foot.position.set(s * 0.18, -0.22, 0.45);
    leg.add(foot);
    blob(foot, skin, 0, 0, 0, 0.34, 0.08, 0.36);
    for (let j = 0; j < 5; j++) {
      const toeX = (j - 2) * 0.1;
      part(foot, cylinder, skin, toeX, 0, 0.24, 0.03, 0.32, 0.03, [PI / 2, 0, (j - 2) * 0.22]);
      blob(foot, 'gold', toeX * 1.25, 0, 0.41, 0.045, 0.035, 0.045);
    }
    legs.push(leg);
  }

  frog.scale.setScalar(1.12);
  frog.onBeforeRender = () => { body.scale.set(0.72 * (femaleMode ? 0.84 : 1), 0.46 * (femaleMode ? 0.95 : 1), 0.76); };

  // --- OVERHEAD DISTANCE COUNTER SPRITE ---
  const overheadCanvas = document.createElement('canvas');
  overheadCanvas.width = 512;
  overheadCanvas.height = 170;
  const overheadCtx = overheadCanvas.getContext('2d');
  const overheadTexture = new THREE.CanvasTexture(overheadCanvas);
  overheadTexture.minFilter = THREE.LinearFilter;
  overheadTexture.magFilter = THREE.LinearFilter;
  const overheadMaterial = new THREE.SpriteMaterial({
    map: overheadTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
  const overheadSprite = new THREE.Sprite(overheadMaterial);
  overheadSprite.scale.set(3.0, 1.0, 1);
  overheadSprite.renderOrder = 999;
  overheadSprite.visible = false;
  scene.add(overheadSprite);

  let lastOverheadMeters = -999;
  function drawRoundRect(ctx, x, y, width, height, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawOverheadBadge(meters) {
    const ctx = overheadCtx;
    const w = 512, h = 170;
    ctx.clearRect(0, 0, w, h);

    const pad = 10;
    const boxX = pad, boxY = pad, boxW = w - pad * 2, boxH = h - pad * 2;
    const radius = 42;

    ctx.save();
    drawRoundRect(ctx, boxX, boxY, boxW, boxH, radius);

    // Deep high-contrast dark slate
    ctx.fillStyle = 'rgba(10, 15, 29, 0.94)';
    const nearGoal = meters <= 100;
    ctx.shadowColor = nearGoal ? 'rgba(251, 191, 36, 0.95)' : 'rgba(34, 197, 94, 0.9)';
    ctx.shadowBlur = 28;
    ctx.fill();

    // High visibility neon border
    ctx.lineWidth = 8;
    ctx.strokeStyle = nearGoal ? '#fbbf24' : '#22c55e';
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = meters <= 0 ? '🏆 HEDEFTE!' : `🎯 ${meters.toLocaleString('tr-TR')}m`;

    ctx.font = '900 62px "Arial Black", Arial, system-ui, sans-serif';
    // Thick black outline for razor-sharp readability from any distance
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#05070d';
    ctx.strokeText(text, w / 2, h / 2 - 2);

    // Bright solid inner fill
    ctx.fillStyle = nearGoal ? '#fde047' : '#ffffff';
    ctx.fillText(text, w / 2, h / 2 - 2);

    overheadTexture.needsUpdate = true;
  }

  // --- EFFECT MODELS & ASSETS ---
  const effectRoot = new THREE.Group();
  scene.add(effectRoot);
  const effectModels = {};

  // 1. AUTHENTIC BRAZILIAN PARMAK ARASI TERLİK (Thong Sandal / Flip-Flop)
  const slipper = new THREE.Group();
  const soleShape = new THREE.Shape();
  soleShape.moveTo(-1.5, -0.58);
  soleShape.bezierCurveTo(-2.0, -0.38, -2.0, 0.42, -1.45, 0.62);
  soleShape.bezierCurveTo(-0.35, 0.85, 1.35, 0.66, 1.8, 0.26);
  soleShape.bezierCurveTo(2.05, -0.08, 1.55, -0.58, 0.82, -0.62);
  soleShape.closePath();
  const soleGeo = new THREE.ExtrudeGeometry(soleShape, { depth: 0.24, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.08, bevelThickness: 0.06 });
  soleGeo.rotateX(PI / 2);
  // Cyan foam sole with coral rim
  part(slipper, soleGeo, new THREE.MeshPhysicalMaterial({ color: 0x00bcd4, roughness: 0.35, clearcoat: 0.6 }), 0, 0, 0);
  const bedGeo = new THREE.ExtrudeGeometry(soleShape, { depth: 0.08, bevelEnabled: false });
  bedGeo.rotateX(PI / 2);
  part(slipper, bedGeo, new THREE.MeshStandardMaterial({ color: 0xffeb3b, roughness: 0.5 }), 0, 0.14, 0);
  // Cylindrical toe post
  part(slipper, cylinder, new THREE.MeshStandardMaterial({ color: 0xff4081, roughness: 0.4 }), 0.25, 0.32, 0, 0.08, 0.36, 0.08);
  // Y-strap
  for (const s of [-1, 1]) {
    const strapCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.7, 0.22, s * 0.54),
      new THREE.Vector3(-0.25, 0.72, s * 0.32),
      new THREE.Vector3(0.25, 0.46, 0)
    ]);
    part(slipper, new THREE.TubeGeometry(strapCurve, 16, 0.09, 8, false), new THREE.MeshStandardMaterial({ color: 0xff4081, roughness: 0.4 }), 0, 0, 0);
  }
  blob(slipper, 'gold', 0.25, 0.52, 0, 0.16, 0.09, 0.16);

  const slipperImpact = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const starAngle = (i * TAU) / 12;
    const starLen = i % 2 === 0 ? 1.7 : 0.9;
    part(slipperImpact, cone, new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xffdd33 : 0xff3311 }), Math.cos(starAngle) * starLen * 0.5, 0.3, Math.sin(starAngle) * starLen * 0.5, 0.12, starLen, 0.12, [PI / 2, 0, -starAngle + PI / 2]);
  }
  slipperImpact.visible = false;
  slipper.add(slipperImpact);
  slipper.scale.setScalar(1.35);
  effectModels.slipper = slipper;

  // 2. METEOR & GIANT 3D TSUNAMI WAVE (24m Wide River Fairway Surge)
  const meteor = new THREE.Group();
  const meteorRock = part(meteor, new THREE.IcosahedronGeometry(1.4, 1), new THREE.MeshStandardMaterial({ color: 0x2e2528, roughness: 0.95, emissive: 0x550f05, emissiveIntensity: 0.6 }), 0, 0, 0);
  for (const [x, y, z, s] of [[-0.5, 0.4, 0.8, 0.25], [0.45, 0.25, 0.9, 0.2], [-0.2, -0.5, 0.9, 0.18]]) {
    blob(meteor, new THREE.MeshStandardMaterial({ color: 0x141012, roughness: 1 }), x, y, z, s, 0.08, s);
  }
  const flameLayers = [[0xff1c24, 1.1, 2.4, 1.3], [0xff6b00, 0.8, 2.0, 1.5], [0xffd500, 0.5, 1.7, 1.7]];
  flameLayers.forEach(([color, radius, height, y], i) => {
    const flame = part(meteor, cone, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }), 0, y + i * 0.5, 0, radius, height, radius);
    flame.rotation.y = i * 0.7;
  });

  // Giant 3D Tsunami Curling Wave (Spans full 24m fairway with white foaming lip)
  const tsunamiWave = new THREE.Group();
  const waveGeo = new THREE.CylinderGeometry(5.8, 7.6, 24, 32, 5, true, 0, PI * 0.78);
  waveGeo.rotateZ(PI / 2);
  const waveMat = new THREE.MeshStandardMaterial({ color: 0x077b84, roughness: 0.12, metalness: 0.08, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
  const waveMesh = new THREE.Mesh(waveGeo, waveMat);
  waveMesh.position.set(0, -1.8, 0);
  tsunamiWave.add(waveMesh);
  tsunamiWave.rotation.y = PI; // Curl faces camera and frog
  // Frothing white crest along top barrel
  for (let i = 0; i < 32; i++) {
    const fx = -11.5 + i * 0.74;
    blob(tsunamiWave, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.96 }), fx, 3.5 + Math.sin(i * 1.5) * 0.38, 1.9, 0.7, 0.55, 0.7);
  }
  tsunamiWave.visible = false;
  scene.add(tsunamiWave);
  effectModels.meteor = meteor;

  // 3. COLOSSAL SCARY CROCODILE WITH GAPING JAWS & LETHAL OSTEODERM ARMOR (Spanning ~16m River Fairway)
  const crocodile = new THREE.Group();
  const crocSkinMat = new THREE.MeshStandardMaterial({ color: 0x1f3f22, roughness: 0.88, metalness: 0.1 });
  const crocUnderMat = new THREE.MeshStandardMaterial({ color: 0x768755, roughness: 0.75 });
  const crocMouthMat = new THREE.MeshStandardMaterial({ color: 0xb53545, roughness: 0.45 });

  // Colossal torso
  blob(crocodile, crocSkinMat, 0, 0.45, 0, 1.95, 0.65, 3.8);
  blob(crocodile, crocUnderMat, 0, 0.22, 0, 1.75, 0.32, 3.5);

  // Quadruple row of jagged armored osteoderm scutes
  for (let i = 0; i < 13; i++) {
    const scuteZ = -1.9 + i * 0.42;
    part(crocodile, cone, 'dark', -0.22, 0.95, scuteZ, 0.18, 0.42, 0.22);
    part(crocodile, cone, 'dark', 0.22, 0.95, scuteZ, 0.18, 0.42, 0.22);
    part(crocodile, cone, 'dark', -0.65, 0.82, scuteZ, 0.15, 0.35, 0.18);
    part(crocodile, cone, 'dark', 0.65, 0.82, scuteZ, 0.15, 0.35, 0.18);
  }

  // Crocodile Head Base & Gaping Roaring Jaws
  const crocHead = new THREE.Group();
  crocHead.position.set(0, 0.42, -2.4);
  crocodile.add(crocHead);

  // Upper Snout (Tilts upward dramatically when roaring)
  const crocJawTop = new THREE.Group();
  crocJawTop.position.set(0, 0.22, 0);
  crocHead.add(crocJawTop);
  blob(crocJawTop, crocSkinMat, 0, 0.18, -1.2, 1.25, 0.42, 2.1);
  blob(crocJawTop, crocMouthMat, 0, -0.06, -1.1, 1.05, 0.14, 1.9);
  // Upper razor-sharp conical teeth (16 teeth)
  for (let i = 0; i < 16; i++) {
    const toothX = (i % 2 === 0 ? 1 : -1) * (0.52 - (i / 16) * 0.2);
    const toothZ = -0.35 - (i / 16) * 1.8;
    part(crocJawTop, cone, 'white', toothX, -0.18, toothZ, 0.08, 0.32, 0.08, [PI, 0, 0]);
  }
  // Predatory yellow reptilian eyes with vertical slit pupils
  for (const s of [-1, 1]) {
    blob(crocJawTop, crocSkinMat, s * 0.48, 0.52, -0.25, 0.26, 0.26, 0.26);
    const eye = blob(crocJawTop, 'gold', s * 0.48, 0.54, -0.18, 0.18, 0.18, 0.12);
    blob(eye, 'black', 0, 0, 0.11, 0.04, 0.16, 0.04);
  }

  // Lower Jaw (Drops downward dramatically when roaring)
  const crocJawBottom = new THREE.Group();
  crocJawBottom.position.set(0, -0.15, 0);
  crocHead.add(crocJawBottom);
  blob(crocJawBottom, crocSkinMat, 0, -0.12, -1.15, 1.1, 0.28, 2.0);
  blob(crocJawBottom, crocMouthMat, 0, 0.08, -1.05, 0.95, 0.12, 1.8);
  // Lower fangs (14 teeth)
  for (let i = 0; i < 14; i++) {
    const toothX = (i % 2 === 0 ? 1 : -1) * (0.46 - (i / 14) * 0.18);
    const toothZ = -0.4 - (i / 14) * 1.7;
    part(crocJawBottom, cone, 'white', toothX, 0.2, toothZ, 0.08, 0.32, 0.08);
  }

  // Splayed webbed swimming limbs (extending to ~16m river width)
  const crocLimbs = [];
  for (const [side, zPos, isFront] of [[-1, -0.8, true], [1, -0.8, true], [-1, 1.4, false], [1, 1.4, false]]) {
    const limb = new THREE.Group();
    limb.position.set(side * 1.5, 0.2, zPos);
    crocodile.add(limb);
    blob(limb, crocSkinMat, side * 0.65, 0, 0, 0.75, 0.25, 0.42);
    for (let c = 0; c < 4; c++) {
      const cZ = (c - 1.5) * 0.15;
      part(limb, cone, 'dark', side * 1.3, -0.05, cZ, 0.08, 0.35, 0.08, [0, 0, side * -PI / 2]);
    }
    crocLimbs.push(limb);
  }

  // Massive swaying tail
  const crocTail = new THREE.Group();
  crocTail.position.set(0, 0.35, 1.9);
  crocodile.add(crocTail);
  for (let i = 0; i < 11; i++) {
    blob(crocTail, crocSkinMat, 0, 0, i * 0.52, 0.95 - i * 0.08, 0.48 - i * 0.035, 0.65);
    part(crocTail, cone, 'dark', 0, 0.45 - i * 0.035, i * 0.52, 0.14, 0.35 - i * 0.02, 0.18);
  }
  // Colossal scale spanning the entire river width!
  crocodile.scale.set(3.8, 2.6, 3.4);
  effectModels.crocodile = crocodile;

  // 3B. MAJESTIC WHITE STORK (Leylek Kuşu)
  const stork = new THREE.Group();
  stork.visible = false;
  effectRoot.add(stork);

  const storkWhiteMat = new THREE.MeshStandardMaterial({ color: 0xfbfbfb, roughness: 0.65 });
  const storkBlackMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.8 });
  const storkBillMat = new THREE.MeshStandardMaterial({ color: 0xeb3c24, roughness: 0.35 });
  const storkLegMat = new THREE.MeshStandardMaterial({ color: 0xe0442a, roughness: 0.5 });

  blob(stork, storkWhiteMat, 0, 0, 0, 0.95, 0.82, 1.7);
  blob(stork, storkBlackMat, 0, 0.15, 1.1, 0.75, 0.45, 0.85);

  const storkNeck = new THREE.Group();
  storkNeck.position.set(0, 0.45, -1.1);
  stork.add(storkNeck);
  part(storkNeck, cylinder, storkWhiteMat, 0, 0.55, -0.3, 0.22, 1.35, 0.22, [-0.42, 0, 0]);

  const storkHead = new THREE.Group();
  storkHead.position.set(0, 1.15, -0.75);
  storkNeck.add(storkHead);
  blob(storkHead, storkWhiteMat, 0, 0, 0, 0.38, 0.35, 0.52);

  for (const s of [-1, 1]) {
    blob(storkHead, 'gold', s * 0.32, 0.08, -0.05, 0.1, 0.1, 0.08);
    blob(storkHead, 'black', s * 0.35, 0.08, -0.05, 0.07, 0.07, 0.07);
  }

  part(storkHead, cone, storkBillMat, 0, -0.06, -1.35, 0.18, 1.9, 0.18, [-PI / 2, 0, 0]);

  const storkWingLeft = new THREE.Group();
  storkWingLeft.position.set(-0.85, 0.3, -0.1);
  stork.add(storkWingLeft);
  blob(storkWingLeft, storkWhiteMat, -1.2, 0, 0, 1.4, 0.12, 0.9);
  blob(storkWingLeft, storkBlackMat, -2.6, 0, 0.1, 1.2, 0.08, 0.75);

  const storkWingRight = new THREE.Group();
  storkWingRight.position.set(0.85, 0.3, -0.1);
  stork.add(storkWingRight);
  blob(storkWingRight, storkWhiteMat, 1.2, 0, 0, 1.4, 0.12, 0.9);
  blob(storkWingRight, storkBlackMat, 2.6, 0, 0.1, 1.2, 0.08, 0.75);

  const storkLegs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.35, -0.65, 0.4);
    stork.add(leg);
    part(leg, cylinder, storkLegMat, 0, -0.9, 0, 0.08, 1.8, 0.08);
    for (let t = -1; t <= 1; t++) {
      part(leg, cylinder, storkLegMat, t * 0.12, -1.82, -0.22, 0.04, 0.45, 0.04, [0.45, 0, 0]);
    }
    part(leg, cylinder, storkLegMat, 0, -1.8, 0.18, 0.04, 0.32, 0.04, [-0.45, 0, 0]);
    storkLegs.push(leg);
  }

  stork.scale.set(1.9, 1.9, 1.9);
  effectModels.stork = stork;

  // 4. CS2 TACTICAL FLASHBANG GRENADE
  const bomb = new THREE.Group();
  const grenadeMesh = new THREE.Group();
  bomb.add(grenadeMesh);
  const flashBodyMat = new THREE.MeshStandardMaterial({ color: 0x3d4b41, roughness: 0.35, metalness: 0.65 });
  part(grenadeMesh, cylinder, flashBodyMat, 0, 0, 0, 0.48, 1.35, 0.48);
  part(grenadeMesh, cylinder, new THREE.MeshStandardMaterial({ color: 0x0077cc, roughness: 0.4 }), 0, 0.1, 0, 0.485, 0.24, 0.485);
  part(grenadeMesh, cylinder, 'steel', 0, 0.8, 0, 0.35, 0.28, 0.35);
  part(grenadeMesh, box, 'steel', 0.24, 0.4, 0, 0.08, 0.95, 0.16, [0, 0, 0.18]);
  const pullRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 16), materials.steel);
  pullRing.position.set(-0.28, 0.82, 0);
  grenadeMesh.add(pullRing);

  // Orbiting dizzy stars
  const dizzy = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const star = blob(dizzy, i % 2 ? 'gold' : 'white', Math.cos((i * TAU) / 6) * 0.85, 0, Math.sin((i * TAU) / 6) * 0.85, 0.16);
    star.material = star.material.clone();
    star.material.emissive = new THREE.Color(0xffea00);
  }
  dizzy.position.y = 1.9;
  bomb.add(dizzy);
  effectModels.bomb = bomb;

  // 5. SPACIOUS HEAVY IRON PRISON CAGE
  const cage = new THREE.Group();
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2e3b44, roughness: 0.25, metalness: 0.85 });
  for (const x of [-1.5, 1.5]) {
    for (const z of [-1.5, 1.5]) {
      part(cage, cylinder, ironMat, x, 1.5, z, 0.12, 3.0, 0.12);
      blob(cage, 'gold', x, 3.05, z, 0.18);
    }
  }
  for (const x of [-1.0, -0.5, 0, 0.5, 1.0]) {
    for (const z of [-1.5, 1.5]) part(cage, cylinder, ironMat, x, 1.5, z, 0.075, 3.0, 0.075);
  }
  for (const z of [-1.0, -0.5, 0, 0.5, 1.0]) {
    for (const x of [-1.5, 1.5]) part(cage, cylinder, ironMat, x, 1.5, z, 0.075, 3.0, 0.075);
  }
  for (const y of [0.08, 3.0]) {
    part(cage, box, ironMat, 0, y, -1.5, 3.2, 0.18, 0.18);
    part(cage, box, ironMat, 0, y, 1.5, 3.2, 0.18, 0.18);
    part(cage, box, ironMat, -1.5, y, 0, 0.18, 0.18, 3.2);
    part(cage, box, ironMat, 1.5, y, 0, 0.18, 0.18, 3.2);
  }
  for (const x of [-1.0, -0.5, 0, 0.5, 1.0]) part(cage, cylinder, ironMat, x, 3.0, 0, 0.065, 3.0, 0.065, [PI / 2, 0, 0]);
  part(cage, box, 'gold', 0, 1.35, 1.58, 0.32, 0.38, 0.14);
  const lockShackle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 8, 16, PI), materials.steel);
  lockShackle.position.set(0, 1.55, 1.58);
  cage.add(lockShackle);
  effectModels.prison = cage;

  // --- KURTARMA ÇEKİCİ (3D BLACKSMITH RESCUE HAMMER) ---
  const hammerGroup = new THREE.Group();
  hammerGroup.visible = false;
  const hammerHeadMat = new THREE.MeshStandardMaterial({ color: 0x272c33, roughness: 0.35, metalness: 0.85 });
  const hammerSteelMat = new THREE.MeshStandardMaterial({ color: 0xa0a8b4, roughness: 0.2, metalness: 0.95 });
  const hammerWoodMat = new THREE.MeshStandardMaterial({ color: 0x6e473b, roughness: 0.7, metalness: 0.1 });
  const hammerHead = new THREE.Group();
  part(hammerHead, box, hammerHeadMat, 0, 0, 0, 0.9, 0.75, 1.35);
  part(hammerHead, box, hammerSteelMat, 0, 0, -0.68, 0.82, 0.68, 0.12);
  part(hammerHead, box, hammerSteelMat, 0, 0, 0.68, 0.82, 0.68, 0.12);
  const hammerHandle = new THREE.Group();
  part(hammerHandle, cylinder, hammerWoodMat, 0, -1.1, 0, 0.08, 2.2, 0.08);
  part(hammerHandle, cylinder, hammerSteelMat, 0, -2.15, 0, 0.1, 0.25, 0.1);
  hammerGroup.add(hammerHead);
  hammerGroup.add(hammerHandle);
  hammerGroup.scale.setScalar(1.2);
  scene.add(hammerGroup);

  let hammerStrikeAnim = null;
  function triggerHammerStrike(reduction, shatters) {
    hammerStrikeAnim = {
      elapsed: 0,
      duration: 0.6,
      shatters: Boolean(shatters),
      impactDone: false,
      startX: frogX + 2.4,
      targetX: frogX + 0.8,
      baseZ: -progress * STEP + 1.2
    };
    hammerGroup.visible = true;
  }

  // 6. ROKET (Supersonic Multi-Stage Rocket with Blazing Plasma Exhaust)
  const rocket = new THREE.Group();
  part(rocket, cylinder, new THREE.MeshPhysicalMaterial({ color: 0xe6273e, roughness: 0.2, metalness: 0.45, clearcoat: 0.9 }), 0, 0.5, 0, 0.82, 3.6, 0.82);
  part(rocket, cylinder, 'white', 0, 0.5, 0, 0.83, 3.61, 0.2);
  part(rocket, cone, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.3 }), 0, 2.95, 0, 0.86, 1.4, 0.86);
  part(rocket, cylinder, 'gold', 0, 3.8, 0, 0.04, 0.7, 0.04);
  blob(rocket, 'gold', 0, 4.15, 0, 0.12);
  const cockpit = blob(rocket, new THREE.MeshPhysicalMaterial({ color: 0x4fe6ff, roughness: 0.1, clearcoat: 1.0, emissive: 0x0088cc, emissiveIntensity: 0.5 }), 0, 1.1, 0.55, 0.45, 0.65, 0.42);
  cockpit.rotation.x = 0.2;

  // Supersonic Rocket Thruster Nozzles & Incandescent Plasma Jets
  const rocketFlames = [];
  const rocketLight = new THREE.PointLight(0xff6600, 3.8, 14);
  rocketLight.position.set(0, -2.5, 0);
  rocket.add(rocketLight);

  for (const s of [-1, 1]) {
    part(rocket, cylinder, new THREE.MeshStandardMaterial({ color: 0x23272a, metalness: 0.8, roughness: 0.3 }), s * 0.38, -1.5, 0, 0.34, 0.48, 0.34);
    const flameGroup = new THREE.Group();
    flameGroup.position.set(s * 0.38, -1.75, 0);
    rocket.add(flameGroup);
    rocketFlames.push(flameGroup);
    // Outer roaring crimson plume (up to 4.8m)
    part(flameGroup, cone, new THREE.MeshBasicMaterial({ color: 0xff1e00, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }), 0, -1.6, 0, 0.55, 3.2, 0.55, [PI, 0, 0]);
    // Mid vibrant golden fire jet
    part(flameGroup, cone, new THREE.MeshBasicMaterial({ color: 0xff9900, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }), 0, -1.1, 0, 0.38, 2.4, 0.38, [PI, 0, 0]);
    // Inner incandescent white-hot plasma core
    part(flameGroup, cone, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0, depthWrite: false, blending: THREE.AdditiveBlending }), 0, -0.65, 0, 0.22, 1.5, 0.22, [PI, 0, 0]);
  }
  rocket.rotation.x = -PI / 2;
  effectModels.rocket = rocket;

  // 7. DEV KAPLUMBAĞA (Giant Turtle)
  const turtle = new THREE.Group();
  const turtleShellMat = new THREE.MeshStandardMaterial({ color: 0x296435, roughness: 0.65, metalness: 0.08 });
  blob(turtle, turtleShellMat, 0, 0.52, 0.1, 2.1, 0.82, 2.5);
  for (let i = 0; i < 4; i++) {
    const scuteZ = -0.9 + i * 0.65;
    const scute = blob(turtle, new THREE.MeshStandardMaterial({ color: 0x3d854c, roughness: 0.6 }), 0, 0.98 - Math.abs(i - 1.5) * 0.08, scuteZ, 0.48, 0.16, 0.42);
    blob(scute, new THREE.MeshStandardMaterial({ color: 0xc99c36, roughness: 0.5 }), 0, 0.06, 0, 0.32, 0.08, 0.28);
  }
  const turtleLotusThrone = botanicalLotus();
  turtleLotusThrone.scale.set(1.9, 1.2, 1.9);
  turtleLotusThrone.position.set(0, 1.05, 0);
  turtle.add(turtleLotusThrone);
  const turtleHeadGroup = new THREE.Group();
  turtleHeadGroup.position.set(0, 0.38, -2.3);
  turtle.add(turtleHeadGroup);
  blob(turtleHeadGroup, new THREE.MeshStandardMaterial({ color: 0x48944f, roughness: 0.65 }), 0, 0.25, 0, 0.62, 0.48, 0.78);
  const turtleFlippers = {};
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 1.85, 0.18, -0.9);
    turtle.add(pivot);
    blob(pivot, new THREE.MeshStandardMaterial({ color: 0x3d7e45, roughness: 0.7 }), s * 0.9, 0, -0.15, 1.25, 0.14, 0.68);
    turtleFlippers[s === -1 ? 'frontLeft' : 'frontRight'] = pivot;
  }
  effectModels.turtle = turtle;

  // 8. GÖKKUŞAĞI KOŞUSU (Rainbow Ribbon, Iridescent Bubbles & Hearts)
  const rainbow = new THREE.Group();
  const rainbowColors = [0xff1a40, 0xff7b00, 0xffea00, 0x1cdb5e, 0x00c8ff, 0x3d5afe, 0xa82eff];
  for (let i = 0; i < rainbowColors.length; i++) {
    const bandMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.38, 12, 1, 16),
      new THREE.MeshBasicMaterial({ color: rainbowColors[i], transparent: true, opacity: 0.95, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
    );
    bandMesh.rotation.x = -PI / 2;
    bandMesh.position.x = (i - 3) * 0.38;
    rainbow.add(bandMesh);
  }
  // Floating iridescent soap bubbles and pastel hearts
  for (let i = 0; i < 14; i++) {
    const bubble = blob(rainbow, new THREE.MeshPhysicalMaterial({ color: 0xe6faff, roughness: 0.05, transmission: 0.9, transparent: true, opacity: 0.8, clearcoat: 1 }), (Math.random() - 0.5) * 3.5, 0.8 + Math.random() * 2.2, (Math.random() - 0.5) * 8, 0.22 + Math.random() * 0.12);
    // Floating hearts
    if (i % 2 === 0) {
      blob(rainbow, 'pink', (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 7, 0.16, 0.14, 0.1);
    }
  }
  effectModels.rainbow = rainbow;

  // 9. ENHANCED ANTIQUE RIVERBOAT (Paddle Steamer with Pilot House)
  const boat = new THREE.Group();
  const boatHullShape = new THREE.Shape();
  boatHullShape.moveTo(0, -3.2);
  boatHullShape.lineTo(1.5, -1.8);
  boatHullShape.lineTo(1.65, 1.6);
  boatHullShape.bezierCurveTo(1.65, 2.5, -1.65, 2.5, -1.65, 1.6);
  boatHullShape.lineTo(-1.5, -1.8);
  boatHullShape.closePath();
  const boatHullGeo = new THREE.ExtrudeGeometry(boatHullShape, { depth: 1.15, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.12, bevelThickness: 0.1 });
  boatHullGeo.rotateX(PI / 2);
  // Polished rich mahogany hull
  part(boat, boatHullGeo, new THREE.MeshStandardMaterial({ color: 0x5a2d18, roughness: 0.4 }), 0, 0.35, 0);
  // Open recessed teak cockpit floor for the frog (Frog stands securely inside here)
  part(boat, box, new THREE.MeshStandardMaterial({ color: 0x7a3e20, roughness: 0.55 }), 0, 0.28, -0.85, 2.2, 0.14, 1.8);
  // Mahogany cockpit side coaming / bulwarks
  part(boat, box, new THREE.MeshStandardMaterial({ color: 0x5a2d18, roughness: 0.4 }), -1.15, 0.55, -0.85, 0.16, 0.45, 1.8);
  part(boat, box, new THREE.MeshStandardMaterial({ color: 0x5a2d18, roughness: 0.4 }), 1.15, 0.55, -0.85, 0.16, 0.45, 1.8);
  // Polished brass ship helm in front of frog
  part(boat, cylinder, 'gold', 0, 0.78, 0.05, 0.32, 0.06, 0.32, [PI / 2, 0, 0]);
  part(boat, cylinder, 'steel', 0, 0.48, 0.05, 0.05, 0.55, 0.05);

  // Compact forward cabin and pilot house (Forward at z: 1.1 so cockpit is completely open)
  part(boat, box, new THREE.MeshStandardMaterial({ color: 0xfbf8f1, roughness: 0.4 }), 0, 1.25, 1.1, 1.7, 1.1, 1.4);
  // Emerald roof over front cabin
  part(boat, box, new THREE.MeshStandardMaterial({ color: 0x1f5436, roughness: 0.5 }), 0, 1.82, 1.1, 1.88, 0.12, 1.55);
  // Twin brass chimneys on forward cabin
  part(boat, cylinder, new THREE.MeshStandardMaterial({ color: 0x222426, roughness: 0.4, metalness: 0.7 }), -0.35, 2.35, 1.1, 0.18, 1.4, 0.18);
  part(boat, cylinder, new THREE.MeshStandardMaterial({ color: 0x222426, roughness: 0.4, metalness: 0.7 }), 0.35, 2.35, 1.1, 0.18, 1.4, 0.18);
  part(boat, cylinder, 'gold', -0.35, 2.95, 1.1, 0.22, 0.12, 0.22);
  part(boat, cylinder, 'gold', 0.35, 2.95, 1.1, 0.22, 0.12, 0.22);
  // Rotating stern paddle wheel
  const boatPaddleWheel = new THREE.Group();
  boatPaddleWheel.position.set(0, 0.6, 2.8);
  boat.add(boatPaddleWheel);
  part(boatPaddleWheel, cylinder, 'gold', 0, 0, 0, 0.1, 2.2, 0.1, [0, 0, PI / 2]);
  for (let i = 0; i < 8; i++) {
    const padAngle = (i * TAU) / 8;
    part(boatPaddleWheel, box, new THREE.MeshStandardMaterial({ color: 0xb92b27, roughness: 0.5 }), 0, Math.sin(padAngle) * 0.75, Math.cos(padAngle) * 0.75, 1.9, 0.18, 0.04, [padAngle, 0, 0]);
  }
  effectModels.boat = boat;

  Object.values(effectModels).forEach(model => {
    model.visible = false;
    effectRoot.add(model);
  });

  // --- 3D WATER DROPLET SPLASH PARTICLES (Lily Pad & 360 Radial Meteor Explosion) ---
  const padSplashes = [];
  const dropletGeo = new THREE.SphereGeometry(0.12, 8, 6);
  const dropletMat = new THREE.MeshPhysicalMaterial({ color: 0xb4f4ff, roughness: 0.1, transmission: 0.85, transparent: true, opacity: 0.9, clearcoat: 1 });
  for (let i = 0; i < 96; i++) {
    const m = new THREE.Mesh(dropletGeo, dropletMat);
    m.visible = false;
    scene.add(m);
    padSplashes.push({ m, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, active: false });
  }

  function emitPadSplash(cx, cz, count = 10) {
    for (let i = 0; i < count; i++) {
      const d = padSplashes.find(p => !p.active) || padSplashes[i % padSplashes.length];
      d.active = true;
      d.life = 0.85;
      d.x = cx + (Math.random() - 0.5) * 1.6;
      d.y = 0.15;
      d.z = cz + (Math.random() - 0.5) * 1.6;
      const side = Math.random() > 0.5 ? 1 : -1;
      d.vx = side * (1.2 + Math.random() * 2.8);
      d.vy = 2.4 + Math.random() * 2.2;
      d.vz = (Math.random() - 0.5) * 2.2;
      d.m.position.set(d.x, d.y, d.z);
      d.m.visible = true;
    }
  }

  function emitRadialSplash(cx, cz, count = 48) {
    for (let i = 0; i < count; i++) {
      const d = padSplashes.find(p => !p.active) || padSplashes[i % padSplashes.length];
      d.active = true;
      d.life = 1.35;
      d.x = cx + (Math.random() - 0.5) * 1.2;
      d.y = 0.2;
      d.z = cz + (Math.random() - 0.5) * 1.2;
      const angle = (i / count) * TAU + (Math.random() - 0.5) * 0.4;
      const speed = 4.2 + Math.random() * 6.5;
      d.vx = Math.cos(angle) * speed;
      d.vy = 4.0 + Math.random() * 4.8;
      d.vz = Math.sin(angle) * speed;
      d.m.position.set(d.x, d.y, d.z);
      d.m.visible = true;
    }
  }

  // --- 3D ENERGY CLASH ORB (Fire Penalty vs Water Support Plasma Vortex) ---
  const clashGroup = new THREE.Group();
  scene.add(clashGroup);
  clashGroup.visible = false;

  const penaltyOrb = part(clashGroup, new THREE.SphereGeometry(1.2, 16, 16), new THREE.MeshStandardMaterial({
    color: 0xff2200, roughness: 0.3, emissive: 0xff4400, emissiveIntensity: 0.9
  }), -0.85, 0, 0);

  const supportOrb = part(clashGroup, new THREE.SphereGeometry(1.2, 16, 16), new THREE.MeshStandardMaterial({
    color: 0x00d4ff, roughness: 0.2, emissive: 0x0088ff, emissiveIntensity: 0.95
  }), 0.85, 0, 0);

  const clashRings = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.8 + i * 0.35, 0.06, 8, 32),
      new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffffff : i === 1 ? 0xffaa00 : 0x00f0ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })
    );
    clashGroup.add(ring);
    clashRings.push(ring);
  }

  const clashShockwave = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 1.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
  );
  clashShockwave.rotation.x = -PI / 2;
  clashGroup.add(clashShockwave);

  let clashState = null;
  function start3DClash({ penalty, support, netDelta }, callback) {
    clashState = {
      elapsed: 0,
      duration: 2.2,
      netDelta,
      callback
    };
    clashGroup.visible = true;
    clashShockwave.material.opacity = 0;
    clashShockwave.scale.setScalar(1);
  }

  let celebrationState = null;
  function startCelebrationDance(playerGender, callback) {
    celebrationState = {
      elapsed: 0,
      duration: 14.5,
      gender: playerGender,
      callback
    };
  }

  // --- SUBTLE DELICATE TRAIL PARTICLES ---
  const trailPalette = [0xff4f70, 0xffa43a, 0xffe65c, 0x62d884, 0x46bfff, 0xa56cff];
  const effectTrails = [];
  for (let i = 0; i < 80; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 6, 4),
      new THREE.MeshBasicMaterial({ color: trailPalette[i % trailPalette.length], transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    m.visible = false;
    scene.add(m);
    effectTrails.push({ m, age: 10, life: 1, x: 0, y: 0, z: 0, kind: 'rainbow' });
  }

  let trailCursor = 0;
  function emitTrail(kind, x, y, z, count = 1) {
    for (let n = 0; n < count; n++) {
      const p = effectTrails[trailCursor++ % effectTrails.length];
      p.kind = kind;
      p.age = 0;
      p.life = kind === 'wake' ? 0.75 : kind === 'smoke' ? 1.0 : kind === 'star' ? 0.5 : 0.8;
      p.x = x + (Math.random() - 0.5) * (kind === 'wake' ? 0.35 : 0.22);
      p.y = y + Math.random() * (kind === 'smoke' ? 0.25 : 0.15);
      p.z = z + (Math.random() - 0.5) * (kind === 'wake' ? 0.35 : 0.22);
      p.m.scale.setScalar(kind === 'star' ? 0.8 : kind === 'wake' ? 1.1 : 0.9);
      p.m.visible = true;
    }
  }

  const ringGeo = new THREE.RingGeometry(0.9, 1, 48);
  ringGeo.rotateX(-PI / 2);
  const ripples = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xdbfff0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    scene.add(m);
    ripples.push({ m, age: 10, index: 0, x: 0 });
  }

  // --- REALISTIC RIVER WATER WAKE & WAVE SYSTEM (FOR TURTLE & BOAT) ---
  const wakeGeo = new THREE.RingGeometry(0.5, 0.95, 36);
  wakeGeo.rotateX(-PI / 2);
  const wakeMat = new THREE.MeshBasicMaterial({
    color: 0xe0f7ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  const waterWakeRings = [];
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Mesh(wakeGeo, wakeMat.clone());
    m.visible = false;
    scene.add(m);
    waterWakeRings.push({ m, age: 10, life: 1.4, x: 0, y: 0.02, z: 0, baseScale: 1, expandRate: 2.8, vx: 0 });
  }
  let wakeRingCursor = 0;
  function emitWaterWakeRing(x, y, z, vx = 0, initialScale = 1.0, life = 1.4, color = 0xd8f5ff) {
    const w = waterWakeRings[wakeRingCursor++ % waterWakeRings.length];
    w.x = x;
    w.y = y;
    w.z = z;
    w.vx = vx;
    w.age = 0;
    w.life = life;
    w.baseScale = initialScale;
    w.m.position.set(x, y, z);
    w.m.scale.set(initialScale, 1, initialScale);
    w.m.material.color.setHex(color);
    w.m.material.opacity = 0.8;
    w.m.visible = true;
  }

  // Water foam trail (köpüklü su izi)
  const foamGeo = new THREE.CircleGeometry(0.35, 16);
  foamGeo.rotateX(-PI / 2);
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const waterFoamPool = [];
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(foamGeo, foamMat.clone());
    m.visible = false;
    scene.add(m);
    waterFoamPool.push({ m, age: 10, life: 1.2, x: 0, y: 0.025, z: 0, vx: 0 });
  }
  let foamCursor = 0;
  function emitWaterFoam(x, y, z, vx = 0, life = 1.2) {
    const f = waterFoamPool[foamCursor++ % waterFoamPool.length];
    f.x = x + (Math.random() - 0.5) * 0.4;
    f.y = y;
    f.z = z + (Math.random() - 0.5) * 0.4;
    f.vx = vx + (Math.random() - 0.5) * 0.3;
    f.age = 0;
    f.life = life;
    f.m.position.set(f.x, f.y, f.z);
    f.m.scale.set(0.6, 1, 0.6);
    f.m.material.opacity = 0.75;
    f.m.visible = true;
  }

  const butterflies = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const a = blob(g, i % 2 ? 'pink' : 'gold', -0.12, 0, 0, 0.19, 0.04, 0.13);
    const b = blob(g, i % 2 ? 'pink' : 'gold', 0.12, 0, 0, 0.19, 0.04, 0.13);
    blob(g, 'black', 0, 0, 0, 0.035, 0.03, 0.17);
    scene.add(g);
    butterflies.push({ g, a, b });
  }

  // --- GAME STATE ---
  let progress = 0, from = 0, to = 0, jumpTime = 0, jumping = false, jumpDuration = 0.58, clock = 0, done = null, muted = false, lastNow = performance.now(), heading = PI, landed = false, jumpStyle = 0;
  let lastPlayerActivity = performance.now();
  let activeEffect = null;
  let frogX = 0, startX = 0, targetX = 0, miss = false, recovery = 0, safeX = 0, safeProgress = 0;
  let prisonBonking = 0;
  let takeoffSplashDone = false;
  let onProgressCallback = null;

  const aim = new THREE.Vector3(0, 0.12, -STEP), ray = new THREE.Raycaster();
  const marker = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffdc67, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }));
  marker.scale.setScalar(0.45);
  scene.add(marker);

  const aimDots = [];
  for (let i = 0; i < 9; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    scene.add(dot);
    aimDots.push(dot);
  }

  function assistedTarget() {
    const frogZ = -progress * STEP, target = aim.clone(), dx = aim.x - frogX, dz = aim.z - frogZ, length = Math.hypot(dx, dz);
    let best = null, bestDistance = 8.5;
    for (const p of pads) {
      if (!p.visible) continue;
      const x = p.position.x - frogX, z = p.position.z - frogZ, distance = Math.hypot(x, z);
      if (distance < 1 || distance > 10.5 || (x * dx + z * dz) / Math.max(0.001, distance * length) < 0.15) continue;
      const gap = Math.hypot(p.position.x - aim.x, p.position.z - aim.z);
      if (gap < bestDistance) { best = p; bestDistance = gap; }
    }
    if (best) {
      // High magnetic assistance (0.58) as requested!
      target.x = THREE.MathUtils.lerp(target.x, best.position.x, 0.58);
      target.z = THREE.MathUtils.lerp(target.z, best.position.z, 0.58);
    }
    return target;
  }

  let fps = 60, frames = 0, fpsStart = performance.now(), qualityMode = 'balanced', cameraYaw = 0, cameraPitch = 0, dragging = false, lastPointerX = 0, lastPointerY = 0;
  canvas.addEventListener('pointerdown', e => {
    if (!playing || e.button !== 0) return;
    dragging = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('look-active');
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    cameraYaw = THREE.MathUtils.clamp(cameraYaw - (e.clientX - lastPointerX) * 0.0045, -PI, PI);
    cameraPitch = THREE.MathUtils.clamp(cameraPitch + (e.clientY - lastPointerY) * 0.003, -0.24, 0.32);
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  });
  function endLook(e) {
    dragging = false;
    canvas.classList.remove('look-active');
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
  }
  canvas.addEventListener('pointerup', endLook);
  canvas.addEventListener('pointercancel', endLook);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  function pose() {
    const mobile = innerWidth < 700;
    // Follow the frog continuously and smoothly without post-jump readjustment snap
    const camTargetX = playing ? (celebrationState ? padX(currentGoal) : frogX) : 0;
    const targetZ = (playing ? (celebrationState ? -currentGoal * STEP : -progress * STEP) : -progress * STEP) - 6;
    const distance = (mobile ? 26 : 20) * zoom;
    const desired = new THREE.Vector3(
      camTargetX + Math.sin(cameraYaw) * distance,
      (mobile ? 15 : 10.5) * zoom + cameraPitch * 9,
      targetZ + Math.cos(cameraYaw) * distance
    );
    const lag = camera.position.distanceTo(desired);
    const lerpFactor = Math.min(0.85, 0.14 + (lag / 28) * 0.45);
    camera.position.lerp(desired, lerpFactor);
    camera.lookAt(camTargetX, 0.7 + cameraPitch * 2.5, targetZ);
  }
  camera.position.set(11, 12, 19);

  // --- RENDER & ANIMATION LOOP ---
  function render(now) {
    requestAnimationFrame(render);
    const dt = Math.min((now - lastNow) / 1000, 0.05);
    lastNow = now;
    clock += dt;

    const genderX = femaleMode ? 0.9 : 1;

    // Head-Bonk Animation inside Prison Cage
    if (prisonBonking > 0) {
      prisonBonking = Math.max(0, prisonBonking - dt * 2.8);
      const bonkPhase = 1 - prisonBonking;
      if (bonkPhase < 0.45) {
        frog.position.y = (bonkPhase / 0.45) * 1.55;
        frog.scale.set(1.12 * genderX * 0.9, 1.12 * 1.25, 1.12 * 0.9);
      } else if (bonkPhase < 0.6) {
        frog.position.y = 1.55;
        frog.scale.set(1.12 * genderX * 1.35, 1.12 * 0.65, 1.12 * 1.35);
        emitTrail('star', frogX, 1.8, -progress * STEP, 2);
      } else {
        const landU = (bonkPhase - 0.6) / 0.4;
        frog.position.y = 1.55 * (1 - landU);
        frog.scale.set(1.12 * genderX, 1.12, 1.12);
        frog.rotation.z = Math.sin(landU * 18) * 0.2;
      }
    }

    // --- THREE DISTINCT ATHLETIC JUMP ANIMATIONS ---
    if (jumping && !muted) {
      jumpTime += dt;
      const t = Math.min(1, jumpTime / jumpDuration);

      if (t < 0.16) {
        // Phase 1: Forward Spring Athletic Compression (0 <= t < 0.16)
        const c = Math.sin((t / 0.16) * PI * 0.5);
        frog.scale.set(1.12 * genderX * (1 + c * 0.25), 1.12 * (1 - c * 0.38), 1.12 * (1 + c * 0.18));
        frog.position.y = -c * 0.14;
        // Lean forward into the jump trajectory, never backward!
        frog.rotation.x = c * 0.18;
        frog.position.x = startX;
        frog.position.z = -from * STEP;
        legs.forEach(l => { l.rotation.x = -c * 0.6; l.scale.z = 1 - c * 0.3; });
        arms.forEach(a => { a.rotation.x = c * 0.35; });
      } else if (t <= 0.84) {
        // Phase 2: Launch & Majestic Airtime (0.16 <= t <= 0.84)
        if (!takeoffSplashDone) {
          takeoffSplashDone = true;
          emitPadSplash(startX, -from * STEP, 14);
          emitTrail('wake', startX, 0.1, -from * STEP, 3);
        }

        const air = (t - 0.16) / 0.68;
        const airMove = air * air * (3 - 2 * air);
        progress = from + (to - from) * airMove;
        frogX = THREE.MathUtils.lerp(startX, targetX, airMove);
        frog.position.x = frogX;
        frog.position.z = -progress * STEP;
        onProgressCallback?.(progress);

        // High parabolic hangtime arc
        const hang = Math.sin(air * PI);
        frog.position.y = hang * 3.8;

        if (jumpStyle === 0) {
          // --- ANIMATION 1: İLERİ DOĞRU ELİNİ AÇARAK SÜZÜLME (GLIDING FLYING FROG) ---
          const flightPitch = (0.5 - air) * 0.32;
          frog.rotation.x = flightPitch;
          frog.rotation.y = heading;
          frog.rotation.z = Math.sin(air * PI) * 0.06 * (from % 2 === 0 ? 1 : -1);

          // Kollarını ve ellerini iki yana/ileri kocaman açar (kanat gibi süzülür)
          const armSpread = Math.sin(air * PI);
          arms[0].rotation.set(-0.55 - armSpread * 0.25, 0.2, 1.2 * armSpread);
          arms[1].rotation.set(-0.55 - armSpread * 0.25, -0.2, -1.2 * armSpread);

          // Bacaklar geriye doğru düz uzanır
          legs.forEach(l => {
            l.rotation.x = 1.65 * armSpread;
            l.position.z = -0.45 * armSpread;
            l.scale.z = 1 + 0.35 * armSpread;
          });
          frog.scale.set(1.12 * genderX * 0.96, 1.12 * 0.95, 1.12 * (1 + 0.22 * armSpread));

        } else if (jumpStyle === 1) {
          // --- ANIMATION 2: DÖNEREK ZIPLAMA (360° PIROUETTE / BARREL ROLL SPIN) ---
          const spinAngle = air * TAU;
          frog.rotation.y = heading + spinAngle;
          frog.rotation.x = -0.15 + Math.sin(air * PI) * 0.12;
          frog.rotation.z = Math.sin(spinAngle) * 0.22;

          // Kollar dönüş merkezinde estetik açık
          const armWave = Math.sin(spinAngle);
          arms[0].rotation.set(-0.4 + armWave * 0.25, 0.35, 0.7);
          arms[1].rotation.set(-0.4 - armWave * 0.25, -0.35, -0.7);

          // Bacaklar artistik balet pozunda
          legs[0].rotation.x = 1.3 + Math.sin(spinAngle) * 0.25;
          legs[1].rotation.x = 1.0 - Math.sin(spinAngle) * 0.25;
          frog.scale.set(1.12 * genderX, 1.12, 1.12);

        } else {
          // --- ANIMATION 3: TAKLA ATARAK ZIPLAMA (360° FRONT SOMERSAULT FLIP) ---
          const somersaultAngle = air * TAU;
          frog.rotation.x = -somersaultAngle;
          frog.rotation.y = heading;
          frog.rotation.z = Math.sin(air * TAU) * 0.14 * (from % 2 === 0 ? 1 : -1);

          if (air < 0.5) {
            const tuck = air / 0.5;
            legs.forEach(l => { l.rotation.x = -0.55 * tuck; l.position.z = 0.2 * tuck; });
            arms.forEach(a => { a.rotation.x = 0.75 * tuck; });
            frog.scale.set(1.12 * genderX * 1.08, 1.12 * 0.92, 1.12 * 0.92);
          } else {
            const untuck = (air - 0.5) / 0.5;
            legs.forEach(l => { l.rotation.x = -0.55 * (1 - untuck); l.position.z = 0.2 * (1 - untuck); });
            arms.forEach(a => { a.rotation.x = 0.75 * (1 - untuck); });
            frog.scale.set(1.12 * genderX, 1.12, 1.12);
          }
        }

        // Sparkle trail & water whoosh behind the jumping frog!
        emitTrail('star', frogX + (Math.random() - 0.5) * 0.5, frog.position.y + 0.1, -progress * STEP, 1);
        if (Math.random() > 0.4) {
          emitTrail('wake', frogX, Math.max(0.15, frog.position.y * 0.35), -progress * STEP, 1);
        }
      } else {
        // Phase 3: Touchdown, Ripple & Cushion Squash (0.84 < t <= 1.0)
        // Position is already locked to targetX and -to * STEP - zero jump, zero snap!
        progress = to;
        frogX = targetX;
        safeProgress = progress;
        safeX = frogX;
        frog.position.x = targetX;
        frog.position.z = -to * STEP;

        const land = (t - 0.84) / 0.16;
        const landSquash = Math.sin(land * PI);
        frog.position.y = -landSquash * 0.16;
        frog.scale.set(
          1.12 * genderX * (1 + landSquash * 0.28),
          1.12 * (1 - landSquash * 0.35),
          1.12 * (1 + landSquash * 0.22)
        );
        frog.rotation.set(0, heading, 0);
        legs.forEach(l => { l.rotation.x = -landSquash * 0.4; l.scale.z = 1; l.position.z = 0; });
        arms.forEach(a => { a.rotation.set(0, 0, 0); });
      }

      if (t >= 0.84 && !landed) {
        landed = true;
        emitPadSplash(targetX, -to * STEP, 16);
        const r = ripples.find(r => r.age > 2) || ripples[0];
        r.age = 0;
        r.index = to;
        r.x = targetX;
      }

      if (t === 1) {
        jumping = false;
        progress = to;
        frogX = targetX;
        safeX = frogX;
        safeProgress = progress;
        frog.position.set(targetX, 0, -to * STEP);
        frog.rotation.set(0, heading, 0);
        frog.scale.set(1.12 * genderX, 1.12, 1.12);
        legs.forEach(l => { l.rotation.x = 0; l.scale.z = 1; l.position.z = 0; });
        arms.forEach(a => { a.rotation.set(0, 0, 0); });
        done?.(true);
        aim.set(targetX, 0.12, -to * STEP - STEP);
      }
    }

    if (!jumping && prisonBonking === 0) {
      const idleLook = playing && !activeEffect && recovery <= 0 && !celebrationState && !clashState && performance.now() - lastPlayerActivity >= 10000;
      const wanted = idleLook
        ? Math.atan2(camera.position.x - frog.position.x, camera.position.z - frog.position.z)
        : (playing ? heading : 0.3);
      frog.rotation.y += Math.atan2(Math.sin(wanted - frog.rotation.y), Math.cos(wanted - frog.rotation.y)) * 0.09;
    }

    // --- EFFECT ANIMATION ORCHESTRATION ---
    if (activeEffect && !muted) {
      activeEffect.elapsed += dt;
      const p = Math.min(1, activeEffect.elapsed / activeEffect.duration);
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const model = effectModels[activeEffect.type];

      if (activeEffect.move && activeEffect.type !== 'boat' && activeEffect.type !== 'slipper' && activeEffect.type !== 'meteor' && activeEffect.type !== 'crocodile' && activeEffect.type !== 'turtle' && activeEffect.type !== 'rocket' && activeEffect.type !== 'rainbow') {
        progress = THREE.MathUtils.lerp(activeEffect.start, activeEffect.target, ease);
        frogX = THREE.MathUtils.lerp(padX(activeEffect.start), padX(activeEffect.target), p);
        safeProgress = progress;
        safeX = frogX;
      }

      if (model) {
        model.visible = true;

        // 1. TERLİK ŞAPLAĞI (Side fly-in -> WHACK impact -> Tumbling catapult back)
        if (activeEffect.type === 'slipper') {
          const startProg = activeEffect.start;
          const targetProg = activeEffect.target;
          const startZ = -startProg * STEP;
          const startX = padX(startProg);
          const targetZ = -targetProg * STEP;
          const targetX = padX(targetProg);

          if (p <= 0.20) {
            const u = p / 0.20;
            const flyX = THREE.MathUtils.lerp(startX + 18, startX, u);
            const flyY = THREE.MathUtils.lerp(12, 0.85, u * u);
            const flyZ = THREE.MathUtils.lerp(startZ + 8, startZ, u);
            model.position.set(flyX, flyY, flyZ);
            model.scale.setScalar(THREE.MathUtils.lerp(0.3, 1.45, u));
            model.rotation.set(0, 0, THREE.MathUtils.lerp(2.2, -0.45, u));
            slipperImpact.visible = false;
            frog.position.set(startX, 0, startZ);
            frog.rotation.set(0, heading, 0);
          } else if (p <= 0.30) {
            model.position.set(startX, 0.8, startZ);
            model.rotation.set(0, 0, -0.45);
            slipperImpact.visible = true;
            slipperImpact.scale.setScalar(2.8);
            frog.position.set(startX, -0.05, startZ);
            frog.scale.set(1.9, 0.2, 1.9);
            frog.rotation.z = -0.3;
            emitTrail('star', startX, 0.5, startZ, 2);
          } else if (p <= 0.90) {
            slipperImpact.visible = false;
            model.visible = false;
            const u = (p - 0.30) / 0.60;
            const uFly = u * u * (3 - 2 * u);
            progress = THREE.MathUtils.lerp(startProg, targetProg, uFly);
            frogX = THREE.MathUtils.lerp(startX, targetX, u);
            safeProgress = progress;
            safeX = frogX;
            onProgressCallback?.(progress);
            frog.position.set(frogX, Math.sin(u * PI) * 3.8, -progress * STEP);
            frog.rotation.x = -u * 4 * PI;
            frog.rotation.z = Math.sin(u * 8 * PI) * 0.35;
            frog.scale.set(1.12 * genderX, 1.12, 1.12);
            emitTrail('star', frogX, frog.position.y, frog.position.z, 1);
          } else {
            model.visible = false;
            progress = targetProg;
            frogX = targetX;
            safeProgress = progress;
            safeX = frogX;
            const u = (p - 0.90) / 0.10;
            const landSquash = Math.sin(u * PI);
            frog.position.set(frogX, -landSquash * 0.1, -progress * STEP);
            frog.scale.set(1.12 * (1 + landSquash * 0.25), 1.12 * (1 - landSquash * 0.35), 1.12 * (1 + landSquash * 0.25));
            frog.rotation.set(0, heading + Math.sin(u * 25) * 0.3, 0);
          }
        }

        // 2. METEOR & GIANT 3D TSUNAMI WAVE (Surges back pushing frog)
        if (activeEffect.type === 'meteor') {
          const startProg = activeEffect.start;
          const targetProg = activeEffect.target;
          const impactZ = -startProg * STEP - 10;
          const startX = padX(startProg);
          const targetX = padX(targetProg);
          const impactX = 0;

          if (p <= 0.25) {
            const u = p / 0.25;
            model.visible = true;
            tsunamiWave.visible = false;
            model.position.set(
              THREE.MathUtils.lerp(impactX - 12, impactX, u),
              THREE.MathUtils.lerp(24, 0.4, u * u),
              THREE.MathUtils.lerp(impactZ - 8, impactZ, u)
            );
            meteorRock.rotation.y = clock * 10;
            meteorRock.rotation.x = clock * 8;
            emitTrail('fire', model.position.x, model.position.y, model.position.z, 4);
            frog.position.set(startX, 0, -startProg * STEP);
          } else if (p <= 0.88) {
            if (!activeEffect.impact) {
              activeEffect.impact = true;
              emitRadialSplash(impactX, impactZ, 90);
            }
            model.visible = false;
            tsunamiWave.visible = true;
            const u = (p - 0.25) / 0.63;
            const surgeProgress = THREE.MathUtils.lerp(startProg, targetProg, u * u * (3 - 2 * u));
            progress = surgeProgress;
            frogX = THREE.MathUtils.lerp(startX, targetX, u);
            safeProgress = progress;
            safeX = frogX;
            onProgressCallback?.(progress);

            const waveZ = THREE.MathUtils.lerp(impactZ, -targetProg * STEP + 2, u);
            tsunamiWave.position.set(frogX, 0.2, waveZ);
            tsunamiWave.scale.set(1 + Math.sin(clock * 12) * 0.15, 1 + Math.sin(clock * 14) * 0.2, 1);
            cameraPitch += Math.sin(clock * 55) * 0.04;

            // Frog lifted high on crest of rushing wave, flailing backwards in panic!
            frog.position.set(frogX, 2.2 + Math.sin(clock * 18) * 0.5, -progress * STEP);
            frog.rotation.x = -0.55 + Math.sin(clock * 20) * 0.25;
            frog.rotation.y = heading + PI;
            legs[0].rotation.x = Math.sin(clock * 30) * 1.2;
            legs[1].rotation.x = -Math.sin(clock * 30) * 1.2;
            arms[0].rotation.z = Math.sin(clock * 25) * 1.1;
            arms[1].rotation.z = -Math.sin(clock * 25) * 1.1;

            emitTrail('wake', frogX - 1.2, 0.8, -progress * STEP, 3);
            emitTrail('wake', frogX + 1.2, 0.8, -progress * STEP, 3);
          } else {
            tsunamiWave.visible = false;
            progress = targetProg;
            frogX = targetX;
            safeProgress = progress;
            safeX = frogX;
            onProgressCallback?.(progress);
            frog.position.set(frogX, 0, -progress * STEP);
            frog.rotation.set(0, heading, 0);
            legs.forEach(l => l.rotation.x = 0);
            arms.forEach(a => a.rotation.set(0, 0, 0));
          }
        }

        // 3. COLOSSAL SCARY CROCODILE (Emerges 22m ahead, roaring pursuit at 14m distance)
        if (activeEffect.type === 'crocodile') {
          const startProg = activeEffect.start;
          const targetProg = activeEffect.target;
          const startZ = -startProg * STEP;
          const startX = padX(startProg);
          const targetZ = -targetProg * STEP;
          const targetX = padX(targetProg);

          if (p <= 0.25) {
            model.visible = true;
            model.position.set(0, 0.12, startZ - 22);
            model.rotation.y = PI;
            // Gaping unhinged jaws roar!
            crocJawTop.rotation.x = -0.75 + Math.sin(clock * 14) * 0.25;
            crocJawBottom.rotation.x = 0.75 - Math.sin(clock * 14) * 0.2;
            crocTail.rotation.y = Math.sin(clock * 16) * 0.5;
            crocLimbs.forEach((limb, li) => { limb.rotation.y = Math.sin(clock * 16 + li) * 0.5; });
            // Frog recoils and turns 180 in terror!
            frog.rotation.y = heading + PI;
            frog.position.set(startX, 0, startZ);
            progress = startProg;
            frogX = startX;
            emitTrail('wake', -5, 0.1, startZ - 20, 2);
            emitTrail('wake', 5, 0.1, startZ - 20, 2);
          } else if (p <= 0.88) {
            const u = (p - 0.25) / 0.63;
            progress = THREE.MathUtils.lerp(startProg, targetProg, u);
            frogX = THREE.MathUtils.lerp(startX, targetX, u);
            safeProgress = progress;
            safeX = frogX;
            onProgressCallback?.(progress);
            frog.position.set(frogX, 0.15 + Math.abs(Math.sin(clock * 26)) * 0.28, -progress * STEP);
            frog.rotation.y = heading + PI;
            legs[0].rotation.x = Math.sin(clock * 32) * 0.85;
            legs[1].rotation.x = -Math.sin(clock * 32) * 0.85;

            const cZ = -progress * STEP - 14;
            model.position.set(THREE.MathUtils.lerp(0, frogX, 0.5), 0.12, cZ);
            crocJawTop.rotation.x = -0.75 + Math.sin(clock * 16) * 0.25;
            crocJawBottom.rotation.x = 0.75 - Math.sin(clock * 16) * 0.2;
            crocTail.rotation.y = Math.sin(clock * 18) * 0.55;
            crocLimbs.forEach((limb, li) => { limb.rotation.y = Math.sin(clock * 18 + li) * 0.55; });
            emitTrail('wake', model.position.x - 5, 0.1, cZ, 2);
            emitTrail('wake', model.position.x + 5, 0.1, cZ, 2);
          } else {
            const u = (p - 0.88) / 0.12;
            model.position.set(targetX, 0.12 - u * 3.5, targetZ - 10);
            if (u > 0.6) model.visible = false;
            crocJawTop.rotation.x = 0;
            crocJawBottom.rotation.x = 0;
            progress = targetProg;
            frogX = targetX;
            safeProgress = progress;
            safeX = frogX;
            frog.position.set(targetX, 0, -progress * STEP);
            frog.rotation.set(0, heading, 0);
            legs.forEach(l => l.rotation.x = 0);
          }
        }

        // 3B. STORK KIDNAPPING PENALTY (Leylek Gökten İner, Kurbağayı Havada Geriye Taşır, Nilüfere Bırakır)
        if (activeEffect.type === 'stork') {
          const startProg = activeEffect.start;
          const targetProg = activeEffect.target;
          const startZ = -startProg * STEP;
          const startX = padX(startProg);
          const targetZ = -targetProg * STEP;
          const targetX = padX(targetProg);

          model.visible = true;
          const flapSpeed = p < 0.22 || p > 0.85 ? 22 : 16;
          const flapAngle = Math.sin(clock * flapSpeed) * 0.52;
          storkWingLeft.rotation.z = flapAngle;
          storkWingRight.rotation.z = -flapAngle;

          if (p <= 0.22) {
            // Phase 1: Swoop dive from sky to snatch frog
            const u = p / 0.22;
            const ease = u * u * (3 - 2 * u);
            const sX = THREE.MathUtils.lerp(startX - 6, startX, ease);
            const sY = THREE.MathUtils.lerp(14, 1.45, ease);
            const sZ = THREE.MathUtils.lerp(startZ - 20, startZ, ease);
            model.position.set(sX, sY, sZ);
            model.rotation.set(0.25 * (1 - ease), heading + PI, 0);

            progress = startProg;
            frogX = startX;
            frog.position.set(startX, 0, startZ);
            frog.rotation.set(-0.25 * ease, heading, 0);
            if (u > 0.8) {
              emitTrail('star', startX, 0.5, startZ, 2);
            }
          } else if (p <= 0.85) {
            // Phase 2: Stork carries frog in air flying backwards to target pad!
            const u = (p - 0.22) / 0.63;
            progress = THREE.MathUtils.lerp(startProg, targetProg, u);
            frogX = THREE.MathUtils.lerp(startX, targetX, u);
            safeProgress = progress;
            safeX = frogX;
            onProgressCallback?.(progress);

            const flyY = 3.6 + Math.sin(clock * 8) * 0.45;
            const curZ = -progress * STEP;
            model.position.set(frogX, flyY, curZ);
            model.rotation.set(0.08, heading + PI, Math.sin(clock * 6) * 0.08);

            // Frog clutched in talons, legs flailing
            frog.position.set(frogX, flyY - 1.25, curZ);
            frog.rotation.set(0.2, heading + PI, Math.sin(clock * 12) * 0.15);
            legs[0].rotation.x = Math.sin(clock * 20) * 0.7;
            legs[1].rotation.x = -Math.sin(clock * 20) * 0.7;
            arms.forEach(a => { a.rotation.z = Math.sin(clock * 24) * 0.4; });

            emitTrail('wake', frogX, 0.1, curZ, 1);
            if (Math.random() < 0.2) {
              emitTrail('star', frogX + (Math.random() - 0.5) * 2, flyY, curZ, 1);
            }
          } else {
            // Phase 3: Descend onto target pad, drop frog, stork flies away up
            const u = (p - 0.85) / 0.15;
            progress = targetProg;
            frogX = targetX;
            safeProgress = progress;
            safeX = frogX;

            if (u < 0.4) {
              const dropU = u / 0.4;
              const frogLandY = THREE.MathUtils.lerp(2.2, 0, dropU);
              frog.position.set(targetX, frogLandY, targetZ);
              frog.rotation.set(0, heading, 0);
              model.position.set(targetX, 2.8 + dropU * 1.5, targetZ);
              if (dropU >= 0.9 && !activeEffect.impact) {
                activeEffect.impact = true;
                emitPadSplash(targetX, targetZ, 14);
              }
            } else {
              frog.position.set(targetX, 0, targetZ);
              frog.rotation.set(0, heading, 0);
              legs.forEach(l => { l.rotation.set(0, 0, 0); });
              arms.forEach(a => { a.rotation.set(0, 0, 0); });

              const flyAwayU = (u - 0.4) / 0.6;
              const sY = 4.3 + flyAwayU * 22;
              const sZ = targetZ + flyAwayU * 35;
              model.position.set(targetX, sY, sZ);
              model.rotation.set(-0.35, heading + PI, 0);
              if (u > 0.95) model.visible = false;
            }
          }
        }

        // 4. CS2 TACTICAL FLASHBANG (Knocks frog unconscious on back with spinning stars)
        if (activeEffect.type === 'bomb') {
          if (p <= 0.14) {
            const u = p / 0.14;
            model.position.set(
              THREE.MathUtils.lerp(frogX + 6, frogX, u),
              THREE.MathUtils.lerp(8, 1.8, u * u),
              THREE.MathUtils.lerp(-progress * STEP - 3, -progress * STEP - 1, u)
            );
            model.scale.setScalar(1);
            model.rotation.set(u * 12, u * 10, u * 8);
            grenadeMesh.visible = true;
            dizzy.visible = false;
          } else {
            model.position.set(frogX, 0, -progress * STEP);
            model.scale.setScalar(1);
            model.rotation.set(0, 0, 0);
            grenadeMesh.visible = false;
            dizzy.visible = true;
            dizzy.position.set(0, 1.35, 0);
            dizzy.rotation.y = clock * 6;
            // Knocked out cold: flips backwards flat on back with limbs spread out!
            frog.position.y = 0.22;
            frog.rotation.x = PI * 0.88;
            frog.rotation.z = Math.sin(clock * 8) * 0.12;
            legs.forEach(l => { l.rotation.x = -1.2; l.rotation.z = 0.6; });
            arms.forEach(a => { a.rotation.x = 1.3; a.rotation.z = -0.7; });
            emitTrail('star', frogX + Math.sin(clock * 7) * 0.6, 1.2, -progress * STEP + Math.cos(clock * 7) * 0.6, 1);
          }
        }

        // 5. SPACIOUS HEAVY IRON PRISON CAGE
        if (activeEffect.type === 'prison') {
          model.position.set(frogX, 0, -progress * STEP);
          model.scale.setScalar(1);
          model.visible = true;
        }

        // 6. NEHİR TEKNESİ (Cruises synchronously in fairway, frog stands at helm in cockpit)
        if (activeEffect.type === 'boat') {
          const startProg = activeEffect.start;
          const targetProg = activeEffect.target;
          const startZ = -startProg * STEP;
          const startX = padX(startProg);
          const targetZ = -targetProg * STEP;
          const targetX = padX(targetProg);

          boatPaddleWheel.rotation.x = clock * 14;

          const u = p * p * (3 - 2 * p);
          progress = THREE.MathUtils.lerp(startProg, targetProg, u);
          frogX = THREE.MathUtils.lerp(startX, targetX, p);
          safeProgress = progress;
          safeX = frogX;
          onProgressCallback?.(progress);

          const bZ = -progress * STEP;
          const bobY = -0.04 + Math.sin(clock * 6) * 0.03;

          model.position.set(frogX, bobY, bZ);
          // Frog stands securely inside the open cockpit at the helm!
          frog.position.set(frogX, bobY + 0.48, bZ - 0.7);
          frog.rotation.set(0, heading, 0);
          arms.forEach(a => a.rotation.set(-0.55, 0, 0));
          legs.forEach(l => { l.rotation.x = 0; l.scale.z = 1; l.position.z = 0; });

          emitTrail('wake', frogX - 2.2, 0.05, bZ + 2.8, 2);
          emitTrail('wake', frogX + 2.2, 0.05, bZ + 2.8, 2);
          emitTrail('wake', frogX, 0.05, bZ + 3.2, 2);
        }

        // 7. DEV KAPLUMBAĞA (Frog rides seated on lotus throne on turtle's back - fully synchronous)
        if (activeEffect.type === 'turtle') {
          const startProg = activeEffect.start;
          const targetProg = activeEffect.target;
          const startZ = -startProg * STEP;
          const startX = padX(startProg);
          const targetZ = -targetProg * STEP;
          const targetX = padX(targetProg);
          const stroke = clock * 4.8;
          model.visible = true;

          for (const s of [-1, 1]) {
            const fKey = s === -1 ? 'frontLeft' : 'frontRight';
            if (turtleFlippers[fKey]) turtleFlippers[fKey].rotation.set(-Math.sin(stroke) * 0.4, s * (0.2 + Math.cos(stroke) * 0.6), 0);
          }

          const u = p * p * (3 - 2 * p);
          progress = THREE.MathUtils.lerp(startProg, targetProg, u);
          frogX = THREE.MathUtils.lerp(startX, targetX, p);
          safeProgress = progress;
          safeX = frogX;
          onProgressCallback?.(progress);

          const tZ = -progress * STEP;
          const bobY = 0.04 + Math.sin(stroke) * 0.05;

          model.position.set(frogX, -0.05 + bobY, tZ);
          // Frog sits proudly on the lotus throne on turtle's back!
          frog.position.set(frogX, model.position.y + 1.25, tZ);
          frog.rotation.set(0, heading, 0);
          // Seated rider posture
          legs.forEach(l => { l.rotation.x = -0.65; l.scale.z = 0.88; l.position.z = 0.12; });
          arms.forEach(a => a.rotation.set(-0.35, 0, 0));

          // Realistic expanding V-shaped river waves & foaming wake behind giant turtle!
          emitWaterWakeRing(frogX - 1.5, 0.02, tZ + 2.0, -1.2, 1.0, 1.4, 0xd0f4ff);
          emitWaterWakeRing(frogX + 1.5, 0.02, tZ + 2.0, 1.2, 1.0, 1.4, 0xd0f4ff);
          emitWaterWakeRing(frogX, 0.02, tZ + 2.6, 0, 1.3, 1.5, 0xb8eeff);
          emitWaterFoam(frogX - 1.2, 0.025, tZ + 1.8, -0.8);
          emitWaterFoam(frogX + 1.2, 0.025, tZ + 1.8, 0.8);
          emitWaterFoam(frogX, 0.025, tZ + 2.4, 0);
        }

        // 8. ROKET (Supersonic Rocket - Frog sits securely inside cockpit piloting!)
        if (activeEffect.type === 'rocket') {
          const startProg = activeEffect.start;
          const targetProg = activeEffect.target;
          const startZ = -startProg * STEP;
          const startX = padX(startProg);
          const targetZ = -targetProg * STEP;
          const targetX = padX(targetProg);

          const u = p * p * (3 - 2 * p);
          progress = THREE.MathUtils.lerp(startProg, targetProg, u);
          frogX = THREE.MathUtils.lerp(startX, targetX, p);
          safeProgress = progress;
          safeX = frogX;
          onProgressCallback?.(progress);

          const flightZ = -progress * STEP;
          const jetPulse = 1 + Math.sin(clock * 55) * 0.35;
          rocketFlames.forEach(f => f.scale.set(jetPulse, 1 + Math.sin(clock * 65) * 0.45, jetPulse));
          rocketLight.intensity = 3.5 + Math.sin(clock * 50) * 1.5;

          const swayX = Math.sin(clock * 6.5) * 1.6;
          const bankRoll = Math.cos(clock * 6.5) * 0.22;
          const currentRocketX = frogX + swayX;

          model.position.set(currentRocketX, 0.85 + Math.sin(clock * 20) * 0.08, flightZ + 0.8);
          model.rotation.z = bankRoll;
          model.rotation.y = Math.sin(clock * 6.5) * 0.12;

          // FROG SITS SECURELY INSIDE THE COCKPIT PILOTING THE ROCKET!
          frog.position.set(currentRocketX, model.position.y + 0.55, flightZ - 0.25);
          frog.rotation.z = bankRoll;
          frog.rotation.y = heading + Math.sin(clock * 6.5) * 0.12;
          // Seated pilot posture: legs tucked under, arms holding steering controls
          legs.forEach(l => { l.rotation.x = -1.15; l.scale.z = 0.72; l.position.z = 0.18; });
          arms[0].rotation.set(-0.75, 0.25, 0.35);
          arms[1].rotation.set(-0.75, -0.25, -0.35);

          emitTrail('fire', currentRocketX - 0.4, 0.6, flightZ + 3.5, 2);
          emitTrail('fire', currentRocketX + 0.4, 0.6, flightZ + 3.5, 2);
          emitTrail('star', currentRocketX, 0.6, flightZ + 4.2, 1);
        }

        // 9. GÖKKUŞAĞI KOŞUSU (Rainbow Ribbon with Floating Hearts & Stars)
        if (activeEffect.type === 'rainbow') {
          const startProg = activeEffect.start;
          const targetProg = activeEffect.target;
          const startX = padX(startProg);
          const targetX = padX(targetProg);

          progress = THREE.MathUtils.lerp(startProg, targetProg, p);
          frogX = THREE.MathUtils.lerp(startX, targetX, p);
          safeProgress = progress;
          safeX = frogX;
          onProgressCallback?.(progress);

          model.position.set(frogX, 0.4, -progress * STEP + 4.5);
          frog.position.set(frogX, 0.35 + Math.abs(Math.sin(clock * 18)) * 0.35, -progress * STEP);
          legs[0].rotation.x = -Math.sin(clock * 28) * 1.2;
          legs[1].rotation.x = Math.sin(clock * 28) * 1.2;
          emitTrail('rainbow', frogX, 0.45, -progress * STEP + 2.2, 3);
          emitTrail('star', frogX + (Math.random() - 0.5) * 1.5, 0.8 + Math.random() * 0.8, -progress * STEP + 1.8, 1);
        }
      }

      if (p === 1 && activeEffect.type !== 'prison') {
        const finished = activeEffect;
        activeEffect = null;
        Object.values(effectModels).forEach(x => { x.visible = false; });
        tsunamiWave.visible = false;
        slipperImpact.visible = false;
        frog.position.y = 0;
        frog.rotation.set(0, heading, 0);
        frog.scale.set(1.12 * genderX, 1.12, 1.12);
        legs.forEach(l => { l.rotation.x = 0; l.scale.z = 1; l.position.z = 0; });
        arms.forEach(a => { a.rotation.set(0, 0, 0); });
        safeProgress = progress;
        safeX = frogX;
        aim.set(frogX, 0.12, -progress * STEP - STEP);
        finished.done?.();
      }
    }

    if (!jumping && !activeEffect) {
      frog.position.x = frogX;
      frog.position.z = -progress * STEP;
    }

    // --- 3D WATER DROPLET PARTICLES UPDATE ---
    for (const d of padSplashes) {
      if (!d.active) continue;
      d.life -= dt;
      d.vy -= 9.8 * dt; // Gravity
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      d.m.position.set(d.x, d.y, d.z);
      if (d.y <= 0 || d.life <= 0) {
        d.active = false;
        d.m.visible = false;
        const r = ripples.find(r => r.age > 1.8);
        if (r) { r.age = 0; r.x = d.x; r.index = -d.z / STEP; }
      }
    }

    // --- RECOVERY FROM WATER MISS (Bursting Water Splash Arc) ---
    if (recovery > 0 && !muted) {
      recovery = Math.max(0, recovery - dt);
      const t = 1 - recovery;
      if (t < 0.25) {
        frog.position.y = (-1.4 * t) / 0.25;
        frog.rotation.x = t * 1.5;
        emitTrail('wake', frogX, 0.05, -progress * STEP, 2);
      } else if (t < 0.85) {
        const arc = (t - 0.25) / 0.60;
        frogX = THREE.MathUtils.lerp(targetX, safeX, arc);
        progress = THREE.MathUtils.lerp(to, safeProgress, arc);
        frog.position.y = -1.4 * (1 - arc) + Math.sin(arc * PI) * 3.4;
        frog.rotation.x = (1 - arc) * 0.4;
        legs.forEach(l => l.rotation.x = 0.8 * (1 - arc));
        emitTrail('wake', frogX, 0.1, -progress * STEP, 1);
      } else {
        frogX = safeX;
        progress = safeProgress;
        const land = (t - 0.85) / 0.15;
        frog.position.y = Math.sin(land * PI) * -0.15;
        frog.rotation.x = 0;
        legs.forEach(l => l.rotation.x = 0);
      }
      frog.position.x = frogX;
      frog.position.z = -progress * STEP;
      if (recovery === 0) {
        frog.position.y = 0;
        frog.rotation.x = 0;
        aim.set(frogX, 0.12, -safeProgress * STEP - STEP);
        done?.(false);
      }
    }

    // --- SPECTATOR FROGS ANIMATION ON FROG ISLAND (Ada İçi Kurbağa Partisi) ---
    if (spectatorFrogs && spectatorFrogs.length) {
      const isParty = Boolean(celebrationState);
      const jumpSpeed = isParty ? 11.5 : 3.5;
      const jumpHeight = isParty ? 0.95 : 0.15;
      const waveSpeed = isParty ? 18.0 : 4.5;
      for (let i = 0; i < spectatorFrogs.length; i++) {
        const sf = spectatorFrogs[i];
        const hop = Math.abs(Math.sin(clock * jumpSpeed + sf.phase)) * jumpHeight;
        sf.group.position.y = sf.baseY + hop;
        sf.group.scale.y = 1 + (hop > 0.1 ? 0.18 : -0.1);
        sf.arms[0].rotation.z = Math.sin(clock * waveSpeed + sf.phase) * (isParty ? 1.2 : 0.4);
        sf.arms[1].rotation.z = -Math.sin(clock * waveSpeed + sf.phase) * (isParty ? 1.2 : 0.4);
      }
    }

    // --- VICTORY CELEBRATION DANCE ON FROG ISLAND GOLD PODIUM ---
    if (celebrationState) {
      celebrationState.elapsed += dt;
      const cp = Math.min(1, celebrationState.elapsed / celebrationState.duration);
      const hop = Math.abs(Math.sin(celebrationState.elapsed * 6.5)) * 1.5;
      const spin = celebrationState.elapsed * 4.8;

      frog.position.set(padX(currentGoal) - 1.1, 1.22 + hop, -currentGoal * STEP);
      frog.rotation.y = spin;
      frog.scale.set(1.12 * genderX, 1.12 * (1 + (hop > 0.3 ? 0.2 : -0.15)), 1.12);
      arms[0].rotation.z = Math.sin(celebrationState.elapsed * 12) * 0.9;
      arms[1].rotation.z = -Math.sin(celebrationState.elapsed * 12) * 0.9;

      partnerFrog.position.set(1.1, 1.22 + hop, 0);
      partnerFrog.rotation.y = -spin;
      partnerArms[0].rotation.z = -Math.sin(celebrationState.elapsed * 12) * 0.9;
      partnerArms[1].rotation.z = Math.sin(celebrationState.elapsed * 12) * 0.9;

      emitTrail('rainbow', padX(currentGoal) + (Math.random() - 0.5) * 8, 2.5 + Math.random() * 4, -currentGoal * STEP + (Math.random() - 0.5) * 8, 3);
      emitTrail('star', padX(currentGoal) + (Math.random() - 0.5) * 6, 2.0 + Math.random() * 3, -currentGoal * STEP + (Math.random() - 0.5) * 6, 2);

      if (cp === 1) {
        const cb = celebrationState.callback;
        celebrationState = null;
        partnerFrog.position.set(0.95, 0.82, 0);
        partnerFrog.rotation.set(0, 0, 0);
        partnerArms.forEach(a => a.rotation.set(0, 0, 0));
        cb?.();
      }
    }

    // --- 3D CLASH ENERGY ORB UPDATE ---
    if (clashState) {
      clashState.elapsed += dt;
      const clp = Math.min(1, clashState.elapsed / clashState.duration);
      clashGroup.position.set(frogX, 2.2, -progress * STEP - 3.8);
      clashGroup.rotation.y += dt * 14;
      clashGroup.rotation.x = Math.sin(clock * 12) * 0.3;

      for (let i = 0; i < clashRings.length; i++) {
        clashRings[i].rotation.z += dt * (8 + i * 4);
        clashRings[i].rotation.x += dt * (5 - i * 3);
      }

      const winnerBias = Math.sign(clashState.netDelta || 0);
      penaltyOrb.scale.setScalar(1 + Math.sin(clock * 35) * 0.22);
      supportOrb.scale.setScalar(1 + Math.cos(clock * 35) * 0.22);
      clashGroup.position.x += Math.sin(clock * 50) * 0.12 + (winnerBias * clp * 0.8);

      emitTrail('fire', clashGroup.position.x - 0.8, clashGroup.position.y, clashGroup.position.z, 2);
      emitTrail('rainbow', clashGroup.position.x + 0.8, clashGroup.position.y, clashGroup.position.z, 2);

      if (clp > 0.78) {
        const sw = (clp - 0.78) / 0.22;
        clashShockwave.material.opacity = (1 - sw) * 0.95;
        clashShockwave.scale.setScalar(1 + sw * 18);
        cameraPitch += Math.sin(clock * 60) * 0.04 * (1 - sw);
      }

      if (clp === 1) {
        const cb = clashState.callback;
        clashState = null;
        clashGroup.visible = false;
        cb?.();
      }
    }

    const assisted = assistedTarget();
    marker.visible = playing && !jumping && !activeEffect && !muted && recovery === 0 && !celebrationState;
    marker.position.copy(assisted);
    aimDots.forEach((dot, i) => {
      dot.visible = marker.visible;
      const t = (i + 1) / 10;
      dot.position.set(THREE.MathUtils.lerp(frogX, assisted.x, t), 0.18 + Math.sin(t * PI) * 0.5, THREE.MathUtils.lerp(frog.position.z, assisted.z, t));
    });

    for (const eye of eyes) eye.scale.y = (clock % 5.3 > 5.12 ? 0.035 : 0.19);

    const center = Math.round(progress);
    for (let i = 0; i < pads.length; i++) pads[i].visible = false;
    for (let k = center - 6; k <= center + 40; k++) {
      if (k < 0) continue;
      const padIdx = ((k % pads.length) + pads.length) % pads.length;
      const p = pads[padIdx];
      p.position.set(padX(k), 0.08 + Math.sin(clock * 1.5 + k) * 0.02, -k * STEP);
      p.rotation.y = 0.23 * Math.sin(k * 1.4);
      p.visible = true;
    }

    // Ring-buffered terrain chunks: only the chunk that drops behind is moved forward!
    const centerChunk = Math.round(frog.position.z / 24);
    for (let k = centerChunk - 6; k <= centerChunk + 15; k++) {
      const tileIdx = ((k % tiles.length) + tiles.length) % tiles.length;
      tiles[tileIdx].position.z = k * 24;
    }

    // Stylized Horizon Mountains & Drifting Clouds anchored to frog progress
    horizonGroup.position.z = frog.position.z;
    for (let i = 0; i < mistClouds.length; i++) {
      mistClouds[i].position.x = ((i - 3.5) * 44 + Math.sin(clock * 0.15 + i) * 6);
    }

    const decorBase = Math.round(progress);
    for (let i = 0; i < decor.length; i++) {
      const k = decorBase - 4 + i * 2;
      const dIdx = ((Math.floor(k / 2) % decor.length) + decor.length) % decor.length;
      const p = decor[dIdx];
      p.position.set((k % 4 === 0 ? 1 : -1) * (8.2 + Math.sin(k) * 1.5), 0.03, -k * STEP);
      p.rotation.y = k + clock * 0.025;
    }

    finishArch.position.set(padX(currentGoal), 0, -currentGoal * STEP);
    water.position.z = frog.position.z - 120;
    riverBed.position.z = frog.position.z - 120;

    for (const r of ripples) {
      r.age += dt;
      r.m.position.set(r.x ?? padX(r.index), 0.014, -r.index * STEP);
      r.m.scale.setScalar(1 + r.age * 1.8);
      r.m.material.opacity = Math.max(0, 0.5 - r.age * 0.25);
    }

    for (let i = 0; i < butterflies.length; i++) {
      const b = butterflies[i];
      b.g.position.set(Math.sin(clock * 0.22 + i) * 7, 2.6 + Math.sin(clock + i) * 0.5, frog.position.z - 8 + i * 3 + Math.cos(clock * 0.2 + i) * 4);
      b.g.rotation.y = clock * 0.3 + i;
      b.a.rotation.z = Math.sin(clock * 13 + i) * 0.7;
      b.b.rotation.z = -b.a.rotation.z;
    }

    for (let i = 0; i < activeBankFrogs.length; i++) {
      const bf = activeBankFrogs[i];
      const hop = Math.max(0, Math.sin(clock * bf.freq + bf.phase));
      bf.group.position.y = bf.baseY + Math.pow(hop, 3) * 0.28;
      bf.group.rotation.x = Math.sin(clock * bf.freq + bf.phase) * 0.15;
    }

    if (hammerStrikeAnim) {
      hammerStrikeAnim.elapsed += dt;
      const hp = Math.min(1, hammerStrikeAnim.elapsed / hammerStrikeAnim.duration);
      if (hp < 0.45) {
        const wind = hp / 0.45;
        hammerGroup.position.set(
          THREE.MathUtils.lerp(hammerStrikeAnim.startX, hammerStrikeAnim.targetX, wind),
          2.6 - wind * 1.1,
          hammerStrikeAnim.baseZ
        );
        hammerGroup.rotation.z = -0.6 + wind * 1.5;
        hammerGroup.rotation.x = -0.25;
      } else if (hp < 0.65) {
        if (!hammerStrikeAnim.impactDone) {
          hammerStrikeAnim.impactDone = true;
          emitTrail('star', frogX + 0.6, 1.8, hammerStrikeAnim.baseZ, 8);
          emitTrail('fire', frogX + 0.6, 1.8, hammerStrikeAnim.baseZ, 5);
          emitPadSplash(frogX, -progress * STEP, 14);
          if (hammerStrikeAnim.shatters) {
            effectModels.prison.visible = false;
            activeEffect = null;
            emitTrail('star', frogX, 1.6, -progress * STEP, 16);
            emitTrail('wake', frogX, 0.1, -progress * STEP, 10);
            emitPadSplash(frogX, -progress * STEP, 24);
          }
        }
        hammerGroup.position.set(hammerStrikeAnim.targetX, 1.5, hammerStrikeAnim.baseZ);
        hammerGroup.rotation.z = 0.95;
        if (effectModels.prison.visible) {
          effectModels.prison.position.x = frogX + (Math.random() - 0.5) * 0.15;
          effectModels.prison.position.y = (Math.random() - 0.5) * 0.1;
        }
      } else {
        const recoil = (hp - 0.65) / 0.35;
        hammerGroup.position.y = 1.5 + recoil * 0.7;
        hammerGroup.rotation.z = 0.95 - recoil * 0.45;
        if (effectModels.prison.visible) {
          effectModels.prison.position.set(frogX, 0, -progress * STEP);
        }
        if (hp >= 1) {
          hammerGroup.visible = false;
          hammerStrikeAnim = null;
          if (effectModels.prison.visible) {
            effectModels.prison.position.set(frogX, 0, -progress * STEP);
          }
        }
      }
    }

    for (const particle of effectTrails) {
      if (!particle.m.visible) continue;
      particle.age += dt;
      particle.y += dt * 0.5;
      particle.z += dt * 1.8;
      particle.m.position.set(particle.x, particle.y, particle.z);
      const left = 1 - particle.age / particle.life;
      particle.m.material.opacity = Math.max(0, left * 0.85);
      particle.m.scale.setScalar(Math.max(0.01, left * 0.65));
      if (left <= 0) particle.m.visible = false;
    }

    // Update river water wake ripples (dalgalar)
    for (const w of waterWakeRings) {
      if (!w.m.visible) continue;
      w.age += dt;
      if (w.age >= w.life) {
        w.m.visible = false;
        continue;
      }
      const progress = w.age / w.life;
      const alpha = Math.max(0, (1 - progress) * 0.75);
      w.m.material.opacity = alpha;
      w.x += w.vx * dt;
      w.z += dt * 0.3;
      w.m.position.set(w.x, w.y, w.z);
      const currentScale = w.baseScale * (1 + progress * 3.4);
      w.m.scale.set(currentScale * (1 + progress * 0.4), 1, currentScale);
    }

    // Update river water foam (su izi & köpükler)
    for (const f of waterFoamPool) {
      if (!f.m.visible) continue;
      f.age += dt;
      if (f.age >= f.life) {
        f.m.visible = false;
        continue;
      }
      const progress = f.age / f.life;
      f.m.material.opacity = Math.max(0, (1 - progress) * 0.7);
      f.x += f.vx * dt;
      f.m.position.set(f.x, f.y, f.z);
      const sc = 0.6 + progress * 0.8;
      f.m.scale.set(sc, 1, sc);
    }

    normals.offset.y = (normals.offset.y + dt * 0.12) % 1;
    normals.offset.x = (normals.offset.x + dt * 0.03) % 1;

    // Dynamic Overhead Distance Counter right above frog head
    if (overheadSprite) {
      overheadSprite.position.set(frog.position.x, frog.position.y + 1.95, frog.position.z);
      overheadSprite.visible = playing && !celebrationState;
      const remMeters = Math.max(0, Math.round(currentGoal - progress));
      if (remMeters !== lastOverheadMeters) {
        lastOverheadMeters = remMeters;
        drawOverheadBadge(remMeters);
      }
    }

    pose();
    renderer.render(scene, camera);
    frames++;
    if (now - fpsStart > 1000) {
      fps = (frames * 1000) / (now - fpsStart);
      frames = 0;
      fpsStart = now;
    }
    window.__frogDiagnostics = {
      fps: Math.round(fps),
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      progress,
      jumping,
      webgl: true,
      frogX,
      targetX,
      miss,
      recovery,
      safeX,
      safeProgress,
      frogY: frog.position.y,
      cameraYaw,
      cameraPitch,
      female: femaleBow.visible,
      effect: activeEffect?.type || '',
      aim: { x: aim.x, z: aim.z },
      prisonActive: activeEffect?.type === 'prison'
    };
  }

  requestAnimationFrame(render);

  return {
    direction(x, z) {
      if (!x && !z) return;
      lastPlayerActivity = performance.now();
      const length = Math.hypot(x, z), frogZ = -progress * STEP;
      const localX = x / length, localZ = z / length;
      const worldX = localX * Math.cos(cameraYaw) + localZ * Math.sin(cameraYaw);
      const worldZ = localZ * Math.cos(cameraYaw) - localX * Math.sin(cameraYaw);
      aim.set(THREE.MathUtils.clamp(frogX + worldX * STEP, -10, 10), 0.12, frogZ + worldZ * STEP);
    },
    character(type) {
      femaleMode = type === 'female';
      femaleBow.visible = femaleMode;
      femaleFlower.visible = femaleMode;
      femaleCheeks.visible = femaleMode;
      femaleEyelashes.visible = femaleMode;
      maleScarf.visible = !femaleMode;
      maleHat.visible = !femaleMode;
      tongue.visible = !femaleMode;
      skin.color.setHex(femaleMode ? 0x72c954 : 0x5da829);
      belly.color.setHex(femaleMode ? 0xf7fae1 : 0xf0f7ba);
      frog.scale.set(1.12 * (femaleMode ? 0.9 : 1), 1.12, 1.12);
      updatePartnerAppearance(femaleMode);
    },
    celebrateFinish(char, cb) {
      startCelebrationDance(char, cb);
    },
    cancelCelebration() {
      if (celebrationState) {
        celebrationState = null;
        partnerFrog.visible = false;
        frog.position.set(frogX, 0, -progress * STEP);
        frog.rotation.set(0, heading, 0);
        arms.forEach(a => a.rotation.set(0, 0, 0));
        legs.forEach(l => l.rotation.set(0, 0, 0));
      }
    },
    clash(duelData, cb) {
      start3DClash(duelData, cb);
    },
    setGoal(n) {
      currentGoal = n;
      finishArch.position.set(padX(currentGoal), 0, -currentGoal * STEP);
      lastOverheadMeters = -999;
    },
    isPrisonActive() {
      return activeEffect?.type === 'prison';
    },
    bonkPrison() {
      if (activeEffect?.type === 'prison') {
        prisonBonking = 1.0;
      }
    },
    releasePrison() {
      if (activeEffect?.type === 'prison') {
        activeEffect = null;
        effectModels.prison.visible = false;
      }
    },
    strikeHammer(reduction, shatters) {
      triggerHammerStrike(reduction, shatters);
    },
    jump(callback) {
      lastPlayerActivity = performance.now();
      if (activeEffect?.type === 'prison') {
        this.bonkPrison();
        return false;
      }
      if (jumping || activeEffect || recovery > 0 || celebrationState || clashState) return false;
      from = progress;
      to = Math.round(from) + 1;
      startX = frogX;
      // Allow landing anywhere on the natural lotus pad surface without snapping/pulling to center
      const padCenter = padX(to);
      const currentOffset = THREE.MathUtils.clamp(frogX - padX(from), -1.15, 1.15);
      const steerBias = aim ? THREE.MathUtils.clamp(aim.x - padCenter, -1.2, 1.2) * 0.35 : 0;
      targetX = THREE.MathUtils.clamp(padCenter + currentOffset * 0.65 + steerBias, padCenter - 1.25, padCenter + 1.25);
      const targetZ = -to * STEP;
      const frogZ = -progress * STEP;
      heading = Math.atan2(targetX - startX, targetZ - frogZ);
      miss = false;
      jumpDuration = 0.42;
      jumpStyle = (jumpStyle + 1) % 3;
      jumpTime = 0;
      jumping = true;
      landed = false;
      takeoffSplashDone = false;
      done = callback;
      return true;
    },
    effect(type, { distance = 0, duration = 2 } = {}, callback) {
      if (activeEffect?.type === 'prison' && type === 'prison') {
        activeEffect.duration += Math.max(1, duration);
        return true;
      }
      if (jumping || recovery > 0 || !effectModels[type] || celebrationState || clashState) return false;
      if (activeEffect) {
        Object.values(effectModels).forEach(x => { x.visible = false; });
        tsunamiWave.visible = false;
        slipperImpact.visible = false;
      }
      const direction = ['slipper', 'meteor', 'crocodile', 'stork'].includes(type) ? -1 : ['rocket', 'turtle', 'rainbow', 'boat'].includes(type) ? 1 : 0;
      const target = Math.max(0, progress + direction * Math.max(0, distance));
      activeEffect = {
        type,
        elapsed: 0,
        duration: Math.max(0.8, duration),
        start: progress,
        target,
        move: direction !== 0,
        impact: false,
        landed: false,
        done: callback
      };
      heading = PI;
      return true;
    },
    busy() {
      return Boolean(jumping || activeEffect || recovery > 0 || celebrationState || clashState);
    },
    setProgress(n) {
      lastOverheadMeters = -999;
      progress = safeProgress = n;
      frogX = safeX = padX(n);
      frog.position.z = -n * STEP;
      aim.set(frogX, 0.12, frog.position.z - STEP);
      recovery = 0;
      jumping = false;
      activeEffect = null;
      celebrationState = null;
      clashState = null;
      clashGroup.visible = false;
      Object.values(effectModels).forEach(x => { x.visible = false; });
      tsunamiWave.visible = false;
      slipperImpact.visible = false;
      frog.position.y = 0;
      frog.rotation.set(0, heading, 0);
      frog.scale.set(1.12 * (femaleMode ? 0.9 : 1), 1.12, 1.12);
      legs.forEach(l => { l.rotation.x = 0; l.scale.z = 1; l.position.z = 0; });
      arms.forEach(a => { a.rotation.set(0, 0, 0); });
    },
    updateOverhead() {
      lastOverheadMeters = -999;
    },
    setPlaying(v) {
      playing = v;
      lastPlayerActivity = performance.now();
    },
    pause(v) { muted = v; },
    zoom(v) { zoom = v; },
    quality(q) {
      qualityMode = q;
      const ratio = q === 'high' ? 1.75 : q === 'low' ? 1 : 1.25;
      renderer.setPixelRatio(Math.min(devicePixelRatio, ratio));
      renderer.shadowMap.enabled = q !== 'low';
      sun.castShadow = q !== 'low';
      sun.shadow.mapSize.set(q === 'high' ? 1024 : 512, q === 'high' ? 1024 : 512);
      scene.fog.near = q === 'high' ? 100 : q === 'low' ? 54 : 85;
      scene.fog.far = q === 'high' ? 235 : q === 'low' ? 120 : 195;
      renderer.toneMappingExposure = q === 'high' ? 1.12 : q === 'low' ? 1 : 1.08;
      resize();
    },
    getProgress() {
      return progress;
    },
    setOnProgress(cb) {
      onProgressCallback = cb;
    },
    _scene: scene,
    _tsunamiWave: tsunamiWave,
    _camera: camera,
    _frog: frog,
    _getActiveEffect: () => activeEffect
  };
}
