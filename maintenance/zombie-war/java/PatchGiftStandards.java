import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.jar.JarOutputStream;
import java.util.HashSet;
import java.util.Set;
import org.objectweb.asm.*;

/** Rebuilds a copy, changing only the config-load hook and two bundled resources. */
public final class PatchGiftStandards {
    private static final String OWNER = "com/tikmng/zombiestrike/GameConfig";
    private static final String HOOK = "com/tikmng/zombiestrike/StandardGiftRules";
    private static final String PNG = "assets/mng_zombie_strike/textures/gui/tikmng_zombie_war_gift_guide.png";

    static byte[] patch(byte[] input) {
        ClassReader reader = new ClassReader(input);
        ClassWriter writer = new ClassWriter(reader, 0);
        int[] returns = {0};
        reader.accept(new ClassVisitor(Opcodes.ASM9, writer) {
            @Override public MethodVisitor visitMethod(int access, String name, String descriptor, String signature, String[] exceptions) {
                MethodVisitor original = super.visitMethod(access, name, descriptor, signature, exceptions);
                if (!name.equals("load") || !descriptor.equals("()L" + OWNER + ";")) return original;
                return new MethodVisitor(Opcodes.ASM9, original) {
                    @Override public void visitMethodInsn(int opcode, String owner, String method, String desc, boolean isInterface) {
                        if (owner.equals(HOOK)) throw new IllegalStateException("This mod already has the gift migration hook");
                        super.visitMethodInsn(opcode, owner, method, desc, isInterface);
                    }
                    @Override public void visitInsn(int opcode) {
                        if (opcode == Opcodes.ARETURN) {
                            returns[0]++;
                            super.visitMethodInsn(Opcodes.INVOKESTATIC, HOOK, "migrate", "(L" + OWNER + ";)L" + OWNER + ";", false);
                        }
                        super.visitInsn(opcode);
                    }
                };
            }
        }, 0);
        if (returns[0] != 2) throw new IllegalStateException("Unexpected GameConfig.load layout: " + returns[0]);
        return writer.toByteArray();
    }

    static void add(JarOutputStream out, String name, byte[] bytes) throws Exception {
        JarEntry entry = new JarEntry(name);
        entry.setTime(0);
        out.putNextEntry(entry); out.write(bytes); out.closeEntry();
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 5) throw new IllegalArgumentException("input.jar output.jar classes-dir standards.json guide.png");
        Path source = Path.of(args[0]), target = Path.of(args[1]);
        if (Files.exists(target) || source.toRealPath().equals(target.toAbsolutePath().normalize())) throw new IllegalArgumentException("New output path required");
        Path temporary = target.resolveSibling(target.getFileName() + ".tmp");
        if (Files.exists(temporary)) throw new IllegalArgumentException("Temporary output already exists");
        boolean configFound = false, pngFound = false;
        Set<String> names = new HashSet<>();
        try (JarFile jar = new JarFile(source.toFile()); JarOutputStream out = new JarOutputStream(Files.newOutputStream(temporary))) {
            var entries = jar.entries();
            while (entries.hasMoreElements()) {
                JarEntry entry = entries.nextElement();
                String name = entry.getName();
                if (!names.add(name)) throw new IllegalArgumentException("Duplicate JAR entry");
                if (name.matches("(?i)META-INF/[^/]+\\.(SF|RSA|DSA|EC)")) throw new IllegalArgumentException("Signed JAR cannot be rewritten");
                if (name.equals(HOOK + ".class")) throw new IllegalArgumentException("Migration class already present");
                if (name.equals(PNG)) { pngFound = true; continue; }
                try (InputStream stream = jar.getInputStream(entry)) {
                    byte[] bytes = stream.readAllBytes();
                    if (name.equals(OWNER + ".class")) { bytes = patch(bytes); configFound = true; }
                    add(out, name, bytes);
                }
            }
            if (!configFound || !pngFound) throw new IllegalArgumentException("Original resources not found");
            add(out, HOOK + ".class", Files.readAllBytes(Path.of(args[2]).resolve(HOOK + ".class")));
            add(out, "mng-catalog/standard-gifts.json", Files.readAllBytes(Path.of(args[3])));
            add(out, PNG, Files.readAllBytes(Path.of(args[4])));
        } catch (Exception error) {
            Files.deleteIfExists(temporary); throw error;
        }
        Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE);
        System.out.println("MNG_GIFT_PATCH_READY " + target);
    }
}
