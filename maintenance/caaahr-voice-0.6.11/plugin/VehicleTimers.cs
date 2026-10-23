using System.Collections.Generic;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    GUIStyle vehicleTimerStyle;
    void DrawVehicleTimers(){
      if(!car||menuOpen||!Ready||trackFinished)return;
      var timers=new List<KeyValuePair<string,float>>();
      if(Jailed)timers.Add(new KeyValuePair<string,float>("KAFES",CageSeconds));
      if(Damaged)timers.Add(new KeyValuePair<string,float>("TOPARLANMA",DamageRemaining));
      else if(WheelMissing)timers.Add(new KeyValuePair<string,float>("LASTİK",WheelRemaining));
      foreach(var effect in new[]{new KeyValuePair<string,float>("TURBO",boostUntil),new KeyValuePair<string,float>("YAVAŞLATMA",slowUntil),new KeyValuePair<string,float>("TERS DİREKSİYON",invertUntil),new KeyValuePair<string,float>("YUMURTA",eggUntil)})if(effect.Value>Time.unscaledTime)timers.Add(new KeyValuePair<string,float>(effect.Key,effect.Value-Time.unscaledTime));
      if(giftMotion&&!motionFinished)timers.Add(new KeyValuePair<string,float>(motionTornado?"HORTUM":motionBackward?"GERİ ROKET":"İTİŞ",Mathf.Max(0,motionDuration-motionAge)));
      if(timers.Count==0)return;
      var manager=Get<GameManager>(car,"gameManager");var camera=manager&&manager.camControl?Get<Camera>(manager.camControl,"cam"):null;if(!camera)return;
      var point=camera.WorldToScreenPoint((cage?cage.transform.position:car.transform.position)+Vector3.up*4.3f);if(point.z<=0)return;
      PrepareStyles();if(vehicleTimerStyle==null){vehicleTimerStyle=new GUIStyle(titleStyle){fontSize=22,alignment=TextAnchor.MiddleCenter};vehicleTimerStyle.normal.textColor=Color.white;}
      float width=Mathf.Min(440,Screen.width-24),height=timers.Count*28,x=Mathf.Clamp(point.x-width/2,12,Screen.width-width-12),y=Mathf.Clamp(Screen.height-point.y-height,155,Mathf.Max(155,Screen.height-height-40));
      for(int i=0;i<timers.Count;i++)HudShadowLabel(new Rect(x,y+i*28,width,28),timers[i].Key+" · "+Mathf.CeilToInt(timers[i].Value)+" sn",vehicleTimerStyle,new Color(1,.86f,.35f));
    }
  }
}
