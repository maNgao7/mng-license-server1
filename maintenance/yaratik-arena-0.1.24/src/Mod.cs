using System.Reflection;
using System.Text.Json;
using HarmonyLib;
using Il2Cpp;
using MelonLoader;
using UnityEngine;
using UnityEngine.AI;
using Object = UnityEngine.Object;
using Random = System.Random;

[assembly: MelonInfo(typeof(TikMnG.CanEmAll.Mod), "TikMnG CanEmAll Prototype", TikMnG.CanEmAll.Mod.Version, "TikMnG")]
[assembly: MelonGame("LuisDev", "Can 'Em All Demo")]

namespace TikMnG.CanEmAll;

public sealed partial class Mod : MelonMod
{
    internal const string Version = "0.1.24";
    internal static readonly string Root = Path.GetFullPath(Path.Combine(Environment.CurrentDirectory, ".."));
    internal static readonly string Data = Path.Combine(Root, "userdata");
    internal static Mod Current = null!;
    private readonly Rules rules = new();
    private readonly TimedChallenge challenge = new();
    private readonly List<Creature> creatures = new();
    private readonly HashSet<IntPtr> creaturePointers = new();
    private readonly List<int> creatureBag = new();
    private int lastCreaturePrefab = -1;
    private SpawnBacklog pending = new(), nextRoundPending = new();
    private int nextRoundWeaponLevel;
    private readonly Random random = new();
    private readonly Dictionary<string, Texture2D> portraits = new();
    private bool ready, menu, vacuum, failed, probe;
    private float nextSetup, nextReport, nextCommand, bootTime, nextSpawnAttempt;
    private double restartAt;
    private Vector3 spawnCenter;
    private Weapon[] weapons = Array.Empty<Weapon>();
    private int appliedLevel = -1, commandSequence, balanceWeaponLevel;
    private bool appliedVacuum;
    private string message = "";
    private float messageUntil;
    private GUIStyle heading, text, small, number;
    private Texture2D panelTexture;
    private string lastHudError = "";
    private float qaVacuumUntil;
    private float qaVacuumStartDistance;
    private int vacuumCollected, outOfBoundsBodies;
    private float baseVacuumForce, baseVacuumVelocity;
    private const float VacuumRange = 14;
    private float qaLockUntil;
    private Quaternion? qaViewRotation;
    private float qaLivePauseUntil;
    private float nextCreatureMaintenance;
    private int deathRoundResets, lastResetCreatures, lastResetBodies, lastResetActiveRemainders;
    private bool QaLocked => Time.realtimeSinceStartup < qaLockUntil;

    private sealed class Creature
    {
        public Enemy Enemy = null!;
        public string Username = "";
        public string Model = "";
        public bool Counted;
        public string Kind = "spawn";
        public bool Friendly => Kind == "helper";
        public Transform Club;
        public Transform Hand;
        public Transform Forearm;
        public bool ClubOnHand;
        public Vector3 GripPosition, ShoulderPosition;
        public Quaternion GripRotation;
        public float ShownHealth = -1, ShownMaximum = -1;
        public float LastDamagedAt = -100, BaseMoveSpeed;
        public float HelperRemaining = CombatBalance.HelperSeconds;
        public string HealthText = "";
        public float NextTarget, NextStep;
        public Creature Target;
        public Vector3 StepPosition;
        public readonly CreatureAttack Attack = new();
        public Vector3 LastSafePosition;
        public Vector3 CrowdPosition, CrowdAvoidance;
        public float ApproachAngle, StuckFor, CrowdLastDistance = float.PositiveInfinity;
        public int CrowdNeighbours;
        public bool CrowdHold;
    }

    public override void OnInitializeMelon()
    {
        Current = this;
        Application.runInBackground = true;
        Directory.CreateDirectory(Data);
        Directory.CreateDirectory(Path.Combine(Root, "qa"));
        PublishStartup("settings");
        try { LoadSettings(); LoadAudioDefaults(); }
        catch { PublishStartup("failed", true); throw; }
        PublishStartup("hooks");
        var lastCommand = Path.Combine(Root, "qa", "command.json");
        if (File.Exists(lastCommand)) { using var previous = JsonDocument.Parse(File.ReadAllText(lastCommand)); commandSequence = previous.RootElement.GetProperty("seq").GetInt32(); }
        probe = Environment.GetCommandLineArgs().Contains("--tikmng-probe");
        // Patch native game-owned save paths, not Unity internal-call wrappers.
        Hook(typeof(SaveManager), "get_SavePath", nameof(SavePath));
        Hook(typeof(SaveManager), "get_SettingsPath", nameof(SettingsPath));
        Hook(typeof(SaveManager), "LoadSettings", nameof(BeforeNativeSettingsLoad));
        Hook(typeof(SaveManager), "LoadSettings", nameof(AfterNativeSettingsLoad), true);
        foreach (var method in new[] { "Start", "StartGame", "Update", "Suicide", "ShowDemoFinishedPopup", "OnTriggerOutsideElevator", "OnTriggerInsideElevator" }) Hook(typeof(GameManager), method, nameof(Skip));
        foreach (var method in new[] { "get_IsGameOver", "get_IsSuiciding" }) Hook(typeof(GameManager), method, nameof(False));
        Hook(typeof(GameManager), "get_CanPlayerInput", nameof(InputAllowed));
        Hook(typeof(GameManager), "get_CanJump", nameof(InputAllowed));
        Hook(typeof(GameManager), "OnEnemyDeath", nameof(Death));
        Hook(typeof(Enemy), "Update", nameof(AfterEnemyUpdate), true);
        Hook(typeof(Enemy), "TryPickNewPath", nameof(BeforeArenaPath));
        Hook(typeof(Enemy), "TryPickNewPath", nameof(AfterArenaPath), true);
        Hook(typeof(Enemy), "Move", nameof(BeforeCrowdMove));
        Hook(typeof(Enemy), "Damage", nameof(BeforeCreatureDamage));
        Hook(typeof(Enemy), "Damage", nameof(AfterCreatureDamage), true);
        Hook(typeof(Enemy), "StartPanic", nameof(BeforeCreaturePanic));
        Hook(typeof(Enemy), "ShockwaveDamage", nameof(BeforeCreatureShockwave));
        Hook(typeof(Enemy), "ShockwaveDamage", nameof(AfterCreatureShockwave), true);
        Hook(typeof(ParticlePoolManager), "SpawnBlood", nameof(AfterBloodSpawn), true);
        Hook(typeof(ParticlePoolManager), "SpawnBlood", nameof(BeforeBloodSpawn));
        Hook(typeof(BloodParticleManager), "TryEmit", nameof(BeforeBloodEmit));
        Hook(typeof(Enemy), "UpdateBloodTrail", nameof(BloodVisualAllowed));
        Hook(typeof(Enemy), "TryAddDamageVisual", nameof(DamageSlotAllowed));
        Hook(typeof(Enemy), "AddGlobalDamage", nameof(BloodVisualAllowed));
        Hook(typeof(Enemy), "SetGlobalDamageVisual", nameof(GlobalDamageVisualAllowed));
        foreach (var method in new[] { "Damage", "CheckDamage", "CheckFalling", "DeadBodyInput" }) Hook(typeof(Player), method, nameof(Skip));
        Hook(typeof(Player), "RotateCamera", nameof(CameraInputAllowed));
        Hook(typeof(Player), "Move", nameof(BeforePlayerMove));
        Hook(typeof(Player), "FixedUpdate", nameof(BeforeAutoFixedUpdate));
        Hook(typeof(Inventory), "SelectWeapons", nameof(Skip));
        Hook(typeof(Truck), "StartTruck", nameof(Skip));
        Hook(typeof(Menu), "ConstructMenuScene", nameof(Skip));
        Hook(typeof(Menu), "SpawnMenuEnemies", nameof(Skip));
        Hook(typeof(Vacuum), "Suck", nameof(AfterSuck), true);
        Hook(typeof(Vacuum), "IsProtectedByCrusher", nameof(NoFactoryVacuumProtection));
        Hook(typeof(Vacuum), "Throw", nameof(Skip));
        Hook(typeof(GameManager), "OnBulletImpact", nameof(AfterBoardBulletImpact), true);
        Hook(typeof(BaseballBat), "DamageDelayed", nameof(AfterBoardBatSwing), true);
        foreach (var type in new[] { typeof(Pistol), typeof(SMG), typeof(AK47), typeof(Shotgun), typeof(RocketLauncher) })
        {
            Hook(type, "Update", nameof(BeforeMagazineUpdate));
            Hook(type, "Update", nameof(AfterMagazineUpdate), true);
        }
        Hook(typeof(FlameThrower), "Update", nameof(BeforeFlameUpdate));
        Hook(typeof(FlameThrower), "Update", nameof(AfterFlameUpdate), true);
        MelonLogger.Msg("TikMnG hooks ready; isolated save directory: " + Data);
        File.WriteAllText(Path.Combine(Data, "boot.json"), JsonSerializer.Serialize(new { initialized = true, version = Version, isolatedSaves = true }));
    }

    private void Hook(Type type, string method, string prefix, bool postfix = false)
    {
        var target = AccessTools.Method(type, method) ?? throw new MissingMethodException(type.FullName, method);
        var handler = new HarmonyMethod(typeof(Mod).GetMethod(prefix, BindingFlags.NonPublic | BindingFlags.Static)!);
        HarmonyInstance.Patch(target, prefix: postfix ? null : handler, postfix: postfix ? handler : null);
    }
    private static bool Skip() => false;
    private static bool CameraInputAllowed() => !Current.QaLocked && (!Current.autoPlaying || Current.PrisonActive) && !Current.roundDied;
    private static bool False(ref bool __result) { __result = false; return false; }
    private static bool NoFactoryVacuumProtection(ref bool __result)
    {
        if (!Current.ready) return true;
        __result = false; return false;
    }
    private static bool InputAllowed(ref bool __result) { __result = Current.ready && !Current.menu && !Current.QaLocked && (!Current.autoPlaying || Current.PrisonActive) && !Current.dashActive && !Current.roundDied && !GameManager.Instance.IsPaused; return false; }
    private static bool SavePath(ref string __result) { __result = Path.Combine(Data, "save.sav"); return false; }
    private static bool SettingsPath(ref string __result) { __result = Path.Combine(Data, "settings.sav"); return false; }
    private static bool Death(Enemy enemy, Weapon weapon) { Current.CountDeath(enemy); return false; }
    private static void AfterEnemyUpdate(Enemy __instance)
    {
        if (Current.roundDied && Current.creaturePointers.Contains(__instance.Pointer) && !__instance.IsDead)
        {
            var halted = __instance.rb.linearVelocity;
            __instance.rb.linearVelocity = new Vector3(0, halted.y, 0); return;
        }
        if (!Current.ready || !Current.creaturePointers.Contains(__instance.Pointer) || __instance.IsDead || __instance.isHeld || __instance.IsFreeFall || __instance.knockbackTimer > 0 || __instance.panicTimer > 0 || __instance.CurrentState != Enemy.State.Roaming) return;
        var velocity = __instance.rb.linearVelocity;
        if (Math.Abs(velocity.y) > .5f) return;
        if (Current.CombatRunning && Current.combatCreatures.TryGetValue(__instance.Pointer, out var creature))
        {
            if (creature.CrowdHold || creature.Attack.Started >= 0) return;
            // Contact impulses must not make the model face left/right on alternating physics steps.
            velocity = __instance.currentMoveDirection * __instance.currentMoveSpeed;
        }
        velocity.y = 0;
        if (velocity.sqrMagnitude < .04f) return;
        var target = Quaternion.LookRotation(velocity.normalized, Vector3.up);
        // Only rotate the model; native pathfinding and collision velocity stay intact.
        __instance.targetRot = target;
        __instance.currentRot = Quaternion.RotateTowards(__instance.visual.rotation, target, 720 * Time.deltaTime);
        __instance.visual.rotation = __instance.currentRot;
    }
    private static void AfterSuck()
    {
        try
        {
            if (Current.ready && Current.vacuum && !Current.PrisonActive && !Current.menu && !GameManager.Instance.IsPaused)
                Current.PullArenaBodies(Vacuum.Instance);
            Current.DiscardStoredBodies();
        }
        catch (Exception e) { MelonLogger.Error("Vacuum cleanup: " + e); }
    }

