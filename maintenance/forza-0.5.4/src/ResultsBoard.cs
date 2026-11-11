using System.Globalization;
using System.Text.Json;
#if !RESULTS_BOARD_TESTS
using CircuitSuperstars.TrackData;
using Il2CppInterop.Runtime.Attributes;
using Il2CppInterop.Runtime.InteropTypes.Arrays;
using TMPro;
using UnityEngine;
using UnityEngine.Rendering;
using UObj = UnityEngine.Object;
#endif

namespace TikMnG.Arcade;

internal sealed class ResultsBoardFinish
{
    public int Place { get; set; }
    public string Username { get; set; } = "";
    public string Nickname { get; set; } = "";
    public string Avatar { get; set; } = "";
    public float Time { get; set; }
}

internal sealed class ResultsBoardUser
{
    public string Username { get; set; } = "";
    public string Nickname { get; set; } = "";
    public long First { get; set; }
    public long Second { get; set; }
    public long Third { get; set; }
    public float BestTime { get; set; }
    public float LastTime { get; set; }
    public int LastLaps { get; set; }
    public Dictionary<int, float> BestByLaps { get; set; } = new();
    public DateTime LastFinishUtc { get; set; }
}

internal sealed class ResultsBoardData
{
    public int Version { get; set; } = 3;
    public long Rounds { get; set; }
    public List<ResultsBoardUser> Users { get; set; } = new();
    public List<string> RecordedRoundIds { get; set; } = new();
    public ResultsBoardFinish[] RecentTop3 { get; set; } = Array.Empty<ResultsBoardFinish>();
    public ResultsBoardFinish[] RecentParticipants { get; set; } = Array.Empty<ResultsBoardFinish>();
    public int RecentRound { get; set; }
    public int RecentLaps { get; set; }
    public DateTime RecentUtc { get; set; }
}

// Independent of Unity: one validated podium is committed atomically, including its dedup key.
internal sealed class ResultsBoardStore
{
    private static readonly JsonSerializerOptions Options = new() { WriteIndented = true, PropertyNameCaseInsensitive = true };
    public string FilePath { get; }
    public ResultsBoardData Data { get; private set; } = new();
    public bool Dirty { get; private set; }
    public string LoadWarning { get; private set; }
    public long Revision { get; private set; }

    public ResultsBoardStore(string file)
    {
        FilePath = Path.GetFullPath(file);
        if (!File.Exists(FilePath)) return;
        try { Data = Read(FilePath); }
        catch (Exception ex) when (ex is IOException or JsonException or InvalidDataException)
        {
            // Never turn an unreadable existing history into an empty, writable history.
            if (!File.Exists(FilePath + ".bak")) throw;
            Data = Read(FilePath + ".bak");
            LoadWarning = "Recovered results-board backup: " + ex.Message;
        }
    }

