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
        if (elapsed >= 0 && elapsed < 18) {
            float phase = elapsed < 10 ? elapsed / 10 : 1 - (elapsed - 10) / 8;
            rightArm.xRot = elapsed < 10 ? -Mth.PI * (0.45F + 0.45F * phase) : -Mth.PI * 0.5F * phase;
            rightArm.yRot = -0.22F * phase;
            rightArm.zRot = 0.2F * phase;
            leftArm.xRot = -0.3F * phase;
            rightSleeve.copyFrom(rightArm);
            leftSleeve.copyFrom(leftArm);
        }
    }
}
