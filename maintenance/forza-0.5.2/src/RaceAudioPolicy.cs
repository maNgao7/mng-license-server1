namespace TikMnG.Arcade;

// Pure routing/timing decisions shared by the runtime and executable regressions.
public static class RaceAudioPolicy
{
    public const string EngineBus="bus:/World SFX/Engines";
    public const float FreeCameraAttenuationRadius=12f;
    public static float? BusVolume(string path,float engine,float crowd,bool staging)
    {
        if(path.Equals(EngineBus,StringComparison.OrdinalIgnoreCase))return engine;
        if(path.Contains("crowd",StringComparison.OrdinalIgnoreCase))return crowd;
        return null;
    }
    public static double CountdownSeconds(uint milliseconds)=>Math.Max(3,milliseconds/1000d);
    public static string CountdownLabel(float elapsed,float duration)
    {
        // Cue offsets from the retained 3.40–8.00s excerpt of the approved recording.
        var recorded=duration is >4.5f and <4.7f;
        if(elapsed<(recorded?1.30f:1))return "3";
        if(elapsed<(recorded?2.62f:2))return "2";
        if(elapsed<(recorded?3.57f:3))return "1";
        return "BAŞLA";
    }
    public static bool PresentationAllowed(bool countdown,string phase)=>false;
}
