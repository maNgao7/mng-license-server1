using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Text;
using BepInEx;
using HarmonyLib;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.SceneManagement;

namespace TikMnG.Caaahr {
  [Serializable] public class VoiceSettings { public bool enabled=true,automatic=true,autoMicrophone=true; public float sensitivity=.25f,automaticMaxSpeed=139/3.6f,noiseDb=-48,fullDb=-18,response=.18f,maxSpeed=139/3.6f,gameVolume=.5f; public string microphone=""; }
  [Serializable] public class Command { public string id,action,source; public float distance,duration,strength;public double expiresAt; }
  [Serializable] public class SpectatorInfo {public string username,avatar;public bool cheering;}
  [Serializable] public class Poll { public VoiceSettings voice; public Command[] commands; public MenuState menu;public Gift[] gifts;public SpectatorInfo[] spectators; }
  [Serializable] public class Status { public string session,scene,version; public int processId,catalogCount,spectatorCount,avatarCount; public bool ready,ui,catalogLoaded,menuReady; public float db,throttle,speed; public string[] microphones; }
  [Serializable] public class Ack { public string id,message; public bool ok; }

  [BepInPlugin("com.tikmng.caaahr.voice","TikMnG Sesli Surus","0.6.12")]
  public partial class VoiceDrive : BaseUnityPlugin {
    public static VoiceDrive Instance;
    public VoiceSettings Settings=new VoiceSettings();
    public float Throttle,Db=-80;
    CarController car;
    readonly Dictionary<string,Ack> applied=new Dictionary<string,Ack>();
    readonly Queue<string> appliedOrder=new Queue<string>();
    readonly string session=Guid.NewGuid().ToString("N");
    string token="",notice="Sesli sürüş hazır",dataDir;
    float noticeUntil,boostUntil,slowUntil,invertUntil,jailUntil,shieldUntil,boost=1,slow=1,nextSearch;
    GameObject cage; Rigidbody frozenBody; RigidbodyConstraints previousConstraints;
    AudioClip ownedClip; string ownedDevice; float[] samples=new float[1024];
    int lastMicPosition=-1;float lastMicChange,nextMicRetry;
    float nextEndpointCheck;CaptureEndpoint endpoint=new CaptureEndpoint();string endpointKey="",captureKey="";
    bool micDataValid,micPrimed;readonly VoiceEnvelope envelope=new VoiceEnvelope();float voiceDemand,measuredMicDb=-80;
    string micStatus="Mikrofon hazırlanıyor";
    VoiceSettings ActiveVoice {get{return qaVoice??(menuOpen&&draft!=null?draft.voice:Settings);}}
    Harmony harmony;
    bool keyboardAction;int lastKeyboardActionFrame=-1;
    public bool Ready {get {return car && !car.OnlineMultiplayer && Get<bool>(car,"spawned") && Get<GameManager>(car,"gameManager") && (FinishHold||Get<GameManager>(car,"gameManager").canControlPlayer());}}
    public bool Jailed {get{return Ready && Time.unscaledTime<jailUntil;}}
    public bool Inverted {get{return Ready && Time.unscaledTime<invertUntil;}}
    public static T Get<T>(object target,string name){if(target==null)return default(T);var f=AccessTools.Field(target.GetType(),name);return f==null?default(T):(T)f.GetValue(target);}
    void Awake(){
      Instance=this;Application.runInBackground=true;dataDir=Path.Combine(Environment.GetEnvironmentVariable("LOCALAPPDATA")??Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"TikMnG-CAAAHR");
      Logger.LogInfo("Local connection file: "+Path.Combine(Paths.ConfigPath,"TikMnG.LocalConnection.token"));
      harmony=new Harmony("com.tikmng.caaahr.voice");harmony.PatchAll(typeof(VoiceDrive).Assembly);
      LoadLocalSupport();InitializeMenu();
      UnityEngine.Rendering.RenderPipelineManager.beginCameraRendering+=AudienceBeforeCamera;
      StartCoroutine(PollLoop());Logger.LogInfo("TikMnG Sesli Surus "+Info.Metadata.Version+": persistent gift defaults, finish recovery and effect countdowns.");
      if(Array.IndexOf(Environment.GetCommandLineArgs(),"--tikmng-revision-smoke")>=0)StartCoroutine(GuardRevision());else InitializeQA();
    }
    void Update(){
      if(menuOpen&&cage&&Time.unscaledTime<jailUntil)jailUntil+=Time.unscaledDeltaTime;
      if(menuOpen){if(boostUntil>Time.unscaledTime)boostUntil+=Time.unscaledDeltaTime;if(slowUntil>Time.unscaledTime)slowUntil+=Time.unscaledDeltaTime;if(invertUntil>Time.unscaledTime)invertUntil+=Time.unscaledDeltaTime;if(eggUntil>Time.unscaledTime)eggUntil+=Time.unscaledDeltaTime;}
      UpdateDisplay();UpdateActionAudio();UpdateTimedDamage();UpdateActionVisuals();UpdateReverseRocket();UpdateExtraVisuals();UpdateAppearance();UpdateAudience();UpdateRoadGifts();
      if(Time.unscaledTime>nextSearch){nextSearch=Time.unscaledTime+1;var found=UnityEngine.Object.FindFirstObjectByType<CarController>();if(found!=car){ReleaseCage();car=found;ResetEffects();}HideOriginalUI();}
      if(!qaActive&&Application.isFocused&&Input.GetKeyDown(KeyCode.B)&&!EditingText()){if(giftPicker!=null||actionPicker!=null){giftPicker=actionPicker=null;GUIUtility.keyboardControl=0;}else ToggleMenu();}
      if(!qaActive&&Application.isFocused&&Input.GetKeyDown(KeyCode.O)&&!EditingText())ToggleAutoDrive();
      UpdateTrack();
      UpdateMenuPause();
      if(!Focused){Throttle=0;Db=-80;micDataValid=false;StopOwnedMic();return;}
      ReadKeyboardJump();
      SampleMic();
      measuredMicDb=Db;
      if(qaActive&&qaDb.HasValue){Db=qaDb.Value;micDataValid=true;}
      var voice=ActiveVoice;AudioListener.volume=voice.gameVolume;
      voiceDemand=voice.automatic?envelope.Process(Db,Time.unscaledDeltaTime,voice.sensitivity,micDataValid):micDataValid?VoiceMath.Target(Db,voice.noiseDb,voice.fullDb):0;
      float target=VoiceMath.DriveTarget(voiceDemand,autoDrive,voice.enabled,ManualAxis);
      if((!voice.enabled&&!autoDrive)||!Ready||Jailed||Damaged||Braking||giftMotion||menuOpen||calibrating)target=0;
      Throttle=VoiceMath.Smooth(Throttle,target,voice.automatic?.1f:voice.response,Time.unscaledDeltaTime);
      if(!Ready){ReleaseCage();ResetEffects();}
      if(cage && Time.unscaledTime>=jailUntil)ReleaseCage();
    }
    void SampleMic(){
      Db=-80;micDataValid=false;var devices=Microphone.devices;var voice=ActiveVoice;string device=voice.microphone;
      if(devices.Length==0){StopOwnedMic();micStatus="Mikrofon bulunamadı";return;}
      if(voice.autoMicrophone||string.IsNullOrEmpty(device)){
        if(Time.unscaledTime>=nextEndpointCheck){nextEndpointCheck=Time.unscaledTime+1;var current=DefaultMicrophone.Read();if(current.Id!=endpointKey){StopOwnedMic();endpointKey=current.Id;nextMicRetry=0;}endpoint=current;}
        device=DefaultMicrophone.Resolve(endpoint.Name,devices);
      }
      else if(Array.IndexOf(devices,device)<0){StopOwnedMic();micStatus="Seçili mikrofon bağlı değil";return;}
      if(ownedClip&&ownedDevice!=device)StopOwnedMic();
      try{
        if(!ownedClip){
          if(Time.unscaledTime<nextMicRetry)return;
          nextMicRetry=Time.unscaledTime+.5f;ownedDevice=device;lastMicPosition=-1;lastMicChange=Time.unscaledTime;micPrimed=false;
          string key=voice.autoMicrophone?"default:"+endpoint.Id:"device:"+device;if(key!=captureKey){captureKey=key;envelope.Reset();}
          int min,max;Microphone.GetDeviceCaps(device,out min,out max);int frequency=max>0?Mathf.Clamp(44100,Mathf.Max(8000,min),max):44100;
          ownedClip=Microphone.Start(device,true,2,frequency);
          if(!ownedClip){micStatus="Mikrofon açılamadı; Windows mikrofon iznini kontrol edin";return;}
          Logger.LogInfo("Voice input opened: "+(device??endpoint.Name)+"; automatic="+voice.autoMicrophone);
        }
        if(!Microphone.IsRecording(device)){StopOwnedMic();nextMicRetry=Time.unscaledTime+.2f;micStatus="Mikrofon yeniden bağlanıyor";return;}
        int position=Microphone.GetPosition(device);
        if(position!=lastMicPosition){lastMicPosition=position;lastMicChange=Time.unscaledTime;}
        if(Time.unscaledTime-lastMicChange>.3f){if(Time.unscaledTime-lastMicChange>.75f){StopOwnedMic();nextMicRetry=Time.unscaledTime+.2f;}micStatus="Mikrofon yeniden bağlanıyor";return;}
        if(!micPrimed){if(position<1024){micStatus="Mikrofon hazırlanıyor";return;}micPrimed=true;}
        int count=1024*ownedClip.channels;if(samples.Length!=count)samples=new float[count];
        int offset=(position-1024+ownedClip.samples)%ownedClip.samples;
        if(!ownedClip.GetData(samples,offset)){micStatus="Mikrofon sesi okunamadı";return;}
        Db=VoiceMath.Level(samples);micDataValid=true;micStatus=device??endpoint.Name;
      }catch(Exception error){StopOwnedMic();nextMicRetry=Time.unscaledTime+.5f;micStatus="Mikrofon açılamadı";Logger.LogWarning("Microphone: "+error.GetType().Name);}
    }
    void StopOwnedMic(){if(ownedClip){Microphone.End(ownedDevice);Destroy(ownedClip);ownedClip=null;}lastMicPosition=-1;micDataValid=false;micPrimed=false;nextMicRetry=0;}
    void ResetEffects(){ReleaseMenuPause();effectGeneration++;CancelGiftMotion("Yarış değişti; itiş iptal edildi.");giftMotion=false;boostUntil=slowUntil=invertUntil=jailUntil=shieldUntil=0;trackRunupUntil=0;boost=slow=1;ClearTimedDamage();ResetExtraEffects();ReleaseActionVisuals();}
    public bool Drive(CarController target){
      if(target.OnlineMultiplayer)return true;
      if(target!=car)car=target;
      var rb=Get<Rigidbody>(car,"rb");var steering=Get<MicroHolder>(car,"currentSteerObj");
      if(!rb||rb.isKinematic)return false;
      if(giftMotion)return false;
      if(Jailed||Damaged||Braking||menuOpen||!Ready||!Focused||trafficCrash){var v=rb.linearVelocity;rb.linearVelocity=new Vector3(0,v.y,0);return false;}
      if(CustomActive&&Time.unscaledTime<trackImpactUntil)return false;
      float multiplier=(Time.unscaledTime<boostUntil?boost:1)*(Time.unscaledTime<slowUntil?slow:1);
      float speedLimit=RequestedDrivingSpeed();
      bool runup=CustomActive&&Time.unscaledTime<trackRunupUntil&&Throttle>.005f;
      if(car.isGrounded){
        Vector3 direction=steering&&steering.SteerPivot?steering.SteerPivot.forward:car.transform.forward;
        direction=Vector3.ProjectOnPlane(direction,Vector3.up).normalized;
        if(autoDrive&&ManualAxis<0)direction=-direction;
        if(WheelMissing)direction=Quaternion.Euler(0,MissingWheelPull*55,0)*direction;
        if(Icy){iceDirection=Vector3.Slerp(iceDirection.sqrMagnitude>.5f?iceDirection:direction,direction,Time.fixedDeltaTime*.65f).normalized;direction=iceDirection;}
        var velocity=rb.linearVelocity;var horizontal=new Vector3(velocity.x,0,velocity.z);
        if(horizontal.magnitude>speedLimit){horizontal=Vector3.MoveTowards(horizontal,horizontal.normalized*speedLimit,(autoDrive&&Throttle<=.005f?100:25)*Time.fixedDeltaTime);rb.linearVelocity=new Vector3(horizontal.x,velocity.y,horizontal.z);}
        float speed=Vector3.Dot(rb.linearVelocity,direction);
        // Keep enough starting torque for quiet speech; volume caps the target speed.
        if((Throttle>.005f||runup)&&speed<speedLimit){float effort=Mathf.Clamp((speedLimit-speed)*2,.3f,1);rb.WakeUp();rb.AddForce(direction*effort*Get<float>(car,"motorPower")*multiplier);}
      }
      return false;
    }
    void ReadKeyboardJump(){
      if(!Ready||menuOpen||Jailed||giftMotion)return;
      var settings=Get<SettingsManager>(car,"settingsM");var key=settings?Get<KeyCode>(settings,"currentJumpKeyCode"):KeyCode.Space;
      if(Input.GetKeyDown(KeyCode.Space)||(key!=KeyCode.None&&key!=KeyCode.B&&Input.GetKeyDown(key)))TriggerKeyboardAction();
    }
    void TriggerKeyboardAction(){
      if(!Ready||!Focused||menuOpen||Jailed||giftMotion||lastKeyboardActionFrame==Time.frameCount)return;
      lastKeyboardActionFrame=Time.frameCount;keyboardAction=true;
      try{car.VoiceTrigger();}finally{keyboardAction=false;}
    }
    public bool AllowVoiceTrigger(){return car&&(car.OnlineMultiplayer||keyboardAction);}
    public bool NativeMic(MicroHolder holder){var gm=Get<GameManager>(holder,"gameManager");return gm&&gm.carController&&gm.carController.OnlineMultiplayer;}
    public bool VoiceInput(MicroHolder holder){if(NativeMic(holder))return true;AccessTools.Field(typeof(MicroHolder),"throttleInput").SetValue(holder,menuOpen?0:Throttle);return false;}
    public void AdjustSteering(MicroHolder holder,ref float value){
      if(!Ready||holder!=Get<MicroHolder>(car,"currentSteerObj"))return;
      if(Jailed||Damaged||Braking||menuOpen||giftMotion||!Focused)value=0;else{if(autoDrive)value=(Input.GetKey(KeyCode.D)?1:0)-(Input.GetKey(KeyCode.A)?1:0);if(Inverted)value=-value;if(WheelMissing)value=Mathf.Clamp(value*.85f+MissingWheelPull,-1,1);if(Icy)value*=.6f;}
    }
    IEnumerator PollLoop(){
      while(true){
        RecoverBridge();if(token.Length<20)ReadConnectionToken();
        if(token.Length>=20){
          var rb=car?Get<Rigidbody>(car,"rb"):null;
          var status=new Status{session=session,scene=SceneManager.GetActiveScene().name,version=Info.Metadata.Version.ToString(),processId=System.Diagnostics.Process.GetCurrentProcess().Id,menuReady=serverSettingsLoaded,catalogCount=gifts.Length,spectatorCount=audiencePeople.Count,avatarCount=BoundPortraitCount(),ready=Ready,db=Db,throttle=Throttle,speed=rb?rb.linearVelocity.magnitude*3.6f:0,microphones=Microphone.devices,ui=menuOpen||menuState==null||trafficCrash,catalogLoaded=gifts.Length>0};
          using(var request=Post("/mod/poll",JsonUtility.ToJson(status))){
            yield return request.SendWebRequest();
            if(request.result==UnityWebRequest.Result.Success){
              Poll response=null;try{response=JsonUtility.FromJson<Poll>(request.downloadHandler.text);}catch(Exception e){Logger.LogWarning("Bridge response: "+e.GetType().Name);}
              if(response!=null){if(status.ready&&Ready)lastReadyHeartbeat=Time.unscaledTime;if(response.voice!=null){Settings=response.voice;BridgeSucceeded(request);}
                if(response.menu!=null)ReceiveMenu(response.menu);
                if(response.gifts!=null&&response.gifts.Length>0){ReceiveGifts(response.gifts);Logger.LogInfo("In-game gift catalog ready: "+gifts.Length);}
                if(response.spectators!=null&&!qaAudienceOverride)audience=response.spectators;
                if(response.commands!=null)foreach(var command in response.commands){
                  if(string.IsNullOrEmpty(command.id))continue;
                  if(applied.ContainsKey(command.id)){var prior=applied[command.id];yield return SendAck(command,prior.ok,prior.message);continue;}
                  if(trafficCrash||menuOpen&&command.source!="test")continue;
                  if(!runningCommands.Contains(command.id))StartCoroutine(RunCommand(command));
                }
              }
            }else BridgeFailed(request);
          }
        }
        yield return new WaitForSecondsRealtime(.2f);
      }
    }
    bool bridgeWarning;
    UnityWebRequest Post(string path,string json){var req=new UnityWebRequest("http://127.0.0.1:4051"+path,"POST");req.uploadHandler=new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));req.downloadHandler=new DownloadHandlerBuffer();req.SetRequestHeader("Content-Type","application/json");req.SetRequestHeader("Authorization","Bearer "+token);req.timeout=2;return req;}
    IEnumerator SendAck(Command command,bool ok,string message){using(var req=Post("/mod/ack",JsonUtility.ToJson(new Ack{id=command.id,ok=ok,message=message}))){yield return req.SendWebRequest();}}
    string Execute(Command c){string message=ExecuteAction(c);PlayActionSound(c.action);return message;}
    string ExecuteAction(Command c){
      if(!Ready)throw new InvalidOperationException("Yarış etkin değil; uygulanmadı.");
      if(Array.Find(LocalActions(),a=>a.id==c.action)==null)throw new InvalidOperationException("Bu eylem kaldırıldı.");
      var rb=Get<Rigidbody>(car,"rb");if(!rb)throw new InvalidOperationException("Araba fiziği hazır değil.");
      float duration=Mathf.Clamp(c.duration<=0?10:c.duration,1,120),strength=Mathf.Clamp(c.strength,.2f,8),end=Time.unscaledTime+duration;
      switch(c.action){
        case "explode":StartTimedDamage(duration);return "Araba patladı; "+duration+" saniye sonra toparlanacak.";
        case "finish":if(!CustomActive)throw new InvalidOperationException("Özel parkur etkin değil.");ReleaseCage();ResetEffects();MoveOnTrack(builtLength-TrackProgress);return "Bitiş çizgisine ışınlandı.";
        case "wheel":RemoveWheel(duration);return "Sökülen lastik: "+MissingWheelCount+" / 4 · "+duration+" saniye.";
        case "jail":jailUntil=Mathf.Max(jailUntil,end);BuildCage(rb);return "Kafes: "+duration+" saniye.";
        case "release":return ReduceCageTime(duration);
        case "boost":boostUntil=end;boost=Mathf.Clamp(strength,1.2f,8);EnsureActionVisuals();UpdateActionVisuals();return "Roket turbo: "+duration+" saniye.";
        case "slow":slowUntil=end;slow=1/Mathf.Clamp(strength,1,8);return "Motor yavaşlatıldı: "+duration+" saniye.";
        case "invert":invertUntil=end;return "Direksiyon ters çevrildi.";
        case "jump":if(Jailed)throw new InvalidOperationException("Araba kafeste.");rb.AddForce(Vector3.up*strength*3,ForceMode.VelocityChange);return "Araba havalandırıldı.";
        case "repair":ReleaseCage();jailUntil=0;RestoreWheel();var angles=car.transform.eulerAngles;rb.rotation=Quaternion.Euler(0,angles.y,0);rb.angularVelocity=Vector3.zero;return "Araç doğrultuldu ve tüm lastikler onarıldı.";
        case "shield":shieldUntil=end;EnsureActionVisuals();UpdateActionVisuals();return "Kalkan: sıradaki tek engeli veya zararlı hediyeyi engeller.";
        case "brake":brakeUntil=end;trackRunupUntil=0;rb.linearVelocity=new Vector3(0,rb.linearVelocity.y,0);EnsureExtraVisuals();return "El freni çekildi: "+duration+" saniye.";
        case "wind":windUntil=end;windStrength=strength;windSide=UnityEngine.Random.value<.5f?-1:1;nextWindShift=Time.unscaledTime+.9f;EnsureExtraVisuals();return "Değişken yan rüzgâr: "+duration+" saniye.";
        case "ice":iceUntil=end;iceDirection=Vector3.ProjectOnPlane(car.transform.forward,Vector3.up).normalized;EnsureExtraVisuals();return "Lastikler buzlandı: "+duration+" saniye.";
        case "egg":StartBirdEgg(duration);return "Kuş yumurtası: "+duration+" saniye.";
        case "logs":StartRoadGift(true,strength);return "Aracın şeridine yuvarlanan kalas gönderildi.";
        case "traffic":StartRoadGift(false,strength);return "Karşıdan araba gönderildi.";
        case "bounce":bounceUntil=end;bounceStrength=strength;nextBounce=Time.unscaledTime;EnsureExtraVisuals();return "Zıplayan süspansiyon: "+duration+" saniye.";
        default:throw new InvalidOperationException("Bilinmeyen eylem.");
      }
    }
    void BuildCage(Rigidbody rb){
      ReleaseCage();frozenBody=rb;previousConstraints=rb.constraints;rb.constraints=RigidbodyConstraints.FreezeAll;rb.linearVelocity=Vector3.zero;
      cage=new GameObject("TikMnG temporary gift cage");cage.transform.position=rb.position;
      var shader=Shader.Find("Universal Render Pipeline/Lit")??Shader.Find("Standard");
      var material=new Material(shader);material.color=new Color(.28f,.32f,.35f);
      for(int side=0;side<4;side++)for(int bar=0;bar<6;bar++){
        var go=GameObject.CreatePrimitive(PrimitiveType.Cube);Destroy(go.GetComponent<Collider>());go.transform.SetParent(cage.transform,false);
        float offset=-2+bar*.8f;go.transform.localPosition=side<2?new Vector3(side==0?-2:2,1.4f,offset):new Vector3(offset,1.4f,side==2?-2:2);
        go.transform.localScale=new Vector3(.09f,4,.09f);go.GetComponent<Renderer>().sharedMaterial=material;
      }
      var top=GameObject.CreatePrimitive(PrimitiveType.Cube);Destroy(top.GetComponent<Collider>());top.transform.SetParent(cage.transform,false);top.transform.localPosition=Vector3.up*3.4f;top.transform.localScale=new Vector3(4.2f,.12f,4.2f);top.GetComponent<Renderer>().sharedMaterial=material;
    }
    void ReleaseCage(){ReleaseMenuPause();if(frozenBody)frozenBody.constraints=previousConstraints;frozenBody=null;if(cage){var r=cage.GetComponentInChildren<Renderer>();if(r)Destroy(r.sharedMaterial);Destroy(cage);}cage=null;}
    void OnGUI(){
      if(qaActive&&qaHideMenu)return;
      if(menuOpen){DrawPreviewFeedback();DrawMenu();DrawRoundResult();return;}
      DrawPreviewFeedback();
      DrawEgg();
      DrawTrackHud();
      DrawSpeedHud();DrawRoundResult();DrawVoicePrompt();DrawVehicleTimers();
      GUI.color=Color.white;GUI.Label(new Rect(16,12,600,28),"TikMnG • Sesli Sürüş    B: Menü");
      if(Ready){GUI.color=new Color(.25f,1,.58f);GUI.Label(new Rect(20,Screen.height-88,310,28),string.Format("MİKROFON  {0:0} dB · GAZ %{1:0}",Db,Throttle*100));Fill(new Rect(20,Screen.height-49,220,10),new Color(.08f,.22f,.15f));Fill(new Rect(20,Screen.height-49,220*Mathf.InverseLerp(-80,0,Db),10),new Color(.2f,.95f,.45f));GUI.color=Color.white;}
      float y=50;
      if(Time.unscaledTime<noticeUntil)GUI.Label(new Rect(16,y+8,700,28),notice);
    }
    void OnDestroy(){UnityEngine.Rendering.RenderPipelineManager.beginCameraRendering-=AudienceBeforeCamera;ResetEffects();ReleaseAppearance();ReleaseEgg();ReleasePortraits();ReleaseTrack();ReleaseMenu();ReleaseOriginalUI();ReleaseCage();StopOwnedMic();if(leafMesh)Destroy(leafMesh);if(birdWingMesh)Destroy(birdWingMesh);if(tornadoWindClip)Destroy(tornadoWindClip);if(harmony!=null)harmony.UnpatchSelf();Instance=null;}
  }
  [HarmonyPatch(typeof(CarController),"ApplyThrottle")] class ThrottlePatch {static bool Prefix(CarController __instance){return VoiceDrive.Instance==null||VoiceDrive.Instance.Drive(__instance);}}
  [HarmonyPatch(typeof(CarController),"FixedUpdate")] class GiftMotionPatch {static bool Prefix(CarController __instance){return VoiceDrive.Instance==null||__instance.OnlineMultiplayer||(!VoiceDrive.Instance.MotionActive&&!VoiceDrive.Instance.MenuOpen);}}
  [HarmonyPatch(typeof(CarController),"VoiceTrigger")] class VoiceJumpPatch {static bool Prefix(){return VoiceDrive.Instance==null||VoiceDrive.Instance.AllowVoiceTrigger();}}
  [HarmonyPatch(typeof(CarController),"Jump")] class JailJumpPatch {static bool Prefix(){return VoiceDrive.Instance==null||(!VoiceDrive.Instance.Jailed&&!VoiceDrive.Instance.MenuOpen);}}
  [HarmonyPatch(typeof(MicroHolder),"set_steerInputFromOnInput")] class SteeringPatch {static void Prefix(MicroHolder __instance,ref float __0){if(VoiceDrive.Instance!=null)VoiceDrive.Instance.AdjustSteering(__instance,ref __0);}}
  [HarmonyPatch(typeof(MicroHolder),"StartMic")] class MicrophoneOwnerPatch {static bool Prefix(MicroHolder __instance){return VoiceDrive.Instance==null||VoiceDrive.Instance.NativeMic(__instance);}}
  [HarmonyPatch(typeof(MicroHolder),"AnalyzeVolume")] class VoiceInputPatch {static bool Prefix(MicroHolder __instance){return VoiceDrive.Instance==null||VoiceDrive.Instance.VoiceInput(__instance);}}
  [HarmonyPatch(typeof(HomeManager),"Update")] class OriginalMenuUpdatePatch {static bool Prefix(){return VoiceDrive.Instance==null;}}
  [HarmonyPatch(typeof(HomeManager),"PauseGame")] class OriginalPausePatch {static bool Prefix(){return VoiceDrive.Instance==null;}}
  [HarmonyPatch(typeof(HomeManager),"OpenSettings")] class OriginalSettingsPatch {static bool Prefix(){return VoiceDrive.Instance==null;}}
  [HarmonyPatch(typeof(HomeManager),"OpenSettingsInHome")] class OriginalHomeSettingsPatch {static bool Prefix(){return VoiceDrive.Instance==null;}}
  [HarmonyPatch(typeof(ControllerNavigation),"Update")] class OriginalNavigationPatch {static bool Prefix(){return VoiceDrive.Instance==null;}}
  [HarmonyPatch(typeof(UnityEngine.EventSystems.EventSystem),"Update")] class MenuInputPatch {static bool Prefix(){return VoiceDrive.Instance==null;}}
}
