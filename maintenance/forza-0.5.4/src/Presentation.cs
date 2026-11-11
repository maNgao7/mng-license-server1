using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace TikMnG.Arcade;

public sealed partial class ArcadeDirector
{
    private FMOD.Studio.Bus masterBus;
    private int activeSoundSlider=-1;
    private int quickSettingsTab;
    private readonly Dictionary<int,float> rememberedVolumes=new();
    public bool IsPaused=>false;
    private float nextGraphicsCheck;
    private int graphicsCorrections;
    private string graphicsApplyError;
    private readonly Dictionary<int,float> pipelineShadowDistances=new();
    private void NormalizeGraphicsSettings()
    {
        var qualityCount=Math.Max(1,QualitySettings.names.Length);
        settings.GraphicsQuality=Math.Clamp(settings.GraphicsQuality,0,qualityCount-1);
        settings.AntiAliasing=settings.AntiAliasing switch{0=>0,2=>2,4=>4,8=>8,_=>2};
        settings.TargetFrameRate=settings.TargetFrameRate switch{60=>60,120=>120,240=>240,_=>-1};
    }
    private void ApplyGraphicsSettings()
    {
        try
        {
        NormalizeGraphicsSettings();
        if(QualitySettings.GetQualityLevel()!=settings.GraphicsQuality)
            QualitySettings.SetQualityLevel(settings.GraphicsQuality,true);
        if(QualitySettings.antiAliasing!=settings.AntiAliasing)QualitySettings.antiAliasing=settings.AntiAliasing;
        if(QualitySettings.vSyncCount!=(settings.VSync?1:0))QualitySettings.vSyncCount=settings.VSync?1:0;
        var shadowQuality=settings.Shadows?UnityEngine.ShadowQuality.All:UnityEngine.ShadowQuality.Disable;
        if(QualitySettings.shadows!=shadowQuality)QualitySettings.shadows=shadowQuality;
        if(Application.targetFrameRate!=settings.TargetFrameRate)Application.targetFrameRate=settings.TargetFrameRate;
        var mode=settings.FullscreenWindow?FullScreenMode.FullScreenWindow:FullScreenMode.Windowed;
        if(Screen.fullScreenMode!=mode)Screen.fullScreenMode=mode;
        var pipeline=ActiveGraphicsPipeline();
        if(pipeline!=null)
        {
            var samples=Math.Max(1,settings.AntiAliasing);
            if(pipeline.msaaSampleCount!=samples)pipeline.msaaSampleCount=samples;
            var id=pipeline.GetInstanceID();
            if(!pipelineShadowDistances.ContainsKey(id))pipelineShadowDistances[id]=pipeline.shadowDistance;
            var distance=settings.Shadows?pipelineShadowDistances[id]:0;
            if(pipeline.shadowDistance!=distance)pipeline.shadowDistance=distance;
        }
        if(view!=null)
        {
            view.allowMSAA=settings.AntiAliasing>0;
            var cameraData=view.GetComponent<UniversalAdditionalCameraData>();
            if(cameraData!=null)
            {
                cameraData.renderShadows=settings.Shadows;
                // Native temporal/post AA can override the requested sample mode.
                cameraData.antialiasing=AntialiasingMode.None;
            }
        }
        graphicsApplyError=null;vehicleAudioErrors.Remove("graphics-settings");graphicsCorrections++;
        }
        catch(Exception ex){graphicsApplyError=ex.Message;RecordAudioError("graphics-settings",ex.Message);}
    }
    private static UniversalRenderPipelineAsset ActiveGraphicsPipeline()=>
        (QualitySettings.renderPipeline??GraphicsSettings.currentRenderPipeline)?.TryCast<UniversalRenderPipelineAsset>();
    [Il2CppInterop.Runtime.Attributes.HideFromIl2Cpp]
    public object GetGraphicsStatus()
    {
        try
        {
            var pipeline=ActiveGraphicsPipeline();
            var data=view==null?null:view.GetComponent<UniversalAdditionalCameraData>();
            var target=view==null?null:view.targetTexture;
            return new{error=graphicsApplyError,checks=graphicsCorrections,
                quality=QualitySettings.GetQualityLevel(),legacyAntiAliasing=QualitySettings.antiAliasing,
                pipeline=pipeline==null?"built-in/other":pipeline.name,
                pipelineMsaa=pipeline==null?(int?)null:pipeline.msaaSampleCount,
                renderScale=pipeline==null?(float?)null:pipeline.renderScale,
                shadowDistance=pipeline==null?(float?)null:pipeline.shadowDistance,
                cameraMsaa=view==null?(bool?)null:view.allowMSAA,cameraPostAA=data==null?null:data.antialiasing.ToString(),
                cameraShadows=data==null?(bool?)null:data.renderShadows,
                targetMsaa=target==null?(int?)null:target.antiAliasing,
                width=Screen.width,height=Screen.height,mode=Screen.fullScreenMode.ToString(),
                vSync=QualitySettings.vSyncCount,targetFrameRate=Application.targetFrameRate,
                requested=new{quality=settings.GraphicsQuality,antiAliasing=settings.AntiAliasing,shadows=settings.Shadows,
                    fullscreenWindow=settings.FullscreenWindow,vSync=settings.VSync,targetFrameRate=settings.TargetFrameRate}};
        }
        catch(Exception ex){return new{error=ex.Message};}
    }
    private bool DesktopOwnsIntro()
    {
        try
        {
            using var doc=System.Text.Json.JsonDocument.Parse(File.ReadAllText(Path.Combine(control,"launch-session.json")));
            return doc.RootElement.GetProperty("pid").GetInt32()==Environment.ProcessId;
        }
        catch{return false;}
    }
    private int raceClockRecoveries;
    private void MaintainPauseClock()
    {
        if(!Running||CircuitSuperstars.GameStateManager.IsTransitioning||Time.timeScale>0)return;
        Time.timeScale=1;
        raceClockRecoveries++;
    }
    private bool introPlayed,quickSettingsOpen;
    private float introStartedAt=-100;
    private string presentationAudioError;
    private Vector3 introDestination,introTarget,introRight;
    private Quaternion introRotation;
    private static float SoundLevel(float value,float fallback)=>float.IsFinite(value)?Math.Clamp(value,0,1):fallback;
    private bool IntroActive=>cameraReady&&Time.realtimeSinceStartup-introStartedAt<7.67f;
    private void BeginTrackIntro()
    {
        if(introPlayed)return;
        introPlayed=true;introStartedAt=Time.realtimeSinceStartup;
        introDestination=view.transform.position;introRotation=view.transform.rotation;
        introTarget=introDestination+view.transform.forward*30;
        introRight=view.transform.right;
    }
    private void UpdatePresentation()
    {
        UpdatePresentationClipVolumes();
        if(Time.unscaledTime>=nextGraphicsCheck){nextGraphicsCheck=Time.unscaledTime+.5f;ApplyGraphicsSettings();}
        AudioStep("presentation-master",()=>
        {
            if(!masterBus.isValid())PresentationAudioOk("master-lookup",FMODUnity.RuntimeManager.StudioSystem.getBus("bus:/",out masterBus));
            if(masterBus.isValid())
            {
                PresentationAudioOk("master-volume",masterBus.setVolume(settings.MasterVolume));
                PresentationAudioOk("master-running",masterBus.setPaused(false));
            }
        });
        presentationAudioError=vehicleAudioErrors.FirstOrDefault(error=>error.Key.StartsWith("presentation:",StringComparison.Ordinal)).Value;
        if(!IntroActive||view==null)return;
        var t=Mathf.Clamp01((Time.realtimeSinceStartup-introStartedAt)/7.67f);
        var eased=t*t*(3-2*t);
        var sweep=introRight*(Mathf.Sin((1-eased)*Mathf.PI*.75f)*65);
        view.transform.position=introDestination+sweep+Vector3.up*(1-eased)*38;
        var look=Quaternion.LookRotation(introTarget-view.transform.position);
        view.transform.rotation=Quaternion.Slerp(look,introRotation,eased);
        yaw=view.transform.eulerAngles.y;pitch=view.transform.eulerAngles.x;
    }
    private void DrawPresentationFade()
    {
        var elapsed=Time.realtimeSinceStartup-introStartedAt;
        if(elapsed>=0&&elapsed<1.6f)
            Fill(new Rect(-2000,-2000,6000,6000),new Color(1,.97f,.88f,Mathf.Pow(1-elapsed/1.6f,2)*.9f));
    }
    private void ClosePresentationAudio()
    {
        DisposePresentationClips();
        if(masterBus.isValid())PresentationAudioOk("master-close",masterBus.setPaused(false));
    }
    private bool PresentationAudioOk(string operation,FMOD.RESULT result)
    {
        if(AudioOk("presentation:"+operation,result))return true;
        presentationAudioError=operation+": "+result;return false;
    }
    private void ToggleQuickSettings()
    {
        quickSettingsOpen=!quickSettingsOpen;GUIUtility.keyboardControl=0;
        activeSoundSlider=-1;
        CaptureCursor(!quickSettingsOpen&&!showPanel);
        if(!quickSettingsOpen)SaveSettings();
        if(!quickSettingsOpen)ApplyGraphicsSettings();
    }
    private float SoundSlider(float y,string title,float value)
    {
        var id=(int)y;
        Label(405,y,220,30,title,body);
        if(Button(new Rect(650,y-2,82,32),value>0?"Açık":"Kapalı",value>0))
        {
            if(value>0){rememberedVolumes[id]=value;value=0;}
            else value=rememberedVolumes.GetValueOrDefault(id,.75f);
        }
        var rect=new Rect(750,y-1,160,32);var ev=Event.current;
        if(ev.type==EventType.MouseDown&&ev.button==0&&rect.Contains(ev.mousePosition)){activeSoundSlider=id;}
        if(activeSoundSlider==id&&(ev.type==EventType.MouseDown||ev.type==EventType.MouseDrag))
        {value=Mathf.Clamp01((ev.mousePosition.x-rect.x)/rect.width);ev.Use();}
        if(activeSoundSlider==id&&ev.type==EventType.MouseUp){activeSoundSlider=-1;ev.Use();}
        Fill(new Rect(rect.x,y+10,rect.width,8),Line);
        Fill(new Rect(rect.x,y+10,rect.width*value,8),Accent);
        Fill(new Rect(rect.x+Mathf.Clamp(rect.width*value,4,rect.width-4)-4,y+3,8,22),Ink);
        Label(922,y,68,30,Mathf.RoundToInt(value*100)+"%",small);
        return Mathf.Clamp01(value);
    }
    private void DrawQuickSettings()
    {
        Fill(new Rect(-2000,-2000,6000,6000),new Color(0,0,0,.65f));
        Fill(new Rect(330,82,720,650),Back);
        Label(365,106,440,40,"Ayarlar",heading);
        if(Button(new Rect(365,153,200,38),"Ses",quickSettingsTab==0))quickSettingsTab=0;
        if(Button(new Rect(578,153,200,38),"Grafik",quickSettingsTab==1))quickSettingsTab=1;
        Fill(new Rect(365,201,650,1),Line);
        if(quickSettingsTab==0)
        {
            settings.MasterVolume=SoundSlider(225,"Ana ses",settings.MasterVolume);
            settings.OpeningVolume=SoundSlider(270,"Açılış müziği",settings.OpeningVolume);
            settings.EngineVolume=SoundSlider(325,"Oyunun motor sesleri",settings.EngineVolume);
            settings.CrowdVolume=SoundSlider(380,"Seyirci sesi",settings.CrowdVolume);
            settings.CountdownVolume=SoundSlider(435,"Geri sayım sesi",settings.CountdownVolume);
            Label(365,486,610,55,"Yarış sırasında oyunun kendi motor sesleri kullanılır.",small);
        }
        else DrawGraphicsSettings();
        if(Button(new Rect(750,668,265,42),"Kaydet ve kapat",true))ToggleQuickSettings();
    }
    private void DrawGraphicsSettings()
    {
        var names=QualitySettings.names;
        Label(365,230,245,32,"Kalite profili",body);
        if(Button(new Rect(650,224,42,38),"−"))settings.GraphicsQuality=Math.Max(0,settings.GraphicsQuality-1);
        Label(704,230,180,32,names[Math.Clamp(settings.GraphicsQuality,0,names.Length-1)],new GUIStyle(body){fontStyle=FontStyle.Bold});
        if(Button(new Rect(910,224,42,38),"+"))settings.GraphicsQuality=Math.Min(names.Length-1,settings.GraphicsQuality+1);

        Label(365,292,245,32,"Kenar yumuşatma",body);
        if(Button(new Rect(650,286,302,38),settings.AntiAliasing==0?"Kapalı":settings.AntiAliasing+"x"))
            settings.AntiAliasing=settings.AntiAliasing switch{0=>2,2=>4,4=>8,_=>0};

        Label(365,354,245,32,"Dikey eşitleme",body);
        if(Button(new Rect(650,348,302,38),settings.VSync?"Açık":"Kapalı",settings.VSync))settings.VSync=!settings.VSync;

        Label(365,416,245,32,"Kare hızı sınırı",body);
        if(Button(new Rect(650,410,302,38),settings.TargetFrameRate<0?"Sınırsız":settings.TargetFrameRate+" FPS"))
            settings.TargetFrameRate=settings.TargetFrameRate switch{60=>120,120=>240,240=>-1,_=>60};

        Label(365,478,245,32,"Gölgeler",body);
        if(Button(new Rect(650,472,302,38),settings.Shadows?"Açık":"Kapalı",settings.Shadows))settings.Shadows=!settings.Shadows;

        Label(365,540,245,32,"Ekran modu",body);
        if(Button(new Rect(650,534,302,38),settings.FullscreenWindow?"Pencereli tam ekran":"Pencere"))settings.FullscreenWindow=!settings.FullscreenWindow;
    }
}
