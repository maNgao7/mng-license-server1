package com.tikmng.zombiestrike;

import net.minecraft.client.Minecraft;
import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.concurrent.*;
import com.google.gson.*;

public final class TikTokBridge implements WebSocket.Listener {
    private static final int PORT = Integer.getInteger("mng.bridge.port", 43821);
    private static final URI HTTP = URI.create("http://127.0.0.1:" + PORT);
    // Node/ws rejects the default Java HTTP/2 upgrade before /health is handled.
    private static final HttpClient CLIENT = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1)
        .connectTimeout(Duration.ofSeconds(4)).build();
    private static volatile String status = "Bağlantı yok", lastEvent = "Henüz olay gelmedi";
    private static volatile WebSocket socket;
    private static CompletableFuture<WebSocket> opening;
    private static volatile boolean wanted;
    private static volatile long intent;
    private static volatile String requestedUsername = "", activeSession = "";
    private static boolean initialized;
    private static CompletableFuture<Void> requests = CompletableFuture.completedFuture(null);
    private static CompletableFuture<Void> serviceStarting;
    private static int ticks;
    private static final java.util.Set<String> processedDispatches = java.util.concurrent.ConcurrentHashMap.newKeySet();
    private final StringBuilder incoming = new StringBuilder();
    private final long generation;
    private final String session;
    private TikTokBridge(long generation, String session) { this.generation = generation; this.session = session; }
    public static String status() { return status; }
    public static String lastEvent() { return lastEvent; }
    public static void tick() {
        if (!initialized) {
            initialized = true;
            enqueue(() -> post("/disconnect", new JsonObject()).exceptionally(error -> null));
        }
        if (wanted && ++ticks % 60 == 0) refreshStatus(intent, activeSession);
    }

    private static synchronized void enqueue(java.util.function.Supplier<CompletableFuture<Void>> request) {
        requests = requests.handle((value, error) -> null).thenComposeAsync(ignored -> request.get());
    }

    private static boolean isCurrent(long generation, String session) {
        return wanted && intent == generation && activeSession.equals(session);
    }

    private static synchronized void closeSocket() {
        var old = socket;
        socket = null;
        opening = null;
        if (old != null) old.abort();
    }

    public static void connect(String username) {
        long generation = ++intent;
        wanted = false;
        closeSocket();
        processedDispatches.clear();
        lastEvent = "Henüz olay gelmedi";
        String value = username.trim().replaceFirst("^@", "").toLowerCase(java.util.Locale.ROOT);
        if (!value.matches("[a-zA-Z0-9_.]{2,32}")) {
            status = "Geçerli @kullanıcı adını yazın.";
            enqueue(() -> post("/disconnect", new JsonObject()).exceptionally(error -> null));
            return;
        }
        GameConfig.get().username = value; GameConfig.get().save();
        requestedUsername = value;
        String session = java.util.UUID.randomUUID().toString();
        activeSession = session;
        wanted = true; status = "@" + value + " bağlantısı hazırlanıyor...";
        JsonObject payload = new JsonObject(); payload.addProperty("username", value); payload.addProperty("session", session);
        enqueue(() -> {
            if (!isCurrent(generation, session)) return CompletableFuture.completedFuture(null);
            return ensureService()
                .thenCompose(v -> isCurrent(generation, session) ? ensureSocket(generation, session) : CompletableFuture.failedFuture(new CancellationException()))
                .thenCompose(v -> isCurrent(generation, session) ? post("/connect", payload) : CompletableFuture.failedFuture(new CancellationException()))
                .thenRun(() -> { if (isCurrent(generation, session)) refreshStatus(generation, session); })
                .exceptionally(error -> {
                    if (isCurrent(generation, session)) { status = friendlyError(error); wanted = false; closeSocket(); }
                    return null;
                });
        });
    }
    public static void disconnect() {
        ++intent; wanted = false; requestedUsername = ""; activeSession = "";
        closeSocket();
        processedDispatches.clear();
        GameConfig.get().username = ""; GameConfig.get().save();
        status = "Bağlantı kesildi."; lastEvent = "Henüz olay gelmedi";
        enqueue(() -> post("/disconnect", new JsonObject()).exceptionally(error -> null));
    }
    private static synchronized CompletableFuture<Void> ensureService() {
        if (serviceStarting != null && !serviceStarting.isDone()) return serviceStarting;
        serviceStarting = CompletableFuture.runAsync(() -> {
            try {
                try {
                    var response = CLIENT.send(HttpRequest.newBuilder(HTTP.resolve("/health")).timeout(Duration.ofSeconds(2)).GET().build(), HttpResponse.BodyHandlers.ofString());
                    if (response.statusCode() == 200 && response.body().contains("\"version\":\"9\"")) return;
                } catch (Exception ignored) { }
                var root = Minecraft.getInstance().gameDirectory.toPath().toAbsolutePath().normalize().getParent();
                var script = root.resolve("live-bridge/server.js");
                if (!java.nio.file.Files.isRegularFile(script)) throw new java.io.IOException("Bridge file missing");
                String node = findNode();
                var builder = new ProcessBuilder(node, script.toString()).directory(script.getParent().toFile());
                builder.environment().put("MNG_BRIDGE_PORT", Integer.toString(PORT));
                if (Boolean.getBoolean("mng.node.electron")) builder.environment().put("ELECTRON_RUN_AS_NODE", "1");
                builder.redirectOutput(ProcessBuilder.Redirect.appendTo(script.getParent().resolve("bridge.log").toFile()))
                    .redirectError(ProcessBuilder.Redirect.appendTo(script.getParent().resolve("bridge-error.log").toFile())).start();
                for (int i = 0; i < 20; i++) {
                    Thread.sleep(300);
                    try {
                        var response = CLIENT.send(HttpRequest.newBuilder(HTTP.resolve("/health")).timeout(Duration.ofSeconds(1)).GET().build(), HttpResponse.BodyHandlers.ofString());
                        if (response.statusCode() == 200 && response.body().contains("\"version\":\"9\"")) return;
                    } catch (Exception ignored) { }
                }
                throw new java.io.IOException("Bridge readiness timeout");
            } catch (Exception e) { throw new CompletionException(e); }
        });
        return serviceStarting;
    }
    private static String findNode() throws IOException {
        String bundled = System.getProperty("mng.node.path", "");
        if (!bundled.isBlank() && java.nio.file.Files.isRegularFile(java.nio.file.Path.of(bundled))) return bundled;
        java.util.List<java.nio.file.Path> candidates = java.util.List.of(
            java.nio.file.Path.of(System.getenv().getOrDefault("ProgramFiles", "C:\\Program Files"), "nodejs", "node.exe"),
            java.nio.file.Path.of(System.getenv().getOrDefault("LOCALAPPDATA", ""), "Programs", "nodejs", "node.exe")
        );
        for (var candidate : candidates) if (java.nio.file.Files.isRegularFile(candidate)) return candidate.toString();
        return "node";
    }
    private static CompletableFuture<Void> post(String path, JsonObject body) {
        return CLIENT.sendAsync(HttpRequest.newBuilder(HTTP.resolve(path)).header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body.toString())).timeout(Duration.ofSeconds(6)).build(), HttpResponse.BodyHandlers.ofString())
            .thenCompose(response -> {
                if (response.statusCode() >= 400) {
                    String message;
                    try { message = JsonParser.parseString(response.body()).getAsJsonObject().get("error").getAsString(); }
                    catch (Exception e) { message = "Bağlantı servisi hatası: " + response.statusCode(); }
                    return CompletableFuture.failedFuture(new IOException(message));
                }
                return CompletableFuture.completedFuture(null);
            });
    }
    private static synchronized CompletableFuture<WebSocket> ensureSocket(long generation, String session) {
        if (socket != null && !socket.isInputClosed() && !socket.isOutputClosed()) return CompletableFuture.completedFuture(socket);
        if (opening != null && !opening.isDone()) return opening;
        opening = CLIENT.newWebSocketBuilder().connectTimeout(Duration.ofSeconds(4))
            .buildAsync(URI.create("ws://127.0.0.1:" + PORT + "/events"), new TikTokBridge(generation, session));
        return opening;
    }
    private static String friendlyError(Throwable error) {
        Throwable cause = error;
        while ((cause instanceof CompletionException || cause instanceof ExecutionException) && cause.getCause() != null) cause = cause.getCause();
        String message = cause.getMessage() == null ? "" : cause.getMessage();
        if (message.contains("Room ID")) return "TikTok yayın odası bulunamadı. Kullanıcı adını ve yayının açık olduğunu kontrol edin.";
        if (message.contains("Bridge file missing")) return "Yayın servisi dosyası bulunamadı. Oyunu başlatıcıdan açın.";
        if (message.contains("readiness timeout") || cause instanceof java.net.ConnectException)
            return "Yerel yayın servisi başlatılamadı. Oyunu TikMnG launcher üzerinden yeniden açın.";
        return message.isBlank() ? "TikTok bağlantısı kurulamadı. Biraz sonra tekrar deneyin." : "TikTok bağlantısı kurulamadı: " + message;
    }
    @Override public void onOpen(WebSocket ws) {
        if (!isCurrent(generation, session)) { ws.abort(); return; }
        socket = ws; ws.request(1);
    }
    @Override public CompletionStage<?> onText(WebSocket ws, CharSequence data, boolean last) {
        incoming.append(data);
        if (incoming.length() > 65536) { incoming.setLength(0); ws.abort(); return null; }
        if (!last) { ws.request(1); return null; }
        try {
            if (!isCurrent(generation, session)) return null;
            JsonObject json = JsonParser.parseString(incoming.toString()).getAsJsonObject();
            if (!session.equals(text(json, "session"))) return null;
            String type = text(json, "type");
            if (type.equals("status")) {
                if (!requestedUsername.equalsIgnoreCase(text(json, "username"))) return null;
                status = text(json, "message");
                if (text(json, "state").equals("error") || text(json, "state").equals("disconnected")) wanted = false;
            }
            if (type.equals("gift") || type.equals("like") || type.equals("follow")) {
                if (!requestedUsername.equalsIgnoreCase(text(json, "streamer"))) return null;
                String dispatchId = text(json, "dispatchId");
                if (!dispatchId.isBlank() && !processedDispatches.add(dispatchId)) return null;
                if (processedDispatches.size() > 10000) {
                    processedDispatches.clear();
                    if (!dispatchId.isBlank()) processedDispatches.add(dispatchId);
                }
                String trigger = type.equals("gift") ? resolveGiftTrigger(text(json, "giftId"), text(json, "giftName")) : type;
                String name = text(json, "username").replaceAll("[\\p{Cntrl}§]", "");
                GameState.Viewer viewer = new GameState.Viewer(name, text(json, "profile"));
                int count = json.has("count") ? Math.max(1, Math.min(10000, json.get("count").getAsInt())) : 1;
                lastEvent = "@" + name + " · " + trigger + " ×" + count;
                Minecraft mc = Minecraft.getInstance();
                mc.execute(() -> {
                    if (!isCurrent(generation, session)) return;
                    var server = mc.getSingleplayerServer();
                    if (server == null || mc.player == null) return;
                    var id = mc.player.getUUID();
                    server.execute(() -> {
                        if (!isCurrent(generation, session)) return;
                        var player = server.getPlayerList().getPlayer(id);
                        if (player == null) return;
                        com.mojang.logging.LogUtils.getLogger().info("MNG live apply: {} {} count={} dispatch={}", trigger, name, count, dispatchId);
                        InteractionEngine.event(player, trigger, count, viewer);
                    });
                });
            }
        } catch (RuntimeException invalid) { com.mojang.logging.LogUtils.getLogger().warn("Invalid live event", invalid); }
        finally { incoming.setLength(0); ws.request(1); }
        return null;
    }
    private static String text(JsonObject json, String key) { return json.has(key) && !json.get(key).isJsonNull() ? json.get(key).getAsString() : ""; }
    static String resolveGiftTrigger(String id, String name) {
        // TikTok has exposed Mishka under two catalog IDs. Keep one visible
        // rule while accepting either regional ID from the live stream.
        if (id.equals("5566") && GameConfig.get().rules.containsKey("gift:5486")) return "gift:5486";
        String exact = "gift:" + id;
        if (!id.isBlank() && GameConfig.get().rules.containsKey(exact)) return exact;

        String normalized = java.text.Normalizer.normalize(name == null ? "" : name, java.text.Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "").toLowerCase(java.util.Locale.ROOT)
            .replace('ı', 'i').replaceAll("[^a-z0-9]+", " ").trim();
        String canonical = switch (normalized) {
            case "gul", "rose" -> "5655";
            case "donat", "doughnut", "donut" -> "5879";
            case "rosa" -> "8913";
            case "cay", "tea" -> "5303";
            case "kalp", "heart" -> "5282";
            case "mishka", "mishka bear" -> "5486";
            case "sapka ve biyik", "hat and mustache", "cap and mustache" -> "6427";
            case "para tabancasi", "money gun" -> "7168";
            case "turk kahvesi", "turkish coffee" -> "5994";
            case "beni sev", "love you" -> "7934";
            case "galaksi", "galaxy" -> "11046";
            case "parfum", "perfume" -> "5658";
            case "blue bead", "nazar boncugu" -> "5319";
            default -> "";
        };
        if (!canonical.isBlank() && GameConfig.get().rules.containsKey("gift:" + canonical)) return "gift:" + canonical;
        return exact;
    }
    private static void refreshStatus(long generation, String session) {
        CLIENT.sendAsync(HttpRequest.newBuilder(HTTP.resolve("/health")).timeout(Duration.ofSeconds(2)).GET().build(), HttpResponse.BodyHandlers.ofString())
            .thenAccept(response -> {
                try {
                    JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
                    if (!isCurrent(generation, session) || !session.equals(text(json, "session"))
                        || !requestedUsername.equalsIgnoreCase(text(json, "username"))) return;
                    status = text(json, "message");
                    if (text(json, "state").equals("error") || text(json, "state").equals("disconnected")) wanted = false;
                } catch (Exception ignored) { }
            }).exceptionally(error -> {
                if (isCurrent(generation, session)) { wanted = false; status = "Yayın servisi bağlantısı kesildi. Bağlan düğmesiyle tekrar deneyebilirsiniz."; closeSocket(); }
                return null;
            });
    }
    private void socketClosed(WebSocket ws) {
        if (socket != ws || !isCurrent(generation, session)) return;
        socket = null; wanted = false;
        status = "Yerel bağlantı kesildi. Bağlan düğmesiyle tekrar deneyebilirsiniz.";
    }
    @Override public CompletionStage<?> onClose(WebSocket ws, int code, String reason) { socketClosed(ws); return null; }
    @Override public void onError(WebSocket ws, Throwable error) { socketClosed(ws); }
}
