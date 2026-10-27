package com.tikmng.snowwar.client;

import net.minecraft.client.CameraType;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

import java.util.List;
import java.util.UUID;

import static com.tikmng.snowwar.SnowWarRegressionSuite.check;

public final class SnowWarFollowCameraRegression {
    public static void run() {
        Vec3 origin = new Vec3(0, 1, 0);
        Vec3 end = new Vec3(0, 1, 100);
        var near = target(1, new AABB(-0.3, 0, 5, 0.3, 2, 6), true, true);
        var far = target(2, new AABB(-0.3, 0, 10, 0.3, 2, 11), true, true);
        var offAim = target(3, new AABB(1, 0, 2, 2, 2, 3), true, true);
        var dead = target(4, new AABB(-0.3, 0, 1, 0.3, 2, 2), false, true);
        var audience = target(5, new AABB(-0.3, 0, 2, 0.3, 2, 3), true, false);
        var behind = target(6, new AABB(-0.3, 0, -6, 0.3, 2, -5), true, true);
        check(SnowWarFollowCamera.pickTarget(origin, end, List.of(far, offAim, dead, audience, behind, near)) == near,
            "ray must pick the nearest live arena participant under the reticle, regardless of list order");
        check(SnowWarFollowCamera.pickTarget(origin, end, List.of(offAim, dead, audience, behind)) == null,
            "off-ray, dead, audience and behind-camera candidates cannot be selected");
        check(SnowWarFollowCamera.pickTarget(origin, new Vec3(0, 1, 4), List.of(near, far)) == null,
            "block-clipped ray must not select through a wall");
        var wide = target(7, new AABB(-3, 0, 7, 3, 2, 12), true, true);
        check(SnowWarFollowCamera.pickTarget(origin, end, List.of(far, wide)) == wide,
            "selection compares AABB entry distance, not entity centers");
        var containing = target(8, new AABB(-1, 0, -1, 1, 2, 1), true, true);
        check(SnowWarFollowCamera.pickTarget(origin, end, List.of(near, containing)) == containing,
            "ray origin inside a target counts as the nearest hit");

        var camera = new SnowWarFollowCamera();
        check(!camera.following(), "camera starts detached");
        camera.begin(near, CameraType.FIRST_PERSON);
        check(camera.following() && !camera.shouldExit(near, true), "live target remains attached");
        check(camera.shouldExit(null, true), "removed or disconnected target exits");
        check(camera.shouldExit(new SnowWarFollowCamera.Target(near.entityId(), near.uuid(), near.bounds(), false, true), true),
            "target death exits");
        check(camera.shouldExit(new SnowWarFollowCamera.Target(near.entityId(), UUID.randomUUID(), near.bounds(), true, true), true),
            "recycled entity id cannot attach to a different participant");
        check(camera.shouldExit(near, false), "world change, player respawn or changed camera exits");
        check(camera.clear() == CameraType.FIRST_PERSON && !camera.following(), "E exit restores saved perspective and clears target");
        check(camera.clear() == null, "repeated cleanup retains no stale perspective");
        camera.begin(far, CameraType.THIRD_PERSON_FRONT);
        check(camera.clear() == CameraType.THIRD_PERSON_FRONT && !camera.following(), "later follow sessions save their own perspective");
    }

    private static SnowWarFollowCamera.Target target(int id, AABB box, boolean alive, boolean participant) {
        return new SnowWarFollowCamera.Target(id, UUID.randomUUID(), box, alive, participant);
    }
}
