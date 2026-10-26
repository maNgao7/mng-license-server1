using System;
using System.IO;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    int selectedMap=CustomMap,activeMap=-1;
    Vector2 mapScroll;
    float originalVolume;
    bool volumeRemembered;
    readonly Dictionary<Canvas,bool> originalCanvases=new Dictionary<Canvas,bool>();
    string focusedControl="";
    bool EditingText(){return menuOpen&&(focusedControl=="username"||focusedControl=="gift-search"||focusedControl=="track-length"||focusedControl.StartsWith("number:",StringComparison.Ordinal));}
    void LateUpdate(){Cursor.visible=menuOpen;Cursor.lockState=menuOpen?CursorLockMode.None:CursorLockMode.Locked;}
    void HideOriginalUI(){
      if(!volumeRemembered){volumeRemembered=true;originalVolume=AudioListener.volume;}
      foreach(var canvas in UnityEngine.Object.FindObjectsByType<Canvas>(FindObjectsInactive.Include,FindObjectsSortMode.None)){
        if(!originalCanvases.ContainsKey(canvas))originalCanvases.Add(canvas,canvas.enabled);
        canvas.enabled=false;
      }
    }
    void ReleaseOriginalUI(){foreach(var pair in originalCanvases)if(pair.Key)pair.Key.enabled=pair.Value;originalCanvases.Clear();if(volumeRemembered)AudioListener.volume=originalVolume;}
    HomeManager Home(){return UnityEngine.Object.FindFirstObjectByType<HomeManager>();}
    bool MapAvailable(HomeManager home,int index){
      var gm=home?Get<GameManager>(home,"gameManager"):null;
      if(!gm||gm.mapsObjs==null)return false;
      if(IsCustomMap(index))return draft!=null&&WantedLength>0;
      var maps=NativeMaps(gm);if(index<0||index>=maps.Length||!maps[index]||!maps[index].SpawnPoint)return false;
      var saves=Get<SaveManager>(home,"saveM");
      // A demo installation must not expose maps restricted to the full game.
      return index==0||(saves&&!Get<bool>(saves,"DemoBuild")&&home.FullGameMapBtn&&home.FullGameMapBtn.interactable);
    }
    void DrawMaps(){
      GUI.Label(new Rect(24,216,600,30),"Harita seçimi",titleStyle);
      var home=Home();var gm=home?Get<GameManager>(home,"gameManager"):null;
      if(!gm||gm.mapsObjs==null){Label(35,280,900,"Oyun hazırlanıyor...");return;}
      int availableCount=1;
      Label(35,256,710,availableCount+" kullanılabilir harita",true);
      mapScroll=GUI.BeginScrollView(new Rect(24,300,735,155),mapScroll,new Rect(0,0,710,150));
      GUI.enabled=MenuInputAllowed&&!startingGame;
      if(Button(new Rect(8,0,690,58),(selectedMap==CustomMap?"✓  ":"")+"TikMnG Düz Parkur",selectedMap==CustomMap))selectedMap=CustomMap;
      GUI.EndScrollView();
      DrawGiftGuideDownload(35,399,690);
      GUI.enabled=MenuInputAllowed&&!startingGame&&MapAvailable(home,selectedMap);
      if(Button(new Rect(795,300,280,48),startingGame?"Hazırlanıyor...":enteredGame&&activeMap==selectedMap?"Parkuru yeniden başlat":"Seçili haritaya gir",true))StartCoroutine(EnterGame());
      GUI.enabled=MenuInputAllowed;
      if(enteredGame&&Button(new Rect(795,363,280,44),"Oyuna dön",true))ToggleMenu();
      if(enteredGame&&!trackFinished&&Button(new Rect(795,425,280,40),autoDrive?"Sesle sürüşe geç":"WASD sürüşe geç",autoDrive)){autoDrive=!autoDrive;Throttle=0;}
      if(IsCustomMap(selectedMap)&&draft!=null){
        Label(35,470,500,"Hedef mesafesi (metre)");GUI.enabled=MenuInputAllowed&&!startingGame;
        GUI.SetNextControlName("track-length");string next=GUI.TextField(new Rect(35,505,225,36),lengthText,5,fieldStyle);
        if(next!=lengthText){lengthText=next;if(WantedLength>0){draft.track.length=WantedLength;menuDirty=true;}}
        if(Button(new Rect(275,505,45,36),"−")){draft.track.length=Mathf.Max(100,(WantedLength>0?WantedLength:1000)-100);lengthText=draft.track.length.ToString();menuDirty=true;}
        if(Button(new Rect(330,505,45,36),"+")){draft.track.length=Mathf.Min(5000,(WantedLength>0?WantedLength:1000)+100);lengthText=draft.track.length.ToString();menuDirty=true;}
        GUI.enabled=MenuInputAllowed&&!menuBusy&&WantedLength>0;if(Button(new Rect(525,505,210,36),"Ayarları kaydet",true))SaveMenu();GUI.enabled=MenuInputAllowed;
        int[] lengths={250,500,1000,2000};for(int i=0;i<lengths.Length;i++)if(Button(new Rect(35+i*178,555,167,34),lengths[i]+" m",WantedLength==lengths[i])){draft.track.length=lengths[i];lengthText=lengths[i].ToString();menuDirty=true;GUI.FocusControl(null);}
        if(WantedLength==0)Label(35,593,700,"Mesafe 100 ile 5.000 arasında tam metre olmalı.",true);
        Label(35,630,170,"WIN hedefi");GUI.enabled=MenuInputAllowed&&!startingGame&&!menuBusy;
        int target=Mathf.RoundToInt(StepValue(220,624,190,draft.track.winTarget,1,1,999,"track-win-target"));
        if(target!=draft.track.winTarget){draft.track.winTarget=target;menuDirty=true;}
        int[] targets={10,20,30,50};for(int i=0;i<targets.Length;i++)if(Button(new Rect(435+i*76,624,66,30),targets[i].ToString(),draft.track.winTarget==targets[i])){draft.track.winTarget=targets[i];numberText.Remove("track-win-target");invalidNumbers.Remove("track-win-target");menuDirty=true;GUI.FocusControl(null);}
        GUI.enabled=MenuInputAllowed;
      }
      if(Button(new Rect(795,560,280,40),"Oyundan çık"))Application.Quit();
    }
    IEnumerator StartSelectedMap(){
      var home=Home();var gm=home?Get<GameManager>(home,"gameManager"):null;float bootDeadline=Time.realtimeSinceStartup+20;
      while(!home||!gm||gm.mapsObjs==null){if(Time.realtimeSinceStartup>bootDeadline)throw new InvalidOperationException("Oyun motoru hazırlanamadı. Oyunu yeniden açın.");yield return null;home=Home();gm=home?Get<GameManager>(home,"gameManager"):null;}
      if(IsCustomMap(selectedMap)&&WantedLength==0)throw new InvalidOperationException("Parkur mesafesi 100 ile 5.000 metre arasında olmalı.");
      if(!MapAvailable(home,selectedMap))throw new InvalidOperationException("Bu harita kurulu sürümde kullanılamıyor.");
      if(!gm.carController)home.StartLocalMode();
      float timeout=Time.realtimeSinceStartup+20;
      while(!gm.carController){if(Time.realtimeSinceStartup>timeout)throw new InvalidOperationException("Oyun arabası hazırlanamadı.");yield return null;}
      car=gm.carController;
      if(car.OnlineMultiplayer)throw new InvalidOperationException("Bu mod tek oyunculu yarış içindir.");
      gm.canControl=false;ReleaseCage();ResetEffects();Throttle=0;autoDrive=false;trackFinished=false;roundRestartAt=0;
      if(home.gamePaused){home.ResumeGame();home.gamePaused=false;}
      if(gm.GameWonUI)gm.GameWonUI.SetActive(false);
      RememberNativeMaps(gm);foreach(var map in gm.mapsObjs)if(map)map.gameObject.SetActive(false);RestoreNativeMaps(gm);
      if(IsCustomMap(selectedMap)){int length=WantedLength;yield return BuildTrack(length);BindTrack(gm,length);}
      int nativeIndex=IsCustomMap(selectedMap)?0:selectedMap;
      AccessMap(home,"currentMap",nativeIndex);AccessMap(home,"currentMapObject",gm.mapsObjs[nativeIndex]);
      string saveDir=Path.Combine(dataDir,"saves");Directory.CreateDirectory(saveDir);
      var save=new SaveData{saveID=0,newSave=true,player1_name="",player2_name="",lastTimePlayed="",savePath=Path.Combine(saveDir,"map-"+selectedMap+".json"),saveIconPath=Path.Combine(saveDir,"map-"+selectedMap+".png")};
      home.SetSaveData(save);
      var saves=Get<SaveManager>(home,"saveM");saves.currentSaveDataPath=save.savePath;saves.currentSaveIconPath=save.saveIconPath;
      home.StartWithSaveFile();
      loadingStage="Araç başlangıç çizgisine yerleştiriliyor";loadingProgress=.93f;
      timeout=Time.realtimeSinceStartup+15;
      while(!gm.canControl){if(Time.realtimeSinceStartup>timeout)throw new InvalidOperationException("Yarış başlatılamadı.");HideOriginalUI();yield return null;}
      activeMap=selectedMap;Logger.LogInfo("Direct map entry ready: "+activeMap+"; native singleplayer race; original save slots preserved.");
      gm.savedPos=gm.mapsObjs[nativeIndex].SpawnPoint.position;gm.savedRot=gm.mapsObjs[nativeIndex].SpawnPoint.rotation;
      loadingProgress=1;
    }
    void AccessMap(object target,string field,object value){HarmonyLib.AccessTools.Field(target.GetType(),field).SetValue(target,value);}
  }
}
