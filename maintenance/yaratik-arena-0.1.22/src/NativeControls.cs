using Il2Cpp;
using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private CapsuleCollider playerCapsule;
    private Vector3 standingCapsuleCenter, standingCameraOffset;
    private float standingCapsuleHeight, standingWalkSpeed, standingRunSpeed, crouchAmount;
    private bool qaCrouch, crouchBlocked;
    private GameObject crouchTestCeiling;
    private string crouchError = "";

    private void ConfigureNativeControls()
    {
        var player = Player.Instance;
        if (player.staminaSlider.transform.parent.name == "Stamina") player.staminaSlider.transform.parent.gameObject.SetActive(false);
        playerCapsule = player.GetComponent<CapsuleCollider>();
        if (playerCapsule == null) throw new InvalidOperationException("Player capsule missing for crouch.");
        standingCapsuleCenter = playerCapsule.center; standingCapsuleHeight = playerCapsule.height;
        standingCameraOffset = player.cameraOffset;
        standingWalkSpeed = player.walkSpeed; standingRunSpeed = player.runSpeed;
    }

    private void UpdateCrouch()
    {
        if (playerCapsule == null || menu || GameManager.Instance.IsPaused) return;
        try
        {
            var player = Player.Instance;
            bool requested = !roundDied && !autoPlaying && !dashActive &&
                (QaLocked ? qaCrouch : Application.isFocused && (Input.GetKey(KeyCode.LeftControl) || Input.GetKey(KeyCode.RightControl)));
            crouchBlocked = false;
            if (!requested && crouchAmount > 0)
            {
                var position = player.transform.TransformPoint(standingCapsuleCenter);
                float radius = playerCapsule.radius - .015f;
                var low = position + Vector3.up * .1f;
                var high = position + Vector3.up * (standingCapsuleHeight / 2 - radius);
                crouchBlocked = Physics.CheckCapsule(low, high, radius, Vacuum.Instance.wallLayer, QueryTriggerInteraction.Ignore);
                requested = crouchBlocked;
            }
            crouchAmount = Mathf.MoveTowards(crouchAmount, requested ? 1 : 0, Time.deltaTime * 6);
            float reduction = standingCapsuleHeight * .42f * crouchAmount;
            playerCapsule.height = standingCapsuleHeight - reduction;
            playerCapsule.center = standingCapsuleCenter - Vector3.up * (reduction / 2);
            player.cameraOffset = standingCameraOffset - Vector3.up * reduction;
            player.walkSpeed = standingWalkSpeed * Mathf.Lerp(1, .55f, crouchAmount);
            player.runSpeed = standingRunSpeed * Mathf.Lerp(1, .32f, crouchAmount);
        }
        catch (Exception error) { crouchError = error.Message; }
    }

    private void ApplyCrouchCamera()
    {
        if (crouchAmount <= 0 || menu || GameManager.Instance.IsPaused) return;
        var player = Player.Instance;
        var position = player.mainCameraParent.position;
        position.y = player.rb.position.y + player.cameraOffset.y;
        player.mainCameraParent.position = position;
    }

    private void SetCrouchTestCeiling(bool enabled)
    {
        if (crouchTestCeiling != null) { crouchTestCeiling.SetActive(false); UnityEngine.Object.Destroy(crouchTestCeiling); crouchTestCeiling = null; }
        if (!enabled) return;
        crouchTestCeiling = GameObject.CreatePrimitive(PrimitiveType.Cube);
        crouchTestCeiling.name = "TikMnG_QA_Crouch_Ceiling";
        crouchTestCeiling.transform.position = Player.Instance.rb.position + Vector3.up * .6f;
        crouchTestCeiling.transform.localScale = new Vector3(3, .2f, 3);
        Physics.SyncTransforms();
    }

    private void ProbeNativeControls()
    {
        var player = Player.Instance;
        var parents = new List<object>();
        var node = player.staminaSlider.transform;
        for (int i = 0; i < 5 && node != null; i++, node = node.parent)
        {
            var children = new List<string>();
            for (int c = 0; c < node.childCount; c++) children.Add(node.GetChild(c).name);
            parents.Add(new { path = ScenePath(node), children });
        }
        var collider = player.GetComponent<CapsuleCollider>();
        File.WriteAllText(Path.Combine(Root, "qa", "native-controls.json"), System.Text.Json.JsonSerializer.Serialize(new
        {
            parents, collider = collider == null ? null : new { collider.height, collider.radius, center = collider.center.ToString(), scale = collider.transform.lossyScale.ToString() },
            cameraOffset = player.cameraOffset.ToString(), cameraLocal = player.mainCamera.transform.localPosition.ToString(), cameraParentLocal = player.mainCameraParent.localPosition.ToString(),
            cameraPath = ScenePath(player.mainCamera.transform), groundPath = ScenePath(player.groundPoint), groundLocal = player.groundPoint.localPosition.ToString(), player.walkSpeed, player.runSpeed
        }));
    }
}
