using System;
using System.Diagnostics;
internal static class ProcessExitProbe
{
    private static int Main()
    {
        var launched = Process.Start(new ProcessStartInfo("cmd.exe", "/d /c ping -n 2 127.0.0.1 >nul & exit /b 0") { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden });
        using (var attached = Process.GetProcessById(launched.Id))
        {
            launched.Dispose();
            attached.WaitForExit();
            try { Console.WriteLine("Reattached exit code: " + attached.ExitCode); return 0; }
            catch (InvalidOperationException error) { Console.WriteLine(error.GetType().Name + ": " + error.Message); return 2; }
        }
    }
}
