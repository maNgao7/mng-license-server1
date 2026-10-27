package com.tikmng.snowwar.client;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.Minecraft;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.CompletionStage;

public final class SnowWarLiveClient {
    private static final Gson GSON = new Gson();
    // The local bridge is a Node HTTP/1.1 server. Explicitly disabling the
    // JDK client's clear-text HTTP/2 upgrade avoids an "Invalid HTTP method"
    // response before /connect ever reaches the bridge handler.
    private static final HttpClient HTTP = HttpClient.newBuilder()
        .version(HttpClient.Version.HTTP_1_1)
        .connectTimeout(Duration.ofSeconds(5))
        .build();
    private static volatile String status = "Baglanti bekleniyor";
    private static volatile WebSocket socket;
    private static final EventLedger LEDGER = new EventLedger();
    private static volatile String activeSession = "";
    private static volatile String activeStreamer = "";
    private static final ConcurrentLinkedDeque<GiftOption> RECENT_GIFTS = new ConcurrentLinkedDeque<>();

    private SnowWarLiveClient() {}

    public static String status() { return status; }
    public static List<GiftOption> recentGifts() { return List.copyOf(RECENT_GIFTS); }

    public record GiftOption(String id, String name) {}

    private static URI base() {
        int port = Integer.getInteger("mng.bridge.port", 43821);
        return URI.create("http://127.0.0.1:" + port);
    }

