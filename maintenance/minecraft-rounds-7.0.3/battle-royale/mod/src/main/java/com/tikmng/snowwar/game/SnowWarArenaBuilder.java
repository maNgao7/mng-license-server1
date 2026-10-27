package com.tikmng.snowwar.game;

import com.tikmng.snowwar.SnowWar;
import net.minecraft.core.BlockPos;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.GameRules;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.LeavesBlock;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.saveddata.SavedData;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

import java.util.Random;

/** Builds an original compact battle-royale island; no external map asset is required. */
public final class SnowWarArenaBuilder {
    public static final int RADIUS = 180;
    private static final int SIDE = RADIUS * 2 + 1;
    private static final int COLUMNS_PER_TICK = 1100;
    private static final int VERSION = 7;
    private static final String DATA_ID = "mng_battle_royale_arena";
    private ServerLevel level;
    private int floorY;
    private int column;
    private boolean running;
    private boolean ready;
    private ArenaData data;
    private long decorationTick;
    private long aircraftCleanupUntil;

    public int floorY() { return floorY; }
    public boolean ready() { return ready; }
    public void hideLobbyAircraft() {
        for (var display : level.getEntitiesOfClass(net.minecraft.world.entity.Display.TextDisplay.class,
                new AABB(-15, floorY + 70, -47, 16, floorY + 80, 47),
                entity -> entity.getTags().contains("mng_lobby_sign"))) display.discard();
        clearBox(-70, 60, -58, 70, 105, 58);
        aircraftCleanupUntil = level.getGameTime() + 100;
    }
    public void showLobbyAircraft() { buildLobbyAircraft(); }
    public Vec3 lobbySeat(int index) {
        int column = Math.floorMod(index, 10);
        int row = Math.floorMod(index / 10, 10);
        return new Vec3(-10.5 + column * 2.3, floorY + 71.0, -40.0 + row * 8.5);
    }
    public Vec3 randomLobbyPoint(net.minecraft.util.RandomSource random) {
        return new Vec3(-10.5 + random.nextDouble() * 21.0, floorY + 71.0,
            -40.0 + random.nextDouble() * 80.0);
    }
    public Vec3 randomLandingPoint(ServerLevel target, double radius) {
        return randomLandingPoint(target, radius, 0, 0);
    }
    public Vec3 randomLandingPoint(ServerLevel target, double radius, double centerX, double centerZ) {
        for (int attempt = 0; attempt < 80; attempt++) {
            double angle = target.random.nextDouble() * Math.PI * 2.0;
            double distance = Math.sqrt(target.random.nextDouble()) * Math.max(2.0, radius - 4.0);
            int x = (int)Math.floor(centerX + Math.cos(angle) * distance);
            int z = (int)Math.floor(centerZ + Math.sin(angle) * distance);
            int y = floorY + terrainHeight(x, z) + 1;
            BlockPos feet = new BlockPos(x, y, z);
            if (!target.getBlockState(feet).isAir() || !target.getBlockState(feet.above()).isAir()) continue;
            return new Vec3(x + 0.5, y + 0.05, z + 0.5);
        }
        return new Vec3(centerX, floorY + terrainHeight((int)centerX,(int)centerZ) + 1.05, centerZ);
    }
    public Vec3 roofExit(ServerLevel target, double x, double z) {
        for (int distance = 2; distance <= 24; distance += 2) for (int i=0;i<16;i++) {
            double angle=i*Math.PI/8;
            int px=(int)Math.floor(x+Math.cos(angle)*distance), pz=(int)Math.floor(z+Math.sin(angle)*distance);
            int y=floorY+terrainHeight(px,pz)+1;
            BlockPos pos=new BlockPos(px,y,pz);
            if (target.getBlockState(pos).isAir() && target.getBlockState(pos.above()).isAir())
                return new Vec3(px+0.5,y+0.05,pz+0.5);
        }
        return randomLandingPoint(target, RADIUS-8);
    }
    public int groundY(int x,int z) { return floorY+terrainHeight(x,z)+1; }
    public void movePlayerToLobby(ServerPlayer player) {
        player.teleportTo(0.5, floorY + 72.0, -43.5);
    }
    public void movePlayerToBattleView(ServerPlayer player) {
        player.teleportTo(0.5, floorY + 54.0, 0.5);
    }

