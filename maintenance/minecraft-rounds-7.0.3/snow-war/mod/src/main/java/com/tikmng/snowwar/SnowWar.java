package com.tikmng.snowwar;

import com.mojang.logging.LogUtils;
import com.tikmng.snowwar.game.SnowWarCommands;
import com.tikmng.snowwar.game.SnowWarEngine;
import com.tikmng.snowwar.game.SnowWarArenaBuilder;
import com.tikmng.snowwar.game.SnowFighterEntity;
import com.tikmng.snowwar.game.SnowBeastEntity;
import com.tikmng.snowwar.game.SnowWarSounds;
import com.tikmng.snowwar.game.SnowWarCombatSmoke;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.event.RegisterCommandsEvent;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.event.entity.player.PlayerEvent;
import net.minecraftforge.event.entity.ProjectileImpactEvent;
import net.minecraft.world.entity.projectile.Snowball;
import net.minecraft.world.phys.EntityHitResult;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.level.GameType;
import net.minecraft.network.chat.Component;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.event.entity.EntityAttributeCreationEvent;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.MobCategory;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraftforge.fml.common.Mod;
import org.slf4j.Logger;

@Mod(SnowWar.MOD_ID)
public final class SnowWar {
    public static final String MOD_ID = "mng_snow_war";
    public static final Logger LOGGER = LogUtils.getLogger();
    private static final DeferredRegister<EntityType<?>> ENTITIES = DeferredRegister.create(ForgeRegistries.ENTITY_TYPES, MOD_ID);
    public static final RegistryObject<EntityType<SnowFighterEntity>> FIGHTER = ENTITIES.register("fighter", () ->
        EntityType.Builder.of(SnowFighterEntity::new, MobCategory.CREATURE).sized(0.6F, 1.8F)
            .clientTrackingRange(10).build(MOD_ID + ":fighter"));
    public static final RegistryObject<EntityType<SnowBeastEntity>> BEAST = ENTITIES.register("ice_beast", () ->
        EntityType.Builder.of(SnowBeastEntity::new, MobCategory.CREATURE).sized(1.95F, 3.8F)
            .clientTrackingRange(12).build(MOD_ID + ":ice_beast"));
    private final SnowWarEngine engine = new SnowWarEngine();
    private final SnowWarArenaBuilder arenaBuilder = new SnowWarArenaBuilder();
    private final SnowWarCombatSmoke combatSmoke = new SnowWarCombatSmoke();
    private final com.tikmng.snowwar.client.GiftActionSmoke giftSmoke = new com.tikmng.snowwar.client.GiftActionSmoke();
    private final com.tikmng.snowwar.game.SnowWarPauseSmoke pauseSmoke = new com.tikmng.snowwar.game.SnowWarPauseSmoke();
    private final com.tikmng.snowwar.game.SnowWarRoundSmoke roundSmoke = new com.tikmng.snowwar.game.SnowWarRoundSmoke();
    private final com.tikmng.snowwar.game.SnowWarPowerSmoke powerSmoke = new com.tikmng.snowwar.game.SnowWarPowerSmoke();

    public SnowWar() {
        ENTITIES.register(FMLJavaModLoadingContext.get().getModEventBus());
        SnowWarSounds.REGISTER.register(FMLJavaModLoadingContext.get().getModEventBus());
        FMLJavaModLoadingContext.get().getModEventBus().addListener(this::attributes);
        MinecraftForge.EVENT_BUS.register(this);
        LOGGER.info("TikMnG Kar Topu Savaşı yüklendi");
    }

    private void attributes(EntityAttributeCreationEvent event) {
        event.put(FIGHTER.get(), SnowFighterEntity.attributes().build());
        event.put(BEAST.get(), net.minecraft.world.entity.animal.IronGolem.createAttributes().build());
    }

    @SubscribeEvent
    public void registerCommands(RegisterCommandsEvent event) {
        SnowWarCommands.register(event.getDispatcher(), engine);
    }

