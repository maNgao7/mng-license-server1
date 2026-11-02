namespace TikMnG.CanEmAll;

public enum ChallengePhase { Waiting, Preparing, Active, Won, Lost }

public sealed class TimedChallenge
{
    public const int PreparationSeconds = 10;
    public ChallengePhase Phase { get; private set; }
    public int Target { get; private set; }
    public int Kills { get; private set; }
    public int Duration { get; private set; }
    public double StartsAt { get; private set; }
    private double? pausedAt;
    public bool IsPaused => pausedAt.HasValue;
    public double EndsAt => StartsAt + Duration;
    public bool Finished => Phase is ChallengePhase.Won or ChallengePhase.Lost;

    public bool Start(double now, int seconds, int target, bool immediately = false)
    {
        if (Phase != ChallengePhase.Waiting || !double.IsFinite(now)) return false;
        Duration = Math.Clamp(seconds, 1, 3600);
        Target = Math.Clamp(target, 1, 1_000_000);
        StartsAt = now + (immediately ? 0 : PreparationSeconds);
        Kills = 0;
        Phase = immediately ? ChallengePhase.Active : ChallengePhase.Preparing;
        return true;
    }

    public bool SkipPreparation(double now)
    {
        if (Phase != ChallengePhase.Preparing || !double.IsFinite(now)) return false;
        StartsAt = now;
        if (IsPaused) pausedAt = now;
        Phase = ChallengePhase.Active;
        return true;
    }

    public void Tick(double now)
    {
        if (!double.IsFinite(now) || IsPaused) return;
        if (Phase == ChallengePhase.Preparing && now >= StartsAt) Phase = ChallengePhase.Active;
        if (Phase == ChallengePhase.Active && now >= EndsAt) Phase = ChallengePhase.Lost;
    }

    public void Kill(double now)
    {
        Tick(now);
        if (Phase != ChallengePhase.Active) return;
        if (++Kills >= Target) { Phase = ChallengePhase.Won; pausedAt = null; }
    }

    public bool TogglePause(double now)
    {
        if (!double.IsFinite(now)) return false;
        if (pausedAt.HasValue)
        {
            StartsAt += Math.Max(0, now - pausedAt.Value);
            pausedAt = null;
            return true;
        }
        Tick(now);
        if (Phase is not (ChallengePhase.Preparing or ChallengePhase.Active)) return false;
        pausedAt = now;
        return true;
    }

    public double Remaining(double now) => Phase switch
    {
        ChallengePhase.Preparing => Math.Max(0, StartsAt - (pausedAt ?? now)),
        ChallengePhase.Active => Math.Max(0, EndsAt - (pausedAt ?? now)),
        _ => 0
    };

    public void Reset()
    {
        Phase = ChallengePhase.Waiting;
        Kills = Target = Duration = 0;
        StartsAt = 0;
        pausedAt = null;
    }
}
