using Il2Cpp;
using UnityEngine;
using Object = UnityEngine.Object;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private AudioClip reloadOutClip, reloadInClip;
    private AudioSource reloadAudioSource;
    private int reloadAudioLevel = -1, reloadAudioRound, reloadAudioReloads;
    private int reloadAudioStarts, reloadAudioCompletes, reloadAudioCancellations, reloadAudioFailures;
    private bool reloadAudioCompleting, reloadAudioPaused;
    private string reloadAudioError = "";

    private bool ReloadAudioSelected(int level) => ready && rules.Level == level && appliedLevel == level &&
        !vacuum && !appliedVacuum && !PrisonActive && !roundDied && !rules.Won && !roundTimedOut;

    private void StartReloadAudio(int level)
    {
        if (!ReloadAudioSelected(level) || menu || GameManager.Instance.IsPaused || reloadAudioFailures > 0) return;
        try
        {
            StopReloadAudio();
            PrepareReloadAudio();
            reloadAudioLevel = level; reloadAudioRound = rules.Round;
            reloadAudioReloads = resources.Get(level).Reloads;
            PlayReloadAudio(reloadOutClip);
            reloadAudioStarts++;
        }
        catch (Exception error) { FailReloadAudio(error); }
    }

    private void CompleteReloadAudio(int level)
    {
        var magazine = resources.Get(level);
        // Compare this reload's token, never a counter last seen on another weapon or round.
        if (reloadAudioLevel != level || reloadAudioRound != rules.Round || reloadAudioCompleting ||
            !ReloadAudioSelected(level) || magazine == null || magazine.Reloading || magazine.Reloads != reloadAudioReloads + 1) return;
        try
        {
            reloadAudioCompleting = true;
            reloadAudioReloads++;
            PlayReloadAudio(reloadInClip);
            reloadAudioCompletes++;
        }
        catch (Exception error) { FailReloadAudio(error); }
    }

    private void UpdateReloadAudio()
    {
        if (reloadAudioLevel < 0) return;
        try
        {
            var magazine = resources.Get(reloadAudioLevel);
            if (!ReloadAudioSelected(reloadAudioLevel) || reloadAudioRound != rules.Round || magazine == null ||
                (reloadAudioCompleting ? magazine.Reloading || magazine.Reloads != reloadAudioReloads : !magazine.Reloading))
            {
                StopReloadAudio(); return;
            }
            SyncReloadAudioSettings();
            bool paused = menu || GameManager.Instance.IsPaused || Time.timeScale <= 0 || AudioListener.pause;
            if (paused)
            {
                if (!reloadAudioPaused && reloadAudioSource.isPlaying) { reloadAudioSource.Pause(); reloadAudioPaused = true; }
                return;
            }
            if (reloadAudioPaused) { reloadAudioSource.UnPause(); reloadAudioPaused = false; }
            if (reloadAudioCompleting && !reloadAudioSource.isPlaying) StopReloadAudio();
        }
        catch (Exception error) { FailReloadAudio(error); }
    }

    private void StopReloadAudio()
    {
        if (reloadAudioLevel >= 0 && !reloadAudioCompleting) reloadAudioCancellations++;
        reloadAudioLevel = -1; reloadAudioCompleting = reloadAudioPaused = false;
        if (reloadAudioSource != null) reloadAudioSource.Stop();
    }

    private void FailReloadAudio(Exception error)
    {
        reloadAudioFailures++;
        reloadAudioError = error.Message;
        reloadAudioLevel = -1; reloadAudioCompleting = reloadAudioPaused = false;
        if (reloadAudioSource != null) Object.Destroy(reloadAudioSource.gameObject);
        reloadAudioSource = null;
    }

    private void SyncReloadAudioSettings()
    {
        var reference = Player.Instance?.audioSource;
        if (reference == null || reference.outputAudioMixerGroup == null)
            throw new InvalidOperationException("Reload SFX source or mixer group missing.");
        reloadAudioSource.outputAudioMixerGroup = reference.outputAudioMixerGroup;
        reloadAudioSource.volume = reference.volume * .85f;
        reloadAudioSource.mute = reference.mute || !reference.enabled || !reference.gameObject.activeInHierarchy;
    }

    private void PlayReloadAudio(AudioClip clip)
    {
        SyncReloadAudioSettings();
        reloadAudioSource.Stop();
        reloadAudioPaused = false;
        reloadAudioSource.pitch = reloadAudioLevel switch { 2 => 1.08f, 3 => 1.02f, 4 => .94f, 5 => .87f, _ => .78f };
        reloadAudioSource.clip = clip;
        reloadAudioSource.Play();
    }

    private void PrepareReloadAudio()
    {
        if (reloadOutClip == null || reloadInClip == null)
        {
            var clips = Resources.FindObjectsOfTypeAll<AudioClip>();
            foreach (var clip in clips)
            {
                if (clip == null || clip.length <= 0 || clip.length > .75f) continue;
                string name = clip.name.Replace("_", "").Replace("-", "").Replace(" ", "").ToLowerInvariant();
                if (name is "magazineout" or "magout" or "reloadstart") reloadOutClip ??= clip;
                if (name is "magazineinchamber" or "magazineinandchamber" or "reloadcomplete" or "reloadend") reloadInClip ??= clip;
            }
            reloadOutClip ??= CreateReloadClip("TikMnG_Magazine_Out", BuildReloadSamples(false));
            reloadInClip ??= CreateReloadClip("TikMnG_Magazine_In_Chamber", BuildReloadSamples(true));
        }
        if (reloadAudioSource != null) return;
        var reference = Player.Instance?.audioSource;
        if (reference == null) throw new InvalidOperationException("Reload audio source missing.");
        var emitter = new GameObject("TikMnG_Reload_Audio");
        emitter.transform.SetParent(reference.transform, false);
        reloadAudioSource = emitter.AddComponent<AudioSource>();
        reloadAudioSource.playOnAwake = false;
        reloadAudioSource.loop = false;
        reloadAudioSource.spatialBlend = 0;
        reloadAudioSource.ignoreListenerPause = false;
        reloadAudioSource.ignoreListenerVolume = false;
    }

    private const int ReloadSampleRate = 24000;

    private static float[] BuildReloadSamples(bool complete)
    {
        var samples = new float[complete ? 11520 : 7200];
        var noise = new System.Random(complete ? 7319 : 4207);
        // Short, filtered friction and damped inharmonic impacts; no sustained alert tone.
        if (complete)
        {
            AddReloadSlide(samples, noise, 0, .075, .24);
            AddReloadImpact(samples, noise, .07, .08, .65, 185);
            AddReloadImpact(samples, noise, .096, .045, .28, 1360);
            AddReloadSlide(samples, noise, .19, .09, .19);
            AddReloadImpact(samples, noise, .205, .055, .23, 920);
            AddReloadSlide(samples, noise, .285, .045, .16);
            AddReloadImpact(samples, noise, .322, .095, .5, 740);
        }
        else
        {
            AddReloadImpact(samples, noise, 0, .045, .43, 1470);
            AddReloadImpact(samples, noise, .035, .06, .3, 680);
            AddReloadSlide(samples, noise, .045, .155, .28);
            AddReloadImpact(samples, noise, .175, .075, .2, 380);
        }
        for (int i = 0; i < samples.Length; i++) samples[i] = Math.Clamp(samples[i] * 2, -.85f, .85f);
        return samples;
    }

    private static void AddReloadImpact(float[] samples, System.Random noise, double start, double duration, double gain, double frequency)
    {
        int offset = (int)(start * ReloadSampleRate), count = (int)(duration * ReloadSampleRate);
        double filtered = 0;
        for (int i = 0; i < count && offset + i < samples.Length; i++)
        {
            double t = i / (double)ReloadSampleRate;
            filtered += .48 * (noise.NextDouble() * 2 - 1 - filtered);
            double body = Math.Sin(2 * Math.PI * frequency * t) * .28 + Math.Sin(2 * Math.PI * frequency * 2.71 * t) * .12;
            double envelope = Math.Min(1, t / .0015) * Math.Exp(-7 * t / duration) * (1 - i / (double)count);
            samples[offset + i] += (float)((filtered * .6 + body) * gain * envelope);
        }
    }

    private static void AddReloadSlide(float[] samples, System.Random noise, double start, double duration, double gain)
    {
        int offset = (int)(start * ReloadSampleRate), count = (int)(duration * ReloadSampleRate);
        double filtered = 0, low = 0;
        for (int i = 0; i < count && offset + i < samples.Length; i++)
        {
            double white = noise.NextDouble() * 2 - 1;
            filtered += .36 * (white - filtered); low += .045 * (white - low);
            double t = i / (double)ReloadSampleRate, progress = i / (double)count;
            double envelope = Math.Pow(Math.Sin(Math.PI * progress), 1.2);
            double ridges = .7 + .3 * Math.Sin(2 * Math.PI * (72 * t + 180 * t * t));
            samples[offset + i] += (float)((filtered - low) * gain * envelope * ridges);
        }
    }

    private static unsafe AudioClip CreateReloadClip(string name, float[] samples)
    {
        var clip = AudioClip.Construct_Internal();
        try
        {
            var native = Object.MarshalledUnityObject.MarshalNotNull(clip);
            // Match FlashPresentation: Unity 6's IL2CPP generic Span wrappers are unavailable.
            fixed (char* label = name)
            fixed (float* pcm = samples)
            {
                var labelSpan = new UnityEngine.Bindings.ManagedSpanWrapper(label, name.Length);
                AudioClip.CreateUserSound_Injected(native, ref labelSpan, samples.Length, 1, ReloadSampleRate, false);
                var dataSpan = new UnityEngine.Bindings.ManagedSpanWrapper(pcm, samples.Length);
                if (!AudioClip.SetData_Injected(native, ref dataSpan, 0)) throw new InvalidOperationException("Reload PCM upload failed.");
            }
            return clip;
        }
        catch { Object.Destroy(clip); throw; }
    }
}
