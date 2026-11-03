using Il2Cpp;
using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private readonly WeaponResources resources = new();
    private int automaticAmmoRefills, reloadStarts, manualShots, heatBlocks;
    private float autoFlameUntil;
    private Transform reloadPose;
    private Vector3 reloadBasePosition;
    private Quaternion reloadBaseRotation;
    private bool reloadPoseApplied;
    private int reloadPoseFrame = -100;
    private GUIStyle ammoTitle, ammoNumber, ammoCaption;
    private Texture2D ammoPlate;
    private Rect ammoHudBounds;
    private bool ammoHudDrawn;

    private static float Ammo(Weapon weapon) => weapon.GetIl2CppType().Name switch
    {
        "Pistol" => weapon.Cast<Pistol>().bulletCount, "SMG" => weapon.Cast<SMG>().bulletCount,
        "AK47" => weapon.Cast<AK47>().bulletCount, "Shotgun" => weapon.Cast<Shotgun>().bulletCount,
        "RocketLauncher" => weapon.Cast<RocketLauncher>().bulletCount, "FlameThrower" => weapon.Cast<FlameThrower>().fuel,
        _ => -1
    };
    private static int AmmoLevel(Weapon weapon) => weapon.GetIl2CppType().Name switch
    { "Pistol" => 2, "SMG" => 3, "AK47" => 4, "Shotgun" => 5, "RocketLauncher" => 6, "FlameThrower" => 7, _ => -1 };
    private void SyncMagazine(int level)
    {
        var magazine = resources.Get(level);
        if (magazine == null || weapons.Length <= level) return;
        int count = magazine.Reloading ? 0 : magazine.Rounds;
        switch (level)
        {
            case 2: weapons[level].Cast<Pistol>().bulletCount = count; break;
            case 3: weapons[level].Cast<SMG>().bulletCount = count; break;
            case 4: weapons[level].Cast<AK47>().bulletCount = count; break;
            case 5: weapons[level].Cast<Shotgun>().bulletCount = count; break;
            case 6: weapons[level].Cast<RocketLauncher>().bulletCount = count; break;
        }
    }
    private bool WeaponInputActive => ready && !menu && !GameManager.Instance.IsPaused && !vacuum && !PrisonActive && !roundDied && !rules.Won && !roundTimedOut;
    private static bool BeforeMagazineUpdate(Weapon __instance, out int __state)
    {
        __state = -1; var mod = Current;
        if (!mod.ready) return true;
        int level = AmmoLevel(__instance);
        if (level < 2 || level > 6) return true;
        mod.SyncMagazine(level); var magazine = mod.resources.Get(level);
        if (!mod.WeaponInputActive || mod.rules.Level != level || mod.autoPlaying || mod.QaLocked) return false;
        if (magazine.Reloading) return false;
        if (magazine.Rounds == 0) { mod.BeginReload(level); return false; }
        __state = magazine.Rounds; return true;
    }
    private static void AfterMagazineUpdate(Weapon __instance, int __state)
    {
        if (__state < 0 || !Current.ready) return;
        int level = AmmoLevel(__instance), spent = Math.Clamp(__state - (int)Ammo(__instance), 0, __state);
        if (spent > 0)
        {
            Current.resources.Get(level).Spend(spent); Current.manualShots += spent;
            if (Current.resources.Get(level).Rounds == 0) Current.BeginReload(level);
        }
        Current.SyncMagazine(level);
    }
    private static bool BeforeFlameUpdate(FlameThrower __instance)
    {
        if (!Current.ready) return true;
        if (!Current.WeaponInputActive || Current.rules.Level != 7 || Current.resources.Flame.Overheated || Current.autoPlaying || Current.QaLocked)
        {
            if (!Current.autoPlaying || Current.resources.Flame.Overheated || !Current.WeaponInputActive) Current.StopFlame();
            return false;
        }
        __instance.fuel = Math.Max(1, __instance.maxFuel); return true;
    }
    private static void AfterFlameUpdate(FlameThrower __instance)
    {
        if (!Current.ready || Current.autoPlaying || !Current.WeaponInputActive || !__instance.isFiring) return;
        if (Current.resources.Flame.Burn(Time.deltaTime) && Current.resources.Flame.Overheated) Current.OnFlameOverheated();
    }
    private void StopFlame()
    {
        if (weapons.Length < 8) return;
        var flame = weapons[7].Cast<FlameThrower>(); flame.isFiring = false;
        if (flame.flameParticle.isPlaying) flame.flameParticle.Stop(true, ParticleSystemStopBehavior.StopEmitting);
        flame.UpdateAudio();
    }
    private void OnFlameOverheated() { StopFlame(); heatBlocks++; PlayTone(700, .1f); }
    private void BeginReload(int level)
    {
        var magazine = resources.Get(level);
        if (magazine == null || !magazine.StartReload()) return;
        reloadStarts++; SyncMagazine(level);
        var muzzle = level switch { 2 => weapons[2].Cast<Pistol>().muzzleFlash, 3 => weapons[3].Cast<SMG>().muzzleFlash, 4 => weapons[4].Cast<AK47>().muzzleFlash, 5 => weapons[5].Cast<Shotgun>().muzzleFlash, _ => weapons[6].Cast<RocketLauncher>().muzzleFlash };
        if (muzzle != null) muzzle.Stop(true, ParticleSystemStopBehavior.StopEmitting);
        if (level == 4) weapons[4].Cast<AK47>().isFiring = false;
        StartReloadAudio(level);
    }
    private void UpdateWeaponResources()
    {
        if (BulletCounter.Instance?.visual != null) BulletCounter.Instance.visual.SetActive(false);
        UpdateReloadAudio();
        bool paused = menu || GameManager.Instance.IsPaused || roundDied;
        var reloadingMagazine = resources.Get(rules.Level);
        int reloaded = reloadingMagazine?.Reloads ?? 0;
        bool firing = rules.Level == 7 && !vacuum && !PrisonActive &&
            (autoPlaying ? Time.time < autoFlameUntil : weapons[7].Cast<FlameThrower>().isFiring);
        resources.Advance(Time.deltaTime, paused, firing);
        if ((reloadingMagazine?.Reloads ?? 0) > reloaded) { automaticAmmoRefills++; CompleteReloadAudio(rules.Level); }
        for (int level = 2; level <= 6; level++) SyncMagazine(level);
        if (resources.Flame.Overheated || autoPlaying && !firing) StopFlame();
        if (paused || vacuum || PrisonActive || roundDied || rules.Won || roundTimedOut) return;
        var selected = resources.Get(rules.Level);
        if (selected != null && (selected.Rounds == 0 || !QaLocked && !autoPlaying && Application.isFocused && Input.GetKeyDown(KeyCode.R))) BeginReload(rules.Level);
    }
    private bool SpendAutoAmmo(int level)
    {
        var magazine = resources.Get(level);
        if (magazine == null) return level != 7 || !resources.Flame.Overheated;
        if (magazine.Rounds == 0) BeginReload(level);
        if (!magazine.Spend()) return false;
        SyncMagazine(level); return true;
    }
    private void RemoveReloadPose()
    {
        UpdateReloadAudio();
        if (!reloadPoseApplied) return;
        if (reloadPose != null) { reloadPose.localPosition = reloadBasePosition; reloadPose.localRotation = reloadBaseRotation; }
        reloadPoseApplied = false;
    }
    private void ApplyReloadPose()
    {
        var magazine = resources.Get(rules.Level);
        if (menu || vacuum || PrisonActive || roundDied || magazine == null || !magazine.Reloading) return;
        reloadPose = Inventory.Instance.handAnimator.transform;
        reloadBasePosition = reloadPose.localPosition; reloadBaseRotation = reloadPose.localRotation;
        float progress = (float)magazine.Progress;
        float lower = Mathf.SmoothStep(0, 1, Math.Min(progress / .2f, (1 - progress) / .2f));
        float movement = Mathf.Sin(progress * Mathf.PI * 4) * .02f * lower;
        reloadPose.localPosition += new Vector3(-.07f * lower, -.18f * lower + movement, .06f * lower);
        reloadPose.localRotation *= Quaternion.Euler(18 * lower, -10 * lower, -24 * lower);
        reloadPoseApplied = true;
        reloadPoseFrame = Time.frameCount;
    }
    private void EmptySelectedAmmo()
    {
        var magazine = resources.Get(rules.Level);
        if (magazine != null) { magazine.Empty(); SyncMagazine(rules.Level); }
        else if (rules.Level == 7 && !resources.Flame.Overheated) { resources.Flame.Burn(FlameHeat.FireSeconds); OnFlameOverheated(); }
    }
    private object AmmoSnapshot()
    {
        var magazine = resources.Get(rules.Level);
        return new { capacity = magazine?.Capacity ?? 0, rounds = magazine?.Rounds ?? 0, reloading = magazine?.Reloading ?? false,
            remaining = magazine?.Remaining ?? 0, progress = magazine?.Progress ?? 0, reloadStarts, manualShots,
            reloads = magazine?.Reloads ?? 0, heat = resources.Flame.Heat, overheated = resources.Flame.Overheated,
            cooldown = resources.Flame.Remaining, overheats = resources.Flame.Overheats, heatBlocks, reserveUnlimited = true,
            reloadAudio = new { starts = reloadAudioStarts, completes = reloadAudioCompletes, cancellations = reloadAudioCancellations,
                failures = reloadAudioFailures, paused = reloadAudioPaused, error = reloadAudioError },
            poseApplied = magazine?.Reloading == true && Time.frameCount - reloadPoseFrame <= 1, hudDrawn = ammoHudDrawn,
            bossHealth = CombatBalance.Health("boss"), bigBossHealth = CombatBalance.Health("bigboss"),
            bounds = new { ammoHudBounds.x, ammoHudBounds.y, ammoHudBounds.width, ammoHudBounds.height } };
    }
    private bool AmmoHudVisible => !vacuum && !PrisonActive && !roundDied && (resources.Get(rules.Level) != null || rules.Level == 7);
    private Rect AmmoHudLayout()
    {
        float width = Math.Min(280, Math.Max(1, Screen.width - 32)), height = width * 100 / 280;
        var health = HealthHudBounds();
        var bounds = new Rect(Screen.width - width - 18, Screen.height - height - 52, width, height);
        if (settings.EnemyAttacks && bounds.Overlaps(new Rect(health.x - 12, health.y - 12, health.width + 24, health.height + 24)))
            bounds.y = health.y - height - 12;
        bounds.y = Math.Max(8, bounds.y);
        return bounds;
    }
    private void DrawAmmoHud()
    {
        ammoHudDrawn = false;
        if (!AmmoHudVisible) return;
        EnsureSurvivalStyles();
        ammoTitle ??= HudLabelStyle(12, HudNavy, TextAnchor.MiddleLeft);
        ammoNumber ??= HudLabelStyle(30, HudNavy, TextAnchor.MiddleLeft);
        ammoCaption ??= HudLabelStyle(11, HudNavy, TextAnchor.MiddleCenter);
        ammoPlate ??= MakeHealthShape(280, 100, new[] { new Vector2(1, 13), new Vector2(14, 1), new Vector2(64, 1),
            new Vector2(79, 10), new Vector2(264, 10), new Vector2(279, 23), new Vector2(268, 99),
            new Vector2(15, 99), new Vector2(1, 87) }, true);
        ammoHudBounds = AmmoHudLayout();
        var box = ammoHudBounds; var magazine = resources.Get(rules.Level);
        float scale = box.width / 280;
        Rect Slot(float x, float y, float w, float h) => new Rect(box.x + x * scale, box.y + y * scale, w * scale, h * scale);
        bool heat = rules.Level == 7, blocked = heat ? resources.Flame.Overheated : magazine.Reloading;
        Color accent = heat ? resources.Flame.Overheated ? new Color(1, .24f, .25f) : HudOrange : HudMint;
        DrawHudIcon(new Rect(box.x + scale, box.y + 3 * scale, box.width, box.height), ammoPlate, new Color(0, 0, 0, .25f), ScaleMode.StretchToFill);
        DrawHudIcon(box, ammoPlate, Color.white, ScaleMode.StretchToFill);
        DrawHudIcon(Slot(20, 17, 40, 30), WeaponIcon(rules.Level), HudCream);
        ammoTitle.fontSize = Math.Max(1, (int)MathF.Round(12 * scale));
        ammoNumber.fontSize = Math.Max(1, (int)MathF.Round(30 * scale));
        ammoCaption.fontSize = Math.Max(1, (int)MathF.Round(11 * scale));
        Label(Slot(82, 10, 172, 21), heat ? "ALEV / HARARET" : Rules.WeaponNames[rules.Level].ToUpperInvariant(), ammoTitle);
        string value = heat ? Math.Ceiling(resources.Flame.Heat * 100).ToString("0") + "%" : magazine.Rounds.ToString("00");
        Label(Slot(82, 29, 93, 34), value, ammoNumber, heat && blocked ? BrandRed : HudNavy);
        Label(Slot(177, 32, 82, 28), heat ? blocked ? "ISINDI" : "HAZIR" : "/ " + magazine.Capacity.ToString("00"), ammoTitle);
        float progress = heat ? (float)resources.Flame.Heat : magazine.Reloading ? (float)magazine.Progress : magazine.Rounds / (float)magazine.Capacity;
        Paint(Slot(79, 63, 181, 13), HudNavy);
        for (int i = 0; i < 10; i++)
        {
            var segment = Slot(82 + i * 17.6f, 65, 15.5f, 9);
            DrawHudIcon(segment, healthSegment, HudTrack, ScaleMode.StretchToFill);
            float amount = Mathf.Clamp01(progress * 10 - i);
            if (amount > 0) DrawHudIcon(new Rect(segment.x, segment.y, segment.width * amount, segment.height), healthSegment, accent, ScaleMode.StretchToFill);
        }
        string caption = heat ? blocked ? "SOGUYOR  " + resources.Flame.Remaining.ToString("0.0") + " sn" : "4 sn ATES / 5 sn SOGUMA"
            : magazine.Reloading ? "DOLDURULUYOR  " + magazine.Remaining.ToString("0.0") + " sn" : "R / DOLDUR  -  YEDEK SINIRSIZ";
        Label(Slot(15, 78, 245, 17), caption, ammoCaption, heat && blocked ? BrandRed : HudNavy);
        ammoHudDrawn = true;
    }
}
