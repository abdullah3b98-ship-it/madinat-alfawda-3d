// ragdoll.ts — lightweight verlet ragdoll (15 particles, 10 visual segments) for مدينة الفوضى.
// Y-up, metres. No physics engine needed. Typical cost: ~0.05 ms per ragdoll per frame.
import * as THREE from "three";

export type V3 = { x: number; y: number; z: number };
export const JOINTS = ["head", "neck", "pelvis", "shoulderL", "elbowL", "handL", "shoulderR", "elbowR", "handR", "hipL", "kneeL", "footL", "hipR", "kneeR", "footR"] as const;
export type JointName = (typeof JOINTS)[number];
export const SEGMENTS = ["head", "torso", "upperArmL", "lowerArmL", "upperArmR", "lowerArmR", "upperLegL", "lowerLegL", "upperLegR", "lowerLegR"] as const;
export type SegmentName = (typeof SEGMENTS)[number];

/** Box collider: either an AABB (min/max) or an OBB (center/half + rotation). */
export type BoxCollider =
  | { min: V3; max: V3 }
  | { center: V3; half: V3; rotY?: number; quat?: { x: number; y: number; z: number; w: number } };

export interface RagdollOptions {
  groundHeight?: (x: number, z: number) => number;
  /** static colliders (use for a handful of nearby boxes) */
  colliders?: BoxCollider[];
  /** spatial query for big worlds: return boxes near (x,z) within r. Called once per step. */
  queryColliders?: (x: number, z: number, r: number) => readonly BoxCollider[];
  gravity?: number; // 9.81
  iterations?: number; // 10
  friction?: number; // 0..1, 0.6
  restitution?: number; // 0.1
  damping?: number; // per step velocity keep, 0.995
  /** max particle motion per step (m) considered "still". default 0.0015 */
  sleepThreshold?: number;
  /** seconds of stillness before sleeping. default 0.6 */
  sleepTime?: number;
  /** force sleep after this many seconds. default 12 */
  maxActiveTime?: number;
  onSettle?: (r: Ragdoll) => void;
}

export interface RagdollPose {
  /** world positions of the 15 joints (see standingJoints / estimateJoints to build them) */
  joints: Record<JointName, V3>;
  /** segment meshes to drive. Their current world transform is kept relative to the segment (bind on start). */
  meshes?: Partial<Record<SegmentName, THREE.Object3D>>;
  /** initial body velocity (m/s), e.g. the character's or car's velocity */
  velocity?: V3;
}

const J = (n: JointName): number => JOINTS.indexOf(n);
const SEG_J: Record<SegmentName, [JointName, JointName]> = {
  head: ["neck", "head"], torso: ["pelvis", "neck"],
  upperArmL: ["shoulderL", "elbowL"], lowerArmL: ["elbowL", "handL"], upperArmR: ["shoulderR", "elbowR"], lowerArmR: ["elbowR", "handR"],
  upperLegL: ["hipL", "kneeL"], lowerLegL: ["kneeL", "footL"], upperLegR: ["hipR", "kneeR"], lowerLegR: ["kneeR", "footR"],
};
const MASS: Record<JointName, number> = { head: 5, neck: 9, pelvis: 12, shoulderL: 4, elbowL: 2.5, handL: 1, shoulderR: 4, elbowR: 2.5, handR: 1, hipL: 6, kneeL: 4, footL: 2, hipR: 6, kneeR: 4, footR: 2 };
const RADIUS: Record<JointName, number> = { head: 0.12, neck: 0.11, pelvis: 0.12, shoulderL: 0.07, elbowL: 0.055, handL: 0.05, shoulderR: 0.07, elbowR: 0.055, handR: 0.05, hipL: 0.08, kneeL: 0.065, footL: 0.06, hipR: 0.08, kneeR: 0.065, footR: 0.06 };

