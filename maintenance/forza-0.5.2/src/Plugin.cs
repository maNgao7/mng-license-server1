using BepInEx;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using BepInEx.Unity.IL2CPP.Utils.Collections;
using CircuitSuperstars;
using CircuitSuperstars.Drivers;
using CircuitSuperstars.TrackData;
using HarmonyLib;
using Il2CppInterop.Runtime.InteropTypes.Arrays;
using System.Net;
using System.Net.Sockets;
using System.Collections;
using System.Text.Json;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.SceneManagement;
using UObj = UnityEngine.Object;

namespace TikMnG.Arcade;

[BepInPlugin("com.tikmng.arcade.racing", "TikMnG Turkish Forza 0.5", "0.5.0")]
public sealed class Plugin : BasePlugin
{
    internal static ManualLogSource Output = null!;
    public override void Load()
    {
        Output = Log;
        new Harmony("com.tikmng.arcade.racing").PatchAll();
        AddComponent<ArcadeDirector>();
        Log.LogInfo("TikMnG native Unity director loaded.");
    }
}

// Keep the native opening paused until the broadcaster's single countdown ends.
[HarmonyPatch(typeof(RaceOpener), nameof(RaceOpener.OpeningCoroutine))]
internal static class HeldOpening
{
    static void Postfix(ref Il2CppSystem.Collections.IEnumerator __result)
    {
        if (ArcadeDirector.Current == null) return;
        __result = WaitForStart(__result).WrapToIl2Cpp();
    }
    static IEnumerator WaitForStart(Il2CppSystem.Collections.IEnumerator original)
    {
        while (ArcadeDirector.Current != null && !ArcadeDirector.Current.NativeStartReleased) yield return null;
        if (ArcadeDirector.Current == null) yield break;
        while(original.MoveNext()) yield return original.Current;
    }
}

[HarmonyPatch(typeof(RaceUI),"PauseGame")]
internal static class DirectorPauseMenu
{
    static bool Prefix()=>ArcadeDirector.Current==null;
}

[HarmonyPatch(typeof(RaceManager),"PrePhysicsUpdate")]
internal static class DirectorPausedRaceClock
{
    static bool Prefix()=>ArcadeDirector.Current?.IsPaused!=true;
}

[HarmonyPatch(typeof(AutomobilePipeline),"PrePhysicsUpdate")]
internal static class DirectorPausedCarPhysics
{
    static bool Prefix()=>ArcadeDirector.Current?.IsPaused!=true;
}

[HarmonyPatch(typeof(RacerAiManager), "CalcControlValuesForUpdatingAi")]
[System.Diagnostics.CodeAnalysis.SuppressMessage("Style", "IDE1006")]
internal static class ExpandedAiControlRange
{
    static void Prefix(RacerAiManager __instance)
    {
        if(ArcadeDirector.Current==null)return;
        if(__instance.allIds.Count>12)__instance.updatingIndexRange=new RangeInt(0,__instance.allIds.Count);
        ArcadeDirector.Current.ApplyPassingTargets(__instance);
    }
}

[HarmonyPatch(typeof(RacerAiTargetSystem), "PhysicsUpdate")]
internal static class ExpandedAiTargetRange
{
    static void Prefix(ref RangeInt __0,RacerAiManager __1)
    {
        if(ArcadeDirector.Current==null||__1.allIds.Count<=12)return;
        __0=new RangeInt(0,__1.allIds.Count);
    }
}

[HarmonyPatch(typeof(RacerAiManager), "WriteToAutomobilesForUpdatingAi")]
internal static class ExpandedAiOutputRange
{
    static void Prefix(RacerAiManager __instance)
    {
        if(ArcadeDirector.Current==null||__instance.allIds.Count<=12)return;
        __instance.updatingIndexRange=new RangeInt(0,__instance.allIds.Count);
    }
}

public sealed partial class ArcadeDirector : MonoBehaviour
{
    public static ArcadeDirector Current;
    public bool Running;
    private string phase = "boot";
    private string error;
    private string connectionResult = "pending";
    private bool requested;
    private bool cameraReady;
    private bool cursorCaptured;
    private bool showPanel;
    private float countdownEnd;
    private float nextReport;
    private float yaw;
    private float pitch;
    private Camera view;
    private ClientConnectionManager.ConnectCallback connectCallback;
    private readonly string control = Path.Combine(Paths.GameRootPath, "..", "control");
    private long lastCommand;
    private bool audioMeteringEnabled;
    private GUIStyle titleStyle;
    private GUIStyle subtitleStyle;

    public ArcadeDirector(IntPtr pointer) : base(pointer) { }
    public void Awake()
    {
        Current = this;
        nativeGridTest=File.Exists(Path.Combine(control,"native-grid-test.flag"));
        originalBodyTest=File.Exists(Path.Combine(control,"original-body-test.flag"));
        nativeChassisTest=nativeGridTest||originalBodyTest;
        Directory.CreateDirectory(control);
        var commandFile=Path.Combine(control,"command.json");
        try
        {
            if(File.Exists(commandFile))
            {
                using var pending=JsonDocument.Parse(File.ReadAllText(commandFile));
                lastCommand=pending.RootElement.GetProperty("id").GetInt64();
            }
        }
        catch {lastCommand=0;}
        InitializeMenuAndLive();
        Application.runInBackground = true;
        Application.targetFrameRate = 90;
        Plugin.Output.LogInfo("Director awake; waiting for native asset boot.");
    }

