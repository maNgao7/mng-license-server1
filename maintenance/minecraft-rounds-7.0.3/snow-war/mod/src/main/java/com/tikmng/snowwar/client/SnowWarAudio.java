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
    private static Loop wind;

    private SnowWarAudio() { }

    public static void playWinner() {
        Minecraft.getInstance().getSoundManager().play(new net.minecraft.client.resources.sounds.SimpleSoundInstance(
            SnowWarSounds.WINNER.get().getLocation(), SoundSource.MASTER,
            SnowWarClientConfig.get().effectVolume / 100.0F, 1.0F, RandomSource.create(),
            false, 0, SoundInstance.Attenuation.NONE, 0, 0, 0, true));
    }

    public static void update() {
        Minecraft mc = Minecraft.getInstance();
        if (mc.level == null || mc.player == null) {
            if (music != null) music.finish();
            if (wind != null) wind.finish();
            music = null;
            wind = null;
            return;
        }
        if (music == null || music.isStopped()) {
            music = new Loop(SnowWarSounds.CHRISTMAS.get(), false);
            mc.getSoundManager().play(music);
        }
        if (wind == null || wind.isStopped()) {
            wind = new Loop(SnowWarSounds.WIND.get(), true);
            mc.getSoundManager().play(wind);
        }
    }

    private static final class Loop extends AbstractTickableSoundInstance {
        private final boolean wind;

        private Loop(SoundEvent sound, boolean wind) {
            super(sound, SoundSource.MASTER, RandomSource.create());
            this.wind = wind;
            looping = true;
            relative = true;
            attenuation = SoundInstance.Attenuation.NONE;
            delay = 0;
            tick();
        }

        @Override public void tick() {
            if (Minecraft.getInstance().level == null) { stop(); return; }
            SnowWarClientConfig config = SnowWarClientConfig.get();
            volume = Math.max(0, Math.min(100, wind ? config.windVolume : config.musicVolume)) / 100.0F;
        }

        @Override public boolean canStartSilent() { return true; }
        private void finish() { stop(); }
    }
}
