using Il2Cpp;
using UnityEngine;
using Object = UnityEngine.Object;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private static readonly string[] BloodNames = { "Kirmizi", "Pembe", "Kahverengi", "Turuncu", "Beyaz", "Siyah" };
    private static readonly Color[] BloodColors =
    {
        new(.72f, .025f, .055f), new(1, .18f, .56f), new(.36f, .16f, .075f),
        new(1, .32f, .025f), new(.56f, .58f, .60f), new(.015f, .018f, .022f)
    };
    private readonly HashSet<IntPtr> coloredBloodMaterials = new();
    private Texture2D neutralBloodTexture;
    private float hitUntil, nextBloodScan;
    private bool lastHitKilled;
    private int confirmedHits, bloodMaterialCount, bloodParticleCount, optionPage;
    private string combatVisualError = "";
    private float nextSpark;
    private int sparkBursts, suppressedBlood;
    private readonly Dictionary<IntPtr, Renderer> hiddenBloodRenderers = new();
    private readonly HashSet<IntPtr> cleanedBodyBlood = new();
    private int roundBloodClears;

    private static bool BeforeCreatureDamage(Enemy __instance, float damage, ref Vector3 dir, ref bool showBlood, ref float __state)
    {
        __state = Current.ready && Current.creaturePointers.Contains(__instance.Pointer) && !__instance.IsDead ? __instance.health : -1;
        Current.SuppressCreatureRetreat(__instance, damage, ref dir);
        if (!Current.settings.BloodEnabled) showBlood = false;
        if (Current.ready && !Current.teamDamage && Current.helpers.Any(c => c.Enemy != null && c.Enemy.Pointer == __instance.Pointer)) return false;
        return !Current.ready || !((Current.PrisonActive && !Current.teamDamage) || Current.rules.Won || Current.roundTimedOut) || !Current.creaturePointers.Contains(__instance.Pointer);
    }

    private static void AfterCreatureDamage(Enemy __instance, Weapon weapon, float __state)
    {
        if (__state <= 0 || __instance.health >= __state) return;
        var creature = Current.creatures.Find(c => c.Enemy != null && c.Enemy.Pointer == __instance.Pointer);
        if (creature != null) creature.LastDamagedAt = Time.time;
        if (!__instance.IsDead) Current.ClearHitRetreat(__instance);
        if (weapon == null) return;
        Current.confirmedHits++;
        Current.hitUntil = Time.realtimeSinceStartup + .22f;
        Current.lastHitKilled = __instance.IsDead;
        if (!Current.settings.BloodEnabled)
        {
            Current.ClearCreatureBlood(__instance);
            Current.EmitHitSparks(__instance.GrabCenter);
        }
    }

    private static bool BeforeBloodSpawn(ref GameObject __result)
    {
        if (!Current.ready || Current.settings.BloodEnabled) return true;
        Current.suppressedBlood++; __result = null; return false;
    }
    private static bool BeforeBloodEmit(ref bool __result)
    {
        if (!Current.ready || Current.settings.BloodEnabled) return true;
        Current.suppressedBlood++; __result = false; return false;
    }
    private static bool BloodVisualAllowed(Enemy __instance) => !Current.ready || Current.settings.BloodEnabled && !Current.cleanedBodyBlood.Contains(__instance.Pointer);
    private static bool GlobalDamageVisualAllowed(float __0) => !Current.ready || Current.settings.BloodEnabled || __0 == 0;
    private static bool DamageSlotAllowed(ref bool __result)
    {
        if (!Current.ready || Current.settings.BloodEnabled) return true;
        __result = false; return false;
    }

    private void SetBloodEnabled(bool enabled)
    {
        settings.BloodEnabled = enabled;
        RefreshBloodColors();
    }

    private void HideBloodObject(GameObject root)
    {
        foreach (var system in root.GetComponentsInChildren<ParticleSystem>(true)) system.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
        foreach (var renderer in root.GetComponentsInChildren<Renderer>(true))
            if (renderer.enabled) { hiddenBloodRenderers[renderer.Pointer] = renderer; renderer.enabled = false; }
    }

    private void ClearCreatureBlood(Enemy enemy)
    {
        if (enemy.bloodFlowParticle != null) enemy.bloodFlowParticle.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
        enemy.damageCount = 0;
        enemy.SetGlobalDamageVisual(0);
        if (enemy.MaterialPropertyBlock != null)
        {
            enemy.MaterialPropertyBlock.Clear();
            enemy.meshRenderer.SetPropertyBlock(enemy.MaterialPropertyBlock);
        }
    }

    private void ClearRoundBlood()
    {
        foreach (var creature in creatures)
        {
            if (creature.Enemy == null) continue;
            ClearCreatureBlood(creature.Enemy);
            if (creature.Enemy.IsDead) cleanedBodyBlood.Add(creature.Enemy.Pointer);
        }
        foreach (var system in Object.FindObjectsOfType<ParticleSystem>())
        {
            var renderer = system.GetComponent<ParticleSystemRenderer>();
            if (system.name.Contains("blood", StringComparison.OrdinalIgnoreCase) || renderer != null && renderer.sharedMaterial != null && renderer.sharedMaterial.name.Contains("blood", StringComparison.OrdinalIgnoreCase))
                system.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
        }
        var floor = BloodParticleManager.Instance;
        if (floor != null)
        {
            floor.spatialGrid.Clear(); floor.startIndex = 0; floor.particleCount = 0; floor.maxActiveSizeMultiplier = 0;
        }
        roundBloodClears++;
    }

    private void EmitHitSparks(Vector3 point)
    {
        if (Time.realtimeSinceStartup < nextSpark) return;
        nextSpark = Time.realtimeSinceStartup + .045f;
        var effect = ParticlePoolManager.Instance.SpawnImpact(point, Vector3.up);
        effect.transform.localScale = Vector3.one * .45f;
        foreach (var system in effect.GetComponentsInChildren<ParticleSystem>(true))
        {
            var main = system.main;
            main.startColor = new ParticleSystem.MinMaxGradient { m_Mode = ParticleSystemGradientMode.Color, m_ColorMin = new Color(1, .78f, .15f), m_ColorMax = new Color(1, .78f, .15f) };
        }
        sparkBursts++;
    }

    private static void AfterBloodSpawn(GameObject __result)
    {
        if (!Current.ready || __result == null) return;
        try { if (Current.settings.BloodEnabled) Current.ColorBloodObject(__result); else Current.HideBloodObject(__result); }
        catch (Exception e) { Current.combatVisualError = e.Message; }
    }

    private void PrepareNeutralBloodTexture()
    {
        if (neutralBloodTexture != null) return;
        string path = Path.Combine(Root, "assets", "BloodDecal_01-514.png");
        if (!File.Exists(path)) return;
        var image = StbImageSharp.ImageResult.FromMemory(File.ReadAllBytes(path), StbImageSharp.ColorComponents.RedGreenBlueAlpha);
        const int size = 512;
        var rgba = new byte[size * size * 4];
        for (int y = 0; y < size; y++) for (int x = 0; x < size; x++)
        {
            int source = ((y * image.Height / size) * image.Width + x * image.Width / size) * 4, target = (y * size + x) * 4;
            byte value = (byte)Math.Min(255, Math.Max(image.Data[source], Math.Max(image.Data[source + 1], image.Data[source + 2])) * 3);
            rgba[target] = value; rgba[target + 1] = value; rgba[target + 2] = value; rgba[target + 3] = image.Data[source + 3];
        }
        neutralBloodTexture = UploadImage(size, size, rgba); neutralBloodTexture.Apply();
    }

    private void ColorBloodMaterial(Material material, bool force = false)
    {
        if (material == null) return;
        if (!force && coloredBloodMaterials.Contains(material.Pointer)) return;
        Color color = BloodColors[settings.BloodColor];
        if (material.HasProperty("_MeatColor"))
        {
            material.SetColor("_MeatColor", color);
            if (material.HasProperty("_HitFlashColor")) material.SetColor("_HitFlashColor", color);
            coloredBloodMaterials.Add(material.Pointer);
            return;
        }
        if (!material.name.Contains("blood", StringComparison.OrdinalIgnoreCase)) return;
        if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", color);
        if (material.HasProperty("_Color")) material.SetColor("_Color", color);
        if (material.name.Contains("decal", StringComparison.OrdinalIgnoreCase))
        {
            PrepareNeutralBloodTexture();
            if (neutralBloodTexture != null && material.HasProperty("_MainTex")) material.SetTexture("_MainTex", neutralBloodTexture);
            if (material.HasProperty("_AlbedoPower")) material.SetFloat("_AlbedoPower", 1);
            if (material.HasProperty("_ColorIntensity")) material.SetFloat("_ColorIntensity", settings.BloodColor == 4 ? .22f : .75f);
            if (material.HasProperty("_HueShift")) material.SetFloat("_HueShift", 0);
        }
        // Blood is pigment, not a light source; leave the factory's lighting/bloom untouched.
        if (material.HasProperty("_EmissionColor")) material.SetColor("_EmissionColor", Color.black);
        if (material.HasProperty("_EmissionPower")) material.SetFloat("_EmissionPower", 0);
        if (material.HasProperty("_Smoothness")) material.SetFloat("_Smoothness", .12f);
        coloredBloodMaterials.Add(material.Pointer);
    }

    private void ColorBloodObject(GameObject root)
    {
        foreach (var renderer in root.GetComponentsInChildren<Renderer>(true))
            foreach (var material in renderer.sharedMaterials) ColorBloodMaterial(material);
        foreach (var system in root.GetComponentsInChildren<ParticleSystem>(true))
        {
            var main = system.main;
            main.startColor = NeutralParticleColor();
            var lifetime = system.colorOverLifetime;
            lifetime.color = NeutralParticleColor();
        }
    }

    private static ParticleSystem.MinMaxGradient NeutralParticleColor() => new()
    {
        m_Mode = ParticleSystemGradientMode.Color,
        m_ColorMin = Color.white,
        m_ColorMax = Color.white
    };

    private void RefreshBloodColors()
    {
        try
        {
            coloredBloodMaterials.Clear();
            if (settings.BloodEnabled)
            {
                foreach (var renderer in hiddenBloodRenderers.Values) if (renderer != null) renderer.enabled = true;
                hiddenBloodRenderers.Clear();
            }
            foreach (var material in Resources.FindObjectsOfTypeAll<Material>()) ColorBloodMaterial(material, true);
            bloodMaterialCount = coloredBloodMaterials.Count;
            bloodParticleCount = 0;
            foreach (var system in Resources.FindObjectsOfTypeAll<ParticleSystem>())
            {
                string name = system.name;
                var renderer = system.GetComponent<ParticleSystemRenderer>();
                bool blood = name.Contains("blood", StringComparison.OrdinalIgnoreCase) || renderer != null && renderer.sharedMaterial != null && renderer.sharedMaterial.name.Contains("blood", StringComparison.OrdinalIgnoreCase);
                if (!blood) continue;
                if (!settings.BloodEnabled) { HideBloodObject(system.gameObject); bloodParticleCount++; continue; }
                var main = system.main; main.startColor = NeutralParticleColor();
                var lifetime = system.colorOverLifetime; lifetime.color = NeutralParticleColor();
                bloodParticleCount++;
            }
            if (!settings.BloodEnabled)
            {
                foreach (var renderer in Resources.FindObjectsOfTypeAll<Renderer>())
                    if (renderer.sharedMaterials.Any(m => m != null && m.name.Contains("blood", StringComparison.OrdinalIgnoreCase))) HideBloodObject(renderer.gameObject);
                foreach (var creature in creatures) if (creature.Enemy != null) ClearCreatureBlood(creature.Enemy);
                var floor = BloodParticleManager.Instance;
                if (floor != null)
                {
                    // Clearing visible decals must also release their native spacing records.
                    floor.spatialGrid.Clear(); floor.startIndex = 0; floor.particleCount = 0; floor.maxActiveSizeMultiplier = 0;
                }
            }
            combatVisualError = "";
        }
        catch (Exception e) { combatVisualError = e.Message; MelonLoader.MelonLogger.Warning("Blood colors: " + e); }
    }

    private void PollCombatVisuals()
    {
        if (Time.realtimeSinceStartup < nextBloodScan) return;
        nextBloodScan = Time.realtimeSinceStartup + 5;
        // Pool expansion creates new material instances; recolor only newly discovered ones.
        foreach (var creature in creatures)
            if (creature.Enemy != null) ColorBloodMaterial(creature.Enemy.meshRenderer.sharedMaterial);
    }

    private void DrawReticle()
    {
        EnsureMenuStyles();
        float x = Screen.width / 2f, y = Screen.height / 2f;
        bool hit = settings.HitMarker && Time.realtimeSinceStartup < hitUntil;
        float alpha = hit ? Mathf.Clamp01((hitUntil - Time.realtimeSinceStartup) / .12f) : .8f;
        Color color = hit && lastHitKilled ? new Color(1, .65f, .15f, alpha) : new Color(1, 1, 1, alpha);
        float reach = hit ? 11 + 3 * Mathf.Clamp01((hitUntil - Time.realtimeSinceStartup) / .22f) : 4;
        float stroke = hit ? 2 : 1;
        Paint(new Rect(x - reach - 1, y - stroke / 2 - 1, reach * 2 + 2, stroke + 2), new Color(0, 0, 0, .6f * alpha));
        Paint(new Rect(x - stroke / 2 - 1, y - reach - 1, stroke + 2, reach * 2 + 2), new Color(0, 0, 0, .6f * alpha));
        Paint(new Rect(x - reach, y - stroke / 2, reach * 2, stroke), color);
        Paint(new Rect(x - stroke / 2, y - reach, stroke, reach * 2), color);
    }

    private void DrawCombatSettings(Rect area)
    {
        float x = area.x, y = area.y + 94, w = area.width;
        Label(new Rect(x, y, w - 180, 26), "Kan efektleri", sectionStyle);
        bool enabled = GUI.Toggle(new Rect(x + w - 168, y, 168, 30), settings.BloodEnabled, settings.BloodEnabled ? "[x] Kan acik" : "[ ] Kan kapali", fieldStyle);
        if (enabled != settings.BloodEnabled) { SetBloodEnabled(enabled); settingsDirty = true; }
        y += 35;
        int columns = w >= 700 ? 6 : 3;
        float cellWidth = (w - (columns - 1) * 10) / columns;
        float rowStep = columns == 6 ? 92 : 70;
        float cellHeight = columns == 6 ? 78 : 60;
        for (int i = 0; i < BloodNames.Length; i++)
        {
            var cell = new Rect(x + i % columns * (cellWidth + 10), y + 35 + i / columns * rowStep, cellWidth, cellHeight);
            bool selected = settings.BloodColor == i;
            if (GUI.Button(cell, "", tileStyle)) { settings.BloodColor = i; settingsDirty = true; RefreshBloodColors(); }
            Paint(new Rect(cell.x + 12, cell.y + 8, cell.width - 24, cellHeight - 45), BloodColors[i]);
            if (i == 5) Paint(new Rect(cell.x + 12, cell.y + cellHeight - 37, cell.width - 24, 1), Muted);
            Label(new Rect(cell.x + 12, cell.y + cellHeight - 34, cell.width - 24, 28), BloodNames[i], bodyStyle, selected ? Accent : Ink);
            if (selected) Paint(new Rect(cell.x, cell.yMax - 3, cell.width, 3), Accent);
        }
        float toggleY = y + 35 + rowStep * (columns == 6 ? 1 : 2);
        Rule(x, toggleY, w);
        Label(new Rect(x, toggleY + 18, w - 136, 32), "Isabet isareti", sectionStyle);
        if (Button(new Rect(x + w - 124, toggleY + 18, 124, 32), settings.HitMarker ? "Acik" : "Kapali", settings.HitMarker)) { settings.HitMarker = !settings.HitMarker; settingsDirty = true; }
    }
}
