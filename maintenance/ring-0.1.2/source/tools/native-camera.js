'use strict';

// Optional Frida sidecar for the pinned private game. No automatic attachment,
// rpc.exports assignment or physics hook. Only the owner-supplied updateNative
// callback may write the verified camera fields during the original callback.
(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TikMngNativeCamera = api;
})(globalThis, function cameraModule() {
  const BUILD = Object.freeze({
    path: 'd:/tikmng/hediye-box-private/native-game/boxing.exe',
    sha256: '9132d5631f59661f8bde912d6b1e5b9788c24fd7031bb1aa81d16b298b293e67',
    helperRva: 0x2852310,
    helperEndRva: 0x285296b,
    imageSize: 0x5537000,
    timestamp: 0x6b0235b0,
    prologue: '5541574156415541545657534881ec28010000488dac2480',
  });
  const HEAD_IDS = Object.freeze([17, 38]);
  const close = (a, b) => Number.isFinite(a) && Math.abs(a - b) <= 0.0002 * Math.max(1, Math.abs(b));
  const vector = (v, n) => Array.isArray(v) && v.length === n && v.every(Number.isFinite);

  function perspective(fov, aspect, near) {
    if (!(fov > 0 && fov < Math.PI && aspect > 0 && near > 0)
      || ![fov, aspect, near].every(Number.isFinite)) throw new Error('Invalid perspective');
    const f = 1 / Math.tan(fov / 2);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, 0, -1, 0, 0, near, 0];
  }

  function validateCamera(camera) {
    if (!camera || !vector(camera.rotation, 4) || !vector(camera.position, 3)
      || !vector(camera.scale, 3) || camera.scale.some(s => Math.abs(s) < 1e-6)
      || !vector(camera.clipFromView, 16)) throw new Error('Invalid camera transform');
    const norm = Math.hypot(...camera.rotation);
    if (Math.abs(norm - 1) > 0.002) throw new Error('Nonunit camera quaternion');
    if (camera.projectionTag !== 6 || !vector(camera.nearPlane, 4)
      || !camera.nearPlane.every((v, i) => close(v, [0, 0, -1, -camera.near][i]))) {
      throw new Error('Unsupported projection or custom near plane');
    }
    const expected = perspective(camera.fov, camera.aspect, camera.near);
    if (!camera.clipFromView.every((v, i) => close(v, expected[i]))) {
      throw new Error('Camera matrix is updating or its layout does not match');
    }
    if (!(Number.isFinite(camera.far) && camera.far > camera.near)) throw new Error('Invalid far plane');
    return camera;
  }

  /** Project a verified Bevy-world point; returns viewport fractions, not desktop pixels.
   * Example: projectWorld([0, 0, -2], camera).viewport -> [0.5, 0.5].
   * inViewport means geometric inclusion; it does not assert absence of occlusion.
   */
  function projectWorld(world, camera) {
    validateCamera(camera);
    if (!vector(world, 3)) throw new Error('Invalid Bevy-world point');
    const norm = Math.hypot(...camera.rotation);
    const [qx, qy, qz, qw] = camera.rotation.map(v => v / norm);
    const [x, y, z] = world.map((v, i) => v - camera.position[i]);
    const tx = 2 * (-qy * z + qz * y);
    const ty = 2 * (-qz * x + qx * z);
    const tz = 2 * (-qx * y + qy * x);
    const view = [
      (x + qw * tx - qy * tz + qz * ty) / camera.scale[0],
      (y + qw * ty - qz * tx + qx * tz) / camera.scale[1],
      (z + qw * tz - qx * ty + qy * tx) / camera.scale[2],
      1,
    ];
    const p = camera.clipFromView;
    const clip = [0, 1, 2, 3].map(row => view.reduce((v, term, col) => v + p[col * 4 + row] * term, 0));
    if (!clip.every(Number.isFinite)) throw new Error('Invalid clip coordinates');
    if (clip[3] <= 1e-6) return { inViewport: false, reason: 'behind-camera', viewport: null, ndc: null };
    const ndc = clip.slice(0, 3).map(v => v / clip[3]);
    const viewport = [(ndc[0] + 1) / 2, (1 - ndc[1]) / 2];
    return {
      inViewport: Math.abs(ndc[0]) <= 1 && Math.abs(ndc[1]) <= 1 && ndc[2] >= 0 && ndc[2] <= 1,
      viewport, ndc,
    };
  }

  // Move along the viewing axis with a fixed projection. Keep subjects that
  // are already framed inside their readable area as the camera moves closer.
  function fitDolly(camera, forward, subjects, requested) {
    if (requested <= 0) return requested;
    let distance = requested;
    if (forward[1] < 0) distance = Math.min(distance, (camera.position[1] - .6) / -forward[1]);
    for (const point of subjects) {
      const depth = point.reduce((sum, coordinate, index) => sum + (coordinate - camera.position[index]) * forward[index], 0);
      if (depth <= camera.near) continue;
      const projection = projectWorld(point, camera);
      if (!projection.inViewport) continue;
      const [x, y] = projection.ndc;
      const occupied = Math.max(Math.abs(x) / .92, Math.abs(y) / .9);
      distance = Math.min(distance, depth * (1 - occupied), depth - Math.max(.85, camera.near * 2));
    }
    return Math.max(0, distance);
  }

  function zoomDolly({camera,forward,subjects,feet,zoomSteps,follow,current,elapsed}) {
    const heads=subjects.map(([x,y,z])=>[x,y+.58,z]);
    const framed=[...heads,...(feet??subjects.map(([x,y,z])=>[x,Math.max(.12,y-1.5),z]))];
    const target=fitDolly(camera,forward,framed,zoomSteps*(follow?.13:.25));
    const position=current+(target-current)*(1-Math.exp(-15*elapsed));
    return fitDolly(camera,forward,framed,position);
  }

  // Physics space (Z up, WXYZ). Pivot the captured guard around the line
  // through its sole contacts. Both pivot points remain fixed for every angle.
  function idleGuardRoot(root, soles, seconds, side) {
    const [a,b]=soles;
    const axis=b.map((value,i)=>value-a[i]);
    const length=Math.hypot(...axis);
    if(length<1e-5)return root.slice();
    const [x,y,z]=axis.map(value=>value/length);
    const phase=seconds*2*Math.PI/(side===0?3.1:3.6);
    const angle=.016*Math.sin(phase)+.004*Math.sin(2*phase);
    const s=Math.sin(angle/2),c=Math.cos(angle/2);
    const [dx,dy,dz]=root.slice(0,3).map((value,i)=>value-a[i]);
    const dot=x*dx+y*dy+z*dz;
    const cross=[y*dz-z*dy,z*dx-x*dz,x*dy-y*dx];
    const delta=[dx,dy,dz],unit=[x,y,z];
    const position=delta.map((v,i)=>root[i]+2*s*(c*cross[i]+s*(unit[i]*dot-v)));
    const [w,qx,qy,qz]=root.slice(3);
    return [...position,c*w-s*(x*qx+y*qy+z*qz),
      c*qx+s*(x*w+y*qz-z*qy),c*qy+s*(y*w+z*qx-x*qz),c*qz+s*(z*w+x*qy-y*qx)];
  }

  function balancedGuard(root,head,soles) {
    const rise=head[2]-root[2];
    const reach=Math.hypot(...head.map((v,i)=>v-root[i]));
    return head[2]>.95 && rise>.45 && rise>.8*reach &&
      soles.every(foot=>Number.isFinite(foot.gap)&&Math.abs(foot.gap)<.075) &&
      Math.abs(soles[0].gap-soles[1].gap)<.03;
  }

  // Local arm joints only: bounded warm-up, never a full punch or root drift.
  function idleGuardJoint(neutral,seconds,side,index) {
    const phase=seconds*(3.5+side*.23)+index*.71+side*.47;
    const base=index*.71+side*.47;
    const angle=.075*(Math.sin(phase)-Math.sin(base));
    if(neutral.length===1)return [neutral[0]+angle];
    if(neutral.length!==4)return neutral.slice();
    const [w,x,y,z]=neutral,c=Math.cos(angle/2),s=Math.sin(angle/2);
    const q=[c*w-s*x,c*x+s*w,c*y+s*z,c*z-s*y];
    const norm=Math.hypot(...q);
    return q.map(v=>v/norm);
  }

  function heldZoomDolly(camera, forward, focusDepth, wheelDolly) {
    // At fixed FOV a subject's projected size varies as 1 / depth.
    const depth = focusDepth - wheelDolly;
    const advance = Math.max(0, Math.min(depth - depth / 1.5, depth - camera.near * camera.scale[2]));
    return fitDolly(camera, forward, [], wheelDolly + advance);
  }

  function cameraSampleHz(options) {
    // The controller clock reports whole milliseconds. A 60 Hz render loop can
    // deliver consecutive frames 16 ms apart.
    const maximum = options.updateNative ? 1000 / 16 : 25;
    const hz = options.hz ?? maximum;
    if (!Number.isFinite(hz) || hz < 1 || hz > maximum) throw new Error(`Camera observer must run at 1..${maximum} Hz`);
    return hz;
  }

  /** Uses the owner's cached JS head positions. MuJoCo-to-Bevy conversion must be verified.
   * Example: projectHeads(rawHeadWorld, camera, verifiedPhysicsToBevy).
   * Without a converter, returns a blocker instead of guessing axes, scale or origin.
   */
  function projectHeads(heads, camera, toWorld, visibility = [true, true]) {
    if (typeof toWorld !== 'function') return { anchors: [], blocker: 'MUJOCO_TO_BEVY_UNVERIFIED' };
    if (!Array.isArray(heads) || heads.length !== 2) {
      return { anchors: [], blocker: 'HEAD_POSITIONS_UNAVAILABLE' };
    }
    return {
      anchors: heads.map((raw, side) => {
        if (visibility?.[side] !== true || !vector(raw, 3)) return null;
        const world = toWorld(raw.slice(), side);
        if (!vector(world, 3)) return null;
        return { side, bodyId: HEAD_IDS[side], world, ...projectWorld(world, camera) };
      }),
      blocker: heads.some((h, side) => visibility?.[side] === true && vector(h, 3))
        ? null : 'HEAD_POSITIONS_UNAVAILABLE',
    };
  }

  /** Rear-local corners TL, TR, BR, BL, in Bevy world; emits viewport fractions.
   * Clockwise corners viewed from outside define the visible rear face. Keep
   * original projected corners at screen edges; clipping is a visibility test.
   * This is face/frustum visibility, not a scene-depth occlusion query.
   */
  function projectBacks(backs, camera, visibility = [true, true]) {
    return [0, 1].map(side => {
      const quad = backs?.[side];
      if (visibility?.[side] !== true || !Array.isArray(quad) || quad.length !== 4
        || !quad.every(v => vector(v, 3))) return null;
      const down = quad[3].map((v, i) => v - quad[0][i]);
      const right = quad[1].map((v, i) => v - quad[0][i]);
      const normal = [down[1] * right[2] - down[2] * right[1],
        down[2] * right[0] - down[0] * right[2], down[0] * right[1] - down[1] * right[0]];
      const center = quad[0].map((_, i) => quad.reduce((sum, v) => sum + v[i], 0) / 4);
      const facing = normal.reduce((sum, v, i) => sum + v * (camera.position[i] - center[i]), 0);
      if (Math.hypot(...normal) < 1e-8 || facing <= 1e-6) return null;
      const projected = quad.map(point => projectWorld(point, camera));
      if (projected.some(p => !p.viewport || p.ndc[2] < 0 || p.ndc[2] > 1)) return null;
      const corners = projected.map(p => ({ x: p.viewport[0], y: p.viewport[1] }));
      let clipped = corners;
      for (const [axis, edge, direction] of [['x', 0, 1], ['x', 1, -1], ['y', 0, 1], ['y', 1, -1]]) {
        const input = clipped; clipped = [];
        for (let i = 0; i < input.length; i++) {
          const a = input[i], b = input[(i + 1) % input.length];
          const aIn = (a[axis] - edge) * direction >= 0, bIn = (b[axis] - edge) * direction >= 0;
          if (aIn) clipped.push(a);
          if (aIn !== bIn) {
            const t = (edge - a[axis]) / (b[axis] - a[axis]);
            clipped.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
          }
        }
        if (clipped.length < 3) return null;
      }
      const area = clipped.reduce((sum, a, i) => {
        const b = clipped[(i + 1) % clipped.length]; return sum + a.x * b.y - b.x * a.y;
      }, 0);
      return Math.abs(area) > 1e-8 ? corners : null;
    });
  }

  let activeObserver = null;

  /** Caller verifies the on-disk SHA-256 and the single private PID before loading.
   * Frida usage, after loading this file into the owner's script:
   * const camera = TikMngNativeCamera.observe({ expectedPid: Process.id,
   *   verifiedBuildSha256: '9132d5631f59661f8bde912d6b1e5b9788c24fd7031bb1aa81d16b298b293e67',
   *   getHeads: () => rawHeadWorld, onSample: value => send({type:'camera', value}) });
   * Supply toWorld only after the native-render conversion is established.
   * The caller owns message routing and must call camera.stop() at teardown.
   */
  function observe(options = {}) {
    if (typeof Process === 'undefined' || typeof Interceptor === 'undefined') throw new Error('Frida runtime required');
    if (options.expectedPid !== Process.id || options.verifiedBuildSha256 !== BUILD.sha256) {
      throw new Error('Pinned hash verification and exact private PID required');
    }
    if (activeObserver) throw new Error('Camera observer already installed');
    if (Process.arch !== 'x64' || Process.pointerSize !== 8) throw new Error('Windows x64 build required');
    const game = Process.getModuleByName('boxing.exe');
    const expectedPath=globalThis.TikMngVerifiedGamePath || BUILD.path;
    if (game.path.replace(/\\/g, '/').toLowerCase() !== expectedPath || game.size !== BUILD.imageSize) {
      throw new Error('Unexpected game module');
    }
    const pe = game.base.add(game.base.add(0x3c).readU32());
    if (pe.readU32() !== 0x4550 || pe.add(8).readU32() !== BUILD.timestamp) throw new Error('Unexpected PE identity');
    const address = game.base.add(BUILD.helperRva);
    const bytes = new Uint8Array(address.readByteArray(BUILD.prologue.length / 2));
    if (Array.from(bytes, v => v.toString(16).padStart(2, '0')).join('') !== BUILD.prologue) {
      throw new Error('Camera helper fingerprint mismatch');
    }
    const getHeads = options.getHeads ?? (() => null);
    const getBacks = options.getBacks ?? (() => null);
    const getVisibility = options.getVisibility ?? (() => [true, true]);
    const onSample = options.onSample ?? (() => {});
    if ([getHeads, getBacks, getVisibility, onSample].some(v => typeof v !== 'function')
      || (options.toWorld != null && typeof options.toWorld !== 'function')) throw new Error('Invalid camera callbacks');
    const hz = cameraSampleHz(options);
    let stopped = false, lastAt = -Infinity, latest = { mode: 'read-only', status: 'awaiting-camera', anchors: [] };
    const readFloats = (p, offset, count) => Array.from({ length: count }, (_, i) => p.add(offset + i * 4).readFloat());
    const hook = Interceptor.attach(address, {
      onEnter(args) {
        if (stopped) return;
        options.beforeNative?.(args);
        const now = Date.now();
        this.publishSample = now - lastAt >= 1000 / hz;
        if (!this.publishSample && !options.updateNative) return;
        if (this.publishSample) lastAt = now;
        this.pointers = { source: args[0], manager: args[3], camera: args[5], transform: args[6], projection: args[7] };
      },
      onLeave() {
        if (stopped || !this.pointers) return;
        try {
          const p = this.pointers;
          let camera = validateCamera({
            rotation: readFloats(p.transform, 0, 4), position: readFloats(p.transform, 0x10, 3),
            scale: readFloats(p.transform, 0x1c, 3), clipFromView: readFloats(p.camera, 0x10, 16),
            projectionTag: p.projection.readU32(), nearPlane: readFloats(p.projection, 0x10, 4),
            fov: p.projection.add(0x20).readFloat(), aspect: p.projection.add(0x24).readFloat(),
            near: p.projection.add(0x28).readFloat(), far: p.projection.add(0x2c).readFloat(),
            managerSlot: p.manager.add(0x84).readU8(), sourceSelection: p.source.add(0x1a54).readU32(),
          });
          if(options.updateNative)camera=validateCamera(options.updateNative(p,camera)||camera);
          if (!this.publishSample) return;
          const visibility = getVisibility();
          const heads = projectHeads(getHeads(), camera, options.toWorld, visibility);
          const backs = projectBacks(getBacks(), camera, visibility);
          latest = { mode: options.updateNative ? 'controlled' : 'read-only', status: heads.blocker ? 'camera-only' : 'projected',
            at: Date.now(), camera, ...heads, backs, controlsReady: !!options.updateNative };
        } catch (error) {
          if (!this.publishSample) return;
          latest = { mode: 'read-only', status: 'blocked', at: Date.now(), anchors: [], backs: [null, null],
            blocker: String(error.message || error), controlsReady: false };
        } finally { this.pointers = null; }
        // No native pointers escape the original helper's callback lifetime.
        try { onSample(JSON.parse(JSON.stringify(latest))); }
        catch (error) { latest = { mode: 'read-only', status: 'blocked', anchors: [], blocker: `CAMERA_SINK_FAILED: ${error.message}` }; }
      },
    });
    const observer = {
      sample() {
        const value = JSON.parse(JSON.stringify(latest));
        if (value.at && Date.now() - value.at > 250) {
          value.status = 'blocked'; value.anchors = []; value.backs = [null, null]; value.blocker = 'CAMERA_SAMPLE_STALE';
        }
        return value;
      },
      stop() {
        if (stopped) return;
        stopped = true; hook.detach(); activeObserver = null;
        latest = { mode: 'read-only', status: 'stopped', anchors: [], backs: [null, null], controlsReady: false };
      },
    };
    activeObserver = observer;
    return observer;
  }

  return Object.freeze({ BUILD, HEAD_IDS, observe, perspective, validateCamera, projectWorld, projectHeads, projectBacks,
    fitDolly, zoomDolly, heldZoomDolly, cameraSampleHz, idleGuardRoot, idleGuardJoint, balancedGuard });
});

