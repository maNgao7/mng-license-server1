package com.tikmng.snowwar.client;

import com.tikmng.snowwar.SnowWar;
import com.tikmng.snowwar.game.SnowFighterEntity;
import com.tikmng.snowwar.game.SnowWarArenaBuilder;
import com.tikmng.snowwar.game.SnowWarEngine;
import net.minecraft.client.CameraType;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Screenshot;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.client.event.InputEvent;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.ModList;
import net.minecraftforge.fml.common.Mod;
import org.lwjgl.glfw.GLFW;

import java.lang.reflect.Field;

@Mod.EventBusSubscriber(modid = SnowWar.MOD_ID, value = Dist.CLIENT)
public final class NativeCameraChecks {
    private static int ticks, stage, changedAt;
    private static volatile boolean preparing, ready;
    private static final int[] targetIds = new int[3];

    @SubscribeEvent
    public static void tick(TickEvent.ClientTickEvent event) {
        if (!Boolean.getBoolean("mng.capacity.camera.qa") || event.phase != TickEvent.Phase.END) return;
        var minecraft = Minecraft.getInstance();
        try {
            if (++ticks > 3600) throw new AssertionError("native camera QA timeout; stage=" + stage);
            if (minecraft.player == null && ticks == 40) {
                System.out.println("CAPACITY_QA_START screen=" + minecraft.screen);
                minecraft.setScreen(new SnowWarTitleScreen());
            }
            if (stage == 9) {
                if (ticks - changedAt < 12 || minecraft.level != null) return;
                require(!ParticipantFollowCamera.following() && minecraft.getCameraEntity() == null, "world-unload exit");
                System.out.println("CAPACITY_NATIVE_CAMERA PASS native-key-handler/inventory-drain/external-follow/E-exit/death-exit/removal-exit/TAB/third-person-reticle/world-unload/settings");
                minecraft.stop();
                stage = 10;
                return;
            }
            if (stage == 10 || minecraft.player == null || minecraft.level == null || minecraft.getSingleplayerServer() == null) return;
            if (!preparing) {
                Object mod = ModList.get().getModObjectById(SnowWar.MOD_ID).orElseThrow();
                var arena = (SnowWarArenaBuilder)read(mod, "arenaBuilder");
                if (!arena.ready()) return;
                preparing = true;
                var engine = (SnowWarEngine)read(mod, "engine");
                minecraft.getSingleplayerServer().execute(() -> {
                    var host = minecraft.getSingleplayerServer().getPlayerList().getPlayers().get(0);
                    host.teleportTo(-60, arena.floorY() + 45, -65);
                    host.getAbilities().flying = true;
                    host.onUpdateAbilities();
                    for(var previous:host.serverLevel().getEntitiesOfClass(SnowFighterEntity.class,
                        new net.minecraft.world.phys.AABB(-210,-100,-210,210,400,210),f->f.getName().getString().startsWith("CameraQa"))) previous.discard();
                    for (int i = 0; i < 3; i++) {
                        String name = "CameraQa" + i;
                        engine.join(host, name, name, "");
                        var fighter = host.serverLevel().getEntitiesOfClass(SnowFighterEntity.class,
                            host.getBoundingBox().inflate(200), f -> f.getName().getString().equals(name)).get(0);
                        fighter.getPersistentData().putBoolean("mng_in_lobby", false);
                        fighter.setNoGravity(true);
                        fighter.setNoAi(true);
                        fighter.moveTo(-60, arena.floorY() + 45, -55 + i * 10, 0, 0);
                        targetIds[i] = fighter.getId();
                    }
                    ready = true;
                });
            }
            if (!ready || minecraft.level.getEntity(targetIds[2]) == null) return;
            if (stage == 0) {
                minecraft.setScreen(null);
                minecraft.options.setCameraType(CameraType.FIRST_PERSON);
                aim(minecraft);
                next(1);
            } else if (stage == 1 && elapsed(10)) {
                aim(minecraft);
                KeyMapping.click(minecraft.options.keyInventory.getKey());
                press(GLFW.GLFW_KEY_E);
                require(!minecraft.options.keyInventory.consumeClick(), "E inventory conflict drained");
                require(minecraft.getCameraEntity().getId() == targetIds[0], "E selected exact aimed participant; actual="
                    + minecraft.getCameraEntity().getId() + " expected=" + targetIds[0]
                    + " following=" + ParticipantFollowCamera.following() + " screen=" + minecraft.screen
                    + " ray=" + minecraft.gameRenderer.getMainCamera().getLookVector());
                require(minecraft.options.getCameraType() == CameraType.THIRD_PERSON_BACK, "external perspective");
                next(2);
            } else if (stage == 2 && elapsed(12)) {
                var camera = minecraft.gameRenderer.getMainCamera();
                require(camera.getEntity().getId() == targetIds[0] && camera.isDetached(), "native camera follows target");
                require(camera.getPosition().distanceTo(minecraft.getCameraEntity().getEyePosition()) > 1, "camera is outside target");
                require(minecraft.screen == null, "inventory did not open");
                capture(minecraft, "capacity-follow.png");
                press(GLFW.GLFW_KEY_E);
                require(minecraft.getCameraEntity() == minecraft.player && minecraft.options.getCameraType() == CameraType.FIRST_PERSON,
                    "E returns to original free camera");
                aim(minecraft);
                next(3);
            } else if (stage == 3 && elapsed(6)) {
                press(GLFW.GLFW_KEY_E);
                require(ParticipantFollowCamera.following(), "follow before death");
                minecraft.getSingleplayerServer().execute(() -> serverFighter(0).setHealth(0));
                next(4);
            } else if (stage == 4 && elapsed(15)) {
                require(!ParticipantFollowCamera.following() && minecraft.getCameraEntity() == minecraft.player, "native death exit");
                aim(minecraft);
                next(5);
            } else if (stage == 5 && elapsed(6)) {
                press(GLFW.GLFW_KEY_E);
                require(minecraft.getCameraEntity().getId() == targetIds[1], "dead participant skipped");
                minecraft.getSingleplayerServer().execute(() -> serverFighter(1).discard());
                next(6);
            } else if (stage == 6 && elapsed(15)) {
                require(!ParticipantFollowCamera.following() && minecraft.getCameraEntity() == minecraft.player, "native removal exit");
                aim(minecraft);
                next(7);
            } else if (stage == 7 && elapsed(6)) {
                press(GLFW.GLFW_KEY_E);
                require(minecraft.getCameraEntity().getId() == targetIds[2], "third participant selected");
                press(GLFW.GLFW_KEY_TAB);
                require(!ParticipantFollowCamera.following() && minecraft.getCameraEntity() == minecraft.player
                    && minecraft.options.getCameraType() == CameraType.THIRD_PERSON_BACK, "existing TAB control");
                capture(minecraft, "capacity-free-camera.png");
                Field tab = SnowWarSettingsScreen.class.getDeclaredField("activeTab");
                tab.setAccessible(true);
                tab.setInt(null, 1);
                press(GLFW.GLFW_KEY_B);
                require(minecraft.screen instanceof SnowWarSettingsScreen, "settings open through B");
                next(8);
            } else if (stage == 8 && elapsed(12)) {
                capture(minecraft, "capacity-settings.png");
                minecraft.screen.onClose();
                aim(minecraft);
                press(GLFW.GLFW_KEY_E);
                require(ParticipantFollowCamera.following(), "third-person center ray selects target");
                press(GLFW.GLFW_KEY_E);
                minecraft.options.setCameraType(CameraType.FIRST_PERSON);
                Object mod = ModList.get().getModObjectById(SnowWar.MOD_ID).orElseThrow();
                var arena = (SnowWarArenaBuilder)read(mod, "arenaBuilder");
                minecraft.getSingleplayerServer().execute(() -> {
                    var host=minecraft.getSingleplayerServer().getPlayerList().getPlayers().get(0);
                    host.teleportTo(.5,arena.floorY()+73.2,.5);
                });
                next(11);
            } else if (stage == 11 && elapsed(20)) {
                minecraft.player.setYRot(90);minecraft.player.yRotO=90;
                minecraft.player.setXRot(0);minecraft.player.xRotO=0;
                next(12);
            } else if (stage == 12 && elapsed(12)) {
                require(minecraft.level.getEntitiesOfClass(net.minecraft.world.entity.Display.TextDisplay.class,
                    minecraft.player.getBoundingBox().inflate(50),e->{var tag=new net.minecraft.nbt.CompoundTag();e.saveWithoutId(tag);return tag.getString("text").contains("BEKLEME ALANI");}).size()==2,"native client received both wall signs");
                capture(minecraft,"aircraft-left-wall.png");
                minecraft.player.setYRot(-90);minecraft.player.yRotO=-90;
                next(13);
            } else if (stage == 13 && elapsed(12)) {
                capture(minecraft,"aircraft-right-wall.png");
                next(9);
                minecraft.level.disconnect();
                minecraft.clearLevel();
            }
        } catch (Throwable error) {
            System.err.println("CAPACITY_NATIVE_CAMERA FAIL stage=" + stage);
            error.printStackTrace();
            minecraft.stop();
            stage = 10;
        }
    }

