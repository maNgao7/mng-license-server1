using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private float shownProgress, weaponChangedUntil;
    private int weaponChangeDirection;
    private bool progressionRendered;
    private Rect progressionBounds;

    private static readonly Color HudCream = new(251 / 255f, 230 / 255f, 203 / 255f);
    private static readonly Color HudNavy = new(15 / 255f, 25 / 255f, 42 / 255f);
    private static readonly Color HudOrange = new(252 / 255f, 136 / 255f, 39 / 255f);
    private static readonly Color HudMint = new(.43f, .91f, .72f);
    private static readonly Color HudEtching = new(.23f, .31f, .37f);
    private static readonly Color HudTrack = new(.12f, .20f, .25f);
    private Texture2D hudPlate, hudCreature;
    private GUIStyle hudBrandStyle, hudStatusStyle, hudStageStyle, hudCaptionStyle;
    private GUIStyle hudWeaponStyle, hudCenterCaptionStyle, hudCountStyle, hudGoalStyle, hudMaxStyle, hudFooterStyle;
    private float hudChangePulse;

    private GUIStyle HudLabelStyle(int size, Color color, TextAnchor alignment, bool wrap = false)
    {
        var style = LabelStyle(size, color, true);
        style.alignment = alignment;
        style.wordWrap = wrap;
        return style;
    }

    private void EnsureProgressHudStyles()
    {
        EnsureMenuStyles();
        if (hudBrandStyle != null) return;
        hudBrandStyle = HudLabelStyle(18, HudNavy, TextAnchor.MiddleLeft);
        hudStatusStyle = HudLabelStyle(13, HudNavy, TextAnchor.MiddleCenter);
        hudStageStyle = HudLabelStyle(14, HudNavy, TextAnchor.MiddleRight);
        hudCaptionStyle = HudLabelStyle(12, HudMint, TextAnchor.MiddleLeft);
        hudWeaponStyle = HudLabelStyle(18, HudCream, TextAnchor.MiddleLeft, true);
        hudCenterCaptionStyle = HudLabelStyle(12, HudMint, TextAnchor.MiddleCenter);
        hudCountStyle = HudLabelStyle(38, Color.white, TextAnchor.MiddleRight);
        hudGoalStyle = HudLabelStyle(19, HudOrange, TextAnchor.MiddleLeft);
        hudMaxStyle = HudLabelStyle(30, HudOrange, TextAnchor.MiddleCenter);
        hudFooterStyle = HudLabelStyle(12, HudNavy, TextAnchor.MiddleLeft);
        hudPlate = LoadIcon("skilltreetitle-1082.png");
        hudCreature = LoadIcon("creature_icon-1094.png");
    }

    private void UpdateProgressHud()
    {
        // Gift shifts retain partial collection progress; kills never fill this gauge.
        float target = rules.IsFinalWeapon ? 1 : rules.Progress / (float)rules.RequiredCollections;
        shownProgress = Mathf.MoveTowards(shownProgress, target, Time.unscaledDeltaTime * 1.8f);
        float remaining = weaponChangedUntil - Time.realtimeSinceStartup;
        float pulseTime = Mathf.Clamp01((2.4f - remaining) / .9f);
        hudChangePulse = remaining > 0 && weaponChangeDirection != 0
            ? (1 - pulseTime) * (.65f + .35f * Mathf.Sin(pulseTime * Mathf.PI * 3))
            : 0;
    }

    private void DrawProgressHud()
    {
        EnsureProgressHudStyles();
        bool compact = Screen.width < 1000;
        float width = Math.Min(560, Screen.width - 32);
        const float y = 8, height = 126;
        float x = Mathf.Floor((Screen.width - width) / 2), center = x + width / 2;
        progressionBounds = new Rect(x, y, width, height);
        bool final = rules.IsFinalWeapon;
        bool changed = Time.realtimeSinceStartup < weaponChangedUntil && weaponChangeDirection != 0;
        Color pulseColor = weaponChangeDirection < 0 ? HudOrange : HudMint;

        if (hudPlate != null) DrawHudIcon(progressionBounds, hudPlate, Color.white, ScaleMode.StretchToFill);

        // Cover only the original barcode, preserving the cream bevel and hazard stripes.
        Paint(new Rect(x + 15, y + 7, width - 30, 26), HudCream);
        string status = changed ? weaponChangeDirection > 0 ? "SILAH YUKSELDI" : "SILAH DUSTU" : "";
        Color statusColor = changed
            ? weaponChangeDirection > 0 ? new Color(.08f, .36f, .28f) : new Color(.62f, .23f, .05f)
            : HudNavy;
        hudBrandStyle.alignment = TextAnchor.MiddleCenter;
        hudBrandStyle.fontSize = 19;
        Label(new Rect(center - 74, y + 4, 148, 28), "TikMnG", hudBrandStyle);
        Paint(new Rect(center - 91, y + 12, 3, 12), HudOrange);
        Paint(new Rect(center + 88, y + 12, 3, 12), HudOrange);
        hudStatusStyle.fontSize = 10;
        Label(new Rect(x + 25, y + 5, 155, 28), status, hudStatusStyle, statusColor);
        Label(new Rect(x + width - 164, y + 5, 138, 28), "SILAH " + (rules.Level + 1).ToString("00") + " / " + Rules.WeaponNames.Length.ToString("00"), hudStageStyle);

        float leftText = x + 88, leftEnd = center - 94;
        float rightText = center + 94, rightIcon = x + width - 82;
        Color divider = Color.Lerp(HudEtching, pulseColor, hudChangePulse * .8f);
        Paint(new Rect(center - 84, y + 40, 1, 43), divider);
        Paint(new Rect(center + 84, y + 40, 1, 43), divider);

        var currentIcon = vacuum ? LoadIcon("VacuumRange-1128.png") : WeaponIcon(rules.Level);
        var currentRect = new Rect(x + 26, y + 42, 50, 38);
        if (hudChangePulse > 0 && currentIcon != null)
        {
            float spread = 3 * hudChangePulse;
            DrawHudIcon(new Rect(currentRect.x - spread, currentRect.y - spread, currentRect.width + spread * 2, currentRect.height + spread * 2), currentIcon,
                new Color(pulseColor.r, pulseColor.g, pulseColor.b, hudChangePulse * .45f));
        }
        DrawHudIcon(currentRect, currentIcon, Color.Lerp(HudCream, pulseColor, hudChangePulse * .65f));
        Label(new Rect(leftText, y + 36, leftEnd - leftText, 17), "ELINDEKI", hudCaptionStyle);
        Label(new Rect(leftText, y + 52, leftEnd - leftText, 36), vacuum ? "Vakum" : Rules.WeaponNames[rules.Level], hudWeaponStyle);

        Label(new Rect(center - 76, y + 35, 152, 17), final ? "SON SILAH" : "TOPLANAN", hudCenterCaptionStyle, final ? HudOrange : HudMint);
        DrawHudIcon(new Rect(center - 72, y + 59, 25, 25), LoadIcon("VacuumRange-1128.png"), HudOrange);
        if (final) Label(new Rect(center - 35, y + 49, 108, 40), "MAX", hudMaxStyle);
        else
        {
            string progressText = rules.Progress.ToString("00"), goalText = "/ " + rules.RequiredCollections;
            hudCountStyle.fontSize = progressText.Length > 3 ? 23 : progressText.Length > 2 ? 29 : 38;
            hudGoalStyle.fontSize = goalText.Length > 5 ? 13 : goalText.Length > 4 ? 16 : 19;
            Label(new Rect(center - 45, y + 48, 62, 43), progressText, hudCountStyle);
            Label(new Rect(center + 22, y + 60, 53, 29), goalText, hudGoalStyle);
        }

        float nextWidth = final ? x + width - 26 - rightText : rightIcon - 10 - rightText;
        Label(new Rect(rightText, y + 36, nextWidth, 17), final ? "SILAH SERISI" : "SIRADAKI", hudCaptionStyle, HudOrange);
        Label(new Rect(rightText, y + 52, nextWidth, 36), rules.NextWeapon, hudWeaponStyle, final ? HudMint : HudCream);
        if (!final) DrawHudIcon(new Rect(rightIcon, y + 42, 50, 38), WeaponIcon(rules.Level + 1), HudCream);

        DrawHudGauge(new Rect(x + 72, y + 92, width - 144, 9), final, pulseColor);
        Paint(new Rect(x + 20, y + 35, 3, 48), HudOrange);
        Paint(new Rect(x + width - 23, y + 35, 3, 48), HudMint);
        // This cream area ends before the native orange hazard detail begins.
        float footerWidth = width * .53f - 80;
        string footer = "TOPLAM " + rules.Kills + " OLDURME";
        Label(new Rect(x + 72, y + 105, footerWidth + 16, 18), footer, hudFooterStyle);
        progressionRendered = true;
    }

    private void DrawHudIcon(Rect rect, Texture2D texture, Color tint, ScaleMode scale = ScaleMode.ScaleToFit)
    {
        if (texture == null) return;
        var previous = GUI.color;
        GUI.color = tint;
        GUI.DrawTexture(rect, texture, scale);
        GUI.color = previous;
    }

    private void DrawHudGauge(Rect track, bool final, Color pulseColor)
    {
        Paint(new Rect(track.x - 2, track.y - 2, track.width + 4, track.height + 4), HudEtching);
        Paint(track, HudTrack);
        const int segments = 10;
        const float gap = 3;
        float segmentWidth = (track.width - gap * (segments - 1)) / segments;
        float progress = final ? 1 : Mathf.Clamp01(shownProgress);
        Color fill = Color.Lerp(HudMint, pulseColor, hudChangePulse * .6f);
        for (int i = 0; i < segments; i++)
        {
            float sx = track.x + i * (segmentWidth + gap);
            Paint(new Rect(sx, track.y, segmentWidth, track.height), HudNavy);
            float amount = Mathf.Clamp01(progress * segments - i);
            if (amount <= 0) continue;
            float filled = segmentWidth * amount;
            Paint(new Rect(sx, track.y, filled, track.height), fill);
            Paint(new Rect(sx, track.y, filled, 2), new Color(.85f, 1, .9f, .55f));
        }
    }
}