    public override void OnUpdate()
    {
        if (failed) return;
        try
        {
            if (ready) { RemoveBossShake(); RemoveReloadPose(); }
            if (!ready)
            {
                if (Time.realtimeSinceStartup > nextSetup)
                {
                    nextSetup = Time.realtimeSinceStartup + 1;
                    if (GameManager.Instance != null && Player.Instance != null && Inventory.Instance != null && Truck.Instance != null) Setup();
                }
                return;
            }
            SamplePerformance();
            SampleQaAudio();
            UpdateHighlights();
            if (!QaLocked)
            {
                if (Input.GetKeyDown(KeyCode.B) && (!menu || focusedField.Length == 0))
                {
                    if (GameManager.Instance.IsPaused) { GameManager.Instance.Resume(); GameManager.Instance.UpdatePause(); }
                    SetMenu(!menu);
                }
                if (Input.GetKeyDown(KeyCode.Escape)) ToggleOriginalMenu();
            }
            if (!menu) GameManager.Instance.UpdatePause();
            if (!menu && !GameManager.Instance.IsPaused && !QaLocked)
            {
                if (Input.GetKeyDown(KeyCode.P)) SetAutoPlay(!autoPlaying);
                if (autoPlaying && (Input.GetKeyDown(KeyCode.W) || Input.GetKeyDown(KeyCode.A) || Input.GetKeyDown(KeyCode.S) || Input.GetKeyDown(KeyCode.D))) SetAutoPlay(false);
                if (Input.GetKeyDown(KeyCode.E)) { if (autoPlaying) SetAutoPlay(false, false); vacuum = !vacuum; ApplyWeapon(); }
                if (Input.GetKeyDown(KeyCode.F1)) Add(1, "Deniz");
                if (Input.GetKeyDown(KeyCode.F2)) Add(10, "Yildiz");
                if (Input.GetKeyDown(KeyCode.F3)) Add(50, "Atlas");
                if (Input.GetKeyDown(KeyCode.F6)) Shift(1);
                if (Input.GetKeyDown(KeyCode.F7)) Shift(-1);
            }
            UpdateGiftEffects();
            UpdateCreatureBalance();
            UpdateCrouch();
            UpdateCombatPursuit();
            UpdateSurvival();
            UpdateAirDash();
            UpdateWeaponResources();
            SampleCrowdMotion();
            if (!menu && !GameManager.Instance.IsPaused) UpdateArenaCrowd();
            if (appliedLevel != rules.Level || appliedVacuum != vacuum) ApplyWeapon();
            UpdateAutoPlay();
            UpdateProgressHud();
            PollLive();
            PollCombatVisuals();
            if (vacuum && !PrisonActive && Time.realtimeSinceStartup < qaVacuumUntil)
            {
                ApplyQaView();
                Vacuum.Instance.state = Vacuum.VacuumState.Sucking;
                Vacuum.Instance.vacuumStrength = 1;
                Vacuum.Instance.Suck();
            }
            if (Time.realtimeSinceStartup >= nextCreatureMaintenance)
            {
                nextCreatureMaintenance = Time.realtimeSinceStartup + .1f;
                for (int index = creatures.Count - 1; index >= 0; index--)
                {
                    var c = creatures[index];
                if (c.Enemy == null) { creaturePointers.Remove(c.Enemy?.Pointer ?? IntPtr.Zero); creatures.Remove(c); }
                else
                {
                    if (c.Enemy.IsDead && !c.Counted) CountDeath(c.Enemy);
                    RescueBoardOccupant(c);
                    var position = c.Enemy.rb.position;
                    if (!BehindMissionBoard(position) && position.y >= -.5f && position.y < 8.5f && Math.Abs(position.x) <= ArenaHalfX && Math.Abs(position.z) <= ArenaHalfZ)
                        c.LastSafePosition = position;
                    if (c.Enemy.transform.position.y < spawnCenter.y - 40)
                    {
                        if (c.Enemy.IsDead)
                        {
                            outOfBoundsBodies++;
                            var floorPosition = c.LastSafePosition;
                            floorPosition.y = Math.Max(.45f, floorPosition.y);
                            c.Enemy.rb.position = floorPosition;
                            c.Enemy.rb.linearVelocity = Vector3.zero;
                            c.Enemy.rb.angularVelocity = Vector3.zero;
                        }
                        else
                        {
                            liveFallRescues++;
                            c.Enemy.rb.position = c.LastSafePosition + Vector3.up;
                            c.Enemy.rb.linearVelocity = Vector3.zero;
                            c.Enemy.SpawnRoaming(Math.Max(8, Truck.Instance.roamRadius));
                        }
                    }
                }
                }
            }
            bool ended = settings.TimedMode ? CheckTimedChallenge() : rules.Tick(Time.time, pending.Count > 0);
            if (ended)
            {
                lastRoundRecap = highlights.Finish(rules.Round, !roundTimedOut, Time.time, rules.Wins);
                ClearRoundBlood();
                restartAt = Time.time + 4;
                Notice(roundTimedOut ? "SURE DOLDU" : "WINNER"); PlayTone(880, .3f);
            }
            if ((rules.Won || roundTimedOut) && Time.time >= restartAt)
            {
                Reset();
            }
            UpdateMissionBoard();
            PollMissionBoardInput();
            if (Time.realtimeSinceStartup >= nextCommand) { nextCommand = Time.realtimeSinceStartup + .1f; ReadCommand(); }
            if (Time.realtimeSinceStartup >= nextReport) { nextReport = Time.realtimeSinceStartup + 1; Report(); }
            if (probe && Time.realtimeSinceStartup - bootTime > 12)
            {
                MelonCoroutines.Start(Capture("prototype.png")); probe = false;
            }
        }
        catch (Exception e) { failed = true; PublishStartup("failed", true); MelonLogger.Error(e); File.WriteAllText(Path.Combine(Root, "qa", "failure.txt"), e.ToString()); }
    }

    private void Setup()
    {
        PublishStartup("arena");
        var gm = GameManager.Instance;
        var player = Player.Instance;
        var inventory = Inventory.Instance;
        Screen.SetResolution(1280, 720, FullScreenMode.Windowed);
        int removedBarriers = 0;
        foreach (var transform in Object.FindObjectsOfType<Transform>())
        {
            string name = transform.gameObject.name;
            if (name == "ForceField" || name.StartsWith("ForceField (") || name == "ForceFieldMachine") { transform.gameObject.SetActive(false); removedBarriers++; }
            if ((name == "Money" || name == "Stamina") && transform.GetComponent<RectTransform>() != null) transform.gameObject.SetActive(false);
        }
        MelonLogger.Msg("Removed barrier objects: " + removedBarriers);
        gm.StopAllCoroutines(); gm.Timer = 999999; gm.dayDuration = 999999; gm.nightShiftDuration = 999999;
        gm.IsGameOver = false; gm.IsPaused = false; gm.IsSuiciding = false;
        gm.damageMultiplier = 1; gm.shootSpeedMultiplier = 1; gm.meleeAttackSpeedMultiplier = 1; gm.ammoCapacityMultiplier = 1;
        foreach (var go in new[] { gm.timerParent, gm.sunTimer, gm.nightTimer, gm.screenGoodMorning, gm.screenGoodNight, gm.screenStats, gm.demoPopUp }) if (go != null) go.SetActive(false);
        if (gm.fadeImage != null) gm.fadeImage.gameObject.SetActive(false);
        if (gm.pauseMenu != null) gm.pauseMenu.gameObject.SetActive(false);
        gm.TurnOnMachines(false);
        gm.elevatorDoorCollider.enabled = false;
        foreach (var machine in gm.canProcessors) machine.enabled = false;
        foreach (var conveyor in gm.conveyors) conveyor.enabled = false;
        foreach (var m in Object.FindObjectsOfType<Menu>())
        {
            m.DestroyConstructedScene();
            if (m.menuPanel != null) m.menuPanel.SetActive(false);
            if (m.gameplayPanel != null) m.gameplayPanel.SetActive(true);
        }
        EnsureArenaNavigation();
        ConfigureArena();
        ConfigureNativeControls();
        player.gameObject.SetActive(true); player.infiniteStamina = true;
        player.mouseSensitivity = settings.Sensitivity;
        AudioListener.volume = settings.Volume;
        EnsureFirstInstallAudio();
        var entry = gm.elevatorStartPoint.position + gm.elevatorStartPoint.forward * 14;
        if (!NavMesh.SamplePosition(entry, out var hit, 500, -1)) throw new InvalidOperationException("No safe floor position.");
        spawnCenter = hit.position;
        player.rb.position = spawnCenter + Vector3.up * 1.3f; player.rb.linearVelocity = Vector3.zero;
        player.rotX = 0; player.rotY = 0; player.mainCamera.transform.localRotation = Quaternion.identity;
        File.WriteAllText(Path.Combine(Root, "qa", "weapons.json"), JsonSerializer.Serialize(inventory.allWeapons.ToArray().Select(w => new { name = w.gameObject.name, type = w.GetIl2CppType().FullName })));
        weapons = new[] { FindWeapon("BaseballBat"), FindWeapon("Knife"), FindWeapon("Pistol"), FindWeapon("SMG"), FindWeapon("AK47"), FindWeapon("Shotgun"), FindWeapon("RocketLauncher"), FindWeapon("FlameThrower") };
        foreach (var w in weapons) inventory.UnlockWeapon(w);
        inventory.UnlockWeapon(Vacuum.Instance);
        PublishStartup("assets");
        try { ConfigureBranding(); }
        catch (Exception e) { brandingError = e.Message; MelonLogger.Warning("Branding: " + e.Message); }
        ConfigureVacuum();
        PrepareVacuumCollectionAudio();
        PrepareFlashPresentation();
        foreach (var e in Object.FindObjectsOfType<Enemy>()) if (e.gameObject.activeInHierarchy) Truck.Instance.ReturnEnemy(e);
        ready = true; bootTime = Time.realtimeSinceStartup;
        ResetSurvival();
        RefreshBloodColors();
        ApplyWeapon(); SetMenu(false);
        Screen.SetResolution(Display.main.systemWidth, Display.main.systemHeight, FullScreenMode.FullScreenWindow);
        PublishStartup("first-frame");
        string savedAccount = AccountSelection.StartupUsername(settings.BroadcasterUsername, settings.AutoConnect);
        if (savedAccount.Length > 0) ConnectLive(savedAccount);
        MelonLogger.Msg("TikMnG arena ready at " + spawnCenter + "; 8 weapons; elevator and day/night loop disabled.");
        Report();
    }

