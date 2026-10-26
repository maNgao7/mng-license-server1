package com.tikmng.snake;

import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.Minecraft;
import net.minecraft.client.resources.sounds.SimpleSoundInstance;
import net.minecraft.client.resources.sounds.SoundInstance;
import net.minecraft.client.resources.sounds.TickableSoundInstance;
import net.minecraft.client.sounds.SoundManager;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundSource;

/** Client-thread API. Call tick every client END tick, including after leaving the arena. */
public final class SnakeAudio {
    private static final SoundEvent MUSIC = sound("arena_loop");
    private static final SoundEvent HISS = sound("hiss");
    private static final SoundEvent EAT = sound("eat");
    // Authorized local Orbit swallow.mp3, converted without changing playback speed.
    private static final SoundEvent SWALLOW = sound("swallow");
    private static final double SWALLOW_SECONDS = .4;
    // Authorized local Orbit growth.mp3, converted at its original pitch and speed.
    private static final SoundEvent GROW = sound("grow");
    private static final double GROW_SECONDS = 2.006;
    private static final float GROW_GAIN = .5f;
    // Authorized local Orbit cue, converted from apps/mng-orbit/public/assets/audio/winner.mp3.
    private static final SoundEvent WINNER = sound("winner");
    private static final List<ArenaSound> effects = new ArrayList<>();
    private static ArenaSound music;
    private static ArenaSound winnerSound;
    private static long nextMusicAttempt, nextHiss, nextEat, nextGrow, nextSwallow, swallowFocusUntil;
    private static long previewStarted;
    private static int previewStep;
    private static long swallowRequests, swallowSubmissions, swallowMuted, swallowInactive;
    private static long swallowRateLimited, swallowMissing;
    private static long winnerRequests, winnerSubmissions, winnerMuted, winnerInactive;
    private static long winnerAlreadyPlaying, winnerMissing;
    private static long growRequests, growSubmissions, growMuted, growInactive;
    private static long growRateLimited, growMissing, growPrioritySuppressed, growCapacityLimited;

    private SnakeAudio() {}

    public static void tick() {
        Minecraft mc = Minecraft.getInstance();
        if (!inArena()) {
            stop();
            return;
        }
        // Also suppress vanilla music when the arena's own music slider is muted.
        mc.getMusicManager().stopPlaying();
        SoundManager sounds = mc.getSoundManager();
        long now = System.nanoTime();
        if (winnerSound != null && winnerSound.isStopped()) stopWinner();
        effects.removeIf(effect -> {
            if (effect.isStopped()) {
                effect.finish(sounds);
                return true;
            }
            return false;
        });
        if (musicVolume() <= 0) {
            stopMusic(sounds);
        } else if ((music == null || music.isStopped() || !sounds.isActive(music))
                && now >= nextMusicAttempt) {
            stopMusic(sounds);
            music = new ArenaSound(MUSIC, true, .8f, 1, 0);
            sounds.play(music);
            // Avoid retrying every tick during a resource or audio-device reload.
            nextMusicAttempt = now + 1_000_000_000L;
        }
        if (previewStarted != 0) {
            long elapsed = now - previewStarted;
            if (previewStep == 0) {
                hiss();
                previewStep++;
            } else if (previewStep == 1 && elapsed >= 1_100_000_000L) {
                eat();
                previewStep++;
            } else if (previewStep == 2 && elapsed >= 1_650_000_000L) {
                swallow();
                previewStep++;
            } else if (previewStep == 3 && elapsed >= 2_750_000_000L) {
                grow();
                previewStarted = 0;
            }
        }
    }

    public static void hiss() {
        long now = System.nanoTime();
        if (now < nextHiss) return;
        if (playEffect(HISS, .85f, .98f, .95)) nextHiss = now + 1_600_000_000L;
    }

    /** Short tail-bite cue; whole-snake eliminations must call swallow instead. */
    public static void eat() {
        long now = System.nanoTime();
        if (now < nextEat) return;
        if (playEffect(EAT, .8f, 1.02f, .28)) nextEat = now + 180_000_000L;
    }

