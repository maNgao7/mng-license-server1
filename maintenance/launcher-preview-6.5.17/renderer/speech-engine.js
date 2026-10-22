(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.MNGSpeechEngine = api;
})(typeof window === 'object' ? window : globalThis, function () {
    'use strict';

    // Parent supplies a narrow IPC bridge: { listVoices(), synthesize(settings) }.
    // Credentials belong to the main process; this module never accepts a key.
    function createSpeechEngine({ bridge, scope = globalThis, timeoutMs = 120000 } = {}) {
        let active = null;
        let pendingCancel = Promise.resolve();
        function stop() {
            if (!active) return;
            active.finish(Object.assign(new Error('Speech cancelled.'), { code: 'SPEECH_CANCELLED' }));
            try { pendingCancel = Promise.resolve(bridge?.cancel?.()).catch(() => {}); }
            catch { pendingCancel = Promise.resolve(); }
        }
        async function listVoices(options) {
            if (typeof bridge?.listVoices !== 'function') return {
                voices: [], profiles: ['natural', 'deep', 'male', 'female', 'warm', 'energetic', 'girl', 'boy', 'tiny', 'storybook'].map(id => ({ id, available: false, reason: 'SERVICE_UNAVAILABLE' })),
                providers: { windows: { available: false, reason: 'SERVICE_UNAVAILABLE' }, azure: { available: false, reason: 'SERVICE_UNAVAILABLE' } }
            };
            return bridge.listVoices({ refresh: Boolean(options?.refresh) });
        }
        function speak(text, settings = {}) {
            stop();
            if (typeof bridge?.synthesize !== 'function') return Promise.reject(Object.assign(new Error('Speech service unavailable.'), { code: 'SERVICE_UNAVAILABLE' }));
            return new Promise((resolve, reject) => {
                const task = { audio: null, url: null, timer: null, done: false, finish(error, value) {
                    if (task.done) return;
                    task.done = true;
                    if (active === task) active = null;
                    scope.clearTimeout(task.timer);
                    if (task.audio) {
                        task.audio.onended = null; task.audio.onerror = null;
                        task.audio.pause(); task.audio.removeAttribute('src'); task.audio.load();
                    }
                    if (task.url) scope.URL.revokeObjectURL(task.url);
                    if (error) reject(error); else resolve(value);
                } };
                active = task;
                task.timer = scope.setTimeout(() => task.finish(Object.assign(new Error('Speech timed out.'), { code: 'SPEECH_TIMEOUT' })), timeoutMs);
                // Forward only supported settings; never forward renderer credentials/endpoints.
                pendingCancel.then(() => task.done ? null : bridge.synthesize({ text, voiceURI: settings.voiceURI || '',
                    voicePreset: settings.voicePreset || 'natural', provider: settings.provider || '', rate: settings.rate ?? 1,
                    allowOfflineFallback: settings.allowOfflineFallback === true
                })).then(result => {
                    if (task.done) return;
                    if (result?.mimeType !== 'audio/wav' || typeof result.audioBase64 !== 'string' || result.audioBase64.length > 16 * 1024 * 1024) throw new Error('Invalid speech audio.');
                    const raw = scope.atob(result.audioBase64);
                    task.url = scope.URL.createObjectURL(new scope.Blob([Uint8Array.from(raw, char => char.charCodeAt(0))], { type: result.mimeType }));
                    task.audio = new scope.Audio(task.url);
                    if (result.voice?.provider === 'chatterbox') {
                        const rate = Number(result.playbackRate);
                        task.audio.preservesPitch = true;
                        task.audio.playbackRate = Number.isFinite(rate) ? Math.max(0.5, Math.min(2, rate)) : 1;
                    }
                    const volume = Number(settings.volume ?? 1);
                    task.audio.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;
                    task.audio.onended = () => task.finish(null, { voice: result.voice, fallbackUsed: Boolean(result.fallbackUsed) });
                    task.audio.onerror = () => task.finish(Object.assign(new Error('Speech playback failed.'), { code: 'PLAYBACK_FAILED' }));
                    return task.audio.play();
                }).catch(error => task.finish(error));
            });
        }
        return { listVoices, speak, stop, dispose: stop };
    }
    return { createSpeechEngine };
});
