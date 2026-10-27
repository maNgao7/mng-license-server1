package com.tikmng.snowwar.game;

import com.mojang.authlib.GameProfile;
import com.tikmng.snowwar.SnowWar;
import com.tikmng.snowwar.client.CapacityConfigChecks;
import com.tikmng.snowwar.client.ParticipantCameraTarget;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Vec3i;
import net.minecraft.gametest.framework.GameTest;
import net.minecraft.gametest.framework.GameTestHelper;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;
import net.minecraftforge.event.server.ServerStartingEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.gametest.GameTestHolder;
import net.minecraftforge.gametest.PrefixGameTestTemplate;

import java.lang.reflect.Field;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@GameTestHolder(SnowWar.MOD_ID)
@PrefixGameTestTemplate(false)
@Mod.EventBusSubscriber(modid = SnowWar.MOD_ID)
public final class CapacityCameraGameTests {
    private static final AABB ARENA = new AABB(-210, -20, -210, 210, 120, 210);

    @SubscribeEvent
    public static void emptyQaTemplate(ServerStartingEvent event) {
        var level = event.getServer().overworld();
        level.getStructureManager().getOrCreate(new ResourceLocation(SnowWar.MOD_ID, "capacity_empty"))
            .fillFromWorld(level, new BlockPos(0, 200, 0), new Vec3i(1, 1, 1), false, Blocks.STRUCTURE_VOID);
    }

    @GameTest(template = "capacity_empty", timeoutTicks = 400)
    public static void capacityCameraAndBenchmark(GameTestHelper helper) throws Exception {
        for (int x = -6; x <= 6; x++) for (int z = -6; z <= 6; z++) helper.getLevel().setChunkForced(x, z, true);
        helper.runAfterDelay(30, () -> {
            try { runChecks(helper); }
            catch (Exception error) { throw new RuntimeException(error); }
        });
    }

    private static void runChecks(GameTestHelper helper) throws Exception {
        var level = helper.getLevel();
        var arena = new SnowWarArenaBuilder();
        var engine = new SnowWarEngine(arena);
        var host = new QaHost(level);
        CapacityConfigChecks.run(Path.of("config-checks"));

        for (int i = 0; i < 300; i++) engine.join(host, "qa_" + i, "qa_" + i, "");
        require(fighters(level).size() == 300, "300 individual joins must succeed; actual=" + fighters(level).size());
        engine.join(host, "overflow", "overflow", "");
        require(fighters(level).size() == 300 && host.capacityNotices == 1, "301st join refused gracefully");
        engine.applyAction(host, "OYUNCU", "overflow", "", Integer.MAX_VALUE);
        require(fighters(level).size() == 300 && host.capacityNotices == 1, "bounded bulk request; notice throttled");
        engine.setParticipantCapacity(50);
        require(fighters(level).size() == 300, "lowering capacity must not remove participants");
        engine.join(host, "lowered", "lowered", "");
        require(fighters(level).size() == 300, "over-cap lobby refuses new joins");
        clear(level);
        engine.setParticipantCapacity(300);
        engine.applyAction(host, "OYUNCU", "bulk", "", 300);
        require(fighters(level).size() == 300, "single 300-player batch has no hidden 100 cap");
        clear(level);
        engine.applyAction(host, "OYUNCU", "partial", "", 297);
        engine.applyAction(host, "PARASUT", "partial", "", 20);
        require(fighters(level).size() == 300, "partial batch fills only available slots");
        clear(level);
        engine.setParticipantCapacity(500);
        engine.applyAction(host, "OYUNCU", "upper", "", Integer.MAX_VALUE);
        require(fighters(level).size() == 500, "validated upper capacity is bounded");
        clear(level);
        engine.setParticipantCapacity(0);
        require(engine.participantCapacity() == 1, "server lower range clamp");
        engine.setParticipantCapacity(Integer.MAX_VALUE);
        require(engine.participantCapacity() == 500, "server upper range clamp");
        System.out.println("CAPACITY_ENGINE PASS 300joins/301refused/nooverflow/partialbatch/lower-no-delete/500bounded");

        cameraChecks(level);
        clear(level);
        set(arena, "level", level);
        set(arena, "ready", true);
        ((SnowWarState)get(engine, "state")).start();
        @SuppressWarnings("unchecked")
        var players = (List<ServerPlayer>)get(level.getServer().getPlayerList(), "players");
        players.add(host);
        try {
            double[] hundred = benchmark(level, engine, host, 100);
            double[] threeHundred = benchmark(level, engine, host, 300);
            System.out.printf(Locale.ROOT,
                "CAPACITY_BENCH 100 mean_ms=%.3f p95_ms=%.3f; 300 mean_ms=%.3f p95_ms=%.3f; ratio=%.2f; samples=80 warmup=20%n",
                hundred[0], hundred[1], threeHundred[0], threeHundred[1], threeHundred[0]/hundred[0]);
        } finally {
            players.remove(host);
            clear(level);
        }
        finalZoneAndAircraftChecks(level, engine, arena, host);
        helper.succeed();
    }