    /** Priority wet gulp for a whole-snake elimination, independent of tail-bite cooldown. */
    public static void swallow() {
        swallowRequests++;
        if (!inArena()) {
            swallowInactive++;
            return;
        }
        if (effectsVolume() <= 0) {
            swallowMuted++;
            return;
        }
        long now = System.nanoTime();
        if (now < nextSwallow) {
            swallowRateLimited++;
            return;
        }
        SoundManager sounds = Minecraft.getInstance().getSoundManager();
        if (sounds.getSoundEvent(SWALLOW.getLocation()) == null) {
            swallowMissing++;
            return;
        }
        if (playEffect(SWALLOW, .85f, 1, SWALLOW_SECONDS)) {
            swallowSubmissions++;
            nextSwallow = now + 300_000_000L;
            swallowFocusUntil = now + 550_000_000L;
        }
    }

    /** Call on actual feeding credit; queue cancellation/removal is not growth. */
    public static void grow() {
        growRequests++;
        if (!inArena()) {
            growInactive++;
            return;
        }
        if (effectsVolume() <= 0) {
            growMuted++;
            return;
        }
        long now = System.nanoTime();
        if (now < swallowFocusUntil || winnerSound != null && !winnerSound.isStopped()) {
            growPrioritySuppressed++;
            return;
        }
        if (now < nextGrow || effects.stream().anyMatch(effect -> !effect.isStopped()
                && effect.getLocation().equals(GROW.getLocation()))) {
            growRateLimited++;
            return;
        }
        SoundManager sounds = Minecraft.getInstance().getSoundManager();
        if (sounds.getSoundEvent(GROW.getLocation()) == null) {
            growMissing++;
            return;
        }
        if (playEffect(GROW, GROW_GAIN, 1, GROW_SECONDS)) {
            growSubmissions++;
            // One complete sample at a time, even during a burst of gifts/like thresholds.
            nextGrow = now + (long)((GROW_SECONDS + .15) * 1_000_000_000L);
        } else growCapacityLimited++;
    }

    static long remainingSwallowNanos() {
        long now=System.nanoTime(),remaining=0;
        for(ArenaSound effect:effects)if(effect.getLocation().equals(SWALLOW.getLocation())&&!effect.isStopped())
            remaining=Math.max(remaining,effect.expiresAt-now);
        return Math.max(0,remaining);
    }

    /** One-shot foreground cue; call from the victory tick edge, never a render callback. */
    public static boolean winner() {
        winnerRequests++;
        if (!inArena()) {
            winnerInactive++;
            return false;
        }
        if (effectsVolume() <= 0) {
            winnerMuted++;
            return false;
        }
        if (winnerSound != null && !winnerSound.isStopped()) {
            winnerAlreadyPlaying++;
            return false;
        }
        SoundManager sounds = Minecraft.getInstance().getSoundManager();
        if (sounds.getSoundEvent(WINNER.getLocation()) == null) {
            winnerMissing++;
            return false;
        }
        stopWinner();
        for (ArenaSound effect : effects) effect.finish(sounds);
        effects.clear();
        previewStarted = 0;
        winnerSound = new ArenaSound(WINNER, false, .9f, 1, 8);
        // Duck immediately so a final gulp/music peak cannot mask the announcement.
        if (music != null) music.duck();
        sounds.play(winnerSound);
        winnerSubmissions++;
        return true;
    }

    /** Cancels just the winner cue and releases music ducking, including on manual reset. */
    public static void stopWinner() {
        if (winnerSound != null) {
            winnerSound.finish(Minecraft.getInstance().getSoundManager());
            winnerSound = null;
        }
    }

    /** Explicit audition using the effects slider; repeated calls restart only this cue. */
    public static boolean testWinner() {
        stopWinner();
        return winner();
    }

