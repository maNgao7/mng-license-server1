package com.tikmng.snake;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import net.minecraft.client.renderer.LightTexture;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.texture.OverlayTexture;
import java.util.List;

final class SnakeMesh {
    private static final int[][][] CUBE_FACES={{{1,-1,-1},{1,1,-1},{1,1,1},{1,-1,1}},{{-1,-1,1},{-1,1,1},{-1,1,-1},{-1,-1,-1}},
        {{-1,1,-1},{-1,1,1},{1,1,1},{1,1,-1}},{{-1,-1,1},{-1,-1,-1},{1,-1,-1},{1,-1,1}},
        {{1,-1,1},{1,1,1},{-1,1,1},{-1,-1,1}},{{-1,-1,-1},{-1,1,-1},{1,1,-1},{1,-1,-1}}};
    private static final double[][] CUBE_NORMALS={{1,0,0},{-1,0,0},{0,1,0},{0,-1,0},{0,0,1},{0,0,-1}};
    private static final double GROUND=ArenaSpace.SURFACE_Y;
    record Ring(double x,double y,double z,double sideX,double sideZ,double radius,double v){}
    static int bodyQuads;
    private static final java.util.Map<String,Double> headLifts=new java.util.HashMap<>();
    static void beginFrame(){headLifts.clear();}
    static double headLift(String id){return headLifts.getOrDefault(id,0.0);}
    static void distantArena(PoseStack p,MultiBufferSource.BufferSource buffers,int size){
        var out=buffers.getBuffer(RenderType.entityCutoutNoCull(SnakeSkins.white()));double half=size/2.0,outer=size*2.0;
        // Overview geometry remains visible beyond Minecraft's loaded-chunk distance.
        int slices=256;
        for(int i=0;i<slices;i++){
            double a=i*Math.PI*2/slices,b=(i+1)*Math.PI*2/slices;
            for(int ring=0;ring<2;ring++){
                double inner=ring==0?0:half,edge=ring==0?half:outer;int color=ring==0?0x799B45:0x618A3A;
                vertex(p,out,Math.cos(a)*inner,GROUND-.025,Math.sin(a)*inner,0,0,0,1,0,color,255);
                vertex(p,out,Math.cos(b)*inner,GROUND-.025,Math.sin(b)*inner,0,0,0,1,0,color,255);
                vertex(p,out,Math.cos(b)*edge,GROUND-.025,Math.sin(b)*edge,1,1,0,1,0,color,255);
                vertex(p,out,Math.cos(a)*edge,GROUND-.025,Math.sin(a)*edge,1,1,0,1,0,color,255);
            }
        }
        int posts=(int)Math.ceil(Math.PI*size/8),trees=(int)Math.ceil(Math.PI*size/13);
        for(int i=0;i<posts;i++){
            double angle=i*Math.PI*2/posts,x=Math.cos(angle)*half,z=Math.sin(angle)*half;
            cube(p,out,x,GROUND+2,z,.25,2,.25,angle,0xB69A60);
            cube(p,out,x,GROUND+1,z,.14,.12,Math.PI*size/posts*.52,angle,0xB69A60);
            cube(p,out,x,GROUND+3,z,.14,.12,Math.PI*size/posts*.52,angle,0xB69A60);
        }
        for(int i=0;i<trees;i++){
            double angle=i*2*Math.PI/trees,r=half+18+(i*17%37),x=Math.cos(angle)*r,z=Math.sin(angle)*r,h=6+i%4;
            cube(p,out,x,GROUND+h*.5,z,.65,h*.5,.65,0,i%4==0?0xD9D8BC:0x705038);
            cube(p,out,x,GROUND+h,z,3,2,3,0,i%5==0?0xE9ACC7:i%3==0?0x4E852B:0x376C25);
            cube(p,out,x,GROUND+h+2,z,2,1,2,0,i%5==0?0xF5CCDF:0x4B7F2E);
            for(int f=0;f<3;f++)cube(p,out,x+4+f,GROUND+.4,z+2-f,.3,.4,.3,0,f==0?0xE5B842:f==1?0xDA4E56:0xE5EADF);
        }
    }
    static void render(PoseStack pose,MultiBufferSource.BufferSource buffers,ArenaEngine.Snake snake,double partial,double time){
        render(pose,buffers,snake,partial,time,snake.body(partial),0);
    }
    static void render(PoseStack pose,MultiBufferSource.BufferSource buffers,ArenaEngine.Snake snake,double partial,double time,List<ArenaEngine.Point> points,double distance){
        if(points.size()<2)return;
        double radius=snake.renderRadius(partial),angle=snake.renderAngle(partial);
        var weave=ArenaWeave.plan(points,radius);double[] lifts=new double[points.size()];
        for(int i=0;i<lifts.length;i++)lifts[i]=weave.height(i);
        headLifts.put(snake.id,lifts[0]);
        int maxSegments=distance>180?36:distance>85?64:100;
        int stride=Math.max(1,(points.size()-1+maxSegments-1)/maxSegments);
        if(stride>1){
            var simplified=new java.util.ArrayList<ArenaEngine.Point>();
            double[] reduced=new double[(points.size()-2)/stride+2];int next=0;
            for(int i=0;i<points.size()-1;i+=stride){simplified.add(points.get(i));reduced[next++]=lifts[i];}
            simplified.add(points.get(points.size()-1));reduced[next]=lifts[lifts.length-1];points=simplified;lifts=reduced;
        }
        body(pose,buffers,points,radius,angle,snake.skin,time,0,distance>150?8:12,lifts);
        pose.pushPose();pose.translate(0,lifts[0],0);
        head(pose,buffers,snake.renderX(partial),snake.renderZ(partial),radius,angle,snake.skin,time,snake.boostUntil>time);
        pose.popPose();
    }
    static void renderMeal(PoseStack pose,MultiBufferSource.BufferSource buffers,ArenaEngine.Meal meal,double time){
        if(meal.body().size()<2)return;
        body(pose,buffers,meal.body(),meal.radius(),meal.angle(),meal.skin(),time,meal.startFraction(),10,null);
        if(meal.whole()){
            var first=meal.body().get(0);head(pose,buffers,first.x(),first.z(),meal.radius(),meal.angle(),meal.skin(),time,false);
        }
    }
    static void renderWeaveFixture(PoseStack pose,MultiBufferSource.BufferSource buffers,List<ArenaEngine.Point> points,double radius,double time){
        var weave=ArenaWeave.plan(points,radius);double[] lifts=new double[points.size()];for(int i=0;i<lifts.length;i++)lifts[i]=weave.height(i);
        body(pose,buffers,points,radius,0,0,time,0,12,lifts);
        var first=points.get(0);pose.pushPose();pose.translate(0,lifts[0],0);head(pose,buffers,first.x(),first.z(),radius,0,0,time,false);pose.popPose();
    }
    private static void body(PoseStack pose,MultiBufferSource.BufferSource buffers,List<ArenaEngine.Point> points,double radius,double angle,int skinId,double time,double startFraction,int sides,double[] lifts){
        VertexConsumer skin=buffers.getBuffer(RenderType.entityCutoutNoCull(SnakeSkins.texture(skinId)));
        Ring previous=null;double distance=0;
        for(int i=0;i<points.size();i++){
            ArenaEngine.Point p=points.get(i),ahead=points.get(Math.max(0,i-1)),behind=points.get(Math.min(points.size()-1,i+1));
            double dx=ahead.x()-behind.x(),dz=ahead.z()-behind.z(),length=Math.hypot(dx,dz);
            if(length<1e-7){dx=Math.cos(angle);dz=Math.sin(angle);length=1;}
            double t=startFraction+(1-startFraction)*i/(double)(points.size()-1),taper=t<.64?1:Math.max(.04,Math.pow((1-t)/.36,.8));
            double r=radius*taper;
            double wave=Math.sin(distance/Math.max(.5,radius*1.9)-time*1.9)*radius*.035*Math.sin(t*Math.PI);
            if(i>0){var last=points.get(i-1);distance+=Math.hypot(p.x()-last.x(),p.z()-last.z());}
            Ring ring=new Ring(p.x()-dz/length*wave,GROUND+.09+r*.85+.12*(1-t)+(lifts==null?0:lifts[i]),p.z()+dx/length*wave,-dz/length,dx/length,r,distance/(radius*2.6));
            if(previous!=null){
                for(int side=0;side<sides;side++){
                    // Shared rings make a closed, continuous body even through bends.
                    ringVertex(pose,skin,previous,side,sides,0xFFFFFF,255);
                    ringVertex(pose,skin,ring,side,sides,0xFFFFFF,255);
                    ringVertex(pose,skin,ring,side+1,sides,0xFFFFFF,255);
                    ringVertex(pose,skin,previous,side+1,sides,0xFFFFFF,255);bodyQuads++;
                }
            }
            previous=ring;
        }
    }
    private static void head(PoseStack pose,MultiBufferSource.BufferSource buffers,double x,double z,double radius,double angle,int skinId,double time,boolean boosted){
        pose.pushPose();pose.translate(0,.12,0);
        VertexConsumer skin=buffers.getBuffer(RenderType.entityCutoutNoCull(SnakeSkins.texture(skinId)));
        double fx=Math.cos(angle),fz=Math.sin(angle);
        ellipsoid(pose,skin,x+fx*radius*.25,GROUND+.16+radius*.82,z+fz*radius*.25,radius*1.3,radius*.82,radius*.96,angle,0xFFFFFF,8,12);
        ellipsoid(pose,skin,x+fx*radius*1.05,GROUND+.14+radius*.64,z+fz*radius*1.05,radius*.98,radius*.5,radius*.73,angle,0xFFFFFF,6,12);
        var white=buffers.getBuffer(RenderType.entityCutoutNoCull(SnakeSkins.white()));
        ellipsoid(pose,white,x+fx*radius*1.15,GROUND+.12+radius*.32,z+fz*radius*1.15,radius*.94,radius*.11,radius*.69,angle,SnakeSkins.dark(skinId),4,12);
        ellipsoid(pose,white,x+fx*radius*1.12,GROUND+.12+radius*.22,z+fz*radius*1.12,radius*.86,radius*.13,radius*.64,angle,SnakeSkins.accent(skinId),4,12);
        headDetails(pose,white,x,z,radius,angle,SnakeSkins.dark(skinId),time);
        if(boosted){
            for(int i=0;i<3;i++)cube(pose,white,x-Math.cos(angle)*radius*(1.5+i*.6),GROUND+.4,z-Math.sin(angle)*radius*(1.5+i*.6),radius*.2,radius*.12,radius*.2,angle,0x83FFF0);
        }
        pose.popPose();
    }
    static void shadow(PoseStack pose,VertexConsumer out,ArenaEngine.Snake snake,double partial){
        shadow(pose,out,snake,partial,snake.body(partial));
    }
    static void shadow(PoseStack pose,VertexConsumer out,ArenaEngine.Snake snake,double partial,List<ArenaEngine.Point> points){
        double radius=snake.renderRadius(partial);
        for(int i=0;i<points.size()-1;i++){
            var a=points.get(i);var b=points.get(i+1);double dx=b.x()-a.x(),dz=b.z()-a.z(),length=Math.hypot(dx,dz);if(length<1e-7)continue;
            double t=i/(double)points.size(),r=radius*(t<.64?1:Math.max(.03,(1-t)/.36));
            double sx=-dz/length*r,sz=dx/length*r;
            vertex(pose,out,a.x()-sx,GROUND+.012,a.z()-sz,0,0,0,1,0,0x081C0C,65);
            vertex(pose,out,b.x()-sx,GROUND+.012,b.z()-sz,0,0,0,1,0,0x081C0C,65);
            vertex(pose,out,b.x()+sx,GROUND+.012,b.z()+sz,1,1,0,1,0,0x081C0C,65);
            vertex(pose,out,a.x()+sx,GROUND+.012,a.z()+sz,1,1,0,1,0,0x081C0C,65);
        }
    }
    private static void ringVertex(PoseStack p,VertexConsumer out,Ring ring,int corner,int sides,int color,int alpha){
        double angle=corner*Math.PI*2/sides,side=Math.cos(angle),height=Math.sin(angle);
        vertex(p,out,ring.x+ring.sideX*ring.radius*side,ring.y+ring.radius*.85*height,ring.z+ring.sideZ*ring.radius*side,
            corner/(double)sides,ring.v,ring.sideX*side,height,ring.sideZ*side,color,alpha);
    }
    private static void headDetails(PoseStack p,VertexConsumer solid,double x,double z,double r,double angle,int dark,double time){
        double fx=Math.cos(angle),fz=Math.sin(angle),sx=-fz,sz=fx;
        for(int sign:new int[]{-1,1}){
            double ex=x+fx*r*.65+sx*r*.79*sign,ez=z+fz*r*.65+sz*r*.79*sign;
            ellipsoid(p,solid,ex,GROUND+.09+r*1.2,ez,r*.25,r*.23,r*.17,angle,0xE4CB7B,4,8);
            ellipsoid(p,solid,ex+sx*r*.12*sign+fx*r*.06,GROUND+.09+r*1.23,ez+sz*r*.12*sign+fz*r*.06,r*.055,r*.16,r*.075,angle,0x101414,4,8);
            ellipsoid(p,solid,ex-fx*r*.03,GROUND+.09+r*1.4,ez,r*.28,r*.09,r*.2,angle,dark,4,8);
            ellipsoid(p,solid,x+fx*r*1.87+sx*r*.32*sign,GROUND+.09+r*.8,z+fz*r*1.87+sz*r*.32*sign,r*.05,r*.035,r*.05,angle,0x090C10,4,6);
        }
        if(Math.sin(time*2.7+snakePhase(x,z))>.83){
            double length=r*(.45+.2*Math.sin(time*19));
            cube(p,solid,x+fx*(r*1.8+length*.5),GROUND+.09+r*.58,z+fz*(r*1.8+length*.5),length*.65,r*.025,r*.06,angle,0xC83C56);
            for(int sign:new int[]{-1,1})cube(p,solid,x+fx*(r*1.8+length)+sx*r*.09*sign,GROUND+.09+r*.58,z+fz*(r*1.8+length)+sz*r*.09*sign,r*.19,r*.022,r*.035,angle+sign*.35,0xC83C56);
        }
    }
    private static double snakePhase(double x,double z){return (x+z)*.01;}
    private static void ellipsoid(PoseStack p,VertexConsumer out,double x,double y,double z,double rx,double ry,double rz,double angle,int color,int rows,int sides){
        for(int row=0;row<rows;row++)for(int side=0;side<sides;side++){
            sphereVertex(p,out,x,y,z,rx,ry,rz,angle,color,row,side,rows,sides);
            sphereVertex(p,out,x,y,z,rx,ry,rz,angle,color,row+1,side,rows,sides);
            sphereVertex(p,out,x,y,z,rx,ry,rz,angle,color,row+1,side+1,rows,sides);
            sphereVertex(p,out,x,y,z,rx,ry,rz,angle,color,row,side+1,rows,sides);
        }
    }
    private static void sphereVertex(PoseStack p,VertexConsumer out,double x,double y,double z,double rx,double ry,double rz,double angle,int color,int row,int side,int rows,int sides){
        double latitude=-Math.PI/2+Math.PI*row/rows,longitude=Math.PI*2*side/sides;
        double nx=Math.cos(latitude)*Math.cos(longitude),ny=Math.sin(latitude),nz=Math.cos(latitude)*Math.sin(longitude),fx=Math.cos(angle),fz=Math.sin(angle);
        vertex(p,out,x+fx*nx*rx-fz*nz*rz,y+ny*ry,z+fz*nx*rx+fx*nz*rz,side/(double)sides,row/(double)rows,fx*nx-fz*nz,ny,fz*nx+fx*nz,color,255);
    }
    static void pellet(PoseStack p,VertexConsumer out,double x,double z,int color){
        cube(p,out,x-.09,GROUND+.19,z,.15,.16,.15,0,color);
        cube(p,out,x+.09,GROUND+.19,z+.05,.13,.14,.13,0,color);
        cube(p,out,x,GROUND+.38,z,.13,.035,.075,.5,0x72BF43);
    }
    static void feedPellet(PoseStack p,VertexConsumer out,double x,double y,double z,double radius,int color){
        cube(p,out,x,y,z,radius,radius,radius,0,color);
    }
    private static void cube(PoseStack p,VertexConsumer out,double x,double y,double z,double rx,double ry,double rz,double angle,int color){
        double fx=Math.cos(angle),fz=Math.sin(angle);
        for(int face=0;face<6;face++)for(int i=0;i<4;i++){
            var point=CUBE_FACES[face][i];double lx=point[0]*rx,lz=point[2]*rz;var n=CUBE_NORMALS[face];
            vertex(p,out,x+fx*lx-fz*lz,y+point[1]*ry,z+fz*lx+fx*lz,(i==1||i==2)?1:0,i>=2?1:0,
                fx*n[0]-fz*n[2],n[1],fz*n[0]+fx*n[2],color,255);
        }
    }
    private static void vertex(PoseStack p,VertexConsumer out,double x,double y,double z,double u,double v,double nx,double ny,double nz,int color,int alpha){
        double light=.72+.24*Math.max(0,ny)+.04*Math.max(0,-nx);
        int red=(int)(((color>>>16)&255)*light),green=(int)(((color>>>8)&255)*light),blue=(int)((color&255)*light);
        out.vertex(p.last().pose(),(float)x,(float)y,(float)z).color(red,green,blue,alpha).uv((float)u,(float)v)
            .overlayCoords(OverlayTexture.NO_OVERLAY).uv2(LightTexture.FULL_BRIGHT).normal(p.last().normal(),(float)nx,(float)ny,(float)nz).endVertex();
    }
}
