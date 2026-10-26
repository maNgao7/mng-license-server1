import java.io.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import javax.tools.*;

/** java qa/SnakeVisualEffectsCheck.java: offline math/engine QA, no game, Gradle or class-file output. */
public class SnakeVisualEffectsCheck {
    private static JavaFileObject unit(String name, String source) {
        return new SimpleJavaFileObject(URI.create("string:///" + name.replace('.', '/') + ".java"), JavaFileObject.Kind.SOURCE) {
            public CharSequence getCharContent(boolean ignoreEncodingErrors) { return source; }
        };
    }

    public static void main(String[] args) throws Exception {
        Path sources = Path.of("mod/src/main/java/com/tikmng/snake");
        var units = new ArrayList<JavaFileObject>();
        for (String name : List.of("SnakeEffectMath", "ArenaEngine", "ArenaRules"))
            units.add(unit("com.tikmng.snake." + name, Files.readString(sources.resolve(name + ".java"))));
        units.add(unit("com.tikmng.snake.EffectAssertions", TESTS));
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
        var loader = new ClassLoader(SnakeVisualEffectsCheck.class.getClassLoader()) {
            protected Class<?> findClass(String name) throws ClassNotFoundException {
                var bytes = output.get(name);
                if (bytes == null) throw new ClassNotFoundException(name);
                byte[] value = bytes.toByteArray(); return defineClass(name, value, 0, value.length);
            }
        };
        loader.loadClass("com.tikmng.snake.EffectAssertions").getMethod("run").invoke(null);
    }

