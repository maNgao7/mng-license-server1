using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.Networking;

namespace TikMnG.Caaahr {
  [Serializable] public class Gift {public string id,name,origName,image;public int coins;}
  [Serializable] public class GiftList {public Gift[] gifts;}
  [Serializable] public class GiftRule {public string id,giftId,action;public bool enabled=true;public float distance=10,duration=10,strength=2;}
  [Serializable] public class TrackSettings {public int length=1000,winTarget=30;}
  [Serializable] public class AppearanceSettings {public bool configured;public string style="classic";public float red=.22f,green=.64f,blue=.12f;}
  [Serializable] public class ModSettings {public VoiceSettings voice;public TrackSettings track=new TrackSettings();public DisplaySettings graphics=new DisplaySettings();public AppearanceSettings appearance=new AppearanceSettings();public GiftRule[] rules;}
  [Serializable] public class ActionSpec {public string id,name,parameter,unit;public bool strength;}
  [Serializable] public class ConnectionInfo {public string status,username,message;}
  [Serializable] public class HistoryItem {public string id,action,source,message;public bool ok;}
  [Serializable] public class RecentGift {public string username,giftName,status,message,action;public int count,queued,applied;}
  [Serializable] public class MenuState {public ModSettings settings;public ActionSpec[] actions;public ConnectionInfo connection;public HistoryItem[] history;public RecentGift[] recentGifts;public int catalogCount,pending;public string[] standardWarnings;public string rulesRevision;}
  [Serializable] public class SettingsReply {public ModSettings settings;public string[] warnings;}
  [Serializable] public class StandardBody {public bool confirmReplacement;public string revision;}
  [Serializable] public class ConnectBody {public string username;}
  [Serializable] public class IdBody {public string id;}
  [Serializable] public class ErrorBody {public string error;}
  [Serializable] public class GiftTestBody {public string giftId;}
  public partial class VoiceDrive {
    bool menuOpen,menuDirty,menuBusy,wasCursorVisible,enteredGame,startingGame;
    CursorLockMode previousCursor;
    public bool MenuOpen {get{return menuOpen;}}
    ModSettings draft;MenuState menuState;
    Gift[] gifts=new Gift[0];ActionSpec[] actions=new ActionSpec[0];
    string username="",search="",menuNotice="Yayın bağlantısı hazırlanıyor...",giftPicker=null,actionPicker=null;
    int tab=0;
    bool micPicker,calibrating;float calibrationProgress;
    GiftRule testRule=new GiftRule{action="jail"};string testGiftId="";
    Vector2 rulesScroll,giftScroll,historyScroll,microphoneScroll,actionScroll;
    GUIStyle titleStyle,textStyle,smallStyle,buttonStyle,fieldStyle,headingStyle,checkStyle;
    Texture2D white;Font menuFont;
    readonly Dictionary<string,Texture2D> giftTextures=new Dictionary<string,Texture2D>();
    readonly Queue<string> textureOrder=new Queue<string>();
    readonly HashSet<string> loadingTextures=new HashSet<string>();
    bool captureStarted;
    bool drawingModal,backgroundBlocked;
    bool standardConfirm;
    string standardRevision;
    public const string GiftGuideDownloadUrl="http://127.0.0.1:4051/api/gift-guide/download";
    bool MenuInputAllowed {get{return !backgroundBlocked||drawingModal;}}
    bool HasCatalog {get{return giftPicker!=null||actionPicker!=null||displayConfirmUntil>0||standardConfirm;}}
    bool Connected {get{return menuState!=null&&menuState.connection!=null&&menuState.connection.status=="connected";}}
    void InitializeMenu(){ToggleMenu();StartCoroutine(MenuLoop());}
    void ToggleMenu(){
      if(displayConfirmUntil>0)return;
      if(startingGame)return;
      if(menuOpen&&!enteredGame)return;
      Throttle=0;
      menuOpen=!menuOpen;
      UpdateMenuPause();
      if(menuOpen){wasCursorVisible=Cursor.visible;previousCursor=Cursor.lockState;Cursor.lockState=CursorLockMode.None;Cursor.visible=true;}
      else {Cursor.lockState=previousCursor;Cursor.visible=wasCursorVisible;giftPicker=actionPicker=null;}
    }
    IEnumerator MenuLoop(){
      while(true){
        if(token.Length>=20){
          using(var request=GetRequest("/mod/state")){
            yield return request.SendWebRequest();
            if(request.result==UnityWebRequest.Result.Success){
              MenuState state=null;try{state=JsonUtility.FromJson<MenuState>(request.downloadHandler.text);}catch(Exception error){Logger.LogWarning("Menu JSON: "+error.GetType().Name);}
              if(state!=null&&state.settings!=null){BridgeSucceeded(request);ReceiveMenu(state);}
              if(menuState==null)Logger.LogWarning("Menu reply: HTTP "+request.responseCode+"; bytes="+request.downloadHandler.data.Length+"; settings="+(state!=null&&state.settings!=null));
            }else BridgeFailed(request);
          }
          if(gifts.Length==0){using(var request=GetRequest("/mod/gifts")){yield return request.SendWebRequest();if(request.result==UnityWebRequest.Result.Success){try{var list=JsonUtility.FromJson<GiftList>(request.downloadHandler.text);if(list!=null&&list.gifts!=null)ReceiveGifts(list.gifts);}catch{}}else BridgeFailed(request);}}
          if(!captureStarted&&menuState!=null){captureStarted=true;StartCoroutine(CaptureStartup());}
        }
        yield return new WaitForSecondsRealtime(menuOpen?.7f:2);
      }
    }
    void ReceiveMenu(MenuState state){
      if(state.settings==null)return;
      bool first=!serverSettingsLoaded;menuState=state;actions=state.actions??LocalActions();
      if(first){
        var incoming=JsonUtility.FromJson<ModSettings>(JsonUtility.ToJson(state.settings));
        // Preserve edits made while the bridge was reconnecting, section by section.
        if(menuDirty&&draft!=null&&!string.IsNullOrEmpty(localDraftBaseline)){
          var baseline=JsonUtility.FromJson<ModSettings>(localDraftBaseline);
          if(JsonUtility.ToJson(draft.voice)!=JsonUtility.ToJson(baseline.voice))incoming.voice=draft.voice;
          if(JsonUtility.ToJson(draft.track)!=JsonUtility.ToJson(baseline.track))incoming.track=draft.track;
          if(JsonUtility.ToJson(draft.graphics)!=JsonUtility.ToJson(baseline.graphics))incoming.graphics=draft.graphics;
          if(JsonUtility.ToJson(draft.appearance)!=JsonUtility.ToJson(baseline.appearance))incoming.appearance=draft.appearance;
          if(JsonUtility.ToJson(draft)!=localDraftBaseline&&RulesJson(draft)!=RulesJson(baseline))incoming.rules=draft.rules;
        }
        draft=incoming;if(draft.rules==null)draft.rules=new GiftRule[0];if(draft.track==null)draft.track=new TrackSettings();lengthText=draft.track.length.ToString();if(!menuDirty){numberText.Clear();invalidNumbers.Clear();}menuNotice="";serverSettingsLoaded=true;
      }
      CacheMenu(state);
      if(first)Logger.LogInfo("In-game menu ready: "+actions.Length+" actions; "+state.catalogCount+" catalog items.");
    }
    IEnumerator EnterGame(){
      if(startingGame)yield break;
      startingGame=true;menuNotice="Harita hazırlanıyor...";loadingProgress=.02f;loadingStage="Oyun motoru hazırlanıyor";
      var starts=new Stack<IEnumerator>();starts.Push(StartSelectedMap());bool success=true;
      while(starts.Count>0){var start=starts.Peek();bool more=false;try{more=start.MoveNext();}catch(Exception error){success=false;menuNotice=error.Message;Logger.LogWarning("Race entry: "+error);}
        if(!success)break;if(!more){starts.Pop();continue;}var nested=start.Current as IEnumerator;if(nested!=null)starts.Push(nested);else yield return start.Current;
      }
      startingGame=false;
      if(success){enteredGame=true;menuNotice="";ToggleMenu();}
      else{var home=Home();var gm=home?Get<GameManager>(home,"gameManager"):null;if(gm)RestoreNativeMaps(gm);ReleaseTrackGeometry();enteredGame=false;activeMap=-1;}
    }
    IEnumerator CaptureStartup(){
      // This is the game's own render output, retained locally for startup diagnostics.
      yield return new WaitForSecondsRealtime(4);
      yield return new WaitForEndOfFrame();
      try{string dir=Path.Combine(BepInEx.Paths.ConfigPath,"TikMnG-Diagnostics");Directory.CreateDirectory(dir);ScreenCapture.CaptureScreenshot(Path.Combine(dir,"game-startup.png"));File.WriteAllText(Path.Combine(dir,"loaded.txt"),"TikMnG Sesli Surus "+Info.Metadata.Version+" loaded; in-game menu and bridge initialized; gifts="+gifts.Length+" "+DateTime.UtcNow.ToString("O"));File.WriteAllText(Path.Combine(BepInEx.Paths.ConfigPath,"TikMnG.MenuShown"),"1");}catch(Exception error){Logger.LogWarning("Startup diagnostic: "+error.GetType().Name);}
    }
    UnityWebRequest GetRequest(string path){var request=UnityWebRequest.Get("http://127.0.0.1:4051"+path);request.SetRequestHeader("Authorization","Bearer "+token);request.timeout=3;return request;}
    IEnumerator MenuPost(string path,string json,bool save){
      if(menuBusy)yield break;menuBusy=true;
      using(var request=Post(path,json)){
        request.timeout=8;yield return request.SendWebRequest();
        if(request.result==UnityWebRequest.Result.Success){
          BridgeSucceeded(request);menuNotice=save?"Ayarlar kalıcı olarak kaydedildi.":path=="/mod/test"?"Eylem gönderildi. Sonuç eylem geçmişinde görünecek.":"İstek alındı.";
          if(save){var reply=JsonUtility.FromJson<SettingsReply>(request.downloadHandler.text);if(reply==null||reply.settings==null){menuNotice="Kayıt onayı okunamadı. Tekrar deneyin.";}else{
            bool unchanged=JsonUtility.ToJson(draft)==json;menuDirty=!unchanged;
            if(unchanged){draft=reply.settings;lengthText=draft.track.length.ToString();numberText.Clear();invalidNumbers.Clear();GUI.FocusControl(null);}
            CacheMenu(new MenuState{settings=reply.settings,actions=actions});
          }}
        }
        else {ErrorBody error=null;try{error=JsonUtility.FromJson<ErrorBody>(request.downloadHandler.text);}catch{}menuNotice=error!=null&&!string.IsNullOrEmpty(error.error)?error.error:"Bağlantı kurulamadı. Arka plan hizmetini kontrol edin.";}
      }
      menuBusy=false;
    }
    string RulesJson(ModSettings value){return JsonUtility.ToJson(new ModSettings{rules=value.rules});}
    void SaveMenu(){if(!NumbersValid(false))return;if(!serverSettingsLoaded||!BridgeOnline){menuNotice="Kayıtlı hediyeleri korumak için önce yerel bağlantının hazırlanması gerekiyor.";RecoverBridge(true);return;}if(draft!=null&&!menuBusy){if(WantedLength==0){menuNotice="Parkur mesafesi 100 ile 5.000 arasında tam metre olmalı.";return;}StartCoroutine(MenuPost("/mod/settings",JsonUtility.ToJson(draft),true));}}
    public void DrawGiftGuideDownload(float x,float y,float width=280){if(Button(new Rect(x,y,width,34),"Hediye görselini indir"))Application.OpenURL(GiftGuideDownloadUrl);}
    void RequestStandardGifts(){
      if(menuBusy||!serverSettingsLoaded||!BridgeOnline){menuNotice="Önce yerel bağlantının hazırlanması gerekiyor.";return;}
      standardRevision=menuState.rulesRevision;
      if(draft.rules.Length>0||menuState.settings.rules.Length>0){standardConfirm=true;GUI.FocusControl(null);}
      else StartCoroutine(ApplyStandardGifts(false));
    }
    IEnumerator ApplyStandardGifts(bool confirmed){
      if(menuBusy)yield break;menuBusy=true;string before=RulesJson(draft);
      using(var request=Post("/mod/standard-gifts",JsonUtility.ToJson(new StandardBody{confirmReplacement=confirmed,revision=standardRevision}))){
        request.timeout=8;yield return request.SendWebRequest();
        if(request.result==UnityWebRequest.Result.Success){
          var reply=JsonUtility.FromJson<SettingsReply>(request.downloadHandler.text);
          if(reply!=null&&reply.settings!=null){
            if(RulesJson(draft)==before){draft.rules=reply.settings.rules;numberText.Clear();invalidNumbers.Clear();GUI.FocusControl(null);}else menuNotice="Yeni hediye düzenlemeleriniz taslakta korundu.";
            // Voice, track and appearance edits remain in the local draft.
            menuDirty=JsonUtility.ToJson(draft)!=JsonUtility.ToJson(reply.settings);
            CacheMenu(new MenuState{settings=reply.settings,actions=actions});
            menuNotice="Görseldeki 13 standart hediye eşleşmesi kalıcı kaydedildi.";
            BridgeSucceeded(request);
          }
        }else{ErrorBody error=null;try{error=JsonUtility.FromJson<ErrorBody>(request.downloadHandler.text);}catch{}menuNotice=error!=null?error.error:"Standart hediyeler kaydedilemedi.";}
      }
      menuBusy=false;
    }
    void DrawStandardConfirmation(){
      Fill(new Rect(0,0,1120,720),new Color(.1f,.14f,.19f,.92f));Fill(new Rect(160,235,800,240),new Color(.96f,.97f,.98f));
      GUI.Label(new Rect(185,255,740,32),"Standart hediyeler uygulansın mı?",headingStyle);
      Label(185,300,740,"Mevcut ve kaydedilmemiş hediye kuralları değiştirilecek.");
      Label(185,335,740,"Görseldeki 13 eşleşme uygulanır; ses, grafik ve parkur ayarları korunur.",true);
      if(Button(new Rect(490,405,180,36),"Vazgeç"))standardConfirm=false;
      GUI.enabled=!menuBusy;if(Button(new Rect(690,405,240,36),"Değiştir ve kaydet",true)){standardConfirm=false;StartCoroutine(ApplyStandardGifts(true));}GUI.enabled=true;
    }
    void PrepareStyles(){
      if(white)return;
      white=new Texture2D(1,1);white.SetPixel(0,0,Color.white);white.Apply();
      menuFont=Font.CreateDynamicFontFromOSFont("Segoe UI",14);
      textStyle=new GUIStyle(GUI.skin.label){font=menuFont,fontSize=14,wordWrap=false};textStyle.normal.textColor=new Color(.13f,.18f,.22f);
      smallStyle=new GUIStyle(textStyle){fontSize=12};smallStyle.normal.textColor=new Color(.38f,.44f,.48f);
      headingStyle=new GUIStyle(textStyle){fontSize=17,fontStyle=FontStyle.Bold};
      titleStyle=new GUIStyle(headingStyle){fontSize=22};
      checkStyle=new GUIStyle(textStyle){fontSize=18,alignment=TextAnchor.MiddleCenter};checkStyle.normal.textColor=Color.white;
      buttonStyle=new GUIStyle(GUI.skin.button){font=menuFont,fontSize=13,alignment=TextAnchor.MiddleCenter,clipping=TextClipping.Clip};
      buttonStyle.normal.textColor=new Color(.13f,.2f,.24f);buttonStyle.hover.textColor=buttonStyle.normal.textColor;buttonStyle.active.textColor=buttonStyle.normal.textColor;
      fieldStyle=new GUIStyle(GUI.skin.textField){font=menuFont,fontSize=14,padding=new RectOffset(9,8,8,5)};fieldStyle.normal.textColor=new Color(.13f,.18f,.22f);fieldStyle.focused.textColor=fieldStyle.normal.textColor;
      fieldStyle.normal.background=MakeTexture(new Color(.99f,.99f,1));fieldStyle.focused.background=MakeTexture(new Color(.93f,1,.97f));
      buttonStyle.normal.background=MakeTexture(new Color(.89f,.93f,.95f));buttonStyle.hover.background=MakeTexture(new Color(.77f,.89f,.87f));buttonStyle.active.background=MakeTexture(new Color(.7f,.84f,.8f));
    }
    readonly List<Texture2D> styleTextures=new List<Texture2D>();
    Texture2D MakeTexture(Color color){var texture=new Texture2D(1,1);texture.SetPixel(0,0,color);texture.Apply();styleTextures.Add(texture);return texture;}
    void Fill(Rect rect,Color color){Color old=GUI.color;GUI.color=color;GUI.DrawTexture(rect,white);GUI.color=old;}
    bool Button(Rect rect,string text,bool primary=false){Color old=GUI.backgroundColor;GUI.backgroundColor=primary?new Color(.13f,.64f,.52f):new Color(.88f,.92f,.94f);bool clicked=GUI.Button(rect,text,buttonStyle);GUI.backgroundColor=old;if(qaActive&&qaButtonText==text&&Event.current.type==EventType.Repaint){qaButtonText=null;clicked=true;}return clicked&&GUI.enabled&&MenuInputAllowed;}
    void Label(float x,float y,float w,string text,bool small=false){GUI.Label(new Rect(x,y,w,26),text,small?smallStyle:textStyle);}
    string ActionName(string id){foreach(var a in actions)if(a.id==id)return a.name;return "Kaldırılan eylem (kapalı)";}
    Gift FindGift(string id){foreach(var gift in gifts)if(gift.id==id)return gift;return null;}
    GiftRule FindRule(string id){if(draft!=null)foreach(var rule in draft.rules)if(rule.id==id)return rule;return null;}
    Texture2D GiftTexture(Gift gift){
      if(gift==null||string.IsNullOrEmpty(gift.image))return null;
      Texture2D texture;if(giftTextures.TryGetValue(gift.id,out texture))return texture;
      if(loadingTextures.Count<4&&!loadingTextures.Contains(gift.id)&&gift.image.StartsWith("/catalog-assets/",StringComparison.Ordinal))StartCoroutine(LoadGift(gift));
      return null;
    }
    IEnumerator LoadGift(Gift gift){
      loadingTextures.Add(gift.id);
      using(var request=UnityWebRequestTexture.GetTexture("http://127.0.0.1:4051"+gift.image,true)){
        request.timeout=5;yield return request.SendWebRequest();
        if(request.result==UnityWebRequest.Result.Success){
          var texture=DownloadHandlerTexture.GetContent(request);giftTextures[gift.id]=texture;textureOrder.Enqueue(gift.id);
          while(textureOrder.Count>96){string id=textureOrder.Dequeue();Texture2D old;if(giftTextures.TryGetValue(id,out old)){Destroy(old);giftTextures.Remove(id);}}
        }
      }
      loadingTextures.Remove(gift.id);
    }
    void DrawMenu(){
      PrepareStyles();Cursor.lockState=CursorLockMode.None;Cursor.visible=true;
      Matrix4x4 previous=GUI.matrix;Color color=GUI.color;bool enabledBefore=GUI.enabled;GUI.enabled=true;GUI.color=Color.white;
      if(startingGame){DrawLoadingScreen();return;}
      Event originalEvent=Event.current;backgroundBlocked=HasCatalog;GUI.enabled=MenuInputAllowed;
      float scale=Mathf.Min(.8f,Mathf.Min((Screen.width-40)/1120f,(Screen.height-40)/720f));scale=Mathf.Max(.25f,scale);
      GUI.matrix=Matrix4x4.TRS(new Vector3(Screen.width-1120*scale-20,20,0),Quaternion.identity,Vector3.one*scale);
      Fill(new Rect(0,0,1120,720),new Color(.96f,.97f,.98f,.96f));Fill(new Rect(0,0,1120,64),new Color(1,1,1,.98f));
      GUI.Label(new Rect(24,18,670,34),"TikMnG  |  CAAAHR! Sesli Sürüş",titleStyle);
      if(Button(new Rect(760,16,160,34),"Harita seç")){tab=0;GUI.FocusControl(null);micPicker=false;giftPicker=actionPicker=null;}
      GUI.enabled=MenuInputAllowed&&!startingGame&&(enteredGame||MapAvailable(Home(),selectedMap));
      if(Button(new Rect(936,16,160,34),enteredGame?"Oyuna dön":startingGame?"Hazırlanıyor...":"Oyuna gir",true)){if(enteredGame)ToggleMenu();else StartCoroutine(EnterGame());GUI.matrix=previous;GUI.color=color;GUI.enabled=enabledBefore;return;}
      GUI.enabled=MenuInputAllowed;
      Label(24,82,460,"TikTok canlı yayın bağlantısı");
      GUI.SetNextControlName("username");username=GUI.TextField(new Rect(510,78,280,36),username,32,fieldStyle);
      GUI.enabled=MenuInputAllowed&&!menuBusy;
      if(Button(new Rect(800,78,130,36),"Bağlan",true))StartCoroutine(MenuPost("/mod/connect",JsonUtility.ToJson(new ConnectBody{username=username}),false));
      if(Button(new Rect(940,78,155,36),"Bağlantıyı kes"))StartCoroutine(MenuPost("/mod/disconnect","{}",false));
      GUI.enabled=MenuInputAllowed;Label(24,111,1000,BridgeOnline&&menuState!=null&&menuState.connection!=null?menuState.connection.message:"Yerel bağlantı yeniden hazırlanıyor. Yayına bağlanmadan oyuna girebilirsiniz.",true);
      string[] tabs={"Haritalar","Hediye ve eylemler","Mikrofon ve ses","Test alanı","Araç ve renk","Grafik ve ekran"};for(int i=0;i<tabs.Length;i++)if(Button(new Rect(24+i*180,150,170,36),tabs[i],tab==i)){tab=i;GUI.FocusControl(null);displayPicker=null;}
      Fill(new Rect(24,198,1072,1),new Color(.8f,.84f,.87f));
      if(tab==0)DrawMaps();else if(draft==null){Label(28,230,1000,menuNotice);}
      else if(tab==1)DrawRules();else if(tab==2)DrawVoice();else if(tab==3)DrawTests();else if(tab==5)DrawDisplay();else DrawAppearance();
      Fill(new Rect(24,662,1072,1),new Color(.8f,.84f,.87f));Label(24,677,BridgeOnline?1050:840,menuNotice+(menuDirty?"   Kaydedilmemiş değişiklikler var.":""),true);
      if(!BridgeOnline&&Button(new Rect(900,675,196,30),"Bağlantıyı onar")){token="";RecoverBridge(true);}
      drawingModal=true;GUI.enabled=true;
      if(giftPicker!=null)DrawGiftPicker();else if(actionPicker!=null)DrawActionPicker();
      if(displayConfirmUntil>0)DrawDisplayConfirmation();
      if(standardConfirm)DrawStandardConfirmation();
      drawingModal=false;
      if(backgroundBlocked&&originalEvent.type!=EventType.Repaint&&originalEvent.type!=EventType.Layout&&originalEvent.type!=EventType.Used)originalEvent.Use();
      backgroundBlocked=false;
      focusedControl=GUI.GetNameOfFocusedControl();
      GUI.matrix=previous;GUI.color=color;GUI.enabled=enabledBefore;
    }
    void DrawLoadingScreen(){
      PrepareStyles();Fill(new Rect(0,0,Screen.width,Screen.height),new Color(.05f,.09f,.11f));
      float width=Mathf.Min(620,Screen.width-48),x=(Screen.width-width)/2,y=Screen.height/2-65;
      var heading=new GUIStyle(titleStyle){alignment=TextAnchor.MiddleCenter};heading.normal.textColor=Color.white;
      var detail=new GUIStyle(textStyle){alignment=TextAnchor.MiddleCenter};detail.normal.textColor=new Color(.8f,.89f,.91f);
      GUI.Label(new Rect(x,y,width,42),"TikMnG Sesli Sürüş",heading);GUI.Label(new Rect(x,y+50,width,36),loadingStage,detail);
      Fill(new Rect(x,y+105,width,6),new Color(.2f,.29f,.32f));Fill(new Rect(x,y+105,width*Mathf.Clamp01(loadingProgress),6),new Color(.05f,.8f,.69f));
      float pulse=Mathf.PingPong(Time.realtimeSinceStartup*.45f,1);Fill(new Rect(x+(width-38)*pulse,y+105,38,6),new Color(.8f,1,.94f));
    }
    void DrawRules(){
      GUI.Label(new Rect(24,216,240,30),"Hediye kuralları",headingStyle);
      GUI.enabled=MenuInputAllowed&&!menuBusy;if(Button(new Rect(535,212,255,34),"Standart hediyeleri uygula"))RequestStandardGifts();GUI.enabled=MenuInputAllowed;
      if(Button(new Rect(800,212,140,34),"+ Eylem ekle")){
        if(draft.rules.Length<100){var rules=new List<GiftRule>(draft.rules);rules.Add(new GiftRule{id=Guid.NewGuid().ToString("N"),giftId="",action="jail"});draft.rules=rules.ToArray();menuDirty=true;}
      }
      GUI.enabled=MenuInputAllowed&&!menuBusy;if(Button(new Rect(950,212,146,34),"Kaydet",true))SaveMenu();GUI.enabled=MenuInputAllowed;
      Label(24,249,1060,"Kovboy şapkası doğrulanamadı: bitiş kuralı kapalı (aday 6427, Şapka ve Bıyık).",true);
      Label(32,273,240,"Hediye",true);Label(352,273,230,"Eylem",true);Label(624,273,130,"Mesafe / süre",true);Label(789,273,70,"Güç",true);
      rulesScroll=GUI.BeginScrollView(new Rect(24,296,1072,350),rulesScroll,new Rect(0,0,1040,Mathf.Max(345,draft.rules.Length*66)));
      string remove=null;
      for(int i=0;i<draft.rules.Length;i++){
        var rule=draft.rules[i];float y=i*66;Fill(new Rect(0,y+61,1035,1),new Color(.85f,.88f,.9f));
        ActionSpec action=null;foreach(var a in actions)if(a.id==rule.action)action=a;
        GUI.enabled=MenuInputAllowed&&action!=null;
        bool enabled=GUI.Toggle(new Rect(2,y+16,22,24),rule.enabled,"");if(enabled!=rule.enabled){rule.enabled=enabled;menuDirty=true;}
        GUI.enabled=MenuInputAllowed;
        var gift=FindGift(rule.giftId);
        if(Button(new Rect(30,y+5,277,46),gift==null?"Katalogdan hediye seç":"     "+gift.name)){giftPicker=rule.id;search="";giftScroll=Vector2.zero;}
        var texture=GiftTexture(gift);if(texture)GUI.DrawTexture(new Rect(35,y+11,33,33),texture,ScaleMode.ScaleToFit);
        if(Button(new Rect(324,y+5,250,46),ActionName(rule.action)+"  ▾"))actionPicker=rule.id;
        if(action!=null&&!string.IsNullOrEmpty(action.parameter)){
          float value=action.parameter=="distance"?rule.distance:action.parameter=="duration"?rule.duration:rule.strength;
          float next=StepValue(600,y+9,130,value,action.parameter=="strength"?.2f:1,action.parameter=="strength"?.2f:1,action.parameter=="duration"?120:action.parameter=="strength"?8:5000,rule.id+":"+action.parameter);
          if(next!=value){if(action.parameter=="distance")rule.distance=next;else if(action.parameter=="duration")rule.duration=next;else rule.strength=next;menuDirty=true;}
          Label(600,y+39,140,action.unit,true);
        }else Label(600,y+16,140,"Tek sefer",true);
        if(action!=null&&action.strength){float value=StepValue(755,y+9,106,rule.strength,.2f,.2f,8,rule.id+":strength");if(value!=rule.strength){rule.strength=value;menuDirty=true;}}
        GUI.enabled=MenuInputAllowed&&!menuBusy&&!startingGame&&action!=null;
        if(Button(new Rect(875,y+10,94,36),"Test"))StartRulePreview(rule);
        GUI.enabled=MenuInputAllowed;
        if(Button(new Rect(978,y+10,38,36),"×"))remove=rule.id;
      }
      if(draft.rules.Length==0)Label(20,40,900,"Henüz hediye kuralı yok.");
      GUI.EndScrollView();
      if(remove!=null){var rules=new List<GiftRule>(draft.rules);rules.RemoveAll(r=>r.id==remove);draft.rules=rules.ToArray();foreach(string parameter in new[]{"distance","duration","strength"})invalidNumbers.Remove(remove+":"+parameter);menuDirty=true;}
    }
    void DrawTests(){
      GUI.Label(new Rect(24,216,600,30),"Yayına bağlanmadan test",headingStyle);
      if(Button(new Rect(800,212,296,36),enteredGame?"Oyuna dön":"Test için oyuna gir",true)){if(enteredGame)ToggleMenu();else StartCoroutine(EnterGame());return;}
      Label(35,268,980,"Eylem",true);
      if(Button(new Rect(35,298,1040,48),ActionName(testRule.action)+"  ▾"))actionPicker="@test";
      ActionSpec selected=null;foreach(var action in actions)if(action.id==testRule.action)selected=action;
      if(selected!=null&&!string.IsNullOrEmpty(selected.parameter)){
        Label(35,372,310,selected.parameter=="distance"?"Mesafe (metre)":selected.parameter=="duration"?"Süre (saniye)":"Güç");
        float value=selected.parameter=="distance"?testRule.distance:selected.parameter=="duration"?testRule.duration:testRule.strength;
        float next=StepValue(340,366,200,value,selected.parameter=="strength"?.2f:1,selected.parameter=="strength"?.2f:1,selected.parameter=="duration"?120:selected.parameter=="strength"?8:5000,"@test:"+selected.parameter);
        if(selected.parameter=="distance")testRule.distance=next;else if(selected.parameter=="duration")testRule.duration=next;else testRule.strength=next;
      }
      if(selected!=null&&selected.strength){Label(605,372,200,"Güç");testRule.strength=StepValue(825,366,250,testRule.strength,.2f,.2f,8,"@test:strength");}
      GUI.enabled=MenuInputAllowed&&!menuBusy;
      if(Button(new Rect(35,430,1040,46),"Eylemi test et",true))StartRulePreview(testRule);
      GUI.enabled=MenuInputAllowed;
      var gift=FindGift(testGiftId);
      Fill(new Rect(35,506,1040,1),new Color(.8f,.84f,.87f));Label(35,526,400,"Kayıtlı hediye eşleşmesi",true);
      if(Button(new Rect(35,562,630,52),gift==null?"Test hediyesi seç":"      "+gift.name))giftPicker="@test";
      if(gift!=null){var texture=GiftTexture(gift);if(texture)GUI.DrawTexture(new Rect(42,568,40,40),texture,ScaleMode.ScaleToFit);}
      GUI.enabled=MenuInputAllowed&&!menuBusy&&gift!=null;
      if(Button(new Rect(689,562,386,52),"Hediye eylemini test et",true)){
        GiftRule matched=null;foreach(var rule in draft.rules)if(rule.enabled&&rule.giftId==testGiftId){matched=rule;break;}
        if(matched==null)menuNotice="Bu hediyeye açık bir eylem seçilmemiş.";else StartRulePreview(matched);
      }
      GUI.enabled=MenuInputAllowed;
    }
    void DrawVoice(){
      GUI.Label(new Rect(24,216,500,30),"Mikrofon ve ses",headingStyle);
      GUI.enabled=MenuInputAllowed&&!menuBusy;if(Button(new Rect(950,212,146,34),"Kaydet",true))SaveMenu();GUI.enabled=MenuInputAllowed;
      var voice=draft.voice;
      bool enabled=GUI.Toggle(new Rect(35,261,26,26),voice.enabled,"",GUIStyle.none);
      Fill(new Rect(35,261,26,26),enabled?new Color(.1f,.6f,.45f):new Color(.7f,.76f,.79f));if(enabled)GUI.Label(new Rect(35,259,26,28),"✓",checkStyle);Label(70,262,235,"Sesle gaz verme");
      if(enabled!=voice.enabled){voice.enabled=enabled;menuDirty=true;}
      if(Button(new Rect(325,257,210,32),"Kolay ayara dön",true)){voice.automatic=true;voice.autoMicrophone=true;voice.enabled=true;voice.sensitivity=.25f;voice.automaticMaxSpeed=139/3.6f;voice.maxSpeed=139/3.6f;voice.gameVolume=.5f;StopOwnedMic();envelope.Reset();menuDirty=true;SaveMenu();}
      string current=voice.autoMicrophone?"Otomatik · Windows seçili mikrofonu":voice.microphone;
      if(Button(new Rect(35,301,500,36),current+"  ▾"))micPicker=!micPicker;
      if(Button(new Rect(35,350,245,32),"Otomatik",voice.automatic)&&!voice.automatic){voice.automatic=true;envelope.Reset();menuDirty=true;}
      if(Button(new Rect(290,350,245,32),"Elle ayarla",!voice.automatic)&&voice.automatic){voice.automatic=false;menuDirty=true;}
      if(voice.automatic){
        SliderValue(35,405,"Kısık ses hassasiyeti",ref voice.sensitivity,0,1,"%");
        SliderValue(35,485,"Azami hız",ref voice.automaticMaxSpeed,6,45,"km/sa");
      }else{
        SliderValue(35,395,"Sessizlik eşiği",ref voice.noiseDb,-80,Mathf.Min(-10,voice.fullDb-6),"dB");
        SliderValue(35,459,"Tam gaz seviyesi",ref voice.fullDb,Mathf.Max(-60,voice.noiseDb+6),0,"dB");
        SliderValue(35,523,"Geçiş yumuşaklığı",ref voice.response,.05f,2,"sn");
      }
      SliderValue(35,587,"Oyun sesi",ref voice.gameVolume,0,1,"%");
      Label(625,271,440,"Canlı mikrofon");GUI.Label(new Rect(625,303,430,40),Db.ToString("0")+" dB",titleStyle);
      Label(625,341,440,micStatus,true);
      Fill(new Rect(625,376,440,14),new Color(.8f,.84f,.86f));Fill(new Rect(625,376,440*Mathf.InverseLerp(-80,0,Db),14),new Color(.1f,.6f,.45f));
      float preview=voice.enabled?voiceDemand:0;
      Label(625,404,440,"Gaz: %"+Mathf.RoundToInt(preview*100)+"   Hedef hız: "+(preview*(voice.automatic?voice.automaticMaxSpeed:voice.maxSpeed)*3.6f).ToString("0")+" km/sa");
      Fill(new Rect(625,440,440,14),new Color(.8f,.84f,.86f));Fill(new Rect(625,440,440*preview,14),new Color(.94f,.67f,.2f));
      GUI.enabled=MenuInputAllowed&&!calibrating&&ownedClip;
      if(voice.automatic){if(Button(new Rect(625,474,440,36),envelope.Ready?"Otomatik ayarı yenile":"Mikrofon hazırlanıyor..."))envelope.Reset();}
      else{
        if(Button(new Rect(625,474,213,36),"Sessizliği ölç (2 sn)"))StartCoroutine(CalibrateMic(false));
        if(Button(new Rect(848,474,217,36),"Yüksek sesi ölç (2 sn)"))StartCoroutine(CalibrateMic(true));
      }
      GUI.enabled=MenuInputAllowed;
      if(calibrating){Fill(new Rect(625,522,440,8),new Color(.8f,.84f,.86f));Fill(new Rect(625,522,440*calibrationProgress,8),new Color(.1f,.6f,.45f));}
      if(!voice.automatic){Label(625,557,350,"Azami hız (m/s)");float speed=StepValue(625,596,190,voice.maxSpeed,1,1,60);if(speed!=voice.maxSpeed){voice.maxSpeed=speed;menuDirty=true;}}
      if(micPicker){
        Fill(new Rect(35,341,500,230),new Color(.86f,.9f,.92f));
        var devices=Microphone.devices;
        microphoneScroll=GUI.BeginScrollView(new Rect(39,345,492,222),microphoneScroll,new Rect(0,0,470,Mathf.Max(218,(devices.Length+1)*42)));
        if(Button(new Rect(0,0,468,36),"Otomatik · Windows seçili mikrofonu")){voice.autoMicrophone=true;micPicker=false;menuDirty=true;StopOwnedMic();nextEndpointCheck=0;envelope.Reset();}
        for(int i=0;i<devices.Length;i++)if(Button(new Rect(0,42+i*42,468,36),devices[i])){voice.microphone=devices[i];voice.autoMicrophone=false;micPicker=false;menuDirty=true;StopOwnedMic();envelope.Reset();}
        GUI.EndScrollView();
      }
    }
    IEnumerator CalibrateMic(bool full){
      calibrating=true;calibrationProgress=0;var levels=new List<float>();float start=Time.realtimeSinceStartup;
      string device=ownedDevice;menuNotice=full?"Yüksek sesle konuşun...":"Sessizlik ölçülüyor; konuşmayın...";
      while(Time.realtimeSinceStartup-start<2){calibrationProgress=(Time.realtimeSinceStartup-start)/2;if(ownedClip&&ownedDevice==device&&micDataValid)levels.Add(Db);yield return new WaitForSecondsRealtime(.04f);}
      calibrating=false;
      if(levels.Count<10||ownedDevice!=device){menuNotice="Ölçüm tamamlanamadı; mikrofonu kontrol edin.";yield break;}
      levels.Sort();float level=levels[(int)((levels.Count-1)*.8f)];
      if(full)draft.voice.fullDb=Mathf.Clamp(level,Mathf.Max(-60,draft.voice.noiseDb+6),0);
      else{draft.voice.noiseDb=Mathf.Clamp(level+6,-80,-10);draft.voice.fullDb=Mathf.Max(draft.voice.fullDb,draft.voice.noiseDb+6);}
      menuDirty=true;SaveMenu();
    }
    void SliderValue(float x,float y,string title,ref float value,float min,float max,string unit){
      Label(x,y,350,title);Label(x+350,y,150,(unit=="%"?(value*100).ToString("0"):unit=="km/sa"?(value*3.6f).ToString("0"):value.ToString(unit=="sn"?"0.00":"0"))+" "+unit,true);
      float next=GUI.HorizontalSlider(new Rect(x,y+35,500,22),value,min,max);if(Mathf.Abs(next-value)>.0001f){value=next;menuDirty=true;}
    }
    void DrawHistory(){
      GUI.Label(new Rect(24,216,700,30),"Eylem geçmişi",headingStyle);
      if(menuState!=null&&menuState.recentGifts!=null&&menuState.recentGifts.Length>0){var gift=menuState.recentGifts[0];Label(24,249,1060,gift.username+" · "+gift.giftName+" ×"+gift.count+" · "+gift.message,true);}
      var history=menuState!=null&&menuState.history!=null?menuState.history:new HistoryItem[0];
      historyScroll=GUI.BeginScrollView(new Rect(24,284,1072,360),historyScroll,new Rect(0,0,1040,Mathf.Max(355,history.Length*65)));
      for(int i=0;i<history.Length;i++){var item=history[i];float y=i*65;Label(10,y+4,300,ActionName(item.action));Label(340,y+4,650,(item.ok?"✓ ":"! ")+item.message);Label(10,y+31,850,item.source=="test"?"Test":item.source,true);Fill(new Rect(0,y+60,1030,1),new Color(.85f,.88f,.9f));}
      if(history.Length==0)Label(10,25,900,"Henüz eylem yok.");GUI.EndScrollView();
    }
    void PickerBackdrop(string title){Fill(new Rect(0,0,1120,720),new Color(.1f,.14f,.19f,.92f));Fill(new Rect(100,35,920,650),new Color(.96f,.97f,.98f));GUI.Label(new Rect(125,53,730,34),title,headingStyle);if(Button(new Rect(951,49,40,32),"×")){giftPicker=actionPicker=null;}}
    void DrawGiftPicker(){
      PickerBackdrop("Hediye kataloğu  ·  "+gifts.Length);if(giftPicker==null)return;
      GUI.SetNextControlName("gift-search");string next=GUI.TextField(new Rect(124,100,870,36),search,80,fieldStyle);if(next!=search){search=next;giftScroll=Vector2.zero;}
      var filtered=new List<Gift>();string q=search.ToLowerInvariant();foreach(var gift in gifts)if(string.IsNullOrEmpty(q)||(gift.name+" "+gift.origName+" "+gift.id).ToLowerInvariant().Contains(q))filtered.Add(gift);
      float height=Mathf.Max(500,Mathf.Ceil(filtered.Count/6f)*126);
      giftScroll=GUI.BeginScrollView(new Rect(124,151,875,506),giftScroll,new Rect(0,0,852,height));
      for(int i=0;i<filtered.Count;i++){
        int row=i/6;if(row*126+122<giftScroll.y||row*126>giftScroll.y+506)continue;
        var gift=filtered[i];float x=i%6*142,y=row*126;
        if(Button(new Rect(x,y,134,118),"")){if(giftPicker=="@test")testGiftId=gift.id;else{var rule=FindRule(giftPicker);if(rule!=null){rule.giftId=gift.id;menuDirty=true;}}giftPicker=null;}
        var texture=GiftTexture(gift);if(texture)GUI.DrawTexture(new Rect(x+38,y+5,58,58),texture,ScaleMode.ScaleToFit);
        GUI.Label(new Rect(x+7,y+68,120,24),gift.name,smallStyle);GUI.Label(new Rect(x+7,y+91,120,22),gift.coins+" jeton",smallStyle);
      }
      GUI.EndScrollView();
    }
    void DrawActionPicker(){
      PickerBackdrop("Eylem seç");if(actionPicker==null)return;
      actionScroll=GUI.BeginScrollView(new Rect(124,104,875,552),actionScroll,new Rect(0,0,852,Mathf.Max(546,Mathf.CeilToInt(actions.Length/2f)*68)));
      for(int i=0;i<actions.Length;i++){float x=(i%2)*430,y=(i/2)*68;if(Button(new Rect(x,y,413,57),actions[i].name)){ClearRuleNumbers(actionPicker);if(actionPicker=="@test")testRule.action=actions[i].id;else{var rule=FindRule(actionPicker);if(rule!=null){rule.action=actions[i].id;menuDirty=true;}}actionPicker=null;}}
      GUI.EndScrollView();
    }
    void ReleaseMenu(){if(menuOpen){Cursor.lockState=previousCursor;Cursor.visible=wasCursorVisible;}foreach(var texture in giftTextures.Values)Destroy(texture);giftTextures.Clear();foreach(var texture in styleTextures)Destroy(texture);if(white)Destroy(white);if(menuFont)Destroy(menuFont);}
  }
}
