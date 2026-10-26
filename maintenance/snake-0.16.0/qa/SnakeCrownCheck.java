import java.io.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import javax.tools.*;
import com.sun.source.tree.*;
import com.sun.source.util.*;

/** java qa/SnakeCrownCheck.java: pure production selection/size checks; no game or class-file output. */
public class SnakeCrownCheck {
    private static JavaFileObject unit(String name, String source) {
        return new SimpleJavaFileObject(URI.create("string:///" + name.replace('.', '/') + ".java"), JavaFileObject.Kind.SOURCE) {
            public CharSequence getCharContent(boolean ignoreEncodingErrors) { return source; }
        };
    }

    public static void main(String[] args) throws Exception {
        Path sources = Path.of("mod/src/main/java/com/tikmng/snake");
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) throw new AssertionError("Run with JDK 17 or later");
        String crown = Files.readString(sources.resolve("SnakeCrownVisuals.java"));
        StringBuilder policy = new StringBuilder("package com.tikmng.snake; class CrownPolicy {\n");
        try (var parserFiles = compiler.getStandardFileManager(null, Locale.ROOT, StandardCharsets.UTF_8)) {
            var parser = (JavacTask)compiler.getTask(null, parserFiles, null, List.of("-proc:none"), null,
                List.of(unit("com.tikmng.snake.SnakeCrownVisuals", crown)));
            var positions = Trees.instance(parser).getSourcePositions();
            int extracted = 0;
            for (var tree : parser.parse()) for (var type : tree.getTypeDecls()) {
                if (!(type instanceof ClassTree declaration)) continue;
                for (var member : declaration.getMembers()) {
                    if (member instanceof MethodTree method && Set.of("selectOwner", "crownRadius").contains(method.getName().toString())) {
                        policy.append(crown, (int)positions.getStartPosition(tree, method),
                            (int)positions.getEndPosition(tree, method)).append('\n');
                        extracted++;
                    }
                }
            }
            if (extracted != 2) throw new AssertionError("Both production policy methods must be tested");
        }
        policy.append("}\n");
        var units = new ArrayList<JavaFileObject>();
        for (String name : List.of("ArenaEngine", "ArenaRules"))
            units.add(unit("com.tikmng.snake." + name, Files.readString(sources.resolve(name + ".java"))));
        units.add(unit("com.tikmng.snake.CrownPolicy", policy.toString()));
        units.add(unit("com.tikmng.snake.CrownAssertions", TESTS));
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
        var loader = new ClassLoader(SnakeCrownCheck.class.getClassLoader()) {
            protected Class<?> findClass(String name) throws ClassNotFoundException {
                var bytes = output.get(name);
                if (bytes == null) throw new ClassNotFoundException(name);
                byte[] value = bytes.toByteArray(); return defineClass(name, value, 0, value.length);
            }
        };
        loader.loadClass("com.tikmng.snake.CrownAssertions").getMethod("run").invoke(null);
    }

    private static final String TESTS = """
        package com.tikmng.snake;
        public class CrownAssertions {
            private static int checks;
            private static void check(boolean value, String label) {
                checks++; if (!value) throw new AssertionError(label);
            }
            public static void run() {
                var engine = new ArenaEngine(73);
                check(CrownPolicy.selectOwner(null) == null && CrownPolicy.selectOwner(engine) == null, "empty arena has no king");
                var zed = engine.join("zed", "Zed", "", 500);
                var amy = engine.join("amy", "Amy", "", 500);
                var bob = engine.join("bob", "Bob", "", 200);
                check(CrownPolicy.selectOwner(engine) == amy, "lexicographic ID resolves mass tie");
                engine.snakes.remove(zed.id); engine.snakes.put(zed.id, zed);
                check(CrownPolicy.selectOwner(engine) == amy, "tie independent of insertion order");
                zed.mass = 501;
                check(CrownPolicy.selectOwner(engine) == zed, "strictly larger owner wins");
                for (double invalid : new double[] {0, -1, Double.NaN, Double.POSITIVE_INFINITY}) {
                    zed.mass = invalid;
                    check(CrownPolicy.selectOwner(engine) == amy, "invalid/empty mass excluded");
                }
                zed.mass = 1000;
                engine.galaxy(3, 5);
                check(CrownPolicy.selectOwner(engine) == zed, "Galaxy selects total owner mass");
                var head = engine.displayHead(zed);
                check(head != zed && engine.renderSnakes().contains(head), "single selected crown uses actual display head");
                check(CrownPolicy.crownRadius(head.renderRadius(1)) <= head.renderRadius(1) * .58,
                    "Galaxy crown scales to fragment head");
                engine.removeSnake(zed.id);
                check(CrownPolicy.selectOwner(engine) == amy, "removed king immediately replaced");
                amy.mass = bob.mass = 0;
                check(CrownPolicy.selectOwner(engine) == null, "no positive owners means no crown");
                for (double invalid : new double[] {-1, 0, Double.NaN, Double.POSITIVE_INFINITY})
                    check(CrownPolicy.crownRadius(invalid) == 0, "invalid radius suppressed");
                for (int i = 1; i <= 1000; i++) {
                    double headRadius = i / 50.0, radius = CrownPolicy.crownRadius(headRadius);
                    check(radius > 0 && radius <= 2 && radius <= headRadius * .580001, "bounded head-relative crown radius");
                }
                engine.reset();
                check(CrownPolicy.selectOwner(engine) == null, "reset cannot retain a king");
                System.out.println("Crown checks passed: " + checks
                    + ". Largest owner, deterministic tie, empty/reset/removal, Galaxy display head and radius cap. Native rendering is not exercised.");
            }
        }
        """;
}