    public void Update()
    {
        try
        {
            MaintainPauseClock();
            if(!IsPaused){UpdateRoundLifecycle();UpdateRaceMarshal();}
            if (!requested && AppBoot.IsBootComplete && Time.realtimeSinceStartup > 5)
                TryOpenEmptyTrack();
            if (RaceManager.Instance != null && !cameraReady && phase=="loading-track")
                TryEnableCamera();
            ReadCommand();
            DrainLiveMessages();
            if(!IsPaused){DrainPendingJoins();SortStartingGrid();RecoverLostVehicles();UpdateForwardGifts();}
            UpdateTrackBranding();
            UpdateResultsBoard();
            UpdateAudienceAvatars();
            if (cameraReady && Application.isFocused) ReadInput();
            if (Time.realtimeSinceStartup >= nextReport)
            {
                nextReport = Time.realtimeSinceStartup + 1;
                WriteStatus();
                if (recordDrivingTelemetry && cameraReady) WriteVehicleDiagnostics();
            }
        }
        catch (Exception ex)
        {
            if (error != ex.Message) Plugin.Output.LogError(ex.ToString());
            error = ex.Message;
            phase = "error";
        }
    }

    private void TryOpenEmptyTrack()
    {
        var manager = ClientConnectionManager.Instance;
        if (manager == null || GameStateManager.IsTransitioning) return;
        var descriptors = Resources.FindObjectsOfTypeAll<RaceScenarioDescriptor>();
        RaceScenarioDescriptor offered = null;
        foreach (var d in descriptors)
        {
            if (d.tracks == null || d.tracks.Length == 0 || d.raceConfigurations == null || d.raceConfigurations.Length == 0) continue;
            if (d.tracks.Any(t => t != null && t.name.Contains("tsukuba", StringComparison.OrdinalIgnoreCase))) { offered = d; break; }
        }
        if (offered == null) return;
        var scenario = offered.ToRaceScenario();
        var offeredDrivers=scenario.opponentDrivers;
        for(var i=0;i<scenario.raceConfigurations.Length;i++)
        {
            var config=scenario.raceConfigurations[i];
            config.raceEndConditionConfig=new RaceEndConditionConfig{type=RaceEndConditionType.LapRace,parameter=settings.Laps};
            config.raceEndCondition=null;
            config.proximityGhostingMode=ProximityGhostingMode.None;
            var start=config.startConfiguration;
            start.timing=StartTimingMode.Immediate;
            config.startConfiguration=start;
            scenario.raceConfigurations[i]=config;
        }
        scenario.numRacersToPadTo = 0;
        scenario.opponentDrivers = new Il2CppReferenceArray<AiDriverDescriptor>(0);
        if(nativeGridTest)
        {
            scenario.numRacersToPadTo=7;
            scenario.opponentDrivers=offeredDrivers;
            scenario.aiDifficulty=AiDifficulty.Pro;
        }
        scenario.numRacersPerTeam = 1;
        scenario.maximumTeamCount = MaximumRaceCars;
        scenario.allowRestarts = true;
        scenario.gameMode = RaceScenarioGameMode.None;
        var parameters = HostParameters.MakeForSpectateOffline(scenario);
        if (!parameters.IsValid()) throw new InvalidOperationException("Native spectator parameters were rejected.");
        connectCallback = new Action<ClientConnectionManager.ConnectResult>(result =>
        {
            connectionResult = result.ToString();
            Plugin.Output.LogInfo("Local spectator connection: " + connectionResult);
            if (result != ClientConnectionManager.ConnectResult.Success)
            {
                phase = "error";
                error = "Local spectator connection: " + connectionResult;
            }
        });
        var transport=FishNet.InstanceFinder.TransportManager?.Transport;
        if(transport==null)return;
        ushort spectatorPort;
        using(var reservation=new UdpClient(new IPEndPoint(IPAddress.Loopback,0)))
            spectatorPort=(ushort)((IPEndPoint)reservation.Client.LocalEndPoint).Port;
        transport.SetPort(spectatorPort);
        phase = "loading-track";
        requested = true;
        Plugin.Output.LogInfo($"Starting offered Tsukuba scene as offline spectator on local port {spectatorPort} with zero padding AI.");
        manager.CreateLocalHostAsync(ref parameters, connectCallback);
    }

    private void TryEnableCamera()
    {
        if (RaceManager.Instance.LocalStageId < RaceStageId.RaceOpening) return;
        view = Camera.main;
        if (view == null) return;
        foreach (var free in Resources.FindObjectsOfTypeAll<FreeCamera>())
            if (free.gameObject.scene.IsValid()) free.enabled = false;
        var brain = view.GetComponent<Cinemachine.CinemachineBrain>();
        if (brain != null) brain.enabled = false;
        view.fieldOfView = settings.FieldOfView;
        var nativeFree = Resources.FindObjectsOfTypeAll<FreeCamera>().FirstOrDefault(f => f.gameObject.scene.IsValid());
        if (nativeFree != null && nativeFree.virtualCamera != null)
        {
            view.transform.SetPositionAndRotation(nativeFree.virtualCamera.transform.position, nativeFree.virtualCamera.transform.rotation);
        }
        yaw = view.transform.eulerAngles.y;
        pitch = view.transform.eulerAngles.x;
        var track = UObj.FindObjectOfType<TrackSceneData>();
        if (track != null && track.vehicleSpawnMarkerList != null && track.vehicleSpawnMarkerList.markers.Length > 0)
        {
            var grid = track.vehicleSpawnMarkerList.markers[0];
            var target = grid.position - grid.forward * 12;
            view.transform.position = grid.position + grid.forward * 18 + Vector3.up * 15;
            view.transform.LookAt(target);
            yaw = view.transform.eulerAngles.y;
            pitch = view.transform.eulerAngles.x;
        }
        cameraReady = true;
        // The demo applies its own display defaults while loading the track.
        // Reapply the saved operator settings after that native initialization.
        ApplyGraphicsSettings();
        if(nativeGridTest)
        {
            foreach(var car in ActiveCars())entries.Add(new ViewerCar{Username="native_"+(entries.Count+1),Nickname="Native",Id=car.ParticipantId,Car=car,Slot=entries.Count+1});
        }
        SetupRaceHud(track);
        phase = "staging";
        if(roundNumber==1&&!DesktopOwnsIntro())BeginTrackIntro();
        CaptureCursor(true);
        Plugin.Output.LogInfo("Native track loaded; free camera active. Physical vehicles: " + ActiveCars().Length);
    }

