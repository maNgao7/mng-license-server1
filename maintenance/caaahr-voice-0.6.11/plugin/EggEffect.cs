using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    float eggStart,eggUntil;Texture2D eggTexture;
    void EnsureEggTexture(){
      if(eggTexture)return;const int size=512;eggTexture=new Texture2D(size,size,TextureFormat.RGBA32,false);eggTexture.wrapMode=TextureWrapMode.Clamp;eggTexture.filterMode=FilterMode.Bilinear;
      var pixels=new Color[size*size];
      for(int y=0;y<size;y++)for(int x=0;x<size;x++){
        float u=(x-size*.5f)/(size*.5f),v=(y-size*.54f)/(size*.5f),angle=Mathf.Atan2(v,u),radius=Mathf.Sqrt(u*u+v*v);
        float edge=.66f+.075f*Mathf.Sin(angle*7)+.045f*Mathf.Cos(angle*11)+.025f*Mathf.Sin(angle*19);
        float alpha=Mathf.Clamp01((edge-radius)*140);
        // Uneven lower drips and separate droplets preserve the wet splatter silhouette.
        for(int drip=0;drip<4;drip++){float cx=-.44f+drip*.27f,cy=-.45f-drip%2*.13f;float d=Mathf.Sqrt(Mathf.Pow((u-cx)/(.035f+drip*.003f),2)+Mathf.Pow((v-cy)/(.28f-drip*.03f),2));alpha=Mathf.Max(alpha,Mathf.Clamp01((1-d)*20));}
        for(int drop=0;drop<9;drop++){float a=drop*2.39996f,cx=Mathf.Cos(a)*.86f,cy=Mathf.Sin(a)*.82f;float d=new Vector2(u-cx,v-cy).magnitude;alpha=Mathf.Max(alpha,Mathf.Clamp01((.025f+(drop%3)*.012f-d)*180));}
        float yolk=new Vector2(u*.95f+.04f,v*.94f-.025f).magnitude,blend=Mathf.Clamp01((.285f-yolk)*180);
        Color whitePart=Color.Lerp(new Color(.84f,.89f,.92f),new Color(1,.99f,.96f),Mathf.Clamp01(.75f+v*.4f));
        Color yellow=Color.Lerp(new Color(1,.49f,.015f),new Color(1,.84f,.09f),Mathf.Clamp01(.85f+v*2));
        float shine=Mathf.Clamp01((.12f-new Vector2(u+.1f,v-.13f).magnitude)*12);yellow=Color.Lerp(yellow,new Color(1,.96f,.6f),shine*.75f);
        var color=Color.Lerp(whitePart,yellow,blend);color.a=alpha;pixels[y*size+x]=color;
      }
      eggTexture.SetPixels(pixels);eggTexture.Apply(false,true);
    }
    void DrawEgg(){
      if(!Ready||Time.unscaledTime>=eggUntil||menuOpen)return;EnsureEggTexture();PrepareStyles();
      Color old=GUI.color;float age=Time.unscaledTime-eggStart-1.1f;if(age<0)return;float progress=Mathf.Clamp01(age/.16f),fade=Mathf.Clamp01((eggUntil-Time.unscaledTime)/.4f);
      float width=Mathf.Min(Screen.width*.75f,Screen.height*1.15f)*Mathf.Lerp(.08f,1,progress*progress);
      float x=Screen.width*.5f,y=Screen.height*.49f;
      GUI.color=new Color(1,1,1,fade);GUI.DrawTexture(new Rect(x-width*.5f,y-width*.5f,width,width),eggTexture);GUI.color=old;
    }
    void ReleaseEgg(){if(eggTexture)Destroy(eggTexture);eggTexture=null;}
  }
}
