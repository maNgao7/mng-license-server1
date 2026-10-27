package com.tikmng.snowwar.client;

import com.mojang.blaze3d.vertex.Tesselator;
import com.mojang.blaze3d.vertex.DefaultVertexFormat;
import com.mojang.blaze3d.vertex.VertexFormat;
import com.mojang.blaze3d.vertex.BufferUploader;
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.client.renderer.GameRenderer;
import net.minecraft.client.Minecraft;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.client.event.RenderLevelStageEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;

@Mod.EventBusSubscriber(modid = "mng_battle_royale", value = Dist.CLIENT)
public final class BattleZoneRenderer {
    @SubscribeEvent
    public static void render(RenderLevelStageEvent event) {
        if (event.getStage() != RenderLevelStageEvent.Stage.AFTER_WEATHER) return;
        var minecraft = Minecraft.getInstance();
        if (minecraft.level == null) return;
        var pose = event.getPoseStack();
        var camera = event.getCamera().getPosition();
        pose.pushPose();
        pose.translate(BattleMinimap.x-camera.x, -camera.y, BattleMinimap.z-camera.z);
        RenderSystem.enableBlend();
        RenderSystem.defaultBlendFunc();
        RenderSystem.disableCull();
        RenderSystem.depthMask(false);
        RenderSystem.setShader(GameRenderer::getPositionColorShader);
        var vertices = Tesselator.getInstance().getBuilder();
        vertices.begin(VertexFormat.Mode.QUADS, DefaultVertexFormat.POSITION_COLOR);
        var matrix = pose.last().pose();
        double radius = ClientEvents.visibleZoneRadius;
        float bottom = ClientEvents.zoneFloor + 0.18F;
        float middle = bottom + 24;
        float top = bottom + 72;

        // The safe-zone boundary is a soft energy curtain, not a solid glass wall.
        for (int i = 0; i < 256; i++) {
            double a = i * Math.PI * 2 / 256;
            double b = (i + 1) * Math.PI * 2 / 256;
            float x1 = (float)(Math.cos(a) * radius), z1 = (float)(Math.sin(a) * radius);
            float x2 = (float)(Math.cos(b) * radius), z2 = (float)(Math.sin(b) * radius);
            vertices.vertex(matrix, x1, bottom, z1).color(24, 112, 255, 185).endVertex();
            vertices.vertex(matrix, x1, middle, z1).color(42, 152, 255, 135).endVertex();
            vertices.vertex(matrix, x2, middle, z2).color(42, 152, 255, 135).endVertex();
            vertices.vertex(matrix, x2, bottom, z2).color(24, 112, 255, 185).endVertex();

            vertices.vertex(matrix, x1, middle, z1).color(42, 152, 255, 135).endVertex();
            vertices.vertex(matrix, x1, top, z1).color(75, 190, 255, 0).endVertex();
            vertices.vertex(matrix, x2, top, z2).color(75, 190, 255, 0).endVertex();
            vertices.vertex(matrix, x2, middle, z2).color(42, 152, 255, 135).endVertex();
        }

        // A horizontal ground ring makes the fixed world position readable from the aircraft.
        for (int i = 0; i < 256; i++) {
            double a = i * Math.PI * 2 / 256;
            double b = (i + 1) * Math.PI * 2 / 256;
            double glowWidth = Math.min(2.4, radius * 0.25);
            double inner = radius - glowWidth;
            double outer = radius + glowWidth;
            float ix1 = (float)(Math.cos(a) * inner), iz1 = (float)(Math.sin(a) * inner);
            float ix2 = (float)(Math.cos(b) * inner), iz2 = (float)(Math.sin(b) * inner);
            float ox1 = (float)(Math.cos(a) * outer), oz1 = (float)(Math.sin(a) * outer);
            float ox2 = (float)(Math.cos(b) * outer), oz2 = (float)(Math.sin(b) * outer);
            vertices.vertex(matrix, ix1, bottom + 0.10F, iz1).color(30, 105, 255, 35).endVertex();
            vertices.vertex(matrix, ox1, bottom + 0.10F, oz1).color(35, 145, 255, 145).endVertex();
            vertices.vertex(matrix, ox2, bottom + 0.10F, oz2).color(35, 145, 255, 145).endVertex();
            vertices.vertex(matrix, ix2, bottom + 0.10F, iz2).color(30, 105, 255, 35).endVertex();

            double lineWidth = Math.min(0.22, radius * 0.12);
            double lineInner = radius - lineWidth;
            double lineOuter = radius + lineWidth;
            vertices.vertex(matrix, (float)(Math.cos(a) * lineInner), bottom + 0.16F,
                (float)(Math.sin(a) * lineInner)).color(255, 220, 65, 175).endVertex();
            vertices.vertex(matrix, (float)(Math.cos(a) * lineOuter), bottom + 0.16F,
                (float)(Math.sin(a) * lineOuter)).color(255, 245, 145, 210).endVertex();
            vertices.vertex(matrix, (float)(Math.cos(b) * lineOuter), bottom + 0.16F,
                (float)(Math.sin(b) * lineOuter)).color(255, 245, 145, 210).endVertex();
            vertices.vertex(matrix, (float)(Math.cos(b) * lineInner), bottom + 0.16F,
                (float)(Math.sin(b) * lineInner)).color(255, 220, 65, 175).endVertex();
        }

        // Sparse, slanted pulses keep the boundary readable without creating bars.
        double time = minecraft.level.getGameTime() + event.getPartialTick();
        for (int i = 0; i < 40; i++) {
            double base = i * Math.PI * 2 / 40 + Math.sin(i * 2.71) * 0.008;
            double width = 0.0035;
            double lean = Math.sin(i * 1.93) * 0.018;
            float pulseBottom = bottom + 2 + (float)((i * 17) % 11)
                + (float)Math.sin(time * 0.16 + i) * 1.2F;
            float pulseTop = pulseBottom + 19 + (i % 5) * 3;
            double pulseRadius = radius - Math.min(0.12, radius * 0.1);
            float px1 = (float)(Math.cos(base) * pulseRadius);
            float pz1 = (float)(Math.sin(base) * pulseRadius);
            float px2 = (float)(Math.cos(base + width) * pulseRadius);
            float pz2 = (float)(Math.sin(base + width) * pulseRadius);
            float px3 = (float)(Math.cos(base + lean + width) * pulseRadius);
            float pz3 = (float)(Math.sin(base + lean + width) * pulseRadius);
            float px4 = (float)(Math.cos(base + lean) * pulseRadius);
            float pz4 = (float)(Math.sin(base + lean) * pulseRadius);
            int pulseAlpha = 95 + (int)(45 * (0.5 + 0.5 * Math.sin(time * 0.22 + i)));
            vertices.vertex(matrix, px1, pulseBottom, pz1).color(255, 214, 45, 0).endVertex();
            vertices.vertex(matrix, px4, pulseTop, pz4).color(255, 235, 105, pulseAlpha).endVertex();
            vertices.vertex(matrix, px3, pulseTop, pz3).color(255, 235, 105, pulseAlpha).endVertex();
            vertices.vertex(matrix, px2, pulseBottom, pz2).color(255, 214, 45, 0).endVertex();
        }
        var modelView = RenderSystem.getModelViewStack();
        modelView.pushPose();
        modelView.setIdentity();
        RenderSystem.applyModelViewMatrix();
        BufferUploader.drawWithShader(vertices.end());
        modelView.popPose();
        RenderSystem.applyModelViewMatrix();
        RenderSystem.depthMask(true);
        RenderSystem.enableCull();
        RenderSystem.disableBlend();
        pose.popPose();
    }
}
