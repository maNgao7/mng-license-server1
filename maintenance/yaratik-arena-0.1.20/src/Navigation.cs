using Il2Cpp;
using UnityEngine;
using UnityEngine.AI;
using System.Text.Json;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private void EnsureArenaNavigation()
    {
        var surfaces = UnityEngine.Object.FindObjectsOfType<Unity.AI.Navigation.NavMeshSurface>();
        var before = surfaces.Select(s => new { s.name, s.enabled, s.agentTypeID, layers = s.layerMask.value, geometry = s.useGeometry.ToString(), collect = s.collectObjects.ToString() }).ToArray();
        foreach (var surface in surfaces)
        {
            // Factory meshes are CPU-unreadable in the demo. Rebuilding loses the baked floor paths.
            surface.enabled = true;
            surface.AddData();
        }
        File.WriteAllText(Path.Combine(Root, "qa", "navigation.json"), JsonSerializer.Serialize(before));
    }

    private void ProbeSpawnPoints()
    {
        var points = new List<object>();
        for (int i = 0; i < 12; i++)
        {
            float angle = i * MathF.PI / 6;
            var requested = spawnCenter + new Vector3(MathF.Cos(angle) * 15, 0, MathF.Sin(angle) * 15);
            bool found = NavMesh.SamplePosition(requested, out var hit, 5, -1);
            var point = hit.position + Vector3.up * .65f;
            var colliders = found ? Physics.OverlapSphere(point, .65f, Vacuum.Instance.enemyLayer, QueryTriggerInteraction.Ignore).ToArray() : Array.Empty<Collider>();
            points.Add(new
            {
                found, position = found ? hit.position.ToString() : "outside-navmesh",
                colliders = colliders.Take(8).Select(c => new { c.name, layer = c.gameObject.layer, size = c.bounds.size.ToString(), position = c.transform.position.ToString(), body = c.attachedRigidbody?.name }).ToArray()
            });
        }
        File.WriteAllText(Path.Combine(Root, "qa", "spawn-probe.json"), JsonSerializer.Serialize(new { layerMask = Vacuum.Instance.enemyLayer.value, points }, new JsonSerializerOptions { WriteIndented = true }));
    }
}
