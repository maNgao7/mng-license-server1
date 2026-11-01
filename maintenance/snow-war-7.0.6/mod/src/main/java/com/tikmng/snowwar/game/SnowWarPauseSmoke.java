package com.tikmng.snowwar.game;

import com.tikmng.snowwar.SnowWar;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.phys.Vec3;

/** Opt-in native regression, isolated in mod/run. */
public final class SnowWarPauseSmoke {
    private final boolean enabled = Boolean.getBoolean("mng.snowwar.pauseSmoke");
    private final java.util.Map<java.util.UUID, Vec3> positions = new java.util.HashMap<>();
    private final java.util.Map<java.util.UUID, Float> health = new java.util.HashMap<>();
    private int phase;
    private long since = -1;
    private long shots;
    private int frozen;
    private Vec3 hostPosition;

    public void tick(MinecraftServer server, SnowWarEngine engine) {
        if (!enabled || phase < 0 || server.getTickCount() < 300) return;
        ServerPlayer host = server.getPlayerList().getPlayers().stream().findFirst().orElse(null);
        if (host == null) return;
        try {
            if (since < 0) {
                engine.resetSession(host);
                engine.setWinnerDelaySeconds(10);
                host.getAbilities().mayfly = true; host.getAbilities().flying = true; host.onUpdateAbilities();
                engine.join(host, "pause-solo", "PauseSolo", "");
                since = server.getTickCount();
            }
            long age = server.getTickCount() - since;
            switch (phase) {
                case 0 -> {
                    require(!engine.state().started(), "joined viewer started battle without P");
                    if (age < 40) return;
                    toggle(server, host); require(engine.state().startCountdownSeconds() == 10, "P starts at 10"); next(server);
                }
                case 1 -> {
                    if (age == 40) { toggle(server, host); frozen = engine.state().startCountdownSeconds(); }
                    if (age >= 40 && age <= 80) require(engine.state().paused()
                        && engine.state().startCountdownSeconds() == frozen, "preparation did not freeze");
                    if (age == 80) toggle(server, host);
                    if (age < 240) require(!engine.state().running(), "preparation completed early");
                    else { require(engine.state().running(), "preparation did not resume"); next(server); }
                }
                case 2 -> {
                    require(engine.state().running() && engine.winnerCountdownSeconds() == 0, "initial solo must not win");
                    if (age < 220) return;
                    engine.join(host, "pause-rival", "PauseRival", "");
                    int offset = 0;
                    for (LivingEntity mob : combatants(host)) {
                        mob.getAttribute(Attributes.MAX_HEALTH).setBaseValue(10000); mob.setHealth(10000);
                        mob.teleportTo(-8 + offset++ * 16, host.getY(), 0);
                    }
                    next(server);
                }
                case 3 -> {
                    if (age < 60) return;
                    require(engine.snowballsThrown() > 0, "no native combat shots");
                    toggle(server, host); require(engine.state().paused(), "P did not pause battle");
                    shots = engine.snowballsThrown();
                    for (LivingEntity mob : combatants(host)) {
                        positions.put(mob.getUUID(), mob.position()); health.put(mob.getUUID(), mob.getHealth());
                    }
                    hostPosition = host.position(); next(server);
                }
                case 4 -> {
                    require(engine.state().paused() && engine.snowballsThrown() == shots, "paused shots advanced");
                    for (LivingEntity mob : combatants(host)) {
                        require(mob.position().distanceToSqr(positions.get(mob.getUUID())) < 0.000001, "paused fighter moved");
                        require(mob.getHealth() == health.get(mob.getUUID()), "paused fighter lost health");
                    }
                    if (age == 10) {
                        net.minecraft.client.Minecraft.getInstance().execute(() ->
                            net.minecraft.client.Minecraft.getInstance().options.keyRight.setDown(true));
                        engine.throwPlayerSnowball(host);
                    }
                    if (age == 30) net.minecraft.client.Minecraft.getInstance().execute(() ->
                        net.minecraft.client.Minecraft.getInstance().options.keyRight.setDown(false));
                    if (age < 80) return;
                    require(host.position().distanceToSqr(hostPosition) > 0.01, "host cannot move while paused");
                    toggle(server, host); next(server);
                }
                case 5 -> {
                    if (age < 60) return;
                    require(engine.state().running() && engine.snowballsThrown() > shots, "combat did not resume");
                    engine.applyAction(host, "HERKESI_DUSUR", "PauseSolo", "", 1); next(server);
                }
                case 6 -> {
                    require(engine.winnerCountdownSeconds() > 0, "sole team did not open winner countdown");
                    if (age < 60) return;
                    engine.join(host, "pause-new", "PauseNew", "");
                    require(engine.winnerCountdownSeconds() == 0, "new rival did not cancel countdown"); next(server);
                }
                case 7 -> {
                    if (age < 2) return;
                    engine.applyAction(host, "HERKESI_DUSUR", "PauseSolo", "", 1);
                    require(engine.winnerCountdownSeconds() == 10, "renewed sole team needs fresh 10 seconds"); next(server);
                }
                case 8 -> {
                    if (age < 40) return;
                    toggle(server, host); frozen = engine.winnerCountdownSeconds(); next(server);
                }
                case 9 -> {
                    require(engine.state().paused() && engine.winnerCountdownSeconds() == frozen, "winner advanced while paused");
                    if (age < 60) return;
                    toggle(server, host); next(server);
                }
                case 10 -> {
                    if (age < 160) require(engine.state().running(), "winner finished early");
                    else {
                        require(!engine.state().started() && engine.state().fighters().isEmpty(), "winner reset did not wait for P");
                        for (int i = 0; i < 300; i++) engine.join(host, "next-" + i, "Next" + i, "");
                        next(server);
                    }
                }
                case 11 -> {
                    require(!engine.state().started() && engine.winnerCountdownSeconds() == 0, "next 300 joins autostarted");
                    if (age < 60) return;
                    toggle(server, host); require(engine.state().startCountdownSeconds() == 10, "next P skipped countdown");
                    finish(server, host, engine, "passed pToggle preparationFreeze movementFreeze healthFreeze shotsFreeze hostMoves resumeCombat soloNoWin rivalCancelsWinner winner10s winnerFreeze resetWait next300Wait nextP10s");
                }
                default -> throw new IllegalStateException("unknown phase");
            }
        } catch (RuntimeException failure) {
            finish(server, host, engine, "failed phase=" + phase + " reason=" + failure.getMessage());
        }
    }
    private void finish(MinecraftServer server, ServerPlayer host, SnowWarEngine engine, String result) {
        SnowWar.LOGGER.info("MNG_PAUSE_SMOKE_RESULT {}", result); engine.resetSession(host); phase = -1;
        net.minecraft.client.Minecraft.getInstance().execute(() -> {
            net.minecraft.client.Minecraft.getInstance().options.keyRight.setDown(false);
            net.minecraft.client.Minecraft.getInstance().stop();
        });
    }
    private void next(MinecraftServer server) { phase++; since = server.getTickCount(); }
    private static void toggle(MinecraftServer server, ServerPlayer host) {
        server.getCommands().performPrefixedCommand(host.createCommandSourceStack(), "snowwar toggle");
    }
    private static java.util.List<LivingEntity> combatants(ServerPlayer host) {
        return host.serverLevel().getEntitiesOfClass(LivingEntity.class,
            new net.minecraft.world.phys.AABB(-110, -64, -110, 110, 320, 110),
            e -> e.isAlive() && SnowWarEngine.isArenaCombatant(e));
    }
    private static void require(boolean value, String message) { if (!value) throw new IllegalStateException(message); }
}
