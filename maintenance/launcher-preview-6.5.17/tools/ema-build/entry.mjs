import fs from 'node:fs';
import path from 'node:path';
import * as ort from 'onnxruntime-node';
import { EMA, wavBlob } from './upstream/tts.js';
import { loadNormalizer } from './upstream/normalizer.js';

async function main() {
    const input = JSON.parse(fs.readFileSync(0, 'utf8'));
    const root = path.resolve(input.root);
    const meta = JSON.parse(fs.readFileSync(path.join(root, 'meta.json'), 'utf8'));
    const normalize = await loadNormalizer(fs.readFileSync(path.join(root, 'normalizer.wasm')));
    const sessions = {};
    for (const name of ['text', 'sound', 'decoder']) {
        sessions[name] = await ort.InferenceSession.create(path.join(root, name + '.onnx'), {
            executionProviders: ['cpu'], graphOptimizationLevel: 'all', intraOpNumThreads: 4
        });
    }
    const ema = new EMA(meta, sessions, 'cpu', normalize);
    try {
        const chunks = [];
        for await (const chunk of ema.stream(input.text, { speed: input.speed || 1, seed: 0 })) chunks.push(chunk);
        process.stdout.write(Buffer.from(await wavBlob(chunks).arrayBuffer()).toString('base64'));
    } finally { await ema.release(); }
}
main().catch(error => { process.stderr.write(String(error.message)); process.exitCode = 1; });