    private static Weapon FindWeapon(string name)
    {
        foreach (var weapon in Inventory.Instance.allWeapons) if (weapon.GetIl2CppType().Name == name) return weapon;
        throw new InvalidOperationException("Missing weapon: " + name);
    }

    private void ApplyWeapon()
    {
        RefreshCreatureHealth();
        RemoveReloadPose();
        if (appliedLevel != rules.Level || appliedVacuum != vacuum)
        {
            resources.Get(appliedLevel)?.CancelReload();
            autoFlameUntil = 0; StopFlame();
        }
        if (appliedLevel >= 0 && appliedLevel != rules.Level)
        {
            weaponChangeDirection = Math.Sign(rules.Level - appliedLevel);
            weaponChangedUntil = Time.realtimeSinceStartup + 2.4f;
            shownProgress = rules.IsFinalWeapon ? 1 : rules.Progress / (float)rules.RequiredCollections;
        }
        var inventory = Inventory.Instance;
        var selected = vacuum ? Vacuum.Instance.Cast<Weapon>() : weapons[rules.Level];
        for (int i = 0; i < inventory.unlockedWeapons.Count; i++)
            if (inventory.unlockedWeapons[i].Pointer == selected.Pointer) inventory.currentWeaponIndex = i;
        inventory.DisableAllWeapons();
        selected.gameObject.SetActive(!PrisonActive && !roundDied);
        selected.Select();
        if (!vacuum && resources.Get(rules.Level) != null) SyncMagazine(rules.Level);
        else selected.RestoreAmmo();
        if (BulletCounter.Instance?.visual != null) BulletCounter.Instance.visual.SetActive(false);
        if (vacuum) ConfigureVacuum();
        if (PrisonActive || roundDied) inventory.DisableAllWeapons();
        inventory.weaponsPanel.SetActive(false);
        inventory.switchButton.SetActive(false);
        appliedLevel = rules.Level; appliedVacuum = vacuum;
        highlights.VisitWeapon(rules.Level);
    }

    private void Add(int count, string user, bool notify = true, string kind = "spawn")
    {
        if (count < 1) return;
        if (rules.Won || roundTimedOut)
        {
            count = Math.Min(count, Math.Max(0, settings.MaxCreatures - nextRoundPending.Count));
            if (kind == "helper") count = Math.Min(count, Math.Max(0, 12 - nextRoundPending.CountKind(kind)));
            nextRoundPending.Enqueue(user, count, kind);
            return;
        }
        if (kind == "helper") count = Math.Min(count, Math.Max(0, 12 - helpers.Count(c => c.Enemy != null && !c.Enemy.IsDead) - pending.CountKind(kind)));
        count = Math.Min(count, Math.Max(0, settings.MaxCreatures - creatures.Count(c => c.Enemy != null && !c.Enemy.IsDead) - pending.Count));
        pending.Enqueue(user, count, kind);
        if (count > 0 && roundStartedAt < 0) roundStartedAt = Time.time;
        if (count > 0 && notify) Notice(ActionName(kind) + "  +" + count);
    }

    private bool Spawn(string user, Vector3? target = null, string kind = "spawn")
    {
        var truck = Truck.Instance;
        var point = target ?? Vector3.zero;
        if (target.HasValue && BehindMissionBoard(point)) { rejectedBoardSpawns++; return false; }
        if (kind == "helper" && helpers.Count(c => c.Enemy != null && !c.Enemy.IsDead) >= 12) return true;
        if (!target.HasValue && !TryArenaSpawnPoint(out point, CreatureSize(kind))) { nextSpawnAttempt = Time.realtimeSinceStartup + .08f; return false; }
        var prefabs = truck.allEnemyPrefabs.Count > 0 ? truck.allEnemyPrefabs : truck.unlockedEnemyPrefabs;
        if (creatureBag.Count == 0)
        {
            for (int i = 0; i < prefabs.Count; i++) creatureBag.Add(i);
            for (int i = creatureBag.Count - 1; i > 0; i--)
            {
                int other = random.Next(i + 1);
                (creatureBag[i], creatureBag[other]) = (creatureBag[other], creatureBag[i]);
            }
            if (creatureBag.Count > 1 && creatureBag[^1] == lastCreaturePrefab) (creatureBag[0], creatureBag[^1]) = (creatureBag[^1], creatureBag[0]);
        }
        int selected = creatureBag[^1]; creatureBag.RemoveAt(creatureBag.Count - 1); lastCreaturePrefab = selected;
        var prefab = prefabs[selected];
        if (!CanAllocateNativeCreature() && truck.GetPool(prefab).Count == 0) return false;
        var enemy = truck.GetEnemy(prefab, point, Quaternion.identity);
        enemy.gameObject.SetActive(true); enemy.Restore();
        enemy.rb.interpolation = RigidbodyInterpolation.Interpolate;
        nextArenaPath.Remove(enemy.Pointer);
        creaturePointers.Add(enemy.Pointer);
        cleanedBodyBlood.Remove(enemy.Pointer);
        enemy.rotationSpeed = 10; enemy.pathMaxTime = Math.Max(12, enemy.pathMaxTime);
        enemy.SpawnRoaming(Math.Max(8, truck.roamRadius));
        enemy.moveSpeed = prefab.moveSpeed * CombatBalance.MoveMultiplier(kind);
        var creature = new Creature { Enemy = enemy, Username = user, Model = prefab.gameObject.name, LastSafePosition = point, Kind = kind, StepPosition = point, BaseMoveSpeed = prefab.moveSpeed };
        creature.CrowdPosition = point;
        creature.ApproachAngle = (++crowdArrivalSequence * 2.39996323f) % (Mathf.PI * 2);
        ApplyCreatureScale(enemy, kind);
        enemy.maxHealth = CombatBalance.Health(kind, balanceWeaponLevel); enemy.health = enemy.maxHealth;
        GameManager.Instance.RegisterEnemy(enemy);
        creatures.Add(creature);
        combatCreatures[enemy.Pointer] = creature;
        SetCreaturePlayerCollision(creature, true);
        if (creature.Friendly) { helpers.Add(creature); EquipHelper(creature); } else rules.Spawn(1);
        highlights.Begin(Time.time);
        if (!target.HasValue) LaunchArrival(enemy, point);
        return true;
    }

    private void CountDeath(Enemy enemy)
    {
        var tracked = creatures.Find(c => c.Enemy.Pointer == enemy.Pointer);
        if (tracked == null || tracked.Counted) return;
        int previousKills = rules.Kills;
        tracked.Counted = true;
        SetCreaturePlayerCollision(tracked, false);
        if (tracked.Friendly) { RemoveHelperGear(tracked); helpers.Remove(tracked); return; }
        rules.Kill(Time.time);
        if (rules.Kills > previousKills) RegisterHighlightKill();
        if (autoPlaying) { autoKills++; autoNextTarget = 0; }
        if (settings.TimedMode) challenge.Kill(Time.time);
    }

    private void DiscardStoredBodies()
    {
        if (!ready) return;
        var vacuumTool = Vacuum.Instance;
        while (vacuumTool.grabbables.Count > 0)
        {
            var stored = vacuumTool.grabbables[0];
            vacuumTool.grabbables.RemoveAt(0);
            var enemy = stored.TryCast<Enemy>();
            if (enemy == null) continue;
            if (!creaturePointers.Remove(enemy.Pointer)) continue;
            combatCreatures.Remove(enemy.Pointer);
            var participant = creatures.Find(c => c.Enemy.Pointer == enemy.Pointer);
            bool trackedBody = enemy.IsDead && participant != null && !participant.Friendly;
            if (participant != null) { SetCreaturePlayerCollision(participant, false); RemoveHelperGear(participant); helpers.Remove(participant); }
            creatures.RemoveAll(c => c.Enemy.Pointer == enemy.Pointer);
            cleanedBodyBlood.Remove(enemy.Pointer);
            ForgetVacuumReference(enemy);
            nextArenaPath.Remove(enemy.Pointer); motionPositions.Remove(enemy.Pointer);
            Truck.Instance.ReturnEnemy(enemy);
            if (!trackedBody) continue;
            vacuumCollected++;
            int previousLevel = rules.Level;
            if (!roundTimedOut) rules.Collect();
            RegisterHighlightCollection();
            if (rules.Level != previousLevel) { Notice(Rules.WeaponNames[rules.Level]); PlayTone(660, .12f); }
            PlayVacuumCollectionSound(vacuumTool);
        }
    }

    private void ConfigureVacuum()
    {
        var tool = Vacuum.Instance;
        if (baseVacuumForce == 0)
        {
            baseVacuumForce = tool.suckForce;
            baseVacuumVelocity = tool.suckMaxVelocity;
            File.WriteAllText(Path.Combine(Root, "qa", "vacuum-original.json"), JsonSerializer.Serialize(new
            {
                tool.suckRange, tool.distortionRange, tool.suckForce, tool.suckMaxVelocity, tool.suckDisableDistance
            }, new JsonSerializerOptions { WriteIndented = true }));
        }
        tool.suckRange = VacuumRange;
        tool.distortionRange = VacuumRange;
        tool.suckForce = baseVacuumForce * 1.6f;
        tool.suckMaxVelocity = baseVacuumVelocity * 1.4f;
        tool.suckDisableDistance = .9f;
        tool.suckPopVolume = 0; // Intake feedback is emitted once, only after a tracked corpse is consumed.
    }

    private void Shift(int direction) { rules.Shift(direction); Notice(Rules.WeaponNames[rules.Level]); ApplyWeapon(); }
    private void ForgetVacuumReference(Enemy enemy)
    {
        var tool = Vacuum.Instance;
        var grabbable = enemy.Cast<IGrabbable>();
        while (tool.grabbables.Remove(grabbable)) { }
        tool.grabbablesInRange.Remove(grabbable);
        tool.ignoredGrabbables.Remove(grabbable);
    }

