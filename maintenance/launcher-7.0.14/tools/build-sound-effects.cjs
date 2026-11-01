'use strict';

// Original oscillator/noise designs for TikMnG. No samples, models or dependencies.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SAMPLE_RATE = 32000;
const TAU = 2 * Math.PI;
const ASSET_ROOT = path.resolve(__dirname, '../renderer/assets/sound-effects');

function sine(frequency, time) {
    return Math.sin(TAU * frequency * time);
}

function glide(time, duration, from, to) {
    const ratio = Math.log(to / from);
    return TAU * (ratio === 0 ? from * time : from * duration * Math.expm1(ratio * time / duration) / ratio);
}

function triangle(phase) {
    return (2 / Math.PI) * Math.asin(Math.sin(phase));
}

function brass(phase) {
    return Math.sin(phase) + 0.32 * Math.sin(2 * phase) + 0.13 * Math.sin(3 * phase);
}

function random(seed) {
    let state = seed >>> 0;
    return () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return (state >>> 0) / 0x80000000 - 1;
    };
}

function noise(seed, cutoff = 0.25) {
    const next = random(seed);
    let low = 0;
    let slow = 0;
    return () => {
        low += cutoff * (next() - low);
        slow += 0.018 * (low - slow);
        return low - slow;
    };
}

function layer(output, start, duration, render, { gain = 1, attack = 0.004, release = 0.06, decay = 0 } = {}) {
    const offset = Math.round(start * SAMPLE_RATE);
    const count = Math.min(Math.round(duration * SAMPLE_RATE), output.length - offset);
    for (let i = 0; i < count; i++) {
        const t = i / SAMPLE_RATE;
        const fadeIn = Math.sin(Math.min(1, t / attack) * Math.PI / 2) ** 2;
        const fadeOut = Math.sin(Math.min(1, (count - 1 - i) / (release * SAMPLE_RATE)) * Math.PI / 2) ** 2;
        output[offset + i] += gain * fadeIn * fadeOut * Math.exp(-decay * t) * render(t);
    }
}

function echo(output, delay, gain) {
    const offset = Math.round(delay * SAMPLE_RATE);
    // Reverse iteration makes this a single reflection, not a feedback loop.
    for (let i = output.length - 1; i >= offset; i--) output[i] += gain * output[i - offset];
}

