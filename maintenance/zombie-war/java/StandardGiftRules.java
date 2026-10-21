package com.tikmng.zombiestrike;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/** One-time gift-only migration; unrelated player and interaction settings survive. */
public final class StandardGiftRules {
    private static final int VERSION = 11;
    private static final Map<String, GameConfig.Rule> GIFTS = readRules();

    private static Map<String, GameConfig.Rule> readRules() {
        try (InputStream stream = StandardGiftRules.class.getResourceAsStream("/mng-catalog/standard-gifts.json")) {
            if (stream == null) throw new IllegalStateException("Standard gift resource missing");
            JsonObject document = JsonParser.parseReader(new InputStreamReader(stream, StandardCharsets.UTF_8)).getAsJsonObject();
            if (document.get("version").getAsInt() != VERSION) throw new IllegalStateException("Wrong gift settings version");
            JsonArray rows = document.getAsJsonArray("gifts");
            Map<String, GameConfig.Rule> rules = new LinkedHashMap<>();
            for (var row : rows) {
                JsonObject gift = row.getAsJsonObject();
                String key = "gift:" + gift.get("id").getAsString();
                GameConfig.Rule rule = new GameConfig.Rule(GameConfig.Action.valueOf(gift.get("action").getAsString()),
                    gift.get("amount").getAsInt(), gift.get("threshold").getAsInt(), gift.get("target").getAsString());
                if (!key.matches("gift:[0-9]+") || rule.amount() < 1 || rule.threshold() != 1 || rules.put(key, rule) != null) {
                    throw new IllegalStateException("Invalid or duplicate standard gift");
                }
            }
            if (rules.size() != 15) throw new IllegalStateException("Exactly 15 standard gifts required");
            return rules;
        } catch (Exception error) {
            throw new IllegalStateException("Could not load Zombie War gift standards", error);
        }
    }

    public static GameConfig migrate(GameConfig value) {
        if (value.settingsVersion >= VERSION) return value;
        Map<String, GameConfig.Rule> previous = value.rules;
        Map<String, GameConfig.Rule> next = new LinkedHashMap<>();
        if (previous != null) previous.forEach((key, rule) -> {
            if (key != null && !key.startsWith("gift:")) next.put(key, rule);
        });
        next.putAll(GIFTS);
        int oldVersion = value.settingsVersion;
        boolean oldInstalled = value.standardRulesInstalled;
        value.rules = next;
        value.settingsVersion = VERSION;
        value.standardRulesInstalled = true;
        if (!value.save()) {
            value.rules = previous;
            value.settingsVersion = oldVersion;
            value.standardRulesInstalled = oldInstalled;
            throw new IllegalStateException("Gift standards could not be saved; previous settings retained");
        }
        return value;
    }
}
