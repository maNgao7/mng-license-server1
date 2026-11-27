'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { fileURLToPath, pathToFileURL } = require('node:url');
const vm = require('node:vm');

const app = path.resolve(process.env.HEDIYE_BOX_AUDIO_APP_ROOT || path.join(__dirname, '..'));
const script = path.join(app, 'spectator', 'game-audio.js');
const source = readFileSync(script, 'utf8');
// Original private sounds_v2 recordings from the installed native game.
const recordings = {
  'round_start.wav': 'b10b26923ff42e3db6f4dd01f393e819da0576279c1ad0b399d838184f0295cc',
  'round_end.wav': 'c3ebdd77d0e477a047deb4a95084b2b37d8d5ef2712ef7565b544043615f3f42',
  'punch_reaction_1.wav': 'd762d7334a3c2fc0c7870826cca4ea4d3aceae67667974dba9ede6f76b4e8b23',
  'punch_reaction_2.wav': '5098e87872bfbd9429663469e8364f25d81134bad0ce276280443119e83c0271',
};

function fixture(t, { start = () => Promise.resolve(), AudioContext } = {}) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'] });
  const played = [];
  const warnings = [];
  let onHide;
  class Media {
    constructor(src) { this.src = src; }
    load() {}
    removeAttribute() {}
    cloneNode() { return new Media(this.src); }
    play() {
      played.push(this);
      return start(this);
    }
    pause() { this.paused = true; }
    get file() { return path.basename(fileURLToPath(this.src)); }
  }
  const window = {
    Audio: Media, AudioContext,
    performance: { now: () => Date.now() },
    addEventListener(type, fn) { if (type === 'pagehide') onHide = fn; },
  };
  vm.runInNewContext(source, {
    window, document: { currentScript: { src: pathToFileURL(script).href } },
    URL, setTimeout, clearTimeout, setInterval, clearInterval,
    console: { warn: (...args) => warnings.push(args.join(' ')) },
  }, { filename: script });
  return { audio: window.hediyeBoxAudio, played, warnings, tick: ms => t.mock.timers.tick(ms), hide: onHide };
}

test('routes gong, confirmed hits and KO to their original private recordings', async t => {
  const { audio, played, warnings, tick } = fixture(t);
  assert.equal(played.length, 0);
  for (const input of ['gift', 'punch', 'miss', 'like']) assert.equal(await audio.play(input), false);
  assert.equal(played.length, 0);
  assert.equal(await audio.play('gong'), true);
  tick(450);
  assert.equal(await audio.play('hit', { intensity: 0.5 }), true);
  tick(550);
  assert.equal(await audio.play('hit'), true);
  assert.equal(await audio.play('knockout'), true);
  assert.deepEqual(played.map(m => m.file), ['round_start.wav', 'punch_reaction_1.wav', 'punch_reaction_2.wav', 'round_end.wav']);
  for (const media of played) {
    assert.equal(media.src, pathToFileURL(path.join(app, 'assets', 'audio', media.file)).href);
    assert.equal(createHash('sha256').update(readFileSync(new URL(media.src))).digest('hex'), recordings[media.file]);
  }
  assert.equal(played[1].volume, played[2].volume / 2);
  assert.ok(played[2].volume < played[0].volume && played[2].volume < played[3].volume);
  assert.deepEqual(warnings, []);
});

test('bounds crowd overlap, remembers suppressed contacts and gives the bells priority', async t => {
  const { audio, played, tick } = fixture(t);
  const hit = eventId => audio.play('hit', { eventId });
  assert.equal(await hit('first'), true);
  tick(549);
  assert.equal(await hit('debounced'), false);
  tick(1);
  assert.equal(await hit('second'), true);
  tick(550);
  assert.equal(await hit('first'), false);
  assert.equal(await hit('debounced'), false);
  assert.equal(await hit('third'), true);
  tick(175);
  assert.deepEqual(played.map(m => !!m.paused), [true, false, false]);
  assert.equal(await audio.play('knockout', { eventId: 'ko' }), true);
  tick(175);
  assert.deepEqual(played.map(m => !!m.paused), [true, true, true, false]);
  tick(1624);
  assert.equal(await hit('during-ko'), false);
  tick(1);
  assert.equal(await hit('during-ko'), false);
  assert.equal(await hit('next'), true);
  assert.equal(await audio.play('knockout', { eventId: 'ko' }), false);
});

