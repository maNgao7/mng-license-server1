using TikMnG.CanEmAll;

public static class WeaponResourceTests
{
    public static void Run(Action<bool, string> check)
    {
        var resources = new WeaponResources();
        check(resources.Get(2).Capacity == 12 && resources.Get(4).Capacity == 30, "Pistol 12 and AK30 magazines");
        check(resources.Get(0) == null && resources.Get(1) == null && resources.Get(7) == null, "Melee and flame do not pretend to use bullet magazines");
        foreach (int level in new[] { 2, 3, 4, 5, 6 })
        {
            var m = resources.Get(level);
            check(!m.StartReload(), "Full magazine does not reload " + level);
            for (int i = 0; i < m.Capacity; i++) check(m.Spend(), "Exact loaded shot " + level + ":" + i);
            check(m.Rounds == 0 && !m.Spend(), "No phantom extra bullet " + level);
            check(m.StartReload() && !m.StartReload(), "One reload timer only " + level);
            check(!m.Spend(), "No shots while reloading " + level);
            m.Advance(m.Duration - .001);
            check(m.Reloading && m.Rounds == 0, "No early refill " + level);
            m.Advance(.001);
            check(!m.Reloading && m.Rounds == m.Capacity, "Exact reload completion " + level);
            m.Spend(2 > m.Capacity ? 1 : 2); int before = m.Rounds; m.StartReload(); m.Advance(.1); m.CancelReload();
            check(m.Rounds == before && !m.Reloading, "Switching weapons cancels without free refill " + level);
            m.StartReload(); m.Advance(m.Duration);
            check(m.Rounds == m.Capacity && m.Reloads == 2, "Reload works again " + level);
        }
        var pistol = resources.Get(2); pistol.Spend(); pistol.StartReload();
        resources.Advance(100, true, false);
        check(pistol.Reloading && pistol.Rounds == 11, "Pause cannot complete reload");
        resources.Reset(); check(pistol.Rounds == 12 && !pistol.Reloading, "New round resets magazine and reload pose state");
        var heat = resources.Flame;
        for (int i = 0; i < 239; i++) heat.Burn(1d / 60);
        check(!heat.Overheated && heat.Heat < 1, "Flame fires before four seconds");
        heat.Burn(1d / 60);
        check(heat.Overheated && heat.Remaining == 5 && heat.Heat == 1, "Four seconds causes exact five-second lock");
        check(!heat.Burn(1), "Overheated weapon cannot burn again");
        resources.Advance(10, true, false);
        check(heat.Remaining == 5, "Pause cannot bypass heat lock");
        heat.Advance(4.999, true);
        check(heat.Overheated && !heat.Burn(.1), "Holding trigger cannot shorten cooldown to 4.999 seconds");
        heat.Advance(.001, true);
        check(!heat.Overheated && heat.Heat == 0 && heat.Burn(.1), "Flame resumes at five seconds");
        heat.Reset(); heat.Burn(2); heat.Advance(1, false);
        check(Math.Abs(heat.Heat - .3) < 1e-7 && !heat.Overheated, "Partial heat cools without forced shutdown");
        heat.Advance(100, false); check(heat.Heat == 0, "Heat never negative");
        check(!heat.Burn(double.NaN) && !heat.Burn(-1), "Invalid fire durations rejected");
        var burst = new Magazine(12, 1.6); burst.Spend(); burst.StartReload(); burst.Advance(double.PositiveInfinity);
        check(burst.Reloading, "Invalid timer does not refill a weapon");
        for (int i = 0; i < 20; i++)
        {
            heat.Reset(); heat.Burn(4); heat.Advance(4.99, false);
            check(heat.Overheated, "Repeated cooldown full duration " + i); heat.Advance(.01, false);
            check(!heat.Overheated, "Repeated flame recovers " + i);
        }
    }
}
