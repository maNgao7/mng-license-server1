package com.tikmng.snowwar.client;

import com.google.gson.Gson;
import com.google.gson.JsonParser;
import com.tikmng.snowwar.SnowWar;
import java.nio.file.Files;

final class LobbyMediaSmoke {
    private LobbyMediaSmoke() { }

    static void verify() {
        require(SnowWarAudio.shouldPlay(true,true,25),"Lobby music was disabled");
        require(!SnowWarAudio.shouldPlay(false,true,25),"Music would play during battle");
        require(!SnowWarAudio.shouldPlay(true,false,25),"Music would play outside game");
        require(!SnowWarAudio.shouldPlay(true,true,0),"Muted music would play");
        try (var preset=LobbyMediaSmoke.class.getResourceAsStream("/assets/mng_battle_royale/defaults/battle-royale.json")) {
            require(preset!=null,"Standard preset missing");
            var expected=JsonParser.parseReader(new java.io.InputStreamReader(preset,java.nio.charset.StandardCharsets.UTF_8));
            require(expected.equals(new Gson().toJsonTree(SnowWarClientConfig.get())),"Saved settings differ from the preserved standard");
        } catch(java.io.IOException error) { throw new IllegalStateException(error); }
        try {
            var directory=Files.createTempDirectory("tikmng-png-qa-");
            java.nio.file.Path first=null, collision=null;
            try {
                first=BundledDownloads.exportPng(directory);
                try(var source=LobbyMediaSmoke.class.getResourceAsStream(BundledDownloads.PNG_RESOURCE)) {
                    require(source!=null && java.util.Arrays.equals(source.readAllBytes(),Files.readAllBytes(first)),"PNG changed on export");
                }
                require(first.equals(BundledDownloads.exportPng(directory)),"Repeated export made a duplicate");
                Files.writeString(first,"existing user file");
                collision=BundledDownloads.exportPng(directory);
                require(!first.equals(collision) && Files.readString(first).equals("existing user file"),"Export overwrote a user file");
            } finally {
                if(first!=null)Files.deleteIfExists(first);
                if(collision!=null)Files.deleteIfExists(collision);
                Files.deleteIfExists(directory);
            }
        } catch(java.io.IOException error) { throw new IllegalStateException(error); }
        SnowWar.LOGGER.info("MNG_LOBBY_MEDIA passed=true musicPolicy=true standardPreserved=true pngExact=true noOverwrite=true");
    }

    private static void require(boolean value,String message) {
        if(!value)throw new IllegalStateException(message);
    }
}
