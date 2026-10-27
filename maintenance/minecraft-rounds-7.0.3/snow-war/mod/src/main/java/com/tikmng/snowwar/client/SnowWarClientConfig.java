package com.tikmng.snowwar.client;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.minecraftforge.fml.loading.FMLPaths;

import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

public final class SnowWarClientConfig {
    public static final int MAX_VALUE = 1_000_000;
    public static final int DEFAULT_DURATION_SECONDS = 10;
    public static final int MAX_DURATION_SECONDS = 120;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path FILE = FMLPaths.CONFIGDIR.get().resolve("mng-snow-war.json");
    private static SnowWarClientConfig instance;

    public transient String streamer = "";
    public int likesPerFighter = 100;
    public int followsPerAction = 1;
    public boolean nightMode = true;
    public String timeOfDay = "sunset";
    public int musicVolume = 3;
    public int windVolume = 40;
    public int effectVolume = 80;
    public int playerHealth = 30;
    public int winnerDelaySeconds = 10;
    public String likesAction = "OYUNCU";
    public int likesAmount = 5;
    public int likesDurationSeconds = DEFAULT_DURATION_SECONDS;
    public String followAction = "OYUNCU";
    public int followAmount = 5;
    public int followDurationSeconds = DEFAULT_DURATION_SECONDS;
    public GiftRule[] giftRules = GiftRule.defaults();

    public static final class GiftRule {
        public String giftName = "";
        public String giftId = "";
        public String action = "OYUNCU";
        // Missing amounts in old JSON keep the original action's unit size.
        public int amount = 1;
        public int durationSeconds = DEFAULT_DURATION_SECONDS;

        public static GiftRule[] defaults() {
            try (var stream = SnowWarClientConfig.class.getResourceAsStream(
                    "/assets/mng_snow_war/defaults/snow-war.json")) {
                if (stream == null) throw new IllegalStateException("Missing standard gift rules");
                var json = com.google.gson.JsonParser.parseReader(new java.io.InputStreamReader(stream,
                    java.nio.charset.StandardCharsets.UTF_8)).getAsJsonObject();
                GiftRule[] rules = GSON.fromJson(json.getAsJsonArray("giftRules"), GiftRule[].class);
                if (rules == null || rules.length == 0) throw new IllegalStateException("Empty standard gift rules");
                return rules;
            } catch (java.io.IOException error) { throw new IllegalStateException("Cannot read standard gift rules", error); }
        }
    }

    public static SnowWarClientConfig get() {
        if (instance == null) instance = load();
        return instance;
    }

    public boolean save() {
        normalize();
        try {
            Files.createDirectories(FILE.getParent());
            try (Writer writer = Files.newBufferedWriter(FILE)) {
                GSON.toJson(this, writer);
            }
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    public void addGiftRule() {
        GiftRule[] next = Arrays.copyOf(giftRules, Math.min(100, giftRules.length + 1));
        if (next.length > giftRules.length) next[next.length - 1] = new GiftRule();
        giftRules = next;
    }

    public void removeGiftRule(int index) {
        if (index < 0 || index >= giftRules.length) return;
        if (giftRules.length == 1) {
            giftRules[0] = new GiftRule();
            return;
        }
        GiftRule[] next = new GiftRule[giftRules.length - 1];
        System.arraycopy(giftRules, 0, next, 0, index);
        System.arraycopy(giftRules, index + 1, next, index, giftRules.length - index - 1);
        giftRules = next;
    }

    private static SnowWarClientConfig load() {
        if (Files.isRegularFile(FILE)) {
            try (Reader reader = Files.newBufferedReader(FILE)) {
                SnowWarClientConfig loaded = GSON.fromJson(reader, SnowWarClientConfig.class);
                if (loaded != null) {
                    loaded.normalize();
                    if (loaded.windVolume == 18) loaded.windVolume = 25;
                    return loaded;
                }
            } catch (Exception ignored) {
            }
        }
        return new SnowWarClientConfig();
    }

    static int positive(int value, int fallback) {
        return value < 1 ? fallback : Math.min(MAX_VALUE, value);
    }

    static int durationSeconds(int value) {
        return Math.max(1, Math.min(MAX_DURATION_SECONDS, value));
    }

    private void normalize() {
        if (giftRules == null) giftRules = GiftRule.defaults();
        else if (giftRules.length == 0) giftRules = new GiftRule[] { new GiftRule() };
        for (int i = 0; i < giftRules.length; i++) {
            if (giftRules[i] == null) giftRules[i] = new GiftRule();
            GiftRule rule = giftRules[i];
            rule.giftName = rule.giftName == null ? "" : rule.giftName;
            rule.giftId = rule.giftId == null ? "" : rule.giftId;
            if (rule.action == null || rule.action.isBlank()) rule.action = "OYUNCU";
            rule.action = migratedAction(rule.action);
            rule.amount = positive(rule.amount, 1);
            rule.durationSeconds = durationSeconds(rule.durationSeconds);
            int multiplier = playerMultiplier(rule.action);
            if (multiplier > 0) {
                rule.amount = migratedAmount(rule.amount, multiplier);
                rule.action = "OYUNCU";
            }
        }
        likesPerFighter = positive(likesPerFighter, 100);
        followsPerAction = positive(followsPerAction, 1);
        likesAmount = positive(likesAmount, 5);
        followAmount = positive(followAmount, 5);
        likesDurationSeconds = durationSeconds(likesDurationSeconds);
        followDurationSeconds = durationSeconds(followDurationSeconds);
        if (likesAction == null || likesAction.isBlank()) likesAction = "OYUNCU";
        if (followAction == null || followAction.isBlank()) followAction = "OYUNCU";
        likesAction = migratedAction(likesAction);
        followAction = migratedAction(followAction);
        playerHealth = Math.max(1, Math.min(1000, playerHealth));
        winnerDelaySeconds = durationSeconds(winnerDelaySeconds);
        effectVolume = Math.max(0, Math.min(100, effectVolume));
        int likesMultiplier = playerMultiplier(likesAction);
        if (likesMultiplier > 0) {
            likesAmount = migratedAmount(likesAmount, likesMultiplier);
            likesAction = "OYUNCU";
        }
        int followMultiplier = playerMultiplier(followAction);
        if (followMultiplier > 0) {
            followAmount = migratedAmount(followAmount, followMultiplier);
            followAction = "OYUNCU";
        }
    }

    private static int playerMultiplier(String action) {
        return switch (action) {
            case "OYUNCU_1" -> 1;
            case "OYUNCU_5" -> 5;
            case "OYUNCU_10" -> 10;
            case "OYUNCU_20" -> 20;
            case "OYUNCU_30" -> 30;
            case "OYUNCU_40" -> 40;
            default -> 0;
        };
    }

    private static int migratedAmount(int amount, int multiplier) {
        return (int)Math.min(MAX_VALUE, (long)amount * multiplier);
    }

    private static String migratedAction(String action) {
        return switch (action) {
            case "INTIKAM" -> "KARTOPU_SILAHI";
            case "OYUNCU_AZALT" -> "OYUNCU";
            case "TAKIM_GUCU" -> "TAKIM_KALKANI";
            default -> action;
        };
    }
}
