import * as THREE from "three";
import { GB, col } from "./geo";

export type Look = {
  skin: string; hair: string; hairStyle: number; beard: number; outfit: number; robe: string; shem: number;
  shirt: string; pants: string; shoes: string; fat: number; tall: number; thin: number;
  stride: number; bounce: number; swing: number; lean: number; hero: number;
};
const SKINS = ["#f1c27d", "#e0ac69", "#c68642", "#a8713f", "#8d5524", "#ffdbac", "#d9a06b"];
const HAIRS = ["#1b120c", "#0d0d0d", "#3b2414", "#5a3a22", "#2b1b10", "#8a8a8a"];
const SHIRTS = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22", "#1abc9c", "#ecf0f1", "#34495e", "#ff7eb6", "#263238", "#795548"];
const PANTS = ["#2c3e50", "#34495e", "#5d4037", "#1f3a93", "#222222", "#7f8c8d", "#c2b280"];
const ROBES = ["#f7f7f5", "#f2f0ea", "#ffffff", "#e9e4d8", "#d7d2c6", "#c9c3b7", "#8b8f94", "#3e4a59"];
export function randomLook(R: () => number): Look {
  const p = <T,>(a: T[]): T => a[Math.floor(R() * a.length)];
  const body = R(); const fat = body < 0.18 ? 1.25 + R() * 0.25 : body < 0.3 ? 0.82 : 1;
  const tall = R() < 0.12 ? 0.84 + R() * 0.06 : R() < 0.2 ? 1.1 + R() * 0.08 : 0.95 + R() * 0.1;
  const dress = R() < 0.3; // American city: casual / business; some women in dresses
  return { skin: p(SKINS), hair: p(HAIRS), hairStyle: Math.floor(R() * 5), beard: dress ? 0 : R() < 0.35 ? 1 + Math.floor(R() * 4) : 0, outfit: dress ? 0 : R() < 0.15 ? 2 : 1, robe: p(["#b03a48", "#2e4a7d", "#3f6b4f", "#d8a33a", "#6d3f8c", "#222222", "#e9e4d8"]), shem: 0, shirt: p(SHIRTS), pants: p(PANTS), shoes: p(["#1a1a1a", "#3e2723", "#f5f5f5", "#5d4037"]), fat, tall, thin: fat < 0.9 ? 1 : 0, stride: 0.8 + R() * 0.45, bounce: 0.6 + R() * 0.9, swing: 0.6 + R() * 0.8, lean: (R() - 0.5) * 0.12, hero: 0 };
}

export type Rig = {
  root: THREE.Group; body: THREE.Group; hips: THREE.Object3D; spine: THREE.Object3D; chest: THREE.Object3D; neck: THREE.Object3D; head: THREE.Object3D;
  sh: THREE.Object3D[]; el: THREE.Object3D[]; hand: THREE.Object3D[]; th: THREE.Object3D[]; kn: THREE.Object3D[]; ft: THREE.Object3D[];
  robe: THREE.Object3D | null; meshes: THREE.Mesh[]; lo: THREE.Mesh; look: Look; gun: THREE.Object3D | null; gunId: number; deadT: number; t: number; ext: Ext | null;
};
export type Ext = { obj: THREE.Object3D; mixer: THREE.AnimationMixer; act: Record<string, THREE.AnimationAction>; cur: string; hand: THREE.Object3D | null };

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.0 });
let SHEM: THREE.MeshStandardMaterial | null = null;
export function setShemTex(t: THREE.Texture): void { SHEM = new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: 0.85 }); }
export function humanMaterials(): THREE.Material[] { return SHEM ? [MAT, SHEM] : [MAT]; }

const G = { cap: new THREE.CapsuleGeometry(1, 1, 4, 10), sph: new THREE.SphereGeometry(1, 16, 12), cyl: new THREE.CylinderGeometry(1, 1, 1, 14, 1, true), cylC: new THREE.CylinderGeometry(1, 1, 1, 12), box: new THREE.BoxGeometry(1, 1, 1), tor: new THREE.TorusGeometry(1, 0.22, 6, 16), cone: new THREE.ConeGeometry(1, 1, 8) };
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
function T(x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0): THREE.Matrix4 { return M4.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz)); }
function capsule(gb: GB, x: number, y0: number, y1: number, z: number, r: number, c: THREE.Color, sx = 1, sz = 1): void { const len = Math.max(0.01, Math.abs(y1 - y0) - 2 * r); gb.geo(G.cap, T(x, (y0 + y1) / 2, z, r * sx, len / 1 / 1, r * sz).multiply(new THREE.Matrix4().makeScale(1, 1, 1)), c); fixCap(gb, len, r); }
// CapsuleGeometry(1,1) has radius 1 and length 1; scaling y by len would also scale the hemispheres. fix by rebuilding: simpler: use per-call geometry cache
const capCache = new Map<string, THREE.CapsuleGeometry>();
function fixCap(_gb: GB, _l: number, _r: number): void { /* handled in cap() */ }
function cap(gb: GB, x: number, ya: number, yb: number, z: number, r: number, c: THREE.Color, sx = 1, sz = 1, rx = 0, rz = 0): void {
  const len = Math.max(0.01, Math.abs(yb - ya) - 2 * r), key = len.toFixed(2) + "," + r.toFixed(3);
  let g = capCache.get(key); if (!g) { g = new THREE.CapsuleGeometry(r, len, 4, 10); capCache.set(key, g); }
  gb.geo(g, T(x, (ya + yb) / 2, z, sx, 1, sz, rx, 0, rz), c);
}
void capsule;

