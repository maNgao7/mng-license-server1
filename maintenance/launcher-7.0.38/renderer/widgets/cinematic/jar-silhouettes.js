export function drawJarSkin(ctx, shape, { x = 0, y = 0, width = 300, height = 400, tint = '#82e9ed', layer = 'front' } = {}) {
  if (!['bell', 'lantern'].includes(shape)) return false;
  ctx.save(); ctx.translate(x, y); ctx.scale(width / 300, height / 400);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const stroke = (color, lineWidth, draw) => { ctx.beginPath(); draw(); ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.stroke(); };
  const glass = () => {
    ctx.moveTo(35, 346); ctx.lineTo(35, 175);
    if (shape === 'bell') { ctx.bezierCurveTo(35, 12, 265, 12, 265, 175); ctx.lineTo(265, 346); }
    else { ctx.lineTo(58, 103); ctx.lineTo(150, 76); ctx.lineTo(242, 103); ctx.lineTo(265, 175); ctx.lineTo(265, 346); }
    ctx.closePath();
  };
  if (layer === 'back') {
    ctx.beginPath(); glass(); ctx.globalAlpha = .07; ctx.fillStyle = tint; ctx.fill();
    ctx.globalAlpha = 1; stroke('#c1f3f666', 1.5, glass);
    ctx.restore(); return true;
  }
  const metal = ctx.createLinearGradient(20, 0, 280, 0);
  metal.addColorStop(0, '#738a91'); metal.addColorStop(.18, '#f3fcff'); metal.addColorStop(.42, '#bfdce0'); metal.addColorStop(.58, '#ffffff'); metal.addColorStop(1, '#66898c');
  const gold = ctx.createLinearGradient(25, 0, 270, 0);
  gold.addColorStop(0, '#9b6620'); gold.addColorStop(.23, '#ffed9c'); gold.addColorStop(.5, '#d6a635'); gold.addColorStop(.72, '#fff4b1'); gold.addColorStop(1, '#966020');
  if (shape === 'bell') {
    stroke(metal, 4.5, glass);
    stroke('#ffffffbd', 3, () => { ctx.moveTo(47, 324); ctx.lineTo(47, 180); ctx.bezierCurveTo(47, 106, 73, 73, 99, 62); });
    stroke('#a6eff08c', 2, () => { ctx.moveTo(253, 330); ctx.lineTo(253, 175); ctx.bezierCurveTo(253, 117, 233, 84, 216, 71); });
    stroke('#ffffff99', 8, () => { ctx.moveTo(65, 177); ctx.bezierCurveTo(64, 133, 76, 108, 88, 95); });
    ctx.fillStyle = gold; ctx.beginPath(); ctx.ellipse(150, 27, 14, 10, 0, 0, Math.PI*2); ctx.fill();
    stroke('#fff2bd', 2, () => { ctx.ellipse(150, 26, 9, 5, 0, 0, Math.PI*2); });
    ctx.fillStyle = metal; ctx.beginPath(); ctx.ellipse(150, 350, 134, 9, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#e7fcff'; ctx.beginPath(); ctx.ellipse(150, 348, 127, 7, 0, 0, Math.PI*2); ctx.fill();
    stroke('#73c6ca', 1.5, () => ctx.ellipse(150, 348, 126, 7, 0, 0, Math.PI*2));
  } else {
    stroke(gold, 4, glass);
    stroke(gold, 6, () => { ctx.moveTo(35, 175); ctx.lineTo(75, 115); ctx.lineTo(150, 137); ctx.lineTo(225, 115); ctx.lineTo(265, 175); });
    for (const [xx, yy] of [[75,115],[150,137],[225,115]]) stroke(gold, xx === 150 ? 3 : 4, () => { ctx.moveTo(xx, yy); ctx.lineTo(xx, 345); });
    stroke('#f4ffff99', 2, () => { ctx.moveTo(85, 149); ctx.lineTo(85, 310); ctx.moveTo(232, 154); ctx.lineTo(232, 294); });
    stroke(gold, 6, () => { ctx.moveTo(35, 346); ctx.lineTo(75, 353); ctx.lineTo(225, 353); ctx.lineTo(265, 346); });
    stroke('#ffffda', 1.5, () => { ctx.moveTo(75, 353); ctx.lineTo(150, 347); ctx.lineTo(225, 353); });
    stroke(gold, 5, () => { ctx.moveTo(59, 103); ctx.lineTo(111, 57); ctx.lineTo(189, 57); ctx.lineTo(241, 103); });
    stroke(gold, 4, () => ctx.ellipse(150, 41, 24, 26, 0, 0, Math.PI*2));
    stroke('#fff9d1', 1.5, () => { ctx.moveTo(115, 60); ctx.lineTo(71, 101); ctx.moveTo(153, 76); ctx.lineTo(153, 135); });
    for (const xx of [72, 228]) { ctx.fillStyle = gold; ctx.fillRect(xx-9, 352, 18, 7); }
  }
  ctx.restore(); return true;
}
export const JAR_SKINS = Object.freeze(['bell', 'lantern']);

export const JAR_MASCOTS = Object.freeze(['cat', 'bear', 'butterfly', 'duck', 'chicken']);
const mascotAtlas = typeof Image === 'undefined' ? null : new Image();
const mascotMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
if (mascotAtlas) mascotAtlas.src = new URL('assets/jar-mascots-animated-v3.png', import.meta.url).href;

export function jarMascotPose(kind, time, excited = false, reduced = false) {
  const durations = { cat: 230, bear: 290, butterfly: 105, duck: 185, chicken: 680 };
  const sequences = { cat: [0, 1, 2, 3], bear: [0, 1, 2, 3, 2, 1], butterfly: [0, 1, 2, 3], duck: [0, 1, 2, 3], chicken: [0, 0, 1, 0, 2, 3, 0, 0] };
  if (!Object.hasOwn(sequences, kind)) return null;
  const clock = reduced ? 0 : Math.max(0, Number(time) || 0) * (excited ? 1.35 : 1);
  const sequence = sequences[kind], frame = sequence[Math.floor(clock / durations[kind]) % sequence.length];
  return { frame, x: reduced ? 0 : ['cat', 'duck'].includes(kind) ? Math.sin(clock / 1700) * 24 : 0,
    y: reduced ? 0 : kind === 'butterfly' ? Math.sin(clock / 480) * 13 : ['cat', 'duck'].includes(kind) ? -Math.abs(Math.sin(clock / durations[kind] * Math.PI)) * 3 : Math.sin(clock / 520) * 1.5,
    angle: reduced ? 0 : kind === 'duck' ? Math.sin(clock / durations[kind] * Math.PI) * .045 : 0 };
}

export function drawJarMascot(ctx, kind, { x = 450, y = 405, time = 0, scale = 1, excited = false } = {}) {
  if (!JAR_MASCOTS.includes(kind)) return false;
  const phase = time / 210, step = Math.sin(phase) * 4, bob = Math.abs(Math.sin(phase)) * 3;
  const colors = { cat: ['#efaa72', '#fff0d5'], bear: ['#a87961', '#f7dfc5'], butterfly: ['#ed83bd', '#82e9ed'], duck: ['#ffd75d', '#fff2b3'], chicken: ['#fff3d5', '#ec8e60'] };
  const [coat, light] = colors[kind];
  ctx.save(); ctx.translate(x, y - bob); ctx.scale(scale, scale); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (mascotAtlas?.complete && mascotAtlas.naturalWidth) {
    const row = JAR_MASCOTS.indexOf(kind), width = mascotAtlas.naturalWidth / 4, height = mascotAtlas.naturalHeight / 5;
    const pose = jarMascotPose(kind, time, excited, mascotMotion?.matches);
    ctx.translate(pose.x, pose.y + bob); ctx.rotate(pose.angle);
    ctx.drawImage(mascotAtlas, pose.frame * width, row * height, width, height, -55, -65, 110, 115);
    ctx.restore(); return true;
  }
  const fill = (color, draw) => { ctx.beginPath(); draw(); ctx.fillStyle = color; ctx.fill(); };
  const stroke = (color, width, draw) => { ctx.beginPath(); draw(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); };
  const oval = (cx, cy, rx, ry, color) => fill(color, () => ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2));
  ctx.fillStyle = '#06131b44'; ctx.beginPath(); ctx.ellipse(0, 50, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
  if (kind === 'butterfly') {
    const flap = Math.sin(time / 95) * .28;
    ctx.save(); ctx.translate(-9, -4); ctx.rotate(-.34 - flap); oval(-15, -7, 19, 24, '#f7b6d7'); oval(-16, 20, 14, 18, '#c8b5ff'); ctx.restore();
    ctx.save(); ctx.translate(9, -4); ctx.rotate(.34 + flap); oval(15, -7, 19, 24, '#a4eced'); oval(16, 20, 14, 18, '#ffe49c'); ctx.restore();
    oval(0, 8, 8, 30, '#704a65'); oval(0, -15, 14, 14, coat); oval(-5, -17, 2.5, 3, '#17252b'); oval(5, -17, 2.5, 3, '#17252b');
    stroke('#704a65', 2, () => { ctx.moveTo(-4, -27); ctx.quadraticCurveTo(-18, -42, -22, -32); ctx.moveTo(4, -27); ctx.quadraticCurveTo(18, -42, 22, -32); });
  } else {
    oval(-19, 39 + step, 8, 5, '#ef9165'); oval(19, 39 - step, 8, 5, '#ef9165');
    oval(0, 18, 34, 30, coat);
    if (kind === 'cat') { fill(coat, () => { ctx.moveTo(-28, -3); ctx.lineTo(-28, -35); ctx.lineTo(-5, -19); ctx.closePath(); }); fill(coat, () => { ctx.moveTo(28, -3); ctx.lineTo(28, -35); ctx.lineTo(5, -19); ctx.closePath(); }); oval(-18, -8, 9, 10, light); oval(18, -8, 9, 10, light); oval(-4, -1, 2.4, 4, '#28333a'); oval(4, -1, 2.4, 4, '#28333a'); oval(0, 7, 3, 2, '#d66c78'); stroke('#77524b', 1.5, () => { ctx.moveTo(-2, 10); ctx.quadraticCurveTo(0, 16, 3, 10); ctx.moveTo(-24, 8); ctx.lineTo(-38, 5); ctx.moveTo(24, 8); ctx.lineTo(38, 5); }); }
    else if (kind === 'bear') { oval(-26, -9, 11, 12, coat); oval(26, -9, 11, 12, coat); oval(-26, -9, 5, 6, '#e8b79b'); oval(26, -9, 5, 6, '#e8b79b'); oval(-11, 1, 3, 4, '#253039'); oval(11, 1, 3, 4, '#253039'); oval(0, 12, 13, 9, light); oval(0, 9, 4, 3, '#453534'); stroke('#684e47', 2, () => { ctx.moveTo(-4, 16); ctx.quadraticCurveTo(0, 21, 4, 16); }); }
    else if (kind === 'duck') { oval(-12, -7, 9, 7, '#fff'); oval(12, -7, 9, 7, '#fff'); oval(-11, -7, 2.8, 4, '#26313a'); oval(11, -7, 2.8, 4, '#26313a'); fill('#f28d46', () => { ctx.moveTo(-2, 1); ctx.lineTo(21, 4); ctx.lineTo(-2, 9); ctx.closePath(); }); stroke('#e49049', 4, () => { ctx.moveTo(-19, 12); ctx.lineTo(-8, 15); }); }
    else { oval(-26, -9, 8, 12, coat); oval(26, -9, 8, 12, coat); oval(-11, 0, 3, 4, '#26313a'); oval(11, 0, 3, 4, '#26313a'); fill('#e77a55', () => { ctx.moveTo(-8, -24); ctx.quadraticCurveTo(-12, -39, -4, -34); ctx.quadraticCurveTo(2, -45, 5, -31); ctx.quadraticCurveTo(15, -37, 13, -24); ctx.closePath(); }); fill('#edaa58', () => { ctx.moveTo(0, 8); ctx.lineTo(20, 12); ctx.lineTo(1, 16); ctx.closePath(); }); }
  }
  if (kind === 'chicken' && Math.sin(time / 850) > .86) { const eggY = 52 + Math.max(0, Math.sin(time / 850) - .86) * 25; oval(31, eggY, 6, 8, '#fff9e9'); stroke('#d5c5a0', 1, () => ctx.ellipse(31, eggY, 6, 8, 0, 0, Math.PI * 2)); }
  ctx.restore(); return true;
}