    private void Reset(bool clearBodies = false)
    {
        bool afterDeath = roundDied;
        bool resumeAutoPlay = afterDeath && autoPlaying;
        clearBodies |= afterDeath;
        // A defeat is a fresh arena; ordinary wins still leave bodies available for collection.
        if (clearBodies)
        {
            if (autoPlaying) SetAutoPlay(false, false);
            StopAutoEffects();
            Vacuum.Instance.grabbables.Clear();
            Vacuum.Instance.grabbablesInRange.Clear();
            Vacuum.Instance.ignoredGrabbables.Clear();
        }
        ResetSurvival();
        StopAirDash(); airDash.Reset(); ClearVacuumTestWall(); qaVacuumUntil = 0;
        qaCrouch = false; SetCrouchTestCeiling(false);
        autoTarget = null; autoNextTarget = autoNextPath = 0; autoCorners = Array.Empty<Vector3>();
        ClearRoundBlood();
        lastResetCreatures = lastResetBodies = lastResetActiveRemainders = 0;
        foreach (var c in creatures.ToArray())
        {
            if (!clearBodies && c.Enemy != null && c.Enemy.IsDead) continue;
            RemoveHelperGear(c); helpers.Remove(c);
            SetCreaturePlayerCollision(c, false);
            c.Target = null; c.Attack.Target = null; c.Attack.Next = 0; c.Attack.Contact = false;
            if (c.Enemy != null)
            {
                var enemy = c.Enemy;
                lastResetCreatures++;
                if (enemy.IsDead) lastResetBodies++;
                ForgetVacuumReference(enemy);
                creaturePointers.Remove(enemy.Pointer); cleanedBodyBlood.Remove(enemy.Pointer);
                combatCreatures.Remove(enemy.Pointer);
                nextArenaPath.Remove(enemy.Pointer); motionPositions.Remove(enemy.Pointer);
                enemy.pathCornerCount = 0;
                enemy.rb.linearVelocity = enemy.rb.angularVelocity = Vector3.zero;
                Truck.Instance.ReturnEnemy(enemy);
                if (enemy.gameObject.activeInHierarchy) lastResetActiveRemainders++;
            }
            creatures.Remove(c);
        }
        if (clearBodies)
        {
            ClearCombatPursuit();
            helpers.Clear(); creaturePointers.Clear(); cleanedBodyBlood.Clear();
            nextArenaPath.Clear(); motionPositions.Clear(); recentArrivals.Clear();
            autoVacuumBatch.Reset(); autoCollecting = autoHasAim = autoJumpRequested = false;
            autoMove = Vector3.zero; autoPreviousTarget = IntPtr.Zero;
            autoCorner = 0; autoNextShot = autoNextJump = autoCommitUntil = autoSwingUntil = 0;
            autoStuckFor = 0; autoLastCollected = vacuumCollected; autoBodyStart = vacuumCollected;
            autoCollectionProgressAt = Time.time; autoLastPosition = Player.Instance.rb.position;
            RemoveBossShake(); shakeUntil = shakePower = 0;
            hitUntil = 0; messageUntil = 0;
        }
        resources.Reset(); autoFlameUntil = 0; RemoveReloadPose();
        pending.Clear(); rules.Reset(); balanceWeaponLevel = 0; vacuum = false;
        highlights.Reset(); highlights.ConfigureCleanup(false, settings.CleanupTarget);
        comboMilestoneUntil = 0;
        if (clearBodies) { giftNotices.Clear(); activeGiftNotice = null; }
        challenge.Reset(); nextProfileRefresh = 0;
        if (clearBodies) { effects.Clear(); SyncPrison(); }
        if (clearBodies) { flashIntroQueued = false; flashBlastAt = -100; }
        // New gifts received during the result screen belong to the next round.
        (pending, nextRoundPending) = (nextRoundPending, pending);
        for (int i = 0; i < nextRoundWeaponLevel; i++) rules.Shift(1);
        nextRoundWeaponLevel = 0;
        ApplyWeapon();
        foreach (var portrait in portraits.Values) Object.Destroy(portrait);
        portraits.Clear();
        roundStartedAt = pending.Count > 0 ? Time.time : -1; roundTimedOut = false; nextSpawnAttempt = 0;
        shownProgress = 0; weaponChangedUntil = 0;
        if (afterDeath)
        {
            deathRoundResets++;
            restartAt = 0;
            Player.Instance.rb.position = spawnCenter + Vector3.up * 1.3f;
            Player.Instance.rb.linearVelocity = Vector3.zero;
            Player.Instance.input = Vector3.zero;
        }
        if (resumeAutoPlay) SetAutoPlay(true);
    }
    private void SetMenu(bool value)
    {
        if (!value) ReleaseCatalogScroll();
        if (menu && !value && settingsDirty) SaveMenuSettings();
        if (menu != value) { menuRendered = false; menuGiftImages = 0; }
        focusedField = "";
        menu = value; Cursor.lockState = value ? CursorLockMode.None : CursorLockMode.Locked; Cursor.visible = value; Time.timeScale = value ? 0 : 1;
    }
    private void ToggleOriginalMenu()
    {
        if (menu) SetMenu(false);
        var gm = GameManager.Instance;
        gm.pauseMenu.gameObject.SetActive(true);
        gm.IsPaused = !gm.IsPaused;
        gm.UpdatePause();
        if (!gm.IsPaused) gm.Resume();
        Cursor.lockState = gm.IsPaused ? CursorLockMode.None : CursorLockMode.Locked;
        Cursor.visible = gm.IsPaused;
        Time.timeScale = gm.IsPaused ? 0 : 1;
    }
    private void Notice(string value) { message = value; messageUntil = Time.realtimeSinceStartup + 3; }
    private void PlayTone(int hz, float duration)
    {
        if (Player.Instance?.audioSource == null) return;
        var clip = hz > 800 ? GameManager.Instance.elevatorDingClip : hz > 500 ? Inventory.Instance.tickClip : Vacuum.Instance.tickClip;
        if (clip != null) Player.Instance.audioSource.PlayOneShot(clip, .4f);
    }

