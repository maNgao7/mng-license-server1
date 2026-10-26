package com.tikmng.snake;

/** Deterministic scenery around a circle centered on block (0, 0), built only on resize. */
public final class ArenaLandscape {
    public static final int MARGIN=64,VERSION=13,BUILD_HEIGHT=19;
    public enum Surface { GRASS, CURB, GRAVEL, PAVING, ACCENT, PODZOL, COARSE_DIRT, SAND, WATER }
    public enum Detail { NONE, GRASS, FERN, POPPY, DANDELION, BLUE_ORCHID }
    public record Tree(int x,int z,int ground,int height,boolean birch,int radius){}
    private ArenaLandscape(){}
    public static boolean inside(int x,int z,int half){return (long)x*x+(long)z*z<=(long)half*half;}
    public static double outside(int x,int z,int half){return Math.hypot(x,z)-half;}
    public static boolean edge(int x,int z,int half){
        return inside(x,z,half)&&(!inside(x-1,z,half)||!inside(x+1,z,half)||!inside(x,z-1,half)||!inside(x,z+1,half));
    }
    public static boolean fence(int x,int z,int half){
        if(!inside(x,z,half))return false;
        // Inner corner joins make diagonal steps a four-connected native fence ring.
        return edge(x,z,half)||!inside(x-1,z-1,half)||!inside(x-1,z+1,half)
            ||!inside(x+1,z-1,half)||!inside(x+1,z+1,half);
    }
    public static boolean tower(int x,int z,int half){
        return Math.abs(Math.abs(x)-half)<=1&&Math.abs(z)<=1
            ||Math.abs(x)<=1&&Math.abs(Math.abs(z)-half)<=1;
    }
    public static boolean post(int x,int z,int half){
        if(!fence(x,z,half)||tower(x,z,half))return false;
        int count=Math.max(8,(int)Math.round(2*Math.PI*half/88)*4);
        double step=2*Math.PI/count,angle=Math.rint(Math.atan2(z,x)/step)*step;
        int px=(int)Math.round(half*Math.cos(angle)),pz=(int)Math.round(half*Math.sin(angle));
        if(!inside(px,pz,half)){
            if(Math.abs(px)>=Math.abs(pz))px-=Integer.signum(px);else pz-=Integer.signum(pz);
        }
        return x==px&&z==pz;
    }
    public static int height(int x,int z,int half){
        double distance=outside(x,z,half);
        if(distance<=10||distance>=MARGIN)return 0;
        double ramp=Math.min(1,(distance-10)/16)*Math.min(1,(MARGIN-distance)/8);
        double basin=Math.max(0,Math.min(1,(pondDistance(x,z,half)-1.3)/.6));
        double hills=2.7+1.4*Math.sin(x*.061+.4)+1.1*Math.cos(z*.073-.7)+.8*Math.sin((x+z)*.039);
        return Math.max(0,Math.min(6,(int)Math.round(hills*ramp*basin)));
    }
    public static Surface surface(int x,int z,int half){
        double distance=outside(x,z,half);
        if(distance<=0||distance>=MARGIN)return Surface.GRASS;
        if(distance<=1.5)return Surface.CURB;
        if(distance<=5)return Surface.GRAVEL;
        // Short garden spurs stay entirely on the existing flat, tree-free apron.
        int diagonal=Math.abs(Math.abs(x)-Math.abs(z));
        if(distance<=10&&diagonal<=2)return Surface.GRAVEL;
        if(distance<=6)return Math.min(Math.abs(x),Math.abs(z))<=2?Surface.ACCENT:Surface.PAVING;
        if(distance<=10)return diagonal==3?Surface.CURB:Surface.GRASS;
        double pond=pondDistance(x,z,half);
        if(pond<=.72)return Surface.WATER;
        if(pond<=1.2)return Surface.SAND;
        if(pond<=1.45)return Surface.COARSE_DIRT;
        int seed=hash(x,z);
        if(distance<MARGIN-5&&grove(x,z)>.7&&seed%7<3)return Surface.PODZOL;
        return distance<MARGIN-5&&seed%61==0?Surface.COARSE_DIRT:Surface.GRASS;
    }
    public static Tree tree(int x,int z,int half){
        double distance=outside(x,z,half);
        if(distance<=10||distance>=MARGIN-2)return null;
        int cellX=Math.floorDiv(x,16),cellZ=Math.floorDiv(z,16);
        for(int gx=cellX-1;gx<=cellX+1;gx++)for(int gz=cellZ-1;gz<=cellZ+1;gz++){
            int seed=hash(gx,gz),cx=gx*16+4+seed%8,cz=gz*16+4+(seed/13)%8;
            double centerDistance=outside(cx,cz,half);
            if(centerDistance<14||centerDistance>MARGIN-6||seed%100>78+grove(cx,cz)*12)continue;
            boolean birch=seed%4==0;
            int radius=birch?3:4+(seed/17)%2,dx=x-cx,dz=z-cz;
            if(dx*dx+dz*dz>radius*radius||pondDistance(cx,cz,half)<4||rockHeight(cx,cz,half)>0)continue;
            return new Tree(cx,cz,height(cx,cz,half),birch?8+seed%2:6+(seed/7)%4,birch,radius);
        }
        return null;
    }
    public static int rockHeight(int x,int z,int half){
        double distance=outside(x,z,half);
        if(distance<=14||distance>=MARGIN-5||pondDistance(x,z,half)<1.8)return 0;
        int gx=Math.floorDiv(x,24),gz=Math.floorDiv(z,24),seed=hash(gx+307,gz-193);
        if(seed%3!=0)return 0;
        int dx=x-(gx*24+8+seed%9),dz=z-(gz*24+8+(seed/11)%9),radius=2+(seed/7)%2;
        int squared=dx*dx+dz*dz;
        return squared>radius*radius?0:squared<=2?2:1;
    }
    public static Detail detail(int x,int z,int half){
        double distance=outside(x,z,half);
        if(distance<=6||distance>=MARGIN-3)return Detail.NONE;
        Surface surface=surface(x,z,half);
        if(surface!=Surface.GRASS&&surface!=Surface.PODZOL)return Detail.NONE;
        if(distance<=10)return Math.floorMod(x*31+z*17,3)==0?Detail.POPPY:Detail.NONE;
        int seed=hash(x+71,z-37);
        if(seed%9==0)return z>0?Detail.BLUE_ORCHID:x<0?Detail.POPPY:Detail.DANDELION;
        if(seed%5==0)return surface==Surface.PODZOL?Detail.FERN:Detail.GRASS;
        return Detail.NONE;
    }
    private static double pondDistance(int x,int z,int half){
        double ax=(x+half+24)/9.0,az=(z+half/3-5)/6.0;
        double bx=(x-half/3+7)/8.0,bz=(z-half-27)/5.0;
        return Math.min(ax*ax+az*az,bx*bx+bz*bz)+.07*Math.sin(x*.8+z*.6);
    }
    private static double grove(int x,int z){
        return Math.sin(x*.043+.5)+.7*Math.cos(z*.051)+.5*Math.sin((x-z)*.035);
    }
    private static int hash(int x,int z){
        int seed=x*0x1f1f1f1f^z*0x45d9f3b;
        seed=(seed^(seed>>>16))*0x45d9f3b;
        return (seed^(seed>>>16))&Integer.MAX_VALUE;
    }
}
