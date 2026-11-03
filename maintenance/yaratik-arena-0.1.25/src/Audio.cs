using Il2Cpp;
using UnityEngine;
using Object = UnityEngine.Object;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private float qaAudioUntil, qaAudioPeak;
    private string audioError = "";
    private readonly float[] qaAudioSamples = new float[1024];
    private AudioClip vacuumIntakeClip;
    private int vacuumIntakeSounds, vacuumIntakeFrame = -1, vacuumIntakesThisFrame;

    private void PrepareVacuumCollectionAudio()
    {
        var clips = Resources.FindObjectsOfTypeAll<AudioClip>();
        vacuumIntakeClip = clips.FirstOrDefault(c => c.name == "suckpop")
            ?? clips.FirstOrDefault(c => c.name == "Collect_Pop_1");
        if (vacuumIntakeClip == null) throw new InvalidOperationException("Native vacuum intake sound missing.");
    }

    private void PlayVacuumCollectionSound(Vacuum tool)
    {
        if (Time.frameCount != vacuumIntakeFrame)
        { vacuumIntakeFrame = Time.frameCount; vacuumIntakesThisFrame = 0; }
        // Each actual intake gets a pop; simultaneous intakes use less gain to avoid a loud burst.
        tool.audioSource.PlayOneShot(vacuumIntakeClip, .3f / ++vacuumIntakesThisFrame);
        vacuumIntakeSounds++;
    }

    private unsafe void SampleQaAudio()
    {
        if (Time.realtimeSinceStartup >= qaAudioUntil) return;
        try
        {
            fixed (float* samples = qaAudioSamples)
            {
                var span = new UnityEngine.Bindings.BlittableArrayWrapper
                {
                    data = (IntPtr)samples, size = qaAudioSamples.Length,
                    updateFlags = UnityEngine.Bindings.BlittableArrayWrapper.UpdateFlags.NoUpdateNeeded
                };
                AudioListener.GetOutputDataHelper_Injected(out span, 0);
                if (span.data != (IntPtr)samples || span.size != qaAudioSamples.Length)
                    throw new InvalidOperationException("Unexpected native audio buffer.");
            }
            foreach (float sample in qaAudioSamples) qaAudioPeak = Math.Max(qaAudioPeak, Math.Abs(sample));
        }
        catch (Exception error) { audioError = error.Message; qaAudioUntil = 0; }
    }

    private static unsafe bool GetMixerLevel(UnityEngine.Audio.AudioMixer mixer, string name, out float level)
    {
        fixed (char* text = name)
        {
            var span = new UnityEngine.Bindings.ManagedSpanWrapper(text, name.Length);
            return UnityEngine.Audio.AudioMixer.GetFloat_Injected(Object.MarshalledUnityObject.MarshalNotNull(mixer), ref span, out level);
        }
    }

    private void ProbeAudio()
    {
        var native = Il2Cpp.Settings.Instance;
        var mixer = native?.audioMixer;
        var levels = new Dictionary<string, float>();
        if (mixer != null)
            foreach (string name in new[] { "Master", "Music", "SFX" })
                if (GetMixerLevel(mixer, name, out float level)) levels[name] = level;
        File.WriteAllText(Path.Combine(Root, "qa", "audio-probe.json"), System.Text.Json.JsonSerializer.Serialize(new
        {
            configuredVolume = settings.Volume, listenerVolume = AudioListener.volume, listenerPaused = AudioListener.pause,
            qaAudioPeak, audioError, mixer = levels,
            nativeMaster = native?.masterVolumeSlider.value, nativeMusic = native?.musicVolumeSlider.value, nativeSfx = native?.sfxVolumeSlider.value,
            listeners = Resources.FindObjectsOfTypeAll<AudioListener>().Select(l => new
            { path = ScenePath(l.transform), l.enabled, active = l.gameObject.activeInHierarchy, position = l.transform.position.ToString() }).ToArray(),
            sources = Resources.FindObjectsOfTypeAll<AudioSource>().Select(s => new
            {
                path = ScenePath(s.transform), s.enabled, active = s.gameObject.activeInHierarchy, s.isPlaying, s.mute, s.volume, s.pitch, s.spatialBlend,
                s.ignoreListenerPause, group = s.outputAudioMixerGroup?.name, clip = s.clip?.name,
                distance = Vector3.Distance(Player.Instance.mainCamera.transform.position, s.transform.position)
            }).ToArray()
        }, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
    }
}
