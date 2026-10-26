package com.tikmng.snake;

/** The default 1.20.1 flat preset has grass at -61, not sea level. */
public final class ArenaSpace {
    public static final int FLOOR_Y=-61,SURFACE_Y=FLOOR_Y+1;
    public record Offset(double x,double z){}
    public record View(double x,double y,double z,float yaw,float pitch){}
    private ArenaSpace(){}
    public static double topHeight(int size){return SURFACE_Y+Math.max(30,size*.86);}
    public static double topHeight(int size,int width,int height,double fov){
        double available=Math.max(80,Math.min(width-24,height-100));
        double distance=(size+10)*height/(2*available*Math.tan(Math.toRadians(Math.max(30,Math.min(110,fov)))/2));
        return SURFACE_Y+Math.max(30,distance);
    }
    public static Offset pan(double dx,double dy,double height,int viewportHeight,double verticalFov){
        double scale=2*Math.max(8,height-SURFACE_Y)*Math.tan(Math.toRadians(verticalFov)/2)/Math.max(100,viewportHeight);
        // From above, Minecraft's yaw=0 camera has screen-right=-X and up=+Z.
        return new Offset(dx*scale,dy*scale);
    }
    public static View closeView(double x,double z,double heading,double radius,double orbit,double distanceScale){
        double angle=heading+orbit,distance=Math.max(10,radius*6)*distanceScale;
        double cx=x-Math.cos(angle)*distance,cz=z-Math.sin(angle)*distance;
        double targetY=SURFACE_Y+radius*.9,cy=SURFACE_Y+Math.max(8,radius*4)*distanceScale;
        return lookAt(cx,cy,cz,x,targetY,z);
    }
    public static View lookAt(double x,double y,double z,double tx,double ty,double tz){
        double dx=tx-x,dz=tz-z;
        return new View(x,y,z,(float)Math.toDegrees(Math.atan2(-dx,dz)),
            (float)Math.toDegrees(Math.atan2(y-ty,Math.max(.01,Math.hypot(dx,dz)))));
    }
}
