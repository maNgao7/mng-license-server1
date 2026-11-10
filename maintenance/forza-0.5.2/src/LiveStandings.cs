using Il2CppInterop.Runtime.InteropTypes.Arrays;
using UnityEngine;

namespace TikMnG.Arcade;

public sealed partial class ArcadeDirector
{
    private Texture2D standingsCrown;
    private void DrawLiveStandings()
    {
        if(entries.Count==0)return;
        var ordered=entries.Where(IsCarAlive)
            .OrderBy(e=>Running?(RacePlace(e)>0?RacePlace(e):int.MaxValue):e.Slot).ThenBy(e=>e.Slot).Take(10).ToArray();
        const float x=14,y=164,width=180,rowHeight=27;
        Fill(new Rect(x,y,width,27+ordered.Length*rowHeight),new Color(.045f,.075f,.09f,.80f));
        Fill(new Rect(x,y,2,27+ordered.Length*rowHeight),new Color(.40f,.86f,.79f,.75f));
        var style=new GUIStyle(hudCaption){alignment=TextAnchor.MiddleLeft,fontSize=9,fontStyle=FontStyle.Normal};
        style.normal.textColor=new Color(.66f,.86f,.88f);
        GUI.Label(new Rect(x+11,y+3,width-20,20),Running?"CANLI SIRALAMA  ·  İLK 10":"BAŞLANGIÇ  ·  İLK 10",style);
        for(var i=0;i<ordered.Length;i++)
        {
            var entry=ordered[i];var top=y+27+i*rowHeight;
            if(i==0)Fill(new Rect(x+2,top,width-2,rowHeight),new Color(.66f,.47f,.13f,.23f));
            else if(entry==followed)Fill(new Rect(x+2,top,width-2,rowHeight),new Color(.26f,.65f,.64f,.18f));
            if(i>0)Fill(new Rect(x+10,top,width-20,1),new Color(.65f,.80f,.83f,.10f));
            style.fontSize=10;style.alignment=TextAnchor.MiddleCenter;
            style.normal.textColor=i==0?new Color(1,.81f,.38f):new Color(.64f,.74f,.78f);
            GUI.Label(new Rect(x+4,top,17,rowHeight),(i+1).ToString("00"),style);
            DrawPortrait(entry,new Rect(x+28,top+4,19,19));
            if(i==0)DrawStandingsCrown(new Rect(x+31,top-3,13,9));
            style.fontSize=11;style.alignment=TextAnchor.MiddleLeft;
            style.normal.textColor=new Color(.95f,.97f,.98f);
            var name=entry.Username.TrimStart('@');
            while(style.fontSize>8&&style.CalcSize(new GUIContent(name)).x>122)style.fontSize--;
            GUI.Label(new Rect(x+55,top,122,rowHeight),name,style);
        }
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