interface Stick { a: number; b: number; len: number; min: number; max: number }
interface Box { c: THREE.Vector3; h: THREE.Vector3; m: THREE.Matrix3; mi: THREE.Matrix3 }
interface Bind { seg: SegmentName; obj: THREE.Object3D; a: number; b: number; offset: THREE.Matrix4; x: THREE.Vector3 }

const DT = 1 / 60;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _box = new THREE.Box3();

function toBox(c: BoxCollider): Box {
  if ("min" in c) {
    const ce = new THREE.Vector3((c.min.x + c.max.x) / 2, (c.min.y + c.max.y) / 2, (c.min.z + c.max.z) / 2);
    const h = new THREE.Vector3(Math.abs(c.max.x - c.min.x) / 2, Math.abs(c.max.y - c.min.y) / 2, Math.abs(c.max.z - c.min.z) / 2);
    return { c: ce, h, m: new THREE.Matrix3(), mi: new THREE.Matrix3() };
  }
  const q = c.quat ? new THREE.Quaternion(c.quat.x, c.quat.y, c.quat.z, c.quat.w) : new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.rotY ?? 0);
  const m = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
  return { c: new THREE.Vector3(c.center.x, c.center.y, c.center.z), h: new THREE.Vector3(c.half.x, c.half.y, c.half.z), m, mi: m.clone().transpose() };
}

/** Helper: AABB collider from the game's Wall type {x0,z0,x1,z1,h} (madinat-v2 world.ts). */
export function boxFromWall(w: { x0: number; z0: number; x1: number; z1: number; h: number }, groundY = 0): BoxCollider {
  return { min: { x: Math.min(w.x0, w.x1), y: groundY, z: Math.min(w.z0, w.z1) }, max: { x: Math.max(w.x0, w.x1), y: groundY + w.h, z: Math.max(w.z0, w.z1) } };
}

/** A plausible standing pose. heading = yaw in radians (0 → facing +Z), feet at pos. */
export function standingJoints(pos: V3, heading = 0, height = 1.75): Record<JointName, V3> {
  const s = height / 1.75, cs = Math.cos(heading), sn = Math.sin(heading);
  // local: +x = character's left, +z = forward
  const L = (x: number, y: number, z: number): V3 => ({ x: pos.x + (x * cs + z * sn) * s, y: pos.y + y * s, z: pos.z + (-x * sn + z * cs) * s });
  return {
    head: L(0, 1.62, 0), neck: L(0, 1.45, 0), pelvis: L(0, 0.95, 0),
    shoulderL: L(0.19, 1.42, 0), elbowL: L(0.24, 1.14, -0.02), handL: L(0.26, 0.88, 0.04),
    shoulderR: L(-0.19, 1.42, 0), elbowR: L(-0.24, 1.14, -0.02), handR: L(-0.26, 0.88, 0.04),
    hipL: L(0.1, 0.92, 0), kneeL: L(0.11, 0.5, 0.03), footL: L(0.11, 0.07, 0),
    hipR: L(-0.1, 0.92, 0), kneeR: L(-0.11, 0.5, 0.03), footR: L(-0.11, 0.07, 0),
  };
}

