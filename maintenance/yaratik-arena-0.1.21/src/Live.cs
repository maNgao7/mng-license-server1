using System.Text.Json;
using System.Text.RegularExpressions;
using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private sealed class LiveStatus
    {
        public string status { get; set; } = "disconnected";
        public string reason { get; set; } = "idle";
        public string message { get; set; } = "Yayin hesabi bekleniyor.";
        public string username { get; set; } = "";
        public string roomId { get; set; } = "";
        public string epoch { get; set; } = "";
        public long received { get; set; }
        public long giftEvents { get; set; }
        public long likeEvents { get; set; }
        public long followEvents { get; set; }
    }

    private sealed class LiveEvent
    {
        public string kind { get; set; } = "";
        public string epoch { get; set; } = "";
        public string username { get; set; } = "";
        public string nickname { get; set; } = "";
        public string giftId { get; set; } = "";
        public string eventId { get; set; } = "";
        public string avatarFile { get; set; } = "";
        public bool highResolution { get; set; }
        public int repeatCount { get; set; } = 1;
        public int likeCount { get; set; }
    }

    private LiveStatus liveStatus = new();
    private System.Diagnostics.Process liveProcess;
    private DateTime liveStartedAt, liveStatusWrittenAt;
    private float nextLivePoll;
    private bool bridgeReady, liveConnectPending;
    private long liveCommandSequence;
    private string pendingBroadcaster = "", liveError = "", lastLiveGift = "";
    private int liveApplied, liveUnmapped;
    private readonly Dictionary<string, string> liveAvatars = new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> highQualityAvatars = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, string> viewerNames = new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> appliedLiveEvents = new();
    private readonly Queue<string> appliedLiveEventOrder = new();
    private readonly AudienceTriggers audience = new();
    private string audienceRoom = "";
    private int likeActionsApplied, followActionsApplied;

    private void ConnectLive(string value)
    {
        string username = value.Trim().TrimStart('@');
        if (!Regex.IsMatch(username, "^[a-zA-Z0-9_.]{1,40}$")) { liveError = "Gecerli bir TikTok kullanici adi gir."; return; }
        settings.BroadcasterUsername = username; settings.AutoConnect = true; SaveSettings();
        liveError = ""; pendingBroadcaster = username; liveConnectPending = true;
        try
        {
            if (liveProcess == null || liveProcess.HasExited)
            {
                string node = Path.Combine(Root, "bridge", "runtime", "node.exe");
                if (!File.Exists(node)) throw new FileNotFoundException("TikTok calisma zamani eksik.", node);
                var start = new System.Diagnostics.ProcessStartInfo(node)
                {
                    WorkingDirectory = Path.Combine(Root, "bridge"), UseShellExecute = false, CreateNoWindow = true
                };
                start.ArgumentList.Add(Path.Combine(Root, "bridge", "index.cjs"));
                start.ArgumentList.Add("--root"); start.ArgumentList.Add(Root);
                start.ArgumentList.Add("--parent-pid"); start.ArgumentList.Add(Environment.ProcessId.ToString());
                liveStartedAt = DateTime.UtcNow; bridgeReady = false; liveStatusWrittenAt = default;
                liveProcess = System.Diagnostics.Process.Start(start);
                liveStatus = new LiveStatus { status = "connecting", username = username, message = "TikTok baglantisi hazirlaniyor." };
            }
            else if (bridgeReady) SendLiveRequest("connect", username);
        }
        catch (Exception e)
        {
            liveConnectPending = false; liveError = e is FileNotFoundException ? "TikTok baglanti dosyalari eksik." : "TikTok baglantisi baslatilamadi.";
            MelonLoader.MelonLogger.Error("Live startup: " + e.Message);
        }
    }

    private void SendLiveRequest(string op, string username = "")
    {
        liveCommandSequence = Math.Max(liveCommandSequence + 1, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        string path = Path.Combine(Data, "live-command.json");
        File.WriteAllText(path + ".tmp", JsonSerializer.Serialize(new { seq = liveCommandSequence, op, username }));
        File.Move(path + ".tmp", path, true);
        liveConnectPending = false;
    }

    private void DisconnectLive()
    {
        settings.AutoConnect = false; SaveSettings(); liveConnectPending = false;
        if (bridgeReady && liveProcess != null && !liveProcess.HasExited) SendLiveRequest("disconnect");
        liveStatus = new LiveStatus();
    }

    private void PollLive()
    {
        if (Time.realtimeSinceStartup < nextLivePoll) return;
        nextLivePoll = Time.realtimeSinceStartup + .15f;
        if (liveProcess == null) return;
        if (liveProcess.HasExited)
        {
            liveConnectPending = false; bridgeReady = false; liveError = "TikTok baglanti araci durdu. Yeniden baglanabilirsin.";
            liveStatus.status = "error"; liveProcess.Dispose(); liveProcess = null; return;
        }
        try
        {
            string path = Path.Combine(Data, "live-status.json");
            var modified = File.GetLastWriteTimeUtc(path);
            if (File.Exists(path) && modified >= liveStartedAt && modified > liveStatusWrittenAt)
            {
                var status = JsonSerializer.Deserialize<LiveStatus>(File.ReadAllText(path));
                if (status != null)
                {
                    liveStatus = status; liveStatusWrittenAt = modified; bridgeReady = true;
                    string room = status.username + ":" + status.roomId;
                    if (status.status == "connected" && audienceRoom != room) { audience.Clear(); audienceRoom = room; }
                    if (liveConnectPending) SendLiveRequest("connect", pendingBroadcaster);
                }
            }
            string directory = Path.Combine(Data, "live-events");
            // Isolated native tests leave incoming events on disk, never discard them.
            if (Time.realtimeSinceStartup < qaLivePauseUntil) return;
            if (!Directory.Exists(directory) || !bridgeReady) return;
            foreach (string file in Directory.EnumerateFiles(directory, "*.json").OrderBy(p => p, StringComparer.Ordinal).Take(32))
            {
                try
                {
                    var item = JsonSerializer.Deserialize<LiveEvent>(File.ReadAllText(file));
                    if (item != null && item.epoch == liveStatus.epoch) ConsumeLiveEvent(item);
                    File.Delete(file);
                }
                catch (Exception e) when (e is JsonException || e is InvalidDataException)
                {
                    File.Delete(file); MelonLoader.MelonLogger.Warning("Invalid live event rejected: " + e.Message);
                }
            }
        }
        catch (IOException) { }
        catch (Exception e) { liveError = "Yayin olaylari okunamadi."; MelonLoader.MelonLogger.Warning(e.Message); }
    }

    private void ConsumeLiveEvent(LiveEvent item)
    {
        if (string.IsNullOrWhiteSpace(item.username)) return;
        if (item.nickname.Length > 0) viewerNames[item.username] = item.nickname;
        if (item.kind == "avatar")
        {
            if (!item.highResolution && highQualityAvatars.Contains(item.username)) return;
            string root = Path.GetFullPath(Path.Combine(Data, "avatars")) + Path.DirectorySeparatorChar;
            string path = Path.GetFullPath(item.avatarFile);
            if (!path.StartsWith(root, StringComparison.OrdinalIgnoreCase) || !File.Exists(path)) return;
            if (!liveAvatars.TryGetValue(item.username, out var existing) || existing != path)
            {
                liveAvatars[item.username] = path;
                if (item.highResolution) highQualityAvatars.Add(item.username);
                if (portraits.Remove(item.username, out var old)) UnityEngine.Object.Destroy(old);
            }
            return;
        }
        if (item.kind is not ("gift" or "like" or "follow") || item.eventId.Length == 0) return;
        string key = item.kind + ":" + item.username + ":" + item.giftId + ":" + item.eventId;
        if (item.eventId.Length > 0 && !appliedLiveEvents.Add(key)) return;
        appliedLiveEventOrder.Enqueue(key);
        while (appliedLiveEventOrder.Count > 5000) appliedLiveEvents.Remove(appliedLiveEventOrder.Dequeue());
        if (item.kind == "like")
        {
            audience.Configure(settings.LikeThreshold);
            if (!settings.LikeAction.Enabled) return;
            int repeats = audience.Like(item.username, item.likeCount);
            if (repeats > 0) { ExecuteAction(settings.LikeAction, repeats, item.username); likeActionsApplied += repeats; }
            return;
        }
        if (item.kind == "follow")
        {
            if (settings.FollowAction.Enabled && audience.Follow(item.username))
            { ExecuteAction(settings.FollowAction, 1, item.username); followActionsApplied++; }
            return;
        }
        var gift = gifts.Find(g => g.id == item.giftId);
        lastLiveGift = (gift?.Title ?? "ID " + item.giftId) + " x" + Math.Clamp(item.repeatCount, 1, 10000) + " / @" + item.username;
        int matched = ApplyGiftActions(item.giftId, item.repeatCount, item.username, fromLive: true);
        if (matched > 0) liveApplied++; else liveUnmapped++;
    }

    private Texture2D LivePortrait(string user)
    {
        if (!liveAvatars.TryGetValue(user, out var path)) return null;
        var image = StbImageSharp.ImageResult.FromMemory(File.ReadAllBytes(path), StbImageSharp.ColorComponents.RedGreenBlueAlpha);
        const int size = 128;
        var rgba = new byte[size * size * 4];
        for (int y = 0; y < size; y++) for (int x = 0; x < size; x++)
        {
            int source = ((y * image.Height / size) * image.Width + x * image.Width / size) * 4, p = (y * size + x) * 4;
            rgba[p] = image.Data[source]; rgba[p + 1] = image.Data[source + 1]; rgba[p + 2] = image.Data[source + 2];
            float dx = x - 63.5f, dy = y - 63.5f;
            rgba[p + 3] = (byte)(image.Data[source + 3] * Math.Clamp(64 - MathF.Sqrt(dx * dx + dy * dy), 0, 1));
        }
        var texture = UploadImage(size, size, rgba); texture.Apply(); return texture;
    }

    public override void OnDeinitializeMelon()
    {
        try
        {
            if (liveProcess == null || liveProcess.HasExited) return;
            SendLiveRequest("shutdown");
            if (!liveProcess.WaitForExit(1200)) liveProcess.Kill(true);
            liveProcess.Dispose();
        }
        catch { }
    }
}
