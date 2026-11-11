namespace TikMnG.Arcade;

public sealed partial class ArcadeDirector
{
    private readonly Dictionary<string,FMOD.Studio.Bus> nativeAudioBuses=new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string,FMOD.Studio.VCA> nativeAudioVcas=new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string,FMOD.Studio.EventDescription> nativeAudioSnapshots=new(StringComparer.OrdinalIgnoreCase);
    private const string NativePauseSnapshot="snapshot:/Paused";
    private int pausedMixRecoveries;
    private float nextPausedMixCheck;

    private void DiscoverAudioRouting(FMOD.Studio.Bank bank)
    {
        if(bank.getVCAList(out var vcas)==FMOD.RESULT.OK)
            foreach(var vca in vcas)if(vca.getPath(out var path)==FMOD.RESULT.OK)nativeAudioVcas[path]=vca;
        if(bank.getEventList(out var descriptions)==FMOD.RESULT.OK)
            foreach(var description in descriptions)
                if(description.isSnapshot(out var snapshot)==FMOD.RESULT.OK&&snapshot&&description.getPath(out var path)==FMOD.RESULT.OK)
                    nativeAudioSnapshots[path]=description;
    }

    private void ApplyNativeAudioRouting()
    {
        foreach(var pair in nativeAudioBuses)
        {
            var level=RaceAudioPolicy.BusVolume(pair.Key,settings.EngineVolume,settings.CrowdVolume,phase=="staging");
            if(level.HasValue&&pair.Value.isValid())
                AudioStep("route:"+pair.Key,()=>AudioOk("route:"+pair.Key,pair.Value.setVolume(level.Value)));
        }
    }

    private void KeepNativeRaceMixActive()
    {
        if(!Running||IsPaused||UnityEngine.Time.unscaledTime<nextPausedMixCheck)return;
        nextPausedMixCheck=UnityEngine.Time.unscaledTime+.15f;
        if(!nativeAudioSnapshots.TryGetValue(NativePauseSnapshot,out var pause)||!pause.isValid())return;
        if(!AudioOk("native-pause-list",pause.getInstanceList(out var instances)))return;
        foreach(var instance in instances)
        {
            if(!instance.isValid()||instance.getPlaybackState(out var state)!=FMOD.RESULT.OK||
                state is not (FMOD.Studio.PLAYBACK_STATE.PLAYING or FMOD.Studio.PLAYBACK_STATE.STARTING or FMOD.Studio.PLAYBACK_STATE.SUSTAINING))continue;
            if(AudioOk("native-pause-stop",instance.stop(FMOD.Studio.STOP_MODE.IMMEDIATE)))pausedMixRecoveries++;
        }
    }

    private void ReproduceNativePauseForQa()
    {
        if(resultsBoardQaRun==null||liveStatus=="connected"||!Running||
            !nativeAudioSnapshots.TryGetValue(NativePauseSnapshot,out var pause))return;
        if(pause.createInstance(out var instance)!=FMOD.RESULT.OK)return;
        instance.start();
        instance.release();
        UnityEngine.Time.timeScale=0;
    }

    [Il2CppInterop.Runtime.Attributes.HideFromIl2Cpp]
    private object AudioRoutingStatus()=>new
    {
        buses=nativeAudioBuses.Select(pair=>AudioDiagnostic(pair.Key,()=>AudioBusStatus(pair.Value))).ToArray(),
        vcas=nativeAudioVcas.Select(pair=>AudioDiagnostic(pair.Key,()=>
        {
            var result=pair.Value.getVolume(out var volume,out var finalVolume);
            return new{path=pair.Key,result=result.ToString(),volume=AudioNumber(volume),finalVolume=AudioNumber(finalVolume)};
        })).ToArray(),
        snapshots=nativeAudioSnapshots.Select(pair=>AudioDiagnostic(pair.Key,()=>
        {
            var result=pair.Value.getInstanceList(out var instances);
            return new{path=pair.Key,result=result.ToString(),instances=result==FMOD.RESULT.OK?instances.Select(instance=>AudioDiagnostic(pair.Key,()=>
            {
                var playback=instance.getPlaybackState(out var state);
                var volumeResult=instance.getVolume(out var volume,out var finalVolume);
                return new{handle=instance.handle.ToString(),playback=state.ToString(),result=playback.ToString(),volumeResult=volumeResult.ToString(),volume=AudioNumber(volume),finalVolume=AudioNumber(finalVolume)};
            })).ToArray():Array.Empty<object>()};
        })).ToArray()
    };
}
