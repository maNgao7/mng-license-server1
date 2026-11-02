using Il2Cpp;
using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private int preventedCreaturePanics, preventedHitPushes;

    private void SuppressCreatureRetreat(Enemy enemy, float damage, ref Vector3 direction)
    {
        if (!ready || !creaturePointers.Contains(enemy.Pointer) || enemy.IsDead || damage <= 0 || damage >= enemy.health) return;
        if (direction.sqrMagnitude > 0) preventedHitPushes++;
        direction = Vector3.zero;
    }

    private static bool BeforeCreatureShockwave(Enemy __instance, float damage, ref Vector3 dir, ref float __state)
    {
        __state = Current.ready && Current.creaturePointers.Contains(__instance.Pointer) && !__instance.IsDead ? __instance.health : -1;
        if (Current.ready && !Current.teamDamage && Current.helpers.Any(c => c.Enemy != null && c.Enemy.Pointer == __instance.Pointer)) return false;
        Current.SuppressCreatureRetreat(__instance, damage, ref dir);
        return true;
    }

    private static void AfterCreatureShockwave(Enemy __instance, float __state)
    {
        if (__state > 0 && __instance.health < __state && !__instance.IsDead) Current.ClearHitRetreat(__instance);
    }

    private void ClearHitRetreat(Enemy enemy)
    {
        enemy.knockbackTimer = enemy.panicTimer = 0;
        enemy.pathTimer = 100;
        nextArenaPath.Remove(enemy.Pointer);
    }

    private static bool BeforeCreaturePanic(Enemy __instance)
    {
        if (!Current.ready || !Current.creaturePointers.Contains(__instance.Pointer) || __instance.IsDead) return true;
        Current.preventedCreaturePanics++;
        __instance.panicTimer = 0;
        return false;
    }

    private float CreatureSize(string kind) => kind == "boss" ? 4 : kind == "bigboss" ? 6.5f : settings.CreatureScale;
    private void ApplyCreatureScale(Enemy enemy, string kind = "spawn")
    {
        // Native Restore resets pooled bodies to this original scale on every reuse.
        enemy.transform.localScale = enemy.originalLocalScale * CreatureSize(kind);
    }

    private void SetCreatureScale(float scale)
    {
        if (!float.IsFinite(scale)) return;
        settings.CreatureScale = Math.Clamp(scale, 1, 1.5f);
        foreach (var creature in creatures)
            if (creature.Enemy != null && !creature.Enemy.IsDead && !creature.Enemy.isHeld)
                ApplyCreatureScale(creature.Enemy, creature.Kind);
        Physics.SyncTransforms();
        ResetCombatPaths();
    }
}
