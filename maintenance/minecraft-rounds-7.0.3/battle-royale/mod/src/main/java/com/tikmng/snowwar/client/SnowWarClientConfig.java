package com.tikmng.snowwar.client;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonParser;
import com.tikmng.snowwar.game.ParticipantCapacity;
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
    private static final Path FILE = FMLPaths.CONFIGDIR.get().resolve("mng-battle-royale.json");
    private static SnowWarClientConfig instance;

    public transient String streamer = "";
    public int likesPerFighter = 100;
    public int followsPerAction = 1;
    public boolean nightMode = false;
    public String timeOfDay = "day";
    public int musicVolume = 0;
    public int windVolume = 15;
    public int effectVolume = 85;
    public int playerHealth = 100;
    public int winnerDelaySeconds = 10;
    public int zoneIntervalSeconds = 20;
    public int lobbyWaitSeconds = 10;
    public int participantCapacity = ParticipantCapacity.DEFAULT;
    public String likesAction = "OYUNCU";
    public int likesAmount = 1;
    public int likesDurationSeconds = DEFAULT_DURATION_SECONDS;
    public String followAction = "OYUNCU";
    public int followAmount = 1;
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
                    "/assets/mng_battle_royale/defaults/battle-royale.json")) {
                if (stream == null) throw new IllegalStateException("Missing standard gift rules");
                var json = JsonParser.parseReader(new java.io.InputStreamReader(stream,
                    java.nio.charset.StandardCharsets.UTF_8)).getAsJsonObject();
                GiftRule[] rules = GSON.fromJson(json.getAsJsonArray("giftRules"), GiftRule[].class);
                if (rules == null || rules.length == 0) throw new IllegalStateException("Empty standard gift rules");
                return rules;
            } catch (java.io.IOException error) { throw new IllegalStateException("Cannot read standard gift rules", error); }
        }

        // Fingerprint of the obsolete released preset, never used for new defaults.
        static GiftRule[] legacyDefaults() {
            return new GiftRule[] {
                rule("Gül", "5655", "OYUNCU", 1, 10),
                rule("GG", "6064", "ZIRH_3", 1, 10),
                rule("Blue Bead", "5319", "SILAH_YUKSELT", 1, 10),
                rule("Donat", "5879", "KIT_BAS", 1, 10),
                rule("Parfüm", "5658", "ZIRH_1", 1, 10),
                rule("Çay", "5303", "ZIRH_1", 1, 10),
                rule("Şapka ve Bıyık", "6427", "ZIRH_1", 1, 10),
                rule("Tek Vuruş", "127088", "P90", 1, 10),
                rule("Keçi Sokak Müzisyeni", "626064", "M4", 1, 10),
                rule("Buket", "17473", "AK", 1, 10),
                rule("Şapka", "6104", "ZIRH_2", 1, 10),
                rule("Mishka Bear", "5566", "ZIRH_2", 1, 10),
                rule("Galaksi", "11046", "TAM_TECHIZAT", 1, 10),
                rule("Para Tabancası", "7168", "SILAH_YUKSELT", 1, 10),
                rule("Güneş gözlükleri", "5509", "ZIRH_1", 1, 10),
                rule("Beni Sev", "7934", "KIT_BAS", 1, 10),
                rule("Kalp", "5282", "OYUNCU", 1, 10)
            };
        }

        private static GiftRule rule(String name, String id, String action, int amount, int seconds) {
            GiftRule rule = new GiftRule();
            rule.giftName = name;
            rule.giftId = id;
            rule.action = action;
            rule.amount = amount;
            rule.durationSeconds = seconds;
            return rule;
        }
    }

    public static SnowWarClientConfig get() {
        if (instance == null) instance = load();
        return instance;
    }

    public boolean save() {
        return save(FILE);
    }

    boolean save(Path file) {
        normalize();
        try {
            Files.createDirectories(file.getParent());
            try (Writer writer = Files.newBufferedWriter(file)) {
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
        return load(FILE);
    }

    static SnowWarClientConfig load(Path file) {
        if (Files.isRegularFile(file)) {
            try (Reader reader = Files.newBufferedReader(file)) {
                var json = JsonParser.parseReader(reader).getAsJsonObject();
                SnowWarClientConfig loaded = GSON.fromJson(json, SnowWarClientConfig.class);
                if (loaded != null) {
                    String before = GSON.toJson(loaded);
                    // The old 100-player limit was code-only. Explicit saved capacities are custom.
                    boolean migrateCapacity = !json.has("participantCapacity") || json.get("participantCapacity").isJsonNull();
                    if (migrateCapacity) loaded.participantCapacity = ParticipantCapacity.DEFAULT;
                    boolean migrateGifts = GSON.toJson(loaded.giftRules).equals(GSON.toJson(GiftRule.legacyDefaults()));
                    if (migrateGifts) {
                        Path backup = file.resolveSibling(file.getFileName() + ".before-gift-guide-fix.bak");
                        if (!Files.exists(backup)) Files.copy(file, backup);
                        loaded.giftRules = GiftRule.defaults();
                    }
                    loaded.normalize();
                    if (loaded.windVolume == 18) loaded.windVolume = 25;
                    if (migrateCapacity || migrateGifts || !json.has("giftRules") || !before.equals(GSON.toJson(loaded))) loaded.save(file);
                    return loaded;
                }
            } catch (Exception ignored) {
            }
        }
        try (var stream = SnowWarClientConfig.class.getResourceAsStream(
                "/assets/mng_battle_royale/defaults/battle-royale.json")) {
            if (stream != null) {
                SnowWarClientConfig defaults = GSON.fromJson(new java.io.InputStreamReader(stream,
                    java.nio.charset.StandardCharsets.UTF_8), SnowWarClientConfig.class);
                if (defaults != null) { defaults.normalize(); return defaults; }
            }
        } catch (Exception ignored) { }
        return new SnowWarClientConfig();
    }

    static int positive(int value, int fallback) {
        return value < 1 ? fallback : Math.min(MAX_VALUE, value);
    }

    static int durationSeconds(int value) {
        return Math.max(1, Math.min(MAX_DURATION_SECONDS, value));
    }

    private void normalize() {
        participantCapacity = ParticipantCapacity.validate(participantCapacity);
        if (giftRules == null) giftRules = GiftRule.defaults();
        else if (giftRules.length == 0) giftRules = new GiftRule[] { new GiftRule() };
        java.util.Set<String> seenGifts = new java.util.HashSet<>();
        giftRules = Arrays.stream(giftRules).filter(rule -> rule == null || rule.giftId == null
            || rule.giftId.isBlank() || seenGifts.add(rule.giftId)).filter(rule -> rule == null ||
            !java.util.Set.of("ZIRH_CIKAR", "KASK_CIKAR", "YELEK_CIKAR").contains(rule.action == null ? "" : rule.action))
            .toArray(GiftRule[]::new);
        for (int i = 0; i < giftRules.length; i++) {
            if (giftRules[i] == null) giftRules[i] = new GiftRule();
            GiftRule rule = giftRules[i];
            rule.giftName = rule.giftName == null ? "" : rule.giftName;
            rule.giftId = rule.giftId == null ? "" : rule.giftId;
            if (rule.action == null || rule.action.isBlank()) rule.action = "OYUNCU";
            String oldAction = rule.action;
            rule.action = migratedAction(rule.action, rule.amount);
            if ("KASK".equals(oldAction) || "YELEK".equals(oldAction)) rule.amount = 1;
            rule.amount = positive(rule.amount, 1);
            rule.durationSeconds = durationSeconds(rule.durationSeconds);
            int multiplier = playerMultiplier(rule.action);
            if (multiplier > 0) {
                rule.amount = migratedAmount(rule.amount, multiplier);
                rule.action = "OYUNCU";
            }
        }
        likesPerFighter = Math.max(100, positive(likesPerFighter, 100));
        followsPerAction = positive(followsPerAction, 1);
        likesAmount = positive(likesAmount, 1);
        followAmount = positive(followAmount, 1);
        likesDurationSeconds = durationSeconds(likesDurationSeconds);
        followDurationSeconds = durationSeconds(followDurationSeconds);
        if (likesAction == null || likesAction.isBlank()) likesAction = "OYUNCU";
        if (followAction == null || followAction.isBlank()) followAction = "OYUNCU";
        String oldLikes = likesAction, oldFollow = followAction;
        likesAction = migratedAction(likesAction, likesAmount);
        followAction = migratedAction(followAction, followAmount);
        if ("KASK".equals(oldLikes) || "YELEK".equals(oldLikes)) likesAmount = 1;
        if ("KASK".equals(oldFollow) || "YELEK".equals(oldFollow)) followAmount = 1;
        playerHealth = Math.max(1, Math.min(1000, playerHealth));
        winnerDelaySeconds = durationSeconds(winnerDelaySeconds);
        zoneIntervalSeconds = Math.max(10, Math.min(120, zoneIntervalSeconds));
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

    private static String migratedAction(String action, int amount) {
        return switch (action) {
            case "KASK", "YELEK" -> "ZIRH_" + Math.max(1, Math.min(4, amount));
            case "KALKAN", "TAKIM_GUCU", "TAKIM_KALKANI" -> "ZIRH_1";
            case "INTIKAM", "KARTOPU_SILAHI" -> "SILAH_YUKSELT";
            case "OYUNCU_AZALT", "OYUNCU_1", "OYUNCU_5", "OYUNCU_10", "OYUNCU_20", "OYUNCU_30", "OYUNCU_40" -> "OYUNCU";
            case "EKSTRA_CAN", "IYILESTIR", "CAN_BAS" -> "KIT_BAS";
            case "AGIR_KARTOPU", "KAR_ADAMI", "CIG", "HERKESI_DUSUR", "BUYU", "BUZ_TUZAGI", "KAR_HORTUMU" -> "TAM_TECHIZAT";
            default -> action;
        };
    }
}
