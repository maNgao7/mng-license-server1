package com.tikmng.snake;

import net.minecraft.client.Minecraft;
import net.minecraft.client.CameraType;
import net.minecraft.world.entity.decoration.ArmorStand;

final class SnakeCamera {
    static boolean free;
    private static ArmorStand overview;
    private static double zoom=1,previousZoom=1,targetZoom=1;
    private static boolean rightZoom;
    private static String followId="";
    private static double orbit,followDistance=1;
    private static boolean snap;
    private static int viewportWidth,viewportHeight;
    static void tick(){
        Minecraft mc=Minecraft.getInstance();if(mc.player==null||mc.level==null)return;
        int width=mc.getWindow().getGuiScaledWidth(),height=mc.getWindow().getGuiScaledHeight();
        if(viewportWidth!=width||viewportHeight!=height){
            viewportWidth=width;viewportHeight=height;
            if(!free&&!following()){SnakeClient.fitCamera();snap=true;}
        }
        mc.options.bobView().set(false);mc.options.setCameraType(CameraType.FIRST_PERSON);
        mc.options.cloudStatus().set(net.minecraft.client.CloudStatus.OFF);
        int chunks=SnakeClient.CONFIG.arenaSize>160?32:SnakeClient.CONFIG.arenaSize>=128?16:12;
        if(mc.options.renderDistance().get()<chunks)mc.options.renderDistance().set(chunks);
        if(!mc.isWindowActive()||SnakePlayer.watchingSelf())rightZoom=false;
        if(!followId.isEmpty()&&!SnakeClient.ENGINE.snakes.containsKey(followId))removed(followId);
        previousZoom=zoom;zoom+=((rightZoom?Math.min(.42,targetZoom):targetZoom)-zoom)*.3;
        if(free){
            mc.setCameraEntity(mc.player);
            mc.player.getAbilities().flying=true;mc.player.getAbilities().setFlyingSpeed(.18f);
            if(mc.screen!=null)mc.player.setDeltaMovement(net.minecraft.world.phys.Vec3.ZERO);
            return;
        }
        if(overview==null||overview.level()!=mc.level){overview=new ArmorStand(mc.level,SnakeClient.cameraX,SnakeClient.cameraHeight,SnakeClient.cameraZ);overview.setInvisible(true);overview.setNoGravity(true);snap=true;}
        overview.xo=overview.xOld=overview.getX();overview.yo=overview.yOld=overview.getY();overview.zo=overview.zOld=overview.getZ();
        overview.yRotO=overview.getYRot();overview.xRotO=overview.getXRot();
        var target=followed();
        if(target!=null){
            var displayed=SnakeClient.ENGINE.displayHead(target);
            var view=ArenaSpace.closeView(displayed.x,displayed.z,displayed.angle,displayed.radius(),orbit,followDistance);
            var path=displayed.body();double lift=path.isEmpty()?0:ArenaWeave.plan(path,displayed.radius()).height(0);
            double blend=snap?1:.3;
            overview.setPos(overview.getX()+(view.x()-overview.getX())*blend,overview.getY()+(view.y()+lift-overview.getY())*blend,overview.getZ()+(view.z()-overview.getZ())*blend);
            float yaw=overview.getYRot();double difference=Math.atan2(Math.sin(Math.toRadians(view.yaw()-yaw)),Math.cos(Math.toRadians(view.yaw()-yaw)));
            overview.setYRot(yaw+(float)Math.toDegrees(difference*blend));overview.setXRot(overview.getXRot()+(view.pitch()-overview.getXRot())*(float)blend);
        }else{overview.setPos(SnakeClient.cameraX,SnakeClient.cameraHeight,SnakeClient.cameraZ);overview.setYRot(0);overview.setXRot(90);}
        if(snap){overview.xo=overview.xOld=overview.getX();overview.yo=overview.yOld=overview.getY();overview.zo=overview.zOld=overview.getZ();overview.yRotO=overview.getYRot();overview.xRotO=overview.getXRot();snap=false;}
        // LivingEntity cameras read head yaw, not the body's yaw.
        overview.yHeadRot=overview.getYRot();overview.yHeadRotO=overview.yRotO;
        mc.setCameraEntity(overview);
    }
    static void fly(){
        Minecraft mc=Minecraft.getInstance();if(mc.player==null)return;
        if(!free){
            if(overview!=null&&following())position(overview.getX(),overview.getY(),overview.getZ(),overview.getYRot(),overview.getXRot());
            else if(overview!=null){
                double offset=SnakeClient.CONFIG.arenaSize*.24;
                var view=ArenaSpace.lookAt(offset,ArenaSpace.SURFACE_Y+18,-offset,0,ArenaSpace.SURFACE_Y+3,0);
                position(view.x(),view.y(),view.z(),view.yaw(),view.pitch());
            }
            else position(SnakeClient.cameraX,SnakeClient.cameraHeight,SnakeClient.cameraZ,0,82);
        }
        SnakeLabels.clear();
        free=true;mc.setCameraEntity(mc.player);mc.setScreen(null);mc.mouseHandler.grabMouse();
    }
    static void top(){
        free=false;followId="";snap=true;rightZoom=false;zoom=previousZoom=targetZoom=1;SnakeLabels.clear();
        // The integrated server streams chunks around the player, not our overview entity.
        position(0,ArenaSpace.SURFACE_Y+8,0,0,90);
        SnakeClient.fitCamera();tick();Minecraft.getInstance().setScreen(new SnakeScreens.Arena());
    }
    static boolean following(){return !free&&!followId.isEmpty();}
    static ArenaEngine.Snake followed(){return SnakeClient.ENGINE.snakes.get(followId);}
    static void removed(String id){
        if(!followId.equals(id))return;
        var fallback=free?null:SnakeClient.ENGINE.snakes.values().stream().max(java.util.Comparator.comparingDouble((ArenaEngine.Snake s)->s.mass).thenComparing(s->s.id)).orElse(null);
        followId=fallback==null?"":fallback.id;orbit=0;followDistance=1;rightZoom=false;zoom=previousZoom=targetZoom=1;snap=true;
        if(!free&&fallback==null)SnakeClient.fitCamera();
        SnakeLabels.clear();
    }
    static void watch(String id){
        if(!SnakeClient.ENGINE.snakes.containsKey(id))return;
        followId=id;free=false;orbit=0;followDistance=1;rightZoom=false;zoom=previousZoom=targetZoom=1;snap=true;SnakeLabels.clear();tick();
        Minecraft.getInstance().setScreen(new SnakeScreens.Arena());
    }
    static void watchNext(){
        var choices=SnakeClient.ENGINE.snakes.values().stream().sorted(java.util.Comparator.comparingDouble((ArenaEngine.Snake s)->s.mass).reversed()).toList();
        if(choices.isEmpty())return;
        int current=-1;for(int i=0;i<choices.size();i++)if(choices.get(i).id.equals(followId))current=i;
        watch(choices.get((current+1)%choices.size()).id);
    }
    static void pan(double dx,double dy,int height){
        if(free)return;
        if(following()){orbit-=dx*.012;followDistance=Math.max(.6,Math.min(2,followDistance+dy*.005));return;}
        var offset=ArenaSpace.pan(dx,dy,SnakeClient.cameraHeight,height,Minecraft.getInstance().options.fov().get()*zoom);
        double limit=SnakeClient.CONFIG.arenaSize*.75;
        SnakeClient.cameraX=Math.max(-limit,Math.min(limit,SnakeClient.cameraX+offset.x()));
        SnakeClient.cameraZ=Math.max(-limit,Math.min(limit,SnakeClient.cameraZ+offset.z()));
    }
    static void position(double x,double y,double z,float yaw,float pitch){
        Minecraft mc=Minecraft.getInstance();if(mc.player==null)return;
        mc.player.moveTo(x,y,z,yaw,pitch);mc.player.yRotO=yaw;mc.player.xRotO=pitch;
        var server=mc.getSingleplayerServer();var id=mc.player.getUUID();
        if(server!=null)server.execute(()->{var player=server.getPlayerList().getPlayer(id);if(player!=null)player.teleportTo(player.serverLevel(),x,y,z,yaw,pitch);});
    }
    static void scroll(double delta){
        targetZoom=Math.max(.32,Math.min(1.3,targetZoom-delta*.08));
    }
    static void rightZoom(boolean pressed){rightZoom=pressed&&!SnakePlayer.watchingSelf();}
    static boolean rightZooming(){return rightZoom;}
    static double zoom(){return zoom;}
    static double zoom(double partial){return previousZoom+(zoom-previousZoom)*Math.max(0,Math.min(1,partial));}
    static void close(){overview=null;free=false;followId="";rightZoom=false;snap=true;zoom=previousZoom=targetZoom=1;SnakeLabels.clear();}
}
