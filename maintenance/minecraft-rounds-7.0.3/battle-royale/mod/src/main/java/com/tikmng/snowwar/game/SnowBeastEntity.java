package com.tikmng.snowwar.game;

import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.animal.IronGolem;
import net.minecraft.world.level.Level;
import net.minecraft.network.syncher.EntityDataAccessor;
import net.minecraft.network.syncher.EntityDataSerializers;
import net.minecraft.network.syncher.SynchedEntityData;
import net.minecraft.world.entity.Pose;
import net.minecraft.world.entity.EntityDimensions;

public final class SnowBeastEntity extends IronGolem {
    private float collisionScale = 1.0F;
    private static final EntityDataAccessor<String> PROFILE = SynchedEntityData.defineId(
        SnowBeastEntity.class, EntityDataSerializers.STRING);
    private static final EntityDataAccessor<Float> RENDER_SCALE = SynchedEntityData.defineId(
        SnowBeastEntity.class, EntityDataSerializers.FLOAT);
    private static final EntityDataAccessor<Integer> THROW_STARTED = SynchedEntityData.defineId(
        SnowBeastEntity.class, EntityDataSerializers.INT);

    public SnowBeastEntity(EntityType<? extends IronGolem> type, Level level) {
        super(type, level);
        setSilent(true);
    }

    @Override protected void registerGoals() { }

    @Override protected void defineSynchedData() {
        super.defineSynchedData();
        entityData.define(PROFILE, "");
        entityData.define(RENDER_SCALE, 1.0F);
        entityData.define(THROW_STARTED, -1000);
    }

    public void setProfileUrl(String value) { entityData.set(PROFILE, value == null ? "" : value); }
    public String profileUrl() { return entityData.get(PROFILE); }
    public void setRenderScale(float value) {
        float safe = Math.max(0.8F, Math.min(4.0F, value));
        entityData.set(RENDER_SCALE, safe);
        collisionScale = Math.min(1.5F, safe);
        refreshDimensions();
    }
    public float renderScale() { return entityData.get(RENDER_SCALE); }
    @Override public EntityDimensions getDimensions(Pose pose) {
        return super.getDimensions(pose).scale(collisionScale);
    }
    public void beginThrow() { entityData.set(THROW_STARTED, (int)level().getGameTime()); }
    public float throwAnimationAge(float partialTick) {
        return (float)(level().getGameTime() - entityData.get(THROW_STARTED)) + partialTick;
    }

    @Override public void aiStep() {
        super.aiStep();
        if (level().isClientSide && tickCount % 3 == 0)
            level().addParticle(net.minecraft.core.particles.ParticleTypes.SNOWFLAKE,
                getRandomX(0.8), getY() + random.nextFloat() * 3.5, getRandomZ(0.8), 0, 0.02, 0);
    }
}
