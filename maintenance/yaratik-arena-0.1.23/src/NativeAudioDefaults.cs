using Il2Cpp;
using System.Text.Json;
using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private sealed class AudioDefaults
    {
        public float Master { get; set; } = 71;
        public float Music { get; set; } = 3;
        public float Effects { get; set; } = 80;
    }
    private AudioDefaults nativeAudioDefaults = new();
    private bool seedNativeAudio;

    private void LoadAudioDefaults()
    {
        seedNativeAudio = !File.Exists(Path.Combine(Data, "settings.sav"));
        string file = Path.Combine(Root, "defaults", "audio-settings.json");
        if (File.Exists(file)) nativeAudioDefaults = JsonSerializer.Deserialize<AudioDefaults>(File.ReadAllText(file)) ?? new();
        foreach (float value in new[] { nativeAudioDefaults.Master, nativeAudioDefaults.Music, nativeAudioDefaults.Effects })
            if (!float.IsFinite(value) || value < 0 || value > 100) throw new InvalidDataException("Invalid default audio level.");
    }

    private void EnsureFirstInstallAudio()
    {
        if (!seedNativeAudio) return;
        var manager = SaveManager.Instance;
        var audio = Il2Cpp.Settings.Instance;
        if (manager == null || manager.CurrentSettingsData == null || audio == null)
            throw new InvalidOperationException("Native audio settings are not ready.");
        // IL2CPP can inline LoadSettings; seed after the native UI is constructed as well.
        ApplyNativeAudioDefaults(manager.CurrentSettingsData);
        audio.masterVolumeSlider.SetValueWithoutNotify(nativeAudioDefaults.Master);
        audio.musicVolumeSlider.SetValueWithoutNotify(nativeAudioDefaults.Music);
        audio.sfxVolumeSlider.SetValueWithoutNotify(nativeAudioDefaults.Effects);
        audio.ApplySettings();
        manager.SaveSettings();
        seedNativeAudio = false;
    }

    private static void BeforeNativeSettingsLoad(ref bool __state) => __state = !File.Exists(Path.Combine(Data, "settings.sav"));

    private static void AfterNativeSettingsLoad(SaveManager __instance, ref SettingsData __result, bool __state)
    {
        if (!__state) return;
        __result ??= new SettingsData();
        Current.ApplyNativeAudioDefaults(__result);
        __instance.CurrentSettingsData = __result;
    }

    private void ApplyNativeAudioDefaults(SettingsData value)
    {
        value.masterVolume = nativeAudioDefaults.Master;
        value.musicVolume = nativeAudioDefaults.Music;
        value.sfxVolume = nativeAudioDefaults.Effects;
    }

    private void ProbeNativeAudioDefaults()
    {
        var value = new SettingsData();
        string before = JsonUtility.ToJson(value);
        ApplyNativeAudioDefaults(value);
        File.WriteAllText(Path.Combine(Root, "qa", "audio-defaults-probe.json"), JsonSerializer.Serialize(new
        {
            before, after = JsonUtility.ToJson(value), existingSettings = File.Exists(Path.Combine(Data, "settings.sav"))
        }));
    }
}