    [Il2CppInterop.Runtime.Attributes.HideFromIl2Cpp]
    private AutomobilePipeline[] ActiveCars() => UObj.FindObjectsOfType<AutomobilePipeline>()
        .Where(c => c.gameObject.activeInHierarchy && c.gameObject.scene.IsValid()).ToArray();

    public void LateUpdate()
    {
        if (!cameraReady) return;
        HideNativeOverlay();
        if(!IsPaused){UpdateVehicleModels();UpdateForwardRescueVisuals();UpdateFollowCamera();}
        UpdateCinematicCamera();
        UpdateVehicleAudio();
        UpdatePresentation();
    }

    private void ReadInput()
    {
        var keyboard = Keyboard.current;
        var mouse = Mouse.current;
        if (keyboard == null) return;
        if(quickSettingsOpen)
        {if(keyboard.escapeKey.wasPressedThisFrame||keyboard.bKey.wasPressedThisFrame)ToggleQuickSettings();return;}
        if(showPanel&&keyboard.escapeKey.wasPressedThisFrame){MenuBack();return;}
        if (keyboard.bKey.wasPressedThisFrame && (!showPanel || GUIUtility.keyboardControl==0))
        {if(showPanel)MenuBack();else TogglePanel();return;}
        if (showPanel) return;
        if(keyboard.mKey.wasPressedThisFrame)ToggleTrackMap();
        if(trackMapOpen)
        {
            if(keyboard.escapeKey.wasPressedThisFrame)ToggleTrackMap();
            return;
        }
        if (keyboard.pKey.wasPressedThisFrame)
        {
            if(phase=="racing"&&Running&&Time.realtimeSinceStartup>=greenFlagAt+1)EndRaceManually();
            else if(phase=="staging"&&!startRequested)BeginCountdown();
        }
        if (keyboard.escapeKey.wasPressedThisFrame){ToggleQuickSettings();return;}
        if(IntroActive)return;
        if(joinShowcase!=null&&(keyboard.wKey.isPressed||keyboard.aKey.isPressed||keyboard.sKey.isPressed||keyboard.dKey.isPressed||
            keyboard.eKey.wasPressedThisFrame||keyboard.spaceKey.wasPressedThisFrame||(mouse!=null&&mouse.delta.ReadValue().sqrMagnitude>1)))CancelJoinShowcase(false);
        if (mouse != null && mouse.leftButton.wasPressedThisFrame && !cursorCaptured) CaptureCursor(true);
        if (!cursorCaptured || view == null) return;
        if (mouse != null && mouse.leftButton.wasPressedThisFrame && TryResetResultsBoardAtCrosshair()) return;
        if (keyboard.spaceKey.wasPressedThisFrame && followed != null) { LeaveFollow(); return; }
        if (keyboard.eKey.wasPressedThisFrame) FollowAimedCar();
        if (followed != null)
        {
            if (keyboard.aKey.wasPressedThisFrame) CycleFollow(-1);
            if (keyboard.dKey.wasPressedThisFrame) CycleFollow(1);
            return;
        }
        var delta = mouse == null ? Vector2.zero : mouse.delta.ReadValue();
        yaw += delta.x * 0.09f;
        pitch = Mathf.Clamp(pitch - delta.y * 0.09f, -85, 85);
        view.transform.rotation = Quaternion.Euler(pitch, yaw, 0);
        var forward = (keyboard.wKey.isPressed ? 1 : 0) - (keyboard.sKey.isPressed ? 1 : 0);
        var right = (keyboard.dKey.isPressed ? 1 : 0) - (keyboard.aKey.isPressed ? 1 : 0);
        var up = (keyboard.spaceKey.isPressed ? 1 : 0) - (keyboard.leftCtrlKey.isPressed ? 1 : 0);
        var speed = keyboard.leftShiftKey.isPressed ? 35 : 14;
        view.transform.position += (view.transform.forward * forward + view.transform.right * right + Vector3.up * up) * speed * Time.unscaledDeltaTime;
    }

    private void CaptureCursor(bool enabled)
    {
        cursorCaptured = enabled;
        Cursor.lockState = enabled ? CursorLockMode.Locked : CursorLockMode.None;
        Cursor.visible = !enabled;
    }

