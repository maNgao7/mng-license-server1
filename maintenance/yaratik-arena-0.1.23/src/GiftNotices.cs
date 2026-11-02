using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private sealed class GiftNotice
    {
        public string User, GiftId, Sender, Effect;
        public int Repeats;
        public bool Live;
        public GiftNotice(string user, string giftId, string sender, int repeats, string effect, bool live)
        { User = user; GiftId = giftId; Sender = sender; Repeats = repeats; Effect = effect; Live = live; }
    }
    private readonly Queue<GiftNotice> giftNotices = new();
    private GiftNotice activeGiftNotice;
    private float giftNoticeUntil;
    private int giftNoticesReceived;
    private Rect giftNoticeBounds;
    private bool giftNoticeDrawn;

    private void QueueGiftNotice(string id, int repeats, string user, bool fromLive, int addedCreatures)
    {
        if (!settings.GiftNoticesEnabled || repeats <= 0 || string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(user)) return;
        repeats = Math.Clamp(repeats, 1, 10000);
        var effects = new List<string>();
        var bindings = settings.Actions.Where(a => a.GiftId == id).ToArray();
        long requested = bindings.Where(a => a.Op == "spawn").Sum(a => (long)a.Count * repeats);
        if (requested > 0)
            effects.Add(addedCreatures > 0 ? "+" + addedCreatures.ToString("N0") + " YARATIK" : "YARATIK SINIRI DOLU");
        foreach (var binding in bindings.Where(a => a.Op != "spawn"))
        {
            int amount = EffectState.Amount(binding.Count, repeats);
            effects.Add(binding.Op switch
            {
                "flash" => "FLASH " + amount + " sn", "prison" => "HAPIS +" + amount + " sn",
                "release" => "HAPIS -" + amount + " sn", "up" => "SILAH +" + Math.Min(7, amount),
                "down" => "SILAH -" + Math.Min(7, amount), "boss" => "BOSS +" + amount,
                "bigboss" => "BIG BOSS +" + amount, "helper" => "DESTEK +" + amount, _ => ""
            });
        }
        string sender = viewerNames.TryGetValue(user, out var nickname) ? nickname : "@" + user;
        sender = new string(sender.Where(c => !char.IsControl(c)).Take(64).ToArray());
        while (giftNotices.Count >= 8) giftNotices.Dequeue();
        giftNotices.Enqueue(new GiftNotice(user, id, sender, repeats,
            effects.Count > 0 ? string.Join(" / ", effects) : "ESLESMEMIS HEDIYE", fromLive));
        giftNoticesReceived++;
    }

    private void UpdateGiftNotices()
    {
        if (!settings.GiftNoticesEnabled) { giftNotices.Clear(); activeGiftNotice = null; return; }
        if (rules.Won || roundTimedOut)
        {
            if (activeGiftNotice != null) giftNoticeUntil += Time.deltaTime;
            return;
        }
        if (activeGiftNotice != null && Time.time >= giftNoticeUntil) activeGiftNotice = null;
        if (activeGiftNotice == null && giftNotices.Count > 0)
        { activeGiftNotice = giftNotices.Dequeue(); giftNoticeUntil = Time.time + 4; }
    }

    private void FitStoryLabel(Rect rect, string value, GUIStyle style, Color color)
    {
        value ??= "";
        if (value.Length > 100) value = value[..100];
        string fitted = value;
        while (fitted.Length > 0 && style.CalcSize(new GUIContent(fitted)).x > rect.width)
            fitted = fitted[..^1];
        if (fitted.Length < value.Length)
        {
            while (fitted.Length > 0 && style.CalcSize(new GUIContent(fitted + "...")).x > rect.width) fitted = fitted[..^1];
            fitted += "...";
        }
        Label(rect, fitted, style, color);
    }

    private void DrawGiftNotice()
    {
        giftNoticeDrawn = false;
        if (activeGiftNotice == null || !settings.GiftNoticesEnabled) return;
        EnsureBubbleStyles();
        const float width = 300, height = 88;
        float age = 4 - (giftNoticeUntil - Time.time), alpha = BubbleOpacity(age, giftNoticeUntil - Time.time);
        float x = 12, y = GiftNoticeTop() + BubbleSlide(age);
        giftNoticeBounds = new Rect(x, y, width, height);
        DrawSpeechBubble(giftNoticeBounds, giftBubble, alpha);
        DrawHudIcon(new Rect(x + 14, y + 15, 36, 36), Portrait(activeGiftNotice.User), new Color(1, 1, 1, alpha));
        var gift = gifts.Find(g => g.id == activeGiftNotice.GiftId);
        DrawHudIcon(new Rect(x + width - 50, y + 15, 34, 34), gift == null ? LoadIcon("ui-Gift.png") : GiftImage(gift), new Color(1, 1, 1, alpha));
        FitStoryLabel(new Rect(x + 59, y + 9, width - 116, 23), activeGiftNotice.Sender, bubbleTitle, BubbleTint(HudNavy, alpha));
        string giftLabel = (activeGiftNotice.Live ? "" : "TEST / ") + (gift?.Title ?? "ID " + activeGiftNotice.GiftId) + " x" + activeGiftNotice.Repeats;
        FitStoryLabel(new Rect(x + 59, y + 31, width - 116, 18), giftLabel, bubbleCaption, BubbleTint(new Color(.25f, .29f, .3f), alpha));
        FitStoryLabel(new Rect(x + 16, y + 49, width - 32, 23), activeGiftNotice.Effect, bubbleTitle, BubbleTint(HudNavy, alpha));
        giftNoticeDrawn = alpha > 0;
    }

    private float GiftNoticeTop() => (Screen.width >= 1180 ? 8 : 140) + (settings.TimedMode ? 156 : 8);
    private Rect GiftNoticeReserved() => activeGiftNotice != null && settings.GiftNoticesEnabled
        ? new Rect(12, GiftNoticeTop(), 300, 104) : default;
}
