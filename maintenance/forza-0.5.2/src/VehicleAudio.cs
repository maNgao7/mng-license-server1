using CircuitSuperstars;
using UnityEngine;

namespace TikMnG.Arcade;

public sealed partial class ArcadeDirector
{
    private FMOD.Studio.Bus nativeEngineBus,crowdBus;
    private bool vehicleAudioFaulted,crowdVolumeApplied;
    private float nextAudioBankScan;
    private int audioBankScans,audioBankCount;
    private string audioBankScanResult="not-scanned",crowdBusPath="";
    private readonly Dictionary<string,string> vehicleAudioErrors=new(StringComparer.Ordinal);

    // Car sound is the game's own FMOD event on every native vehicle. This code only
    // applies the user's mix and keeps free-camera attenuation close to the race.
    // No engine event is replaced, restarted, repitched or individually muted.
    public void UpdateVehicleAudio()
    {
        if(view==null||RoundTransitioning||GameStateManager.IsTransitioning)return;
        if(Time.unscaledTime>=nextAudioBankScan)
        {
            nextAudioBankScan=Time.unscaledTime+(nativeEngineBus.isValid()?30f:1.5f);
            AudioStep("bank-discovery",DiscoverVehicleAudioBuses);
        }
        ApplyNativeAudioRouting();
        crowdVolumeApplied=crowdBus.isValid();
        AudioStep("listener",UpdateVehicleAudioListener);
    }
    private void AudioStep(string operation,Action action)
    {
        try{action();vehicleAudioErrors.Remove(operation+":exception");RefreshAudioFaultState();}
        catch(Exception ex){RecordAudioError(operation+":exception",ex.Message);}
    }
    private void RecordAudioError(string operation,string message)
    {
        if(!vehicleAudioErrors.TryGetValue(operation,out var previous)||previous!=message)
            Plugin.Output.LogWarning("Vehicle audio ["+operation+"]: "+message);
        vehicleAudioErrors[operation]=message;
        RefreshAudioFaultState();
    }
    private void RefreshAudioFaultState()=>vehicleAudioFaulted=vehicleAudioErrors.Keys.Any(key=>key!="graphics-settings");
    private bool AudioOk(string operation,FMOD.RESULT result)
    {
        if(result==FMOD.RESULT.OK){vehicleAudioErrors.Remove(operation);RefreshAudioFaultState();return true;}
        RecordAudioError(operation,result.ToString());return false;
    }
    private void UpdateVehicleAudioListener()
    {
        var system=FMODUnity.RuntimeManager.StudioSystem;
        if(!AudioOk("listener-count",system.getNumListeners(out var count)))return;
        if(count==0&&!AudioOk("listener-count-set",system.setNumListeners(1)))return;
        var attributes=FMODUnity.RuntimeUtils.To3DAttributes(view.transform);
        // A following listener travels with the car. Zero listener velocity made
        // the moving native engine produce a false Doppler shift even in chase view.
        if(IsCarAlive(followed)&&followed.Car.CachedRigidbody!=null)
        {
            var velocity=followed.Car.CachedRigidbody.linearVelocity;
            attributes.velocity=new FMOD.VECTOR{x=velocity.x,y=velocity.y,z=velocity.z};
        }
        var attenuation=attributes.position;
        if(Running&&followed==null&&TryGetRaceAudioAnchor(view.transform.position,out var anchor))
        {
            var offset=view.transform.position-anchor;
            // Keep camera-relative panning, with distance rolloff based near the closest car.
            var point=anchor+Vector3.ClampMagnitude(offset,RaceAudioPolicy.FreeCameraAttenuationRadius);
            attenuation=new FMOD.VECTOR{x=point.x,y=point.y,z=point.z};
        }
        AudioOk("listener-location",system.setListenerAttributes(0,attributes,attenuation));
    }
    private bool TryGetRaceAudioAnchor(Vector3 cameraPosition,out Vector3 anchor)
    {
        anchor=default;
        var nearest=float.PositiveInfinity;
        foreach(var entry in entries)
        {
            if(!IsCarAlive(entry))continue;
            var position=entry.Car.transform.position;
            var distance=(position-cameraPosition).sqrMagnitude;
            if(!(distance<nearest))continue;
            nearest=distance;anchor=position;
        }
        return float.IsFinite(nearest);
    }
    private void DiscoverVehicleAudioBuses()
    {
        audioBankScans++;
        var system=FMODUnity.RuntimeManager.StudioSystem;
        var result=system.getBankList(out var banks);
        audioBankScanResult=result.ToString();
        if(!AudioOk("bank-list",result))return;
        audioBankCount=banks.Length;nativeEngineBus=default;crowdBus=default;crowdBusPath="";
        foreach(var bank in banks)
        {
            DiscoverAudioRouting(bank);
            if(!AudioOk("bank-bus-list",bank.getBusList(out var buses)))continue;
            foreach(var bus in buses)
            {
                if(bus.getPath(out var path)!=FMOD.RESULT.OK)continue;
                nativeAudioBuses[path]=bus;
                if(path.EndsWith("/Engines",StringComparison.OrdinalIgnoreCase))nativeEngineBus=bus;
                if(path.Contains("crowd",StringComparison.OrdinalIgnoreCase)){crowdBus=bus;crowdBusPath=path;}
            }
        }
    }
    public void StopVehicleAudio()
    {
        // Preserve native FMOD playback through round presentation and teardown.
        RefreshAudioFaultState();nextAudioBankScan=0;
    }

