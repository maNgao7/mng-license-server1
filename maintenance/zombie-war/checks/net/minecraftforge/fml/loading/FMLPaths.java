package net.minecraftforge.fml.loading;

import java.nio.file.Path;

/** Isolated config path for the standalone settings regression test only. */
public enum FMLPaths {
    CONFIGDIR;
    public Path get() { return Path.of(System.getProperty("mng.fixture.config")); }
}
