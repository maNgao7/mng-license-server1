package com.tikmng.snowwar.client;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import com.mojang.math.Axis;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.entity.EntityRenderer;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.projectile.Arrow;

/** Uses Minecraft projectile collision without rendering a wooden arrow. */
public final class BattleBulletRenderer extends EntityRenderer<Arrow> {
    public BattleBulletRenderer(EntityRendererProvider.Context context) { super(context); }

    @Override
    public ResourceLocation getTextureLocation(Arrow entity) { return SnowFighterRenderer.solidTexture(); }

    @Override
    public void render(Arrow entity, float yaw, float partial, PoseStack pose, MultiBufferSource buffers, int light) {
        pose.pushPose();
        pose.mulPose(Axis.YP.rotationDegrees(Mth.lerp(partial, entity.yRotO, entity.getYRot())-90));
        pose.mulPose(Axis.ZP.rotationDegrees(Mth.lerp(partial, entity.xRotO, entity.getXRot())));
        var solid = buffers.getBuffer(RenderType.entityCutoutNoCull(getTextureLocation(entity)));
        for (int i=0; i<8; i++) {
            double a = i*Math.PI/4, b = (i+1)*Math.PI/4;
            float y1=(float)Math.cos(a)*0.035F, z1=(float)Math.sin(a)*0.035F;
            float y2=(float)Math.cos(b)*0.035F, z2=(float)Math.sin(b)*0.035F;
            point(solid,pose.last(),-0.16F,y1,z1,230,184,75,255);
            point(solid,pose.last(),0.13F,y1,z1,230,184,75,255);
            point(solid,pose.last(),0.13F,y2,z2,230,184,75,255);
            point(solid,pose.last(),-0.16F,y2,z2,230,184,75,255);
            point(solid,pose.last(),0.13F,y1,z1,210,215,220,255);
            point(solid,pose.last(),0.23F,0,0,210,215,220,255);
            point(solid,pose.last(),0.23F,0,0,210,215,220,255);
            point(solid,pose.last(),0.13F,y2,z2,210,215,220,255);
        }
        var glow = buffers.getBuffer(RenderType.entityTranslucentEmissive(getTextureLocation(entity)));
        for (int i=0; i<2; i++) {
            pose.pushPose();
            pose.mulPose(Axis.XP.rotationDegrees(i*90));
            point(glow,pose.last(),-0.9F,-0.016F,0,255,192,65,80);
            point(glow,pose.last(),0.05F,-0.025F,0,255,235,150,240);
            point(glow,pose.last(),0.05F,0.025F,0,255,235,150,240);
            point(glow,pose.last(),-0.9F,0.016F,0,255,192,65,80);
            pose.popPose();
        }
        pose.popPose();
    }

    private static void point(VertexConsumer buffer, PoseStack.Pose pose, float x, float y, float z,
                              int r, int g, int b, int a) {
        buffer.vertex(pose.pose(),x,y,z).color(r,g,b,a).uv(0.5F,0.5F)
            .overlayCoords(OverlayTexture.NO_OVERLAY).uv2(0x00F000F0)
            .normal(pose.normal(),0,1,0).endVertex();
    }
}
