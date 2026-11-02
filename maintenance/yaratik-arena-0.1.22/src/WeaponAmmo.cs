using Il2Cpp;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private int automaticAmmoRefills;
    private static float Ammo(Weapon weapon) => weapon.GetIl2CppType().Name switch
    {
        "Pistol" => weapon.Cast<Pistol>().bulletCount,
        "SMG" => weapon.Cast<SMG>().bulletCount,
        "AK47" => weapon.Cast<AK47>().bulletCount,
        "Shotgun" => weapon.Cast<Shotgun>().bulletCount,
        "RocketLauncher" => weapon.Cast<RocketLauncher>().bulletCount,
        "FlameThrower" => weapon.Cast<FlameThrower>().fuel,
        _ => -1
    };

    private void KeepWeaponLoaded()
    {
        if (menu || GameManager.Instance.IsPaused || vacuum || PrisonActive) return;
        var weapon = weapons[rules.Level];
        float remaining = Ammo(weapon);
        if (remaining < 0 || remaining > 1) return;
        // Ammo is independent of the factory's corpse-to-production loop in this mod.
        weapon.RestoreAmmo();
        automaticAmmoRefills++;
    }

    private void EmptySelectedAmmo()
    {
        var weapon = weapons[rules.Level];
        switch (weapon.GetIl2CppType().Name)
        {
            case "Pistol": weapon.Cast<Pistol>().bulletCount = 0; break;
            case "SMG": weapon.Cast<SMG>().bulletCount = 0; break;
            case "AK47": weapon.Cast<AK47>().bulletCount = 0; break;
            case "Shotgun": weapon.Cast<Shotgun>().bulletCount = 0; break;
            case "RocketLauncher": weapon.Cast<RocketLauncher>().bulletCount = 0; break;
            case "FlameThrower": weapon.Cast<FlameThrower>().fuel = 0; break;
        }
    }
}
