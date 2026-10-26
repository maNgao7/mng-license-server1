package com.tikmng.snake;

import com.google.gson.*;
import net.minecraft.client.Minecraft;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;

final class SnakeWidgets {
    private static final HttpClient HTTP=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
    static String sizeURL="",winsURL="",status="Widget servisi bekleniyor";
    static boolean secure;
    private static boolean busy;
    private static int ticks;
    private static URI endpoint(String route){return URI.create("http://127.0.0.1:"+Integer.getInteger("mng.snake.widget.port",0)+route+"?key="+System.getProperty("mng.snake.widget.key",""));}
    static void tick(){
        if(++ticks%20!=0||busy||Integer.getInteger("mng.snake.widget.port",0)==0)return;
        JsonObject state=new JsonObject();JsonArray snakes=new JsonArray(),winners=new JsonArray();
        for(var s:SnakeClient.ENGINE.snakes.values()){JsonObject row=new JsonObject();row.addProperty("id",s.id);row.addProperty("name",s.name);row.addProperty("profile",s.profile);row.addProperty("mass",s.mass);row.addProperty("wins",s.wins);snakes.add(row);}
        for(var w:SnakeClient.ENGINE.winners()){JsonObject row=new JsonObject();row.addProperty("id",w.id());row.addProperty("name",w.name());row.addProperty("profile",w.profile());row.addProperty("wins",w.wins());winners.add(row);}
        state.add("snakes",snakes);state.add("winners",winners);busy=true;
        HTTP.sendAsync(HttpRequest.newBuilder(endpoint("/snapshot")).timeout(Duration.ofSeconds(3)).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(state.toString())).build(),HttpResponse.BodyHandlers.discarding())
            .thenCompose(r->HTTP.sendAsync(HttpRequest.newBuilder(endpoint("/status")).timeout(Duration.ofSeconds(3)).GET().build(),HttpResponse.BodyHandlers.ofString()))
            .whenComplete((r,error)->Minecraft.getInstance().execute(()->{
                busy=false;if(error!=null){status="Widget servisine ulasilamiyor";return;}
                try{var result=JsonParser.parseString(r.body()).getAsJsonObject();sizeURL=result.get("sizeURL").getAsString();winsURL=result.get("winsURL").getAsString();secure=result.get("secure").getAsBoolean();status=result.get("message").getAsString();}catch(Exception ex){status="Widget yaniti gecersiz";}
            }));
    }
}
