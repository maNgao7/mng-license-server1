package com.tikmng.snowwar.client;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.components.AbstractSliderButton;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

public final class SnowWarSettingsScreen extends Screen {
    private static int testSequence;
    private EditBox username;
    private EditBox playerHealth;
    private EditBox winnerDelay;
    private int top;
    private int panelWidth;
    private String feedback = "";

    public SnowWarSettingsScreen() { super(Component.literal("Kartopu Savaşı")); }

    @Override
    protected void init() {
        panelWidth = Math.min(520, width - 16);
        int left = (width - panelWidth) / 2;
        top = Math.max(4, (height - 298) / 2);
        int gap = 4;
        int third = (panelWidth - gap * 2) / 3;
        int half = (panelWidth - gap) / 2;

        username = new EditBox(font, left, top + 20, panelWidth - 132, 18, Component.literal("TikTok kullanıcı adı"));
        username.setMaxLength(32);
        username.setHint(Component.literal("TikTok kullanıcı adı"));
        username.setFilter(v -> v.matches("[a-zA-Z0-9_.@]*"));
        addRenderableWidget(username);
        addRenderableWidget(Button.builder(Component.literal("Bağlan"), b -> SnowWarLiveClient.connect(username.getValue()))
            .bounds(left + panelWidth - 128, top + 20, 62, 18).build());
        addRenderableWidget(Button.builder(Component.literal("Kes"), b -> SnowWarLiveClient.disconnect())
            .bounds(left + panelWidth - 62, top + 20, 62, 18).build());

        addRenderableWidget(Button.builder(Component.literal("Hediye Görselini İndir (PNG)"), b -> downloadGiftGuide())
            .bounds(left, top + 54, panelWidth, 18).build());

        addRenderableWidget(Button.builder(Component.literal("Hediyeler ve eylemler"), b ->
            minecraft.setScreen(new SnowWarActionsScreen())).bounds(left, top + 78, panelWidth, 18).build());

        weatherButton("Gündüz", "day", left, top + 102, third);
        weatherButton("Gün batımı", "sunset", left + third + gap, top + 102, third);
        weatherButton("Gece", "night", left + 2 * (third + gap), top + 102,
            panelWidth - 2 * (third + gap));

        addRenderableWidget(new MusicSlider(left, top + 126, third, 18));
        addRenderableWidget(Button.builder(Component.literal("Rüzgâr: " + SnowWarClientConfig.get().windVolume + "%"), b -> {
            SnowWarClientConfig config = SnowWarClientConfig.get();
            config.windVolume = nextVolume(config.windVolume);
            config.save();
            b.setMessage(Component.literal("Rüzgâr: " + config.windVolume + "%"));
        }).bounds(left + third + gap, top + 126, third, 18).build());
        addRenderableWidget(new EffectSlider(left + 2 * (third + gap), top + 126,
            panelWidth - 2 * (third + gap), 18));

        playerHealth = new EditBox(font, left + 105, top + 150, 60, 18, Component.literal("Yayıncı canı"));
        playerHealth.setFilter(value -> value.isEmpty() || value.matches("[0-9]{1,4}"));
        playerHealth.setValue(Integer.toString(SnowWarClientConfig.get().playerHealth));
        addRenderableWidget(playerHealth);
        addRenderableWidget(Button.builder(Component.literal("-"), b -> adjustHealth(-1))
            .bounds(left + 169, top + 150, 24, 18).build());
        addRenderableWidget(Button.builder(Component.literal("+"), b -> adjustHealth(1))
            .bounds(left + 197, top + 150, 24, 18).build());
        addRenderableWidget(Button.builder(Component.literal("Canı uygula"), b -> applyHealth())
            .bounds(left + 225, top + 150, panelWidth - 225, 18).build());

        winnerDelay = new EditBox(font, left + 105, top + 174, 60, 18, Component.literal("Bitiş süresi"));
        winnerDelay.setFilter(value -> value.isEmpty() || value.matches("[0-9]{1,3}"));
        winnerDelay.setValue(Integer.toString(SnowWarClientConfig.get().winnerDelaySeconds));
        addRenderableWidget(winnerDelay);
        addRenderableWidget(Button.builder(Component.literal("Süreyi uygula"), b -> applyWinnerDelay())
            .bounds(left + 169, top + 174, panelWidth - 169, 18).build());

        addRenderableWidget(Button.builder(Component.literal("Savaşı başlat"), b -> command("snowwar start"))
            .bounds(left, top + 198, half, 18).build());
        addRenderableWidget(Button.builder(Component.literal("Savaşı durdur"), b -> command("snowwar stop"))
            .bounds(left + half + gap, top + 198, panelWidth - half - gap, 18).build());

        addRenderableWidget(Button.builder(Component.literal("1 test savaşçısı"), b -> {
            command("snowwar join test_" + (++testSequence));
        })
            .bounds(left, top + 222, half, 18).build());
        addRenderableWidget(Button.builder(Component.literal("5 test savaşçısı"), b -> {
            for (int i = 0; i < 5; i++) command("snowwar join test_" + (++testSequence));
        }).bounds(left + half + gap, top + 222, panelWidth - half - gap, 18).build());

        addRenderableWidget(Button.builder(Component.literal("Oyuna dön"), b -> onClose())
            .bounds(left, top + 246, panelWidth, 18).build());
        command("snowwar effectvolume " + SnowWarClientConfig.get().effectVolume);
    }