    @SubscribeEvent
    public void serverTick(TickEvent.ServerTickEvent event) {
        if (event.phase == TickEvent.Phase.END) {
            engine.tick(event.getServer());
            arenaBuilder.tick();
            combatSmoke.tick(event.getServer(), engine);
            giftSmoke.tick(event.getServer(), engine);
            roundSmoke.tick(event.getServer(), engine);
            pauseSmoke.tick(event.getServer(), engine);
            powerSmoke.tick(event.getServer(), engine);
            if (event.getServer().getTickCount() % 100 == 0) arenaBuilder.sweep();
            for (var level : event.getServer().getAllLevels()) {
                for (var entity : level.getAllEntities()) {
                    if (!(entity instanceof Snowball snowball)) continue;
                    var motion = snowball.getDeltaMovement();
                    for (int trail = 1; trail <= 3; trail++) {
                        double offset = trail * 0.34;
                        level.sendParticles(ParticleTypes.SNOWFLAKE,
                            snowball.getX() - motion.x * offset, snowball.getY() - motion.y * offset,
                            snowball.getZ() - motion.z * offset, 2, 0.045, 0.045, 0.045, 0.002);
                    }
                }
            }
        }
    }

    @SubscribeEvent
    public void freezeCombatants(net.minecraftforge.event.entity.living.LivingEvent.LivingTickEvent event) {
        if (!event.getEntity().level().isClientSide && engine.freezeLiving(event.getEntity())) {
            event.getEntity().setDeltaMovement(net.minecraft.world.phys.Vec3.ZERO);
            event.setCanceled(true);
        }
    }

    @SubscribeEvent
    public void preventPausedDamage(net.minecraftforge.event.entity.living.LivingAttackEvent event) {
        if (!event.getEntity().level().isClientSide && !engine.state().running()
                && (SnowWarEngine.isArenaCombatant(event.getEntity()) || event.getEntity() instanceof Player))
            event.setCanceled(true);
    }

    @SubscribeEvent
    public void playerJoin(PlayerEvent.PlayerLoggedInEvent event) {
        if (event.getEntity() instanceof net.minecraft.server.level.ServerPlayer player) {
            engine.setTimeMode(player.getServer(), "sunset");
            player.setGameMode(GameType.SURVIVAL);
            player.getAbilities().invulnerable = false;
            player.onUpdateAbilities();
            arenaBuilder.startIfNeeded(player);
            engine.resetSession(player);
            if (player.getInventory().countItem(Items.SNOWBALL) == 0) {
                player.getInventory().add(new ItemStack(Items.SNOWBALL, 64));
            }
            if (player.getAttribute(Attributes.MAX_HEALTH) != null) {
                float configuredHealth = player.getPersistentData().contains("mng_player_health")
                    ? player.getPersistentData().getFloat("mng_player_health") : 35.0F;
                if (configuredHealth == 25.0F || configuredHealth == 40.0F) configuredHealth = 35.0F;
                player.getPersistentData().putFloat("mng_player_health", configuredHealth);
                player.getAttribute(Attributes.MAX_HEALTH).setBaseValue(configuredHealth);
                player.setHealth(configuredHealth);
            }
            equipWhiteArmor(player);
        }
    }