    private void ReadCommand()
    {
        var path = Path.Combine(Root, "qa", "command.json");
        if (!File.Exists(path)) return;
        string json;
        try
        {
            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            using var reader = new StreamReader(stream);
            json = reader.ReadToEnd();
        }
        catch (IOException) { return; }
        using var doc = JsonDocument.Parse(json);
        var command = doc.RootElement;
        int seq = command.GetProperty("seq").GetInt32();
        if (seq <= commandSequence) return;
        commandSequence = seq;
        switch (command.GetProperty("op").GetString())
        {
            case "audience-settings":
                settings.LikeThreshold = Math.Clamp(command.GetProperty("threshold").GetInt32(), 1, 1000000);
                settings.LikeAction.Enabled = command.GetProperty("likes").GetBoolean();
                settings.FollowAction.Enabled = command.GetProperty("follows").GetBoolean();
                if (command.TryGetProperty("likeOp", out var likeOp) && ActionOps.Contains(likeOp.GetString())) settings.LikeAction.Op = likeOp.GetString();
                if (command.TryGetProperty("followOp", out var followOp) && ActionOps.Contains(followOp.GetString())) settings.FollowAction.Op = followOp.GetString();
                audience.Configure(settings.LikeThreshold); audience.Clear(); SaveSettings(); break;
            case "live-event-fixture": ConsumeLiveEvent(JsonSerializer.Deserialize<LiveEvent>(command.GetProperty("event").GetRawText())); break;
            case "team-fixture":
                Spawn(command.GetProperty("user").GetString() ?? "qa_team", new Vector3(command.GetProperty("x").GetSingle(), .42f, command.GetProperty("z").GetSingle()), command.GetProperty("kind").GetString() ?? "spawn"); break;
            case "spawn": Add(command.GetProperty("count").GetInt32(), command.TryGetProperty("user", out var user) ? user.GetString() ?? "Test" : "Test"); break;
            case "performance": StartPerformance(command.TryGetProperty("label", out var label) ? label.GetString() : "native", command.TryGetProperty("seconds", out var sampleSeconds) ? sampleSeconds.GetSingle() : 15); break;
            case "motion-sample": StartCrowdMotion(command.TryGetProperty("seconds", out var motionSeconds) ? motionSeconds.GetSingle() : 20); break;
            case "ammo-empty": EmptySelectedAmmo(); break;
            case "ammo-reload": if (WeaponInputActive) BeginReload(rules.Level); break;
            case "ammo-shot":
                if (WeaponInputActive && SpendAutoAmmo(rules.Level))
                {
                    if (rules.Level == 7)
                    {
                        resources.Flame.Burn(command.TryGetProperty("seconds", out var heatSeconds) ? Math.Clamp(heatSeconds.GetSingle(), 0, 4) : .25f);
                        autoFlameUntil = Time.time + .25f;
                        if (resources.Flame.Overheated) OnFlameOverheated();
                    }
                    else manualShots++;
                }
                break;
            case "memory-probe": ProbeMemory(); break;
            case "equipment-probe": ProbeCreatureEquipment(); break;
            case "publishing-export": ExportPublishingFile(command.GetProperty("index").GetInt32(), true); break;
            case "memory-guard-force": qaMemoryHoldUntil = command.GetProperty("enabled").GetBoolean() ? Time.realtimeSinceStartup + 100 : 0; nextMemoryCheck = 0; break;
            case "up": Shift(1); break;
            case "down": Shift(-1); break;
            case "kill":
                foreach (var c in creatures.Where(c => !c.Enemy.IsDead).Take(command.GetProperty("count").GetInt32()).ToArray())
                    c.Enemy.Damage(100000, Vector3.forward, c.Enemy.transform.position, 1, false, false, weapons[rules.Level]);
                break;
            case "vacuum": vacuum = !vacuum; ApplyWeapon(); break;
            case "reset": Reset(clearBodies: true); break;
            case "round-reset": Reset(); break;
            case "challenge-start": StartChallenge(); break;
            case "auto-play": SetAutoPlay(command.GetProperty("enabled").GetBoolean()); break;
            case "audio-probe":
                try { ProbeAudio(); }
                catch (Exception diagnosticError) { audioError = diagnosticError.Message; MelonLogger.Warning("Audio diagnostic: " + audioError); }
                break;
            case "audio-defaults-probe": ProbeNativeAudioDefaults(); break;
            case "audio-sample": qaAudioPeak = 0; audioError = ""; qaAudioUntil = Time.realtimeSinceStartup + 10; break;
            case "auto-probe":
                try { ProbeAutoPlay(); }
                catch (Exception diagnosticError) { MelonLogger.Warning("Auto diagnostic: " + diagnosticError.Message); }
                break;
            case "progression":
                settings.FirstWeaponKills = Math.Clamp(command.GetProperty("first").GetInt32(), 1, 1000);
                settings.WeaponKillStep = Math.Clamp(command.GetProperty("step").GetInt32(), 0, 1000);
                rules.ConfigureProgression(settings.FirstWeaponKills, settings.WeaponKillStep); SaveSettings(); break;
            case "auto-fixture":
                int fixtureLevel = Math.Clamp(command.GetProperty("level").GetInt32(), 0, 7);
                while (rules.Level < fixtureLevel) rules.Shift(1);
                while (rules.Level > fixtureLevel) rules.Shift(-1);
                ApplyWeapon();
                float fixtureDistance = command.TryGetProperty("distance", out var requestedDistance) ? requestedDistance.GetSingle() : 3;
                int fixtureCount = command.TryGetProperty("count", out var requestedCount) ? requestedCount.GetInt32() : 1;
                for (int i = 0; i < Math.Clamp(fixtureCount, 1, 100); i++)
                    Spawn("qa_auto", new Vector3(i % 3 - 1, .5f, fixtureDistance + i / 3 * 1.3f));
                break;
            case "board-pressure": MelonCoroutines.Start(TestBoardPressure()); break;
            case "board-occupant":
                var occupant = creatures.FirstOrDefault(c => c.Enemy != null);
                if (occupant != null) occupant.Enemy.rb.position = new Vector3(boardWallX + 2, .6f, 0);
                break;
            case "board-mount-probe": ProbeMissionBoardMount(); break;
            case "board-floor-probe": ProbeBoardFloor(); break;
            case "board-floor-pressure": MelonCoroutines.Start(TestBoardFloorPressure(command.GetProperty("z").GetSingle())); break;
            case "dash-jump":
                airDash.Reset(); StopAirDash(); HandleDashPress(Player.Instance.IsGrounded);
                if (Player.Instance.IsGrounded)
                {
                    var jumpVelocity = Player.Instance.rb.linearVelocity;
                    jumpVelocity.y = Player.Instance.jumpForce;
                    Player.Instance.rb.linearVelocity = jumpVelocity;
                }
                break;
            case "dash-press": HandleDashPress(Player.Instance.IsGrounded); break;
            case "combat-settings":
                if (command.TryGetProperty("enabled", out var combatEnabled)) settings.EnemyAttacks = combatEnabled.GetBoolean();
                if (command.TryGetProperty("damage", out var combatDamage)) settings.CreatureDamage = Math.Clamp(combatDamage.GetInt32(), 1, 100);
                if (command.TryGetProperty("interval", out var combatInterval)) settings.CreatureAttackInterval = Math.Clamp(combatInterval.GetSingle(), .5f, 5);
                if (command.TryGetProperty("scale", out var combatScale)) SetCreatureScale(combatScale.GetSingle());
                if (command.TryGetProperty("playerHealth", out var maximumHealth)) { settings.PlayerHealth = Math.Clamp(maximumHealth.GetInt32(), 1, 1000); survival.Configure(settings.PlayerHealth); }
                ResetCombatPaths(); SaveSettings(); break;
            case "combat-fixture":
                MelonCoroutines.Start(PrepareCombatFixture(command.TryGetProperty("distance", out var combatDistance) ? combatDistance.GetSingle() : 1.5f,
                    command.TryGetProperty("user", out var combatUser) ? combatUser.GetString() ?? "qa_attacker" : "qa_attacker")); break;
            case "combat-climb-fixture":
                float climbSide = command.TryGetProperty("side", out var climbSideValue) && climbSideValue.GetSingle() < 0 ? -1 : 1;
                Player.Instance.rb.position = new Vector3(-18, 10.7f, 25.5f * climbSide); Player.Instance.rb.linearVelocity = Vector3.zero;
                qaViewRotation = Quaternion.Euler(15, 90, 0); ApplyQaView();
                Spawn("qa_climber", new Vector3(command.TryGetProperty("x", out var climbX) ? climbX.GetSingle() : 3.2f, .42f, 22.5f * climbSide)); break;
            case "combat-nav-probe": ProbeCombatNavigation(); break;
            case "combat-wall": SetCombatTestWall(command.GetProperty("enabled").GetBoolean()); break;
            case "live-avatar-fixture":
                ConsumeLiveEvent(new LiveEvent { kind = "avatar", username = command.GetProperty("user").GetString(), avatarFile = command.GetProperty("avatarFile").GetString() }); break;
            case "prison-move": MelonCoroutines.Start(TestPrisonMovement()); break;
            case "board-click":
                if (RaycastBoard(out var boardHit)) ActivateBoardControl(BoardControlAt(boardHit.point));
                break;
            case "board-bullet":
                if (RaycastBoard(out var bulletHit)) GameManager.Instance.OnBulletImpact(bulletHit.point);
                break;
            case "board-bat":
                var bat = weapons[0].Cast<BaseballBat>();
                bat.StartCoroutine(bat.DamageDelayed(.12f));
                break;
            case "body-fall":
                var fallenBody = creatures.FirstOrDefault(c => c.Enemy != null && c.Enemy.IsDead);
                if (fallenBody != null) fallenBody.Enemy.rb.position = new Vector3(fallenBody.LastSafePosition.x, -60, fallenBody.LastSafePosition.z);
                break;
            case "vacuum-reference-fixture":
                var storedBody = creatures.FirstOrDefault(c => c.Enemy != null && c.Enemy.IsDead);
                if (storedBody != null)
                {
                    storedBody.Enemy.OnGrabbed();
                    var storedReference = storedBody.Enemy.Cast<IGrabbable>();
                    if (!Vacuum.Instance.grabbables.Contains(storedReference)) Vacuum.Instance.grabbables.Add(storedReference);
                    Vacuum.Instance.grabbablesInRange.Add(storedReference);
                    Vacuum.Instance.ignoredGrabbables.Add(storedReference);
                }
                break;
            case "menu":
                tab = command.TryGetProperty("tab", out var selectedTab) ? Math.Clamp(selectedTab.GetInt32(), 0, 4) : 0;
                if (command.TryGetProperty("optionPage", out var selectedOptions)) optionPage = Math.Clamp(selectedOptions.GetInt32(), 0, 5);
                if (command.TryGetProperty("actionPage", out var selectedActionPage)) actionPage = Math.Max(0, selectedActionPage.GetInt32());
                if (command.TryGetProperty("addingAction", out var selectedAdding)) addingAction = selectedAdding.GetBoolean();
                if (command.TryGetProperty("triggerPicker", out var picker)) triggerPicker = Math.Clamp(picker.GetInt32(), -1, 1);
                SetMenu(command.TryGetProperty("open", out var opened) ? opened.GetBoolean() : !menu);
                break;
            case "gift": ApplyGiftActions(command.GetProperty("id").GetString() ?? "", command.TryGetProperty("repeatCount", out var repeats) ? repeats.GetInt32() : 1, command.TryGetProperty("user", out var sender) ? sender.GetString() ?? testUser : testUser); break;
            case "live-connect": ConnectLive(command.GetProperty("username").GetString() ?? ""); break;
            case "connection-edit": broadcasterDraft = command.GetProperty("username").GetString() ?? ""; focusedField = ""; editBuffers.Remove("broadcaster"); break;
            case "connection-connect": ConnectSelectedAccount(); break;
            case "live-disconnect":
                DisconnectLive();
                if (command.TryGetProperty("clear", out var clearAccount) && clearAccount.GetBoolean()) { settings.BroadcasterUsername = ""; SaveSettings(); }
                break;
            case "binding":
                int binding = command.GetProperty("index").GetInt32();
                string giftId = command.GetProperty("giftId").GetString() ?? "";
                if (binding >= 0 && binding < settings.Actions.Count && (giftId.Length == 0 || gifts.Any(g => g.id == giftId)))
                {
                    settings.Actions[binding].GiftId = giftId;
                    if (command.TryGetProperty("count", out var amount)) settings.Actions[binding].Count = Math.Clamp(amount.GetInt32(), 1, ActionLimit(settings.Actions[binding].Op));
                    SaveSettings();
                }
                break;
            case "save": SaveSettings(); break;
            case "highlight-settings":
                if (command.TryGetProperty("combo", out var combo)) settings.ComboEnabled = combo.GetBoolean();
                if (command.TryGetProperty("notices", out var notices)) settings.GiftNoticesEnabled = notices.GetBoolean();
                if (command.TryGetProperty("cleanup", out var cleanup)) settings.CleanupGoalEnabled = cleanup.GetBoolean();
                if (command.TryGetProperty("cleanupTarget", out var cleanupTarget)) settings.CleanupTarget = Math.Clamp(cleanupTarget.GetInt32(), 1, 1_000_000);
                if (command.TryGetProperty("recap", out var recap)) settings.RoundSummaryEnabled = recap.GetBoolean();
                highlights.ConfigureCleanup(false, settings.CleanupTarget); SaveSettings(); break;
            case "last-recap": showLastRecap = command.GetProperty("open").GetBoolean(); break;
            case "notice-event":
                if (command.TryGetProperty("avatarFile", out var noticeAvatar))
                    ConsumeLiveEvent(new LiveEvent {kind = "avatar", username = "qa_notice", avatarFile = noticeAvatar.GetString() ?? ""});
                ConsumeLiveEvent(new LiveEvent {kind = "gift", username = "qa_notice", giftId = "5655", eventId = command.GetProperty("eventId").GetString() ?? "", repeatCount = 2}); break;
            case "catalog-open":
                OpenGiftCatalog(command.TryGetProperty("index", out var catalogIndex) ? catalogIndex.GetInt32() : -1); SetMenu(true); break;
            case "catalog-search": search = command.GetProperty("text").GetString() ?? ""; focusedField = ""; break;
            case "catalog-input":
                string kind = command.GetProperty("kind").GetString();
                var input = new Event { type = kind == "wheel" ? EventType.ScrollWheel : kind == "down" ? EventType.MouseDown : kind == "up" ? EventType.MouseUp : EventType.MouseDrag, button = 0 };
                float pointerY = command.TryGetProperty("ratio", out var scrollRatio) ? catalogScrollbar.y + catalogScrollbar.height * scrollRatio.GetSingle() : catalogViewport.center.y;
                input.mousePosition = new Vector2(kind == "wheel" ? catalogViewport.center.x : catalogScrollbar.center.x, pointerY);
                input.delta = new Vector2(0, command.TryGetProperty("delta", out var wheelDelta) ? wheelDelta.GetSingle() : 0);
                catalogTestEvents.Enqueue(input); break;
            case "catalog-choose":
                int visibleIndex = command.GetProperty("row").GetInt32();
                if (visibleIndex >= 0 && visibleIndex < catalogVisibleIds.Count)
                {
                    var chosenGift = gifts.Find(g => g.id == catalogVisibleIds[visibleIndex]);
                    if (chosenGift != null) SelectCatalogGift(chosenGift);
                }
                break;
            case "catalog-back": CloseGiftCatalog(); break;
            case "lock": qaLockUntil = command.GetProperty("enabled").GetBoolean() ? Time.realtimeSinceStartup + 100 : 0; break;
            case "live-events-pause": qaLivePauseUntil = command.GetProperty("enabled").GetBoolean() ? Time.realtimeSinceStartup + 100 : 0; break;
            case "cursor-release": Cursor.lockState = CursorLockMode.None; Cursor.visible = true; break;
            case "escape": ToggleOriginalMenu(); break;
            case "native-resume": GameManager.Instance.Resume(); break;
            case "resolution": Screen.SetResolution(Math.Clamp(command.GetProperty("width").GetInt32(), 800, 1920), Math.Clamp(command.GetProperty("height").GetInt32(), 600, 1080), FullScreenMode.Windowed); break;
            case "blood-color": settings.BloodColor = Math.Clamp(command.GetProperty("index").GetInt32(), 0, 5); RefreshBloodColors(); SaveSettings(); break;
            case "blood-enabled": SetBloodEnabled(command.GetProperty("enabled").GetBoolean()); SaveSettings(); break;
            case "effect-test":
                var op = command.GetProperty("effect").GetString();
                if (ActionOps.Contains(op)) ExecuteAction(new ActionBinding { Op = op, Count = command.TryGetProperty("count", out var effectAmount) ? Math.Clamp(effectAmount.GetInt32(), 1, ActionLimit(op)) : 1 }, command.TryGetProperty("repeatCount", out var effectRepeats) ? effectRepeats.GetInt32() : 1, "qa_effect");
                break;
            case "action-add":
                var actionOp = command.GetProperty("effect").GetString();
                if (ActionOps.Contains(actionOp) && settings.Actions.Count < 100) { settings.Actions.Add(NewAction(actionOp)); SaveSettings(); }
                break;
            case "action-delete":
                int deleteIndex = command.GetProperty("index").GetInt32();
                if (deleteIndex >= 0 && deleteIndex < settings.Actions.Count) { settings.Actions.RemoveAt(deleteIndex); bindingIndex = -1; SaveSettings(); }
                break;
            case "hit-marker": settings.HitMarker = command.GetProperty("enabled").GetBoolean(); SaveSettings(); break;
            case "blood-sample":
                var view = Player.Instance.mainCamera.transform;
                var forward = new Vector3(view.forward.x, 0, view.forward.z).normalized;
                var bloodPoint = Player.Instance.transform.position + forward * 4;
                bloodPoint.y = spawnCenter.y + .03f;
                ParticlePoolManager.Instance.SpawnBlood(bloodPoint + Vector3.up * .65f);
                BloodParticleManager.Instance.TryEmit(bloodPoint, Vector3.up, 1);
                break;
            case "spawn-probe": ProbeSpawnPoints(); break;
            case "arena-probe": ProbeArena(); break;
            case "branding-probe": ProbeBranding(); break;
            case "tool-textures": DumpToolTextures(); break;
            case "branding-stamp":
                StampTool(command.GetProperty("tool").GetString(), new Rect(command.GetProperty("x").GetSingle(), command.GetProperty("y").GetSingle(), command.GetProperty("width").GetSingle(), command.GetProperty("height").GetSingle()), command.TryGetProperty("rotate", out var rotatedMark) && rotatedMark.GetBoolean(), command.TryGetProperty("mirrorVertical", out var mirroredMark) && mirroredMark.GetBoolean());
                break;
            case "view":
                Player.Instance.rb.position = new Vector3(command.GetProperty("x").GetSingle(), command.TryGetProperty("y", out var viewY) ? viewY.GetSingle() : .95f, command.GetProperty("z").GetSingle());
                Player.Instance.rb.linearVelocity = Vector3.zero;
                qaViewRotation = Quaternion.Euler(command.TryGetProperty("pitch", out var pitch) ? pitch.GetSingle() : 10, command.GetProperty("yaw").GetSingle(), 0);
                Player.Instance.mainCameraParent.rotation = qaViewRotation.Value;
                Player.Instance.mainCamera.transform.rotation = qaViewRotation.Value;
                break;
            case "crowd-settings":
                if (command.TryGetProperty("total", out var totalLimit)) settings.MaxCreatures = Math.Clamp(totalLimit.GetInt32(), 10, MaxPhysicalCreatures);
                if (command.TryGetProperty("physical", out var physicalLimit)) settings.PhysicalCreatures = Math.Clamp(physicalLimit.GetInt32(), 1, MaxPhysicalCreatures);
                if (command.TryGetProperty("timed", out var timed)) SetTimedMode(timed.GetBoolean());
                if (command.TryGetProperty("seconds", out var seconds)) settings.RoundSeconds = Math.Clamp(seconds.GetInt32(), 1, 3600);
                if (command.TryGetProperty("target", out var targetKills)) settings.KillTarget = Math.Clamp(targetKills.GetInt32(), 1, 1_000_000);
                if (command.TryGetProperty("winGoal", out var winGoal)) settings.WinGoal = Math.Clamp(winGoal.GetInt32(), 1, 1_000_000);
                SaveSettings(); break;
            case "avatar-test":
                string avatarUser = liveAvatars.Keys.FirstOrDefault(user => !user.StartsWith("qa_"));
                if (avatarUser != null) Add(1, avatarUser);
                break;
            case "avatar-wave":
                var avatarUsers = liveAvatars.Keys.ToArray();
                int avatarCount = Math.Clamp(command.GetProperty("count").GetInt32(), 1, MaxPhysicalCreatures);
                if (avatarUsers.Length > 0) for (int i = 0; i < avatarCount; i++) Add(1, avatarUsers[i % avatarUsers.Length]);
                break;
            case "hit":
                var victim = creatures.FirstOrDefault(c => c.Enemy != null && !c.Enemy.IsDead);
                if (victim != null)
                {
                    var direction = (victim.Enemy.rb.position - Player.Instance.rb.position).normalized;
                    direction *= command.TryGetProperty("force", out var hitForce) ? hitForce.GetSingle() : 0;
                    float damage = command.TryGetProperty("damage", out var hitDamage) ? hitDamage.GetSingle() : 1;
                    if (command.TryGetProperty("shockwave", out var hitShockwave) && hitShockwave.GetBoolean()) victim.Enemy.ShockwaveDamage(damage, direction);
                    else victim.Enemy.Damage(damage, direction, victim.Enemy.GrabCenter, 1, true, false, weapons[rules.Level]);
                }
                break;
            case "report": break;
            case "native-controls-probe": ProbeNativeControls(); break;
            case "crouch": qaCrouch = command.GetProperty("enabled").GetBoolean(); break;
            case "crouch-ceiling": SetCrouchTestCeiling(command.GetProperty("enabled").GetBoolean()); break;
            case "vacuum-hold":
                float distance = command.TryGetProperty("distance", out var testDistance) ? testDistance.GetSingle() : 2;
                float vacuumX = command.TryGetProperty("x", out var requestedVacuumX) ? requestedVacuumX.GetSingle() : 0;
                float vacuumZ = command.TryGetProperty("z", out var requestedVacuumZ) ? requestedVacuumZ.GetSingle() : 0;
                float vacuumYaw = command.TryGetProperty("yaw", out var requestedVacuumYaw) ? requestedVacuumYaw.GetSingle() : 0;
                bool vacuumBlocked = command.TryGetProperty("blocked", out var requestedBlocked) && requestedBlocked.GetBoolean();
                MelonCoroutines.Start(PrepareVacuumTest(distance, vacuumX, vacuumZ, vacuumYaw, vacuumBlocked));
                break;
            case "vacuum-unblock": ClearVacuumTestWall(); break;
            case "capture": MelonCoroutines.Start(Capture("capture-" + seq + ".png")); break;
            case "quit": Application.Quit(); break;
        }
        Report();
    }

