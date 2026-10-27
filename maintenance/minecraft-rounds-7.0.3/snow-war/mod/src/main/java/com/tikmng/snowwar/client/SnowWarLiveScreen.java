package com.tikmng.snowwar.client;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public final class SnowWarLiveScreen extends Screen {
    private EditBox username;

    public SnowWarLiveScreen() { super(Component.literal("Canlı yayın bağlantısı")); }

    @Override
    protected void init() {
        int w = Math.min(380, width - 32);
        int x = (width - w) / 2;
        int y = Math.max(36, (height - 120) / 2);
        username = new EditBox(font, x, y + 32, w, 22, Component.literal("TikTok kullanıcı adı"));
        username.setMaxLength(32);
        username.setValue("");
        username.setFilter(value -> value.matches("[a-zA-Z0-9_.@]*"));
        addRenderableWidget(username);
        addRenderableWidget(Button.builder(Component.literal("Bağlan"), b -> {
            String value = username.getValue().trim();
            SnowWarLiveClient.connect(value);
        }).bounds(x, y + 62, (w - 6) / 2, 22).build());
        addRenderableWidget(Button.builder(Component.literal("Bağlantıyı kes"), b -> SnowWarLiveClient.disconnect())
            .bounds(x + (w + 6) / 2, y + 62, (w - 6) / 2, 22).build());
        addRenderableWidget(Button.builder(Component.literal("Geri"), b -> minecraft.setScreen(new SnowWarSettingsScreen()))
            .bounds(x, y + 92, w, 22).build());
    }

    @Override
    public void render(GuiGraphics graphics, int mouseX, int mouseY, float partialTick) {
        renderBackground(graphics);
        int y = Math.max(36, (height - 120) / 2);
        graphics.drawCenteredString(font, title, width / 2, y + 8, 0xFFFFFFFF);
        graphics.drawCenteredString(font, SnowWarLiveClient.status(), width / 2, y + 121, 0xFF8FE9FF);
        super.render(graphics, mouseX, mouseY, partialTick);
    }

    @Override
    public boolean isPauseScreen() { return false; }
}