    private static ResultsBoardData Read(string file)
    {
        var data = JsonSerializer.Deserialize<ResultsBoardData>(File.ReadAllText(file), Options);
        if (data == null || data.Version is not (1 or 2 or 3) || data.Rounds < 0 || data.Users == null ||
            data.RecordedRoundIds == null || data.RecentTop3 == null || data.RecentTop3.Length > 3)
            throw new InvalidDataException("Unsupported results-board history.");
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var user in data.Users)
        {
            if (user == null) throw new InvalidDataException("Invalid results-board user.");
            var hasTiming = user.BestTime > 0 || user.LastTime > 0 || user.LastLaps > 0 || user.BestByLaps?.Count > 0;
            if (!ValidUsername(user.Username) || !names.Add(Key(user.Username)) ||
                user.First < 0 || user.Second < 0 || user.Third < 0 ||
                (hasTiming && (!ValidTime(user.BestTime) || !ValidTime(user.LastTime) || user.LastLaps < 1)) ||
                (!hasTiming && (user.BestTime != 0 || user.LastTime != 0 || user.LastLaps != 0)) || user.BestByLaps == null ||
                user.BestByLaps.Any(p => p.Key < 1 || !ValidTime(p.Value)))
                throw new InvalidDataException("Invalid results-board user.");
        }
        if (data.RecentTop3.Any(f => f == null || !ValidUsername(f.Username) || !ValidOptionalTime(f.Time) || f.Place is < 1 or > 3))
            throw new InvalidDataException("Invalid recent results-board podium.");
        foreach(var finish in data.RecentTop3)finish.Avatar=AvatarFile(finish.Avatar);
        data.RecentParticipants??=Array.Empty<ResultsBoardFinish>();
        if(data.RecentParticipants.Length>128||data.RecentParticipants.Any(f=>f==null||!ValidUsername(f.Username)||
            f.Place<1||f.Place>128||!float.IsFinite(f.Time)||f.Time<0||f.Time>=86400)||
            data.RecentParticipants.Select(f=>Key(f.Username)).Distinct().Count()!=data.RecentParticipants.Length)
            throw new InvalidDataException("Invalid recent race participants.");
        foreach(var finish in data.RecentParticipants)finish.Avatar=AvatarFile(finish.Avatar);
        data.Version=3;
        return data;
    }

    public bool Record(string roundId, int round, int laps, IEnumerable<ResultsBoardFinish> results, DateTime utc,
        IEnumerable<ResultsBoardFinish> participants=null)
    {
        if (string.IsNullOrWhiteSpace(roundId) || laps < 1 || round < 1) return false;
        if (Data.RecordedRoundIds.Contains(roundId, StringComparer.Ordinal)) return false;
        var winners = results?.OrderBy(f => f?.Place ?? int.MaxValue).ToArray();
        if (winners == null || winners.Length is < 1 or > 3) return false;
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < winners.Length; i++)
            if (winners[i] == null || winners[i].Place != i + 1 || !ValidUsername(winners[i].Username) ||
                !ValidOptionalTime(winners[i].Time) || !names.Add(Key(winners[i].Username))) return false;

        var all=(participants??winners).OrderBy(f=>f?.Place??int.MaxValue).ToArray();
        var allNames=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if(all.Length<winners.Length||all.Length>128)return false;
        for(var i=0;i<all.Length;i++)
        {
            var f=all[i];
            if(f==null||f.Place!=i+1||!ValidUsername(f.Username)||!allNames.Add(Key(f.Username))||
                !float.IsFinite(f.Time)||f.Time<0||f.Time>=86400)return false;
            if(i<winners.Length&&(Key(f.Username)!=Key(winners[i].Username)||f.Time!=winners[i].Time))return false;
        }
        foreach (var finish in all)
        {
            var key = Key(finish.Username);
            var user = Data.Users.FirstOrDefault(u => Key(u.Username) == key);
            if (user == null) Data.Users.Add(user = new ResultsBoardUser { Username = key });
            user.Nickname = SingleLine(finish.Nickname, 64);
            if (finish.Place<=winners.Length)
            {
                if(finish.Place==1)user.First=Increment(user.First);
                else if(finish.Place==2)user.Second=Increment(user.Second);
                else if(finish.Place==3)user.Third=Increment(user.Third);
            }
            if(finish.Time==0)continue;
            user.BestTime = user.BestTime > 0 ? Math.Min(user.BestTime, finish.Time) : finish.Time;
            if (!user.BestByLaps.TryGetValue(laps, out var best) || finish.Time < best) user.BestByLaps[laps] = finish.Time;
            user.LastTime = finish.Time; user.LastLaps = laps; user.LastFinishUtc = utc;
        }
        Data.RecentTop3 = winners.Select(f => new ResultsBoardFinish {
            Place = f.Place, Username = Key(f.Username), Nickname = SingleLine(f.Nickname, 64), Avatar = AvatarFile(f.Avatar), Time = f.Time
        }).ToArray();
        Data.RecentParticipants=all.Select(f=>new ResultsBoardFinish{
            Place=f.Place,Username=Key(f.Username),Nickname=SingleLine(f.Nickname,64),Avatar=AvatarFile(f.Avatar),Time=f.Time
        }).ToArray();
        Data.RecentRound = round; Data.RecentLaps = laps; Data.RecentUtc = utc;
        Data.Rounds = Increment(Data.Rounds);
        Data.RecordedRoundIds.Add(roundId);
        if (Data.RecordedRoundIds.Count > 512) Data.RecordedRoundIds.RemoveAt(0);
        Dirty = true; Revision++;
        return true;
    }

    public static string AvatarFile(string file)
    {
        if(string.IsNullOrEmpty(file)||file.Length>128||!file.StartsWith("tiktok-bridge-avatar-",StringComparison.Ordinal)||
            !file.EndsWith(".png",StringComparison.Ordinal)||!file.All(c=>c is >= 'a' and <= 'z' or >= 'A' and <= 'Z' or >= '0' and <= '9' or '-' or '.'))return "";
        return file;
    }

    public bool UpdateRecentAvatar(string username,string avatar)
    {
        avatar=AvatarFile(avatar);
        if(avatar.Length==0)return false;
        var changed=false;
        foreach(var finish in Data.RecentTop3.Concat(Data.RecentParticipants).Where(f=>Key(f.Username)==Key(username)))
            if(finish.Avatar!=avatar){finish.Avatar=avatar;changed=true;}
        if(!changed)return false;
        Dirty=true;Revision++;
        return true;
    }

    public void Save()
    {
        if (!Dirty) return;
        Directory.CreateDirectory(Path.GetDirectoryName(FilePath));
        var pending = FilePath + ".tmp";
        using (var stream = new FileStream(pending, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            JsonSerializer.Serialize(stream, Data, Options);
            stream.Flush(true);
        }
        if (File.Exists(FilePath))
        {
            // A recovered backup must not be replaced by the corrupt primary on the next save.
            if (LoadWarning == null) File.Replace(pending, FilePath, FilePath + ".bak");
            else File.Move(pending, FilePath, true);
        }
        else File.Move(pending, FilePath);
        Dirty = false; LoadWarning = null;
    }

    public bool EnsureUser(string username, string nickname)
    {
        if (!ValidUsername(username)) return false;
        var key = Key(username);
        var user = Data.Users.FirstOrDefault(u => Key(u.Username) == key);
        if (user != null)
        {
            var clean = SingleLine(nickname, 64);
            if (string.IsNullOrWhiteSpace(clean) || user.Nickname == clean) return false;
            user.Nickname = clean;
        }
        else Data.Users.Add(new ResultsBoardUser { Username = key, Nickname = SingleLine(nickname, 64) });
        Dirty = true; Revision++;
        return true;
    }

    public ResultsBoardUser[] Standings(int laps) => Data.Users.OrderByDescending(u => u.First)
        .ThenBy(u => u.BestByLaps.TryGetValue(laps, out var time) ? time : float.MaxValue)
        .ThenBy(u => u.Username, StringComparer.Ordinal).ToArray();

    public ResultsBoardUser[] TrackRecords(int laps) => Data.Users
        .Where(u => u.BestByLaps.ContainsKey(laps))
        .OrderBy(u => u.BestByLaps[laps])
        .ThenBy(u => u.Username, StringComparer.Ordinal).ToArray();

    public ResultsBoardUser[] TrackRecordStandings(int laps) => Data.Users
        .OrderBy(u => u.BestByLaps.ContainsKey(laps) ? 0 : 1)
        .ThenBy(u => u.BestByLaps.TryGetValue(laps, out var time) ? time : float.MaxValue)
        .ThenBy(u => u.Username, StringComparer.Ordinal).ToArray();

    public static int PageCount(int count)=>Math.Max(1,(Math.Max(0,count-3)+8)/9);
    public static int VisibleRank(int row,int page)=>row<3?row:3+page*9+row-3;
    public const int RecentExtraRows = 8;
    public static int RecentExtraPageCount(int count) => Math.Max(1, (Math.Max(0, count - 3) + RecentExtraRows - 1) / RecentExtraRows);
    public static int RecentExtraIndex(int row, int page) => 3 + page * RecentExtraRows + row;

    // Keep the last-race podium visible while clearing lifetime wins and lap records.
    public bool ResetRecords()
    {
        if (Data.Users.Count == 0 && Data.Rounds == 0 && Data.RecordedRoundIds.Count == 0) return false;
        Data.Users.Clear(); Data.Rounds = 0; Data.RecordedRoundIds.Clear();
        Dirty = true; Revision++;
        return true;
    }

    public bool AdjustPlacement(string username, string nickname, int place, int delta)
    {
        if (!ValidUsername(username) || place is < 1 or > 3 || delta is not (-1 or 1)) return false;
        var key = Key(username);
        var user = Data.Users.FirstOrDefault(u => Key(u.Username) == key);
        if (user == null)
        {
            if (delta < 0) return false;
            Data.Users.Add(user = new ResultsBoardUser { Username = key, Nickname = SingleLine(nickname, 64) });
        }
        else if (!string.IsNullOrWhiteSpace(nickname)) user.Nickname = SingleLine(nickname, 64);
        var current = place == 1 ? user.First : place == 2 ? user.Second : user.Third;
        if (delta < 0 && current == 0) return false;
        var next = delta > 0 ? Increment(current) : current - 1;
        if (place == 1) user.First = next;
        else if (place == 2) user.Second = next;
        else user.Third = next;
        Dirty = true; Revision++;
        return true;
    }

    public static bool ValidTime(float time) => float.IsFinite(time) && time > 0 && time < 86400;
    private static bool ValidOptionalTime(float time) => float.IsFinite(time) && time >= 0 && time < 86400;
    private static long Increment(long value) => value == long.MaxValue ? value : value + 1;
    private static string Key(string username) => username.Trim().TrimStart('@').ToLowerInvariant();
    private static bool ValidUsername(string username)
    {
        if (string.IsNullOrWhiteSpace(username)) return false;
        var key = Key(username);
        return key.Length is > 0 and <= 64 && key.All(c => c is >= 'a' and <= 'z' or >= '0' and <= '9' or '_' or '.');
    }
    public static bool IsQaUsername(string username)
    {
        var key = Key(username ?? "");
        return key.StartsWith("qa_", StringComparison.Ordinal) || key.StartsWith("model_", StringComparison.Ordinal) || key.StartsWith("native_", StringComparison.Ordinal) ||
            key == "test_izleyici" || (key.StartsWith("test", StringComparison.Ordinal) && key.Length > 4 && key[4..].All(char.IsDigit));
    }
    public static string SingleLine(string value, int limit) => new((value ?? "").Where(c => !char.IsControl(c)).Take(limit).ToArray());
    public static string DisplayUser(string username)
    {
        var label = "@" + SingleLine(username, 64);
        return label.Length > 23 ? label[..20] + "..." : label;
    }
    public static string FormatTime(float seconds)
    {
        if (!ValidTime(seconds)) return "--:--.--";
        var hundredths = (long)Math.Floor(seconds * 100.0 + .0001);
        return string.Format(CultureInfo.InvariantCulture, "{0:00}:{1:00}.{2:00}", hundredths / 6000, hundredths / 100 % 60, hundredths % 100);
    }
}