    private void Report()
    {
        string reportFile = Path.Combine(Root, "qa", "state.json");
        File.WriteAllText(reportFile + ".tmp", JsonSerializer.Serialize(new
        {
            ready, failed, processId = Environment.ProcessId, version = Version, rules.Round, rules.Kills, rules.Collected, rules.Progress, rules.RequiredCollections, rules.FirstWeaponKills, rules.WeaponKillStep, rules.Alive, rules.Wins, rules.Won,
            weapon = Rules.WeaponNames[rules.Level], level = rules.Level, vacuum, pending = pending.Count,
            logicalAlive = rules.Alive + pending.Count, pendingBatches = pending.BatchCount, settings.PhysicalCreatures, settings.MaxCreatures,
            queuedRoundCreatures = nextRoundPending.Count, queuedRoundBatches = nextRoundPending.BatchCount, nextRoundWeaponLevel,
            counterStyle = "seven-segment", counterMode = "physical", counterDigits = crowdCounterDigits,
            counterBounds = new { x = crowdCounterBounds.x, y = crowdCounterBounds.y, width = crowdCounterBounds.width, height = crowdCounterBounds.height },
            settings.TimedMode, settings.RoundSeconds, settings.KillTarget, settings.WinGoal, roundStartedAt, roundTimedOut,
            challenge = new { phase = challenge.Phase.ToString(), challenge.Kills, challenge.Target, challenge.Duration, challenge.IsPaused, remaining = challenge.Remaining(Time.time) },
            missionBoard = missionBoard != null, missionBoardError,
            boardSealed = boardExclusion != null, boardCarving = boardObstacle != null && boardObstacle.carving,
            boardOccupantRescues, rejectedBoardSpawns, rejectedBoardPaths,
            boardFloorSealed = boardFloorSeal != null, boardFloorPlayerMinimum, boardFloorCreatureMinimum,
            boardFloorPressureRunning, boardFloorError,
            dashActive, dashCount, dashDistance, dashCollisionStops, dashError, dashArmed = airDash.Armed, dashUsed = airDash.Used,
            dashObstacle,
            dashOrigin = new { x = dashOrigin.x, y = dashOrigin.y, z = dashOrigin.z },
            dashEnd = new { x = dashEnd.x, y = dashEnd.y, z = dashEnd.z },
            dashDirection = new { x = dashDirection.x, y = dashDirection.y, z = dashDirection.z },
            health = survival.Health, maxHealth = survival.MaximumHealth, killedBy = survival.KilledBy, lastAttacker = survival.LastAttacker, roundDied,
            deathRoundResets, lastResetCreatures, lastResetBodies, lastResetActiveRemainders,
            vacuumInRange = Vacuum.Instance.grabbablesInRange.Count,
            vacuumIgnored = Vacuum.Instance.ignoredGrabbables.Count, helperCount = helpers.Count,
            creaturePointerCount = creaturePointers.Count, arenaPathCacheCount = nextArenaPath.Count, crowdMotionCacheCount = motionPositions.Count,
            settings.EnemyAttacks, settings.CreatureDamage, settings.CreatureAttackInterval, settings.CreatureScale,
            likeActionsApplied, followActionsApplied, helperHits, helperDamageTaken, bossSteps, shakePower,
            settings.LikeThreshold, settings.LikeAction, settings.FollowAction,
            challengeHudDrawn, staminaVisible = Player.Instance.staminaSlider.transform.parent.gameObject.activeInHierarchy,
            crouched = crouchAmount > .8f, crouchAmount, crouchBlocked, crouchError,
            capsuleHeight = playerCapsule != null ? playerCapsule.height : 0, cameraHeight = Player.Instance.cameraOffset.y,
            creatureSwings, creatureHits, combatPaths, survivalError, autoEvasions,
            preventedCreaturePanics, preventedHitPushes,
            combatNavigationReady = combatNavigation != null, combatNavigationCells, combatUpperCells, combatStairSources, combatNavigationError,
            combatStairLinks = combatStairLinks.Count,
            balanceWeaponLevel, expiredHelpers, helperSeconds = CombatBalance.HelperSeconds,
            rocketDamage = weapons[6].Cast<RocketLauncher>().enemyDamage,
            combatPathDiagnostic, combatGoal = new { combatGoal.x, combatGoal.y, combatGoal.z },
            pursuit = PursuitSnapshot(),
            healthDrawn, healthBounds = new { healthBounds.x, healthBounds.y, healthBounds.width, healthBounds.height },
            defeatDrawn, defeatPortraitWidth = defeatPortrait != null ? defeatPortrait.width : 0,
            defeatPortraitHeight = defeatPortrait != null ? defeatPortrait.height : 0,
            defeatPortraitBounds = new { defeatPortraitBounds.x, defeatPortraitBounds.y, defeatPortraitBounds.width, defeatPortraitBounds.height },
            prisonMovementRunning, prisonMovementTravel, prisonMovementError,
            prisonAnchor = new { prisonAnchor.x, prisonAnchor.y, prisonAnchor.z },
            combatTestBodies = creatures.Where(c => c.Enemy != null && !c.Enemy.IsDead).Take(12).Select(c => new {
                c.Username, c.Kind, c.Friendly, c.HelperRemaining, health = c.Enemy.health, maxHealth = c.Enemy.maxHealth,
                armed = c.Club != null, target = c.Target?.Username,
                c.ClubOnHand, clubParent = c.Club?.parent?.name,
                gripGap = c.Club == null || c.Hand == null ? -1 : Vector3.Distance(c.Club.position, c.Hand.position),
                attackWindup = CombatBalance.Windup(c.Kind), attackRecovery = CombatBalance.Recovery(c.Kind, settings.CreatureAttackInterval),
                c.Enemy.pathCornerCount, c.Enemy.cornerIndex, c.Enemy.pathTimer, c.Enemy.groundY,
                colliderSize = c.Enemy.mainCollider.bounds.size.ToString(),
                scale = c.Enemy.transform.localScale.ToString(), originalScale = c.Enemy.originalLocalScale.ToString(),
                sizeMultiplier = c.Enemy.transform.localScale.y / c.Enemy.originalLocalScale.y,
                colliderHeight = c.Enemy.mainCollider.bounds.size.y, colliderWidth = c.Enemy.mainCollider.bounds.size.x,
                bodyTop = c.Enemy.mainCollider.bounds.max.y, canReachPlayer = CanReachTarget(c),
                baseMoveSpeed = c.BaseMoveSpeed, moveSpeed = c.Enemy.moveSpeed,
                c.Enemy.panicTimer, c.Enemy.knockbackTimer,
                corners = c.Enemy.pathCorners.Take(c.Enemy.pathCornerCount).Select(p => p.ToString()).ToArray(),
                gravity = c.Enemy.rb.useGravity,
                swinging = c.Attack.Started >= 0, arm = c.Enemy.fakeRagdoll?.rightArm?.bone?.name,
                x = c.Enemy.rb.position.x, y = c.Enemy.rb.position.y, z = c.Enemy.rb.position.z,
                distance = Vector3.Distance(c.Enemy.rb.position, Player.Instance.rb.position) }).ToArray(),
            playerGrounded = Player.Instance.IsGrounded,
            nativeJumpForce = Player.Instance.jumpForce, nativeGravity = Player.Instance.gravity, nativeDamping = Player.Instance.rb.linearDamping,
            velocity = new { x = Player.Instance.rb.linearVelocity.x, y = Player.Instance.rb.linearVelocity.y, z = Player.Instance.rb.linearVelocity.z },
            behindBoardCreatures = creatures.Count(c => c.Enemy != null && BehindMissionBoard(c.Enemy.rb.position)),
            autoPlaying, autoStatus, autoError, autoAttacks, autoKills, autoWeaponAttacks,
            autoVacuumBatchActive = autoVacuumBatch.Active, autoVacuumThreshold = AutoVacuumBatch.Threshold,
            autoRayHit, autoTargetDistance, autoAimError, autoJumps,
            autoCollected = vacuumCollected - autoBodyStart,
            autoTargetAlive = autoTarget != null && autoTarget.gameObject.activeInHierarchy && !autoTarget.IsDead,
            autoMoving = autoMove.sqrMagnitude > .01f,
            hoveredBoardControl, lastBoardInteraction, boardInteractions, boardWeaponHits,
            boardRay = BoardRayDiagnostics(),
            boardControls = boardControls.Select(c => new { c.Id, enabled = BoardControlEnabled(c.Id), x = c.Bounds.center.x, y = c.Bounds.center.y }).ToArray(),
            drawnProfiles, nearProfiles, nearestProfileDistance, roundBloodClears, reservedHudProfiles,
            drawnCreatureBars, damageVignetteOpacity, playerLastDamage,
            consideredCreatureBadges, creatureHealthNumbers = false, creatureBadgeAnchorMode = "head-attached",
            profileAnchors = drawnProfileAnchors.Select(p => new { p.x, p.y }).ToArray(),
            playerHitAt,
            creatureBarBounds = creatureBarBounds.Select(b => new { b.x, b.y, b.width, b.height }).ToArray(),
            creatureBadgeBounds = placedCreatureBadges.Select(b => new { b.x, b.y, b.width, b.height }).ToArray(),
            publishingStatus,
            profileBounds = drawnProfileBounds.Select(b => new { b.x, b.y, b.width, b.height }).ToArray(),
            removedMachines, pitCovered = pitCover != null && pitCover.gameObject.activeInHierarchy, arrivalEffects, arrivalStyle = "soft-impact", arrivalSound,
            recentArrivals = recentArrivals.Select(p => new { p.x, p.y, p.z }).ToArray(),
            bodies = creatures.Count(c => c.Enemy != null && c.Enemy.IsDead), profiles = creatures.Count, rules.Deadline,
            bodyLifetime = "vacuum-only",
            bodyIds = creatures.Where(c => c.Enemy != null && c.Enemy.IsDead).Take(256).Select(c => c.Enemy.GetInstanceID()).ToArray(),
            activeBodies = creatures.Count(c => c.Enemy != null && c.Enemy.IsDead && c.Enemy.gameObject.activeInHierarchy),
            bodyColliders = creatures.Count(c => c.Enemy != null && c.Enemy.IsDead && c.Enemy.mainCollider.enabled),
            creatureModels = CreatureModelCounts(),
            creatureHealth = creatures.Where(c => c.Enemy != null).Select(c => c.Enemy.maxHealth).Distinct().ToArray(),
            movementFacing = creatures.Where(c => c.Enemy != null && !c.Enemy.IsDead && !c.Enemy.isHeld && !c.Enemy.IsFreeFall && c.Enemy.panicTimer <= 0 && c.Enemy.knockbackTimer <= 0).Take(30).Select(c => new
            {
                model = c.Model,
                speed = new Vector2(c.Enemy.rb.linearVelocity.x, c.Enemy.rb.linearVelocity.z).magnitude,
                facing = Vector3.Dot(new Vector3(c.Enemy.rb.linearVelocity.x, 0, c.Enemy.rb.linearVelocity.z).normalized, new Vector3(c.Enemy.visual.forward.x, 0, c.Enemy.visual.forward.z).normalized)
            }).ToArray(),
            live = liveStatus, liveApplied, liveUnmapped, liveError, lastLiveGift, qaLiveEventsPaused = Time.realtimeSinceStartup < qaLivePauseUntil,
            savedBroadcasterUsername = settings.BroadcasterUsername, settings.AutoConnect, broadcasterDraft,
            liveConnectionRequested, liveConnectPending, liveDisconnectPending, bridgeReady,
            selectedBroadcaster = pendingBroadcaster, accountSource = "game-settings-only", launcherAccountIgnored = true,
            liveCommandSequence, connectionConnectEnabled, connectionDisconnectEnabled, connectionAccountText,
            connectionUsernameBounds = new { connectionUsernameBounds.x, connectionUsernameBounds.y, connectionUsernameBounds.width, connectionUsernameBounds.height },
            connectionConnectBounds = new { connectionConnectBounds.x, connectionConnectBounds.y, connectionConnectBounds.width, connectionConnectBounds.height },
            connectionDisconnectBounds = new { connectionDisconnectBounds.x, connectionDisconnectBounds.y, connectionDisconnectBounds.width, connectionDisconnectBounds.height },
            connectionAccountBounds = new { connectionAccountBounds.x, connectionAccountBounds.y, connectionAccountBounds.width, connectionAccountBounds.height },
            connectionStatusBounds = new { connectionStatusBounds.x, connectionStatusBounds.y, connectionStatusBounds.width, connectionStatusBounds.height },
            settings.BloodEnabled, bloodColor = BloodNames[settings.BloodColor], bloodMaterialCount, bloodParticleCount, combatVisualError, optionPage, sparkBursts, suppressedBlood,
            floorBloodParticles = BloodParticleManager.Instance.particleSystem.particleCount,
            floorBloodTracked = BloodParticleManager.Instance.particleCount,
            visibleSuppressedBlood = hiddenBloodRenderers.Values.Count(r => r != null && r.enabled),
            damageSlots = creatures.Where(c => c.Enemy != null).Sum(c => c.Enemy.damageCount),
            effects.FlashSeconds, effects.PrisonSeconds, flashOpacity = FlashOpacity, flashIntroQueued, flashBlasts,
            flashSound = flashClip != null ? flashClip.name : "", flashSoundLength = flashClip != null ? flashClip.length : 0,
            effectAudioPlaying = Player.Instance.audioSource.isPlaying, automaticAmmoRefills, ammo = Ammo(weapons[rules.Level]),
            weaponResources = AmmoSnapshot(),
            motionSampling, motionJumps, motionMaxStep, rejectedArenaPaths, liveFallRescues,
            crowdMemoryHold, freePhysicalMb,
            cageActive = prison != null && prison.activeInHierarchy,
            cageWalls = prison == null ? 0 : prison.GetComponentsInChildren<Collider>().Length,
            creaturesInCage = prison == null ? 0 : creatures.Count(c => c.Enemy != null && !c.Enemy.IsDead && Math.Abs(c.Enemy.rb.position.x - prisonAnchor.x) < 1.72f && Math.Abs(c.Enemy.rb.position.z - prisonAnchor.z) < 1.72f),
            actionCount = settings.Actions.Count,
            performanceRun, performanceRunning, frameCount, frameMeanMs, frameP95Ms, frameP99Ms, frameOver50,
            brandedPosters, brandedTools, brandingError,
            confirmedHits, hitMarkerActive = settings.HitMarker && Time.realtimeSinceStartup < hitUntil,
            realAvatarFiles = liveAvatars.Count, loadedPortraits = portraits.Count,
            loadedLivePortraits = portraits.Keys.Count(user => liveAvatars.ContainsKey(user)),
            vacuumStored = Vacuum.Instance.grabbables.Count,
            vacuumRange = Vacuum.Instance.suckRange, vacuumForce = Vacuum.Instance.suckForce, vacuumVelocity = Vacuum.Instance.suckMaxVelocity,
            vacuumCollected, vacuumIntakeSounds, vacuumIntakeClip = vacuumIntakeClip?.name, outOfBoundsBodies, qaVacuumStartDistance,
            arenaVacuumAssists,
            vacuumDiagnostics = new
            {
                state = Vacuum.Instance.state.ToString(), strength = Vacuum.Instance.vacuumStrength,
                camera = new { x = Vacuum.Instance.mainCamera.transform.position.x, y = Vacuum.Instance.mainCamera.transform.position.y, z = Vacuum.Instance.mainCamera.transform.position.z },
                forward = new { x = Vacuum.Instance.mainCamera.transform.forward.x, y = Vacuum.Instance.mainCamera.transform.forward.y, z = Vacuum.Instance.mainCamera.transform.forward.z },
                nozzle = new { x = Vacuum.Instance.point.position.x, y = Vacuum.Instance.point.position.y, z = Vacuum.Instance.point.position.z },
                ignored = Vacuum.Instance.ignoredGrabbables.Count, inRange = Vacuum.Instance.grabbablesInRange.Count,
                bodies = creatures.Where(c => c.Enemy != null && c.Enemy.IsDead).Take(5).Select(c => new
                {
                    type = c.Enemy.GetIl2CppType().Name, c.Enemy.CanGrab,
                    distance = Vector3.Distance(Vacuum.Instance.point.position, c.Enemy.GrabCenter),
                    layer = c.Enemy.mainCollider.gameObject.layer,
                    c.Enemy.mainCollider.enabled,
                    center = new { x = c.Enemy.GrabCenter.x, y = c.Enemy.GrabCenter.y, z = c.Enemy.GrabCenter.z }
                }).ToArray()
            },
            position = new { x = Player.Instance.transform.position.x, y = Player.Instance.transform.position.y, z = Player.Instance.transform.position.z },
            firstFrameRendered, startupStage, fullscreenMode = Screen.fullScreenMode.ToString(), width = Screen.width, height = Screen.height,
            playerPhysics = new { x = Player.Instance.rb.position.x, y = Player.Instance.rb.position.y, z = Player.Instance.rb.position.z },
            elevatorDisabled = true, dayNightDisabled = true, productionDisabled = true, seq = commandSequence,
            inputAllowed = GameManager.Instance.CanPlayerInput, weaponActive = (vacuum ? Vacuum.Instance.gameObject : weapons[rules.Level].gameObject).activeInHierarchy
            , menu, tab, menuRendered, menuGiftImages, catalogCount = gifts.Count, hudError = lastHudError,
            catalogDisplay = "scroll-list", catalogScroll, catalogScrollMax, catalogDragging,
            catalogFilteredCount = catalogFiltered.Length, catalogVisibleIds, catalogEventsPending = catalogTestEvents.Count,
            catalogSearch = search, catalogBindingIndex = bindingIndex, catalogActionCount = catalogTarget?.Count,
            selectedGift, loadedGiftTextures = giftTextures.Count,
            catalogViewport = new { x = catalogViewport.x, y = catalogViewport.y, width = catalogViewport.width, height = catalogViewport.height },
            progressionRendered = progressionRendered && !menu && !GameManager.Instance.IsPaused,
            progressFraction = shownProgress, nextWeapon = rules.NextWeapon,
            progressBounds = new { x = progressionBounds.x, y = progressionBounds.y, width = progressionBounds.width, height = progressionBounds.height },
            highlights = new { highlights.Kills, highlights.Collected, highlights.Combo, highlights.BestCombo, highlights.HighestWeapon,
                highlights.CleanupEnabled, highlights.CleanupTarget, highlights.CleanupComplete, elapsed = highlights.Elapsed(Time.time) },
            lastRoundRecap, comboDrawn, cleanupDrawn, recapDrawn, showLastRecap,
            giftNoticesReceived, giftNoticesPending = giftNotices.Count,
            activeGiftNotice = activeGiftNotice == null ? null : new { activeGiftNotice.User, activeGiftNotice.GiftId, activeGiftNotice.Repeats, activeGiftNotice.Effect, activeGiftNotice.Live },
            giftNoticeDrawn,
            comboBounds = new { comboBounds.x, comboBounds.y, comboBounds.width, comboBounds.height },
            cleanupBounds = new { cleanupBounds.x, cleanupBounds.y, cleanupBounds.width, cleanupBounds.height },
            giftNoticeBounds = new { giftNoticeBounds.x, giftNoticeBounds.y, giftNoticeBounds.width, giftNoticeBounds.height },
            recapBounds = new { recapBounds.x, recapBounds.y, recapBounds.width, recapBounds.height },
            nativeMenu = GameManager.Instance.IsPaused, nativeMenuVisible = GameManager.Instance.pauseMenu.gameObject.activeInHierarchy && GameManager.Instance.pauseMenu.alpha > .5f, qaLocked = QaLocked,
            focused = Application.isFocused, cursorLock = Cursor.lockState.ToString(), cursorVisible = Cursor.visible
        }, new JsonSerializerOptions { WriteIndented = true }));
        File.Move(reportFile + ".tmp", reportFile, true);
    }

