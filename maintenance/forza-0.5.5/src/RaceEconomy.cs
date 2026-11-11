namespace TikMnG.Arcade;

public static class RaceEconomy
{
    public const int MaxCredits=100000000;
    public const float MaximumKph=1500;
    public const float MaximumPhysicalKph=650;
    public const float StartingKph=50;
    public const float MaximumAudienceBonusKph=MaximumKph-StartingKph;
    public const float DefaultGiftSpeed=10;
    public static readonly int[] ModelSpeeds={50,70,80,110,200,300,400,500,700,1000,1500};
    public static int Add(int current,int coins,int multiplier=1)=>(int)Math.Clamp((long)current+(long)Math.Max(0,coins)*Math.Clamp(multiplier,1,10),0,MaxCredits);
    public static int LevelForSpeed(float kph)
    {
        var level=0;
        while(level<ModelSpeeds.Length-1&&kph>=ModelSpeeds[level+1])level++;
        return level;
    }
    public static float GiftSpeedGain(int coins,float strength=DefaultGiftSpeed)=>
        Math.Clamp(coins,0,MaxCredits)*(float.IsFinite(strength)?Math.Clamp(strength,.01f,10):DefaultGiftSpeed);
    public static (int Remainder,int Entries,float Speed) CreditLikes(int remainder,int likes,int threshold,float speedPerThreshold)
    {
        var total=(long)Math.Max(0,remainder)+Math.Max(0,likes);
        var required=Math.Max(1,threshold);
        var batches=(int)Math.Min(int.MaxValue,total/required);
        return ((int)(total%required),batches,AddAudienceSpeed(0,batches*speedPerThreshold));
    }
    public static float AddAudienceSpeed(float current,float bonus)=>
        Math.Clamp(current+bonus,0,MaximumAudienceBonusKph);
    public static float TopSpeed(int upgradeCoins,float strength,float audienceBonus=0)=>
        (float)Math.Clamp(StartingKph+GiftSpeedGain(upgradeCoins,strength)+Math.Max(0,audienceBonus),StartingKph,MaximumKph);
    public static float Power(float kph)=>.65f+1.70f*(1-MathF.Exp(-Math.Max(0,kph-StartingKph)/145));
    public static bool PodiumComplete(int entrants,int finishers)=>entrants>0&&finishers>=Math.Min(entrants,3);
    public static bool ValidFinish(bool nativeFinished,float time,int lap,int target)=>
        nativeFinished&&float.IsFinite(time)&&time>0&&time<86400&&lap>=target;
}
