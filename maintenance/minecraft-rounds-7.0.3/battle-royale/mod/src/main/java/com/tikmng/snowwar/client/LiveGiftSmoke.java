package com.tikmng.snowwar.client;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.tikmng.snowwar.SnowWar;

final class LiveGiftSmoke {
    private LiveGiftSmoke() {}

    static void verify() {
        LobbyMediaSmoke.verify();
        var saved = SnowWarClientConfig.get();
        int checked = 0;
        for (var rule : saved.giftRules) {
            for (boolean changedId : new boolean[]{false, true}) {
                JsonObject event = gift(changedId ? "regional-id" : rule.giftId, rule.giftName, 1);
                var ledger = new SnowWarLiveClient.EventLedger();
                var action = SnowWarLiveClient.resolveEvent(event, saved, ledger);
                if (changedId && rule.giftId != null && !rule.giftId.isBlank())
                    require(action == null, "Wrong gift ID matched only by name: " + rule.giftName);
                else require(action != null && action.action().equals(rule.action) && action.count() == rule.amount,
                    "Saved gift failed: " + rule.giftName);
                require(SnowWarLiveClient.resolveEvent(event, saved, ledger) == null, "Duplicate gift dispatched");
                checked++;
            }
        }
        var config = new SnowWarClientConfig();
        var ledger = new SnowWarLiveClient.EventLedger();
        int batches = 0;
        for (int i = 0; i < 300; i++) {
            JsonObject like = new JsonObject();
            like.addProperty("type", "like"); like.addProperty("username", "likes-viewer");
            like.addProperty("count", 1); like.addProperty("dispatchId", "like-" + i);
            var result = SnowWarLiveClient.resolveEvent(like, config, ledger);
            require((result != null) == ((i+1)%100 == 0), "Like fired before an exact 100-like boundary: " + (i+1));
            if (result != null) batches += result.count();
        }
        require(batches == 3, "Repeated 100-like thresholds failed");
        ledger = new SnowWarLiveClient.EventLedger();
        require(SnowWarLiveClient.resolveEvent(like("first",99,"a"),config,ledger)==null,"99 fired");
        require(SnowWarLiveClient.resolveEvent(like("second",99,"b"),config,ledger)==null,"Viewers were combined");
        var hundred = like("first",1,"c");
        require(SnowWarLiveClient.resolveEvent(hundred,config,ledger).count()==1,"100 did not fire");
        require(SnowWarLiveClient.resolveEvent(hundred,config,ledger)==null,"Repeated like packet fired");
        require(SnowWarLiveClient.resolveEvent(like("first",99,"d"),config,ledger)==null,"199 fired");
        require(SnowWarLiveClient.resolveEvent(like("first",1,"e"),config,ledger).count()==1,"200 did not fire");
        require(SnowWarLiveClient.resolveEvent(like("second",1,"f"),config,ledger).count()==1,"Other viewer remainder lost");
        require(SnowWarLiveClient.resolveEvent(like("batch",300,"g"),config,ledger).count()==3,"300 batch failed");
        config.likesPerFighter=1;
        require(SnowWarLiveClient.resolveEvent(like("minimum",99,"h"),config,ledger)==null,"Unsafe threshold accepted");
        require(SnowWarLiveClient.resolveEvent(like("minimum",1,"i"),config,ledger).count()==1,"Minimum threshold failed");
        require(SnowWarLiveClient.sameGiftName(" GG ", "gg"), "GG name fallback failed");
        verifyCatalog();
        SnowWar.LOGGER.info("MNG_ROYALE_GIFT_RULES passed=true savedCases={} likes=300/3", checked);
    }

    private static void verifyCatalog() {
        int checked=0;
        try (var stream=LiveGiftSmoke.class.getResourceAsStream("/assets/mng_battle_royale/gifts/katalog_tam.json")) {
            require(stream!=null,"Gift catalog missing");
            var catalog=JsonParser.parseReader(new java.io.InputStreamReader(stream,java.nio.charset.StandardCharsets.UTF_8)).getAsJsonArray();
            var config=new SnowWarClientConfig();
            var rule=new SnowWarClientConfig.GiftRule();
            config.giftRules=new SnowWarClientConfig.GiftRule[]{rule};
            for(var entry:catalog) {
                var gift=entry.getAsJsonObject();
                rule.giftId=gift.get("id").getAsString();
                rule.giftName=gift.get("trName").getAsString();
                var icon = SnowWarGiftCatalogScreen.giftIcon(gift.get("file").getAsString());
                require(LiveGiftSmoke.class.getResource("/assets/" + icon.getNamespace() + "/" + icon.getPath())
                    != null,"Gift image missing: "+rule.giftName);
                for(String action:SnowWarActionsScreen.ACTIONS) {
                    rule.action=action; rule.amount=3;
                    var result=SnowWarLiveClient.resolveEvent(gift(rule.giftId,rule.giftName,2),config,new SnowWarLiveClient.EventLedger());
                    require(result!=null && result.action().equals(action) && result.count()==6,
                        "Catalog dispatch failed: "+rule.giftId+" / "+action);
                    checked++;
                }
            }
            SnowWar.LOGGER.info("MNG_ROYALE_CATALOG passed=true gifts={} actionCases={}",catalog.size(),checked);
        } catch(java.io.IOException error) { throw new IllegalStateException(error); }
    }

    private static JsonObject like(String username, int count, String id) {
        JsonObject event = new JsonObject();
        event.addProperty("type","like"); event.addProperty("username",username);
        event.addProperty("count",count); event.addProperty("dispatchId",id);
        return event;
    }

    private static JsonObject gift(String id, String name, int count) {
        JsonObject event = new JsonObject();
        event.addProperty("type", "gift"); event.addProperty("username", "gift-viewer");
        event.addProperty("giftId", id); event.addProperty("giftName", name);
        event.addProperty("count", count); event.addProperty("dispatchId", id + name);
        return event;
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new IllegalStateException(message);
    }
}
