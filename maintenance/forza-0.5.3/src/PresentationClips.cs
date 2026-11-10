using BepInEx;
using UnityEngine;

namespace TikMnG.Arcade;

public sealed partial class ArcadeDirector
{
    private FMOD.Sound countdownSound;
    private FMOD.Channel countdownChannel;
    private float countdownClipSeconds=3;
    private float StartCountdownAudio()
    {
        countdownClipSeconds=3;
        if(!RaceAudioPolicy.PresentationAllowed(true,phase))return countdownClipSeconds;
        AudioStep("countdown-clip",() =>
        {
            var core=FMODUnity.RuntimeManager.CoreSystem;
            if(!countdownSound.hasHandle() &&
                !PresentationAudioOk("countdown-load",core.createSound(
                    Path.Combine(PathsRoot,"assets","audio","race-countdown.wav"),FMOD.MODE._2D,out countdownSound)))return;
            if(!PresentationAudioOk("countdown-length",countdownSound.getLength(out var milliseconds,FMOD.TIMEUNIT.MS)))return;
            if(!PresentationAudioOk("countdown-play",core.playSound(countdownSound,default,true,out countdownChannel)))return;
            PresentationAudioOk("countdown-clip:volume",countdownChannel.setVolume(settings.MasterVolume*settings.CountdownVolume));
            if(!PresentationAudioOk("countdown-start",countdownChannel.setPaused(false)))
            {
                StopPresentationClips();
                return;
            }
            countdownClipSeconds=(float)RaceAudioPolicy.CountdownSeconds(milliseconds);
        });
        return countdownClipSeconds;
    }
    private void UpdatePresentationClipVolumes()
    {
        if(phase is not ("staging" or "countdown")){StopPresentationClips();return;}
        UpdatePresentationChannel(ref countdownChannel,"countdown-clip",settings.CountdownVolume);
    }
    private void UpdatePresentationChannel(ref FMOD.Channel channel,string name,float volume)
    {
        if(!channel.hasHandle())return;
        var result=channel.isPlaying(out var playing);
        // FMOD invalidates a completed one-shot channel; it is not a mixer failure.
        if(result==FMOD.RESULT.ERR_INVALID_HANDLE||result==FMOD.RESULT.ERR_CHANNEL_STOLEN||!playing){channel.clearHandle();return;}
        if(PresentationAudioOk(name+":state",result))PresentationAudioOk(name+":volume",channel.setVolume(settings.MasterVolume*volume));
    }
    private void StopPresentationClips()
    {
        StopPresentationChannel(ref countdownChannel,"countdown-clip");
    }
    private void StopPresentationChannel(ref FMOD.Channel channel,string name)
    {
        if(!channel.hasHandle())return;
        var result=channel.stop();
        if(result!=FMOD.RESULT.ERR_INVALID_HANDLE&&result!=FMOD.RESULT.ERR_CHANNEL_STOLEN)PresentationAudioOk(name+":stop",result);
        channel.clearHandle();
    }
    private void DisposePresentationClips()
    {
        StopPresentationClips();
        if(countdownSound.hasHandle()){countdownSound.release();countdownSound.clearHandle();}
    }
    private object PresentationClipStatus()
    {
        bool countdown=false;
        if(countdownChannel.hasHandle())countdownChannel.isPlaying(out countdown);
        return new{welcomePlaying=false,countdownPlaying=countdown,welcomeVolume=settings.IntroVolume,countdownVolume=settings.CountdownVolume,countdownClipSeconds};
    }
}
