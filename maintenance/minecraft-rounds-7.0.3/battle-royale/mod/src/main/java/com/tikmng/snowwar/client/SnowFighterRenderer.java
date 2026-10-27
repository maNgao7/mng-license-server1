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
import net.minecraft.client.renderer.entity.layers.RenderLayer;
import net.minecraft.client.renderer.entity.ItemRenderer;
import net.minecraft.world.item.ItemDisplayContext;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
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
    private static ResourceLocation barTexture;
    private static final Map<String, ResourceLocation> AVATARS = new ConcurrentHashMap<>();
    private static final Map<String, Integer> AVATAR_SIZES = new ConcurrentHashMap<>();
    private static final Map<String, Long> RETRY_AFTER = new ConcurrentHashMap<>();
    private static final Set<String> PENDING = ConcurrentHashMap.newKeySet();
    private static final HttpClient HTTP = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(4))
        .followRedirects(HttpClient.Redirect.NORMAL)
        .build();

    public SnowFighterRenderer(EntityRendererProvider.Context context) {
        super(context, new SnowFighterModel(context.bakeLayer(ModelLayers.PLAYER)), 0.42F);
        addLayer(new ItemInHandLayer<>(this, context.getItemInHandRenderer()));
        addLayer(new BackpackLayer(this, context.getItemRenderer()));
        addLayer(new net.minecraft.client.renderer.entity.layers.HumanoidArmorLayer<>(this,
            new net.minecraft.client.model.HumanoidModel<>(context.bakeLayer(ModelLayers.PLAYER_INNER_ARMOR)),
            new net.minecraft.client.model.HumanoidModel<>(context.bakeLayer(ModelLayers.PLAYER_OUTER_ARMOR)),
            context.getModelManager()));
    }

    private static final class BackpackLayer extends RenderLayer<SnowFighterEntity, PlayerModel<SnowFighterEntity>> {
        private final ItemRenderer itemRenderer;

        private BackpackLayer(SnowFighterRenderer parent, ItemRenderer itemRenderer) {
            super(parent);
            this.itemRenderer = itemRenderer;
        }

        @Override
        public void render(PoseStack pose, MultiBufferSource buffers, int light, SnowFighterEntity entity,
                           float walk, float speed, float partialTick, float age, float yaw, float pitch) {
            if (entity.parachuting()) return;
            ItemStack backpack = new ItemStack(entity.vestTier() >= 3 ? Items.BLACK_SHULKER_BOX
                : entity.vestTier() >= 2 ? Items.GRAY_SHULKER_BOX : Items.BROWN_SHULKER_BOX);
            pose.pushPose();
            getParentModel().body.translateAndRotate(pose);
            pose.translate(0.0, 0.34, 0.24);
            pose.scale(0.48F, 0.58F, 0.34F);
            itemRenderer.renderStatic(entity, backpack, ItemDisplayContext.FIXED, false, pose, buffers,
                entity.level(), light, OverlayTexture.NO_OVERLAY, entity.getId());
            pose.popPose();
        }
    }

    @SubscribeEvent
    public static void register(EntityRenderersEvent.RegisterRenderers event) {
        event.registerEntityRenderer(SnowWar.FIGHTER.get(), SnowFighterRenderer::new);
        event.registerEntityRenderer(SnowWar.BEAST.get(), SnowBeastRenderer::new);
        event.registerEntityRenderer(net.minecraft.world.entity.EntityType.ARROW, BattleBulletRenderer::new);
    }

    @Override
    public ResourceLocation getTextureLocation(SnowFighterEntity entity) {
        return SKINS[Math.floorMod(entity.getUUID().hashCode(), SKINS.length)];
    }

    @Override
    public void render(SnowFighterEntity entity, float yaw, float partialTick, PoseStack pose,
                       MultiBufferSource buffers, int light) {
        super.render(entity, yaw, partialTick, pose, buffers, 0x00F000F0);
        float age = entity.healAnimationAge(partialTick);
        if (age >= 0 && age < 32) {
            for (int i = 0; i < 6; i++) {
                double angle = i * Math.PI / 3;
                pose.pushPose();
                pose.translate(Math.cos(angle)*0.65, 0.4 + age*0.04 + i%2*0.35, Math.sin(angle)*0.65);
                pose.mulPose(entityRenderDispatcher.cameraOrientation());
                pose.scale(0.025F, 0.025F, 0.025F);
                int alpha = (int)(255*(1-age/32));
                drawBar(buffers, pose.last(), -2, -7, 4, 14, 55, 255, 100, alpha, 0x00F000F0);
                drawBar(buffers, pose.last(), -7, -2, 14, 4, 55, 255, 100, alpha, 0x00F000F0);
                pose.popPose();
            }
        }
    }

    @Override
    protected int getBlockLightLevel(SnowFighterEntity entity, net.minecraft.core.BlockPos position) {
        return 15;
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
        pose.translate(0, entity.getBbHeight() + 2.3, 0);
        pose.mulPose(entityRenderDispatcher.cameraOrientation());
        float scale = 0.043F * (1.0F + Math.min(0.55F, (float)Math.max(0, distance - 28) / 130.0F));
        pose.scale(-scale, -scale, scale);
        int nameWidth = font.width(name);
        pose.translate(0, 0, 0.08F);
        font.drawInBatch(name, -nameWidth / 2.0F, 0, 0xFFFFFFFF, false, pose.last().pose(), buffers,
            Font.DisplayMode.POLYGON_OFFSET, 0xA0000000, 0x00F000F0);
        pose.translate(0, 0, 0.08F);
        float healthWidth = 58.0F;
        float healthRatio = Math.max(0.0F, Math.min(1.0F, entity.getHealth() / entity.getMaxHealth()));
        drawBar(buffers, pose.last(), -29, 13, 58, 1, 220, 230, 235, 255, 0x00F000F0);
        drawBar(buffers, pose.last(), -29, 20, 58, 1, 220, 230, 235, 255, 0x00F000F0);
        drawBar(buffers, pose.last(), -29, 14, 1, 6, 220, 230, 235, 255, 0x00F000F0);
        drawBar(buffers, pose.last(), 28, 14, 1, 6, 220, 230, 235, 255, 0x00F000F0);
        drawBar(buffers, pose.last(), -28 + 56 * healthRatio, 14, 56 * (1-healthRatio), 6,
            30, 25, 30, 255, 0x00F000F0);
        drawBar(buffers, pose.last(), -healthWidth / 2 + 1, 14, (healthWidth - 2) * healthRatio, 6,
            healthRatio >= 0.5F ? (int)(255 * (1 - healthRatio) * 2) : 255,
            healthRatio >= 0.5F ? 245 : (int)(245 * healthRatio * 2), 40, 255, 0x00F000F0);
        for (int hit = 0; hit < entity.armorHits(); hit++)
            drawShield(buffers, pose.last(), (hit-(entity.armorHits()-1)/2.0F)*11, 25);
        VertexConsumer weaponIcon = buffers.getBuffer(RenderType.entityTranslucent(
            com.tikmng.snowwar.game.BattleRoyaleWeapons.icon(entity.weaponTier())));
        vertexUv(weaponIcon, pose.last(), -8, 38, 0, 0, 0x00F000F0);
        vertexUv(weaponIcon, pose.last(), -8, 46, 0, 1, 0x00F000F0);
        vertexUv(weaponIcon, pose.last(), 8, 46, 1, 1, 0x00F000F0);
        vertexUv(weaponIcon, pose.last(), 8, 38, 1, 0, 0x00F000F0);
        if (entity.parachuting()) {
            drawBar(buffers, pose.last(), -28, -82, 56, 5, 55, 83, 63, 250, 0x00F000F0);
            drawBar(buffers, pose.last(), -39, -77, 78, 6, 78, 112, 74, 250, 0x00F000F0);
            drawBar(buffers, pose.last(), -48, -71, 96, 7, 139, 49, 42, 250, 0x00F000F0);
            drawBar(buffers, pose.last(), -42, -64, 84, 5, 184, 72, 50, 245, 0x00F000F0);
            drawLine(buffers, pose.last(), -39, -59, -15, -18, 1.4F, 226, 220, 197, 235, 0x00F000F0);
            drawLine(buffers, pose.last(), 39, -59, 15, -18, 1.4F, 226, 220, 197, 235, 0x00F000F0);
            drawLine(buffers, pose.last(), -16, -62, -8, -18, 1.2F, 226, 220, 197, 225, 0x00F000F0);
            drawLine(buffers, pose.last(), 16, -62, 8, -18, 1.2F, 226, 220, 197, 225, 0x00F000F0);
        }
        ResourceLocation avatar = AVATARS.get(profile);
        if (avatar != null && distance <= 96) {
            VertexConsumer quad = buffers.getBuffer(RenderType.entityTranslucent(avatar));
            var matrix = pose.last();
            int fullBright = 0x00F000F0;
            drawCircularAvatar(quad, matrix, 28, -14, -32, fullBright);
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
        VertexConsumer quad = buffers.getBuffer(RenderType.entityTranslucentEmissive(solidTexture()));
        barVertex(quad, pose, x, y, red, green, blue, alpha, light);
        barVertex(quad, pose, x, y + height, red, green, blue, alpha, light);
        barVertex(quad, pose, x + width, y + height, red, green, blue, alpha, light);
        barVertex(quad, pose, x + width, y, red, green, blue, alpha, light);
    }

    private static void drawLine(MultiBufferSource buffers, PoseStack.Pose pose, float x1, float y1,
                                 float x2, float y2, float thickness, int red, int green, int blue,
                                 int alpha, int light) {
        float dx = x2 - x1;
        float dy = y2 - y1;
        float length = (float)Math.sqrt(dx * dx + dy * dy);
        if (length < 0.01F) return;
        float px = -dy / length * thickness * 0.5F;
        float py = dx / length * thickness * 0.5F;
        VertexConsumer quad = buffers.getBuffer(RenderType.entityTranslucent(solidTexture()));
        barVertex(quad, pose, x1 + px, y1 + py, red, green, blue, alpha, light);
        barVertex(quad, pose, x1 - px, y1 - py, red, green, blue, alpha, light);
        barVertex(quad, pose, x2 - px, y2 - py, red, green, blue, alpha, light);
        barVertex(quad, pose, x2 + px, y2 + py, red, green, blue, alpha, light);
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

    private static void drawShield(MultiBufferSource buffers, PoseStack.Pose pose, float x, float y) {
        drawBar(buffers, pose, x-4, y, 8, 5, 170, 235, 255, 255, 0x00F000F0);
        for (int row=0; row<4; row++)
            drawBar(buffers, pose, x-4+row, y+5+row, 8-row*2, 1, 170, 235, 255, 255, 0x00F000F0);
        drawBar(buffers, pose, x-3, y+1, 6, 4, 25, 130, 245, 255, 0x00F000F0);
        for (int row=0; row<3; row++)
            drawBar(buffers, pose, x-3+row, y+5+row, 6-row*2, 1, 25, 130, 245, 255, 0x00F000F0);
        drawBar(buffers, pose, x-2, y+2, 1, 3, 225, 250, 255, 255, 0x00F000F0);
    }

    static ResourceLocation solidTexture() {
        if (barTexture == null) {
            NativeImage white = new NativeImage(1, 1, false);
            white.setPixelRGBA(0, 0, 0xFFFFFFFF);
            barTexture = Minecraft.getInstance().getTextureManager().register("royale_bar", new DynamicTexture(white));
        }
        return barTexture;
    }

    private static void loadAvatar(String address) {
        if (address == null || address.isBlank() || AVATARS.containsKey(address)
            || System.currentTimeMillis() < RETRY_AFTER.getOrDefault(address,0L) || !PENDING.add(address)) return;
        RETRY_AFTER.put(address,System.currentTimeMillis()+60_000);
        if (RETRY_AFTER.size()>512) RETRY_AFTER.entrySet().removeIf(entry -> entry.getValue()<System.currentTimeMillis());
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
                            NativeImage resized = new NativeImage(Math.max(1,Math.round(image.getWidth()*factor)),
                                Math.max(1,Math.round(image.getHeight()*factor)), false);
                            image.resizeSubRectTo(0,0,image.getWidth(),image.getHeight(),resized);
                            image.close();
                            image = resized;
                        }
                        DynamicTexture dynamic = new DynamicTexture(image);
                        dynamic.setFilter(true, false);
                        ResourceLocation texture = Minecraft.getInstance().getTextureManager().register(
                            "snow_avatar", dynamic);
                        AVATARS.put(address, texture);
                        AVATAR_SIZES.put(address, Math.min(image.getWidth(),image.getHeight()));
                        RETRY_AFTER.remove(address);
                        if (AVATARS.size() > 256) {
                            String oldest = AVATARS.keySet().stream().filter(key -> !key.equals(address)).findFirst().orElse(null);
                            if (oldest != null) {
                                Minecraft.getInstance().getTextureManager().release(AVATARS.remove(oldest));
                                AVATAR_SIZES.remove(oldest);
                            }
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

    public static int avatarPixels(String address) { return AVATAR_SIZES.getOrDefault(address,512); }
}
