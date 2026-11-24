using PYWO.Voxel;
using Unity.Mathematics;
using UnityEngine;
using Cells = Il2CppSystem.Collections.Generic.List<Il2CppSystem.ValueTuple<Unity.Mathematics.int3, float>>;

namespace TikMnG.HapistenKac;

// Tick from LivePanel only in an isolated QA build. All coordinates use the current seed.
internal static class DrillEscortProbe
{
    private static int stage, strikes, broken;
    private static double slowest;
    private static float next, soakUntil;
    private static int attempts, contacts, soakBroken;
    private static readonly List<float> frames = new();
    private static int3 pocket, helperWall;
    private static Vector3 entrance;
    private static readonly Cells targets = new();

    private static void Check(bool ok, string message)
    {
        if (!ok) throw new InvalidOperationException(message);
    }

    internal static void Tick(LivePanel panel)
    {
        if (stage == 9) frames.Add(Time.unscaledDeltaTime * 1000);
        if (stage >= 90 || Time.unscaledTime < next) return;
        try
        {
            if (stage == 0)
            {
                var manager = PywoNetworkManager.Instance;
                if (manager == null || manager.Busy || MainMenu.Instance?.main?.gameObject.activeInHierarchy != true) return;
                RunSave.CancelPending();
                manager.PlaySolo();
                stage = 1;
                next = Time.unscaledTime + 4;
                return;
            }
            var player = PlayerState.Local;
            var voxels = VoxelNet.Instance;
            var world = voxels?.World;
            if (player == null || world == null || voxels == null) return;
            if (stage == 1)
            {
                panel.ExecuteAction(player, 2, 4, 0, null);
                Check(UpgradeDurability.SlotIn(player.GetComponent<PlayerBelt>()) >= 0, "drill missing");
                player.Look.SetPitch(0);
                entrance = player.Motor.Feet;
                stage = 2;
            }
            if (stage is 2 or 4)
            {
                if (strikes < 12)
                {
                    Check(WorldActions.AimAtWall(player, voxels, out var hit), "no wall for drill");
                    var evt = new DamageEvent { voxel = hit.voxel, faceNormal = hit.normal, damage = 7, playerSlot = player.slot, kind = DamageKind.Tool, lootWeight = 1, kernelStrength = 1 };
                    targets.Clear();
                    targets.Add(new Il2CppSystem.ValueTuple<int3,float>(hit.voxel,1f));
                    var watch = System.Diagnostics.Stopwatch.StartNew();
                    var result = voxels.ServerApplyToolCells(ref evt, targets);
                    slowest = Math.Max(slowest, watch.Elapsed.TotalMilliseconds);
                    broken += result.cubesBroken;
                    Check(evt.damage == 7 && targets.Count == 1, "borrowed inputs changed");
                    strikes++;
                    next = Time.unscaledTime + .13f;
                    return;
                }
                Plugin.Output.LogInfo($"DRILL QA stage={stage} distance={EscapeDistance.FromPosition(world, player.Motor.Feet):F2} hits={strikes} broken={broken} maxHitMs={slowest:F2}");
                Check(broken > 0, "no solid blocks broken");
                if (stage == 4)
                {
                    Check(BotSpawner.bots.Count > 0, "helper missing at depth");
                    var gap = Vector3.Distance(BotSpawner.bots[0].Motor.Feet, player.Motor.Feet);
                    Check(gap < 4.5f, $"helper too far: {gap}");
                    Plugin.Output.LogInfo($"DRILL QA PASS: deep escort distance={gap:F2} m");
                    stage = 9;
                    soakUntil = Time.unscaledTime + 90;
                    next = Time.unscaledTime;
                    return;
                }
                strikes = broken = 0;
                slowest = 0;
                var feet = player.Motor.Feet;
                var start = VoxelCoord.FromWorld(new float3(feet.x, feet.y, feet.z));
                var edge = start.x;
                while (edge - start.x < 2048 && !DemoCap.PastCap(new int3(edge, start.y + 12, start.z), DemoCap.CapSub(world))) edge++;
                pocket = new int3(edge - 55, start.y, start.z);
                targets.Clear();
                for (var x = -14; x <= 13; x++)
                for (var y = 0; y <= 22; y++)
                for (var z = -11; z <= 11; z++)
                {
                    var cell = pocket + new int3(x, y, z);
                    if (!world.IsSolid(cell) || world.IsUnbreakable(cell)) continue;
                    var change = new VoxelChange(cell, VoxelOp.Break, 0);
                    world.Apply(ref change, false);
                }
                var p = VoxelCoord.Centre(pocket);
                player.Motor.ServerTeleport(new Vector3(p.x, p.y, p.z), 90, true);
                player.Look.SetPitch(0);
                stage = 3;
                next = Time.unscaledTime + 2;
                return;
            }
            if (stage == 7)
            {
                Check(!world.IsSolid(helperWall) || world.GetDamage(helperWall) > 0, $"helper did not dig its forward wall {helperWall}");
                Plugin.Output.LogInfo("DRILL QA PASS: helper dug forward on its own");
                stage = 4;
                return;
            }
            if (stage == 9)
            {
                if (Time.unscaledTime < soakUntil)
                {
                    var angle = ++attempts * 2.399963f;
                    var direction = math.normalizesafe(new float3(math.cos(angle), .12f + .04f * (attempts % 12), math.sin(angle)));
                    var eye = player.EyePosition;
                    if (world.Raycast(new float3(eye.x,eye.y,eye.z), direction, 9, out var wall) && !world.IsUnbreakable(wall.voxel))
                    {
                        var action = new DamageEvent { voxel = wall.voxel, faceNormal = wall.normal, damage = 7, playerSlot = player.slot, kind = DamageKind.Tool, lootWeight = 1, kernelStrength = 1 };
                        targets.Clear();
                        targets.Add(new Il2CppSystem.ValueTuple<int3,float>(wall.voxel,1));
                        soakBroken += voxels.ServerApplyToolCells(ref action, targets).cubesBroken;
                        contacts++;
                    }
                    next = Time.unscaledTime + .10f;
                    return;
                }
                frames.Sort();
                Plugin.Output.LogInfo($"DRILL SOAK 90s: contacts={contacts}, broken={soakBroken}, frames={frames.Count}, p50={frames[frames.Count/2]:F1}ms, p95={frames[frames.Count*95/100]:F1}ms, p99={frames[frames.Count*99/100]:F1}ms, max={frames[^1]:F1}ms, over250={frames.Count(f=>f>250)}");
                Check(contacts >= 100 && soakBroken > 1000 && BotSpawner.bots.Count > 0, "insufficient drill activity");
                player.Motor.ServerTeleport(entrance, 90f, true);
                stage = 8;
                next = Time.unscaledTime + 1;
                return;
            }
            if (stage == 8)
            {
                Check(Vector3.Distance(BotSpawner.bots[0].Motor.Feet, player.Motor.Feet) < 4.5f, "escort stayed behind");
                Plugin.Output.LogInfo("DRILL QA PASS: helper followed player back to entrance");
                panel.ExecuteAction(player, BindingFile.StartEscape, 1, 0, null);
                stage = 5;
                next = Time.unscaledTime + 1;
                return;
            }
            if (stage == 5)
            {
                Check(EscapeFinale.KeepsHud || EscapeFinale.IsPending, "escape did not begin");
                stage = 6;
                next = Time.unscaledTime + 20;
                return;
            }
            if (stage == 6)
            {
                Check(!EscapeFinale.KeepsHud && !EscapeFinale.IsPending && BotSpawner.bots.Count == 0 &&
                    UpgradeDurability.SlotIn(player.GetComponent<PlayerBelt>()) < 0, "fresh run not clean");
                Plugin.Output.LogInfo("DRILL QA PASS: escape completed and clean next run");
                stage = 90;
                return;
            }
            Check(EscapeDistance.FromPosition(world, player.Motor.Feet) < 10, "deep pocket not reached");
            var helper = panel.ExecuteAction(player, 7, 120, 0, null);
            Check(BotSpawner.bots.Count > 0, helper);
            var botEye = BotSpawner.bots[0].EyePosition;
            Check(world.Raycast(new float3(botEye.x,botEye.y,botEye.z), new float3(1,0,0), 5f, out var helperHit), "missing helper wall");
            helperWall = helperHit.voxel;
            stage = 7;
            next = Time.unscaledTime + 5;
        }
        catch(Exception error)
        {
            Plugin.Output.LogError("DRILL QA FAIL " + error);
            stage = 90;
        }
    }

}
