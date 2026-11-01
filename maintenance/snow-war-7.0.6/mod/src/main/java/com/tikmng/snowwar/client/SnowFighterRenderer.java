package com.tikmng.snowwar.client;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import com.tikmng.snowwar.SnowWar;
import com.tikmng.snowwar.game.SnowFighterEntity;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.model.geom.ModelLayers;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.MobRenderer;
import net.minecraft.client.renderer.entity.layers.ItemInHandLayer;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.client.event.EntityRenderersEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import com.mojang.blaze3d.platform.NativeImage;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Mod.EventBusSubscriber(modid = SnowWar.MOD_ID, bus = Mod.EventBusSubscriber.Bus.MOD, value = Dist.CLIENT)
public final class SnowFighterRenderer extends MobRenderer<SnowFighterEntity, PlayerModel<SnowFighterEntity>> {
    private static final ResourceLocation[] SKINS = {
        ResourceLocation.fromNamespaceAndPath("minecraft", "textures/entity/player/wide/steve.png"),
        ResourceLocation.fromNamespaceAndPath("minecraft", "textures/entity/player/wide/alex.png"),
        ResourceLocation.fromNamespaceAndPath("minecraft", "textures/entity/player/wide/makena.png"),
        ResourceLocation.fromNamespaceAndPath("minecraft", "textures/entity/player/wide/zuri.png"),
        ResourceLocation.fromNamespaceAndPath("minecraft", "textures/entity/player/wide/kai.png"),
        ResourceLocation.fromNamespaceAndPath("minecraft", "textures/entity/player/wide/sunny.png"),
        ResourceLocation.fromNamespaceAndPath("minecraft", "textures/entity/player/wide/efe.png"),
        ResourceLocation.fromNamespaceAndPath("minecraft", "textures/entity/player/wide/ari.png"),
        ResourceLocation.fromNamespaceAndPath("minecraft", "textures/entity/player/wide/noor.png")
    };
    private static final ResourceLocation BAR_TEXTURE = ResourceLocation.fromNamespaceAndPath("minecraft", "textures/block/white_concrete.png");
    private static final Map<String, ResourceLocation> AVATARS = new ConcurrentHashMap<>();
    private static final Set<String> PENDING = ConcurrentHashMap.newKeySet();
    private static final HttpClient HTTP = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(4))
        .followRedirects(HttpClient.Redirect.NORMAL)
        .build();

    public SnowFighterRenderer(EntityRendererProvider.Context context) {
        super(context, new SnowFighterModel(context.bakeLayer(ModelLayers.PLAYER)), 0.42F);
        addLayer(new ItemInHandLayer<>(this, context.getItemInHandRenderer()));
    }

    @SubscribeEvent
    public static void register(EntityRenderersEvent.RegisterRenderers event) {
        event.registerEntityRenderer(SnowWar.FIGHTER.get(), SnowFighterRenderer::new);
        event.registerEntityRenderer(SnowWar.BEAST.get(), SnowBeastRenderer::new);
    }

    @Override
    public ResourceLocation getTextureLocation(SnowFighterEntity entity) {
        return SKINS[Math.floorMod(entity.getUUID().hashCode(), SKINS.length)];
    }

    @Override
    protected void scale(SnowFighterEntity entity, PoseStack pose, float partialTick) {
        float value = entity.visualScale();
        pose.scale(value, value, value);
    }

    @Override
    protected void renderNameTag(SnowFighterEntity entity, Component ignored, PoseStack pose,
                                 MultiBufferSource buffers, int light) {
        double distance = Math.sqrt(entity.distanceToSqr(entityRenderDispatcher.camera.getPosition()));
        if (distance > 128) return;
        String name = entity.getName().getString();
        String profile = entity.profileUrl();
        loadAvatar(profile);
        Font font = getFont();
        pose.pushPose();
        pose.translate(0, entity.getBbHeight() + 1.60, 0);
        pose.mulPose(entityRenderDispatcher.cameraOrientation());
        float scale = 0.052F * (1.0F + Math.min(0.28F, (float)Math.max(0, distance - 34) / 260.0F));
        pose.scale(-scale, -scale, scale);
        int nameWidth = font.width(name);
        pose.translate(0, 0, 0.08F);
        font.drawInBatch(name, -nameWidth / 2.0F, 0, 0xFFFFFFFF, false, pose.last().pose(), buffers,
            Font.DisplayMode.POLYGON_OFFSET, 0xA0000000, 0x00F000F0);
        pose.translate(0, 0, 0.08F);
        drawHearts(font, entity.getHealth(), entity.getMaxHealth(), pose, buffers, 14);
        ResourceLocation avatar = AVATARS.get(profile);
        if (avatar != null && distance <= 96) {
            pose.translate(0, -18, 0.08F);
            VertexConsumer quad = buffers.getBuffer(RenderType.entityTranslucent(avatar));
            var matrix = pose.last();
            int fullBright = 0x00F000F0;
            drawCircularAvatar(quad, matrix, 32, -16, -39, fullBright);
        }
        pose.popPose();
    }

    @Override
    protected boolean shouldShowName(SnowFighterEntity entity) {
        return entity.distanceToSqr(entityRenderDispatcher.camera.getPosition()) <= 128.0 * 128.0;
    }

    static void drawHearts(Font font, float health, float maxHealth, PoseStack pose,
                           MultiBufferSource buffers, float y) {
        int total = Math.max(1, Math.min(12, (int)Math.ceil(maxHealth / 10.0F)));
        int filled = Math.max(0, Math.min(total, (int)Math.ceil(health / 10.0F)));
        String all = "♥".repeat(total);
        font.drawInBatch(all, -font.width(all) / 2.0F, y, 0xFF541725, false, pose.last().pose(), buffers,
            Font.DisplayMode.POLYGON_OFFSET, 0xB0000000, 0x00F000F0);
        if (filled > 0) {
            String active = "♥".repeat(filled);
            float left = -font.width(all) / 2.0F;
            font.drawInBatch(active, left, y, 0xFFFF315B, false, pose.last().pose(), buffers,
                Font.DisplayMode.POLYGON_OFFSET, 0, 0x00F000F0);
        }
    }

    static String heartText(float health, float maxHealth) {
        int total = Math.max(1, Math.min(12, (int)Math.ceil(maxHealth / 10.0F)));
        int full = Math.max(0, Math.min(total, (int)Math.floor(health / 10.0F)));
        float remainder = health - full * 10.0F;
        boolean partial = full < total && remainder > 0.1F;
        int empty = Math.max(0, total - full - (partial ? 1 : 0));
        return "♥".repeat(full + (partial ? 1 : 0)) + "♡".repeat(empty);
    }

    private static void vertex(VertexConsumer quad, PoseStack.Pose pose, float x, float y, float u, float v, int light) {
        quad.vertex(pose.pose(), x, y, 0).color(255, 255, 255, 255).uv(u, v)
            .overlayCoords(OverlayTexture.NO_OVERLAY).uv2(light).normal(pose.normal(), 0, 0, 1).endVertex();
    }

    static void drawBar(MultiBufferSource buffers, PoseStack.Pose pose, float x, float y, float width,
                                float height, int red, int green, int blue, int alpha, int light) {
        if (width <= 0) return;
        VertexConsumer quad = buffers.getBuffer(RenderType.entityTranslucent(BAR_TEXTURE));
        barVertex(quad, pose, x, y, red, green, blue, alpha, light);
        barVertex(quad, pose, x, y + height, red, green, blue, alpha, light);
        barVertex(quad, pose, x + width, y + height, red, green, blue, alpha, light);
        barVertex(quad, pose, x + width, y, red, green, blue, alpha, light);
    }

    static void drawCircularAvatar(VertexConsumer quad, PoseStack.Pose pose, int size, float left, float top, int light) {
        float radius = size / 2.0F;
        for (int row = 0; row < size; row++) {
            float dy = row + 0.5F - radius;
            float inset = radius - (float)Math.sqrt(Math.max(0, radius * radius - dy * dy));
            float x1 = left + inset;
            float x2 = left + size - inset;
            float u1 = inset / size;
            float u2 = 1.0F - u1;
            float v1 = row / (float)size;
            float v2 = (row + 1) / (float)size;
            vertexUv(quad, pose, x1, top + row, u1, v1, light);
            vertexUv(quad, pose, x1, top + row + 1, u1, v2, light);
            vertexUv(quad, pose, x2, top + row + 1, u2, v2, light);
            vertexUv(quad, pose, x2, top + row, u2, v1, light);
        }
    }

    private static void vertexUv(VertexConsumer quad, PoseStack.Pose pose, float x, float y, float u, float v, int light) {
        quad.vertex(pose.pose(), x, y, 0).color(255, 255, 255, 255).uv(u, v)
            .overlayCoords(OverlayTexture.NO_OVERLAY).uv2(light).normal(pose.normal(), 0, 0, 1).endVertex();
    }

    private static void barVertex(VertexConsumer quad, PoseStack.Pose pose, float x, float y,
                                  int red, int green, int blue, int alpha, int light) {
        quad.vertex(pose.pose(), x, y, 0).color(red, green, blue, alpha).uv(0.5F, 0.5F)
            .overlayCoords(OverlayTexture.NO_OVERLAY).uv2(light).normal(pose.normal(), 0, 0, 1).endVertex();
    }

    private static void loadAvatar(String address) {
        if (address == null || address.isBlank() || AVATARS.containsKey(address) || !PENDING.add(address)) return;
        try {
            URI uri = URI.create(address);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(java.util.Locale.ROOT);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !(host.endsWith(".tiktokcdn.com")
                    || host.equals("tiktokcdn.com") || host.endsWith(".tiktokcdn-us.com")
                    || host.endsWith(".tiktokcdn-eu.com") || host.endsWith(".byteimg.com")
                    || host.endsWith(".muscdn.com"))) {
                PENDING.remove(address);
                return;
            }
            HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(6))
                .header("Accept", "image/jpeg,image/png;q=0.9,*/*;q=0.1")
                .header("User-Agent", "TikMnG-SnowWar/1.0")
                .GET().build();
            HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofByteArray()).thenAccept(response -> {
                byte[] bytes = response.body();
                if (response.statusCode() != 200 || bytes.length > 2_000_000) return;
                Minecraft.getInstance().execute(() -> {
                    try {
                        NativeImage image = NativeImage.read(new ByteArrayInputStream(bytes));
                        if (image.getWidth() > 2048 || image.getHeight() > 2048) {
                            image.close();
                            return;
                        }
                        if (image.getWidth() > 512 || image.getHeight() > 512) {
                            float factor = 512.0F / Math.max(image.getWidth(), image.getHeight());
                            NativeImage resized = new NativeImage(Math.max(1, Math.round(image.getWidth() * factor)),
                                Math.max(1, Math.round(image.getHeight() * factor)), false);
                            image.resizeSubRectTo(0, 0, image.getWidth(), image.getHeight(), resized);
                            image.close();
                            image = resized;
                        }
                        DynamicTexture dynamic = new DynamicTexture(image);
                        dynamic.setFilter(true, false);
                        ResourceLocation texture = Minecraft.getInstance().getTextureManager().register(
                            "snow_avatar", dynamic);
                        AVATARS.put(address, texture);
                        if (AVATARS.size() > 256) {
                            String oldest = AVATARS.keySet().stream().filter(key -> !key.equals(address)).findFirst().orElse(null);
                            if (oldest != null) Minecraft.getInstance().getTextureManager().release(AVATARS.remove(oldest));
                        }
                    } catch (Exception ignored) { }
                });
            }).whenComplete((result, error) -> PENDING.remove(address));
        } catch (Exception ignored) { PENDING.remove(address); }
    }

    public static ResourceLocation avatarTexture(String address) {
        loadAvatar(address);
        return AVATARS.get(address);
    }
}
