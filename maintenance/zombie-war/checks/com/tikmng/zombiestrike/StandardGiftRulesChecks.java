package com.tikmng.zombiestrike;

import com.google.gson.Gson;
import com.google.gson.JsonParser;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;

public final class StandardGiftRulesChecks {
    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) throws Exception {
        GameConfig config = GameConfig.get();
        if (args[0].equals("reload")) {
            check(config.rule("gift:5655").amount() == 7, "post-migration edit survives restart");
            check(config.rule("like").amount() == 9, "like setting survives restart");
            System.out.println("MNG_GIFT_RELOAD_PASSED"); return;
        }
        check(config.settingsVersion == 11, "settings version");
        check(config.standardRulesInstalled, "standard installation marker");
        Set<String> expected = Set.of("5655", "5319", "5879", "5658", "17473", "8913", "5303", "5282", "5486", "6427", "7168", "5994", "6267", "11046", "7934");
        check(config.rules.keySet().stream().filter(key -> key.startsWith("gift:")).count() == 15, "exactly 15 gifts");
        for (String id : expected) check(config.rules.containsKey("gift:" + id), "gift present " + id);
        check(config.rule("gift:5655").amount() == 2, "rose 2 zombies");
        check(config.rule("gift:5319").amount() == 5, "blue bead 5 not 10");
        check(config.rule("gift:5879").amount() == 3, "donut 3 helpers");
        check(config.rule("gift:7934").amount() == 1, "heart me 1 helper");
        check(config.rule("gift:5303").action() == GameConfig.Action.VOICE_FIRE && config.rule("gift:5303").amount() == 180, "tea 3 min");
        check(config.rule("gift:7168").amount() == 300, "money gun 5 min");
        check(config.rule("gift:11046").amount() == 600, "galaxy 10 min");
        check(config.rule("gift:5994").safeTarget().equals("spider") && config.rule("gift:5994").amount() == 5, "coffee 5 spiders");
        check(config.rule("gift:5486").action() == GameConfig.Action.STRONG_ZOMBIE && config.rule("gift:5486").safeTarget().equals("mutant"), "mutant summon");
        check(config.rule("gift:17473").action() == GameConfig.Action.INFINITE && config.rule("gift:17473").amount() == 300, "bouquet existing 300 sec");
        check(config.rule("gift:6267").action() == GameConfig.Action.CLEAR, "corgi clear");
        check(config.rule("gift:6427").action() == GameConfig.Action.CHAOS, "hat chaos");
        check(config.rule("gift:8913").action() == GameConfig.Action.UPGRADE, "rosa upgrade");
        check(config.rule("gift:5282").action() == GameConfig.Action.DOWNGRADE, "heart downgrade");
        check(config.rule("gift:5658").action() == GameConfig.Action.FLASH, "perfume flash");
        Path file = Path.of(System.getProperty("mng.fixture.config"), "mng-zombie-strike.json");
        var saved = JsonParser.parseString(Files.readString(file)).getAsJsonObject();
        check(saved.get("settingsVersion").getAsInt() == 11, "saved to disk");
        if (args[0].equals("existing")) {
            check(config.maxHealth == 74 && config.selectedMap.equals("office"), "player settings unchanged");
            check(config.rule("like").amount() == 9 && config.rule("like").threshold() == 100, "like mapping unchanged");
            check(config.rule("follow").amount() == 6, "follow unchanged");
            check(config.rules.containsKey("share"), "unrelated rule unchanged");
            check(!config.rules.containsKey("gift:54558") && !config.rules.containsKey("gift:99999"), "old extra gifts removed");
            config.rules.put("gift:5655", new GameConfig.Rule(GameConfig.Action.ZOMBIE, 7, 1));
            check(config.save(), "persist user edit");
        }
        try (InputStream png = StandardGiftRulesChecks.class.getResourceAsStream("/assets/mng_zombie_strike/textures/gui/tikmng_zombie_war_gift_guide.png")) {
            check(png != null && png.readAllBytes().length > 3000000, "new downloadable PNG resource");
        }
        System.out.println("MNG_GIFT_STANDARDS_PASSED " + args[0]);
    }
}
