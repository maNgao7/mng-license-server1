using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    GUIStyle cageCountdownStyle;
    float CageSeconds {get{return Mathf.Max(0,jailUntil-Time.unscaledTime);}}
    string ReduceCageTime(float seconds){
      if(!cage||!Jailed)return "Araç zaten serbest.";
      jailUntil=Time.unscaledTime+Mathf.Max(0,CageSeconds-seconds);
      if(CageSeconds<=0){jailUntil=0;ReleaseCage();return "Kafes süresi bitti; araç serbest.";}
      return "Kafesten "+seconds.ToString("0.#")+" saniye düşüldü · Kalan "+Mathf.CeilToInt(CageSeconds)+" sn";
    }
    void DrawCageCountdown(){
      if(!cage||!Jailed||menuOpen)return;
      var manager=Get<GameManager>(car,"gameManager");var camera=manager&&manager.camControl?Get<Camera>(manager.camControl,"cam"):null;
      if(!camera)return;
      Vector3 point=camera.WorldToScreenPoint(cage.transform.position+Vector3.up*4.3f);
      if(point.z<=0)return;
      PrepareStyles();if(cageCountdownStyle==null){cageCountdownStyle=new GUIStyle(titleStyle){fontSize=26,alignment=TextAnchor.MiddleCenter};cageCountdownStyle.normal.textColor=Color.white;}
      float width=Mathf.Min(360,Screen.width-24),x=Mathf.Clamp(point.x-width/2,12,Screen.width-width-12),y=Mathf.Clamp(Screen.height-point.y-36,150,Screen.height-60);
      HudShadowLabel(new Rect(x,y,width,40),"KAFES · "+Mathf.CeilToInt(CageSeconds)+" sn",cageCountdownStyle,new Color(1,.82f,.22f));
    }
  }
}
