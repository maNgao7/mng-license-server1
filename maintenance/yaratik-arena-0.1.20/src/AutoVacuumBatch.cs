namespace TikMnG.CanEmAll;

public sealed class AutoVacuumBatch
{
    public const int Threshold = 100;
    public bool Active { get; private set; }

    public bool Observe(int bodies)
    {
        if (bodies <= 0) Active = false;
        else if (bodies >= Threshold) Active = true;
        return Active;
    }

    public void Reset() => Active = false;
}
