using Il2Cpp;
using UnityEngine;
using System.Text.Json;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private GameObject EquipmentPart(PrimitiveType type, Transform parent, string name, Vector3 position, Vector3 scale, Material material)
    {
        var part = GameObject.CreatePrimitive(type); part.name = name;
        var collider = part.GetComponent<Collider>(); collider.enabled = false; UnityEngine.Object.Destroy(collider);
        part.transform.SetParent(parent, false); part.transform.localPosition = position; part.transform.localScale = scale;
        part.GetComponent<Renderer>().sharedMaterial = material;
        return part;
    }

    private void EquipHeldNativeBat(Creature creature)
    {
        if (helperGlove == null)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            helperGlove = new Material(shader) { color = new Color(.055f, .13f, .15f) };
            helperCuff = new Material(shader) { color = new Color(.95f, .62f, .16f) };
        }
        var visual = creature.Enemy.visual;
        var mesh = creature.Enemy.meshRenderer.GetComponent<MeshFilter>()?.sharedMesh;
        var body = mesh != null ? mesh.bounds : new Bounds(Vector3.up * .5f, Vector3.one);
        creature.GripPosition = new Vector3(body.center.x + body.size.x * .36f, body.min.y + body.size.y * .42f, body.center.z + body.size.z * .28f);
        creature.ShoulderPosition = new Vector3(body.center.x + body.size.x * .27f, body.min.y + body.size.y * .55f, body.center.z + body.size.z * .08f);
        creature.GripRotation = Quaternion.Euler(-12, 0, -18);
        var grip = new GameObject("TikMnG_Right_Hand_Grip"); grip.transform.SetParent(visual, false);
        creature.Hand = grip.transform;
        EquipmentPart(PrimitiveType.Sphere, grip.transform, "GlovedPalm", new Vector3(-.035f, 0, 0), new Vector3(.12f, .13f, .11f), helperGlove);
        for (int finger = 0; finger < 3; finger++)
            EquipmentPart(PrimitiveType.Sphere, grip.transform, "CurledFinger", new Vector3(.018f, -.035f + finger * .035f, .037f), new Vector3(.065f, .032f, .038f), helperGlove);
        EquipmentPart(PrimitiveType.Sphere, grip.transform, "Thumb", new Vector3(.029f, -.045f, -.014f), new Vector3(.04f, .07f, .04f), helperGlove);
        EquipmentPart(PrimitiveType.Cylinder, grip.transform, "Cuff", new Vector3(-.035f, -.08f, 0), new Vector3(.12f, .016f, .11f), helperCuff);
        creature.Forearm = EquipmentPart(PrimitiveType.Capsule, visual, "TikMnG_Helper_Forearm", Vector3.zero, Vector3.one, helperGlove).transform;

        var bat = new GameObject("TikMnG_Held_BaseballBat"); bat.transform.SetParent(grip.transform, false); creature.Club = bat.transform;
        var content = new GameObject("Native_Bat_Meshes"); content.transform.SetParent(bat.transform, false);
        var source = weapons[0].transform; Bounds combined = default; bool found = false;
        foreach (var filter in weapons[0].GetComponentsInChildren<MeshFilter>(true))
        {
            var renderer = filter.GetComponent<MeshRenderer>();
            if (filter.sharedMesh == null || renderer == null) continue;
            var relative = source.worldToLocalMatrix * filter.transform.localToWorldMatrix;
            var copy = new GameObject(filter.name); copy.transform.SetParent(content.transform, false);
            copy.transform.localPosition = relative.MultiplyPoint3x4(Vector3.zero);
            copy.transform.localRotation = relative.rotation; copy.transform.localScale = relative.lossyScale;
            copy.AddComponent<MeshFilter>().sharedMesh = filter.sharedMesh;
            copy.AddComponent<MeshRenderer>().sharedMaterials = renderer.sharedMaterials;
            var bounds = filter.sharedMesh.bounds;
            for (int corner = 0; corner < 8; corner++)
            {
                var point = relative.MultiplyPoint3x4(bounds.center + Vector3.Scale(bounds.extents,
                    new Vector3((corner & 1) == 0 ? -1 : 1, (corner & 2) == 0 ? -1 : 1, (corner & 4) == 0 ? -1 : 1)));
                if (!found) { combined = new Bounds(point, Vector3.zero); found = true; } else combined.Encapsulate(point);
            }
        }
        if (!found) throw new InvalidOperationException("Native support bat mesh is missing.");
        float length = Math.Max(combined.size.x, Math.Max(combined.size.y, combined.size.z));
        Vector3 axis = length == combined.size.x ? Vector3.right : length == combined.size.y ? Vector3.up : Vector3.forward;
        if (Vector3.Dot(combined.center, axis) < 0) axis = -axis;
        content.transform.localPosition = -(combined.center - axis * length * .38f);
        bat.transform.localRotation = Quaternion.FromToRotation(axis, Vector3.up);
        bat.transform.localScale = Vector3.one * (.74f / Math.Max(.001f, length));
        creature.ClubOnHand = true;
        AnimateHelperGrip(creature, 0);
    }

    private void AnimateHelperGrip(Creature creature, float swing)
    {
        if (creature.Hand == null) return;
        creature.Hand.localPosition = creature.GripPosition + new Vector3(-swing * .035f, Math.Max(0, swing) * .07f, swing * .14f);
        creature.Hand.localRotation = creature.GripRotation * Quaternion.Euler(-swing * 100, 0, swing * 40);
        if (creature.Forearm == null) return;
        var reach = creature.Hand.localPosition - creature.ShoulderPosition;
        creature.Forearm.localPosition = (creature.Hand.localPosition + creature.ShoulderPosition) / 2;
        creature.Forearm.localRotation = Quaternion.FromToRotation(Vector3.up, reach.normalized);
        creature.Forearm.localScale = new Vector3(.09f, Math.Max(.06f, reach.magnitude / 2), .09f);
    }

    private void ProbeCreatureEquipment()
    {
        File.WriteAllText(Path.Combine(Root, "qa", "creature-equipment.json"), JsonSerializer.Serialize(new {
            models = Truck.Instance.allEnemyPrefabs.ToArray().Select(enemy => new {
                name = enemy.gameObject.name,
                transforms = enemy.visual.GetComponentsInChildren<Transform>(true).Select(t => new {
                    path = ScenePath(t), local = t.localPosition.ToString(), position = enemy.visual.InverseTransformPoint(t.position).ToString()
                }).ToArray(),
                skins = enemy.visual.GetComponentsInChildren<SkinnedMeshRenderer>(true).Select(r => new {
                    r.name, bones = r.bones.Select(b => b == null ? "" : ScenePath(b)).ToArray()
                }).ToArray()
            }).ToArray(),
            bat = weapons[0].GetComponentsInChildren<MeshFilter>(true).Select(f => new {
                path = ScenePath(f.transform), mesh = f.sharedMesh?.name,
                centre = f.sharedMesh?.bounds.center.ToString(), size = f.sharedMesh?.bounds.size.ToString(),
                materials = f.GetComponent<MeshRenderer>()?.sharedMaterials.Select(m => m.name).ToArray()
            }).ToArray()
        }, new JsonSerializerOptions { WriteIndented = true }));
    }
}
