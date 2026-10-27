package com.tikmng.snowwar.game;

import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraftforge.registries.ForgeRegistries;

/** Creates real TaCZ weapons when the bundled gun mod is present, with a safe fallback. */
public final class BattleRoyaleWeapons {
    private static final String[] GUN_IDS = {
        "p320", "hk_mp5a5", "p90", "m4a1", "ak47", "ai_awp"
    };
    private static final String[] NAMES = {
        "P320 Tabanca", "MP5K", "P90", "M4A1", "AK-47", "AWM"
    };

    private BattleRoyaleWeapons() {}

    public static ItemStack create(int requestedTier, boolean host) {
        int tier = Math.max(0, Math.min(GUN_IDS.length - 1, requestedTier));
        Item taczGun = ForgeRegistries.ITEMS.getValue(ResourceLocation.fromNamespaceAndPath("tacz", "modern_kinetic_gun"));
        ItemStack stack;
        if (taczGun != null && taczGun != Items.AIR) {
            stack = new ItemStack(taczGun);
            stack.getOrCreateTag().putString("GunId", "tacz:" + GUN_IDS[tier]);
            stack.getOrCreateTag().putString("GunDisplayId", "tacz:" + GUN_IDS[tier] + "_display");
            stack.getOrCreateTag().putInt("GunCurrentAmmoCount", magazineSize(tier) - 1);
            stack.getOrCreateTag().putInt("DummyAmmo", 1_000_000);
            stack.getOrCreateTag().putInt("MaxDummyAmmo", 1_000_000);
            stack.getOrCreateTag().putBoolean("HasBulletInBarrel", true);
            stack.getOrCreateTag().putString("GunFireMode", tier == 0 || tier == 5 ? "SEMI" : "AUTO");
            stack.getOrCreateTag().putBoolean("mng_tacz_weapon", true);
        } else {
            stack = new ItemStack(switch (tier) {
                case 1, 2 -> Items.CROSSBOW;
                case 3 -> Items.IRON_HOE;
                case 4, 5 -> Items.NETHERITE_HOE;
                default -> Items.WOODEN_HOE;
            });
        }
        stack.getOrCreateTag().putBoolean("mng_royale_weapon", true);
        stack.getOrCreateTag().putBoolean("mng_host_weapon", host);
        stack.getOrCreateTag().putInt("mng_weapon_tier", tier);
        stack.setHoverName(Component.literal(NAMES[tier] + (host ? " - Sınırsız Mermi" : "")));
        return stack;
    }

    public static String name(int tier) {
        return NAMES[Math.max(0, Math.min(NAMES.length - 1, tier))];
    }

    public static ResourceLocation icon(int tier) {
        return ResourceLocation.fromNamespaceAndPath("tacz", "textures/gun/slot/" + GUN_IDS[Math.max(0, Math.min(5, tier))] + ".png");
    }

    public static int magazineSize(int tier) { return tier == 0 ? 6 : tier == 5 ? 5 : 30; }

    public static void maintainMagazine(LivingEntity player) {
        ItemStack held = player.getMainHandItem();
        if (!held.hasTag() || !held.getTag().getBoolean("mng_tacz_weapon")) return;
        var tag = held.getTag();
        int capacity = magazineSize(tag.getInt("mng_weapon_tier"));
        int chamber = tag.getBoolean("HasBulletInBarrel") ? 1 : 0;
        int ammo = tag.getInt("GunCurrentAmmoCount");
        if (ammo + chamber > capacity) tag.putInt("GunCurrentAmmoCount", capacity - chamber);
        if (ammo + chamber > 0 || player.tickCount % 10 != 0) return;
        try {
            Class<?> api = Class.forName("com.tacz.guns.api.entity.IGunOperator");
            Object operator = api.getMethod("fromLivingEntity", LivingEntity.class).invoke(null, player);
            Object reloadState = api.getMethod("getSynReloadState").invoke(operator);
            Object stateType = reloadState.getClass().getMethod("getStateType").invoke(reloadState);
            if ((boolean)stateType.getClass().getMethod("isReloading").invoke(stateType)) return;
            api.getMethod("reload").invoke(operator);
        } catch (ReflectiveOperationException error) {
            com.tikmng.snowwar.SnowWar.LOGGER.warn("Automatic magazine reload failed", error);
        }
    }

    public static ResourceLocation shotSound(int tier) {
        String path = switch (Math.max(0, Math.min(5, tier))) {
            case 1 -> "hk_mp5a5/hk_mp5a5_shoot_3p";
            case 2 -> "p90/p90_shoot_3p";
            case 3 -> "m4a1/m4a1_shoot_3p";
            case 4 -> "ak47/ak47_shoot_3p";
            case 5 -> "ai_awp/awp_shoot_3p";
            default -> "p320/p320_shoot_3p";
        };
        return ResourceLocation.fromNamespaceAndPath("tacz", path);
    }

    public static void playShot(LivingEntity shooter, int requestedTier) {
        int tier = Math.max(0, Math.min(GUN_IDS.length - 1, requestedTier));
        try {
            Class<?> manager = Class.forName("com.tacz.guns.sound.SoundManager");
            manager.getMethod("sendSoundToNearby", LivingEntity.class, int.class, ResourceLocation.class,
                    ResourceLocation.class, String.class, float.class, float.class)
                .invoke(null, shooter, 180,
                    ResourceLocation.fromNamespaceAndPath("tacz", GUN_IDS[tier]),
                    ResourceLocation.fromNamespaceAndPath("tacz", GUN_IDS[tier] + "_display"),
                    "shoot_3p", tier == 5 ? 1.45F : 1.0F, 1.0F);
            return;
        } catch (ReflectiveOperationException ignored) {
            // TaCZ is optional in development builds; retain an audible fallback.
        }
        shooter.level().playSound(null, shooter.blockPosition(),
            tier == 5 ? SoundEvents.GENERIC_EXPLODE : SoundEvents.CROSSBOW_SHOOT,
            SoundSource.PLAYERS, tier == 5 ? 4.0F : 2.2F, tier == 5 ? 0.7F : 0.9F);
    }
}
