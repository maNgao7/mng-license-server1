using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private readonly RoundHighlights highlights = new();
    private RoundRecap lastRoundRecap;
    private GUIStyle storyTitle, storyNumber, storySmall;
    private float comboMilestoneUntil, nextComboSound;
    private bool showLastRecap, comboDrawn, cleanupDrawn, recapDrawn;
    private Rect comboBounds, cleanupBounds, recapBounds;

    private void UpdateHighlights()
    {
        highlights.ConfigureCleanup(false, settings.CleanupTarget);
        highlights.Tick(Time.time, settings.ComboEnabled);
        UpdateGiftNotices();
    }

    private void RegisterHighlightKill()
    {
        int previous = highlights.Combo;
        int milestone = highlights.Kill(Time.time, rules.Level, settings.ComboEnabled);
        if (highlights.Combo >= 2 && previous < 2) comboBubbleStarted = Time.time;
        if (milestone == 0) return;
        comboMilestoneUntil = Time.time + .9f;
        if (Time.time >= nextComboSound) { PlayTone(660, .1f); nextComboSound = Time.time + .75f; }
    }

    private void RegisterHighlightCollection()
    {
        highlights.Collect(Time.time);
        highlights.VisitWeapon(rules.Level);
    }

    private void EnsureStoryStyles()
    {
        EnsureProgressHudStyles();
        storyTitle ??= HudLabelStyle(14, Ink, TextAnchor.MiddleLeft);
        storyNumber ??= HudLabelStyle(28, Ink, TextAnchor.MiddleLeft);
        storySmall ??= HudLabelStyle(11, Muted, TextAnchor.MiddleLeft);
    }

    private void DrawHighlightsHud()
    {
        EnsureStoryStyles(); comboDrawn = cleanupDrawn = false;
        DrawComboBubble();
        DrawGiftNotice();
    }

    private void DrawRoundRecapOverlay()
    {
        recapDrawn = false;
        if (!settings.RoundSummaryEnabled || lastRoundRecap == null) return;
        EnsureStoryStyles();
        Paint(new Rect(0, 0, Screen.width, Screen.height), new Color(.015f, .025f, .03f, .82f));
        float width = Math.Min(560, Screen.width - 32), height = 308;
        recapBounds = new Rect((Screen.width - width) / 2, (Screen.height - height) / 2, width, height);
        PaintCounterSurface(recapBounds, Line);
        PaintCounterSurface(new Rect(recapBounds.x + 1, recapBounds.y + 1, width - 2, height - 2), MenuCanvas);
        Paint(new Rect(recapBounds.x + 1, recapBounds.y + 6, width - 2, 56), HudCream);
        DrawHudIcon(new Rect(recapBounds.x + 14, recapBounds.y + 10, 46, 46), LoadIcon("TikMnG-logo-v3.png"), Color.white);
        Label(new Rect(recapBounds.x + 76, recapBounds.y + 10, width - 94, 43), lastRoundRecap.Won ? "WINNER" : "SURE DOLDU", titleStyle, HudNavy);
        DrawRecapContents(new Rect(recapBounds.x + 22, recapBounds.y + 74, width - 44, 221), lastRoundRecap);
        recapDrawn = true;
    }

    private void DrawRecapContents(Rect area, RoundRecap result)
    {
        EnsureStoryStyles();
        Label(new Rect(area.x, area.y, area.width / 2, 20), "TUR " + result.Round.ToString("00") + " / " + FormatRoundTime(result.Seconds), storySmall, Muted);
        var right = hudFooterStyle.alignment;
        hudFooterStyle.alignment = TextAnchor.MiddleRight;
        Label(new Rect(area.center.x, area.y, area.width / 2, 20), result.Wins + " WIN", hudFooterStyle, result.Won ? HudMint : HudOrange);
        hudFooterStyle.alignment = right;
        float half = area.width / 2;
        DrawRecapMetric(new Rect(area.x, area.y + 31, half - 12, 67), "OLDURULEN", result.Kills.ToString("N0"));
        DrawRecapMetric(new Rect(area.x + half + 12, area.y + 31, half - 12, 67), "TOPLANAN", result.Collected.ToString("N0"));
        Rule(area.x, area.y + 104, area.width);
        DrawRecapMetric(new Rect(area.x, area.y + 115, half - 12, 67), "EN IYI KOMBO", result.BestCombo.ToString("N0"));
        Label(new Rect(area.x + half + 12, area.y + 115, half - 12, 20), "EN YUKSEK SILAH", storySmall);
        DrawHudIcon(new Rect(area.x + half + 12, area.y + 143, 32, 28), WeaponIcon(result.HighestWeapon), HudCream);
        FitStoryLabel(new Rect(area.x + half + 53, area.y + 138, half - 53, 40), Rules.WeaponNames[result.HighestWeapon], storyTitle, Ink);
    }

    private void DrawRecapMetric(Rect rect, string label, string value)
    {
        Label(new Rect(rect.x, rect.y, rect.width, 20), label, storySmall);
        storyNumber.fontSize = 28;
        FitStoryLabel(new Rect(rect.x, rect.y + 23, rect.width, 40), value, storyNumber, Ink);
    }

    private static string FormatRoundTime(double seconds)
    {
        var time = TimeSpan.FromSeconds(Math.Clamp(seconds, 0, 604800));
        return seconds >= 3600 ? ((int)time.TotalHours) + time.ToString(@"\:mm\:ss") : time.ToString(@"mm\:ss");
    }

    private bool HighlightToggle(Rect area, string label, bool value)
    {
        Label(new Rect(area.x, area.y, area.width - 142, 32), label, bodyStyle);
        bool changed = GUI.Toggle(new Rect(area.xMax - 132, area.y, 132, 32), value, value ? "[x] Acik" : "[ ] Kapali", fieldStyle);
        if (changed != value) settingsDirty = true;
        return changed;
    }

    private void DrawHighlightSettings(Rect area)
    {
        EnsureStoryStyles();
        float x = area.x, y = area.y + 91, w = area.width;
        if (showLastRecap)
        {
            if (IconButton(new Rect(x, y, 34, 32), "ArrowLeft", "Yayin ayarlarina don")) showLastRecap = false;
            Label(new Rect(x + 48, y, w - 48, 32), "Son tur", sectionStyle);
            if (lastRoundRecap == null) Label(new Rect(x, y + 57, w, 32), "Henuz tamamlanan tur yok.", bodyStyle);
            else DrawRecapContents(new Rect(x, y + 47, w, 222), lastRoundRecap);
            return;
        }
        settings.ComboEnabled = HighlightToggle(new Rect(x, y, w, 32), "Kombo gostergesi", settings.ComboEnabled);
        settings.GiftNoticesEnabled = HighlightToggle(new Rect(x, y + 43, w, 32), "Hediye bildirimleri", settings.GiftNoticesEnabled);
        settings.RoundSummaryEnabled = HighlightToggle(new Rect(x, y + 86, w, 32), "Tur sonu ozeti", settings.RoundSummaryEnabled);
        Rule(x, y + 137, w);
        if (CommandButton(new Rect(x, y + 154, Math.Min(w, 204), 36), "ListChecks", "Son tur ozeti")) showLastRecap = true;
    }
}
