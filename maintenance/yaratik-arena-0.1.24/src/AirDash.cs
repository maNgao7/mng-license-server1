using Il2Cpp;
using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private readonly AirDashState airDash = new();
    private bool dashActive;
    private Vector3 dashDirection, dashPrevious, dashOrigin, dashEnd;
    private float dashUntil, dashDistance;
    private float dashPreviousDamping;
    private bool dashPreviousGravity;
    private int dashCount, dashCollisionStops;
    private string dashError = "";
    private string dashObstacle = "";

    private bool DashBlocked => menu || GameManager.Instance.IsPaused || PrisonActive || autoPlaying || rules.Won || roundTimedOut;

    private void UpdateAirDash()
    {
        if (DashBlocked) { StopAirDash(); airDash.Cancel(); return; }
        airDash.Observe(Player.Instance.IsGrounded);
        if (!QaLocked && Application.isFocused && Input.GetKeyDown(KeyCode.Space)) HandleDashPress(Player.Instance.IsGrounded);
    }

    private void HandleDashPress(bool grounded)
    {
        if (DashBlocked || dashActive || !airDash.Press(grounded, Time.time)) return;
        dashDirection = Player.Instance.mainCamera.transform.forward;
        if (dashDirection.sqrMagnitude < .01f) dashDirection = Player.Instance.transform.forward;
        dashDirection.Normalize();
        dashOrigin = dashEnd = dashPrevious = Player.Instance.rb.position; dashDistance = 0; dashObstacle = "";
        var body = Player.Instance.rb;
        dashPreviousDamping = body.linearDamping; dashPreviousGravity = body.useGravity;
        body.linearDamping = 0; body.useGravity = false;
        dashUntil = Time.time + AirDashState.Duration + .15f; dashActive = true; dashCount++;
        if (Player.Instance.throwClip != null) Player.Instance.audioSource.PlayOneShot(Player.Instance.throwClip, .2f);
    }

    private void StopAirDash()
    {
        if (!dashActive) return;
        dashActive = false;
        if (Player.Instance != null)
        {
            var body = Player.Instance.rb;
            dashEnd = body.position;
            body.linearVelocity = Vector3.zero;
            body.linearDamping = dashPreviousDamping; body.useGravity = dashPreviousGravity;
        }
    }

    private void StepAirDash()
    {
        try
        {
            var player = Player.Instance;
            Vector3 position = player.rb.position, traveled = position - dashPrevious;
            dashDistance += traveled.magnitude; dashPrevious = position;
            if (DashBlocked || Time.time >= dashUntil || dashDistance >= AirDashState.Distance - .01f) { StopAirDash(); return; }
            float step = Math.Min(AirDashState.Distance - dashDistance, AirDashState.Distance / AirDashState.Duration * Time.fixedDeltaTime);
            var collider = player.GetComponent<Collider>();
            Bounds bounds = collider != null ? collider.bounds : new Bounds(position, new Vector3(.7f, 1.7f, .7f));
            float radius = Math.Clamp(Math.Min(bounds.extents.x, bounds.extents.z) - .03f, .12f, .45f);
            Vector3 half = Vector3.up * Math.Max(0, bounds.extents.y - radius - .03f);
            if (Physics.CapsuleCast(bounds.center - half, bounds.center + half, radius, dashDirection, out var hit,
                    step + .08f, Vacuum.Instance.wallLayer, QueryTriggerInteraction.Ignore))
            {
                dashObstacle = hit.collider.name;
                step = Math.Max(0, Math.Min(step, hit.distance - .07f));
                if (step <= .01f) { dashCollisionStops++; StopAirDash(); return; }
            }
            player.rb.linearVelocity = dashDirection * (step / Time.fixedDeltaTime);
        }
        catch (Exception error) { dashError = error.Message; StopAirDash(); MelonLoader.MelonLogger.Warning("Air dash stopped: " + error); }
    }
}
