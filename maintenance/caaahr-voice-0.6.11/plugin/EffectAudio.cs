using System;
using System.Collections.Generic;
using UnityEngine;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    AudioSource actionAudio;bool actionAudioPaused;
    readonly Dictionary<string,AudioClip> actionClips=new Dictionary<string,AudioClip>();
    void PlayActionSound(string action){
      if(!actionAudio){actionAudio=gameObject.AddComponent<AudioSource>();actionAudio.playOnAwake=false;actionAudio.spatialBlend=0;actionAudio.volume=.4f;}
      AudioClip clip;if(!actionClips.TryGetValue(action,out clip)){clip=CreateActionSound(action);actionClips[action]=clip;}
      actionAudio.PlayOneShot(clip);
    }
    AudioClip CreateActionSound(string action){
      const int rate=22050;float length=action=="win"?1.3f:action=="countdown"?.12f:action=="explode"?.8f:.5f;
      var samples=new float[Mathf.CeilToInt(rate*length)];var noise=new System.Random(47+action.Length*137);double phase=0;
      for(int i=0;i<samples.Length;i++){
        float t=i/(float)rate,p=t/length,envelope=Mathf.Min(1,t/.012f)*Mathf.Pow(1-p,1.5f);double value;
        if(action=="explode"||action=="crash")value=((noise.NextDouble()*2-1)*.7+Math.Sin(t*180)*.3)*Math.Exp(-t*4);
        else if(action=="jail"||action=="release")value=Math.Sin(t*2600)*Math.Exp(-t*12)+.4*Math.Sin(t*3900)*Math.Exp(-t*18);
        else if(action=="forward"||action=="backward"||action=="boost"||action=="tornado"){
          phase+=(70+(action=="backward"?1-p:p)*360)/rate*Math.PI*2;value=Math.Sin(phase)*.35+(noise.NextDouble()*2-1)*.35;
        }else if(action=="win"){
          double[] notes={523.25,659.25,783.99,1046.5};double note=notes[Math.Min(3,(int)(t/.22))];value=Math.Sin(t*note*Math.PI*2)*.5+Math.Sin(t*note*Math.PI*4)*.15;
        }else{
          float frequency=action=="countdown"?880:action=="finish"?500+p*1100:action=="restart"?1100-p*650:action=="slow"?220:action=="egg"?140+p*100:action=="invert"?390:660;
          phase+=frequency/rate*Math.PI*2;value=Math.Sin(phase)*.65;
        }
        samples[i]=(float)value*envelope*.65f;
      }
      var clip=AudioClip.Create("TikMnG "+action,samples.Length,1,rate,false);clip.SetData(samples,0);return clip;
    }
    void UpdateActionAudio(){if(!actionAudio)return;if(menuOpen&&!actionAudioPaused){actionAudio.Pause();actionAudioPaused=true;}else if(!menuOpen&&actionAudioPaused){actionAudio.UnPause();actionAudioPaused=false;}}
    void ResetActionAudio(){if(actionAudio)actionAudio.Stop();}
    void ReleaseActionAudio(){if(actionAudio)Destroy(actionAudio);actionAudio=null;foreach(var clip in actionClips.Values)if(clip)Destroy(clip);actionClips.Clear();}
    void OnDisable(){ReleaseActionAudio();}
  }
}
