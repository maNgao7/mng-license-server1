using Il2Cpp;
using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private readonly Dictionary<IntPtr, Creature> combatCreatures = new();
    private readonly Queue<Enemy> combatPathQueue = new();
    private readonly HashSet<IntPtr> queuedCombatPaths = new();
    private readonly Dictionary<(int, int), List<Creature>> crowdCells = new();
    private float nextCrowdSteering;
    private int crowdArrivalSequence, crowdSteeringUpdates, crowdFlankRoutes, crowdMoveHolds;

    private void SetCreaturePlayerCollision(Creature creature, bool ignore)
    {
        if (playerCapsule == null || creature.Enemy == null) return;
        // Melee damage is distance/line-of-sight driven; a live horde must not move the player's rigidbody.
        var enemy = creature.Enemy;
        if (enemy.mainCollider != null) Physics.IgnoreCollision(playerCapsule, enemy.mainCollider, ignore);
        if (enemy.armCollider != null) Physics.IgnoreCollision(playerCapsule, enemy.armCollider, ignore);
    }

    private bool RequestCombatPath(Enemy enemy)
    {
        if ((!nextArenaPath.TryGetValue(enemy.Pointer, out var next) || Time.time >= next)
            && queuedCombatPaths.Add(enemy.Pointer)) combatPathQueue.Enqueue(enemy);
        return enemy.pathCornerCount > 1;
    }

    private void ClearCombatPursuit()
    {
        combatCreatures.Clear(); combatPathQueue.Clear(); queuedCombatPaths.Clear(); crowdCells.Clear();
        nextCrowdSteering = 0;
    }

    private void UpdateCombatPursuit()
    {
        if (!CombatRunning || menu || GameManager.Instance.IsPaused) return;
        if (Time.time >= nextCrowdSteering)
        {
            nextCrowdSteering = Time.time + .12f;
            foreach (var cell in crowdCells.Values) cell.Clear();
            foreach (var creature in creatures)
            {
                var enemy = creature.Enemy;
                if (enemy == null || enemy.IsDead || enemy.isHeld || enemy.IsFreeFall) continue;
                var position = enemy.rb.position;
                var target = CreatureTarget(creature);
                float distance = new Vector2(position.x - target.x, position.z - target.z).magnitude;
                bool notClosing = creature.CrowdLastDistance - distance < .025f;
                creature.StuckFor = !creature.CrowdHold && distance > CombatBalance.Reach(creature.Kind) + .8f && notClosing
                    ? Math.Min(3, creature.StuckFor + .12f) : 0;
                creature.CrowdLastDistance = distance;
                creature.CrowdPosition = position;
                var key = ((int)MathF.Floor(position.x / 4), (int)MathF.Floor(position.z / 4));
                if (!crowdCells.TryGetValue(key, out var cell)) crowdCells[key] = cell = new List<Creature>();
                cell.Add(creature);
            }
            foreach (var creature in creatures)
            {
                var enemy = creature.Enemy;
                if (enemy == null || enemy.IsDead || enemy.isHeld || enemy.IsFreeFall) continue;
                var position = creature.CrowdPosition;
                var key = ((int)MathF.Floor(position.x / 4), (int)MathF.Floor(position.z / 4));
                Vector3 separation = Vector3.zero; int neighbours = 0, examined = 0;
                for (int x = key.Item1 - 1; x <= key.Item1 + 1 && examined < 96; x++)
                    for (int z = key.Item2 - 1; z <= key.Item2 + 1 && examined < 96; z++)
                    {
                        if (!crowdCells.TryGetValue((x, z), out var cell)) continue;
                        foreach (var other in cell)
                        {
                            if (other == creature || Math.Abs(other.CrowdPosition.y - position.y) > 1.5f) continue;
                            if (++examined > 96) break;
                            var away = position - other.CrowdPosition; away.y = 0;
                            float distance = away.magnitude;
                            if (distance > 3.8f) continue;
                            neighbours++;
                            float spacing = Math.Min(2.4f, .34f * (CreatureSize(creature.Kind) + CreatureSize(other.Kind)) + .2f);
                            if (distance >= spacing) continue;
                            if (distance < .02f) away = new Vector3(Mathf.Cos(creature.ApproachAngle), 0, Mathf.Sin(creature.ApproachAngle));
                            else away /= distance;
                            separation += away * Mathf.Clamp01((spacing - distance) / spacing);
                        }
                    }
                creature.CrowdNeighbours = neighbours;
                creature.CrowdAvoidance = Vector3.ClampMagnitude(separation, 1);
            }
            crowdSteeringUpdates++;
        }
        // FIFO keeps late arrivals from starving behind earlier creatures when the path budget is full.
        for (int i = 0; i < 8 && combatPathQueue.Count > 0; i++)
        {
            var enemy = combatPathQueue.Dequeue(); queuedCombatPaths.Remove(enemy.Pointer);
            if (!creaturePointers.Contains(enemy.Pointer) || enemy.IsDead || enemy.isHeld || enemy.IsFreeFall) continue;
            BuildCombatPath(enemy);
        }
    }

    private Vector3 CrowdApproachTarget(Creature creature, Vector3 player)
    {
        float reach = CombatBalance.Reach(creature.Kind);
        var position = creature.Enemy.rb.position;
        var radial = position - player; radial.y = 0;
        float distance = radial.magnitude;
        if (distance < reach) return player;
        // Give attackers different contact points instead of driving every rigidbody into the player centre.
        float radius = Math.Min(1.3f, reach * .68f);
        var goal = player + new Vector3(Mathf.Cos(creature.ApproachAngle), 0, Mathf.Sin(creature.ApproachAngle)) * radius;
        if (creature.CrowdNeighbours >= 4 && creature.StuckFor >= .6f && distance > reach + .8f && distance < 12
            && Math.Abs(player.y - position.y) < 1.8f)
        {
            var side = new Vector3(-radial.z, 0, radial.x).normalized;
            if (Mathf.Sin(creature.ApproachAngle) < 0) side = -side;
            var flank = position + side * 2.5f - radial.normalized;
            if (!BehindMissionBoard(flank) && SampleCombatNav(flank, out var nav, .8f)
                && Math.Abs(nav.position.y - (position.y - .4f)) < 1)
            { goal = nav.position + Vector3.up * .8f; crowdFlankRoutes++; }
        }
        return goal;
    }

    private static bool BeforeCrowdMove(Enemy __instance, ref Vector3 targetDirection, ref float targetSpeed)
    {
        var mod = Current;
        if (!mod.ready || !mod.CombatRunning || !mod.combatCreatures.TryGetValue(__instance.Pointer, out var creature)
            || __instance.IsDead || __instance.isHeld || __instance.IsFreeFall || __instance.knockbackTimer > 0) return true;
        if (creature.CrowdHold || creature.Attack.Started >= 0)
        {
            __instance.currentMoveSpeed = 0;
            var velocity = __instance.rb.linearVelocity;
            __instance.rb.linearVelocity = new Vector3(0, velocity.y, 0);
            mod.crowdMoveHolds++; return false;
        }
        if (targetSpeed > 0 && targetDirection.sqrMagnitude > .01f && creature.CrowdAvoidance.sqrMagnitude > .001f)
        {
            targetDirection = (targetDirection.normalized + creature.CrowdAvoidance * .85f).normalized;
            // Native physics and NavMesh corners still enforce world walls and stair geometry.
            targetSpeed *= Mathf.Lerp(1, .7f, creature.CrowdAvoidance.magnitude);
        }
        return true;
    }

    private object PursuitSnapshot()
    {
        int alive = 0, approaching = 0, moving = 0, holding = 0, stalled = 0, noPath = 0;
        foreach (var creature in creatures)
        {
            var enemy = creature.Enemy;
            if (enemy == null || enemy.IsDead || creature.Friendly) continue;
            alive++;
            if (creature.CrowdHold) holding++;
            else if (!enemy.isHeld && !enemy.IsFreeFall)
            {
                approaching++;
                if (new Vector2(enemy.rb.linearVelocity.x, enemy.rb.linearVelocity.z).sqrMagnitude > .04f) moving++;
                if (creature.StuckFor > 1) stalled++;
                if (enemy.pathCornerCount < 2) noPath++;
            }
        }
        return new { alive, approaching, moving, holding, stalled, noPath, queuedPaths = combatPathQueue.Count,
            crowdSteeringUpdates, crowdFlankRoutes, crowdMoveHolds, playerInterpolation = Player.Instance.rb.interpolation.ToString() };
    }
}
