using BepInEx;
using UnityEngine;

namespace TikMnG.Arcade;

public sealed partial class ArcadeDirector
{
    private FMOD.Sound welcomeSound,countdownSound;
    private FMOD.Channel welcomeChannel,countdownChannel;
    private float countdownClipSeconds=3;
    private float PlayPresentationClip(bool countdown)
    {
        return countdown?3:0;
    }
    private void UpdatePresentationClipVolumes()
    {
        if(phase is not ("staging" or "countdown")){StopPresentationClips();return;}
        UpdatePresentationChannel(ref welcomeChannel,"welcome-clip",settings.IntroVolume);
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
        StopPresentationChannel(ref welcomeChannel,"welcome-clip");
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
        if(welcomeSound.hasHandle()){welcomeSound.release();welcomeSound.clearHandle();}
        if(countdownSound.hasHandle()){countdownSound.release();countdownSound.clearHandle();}
    }
    private object PresentationClipStatus()
    {
        bool welcome=false,countdown=false;
        if(welcomeChannel.hasHandle())welcomeChannel.isPlaying(out welcome);
        if(countdownChannel.hasHandle())countdownChannel.isPlaying(out countdown);
        return new{welcomePlaying=welcome,countdownPlaying=countdown,welcomeVolume=settings.IntroVolume,countdownVolume=settings.CountdownVolume,countdownClipSeconds};
    }
}
