using Il2Cpp;
using UnityEngine;
using UnityEngine.UI;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private sealed class BoardControl
    {
        public string Id;
        public Rect Bounds;
        public Image Background;
        public Text Label;
    }

    private readonly List<BoardControl> boardControls = new();
    private BoxCollider boardCollider;
    private string hoveredBoardControl = "", lastBoardInteraction = "";
    private int boardInteractions, boardWeaponHits;
    private float boardClickUntil, boardInteractionUntil;
    private bool BoardEditable => challenge.Phase == ChallengePhase.Waiting && !rules.Won && !roundTimedOut;

    private BoardControl AddBoardControl(Transform parent, string id, float x, float y, float width, float height, string title)
    {
        var control = new BoardControl
        {
            Id = id, Bounds = new Rect(x - width / 2, y - height / 2, width, height),
            Background = BoardPanel(parent, x, y, width, height, HudTrack),
            Label = BoardText(parent, x, y, width, height, title, id.Contains('-') ? 30 : 24, HudCream)
        };
        boardControls.Add(control);
        return control;
    }

    private bool BoardControlEnabled(string id)
    {
        if (id == "auto") return true;
        if (id is "score-up" or "score-down") return !rules.Won && !roundTimedOut;
        if (id == "pause") return settings.TimedMode && !rules.Won && !roundTimedOut && challenge.Phase is ChallengePhase.Preparing or ChallengePhase.Active;
        if (!BoardEditable) return false;
        if (id is "timed" or "free") return true;
        return settings.TimedMode;
    }

    private void UpdateBoardControls()
    {
        foreach (var control in boardControls)
        {
            bool enabled = BoardControlEnabled(control.Id);
            bool selected = control.Id == "timed" && settings.TimedMode || control.Id == "free" && !settings.TimedMode || control.Id == "auto" && autoPlaying;
            bool highlighted = enabled && hoveredBoardControl == control.Id;
            control.Background.color = !enabled ? new Color(.07f, .09f, .10f) : highlighted ? new Color(.12f, .48f, .45f) : selected ? new Color(.08f, .31f, .29f) : control.Id == "start" ? new Color(.9f, .45f, .09f) : HudTrack;
            control.Label.color = control.Id == "start" ? enabled ? HudNavy : HudOrange : !enabled ? HudEtching : HudCream;
            if (control.Id == "pause") control.Label.text = challenge.IsPaused ? "DEVAM ET" : "DURDUR";
            if (control.Id == "auto") control.Label.text = autoPlaying ? "OTO: ACIK" : "OTO: KAPALI";
        }
    }

    private bool RaycastBoard(out RaycastHit hit)
    {
        var camera = Player.Instance.mainCamera.transform;
        var direction = QaLocked && qaViewRotation.HasValue ? qaViewRotation.Value * Vector3.forward : camera.forward;
        return Physics.Raycast(camera.position, direction, out hit, 80, Player.Instance.ignorePlayerLayer, QueryTriggerInteraction.Ignore)
            && hit.collider != null && boardCollider != null && hit.collider.Pointer == boardCollider.Pointer;
    }

    private object BoardRayDiagnostics()
    {
        var camera = Player.Instance.mainCamera.transform;
        var direction = QaLocked && qaViewRotation.HasValue ? qaViewRotation.Value * Vector3.forward : camera.forward;
        bool found = Physics.Raycast(camera.position, direction, out var hit, 80, Player.Instance.ignorePlayerLayer, QueryTriggerInteraction.Ignore);
        var local = found && missionBoard != null ? missionBoard.transform.InverseTransformPoint(hit.point) : Vector3.zero;
        return new { mask = Player.Instance.ignorePlayerLayer.value, found, collider = found ? ScenePath(hit.collider.transform) : "", local = new {local.x,local.y,local.z}, control = found ? BoardControlAt(hit.point) : "", camera = camera.position.ToString(), direction = direction.ToString() };
    }

    private string BoardControlAt(Vector3 point)
    {
        if (missionBoard == null) return "";
        Vector3 local = missionBoard.transform.InverseTransformPoint(point);
        if (Math.Abs(local.z) > 30 || Math.Abs(local.x) > 500 || Math.Abs(local.y) > 375) return "";
        var position = new Vector2(local.x, local.y);
        return boardControls.FirstOrDefault(c => c.Bounds.Contains(position))?.Id ?? "";
    }

    private void PollMissionBoardInput()
    {
        hoveredBoardControl = "";
        if (menu || GameManager.Instance.IsPaused || PrisonActive || missionBoard == null || QaLocked) return;
        if (!RaycastBoard(out var hit)) return;
        hoveredBoardControl = BoardControlAt(hit.point);
        if (Input.GetMouseButtonDown(0) && hoveredBoardControl.Length > 0) ActivateBoardControl(hoveredBoardControl);
    }

    private void ActivateBoardControl(string id)
    {
        if (!BoardControlEnabled(id) || Time.realtimeSinceStartup < boardClickUntil) return;
        boardClickUntil = Time.realtimeSinceStartup + .18f;
        boardInteractionUntil = Time.time + .6f;
        switch (id)
        {
            case "auto": SetAutoPlay(!autoPlaying); break;
            case "start": StartChallenge(); break;
            case "pause": challenge.TogglePause(Time.time); break;
            case "free": SetTimedMode(false); break;
            case "timed": SetTimedMode(true); break;
            case "minute-up": settings.RoundSeconds = Math.Min(3600, settings.RoundSeconds + 60); break;
            case "minute-down": settings.RoundSeconds = Math.Max(1, settings.RoundSeconds - 60); break;
            case "second-up": settings.RoundSeconds = Math.Min(3600, settings.RoundSeconds + 1); break;
            case "second-down": settings.RoundSeconds = Math.Max(1, settings.RoundSeconds - 1); break;
            case "kills-up": settings.KillTarget = Math.Min(1_000_000, settings.KillTarget + 100); break;
            case "kills-down": settings.KillTarget = Math.Max(1, settings.KillTarget - 100); break;
            case "wins-up": settings.WinGoal = Math.Min(1_000_000, settings.WinGoal + 1); break;
            case "wins-down": settings.WinGoal = Math.Max(1, settings.WinGoal - 1); break;
            case "score-up": rules.AdjustWins(1); break;
            case "score-down": rules.AdjustWins(-1); break;
            default: return;
        }
        lastBoardInteraction = id; boardInteractions++;
        focusedField = ""; editBuffers.Clear();
        if (id is not "pause" and not "auto") SaveSettings();
        PlayTone(660, .12f); nextMissionBoard = 0;
    }

    private void HandleBoardWeaponHit(Vector3 point)
    {
        if (!ready || menu || GameManager.Instance.IsPaused || PrisonActive || vacuum || !settings.TimedMode || !BoardEditable || Time.time < boardInteractionUntil || missionBoard == null) return;
        Vector3 local = missionBoard.transform.InverseTransformPoint(point);
        if (Math.Abs(local.z) > 30 || Math.Abs(local.x) > 500 || Math.Abs(local.y) > 375) return;
        string id = BoardControlAt(point);
        if (id.Length > 0 && id != "start") return;
        boardWeaponHits++; lastBoardInteraction = "weapon-hit";
        StartChallenge();
    }

    private static void AfterBoardBulletImpact(Vector3 point) => Current.HandleBoardWeaponHit(point);

    private static void AfterBoardBatSwing(float delay)
    {
        if (Current.ready && !Current.menu) MelonLoader.MelonCoroutines.Start(Current.WaitForBoardBatHit(delay));
    }

    private System.Collections.IEnumerator WaitForBoardBatHit(float delay)
    {
        yield return new WaitForSeconds(Math.Max(0, delay));
        if (!RaycastBoard(out var hit) || hit.distance > weapons[0].Cast<BaseballBat>().distanceToPunch + .2f) yield break;
        HandleBoardWeaponHit(hit.point);
    }
}
