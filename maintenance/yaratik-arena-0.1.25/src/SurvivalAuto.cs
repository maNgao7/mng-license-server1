using Il2Cpp;
using UnityEngine;
using UnityEngine.AI;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private int autoEvasions;
    private void EvadeNearbyCreatures()
    {
        if (!CombatRunning || PrisonActive) return;
        Vector3 position = Player.Instance.rb.position, escape = Vector3.zero;
        float nearest = 3;
        foreach (var creature in creatures)
        {
            var enemy = creature.Enemy;
            if (creature.Friendly || enemy == null || enemy.IsDead || Math.Abs(enemy.rb.position.y - position.y) > 1.5f) continue;
            Vector3 away = position - enemy.rb.position; away.y = 0;
            float distance = away.magnitude;
            if (distance >= 2.8f || distance < .05f) continue;
            escape += away / distance * (2.8f - distance);
            nearest = Math.Min(nearest, distance);
        }
        if (nearest >= 2.8f) return;
        if (escape.sqrMagnitude < .01f) escape = Vector3.Cross(Player.Instance.mainCamera.transform.forward, Vector3.up) * autoStrafe;
        escape.y = 0; escape.Normalize();
        var destination = position + escape * 1.2f;
        if (NavMesh.SamplePosition(destination, out var nav, 1.2f, -1) && Math.Abs(nav.position.y - (position.y - .85f)) < 1.5f && !BehindMissionBoard(nav.position)
            && !Physics.Linecast(position, destination, Vacuum.Instance.wallLayer, QueryTriggerInteraction.Ignore))
        {
            autoMove = Vector3.ClampMagnitude(autoMove + escape * 4, 5.2f);
            autoStatus = "KACINIYOR"; autoEvasions++;
        }
        if (nearest < 1.5f && survival.Health < survival.MaximumHealth * .5f) autoJumpRequested = true;
    }
}