#if !RESULTS_BOARD_TESTS
public sealed partial class ArcadeDirector
{
    private const float ResultsBoardWidth = 42, ResultsBoardHeight = 13.5f;
    private const int ResultsBoardRows = 12;
    private readonly string resultsBoardSession = Guid.NewGuid().ToString("N");
    private ResultsBoardStore resultsBoardStore;
    private string resultsBoardQaRun, resultsBoardDataError, resultsBoardSceneError, resultsBoardNotice, resultsBoardMount, resultsBoardRoofSource;
    private bool resultsBoardModeResolved;
    private GameObject resultsBoardRoot;
    private Mesh resultsBoardQuad;
    private Mesh resultsBoardDisc;
    private sealed class BoardPortrait
    {
        public MeshRenderer Renderer;
        public TextMeshPro Fallback;
        public string File="";
    }
    private readonly List<BoardPortrait> resultsBoardPortraits=new();
    private TMP_FontAsset resultsBoardFont;
    private Material resultsBoardTextMaterial;
    private readonly List<Material> resultsBoardMaterials = new();
    private readonly List<TextMeshPro> resultsBoardLabels = new();
    private readonly List<TextMeshPro[]> resultsBoardCells = new();
    private readonly List<TextMeshPro[]> resultsBoardRecordCells = new();
    private readonly List<TextMeshPro[]> resultsBoardRecent = new();
    private readonly List<TextMeshPro[]> resultsBoardParticipants=new();
    private GameObject resultsBoardPodiumGroup,resultsBoardParticipantsGroup;
    private Transform resultsBoardBuildParent;
    private bool resultsBoardShowingParticipants;
    private int resultsBoardRecentPage=-1;
    private DateTime resultsBoardRecentUtc;
    private float resultsBoardRecentStarted;
    private TextMeshPro resultsBoardSubtitle, resultsBoardFooter, resultsBoardRecentTitle, resultsBoardEmpty, resultsBoardRecordsEmpty, resultsBoardResetText;
    private GameObject resultsBoardResetButton;
    private Vector3 resultsBoardGrid;
    private float resultsBoardRoofY, resultsBoardNextUpdate, resultsBoardNextSave;
    private int resultsBoardRoofSamples, resultsBoardPage, resultsBoardShownLaps;
    private long resultsBoardShownRevision = -1;

    private string ResultsBoardFile => Path.Combine(control, resultsBoardQaRun == null ? "results-board.json" :
        Path.Combine("qa", "results-board-" + resultsBoardQaRun + ".json"));

    private bool LoadResultsBoardStore()
    {
        if (resultsBoardStore != null) return true;
        if (resultsBoardDataError != null) return false;
        if (!resultsBoardModeResolved)
        {
            resultsBoardModeResolved = true;
            if (File.Exists(Path.Combine(control, "results-board-qa.flag"))) resultsBoardQaRun = "native";
        }
        try
        {
            resultsBoardStore = new ResultsBoardStore(ResultsBoardFile);
            if (resultsBoardStore.LoadWarning != null) Plugin.Output.LogWarning(resultsBoardStore.LoadWarning);
            return true;
        }
        catch (Exception ex) { resultsBoardDataError = ex.Message; Plugin.Output.LogWarning("Results board history: " + ex.Message); return false; }
    }

    // Main command integration may select a separate QA history before running a test round.
    [HideFromIl2Cpp]
    public bool SetResultsBoardQaMode(string runId)
    {
        var id = string.IsNullOrWhiteSpace(runId) ? null : runId.Trim();
        if (id != null && (id.Length > 64 || !id.All(c => c is >= 'a' and <= 'z' or >= 'A' and <= 'Z' or >= '0' and <= '9' or '_' or '-')))
            return false;
        try { resultsBoardStore?.Save(); }
        catch (Exception ex) { resultsBoardDataError = ex.Message; return false; }
        resultsBoardModeResolved = true; resultsBoardQaRun = id; resultsBoardStore = null;
        resultsBoardDataError = null; resultsBoardNotice = null; resultsBoardShownRevision = -1; resultsBoardNextUpdate = 0;
        return LoadResultsBoardStore();
    }

    [HideFromIl2Cpp]
    public void RecordRoundResults()
    {
        if (phase != "podium" || roundWinners.Count == 0 || !LoadResultsBoardStore()) return;
        foreach (var entry in entries) resultsBoardStore.EnsureUser(entry.Username, entry.Nickname);
        var winners = roundWinners.Select(w => new ResultsBoardFinish {
            Place = w.Place, Username = w.Username, Nickname = w.Nickname, Avatar = w.Avatar, Time = w.Time
        });
        var native=CircuitSuperstars.RaceManager.Instance?.RacerData;
        float TimeFor(ViewerCar entry)=>native!=null&&native.FinishTimes.ContainsKey(entry.Id)&&
            RaceEconomy.ValidFinish(native.IsFinished(entry.Id),native.FinishTimes[entry.Id],CurrentLap(entry),settings.Laps)
            ?native.FinishTimes[entry.Id]:0;
        var other=entries.Where(e=>!roundWinners.Any(w=>w.Username==e.Username))
            .OrderBy(e=>TimeFor(e)>0?0:1).ThenBy(e=>TimeFor(e)>0?TimeFor(e):float.MaxValue)
            .ThenBy(e=>RacePlace(e)>0?RacePlace(e):int.MaxValue);
        var ordered=roundWinners.Select(w=>entries.First(e=>e.Username==w.Username)).Concat(other).ToArray();
        var participants=ordered.Select((e,i)=>new ResultsBoardFinish{Place=i+1,Username=e.Username,Nickname=e.Nickname,Avatar=e.Avatar,Time=TimeFor(e)});
        if (!resultsBoardStore.Record(resultsBoardSession + ":" + roundNumber, roundNumber, settings.Laps, winners, DateTime.UtcNow,participants))
        {
            resultsBoardNotice = "Yaris sonucu panoya kaydedilemedi.";
            return;
        }
        resultsBoardNotice = "Son yaris, kazananlar ve pist rekorlari guncellendi.";
        SaveResultsBoardStore(); resultsBoardNextUpdate = 0;
    }

    private void RegisterResultsBoardParticipant(ViewerCar entry)
    {
        if(LoadResultsBoardStore()&&resultsBoardStore.EnsureUser(entry.Username,entry.Nickname))
        {SaveResultsBoardStore();resultsBoardNextUpdate=0;}
    }

    private void UpdateResultsBoardAvatar(string username,string avatar)
    {
        if(resultsBoardStore?.UpdateRecentAvatar(username,avatar)!=true)return;
        SaveResultsBoardStore();resultsBoardNextUpdate=0;
    }

