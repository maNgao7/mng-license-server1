using Il2Cpp;
using UnityEngine;
using Object = UnityEngine.Object;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private Rect healthBounds, defeatPortraitBounds;
    private bool healthDrawn, defeatDrawn;
    private Texture2D defeatPortrait, portraitDisc;
    private string defeatPortraitPath = "";
    private float nextDefeatPortrait;
    private GUIStyle healthLabel, healthValue, defeatHeading, defeatName, defeatCaption;
    private Texture2D healthPlate, healthSegment;
    private float healthTrail = 100, healthChangedAt = -100;
    private float lastShownHealth = 100;
    private Texture2D damageLeft, damageRight;
    private float damageVignetteOpacity;
    private int playerLastDamage;

    private void DrawDamageVignette()
    {
        damageVignetteOpacity = 0;
        float age = Time.time - playerHitAt;
        if (age < 0 || age >= .9f) return;
        if (damageLeft == null)
        {
            const int width = 128, height = 128;
            var left = new byte[width * height * 4]; var right = new byte[left.Length];
            for (int y = 0; y < height; y++) for (int x = 0; x < width; x++)
            {
                float edge = MathF.Pow(1 - x / (float)(width - 1), 1.7f);
                float corner = .65f + .35f * MathF.Pow(Math.Abs(y - 63.5f) / 63.5f, 1.4f);
                int p = (y * width + x) * 4, mirror = (y * width + width - 1 - x) * 4;
                left[p] = right[mirror] = 232;
                left[p + 1] = right[mirror + 1] = 10;
                left[p + 2] = right[mirror + 2] = 29;
                left[p + 3] = right[mirror + 3] = (byte)(255 * edge * corner);
            }
            damageLeft = UploadImage(width, height, left); damageLeft.Apply();
            damageRight = UploadImage(width, height, right); damageRight.Apply();
        }
        float strength = .6f + .35f * Mathf.Clamp01(playerLastDamage / (survival.MaximumHealth * .8f));
        damageVignetteOpacity = strength * MathF.Pow(Mathf.Clamp01(1 - age / .9f), .65f);
        float band = Math.Clamp(Screen.width * .18f, 110, 300);
        var tint = new Color(1, 1, 1, damageVignetteOpacity);
        DrawHudIcon(new Rect(0, 0, band, Screen.height), damageLeft, tint, ScaleMode.StretchToFill);
        DrawHudIcon(new Rect(Screen.width - band, 0, band, Screen.height), damageRight, tint, ScaleMode.StretchToFill);
    }

    private Rect HealthHudBounds()
    {
        float width = Math.Min(360 * 1.32f, Math.Max(1, Screen.width - 32));
        float height = width * 64 / 360;
        float bottom = Math.Min(52, Math.Max(0, Screen.height - height - 8));
        return new Rect((Screen.width - width) / 2f, Screen.height - bottom - height, width, height);
    }

    private Texture2D MakeHealthShape(int width, int height, Vector2[] outline, bool plate = false)
    {
        const int resolution = 2;
        var rgba = new byte[width * height * resolution * resolution * 4];
        float Distance(float x, float y, Vector2[] polygon)
        {
            bool inside = false; float distance = float.MaxValue;
            for (int i = 0, previous = polygon.Length - 1; i < polygon.Length; previous = i++)
            {
                var a = polygon[previous]; var b = polygon[i];
                if ((a.y > y) != (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
                var edge = b - a; float t = Mathf.Clamp01(Vector2.Dot(new Vector2(x, y) - a, edge) / edge.sqrMagnitude);
                distance = Math.Min(distance, Vector2.Distance(new Vector2(x, y), a + t * edge));
            }
            return inside ? -distance : distance;
        }
        var badge = new[] { new Vector2(10, 14), new Vector2(18, 7), new Vector2(61, 7), new Vector2(70, 17),
            new Vector2(70, 48), new Vector2(61, 57), new Vector2(18, 57), new Vector2(10, 49) };
        for (int py = 0; py < height * resolution; py++) for (int px = 0; px < width * resolution; px++)
        {
            float x = (px + .5f) / resolution, y = (py + .5f) / resolution;
            float d = Distance(x, y, outline);
            var color = Color.white;
            if (plate)
            {
                color = d > -1.2f ? HudNavy : y < 3 ? Color.white : y > height - 5 ? Color.Lerp(HudCream, HudOrange, .22f) : HudCream;
                if (Distance(x, y, badge) < 0) color = HudNavy;
                if (x > width - 20 && y > 21 && y < 48 && (int)(x + y) % 12 < 5) color = HudOrange;
            }
            int p = (py * width * resolution + px) * 4;
            rgba[p] = (byte)(color.r * 255); rgba[p + 1] = (byte)(color.g * 255); rgba[p + 2] = (byte)(color.b * 255);
            rgba[p + 3] = (byte)(Mathf.Clamp01(.5f - d * resolution) * 255);
        }
        var texture = UploadImage(width * resolution, height * resolution, rgba);
        texture.filterMode = FilterMode.Bilinear; texture.Apply(); return texture;
    }

    private void ClearDefeatPortrait()
    {
        if (defeatPortrait != null) Object.Destroy(defeatPortrait);
        defeatPortrait = null; defeatPortraitPath = ""; nextDefeatPortrait = 0;
        defeatDrawn = false;
    }

    private void RefreshDefeatPortrait()
    {
        if (Time.realtimeSinceStartup < nextDefeatPortrait) return;
        nextDefeatPortrait = Time.realtimeSinceStartup + .5f;
        if (!liveAvatars.TryGetValue(survival.KilledBy, out var path) || !File.Exists(path) || path == defeatPortraitPath) return;
        try
        {
            var image = StbImageSharp.ImageResult.FromMemory(File.ReadAllBytes(path), StbImageSharp.ColorComponents.RedGreenBlueAlpha);
            int side = Math.Min(image.Width, image.Height), size = Math.Min(512, side);
            var rgba = new byte[size * size * 4];
            for (int y = 0; y < size; y++) for (int x = 0; x < size; x++)
            {
                int sx = (image.Width - side) / 2 + x * side / size, sy = (image.Height - side) / 2 + y * side / size;
                int source = (sy * image.Width + sx) * 4, destination = (y * size + x) * 4;
                Buffer.BlockCopy(image.Data, source, rgba, destination, 4);
                float dx = x - (size - 1) / 2f, dy = y - (size - 1) / 2f;
                rgba[destination + 3] = (byte)(rgba[destination + 3] * Math.Clamp(size / 2f - MathF.Sqrt(dx * dx + dy * dy), 0, 1));
            }
            var texture = UploadImage(size, size, rgba); texture.filterMode = FilterMode.Bilinear; texture.Apply();
            if (defeatPortrait != null) Object.Destroy(defeatPortrait);
            defeatPortrait = texture; defeatPortraitPath = path;
        }
        catch (Exception error) { MelonLoader.MelonLogger.Warning("Defeat portrait: " + error.Message); }
    }

    private void EnsureSurvivalStyles()
    {
        EnsureProgressHudStyles();
        if (healthLabel != null) return;
        healthLabel = HudLabelStyle(12, HudNavy, TextAnchor.MiddleLeft);
        healthValue = HudLabelStyle(16, HudNavy, TextAnchor.MiddleRight);
        defeatHeading = HudLabelStyle(30, HudCream, TextAnchor.MiddleCenter);
        defeatName = HudLabelStyle(26, Color.white, TextAnchor.MiddleCenter);
        defeatCaption = HudLabelStyle(14, Muted, TextAnchor.MiddleCenter);
        healthPlate = MakeHealthShape(360, 64, new[] { new Vector2(1, 13), new Vector2(14, 1), new Vector2(64, 1),
            new Vector2(79, 10), new Vector2(344, 10), new Vector2(359, 23), new Vector2(348, 63),
            new Vector2(15, 63), new Vector2(1, 51) }, true);
        healthSegment = MakeHealthShape(30, 18, new[] { new Vector2(7, 0), new Vector2(30, 0), new Vector2(23, 18), new Vector2(0, 18) });
        portraitDisc = new Texture2D(256, 256, TextureFormat.RGBA32, false);
        for (int y = 0; y < 256; y++) for (int x = 0; x < 256; x++)
        {
            float dx = x - 127.5f, dy = y - 127.5f;
            portraitDisc.SetPixel(x, y, new Color(1, 1, 1, Mathf.Clamp01(128 - MathF.Sqrt(dx * dx + dy * dy))));
        }
        portraitDisc.Apply();
    }

    private void DrawSurvivalHud()
    {
        healthDrawn = false;
        if (!settings.EnemyAttacks) return;
        EnsureSurvivalStyles();
        DrawDamageVignette();
        healthBounds = HealthHudBounds();
        float x = healthBounds.x, y = healthBounds.y;
        float scale = healthBounds.width / 360;
        Rect Slot(float left, float top, float width, float height) => new Rect(x + left * scale, y + top * scale, width * scale, height * scale);
        DrawHudIcon(Slot(1, 3, 359, 61), healthPlate, new Color(0, 0, 0, .25f), ScaleMode.StretchToFill);
        DrawHudIcon(healthBounds, healthPlate, Color.white, ScaleMode.StretchToFill);
        float percentage = survival.Health * 100f / survival.MaximumHealth;
        Color fill = PrisonActive ? Accent : percentage <= 30 ? BrandRed : percentage <= 50 ? HudOrange : HudMint;
        float beat = percentage <= 30 ? 1 + Mathf.Sin(Time.time * 8) * .04f : 1;
        float iconSize = 30 * beat;
        DrawHudIcon(Slot(40 - iconSize / 2, 33 - iconSize / 2, iconSize, iconSize),
            LoadIcon(PrisonActive ? "ui-ShieldCheck.png" : "ui-HeartPulse.png"), percentage <= 30 && !PrisonActive ? BrandRed : HudCream);
        healthLabel.fontSize = Math.Max(1, (int)MathF.Round(12 * scale));
        Label(Slot(84, 10, 130, 18), PrisonActive ? "CAN / KORUMA" : "CAN", healthLabel);
        healthValue.fontSize = Math.Max(1, (int)MathF.Round((survival.MaximumHealth >= 1000 ? 14 : 16) * scale));
        Label(Slot(218, 8, 114, 22), survival.Health + " / " + survival.MaximumHealth, healthValue);
        if (percentage < lastShownHealth) { healthTrail = Math.Max(healthTrail, lastShownHealth); healthChangedAt = Time.time; }
        if (percentage > lastShownHealth) healthTrail = percentage;
        lastShownHealth = percentage;
        if (Time.time - healthChangedAt > .18f) healthTrail = Mathf.MoveTowards(healthTrail, percentage, Time.deltaTime * 120);
        Paint(Slot(79, 30, 259, 24), HudNavy);
        const float segment = 25.1f;
        for (int i = 0; i < 10; i++)
        {
            var rect = Slot(83 + i * segment, 33, segment - 2.5f, 18);
            DrawHudIcon(rect, healthSegment, HudTrack, ScaleMode.StretchToFill);
            float trail = Mathf.Clamp01((healthTrail - i * 10) / 10);
            if (trail > 0) DrawHudIcon(new Rect(rect.x, rect.y, rect.width * trail, rect.height), healthSegment, HudOrange, ScaleMode.StretchToFill);
            float amount = Mathf.Clamp01((percentage - i * 10) / 10f);
            if (amount > 0) DrawHudIcon(new Rect(rect.x, rect.y, rect.width * amount, rect.height), healthSegment, fill, ScaleMode.StretchToFill);
        }
        healthDrawn = true;
    }

    private void DrawDefeatOverlay()
    {
        EnsureSurvivalStyles(); RefreshDefeatPortrait();
        healthDrawn = false; defeatDrawn = true;
        Paint(new Rect(0, 0, Screen.width, Screen.height), new Color(.018f, .026f, .034f, .91f));
        float centre = Screen.width / 2f, diameter = Math.Min(228, Screen.height - 310), top = (Screen.height - diameter - 198) / 2;
        Label(new Rect(centre - 180, top, 360, 24), "SON DARBE", defeatCaption, BrandRed);
        Label(new Rect(centre - 280, top + 28, 560, 44), "YAYINCIYI ELEYEN", defeatHeading);
        defeatPortraitBounds = new Rect(centre - diameter / 2, top + 91, diameter, diameter);
        var ring = new Rect(defeatPortraitBounds.x - 7, defeatPortraitBounds.y - 7, diameter + 14, diameter + 14);
        DrawHudIcon(ring, portraitDisc, HudOrange, ScaleMode.StretchToFill);
        DrawHudIcon(new Rect(ring.x + 3, ring.y + 3, ring.width - 6, ring.height - 6), portraitDisc, HudNavy, ScaleMode.StretchToFill);
        if (defeatPortrait != null) GUI.DrawTexture(defeatPortraitBounds, defeatPortrait, ScaleMode.ScaleToFit);
        else
        {
            string initial = survival.KilledBy.Length > 0 ? survival.KilledBy[..1].ToUpperInvariant() : "?";
            Label(defeatPortraitBounds, initial, number);
        }
        string user = "@" + survival.KilledBy;
        defeatName.fontSize = 26;
        while (defeatName.fontSize > 14 && defeatName.CalcSize(new GUIContent(user)).x > Math.Min(580, Screen.width - 60)) defeatName.fontSize--;
        Label(new Rect(30, defeatPortraitBounds.yMax + 15, Screen.width - 60, 38), user, defeatName);
        Label(new Rect(centre - 180, defeatPortraitBounds.yMax + 61, 360, 24), "YENI TUR  /  " + Math.Ceiling(Math.Max(0, restartAt - Time.time)).ToString("0"), defeatCaption);
        Paint(new Rect(centre - 80, defeatPortraitBounds.yMax + 98, 160, 3), HudEtching);
        Paint(new Rect(centre - 80, defeatPortraitBounds.yMax + 98, 160 * Mathf.Clamp01((float)(restartAt - Time.time) / 5), 3), HudOrange);
    }
}
