namespace TikMnG.CanEmAll;

public static class CombatBalance
{
    public const int StartingHealth = 500;
    public static int Health(string kind) => kind switch { "helper" => 20, "boss" => 240, "bigboss" => 480, _ => 12 };
    public static int Percent(string kind, int normal = 1) => kind switch { "boss" => 30, "bigboss" => 80, _ => Math.Clamp(normal, 1, 100) };
    public static float Windup(string kind) => kind == "bigboss" ? 1 : kind == "boss" ? .65f : .38f;
    public static float SwingDuration(string kind) => kind == "bigboss" ? 1.55f : kind == "boss" ? 1.05f : .62f;
    public static float Recovery(string kind, float normal) => normal * (kind == "bigboss" ? 3 : kind == "boss" ? 2 : 1);
    public static float Reach(string kind) => kind == "bigboss" ? 6 : kind == "boss" ? 4 : 1.9f;
    public static int Damage(string kind, int maximum, int normal = 1)
    {
        if (maximum < 1) return 0;
        return (int)Math.Min(maximum, Math.Max(1, ((long)maximum * Percent(kind, normal) + 99) / 100));
    }
}
