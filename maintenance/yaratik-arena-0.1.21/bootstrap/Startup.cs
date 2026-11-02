using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace TikMnG.ArenaStartup
{
    internal static class Program
    {
        [STAThread]
        private static int Main(string[] args)
        {
            string root = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".."));
            bool preview = Array.IndexOf(args, "--preview") >= 0;
            bool previewError = Array.IndexOf(args, "--preview-error") >= 0;
            bool noArt = preview && Array.IndexOf(args, "--preview-no-art") >= 0;
            bool probe = Array.IndexOf(args, "--probe") >= 0;
            bool launcherSession = Array.IndexOf(args, "--launcher-session") >= 0;
            int launcherParent = 0;
            foreach (string arg in args)
                if (arg.StartsWith("--launcher-parent=", StringComparison.Ordinal)) Int32.TryParse(arg.Substring(18), out launcherParent);
            Native.SetProcessDPIAware();
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            string mutexName;
            using (var sha = SHA256.Create()) mutexName = "Local\\TikMnG.Arena.Startup." + BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(root))).Replace("-", "");
            bool acquired;
            using (var single = new Mutex(true, mutexName + (preview ? ".Preview" : ""), out acquired))
            {
                if (!acquired) return 0;
                try
                {
                    if (!preview)
                    {
                        string expected = Path.Combine(root, "game", "Can 'Em All Demo.exe");
                        foreach (var running in Process.GetProcessesByName("Can 'Em All Demo"))
                        {
                            using (running)
                            {
                                try { if (String.Equals(running.MainModule.FileName, expected, StringComparison.OrdinalIgnoreCase)) return 0; }
                                catch (System.ComponentModel.Win32Exception) { }
                                catch (InvalidOperationException) { }
                            }
                        }
                    }
                    using (var startup = new StartupWindow(root, preview, previewError, probe, noArt))
                    {
                        Application.Run(startup);
                        if (launcherSession && !preview)
                        {
                            if (!startup.Succeeded || startup.StartedGameId <= 0) return 1;
                            using (var owned = Process.GetProcessById(startup.StartedGameId))
                            {
                                Console.WriteLine("MNG_GAME_READY " + owned.Id.ToString(CultureInfo.InvariantCulture));
                                Console.Out.Flush();
                                while (!owned.WaitForExit(500))
                                {
                                    if (launcherParent <= 0) continue;
                                    try { using (var parent = Process.GetProcessById(launcherParent)) { if (!parent.HasExited) continue; } }
                                    catch (ArgumentException) { }
                                    if (!owned.CloseMainWindow() || !owned.WaitForExit(3000)) owned.Kill();
                                    owned.WaitForExit();
                                    break;
                                }
                                return owned.ExitCode;
                            }
                        }
                    }
                    return 0;
                }
                catch (Exception error)
                {
                    MessageBox.Show("TikMnG acilisi baslatilamadi.\n" + error.Message, "TikMnG", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return 1;
                }
                finally { single.ReleaseMutex(); }
            }
        }
    }

    internal sealed class BootSignal
    {
        public int processId { get; set; }
        public string stage { get; set; }
        public bool firstFrameRendered { get; set; }
        public bool failed { get; set; }
        public string utc { get; set; }
    }

    internal sealed class StartupWindow : Form
    {
        private readonly string root;
        private readonly bool preview, previewError, probe;
        private readonly Stopwatch clock = Stopwatch.StartNew();
        private readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
        private readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 4 * 1024 * 1024 };
        private readonly Dictionary<string, object> trace = new Dictionary<string, object>();
        private readonly Button cancel = new Button(), logs = new Button(), errorClose = new Button();
        private readonly ToolTip tips = new ToolTip();
        private Image cover, logo, closeIcon, logIcon;
        private Process game;
        private IntPtr owner;
        private bool painted, launching, handoff, startupError, previewA, previewB;
        private double fadeAt = -1, nextPoll;
        private string status = "Oyun ba\u015flat\u0131l\u0131yor";
        private int paintedFrames;
        private readonly Font brandFont = new Font("Segoe UI", 15, FontStyle.Bold, GraphicsUnit.Pixel);
        private readonly Font statusFont = new Font("Segoe UI", 14, FontStyle.Regular, GraphicsUnit.Pixel);
        private readonly Font errorFont = new Font("Segoe UI", 13, FontStyle.Regular, GraphicsUnit.Pixel);
        public bool Succeeded { get { return handoff && !startupError; } }
        public int StartedGameId { get; private set; }

        public StartupWindow(string directory, bool isPreview, bool isErrorPreview, bool isProbe, bool noArt)
        {
            root = directory; preview = isPreview; previewError = isErrorPreview; probe = isProbe;
            BackColor = Color.FromArgb(12, 15, 19);
            FormBorderStyle = FormBorderStyle.None; ShowInTaskbar = false;
            Text = "TikMnG - Yarat\u0131k Arena"; StartPosition = FormStartPosition.CenterScreen;
            var area = Screen.PrimaryScreen.WorkingArea;
            ClientSize = new Size(Math.Min(1280, area.Width), Math.Min(720, area.Height));
            DoubleBuffered = true; KeyPreview = true;
            cover = noArt ? null : ReadImage("publishing/yaratik-arena-cover-v1.png");
            logo = ReadImage("TikMnG-logo-v3.png"); closeIcon = ReadImage("ui-X.png"); logIcon = ReadImage("ui-ListChecks.png");
            ConfigureButton(cancel, "", closeIcon); cancel.AccessibleName = "Acilisi iptal et";
            cancel.Size = new Size(32, 32); cancel.Click += delegate { Close(); }; tips.SetToolTip(cancel, "Acilisi iptal et");
            ConfigureButton(logs, "G\u00fcnl\u00fc\u011f\u00fc a\u00e7", logIcon);
            logs.Size = new Size(152, 36); logs.Visible = false; logs.Click += delegate { OpenLog(); };
            ConfigureButton(errorClose, "Kapat", closeIcon); errorClose.Size = new Size(112, 36); errorClose.Visible = false; errorClose.Click += delegate { Close(); };
            Controls.Add(cancel); Controls.Add(logs); Controls.Add(errorClose);
            Resize += delegate { PositionCommands(); }; PositionCommands();
            KeyDown += delegate(object sender, KeyEventArgs e) { if (e.KeyCode == Keys.Escape) Close(); };
            timer.Interval = 33; timer.Tick += delegate { TickStartup(); };
            trace["hostProcessId"] = Process.GetCurrentProcess().Id;
            trace["startedUtc"] = DateTime.UtcNow.ToString("O"); trace["preview"] = preview;
        }

        private Image ReadImage(string relative)
        {
            string file = Path.Combine(root, "assets", relative.Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(file)) return null;
            try { using (var source = Image.FromFile(file)) return new Bitmap(source); }
            catch (IOException) { return null; }
            catch (ArgumentException) { return null; }
            catch (OutOfMemoryException) { return null; }
        }

        private void ConfigureButton(Button button, string label, Image icon)
        {
            button.Text = label; button.Font = errorFont; button.ForeColor = Color.White;
            button.BackColor = Color.FromArgb(25, 30, 36); button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderSize = 0; button.Cursor = Cursors.Hand;
            if (icon != null) button.Image = new Bitmap(icon, new Size(18, 18));
            button.ImageAlign = label.Length == 0 ? ContentAlignment.MiddleCenter : ContentAlignment.MiddleLeft;
            button.TextImageRelation = label.Length == 0 ? TextImageRelation.Overlay : TextImageRelation.ImageBeforeText;
            button.Padding = label.Length == 0 ? Padding.Empty : new Padding(10, 0, 10, 0);
        }

        private void PositionCommands()
        {
            cancel.Location = new Point(ClientSize.Width - 48, 16);
            logs.Location = new Point(ClientSize.Width - 296, ClientSize.Height - 68);
            errorClose.Location = new Point(ClientSize.Width - 132, ClientSize.Height - 68);
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e); trace["shownUtc"] = DateTime.UtcNow.ToString("O"); timer.Start();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e); DrawScene(e.Graphics, ClientSize, clock.Elapsed.TotalSeconds);
            paintedFrames++;
            if (!painted) { painted = true; trace["firstPaintUtc"] = DateTime.UtcNow.ToString("O"); }
        }

        private void DrawScene(Graphics g, Size canvas, double seconds)
        {
            g.Clear(Color.FromArgb(12, 15, 19));
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            float width = canvas.Width, height = canvas.Height;
            if (cover != null)
            {
                float fit = Math.Min(width / cover.Width, height / cover.Height);
                // Small ease-in, not a looping flash or a delayed mandatory intro.
                float zoom = width / height > 1.7f ? 1 + .018f * (float)(1 - Math.Exp(-seconds / 3)) : 1;
                float w = cover.Width * fit * zoom, h = cover.Height * fit * zoom;
                g.DrawImage(cover, new RectangleF((width - w) / 2, (height - h) / 2, w, h));
            }
            int band = startupError ? 142 : 102;
            using (var dark = new SolidBrush(Color.FromArgb(248, 12, 15, 19))) g.FillRectangle(dark, 0, height - band, width, band);
            float logoSize = height < 640 ? 48 : 56, left = 24, top = height - band + 22;
            if (logo != null) g.DrawImage(logo, left, top, logoSize, logoSize);
            float textX = logo == null ? left : left + logoSize + 18;
            using (var white = new SolidBrush(Color.FromArgb(245, 247, 250))) g.DrawString("TikMnG / YARATIK ARENA", brandFont, white, textX, top + 2);
            float statusWidth = startupError ? Math.Max(130, width - textX - 330) : width - textX - 28;
            using (var muted = new SolidBrush(startupError ? Color.FromArgb(255, 122, 140) : Color.FromArgb(182, 200, 209)))
            using (var format = new StringFormat { Trimming = StringTrimming.EllipsisCharacter, FormatFlags = StringFormatFlags.NoWrap })
                g.DrawString(status, statusFont, muted, new RectangleF(textX, top + 29, statusWidth, 25), format);
            float railY = height - 5;
            using (var track = new SolidBrush(Color.FromArgb(39, 48, 56))) g.FillRectangle(track, 0, railY, width, 5);
            if (!startupError)
            {
                float segment = Math.Min(200, width * .22f);
                float phase = (float)(seconds % 2.8 / 2.8);
                float x = (width + segment) * phase - segment;
                using (var cyan = new SolidBrush(Color.FromArgb(22, 213, 218))) g.FillRectangle(cyan, x, railY, segment, 5);
                using (var red = new SolidBrush(Color.FromArgb(241, 19, 73))) g.FillRectangle(red, x + segment - 24, railY, 24, 5);
            }
            else using (var red = new SolidBrush(Color.FromArgb(241, 19, 73))) g.FillRectangle(red, 0, railY, width, 5);
        }

        private void TickStartup()
        {
            double elapsed = clock.Elapsed.TotalSeconds;
            if (!painted) return;
            if (!launching)
            {
                launching = true;
                if (!preview) LaunchGame();
                else if (previewError) ShowFailure("Ba\u015flatma tamamlanamad\u0131. G\u00fcnl\u00fc\u011f\u00fc kontrol edin.");
            }
            if (preview)
            {
                if (!previewA && elapsed >= .35) { previewA = true; SavePreview("a"); }
                if (!previewB && elapsed >= 1.2) { previewB = true; SavePreview("b"); }
                if (elapsed > 2.2) { handoff = true; Close(); return; }
            }
            else if (game != null && elapsed >= nextPoll)
            {
                nextPoll = elapsed + .1;
                try
                {
                    if (game.HasExited)
                    {
                        ShowFailure("Oyun haz\u0131r olmadan kapand\u0131. G\u00fcnl\u00fc\u011f\u00fc kontrol edin.");
                    }
                    else
                    {
                        FollowGameWindow();
                        var signal = ReadSignal(Path.Combine(root, "qa", "startup-state.json"));
                        if (signal != null && signal.processId == game.Id)
                        {
                            if (signal.failed) ShowFailure("Ba\u015flatma tamamlanamad\u0131. G\u00fcnl\u00fc\u011f\u00fc kontrol edin.");
                            else if (signal.firstFrameRendered && !startupError && fadeAt < 0)
                            {
                                fadeAt = elapsed; trace["readyFrameUtc"] = signal.utc; trace["readyObservedUtc"] = DateTime.UtcNow.ToString("O");
                            }
                            else if (!startupError) status = StageText(signal.stage);
                        }
                        if (elapsed > 300 && fadeAt < 0 && !startupError) ShowFailure("A\u00e7\u0131l\u0131\u015f beklenenden uzun s\u00fcrd\u00fc. G\u00fcnl\u00fc\u011f\u00fc kontrol edin.");
                    }
                }
                catch (InvalidOperationException) { ShowFailure("Oyun i\u015flemi kapand\u0131."); }
            }
            if (fadeAt >= 0)
            {
                double age = elapsed - fadeAt;
                if (age >= .18)
                {
                    bool activate = Native.GetForegroundWindow() == Handle || Native.GetForegroundWindow() == owner;
                    handoff = true; trace["outcome"] = "ready"; trace["handoffUtc"] = DateTime.UtcNow.ToString("O");
                    if (activate && owner != IntPtr.Zero) Native.SetForegroundWindow(owner);
                    Close(); return;
                }
                Opacity = Math.Max(.01, 1 - age / .18);
            }
            Invalidate();
        }

        private static string StageText(string stage)
        {
            switch (stage)
            {
                case "settings": return "Ayarlar y\u00fckleniyor";
                case "hooks": return "Oyun haz\u0131rlan\u0131yor";
                case "arena": return "Arena haz\u0131rlan\u0131yor";
                case "assets": return "G\u00f6rseller haz\u0131rlan\u0131yor";
                case "first-frame": return "Arena a\u00e7\u0131l\u0131yor";
                default: return "Oyun motoru ba\u015flat\u0131l\u0131yor";
            }
        }

        private void LaunchGame()
        {
            try
            {
                var info = new ProcessStartInfo(Path.Combine(root, "game", "Can 'Em All Demo.exe"));
                info.WorkingDirectory = Path.Combine(root, "game"); info.UseShellExecute = false;
                info.EnvironmentVariables["DOTNET_ROOT"] = Path.Combine(root, "runtime");
                info.EnvironmentVariables["DOTNET_ROOT_X64"] = Path.Combine(root, "runtime");
                info.EnvironmentVariables["DOTNET_MULTILEVEL_LOOKUP"] = "0";
                info.EnvironmentVariables["SteamAppId"] = "5364590"; info.EnvironmentVariables["SteamGameId"] = "5364590";
                var display = Screen.PrimaryScreen.Bounds;
                info.Arguments = "-screen-fullscreen 1 -window-mode borderless -screen-width " + display.Width + " -screen-height " + display.Height + " --melonloader.hideconsole --melonloader.disablestartscreen -logFile \"" + Path.Combine(root, "qa", "player.log") + "\"" + (probe ? " --tikmng-probe" : "");
                info.WindowStyle = ProcessWindowStyle.Hidden;
                game = Process.Start(info); StartedGameId = game.Id; trace["gameProcessId"] = game.Id;
                trace["gameStartedUtc"] = game.StartTime.ToUniversalTime().ToString("O");
                SaveTrace();
            }
            catch (Exception error)
            {
                trace["launchError"] = error.GetType().Name + ": " + error.Message;
                ShowFailure("Oyun ba\u015flat\u0131lamad\u0131. G\u00fcnl\u00fc\u011f\u00fc kontrol edin.");
            }
        }

        private void FollowGameWindow()
        {
            game.Refresh(); IntPtr window = game.MainWindowHandle;
            if (window == IntPtr.Zero)
                Native.EnumWindows(delegate(IntPtr candidate, IntPtr unused)
                {
                    uint pid; Native.GetWindowThreadProcessId(candidate, out pid);
                    if (pid != game.Id) return true;
                    var name = new StringBuilder(128); Native.GetClassName(candidate, name, name.Capacity);
                    if (name.ToString() != "UnityWndClass") return true;
                    window = candidate; return false;
                }, IntPtr.Zero);
            if (window == IntPtr.Zero) return;
            if (owner != window)
            {
                owner = window; Native.SetWindowLongPtr(Handle, -8, window);
                trace["ownerAttachedUtc"] = DateTime.UtcNow.ToString("O");
                trace["gameInitiallyVisible"] = Native.IsWindowVisible(window);
            }
            Native.Rect rect; var point = new Native.Point();
            if (!Native.GetClientRect(window, out rect) || !Native.ClientToScreen(window, ref point) || rect.Right < 100 || rect.Bottom < 100) return;
            var bounds = new Rectangle(point.X, point.Y, rect.Right, rect.Bottom);
            if (Bounds != bounds) Bounds = bounds;
            if (!Native.IsWindowVisible(window)) { Native.ShowWindow(window, 4); trace["revealedUnderCoverUtc"] = DateTime.UtcNow.ToString("O"); }
        }

        private BootSignal ReadSignal(string file)
        {
            try
            {
                using (var stream = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
                using (var reader = new StreamReader(stream)) return json.Deserialize<BootSignal>(reader.ReadToEnd());
            }
            catch (IOException) { return null; }
            catch (UnauthorizedAccessException) { return null; }
            catch (ArgumentException) { return null; }
        }

        private void ShowFailure(string message)
        {
            if (startupError) return;
            startupError = true; fadeAt = -1; Opacity = 1;
            status = message; logs.Visible = errorClose.Visible = true;
            trace["outcome"] = "error"; trace["errorUtc"] = DateTime.UtcNow.ToString("O"); SaveTrace();
        }

        private void OpenLog()
        {
            string file = Path.Combine(root, "qa", "startup-launch.json");
            try { Process.Start(new ProcessStartInfo("notepad.exe", "\"" + file + "\"") { UseShellExecute = false }); }
            catch (Exception error) { trace["logOpenError"] = error.Message; SaveTrace(); }
        }

        private void SavePreview(string suffix)
        {
            string prefix = previewError ? "startup-error-" : cover == null ? "startup-no-art-" : "startup-preview-";
            foreach (var size in new[] { new Size(1280, 720), new Size(800, 600) })
                using (var image = new Bitmap(size.Width, size.Height))
                {
                    using (var g = Graphics.FromImage(image)) DrawScene(g, size, clock.Elapsed.TotalSeconds);
                    image.Save(Path.Combine(root, "qa", prefix + size.Width + "-" + suffix + ".png"), ImageFormat.Png);
                }
            using (var image = new Bitmap(ClientSize.Width, ClientSize.Height))
            {
                DrawToBitmap(image, ClientRectangle);
                image.Save(Path.Combine(root, "qa", prefix + "window-" + suffix + ".png"), ImageFormat.Png);
            }
        }

        private void SaveTrace()
        {
            try
            {
                Directory.CreateDirectory(Path.Combine(root, "qa"));
                trace["paintedFrames"] = paintedFrames;
                string file = Path.Combine(root, "qa", preview ? (previewError ? "startup-error-preview.json" : cover == null ? "startup-no-art-preview.json" : "startup-preview.json") : "startup-launch.json");
                File.WriteAllText(file, json.Serialize(trace), new UTF8Encoding(false));
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            timer.Stop();
            if (!handoff && game != null)
            {
                try { if (!game.HasExited && !game.CloseMainWindow()) game.Kill(); }
                catch (InvalidOperationException) { }
                if (!startupError) trace["outcome"] = "cancelled";
            }
            trace["closedUtc"] = DateTime.UtcNow.ToString("O"); SaveTrace();
            base.OnFormClosing(e);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                timer.Dispose(); tips.Dispose();
                foreach (var image in new[] { cover, logo, closeIcon, logIcon, cancel.Image, logs.Image, errorClose.Image }) if (image != null) image.Dispose();
                brandFont.Dispose(); statusFont.Dispose(); errorFont.Dispose(); if (game != null) game.Dispose();
            }
            base.Dispose(disposing);
        }
    }

    internal static class Native
    {
        [StructLayout(LayoutKind.Sequential)] internal struct Rect { public int Left, Top, Right, Bottom; }
        [StructLayout(LayoutKind.Sequential)] internal struct Point { public int X, Y; }
        [DllImport("user32.dll")] internal static extern bool GetClientRect(IntPtr window, out Rect rect);
        [DllImport("user32.dll")] internal static extern bool ClientToScreen(IntPtr window, ref Point point);
        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] internal static extern IntPtr SetWindowLongPtr(IntPtr window, int index, IntPtr value);
        [DllImport("user32.dll")] internal static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] internal static extern bool SetForegroundWindow(IntPtr window);
        internal delegate bool EnumWindowsProc(IntPtr window, IntPtr parameter);
        [DllImport("user32.dll")] internal static extern bool EnumWindows(EnumWindowsProc callback, IntPtr parameter);
        [DllImport("user32.dll")] internal static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern int GetClassName(IntPtr window, StringBuilder name, int capacity);
        [DllImport("user32.dll")] internal static extern bool IsWindowVisible(IntPtr window);
        [DllImport("user32.dll")] internal static extern bool ShowWindow(IntPtr window, int command);
        [DllImport("user32.dll")] internal static extern bool SetProcessDPIAware();
    }
}
