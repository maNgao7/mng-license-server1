using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

internal static class FetihDesktop
{
    [DllImport("user32.dll")] private static extern bool ShowWindowAsync(IntPtr window, int command);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);

    [STAThread]
    private static int Main()
    {
        bool first;
        using (var startup = new Mutex(true, @"Local\TikMnG.Fetih.Desktop.Start", out first))
        {
            if (!first) return 0;
            try
            {
                foreach (var game in Process.GetProcessesByName("Fetih"))
                {
                    using (game)
                    {
                        if (game.SessionId != Process.GetCurrentProcess().SessionId || game.HasExited) continue;
                        var window = game.MainWindowHandle;
                        if (window != IntPtr.Zero)
                        {
                            ShowWindowAsync(window, 9);
                            SetForegroundWindow(window);
                        }
                        return 0;
                    }
                }

                var directory = AppDomain.CurrentDomain.BaseDirectory;
                var executable = Path.Combine(directory, "Fetih.exe");
                var pack = Path.Combine(directory, "Fetih.pck");
                if (!File.Exists(executable) || !File.Exists(pack))
                    throw new FileNotFoundException("Fetih dosyaları eksik. Oyun klasörünün tamamını yeniden çıkar.");
                using (Process.Start(new ProcessStartInfo(executable, "-- --desktop-profile")
                {
                    WorkingDirectory = directory,
                    UseShellExecute = false
                })) { }
                return 0;
            }
            catch (Exception error)
            {
                MessageBox.Show(error.Message, "TikMnG · Fetih", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
            finally { startup.ReleaseMutex(); }
        }
    }
}
