package com.tikmng.snake;

import com.google.gson.*;
import net.minecraft.client.Minecraft;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.concurrent.*;

public final class SnakeLive {
    private static final HttpClient HTTP=HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(5)).build();
    private static final ScheduledExecutorService TIMER=Executors.newSingleThreadScheduledExecutor(r->{Thread t=new Thread(r,"snake-live-retry");t.setDaemon(true);return t;});
    public static volatile String status="Yayin hesabi bagli degil",activeUser="";
    public static volatile long eventCount,giftCount,lastEventMillis;
    private static volatile String session="";
    private static volatile WebSocket socket;
    private static int retries;
    private static ScheduledFuture<?> retryTask;
    private static CompletableFuture<Void> control=CompletableFuture.completedFuture(null);
    private static URI base(){return URI.create("http://127.0.0.1:"+Integer.getInteger("mng.bridge.port",43826));}
    private static boolean current(String expected){return expected.equals(session)&&!activeUser.isEmpty();}
    // The bridge's disconnect is global, so HTTP control requests must finish in order.
    private static synchronized CompletableFuture<HttpResponse<Void>> post(String route,JsonObject body,String expected){
        HttpRequest request=HttpRequest.newBuilder(base().resolve(route)).timeout(Duration.ofSeconds(route.equals("/disconnect")?3:8))
            .header("Content-Type","application/json").POST(body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(body.toString())).build();
        CompletableFuture<HttpResponse<Void>> result=control.handle((ignored,error)->null).thenCompose(ignored->{
            if(expected!=null&&!current(expected))return CompletableFuture.completedFuture(null);
            return HTTP.sendAsync(request,HttpResponse.BodyHandlers.discarding());
        });
        control=result.handle((response,error)->null);return result;
    }
    private static synchronized CompletableFuture<HttpResponse<Void>> stop(){
        session="";activeUser="";
        if(retryTask!=null){retryTask.cancel(false);retryTask=null;}
        WebSocket old=socket;socket=null;if(old!=null)old.abort();
        return post("/disconnect",null,null);
    }
    public static synchronized void connect(String username){
        String clean=username.trim().replaceFirst("^@","").toLowerCase(java.util.Locale.ROOT);
        if(!clean.matches("[a-z0-9_.]{2,32}")){status="Gecerli bir kullanici adi yaz";return;}
        CompletableFuture<HttpResponse<Void>> stopped=stop();activeUser=clean;session=java.util.UUID.randomUUID().toString();retries=0;
        eventCount=giftCount=lastEventMillis=0;
        String expected=session;
        SnakeClient.ENGINE.clearDemo();SnakeClient.CONFIG.username=clean;SnakeClient.CONFIG.save();
        status="@"+activeUser+" yayini araniyor";
        stopped.whenComplete((response,error)->{synchronized(SnakeLive.class){
            if(!current(expected))return;
            if(error!=null||response==null||response.statusCode()>=400){retry(expected);return;}
            open(expected);
        }});
    }
    private static synchronized void open(String expected){
        if(!current(expected))return;
        status="@"+activeUser+" yayini araniyor";
        HTTP.newWebSocketBuilder().connectTimeout(Duration.ofSeconds(6)).buildAsync(URI.create(base().toString().replace("http:","ws:")+"/events"),new Events(expected))
            .thenAccept(ws->{synchronized(SnakeLive.class){
                if(!current(expected)){ws.abort();return;}socket=ws;
                JsonObject body=new JsonObject();body.addProperty("username",activeUser);body.addProperty("session",expected);
                post("/connect",body,expected).whenComplete((response,error)->{synchronized(SnakeLive.class){
                    if(!current(expected)||socket!=ws)return;
                    if(error!=null||response==null||response.statusCode()>=500){retry(expected);return;}
                    if(response.statusCode()>=400){socket=null;ws.abort();status="Yayin baglanti istegi reddedildi";}
                }});
            }}).exceptionally(ex->{retry(expected);return null;});
    }
    private static synchronized void retry(String expected){
        if(!current(expected))return;
        WebSocket old=socket;socket=null;if(old!=null)old.abort();
        if(retryTask!=null&&!retryTask.isDone())return;
        status="Baglanti yeniden deneniyor";
        retryTask=TIMER.schedule(()->{synchronized(SnakeLive.class){if(!current(expected))return;retryTask=null;open(expected);}},Math.min(30,2+retries++*3),TimeUnit.SECONDS);
    }
    public static synchronized void disconnect(){
        CompletableFuture<HttpResponse<Void>> stopped=stop();status="Yayin hesabi bagli degil";
        stopped.whenComplete((response,error)->{synchronized(SnakeLive.class){
            if(session.isEmpty()&&(error!=null||response==null||response.statusCode()>=400))status="Yayin servisine erisilemiyor; baglanti kesilemedi";
        }});
    }
    static void receive(String text,String expected){
        if(!expected.equals(session))return;
        try{JsonObject event=JsonParser.parseString(text).getAsJsonObject();
            if(!expected.equals(value(event,"session")))return;
            Minecraft.getInstance().execute(()->{if(expected.equals(session))apply(event);});
        }catch(RuntimeException ignored){}
    }
    static void apply(JsonObject event){
        String type=value(event,"type");
        if(type.equals("status")){if(value(event,"state").equals("connected")){synchronized(SnakeLive.class){retries=0;}}status=value(event,"message");return;}
        if(!activeUser.equalsIgnoreCase(value(event,"streamer")))return;
        eventCount++;lastEventMillis=System.currentTimeMillis();
        ArenaEngine engine=SnakeClient.ENGINE;SnakeConfig config=SnakeClient.CONFIG;
        String user=value(event,"username"),profile=value(event,"profile");
        if(user.isBlank())return;
        if(type.equals("profile")){var snake=engine.snakes.get(user.toLowerCase(java.util.Locale.ROOT));if(snake!=null&&!profile.isBlank())snake.profile=profile;return;}
        if(!engine.accept(value(event,"dispatchId")))return;
        int count=Math.max(0,Math.min(10000,integer(event,"count",1)));if(count==0)return;
        if(type.equals("gift")){
            giftCount++;
            double coins=Math.max(0,Math.min(100000,integer(event,"coins",0)));
            engine.gift(user,user,profile,coins,count);
            for(SnakeConfig.Rule rule:config.gifts)if(rule!=null&&value(event,"giftId").equals(rule.giftId)){engine.action(user,user,profile,rule.action,rule.amount*(rule.action.equals("grow")?count:1),rule.seconds);break;}
        }else if(type.equals("follow")){
            engine.followed(user,user,profile);
        }else if(type.equals("like")){
            engine.liked(user,user,profile,count);
        }
    }
    private static String value(JsonObject e,String key){try{return e.get(key).getAsString();}catch(Exception ex){return "";}}
    private static int integer(JsonObject e,String key,int fallback){try{return e.get(key).getAsInt();}catch(Exception ex){return fallback;}}
    private static final class Events implements WebSocket.Listener {
        private final String expected;private final StringBuilder text=new StringBuilder();
        Events(String expected){this.expected=expected;}
        public void onOpen(WebSocket ws){ws.request(1);}
        public CompletionStage<?> onText(WebSocket ws,CharSequence part,boolean last){
            if(ws!=socket){ws.request(1);return null;}
            text.append(part);if(text.length()>65536){ws.abort();retry(expected);return null;}
            if(last){receive(text.toString(),expected);text.setLength(0);}ws.request(1);return null;
        }
        public CompletionStage<?> onClose(WebSocket ws,int code,String reason){if(ws==socket)retry(expected);return null;}
        public void onError(WebSocket ws,Throwable error){if(ws==socket)retry(expected);}
    }
}
