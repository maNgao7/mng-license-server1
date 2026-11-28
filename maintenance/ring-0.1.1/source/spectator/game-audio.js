/* Hediye Box spectator audio. No playback or AudioContext is created on load.
 * Primary recordings: locally installed Online Boxing Demo, private use only.
 * The private desktop package includes the original WAVs under ../assets/audio/.
 * Play file URLs directly on the host media output, including without Web Audio.
 * No fetch, network service, speech, or additional live connection is used.
 *
 * await window.hediyeBoxAudio.unlock(); // call from a user gesture / autoplay host
 * await window.hediyeBoxAudio.play('gong');
 * await window.hediyeBoxAudio.play('hit', { eventId: 'match:contact:123', intensity: 0.8 });
 * await window.hediyeBoxAudio.play('knockout', { eventId: 'match:ko' });
 * window.hediyeBoxAudio.setEffectsVolume(50); // overlay effects percent, including active voices
 * Both methods resolve to a boolean; play=true means playback started/scheduled,
 * not proof that the device was audible. Parent owns authoritative event dedupe.
 * 'hit' is for a confirmed landed punch, not a gift or attempted punch.
 */
(() => {
  'use strict';
  if (window.hediyeBoxAudio) return;

  const base = new URL('../assets/audio/', document.currentScript?.src || document.baseURI);
  const effects = Object.freeze({
    gong: { files: ['round_start.wav'], volume: 0.8, cooldown: 800, duration: 2500, limit: 1 },
    knockout: { files: ['round_end.wav'], volume: 0.85, cooldown: 1800, duration: 4500, limit: 1 },
    contact: { files: ['ring-contact.wav'], volume: 0.83, cooldown: 65, duration: 570, limit: 3 },
    hit: { files: ['punch_reaction_1.wav', 'punch_reaction_2.wav'], volume: 0.23, cooldown: 550, duration: 2800, limit: 2 }
  });
  const active = new Set();
  const templates = new Map();
  const lastPlayed = new Map();
  const seen = new Set();
  const warned = new Set();
  const resumeWaiters = new Set();
  let context = null;
  let master = null;
  let effectsLevel = 1;
  let effectsBus = null;
  let crowdBus = null;
  let noise = null;
  let variant = 0;
  let disposed = false;
  let crowdQuietUntil = -Infinity;
  const now = () => window.performance.now();

  function updateMediaVolume(voice) {
    voice.media.volume = voice.clipLevel * voice.fadeLevel * effectsLevel;
  }

  function setEffectsVolume(percent) {
    if (disposed || !Number.isFinite(percent)) return;
    const level = Math.max(0, Math.min(100, percent)) / 100;
    if (effectsLevel === level) return;
    effectsLevel = level;
    if (master) master.gain.value = 0.65 * effectsLevel;
    for (const voice of active) {
      if (voice.media) updateMediaVolume(voice);
    }
  }

  function warnOnce(key, error) {
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(`[Hediye Box audio] ${key}`, error?.message || String(error));
  }

  function finish(voice) {
    if (voice.stopped) return;
    voice.stopped = true;
    clearTimeout(voice.timer);
    clearTimeout(voice.startTimer);
    clearInterval(voice.fadeTimer);
    voice.cancelStart?.();
    active.delete(voice);
    if (voice.media) {
      voice.media.onended = null;
      voice.media.onerror = null;
      try { voice.media.pause(); } catch { /* Already detached. */ }
    }
    for (const source of voice.sources || []) {
      try { source.stop(); } catch { /* Source already ended. */ }
    }
    for (const node of voice.nodes || []) {
      try { node.disconnect(); } catch { /* Node already detached. */ }
    }
  }

  function fade(voice, duration = 160) {
    if (voice.stopped || voice.fading) return;
    // A pending clip has no audible tail. Cancel it before a late start or fallback.
    if (!voice.started) { finish(voice); return; }
    voice.fading = true;
    clearTimeout(voice.timer);
    if (!voice.media) {
      if (!voice.output) { finish(voice); return; }
      const time = context.currentTime;
      voice.output.gain.cancelScheduledValues(time);
      voice.output.gain.setTargetAtTime(0.0001, time, duration / 4000);
      voice.timer = setTimeout(() => finish(voice), duration);
      return;
    }
    const start = now();
    voice.fadeTimer = setInterval(() => {
      voice.fadeLevel = Math.max(0, 1 - (now() - start) / duration);
      try { updateMediaVolume(voice); } catch { finish(voice); }
      if (!voice.fadeLevel) finish(voice);
    }, 25);
  }

  function preload() {
    if (typeof window.Audio !== 'function') return;
    for (const spec of Object.values(effects)) {
      for (const file of spec.files) {
        if (templates.has(file)) continue;
        try {
          const media = new window.Audio(new URL(file, base).href);
          media.preload = 'auto';
          templates.set(file, media);
          media.load();
        } catch (error) { warnOnce(`Cannot preload ${file}`, error); }
      }
    }
  }

  function resumeContext() {
    // An autoplay-blocked resume can stay pending until a future gesture.
    // Bound this attempt so old match sounds cannot play on a later unlock.
    return new Promise(resolve => {
      let settled = false;
      const complete = ready => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resumeWaiters.delete(cancel);
        resolve(ready);
      };
      const cancel = () => complete(false);
      const timer = setTimeout(cancel, 450);
      resumeWaiters.add(cancel);
      try {
        Promise.resolve(context.resume()).then(() => complete(context.state === 'running'), error => {
          warnOnce('Audio resume blocked', error);
          complete(false);
        });
      } catch (error) {
        warnOnce('Audio resume blocked', error);
        complete(false);
      }
    });
  }

  async function unlock() {
    if (disposed) return false;
    preload();
    try {
      if (!context || context.state === 'closed') {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return false;
        context = new AudioContext();
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -12;
        limiter.knee.value = 12;
        limiter.ratio.value = 6;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.18;
        master = context.createGain();
        master.gain.value = 0.65 * effectsLevel;
        effectsBus = context.createGain();
        crowdBus = context.createGain();
        crowdBus.gain.value = 0.6;
        effectsBus.connect(limiter);
        crowdBus.connect(limiter);
        limiter.connect(master);
        master.connect(context.destination);
        noise = null;
      }
      if (context.state !== 'running' && !await resumeContext()) return false;
      return !disposed && context.state === 'running';
    } catch (error) {
      warnOnce('WebAudio unlock failed; original clips can still use host autoplay', error);
      return false;
    }
  }

  async function original(voice, spec, intensity) {
    const file = spec.files[voice.name === 'hit' ? variant++ % spec.files.length : 0];
    const template = templates.get(file);
    if (!template) return false;
    try {
      const media = template.cloneNode(true);
      voice.media = media;
      voice.clipLevel = spec.volume * intensity;
      voice.fadeLevel = 1;
      updateMediaVolume(voice);
      let fail;
      const failed = new Promise((_, reject) => { fail = reject; });
      media.onerror = () => fail(new Error(`Cannot load ${file}`));
      media.onended = () => finish(voice);
      const cancelled = new Promise(resolve => { voice.cancelStart = resolve; });
      const timedOut = new Promise((_, reject) => {
        voice.startTimer = setTimeout(() => reject(new Error(`Playback timed out: ${file}`)), 450);
      });
      await Promise.race([Promise.resolve(media.play()), failed, timedOut, cancelled]);
      if (voice.stopped || disposed) return false;
      voice.started = true;
      media.onerror = () => {
        warnOnce(`Clip interrupted: ${file}`, new Error('Media error'));
        finish(voice);
      };
      voice.timer = setTimeout(() => fade(voice, voice.name === 'hit' ? 350 : 100), spec.duration);
      return true;
    } catch (error) {
      if (!voice.stopped) warnOnce(`Clip failed: ${file}`, error);
      if (voice.media) {
        voice.media.onended = null;
        voice.media.onerror = null;
        try { voice.media.pause(); } catch { /* Failed playback. */ }
        voice.media = null;
      }
      return false;
    } finally {
      clearTimeout(voice.startTimer);
      voice.cancelStart = null;
    }
  }

  // Original synthesized fallbacks: inharmonic metal, a three-strike KO bell,
  // and layered voiced/formant crowd shouts. Separate buses isolate failures.
  function node(voice, value) { voice.nodes.push(value); return value; }

  function envelope(voice, target, start, duration, level, attack = 0.008) {
    const gain = node(voice, context.createGain());
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(level, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(target);
    return gain;
  }

  function tone(voice, target, start, duration, frequency, level, type = 'sine', endFrequency = frequency) {
    const source = node(voice, context.createOscillator());
    source.type = type;
    source.frequency.setValueAtTime(frequency, start);
    source.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    source.connect(envelope(voice, target, start, duration, level));
    voice.sources.push(source);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  function noiseBuffer() {
    if (noise) return noise;
    noise = context.createBuffer(2, Math.ceil(context.sampleRate), context.sampleRate);
    let seed = 0x48424f58;
    for (let channel = 0; channel < 2; channel++) {
      const samples = noise.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        samples[i] = (seed >>> 0) / 2147483648 - 1;
      }
    }
    return noise;
  }

  function burst(voice, target, start, duration, frequency, level, type = 'bandpass') {
    const source = node(voice, context.createBufferSource());
    source.buffer = noiseBuffer();
    source.loop = true;
    const filter = node(voice, context.createBiquadFilter());
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    source.connect(filter);
    filter.connect(envelope(voice, target, start, duration, level, Math.min(0.09, duration / 4)));
    voice.sources.push(source);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  function bell(voice, start, level, duration = 2.4) {
    for (const [ratio, amplitude] of [[1, 0.35], [1.48, 0.22], [2.09, 0.15], [2.76, 0.09], [3.93, 0.055], [5.14, 0.025]]) {
      tone(voice, voice.output, start, duration / Math.sqrt(ratio), 205 * ratio, level * amplitude);
    }
    burst(voice, voice.output, start, 0.08, 2100, level * 0.14);
  }

  function cheer(voice, start, level) {
    const vowel = node(voice, context.createBiquadFilter());
    vowel.type = 'bandpass';
    vowel.frequency.value = 740;
    vowel.Q.value = 0.8;
    vowel.connect(voice.output);
    for (let i = 0; i < 10; i++) {
      const pitch = 105 + i * 13 + Math.random() * 14;
      tone(voice, vowel, start + i * 0.012, 1.25 + Math.random() * 0.45, pitch, level * 0.07, 'sawtooth', pitch * 1.22);
    }
    burst(voice, voice.output, start, 1.8, 1500, level * 0.17);
    burst(voice, voice.output, start + 0.08, 0.23, 2300, level * 0.08);
  }

  function synthesize(voice, intensity) {
    if (disposed || voice.stopped || context?.state !== 'running') return false;
    try {
      voice.nodes = [];
      voice.sources = [];
      voice.output = node(voice, context.createGain());
      voice.output.gain.value = intensity;
      voice.output.connect(voice.name === 'hit' ? crowdBus : effectsBus);
      const start = context.currentTime + 0.01;
      let duration = 2.6;
      if (voice.name === 'contact') {
        tone(voice,voice.output,start,.13,118,.55,'sine',44);
        burst(voice,voice.output,start,.055,730,.28);
        duration=.18;
      }
      if (voice.name === 'gong') bell(voice, start, 0.85);
      if (voice.name === 'hit') { cheer(voice, start, 0.9); duration = 2; }
      if (voice.name === 'knockout') {
        for (const offset of [0, 0.23, 0.46]) bell(voice, start + offset, 0.65, 1.8);
        tone(voice, voice.output, start, 0.4, 105, 0.2, 'sine', 42);
      }
      voice.started = true;
      voice.timer = setTimeout(() => finish(voice), duration * 1000 + 80);
      return true;
    } catch (error) {
      warnOnce(`Cannot synthesize ${voice.name}`, error);
      return false;
    }
  }

  async function play(name, options = {}) {
    if (disposed || typeof name !== 'string' || !Object.hasOwn(effects, name)) return false;
    if (!options || typeof options !== 'object') options = {};
    const id = typeof options.eventId === 'string' || typeof options.eventId === 'number' ? `${name}:${options.eventId}` : '';
    if (id && seen.has(id)) return false;
    if (id) {
      seen.add(id);
      if (seen.size > 1024) seen.delete(seen.values().next().value);
    }
    const time = now();
    const spec = effects[name];
    if (time - (lastPlayed.get(name) ?? -Infinity) < spec.cooldown || (name === 'hit' && time < crowdQuietUntil)) return false;
    lastPlayed.set(name, time);
    if (name === 'knockout' || name === 'gong') {
      crowdQuietUntil = Math.max(crowdQuietUntil, time + (name === 'knockout' ? 1800 : 450));
      for (const voice of active) if (voice.name !== name) fade(voice);
    }
    const peers = [...active].filter(voice => voice.name === name && !voice.fading);
    while (peers.length >= spec.limit) fade(peers.shift());
    const voice = { name, started: false, stopped: false, fading: false };
    active.add(voice);
    const intensity = typeof options.intensity === 'number' && Number.isFinite(options.intensity)
      ? Math.min(1, Math.max(0.25, options.intensity)) : 1;
    try {
      // Start resume/preload inside the caller's gesture, without blocking clip playback.
      const ready = unlock();
      if (await original(voice, spec, intensity)) return true;
      if (!voice.stopped && await ready && synthesize(voice, intensity)) return true;
    } catch (error) { warnOnce(`Playback failed: ${name}`, error); }
    if (id && !voice.stopped) seen.delete(id); // A failed start may be retried after cooldown.
    finish(voice);
    return false;
  }

  window.addEventListener('pagehide', () => {
    disposed = true;
    for (const voice of active) finish(voice);
    for (const cancel of resumeWaiters) cancel();
    for (const media of templates.values()) {
      try { media.pause(); media.removeAttribute('src'); media.load(); } catch { /* Window is closing. */ }
    }
    templates.clear();
    if (context && context.state !== 'closed') {
      try { Promise.resolve(context.close()).catch(() => {}); } catch { /* Window is closing. */ }
    }
  }, { once: true });
  window.hediyeBoxAudio = Object.freeze({ unlock, play, setEffectsVolume, setVolume: setEffectsVolume });
})();
