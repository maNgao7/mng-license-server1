using Il2Cpp;
using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    public override void OnLateUpdate()
    {
        if (!ready || failed) return;
        AnimateCreatureAttacks();
        ApplyQaView();
        ApplyAutoAim();
        ApplyCrouchCamera();
        ApplyBossShake();
        ApplyReloadPose();
        // Native pause handling can restore the cursor state cached by the original main menu.
        bool capture = Application.isFocused && !menu && !GameManager.Instance.IsPaused;
        if (capture)
        {
            GameManager.Instance.previousCursorLockMode = CursorLockMode.Locked;
            GameManager.Instance.previousCursorVisibility = false;
        }
        var desired = capture ? CursorLockMode.Locked : CursorLockMode.None;
        if (Cursor.lockState != desired) Cursor.lockState = desired;
        if (Cursor.visible == capture) Cursor.visible = !capture;
    }

    private void ApplyQaView()
    {
        if (autoPlaying || !QaLocked || !qaViewRotation.HasValue) return;
        Player.Instance.mainCameraParent.rotation = qaViewRotation.Value;
        Player.Instance.mainCamera.transform.rotation = qaViewRotation.Value;
    }
}