    private float nextCommandPoll;
    private void ReadCommand()
    {
        if(Time.unscaledTime<nextCommandPoll)return;
        nextCommandPoll=Time.unscaledTime+.05f;
        var file = Path.Combine(control, "command.json");
        if (!File.Exists(file)) return;
        string commandText;
        try { commandText=File.ReadAllText(file); }
        catch (IOException) { return; }
        JsonDocument json;
        try { json=JsonDocument.Parse(commandText); }
        catch (JsonException) { return; }
        using var commandDocument=json;
        var root = json.RootElement;
        var id = root.GetProperty("id").GetInt64();
        if (id <= lastCommand) return;
        lastCommand = id;
        switch (root.GetProperty("command").GetString())
        {
            case "quit": Application.Quit(); break;
            case "capture": CaptureTrackView(); break;
            case "rescue-thumbnail": CaptureRescueModel();break;
            case "rocket-thumbnail": CaptureRescueModel(true);break;
            case "spawn-test": SpawnTest(); break;
            case "panel": TogglePanel(); break;
            case "sound-settings": ToggleQuickSettings();break;
            case "track-intro": BeginTrackIntro();break;
            case "menu-back": MenuBack();break;
            case "panel-tab":
                tab=Math.Clamp(root.GetProperty("tab").GetInt32(),0,4);
                if(!showPanel)TogglePanel();
                break;
            case "follow-test": FollowFirstCar(); break;
            case "cycle-test": CycleFollow(1); break;
            case "free-camera": LeaveFollow(); break;
            case "grid-view": LeaveFollow();ResetSpectatorPose();break;
            case "thumbnail": CaptureVehicleThumbnail(); break;
            case "model-level":
                var modelEntry=entries.FirstOrDefault();
                if(modelEntry==null)throw new InvalidOperationException("Once test araci ekleyin.");
                SetLevel(modelEntry,root.GetProperty("level").GetInt32());break;
            case "model-thumbnail":
                CaptureVehicleThumbnail("vehicles/"+ModelIds[entries.First().Level]+".png");break;
            case "model-previews": StartCoroutine(CaptureModelPreviews().WrapToIl2Cpp());break;
            case "native-vehicle-previews": StartCoroutine(CaptureNativeVehicleGallery().WrapToIl2Cpp());break;
            case "frame-capture": StartCoroutine(CaptureGameFrame().WrapToIl2Cpp());break;
            case "model-fleet": SpawnModelFleet();break;
            case "vehicle-diagnostics": WriteVehicleDiagnostics();break;
            case "track-materials": WriteTrackMaterials();break;
            case "export-brand-source": ExportBrandSource(root.GetProperty("material").GetString(),root.GetProperty("property").GetString());break;
            case "driving-telemetry": recordDrivingTelemetry=true;break;
            case "corner-pace": settings.CornerPacePercent=Math.Clamp(root.GetProperty("percent").GetSingle(),50,100);SaveSettings();break;
            case "test-race": BeginCountdown();break;
            case "finish-race": EndRaceManually();break;
            case "map": ToggleTrackMap();break;
            case "map-follow": SelectMapViewer(root.GetProperty("username").GetString());break;
            case "board-qa": SetResultsBoardQaMode(root.GetProperty("run").GetString());break;
            case "board-click": TryResetResultsBoardAtCrosshair();break;
            case "economy":
                if(!startRequested&&!Running&&!RoundTransitioning)
                {
                    settings.EntryFeeCoins=Math.Clamp(root.GetProperty("entryFee").GetInt32(),0,100000);
                    if(root.TryGetProperty("giftSpeed",out var giftSpeed))settings.GiftSpeedPerCoin=Math.Clamp(giftSpeed.GetSingle(),.01f,10);
                    if(root.TryGetProperty("likeGain",out var likeGain))settings.LikeSpeedGain=Math.Clamp(likeGain.GetSingle(),0,750);
                    if(root.TryGetProperty("followGain",out var followGain))settings.FollowSpeedGain=Math.Clamp(followGain.GetSingle(),0,750);
                    entryFeeInput=settings.EntryFeeCoins.ToString();RefreshActionInputs();
                }
                break;
            case "forward-gift":
                if(root.TryGetProperty("giftId",out var forwardId))settings.ForwardGiftId=forwardId.GetString()??"";
                if(root.TryGetProperty("metres",out var forwardMetres)&&float.IsFinite(forwardMetres.GetSingle()))settings.ForwardGiftMetres=Math.Clamp(forwardMetres.GetSingle(),20,300);
                RefreshActionInputs();SaveSettings();break;
            case "forward-gift-test": RunForwardGiftTest(root.TryGetProperty("username",out var testUser)?testUser.GetString():"test_izleyici",root.TryGetProperty("present",out var presentTest)&&presentTest.GetBoolean());break;
            case "rocket-gift-test": RunForwardGiftTest(root.TryGetProperty("username",out var rocketTestUser)?rocketTestUser.GetString():"test_izleyici",true,true);break;
            case "rocket-gift":
                if(root.TryGetProperty("giftId",out var rocketId))settings.RocketGiftId=rocketId.GetString()??"";
                if(root.TryGetProperty("metres",out var rocketMetres)&&float.IsFinite(rocketMetres.GetSingle()))settings.RocketGiftMetres=Math.Clamp(rocketMetres.GetSingle(),20,300);
                RefreshActionInputs();SaveSettings();break;
            case "audience-geometry": WriteAudienceGeometry();break;
            case "audio-meter": audioMeteringEnabled=root.GetProperty("enabled").GetBoolean();break;
            case "graphics":
                if(root.TryGetProperty("quality",out var quality))settings.GraphicsQuality=quality.GetInt32();
                if(root.TryGetProperty("antiAliasing",out var aa))settings.AntiAliasing=aa.GetInt32();
                if(root.TryGetProperty("vSync",out var vsync))settings.VSync=vsync.GetBoolean();
                if(root.TryGetProperty("targetFrameRate",out var fps))settings.TargetFrameRate=fps.GetInt32();
                if(root.TryGetProperty("fullscreenWindow",out var fullscreen))settings.FullscreenWindow=fullscreen.GetBoolean();
                if(root.TryGetProperty("shadows",out var shadows))settings.Shadows=shadows.GetBoolean();
                ApplyGraphicsSettings();SaveSettings();break;
            case "admit-waiting": AdmitWaitingParticipants();break;
            case "physics-baseline": nativeChassisTest=true;break;
            case "contact-test": StartCoroutine(VerifyVehicleContact().WrapToIl2Cpp());break;
            case "join-test": VerifyNearLineJoin();break;
            case "flame-preview": flamePreviewUntil=Time.unscaledTime+8;break;
            case "flame-capture": StartCoroutine(CaptureFlamePreview().WrapToIl2Cpp());break;
            case "live-event": HandleLiveEvent(root.GetProperty("event")); break;
            case "connect": settings.Username=root.GetProperty("username").GetString()??"";SendLive("connect");break;
            case "disconnect": SendLive("disconnect");break;
            case "restart-ai": RaceOpener.StartRacingAiForAiVehicles(RaceManager.Instance.RacerData);break;
            case "laps": if(!Running&&!startRequested&&!RoundTransitioning)settings.Laps=Math.Clamp(root.GetProperty("count").GetInt32(),1,99);break;
            case "hud":
                settings.ShowMinimap=root.GetProperty("minimap").GetBoolean();
                settings.ShowLapCounter=root.GetProperty("laps").GetBoolean();
                break;
            case "power": foreach (var car in ActiveCars()) car.SetEnginePowerBoostFactor(root.GetProperty("factor").GetSingle()); break;
            case "camera-pose":
                if (view == null) throw new InvalidOperationException("Camera not ready.");
                view.transform.position = new Vector3(root.GetProperty("x").GetSingle(), root.GetProperty("y").GetSingle(), root.GetProperty("z").GetSingle());
                pitch = root.GetProperty("pitch").GetSingle(); yaw = root.GetProperty("yaw").GetSingle();
                view.transform.rotation = Quaternion.Euler(pitch, yaw, 0);
                break;
        }
        WriteStatus();
    }

