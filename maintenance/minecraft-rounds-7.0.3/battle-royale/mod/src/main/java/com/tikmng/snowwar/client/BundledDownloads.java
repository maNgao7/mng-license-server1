package com.tikmng.snowwar.client;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.FileAlreadyExistsException;
import java.util.Arrays;

final class BundledDownloads {
    static final String PNG_RESOURCE = "/assets/mng_battle_royale/downloads/MC-PUBG.png";
    private BundledDownloads() { }

    static Path exportPng(Path directory) throws IOException {
        byte[] source;
        try (var stream = BundledDownloads.class.getResourceAsStream(PNG_RESOURCE)) {
            if (stream == null) throw new IOException("PNG dosyasi bulunamadi");
            source = stream.readAllBytes();
        }
        Files.createDirectories(directory);
        for (int suffix = 0; suffix < 1000; suffix++) {
            String name = "TikMnG-Battle-Royale-Hediye-Gorseli" + (suffix == 0 ? "" : " ("+suffix+")") + ".png";
            Path target = directory.resolve(name);
            if (Files.isRegularFile(target) && Files.size(target) == source.length
                    && Arrays.equals(source, Files.readAllBytes(target))) return target;
            try { return Files.write(target,source,java.nio.file.StandardOpenOption.CREATE_NEW); }
            catch (FileAlreadyExistsException ignored) { }
        }
        throw new IOException("Ayni adda cok fazla dosya var");
    }
}
