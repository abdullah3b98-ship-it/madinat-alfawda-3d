// Syncs logic entities (peds, player, سلطان, cars, animals, pickups, particles) to three.js objects.
import * as THREE from "three";
import { Game, Ped, Car, Ani, seat, stars, bw, WP } from "../logic";
import { buildRig, animate, randomLook, disposeRig, Rig, Look } from "./human";
import { buildCar, updateCar, CarMesh } from "./vehicles";
import { findModel, findModels, cloneChar, cloneVehicle, hasSkin, lodOf } from "../assets";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

let seedN = 1;
function sr(seed: number): () => number { let s = seed >>> 0; return (): number => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hex3 = (c: number[]): string => "#" + new THREE.Color(c[0], c[1], c[2]).getHexString();

export const OUTFITS: { n: string; price: number; look: Partial<Look>; glb: string }[] = [
  { n: "Casual Tee & Jeans", price: 60, glb: "player", look: { outfit: 1, shirt: "#f5f5f5", pants: "#1f3a93", shem: 0 } },
  { n: "Leather Jacket", price: 220, glb: "player_outfit_leather", look: { outfit: 1, shirt: "#3b2618", pants: "#1c1c1c", shoes: "#111111", shem: 0 } },
  { n: "Tracksuit", price: 90, glb: "player_outfit_tracksuit", look: { outfit: 1, shirt: "#c62828", pants: "#c62828", shoes: "#f5f5f5", shem: 0 } },
  { n: "Summer Shorts", price: 70, glb: "player_outfit_summer", look: { outfit: 1, shirt: "#4fc3f7", pants: "#d7c49e", shoes: "#f5f5f5", shem: 0 } },
  { n: "Business Suit", price: 400, glb: "player_outfit_suit", look: { outfit: 2, shirt: "#2b2f38", pants: "#2b2f38", shoes: "#111111", shem: 0 } },
  { n: "Tactical Gear", price: 500, glb: "player_outfit_tactical", look: { outfit: 1, shirt: "#3d4436", pants: "#2e3329", shoes: "#1a1a1a", shem: 0 } },
];
export function playerLook(o: number): Look { return { ...randomLook(sr(42)), skin: "#e2b48f", hair: "#4a2f1c", beard: 0, fat: 1, tall: 1.02, thin: 0, stride: 1.05, bounce: 0.8, swing: 1, lean: 0, hero: 1, hairStyle: 1, shoes: "#1a1a1a", ...OUTFITS[o].look } as Look; }
export const SULTAN_LOOK: Look = { skin: "#c68642", hair: "#1b120c", hairStyle: 1, beard: 1, outfit: 2, robe: "#1b1f2a", shem: 0, shirt: "#1b1f2a", pants: "#1b1f2a", shoes: "#0d0d0d", fat: 1.12, tall: 1.04, thin: 0, stride: 0.95, bounce: 1.1, swing: 0.9, lean: 0.02, hero: 1 };

// --- weapon meshes (procedural; GLB used if present)
const gunMat = new THREE.MeshStandardMaterial({ color: "#222428", roughness: 0.4, metalness: 0.8 });
const woodMat = new THREE.MeshStandardMaterial({ color: "#7a4a22", roughness: 0.7 });
const oliveMat = new THREE.MeshStandardMaterial({ color: "#56603a", roughness: 0.6, metalness: 0.3 });
const boxG = new THREE.BoxGeometry(1, 1, 1), cylG = new THREE.CylinderGeometry(1, 1, 1, 10);
function gunModel(w: number): THREE.Object3D {
  const g = new THREE.Group();
  const ext = findModel(new RegExp("^(" + (["fist", "pistol|glock|handgun", "uzi|smg|mp5|pistol", "shotgun", "ak47|ak|rifle", "sniper", "rpg|rocket"][w] || "none") + ")"), /weapon/i);
  if (ext && w > 0) { const o = ext.scene.clone(true); const bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3()); const L = [0, 0.25, 0.35, 0.9, 0.9, 1.1, 1.0][w]; const s = L / Math.max(sz.x, sz.z, 0.01); o.scale.setScalar(s); if (sz.z > sz.x) o.rotation.y = Math.PI / 2; g.add(o); return g; }
  const P = (m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, rz = 0): void => { const b = new THREE.Mesh(boxG, m); b.position.set(x, y, z); b.scale.set(sx, sy, sz); b.rotation.z = rz; b.castShadow = true; g.add(b); };
  const C = (m: THREE.Material, x: number, y: number, z: number, r: number, l: number): void => { const b = new THREE.Mesh(cylG, m); b.position.set(x, y, z); b.scale.set(r, l, r); b.rotation.z = Math.PI / 2; g.add(b); };
  if (w === 1) { P(gunMat, 0.08, 0.03, 0, 0.2, 0.05, 0.035); P(gunMat, -0.01, -0.04, 0, 0.05, 0.11, 0.032, -0.25); }
  else if (w === 2) { P(gunMat, 0.06, 0.03, 0, 0.25, 0.07, 0.045); C(gunMat, 0.23, 0.035, 0, 0.012, 0.1); P(gunMat, 0.0, -0.08, 0, 0.035, 0.16, 0.03); }
  else if (w === 3) { C(gunMat, 0.4, 0.05, 0, 0.018, 0.7); P(woodMat, 0.34, 0.01, 0, 0.18, 0.05, 0.05); P(gunMat, 0.03, 0.03, 0, 0.18, 0.07, 0.045); P(woodMat, -0.22, 0.0, 0, 0.3, 0.07, 0.04, -0.1); }
  else if (w === 4) { P(gunMat, 0.03, 0.03, 0, 0.32, 0.07, 0.045); C(gunMat, 0.42, 0.045, 0, 0.012, 0.4); P(woodMat, 0.26, 0.03, 0, 0.18, 0.06, 0.05); P(gunMat, 0.08, -0.07, 0, 0.05, 0.13, 0.035, 0.35); P(woodMat, -0.22, 0.01, 0, 0.27, 0.07, 0.04, -0.08); }
  else if (w === 5) { C(gunMat, 0.5, 0.05, 0, 0.012, 0.6); P(oliveMat, 0.02, 0.04, 0, 0.42, 0.07, 0.05); C(gunMat, 0.08, 0.12, 0, 0.025, 0.26); P(oliveMat, -0.28, 0.02, 0, 0.28, 0.09, 0.04, -0.06); }
  else if (w === 6) { C(oliveMat, 0.1, 0.13, 0, 0.06, 0.95); C(oliveMat, 0.62, 0.13, 0, 0.09, 0.18); P(gunMat, 0.0, 0.03, 0, 0.04, 0.12, 0.04); }
  return g;
}
const GUN_BASIS_EXT = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
const GUN_BASIS = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)));
function setGun(R: Rig, w: number): void {
  if (R.gunId === w) return; if (R.gun) { R.gun.removeFromParent(); R.gun = null; } R.gunId = w;
  if (w > 0) { const g = gunModel(w); if (R.ext && R.ext.hand) { g.quaternion.copy(GUN_BASIS_EXT); g.position.set(0, 0.08, 0.02); const ws = new THREE.Vector3(); R.ext.hand.getWorldScale(ws); g.scale.setScalar(1 / Math.max(0.001, ws.x)); R.ext.hand.add(g); } else { g.quaternion.copy(GUN_BASIS); g.position.set(0, -0.07, 0.02); R.hand[1].add(g); } R.gun = g; }
}