    private Dictionary<string, int> CreatureModelCounts()
    {
        var counts = new Dictionary<string, int>();
        foreach (var creature in creatures)
        {
            counts.TryGetValue(creature.Model, out int previous);
            counts[creature.Model] = previous + 1;
        }
        return counts;
    }

    private static System.Collections.IEnumerator Capture(string name)
    {
        yield return new WaitForEndOfFrame();
        var image = new Texture2D(Screen.width, Screen.height, TextureFormat.RGB24, false);
        image.ReadPixels(new Rect(0, 0, Screen.width, Screen.height), 0, 0);
        image.Apply();
        File.WriteAllBytes(Path.Combine(Root, "qa", name), ImageConversion.EncodeToPNG(image).ToArray());
        Object.Destroy(image);
    }

    public override void OnGUI()
    {
        if (!ready || failed) return;
        try
        {
            if (heading == null)
            {
                heading = new GUIStyle() { fontSize = 20, fontStyle = FontStyle.Bold };
                text = new GUIStyle() { fontSize = 16 };
                small = new GUIStyle() { fontSize = 12 };
                number = new GUIStyle() { fontSize = 72, alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold };
                foreach (var style in new[] { heading, text, small, number }) style.normal.textColor = Color.white;
                panelTexture = new Texture2D(1, 1); panelTexture.SetPixel(0, 0, new Color(.025f, .04f, .05f, .82f)); panelTexture.Apply();
            }
            if (GameManager.Instance.IsPaused) return;
            if (menu) { GUI.enabled = !QaLocked; DrawMenu(); GUI.enabled = true; return; }
            if (Event.current.type != EventType.Repaint) return;
            GUI.color = Color.white;
            if (roundDied) { DrawDefeatOverlay(); return; }
            DrawProfiles();
            DrawProgressHud();
            DrawReticle();
            DrawCrowdCounter();
            DrawChallengeHud();
            DrawHighlightsHud();
            DrawSurvivalHud();
            DrawAmmoHud();
            recapDrawn = false;
            if (rules.Won || roundTimedOut)
            {
                if (settings.RoundSummaryEnabled) DrawRoundRecapOverlay();
                else GUI.Label(new Rect(0, Screen.height * .32f, Screen.width, 120), roundTimedOut ? "SURE DOLDU" : "WINNER", number);
                if (nextRoundPending.Count > 0 || nextRoundWeaponLevel > 0)
                {
                    var previous = text.alignment;
                    text.alignment = TextAnchor.MiddleCenter;
                    float nextY = settings.RoundSummaryEnabled ? recapBounds.yMax + 8 : Screen.height * .32f + 112;
                    GUI.Label(new Rect(0, nextY, Screen.width, 30), "Sonraki tur: " + nextRoundPending.Count.ToString("N0") + " yaratik / " + Rules.WeaponNames[nextRoundWeaponLevel], text);
                    text.alignment = previous;
                }
            }
            else if (settings.TimedMode && challenge.Phase == ChallengePhase.Preparing)
            {
                GUI.Label(new Rect(0, Screen.height * .3f, Screen.width, 120), Math.Ceiling(challenge.Remaining(Time.time)).ToString(), number);
            }
            else if (!settings.TimedMode && rules.Deadline.HasValue && pending.Count == 0) GUI.Label(new Rect(0, Screen.height * .3f, Screen.width, 120), Math.Ceiling(Math.Max(0, rules.Deadline.Value - Time.time)).ToString(), number);
            if (Time.realtimeSinceStartup < messageUntil && !rules.Won && !roundTimedOut)
            {
                float noticeWidth = Screen.width < 1180 ? Math.Max(120, Math.Min(380, Screen.width - 600)) : 380;
                FitStoryLabel(new Rect((Screen.width - noticeWidth) / 2, 152, noticeWidth, 30), message, heading, Ink);
            }
            DrawGiftEffects();
            if (!firstFrameRendered) { firstFrameRendered = true; PublishStartup("ready-frame"); }
        }
        catch (Exception e)
        {
            if (!firstFrameRendered) PublishStartup("failed", true);
            if (e.ToString() != lastHudError) { lastHudError = e.ToString(); MelonLogger.Error("HUD: " + e); File.WriteAllText(Path.Combine(Root, "qa", "hud-error.txt"), e.ToString()); }
        }
    }

