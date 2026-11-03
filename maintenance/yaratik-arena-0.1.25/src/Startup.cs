using System.Diagnostics;
using System.Text.Json;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private bool firstFrameRendered;
    private string startupStage = "";

    private void PublishStartup(string stage, bool failure = false)
    {
        startupStage = stage;
        try
        {
            string file = Path.Combine(Root, "qa", "startup-state.json");
            File.WriteAllText(file + ".tmp", JsonSerializer.Serialize(new
            {
                processId = Process.GetCurrentProcess().Id, stage,
                firstFrameRendered, failed = failure, utc = DateTime.UtcNow.ToString("O")
            }));
            File.Move(file + ".tmp", file, true);
        }
        catch (IOException error) { MelonLoader.MelonLogger.Warning("Startup signal: " + error.Message); }
        catch (UnauthorizedAccessException error) { MelonLoader.MelonLogger.Warning("Startup signal: " + error.Message); }
    }
}
