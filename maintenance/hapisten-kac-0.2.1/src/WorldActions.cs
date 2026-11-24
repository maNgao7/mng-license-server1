using HarmonyLib;
using Mirror;
using PYWO.Voxel;
using PYWO.Voxel.Rules;
using Unity.Mathematics;
using UnityEngine;

namespace TikMnG.HapistenKac;

internal sealed class WorldActions
{
    private const int MaxHelpers = 4;
    private static readonly Dictionary<IntPtr, Helper> DrivenHelpers = new();
    private readonly List<Helper> helpers = new();
    private readonly HashSet<(byte Top, byte Bottom)> helperOutfits = new();
    private (byte Top, byte Bottom)? lastOutfit;
    private static readonly float[] SweepAngles = { 0, 20, -20, 40, -40, 62, -62, 82, -82 };
    internal float HelperUntil => helpers.Count == 0 ? 0 : helpers.Max(helper => helper.Until);
    private readonly Queue<ReturningBlock> returning = new();
    private readonly List<ReturningBlock> awaitingClearance = new();
    private readonly HashSet<int3> planned = new();
    private float lastScheduled;
    private Material? blockMaterial;
    private float nextBrickSound;
    private float nextClearanceCheck;
    private readonly HashSet<int3> restoredCells = new();
    private sealed record ReturningBlock(int3 Cell, Vector3 From, Vector3 To, Vector3 Forward, float Start,
        Quaternion Rotation, Vector3 Size, bool Animate)
    {
        internal GameObject? Model { get; set; }
    }
    private sealed class Helper
    {
        internal Helper(PlayerState player, BotInput input, Vector3 direction, Vector3 aim, float until)
        {
            Player = player;
            Input = input;
            InputId = input.Pointer;
            Direction = direction;
            Aim = aim;
            Until = until;
        }

        internal PlayerState Player { get; }
        internal BotInput Input { get; }
        internal IntPtr InputId { get; }
        internal Vector3 Direction { get; set; }
        internal Vector3 Aim { get; set; }
        internal float Until { get; set; }
        internal Vector3 Move { get; set; }
        internal Vector3 Target { get; set; }
        internal bool Approaching { get; set; }
        internal float NextAim { get; set; }
        internal float NextStrike { get; set; }
        internal int Broken { get; set; }
        internal ushort PunchSequence { get; set; }
    }

    [HarmonyPatch(typeof(BotInput), "Update")]
    private static class HelperMovement
    {
        private static void Postfix(BotInput __instance)
        {
            if (DrivenHelpers.TryGetValue(__instance.Pointer, out var helper))
            {
                __instance.SetMove(helper.Move);
                __instance.AimAt(helper.Target);
            }
        }
    }

    [HarmonyPatch(typeof(PunchController), nameof(PunchController.ServerHandlePunch))]
    private static class HelperPunchDamage
    {
        private static bool Prefix(PunchController __instance)
        {
            var player = __instance.State;
            // The helper animation fires the normal callback; Tick submits the actual punch once.
            return !DrivenHelpers.Values.Any(helper => helper.Player != null && helper.Player.Pointer == player?.Pointer);
        }
    }

    internal static bool AimAtWall(PlayerState player, VoxelNet voxels, out VoxelHit hit)
    {
        hit = default;
        var camera = player.ViewCamera;
        if (camera == null || voxels.World == null) return false;
        var eye = camera.transform.position;
        var direction = camera.transform.forward;
        return voxels.World.Raycast(new float3(eye.x, eye.y, eye.z), new float3(direction.x, direction.y, direction.z), 9, out hit);
    }

