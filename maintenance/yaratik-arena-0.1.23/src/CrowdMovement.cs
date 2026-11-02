using Il2Cpp;
using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private int rejectedArenaPaths, liveFallRescues;
    private bool motionSampling;
    private float motionUntil, nextMotionSample;
    private int motionJumps;
    private float motionMaxStep;
    private readonly Dictionary<IntPtr, Vector3> motionPositions = new();
    private readonly Dictionary<IntPtr, float> nextArenaPath = new();

    private static bool BeforeArenaPath(Enemy __instance, ref bool __result)
    {
        if (!Current.ready || !Current.creaturePointers.Contains(__instance.Pointer)) return true;
        if (Current.roundDied) { __instance.pathCornerCount = 0; __result = false; return false; }
        if (Current.CombatRunning)
        {
            try { __result = Current.RequestCombatPath(__instance); }
            catch (Exception error)
            {
                __result = false;
                if (Current.survivalError != error.Message) MelonLoader.MelonLogger.Error("Combat path: " + error);
                Current.survivalError = error.Message;
            }
            return false;
        }
        if (Current.nextArenaPath.TryGetValue(__instance.Pointer, out var next) && Time.time < next) { __result = false; return false; }
        Vector3 p = __instance.rb.position;
        float edge = Math.Min(ArenaHalfX - Math.Abs(p.x), ArenaHalfZ - Math.Abs(p.z));
        __instance.roamRadius = Math.Clamp(edge - 1, .8f, 8);
        return true;
    }

    private static void AfterArenaPath(Enemy __instance, ref bool __result)
    {
        if (Current.CombatRunning) return;
        if (!__result || !Current.ready || !Current.creaturePointers.Contains(__instance.Pointer)) return;
        Vector3 previous = __instance.rb.position;
        for (int i = 0; i < __instance.pathCornerCount; i++)
        {
            Vector3 corner = __instance.pathCorners[i];
            bool behindBoard = Current.PathEntersBoardBackstage(previous, corner);
            previous = corner;
            if (!behindBoard && Math.Abs(corner.x) <= ArenaHalfX && Math.Abs(corner.z) <= ArenaHalfZ && corner.y < .75f) continue;
            if (behindBoard) Current.rejectedBoardPaths++;
            __instance.pathCornerCount = 0;
            __result = false;
            Current.rejectedArenaPaths++;
            Current.nextArenaPath[__instance.Pointer] = Time.time + .5f + (float)((long)__instance.Pointer % 17) * .02f;
            return;
        }
    }

    private void StartCrowdMotion(float seconds)
    {
        motionPositions.Clear(); motionJumps = 0; motionMaxStep = 0;
        motionUntil = Time.realtimeSinceStartup + Math.Clamp(seconds, 5, 60);
        motionSampling = true; nextMotionSample = 0;
    }

    private void SampleCrowdMotion()
    {
        if (!motionSampling || menu || GameManager.Instance.IsPaused) return;
        if (Time.realtimeSinceStartup > motionUntil) { motionSampling = false; return; }
        if (Time.realtimeSinceStartup < nextMotionSample) return;
        nextMotionSample = Time.realtimeSinceStartup + .1f;
        foreach (var creature in creatures)
        {
            var enemy = creature.Enemy;
            if (enemy == null || enemy.IsDead) continue;
            Vector3 point = enemy.rb.position;
            if (motionPositions.TryGetValue(enemy.Pointer, out var previous))
            {
                float step = Vector2.Distance(new Vector2(point.x, point.z), new Vector2(previous.x, previous.z));
                motionMaxStep = Math.Max(motionMaxStep, step);
                if (step > 2) motionJumps++;
            }
            motionPositions[enemy.Pointer] = point;
        }
    }

    private void ProbeMemory()
    {
        File.WriteAllText(Path.Combine(Root, "qa", "memory-probe.json"), System.Text.Json.JsonSerializer.Serialize(new
        {
            managed = GC.GetTotalMemory(false),
            nativeManagedUsed = UnityEngine.Profiling.Profiler.GetMonoUsedSizeLong(),
            nativeManagedHeap = UnityEngine.Profiling.Profiler.GetMonoHeapSizeLong(),
            allocated = UnityEngine.Profiling.Profiler.GetTotalAllocatedMemoryLong(),
            reserved = UnityEngine.Profiling.Profiler.GetTotalReservedMemoryLong(),
            unused = UnityEngine.Profiling.Profiler.GetTotalUnusedReservedMemoryLong(),
            meshes = Resources.FindObjectsOfTypeAll<Mesh>().Length,
            materials = Resources.FindObjectsOfTypeAll<Material>().Length,
            textures = Resources.FindObjectsOfTypeAll<Texture2D>().Length,
            renderTextures = Resources.FindObjectsOfTypeAll<RenderTexture>().Length,
            particles = Resources.FindObjectsOfTypeAll<ParticleSystem>().Length,
            sampleParticles = creatures.FirstOrDefault(c => c.Enemy != null)?.Enemy.GetComponentsInChildren<ParticleSystem>(true).Select(p => new { p.name, p.particleCount, p.isPlaying, active = p.gameObject.activeSelf, maxParticles = p.main.maxParticles }).ToArray(),
            bodies = creatures.Count(c => c.Enemy != null && c.Enemy.IsDead),
            alive = rules.Alive, workingSet = System.Diagnostics.Process.GetCurrentProcess().WorkingSet64
        }, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
    }

}
