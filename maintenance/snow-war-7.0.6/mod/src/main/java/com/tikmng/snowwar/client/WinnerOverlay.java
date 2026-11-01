package com.tikmng.snowwar.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.resources.ResourceLocation;

/** Responsive victory presentation shared by each standalone Minecraft game. */
final class WinnerOverlay {
    private WinnerOverlay() { }

    static void render(GuiGraphics graphics, String name, String profile, long started) {
        Minecraft mc = Minecraft.getInstance();
        float age = (System.nanoTime() - started) / 1_000_000_000.0F;
        int center = graphics.guiWidth() / 2;
        int size = Math.min(132, Math.max(40, graphics.guiHeight() - 90));
        int top = Math.max(8, (graphics.guiHeight() - size - 72) / 2);
        graphics.pose().pushPose();
        graphics.pose().translate(0, 0, 1000);
        graphics.fill(0, 0, graphics.guiWidth(), graphics.guiHeight(), 0x8806090F);
        text(graphics, "WINNER", center, top, 1.7F, 0xFFFFE681);
        int y = top + 29;
        ResourceLocation avatar = SnowFighterRenderer.avatarTexture(profile);
        float pulse = 0.98F + 0.02F * (float)Math.sin(age * 4);
        graphics.pose().pushPose();
        graphics.pose().translate(center, y + size / 2.0F, 0);
        graphics.pose().scale(pulse, pulse, 1);
        circle(graphics, -size / 2 - 3, -size / 2 - 3, size + 6, null, 0xFFFFD65B);
        circle(graphics, -size / 2, -size / 2, size, avatar, 0xFF253A57);
        if (avatar == null) graphics.drawCenteredString(mc.font, "?", 0, -4, 0xFFFFFFFF);
        graphics.pose().popPose();
        String label = mc.font.plainSubstrByWidth("@" + name.replaceFirst("^@", ""),
            (int)((graphics.guiWidth() - 24) / 1.2F));
        text(graphics, label, center, y + size + 12, 1.2F, 0xFFFFFFFF);
        graphics.drawCenteredString(mc.font, "KAZANAN", center, y + size + 29, 0xFFFFE681);
        graphics.pose().popPose();
    }

    private static void circle(GuiGraphics graphics, int x, int y, int size, ResourceLocation texture, int color) {
        double radius = size / 2.0;
        for (int row = 0; row < size; row++) {
            double dy = row + 0.5 - radius;
            int inset = (int)Math.ceil(radius - Math.sqrt(Math.max(0, radius * radius - dy * dy)));
            int strip = size - 2 * inset;
            if (strip <= 0) continue;
            if (texture != null) graphics.blit(texture, x + inset, y + row,
                (float)inset, (float)row, strip, 1, size, size);
            else graphics.fill(x + inset, y + row, x + size - inset, y + row + 1, color);
        }
    }

    private static void text(GuiGraphics graphics, String value, int x, int y, float scale, int color) {
        graphics.pose().pushPose();
        graphics.pose().translate(x, y, 0);
        graphics.pose().scale(scale, scale, 1);
        graphics.drawCenteredString(Minecraft.getInstance().font, value, 0, 0, color);
        graphics.pose().popPose();
    }
}
