using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    float lastReadyHeartbeat=-1000;
    Ack previewResult;
    float previewFeedbackUntil;string previewFeedback="";
    void StartRulePreview(GiftRule rule){
      if(menuBusy||startingGame||rule==null||!NumbersValid())return;
      string snapshot=JsonUtility.ToJson(rule);previewResult=null;
      StartCoroutine(RunRulePreview(snapshot,ActionName(rule.action)));
    }
    void PreviewFailure(string message){previewResult=new Ack{ok=false,message=message};menuNotice="Test uygulanmadı: "+message;previewFeedback=menuNotice;previewFeedbackUntil=Time.unscaledTime+7;}
    IEnumerator RunRulePreview(string json,string actionName){
      menuBusy=true;bool reopen=false;
      try{
        if(!BridgeOnline){
          menuNotice="Test bağlantısı hazırlanıyor...";RecoverBridge(true);float limit=Time.unscaledTime+15;
          while(!BridgeOnline){if(Time.unscaledTime>limit){PreviewFailure("Yerel bağlantı hazırlanamadı.");yield break;}yield return null;}
        }
        if(!Ready){
          if(!menuOpen)ToggleMenu();menuNotice="Test parkuru açılıyor...";yield return EnterGame();
          if(!Ready){PreviewFailure("Parkur açılamadı. "+menuNotice);yield break;}
          if(!menuOpen)ToggleMenu();
        }
        float waitFrom=Time.unscaledTime,readyLimit=waitFrom+6;
        while(lastReadyHeartbeat<waitFrom){if(Time.unscaledTime>readyLimit){PreviewFailure("Oyun bağlantısı yanıt vermedi.");yield break;}yield return null;}
        var selected=JsonUtility.FromJson<GiftRule>(json);
        if(menuOpen&&selected.action!="shield"&&selected.action!="repair"){reopen=selected.action=="forward"||selected.action=="restart"||selected.action=="backward";ToggleMenu();}
        Command command;
        using(var request=Post("/mod/test-action",json)){
          menuNotice=actionName+" test ediliyor...";yield return request.SendWebRequest();
          if(request.result!=UnityWebRequest.Result.Success){
            ErrorBody error=null;try{error=JsonUtility.FromJson<ErrorBody>(request.downloadHandler.text);}catch{}
            PreviewFailure(error!=null?error.error:"Test isteği gönderilemedi.");yield break;
          }
          command=JsonUtility.FromJson<Command>(request.downloadHandler.text);
        }
        if(command==null||string.IsNullOrEmpty(command.id)){PreviewFailure("Test yanıtı geçersiz.");yield break;}
        float deadline=Time.unscaledTime+Mathf.Max(8,GiftTravelDuration(GiftDistance(command.distance),command.action=="backward",command.action=="tornado")+6);
        while(!applied.ContainsKey(command.id)){if(Time.unscaledTime>deadline){PreviewFailure("Oyundan uygulama onayı gelmedi.");yield break;}yield return null;}
        previewResult=applied[command.id];menuNotice=(previewResult.ok?"Test uygulandı: ":"Test uygulanmadı: ")+actionName+" · "+previewResult.message;previewFeedback=menuNotice;previewFeedbackUntil=Time.unscaledTime+7;
      }finally{if(reopen&&enteredGame&&!menuOpen)ToggleMenu();menuBusy=false;}
    }
    void DrawPreviewFeedback(){
      if(Time.unscaledTime>=previewFeedbackUntil||Screen.width<900)return;PrepareStyles();
      var style=new GUIStyle(textStyle){fontSize=18,wordWrap=true};style.normal.textColor=Color.black;
      var rect=new Rect(25,Screen.height-82,Mathf.Min(760,Screen.width-50),65);GUI.Label(rect,previewFeedback,style);rect.x-=1;rect.y-=1;style.normal.textColor=Color.white;GUI.Label(rect,previewFeedback,style);
    }
  }
}
