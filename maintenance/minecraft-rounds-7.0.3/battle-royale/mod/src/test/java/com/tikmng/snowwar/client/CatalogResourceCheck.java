package com.tikmng.snowwar.client;

import com.google.gson.JsonParser;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.zip.ZipFile;
import javax.imageio.ImageIO;

public final class CatalogResourceCheck {
    public static void main(String[] args) throws Exception {
        try (var jar = new ZipFile(args[0])) {
            var catalogEntry = jar.getEntry("assets/mng_battle_royale/gifts/katalog_tam.json");
            require(catalogEntry != null, "JAR catalog missing");
            var catalog = JsonParser.parseReader(new InputStreamReader(jar.getInputStream(catalogEntry),
                StandardCharsets.UTF_8)).getAsJsonArray();
            var provenanceEntry = jar.getEntry("assets/mng_battle_royale/gifts/provenance.json");
            require(provenanceEntry != null, "JAR catalog provenance missing");
            var provenance = JsonParser.parseReader(new InputStreamReader(jar.getInputStream(provenanceEntry),
                StandardCharsets.UTF_8)).getAsJsonObject();
            int expectedCount = provenance.get("catalogCount").getAsInt();
            require("verified-old-plus-new-numeric-id-union".equals(provenance.get("policy").getAsString()), "catalog union policy");
            require(expectedCount > 0 && catalog.size() == expectedCount && SnowWarGiftCatalogScreen.giftCount() == expectedCount, "UI/JAR catalog count");
            var ids = new HashSet<String>();
            var paths = new HashSet<String>();
            long previousCoins = -1;
            long previousId = -1;
            for (var entry : catalog) {
                var gift = entry.getAsJsonObject();
                String id = gift.get("id").getAsString();
                String file = gift.get("file").getAsString();
                require(id.matches("[1-9][0-9]*"), "noncanonical numeric ID: " + id);
                long numericId = Long.parseLong(id);
                long coins = gift.get("coins").getAsLong();
                require(coins >= 0 && (coins > previousCoins || (coins == previousCoins && numericId > previousId)), "coin/ID sort order: " + id);
                previousCoins = coins;
                previousId = numericId;
                require(ids.add(id) && file.equals(id + ".png"), "unique ID/PNG mismatch: " + id);
                var icon = SnowWarGiftCatalogScreen.giftIcon(file);
                require(icon.toString().equals("mng_battle_royale:gifts/" + id + ".png"), "actual UI resource ID: " + id);
                String path = "assets/" + icon.getNamespace() + "/" + icon.getPath();
                require(paths.add(path), "duplicate UI resource: " + path);
                require(SnowWarGiftCatalogScreen.class.getResource("/" + path) != null, "UI classpath resource: " + path);
                var png = jar.getEntry(path);
                require(png != null, "UI resource absent from final JAR: " + path);
                try (var stream = jar.getInputStream(png)) {
                    var image = ImageIO.read(stream);
                    require(image != null && image.getWidth() > 0 && image.getHeight() > 0, "invalid UI PNG: " + path);
                }
            }
            long pngCount = jar.stream().filter(entry -> entry.getName().startsWith("assets/mng_battle_royale/gifts/")
                && entry.getName().endsWith(".png")).count();
            long legacy = jar.stream().filter(entry -> entry.getName().startsWith("assets/mng_battle_royale/textures/gui/gifts/")
                && !entry.isDirectory()).count();
            require(pngCount == expectedCount, "extra canonical gift PNGs in JAR");
            System.out.println("CATALOG_RESOURCE_CHECK PASS UI=" + SnowWarGiftCatalogScreen.giftCount()
                + " uniqueIDs=" + ids.size() + " uniqueResourceIDs=" + paths.size() + " decodedPNGs=" + pngCount
                + " missing=0 extraCanonicalPNGs=0 legacyTexturesRetained=" + legacy);
        }
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
