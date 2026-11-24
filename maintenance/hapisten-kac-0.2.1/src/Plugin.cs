using BepInEx;
using BepInEx.Configuration;
using BepInEx.Logging;
using System.Globalization;
using BepInEx.Unity.IL2CPP;
using HarmonyLib;
using Il2CppInterop.Runtime;
using Il2CppInterop.Runtime.Attributes;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using UObj = UnityEngine.Object;

namespace TikMnG.HapistenKac;

[BepInPlugin("com.tikmng.hapistenkac", "TikMnG Hapisten Kaç", "0.2.1")]
public sealed class Plugin : BasePlugin
{
    internal static ManualLogSource Output = null!;
    internal static ConfigEntry<float> PunchSpeed = null!;
    internal static ConfigEntry<float> PunchSpeedTwo = null!;
    internal static ConfigEntry<int> FieldOfView = null!;
    internal static ConfigEntry<int> EscapeGoal = null!;
    internal static ConfigEntry<int> ExcavationMetres = null!;

    public override void Load()
    {
        Output = Log;
        var punchRange = new AcceptableValueRange<float>(1, 8);
        PunchSpeed = Config.Bind("Oynanis", "HizliYumrukSeviye1", 3f,
            new ConfigDescription("Normal vuruşa göre birinci seviye hız.", punchRange));
        PunchSpeedTwo = Config.Bind("Oynanis", "HizliYumrukSeviye2", 5f,
            new ConfigDescription("Normal vuruşa göre ikinci seviye hız.", punchRange));
        FieldOfView = Config.Bind("Oynanis", "YatayGorusAcisi", 105,
            new ConfigDescription("Yatay görüş açısı.", new AcceptableValueRange<int>(80, 115)));
        var directory = Path.Combine(Paths.ConfigPath, "hapisten-kac-saves");
        Directory.CreateDirectory(directory);
        ModSaveFolder.DirectoryPath = directory;
        EscapeGoal = Config.Bind("Oynanis", "KacisHedefi", 10,
            new ConfigDescription("Ardışık oyunlar için kaçış hedefi.", new AcceptableValueRange<int>(1, 9999)));
        ExcavationMetres = Config.Bind("Oynanis", "KaziMesafesi", RouteLength.Default,
            new ConfigDescription("Yeni kazılarda son duvara kalan hedef mesafe.", new AcceptableValueRange<int>(RouteLength.Minimum, RouteLength.Maximum)));
        EscapeProgress.Initialize(Path.Combine(Paths.ConfigPath, "hapisten-kac-escape-progress.json"));
        Il2CppInterop.Runtime.Injection.ClassInjector.RegisterTypeInIl2Cpp<WallDynamite>();
        new Harmony("com.tikmng.hapistenkac").PatchAll();
        AddComponent<LivePanel>();
        Log.LogInfo("Hapisten Kaç loaded into the original demo.");
    }
}

[HarmonyPatch(typeof(RunSave), "get_Folder")]
internal static class ModSaveFolder
{
    internal static string DirectoryPath = "";

    private static bool Prefix(ref string __result)
    {
        __result = DirectoryPath;
        return false;
    }
}

[HarmonyPatch(typeof(PauseMenu), nameof(PauseMenu.Open))]
internal static class DisablePauseMenu
{
    private static bool Prefix() => false;
}

[HarmonyPatch(typeof(RouteMeterView), "LateUpdate")]
internal static class ExitDistanceHud
{
    private static float nextSample;
    private static IntPtr lastPlayer;
    private static string? label;
    private static Text? progress;
    private static IntPtr progressParent;

    private static void Postfix(RouteMeterView __instance)
    {
        var player = PlayerState.Local;
        var number = __instance.number;
        if (player == null || number == null || VoxelNet.Instance?.World == null) return;
        if (number.enabled == EscapeFinale.KeepsHud) number.enabled = !EscapeFinale.KeepsHud;
        if (progress == null || progressParent != number.Pointer)
        {
            if (progress != null) UObj.Destroy(progress.gameObject);
            progressParent = number.Pointer;
            progress = MenuUi.Label("Kaçış hedefi", number.transform, "", MenuUi.BodyFont,
                21, new Color(1f, .88f, .58f), TextAnchor.MiddleCenter);
            progress.raycastTarget = false;
            var rect = progress.rectTransform;
            rect.anchorMin = rect.anchorMax = new Vector2(.5f, 0);
            rect.pivot = new Vector2(.5f, 1);
            rect.anchoredPosition = new Vector2(0, -3);
            rect.sizeDelta = new Vector2(680, 28);
            var outline = progress.gameObject.AddComponent<Outline>();
            outline.effectColor = MenuUi.Ink;
            outline.effectDistance = new Vector2(1, -1);
        }
        progress.enabled = !EscapeFinale.KeepsHud;
        if (EscapeFinale.KeepsHud) return;
        var results = EscapeProgress.Current;
        var goal = $"Kaçış  {results.Wins} / {Plugin.EscapeGoal.Value}     ·     Başarısız  {results.Losses}";
        if (progress.text != goal) progress.text = goal;
        var now = Time.unscaledTime;
        if (player.Pointer != lastPlayer || now >= nextSample)
        {
            lastPlayer = player.Pointer;
            nextSample = now + .2f;
            var feet = player.Motor.Feet;
            var metres = DemoMode.IsDemo && PywoNetworkManager.Instance?.SoloLobby == true
                ? EscapeDistance.FromPosition(VoxelNet.Instance.World, feet)
                : float.NaN;
            if (!float.IsFinite(metres) && PYWO.Voxel.Exits.Configured)
            {
                var position = new Unity.Mathematics.float3(feet.x, feet.y, feet.z);
                var route = PYWO.Voxel.Exits.NearestByRoute(position, -1);
                if (route >= 0)
                {
                    var distance = PYWO.Voxel.Exits.RouteDecimetres(route, position);
                    if (distance is >= 0 and < int.MaxValue) metres = distance / 10f;
                }
            }
            if (!float.IsFinite(metres)) label = null;
            else
            {
                var displayMetres = DemoMode.IsDemo && PywoNetworkManager.Instance?.SoloLobby == true &&
                    ExcavationRoute.UsesArrivalFinale(VoxelNet.Instance.World)
                    ? RouteLength.DisplayRemaining(metres)
                    : Mathf.CeilToInt(Math.Max(0, metres));
                label = $"Çıkışa {displayMetres} m kaldı";
            }
        }
        if (label != null && number.text != label) number.text = label;
    }
}

