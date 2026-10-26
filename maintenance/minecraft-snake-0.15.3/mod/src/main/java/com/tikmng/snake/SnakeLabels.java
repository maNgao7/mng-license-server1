package com.tikmng.snake;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraftforge.client.event.RenderLevelStageEvent;
import org.joml.Matrix4f;
import org.joml.Vector4f;
import net.minecraft.world.phys.Vec3;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import java.util.*;

/** Project only the head anchor; portraits and text never scale with world distance. */
final class SnakeLabels {
    private static final Map<String,ArenaLabels.Rect> previous=new HashMap<>();
    private static List<ArenaLabels.Badge> badges=List.of();
    private static int viewportWidth,viewportHeight;
    private static Matrix4f pickView;
    private static Vec3 pickOrigin;
    private static double pickPartial;
    private static final ItemStack SHIELD=new ItemStack(Items.SHIELD);
    private record BodyTarget(String id,Vec3 start,Vec3 end,double radius){}
    static int visible,avatarPixels;
    static double centerError;
    static boolean nonOverlapping,insideViewport;
    static boolean shieldTextFits=true;
    static List<Map<String,Object>> shieldBadges=List.of();
    static void capture(RenderLevelStageEvent event,double partial){
        var mc=Minecraft.getInstance();int width=mc.getWindow().getGuiScaledWidth(),height=mc.getWindow().getGuiScaledHeight();
        if(viewportWidth!=width||viewportHeight!=height){previous.clear();viewportWidth=width;viewportHeight=height;}
        var origin=event.getCamera().getPosition();
        Matrix4f view=new Matrix4f(event.getProjectionMatrix()).mul(event.getPoseStack().last().pose());
        pickView=new Matrix4f(view);pickOrigin=origin;pickPartial=partial;
        var center=project(view,-origin.x,ArenaSpace.SURFACE_Y-origin.y,-origin.z,width,height);
        centerError=center==null?Double.POSITIVE_INFINITY:Math.hypot(center[0]-width/2.0,center[1]-height/2.0);
        avatarPixels=ArenaLabels.avatarSize(SnakeClient.CONFIG.profileScale);
        List<ArenaLabels.Anchor> anchors=new ArrayList<>();
        var snakes=new ArrayList<>(SnakeClient.ENGINE.snakes.values());
        snakes.sort(Comparator.comparingInt((ArenaEngine.Snake s)->s==SnakeCamera.followed()?0:1).thenComparing(s->s.id));
        for(var snake:snakes){
            var head=SnakeClient.ENGINE.displayHead(snake);double radius=head.renderRadius(partial),angle=head.renderAngle(partial);
            var point=project(view,head.renderX(partial)+Math.cos(angle)*radius*.7-origin.x,
                ArenaSpace.SURFACE_Y+radius*1.1+SnakeMesh.headLift(head.id)-origin.y,head.renderZ(partial)+Math.sin(angle)*radius*.7-origin.z,width,height);
            if(point==null||point[0]<0||point[0]>width||point[1]<40||point[1]>height-30)continue;
            int textWidth=Math.max(mc.font.width(name(snake)),mc.font.width(mass(snake)));
            anchors.add(new ArenaLabels.Anchor(snake.id,point[0],point[1],avatarPixels+textWidth+11+shieldWidth(snake),Math.max(28,avatarPixels+4)));
        }
        List<ArenaLabels.Rect> reserved=new ArrayList<>(SnakeScreens.hudReserved(width,height));
        badges=ArenaLabels.layout(anchors,width,height,reserved,previous);previous.clear();
        nonOverlapping=true;insideViewport=true;visible=badges.size();
        for(int i=0;i<badges.size();i++){
            var b=badges.get(i);var r=b.box();previous.put(b.anchor().id(),r);
            insideViewport&=r.x()>=0&&r.x()+r.width()<=width&&r.y()>=40&&r.y()+r.height()<height-30;
            nonOverlapping&=reserved.stream().noneMatch(r::overlaps);
            for(int j=0;j<i;j++)nonOverlapping&=!r.overlaps(badges.get(j).box());
        }
    }
    private static double[] project(Matrix4f matrix,double x,double y,double z,int width,int height){
        Vector4f point=matrix.transform(new Vector4f((float)x,(float)y,(float)z,1));
        if(point.w<=.01||!Float.isFinite(point.w))return null;
        double px=point.x/point.w,py=point.y/point.w,pz=point.z/point.w;
        if(!Double.isFinite(px)||!Double.isFinite(py)||pz<-1||pz>1)return null;
        return new double[]{(px+1)*width*.5,(1-py)*height*.5};
    }
    private static String name(ArenaEngine.Snake s){return Minecraft.getInstance().font.plainSubstrByWidth(s.name,100);}
    private static String mass(ArenaEngine.Snake s){return Minecraft.getInstance().font.plainSubstrByWidth(ArenaLabels.mass(s.mass)+" kutle",104);}
    private static String shieldSeconds(ArenaEngine.Snake s){return (long)Math.ceil(Math.max(0,s.shieldUntil-SnakeClient.ENGINE.time))+" sn";}
    private static int shieldWidth(ArenaEngine.Snake s){return s.shieldUntil>SnakeClient.ENGINE.time?Math.max(16,Minecraft.getInstance().font.width(shieldSeconds(s)))+8:0;}
    static void draw(GuiGraphics g){
        var mc=Minecraft.getInstance();List<Map<String,Object>> shields=new ArrayList<>();shieldTextFits=true;
        for(var badge:badges){
            var snake=SnakeClient.ENGINE.snakes.get(badge.anchor().id());if(snake==null)continue;
            var r=badge.box();int anchorX=(int)Math.round(badge.anchor().x()),anchorY=(int)Math.round(badge.anchor().y());
            int endX=Math.max(r.x()+3,Math.min(r.x()+r.width()-3,anchorX)),endY=anchorY<r.y()?r.y():r.y()+r.height();
            g.vLine(anchorX,Math.min(anchorY,endY),Math.max(anchorY,endY),0x9069DDCA);
            g.hLine(Math.min(anchorX,endX),Math.max(anchorX,endX),endY,0x9069DDCA);
            g.fill(anchorX-1,anchorY-1,anchorX+2,anchorY+2,0xFF69DDCA);
        }
        for(var badge:badges){
            var snake=SnakeClient.ENGINE.snakes.get(badge.anchor().id());if(snake==null)continue;
            var r=badge.box();
            int accent=snake==SnakeCamera.followed()?0xFFFFD66B:snake.shieldUntil>SnakeClient.ENGINE.time?0xFF7BC5ED:0xFF69DDCA;
            g.fill(r.x(),r.y(),r.x()+r.width(),r.y()+r.height(),0xD9111719);
            g.fill(r.x(),r.y(),r.x()+2,r.y()+r.height(),accent);
            int imageX=r.x()+4,imageY=r.y()+(r.height()-avatarPixels)/2;
            SnakeAvatars.blit(g,snake.id,snake.profile,imageX,imageY,avatarPixels);
            int textX=imageX+avatarPixels+4,textY=r.y()+(r.height()-20)/2;
            g.drawString(mc.font,name(snake),textX,textY,0xFFF4F6F7,true);
            g.drawString(mc.font,mass(snake),textX,textY+11,0xFF9EE7B8,true);
            if(snake.shieldUntil>SnakeClient.ENGINE.time){
                int slot=shieldWidth(snake),centerX=r.x()+r.width()-slot/2,iconX=centerX-8,iconY=r.y()+1;
                String seconds=shieldSeconds(snake);int secondsX=centerX-mc.font.width(seconds)/2,secondsY=r.y()+18;
                g.renderItem(SHIELD,iconX,iconY);g.drawString(mc.font,seconds,secondsX,secondsY,0xFFB9E4FF,true);
                var iconBounds=new ArenaLabels.Rect(iconX,iconY,16,16);var secondsBounds=new ArenaLabels.Rect(secondsX,secondsY,mc.font.width(seconds),mc.font.lineHeight);
                shieldTextFits&=Math.max(mc.font.width(name(snake)),mc.font.width(mass(snake)))+textX<=r.x()+r.width()-slot&&secondsX>=r.x()+r.width()-slot&&secondsX+secondsBounds.width()<=r.x()+r.width()&&secondsY+mc.font.lineHeight<=r.y()+r.height();
                shields.add(Map.of("id",snake.id,"seconds",(long)Math.ceil(snake.shieldUntil-SnakeClient.ENGINE.time),"iconBounds",iconBounds,"secondsBounds",secondsBounds,"badgeBounds",r));
            }
        }
        shieldBadges=List.copyOf(shields);
    }
    static void clear(){previous.clear();badges=List.of();pickView=null;pickOrigin=null;visible=0;shieldBadges=List.of();shieldTextFits=true;nonOverlapping=insideViewport=true;}
    static String pick(double x,double y){
        for(var b:badges)if(b.box().contains(x,y)&&SnakeClient.ENGINE.snakes.containsKey(b.anchor().id()))return b.anchor().id();
        return pickBody(x,y);
    }
    private static String ownerId(String id){
        if(SnakeClient.ENGINE.snakes.containsKey(id))return id;
        int part=id.lastIndexOf("~galaxy-");String owner=part<0?"":id.substring(0,part);
        return SnakeClient.ENGINE.snakes.containsKey(owner)?owner:"";
    }
    private static List<BodyTarget> bodyTargets(){
        var targets=new ArrayList<BodyTarget>();
        if(pickView==null)return targets;
        for(var snake:SnakeClient.ENGINE.renderSnakes()){
            String owner=ownerId(snake.id);if(owner.isEmpty())continue;
            var points=snake.body(pickPartial);if(points.size()<2)continue;
            double radius=snake.renderRadius(pickPartial),angle=snake.renderAngle(pickPartial);
            var weave=ArenaWeave.plan(points,radius);Vec3 previous=null;double previousRadius=radius;
            for(int i=0;i<points.size();i++){
                var point=points.get(i);double t=i/(double)(points.size()-1),taper=t<.64?1:Math.max(.04,Math.pow((1-t)/.36,.8)),r=radius*taper;
                Vec3 center=new Vec3(point.x(),ArenaSpace.SURFACE_Y+.09+r*.85+.12*(1-t)+weave.height(i),point.z());
                if(previous!=null)targets.add(new BodyTarget(owner,previous,center,Math.max(previousRadius,r)));
                previous=center;previousRadius=r;
            }
            double x=snake.renderX(pickPartial),z=snake.renderZ(pickPartial),y=ArenaSpace.SURFACE_Y+.28+radius*.82+weave.height(0);
            Vec3 head=new Vec3(x+Math.cos(angle)*radius*.25,y,z+Math.sin(angle)*radius*.25);
            Vec3 nose=new Vec3(x+Math.cos(angle)*radius*1.15,y-radius*.18,z+Math.sin(angle)*radius*1.15);
            targets.add(new BodyTarget(owner,head,nose,radius));
        }
        return targets;
    }
    static String pickBody(double x,double y){
        return pickBody(x,y,bodyTargets());
    }
    private static String pickBody(double x,double y,List<BodyTarget> targets){
        if(pickView==null||pickOrigin==null||viewportWidth<=0||viewportHeight<=0||x<0||y<0||x>=viewportWidth||y>=viewportHeight)return "";
        Matrix4f inverse=new Matrix4f(pickView).invert();
        float nx=(float)(2*x/viewportWidth-1),ny=(float)(1-2*y/viewportHeight);
        Vector4f near=inverse.transform(new Vector4f(nx,ny,-1,1)),far=inverse.transform(new Vector4f(nx,ny,1,1));
        if(!Float.isFinite(near.w)||!Float.isFinite(far.w)||Math.abs(near.w)<1e-8||Math.abs(far.w)<1e-8)return "";
        Vec3 start=new Vec3(near.x/near.w,near.y/near.w,near.z/near.w).add(pickOrigin);
        Vec3 end=new Vec3(far.x/far.w,far.y/far.w,far.z/far.w).add(pickOrigin),direction=end.subtract(start).normalize();
        double nearest=end.distanceTo(start);String selected="";
        for(var target:targets){
            double hit=capsuleHit(start,direction,target.start,target.end,target.radius);
            if(hit<nearest){nearest=hit;selected=target.id;}
        }
        return selected;
    }
    private static double sphereHit(Vec3 start,Vec3 direction,Vec3 center,double radius){
        var offset=start.subtract(center);double b=offset.dot(direction),c=offset.lengthSqr()-radius*radius,h=b*b-c;
        if(h<0)return Double.POSITIVE_INFINITY;
        if(c<=0)return 0;
        double t=-b-Math.sqrt(h);return t>=0?t:Double.POSITIVE_INFINITY;
    }
    private static double capsuleHit(Vec3 start,Vec3 direction,Vec3 a,Vec3 b,double radius){
        var axis=b.subtract(a);var offset=start.subtract(a);double length=axis.lengthSqr();
        if(length<1e-10)return sphereHit(start,direction,a,radius);
        double along=axis.dot(direction),originAlong=axis.dot(offset),rayOrigin=direction.dot(offset);
        double aa=length-along*along,bb=length*rayOrigin-originAlong*along,cc=length*offset.lengthSqr()-originAlong*originAlong-radius*radius*length;
        double nearest=Math.min(sphereHit(start,direction,a,radius),sphereHit(start,direction,b,radius));
        if(originAlong>=0&&originAlong<=length&&cc<=0)return 0;
        double h=bb*bb-aa*cc;
        if(aa>1e-10&&h>=0){double t=(-bb-Math.sqrt(h))/aa,position=originAlong+t*along;if(t>=0&&position>=0&&position<=length)nearest=Math.min(nearest,t);}
        return nearest;
    }
    static List<Map<String,Object>> qaBodyTargets(){
        List<Map<String,Object>> result=new ArrayList<>();Set<String> found=new HashSet<>();
        if(pickView==null)return result;
        var reserved=SnakeScreens.hudReserved(viewportWidth,viewportHeight);
        var targets=bodyTargets();
        for(var target:targets){
            if(found.contains(target.id))continue;
            var center=target.start.add(target.end).scale(.5).subtract(pickOrigin);
            var point=project(pickView,center.x,center.y,center.z,viewportWidth,viewportHeight);
            if(point==null||reserved.stream().anyMatch(r->r.contains(point[0],point[1]))||badges.stream().anyMatch(b->b.box().contains(point[0],point[1])))continue;
            if(!target.id.equals(pickBody(point[0],point[1],targets)))continue;
            found.add(target.id);result.add(Map.of("id",target.id,"x",point[0],"y",point[1]));
        }
        return result;
    }
}
