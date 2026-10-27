package com.tikmng.snowwar.client;

import com.tikmng.snowwar.game.SnowWarSounds;
import net.minecraft.client.Minecraft;
import net.minecraft.client.resources.sounds.AbstractTickableSoundInstance;
import net.minecraft.client.resources.sounds.SoundInstance;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.RandomSource;

public final class SnowWarAudio {
    private static Loop music;

    private SnowWarAudio() { }

    public static void playWinner() {
        Minecraft.getInstance().getSoundManager().play(new net.minecraft.client.resources.sounds.SimpleSoundInstance(
            SnowWarSounds.WINNER.get().getLocation(), SoundSource.MASTER,
            SnowWarClientConfig.get().effectVolume / 100.0F, 1.0F, RandomSource.create(),
            false, 0, SoundInstance.Attenuation.NONE, 0, 0, 0, true));
    }

    public static void update(boolean inAircraftLobby) {
        Minecraft mc = Minecraft.getInstance();
        if (!shouldPlay(inAircraftLobby, mc.level != null && mc.player != null,
                SnowWarClientConfig.get().musicVolume)) {
            if (music != null) {
                music.finish(); mc.getSoundManager().stop(music);
                if (Boolean.getBoolean("mng.royale.smoke")) com.tikmng.snowwar.SnowWar.LOGGER.info("MNG_LOBBY_MUSIC stopped");
            }
            music = null;
            return;
        }
        if (music == null || music.isStopped()) {
            music = new Loop(SnowWarSounds.LOBBY_MUSIC.get());
            mc.getSoundManager().play(music);
            if (Boolean.getBoolean("mng.royale.smoke")) com.tikmng.snowwar.SnowWar.LOGGER.info("MNG_LOBBY_MUSIC started volume={}",SnowWarClientConfig.get().musicVolume);
        }
    }

    static boolean shouldPlay(boolean inAircraftLobby, boolean inWorld, int volume) {
        return inAircraftLobby && inWorld && volume > 0;
    }

    private static final class Loop extends AbstractTickableSoundInstance {
        private Loop(SoundEvent sound) {
            super(sound, SoundSource.MASTER, RandomSource.create());
            looping = true;
            relative = true;
            attenuation = SoundInstance.Attenuation.NONE;
            delay = 0;
            tick();
        }

        @Override public void tick() {
            if (Minecraft.getInstance().level == null) { stop(); return; }
            SnowWarClientConfig config = SnowWarClientConfig.get();
            volume = Math.max(0, Math.min(100, config.musicVolume)) / 100.0F;
        }

        @Override public boolean canStartSilent() { return true; }
        private void finish() { stop(); }
    }
}
