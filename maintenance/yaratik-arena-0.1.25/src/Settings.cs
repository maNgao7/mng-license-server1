using System.Text.Json;
using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private const int MaxPhysicalCreatures = 2500;

    private sealed class Settings
    {
        public string BroadcasterUsername { get; set; } = "";
        public bool AutoConnect { get; set; } = true;
        public int BloodColor { get; set; }
        public bool BloodEnabled { get; set; } = true;
        public bool HitMarker { get; set; }
        public float Volume { get; set; } = .6f;
        public float Sensitivity { get; set; } = 1;
        public int MaxCreatures { get; set; } = MaxPhysicalCreatures;
        public int PhysicalCreatures { get; set; } = MaxPhysicalCreatures;
        public bool TimedMode { get; set; } = true;
        public int RoundSeconds { get; set; } = 180;
        public int KillTarget { get; set; } = 500;
        public int WinGoal { get; set; } = 21;
        public int FirstWeaponKills { get; set; } = 60;
        public int WeaponKillStep { get; set; } = 20;
        public bool ComboEnabled { get; set; } = true;
        public bool GiftNoticesEnabled { get; set; } = true;
        // Retain obsolete side-goal keys for settings compatibility; the collection gauge replaces this goal.
        public bool CleanupGoalEnabled { get; set; } = true;
        public int CleanupTarget { get; set; } = 100;
        public bool RoundSummaryEnabled { get; set; } = true;
        public bool EnemyAttacks { get; set; } = true;
        public int CreatureDamage { get; set; } = 3;
        public bool PercentCombatAdded { get; set; }
        public bool NormalCombatV2Added { get; set; }
        public float CreatureAttackInterval { get; set; } = 1.2f;
        public float CreatureScale { get; set; } = 1.5f;
        public bool AudienceActionsAdded { get; set; }
        public int LikeThreshold { get; set; } = 100;
        public TriggerBinding LikeAction { get; set; } = new() { Enabled = true, Count = 5 };
        public TriggerBinding FollowAction { get; set; } = new() { Enabled = true, Count = 5 };
        public int PlayerHealth { get; set; } = CombatBalance.StartingHealth;
        public List<ActionBinding> Actions { get; set; } = new()
        {
            new() { Name = "Yaratik gonder", GiftId = "5655", Op = "spawn", Count = 2 },
            new() { Name = "Kalabalik gonder", GiftId = "5319", Op = "spawn", Count = 10 },
            new() { Name = "Buyuk dalga", GiftId = "5658", Op = "spawn", Count = 25 },
            new() { Name = "Silah dusur", GiftId = "5282", Op = "down", Count = 1 },
            new() { Name = "Silah yukselt", GiftId = "8913", Op = "up", Count = 1 },
            new() { Name = "Flash", GiftId = "17473", Op = "flash", Count = 3 },
            new() { Name = "Hapse at", GiftId = "6064", Op = "prison", Count = 1 },
            new() { Name = "Hapisten kurtar", GiftId = "5827", Op = "release", Count = 1 },
            new() { Name = "Big Boss / %650", GiftId = "7168", Op = "bigboss", Count = 1 },
            new() { Name = "Yaratik gonder", GiftId = "5303", Op = "spawn", Count = 50 },
            new() { Name = "Boss / %400", GiftId = "6427", Op = "boss", Count = 1 },
            new() { Name = "Destek / 20 can", GiftId = "7934", Op = "helper", Count = 1 }
        };
        public bool EffectsActionsAdded { get; set; }
    }
    private sealed class TriggerBinding : ActionBinding
    {
        public bool Enabled { get; set; }
    }
    private class ActionBinding
    {
        public string Name { get; set; } = "";
        public string GiftId { get; set; } = "";
        public string Op { get; set; } = "spawn";
        public int Count { get; set; } = 1;
    }
    private sealed class Gift
    {
        public string id { get; set; } = "";
        public string name { get; set; } = "";
        public string trName { get; set; } = "";
        public int coins { get; set; }
        public string file { get; set; } = "";
        public string Title => string.IsNullOrWhiteSpace(trName) ? name : trName;
    }
    private Settings settings = new();
    private List<Gift> gifts = new();
    private readonly Dictionary<string, Texture2D> giftTextures = new();
    private readonly Dictionary<string, string> giftSearchKeys = new();
    private int tab, bindingIndex = -1;
    private string search = "", testUser = "Deniz", selectedGift = "5655";
    private string focusedField = "";
    private readonly Dictionary<string, string> editBuffers = new();
    private readonly HashSet<string> selectedInputs = new();
    private bool menuRendered;
    private int menuGiftImages;
    private bool settingsDirty;
    private string savedAt = "";
    private string broadcasterDraft = "";

    private string EditField(Rect rect, string key, string value, int length, bool digits = false)
    {
        bool focused = focusedField == key;
        if (!focused || !editBuffers.ContainsKey(key)) editBuffers[key] = value;
        var input = Event.current;
        if (focused && input.type == EventType.KeyDown)
        {
            string buffer = editBuffers[key];
            if (input.control && input.keyCode == KeyCode.A) selectedInputs.Add(key);
            else if (input.control && input.keyCode == KeyCode.V)
            {
                try
                {
                    string pasted = GUIUtility.systemCopyBuffer ?? "";
                    pasted = new string(pasted.Where(c => c >= 32 && (!digits || char.IsDigit(c))).ToArray());
                    buffer = selectedInputs.Remove(key) ? pasted : buffer + pasted;
                    if (buffer.Length > length) buffer = buffer[..length];
                }
                catch { Notice("Yapistirma desteklenemedi; alana yazabilirsin."); }
            }
            else if (input.keyCode == KeyCode.Backspace) buffer = selectedInputs.Remove(key) ? "" : buffer.Length > 0 ? buffer[..^1] : "";
            else if (input.keyCode == KeyCode.Delete && selectedInputs.Remove(key)) buffer = "";
            else if (input.keyCode == KeyCode.Return || input.keyCode == KeyCode.Escape) focusedField = "";
            else if (input.character >= 32 && !input.control && (!digits || char.IsDigit(input.character)))
            {
                if (selectedInputs.Remove(key)) buffer = "";
                if (buffer.Length < length) buffer += input.character;
            }
            editBuffers[key] = buffer;
            input.Use();
        }
        string shown = editBuffers[key];
        if (GUI.Button(rect, shown + (focused ? "|" : ""), fieldStyle)) { focusedField = key; editBuffers[key] = value; }
        if (focused) Paint(new Rect(rect.x, rect.yMax - (selectedInputs.Contains(key) ? 4 : 2), rect.width, selectedInputs.Contains(key) ? 4 : 2), Accent);
        return editBuffers[key];
    }

    private void LoadSettings()
    {
        var file = Path.Combine(Data, "mod-settings.json");
        if (!File.Exists(file)) file = Path.Combine(Root, "defaults", "game-settings.json");
        if (File.Exists(file)) settings = JsonSerializer.Deserialize<Settings>(File.ReadAllText(file)) ?? new();
        settings.BroadcasterUsername ??= "";
        broadcasterDraft = settings.BroadcasterUsername;
        settings.Actions ??= new Settings().Actions;
        settings.Actions = settings.Actions.Where(a => a != null && ActionOps.Contains(a.Op)).Take(100).ToList();
        foreach (var action in settings.Actions)
        {
            action.GiftId ??= "";
            if (string.IsNullOrWhiteSpace(action.Name)) action.Name = ActionName(action.Op);
            action.Count = Math.Clamp(action.Count, 1, ActionLimit(action.Op));
        }
        if (!settings.EffectsActionsAdded)
        {
            foreach (var op in new[] { "flash", "prison", "release" })
                if (!settings.Actions.Any(a => a.Op == op)) settings.Actions.Add(NewAction(op));
            settings.EffectsActionsAdded = true;
            SaveSettings();
        }
        if (!settings.AudienceActionsAdded)
        {
            foreach (string op in new[] { "boss", "bigboss", "helper" })
                if (!settings.Actions.Any(a => a.Op == op)) settings.Actions.Add(NewAction(op));
            settings.CreatureScale = 1.5f;
            settings.AudienceActionsAdded = true;
        }
        settings.LikeAction ??= new() { Enabled = true, Count = 5 };
        settings.FollowAction ??= new() { Enabled = true, Count = 5 };
        foreach (var trigger in new[] { settings.LikeAction, settings.FollowAction })
        {
            if (!ActionOps.Contains(trigger.Op)) trigger.Op = "spawn";
            trigger.Count = Math.Clamp(trigger.Count, 1, ActionLimit(trigger.Op));
        }
        settings.LikeThreshold = Math.Clamp(settings.LikeThreshold, 1, 1000000);
        audience.Configure(settings.LikeThreshold);
        if (!settings.PercentCombatAdded)
        {
            settings.PlayerHealth = CombatBalance.StartingHealth;
            settings.CreatureDamage = 1;
            settings.PercentCombatAdded = true;
        }
        settings.CreatureDamage = CombatBalance.UpgradeNormalDamage(settings.CreatureDamage, settings.NormalCombatV2Added);
        settings.NormalCombatV2Added = true;
        settings.MaxCreatures = Math.Clamp(settings.MaxCreatures, 10, MaxPhysicalCreatures);
        settings.PhysicalCreatures = Math.Clamp(settings.PhysicalCreatures, 1, MaxPhysicalCreatures);
        settings.RoundSeconds = Math.Clamp(settings.RoundSeconds, 1, 3600);
        settings.KillTarget = Math.Clamp(settings.KillTarget, 1, 1_000_000);
        settings.WinGoal = Math.Clamp(settings.WinGoal, 1, 1_000_000);
        settings.FirstWeaponKills = Math.Clamp(settings.FirstWeaponKills, 1, 1000);
        settings.WeaponKillStep = Math.Clamp(settings.WeaponKillStep, 0, 1000);
        settings.CleanupTarget = Math.Clamp(settings.CleanupTarget, 1, 1_000_000);
        settings.CreatureDamage = Math.Clamp(settings.CreatureDamage, 1, 100);
        settings.CreatureAttackInterval = Math.Clamp(settings.CreatureAttackInterval, .5f, 5);
        settings.CreatureScale = float.IsFinite(settings.CreatureScale) ? Math.Clamp(settings.CreatureScale, 1, 1.5f) : 1.5f;
        settings.PlayerHealth = Math.Clamp(settings.PlayerHealth, 1, 1000);
        survival.Configure(settings.PlayerHealth);
        rules.ConfigureProgression(settings.FirstWeaponKills, settings.WeaponKillStep);
        settings.Volume = Math.Clamp(settings.Volume, 0, 1);
        settings.Sensitivity = Math.Clamp(settings.Sensitivity, .1f, 3);
        settings.BloodColor = Math.Clamp(settings.BloodColor, 0, 5);
        gifts = (JsonSerializer.Deserialize<List<Gift>>(File.ReadAllText(Path.Combine(Root, "catalog", "gifts.json"))) ?? new()).OrderBy(g => g.coins).ThenBy(g => g.Title, StringComparer.OrdinalIgnoreCase).ToList();
        if (gifts.Any(g => !System.Text.RegularExpressions.Regex.IsMatch(g.id, "^[0-9]+$") || g.coins < 0 || !File.Exists(Path.Combine(Root, "catalog", Path.GetFileName(g.file)))) || gifts.Select(g => g.id).Distinct().Count() != gifts.Count)
            throw new InvalidDataException("Hediye katalogunda eksik gorsel veya yinelenen/gecersiz ID var.");
        foreach (var gift in gifts) giftSearchKeys[gift.id] = SearchKey(gift.Title);
        SaveSettings();
    }
    private void SaveSettings()
    {
        var file = Path.Combine(Data, "mod-settings.json");
        File.WriteAllText(file + ".tmp", JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true }));
        File.Move(file + ".tmp", file, true);
        settingsDirty = false;
        savedAt = DateTime.Now.ToString("HH:mm");
    }
    private void TestGift(string id)
    {
        ApplyGiftActions(id, 1, testUser);
    }

    private int ApplyGiftActions(string id, int repeats, string user, bool fromLive = false)
    {
        int matched = 0;
        int previousCount = rules.Alive + pending.Count + nextRoundPending.Count;
        foreach (var action in settings.Actions.Where(a => a.GiftId == id && id.Length > 0))
        {
            matched++;
            ExecuteAction(action, repeats, user, !settings.GiftNoticesEnabled);
        }
        QueueGiftNotice(id, repeats, user, fromLive, rules.Alive + pending.Count + nextRoundPending.Count - previousCount);
        return matched;
    }
    private static readonly string[] ActionOps = { "spawn", "boss", "bigboss", "helper", "flash", "prison", "release", "up", "down" };
    private static string ActionName(string op) => op switch
    {
        "spawn" => "Yaratik gonder", "boss" => "Boss / %400", "bigboss" => "Big Boss / %650", "helper" => "Destek / 20 can", "flash" => "Flash", "prison" => "Hapse at",
        "release" => "Hapisten kurtar", "up" => "Silah yukselt", "down" => "Silah dusur", _ => "Gecersiz"
    };
    private static bool CreatureAction(string op) => op is "spawn" or "boss" or "bigboss" or "helper";
    private static int ActionLimit(string op) => op == "spawn" ? 1_000_000 : op == "helper" ? 12 : op is "boss" or "bigboss" ? 30 : op is "up" or "down" ? 7 : 3600;
    private static string ActionIcon(string op) => op switch { "spawn" => "Gift", "flash" => "Zap", "prison" => "LockKeyhole", "release" => "UnlockKeyhole", "up" => "ArrowUp", "down" => "ArrowDown", _ => "Gift" };
    private static ActionBinding NewAction(string op) => new() { Name = ActionName(op), Op = op, Count = op == "flash" ? 3 : 1 };
    private void ExecuteAction(ActionBinding action, int repeats, string user, bool notify = true)
    {
        int amount = EffectState.Amount(action.Count, repeats);
        switch (action.Op)
        {
            case "spawn": case "boss": case "bigboss": case "helper": Add(amount, user, notify, action.Op); break;
            case "flash": TriggerFlash(action.Count, repeats); break;
            case "prison": effects.Imprison(action.Count, repeats); SyncPrison(); break;
            case "release": effects.Release(action.Count, repeats); SyncPrison(); break;
            case "up":
            case "down":
                int direction = action.Op == "up" ? 1 : -1;
                int steps = Math.Min(7, amount);
                if (rules.Won || roundTimedOut) nextRoundWeaponLevel = Math.Clamp(nextRoundWeaponLevel + direction * steps, 0, Rules.WeaponNames.Length - 1);
                else
                {
                    for (int i = 0; i < steps; i++) rules.Shift(direction);
                    if (notify) Notice(Rules.WeaponNames[rules.Level]);
                    ApplyWeapon();
                }
                break;
        }
    }
    private Texture2D GiftImage(Gift gift)
    {
        if (giftTextures.TryGetValue(gift.id, out var texture)) return texture;
        string file = Path.Combine(Root, "catalog", Path.GetFileName(gift.file));
        if (!File.Exists(file)) return null;
        var image = StbImageSharp.ImageResult.FromMemory(File.ReadAllBytes(file), StbImageSharp.ColorComponents.RedGreenBlueAlpha);
        var rgba = new byte[48 * 48 * 4];
        for (int y = 0; y < 48; y++) for (int x = 0; x < 48; x++)
        {
            int source = ((y * image.Height / 48) * image.Width + x * image.Width / 48) * 4;
            Buffer.BlockCopy(image.Data, source, rgba, (y * 48 + x) * 4, 4);
        }
        texture = UploadImage(48, 48, rgba);
        texture.Apply();
        giftTextures[gift.id] = texture;
        return texture;
    }
}
