package com.tikmng.snowwar.game;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

public final class SnowWarCommands {
    private SnowWarCommands() {}

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher, SnowWarEngine engine) {
        dispatcher.register(Commands.literal("snowwar")
            .then(Commands.literal("capacity")
                .then(Commands.argument("value", IntegerArgumentType.integer(ParticipantCapacity.MIN, ParticipantCapacity.MAX)).executes(ctx -> {
                    int value = IntegerArgumentType.getInteger(ctx, "value");
                    engine.setParticipantCapacity(value);
                    ctx.getSource().sendSuccess(() -> Component.literal("Katilimci kapasitesi: " + value), false);
                    return 1;
                })))
            .then(Commands.literal("lobbywait")
                .then(Commands.argument("seconds", IntegerArgumentType.integer(0, 120)).executes(ctx -> {
                    engine.setLobbyWaitSeconds(IntegerArgumentType.getInteger(ctx, "seconds"));
                    return 1;
                })))
            .then(Commands.literal("throw").executes(ctx -> {
                engine.firePlayerWeapon(ctx.getSource().getPlayerOrException());
                return 1;
            }))
            .then(Commands.literal("fly").executes(ctx -> {
                ServerPlayer player = ctx.getSource().getPlayerOrException();
                boolean enable = !player.getPersistentData().getBoolean("mng_royale_flight");
                player.getPersistentData().putBoolean("mng_royale_flight", enable);
                player.getAbilities().mayfly = enable;
                player.getAbilities().flying = enable;
                player.onUpdateAbilities();
                player.displayClientMessage(Component.literal(enable ? "Uçuş açıldı" : "Uçuş kapandı"), true);
                return 1;
            }))
            .then(Commands.literal("start").executes(ctx -> {
                engine.start(ctx.getSource().getPlayerOrException());
                return 1;
            }))
            .then(Commands.literal("stop").executes(ctx -> {
                engine.stop(ctx.getSource().getPlayerOrException());
                return 1;
            }))
            .then(Commands.literal("reset").executes(ctx -> {
                engine.resetRoundNow(ctx.getSource().getPlayerOrException());
                return 1;
            }))
            .then(Commands.literal("shrink").executes(ctx -> {
                engine.shrinkZoneNow(ctx.getSource().getPlayerOrException());
                return 1;
            }))
            .then(Commands.literal("zoneinterval")
                .then(Commands.argument("seconds", IntegerArgumentType.integer(10, 120)).executes(ctx -> {
                    int seconds = IntegerArgumentType.getInteger(ctx, "seconds");
                    engine.setZoneIntervalSeconds(seconds);
                    ctx.getSource().sendSuccess(() -> Component.literal("Alan daralma aralığı: " + seconds + " saniye"), false);
                    return 1;
                })))
            .then(Commands.literal("health")
                .then(Commands.argument("value", IntegerArgumentType.integer(1, 1000)).executes(ctx -> {
                    ServerPlayer player = ctx.getSource().getPlayerOrException();
                    float value = IntegerArgumentType.getInteger(ctx, "value");
                    if (player.getAttribute(net.minecraft.world.entity.ai.attributes.Attributes.MAX_HEALTH) != null) {
                        player.getPersistentData().putFloat("mng_player_health", value);
                        player.getAttribute(net.minecraft.world.entity.ai.attributes.Attributes.MAX_HEALTH).setBaseValue(value);
                        player.setHealth(value);
                    }
                    player.displayClientMessage(Component.literal("Yayıncı canı: " + (int)value), true);
                    return 1;
                })))
            .then(Commands.literal("winnerdelay")
                .then(Commands.argument("seconds", IntegerArgumentType.integer(1, 120)).executes(ctx -> {
                    int seconds = IntegerArgumentType.getInteger(ctx, "seconds");
                    engine.setWinnerDelaySeconds(seconds);
                    ctx.getSource().sendSuccess(() -> Component.literal("Bitiş süresi: " + seconds + " saniye"), false);
                    return 1;
                })))
            .then(Commands.literal("effectvolume")
                .then(Commands.argument("value", IntegerArgumentType.integer(0, 100)).executes(ctx -> {
                    ServerPlayer player = ctx.getSource().getPlayerOrException();
                    int value = IntegerArgumentType.getInteger(ctx, "value");
                    player.getPersistentData().putInt("mng_effect_volume", value);
                    player.displayClientMessage(Component.literal("Efekt sesi: %" + value), true);
                    return 1;
                })))
            .then(Commands.literal("time")
                .then(Commands.literal("day").executes(ctx -> {
                    engine.setTimeMode(ctx.getSource().getServer(), "day");
                    ctx.getSource().sendSuccess(() -> Component.literal("Gündüz modu açıldı."), false);
                    return 1;
                }))
                .then(Commands.literal("night").executes(ctx -> {
                    engine.setTimeMode(ctx.getSource().getServer(), "night");
                    ctx.getSource().sendSuccess(() -> Component.literal("Gece modu açıldı."), false);
                    return 1;
                }))
                .then(Commands.literal("sunset").executes(ctx -> {
                    engine.setTimeMode(ctx.getSource().getServer(), "sunset");
                    ctx.getSource().sendSuccess(() -> Component.literal("Gün batımı modu açıldı."), false);
                    return 1;
                })))
            .then(Commands.literal("join")
                .then(Commands.argument("viewer", StringArgumentType.word()).executes(ctx -> {
                    ServerPlayer host = ctx.getSource().getPlayerOrException();
                    String viewer = StringArgumentType.getString(ctx, "viewer");
                    engine.join(host, viewer, viewer, "");
                    return 1;
                }))
            )
            .then(Commands.literal("audience")
                .then(Commands.argument("payload", StringArgumentType.word()).executes(ctx -> {
                    ServerPlayer host = ctx.getSource().getPlayerOrException();
                    try {
                        byte[] bytes = Base64.getUrlDecoder().decode(StringArgumentType.getString(ctx, "payload"));
                        JsonObject data = JsonParser.parseString(new String(bytes, StandardCharsets.UTF_8)).getAsJsonObject();
                        engine.audience(host,
                            data.has("username") ? data.get("username").getAsString() : "Izleyici",
                            data.has("profile") ? data.get("profile").getAsString() : "",
                            data.has("liked") && data.get("liked").getAsBoolean());
                        return 1;
                    } catch (Exception ignored) { return 0; }
                })))
            .then(Commands.literal("profile")
                .then(Commands.argument("payload", StringArgumentType.word()).executes(ctx -> {
                    try {
                        byte[] bytes = Base64.getUrlDecoder().decode(StringArgumentType.getString(ctx, "payload"));
                        JsonObject data = JsonParser.parseString(new String(bytes, StandardCharsets.UTF_8)).getAsJsonObject();
                        engine.updateProfile(ctx.getSource().getPlayerOrException(),
                            data.get("username").getAsString(), data.get("profile").getAsString());
                        return 1;
                    } catch (Exception ignored) { return 0; }
                })))
            .then(Commands.literal("event")
                .then(Commands.argument("payload", StringArgumentType.word()).executes(ctx -> {
                    ServerPlayer host = ctx.getSource().getPlayerOrException();
                    try {
                        byte[] bytes = Base64.getUrlDecoder().decode(StringArgumentType.getString(ctx, "payload"));
                        JsonObject data = JsonParser.parseString(new String(bytes, StandardCharsets.UTF_8)).getAsJsonObject();
                        String action = data.has("action") ? data.get("action").getAsString() : "OYUNCU";
                        String username = data.has("username") ? data.get("username").getAsString() : "Izleyici";
                        String profile = data.has("profile") ? data.get("profile").getAsString() : "";
                        int count = data.has("count") ? data.get("count").getAsInt() : 1;
                        int duration = data.has("durationSeconds") ? data.get("durationSeconds").getAsInt() : 10;
                        engine.applyAction(host, action, username, profile, count, duration);
                        return 1;
                    } catch (Exception ignored) {
                        host.displayClientMessage(Component.literal("Canli etkinlik okunamadi."), false);
                        return 0;
                    }
                }))
            )
        );
    }
}
