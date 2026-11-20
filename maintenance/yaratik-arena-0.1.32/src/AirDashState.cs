namespace TikMnG.CanEmAll;

public sealed class AirDashState
{
    public const float Distance = 11;
    public const float Duration = .6f;
    public const float StaminaCapacityMultiplier = 1.7f;
    public const float StaminaRecoveryMultiplier = 1.9f;
    public const float StaminaCostFraction = .30f;
    public const float RecoveryDelay = 1.25f;
    public bool Armed { get; private set; }
    public bool Used { get; private set; }
    private bool airborne;
    private double nextAllowed;
    private double recoveryAt;

    public void Observe(bool grounded)
    {
        if (grounded && airborne) { Armed = false; Used = false; }
        airborne = !grounded;
    }

    public bool Press(bool grounded, double now, bool hasStamina = true)
    {
        if (!double.IsFinite(now) || now < 0) return false;
        Observe(grounded);
        if (grounded) { Armed = true; return false; }
        if (!Armed || Used || !hasStamina || now < nextAllowed) return false;
        Used = true; Armed = false; nextAllowed = now + .8;
        recoveryAt = now + RecoveryDelay;
        return true;
    }

    public bool CanRecover(double now) => !Used && now >= recoveryAt;
    public void Cancel() { Armed = false; }
    public void Reset() { Armed = Used = airborne = false; nextAllowed = recoveryAt = 0; }
}
