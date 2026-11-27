import * as T from './three.module.js';

export const CHARACTER_MOTIFS = Object.freeze(['dragon', 'wolf', 'lion', 'serpent', 'butterfly', 'turtle', 'rabbit']);
const columns = { dragon: 0, wolf: 1, lion: 2, serpent: 3 };
const clamp = n => Math.max(0, Math.min(1, n));
export function characterMotion(elapsed, motif, reduced = false) {
    const t = Math.max(0, elapsed) / 1000;
    if (reduced) return { expression: 0, head: 0, wings: 0, blink: 0, slither: 0, hop: 0, breath: 0 };
    const roar = Math.exp(-(((t % 3.4 - 1.65) / .67) ** 4));
    return { expression: roar, head: Math.sin(t * 1.45) * .045,
        wings: Math.sin(t * (motif === 'butterfly' ? 10 : 3.7)) * .65,
        blink: Math.exp(-(((t % 3.1 - 2.45) / .085) ** 2)),
        slither: Math.sin(t * 2.1) * .35, hop: Math.abs(Math.sin(t * 2.7)) * .6,
        breath: Math.sin(t * 2.4) * .012 };
}

export function createPKCharacterRig(motif, { artMesh, colors, low = false }) {
    if (!CHARACTER_MOTIFS.includes(motif)) throw new RangeError('Unknown PK character');
    const group = new T.Group(), wings = [], deformers = [];
    group.name = 'articulated-' + motif;
    let neutral = null, expression = null, body = null;
    if (Object.hasOwn(columns, motif)) {
        const x = columns[motif] / 4;
        neutral = artMesh('pk-expressions-v2.png', 'expressionAsset', [x, .5, .25, .5], 3.7, 6.3, colors);
        expression = artMesh('pk-expressions-v2.png', 'expressionAsset', [x, 0, .25, .5], 3.7, 6.3, colors);
        expression.material.uniforms.uAlpha.value = 0;
        neutral.name = motif + '-calm'; expression.name = motif + '-expression';
        expression.position.z = .012; group.add(neutral, expression);
        if (motif === 'wolf') {
            neutral.material.uniforms.uEyeA.value.set(.53, .65);
            neutral.material.uniforms.uEyeB.value.set(.82, .64);
        }
        for (const mesh of [neutral, expression]) {
            const p = mesh.geometry.attributes.position;
            deformers.push({ mesh, original: Float32Array.from(p.array) });
        }
    } else if (motif === 'butterfly') {
        for (const sign of [-1, 1]) {
            const pivot = new T.Group();
            const wing = artMesh('pk-companions-v1.png', 'companionAsset', [sign < 0 ? 0 : 1 / 6, 0, 1 / 6, 1], 2.5, 5, colors);
            wing.position.x = sign * 1.25; pivot.add(wing); group.add(pivot); wings.push({ pivot, sign });
        }
    } else {
        body = artMesh('pk-companions-v1.png', 'companionAsset', [motif === 'turtle' ? 1 / 3 : 2 / 3, 0, 1 / 3, 1], 5.6, 5.6, colors);
        body.name = motif + '-body'; group.add(body);
        deformers.push({ mesh: body, original: Float32Array.from(body.geometry.attributes.position.array) });
    }
    if (motif === 'dragon') {
        for (const sign of [-1, 1]) {
            const pivot = new T.Group(); pivot.position.set(sign * .95, -.15, -.4); group.add(pivot);
            const wing=artMesh('pk-dragon-wings-v1.png','wingAsset',[sign<0?0:.5,0,.5,1],3.8,3.8,colors);
            wing.name=sign<0?'dragon-left-wing':'dragon-right-wing';wing.position.set(sign*1.7,1.15,-.2);pivot.add(wing);
            wings.push({ pivot, sign });
        }
    }
    let lastMotion = characterMotion(0, motif, true);
    function update(elapsed, reduced) {
        const t = elapsed / 1000, m = characterMotion(elapsed, motif, reduced); lastMotion = m;
        if (expression) {
            const blend = clamp(m.expression * 1.6 - .15);
            expression.material.uniforms.uAlpha.value = blend;
            neutral.material.uniforms.uAlpha.value = 1 - blend;
            neutral.material.uniforms.uBlink.value = motif === 'wolf' ? m.blink : 0;
            group.rotation.set(0, m.head * 1.7, m.head * .55);
            group.position.set(motif === 'serpent' ? m.slither : 0, 1.55 + m.breath * 3, -.3);
            group.scale.setScalar(1 + m.breath);
        } else {
            group.position.set(motif === 'butterfly' ? Math.sin(t * 1.3) * .65 : motif === 'rabbit' ? Math.sin(t * 1.1) * .4 : Math.sin(t) * .2,
                1.25 + (reduced ? 0 : motif === 'rabbit' ? m.hop : Math.sin(t * 1.9) * .28), -.15);
            group.rotation.z = motif === 'rabbit' ? m.head * 2 : m.head;
        }
        for (const { pivot, sign } of wings) {
            pivot.rotation.y = sign * m.wings;
            pivot.rotation.z = sign * m.wings * .12;
        }
        for (const { mesh, original } of deformers) {
            const positions = mesh.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const k = i * 3, x = original[k], y = original[k + 1], z = original[k + 2];
                let dx = 0, dy = 0, dz = 0;
                if (!reduced && motif === 'serpent') { dx = Math.sin(y * 1.45 - t * 3) * .19 * (1 - clamp((y + 2) / 5)); dz = Math.cos(y * 2 - t * 3) * .12; }
                if (!reduced && motif === 'turtle') { const flipper = clamp((Math.abs(x) - .9) / 1.5); dy = Math.sin(t * 3.4 + Math.sign(x)) * flipper * .38; dz = Math.cos(t * 3.4 + Math.sign(x)) * flipper * .27; }
                if (!reduced && motif === 'rabbit' && y > 1) { dx = Math.sin(t * 4.2) * clamp((y - 1) / 2) * .17; }
                if (!reduced && motif === 'lion') { const mane = clamp((Math.abs(x) - .9) / .9); dx = Math.sin(y * 5 - t * 2.5) * mane * .04; }
                positions.setXYZ(i, x + dx, y + dy, z + dz);
            }
            positions.needsUpdate = true;
        }
        return m;
    }
    return { group, update, getState: () => ({ motif, wingCount: wings.length, ...lastMotion }) };
}
