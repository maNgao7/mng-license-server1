using System;
using System.Diagnostics;
using System.Reflection;
using TikMnG.ArenaStartup;

internal static class StartupExitTests
{
    private static int checks;
    private static void Check(bool pass, string message)
    {
        if (!pass) throw new Exception(message);
        checks++;
    }
    private static Process Child(string arguments)
    {
        return Process.Start(new ProcessStartInfo("cmd.exe", "/d /c " + arguments) {
            UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden
        });
    }
    [STAThread]
    private static int Main()
    {
        try
        {
            foreach (int exitCode in new[] { 0, 17, 42 })
                using (var child = Child("ping -n 2 127.0.0.1 >nul & exit /b " + exitCode))
                {
                    var splash = new StartupWindow(System.IO.Path.GetTempPath(), false, false, false, true);
                    typeof(StartupWindow).GetField("game", BindingFlags.Instance | BindingFlags.NonPublic).SetValue(splash, child);
                    splash.Dispose();
                    Check(Object.ReferenceEquals(splash.StartedGame, child), "Disposing the splash must retain the original owned process");
                    Check(Program.WaitForStartedGame(splash.StartedGame, Process.GetCurrentProcess().Id) == exitCode,
                        "Normal exit and nonzero failure codes must be preserved: " + exitCode);
                    splash.DisposeStartedGame();
                    Check(splash.StartedGame == null, "Release the process handle after monitoring, not when hiding the splash");
                }
            using (var quick = Child("exit /b 23"))
            {
                quick.WaitForExit();
                Check(Program.WaitForStartedGame(quick, 0) == 23, "A process that exits before monitoring starts still has its exact exit code");
            }
            using (var owned = Child("ping -n 30 127.0.0.1 >nul"))
            {
                Check(Program.WaitForStartedGame(owned, Int32.MaxValue) != 0, "Losing the launcher stops only the owned test process");
                Check(owned.HasExited, "No process remains after launcher shutdown");
            }
            bool rejected = false;
            try { Program.WaitForStartedGame(null, 0); }
            catch (InvalidOperationException) { rejected = true; }
            Check(rejected, "A missing real process remains an error, not a silently successful launch");
            Console.WriteLine("{\"passed\":true,\"checks\":" + checks + "}");
            return 0;
        }
        catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }
}
