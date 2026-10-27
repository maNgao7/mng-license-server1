package com.tikmng.snowwar.client;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public final class SnowWarActionPickerScreen extends Screen {
    private static int ruleIndex;
    private static int eventType;
    private int page;
    private int pageSize;

    public SnowWarActionPickerScreen() { super(Component.literal("Eylem seç")); }

    static void selectRule(int index) {
        ruleIndex = Math.max(0, Math.min(SnowWarClientConfig.get().giftRules.length - 1, index));
        eventType = 0;
    }
    static void selectEvent(boolean likes) { eventType = likes ? 1 : 2; }
    static String actionFor(int index, String fallback) {
        if (eventType != 0 || index != ruleIndex) return fallback;
        return SnowWarClientConfig.get().giftRules[index].action;
    }

    @Override
    protected void init() {
        int columns = width < 560 ? 2 : 4;
        int gap = 6;
        int widthPer = Math.min(220, (width - 32 - gap * (columns - 1)) / columns);
        int totalW = widthPer * columns + gap * (columns - 1);
        int left = (width - totalW) / 2;
        int startY = 46;
        int rows = Math.max(1, (height - startY - 42) / 28);
        pageSize = columns * rows;
        page = Math.min(page, (SnowWarActionsScreen.ACTIONS.length - 1) / pageSize);
        for (int i = page * pageSize; i < Math.min((page + 1) * pageSize, SnowWarActionsScreen.ACTIONS.length); i++) {
            final String action = SnowWarActionsScreen.ACTIONS[i];
            int row = (i % pageSize) / columns;
            int col = i % columns;
            String label = SnowWarActionsScreen.LABELS[i];
            addRenderableWidget(Button.builder(Component.literal(font.plainSubstrByWidth(label, widthPer - 12)), button -> {
                if (eventType == 1) SnowWarClientConfig.get().likesAction = action;
                else if (eventType == 2) SnowWarClientConfig.get().followAction = action;
                else SnowWarClientConfig.get().giftRules[ruleIndex].action = action;
                SnowWarClientConfig.get().save();
                minecraft.setScreen(new SnowWarActionsScreen());
            }).bounds(left + col * (widthPer + gap), startY + row * 28, widthPer, 24)
                .tooltip(Tooltip.create(Component.literal(label + ": " + SnowWarActionsScreen.actionUnit(action)))).build());
        }
        Button previous = addRenderableWidget(Button.builder(Component.literal("<"), b -> {
            page--; rebuildWidgets();
        }).bounds(left, height - 28, 24, 20).tooltip(Tooltip.create(Component.literal("Önceki sayfa"))).build());
        previous.active = page > 0;
        Button next = addRenderableWidget(Button.builder(Component.literal(">"), b -> {
            page++; rebuildWidgets();
        }).bounds(left + 28, height - 28, 24, 20).tooltip(Tooltip.create(Component.literal("Sonraki sayfa"))).build());
        next.active = (page + 1) * pageSize < SnowWarActionsScreen.ACTIONS.length;
        addRenderableWidget(Button.builder(Component.literal("Geri"), button -> {
            onClose();
        }).bounds(left + totalW - 80, height - 28, 80, 20).build());
    }

    @Override
    public void render(GuiGraphics graphics, int mouseX, int mouseY, float partialTick) {
        renderBackground(graphics);
        graphics.drawCenteredString(font, title, width / 2, 10, 0xFFFFFFFF);
        String target = eventType == 1 ? "Beğeni eylemi" : eventType == 2 ? "Takip eylemi" : "Hediye satırı " + (ruleIndex + 1);
        graphics.drawCenteredString(font, target + " için", width / 2,
            26, 0xFF9CE8FF);
        graphics.drawCenteredString(font, (page + 1) + " / " +
            ((SnowWarActionsScreen.ACTIONS.length + pageSize - 1) / pageSize), width / 2, height - 23, 0xFFB8D4E2);
        super.render(graphics, mouseX, mouseY, partialTick);
    }

    @Override public void onClose() { minecraft.setScreen(new SnowWarActionsScreen()); }

    @Override public boolean isPauseScreen() { return false; }
}