/** Estimate joint positions from segment meshes (uses each geometry's bounding box long axis). Missing parts fall back to a standing pose. */
export function estimateJoints(meshes: Partial<Record<SegmentName, THREE.Object3D>>): Record<JointName, V3> {
  const ends = (o: THREE.Object3D | undefined): [THREE.Vector3, THREE.Vector3, THREE.Vector3, number] | null => {
    if (!o) return null;
    o.updateWorldMatrix(true, false);
    const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (g) { if (!g.boundingBox) g.computeBoundingBox(); _box.copy(g.boundingBox!); }
    else _box.setFromObject(o).applyMatrix4(_m.copy(o.matrixWorld).invert());
    const c = _box.getCenter(new THREE.Vector3()), sz = _box.getSize(new THREE.Vector3());
    const ax = sz.x >= sz.y && sz.x >= sz.z ? 0 : sz.y >= sz.z ? 1 : 2;
    const half = [sz.x, sz.y, sz.z][ax] / 2;
    const second = [sz.x, sz.y, sz.z].filter((_, i) => i !== ax).reduce((p, v) => Math.max(p, v), 0) / 2;
    const p0 = c.clone(), p1 = c.clone();
    p0.setComponent(ax, c.getComponent(ax) - half); p1.setComponent(ax, c.getComponent(ax) + half);
    p0.applyMatrix4(o.matrixWorld); p1.applyMatrix4(o.matrixWorld); c.applyMatrix4(o.matrixWorld);
    return [p0, p1, c, second * o.matrixWorld.getMaxScaleOnAxis()];
  };
  const order = (e: [THREE.Vector3, THREE.Vector3, THREE.Vector3, number], near: THREE.Vector3): [THREE.Vector3, THREE.Vector3] =>
    e[0].distanceToSquared(near) <= e[1].distanceToSquared(near) ? [e[0], e[1]] : [e[1], e[0]];
  const torso = ends(meshes.torso);
  // fallback frame from torso or a default standing pose at origin
  let base: Record<JointName, V3>;
  if (torso) {
    const [top, bot] = torso[0].y > torso[1].y ? [torso[0], torso[1]] : [torso[1], torso[0]];
    const len = top.distanceTo(bot);
    base = standingJoints({ x: bot.x, y: bot.y - len * 1.9, z: bot.z }, 0, len * 3.5);
    base.neck = top; base.pelvis = bot;
    // lateral axis: towards the right upper arm if present
    const uaR = ends(meshes.upperArmR), uaL = ends(meshes.upperArmL);
    _r.set(-1, 0, 0);
    if (uaR) _r.subVectors(uaR[2], top); else if (uaL) _r.subVectors(top, uaL[2]);
    _u.subVectors(top, bot).normalize();
    _r.addScaledVector(_u, -_r.dot(_u)).normalize();
    const w = torso[3] || 0.18;
    base.shoulderL = top.clone().addScaledVector(_r, -w); base.shoulderR = top.clone().addScaledVector(_r, w);
    base.hipL = bot.clone().addScaledVector(_r, -w * 0.55); base.hipR = bot.clone().addScaledVector(_r, w * 0.55);
  } else base = standingJoints({ x: 0, y: 0, z: 0 });
  const head = ends(meshes.head);
  if (head) base.head = head[2];
  const limb = (up: SegmentName, lo: SegmentName, root: JointName, mid: JointName, tip: JointName): void => {
    const eu = ends(meshes[up]);
    const rootV = new THREE.Vector3(base[root].x, base[root].y, base[root].z);
    let midV: THREE.Vector3 | null = null;
    if (eu) { const [p, d] = order(eu, rootV); base[root] = p; midV = d; base[mid] = d; }
    const el = ends(meshes[lo]);
    if (el) {
      const near = midV ?? new THREE.Vector3(base[mid].x, base[mid].y, base[mid].z);
      const [p, d] = order(el, near);
      base[mid] = midV ? midV.clone().add(p).multiplyScalar(0.5) : p;
      base[tip] = d;
    }
  };
  limb("upperArmL", "lowerArmL", "shoulderL", "elbowL", "handL");
  limb("upperArmR", "lowerArmR", "shoulderR", "elbowR", "handR");
  limb("upperLegL", "lowerLegL", "hipL", "kneeL", "footL");
  limb("upperLegR", "lowerLegR", "hipR", "kneeR", "footR");
  return base;
}

export class Ragdoll {
  readonly n = JOINTS.length;
  readonly pos = new Float32Array(this.n * 3);
  readonly prev = new Float32Array(this.n * 3);
  readonly invMass = new Float32Array(this.n);
  readonly radius = new Float32Array(this.n);
  sleeping = false;
  /** seconds since start */
  age = 0;
  private sticks: Stick[] = [];
  private binds: Bind[] = [];
  private boxes: Box[] = [];
  private acc = 0;
  private still = 0;
  private o: Required<Omit<RagdollOptions, "colliders" | "queryColliders" | "onSettle">> & RagdollOptions;
  private disposed = false;