    [Il2CppInterop.Runtime.Attributes.HideFromIl2Cpp]
    public object GetVehicleAudioStatus(bool enableMetering=false)
    {
        try
        {
            var listenerCount=0;var listenerResult="not-queried";object listenerError=null;
            try{listenerResult=FMODUnity.RuntimeManager.StudioSystem.getNumListeners(out listenerCount).ToString();}
            catch(Exception ex){listenerResult="EXCEPTION";listenerError=AudioDiagnosticFailure("listener-count",ex);}
            return new
            {
                schemaVersion=2,evidence="Native game FMOD events; queried transport state",loopbackCaptured=false,
                faulted=vehicleAudioFaulted,restarts=0,settingsOpen=quickSettingsOpen,graphics=GetGraphicsStatus(),
                pendingChannelStops=0,pendingNativeRestores=0,errors=new Dictionary<string,string>(vehicleAudioErrors),
                bankScans=audioBankScans,bankCount=audioBankCount,bankScanResult=audioBankScanResult,crowdBusPath,crowdVolumeApplied,
                requested=settings==null?null:new{master=settings.MasterVolume,engine=settings.EngineVolume,crowd=settings.CrowdVolume,paused=IsPaused},
                core=AudioDiagnostic("core",()=>CoreAudioStatus(enableMetering)),
                routing=AudioDiagnostic("routing",AudioRoutingStatus),
                engineBus=AudioDiagnostic("engine-bus",()=>AudioBusStatus(nativeEngineBus)),
                crowdBus=AudioDiagnostic("crowd-bus",()=>AudioBusStatus(crowdBus)),
                masterBus=AudioDiagnostic("master-bus",()=>AudioBusStatus(masterBus)),
                listenerResult,listenerCount,listenerError,
                listeners=Enumerable.Range(0,listenerResult==FMOD.RESULT.OK.ToString()?Math.Clamp(listenerCount,0,8):0)
                    .Select(index=>AudioDiagnostic("listener:"+index,()=>AudioListenerStatus(index))).ToArray(),
                camera=AudioDiagnostic("camera",()=>view==null?null:AudioVector(FMODUnity.RuntimeUtils.To3DAttributes(view.transform).position)),
                nativeEngines=entries.ToArray().Select(entry=>AudioDiagnostic("native-engine:"+(entry?.Username??"<null>"),()=>NativeEngineStatus(entry))).ToArray(),
                custom=Array.Empty<object>(),
                presentation=new{openingMusicManagedByLauncher=true,customRaceAudioChannels=0,engineOnly=false,clips=PresentationClipStatus()}
            };
        }
        catch(Exception ex)
        {
            return new{schemaVersion=2,evidence="Native game FMOD events",loopbackCaptured=false,
                operation="vehicle-audio-status",error=ex.Message,exceptionType=ex.GetType().FullName,stackTrace=ex.ToString()};
        }
    }
    private static float? AudioNumber(float value)=>float.IsFinite(value)?value:null;
    [Il2CppInterop.Runtime.Attributes.HideFromIl2Cpp]
    private static object AudioDiagnosticFailure(string operation,Exception ex)=>new
    {operation,error=ex.Message,exceptionType=ex.GetType().FullName,stackTrace=ex.ToString()};
    [Il2CppInterop.Runtime.Attributes.HideFromIl2Cpp]
    private static object AudioDiagnostic(string operation,Func<object> query)
    {try{return query();}catch(Exception ex){return AudioDiagnosticFailure(operation,ex);}}
    [Il2CppInterop.Runtime.Attributes.HideFromIl2Cpp]
    private static object CoreAudioStatus(bool meterRequested)
    {
        var operation="core-system";
        try
        {
            var core=FMODUnity.RuntimeManager.CoreSystem;operation="core-channels-playing";
            var channelsResult=core.getChannelsPlaying(out var total,out var real);operation="core-master-group";
            var masterResult=core.getMasterChannelGroup(out var master);
            return new{channelsResult=channelsResult.ToString(),totalChannels=total,realChannels=real,
                masterResult=masterResult.ToString(),master=masterResult==FMOD.RESULT.OK?AudioDiagnostic("core-master-group-state",()=>AudioGroupStatus(master)):null,
                meter=new{enabled=false,requested=meterRequested,supported=false,ready=false,reason="DSP metering is disabled."}};
        }
        catch(Exception ex){return AudioDiagnosticFailure(operation,ex);}
    }
    private static object AudioVector(FMOD.VECTOR value)=>new{x=AudioNumber(value.x),y=AudioNumber(value.y),z=AudioNumber(value.z)};
    [Il2CppInterop.Runtime.Attributes.HideFromIl2Cpp]
    private static object AudioGroupStatus(FMOD.ChannelGroup group)
    {
        if(group.handle==IntPtr.Zero)return null;
        var volumeResult=group.getVolume(out var volume);var muteResult=group.getMute(out var muted);
        var pauseResult=group.getPaused(out var paused);var audibilityResult=group.getAudibility(out var audibility);
        var channelsResult=group.getNumChannels(out var channels);
        return new{handle=group.handle.ToString(),volumeResult=volumeResult.ToString(),volume=volumeResult==FMOD.RESULT.OK?AudioNumber(volume):null,
            muteResult=muteResult.ToString(),muted,pauseResult=pauseResult.ToString(),paused,audibilityResult=audibilityResult.ToString(),
            audibility=audibilityResult==FMOD.RESULT.OK?AudioNumber(audibility):null,channelsResult=channelsResult.ToString(),channels};
    }
    [Il2CppInterop.Runtime.Attributes.HideFromIl2Cpp]
    private static object AudioBusStatus(FMOD.Studio.Bus bus)
    {
        if(!bus.isValid())return new{valid=false};
        var pathResult=bus.getPath(out var path);var volumeResult=bus.getVolume(out var volume,out var finalVolume);
        var muteResult=bus.getMute(out var muted);var pauseResult=bus.getPaused(out var paused);var groupResult=bus.getChannelGroup(out var group);
        return new{valid=true,pathResult=pathResult.ToString(),path,volumeResult=volumeResult.ToString(),
            volume=volumeResult==FMOD.RESULT.OK?AudioNumber(volume):null,finalVolume=volumeResult==FMOD.RESULT.OK?AudioNumber(finalVolume):null,
            muteResult=muteResult.ToString(),muted,pauseResult=pauseResult.ToString(),paused,groupResult=groupResult.ToString(),
            group=groupResult==FMOD.RESULT.OK?AudioDiagnostic("bus-group:"+path,()=>AudioGroupStatus(group)):null};
    }
    [Il2CppInterop.Runtime.Attributes.HideFromIl2Cpp]
    private static object AudioListenerStatus(int index)
    {
        var result=FMODUnity.RuntimeManager.StudioSystem.getListenerAttributes(index,out var attributes,out var attenuation);
        var weightResult=FMODUnity.RuntimeManager.StudioSystem.getListenerWeight(index,out var weight);
        return new{index,result=result.ToString(),position=result==FMOD.RESULT.OK?AudioVector(attributes.position):null,
            attenuation=result==FMOD.RESULT.OK?AudioVector(attenuation):null,forward=result==FMOD.RESULT.OK?AudioVector(attributes.forward):null,
            velocity=result==FMOD.RESULT.OK?AudioVector(attributes.velocity):null,weightResult=weightResult.ToString(),
            weight=weightResult==FMOD.RESULT.OK?AudioNumber(weight):null};
    }
    [Il2CppInterop.Runtime.Attributes.HideFromIl2Cpp]
    private object NativeEngineStatus(ViewerCar entry)
    {
        if(entry==null||entry.Car==null||!IsCarAlive(entry))return new{username=entry?.Username,level=entry?.Level,valid=false,reason="Car unavailable"};
        var effects=entry.Car.engineEffects;var instance=effects!=null?effects.engineFmodInstance:default;
        if(!instance.isValid())return new{username=entry.Username,level=entry.Level,valid=false};
        var playbackResult=instance.getPlaybackState(out var playback);var volumeResult=instance.getVolume(out var volume,out var finalVolume);
        var pauseResult=instance.getPaused(out var paused);var virtualResult=instance.isVirtual(out var virtualized);
        var maskResult=instance.getListenerMask(out var listenerMask);var attributesResult=instance.get3DAttributes(out var attributes);
        var groupResult=instance.getChannelGroup(out var group);
        return new{username=entry.Username,level=entry.Level,valid=true,handle=instance.handle.ToString(),playbackResult=playbackResult.ToString(),
            playback=playback.ToString(),volumeResult=volumeResult.ToString(),volume=volumeResult==FMOD.RESULT.OK?AudioNumber(volume):null,
            finalVolume=volumeResult==FMOD.RESULT.OK?AudioNumber(finalVolume):null,pauseResult=pauseResult.ToString(),paused,
            virtualResult=virtualResult.ToString(),virtualized,maskResult=maskResult.ToString(),listenerMask,
            attributesResult=attributesResult.ToString(),position=attributesResult==FMOD.RESULT.OK?AudioVector(attributes.position):null,
            groupResult=groupResult.ToString(),group=groupResult==FMOD.RESULT.OK?AudioDiagnostic("native-engine-group:"+entry.Username,()=>AudioGroupStatus(group)):null,
            replacementMuted=false};
    }
}
