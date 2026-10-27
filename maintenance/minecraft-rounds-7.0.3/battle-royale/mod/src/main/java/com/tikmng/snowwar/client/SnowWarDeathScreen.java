package com.tikmng.snowwar.client;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.client.gui.screens.DeathScreen;
import net.minecraft.network.chat.Component;

public final class SnowWarDeathScreen extends DeathScreen {
    public SnowWarDeathScreen() { super(Component.literal("MNG Battle Royale"), false); }

    @Override protected void init() {
        super.init();
        int row = 0;
        for (var child : children()) {
            if (child instanceof AbstractWidget widget) {
                widget.setX(width / 2 - 100);
                widget.setY(height - 56 + row * 24);
                row++;
            }
        }
    }

    @Override public void render(GuiGraphics graphics, int mouseX, int mouseY, float partialTick) {
        graphics.fill(0, 0, width, height, 0x99441C2A);
        if (ClientEvents.hasDeathNotice()) {
            ClientEvents.renderDeath(graphics);
        } else {
            graphics.pose().pushPose();
            graphics.pose().scale(2.0F, 2.0F, 2.0F);
            graphics.drawCenteredString(font, Component.translatable("deathScreen.title"),
                width / 4, Math.max(8, (height - 100) / 4), 0xFFFFFFFF);
            graphics.pose().popPose();
        }
        for (var renderable : renderables) renderable.render(graphics, mouseX, mouseY, partialTick);
    }
}
