namespace TikMnG.CanEmAll;

public sealed class SurvivalState
{
    public const int DefaultMaximumHealth = CombatBalance.StartingHealth;
    public int MaximumHealth { get; private set; } = DefaultMaximumHealth;
    public const double HitProtectionSeconds = .7;
    public const double RegenerationDelaySeconds = 7;
    public const double RegenerationFractionPerSecond = .01;
    public int Health { get; private set; } = DefaultMaximumHealth;
    public bool Dead => Health == 0;
    public string LastAttacker { get; private set; } = "";
    public string KilledBy { get; private set; } = "";
    private double protectedUntil;
    private double regenerationClock, regenerationFraction;
    private double regenerationDelayRemaining = RegenerationDelaySeconds;
    private bool regenerationPaused;

    public void Configure(int maximum)
    {
        maximum = Math.Clamp(maximum, 1, 1000);
        if (maximum == MaximumHealth) return;
        Health = Dead ? 0 : Math.Clamp((int)Math.Ceiling(Health * (double)maximum / MaximumHealth), 1, maximum);
        MaximumHealth = maximum;
        regenerationFraction = 0;
    }

    public bool Hit(double now, string attacker, int damage, bool shielded = false)
    {
        if (!double.IsFinite(now) || now < 0 || now < regenerationClock || Dead || shielded || now < protectedUntil
            || string.IsNullOrWhiteSpace(attacker) || damage <= 0) return false;
        Health = Math.Max(0, Health - Math.Clamp(damage, 1, MaximumHealth));
        LastAttacker = attacker;
        protectedUntil = now + HitProtectionSeconds;
        regenerationClock = now;
        regenerationDelayRemaining = RegenerationDelaySeconds;
        regenerationFraction = 0;
        regenerationPaused = false;
        if (Dead) KilledBy = attacker;
        return true;
    }

    public int Regenerate(double now, bool paused = false)
    {
        if (!double.IsFinite(now) || now < 0 || now < regenerationClock) return 0;
        double elapsed = now - regenerationClock;
        regenerationClock = now;
        bool wasPaused = regenerationPaused;
        regenerationPaused = paused;
        // Exclude both ends of a pause, even if an external clock kept advancing.
        if (paused || wasPaused || Dead || Health == MaximumHealth) return 0;
        double healingSeconds = Math.Max(0, elapsed - regenerationDelayRemaining);
        regenerationDelayRemaining = Math.Max(0, regenerationDelayRemaining - elapsed);
        regenerationFraction = Math.Min(MaximumHealth - Health,
            regenerationFraction + healingSeconds * MaximumHealth * RegenerationFractionPerSecond);
        int healed = Math.Min(MaximumHealth - Health, (int)Math.Floor(regenerationFraction + 1e-9));
        Health += healed;
        regenerationFraction = Health == MaximumHealth ? 0 : Math.Max(0, regenerationFraction - healed);
        return healed;
    }

    public void Reset(double now, double grace = 2)
    {
        Health = MaximumHealth; LastAttacker = KilledBy = "";
        bool validTime = double.IsFinite(now) && now >= 0;
        regenerationClock = validTime ? now : 0;
        protectedUntil = validTime ? regenerationClock + (double.IsFinite(grace) ? Math.Clamp(grace, 0, 10) : 0) : 0;
        regenerationDelayRemaining = RegenerationDelaySeconds;
        regenerationFraction = 0;
        regenerationPaused = false;
    }
}
