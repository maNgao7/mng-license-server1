namespace TikMnG.CanEmAll;

public sealed class SurvivalState
{
    public const int DefaultMaximumHealth = CombatBalance.StartingHealth;
    public int MaximumHealth { get; private set; } = DefaultMaximumHealth;
    public const double HitProtectionSeconds = .7;
    public int Health { get; private set; } = DefaultMaximumHealth;
    public bool Dead => Health == 0;
    public string LastAttacker { get; private set; } = "";
    public string KilledBy { get; private set; } = "";
    private double protectedUntil;

    public void Configure(int maximum)
    {
        maximum = Math.Clamp(maximum, 1, 1000);
        if (maximum == MaximumHealth) return;
        Health = Dead ? 0 : Math.Clamp((int)Math.Ceiling(Health * (double)maximum / MaximumHealth), 1, maximum);
        MaximumHealth = maximum;
    }

    public bool Hit(double now, string attacker, int damage, bool shielded = false)
    {
        if (!double.IsFinite(now) || now < 0 || Dead || shielded || now < protectedUntil
            || string.IsNullOrWhiteSpace(attacker) || damage <= 0) return false;
        Health = Math.Max(0, Health - Math.Clamp(damage, 1, MaximumHealth));
        LastAttacker = attacker;
        protectedUntil = now + HitProtectionSeconds;
        if (Dead) KilledBy = attacker;
        return true;
    }

    public void Reset(double now, double grace = 2)
    {
        Health = MaximumHealth; LastAttacker = KilledBy = "";
        protectedUntil = double.IsFinite(now) && now >= 0 ? now + Math.Clamp(grace, 0, 10) : 0;
    }
}
