using Il2CppInterop.Runtime.InteropTypes.Arrays;
using UnityEngine;

namespace TikMnG.Arcade;

public sealed partial class ArcadeDirector
{
    private Texture2D standingsCrown;
    private Texture2D standingsBackground;
    private GUIStyle standingsText;
    private readonly Dictionary<ViewerCar,(float From,int Rank,float Since)> standingsMotion=new();
    private void DrawLiveStandings()
    {
        if(entries.Count==0||Event.current.type!=EventType.Repaint)return;
        var ordered=entries.Where(IsCarAlive)
            .OrderBy(e=>Running?(RacePlace(e)>0?RacePlace(e):int.MaxValue):e.Slot).ThenBy(e=>e.Slot).Take(10).ToArray();
        const float x=17,y=159,width=226,rowHeight=28;
        if(standingsBackground==null)standingsBackground=CreateStandingsBackground();
        GUI.DrawTexture(new Rect(x,y,width,30+ordered.Length*rowHeight),standingsBackground,ScaleMode.StretchToFill,true);
        var style=standingsText??=new GUIStyle(hudCaption){fontStyle=FontStyle.Normal,clipping=TextClipping.Clip};
        style.alignment=TextAnchor.MiddleLeft;
        style.fontSize=10;style.fontStyle=FontStyle.Bold;
        style.normal.textColor=new Color(.90f,.96f,.98f);
        Fill(new Rect(x+10,y+11,4,4),new Color(.46f,.90f,.84f));
        GUI.Label(new Rect(x+19,y+2,126,21),Running?"CANLI SIRALAMA":"BAŞLANGIÇ",style);
        style.fontSize=9;style.fontStyle=FontStyle.Normal;
        style.normal.textColor=new Color(.69f,.83f,.88f);
        style.alignment=TextAnchor.MiddleCenter;
        GUI.Label(new Rect(x+148,y+2,35,21),"TUR",style);
        GUI.Label(new Rect(x+185,y+2,37,21),"KALAN",style);
        Fill(new Rect(x+9,y+25,width-18,1),new Color(.57f,.78f,.83f,.24f));
        var now=Time.unscaledTime;
        var data=CircuitSuperstars.RaceManager.Instance?.RacerData;
        for(var i=ordered.Length-1;i>=0;i--)
        {
            var entry=ordered[i];
            if(!standingsMotion.TryGetValue(entry,out var motion))motion=(i,i,now);
            if(motion.Rank!=i)motion=(AnimatedRank(motion,now),i,now);
            standingsMotion[entry]=motion;
            var rank=AnimatedRank(motion,now);
            var top=y+28+rank*rowHeight;
            var moving=Mathf.Abs(rank-i)>.08f;
            if(i==0||entry==followed||moving)
            {
                var highlight=i==0?new Color(.68f,.48f,.20f,.26f):new Color(.10f,.48f,.51f,.34f);
                Fill(new Rect(x+5,top,width-10,rowHeight-1),highlight);
                Fill(new Rect(x+5,top+4,2,rowHeight-9),i==0?new Color(1,.77f,.40f):new Color(.40f,.86f,.79f));
            }
            if(i>0&&!moving)Fill(new Rect(x+11,top,width-22,1),new Color(.57f,.78f,.83f,.11f));
            style.fontSize=12;style.alignment=TextAnchor.MiddleCenter;
            style.normal.textColor=i==0?new Color(1,.81f,.38f):new Color(.64f,.74f,.78f);
            GUI.Label(new Rect(x+9,top,17,rowHeight),(i+1).ToString(),style);
            DrawPortrait(entry,new Rect(x+32,top+4,20,20));
            if(i==0)DrawStandingsCrown(new Rect(x+35,top-1,14,8));
            style.fontSize=12;style.fontStyle=FontStyle.Bold;style.alignment=TextAnchor.MiddleLeft;
            style.normal.textColor=new Color(.95f,.97f,.98f);
            var name=entry.Username.TrimStart('@');
            while(style.fontSize>8&&style.CalcSize(new GUIContent(name)).x>88)style.fontSize--;
            GUI.Label(new Rect(x+58,top,89,rowHeight),name,style);
            var completed=data?.IsFinished(entry.Id)==true?settings.Laps:Running?CurrentLap(entry)-1:0;
            style.fontSize=11;style.fontStyle=FontStyle.Normal;
            style.normal.textColor=new Color(.70f,.91f,.92f);
            style.alignment=TextAnchor.MiddleCenter;
            GUI.Label(new Rect(x+148,top,35,rowHeight),completed+"/"+settings.Laps,style);
            GUI.Label(new Rect(x+185,top,37,rowHeight),(settings.Laps-completed).ToString(),style);
        }
    }
    private static Texture2D CreateStandingsBackground()
    {
        const int size=128,radius=5;
        var pixels=new Color32[size*size];
        for(var y=0;y<size;y++)for(var x=0;x<size;x++)
        {
            var dx=x-Math.Clamp(x,radius,size-radius-1);
            var dy=y-Math.Clamp(y,radius,size-radius-1);
            if(dx*dx+dy*dy>radius*radius)continue;
            pixels[y*size+x]=new Color32(8,16,25,(byte)Mathf.Lerp(241,211,x/(float)(size-1)));
        }
        var background=new Texture2D(size,size,TextureFormat.RGBA32,false){filterMode=FilterMode.Bilinear};
        background.SetPixels32(new Il2CppStructArray<Color32>(pixels));background.Apply(false,true);
        return background;
    }
    private static float AnimatedRank((float From,int Rank,float Since) motion,float now)
    {
        var t=1-Mathf.Clamp01((now-motion.Since)/.32f);
        return Mathf.Lerp(motion.From,motion.Rank,1-t*t*t);
    }
    private void DrawStandingsCrown(Rect rect)
    {
        if(standingsCrown==null)
        {
            const int width=64,height=40;
            var pixels=new Color32[width*height];
            var polygon=new[]{new Vector2(6,6),new Vector2(1,33),new Vector2(20,23),new Vector2(32,39),new Vector2(44,23),new Vector2(63,33),new Vector2(58,6)};
            for(var y=0;y<height;y++)for(var x=0;x<width;x++)
            {
                var inside=false;
                for(int i=0,j=polygon.Length-1;i<polygon.Length;j=i++)
                {
                    var a=polygon[i];var b=polygon[j];
                    if((a.y>y)!=(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
                }
                if(inside)pixels[y*width+x]=new Color32(255,(byte)(177+y),58,255);
            }
            standingsCrown=new Texture2D(width,height,TextureFormat.RGBA32,false){filterMode=FilterMode.Bilinear};
            standingsCrown.SetPixels32(new Il2CppStructArray<Color32>(pixels));standingsCrown.Apply(false,true);
        }
        GUI.DrawTexture(rect,standingsCrown,ScaleMode.ScaleToFit,true);
    }
}
