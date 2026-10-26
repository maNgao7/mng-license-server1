package com.tikmng.snake;

import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.event.entity.player.PlayerEvent;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.FenceBlock;
import net.minecraft.world.level.block.LeavesBlock;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.GameRules;
import net.minecraft.world.level.GameType;

@Mod(SnakeMod.ID)
public final class SnakeMod {
    public static final String ID="tikmng_snake_arena";
    public static final String WORLD="tikmng_snake_arena_prototype";
    private static int builtSize;
    private static int requestedSize=96, column=-1;
    private static int previousSize;
    static volatile double buildProgress;
    private static ServerLevel arena;
    static volatile boolean ready;
    public SnakeMod(){MinecraftForge.EVENT_BUS.register(this);}
    public static void requestResize(int size){previousSize=requestedSize;ready=false;buildProgress=0;requestedSize=Math.max(32,Math.min(1000,size));column=0;builtSize=Math.max(builtSize,requestedSize);}
    @SubscribeEvent public void join(PlayerEvent.PlayerLoggedInEvent event){
        if(!(event.getEntity() instanceof ServerPlayer player)||!player.getServer().getWorldData().getLevelName().equals("TikMnG Snake Arena"))return;
        arena=player.serverLevel();player.setGameMode(GameType.SPECTATOR);player.teleportTo(.5,ArenaSpace.SURFACE_Y+8,.5);
        builtSize=Math.max(builtSize,Math.min(1000,player.getPersistentData().getInt("tikmng_snake_built_size")));
        requestedSize=Math.max(32,player.getPersistentData().getInt("tikmng_snake_active_size"));
        arena.getGameRules().getRule(GameRules.RULE_DAYLIGHT).set(false,player.getServer());
        arena.getGameRules().getRule(GameRules.RULE_WEATHER_CYCLE).set(false,player.getServer());
        arena.getGameRules().getRule(GameRules.RULE_DOMOBSPAWNING).set(false,player.getServer());
        arena.setDayTime(6000);arena.setWeatherParameters(6000,0,false,false);
        int size=SnakeConfig.load().arenaSize;
        if(player.getPersistentData().getInt("tikmng_snake_landscape_version")==ArenaLandscape.VERSION&&player.getPersistentData().getInt("tikmng_snake_active_size")==size){
            requestedSize=size;column=-1;ready=true;buildProgress=1;System.out.println("MNG_SNAKE_ARENA_READY size="+size+" cached=true");
        }else requestResize(size);
    }
    @SubscribeEvent public void tick(TickEvent.ServerTickEvent event){
        if(event.phase!=TickEvent.Phase.END||arena==null||arena.getServer()!=event.getServer()||column<0)return;
        int outer=builtSize/2+ArenaLandscape.MARGIN,half=requestedSize/2;
        long started=System.nanoTime();
        for(int work=0;work<4&&column<=outer*2;work++,column++){
            int x=column-outer;
            for(int z=-outer;z<=outer;z++){
                double distance=Math.hypot(x,z);
                boolean newRing=distance>=half-3&&distance<=half+ArenaLandscape.MARGIN;
                boolean oldRing=distance>=previousSize/2.0-3&&distance<=previousSize/2.0+ArenaLandscape.MARGIN;
                if(!newRing&&!oldRing&&!(x==0&&z==0))continue;
                boolean inside=ArenaLandscape.inside(x,z,half);
                boolean edge=ArenaLandscape.fence(x,z,half),tower=ArenaLandscape.tower(x,z,half);
                // Restore the old sky platform to air without touching other worlds.
                if(Math.abs(x)<=builtSize/2+2&&Math.abs(z)<=builtSize/2+2)for(int oldY=63;oldY<=65;oldY++)place(x,oldY,z,Blocks.AIR.defaultBlockState());
                int height=inside||tower?0:ArenaLandscape.height(x,z,half);
                var surface=ArenaLandscape.surface(x,z,half);
                var floor=edge||tower?Blocks.STONE_BRICKS:surface==ArenaLandscape.Surface.ACCENT?towerAccent(x,z):landscapeFloor(surface);
                if(surface==ArenaLandscape.Surface.WATER)place(x,ArenaSpace.FLOOR_Y-1,z,Blocks.CLAY.defaultBlockState());
                place(x,ArenaSpace.FLOOR_Y,z,(height>0?Blocks.DIRT:floor).defaultBlockState());
                var fence=Blocks.OAK_FENCE.defaultBlockState()
                    .setValue(FenceBlock.NORTH,ArenaLandscape.fence(x,z-1,half)||ArenaLandscape.tower(x,z-1,half))
                    .setValue(FenceBlock.SOUTH,ArenaLandscape.fence(x,z+1,half)||ArenaLandscape.tower(x,z+1,half))
                    .setValue(FenceBlock.EAST,ArenaLandscape.fence(x+1,z,half)||ArenaLandscape.tower(x+1,z,half))
                    .setValue(FenceBlock.WEST,ArenaLandscape.fence(x-1,z,half)||ArenaLandscape.tower(x-1,z,half));
                var tree=inside?null:ArenaLandscape.tree(x,z,half);
                boolean cherry=tree!=null&&!tree.birch()&&Math.floorMod(tree.x()+tree.z(),5)==0;
                boolean post=ArenaLandscape.post(x,z,half);
                int rock=inside?0:ArenaLandscape.rockHeight(x,z,half);
                var detail=ArenaLandscape.detail(x,z,half);
                for(int y=0;y<ArenaLandscape.BUILD_HEIGHT;y++){
                    BlockState state=Blocks.AIR.defaultBlockState();
                    if(y<height)state=(y==height-1?floor:Blocks.DIRT).defaultBlockState();
                    if(edge&&y<4)state=fence;
                    if(post&&y<6)state=(y==0||y==5?Blocks.STONE_BRICKS:Blocks.STRIPPED_OAK_LOG).defaultBlockState();
                    if(post&&y==6)state=Blocks.LANTERN.defaultBlockState();
                    if(tower&&y<8)state=(y==7?Blocks.POLISHED_ANDESITE:y==5||y==6?towerAccent(x,z):Blocks.STONE_BRICKS).defaultBlockState();
                    if(tower&&y==8&&(Math.abs(x)==half&&z==0||x==0&&Math.abs(z)==half))state=Blocks.LANTERN.defaultBlockState();
                    if(y>=height&&y<height+rock)state=(Math.floorMod(x*3+z,5)==0?Blocks.MOSSY_COBBLESTONE:Blocks.ANDESITE).defaultBlockState();
                    if(tree!=null){
                        int dx=x-tree.x(),dz=z-tree.z(),relative=y-tree.ground(),crown=relative-tree.height();
                        int radius=tree.radius()-Math.max(0,crown-1);
                        if(crown>=-2&&crown<=3&&dx*dx+dz*dz<=radius*radius&&y>=height)state=(tree.birch()?Blocks.BIRCH_LEAVES:cherry?Blocks.CHERRY_LEAVES:Blocks.OAK_LEAVES).defaultBlockState().setValue(LeavesBlock.PERSISTENT,true);
                        if(dx==0&&dz==0&&relative>=0&&relative<=tree.height())state=(tree.birch()?Blocks.BIRCH_LOG:cherry?Blocks.CHERRY_LOG:Blocks.OAK_LOG).defaultBlockState();
                    }
                    if(y==height&&state.isAir())state=landscapeDetail(detail,x,z);
                    place(x,ArenaSpace.SURFACE_Y+y,z,state);
                }
            }
            buildProgress=Math.min(1,(column+1)/(double)(outer*2+1));
            if(System.nanoTime()-started>4_000_000){column++;break;}
        }
        if(column>outer*2){
            column=-1;ready=true;buildProgress=1;for(var player:arena.players()){
                var data=player.getPersistentData();data.putInt("tikmng_snake_built_size",builtSize);data.putInt("tikmng_snake_active_size",requestedSize);data.putInt("tikmng_snake_landscape_version",ArenaLandscape.VERSION);
            }
            System.out.println("MNG_SNAKE_ARENA_READY size="+requestedSize);
        }
    }
    private static net.minecraft.world.level.block.Block landscapeFloor(ArenaLandscape.Surface surface){
        return switch(surface){
            case CURB -> Blocks.POLISHED_ANDESITE;
            case GRAVEL -> Blocks.GRAVEL;
            case PAVING -> Blocks.STONE_BRICKS;
            case PODZOL -> Blocks.PODZOL;
            case COARSE_DIRT -> Blocks.COARSE_DIRT;
            case SAND -> Blocks.SAND;
            case WATER -> Blocks.WATER;
            default -> Blocks.GRASS_BLOCK;
        };
    }
    private static BlockState landscapeDetail(ArenaLandscape.Detail detail,int x,int z){
        if(detail==ArenaLandscape.Detail.POPPY||detail==ArenaLandscape.Detail.DANDELION||detail==ArenaLandscape.Detail.BLUE_ORCHID){
            var flowers=new net.minecraft.world.level.block.Block[]{Blocks.POPPY,Blocks.ALLIUM,Blocks.PINK_TULIP,Blocks.ORANGE_TULIP,Blocks.AZURE_BLUET,Blocks.CORNFLOWER,Blocks.DANDELION,Blocks.OXEYE_DAISY};
            return flowers[Math.floorMod(Math.floorDiv(x,7)*31+Math.floorDiv(z,7)*17,flowers.length)].defaultBlockState();
        }
        return switch(detail){
            case GRASS -> Blocks.GRASS.defaultBlockState();
            case FERN -> Blocks.FERN.defaultBlockState();
            case POPPY -> Blocks.POPPY.defaultBlockState();
            case DANDELION -> Blocks.DANDELION.defaultBlockState();
            case BLUE_ORCHID -> Blocks.BLUE_ORCHID.defaultBlockState();
            default -> Blocks.AIR.defaultBlockState();
        };
    }
    private static net.minecraft.world.level.block.Block towerAccent(int x,int z){
        return Math.abs(x)>Math.abs(z)?x>0?Blocks.CYAN_TERRACOTTA:Blocks.RED_TERRACOTTA
            :z>0?Blocks.YELLOW_TERRACOTTA:Blocks.GREEN_TERRACOTTA;
    }
    private static void place(int x,int y,int z,BlockState state){var pos=new BlockPos(x,y,z);if(arena.getBlockState(pos)!=state)arena.setBlock(pos,state,2);}
}
