using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    float roundRestartAt;bool roundAutoDrive,finishPending;int wins;bool winsLoaded;
    int lastFinishTick=-1;GUIStyle finishDigits;
    bool FinishHold {get{return finishPending&&trackFinished&&car;}}
    int WinTarget {get{return draft!=null&&draft.track!=null?Mathf.Clamp(draft.track.winTarget,1,999):30;}}
    void LoadWins(){if(winsLoaded)return;winsLoaded=true;try{int.TryParse(System.IO.File.ReadAllText(System.IO.Path.Combine(dataDir,"wins.txt")),out wins);}catch{wins=0;}}
    void SaveWins(){try{System.IO.Directory.CreateDirectory(dataDir);System.IO.File.WriteAllText(System.IO.Path.Combine(dataDir,"wins.txt"),wins.ToString());}catch(System.Exception error){Logger.LogWarning("Win save: "+error.GetType().Name);}}
    void CancelFinish(){if(!finishPending)return;finishPending=false;LoadWins();wins--;SaveWins();roundRestartAt=Time.unscaledTime;UpdateRoundEnd();notice="Hediye kazanmayı bozdu! Win -1";noticeUntil=Time.unscaledTime+4;}
    Vector3 roundVisualOffset;
    int roundNumber=1;
    GUIStyle winnerTitle,winnerDetail,speedDigits,speedDetail,voicePrompt;
    void DrawVoicePrompt(){
      if(!VoicePromptVisible)return;
      PrepareRaceHud();if(voicePrompt==null)voicePrompt=new GUIStyle(winnerTitle){fontSize=26,wordWrap=true,alignment=TextAnchor.MiddleCenter};
      float alpha=Mathf.SmoothStep(.12f,1,(Mathf.Sin(Time.unscaledTime*5)+1)*.5f);
      float width=Mathf.Min(620,Screen.width-36),height=Screen.width<500?110:70;var area=new Rect((Screen.width-width)/2,Screen.height*.43f,width,height);
      Color previous=GUI.color;GUI.color=new Color(0,0,0,alpha*.8f);GUI.Label(new Rect(area.x+2,area.y+2,area.width,area.height),"İLERLEMEK İÇİN BAĞIR",voicePrompt);GUI.color=new Color(.86f,1,.9f,alpha);GUI.Label(area,"İLERLEMEK İÇİN BAĞIR",voicePrompt);GUI.color=previous;
    }
    bool VoicePromptVisible {get{return enteredGame&&Ready&&!menuOpen&&!startingGame&&!trackFinished&&!autoDrive&&!giftMotion&&!Damaged&&!Jailed&&ActiveVoice.enabled&&voiceDemand<=.01f&&Throttle<=.005f&&DrivingSpeed()<.5f;}}
    void FinishRound(){
      var visual=Get<Transform>(car,"Visual");roundVisualOffset=visual?car.transform.InverseTransformPoint(visual.position):Vector3.zero;if(roundVisualOffset.magnitude>5)roundVisualOffset=Vector3.zero;
      roundAutoDrive=autoDrive;trackFinished=true;finishPending=true;roundRestartAt=Time.unscaledTime+10;lastFinishTick=-1;autoDrive=false;Throttle=0;
      ReleaseCage();ResetEffects();
      var rb=Get<Rigidbody>(car,"rb");if(rb){rb.linearVelocity=Vector3.zero;rb.angularVelocity=Vector3.zero;rb.isKinematic=true;}
      Get<GameManager>(car,"gameManager").canControl=false;Logger.LogInfo("Custom track finish hold: "+builtLength+" metres; gifts remain active for 10 seconds.");
    }
    void UpdateRoundEnd(){
      if(!trackFinished||roundRestartAt<=0||startingGame||!CustomActive||!car)return;
      if(menuOpen){roundRestartAt+=Time.unscaledDeltaTime;return;}
      int tick=Mathf.CeilToInt(Mathf.Max(0,roundRestartAt-Time.unscaledTime));if(finishPending&&tick!=lastFinishTick){lastFinishTick=tick;PlayActionSound("countdown");}
      if(Time.unscaledTime<roundRestartAt)return;
      if(finishPending){finishPending=false;LoadWins();wins++;SaveWins();PlayActionSound("win");foreach(var burst in finishBursts)if(burst)burst.Play();roundRestartAt=Time.unscaledTime+3;return;}
      var gm=Get<GameManager>(car,"gameManager");var rb=Get<Rigidbody>(car,"rb");if(!gm||!rb||!trackMap||!trackMap.SpawnPoint)return;
      ReleaseCage();ResetEffects();var spawn=trackMap.SpawnPoint;rb.isKinematic=false;rb.linearVelocity=rb.angularVelocity=Vector3.zero;
      car.SetPosAndRot(spawn.position,spawn.rotation);gm.savedPos=spawn.position;gm.savedRot=spawn.rotation;
      var visual=Get<Transform>(car,"Visual");if(visual){Vector3 target=spawn.TransformPoint(roundVisualOffset);var sync=visual.GetComponent<Fusion.NetworkTransform>();if(sync)sync.Teleport(target,spawn.rotation);visual.position=target;}
      if(gm.camControl)gm.camControl.transform.position=spawn.position;
      gm.roundTimer=0;gm.deathCount=0;gm.checkPointIndex=0;if(gm.GameWonUI)gm.GameWonUI.SetActive(false);
      foreach(var obstacle in trackRoot.GetComponentsInChildren<TrackBumper>())obstacle.ResetForRound();
      foreach(var crossing in trackRoot.GetComponentsInChildren<TrackCrossing>())crossing.ResetForRound();
      foreach(var burst in finishBursts)if(burst)burst.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);
      trackRunupUntil=trackImpactUntil=nextTrackImpact=0;lastTrackLaunch=-100;trackFinished=false;roundRestartAt=0;roundNumber++;
      autoDrive=roundAutoDrive;Throttle=0;gm.canControl=true;rb.WakeUp();notice="Yeni tur başladı";noticeUntil=Time.unscaledTime+2;
      Logger.LogInfo("Custom round "+roundNumber+" ready at start; same course, connection and settings preserved.");
    }
    void PrepareRaceHud(){
      PrepareStyles();if(winnerTitle!=null)return;
      winnerTitle=new GUIStyle(titleStyle){fontSize=34,alignment=TextAnchor.MiddleCenter};winnerTitle.normal.textColor=Color.white;
      winnerDetail=new GUIStyle(textStyle){fontSize=18,alignment=TextAnchor.MiddleCenter};winnerDetail.normal.textColor=new Color(.85f,.96f,.95f);
      speedDigits=new GUIStyle(titleStyle){fontSize=34,alignment=TextAnchor.MiddleRight};speedDigits.normal.textColor=Color.white;
      speedDetail=new GUIStyle(smallStyle){fontSize=13};speedDetail.normal.textColor=new Color(.82f,.94f,.94f);
    }
    void DrawRoundResult(){
      if(!CustomActive||!trackFinished)return;PrepareRaceHud();float width=Mathf.Min(660,Screen.width-32),left=(Screen.width-width)/2,y=Screen.height*.38f;
      if(finishPending){
        if(finishDigits==null){finishDigits=new GUIStyle(winnerTitle){fontSize=88};finishDigits.normal.textColor=Color.white;}
        float remaining=Mathf.Max(0,roundRestartAt-Time.unscaledTime),phase=1-(remaining-Mathf.Floor(remaining));float scale=1+Mathf.Pow(1-phase,3)*.18f;
        var matrix=GUI.matrix;GUIUtility.ScaleAroundPivot(new Vector2(scale,scale),new Vector2(Screen.width/2,y+60));
        var color=new Color(1,remaining<=3?.35f:.88f,remaining<=3?.2f:.35f,.65f+.35f*Mathf.Abs(Mathf.Sin(Time.unscaledTime*6)));
        HudShadowLabel(new Rect(left,y-12,width,122),Mathf.CeilToInt(remaining).ToString(),finishDigits,color);GUI.matrix=matrix;return;
      }
      HudShadowLabel(new Rect(left,y+21,width,52),"YAYINCI KAZANDI",winnerTitle,new Color(.35f,1,.62f));
    }
    float DrivingSpeed(){var rb=car?Get<Rigidbody>(car,"rb"):null;return rb?Vector3.ProjectOnPlane(rb.linearVelocity,Vector3.up).magnitude:0;}
    float VoiceSpeedLimit(){return autoDrive||ActiveVoice.automatic?ActiveVoice.automaticMaxSpeed:ActiveVoice.maxSpeed;}
    float RequestedDrivingSpeed(){
      float multiplier=(Time.unscaledTime<boostUntil?boost:1)*(Time.unscaledTime<slowUntil?slow:1);
      float target=VoiceSpeedLimit()*Throttle*Mathf.Min(2,multiplier);
      if(Time.unscaledTime<boostUntil&&Throttle>.005f)target=Mathf.Max(target,Mathf.Clamp(VoiceSpeedLimit()*boost,22,45)*(Time.unscaledTime<slowUntil?slow:1));
      if(CustomActive&&Time.unscaledTime<trackRunupUntil&&Throttle>.005f)target=Mathf.Max(target,30);
      return WheelMissing?target*Mathf.Max(.3f,1-MissingWheelCount*.15f):target;
    }
    void DrawSpeedHud(){
      if(!Ready||giftMotion)return;PrepareRaceHud();float width=Mathf.Min(254,Screen.width-24),left=Screen.width-width-16,top=Screen.height-245;
      Vector2 center=new Vector2(left+width/2,top+110);float radius=width*.39f;
      for(int i=0;i<=40;i++){float angle=Mathf.Lerp(150,390,i/40f)*Mathf.Deg2Rad;Vector2 dir=new Vector2(Mathf.Cos(angle),Mathf.Sin(angle));HudLine(center+dir*(radius-5),center+dir*radius,i%5==0?3:1,new Color(.22f,.45f,.4f));}
      for(int i=0;i<=8;i++){float angle=Mathf.Lerp(150,390,i/8f)*Mathf.Deg2Rad;Vector2 point=center+new Vector2(Mathf.Cos(angle),Mathf.Sin(angle))*(radius+13);GUI.Label(new Rect(point.x-18,point.y-10,36,20),(i*25).ToString(),hudSmall??speedDetail);}
      float needle=Mathf.Lerp(150,390,Mathf.Clamp01(DrivingSpeed()*3.6f/200))*Mathf.Deg2Rad;HudLine(center,center+new Vector2(Mathf.Cos(needle),Mathf.Sin(needle))*(radius-13),4,new Color(.2f,1,.6f));
      var centered=new GUIStyle(speedDigits){alignment=TextAnchor.MiddleCenter};GUI.Label(new Rect(left,top+112,width,45),(DrivingSpeed()*3.6f).ToString("0"),centered);GUI.Label(new Rect(left+width/2-22,top+153,58,20),"km/sa",speedDetail);
      GUI.Label(new Rect(left+18,top+197,width-24,22),autoDrive?"WASD SÜRÜŞ":Time.unscaledTime<boostUntil?"TURBO":"SESLE SÜRÜŞ",speedDetail);
      GUI.Label(new Rect(left+18,top+219,width-24,22),"Gaz %"+Mathf.RoundToInt(Throttle*100)+" · Hedef "+Mathf.RoundToInt(RequestedDrivingSpeed()*3.6f),speedDetail);
    }
    void HudLine(Vector2 from,Vector2 to,float width,Color color){var matrix=GUI.matrix;Vector2 direction=to-from;GUIUtility.RotateAroundPivot(Mathf.Atan2(direction.y,direction.x)*Mathf.Rad2Deg,from);Fill(new Rect(from.x,from.y-width/2,direction.magnitude,width),color);GUI.matrix=matrix;}
    public void AdjustSpeedCamera(CamControl controller){
      if(!Ready||menuOpen||giftMotion||controller!=Get<GameManager>(car,"gameManager").camControl)return;
      var camera=Get<Camera>(controller,"cam");if(!camera)return;
      float wanted=Mathf.Lerp(60,78,Mathf.SmoothStep(0,1,Mathf.InverseLerp(6,32,DrivingSpeed())));
      camera.fieldOfView=Mathf.Lerp(camera.fieldOfView,wanted,1-Mathf.Exp(-Time.unscaledDeltaTime*3));
    }
  }
  [HarmonyLib.HarmonyPatch(typeof(CamControl),"Update")]class SpeedCameraPatch{static void Postfix(CamControl __instance){if(VoiceDrive.Instance!=null)VoiceDrive.Instance.AdjustSpeedCamera(__instance);}}
}
