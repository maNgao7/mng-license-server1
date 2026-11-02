namespace TikMnG.CanEmAll;

public sealed class Magazine
{
    public int Capacity { get; }
    public double Duration { get; }
    public int Rounds { get; private set; }
    public double Remaining { get; private set; }
    public bool Reloading => Remaining > 0;
    public int Reloads { get; private set; }
    public double Progress => Reloading ? 1 - Remaining / Duration : 0;
    public Magazine(int capacity, double duration)
    {
        if (capacity < 1 || !double.IsFinite(duration) || duration <= 0) throw new ArgumentOutOfRangeException();
        Capacity = Rounds = capacity; Duration = duration;
    }
    public bool StartReload()
    {
        if (Reloading || Rounds == Capacity) return false;
        Remaining = Duration; return true;
    }
    public void Advance(double delta)
    {
        if (!Reloading || !double.IsFinite(delta) || delta <= 0) return;
        Remaining = Math.Max(0, Remaining - delta);
        if (Remaining < 1e-7) { Remaining = 0; Rounds = Capacity; Reloads++; }
    }
    public bool Spend(int count = 1)
    {
        if (count < 1 || Reloading || Rounds < count) return false;
        Rounds -= count; return true;
    }
    public void Empty() { Rounds = 0; Remaining = 0; }
    public void CancelReload() { Remaining = 0; }
    public void Reset() { Rounds = Capacity; Remaining = 0; }
}

public sealed class FlameHeat
{
    public const double FireSeconds = 4;
    public const double CooldownSeconds = 5;
    public double Heat { get; private set; }
    public double Remaining { get; private set; }
    public bool Overheated => Remaining > 0;
    public int Overheats { get; private set; }
    public bool Burn(double seconds)
    {
        if (Overheated || !double.IsFinite(seconds) || seconds <= 0) return false;
        Heat = Math.Min(1, Heat + seconds / FireSeconds);
        if (Heat >= 1 - 1e-7) { Heat = 1; Remaining = CooldownSeconds; Overheats++; }
        return true;
    }
    public void Advance(double delta, bool firing)
    {
        if (!double.IsFinite(delta) || delta <= 0) return;
        if (Overheated)
        {
            Remaining = Math.Max(0, Remaining - delta);
            if (Remaining < 1e-7) { Remaining = 0; Heat = 0; }
            else Heat = Remaining / CooldownSeconds;
        }
        else if (!firing) Heat = Math.Max(0, Heat - delta / CooldownSeconds);
    }
    public void Reset() { Heat = Remaining = 0; }
}

public sealed class WeaponResources
{
    private readonly Dictionary<int, Magazine> magazines = new()
    {
        [2] = new(12, 1.6), [3] = new(30, 2), [4] = new(30, 2.4), [5] = new(6, 2.6), [6] = new(1, 2.8)
    };
    public FlameHeat Flame { get; } = new();
    public Magazine Get(int level) => magazines.TryGetValue(level, out var magazine) ? magazine : null;
    public void Advance(double delta, bool paused, bool firing)
    {
        if (paused) return;
        foreach (var magazine in magazines.Values) magazine.Advance(delta);
        Flame.Advance(delta, firing);
    }
    public void Reset()
    {
        foreach (var magazine in magazines.Values) magazine.Reset();
        Flame.Reset();
    }
}
