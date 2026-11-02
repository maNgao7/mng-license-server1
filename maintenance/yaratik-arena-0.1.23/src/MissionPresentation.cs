using UnityEngine;
using UnityEngine.UI;
using Object = UnityEngine.Object;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private GameObject missionBoard;
    private Text boardMode, boardTime, boardKills, boardWins, boardStatus;
    private Image boardProgress;
    private string missionBoardError = "";
    private float nextMissionBoard;
    private GUIStyle missionSmall, missionTime, missionValue;
    private bool challengeHudDrawn;
    private Font boardFont;
    private Text boardMinutes, boardSeconds;
    private RawImage boardPauseIcon;
    private float boardWallX;
    private GameObject boardHousing;

    private string MissionClock()
    {
        double seconds = challenge.Phase == ChallengePhase.Waiting ? settings.RoundSeconds : challenge.Phase == ChallengePhase.Preparing ? challenge.Duration : challenge.Remaining(Time.time);
        int value = (int)Math.Ceiling(seconds);
        return (value / 60).ToString("00") + ":" + (value % 60).ToString("00");
    }

    private string MissionStatus => roundDied ? "YENILDIN  -1 WIN" : !settings.TimedMode ? "SERBEST TUR" : challenge.IsPaused ? "SURE DURDU" : challenge.Phase switch
    {
        ChallengePhase.Waiting => "P  /  OTO",
        ChallengePhase.Preparing => "HAZIRLAN  " + Math.Ceiling(challenge.Remaining(Time.time)).ToString("00"),
        ChallengePhase.Active => "GOREV AKTIF",
        ChallengePhase.Won => "WINNER  +1 WIN",
        _ => "SURE DOLDU  -1 WIN"
    };

    private void DrawChallengeHud()
    {
        challengeHudDrawn = false;
        if (!settings.TimedMode) return;
        EnsureProgressHudStyles();
        missionSmall ??= HudLabelStyle(11, HudCream, TextAnchor.MiddleLeft);
        missionTime ??= HudLabelStyle(32, Ink, TextAnchor.MiddleLeft);
        missionValue ??= HudLabelStyle(13, Ink, TextAnchor.MiddleRight);
        const float x = 16, width = 256;
        float y = Screen.width >= 1180 ? 8 : 140;
        float height = settings.TimedMode ? 144 : 66;
        PaintCounterSurface(new Rect(x, y, width, height), new Color(.04f, .065f, .075f, .95f));
        Paint(new Rect(x, y + 12, 3, height - 24), settings.TimedMode ? HudOrange : HudMint);
        Label(new Rect(x + 14, y + 7, width - 28, 20), settings.TimedMode ? "SURELI GOREV" : "SERBEST TUR", missionSmall, HudMint);
        if (settings.TimedMode)
        {
            Label(new Rect(x + 14, y + 26, 130, 42), MissionClock(), missionTime);
            Label(new Rect(x + 144, y + 27, 98, 40), MissionStatus, missionValue, HudOrange);
            int target = challenge.Phase == ChallengePhase.Waiting ? settings.KillTarget : challenge.Target;
            Label(new Rect(x + 14, y + 73, 98, 20), "OLDURULEN", missionSmall);
            Label(new Rect(x + 104, y + 73, 138, 20), challenge.Kills.ToString("N0") + " / " + target.ToString("N0"), missionValue);
            Paint(new Rect(x + 14, y + 98, width - 28, 4), HudTrack);
            Paint(new Rect(x + 14, y + 98, (width - 28) * Mathf.Clamp01(challenge.Kills / (float)Math.Max(1, target)), 4), HudMint);
        }
        float footerY = settings.TimedMode ? y + 112 : y + 33;
        Label(new Rect(x + 14, footerY, 80, 22), "WIN", missionSmall, HudOrange);
        Label(new Rect(x + 80, footerY, width - 94, 22), rules.Wins + " / " + settings.WinGoal, missionValue, rules.Wins < 0 ? BrandRed : HudMint);
        challengeHudDrawn = true;
    }

    private RectTransform BoardRect(string name, Transform parent, float x, float y, float w, float h)
    {
        var go = new GameObject(name);
        var rect = go.AddComponent<RectTransform>();
        rect.SetParent(parent, false);
        rect.anchorMin = rect.anchorMax = new Vector2(.5f, .5f);
        rect.anchoredPosition = new Vector2(x, y);
        rect.sizeDelta = new Vector2(w, h);
        return rect;
    }

    private Image BoardPanel(Transform parent, float x, float y, float w, float h, Color color)
    {
        var rect = BoardRect("Panel", parent, x, y, w, h);
        var image = rect.gameObject.AddComponent<Image>(); image.color = color; image.raycastTarget = false;
        return image;
    }

    private Text BoardText(Transform parent, float x, float y, float w, float h, string value, int size, Color color, TextAnchor alignment = TextAnchor.MiddleCenter)
    {
        var rect = BoardRect("Readout", parent, x, y, w, h);
        var label = rect.gameObject.AddComponent<Text>();
        label.font = boardFont; label.fontSize = size; label.fontStyle = FontStyle.Bold;
        label.alignment = alignment; label.color = color; label.text = value;
        label.raycastTarget = false; label.horizontalOverflow = HorizontalWrapMode.Wrap;
        label.verticalOverflow = VerticalWrapMode.Truncate;
        return label;
    }

    private void CreateMissionBoard()
    {
        boardFont = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        missionBoard = new GameObject("TikMnG_Mission_Board");
        var canvas = missionBoard.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.WorldSpace;
        var rect = missionBoard.GetComponent<RectTransform>();
        rect.sizeDelta = new Vector2(1000, 750);
        rect.position = new Vector3(20.40f, 4.65f, 0);
        rect.rotation = Quaternion.Euler(0, 90, 0);
        rect.localScale = Vector3.one * .012f;
        MountMissionBoard(rect);
        BoardPanel(rect, 0, 0, 1000, 750, new Color(.15f, .23f, .25f));
        BoardPanel(rect, 0, 0, 980, 730, new Color(.025f, .045f, .055f));
        BoardPanel(rect, 0, 300, 960, 100, HudCream);
        var brand = BoardRect("TikMnG_Logo", rect, 0, 300, 310, 74).gameObject.AddComponent<RawImage>();
        brand.texture = LoadIcon("TikMnG-color-mark-v2.png"); brand.raycastTarget = false;
        AddBoardControl(rect, "auto", 348, 300, 190, 48, "OTO: KAPALI");
        boardMode = BoardText(rect, 0, 204, 380, 54, "", 26, HudMint);
        AddBoardControl(rect, "free", -348, 204, 168, 48, "SERBEST");
        AddBoardControl(rect, "timed", 348, 204, 168, 48, "SURELI");
        boardTime = BoardText(rect, 0, 65, 490, 180, "", 126, Color.white);
        boardMinutes = BoardText(rect, -348, 64, 190, 34, "DAKIKA", 22, HudCream);
        boardSeconds = BoardText(rect, 348, 64, 190, 34, "SANIYE", 22, HudCream);
        AddBoardControl(rect, "minute-up", -348, 117, 130, 58, "+");
        AddBoardControl(rect, "minute-down", -348, 7, 130, 58, "-");
        AddBoardControl(rect, "second-up", 348, 117, 130, 58, "+");
        AddBoardControl(rect, "second-down", 348, 7, 130, 58, "-");
        BoardPanel(rect, 0, -66, 860, 2, HudEtching);
        BoardText(rect, -220, -110, 410, 40, "OLDURULEN / HEDEF", 22, HudMint);
        BoardText(rect, 220, -110, 410, 40, "KAZANILAN / HEDEF", 22, HudOrange);
        boardKills = BoardText(rect, -220, -170, 260, 65, "", 38, Color.white);
        boardWins = BoardText(rect, 220, -170, 260, 65, "", 38, Color.white);
        AddBoardControl(rect, "kills-down", -405, -170, 60, 60, "-");
        AddBoardControl(rect, "kills-up", -35, -170, 60, 60, "+");
        AddBoardControl(rect, "wins-down", 35, -170, 60, 60, "-");
        AddBoardControl(rect, "wins-up", 405, -170, 60, 60, "+");
        AddBoardControl(rect, "score-down", 80, -220, 90, 36, "WIN -").Label.fontSize = 18;
        AddBoardControl(rect, "score-up", 186, -220, 90, 36, "WIN +").Label.fontSize = 18;
        BoardPanel(rect, 0, -244, 860, 12, HudTrack);
        boardProgress = BoardPanel(rect, -430, -244, 0, 12, HudMint);
        boardProgress.rectTransform.pivot = new Vector2(0, .5f);
        var start = AddBoardControl(rect, "start", -142, -306, 576, 78, "BASLAT");
        boardStatus = start.Label;
        var pause = AddBoardControl(rect, "pause", 300, -306, 260, 78, "DURDUR");
        pause.Label.rectTransform.anchoredPosition = new Vector2(322, -306);
        pause.Label.rectTransform.sizeDelta = new Vector2(204, 78);
        boardPauseIcon = BoardRect("Pause_Resume", rect, 204, -306, 28, 28).gameObject.AddComponent<RawImage>();
        boardPauseIcon.raycastTarget = false;
        // Keep the existing posters and the rest of the factory untouched.
        boardCollider = missionBoard.AddComponent<BoxCollider>(); boardCollider.size = new Vector3(1000, 750, 12);
        boardCollider.center = new Vector3(0, 0, 7);
    }

    private void MountMissionBoard(RectTransform rect)
    {
        var wall = GameObject.Find("Factory/Wall").GetComponent<Collider>();
        // Measure beside the opening, not the tunnel's distant back wall.
        if (!wall.Raycast(new Ray(new Vector3(15, rect.position.y, -6.25f), Vector3.right), out var left, 12)
            || !wall.Raycast(new Ray(new Vector3(15, rect.position.y, 6.25f), Vector3.right), out var right, 12))
            throw new InvalidOperationException("Mission board wall surface missing.");
        boardWallX = Math.Min(left.point.x, right.point.x);
        rect.position = new Vector3(boardWallX - .05f, rect.position.y, rect.position.z);

        // Recess the old mouth with its collider so it cannot protrude through the display.
        var pipe = GameObject.Find("Factory/BigPipe");
        var renderer = pipe.GetComponent<MeshRenderer>();
        float offset = Math.Max(0, boardWallX + .06f - renderer.bounds.min.x);
        pipe.transform.position += Vector3.right * offset;
        // This renderer is statically batched, so translating its collider does not move the visible rim.
        renderer.enabled = false;

        boardHousing = GameObject.CreatePrimitive(PrimitiveType.Cube);
        boardHousing.name = "Wall_Mount_Housing";
        boardHousing.transform.SetParent(rect, false);
        boardHousing.transform.localPosition = new Vector3(0, -6.25f, 6.5f);
        boardHousing.transform.localScale = new Vector3(1000, 762.5f, 11);
        var housingCollider = boardHousing.GetComponent<Collider>();
        housingCollider.enabled = false;
        Object.Destroy(housingCollider);
        var material = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
        material.color = new Color(.15f, .23f, .25f);
        material.SetColor("_BaseColor", material.color);
        material.SetFloat("_Smoothness", 0);
        boardHousing.GetComponent<Renderer>().sharedMaterial = material;
        CreateBoardExclusion();
    }

    private void ProbeMissionBoardMount()
    {
        var wall = GameObject.Find("Factory/Wall").GetComponent<Collider>();
        var pipe = GameObject.Find("Factory/BigPipe");
        var samples = new List<object>();
        foreach (float y in new[] { 1f, 4.65f, 9f, 11f })
            foreach (float z in new[] { -7f, -6.25f, 0f, 6.25f, 7f })
            {
                bool found = wall.Raycast(new Ray(new Vector3(15, y, z), Vector3.right), out var hit, 25);
                samples.Add(new { y, z, found, x = found ? hit.point.x : 0 });
            }
        var renderer = pipe.GetComponent<MeshRenderer>();
        File.WriteAllText(Path.Combine(Root, "qa", "board-mount-probe.json"), System.Text.Json.JsonSerializer.Serialize(new
        {
            board = new { x = missionBoard.transform.position.x, y = missionBoard.transform.position.y, z = missionBoard.transform.position.z, scale = missionBoard.transform.localScale.x },
            wallX = boardWallX, wallGap = boardWallX - missionBoard.transform.position.x,
            pipeVisible = renderer.enabled,
            housing = boardHousing != null && boardHousing.activeInHierarchy,
            boardPosition = missionBoard.transform.position.ToString(),
            pipePosition = pipe.transform.position.ToString(),
            pipeRotation = pipe.transform.eulerAngles.ToString(),
            pipeScale = pipe.transform.lossyScale.ToString(),
            pipeCenter = renderer.bounds.center.ToString(),
            pipeSize = renderer.bounds.size.ToString(), samples
        }, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
    }

    private void UpdateMissionBoard()
    {
        if (missionBoardError.Length > 0 || Time.realtimeSinceStartup < nextMissionBoard) return;
        nextMissionBoard = Time.realtimeSinceStartup + .1f;
        try
        {
            if (missionBoard == null) CreateMissionBoard();
            boardMode.text = settings.TimedMode ? "SURELI GOREV" : "SERBEST MOD";
            boardTime.text = settings.TimedMode ? MissionClock() : "SERBEST";
            boardTime.fontSize = settings.TimedMode ? 126 : 80;
            boardMinutes.color = boardSeconds.color = settings.TimedMode ? HudCream : HudEtching;
            int target = challenge.Phase == ChallengePhase.Waiting ? settings.KillTarget : challenge.Target;
            boardKills.text = settings.TimedMode ? challenge.Kills.ToString("N0") + " / " + target.ToString("N0") : rules.Kills.ToString("N0");
            boardWins.text = rules.Wins + " / " + settings.WinGoal;
            boardWins.color = rules.Wins < 0 ? BrandRed : HudCream;
            boardStatus.text = settings.TimedMode && challenge.Phase == ChallengePhase.Waiting ? "BASLAT" : MissionStatus;
            boardPauseIcon.texture = LoadIcon(challenge.IsPaused ? "ui-Play.png" : "ui-Pause.png");
            boardPauseIcon.color = BoardControlEnabled("pause") ? HudCream : HudEtching;
            UpdateBoardControls();
            boardProgress.rectTransform.sizeDelta = new Vector2(860 * (settings.TimedMode ? Mathf.Clamp01(challenge.Kills / (float)Math.Max(1, target)) : 0), 12);
        }
        catch (Exception e) { missionBoardError = e.ToString(); MelonLoader.MelonLogger.Error("Mission board: " + e); }
    }
}
