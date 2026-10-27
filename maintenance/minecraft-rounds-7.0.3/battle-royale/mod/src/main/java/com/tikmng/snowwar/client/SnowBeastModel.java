package com.tikmng.snowwar.client;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import com.tikmng.snowwar.game.SnowBeastEntity;
import net.minecraft.client.model.HierarchicalModel;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.geom.PartPose;
import net.minecraft.client.model.geom.builders.CubeListBuilder;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import net.minecraft.client.model.geom.builders.MeshDefinition;
import net.minecraft.client.model.geom.builders.PartDefinition;
import net.minecraft.util.Mth;

public final class SnowBeastModel extends HierarchicalModel<SnowBeastEntity> {
    private final ModelPart root;
    private final ModelPart lowerBody;
    private final ModelPart middleBody;
    private final ModelPart head;
    private final ModelPart headSnow;
    private final ModelPart faceCoal;
    private final ModelPart carrot;
    private final ModelPart buttons;
    private final ModelPart scarf;
    private final ModelPart rightArm;
    private final ModelPart leftArm;

    public SnowBeastModel() {
        root = createBodyLayer().bakeRoot().getChild("snowman");
        lowerBody = root.getChild("lower_body");
        middleBody = root.getChild("middle_body");
        head = root.getChild("head");
        headSnow = head.getChild("snow");
        faceCoal = head.getChild("coal");
        carrot = head.getChild("carrot");
        buttons = root.getChild("buttons");
        scarf = root.getChild("scarf");
        rightArm = root.getChild("right_arm");
        leftArm = root.getChild("left_arm");
    }

    public static LayerDefinition createBodyLayer() {
        MeshDefinition mesh = new MeshDefinition();
        PartDefinition snowman = mesh.getRoot().addOrReplaceChild("snowman",
            CubeListBuilder.create(), PartPose.offset(0, 24, 0));
        // Model units run from ground level at 0 to -64: four blocks tall.
        snowman.addOrReplaceChild("lower_body", snowball(4, 16, 24, 30, 32, 30, 24, 16),
            PartPose.offset(0, -14, 0));
        snowman.addOrReplaceChild("middle_body", snowball(4, 14, 20, 24, 24, 20, 14),
            PartPose.offset(0, -35, 0));
        PartDefinition head = snowman.addOrReplaceChild("head", CubeListBuilder.create(),
            PartPose.offset(0, -54, 0));
        head.addOrReplaceChild("snow", snowball(4, 12, 18, 20, 18, 12), PartPose.ZERO);
        head.addOrReplaceChild("coal", CubeListBuilder.create()
            .addBox(-6, -4, -10.6F, 3, 3, 1.5F)
            .addBox(3, -4, -10.6F, 3, 3, 1.5F)
            .addBox(-5.8F, 2.8F, -9.8F, 1.4F, 1.4F, 1.2F)
            .addBox(4.4F, 2.8F, -9.8F, 1.4F, 1.4F, 1.2F)
            .addBox(-3.6F, 4, -9.8F, 1.4F, 1.4F, 1.2F)
            .addBox(2.2F, 4, -9.8F, 1.4F, 1.4F, 1.2F)
            .addBox(-0.7F, 4.7F, -9.8F, 1.4F, 1.2F, 1.2F), PartPose.ZERO);
        head.addOrReplaceChild("carrot", CubeListBuilder.create()
            .addBox(-1.5F, -0.5F, -13.5F, 3, 3, 4)
            .addBox(-1, 0, -16.5F, 2, 2, 3)
            .addBox(-0.5F, 0.5F, -18.5F, 1, 1, 2), PartPose.ZERO);
        snowman.addOrReplaceChild("buttons", CubeListBuilder.create()
            .addBox(-1.5F, -38, -12.8F, 3, 3, 1.5F)
            .addBox(-1.5F, -33, -12.8F, 3, 3, 1.5F)
            .addBox(-1.7F, -15.5F, -16.8F, 3.4F, 3, 1.5F), PartPose.ZERO);
        PartDefinition scarf = snowman.addOrReplaceChild("scarf", CubeListBuilder.create()
            .addBox(-11, -2, -11, 22, 4, 22), PartPose.offset(0, -44, 0));
        scarf.addOrReplaceChild("knot", CubeListBuilder.create()
            .addBox(2, -1.5F, -13, 6, 5, 3), PartPose.ZERO);
        scarf.addOrReplaceChild("tail", CubeListBuilder.create()
            .addBox(3, 2, -13.2F, 5, 11, 2), PartPose.ZERO);
        addTwigArm(snowman, "right_arm", -1);
        addTwigArm(snowman, "left_arm", 1);
        // Every UV stays inside the same white texture; material colors come from vertex tint.
        return LayerDefinition.create(mesh, 128, 128);
    }

