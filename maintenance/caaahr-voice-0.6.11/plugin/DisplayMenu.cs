using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

namespace TikMnG.Caaahr {
  [Serializable] public class DisplaySettings {public bool configured;public string mode="borderless";public int width,height,quality=-1,vSync=1,frameLimit=60;}
  public partial class VoiceDrive {
    DisplaySettings displayDraft,displayBackup;
    FullScreenMode backupMode;int backupVSync,backupFrameLimit;
    string displayPicker,displaySignature="";Vector2 displayScroll;
    float displayConfirmUntil,displayVerifyAfter;bool displaySaving;
    DisplaySettings savedWindowDisplay;float savedWindowUntil,savedWindowNext;int savedWindowRetries;
    FullScreenMode RequestedDisplayMode {get{return displayDraft.mode=="windowed"?FullScreenMode.Windowed:displayDraft.mode=="fullscreen"?FullScreenMode.ExclusiveFullScreen:FullScreenMode.FullScreenWindow;}}
    DisplaySettings CopyDisplay(DisplaySettings value){return JsonUtility.FromJson<DisplaySettings>(JsonUtility.ToJson(value));}
    DisplaySettings CaptureDisplay(){return new DisplaySettings{configured=true,mode=Screen.fullScreenMode==FullScreenMode.Windowed?"windowed":Screen.fullScreenMode==FullScreenMode.ExclusiveFullScreen?"fullscreen":"borderless",width=Screen.width,height=Screen.height,quality=appliedQuality,vSync=Mathf.Clamp(QualitySettings.vSyncCount,0,1),frameLimit=Application.targetFrameRate<15?-1:Application.targetFrameRate};}
    void SetDisplay(DisplaySettings value,FullScreenMode? exactMode=null){
      ApplyGraphicsQuality(value.quality);
      QualitySettings.vSyncCount=value.vSync;Application.targetFrameRate=value.frameLimit;
      var mode=exactMode??(value.mode=="windowed"?FullScreenMode.Windowed:value.mode=="fullscreen"?FullScreenMode.ExclusiveFullScreen:FullScreenMode.FullScreenWindow);
      SetDisplayResolution(value,mode);
    }
    void SetDisplayResolution(DisplaySettings value,FullScreenMode mode){
      int width=Mathf.Clamp(value.width,320,16384),height=Mathf.Clamp(value.height,240,16384);
      if(mode==FullScreenMode.Windowed){width=Mathf.Min(width,Mathf.Max(640,Screen.currentResolution.width-80));height=Mathf.Min(height,Mathf.Max(480,Screen.currentResolution.height-100));}
      Screen.SetResolution(width,height,mode);
    }
    void RetrySavedWindow(){
      if(savedWindowDisplay==null)return;
      if(Time.unscaledTime>=savedWindowUntil||savedWindowRetries<=0){savedWindowDisplay=null;return;}
      if(Time.unscaledTime<savedWindowNext)return;
      savedWindowNext=Time.unscaledTime+1;
      var wanted=savedWindowDisplay.mode=="windowed"?FullScreenMode.Windowed:savedWindowDisplay.mode=="fullscreen"?FullScreenMode.ExclusiveFullScreen:FullScreenMode.FullScreenWindow;
      if(Screen.fullScreenMode==wanted)return;
      savedWindowRetries--;SetDisplayResolution(savedWindowDisplay,wanted);
    }
    void ApplySavedDisplay(DisplaySettings value){
      if(value==null||!value.configured){savedWindowDisplay=null;return;}
      if(displayConfirmUntil>0||displaySaving||Time.unscaledTime<2)return;
      string signature=JsonUtility.ToJson(value);if(signature==displaySignature){RetrySavedWindow();return;}
      SetDisplay(value);displaySignature=signature;displayDraft=CopyDisplay(value);
      // The game's startup settings can override the first asynchronous mode change.
      savedWindowDisplay=CopyDisplay(value);
      savedWindowUntil=Time.unscaledTime+20;savedWindowNext=Time.unscaledTime+1;savedWindowRetries=8;
    }
    void UpdateDisplay(){
      if(displayConfirmUntil>0&&!displaySaving&&displayVerifyAfter>0&&Time.unscaledTime>=displayVerifyAfter){
        displayVerifyAfter=0;
        if(Screen.fullScreenMode!=RequestedDisplayMode){RollbackDisplay();menuNotice="İstenen ekran modu bu oturumda uygulanamadı; önceki ayarlar korundu.";}
      }
      if(displayConfirmUntil>0&&!displaySaving&&(Time.unscaledTime>=displayConfirmUntil||Input.GetKeyDown(KeyCode.Escape)))RollbackDisplay();
      if(displayConfirmUntil<=0&&Input.GetKeyDown(KeyCode.Escape))displayPicker=null;
      if(draft!=null)ApplySavedDisplay(draft.graphics);
    }
    void BeginDisplayPreview(){
      if(displayConfirmUntil>0||displaySaving||displayDraft==null)return;
      savedWindowDisplay=null;
      displayBackup=CaptureDisplay();displayBackupGraphics=GraphicsSnapshot.Capture();backupMode=Screen.fullScreenMode;backupVSync=QualitySettings.vSyncCount;backupFrameLimit=Application.targetFrameRate;
      displayDraft.configured=true;displayDraft.quality=Mathf.Clamp(displayDraft.quality,-1,3);
      SetDisplay(displayDraft);displayConfirmUntil=Time.unscaledTime+15;displayVerifyAfter=Time.unscaledTime+1.2f;displayPicker=null;
    }
    void RollbackDisplay(){
      savedWindowDisplay=null;
      if(displayBackup!=null){SetDisplay(displayBackup,backupMode);if(displayBackupGraphics!=null)displayBackupGraphics.Restore();QualitySettings.vSyncCount=backupVSync;Application.targetFrameRate=backupFrameLimit;displayDraft=CopyDisplay(displayBackup);}
      displayBackup=null;displayBackupGraphics=null;displayConfirmUntil=displayVerifyAfter=0;displayPicker=null;menuNotice="Önceki görüntü ayarlarına dönüldü.";
    }
    IEnumerator KeepDisplay(){
      if(displaySaving||displayConfirmUntil<=0)yield break;
      if(Screen.fullScreenMode!=RequestedDisplayMode){RollbackDisplay();menuNotice="Ekran modu uygulanamadı; ayarlar kaydedilmedi.";yield break;}
      if(!BridgeOnline){RollbackDisplay();menuNotice="Görüntü ayarı kaydedilemedi; yerel bağlantı hazır değil.";yield break;}
      displaySaving=true;
      using(var request=Post("/mod/graphics",JsonUtility.ToJson(displayDraft))){
        yield return request.SendWebRequest();
        if(request.result==UnityWebRequest.Result.Success){
          draft.graphics=CopyDisplay(displayDraft);displaySignature=JsonUtility.ToJson(displayDraft);displayBackup=null;displayBackupGraphics=null;displayConfirmUntil=0;menuNotice="Görüntü ayarları kalıcı olarak kaydedildi.";
        }else{RollbackDisplay();menuNotice="Görüntü ayarı kaydedilemedi; önceki ayarlar korundu.";}
      }
      displaySaving=false;
    }
    List<Vector2Int> DisplayResolutions(){
      var values=new List<Vector2Int>();foreach(var resolution in Screen.resolutions){var size=new Vector2Int(resolution.width,resolution.height);if(resolution.width>=640&&resolution.height>=480&&!values.Contains(size))values.Add(size);}
      foreach(var size in new[]{new Vector2Int(Screen.width,Screen.height),new Vector2Int(1280,720),new Vector2Int(1600,900),new Vector2Int(1920,1080)})if(size.x<=Mathf.Max(Screen.currentResolution.width,Screen.width)&&size.y<=Mathf.Max(Screen.currentResolution.height,Screen.height)&&!values.Contains(size))values.Add(size);
      values.Sort((a,b)=>(b.x*b.y).CompareTo(a.x*a.y));return values;
    }
    void DrawDisplay(){
      if(displayDraft==null)displayDraft=CaptureDisplay();
      bool pickerOpen=displayPicker!=null;GUI.enabled=MenuInputAllowed&&!pickerOpen;
      GUI.Label(new Rect(24,216,700,30),"Grafik ve ekran",headingStyle);
      string[] modes={"fullscreen","borderless","windowed"},titles={"Tam ekran","Pencereli tam ekran","Pencereli"};
      for(int i=0;i<modes.Length;i++)if(Button(new Rect(35+i*350,270,330,38),titles[i],displayDraft.mode==modes[i]))displayDraft.mode=modes[i];
      Label(35,326,490,"Çözünürlük");Label(590,326,490,"Grafik kalitesi");
      if(Button(new Rect(35,360,490,40),displayDraft.width+" × "+displayDraft.height+"  ▾")){displayPicker=displayPicker=="resolution"?null:"resolution";displayScroll=Vector2.zero;}
      if(Button(new Rect(590,360,490,40),QualityName(displayDraft.quality)+"  ▾")){displayPicker=displayPicker=="quality"?null:"quality";displayScroll=Vector2.zero;}
      Label(35,430,490,"FPS sınırı");GUI.enabled=MenuInputAllowed&&!pickerOpen&&displayDraft.vSync==0;
      if(Button(new Rect(35,464,490,40),(displayDraft.frameLimit<0?"Sınırsız":displayDraft.frameLimit+" FPS")+"  ▾")){displayPicker=displayPicker=="fps"?null:"fps";displayScroll=Vector2.zero;}GUI.enabled=MenuInputAllowed&&!pickerOpen;
      bool sync=GUI.Toggle(new Rect(590,460,30,30),displayDraft.vSync>0,"");displayDraft.vSync=sync?1:0;Label(630,462,440,"V-Sync · Dikey eşitleme");
      GUI.enabled=MenuInputAllowed&&!pickerOpen&&!menuBusy&&!displaySaving&&BridgeOnline;if(Button(new Rect(800,586,280,42),"Uygula",true))BeginDisplayPreview();GUI.enabled=MenuInputAllowed;
      if(displayPicker==null)return;
      bool right=displayPicker=="quality";float x=right?590:35,y=displayPicker=="fps"?505:401;float height=displayPicker=="fps"?145:225;
      Fill(new Rect(x,y,490,height),new Color(.98f,.99f,1));
      if(Button(new Rect(x+451,y+3,32,28),"×")){displayPicker=null;return;}
      var resolutions=DisplayResolutions();int[] rates={30,60,90,120,144,165,240,-1};int count=displayPicker=="resolution"?resolutions.Count:displayPicker=="quality"?qualityTitles.Length:rates.Length;
      displayScroll=GUI.BeginScrollView(new Rect(x+5,y+34,480,height-38),displayScroll,new Rect(0,0,454,count*36));
      for(int i=0;i<count;i++){
        string title=displayPicker=="resolution"?resolutions[i].x+" × "+resolutions[i].y:displayPicker=="quality"?QualityName(i-1):rates[i]<0?"Sınırsız":rates[i]+" FPS";
        if(Button(new Rect(0,i*36,450,32),title)){
          if(displayPicker=="resolution"){displayDraft.width=resolutions[i].x;displayDraft.height=resolutions[i].y;}else if(displayPicker=="quality")displayDraft.quality=i-1;else displayDraft.frameLimit=rates[i];displayPicker=null;break;
        }
      }
      GUI.EndScrollView();
    }
    void DrawDisplayConfirmation(){GUI.ModalWindow(572601,new Rect(230,240,660,185),DisplayConfirmationWindow,"",GUIStyle.none);}
    void DisplayConfirmationWindow(int id){
      Fill(new Rect(0,0,660,185),Color.white);GUI.Label(new Rect(24,20,610,32),"Bu görüntü ayarları korunsun mu?",headingStyle);
      Label(24,61,610,displaySaving?"Kaydediliyor...":Mathf.CeilToInt(displayConfirmUntil-Time.unscaledTime)+" saniye");GUI.enabled=!displaySaving;
      if(Button(new Rect(24,116,290,42),"Koru",true))StartCoroutine(KeepDisplay());if(Button(new Rect(340,116,290,42),"Geri al"))RollbackDisplay();GUI.enabled=true;
    }
  }
}