    [HideFromIl2Cpp]
    public bool AdjustResultsBoardPlacement(string username, int place, int delta)
    {
        if (!LoadResultsBoardStore()) return false;
        var key = (username ?? "").Trim().TrimStart('@').ToLowerInvariant();
        var nickname = entries.FirstOrDefault(e => e.Username.Equals(key, StringComparison.OrdinalIgnoreCase))?.Nickname ?? "";
        if (!resultsBoardStore.AdjustPlacement(key, nickname, place, delta)) return false;
        SaveResultsBoardStore(); resultsBoardNextUpdate = 0; resultsBoardShownRevision = -1;
        resultsBoardNotice = "@" + key + " / " + place + ". sıra " + (delta > 0 ? "+1" : "-1");
        return true;
    }

    [HideFromIl2Cpp]
    public bool TryResetResultsBoardAtCrosshair()
    {
        if (view == null || resultsBoardResetButton == null || !LoadResultsBoardStore()) return false;
        var ray = view.ViewportPointToRay(new Vector3(.5f, .5f, 0));
        var aimedAtReset = Physics.RaycastAll(ray, 2000, ~0, QueryTriggerInteraction.Collide)
            .Any(hit => hit.collider != null && hit.collider.gameObject.Pointer == resultsBoardResetButton.Pointer);
        if (!aimedAtReset) return false;
        if (resultsBoardStore.ResetRecords()) SaveResultsBoardStore();
        resultsBoardNotice = "Kalici rekor listesi sifirlandi.";
        resultsBoardShownRevision = -1; resultsBoardNextUpdate = 0;
        return true;
    }

    private void SaveResultsBoardStore()
    {
        try { resultsBoardStore?.Save(); resultsBoardDataError = null; }
        catch (Exception ex)
        {
            if (resultsBoardDataError != ex.Message) Plugin.Output.LogWarning("Results board save: " + ex.Message);
            resultsBoardDataError = ex.Message;
        }
        resultsBoardNextSave = Time.unscaledTime + 10;
    }

    [HideFromIl2Cpp]
    public void UpdateResultsBoard()
    {
        LoadResultsBoardStore();
        if (resultsBoardStore?.Dirty == true && Time.unscaledTime >= resultsBoardNextSave) SaveResultsBoardStore();
        if (!cameraReady || phase == "resetting")
        {
            if (resultsBoardRoot != null || resultsBoardMaterials.Count > 0) ClearResultsBoardScene();
            return;
        }
        if (Time.unscaledTime < resultsBoardNextUpdate) return;
        resultsBoardNextUpdate = Time.unscaledTime + .5f;
        try
        {
            if (resultsBoardRoot == null)
            {
                ClearResultsBoardScene();
                resultsBoardNextUpdate = Time.unscaledTime + 3;
                if (!CreateResultsBoard()) return;
            }
            RefreshResultsBoardText(); RefreshResultsBoardPortraits(); resultsBoardSceneError = null;
        }
        catch (Exception ex)
        {
            var previous = resultsBoardSceneError;
            ClearResultsBoardScene(); resultsBoardSceneError = ex.Message;
            resultsBoardNextUpdate = Time.unscaledTime + 15;
            if (previous != ex.Message) Plugin.Output.LogWarning("Results board scene: " + ex.Message);
        }
    }

