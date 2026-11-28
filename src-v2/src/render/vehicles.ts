import * as THREE from "three";
import { GB, col } from "./geo";
import type { Car } from "../logic";

export type CarMesh = { g: THREE.Group; wheels: THREE.Object3D[]; front: THREE.Object3D[]; paint: THREE.MeshPhysicalMaterial; tail: THREE.Mesh; bar: THREE.Mesh[]; spin: number; dead: boolean; ext: boolean; kind: number };
const glassM = new THREE.MeshStandardMaterial({ color: "#0e151c", roughness: 0.05, metalness: 0.9, envMapIntensity: 1.6 });
const trimM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 });
const wheelM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.5 });
export const headM = new THREE.MeshStandardMaterial({ color: "#fffbe8", emissive: new THREE.Color("#fff3c8"), emissiveIntensity: 0.6, roughness: 0.2 });
const tailOff = new THREE.MeshStandardMaterial({ color: "#6a0d0d", emissive: new THREE.Color("#ff1a1a"), emissiveIntensity: 0.25, roughness: 0.3 });
const tailOn = new THREE.MeshStandardMaterial({ color: "#a01010", emissive: new THREE.Color("#ff2020"), emissiveIntensity: 2.4, roughness: 0.3 });
const barR = new THREE.MeshStandardMaterial({ color: "#600", emissive: new THREE.Color("#ff1030"), emissiveIntensity: 0.2 });
const barB = new THREE.MeshStandardMaterial({ color: "#006", emissive: new THREE.Color("#2050ff"), emissiveIntensity: 0.2 });
const burnt = new THREE.MeshPhysicalMaterial({ color: "#1a1a1a", roughness: 0.95 });
const paints = new Map<string, THREE.MeshPhysicalMaterial>();
function paint(hex: string): THREE.MeshPhysicalMaterial { let m = paints.get(hex); if (!m) { m = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.32, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.08 }); paints.set(hex, m); } return m; }

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
function T(x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0): THREE.Matrix4 { return M.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz)); }
const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 18);
function prof(pts: number[][], w: number, bev: number): THREE.ExtrudeGeometry {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -(w - bev * 2) / 2); g.computeVertexNormals(); return g;
}
const geoCache = new Map<string, { body: THREE.BufferGeometry; cab: THREE.BufferGeometry; trim: THREE.BufferGeometry; wheel: THREE.BufferGeometry; wr: number; wx: number[]; head: THREE.BufferGeometry; tail: THREE.BufferGeometry; top: number }>();
function shapes(kind: number, L: number, W: number, H: number): { body: number[][]; cab: number[][]; wr: number; wx: number[]; top: number } {
  const l = L / 2, k = H / 1.4;
  if (kind === 1) return { body: [[-l, 0.3], [-l, 0.72], [-l + 0.3, 0.82], [-l * 0.3, 0.86], [l * 0.25, 0.78], [l - 0.2, 0.62], [l, 0.5], [l, 0.3]], cab: [[-l * 0.55, 0.84], [-l * 0.2, 1.12], [l * 0.05, 1.13], [l * 0.32, 0.77]], wr: 0.34, wx: [l * 0.62, -l * 0.62], top: 1.13 };
  if (kind === 6) return { body: [[-l, 0.45], [-l, 1.15], [l - 0.4, 1.12], [l, 0.95], [l, 0.45]], cab: [[-l + 0.15, 1.13], [-l + 0.25, 1.75], [l * 0.3, 1.75], [l * 0.55, 1.12]], wr: 0.42, wx: [l * 0.64, -l * 0.62], top: 1.78 };
  if (kind === 4) return { body: [[-l, 0.55], [-l, 1.05], [l, 1.05], [l, 0.55]], cab: [[l - 2.1, 1.05], [l - 2.1, 2.7], [l - 0.55, 2.7], [l - 0.1, 1.8], [l - 0.1, 1.05]], wr: 0.52, wx: [l * 0.72, -l * 0.45, -l * 0.72], top: 3.2 };
  if (kind === 5) return { body: [[-l, 0.45], [-l, 3.0], [-l + 0.2, 3.15], [l - 0.3, 3.15], [l, 2.9], [l, 0.45]], cab: [], wr: 0.52, wx: [l * 0.7, -l * 0.62], top: 3.15 };
  return { body: [[-l, 0.35 * k], [-l, 0.8 * k], [-l + 0.25, 0.95 * k], [-l * 0.42, 0.98 * k], [l * 0.22, 0.95 * k], [l - 0.18, 0.84 * k], [l, 0.7 * k], [l, 0.35 * k]], cab: [[-l * 0.44, 0.97 * k], [-l * 0.2, 1.38 * k], [l * 0.06, 1.4 * k], [l * 0.24, 0.95 * k]], wr: 0.36, wx: [l * 0.62, -l * 0.62], top: 1.4 * k };
}
function geos(c: Car): ReturnType<typeof geoCache.get> & object {
  const t = c.t, key = t.kind + ":" + t.l + ":" + t.w;
  const hit = geoCache.get(key); if (hit) return hit;
  const L = t.l, W = t.w, kind = t.kind, sp = shapes(kind, L, W, t.h);
  const body = prof(sp.body, W, 0.08);
  const cab = sp.cab.length ? prof(sp.cab, W * 0.86, 0.05) : new THREE.BufferGeometry();
  const tr = new GB(), l = L / 2;
  const dark = col("#141414"), chrome = col("#b8bcc2"), white = col("#f4f4f4");
  tr.geo(box, T(l + 0.02, 0.45, 0, 0.12, 0.22, W * 0.98), dark); tr.geo(box, T(-l - 0.02, 0.45, 0, 0.12, 0.22, W * 0.98), dark); // bumpers
  if (kind !== 5 && kind !== 4) { tr.geo(box, T(l + 0.01, 0.62, 0, 0.06, 0.18, W * 0.45), col("#0c0c0c")); }
  for (const s of [-1, 1]) if (kind !== 5) tr.geo(box, T(kind === 4 ? l - 0.6 : l * 0.22, kind === 4 ? 2.0 : sp.top * 0.72, s * (W / 2 + 0.08), 0.18, 0.1, 0.14), dark); // mirrors
  if (kind === 3) { for (const s of [-1, 1]) tr.geo(box, T(0, 0.62, s * (W / 2 + 0.005), L * 0.36, 0.32, 0.02), white); }
  if (kind === 2) tr.geo(box, T(-l * 0.05, sp.top + 0.13, 0, 0.5, 0.22, 0.9), col("#ffd54f"));
  if (kind === 1) tr.geo(box, T(-l + 0.15, 0.95, 0, 0.25, 0.05, W * 0.9), dark);
  if (kind === 5) { for (const s of [-1, 1]) tr.geo(box, T(0.1, 2.15, s * (W / 2 + 0.01), L * 0.92, 0.85, 0.02), col("#101820")); tr.geo(box, T(l + 0.01, 2.05, 0, 0.02, 1.1, W * 0.86), col("#101820")); tr.geo(box, T(0, 1.1, -W / 2 - 0.01, L * 0.95, 0.12, 0.02), white); }
  if (kind === 4) { tr.geo(box, T(-1.1, 1.75 + 0.05, 0, L - 2.3, 2.8, W + 0.05), col("#d9d9d9")); tr.geo(box, T(l - 0.08, 1.95, 0, 0.04, 0.7, W * 0.8), col("#101820")); }
  if (kind === 6) { tr.geo(box, T(-l * 0.1, sp.top + 0.06, 0, L * 0.5, 0.06, W * 0.8), chrome); for (const s of [-1, 1]) tr.geo(box, T(-l * 0.1, sp.top + 0.06, s * W * 0.38, L * 0.55, 0.06, 0.05), dark); tr.geo(cyl, T(-l - 0.12, 0.95, 0, 0.38, 0.22, 0.38, 0, 0, Math.PI / 2), dark); }
  // wheel: tire + rim + spokes
  const wg = new GB(), wr = sp.wr;
  wg.geo(new THREE.CylinderGeometry(1, 1, 1, 22), T(0, 0, 0, wr, 0.26, wr, Math.PI / 2), col("#121212"));
  wg.geo(new THREE.CylinderGeometry(1, 1, 1, 18), T(0, 0, 0.005, wr * 0.62, 0.27, wr * 0.62, Math.PI / 2), chrome);
  for (let i = 0; i < 5; i++) wg.geo(box, T(0, 0, 0.14, wr * 1.1, 0.07, 0.03, 0, 0, (i / 5) * Math.PI), col("#9aa0a6"));
  wg.geo(new THREE.CylinderGeometry(1, 1, 1, 10), T(0, 0, 0.15, wr * 0.18, 0.03, wr * 0.18, Math.PI / 2), col("#555"));
  const hy = kind === 5 ? 0.85 : kind === 4 ? 0.85 : 0.68 * (kind === 1 ? 0.85 : t.h / 1.4);
  const hg = new GB(), tg = new GB();
  for (const s of [-1, 1]) { hg.geo(box, T(l + 0.035, hy, s * W * 0.34, 0.08, kind === 1 ? 0.1 : 0.16, 0.34), col("#ffffff")); tg.geo(box, T(-l - 0.035, hy + 0.06, s * W * 0.36, 0.08, 0.16, 0.3), col("#ffffff")); }
  const r = { body, cab, trim: tr.build(), wheel: wg.build(), wr, wx: sp.wx, head: hg.build(), tail: tg.build(), top: sp.top };
  geoCache.set(key, r); return r;
}
export function buildCar(c: Car): CarMesh {
  const G = geos(c), g = new THREE.Group(), W = c.t.w;
  const hex = "#" + new THREE.Color(c.col[0], c.col[1], c.col[2]).getHexString();
  const pm = paint(c.t.kind === 3 ? "#0f1012" : hex);
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, sh = true): THREE.Mesh => { const x = new THREE.Mesh(geo, m); x.castShadow = sh; x.receiveShadow = true; g.add(x); return x; };
  add(G.body, pm); if (G.cab.getAttribute("position")) add(G.cab, glassM); add(G.trim, trimM); add(G.head, headM, false); const tail = add(G.tail, tailOff, false);
  if (c.t.kind !== 5 && c.t.kind !== 4) { const roof = new THREE.Mesh(box, pm); roof.scale.set(c.t.l * 0.26, 0.06, W * 0.8); roof.position.set(-c.t.l * 0.04, G.top - 0.01, 0); roof.castShadow = true; g.add(roof); }
  const bar: THREE.Mesh[] = [];
  if (c.t.kind === 3) { for (const s of [-1, 1]) { const b = new THREE.Mesh(box, s < 0 ? barR : barB); b.scale.set(0.3, 0.14, W * 0.36); b.position.set(-c.t.l * 0.04, G.top + 0.08, s * W * 0.19); g.add(b); bar.push(b); } }
  const wheels: THREE.Object3D[] = [], front: THREE.Object3D[] = [];
  G.wx.forEach((wx: number, i: number) => { for (const s of [-1, 1]) { const piv = new THREE.Object3D(); piv.position.set(wx, G.wr, s * (W / 2 - 0.12)); const w = new THREE.Mesh(G.wheel, wheelM); w.castShadow = true; if (s < 0) w.rotation.y = Math.PI; const spin = new THREE.Object3D(); spin.add(w); piv.add(spin); g.add(piv); wheels.push(spin); if (i === 0) front.push(piv); } });
  return { g, wheels, front, paint: pm, tail, bar, spin: 0, dead: false, ext: false, kind: c.t.kind };
}
export function updateCar(m: CarMesh, c: Car, t: number, dt: number, night: number): void {
  m.g.position.set(c.x, 0, c.z); m.g.rotation.set(0, -c.a, 0);
  const sp = (c.vx * Math.cos(c.a) + c.vz * Math.sin(c.a));
  m.spin -= sp * dt / 0.36;
  if (m.ext) { for (const w of m.wheels) w.rotation.x = m.spin; for (const f of m.front) f.rotation.y = -(c.steer || 0) * 0.45; }
  else { for (const w of m.wheels) w.rotation.z = m.spin; for (const f of m.front) f.rotation.y = -(c.steer || 0) * 0.45; }
  // body roll/pitch hint
  m.g.rotation.z = Math.max(-0.04, Math.min(0.04, -(c.steer || 0) * Math.min(1, Math.abs(sp) / 20) * 0.04));
  const dead = c.dead > 0;
  if (dead !== m.dead) { m.dead = dead; m.g.traverse((o: THREE.Object3D) => { const mm = o as THREE.Mesh; if (mm.isMesh && (mm.material === m.paint)) mm.material = burnt; }); }
  if (!m.ext) (m.tail as THREE.Mesh).material = dead ? burnt : c.brake ? tailOn : tailOff;
  if (m.bar.length) { const on = c.drv === 3, bl = Math.floor(t * 8) % 2 === 0; (m.bar[0].material as THREE.MeshStandardMaterial).emissiveIntensity = on ? (bl ? 4 : 0.2) : 0.2; (m.bar[1].material as THREE.MeshStandardMaterial).emissiveIntensity = on ? (bl ? 0.2 : 4) : 0.2; }
  void night;
}
export function setHeadlights(night: number): void { headM.emissiveIntensity = 0.5 + night * 3.5; tailOff.emissiveIntensity = 0.25 + night * 0.9; }
