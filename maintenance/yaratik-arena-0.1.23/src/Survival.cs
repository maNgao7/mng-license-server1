using Il2Cpp;
using UnityEngine;
using UnityEngine.AI;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private sealed class CreatureAttack
    {
        public float Started = -1, Next;
        public bool Contact;
        public Vector3 VisualPosition;
        public Quaternion VisualRotation, ArmRotation;
        public Transform Arm;
        public Creature Target;
    }

    private readonly SurvivalState survival = new();
    private bool roundDied;
    private float nextSurvivalStep, playerHitAt = -100;
    private int creatureSwings, creatureHits, combatPaths, combatPathFrame, combatPathBudget;
    private string survivalError = "";
    private string combatPathDiagnostic = "";
    private Vector3 combatGoal;

    private bool CombatRunning => settings.EnemyAttacks && !roundDied && !rules.Won && !roundTimedOut;

    private void ResetCombatPaths()
    {
        nextArenaPath.Clear();
        combatPathQueue.Clear(); queuedCombatPaths.Clear();
        foreach (var creature in creatures)
        {
            FinishCreatureSwing(creature);
            creature.CrowdHold = false;
            if (creature.Enemy == null || creature.Enemy.IsDead) continue;
            creature.Enemy.pathCornerCount = 0; creature.Enemy.pathTimer = 100;
        }
    }

    private void ResetSurvival()
    {
        SetCombatTestWall(false);
        foreach (var creature in creatures) FinishCreatureSwing(creature);
        survival.Configure(settings.PlayerHealth);
        survival.Reset(Time.time); roundDied = false; playerHitAt = -100; playerLastDamage = 0;
        ClearDefeatPortrait();
    }

    private bool BuildCombatPath(Enemy enemy)
    {
        if (!CombatRunning) return false;
        if (nextArenaPath.TryGetValue(enemy.Pointer, out var next) && Time.time < next) return enemy.pathCornerCount > 1;
        if (combatPathFrame != Time.frameCount) { combatPathFrame = Time.frameCount; combatPathBudget = 8; }
        if (combatPathBudget <= 0) return enemy.pathCornerCount > 1;
        combatPathBudget--;
        nextArenaPath[enemy.Pointer] = Time.time + .6f + (Math.Abs((long)enemy.Pointer % 13) * .025f);
        combatCreatures.TryGetValue(enemy.Pointer, out var creature);
        Vector3 target = creature != null ? CreatureTarget(creature) : Player.Instance.rb.position;
        if (creature != null && !PrisonActive && !creature.Friendly && creature.Target == null)
            target = CrowdApproachTarget(creature, target);
        if (PrisonActive && creature?.Target == null && creature?.Friendly != true)
        {
            Vector3 outward = enemy.rb.position - prisonAnchor; outward.y = 0;
            if (outward.sqrMagnitude < .1f) outward = Vector3.forward;
            target = prisonAnchor + outward.normalized * 3.1f;
        }
        target.y -= .8f;
        if (Physics.Raycast(target + Vector3.up * .3f, Vector3.down, out var floor, 30, 1, QueryTriggerInteraction.Ignore))
            target = floor.point;
        if (!SampleCombatNav(enemy.rb.position, out var from, 1.8f)) { combatPathDiagnostic = "source-not-on-navigation"; return false; }
        if (!SampleCombatNav(target, out var to, 2)) { combatPathDiagnostic = "target-not-on-navigation"; return false; }
        combatGoal = to.position;
        enemy.path ??= new NavMeshPath();
        if (!CalculateCombatPath(from.position, to.position, enemy.path) || enemy.path.status == NavMeshPathStatus.PathInvalid)
        { combatPathDiagnostic = "path-invalid"; return false; }
        combatPathDiagnostic = enemy.path.status.ToString();
        int count = ReadPathCorners(enemy.path);
        if (count > enemy.pathCorners.Length) return false;
        Vector3 previous = from.position;
        for (int i = 0; i < count; i++)
        {
            var corner = autoCornerBuffer[i];
            if (corner.y > 11 || Math.Abs(corner.x) > CombatHalfX || Math.Abs(corner.z) > CombatHalfZ || PathEntersBoardBackstage(previous, corner))
            { combatPathDiagnostic = "path-outside-arena"; return false; }
            previous = corner;
        }
        for (int i = 0; i < count; i++) enemy.pathCorners[i] = autoCornerBuffer[i];
        enemy.pathCornerCount = count; enemy.cornerIndex = count > 1 ? 1 : 0;
        enemy.pathTimer = 0; enemy.pathMaxTime = .9f; combatPaths++;
        return count > 1;
    }

    private bool CanCreatureReachPlayer(Enemy enemy, bool throughCage = false)
    {
        Vector3 offset = Player.Instance.rb.position - enemy.rb.position;
        if (Math.Abs(offset.y) > 1.35f || offset.x * offset.x + offset.z * offset.z > 1.9f * 1.9f) return false;
        return throughCage && PrisonActive || !Physics.Linecast(enemy.rb.position + Vector3.up * .6f,
            Player.Instance.rb.position + Vector3.up * .15f, Vacuum.Instance.wallLayer, QueryTriggerInteraction.Ignore);
    }

    private void FinishCreatureSwing(Creature creature)
    {
        var attack = creature.Attack;
        if (attack.Started < 0) return;
        if (creature.Enemy != null)
        {
            creature.Enemy.visual.localPosition = attack.VisualPosition;
            creature.Enemy.visual.localRotation = attack.VisualRotation;
            if (attack.Arm != null) attack.Arm.localRotation = attack.ArmRotation;
        }
        attack.Started = -1; attack.Arm = null;
        AnimateHelperGrip(creature, 0);
    }

    private void UpdateSurvival()
    {
        bool paused = menu || GameManager.Instance.IsPaused;
        survival.Regenerate(Time.time, paused || roundDied || survival.Dead || rules.Won || roundTimedOut);
        if (paused || Time.time < nextSurvivalStep) return;
        nextSurvivalStep = Time.time + .06f;
        try
        {
            foreach (var creature in creatures)
            {
                var enemy = creature.Enemy; var attack = creature.Attack;
                bool available = CombatRunning && enemy != null && !enemy.IsDead && !enemy.isHeld && !enemy.IsFreeFall
                    && enemy.knockbackTimer <= 0 && enemy.panicTimer <= 0 && enemy.CurrentState == Enemy.State.Roaming;
                creature.CrowdHold = false;
                if (!available) { FinishCreatureSwing(creature); continue; }
                UpdateBossSteps(creature);
                CreatureTarget(creature);
                bool inReach = CanReachTarget(creature, true);
                creature.CrowdHold = inReach || attack.Started >= 0;
                if (attack.Started < 0)
                {
                    if (Time.time < attack.Next || !inReach) continue;
                    attack.Started = Time.time; attack.Contact = false;
                    attack.Target = creature.Target;
                    attack.VisualPosition = enemy.visual.localPosition; attack.VisualRotation = enemy.visual.localRotation;
                    attack.Arm = enemy.fakeRagdoll?.rightArm?.bone;
                    if (attack.Arm != null) attack.ArmRotation = attack.Arm.localRotation;
                    creatureSwings++;
                }
                enemy.pathCornerCount = 0;
                Vector3 facing = (attack.Target != null && attack.Target.Enemy != null ? attack.Target.Enemy.rb.position : Player.Instance.rb.position) - enemy.rb.position; facing.y = 0;
                if (facing.sqrMagnitude > .01f) enemy.visual.rotation = Quaternion.LookRotation(facing.normalized);
                attack.VisualRotation = enemy.visual.localRotation;
                var velocity = enemy.rb.linearVelocity; enemy.rb.linearVelocity = new Vector3(0, velocity.y, 0);
                float age = Time.time - attack.Started;
                if (!attack.Contact && age >= CombatBalance.Windup(creature.Kind))
                {
                    attack.Contact = true;
                    if (attack.Target != null) StrikeCreature(creature);
                    else if (!creature.Friendly && creature.Target == null && CanReachTarget(creature)
                        && survival.Hit(Time.time, creature.Username, CombatBalance.Damage(creature.Kind, survival.MaximumHealth, settings.CreatureDamage), PrisonActive))
                    {
                        creatureHits++; playerHitAt = Time.time;
                        playerLastDamage = CombatBalance.Damage(creature.Kind, survival.MaximumHealth, settings.CreatureDamage);
                        if (Player.Instance.damageClip != null) Player.Instance.audioSource.PlayOneShot(Player.Instance.damageClip, .45f);
                        if (survival.Dead) { EndSurvivalRound(); break; }
                    }
                }
                if (age >= CombatBalance.SwingDuration(creature.Kind))
                {
                    FinishCreatureSwing(creature);
                    attack.Next = Time.time + CombatBalance.Recovery(creature.Kind, settings.CreatureAttackInterval) + (Math.Abs((long)enemy.Pointer % 11) * .025f);
                }
            }
        }
        catch (Exception error) { survivalError = error.Message; MelonLoader.MelonLogger.Error("Survival: " + error); }
    }

    private void AnimateCreatureAttacks()
    {
        if (!ready || failed || menu || GameManager.Instance.IsPaused) return;
        foreach (var creature in creatures)
        {
            var attack = creature.Attack;
            if (attack.Started < 0 || creature.Enemy == null || creature.Enemy.IsDead) continue;
            float age = Time.time - attack.Started;
            float preparation = CombatBalance.Windup(creature.Kind) * .74f;
            float swing = age < preparation ? -Mathf.Sin(age / preparation * Mathf.PI * .5f) * .5f
                : Mathf.Sin(Mathf.Clamp01((age - preparation) / (CombatBalance.SwingDuration(creature.Kind) - preparation)) * Mathf.PI);
            creature.Enemy.visual.localPosition = attack.VisualPosition
                + (Vector3.up * -.08f + attack.VisualRotation * Vector3.forward * .2f) * Math.Max(0, swing);
            if (attack.Arm != null) attack.Arm.localRotation = attack.ArmRotation * Quaternion.Euler(-swing * 95, 0, swing * 15);
            else creature.Enemy.visual.localRotation = attack.VisualRotation * Quaternion.Euler(swing * 20, 0, 0);
            AnimateHelperGrip(creature, swing);
        }
    }

    private void EndSurvivalRound()
    {
        roundDied = true; roundTimedOut = true; rules.FinishRound(false);
        StopAirDash(); StopAutoEffects();
        Player.Instance.rb.linearVelocity = Vector3.zero;
        Inventory.Instance.DisableAllWeapons();
        foreach (var creature in creatures) FinishCreatureSwing(creature);
        lastRoundRecap = highlights.Finish(rules.Round, false, Time.time, rules.Wins);
        ClearRoundBlood(); restartAt = Time.time + 5;
        RefreshDefeatPortrait();
    }
}
