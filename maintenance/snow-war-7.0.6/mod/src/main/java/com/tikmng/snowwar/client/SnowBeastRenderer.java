package com.tikmng.snowwar.client;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import com.tikmng.snowwar.game.SnowBeastEntity;
import net.minecraft.client.gui.Font;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.MobRenderer;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;

public final class SnowBeastRenderer extends MobRenderer<SnowBeastEntity, SnowBeastModel> {
    private static final ResourceLocation TEXTURE = ResourceLocation.fromNamespaceAndPath(
        "minecraft", "textures/block/white_concrete.png");

    public SnowBeastRenderer(EntityRendererProvider.Context context) {
        super(context, new SnowBeastModel(), 1.0F);
    }

    @Override public ResourceLocation getTextureLocation(SnowBeastEntity entity) { return TEXTURE; }

    @Override protected void scale(SnowBeastEntity entity, PoseStack pose, float partialTick) {
        float value = entity.renderScale();
        pose.scale(value, value, value);
    }

    @Override protected void renderNameTag(SnowBeastEntity entity, Component ignored, PoseStack pose,
                                           MultiBufferSource buffers, int light) {
        double distance = Math.sqrt(entity.distanceToSqr(entityRenderDispatcher.camera.getPosition()));
        if (distance > 128) return;
        String name = entity.getName().getString();
        String profile = entity.profileUrl();
        Font font = getFont();
        pose.pushPose();
        pose.translate(0, entity.getBbHeight() * entity.renderScale() + 2.15, 0);
        pose.mulPose(entityRenderDispatcher.cameraOrientation());
        float tagScale = 0.052F * (1.0F + Math.min(0.28F, (float)Math.max(0, distance - 34) / 260.0F));
        pose.scale(-tagScale, -tagScale, tagScale);
        pose.translate(0, 0, 0.08F);
        font.drawInBatch(name, -font.width(name) / 2.0F, 0, 0xFFFFFFFF, false,
            pose.last().pose(), buffers, Font.DisplayMode.POLYGON_OFFSET, 0xA0000000, 0x00F000F0);
        pose.translate(0, 0, 0.08F);
        SnowFighterRenderer.drawHearts(font, entity.getHealth(), entity.getMaxHealth(), pose, buffers, 14);
        ResourceLocation avatar = SnowFighterRenderer.avatarTexture(profile);
        if (avatar != null && distance <= 96) {
            pose.translate(0, 0, 0.08F);
            VertexConsumer quad = buffers.getBuffer(RenderType.entityTranslucent(avatar));
            var matrix = pose.last();
            SnowFighterRenderer.drawCircularAvatar(quad, matrix, 32, -16, -41, 0x00F000F0);
        }
        pose.popPose();
    }

    @Override
    protected boolean shouldShowName(SnowBeastEntity entity) {
        return entity.distanceToSqr(entityRenderDispatcher.camera.getPosition()) <= 128.0 * 128.0;
    }

    private static void vertex(VertexConsumer quad, PoseStack.Pose pose, float x, float y, float u, float v) {
        quad.vertex(pose.pose(), x, y, 0).color(255, 255, 255, 255).uv(u, v)
            .overlayCoords(OverlayTexture.NO_OVERLAY).uv2(0x00F000F0).normal(pose.normal(), 0, 0, 1).endVertex();
    }
}
