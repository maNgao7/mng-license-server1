using Il2Cpp;
using UnityEngine;
using Object = UnityEngine.Object;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private readonly List<Creature> helpers = new();
    private int helperHits, helperDamageTaken, bossSteps;
    private float shakeUntil, shakePower;
    private Quaternion shakeBase;
    private bool shakeApplied, teamDamage;
    private Material helperGlove, helperCuff;

    private void EquipHelper(Creature creature)
    {
        EquipHeldNativeBat(creature);
    }

    private void RemoveHelperGear(Creature creature)
    {
        if (creature.Hand != null) { creature.Hand.gameObject.SetActive(false); Object.Destroy(creature.Hand.gameObject); }
        if (creature.Forearm != null) { creature.Forearm.gameObject.SetActive(false); Object.Destroy(creature.Forearm.gameObject); }
        creature.Hand = creature.Club = creature.Forearm = null; creature.ClubOnHand = false;
    }

    private Vector3 CreatureTarget(Creature creature)
    {
        if (creature.Attack.Started >= 0 && creature.Attack.Target?.Enemy != null && !creature.Attack.Target.Enemy.IsDead)
        { creature.Target = creature.Attack.Target; return creature.Target.Enemy.rb.position; }
        if (Time.time >= creature.NextTarget || creature.Target != null && (creature.Target.Enemy == null || creature.Target.Enemy.IsDead))
        {
            creature.NextTarget = Time.time + .45f;
            var previous = creature.Target; creature.Target = null;
            float best = creature.Friendly ? float.MaxValue : Vector3.Distance(creature.Enemy.rb.position, Player.Instance.rb.position);
            var candidates = creature.Friendly ? creatures : helpers;
            foreach (var candidate in candidates)
            {
                if (candidate == creature || candidate.Friendly == creature.Friendly || candidate.Enemy == null || candidate.Enemy.IsDead || candidate.Enemy.isHeld) continue;
                float distance = Vector3.Distance(creature.Enemy.rb.position, candidate.Enemy.rb.position);
                if (distance < best) { best = distance; creature.Target = candidate; }
            }
            if (previous != creature.Target) nextArenaPath.Remove(creature.Enemy.Pointer);
        }
        if (creature.Target != null) return creature.Target.Enemy.rb.position;
        return Player.Instance.rb.position + (creature.Friendly ? Player.Instance.mainCamera.transform.right * 2.5f : Vector3.zero);
    }

    private bool CanReachTarget(Creature creature, bool throughCage = false)
    {
        if (creature.Friendly && creature.Target == null) return false;
        Vector3 target = CreatureTarget(creature);
        Vector3 offset = target - creature.Enemy.rb.position;
        float reach = CombatBalance.Reach(creature.Kind);
        if (offset.x * offset.x + offset.z * offset.z > reach * reach) return false;
        var body = creature.Enemy.mainCollider.bounds;
        float targetFeet = target.y - (creature.Target == null ? .85f : .1f);
        // Standing on a living creature is not a safe platform. World geometry still blocks the strike below.
        if (targetFeet > body.max.y + Math.Max(2, reach * .65f) || target.y < body.min.y - 1.2f) return false;
        // A low ray reaches the player without turning a giant's tall body into wall penetration.
        return throughCage && PrisonActive && creature.Target == null || !Physics.Linecast(
            creature.Enemy.rb.position + Vector3.up * .6f, target + Vector3.up * .15f,
            Vacuum.Instance.wallLayer, QueryTriggerInteraction.Ignore);
    }

    private void StrikeCreature(Creature attacker)
    {
        var target = attacker.Attack.Target;
        if (target == null || target.Enemy == null || target.Enemy.IsDead || !CanReachTarget(attacker)) return;
        teamDamage = true;
        try
        {
            float before = target.Enemy.health;
            target.Enemy.Damage(attacker.Friendly ? 6 : CombatBalance.Damage(attacker.Kind, (int)target.Enemy.maxHealth, settings.CreatureDamage, balanceWeaponLevel), Vector3.zero,
                target.Enemy.GrabCenter, 0, settings.BloodEnabled, false, null);
            if (target.Enemy.health < before)
            {
                if (attacker.Friendly) { helperHits++; PlayTone(420, .045f); }
                else helperDamageTaken += (int)(before - target.Enemy.health);
                if (target.Enemy.IsDead) CountDeath(target.Enemy);
            }
        }
        finally { teamDamage = false; }
    }

    private void UpdateBossSteps(Creature creature)
    {
        if (creature.Kind is not ("boss" or "bigboss") || Time.time < creature.NextStep) return;
        Vector3 movement = creature.Enemy.rb.position - creature.StepPosition; movement.y = 0;
        if (movement.sqrMagnitude < .3f) return;
        creature.StepPosition = creature.Enemy.rb.position; creature.NextStep = Time.time + .65f;
        float distance = Vector3.Distance(Player.Instance.rb.position, creature.Enemy.rb.position);
        if (distance >= 18) return;
        bossSteps++; shakeUntil = Time.time + .22f;
        shakePower = Math.Max(shakePower, (creature.Kind == "bigboss" ? .8f : .45f) * (1 - distance / 18));
    }

    private void RemoveBossShake()
    {
        if (!shakeApplied) return;
        Player.Instance.mainCamera.transform.localRotation = shakeBase; shakeApplied = false;
    }

    private void ApplyBossShake()
    {
        if (menu || GameManager.Instance.IsPaused || roundDied || Time.time >= shakeUntil) { shakePower = 0; return; }
        var camera = Player.Instance.mainCamera.transform;
        shakeBase = camera.localRotation;
        float decay = Math.Clamp((shakeUntil - Time.time) / .22f, 0, 1);
        camera.localRotation = shakeBase * Quaternion.Euler(Mathf.Sin(Time.time * 51) * shakePower * decay, 0,
            Mathf.Sin(Time.time * 37) * shakePower * decay * .6f);
        shakeApplied = true;
    }
}
