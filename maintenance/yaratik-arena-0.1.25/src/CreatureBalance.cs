using Il2Cpp;
using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private int expiredHelpers;

    private void RefreshCreatureHealth()
    {
        if (rules.Level <= balanceWeaponLevel) return;
        balanceWeaponLevel = rules.Level;
        foreach (var creature in creatures)
        {
            var enemy = creature.Enemy;
            if (creature.Kind != "spawn" || enemy == null || enemy.IsDead) continue;
            float maximum = CombatBalance.Health(creature.Kind, balanceWeaponLevel);
            enemy.health = CombatBalance.ScaledHealth(enemy.health, enemy.maxHealth, maximum);
            enemy.maxHealth = maximum;
        }
    }

    private void UpdateCreatureBalance()
    {
        bool paused = menu || GameManager.Instance.IsPaused || roundDied || rules.Won || roundTimedOut;
        for (int i = creatures.Count - 1; i >= 0; i--)
        {
            var creature = creatures[i];
            if (!creature.Friendly) continue;
            creature.HelperRemaining = CombatBalance.HelperRemaining(creature.HelperRemaining, Time.deltaTime, paused);
            if (creature.HelperRemaining > 0) continue;
            RemoveExpiredHelper(creature);
        }
    }

    private void RemoveExpiredHelper(Creature helper)
    {
        foreach (var other in creatures)
        {
            if (other.Target == helper) { other.Target = null; other.NextTarget = 0; }
            if (other.Attack.Target == helper) { other.Attack.Target = null; other.Attack.Started = -1; }
        }
        SetCreaturePlayerCollision(helper, false);
        RemoveHelperGear(helper);
        helpers.Remove(helper); creatures.Remove(helper);
        if (helper.Enemy != null)
        {
            var enemy = helper.Enemy;
            creaturePointers.Remove(enemy.Pointer); combatCreatures.Remove(enemy.Pointer);
            nextArenaPath.Remove(enemy.Pointer); motionPositions.Remove(enemy.Pointer);
            cleanedBodyBlood.Remove(enemy.Pointer); ForgetVacuumReference(enemy);
            enemy.pathCornerCount = 0;
            enemy.rb.linearVelocity = enemy.rb.angularVelocity = Vector3.zero;
            Truck.Instance.ReturnEnemy(enemy);
        }
        expiredHelpers++;
    }
}