    /** Stops our sounds and pending previews; a later active tick can start music again. */
    public static void stop() {
        SoundManager sounds = Minecraft.getInstance().getSoundManager();
        stopMusic(sounds);
        stopWinner();
        for (ArenaSound effect : effects) effect.finish(sounds);
        effects.clear();
        nextMusicAttempt = nextHiss = nextEat = nextGrow = nextSwallow = swallowFocusUntil = previewStarted = 0;
        previewStep = 0;
    }

    /** Restarts the original loop at the selected volume, only in the arena. */
    public static void testMusic() {
        if (!inArena()) return;
        stopMusic(Minecraft.getInstance().getSoundManager());
        nextMusicAttempt = 0;
        tick();
    }

    /** Auditions hiss, tail bite, whole gulp, then grow; the effects slider applies to all. */
    public static void testEffects() {
        if (!inArena()) return;
        stopWinner();
        SoundManager sounds = Minecraft.getInstance().getSoundManager();
        for (ArenaSound effect : effects) effect.finish(sounds);
        effects.clear();
        nextHiss = nextEat = nextGrow = nextSwallow = swallowFocusUntil = 0;
        previewStep = 0;
        previewStarted = effectsVolume() > 0 ? System.nanoTime() : 0;
        tick();
    }

    private static boolean playEffect(SoundEvent event, float gain, float pitch, double seconds) {
        if (!inArena() || effectsVolume() <= 0) return false;
        if (winnerSound != null && !winnerSound.isStopped()) return false;
        boolean wholeSnake = event == SWALLOW;
        if (!wholeSnake && System.nanoTime() < swallowFocusUntil) return false;
        SoundManager sounds = Minecraft.getInstance().getSoundManager();
        effects.removeIf(effect -> {
            if (!effect.isStopped()) return false;
            effect.finish(sounds);
            return true;
        });
        if (wholeSnake) {
            // Give the gulp a clear foreground, even when tail bites filled all four slots.
            effects.removeIf(effect -> {
                if (effect.getLocation().equals(SWALLOW.getLocation())) return false;
                effect.finish(sounds);
                return true;
            });
            // A burst of eliminations can overlap two gulps, without stealing the new cue.
            while (effects.size() >= 2) effects.remove(0).finish(sounds);
        } else if (effects.size() >= 4) return false;
        ArenaSound effect = new ArenaSound(event, false, gain, pitch, seconds);
        effects.add(effect);
        sounds.play(effect);
        return true;
    }

    private static void stopMusic(SoundManager sounds) {
        if (music != null) {
            music.finish(sounds);
            music = null;
        }
    }

    private static boolean inArena() {
        Minecraft mc = Minecraft.getInstance();
        if (!SnakeClient.active || mc.level == null || mc.player == null) return false;
        var server = mc.getSingleplayerServer();
        return server != null && "TikMnG Snake Arena".equals(server.getWorldData().getLevelName());
    }

    private static SoundEvent sound(String name) {
        return SoundEvent.createVariableRangeEvent(ResourceLocation.fromNamespaceAndPath("tikmng_snake_arena", name));
    }

    private static float volume(double value) {
        return Double.isFinite(value) ? (float)Math.max(0, Math.min(1, value)) : 0;
    }

    private static float musicVolume() { return volume(SnakeClient.CONFIG.musicVolume); }
    private static float effectsVolume() { return volume(SnakeClient.CONFIG.effectsVolume); }
    private static float musicDuck() {
        return winnerSound != null && !winnerSound.isStopped() ? .18f : 1;
    }
    static boolean musicPlaying(){return music!=null&&Minecraft.getInstance().getSoundManager().isActive(music);}
    static int activeEffects(){return (int)effects.stream().filter(e->Minecraft.getInstance().getSoundManager().isActive(e)).count()
        +(winnerSound!=null&&Minecraft.getInstance().getSoundManager().isActive(winnerSound)?1:0);}

    public record WinnerDiagnostics(long requests, long submissions, long muted, long inactive,
            long alreadyPlaying, long missingResource, boolean active, boolean musicDucked) {}

