using CircuitSuperstars;
using CircuitSuperstars.TrackData;
using System.Text.Json;
using Il2CppInterop.Runtime.Attributes;
using UnityEngine;
using UObj=UnityEngine.Object;

namespace TikMnG.Arcade;

public sealed class RoundWinner
{
    public int Place {get;set;}
    public string Username {get;set;}="";
    public string Nickname {get;set;}="";
    public string Avatar {get;set;}="";
    public float Time {get;set;}
}

public sealed partial class ArcadeDirector
{
    private bool startRequested,awaitingQueueAdmission;
    private int roundNumber=1,roundEntrants;
    private string roundEndReason;
    private float podiumUntil,startRequestedAt,countdownStartedAt,greenFlagAt;
    private float resetStartedAt;
    private IntPtr previousRaceStage;
    private readonly List<RoundWinner> roundWinners=new();
    private readonly List<RoundWinner[]> roundHistory=new();
    private string RoundHistoryFile=>Path.Combine(control,resultsBoardQaRun==null?"round-results.json":Path.Combine("qa","round-results-"+resultsBoardQaRun+".json"));
    public bool HasRoundParticipants=>cameraReady&&entries.Count>0&&!RoundTransitioning;
    public bool StartRequested=>startRequested;
    public bool NativeStartReleased=>startRequested&&countdownEnd>0&&Time.realtimeSinceStartup>=countdownEnd;
    public bool RoundTransitioning=>phase is "podium" or "resetting";