    internal int Rebuild(PlayerState player, VoxelNet voxels, int limit)
    {
        var world = voxels.World;
        var camera = player.ViewCamera;
        if (world == null || camera == null) return 0;
        limit = Math.Min(limit, ActionTuning.MaxWallBlocks - planned.Count);
        if (limit <= 0) return 0;
        var eye = camera.transform.position;
        var direction = camera.transform.forward;
        var step = ChunkKey.FromChunk(new int3(1, 1, 1)).MinVoxel.x;
        var voxelSize = VoxelCoord.Centre(new int3(1, 0, 0)).x - VoxelCoord.Centre(default).x;
        var size = Vector3.one * voxelSize;
        var candidates = new PriorityQueue<(int3 Cell, Vector3 Position), (int Group, float Primary, float Secondary)>();
        var chunks = world.TouchedChunkSet.GetEnumerator();
        while (chunks.MoveNext())
        {
            var key = chunks.Current;
            if (!key.InWorld || !world.TryGetEdits(key, out var edits) || !edits.AnyBroken) continue;
            var start = key.MinVoxel;
            var bits = edits.broken;
            var remaining = edits.BrokenCount;
            for (var index = 0; remaining > 0 && index < step * step * step; index++)
            {
                if (!bits.IsSet(index)) continue;
                remaining--;
                var cell = start + VoxelCoord.LocalFromIndex(index);
                if (planned.Contains(cell) || world.IsSolid(cell)) continue;
                var p = VoxelCoord.Centre(cell);
                var position = new Vector3(p.x, p.y, p.z);
                var offset = position - eye;
                var depth = Vector3.Dot(offset, direction);
                candidates.Enqueue((cell, position), RestoreOrder.Priority(depth, offset.sqrMagnitude, voxelSize));
            }
        }
        if (candidates.Count == 0) return 0;

        var count = Math.Min(candidates.Count, limit);
        var selected = 0;
        var now = Time.unscaledTime;
        var waveStart = Math.Max(now, lastScheduled);
        var rubble = NearbyRubble(eye);
        while (selected < count && candidates.TryDequeue(out var candidate, out _))
        {
            var from = candidate.Position - direction * .6f + Vector3.down * .45f;
            if (rubble.Count > 0)
            {
                from = rubble[^1].Position;
                rubble.RemoveAt(rubble.Count - 1);
            }
            var rotation = Quaternion.Euler(25 + selected % 4 * 17, 35 + (selected % 360) * 39, 27);
            lastScheduled = waveStart + RestoreOrder.Stagger(selected, count);
            returning.Enqueue(new ReturningBlock(candidate.Cell, from, candidate.Position, direction, lastScheduled, rotation,
                size, selected < 36 || selected % 24 == 0));
            planned.Add(candidate.Cell);
            selected++;
        }
        return selected;
    }


    private static Bounds Occupied(PlayerState player)
    {
        var controller = player.Motor?.controller;
        var occupied = controller != null ? controller.bounds : new Bounds(player.transform.position, new Vector3(1, 2, 1));
        occupied.Expand(.45f);
        return occupied;
    }

    private static List<(Vector3 Position, float Distance)> NearbyRubble(Vector3 eye)
    {
        var nearby = new List<(Vector3, float)>();
        var pieces = RubblePool.Instance?.live;
        if (pieces == null) return nearby;
        for (var i = 0; i < pieces.Count && nearby.Count < 120; i++)
        {
            var piece = pieces[i];
            if (piece == null) continue;
            var position = piece.Position;
            var distance = (position - eye).sqrMagnitude;
            if (distance < 20.25f) nearby.Add((position, distance));
        }
        nearby.Sort((first, second) => second.Item2.CompareTo(first.Item2));
        return nearby;
    }

