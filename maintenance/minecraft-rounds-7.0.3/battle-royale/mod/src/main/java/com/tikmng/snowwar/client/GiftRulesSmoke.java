package com.tikmng.snowwar.client;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

/** Gift-guide contracts and saved-profile regressions, run only by opt-in QA. */
final class GiftRulesSmoke {
    static final String[][] EXPECTED = {
        {"5655", "OYUNCU", "1", "10"},
        {"5658", "SILAH_YUKSELT", "1", "10"},
        {"5282", "ZIRH_1", "1", "10"},
        {"5879", "ZIRH_2", "1", "10"},
        {"5303", "ZIRH_3", "1", "10"},
        {"6427", "ZIRH_4", "1", "10"},
        {"5319", "KIT_BAS", "1", "10"},
        {"5509", "TAM_TECHIZAT", "1", "10"},
        {"5994", "EL_BOMBASI", "1", "10"},
        {"7934", "OYUNCU", "1", "10"},
    };
    static void verify() throws Exception {
        var config = new SnowWarClientConfig();
        require(config.giftRules.length == EXPECTED.length, "fresh rule count differs from guide");
        for (String[] expected : EXPECTED) {
            var rule = Arrays.stream(config.giftRules).filter(r -> r.giftId.equals(expected[0])).findFirst().orElseThrow();
            require(rule.action.equals(expected[1]) && rule.amount == Integer.parseInt(expected[2])
                && rule.durationSeconds == Integer.parseInt(expected[3]), "wrong guide mapping " + expected[0]);
            var ledger = new SnowWarLiveClient.EventLedger();
            var event = gift(rule, 3, "guide-" + rule.giftId);
            var action = SnowWarLiveClient.resolveEvent(event, config, ledger);
            require(action != null && action.action().equals(rule.action) && action.count() == 3 * rule.amount
                && action.durationSeconds() == rule.durationSeconds, "repeat/dispatch mismatch " + rule.giftId);
            require(SnowWarLiveClient.resolveEvent(event, config, ledger) == null, "repeated packet fired twice");
            event.addProperty("dispatchId", "wrong-" + rule.giftId);
            event.addProperty("giftId", "999999999");
            require(SnowWarLiveClient.resolveEvent(event, config, ledger) == null, "wrong ID matched only by name");
        }
        Path root = net.minecraft.client.Minecraft.getInstance().gameDirectory.toPath().resolve("qa-gift-config");
        verifyCatalog();
        Files.createDirectories(root);
        Path empty = root.resolve("empty.json");
        Files.writeString(empty, "{}");
        var loaded = SnowWarClientConfig.load(empty);
        require(loaded.giftRules.length == EXPECTED.length, "empty config selected obsolete defaults");
        require(loaded.giftRules[1].action.equals("SILAH_YUKSELT"), "empty config perfume action");
        Path old = root.resolve("legacy.json");
        var legacy = new SnowWarClientConfig();
        legacy.playerHealth = 175; legacy.effectVolume = 43; legacy.participantCapacity = 417;
        legacy.giftRules = SnowWarClientConfig.GiftRule.legacyDefaults();
        require(legacy.save(old), "write legacy fixture");
        loaded = SnowWarClientConfig.load(old);
        require(loaded.giftRules.length == EXPECTED.length && loaded.playerHealth == 175
            && loaded.effectVolume == 43 && loaded.participantCapacity == 417, "legacy migration lost non-gift settings");
        require(Files.exists(old.resolveSibling("legacy.json.before-gift-guide-fix.bak")), "legacy backup missing");
        String once = Files.readString(old); SnowWarClientConfig.load(old);
        require(once.equals(Files.readString(old)), "migration ran twice");
        Path custom = root.resolve("custom.json");
        var customConfig = new SnowWarClientConfig();
        customConfig.giftRules = new SnowWarClientConfig.GiftRule[]{new SnowWarClientConfig.GiftRule()};
        customConfig.giftRules[0].giftId = "5658"; customConfig.giftRules[0].action = "ZIRH_4";
        customConfig.giftRules[0].amount = 7; customConfig.playerHealth = 177;
        require(customConfig.save(custom), "save custom");
        loaded = SnowWarClientConfig.load(custom);
        require(loaded.giftRules.length == 1 && loaded.giftRules[0].amount == 7
            && loaded.giftRules[0].action.equals("ZIRH_4") && loaded.playerHealth == 177, "custom profile overwritten");
        require(config.save(root.resolve("standard.json")), "save standard");
        require(SnowWarClientConfig.load(root.resolve("standard.json")).giftRules.length == EXPECTED.length, "standard restart");

        com.tikmng.snowwar.SnowWar.LOGGER.info("MNG_GIFT_RULES_SMOKE passed guideRules={} exactIds=true repeats=true duplicates=true savedProfiles=true", EXPECTED.length);
    }
    private static void verifyCatalog() throws Exception {
        try (var input = GiftRulesSmoke.class.getResourceAsStream("/assets/mng_battle_royale/gifts/katalog_tam.json")) {
            require(input != null, "catalog missing");
            var catalog = JsonParser.parseReader(new java.io.InputStreamReader(input, java.nio.charset.StandardCharsets.UTF_8)).getAsJsonArray();
            var ids = new java.util.HashSet<String>();
            var config = new SnowWarClientConfig();
            var rule = new SnowWarClientConfig.GiftRule();
            config.giftRules = new SnowWarClientConfig.GiftRule[]{rule};
            int routes = 0;
            for (var item : catalog) {
                var gift = item.getAsJsonObject();
                rule.giftId = gift.get("id").getAsString(); rule.giftName = gift.get("trName").getAsString();
                require(ids.add(rule.giftId), "duplicate catalog ID " + rule.giftId);
                try (var png = GiftRulesSmoke.class.getResourceAsStream("/assets/mng_battle_royale/gifts/" + gift.get("file").getAsString())) {
                    require(png != null, "missing gift image " + rule.giftId);
                    var decoded = javax.imageio.ImageIO.read(png);
                    require(decoded != null && decoded.getWidth() > 0, "invalid gift image " + rule.giftId);
                    decoded.flush();
                }
                for (String action : SnowWarActionsScreen.ACTIONS) {
                    rule.action = action; rule.amount = 3; rule.durationSeconds = 23;
                    var event = gift(rule, 2, "catalog-" + rule.giftId + "-" + action);
                    var result = SnowWarLiveClient.resolveEvent(event, config, new SnowWarLiveClient.EventLedger());
                    require(result != null && result.action().equals(action) && result.count() == 6
                        && result.durationSeconds() == 23, "catalog route mismatch " + rule.giftId);
                    routes++;
                }
            }
            for (String[] row : EXPECTED) require(ids.contains(row[0]), "guide ID missing in catalog " + row[0]);
            com.tikmng.snowwar.SnowWar.LOGGER.info("MNG_GIFT_CATALOG_SMOKE passed gifts={} decodedImages={} routes={}", ids.size(), ids.size(), routes);
        }
    }

    static JsonObject gift(SnowWarClientConfig.GiftRule rule, int count, String dispatchId) {
        JsonObject event = new JsonObject();
        event.addProperty("type", "gift"); event.addProperty("username", "GiftSender");
        event.addProperty("giftId", rule.giftId); event.addProperty("giftName", rule.giftName);
        event.addProperty("count", count); event.addProperty("dispatchId", dispatchId);
        return event;
    }
    static SnowWarLiveClient.ActionDispatch resolve(SnowWarClientConfig.GiftRule rule) {
        return SnowWarLiveClient.resolveEvent(gift(rule, 1, "native-" + rule.giftId),
            new SnowWarClientConfig(), new SnowWarLiveClient.EventLedger());
    }
    static void require(boolean value, String message) { if (!value) throw new IllegalStateException(message); }
}
