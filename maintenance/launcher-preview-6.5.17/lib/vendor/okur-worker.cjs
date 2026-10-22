var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// tools/okur-build/entry.ts
var fs = __toESM(require("node:fs"));
var path = __toESM(require("node:path"));
var ort = __toESM(require("onnxruntime-node"));

// tools/okur-build/core/frontend.ts
var Frontend = class _Frontend {
  constructor(wasm) {
    this.wasm = wasm;
  }
  encoder = new TextEncoder();
  decoder = new TextDecoder();
  static async load(source) {
    const { instance } = source instanceof Response || source instanceof Promise ? await WebAssembly.instantiateStreaming(source, {}) : await WebAssembly.instantiate(source, {});
    return new _Frontend(instance.exports);
  }
  letters(text) {
    const { memory, alloc, dealloc, letters } = this.wasm;
    const bytes = this.encoder.encode(text);
    const input = alloc(bytes.length);
    new Uint8Array(memory.buffer, input, bytes.length).set(bytes);
    const output = letters(input, bytes.length);
    dealloc(input, bytes.length);
    const length = new DataView(memory.buffer).getUint32(output, true);
    const result = this.decoder.decode(new Uint8Array(memory.buffer, output + 4, length));
    dealloc(output, length + 4);
    return result;
  }
};