const DESIGNS = [
    {
        id: 'gift-chime', title: 'Hediye bildirimi', category: 'Hediyeler', duration: 0.96,
        description: 'Four bright glass droplets bloom into a soft sparkling tail for a received gift.',
        synthesis: 'Inharmonic sine partials at 784, 1176, 1568 and 2093 Hz; staggered strikes and short reflections.',
        render(out) {
            [784, 1176, 1568, 2093].forEach((f, i) => {
                layer(out, i * 0.09, 0.67, t => sine(f, t) + 0.27 * sine(f * 2.713, t) * Math.exp(-12 * t),
                    { gain: 0.48 - i * 0.055, attack: 0.002, release: 0.18, decay: 5.6 });
            });
            echo(out, 0.047, 0.17);
            echo(out, 0.101, 0.12);
        }
    },
    {
        id: 'success', title: 'Zafer', category: 'Sonuçlar', duration: 0.78,
        description: 'A quick warm brass lift resolves into one compact celebratory chord.',
        synthesis: 'Soft additive brass strikes, two rising pickups and a three-voice final hit with low reinforcement.',
        render(out) {
            layer(out, 0, 0.18, t => brass(TAU * 440 * t), { gain: 0.26, decay: 7 });
            layer(out, 0.13, 0.19, t => brass(TAU * 587.33 * t), { gain: 0.3, decay: 7 });
            [659.25, 880, 1108.73].forEach(f => {
                layer(out, 0.28, 0.5, t => brass(TAU * f * t), { gain: 0.23, release: 0.16, decay: 4.8 });
            });
            layer(out, 0.28, 0.32, t => sine(220, t), { gain: 0.17, decay: 9 });
        }
    },
    {
        id: 'fail', title: 'Kaybetme', category: 'Sonuçlar', duration: 0.88,
        description: 'A rubbery low pitch collapses with a wobble and a quiet dry rattle.',
        synthesis: 'Descending 310-to-73 Hz triangle glide, phase vibrato and seeded band-limited rattle.',
        render(out) {
            layer(out, 0, 0.8, t => triangle(glide(t, 0.8, 310, 73) + 0.8 * sine(9.5, t)),
                { gain: 0.7, attack: 0.009, release: 0.19, decay: 1.7 });
            const rattle = noise(0x5f31a84d, 0.12);
            layer(out, 0.36, 0.4, t => rattle() * (0.35 + 0.65 * sine(27, t) ** 2),
                { gain: 0.24, release: 0.13, decay: 6 });
        }
    },
    {
        id: 'countdown', title: 'Geri sayım', category: 'Zamanlayıcılar', duration: 1.4,
        description: 'Three evenly spaced clock pips end in a brighter, longer go signal.',
        synthesis: 'Three 760 Hz sine/triangle pips at 320 ms intervals; final 1520/2280 Hz go pair.',
        render(out) {
            [0, 0.32, 0.64].forEach(start => {
                layer(out, start, 0.115, t => sine(760, t) + 0.18 * triangle(TAU * 1520 * t),
                    { gain: 0.44, attack: 0.003, release: 0.035, decay: 4 });
            });
            layer(out, 0.96, 0.44, t => sine(1520, t) + 0.22 * sine(2280, t),
                { gain: 0.6, attack: 0.004, release: 0.16, decay: 4.2 });
        }
    },
    {
        id: 'turbo', title: 'Turbo', category: 'Güçlendirmeler', duration: 0.92,
        description: 'An accelerating engine buzz rushes upward through a grainy air sweep.',
        synthesis: 'Three-harmonic exponential 95-to-1850 Hz sweep, accelerating pulse envelope and filtered seeded noise.',
        render(out) {
            layer(out, 0, 0.88, t => {
                const phase = glide(t, 0.88, 95, 1850);
                const pulse = 0.55 + 0.45 * sine(5 + 14 * t, t) ** 2;
                return brass(phase) * pulse;
            }, { gain: 0.5, attack: 0.025, release: 0.11 });
            const air = noise(0x62d391f7, 0.48);
            layer(out, 0.04, 0.88, t => air() * (0.3 + t), { gain: 0.43, attack: 0.2, release: 0.14 });
            echo(out, 0.028, 0.14);
        }
    },
    {
        id: 'dramatic-sting', title: 'Gerilim', category: 'Dramatik', duration: 1.2,
        description: 'A deep synthetic impact supports a tense metallic stab and a dark tail.',
        synthesis: '105-to-39 Hz descending kick, dissonant 146.83/155.56/220 Hz FM voices and a seeded noise impact.',
        render(out) {
            layer(out, 0, 0.85, t => Math.sin(glide(t, 0.85, 105, 39)),
                { gain: 0.65, attack: 0.002, release: 0.22, decay: 5.2 });
            [146.83, 155.56, 220].forEach((f, i) => {
                layer(out, 0.018, 1.12, t => Math.sin(TAU * f * t + 2.4 * Math.exp(-3.5 * t) * sine(f * 2.17, t)),
                    { gain: 0.22 - i * 0.025, attack: 0.005, release: 0.32, decay: 3.8 });
            });
            const impact = noise(0x49f1c8b3, 0.6);
            layer(out, 0, 0.23, () => impact(), { gain: 0.43, attack: 0.001, release: 0.07, decay: 24 });
            echo(out, 0.093, 0.16);
            echo(out, 0.157, 0.1);
        }
    },
    {
        id: 'alert', title: 'Yayın uyarısı', category: 'Bildirimler', duration: 0.68,
        description: 'Two crisp alternating electronic double-pulses cut through a busy stream.',
        synthesis: 'Four separated 920/1360 Hz odd-harmonic pulses with short rounded gates.',
        render(out) {
            [920, 1360, 920, 1360].forEach((f, i) => {
                layer(out, [0, 0.115, 0.35, 0.465][i], 0.16,
                    t => sine(f, t) + 0.2 * sine(3 * f, t) + 0.07 * sine(5 * f, t),
                    { gain: 0.45, attack: 0.004, release: 0.04, decay: 2 });
            });
        }
    },
    {
        id: 'coin', title: 'Coin', category: 'Ödüller', duration: 0.42,
        description: 'A tiny double metallic ping jumps upward and rings out quickly.',
        synthesis: '1180/1730 Hz sine strikes with decaying 3.41-ratio FM overtones; offset by 67 ms.',
        render(out) {
            [1180, 1730].forEach((f, i) => {
                layer(out, i * 0.067, 0.35, t => Math.sin(TAU * f * t + 1.2 * Math.exp(-30 * t) * sine(f * 3.41, t)),
                    { gain: i ? 0.62 : 0.39, attack: 0.0015, release: 0.08, decay: 12 });
            });
        }
    },
    {
        id: 'bubble-pop', title: 'Baloncuk', category: 'Oyun efektleri', duration: 0.24,
        description: 'A short hollow bubble plop with a tiny breathy snap.',
        synthesis: 'Curved 920-to-125 Hz sine drop, weak subharmonic and a 22 ms filtered noise transient.',
        render(out) {
            layer(out, 0, 0.23, t => Math.sin(glide(t, 0.23, 920, 125)) + 0.15 * Math.sin(glide(t, 0.23, 460, 62.5)),
                { gain: 0.75, attack: 0.001, release: 0.09, decay: 16 });
            const snap = noise(0x7ba5ce91, 0.72);
            layer(out, 0.003, 0.022, () => snap(), { gain: 0.24, attack: 0.001, release: 0.01, decay: 55 });
        }
    },
    {
        id: 'laser-zap', title: 'Lazer', category: 'Oyun efektleri', duration: 0.5,
        description: 'A sharp sci-fi shot falls through a resonant, lightly echoed tail.',
        synthesis: '2600-to-180 Hz exponential phase-modulated sweep, 37 Hz amplitude ripple and two short echoes.',
        render(out) {
            layer(out, 0, 0.41, t => {
                const phase = glide(t, 0.41, 2600, 180);
                return Math.sin(phase + 1.35 * Math.exp(-9 * t) * Math.sin(phase * 0.73)) * (0.78 + 0.22 * sine(37, t));
            }, { gain: 0.65, attack: 0.0015, release: 0.12, decay: 6 });
            echo(out, 0.051, 0.24);
            echo(out, 0.087, 0.13);
        }
    }
];

