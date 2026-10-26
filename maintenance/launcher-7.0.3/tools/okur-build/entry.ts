import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ort from 'onnxruntime-node';
import { Frontend } from './core/frontend';
import { Tts, type ModelConfig } from './core/tts';

type Input = { v?: number; id?: string; root: string; text: string; speed?: number; seed?: number; pause?: number; temperature?: number };
const MAX_INPUT_BYTES = 16 * 1024;
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

async function* inputs(jsonl: boolean): AsyncGenerator<Input> {
  let parts: Buffer[] = [], bytes = 0;
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
      yield JSON.parse(Buffer.concat(parts).toString('utf8')) as Input;
      parts = []; bytes = 0; start = end + 1;
    }
  }
  if (jsonl) { if (bytes) throw new Error('Incomplete request'); }
  else yield JSON.parse(Buffer.concat(parts).toString('utf8')) as Input;
}

function validate(input: Input, jsonl: boolean): void {
  if (!input || typeof input.root !== 'string' || !input.root || input.root.length > 4096 || input.root.includes('\0') ||
      typeof input.text !== 'string' || !input.text.trim() || Buffer.byteLength(input.text) > 8192 ||
      (jsonl && (input.v !== 1 || typeof input.id !== 'string' || !/^[0-9]{1,16}$/.test(input.id)))) throw new Error('Invalid request');
  const speed = input.speed ?? 1, seed = input.seed ?? 0, pause = input.pause ?? 1, temperature = input.temperature ?? 1;
  if (!Number.isFinite(speed) || speed < 0.25 || speed > 4 || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff ||
      !Number.isFinite(pause) || pause < 0 || pause > 4 || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw new Error('Invalid options');
}

function wav(samples: Float32Array, sampleRate: number): Buffer {
  const buffer = Buffer.allocUnsafe(44 + samples.length * 2);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVEfmt ', 8, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 0x7fff), 44 + i * 2);
  }
  return buffer;
}

async function main(): Promise<void> {
  const jsonl = process.argv.includes('--jsonl');
  const sessions: ort.InferenceSession[] = [];
  let loaded: { root: string; tts: Tts; config: ModelConfig } | undefined;
  try {
    for await (const input of inputs(jsonl)) {
      try {
        validate(input, jsonl);
        const root = path.resolve(input.root);
        if (loaded && loaded.root !== root) throw new Error('Pack mismatch');
        if (!loaded) {
          const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8')) as ModelConfig;
          const frontend = await Frontend.load(fs.readFileSync(path.join(root, 'frontend.wasm')));
          const options: ort.InferenceSession.SessionOptions = {
            executionProviders: ['cpu'], graphOptimizationLevel: 'all', intraOpNumThreads: 4
          };
          for (const name of ['text', 'sample', 'decoder'] as const) {
            sessions.push(await ort.InferenceSession.create(path.join(root, config.files[name]), options));
          }
          loaded = { root, config, tts: new Tts(ort, { text: sessions[0], sample: sessions[1], decoder: sessions[2] }, frontend, config) };
        }
        const chunks: Float32Array[] = [];
        let length = 0;
        for await (const chunk of loaded.tts.speak(input.text, {
          speed: input.speed ?? 1, seed: input.seed ?? 0, pause: input.pause ?? 1, temperature: input.temperature ?? 1
        })) {
          length += chunk.audio.length;
          if (44 + length * 2 > MAX_AUDIO_BYTES) throw new Error('Audio limit');
          chunks.push(chunk.audio);
        }
        if (!length) throw new Error('Empty audio');
        const joined = new Float32Array(length);
        let offset = 0;
        for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
        const audio = wav(joined, loaded.config.sample_rate).toString('base64');
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

function write(data: string): Promise<void> {
  return new Promise((resolve, reject) => process.stdout.write(data, error => error ? reject(error) : resolve()));
}

process.stdout.on('error', () => process.exit(1));
main().catch(() => {
  process.stderr.write('Offline synthesis failed.');
  process.exitCode = 1;
});
