package com.tikmng.snowwar.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.world.Difficulty;
import net.minecraft.world.level.GameRules;
import net.minecraft.world.level.GameType;
import net.minecraft.world.level.LevelSettings;
import net.minecraft.world.level.WorldDataConfiguration;
import net.minecraft.world.level.levelgen.WorldOptions;
import net.minecraft.world.level.levelgen.presets.WorldPresets;

import java.nio.file.Files;

public final class SnowWarTitleScreen extends TitleScreen {
    private static final String WORLD_ID = "royale_arena";
    private static boolean autoLaunchAttempted;

    @Override
    protected void init() {
        super.init();
        clearWidgets();
        if (!autoLaunchAttempted) {
            autoLaunchAttempted = true;
            openArena();
            return;
        }
        addRenderableWidget(Button.builder(Component.literal("Savaş alanını yeniden aç"), button -> openArena())
            .bounds(width / 2 - 120, height / 2 - 12, 240, 24).build());
    }

    private void openArena() {
        boolean exists = Files.isRegularFile(Minecraft.getInstance().gameDirectory.toPath()
            .resolve("saves").resolve(WORLD_ID).resolve("level.dat"));
        minecraft.execute(() -> {
            if (exists) {
                minecraft.createWorldOpenFlows().loadLevel(this, WORLD_ID);
            } else {
                LevelSettings settings = new LevelSettings("MNG Battle Royale Adası", GameType.SURVIVAL, false,
                    Difficulty.NORMAL, true, new GameRules(), WorldDataConfiguration.DEFAULT);
                WorldOptions options = WorldOptions.defaultWithRandomSeed().withStructures(false);
                minecraft.createWorldOpenFlows().createFreshLevel(WORLD_ID, settings, options, registries ->
                    registries.registryOrThrow(Registries.WORLD_PRESET).getHolderOrThrow(WorldPresets.FLAT)
                        .value().createWorldDimensions());
            }
        });
    }
}
