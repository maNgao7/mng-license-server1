namespace TikMnG.CanEmAll;

public sealed class Rules
{
    public const int DefaultFirstWeaponKills = 50;
    public const int DefaultWeaponKillStep = 10;
    public static readonly string[] WeaponNames = { "Beyzbol Sopasi", "Bicak", "Tabanca", "Uzi", "AK-47", "Pompali", "Roketatar", "Alev Makinesi" };
    public int Level { get; private set; }
    public int Kills { get; private set; }
    public int Collected { get; private set; }
    public int Alive { get; private set; }
    public int Wins { get; private set; }
    public int Round { get; private set; } = 1;
    public bool HasParticipants { get; private set; }
    public double? Deadline { get; private set; }
    public bool Won { get; private set; }
    public int FirstWeaponKills { get; private set; } = DefaultFirstWeaponKills;
    public int WeaponKillStep { get; private set; } = DefaultWeaponKillStep;
    // Legacy configuration names preserve saved thresholds; progression now counts vacuum collections.
    public int RequiredCollections => (int)Math.Min(9999L, FirstWeaponKills + (long)Level * WeaponKillStep);
    public int Progress { get; private set; }
    public bool IsFinalWeapon => Level == WeaponNames.Length - 1;
    public string NextWeapon => IsFinalWeapon ? "Son kademe" : WeaponNames[Level + 1];

    public void Spawn(int count)
    {
        if (count < 1 || Won) return;
        Alive += count;
        HasParticipants = true;
        Deadline = null;
    }

    public void Kill(double now)
    {
        if (Alive == 0 || Won) return;
        Alive--; Kills++;
        if (Alive == 0 && HasParticipants) Deadline = now + 10;
    }

    public void Collect()
    {
        if (Won) return;
        Collected++;
        if (!IsFinalWeapon && ++Progress >= RequiredCollections) { Progress = 0; Level++; }
    }

    public void Shift(int direction)
    {
        Level = Math.Clamp(Level + Math.Sign(direction), 0, WeaponNames.Length - 1);
        Progress = Math.Min(Progress, RequiredCollections - 1);
    }

    public void ConfigureProgression(int first, int step)
    {
        first = Math.Clamp(first, 1, 1000); step = Math.Clamp(step, 0, 1000);
        if (FirstWeaponKills == first && WeaponKillStep == step) return;
        FirstWeaponKills = first; WeaponKillStep = step;
        // A gift or settings change must not silently promote the weapon without another collection.
        Progress = Math.Min(Progress, RequiredCollections - 1);
    }

    public bool Tick(double now, bool pending = false)
    {
        if (Won || Alive != 0 || !HasParticipants || pending || Deadline == null || now < Deadline.Value) return false;
        FinishRound(true);
        return true;
    }

    public void FinishRound(bool won)
    {
        Won = won;
        Wins += won ? 1 : -1;
        Deadline = null;
    }

    public void AdjustWins(int delta) => Wins = (int)Math.Clamp((long)Wins + delta, -1_000_000L, 1_000_000L);

    public void Reset()
    {
        Level = 0; Kills = 0; Collected = 0; Progress = 0; Alive = 0; HasParticipants = false; Won = false; Deadline = null; Round++;
    }
}
