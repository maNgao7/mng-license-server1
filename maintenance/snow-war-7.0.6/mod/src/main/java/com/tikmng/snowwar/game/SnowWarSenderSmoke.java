package com.tikmng.snowwar.game;

import com.tikmng.snowwar.SnowWar;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.level.levelgen.Heightmap;

/** Opt-in native sender/combat check; never runs in a normal game. */
@net.minecraftforge.fml.common.Mod.EventBusSubscriber(modid=SnowWar.MOD_ID,value=net.minecraftforge.api.distmarker.Dist.CLIENT)
public final class SnowWarSenderSmoke {
    private final boolean enabled=Boolean.getBoolean("mng.snowwar.senderSmoke");
    private boolean done;
    private long started=-1,shots;
    private ViewerFighter alpha,beta;
    private float hostHealth;

    @net.minecraftforge.eventbus.api.SubscribeEvent
    public static void prepareClient(net.minecraftforge.event.TickEvent.ClientTickEvent event) {
        if(!Boolean.getBoolean("mng.snowwar.senderSmoke"))return;
        var client=net.minecraft.client.Minecraft.getInstance();
        if(client.options!=null)client.options.pauseOnLostFocus=false;
    }

    public void tick(MinecraftServer server,SnowWarEngine engine) {
        if(!enabled||done||server.getTickCount()<300)return;
        ServerPlayer host=server.getPlayerList().getPlayers().stream().findFirst().orElse(null);
        if(host==null)return;
        try {
            if(started<0) {
                engine.resetSession(host);
                for(int i=0;i<4;i++)engine.applyAction(host,"OYUNCU_1","SenderAlpha","",100);
                engine.applyAction(host,"OYUNCU_1","SenderBeta","",1);
                long first=engine.state().fighters().stream().filter(f->f.displayName().equals("SenderAlpha")).count();
                long second=engine.state().fighters().stream().filter(f->f.displayName().equals("SenderBeta")).count();
                require(first==400&&second==1,"gift identities or quantities merged");
                for(var fighter:engine.state().fighters()) {
                    var entity=host.serverLevel().getEntity(fighter.entityId());
                    require(entity!=null&&Math.abs(entity.getX())<=91&&Math.abs(entity.getZ())<=91,"gift wave spawned outside arena");
                }
                engine.resetSession(host);
                alpha=engine.join(host,"sender-alpha","SenderAlpha","");
                beta=engine.join(host,"sender-beta","SenderBeta","");
                move(host,alpha,-8,0);move(host,beta,8,0);
                int y=host.serverLevel().getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES,0,18);
                host.teleportTo(.5,y,18.5);host.setHealth(host.getMaxHealth());hostHealth=host.getHealth();
                shots=engine.snowballsThrown();engine.start(host);started=server.getTickCount();return;
            }
            if(server.getTickCount()-started<440)return;
            var a=host.serverLevel().getEntity(alpha.entityId());
            var b=host.serverLevel().getEntity(beta.entityId());
            require(engine.snowballsThrown()>shots,"rivals did not throw snowballs");
            require(a==null||b==null||((LivingEntity)a).getHealth()<alpha.maxHealth()||((LivingEntity)b).getHealth()<beta.maxHealth(),"rivals did not damage each other");
            require(host.getHealth()==hostHealth,"broadcaster took combat damage");
            SnowWar.LOGGER.info("MNG_SENDER_SMOKE_RESULT passed=true alpha400=true beta1=true boundedWave=true rivalShots=true rivalDamage=true broadcasterSafe=true");
            finish(host,engine);
        } catch(Exception error) {
            SnowWar.LOGGER.error("MNG_SENDER_SMOKE_RESULT passed=false reason={}",error.getMessage());
            finish(host,engine);
        }
    }
    private static void move(ServerPlayer host,ViewerFighter fighter,int x,int z) {
        var entity=host.serverLevel().getEntity(fighter.entityId());
        int y=host.serverLevel().getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES,x,z);
        entity.teleportTo(x+.5,y,z+.5);
    }
    private void finish(ServerPlayer host,SnowWarEngine engine) {
        done=true;engine.resetSession(host);
        net.minecraft.client.Minecraft.getInstance().execute(()->net.minecraft.client.Minecraft.getInstance().stop());
    }
    private static void require(boolean value,String reason) {
        if(!value)throw new IllegalStateException(reason);
    }
}