    private bool CreateResultsBoard()
    {
        var track = UObj.FindObjectOfType<TrackSceneData>();
        if (track?.vehicleSpawnMarkerList?.markers == null || track.vehicleSpawnMarkerList.markers.Length == 0) return false;
        var grid = track.vehicleSpawnMarkerList.markers[0];
        // Confirmed in control/track-materials.json: this mesh is the pit garage row, not a warehouse.
        var garage = UObj.FindObjectsOfType<MeshRenderer>().FirstOrDefault(r => r.gameObject.activeInHierarchy &&
            r.gameObject.scene.IsValid() && r.name == "pCube447" && ScenePath(r.transform).Contains("PF_TsukubaPaddock_01/", StringComparison.Ordinal));
        if (garage == null) { resultsBoardSceneError = "Waiting for Tsukuba pit garage mesh pCube447."; return false; }
        var forward = Vector3.ProjectOnPlane(grid.forward, Vector3.up).normalized;
        var side = Vector3.Cross(Vector3.up, forward).normalized;
        if (Vector3.Dot(garage.bounds.center - grid.position, side) < 0) side = -side;
        var lateral = Mathf.Clamp(Vector3.Dot(garage.bounds.center - grid.position, side), 15, 25);
        var roofPoint = grid.position + forward * 20 + side * lateral;
        var mesh = garage.GetComponent<MeshFilter>()?.sharedMesh;
        var roof = float.MinValue; var samples = 0;
        if (mesh != null && mesh.isReadable)
        {
            var vertices = mesh.vertices;
            for (var i = 0; i < vertices.Length; i++)
            {
                var point = garage.transform.TransformPoint(vertices[i]);
                var delta = point - roofPoint;
                if (Mathf.Abs(Vector3.Dot(delta, forward)) > ResultsBoardWidth / 2 + 1 || Mathf.Abs(Vector3.Dot(delta, side)) > 7) continue;
                if (point.y < grid.position.y + 3) continue;
                roof = Math.Max(roof, point.y); samples++;
            }
            resultsBoardRoofSource = "garage mesh vertices";
        }
        if (samples == 0)
        {
            // Some shipped meshes disable CPU reads; query the existing building collision instead.
            foreach (var along in new[] { -16f, -8f, 0f, 8f, 16f })
                foreach (var across in new[] { -4f, 0f, 4f })
                {
                    var origin = roofPoint + forward * along + side * across;
                    origin.y = garage.bounds.max.y + 5;
                    if (!Physics.Raycast(origin, Vector3.down, out var hit, garage.bounds.size.y + 15, ~0, QueryTriggerInteraction.Ignore) ||
                        hit.point.y < grid.position.y + 3 || hit.point.y > garage.bounds.max.y + 1) continue;
                    roof = Math.Max(roof, hit.point.y); samples++;
                }
            resultsBoardRoofSource = "native roof raycasts";
        }
        if (samples == 0) throw new InvalidOperationException("No pit roof geometry near the first grid (CPU mesh and roof raycasts unavailable).");
        resultsBoardFont = Resources.FindObjectsOfTypeAll<TMP_FontAsset>()
            .Where(f => f != null && f.material != null && f.material.shader != null && f.material.shader.isSupported && f.HasCharacters("0123456789SIRA"))
            .OrderByDescending(f => "\u0130\u015e\u00c7\u00dc\u00d6".Count(c => f.HasCharacter(c, true, false)))
            .ThenBy(f => f.name, StringComparer.Ordinal).FirstOrDefault();
        if (resultsBoardFont == null) throw new InvalidOperationException("Waiting for a loaded TextMeshPro font.");

        resultsBoardGrid = grid.position; resultsBoardRoofY = roof; resultsBoardRoofSamples = samples;
        resultsBoardMount = ScenePath(garage.transform);
        resultsBoardRoot = new GameObject("TikMnG Results Board - Pit Garage Roof");
        resultsBoardRoot.transform.position = new Vector3(roofPoint.x, roof + 2.5f + ResultsBoardHeight / 2, roofPoint.z);
        // TMP's visible front is local -Z. Keep the sign fixed, facing the starting straight.
        resultsBoardRoot.transform.rotation = Quaternion.LookRotation(side, Vector3.up);
        resultsBoardRoot.transform.SetParent(garage.transform, true);
        resultsBoardQuad = new Mesh { name = "TikMnG results board quad" };
        resultsBoardQuad.vertices = new Il2CppStructArray<Vector3>(new[] { new Vector3(-.5f,-.5f,0), new Vector3(.5f,-.5f,0), new Vector3(.5f,.5f,0), new Vector3(-.5f,.5f,0) });
        resultsBoardQuad.normals = new Il2CppStructArray<Vector3>(Enumerable.Repeat(Vector3.back, 4).ToArray());
        resultsBoardQuad.uv = new Il2CppStructArray<Vector2>(new[] { new Vector2(0,0), new Vector2(1,0), new Vector2(1,1), new Vector2(0,1) });
        resultsBoardQuad.triangles = new Il2CppStructArray<int>(new[] { 0,2,1,0,3,2 });
        resultsBoardQuad.RecalculateBounds();
        var dark = ResultsBoardMaterial(new Color(.012f,.017f,.021f));
        var alternate = ResultsBoardMaterial(new Color(.05f,.059f,.066f));
        var accent = ResultsBoardMaterial(new Color(.04f,.82f,.72f));
        var warm = ResultsBoardMaterial(new Color(.96f,.30f,.16f));
        var gold = ResultsBoardMaterial(new Color(1f,.72f,.20f));
        var silver = ResultsBoardMaterial(new Color(.70f,.79f,.84f));
        var bronze = ResultsBoardMaterial(new Color(.83f,.43f,.24f));
        var frame = ResultsBoardMaterial(new Color(.13f,.15f,.17f));
        ResultsBoardPanel("Outer chassis", 0, 0, ResultsBoardWidth + .7f, ResultsBoardHeight + .7f, .12f, frame);
        ResultsBoardPanel("Rear cover", 0, 0, ResultsBoardWidth + .2f, ResultsBoardHeight + .2f, .18f, dark);
        ResultsBoardPanel("Display", 0, 0, ResultsBoardWidth, ResultsBoardHeight, 0, dark);
        ResultsBoardPanel("Header band", 0, 5.58f, ResultsBoardWidth, 2.25f, -.025f, alternate);
        ResultsBoardPanel("Header red", -20.75f, 5.58f, .5f, 2.25f, -.055f, warm);
        for(var tile=0;tile<16;tile++)
            ResultsBoardPanel("Chequered header " + tile, -20.6f+tile*.43f, 4.47f, .43f, .16f, -.06f, tile%2==0?silver:dark);
        ResultsBoardPanel("Section divider left", -6.4f, -.55f, .08f, 9.45f, -.05f, frame);
        ResultsBoardPanel("Section divider right", 7.2f, -.55f, .08f, 9.45f, -.05f, frame);
        ResultsBoardPanel("Wins accent", .4f, 4.17f, 12.9f, .10f, -.05f, accent);
        ResultsBoardPanel("Records accent", 13.9f, 4.17f, 12.9f, .10f, -.05f, warm);
        ResultsBoardPanel("Podium accent", -13.6f, 4.17f, 13.9f, .10f, -.05f, gold);
        foreach (var x in new[] { -16f, 16f }) ResultsBoardPanel("Roof support", x, -ResultsBoardHeight / 2 - .8f, .62f, 1.6f, .08f, frame);
        resultsBoardTextMaterial = new Material(resultsBoardFont.material) { name = "TikMnG results world text", renderQueue = 3000 };
        resultsBoardMaterials.Add(resultsBoardTextMaterial);
        if (resultsBoardTextMaterial.HasProperty("_ZTestMode")) resultsBoardTextMaterial.SetFloat("_ZTestMode", (float)CompareFunction.LessEqual);
        if (resultsBoardTextMaterial.HasProperty("_CullMode")) resultsBoardTextMaterial.SetFloat("_CullMode", 0);
        ResultsBoardText("Brand", "TURKISH FORZA 0.5", -20.05f, 5.72f, 12.7f, .9f, 15, Color.white);
        ResultsBoardText("Title", "TikMnG  /  YARI\u015e MERKEZ\u0130", -5.75f, 5.87f, 19.8f, .85f, 15, Color.white);
        resultsBoardSubtitle = ResultsBoardText("Subtitle", "", -5.75f, 5.06f, 19.8f, .48f, 7.5f, new Color(.66f,.76f,.78f));
        resultsBoardResetButton = ResultsBoardPanel("Reset records button", 17.8f, 5.55f, 5.7f, 1.12f, -.08f, frame);
        resultsBoardResetButton.AddComponent<BoxCollider>();
        resultsBoardResetText = ResultsBoardText("Reset records text", "L\u0130STEY\u0130 SIFIRLA", 14.95f, 5.55f, 5.7f, .72f, 8.5f, Color.white, true);
        resultsBoardRecentTitle = ResultsBoardText("Recent title", "", -20.1f, 3.55f, 13.1f, .65f, 10, new Color(1f,.78f,.34f));
        ResultsBoardText("Wins title", "EN ÇOK KAZANANLAR", -5.75f, 3.55f, 12.3f, .65f, 10, new Color(.54f,.94f,.87f));
        ResultsBoardText("Records title", "P\u0130ST REKORLARI", 7.85f, 3.55f, 12.2f, .65f, 10, new Color(1f,.57f,.38f));
        var headings = new[] { "#", "YARI\u015e\u00c7I", "GAL\u0130B\u0130YET" };
        var starts = new[] { -5.75f, -4.35f, 3.15f };
        var widths = new[] { 1.15f, 7.25f, 2.25f };
        var colors = new[] { Color.white, Color.white, new Color(1,.8f,.3f) };
        for (var column = 0; column < headings.Length; column++)
            ResultsBoardText("Column " + column, headings[column], starts[column], 2.75f, widths[column], .55f, 8, colors[column], column != 1);
        var recordHeadings = new[] { "#", "YARI\u015e\u00c7I", "S\u00dcRE" };
        var recordStarts = new[] { 7.85f, 9.2f, 16.55f };
        var recordWidths = new[] { 1.1f, 7.15f, 3.5f };
        for (var column = 0; column < recordHeadings.Length; column++)
            ResultsBoardText("Record column " + column, recordHeadings[column], recordStarts[column], 2.75f, recordWidths[column], .55f, 8, column == 2 ? new Color(1f,.66f,.45f) : Color.white, column != 1);
        ResultsBoardPanel("Wins header rule", .4f, 2.33f, 12.9f, .05f, -.04f, frame);
        ResultsBoardPanel("Records header rule", 13.9f, 2.33f, 12.9f, .05f, -.04f, frame);
        for (var row = 0; row < ResultsBoardRows; row++)
        {
            var y = 1.95f - row * .64f;
            if (row % 2 == 0)
            {
                ResultsBoardPanel("Wins row " + row, .4f, y, 12.9f, .58f, -.02f, alternate);
                ResultsBoardPanel("Record row " + row, 13.9f, y, 12.9f, .58f, -.02f, alternate);
            }
            var cells = new TextMeshPro[headings.Length];
            for (var column = 0; column < cells.Length; column++)
                cells[column] = ResultsBoardText("Cell " + row + ":" + column, "", starts[column], y, widths[column], .52f, 7.6f, colors[column], column != 1);
            resultsBoardCells.Add(cells);
            var recordCells = new TextMeshPro[recordHeadings.Length];
            for (var column = 0; column < recordCells.Length; column++)
                recordCells[column] = ResultsBoardText("Record cell " + row + ":" + column, "", recordStarts[column], y, recordWidths[column], .52f, 7.6f, column == 2 ? new Color(1f,.66f,.45f) : Color.white, column != 1);
            resultsBoardRecordCells.Add(recordCells);
        }
        resultsBoardEmpty = ResultsBoardText("Wins empty state", "", -5.75f, -.4f, 12.3f, 1.2f, 11, Color.white, true);
        resultsBoardRecordsEmpty = ResultsBoardText("Records empty state", "", 7.85f, -.4f, 12.2f, 1.2f, 11, Color.white, true);
        var podiumX = new[] { -13.6f, -18.05f, -9.15f };
        var portraitY = new[] { 2.19f, 1.99f, 1.99f };
        resultsBoardPodiumGroup=new GameObject("Recent race podium");resultsBoardPodiumGroup.transform.SetParent(resultsBoardRoot.transform,false);
        resultsBoardBuildParent=resultsBoardPodiumGroup.transform;
        for (var i = 0; i < 3; i++)
        {
            var x = podiumX[i];
            var medal = i == 0 ? new Color(1f,.77f,.25f) : i == 1 ? new Color(.76f,.86f,.92f) : new Color(.96f,.59f,.35f);
            var metal=i==0?gold:i==1?silver:bronze;
            ResultsBoardPanel("Podium card " + i, x, 1.37f, 4.27f, 3.63f, -.025f, alternate);
            ResultsBoardPanel("Podium rail " + i, x, -.44f, 4.27f, .08f, -.06f, metal);
            var diameter=i==0?1.75f:1.48f;
            ResultsBoardCircle("Medallion shadow " + i,x,portraitY[i]-.08f,diameter+.43f,-.035f,alternate);
            ResultsBoardCircle("Portrait outer rim " + i,x,portraitY[i],diameter+.22f,-.045f,metal);
            ResultsBoardCircle("Portrait inset " + i,x,portraitY[i],diameter+.08f,-.065f,dark);
            ResultsBoardCircle("Portrait inner rim " + i,x,portraitY[i],diameter,-.08f,metal);
            var avatarMaterial=ResultsBoardPortraitMaterial();
            var avatarPanel=ResultsBoardCircle("Winner portrait " + i,x,portraitY[i],diameter-.14f,-.10f,avatarMaterial);
            ResultsBoardCircle("Medal pin " + i,x,portraitY[i]+diameter*.47f,.54f,-.13f,metal);
            var pin=ResultsBoardText("Medal number " + i,(i+1).ToString(),x-.25f,portraitY[i]+diameter*.47f,.50f,.43f,8,new Color(.07f,.08f,.11f),true);
            pin.transform.localPosition=new Vector3(pin.transform.localPosition.x,pin.transform.localPosition.y,-.15f);
            var fallback=ResultsBoardText("Portrait fallback " + i,"",x-diameter/2,portraitY[i],diameter,diameter*.7f,18,medal,true);
            resultsBoardPortraits.Add(new BoardPortrait{Renderer=avatarPanel.GetComponent<MeshRenderer>(),Fallback=fallback});
            resultsBoardRecent.Add(new[] {
                ResultsBoardText("Podium name " + i, "", x-2.05f, .85f, 4.1f, .48f, 10f, Color.white,true),
                ResultsBoardText("Podium time " + i, "", x-1.95f, .28f, 3.9f, .45f, 8f, medal,true)
            });
        }
        resultsBoardParticipantsGroup=new GameObject("Recent race all participants");resultsBoardParticipantsGroup.transform.SetParent(resultsBoardRoot.transform,false);
        resultsBoardBuildParent=resultsBoardParticipantsGroup.transform;
        foreach(var column in new[]{("#",-20.1f,1.1f),("YARIŞÇI",-18.75f,7.6f),("SONUÇ",-10.85f,4.0f)})
            ResultsBoardText("Participant header "+column.Item1,column.Item1,column.Item2,-.88f,column.Item3,.46f,8,Color.white);
        for(var row=0;row<ResultsBoardStore.RecentExtraRows;row++)
        {
            var y=-1.47f-row*.58f;
            resultsBoardParticipants.Add(new[]{
                ResultsBoardText("Participant rank "+row,"",-20.1f,y,1.1f,.52f,7.6f,Color.white,true),
                ResultsBoardText("Participant name "+row,"",-18.75f,y,7.6f,.52f,7.6f,Color.white),
                ResultsBoardText("Participant finish "+row,"",-10.85f,y,4f,.52f,7.6f,new Color(1f,.78f,.34f),true)});
        }
        resultsBoardBuildParent=null;resultsBoardParticipantsGroup.SetActive(false);
        resultsBoardFooter = ResultsBoardText("Footer", "", -20.1f, -5.95f, 39.9f, .48f, 7.5f, new Color(.49f,.58f,.62f));
        Plugin.Output.LogInfo("Results board mounted on " + resultsBoardMount + " at " + resultsBoardRoot.transform.position + "; sampled roof y=" + roof.ToString("0.00", CultureInfo.InvariantCulture));
        return true;
    }

