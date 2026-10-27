package com.tikmng.snowwar.client;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

public final class SnowWarGiftCatalogScreen extends Screen {
    private static final List<Gift> CATALOG = loadCatalog();
    private static final java.util.Map<String,String> VISUALS = loadVisuals();
    private final List<Gift> variants;
    private static final int COLUMNS = 6;
    private EditBox search;
    private int firstRow;

    public SnowWarGiftCatalogScreen() { this(null); }
    private SnowWarGiftCatalogScreen(List<Gift> variants) { super(Component.literal("TikTok hediye kataloğu")); this.variants=variants; }
    private static java.util.Map<String,String> loadVisuals() {
        var out=new java.util.HashMap<String,String>();
        try(var in=SnowWarGiftCatalogScreen.class.getResourceAsStream("/assets/mng_battle_royale/gifts/visual-groups.json")) {
            for(var e:JsonParser.parseReader(new InputStreamReader(in,StandardCharsets.UTF_8)).getAsJsonObject().getAsJsonArray("groups")) {
                var g=e.getAsJsonObject();for(var id:g.getAsJsonArray("ids"))out.put(id.getAsString(),g.get("id").getAsString());
            }
        }catch(Exception ignored){}return out;
    }
    private static String visual(Gift gift) { return VISUALS.getOrDefault(gift.id(),gift.id()); }

    static int giftCount() { return CATALOG.size(); }

    static ResourceLocation giftIcon(String file) {
        return ResourceLocation.fromNamespaceAndPath("mng_battle_royale", "gifts/" + file);
    }

    private static List<Gift> loadCatalog() {
        try (var stream = SnowWarGiftCatalogScreen.class.getResourceAsStream("/assets/mng_battle_royale/gifts/katalog_tam.json")) {
            if (stream == null) return List.of();
            var array = JsonParser.parseReader(new InputStreamReader(stream, StandardCharsets.UTF_8)).getAsJsonArray();
            List<Gift> gifts = new ArrayList<>(array.size());
            array.forEach(element -> {
                JsonObject item = element.getAsJsonObject();
                gifts.add(new Gift(text(item, "id"), text(item, "trName", text(item, "name", "Hediye")),
                    number(item, "coins"), text(item, "file")));
            });
            gifts.sort(Comparator.comparingInt(Gift::coins).thenComparing(g -> g.name().toLowerCase(Locale.ROOT)));
            return List.copyOf(gifts);
        } catch (Exception ignored) { return List.of(); }
    }

    private static String text(JsonObject item, String key) { return text(item, key, ""); }
    private static String text(JsonObject item, String key, String fallback) {
        return item.has(key) && !item.get(key).isJsonNull() ? item.get(key).getAsString() : fallback;
    }
    private static int number(JsonObject item, String key) {
        try { return item.get(key).getAsInt(); } catch (Exception ignored) { return 0; }
    }

    @Override protected void init() {
        int w = Math.min(900, width - 20);
        int x = (width - w) / 2;
        search = new EditBox(font, x + 6, 34, w - 12, 20, Component.literal("Hediye ara"));
        search.setHint(Component.literal("İsim, kimlik veya coin değeri"));
        search.setResponder(value -> firstRow = 0);
        addRenderableWidget(search);
        addRenderableWidget(Button.builder(Component.literal("Geri"), b -> minecraft.setScreen(variants==null?new SnowWarActionsScreen():new SnowWarGiftCatalogScreen()))
            .bounds(x + 6, height - 26, w - 12, 20).build());
    }

    private List<Gift> filtered() {
        String query = search == null ? "" : search.getValue().trim().toLowerCase(Locale.ROOT);
        var matching=(variants==null?CATALOG:variants).stream().filter(gift -> gift.name().toLowerCase(Locale.ROOT).contains(query)
            || Integer.toString(gift.coins()).contains(query) || gift.id().contains(query)).toList();
        if(variants!=null)return matching;
        var unique=new java.util.LinkedHashMap<String,Gift>();for(var gift:matching)unique.putIfAbsent(visual(gift),gift);
        return List.copyOf(unique.values());
    }

    private int visibleRows() { return Math.max(1, (height - 94) / 82); }