// --- external character models
let NPC_EXT: GLTF[] | null = null;
const CHAR_DIR = /^(?!.*(anims|vehicles|weapons)\/)/;
function extFor(kind: "player" | "sultan" | "npc", outfit = 0): GLTF | null {
  if (kind !== "npc") {
    const want = kind === "player" ? (OUTFITS[outfit] ? OUTFITS[outfit].glb : "player") : "sultan";
    const m = findModel(new RegExp("^" + want + "$"), CHAR_DIR) || findModel(new RegExp(kind === "player" ? "^(player|hero|protagonist)$" : "^(sultan|buddy)$"), CHAR_DIR);
    return m && hasSkin(m) ? m : null;
  }
  if (!NPC_EXT) NPC_EXT = findModels(/^(npc|ped|citizen)/, CHAR_DIR).filter(hasSkin);
  return NPC_EXT.length ? NPC_EXT[Math.floor(Math.random() * NPC_EXT.length)] : null;
}
function attachExt(R: Rig, g: GLTF | null, h: number): void { if (!g) return; const c = cloneChar(g, h); R.body.visible = false; R.lo.visible = false; R.root.add(c.obj); R.ext = c; }

export class Actors {
  scene: THREE.Scene; peds = new Map<Ped, Rig>(); cars = new Map<Car, CarMesh>(); ans = new Map<Ani, THREE.Group>();
  player: Rig; sultan: Rig; pOutfit = 0; q = "medium";
  picks: THREE.InstancedMesh[]; parts: THREE.InstancedMesh; trc: THREE.InstancedMesh; flashL: THREE.PointLight; headL: THREE.SpotLight;
  sandAt: (x: number, z: number) => boolean;
  constructor(scene: THREE.Scene, outfit: number, sandAt: (x: number, z: number) => boolean) {
    this.scene = scene; this.sandAt = sandAt;
    this.player = buildRig(playerLook(outfit)); this.pOutfit = outfit; attachExt(this.player, extFor("player", outfit), 1.82); scene.add(this.player.root);
    this.sultan = buildRig(SULTAN_LOOK); attachExt(this.sultan, extFor("sultan"), 1.85); scene.add(this.sultan.root);
    const mk = (g: THREE.BufferGeometry, m: THREE.Material, n: number): THREE.InstancedMesh => { const im = new THREE.InstancedMesh(g, m, n); im.count = 0; im.frustumCulled = false; scene.add(im); return im; };
    this.picks = [mk(new THREE.BoxGeometry(0.9, 0.35, 0.35), new THREE.MeshStandardMaterial({ color: "#ffb300", emissive: new THREE.Color("#ff8f00"), emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.4 }), 120),
      mk(new THREE.BoxGeometry(0.6, 0.6, 0.25), new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: new THREE.Color("#ff1744"), emissiveIntensity: 0.5 }), 60),
      mk(new THREE.BoxGeometry(0.5, 0.3, 0.12), new THREE.MeshStandardMaterial({ color: "#2e7d32", emissive: new THREE.Color("#00e676"), emissiveIntensity: 0.6 }), 120)];
    this.parts = mk(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }), 300);
    this.trc = mk(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.4, 1.6) }), 80);
    this.flashL = new THREE.PointLight(0xffc060, 0, 12, 2); scene.add(this.flashL);
    this.headL = new THREE.SpotLight(0xfff2d0, 0, 60, 0.55, 0.5, 1.2); scene.add(this.headL, this.headL.target);
  }
  setOutfit(o: number): void { const keep = this.player.root.parent; disposeRig(this.player); this.player = buildRig(playerLook(o)); this.pOutfit = o; attachExt(this.player, extFor("player", o), 1.82); (keep || this.scene).add(this.player.root); }
  private place(R: Rig, x: number, y: number, z: number, a: number): void { R.root.position.set(x, y, z); R.root.rotation.y = Math.PI / 2 - a; }
  sync(g: Game, dt: number, cam: THREE.Vector3, night: number, menu: boolean): void {
    const vis = (x: number, z: number, r: number): boolean => Math.abs(x - cam.x) < r && Math.abs(z - cam.z) < r;
    const PR = this.q === "low" ? 65 : this.q === "medium" ? 100 : 150, CR = this.q === "low" ? 95 : this.q === "medium" ? 150 : 210;
    const lod = (x: number, z: number): number => (Math.hypot(x - cam.x, z - cam.z) < 42 ? 0 : 1);
    // peds
    const seen = new Set<Ped>();
    for (const e of g.peds) {
      seen.add(e); let R = this.peds.get(e);
      if (!vis(e.x, e.z, PR)) { if (R) R.root.visible = false; continue; }
      if (!R) { const L = randomLook(sr(seedN++ * 7919)); L.skin = hex3(e.sk); L.shirt = hex3(e.sh); L.pants = hex3(e.pa); L.hair = hex3(e.ha); R = buildRig(L); const base = extFor("npc"); const dd = Math.hypot(e.x - cam.x, e.z - cam.z); attachExt(R, base ? lodOf(base, this.q === "low" ? 2 : dd < 45 ? 0 : 1) : null, 1.75 * L.tall); this.scene.add(R.root); this.peds.set(e, R); }
      R.root.visible = true; this.place(R, e.x, 0.15, e.z, e.a);
      const sp = e.flee > 0 ? 4.5 : e.spd;
      animate(R, { ph: e.ph, mv: e.mv, spd: e.mv ? sp : 0, y: 0, aim: 0, aimP: 0, punch: 0, dead: e.dead, sit: 0, crouch: 0, dt, lod: lod(e.x, e.z) });
      const sh = this.q !== "low" && Math.hypot(e.x - cam.x, e.z - cam.z) < (this.q === "high" ? 50 : 30); if (R.ext) R.ext.obj.traverse((o: THREE.Object3D) => { (o as THREE.Mesh).castShadow = sh; }); else for (const m of R.meshes) m.castShadow = sh;
    }
    for (const [e, R] of this.peds) if (!seen.has(e)) { disposeRig(R); this.peds.delete(e); }
    // player
    const p = g.p, P = this.player;
    P.root.visible = !menu && !g.inside;
    if (P.root.visible) {
      if (p.car && p.dead <= 0) { const s = seat(p.car, -1); this.place(P, s.x, s.y + 0.32, s.z, p.car.a); setGun(P, 0); animate(P, { ph: 0, mv: 0, spd: 0, y: 0, aim: 0, aimP: 0, punch: 0, dead: 0, sit: 2, crouch: 0, dt, lod: 0 }); }
      else { this.place(P, p.x, p.y + 0.15, p.z, p.a); const aim = g.aiming || g.fireT > 0 ? 1 : 0; setGun(P, p.dead > 0 ? 0 : p.w); const run = g.keys.has("ShiftLeft") || g.keys.has("ShiftRight") || g.pad.l3; animate(P, { ph: p.ph, mv: p.mv, spd: p.mv ? (run ? 8.5 : 4.5) : 0, y: p.y, aim: aim && p.w > 0 ? 1 : 0, aimP: g.aimP, punch: p.punch, dead: p.dead > 0 ? Math.max(0, 4 - p.dead) : 0, sit: 0, crouch: 0, dt, lod: 0 }); }
    }
    // sultan
    const b = g.b, S = this.sultan;
    let show = true, sx = b.x, sz = b.z, sy = 0.15, sit = b.sit ? 1 : 0, sa = b.a;
    if (b.car) { const s = seat(b.car, -1); sx = s.x; sz = s.z; sy = s.y + 0.32; sit = 1; sa = b.car.a; }
    else if (b.ride) { if (!p.car) show = false; else { const s = seat(p.car, 1); sx = s.x; sz = s.z; sy = s.y + 0.32; sit = 1; sa = p.car.a; } }
    S.root.visible = show && vis(sx, sz, 170);
    if (S.root.visible) { this.place(S, sx, sy, sz, sa); const gun = b.dead > 0 || b.car || sit ? 0 : b.fireT > 0 || stars(g) > 0 ? bw(g) : 0; setGun(S, gun); animate(S, { ph: b.ph, mv: sit ? 0 : b.mv, spd: b.mv > 0.5 ? 5 : 2.5, y: 0, aim: b.fireT > 0 ? 1 : 0, aimP: b.aimP, punch: 0, dead: b.dead > 0 ? 1 : 0, sit, crouch: b.crouch ? 1 : 0, dt, lod: lod(sx, sz) }); }
    // cars
    const cseen = new Set<Car>();
    for (const c of g.cars) {
      cseen.add(c); let m = this.cars.get(c);
      if (!vis(c.x, c.z, CR)) { if (m) m.g.visible = false; continue; }
      if (!m) { m = this.mkCar(c); this.scene.add(m.g); this.cars.set(c, m); }
      m.g.visible = true; updateCar(m, c, g.t, dt, night);
    }
    for (const [c, m] of this.cars) if (!cseen.has(c)) { m.g.removeFromParent(); this.cars.delete(c); }
    // player car headlight at night
    if (p.car && night > 0.2 && !menu) { const c = p.car, ca = Math.cos(c.a), sa2 = Math.sin(c.a); this.headL.position.set(c.x + ca * c.t.l * 0.5, 0.9, c.z + sa2 * c.t.l * 0.5); this.headL.target.position.set(c.x + ca * 30, 0, c.z + sa2 * 30); this.headL.intensity = night * 60; } else this.headL.intensity = 0;
    // animals
    const aseen = new Set<Ani>();
    for (const a of g.ans) {
      aseen.add(a); let o = this.ans.get(a);
      if (!vis(a.x, a.z, PR)) { if (o) o.visible = false; continue; }
      if (!o) { o = mkAnimal(a, false); this.scene.add(o); this.ans.set(a, o); }
      o.visible = true; animAnimal(o, a, g.t);
    }
    for (const [a, o] of this.ans) if (!aseen.has(a)) { o.removeFromParent(); this.ans.delete(a); }
    // pickups
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
    const cnt = [0, 0, 0];
    for (const pk of g.picks) { if (pk.resp !== 0 || !vis(pk.x, pk.z, 150)) continue; const k = pk.k, im = this.picks[k]; if (cnt[k] >= im.instanceMatrix.count) continue; Q.setFromAxisAngle(V.set(0, 1, 0), g.t * 2 + pk.x); const s = pk.tmp ? 0.7 : 1; M4.compose(V.set(pk.x, 0.9 + Math.sin(g.t * 3 + pk.x) * 0.15, pk.z), Q, S1.set(s, s, s)); im.setMatrixAt(cnt[k]++, M4); }
    this.picks.forEach((im: THREE.InstancedMesh, i: number) => { im.count = cnt[i]; im.instanceMatrix.needsUpdate = true; });
    // particles
    let n = 0; const C = new THREE.Color();
    for (const q of g.parts) { if (n >= 300) break; const u = q.l / q.ml, s = q.em > 0 ? q.s * (0.4 + 0.6 * u) : q.s * (1 + (1 - u)); M4.compose(V.set(q.x, q.y, q.z), Q.identity(), S1.set(s, s, s)); this.parts.setMatrixAt(n, M4); const f = q.em > 0 ? 2.2 : 1; this.parts.setColorAt(n++, C.setRGB(q.c[0] * f, q.c[1] * f, q.c[2] * f)); }
    this.parts.count = n; this.parts.instanceMatrix.needsUpdate = true; if (this.parts.instanceColor) this.parts.instanceColor.needsUpdate = true;
    n = 0;
    for (const t of g.trc) { if (n >= 80) break; const dx = t.x2 - t.x1, dy = t.y2 - t.y1, dz = t.z2 - t.z1, len = Math.hypot(dx, dy, dz); Q.setFromUnitVectors(V.set(1, 0, 0), new THREE.Vector3(dx, dy, dz).normalize()); M4.compose(V.set((t.x1 + t.x2) / 2, (t.y1 + t.y2) / 2, (t.z1 + t.z2) / 2), Q, S1.set(len, 0.035, 0.035)); this.trc.setMatrixAt(n++, M4); }
    this.trc.count = n; this.trc.instanceMatrix.needsUpdate = true;
    // muzzle flash light
    if (g.fireT > 0.05 && !p.car && p.w > 0) { this.flashL.position.set(p.x + Math.cos(p.a) * 0.8, p.y + 1.45, p.z + Math.sin(p.a) * 0.8); this.flashL.intensity = 25 * Math.random(); } else this.flashL.intensity = 0;
    void WP;
  }
  private mkCar(c: Car): CarMesh {
    // US variants first; several bodies per type for variety (stable per car)
    const pool = (c as unknown as { personal?: boolean }).personal ? ["player_car", "landcruiser_suv"] : [["sedan", "van", "pickup_us", "sedan"], ["muscle_car", "sports_car"], ["taxi_yellow", "taxi"], ["police_car_us", "police_car"], ["truck", "fire_truck"], ["school_bus", "bus"], ["landcruiser_suv", "pickup_us", "suv"]][c.t.kind] || ["sedan"];
    const hsh = Math.abs(Math.floor(c.x * 7.13 + c.z * 3.71)) ;
    let ext: GLTF | null = null;
    if ((c as unknown as { personal?: boolean }).personal) { for (const n of pool) { ext = findModel(new RegExp("^" + n + "$"), /vehicles\//); if (ext) break; } }
    else { const found = pool.map((n: string) => findModel(new RegExp("^" + n + "$"), /vehicles\//)).filter((x: GLTF | null): x is GLTF => !!x); const uniq = c.t.kind === 0 || c.t.kind === 1 || c.t.kind === 4 || c.t.kind === 6 ? found : found.slice(0, 1); ext = uniq.length ? uniq[hsh % uniq.length] : null; }
    if (ext) return extCar(ext, c);
    return buildCar(c);
  }
}
const paintCache = new Map<string, THREE.Material>();
function extCar(ext: GLTF, c: Car): CarMesh {
  const v = cloneVehicle(ext, c.t.l * 1.0); const grp = new THREE.Group(); grp.add(v.obj);
  const hex = c.t.kind === 2 ? "#f5c518" : "#" + new THREE.Color(c.col[0], c.col[1], c.col[2]).getHexString();
  let paintM: THREE.MeshPhysicalMaterial | null = null; const tails: THREE.Mesh[] = []; const heads: THREE.Mesh[] = [];
  v.obj.traverse((o: THREE.Object3D) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mt: THREE.Material, i: number) => { const n = mt.name.toLowerCase();
      if (/paint|body/.test(n) && c.t.kind !== 3) { const key = n + hex; let pm = paintCache.get(key); if (!pm) { pm = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.3, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.08, name: mt.name }); paintCache.set(key, pm); } if (Array.isArray(m.material)) m.material[i] = pm; else m.material = pm; paintM = pm as THREE.MeshPhysicalMaterial; }
      else if (/tail/.test(n)) tails.push(m); else if (/head/.test(n)) heads.push(m); }); });
  for (const w of v.wheels) w.rotation.order = "YXZ";
  const tail = tails[0] || new THREE.Mesh();
  return { g: grp, wheels: v.wheels, front: v.front, paint: paintM || new THREE.MeshPhysicalMaterial(), tail, bar: [], spin: 0, dead: false, ext: true, kind: c.t.kind };
}