function part(parent: THREE.Object3D, gb: GB, mat: THREE.Material, list: THREE.Mesh[]): THREE.Mesh | null {
  if (gb.empty) return null; const m = new THREE.Mesh(gb.build(), mat); m.castShadow = true; m.receiveShadow = false; parent.add(m); list.push(m); return m;
}

export function buildRig(L: Look): Rig {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const meshes: THREE.Mesh[] = [];
  const sk = col(L.skin), hr = col(L.hair), sh = col(L.outfit === 0 ? L.robe : L.shirt), pa = col(L.outfit === 0 ? L.robe : L.pants), shoe = col(L.shoes);
  const fat = L.fat, tw = 0.17 * fat; // torso half width
  const mk = (p: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D => { const o = new THREE.Object3D(); o.position.set(x, y, z); p.add(o); return o; };
  const hips = mk(body, 0, 0.94, 0), spine = mk(hips, 0, 0.1, 0), chest = mk(spine, 0, 0.24, 0), neck = mk(chest, 0, 0.26, 0), head = mk(neck, 0, 0.08, 0);
  // pelvis
  { const g = new GB(); g.geo(G.sph, T(0, 0, 0, tw * 0.95, 0.13, 0.12 * fat), pa); part(hips, g, MAT, meshes); }
  // torso (spine+chest) with belly for fat
  { const g = new GB();
    g.geo(G.sph, T(0, 0.04, 0.01 * fat, tw * 0.92, 0.16, 0.12 * fat), sh);
    g.geo(G.sph, T(0, 0.18, 0, tw * 1.05, 0.2, 0.125 * Math.sqrt(fat)), sh);
    if (fat > 1.1) g.geo(G.sph, T(0, 0.03, 0.06 * fat, tw * 0.85, 0.15, 0.12 * fat), sh);
    if (L.outfit === 2) { g.geo(G.box, T(0, 0.22, 0.12 * Math.sqrt(fat), 0.06, 0.18, 0.01), col("#f5f5f5")); g.geo(G.box, T(0, 0.2, 0.125 * Math.sqrt(fat), 0.025, 0.14, 0.01), col("#8b0000")); }
    if (L.outfit === 0) g.geo(G.box, T(0, 0.27, 0.118 * Math.sqrt(fat), 0.018, 0.12, 0.01), col(L.robe, 0.85));
    part(spine, g, MAT, meshes); }
  // neck + head
  { const g = new GB(); cap(g, 0, -0.06, 0.1, 0, 0.055, sk); part(neck, g, MAT, meshes); }
  { const g = new GB(), hs = 0.105;
    g.geo(G.sph, T(0, 0.11, 0, hs * 0.92, hs * 1.12, hs), sk); // skull
    g.geo(G.sph, T(0, 0.04, 0.02, hs * 0.78, hs * 0.75, hs * 0.85), sk); // jaw
    g.geo(G.cone, T(0, 0.095, hs * 0.98, 0.022, 0.06, 0.03, Math.PI / 2 - 0.25), col(L.skin, 0.95)); // nose
    for (const s of [-1, 1]) {
      g.geo(G.sph, T(s * 0.036, 0.125, hs * 0.86, 0.018, 0.012, 0.01), col("#ffffff"));
      g.geo(G.sph, T(s * 0.036, 0.125, hs * 0.9, 0.009, 0.009, 0.006), col("#2b1a0e"));
      g.geo(G.box, T(s * 0.038, 0.152, hs * 0.9, 0.034, 0.008, 0.01, 0, 0, s * -0.12), hr); // brows
      g.geo(G.sph, T(s * hs * 0.94, 0.1, 0, 0.018, 0.032, 0.014), col(L.skin, 0.92)); // ears
    }
    g.geo(G.box, T(0, 0.045, hs * 0.86, 0.04, 0.007, 0.01), col("#7a3b2e")); // mouth
    // hair
    if (L.shem === 0) {
      if (L.hairStyle === 1 || L.hairStyle === 3) g.geo(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), T(0, 0.13, -0.004, hs * 0.97, hs * 1.12, hs * 1.03, -0.15), hr);
      if (L.hairStyle === 2) g.geo(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), T(0, 0.12, 0, hs * 0.94, hs * 1.1, hs * 1.01, -0.1), col(L.hair, 1.0));
      if (L.hairStyle === 3) g.geo(G.sph, T(0, 0.08, -0.05, hs * 0.95, hs * 0.9, hs * 0.7), hr);
      if (L.hairStyle === 4) for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; g.geo(G.sph, T(Math.cos(a) * 0.06, 0.2 + (i % 2) * 0.015, Math.sin(a) * 0.06 - 0.01, 0.045, 0.04, 0.045), hr); }
    }
    // beard
    if (L.beard === 1) g.geo(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), T(0, 0.075, 0.012, hs * 0.82, hs * 0.85, hs * 0.92), hr);
    if (L.beard === 2) g.geo(G.sph, T(0, 0.0, hs * 0.72, 0.03, 0.035, 0.03), hr);
    if (L.beard === 2 || L.beard === 3) g.geo(G.box, T(0, 0.062, hs * 0.9, 0.06, 0.012, 0.014), hr);
    if (L.beard === 4) g.geo(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), T(0, 0.08, 0.005, hs * 0.8, hs * 0.8, hs * 0.88), col(L.skin, 0.7));
    if (L.shem > 0) g.geo(G.tor, T(0, 0.215, -0.005, hs * 0.92, hs * 0.92, hs * 0.6, Math.PI / 2), col("#111111")); // igal
    part(head, g, MAT, meshes);
    if (L.shem > 0) {
      const s2 = new GB(), wc = col(L.shem === 1 ? "#ffffff" : "#ffffff");
      s2.geo(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), T(0, 0.115, -0.01, hs * 1.08, hs * 1.22, hs * 1.12, -0.05), wc);
      // drape down the back and sides
      s2.geo(new THREE.CylinderGeometry(1, 1.35, 1, 16, 1, true, Math.PI * 0.35, Math.PI * 1.3), T(0, -0.05, -0.01, hs * 1.05, 0.3, hs * 1.08), wc);
      const m = new THREE.Mesh(s2.build(), L.shem === 1 && SHEM ? SHEM : MAT); m.castShadow = true; head.add(m); meshes.push(m);
      if (L.shem === 2) (m.geometry.getAttribute("color") as THREE.BufferAttribute).array.fill(0.97);
    }
  }
  // arms
  const shA: THREE.Object3D[] = [], elA: THREE.Object3D[] = [], hdA: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const shd = mk(chest, s * (tw + 0.04), 0.2, 0); shA.push(shd);
    { const g = new GB(); g.geo(G.sph, T(0, 0, 0, 0.065 * Math.sqrt(fat), 0.06, 0.065), sh); cap(g, 0, -0.29, 0.0, 0, 0.052 * Math.sqrt(fat), sh); part(shd, g, MAT, meshes); }
    const el = mk(shd, 0, -0.29, 0); elA.push(el);
    { const g = new GB(); cap(g, 0, -0.26, 0, 0, 0.044 * Math.sqrt(fat), L.outfit === 1 ? sk : sh); if (L.outfit !== 1) g.geo(G.cylC, T(0, -0.235, 0, 0.042, 0.03, 0.042), col(L.outfit === 0 ? L.robe : "#f5f5f5", 0.95)); part(el, g, MAT, meshes); }
    const hd = mk(el, 0, -0.27, 0); hdA.push(hd);
    { const g = new GB(); g.geo(G.sph, T(0, -0.045, 0.005, 0.036, 0.055, 0.025), sk); g.geo(G.sph, T(s * -0.03, -0.03, 0.02, 0.014, 0.03, 0.014, 0.3), sk); part(hd, g, MAT, meshes); }
  }
  // legs
  const thA: THREE.Object3D[] = [], knA: THREE.Object3D[] = [], ftA: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const th = mk(hips, s * 0.095 * fat, -0.02, 0); thA.push(th);
    { const g = new GB(); cap(g, 0, -0.45, 0.02, 0, 0.072 * Math.sqrt(fat), pa); part(th, g, MAT, meshes); }
    const kn = mk(th, 0, -0.45, 0); knA.push(kn);
    { const g = new GB(); cap(g, 0, -0.44, 0.02, 0, 0.055 * Math.sqrt(fat), L.outfit === 0 ? sk : pa); part(kn, g, MAT, meshes); }
    const ft = mk(kn, 0, -0.44, 0); ftA.push(ft);
    { const g = new GB(); g.geo(G.sph, T(0, -0.04, 0.05, 0.05, 0.04, 0.12), shoe); g.geo(G.box, T(0, -0.075, 0.05, 0.095, 0.015, 0.24), col(L.shoes, 0.6)); part(ft, g, MAT, meshes); }
  }
  // thobe robe skirt
  let robe: THREE.Object3D | null = null;
  if (L.outfit === 0) {
    robe = mk(hips, 0, 0.05, 0);
    const g = new GB(); g.geo(new THREE.CylinderGeometry(1, 1.25, 1, 18, 3, true), T(0, -0.46, 0, tw * 1.05, 0.92, 0.135 * fat), sh);
    g.geo(new THREE.CylinderGeometry(1, 1, 1, 18, 1, true), T(0, 0.02, 0, tw * 0.98, 0.1, 0.125 * fat), sh);
    const m = part(robe, g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }), meshes);
    if (m) m.castShadow = true;
  }
  body.scale.set(L.thin ? 0.92 : 1, L.tall, L.thin ? 0.92 : 1);
  // low LOD: merged rest pose
  root.updateMatrixWorld(true);
  const lg = new GB(), inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), tmp = new THREE.Matrix4();
  for (const m of meshes) { tmp.multiplyMatrices(inv, m.matrixWorld); const ca = m.geometry.getAttribute("color") as THREE.BufferAttribute; const c0 = new THREE.Color(ca.getX(0), ca.getY(0), ca.getZ(0)); const gsrc = m.geometry; lg.geo(gsrc, tmp, c0); }
  // re-copy actual vertex colors (lg.geo sets a single color; fix by copying arrays)
  { let off = 0; for (const m of meshes) { const ca = m.geometry.getAttribute("color") as THREE.BufferAttribute; const idx = m.geometry.index; const n = idx ? idx.count : ca.count; for (let k = 0; k < n; k++) { const vi = idx ? idx.getX(k) : k; lg.c[(off + k) * 3] = ca.getX(vi); lg.c[(off + k) * 3 + 1] = ca.getY(vi); lg.c[(off + k) * 3 + 2] = ca.getZ(vi); } off += n; } }
  const lo = new THREE.Mesh(lg.build(), MAT); lo.visible = false; lo.castShadow = false; root.add(lo);
  return { root, body, hips, spine, chest, neck, head, sh: shA, el: elA, hand: hdA, th: thA, kn: knA, ft: ftA, robe, meshes, lo, look: L, gun: null, gunId: 0, deadT: 0, t: Math.random() * 10, ext: null };
}