    private void DrawProfiles()
    {
        DrawNearestProfiles();
    }
    private Texture2D Portrait(string user)
    {
        if (portraits.TryGetValue(user, out var texture)) return texture;
        try { texture = LivePortrait(user); }
        catch (Exception e) { liveAvatars.Remove(user); MelonLogger.Warning("Avatar decode: " + e.Message); }
        if (texture != null) { portraits[user] = texture; return texture; }
        texture = new Texture2D(48, 48, TextureFormat.RGBA32, false);
        uint hash = 2166136261; foreach (char ch in user) hash = (hash ^ ch) * 16777619;
        var color = Color.HSVToRGB((hash % 1000) / 1000f, .55f, .95f);
        for (int y = 0; y < 48; y++) for (int x = 0; x < 48; x++)
        {
            float r = (x - 23.5f) * (x - 23.5f) + (y - 23.5f) * (y - 23.5f);
            bool head = (x - 24) * (x - 24) + (y - 29) * (y - 29) < 60;
            bool body = y < 21 && (x - 24) * (x - 24) + (y - 8) * (y - 8) < 170;
            texture.SetPixel(x, y, r > 550 ? Color.clear : head || body ? new Color(.95f, .98f, 1) : color);
        }
        texture.Apply(); portraits[user] = texture; return texture;
    }
    private void DrawLegacyMenu()
    {
        float x = Screen.width / 2f - 230, y = Screen.height / 2f - 190;
        GUI.DrawTexture(new Rect(x, y, 460, 380), panelTexture);
        GUI.Label(new Rect(x + 24, y + 18, 400, 30), "TikMnG / YEREL TEST", heading);
        if (GUI.Button(new Rect(x + 24, y + 64, 126, 42), "+1 yaratik")) Add(1, "Deniz");
        if (GUI.Button(new Rect(x + 166, y + 64, 126, 42), "+10 yaratik")) Add(10, "Yildiz");
        if (GUI.Button(new Rect(x + 308, y + 64, 126, 42), "+50 yaratik")) Add(50, "Atlas");
        if (GUI.Button(new Rect(x + 24, y + 124, 196, 42), "Silah yukselt")) Shift(1);
        if (GUI.Button(new Rect(x + 240, y + 124, 194, 42), "Silah dusur")) Shift(-1);
        GUI.Label(new Rect(x + 24, y + 186, 410, 28), "E  Vakum / Silah       B  Menu", text);
        GUI.Label(new Rect(x + 24, y + 218, 410, 28), "F1 / F2 / F3  Yaratik       F6 / F7  Silah", text);
        if (GUI.Button(new Rect(x + 24, y + 270, 196, 42), "Turu sifirla")) Reset();
        if (GUI.Button(new Rect(x + 240, y + 270, 194, 42), "Devam et")) SetMenu(false);
        if (GUI.Button(new Rect(x + 24, y + 326, 410, 32), "Cikis")) Application.Quit();
    }
}