    private void SpawnTest()
    {
        AddViewerCar("test" + (entries.Count + 1), "Test " + (entries.Count + 1));
    }

    private bool AddViewerCar(string viewer, string nickname)
    {
        if (RoundTransitioning) return false;
        if(startRequested&&!Running)return false;
        if (!cameraReady) return false;
        if (entries.Any(e => e.Username == viewer)) return true;
        var track = UObj.FindObjectOfType<TrackSceneData>();
        if (track?.vehicleSpawnMarkerList?.markers == null)
            throw new InvalidOperationException("Baslangic sirasi bulunamadi.");
        if(entries.Count>=MaximumRaceCars)return false;
        PositionAndRotation? joinPose=null;
        if(Running)
        {
            if(!TryNearLinePose(track,out var pose))return false;
            joinPose=pose;
        }
        foreach (var driver in Resources.FindObjectsOfTypeAll<AiDriverDescriptor>())
        {
            if (driver.racingTeam == null) continue;
            foreach (var teamVehicle in driver.racingTeam.EnabledTeamVehicles)
            {
                if (teamVehicle.materialDescriptor == null || teamVehicle.materialDescriptor.vehicle == null
                    || teamVehicle.materialDescriptor.vehicle.vehicleClass != VehicleClass.Gt) continue;
                var ai = RacingDriver();
                var info = ParticipantInfo.MakeForAiRacer(driver, teamVehicle, ai);
                var id = FireParticipation.ParticipantId.MakeUnique();
                ParticipantManager.ServerAddPlaying(id, info);
                var markers = new Il2CppStructArray<PositionAndRotation>(BuildExpandedStartingGrid(track.vehicleSpawnMarkerList.markers,entries.Count+1));
                var positions = new Il2CppSystem.Collections.Generic.Dictionary<FireParticipation.ParticipantId,int>();
                if(joinPose.HasValue)markers=new Il2CppStructArray<PositionAndRotation>(new[]{joinPose.Value});
                positions.Add(id,joinPose.HasValue?0:entries.Count);
                if(!ParticipantManager.TryFindParticipantComponent(id,out var participant))throw new InvalidOperationException("Katilimci bulunamadi.");
                var allParticipants=ParticipantManager.participantComponents;
                var insertionOnly=new Il2CppSystem.Collections.Generic.List<ParticipantComponent>();
                insertionOnly.Add(participant);
                // Native spawning is synchronous on Unity's main thread. Isolate the
                // new participant during enumeration, then restore the full registry.
                ParticipantManager.participantComponents=insertionOnly;
                try { VehicleSpawner.SpawnVehicles(RaceManager.Instance.RacerData, markers, positions); }
                finally { ParticipantManager.participantComponents=allParticipants; }
                if (!AutomobilePipeline.TryFindAutomobile(id, out var automobile)) throw new InvalidOperationException("Arac olusturulamadi.");
                automobile.aiInput.StopAi();
                var entry = new ViewerCar { Username=viewer, Nickname=nickname, Id=id, Car=automobile, Slot=entries.Count+1, Livery=info.racerInfo.vehicleLivery,EntryFeePaid=settings.EntryFeeCoins };
                entries.Add(entry);
                RegisterResultsBoardParticipant(entry);
                QueueJoinShowcase(entry);
                ApplyEconomy(entry);
                if(Running)
                {
                    RaceManager.Instance.RacerData.FinalLapNumbers[id]=settings.Laps;
                    automobile.EnableAutomobilePhysics();if(!automobile.wheelsEnabled)automobile.EnableWheels();
                    automobile.aiInput.StartAi(automobile,ai,RacingLine(),false);
                    // Start native racing AI; late entrants still need their own clutch release.
                    RaceOpener.StartRacingAiForAiVehicles(RaceManager.Instance.RacerData);
                    // The demo's respawn-input observer is wired only during RaceOpening.
                    // A mid-race server spawn otherwise receives repeated false reset
                    // requests and is teleported back to its insertion pose.
                    if(automobile.Respawner!=null)automobile.Respawner.enabled=false;
                    if(!InitializeLateJoinRaceControls(entry))
                        Plugin.Output.LogWarning("Late join native clutch release unavailable: "+entry.Username);
                }
                Plugin.Output.LogInfo("Viewer AI inserted; physical count: " + ActiveCars().Length);
                return true;
            }
        }
        throw new InvalidOperationException("No available demo GT driver configuration found.");
    }

