using Il2Cpp;
using UnityEngine;
using UnityEngine.AI;
using System.Text.Json;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private readonly List<Vector3> recentArrivals = new();
    private Transform pitCover;
    private float nextArrivalEffect, nextCrowdStep, roundStartedAt = -1;
    private bool roundTimedOut;
    private int arrivalEffects, removedMachines;
    private string arrivalSound = "";
    private AudioClip arrivalPop;
    private const float ArenaHalfX = 22, ArenaHalfZ = 24;

    private void ConfigureArena()
    {
        var machines = GameObject.Find("Machines");
        if (machines == null) throw new InvalidOperationException("Factory machine group missing.");
        foreach (var processor in GameManager.Instance.canProcessors)
        {
            processor.StopAllCoroutines(); processor.enabled = false;
            if (processor.gameObject.activeSelf) removedMachines++;
            processor.gameObject.SetActive(false);
        }
        pitCover = machines.transform.Find("Machine_Cover_1");
        if (pitCover == null)
        {
            var source = machines.transform.Find("Machine_Cover_2");
            if (source == null) throw new InvalidOperationException("Factory floor cover missing.");
            var copy = UnityEngine.Object.Instantiate(source.gameObject, new Vector3(-2.41f, source.position.y, .01f), source.rotation);
            copy.name = "TikMnG_Center_Floor_Cover"; pitCover = copy.transform;
        }
        pitCover.gameObject.SetActive(true);
        foreach (var collider in pitCover.GetComponentsInChildren<Collider>(true)) collider.enabled = true;
        arrivalPop = Resources.FindObjectsOfTypeAll<AudioClip>().FirstOrDefault(clip => clip.name == "Collect_Pop_1");
        recentArrivals.Clear();
    }

    private bool TryArenaSpawnPoint(out Vector3 point, float size = 0)
    {
        point = Vector3.zero;
        Vector3 player = Player.Instance.rb.position;
        float feet = player.y - .85f;
        if (size <= 0) size = settings.CreatureScale;
        Vector3 forward = Player.Instance.mainCamera.transform.forward; forward.y = 0;
        if (forward.sqrMagnitude < .01f) forward = Player.Instance.transform.forward;
        forward.y = 0; forward.Normalize();
        var inward = new Vector3(-player.x, 0, -player.z).normalized;
        for (int attempt = 0; attempt < 48; attempt++)
        {
            // A wall-facing camera must not permanently strand a valid gift in the queue.
            var direction = attempt >= 32 && inward.sqrMagnitude > .01f ? inward : forward;
            var right = new Vector3(direction.z, 0, -direction.x);
            float angle = (random.NextSingle() * 2 - 1) * Mathf.Deg2Rad * 85;
            float radius = Mathf.Sqrt(Mathf.Lerp(4.5f * 4.5f, 12.5f * 12.5f, random.NextSingle()));
            var candidate = player + (direction * Mathf.Cos(angle) + right * Mathf.Sin(angle)) * radius - Vector3.up * .85f;
            if (!SampleCombatNav(candidate, out var nav, 1.2f) || Math.Abs(nav.position.y - feet) > 1.25f) continue;
            if (Math.Abs(nav.position.x) > CombatHalfX || Math.Abs(nav.position.z) > CombatHalfZ) continue;
            if (BehindMissionBoard(nav.position)) { rejectedBoardSpawns++; continue; }
            if (InsidePrison(nav.position, 2.5f)) continue;
            if (!Physics.Raycast(nav.position + Vector3.up * .6f, Vector3.down, out var floor, 1.5f, 1, QueryTriggerInteraction.Ignore)) continue;
            if (floor.normal.y < .65f || Math.Abs(floor.point.y - feet) > 1.25f) continue;
            point = floor.point + Vector3.up * .42f;
            float flatDistance = Vector2.Distance(new Vector2(point.x, point.z), new Vector2(player.x, player.z));
            if (flatDistance < 4 || flatDistance > 13.5f || Vector3.Dot(point - player, direction) < 0) continue;
            float bodyRadius = .28f * size;
            if (Physics.CheckCapsule(floor.point + Vector3.up * (bodyRadius + .06f), floor.point + Vector3.up * (1.2f * size), bodyRadius, -1, QueryTriggerInteraction.Ignore)) continue;
            if (Physics.Linecast(player, point + Vector3.up * .5f, Vacuum.Instance.wallLayer, QueryTriggerInteraction.Ignore) && !PrisonActive) continue;
            return true;
        }
        return false;
    }

    private void LaunchArrival(Enemy enemy, Vector3 point)
    {
        enemy.rb.linearVelocity = Vector3.up * (1.2f + random.NextSingle() * .4f);
        recentArrivals.Add(point);
        if (recentArrivals.Count > 256) recentArrivals.RemoveAt(0);
        if (Time.time < nextArrivalEffect) return;
        nextArrivalEffect = Time.time + .65f;
        ParticlePoolManager.Instance.SpawnImpact(point - Vector3.up * .35f, Vector3.up);
        if (arrivalPop != null)
        {
            Player.Instance.audioSource.PlayOneShot(arrivalPop, .1f);
            arrivalSound = arrivalPop.name;
        }
        arrivalEffects++;
    }

    private void UpdateArenaCrowd()
    {
        if (rules.Won || roundTimedOut) return;
        if (Time.time < nextCrowdStep) return;
        nextCrowdStep = Time.time + .08f;
        float birthStart = Time.realtimeSinceStartup;
        int birthLimit = settings.PhysicalCreatures > 1000 ? 12 : 3;
        for (int i = 0; i < birthLimit && pending.Count > 0 && rules.Alive < settings.PhysicalCreatures && Time.realtimeSinceStartup >= nextSpawnAttempt && Time.realtimeSinceStartup - birthStart < .003f; i++)
        {
            if (!Spawn(pending.Peek(), kind: pending.PeekKind())) break;
            pending.RemoveOne();
        }
    }

    private void StartChallenge(bool immediately = false)
    {
        if (!settings.TimedMode || rules.Won || roundTimedOut) return;
        if (challenge.Start(Time.time, settings.RoundSeconds, settings.KillTarget, immediately)) PlayTone(660, .12f);
    }

    private bool CheckTimedChallenge()
    {
        if (rules.Won || roundTimedOut) return false;
        challenge.Tick(Time.time);
        if (!challenge.Finished) return false;
        bool won = challenge.Phase == ChallengePhase.Won;
        rules.FinishRound(won);
        roundTimedOut = !won;
        return true;
    }

    private static string ScenePath(Transform transform)
    {
        string path = transform.name;
        for (int i = 0; transform.parent != null && i < 12; i++) { transform = transform.parent; path = transform.name + "/" + path; }
        return path;
    }

    private void ProbeArena()
    {
        File.WriteAllText(Path.Combine(Root, "qa", "arena-scene.json"), JsonSerializer.Serialize(new
        {
            processors = GameManager.Instance.canProcessors.ToArray().Select(m => new { path = ScenePath(m.transform), position = m.transform.position.ToString() }).ToArray(),
            colliders = UnityEngine.Object.FindObjectsOfType<Collider>().Where(c => c.gameObject.layer != 8 && c.attachedRigidbody == null).Select(c => new
            {
                path = ScenePath(c.transform), c.enabled, c.isTrigger, layer = c.gameObject.layer,
                type = c.GetIl2CppType().Name, center = c.bounds.center.ToString(), size = c.bounds.size.ToString()
            }).ToArray(),
            sounds = Resources.FindObjectsOfTypeAll<AudioClip>().Select(c => c.name).Distinct().ToArray()
        }, new JsonSerializerOptions { WriteIndented = true }));
    }
}
