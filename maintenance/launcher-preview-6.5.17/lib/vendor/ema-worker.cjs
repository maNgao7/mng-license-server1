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

// tools/ema-build/entry.mjs
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var ort2 = __toESM(require("onnxruntime-node"), 1);

// tools/ema-build/upstream/normalizer.js
var enc = new TextEncoder();
var dec = new TextDecoder();
async function loadNormalizer(source) {
  const bytes2 = typeof source === "string" ? await (await fetch(source)).arrayBuffer() : source;
  const { instance } = await WebAssembly.instantiate(bytes2, {});
  return fromInstance(instance);
}
function fromInstance(instance) {
  const w = instance.exports;
  return (text) => {
    const input = enc.encode(text);
    const ptr = w.alloc(input.length);
    new Uint8Array(w.memory.buffer, ptr, input.length).set(input);
    w.normalize(ptr, input.length);
    w.dealloc(ptr, input.length);
    return dec.decode(new Uint8Array(w.memory.buffer, w.result_ptr(), w.result_len()));
  };
}

// tools/ema-build/upstream/tts.js
var ORT = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";
var ort = require("onnxruntime-node");
var CACHE = "ema-models-v1";
async function bytes(url) {
  let cache = null;
  try {
    for (const key of await caches.keys()) if (key.startsWith("ema-models-") && key !== CACHE) await caches.delete(key);
    cache = await caches.open(CACHE);
  } catch {
  }
  const hit = await cache?.match(url).catch(() => null);
  if (hit) return hit.arrayBuffer();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  try {
    await cache?.put(url, res.clone());
  } catch {
  }
  return res.arrayBuffer();
}
var RATE = 48e3;
var FIRST_WINDOW = 25;
var WINDOW = 100;
var CONTEXT = 8;
var MAX_WORD_FRAMES = 250;
var MAX_FRAMES = 3e3;
var TURKISH = new Set("\xE7\u011F\u0131\xF6\u015F\xFC\xC7\u011E\u0130\xD6\u015E\xDC");
var TYPOGRAPHY = {
  "\u2019": "'",
  "\u2018": "'",
  "\u02BC": "'",
  "\xB4": "'",
  "`": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u201E": '"',
  "\xAB": '"',
  "\xBB": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u2212": "-",
  "\u2026": "..."
};
var UNSAFE = /[\x00-\x08\x0b-\x1f\x7f-\x9f؜‎‏‪-‮⁦-⁩]/g;
var BLOCK_BYTES = 8 * 1024;
function blocks(text) {
  const out = [];
  let block = [], size = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const n = new TextEncoder().encode(word).length + 1;
    if (block.length && size + n > BLOCK_BYTES) {
      out.push(block.join(" "));
      block = [];
      size = 0;
    }
    block.push(word);
    size += n;
  }
  if (block.length) out.push(block.join(" "));
  return out;
}
function frontend(text, vocab, normalize) {
  text = text.replace(UNSAFE, " ");
  if (!text.trim()) return "";
  return alphabet(blocks(text).map(normalize).join(" "), vocab);
}
function alphabet(text, vocab) {
  text = text.replace(UNSAFE, " ");
  text = [...text].map((ch) => TYPOGRAPHY[ch] ?? ch).join("");
  text = text.replace(/İ/g, "i").replace(/I/g, "\u0131").toLocaleLowerCase("tr");
  let out = "";
  for (let ch of text) {
    if (!TURKISH.has(ch)) ch = ch.normalize("NFKD").replace(new RegExp("\\p{M}", "gu"), "");
    out += ch && [...ch].every((c) => vocab.has(c)) ? ch : " ";
  }
  return out.replace(/\s+/g, " ").trim();
}
var LETTERS_PER_SECOND = 18;
var MAX_SECONDS = 10;
var MAX_LETTERS = 250;
var SENTENCE_PAUSE = 0.25;
var CLAUSE_PAUSE = 0.12;
var CUTS = [[/[.!?]+["')]*(?= )/g, SENTENCE_PAUSE], [/[,;:](?= )/g, CLAUSE_PAUSE], [/\S(?= )/g, CLAUSE_PAUSE]];
function finish(piece) {
  if (/[.!?]$/.test(piece.replace(/["')]+$/, ""))) return piece;
  return piece.replace(/[,;:\- ]+$/, "") + ".";
}
function chunk(text, speed) {
  const limit = Math.floor(Math.min(MAX_LETTERS, LETTERS_PER_SECOND * MAX_SECONDS * speed));
  const pieces = [];
  let rest = text.trim();
  while (rest) {
    let cut = rest.length, pause = 0;
    if (rest.length > limit) {
      cut = limit;
      const head = rest.slice(0, limit + 1);
      for (const [pattern, gap] of CUTS) {
        const ends = [...head.matchAll(pattern)].map((m) => m.index + m[0].length);
        if (ends.length) {
          cut = ends.at(-1);
          pause = gap;
          break;
        }
      }
    }
    const piece = rest.slice(0, cut).trim();
    rest = rest.slice(cut).trim();
    if (new RegExp("\\p{L}", "u").test(piece)) pieces.push([finish(piece), pause]);
  }
  if (pieces.length) pieces.at(-1)[1] = 0;
  return pieces;
}
function gaussian(seed) {
  let a = seed >>> 0;
  const uniform = () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  return (n) => {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i += 2) {
      const r = Math.sqrt(-2 * Math.log(1 - uniform())), th = 2 * Math.PI * uniform();
      out[i] = r * Math.cos(th);
      if (i + 1 < n) out[i + 1] = r * Math.sin(th);
    }
    return out;
  };
}
function words(text) {
  const starts = [];
  for (let i = 0; i < text.length; i++) if (text[i] !== " " && (i === 0 || text[i - 1] === " ")) starts.push(i);
  if (!starts.length) starts.push(0);
  const bounds = [0, ...starts.slice(1), text.length];
  const cw = [], wstart = [];
  for (let w = 0; w + 1 < bounds.length; w++)
    for (let i = bounds[w]; i < bounds[w + 1]; i++) {
      cw.push(w);
      wstart.push(bounds[w]);
    }
  return { cw, wstart };
}
function plan(cw, wstart, dur, speed) {
  const L = cw.length, nWords = cw[L - 1] + 1;
  const d = Float32Array.from(dur, (x) => x / speed);
  const sums = new Float64Array(nWords);
  for (let i = 0; i < L; i++) sums[cw[i]] += d[i];
  const counts = Array.from(sums, (s) => Math.min(MAX_WORD_FRAMES, Math.max(1, Math.round(s))));
  const T = Math.min(counts.reduce((a, b) => a + b, 0), MAX_FRAMES);
  const fw = new Int32Array(T), fp = new Float32Array(T), start = [];
  for (let w = 0, f = 0; w < nWords; w++) {
    start.push(f);
    for (let j = 0; j < counts[w] && f < T; j++, f++) {
      fw[f] = w;
      fp[f] = j / counts[w];
    }
  }
  const c = Float32Array.from(d, (x) => Math.max(x, 1e-4));
  const done = new Float32Array(L), total = new Float32Array(nWords);
  for (let i = 0, acc = 0; i < L; i++) {
    acc += c[i];
    done[i] = acc;
    total[cw[i]] += c[i];
  }
  const before = (i) => done[i] - c[i];
  const wlen = new Float32Array(nWords);
  for (const w of cw) wlen[w] += 1;
  const woff = new Float32Array(nWords);
  for (let w = 1; w < nWords; w++) woff[w] = woff[w - 1] + Math.max(wlen[w - 1], 1);
  const cg = new Float32Array(L), fg = new Float32Array(T);
  for (let i = 0; i < L; i++) {
    const cp = Math.min(1, Math.max(0, (done[i] - before(wstart[i]) - 0.5 * c[i]) / Math.max(total[cw[i]], 1e-8)));
    cg[i] = woff[cw[i]] + cp * Math.max(wlen[cw[i]], 1);
  }
  for (let f = 0; f < T; f++) fg[f] = woff[fw[f]] + fp[f] * Math.max(wlen[fw[f]], 1);
  return { T, fw, cg, fg };
}
function windows(frames, first) {
  const spans = [];
  for (let s = 0; s < frames; ) {
    const e = Math.min(frames, s + (s === 0 ? first : WINDOW));
    spans.push([s, e]);
    s = e;
  }
  return spans;
}
var i64 = (arr) => new ort.Tensor("int64", BigInt64Array.from(arr, (x) => BigInt(x)), [1, arr.length]);
var f32 = (arr, dims) => new ort.Tensor("float32", arr, dims);
var EMA = class _EMA {
  // precision "fp16" loads the half-size sound graph from models/fp16/ (fp32 at its edges). Text and decoder stay
  // fp32: on WebGPU their fp16 versions go wrong (see export/to_fp16.py).
  static async load(backend = "webgpu", base = "models/", onProgress = () => {
  }, precision = "fp32") {
    ort = await import(ORT + (backend === "webgpu" ? "ort.webgpu.min.mjs" : "ort.wasm.min.mjs"));
    ort.env.wasm.wasmPaths = ORT;
    const meta = await (await fetch(base + "meta.json")).json();
    const opts = {
      executionProviders: backend === "webgpu" ? ["webgpu", "wasm"] : ["wasm"],
      graphOptimizationLevel: "all"
    };
    const sessions = {};
    onProgress("normalizer", 0);
    const normalize = await loadNormalizer(await bytes(base + "normalizer.wasm"));
    const names = ["text", "sound", "decoder"];
    for (const [i, name] of names.entries()) {
      onProgress(name, (i + 1) / (names.length + 1));
      const buf = await bytes(base + (precision === "fp16" && name === "sound" ? "fp16/" : "") + name + ".onnx");
      sessions[name] = await ort.InferenceSession.create(buf, opts);
    }
    const ema = new _EMA(meta, sessions, backend, normalize);
    ema.precision = precision;
    return ema;
  }
  constructor(meta, sessions, backend, normalize = (t) => t) {
    Object.assign(this, sessions);
    this.normalize = normalize;
    this.backend = backend;
    this.meta = meta;
    this.vocab = meta.vocab;
    this.stoi = new Map(meta.vocab.map((ch, i) => [ch, i]));
    this.alpha = new Set(meta.vocab.filter((v) => v.length === 1));
  }
  // frees the sessions' wasm and GPU memory; the object cannot be used afterwards
  async release() {
    for (const s of [this.text, this.sound, this.decoder]) await s?.release().catch(() => {
    });
  }
  pieces(text, speed) {
    return chunk(frontend(text, this.alpha, this.normalize), speed);
  }
  // Yields Float32Array chunks of 48 kHz audio as they are made; `stats` gets per-stage timings.
  // onPiece({ text, words, starts, seconds }) runs before a piece's audio: each spoken word and when it
  // starts, in seconds from the piece's first sample, read off the model's own frame timeline.
  async *stream(text, { speed = 1, seed = 0, stats = {}, onPiece = () => {
  } } = {}) {
    const pieces = this.pieces(text, speed);
    stats.pieces = pieces.map(([p]) => p);
    stats.text = stats.sound = stats.decode = 0;
    const nSteps = this.meta.times.length, D = this.meta.latent_dim, hop = this.meta.hop;
    for (let k = 0; k < pieces.length; k++) {
      const [piece, pause] = pieces[k];
      let t0 = performance.now();
      const ids = [...piece].map((ch) => this.stoi.get(ch) ?? 1);
      const { cw, wstart } = words(piece);
      const { h, dur } = await this.text.run({ ids: i64(ids) });
      const durArr = await dur.getData();
      const { T, fw, cg, fg } = plan(cw, wstart, durArr, speed);
      stats.text += performance.now() - t0;
      t0 = performance.now();
      const noise = gaussian(seed * 1000003 + k)(nSteps * T * D);
      const { latents } = await this.sound.run({
        h,
        cg: f32(cg, [1, cg.length]),
        fg: f32(fg, [1, T]),
        cw: i64(cw),
        fw: i64(fw),
        noise: f32(noise, [1, nSteps, T, D])
      });
      const lat = await latents.getData();
      stats.sound += performance.now() - t0;
      const starts = [];
      for (let f = 0; f < T; f++) if (f === 0 || fw[f] !== fw[f - 1]) starts[fw[f]] = f * hop / RATE;
      onPiece({ text: piece, words: piece.split(" "), starts, seconds: T * hop / RATE });
      for (const [s, e] of windows(T, k === 0 ? FIRST_WINDOW : WINDOW)) {
        t0 = performance.now();
        const a = Math.max(0, s - CONTEXT), b = Math.min(T, e + CONTEXT), n = b - a;
        const z = new Float32Array(D * n);
        for (let f = 0; f < n; f++) for (let d = 0; d < D; d++) z[d * n + f] = lat[(a + f) * D + d];
        const { audio } = await this.decoder.run({ z: f32(z, [1, D, n]) });
        const wav = (await audio.getData()).slice((s - a) * hop, (e - a) * hop);
        stats.decode += performance.now() - t0;
        yield wav;
      }
      if (pause) yield new Float32Array(Math.round(pause * RATE));
    }
  }
};
function wavBlob(chunks) {
  const n = chunks.reduce((a, c) => a + c.length, 0);
  const buf = new ArrayBuffer(44 + 2 * n), v = new DataView(buf);
  const str = (o2, s) => [...s].forEach((c, i) => v.setUint8(o2 + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + 2 * n, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, 2 * n, true);
  let o = 44;
  for (const c of chunks) for (const x of c) {
    v.setInt16(o, Math.round(Math.max(-1, Math.min(1, x)) * 32767), true);
    o += 2;
  }
  return new Blob([buf], { type: "audio/wav" });
}

// tools/ema-build/entry.mjs
async function main() {
  const input = JSON.parse(import_node_fs.default.readFileSync(0, "utf8"));
  const root = import_node_path.default.resolve(input.root);
  const meta = JSON.parse(import_node_fs.default.readFileSync(import_node_path.default.join(root, "meta.json"), "utf8"));
  const normalize = await loadNormalizer(import_node_fs.default.readFileSync(import_node_path.default.join(root, "normalizer.wasm")));
  const sessions = {};
  for (const name of ["text", "sound", "decoder"]) {
    sessions[name] = await ort2.InferenceSession.create(import_node_path.default.join(root, name + ".onnx"), {
      executionProviders: ["cpu"],
      graphOptimizationLevel: "all",
      intraOpNumThreads: 4
    });
  }
  const ema = new EMA(meta, sessions, "cpu", normalize);
  try {
    const chunks = [];
    for await (const chunk2 of ema.stream(input.text, { speed: input.speed || 1, seed: 0 })) chunks.push(chunk2);
    process.stdout.write(Buffer.from(await wavBlob(chunks).arrayBuffer()).toString("base64"));
  } finally {
    await ema.release();
  }
}
main().catch((error) => {
  process.stderr.write(String(error.message));
  process.exitCode = 1;
});