    private void BeginCountdown()
    {
        if (!cameraReady || Running || startRequested || RoundTransitioning || entries.Count == 0) return;
        SortStartingGrid();
        ApplyLapTarget();
        CancelJoinShowcase(true);
        introStartedAt=-100;
        Plugin.Output.LogInfo("Race start explicitly requested with P.");
        roundEndReason=null;roundWinners.Clear();
        startRequested = true;
        startRequestedAt=Time.realtimeSinceStartup;
        NativeCountdownStarted(3);
        roundEntrants=entries.Count;
        showPanel = false;
        trackMapOpen=false;
        CaptureCursor(true);
    }

    private void WriteStatus()
    {
        var manager = RaceManager.Instance;
        var progress = RacerProgressManager.Instance;
        var status = new
        {
            version = "0.5.0", pid = Environment.ProcessId, utc = DateTime.UtcNow, phase, error, requested, connectionResult,
            round=roundNumber,startRequested,roundEndReason,countdownRemaining=countdownEnd>0?Math.Max(0,countdownEnd-Time.realtimeSinceStartup):0,
            roundEntrants,winners=roundWinners.Select(w=>new{w.Place,w.Username,w.Nickname,w.Time,w.Avatar}).ToArray(),
            countdownStartedAt,greenFlagAt,startRequestedAt,awaitingQueueAdmission,
            expandedGridAiStarted=expandedGridAiStarted.ToArray(),expandedGridAiErrors=new Dictionary<string,string>(expandedGridAiErrors),
            passingTargets=passingOffsets.Count(p=>Mathf.Abs(p.Value)>.15f),
            vehicleShaderName, commandId=lastCommand,
            pendingJoins=pendingJoins.Count,
            audioVoices=entries.Count(e=>IsCarAlive(e)),audioFaulted=vehicleAudioFaulted,audioMixScale=1,audioRestarts=0,
            vehicleAudio=GetVehicleAudioStatus(audioMeteringEnabled),
            crowdVolumeApplied,crowdBusPath,introActive=IntroActive,quickSettingsOpen,presentationAudioError,
            presentationClips=PresentationClipStatus(),
            cameraPresentation=CameraPresentationStatus(),
            paused=IsPaused,timeScale=Time.timeScale,masterVolume=settings.MasterVolume,engineVolume=settings.EngineVolume,openingVolume=settings.OpeningVolume,
            graphicsQuality=settings.GraphicsQuality,graphicsProfiles=QualitySettings.names.ToArray(),antiAliasing=settings.AntiAliasing,vSync=settings.VSync,targetFrameRate=settings.TargetFrameRate,fullscreenWindow=settings.FullscreenWindow,shadows=settings.Shadows,
            appliedGraphicsQuality=QualitySettings.GetQualityLevel(),appliedAntiAliasing=QualitySettings.antiAliasing,appliedVSync=QualitySettings.vSyncCount,appliedTargetFrameRate=Application.targetFrameRate,appliedFullscreenMode=Screen.fullScreenMode.ToString(),appliedShadows=QualitySettings.shadows.ToString(),
            graphics=GetGraphicsStatus(),
            openingMusicManagedByLauncher=true,customRaceAudioChannels=0,nativeCountdownActive=phase=="countdown"&&countdownEnd>Time.realtimeSinceStartup,
            resultsBoard=GetResultsBoardStatus(),marshalVisible=raceMarshalRoot!=null&&raceMarshalRoot.activeInHierarchy,
            marshalPosition=raceMarshalRoot==null?null:new{x=raceMarshalRoot.transform.position.x,y=raceMarshalRoot.transform.position.y,z=raceMarshalRoot.transform.position.z},
            marshalForward=raceMarshalRoot==null?null:new{x=raceMarshalRoot.transform.forward.x,y=raceMarshalRoot.transform.forward.y,z=raceMarshalRoot.transform.forward.z},
            marshalConfetti=marshalConfetti.Count,
            audienceProfiles=audienceProfiles.Count,audienceAvatars=audienceBadges.Count,
            audienceSeats=GetAudienceSeatStatus(),
            audienceSample=audienceProfiles.Values.OrderByDescending(p=>p.LastSeen).Take(24).Select(p=>new{username=p.Username,nickname=p.Nickname,avatarFile=p.Avatar,hasAvatar=Portrait(p.Avatar)!=null,
                roundPortrait=resultsBoardQaRun!=null&&HasRoundPortrait(p.Avatar)}).ToArray(),
            panel = showPanel, following = followed == null ? null : followed.Username,
            laps=settings.Laps,entryFeeCoins=settings.EntryFeeCoins,giftSpeedPerCoin=settings.GiftSpeedPerCoin,likeThreshold=settings.LikeThreshold,likeSpeedGain=settings.LikeSpeedGain,followSpeedGain=settings.FollowSpeedGain,cornerPacePercent=settings.CornerPacePercent,likesEnter=settings.LikesEnter,followsEnter=settings.FollowsEnter,maximumSpeedKph=RaceEconomy.MaximumKph,trackMapOpen,
            minimap=settings.ShowMinimap,lapCounter=settings.ShowLapCounter,mapSamples=mapPath.Length,
            nativeLapTarget=manager?.EndCondition?.TryCast<LapRaceEndCondition>()?.TotalLaps,
            live = liveStatus, liveUsername = settings.Username,
            liveMessage,
            forwardGiftId=settings.ForwardGiftId,forwardGiftMetres=settings.ForwardGiftMetres,forwardGiftMessage,outOfWorldRecoveries,
            rocketGiftId=settings.RocketGiftId,rocketGiftMetres=settings.RocketGiftMetres,
            forwardRescue=ForwardRescueStatus(),carLabelsEnabled=settings.ShowCarLabels,renderedCarIdentities=renderedCarIdentities.ToArray(),
            viewers=entries.Select(e=>new{e.Username,e.Nickname,e.Level,e.SelectedModel,e.Coins,e.UpgradePoints,e.AudienceSpeed,e.Slot,e.TopSpeedKph,e.EconomyManaged,racePlace=RacePlace(e),model=ModelIds[e.Level],modelName=ModelNames[e.Level],power=ModelPowers[e.Level],customModel=e.Visual?.Root!=null,hasAvatar=Portrait(e)!=null,
                roundPortrait=resultsBoardQaRun!=null&&HasRoundPortrait(e.Avatar),
                mapPoint=IsCarAlive(e)?LargeMapPoint(new Vector2(e.Car.transform.position.x,e.Car.transform.position.z)).ToString():null,
                speed=e.Car==null?0:e.Car.Speed,torque=e.Car?.motor?.torqueMultiplier,lap=CurrentLap(e),flame=e.Visual?.FlameIntensity??0,
                lineOffset=DistanceFromRacingLine(e),safeTargetKph=e.Car==null?0:e.Car.aiSettings.targetSpeed*3.6f,
                aiMode=IsCarAlive(e)?e.Car.aiInput.mode.Value.ToString():null,clutchMode=IsCarAlive(e)?e.Car.playerInput?.clutchMode?.Value.ToString():null,
                motorClutch=IsCarAlive(e)&&e.Car.motorController!=null&&e.Car.motorController.MotorClutch,
                motorThrottle=IsCarAlive(e)?e.Car.motorController?.MotorThrottle:0,
                physicsTicked=IsCarAlive(e)&&e.Car.hasPhysicsTicked,
                racerRegistered=manager?.RacerData?.RacerIds.ContainsKey(e.Id)??false,
                lapRegistered=manager?.RacerData?.LapData.ContainsKey(e.Id)??false,
                progressStarted=progress!=null&&progress.HasStartedRace(e.Id),
                progressLapStarted=progress!=null&&progress.HasStartedLap(e.Id),
                startPositionRegistered=manager?.RacerData?.StartPositionIndices.ContainsKey(e.Id)??false,
                startPositionIndex=manager!=null&&manager.RacerData.StartPositionIndices.ContainsKey(e.Id)?manager.RacerData.StartPositionIndices[e.Id]:-1,
                outline=e.Visual?.UpgradeOutline!=null&&e.Visual.UpgradeOutline.enabled,
                e.PendingForwardJumps,e.ForwardJumpsUsed,e.ForwardMetresUsed,
                e.PendingRocketJumps,e.RocketJumpsUsed,e.RocketMetresUsed,
                position=IsCarAlive(e)?new{x=e.Car.transform.position.x,y=e.Car.transform.position.y,z=e.Car.transform.position.z}:null,
                skippingCheckpoint=IsCarAlive(e)&&e.Car.Respawner!=null&&e.Car.Respawner.isSkippingCheckpoint,
                finished=manager?.RacerData?.IsFinished(e.Id)??false}).ToArray(),
            appReady = AppBoot.IsBootComplete, state = GameStateManager.gameState.ToString(),
            scene = SceneManager.GetActiveScene().name,
            scenes = Enumerable.Range(0, SceneManager.sceneCount).Select(i => SceneManager.GetSceneAt(i).name).ToArray(),
            vehicles=VehicleDescriptors.All==null?Array.Empty<string>():VehicleDescriptors.All.Select(v=>v.name).ToArray(),
            stage = manager == null ? null : manager.LocalStageId.ToString(),
            cars = ActiveCars().Select(c => new { name = c.name, player = c.IsLocalPlayer(), speed = c.Speed,
                x = c.transform.position.x, y = c.transform.position.y, z = c.transform.position.z }).ToArray(),
            camera = view == null ? null : new { x = view.transform.position.x, y = view.transform.position.y,
                z = view.transform.position.z, yaw, pitch, cursorCaptured, fov=view.fieldOfView },
            grid = UObj.FindObjectsOfType<VehicleMarkerList>().Select(m => new { name = m.name,count=m.markers.Length,
                markers = m.markers.Take(3).Select(t => new {x=t.position.x,y=t.position.y,z=t.position.z}).ToArray() }).ToArray(),
            cameras = Resources.FindObjectsOfTypeAll<Camera>().Where(c => c.gameObject.scene.IsValid()).Select(c => new {
                name = c.name, enabled = c.enabled, active = c.gameObject.activeInHierarchy, depth = c.depth,
                mask = c.cullingMask, near = c.nearClipPlane, far = c.farClipPlane, rect = c.rect.ToString(),
                x = c.transform.position.x, y = c.transform.position.y, z = c.transform.position.z }).ToArray(),
            canvases = Resources.FindObjectsOfTypeAll<Canvas>().Where(c => c.gameObject.scene.IsValid()).Select(c => new {
                name = c.name, enabled = c.enabled, active = c.gameObject.activeInHierarchy, order = c.sortingOrder }).ToArray(),
            scenarios = Resources.FindObjectsOfTypeAll<RaceScenarioDescriptor>().Select(d => new { name = d.name,
                tracks = d.tracks == null ? Array.Empty<string>() : d.tracks.Where(t => t != null).Select(t => t.name).ToArray() }).ToArray()
        };
        File.WriteAllText(Path.Combine(control, "status.json"), JsonSerializer.Serialize(status, new JsonSerializerOptions { WriteIndented = true }));
    }