    private static void finalZoneAndAircraftChecks(ServerLevel level, SnowWarEngine engine, SnowWarArenaBuilder arena, QaHost host) throws Exception {
        var zone = (BattleZone)get(engine, "zone");
        zone.reset(level.getGameTime(),10);
        zone.x=zone.z=0;zone.radius=zone.targetRadius=BattleZone.MIN_RADIUS;
        set(engine,"battleHadRivals",true);set(engine,"tick",20L);
        var near=fighter(level,1,1,0,true);
        var far=fighter(level,10,1,0,true);
        near.getPersistentData().putString("mng_team","nearest");far.getPersistentData().putString("mng_team","farthest");
        near.setHealth(1);far.setHealth(1);
        var method=SnowWarEngine.class.getDeclaredMethod("tickZone",ServerLevel.class,List.class);
        method.setAccessible(true);method.invoke(engine,level,List.of(near,far));
        require(near.isAlive()&&!far.isAlive(),"final zone retains nearest last team instead of killing everyone in same tick");
        method.invoke(engine,level,List.of(near));
        require(near.isAlive(),"last survivor remains alive for winner countdown");
        clear(level);
        arena.showLobbyAircraft();arena.showLobbyAircraft();
        var signs=level.getEntitiesOfClass(net.minecraft.world.entity.Display.TextDisplay.class,
            new AABB(-15,arena.floorY()+70,-47,16,arena.floorY()+80,47),e->e.getTags().contains("mng_lobby_sign"));
        require(signs.size()==2,"exactly two wall signs even after rebuilding aircraft");
        require(signs.stream().allMatch(s->{var tag=new net.minecraft.nbt.CompoundTag();s.saveWithoutId(tag);return tag.getString("text").contains("BEKLEME ALANI");}),"readable wall label contents");
        require(signs.stream().anyMatch(s->s.getX()<0&&s.getYRot()==-90)&&signs.stream().anyMatch(s->s.getX()>0&&s.getYRot()==90),"wall signs face cabin interior");
        arena.hideLobbyAircraft();
        require(signs.stream().allMatch(net.minecraft.world.entity.Entity::isRemoved),"signs removed when aircraft disappears");
        System.out.println("FINAL_ZONE_AIRCRAFT PASS point-damage/last-survivor/two-signs/identity/facing/cleanup");
    }