// tools/okur-build/core/chunks.ts
var MAX_LETTERS = 360;
function splitAfter(text, marks) {
  const parts = [];
  let start = 0;
  for (const m of text.matchAll(marks)) {
    const end = m.index + m[0].length;
    parts.push(text.slice(start, end).trim());
    start = end;
  }
  parts.push(text.slice(start).trim());
  return parts.filter((p) => p.length > 0);
}
function pack(pieces, limit) {
  const out = [];
  for (const piece of pieces) {
    const last = out.at(-1);
    if (last !== void 0 && last.length + 1 + piece.length <= limit && last.length < 40) {
      out[out.length - 1] = `${last} ${piece}`;
    } else {
      out.push(piece);
    }
  }
  return out;
}
function chunk(letters, limit = MAX_LETTERS) {
  const out = [];
  for (const sentence of pack(splitAfter(letters, /[.!?]+ /g), limit)) {
    if (sentence.length <= limit) {
      out.push(sentence);
      continue;
    }
    for (const clause of pack(splitAfter(sentence, /[;:,] /g), limit)) {
      if (clause.length <= limit) {
        out.push(clause);
        continue;
      }
      let rest = clause;
      while (rest.length > limit) {
        const cut = rest.lastIndexOf(" ", limit);
        const at = cut > 0 ? cut : limit;
        out.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      if (rest) out.push(rest);
    }
  }
  return out;
}

// tools/okur-build/core/noise.ts
function gaussianNoise(seed, count) {
  let state = seed >>> 0;
  const uniform = () => {
    state = state + 1831565813 >>> 0;
    let z = state;
    z = Math.imul(z ^ z >>> 15, z | 1);
    z ^= z + Math.imul(z ^ z >>> 7, z | 61);
    return ((z ^ z >>> 14) >>> 0) / 4294967296;
  };
  const out = new Float32Array(count);
  for (let i = 0; i < count; i += 2) {
    const u1 = 1 - uniform();
    const u2 = uniform();
    const r = Math.sqrt(-2 * Math.log(u1));
    out[i] = r * Math.cos(2 * Math.PI * u2);
    if (i + 1 < count) out[i + 1] = r * Math.sin(2 * Math.PI * u2);
  }
  return out;
}

// tools/okur-build/core/timeline.ts
function words(letters) {
  const chars = Array.from(letters);
  const starts = [];
  chars.forEach((ch, i) => {
    if (ch !== " " && (i === 0 || chars[i - 1] === " ")) starts.push(i);
  });
  const bounds = [0, ...starts.slice(1), chars.length];
  const cw = new Int32Array(chars.length);
  const wstart = new Int32Array(chars.length);
  for (let w = 0; w + 1 < bounds.length; w++) {
    const a = bounds[w];
    const b = bounds[w + 1];
    cw.fill(w, a, b);
    wstart.fill(a, a, b);
  }
  return { cw, wstart, nWords: Math.max(1, bounds.length - 1) };
}
function roundHalfEven(x) {
  const r = Math.round(x);
  return Math.abs(x - Math.trunc(x)) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}
function wordFrames(dur, cw, nWords) {
  const perWord = new Float64Array(nWords);
  cw.forEach((w, i) => {
    perWord[w] += dur[i];
  });
  const counts = new Int32Array(nWords);
  let total = 0;
  let previous = 0;
  for (let w = 0; w < nWords; w++) {
    total += perWord[w];
    const end = roundHalfEven(total);
    counts[w] = Math.max(0, end - previous);
    previous = end;
  }
  return counts;
}
function frameTimeline(counts) {
  const frames = counts.reduce((a, b) => a + b, 0);
  const fw = new Int32Array(frames);
  const fp = new Float32Array(frames);
  let f = 0;
  counts.forEach((count, w) => {
    for (let i = 0; i < count; i++, f++) {
      fw[f] = w;
      fp[f] = i / count;
    }
  });
  return { fw, fp };
}

// tools/okur-build/core/tts.ts
var PAUSE_SYMBOLS = /* @__PURE__ */ new Set([" ", ",", ".", ";", ":", "!", "?", '"', "(", ")"]);
var scaled = (x, k) => k === 1 ? x : x.map((v) => v * k);
var int64 = (a) => BigInt64Array.from(a, (x) => BigInt(x));
var Tts = class {
  constructor(ort2, sessions, frontend, config) {
    this.ort = ort2;
    this.sessions = sessions;
    this.frontend = frontend;
    this.config = config;
    this.ids = new Map(config.symbols.map((s, i) => [s, i]));
  }
  ids;
  letters(text) {
    return this.frontend.letters(text);
  }
  /** Synthesize chunk by chunk, so playback can start after the first sentence. */
  async *speak(text, options = {}) {
    const letters = this.letters(text);
    let seed = options.seed ?? 0;
    for (const piece of chunk(letters)) {
      yield await this.chunk(piece, options.speed ?? 1, seed, options.pause ?? 1, options.temperature ?? 1);
      seed += 1;
    }
  }
  async chunk(letters, speed, seed, pause = 1, temperature = 1) {
    const started = performance.now();
    const { Tensor } = this.ort;
    const chars = Array.from(letters);
    const n = chars.length;
    const ids = new Tensor("int64", int64(chars.map((c2) => this.ids.get(c2) ?? 1)), [1, n]);
    const text = await this.sessions.text.run({ ids });
    const dur = Float32Array.from(
      text.dur.data,
      (d, i) => d / speed * (pause !== 1 && PAUSE_SYMBOLS.has(chars[i] ?? "") ? pause : 1)
    );
    const w = words(letters);
    const { fw, fp } = frameTimeline(wordFrames(dur, w.cw, w.nWords));
    const t = fw.length;
    const steps = this.config.times.length;
    const c = this.config.latent_dim;
    const sampled = await this.sessions.sample.run({
      h: text.h,
      dur: new Tensor("float32", dur, [1, n]),
      cw: new Tensor("int64", int64(w.cw), [1, n]),
      wstart: new Tensor("int64", int64(w.wstart), [1, n]),
      fw: new Tensor("int64", int64(fw), [1, t]),
      fp: new Tensor("float32", fp, [1, t]),
      noise: new Tensor("float32", scaled(gaussianNoise(seed, steps * t * c), temperature), [steps, 1, t, c])
    });
    const decoded = await this.sessions.decoder.run({ z: sampled.z });
    const audio = Float32Array.from(decoded.audio.data);
    return { letters, dur, audio, seconds: audio.length / this.config.sample_rate, computeMs: performance.now() - started };
  }
};

// tools/okur-build/entry.ts
function wav(samples, sampleRate) {
  const buffer = Buffer.allocUnsafe(44 + samples.length * 2);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write("WAVEfmt ", 8, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  }
  return buffer;
}
async function main() {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  const root = path.resolve(input.root);
  const config = JSON.parse(fs.readFileSync(path.join(root, "config.json"), "utf8"));
  const frontendBytes = fs.readFileSync(path.join(root, "frontend.wasm"));
  const frontend = await Frontend.load(frontendBytes);
  const options = { executionProviders: ["cpu"], graphOptimizationLevel: "all" };
  const [text, sample, decoder] = await Promise.all([
    ort.InferenceSession.create(path.join(root, config.files.text), options),
    ort.InferenceSession.create(path.join(root, config.files.sample), options),
    ort.InferenceSession.create(path.join(root, config.files.decoder), options)
  ]);
  const tts = new Tts(ort, { text, sample, decoder }, frontend, config);
  const chunks = [];
  let length = 0;
  for await (const chunk2 of tts.speak(input.text, {
    speed: input.speed ?? 1,
    seed: input.seed ?? 0,
    pause: input.pause ?? 1,
    temperature: input.temperature ?? 1
  })) {
    chunks.push(chunk2.audio);
    length += chunk2.audio.length;
  }
  const joined = new Float32Array(length);
  let offset = 0;
  for (const chunk2 of chunks) {
    joined.set(chunk2, offset);
    offset += chunk2.length;
  }
  process.stdout.write(wav(joined, config.sample_rate).toString("base64"));
}
main().catch((error) => {
  process.stderr.write(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
