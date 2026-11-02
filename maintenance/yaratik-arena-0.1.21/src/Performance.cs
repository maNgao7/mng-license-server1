using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private readonly List<float> frameSamples = new(4096);
    private float performanceUntil;
    private int performanceRun, performanceGcStart;
    private bool performanceRunning;
    private string performanceLabel = "";
    private double frameMeanMs, frameP95Ms, frameP99Ms;
    private int frameCount, frameOver50;

    private void SamplePerformance()
    {
        if (!performanceRunning) return;
        if (!menu && !Il2Cpp.GameManager.Instance.IsPaused)
            frameSamples.Add(Time.unscaledDeltaTime * 1000);
        if (Time.realtimeSinceStartup < performanceUntil) return;
        performanceRunning = false;
        var sorted = frameSamples.OrderBy(value => value).ToArray();
        if (sorted.Length == 0) return;
        frameCount = sorted.Length;
        frameMeanMs = sorted.Average();
        frameP95Ms = sorted[(int)((sorted.Length - 1) * .95)];
        frameP99Ms = sorted[(int)((sorted.Length - 1) * .99)];
        frameOver50 = sorted.Count(ms => ms > 50);
        var result = new
        {
            label = performanceLabel, run = performanceRun, frames = frameCount, meanMs = frameMeanMs,
            p50Ms = sorted[sorted.Length / 2], p95Ms = frameP95Ms, p99Ms = frameP99Ms,
            maxMs = sorted[^1], framesOver33 = sorted.Count(ms => ms > 33.34f), framesOver50 = frameOver50,
            framesOver100 = sorted.Count(ms => ms > 100), managedGc = GC.CollectionCount(0) - performanceGcStart,
            live = rules.Alive, pending = pending.Count, bodies = creatures.Count(c => c.Enemy != null && c.Enemy.IsDead),
            memoryBytes = System.Diagnostics.Process.GetCurrentProcess().WorkingSet64,
            width = Screen.width, height = Screen.height, focused = Application.isFocused,
            graphics = SystemInfo.graphicsDeviceName, cpu = SystemInfo.processorType,
            quality = QualitySettings.GetQualityLevel(), vSync = QualitySettings.vSyncCount, targetFps = Application.targetFrameRate,
            realProfiles = portraits.Keys.Count(user => liveAvatars.ContainsKey(user))
        };
        File.WriteAllText(Path.Combine(Root, "qa", "performance-" + performanceRun + ".json"), System.Text.Json.JsonSerializer.Serialize(result, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
    }

    private void StartPerformance(string label, float seconds)
    {
        frameSamples.Clear(); performanceRun++;
        performanceLabel = label; performanceUntil = Time.realtimeSinceStartup + Math.Clamp(seconds, 5, 60);
        performanceGcStart = GC.CollectionCount(0); performanceRunning = true;
    }
}
