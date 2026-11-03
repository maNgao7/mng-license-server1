namespace TikMnG.CanEmAll;

public sealed class EffectState
{
    public const double MaximumSeconds = 1_000_000;
    public double FlashSeconds { get; private set; }
    public double PrisonSeconds { get; private set; }
    public bool Imprisoned => PrisonSeconds > 0;

    public static int Amount(int perGift, int repeats, int maximum = 1_000_000) =>
        (int)Math.Clamp((long)Math.Clamp(perGift, 1, maximum) * Math.Clamp(repeats, 1, 10000), 1, maximum);

    public void Flash(int seconds, int repeats) => FlashSeconds = Math.Min(MaximumSeconds, FlashSeconds + Amount(seconds, repeats));
    public void Imprison(int seconds, int repeats) => PrisonSeconds = Math.Min(MaximumSeconds, PrisonSeconds + Amount(seconds, repeats));
    public void Release(int seconds, int repeats) => PrisonSeconds = Math.Max(0, PrisonSeconds - Amount(seconds, repeats));
    public void Tick(double delta)
    {
        if (!double.IsFinite(delta) || delta <= 0) return;
        FlashSeconds = Math.Max(0, FlashSeconds - delta);
        PrisonSeconds = Math.Max(0, PrisonSeconds - delta);
    }
    public void Clear() { FlashSeconds = 0; PrisonSeconds = 0; }
}
