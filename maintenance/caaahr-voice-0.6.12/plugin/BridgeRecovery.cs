using System;
using System.IO;
using UnityEngine;
using UnityEngine.Networking;

namespace TikMnG.Caaahr {
  [Serializable] public class LocalBootstrap {public string launcher,dataDirectory;}
  public partial class VoiceDrive {
    bool serverSettingsLoaded;
    float lastBridgeSuccess=-1000,nextBridgeBootstrap=3;
    int credentialSlot;
    string cachedMenuJson="";
    string localDraftBaseline="";
    LocalBootstrap bootstrap;
    System.Diagnostics.Process bridgeBootstrap;
    bool BridgeOnline {get{return Time.unscaledTime-lastBridgeSuccess<5;}}
    string ConfigFile(string name){return Path.Combine(BepInEx.Paths.ConfigPath,name);}
    void LoadLocalSupport(){
      try{bootstrap=JsonUtility.FromJson<LocalBootstrap>(File.ReadAllText(ConfigFile("TikMnG.Bootstrap.json")));if(bootstrap!=null&&!string.IsNullOrEmpty(bootstrap.dataDirectory)&&Path.IsPathRooted(bootstrap.dataDirectory))dataDir=Path.GetFullPath(bootstrap.dataDirectory);}catch{}
      ModSettings local=null;MenuState cache=null;
      try{local=JsonUtility.FromJson<ModSettings>(File.ReadAllText(Path.Combine(dataDir,"settings.json")));}catch{}
      try{cache=JsonUtility.FromJson<MenuState>(File.ReadAllText(ConfigFile("TikMnG.MenuCache.json")));}catch{}
      if(local==null||local.voice==null)local=cache!=null?cache.settings:null;
      draft=local!=null&&local.voice!=null?local:new ModSettings{voice=new VoiceSettings(),rules=LocalStandardRules()};
      if(draft.track==null)draft.track=new TrackSettings();if(draft.rules==null)draft.rules=new GiftRule[0];
      Settings=draft.voice;lengthText=draft.track.length.ToString();
      localDraftBaseline=JsonUtility.ToJson(draft);
      actions=LocalActions();foreach(var rule in draft.rules)if(Array.IndexOf(new[]{"gravity","brake","ice","bounce","repair","shield","jump","logs","wind"},rule.action)>=0)rule.enabled=false;
      try{var catalog=JsonUtility.FromJson<GiftList>(File.ReadAllText(ConfigFile("TikMnG.GiftCatalog.json")));if(catalog!=null&&catalog.gifts!=null)gifts=catalog.gifts;}catch{}
      menuNotice="";
    }
    GiftRule[] LocalStandardRules(){return new[]{
      new GiftRule{id="standard-donut",giftId="5879",action="explode",duration=10},
      new GiftRule{id="standard-gg",giftId="6064",action="jail",duration=1},
      new GiftRule{id="standard-icecream",giftId="5827",action="release",duration=1},
      new GiftRule{id="standard-cowboyhat",giftId="6427",action="finish"},
      new GiftRule{id="standard-tiktok-cap",giftId="6104",action="restart"},
      new GiftRule{id="standard-bouquet",giftId="17473",action="tornado",distance=25},
      new GiftRule{id="standard-perfume",giftId="5658",action="boost",duration=10},
      new GiftRule{id="standard-rose",giftId="5655",action="forward",distance=50},
      new GiftRule{id="standard-blue-bead",giftId="5319",action="forward",distance=250},
      new GiftRule{id="standard-heart",giftId="5282",action="forward",distance=500},
      new GiftRule{id="standard-music-note",giftId="5269",action="backward",distance=50},
      new GiftRule{id="standard-turkish-coffee",giftId="5994",action="backward",distance=250},
      new GiftRule{id="standard-rosa",giftId="8913",action="backward",distance=500}
    };}
    ActionSpec[] LocalActions(){return new[]{
      new ActionSpec{id="explode",name="Arabayı patlat",parameter="duration",unit="saniye"},new ActionSpec{id="restart",name="Başa döndür"},
      new ActionSpec{id="forward",name="İleri götür",parameter="distance",unit="metre"},new ActionSpec{id="backward",name="Geri götür",parameter="distance",unit="metre"},new ActionSpec{id="finish",name="Bitişe ışınla"},new ActionSpec{id="wheel",name="Lastiği sök",parameter="duration",unit="saniye"},
      new ActionSpec{id="jail",name="Kafese hapset",parameter="duration",unit="saniye"},new ActionSpec{id="release",name="Kafesten kurtar",parameter="duration",unit="saniye"},new ActionSpec{id="boost",name="Turbo desteği",parameter="duration",unit="saniye",strength=true},
      new ActionSpec{id="slow",name="Motoru yavaşlat",parameter="duration",unit="saniye",strength=true},new ActionSpec{id="invert",name="Direksiyonu ters çevir",parameter="duration",unit="saniye"},
      new ActionSpec{id="tornado",name="Hortumla geri savur",parameter="distance",unit="metre"},
      new ActionSpec{id="traffic",name="Karşıdan araba gönder",parameter="strength",unit="hız"},
      new ActionSpec{id="egg",name="Yumurta fırlat",parameter="duration",unit="saniye"}
    };}
    void CacheMenu(MenuState state){
      string json=JsonUtility.ToJson(new MenuState{settings=state.settings,actions=state.actions});if(json==cachedMenuJson)return;
      try{File.WriteAllText(ConfigFile("TikMnG.MenuCache.json"),json);cachedMenuJson=json;}catch(Exception error){Logger.LogWarning("Menu cache: "+error.GetType().Name);}
    }
    void ReceiveGifts(Gift[] catalog){
      if(catalog==null||catalog.Length==0)return;gifts=catalog;
      try{File.WriteAllText(ConfigFile("TikMnG.GiftCatalog.json"),JsonUtility.ToJson(new GiftList{gifts=catalog}));}catch{}
    }
    void ReadConnectionToken(){
      var files=new[]{ConfigFile("TikMnG.LocalConnection.token"),Path.Combine(dataDir,"token")};
      for(int i=0;i<files.Length;i++)try{string candidate=File.ReadAllText(files[(credentialSlot+i)%files.Length]).Trim();if(candidate.Length>=20&&candidate.Length<=256){token=candidate;return;}}catch{}
    }
    void BridgeSucceeded(UnityWebRequest request){
      string accepted=request.GetRequestHeader("Authorization");if(string.IsNullOrEmpty(accepted)||!accepted.StartsWith("Bearer ",StringComparison.Ordinal))return;
      token=accepted.Substring(7);lastBridgeSuccess=Time.unscaledTime;bridgeWarning=false;
      try{string file=ConfigFile("TikMnG.LocalConnection.token");if(!File.Exists(file)||File.ReadAllText(file).Trim()!=token){File.WriteAllText(file,token);Logger.LogInfo("Local connection credentials synchronized after successful authentication.");}}catch{}
    }
    void BridgeFailed(UnityWebRequest request){
      if(request.responseCode==403&&request.GetRequestHeader("Authorization")=="Bearer "+token){credentialSlot=(credentialSlot+1)%2;token="";lastBridgeSuccess=-1000;}
      if(!bridgeWarning){Logger.LogWarning("Local service reconnecting: HTTP "+request.responseCode);bridgeWarning=true;}
    }
    void RecoverBridge(bool force=false){
      if(BridgeOnline&&!force)return;if(!force&&Time.unscaledTime<nextBridgeBootstrap)return;nextBridgeBootstrap=Time.unscaledTime+15;
      if(bridgeBootstrap!=null){try{if(!bridgeBootstrap.HasExited)return;}catch{}bridgeBootstrap.Dispose();bridgeBootstrap=null;}
      if(bootstrap==null||string.IsNullOrEmpty(bootstrap.launcher)){menuNotice="Yerel hizmet için masaüstündeki TikMnG Sesli Sürüş kısayolunu açın. Oyun çevrimdışı oynanabilir.";return;}
      try{
        string launcher=Path.GetFullPath(bootstrap.launcher);if(!File.Exists(launcher)||Path.GetExtension(launcher)!=".ps1"||launcher.Contains("\""))return;
        var start=new System.Diagnostics.ProcessStartInfo{FileName=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell\\v1.0\\powershell.exe"),Arguments="-NoProfile -ExecutionPolicy Bypass -File \""+launcher+"\" -PrepareOnly",WorkingDirectory=Path.GetDirectoryName(launcher),UseShellExecute=false,CreateNoWindow=true,WindowStyle=System.Diagnostics.ProcessWindowStyle.Hidden};
        bridgeBootstrap=System.Diagnostics.Process.Start(start);Logger.LogInfo("Local service recovery started in the background.");
      }catch(Exception error){Logger.LogWarning("Local service recovery: "+error.GetType().Name);}
    }
  }
}
