package com.tikmng.snowwar.game;

import net.minecraft.network.syncher.EntityDataAccessor;
import net.minecraft.network.syncher.EntityDataSerializers;
import net.minecraft.network.syncher.SynchedEntityData;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.PathfinderMob;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.level.Level;

public final class SnowFighterEntity extends PathfinderMob {
    private static final EntityDataAccessor<String> PROFILE = SynchedEntityData.defineId(SnowFighterEntity.class, EntityDataSerializers.STRING);
    private static final EntityDataAccessor<Integer> THROW_STARTED = SynchedEntityData.defineId(SnowFighterEntity.class, EntityDataSerializers.INT);
    private static final EntityDataAccessor<Float> VISUAL_SCALE = SynchedEntityData.defineId(SnowFighterEntity.class, EntityDataSerializers.FLOAT);
    private static final EntityDataAccessor<Boolean> AUDIENCE = SynchedEntityData.defineId(SnowFighterEntity.class, EntityDataSerializers.BOOLEAN);
    private static final EntityDataAccessor<Boolean> PARTICIPANT = SynchedEntityData.defineId(SnowFighterEntity.class, EntityDataSerializers.BOOLEAN);
    private static final EntityDataAccessor<Integer> LIKE_STARTED = SynchedEntityData.defineId(SnowFighterEntity.class, EntityDataSerializers.INT);
    private static final EntityDataAccessor<Integer> WEAPON_TIER = SynchedEntityData.defineId(SnowFighterEntity.class, EntityDataSerializers.INT);
    private static final EntityDataAccessor<Integer> HELMET_TIER = SynchedEntityData.defineId(SnowFighterEntity.class, EntityDataSerializers.INT);
    private static final EntityDataAccessor<Integer> VEST_TIER = SynchedEntityData.defineId(SnowFighterEntity.class, EntityDataSerializers.INT);
    private static final EntityDataAccessor<Boolean> SHIELDED = SynchedEntityData.defineId(SnowFighterEntity.class, EntityDataSerializers.BOOLEAN);
    private static final EntityDataAccessor<Boolean> PARACHUTING = SynchedEntityData.defineId(SnowFighterEntity.class, EntityDataSerializers.BOOLEAN);
    private static final EntityDataAccessor<Integer> ARMOR_HITS = SynchedEntityData.defineId(SnowFighterEntity.class, EntityDataSerializers.INT);
    private static final EntityDataAccessor<Integer> HEAL_STARTED = SynchedEntityData.defineId(SnowFighterEntity.class, EntityDataSerializers.INT);

    public SnowFighterEntity(EntityType<? extends PathfinderMob> type, Level level) {
        super(type, level);
    }

    public static AttributeSupplier.Builder attributes() {
        return createMobAttributes().add(Attributes.MAX_HEALTH, 100.0)
            .add(Attributes.MOVEMENT_SPEED, 0.31).add(Attributes.FOLLOW_RANGE, 192.0);
    }

    @Override
    protected void defineSynchedData() {
        super.defineSynchedData();
        entityData.define(PROFILE, "");
        entityData.define(THROW_STARTED, -1000);
        entityData.define(VISUAL_SCALE, 1.0F);
        entityData.define(AUDIENCE, false);
        entityData.define(PARTICIPANT, false);
        entityData.define(LIKE_STARTED, -1000);
        entityData.define(WEAPON_TIER, 0);
        entityData.define(HELMET_TIER, 0);
        entityData.define(VEST_TIER, 0);
        entityData.define(SHIELDED, false);
        entityData.define(PARACHUTING, false);
        entityData.define(ARMOR_HITS, 0);
        entityData.define(HEAL_STARTED, -1000);
    }

    public void setProfileUrl(String value) {
        entityData.set(PROFILE, value == null ? "" : value);
    }

    public String profileUrl() { return entityData.get(PROFILE); }

    public void beginThrow() { entityData.set(THROW_STARTED, (int)level().getGameTime()); }

    public float throwAnimationAge(float partialTick) {
        return (float)(level().getGameTime() - entityData.get(THROW_STARTED)) + partialTick;
    }

    public void setVisualScale(float value) { entityData.set(VISUAL_SCALE, Math.max(0.8F, Math.min(1.65F, value))); }
    public float visualScale() { return entityData.get(VISUAL_SCALE); }

    public void setAudience(boolean value) { entityData.set(AUDIENCE, value); }
    public boolean isAudience() { return entityData.get(AUDIENCE); }
    public void setParticipant(boolean value) { entityData.set(PARTICIPANT, value); }
    public boolean isParticipant() { return entityData.get(PARTICIPANT); }

    @Override public void addAdditionalSaveData(net.minecraft.nbt.CompoundTag tag) {
        super.addAdditionalSaveData(tag);
        tag.putBoolean("mng_royale_participant", isParticipant());
    }

    @Override public void readAdditionalSaveData(net.minecraft.nbt.CompoundTag tag) {
        super.readAdditionalSaveData(tag);
        setParticipant(tag.getBoolean("mng_royale_participant")
            || tag.getCompound("ForgeData").getBoolean("mng_royale_fighter"));
    }
    public void beginLike() { entityData.set(LIKE_STARTED, (int)level().getGameTime()); }
    public int weaponTier() { return entityData.get(WEAPON_TIER); }
    public void setWeaponTier(int value) { entityData.set(WEAPON_TIER, Math.max(0, Math.min(5, value))); }
    public int helmetTier() { return entityData.get(HELMET_TIER); }
    public void setHelmetTier(int value) { entityData.set(HELMET_TIER, Math.max(0, Math.min(4, value))); }
    public int vestTier() { return entityData.get(VEST_TIER); }
    public void setVestTier(int value) { entityData.set(VEST_TIER, Math.max(0, Math.min(4, value))); }
    public boolean shielded() { return entityData.get(SHIELDED); }
    public void setShielded(boolean value) { entityData.set(SHIELDED, value); }
    public boolean parachuting() { return entityData.get(PARACHUTING); }
    public void setParachuting(boolean value) { entityData.set(PARACHUTING, value); }
    public int armorHits() { return entityData.get(ARMOR_HITS); }
    public void setArmorHits(int value) { entityData.set(ARMOR_HITS, Math.max(0, Math.min(4, value))); }
    public void beginHeal() { entityData.set(HEAL_STARTED, (int)level().getGameTime()); }
    public float healAnimationAge(float partialTick) {
        return (float)(level().getGameTime() - entityData.get(HEAL_STARTED)) + partialTick;
    }

    @Override public void aiStep() {
        super.aiStep();
        int age = (int)(level().getGameTime() - entityData.get(LIKE_STARTED));
        if (level().isClientSide && isAudience() && age >= 0 && age < 24 && age % 3 == 0)
            level().addParticle(net.minecraft.core.particles.ParticleTypes.HEART,
                getX() + (random.nextDouble() - 0.5) * 0.6, getY() + 2.2 + age * 0.025,
                getZ() + (random.nextDouble() - 0.5) * 0.6, 0, 0.03, 0);
    }
}