  constructor(opts: RagdollOptions = {}) {
    this.o = {
      groundHeight: (): number => 0, gravity: 9.81, iterations: 10, friction: 0.6, restitution: 0.1, damping: 0.995,
      sleepThreshold: 0.0015, sleepTime: 0.6, maxActiveTime: 12, ...opts,
    };
    if (opts.colliders) this.setColliders(opts.colliders);
    for (let i = 0; i < this.n; i++) { this.invMass[i] = 1 / MASS[JOINTS[i]]; this.radius[i] = RADIUS[JOINTS[i]]; }
  }

  static fromPose(pose: RagdollPose, opts: RagdollOptions = {}): Ragdoll { const r = new Ragdoll(opts); r.setPose(pose); return r; }
  /** Convenience: estimate joints from the meshes, then bind them. */
  static fromMeshes(meshes: Partial<Record<SegmentName, THREE.Object3D>>, opts: RagdollOptions = {}, velocity?: V3): Ragdoll {
    return Ragdoll.fromPose({ joints: estimateJoints(meshes), meshes, velocity }, opts);
  }

  setColliders(list: readonly BoxCollider[]): void { this.boxes = list.map(toBox); }

  /** (Re)start from a pose. Wakes the ragdoll. */
  setPose(pose: RagdollPose): void {
    const v = pose.velocity ?? { x: 0, y: 0, z: 0 };
    for (let i = 0; i < this.n; i++) {
      const p = pose.joints[JOINTS[i]];
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      this.prev[i * 3] = p.x - v.x * DT; this.prev[i * 3 + 1] = p.y - v.y * DT; this.prev[i * 3 + 2] = p.z - v.z * DT;
    }
    this.buildSticks();
    this.binds = [];
    if (pose.meshes) this.bind(pose.meshes);
    this.sleeping = false; this.still = 0; this.age = 0; this.acc = 0;
  }