    public void startIfNeeded(ServerPlayer player) {
        ServerLevel current = player.serverLevel();
        if (level == current && (running || ready)) return;
        level = current;
        data = current.getDataStorage().computeIfAbsent(ArenaData::load, ArenaData::new, DATA_ID);
        if (data.version >= VERSION) {
            floorY = data.floorY;
            if (data.billboardVersion < 5) {
                if (data.billboardVersion > 0 && data.billboardVersion < 3) clearPreviousBillboard();
                for (var old : level.getEntitiesOfClass(net.minecraft.world.entity.Display.TextDisplay.class,
                        new AABB(-10,floorY+20,-10,10,floorY+30,10)))
                    if (old.getTags().stream().anyMatch(tag -> tag.startsWith("mng_brand_face_"))) old.discard();
                buildBrandBillboard();
                data.billboardVersion = 5;
                data.setDirty();
            }
            ensureBillboardText();
            buildLobbyAircraft();
            ready = true;
            configure();
            clearAmbientMobs();
            SnowWar.LOGGER.info("MNG_BATTLE_ARENA_READY existing floorY={}", floorY);
            return;
        }
        floorY = data.version > 0 ? data.floorY : current.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, 0, 0) - 1;
        column = 0;
        running = true;
        ready = false;
        configure();
        player.teleportTo(0.5, floorY + 2.0, 0.5);
        player.displayClientMessage(Component.literal("MNG Battle Royale savaş alanı hazırlanıyor..."), false);
        SnowWar.LOGGER.info("MNG_BATTLE_ARENA_BUILD_STARTED floorY={}", floorY);
    }

    public void tick() {
        if (level == null) return;
        if (aircraftCleanupUntil > level.getGameTime()) {
            for (var item : level.getEntitiesOfClass(net.minecraft.world.entity.item.ItemEntity.class,
                    new AABB(-75,floorY-10,-65,75,floorY+110,65)))
                if (item.getItem().is(net.minecraft.world.item.Items.BLUE_CARPET)) item.discard();
            for (ServerPlayer player : level.players())
                for (int slot=0;slot<player.getInventory().getContainerSize();slot++)
                    if (player.getInventory().getItem(slot).is(net.minecraft.world.item.Items.BLUE_CARPET))
                        player.getInventory().setItem(slot,net.minecraft.world.item.ItemStack.EMPTY);
        }
        if (ready) tickSmoke();
        if (!running) return;
        int stop = Math.min(SIDE * SIDE, column + COLUMNS_PER_TICK);
        for (; column < stop; column++) {
            int x = column % SIDE - RADIUS;
            int z = column / SIDE - RADIUS;
            double distance = Math.sqrt(x * x + z * z);
            BlockState surface;
            if (distance > RADIUS - 2) surface = Blocks.SAND.defaultBlockState();
            else if (Math.sin(x * 0.065 + Math.cos(z * 0.04)) + Math.cos(z * 0.075) > 1.8)
                surface = Blocks.COARSE_DIRT.defaultBlockState();
            else surface = Blocks.GRASS_BLOCK.defaultBlockState();
            level.setBlock(new BlockPos(x, floorY, z), surface, 2);
            for (int y = 1; y <= 35; y++) level.setBlock(new BlockPos(x, floorY + y, z), Blocks.AIR.defaultBlockState(), 2);
            int elevation = terrainHeight(x, z);
            for (int y = 0; y < elevation; y++) place(x, y, z, Blocks.DIRT);
            if (elevation > 0) placeState(x, elevation, z, surface);
        }
        if (column < SIDE * SIDE) return;
        decorate();
        data.version = VERSION;
        data.floorY = floorY;
        data.setDirty();
        running = false;
        ready = true;
        configure();
        for (ServerPlayer player : level.players()) {
            movePlayerToLobby(player);
            player.displayClientMessage(Component.literal("Savaş alanı hazır. B tuşuyla canlı yayın ve hediye ayarlarını aç."), false);
        }
        SnowWar.LOGGER.info("MNG_BATTLE_ARENA_READY radius={}", RADIUS);
    }

    public void sweep() {
        clearAmbientMobs();
        if (ready) configure();
    }

    private void decorate() {
        clearLegacyHighStructures();
        buildRoadsV2();
        buildPochinki(-72, -28);
        buildGeorgopol(88, -58);
        buildMilitaryBase(-35, 104);
        buildHangar(-132, -81);
        buildStalber(105, 92);
        buildCenterSchool();
        buildBrandBillboard();
        data.billboardVersion = 5;
        buildCraters();
        buildVehicles();
        buildPerimeter();
        buildLobbyAircraft();
        Random random = new Random(761945L);
        for (int i = 0; i < 105; i++) {
            double angle = random.nextDouble() * Math.PI * 2;
            double radius = 45 + random.nextDouble() * 122;
            int x = (int)Math.round(Math.cos(angle) * radius);
            int z = (int)Math.round(Math.sin(angle) * radius);
            if (onRoad(x, z) || inNamedRegion(x, z)) continue;
            buildTree(x, z, 5 + random.nextInt(5));
        }
    }

    private void clearLegacyHighStructures() {
        clearBox(-70, 60, -58, 70, 105, 58);
        clearBox(-78, 1, 42, -58, 34, 63);
        clearBox(-38, 1, 45, -5, 18, 82);
        clearBox(16, 1, -72, 66, 18, -38);
    }

    private void buildRoadsV2() {
        road(-165, 165, 0, true, 4);
        road(-155, 154, 18, false, 4);
        diagonalRoad(-145, -105, 142, 112, 5);
        diagonalRoad(-115, 145, 110, -135, 5);
        for (int marker = -150; marker <= 150; marker += 14) {
            place(marker, 0, 0, Blocks.YELLOW_CONCRETE);
            place(18, 0, marker, Blocks.YELLOW_CONCRETE);
        }
    }

    private void road(int from, int to, int fixed, boolean alongX, int halfWidth) {
        for (int value = from; value <= to; value++) for (int side = -halfWidth; side <= halfWidth; side++) {
            int x = alongX ? value : fixed + side;
            int z = alongX ? fixed + side : value;
            if (x * x + z * z < (RADIUS - 4) * (RADIUS - 4)) place(x, 0, z, Blocks.GRAY_CONCRETE);
        }
    }

    private void diagonalRoad(int x1, int z1, int x2, int z2, int width) {
        int steps = Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1));
        for (int i = 0; i <= steps; i++) {
            int x = x1 + (x2 - x1) * i / steps;
            int z = z1 + (z2 - z1) * i / steps;
            for (int dx = -width; dx <= width; dx++) for (int dz = -width; dz <= width; dz++)
                if (dx * dx + dz * dz <= width * width) place(x + dx, 0, z + dz, Blocks.GRAY_CONCRETE);
        }
    }

    private void buildPochinki(int cx, int cz) {
        int[][] plots = {{-28,-22},{-10,-24},{10,-21},{28,-22},{-27,1},{-8,2},{11,1},{29,3},{-25,24},{-5,23},{16,24},{34,23}};
        net.minecraft.world.level.block.Block[] walls = {
            Blocks.BRICKS, Blocks.YELLOW_TERRACOTTA, Blocks.WHITE_TERRACOTTA,
            Blocks.ORANGE_TERRACOTTA, Blocks.LIGHT_GRAY_CONCRETE, Blocks.RED_TERRACOTTA
        };
        for (int i = 0; i < plots.length; i++)
            buildHouse(cx + plots[i][0], cz + plots[i][1], 11 + i % 3 * 2, 9 + (i + 1) % 2 * 2,
                6 + i % 2 * 3, walls[i % walls.length]);
        buildSign(cx, cz - 37, "POCHINKI");
    }

    private void buildHouse(int x, int z, int width, int depth, int height, net.minecraft.world.level.block.Block wall) {
        fill(x, 1, z, x + width, 1, z + depth, Blocks.SMOOTH_STONE);
        for (int y = 2; y <= height; y++) for (int dx = 0; dx <= width; dx++) for (int dz = 0; dz <= depth; dz++) {
            if (dx != 0 && dx != width && dz != 0 && dz != depth) continue;
            boolean door = dz == 0 && dx >= width / 2 - 1 && dx <= width / 2 && y <= 3;
            boolean window = y >= 3 && y <= 4 && ((dz == 0 || dz == depth) && dx % 5 == 2 ||
                (dx == 0 || dx == width) && dz % 5 == 2);
            if (door) place(x + dx, y, z + dz, Blocks.AIR);
            else place(x + dx, y, z + dz, window ? Blocks.GLASS_PANE : wall);
        }
        if (height >= 8) fill(x + 1, 5, z + 1, x + width - 1, 5, z + depth - 1, Blocks.SPRUCE_PLANKS);
        for (int layer = 0; layer <= 3; layer++)
            fill(x - 1 + layer, height + 1 + layer, z - 1, x + width + 1 - layer, height + 1 + layer, z + depth + 1,
                layer % 2 == 0 ? Blocks.DARK_OAK_PLANKS : Blocks.BRICKS);
        fill(x + 1, 2, z + 1, x + 2, 3, z + 2, Blocks.BARREL);
    }

    private void buildGeorgopol(int cx, int cz) {
        buildWarehouse(cx - 28, cz - 15, 30, 18);
        buildWarehouse(cx + 8, cz - 15, 30, 18);
        buildWarehouse(cx - 10, cz + 15, 34, 20);
        net.minecraft.world.level.block.Block[] colors = {Blocks.BLUE_CONCRETE, Blocks.RED_CONCRETE,
            Blocks.YELLOW_CONCRETE, Blocks.GREEN_CONCRETE, Blocks.ORANGE_CONCRETE};
        for (int row = 0; row < 5; row++) for (int col = 0; col < 7; col++) {
            int x = cx - 39 + col * 12;
            int z = cz + 43 + row * 7;
            buildContainer(x, z, colors[(row + col) % colors.length]);
        }
        buildCrane(cx + 42, cz + 32);
        buildSign(cx, cz - 31, "GEORGOPOL");
    }

    private void buildWarehouse(int x, int z, int width, int depth) {
        fill(x, 1, z, x + width, 1, z + depth, Blocks.SMOOTH_STONE);
        for (int y = 2; y <= 9; y++) {
            fill(x, y, z, x, y, z + depth, Blocks.GRAY_CONCRETE);
            fill(x + width, y, z, x + width, y, z + depth, Blocks.GRAY_CONCRETE);
            if (y > 6 || y < 3) fill(x, y, z + depth, x + width, y, z + depth, Blocks.LIGHT_GRAY_CONCRETE);
        }
        for (int dx = 0; dx <= width; dx++) for (int dz = -1; dz <= depth + 1; dz++)
            place(x + dx, 10 - Math.abs(width / 2 - dx) / Math.max(4, width / 8), z + dz, Blocks.IRON_BLOCK);
    }

    private void buildCrane(int x, int z) {
        fill(x - 2, 1, z - 2, x + 2, 22, z + 2, Blocks.YELLOW_CONCRETE);
        fill(x - 18, 22, z, x + 22, 24, z + 2, Blocks.YELLOW_CONCRETE);
        fill(x + 17, 18, z + 1, x + 17, 22, z + 1, Blocks.CHAIN);
    }

    private void buildVehicles() {
        buildCar(-25, -3, Blocks.RED_CONCRETE, false);
        buildCar(52, 3, Blocks.BLUE_CONCRETE, true);
        buildVan(14, -76, Blocks.WHITE_CONCRETE);
        buildPickup(22, 58, Blocks.GREEN_CONCRETE);
    }

    private void buildCar(int x, int z, net.minecraft.world.level.block.Block color, boolean alongZ) {
        for (int forward = -3; forward <= 3; forward++) for (int side = -2; side <= 2; side++) {
            int px = alongZ ? x + side : x + forward;
            int pz = alongZ ? z + forward : z + side;
            place(px, 1, pz, color);
        }
        for (int forward = -1; forward <= 2; forward++) for (int side = -1; side <= 1; side++) {
            int px = alongZ ? x + side : x + forward;
            int pz = alongZ ? z + forward : z + side;
            place(px, 2, pz, forward == -1 || forward == 2 ? Blocks.LIGHT_BLUE_STAINED_GLASS : color);
        }
        for (int forward : new int[]{-2, 2}) for (int side : new int[]{-2, 2}) {
            int px = alongZ ? x + side : x + forward;
            int pz = alongZ ? z + forward : z + side;
            place(px, 0, pz, Blocks.BLACK_CONCRETE);
        }
        int frontX = alongZ ? x : x - 4;
        int frontZ = alongZ ? z - 4 : z;
        place(frontX, 1, frontZ, Blocks.SEA_LANTERN);
    }

    private void buildVan(int x, int z, net.minecraft.world.level.block.Block color) {
        fill(x - 3, 1, z - 5, x + 3, 1, z + 5, color);
        fill(x - 3, 2, z - 3, x + 3, 4, z + 5, color);
        fill(x - 2, 2, z - 5, x + 2, 3, z - 4, Blocks.LIGHT_BLUE_STAINED_GLASS);
        for (int side : new int[]{-3,3}) for (int dz : new int[]{-3,3}) place(x + side, 0, z + dz, Blocks.BLACK_CONCRETE);
        place(x - 2, 2, z - 6, Blocks.SEA_LANTERN);
        place(x + 2, 2, z - 6, Blocks.SEA_LANTERN);
    }

    private void buildPickup(int x, int z, net.minecraft.world.level.block.Block color) {
        fill(x - 3, 1, z - 5, x + 3, 1, z + 5, color);
        fill(x - 3, 2, z - 5, x + 3, 3, z - 1, color);
        fill(x - 2, 2, z - 5, x + 2, 2, z - 5, Blocks.LIGHT_BLUE_STAINED_GLASS);
        for (int side : new int[]{-3,3}) for (int dz : new int[]{-3,3}) place(x + side, 0, z + dz, Blocks.BLACK_CONCRETE);
        fill(x - 3, 2, z + 1, x - 3, 2, z + 5, Blocks.IRON_BARS);
        fill(x + 3, 2, z + 1, x + 3, 2, z + 5, Blocks.IRON_BARS);
    }

    private void buildLobbyAircraft() {
        int base = 70;
        fill(-13, base, -46, 13, base, 46, Blocks.SMOOTH_QUARTZ);
        for (int z = -46; z <= 46; z++) for (int y = base + 1; y <= base + 8; y++) {
            boolean window = z % 6 == 0 && y >= base + 4 && y <= base + 5;
            place(-14, y, z, window ? Blocks.LIGHT_BLUE_STAINED_GLASS : Blocks.IRON_BLOCK);
            place(14, y, z, window ? Blocks.LIGHT_BLUE_STAINED_GLASS : Blocks.IRON_BLOCK);
        }
        fill(-13, base + 9, -45, 13, base + 9, 45, Blocks.IRON_BLOCK);
        fill(-11, base + 10, -43, 11, base + 10, 43, Blocks.LIGHT_GRAY_CONCRETE);
        fill(-8, base + 11, -40, 8, base + 11, 40, Blocks.LIGHT_GRAY_CONCRETE);
        fill(-4, base + 12, -34, 4, base + 12, 34, Blocks.WHITE_CONCRETE);
        for (int step = 0; step < 11; step++) {
            int width = Math.max(2, 13 - step);
            int z = -47 - step;
            fill(-width, base + 1 + step / 3, z, width, base + 8 - step / 3, z,
                step < 4 ? Blocks.LIGHT_BLUE_STAINED_GLASS : Blocks.IRON_BLOCK);
        }
        fill(-67, base - 1, -8, 67, base + 1, 17, Blocks.LIGHT_GRAY_CONCRETE);
        for (int x = -67; x <= 67; x++) if (Math.abs(x) > 14) {
            int sweep = Math.max(0, (Math.abs(x) - 14) / 4);
            fill(x, base, -7 + sweep, x, base + 2, 17 + sweep / 2, Blocks.GRAY_CONCRETE);
        }
        for (int side : new int[]{-34,34}) {
            fill(side - 4, base - 6, 0, side + 4, base - 2, 12, Blocks.GRAY_CONCRETE);
            fill(side - 3, base - 5, -1, side + 3, base - 3, -1, Blocks.BLACK_CONCRETE);
            fill(side - 3, base - 5, 13, side + 3, base - 3, 13, Blocks.BLACK_CONCRETE);
        }
        fill(-26, base + 2, 38, 26, base + 4, 54, Blocks.LIGHT_GRAY_CONCRETE);
        fill(-3, base + 4, 38, 3, base + 20, 55, Blocks.BLUE_CONCRETE);
        fill(-2, base + 5, 45, 2, base + 18, 57, Blocks.WHITE_CONCRETE);
        for (int z = -42; z <= 40; z += 6) {
            place(-11, base + 5, z, Blocks.SEA_LANTERN);
            place(11, base + 5, z, Blocks.SEA_LANTERN);
        }
        fill(-2, base + 1, -44, 2, base + 1, 44, Blocks.BLUE_CARPET);
        fill(-14, base + 2, -45, -14, base + 3, 45, Blocks.BLUE_CONCRETE);
        fill(14, base + 2, -45, 14, base + 3, 45, Blocks.BLUE_CONCRETE);
        for (int z = -42; z <= 42; z += 6) for (int x = -10; x <= 10; x += 5) {
            place(x, base, z, Blocks.SEA_LANTERN);
            place(x, base + 8, z, Blocks.SEA_LANTERN);
        }
        clearBox(-12, base + 1, 39, 12, base + 7, 58);
        fill(-12, base, 39, 12, base, 51, Blocks.SMOOTH_QUARTZ);
        fill(-13, base + 1, 46, 13, base + 7, 46, Blocks.BARRIER);
        for (int z = -42; z <= 42; z += 5) for (int x : new int[]{-8,-3,3,8})
            place(x, base + 8, z, Blocks.SEA_LANTERN);
        ensureLobbySigns(base);
    }

    private void ensureLobbySigns(int base) {
        for (int side : new int[]{-1, 1}) {
            fill(side * 14, base + 4, -13, side * 14, base + 7, 13, Blocks.BLACK_CONCRETE);
            for (int z = -12; z <= 12; z += 6) place(side * 11, base + 5, z, Blocks.AIR);
            String identity = "mng_lobby_sign_" + side;
            if (!level.getEntitiesOfClass(net.minecraft.world.entity.Display.TextDisplay.class,
                    new AABB(-15, floorY + base, -15, 16, floorY + base + 10, 15),
                    entity -> entity.getTags().contains(identity)).isEmpty()) continue;
            var display = net.minecraft.world.entity.EntityType.TEXT_DISPLAY.create(level);
            if (display == null) continue;
            CompoundTag tag = new CompoundTag();
            tag.putString("text", Component.Serializer.toJson(Component.literal("BEKLEME ALANI")
                .withStyle(net.minecraft.ChatFormatting.WHITE, net.minecraft.ChatFormatting.BOLD)));
            tag.putString("billboard", "fixed");
            tag.putString("alignment", "center");
            tag.putInt("background", 0);
            tag.putBoolean("shadow", true);
            tag.putInt("line_width", 300);
            tag.putFloat("view_range", 4);
            CompoundTag brightness = new CompoundTag();
            brightness.putInt("block", 15); brightness.putInt("sky", 15);
            tag.put("brightness", brightness);
            CompoundTag transform = new CompoundTag();
            net.minecraft.nbt.ListTag scale = new net.minecraft.nbt.ListTag();
            for (int axis = 0; axis < 3; axis++) scale.add(net.minecraft.nbt.FloatTag.valueOf(4.5F));
            transform.put("scale", scale);
            net.minecraft.nbt.ListTag translation = new net.minecraft.nbt.ListTag();
            for (int axis = 0; axis < 3; axis++) translation.add(net.minecraft.nbt.FloatTag.valueOf(0));
            transform.put("translation", translation);
            for (String rotation : new String[]{"left_rotation", "right_rotation"}) {
                net.minecraft.nbt.ListTag quaternion = new net.minecraft.nbt.ListTag();
                for (int axis = 0; axis < 4; axis++) quaternion.add(net.minecraft.nbt.FloatTag.valueOf(axis == 3 ? 1 : 0));
                transform.put(rotation, quaternion);
            }
            tag.put("transformation", transform);
            display.load(tag);
            display.moveTo(side < 0 ? -12.98 : 13.98, floorY + base + 5.1, 0.5, side < 0 ? -90 : 90, 0);
            display.addTag("mng_lobby_sign"); display.addTag(identity);
            level.addFreshEntity(display);
        }
    }

    private void buildMilitaryBase(int cx, int cz) {
        fill(cx - 78, 0, cz - 10, cx + 80, 0, cz + 2, Blocks.GRAY_CONCRETE);
        for (int marker = -70; marker <= 70; marker += 12) fill(cx + marker, 0, cz - 5, cx + marker + 5, 0, cz - 3, Blocks.WHITE_CONCRETE);
        buildHangar(cx - 42, cz + 25);
        buildHangar(cx + 38, cz + 25);
        buildHangar(cx - 2, cz + 49);
        buildPlaneWreck(cx + 28, cz - 4);
        buildTankWreck(cx - 58, cz + 1);
        buildTankWreck(cx + 66, cz + 20);
        buildWatchTower(cx - 78, cz + 38);
        buildWatchTower(cx + 78, cz + 38);
        buildSign(cx, cz - 18, "SOSNOVKA ASKERI US");
    }

    private void buildStalber(int cx, int cz) {
        for (int r = 22; r >= 4; r -= 3) {
            int y = (22 - r) / 3 + 1;
            for (int x = -r; x <= r; x++) for (int z = -r; z <= r; z++)
                if (x * x + z * z <= r * r) place(cx + x, y, cz + z, Blocks.STONE);
        }
        buildRadioTower(cx, cz);
        buildWatchTower(cx - 28, cz + 2);
        buildSign(cx, cz - 28, "STALBER");
    }

    private void buildCenterSchool() {
        buildHouse(-18, -28, 36, 22, 9, Blocks.BRICKS);
        fill(-13, 2, -17, -13, 4, -10, Blocks.LIGHT_GRAY_CONCRETE);
        for (int x = -9; x <= 9; x += 6) for (int z = -18; z <= -12; z += 6) place(x, 2, z, Blocks.BARREL);
        buildSign(0, -34, "MNG OKUL");
    }

    private void buildBrandBillboard() {
        fill(-2,0,-2,2,1,2,Blocks.SMOOTH_STONE);
        fill(-1,2,-1,1,20,1,Blocks.POLISHED_DEEPSLATE);
        fill(-2,20,-2,2,21,2,Blocks.IRON_BLOCK);
        for (int side : new int[]{-7,7}) {
            fill(-7,22,side,7,27,side,Blocks.BLACK_CONCRETE);
            fill(side,22,-7,side,27,7,Blocks.BLACK_CONCRETE);
            for (int y : new int[]{21,28}) {
                fill(-7,y,side,7,y,side,Blocks.IRON_BLOCK);
                fill(side,y,-7,side,y,7,Blocks.IRON_BLOCK);
            }
            for (int corner : new int[]{-7,7}) {
                fill(side,22,corner,side,27,corner,Blocks.IRON_BLOCK);
                place(side,28,corner,Blocks.SEA_LANTERN);
            }
        }
        ensureBillboardText();
    }

    private void clearPreviousBillboard() {
        clearBox(-39,29,-39,39,51,39);
        for (int x : new int[]{-34,34}) for (int z : new int[]{-34,34})
            clearBox(x-2,1,z-2,x+2,28,z+2);
        for (int x : new int[]{-32,32}) clearBox(x-3,1,26,x+3,28,32);
    }

    private void ensureBillboardText() {
        double[][] faces = {{0.5,8.02,0},{0.5,-7.02,180},{8.02,0.5,-90},{-7.02,0.5,90}};
        for (int i=0;i<faces.length;i++) {
            String tagName = "mng_brand_face_"+i;
            if (!level.getEntitiesOfClass(net.minecraft.world.entity.Display.TextDisplay.class,
                    new AABB(-10,floorY+20,-10,10,floorY+30,10), e -> e.getTags().contains(tagName)).isEmpty()) continue;
            var display = net.minecraft.world.entity.EntityType.TEXT_DISPLAY.create(level);
            if (display == null) continue;
            CompoundTag tag = new CompoundTag();
            tag.putString("text", Component.Serializer.toJson(Component.literal("TikMnG")
                .withStyle(net.minecraft.ChatFormatting.WHITE,net.minecraft.ChatFormatting.BOLD)));
            tag.putString("billboard","fixed");
            tag.putString("alignment","center");
            tag.putInt("background",0);
            tag.putBoolean("shadow",true);
            tag.putInt("line_width",200);
            tag.putFloat("view_range",4);
            CompoundTag light = new CompoundTag(); light.putInt("block",15); light.putInt("sky",15);
            tag.put("brightness",light);
            CompoundTag transform = new CompoundTag();
            net.minecraft.nbt.ListTag scale = new net.minecraft.nbt.ListTag();
            for (int axis=0;axis<3;axis++) scale.add(net.minecraft.nbt.FloatTag.valueOf(8));
            transform.put("scale",scale);
            net.minecraft.nbt.ListTag translation = new net.minecraft.nbt.ListTag();
            for (int axis=0;axis<3;axis++) translation.add(net.minecraft.nbt.FloatTag.valueOf(0));
            transform.put("translation",translation);
            for (String rotation : new String[]{"left_rotation","right_rotation"}) {
                net.minecraft.nbt.ListTag quaternion = new net.minecraft.nbt.ListTag();
                for (int axis=0;axis<4;axis++) quaternion.add(net.minecraft.nbt.FloatTag.valueOf(axis == 3 ? 1 : 0));
                transform.put(rotation,quaternion);
            }
            tag.put("transformation",transform);
            display.load(tag);
            display.moveTo(faces[i][0],floorY+23.5,faces[i][1],(float)faces[i][2],0);
            display.addTag(tagName);
            level.addFreshEntity(display);
        }
    }

    private void buildCraters() {
        int[][] sites = {{-132,42},{46,62},{132,-5},{-112,-105},{68,128}};
        for (int[] site : sites) for (int dx = -7; dx <= 7; dx++) for (int dz = -7; dz <= 7; dz++) {
            int d = dx * dx + dz * dz;
            if (d <= 45) place(site[0] + dx, 0, site[1] + dz, d < 15 ? Blocks.BLACKSTONE : Blocks.COARSE_DIRT);
            if (d >= 26 && d <= 52) place(site[0] + dx, 1, site[1] + dz, Blocks.COBBLESTONE);
        }
    }

    private void buildWatchTower(int x, int z) {
        for (int y = 1; y <= 13; y++) for (int dx : new int[]{-2,2}) for (int dz : new int[]{-2,2}) place(x + dx, y, z + dz, Blocks.IRON_BARS);
        fill(x - 4, 13, z - 4, x + 4, 13, z + 4, Blocks.SMOOTH_STONE);
        fill(x - 3, 14, z - 3, x + 3, 16, z + 3, Blocks.GLASS);
    }

    private void buildSign(int x, int z, String label) {
        place(x - 4, 1, z, Blocks.COBBLESTONE_WALL);
        place(x + 4, 1, z, Blocks.COBBLESTONE_WALL);
        for (int dx = -4; dx <= 4; dx++) place(x + dx, 2, z,
            Math.abs(dx) % 3 == 0 ? Blocks.WHITE_CONCRETE : Blocks.RED_CONCRETE);
    }

    private void fill(int x1, int y1, int z1, int x2, int y2, int z2, net.minecraft.world.level.block.Block block) {
        for (int x = Math.min(x1,x2); x <= Math.max(x1,x2); x++)
            for (int y = Math.min(y1,y2); y <= Math.max(y1,y2); y++)
                for (int z = Math.min(z1,z2); z <= Math.max(z1,z2); z++) place(x, y, z, block);
    }

    private void clearBox(int x1, int y1, int z1, int x2, int y2, int z2) { fill(x1, y1, z1, x2, y2, z2, Blocks.AIR); }

    private boolean onRoad(int x, int z) {
        return Math.abs(z) <= 8 || Math.abs(x - 18) <= 8
            || Math.abs(z - (x + 145) * 217.0 / 287.0 + 105) < 9
            || Math.abs(z + (x + 115) * 280.0 / 225.0 - 145) < 9;
    }
    private int terrainHeight(int x, int z) {
        if (onRoad(x,z) || inNamedRegion(x,z) || Math.abs(x) > 167 || Math.abs(z) > 167
            || between(x,-150,-110) && between(z,-100,-60)) return 0;
        int[][] hills = {{-120,57,10,32},{-67,-117,9,38},{48,-133,7,30},{-114,117,6,28}};
        double elevation = 0;
        for (int[] hill : hills) {
            double distance = Math.sqrt((x-hill[0])*(x-hill[0]) + (z-hill[1])*(z-hill[1]));
            elevation = Math.max(elevation, hill[2] * Math.max(0, 1-distance/hill[3]));
        }
        return (int)Math.floor(elevation);
    }
    private boolean inNamedRegion(int x, int z) {
        return between(x,-115,-25) && between(z,-70,20) || between(x,40,140) && between(z,-105,25)
            || between(x,-125,55) && between(z,72,150) || between(x,72,140) && between(z,60,135)
            || between(x,-28,28) && between(z,-42,-4);
    }
    private boolean between(int value, int min, int max) { return value >= min && value <= max; }

    private void buildRoads() {
        for (int x = -108; x <= 108; x++) for (int dz = -3; dz <= 3; dz++)
            if (x * x + dz * dz < (RADIUS - 3) * (RADIUS - 3)) place(x, 0, dz, Blocks.GRAY_CONCRETE);
        for (int z = -108; z <= 108; z++) for (int dx = -3; dx <= 3; dx++)
            if (dx * dx + z * z < (RADIUS - 3) * (RADIUS - 3)) place(dx, 0, z, Blocks.GRAY_CONCRETE);
        for (int marker = -96; marker <= 96; marker += 12) {
            place(marker, 0, 0, Blocks.YELLOW_CONCRETE);
            place(0, 0, marker, Blocks.YELLOW_CONCRETE);
        }
    }

    private void buildRuinedVillage(int centerX, int centerZ) {
        for (int i = 0; i < 5; i++) {
            int x = centerX + (i % 3) * 13 - 13;
            int z = centerZ + (i / 3) * 15 - 7;
            buildRuin(x, z, 9 + i % 2 * 3, 8 + (i + 1) % 2 * 3, 5 + i % 3);
        }
    }

    private void buildRuin(int x, int z, int width, int depth, int height) {
        for (int dx = 0; dx < width; dx++) for (int dz = 0; dz < depth; dz++) {
            place(x + dx, 1, z + dz, Blocks.STONE_BRICKS);
            if (dx != 0 && dx != width - 1 && dz != 0 && dz != depth - 1) continue;
            for (int y = 2; y <= height; y++) {
                if ((dx * 17 + dz * 11 + y * 7) % 13 < 3 || (y == 2 && (dx + dz) % 4 == 0)) continue;
                place(x + dx, y, z + dz, (dx + dz + y) % 5 == 0 ? Blocks.CRACKED_STONE_BRICKS : Blocks.BRICKS);
            }
        }
        place(x + width / 2, 2, z, Blocks.AIR);
        place(x + width / 2, 3, z, Blocks.AIR);
        place(x + 2, 2, z + depth - 1, Blocks.IRON_BARS);
        place(x + width - 3, 2, z + depth - 1, Blocks.IRON_BARS);
    }

    private void buildHangar(int x, int z) {
        for (int dx = -13; dx <= 13; dx++) for (int dz = -9; dz <= 9; dz++) place(x + dx, 1, z + dz, Blocks.SMOOTH_STONE);
        for (int dz = -9; dz <= 9; dz++) for (int y = 2; y <= 9; y++) {
            place(x - 13, y, z + dz, Blocks.GRAY_CONCRETE);
            place(x + 13, y, z + dz, Blocks.GRAY_CONCRETE);
        }
        for (int dx = -13; dx <= 13; dx++) for (int y = 2; y <= 8; y++)
            if (Math.abs(dx) > 5) place(x + dx, y, z - 9, Blocks.GRAY_CONCRETE);
        for (int dx = -14; dx <= 14; dx++) for (int dz = -10; dz <= 10; dz++)
            place(x + dx, 12 - (int)Math.round(Math.pow(Math.abs(dx) / 14.0, 2) * 4), z + dz,
                dz % 5 == 0 ? Blocks.GRAY_CONCRETE : Blocks.LIGHT_GRAY_CONCRETE);
        fill(x - 13, 2, z + 9, x + 13, 8, z + 9, Blocks.GRAY_CONCRETE);
        for (int dx = -9; dx <= 9; dx += 6) fill(x + dx, 5, z + 9, x + dx + 2, 6, z + 9, Blocks.GLASS);
        fill(x - 6, 0, z - 18, x + 6, 0, z - 10, Blocks.SMOOTH_STONE);
    }

    private void buildPlaneWreck(int x, int z) {
        for (int dz = -21; dz <= 20; dz++) {
            int radius = Math.abs(dz) > 17 ? 1 : Math.abs(dz) > 13 ? 2 : 3;
            for (int dx = -radius; dx <= radius; dx++) for (int dy = -radius; dy <= radius; dy++)
                if (dx * dx + dy * dy <= radius * radius)
                    place(x + dx, 6 + dy, z + dz, dy == 0 ? Blocks.GRAY_CONCRETE : Blocks.WHITE_CONCRETE);
            if (dz > -15 && dz < 13 && dz % 3 == 0) {
                place(x - radius, 7, z + dz, Blocks.BLACK_STAINED_GLASS);
                place(x + radius, 7, z + dz, Blocks.BLACK_STAINED_GLASS);
            }
        }
        fill(x - 1, 7, z - 18, x + 1, 8, z - 16, Blocks.BLACK_STAINED_GLASS);
        for (int wing = -23; wing <= 23; wing++) {
            int sweep = Math.abs(wing) / 3;
            fill(x + wing, 5, z - 2 + sweep, x + wing, 5, z + 5 + sweep, Blocks.LIGHT_GRAY_CONCRETE);
        }
        for (int side : new int[]{-11,11}) {
            fill(x + side - 1, 3, z + 1, x + side + 1, 5, z + 7, Blocks.GRAY_CONCRETE);
            fill(x + side - 1, 4, z, x + side + 1, 4, z, Blocks.BLACK_CONCRETE);
        }
        fill(x - 9, 7, z + 15, x + 9, 7, z + 18, Blocks.LIGHT_GRAY_CONCRETE);
        for (int y = 8; y <= 15; y++) fill(x, y, z + 14 + (y - 8) / 2, x, y, z + 20, Blocks.BLUE_CONCRETE);
        for (int side : new int[]{-3,3}) fill(x + side, 1, z + 2, x + side, 3, z + 4, Blocks.BLACK_CONCRETE);
        fill(x, 1, z - 14, x, 3, z - 13, Blocks.BLACK_CONCRETE);
    }

    private void buildContainer(int x, int z, net.minecraft.world.level.block.Block color) {
        fill(x, 1, z, x + 8, 1, z + 4, Blocks.IRON_BLOCK);
        fill(x, 5, z, x + 8, 5, z + 4, color);
        for (int dx = 0; dx <= 8; dx++) for (int y = 2; y <= 4; y++) {
            place(x + dx, y, z, dx % 2 == 0 ? color : Blocks.GRAY_TERRACOTTA);
            place(x + dx, y, z + 4, dx % 2 == 0 ? color : Blocks.GRAY_TERRACOTTA);
        }
        fill(x + 8, 2, z, x + 8, 4, z + 4, color);
        for (int dz : new int[]{0,4}) fill(x, 1, z + dz, x, 5, z + dz, Blocks.IRON_BLOCK);
        fill(x, 2, z + 1, x, 4, z + 3, color);
        fill(x - 1, 2, z + 1, x - 1, 4, z + 1, Blocks.IRON_BARS);
        fill(x - 1, 2, z + 3, x - 1, 4, z + 3, Blocks.IRON_BARS);
    }

    private void buildPerimeter() {
        for (int i = 0; i < 1600; i++) {
            double angle = i * Math.PI * 2 / 1600;
            int x = (int)Math.round(Math.cos(angle) * (RADIUS - 2));
            int z = (int)Math.round(Math.sin(angle) * (RADIUS - 2));
            fill(x, 1, z, x, 5, z, Blocks.IRON_BARS);
            place(x, 6, z, Blocks.CHAIN);
            if (i % 20 == 0) place(x, 7, z, Blocks.COBWEB);
            if (i % 40 == 0) {
                fill(x, 1, z, x, 6, z, Blocks.POLISHED_ANDESITE);
                place(x, 7, z, Blocks.IRON_BARS);
            }
        }
    }

    private void buildTankWreck(int x, int z) {
        for (int dx = -4; dx <= 4; dx++) for (int dz = -6; dz <= 6; dz++) place(x + dx, 1, z + dz, Blocks.GREEN_TERRACOTTA);
        for (int side : new int[] {-5, 5}) for (int dz = -6; dz <= 6; dz++) place(x + side, 1, z + dz, Blocks.BLACK_CONCRETE);
        for (int dx = -3; dx <= 3; dx++) for (int dz = -3; dz <= 3; dz++) place(x + dx, 2, z + dz, Blocks.GREEN_CONCRETE);
        for (int dz = 0; dz <= 12; dz++) place(x, 3, z - dz, Blocks.IRON_BARS);
        place(x + 2, 3, z + 1, Blocks.CAMPFIRE);
    }

    private void buildRadioTower(int x, int z) {
        for (int y = 1; y <= 25; y++) {
            int radius = Math.max(1, 5 - y / 6);
            place(x - radius, y, z - radius, Blocks.IRON_BARS);
            place(x + radius, y, z - radius, Blocks.IRON_BARS);
            place(x - radius, y, z + radius, Blocks.IRON_BARS);
            place(x + radius, y, z + radius, Blocks.IRON_BARS);
        }
        place(x, 27, z, Blocks.REDSTONE_LAMP);
    }

    private void buildCenterDepot() {
        for (int x = -11; x <= 11; x++) for (int z = -9; z <= 9; z++) {
            if (Math.abs(x) == 11 || Math.abs(z) == 9) for (int y = 1; y <= 5; y++)
                if ((x + z + y) % 11 != 0) place(x, y, z, Blocks.POLISHED_DEEPSLATE);
        }
        for (int x = -9; x <= 9; x += 6) for (int z = -7; z <= 7; z += 7) {
            place(x, 1, z, Blocks.BARREL);
            place(x, 2, z, Blocks.HAY_BLOCK);
        }
    }

    private void buildTree(int x, int z, int height) {
        int base = terrainHeight(x,z);
        for (int y = 1; y <= height; y++) place(x, base + y, z, Blocks.OAK_LOG);
        BlockState leaves = Blocks.OAK_LEAVES.defaultBlockState().setValue(LeavesBlock.PERSISTENT, true);
        for (int y = height - 1; y <= height + 2; y++) {
            int radius = y == height + 2 ? 1 : 3;
            for (int dx = -radius; dx <= radius; dx++) for (int dz = -radius; dz <= radius; dz++)
                if (dx * dx + dz * dz <= radius * radius + 1) placeState(x + dx, base + y, z + dz, leaves);
        }
    }

    private void tickSmoke() {
        decorationTick++;
        if (decorationTick % 8 != 0) return;
        int[][] smoke = { {-93, 4, 105}, {33, 4, 125} };
        for (int[] point : smoke) level.sendParticles(ParticleTypes.LARGE_SMOKE,
            point[0] + 0.5, floorY + point[1], point[2] + 0.5, 10, 0.7, 1.1, 0.7, 0.025);
    }

    private void clearAmbientMobs() {
        if (level == null) return;
        AABB bounds = new AABB(-RADIUS - 20, floorY - 20, -RADIUS - 20, RADIUS + 20, floorY + 80, RADIUS + 20);
        for (LivingEntity entity : level.getEntitiesOfClass(LivingEntity.class, bounds)) {
            if (entity instanceof Player || entity.getPersistentData().getBoolean("mng_royale_fighter")) continue;
            entity.discard();
        }
    }

    private void configure() {
        level.getGameRules().getRule(GameRules.RULE_DOMOBSPAWNING).set(false, level.getServer());
        level.getGameRules().getRule(GameRules.RULE_FALL_DAMAGE).set(false, level.getServer());
        level.getGameRules().getRule(GameRules.RULE_DAYLIGHT).set(false, level.getServer());
        level.getGameRules().getRule(GameRules.RULE_WEATHER_CYCLE).set(false, level.getServer());
        level.setDayTime(6000);
        level.setWeatherParameters(1000000, 0, false, false);
        level.setSpawnSettings(false, false);
        level.getWorldBorder().setCenter(0, 0);
        level.getWorldBorder().setSize(10000);
    }

    private void place(int x, int yOffset, int z, net.minecraft.world.level.block.Block block) {
        placeState(x, yOffset, z, block.defaultBlockState());
    }

    private void placeState(int x, int yOffset, int z, BlockState state) {
        level.setBlock(new BlockPos(x, floorY + yOffset, z), state, 2);
    }

    public static final class ArenaData extends SavedData {
        private int version;
        private int floorY;
        private int billboardVersion;
        private static ArenaData load(CompoundTag tag) {
            ArenaData data = new ArenaData();
            data.version = tag.getInt("Version");
            data.floorY = tag.getInt("FloorY");
            data.billboardVersion = tag.getInt("BillboardVersion");
            return data;
        }
        @Override public CompoundTag save(CompoundTag tag) {
            tag.putInt("Version", version);
            tag.putInt("FloorY", floorY);
            tag.putInt("BillboardVersion", billboardVersion);
            return tag;
        }
    }
}
