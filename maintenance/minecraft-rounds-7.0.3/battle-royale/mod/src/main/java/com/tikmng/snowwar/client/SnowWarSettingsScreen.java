package com.tikmng.snowwar.client;

import com.tikmng.snowwar.game.ParticipantCapacity;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.AbstractSliderButton;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public final class SnowWarSettingsScreen extends Screen {
    private static final int LIVE = 0;
    private static final int ARENA = 1;
    private static final int PLAYER = 2;
    private static int activeTab = LIVE;
    private static int testSequence;

    private EditBox username;
    private EditBox playerHealth;
    private EditBox winnerDelay;
    private EditBox zoneInterval;
    private EditBox lobbyWait;
    private EditBox participantCapacity;
    private int panelX;
    private int panelY;
    private int panelW;
    private int panelH;
    private int navW;
    private int contentX;
    private int contentW;

    public SnowWarSettingsScreen() { super(Component.literal("MNG Battle Royale Kontrol Merkezi")); }

    @Override
    protected void init() {
        panelW = Math.min(650, width - 20);
        panelH = Math.min(322, height - 12);
        panelX = (width - panelW) / 2;
        panelY = (height - panelH) / 2;
        navW = Math.min(124, Math.max(102, panelW / 5));
        contentX = panelX + navW + 12;
        contentW = panelW - navW - 22;

        addTab("CANLI YAYIN", LIVE, panelY + 48);
        addTab("SAVAS ALANI", ARENA, panelY + 76);
        addTab("OYUNCU & SES", PLAYER, panelY + 104);
        addRenderableWidget(Button.builder(Component.literal("Oyuna Don"), b -> onClose())
            .bounds(panelX + 8, panelY + panelH - 31, navW - 16, 20).build());

        if (activeTab == LIVE) initLive();
        else if (activeTab == ARENA) initArena();
        else initPlayer();
    }

    private void addTab(String label, int tab, int y) {
        Button button = addRenderableWidget(Button.builder(Component.literal(label), b -> {
            savePlayerSettings();
            activeTab = tab;
            rebuildWidgets();
        }).bounds(panelX + 8, y, navW - 16, 22).build());
        button.active = activeTab != tab;
    }

    private void initLive() {
        int y = panelY + 58;
        username = new EditBox(font, contentX, y, Math.max(90, contentW - 138), 22,
            Component.literal("TikTok kullanici adi"));
        username.setMaxLength(32);
        username.setHint(Component.literal("@kullaniciadi"));
        username.setFilter(value -> value.matches("[a-zA-Z0-9_.@]*"));
        username.setValue(SnowWarClientConfig.get().streamer);
        username.setResponder(value -> SnowWarClientConfig.get().streamer = value);
        addRenderableWidget(username);
        addRenderableWidget(Button.builder(Component.literal("Baglan"), b -> {
            SnowWarClientConfig.get().streamer = username.getValue();
            SnowWarLiveClient.connect(username.getValue());
        }).bounds(contentX + contentW - 132, y, 64, 22).build());
        addRenderableWidget(Button.builder(Component.literal("Kes"), b -> SnowWarLiveClient.disconnect())
            .bounds(contentX + contentW - 64, y, 64, 22).build());

        addRenderableWidget(Button.builder(Component.literal("Hediye ve Etkilesim Eylemleri"), b ->
            minecraft.setScreen(new SnowWarActionsScreen()))
            .bounds(contentX, y + 112, contentW, 24).build());
        addRenderableWidget(Button.builder(Component.literal(SnowWarGiftCatalogScreen.giftCount() + " Hediyelik Katalogu Ac"), b ->
            minecraft.setScreen(new SnowWarGiftCatalogScreen()))
            .bounds(contentX, y + 142, contentW, 24).build());
        addRenderableWidget(Button.builder(Component.literal("Hazir PNG Gorseli Indir"), this::downloadPng)
            .bounds(contentX, y + 172, contentW, 24).build());
    }

    private void downloadPng(Button button) {
        button.active = false;
        button.setMessage(Component.literal("PNG kaydediliyor..."));
        java.util.concurrent.CompletableFuture.supplyAsync(() -> {
            try { return BundledDownloads.exportPng(java.nio.file.Path.of(System.getProperty("user.home"),"Downloads")); }
            catch (java.io.IOException error) { throw new java.util.concurrent.CompletionException(error); }
        }).whenComplete((path,error) -> minecraft.execute(() -> {
            button.active = true;
            button.setMessage(Component.literal(error == null ? "PNG Indirilenler'e Kaydedildi" : "PNG Indirilemedi - Tekrar Dene"));
            if (error == null) button.setTooltip(net.minecraft.client.gui.components.Tooltip.create(Component.literal(path.toString())));
        }));
    }

    private void initArena() {
        int y = panelY + 58;
        int gap = 6;
        int half = (contentW - gap) / 2;
        addRenderableWidget(Button.builder(Component.literal("Savasi Baslat"), b -> command("snowwar start"))
            .bounds(contentX, y, half, 22).build());
        addRenderableWidget(Button.builder(Component.literal("Savasi Durdur"), b -> command("snowwar stop"))
            .bounds(contentX + half + gap, y, contentW - half - gap, 22).build());
        addRenderableWidget(Button.builder(Component.literal("Elektrikli Alani Simdi Daralt"), b -> command("snowwar shrink"))
            .bounds(contentX, y + 30, half, 22).build());
        addRenderableWidget(Button.builder(Component.literal("Turu Sifirla"), b -> command("snowwar reset"))
            .bounds(contentX + half + gap, y + 30, contentW - half - gap, 22).build());

        zoneInterval = numberField(contentX + 148, y + 60, 58, SnowWarClientConfig.get().zoneIntervalSeconds, 3);
        addRenderableWidget(Button.builder(Component.literal("Sureyi Uygula"), b -> applyZoneInterval())
            .bounds(contentX + 212, y + 60, Math.max(92, contentW - 212), 22).build());

        lobbyWait = numberField(contentX + 148, y + 88, 58, SnowWarClientConfig.get().lobbyWaitSeconds, 3);
        addRenderableWidget(Button.builder(Component.literal("Beklemeyi Kaydet"), b -> applyLobbyWait())
            .bounds(contentX + 212, y + 88, Math.max(92, contentW - 212), 22).build());

        participantCapacity = numberField(contentX + 148, y + 116, 58,
            SnowWarClientConfig.get().participantCapacity, 3);
        addRenderableWidget(Button.builder(Component.literal("Kapasiteyi Kaydet"), b -> applyParticipantCapacity())
            .bounds(contentX + 212, y + 116, Math.max(92, contentW - 212), 22).build());

        int third = (contentW - gap * 2) / 3;
        testButton("1 Test", 1, contentX, y + 144, third);
        testButton("5 Test", 5, contentX + third + gap, y + 144, third);
        testButton("20 Test", 20, contentX + (third + gap) * 2, y + 144,
            contentW - (third + gap) * 2);
    }

    private void testButton(String label, int count, int x, int y, int w) {
        addRenderableWidget(Button.builder(Component.literal(label), b -> {
            for (int i = 0; i < count; i++) command("snowwar join test_" + (++testSequence));
        }).bounds(x, y, w, 22).build());
    }

    private void initPlayer() {
        SnowWarClientConfig config = SnowWarClientConfig.get();
        int y = panelY + 60;
        playerHealth = numberField(contentX + 122, y, 72, config.playerHealth, 4);
        addRenderableWidget(Button.builder(Component.literal("Can Uygula"), b -> applyHealth())
            .bounds(contentX + 200, y, contentW - 200, 22).build());
        winnerDelay = numberField(contentX + 122, y + 34, 72, config.winnerDelaySeconds, 3);
        addRenderableWidget(Button.builder(Component.literal("Sureyi Uygula"), b -> applyWinnerDelay())
            .bounds(contentX + 200, y + 34, contentW - 200, 22).build());
        addRenderableWidget(new EffectSlider(contentX, y + 92, contentW, 22));
        addRenderableWidget(new MusicSlider(contentX, y + 132, contentW, 22));
    }

    private EditBox numberField(int x, int y, int w, int value, int digits) {
        EditBox field = new EditBox(font, x, y, w, 22, Component.empty());
        field.setMaxLength(digits);
        field.setFilter(text -> text.isEmpty() || text.matches("[0-9]+"));
        field.setValue(Integer.toString(value));
        return addRenderableWidget(field);
    }

    private void command(String value) {
        if (minecraft != null && minecraft.player != null) minecraft.player.connection.sendCommand(value);
    }

    private void applyHealth() {
        if (playerHealth == null) return;
        int value = SnowWarClientConfig.get().playerHealth;
        try { value = Integer.parseInt(playerHealth.getValue()); } catch (NumberFormatException ignored) { }
        value = Math.max(1, Math.min(1000, value));
        playerHealth.setValue(Integer.toString(value));
        SnowWarClientConfig.get().playerHealth = value;
        SnowWarClientConfig.get().save();
        command("snowwar health " + value);
    }

    private void applyWinnerDelay() {
        if (winnerDelay == null) return;
        int value = SnowWarClientConfig.get().winnerDelaySeconds;
        try { value = Integer.parseInt(winnerDelay.getValue()); } catch (NumberFormatException ignored) { }
        value = Math.max(1, Math.min(120, value));
        winnerDelay.setValue(Integer.toString(value));
        SnowWarClientConfig.get().winnerDelaySeconds = value;
        SnowWarClientConfig.get().save();
        command("snowwar winnerdelay " + value);
    }

    private void applyZoneInterval() {
        if (zoneInterval == null) return;
        int value = SnowWarClientConfig.get().zoneIntervalSeconds;
        try { value = Integer.parseInt(zoneInterval.getValue()); } catch (NumberFormatException ignored) { }
        value = Math.max(10, Math.min(120, value));
        zoneInterval.setValue(Integer.toString(value));
        SnowWarClientConfig.get().zoneIntervalSeconds = value;
        SnowWarClientConfig.get().save();
        command("snowwar zoneinterval " + value);
    }

    private void savePlayerSettings() {
        applyParticipantCapacity();
        applyLobbyWait();
        applyHealth();
        applyWinnerDelay();
        applyZoneInterval();
    }

    private void applyLobbyWait() {
        if (lobbyWait == null) return;
        int value = SnowWarClientConfig.get().lobbyWaitSeconds;
        try { value = Integer.parseInt(lobbyWait.getValue()); } catch (NumberFormatException ignored) { }
        value = Math.max(0, Math.min(120, value));
        lobbyWait.setValue(Integer.toString(value));
        SnowWarClientConfig.get().lobbyWaitSeconds = value;
        SnowWarClientConfig.get().save();
        command("snowwar lobbywait " + value);
    }

    private void applyParticipantCapacity() {
        if (participantCapacity == null) return;
        int value = SnowWarClientConfig.get().participantCapacity;
        try { value = Integer.parseInt(participantCapacity.getValue()); } catch (NumberFormatException ignored) { }
        value = ParticipantCapacity.validate(value);
        participantCapacity.setValue(Integer.toString(value));
        SnowWarClientConfig.get().participantCapacity = value;
        SnowWarClientConfig.get().save();
        command("snowwar capacity " + value);
    }

    @Override
    public void onClose() {
        savePlayerSettings();
        super.onClose();
    }

    @Override
    public void render(GuiGraphics graphics, int mouseX, int mouseY, float partialTick) {
        renderBackground(graphics);
        graphics.fill(panelX, panelY, panelX + panelW, panelY + panelH, 0xEF0B1118);
        graphics.fill(panelX, panelY, panelX + panelW, panelY + 4, 0xFFE3B341);
        graphics.fill(panelX + navW, panelY + 4, panelX + navW + 1, panelY + panelH, 0xFF293442);
        graphics.drawString(font, "MNG", panelX + 12, panelY + 15, 0xFFE3B341, true);
        graphics.drawString(font, "BATTLE ROYALE", panelX + 12, panelY + 28, 0xFFFFFFFF, true);

        String section = activeTab == LIVE ? "CANLI YAYIN" : activeTab == ARENA ? "SAVAS ALANI" : "OYUNCU & SES";
        graphics.drawString(font, section, contentX, panelY + 18, 0xFFE3B341, true);
        graphics.drawString(font, activeTab == ARENA ? "MNG Adasi / " + SnowWarClientConfig.get().participantCapacity + " oyuncu" :
            activeTab == LIVE ? "TikTok baglantisi ve hediye motoru" : "Yayinci ve oyun sesi",
            contentX, panelY + 32, 0xFFB5C1CC, false);

        if (activeTab == LIVE) renderLive(graphics);
        else if (activeTab == ARENA) renderArena(graphics);
        else renderPlayer(graphics);
        super.render(graphics, mouseX, mouseY, partialTick);
    }

    private void renderLive(GuiGraphics graphics) {
        int y = panelY + 91;
        graphics.fill(contentX, y, contentX + contentW, y + 46, 0xFF111C26);
        graphics.fill(contentX, y, contentX + 4, y + 46, 0xFF39D98A);
        graphics.drawString(font, "BAGLANTI DURUMU", contentX + 11, y + 8, 0xFF8FA2B2, false);
        graphics.drawString(font, font.plainSubstrByWidth(SnowWarLiveClient.status(), contentW - 22),
            contentX + 11, y + 25, 0xFFFFFFFF, false);
        graphics.drawString(font, "HEDIYE MOTORU", contentX, y + 59, 0xFFE3B341, false);
        graphics.drawString(font, SnowWarGiftCatalogScreen.giftCount() + " katalog girdisi / tekil etkinlik korumasi aktif", contentX, y + 68,
            0xFFB5C1CC, false);
    }

    private void renderArena(GuiGraphics graphics) {
        int y = panelY + 146;
        graphics.drawString(font, "Daralma araligi (10-120 sn)", contentX, panelY + 122, 0xFFFFFFFF, false);
        graphics.drawString(font, "Bekleme alani (saniye)", contentX, panelY + 150, 0xFFFFFFFF, false);
        graphics.drawString(font, "Katilimci kapasitesi (1-500)", contentX, panelY + 178, 0xFFFFFFFF, false);
        graphics.fill(contentX, y + 75, contentX + contentW, y + 121, 0xFF111C26);
        graphics.drawString(font, "MNG ERANGEL ADASI", contentX + 10, y + 84, 0xFF8FA2B2, false);
        graphics.drawString(font, "361 x 361  |  Rastgele hedefe daralan elektrikli alan", contentX + 10,
            y + 99, 0xFFFFFFFF, false);
        graphics.drawString(font, "Pochinki / Georgopol / Stalber / Sosnovka Askeri Us", contentX + 10,
            y + 112, 0xFFB5C1CC, false);
    }

    private void renderPlayer(GuiGraphics graphics) {
        int y = panelY + 66;
        graphics.drawString(font, "Yayinci Cani", contentX, y, 0xFFFFFFFF, false);
        graphics.drawString(font, "Kazanan Suresi", contentX, y + 34, 0xFFFFFFFF, false);
        graphics.drawString(font, "SILAH VE EFEKT SESI", contentX, y + 72, 0xFFE3B341, false);
        graphics.drawString(font, "UCAK MUZIGI", contentX, y + 112, 0xFFE3B341, false);
        graphics.drawString(font, "P320 > MP5K > P90 > M4A1 > AK-47 > AWM", contentX, y + 164, 0xFFB5C1CC, false);
    }

    private final class MusicSlider extends AbstractSliderButton {
        MusicSlider(int x, int y, int width, int height) {
            super(x,y,width,height,Component.empty(),SnowWarClientConfig.get().musicVolume/100.0);
            updateMessage();
        }
        @Override protected void updateMessage() {
            setMessage(Component.literal("Ucak Muzigi: %"+Math.round(value*100)));
        }
        @Override protected void applyValue() {
            SnowWarClientConfig.get().musicVolume=(int)Math.round(value*100);
            SnowWarClientConfig.get().save();
        }
    }

    private final class EffectSlider extends AbstractSliderButton {
        EffectSlider(int x, int y, int width, int height) {
            super(x, y, width, height, Component.empty(), SnowWarClientConfig.get().effectVolume / 100.0);
            updateMessage();
        }
        @Override protected void updateMessage() {
            setMessage(Component.literal("Silah ve Efekt Sesi: %" + Math.round(value * 100)));
        }
        @Override protected void applyValue() {
            int volume = (int)Math.round(value * 100);
            SnowWarClientConfig.get().effectVolume = volume;
            SnowWarClientConfig.get().save();
            command("snowwar effectvolume " + volume);
        }
    }

    @Override public boolean isPauseScreen() { return false; }
}
