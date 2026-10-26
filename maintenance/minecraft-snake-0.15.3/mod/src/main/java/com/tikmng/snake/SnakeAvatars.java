package com.tikmng.snake;

import com.mojang.blaze3d.platform.NativeImage;
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.ResourceLocation;
import org.lwjgl.stb.STBImage;
import org.lwjgl.system.MemoryStack;
import org.lwjgl.system.MemoryUtil;
import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;

public final class SnakeAvatars {
    private static final int MAX_ENTRIES=128,MAX_PENDING=8,MAX_BYTES=4*1024*1024,MAX_SOURCE_SIZE=2048,MAX_TEXTURE_SIZE=256;
    private static final int FALLBACK_SIZE=128;
    public record Diagnostics(int sourceWidth,int sourceHeight,int texturePixels,boolean downloaded,boolean pending){}
    private record Downloaded(NativeImage image,int sourceWidth,int sourceHeight){}
    private static final class Entry {
        ResourceLocation texture;
        String source="",requested="";
        boolean pending;
        int failures;
        int sourceWidth,sourceHeight,texturePixels=FALLBACK_SIZE;
        long retryAt;
        Entry(ResourceLocation texture){this.texture=texture;}
    }
    // Cache and request state belong to the render thread; workers own only image bytes/pixels.
    private static final LinkedHashMap<String,Entry> CACHE=new LinkedHashMap<>(16,.75f,true);
    private static int pending;
    private static final ExecutorService IO=new ThreadPoolExecutor(2,2,0,TimeUnit.MILLISECONDS,new ArrayBlockingQueue<>(MAX_PENDING-2),r->{Thread t=new Thread(r,"snake-avatars");t.setDaemon(true);return t;},new ThreadPoolExecutor.AbortPolicy());
    private static final HttpClient HTTP=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
    static long loadedCount(){RenderSystem.assertOnRenderThread();return CACHE.values().stream().filter(e->!e.source.isEmpty()).count();}
    public static Diagnostics diagnostics(String id){
        RenderSystem.assertOnRenderThread();Entry entry=CACHE.get(id);
        return entry==null?new Diagnostics(0,0,0,false,false):new Diagnostics(entry.sourceWidth,entry.sourceHeight,entry.texturePixels,!entry.source.isEmpty(),entry.pending);
    }
    public static void blit(GuiGraphics g,String id,String url,int x,int y,int pixels){
        if(pixels<=0)return;
        ResourceLocation portrait=texture(id,url);
        // Matching region/texture dimensions sample the full native image at any GUI size.
        RenderSystem.enableBlend();
        RenderSystem.defaultBlendFunc();
        try{g.blit(portrait,x,y,0,0,pixels,pixels,pixels,pixels);}
        finally{RenderSystem.disableBlend();}
    }
    public static ResourceLocation texture(String id,String url){
        RenderSystem.assertOnRenderThread();
        Entry cached=CACHE.get(id);
        if(cached==null){
            cached=new Entry(register(fallback(id),true));CACHE.put(id,cached);
            if(CACHE.size()>MAX_ENTRIES){String oldest=CACHE.keySet().iterator().next();Minecraft.getInstance().getTextureManager().release(CACHE.remove(oldest).texture);}
        }
        String requested=valid(url)?url:"";
        if(!requested.equals(cached.requested)){cached.requested=requested;cached.failures=0;cached.retryAt=0;}
        if(!requested.isEmpty()&&!requested.equals(cached.source)&&!cached.pending&&pending<MAX_PENDING&&
            (cached.failures==0||System.nanoTime()-cached.retryAt>=0)){
            Entry entry=cached;entry.pending=true;pending++;
            try{IO.execute(()->fetch(id,entry,requested));}
            catch(RejectedExecutionException ex){entry.pending=false;pending--;}
        }
        return cached.texture;
    }
    private static NativeImage fallback(String id){
        NativeImage image=new NativeImage(FALLBACK_SIZE,FALLBACK_SIZE,false);
        int background=0xFF000000|((id.hashCode()&0x7F7F7F)+0x505050);
        // Draw the familiar native face directly at its own resolution, then mask its edge.
        for(int y=0;y<FALLBACK_SIZE;y++)for(int x=0;x<FALLBACK_SIZE;x++){
            int color=background;
            if(x>=24&&x<104&&y>=32&&y<104)color=0xFF9AC8EC;
            if(y>=56&&y<64&&(x>=40&&x<48||x>=80&&x<88))color=0xFF151515;
            if(x>=48&&x<80&&y>=80&&y<88)color=0xFF293E74;
            image.setPixelRGBA(x,y,AvatarMask.apply(color,x,y,FALLBACK_SIZE));
        }
        return image;
    }
    private static void mask(NativeImage image){
        int size=image.getWidth();
        for(int y=0;y<size;y++)for(int x=0;x<size;x++)
            image.setPixelRGBA(x,y,AvatarMask.apply(image.getPixelRGBA(x,y),x,y,size));
    }
    private static void fetch(String id,Entry entry,String source){
        Downloaded image=null;
        try{image=download(source);}
        catch(InterruptedException ex){Thread.currentThread().interrupt();}
        catch(Exception ex){/* Keep the existing portrait until a bounded retry succeeds. */}
        Downloaded ready=image;
        try{Minecraft.getInstance().execute(()->finish(id,entry,source,ready));}
        catch(RejectedExecutionException ex){if(ready!=null)ready.image.close();}
    }
    private static Downloaded download(String source)throws Exception{
        // Use the supplied signed URL verbatim. The deadline includes the complete response body.
        var request=HttpRequest.newBuilder(URI.create(source)).timeout(Duration.ofSeconds(8)).GET().build();
        var future=HTTP.sendAsync(request,info->limitedBody());
        byte[] bytes;
        try{
            var response=future.get(8,TimeUnit.SECONDS);
            if(response.statusCode()!=200)throw new IOException("Avatar HTTP "+response.statusCode());
            bytes=response.body();
        }finally{if(!future.isDone())future.cancel(true);}
        ByteBuffer buffer=MemoryUtil.memAlloc(bytes.length);
        try(MemoryStack stack=MemoryStack.stackPush()){
            buffer.put(bytes).flip();
            var width=stack.mallocInt(1);var height=stack.mallocInt(1);var channels=stack.mallocInt(1);
            // Inspect dimensions before STB allocates decoded native pixels.
            if(!STBImage.stbi_info_from_memory(buffer,width,height,channels)||!validDimensions(width.get(0),height.get(0)))
                throw new IOException("Invalid avatar dimensions");
            try(NativeImage decoded=NativeImage.read(buffer)){
                int side=Math.min(decoded.getWidth(),decoded.getHeight()),size=Math.min(side,MAX_TEXTURE_SIZE);
                NativeImage portrait=new NativeImage(size,size,false);
                try{
                    decoded.resizeSubRectTo((decoded.getWidth()-side)/2,(decoded.getHeight()-side)/2,side,side,portrait);
                    mask(portrait);
                    return new Downloaded(portrait,decoded.getWidth(),decoded.getHeight());
                }catch(Exception ex){portrait.close();throw ex;}
            }
        }finally{MemoryUtil.memFree(buffer);}
    }
    private static boolean validDimensions(int width,int height){return width>0&&height>0&&width<=MAX_SOURCE_SIZE&&height<=MAX_SOURCE_SIZE;}
    private static HttpResponse.BodySubscriber<byte[]> limitedBody(){
        var body=HttpResponse.BodySubscribers.ofByteArray();
        return new HttpResponse.BodySubscriber<>(){
            private Flow.Subscription subscription;
            private long received;
            private boolean done;
            public CompletionStage<byte[]> getBody(){return body.getBody();}
            public void onSubscribe(Flow.Subscription value){subscription=value;body.onSubscribe(value);}
            public void onNext(List<ByteBuffer> buffers){
                if(done)return;
                for(ByteBuffer buffer:buffers)received+=buffer.remaining();
                if(received>MAX_BYTES){done=true;subscription.cancel();body.onError(new IOException("Avatar too large"));}
                else body.onNext(buffers);
            }
            public void onError(Throwable error){if(!done){done=true;body.onError(error);}}
            public void onComplete(){if(!done){done=true;body.onComplete();}}
        };
    }
    private static void finish(String id,Entry entry,String source,Downloaded ready){
        RenderSystem.assertOnRenderThread();pending--;entry.pending=false;
        try{
            if(CACHE.get(id)!=entry||!source.equals(entry.requested))return;
            if(ready==null){failed(entry);return;}
            ResourceLocation location;
            try{location=register(ready.image,true);}
            catch(RuntimeException ex){failed(entry);return;}
            entry.sourceWidth=ready.sourceWidth;entry.sourceHeight=ready.sourceHeight;entry.texturePixels=ready.image.getWidth();
            ready=null;
            ResourceLocation old=entry.texture;entry.texture=location;entry.source=source;entry.failures=0;
            Minecraft.getInstance().getTextureManager().release(old);
        }finally{if(ready!=null)ready.image.close();}
    }
    private static void failed(Entry entry){
        entry.failures=Math.min(6,entry.failures+1);
        entry.retryAt=System.nanoTime()+retryDelay(entry.failures);
    }
    private static long retryDelay(int failures){return TimeUnit.SECONDS.toNanos(Math.min(300,15L<<Math.min(5,Math.max(0,failures-1))));}
    private static ResourceLocation register(NativeImage image,boolean filtered){
        DynamicTexture texture=null;ResourceLocation location=null;
        try{
            texture=new DynamicTexture(image);
            location=Minecraft.getInstance().getTextureManager().register("snake_avatar",texture);
            // Upload/registration may reset filtering, so set it after registration.
            texture.setFilter(filtered,false);
            return location;
        }catch(RuntimeException ex){
            if(location!=null)Minecraft.getInstance().getTextureManager().release(location);
            else if(texture!=null)texture.close();
            else image.close();
            throw ex;
        }
    }
    private static boolean valid(String source){
        if(source==null||source.length()>8192)return false;
        try{URI uri=URI.create(source);String host=uri.getHost();if(host==null)return false;host=host.toLowerCase(Locale.ROOT);
            return "https".equalsIgnoreCase(uri.getScheme())&&uri.getUserInfo()==null&&(uri.getPort()==-1||uri.getPort()==443)&&uri.getFragment()==null&&
            (host.endsWith(".tiktokcdn.com")||host.endsWith(".tiktokcdn-us.com")||host.endsWith(".tiktokcdn-eu.com")||host.endsWith(".byteoversea.com")||host.endsWith(".ibytedtos.com")||host.endsWith(".muscdn.com"));}catch(Exception ex){return false;}
    }
}