    public void NativeCountdownStarted(float seconds)
    {
        if(!startRequested||RoundTransitioning)return;
        countdownStartedAt=Time.realtimeSinceStartup;
        countdownEnd=countdownStartedAt+Math.Max(0,seconds);
        phase="countdown";
        Plugin.Output.LogInfo($"Round {roundNumber}: native countdown {seconds:0.00}s.");
    }
    public void NativeRaceStarted()
    {
        if(!startRequested||Running||RoundTransitioning)return;
        StopPresentationClips();
        Running=true;countdownEnd=0;phase="racing";
        greenFlagAt=Time.realtimeSinceStartup;
        StartExpandedGridAi();
        Plugin.Output.LogInfo($"Round {roundNumber}: native green flag.");
    }
    private void UpdateRoundLifecycle()
    {
        if(startRequested&&!Running&&!RoundTransitioning&&countdownEnd>0&&Time.realtimeSinceStartup>=countdownEnd&&RaceManager.Instance?.LocalStageId==RaceStageId.Racing)NativeRaceStarted();
        if(phase=="podium")
        {
            if(Time.realtimeSinceStartup>=podiumUntil)ResetRound();
            return;
        }
        if(phase=="resetting")
        {
            var manager=RaceManager.Instance;
            if(!GameStateManager.IsTransitioning&&manager?.LocalStageId==RaceStageId.RaceOpening&&
                manager.localStage.Pointer!=previousRaceStage&&(nativeGridTest||ActiveCars().Length==0))
            {
                awaitingQueueAdmission=pendingJoins.Count>0;
                TryEnableCamera();
                if(cameraReady)Plugin.Output.LogInfo($"Round {roundNumber}: empty grid ready in {Time.realtimeSinceStartup-resetStartedAt:0.00}s.");
            }
            if(!cameraReady&&Time.realtimeSinceStartup-resetStartedAt>=20)
            {
                error="Yeni yarış zamanında hazırlanamadı. Oyunu yeniden açın.";
                phase="error";
                Plugin.Output.LogError($"Round {roundNumber}: reset timed out at {manager?.LocalStageId}.");
            }
            return;
        }
        if(!Running||RaceManager.Instance?.RacerData==null)return;
        var data=RaceManager.Instance.RacerData;
        var finished=entries.Where(e=>data.FinishTimes.ContainsKey(e.Id)&&
                RaceEconomy.ValidFinish(data.IsFinished(e.Id),data.FinishTimes[e.Id],CurrentLap(e),settings.Laps))
            .OrderBy(e=>data.FinishTimes[e.Id]).ToArray();
        var required=Math.Max(roundEntrants,entries.Count);
        if(!RaceEconomy.PodiumComplete(required,finished.Length))return;
        CompleteRound(finished,data,required>3?"top-three-finished":"everyone-finished");
    }
    [HideFromIl2Cpp]
    public void EndRaceManually()
    {
        if(!Running||RoundTransitioning)return;
        var data=RaceManager.Instance?.RacerData;
        if(data==null)return;
        var finished=entries.Where(e=>data.FinishTimes.ContainsKey(e.Id)&&
                RaceEconomy.ValidFinish(data.IsFinished(e.Id),data.FinishTimes[e.Id],CurrentLap(e),settings.Laps))
            .OrderBy(e=>data.FinishTimes[e.Id]).ToArray();
        var order=finished.Concat(entries.Where(e=>!finished.Contains(e))
            .OrderBy(e=>RacePlace(e)>0?RacePlace(e):int.MaxValue).ThenBy(e=>e.Slot)).ToArray();
        CompleteRound(order,data,"manual-p");
    }
    [HideFromIl2Cpp]
    private void CompleteRound(ViewerCar[] order,CircuitSuperstars.RacerData data,string reason)
    {
        if(!Running||order.Length==0)return;
        roundWinners.Clear();
        for(var i=0;i<Math.Min(3,order.Length);i++)
        {
            var e=order[i];
            var valid=data.FinishTimes.ContainsKey(e.Id)&&RaceEconomy.ValidFinish(data.IsFinished(e.Id),data.FinishTimes[e.Id],CurrentLap(e),settings.Laps);
            roundWinners.Add(new RoundWinner{Place=i+1,Username=e.Username,Nickname=e.Nickname,Avatar=e.Avatar,Time=valid?data.FinishTimes[e.Id]:0});
        }
        roundEndReason=reason;Running=false;phase="podium";podiumUntil=Time.realtimeSinceStartup+4;
        StopPresentationClips();
        StopVehicleAudio();
        showPanel=false;countdownEnd=0;LeaveFollow();CaptureCursor(false);
        BeginWinnerCelebration(order[0]);
        foreach(var e in entries.Where(IsCarAlive))
        {
            e.Car.aiInput.StopAi();e.Car.DisableAutomobilePhysics();
        }
        roundHistory.Add(roundWinners.ToArray());
        RecordRoundResults();
        while(roundHistory.Count>20)roundHistory.RemoveAt(0);
        WriteRoundHistory();
        Plugin.Output.LogInfo($"Round {roundNumber}: results shown ({reason}); {roundWinners.Count} podium places.");
    }
    private void WriteRoundHistory()
    {
        var file=RoundHistoryFile;
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        var pending=file+".tmp";
        try
        {
            File.WriteAllText(pending,JsonSerializer.Serialize(new{
            utc=DateTime.UtcNow,pid=Environment.ProcessId,round=roundNumber,laps=settings.Laps,
            results=roundHistory.ToArray()},jsonOptions));
            File.Move(pending,file,true);
        }
        catch(Exception ex) when(ex is IOException or UnauthorizedAccessException)
        {
            Plugin.Output.LogWarning("Round history could not be written: "+ex.Message);
        }
    }
    private void ResetRound()
    {
        var manager=RaceManager.Instance??throw new InvalidOperationException("Yerel yarış oturumu bulunamadı.");
        previousRaceStage=manager.localStage?.Pointer??IntPtr.Zero;
        resetStartedAt=Time.realtimeSinceStartup;
        phase="resetting";Running=false;startRequested=false;countdownEnd=0;
        StopPresentationClips();
        cameraReady=false;
        ClearCinematicCamera();
        ClearRaceMarshalScene();
        ClearForwardGiftScene();
        ClearResultsBoardScene();
        ClearAudienceAvatarScene();
        StopVehicleAudio();
        foreach(var e in entries)
        {
            if(e.Visual?.OutlineMaterial!=null)UObj.Destroy(e.Visual.OutlineMaterial);
            if(e.Visual?.RearWindowMaterial!=null)UObj.Destroy(e.Visual.RearWindowMaterial);
        }
        ParticipantManager.ServerDestroyPlayingAndPaddingAiParticipants();
        entries.Clear();likeTotals.Clear();rewardedFollows.Clear();followed=null;trackMapOpen=false;gridOrderDirty=false;
        passingOffsets.Clear();
        roundNumber++;roundEntrants=0;
        nativeOverlays=null;
        brandPasses=0;brandMaterials.Clear();brandCoverage.Clear();nextBrandPass=0;
        speedPath=Array.Empty<Vector2>();
        // Restart the race, not the host: the native disconnect/reconnect path can
        // reject a second host even after the transport reports fully stopped.
        Plugin.Output.LogInfo("Starting an empty race in the existing local spectator session.");
        manager.ServerRestartRace();
    }
    private void AdmitWaitingParticipants()
    {
        if(RoundTransitioning||startRequested||Running)return;
        awaitingQueueAdmission=false;
    }
    private void ResetSpectatorPose()
    {
        if(view==null)return;
        var track=UObj.FindObjectOfType<TrackSceneData>();
        if(track?.vehicleSpawnMarkerList?.markers==null||track.vehicleSpawnMarkerList.markers.Length==0)return;
        var grid=track.vehicleSpawnMarkerList.markers[0];
        if(entries.Count>12)
        {
            var positions=BuildExpandedStartingGrid(track.vehicleSpawnMarkerList.markers,entries.Count);
            var center=positions.Aggregate(Vector3.zero,(sum,pose)=>sum+pose.position)/positions.Length;
            var varianceX=positions.Average(p=>Mathf.Pow(p.position.x-center.x,2));
            var varianceZ=positions.Average(p=>Mathf.Pow(p.position.z-center.z,2));
            var covariance=positions.Average(p=>(p.position.x-center.x)*(p.position.z-center.z));
            var angle=.5f*Mathf.Atan2(2*covariance,varianceX-varianceZ);
            var axis=new Vector3(Mathf.Cos(angle),0,Mathf.Sin(angle)).normalized;
            var side=Vector3.Cross(Vector3.up,axis).normalized;
            view.fieldOfView=settings.FieldOfView;
            view.transform.position=center+side*44+Vector3.up*34;
            view.transform.LookAt(center+Vector3.up*1.5f);
            yaw=view.transform.eulerAngles.y;pitch=view.transform.eulerAngles.x;
            return;
        }
        view.transform.position=grid.position+grid.forward*18+Vector3.up*15;
        view.transform.LookAt(grid.position-grid.forward*12);
        yaw=view.transform.eulerAngles.y;pitch=view.transform.eulerAngles.x;
    }
    private static string FinishTime(float seconds)
    {
        var value=TimeSpan.FromSeconds(Math.Max(0,seconds));
        return $"{(int)value.TotalMinutes:00}:{value.Seconds:00}.{value.Milliseconds/10:00}";
    }
    private void DrawRoundPodium()
    {
        PrepareHudStyles();
        // A small corner card leaves the real crowned winner and orbit unobstructed.
        Fill(new Rect(24,500,352,260),new Color(.022f,.035f,.047f,.88f));
        Fill(new Rect(24,500,4,260),new Color(1,.72f,.2f));
        Label(42,513,318,29,"YARIŞ SONUCU",new GUIStyle(heading){fontSize=20});
        var row=0;
        foreach(var winner in roundWinners.OrderBy(w=>w.Place))
        {
            var first=winner.Place==1;
            var y=550+row++*64;
            var medal=first?new Color(1,.80f,.32f):winner.Place==2?new Color(.79f,.88f,.94f):new Color(.96f,.64f,.42f);
            var portraitSize=first?48:42;
            var snapshot=new ViewerCar{Username=winner.Username,Avatar=winner.Avatar};
            Label(40,y+5,34,36,winner.Place.ToString("00"),new GUIStyle(heading){fontSize=23,normal={textColor=medal}});
            DrawPortrait(snapshot,new Rect(82,y+3,portraitSize,portraitSize));
            var username="@"+winner.Username;
            var nameStyle=new GUIStyle(body){fontSize=first?20:18,fontStyle=FontStyle.Bold};
            while(nameStyle.fontSize>12&&nameStyle.CalcSize(new GUIContent(username)).x>216)nameStyle.fontSize--;
            Label(142,y,216,27,username,nameStyle);
            var timeStyle=new GUIStyle(body){fontSize=first?24:20,fontStyle=FontStyle.Bold};timeStyle.normal.textColor=medal;
            Label(142,y+26,216,29,winner.Time>0?FinishTime(winner.Time):"MANUEL BİTİŞ",timeStyle);
        }
        var remaining=Math.Max(0,Mathf.CeilToInt(podiumUntil-Time.realtimeSinceStartup));
        Label(942,744,310,28,$"TSUKUBA · {settings.Laps} TUR · YENİ TUR {remaining}",new GUIStyle(small){alignment=TextAnchor.MiddleRight});
    }
    private void DrawRoundReset()
    {
        PrepareHudStyles();
        Fill(new Rect(-2000,-2000,6000,6000),new Color(.008f,.013f,.017f,.97f));
        Picture(new Rect(590,285,100,100),"logo.png");
        Label(240,414,800,54,"YENİ YARIŞ HAZIRLANIYOR",new GUIStyle(big){fontSize=34,alignment=TextAnchor.MiddleCenter});
        Label(390,478,500,28,"Pist temizleniyor · araçlar hediyelerle yeniden katılacak",new GUIStyle(small){alignment=TextAnchor.MiddleCenter});
        Fill(new Rect(500,540,280,3),Line);
        var pulse=.25f+.75f*Mathf.PingPong(Time.realtimeSinceStartup*.8f,1);
        Fill(new Rect(500,540,280*pulse,3),Accent);
    }
}
