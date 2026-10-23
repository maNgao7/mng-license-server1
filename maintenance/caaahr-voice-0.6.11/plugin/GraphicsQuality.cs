using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using ShadowQuality=UnityEngine.ShadowQuality;
using ShadowResolution=UnityEngine.ShadowResolution;

namespace TikMnG.Caaahr {
  public partial class VoiceDrive {
    sealed class GraphicsSnapshot {
      public int nativeLevel,antialiasing,mipmap,cascades,maximumLOD;
      public float lod,shadowDistance;
      public ShadowQuality shadows;public ShadowResolution shadowResolution;public AnisotropicFiltering anisotropic;
      public UniversalRenderPipelineAsset pipeline;
      public float renderScale,pipelineShadowDistance;public int samples,pipelineCascades;public bool softShadows;
      public static GraphicsSnapshot Capture(){
        var value=new GraphicsSnapshot{nativeLevel=QualitySettings.GetQualityLevel(),antialiasing=QualitySettings.antiAliasing,mipmap=QualitySettings.globalTextureMipmapLimit,cascades=QualitySettings.shadowCascades,maximumLOD=QualitySettings.maximumLODLevel,lod=QualitySettings.lodBias,shadowDistance=QualitySettings.shadowDistance,shadows=QualitySettings.shadows,shadowResolution=QualitySettings.shadowResolution,anisotropic=QualitySettings.anisotropicFiltering,pipeline=GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset};
        if(value.pipeline){value.renderScale=value.pipeline.renderScale;value.samples=value.pipeline.msaaSampleCount;value.pipelineShadowDistance=value.pipeline.shadowDistance;value.pipelineCascades=value.pipeline.shadowCascadeCount;value.softShadows=value.pipeline.supportsSoftShadows;}
        return value;
      }
      public void Restore(){
        if(QualitySettings.GetQualityLevel()!=nativeLevel)QualitySettings.SetQualityLevel(nativeLevel,true);
        QualitySettings.antiAliasing=antialiasing;QualitySettings.globalTextureMipmapLimit=mipmap;QualitySettings.shadowCascades=cascades;QualitySettings.maximumLODLevel=maximumLOD;QualitySettings.lodBias=lod;QualitySettings.shadowDistance=shadowDistance;QualitySettings.shadows=shadows;QualitySettings.shadowResolution=shadowResolution;QualitySettings.anisotropicFiltering=anisotropic;
        if(pipeline){pipeline.renderScale=renderScale;pipeline.msaaSampleCount=samples;pipeline.shadowDistance=pipelineShadowDistance;pipeline.shadowCascadeCount=pipelineCascades;}
      }
      public bool MatchesCurrent(){
        var current=Capture();return current.nativeLevel==nativeLevel&&current.antialiasing==antialiasing&&current.mipmap==mipmap&&current.cascades==cascades&&current.maximumLOD==maximumLOD&&Mathf.Approximately(current.lod,lod)&&Mathf.Approximately(current.shadowDistance,shadowDistance)&&current.shadows==shadows&&current.shadowResolution==shadowResolution&&current.anisotropic==anisotropic&&current.pipeline==pipeline&&(!pipeline||(Mathf.Approximately(current.renderScale,renderScale)&&current.samples==samples&&Mathf.Approximately(current.pipelineShadowDistance,pipelineShadowDistance)&&current.pipelineCascades==pipelineCascades&&current.softShadows==softShadows));
      }
    }
    GraphicsSnapshot originalGraphics,displayBackupGraphics;int appliedQuality=-1;
    static readonly string[] qualityTitles={"Oyunun varsayılanı","Düşük","Orta","Yüksek","Ultra"};
    void ApplyGraphicsQuality(int quality){
      if(originalGraphics==null)originalGraphics=GraphicsSnapshot.Capture();
      originalGraphics.Restore();appliedQuality=Mathf.Clamp(quality,-1,3);if(appliedQuality<0)return;
      int level=appliedQuality;float[] lod={.65f,1,1.5f,2},scale={.75f,.9f,1,1.15f},distance={25,45,70,95};int[] samples={1,2,4,8},cascades={1,2,4,4};
      QualitySettings.lodBias=lod[level];QualitySettings.maximumLODLevel=0;QualitySettings.globalTextureMipmapLimit=level==0?1:0;
      QualitySettings.antiAliasing=level==0?0:samples[level];QualitySettings.shadows=level==0?ShadowQuality.HardOnly:ShadowQuality.All;
      QualitySettings.shadowResolution=(ShadowResolution)level;QualitySettings.shadowDistance=distance[level];QualitySettings.shadowCascades=level==0?0:cascades[level];QualitySettings.anisotropicFiltering=level<2?AnisotropicFiltering.Enable:AnisotropicFiltering.ForceEnable;
      var pipeline=GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
      if(pipeline){pipeline.renderScale=scale[level];pipeline.msaaSampleCount=samples[level];pipeline.shadowDistance=distance[level];pipeline.shadowCascadeCount=cascades[level];}
    }
    string QualityName(int quality){return qualityTitles[Mathf.Clamp(quality+1,0,qualityTitles.Length-1)];}
  }
}