// --- animals: dog (k=0), bird (k=1); camel on sand
const amat = new Map<string, THREE.MeshStandardMaterial>();
function am(c: string): THREE.MeshStandardMaterial { let m = amat.get(c); if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }); amat.set(c, m); } return m; }
const sph = new THREE.SphereGeometry(1, 12, 8), cap = new THREE.CapsuleGeometry(1, 1, 3, 8);
function mkAnimal(a: Ani, sand: boolean): THREE.Group {
  const g = new THREE.Group(); const c = "#" + new THREE.Color(a.c[0], a.c[1], a.c[2]).getHexString();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, p?: THREE.Object3D): THREE.Mesh => { const k = new THREE.Mesh(geo, m); k.position.set(x, y, z); k.scale.set(sx, sy, sz); k.castShadow = true; (p || g).add(k); return k; };
  g.userData.k = a.k;
  if (a.k === 1) { add(sph, am(c), 0, 0.15, 0, 0.16, 0.1, 0.1); add(sph, am(c), 0.15, 0.22, 0, 0.07, 0.07, 0.07); add(new THREE.ConeGeometry(1, 1, 6), am("#ffb300"), 0.24, 0.22, 0, 0.025, 0.06, 0.025).rotation.z = -Math.PI / 2; const wl = new THREE.Object3D(), wr = new THREE.Object3D(); wl.position.set(0, 0.2, 0.05); wr.position.set(0, 0.2, -0.05); g.add(wl, wr); add(boxG, am(c), 0, 0, 0.17, 0.16, 0.015, 0.32, wl); add(boxG, am(c), 0, 0, -0.17, 0.16, 0.015, 0.32, wr); g.userData.w = [wl, wr]; return g; }
  const camel = sand; g.userData.camel = camel;
  const s = camel ? 2.1 : 1, col2 = camel ? "#c19a6b" : c;
  const legs: THREE.Object3D[] = [];
  add(cap, am(col2), 0, 0.55 * s, 0, 0.2 * s, 0.5 * s, 0.2 * s).rotation.z = Math.PI / 2;
  if (camel) add(sph, am(col2), -0.05 * s, 0.85 * s, 0, 0.25 * s, 0.2 * s, 0.2 * s);
  const neck = new THREE.Object3D(); neck.position.set(0.42 * s, 0.68 * s, 0); g.add(neck);
  add(cap, am(col2), camel ? 0.18 * s : 0.08, camel ? 0.25 * s : 0.08, 0, 0.08 * s, camel ? 0.3 * s : 0.1, 0.08 * s, neck).rotation.z = camel ? -0.6 : -0.9;
  add(sph, am(col2), camel ? 0.38 * s : 0.2, camel ? 0.5 * s : 0.16, 0, 0.14 * (camel ? s * 0.7 : 1), 0.11 * (camel ? s * 0.7 : 1), 0.11 * (camel ? s * 0.7 : 1), neck);
  if (!camel) { add(sph, am("#222"), 0.33, 0.14, 0, 0.04, 0.035, 0.04, neck); for (const z of [-0.06, 0.06]) add(sph, am(col2), 0.17, 0.27, z, 0.04, 0.07, 0.03, neck); }
  for (const lx of [0.32, -0.32]) for (const z of [-0.11, 0.11]) { const l = new THREE.Object3D(); l.position.set(lx * s, 0.45 * s, z * s); g.add(l); add(cap, am(camel ? "#b08a5c" : col2), 0, -0.22 * s, 0, 0.045 * s, 0.35 * s, 0.045 * s, l); legs.push(l); }
  const tail = new THREE.Object3D(); tail.position.set(-0.45 * s, 0.65 * s, 0); g.add(tail); add(cap, am(col2), -0.12, 0.05, 0, 0.03 * s, 0.2 * s, 0.03 * s, tail).rotation.z = 1.0;
  g.userData.legs = legs; g.userData.tail = tail; g.scale.setScalar(1);
  return g;
}
function animAnimal(o: THREE.Group, a: Ani, t: number): void {
  o.position.set(a.x, a.y + 0.15, a.z); o.rotation.set(0, -a.a, a.dead > 0 ? Math.PI / 2 : 0);
  if (a.k === 1) { const w = o.userData.w as THREE.Object3D[]; const f = a.st === 1 ? Math.sin(a.ph) * 0.9 : 0; w[0].rotation.x = f; w[1].rotation.x = -f; return; }
  const legs = o.userData.legs as THREE.Object3D[]; const sw = Math.sin(a.ph) * 0.5 * a.mv;
  legs.forEach((l: THREE.Object3D, i: number) => { l.rotation.z = (i === 0 || i === 3 ? 1 : -1) * sw; });
  (o.userData.tail as THREE.Object3D).rotation.y = Math.sin(t * 12 + a.ph) * 0.6;
}
export function disposeAll(A: Actors): void { for (const [, R] of A.peds) disposeRig(R); A.peds.clear(); }
