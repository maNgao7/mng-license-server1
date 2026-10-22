import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ort from 'onnxruntime-node';
import { Frontend } from './core/frontend';
import { Tts, type ModelConfig } from './core/tts';

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
  const input = JSON.parse(fs.readFileSync(0, 'utf8')) as { root: string; text: string; speed?: number; seed?: number; pause?: number; temperature?: number };
  const root = path.resolve(input.root);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8')) as ModelConfig;
  const frontendBytes = fs.readFileSync(path.join(root, 'frontend.wasm'));
  const frontend = await Frontend.load(frontendBytes);
  const options: ort.InferenceSession.SessionOptions = { executionProviders: ['cpu'], graphOptimizationLevel: 'all' };
  const [text, sample, decoder] = await Promise.all([
    ort.InferenceSession.create(path.join(root, config.files.text), options),
    ort.InferenceSession.create(path.join(root, config.files.sample), options),
    ort.InferenceSession.create(path.join(root, config.files.decoder), options)
  ]);
  const tts = new Tts(ort, { text, sample, decoder }, frontend, config);
  const chunks: Float32Array[] = [];
  let length = 0;
  for await (const chunk of tts.speak(input.text, {
    speed: input.speed ?? 1,
    seed: input.seed ?? 0,
    pause: input.pause ?? 1,
    temperature: input.temperature ?? 1
  })) {
    chunks.push(chunk.audio);
    length += chunk.audio.length;
  }
  const joined = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
  process.stdout.write(wav(joined, config.sample_rate).toString('base64'));
}

main().catch(error => {
  process.stderr.write(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
