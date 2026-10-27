package com.tikmng.snowwar.client;

import com.google.gson.JsonParser;
import java.nio.file.Files;
import java.nio.file.Path;

public final class CapacityConfigChecks {
    private CapacityConfigChecks() {}

    public static void run(Path directory) throws Exception {
        Files.createDirectories(directory);
        Path file = directory.resolve("capacity-config.json");
        var config = new SnowWarClientConfig();
        require(config.participantCapacity == 300, "fresh default");
        config.participantCapacity = 417;
        require(config.save(file), "save custom capacity");
        require(SnowWarClientConfig.load(file).participantCapacity == 417, "save/load roundtrip");
        Files.writeString(file, "{\"playerHealth\":175,\"giftRules\":[{\"giftId\":\"5655\",\"action\":\"OYUNCU\",\"amount\":7}]}");
        config = SnowWarClientConfig.load(file);
        require(config.participantCapacity == 300 && config.playerHealth == 175, "migrate old hardcoded 100");
        require(config.giftRules[0].amount == 7, "preserve custom gift assignment");
        require(JsonParser.parseString(Files.readString(file)).getAsJsonObject().get("participantCapacity").getAsInt() == 300,
            "persist one-time migration");
        String migrated = Files.readString(file);
        SnowWarClientConfig.load(file);
        require(migrated.equals(Files.readString(file)), "migration is idempotent");
        for (int value : new int[]{1, 100, 250, 300, 500, 0, -1, Integer.MAX_VALUE}) {
            Files.writeString(file, "{\"participantCapacity\":" + value + "}");
            int expected = Math.max(1, Math.min(500, value));
            require(SnowWarClientConfig.load(file).participantCapacity == expected, "validate/preserve explicit " + value);
        }
        Files.writeString(file, "{\"participantCapacity\":null}");
        require(SnowWarClientConfig.load(file).participantCapacity == 300, "null capacity migrates");
        System.out.println("CAPACITY_CONFIG PASS default/migration/idempotence/custom100/custom417/range/roundtrip/gifts");
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
