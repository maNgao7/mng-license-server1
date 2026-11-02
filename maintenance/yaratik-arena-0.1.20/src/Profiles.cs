using UnityEngine;
using Il2Cpp;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private readonly List<(Creature Creature, float Distance, float Priority)> profileCandidates = new();
    private float nextProfileRefresh;
    private int drawnProfiles, nearProfiles;
    private float nearestProfileDistance = -1;
    private int reservedHudProfiles;
    private readonly List<Rect> drawnProfileBounds = new();
    private readonly List<Rect> creatureBarBounds = new();
    private int drawnCreatureBars;
    private GUIStyle creatureHealthLabel, creatureRoleLabel;
    private readonly List<Rect> placedCreatureBadges = new();
    private static readonly Vector2[] BadgeOffsets = { Vector2.zero, new(-96, 0), new(96, 0),
        new(0, -76), new(0, 76), new(-96, -76), new(96, -76), new(-96, 76), new(96, 76),
        new(0, 152), new(-96, 152), new(96, 152), new(-192, 76), new(192, 76),
        new(-192, 152), new(192, 152), new(0, 228), new(-96, 228), new(96, 228) };

    private bool CreatureBadgeClear(Rect badge)
    {
        float width = Math.Min(560, Screen.width - 32), sideY = Screen.width >= 1180 ? 8 : 140;
        float noticeWidth = Screen.width < 1180 ? Math.Max(120, Math.Min(380, Screen.width - 600)) : 380;
        if (Time.realtimeSinceStartup < messageUntil && !rules.Won && !roundTimedOut
            && badge.Overlaps(new Rect((Screen.width - noticeWidth) / 2 - 4, 148, noticeWidth + 8, 38))) return false;
        return !badge.Overlaps(new Rect((Screen.width - width) / 2 - 4, 4, width + 8, 134))
            && !badge.Overlaps(new Rect(Screen.width - 296, sideY, 284, 84))
            && !(settings.TimedMode && badge.Overlaps(new Rect(12, sideY, 264, 148)))
            && !badge.Overlaps(HealthHudBounds()) && !badge.Overlaps(GiftNoticeReserved());
    }

    private bool PlaceCreatureBadge(ref Rect portrait, ref Rect bar, float extra)
    {
        var originalPortrait = portrait; var originalBar = bar;
        foreach (var offset in BadgeOffsets)
        {
            portrait = new Rect(originalPortrait.x + offset.x, originalPortrait.y + offset.y, originalPortrait.width, originalPortrait.height);
            bar = new Rect(originalBar.x + offset.x, originalBar.y + offset.y, originalBar.width, originalBar.height);
            float left = Math.Min(portrait.x, bar.x), right = Math.Max(portrait.xMax, bar.xMax);
            var badge = new Rect(left - 3, portrait.y - 3, right - left + 6, bar.yMax - portrait.y + 6);
            if (badge.x < 4 || badge.xMax > Screen.width - 4 || badge.y < 138 || badge.yMax > Screen.height - 104 || !CreatureBadgeClear(badge)) continue;
            bool occupied = false;
            for (int i = 0; i < placedCreatureBadges.Count; i++)
                if (placedCreatureBadges[i].Overlaps(badge)) { occupied = true; break; }
            if (occupied) continue;
            placedCreatureBadges.Add(badge);
            return true;
        }
        portrait = originalPortrait; bar = originalBar;
        return false;
    }

    private void DrawCreatureHealth(Creature creature, Rect bar, float distance)
    {
        float health = creature.Enemy.health, maximum = creature.Enemy.maxHealth;
        float fraction = Mathf.Clamp01(health / Math.Max(1, maximum));
        Color color = fraction <= .25f ? BrandRed : creature.Friendly ? HudMint
            : creature.Kind == "bigboss" ? new Color(1, .32f, .43f) : creature.Kind == "boss" ? HudOrange : Accent;
        Paint(new Rect(bar.x + 1, bar.y + 3, bar.width, bar.height), new Color(0, 0, 0, .45f));
        Paint(bar, new Color(.75f, .83f, .86f, .95f));
        Paint(new Rect(bar.x + 1, bar.y + 1, bar.width - 2, bar.height - 2), HudNavy);
        Paint(new Rect(bar.x + 3, bar.y + 3, (bar.width - 6) * fraction, bar.height - 6), color);
        if (distance < 30 || drawnCreatureBars < 192)
        {
            creatureHealthLabel ??= HudLabelStyle(12, Color.white, TextAnchor.MiddleCenter);
            if (creature.ShownHealth != health || creature.ShownMaximum != maximum)
            {
                creature.ShownHealth = health; creature.ShownMaximum = maximum;
                creature.HealthText = Math.Ceiling(Math.Max(0, health)) + " / " + Math.Ceiling(maximum);
            }
            Label(new Rect(bar.x + 1, bar.y + 1, bar.width, bar.height), creature.HealthText, creatureHealthLabel, Color.black);
            Label(bar, creature.HealthText, creatureHealthLabel, Color.white);
        }
        if (creature.Kind != "spawn")
        {
            creatureRoleLabel ??= HudLabelStyle(11, Color.white, TextAnchor.MiddleCenter);
            var role = new Rect(bar.x, bar.y - 18, bar.width, 17);
            Paint(role, new Color(.02f, .045f, .06f, .92f));
            Label(role, creature.Friendly ? "DESTEK" : creature.Kind == "boss" ? "BOSS" : "BIG BOSS", creatureRoleLabel, color);
        }
        if (creatureBarBounds.Count < 256) creatureBarBounds.Add(bar);
        drawnCreatureBars++;
    }

    private Vector3 ProfileAnchor(Creature c)
    {
        var enemy = c.Enemy;
        var bounds = enemy.meshRenderer.bounds;
        float top = enemy.textPoint != null ? Math.Max(bounds.max.y, enemy.textPoint.position.y) : bounds.max.y;
        return new Vector3(bounds.center.x, top + .22f, bounds.center.z);
    }

    private void DrawNearestProfiles()
    {
        var camera = Player.Instance.mainCamera;
        if (Time.realtimeSinceStartup >= nextProfileRefresh)
        {
            nextProfileRefresh = Time.realtimeSinceStartup + .1f;
            profileCandidates.Clear();
            var origin = camera.transform.position;
            foreach (var creature in creatures)
            {
                if (creature.Enemy == null || creature.Enemy.IsDead) continue;
                var body = creature.Enemy.transform.position + Vector3.up * .6f;
                var point = camera.WorldToViewportPoint(body);
                if (point.z <= .15f || point.x < -.04f || point.x > 1.04f || point.y < -.1f || point.y > 1.15f) continue;
                float distance = (body - origin).sqrMagnitude;
                float aim = Vector3.Dot((body - origin).normalized, camera.transform.forward);
                float priority = distance - (aim > .97f && distance < 400 ? 1000 : 0)
                    - (Time.time - creature.LastDamagedAt < 2 ? 500 : 0);
                profileCandidates.Add((creature, distance, priority));
            }
            // The old insertion-order cap excluded nearby, recently arrived viewers.
            profileCandidates.Sort(static (a, b) => a.Priority.CompareTo(b.Priority));
        }
        drawnProfiles = nearProfiles = reservedHudProfiles = drawnCreatureBars = 0; nearestProfileDistance = -1; drawnProfileBounds.Clear(); creatureBarBounds.Clear(); placedCreatureBadges.Clear();
        foreach (var candidate in profileCandidates)
        {
            var c = candidate.Creature;
            if (c.Enemy == null || c.Enemy.IsDead) continue;
            if (drawnCreatureBars >= (Screen.width >= 1180 ? 48 : 24)) { reservedHudProfiles++; continue; }
            var pos = camera.WorldToScreenPoint(ProfileAnchor(c));
            if (pos.z <= .1f || pos.x < 0 || pos.x > Screen.width) continue;
            float distance = Mathf.Sqrt(candidate.Distance);
            float size = Mathf.Clamp(42 - distance * .65f, 26, 36);
            float extra = c.Kind == "spawn" ? 26 : 44;
            float y = Screen.height - pos.y - size - extra;
            if (distance < 6 || c.Kind is "boss" or "bigboss") y = Mathf.Clamp(y, 146, Screen.height - size - extra - 104);
            if (y < 0 || y > Screen.height - size - extra) continue;
            var bounds = new Rect(Mathf.Clamp(pos.x - size / 2, 0, Screen.width - size), y, size, size);
            float barWidth = c.Kind is "boss" or "bigboss" ? 112 : 88;
            var bar = new Rect(Math.Clamp(pos.x - barWidth / 2, 4, Screen.width - barWidth - 4), bounds.yMax + extra - 20, barWidth, 20);
            if (!PlaceCreatureBadge(ref bounds, ref bar, extra)) { reservedHudProfiles++; continue; }
            DrawCreatureHealth(c, bar, distance);
            if (drawnProfiles >= 192) continue;
            GUI.DrawTexture(bounds, Portrait(c.Username));
            drawnProfileBounds.Add(bounds);
            if (distance < 6) nearProfiles++;
            if (nearestProfileDistance < 0) nearestProfileDistance = distance;
            drawnProfiles++;
        }
    }
}