    private static SnowFighterEntity serverFighter(int index) {
        return (SnowFighterEntity)Minecraft.getInstance().getSingleplayerServer().overworld().getEntity(targetIds[index]);
    }

    private static Object read(Object owner, String name) throws Exception {
        Field field = owner.getClass().getDeclaredField(name);
        field.setAccessible(true);
        return field.get(owner);
    }

    private static void aim(Minecraft minecraft) {
        minecraft.player.setYRot(0);
        minecraft.player.setXRot(0);
        minecraft.player.yRotO = 0;
        minecraft.player.xRotO = 0;
        minecraft.gameRenderer.getMainCamera().setup(minecraft.level, minecraft.player,
            !minecraft.options.getCameraType().isFirstPerson(), false, 1);
    }

    private static void press(int key) {
        var minecraft = Minecraft.getInstance();
        int scan = GLFW.glfwGetKeyScancode(key);
        minecraft.keyboardHandler.keyPress(minecraft.getWindow().getWindow(), key, scan, GLFW.GLFW_PRESS, 0);
        minecraft.keyboardHandler.keyPress(minecraft.getWindow().getWindow(), key, scan, GLFW.GLFW_RELEASE, 0);
    }

    private static void capture(Minecraft minecraft, String name) {
        Screenshot.grab(minecraft.gameDirectory, name, minecraft.getMainRenderTarget(),
            result -> System.out.println("CAPACITY_SCREENSHOT " + name + " " + result.getString()));
    }

    private static void next(int value) { stage = value; changedAt = ticks; }
    private static boolean elapsed(int delay) { return ticks - changedAt >= delay; }
    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
