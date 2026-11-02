using Il2Cpp;
using UnityEngine;
using UnityEngine.AI;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private GameObject vacuumTestWall;
    private void ClearVacuumTestWall()
    {
        if (vacuumTestWall == null) return;
        vacuumTestWall.SetActive(false); UnityEngine.Object.Destroy(vacuumTestWall); vacuumTestWall = null;
    }

    private System.Collections.IEnumerator PrepareVacuumTest(float distance, float x = 0, float z = 0, float yaw = 0, bool blocked = false)
    {
        ClearVacuumTestWall();
        qaVacuumUntil = 0;
        vacuum = true; ApplyWeapon();
        var player = Player.Instance;
        // Use the known clear center corridor, not a previous board-test view through floor covers.
        qaViewRotation = Quaternion.Euler(0, yaw, 0);
        player.rb.position = new Vector3(x, .95f, z);
        player.rb.linearVelocity = Vector3.zero;
        player.rotX = yaw; player.rotY = 0;
        ApplyQaView();
        yield return new WaitForFixedUpdate();
        // The interpolated camera can still be at the previous player position after one physics step.
        yield return new WaitForSecondsRealtime(.2f);
        ApplyQaView();
        var camera = Vacuum.Instance.mainCamera.transform;
        Spawn("Vakum mesafe testi", camera.position + camera.forward * distance);
        var creature = creatures.Last();
        creature.Enemy.Damage(100000, Vector3.zero, creature.Enemy.transform.position, 0, false, false, weapons[rules.Level]);
        if (blocked)
        {
            vacuumTestWall = GameObject.CreatePrimitive(PrimitiveType.Cube);
            vacuumTestWall.name = "TikMnG_QA_Suction_Wall";
            vacuumTestWall.transform.position = camera.position + camera.forward * (distance * .5f);
            vacuumTestWall.transform.rotation = camera.rotation;
            vacuumTestWall.transform.localScale = new Vector3(4, 4, .3f);
            vacuumTestWall.GetComponent<Renderer>().enabled = false;
        }
        yield return new WaitForFixedUpdate();
        qaVacuumStartDistance = Vector3.Distance(camera.position, creature.Enemy.GrabCenter);
        qaVacuumUntil = Time.realtimeSinceStartup + 8;
        Report();
    }
}
