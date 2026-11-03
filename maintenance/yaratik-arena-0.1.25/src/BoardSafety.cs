using UnityEngine;
using UnityEngine.AI;

namespace TikMnG.CanEmAll;

public sealed partial class Mod
{
    private GameObject boardExclusion;
    private NavMeshObstacle boardObstacle;
    private int boardOccupantRescues, rejectedBoardSpawns, rejectedBoardPaths;

    private bool BehindMissionBoard(Vector3 point) => missionBoard != null
        && point.x > missionBoard.transform.position.x + .10f
        && Math.Abs(point.z) < 6.5f && point.y > -.5f && point.y < 12;

    private void CreateBoardExclusion()
    {
        boardExclusion = GameObject.CreatePrimitive(PrimitiveType.Cube);
        boardExclusion.name = "TikMnG_Board_Sealed_Backstage";
        boardExclusion.transform.position = new Vector3(boardWallX + 5.52f, 5, 0);
        boardExclusion.transform.localScale = new Vector3(11, 14, 13);
        boardExclusion.GetComponent<Renderer>().enabled = false;
        boardObstacle = boardExclusion.AddComponent<NavMeshObstacle>();
        boardObstacle.shape = NavMeshObstacleShape.Box;
        boardObstacle.size = Vector3.one;
        boardObstacle.carving = true;
        boardObstacle.carvingMoveThreshold = .05f;
        boardObstacle.carvingTimeToStationary = 0;
        boardObstacle.carveOnlyStationary = true;
        CreateBoardFloorSeal();
    }

    private bool PathEntersBoardBackstage(Vector3 from, Vector3 to)
    {
        if (BehindMissionBoard(from) || BehindMissionBoard(to)) return true;
        if (missionBoard == null || Math.Abs(from.x - to.x) < .0001f) return false;
        float boundary = missionBoard.transform.position.x + .10f;
        float t = (boundary - from.x) / (to.x - from.x);
        return t >= 0 && t <= 1 && BehindMissionBoard(Vector3.Lerp(from, to, t) + Vector3.right * .001f);
    }

    private void RescueBoardOccupant(Creature creature)
    {
        var enemy = creature.Enemy;
        if (enemy == null || !BehindMissionBoard(enemy.rb.position)) return;
        Vector3 safe = creature.LastSafePosition;
        if (BehindMissionBoard(safe) || safe.x > missionBoard.transform.position.x - .8f)
            safe = new Vector3(missionBoard.transform.position.x - 1.5f, .1f, Math.Clamp(enemy.rb.position.z, -5.5f, 5.5f));
        if (NavMesh.SamplePosition(safe, out var floor, 2, -1) && !BehindMissionBoard(floor.position))
            safe = floor.position + Vector3.up * .5f;
        else safe = new Vector3(18.5f, .5f, Math.Clamp(safe.z, -5.5f, 5.5f));
        enemy.rb.position = safe;
        enemy.rb.linearVelocity = Vector3.zero;
        enemy.rb.angularVelocity = Vector3.zero;
        creature.LastSafePosition = safe;
        if (!enemy.IsDead) enemy.SpawnRoaming(4);
        boardOccupantRescues++;
    }

    private System.Collections.IEnumerator TestBoardPressure()
    {
        Spawn("qa_board_wall", new Vector3(missionBoard.transform.position.x - 1.5f, .6f, 0));
        var enemy = creatures.Last().Enemy;
        float until = Time.time + 2;
        while (Time.time < until && enemy != null && !enemy.IsDead)
        {
            enemy.rb.linearVelocity = new Vector3(18, enemy.rb.linearVelocity.y, 0);
            yield return new WaitForFixedUpdate();
        }
    }
}
