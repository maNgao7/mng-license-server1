namespace TikMnG.CanEmAll;

public sealed class RoundRecap
{
    public int Round { get; }
    public bool Won { get; }
    public int Kills { get; }
    public int Collected { get; }
    public int BestCombo { get; }
    public int HighestWeapon { get; }
    public double Seconds { get; }
    public bool CleanupEnabled { get; }
    public int CleanupTarget { get; }
    public int Wins { get; }
    public RoundRecap(int round, bool won, int kills, int collected, int bestCombo, int highestWeapon,
        double seconds, bool cleanupEnabled, int cleanupTarget, int wins)
    {
        Round = round; Won = won; Kills = kills; Collected = collected; BestCombo = bestCombo;
        HighestWeapon = highestWeapon; Seconds = seconds; CleanupEnabled = cleanupEnabled;
        CleanupTarget = cleanupTarget; Wins = wins;
    }
}

public sealed class RoundHighlights
{
    public const double ComboWindow = 3;
    public int Kills { get; private set; }
    public int Collected { get; private set; }
    public int Combo { get; private set; }
    public int BestCombo { get; private set; }
    public int HighestWeapon { get; private set; }
    public double ComboUntil { get; private set; }
    public double? StartedAt { get; private set; }
    public bool CleanupEnabled { get; private set; }
    public int CleanupTarget { get; private set; } = 100;
    public bool CleanupComplete => CleanupEnabled && Collected >= CleanupTarget;
    public RoundRecap Result { get; private set; }

    public void ConfigureCleanup(bool enabled, int target)
    {
        if (Result != null) return;
        CleanupEnabled = enabled; CleanupTarget = Math.Clamp(target, 1, 1_000_000);
    }

    public void Begin(double now)
    {
        if (Result == null && StartedAt == null && double.IsFinite(now)) StartedAt = now;
    }

    public void VisitWeapon(int level)
    {
        if (Result == null) HighestWeapon = Math.Max(HighestWeapon, Math.Clamp(level, 0, Rules.WeaponNames.Length - 1));
    }

    public void Tick(double now, bool enabled)
    {
        if (!enabled || now >= ComboUntil) Combo = 0;
    }

    public int Kill(double now, int weapon, bool comboEnabled)
    {
        if (Result != null || !double.IsFinite(now)) return 0;
        Begin(now); VisitWeapon(weapon); Kills++;
        Tick(now, comboEnabled);
        if (!comboEnabled) return 0;
        Combo++; ComboUntil = now + ComboWindow;
        BestCombo = Math.Max(BestCombo, Combo);
        return Combo is 10 or 25 or 50 || Combo >= 100 && Combo % 100 == 0 ? Combo : 0;
    }

    public bool Collect(double now)
    {
        if (Result != null || !double.IsFinite(now)) return false;
        Begin(now);
        bool previous = CleanupComplete; Collected++;
        return !previous && CleanupComplete;
    }

    public double Elapsed(double now) => StartedAt.HasValue && double.IsFinite(now) ? Math.Max(0, now - StartedAt.Value) : 0;

    public RoundRecap Finish(int round, bool won, double now, int wins)
    {
        return Result ??= new RoundRecap(round, won, Kills, Collected, BestCombo, HighestWeapon,
            Elapsed(now), CleanupEnabled, CleanupTarget, wins);
    }

    public void Reset()
    {
        Kills = Collected = Combo = BestCombo = HighestWeapon = 0;
        ComboUntil = 0; StartedAt = null; Result = null;
    }
}
