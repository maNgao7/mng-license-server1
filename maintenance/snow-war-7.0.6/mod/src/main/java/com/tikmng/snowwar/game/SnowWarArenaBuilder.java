package com.tikmng.snowwar.game;

import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.animal.goat.Goat;
import net.minecraft.world.entity.monster.Slime;
import net.minecraft.world.entity.monster.Monster;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.level.GameRules;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.LeavesBlock;
import net.minecraft.world.level.block.ChainBlock;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.saveddata.SavedData;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.border.WorldBorder;

import java.util.LinkedHashMap;
import java.util.Map;

public final class SnowWarArenaBuilder {
    private static final int RADIUS = 120;
    private static final int SIDE = RADIUS * 2 + 1;
    private static final int COLUMNS_PER_TICK = 400;
    private static final int TREE_VERSION = 6;
    private static final int EDGE_VERSION = 4;
    private static final int FENCE_RADIUS = 96;
    private static final String DECORATION_DATA = "mng_snow_arena_decorations";
    private ServerLevel level;
    private int floorY;
    private int column;
    private boolean running;
    private boolean ready;
    private DecorationData decorationData;
    private long decorationTick;

    public void startIfNeeded(ServerPlayer player) {
        ServerLevel current = player.serverLevel();
        if (level == current && (running || ready)) return;
        decorationData = current.getDataStorage().computeIfAbsent(DecorationData::load,
            DecorationData::new, DECORATION_DATA);
        // The center height may include player structures rather than the arena floor.
        Integer existingFloor = decorationData.initialized ? Integer.valueOf(decorationData.floorY) : findExistingFloor(current);
        if (existingFloor != null) {
            level = current;
            floorY = existingFloor;
            configureArena();
            migrateCentralTree();
            migrateArenaEdges();
            clearAmbientHostiles();
            ready = true;
            com.tikmng.snowwar.SnowWar.LOGGER.info("MNG_SNOW_ARENA_READY existing save");
            return;
        }
        int y = current.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, 0, 0) - 1;
        level = current;
        floorY = y;
        configureArena();
        column = 0;
        ready = false;
        running = true;
        player.teleportTo(0.5, floorY + 1.0, 0.5);
        com.tikmng.snowwar.SnowWar.LOGGER.info("MNG_SNOW_ARENA_BUILD_STARTED floorY={}", floorY);
        player.displayClientMessage(Component.literal("Kar arenasi hazirlaniyor..."), false);
    }

    private Integer findExistingFloor(ServerLevel current) {
        int[][] samples = { {RADIUS, RADIUS}, {-RADIUS, -RADIUS}, {RADIUS, -RADIUS}, {-RADIUS, RADIUS},
            {0, RADIUS}, {0, -RADIUS}, {RADIUS, 0}, {-RADIUS, 0} };
        // Multiple edge samples tolerate snow layers and structures at individual corners.
        for (int[] sample : samples) {
            int top = current.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, sample[0], sample[1]) - 1;
            for (int y = top; y >= Math.max(current.getMinBuildHeight(), top - 3); y--) {
                if (!current.getBlockState(new BlockPos(sample[0], y, sample[1])).is(Blocks.SNOW_BLOCK)) continue;
                int matches = 0;
                boolean north = false, south = false, west = false, east = false;
                for (int[] edge : samples) {
                    if (!current.getBlockState(new BlockPos(edge[0], y, edge[1])).is(Blocks.SNOW_BLOCK)) continue;
                    matches++;
                    north |= edge[1] == -RADIUS;
                    south |= edge[1] == RADIUS;
                    west |= edge[0] == -RADIUS;
                    east |= edge[0] == RADIUS;
                }
                if (matches >= 3 && north && south && west && east) return y;
            }
        }
        return null;
    }

    public void tick() {
        if (level == null) return;
        if (ready) tickDecorations();
        if (!running) return;
        int stop = Math.min(SIDE * SIDE, column + COLUMNS_PER_TICK);
        for (; column < stop; column++) {
            int x = column % SIDE - RADIUS;
            int z = column / SIDE - RADIUS;
            level.setBlock(new BlockPos(x, floorY, z), Blocks.SNOW_BLOCK.defaultBlockState(), 2);
        }
        if (column < SIDE * SIDE) return;
        decorate();
        markDecorationsCurrent();
        configureArena();
        clearAmbientHostiles();
        for (ServerPlayer player : level.players()) {
            player.displayClientMessage(Component.literal("Kar arenasi hazir! B tusuyla ayarlari ac."), false);
        }
        com.tikmng.snowwar.SnowWar.LOGGER.info("MNG_SNOW_ARENA_READY size={}x{}", SIDE, SIDE);
        running = false;
        ready = true;
    }

    public void sweep() {
        if (ready && decorationData.treeVersion < TREE_VERSION) migrateCentralTree();
        if (ready && decorationData.edgeVersion < EDGE_VERSION) migrateArenaEdges();
        if (ready) keepReindeerAtEdges();
        clearAmbientHostiles();
    }

    private void decorate() {
        int[][] trees = { {-82,-72}, {-54,91}, {-18,-94}, {36,94}, {82,-68}, {91,20}, {-91,42}, {62,63}, {-68,-25},
            {-35,73}, {12,88}, {89,-28}, {-91,-83}, {46,-75}, {-42,-90}, {70,5}, {-72,66} };
        for (int i = 0; i < trees.length; i++) buildTree(trees[i][0], trees[i][1], i);
        buildRainbowTree(0, -22);
        buildTreeScene();
        migrateArenaEdges();
        for (int offset = -96; offset <= 96; offset += 24) {
            place(offset, floorY, -98, Blocks.SEA_LANTERN.defaultBlockState());
            place(offset, floorY, 98, Blocks.SEA_LANTERN.defaultBlockState());
            place(-98, floorY, offset, Blocks.SEA_LANTERN.defaultBlockState());
            place(98, floorY, offset, Blocks.SEA_LANTERN.defaultBlockState());
        }
        spawnSnowman(-8, -14);
        spawnSnowman(9, -15);
        spawnSnowman(-16, 12);
        spawnSnowman(16, 16);
    }

    private void buildTree(int x, int z, int style) {
        int trunk = 5 + style % 3;
        for (int y = 1; y <= trunk; y++) place(x, floorY + y, z, Blocks.SPRUCE_LOG.defaultBlockState());
        var leaves = Blocks.SPRUCE_LEAVES.defaultBlockState().setValue(LeavesBlock.PERSISTENT, true);
        for (int layer = 0; layer < 6; layer++) {
            int radius = layer == 5 ? 0 : 4 - layer / 2;
            int y = floorY + trunk - 1 + layer;
            for (int dx = -radius; dx <= radius; dx++) {
                for (int dz = -radius; dz <= radius; dz++) {
                    if (Math.abs(dx) + Math.abs(dz) <= radius + 1) place(x + dx, y, z + dz, leaves);
                }
            }
        }
        place(x, floorY + trunk + 4, z, Blocks.GLOWSTONE.defaultBlockState());
        place(x + 2, floorY + trunk - 1, z, (style % 2 == 0 ? Blocks.RED_WOOL : Blocks.BLUE_WOOL).defaultBlockState());
        place(x - 2, floorY + trunk, z, Blocks.YELLOW_WOOL.defaultBlockState());
        place(x, floorY + trunk - 2, z + 2, Blocks.RED_WOOL.defaultBlockState());
        place(x, floorY + trunk - 2, z - 2, Blocks.YELLOW_WOOL.defaultBlockState());
        place(x + 1, floorY + trunk + 1, z + 2, Blocks.SEA_LANTERN.defaultBlockState());
        place(x - 2, floorY + trunk + 2, z - 1, Blocks.SHROOMLIGHT.defaultBlockState());
        place(x + 2, floorY + trunk + 3, z - 1, Blocks.GLOWSTONE.defaultBlockState());
    }

    private void buildRainbowTree(int x, int z) {
        for (var entry : centralTreeBlocks(x, z, false).entrySet()) {
            // Keep player structures and terrain that overlap the enlarged canopy.
            if (level.isEmptyBlock(entry.getKey())) level.setBlock(entry.getKey(), entry.getValue(), 2);
        }
    }

    private Map<BlockPos, BlockState> centralTreeBlocks(int x, int z, boolean legacy) {
        Map<BlockPos, BlockState> blocks = new LinkedHashMap<>();
        var leaves = Blocks.SPRUCE_LEAVES.defaultBlockState().setValue(LeavesBlock.PERSISTENT, true);
        net.minecraft.world.level.block.Block[] colors = { Blocks.RED_WOOL, Blocks.ORANGE_WOOL, Blocks.YELLOW_WOOL,
            Blocks.LIME_WOOL, Blocks.LIGHT_BLUE_WOOL, Blocks.BLUE_WOOL, Blocks.PURPLE_WOOL };
        if (legacy) {
            for (int y = 1; y <= 20; y++) blocks.put(new BlockPos(x, floorY + y, z), Blocks.SPRUCE_LOG.defaultBlockState());
            for (int layer = 0; layer < 12; layer++) {
                int radius = 10 - layer;
                int y = floorY + 5 + layer;
                for (int dx = -radius; dx <= radius; dx++) for (int dz = -radius; dz <= radius; dz++) {
                    if (Math.abs(dx) + Math.abs(dz) <= radius + 2) blocks.put(new BlockPos(x + dx, y, z + dz), leaves);
                }
                blocks.put(new BlockPos(x + radius, y + 1, z), colors[layer % colors.length].defaultBlockState());
                blocks.put(new BlockPos(x - radius, y + 1, z), colors[(layer + 3) % colors.length].defaultBlockState());
                blocks.put(new BlockPos(x, y + 1, z + radius), colors[(layer + 5) % colors.length].defaultBlockState());
            }
            blocks.put(new BlockPos(x, floorY + 21, z), Blocks.SEA_LANTERN.defaultBlockState());
            for (int y = 4; y < 20; y += 3) {
                blocks.put(new BlockPos(x + 11, floorY + y, z), Blocks.LANTERN.defaultBlockState());
                blocks.put(new BlockPos(x - 11, floorY + y, z), Blocks.LANTERN.defaultBlockState());
            }
            return blocks;
        }
        for (int y = 1; y <= 34; y++) {
            int width = y <= 14 ? 1 : 0;
            for (int dx = -width; dx <= width; dx++) for (int dz = -width; dz <= width; dz++) {
                blocks.put(new BlockPos(x + dx, floorY + y, z + dz), Blocks.SPRUCE_LOG.defaultBlockState());
            }
        }
        for (int layer = 0; layer < 30; layer++) {
            int radius = Math.max(1, 16 - layer / 2);
            int y = floorY + 6 + layer;
            for (int dx = -radius; dx <= radius; dx++) for (int dz = -radius; dz <= radius; dz++) {
                if (dx * dx + dz * dz <= radius * radius + 1) blocks.put(new BlockPos(x + dx, y, z + dz), leaves);
            }
        }
        for (int layer = 0; layer < 30; layer += 3) {
            int radius = Math.max(1, 16 - layer / 2);
            int y = floorY + 6 + layer;
            for (int ornament = 0; ornament < 8; ornament++) {
                double angle = ornament * Math.PI / 4 + layer * 0.18;
                int dx = (int)Math.round(Math.cos(angle) * radius);
                int dz = (int)Math.round(Math.sin(angle) * radius);
                blocks.put(new BlockPos(x + dx, y, z + dz), colors[(layer / 3 + ornament) % colors.length].defaultBlockState());
                blocks.put(new BlockPos(x + dx, y + 1, z + dz), Blocks.GLOWSTONE.defaultBlockState());
            }
        }
        blocks.put(new BlockPos(x, floorY + 36, z), Blocks.GOLD_BLOCK.defaultBlockState());
        blocks.put(new BlockPos(x, floorY + 37, z), Blocks.SEA_LANTERN.defaultBlockState());
        blocks.put(new BlockPos(x - 1, floorY + 37, z), Blocks.GOLD_BLOCK.defaultBlockState());
        blocks.put(new BlockPos(x + 1, floorY + 37, z), Blocks.GOLD_BLOCK.defaultBlockState());
        blocks.put(new BlockPos(x, floorY + 38, z), Blocks.GOLD_BLOCK.defaultBlockState());
        return blocks;
    }

    private void migrateCentralTree() {
        if (decorationData.treeVersion >= TREE_VERSION) return;
        AABB treeArea = new AABB(-17, floorY + 1, -39, 18, floorY + 40, -4);
        for (ServerPlayer player : level.players()) {
            if (!player.getBoundingBox().intersects(treeArea)) continue;
            // Move only players inside the replacement volume to a clear patch of arena floor.
            for (int x = 0; x <= RADIUS - 2; x += 2) {
                if (!level.getBlockState(new BlockPos(x, floorY, 2)).is(Blocks.SNOW_BLOCK)) continue;
                var destination = player.getBoundingBox().move(x + 0.5 - player.getX(),
                    floorY + 1.0 - player.getY(), 2.5 - player.getZ());
                if (!level.noCollision(player, destination)) continue;
                player.teleportTo(x + 0.5, floorY + 1.0, 2.5);
                break;
            }
            if (player.getBoundingBox().intersects(treeArea)) return;
        }
        clearLegacyTreeScene();
        for (var entry : centralTreeBlocks(0, -22, true).entrySet()) {
            if (level.getBlockState(entry.getKey()).is(entry.getValue().getBlock())) {
                level.setBlock(entry.getKey(), Blocks.AIR.defaultBlockState(), 2);
            }
        }
        buildRainbowTree(0, -22);
        buildTreeScene();
        markDecorationsCurrent();
        com.tikmng.snowwar.SnowWar.LOGGER.info("MNG_SNOW_ARENA_TREE_MIGRATED version={} height=38", TREE_VERSION);
    }

    private void markDecorationsCurrent() {
        decorationData.initialized = true;
        decorationData.floorY = floorY;
        decorationData.treeVersion = TREE_VERSION;
        decorationData.setDirty();
    }

    private void migrateArenaEdges() {
        if (decorationData.edgeVersion >= EDGE_VERSION) return;
        // Match only the old builder's exact fence and lantern coordinates/materials.
        for (int offset = -108; offset <= 108; offset++) {
            removeOldFence(offset, -112, offset % 12 == 0);
            removeOldFence(offset, 112, offset % 12 == 0);
            removeOldFence(-112, offset, offset % 12 == 0);
            removeOldFence(112, offset, offset % 12 == 0);
        }
        boolean complete = true;
        for (int offset = -FENCE_RADIUS; offset <= FENCE_RADIUS; offset++) {
            boolean lantern = offset % 12 == 0;
            complete &= buildEdgePost(offset, -FENCE_RADIUS, lantern);
            complete &= buildEdgePost(offset, FENCE_RADIUS, lantern);
            complete &= buildEdgePost(-FENCE_RADIUS, offset, lantern);
            complete &= buildEdgePost(FENCE_RADIUS, offset, lantern);
        }
        // Thin, inward-facing silhouettes sit outside the open central battle area.
        complete &= buildEdgeFigure(-60, -88, 0, 0);
        complete &= buildEdgeFigure(60, -88, 0, 0);
        complete &= buildEdgeFigure(-88, -48, 1, 1);
        complete &= buildEdgeFigure(88, -48, 1, 3);
        complete &= buildEdgeFigure(-88, 52, 2, 1);
        complete &= buildEdgeFigure(88, 52, 2, 3);
        complete &= buildEdgeFigure(-24, 88, 3, 2);
        complete &= buildEdgeFigure(24, 88, 3, 2);
        clearOldSanta(-76, -76);
        clearOldSanta(76, -76);
        clearOldSanta(-76, 76);
        clearOldSanta(76, 76);
        complete &= buildScaledSanta(-76, -76, 2);
        complete &= buildScaledSanta(76, -76, 2);
        complete &= buildScaledSanta(-76, 76, 0);
        complete &= buildScaledSanta(76, 76, 0);
        complete &= buildLightPole(-66, -66);
        complete &= buildLightPole(66, -66);
        complete &= buildLightPole(-66, 66);
        complete &= buildLightPole(66, 66);
        int giftIndex = 0;
        BlockState[] papers = { Blocks.RED_WOOL.defaultBlockState(), Blocks.BLUE_WOOL.defaultBlockState(),
            Blocks.PURPLE_WOOL.defaultBlockState(), Blocks.LIME_WOOL.defaultBlockState(),
            Blocks.PINK_WOOL.defaultBlockState(), Blocks.CYAN_WOOL.defaultBlockState() };
        for (int offset = -78; offset <= 78; offset += 26) {
            buildSmallGift(offset, -103, papers[giftIndex++ % papers.length]);
            buildSmallGift(offset, 102, papers[giftIndex++ % papers.length]);
            buildSmallGift(-103, offset, papers[giftIndex++ % papers.length]);
            buildSmallGift(102, offset, papers[giftIndex++ % papers.length]);
        }
        buildSnowPile(-58, -48);
        buildSnowPile(58, 48);
        buildSnowPile(-54, 52);
        candyCane(-20, 8);
        candyCane(22, 10);
        candyCane(3, 27);
        if (!complete) return;
        removeOldReindeer();
        for (int i = 0; i < 8; i++) {
            double angle = i * Math.PI / 4.0 + 0.28;
            spawnReindeer((int)Math.round(Math.cos(angle) * 80.0),
                (int)Math.round(Math.sin(angle) * 80.0));
        }
        decorationData.edgeVersion = EDGE_VERSION;
        decorationData.setDirty();
        com.tikmng.snowwar.SnowWar.LOGGER.info("MNG_SNOW_ARENA_EDGES_MIGRATED version={} radius={}",
            EDGE_VERSION, FENCE_RADIUS);
    }

    private void clearOldSanta(int x, int z) {
        for (int dx = -10; dx <= 10; dx++) for (int dz = -4; dz <= 4; dz++)
            for (int y = 1; y <= 24; y++) level.setBlock(new BlockPos(x + dx, floorY + y, z + dz),
                Blocks.AIR.defaultBlockState(), 2);
    }

    private void removeOldFence(int x, int z, boolean lantern) {
        BlockPos fence = new BlockPos(x, floorY + 1, z);
        BlockPos light = fence.above();
        if (lantern && level.getBlockState(light).is(Blocks.LANTERN)) {
            level.setBlock(light, Blocks.AIR.defaultBlockState(), 2);
        }
        if (level.getBlockState(fence).is(Blocks.SPRUCE_FENCE)) {
            level.setBlock(fence, Blocks.AIR.defaultBlockState(), 2);
        }
    }

    private boolean buildEdgePost(int x, int z, boolean lantern) {
        Map<BlockPos, BlockState> blocks = new LinkedHashMap<>();
        blocks.put(new BlockPos(x, floorY + 1, z), Blocks.SPRUCE_FENCE.defaultBlockState());
        if (lantern) blocks.put(new BlockPos(x, floorY + 2, z), Blocks.LANTERN.defaultBlockState());
        return placeOpenDecoration(blocks);
    }

    private boolean buildEdgeFigure(int x, int z, int style, int facing) {
        String[][] models = {
            { " www ", "wrrrw", "wr rw", "rw   ", "wr   ", "rw   ", "wr   ", "rw   ", "wr   " },
            { "  ccc  ", " ckwkc ", " cwwwc ", "  ccc  ", "cccrccc", "c cwc c", "  crc  ", " cc cc ", " cw wc " },
            { "  kkk  ", " kkkkk ", "  www  ", " wkwkw ", "  wow  ", " rrrrr ", "cwwkwwc", " wwwww ", " wwkww ", " wwwww " },
            { "   rrw ", "  rrrr ", " wwwww ", " fkfkf ", "  www  ", "wrwwwrw", " rrkrr ", " kkykk ", " rr rr ", " kk kk " }
        };
        String[] rows = models[style];
        int[] rightX = {1, 0, -1, 0};
        int[] rightZ = {0, -1, 0, 1};
        Map<BlockPos, BlockState> blocks = new LinkedHashMap<>();
        for (int row = 0; row < rows.length; row++) {
            for (int pixel = 0; pixel < rows[row].length(); pixel++) {
                char color = rows[row].charAt(pixel);
                if (color == ' ') continue;
                var block = switch (color) {
                    case 'c' -> Blocks.BROWN_TERRACOTTA;
                    case 'r' -> Blocks.RED_WOOL;
                    case 'k' -> Blocks.BLACK_WOOL;
                    case 'o' -> Blocks.ORANGE_WOOL;
                    case 'f' -> Blocks.WHITE_TERRACOTTA;
                    case 'y' -> Blocks.YELLOW_WOOL;
                    default -> Blocks.WHITE_WOOL;
                };
                int dx = pixel - rows[row].length() / 2;
                blocks.put(new BlockPos(x + dx * rightX[facing], floorY + rows.length - row,
                    z + dx * rightZ[facing]), block.defaultBlockState());
            }
        }
        return placeOpenDecoration(blocks);
    }

    private boolean placeOpenDecoration(Map<BlockPos, BlockState> blocks) {
        for (var entry : blocks.entrySet()) {
            BlockPos pos = entry.getKey();
            if (!level.getBlockState(new BlockPos(pos.getX(), floorY, pos.getZ())).is(Blocks.SNOW_BLOCK)) continue;
            if (level.isEmptyBlock(pos)
                    && level.getEntitiesOfClass(LivingEntity.class, new AABB(pos)).isEmpty()) {
                level.setBlock(pos, entry.getValue(), 2);
            }
        }
        return true;
    }

    private boolean buildScaledSanta(int x, int z, int facing) {
        Map<BlockPos, BlockState> blocks = new LinkedHashMap<>();
        // Chunky 3D Santa statue: boots, round coat, arms, beard, face and hat.
        for (int dx : new int[] {-2, 2}) for (int dz = -1; dz <= 1; dz++)
            for (int y = 1; y <= 2; y++) blocks.put(new BlockPos(x + dx, floorY + y, z + dz),
                Blocks.BLACK_WOOL.defaultBlockState());
        for (int dx = -3; dx <= 3; dx++) for (int dz = -2; dz <= 2; dz++)
            for (int y = 3; y <= 9; y++) if (Math.abs(dx) + Math.abs(dz) < 5)
                blocks.put(new BlockPos(x + dx, floorY + y, z + dz),
                    (y == 6 ? Blocks.BLACK_WOOL : Blocks.RED_WOOL).defaultBlockState());
        for (int side : new int[] {-1, 1}) for (int y = 5; y <= 8; y++)
            blocks.put(new BlockPos(x + side * 4, floorY + y, z), Blocks.RED_WOOL.defaultBlockState());
        int front = facing == 2 ? 1 : -1;
        for (int dx = -2; dx <= 2; dx++) for (int dz = -2; dz <= 2; dz++)
            for (int y = 10; y <= 13; y++) blocks.put(new BlockPos(x + dx, floorY + y, z + dz),
                (dz == front * 2 && y <= 11 ? Blocks.WHITE_WOOL : Blocks.WHITE_TERRACOTTA).defaultBlockState());
        blocks.put(new BlockPos(x - 1, floorY + 12, z + front * 3), Blocks.BLACK_CONCRETE.defaultBlockState());
        blocks.put(new BlockPos(x + 1, floorY + 12, z + front * 3), Blocks.BLACK_CONCRETE.defaultBlockState());
        for (int dx = -3; dx <= 3; dx++) for (int dz = -2; dz <= 2; dz++)
            blocks.put(new BlockPos(x + dx, floorY + 14, z + dz), Blocks.WHITE_WOOL.defaultBlockState());
        for (int y = 15; y <= 18; y++) {
            int radius = Math.max(0, 3 - (y - 15));
            for (int dx = -radius; dx <= radius; dx++) for (int dz = -radius; dz <= radius; dz++)
                blocks.put(new BlockPos(x + dx, floorY + y, z + dz), Blocks.RED_WOOL.defaultBlockState());
        }
        blocks.put(new BlockPos(x, floorY + 19, z), Blocks.WHITE_WOOL.defaultBlockState());
        return placeOpenDecoration(blocks);
    }

    private boolean buildLightPole(int x, int z) {
        Map<BlockPos, BlockState> blocks = new LinkedHashMap<>();
        for (int y = 1; y <= 10; y++) {
            blocks.put(new BlockPos(x, floorY + y, z), Blocks.POLISHED_BLACKSTONE_WALL.defaultBlockState());
        }
        blocks.put(new BlockPos(x - 1, floorY + 10, z), Blocks.DARK_OAK_FENCE.defaultBlockState());
        blocks.put(new BlockPos(x + 1, floorY + 10, z), Blocks.DARK_OAK_FENCE.defaultBlockState());
        blocks.put(new BlockPos(x, floorY + 11, z), Blocks.SEA_LANTERN.defaultBlockState());
        blocks.put(new BlockPos(x - 2, floorY + 9, z), Blocks.LANTERN.defaultBlockState());
        blocks.put(new BlockPos(x + 2, floorY + 9, z), Blocks.LANTERN.defaultBlockState());
        return placeOpenDecoration(blocks);
    }

    private void buildTreeScene() {
        buildSmallGift(-6, -17, Blocks.RED_WOOL.defaultBlockState());
        buildSmallGift(5, -17, Blocks.LIGHT_BLUE_WOOL.defaultBlockState());
        buildSmallGift(-4, -11, Blocks.PURPLE_WOOL.defaultBlockState());
        buildSmallGift(4, -10, Blocks.LIME_WOOL.defaultBlockState());
        buildSmallGift(0, -8, Blocks.YELLOW_WOOL.defaultBlockState());
        buildSmallGift(-9, -22, Blocks.PINK_WOOL.defaultBlockState());
        buildSmallGift(8, -23, Blocks.CYAN_WOOL.defaultBlockState());
        buildSkySleigh();
    }

    private void buildSkySleigh() {
        int skyY = floorY + 48;
        BlockState ropeZ = Blocks.CHAIN.defaultBlockState().setValue(ChainBlock.AXIS, Direction.Axis.Z);
        BlockState ropeX = Blocks.CHAIN.defaultBlockState().setValue(ChainBlock.AXIS, Direction.Axis.X);
        // Rounded pumpkin carriage with a covered cabin and gold ribs.
        for (int y = 0; y <= 6; y++) {
            int radiusX = (y == 0 || y == 6) ? 3 : (y == 1 || y == 5 ? 5 : 6);
            int minZ = -47 + Math.max(0, Math.abs(3 - y) - 2);
            int maxZ = -39 - Math.max(0, Math.abs(3 - y) - 2);
            for (int x = -radiusX; x <= radiusX; x++) for (int z = minZ; z <= maxZ; z++) {
                boolean shell = Math.abs(x) >= radiusX - 1 || z == minZ || z == maxZ || y == 0 || y == 6;
                if (!shell) continue;
                BlockState body = (x == 0 || x == -1 || z == -43)
                    ? Blocks.GOLD_BLOCK.defaultBlockState() : Blocks.ORANGE_TERRACOTTA.defaultBlockState();
                placeScene(x, skyY + y, z, body);
            }
        }
        for (int side : new int[] {-6, 6}) for (int y = 2; y <= 4; y++) for (int z = -45; z <= -41; z++)
            if (z == -45 || z == -41 || y == 2 || y == 4)
                placeScene(side, skyY + y, z, Blocks.GOLD_BLOCK.defaultBlockState());
        for (int side : new int[] {-6, 6}) {
            placeScene(side, skyY + 3, -43, Blocks.LIGHT_BLUE_STAINED_GLASS.defaultBlockState());
            placeScene(side, skyY + 4, -43, Blocks.LIGHT_BLUE_STAINED_GLASS.defaultBlockState());
        }
        // Four visible wheels.
        for (int side : new int[] {-6, 6}) for (int z : new int[] {-46, -40}) {
            placeScene(side, skyY, z, Blocks.BLACK_CONCRETE.defaultBlockState());
            placeScene(side, skyY + 1, z - 1, Blocks.BLACK_CONCRETE.defaultBlockState());
            placeScene(side, skyY + 1, z + 1, Blocks.BLACK_CONCRETE.defaultBlockState());
            placeScene(side, skyY + 2, z, Blocks.BLACK_CONCRETE.defaultBlockState());
            placeScene(side, skyY + 1, z, Blocks.GOLD_BLOCK.defaultBlockState());
        }
        // Seated, recognizable Santa at the front: red coat, face, beard, hat and hands on reins.
        for (int x = -2; x <= 2; x++) for (int y = 1; y <= 3; y++)
            placeScene(x, skyY + y, -39, y == 1 ? Blocks.WHITE_WOOL.defaultBlockState()
                : Blocks.RED_WOOL.defaultBlockState());
        for (int x = -1; x <= 1; x++) placeScene(x, skyY + 4, -39, Blocks.WHITE_TERRACOTTA.defaultBlockState());
        placeScene(-1, skyY + 4, -38, Blocks.BLACK_CONCRETE.defaultBlockState());
        placeScene(1, skyY + 4, -38, Blocks.BLACK_CONCRETE.defaultBlockState());
        for (int x = -2; x <= 2; x++) placeScene(x, skyY + 5, -39, Blocks.WHITE_WOOL.defaultBlockState());
        placeScene(0, skyY + 6, -39, Blocks.RED_WOOL.defaultBlockState());
        placeScene(0, skyY + 7, -39, Blocks.WHITE_WOOL.defaultBlockState());
        placeScene(-2, skyY + 2, -38, Blocks.WHITE_TERRACOTTA.defaultBlockState());
        placeScene(2, skyY + 2, -38, Blocks.WHITE_TERRACOTTA.defaultBlockState());
        // Colorful wake behind the pumpkin carriage.
        BlockState[] rainbow = { Blocks.RED_STAINED_GLASS.defaultBlockState(), Blocks.ORANGE_STAINED_GLASS.defaultBlockState(),
            Blocks.YELLOW_STAINED_GLASS.defaultBlockState(), Blocks.LIME_STAINED_GLASS.defaultBlockState(),
            Blocks.LIGHT_BLUE_STAINED_GLASS.defaultBlockState(), Blocks.PURPLE_STAINED_GLASS.defaultBlockState() };
        for (int band = 0; band < rainbow.length; band++) for (int z = -50; z >= -72; z--)
            placeScene(-5 + band * 2, skyY + 1 + (int)Math.round(Math.sin((z + band) * 0.32) * 2), z, rainbow[band]);
        for (int z = -39; z <= 10; z++) {
            placeScene(-2, skyY + 2, z, ropeZ);
            placeScene(2, skyY + 2, z, ropeZ);
        }
        for (int pair = 0; pair < 6; pair++) {
            int z = -31 + pair * 8;
            spawnTreeReindeer(-3, z, skyY);
            spawnTreeReindeer(3, z, skyY);
            for (int x = -3; x <= 3; x++) placeScene(x, skyY + 2, z, ropeX);
        }
    }

    private void buildSmallGift(int x, int z, BlockState paper) {
        placeScene(x, floorY + 1, z, paper);
        placeScene(x + 1, floorY + 1, z, Blocks.GOLD_BLOCK.defaultBlockState());
        placeScene(x, floorY + 1, z + 1, Blocks.GOLD_BLOCK.defaultBlockState());
        placeScene(x + 1, floorY + 1, z + 1, paper);
        placeScene(x, floorY + 2, z, Blocks.GOLD_BLOCK.defaultBlockState());
    }

    private void clearLegacyTreeScene() {
        for (Goat goat : level.getEntitiesOfClass(Goat.class,
                new AABB(-30, floorY, -60, 30, floorY + 80, 30),
                g -> g.getPersistentData().getBoolean("mng_tree_reindeer"))) goat.discard();
        for (int x = -10; x <= 10; x++) for (int y = floorY + 41; y <= floorY + 60; y++)
            for (int z = -52; z <= 15; z++) level.setBlock(new BlockPos(x, y, z), Blocks.AIR.defaultBlockState(), 2);
        int[][] oldGifts = { {-7,-18}, {6,-18}, {-4,-10}, {5,-9}, {0,-7} };
        for (int[] gift : oldGifts) for (int dx = 0; dx < 3; dx++) for (int dz = 0; dz < 3; dz++)
            for (int y = 1; y <= 3; y++) level.setBlock(new BlockPos(gift[0] + dx, floorY + y,
                gift[1] + dz), Blocks.AIR.defaultBlockState(), 2);
        for (int x = 7; x <= 14; x++) for (int y = 2; y <= 9; y++) for (int z = -18; z <= -13; z++)
            level.setBlock(new BlockPos(x, floorY + y, z), Blocks.AIR.defaultBlockState(), 2);
    }

    private void buildGiftBox(int x, int z, BlockState paper) {
        for (int dx = 0; dx < 3; dx++) for (int dz = 0; dz < 3; dz++) for (int y = 1; y <= 2; y++) {
            BlockState state = dx == 1 || dz == 1 ? Blocks.GOLD_BLOCK.defaultBlockState() : paper;
            placeScene(x + dx, floorY + y, z + dz, state);
        }
        placeScene(x + 1, floorY + 3, z + 1, Blocks.GOLD_BLOCK.defaultBlockState());
    }

    private void buildSnowPile(int x, int z) {
        for (int layer = 0; layer < 4; layer++) {
            int radius = 4 - layer;
            for (int dx = -radius; dx <= radius; dx++) for (int dz = -radius; dz <= radius; dz++) {
                if (Math.abs(dx) + Math.abs(dz) <= radius + 1)
                    placeScene(x + dx, floorY + 1 + layer, z + dz, Blocks.SNOW_BLOCK.defaultBlockState());
            }
        }
    }

    private void placeScene(int x, int y, int z, BlockState state) {
        BlockPos pos = new BlockPos(x, y, z);
        if (level.isEmptyBlock(pos)) level.setBlock(pos, state, 2);
    }

    private void tickDecorations() {
        decorationTick++;
        if (decorationTick % 10 != 0) return;
        int phase = (int)(decorationTick / 10);
        for (Goat deer : level.getEntitiesOfClass(Goat.class,
                new AABB(-20, floorY + 35, -82, 20, floorY + 70, 24),
                goat -> goat.getPersistentData().getBoolean("mng_tree_reindeer"))) {
            double step = ((phase + deer.getId()) & 1) == 0 ? 0.035 : -0.035;
            deer.setDeltaMovement(step, 0, 0);
            deer.hurtMarked = true;
        }
        for (int layer = 0; layer < 30; layer += 3) {
            int radius = Math.max(1, 16 - layer / 2);
            int y = floorY + 7 + layer;
            for (int ornament = 0; ornament < 8; ornament++) {
                double angle = ornament * Math.PI / 4 + layer * 0.18;
                int dx = (int)Math.round(Math.cos(angle) * radius);
                int dz = (int)Math.round(Math.sin(angle) * radius);
                BlockPos pos = new BlockPos(dx, y, -22 + dz);
                BlockState current = level.getBlockState(pos);
                if (!current.is(Blocks.GLOWSTONE) && !current.is(Blocks.SEA_LANTERN)
                        && !current.is(Blocks.REDSTONE_LAMP) && !current.is(Blocks.SHROOMLIGHT)) continue;
                int light = Math.floorMod(phase + ornament + layer / 3, 4);
                BlockState next = switch (light) {
                    case 0 -> Blocks.GLOWSTONE.defaultBlockState();
                    case 1 -> Blocks.SEA_LANTERN.defaultBlockState();
                    case 2 -> Blocks.SHROOMLIGHT.defaultBlockState();
                    default -> Blocks.REDSTONE_LAMP.defaultBlockState();
                };
                level.setBlock(pos, next, 2);
            }
        }
        int[][] trees = { {-82,-72}, {-54,91}, {-18,-94}, {36,94}, {82,-68}, {91,20}, {-91,42},
            {62,63}, {-68,-25}, {-35,73}, {12,88}, {89,-28}, {-91,-83}, {46,-75}, {-42,-90}, {70,5}, {-72,66} };
        BlockState[] lights = { Blocks.GLOWSTONE.defaultBlockState(), Blocks.SEA_LANTERN.defaultBlockState(),
            Blocks.SHROOMLIGHT.defaultBlockState(), Blocks.REDSTONE_LAMP.defaultBlockState() };
        for (int i = 0; i < trees.length; i++) {
            int trunk = 5 + i % 3;
            int[][] points = { {1, trunk + 1, 2}, {-2, trunk + 2, -1}, {2, trunk + 3, -1} };
            for (int p = 0; p < points.length; p++) {
                BlockPos pos = new BlockPos(trees[i][0] + points[p][0], floorY + points[p][1], trees[i][1] + points[p][2]);
                if (!level.isEmptyBlock(pos)) level.setBlock(pos, lights[Math.floorMod(phase + i + p, lights.length)], 2);
            }
        }
    }

    private boolean placeEdgeDecoration(Map<BlockPos, BlockState> blocks) {
        // Preflight the whole model so trees/player builds and occupied spaces survive retries.
        for (var entry : blocks.entrySet()) {
            BlockPos pos = entry.getKey();
            if (!level.getBlockState(new BlockPos(pos.getX(), floorY, pos.getZ())).is(Blocks.SNOW_BLOCK)) return false;
            BlockState current = level.getBlockState(pos);
            if (current.is(entry.getValue().getBlock())) continue;
            if (!current.isAir() || !level.getEntitiesOfClass(LivingEntity.class, new AABB(pos)).isEmpty()) return false;
        }
        for (var entry : blocks.entrySet()) {
            if (level.isEmptyBlock(entry.getKey())) level.setBlock(entry.getKey(), entry.getValue(), 2);
        }
        return true;
    }

    private static final class DecorationData extends SavedData {
        private boolean initialized;
        private int floorY;
        private int treeVersion;
        private int edgeVersion;

        private static DecorationData load(CompoundTag tag) {
            DecorationData data = new DecorationData();
            data.initialized = tag.getBoolean("Initialized");
            data.floorY = tag.getInt("FloorY");
            data.treeVersion = tag.getInt("TreeVersion");
            data.edgeVersion = tag.getInt("EdgeVersion");
            return data;
        }

        @Override
        public CompoundTag save(CompoundTag tag) {
            tag.putBoolean("Initialized", initialized);
            tag.putInt("FloorY", floorY);
            tag.putInt("TreeVersion", treeVersion);
            tag.putInt("EdgeVersion", edgeVersion);
            return tag;
        }
    }

    private void fencePost(int x, int z) {
        place(x, floorY + 1, z, Blocks.SPRUCE_FENCE.defaultBlockState());
        place(x, floorY + 2, z, Blocks.LANTERN.defaultBlockState());
    }

    private void spawnSnowman(int x, int z) {
        place(x, floorY + 1, z, Blocks.SNOW_BLOCK.defaultBlockState());
        place(x, floorY + 2, z, Blocks.SNOW_BLOCK.defaultBlockState());
        place(x, floorY + 3, z, Blocks.CARVED_PUMPKIN.defaultBlockState());
        place(x + 1, floorY + 2, z, Blocks.SPRUCE_FENCE.defaultBlockState());
        place(x - 1, floorY + 2, z, Blocks.SPRUCE_FENCE.defaultBlockState());
    }

    private void clearAmbientHostiles() {
        if (level == null) return;
        for (LivingEntity entity : level.getEntitiesOfClass(LivingEntity.class,
                new AABB(-RADIUS - 40, floorY - 40, -RADIUS - 40, RADIUS + 40, floorY + 100, RADIUS + 40))) {
            if (entity instanceof Player || entity.getPersistentData().getBoolean("mng_snow_fighter")
                    || entity.getPersistentData().getBoolean("mng_snow_boss")) continue;
            if (entity instanceof Goat && (entity.getPersistentData().getBoolean("mng_reindeer")
                    || entity.getPersistentData().getBoolean("mng_tree_reindeer")
                    || "Ren geyigi".equals(entity.getName().getString()))) {
                entity.setSilent(true);
                continue;
            }
            entity.discard();
        }
    }

    private void configureArena() {
        WorldBorder border = level.getWorldBorder();
        border.setCenter(0.0, 0.0);
        border.setSize(10000.0);
        level.getGameRules().getRule(GameRules.RULE_DOMOBSPAWNING).set(false, level.getServer());
        level.getGameRules().getRule(GameRules.RULE_FALL_DAMAGE).set(false, level.getServer());
        level.setWeatherParameters(1000000, 0, false, false);
        level.setSpawnSettings(false, false);
        level.getGameRules().getRule(GameRules.RULE_DAYLIGHT).set(false, level.getServer());
    }

    private void candyCane(int x, int z) {
        for (int y = 1; y <= 4; y++) {
            place(x, floorY + y, z, (y % 2 == 0 ? Blocks.RED_WOOL : Blocks.WHITE_WOOL).defaultBlockState());
        }
        place(x, floorY + 5, z, Blocks.LANTERN.defaultBlockState());
    }

    private void spawnReindeer(int x, int z) {
        AABB nearby = new AABB(x - 3, floorY, z - 3, x + 4, floorY + 5, z + 4);
        if (!level.getEntitiesOfClass(Goat.class, nearby,
                goat -> goat.getPersistentData().getBoolean("mng_reindeer")).isEmpty()) return;
        Goat deer = EntityType.GOAT.create(level);
        if (deer == null) return;
        deer.moveTo(x + 0.5, floorY + 1.0, z + 0.5, 0.0F, 0.0F);
        deer.setNoAi(false);
        deer.setSilent(true);
        deer.setInvulnerable(true);
        deer.setPersistenceRequired();
        deer.getPersistentData().putBoolean("mng_reindeer", true);
        deer.setCustomName(Component.literal("Ren geyigi"));
        deer.setCustomNameVisible(false);
        level.addFreshEntity(deer);
    }

    private void spawnTreeReindeer(int x, int z) {
        spawnTreeReindeer(x, z, floorY + 3);
    }

    private void spawnTreeReindeer(int x, int z, int y) {
        AABB nearby = new AABB(x - 2, y - 2, z - 2, x + 3, y + 3, z + 3);
        if (!level.getEntitiesOfClass(Goat.class, nearby,
                goat -> goat.getPersistentData().getBoolean("mng_tree_reindeer")).isEmpty()) return;
        Goat deer = EntityType.GOAT.create(level);
        if (deer == null) return;
        deer.moveTo(x + 0.5, y, z + 0.5, 180.0F, 0.0F);
        deer.setNoAi(true);
        deer.setNoGravity(y > floorY + 10);
        deer.setSilent(true);
        deer.setInvulnerable(true);
        deer.setPersistenceRequired();
        deer.getPersistentData().putBoolean("mng_tree_reindeer", true);
        deer.setCustomName(Component.literal("Noel Baba'nin Ren Geyigi"));
        deer.setCustomNameVisible(false);
        level.addFreshEntity(deer);
    }

    private void removeOldReindeer() {
        for (Goat goat : level.getEntitiesOfClass(Goat.class,
                new AABB(-RADIUS, floorY, -RADIUS, RADIUS, floorY + 30, RADIUS))) {
            if (goat.getPersistentData().getBoolean("mng_tree_reindeer")) continue;
            if (goat.getPersistentData().getBoolean("mng_reindeer")
                    || "Ren geyigi".equals(goat.getName().getString())) goat.discard();
        }
    }

    private void keepReindeerAtEdges() {
        int index = 0;
        for (Goat deer : level.getEntitiesOfClass(Goat.class,
                new AABB(-RADIUS, floorY - 4, -RADIUS, RADIUS, floorY + 30, RADIUS),
                goat -> goat.getPersistentData().getBoolean("mng_reindeer"))) {
            deer.setSilent(true);
            double radius = Math.sqrt(deer.getX() * deer.getX() + deer.getZ() * deer.getZ());
            if (radius >= 62.0 && radius <= 91.0) continue;
            double angle = index++ * Math.PI / 4.0 + deer.getUUID().hashCode() * 0.0001;
            deer.teleportTo(Math.cos(angle) * 79.0, floorY + 1.0, Math.sin(angle) * 79.0);
        }
    }

    public void removeArenaSlimes() { clearAmbientHostiles(); }

    private void place(int x, int y, int z, net.minecraft.world.level.block.state.BlockState state) {
        level.setBlock(new BlockPos(x, y, z), state, 2);
    }

    public static void leaveSnowTracks(ServerPlayer player) {
        if (player.tickCount % 4 != 0 || player.getDeltaMovement().horizontalDistanceSqr() < 0.012) return;
        ServerLevel level = player.serverLevel();
        if (!level.getBlockState(player.blockPosition().below()).is(Blocks.SNOW_BLOCK)) return;
        double backX = Math.sin(Math.toRadians(player.getYRot())) * -0.32;
        double backZ = Math.cos(Math.toRadians(player.getYRot())) * 0.32;
        level.sendParticles(ParticleTypes.SNOWFLAKE, player.getX() + backX - 0.12, player.getY() + 0.04, player.getZ() + backZ,
            2, 0.035, 0.01, 0.035, 0.002);
        level.sendParticles(ParticleTypes.SNOWFLAKE, player.getX() + backX + 0.12, player.getY() + 0.04, player.getZ() + backZ,
            2, 0.035, 0.01, 0.035, 0.002);
    }
}