    private Material ResultsBoardMaterial(Color color)
    {
        var shader = Shader.Find("Universal Render Pipeline/Unlit");
        if (shader == null || !shader.isSupported) shader = VehicleShader();
        var material = new Material(shader) { name = "TikMnG results board panel" };
        resultsBoardMaterials.Add(material);
        foreach (var key in new[] { "_BaseColor", "_Color" }) if (material.HasProperty(key)) material.SetColor(key, color);
        foreach (var key in new[] { "_BaseMap", "_MainTex" }) if (material.HasProperty(key)) material.SetTexture(key, Texture2D.whiteTexture);
        if (material.HasProperty("_Cull")) material.SetFloat("_Cull", 0);
        if (material.HasProperty("_Smoothness")) material.SetFloat("_Smoothness", 0);
        return material;
    }

    private Material ResultsBoardPortraitMaterial()
    {
        var shader=Shader.Find("Unlit/Transparent");
        if(shader==null||!shader.isSupported)shader=Shader.Find("Universal Render Pipeline/Unlit");
        var material=new Material(shader){name="TikMnG podium portrait",renderQueue=3000};
        resultsBoardMaterials.Add(material);
        foreach(var key in new[]{"_Color","_BaseColor"})if(material.HasProperty(key))material.SetColor(key,Color.white);
        if(material.HasProperty("_Surface"))material.SetFloat("_Surface",1);
        if(material.HasProperty("_SrcBlend"))material.SetFloat("_SrcBlend",(float)BlendMode.SrcAlpha);
        if(material.HasProperty("_DstBlend"))material.SetFloat("_DstBlend",(float)BlendMode.OneMinusSrcAlpha);
        if(material.HasProperty("_ZWrite"))material.SetFloat("_ZWrite",0);
        if(material.HasProperty("_Cull"))material.SetFloat("_Cull",0);
        material.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
        return material;
    }

