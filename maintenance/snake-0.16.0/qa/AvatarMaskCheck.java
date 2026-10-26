import java.io.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import javax.tools.*;

/** Offline source-mode QA: java qa/AvatarMaskCheck.java. No game/network/class-file output. */
public class AvatarMaskCheck {
    private static JavaFileObject unit(String name, String source) {
        return new SimpleJavaFileObject(URI.create("string:///" + name.replace('.', '/') + ".java"), JavaFileObject.Kind.SOURCE) {
            public CharSequence getCharContent(boolean ignoreEncodingErrors) { return source; }
        };
    }

    public static void main(String[] args) throws Exception {
        Path sources = Path.of("mod/src/main/java/com/tikmng/snake");
        String avatars = Files.readString(sources.resolve("SnakeAvatars.java"));
        if (!avatars.contains("mask(portrait);") || !avatars.contains("AvatarMask.apply(color,x,y,FALLBACK_SIZE)"))
            throw new AssertionError("Both downloaded and fallback portraits must use the production mask");
        if (!avatars.contains("RenderSystem.enableBlend()") || !avatars.contains("RenderSystem.defaultBlendFunc()"))
            throw new AssertionError("Blit must blend the antialiased edge");
        var units = List.of(unit("com.tikmng.snake.AvatarMask", Files.readString(sources.resolve("AvatarMask.java"))),
            unit("com.tikmng.snake.AvatarMaskAssertions", TESTS));
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) throw new AssertionError("Run with JDK 17 or later");
        var diagnostics = new DiagnosticCollector<JavaFileObject>();
        var output = new HashMap<String, ByteArrayOutputStream>();
        try (var manager = new ForwardingJavaFileManager<StandardJavaFileManager>(compiler.getStandardFileManager(diagnostics, Locale.ROOT, StandardCharsets.UTF_8)) {
            public JavaFileObject getJavaFileForOutput(Location location, String name, JavaFileObject.Kind kind, FileObject sibling) {
                return new SimpleJavaFileObject(URI.create("memory:///" + name.replace('.', '/') + kind.extension), kind) {
                    public OutputStream openOutputStream() {
                        var bytes = new ByteArrayOutputStream(); output.put(name, bytes); return bytes;
                    }
                };
            }
        }) {
            if (!compiler.getTask(null, manager, diagnostics, List.of("-proc:none", "--release", "17"), null, units).call())
                throw new AssertionError(diagnostics.getDiagnostics());
        }
        var loader = new ClassLoader(AvatarMaskCheck.class.getClassLoader()) {
            protected Class<?> findClass(String name) throws ClassNotFoundException {
                var bytes = output.get(name);
                if (bytes == null) throw new ClassNotFoundException(name);
                byte[] value = bytes.toByteArray(); return defineClass(name, value, 0, value.length);
            }
        };
        loader.loadClass("com.tikmng.snake.AvatarMaskAssertions").getMethod("run").invoke(null);
    }

    private static final String TESTS = """
        package com.tikmng.snake;
        public class AvatarMaskAssertions {
            private static int checks;
            private static void check(boolean value, String label) {
                checks++; if (!value) throw new AssertionError(label);
            }
            public static void run() {
                check(AvatarMask.coverage(0, 0, 0) == 0, "empty image");
                check(AvatarMask.coverage(-1, 0, 72) == 0 && AvatarMask.coverage(72, 0, 72) == 0
                    && AvatarMask.coverage(0, -1, 72) == 0 && AvatarMask.coverage(0, 72, 72) == 0, "out of bounds");
                for (int size : new int[] {1, 2, 3, 16, 17, 24, 72, 96, 108, 128, 255, 256}) {
                    double area = 0; int partial = 0;
                    for (int y = 0; y < size; y++) for (int x = 0; x < size; x++) {
                        int coverage = AvatarMask.coverage(x, y, size);
                        area += coverage / 255.0;
                        if (coverage > 0 && coverage < 255) partial++;
                        check(coverage >= 0 && coverage <= 255, "bounded coverage");
                        check(coverage == AvatarMask.coverage(size - 1 - x, y, size)
                            && coverage == AvatarMask.coverage(x, size - 1 - y, size)
                            && coverage == AvatarMask.coverage(y, x, size), "centered circle symmetry");
                        for (int alpha : new int[] {0, 1, 64, 127, 128, 254, 255}) {
                            int rgba = alpha << 24 | 0x6BC5EF, result = AvatarMask.apply(rgba, x, y, size);
                            check((result & 0xFFFFFF) == 0x6BC5EF, "RGB retained for straight-alpha filtering");
                            check((result >>> 24) == (alpha * coverage + 127) / 255 && (result >>> 24) <= alpha,
                                "source transparency multiplied, never replaced");
                        }
                        if (size >= 16 && (x == 0 || x == size - 1) && (y == 0 || y == size - 1))
                            check(coverage == 0, "transparent corners");
                    }
                    check(partial > 0, "fractional boundary coverage");
                    check(Math.abs(area - Math.PI * size * size / 4) < Math.max(.05, size * .02), "circle area at size " + size);
                    if (size >= 3) check(AvatarMask.apply(0x7FABCDEF, size / 2, size / 2, size) == 0x7FABCDEF,
                        "unmodified center color and alpha");
                    // At the diagonal boundary, compare coverage to a denser independent area integral.
                    if (size >= 16) {
                        int x = (int) Math.floor(size * .5 + size * .5 / Math.sqrt(2));
                        int inside = 0, samples = 256;
                        for (int sy = 0; sy < samples; sy++) for (int sx = 0; sx < samples; sx++) {
                            double dx = x + (sx + .5) / samples - size * .5;
                            double dy = x + (sy + .5) / samples - size * .5;
                            if (dx * dx + dy * dy <= size * size * .25) inside++;
                        }
                        double reference = inside * 255.0 / (samples * samples);
                        check(Math.abs(AvatarMask.coverage(x, x, size) - reference) <= 4, "subpixel area accuracy at size " + size);
                    }
                }
                System.out.println("Circular alpha-mask checks passed: " + checks + ". Native rendering is not exercised.");
            }
        }
        """;
}