  private P(i: number, out: THREE.Vector3): THREE.Vector3 { return out.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]); }
  private dist(a: number, b: number): number {
    const dx = this.pos[a * 3] - this.pos[b * 3], dy = this.pos[a * 3 + 1] - this.pos[b * 3 + 1], dz = this.pos[a * 3 + 2] - this.pos[b * 3 + 2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private buildSticks(): void {
    const s: Stick[] = [];
    const add = (a: JointName, b: JointName, minF = 1, maxF = 1): void => {
      const ia = J(a), ib = J(b), l = this.dist(ia, ib);
      s.push({ a: ia, b: ib, len: l, min: l * minF, max: l * maxF });
    };
    for (const k of SEGMENTS) add(SEG_J[k][0], SEG_J[k][1]);
    // rigid torso box
    const torso: JointName[] = ["shoulderL", "shoulderR", "hipL", "hipR"];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) add(torso[i], torso[j]);
    add("neck", "shoulderL"); add("neck", "shoulderR"); add("pelvis", "hipL"); add("pelvis", "hipR");
    add("neck", "hipL"); add("neck", "hipR"); add("pelvis", "shoulderL"); add("pelvis", "shoulderR");
    // angular limits as min/max distance ranges
    const range = (a: JointName, b: JointName, lo: number, hi: number): void => {
      const ia = J(a), ib = J(b);
      s.push({ a: ia, b: ib, len: 0, min: lo, max: hi });
    };
    const len = (a: JointName, b: JointName): number => this.dist(J(a), J(b));
    for (const side of ["L", "R"] as const) {
      const ua = len(`shoulder${side}`, `elbow${side}`), la = len(`elbow${side}`, `hand${side}`);
      range(`shoulder${side}`, `hand${side}`, (ua + la) * 0.3, ua + la); // elbow fold limit
      const ul = len(`hip${side}`, `knee${side}`), ll = len(`knee${side}`, `foot${side}`);
      range(`hip${side}`, `foot${side}`, (ul + ll) * 0.35, ul + ll); // knee fold limit
      const kn = len(`knee${side}`, "neck");
      range(`knee${side}`, "neck", kn * 0.5, kn * 1.05); // hip flexion limit
      const hs = len("head", `shoulder${side}`);
      range("head", `shoulder${side}`, hs * 0.75, hs * 1.15); // neck side tilt
    }
    const hp = len("head", "pelvis");
    range("head", "pelvis", hp * 0.85, hp * 1.02); // neck flexion cone
    range("kneeL", "kneeR", 0.12, 10); range("footL", "footR", 0.1, 10); range("handL", "head", 0.12, 10); range("handR", "head", 0.12, 10);
    this.sticks = s;
  }

  // --- mesh binding
  private frame(a: number, b: number, x: THREE.Vector3, out: THREE.Matrix4): THREE.Matrix4 {
    this.P(a, _a); this.P(b, _b);
    _y.subVectors(_b, _a);
    if (_y.lengthSq() < 1e-10) _y.set(0, 1, 0); else _y.normalize();
    _x.copy(x).addScaledVector(_y, -x.dot(_y));
    if (_x.lengthSq() < 1e-6) { this.torsoAxes(); _x.copy(_f).addScaledVector(_y, -_f.dot(_y)); }
    _x.normalize();
    _z.crossVectors(_x, _y).normalize();
    x.copy(_x);
    return out.makeBasis(_x, _y, _z).setPosition(_a);
  }
  /** sets _r (right) and _f (forward) from the torso */
  private torsoAxes(): void {
    this.P(J("shoulderR"), _c); this.P(J("shoulderL"), _d); _r.subVectors(_c, _d).normalize();
    this.P(J("neck"), _c); this.P(J("pelvis"), _d); _u.subVectors(_c, _d).normalize();
    _f.crossVectors(_u, _r).normalize();
  }
  private bind(meshes: Partial<Record<SegmentName, THREE.Object3D>>): void {
    this.torsoAxes();
    for (const seg of SEGMENTS) {
      const obj = meshes[seg];
      if (!obj) continue;
      obj.updateWorldMatrix(true, false);
      const [ja, jb] = SEG_J[seg];
      const x = _r.clone();
      const F = this.frame(J(ja), J(jb), x, new THREE.Matrix4());
      const offset = F.invert().multiply(obj.matrixWorld);
      this.binds.push({ seg, obj, a: J(ja), b: J(jb), offset, x });
    }
  }

  /** Push the body at a world point. impulse in N·s (≈ kg·m/s): pistol ~6, shotgun ~25, car hit ~400+. */
  applyImpulse(hitPoint: V3, impulse: V3, spread = 0.25): void {
    let best = 0, bt = 0, bd = Infinity;
    for (let k = 0; k < SEGMENTS.length; k++) {
      const [ja, jb] = SEG_J[SEGMENTS[k]];
      this.P(J(ja), _a); this.P(J(jb), _b);
      _c.subVectors(_b, _a); _d.set(hitPoint.x - _a.x, hitPoint.y - _a.y, hitPoint.z - _a.z);
      const t = Math.max(0, Math.min(1, _d.dot(_c) / Math.max(1e-6, _c.lengthSq())));
      const d = _d.addScaledVector(_c, -t).lengthSq();
      if (d < bd) { bd = d; best = k; bt = t; }
    }
    const [ja, jb] = SEG_J[SEGMENTS[best]];
    const ia = J(ja), ib = J(jb);
    const mSeg = MASS[ja] + MASS[jb];
    let total = 0;
    for (const j of JOINTS) total += MASS[j];
    const local = 1 - spread;
    const kick = (i: number, w: number, m: number): void => {
      const s = (w * DT) / m;
      this.prev[i * 3] -= impulse.x * s; this.prev[i * 3 + 1] -= impulse.y * s; this.prev[i * 3 + 2] -= impulse.z * s;
    };
    kick(ia, local * (1 - bt), mSeg); kick(ib, local * bt, mSeg);
    for (let i = 0; i < this.n; i++) kick(i, spread, total);
    this.wake();
  }

  /** add a velocity (m/s) to every particle */
  addVelocity(v: V3): void {
    for (let i = 0; i < this.n; i++) { this.prev[i * 3] -= v.x * DT; this.prev[i * 3 + 1] -= v.y * DT; this.prev[i * 3 + 2] -= v.z * DT; }
    this.wake();
  }
  wake(): void { this.sleeping = false; this.still = 0; }

  /** Pelvis world position (useful for camera, loot drop, pickup). */
  getPosition(out = new THREE.Vector3()): THREE.Vector3 { return this.P(J("pelvis"), out); }
  getJoint(name: JointName, out = new THREE.Vector3()): THREE.Vector3 { return this.P(J(name), out); }

  /** Advance the simulation (fixed 60 Hz internally) and sync the meshes. */
  update(dt: number): void {
    if (this.disposed || this.sleeping) return;
    this.acc += Math.min(dt, 0.1);
    let steps = 0;
    while (this.acc >= DT && steps < 4) { this.step(); this.acc -= DT; steps++; if (this.sleeping) break; }
    if (steps >= 4) this.acc = 0;
    if (steps > 0) this.syncMeshes();
  }

  private step(): void {
    const o = this.o, p = this.pos, q = this.prev, n = this.n;
    this.age += DT;
    // integrate
    const g = -o.gravity * DT * DT;
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      for (let c = 0; c < 3; c++) {
        const cur = p[k + c], v = (cur - q[k + c]) * o.damping;
        q[k + c] = cur;
        p[k + c] = cur + v + (c === 1 ? g : 0);
      }
    }
    // colliders
    if (o.queryColliders) { this.P(J("pelvis"), _a); this.setColliders(o.queryColliders(_a.x, _a.z, 2.5)); }
    for (let it = 0; it < o.iterations; it++) {
      for (const s of this.sticks) this.solveStick(s);
      this.hinges();
      this.collide(it === o.iterations - 1);
    }
    // sleep detection
    let maxMove = 0;
    for (let i = 0; i < n * 3; i++) maxMove = Math.max(maxMove, Math.abs(p[i] - q[i]));
    if (maxMove < o.sleepThreshold) this.still += DT; else this.still = 0;
    if (this.still >= o.sleepTime || this.age >= o.maxActiveTime) {
      this.sleeping = true;
      q.set(p);
      o.onSettle?.(this);
    }
  }

  private solveStick(s: Stick): void {
    const p = this.pos, a = s.a * 3, b = s.b * 3;
    const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    let target: number;
    if (d < s.min) target = s.min; else if (d > s.max) target = s.max; else return;
    const wa = this.invMass[s.a], wb = this.invMass[s.b], w = wa + wb;
    const k = (d - target) / (d * w);
    p[a] += dx * k * wa; p[a + 1] += dy * k * wa; p[a + 2] += dz * k * wa;
    p[b] -= dx * k * wb; p[b + 1] -= dy * k * wb; p[b + 2] -= dz * k * wb;
  }

  /** knees bend forward only, elbows bend backward only; thighs can't swing far behind the body */
  private hinges(): void {
    this.torsoAxes();
    const fix = (root: JointName, mid: JointName, tip: JointName, sign: number): void => {
      const im = J(mid);
      this.P(J(root), _a); this.P(J(tip), _b); this.P(im, _c);
      _d.addVectors(_a, _b).multiplyScalar(0.5).sub(_c).negate(); // mid - midpoint
      const along = _d.dot(_f) * sign;
      if (along < 0) {
        _c.addScaledVector(_f, -along * sign * 0.5);
        this.pos[im * 3] = _c.x; this.pos[im * 3 + 1] = _c.y; this.pos[im * 3 + 2] = _c.z;
      }
    };
    fix("hipL", "kneeL", "footL", 1); fix("hipR", "kneeR", "footR", 1);
    fix("shoulderL", "elbowL", "handL", -1); fix("shoulderR", "elbowR", "handR", -1);
    for (const side of ["L", "R"] as const) { // hip extension limit (~25° behind)
      const ih = J(`hip${side}`), ik = J(`knee${side}`);
      this.P(ih, _a); this.P(ik, _b);
      _d.subVectors(_b, _a); const l = _d.length() || 1e-6;
      const back = _d.dot(_f) / l;
      if (back < -0.42) { _b.addScaledVector(_f, (-0.42 - back) * l * 0.5); this.pos[ik * 3] = _b.x; this.pos[ik * 3 + 1] = _b.y; this.pos[ik * 3 + 2] = _b.z; }
    }
  }

  private collide(friction: boolean): void {
    const o = this.o, p = this.pos;
    for (let i = 0; i < this.n; i++) {
      const k = i * 3, r = this.radius[i];
      // ground
      const gy = o.groundHeight(p[k], p[k + 2]) + r;
      if (p[k + 1] < gy) {
        p[k + 1] = gy;
        if (friction) this.contact(i, 0, 1, 0);
      }
      // boxes
      for (let b = 0; b < this.boxes.length; b++) {
        const bx = this.boxes[b];
        _a.set(p[k] - bx.c.x, p[k + 1] - bx.c.y, p[k + 2] - bx.c.z).applyMatrix3(bx.mi);
        const ex = bx.h.x + r, ey = bx.h.y + r, ez = bx.h.z + r;
        if (Math.abs(_a.x) >= ex || Math.abs(_a.y) >= ey || Math.abs(_a.z) >= ez) continue;
        const px = ex - Math.abs(_a.x), py = ey - Math.abs(_a.y), pz = ez - Math.abs(_a.z);
        _b.set(0, 0, 0);
        if (px <= py && px <= pz) { _a.x = Math.sign(_a.x || 1) * ex; _b.x = Math.sign(_a.x); }
        else if (py <= pz) { _a.y = Math.sign(_a.y || 1) * ey; _b.y = Math.sign(_a.y); }
        else { _a.z = Math.sign(_a.z || 1) * ez; _b.z = Math.sign(_a.z); }
        _a.applyMatrix3(bx.m).add(bx.c); _b.applyMatrix3(bx.m);
        p[k] = _a.x; p[k + 1] = _a.y; p[k + 2] = _a.z;
        if (friction) this.contact(i, _b.x, _b.y, _b.z);
      }
    }
  }

  /** velocity response at a contact with normal n: remove inward velocity, apply friction + restitution */
  private contact(i: number, nx: number, ny: number, nz: number): void {
    const p = this.pos, q = this.prev, k = i * 3, o = this.o;
    const vx = p[k] - q[k], vy = p[k + 1] - q[k + 1], vz = p[k + 2] - q[k + 2];
    const vn = vx * nx + vy * ny + vz * nz;
    const tx = vx - nx * vn, ty = vy - ny * vn, tz = vz - nz * vn;
    const f = 1 - o.friction;
    const nv = vn < 0 ? -vn * o.restitution : vn;
    q[k] = p[k] - (tx * f + nx * nv); q[k + 1] = p[k + 1] - (ty * f + ny * nv); q[k + 2] = p[k + 2] - (tz * f + nz * nv);
  }

  private syncMeshes(): void {
    for (const b of this.binds) {
      this.frame(b.a, b.b, b.x, _m).multiply(b.offset); // world
      const parent = b.obj.parent;
      if (parent) { parent.updateWorldMatrix(true, false); _m2.copy(parent.matrixWorld).invert().multiply(_m); }
      else _m2.copy(_m);
      _m2.decompose(b.obj.position, _q, _c);
      b.obj.quaternion.copy(_q); b.obj.scale.copy(_c);
    }
  }

  /** Release references. removeMeshes=true also detaches the bound meshes from their parents. */
  dispose(removeMeshes = false): void {
    if (removeMeshes) for (const b of this.binds) b.obj.removeFromParent();
    this.binds = []; this.boxes = []; this.sticks = [];
    this.disposed = true; this.sleeping = true;
  }
}
