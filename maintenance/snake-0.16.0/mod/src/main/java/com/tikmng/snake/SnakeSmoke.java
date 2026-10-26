package com.tikmng.snake;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

final class SnakeSmoke {
    private static void check(boolean condition,String label){if(!condition)throw new IllegalStateException("Snake live rules: "+label);}
    private static void advance(ArenaEngine engine){for(int i=0;i<22;i++){engine.food.clear();engine.tick(.05);}}
    private static JsonObject event(String type,String username,String dispatch,int count){
        JsonObject e=new JsonObject();e.addProperty("type",type);e.addProperty("username",username);e.addProperty("streamer","fixture");e.addProperty("dispatchId",dispatch);e.addProperty("count",count);return e;
    }
    static void check(){
        var engine=SnakeClient.ENGINE;engine.reset();SnakeLive.activeUser="fixture";
        var rose=event("gift","RoseViewer","fixture-rose",3);rose.addProperty("coins",1);rose.addProperty("giftId","5655");
        SnakeLive.apply(rose);check(engine.snakes.get("roseviewer").mass==200&&engine.feedings.size()==1,"gift creates food before growth");
        SnakeLive.apply(rose);advance(engine);check(engine.snakes.get("roseviewer").mass==260,"3 roses once after eating");
        SnakeLive.apply(event("like","LikeViewer","fixture-like-1",99));check(!engine.snakes.containsKey("likeviewer"),"99 likes no join");
        SnakeLive.apply(event("like","LikeViewer","fixture-like-2",251));advance(engine);check(engine.snakes.get("likeviewer").mass==550,"350 likes join and growth");
        SnakeLive.apply(event("follow","FollowViewer","fixture-follow",1));check(engine.snakes.get("followviewer").mass==300,"follow join");
        var tea=event("gift","TeaViewer","fixture-tea",1);tea.addProperty("coins",50);tea.addProperty("giftId","5303");SnakeLive.apply(tea);
        var boosted=engine.snakes.get("teaviewer");advance(engine);check(boosted.mass==2075&&boosted.boostMultiplier==5&&boosted.boostUntil>engine.time,"tea growth and speed");
        var gun=event("gift","GunViewer","fixture-gun",1);gun.addProperty("coins",500);gun.addProperty("giftId","7168");SnakeLive.apply(gun);
        check(engine.snakes.get("gunviewer").boostMultiplier==10,"money gun gives 10x speed");
        var stale=event("gift","WrongStreamer","fixture-stale",1);stale.addProperty("streamer","other");SnakeLive.apply(stale);check(!engine.snakes.containsKey("wrongstreamer"),"streamer isolation");
        var profile=event("profile","Unknown","fixture-profile",1);SnakeLive.apply(profile);check(!engine.snakes.containsKey("unknown"),"profile never joins");
        int previous=SnakeClient.CONFIG.arenaSize;SnakeClient.CONFIG.save();SnakeConfig loaded=SnakeConfig.load();check(loaded.arenaSize==previous&&loaded.gifts.size()==SnakeClient.CONFIG.gifts.size(),"settings persistence");
        int ruleCount=loaded.gifts.size();loaded.sanitize();loaded.sanitize();check(loaded.gifts.size()==ruleCount&&loaded.gifts.stream().filter(r->"7168".equals(r.giftId)).count()==1,"migration only adds money gun once");
        double oldTier=SnakeClient.CONFIG.multiplier50,oldEffects=SnakeClient.CONFIG.effectsVolume;int oldStep=SnakeClient.CONFIG.likesPerGrowth;
        SnakeClient.CONFIG.multiplier50=1.9;SnakeClient.CONFIG.effectsVolume=.31;SnakeClient.CONFIG.likesPerGrowth=125;SnakeClient.CONFIG.save();loaded=SnakeConfig.load();
        check(loaded.multiplier50==1.9&&loaded.effectsVolume==.31&&loaded.likesPerGrowth==125,"new settings persistence");
        SnakeClient.CONFIG.multiplier50=oldTier;SnakeClient.CONFIG.effectsVolume=oldEffects;SnakeClient.CONFIG.likesPerGrowth=oldStep;SnakeClient.CONFIG.save();
        var galaxy=event("gift","GalaxyViewer","fixture-galaxy",1);galaxy.addProperty("coins",1000);galaxy.addProperty("giftId","11046");SnakeLive.apply(galaxy);
        check(engine.galaxyActive()&&engine.renderSnakes().size()==engine.snakes.size()*3,"galaxy gift splits every participant");
        SnakeLive.apply(galaxy);check(engine.renderSnakes().size()==engine.snakes.size()*3,"galaxy dispatch deduplicated");
        var migration=new SnakeConfig();migration.schemaVersion=12;migration.arenaSize=120;migration.musicVolume=.37;migration.followMass=250;migration.sanitize();
        check(migration.arenaSize==150&&migration.followMass==300&&migration.likeEntryMass==250&&migration.coinsToMass==25&&migration.giftMass(1000,1)==62500&&migration.musicVolume==.37,"requested defaults migrate without clearing unrelated audio");
        migration.followMass=325;migration.sanitize();check(migration.followMass==325,"migration runs once");
        SnakeLive.activeUser="";engine.reset();System.out.println("MNG_SNAKE_RULES passed=true cases=16");
    }
}