    @SubscribeEvent
    public void playerTick(TickEvent.PlayerTickEvent event) {
        if (event.phase == TickEvent.Phase.END && event.player instanceof net.minecraft.server.level.ServerPlayer player) {
            SnowWarArenaBuilder.leaveSnowTracks(player);
            if (player.isAlive()) {
                ItemStack held = player.getMainHandItem();
                boolean gun = player.serverLevel().getGameTime()
                    < player.getPersistentData().getLong("mng_snow_gun_until");
                boolean holdingGun = held.hasTag() && held.getTag().getBoolean("mng_snow_gun");
                if (gun && !holdingGun) {
                    ItemStack weapon = new ItemStack(Items.CROSSBOW);
                    weapon.getOrCreateTag().putBoolean("mng_snow_gun", true);
                    weapon.setHoverName(Component.literal("Sınırsız Kartopu Silahı"));
                    player.setItemInHand(net.minecraft.world.InteractionHand.MAIN_HAND, weapon);
                }
                else if (!gun && (held.isEmpty() || !held.is(Items.SNOWBALL))) {
                    player.setItemInHand(net.minecraft.world.InteractionHand.MAIN_HAND, new ItemStack(Items.SNOWBALL, 16));
                }
                else if (!gun && held.is(Items.SNOWBALL) && held.getCount() != 16) {
                    held.setCount(16);
                }
            }
            long protectedUntil = player.getPersistentData().getLong("mng_spawn_protected_until");
            boolean protectedNow = player.serverLevel().getGameTime() < protectedUntil;
            if (player.getAbilities().invulnerable != protectedNow) {
                player.getAbilities().invulnerable = protectedNow;
                player.onUpdateAbilities();
            }
        }
    }

    @SubscribeEvent
    public void preventSnowballDrop(net.minecraftforge.event.entity.item.ItemTossEvent event) {
        ItemStack item = event.getEntity().getItem();
        if (item.is(Items.SNOWBALL) || (item.hasTag() && item.getTag().getBoolean("mng_snow_gun"))) event.setCanceled(true);
    }

    @SubscribeEvent
    public void playerRespawn(PlayerEvent.PlayerRespawnEvent event) {
        if (!(event.getEntity() instanceof net.minecraft.server.level.ServerPlayer player)) return;
        player.getPersistentData().putLong("mng_spawn_protected_until", player.serverLevel().getGameTime() + 200L);
        player.getAbilities().invulnerable = true;
        player.onUpdateAbilities();
        if (player.getAttribute(Attributes.MAX_HEALTH) != null) {
            float configuredHealth = player.getPersistentData().contains("mng_player_health")
                ? player.getPersistentData().getFloat("mng_player_health") : 35.0F;
            player.getAttribute(Attributes.MAX_HEALTH).setBaseValue(configuredHealth);
            player.setHealth(configuredHealth);
        }
        if (player.getInventory().countItem(Items.SNOWBALL) == 0)
            player.getInventory().add(new ItemStack(Items.SNOWBALL, 64));
        equipWhiteArmor(player);
        player.displayClientMessage(Component.literal("10 saniyelik yeniden doğuş koruması aktif."), true);
    }

    private static void equipWhiteArmor(net.minecraft.server.level.ServerPlayer player) {
        equipWhite(player, EquipmentSlot.HEAD, Items.LEATHER_HELMET);
        equipWhite(player, EquipmentSlot.CHEST, Items.LEATHER_CHESTPLATE);
        equipWhite(player, EquipmentSlot.LEGS, Items.LEATHER_LEGGINGS);
        equipWhite(player, EquipmentSlot.FEET, Items.LEATHER_BOOTS);
    }

    private static void equipWhite(net.minecraft.server.level.ServerPlayer player, EquipmentSlot slot,
                                   net.minecraft.world.item.Item item) {
        ItemStack armor = new ItemStack(item);
        armor.getOrCreateTagElement("display").putInt("color", 0xF4FCFF);
        armor.getOrCreateTag().putBoolean("mng_snow_armor", true);
        armor.setHoverName(Component.literal("Kar Zırhı"));
        player.setItemSlot(slot, armor);
    }

    @SubscribeEvent
    public void snowballHit(ProjectileImpactEvent event) {
        if (!(event.getProjectile() instanceof Snowball snowball) || snowball.level().isClientSide) return;
        if (!(event.getRayTraceResult() instanceof EntityHitResult hit)
                || !(hit.getEntity() instanceof LivingEntity target)
                || !(target.getPersistentData().getBoolean("mng_snow_fighter")
                    || target.getPersistentData().getBoolean("mng_snow_boss") || target instanceof Player)) return;
        event.setCanceled(true);
        engine.hitBySnowball(snowball, target);
        snowball.discard();
    }
}