    private GameObject ResultsBoardCircle(string name,float x,float y,float diameter,float z,Material material)
    {
        if(resultsBoardDisc==null)
        {
            const int segments=96;
            var vertices=new Vector3[segments+1];var uv=new Vector2[segments+1];var triangles=new int[segments*3];
            uv[0]=new Vector2(.5f,.5f);
            for(var i=0;i<segments;i++)
            {
                var angle=i*2*Mathf.PI/segments;
                vertices[i+1]=new Vector3(Mathf.Cos(angle)*.5f,Mathf.Sin(angle)*.5f,0);
                uv[i+1]=new Vector2(vertices[i+1].x+.5f,vertices[i+1].y+.5f);
                triangles[i*3]=0;triangles[i*3+1]=(i+1)%segments+1;triangles[i*3+2]=i+1;
            }
            resultsBoardDisc=new Mesh{name="TikMnG podium medallion"};
            resultsBoardDisc.vertices=new Il2CppStructArray<Vector3>(vertices);
            resultsBoardDisc.uv=new Il2CppStructArray<Vector2>(uv);
            resultsBoardDisc.triangles=new Il2CppStructArray<int>(triangles);
            resultsBoardDisc.RecalculateNormals();resultsBoardDisc.RecalculateBounds();
        }
        var disc=ResultsBoardPanel(name,x,y,diameter,diameter,z,material);
        disc.GetComponent<MeshFilter>().sharedMesh=resultsBoardDisc;
        return disc;
    }

    private void RefreshResultsBoardPortraits()
    {
        for(var i=0;i<resultsBoardPortraits.Count;i++)
        {
            var slot=resultsBoardPortraits[i];
            var finish=resultsBoardStore?.Data.RecentTop3.FirstOrDefault(f=>f.Place==i+1);
            var file=ResultsBoardStore.AvatarFile(finish?.Avatar);
            var texture=Portrait(file);
            slot.Renderer.enabled=texture!=null;
            if(texture!=null&&slot.File!=file)
            {
                foreach(var key in new[]{"_MainTex","_BaseMap"})if(slot.Renderer.sharedMaterial.HasProperty(key))slot.Renderer.sharedMaterial.SetTexture(key,texture);
                slot.File=file;
            }
            slot.Fallback.text=texture!=null?"":finish==null?"?":finish.Username.TrimStart('@')[..1].ToUpperInvariant();
            slot.Fallback.ForceMeshUpdate();
        }
    }

    private GameObject ResultsBoardPanel(string name, float x, float y, float width, float height, float z, Material material)
    {
        var panel = new GameObject(name); panel.transform.SetParent(resultsBoardBuildParent??resultsBoardRoot.transform, false);
        panel.transform.localPosition = new Vector3(x, y, z); panel.transform.localScale = new Vector3(width, height, 1);
        panel.AddComponent<MeshFilter>().sharedMesh = resultsBoardQuad;
        var renderer = panel.AddComponent<MeshRenderer>(); renderer.sharedMaterial = material;
        renderer.shadowCastingMode = ShadowCastingMode.Off; renderer.receiveShadows = false;
        return panel;
    }

    private TextMeshPro ResultsBoardText(string name, string value, float x, float y, float width, float height, float size, Color color, bool centered = false)
    {
        var label = new GameObject(name); label.transform.SetParent(resultsBoardBuildParent??resultsBoardRoot.transform, false);
        var text = label.AddComponent<TextMeshPro>();
        text.font = resultsBoardFont; text.fontSharedMaterial = resultsBoardTextMaterial;
        text.richText = false; text.isOverlay = false; text.textWrappingMode = TextWrappingModes.NoWrap;
        text.overflowMode = TextOverflowModes.Ellipsis;
        text.alignment = centered ? TextAlignmentOptions.Midline : TextAlignmentOptions.MidlineLeft;
        text.color = color; text.fontSize = size; text.fontSizeMax = size; text.fontSizeMin = 1; text.enableAutoSizing = true;
        text.rectTransform.sizeDelta = new Vector2(width, height);
        label.transform.localPosition = new Vector3(x + width / 2, y, -.12f);
        text.text = value;
        text.renderer.shadowCastingMode = ShadowCastingMode.Off; text.renderer.receiveShadows = false;
        resultsBoardLabels.Add(text);
        return text;
    }

    private void RefreshResultsBoardText()
    {
        var standings = resultsBoardStore?.Standings(settings.Laps) ?? Array.Empty<ResultsBoardUser>();
        var records = resultsBoardStore?.TrackRecordStandings(settings.Laps) ?? Array.Empty<ResultsBoardUser>();
        var pages = Math.Max(ResultsBoardStore.PageCount(standings.Length),ResultsBoardStore.PageCount(records.Length));
        var page = (int)(Time.unscaledTime / 8) % pages;
        var data = resultsBoardStore?.Data;
        var all=data?.RecentParticipants??Array.Empty<ResultsBoardFinish>();
        var recentUtc=data?.RecentUtc??default;
        if(recentUtc!=resultsBoardRecentUtc)
        {
            resultsBoardRecentUtc=recentUtc;
            resultsBoardRecentStarted=Time.unscaledTime;
        }
        var recentPages=ResultsBoardStore.RecentExtraPageCount(all.Length);
        var recentPage=(int)((Time.unscaledTime-resultsBoardRecentStarted)/8)%recentPages;
        var revision = resultsBoardStore?.Revision ?? -2;
        if (revision == resultsBoardShownRevision && settings.Laps == resultsBoardShownLaps && page == resultsBoardPage&&recentPage==resultsBoardRecentPage) return;
        resultsBoardShownRevision = revision; resultsBoardShownLaps = settings.Laps; resultsBoardPage = page;
        resultsBoardRecentPage=recentPage;resultsBoardShowingParticipants=all.Length>3;
        resultsBoardParticipantsGroup.SetActive(resultsBoardShowingParticipants);
        resultsBoardSubtitle.text = "TSUKUBA  /  P\u0130T GARAJI  /  " + (data?.Rounds ?? 0) + " YARI\u015e" + (resultsBoardQaRun == null ? "" : "  /  QA");
        for (var row = 0; row < ResultsBoardRows; row++)
        {
            var index = ResultsBoardStore.VisibleRank(row,page);
            var user = index < standings.Length ? standings[index] : null;
            var values = user == null ? new string[3] : new[] {
                (index + 1).ToString(CultureInfo.InvariantCulture), ResultsBoardStore.DisplayUser(user.Username),
                user.First.ToString(CultureInfo.InvariantCulture) + "X"
            };
            for (var column = 0; column < values.Length; column++) resultsBoardCells[row][column].text = values[column] ?? "";
            var record = index < records.Length ? records[index] : null;
            var recordValues = record == null ? new string[3] : new[] {
                (index + 1).ToString(CultureInfo.InvariantCulture), ResultsBoardStore.DisplayUser(record.Username),
                record.BestByLaps.TryGetValue(settings.Laps, out var recordTime) ? ResultsBoardStore.FormatTime(recordTime) : "SÜRE YOK"
            };
            for (var column = 0; column < recordValues.Length; column++) resultsBoardRecordCells[row][column].text = recordValues[column] ?? "";
        }
        for(var row=0;row<resultsBoardParticipants.Count;row++)
        {
            var participantIndex=ResultsBoardStore.RecentExtraIndex(row,recentPage);
            var entrant=participantIndex<all.Length?all[participantIndex]:null;
            var participantValues=entrant==null?new string[3]:new[]{entrant.Place.ToString(),ResultsBoardStore.DisplayUser(entrant.Username),entrant.Time>0?ResultsBoardStore.FormatTime(entrant.Time):"BİTİRMEDİ"};
            for(var col=0;col<3;col++)resultsBoardParticipants[row][col].text=participantValues[col]??"";
        }
        resultsBoardEmpty.text = standings.Length > 0 ? "" : resultsBoardDataError != null ? "SONU\u00c7 KAYDI OKUNAMADI" : "HEN\u00dcZ KAZANAN YOK";
        resultsBoardRecordsEmpty.text = records.Length > 0 ? "" : resultsBoardDataError != null ? "REKOR KAYDI OKUNAMADI" : "HEN\u00dcZ REKOR YOK";
        resultsBoardRecentTitle.text = data?.RecentTop3.Length > 0 ? "SON YARI\u015e  /  " + data.RecentLaps+" TUR  /  "+Math.Max(all.Length,data.RecentTop3.Length)+" KATILIMCI" : "SON YARI\u015e";
        for (var i = 0; i < 3; i++)
        {
            var winner = data?.RecentTop3.FirstOrDefault(f => f.Place == i + 1);
            resultsBoardRecent[i][0].text = winner == null ? "--" : ResultsBoardStore.DisplayUser(winner.Username);
            resultsBoardRecent[i][1].text = winner!=null&&winner.Time==0?"BİTİRMEDİ":ResultsBoardStore.FormatTime(winner?.Time ?? 0);
        }
        resultsBoardFooter.text = settings.Laps + " TUR  /  " + standings.Length + " YARI\u015e\u00c7I  /  SAYFA " + (page + 1) + " / " + pages + "  /  İLK 3 SABİT  /  KALICI HAVUZ";
        foreach (var text in resultsBoardLabels) if(text.gameObject.activeInHierarchy)text.ForceMeshUpdate();
    }