    @Override public void render(GuiGraphics graphics, int mouseX, int mouseY, float partialTick) {
        renderBackground(graphics);
        int panelW = Math.min(900, width - 20);
        int left = (width - panelW) / 2;
        int gap = 5;
        int cardW = (panelW - gap * (COLUMNS + 1)) / COLUMNS;
        int cardH = 76;
        int top = 62;
        List<Gift> gifts = filtered();
        int rows = visibleRows();
        int maxFirst = Math.max(0, (gifts.size() + COLUMNS - 1) / COLUMNS - rows);
        firstRow = Math.max(0, Math.min(firstRow, maxFirst));
        graphics.drawCenteredString(font, title, width / 2, 10, 0xFFFFFFFF);
        graphics.drawString(font, gifts.size() + " hediye · 6 sütun · coin değerine göre artan", left + 6, 56, 0xFF9FC1D0);
        for (int row = 0; row < rows; row++) for (int column = 0; column < COLUMNS; column++) {
            int index = (firstRow + row) * COLUMNS + column;
            if (index >= gifts.size()) continue;
            Gift gift = gifts.get(index);
            int x = left + gap + column * (cardW + gap);
            int y = top + row * (cardH + gap);
            boolean hovered = mouseX >= x && mouseX < x + cardW && mouseY >= y && mouseY < y + cardH;
            graphics.fill(x, y, x + cardW, y + cardH, hovered ? 0xFF315B70 : 0xFF172A39);
            graphics.fill(x, y, x + cardW, y + 2, hovered ? 0xFF70E5FF : 0xFF36586A);
            ResourceLocation icon = giftIcon(gift.file());
            int iconSize = Math.min(38, cardW - 8);
            if(variants==null)graphics.blit(icon, x + (cardW - iconSize) / 2, y + 5, 0, 0, iconSize, iconSize, iconSize, iconSize);
            else graphics.drawCenteredString(font,"#"+gift.id(),x+cardW/2,y+18,0xFF70E5FF);
            graphics.drawCenteredString(font, font.plainSubstrByWidth(gift.name(), cardW - 8), x + cardW / 2, y + 46, 0xFFFFFFFF);
            graphics.drawCenteredString(font, gift.coins() + " coin", x + cardW / 2, y + 60, 0xFFFFCF55);
        }
        if(variants!=null)graphics.blit(giftIcon(variants.get(0).file()),left+panelW-32,height-58,0,0,24,24,24,24);
        graphics.drawCenteredString(font, "Fare tekerleği ile kaydır · Satır " + (firstRow + 1) + " / "
            + Math.max(1, (gifts.size() + COLUMNS - 1) / COLUMNS), width / 2, height - 39, 0xFFB8D4E2);
        super.render(graphics, mouseX, mouseY, partialTick);
    }

    @Override public boolean mouseClicked(double mouseX, double mouseY, int button) {
        int panelW = Math.min(900, width - 20);
        int left = (width - panelW) / 2;
        int gap = 5;
        int cardW = (panelW - gap * (COLUMNS + 1)) / COLUMNS;
        int cardH = 76;
        int top = 62;
        List<Gift> gifts = filtered();
        for (int row = 0; row < visibleRows(); row++) for (int column = 0; column < COLUMNS; column++) {
            int index = (firstRow + row) * COLUMNS + column;
            if (index >= gifts.size()) continue;
            int x = left + gap + column * (cardW + gap);
            int y = top + row * (cardH + gap);
            if (mouseX < x || mouseX >= x + cardW || mouseY < y || mouseY >= y + cardH) continue;
            Gift gift = gifts.get(index);
            var choices=CATALOG.stream().filter(g->visual(g).equals(visual(gift))).toList();
            if(variants==null&&choices.size()>1){minecraft.setScreen(new SnowWarGiftCatalogScreen(choices));return true;}
            SnowWarClientConfig.GiftRule rule = SnowWarClientConfig.get().giftRules[SnowWarActionsScreen.selectedRule()];
            rule.giftName = gift.name();
            rule.giftId = gift.id();
            SnowWarClientConfig.get().save();
            minecraft.setScreen(new SnowWarActionsScreen());
            return true;
        }
        return super.mouseClicked(mouseX, mouseY, button);
    }

    @Override public boolean mouseScrolled(double mouseX, double mouseY, double delta) {
        int totalRows = (filtered().size() + COLUMNS - 1) / COLUMNS;
        firstRow = Math.max(0, Math.min(Math.max(0, totalRows - visibleRows()), firstRow + (delta < 0 ? 2 : -2)));
        return true;
    }

    @Override public boolean isPauseScreen() { return false; }
    private record Gift(String id, String name, int coins, String file) {}
}
