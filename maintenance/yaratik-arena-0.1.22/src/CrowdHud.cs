using System.Globalization;
using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private GUIStyle crowdTitleStyle, crowdLabelStyle, crowdRightStyle;
    private Rect crowdCounterBounds;
    private string crowdCounterDigits = "0000000";
    private static readonly byte[] DigitSegments = { 0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f };
    private static readonly Color DisplayInk = new(.65f, .76f, .71f);
    private static readonly Color DisplayLed = new(.58f, .96f, .79f);
    private static readonly NumberFormatInfo CrowdNumberFormat = new() { NumberGroupSeparator = ".", NumberDecimalDigits = 0 };
    private void DrawCrowdCounter()
    {
        EnsureProgressHudStyles();
        crowdTitleStyle ??= HudLabelStyle(12, new Color(.90f, .95f, .92f), TextAnchor.MiddleLeft);
        crowdLabelStyle ??= HudLabelStyle(10, DisplayInk, TextAnchor.MiddleLeft);
        crowdRightStyle ??= HudLabelStyle(10, DisplayInk, TextAnchor.MiddleRight);
        const float w = 276;
        float x = Screen.width - w - 16, y = Screen.width >= 1180 ? 8 : 140;
        const float height = 80;
        crowdCounterBounds = new Rect(x, y, w, height);
        PaintCounterSurface(crowdCounterBounds, new Color(.24f, .36f, .31f));
        PaintCounterSurface(new Rect(x + 1, y + 1, w - 2, height - 2), new Color(.065f, .105f, .085f));
        DrawHudIcon(new Rect(x + 12, y + 5, 16, 16), hudCreature, new Color(1, .70f, .39f));
        Label(new Rect(x + 35, y + 3, 154, 22), "CANLI YARATIK", crowdTitleStyle);

        PaintCounterSurface(new Rect(x + 9, y + 27, w - 18, 49), new Color(.12f, .20f, .15f));
        PaintCounterSurface(new Rect(x + 10, y + 28, w - 20, 47), new Color(.018f, .045f, .028f));
        int alive = Math.Clamp(rules.Alive, 0, 1_000_000);
        crowdCounterDigits = alive.ToString("D7", CultureInfo.InvariantCulture);
        int firstActive = 7 - alive.ToString(CultureInfo.InvariantCulture).Length;
        float digitX = Mathf.Floor(x + (w - 215) / 2);
        for (int i = 0; i < 7; i++)
        {
            if (i > 0) digitX += 9;
            if (i is 1 or 4)
            {
                bool active = i == 1 ? alive >= 1_000_000 : alive >= 1000;
                Paint(new Rect(digitX + 1, y + 66, 3, 3), new Color(DisplayLed.r, DisplayLed.g, DisplayLed.b, active ? 1 : .08f));
                digitX += 7;
            }
            DrawDigitalDigit(digitX, y + 34, crowdCounterDigits[i] - '0', i >= firstActive);
            digitX += 21;
        }
    }

    private void DrawDigitalDigit(float x, float y, int digit, bool active)
    {
        byte mask = DigitSegments[digit];
        DrawLedSegment(new Rect(x + 3, y, 15, 3), (mask & 1) != 0, active);
        DrawLedSegment(new Rect(x + 18, y + 2, 3, 15), (mask & 2) != 0, active);
        DrawLedSegment(new Rect(x + 18, y + 19, 3, 15), (mask & 4) != 0, active);
        DrawLedSegment(new Rect(x + 3, y + 33, 15, 3), (mask & 8) != 0, active);
        DrawLedSegment(new Rect(x, y + 19, 3, 15), (mask & 16) != 0, active);
        DrawLedSegment(new Rect(x, y + 2, 3, 15), (mask & 32) != 0, active);
        DrawLedSegment(new Rect(x + 3, y + 16, 15, 3), (mask & 64) != 0, active);
    }

    private void DrawLedSegment(Rect rect, bool lit, bool active)
    {
        Color color = new(DisplayLed.r, DisplayLed.g, DisplayLed.b, !lit ? .025f : active ? 1 : .1f);
        if (lit && active) Paint(new Rect(rect.x - 1, rect.y - 1, rect.width + 2, rect.height + 2), new Color(DisplayLed.r, DisplayLed.g, DisplayLed.b, .07f));
        // Chamfered ends keep the seven-segment face crisp without a font or shader dependency.
        if (rect.width > rect.height)
        {
            Paint(new Rect(rect.x + 1, rect.y, rect.width - 2, rect.height), color);
            Paint(new Rect(rect.x, rect.y + 1, rect.width, rect.height - 2), color);
        }
        else
        {
            Paint(new Rect(rect.x, rect.y + 1, rect.width, rect.height - 2), color);
            Paint(new Rect(rect.x + 1, rect.y, rect.width - 2, rect.height), color);
        }
    }

    private void PaintCounterSurface(Rect rect, Color color)
    {
        Paint(new Rect(rect.x + 6, rect.y, rect.width - 12, rect.height), color);
        Paint(new Rect(rect.x + 3, rect.y + 1, rect.width - 6, rect.height - 2), color);
        Paint(new Rect(rect.x + 1, rect.y + 3, rect.width - 2, rect.height - 6), color);
        Paint(new Rect(rect.x, rect.y + 6, rect.width, rect.height - 12), color);
    }

    private void DrawRoundSettings(Rect area)
    {
        float x = area.x, y = area.y + 94, w = area.width;
        Label(new Rect(x, y, 140, 30), "Oyun modu", sectionStyle);
        if (Button(new Rect(x + w - 248, y, 118, 32), "Serbest", !settings.TimedMode)) SetTimedMode(false);
        if (Button(new Rect(x + w - 118, y, 118, 32), "Sureli", settings.TimedMode)) SetTimedMode(true);
        if (settings.TimedMode)
        {
            Label(new Rect(x, y + 40, w, 20), "GOREV AYARLARI", captionStyle, Amber);
            float half = (w - 24) / 2;
            CompactNumeric(new Rect(x, y + 69, half, 62), "Dakika", "task-minutes", settings.RoundSeconds / 60, 0, 60, value => settings.RoundSeconds = Math.Clamp(value * 60 + settings.RoundSeconds % 60, 1, 3600));
            CompactNumeric(new Rect(x + half + 24, y + 69, half, 62), "Saniye", "task-seconds", settings.RoundSeconds % 60, 0, 59, value => settings.RoundSeconds = Math.Clamp(settings.RoundSeconds / 60 * 60 + value, 1, 3600));
            CompactNumeric(new Rect(x, y + 145, half, 62), "Oldurme hedefi", "task-target", settings.KillTarget, 1, 1_000_000, value => settings.KillTarget = value);
            CompactNumeric(new Rect(x + half + 24, y + 145, half, 62), "Win hedefi", "win-goal", settings.WinGoal, 1, 1_000_000, value => settings.WinGoal = value);
        }
        else Label(new Rect(x, y + 63, w, 34), "SERBEST TUR", sectionStyle, HudMint);
        float limitY = settings.TimedMode ? y + 220 : y + 117;
        NumericOption(new Rect(x, limitY, w, 34), "Canavar siniri (en fazla 2.500)", "crowd-limit", settings.MaxCreatures, 10, MaxPhysicalCreatures, value => { settings.MaxCreatures = value; settings.PhysicalCreatures = value; });
        Rule(x, limitY + 46, w);
        Label(new Rect(x, limitY + 57, w - 154, 30), rules.Wins + " / " + settings.WinGoal + " WIN", bodyStyle, HudMint);
        if (Button(new Rect(x + w - 142, limitY + 57, 142, 30), "Turu sifirla")) Reset();
    }

    private void CompactNumeric(Rect rect, string label, string key, int value, int min, int max, Action<int> apply)
    {
        Label(new Rect(rect.x, rect.y, rect.width, 22), label, bodyStyle);
        string edited = EditField(new Rect(rect.x, rect.y + 26, rect.width, 34), key, value.ToString(), 7, true);
        if (int.TryParse(edited, out int parsed) && parsed >= min && parsed <= max && parsed != value) { apply(parsed); settingsDirty = true; }
    }

    private void SetTimedMode(bool enabled)
    {
        if (settings.TimedMode == enabled) return;
        settings.TimedMode = enabled;
        settingsDirty = true;
        Reset();
    }

    private void NumericOption(Rect rect, string label, string key, int value, int min, int max, Action<int> apply)
    {
        Label(new Rect(rect.x, rect.y, rect.width - 180, rect.height), label, bodyStyle);
        string edited = EditField(new Rect(rect.xMax - 160, rect.y, 160, rect.height), key, value.ToString(), 7, true);
        if (int.TryParse(edited, out int parsed) && parsed >= min && parsed <= max && parsed != value) { apply(parsed); settingsDirty = true; }
    }
}
