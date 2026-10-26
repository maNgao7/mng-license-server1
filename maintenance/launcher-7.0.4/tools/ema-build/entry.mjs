import fs from 'node:fs';
import path from 'node:path';
import * as ort from 'onnxruntime-node';
import { EMA, wavBlob } from './upstream/tts.js';
import { loadNormalizer } from './upstream/normalizer.js';

const MAX_INPUT_BYTES = 16 * 1024;
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

async function* inputs(jsonl) {
    let parts = [], bytes = 0;
    for await (const data of process.stdin) {
        const buffer = Buffer.from(data);
        let start = 0;
        while (start < buffer.length) {
            const end = jsonl ? buffer.indexOf(10, start) : -1;
            const part = buffer.subarray(start, end === -1 ? buffer.length : end);
            bytes += part.length;
            if (bytes > MAX_INPUT_BYTES) throw new Error('Input limit');
            parts.push(part);
            if (end === -1) break;
            yield JSON.parse(Buffer.concat(parts).toString('utf8'));
            parts = []; bytes = 0; start = end + 1;
        }
    }
    if (jsonl) { if (bytes) throw new Error('Incomplete request'); }
    else yield JSON.parse(Buffer.concat(parts).toString('utf8'));
}

function validate(input, jsonl) {
    if (!input || typeof input.root !== 'string' || !input.root || input.root.length > 4096 || input.root.includes('\0') ||
        typeof input.text !== 'string' || !input.text.trim() || Buffer.byteLength(input.text) > 8192 ||
        (jsonl && (input.v !== 1 || typeof input.id !== 'string' || !/^[0-9]{1,16}$/.test(input.id)))) throw new Error('Invalid request');
    const speed = input.speed ?? 1, seed = input.seed ?? 0;
    if (!Number.isFinite(speed) || speed < 0.25 || speed > 4 || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Invalid options');
}

async function main() {
    const jsonl = process.argv.includes('--jsonl');
    const sessions = [];
    let loaded;
    try {
        for await (const input of inputs(jsonl)) {
            try {
                validate(input, jsonl);
                const root = path.resolve(input.root);
                if (loaded && loaded.root !== root) throw new Error('Pack mismatch');
                if (!loaded) {
                    const meta = JSON.parse(fs.readFileSync(path.join(root, 'meta.json'), 'utf8'));
                    const normalize = await loadNormalizer(fs.readFileSync(path.join(root, 'normalizer.wasm')));
                    for (const name of ['text', 'sound', 'decoder']) {
                        sessions.push(await ort.InferenceSession.create(path.join(root, name + '.onnx'), {
                            executionProviders: ['cpu'], graphOptimizationLevel: 'all', intraOpNumThreads: 4
                        }));
                    }
                    loaded = { root, ema: new EMA(meta, { text: sessions[0], sound: sessions[1], decoder: sessions[2] }, 'cpu', normalize) };
                }
                const chunks = [];
                let length = 0;
                for await (const chunk of loaded.ema.stream(input.text, { speed: input.speed ?? 1, seed: input.seed ?? 0 })) {
                    length += chunk.length;
                    if (44 + length * 2 > MAX_AUDIO_BYTES) throw new Error('Audio limit');
                    chunks.push(chunk);
                }
                if (!length) throw new Error('Empty audio');
                const audio = Buffer.from(await wavBlob(chunks).arrayBuffer()).toString('base64');
                await write(jsonl ? JSON.stringify({ v: 1, id: input.id, audio }) + '\n' : audio);
            } catch {
                if (!jsonl) throw new Error('Offline synthesis failed');
                const id = typeof input?.id === 'string' && /^[0-9]{1,16}$/.test(input.id) ? input.id : null;
                await write(JSON.stringify({ v: 1, id, error: 'OFFLINE_UNAVAILABLE' }) + '\n');
                process.exitCode = 1;
                break;
            }
        }
    } finally { await Promise.allSettled(sessions.map(session => session.release())); }
}
function write(data) {
    return new Promise((resolve, reject) => process.stdout.write(data, error => error ? reject(error) : resolve()));
}
process.stdout.on('error', () => process.exit(1));
main().catch(() => { process.stderr.write('Offline synthesis failed.'); process.exitCode = 1; });
