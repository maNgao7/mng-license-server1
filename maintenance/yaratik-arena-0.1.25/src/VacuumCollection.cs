using Il2Cpp;
using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private float nextArenaSuction;
    private int arenaVacuumAssists;

    private void PullArenaBodies(Vacuum tool)
    {
        // Native Suck still contains a factory-side test. Both manual and auto suction share this fallback.
        if (Time.time < nextArenaSuction) return;
        nextArenaSuction = Time.time + 1f / 30;
        Vector3 origin = tool.mainCamera.transform.position, forward = tool.mainCamera.transform.forward;
        foreach (var creature in creatures)
        {
            if (!creature.Counted) continue;
            var enemy = creature.Enemy;
            if (enemy == null || !enemy.gameObject.activeInHierarchy || !enemy.IsDead || !enemy.CanGrab || enemy.isHeld
                || BehindMissionBoard(enemy.rb.position)) continue;
            Vector3 center = enemy.GrabCenter, offset = center - origin;
            if (offset.sqrMagnitude > VacuumRange * VacuumRange || Vector3.Dot(forward, offset.normalized) < .8f) continue;
            if (Physics.Linecast(origin, center, tool.wallLayer, QueryTriggerInteraction.Ignore)) continue;
            Vector3 pull = tool.point.position - center;
            if (pull.magnitude <= tool.suckDisableDistance)
            {
                enemy.OnGrabbed(); tool.grabbables.Add(enemy.Cast<IGrabbable>());
            }
            else
            {
                enemy.rb.linearVelocity = Vector3.MoveTowards(enemy.rb.linearVelocity,
                    pull.normalized * Math.Min(tool.suckMaxVelocity, 3 + pull.magnitude * 2), tool.suckForce / 30);
            }
            arenaVacuumAssists++;
        }
    }
}