test('a pending contact cannot start late or retry after KO or page teardown', async t => {
  let resolveStart;
  const f = fixture(t, { start: m => m.file.startsWith('punch') ? new Promise(resolve => { resolveStart = resolve; }) : Promise.resolve() });
  const pending = f.audio.play('hit', { eventId: 1 });
  assert.equal(await f.audio.play('knockout'), true);
  assert.equal(await pending, false);
  assert.ok(f.played[0].paused);
  resolveStart();
  f.tick(1800);
  assert.equal(await f.audio.play('hit', { eventId: 1 }), false);
  const closing = f.audio.play('hit');
  f.hide();
  assert.equal(await closing, false);
  resolveStart();
  assert.ok(f.played.every(m => m.paused));
  assert.equal(await f.audio.play('gong'), false);
});

test('missing, stalled and interrupted clips release their voices without stopping other cues', async t => {
  const f = fixture(t, { start(m) {
    if (m.file === 'round_start.wav') return new Promise(() => {});
    if (m.file === 'punch_reaction_1.wav') throw new Error('decode failed');
    return Promise.resolve();
  } });
  const gong = f.audio.play('gong');
  f.tick(450);
  assert.equal(await gong, false);
  assert.equal(await f.audio.play('hit', { eventId: 2 }), false);
  f.tick(550);
  assert.equal(await f.audio.play('hit', { eventId: 2 }), true);
  f.played[2].onerror();
  assert.ok(f.played.every(m => m.paused));
  assert.equal(await f.audio.play('knockout'), true);
  assert.equal(f.warnings.length, 3);
});

test('effects slider scales new, pending and fading clips without undoing a mute', async t => {
  let started;
  const f = fixture(t, { start: m => m.file.startsWith('punch') ? new Promise(r => { started = r; }) : Promise.resolve() });
  assert.equal(f.audio.setVolume, f.audio.setEffectsVolume);
  f.audio.setEffectsVolume(50);
  assert.deepEqual(f.played, []);
  const hit = f.audio.play('hit', { intensity: 0.5 });
  const [clip] = f.played;
  assert.equal(clip.volume, 0.23 * 0.5 * 0.5);
  f.audio.setVolume(200);
  assert.equal(clip.volume, 0.23 * 0.5);
  started();
  assert.equal(await hit, true);
  assert.equal(await f.audio.play('gong'), true);
  f.tick(50);
  const tail = clip.volume;
  assert.ok(tail > 0 && tail < 0.23 * 0.5);
  f.audio.setVolume(-1);
  f.tick(25);
  assert.deepEqual(f.played.map(m => m.volume), [0, 0]);
  f.audio.setVolume(50);
  assert.ok(clip.volume > 0 && clip.volume < tail * 0.5);
  assert.equal(f.played[1].volume, 0.4);
});

test('fallback graph honors a pre-unlock mute and preserves its mix on live changes', async t => {
  let output;
  let created = 0;
  class Context {
    constructor() { created++; }
    state = 'running';
    currentTime = 0;
    destination = {};
    createGain() {
      const node = { gain: {}, connect: target => { if (target === this.destination) output = node; } };
      return node;
    }
    createDynamicsCompressor() {
      return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() {} };
    }
  }
  const { audio } = fixture(t, { AudioContext: Context });
  audio.setVolume(0);
  assert.equal(created, 0);
  assert.equal(await audio.unlock(), true);
  assert.equal(output.gain.value, 0);
  audio.setVolume(40);
  assert.equal(output.gain.value, 0.65 * 0.4);
  audio.setVolume(NaN);
  assert.equal(output.gain.value, 0.65 * 0.4);
});

test('dry contact follows the effects slider and deduplicates each impact independently of crowd audio',async t=>{
  const {audio,played}=fixture(t);
  audio.setEffectsVolume(40);
  assert.equal(await audio.play('contact',{eventId:'landed-6'}),true);
  assert.equal(await audio.play('contact',{eventId:'landed-6'}),false);
  assert.equal(played.length,1);
  assert.equal(played[0].file,'ring-contact.wav');
  assert.equal(played[0].volume,0.83*0.4);
});
