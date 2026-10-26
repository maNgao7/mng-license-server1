package com.tikmng.snake;

/** Persistable rules also used by the standalone simulation tests. */
public class ArenaRules {
    public int arenaSize=150,likesPerJoin=100,likesPerGrowth=100,minimumPlayers=2;
    public double coinsToMass=25,multiplier1=.8,multiplier50=1.5,multiplier100=1.7,multiplier500=2,multiplier1000=2.5;
    public double followMass=300,likeEntryMass=250,likeGrowthMass=150,giftEntryMass=200,protectionSeconds=8;
    public double profileScale=1.4,musicVolume=.22,effectsVolume=.65;
    public boolean joinOnFollow=true;
    public boolean showSnakes=true,showWins=true;
    public double multiplier(double coins){return coins>=1000?multiplier1000:coins>=500?multiplier500:coins>=100?multiplier100:coins>=50?multiplier50:multiplier1;}
    public double giftMass(double coins,int count){
        if(!Double.isFinite(coins)||coins<=0||count<=0)return 0;
        return Math.min(1000000,Math.round(Math.min(100000,coins)*coinsToMass*multiplier(coins))*Math.min(10000,count));
    }
    public void sanitize(){
        joinOnFollow=true;
        arenaSize=Math.max(32,Math.min(1000,arenaSize));minimumPlayers=2;
        likesPerJoin=Math.max(1,Math.min(100000,likesPerJoin));likesPerGrowth=Math.max(1,Math.min(100000,likesPerGrowth));
        coinsToMass=range(coinsToMass,0,1000,25);
        multiplier1=range(multiplier1,0,20,.8);multiplier50=range(multiplier50,0,20,1.5);multiplier100=range(multiplier100,0,20,1.7);
        multiplier500=range(multiplier500,0,20,2);multiplier1000=range(multiplier1000,0,20,2.5);
        followMass=range(followMass,10,1000000,300);likeEntryMass=range(likeEntryMass,10,1000000,250);
        likeGrowthMass=range(likeGrowthMass,0,1000000,150);giftEntryMass=range(giftEntryMass,10,1000000,200);
        protectionSeconds=range(protectionSeconds,0,60,8);profileScale=range(profileScale,.75,2.5,1.4);
        musicVolume=range(musicVolume,0,1,.22);effectsVolume=range(effectsVolume,0,1,.65);
    }
    private static double range(double n,double min,double max,double fallback){return Double.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
}