    private static final String TESTS = """
        package com.tikmng.snake;
        public class EffectAssertions {
            private static int checks;
            private static void check(boolean value, String label) {
                checks++; if (!value) throw new AssertionError(label);
            }
            private static void near(double a, double b, String label) {
                check(Math.abs(a - b) < 1e-8, label + ": " + a + " versus " + b);
            }

            public static void run() {
                feedingStream();
                boostTiersAndExpiry();
                budgets();
                delayedCreditAndGalaxy();
                System.out.println("Visual-effect checks passed: " + checks
                    + ". Tiers 3/5/10, no idle/paused/expired trails, bounded pulses/budgets, tiny feeding stream and delayed credit."
                    + " Native rendering is not exercised.");
            }

            private static void feedingStream() {
                int launched = 0;
                for (int i = 0; i < SnakeEffectMath.FEED_PARTICLES; i++) {
                    boolean seen = false;
                    for (int frame = 1; frame < 1000; frame++) {
                        double age = SnakeEffectMath.feedAge(frame / 1000.0, i);
                        if (age >= 0) { check(age < 1, "bounded feeding age"); seen = true; }
                    }
                    if (seen) launched++;
                }
                check(launched >= 3 && launched <= 8, "three to eight staggered portraits per pending feed");
                for (double radius : new double[] {.04, .12, .55, 1, 4, 14}) {
                    double size = SnakeEffectMath.feedHalfSize(radius);
                    check(size > 0 && size <= .42 && size <= radius * .201, "tiny relative and absolute portrait size");
                    double lastScale = 1;
                    for (int step = 0; step <= 1000; step++) {
                        double age = step / 1000.0, scale = SnakeEffectMath.feedScale(age);
                        check(scale >= 0 && scale <= lastScale + 1e-12, "smooth monotone swallowing");
                        if (age < SnakeEffectMath.FEED_SHRINK) near(scale, 1, "retain photo size until mouth");
                        else {
                            near(SnakeEffectMath.feedApproach(age), 1, "shrink only at mouth");
                            double ahead = SnakeEffectMath.feedAhead(radius, age);
                            check(ahead <= 1e-8 && ahead >= -radius * .121, "shrink inside mouth");
                        }
                        lastScale = scale;
                    }
                    near(lastScale, 0, "fully swallowed before credit");
                }
                int peak = 0;
                for (int frame = 1; frame < 998; frame++) {
                    double progress = frame / 1000.0;
                    int visible = 0;
                    for (int i = 0; i < SnakeEffectMath.FEED_PARTICLES; i++) {
                        double age = SnakeEffectMath.feedAge(progress, i);
                        if (age >= 0 && SnakeEffectMath.feedScale(age) > .001
                                && SnakeEffectMath.feedAlpha(age) > 0) visible++;
                    }
                    check(visible > 0, "continuous stream across the feeding interval");
                    peak = Math.max(peak, visible);
                }
                check(peak >= 3 && peak <= 8, "several simultaneous small portraits");
                for (double progress : new double[] {-.1, 1, 2, Double.NaN, Double.POSITIVE_INFINITY})
                    for (int i = 0; i < 8; i++) check(SnakeEffectMath.feedAge(progress, i) < 0, "no expired/future portraits");
            }

            private static void boostTiersAndExpiry() {
                int[] tiers = {3, 5, 10}, colors = {0x38EAF5, 0xFFC83D, 0xF45BE7};
                int previousSamples = 0;
                double previousLength = 0;
                for (int i = 0; i < tiers.length; i++) {
                    var style = SnakeEffectMath.boostStyle(tiers[i], 100.5, 100, false, .01);
                    check(style.tier() == tiers[i] && style.color() == colors[i], "cyan/gold/magenta tiers");
                    check(style.samples() > previousSamples && style.length() > previousLength, "tier density and length distinguishable");
                    previousSamples = style.samples(); previousLength = style.length();
                    check(style.lifetime() > 0 && style.lifetime() <= .4, "subsecond pulse expiry");
                    for (double time : new double[] {-10, 0, .1234, 100.4, 1e6}) {
                        for (int sample = 0; sample < style.samples(); sample++) {
                            double age = SnakeEffectMath.boostAge(style, time, -123456, sample);
                            check(age >= 0 && age < style.lifetime(), "no over-age particles/history");
                            double fade = SnakeEffectMath.boostFade(style, age);
                            check(fade >= 0 && fade <= 1, "bounded pulse alpha");
                            near(age, SnakeEffectMath.boostAge(style, time, -123456, sample), "fixed simulation time freezes pulse");
                        }
                    }
                    near(SnakeEffectMath.boostFade(style, 0), 0, "no pulse discontinuity at launch");
                    near(SnakeEffectMath.boostFade(style, style.lifetime()), 0, "pulse expires fully");
                    near(SnakeEffectMath.boostFade(style, style.lifetime() + .01), 0, "no stale pulse");
                    check(SnakeEffectMath.boostStyle(tiers[i], 100.5, 100.5, false, 1).tier() == 0, "expire at exact deadline");
                    check(SnakeEffectMath.boostStyle(tiers[i], 100.5, 101, false, 1).tier() == 0, "no expired boost particles");
                    check(SnakeEffectMath.boostStyle(tiers[i], 110, 100, true, 1).tier() == 0, "no paused boost particles");
                    check(SnakeEffectMath.boostStyle(tiers[i], 110, 100, false, 0).tier() == 0, "no stationary boost particles");
                    for (double radius : new double[] {.04, .55, 4, 14}) {
                        int nearCount = SnakeEffectMath.boostSamples(style, 10, radius);
                        int farCount = SnakeEffectMath.boostSamples(style, 200 + radius * 12, radius);
                        check(nearCount == style.samples() && farCount > 0 && farCount < nearCount, "distance reduction for all radii");
                        check(SnakeEffectMath.boostSamples(style, 321 + radius * 28, radius) == 0, "far cull");
                    }
                }
                for (double multiplier : new double[] {-10, 0, 1, Double.NaN, Double.POSITIVE_INFINITY}) {
                    var style = SnakeEffectMath.boostStyle(multiplier, 110, 100, false, 1);
                    check(style.tier() == 0 && SnakeEffectMath.boostSamples(style, 0, 1) == 0, "no unboosted particles");
                }
                check(SnakeEffectMath.boostStyle(10, Double.NaN, 0, false, 1).tier() == 0, "invalid expiry");
                check(SnakeEffectMath.boostStyle(10, 10, Double.NaN, false, 1).tier() == 0, "invalid time");
                check(SnakeEffectMath.boostStyle(10, 10, 0, false, Double.NaN).tier() == 0, "invalid motion");
            }

            private static void budgets() {
                var budget = new SnakeEffectMath.BoostBudget();
                for (int emitter = 0; emitter < 480; emitter++) {
                    for (int particle = 0; particle < 14; particle++) {
                        budget.streak(); budget.sparkle();
                        check(budget.streaks <= 128 && budget.sparkles <= 48 && budget.quads <= 896,
                            "Galaxy-sized population bounded by production frame budget");
                    }
                }
                check(budget.streaks == 128 && budget.sparkles == 48 && budget.quads == 896 && budget.capped,
                    "frame reaches exact caps");
                budget.clear();
                check(budget.quads == 0 && budget.streaks == 0 && budget.sparkles == 0 && !budget.capped,
                    "new frame has no retained geometry");
            }

            private static void delayedCreditAndGalaxy() {
                var engine = new ArenaEngine(53);
                engine.minimumPlayers = 96;
                // Keep ambient food outside this feeding-credit fixture's arena.
                engine.food.replaceAll(p -> new ArenaEngine.Point(1e6, 1e6));
                var owner = engine.join("owner", "Owner", "", 200);
                engine.feed(owner.id, owner.name, owner.profile, 250, 10);
                engine.feed(owner.id, owner.name, owner.profile, 50, 2);
                near(ArenaEngine.FEED_SECONDS, .85, "engine credit deadline unchanged");
                check(engine.feedings.size() == 1 && engine.totalFeedings == 0, "merged pending feeding only");
                var pending = engine.feedings.get(0);
                for (int frame = 0; frame < 100; frame++)
                    for (int i = 0; i < 8; i++) SnakeEffectMath.feedAge(frame / 100.0, i);
                check(engine.feedings.get(0) == pending && owner.mass == 200 && engine.totalFeedings == 0,
                    "presentation math does not mutate queue or award credit");
                for (int i = 0; i < 8; i++) engine.tick(.1);
                engine.tick(.049);
                near(owner.mass, 200, "no early credit at .849s");
                check(engine.feedings.size() == 1 && engine.totalFeedings == 0, "still pending before deadline");
                engine.paused = true;
                engine.tick(.1);
                near(engine.time, .849, "pause retains feeding clock");
                near(owner.mass, 200, "no credit while paused");
                engine.paused = false;
                engine.tick(.002);
                near(owner.mass, 500, "one delayed merged credit after .85s");
                check(engine.feedings.isEmpty() && engine.totalFeedings == 1, "credit exactly once");
                engine.action(owner.id, owner.name, owner.profile, "boost", 10, 3);
                engine.galaxy(3, 5);
                engine.tick(.05);
                check(engine.renderSnakes().size() == 5 && engine.displayHead(owner) != owner, "Galaxy renders fragments");
                for (var fragment : engine.renderSnakes()) {
                    double dx = fragment.x - fragment.renderX(0), dz = fragment.z - fragment.renderZ(0);
                    check(SnakeEffectMath.boostStyle(fragment.boostMultiplier, fragment.boostUntil, engine.time,
                        false, dx * dx + dz * dz).tier() == 10, "moving Galaxy fragments keep boost tier");
                }
                double deadline = owner.boostUntil;
                for (var fragment : engine.renderSnakes()) check(SnakeEffectMath.boostStyle(fragment.boostMultiplier,
                    fragment.boostUntil, deadline, false, 1).tier() == 0, "no fragment trails past boost deadline");
                engine.reset();
                check(engine.renderSnakes().isEmpty() && engine.feedings.isEmpty(), "reset cannot leave stale emitters");
            }
        }
        """;
}
