using System.Globalization;
using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private static readonly Color Accent = new(.10f, .91f, .91f);
    private static readonly Color Ink = new(.97f, .975f, .98f);
    private static readonly Color Muted = new(.72f, .77f, .79f);
    private static readonly Color Line = new(.25f, .29f, .31f);
    private static readonly Color MenuCanvas = new(.075f, .085f, .095f);
    private static readonly Color MenuRail = new(.045f, .052f, .06f);
    private static readonly Color BrandRed = new(.95f, .07f, .25f);
    private static readonly Color Amber = new(.98f, .73f, .35f);
    private Texture2D uiPixel;
    private GUIStyle titleStyle, bodyStyle, captionStyle, sectionStyle, valueStyle;
    private GUIStyle buttonStyle, primaryStyle, fieldStyle, navStyle, selectedNavStyle, tileStyle;
    private GUIStyle optionTabStyle, selectedOptionTabStyle;
    private readonly Dictionary<string, Texture2D> weaponIcons = new();
    private int actionPage;
    private bool addingAction;
    private int triggerPicker = -1;

    private void DrawAudienceTrigger(Rect row, TriggerBinding trigger, bool like)
    {
        int index = like ? 0 : 1;
        if (GUI.Button(new Rect(row.x, row.y, 112, 30), "", fieldStyle)) { trigger.Enabled = !trigger.Enabled; settingsDirty = true; }
        var check = new Rect(row.x + 7, row.y + 7, 16, 16);
        if (trigger.Enabled) DrawHudIcon(check, LoadIcon("ui-CircleCheck.png"), Accent);
        else { Paint(check, Muted); Paint(new Rect(check.x + 2, check.y + 2, 12, 12), MenuCanvas); }
        Label(new Rect(row.x + 28, row.y, 80, 30), like ? "Begeni eylemi" : "Takip eylemi", captionStyle, Ink);
        float opX = row.x + 124, countX = row.xMax - 114;
        if (Button(new Rect(opX, row.y, countX - opX - 10, 30), ActionName(trigger.Op))) triggerPicker = triggerPicker == index ? -1 : index;
        string amount = EditField(new Rect(countX, row.y, 66, 30), "trigger-count-" + index, trigger.Count.ToString(), 7, true);
        if (int.TryParse(amount, out int value) && value > 0 && trigger.Count != Math.Clamp(value, 1, ActionLimit(trigger.Op)))
        { trigger.Count = Math.Clamp(value, 1, ActionLimit(trigger.Op)); settingsDirty = true; }
        if (IconButton(new Rect(row.xMax - 36, row.y, 36, 30), "Play", "Secili eylemi test et", true)) ExecuteAction(trigger, 1, testUser);
        if (like)
        {
            Label(new Rect(row.x, row.y + 34, 30, 26), "Her", captionStyle);
            string text = EditField(new Rect(row.x + 30, row.y + 34, 72, 26), "like-threshold", settings.LikeThreshold.ToString(), 7, true);
            if (int.TryParse(text, out int threshold) && threshold > 0 && threshold != settings.LikeThreshold)
            { settings.LikeThreshold = Math.Clamp(threshold, 1, 1000000); audience.Configure(settings.LikeThreshold); settingsDirty = true; }
            Label(new Rect(row.x + 110, row.y + 34, row.width - 110, 26), "begeni / kisi", captionStyle);
        }
        else Label(new Rect(row.x, row.y + 34, row.width, 26), "Her izleyicinin ilk takibinde", captionStyle);
        Label(new Rect(countX, row.y + 34, 114, 26), CreatureAction(trigger.Op) ? "adet / eylem" : trigger.Op is "up" or "down" ? "kademe / eylem" : "sn / eylem", captionStyle);
    }

    private void DrawTriggerPicker(Rect area)
    {
        if (triggerPicker < 0) return;
        var trigger = triggerPicker == 0 ? settings.LikeAction : settings.FollowAction;
        Paint(area, MenuRail);
        Label(new Rect(area.x + 12, area.y + 6, area.width - 60, 28), triggerPicker == 0 ? "Begeni eylemini sec" : "Takip eylemini sec", sectionStyle);
        if (IconButton(new Rect(area.xMax - 38, area.y + 4, 32, 30), "X", "Kapat")) triggerPicker = -1;
        int columns = area.width >= 700 ? 3 : 2;
        float cell = (area.width - 24 - (columns - 1) * 8) / columns;
        float rowHeight = Math.Min(40, (area.height - 42) / Mathf.Ceil(ActionOps.Length / (float)columns));
        for (int i = 0; i < ActionOps.Length; i++)
            if (Button(new Rect(area.x + 12 + i % columns * (cell + 8), area.y + 42 + i / columns * rowHeight, cell, rowHeight - 6), ActionName(ActionOps[i])))
            { trigger.Op = ActionOps[i]; trigger.Count = Math.Clamp(trigger.Count, 1, ActionLimit(trigger.Op)); triggerPicker = -1; settingsDirty = true; }
    }
    private static readonly string[] IconFiles = { "bat-1124.png", "knife-1069.png", "gun-1103.png", "Uzi-1089.png", "ak47-1135.png", "shotgun-1190.png", "Rocketlauncher-1144.png", "Flamethrower-1067.png" };

    private Texture2D Solid(Color color)
    {
        var image = new Texture2D(1, 1);
        image.SetPixel(0, 0, color); image.Apply();
        return image;
    }

    private GUIStyle LabelStyle(int size, Color color, bool bold = false)
    {
        var style = new GUIStyle { fontSize = size, fontStyle = bold ? FontStyle.Bold : FontStyle.Normal, alignment = TextAnchor.MiddleLeft, wordWrap = true, clipping = TextClipping.Clip };
        style.normal.textColor = color;
        return style;
    }

    private GUIStyle ButtonStyle(Color background, Color foreground, bool left = false)
    {
        var style = LabelStyle(14, foreground, true);
        style.alignment = left ? TextAnchor.MiddleLeft : TextAnchor.MiddleCenter;
        style.padding = new RectOffset(12, 12, 0, 0);
        style.normal.background = Solid(background);
        style.hover.background = Solid(new Color(Math.Min(1, background.r + .07f), Math.Min(1, background.g + .07f), Math.Min(1, background.b + .07f)));
        style.hover.textColor = foreground;
        style.active.background = Solid(new Color(background.r * .8f, background.g * .8f, background.b * .8f));
        style.active.textColor = foreground;
        return style;
    }

    private void EnsureMenuStyles()
    {
        if (uiPixel != null) return;
        uiPixel = Solid(Color.white);
        titleStyle = LabelStyle(24, Ink, true);
        sectionStyle = LabelStyle(16, Ink, true);
        bodyStyle = LabelStyle(14, Ink);
        captionStyle = LabelStyle(12, Muted);
        valueStyle = LabelStyle(28, Ink, true);
        buttonStyle = ButtonStyle(new Color(.22f, .26f, .28f), Ink);
        primaryStyle = ButtonStyle(Accent, new Color(.02f, .09f, .105f));
        fieldStyle = ButtonStyle(new Color(.17f, .19f, .21f), Ink, true);
        fieldStyle.fontStyle = FontStyle.Normal;
        navStyle = ButtonStyle(MenuRail, Ink, true);
        selectedNavStyle = ButtonStyle(new Color(.08f, .25f, .29f), Color.white, true);
        optionTabStyle = ButtonStyle(MenuRail, Ink);
        selectedOptionTabStyle = ButtonStyle(new Color(.08f, .25f, .29f), Color.white);
        foreach (var style in new[] { optionTabStyle, selectedOptionTabStyle })
        { style.wordWrap = false; style.padding = new RectOffset(6, 6, 0, 0); }
        tileStyle = ButtonStyle(new Color(.14f, .17f, .19f), Ink);
    }

    private void Paint(Rect rect, Color color)
    {
        var previous = GUI.color;
        GUI.color = color; GUI.DrawTexture(rect, uiPixel); GUI.color = previous;
    }

    private void Label(Rect rect, string value, GUIStyle style, Color? color = null)
    {
        var previous = style.normal.textColor;
        if (color.HasValue) style.normal.textColor = color.Value;
        GUI.Label(rect, value, style);
        style.normal.textColor = previous;
    }

    private bool Button(Rect rect, string value, bool primary = false) => GUI.Button(rect, value, primary ? primaryStyle : buttonStyle);
    private bool IconButton(Rect rect, string icon, string tooltip, bool primary = false, Color? tint = null)
    {
        bool clicked = GUI.Button(rect, new GUIContent("", tooltip), primary ? primaryStyle : buttonStyle);
        var image = LoadIcon("ui-" + icon + ".png");
        if (image != null) DrawHudIcon(new Rect(rect.center.x - 9, rect.center.y - 9, 18, 18), image, tint ?? (primary ? new Color(.02f, .09f, .105f) : Ink));
        return clicked;
    }
    private bool CommandButton(Rect rect, string icon, string label, bool primary = false)
    {
        bool clicked = Button(rect, "", primary);
        var image = LoadIcon("ui-" + icon + ".png");
        if (image != null) DrawHudIcon(new Rect(rect.x + 14, rect.center.y - 9, 18, 18), image, primary ? new Color(.02f, .09f, .105f) : Ink);
        Label(new Rect(rect.x + 42, rect.y, rect.width - 48, rect.height), label, bodyStyle, primary ? new Color(.02f, .09f, .105f) : Ink);
        return clicked;
    }
    private void Rule(float x, float y, float width) => Paint(new Rect(x, y, width, 1), Line);

    private Texture2D WeaponIcon(int level)
    {
        return LoadIcon(IconFiles[level]);
    }

    private Texture2D LoadIcon(string name)
    {
        if (weaponIcons.TryGetValue(name, out var texture)) return texture;
        string file = Path.Combine(Root, "assets", name);
        if (!File.Exists(file)) return null;
        var image = StbImageSharp.ImageResult.FromMemory(File.ReadAllBytes(file), StbImageSharp.ColorComponents.RedGreenBlueAlpha);
        texture = UploadImage(image.Width, image.Height, image.Data);
        texture.Apply(); weaponIcons[name] = texture;
        return texture;
    }

    private Texture2D UploadImage(int width, int height, byte[] rgba)
    {
        var pixels = new byte[rgba.Length];
        int row = width * 4;
        for (int y = 0; y < height; y++) Buffer.BlockCopy(rgba, (height - 1 - y) * row, pixels, y * row, row);
        var texture = new Texture2D(width, height, TextureFormat.RGBA32, false);
        var pinned = System.Runtime.InteropServices.GCHandle.Alloc(pixels, System.Runtime.InteropServices.GCHandleType.Pinned);
        try { texture.LoadRawTextureData(pinned.AddrOfPinnedObject(), pixels.Length); }
        finally { pinned.Free(); }
        return texture;
    }

    private void SaveMenuSettings()
    {
        settings.BroadcasterUsername = settings.BroadcasterUsername.Trim().TrimStart('@');
        SaveSettings(); AudioListener.volume = settings.Volume;
        Il2Cpp.Player.Instance.mouseSensitivity = settings.Sensitivity;
    }

    private void SelectTab(int index)
    {
        ReleaseCatalogScroll();
        focusedField = ""; tab = index;
        catalogTarget = null; bindingIndex = -1; catalogDragging = false;
        if (index == 2) OpenGiftCatalog(-1);
    }

    private void DrawMenu()
    {
        EnsureMenuStyles();
        menuRendered = false; menuGiftImages = 0;
        float width = Math.Min(1100, Screen.width - 40), height = Math.Min(640, Screen.height - 32);
        float x = (Screen.width - width) / 2, y = (Screen.height - height) / 2;
        Paint(new Rect(0, 0, Screen.width, Screen.height), new Color(.015f, .02f, .025f, .8f));
        Paint(new Rect(x - 1, y - 1, width + 2, height + 2), Line);
        Paint(new Rect(x, y, width, height), MenuCanvas);
        Paint(new Rect(x, y, width, 76), HudCream);
        var logo = LoadIcon("TikMnG-logo-v3.png");
        if (logo != null) GUI.DrawTexture(new Rect(x + 16, y + 9, 58, 58), logo, ScaleMode.ScaleToFit);
        Label(new Rect(x + 90, y + 9, 340, 20), "TikMnG  /  CAN 'EM ALL", captionStyle, HudNavy);
        Label(new Rect(x + 90, y + 31, 340, 34), "Yayin Kontrol Merkezi", titleStyle, HudNavy);
        Label(new Rect(x + width - 240, y + 17, 168, 20), "YEREL MOD  /  v" + Version, captionStyle, HudNavy);
        Label(new Rect(x + width - 240, y + 39, 168, 20), liveStatus.status == "connected" ? "CANLI YAYINA BAGLI" : "YAYIN BEKLENIYOR", captionStyle, liveStatus.status == "connected" ? new Color(.02f, .4f, .27f) : new Color(.50f, .24f, .04f));
        if (IconButton(new Rect(x + width - 52, y + 22, 32, 32), "X", "Kaydet ve oyuna don")) { SaveMenuSettings(); SetMenu(false); }
        Paint(new Rect(x, y + 73, width * .66f, 3), new Color(.05f, .65f, .87f));
        Paint(new Rect(x + width * .66f, y + 73, width * .34f, 3), BrandRed);
        Rule(x, y + 76, width);

        const float sidebar = 180;
        Paint(new Rect(x, y + 77, sidebar, height - 77), MenuRail);
        string[] tabs = { "Yayin ve test", "Eylemler", "Hediye katalogu", "Oyun ayarlari", "Yayin dosyalari" };
        Label(new Rect(x + 20, y + 98, 140, 20), "CALISMA ALANI", captionStyle);
        for (int i = 0; i < tabs.Length; i++)
        {
            var rect = new Rect(x + 12, y + 132 + i * 48, sidebar - 24, 40);
            if (GUI.Button(rect, "", tab == i ? selectedNavStyle : navStyle)) SelectTab(i);
            Label(new Rect(rect.x + 40, rect.y, rect.width - 46, rect.height), tabs[i], bodyStyle);
            string icon = i == 0 ? "Radio" : i == 1 ? "ListChecks" : i == 2 ? "Gift" : i == 3 ? "Settings2" : "Save";
            DrawHudIcon(new Rect(rect.x + 12, rect.y + 11, 18, 18), LoadIcon("ui-" + icon + ".png"), tab == i ? Accent : Ink);
            if (tab == i) Paint(new Rect(rect.x, rect.y + 8, 3, 24), Accent);
        }
        Rule(x + 20, y + height - 146, sidebar - 40);
        Label(new Rect(x + 20, y + height - 130, sidebar - 40, 20), "TUR " + rules.Round.ToString("00"), captionStyle, Accent);
        Label(new Rect(x + 20, y + height - 105, sidebar - 40, 26), rules.Alive + " yaratik", sectionStyle);
        Label(new Rect(x + 20, y + height - 72, sidebar - 40, 20), rules.Kills + " oldurme / " + rules.Wins + " win", captionStyle);
        Label(new Rect(x + 20, y + height - 38, sidebar - 40, 20), "SAHNE  " + settings.PhysicalCreatures + " / " + MaxPhysicalCreatures, captionStyle);

        var content = new Rect(x + sidebar + 24, y + 96, width - sidebar - 48, height - 168);
        if (tab == 0) DrawConnectionPage(content);
        else if (tab == 1) DrawActionsPage(content);
        else if (tab == 2) DrawCatalogPage(content);
        else if (tab == 3) DrawOptionsPage(content);
        else DrawPublishingPage(content);

        float footer = y + height - 56;
        Rule(x + sidebar, footer - 12, width - sidebar);
        Label(new Rect(content.x, footer + 5, Math.Max(110, content.width - 300), 26), settingsDirty ? "Kaydedilmemis degisiklikler" : savedAt.Length > 0 ? "Kaydedildi / " + savedAt : "Ayarlar bu prototipe ozel", captionStyle, settingsDirty ? Amber : Muted);
        if (CommandButton(new Rect(x + width - 284, footer, 124, 36), "ArrowLeft", "Oyuna don")) { SaveMenuSettings(); SetMenu(false); }
        if (CommandButton(new Rect(x + width - 148, footer, 124, 36), "Save", "Kaydet", true)) SaveMenuSettings();
        if (!string.IsNullOrEmpty(GUI.tooltip))
        {
            var pointer = Event.current.mousePosition;
            var tip = new Rect(Math.Clamp(pointer.x + 12, content.x, x + width - 232), Math.Clamp(pointer.y + 18, y + 84, footer - 36), 220, 28);
            Paint(new Rect(tip.x - 1, tip.y - 1, tip.width + 2, tip.height + 2), Line);
            Paint(tip, MenuRail);
            Label(new Rect(tip.x + 10, tip.y, tip.width - 20, tip.height), GUI.tooltip, captionStyle, Ink);
        }
        menuRendered = true;
    }

    private void PageTitle(Rect area, string title, string badge)
    {
        Label(new Rect(area.x, area.y, area.width - 180, 30), title, titleStyle);
        Label(new Rect(area.xMax - 168, area.y + 3, 168, 24), badge, captionStyle, Amber);
    }

    private void DrawConnectionPage(Rect area)
    {
        float x = area.x, y = area.y, w = area.width;
        string badge = liveStatus.status == "connected" ? "CANLI YAYINA BAGLI" : liveConnectPending || liveStatus.status == "connecting" ? "BAGLANIYOR" : liveStatus.status == "waiting" ? "YAYIN BEKLENIYOR" : "BAGLI DEGIL";
        PageTitle(area, "Yayin ve test", badge);
        Label(new Rect(x, y + 43, w, 23), "TikTok kullanici adi", bodyStyle);
        string username = EditField(new Rect(x, y + 70, w - 164, 38), "broadcaster", settings.BroadcasterUsername, 40);
        if (username != settings.BroadcasterUsername) { settings.BroadcasterUsername = username; settingsDirty = true; }
        if (username.Length == 0 && focusedField != "broadcaster") Label(new Rect(x + 12, y + 74, w - 188, 30), "@kullaniciadi", captionStyle);
        bool active = liveConnectPending || liveStatus.status is "connected" or "connecting" or "waiting" || liveStatus.status == "error" && liveStatus.username.Length > 0;
        if (Button(new Rect(x + w - 152, y + 70, 152, 38), active ? "Baglantiyi kes" : "Yayina baglan", !active))
        {
            focusedField = "";
            if (active) DisconnectLive(); else ConnectLive(settings.BroadcasterUsername);
        }
        string status = liveError.Length > 0 ? liveError : liveStatus.status == "connected" ? "@" + liveStatus.username + " / " + liveStatus.giftEvents + " hediye / " + liveStatus.likeEvents + " begeni paketi / " + liveStatus.followEvents + " takip" : liveStatus.message;
        Label(new Rect(x, y + 112, w, 20), status, captionStyle, liveStatus.status == "connected" ? Accent : Amber);
        if (lastLiveGift.Length > 0) Label(new Rect(x, y + 133, w, 17), "Son hediye: " + lastLiveGift, captionStyle);
        Rule(x, y + 150, w);
        bool compact = area.height < 430;
        float fieldY = y + (compact ? 211 : 229), labelY = y + (compact ? 188 : 202);
        Label(new Rect(x, y + (compact ? 158 : 166), w, 26), "Yerel eylem testi", sectionStyle);
        float left = (w - 24) * .52f, rightX = x + left + 24, rightW = w - left - 24;
        Label(new Rect(x, labelY, left, 20), "Test izleyicisi", captionStyle);
        testUser = EditField(new Rect(x, fieldY, left, 36), "test-user", testUser, 32);
        int[] counts = { 1, 10, 50 };
        float bw = (left - 16) / 3;
        for (int i = 0; i < counts.Length; i++)
            if (Button(new Rect(x + i * (bw + 8), y + (compact ? 254 : 278), bw, 38), "+" + counts[i] + " yaratik")) Add(counts[i], testUser);
        var gift = gifts.Find(g => g.id == selectedGift);
        Label(new Rect(rightX, labelY, rightW, 20), "Hediye simulasyonu", captionStyle);
        if (GUI.Button(new Rect(rightX, fieldY, rightW, compact ? 48 : 60), "", tileStyle)) OpenGiftCatalog(-1);
        if (gift != null)
        {
            GUI.DrawTexture(new Rect(rightX + 8, fieldY + 6, 40, 40), GiftImage(gift), ScaleMode.ScaleToFit);
            Label(new Rect(rightX + 66, fieldY + 2, rightW - 78, 26), gift.Title, bodyStyle);
            Label(new Rect(rightX + 66, fieldY + 26, rightW - 78, 20), gift.coins + " coin / ID " + gift.id, captionStyle);
        }
        else Label(new Rect(rightX + 16, fieldY + 10, rightW - 32, 30), "Hediye sec", bodyStyle);
        if (Button(new Rect(rightX, y + (compact ? 268 : 300), rightW, compact ? 30 : 36), "Hediye eylemini dene")) TestGift(selectedGift);
        float stripY = y + Math.Min(355, area.height - 100);
        Rule(x, stripY, w);
        Label(new Rect(x, stripY + 12, w - 264, 25), Rules.WeaponNames[rules.Level] + " / " + rules.Progress + " / " + rules.RequiredCollections, sectionStyle);
        if (Button(new Rect(x + w - 254, stripY + 9, 122, 32), "Silah dusur")) Shift(-1);
        if (Button(new Rect(x + w - 122, stripY + 9, 122, 32), "Silah yukselt")) Shift(1);
        float stepW = w / 8;
        for (int i = 0; i < 8; i++)
        {
            float sx = x + i * stepW;
            var icon = WeaponIcon(i);
            if (icon != null) GUI.DrawTexture(new Rect(sx + 6, stripY + 47, stepW - 12, 40), icon, ScaleMode.ScaleToFit);
            Paint(new Rect(sx + 5, stripY + 94, stepW - 10, 2), i == rules.Level ? Accent : Line);
        }
    }

    private void DrawActionsPage(Rect area)
    {
        float x = area.x, y = area.y, w = area.width;
        PageTitle(area, "Eylemler", settings.Actions.Count + " HEDIYE EYLEMI");
        DrawAudienceTrigger(new Rect(x, y + 42, w, 64), settings.LikeAction, true);
        DrawAudienceTrigger(new Rect(x, y + 114, w, 64), settings.FollowAction, false);
        Rule(x, y + 183, w);
        if (CommandButton(new Rect(area.xMax - 158, y + 192, 158, 30), addingAction ? "X" : "Plus", addingAction ? "Vazgec" : "Eylem ekle", !addingAction)) addingAction = !addingAction;
        if (triggerPicker >= 0) { DrawTriggerPicker(new Rect(x, y + 188, w, area.height - 188)); return; }
        if (addingAction)
        {
            for (int i = 0; i < ActionOps.Length; i++)
            {
                int columns = w >= 700 ? 3 : 2;
                float cell = (w - (columns - 1) * 12) / columns;
                if (CommandButton(new Rect(x + i % columns * (cell + 12), y + 230 + i / columns * 35, cell, 30), ActionIcon(ActionOps[i]), ActionName(ActionOps[i])) && settings.Actions.Count < 100)
                {
                    settings.Actions.Add(NewAction(ActionOps[i])); addingAction = false; settingsDirty = true;
                    actionPage = (settings.Actions.Count - 1) / Math.Max(1, (int)((area.height - 280) / 80));
                }
            }
            return;
        }
        int pageSize = Math.Max(1, (int)((area.height - 280) / 80));
        int pages = Math.Max(1, (settings.Actions.Count + pageSize - 1) / pageSize);
        actionPage = Math.Clamp(actionPage, 0, pages - 1);
        float actionW = w >= 700 ? 176 : 122, countX = area.xMax - 198;
        Label(new Rect(x, y + 198, actionW, 20), "HEDIYE EYLEMLERI", captionStyle);
        for (int i = actionPage * pageSize; i < Math.Min(settings.Actions.Count, (actionPage + 1) * pageSize); i++)
        {
            var action = settings.Actions[i];
            float row = y + 242 + (i % pageSize) * 80;
            Rule(x, row - 9, w);
            DrawHudIcon(new Rect(x + 1, row + 8, 20, 20), LoadIcon("ui-" + ActionIcon(action.Op) + ".png"), action.Op is "prison" or "flash" ? Amber : Accent);
            Label(new Rect(x + 31, row, actionW - 38, 48), action.Name, sectionStyle);
            var gift = gifts.Find(g => g.id == action.GiftId);
            float gx = x + actionW, gw = countX - gx - 12;
            if (GUI.Button(new Rect(gx, row - 1, gw, 49), "", tileStyle)) OpenGiftCatalog(i);
            if (gift != null)
            {
                GUI.DrawTexture(new Rect(gx + 6, row + 2, 40, 40), GiftImage(gift), ScaleMode.ScaleToFit);
                Label(new Rect(gx + 54, row, gw - 62, 24), gift.Title, bodyStyle);
                Label(new Rect(gx + 54, row + 24, gw - 62, 20), gift.coins + " coin / " + gift.id, captionStyle);
            }
            else
            {
                DrawHudIcon(new Rect(gx + 12, row + 13, 20, 20), LoadIcon("ui-Gift.png"), Accent);
                Label(new Rect(gx + 42, row + 8, gw - 50, 30), "Hediye sec", bodyStyle);
            }
            string value = EditField(new Rect(countX, row + 2, 76, 34), "count-" + i, action.Count.ToString(), 7, true);
            if (int.TryParse(value, out int count) && count > 0 && action.Count != Math.Clamp(count, 1, ActionLimit(action.Op))) { action.Count = Math.Clamp(count, 1, ActionLimit(action.Op)); settingsDirty = true; }
            Label(new Rect(countX, row + 38, 106, 22), CreatureAction(action.Op) ? "adet / hediye" : action.Op is "up" or "down" ? "kademe / hediye" : "sn / hediye", captionStyle);
            if (IconButton(new Rect(area.xMax - 92, row + 2, 36, 36), "Play", "Eylemi test et", true)) ExecuteAction(action, 1, testUser);
            if (IconButton(new Rect(area.xMax - 36, row + 2, 36, 36), "Trash2", "Eylemi sil", tint: new Color(1, .4f, .46f)))
            {
                settings.Actions.RemoveAt(i); bindingIndex = -1; focusedField = ""; editBuffers.Clear(); settingsDirty = true;
                break;
            }
        }
        if (settings.Actions.Count == 0) Label(new Rect(x, y + 110, w, 32), "Henuz eylem yok", bodyStyle);
        float footer = area.yMax - 32;
        if (IconButton(new Rect(x, footer, 36, 30), "ChevronLeft", "Onceki eylemler")) actionPage = Math.Max(0, actionPage - 1);
        Label(new Rect(x + 48, footer, w - 96, 30), (actionPage + 1) + " / " + pages + "     " + Math.Ceiling(effects.PrisonSeconds) + " sn hapis / " + Math.Ceiling(effects.FlashSeconds) + " sn flash", captionStyle);
        if (IconButton(new Rect(area.xMax - 36, footer, 36, 30), "ChevronRight", "Sonraki eylemler")) actionPage = Math.Min(pages - 1, actionPage + 1);
    }

    private static string SearchKey(string value)
    {
        string normalized = value.ToLowerInvariant().Replace('\u0131', 'i').Normalize(System.Text.NormalizationForm.FormD);
        return new string(normalized.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray());
    }

    private float OptionRow(Rect rect, string title, string value, float current, float min, float max, float step, float progress)
    {
        Label(new Rect(rect.x, rect.y, rect.width - 204, 32), title, bodyStyle);
        if (Button(new Rect(rect.xMax - 192, rect.y, 36, 32), "-")) { current = Math.Max(min, current - step); settingsDirty = true; }
        Label(new Rect(rect.xMax - 140, rect.y, 84, 32), value, bodyStyle);
        if (Button(new Rect(rect.xMax - 36, rect.y, 36, 32), "+")) { current = Math.Min(max, current + step); settingsDirty = true; }
        Paint(new Rect(rect.x, rect.y + 35, rect.width, 3), Line);
        Paint(new Rect(rect.x, rect.y + 35, rect.width * Math.Clamp(progress, 0, 1), 3), Accent);
        return current;
    }

    private void DrawOptionsPage(Rect area)
    {
        float x = area.x, y = area.y, w = area.width;
        PageTitle(area, "Oyun ayarlari", "YALNIZCA BU MOD");
        string[] options = { "Genel", "Gorunum", w < 680 ? "Tur" : "Tur ve kalabalik", "Silahlar", "Yayin", "Savas" };
        float optionWidth = (w - 8 * (options.Length - 1)) / options.Length;
        for (int i = 0; i < options.Length; i++)
            if (GUI.Button(new Rect(x + i * (optionWidth + 8), y + 42, optionWidth, 30), options[i], optionPage == i ? selectedOptionTabStyle : optionTabStyle)) optionPage = i;
        if (optionPage == 1) { DrawCombatSettings(area); return; }
        if (optionPage == 2) { DrawRoundSettings(area); return; }
        if (optionPage == 3) { DrawWeaponSettings(area); return; }
        if (optionPage == 4) { DrawHighlightSettings(area); return; }
        if (optionPage == 5) { DrawSurvivalSettings(area); return; }
        y += 36;
        float step = Math.Min(74, (area.height - 316) / 2);
        settings.Volume = OptionRow(new Rect(x, y + 58, w, 55), "Oyun sesi", (int)Math.Round(settings.Volume * 100) + "%", settings.Volume, 0, 1, .05f, settings.Volume);
        settings.Sensitivity = OptionRow(new Rect(x, y + 58 + step, w, 55), "Fare hassasiyeti", settings.Sensitivity.ToString("0.0", CultureInfo.InvariantCulture), settings.Sensitivity, .1f, 3, .1f, settings.Sensitivity / 3);
        Label(new Rect(x, y + 58 + step * 2, w, 32), "Yaratik siniri: " + settings.MaxCreatures.ToString("N0") + " / " + settings.PhysicalCreatures + " sahada", bodyStyle);
        float summaryY = y + 125 + step * 2;
        Rule(x, summaryY, w);
        Label(new Rect(x, summaryY + 14, w / 2, 22), "SILAH ILERLEMESI", captionStyle);
        Label(new Rect(x + w / 2, summaryY + 14, w / 2, 22), "KAZANMA GERI SAYIMI", captionStyle);
        Label(new Rect(x, summaryY + 42, w / 2, 36), rules.RequiredCollections + " toplama", valueStyle);
        Label(new Rect(x + w / 2, summaryY + 42, w / 2, 36), "10 saniye", valueStyle);
        Rule(x, summaryY + 99, w);
        Label(new Rect(x, summaryY + 112, w - 180, 36), "Tur " + rules.Round + " / " + rules.Alive + " canli / " + rules.Kills + " oldurme", bodyStyle);
        if (Button(new Rect(x + w - 152, summaryY + 112, 152, 36), "Turu sifirla")) Reset();
    }

    private void DrawSurvivalSettings(Rect area)
    {
        float x = area.x, y = area.y + 94, w = area.width;
        Label(new Rect(x, y, w - 180, 32), "Yaratik saldirilari", sectionStyle);
        bool enabled = GUI.Toggle(new Rect(area.xMax - 160, y, 160, 32), settings.EnemyAttacks,
            settings.EnemyAttacks ? "[x] Acik" : "[ ] Kapali", fieldStyle);
        if (enabled != settings.EnemyAttacks) { settings.EnemyAttacks = enabled; settingsDirty = true; ResetCombatPaths(); }
        NumericOption(new Rect(x, y + 42, w, 34), "Baslangic cani", "player-health", settings.PlayerHealth, 1, 1000,
            value => { settings.PlayerHealth = value; survival.Configure(value); });
        settings.CreatureDamage = (int)OptionRow(new Rect(x, y + 86, w, 50), "Normal yaratik / hasar", "%" + settings.CreatureDamage,
            settings.CreatureDamage, 1, 100, 1, settings.CreatureDamage / 100f);
        settings.CreatureAttackInterval = OptionRow(new Rect(x, y + 142, w, 50), "Vurus araligi", settings.CreatureAttackInterval.ToString("0.0", CultureInfo.InvariantCulture) + " sn",
            settings.CreatureAttackInterval, .5f, 5, .1f, settings.CreatureAttackInterval / 5);
        float scale = OptionRow(new Rect(x, y + 198, w, 50), "Yaratik boyutu", Math.Round(settings.CreatureScale * 100) + "%",
            settings.CreatureScale, 1, 1.5f, .05f, (settings.CreatureScale - 1) * 2);
        if (Math.Abs(scale - settings.CreatureScale) > .001f) SetCreatureScale(scale);
        if (area.height > 450)
        {
            Rule(x, y + 252, w);
            Label(new Rect(x, y + 260, w / 2, 24), survival.Health + " / " + survival.MaximumHealth + " CAN", bodyStyle);
            FitStoryLabel(new Rect(x + w / 2, y + 260, w / 2, 24), "Boss %30 / Big Boss %80", captionStyle, Amber);
        }
    }

    private int ProgressionInput(Rect area, string key, string title, int current, int minimum)
    {
        Label(new Rect(area.x, area.y, area.width - 224, 34), title, bodyStyle);
        if (Button(new Rect(area.xMax - 204, area.y, 34, 34), "-")) { current = Math.Max(minimum, current - 1); focusedField = ""; settingsDirty = true; }
        string text = EditField(new Rect(area.xMax - 160, area.y, 110, 34), key, current.ToString(), 4, true);
        if (int.TryParse(text, out int value) && current != Math.Clamp(value, minimum, 1000)) { current = Math.Clamp(value, minimum, 1000); settingsDirty = true; }
        if (Button(new Rect(area.xMax - 34, area.y, 34, 34), "+")) { current = Math.Min(1000, current + 1); focusedField = ""; settingsDirty = true; }
        return current;
    }

    private void DrawWeaponSettings(Rect area)
    {
        EnsureProgressHudStyles();
        float x = area.x, y = area.y + 90, w = area.width;
        Label(new Rect(x, y, w, 26), "Silah ilerlemesi", sectionStyle);
        settings.FirstWeaponKills = ProgressionInput(new Rect(x, y + 40, w, 34), "weapon-first", "Ilk silah / toplanan", settings.FirstWeaponKills, 1);
        settings.WeaponKillStep = ProgressionInput(new Rect(x, y + 90, w, 34), "weapon-step", "Kademe basina artis", settings.WeaponKillStep, 0);
        rules.ConfigureProgression(settings.FirstWeaponKills, settings.WeaponKillStep);
        Label(new Rect(x, y + 136, w, 20), "KADEME HEDEFLERI", captionStyle);
        float cell = w / Rules.WeaponNames.Length;
        for (int i = 0; i < Rules.WeaponNames.Length; i++)
        {
            DrawHudIcon(new Rect(x + cell * i + (cell - 28) / 2, y + 163, 28, 26), WeaponIcon(i), HudCream);
            Label(new Rect(x + cell * i, y + 194, cell, 24), i == 7 ? "MAX" : (settings.FirstWeaponKills + i * settings.WeaponKillStep).ToString(),
                hudCenterCaptionStyle ?? captionStyle, i == rules.Level ? HudMint : Ink);
        }
        Rule(x, y + 232, w);
        Label(new Rect(x, y + 247, w - 172, 30), "Otomatik oyun", sectionStyle);
        bool playing = GUI.Toggle(new Rect(area.xMax - 160, y + 246, 160, 32), autoPlaying,
            autoPlaying ? "[x] Acik" : "[ ] Kapali", fieldStyle);
        if (playing != autoPlaying) SetAutoPlay(playing);
        Label(new Rect(x, y + 286, w, 24), autoStatus, captionStyle, autoPlaying ? HudMint : Muted);
    }
}
