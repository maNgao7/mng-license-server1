package com.tikmng.snowwar.game;

import com.tikmng.snowwar.SnowWar;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;

/** Opt-in native engine regression, run only with Gradle -ProundSmoke. */
public final class SnowWarRoundSmoke {
    private final boolean enabled = Boolean.getBoolean("mng.snowwar.roundSmoke");
    private final int[] joinCounts = {0, 1, 4, 5, 300};
    private int phase;
    private int caseIndex;
    private long phaseStarted = -1;
    private int frozenSecond;

    public void tick(MinecraftServer server, SnowWarEngine engine) {
        if (!enabled || phase < 0 || server.getTickCount() < 300) return;
        ServerPlayer host = server.getPlayerList().getPlayers().stream().findFirst().orElse(null);
        if (host == null) return;
        try {
            if (phaseStarted < 0) {
                engine.resetSession(host);
                engine.setWinnerDelaySeconds(10);
                host.getAbilities().mayfly = true;
                host.getAbilities().flying = true;
                host.onUpdateAbilities();
                phaseStarted = server.getTickCount();
            }
            long age = server.getTickCount() - phaseStarted;
            switch (phase) {
                case 0 -> {
                    require(!engine.state().running() && engine.state().startCountdownSeconds() == 0,
                        "autostart with " + joinCounts[caseIndex] + " joins");
                    if (age < 20) return;
                    engine.resetSession(host);
                    if (++caseIndex < joinCounts.length) {
                        join(host, engine, joinCounts[caseIndex]);
                        phaseStarted = server.getTickCount();
                    } else {
                        engine.join(host, "round-solo", "RoundSolo", "");
                        engine.start(host);
                        require(engine.state().startCountdownSeconds() == 10, "P must begin at 10");
                        next(server);
                    }
                }
                case 1 -> {
                    if (age == 40) engine.start(host);
                    if (age == 80) {
                        engine.stop(host);
                        frozenSecond = engine.state().startCountdownSeconds();
                    }
                    if (age >= 80 && age <= 100)
                        require(engine.state().startCountdownSeconds() == frozenSecond, "paused start timer advanced");
                    if (age == 100) engine.start(host);
                    if (age < 220) require(!engine.state().running(), "battle began before 200 active countdown ticks");
                    else {
                        require(engine.state().running(), "battle did not start at 200 active ticks");
                        engine.start(host);
                        require(engine.state().running() && engine.state().startCountdownSeconds() == 0, "P restarted running battle");
                        next(server);
                    }
                }
                case 2 -> {
                    require(engine.state().running() && engine.state().fighters().size() == 1,
                        "lone initial team awarded a fake win");
                    if (age < 240) return;
                    engine.join(host, "round-rival", "RoundRival", "");
                    next(server);
                }
                case 3 -> {
                    if (age < 10) return;
                    engine.applyAction(host, "HERKESI_DUSUR", "RoundSolo", "", 1);
                    next(server);
                }
                case 4 -> {
                    if (age == 100) engine.stop(host);
                    if (age == 120) engine.start(host);
                    if (age < 220) require(!engine.state().fighters().isEmpty(), "winner timer finished early or while paused");
                    else {
                        require(!engine.state().running() && engine.state().fighters().isEmpty()
                            && engine.state().startCountdownSeconds() == 0, "winner reset must wait for P");
                        join(host, engine, 300);
                        next(server);
                    }
                }
                case 5 -> {
                    require(!engine.state().running() && engine.state().startCountdownSeconds() == 0,
                        "300 new joins started the next round");
                    if (age < 60) return;
                    engine.start(host);
                    require(engine.state().startCountdownSeconds() == 10, "next round skipped its 10-second countdown");
                    next(server);
                }
                case 6 -> {
                    if (age < 200) require(!engine.state().running(), "next round started too early");
                    else {
                        require(engine.state().running(), "next round did not start after P countdown");
                        engine.resetSession(host);
                        host.setHealth(host.getMaxHealth());
                        SnowWar.LOGGER.info("MNG_ROUND_SMOKE_RESULT waiting0=true waiting1=true waiting4=true waiting5=true waiting300=true p10s=true idempotent=true pause=true soloNoWin=true contestedWinner10s=true winnerPause=true resetWait=true next300Wait=true nextP10s=true");
                        phase = -1;
                    }
                }
                default -> throw new IllegalStateException("unknown round smoke phase");
            }
        } catch (RuntimeException failure) {
            SnowWar.LOGGER.error("MNG_ROUND_SMOKE_RESULT failed phase={} reason={}", phase, failure.getMessage());
            engine.resetSession(host);
            phase = -1;
        }
    }

    private void next(MinecraftServer server) {
        phase++;
        phaseStarted = server.getTickCount();
    }

    private static void join(ServerPlayer host, SnowWarEngine engine, int count) {
        for (int i = 0; i < count; i++) engine.join(host, "round-" + i, "Round" + i, "");
    }

    private static void require(boolean value, String message) {
        if (!value) throw new IllegalStateException(message);
    }
}
