using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private const float CatalogRowHeight = 58;
    private ActionBinding catalogTarget;
    private Gift[] catalogFiltered = Array.Empty<Gift>();
    private string catalogFilterKey;
    private float catalogScroll, catalogScrollMax, catalogDragOffset;
    private bool catalogDragging;
    private Rect catalogViewport, catalogScrollbar, catalogThumb;
    private int catalogScrollId;
    private readonly List<string> catalogVisibleIds = new();
    private readonly Queue<Event> catalogTestEvents = new();
    private GUIStyle catalogRowStyle, catalogSelectedStyle, catalogCoinStyle, catalogIdStyle, catalogNameStyle;

    private void OpenGiftCatalog(int actionIndex)
    {
        if (actionIndex >= settings.Actions.Count) return;
        ReleaseCatalogScroll();
        catalogTarget = actionIndex >= 0 ? settings.Actions[actionIndex] : null;
        bindingIndex = actionIndex;
        tab = 2; focusedField = ""; search = ""; catalogScroll = 0; catalogFilterKey = null;
        menuRendered = false; catalogVisibleIds.Clear();
        catalogDragging = false; editBuffers.Remove("gift-search");
    }

    private void CloseGiftCatalog()
    {
        tab = catalogTarget != null ? 1 : 0;
        catalogTarget = null; bindingIndex = -1; focusedField = "";
        ReleaseCatalogScroll();
    }

    private void ReleaseCatalogScroll()
    {
        catalogDragging = false;
        if (catalogScrollId != 0 && GUIUtility.hotControl == catalogScrollId) GUIUtility.hotControl = 0;
    }

    private void SelectCatalogGift(Gift gift)
    {
        if (catalogTarget != null)
        {
            // Keep the actual action reference: removing an earlier row must not retarget a gift.
            if (!settings.Actions.Contains(catalogTarget)) { CloseGiftCatalog(); return; }
            catalogTarget.GiftId = gift.id;
            SaveSettings();
        }
        else selectedGift = gift.id;
        CloseGiftCatalog();
    }

    private void FilterGiftCatalog()
    {
        if (catalogFilterKey == search) return;
        catalogFilterKey = search;
        string raw = search.Trim(), term = SearchKey(raw);
        catalogFiltered = raw.Length == 0 ? gifts.ToArray() : gifts.Where(g => giftSearchKeys[g.id].Contains(term) || g.id.Contains(raw) || g.coins.ToString() == raw).ToArray();
        catalogScroll = 0;
    }

    private void EnsureCatalogStyles()
    {
        if (catalogRowStyle != null) return;
        catalogRowStyle = ButtonStyle(new Color(.105f, .125f, .14f), Ink);
        catalogSelectedStyle = ButtonStyle(new Color(.055f, .235f, .26f), Ink);
        catalogNameStyle = LabelStyle(14, Ink, true);
        catalogCoinStyle = LabelStyle(15, Amber, true); catalogCoinStyle.alignment = TextAnchor.MiddleRight;
        catalogIdStyle = LabelStyle(12, Muted); catalogIdStyle.alignment = TextAnchor.MiddleRight;
    }

    private void HandleCatalogInput(Event input)
    {
        if (input.type == EventType.ScrollWheel && (catalogViewport.Contains(input.mousePosition) || catalogScrollbar.Contains(input.mousePosition)))
        {
            catalogScroll = Mathf.Clamp(catalogScroll + input.delta.y * 27, 0, catalogScrollMax);
            input.Use();
        }
        else if (input.type == EventType.MouseDown && input.button == 0 && catalogScrollbar.Contains(input.mousePosition) && catalogScrollMax > 0)
        {
            catalogDragging = true;
            GUIUtility.hotControl = catalogScrollId;
            catalogDragOffset = catalogThumb.Contains(input.mousePosition) ? input.mousePosition.y - catalogThumb.y : catalogThumb.height / 2;
            DragCatalogScroll(input.mousePosition.y); input.Use();
        }
        else if (input.type == EventType.MouseDrag && catalogDragging)
        {
            DragCatalogScroll(input.mousePosition.y); input.Use();
        }
        else if (input.type == EventType.MouseUp && catalogDragging)
        {
            ReleaseCatalogScroll();
            input.Use();
        }
    }

    private void DragCatalogScroll(float mouseY)
    {
        float travel = catalogScrollbar.height - catalogThumb.height;
        if (travel > 0) catalogScroll = Mathf.Clamp01((mouseY - catalogScrollbar.y - catalogDragOffset) / travel) * catalogScrollMax;
    }

    private void DrawCatalogPage(Rect area)
    {
        EnsureCatalogStyles();
        float x = area.x, y = area.y, w = area.width;
        if (catalogTarget != null && !settings.Actions.Contains(catalogTarget)) { CloseGiftCatalog(); return; }
        if (IconButton(new Rect(x, y, 34, 32), "ArrowLeft", "Secmeden geri don")) { CloseGiftCatalog(); return; }
        Label(new Rect(x + 48, y, w - 200, 32), "Hediye sec", titleStyle);
        var right = catalogIdStyle;
        Label(new Rect(area.xMax - 146, y + 3, 146, 26), gifts.Count + " HEDIYE", right, Accent);
        string context = catalogTarget == null ? "Yayin testi icin hediye" : catalogTarget.Name + "  /  " + catalogTarget.Count + (catalogTarget.Op == "spawn" ? " adet / hediye" : catalogTarget.Op is "up" or "down" ? " kademe / hediye" : " sn / hediye");
        Label(new Rect(x, y + 37, w, 24), context, bodyStyle, Muted);

        Paint(new Rect(x, y + 72, w - 42, 36), new Color(.17f, .19f, .21f));
        DrawHudIcon(new Rect(x + 12, y + 81, 18, 18), LoadIcon("ui-Search.png"), Muted);
        string updated = EditField(new Rect(x + 34, y + 72, w - 76, 36), "gift-search", search, 64);
        if (updated != search) search = updated;
        if (search.Length == 0 && focusedField != "gift-search") Label(new Rect(x + 46, y + 75, w - 110, 28), "Hediye adi, ID veya coin ara", captionStyle);
        if (IconButton(new Rect(area.xMax - 34, y + 73, 34, 34), "X", "Aramayi temizle")) { search = ""; focusedField = ""; editBuffers.Remove("gift-search"); }
        FilterGiftCatalog();

        float listW = w - 22, coinX = listW - 244, idX = listW - 136;
        Paint(new Rect(x, y + 121, listW, 26), MenuRail);
        Label(new Rect(x + 64, y + 121, coinX - 72, 26), "HEDIYE", captionStyle);
        Label(new Rect(x + coinX, y + 121, 100, 26), "COIN", right);
        DrawHudIcon(new Rect(x + coinX + 50, y + 127, 14, 14), LoadIcon("ui-ArrowUp.png"), Amber);
        Label(new Rect(x + idX, y + 121, 94, 26), "ID", right);

        catalogViewport = new Rect(x, y + 151, listW, area.height - 177);
        catalogScrollbar = new Rect(area.xMax - 13, catalogViewport.y, 13, catalogViewport.height);
        float contentHeight = catalogFiltered.Length * CatalogRowHeight;
        catalogScrollMax = Math.Max(0, contentHeight - catalogViewport.height);
        catalogScroll = Mathf.Clamp(catalogScroll, 0, catalogScrollMax);
        float thumbHeight = Mathf.Clamp(catalogViewport.height * catalogViewport.height / Math.Max(1, contentHeight), 34, catalogViewport.height);
        float thumbY = catalogScrollbar.y + (catalogScrollbar.height - thumbHeight) * (catalogScrollMax > 0 ? catalogScroll / catalogScrollMax : 0);
        catalogThumb = new Rect(catalogScrollbar.x, thumbY, catalogScrollbar.width, thumbHeight);
        catalogScrollId = GUIUtility.GetControlID(786342, FocusType.Passive);
        if (GUI.enabled) HandleCatalogInput(Event.current);
        if (Event.current.type == EventType.Repaint)
            while (catalogTestEvents.Count > 0) HandleCatalogInput(catalogTestEvents.Dequeue());

        int first = Math.Clamp((int)(catalogScroll / CatalogRowHeight), 0, catalogFiltered.Length);
        int last = Math.Min(catalogFiltered.Length, (int)Math.Ceiling((catalogScroll + catalogViewport.height) / CatalogRowHeight));
        if (Event.current.type == EventType.Repaint) catalogVisibleIds.Clear();
        string selected = catalogTarget?.GiftId ?? selectedGift;
        Gift chosen = null;
        GUI.BeginGroup(catalogViewport);
        try
        {
            for (int i = first; i < last; i++)
            {
                var gift = catalogFiltered[i];
                float rowY = i * CatalogRowHeight - catalogScroll;
                bool active = gift.id == selected;
                var row = new Rect(0, rowY, listW, CatalogRowHeight - 1);
                if (GUI.Button(row, new GUIContent("", gift.Title + " / ID " + gift.id), active ? catalogSelectedStyle : catalogRowStyle)) chosen = gift;
                if (active) Paint(new Rect(0, rowY + 8, 3, CatalogRowHeight - 17), Accent);
                var image = GiftImage(gift);
                if (image != null) { GUI.DrawTexture(new Rect(10, rowY + 8, 40, 40), image, ScaleMode.ScaleToFit); menuGiftImages++; }
                float nameW = coinX - 72;
                catalogNameStyle.fontSize = 14;
                while (catalogNameStyle.fontSize > 10 && catalogNameStyle.CalcHeight(new GUIContent(gift.Title), nameW) > 40) catalogNameStyle.fontSize--;
                Label(new Rect(64, rowY + 7, nameW, 42), gift.Title, catalogNameStyle);
                Label(new Rect(coinX, rowY + 10, 100, 36), gift.coins.ToString("N0", CrowdNumberFormat), catalogCoinStyle);
                Label(new Rect(idX, rowY + 10, 94, 36), gift.id, catalogIdStyle);
                DrawHudIcon(new Rect(listW - 28, rowY + 20, 16, 16), LoadIcon(active ? "ui-CircleCheck.png" : "ui-Plus.png"), active ? Accent : Muted);
                if (Event.current.type == EventType.Repaint) catalogVisibleIds.Add(gift.id);
            }
            if (catalogFiltered.Length == 0) Label(new Rect(18, 26, listW - 36, 50), "Eslesen hediye bulunamadi.", sectionStyle);
        }
        finally { GUI.EndGroup(); }
        Paint(new Rect(catalogScrollbar.x + 5, catalogScrollbar.y, 3, catalogScrollbar.height), Line);
        Paint(new Rect(catalogThumb.x + 3, catalogThumb.y, 7, catalogThumb.height), catalogScrollMax > 0 ? catalogDragging ? Accent : Muted : Line);
        Label(new Rect(x, area.yMax - 22, w - 230, 22), catalogFiltered.Length + " hediye" + (catalogFiltered.Length > 0 ? "  /  " + (first + 1) + " - " + last : ""), captionStyle);
        Label(new Rect(area.xMax - 230, area.yMax - 22, 230, 22), "Dusuk coin'den yuksege", catalogIdStyle);
        if (chosen != null) SelectCatalogGift(chosen);
    }
}
