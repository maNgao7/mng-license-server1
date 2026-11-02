using UnityEngine;
using UnityEngine.AI;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private NavMeshData combatNavigation;
    private NavMeshDataInstance combatNavigationInstance;
    private int combatNavigationCells;
    private int combatUpperCells, combatStairSources;
    private int combatAgentType;
    private int retiredFactoryObstacles;
    private readonly float[] combatAreaCosts = Enumerable.Repeat(1f, 32).ToArray();
    private readonly List<NavMeshLinkInstance> combatStairLinks = new();
    private const float CombatHalfX = 26, CombatHalfZ = 29;
    private string combatNavigationError = "";

    private bool SampleCombatNav(Vector3 point, out NavMeshHit hit, float distance)
    {
        bool found = combatNavigation != null
            ? NavMesh.SamplePositionFilter_Injected(ref point, out hit, distance, combatAgentType, -1)
            : NavMesh.SamplePosition(point, out hit, distance, -1);
        return found && float.IsFinite(hit.position.x) && float.IsFinite(hit.position.y) && float.IsFinite(hit.position.z);
    }

    private unsafe bool CalculateCombatPath(Vector3 from, Vector3 to, NavMeshPath path)
    {
        path.ClearCorners();
        fixed (float* values = combatAreaCosts)
        {
            var costs = new UnityEngine.Bindings.ManagedSpanWrapper(values, combatAreaCosts.Length);
            return NavMesh.CalculatePathFilterInternal_Injected(ref from, ref to, path.m_Ptr, combatAgentType, -1, ref costs);
        }
    }

    private void ProbeCombatNavigation()
    {
        var samples = new List<object>();
        foreach (var point in new[] { new Vector3(3.2f, .4f, 22.5f), new Vector3(0, 1, 22.5f),
            new Vector3(-5, 5, 22.5f), new Vector3(-11, 10, 22.5f), new Vector3(-18, 10, 25.5f),
            new Vector3(0, .4f, -10), new Vector3(0, .4f, -2) })
        {
            bool found = SampleCombatNav(point, out var nav, 2);
            bool floor = Physics.Raycast(new Vector3(point.x, 12, point.z), Vector3.down, out var hit, 14, 1, QueryTriggerInteraction.Ignore);
            samples.Add(new { point = point.ToString(), found, nav = nav.position.ToString(), floor, height = floor ? hit.point.y : -100,
                collider = floor ? ScenePath(hit.collider.transform) : "" });
        }
        var routePoints = new[] { new Vector3(3.2f, .1f, 22.6f), new Vector3(-12.5f, .1f, 22.6f),
            new Vector3(-10.5f, .6f, 22.6f), new Vector3(-5, 4.8f, 22.6f), new Vector3(-1.5f, 7.6f, 22.6f),
            new Vector3(3, 9.7f, 22.6f), new Vector3(3, 9.7f, 25.5f), new Vector3(-18, 9.7f, 25.5f) };
        var routes = new List<object>();
        for (int i = 1; i < routePoints.Length; i++)
        {
            bool start = SampleCombatNav(routePoints[i - 1], out var a, 1.2f);
            bool end = SampleCombatNav(routePoints[i], out var b, 1.2f);
            var path = new NavMeshPath();
            bool found = start && end && CalculateCombatPath(a.position, b.position, path);
            int count = found ? ReadPathCorners(path) : 0;
            routes.Add(new { i, start, end, from = a.position.ToString(), to = b.position.ToString(), found,
                status = path.status.ToString(), corners = autoCornerBuffer.Take(count).Select(c => c.ToString()).ToArray() });
        }
        File.WriteAllText(Path.Combine(Root, "qa", "combat-navigation-probe.json"), System.Text.Json.JsonSerializer.Serialize(new { combatAgentType,
            valid = combatNavigationInstance.valid, combatNavigationCells, combatUpperCells, combatStairSources, retiredFactoryObstacles,
            obstacles = UnityEngine.Object.FindObjectsOfType<NavMeshObstacle>().Select(o => new { path = ScenePath(o.transform), o.enabled, o.carving,
                position = o.transform.position.ToString(), size = o.size.ToString(), center = o.center.ToString() }).ToArray(), samples, routes }));
    }

    private void BuildCombatNavigation()
    {
        if (combatNavigation != null) return;
        try
        {
            // Build from verified floor boxes: the demo factory meshes cannot be read on the CPU.
            var sources = new Il2CppSystem.Collections.Generic.List<NavMeshBuildSource>();
            for (float x = -CombatHalfX + .5f; x < CombatHalfX; x += 1)
                for (float z = -CombatHalfZ + .5f; z < CombatHalfZ; z += 1)
                {
                    if (!Physics.Raycast(new Vector3(x, 2, z), Vector3.down, out var floor, 3, 1, QueryTriggerInteraction.Ignore)
                        || floor.normal.y < .95f || floor.point.y < -.1f || floor.point.y > .6f || BehindMissionBoard(floor.point)) continue;
                    Vector3 point = floor.point;
                    if (Physics.CheckCapsule(point + Vector3.up * .2f, point + Vector3.up * 1.15f, .06f, 1, QueryTriggerInteraction.Ignore)) continue;
                    sources.Add(new NavMeshBuildSource
                    {
                        shape = NavMeshBuildSourceShape.Box, area = 0, size = new Vector3(1.24f, .2f, 1.24f),
                        transform = Matrix4x4.TRS(point - Vector3.up * .1f, Quaternion.identity, Vector3.one)
                    });
                }
            // Preserve the actual inclined stair colliders instead of turning steps into a flat target.
            foreach (var collider in UnityEngine.Object.FindObjectsOfType<BoxCollider>())
            {
                if (!collider.enabled || collider.name != "StairsCollider") continue;
                sources.Add(new NavMeshBuildSource
                {
                    shape = NavMeshBuildSourceShape.Box, area = 0, size = collider.size,
                    transform = collider.transform.localToWorldMatrix * Matrix4x4.Translate(collider.center)
                });
                combatStairSources++;
            }
            for (float x = -CombatHalfX + .125f; x < CombatHalfX; x += .25f)
                for (float z = -CombatHalfZ + .125f; z < CombatHalfZ; z += .25f)
                {
                    if (!Physics.Raycast(new Vector3(x, 12, z), Vector3.down, out var upper, 10, 1, QueryTriggerInteraction.Ignore)
                        || upper.normal.y < .95f || upper.point.y < 2 || upper.point.y > 11 || BehindMissionBoard(upper.point)) continue;
                    var point = upper.point;
                    if (Physics.CheckCapsule(point + Vector3.up * .2f, point + Vector3.up * 1.15f, .06f, 1, QueryTriggerInteraction.Ignore)) continue;
                    sources.Add(new NavMeshBuildSource
                    {
                        shape = NavMeshBuildSourceShape.Box, area = 0, size = new Vector3(.37f, .24f, .37f),
                        transform = Matrix4x4.TRS(point - Vector3.up * .12f, Quaternion.identity, Vector3.one)
                    });
                    combatUpperCells++;
                }
            combatNavigationCells = sources.Count;
            if (sources.Count < 500) throw new InvalidOperationException("Insufficient verified floor for arena navigation.");
            var configuration = NavMesh.CreateSettings();
            combatAgentType = configuration.agentTypeID;
            configuration.agentRadius = .48f; configuration.agentHeight = 1.3f; configuration.agentClimb = .45f; configuration.agentSlope = 50;
            configuration.overrideVoxelSize = true; configuration.voxelSize = .12f;
            var data = NavMeshBuilder.BuildNavMeshData(configuration, sources,
                new Bounds(new Vector3(0, 5, 0), new Vector3(CombatHalfX * 2, 14, CombatHalfZ * 2)), Vector3.zero, Quaternion.identity);
            if (data == null) throw new InvalidOperationException("Arena navigation build failed.");
            combatNavigation = data; combatNavigationInstance = NavMesh.AddNavMeshData(data);
            // These carve the removed factory divider/machines, including a full-width invisible barrier.
            // Board and temporary prison obstacles belong to the new arena and remain enabled.
            foreach (var obstacle in UnityEngine.Object.FindObjectsOfType<NavMeshObstacle>())
            {
                if (!ScenePath(obstacle.transform).StartsWith("Navmesh/", StringComparison.Ordinal)) continue;
                obstacle.enabled = false; retiredFactoryObstacles++;
            }
            foreach (float z in new[] { -22.6f, 22.64f })
            {
                AddCombatStairLink(new Vector3(-12.5f, .1f, z), new Vector3(-10.5f, .6f, z));
                AddCombatStairLink(new Vector3(-1.5f, 7.6f, z), new Vector3(3, 9.7f, z));
            }
        }
        catch (Exception error) { combatNavigationError = error.Message; MelonLoader.MelonLogger.Error("Combat navigation: " + error); }
    }

    private void AddCombatStairLink(Vector3 start, Vector3 end)
    {
        if (!SampleCombatNav(start, out var from, 1.2f) || !SampleCombatNav(end, out var to, 1.2f)) return;
        var link = NavMesh.AddLink(new NavMeshLinkData
        {
            startPosition = from.position, endPosition = to.position, width = 1.2f,
            bidirectional = true, area = 0, agentTypeID = combatAgentType, costModifier = 1
        });
        if (link.valid) combatStairLinks.Add(link);
    }
}
