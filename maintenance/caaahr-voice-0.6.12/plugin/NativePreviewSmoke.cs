using System;
using System.Collections;
using System.IO;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    IEnumerator CheckRulePreviewWorkflow(){
      string saved=File.ReadAllText(Path.Combine(dataDir,"settings.json"));var original=draft;bool dirty=menuDirty;
      draft=JsonUtility.FromJson<ModSettings>(JsonUtility.ToJson(draft));
      var preview=new GiftRule{id="unsaved-native-preview",giftId="7934",action="forward",distance=17};
      var rules=new System.Collections.Generic.List<GiftRule>(draft.rules);rules.Add(preview);draft.rules=rules.ToArray();menuDirty=true;
      Require(!Ready,"preview_scenario_starts_without_an_active_race");StartRulePreview(preview);float deadline=Time.unscaledTime+35;
      while(menuBusy){if(Time.unscaledTime>deadline)throw new Exception("Unsaved preview timed out");yield return null;}
      Require(previewResult!=null&&previewResult.ok,"unsaved_rule_preview_auto_opens_race_and_executes");
      Require(CustomActive&&Ready&&TrackProgress>15&&TrackProgress<19,"unsaved_17m_preview_really_moves_native_car");
      Require(menuOpen&&menuDirty,"preview_keeps_menu_and_unsaved_edits");tab=1;yield return new WaitForSecondsRealtime(.6f);yield return Snapshot("unsaved-rule-preview");
      MoveOnTrack(-TrackProgress);preview.distance=23;StartRulePreview(preview);deadline=Time.unscaledTime+12;
      while(menuBusy){if(Time.unscaledTime>deadline)throw new Exception("Edited preview timed out");yield return null;}
      qaReport["edited_preview_progress"]=TrackProgress;qaReport["edited_preview_input_db"]=Db;Require(previewResult!=null&&previewResult.ok&&TrackProgress>21&&TrackProgress<25,"preview_uses_current_edited_distance_not_saved_rule");
      Require(File.ReadAllText(Path.Combine(dataDir,"settings.json"))==saved,"preview_never_saves_or_overwrites_user_bindings");
      draft=original;menuDirty=dirty;
    }
    IEnumerator RunPreviewAndVenueSmoke(){
      float limit=Time.unscaledTime+25;qaDb=-80;
      while(!serverSettingsLoaded||gifts.Length<680){if(Time.unscaledTime>limit)throw new Exception("Preview service initialization timed out");yield return null;}
      yield return CheckRulePreviewWorkflow();ToggleMenu();MoveOnTrack(-TrackProgress);yield return new WaitForSecondsRealtime(.8f);yield return Snapshot("race-start-venue");
      MoveOnTrack(builtLength-24-TrackProgress);yield return new WaitForSecondsRealtime(.8f);yield return Snapshot("race-finish-approach");
      MoveOnTrack(builtLength);yield return new WaitForSecondsRealtime(.6f);
      Require(trackFinished&&finishBursts.Count==2&&finishBursts[0].particleCount>0,"finish_celebration_really_emits_particles");yield return Snapshot("track-finish");
      yield return new WaitForSecondsRealtime(3);Require(finishBursts[0].particleCount==0&&finishBursts[1].particleCount==0,"confetti_expires_instead_of_looping_forever");Require(Ready&&!trackFinished&&TrackProgress<2,"finish_automatically_starts_new_round");
      StartRulePreview(new GiftRule{action="forward",distance=9});limit=Time.unscaledTime+15;
      while(menuBusy){if(Time.unscaledTime>limit)throw new Exception("Finished race preview did not restart");yield return null;}
      Require(previewResult!=null&&previewResult.ok&&Ready&&!trackFinished&&TrackProgress>8&&TrackProgress<11,"test_after_finish_restarts_race_and_executes");
      Require(finishBursts[0].particleCount==0,"new_race_resets_finish_celebration");
      yield return CheckDisplayControls();
    }
  }
}