public sealed class LivePanel : MonoBehaviour
{
    private MainMenu? menu;
    private Text? tickerText;
    private RectTransform? tickerMask;
    private bool windowInitialized;
    private bool resizableWindow;
    private float windowReadyAt;
    private Button? menuButton;
    private Button? newRunButton;
    private Canvas? overlay;
    private InputField? account;
    private RectTransform? actionButtons;
    private RectTransform? panelFrame;
    private RectTransform? savedActions;
    private RectTransform? audiencePanel;
    private RectTransform? giftToolbar;
    private InputField? likeThreshold;
    private Text? audienceStatus;
    private string audiencePath = "";
    private AudienceSettings audience = new();
    private readonly AudienceProgress audienceProgress = new();
    private AudienceRow? followRow;
    private AudienceRow? likeRow;
    private RectTransform? audienceChoices;
    private AudienceRow? editingAudience;
    private sealed record AudienceRow(Button ActionButton, Button ToolButton, InputField Amount, InputField Speed,
        Text AmountLabel, Text SpeedLabel)
    {
        internal int Action { get; set; } = -1;
        internal int Tool { get; set; }
    }
    private Text? emptyActions;
    private readonly List<GameObject> savedRows = new();
    private readonly Dictionary<(int Action, string GiftId), BindingDraft> pendingRows = new();
    private sealed record BindingDraft(string GiftId, string Amount, string Speed);
    private Text? savedPageText;
    private Button? previousSavedPage;
    private Button? nextSavedPage;
    private int savedPage;
    private const int SavedActionsPerPage = 5;
    private Text? formStatus;
    private Text? amountLabel;
    private Text? speedLabel;
    private InputField? speedField;
    private Binding? pickingFor;
    private RectTransform? toolChoices;
    private Text? toolStatus;
    private Text? fovStatus;
    private Text? distanceStatus;
    private Text? timerHud;
    private RectTransform? escapePanel;
    private Text? escapeStatus;
    private float saveRequestedAt;
    private int savedWrites;
    private bool leaving;
    private bool restartAfterEscape;
    private float restartDeadline;
    private bool restartArchived;
    private bool restartStarted;
    private float nextRestartAttempt;
    private readonly Queue<LiveBridge.Packet> deferredEvents = new();
    private bool savePending;
    private RectTransform? settings;
    private Text? actionNotice;
    private float noticeUntil;
    private Button[] toolButtons = Array.Empty<Button>();
    private int chosenTool;
    private Button[] actionChoices = Array.Empty<Button>();
    private int chosenAction;
    private InputField? giftId;
    private InputField? amount;
    private InputField? goalField;
    private RectTransform? goalPanel;
    private const int GiftsPerPage = 12;
    private RectTransform? giftGrid;
    private Text? giftPageText;
    private Text? chosenGiftText;
    private Gift? chosenGift;
    private Gift[] matchingGifts = Array.Empty<Gift>();
    private int giftPage;
    private Sprite? roundedSprite;
    private static readonly Color Surface = new(.18f, .16f, .135f);
    private static readonly Color Raised = new(.25f, .22f, .18f);
    private static readonly Color Muted = new(.78f, .72f, .61f);
    private string giftImageDirectory = "";
    private readonly List<GameObject> giftTiles = new();
    private readonly List<(Button Button, string Id)> giftChoices = new();
    private readonly Dictionary<string, Texture2D> giftTextures = new();
    private Gift[] gifts = Array.Empty<Gift>();
    private Text? status;
    private Text? nativeTitle;
    private Text? secondLine;
    private readonly LiveBridge bridge = new();
    private readonly WorldActions worldActions = new();
    private string liveText = "Yayın bağlı değil.";
    private readonly HashSet<string> seen = new();
    private float boostUntil;
    private readonly Dictionary<float, float> punchBoosts = new();
    private float cuffUntil;
    private string swapLabel = "";
    private float baseDamage;
    private float basePunchRate;
    private PunchTuning? activeTuning;
    private PlayerState? currentPlayer;
    private int toolSlot = -1;
    private int equippedToolId;
    private sbyte previousToolSelection = -1;
    private bool hasPreviousToolSelection;
    private int toolTier;
    private float swapUntil;
    private bool wasInputEnabled;
    private bool previousCursor;
    private CursorLockMode previousLock;
    private PlayerMotor? blockedMotor;
    private InputSystemPlayerInput? blockedInput;
    private InputContext previousInputContext;
    private bool previousAutoLock;
    private float nextMenuScan;
    private bool bWasHeld;
    private bool escapeWasHeld;
    private float lastPanelKey = -1f;
    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int virtualKey);
    private readonly string[] actionNames = { "Hızlı yumruk", "Aleti değiştir", "Aleti yükselt", "Aleti düşür", "Dinamit ver", "Anında patlat", "Duvarı geri ör", "Yardımcı çağır", "", "Kelepçe tak", "Kelepçeden kurtul", "Hapse geri dön", "Baştan başla", "Hapisten kaç", "360° anında patlat" };
    // Keep saved IDs stable; 3 replaces the removed screw, 5 adds paired knuckles.
    private static readonly string[] ToolNames = { "Matkap", "Dinamit", "Yumruk", "Tornavida", "Çekiç", "Muşta" };
    private readonly List<Binding> bindings = new();
    private string dataPath = "";
    private record Gift(string Id, string? TrName, string? Name, int Coins, string? File);

    public LivePanel(IntPtr pointer) : base(pointer) {}

    private void Start()
    {
        dataPath = Path.Combine(Paths.ConfigPath, "hapisten-kac-actions.json");
        audiencePath = Path.Combine(Paths.ConfigPath, "hapisten-kac-audience.json");
        try { audience = AudienceSettings.Load(MenuExtras.SettingsSource(audiencePath), actionNames.Length); }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or System.Text.Json.JsonException)
        { Plugin.Output.LogWarning("Takip ve beğeni ayarları okunamadı."); }
        try
        {
            bindings.AddRange(BindingFile.Load(MenuExtras.SettingsSource(dataPath), actionNames.Length,
                Plugin.PunchSpeed.Value, Plugin.PunchSpeedTwo.Value));
        }
        catch (IOException) {}
        catch (System.Text.Json.JsonException) { Plugin.Output.LogWarning("Gift settings could not be read."); }
        try
        {
            var root = Path.GetFullPath(Path.Combine(Paths.GameRootPath, ".."));
            giftImageDirectory = Path.Combine(root, "shared", "gift-images");
            gifts = System.Text.Json.JsonSerializer.Deserialize<Gift[]>(File.ReadAllText(Path.Combine(root, "shared", "gift-catalog.json")),
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? Array.Empty<Gift>();
        }
        catch (Exception error) { Plugin.Output.LogWarning(error.Message); }
        // Launcher preview account; LIVE remains owned by the launcher.
        var launcherAccount = Environment.GetEnvironmentVariable("TIKMNG_PRISON_USERNAME") ?? "";
        if (launcherAccount.Length is >= 2 and <= 32 &&
            launcherAccount.All(ch => ch is >= 'a' and <= 'z' or >= '0' and <= '9' or '_' or '.'))
        {
            try { bridge.Connect(launcherAccount); }
            catch (Exception error) { Plugin.Output.LogWarning("Launcher LIVE: " + error.Message); }
        }
    }

    private void Update()
    {
        VacuumInput.Tick(PlayerState.Local, Application.isFocused && !leaving &&
            overlay?.gameObject.activeSelf != true && !CatalogueView.IsOpen && !EscapeFinale.KeepsHud);
        UpdateLive();
        DrillMark.Update(PlayerState.Local);
        MenuExtras.Tick(tickerMask, tickerText, menu != null && menu.main != null && menu.main.gameObject.activeInHierarchy);
        RestartAfterEscape();
        if (Time.unscaledTime >= nextMenuScan)
        {
            nextMenuScan = Time.unscaledTime + .6f;
            try
            {
                UpdateNativeMenu();
                if (Screen.fullScreenMode != FullScreenMode.Windowed) resizableWindow = false;
                else if (windowInitialized && Time.unscaledTime >= windowReadyAt && !resizableWindow)
                    resizableWindow = GameWindow.EnableResize();
            }
            catch (Exception error) { Plugin.Output.LogWarning(error.Message); }
            if (overlay != null && overlay.gameObject.activeSelf) RefreshToolStatus();
        }
        CellDecor.Update();
        TunnelLighting.Update();
        if (actionNotice != null && actionNotice.gameObject.activeSelf && Time.unscaledTime >= noticeUntil)
            actionNotice.gameObject.SetActive(false);
        RefreshTimerHud();
        UpdateSaveExit();
        if (EscapeFinale.KeepsHud && EscapeFinale.Update(PlayerState.Local,
                overlay?.gameObject.activeSelf != true && !CatalogueView.IsOpen) && SaveRunner.Instance?.Busy != true)
        {
            BeginNewRun();
            return;
        }
        if (Application.isFocused && overlay?.gameObject.activeSelf != true && Mouse.current is { } mouse &&
            (mouse.leftButton.wasPressedThisFrame || mouse.rightButton.wasPressedThisFrame)) PunchEffects.Rattle();
        var keyboard = Keyboard.current;
        if (Application.isFocused)
        {
            var escapeState = GetAsyncKeyState(0x1B);
            var escapeHeld = (escapeState & 0x8000) != 0;
            var escapePressed = keyboard?.escapeKey.wasPressedThisFrame == true ||
                (!escapeWasHeld && (escapeHeld || (escapeState & 1) != 0));
            escapeWasHeld = escapeHeld;
            if (escapePressed && PlayerState.Local != null && !leaving && !savePending)
            {
                if (overlay?.gameObject.activeSelf == true) Close();
                else if (!EscapeFinale.ReturnToTunnel() && !CatalogueView.IsOpen) OpenEscape();
                return;
            }
        }
        else escapeWasHeld = false;
        var panelOpen = overlay != null && overlay.gameObject.activeSelf;
        if (!Application.isFocused) { bWasHeld = false; return; }
        var keyState = GetAsyncKeyState(0x42);
        var bHeld = (keyState & 0x8000) != 0;
        var bPressed = keyboard?.bKey.wasPressedThisFrame == true || (!bWasHeld && (bHeld || (keyState & 1) != 0));
        bWasHeld = bHeld;
        if (!bPressed || Time.unscaledTime - lastPanelKey < .2f) return;
        lastPanelKey = Time.unscaledTime;
        if (panelOpen)
        {
            if (account?.isFocused != true && goalField?.isFocused != true && giftId?.isFocused != true && amount?.isFocused != true && !HasFocusedField() && escapePanel?.gameObject.activeSelf != true) Close();
        }
        else if (!EscapeFinale.KeepsHud && ((PlayerState.Local != null && !PauseMenu.IsOpen && !CatalogueView.IsOpen) ||
            (menu != null && menu.main != null && menu.main.gameObject.activeInHierarchy &&
            !menu.CharacterOpen && !menu.SettingsOpen))) Open();
    }

    private void BeginNewRun()
    {
        if (restartAfterEscape) return;
        worldActions.StopHelper();
        worldActions.ClearRebuild();
        if (overlay?.gameObject.activeSelf == true) Close();
        restartAfterEscape = true;
        restartArchived = restartStarted = false;
        nextRestartAttempt = Time.unscaledTime;
        restartDeadline = Time.unscaledTime + 45f;
        leaving = true;
        PywoNetworkManager.Instance?.LeaveToMenu();
    }

    private void RestartAfterEscape()
    {
        if (!restartAfterEscape) return;
        if (Time.unscaledTime >= restartDeadline)
        {
            restartAfterEscape = false;
            Plugin.Output.LogWarning("Yeni kazı otomatik açılamadı.");
            SetStatus("Yeni kazı açılamadı. Ana menüden tekrar başlatabilirsin.");
            return;
        }
        if (restartStarted && PlayerState.Local != null)
        {
            restartAfterEscape = false;
            Plugin.Output.LogInfo("Hapisten Kaç · yeni kazı açıldı.");
            return;
        }
        var manager = PywoNetworkManager.Instance;
        if (manager == null || manager.Busy || PlayerState.Local != null ||
            Mirror.NetworkServer.active || Mirror.NetworkClient.active || Time.unscaledTime < nextRestartAttempt ||
            MainMenu.Instance?.main?.gameObject.activeInHierarchy != true) return;
        nextRestartAttempt = Time.unscaledTime + 2f;
        try
        {
            if (!restartArchived)
            {
                RunSave.ArchiveForNewRun();
                restartArchived = true;
            }
            RunSave.CancelPending();
            manager.PlaySolo();
            restartStarted = true;
        }
        catch (Exception error) { Plugin.Output.LogWarning($"Yeni kazı otomatik açılamadı · {error.Message}"); }
    }

    private void UpdateNativeMenu()
    {
        var current = MainMenu.Instance;
        if (current == null || current.main == null || current.titleBlock == null) return;
        if (!windowInitialized && current.main.gameObject.activeInHierarchy)
        {
            windowInitialized = true;
            windowReadyAt = Time.unscaledTime + .2f;
            Screen.SetResolution(1152, 648, FullScreenMode.Windowed);
        }
        if (menu == null || menu.Pointer != current.Pointer)
        {
            menu = current; menuButton = null; newRunButton = null; nativeTitle = null; secondLine = null;
            tickerMask = null;
            tickerText = null;
        }
        if (nativeTitle == null)
        {
            foreach (var title in current.titleBlock.GetComponentsInChildren<Text>(true))
            {
                if (title.text.Contains("PUNCH YOUR", StringComparison.OrdinalIgnoreCase)) nativeTitle = title;
                else if (title.text.Contains("WAY OUT", StringComparison.OrdinalIgnoreCase)) secondLine = title;
            }
        }
        if (nativeTitle != null)
        {
            nativeTitle.text = "HAPİSTEN";
            if (secondLine != null) secondLine.text = "KAÇ";
            else
            {
                secondLine = UObj.Instantiate(nativeTitle.gameObject, nativeTitle.transform.parent, false).GetComponent<Text>();
                secondLine.name = "TikMnG Title Line";
                var rect = secondLine.rectTransform;
                rect.anchoredPosition -= new Vector2(0, nativeTitle.fontSize * .94f);
                secondLine.text = "KAÇ";
                secondLine.color = MenuUi.Brass;
            }
        }
        if (menuButton != null)
        {
            RefreshRunButtons(current);
            return;
        }
        if (current.firstMain != null && current.continueButton != null &&
            current.firstMain.Pointer != current.continueButton.Pointer)
        {
            var fresh = UObj.Instantiate(current.firstMain.gameObject, current.firstMain.transform.parent, false);
            fresh.name = "TikMnGNewRunButton";
            fresh.transform.SetSiblingIndex(current.firstMain.transform.GetSiblingIndex());
            newRunButton = fresh.GetComponent<Button>();
            newRunButton.onClick = new Button.ButtonClickedEvent();
            newRunButton.onClick.AddListener(DelegateSupport.ConvertDelegate<UnityEngine.Events.UnityAction>(
                (Action)(() => current.firstMain.onClick.Invoke())));
            MenuUi.SetText(newRunButton, "Oyuna baştan başla");
        }
        RefreshRunButtons(current);
        if (current.hostButton == null) return;
        var template = current.firstMain != null ? current.firstMain : current.hostButton;
        var replacement = UObj.Instantiate(template.gameObject, template.transform.parent, false);
        replacement.name = "TikMnGLiveButton";
        replacement.transform.SetSiblingIndex(template.transform.GetSiblingIndex() + 1);
        menuButton = replacement.GetComponent<Button>();
        menuButton.onClick = new Button.ButtonClickedEvent();
        menuButton.onClick.AddListener(DelegateSupport.ConvertDelegate<UnityEngine.Events.UnityAction>((Action)Open));
        MenuUi.SetText(menuButton, "Yayına Bağlan");
        replacement.SetActive(true);
        var download = UObj.Instantiate(replacement, replacement.transform.parent, false);
        download.name = "TikMnGGiftDownload";
        download.transform.SetSiblingIndex(replacement.transform.GetSiblingIndex() + 1);
        var downloadButton = download.GetComponent<Button>();
        downloadButton.onClick = new Button.ButtonClickedEvent();
        downloadButton.onClick.AddListener(DelegateSupport.ConvertDelegate<UnityEngine.Events.UnityAction>(
            (Action)(() => MenuExtras.ExportGifts(downloadButton))));
        MenuUi.SetText(downloadButton, "Hazır hediye görseli indir");
        foreach (var label in downloadButton.GetComponentsInChildren<Text>(true))
            if (label.text == "Hazır hediye görseli indir") label.fontSize = Math.Min(label.fontSize, 25);
        (tickerMask, tickerText) = MenuExtras.CreateTicker(current);
        current.hostButton.gameObject.SetActive(false);
        if (current.joinOpen != null) current.joinOpen.gameObject.SetActive(false);
        if (current.getFullButton != null) current.getFullButton.gameObject.SetActive(false);
        if (current.characterButton != null)
        {
            MenuUi.SetText(current.characterButton, "Karakter Oluştur");
            foreach (var label in current.characterButton.GetComponentsInChildren<Text>(true))
            {
                label.fontSize = Math.Min(label.fontSize, 17);
                label.horizontalOverflow = HorizontalWrapMode.Overflow;
            }
        }
        if (current.bottomStrip != null) current.bottomStrip.gameObject.SetActive(false);
        foreach (var label in current.canvas.GetComponentsInChildren<Text>(true))
        {
            if (!label.gameObject.activeInHierarchy || !label.text.Equals("Demo sürümü", StringComparison.OrdinalIgnoreCase)) continue;
            label.text = "TikMnG";
            label.fontSize = 26;
        }
        Plugin.Output.LogInfo("Native menu retained and TikMnG controls attached.");
    }

    private void RefreshRunButtons(MainMenu current)
    {
        var canContinue = current.continueButton != null && current.continueButton.gameObject.activeSelf;
        if (canContinue)
        {
            MenuUi.SetText(current.continueButton, "Kaldığın yerden devam et");
            foreach (var label in current.continueButton!.GetComponentsInChildren<Text>(true))
            {
                if (label.text != "Kaldığın yerden devam et") continue;
                label.fontSize = Math.Min(label.fontSize, 27);
                label.horizontalOverflow = HorizontalWrapMode.Overflow;
            }
        }
        if (newRunButton == null) return;
        if (newRunButton.gameObject.activeSelf != canContinue) newRunButton.gameObject.SetActive(canContinue);
        if (canContinue && current.firstMain.gameObject.activeSelf) current.firstMain.gameObject.SetActive(false);
        if (!canContinue && current.firstMain.gameObject.activeSelf) MenuUi.SetText(current.firstMain, "Oyuna baştan başla");
    }

    private static RectTransform Position(RectTransform rect, float x, float y, float width, float height)
    {
        rect.anchorMin = rect.anchorMax = new Vector2(0, 1);
        rect.pivot = new Vector2(0, 1);
        rect.anchoredPosition = new Vector2(x, -y);
        rect.sizeDelta = new Vector2(width, height);
        return rect;
    }

    private Image Rounded(Transform parent, string name, Color color, bool raycast = false)
    {
        if (roundedSprite == null)
        {
            const int size = 40;
            const float radius = 13;
            var pixels = new Color32[size * size];
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                var dx = x + .5f - Mathf.Clamp(x + .5f, radius, size - radius);
                var dy = y + .5f - Mathf.Clamp(y + .5f, radius, size - radius);
                var alpha = Mathf.Clamp01(radius + .5f - Mathf.Sqrt(dx * dx + dy * dy));
                pixels[y * size + x] = new Color32(255, 255, 255, (byte)(alpha * 255));
            }
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false);
            texture.SetPixels32(pixels);
            texture.Apply(false, true);
            roundedSprite = Sprite.Create(texture, new Rect(0, 0, size, size), new Vector2(.5f, .5f),
                100, 0, SpriteMeshType.FullRect, new Vector4(14, 14, 14, 14));
        }
        var image = MenuUi.Solid(name, parent, color, raycast);
        image.sprite = roundedSprite;
        image.type = Image.Type.Sliced;
        return image;
    }

    [HideFromIl2Cpp]
    private Button RoundedButton(Transform parent, string label, float x, float y, float width, float height, Action callback)
    {
        var image = Rounded(parent, label.Length == 0 ? "Hediye kartı" : label, Color.white, true);
        var rect = Position(image.rectTransform, x, y, width, height);
        var button = rect.gameObject.AddComponent<Button>();
        button.targetGraphic = image;
        button.onClick.AddListener(DelegateSupport.ConvertDelegate<UnityEngine.Events.UnityAction>(callback));
        if (label.Length > 0)
        {
            var text = TextAt(rect, "Etiket", label, 4, 0, width - 8, height, 18);
            text.alignment = TextAnchor.MiddleCenter;
        }
        StyleChoice(button, false);
        return button;
    }

    private static void StyleChoice(Button button, bool selected)
    {
        var colors = button.colors;
        colors.normalColor = selected ? MenuUi.Brass : Raised;
        colors.selectedColor = colors.normalColor;
        colors.highlightedColor = Color.Lerp(colors.normalColor, Color.white, .14f);
        colors.pressedColor = Color.Lerp(colors.normalColor, Color.black, .2f);
        colors.disabledColor = Surface;
        button.colors = colors;
        foreach (var text in button.GetComponentsInChildren<Text>(true))
            text.color = selected ? MenuUi.Ink : MenuUi.Paper;
    }

    private static Text TextAt(Transform parent, string name, string value, float x, float y, float width, float height, int size)
    {
        var text = MenuUi.Label(name, parent, value, MenuUi.BodyFont, size, MenuUi.Paper, TextAnchor.MiddleLeft);
        Position(text.rectTransform, x, y, width, height);
        text.fontSize = size;
        text.raycastTarget = false;
        return text;
    }

    private static InputField FieldAt(Transform parent, string placeholder, float x, float y, float width)
    {
        var field = MenuUi.MakeField(parent, placeholder);
        Position(field.GetComponent<RectTransform>(), x, y, width, 45);
        var label = field.textComponent;
        label.color = MenuUi.Ink;
        label.fontSize = 19;
        label.alignment = TextAnchor.MiddleLeft;
        if (field.placeholder != null)
        {
            field.placeholder.color = new Color(.37f, .34f, .30f);
            var hint = field.placeholder.TryCast<Text>();
            if (hint != null) hint.fontSize = 17;
        }
        return field;
    }

    private static InputField ValueField(Transform parent, float x, float y, float width, float height, bool decimalValue)
    {
        var field = FieldAt(parent, "", x, y, width);
        Position(field.GetComponent<RectTransform>(), x, y, width, height);
        field.contentType = InputField.ContentType.Standard;
        field.keyboardType = decimalValue ? TouchScreenKeyboardType.DecimalPad : TouchScreenKeyboardType.NumberPad;
        field.characterLimit = decimalValue ? 4 : 6;
        return field;
    }

    private static Text GiftLabel(Transform parent, string value, float y, float height, int size)
    {
        var rect = Position(MenuUi.Rect("Hediye etiketi", parent), 50, y, 117, height);
        rect.gameObject.AddComponent<RectMask2D>();
        var text = MenuUi.Rect("Yazı", rect).gameObject.AddComponent<Text>();
        Position(text.rectTransform, 0, 0, 117, height);
        text.font = MenuUi.BodyFont;
        text.fontSize = size;
        text.color = MenuUi.Paper;
        text.alignment = TextAnchor.MiddleLeft;
        text.raycastTarget = false;
        text.horizontalOverflow = HorizontalWrapMode.Wrap;
        text.verticalOverflow = VerticalWrapMode.Truncate;
        text.text = value;
        return text;
    }

    private void BuildPanel()
    {
        MenuUi.EnsureEventSystem();
        overlay = MenuUi.MakeCanvas("TikMnG Yayın ve Eylemler", 1600, transform);
        overlay.sortingOrder = short.MaxValue;
        var background = MenuUi.Solid("Modal arka plan", overlay.transform, new Color(.07f,.06f,.04f,.86f), true);
        var backgroundRect = background.rectTransform;
        backgroundRect.anchorMin = Vector2.zero; backgroundRect.anchorMax = Vector2.one;
        backgroundRect.offsetMin = backgroundRect.offsetMax = Vector2.zero;
        var frame = Rounded(overlay.transform, "Eylem paneli", Surface, true).rectTransform;
        panelFrame = frame;
        frame.anchorMin = frame.anchorMax = new Vector2(.5f,.5f);
        frame.pivot = new Vector2(.5f,.5f);
        frame.anchoredPosition = Vector2.zero;
        frame.sizeDelta = new Vector2(810, 840);
        TextAt(frame, "Başlık", "Yayın ve Eylemler", 28, 14, 475, 58, 35).color = MenuUi.Brass;
        RoundedButton(frame, "Ayarlar", 526, 22, 120, 42, OpenSettings);
        RoundedButton(frame, "Kapat", 660, 22, 118, 42, Close);
        TextAt(frame, "Kullanıcı", "TikTok kullanıcı adı", 28, 81, 460, 30, 20);
        account = FieldAt(frame, "@kullaniciadi", 28, 114, 450);
        account.characterLimit = 33;
        account.text = Environment.GetEnvironmentVariable("TIKMNG_PRISON_USERNAME") ?? "";
        status = TextAt(frame, "Durum", liveText, 28, 161, 510, 48, 17);
        toolStatus = TextAt(frame, "Eldeki alet", "", 545, 161, 232, 48, 17);
        toolStatus.alignment = TextAnchor.MiddleRight;
        toolStatus.color = Muted;
        RoundedButton(frame, "Bağlan", 491, 114, 133, 45, Connect);
        RoundedButton(frame, "Kes", 636, 114, 141, 45, bridge.Disconnect);
        BuildAudiencePanel(frame);
        goalPanel = Position(MenuUi.Rect("Kaçış hedefi", frame), 28, 374, 750, 40);
        TextAt(goalPanel, "Hedef", "Kaçış hedefi", 12, 0, 225, 40, 17);
        goalField = ValueField(goalPanel, 243, 0, 96, 40, false);
        goalField.characterLimit = 4;
        goalField.text = Plugin.EscapeGoal.Value.ToString(CultureInfo.InvariantCulture);
        RoundedButton(goalPanel, "Hedefi kaydet", 352, 0, 185, 40, SaveGoal);
        giftToolbar = Position(MenuUi.Rect("Hediye eylemleri", frame), 28, 213, 750, 45);
        StyleChoice(RoundedButton(giftToolbar, "Eylem Ekle", 0, 0, 166, 45, BeginBinding), true);
        formStatus = TextAt(giftToolbar, "Eylem durumu", "", 186, 0, 530, 45, 17);
        formStatus.color = MenuUi.Brass;
        actionButtons = Position(MenuUi.Rect("Eylem düzenle", frame), 28, 275, 750, 510);
        actionChoices = new Button[actionNames.Length];
        var displayed = 0;
        for (var index = 0; index < actionNames.Length; index++)
        {
            if (index == BindingFile.FastPunchTwo) continue;
            var action = index;
            actionChoices[index] = RoundedButton(actionButtons, actionNames[index], (displayed % 3) * 249,
                (displayed / 3) * 34, 239, 30, () => SelectAction(action));
            displayed++;
        }
        toolChoices = Position(MenuUi.Rect("Alet seçimi", actionButtons), 0, 170, 738, 36);
        TextAt(toolChoices, "Alet", "Alet seç", 0, 0, 104, 36, 17);
        toolButtons = new Button[ToolNames.Length];
        var toolOrder = new[] { 2, 5, 3, 4, 0, 1 };
        for (var index = 0; index < toolButtons.Length; index++)
        {
            var tool = toolOrder[index];
            toolButtons[tool] = RoundedButton(toolChoices, ToolNames[tool], 112 + index * 104,
                0, 98, 36, () => SelectTool(tool));
        }
        TextAt(actionButtons, "Arama", "Hediye adı veya ID", 0, 209, 410, 23, 15);
        giftId = FieldAt(actionButtons, "Ara", 0, 233, 395);
        giftId.characterLimit = 48;
        amountLabel = TextAt(actionButtons, "Değer", "Süre (sn)", 412, 209, 148, 23, 15);
        amount = ValueField(actionButtons, 412, 233, 148, 45, false);
        speedLabel = TextAt(actionButtons, "Hız", "Hız (×)", 577, 209, 157, 23, 15);
        speedField = ValueField(actionButtons, 577, 233, 157, 45, true);
        TextAt(actionButtons, "Katalog", "Hediye seç", 0, 290, 250, 30, 19).color = MenuUi.Brass;
        giftPageText = TextAt(actionButtons, "Sayfa", "", 332, 290, 124, 30, 16);
        giftPageText.alignment = TextAnchor.MiddleCenter;
        RoundedButton(actionButtons, "‹", 276, 283, 50, 40, () => ChangeGiftPage(-1));
        RoundedButton(actionButtons, "›", 462, 283, 50, 40, () => ChangeGiftPage(1));
        giftGrid = Position(MenuUi.Rect("Hediyeler", actionButtons), 0, 335, 750, 184);
        var selectedGiftBox = Position(Rounded(actionButtons, "Seçili hediye kutusu", Raised).rectTransform, 0, 523, 356, 45);
        chosenGiftText = TextAt(selectedGiftBox, "Seçili hediye", "", 14, 0, 328, 45, 17);
        RoundedButton(actionButtons, "▶ Dene", 368, 523, 112, 45, TestDraft);
        RoundedButton(actionButtons, "Vazgeç", 491, 523, 113, 45, () => ShowBindings(""));
        StyleChoice(RoundedButton(actionButtons, "Kaydet", 615, 523, 122, 45, AddBinding), true);
        giftId.onValueChanged.AddListener(DelegateSupport.ConvertDelegate<UnityEngine.Events.UnityAction<string>>((Action<string>)RefreshGifts));
        RefreshGifts("");
        savedActions = Position(MenuUi.Rect("Kayıtlı eylemler", frame), 28, 478, 750, 405);
        TextAt(savedActions, "Kayıtlı eylemler", "Kayıtlı eylemler", 0, 0, 230, 38, 24).color = MenuUi.Brass;
        StyleChoice(RoundedButton(savedActions, "Kaydet", 232, 0, 104, 35, SaveRows), true);
        emptyActions = TextAt(savedActions, "Boş liste", "Henüz hediye eşleştirmesi yok.", 0, 48, 736, 38, 18);
        emptyActions.color = Muted;
        previousSavedPage = RoundedButton(savedActions, "‹", 0, 341, 50, 40, () => { savedPage--; RefreshBindings(); });
        savedPageText = TextAt(savedActions, "Kayıt sayfası", "", 57, 341, 96, 45, 16);
        savedPageText.alignment = TextAnchor.MiddleCenter;
        nextSavedPage = RoundedButton(savedActions, "›", 160, 341, 50, 40, () => { savedPage++; RefreshBindings(); });
        settings = Position(MenuUi.Rect("Oynanış ayarları", frame), 28, 280, 750, 250);
        TextAt(settings, "Başlık", "Oynanış ayarları", 0, 0, 700, 38, 24).color = MenuUi.Brass;
        fovStatus = SettingRow("Görüş açısı", 51, ChangeFieldOfView);
        distanceStatus = SettingRow("Kazı mesafesi", 105, ChangeExcavationDistance);
        TextAt(settings, "Kazı mesafesi açıklaması", "Yeni kazı başlatıldığında uygulanır.", 0, 150, 620, 32, 16).color = Muted;
        RoundedButton(settings, "Eylemlere dön", 0, 198, 178, 44, () => ShowBindings(""));
        escapePanel = Position(MenuUi.Rect("Oyundan çık", frame), 28, 28, 650, 218);
        TextAt(escapePanel, "Başlık", "Oyundan çık", 0, 0, 620, 56, 35).color = MenuUi.Brass;
        escapeStatus = TextAt(escapePanel, "Kayıt durumu", "İlerlemeni kaydedip ana menüye dönebilirsin.", 0, 62, 620, 45, 17);
        StyleChoice(RoundedButton(escapePanel, "Kaydet ve çık", 0, 126, 270, 48, SaveAndLeave), true);
        RoundedButton(escapePanel, "Oyuna dön", 287, 126, 230, 48, CancelExit);
        escapePanel.gameObject.SetActive(false);
        var noticeCanvas = MenuUi.MakeCanvas("TikMnG Eylem Bildirimi", 1600, transform);
        noticeCanvas.sortingOrder = short.MaxValue - 1;
        actionNotice = TextAt(noticeCanvas.transform, "Eylem sonucu", "", 0, 0, 760, 46, 20);
        var noticeRect = actionNotice.rectTransform;
        noticeRect.anchorMin = noticeRect.anchorMax = new Vector2(.5f, 0);
        noticeRect.pivot = new Vector2(.5f, 0);
        noticeRect.anchoredPosition = new Vector2(0, 92);
        actionNotice.alignment = TextAnchor.MiddleCenter;
        var outline = actionNotice.gameObject.AddComponent<Outline>();
        outline.effectColor = MenuUi.Ink;
        outline.effectDistance = new Vector2(2, -2);
        actionNotice.gameObject.SetActive(false);
        timerHud = TextAt(noticeCanvas.transform, "Aktif eylemler", "", 0, 0, 920, 90, 20);
        var timerRect = timerHud.rectTransform;
        timerRect.anchorMin = timerRect.anchorMax = new Vector2(.5f, 0);
        timerRect.pivot = new Vector2(.5f, 0);
        timerRect.anchoredPosition = new Vector2(0, 145);
        timerHud.alignment = TextAnchor.LowerCenter;
        timerHud.color = MenuUi.Brass;
        var timerOutline = timerHud.gameObject.AddComponent<Outline>();
        timerOutline.effectColor = MenuUi.Ink;
        timerOutline.effectDistance = new Vector2(2, -2);
        timerHud.gameObject.SetActive(false);
        ShowBindings("");
        overlay.gameObject.SetActive(false);
    }

    private void BuildAudiencePanel(RectTransform frame)
    {
        audiencePanel = Position(Rounded(frame, "Takip ve beğeni", Raised).rectTransform, 28, 205, 750, 163);
        TextAt(audiencePanel, "Takip ve beğeni", "Takip ve beğeni", 13, 3, 226, 36, 22).color = MenuUi.Brass;
        TextAt(audiencePanel, "Eşik", "Beğeni / kişi", 242, 5, 148, 42, 16).color = Muted;
        likeThreshold = ValueField(audiencePanel, 394, 7, 104, 42, false);
        likeThreshold.contentType = InputField.ContentType.IntegerNumber;
        likeThreshold.characterLimit = 6;
        likeThreshold.text = audience.LikeThreshold.ToString(CultureInfo.InvariantCulture);
        audienceStatus = TextAt(audiencePanel, "Ayar durumu", "", 507, 7, 125, 42, 14);
        StyleChoice(RoundedButton(audiencePanel, "Kaydet", 642, 7, 94, 42, SaveAudience), true);
        followRow = BuildAudienceRow("Yeni takip", 57, audience.Follow);
        likeRow = BuildAudienceRow("Beğenide", 106, audience.Like);

        audienceChoices = Position(Rounded(frame, "Eylem seçimi", Raised).rectTransform, 28, 414, 750, 294);
        TextAt(audienceChoices, "Başlık", "Eylemi seç", 14, 4, 310, 40, 22).color = MenuUi.Brass;
        RoundedButton(audienceChoices, "Vazgeç", 619, 7, 118, 36, CloseAudienceChoices);
        var option = 0;
        for (var index = -1; index < actionNames.Length; index++)
        {
            if (index == BindingFile.FastPunchTwo) continue;
            var action = index;
            RoundedButton(audienceChoices, action < 0 ? "Kapalı" : actionNames[action],
                13 + (option % 3) * 244, 52 + (option / 3) * 47, 234, 40, () => SelectAudienceAction(action));
            option++;
        }
        audienceChoices.gameObject.SetActive(false);
    }

    [HideFromIl2Cpp]
    private AudienceRow BuildAudienceRow(string title, int y, ActionSelection? selection)
    {
        var panel = audiencePanel!;
        TextAt(panel, title, title, 13, y, 123, 42, 17);
        AudienceRow? row = null;
        var action = RoundedButton(panel, "Kapalı ▾", 139, y, 216, 42, () => OpenAudienceChoices(row!));
        var tool = RoundedButton(panel, "Matkap", 365, y, 114, 42, () =>
        {
            row!.Tool = (row.Tool + 1) % ToolNames.Length;
            UpdateAudienceRow(row);
        });
        var amountLabel = TextAt(panel, "Değer", "", 483, y, 82, 42, 13);
        var amount = ValueField(panel, 570, y, 53, 42, false);
        var speedLabel = TextAt(panel, "Hız", "Hız", 633, y, 48, 42, 13);
        var speed = ValueField(panel, 682, y, 53, 42, true);
        amount.text = (selection?.Amount ?? 1).ToString(CultureInfo.InvariantCulture);
        speed.text = FormatSpeed(selection?.Speed ?? Plugin.PunchSpeed.Value);
        row = new AudienceRow(action, tool, amount, speed, amountLabel, speedLabel)
            { Action = selection?.Action ?? -1, Tool = selection?.Tool ?? 0 };
        UpdateAudienceRow(row);
        return row;
    }

    [HideFromIl2Cpp]
    private void OpenAudienceChoices(AudienceRow row)
    {
        editingAudience = row;
        giftToolbar!.gameObject.SetActive(false);
        savedActions!.gameObject.SetActive(false);
        audienceChoices!.gameObject.SetActive(true);
        panelFrame!.sizeDelta = new Vector2(810, Mathf.Max(725, panelFrame.sizeDelta.y));
    }

    private void SelectAudienceAction(int action)
    {
        editingAudience!.Action = action;
        UpdateAudienceRow(editingAudience);
        audienceStatus!.text = "";
        CloseAudienceChoices();
    }

    private void CloseAudienceChoices() => ShowBindings("");

    [HideFromIl2Cpp]
    private void UpdateAudienceRow(AudienceRow row)
    {
        var action = row.Action;
        row.ActionButton.GetComponentInChildren<Text>(true).text = (action < 0 ? "Kapalı" : actionNames[action]) + " ▾";
        row.ToolButton.GetComponentInChildren<Text>(true).text = ToolNames[row.Tool] + " ▾";
        row.ToolButton.gameObject.SetActive(action == 1);
        row.AmountLabel.text = action switch
        {
            6 => "Blok",
            BindingFile.Uncuff => "Koruma",
            _ when BindingFile.IsTimed(action) => "Saniye",
            _ => AmountLabel(action),
        };
        row.AmountLabel.gameObject.SetActive(action >= 0);
        row.Amount.gameObject.SetActive(action >= 0);
        row.Amount.interactable = !BindingFile.IsEscapeAction(action);
        if (!row.Amount.interactable) row.Amount.text = "1";
        row.SpeedLabel.gameObject.SetActive(action == BindingFile.FastPunch);
        row.Speed.gameObject.SetActive(action == BindingFile.FastPunch);
    }

    private void ShowAudiencePanel(bool visible)
    {
        audiencePanel!.gameObject.SetActive(visible);
        goalPanel?.gameObject.SetActive(visible);
        audienceChoices!.gameObject.SetActive(false);
        editingAudience = null;
        giftToolbar!.gameObject.SetActive(true);
        giftToolbar.anchoredPosition = new Vector2(28, visible ? -423 : -213);
    }

    private void SaveAudience()
    {
        if (!int.TryParse(likeThreshold!.text, out var threshold) || threshold is < 1 or > AudienceSettings.MaxThreshold)
        {
            audienceStatus!.text = "Eşik 1–100.000 olmalı.";
            return;
        }
        if (!TryReadAudience(followRow!, out var follow) || !TryReadAudience(likeRow!, out var like)) return;
        var updated = new AudienceSettings(threshold, like, follow);
        try
        {
            BindingFile.WriteAtomic(audiencePath, updated);
            if (updated.LikeThreshold != audience.LikeThreshold || updated.Like != audience.Like) audienceProgress.ResetLikes();
            audience = updated;
            audienceStatus!.text = "Kaydedildi.";
            formStatus!.text = "";
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            audienceStatus!.text = "Kaydedilemedi.";
            Plugin.Output.LogWarning(error.Message);
        }
    }

    [HideFromIl2Cpp]
    private bool TryReadAudience(AudienceRow controls, out ActionSelection? selection)
    {
        selection = null;
        var action = controls.Action;
        if (action < 0) return true;
        var selected = new Binding(action, "", 1, action == 1 ? controls.Tool : 0);
        if (!TryReadRow(selected, new BindingDraft("", controls.Amount.text, controls.Speed.text), out var row)) return false;
        selection = new ActionSelection(row.Action, row.Amount, row.Tool, row.Speed);
        return true;
    }

    private static bool HasFocusedField()
    {
        var selected = UnityEngine.EventSystems.EventSystem.current?.currentSelectedGameObject;
        return selected != null && selected.GetComponent<InputField>()?.isFocused == true;
    }

    private void Open()
    {
        try
        {
            if (overlay == null) BuildPanel();
            if (overlay!.gameObject.activeSelf) return;
            previousCursor = Cursor.visible; previousLock = Cursor.lockState;
            blockedMotor = PlayerState.Local?.Motor;
            if (blockedMotor != null)
            {
                wasInputEnabled = blockedMotor.InputEnabled;
                blockedMotor.InputEnabled = false;
                blockedInput = blockedMotor.Input?.TryCast<InputSystemPlayerInput>();
                if (blockedInput != null)
                {
                    previousInputContext = blockedInput.Context;
                    previousAutoLock = blockedInput.autoLockCursor;
                    blockedInput.autoLockCursor = false;
                    blockedInput.Context = InputContext.Menu;
                }
            }
            Cursor.lockState = CursorLockMode.None; Cursor.visible = true;
            RefreshToolStatus();
            overlay.gameObject.SetActive(true);
            Plugin.Output.LogInfo(blockedMotor != null ? "Live panel opened in play." : "Live panel opened in menu.");
        }
        catch (Exception error) { Plugin.Output.LogError(error); }
    }

    private void Close()
    {
        if (UnityEngine.EventSystems.EventSystem.current?.currentSelectedGameObject is { } selected &&
            selected != null && selected.GetComponent<InputField>() is { } field && field != null)
            field.DeactivateInputField();
        if (overlay != null) overlay.gameObject.SetActive(false);
        if (escapePanel?.gameObject.activeSelf == true) ResetEscapePanel();
        if (blockedInput != null)
        {
            blockedInput.Context = previousInputContext;
            blockedInput.autoLockCursor = previousAutoLock;
            blockedInput = null;
        }
        if (blockedMotor != null) blockedMotor.InputEnabled = wasInputEnabled;
        blockedMotor = null;
        Cursor.lockState = previousLock; Cursor.visible = previousCursor;
    }

    private void OnDestroy()
    {
        VacuumInput.Release();
        DrillMark.Update(null);
        TunnelLighting.Dispose();
        EscapeFinale.Reset();
        PunchEffects.SetState(null, 1f, false);
        EscapeAudio.Dispose();
        PunchEffects.Dispose();
        CellDecor.Reset();
        worldActions.Dispose();
        if (activeTuning != null)
        {
            activeTuning.baseDamage = baseDamage;
            activeTuning.serverPunchesPerSecond = basePunchRate;
        }
        foreach (var texture in giftTextures.Values) UObj.Destroy(texture);
        if (roundedSprite != null)
        {
            UObj.Destroy(roundedSprite.texture);
            UObj.Destroy(roundedSprite);
        }
        bridge.Dispose();
    }

    private void Connect()
    {
        var name = account?.text.Trim().TrimStart('@') ?? "";
        if (name.Length is < 2 or > 32 || name.Any(ch => !(ch is >= '0' and <= '9' or >= 'a' and <= 'z' or >= 'A' and <= 'Z' or '_' or '.')))
        {
            SetStatus("Geçerli bir TikTok kullanıcı adı gir.");
            return;
        }
        try { bridge.Connect(name); SetStatus("Yayın aranıyor…"); }
        catch (Exception error) { SetStatus("Yayın bağlantısı başlatılamadı."); Plugin.Output.LogWarning(error.Message); }
    }

    private void UpdateLive()
    {
        var player = PlayerState.Local;
        if (player?.Pointer != currentPlayer?.Pointer)
        {
            EscapeFinale.Reset();
            worldActions.StopHelper();
            worldActions.ClearRebuild();
            currentPlayer = player;
            UpgradeDurability.Reset();
            player?.Look?.SetFov(GameSettings.VerticalFov);
            toolSlot = -1; equippedToolId = 0; hasPreviousToolSelection = false; toolTier = 0; swapUntil = 0; boostUntil = 0; cuffUntil = 0;
            PunchEffects.SetHandTool(0);
            punchBoosts.Clear();
            leaving = false;
        }
        var now = Time.unscaledTime;
        var speed = 1f;
        foreach (var boost in punchBoosts)
            if (boost.Value > now) speed = Mathf.Max(speed, boost.Key);
        if (boostUntil > 0 && boostUntil <= now) { punchBoosts.Clear(); boostUntil = 0; }
        var tuning = player != null && PywoNetworkManager.Instance?.SoloLobby == true ? PunchTuning.Current : null;
        PunchEffects.SetState(PywoNetworkManager.Instance?.SoloLobby == true ? player : null, speed, cuffUntil > now);
        if (tuning?.Pointer != activeTuning?.Pointer)
        {
            if (activeTuning != null)
            {
                activeTuning.baseDamage = baseDamage;
                activeTuning.serverPunchesPerSecond = basePunchRate;
            }
            activeTuning = tuning;
            if (tuning != null)
            {
                baseDamage = tuning.baseDamage;
                basePunchRate = tuning.serverPunchesPerSecond;
            }
        }
        if (activeTuning != null)
        {
            activeTuning.baseDamage = baseDamage * ActionTuning.BasePunchMultiplier;
            activeTuning.serverPunchesPerSecond = basePunchRate * (player == null ? speed : PunchEffects.PunchSpeed(player, speed));
        }
        EscapeBoundary.Poll(player);
        if (EscapeFinale.OpenPending(player)) worldActions.StopHelper();
        worldActions.Tick();
        if (player != null) worldActions.TickRebuild(player);
        if (swapUntil > 0 && Time.unscaledTime >= swapUntil)
        {
            swapUntil = player == null || SetTool(player.GetComponent<PlayerBelt>(), toolTier,
                toolTier == 0 ? 0 : ActionTuning.ProgressionTool(toolTier), upgrade: toolTier > 0)
                ? 0 : now + .75f;
        }
        if (player != null && PywoNetworkManager.Instance?.SoloLobby == true)
            for (var i = 0; i < 16 && !restartAfterEscape && deferredEvents.Count > 0; i++)
            {
                var deferred = deferredEvents.Dequeue();
                try
                {
                    if (deferred.Type == "gift") ApplyGift(deferred, player);
                    else ApplyAudience(deferred, player);
                }
                catch (Exception error) { Plugin.Output.LogError(error); }
            }
        for (var i = 0; i < 16 && bridge.Read(out var packet); i++)
        {
            if (packet == null) continue;
            try
            {
                if (packet.Type == "status")
                {
                    if (packet.Status == "connected") audienceProgress.EnterRoom(packet.RoomId);
                    liveText = packet.Status switch
                    {
                        "connected" => "Yayın bağlı · @" + packet.Username,
                        "connecting" => "Yayın aranıyor…",
                        "waiting" or "error" => packet.Message ?? "Yayın bağlantısı kurulamadı.",
                        _ => "Yayın bağlı değil.",
                    };
                    SetStatus(liveText);
                }
                else if (!restartAfterEscape && player != null && PywoNetworkManager.Instance?.SoloLobby == true)
                {
                    if (packet.Type == "gift") ApplyGift(packet, player);
                    else ApplyAudience(packet, player);
                }
                else if (restartAfterEscape && packet.Type is ("gift" or "like" or "follow"))
                {
                    deferredEvents.Enqueue(packet);
                }
            }
            catch (Exception error) { Plugin.Output.LogError(error); }
        }
    }

    [Il2CppInterop.Runtime.Attributes.HideFromIl2Cpp]
    private void ApplyGift(LiveBridge.Packet packet, PlayerState player)
    {
        if (string.IsNullOrEmpty(packet.EventId)) return;
        var keys = packet.Keys is { Length: > 0 } ? packet.Keys : new[] { packet.EventId };
        if (keys.Any(seen.Contains) || seen.Count >= 40000) return;
        foreach (var key in keys) seen.Add(key);
        var matches = bindings.Where(row => row.GiftId == packet.GiftId).ToArray();
        if (!matches.Any(row => row.Action == BindingFile.StartEscape)) EscapeFinale.Gift();
        foreach (var row in matches)
        {
            if (restartAfterEscape) break;
            ApplyLiveAction(player, new ActionSelection(row.Action, row.Amount, row.Tool, row.Speed),
                Math.Max(1, packet.RepeatCount), "Hediye");
        }
    }

    [HideFromIl2Cpp]
    private void ApplyAudience(LiveBridge.Packet packet, PlayerState player)
    {
        if (packet.Type is not ("like" or "follow")) return;
        var action = packet.Type == "like" ? audience.Like : audience.Follow;
        if (action == null) return;
        var times = audienceProgress.Count(packet.Type, packet.SenderId, packet.EventId, packet.LikeCount, audience.LikeThreshold);
        if (times > 0) ApplyLiveAction(player, action, times, packet.Type == "like" ? "Beğeni" : "Takip");
    }

    [HideFromIl2Cpp]
    private void ApplyLiveAction(PlayerState player, ActionSelection selection, int times, string source)
    {
        var count = ActionTuning.RepeatAmount(selection.Action, selection.Amount, times);
        var result = ExecuteAction(player, selection.Action, count, selection.Tool, selection.Speed, times);
        if (!BindingFile.IsTimed(selection.Action) || !result.EndsWith(" sn")) ShowActionNotice(result);
        Plugin.Output.LogInfo($"{source} eylemi · {actionNames[selection.Action]} · {result}");
    }

    private string ExecuteAction(PlayerState player, int action, int count, int tool, float? multiplier, int times = 1)
    {
        var belt = player.GetComponent<PlayerBelt>();
        switch (action)
        {
            case BindingFile.FastPunch:
                if (activeTuning == null) return "Yumruk henüz hazır değil.";
                var speed = multiplier ?? Plugin.PunchSpeed.Value;
                var until = Time.unscaledTime + count;
                punchBoosts[speed] = Mathf.Max(punchBoosts.GetValueOrDefault(speed), until);
                boostUntil = Mathf.Max(boostUntil, until);
                return $"Hızlı yumruk ×{speed:0.#} · {count} sn";
            case 1:
                if (!SetTool(belt, Math.Max(toolTier, 1), tool)) return "Alet için kemerde boş yer gerekli.";
                swapUntil = Time.unscaledTime + count;
                swapLabel = ToolNames[tool];
                return $"{ToolNames[tool]} · {count} sn";
            case 2:
            case 3:
                var next = Math.Clamp(toolTier + (action == 2 ? count : -count), 0, ActionTuning.MaxToolTier);
                var nextTool = ActionTuning.ProgressionTool(next);
                if (!SetTool(belt, next, nextTool, upgrade: next > 0)) return "Alet için kemerde boş yer gerekli.";
                toolTier = next;
                swapUntil = 0;
                return $"{ToolNames[nextTool]} · {next}. kademe";
            case 4:
                var given = GiveDynamite(belt, Math.Min(20, count));
                return given == 0 ? "Kemer dolu veya dinamit hazır değil." : $"{given} dinamit eklendi.";
            case 5:
                var voxels = VoxelNet.Instance;
                if (voxels == null || !WorldActions.AimAtWall(player, voxels, out var hit)) return "Patlatmak için duvara nişan al.";
                var point = new Vector3(hit.point.x, hit.point.y, hit.point.z);
                var forward = player.ViewCamera.transform.forward;
                for (var blast = 0; blast < Math.Min(count, 5); blast++)
                    BlastService.ServerDetonate(point + forward * (.24f + blast * .36f), 1f, player.netId);
                return "Dinamit patlatıldı.";
            case 6:
                if (VoxelNet.Instance == null) return "Duvar henüz hazır değil.";
                var restored = worldActions.Rebuild(player, VoxelNet.Instance, count);
                return restored > 0 ? $"{restored} blok yerine dönüyor." : "Örmek için yakındaki açıklığa bak.";
            case BindingFile.RadialBlast:
                return RadialBlastAction.Execute(player, count, times);
            case 7:
                if (EscapeFinale.KeepsHud) return "Yardımcılar kazı tünelinde çağrılabilir.";
                if (VoxelNet.Instance == null) return "Duvar henüz hazır değil.";
                var joined = worldActions.StartHelpers(player, VoxelNet.Instance, count, times);
                return joined > 0 ? $"{joined} yardımcı kazıya katıldı · {count} sn" :
                    "Yardımcı için yanında ayakta durabileceği boş bir yer gerekli.";
            case BindingFile.Cuff:
                cuffUntil = Mathf.Max(cuffUntil, Time.unscaledTime) + count;
                VacuumInput.Release();
                PunchEffects.SetLocked(true);
                return $"Kelepçe · {count} sn";
            case BindingFile.Uncuff:
                var now = Time.unscaledTime;
                if (cuffUntil <= now) return "Kelepçe takılı değil.";
                cuffUntil = ActionTuning.ReduceCuffs(cuffUntil, now, count);
                if (cuffUntil > now) return $"Kelepçe {count} sn kısaldı · {Mathf.CeilToInt(cuffUntil - now)} sn kaldı";
                PunchEffects.SetLocked(false);
                return "Kelepçe kırıldı.";
            case BindingFile.ReturnToCell:
                var position = Vector3.zero;
                var yaw = 0f;
                if (!RespawnPoints.TryGet(player.slot, out position, out yaw))
                    return "Başlangıç hücresi henüz hazır değil.";
                EscapeFinale.Gift();
                worldActions.StopHelper();
                worldActions.ClearRebuild();
                player.Motor.ServerTeleport(position, yaw, true);
                return "Hücreye dönüldü · kazı ilerlemesi korundu.";
            case BindingFile.RestartRun:
                EscapeFinale.Gift();
                BeginNewRun();
                return "Yeni kazı başlıyor.";
            case BindingFile.StartEscape:
                if (EscapeFinale.KeepsHud || EscapeFinale.IsPending) return "Kaçış zaten başladı.";
                EscapeFinale.Contact(player, "Kaçış eylemi");
                return "Kaçış başlıyor.";
            default:
                return "Eylem bulunamadı.";
        }
    }
    private static int GiveDynamite(PlayerBelt? belt, int count)
    {
        if (belt == null || !belt.isServer) return 0;
        var definition = ItemDatabase.Get("dynamite");
        if (definition == null) return 0;
        var added = 0;
        for (; added < count; added++)
        {
            if (!belt.ServerAdd(definition.NewStack(1, 10), out _, out var slot)) break;
            if (added == 0)
            {
                if (slot < 0 || slot >= belt.slots.Count || belt.Get(slot).Definition?.id != "dynamite")
                    slot = Enumerable.Range(0, belt.slots.Count)
                        .FirstOrDefault(index => belt.Get(index).Definition?.id == "dynamite", -1);
                if (slot >= 0) belt.ServerSelect((sbyte)slot);
            }
        }
        return added;
    }

    private bool SetTool(PlayerBelt? belt, int tier, int tool, bool upgrade = false)
    {
        if (belt == null || !belt.isServer) return false;
        VacuumInput.Release();
        if (toolSlot >= 0 && belt.Get(toolSlot).ItemId != equippedToolId) toolSlot = -1;
        var ownedSlot = UpgradeDurability.SlotIn(belt);
        var handTool = tool is 2 or 3 or 4 or 5;
        if (tier == 0 || (upgrade && handTool))
        {
            UpgradeDurability.Reset();
            if (ownedSlot >= 0) belt.ServerSetSlot(ownedSlot, ItemStack.Empty);
            ownedSlot = -1;
        }
        var selectOwnedDrill = ownedSlot >= 0 && tool == 0;
        if (toolSlot >= 0 && (tier == 0 || handTool || selectOwnedDrill))
        {
            belt.ServerSetSlot(toolSlot, ItemStack.Empty);
            toolSlot = -1;
            equippedToolId = 0;
        }
        if (tier == 0 || handTool)
        {
            if (handTool && !hasPreviousToolSelection)
            {
                previousToolSelection = belt.selected;
                hasPreviousToolSelection = true;
            }
            PunchEffects.SetHandTool(tool is 3 or 4 or 5 ? tool : 0);
            if (handTool) belt.ServerSelect(-1);
            else if (hasPreviousToolSelection)
            {
                belt.ServerSelect(previousToolSelection);
                hasPreviousToolSelection = false;
            }
            return true;
        }

        if (selectOwnedDrill)
        {
            PunchEffects.SetHandTool(0);
            belt.ServerSelect((sbyte)ownedSlot);
            return true;
        }
        var definition = ItemDatabase.Get(tool == 1 ? "dynamite" : "jackhammer");
        if (definition == null) return false;
        if (toolSlot < 0)
        {
            for (var slot = 0; slot < PlayerBelt.BeltSlots; slot++)
            {
                if (!belt.Get(slot).IsEmpty) continue;
                toolSlot = slot;
                if (!hasPreviousToolSelection)
                {
                    previousToolSelection = belt.selected;
                    hasPreviousToolSelection = true;
                }
                break;
            }
        }
        if (toolSlot < 0) return false;
        PunchEffects.SetHandTool(0);
        equippedToolId = definition.NetworkId;
        var stack = definition.NewStack(1, tool == 1 ? (byte)10 : (byte)(6 + tier * 4));
        belt.ServerSetSlot(toolSlot, stack);
        belt.ServerSelect((sbyte)toolSlot);
        if (upgrade && tool == 0)
        {
            UpgradeDurability.Track(belt, toolSlot, stack);
            // toolSlot only owns the temporary native item. A timed swap holsters the earned drill.
            toolSlot = -1;
            equippedToolId = 0;
        }
        return true;
    }
    private static string GiftName(Gift gift) => gift.TrName ?? gift.Name ?? gift.Id;
    private void RefreshGifts(string search)
    {
        var query = search.Trim();
        matchingGifts = query.Length == 0 ? gifts : gifts.Where(gift =>
            gift.Id.Contains(query, StringComparison.Ordinal) ||
            GiftName(gift).Contains(query, StringComparison.CurrentCultureIgnoreCase) ||
            (gift.Name?.Contains(query, StringComparison.OrdinalIgnoreCase) ?? false)).ToArray();
        giftPage = 0;
        RenderGifts();
    }

    private int LastGiftPage => Math.Max(0, (matchingGifts.Length - 1) / GiftsPerPage);

    private void ChangeGiftPage(int step)
    {
        var next = Math.Clamp(giftPage + step, 0, LastGiftPage);
        if (next == giftPage) return;
        giftPage = next;
        RenderGifts();
    }

    private void RenderGifts()
    {
        if (giftGrid == null || giftPageText == null) return;
        foreach (var tile in giftTiles)
        {
            tile.SetActive(false);
            UObj.Destroy(tile);
        }
        giftTiles.Clear();
        giftChoices.Clear();
        giftPageText.text = matchingGifts.Length == 0 ? "Sonuç yok" : $"{giftPage + 1} / {LastGiftPage + 1}";
        var first = giftPage * GiftsPerPage;
        for (var index = 0; index < GiftsPerPage && first + index < matchingGifts.Length; index++)
        {
            var gift = matchingGifts[first + index];
            var tile = RoundedButton(giftGrid, "", (index % 4) * 187, (index / 4) * 63, 177, 54, () => SelectGift(gift));
            var rect = tile.GetComponent<RectTransform>();
            giftTiles.Add(tile.gameObject);
            giftChoices.Add((tile, gift.Id));
            DrawGiftIcon(rect, gift, 7, 9, 36);
            GiftLabel(rect, GiftName(gift), 3, 31, 13);
            GiftLabel(rect, $"{gift.Coins} coin", 35, 16, 12);
            StyleChoice(tile, gift.Id == chosenGift?.Id);
        }
    }

    [HideFromIl2Cpp]
    private void SelectGift(Gift gift)
    {
        chosenGift = gift;
        chosenGiftText!.text = $"{GiftName(gift)} · {gift.Coins} coin";
        chosenGiftText.color = MenuUi.Brass;
        foreach (var choice in giftChoices) StyleChoice(choice.Button, choice.Id == gift.Id);
    }

    [HideFromIl2Cpp]
    private void DrawGiftIcon(RectTransform card, Gift? gift, int x, int y, int size)
    {
        var texture = gift == null ? null : LoadGiftTexture(gift);
        if (texture == null)
        {
            TextAt(card, "Hediye simgesi", "◇", x, y, size, size, 21).color = Muted;
            return;
        }
        var icon = MenuUi.Rect("Hediye görseli", card).gameObject.AddComponent<RawImage>();
        icon.raycastTarget = false;
        icon.texture = texture;
        Position(icon.rectTransform, x, y, size, size);
    }

    [HideFromIl2Cpp]
    private Texture2D? LoadGiftTexture(Gift gift)
    {
        if (giftTextures.TryGetValue(gift.Id, out var cached) && cached != null) return cached;
        if (gift.File == null || !BindingFile.ValidGift(gift.Id) || gift.File != gift.Id + ".png") return null;
        var path = Path.Combine(giftImageDirectory, gift.File);
        byte[] bytes;
        try { bytes = File.ReadAllBytes(path); }
        catch (IOException) { return null; }
        catch (UnauthorizedAccessException) { return null; }
        var texture = new Texture2D(2, 2, TextureFormat.RGBA32, false);
        if (!ImageConversion.LoadImage(texture, new Il2CppInterop.Runtime.InteropTypes.Arrays.Il2CppStructArray<byte>(bytes), false))
        {
            UObj.Destroy(texture);
            return null;
        }
        texture.name = "TikMnG Gift " + gift.Id;
        texture.wrapMode = TextureWrapMode.Clamp;
        texture.filterMode = FilterMode.Bilinear;
        texture.Apply(false, true);
        if (giftTextures.Count >= 96)
        {
            var active = matchingGifts.Skip(giftPage * GiftsPerPage).Take(GiftsPerPage)
                .Select(entry => entry.Id).ToHashSet();
            foreach (var row in bindings.AsEnumerable().Reverse().Skip(savedPage * SavedActionsPerPage).Take(SavedActionsPerPage))
                active.Add(DraftFor(row).GiftId);
            var unused = giftTextures.FirstOrDefault(entry => !active.Contains(entry.Key));
            if (unused.Key != null)
            {
                giftTextures.Remove(unused.Key);
                UObj.Destroy(unused.Value);
            }
        }
        giftTextures[gift.Id] = texture;
        return texture;
    }
    private void SetStatus(string message) { if (status != null) status.text = message; }

    private void BeginBinding()
    {
        settings!.gameObject.SetActive(false);
        if (actionButtons!.gameObject.activeSelf && pickingFor == null) return;
        OpenBindingEditor(null);
    }

    [HideFromIl2Cpp]
    private void OpenBindingEditor(Binding? row)
    {
        ShowAudiencePanel(false);
        pickingFor = row;
        var initial = row == null ? null : DraftFor(row);
        chosenGift = null;
        chosenGiftText!.text = "Hediye seçilmedi.";
        chosenGiftText.color = Muted;
        giftId!.SetTextWithoutNotify("");
        RefreshGifts("");
        amount!.text = initial?.Amount ?? "1";
        speedField!.text = initial?.Speed ?? FormatSpeed(Plugin.PunchSpeed.Value);
        SelectTool(row?.Tool ?? 0);
        SelectAction(row?.Action ?? BindingFile.FastPunch);
        if (initial != null && Array.Find(gifts, candidate => candidate.Id == initial.GiftId) is { } gift)
            SelectGift(gift);
        foreach (var button in actionChoices)
            if (button != null) button.interactable = row == null || button == actionChoices[chosenAction];
        foreach (var button in toolButtons) button.interactable = row == null || button == toolButtons[chosenTool];
        formStatus!.text = row == null ? "Eylemi ve hediyeyi seç, ardından Kaydet’e bas." :
            "Yeni hediyeyi seç, ardından Kaydet’e bas.";
        savedActions!.gameObject.SetActive(false);
        actionButtons!.gameObject.SetActive(true);
        panelFrame!.sizeDelta = new Vector2(810, 865);
    }

    private void SelectAction(int index)
    {
        if (index == BindingFile.RadialBlast && chosenAction != index && pickingFor == null && amount!.text == "1")
            amount.text = "3";
        chosenAction = index;
        speedLabel!.gameObject.SetActive(index == BindingFile.FastPunch);
        speedField!.gameObject.SetActive(index == BindingFile.FastPunch);
        amountLabel!.text = AmountLabel(index);
        amount!.interactable = !BindingFile.IsEscapeAction(index);
        if (!amount.interactable) amount.text = "1";
        toolChoices!.gameObject.SetActive(index == 1);
        for (var option = 0; option < actionChoices.Length; option++)
            if (actionChoices[option] != null) StyleChoice(actionChoices[option], option == index);
    }

    private void SelectTool(int index)
    {
        chosenTool = index;
        for (var option = 0; option < toolButtons.Length; option++)
            StyleChoice(toolButtons[option], option == index);
    }

    private static string AmountLabel(int index) => index switch
    {
        BindingFile.Uncuff => "Azalt (sn)",
        BindingFile.FastPunch or 1 or 7 or BindingFile.Cuff => "Süre (sn)",
        2 or 3 => "Kademe",
        6 => "Blok sayısı",
        BindingFile.RadialBlast => "Yarıçap (m)",
        _ when BindingFile.IsEscapeAction(index) => "Eylem",
        _ => "Adet",
    };

    private static string CurrentTool(PlayerState player)
    {
        if (VacuumInput.IsActive(player)) return "Vakum";
        var handTool = PunchEffects.HandTool(player);
        if (handTool is 3 or 4 or 5) return ToolNames[handTool];
        var id = player.GetComponent<PlayerBelt>()?.SelectedStack.Definition?.id;
        return id switch
        {
            null or "" => "Yumruk",
            "jackhammer" => "Matkap",
            "dynamite" => "Dinamit",
            "pickaxe" => "Kazma",
            "shovel" => "Kürek",
            _ => id,
        };
    }

    private void RefreshToolStatus()
    {
        if (toolStatus == null) return;
        var player = PlayerState.Local;
        toolStatus.text = player == null ? "" : "Eldeki alet · " + CurrentTool(player);
    }

    private void OpenSettings()
    {
        ShowAudiencePanel(false);
        savedActions!.gameObject.SetActive(false);
        actionButtons!.gameObject.SetActive(false);
        settings!.gameObject.SetActive(true);
        panelFrame!.sizeDelta = new Vector2(810, 586);
        formStatus!.text = "";
        RefreshSettingLabels();
    }

    [HideFromIl2Cpp]
    private Text SettingRow(string title, int y, Action<int> change)
    {
        var label = TextAt(settings!, title, "", 0, y, 490, 44, 20);
        RoundedButton(settings!, "−", 506, y, 60, 44, () => change(-1));
        RoundedButton(settings!, "+", 577, y, 60, 44, () => change(1));
        return label;
    }

    private void RefreshSettingLabels()
    {
        fovStatus!.text = $"Yatay görüş açısı · {Plugin.FieldOfView.Value}°";
        distanceStatus!.text = $"Kazı mesafesi · {Plugin.ExcavationMetres.Value} m";
    }

    private void ChangeExcavationDistance(int step)
    {
        Plugin.ExcavationMetres.Value = Math.Clamp(Plugin.ExcavationMetres.Value + step * 5,
            RouteLength.Minimum, RouteLength.Maximum);
        RefreshSettingLabels();
    }

    private void ChangeFieldOfView(int step)
    {
        Plugin.FieldOfView.Value = Mathf.Clamp(Plugin.FieldOfView.Value + step * 5, 80, 115);
        PlayerState.Local?.Look?.SetFov(GameSettings.VerticalFov);
        RefreshSettingLabels();
    }

    private void SaveGoal()
    {
        if (!int.TryParse(goalField?.text, out var value) || value is < 1 or > 9999)
        {
            formStatus!.text = "Kaçış hedefi 1 ile 9999 arasında olmalı.";
            return;
        }
        Plugin.EscapeGoal.Value = value;
        formStatus!.text = "Kaçış hedefi kaydedildi.";
    }

    private void ShowBindings(string message)
    {
        ShowAudiencePanel(true);
        pickingFor = null;
        settings!.gameObject.SetActive(false);
        actionButtons!.gameObject.SetActive(false);
        savedActions!.gameObject.SetActive(true);
        formStatus!.text = message;
        RefreshBindings();
    }

    private void RefreshBindings()
    {
        var lastPage = Math.Max(0, (bindings.Count - 1) / SavedActionsPerPage);
        savedPage = Math.Clamp(savedPage, 0, lastPage);
        foreach (var oldRow in savedRows)
        {
            oldRow.SetActive(false);
            UObj.Destroy(oldRow);
        }
        savedRows.Clear();
        emptyActions!.gameObject.SetActive(bindings.Count == 0);
        var rows = bindings.AsEnumerable().Reverse().Skip(savedPage * SavedActionsPerPage).Take(SavedActionsPerPage);
        foreach (var row in rows)
        {
            var draft = DraftFor(row);
            var gift = Array.Find(gifts, candidate => candidate.Id == draft.GiftId);
            var card = Position(Rounded(savedActions!, "Eylem kaydı", Raised).rectTransform,
                0, 48 + savedRows.Count * 56, 736, 48);
            savedRows.Add(card.gameObject);
            DrawGiftIcon(card, gift, 12, 8, 32);
            var name = TextAt(card, "Hediye", gift == null ? draft.GiftId : GiftName(gift), 51, 0, 130, 48, 15);
            name.verticalOverflow = VerticalWrapMode.Truncate;
            RoundedButton(card, "▾", 184, 6, 36, 36, () => OpenBindingEditor(row));
            var toolName = row.Action == 1 ? ToolNames[row.Tool] : row.Action is 2 or 3 ? "Alet kademesi" : "";
            var title = row.Action == BindingFile.Uncuff ? "Kelepçe azalt" : actionNames[row.Action];
            var actionText = TextAt(card, "Eylem", title, 231, 2, 176, toolName.Length > 0 ? 23 : 44, 15);
            if (toolName.Length > 0) TextAt(card, "Alet", toolName, 231, 23, 176, 22, 12).color = Muted;
            actionText.verticalOverflow = VerticalWrapMode.Truncate;
            var key = (row.Action, row.GiftId);
            var unit = BindingFile.IsTimed(row.Action) ? "sn" : row.Action == 6 ? "blok" :
                row.Action == BindingFile.RadialBlast ? "m" : AmountLabel(row.Action).ToLowerInvariant();
            var wallAmount = row.Action == 6;
            var field = ValueField(card, 409, 6, wallAmount ? 84 : 55, 36, false);
            field.text = draft.Amount;
            var unitText = TextAt(card, "Birim", unit, wallAmount ? 499 : 469, 0, 45, 48, 11);
            unitText.horizontalOverflow = HorizontalWrapMode.Overflow;
            unitText.color = Muted;
            TrackField(field, value => pendingRows[key] = DraftFor(row) with { Amount = value });
            if (row.Action == BindingFile.FastPunch)
            {
                var speed = ValueField(card, 507, 6, 47, 36, true);
                speed.text = draft.Speed;
                TextAt(card, "Çarpan", "×", 557, 0, 20, 48, 14).color = Muted;
                TrackField(speed, value => pendingRows[key] = DraftFor(row) with { Speed = value });
            }
            RoundedButton(card, "Dene", 584, 6, 67, 36, () =>
            {
                if (TryReadRow(row, DraftFor(row), out var current))
                    TestAction(current.Action, current.Amount, current.Tool, current.Speed);
            });
            RoundedButton(card, "Sil", 659, 6, 62, 36, () => RemoveBinding(row));
        }
        var showPages = lastPage > 0;
        savedPageText!.text = showPages ? $"{savedPage + 1} / {lastPage + 1}" : "";
        previousSavedPage!.gameObject.SetActive(showPages);
        nextSavedPage!.gameObject.SetActive(showPages);
        previousSavedPage.interactable = savedPage > 0;
        nextSavedPage.interactable = savedPage < lastPage;
        panelFrame!.sizeDelta = new Vector2(810, showPages ? 885 : Math.Max(575, 540 + savedRows.Count * 56));
    }

    private void AddBinding()
    {
        if (chosenGift == null) { formStatus!.text = "Kaydetmek için katalogdan bir hediye seç."; return; }
        if (!TryReadRow(DraftAction(), new BindingDraft(chosenGift.Id, amount!.text, speedField!.text), out var row)) return;
        try
        {
            if (pickingFor is { } original)
            {
                var key = (original.Action, original.GiftId);
                if (!BindingFile.UpdateRows(dataPath, bindings, new Dictionary<(int, string), Binding> { [key] = row }, actionNames.Length))
                {
                    formStatus!.text = "Bu hediye aynı eyleme zaten bağlı.";
                    return;
                }
                pendingRows.Remove(key);
            }
            else
            {
                if (!BindingFile.TrySave(dataPath, bindings, row, actionNames.Length))
                {
                    formStatus!.text = "En fazla 30 eşleştirme kaydedilebilir.";
                    return;
                }
                pendingRows.Remove((row.Action, row.GiftId));
                savedPage = 0;
            }
            ShowBindings("Eşleştirme kaydedildi.");
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            formStatus!.text = "Eşleştirme kaydedilemedi. Tekrar deneyebilirsin.";
            Plugin.Output.LogWarning(error.Message);
        }
    }

    [HideFromIl2Cpp]
    private Binding DraftAction() => new(chosenAction, chosenGift?.Id ?? "", 1, chosenAction == 1 ? chosenTool : 0);

    private void TestDraft()
    {
        var action = DraftAction();
        if (TryReadRow(action, new BindingDraft(action.GiftId, amount!.text, speedField!.text), out var row))
            TestAction(row.Action, row.Amount, row.Tool, row.Speed);
    }

    private void TestAction(int action, int count, int tool, float? speed)
    {
        var player = PlayerState.Local;
        if (player == null || PywoNetworkManager.Instance?.SoloLobby != true)
        {
            formStatus!.text = "Denemek için önce Oyuna Gir.";
            return;
        }
        try
        {
            var result = ExecuteAction(player, action, count, tool, speed);
            if (!BindingFile.IsTimed(action) || !result.EndsWith(" sn")) ShowActionNotice(result);
            Close();
            Plugin.Output.LogInfo($"Eylem denemesi · {actionNames[action]} · {result}");
        }
        catch (Exception error)
        {
            formStatus!.text = "Eylem denenemedi.";
            Plugin.Output.LogError(error);
        }
    }

    [HideFromIl2Cpp]
    private void RemoveBinding(Binding row)
    {
        try
        {
            if (!BindingFile.Remove(dataPath, bindings, row)) return;
            pendingRows.Remove((row.Action, row.GiftId));
            ShowBindings("Eşleştirme silindi.");
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            formStatus!.text = "Eşleştirme silinemedi. Tekrar deneyebilirsin.";
            Plugin.Output.LogWarning(error.Message);
        }
    }
    [HideFromIl2Cpp]
    private bool TryReadRow(Binding row, BindingDraft draft, out Binding result)
    {
        result = row;
        if (!int.TryParse(draft.Amount, out var count) || !BindingFile.ValidAmount(row.Action, count))
        {
            formStatus!.text = $"{AmountLabel(row.Action)} için 1–{BindingFile.MaximumAmount(row.Action)} arasında değer gir.";
            return false;
        }
        float? speed = null;
        if (row.Action == BindingFile.FastPunch)
        {
            if (!float.TryParse(draft.Speed.Replace(',', '.'), NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture,
                out var multiplier) || !BindingFile.ValidSpeed(multiplier))
            {
                formStatus!.text = "Yumruk hızı 1× ile 8× arasında olmalı.";
                return false;
            }
            speed = multiplier;
        }
        result = row with { GiftId = draft.GiftId, Amount = count, Speed = speed };
        return true;
    }

    private static string FormatSpeed(float speed) => speed.ToString("0.##", CultureInfo.InvariantCulture);

    [HideFromIl2Cpp]
    private BindingDraft DraftFor(Binding row) => pendingRows.TryGetValue((row.Action, row.GiftId), out var draft) ? draft :
        new BindingDraft(row.GiftId, row.Amount.ToString(), FormatSpeed(row.Speed ?? Plugin.PunchSpeed.Value));

    [HideFromIl2Cpp]
    private void TrackField(InputField field, Action<string> changed)
    {
        field.onValueChanged.AddListener(DelegateSupport.ConvertDelegate<UnityEngine.Events.UnityAction<string>>(
            (Action<string>)(value =>
            {
                changed(value);
                formStatus!.text = "Değişiklikleri uygulamak için Kaydet’e bas.";
            })));
    }

    private void SaveRows()
    {
        var edits = new Dictionary<(int, string), Binding>();
        foreach (var row in bindings)
        {
            var key = (row.Action, row.GiftId);
            if (!pendingRows.TryGetValue(key, out var draft)) continue;
            if (!TryReadRow(row, draft, out var updated)) return;
            edits.Add(key, updated);
        }
        try
        {
            if (!BindingFile.UpdateRows(dataPath, bindings, edits, actionNames.Length)) return;
            pendingRows.Clear();
            ShowBindings("Eylem değerleri kaydedildi.");
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            formStatus!.text = "Eylem değerleri kaydedilemedi.";
            Plugin.Output.LogWarning(error.Message);
        }
    }

    private void ShowActionNotice(string result)
    {
        if (actionNotice == null) return;
        actionNotice.text = result;
        noticeUntil = Time.unscaledTime + 3f;
        actionNotice.gameObject.SetActive(true);
    }

    private void RefreshTimerHud()
    {
        if (timerHud == null) return;
        var now = Time.unscaledTime;
        var label = "";
        if (PlayerState.Local != null)
        {
            AppendTime(ref label, "Hızlı yumruk", boostUntil, now);
            AppendTime(ref label, swapLabel, swapUntil, now);
            AppendTime(ref label, "Yardımcı", worldActions.HelperUntil, now);
            AppendTime(ref label, "Kelepçe", cuffUntil, now);
        }
        if (timerHud.text != label) timerHud.text = label;
        if (timerHud.gameObject.activeSelf != (label.Length > 0)) timerHud.gameObject.SetActive(label.Length > 0);
    }

    private static void AppendTime(ref string label, string title, float until, float now)
    {
        if (until <= now) return;
        if (label.Length > 0) label += "   •   ";
        label += $"{title} {Mathf.CeilToInt(until - now)} sn";
    }

    private void OpenEscape()
    {
        Open();
        if (overlay?.gameObject.activeSelf != true) return;
        for (var index = 0; index < panelFrame!.childCount; index++)
            panelFrame.GetChild(index).gameObject.SetActive(false);
        escapePanel!.gameObject.SetActive(true);
        panelFrame!.sizeDelta = new Vector2(670, 255);
        escapeStatus!.text = "İlerlemeni kaydedip ana menüye dönebilirsin.";
    }

    private void ResetEscapePanel()
    {
        for (var index = 0; index < panelFrame!.childCount; index++)
            panelFrame.GetChild(index).gameObject.SetActive(true);
        escapePanel!.gameObject.SetActive(false);
        ShowBindings("");
    }

    private void CancelExit()
    {
        if (!savePending && !leaving) Close();
    }

    private void SaveAndLeave()
    {
        if (savePending || leaving) return;
        var runner = SaveRunner.Instance;
        if (runner == null || runner.Restoring)
        {
            escapeStatus!.text = "Kayıt henüz hazır değil. Biraz sonra tekrar dene.";
            return;
        }
        savedWrites = runner.SavesWritten;
        saveRequestedAt = Time.unscaledTime;
        savePending = true;
        escapeStatus!.text = "Oyun kaydediliyor…";
        try
        {
            var result = runner.SaveNow("TikMnG save and leave");
            Plugin.Output.LogInfo($"Kaydet ve çık · {result}");
        }
        catch (Exception error)
        {
            savePending = false;
            escapeStatus!.text = "Oyun kaydedilemedi.";
            Plugin.Output.LogWarning(error.Message);
        }
    }

    private void UpdateSaveExit()
    {
        if (!savePending) return;
        var runner = SaveRunner.Instance;
        if (runner != null && runner.SavesWritten > savedWrites && !runner.Busy && !runner.LastWriteFailed)
        {
            savePending = false;
            leaving = true;
            Close();
            PywoNetworkManager.Instance?.LeaveToMenu();
            return;
        }
        if (runner != null && runner.Busy && Time.unscaledTime - saveRequestedAt < 30f) return;
        if (Time.unscaledTime - saveRequestedAt < 1.5f) return;
        savePending = false;
        escapeStatus!.text = "Kayıt tamamlanamadı. Tekrar deneyebilirsin.";
    }
}
