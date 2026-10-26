package com.tikmng.snake;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.minecraftforge.fml.loading.FMLPaths;
import java.nio.file.*;
import java.util.*;

public final class SnakeConfig extends ArenaRules {
    public int schemaVersion;
    public String username="";
    public List<ArenaEngine.Winner> leaderboardWins=new ArrayList<>();
    public List<Rule> gifts=new ArrayList<>(List.of(new Rule("5879","Donat","boost",3,7),
        new Rule("5303","Cay","boost",5,7),new Rule("7168","Para Tabancasi","boost",10,7),
        new Rule("11046","Galaksi","galaxy",3,7)));
    public static final class Rule {
        public String giftId,name,action;public double amount,seconds;
        public Rule(String id,String name,String action,double amount,double seconds){this.giftId=id;this.name=name;this.action=action;this.amount=amount;this.seconds=seconds;}
    }
    private static final Gson GSON=new GsonBuilder().setPrettyPrinting().create();
    public static Path path(){return FMLPaths.CONFIGDIR.get().resolve("tikmng-snake-arena.json");}
    public static SnakeConfig load(){
        try{if(Files.exists(path())){SnakeConfig c=GSON.fromJson(Files.readString(path()),SnakeConfig.class);if(c!=null){c.sanitize();return c;}}}catch(Exception ex){System.err.println("Snake settings could not be read; original retained: "+ex.getMessage());}
        SnakeConfig config=new SnakeConfig();config.sanitize();return config;
    }
    @Override public void sanitize(){
        super.sanitize();if(gifts==null)gifts=new ArrayList<>();if(username==null)username="";
        if(leaderboardWins==null)leaderboardWins=new ArrayList<>();
        if(schemaVersion<13){
            arenaSize=150;followMass=300;likesPerJoin=100;likeEntryMass=250;coinsToMass=25;
            multiplier1=multiplier50=multiplier100=multiplier500=multiplier1000=1;
            schemaVersion=13;
        }
        if(schemaVersion<14){
            List<Rule> migrated=new ArrayList<>();
            migrated.add(standardRule("5879","Donat","boost",3));
            migrated.add(standardRule("5303","Cay","boost",5));
            migrated.add(standardRule("7168","Para Tabancasi","boost",10));
            migrated.add(standardRule("11046","Galaksi","galaxy",3));
            Set<String> standardIds=Set.of("5879","5303","7168","11046");
            for(Rule rule:gifts)if(rule==null||!standardIds.contains(rule.giftId==null?"":rule.giftId))migrated.add(rule);
            gifts=migrated;minimumPlayers=2;schemaVersion=14;
        }
        if(schemaVersion<15){
            coinsToMass=25;multiplier1=.8;multiplier50=1.5;multiplier100=1.7;multiplier500=2;multiplier1000=2.5;
            schemaVersion=15;
        }
    }
    private Rule standardRule(String id,String name,String action,double amount){
        // IDs determine identity; translated or older display names must not remap a gift.
        for(Rule rule:gifts)if(rule!=null&&id.equals(rule.giftId)){
            double seconds=Double.isFinite(rule.seconds)&&rule.seconds>0?rule.seconds:7;
            return new Rule(id,rule.name==null||rule.name.isBlank()?name:rule.name,action,amount,seconds);
        }
        return new Rule(id,name,action,amount,7);
    }
    public void save(){
        sanitize();try{Files.createDirectories(path().getParent());Path tmp=path().resolveSibling(path().getFileName()+".tmp");Files.writeString(tmp,GSON.toJson(this));try{Files.move(tmp,path(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}catch(AtomicMoveNotSupportedException ex){Files.move(tmp,path(),StandardCopyOption.REPLACE_EXISTING);}}catch(Exception ex){throw new IllegalStateException("Ayarlar kaydedilemedi",ex);}
    }
}
