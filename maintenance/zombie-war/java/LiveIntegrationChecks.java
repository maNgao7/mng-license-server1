package com.tikmng.zombiestrike;

import net.minecraft.client.Minecraft;
import net.minecraft.server.MinecraftServer;
import java.net.URI;
import java.net.http.*;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/** Explicit offline verification mode, enabled only by the release check runner. */
final class LiveIntegrationChecks {
    private static int stage = -1, nextTick;
    private static CompletableFuture<HttpResponse<String>> pending;
    private static boolean finished;
    private static final String[] CASES = {"rose", "rose-again", "blue", "likes99", "likes1", "likes100", "likes300", "follow", "spider"};
    private static final Map<String, Integer>[] EXPECTED = new Map[] {
        Map.of("rose_viewer", 2), Map.of("rose_viewer", 4), Map.of("blue_viewer", 5),
        Map.of("like_viewer", 0), Map.of("like_viewer", 2), Map.of("like_viewer", 4),
        Map.of("like_viewer", 10), Map.of("follow_viewer", 2), Map.of("spider_viewer", 5)
    };

    static void tick(MinecraftServer server) {
        if (!Boolean.getBoolean("mng.verify.live") || finished || server.getPlayerList().getPlayers().isEmpty()) return;
        var player = server.getPlayerList().getPlayers().get(0);
        player.setInvulnerable(true);
        if (stage < 0) {
            stage = 0; nextTick = server.getTickCount() + 100;
            Minecraft.getInstance().execute(() -> {
                Minecraft.getInstance().options.pauseOnLostFocus = false;
                TikTokBridge.connect("fixture_streamer");
            });
            return;
        }
        if (server.getTickCount() < nextTick) return;
        try {
            if (pending == null) {
                System.out.println("MNG_LIVE_CHECK_STATUS " + TikTokBridge.status());
                int port = Integer.getInteger("mng.bridge.port");
                pending = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build().sendAsync(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/fixture/" + CASES[stage])).GET().build(), HttpResponse.BodyHandlers.ofString());
                nextTick = server.getTickCount() + 100;
                return;
            }
            if (!pending.isDone()) return;
            if (pending.join().statusCode() != 200) throw new AssertionError("Fixture server rejected " + CASES[stage]);
            for (var expected : EXPECTED[stage].entrySet()) {
                long count = java.util.stream.StreamSupport.stream(player.serverLevel().getAllEntities().spliterator(), false)
                    .filter(e -> e.getTags().contains("mng_enemy") && expected.getKey().equals(e.getPersistentData().getString("mng_viewer"))).count();
                if (count != expected.getValue()) throw new AssertionError(CASES[stage] + ": " + count + " != " + expected.getValue());
            }
            System.out.println("MNG_LIVE_CHECK_OK " + CASES[stage] + " " + EXPECTED[stage]);
            pending = null;
            if (++stage < CASES.length) { nextTick = server.getTickCount() + 1; return; }
            SpawnManager.clear(server);
            System.out.println("MNG_LIVE_CHECKS_PASSED");
        } catch (Throwable error) {
            System.out.println("MNG_LIVE_CHECKS_FAILED " + error);
        }
        finished = true;
        Minecraft.getInstance().execute(() -> { TikTokBridge.disconnect(); Minecraft.getInstance().stop(); });
    }
}