    private void DrawLegacyGUI()
    {
        if (cameraReady)
        {
            GUI.depth = -10000;
            GUI.color = Color.white;
            GUI.Label(new Rect(Screen.width / 2 - 9, Screen.height / 2 - 16, 24, 30), "+");
            if (countdownEnd > 0) GUI.Label(new Rect(Screen.width/2-180,Screen.height/2-90,360,140), RaceAudioPolicy.CountdownLabel(Time.realtimeSinceStartup-countdownStartedAt,countdownEnd-countdownStartedAt), new GUIStyle(GUI.skin.label){fontSize=86,alignment=TextAnchor.MiddleCenter});
            if (showPanel)
            {
                GUI.Box(new Rect(32,32,340,280), "TikMnG Arcade Racing");
                GUI.Label(new Rect(52,75,300,35), Running ? "Yaris basladi" : "Baslangic cizgisi hazir");
                if (GUI.Button(new Rect(52,118,300,48),"Test araci ekle")) { try { SpawnTest(); } catch(Exception ex) { error=ex.Message; } }
                if (GUI.Button(new Rect(52,176,300,48),"Yarisi baslat")) BeginCountdown();
                if (GUI.Button(new Rect(52,234,300,48),"Cikis")) Application.Quit();
            }
            return;
        }
        GUI.depth = -10000;
        var old = GUI.color;
        GUI.color = new Color(0.025f, 0.035f, 0.055f);
        GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), Texture2D.whiteTexture);
        GUI.color = Color.white;
        titleStyle ??= new GUIStyle(GUI.skin.label) { fontSize = 54, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
        subtitleStyle ??= new GUIStyle(GUI.skin.label) { fontSize = 20, alignment = TextAnchor.MiddleCenter };
        GUI.Label(new Rect(0, Screen.height * 0.42f, Screen.width, 85), "TikMnG", titleStyle);
        GUI.Label(new Rect(0, Screen.height * 0.42f + 85, Screen.width, 44), "ARCADE RACING", subtitleStyle);
        GUI.Label(new Rect(0, Screen.height * 0.74f, Screen.width, 40), error == null ? "Pist hazirlaniyor" : "Pist acilamadi", subtitleStyle);
        GUI.color = new Color(0.15f, 0.85f, 0.86f);
        var offset = (Mathf.Sin(Time.realtimeSinceStartup * 2.5f) + 1) * 60;
        GUI.DrawTexture(new Rect(Screen.width / 2 - 120 + offset, Screen.height * 0.8f, 120, 4), Texture2D.whiteTexture);
        GUI.color = old;
    }

    public void OnApplicationFocus(bool focused) { if (!focused) CaptureCursor(false); }
    private int RacePlace(ViewerCar entry)
    {
        var standings=RaceManager.Instance?.standings;
        if(standings==null)return 0;
        for(var i=0;i<standings.Count;i++)if(entry.Id.Equals(standings[i]))return i+1;
        return 0;
    }
    private bool shutdownComplete;
    public void OnApplicationQuit() => Shutdown();
    public void OnDestroy() => Shutdown();

    private void Shutdown()
    {
        if(shutdownComplete)return;
        shutdownComplete=true;
        StopLiveBridge();
        ClearCinematicCamera();
        ClosePresentationAudio();
        ClearForwardGiftScene();
        DisposeForwardEffectAudio();
        ClearResultsBoardScene();
        ClearRaceMarshalScene();
        ClearAudienceAvatarScene();
        StopVehicleAudio();
        if(Current==this)Current=null;
        CaptureCursor(false);
    }
}
