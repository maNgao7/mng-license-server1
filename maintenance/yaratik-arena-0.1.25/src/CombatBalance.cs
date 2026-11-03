namespace TikMnG.CanEmAll;

public static class CombatBalance
{
    public const int StartingHealth = 500;
    public const float HelperSeconds = 20;
    public static int Health(string kind, int weaponLevel = 0) => kind switch
    {
        "helper" => 20, "boss" => 264, "bigboss" => 528,
        _ => (int)Math.Ceiling(12 * 1.3 * Math.Pow(1.5, Math.Clamp(weaponLevel, 0, 7)))
    };
    public static float MoveMultiplier(string kind) => kind == "helper" ? 1.2f : 1.2f * 1.05f;
    public static float ScaledHealth(float health, float oldMaximum, float newMaximum) =>
        health <= 0 ? 0 : Math.Clamp(health / Math.Max(1, oldMaximum), 0, 1) * newMaximum;
    public static float RocketDamage(float health, float maximum, float damage) =>
        health >= maximum - .001f && maximum > 10 ? Math.Min(damage, health - 10) : damage;
    public static float HelperRemaining(float remaining, float delta, bool paused) =>
        paused ? remaining : Math.Max(0, remaining - Math.Max(0, delta));
    public static int UpgradeNormalDamage(int value, bool alreadyUpgraded) =>
        Math.Clamp(!alreadyUpgraded && value == 1 ? 3 : value, 1, 100);
    public static int Percent(string kind, int normal = 3, int weaponLevel = 0) => kind switch
    {
        "boss" => 30, "bigboss" => 80,
        _ => Math.Min(100, (int)Math.Ceiling(Math.Clamp(normal, 1, 100) * Math.Pow(1.3, Math.Clamp(weaponLevel, 0, 7))))
    };
    public static float Windup(string kind) => kind == "bigboss" ? 1 : kind == "boss" ? .65f : .38f;
    public static float SwingDuration(string kind) => kind == "bigboss" ? 1.55f : kind == "boss" ? 1.05f : .62f;
    public static float Recovery(string kind, float normal) => normal * (kind == "bigboss" ? 3 : kind == "boss" ? 2 : 1);
    public static float Reach(string kind) => kind == "bigboss" ? 6 : kind == "boss" ? 4 : 1.9f;
    public static int Damage(string kind, int maximum, int normal = 3, int weaponLevel = 0)
    {
        if (maximum < 1) return 0;
        return (int)Math.Min(maximum, Math.Max(1, ((long)maximum * Percent(kind, normal, weaponLevel) + 99) / 100));
    }
}
