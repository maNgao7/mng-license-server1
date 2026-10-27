package com.tikmng.snowwar.client;

import com.tikmng.snowwar.game.SnowFighterEntity;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.util.Mth;

public final class SnowFighterModel extends PlayerModel<SnowFighterEntity> {
    public SnowFighterModel(ModelPart root) { super(root, false); }

    @Override public void setupAnim(SnowFighterEntity entity, float walk, float speed,
                                    float age, float yaw, float pitch) {
        super.setupAnim(entity, walk, speed, age, yaw, pitch);
        float elapsed = entity.throwAnimationAge(age - entity.tickCount);
        if (!entity.parachuting() && !entity.getMainHandItem().isEmpty()) {
            float aimPitch = -1.28F + pitch * Mth.DEG_TO_RAD;
            rightArm.xRot = aimPitch;
            rightArm.yRot = -0.16F;
            rightArm.zRot = 0.02F;
            leftArm.xRot = aimPitch + 0.12F;
            leftArm.yRot = 0.48F;
            leftArm.zRot = -0.08F;
            rightSleeve.copyFrom(rightArm);
            leftSleeve.copyFrom(leftArm);
        } else if (entity.parachuting()) {
            rightArm.xRot = -2.55F;
            rightArm.zRot = 0.44F;
            leftArm.xRot = -2.55F;
            leftArm.zRot = -0.44F;
            rightSleeve.copyFrom(rightArm);
            leftSleeve.copyFrom(leftArm);
        }
        if (elapsed >= 0 && elapsed < 18) {
            float phase = elapsed < 10 ? elapsed / 10 : 1 - (elapsed - 10) / 8;
            rightArm.xRot -= 0.22F * phase;
            rightArm.yRot -= 0.12F * phase;
            leftArm.xRot -= 0.12F * phase;
            rightSleeve.copyFrom(rightArm);
            leftSleeve.copyFrom(leftArm);
        }
    }
}