// Persistent narrow regression within this task's two-file ownership boundary.
// Run: node tools/native-camera.js --self-test
if (typeof module === 'object' && typeof require === 'function'
  && require.main === module && process.argv.includes('--self-test')) {
  const assert = require('node:assert/strict');
  const { BUILD, perspective, projectWorld, projectHeads, projectBacks, validateCamera, observe, fitDolly, zoomDolly,
    cameraSampleHz } = module.exports;
  const camera = { rotation: [0, 0, 0, 1], position: [0, 0, 0], scale: [1, 1, 1],
    projectionTag: 6, nearPlane: [0, 0, -1, -0.1], fov: Math.PI / 2, aspect: 2,
    near: 0.1, far: 1000, clipFromView: perspective(Math.PI / 2, 2, 0.1) };
  let checks = 0;
  const near = (a, b) => { assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`); checks++; };
  let p = projectWorld([0, 0, -2], camera);
  near(p.viewport[0], 0.5); near(p.viewport[1], 0.5); near(p.ndc[2], 0.05);
  assert.equal(p.inViewport, true); checks++;
  p = projectWorld([2, 1, -2], camera);
  near(p.viewport[0], 0.75); near(p.viewport[1], 0.25);
  assert.equal(projectWorld([0, 0, 2], camera).reason, 'behind-camera'); checks++;
  assert.equal(projectWorld([0, 0, -0.05], camera).inViewport, false); checks++;
  assert.equal(projectWorld([10, 0, -2], camera).inViewport, false); checks++;
  p = projectWorld([7, -1, -1], { ...camera, position: [3, -4, 7], scale: [2, 3, 4] });
  near(p.viewport[0], 0.75); near(p.viewport[1], 0.25);
  const turned = { ...camera, rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2] };
  p = projectWorld([-2, 0, 0], turned);
  near(p.viewport[0], 0.5); near(p.viewport[1], 0.5);
  assert.equal(p.inViewport, true); checks++;
  assert.throws(() => validateCamera({ ...camera, clipFromView: Array(16).fill(0) }), /matrix/); checks++;
  assert.throws(() => validateCamera({ ...camera, nearPlane: [0, 1, -1, -0.1] }), /Unsupported/); checks++;
  assert.throws(() => validateCamera({ ...camera, rotation: [1, 1, 1, 1] }), /quaternion/); checks++;
  assert.throws(() => projectWorld([NaN, 0, 1], camera), /world point/); checks++;
  assert.throws(() => validateCamera({ ...camera, scale: [0, 1, 1] }), /transform/); checks++;
  const heads = [[0, 0, -2], [1, 0, -2]], before = JSON.stringify(heads);
  assert.equal(projectHeads(heads, camera).blocker, 'MUJOCO_TO_BEVY_UNVERIFIED'); checks++;
  assert.equal(projectHeads([null, null], camera, v => v).blocker, 'HEAD_POSITIONS_UNAVAILABLE'); checks++;
  assert.deepEqual(projectHeads(heads, camera, v => v).anchors.map(a => a.bodyId), [17, 38]); checks++;
  assert.equal(JSON.stringify(heads), before); checks++;
  const levelCamera={...camera,position:[0,1,0]},forward=[0,0,-1];
  const framed=[[1,2,-4],[-1,.2,-4]];
  near(fitDolly(levelCamera,forward,framed,.4),.4);
  near(fitDolly(levelCamera,forward,framed,-1),-1);
  const maximum=fitDolly(levelCamera,forward,framed,8);
  assert.ok(maximum < 4 && framed.every(point=>projectWorld(point,{...levelCamera,position:[0,1,-maximum]}).inViewport)); checks++;
  near(fitDolly({...camera,position:[0,.8,0]},[0,-.6,-.8],[],2),1/3);
  const zoom = {camera:levelCamera,forward,subjects:[[1,1.4,-6],[-1,1.4,-6]],zoomSteps:3,follow:false,current:0,elapsed:.06};
  near(zoomDolly({...zoom,elapsed:4}),.75);
  const edgeFoot=[6.8,0,-4];
  near(zoomDolly({...zoom,feet:[edgeFoot],zoomSteps:10,current:2.5,elapsed:0}),
    fitDolly(levelCamera,forward,[edgeFoot],2.5));
  const {idleGuardRoot,balancedGuard}=module.exports;
  const soles=[[-.26,.08,0],[.23,-.1,.015]],root=[.06,.03,1,1,0,0,0];
  const gaps=[{gap:.006},{gap:.019}];
  assert.ok(balancedGuard(root.slice(0,3),[.07,.05,1.8],gaps));checks++;
  assert.ok(!balancedGuard(root.slice(0,3),[.9,.04,1.51],gaps));checks++;
  assert.ok(!balancedGuard(root.slice(0,3),[.07,.05,1.8],[{gap:.14},{gap:.15}]));checks++;
  assert.ok(!balancedGuard(root.slice(0,3),[.07,.05,1.8],[{gap:.001},{gap:.065}]));checks++;
  for(const side of [0,1]){
    assert.deepEqual(idleGuardRoot(root,soles,0,side),root);checks++;
    const pose=idleGuardRoot(root,soles,.77,side);
    const [w,x,y,z]=pose.slice(3);
    near(Math.hypot(w,x,y,z),1);
    const shift=Math.hypot(...pose.slice(0,3).map((v,i)=>v-root[i]));
    assert.ok(shift>.004&&shift<.023);checks++;
    // Transform each sole from the neutral body's local space into the new pose.
    for(const sole of soles){
      const [dx,dy,dz]=sole.map((v,i)=>v-root[i]);
      const tx=2*(y*dz-z*dy),ty=2*(z*dx-x*dz),tz=2*(x*dy-y*dx);
      near(pose[0]+dx+w*tx+y*tz-z*ty,sole[0]);
      near(pose[1]+dy+w*ty+z*tx-x*tz,sole[1]);
      near(pose[2]+dz+w*tz+x*ty-y*tx,sole[2]);
    }
  }
  assert.equal(1000/cameraSampleHz({}),40); checks++;
  assert.equal(1000/cameraSampleHz({updateNative(){}}),16); checks++;
  assert.throws(()=>cameraSampleHz({hz:60}),/1\.\.25 Hz/); checks++;
  const back=[[-.5,.5,-3],[.5,.5,-3],[.5,-.5,-3],[-.5,-.5,-3]];
  const quads=projectBacks([back,null],camera);
  assert.equal(quads[0].length,4);assert.equal(quads[1],null);checks+=2;
  near(quads[0][0].x,(1-.5/6)/2);near(quads[0][0].y,(1-.5/3)/2);
  assert.equal(projectBacks([[back[1],back[0],back[3],back[2]],null],camera)[0],null);checks++;
  assert.equal(projectBacks([back,back],camera,[false,true])[0],null);checks++;
  assert.ok(projectBacks([back,back],camera,[false,true])[1]);checks++;
  assert.equal(projectBacks([back.map(([x,y])=>[x,y,3]),null],camera)[0],null);checks++;
  const edge=back.map(([x,y,z])=>[x+6,y,z]);
  assert.ok(projectBacks([edge,null],camera)[0]?.some(v=>v.x>1));checks++;
  assert.equal(projectBacks([back.map(([x,y,z])=>[x+20,y,z]),null],camera)[0],null);checks++;
  assert.equal(projectBacks([[back[0],back[0],back[0],back[0]],null],camera)[0],null);checks++;
  assert.equal(projectHeads(heads,camera,v=>v,[false,true]).anchors[0],null);checks++;
  assert.equal(projectHeads([heads[0],null],camera,v=>v).anchors[0].side,0);checks++;
  assert.equal(projectHeads([heads[0],null],camera,v=>v).anchors[1],null);checks++;
  assert.throws(() => observe({}), /Frida runtime/); checks++;
  console.log(`${checks} camera math and fail-closed checks passed`);

  // Exercise the real spectator controller with a deterministic Win32/Frida
  // fixture. No game, process attachment, UI or package build is involved.
  const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
  const spectatorSource=fs.readFileSync(path.join(__dirname,'spectator-camera.js'),'utf8');
  function fixture(){
    class Pointer{
      constructor(buffer=Buffer.alloc(8),offset=0,address=0){this.buffer=buffer;this.offset=offset;this.address=address;}
      add(offset){return new Pointer(this.buffer,this.offset+offset,this.address+offset);}
      isNull(){return this.address===0;}
      equals(other){return this.address===other.address;}
      readS32(){return this.buffer.readInt32LE(this.offset);}
      readU32(){return this.buffer.readUInt32LE(this.offset);}
      writeS32(v){this.buffer.writeInt32LE(v,this.offset);return this;}
      writeU32(v){this.buffer.writeUInt32LE(v,this.offset);return this;}
      writeFloat(v){this.buffer.writeFloatLE(v,this.offset);return this;}
    }
    const ptr=address=>new Pointer(Buffer.alloc(8),0,address);
    const hooks=new Map(),keys=new Set(),samples=[];
    let now=1000,focused=true,mouse=[500,450],cursor=ptr(77),warps=0,cursorCalls=0;
    let mask=[true,true],rawHeads=[[-.5,1.5,-3],[.5,1.5,-3]],framingHeads=null,backs=[back,null],callbacks,observerStops=0;
    const methods={
      GetAsyncKeyState:code=>keys.has(code)?0x8000:0,
      GetForegroundWindow:()=>ptr(focused?10:11),
      GetWindowThreadProcessId:(hwnd,out)=>{out.writeU32(hwnd.address===10?123:999);return 1;},
      GetCursorPos:out=>{out.writeS32(mouse[0]);out.add(4).writeS32(mouse[1]);return 1;},
      SetCursorPos:(x,y)=>{mouse=[x,y];warps++;return 1;},
      GetClientRect:(_hwnd,out)=>{out.writeS32(0);out.add(4).writeS32(0);out.add(8).writeS32(800);out.add(12).writeS32(500);return 1;},
      ClientToScreen:(_hwnd,out)=>{out.writeS32(out.readS32()+100);out.add(4).writeS32(out.add(4).readS32()+200);return 1;},
      SetCursor:value=>{const previous=cursor;cursor=value;cursorCalls++;return previous;},
    };
    const invoke=(name,...args)=>{
      const context={},hook=hooks.get(name);hook?.onEnter?.call(context,args);
      const result=methods[name](...args);hook?.onLeave?.call(context,result);return result;
    };
    const context={
      Process:{id:123,getModuleByName:()=>({getExportByName:name=>name})},
      NativeFunction:function(name){return(...args)=>invoke(name,...args);},
      Memory:{alloc:n=>new Pointer(Buffer.alloc(n),0,100)},ptr,
      Interceptor:{attach:(name,hook)=>{hooks.set(name,hook);return{detach:()=>hooks.delete(name)};}},
      Date:{now:()=>now},
      TikMngNativeCamera:{...module.exports,observe:options=>{
        callbacks=options;return{stop:()=>{observerStops++;}};
      }},
    };
    vm.runInNewContext(spectatorSource,context);
    const controller=context.TikMngSpectatorCamera.create({hash:BUILD.sha256,isReady:()=>true,
      getHeads:()=>rawHeads,getFramingHeads:()=>framingHeads,toWorld:v=>v,getVisibility:()=>mask,getBacks:()=>backs,onSample:v=>samples.push(v)});
    const transform=new Pointer(Buffer.alloc(48),0,5000);
    const step=(ms=16)=>{
      now+=ms;
      const output=callbacks.updateNative({transform},camera);
      const headSample=projectHeads(rawHeads,output,v=>v,mask);
      const value={...headSample,at:now,camera:output,status:headSample.blocker?'camera-only':'projected',
        backs:projectBacks(backs,output,mask)};
      callbacks.onSample(value);return output;
    };
    return{controller,step,keys,samples,invoke,hooks,callbacks,ptr,
      heads:value=>{rawHeads=value;},framing:value=>{framingHeads=value;},visibility:value=>{mask=value;},backs:value=>{backs=value;},
      focus:value=>{focused=value;},mouse:value=>{mouse=value;},
      counts:()=>({warps,cursorCalls,observerStops,cursor:cursor.address}),now:()=>now};
  }
  let controllerChecks=0;
  const guardScene=fixture();
  guardScene.framing([[-.5,1.5,-3],[.5,1.5,-3]]);
  guardScene.controller.setMode('ring');
  const steady=guardScene.step(),markers=guardScene.samples.at(-1).heads;
  guardScene.heads([[-.48,1.51,-3],[.52,1.51,-3]]);
  const breathing=guardScene.step();
  assert.deepEqual(breathing.position,steady.position);assert.deepEqual(breathing.rotation,steady.rotation);
  assert.notDeepEqual(guardScene.samples.at(-1).heads,markers);controllerChecks+=3;
  guardScene.controller.stop();
  const f=fixture();
  let view=f.step();assert.equal(f.samples.at(-1).camera.mode,'free');controllerChecks++;
  f.mouse([530,450]);const openingLook=f.step();
  assert.notDeepEqual(openingLook.rotation,view.rotation);assert.deepEqual(openingLook.position,view.position);controllerChecks+=2;
  f.keys.add(32);view=f.step();assert.equal(f.samples.at(-1).camera.mode,'free');controllerChecks++;
  const beforeRise=view.position[1];view=f.step();assert.ok(view.position[1]>beforeRise);controllerChecks++;
  f.keys.delete(32);f.keys.add(17);const beforeFall=view.position[1];view=f.step();assert.ok(view.position[1]<beforeFall);controllerChecks++;
  f.keys.clear();f.step();
  f.mouse([515,450]);view=f.step();const rotated=view.rotation.slice(),warpCount=f.counts().warps;
  const sameTick=f.step(0);assert.deepEqual(sameTick.rotation,rotated);assert.equal(f.counts().warps,warpCount);controllerChecks+=2;
  f.controller.setMode('free');f.controller.setMode('free');
  f.heads([[200,80,200],[-200,-50,-200]]);
  const stationary=f.step();assert.deepEqual(stationary.position,view.position);assert.deepEqual(stationary.rotation,view.rotation);controllerChecks+=2;
  f.controller.zoom(4);const zoomed=f.step(50);
  assert.ok(Math.hypot(...zoomed.position.map((v,i)=>v-stationary.position[i]))>0);controllerChecks++;
  const ownCalls=f.counts().cursorCalls;f.focus(false);f.mouse([1800,900]);f.step();
  assert.equal(f.counts().cursorCalls,ownCalls);controllerChecks++;
  assert.equal(f.invoke('SetCursor',f.ptr(99)).address,0);assert.equal(f.counts().cursor,99);controllerChecks+=2;
  f.focus(true);f.mouse([500,450]);f.step();f.invoke('SetCursor',f.ptr(88));assert.equal(f.counts().cursor,0);controllerChecks++;
  f.keys.add(36);f.step();assert.equal(f.samples.at(-1).camera.mode,'ring');assert.equal(f.counts().cursor,0);controllerChecks+=2;
  f.mouse([950,450]);f.step();assert.equal(f.counts().cursor,88);controllerChecks++;
  f.mouse([500,450]);f.step();assert.equal(f.counts().cursor,0);controllerChecks++;
  f.keys.clear();f.keys.add(70);f.step();assert.equal(f.samples.at(-1).camera.mode,'free');controllerChecks++;
  f.keys.clear();f.visibility([false,false]);f.controller.setMode('ring');view=f.step();
  assert.ok(view.position.every(Number.isFinite));assert.equal(f.samples.at(-1).camera.ready,true);
  assert.deepEqual(JSON.parse(JSON.stringify(f.samples.at(-1).heads)),[null,null]);controllerChecks+=3;
  f.heads([[3,1.5,-2],[999,999,999]]);f.visibility([true,false]);view=f.step();
  const marker=projectWorld([3,1,-2],view);near(marker.viewport[0],.5);near(marker.viewport[1],.5);controllerChecks++;
  f.controller.follow();const lone=f.step();
  assert.ok((lone.position[0]-3)*3+(lone.position[2]+2)*-2>0);controllerChecks++;
  for(let i=0;i<90;i++)view=f.step();
  assert.deepEqual(view.rotation,lone.rotation);
  const settled=f.step();
  assert.ok(Math.hypot(...settled.position.map((v,i)=>v-view.position[i]))<.00001);controllerChecks+=2;
  f.visibility([true,true]);f.heads([[-2,1.5,0],[2,1.5,0]]);f.controller.setMode('free');f.controller.setMode('ring');
  view=f.step();f.controller.follow();const chase=f.step();
  assert.equal(f.samples.at(-1).camera.mode,'follow');
  const selected=f.samples.at(-1).camera.followSide;
  assert.ok(Math.hypot(...chase.position.map((v,i)=>v-([-2,1.5,0][i]+(i===0?selected*4:0))))>6);controllerChecks+=2;
  f.visibility([false,false]);f.step();assert.equal(f.samples.at(-1).camera.mode,'ring');controllerChecks++;
  f.controller.stop();f.controller.stop();assert.equal(f.counts().observerStops,1);assert.equal(f.hooks.size,0);controllerChecks+=2;
  assert.throws(()=>f.controller.setMode('free'),/kapandı/);controllerChecks++;
  for(const mode of ['ring','free','follow']){
    const held=fixture(),normal=fixture();
    for(const scene of [held,normal]){
      scene.heads([[0,1.5,0],null]);scene.visibility([true,false]);scene.controller.setMode('ring');scene.step();
      if(mode==='follow')scene.controller.follow();
      else scene.controller.setMode(mode);
    }
    const base=normal.step();held.step();
    // One off-axis marker at the actual aim depth; measure its screen-space
    // displacement from the optical center as the wheel keeps moving.
    const aim=[0,1,mode==='follow'?-.5:0];
    const dx=base.position[0]-aim[0],dz=base.position[2]-aim[2],length=Math.hypot(dx,dz);
    const marker=[aim[0]+dz/length,aim[1],aim[2]-dx/length];
    const projectedSize=view=>Math.abs(projectWorld(marker,view).ndc[0]);
    held.keys.add(2);
    for(const delta of [0,3,-4]){
      normal.controller.zoom(delta);held.controller.zoom(delta);
      const ratio=projectedSize(held.step())/projectedSize(normal.step());
      assert.ok(Math.abs(ratio-1.5)<1e-8,`${mode}, wheel delta ${delta}: ${ratio}x`);controllerChecks++;
    }
    if(mode==='free')held.focus(false);
    else held.keys.delete(2);
    assert.deepEqual(Array.from(held.step().position),Array.from(normal.step().position));controllerChecks++;
    held.controller.stop();normal.controller.stop();
  }
  const old=fixture();old.step();old.controller.setMode('free');old.step();
  assert.equal(old.samples.at(-1).camera.mode,'free');controllerChecks++;old.controller.stop();
  console.log(`${controllerChecks} spectator input, visibility, chase and cleanup checks passed`);
}
