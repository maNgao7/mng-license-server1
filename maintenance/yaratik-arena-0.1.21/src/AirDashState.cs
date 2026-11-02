namespace TikMnG.CanEmAll;

public sealed class AirDashState
{
    public const float Distance = 25;
    public const float Duration = .6f;
    public bool Armed { get; private set; }
    public bool Used { get; private set; }
    private bool airborne;
    private double nextAllowed;

    public void Observe(bool grounded)
    {
        if (grounded && airborne) { Armed = false; Used = false; }
        airborne = !grounded;
    }

    public bool Press(bool grounded, double now)
    {
        if (!double.IsFinite(now) || now < 0) return false;
        Observe(grounded);
        if (grounded) { Armed = true; return false; }
        if (!Armed || Used || now < nextAllowed) return false;
        Used = true; Armed = false; nextAllowed = now + .8;
        return true;
    }

    public void Cancel() { Armed = false; }
    public void Reset() { Armed = Used = airborne = false; nextAllowed = 0; }
}