    public static void connect(String username) {
        String clean = username == null ? "" : username.trim().replaceFirst("^@", "");
        if (!clean.matches("[A-Za-z0-9_.]{2,32}")) {
            status = "Gecerli bir TikTok kullanici adi yaz";
            return;
        }
        String session = Long.toHexString(System.nanoTime());
        activeSession = session;
        activeStreamer = clean;
        disconnectSocket();
        LEDGER.reset();
        status = "@" + clean + " yayini araniyor...";
        int port = Integer.getInteger("mng.bridge.port", 43821);
        HTTP.newWebSocketBuilder().connectTimeout(Duration.ofSeconds(6))
            .buildAsync(URI.create("ws://127.0.0.1:" + port + "/events"), new Events(session))
            .thenAccept(ws -> {
                if (!session.equals(activeSession)) { ws.sendClose(WebSocket.NORMAL_CLOSURE, "stale"); return; }
                socket = ws;
                JsonObject request = new JsonObject();
                request.addProperty("username", clean);
                request.addProperty("session", session);
                HttpRequest httpRequest = HttpRequest.newBuilder(base().resolve("/connect"))
                    .timeout(Duration.ofSeconds(5)).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(request))).build();
                HTTP.sendAsync(httpRequest, HttpResponse.BodyHandlers.ofString())
                    .thenAccept(response -> {
                        if (!session.equals(activeSession)) return;
                        if (response.statusCode() >= 400) status = "Baglanti istegi reddedildi: " + response.body();
                        else if (status.equals("@" + clean + " yayini araniyor...")) status = "TikTok yayini baglaniyor...";
                    }).exceptionally(error -> { if (session.equals(activeSession)) status = "Yayin servisine ulasilamadi. Launcher'i acip tekrar dene."; return null; });
            }).exceptionally(error -> {
                if (session.equals(activeSession)) status = "Yerel yayin servisi bulunamadi. Oyunu masaustu kisayolundan ac.";
                return null;
            });
    }

    public static void disconnect() {
        activeSession = "";
        activeStreamer = "";
        LEDGER.reset();
        HTTP.sendAsync(HttpRequest.newBuilder(base().resolve("/disconnect")).timeout(Duration.ofSeconds(3))
            .POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.discarding());
        disconnectSocket();
        status = "Yayin baglantisi kesildi";
    }

    private static void disconnectSocket() {
        WebSocket old = socket;
        socket = null;
        if (old != null) old.sendClose(WebSocket.NORMAL_CLOSURE, "disconnect");
    }

    private static void receive(String text, String expectedSession) {
        if (!expectedSession.equals(activeSession)) return;
        try {
            JsonObject event = JsonParser.parseString(text).getAsJsonObject();
            String receivedSession = value(event, "session");
            if (!expectedSession.equals(receivedSession)) return;
            Minecraft.getInstance().execute(() -> {
                if (!expectedSession.equals(activeSession)) return;
                String type = value(event, "type");
                if ("status".equals(type)) {
                    status = value(event, "message");
                    return;
                }
                String streamer = value(event, "streamer");
                if (!streamer.isBlank() && !streamer.equalsIgnoreCase(activeStreamer)) return;
                dispatchAudience(event, expectedSession);
                ActionDispatch action = resolveEvent(event, SnowWarClientConfig.get(), LEDGER);
                if (action != null) dispatch(action, expectedSession);
            });
        } catch (Exception ignored) {
        }
    }

    // Bridge counts are incremental batches, never totalLikeCount or stream totals.
    static ActionDispatch resolveEvent(JsonObject event, SnowWarClientConfig config, EventLedger ledger) {
        String type = value(event, "type");
        if (!"like".equals(type) && !"follow".equals(type) && !"gift".equals(type)) return null;
        String username = value(event, "username").trim().replaceFirst("^@", "");
        if (username.isBlank()) return null;
        int count = event.has("count") ? integer(event, "count", 0) : ("like".equals(type) ? 0 : 1);
        if (count <= 0 || !ledger.acceptDispatch(value(event, "dispatchId"))) return null;
        String action = null;
        int amount = 1;
        int durationSeconds = SnowWarClientConfig.DEFAULT_DURATION_SECONDS;
        long batches = count;
        if ("follow".equals(type)) {
            batches = ledger.consumeFollows(count, SnowWarClientConfig.positive(config.followsPerAction, 1));
            action = config.followAction;
            amount = config.followAmount;
            durationSeconds = config.followDurationSeconds;
        } else if ("like".equals(type)) {
            batches = ledger.consumeLikes(username, count, SnowWarClientConfig.positive(config.likesPerFighter, 100));
            action = config.likesAction;
            amount = config.likesAmount;
            durationSeconds = config.likesDurationSeconds;
        } else {
            String id = value(event, "giftId").trim();
            String displayName = value(event, "giftName").trim();
            rememberGift(id, displayName);
            // A selected catalog ID is authoritative; name-only rules remain compatible.
            for (SnowWarClientConfig.GiftRule rule : config.giftRules) {
                if (rule == null) continue;
                boolean hasId = rule.giftId != null && !rule.giftId.isBlank();
                boolean matches = hasId ? rule.giftId.equals(id)
                    : rule.giftName != null && !rule.giftName.isBlank() && rule.giftName.trim().equalsIgnoreCase(displayName);
                if (matches) {
                    action = rule.action;
                    amount = rule.amount;
                    durationSeconds = rule.durationSeconds;
                    break;
                }
            }
        }
        if (action == null || action.isBlank() || batches <= 0) return null;
        return new ActionDispatch(action, username, value(event, "profile"), multipliedCount(batches, amount), durationSeconds);
    }

    static int multipliedCount(long batches, int amount) {
        return (int)Math.min(Integer.MAX_VALUE, batches * SnowWarClientConfig.positive(amount, 1));
    }

    record ActionDispatch(String action, String username, String profile, int count, int durationSeconds) {
        ActionDispatch {
            durationSeconds = SnowWarClientConfig.durationSeconds(durationSeconds);
        }
    }

    static final class EventLedger {
        private static final int MAX_DISPATCH_IDS = 16384;
        private final Map<String, Long> likeRemainders = new HashMap<>();
        private final LinkedHashSet<String> dispatchIds = new LinkedHashSet<>();
        private long followRemainder;

        synchronized boolean acceptDispatch(String id) {
            if (id.isBlank()) return true;
            if (!dispatchIds.add(id)) return false;
            if (dispatchIds.size() > MAX_DISPATCH_IDS) dispatchIds.remove(dispatchIds.iterator().next());
            return true;
        }

        synchronized long consumeLikes(String viewer, int count, int threshold) {
            String key = viewer.toLowerCase(Locale.ROOT);
            long total = likeRemainders.getOrDefault(key, 0L) + count;
            long remainder = total % threshold;
            if (remainder == 0) likeRemainders.remove(key);
            else likeRemainders.put(key, remainder);
            return total / threshold;
        }

        synchronized long consumeFollows(int count, int threshold) {
            long total = followRemainder + count;
            followRemainder = total % threshold;
            return total / threshold;
        }

        synchronized void reset() {
            likeRemainders.clear();
            dispatchIds.clear();
            followRemainder = 0;
        }
    }

    private static void rememberGift(String id, String name) {
        if (name.isBlank()) return;
        RECENT_GIFTS.removeIf(gift -> (!id.isBlank() && id.equals(gift.id())) || name.equalsIgnoreCase(gift.name()));
        RECENT_GIFTS.addFirst(new GiftOption(id, name));
        while (RECENT_GIFTS.size() > 20) RECENT_GIFTS.removeLast();
    }

    static void testAction(String action, int amount) {
        testAction(action, amount, SnowWarClientConfig.DEFAULT_DURATION_SECONDS);
    }

    static void testAction(String action, int amount, int durationSeconds) {
        dispatch(new ActionDispatch(action, "DenemeIzleyicisi", "", multipliedCount(1, amount), durationSeconds), null);
    }

    private static void dispatch(ActionDispatch action, String expectedSession) {
        JsonObject payload = new JsonObject();
        payload.addProperty("action", action.action());
        payload.addProperty("username", action.username());
        payload.addProperty("profile", action.profile());
        payload.addProperty("count", action.count());
        payload.addProperty("durationSeconds", action.durationSeconds());
        String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(GSON.toJson(payload).getBytes(StandardCharsets.UTF_8));
        Minecraft.getInstance().execute(() -> {
            if (expectedSession != null && !expectedSession.equals(activeSession)) return;
            if (Minecraft.getInstance().player != null) Minecraft.getInstance().player.connection.sendCommand("snowwar event " + encoded);
        });
    }

    private static void dispatchAudience(JsonObject event, String expectedSession) {
        String type = value(event, "type");
        if (!"like".equals(type) && !"follow".equals(type) && !"gift".equals(type)) return;
        String username = value(event, "username").trim().replaceFirst("^@", "");
        if (username.isBlank()) return;
        JsonObject payload = new JsonObject();
        payload.addProperty("username", username);
        payload.addProperty("profile", value(event, "profile"));
        payload.addProperty("liked", "like".equals(type));
        String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(
            GSON.toJson(payload).getBytes(StandardCharsets.UTF_8));
        Minecraft.getInstance().execute(() -> {
            if (!expectedSession.equals(activeSession)) return;
            if (Minecraft.getInstance().player != null)
                Minecraft.getInstance().player.connection.sendCommand("snowwar audience " + encoded);
        });
    }

    private static String value(JsonObject object, String key) {
        try { return object.has(key) && !object.get(key).isJsonNull() ? object.get(key).getAsString() : ""; }
        catch (Exception ignored) { return ""; }
    }

    private static int integer(JsonObject object, String key, int fallback) {
        try { return Math.toIntExact(object.get(key).getAsLong()); } catch (Exception ignored) { return fallback; }
    }

    private static final class Events implements WebSocket.Listener {
        private final String session;
        private final StringBuilder buffer = new StringBuilder();
        private Events(String session) { this.session = session; }
        @Override public void onOpen(WebSocket webSocket) { webSocket.request(1); }
        @Override public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            buffer.append(data);
            if (last) { receive(buffer.toString(), session); buffer.setLength(0); }
            webSocket.request(1);
            return null;
        }
        @Override public CompletionStage<?> onClose(WebSocket webSocket, int code, String reason) {
            if (session.equals(activeSession)) {
                socket = null;
                if (!"Yayin baglantisi kesildi".equals(status)) status = "Canli yayin baglantisi kesildi";
            }
            return null;
        }
        @Override public void onError(WebSocket webSocket, Throwable error) {
            if (session.equals(activeSession)) {
                socket = null;
                status = "Canli yayin baglantisi kesildi";
            }
        }
    }
}
