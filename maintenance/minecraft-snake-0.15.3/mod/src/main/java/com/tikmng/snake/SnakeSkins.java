package com.tikmng.snake;

import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.ResourceLocation;
import java.util.HashMap;
import java.util.Map;

/** Pixel patterns belong to the model, not to individual moving blocks. */
final class SnakeSkins {
    private static final Map<Integer,ResourceLocation> TEXTURES=new HashMap<>();
    private static ResourceLocation white;
    private static final int[][] PALETTES={
        {0x922138,0xF5E7CE,0x24202B},{0x143A65,0xE7BF55,0x101F32},
        {0x168F83,0xE4F7DD,0x173A3C},{0xDB9B2E,0x342F38,0x422518},
        {0x713F96,0xF0D7E8,0x201B32},{0x587235,0xD6CF79,0x28352A},
        {0xCE5730,0xF6DAB0,0x492723},{0x2E3441,0xD5E0E2,0x141B27},
        {0xD881A4,0xFCEAE4,0x52334D},{0x4695C1,0xDDF3E8,0x243F5B},
        {0xBD554D,0xF5C95A,0x352F32},{0x929DAA,0x353D50,0x252737}
    };
    static int base(int skin){return PALETTES[Math.floorMod(skin,PALETTES.length)][0];}
    static int dark(int skin){return PALETTES[Math.floorMod(skin,PALETTES.length)][2];}
    static int accent(int skin){return PALETTES[Math.floorMod(skin,PALETTES.length)][1];}
    static ResourceLocation white(){
        if(white==null){NativeImage image=new NativeImage(1,1,false);image.setPixelRGBA(0,0,0xFFFFFFFF);white=register(image,"snake_material");}
        return white;
    }
    static ResourceLocation texture(int skin){
        return TEXTURES.computeIfAbsent(skin,key->{
            int[] palette=PALETTES[Math.floorMod(key,PALETTES.length)];
            NativeImage image=new NativeImage(64,64,false);
            int style=Math.floorMod(key/PALETTES.length,8);
            for(int u=0;u<64;u++)for(int v=0;v<64;v++){
                double around=u/64.0,along=v/64.0;
                double back=Math.abs(around-.25),belly=Math.abs(around-.75);
                int color=palette[0];
                if(belly<.17){color=mix(palette[1],palette[0],.18);if(v%8==0)color=mix(color,palette[2],.2);}
                else {
                    double band=Math.abs((along+.5)%1-.5);
                    boolean mark=switch(style){
                        case 0 -> Math.abs(band-back*.75-.13)<.045&&back<.3;
                        case 1 -> Math.abs(band+back*1.05-.34)<.055;
                        case 2 -> band<.075||(band>.14&&band<.21&&back>.2);
                        case 3 -> band+back*.9<.21&&band+back*.9>.115;
                        case 4 -> Math.abs(band-back*.65-.11)<.045||Math.abs(band-back*.65-.29)<.035;
                        case 5 -> (u/4+v/6)%3==0&&u%4<2&&v%6<3;
                        case 6 -> band<.035||(band>.1&&band<.15)||(band>.22&&band<.25);
                        default -> Math.abs(Math.sin(along*Math.PI*4)+Math.cos(around*Math.PI*8))<.3;
                    };
                    if(mark)color=palette[1];
                    if((v+(u/4%2)*2)%6==0&&u%4>0)color=mix(color,palette[2],.15);
                    if(back<.035)color=mix(color,palette[1],.12);
                }
                if(v==0)color=mix(color,palette[2],.65);
                image.setPixelRGBA(u,v,abgr(color));
            }
            return register(image,"snake_skin_"+key);
        });
    }
    private static ResourceLocation register(NativeImage image,String name){
        DynamicTexture texture=new DynamicTexture(image);texture.setFilter(false,false);
        return Minecraft.getInstance().getTextureManager().register(name,texture);
    }
    private static int abgr(int rgb){return 0xFF000000|(rgb&255)<<16|(rgb&0xFF00)|((rgb>>>16)&255);}
    private static int mix(int a,int b,double t){
        int r=(int)(((a>>>16)&255)*(1-t)+((b>>>16)&255)*t),g=(int)(((a>>>8)&255)*(1-t)+((b>>>8)&255)*t),bl=(int)((a&255)*(1-t)+(b&255)*t);
        return r<<16|g<<8|bl;
    }
}
