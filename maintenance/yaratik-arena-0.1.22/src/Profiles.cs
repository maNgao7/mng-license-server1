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
    private readonly List<Rect> placedCreatureBadges = new();
    private readonly List<Vector2> drawnProfileAnchors = new();
    private int portraitLoadFrame = -1;
    private int consideredCreatureBadges;

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

    private bool PlaceCreatureBadge(Rect portrait, Rect bar)
    {
        var badge = new Rect(bar.x - 2, portrait.y - 2, bar.width + 4, bar.yMax - portrait.y + 4);
        if (badge.x < 4 || badge.xMax > Screen.width - 4 || badge.y < 4 || badge.yMax > Screen.height - 4
            || !CreatureBadgeClear(badge)) return false;
        // Hide a crowded label instead of detaching it from its creature's head.
        for (int i = 0; i < placedCreatureBadges.Count; i++)
            if (placedCreatureBadges[i].Overlaps(badge)) return false;
        return true;
    }

    private void DrawCreatureHealth(Creature creature, Rect bar, float distance)
    {
        float health = creature.Enemy.health, maximum = creature.Enemy.maxHealth;
        float fraction = Mathf.Clamp01(health / Math.Max(1, maximum));
        Color color = fraction <= .25f ? BrandRed : creature.Friendly ? HudMint
            : creature.Kind == "bigboss" ? new Color(1, .32f, .43f) : creature.Kind == "boss" ? HudOrange : Accent;
        Paint(bar, new Color(.75f, .83f, .86f, .95f));
        Paint(new Rect(bar.x + 1, bar.y + 1, bar.width - 2, bar.height - 2), HudNavy);
        Paint(new Rect(bar.x + 2, bar.y + 2, (bar.width - 4) * fraction, bar.height - 4), color);
        creatureBarBounds.Add(bar);
        drawnCreatureBars++;
    }

    private Vector3 ProfileAnchor(Creature c)
    {
        var enemy = c.Enemy;
        var bounds = enemy.meshRenderer.bounds;
        float top = enemy.textPoint != null ? Math.Max(bounds.max.y, enemy.textPoint.position.y) : bounds.max.y;
        return new Vector3(bounds.center.x, top + .12f, bounds.center.z);
    }

    private void DrawNearestProfiles()
    {
        var camera = Player.Instance.mainCamera;
        if (Time.realtimeSinceStartup >= nextProfileRefresh)
        {
            nextProfileRefresh = Time.realtimeSinceStartup + .15f;
            profileCandidates.Clear();
            var origin = camera.transform.position;
            foreach (var creature in creatures)
            {
                if (creature.Enemy == null || creature.Enemy.IsDead) continue;
                var body = creature.Enemy.transform.position + Vector3.up * .6f;
                var point = camera.WorldToViewportPoint(body);
                if (point.z <= .15f || point.x < -.04f || point.x > 1.04f || point.y < -.1f || point.y > 1.15f) continue;
                float distance = (body - origin).sqrMagnitude;
                if (distance > 45 * 45) continue;
                float aim = Vector3.Dot((body - origin).normalized, camera.transform.forward);
                float priority = distance - (aim > .97f && distance < 400 ? 1000 : 0)
                    - (Time.time - creature.LastDamagedAt < 2 ? 500 : 0);
                profileCandidates.Add((creature, distance, priority));
            }
            // The old insertion-order cap excluded nearby, recently arrived viewers.
            profileCandidates.Sort(static (a, b) => a.Priority.CompareTo(b.Priority));
        }
        drawnProfiles = nearProfiles = reservedHudProfiles = drawnCreatureBars = consideredCreatureBadges = 0;
        nearestProfileDistance = -1;
        drawnProfileBounds.Clear(); creatureBarBounds.Clear(); placedCreatureBadges.Clear(); drawnProfileAnchors.Clear();
        foreach (var candidate in profileCandidates)
        {
            if (drawnCreatureBars >= (Screen.width >= 1180 ? 24 : 16) || consideredCreatureBadges >= 96)
            { reservedHudProfiles += profileCandidates.Count - consideredCreatureBadges; break; }
            consideredCreatureBadges++;
            var c = candidate.Creature;
            if (c.Enemy == null || c.Enemy.IsDead) continue;
            var pos = camera.WorldToScreenPoint(ProfileAnchor(c));
            if (pos.z <= .1f || pos.x < 0 || pos.x > Screen.width) continue;
            float distance = Mathf.Sqrt(candidate.Distance);
            float lod = 1 / (1 + Math.Max(0, distance - 3) * .055f);
            float size = Mathf.Clamp(34 * lod, 12, 34);
            float barWidth = Mathf.Clamp((c.Kind is "boss" or "bigboss" ? 92 : 76) * lod, 30, 92);
            float barHeight = distance < 12 ? 9 : 7;
            var anchor = new Vector2(pos.x, Screen.height - pos.y);
            var bar = new Rect(anchor.x - barWidth / 2, anchor.y - 3 - barHeight, barWidth, barHeight);
            var bounds = new Rect(anchor.x - size / 2, bar.y - 3 - size, size, size);
            if (!PlaceCreatureBadge(bounds, bar)) { reservedHudProfiles++; continue; }
            if (!portraits.TryGetValue(c.Username, out var portrait))
            {
                // Decode at most one new portrait per frame, even for a large gift wave.
                if (portraitLoadFrame == Time.frameCount) { reservedHudProfiles++; continue; }
                portraitLoadFrame = Time.frameCount;
                portrait = Portrait(c.Username);
            }
            placedCreatureBadges.Add(new Rect(bar.x - 2, bounds.y - 2, bar.width + 4, bar.yMax - bounds.y + 4));
            DrawCreatureHealth(c, bar, distance);
            GUI.DrawTexture(bounds, portrait);
            drawnProfileBounds.Add(bounds);
            drawnProfileAnchors.Add(anchor);
            if (distance < 6) nearProfiles++;
            if (nearestProfileDistance < 0) nearestProfileDistance = distance;
            drawnProfiles++;
        }
    }
}