    private static CubeListBuilder snowball(float sliceHeight, float... widths) {
        CubeListBuilder cubes = CubeListBuilder.create();
        float top = -sliceHeight * widths.length * 0.5F;
        for (int i = 0; i < widths.length; i++) {
            float width = widths[i];
            float half = width * 0.5F;
            float inner = width * 0.375F;
            float bevel = width * 0.125F;
            float y = top + i * sliceHeight;
            // Three adjacent boxes trim the corners without overlapping exterior faces.
            cubes.addBox(-inner, y, -half, inner * 2, sliceHeight, width)
                .addBox(-half, y, -inner, bevel, sliceHeight, inner * 2)
                .addBox(inner, y, -inner, bevel, sliceHeight, inner * 2);
        }
        return cubes;
    }

    private static void addTwigArm(PartDefinition parent, String name, int side) {
        PartDefinition arm = parent.addOrReplaceChild(name, CubeListBuilder.create()
            .addBox(side < 0 ? -18 : 0, -1.2F, -1.2F, 18, 2.4F, 2.4F),
            PartPose.offset(10.5F * side, -38, 0));
        arm.addOrReplaceChild("tip", CubeListBuilder.create()
            .addBox(side < 0 ? -5 : 0, -0.8F, -0.8F, 5, 1.6F, 1.6F),
            PartPose.offset(17 * side, 0, 0));
        for (int direction : new int[] {-1, 1}) {
            arm.addOrReplaceChild("fork_" + direction, CubeListBuilder.create()
                .addBox(side < 0 ? -6 : 0, -0.7F, -0.7F, 6, 1.4F, 1.4F),
                PartPose.offsetAndRotation(15 * side, 0, 0, 0, 0, direction * 0.75F));
        }
    }

    @Override public ModelPart root() { return root; }

    @Override
    public void setupAnim(SnowBeastEntity entity, float walk, float speed, float age, float yaw, float pitch) {
        root.getAllParts().forEach(ModelPart::resetPose);
        float stride = Mth.cos(walk * 0.6662F) * Math.min(speed, 1);
        float idle = Mth.sin(age * 0.07F) * 0.025F;
        root.zRot = stride * 0.018F;
        head.yRot = Mth.clamp(yaw, -60, 60) * Mth.DEG_TO_RAD;
        head.xRot = Mth.clamp(pitch, -25, 25) * Mth.DEG_TO_RAD;
        rightArm.yRot = stride * 0.2F;
        leftArm.yRot = -stride * 0.2F;
        rightArm.zRot = 0.22F + idle;
        leftArm.zRot = -0.22F - idle;
        float throwing = Mth.sin(Mth.sqrt(Mth.clamp(attackTime, 0, 1)) * Mth.PI);
        float elapsed = entity.throwAnimationAge(Mth.clamp(age - entity.tickCount, 0, 1));
        if (elapsed >= 0 && elapsed < 18) {
            float phase = elapsed < 10 ? elapsed / 10.0F : 1.0F - (elapsed - 10.0F) / 8.0F;
            throwing = Math.max(throwing, Mth.sin(Mth.clamp(phase, 0, 1) * Mth.PI));
        }
        if (entity.getAttackAnimationTick() > 0) {
            float partialTick = Mth.clamp(age - entity.tickCount, 0, 1);
            float progress = 1 - (entity.getAttackAnimationTick() - partialTick) / 10.0F;
            throwing = Math.max(throwing, Mth.sin(Mth.clamp(progress, 0, 1) * Mth.PI));
        }
        rightArm.xRot = -0.65F * throwing;
        rightArm.yRot -= 0.85F * throwing;
        rightArm.zRot += 1.75F * throwing;
        leftArm.zRot -= 0.25F * throwing;
    }

    @Override
    public void renderToBuffer(PoseStack pose, VertexConsumer vertices, int light, int overlay,
                               float red, float green, float blue, float alpha) {
        if (!root.visible) return;
        pose.pushPose();
        root.translateAndRotate(pose);
        lowerBody.render(pose, vertices, light, overlay, red, green, blue, alpha);
        middleBody.render(pose, vertices, light, overlay, red, green, blue, alpha);
        buttons.render(pose, vertices, light, overlay, red * 0.07F, green * 0.065F, blue * 0.06F, alpha);
        scarf.render(pose, vertices, light, overlay, red * 0.85F, green * 0.055F, blue * 0.075F, alpha);
        rightArm.render(pose, vertices, light, overlay, red * 0.30F, green * 0.17F, blue * 0.075F, alpha);
        leftArm.render(pose, vertices, light, overlay, red * 0.30F, green * 0.17F, blue * 0.075F, alpha);
        if (head.visible) {
            pose.pushPose();
            head.translateAndRotate(pose);
            headSnow.render(pose, vertices, light, overlay, red, green, blue, alpha);
            faceCoal.render(pose, vertices, light, overlay, red * 0.07F, green * 0.065F, blue * 0.06F, alpha);
            carrot.render(pose, vertices, light, overlay, red, green * 0.38F, blue * 0.025F, alpha);
            pose.popPose();
        }
        pose.popPose();
    }
}
