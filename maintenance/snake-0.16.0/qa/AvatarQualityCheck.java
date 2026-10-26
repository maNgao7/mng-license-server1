import java.io.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.regex.Pattern;
import javax.tools.*;

/** Offline source-mode QA: java qa/AvatarQualityCheck.java. No game, network, or class/JAR output. */
public class AvatarQualityCheck {
    private static String method(String source,String name){
        var match=Pattern.compile("(?m)^    private static [^\\r\\n]*\\b"+name+"\\(").matcher(source);
        if(!match.find())throw new AssertionError("Missing production method: "+name);
        int start=match.start(),open=source.indexOf('{',match.end()),depth=1,end=open+1;
        for(;depth>0&&end<source.length();end++){
            if(source.charAt(end)=='{')depth++;
            if(source.charAt(end)=='}')depth--;
        }
        if(depth!=0)throw new AssertionError("Unclosed method: "+name);
        return source.substring(start,end);
    }
    private static JavaFileObject unit(String name,String source){
        return new SimpleJavaFileObject(URI.create("string:///"+name.replace('.','/')+".java"),JavaFileObject.Kind.SOURCE){
            public CharSequence getCharContent(boolean ignoreEncodingErrors){return source;}
        };
    }
    private static void require(boolean value,String label){if(!value)throw new AssertionError(label);}
    public static void main(String[] args)throws Exception{
        Path root=Path.of("").toAbsolutePath().normalize();
        Path sources=root.resolve("mod/src/main/java/com/tikmng/snake");
        String avatars=Files.readString(sources.resolve("SnakeAvatars.java"));
        String labels=Files.readString(sources.resolve("SnakeLabels.java"));
        require(avatars.contains("HttpRequest.newBuilder(URI.create(source))"),"supplied signed URL used directly");
        require(avatars.contains("followRedirects(HttpClient.Redirect.NEVER)"),"no redirects outside allowlist");
        require(avatars.contains("future.get(8,TimeUnit.SECONDS)")&&avatars.contains("future.cancel(true)"),"whole-body deadline and cancellation");
        require(avatars.indexOf("STBImage.stbi_info_from_memory")<avatars.indexOf("NativeImage.read(buffer)"),"preflight before native decode");
        require(avatars.contains("size=Math.min(side,MAX_TEXTURE_SIZE)"),"no fabricated source upscaling");
        require(avatars.contains("CACHE.get(id)!=entry||!source.equals(entry.requested)"),"stale/evicted entry guard");
        String finish=method(avatars,"finish"),register=method(avatars,"register");
        require(finish.indexOf("CACHE.get(id)!=entry")<finish.indexOf("register(ready.image,true)"),"discard stale pixels before GPU registration");
        require(finish.contains("finally{if(ready!=null)ready.image.close();}"),"discarded native images released");
        require(register.indexOf(".register(\"snake_avatar\",texture)")<register.indexOf("texture.setFilter(filtered,false)"),"photo filtering survives registration");
        require(avatars.contains("new ArrayBlockingQueue<>(MAX_PENDING-2)")&&avatars.contains("pending<MAX_PENDING"),"bounded pending work");
        require(!avatars.contains("CallerRunsPolicy"),"downloads never fall back to rendering thread");
        require(avatars.contains("public record Diagnostics(int sourceWidth,int sourceHeight,int texturePixels"),"native source diagnostics");
        require(labels.contains("SnakeAvatars.blit(g,"),"shared native portrait blit");

        var constant=Pattern.compile("(?m)^    private static final int MAX_ENTRIES=.*;").matcher(avatars);
        require(constant.find(),"production limits");
        String policy="import java.io.*;import java.net.*;import java.net.http.*;import java.nio.*;import java.util.*;import java.util.concurrent.*;\npublic class AvatarPolicyCheck {\n"+constant.group()+"\n";
        for(String name:List.of("valid","validDimensions","retryDelay","limitedBody"))policy+=method(avatars,name)+"\n";
        policy+=POLICY_TESTS+"\n}";
        var units=new ArrayList<JavaFileObject>();
        units.add(unit("AvatarPolicyCheck",policy));
        for(String name:List.of("ArenaLabels","ArenaSpace"))units.add(unit("com.tikmng.snake."+name,Files.readString(sources.resolve(name+".java"))));
        units.add(unit("LabelsCheck",Files.readString(root.resolve("qa/LabelsCheck.java"))));

        JavaCompiler compiler=ToolProvider.getSystemJavaCompiler();
        require(compiler!=null,"Run with JDK 17 or later");
        var diagnostics=new DiagnosticCollector<JavaFileObject>();
        var output=new HashMap<String,ByteArrayOutputStream>();
        try(var manager=new ForwardingJavaFileManager<StandardJavaFileManager>(compiler.getStandardFileManager(diagnostics,Locale.ROOT,StandardCharsets.UTF_8)){
            public JavaFileObject getJavaFileForOutput(Location location,String name,JavaFileObject.Kind kind,FileObject sibling){
                return new SimpleJavaFileObject(URI.create("memory:///"+name.replace('.','/')+kind.extension),kind){
                    public OutputStream openOutputStream(){var bytes=new ByteArrayOutputStream();output.put(name,bytes);return bytes;}
                };
            }
        }){
            if(!compiler.getTask(null,manager,diagnostics,List.of("-proc:none","--release","17"),null,units).call())
                throw new AssertionError(diagnostics.getDiagnostics());
        }
        var loader=new ClassLoader(AvatarQualityCheck.class.getClassLoader()){
            protected Class<?> findClass(String name)throws ClassNotFoundException{
                var bytes=output.get(name);if(bytes==null)throw new ClassNotFoundException(name);
                byte[] value=bytes.toByteArray();return defineClass(name,value,0,value.length);
            }
        };
        loader.loadClass("AvatarPolicyCheck").getMethod("run").invoke(null);
        loader.loadClass("LabelsCheck").getMethod("main",String[].class).invoke(null,(Object)new String[0]);
        System.out.println("Source guards passed: URL/deadline/preflight/stale-entry/bounds/diagnostics/blit. Native rendering is not exercised.");
    }
    private static final String POLICY_TESTS="""
        private static int checks;
        private static void check(boolean value,String label){checks++;if(!value)throw new AssertionError(label);}
        private static final class Subscription implements Flow.Subscription {
            boolean cancelled;
            public void request(long count){}
            public void cancel(){cancelled=true;}
        }
        public static void run()throws Exception{
            check(MAX_ENTRIES==128&&MAX_PENDING==8&&MAX_BYTES==4*1024*1024&&MAX_SOURCE_SIZE==2048&&MAX_TEXTURE_SIZE==256,"deliberate limits");
            for(String host:List.of("p16.tiktokcdn.com","p16.tiktokcdn-us.com","p16.tiktokcdn-eu.com","p16.byteoversea.com","p16.ibytedtos.com","p16.muscdn.com"))
                check(valid("https://"+host+"/avatar~source.jpeg?x-signature=a%2Bb%3D&size=720"),"allowed supplied URL");
            check(valid("HTTPS://P16.TIKTOKCDN.COM:443/avatar.jpeg?signature=a%2Fb"),"HTTPS case and default TLS port");
            for(String value:new String[]{null,"","https://p16.tiktokcdn.com/"+"a".repeat(8192),"http://p16.tiktokcdn.com/a","https://p16.tiktokcdn.com:444/a",
                "https://p16.tiktokcdn.com.evil.example/a","https://eviltiktokcdn.com/a","https://127.0.0.1/a","https://[::1]/a","file:///a",
                "//p16.tiktokcdn.com/a","https://user@p16.tiktokcdn.com/a","https://p16.tiktokcdn.com@evil.example/a","https://p16.tiktokcdn.com/a#fragment","not a URI"})
                check(!valid(value),"rejected avatar URL");
            check(validDimensions(2048,2048)&&validDimensions(1,1)&&validDimensions(720,1280),"bounded actual source dimensions");
            for(int[] size:new int[][]{{0,256},{256,0},{-1,256},{2049,1},{1,2049},{Integer.MAX_VALUE,Integer.MAX_VALUE}})
                check(!validDimensions(size[0],size[1]),"unsafe dimensions rejected before decode");
            int[] failures={0,1,2,3,4,5,6,99},seconds={15,15,30,60,120,240,300,300};
            for(int i=0;i<failures.length;i++)check(retryDelay(failures[i])==TimeUnit.SECONDS.toNanos(seconds[i]),"bounded retry backoff");

            var body=limitedBody();var subscription=new Subscription();body.onSubscribe(subscription);
            body.onNext(List.of(ByteBuffer.wrap(new byte[]{9,1,2,9}).position(1).limit(3),ByteBuffer.wrap(new byte[]{3})));
            body.onComplete();
            check(Arrays.equals(body.getBody().toCompletableFuture().get(1,TimeUnit.SECONDS),new byte[]{1,2,3})&&!subscription.cancelled,"exact body bytes retained");
            body=limitedBody();subscription=new Subscription();body.onSubscribe(subscription);
            body.onNext(List.of(ByteBuffer.allocate(MAX_BYTES)));body.onComplete();
            check(body.getBody().toCompletableFuture().get(1,TimeUnit.SECONDS).length==MAX_BYTES,"exact body limit accepted");
            body=limitedBody();subscription=new Subscription();body.onSubscribe(subscription);
            body.onNext(List.of(ByteBuffer.allocate(MAX_BYTES),ByteBuffer.allocate(1)));body.onComplete();
            check(subscription.cancelled&&body.getBody().toCompletableFuture().isCompletedExceptionally(),"oversized chunk list cancelled");
            body=limitedBody();subscription=new Subscription();body.onSubscribe(subscription);
            body.onNext(List.of(ByteBuffer.allocate(MAX_BYTES)));body.onNext(List.of(ByteBuffer.allocate(1)));
            check(subscription.cancelled&&body.getBody().toCompletableFuture().isCompletedExceptionally(),"oversized streamed body cancelled");
            System.out.println("Avatar URL/body/dimension/retry checks passed: "+checks);
        }
        """;
}
