using BepInEx;
using CircuitSuperstars;
using FireParticipation;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.Json;
using UnityEngine;

namespace TikMnG.Arcade;

public sealed class ArcadeSettings
{
    public int EconomyVersion {get;set;}
    public int DynamicsVersion {get;set;}
    public int EntryFeeCoins {get;set;}=1;
    public string Username { get; set; }="";
    public float FieldOfView { get; set; }=82;
    public int LikeThreshold { get; set; }=100;
    public bool LikesEnter { get; set; }=true;
    public bool FollowsEnter { get; set; }=true;
    public int CoinsPerLevel { get; set; }=50;
    public float GiftSpeedPerCoin {get;set;}=RaceEconomy.DefaultGiftSpeed;
    public float LikeSpeedGain {get;set;}=10;
    public float FollowSpeedGain {get;set;}=10;
    public string ForwardGiftId {get;set;}="";
    public float ForwardGiftMetres {get;set;}=100;
    public string RocketGiftId {get;set;}="5879";
    public float RocketGiftMetres {get;set;}=70;
    public int GraphicsQuality {get;set;}=2;
    public int AntiAliasing {get;set;}=2;
    public bool VSync {get;set;}=true;
    public int TargetFrameRate {get;set;}=120;
    public bool FullscreenWindow {get;set;}=true;
    public bool Shadows {get;set;}=true;
    public float CornerPacePercent {get;set;}=88;
    public float OpeningVolume {get;set;}=.75f;
    public float IntroVolume {get;set;}=.75f;
    public float CountdownVolume {get;set;}=.85f;
    public float MasterVolume {get;set;}=.8f;
    public float EngineVolume {get;set;}=.8f;
    public float CrowdVolume {get;set;}=.25f;
    public int Laps { get; set; }=3;
    public bool ShowMinimap { get; set; }=true;
    public bool ShowLapCounter { get; set; }=true;
    public bool ShowSpeedometer { get; set; }=true;
    public bool ShowCarLabels { get; set; }=true;
    public List<GiftRule> Rules { get; set; }=new() {
        new() {GiftId="5655",Name="Gul",Action="entry",Amount=1},
        new() {GiftId="5658",Name="Parfum",Action="level",Amount=1}
    };
}
public sealed class GiftRule
{
    public string GiftId { get; set; }="";
    public string Name { get; set; }="";
    public string Action { get; set; }="level";
    public int Amount { get; set; }=1;
    public int Multiplier {get;set;}=1;
}
public sealed class ViewerCar
{
    public string Username="", Nickname="", Avatar="";
    public ParticipantId Id;
    public AutomobilePipeline Car;
    public VehicleLivery Livery;
    public int Slot, Level, Coins,UpgradePoints,SelectedModel=-1;
    public float SpeedGiftFlashUntil;
    public float TopSpeedKph=50,UpgradePulseUntil,AudienceSpeed;
    public float LastPhysicalSpeed,Acceleration;
    public bool EconomyManaged,TestPortrait;
    public int PendingForwardJumps,ForwardJumpsUsed;
    public float ForwardMetresUsed;
    public int PendingRocketJumps,RocketJumpsUsed;
    public float RocketMetresUsed;
    public VehicleModelInstance Visual;
    public Vector3 GridPosition;
    public Quaternion GridRotation;
    public bool GridHeld;
    public Collider CollisionHull;
}