    private void weatherButton(String label, String mode, int x, int y, int w) {
        addRenderableWidget(Button.builder(Component.literal(label), b -> {
            SnowWarClientConfig.get().timeOfDay = mode;
            SnowWarClientConfig.get().save();
            command("snowwar time " + mode);
        }).bounds(x, y, w, 18).build());
    }

    private void command(String value) {
        if (minecraft != null && minecraft.player != null) minecraft.player.connection.sendCommand(value);
    }

    private void downloadGiftGuide() {
        Path downloads = Paths.get(System.getProperty("user.home"), "Downloads");
        Path target = downloads.resolve("TikMnG-Kartopu-Savasi-Hediye-Listesi.png");
        try (InputStream input = SnowWarSettingsScreen.class.getResourceAsStream(
                "/assets/mng_snow_war/guide/kartopu-savasi-hediye-listesi.png")) {
            if (input == null) throw new java.io.IOException("Paketlenmiş görsel bulunamadı");
            Files.createDirectories(downloads);
            Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
            feedback = "Görsel indirildi: " + target.getFileName();
        } catch (Exception error) {
            feedback = "Görsel indirilemedi: " + error.getMessage();
        }
    }

    private static int nextVolume(int current) {
        return current >= 100 ? 0 : Math.min(100, current + 10);
    }

    private void adjustHealth(int delta) {
        int value = SnowWarClientConfig.get().playerHealth;
        try { value = Integer.parseInt(playerHealth.getValue()); } catch (NumberFormatException ignored) { }
        playerHealth.setValue(Integer.toString(Math.max(1, Math.min(1000, value + delta))));
    }

    private void applyHealth() {
        int value = SnowWarClientConfig.get().playerHealth;
        try { value = Integer.parseInt(playerHealth.getValue()); } catch (NumberFormatException ignored) { }
        value = Math.max(1, Math.min(1000, value));
        playerHealth.setValue(Integer.toString(value));
        SnowWarClientConfig.get().playerHealth = value;
        SnowWarClientConfig.get().save();
        command("snowwar health " + value);
    }

    private void applyWinnerDelay() {
        int value = SnowWarClientConfig.get().winnerDelaySeconds;
        try { value = Integer.parseInt(winnerDelay.getValue()); } catch (NumberFormatException ignored) { }
        value = Math.max(1, Math.min(120, value));
        winnerDelay.setValue(Integer.toString(value));
        SnowWarClientConfig.get().winnerDelaySeconds = value;
        SnowWarClientConfig.get().save();
        command("snowwar winnerdelay " + value);
    }

    private static final class MusicSlider extends AbstractSliderButton {
        MusicSlider(int x, int y, int width, int height) {
            super(x, y, width, height, Component.empty(), SnowWarClientConfig.get().musicVolume / 100.0);
            updateMessage();
        }

        @Override protected void updateMessage() {
            setMessage(Component.literal("Müzik: " + Math.round(value * 100) + "%"));
        }

        @Override protected void applyValue() {
            SnowWarClientConfig.get().musicVolume = (int)Math.round(value * 100);
            SnowWarClientConfig.get().save();
        }
    }

    private final class EffectSlider extends AbstractSliderButton {
        EffectSlider(int x, int y, int width, int height) {
            super(x, y, width, height, Component.empty(), SnowWarClientConfig.get().effectVolume / 100.0);
            updateMessage();
        }

        @Override protected void updateMessage() {
            setMessage(Component.literal("Efekt: " + Math.round(value * 100) + "%"));
        }

        @Override protected void applyValue() {
            int volume = (int)Math.round(value * 100);
            SnowWarClientConfig.get().effectVolume = volume;
            SnowWarClientConfig.get().save();
            command("snowwar effectvolume " + volume);
        }
    }

    @Override
    public void render(GuiGraphics graphics, int mouseX, int mouseY, float partialTick) {
        renderBackground(graphics);
        graphics.drawCenteredString(font, title, width / 2, top + 5, 0xFFFFFFFF);
        graphics.drawCenteredString(font, font.plainSubstrByWidth(SnowWarLiveClient.status(), panelWidth),
            width / 2, top + 42, 0xFF92E9FA);
        graphics.drawString(font, "Yayıncı canı", leftEdge(), top + 155, 0xFFFFFFFF);
        graphics.drawString(font, "Bitiş süresi", leftEdge(), top + 179, 0xFFFFFFFF);
        if (!feedback.isBlank()) graphics.drawCenteredString(font,
            font.plainSubstrByWidth(feedback, panelWidth), width / 2, top + 271, 0xFF92E9FA);
        graphics.drawCenteredString(font, "P: Başlat / duraklat / devam et", width / 2, top + 286, 0xFFBBD6E2);
        super.render(graphics, mouseX, mouseY, partialTick);
    }

    private int leftEdge() { return (width - panelWidth) / 2; }

    @Override
    public void onClose() {
        if (playerHealth != null) applyHealth();
        if (winnerDelay != null) applyWinnerDelay();
        command("snowwar effectvolume " + SnowWarClientConfig.get().effectVolume);
        super.onClose();
    }

    @Override public boolean isPauseScreen() { return false; }
}
