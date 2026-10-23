using System;
using System.Collections;
using System.IO;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    IEnumerator CheckDisplayControls(){
      if(!menuOpen)ToggleMenu();tab=5;string saved=File.ReadAllText(Path.Combine(dataDir,"settings.json"));
      var original=CaptureDisplay();var originalQuality=GraphicsSnapshot.Capture();var mode=Screen.fullScreenMode;int sync=QualitySettings.vSyncCount,frame=Application.targetFrameRate;
      qaReport["native_quality_names"]=QualitySettings.names;qaReport["render_pipeline"]=originalQuality.pipeline?originalQuality.pipeline.GetType().Name:"Built-in";
      for(int level=0;level<4;level++){
        ApplyGraphicsQuality(level);yield return new WaitForSecondsRealtime(.2f);var current=GraphicsSnapshot.Capture();
        Require(appliedQuality==level&&Mathf.Approximately(current.lod,new[]{.65f,1,1.5f,2}[level])&&current.mipmap==(level==0?1:0),"quality_preset_"+level+"_changes_lod_and_textures");
        if(current.pipeline)Require(Mathf.Approximately(current.renderScale,new[]{.75f,.9f,1,1.15f}[level])&&current.samples==new[]{1,2,4,8}[level]&&Mathf.Approximately(current.pipelineShadowDistance,new[]{25f,45,70,95}[level]),"quality_preset_"+level+"_changes_native_render_scale_msaa_and_shadows");
      }
      ApplyGraphicsQuality(-1);Require(originalGraphics.MatchesCurrent(),"default_quality_restores_original_render_values");ApplyGraphicsQuality(original.quality);originalQuality.Restore();
      foreach(string selected in new[]{"windowed","borderless","fullscreen"}){
        displayDraft=CopyDisplay(original);displayDraft.mode=selected;displayDraft.width=selected=="windowed"?1280:Screen.currentResolution.width;displayDraft.height=selected=="windowed"?720:Screen.currentResolution.height;
        displayDraft.quality=selected=="borderless"?2:0;displayDraft.vSync=0;displayDraft.frameLimit=90;
        BeginDisplayPreview();yield return new WaitForSecondsRealtime(1.8f);
        var expected=selected=="windowed"?FullScreenMode.Windowed:selected=="fullscreen"?FullScreenMode.ExclusiveFullScreen:FullScreenMode.FullScreenWindow;
        if(selected=="fullscreen"&&Screen.fullScreenMode!=expected){
          qaReport["exclusive_fullscreen_test_focused"]=Application.isFocused;qaReport["exclusive_fullscreen_native_result"]=Screen.fullScreenMode.ToString();
          Require(displayConfirmUntil==0&&Screen.fullScreenMode==mode&&originalQuality.MatchesCurrent(),"rejected_exclusive_mode_restores_previous_display");continue;
        }
        Require(Screen.fullScreenMode==expected,"native_display_mode_"+selected+"_applies");
        Require(appliedQuality==displayDraft.quality&&QualitySettings.vSyncCount==0&&Application.targetFrameRate==90,"quality_vsync_and_fps_apply_"+selected);
        if(selected=="windowed"){Require(Screen.width==1280&&Screen.height==720,"windowed_resolution_applies");yield return Snapshot("display-windowed-confirmation");}
        RollbackDisplay();yield return new WaitForSecondsRealtime(1.3f);
        Require(Screen.fullScreenMode==mode&&originalQuality.MatchesCurrent()&&QualitySettings.vSyncCount==sync&&Application.targetFrameRate==frame,"display_revert_restores_"+selected);
      }
      displayDraft=CopyDisplay(original);displayDraft.mode="windowed";displayDraft.width=1280;displayDraft.height=720;BeginDisplayPreview();yield return new WaitForSecondsRealtime(1);
      displayConfirmUntil=Time.unscaledTime+.1f;yield return new WaitForSecondsRealtime(1.3f);
      Require(displayConfirmUntil==0&&Screen.fullScreenMode==mode,"display_timeout_automatically_reverts");
      Require(File.ReadAllText(Path.Combine(dataDir,"settings.json"))==saved,"display_preview_never_overwrites_user_settings");
      yield return Snapshot("display-menu");
    }
  }
}