    [HideFromIl2Cpp]
    public void ClearResultsBoardScene()
    {
        if (resultsBoardRoot != null) { resultsBoardRoot.SetActive(false); UObj.Destroy(resultsBoardRoot); }
        foreach (var material in resultsBoardMaterials) if (material != null) UObj.Destroy(material);
        if (resultsBoardQuad != null) UObj.Destroy(resultsBoardQuad);
        if (resultsBoardDisc != null) UObj.Destroy(resultsBoardDisc);
        resultsBoardDisc=null;resultsBoardPortraits.Clear();
        resultsBoardRoot = null; resultsBoardQuad = null; resultsBoardFont = null; resultsBoardTextMaterial = null; resultsBoardResetButton = null; resultsBoardResetText = null;
        resultsBoardMaterials.Clear(); resultsBoardLabels.Clear(); resultsBoardCells.Clear(); resultsBoardRecordCells.Clear(); resultsBoardRecent.Clear();
        resultsBoardParticipants.Clear();resultsBoardBuildParent=null;resultsBoardPodiumGroup=null;resultsBoardParticipantsGroup=null;resultsBoardRecentPage=-1;
        resultsBoardShownRevision = -1; resultsBoardNextUpdate = 0;
    }

    [HideFromIl2Cpp]
    public object GetResultsBoardStatus()
    {
        LoadResultsBoardStore();
        var mounted = resultsBoardRoot != null;
        var position = mounted ? resultsBoardRoot.transform.position : Vector3.zero;
        var normal = mounted ? -resultsBoardRoot.transform.forward : Vector3.zero;
        var camera = position + normal * 38 + Vector3.up;
        var rotation = mounted ? Quaternion.LookRotation(position - camera, Vector3.up).eulerAngles : Vector3.zero;
        return new {
            visible = mounted && resultsBoardRoot.activeInHierarchy, worldSpace = true, qa = resultsBoardQaRun != null,
            file = Path.GetFullPath(ResultsBoardFile), dirty = resultsBoardStore?.Dirty ?? false,
            rounds = resultsBoardStore?.Data.Rounds ?? 0, users = resultsBoardStore?.Data.Users.Count ?? 0,
            dataError = resultsBoardDataError, sceneError = resultsBoardSceneError, notice = resultsBoardNotice,
            mount = resultsBoardMount, roofY = resultsBoardRoofY, roofSamples = resultsBoardRoofSamples, roofSource = resultsBoardRoofSource,
            width = ResultsBoardWidth, height = ResultsBoardHeight, page = resultsBoardPage + 1,
            position = new { x = position.x, y = position.y, z = position.z },
            frontNormal = new { x = normal.x, y = normal.y, z = normal.z },
            firstGrid = new { x = resultsBoardGrid.x, y = resultsBoardGrid.y, z = resultsBoardGrid.z },
            suggestedCamera = mounted ? new { x = camera.x, y = camera.y, z = camera.z, pitch = rotation.x, yaw = rotation.y, fov = 65 } : null,
            font = resultsBoardFont?.name, labels = resultsBoardLabels.Count,
            textVertices = resultsBoardLabels.Where(t => t != null && t.mesh != null).Sum(t => t.mesh.vertexCount),
            unrenderedLabels = resultsBoardLabels.Where(t => t != null && t.gameObject.activeInHierarchy&&!string.IsNullOrWhiteSpace(t.text) && (t.mesh == null || t.mesh.vertexCount == 0)).Select(t => t.name).ToArray(),
            overflowLabels = resultsBoardLabels.Where(t => t != null && t.gameObject.activeInHierarchy&&t.isTextOverflowing).Select(t => t.name).ToArray(),
            recentLabels = resultsBoardRecent.Select(pair => pair.Select(label => label?.text).ToArray()).ToArray(),
            podiumVisible = resultsBoardPodiumGroup!=null&&resultsBoardPodiumGroup.activeInHierarchy,
            visibleRecentOthers = resultsBoardParticipants.Select(row=>row[1].text).Where(name=>!string.IsNullOrWhiteSpace(name)).ToArray(),
            recentTop3 = resultsBoardStore?.Data.RecentTop3, resetAvailable = resultsBoardResetButton != null,
            recentParticipants=resultsBoardStore?.Data.RecentParticipants,showingParticipants=resultsBoardShowingParticipants,
            visibleWinUsers=resultsBoardCells.Select(row=>row[1].text).Where(n=>!string.IsNullOrWhiteSpace(n)).ToArray(),
            visibleRecordUsers=resultsBoardRecordCells.Select(row=>row[1].text).Where(n=>!string.IsNullOrWhiteSpace(n)).ToArray(),
            pageCount=ResultsBoardStore.PageCount(resultsBoardStore?.Data.Users.Count??0),
            recentPortraits = resultsBoardPortraits.Select((slot,index)=>{
                var finish=resultsBoardStore?.Data.RecentTop3.FirstOrDefault(f=>f.Place==index+1);
                return new{place=index+1,hasAvatar=slot.Renderer!=null&&slot.Renderer.enabled,username=finish?.Username,
                    roundPortrait=resultsBoardQaRun!=null&&HasRoundPortrait(finish?.Avatar)};
            }).ToArray(),
            recordLeaders = resultsBoardStore?.TrackRecordStandings(settings.Laps).Take(ResultsBoardRows).Select(u => new { username = u.Username, time = u.BestByLaps.TryGetValue(settings.Laps, out var value) ? value : 0 }).ToArray(),
            colliderCount = resultsBoardResetButton?.GetComponent<Collider>() == null ? 0 : 1
        };
    }
}
#endif
