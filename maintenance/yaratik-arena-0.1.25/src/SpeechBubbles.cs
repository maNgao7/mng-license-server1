using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private Texture2D comboBubble, giftBubble;
    private GUIStyle bubbleNumber, bubbleTitle, bubbleCaption;
    private float comboBubbleStarted;

    private void EnsureBubbleStyles()
    {
        bubbleNumber ??= HudLabelStyle(27, HudNavy, TextAnchor.MiddleLeft);
        bubbleTitle ??= HudLabelStyle(14, HudNavy, TextAnchor.MiddleLeft);
        bubbleCaption ??= HudLabelStyle(11, HudNavy, TextAnchor.MiddleLeft);
        comboBubble ??= MakeSpeechBubble(184, 60, HudOrange);
        giftBubble ??= MakeSpeechBubble(300, 88, HudMint);
    }

    private static Color BubbleTint(Color color, float opacity)
    { color.a *= opacity; return color; }

    private static float BubbleOpacity(float age, float remaining)
    {
        float entry = Mathf.Clamp01(age / .16f), exit = Mathf.Clamp01(remaining / .32f);
        return entry * entry * (3 - 2 * entry) * exit;
    }

    private static float BubbleSlide(float age)
    {
        float t = Mathf.Clamp01(age / .24f);
        return 14 * (1 - t) * (1 - t) * (1 - t);
    }

    // Cached, antialiased UI silhouettes. No per-frame texture or material allocation.
    private Texture2D MakeSpeechBubble(int width, int height, Color accent)
    {
        var bytes = new byte[width * height * 4];
        float Distance(float x, float y)
        {
            float qx = Math.Abs(x - width / 2f) - (width / 2f - 20);
            float qy = Math.Abs(y - (height - 12) / 2f) - ((height - 12) / 2f - 20);
            float body = MathF.Sqrt(Math.Max(qx, 0) * Math.Max(qx, 0) + Math.Max(qy, 0) * Math.Max(qy, 0))
                + Math.Min(Math.Max(qx, qy), 0) - 16;
            // A short, slightly angled speech tail connected to the lower edge.
            float ax = width * .67f, ay = height - 22, bx = ax + 19, by = ay, cx = ax + 16, cy = height - 3;
            float Edge(float px, float py, float ux, float uy, float vx, float vy)
            {
                float dx = vx - ux, dy = vy - uy;
                float t = Mathf.Clamp01(((px - ux) * dx + (py - uy) * dy) / (dx * dx + dy * dy));
                float ex = px - ux - t * dx, ey = py - uy - t * dy;
                return MathF.Sqrt(ex * ex + ey * ey);
            }
            float d = Math.Min(Edge(x, y, ax, ay, bx, by), Math.Min(Edge(x, y, bx, by, cx, cy), Edge(x, y, cx, cy, ax, ay)));
            bool inside = (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= 0
                && (cx - bx) * (y - by) - (cy - by) * (x - bx) >= 0
                && (ax - cx) * (y - cy) - (ay - cy) * (x - cx) >= 0;
            return Math.Min(body, inside ? -d : d);
        }
        for (int y = 0; y < height; y++)
        for (int x = 0; x < width; x++)
        {
            float d = Distance(x + .5f, y + .5f);
            float coverage = Mathf.Clamp01(.5f - d);
            Color fill = y < 7 ? Color.white : y > height - 24 ? Color.Lerp(HudCream, accent, .4f) : HudCream;
            Color color = Color.Lerp(HudNavy, fill, Mathf.Clamp01(-d - 2));
            int index = (y * width + x) * 4;
            bytes[index] = (byte)(color.r * 255); bytes[index + 1] = (byte)(color.g * 255);
            bytes[index + 2] = (byte)(color.b * 255); bytes[index + 3] = (byte)(coverage * 255);
        }
        var texture = UploadImage(width, height, bytes);
        texture.filterMode = FilterMode.Bilinear; texture.Apply();
        return texture;
    }

    private void DrawSpeechBubble(Rect bounds, Texture2D texture, float opacity)
    {
        DrawHudIcon(new Rect(bounds.x + 1, bounds.y + 3, bounds.width, bounds.height), texture, new Color(0, 0, 0, opacity * .24f));
        DrawHudIcon(bounds, texture, new Color(1, 1, 1, opacity));
    }

    private void DrawComboBubble()
    {
        if (!settings.ComboEnabled || highlights.Combo < 2 || rules.Won || roundTimedOut) return;
        EnsureBubbleStyles();
        float age = Time.time - comboBubbleStarted, remaining = (float)(highlights.ComboUntil - Time.time);
        float alpha = BubbleOpacity(age, remaining);
        comboBounds = new Rect((Screen.width - 184) / 2f, Screen.height - 110 + BubbleSlide(age), 184, 60);
        if (settings.EnemyAttacks)
        {
            var health = HealthHudBounds();
            comboBounds = Screen.width >= 1000 ? new Rect(health.xMax + 14, health.y + 4, 184, 60)
                : Screen.width >= 760 ? new Rect(health.x - 196, health.y + 4, 184, 60)
                : new Rect((Screen.width - 184) / 2f, health.y - 74, 184, 60);
        }
        comboBounds.x = Math.Clamp(comboBounds.x, 8, Math.Max(8, Screen.width - comboBounds.width - 8));
        if (settings.EnemyAttacks && comboBounds.Overlaps(HealthHudBounds())) comboBounds.y = HealthHudBounds().y - comboBounds.height - 10;
        if (AmmoHudVisible && comboBounds.Overlaps(AmmoHudLayout())) comboBounds.y = AmmoHudLayout().y - comboBounds.height - 10;
        DrawSpeechBubble(comboBounds, comboBubble, alpha);
        float x = comboBounds.x, y = comboBounds.y;
        DrawHudIcon(new Rect(x + 13, y + 12, 25, 25), LoadIcon("creature_icon-1094.png"), BubbleTint(HudOrange, alpha));
        bubbleNumber.fontSize = highlights.Combo >= 100000 ? 19 : 27;
        string number = highlights.Combo.ToString("N0");
        float numberWidth = Math.Min(75, bubbleNumber.CalcSize(new GUIContent(number)).x + 7);
        Label(new Rect(x + 46, y + 5, numberWidth, 37), number, bubbleNumber, BubbleTint(HudNavy, alpha));
        Label(new Rect(x + 46 + numberWidth, y + 7, 80 - numberWidth + 48, 34), "KOMBO!", bubbleTitle, BubbleTint(HudNavy, alpha));
        comboDrawn = alpha > 0;
    }
}