export type Pose = { ph: number; mv: number; spd: number; y: number; aim: number; aimP: number; punch: number; dead: number; sit: number; crouch: number; dt: number; lod: number };
// procedural animation: walk/run cycle, idle breathing, jump, aim, punch, dead
export function animate(R: Rig, P: Pose): void {
  const L = R.look; R.t += P.dt;
  if (R.ext) { animExt(R, P); return; }
  const near = P.lod === 0; const sitK = Math.min(1, P.sit);
  for (const m of R.meshes) m.visible = near; R.lo.visible = !near;
  if (!near) { R.body.position.y = P.dead > 0 ? 0 : 0; R.body.rotation.set(P.dead > 0 ? -Math.PI / 2 * Math.min(1, P.dead * 2) : 0, 0, 0); if (P.dead > 0) R.body.position.y = 0.12; return; }
  const run = Math.min(1, Math.max(0, (P.spd - 3) / 4)), mv = P.mv;
  const ph = P.ph * 0.5 * (1 / (0.85 + 0.15 * L.stride));
  const s = Math.sin(ph), c = Math.cos(ph);
  const stride = (0.45 + run * 0.35) * L.stride * mv, swing = (0.35 + run * 0.6) * L.swing * mv;
  const air = P.y > 0.05 ? 1 : 0;
  // legs
  for (let i = 0; i < 2; i++) {
    const sg = i === 0 ? 1 : -1, ls = s * sg;
    R.th[i].rotation.set(-ls * stride - air * 0.6 - sitK * 1.5 - P.crouch * 1.1, 0, 0);
    R.kn[i].rotation.set(Math.max(0, -Math.cos(ph + (sg > 0 ? 0 : Math.PI)) * 0.9 * stride + 0.1 * mv) + air * 1.1 + sitK * 1.5 + P.crouch * 2.0, 0, 0);
    R.ft[i].rotation.set(-0.1 * mv * ls - P.crouch * 0.9, 0, 0);
  }
  // hips bob & sway
  const bob = Math.abs(c) * 0.035 * L.bounce * mv * (1 + run);
  R.hips.position.y = 0.94 + bob - 0.03 * mv - sitK * 0.45 - P.crouch * 0.38;
  R.hips.rotation.set(0, s * 0.08 * mv, c * 0.03 * mv * L.bounce);
  R.spine.rotation.set(0.04 + L.lean + run * 0.18 + P.crouch * 0.3, -s * 0.1 * mv, 0);
  const br = Math.sin(R.t * 1.6) * 0.012 * (1 - mv);
  R.chest.scale.set(1 + br, 1 + br * 0.5, 1 + br * 1.5);
  R.chest.rotation.set(-run * 0.08, 0, 0);
  R.head.rotation.set(-0.04 - L.lean * 0.5, Math.sin(R.t * 0.35 + L.swing * 5) * 0.25 * (1 - mv), 0);
  // arms
  for (let i = 0; i < 2; i++) {
    const sg = i === 0 ? 1 : -1, ls = s * sg;
    let sx = ls * swing, sz = sg * -0.07, ex = -(0.15 + run * 0.9) * (0.5 + 0.5 * mv) - 0.08;
    if (P.aim > 0) {
      if (i === 1) { sx = -Math.PI / 2 - P.aimP; sz = 0.05; ex = 0; }
      else if (R.gunId >= 3) { sx = -Math.PI / 2 - P.aimP + 0.25; sz = 0.55; ex = -0.5; }
    }
    if (P.punch > 0 && i === 1) { const k = Math.sin(Math.min(1, P.punch / 0.4) * Math.PI); sx = -1.2 - k * 0.4; ex = -1.4 * (1 - k); }
    if (sitK > 0) { sx = -0.4; ex = -0.6; }
    R.sh[i].rotation.set(sx, 0, sz);
    R.el[i].rotation.set(ex, 0, 0);
  }
  if (R.robe) R.robe.rotation.set(-(R.th[0].rotation.x + R.th[1].rotation.x) * 0.25, 0, 0);
  // dead: fall backwards
  if (P.dead > 0) {
    const k = Math.min(1, P.dead * 2.2), e = k * k * (3 - 2 * k);
    R.body.rotation.set(-Math.PI / 2 * e, 0, 0); R.body.position.set(0, 0.14 * e, -0.2 * e);
    for (let i = 0; i < 2; i++) { R.sh[i].rotation.set(-2.4 * e, 0, (i === 0 ? 1 : -1) * -0.6 * e); R.el[i].rotation.set(-0.3 * e, 0, 0); R.th[i].rotation.set(0.1 * e, 0, (i === 0 ? 1 : -1) * 0.12 * e); R.kn[i].rotation.set(0.25 * e * (i + 1), 0, 0); }
    R.head.rotation.set(0.2 * e, 0.5 * e, 0);
  } else { R.body.rotation.set(0, 0, 0); R.body.position.set(0, 0, 0); }
}
function animExt(R: Rig, P: Pose): void {
  const X = R.ext as Ext;
  let want = "idle";
  if (P.dead > 0) want = X.act.death ? "death" : "idle";
  else if (P.sit > 0) want = X.act.drive && P.sit > 1 ? "drive" : X.act.sit ? "sit" : "idle";
  else if (P.punch > 0 && X.act.punch) want = "punch";
  else if (P.y > 0.1 && X.act.jump) want = "jump";
  else if (P.mv > 0.1) want = P.spd > 6.5 && X.act.sprint ? "sprint" : P.spd > 3.5 && X.act.run ? "run" : X.act.walk ? "walk" : "idle";
  else if (P.aim > 0 && X.act.aim) want = "aim";
  if (want !== X.cur && X.act[want]) { const a = X.act[want], b = X.act[X.cur]; a.reset(); if (want === "death" || want === "punch" || want === "jump") { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } a.play(); if (b) a.crossFadeFrom(b, 0.2, false); X.cur = want; }
  if (X.cur === "walk" && X.act.walk) X.act.walk.timeScale = Math.max(0.7, P.spd / 1.5);
  if (P.lod === 0 || (R.t * 20) % 3 < 1) X.mixer.update(P.lod === 0 ? P.dt : P.dt * 3);
}
export function disposeRig(R: Rig): void { for (const m of R.meshes) m.geometry.dispose(); R.lo.geometry.dispose(); R.root.removeFromParent(); }
