package com.tikmng.snowwar.client;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public final class SnowWarActionsScreen extends Screen {
    static final String[] ACTIONS = { "OYUNCU", "IYILESTIR", "TAKIM_KALKANI", "EKSTRA_CAN",
        "AGIR_KARTOPU", "KAR_ADAMI", "CIG", "HERKESI_DUSUR", "BUYU", "KARTOPU_SILAHI",
        "BUZ_TUZAGI", "KAR_HORTUMU" };
    static final String[] LABELS = { "Kartopu savaşçısı", "Tek vuruşluk taşlı kartopu", "Kalkanlı kartopu savaşçısı", "Ekstra can (+1 kalp)",
        "Dev kardan adam", "Normal kardan adam", "Kar fırtınası (Yıldırım)", "Herkesi öldür", "Can ve güç artır",
        "Kartopu silahı", "Herkesi dondur", "Kar hortumu" };
    static final String[] UNITS = { "Kartopu savaşçısı adedi (olay başına en fazla 100)", "Takımın kartopları normal savaşçıları tek vuruşta öldürür",
        "Seçilen adet kadar tek darbeyi engelleyen kalkanlı savaşçı gönderir",
        "Atan kişinin bütün takımına +1 kalp", "Dev kardan adam adedi (olay başına en fazla 50)",
        "Normal kardan adam adedi (olay başına en fazla 50)", "Gönderen hariç herkesten 2 kalp götürür", "Gönderen takım ve yayıncı hariç herkesi öldürür",
        "Takıma +1 kalp, 1,5 kalp hasar ve görünür büyüme",
        "Atan kişinin bütün takımına süreli taramalı kartopu silahı verir",
        "Süre boyunca gönderen ekip hariç herkesi dondurur",
        "Süre boyunca kalabalığın üzerinde hareket eden büyük kar hortumu" };
    private static int page;
    private static int selectedRule;
    private final EditBox[] eventThresholds = new EditBox[2];
    private final EditBox[] eventAmounts = new EditBox[2];
    private final EditBox[] eventDurations = new EditBox[2];
    private EditBox[] giftFields = new EditBox[0];
    private EditBox[] amountFields = new EditBox[0];
    private EditBox[] durationFields = new EditBox[0];
    private int firstRule;
    private int pageSize;
    private int top;
    private int left;
    private int panelW;
    private int actionX;
    private int amountX;
    private int durationX;
    private int eventThresholdX;
    private int eventActionX;

    public SnowWarActionsScreen() { super(Component.literal("Hediye ve etkileşim ayarları")); }

    @Override
    protected void init() {
        SnowWarClientConfig config = SnowWarClientConfig.get();
        panelW = Math.min(680, width - 16);
        left = (width - panelW) / 2;
        pageSize = 6;
        page = Math.max(0, Math.min(page, (config.giftRules.length - 1) / pageSize));
        firstRule = page * pageSize;
        top = Math.max(4, (height - (132 + pageSize * 23)) / 2);
        int numberW = panelW < 420 ? 42 : 60;
        int durationW = 46;
        int testW = panelW < 420 ? 32 : 38;
        int deleteW = 20;
        int giftW = (panelW - numberW - durationW - testW - deleteW - 20) * 45 / 100;
        actionX = left + giftW + 4;
        int deleteX = left + panelW - deleteW;
        int testX = deleteX - testW - 4;
        durationX = testX - durationW - 4;
        amountX = durationX - numberW - 4;
        int actionW = amountX - actionX - 4;
        eventThresholdX = left + (panelW < 420 ? 38 : 48) + 4;
        eventActionX = eventThresholdX + numberW + 4;

        for (int i = 0; i < 2; i++) {
            final boolean likes = i == 0;
            int y = top + 32 + i * 24;
            eventThresholds[i] = numberField(eventThresholdX, y, numberW,
                likes ? config.likesPerFighter : config.followsPerAction, likes ? "Beğeni eşiği" : "Takip eşiği");
            String action = likes ? config.likesAction : config.followAction;
            actionButton(action, eventActionX, y, amountX - eventActionX - 4, () -> {
                saveRules();
                SnowWarActionPickerScreen.selectEvent(likes);
                minecraft.setScreen(new SnowWarActionPickerScreen());
            });
            eventAmounts[i] = numberField(amountX, y, numberW,
                likes ? config.likesAmount : config.followAmount, likes ? "Beğeni miktarı" : "Takip miktarı");
            eventAmounts[i].setTooltip(Tooltip.create(Component.literal(actionUnit(action))));
            eventAmounts[i].visible = usesAmount(action);
            eventAmounts[i].active = usesAmount(action);
            eventDurations[i] = durationField(durationX, y, durationW,
                likes ? config.likesDurationSeconds : config.followDurationSeconds, action,
                likes ? "Beğeni süresi" : "Takip süresi");
            addRenderableWidget(Button.builder(Component.literal("Test"), b -> {
                saveRules();
                testAction(likes ? config.likesAction : config.followAction, likes ? config.likesAmount : config.followAmount,
                    likes ? config.likesDurationSeconds : config.followDurationSeconds);
            }).bounds(testX, y, testW, 18).build());
        }

        giftFields = new EditBox[pageSize];
        amountFields = new EditBox[pageSize];
        durationFields = new EditBox[pageSize];
        for (int slot = 0; slot < pageSize && firstRule + slot < config.giftRules.length; slot++) {
            int ruleIndex = firstRule + slot;
            SnowWarClientConfig.GiftRule rule = config.giftRules[ruleIndex];
            int rowY = top + 94 + slot * 23;
            int fieldW = giftW - 32;
            EditBox field = new EditBox(font, left, rowY, fieldW, 18, Component.literal("Hediye adı"));
            field.setMaxLength(64);
            field.setValue(rule.giftName);
            field.setHint(Component.literal("Hediye adı"));
            field.setResponder(value -> {
                rule.giftName = value.trim();
                rule.giftId = "";
            });
            giftFields[slot] = addRenderableWidget(field);
            addRenderableWidget(Button.builder(Component.literal("Seç"), b -> {
                saveRules();
                selectedRule = ruleIndex;
                minecraft.setScreen(new SnowWarGiftCatalogScreen());
            }).bounds(left + fieldW + 4, rowY, 28, 18).build());
            actionButton(rule.action, actionX, rowY, actionW, () -> {
                saveRules();
                selectedRule = ruleIndex;
                SnowWarActionPickerScreen.selectRule(ruleIndex);
                minecraft.setScreen(new SnowWarActionPickerScreen());
            });
            amountFields[slot] = numberField(amountX, rowY, numberW, rule.amount, "Hediye miktarı");
            amountFields[slot].setTooltip(Tooltip.create(Component.literal(actionUnit(rule.action))));
            amountFields[slot].visible = usesAmount(rule.action);
            amountFields[slot].active = usesAmount(rule.action);
            durationFields[slot] = durationField(durationX, rowY, durationW, rule.durationSeconds, rule.action, "Hediye süresi");
            addRenderableWidget(Button.builder(Component.literal("Test"), b -> {
                saveRules();
                testAction(rule.action, rule.amount, rule.durationSeconds);
            }).bounds(testX, rowY, testW, 18).build());
            addRenderableWidget(Button.builder(Component.literal("X"), b -> {
                saveRules();
                SnowWarClientConfig current = SnowWarClientConfig.get();
                current.removeGiftRule(ruleIndex);
                current.save();
                page = Math.max(0, Math.min(page, (current.giftRules.length - 1) / Math.max(1, pageSize)));
                rebuildWidgets();
            }).bounds(deleteX, rowY, deleteW, 18)
                .tooltip(Tooltip.create(Component.literal("Bu hediye eylemini sil"))).build());
        }

        int footerY = top + 118 + pageSize * 23;
        Button previous = addRenderableWidget(Button.builder(Component.literal("<"), b -> changePage(-1))
            .bounds(left, footerY, 24, 18).tooltip(Tooltip.create(Component.literal("Önceki sayfa"))).build());
        previous.active = page > 0;
        Button next = addRenderableWidget(Button.builder(Component.literal(">"), b -> changePage(1))
            .bounds(left + 28, footerY, 24, 18).tooltip(Tooltip.create(Component.literal("Sonraki sayfa"))).build());
        next.active = firstRule + pageSize < config.giftRules.length;
        Button add = addRenderableWidget(Button.builder(Component.literal("+ Eylem ekle"), b -> {
            saveRules();
            config.addGiftRule();
            config.save();
            page = (config.giftRules.length - 1) / Math.max(1, pageSize);
            rebuildWidgets();
        }).bounds(left + 58, footerY, 88, 18).build());
        add.active = config.giftRules.length < 100;
        addRenderableWidget(Button.builder(Component.literal("Kaydet"), b -> {
            boolean saved = saveRules();
            if (minecraft.player != null) minecraft.player.displayClientMessage(
                Component.literal(saved ? "Ayarlar kaydedildi." : "Ayarlar kaydedilemedi."), true);
        }).bounds(left + panelW - 148, footerY, 80, 18).build());
        addRenderableWidget(Button.builder(Component.literal("Geri"), b -> onClose())
            .bounds(left + panelW - 64, footerY, 64, 18).build());
    }

    private EditBox numberField(int x, int y, int w, int value, String label) {
        EditBox field = new EditBox(font, x, y, w, 18, Component.literal(label));
        field.setMaxLength(7);
        field.setFilter(v -> v.isEmpty() || v.matches("[0-9]{1,7}"));
        field.setValue(Integer.toString(value));
        field.setTooltip(Tooltip.create(Component.literal(label)));
        return addRenderableWidget(field);
    }

    private void actionButton(String action, int x, int y, int w, Runnable select) {
        String label = actionLabel(action);
        addRenderableWidget(Button.builder(Component.literal(font.plainSubstrByWidth(label, Math.max(1, w - 12))), b -> select.run())
            .bounds(x, y, w, 18).tooltip(Tooltip.create(Component.literal(label + ": " + actionUnit(action)))).build());
    }

    static boolean usesDuration(String action) {
        return "KARTOPU_SILAHI".equals(action) || "BUZ_TUZAGI".equals(action)
            || "KAR_HORTUMU".equals(action)
            || "BUYU".equals(action);
    }

    static boolean usesAmount(String action) {
        return "OYUNCU".equals(action) || "OYUNCU_1".equals(action)
            || "OYUNCU_5".equals(action) || "OYUNCU_10".equals(action)
            || "OYUNCU_20".equals(action) || "OYUNCU_30".equals(action)
            || "OYUNCU_40".equals(action) || "TAKIM_KALKANI".equals(action)
            || "KAR_ADAMI".equals(action) || "AGIR_KARTOPU".equals(action);
    }

    private EditBox durationField(int x, int y, int w, int value, String action, String label) {
        EditBox field = numberField(x, y, w, SnowWarClientConfig.durationSeconds(value), label);
        field.active = usesDuration(action);
        field.setEditable(field.active);
        field.setTooltip(Tooltip.create(Component.literal(label + " (1-120 sn)")));
        return field;
    }

    static String actionLabel(String action) {
        for (int i = 0; i < ACTIONS.length; i++) if (ACTIONS[i].equals(action)) return LABELS[i];
        return action == null ? "Savaşçı gönder" : action;
    }

    static String actionUnit(String action) {
        for (int i = 0; i < ACTIONS.length; i++) if (ACTIONS[i].equals(action)) return UNITS[i];
        return "Eylem miktarı";
    }

    private void changePage(int delta) {
        saveRules();
        page += delta;
        rebuildWidgets();
    }

    private static int readNumber(EditBox field, int fallback) {
        int value = fallback;
        try { value = SnowWarClientConfig.positive(Integer.parseInt(field.getValue()), fallback); }
        catch (NumberFormatException ignored) { }
        field.setValue(Integer.toString(value));
        return value;
    }

    private boolean saveRules() {
        SnowWarClientConfig config = SnowWarClientConfig.get();
        if (eventThresholds[0] != null) {
            config.likesPerFighter = readNumber(eventThresholds[0], config.likesPerFighter);
            config.followsPerAction = readNumber(eventThresholds[1], config.followsPerAction);
            config.likesAmount = readNumber(eventAmounts[0], config.likesAmount);
            config.followAmount = readNumber(eventAmounts[1], config.followAmount);
            config.likesDurationSeconds = readDuration(eventDurations[0], config.likesDurationSeconds);
            config.followDurationSeconds = readDuration(eventDurations[1], config.followDurationSeconds);
        }
        for (int slot = 0; slot < giftFields.length; slot++) {
            if (giftFields[slot] == null) continue;
            SnowWarClientConfig.GiftRule rule = config.giftRules[firstRule + slot];
            rule.giftName = giftFields[slot].getValue().trim();
            rule.amount = readNumber(amountFields[slot], rule.amount);
            rule.durationSeconds = readDuration(durationFields[slot], rule.durationSeconds);
        }
        return config.save();
    }

    private static int readDuration(EditBox field, int fallback) {
        int value = fallback;
        try { value = Integer.parseInt(field.getValue()); }
        catch (NumberFormatException ignored) { }
        value = SnowWarClientConfig.durationSeconds(value);
        field.setValue(Integer.toString(value));
        return value;
    }

    private void testAction(String action, int amount, int durationSeconds) {
        if (minecraft == null || minecraft.player == null) return;
        SnowWarLiveClient.testAction(action, amount, durationSeconds);
        minecraft.player.displayClientMessage(Component.literal("Test: " + actionLabel(action) + " x" + amount
            + (usesDuration(action) ? " / " + durationSeconds + " sn" : "")), true);
    }

    @Override
    public void resize(net.minecraft.client.Minecraft client, int width, int height) {
        saveRules();
        selectedRule = firstRule;
        page = selectedRule / 6;
        super.resize(client, width, height);
    }

    @Override public void onClose() {
        saveRules();
        minecraft.setScreen(new SnowWarSettingsScreen());
    }

    @Override
    public void render(GuiGraphics graphics, int mouseX, int mouseY, float partialTick) {
        renderBackground(graphics);
        graphics.drawCenteredString(font, title, width / 2, top + 4, 0xFFFFFFFF);
        graphics.drawString(font, "Olay", left, top + 20, 0xFF7FDEFF);
        graphics.drawString(font, "Eşik", eventThresholdX, top + 20, 0xFF7FDEFF);
        graphics.drawString(font, "Eylem", eventActionX, top + 20, 0xFF7FDEFF);
        graphics.drawString(font, "Miktar", amountX, top + 20, 0xFF7FDEFF);
        graphics.drawString(font, "Süre", durationX, top + 20, 0xFF7FDEFF);
        graphics.drawString(font, "Beğeni", left, top + 37, 0xFFFFFFFF);
        graphics.drawString(font, "Takip", left, top + 61, 0xFFFFFFFF);
        graphics.drawString(font, "Hediye", left, top + 82, 0xFF7FDEFF);
        graphics.drawString(font, "Eylem", actionX, top + 82, 0xFF7FDEFF);
        graphics.drawString(font, "Miktar", amountX, top + 82, 0xFF7FDEFF);
        graphics.drawString(font, "Süre", durationX, top + 82, 0xFF7FDEFF);
        graphics.drawString(font, (page + 1) + " / " + ((SnowWarClientConfig.get().giftRules.length + pageSize - 1) / pageSize),
            left + 151, top + 123 + pageSize * 23, 0xFFB8D4E2);
        super.render(graphics, mouseX, mouseY, partialTick);
    }

    static int selectedRule() { return selectedRule; }
    static void selectRule(int index) {
        selectedRule = Math.max(0, Math.min(SnowWarClientConfig.get().giftRules.length - 1, index));
    }
    @Override public boolean isPauseScreen() { return false; }
}