    private static void cameraChecks(ServerLevel level) {
        Vec3 origin = new Vec3(0, 2, 0);
        Vec3 forward = new Vec3(0, 0, 1);
        var near = fighter(level, 0, 1, 10, true);
        var saved = new net.minecraft.nbt.CompoundTag();
        near.saveWithoutId(saved);
        var reloaded = SnowWar.FIGHTER.get().create(level);
        reloaded.load(saved);
        require(reloaded.isParticipant(), "participant marker survives chunk save/load");
        var far = fighter(level, 0, 1, 20, true);
        var offRay = fighter(level, 1.5, 1, 4, true);
        var decoration = fighter(level, 0, 1, 3, false);
        var audience = fighter(level, 0, 1, 4, true);
        audience.setAudience(true);
        var dead = fighter(level, 0, 1, 5, true);
        dead.setHealth(0);
        var beyondReach = fighter(level, 0, 1, 150, true);
        var candidates = List.of(far, offRay, decoration, audience, dead, beyondReach, near);
        require(ParticipantCameraTarget.pick(origin, forward, 128, candidates) == near, "nearest intersected living participant");
        require(ParticipantCameraTarget.pick(origin, forward, 8, candidates) == null, "wall occlusion");
        require(ParticipantCameraTarget.pick(origin, forward, 1000, List.of(beyondReach)) == null, "bounded reach");
        require(ParticipantCameraTarget.pick(origin, forward.scale(-1), 128, candidates) == null, "behind camera");
        require(ParticipantCameraTarget.pick(origin, forward, 128, List.of(offRay)) == null, "AABB miss is not angle selection");
        var follow = new ParticipantCameraTarget();
        require(!follow.toggle(null), "no target is a no-op");
        require(follow.toggle(near) && follow.target() == near, "E starts exact target");
        require(!follow.toggle(far), "E again exits rather than cycling");
        follow.toggle(near);
        near.setHealth(0);
        require(!follow.validate(level), "dead target exits");
        follow.toggle(far);
        far.discard();
        require(!follow.validate(level), "removed/disconnected target exits");
        follow.toggle(offRay);
        require(!follow.validate(null), "world unload exits");
        System.out.println("CAPACITY_CAMERA PASS ray/AABB/nearest/wall/alive/participant-only/audience/reach/toggle/death/removal/unload");
    }

    private static double[] benchmark(ServerLevel level, SnowWarEngine engine, QaHost host, int size) {
        clear(level);
        engine.setParticipantCapacity(500);
        engine.applyAction(host, "OYUNCU", "bench", "", size);
        int index = 0;
        for (var fighter : fighters(level)) {
            int x = (index % 20) * 8 - 76;
            int z = (index / 20) * 8 - 56;
            fighter.moveTo(x, 1, z);
            fighter.getPersistentData().putString("mng_team", "bench_" + index++);
            fighter.getPersistentData().putBoolean("mng_in_lobby", false);
            // Hold world time fixed to measure steady engine ticks without killing the fixture.
            fighter.getPersistentData().putLong("mng_last_shot", level.getGameTime());
        }
        for (int i = 0; i < 20; i++) engine.tick(level.getServer());
        double[] samples = new double[80];
        for (int i = 0; i < samples.length; i++) {
            long start = System.nanoTime();
            engine.tick(level.getServer());
            samples[i] = (System.nanoTime() - start) / 1_000_000.0;
        }
        require(fighters(level).size() == size, "benchmark fixture retains all " + size);
        double mean = Arrays.stream(samples).average().orElseThrow();
        Arrays.sort(samples);
        return new double[]{mean, samples[(int)Math.ceil(samples.length * .95) - 1]};
    }

    private static SnowFighterEntity fighter(ServerLevel level, double x, double y, double z, boolean participant) {
        var fighter = SnowWar.FIGHTER.get().create(level);
        fighter.setParticipant(participant);
        fighter.moveTo(x, y, z);
        level.addFreshEntity(fighter);
        return fighter;
    }

    private static List<SnowFighterEntity> fighters(ServerLevel level) {
        return level.getEntitiesOfClass(SnowFighterEntity.class, ARENA, SnowFighterEntity::isAlive);
    }

    private static void clear(ServerLevel level) {
        for (var fighter : new ArrayList<>(level.getEntitiesOfClass(SnowFighterEntity.class, ARENA))) fighter.discard();
    }

    private static Object get(Object owner, String name) throws Exception {
        Class<?> type = owner.getClass();
        while (type != null) {
            try { return read(type.getDeclaredField(name), owner); }
            catch (NoSuchFieldException ignored) { type = type.getSuperclass(); }
        }
        throw new NoSuchFieldException(name);
    }

    private static Object read(Field field, Object owner) throws Exception {
        field.setAccessible(true);
        return field.get(owner);
    }

    private static void set(Object owner, String name, Object value) throws Exception {
        Field field = owner.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(owner, value);
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static final class QaHost extends net.minecraftforge.common.util.FakePlayer {
        int capacityNotices;

        QaHost(ServerLevel level) {
            super(level, new GameProfile(UUID.randomUUID(), "CapacityQa"));
        }

        @Override public void displayClientMessage(Component message, boolean actionBar) {
            if (message.getString().startsWith("Katilimci kapasitesi dolu")) capacityNotices++;
        }
    }
}