    public static WinnerDiagnostics winnerDiagnostics() {
        boolean active = winnerSound != null && !winnerSound.isStopped()
            && Minecraft.getInstance().getSoundManager().isActive(winnerSound);
        return new WinnerDiagnostics(winnerRequests, winnerSubmissions, winnerMuted,
            winnerInactive, winnerAlreadyPlaying, winnerMissing, active, musicDuck() < 1);
    }

    public static void resetWinnerDiagnostics() {
        winnerRequests = winnerSubmissions = winnerMuted = winnerInactive = 0;
        winnerAlreadyPlaying = winnerMissing = 0;
    }

    // Submissions mean SoundManager.play was called, not that the output device was audible.
    public record GrowDiagnostics(long requests, long submissions, long muted, long inactive,
            long rateLimited, long missingResource, long prioritySuppressed, long capacityLimited,
            boolean active, double sampleSeconds, float gain) {}

    public static GrowDiagnostics growDiagnostics() {
        SoundManager sounds = Minecraft.getInstance().getSoundManager();
        boolean active = effects.stream().anyMatch(effect -> !effect.isStopped()
            && effect.getLocation().equals(GROW.getLocation()) && sounds.isActive(effect));
        return new GrowDiagnostics(growRequests, growSubmissions, growMuted, growInactive,
            growRateLimited, growMissing, growPrioritySuppressed, growCapacityLimited,
            active, GROW_SECONDS, GROW_GAIN);
    }

    public static void resetGrowDiagnostics() {
        growRequests = growSubmissions = growMuted = growInactive = 0;
        growRateLimited = growMissing = growPrioritySuppressed = growCapacityLimited = 0;
    }

    // Submissions mean SoundManager.play was called, not that the output device was audible.
    static record PlaybackDiagnostics(long requests, long submissions, long muted, long inactive,
            long rateLimited, long missingResource, boolean swallowActive) {}

    static PlaybackDiagnostics playbackDiagnostics() {
        SoundManager sounds = Minecraft.getInstance().getSoundManager();
        boolean active = effects.stream().anyMatch(effect -> !effect.isStopped()
            && effect.getLocation().equals(SWALLOW.getLocation()) && sounds.isActive(effect));
        return new PlaybackDiagnostics(swallowRequests, swallowSubmissions, swallowMuted,
            swallowInactive, swallowRateLimited, swallowMissing, active);
    }

    static void resetPlaybackDiagnostics() {
        swallowRequests = swallowSubmissions = swallowMuted = swallowInactive = 0;
        swallowRateLimited = swallowMissing = 0;
    }

    private static final class ArenaSound extends SimpleSoundInstance implements TickableSoundInstance {
        private final boolean musicChannel;
        private final float gain;
        private final long expiresAt;
        private boolean stopped;

        ArenaSound(SoundEvent event, boolean musicChannel, float gain, float pitch, double seconds) {
            // MASTER is intentional: the two arena sliders are independent of vanilla categories.
            super(event.getLocation(), SoundSource.MASTER,
                gain * (musicChannel ? musicVolume() * musicDuck() : effectsVolume()), pitch,
                SoundInstance.createUnseededRandom(), musicChannel, 0,
                SoundInstance.Attenuation.NONE, 0, 0, 0, true);
            this.musicChannel = musicChannel;
            this.gain = gain;
            this.expiresAt = musicChannel ? Long.MAX_VALUE
                : System.nanoTime() + (long)((seconds / pitch + .15) * 1_000_000_000L);
        }

        @Override public boolean isStopped() {
            return stopped || !inArena() || System.nanoTime() >= expiresAt
                || (musicChannel ? musicVolume() : effectsVolume()) <= 0;
        }

        @Override public boolean canPlaySound() { return !isStopped(); }

        @Override public void tick() {
            if (isStopped()) {
                stopped = true;
                return;
            }
            float target = gain * (musicChannel ? musicVolume() * musicDuck() : effectsVolume());
            volume += (target - volume) * .25f;
        }

        void duck() {
            if (musicChannel) volume = gain * musicVolume() * musicDuck();
        }

        void finish(SoundManager sounds) {
            stopped = true;
            sounds.stop(this);
        }
    }
}