    private GameObject MakeReturningBlock(Vector3 from, Vector3 size)
    {
        var model = GameObject.CreatePrimitive(PrimitiveType.Cube);
        model.name = "TikMnG Returning Block";
        var collider = model.GetComponent<Collider>();
        collider.enabled = false;
        UnityEngine.Object.Destroy(collider);
        if (blockMaterial == null)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            if (shader != null)
                blockMaterial = new Material(shader) { color = new Color(.59f, .565f, .52f) };
        }
        var renderer = model.GetComponent<MeshRenderer>();
        if (blockMaterial != null) renderer.sharedMaterial = blockMaterial;
        renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        model.transform.position = from;
        model.transform.localScale = size * .82f;
        return model;
    }

    internal void TickRebuild(PlayerState player)
    {
        if (returning.Count == 0 && awaitingClearance.Count == 0) return;
        var voxels = VoxelNet.Instance;
        var world = voxels?.World;
        if (voxels == null || world == null || !NetworkServer.active) { ClearRebuild(); return; }
        var now = Time.unscaledTime;
        var occupied = Occupied(player);
        if (awaitingClearance.Count > 0 && now >= nextClearanceCheck)
        {
            nextClearanceCheck = now + .2f;
            for (var index = awaitingClearance.Count - 1; index >= 0; index--)
            {
                var block = awaitingClearance[index];
                if (occupied.Intersects(new Bounds(block.To, block.Size))) continue;
                returning.Enqueue(block with { Start = now - .3f, Animate = false });
                awaitingClearance.RemoveAt(index);
            }
        }
        restoredCells.Clear();
        for (var processed = 0; processed < 32 && returning.TryPeek(out var block) && now >= block.Start + .27f; processed++)
        {
            returning.Dequeue();
            var cellBounds = new Bounds(block.To, block.Size);
            if (occupied.Intersects(cellBounds))
            {
                var away = Vector3.ProjectOnPlane(occupied.center - block.To, Vector3.up);
                if (away.sqrMagnitude < .04f) away = -block.Forward;
                if (MoveClearOfWall(player, world, away, out var displacement))
                    occupied = new Bounds(occupied.center + displacement, occupied.size);
            }
            if (block.Model != null) UnityEngine.Object.Destroy(block.Model);
            if (occupied.Intersects(cellBounds))
            {
                block.Model = null;
                awaitingClearance.Add(block);
                continue;
            }
            planned.Remove(block.Cell);
            if (voxels.ServerRestore(block.Cell))
            {
                restoredCells.Add(block.Cell);
                if (now >= nextBrickSound)
                {
                    nextBrickSound = now + .065f;
                    PunchAudio.RubbleTick(new Il2CppSystem.Nullable<Vector3>(block.To));
                }
            }
        }
        var shown = 0;
        foreach (var block in returning)
        {
            if (now < block.Start || shown >= 48) break;
            shown++;
            if (!block.Animate || now >= block.Start + .27f && block.Model == null) continue;
            block.Model ??= MakeReturningBlock(block.From, block.Size);
            var progress = Mathf.Clamp01((now - block.Start) / .27f);
            var eased = progress * progress * (3 - 2 * progress);
            var position = Vector3.Lerp(block.From, block.To, eased);
            position.y += Mathf.Sin(Mathf.PI * progress) * .22f;
            block.Model.transform.SetPositionAndRotation(position, Quaternion.Slerp(block.Rotation, Quaternion.identity, eased));
        }
        if (restoredCells.Count > 0)
        {
            ClearEmbeddedRubble();
            if (planned.Count == 0) Plugin.Output.LogInfo("Duvar örme animasyonu tamamlandı.");
        }
    }

    private void ClearEmbeddedRubble()
    {
        var pool = RubblePool.Instance;
        if (pool == null) return;
        var pieces = pool.live;
        for (var index = pieces.Count - 1; index >= 0; index--)
        {
            var piece = pieces[index];
            if (piece != null && restoredCells.Contains(VoxelCoord.FromWorld(ToFloat3(piece.Position))))
                pool.Recover(piece, "restored wall");
        }
    }

    private bool MoveClearOfWall(PlayerState player, VoxelWorld world, Vector3 away, out Vector3 movedBy)
    {
        movedBy = Vector3.zero;
        var motor = player.Motor;
        var controller = motor?.controller;
        if (motor == null || controller == null) return false;
        var back = Vector3.ProjectOnPlane(away, Vector3.up).normalized;
        if (back.sqrMagnitude < .5f) return false;
        var feet = motor.Feet;
        var bounds = Occupied(player);
        for (var step = 1; step <= 10; step++)
        {
            var displacement = back * (step * .14f);
            var candidate = feet + displacement;
            if (!world.CapsuleFits(ToFloat3(candidate + Vector3.up * .06f), controller.height, controller.radius))
                break;
            if (!world.IsSolid(VoxelCoord.FromWorld(ToFloat3(candidate - Vector3.up * .10f)))) continue;
            var moved = new Bounds(bounds.center + displacement, bounds.size);
            if (IntersectsPlanned(moved)) continue;
            motor.ServerTeleport(candidate, player.Look?.Yaw ?? player.transform.eulerAngles.y, true);
            movedBy = displacement;
            Plugin.Output.LogInfo("Duvar örülürken oyuncu güvenli alana çekildi.");
            return true;
        }
        return false;
    }

    internal void ClearRebuild()
    {
        foreach (var block in returning)
            if (block.Model != null) UnityEngine.Object.Destroy(block.Model);
        returning.Clear();
        awaitingClearance.Clear();
        planned.Clear();
        lastScheduled = 0;
        nextClearanceCheck = 0;
    }

    private bool IntersectsPlanned(Bounds bounds)
    {
        var low = VoxelCoord.FromWorld(ToFloat3(bounds.min));
        var high = VoxelCoord.FromWorld(ToFloat3(bounds.max));
        for (var x = low.x; x <= high.x; x++)
        for (var y = low.y; y <= high.y; y++)
        for (var z = low.z; z <= high.z; z++)
            if (planned.Contains(new int3(x, y, z))) return true;
        return false;
    }

    internal void Dispose()
    {
        ClearRebuild();
        StopHelper();
        if (blockMaterial != null) UnityEngine.Object.Destroy(blockMaterial);
    }

    internal int StartHelpers(PlayerState player, VoxelNet voxels, int seconds, int repeats)
    {
        var now = Time.unscaledTime;
        var requested = Math.Clamp(repeats, 1, MaxHelpers);
        var available = MaxHelpers - helpers.Count;
        if (available == 0)
        {
            foreach (var helper in helpers.Take(requested)) helper.Until = Math.Max(helper.Until, now + seconds);
            return requested;
        }
        if (player.ViewCamera == null || voxels.World == null) return 0;
        var aim = player.ViewCamera.transform.forward;
        var direction = HorizontalAim(player, voxels.World);
        var spawned = 0;
        while (spawned < Math.Min(available, requested) && TryFindEscortSpot(player, direction, out var position))
        {
            var count = BotSpawner.bots.Count;
            if (BotSpawner.Spawn(1, "idle") < 1 || BotSpawner.bots.Count <= count) break;
            var actor = BotSpawner.bots[count];
            var motor = actor?.Motor;
            var input = motor?.Input?.TryCast<BotInput>();
            if (actor == null || motor == null || input == null)
            {
                if (actor != null)
                {
                    BotSpawner.bots.Remove(actor);
                    NetworkServer.Destroy(actor.gameObject);
                }
                break;
            }
            var yaw = Mathf.Atan2(direction.x, direction.z) * Mathf.Rad2Deg;
            motor.ServerTeleport(position, yaw, true);
            var roster = CharacterRoster.Current;
            if (roster != null && actor.GetComponent<PlayerAppearance>() is { } appearance)
                DressHelper(appearance, roster, actor.slot);
            var helper = new Helper(actor, input, direction, aim, now + seconds)
                { Target = player.EyePosition + aim * 3f, PunchSequence = (ushort)spawned };
            helpers.Add(helper);
            DrivenHelpers.Add(input.Pointer, helper);
            spawned++;
        }
        if (spawned > 0) Plugin.Output.LogInfo($"Yardımcılar geldi · {spawned} karakter · {seconds} sn.");
        return spawned;
    }

    private static Vector3 HorizontalAim(PlayerState owner, VoxelWorld world)
    {
        var flat = Vector3.ProjectOnPlane(owner.ViewCamera.transform.forward, Vector3.up);
        if (flat.sqrMagnitude > .02f) return flat.normalized;
        var outward = EscapeDistance.Outward(world, ToFloat3(owner.Motor.Feet));
        flat = new Vector3(outward.x, 0, outward.z);
        return flat.sqrMagnitude > .02f ? flat.normalized : owner.transform.forward;
    }

    private bool TryFindEscortSpot(PlayerState owner, Vector3 forward, out Vector3 position)
    {
        var feet = owner.Motor.Feet;
        var side = Vector3.Cross(Vector3.up, forward);
        var world = VoxelNet.Instance.World;
        foreach (var angle in EscortAngles)
        {
            var a = angle * Mathf.Deg2Rad;
            var sample = feet + (side * Mathf.Cos(a) + forward * Mathf.Sin(a)) * .95f;
            var origin = sample + Vector3.up * .6f;
            Vector3 floor;
            if (world.Raycast(ToFloat3(origin), new float3(0, -1, 0), 1.4f, out var voxel) && voxel.normal.y > 0)
                floor = new Vector3(voxel.point.x, voxel.point.y, voxel.point.z);
            else if (Physics.Raycast(origin, Vector3.down, out RaycastHit ground, 1.4f,
                Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore) && ground.normal.y >= .55f)
                floor = ground.point;
            else continue;
            var spot = floor + Vector3.up * .035f;
            if (!world.CapsuleFits(ToFloat3(spot), owner.Motor.controller.height, .27f)) continue;
            if (helpers.Any(h => h.Player != null && (h.Player.Motor.Feet - spot).sqrMagnitude < .49f)) continue;
            position = spot;
            if (!Physics.CheckCapsule(position + Vector3.up * .34f, position + Vector3.up * 1.48f, .27f,
                    Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore)) return true;
        }
        position = default;
        return false;
    }

    private static readonly int[] EscortAngles = { 0, 180, -45, -135, -90, 45, 135, 90 };

    private void DressHelper(PlayerAppearance appearance, CharacterRoster roster, int slot)
    {
        var look = roster.ForSlot(slot);
        var topCount = roster.TopCount;
        var bottomCount = roster.BottomCount;
        if (topCount < 1 || bottomCount < 1) return;
        var outfits = topCount * bottomCount;
        var start = System.Random.Shared.Next(outfits);
        for (var i = 0; i < outfits; i++)
        {
            var choice = (start + i) % outfits;
            var clothes = ((byte)(choice % topCount), (byte)(choice / topCount));
            if ((outfits > 1 && clothes == lastOutfit) || helperOutfits.Contains(clothes)) continue;
            look.top = clothes.Item1;
            look.bottom = clothes.Item2;
            if (!appearance.ServerSetLook(roster.Validate(look))) continue;
            if (helperOutfits.Count + 1 >= outfits) helperOutfits.Clear();
            helperOutfits.Add(clothes);
            lastOutfit = clothes;
            return;
        }
    }

    private static float3 ToFloat3(Vector3 point) => new(point.x, point.y, point.z);

    internal void Tick()
    {
        if (helpers.Count == 0) return;
        var now = Time.unscaledTime;
        var voxels = VoxelNet.Instance;
        var world = voxels?.World;
        if (world == null || !NetworkServer.active)
        {
            StopHelper();
            return;
        }
        for (var i = helpers.Count - 1; i >= 0; i--)
        {
            var helper = helpers[i];
            if (now >= helper.Until || helper.Player == null || helper.Player.Motor == null || helper.Input == null)
            {
                RemoveHelper(helper);
                helpers.RemoveAt(i);
                continue;
            }
            if (now < helper.NextAim) continue;
            helper.NextAim = now + .13f;
            var owner = PlayerState.Local;
            if (owner == null || owner.ViewCamera == null) continue;
            helper.Aim = owner.ViewCamera.transform.forward;
            helper.Direction = HorizontalAim(owner, world);
            var toOwner = owner.Motor.Feet - helper.Player.Motor.Feet;
            if (toOwner.sqrMagnitude > 3.5f * 3.5f)
            {
                helper.Target = owner.EyePosition;
                if (TryFindEscortSpot(owner, helper.Direction, out var spot))
                {
                    helper.Player.Motor.ServerTeleport(spot, owner.Look.Yaw, true);
                    helper.Move = Vector3.zero;
                }
                else helper.Move = HasHelperFooting(helper, world, toOwner)
                    ? Vector3.ProjectOnPlane(toOwner, Vector3.up).normalized : Vector3.zero;
                continue;
            }
            var tuning = PunchTuning.Current;
            if (tuning == null || !float.IsFinite(tuning.baseDamage) || tuning.baseDamage <= 0) continue;
            if (!FindHelperWall(helper, world, tuning.reach, out var hit))
            {
                helper.Approaching = false;
                helper.Move = Vector3.zero;
                continue;
            }
            helper.Target = new Vector3(hit.point.x, hit.point.y, hit.point.z);
            var walkDirection = Vector3.ProjectOnPlane(helper.Target - helper.Player.EyePosition, Vector3.up).normalized;
            var stopDistance = Mathf.Clamp(tuning.reach * .78f, .62f, 1.10f);
            helper.Approaching = hit.distance > stopDistance + (helper.Approaching ? 0 : .22f) &&
                HasHelperFooting(helper, world, walkDirection);
            helper.Move = helper.Approaching ? walkDirection * .65f : Vector3.zero;
            if (helper.Approaching || hit.distance > tuning.reach || now < helper.NextStrike) continue;
            helper.Input.AimAt(helper.Target);
            helper.NextStrike = now + ActionTuning.HelperStrikeInterval;
            helper.Input.Run(BotScript.FromJson(
                @"{""name"":""TikMnG Yardımcı"",""steps"":[{""op"":""punch"",""seconds"":0.32,""rate"":1}]}"));
            var punch = helper.Player.GetComponent<PunchController>();
            if (punch == null) continue;
            var operation = punch.BuildOp(hit.voxel, hit.normal, tuning.baseDamage * ActionTuning.HelperPunchMultiplier,
                ++helper.PunchSequence, helper.Player.slot, false);
            if (operation.Stage < 4 && operation.ShockwaveLevel == 0)
                operation = PunchOp.Make(operation.AnchorVoxel, operation.FaceNormal, 4, 0, operation.dCell16,
                    operation.seq, operation.slot);
            helper.Broken += voxels!.ServerApplyPunch(ref operation, 1f).cubesBroken;
            PunchAudio.Clonk(new Il2CppSystem.Nullable<Vector3>(helper.Target));
        }
    }

    private static bool FindHelperWall(Helper helper, VoxelWorld world, float reach, out VoxelHit hit)
    {
        var eye = helper.Player.EyePosition;
        var tangent = Vector3.Cross(Vector3.up, helper.Direction);
        var radius = helper.Player.Motor.controller?.radius ?? .27f;
        hit = default;
        var best = float.PositiveInfinity;
        var bestAngle = float.PositiveInfinity;
        var outward = EscapeDistance.Outward(world, ToFloat3(eye));
        var exitDirection = new Vector3(outward.x, outward.y, outward.z);
        for (var scan = 0; scan < SweepAngles.Length; scan++)
        {
            var yaw = SweepAngles[scan];
            if (Mathf.Abs(yaw) > bestAngle) break;
            var rotation = Quaternion.AngleAxis(yaw, Vector3.up);
            for (int lane = 0; lane < 4; lane++)
            {
                var direction = rotation * (lane == 1 ? helper.Direction : helper.Aim);
                var offset = lane switch { 1 => Vector3.up * .27f, 2 => tangent * radius, 3 => -tangent * radius, _ => Vector3.zero };
                if (!world.Raycast(ToFloat3(eye + offset), ToFloat3(direction), 5.5f, out var candidate) ||
                    world.IsUnbreakable(candidate.voxel)) continue;
                if (candidate.distance > reach && !HasHelperFooting(helper, world, direction)) continue;
                // Among walls in the same view cone, prefer forward progress toward the exit.
                var score = -Vector3.Dot(direction, exitDirection) * candidate.distance;
                if (score >= best) continue;
                hit = candidate;
                best = score;
                bestAngle = Mathf.Abs(yaw);
            }
        }
        return float.IsFinite(best);
    }

    private static bool HasHelperFooting(Helper helper, VoxelWorld world, Vector3 direction)
    {
        var feet = helper.Player.Motor.Feet;
        var radius = helper.Player.Motor.controller?.radius ?? .27f;
        direction = Vector3.ProjectOnPlane(direction, Vector3.up).normalized;
        var ahead = feet + direction * (radius + .2f) - Vector3.up * .05f;
        var side = Vector3.Cross(Vector3.up, direction) * (radius * .6f);
        // Query voxel state immediately, including while the native collision mesh is rebuilding.
        return world.IsSolid(VoxelCoord.FromWorld(ToFloat3(ahead))) &&
            world.IsSolid(VoxelCoord.FromWorld(ToFloat3(ahead - side))) &&
            world.IsSolid(VoxelCoord.FromWorld(ToFloat3(ahead + side)));
    }

    internal void StopHelper()
    {
        foreach (var helper in helpers) RemoveHelper(helper);
        helpers.Clear();
    }

    private static void RemoveHelper(Helper helper)
    {
        DrivenHelpers.Remove(helper.InputId);
        if (helper.Player != null)
        {
            BotSpawner.bots.Remove(helper.Player);
            if (NetworkServer.active) NetworkServer.Destroy(helper.Player.gameObject);
            Plugin.Output.LogInfo($"Yardımcı ayrıldı · {helper.Broken} blok kırıldı.");
        }
    }
}
