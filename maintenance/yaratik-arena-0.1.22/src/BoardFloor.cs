using Il2Cpp;
using UnityEngine;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private GameObject boardFloorSeal;
    private float boardFloorY, boardFloorPlayerMinimum, boardFloorCreatureMinimum;
    private bool boardFloorPressureRunning;
    private string boardFloorError = "";

    private void CreateBoardFloorSeal()
    {
        if (!Physics.Raycast(new Vector3(boardWallX - 5, 3, 8), Vector3.down, out var floor, 5, 1, QueryTriggerInteraction.Ignore))
            throw new InvalidOperationException("Safe floor beside mission board missing.");
        boardFloorY = floor.point.y;
        boardFloorSeal = GameObject.CreatePrimitive(PrimitiveType.Cube);
        boardFloorSeal.name = "TikMnG_Board_Floor_Seal";
        boardFloorSeal.transform.position = new Vector3(boardWallX - .1f, boardFloorY - .24f, 0);
        boardFloorSeal.transform.localScale = new Vector3(7, .5f, 14);
        var source = floor.collider.GetComponent<Renderer>();
        if (source != null && source.sharedMaterial != null)
        {
            var material = new Material(source.sharedMaterial);
            material.mainTextureScale = new Vector2(3.5f, 7);
            boardFloorSeal.GetComponent<Renderer>().sharedMaterial = material;
        }
        else
        {
            var material = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
            material.color = new Color(.3f, .34f, .35f);
            boardFloorSeal.GetComponent<Renderer>().sharedMaterial = material;
        }
        Physics.SyncTransforms();
        BuildCombatNavigation();
    }

    private void ProbeBoardFloor()
    {
        var samples = new List<object>();
        foreach (float x in new[] { boardWallX - 2.5f, boardWallX - 1.1f, boardWallX - .35f })
            foreach (float z in new[] { -6f, -3f, 0f, 3f, 6f })
            {
                bool found = Physics.Raycast(new Vector3(x, 2, z), Vector3.down, out var hit, 4, 1, QueryTriggerInteraction.Ignore);
                samples.Add(new { x, z, found, y = found ? hit.point.y : -100, collider = found ? hit.collider.name : "" });
            }
        File.WriteAllText(Path.Combine(Root, "qa", "board-floor-probe.json"), System.Text.Json.JsonSerializer.Serialize(new
        {
            boardFloorY, sealedFloor = boardFloorSeal != null, boardX = missionBoard.transform.position.x,
            samples, boardFloorPlayerMinimum, boardFloorCreatureMinimum, boardFloorError
        }, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
    }

    private System.Collections.IEnumerator TestBoardFloorPressure(float z)
    {
        boardFloorPressureRunning = true; boardFloorError = "";
        z = Math.Clamp(z, -5.5f, 5.5f);
        var player = Player.Instance;
        player.rb.position = new Vector3(boardWallX - 1.5f, 1, z);
        player.rb.linearVelocity = Vector3.zero;
        Spawn("qa_board_floor", new Vector3(boardWallX - 2, .6f, z + .8f));
        var enemy = creatures.Last().Enemy;
        enemy.Damage(100000, Vector3.zero, enemy.GrabCenter, 0, false, false, weapons[rules.Level]);
        boardFloorPlayerMinimum = boardFloorCreatureMinimum = 100;
        float until = Time.time + 2.5f;
        while (Time.time < until && enemy != null)
        {
            player.rb.linearVelocity = new Vector3(8, player.rb.linearVelocity.y, 0);
            enemy.rb.linearVelocity = new Vector3(8, enemy.rb.linearVelocity.y, 0);
            boardFloorPlayerMinimum = Math.Min(boardFloorPlayerMinimum, player.rb.position.y);
            boardFloorCreatureMinimum = Math.Min(boardFloorCreatureMinimum, enemy.rb.position.y);
            yield return new WaitForFixedUpdate();
        }
        player.rb.linearVelocity = Vector3.zero;
        if (enemy != null) enemy.rb.linearVelocity = Vector3.zero;
        if (boardFloorPlayerMinimum < boardFloorY - .1f || boardFloorCreatureMinimum < boardFloorY - .1f)
            boardFloorError = "Board foundation did not support a physics body.";
        boardFloorPressureRunning = false; ProbeBoardFloor(); Report();
    }
}
