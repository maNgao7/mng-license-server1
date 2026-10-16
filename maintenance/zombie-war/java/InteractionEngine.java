package com.tikmng.zombiestrike;

import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.network.chat.Component;
import java.util.*;

/** Integrated-server game actions. Live and test events enter the same dispatcher. */
public final class InteractionEngine {
    private static final EventCounter counters = new EventCounter();
    public static void reset() { counters.clear(); }
    public static void event(ServerPlayer player, String trigger, int count, GameState.Viewer viewer) {
        if (GameState.roundEnded || !player.isAlive()) return;
        GameConfig.Rule rule = GameConfig.get().rule(trigger);
        long times = counters.add(trigger, viewer.name(), Math.min(10000, count), rule.threshold());
        if (times > 0 && rule.action() != GameConfig.Action.NONE)
            perform(player, rule.action(), (int)Math.min(1000, times * Math.max(1, rule.amount())), rule.safeTarget(), viewer);
    }
    public static void perform(ServerPlayer p, GameConfig.Action action, int amount, String target, GameState.Viewer viewer) {
        if (GameState.roundEnded || !p.isAlive()) return;
        int n = Math.max(1, Math.min(1000, amount));
        switch (action) {
            case ZOMBIE -> SpawnManager.queue(p, Math.min(100, n), viewer, false, target);
            case STRONG_ZOMBIE -> SpawnManager.queue(p, Math.min(20, n), viewer, true, target.equals("zombie") ? "mutant" : target);
            case CHAOS -> MobCatalog.HOSTILES.forEach(entry -> SpawnManager.queue(p, 1, viewer, entry.boss(), entry.key()));
            case HEAL -> p.heal(n);
            case DAMAGE -> p.hurt(p.damageSources().magic(), n);
            case UPGRADE -> WeaponManager.shift(p, 1);
            case DOWNGRADE -> WeaponManager.shift(p, -1);
            case AMMO -> WeaponManager.refill(p);
            case CLEAR -> SpawnManager.clear(p.server);
            case FLASH -> {
                int duration = Math.min(3600, n * 20);
                if (GameState.flashTicks <= 0) {
                    GameState.flashTicks = duration;
                    p.addEffect(new net.minecraft.world.effect.MobEffectInstance(net.minecraft.world.effect.MobEffects.BLINDNESS, duration));
                }
            }
            case SHIELD -> {
                int duration = Math.min(3600, n * 20);
                p.addEffect(new net.minecraft.world.effect.MobEffectInstance(net.minecraft.world.effect.MobEffects.ABSORPTION, duration, 3));
                p.addEffect(new net.minecraft.world.effect.MobEffectInstance(net.minecraft.world.effect.MobEffects.DAMAGE_RESISTANCE, duration, 1));
            }
            case DRAGON -> {
                GameState.nightTicks = Math.max(GameState.nightTicks, 60 * 20);
                SpawnManager.queue(p, 1, viewer, true, "dragon");
            }
            case INFINITE -> p.getPersistentData().putLong("mng_infinite_until", p.serverLevel().getGameTime() + Math.min(300, n) * 20L);
            case VOICE_FIRE -> GameState.addVoiceFireSeconds(n);
            case HELPER -> {
                int existing = p.serverLevel().getEntitiesOfClass(net.minecraft.world.entity.animal.IronGolem.class, p.getBoundingBox().inflate(80)).size();
                int helperCount = target.equals("timed") ? 1 : n;
                for (int i = 0; i < Math.min(helperCount, Math.max(0, 5 - existing)); i++) {
                    var helper = EntityType.IRON_GOLEM.create(p.serverLevel());
                    if (helper == null) continue;
                    helper.moveTo(p.getX() + i + 2, p.getY(), p.getZ(), 0, 0);
                    if (!p.serverLevel().noCollision(helper)) continue;
                    helper.setPlayerCreated(true); helper.addTag("mng_helper");
                    helper.setItemSlot(net.minecraft.world.entity.EquipmentSlot.MAINHAND, new net.minecraft.world.item.ItemStack(net.minecraft.world.item.Items.IRON_SWORD));
                    helper.setCustomName(Component.literal("Silahlı Koruyucu · @" + viewer.name())); helper.setCustomNameVisible(true);
                    helper.getPersistentData().putString("mng_viewer", viewer.name());
                    helper.getPersistentData().putString("mng_profile", viewer.profile());
                    if (target.equals("timed")) helper.getPersistentData().putLong("mng_remove_at", p.serverLevel().getGameTime() + n * 20L);
                    GameState.viewers.put(helper.getUUID(), viewer);
                    p.serverLevel().addFreshEntity(helper);
                }
            }
            default -> { return; }
        }
        GameState.notify("@" + viewer.name() + " · " + action.label, 70);
    }
    public static void health(ServerPlayer p) {
        var attribute = p.getAttribute(Attributes.MAX_HEALTH);
        if (attribute != null) attribute.setBaseValue(GameConfig.get().maxHealth);
        p.setHealth(Math.min(p.getHealth(), p.getMaxHealth()));
    }
}
