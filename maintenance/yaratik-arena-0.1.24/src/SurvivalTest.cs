using Il2Cpp;
using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private GameObject combatTestWall;
    private bool prisonMovementRunning;
    private float prisonMovementTravel;
    private string prisonMovementError = "";

    private System.Collections.IEnumerator PrepareCombatFixture(float distance, string user)
    {
        qaViewRotation = Quaternion.identity;
        var player = Player.Instance;
        player.rb.position = new Vector3(0, .95f, -10); player.rb.linearVelocity = Vector3.zero;
        player.rotX = player.rotY = 0; ApplyQaView();
        yield return new WaitForSecondsRealtime(.25f);
        var position = new Vector3(0, .42f, -10 + Math.Clamp(distance, 1.2f, 15));
        Spawn(user, position);
        Report();
    }

    private void SetCombatTestWall(bool enabled)
    {
        if (combatTestWall != null) { combatTestWall.SetActive(false); UnityEngine.Object.Destroy(combatTestWall); combatTestWall = null; }
        if (!enabled) return;
        combatTestWall = GameObject.CreatePrimitive(PrimitiveType.Cube);
        combatTestWall.name = "TikMnG_QA_Combat_Wall";
        combatTestWall.transform.position = new Vector3(0, 1.7f, -9.2f);
        combatTestWall.transform.localScale = new Vector3(8, 3.4f, .18f);
        combatTestWall.GetComponent<Renderer>().enabled = false;
        Physics.SyncTransforms();
    }

    private System.Collections.IEnumerator TestPrisonMovement()
    {
        prisonMovementRunning = true; prisonMovementError = ""; prisonMovementTravel = 0;
        Vector3 start = Player.Instance.rb.position;
        float until = Time.time + 1.2f;
        while (Time.time < until && PrisonActive)
        {
            var body = Player.Instance.rb;
            body.linearVelocity = new Vector3(5, body.linearVelocity.y, 0);
            prisonMovementTravel = Math.Max(prisonMovementTravel, Vector3.Distance(start, body.position));
            if (Math.Abs(body.position.x - prisonAnchor.x) > 1.5f) prisonMovementError = "Player crossed prison boundary.";
            yield return new WaitForFixedUpdate();
        }
        Player.Instance.rb.linearVelocity = Vector3.zero;
        prisonMovementRunning = false; Report();
    }
}