function encodeWav(samples) {
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const faded = new Float64Array(samples.length);
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
        const fade = Math.min(1, i / 128, (samples.length - 1 - i) / 160);
        const value = (samples[i] - mean) * fade;
        if (!Number.isFinite(value)) throw new Error('Non-finite synthesis sample');
        faded[i] = value;
        peak = Math.max(peak, Math.abs(value));
    }
    if (peak < 0.001) throw new Error('Silent sound design');
    const pcmBytes = samples.length * 2;
    const wav = Buffer.alloc(44 + pcmBytes);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(36 + pcmBytes, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(SAMPLE_RATE, 24);
    wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(pcmBytes, 40);
    for (let i = 0; i < faded.length; i++) wav.writeInt16LE(Math.round(faded[i] * (0.72 * 32767 / peak)), 44 + 2 * i);
    return wav;
}

function renderPack() {
    const sounds = DESIGNS.map(design => {
        const samples = new Float64Array(Math.round(SAMPLE_RATE * design.duration));
        design.render(samples);
        const data = encodeWav(samples);
        const record = {
            id: design.id, title: design.title, category: design.category, file: `${design.id}.wav`,
            bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex'),
            durationSeconds: samples.length / SAMPLE_RATE, description: design.description, synthesis: design.synthesis
        };
        return { record, data };
    });
    const manifest = {
        schemaVersion: 1,
        name: 'TikMnG Özgün Sentetik Ses Efektleri Başlangıç Paketi',
        version: 1,
        createdFor: 'TikMnG launcher',
        origin: 'Original programmatic oscillator and seeded-noise synthesis created for TikMnG; not TikOyun assets.',
        rights: {
            statement: 'Created for TikMnG from scratch. No third-party recordings, samples, music, melodies, models or sound libraries were used.',
            permission: 'These original generated effects may be used, copied, modified and redistributed with TikMnG and in games, videos and live streams, including commercial use. No attribution is required.',
            thirdPartyAssets: false,
            thirdPartyAttribution: [],
            affiliation: 'Not sourced from, licensed by or affiliated with TikOyun.'
        },
        generator: 'tools/build-sound-effects.cjs (Node.js built-ins only; deterministic xorshift32 noise)',
        regenerate: 'node tools/build-sound-effects.cjs',
        verify: 'node tools/build-sound-effects.cjs --check',
        format: { container: 'WAV', codec: 'PCM', sampleRate: SAMPLE_RATE, channels: 1, bitsPerSample: 16 },
        preview: 'Resolve each registered file relative to renderer/assets/sound-effects/. No network access is needed.',
        totalAudioBytes: sounds.reduce((sum, sound) => sum + sound.data.length, 0),
        sounds: sounds.map(sound => sound.record)
    };
    const manifestData = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    if (manifest.totalAudioBytes + manifestData.length > 1000000) throw new Error('Sound pack exceeds 1 MB');
    return { manifest, sounds, manifestData };
}

