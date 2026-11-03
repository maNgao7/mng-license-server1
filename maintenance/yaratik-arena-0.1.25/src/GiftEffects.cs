using Il2Cpp;
using UnityEngine;
using UnityEngine.AI;
using Object = UnityEngine.Object;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private readonly EffectState effects = new();
    private GameObject prison;
    private Material prisonMetal, prisonAccent;
    private Vector3 prisonAnchor;
    private float nextPrisonExclusion;
    private bool PrisonActive => effects.Imprisoned;

    private void UpdateGiftEffects()
    {
        if (!menu && !GameManager.Instance.IsPaused && flashIntroQueued && effects.FlashSeconds > 0) StartFlashBlast();
        if (!menu && !GameManager.Instance.IsPaused) effects.Tick(Time.deltaTime);
        SyncPrison();
        if (!PrisonActive) return;
        var body = Player.Instance.rb;
        Vector3 position = body.position;
        Vector3 constrained = new(Math.Clamp(position.x, prisonAnchor.x - 1.25f, prisonAnchor.x + 1.25f),
            position.y, Math.Clamp(position.z, prisonAnchor.z - 1.25f, prisonAnchor.z + 1.25f));
        if ((constrained - position).sqrMagnitude > .0001f)
        {
            body.position = constrained;
            var velocity = body.linearVelocity;
            if (constrained.x != position.x) velocity.x = 0;
            if (constrained.z != position.z) velocity.z = 0;
            body.linearVelocity = velocity;
        }
        if (Vacuum.Instance != null)
        {
            Vacuum.Instance.state = Vacuum.VacuumState.Idle;
            Vacuum.Instance.vacuumStrength = 0;
        }
        if (Time.time >= nextPrisonExclusion) { nextPrisonExclusion = Time.time + .1f; KeepCreaturesOutsidePrison(); }
    }

    private void SyncPrison()
    {
        if (PrisonActive && prison == null)
        {
            StopAirDash();
            prisonAnchor = Player.Instance.rb.position;
            prisonAnchor.x = Math.Clamp(prisonAnchor.x, -13, 13);
            prisonAnchor.z = Math.Clamp(prisonAnchor.z, -15, 15);
            if (NavMesh.SamplePosition(new Vector3(prisonAnchor.x, .1f, prisonAnchor.z), out var floor, 3, -1) && floor.position.y < .7f)
                prisonAnchor = floor.position + Vector3.up * .95f;
            if (Physics.Raycast(prisonAnchor + Vector3.up * 2, Vector3.down, out var ground, 5, 1, QueryTriggerInteraction.Ignore))
                prisonAnchor.y = ground.point.y + .95f;
            Player.Instance.rb.position = prisonAnchor;
            Player.Instance.rb.linearVelocity = Vector3.zero;
            prison = new GameObject("TikMnG_Prison");
            prison.transform.position = new Vector3(prisonAnchor.x, Math.Max(.05f, prisonAnchor.y - .8f), prisonAnchor.z);
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            prisonMetal ??= new Material(shader);
            prisonMetal.color = new Color(.15f, .19f, .20f);
            prisonAccent ??= new Material(shader);
            prisonAccent.color = new Color(1, .66f, .13f);
            for (int wall = 0; wall < 4; wall++)
            {
                bool alongX = wall < 2;
                float sign = wall % 2 == 0 ? -1 : 1;
                PrisonPart("SolidWall", alongX ? new Vector3(0, 1.6f, sign * 1.8f) : new Vector3(sign * 1.8f, 1.6f, 0), alongX ? new Vector3(3.8f, 3.2f, .16f) : new Vector3(.16f, 3.2f, 3.8f), false, prisonMetal);
                for (int bar = 0; bar < 9; bar++)
                {
                    float offset = -1.6f + bar * .4f;
                    PrisonPart("Bar", alongX ? new Vector3(offset, 1.6f, sign * 1.8f) : new Vector3(sign * 1.8f, 1.6f, offset), new Vector3(.07f, 3.2f, .07f), true, prisonMetal);
                }
                foreach (float height in new[] { .14f, 1.05f, 3.1f })
                    PrisonPart("Rail", alongX ? new Vector3(0, height, sign * 1.8f) : new Vector3(sign * 1.8f, height, 0), alongX ? new Vector3(3.75f, .09f, .1f) : new Vector3(.1f, .09f, 3.75f), true, prisonAccent);
            }
            PrisonPart("Roof", new Vector3(0, 3.3f, 0), new Vector3(3.8f, .12f, 3.8f), false, prisonMetal);
            var obstacle = prison.AddComponent<NavMeshObstacle>();
            obstacle.shape = NavMeshObstacleShape.Box; obstacle.center = new Vector3(0, 1.6f, 0);
            obstacle.size = new Vector3(3.8f, 3.5f, 3.8f); obstacle.carving = true; obstacle.carveOnlyStationary = false;
            nextPrisonExclusion = 0; nextArenaPath.Clear();
            Physics.SyncTransforms(); KeepCreaturesOutsidePrison();
            Inventory.Instance.DisableAllWeapons();
        }
        else if (!PrisonActive && prison != null)
        {
            prison.SetActive(false); Object.Destroy(prison); prison = null;
            nextArenaPath.Clear();
            foreach (var creature in creatures)
                if (creature.Enemy != null && !creature.Enemy.IsDead) { creature.Enemy.pathCornerCount = 0; creature.Enemy.pathTimer = 100; }
            ApplyWeapon(); Notice("SERBESTSIN");
        }
    }

    private bool InsidePrison(Vector3 point, float margin = 2.3f) => PrisonActive
        && Math.Abs(point.x - prisonAnchor.x) < margin && Math.Abs(point.z - prisonAnchor.z) < margin;

    private void PrisonPart(string name, Vector3 position, Vector3 scale, bool visible, Material material)
    {
        var part = GameObject.CreatePrimitive(PrimitiveType.Cube);
        part.name = "TikMnG_Prison_" + name;
        part.transform.SetParent(prison.transform, false);
        part.transform.localPosition = position; part.transform.localScale = scale;
        var renderer = part.GetComponent<Renderer>();
        renderer.sharedMaterial = material; renderer.enabled = visible;
    }

    private void KeepCreaturesOutsidePrison()
    {
        foreach (var creature in creatures)
        {
            var enemy = creature.Enemy;
            if (enemy == null || enemy.IsDead) continue;
            Vector3 delta = enemy.rb.position - prisonAnchor;
            if (Math.Abs(delta.x) >= 1.72f || Math.Abs(delta.z) >= 1.72f) continue;
            delta.y = 0;
            if (delta.sqrMagnitude < .01f) delta = Vector3.forward;
            var target = prisonAnchor + delta.normalized * 3.8f;
            target.y = .1f;
            if (!NavMesh.SamplePosition(target, out var hit, 1, -1) || hit.position.y > .65f) continue;
            if (Math.Abs(hit.position.x - prisonAnchor.x) < 2.3f && Math.Abs(hit.position.z - prisonAnchor.z) < 2.3f) continue;
            enemy.rb.position = hit.position + Vector3.up * .42f;
            enemy.rb.linearVelocity = Vector3.zero;
            enemy.SpawnRoaming(8);
        }
    }

    private void DrawGiftEffects()
    {
        bool flashing = effects.FlashSeconds > 0;
        if (flashing) DrawFlashPresentation();
        if (PrisonActive)
        {
            DrawEffectCountdown("HAPIS", "LockKeyhole", effects.PrisonSeconds, flashing ? 105 : 0, flashing);
        }
    }
}