public sealed partial class ArcadeDirector
{
    private string PathsRoot => Path.GetFullPath(Path.Combine(Paths.GameRootPath,".."));
    private ArcadeSettings settings=new();
    private readonly List<ViewerCar> entries=new();
    private readonly Dictionary<string,int> likeTotals=new();
    private string likeChannel="";
    private readonly HashSet<string> rewardedFollows=new(StringComparer.OrdinalIgnoreCase);
    private readonly LiveEventReceipts eventReceipts=new();
    private readonly ConcurrentQueue<string> liveMessages=new();
    private string liveStatus="disconnected",liveMessage="Yayin baglantisi kapali";
    private Process liveBridge;
    private readonly JsonSerializerOptions jsonOptions=new(){PropertyNameCaseInsensitive=true,WriteIndented=true};
    private void InitializeMenuAndLive()
    {
        var file=Path.Combine(control,"settings.json");
        if (File.Exists(file))
        {
            try { settings=JsonSerializer.Deserialize<ArcadeSettings>(File.ReadAllText(file),jsonOptions)??new(); }
            catch(Exception ex) { Plugin.Output.LogWarning("Settings load: "+ex.Message); }
        }
        settings.FieldOfView=Math.Clamp(settings.FieldOfView,60,110);
        settings.OpeningVolume=SoundLevel(settings.OpeningVolume,.75f);
        settings.IntroVolume=SoundLevel(settings.IntroVolume,.75f);
        settings.CountdownVolume=SoundLevel(settings.CountdownVolume,.85f);
        settings.MasterVolume=SoundLevel(settings.MasterVolume,.8f);
        settings.EngineVolume=SoundLevel(settings.EngineVolume,.8f);
        settings.CrowdVolume=SoundLevel(settings.CrowdVolume,.25f);
        settings.LikeThreshold=Math.Clamp(settings.LikeThreshold,1,100000);
        settings.CoinsPerLevel=Math.Clamp(settings.CoinsPerLevel,1,100000);
        settings.Laps=Math.Clamp(settings.Laps,1,99);
        settings.Rules??=new();
        settings.EntryFeeCoins=Math.Clamp(settings.EntryFeeCoins,0,100000);
        if(settings.EconomyVersion<3)
        {
            settings.LikesEnter=true;settings.FollowsEnter=true;settings.LikeThreshold=100;
            settings.GiftSpeedPerCoin=RaceEconomy.DefaultGiftSpeed;settings.LikeSpeedGain=10;settings.FollowSpeedGain=10;
            settings.EconomyVersion=3;
        }
        if(settings.EconomyVersion<7)
        {
            settings.EconomyVersion=7;
        }
        settings.GiftSpeedPerCoin=float.IsFinite(settings.GiftSpeedPerCoin)?Math.Clamp(settings.GiftSpeedPerCoin,.01f,10):RaceEconomy.DefaultGiftSpeed;
        settings.LikeSpeedGain=float.IsFinite(settings.LikeSpeedGain)?Math.Clamp(settings.LikeSpeedGain,0,750):10;
        settings.FollowSpeedGain=float.IsFinite(settings.FollowSpeedGain)?Math.Clamp(settings.FollowSpeedGain,0,750):10;
        settings.ForwardGiftId??="";
        settings.ShowCarLabels=true;
        settings.ForwardGiftMetres=float.IsFinite(settings.ForwardGiftMetres)?Math.Clamp(settings.ForwardGiftMetres,20,300):100;
        settings.RocketGiftId??="";
        settings.RocketGiftMetres=float.IsFinite(settings.RocketGiftMetres)?Math.Clamp(settings.RocketGiftMetres,20,300):70;
        if(settings.DynamicsVersion<1)
        {
            settings.CornerPacePercent=88;
            settings.DynamicsVersion=1;
        }
        settings.CornerPacePercent=float.IsFinite(settings.CornerPacePercent)?Math.Clamp(settings.CornerPacePercent,50,100):88;
        NormalizeGraphicsSettings();
        ApplyGraphicsSettings();
        foreach(var rule in settings.Rules)rule.Multiplier=Math.Clamp(rule.Multiplier,1,10);
        foreach(var rule in settings.Rules)rule.Amount=Math.Clamp(rule.Amount,1,MaxVehicleLevel);
        LoadCatalog();
    }
    private readonly object settingsWriteLock=new();
    private int settingsWriteRevision;
    private Task quickSettingsSave=Task.CompletedTask;
    private void WriteSettings(string json,int revision)
    {
        lock(settingsWriteLock)
        {
            if(revision!=Volatile.Read(ref settingsWriteRevision))return;
            var file=Path.Combine(control,"settings.json");
            var temporary=file+".pending";
            File.WriteAllText(temporary,json);
            File.Move(temporary,file,true);
        }
    }
    private void QueueQuickSettingsSave()
    {
        var json=JsonSerializer.Serialize(settings,jsonOptions);
        var revision=Interlocked.Increment(ref settingsWriteRevision);
        quickSettingsSave=Task.Run(()=>
        {
            try {WriteSettings(json,revision);}
            catch(Exception ex) when(ex is IOException or UnauthorizedAccessException)
            {Plugin.Output.LogError("Ayarlar kaydedilemedi: "+ex.Message);}
        });
    }
    private void SaveSettings()
    {
        settings.Username=settings.Username.Trim().TrimStart('@');
        if(!string.Equals(likeChannel,settings.Username,StringComparison.OrdinalIgnoreCase))
        {
            likeTotals.Clear();
            likeChannel=settings.Username;
        }
        if(!startRequested&&!Running&&!RoundTransitioning)
            foreach(var entry in entries.Where(e=>e.EconomyManaged&&IsCarAlive(e)))ApplyEconomy(entry);
        SortStartingGrid();
        WriteSettings(JsonSerializer.Serialize(settings,jsonOptions),Interlocked.Increment(ref settingsWriteRevision));
    }
    private void SendLive(string command)
    {
        SaveSettings();
        if (command=="connect" && !System.Text.RegularExpressions.Regex.IsMatch(settings.Username,"^[a-zA-Z0-9_.]{1,64}$"))
        { liveMessage="Gecerli bir TikTok kullanici adi girin.";return; }
        try
        {
            if (liveBridge==null || liveBridge.HasExited)
            {
                var launcherRuntime=Environment.GetEnvironmentVariable("MNG_FORZA_LAUNCHER_RUNTIME");
                var runtime=string.IsNullOrEmpty(launcherRuntime)?"C:/Program Files/nodejs/node.exe":launcherRuntime;
                if (!File.Exists(runtime)) throw new InvalidOperationException("Yayın bağlantısı için Turkish Forza’yı güncel TikMnG uygulamasından açın.");
                var start=new ProcessStartInfo(runtime){UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,WorkingDirectory=PathsRoot,
                    StandardInputEncoding=new System.Text.UTF8Encoding(false),StandardOutputEncoding=System.Text.Encoding.UTF8,StandardErrorEncoding=System.Text.Encoding.UTF8};
                if(!string.IsNullOrEmpty(launcherRuntime))start.Environment["ELECTRON_RUN_AS_NODE"]="1";
                start.ArgumentList.Add(Path.Combine(PathsRoot,"bridge","service.cjs"));
                liveBridge=new Process{StartInfo=start,EnableRaisingEvents=true};
                liveBridge.OutputDataReceived+=OnLiveOutput;
                liveBridge.ErrorDataReceived+=OnLiveError;
                liveBridge.Start();liveBridge.BeginOutputReadLine();liveBridge.BeginErrorReadLine();
            }
            liveBridge.StandardInput.WriteLine(JsonSerializer.Serialize(new {command,username=settings.Username}));
            liveBridge.StandardInput.Flush();
        }
        catch(Exception ex) {liveStatus="error";liveMessage=ex.Message;}
    }
    private void OnLiveOutput(object sender,DataReceivedEventArgs e)
    {
        if(e.Data!=null && e.Data.Length<=16384)liveMessages.Enqueue(e.Data);
    }
    private void OnLiveError(object sender,DataReceivedEventArgs e) { }
    private void StopLiveBridge()
    {
        var bridge=liveBridge;
        liveBridge=null;
        if(bridge==null)return;
        try
        {
            if(!bridge.HasExited)bridge.StandardInput.Close();
            if(!bridge.WaitForExit(1200)&&!bridge.HasExited)bridge.Kill();
        }
        catch(InvalidOperationException) { }
        catch(IOException) { }
        finally {bridge.Dispose();}
    }
    private void DrainLiveMessages()
    {
        var deadline=Time.realtimeSinceStartupAsDouble+.002;
        for(var i=0;i<100&&(i==0||Time.realtimeSinceStartupAsDouble<deadline)&&liveMessages.TryDequeue(out var line);i++)
        {
            try
            {
                using var doc=JsonDocument.Parse(line);var root=doc.RootElement;
                if(root.GetProperty("kind").GetString()=="status")
                {
                    var status=root.GetProperty("value");
                    liveStatus=status.GetProperty("status").GetString()??"error";
                    liveMessage=status.TryGetProperty("message",out var message)?message.GetString()??"":liveStatus;
                }
                else HandleLiveEvent(root.GetProperty("value"));
            }
            catch(Exception ex) {Plugin.Output.LogWarning("Live event: "+ex.Message);liveMessage=ex.Message;}
        }
    }
    private void HandleLiveEvent(JsonElement ev)
    {
        string Text(string key)=>ev.TryGetProperty(key,out var value)?value.GetString()??"":"";
        int Number(string key)=>ev.TryGetProperty(key,out var value)&&value.TryGetInt32(out var n)?Math.Clamp(n,0,1000000):0;
        var username=Text("username").Trim().TrimStart('@').ToLowerInvariant();if(username.Length==0)return;
        var type=Text("type");var nickname=Text("nickname");
        var avatar=ResultsBoardStore.AvatarFile(Text("avatarFile"));
        RememberAudience(username,nickname,avatar);
        if(avatar.Length==0&&audienceProfiles.TryGetValue(username,out var known))avatar=known.Avatar;
        var entry=RoundTransitioning?null:entries.FirstOrDefault(e=>e.Username==username);
        if(type=="avatar")
        {
            if(avatar.Length==0)return;
            if(phase=="podium")entry=entries.FirstOrDefault(e=>e.Username==username);
            if(entry!=null)entry.Avatar=avatar;
            else if(pendingJoins.TryGetValue(username,out var waiting))waiting.Avatar=avatar;
            if(phase=="podium")
                foreach(var winner in roundWinners.Where(w=>w.Username==username))winner.Avatar=avatar;
            UpdateResultsBoardAvatar(username,avatar);
            return;
        }
        if(type is "chat" or "member" or "viewer")return;
        if(!eventReceipts.Accept(Text("eventId")))return;
        var shouldEnter=false;var freeEntry=false;var coins=0;var bonus=0f;
        var giftId=type=="gift"?Text("giftId"):"";
        var forwardJumps=type=="gift"&&Text("eventId").Length>0&&ForwardGiftMath.Matches(settings.ForwardGiftId,giftId)
            ?Math.Clamp(Number("repeatCount"),1,10000):0;
        var rocketJumps=type=="gift"&&Text("eventId").Length>0&&ForwardGiftMath.Matches(settings.RocketGiftId,giftId)
            &&giftId!=settings.ForwardGiftId?Math.Clamp(Number("repeatCount"),1,10000):0;
        var alreadyWaiting=pendingJoins.TryGetValue(username,out var queuedViewer);
        var admitted=entry!=null||(alreadyWaiting&&(queuedViewer.FreeEntry||queuedViewer.Coins>=settings.EntryFeeCoins));
        if(type=="gift")
        {
            var count=Math.Clamp(Number("repeatCount"),1,10000);
            coins=(int)Math.Min(10000000L,(long)Number("coins")*count);
            shouldEnter=coins>0;
        }
        else if(type=="follow"&&settings.FollowsEnter)
        {
            if(!rewardedFollows.Add(username))return;
            shouldEnter=true;freeEntry=true;bonus=admitted?settings.FollowSpeedGain:0;
        }
        else if(type=="like" && (settings.LikesEnter||admitted))
        {
            var likes=RaceEconomy.CreditLikes(likeTotals.GetValueOrDefault(username),Number("likeCount"),
                settings.LikeThreshold,settings.LikeSpeedGain);
            likeTotals.Remove(username);
            if(likes.Remainder>0)
            {
                if(likeTotals.Count>=8000)likeTotals.Remove(likeTotals.Keys.First());
                likeTotals[username]=likes.Remainder;
            }
            shouldEnter=likes.Entries>0;freeEntry=settings.LikesEnter;bonus=likes.Speed;
        }
        if(!shouldEnter)return;
        if(entry==null)
        {
            if(alreadyWaiting)
            {AccumulatePending(queuedViewer,coins,freeEntry,bonus,avatar);queuedViewer.ForwardJumps=ForwardGiftMath.Add(queuedViewer.ForwardJumps,forwardJumps);queuedViewer.RocketJumps=ForwardGiftMath.Add(queuedViewer.RocketJumps,rocketJumps);return;}
            if((!freeEntry&&coins<settings.EntryFeeCoins)||IsPaused||!AddViewerCar(username,nickname))
            {
                var queued=new PendingViewer{Username=username,Nickname=nickname};
                AccumulatePending(queued,coins,freeEntry,bonus,avatar);pendingJoins[username]=queued;
                queued.ForwardJumps=ForwardGiftMath.Add(queued.ForwardJumps,forwardJumps);
                queued.RocketJumps=ForwardGiftMath.Add(queued.RocketJumps,rocketJumps);
                liveMessage=nickname+(!freeEntry&&coins<settings.EntryFeeCoins?" · giriş birikimi "+coins+" / "+settings.EntryFeeCoins+" coin":" · sıraya alındı");return;
            }
            entry=entries.FirstOrDefault(e=>e.Username==username);
        }
        if(entry==null)return;
        if(avatar.Length>0)entry.Avatar=avatar;
        var oldSpeed=entry.EconomyManaged?entry.TopSpeedKph:50;
        entry.Coins=RaceEconomy.Add(entry.Coins,coins);
        entry.AudienceSpeed=RaceEconomy.AddAudienceSpeed(entry.AudienceSpeed,bonus);
        ApplyEconomy(entry);
        if((coins>0||bonus>0)&&entry.TopSpeedKph>oldSpeed+.01f)entry.SpeedGiftFlashUntil=Time.unscaledTime+6;
        entry.PendingForwardJumps=ForwardGiftMath.Add(entry.PendingForwardJumps,forwardJumps);
        entry.PendingRocketJumps=ForwardGiftMath.Add(entry.PendingRocketJumps,rocketJumps);
        liveMessage=nickname+" · +"+(entry.TopSpeedKph-oldSpeed).ToString("0.#")+" km/sa · "+ModelNames[entry.Level]+" · hedef "+entry.TopSpeedKph.ToString("0.#")+" km/sa";
    }
    private void ApplyEconomy(ViewerCar entry)
    {
        entry.UpgradePoints=entry.Coins;
        var old=entry.TopSpeedKph;entry.TopSpeedKph=RaceEconomy.TopSpeed(entry.UpgradePoints,settings.GiftSpeedPerCoin,entry.AudienceSpeed);
        entry.EconomyManaged=true;
        if(entry.TopSpeedKph>old+.01f)entry.UpgradePulseUntil=Time.unscaledTime+.65f;
        SetLevel(entry,RaceEconomy.LevelForSpeed(entry.TopSpeedKph));
        gridOrderDirty=true;
    }
    private void SetLevel(ViewerCar entry,int level)
    {
        if(entry.Car==null)return;
        var next=Math.Clamp(level,0,MaxVehicleLevel);
        if(!originalBodyTest)ApplyVehicleModel(entry,next);
        entry.Level=next;
        if(!originalBodyTest)entry.Car.SetEnginePowerBoostFactor(nativeChassisTest?1:entry.EconomyManaged?RaceEconomy.Power(entry.TopSpeedKph):ModelPowers[next]);
        if(!nativeChassisTest)entry.Car.aiSettings.targetSpeed=entry.EconomyManaged?entry.TopSpeedKph/3.6f:ModelTargetSpeeds[next];
    }
}