function main() {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
        throw new Error('Usage: node tools/build-sound-effects.cjs [--check]');
    }
    const pack = renderPack();
    const files = [...pack.sounds.map(sound => ({ file: sound.record.file, data: sound.data })),
        { file: 'manifest.json', data: pack.manifestData }];
    for (const directory of [path.dirname(ASSET_ROOT), ASSET_ROOT]) {
        if (!fs.existsSync(directory) && directory === ASSET_ROOT && !args.length) fs.mkdirSync(directory);
        const stat = fs.lstatSync(directory);
        if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(directory) !== directory) {
            throw new Error('Sound output directory must be an owned physical directory');
        }
    }
    for (const { file, data } of files) {
        const target = path.join(ASSET_ROOT, file);
        const stat = fs.lstatSync(target, { throwIfNoEntry: false });
        if (stat && (!stat.isFile() || stat.isSymbolicLink() || stat.nlink > 1)) throw new Error(`Unsafe sound output: ${file}`);
        if (args[0] === '--check') {
            if (!fs.readFileSync(target).equals(data)) throw new Error(`Generated sound differs: ${file}`);
        } else {
            fs.writeFileSync(target, data);
        }
    }
    console.log(`${args.length ? 'Verified' : 'Generated'} ${pack.sounds.length} original TikMnG effects; ${pack.manifest.totalAudioBytes} WAV bytes, ${pack.manifest.totalAudioBytes + pack.manifestData.length} bytes with manifest.`);
    if (!args.length) {
        console.log('Review these pins for lib/sound-effects.cjs when intentionally revising the pack:');
        console.log(JSON.stringify(pack.sounds.map(({ record: { id, title, category, file, bytes, sha256 } }) =>
            ({ id, title, category, file, bytes, sha256 })), null, 2));
    }
}

if (require.main === module) {
    try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = Object.freeze({ renderPack });
