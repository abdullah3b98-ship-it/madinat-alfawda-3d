import * as THREE from "three";
import { NB, BS, RW, WORLD, rng } from "../logic";
import { WorldData, Bld, ST_OFFICE, ST_GLASS, ST_VILLA, ST_APART, ST_SHOP, ST_HOSP, ST_HOTEL } from "../world";
import { GB, col } from "./geo";
import { Tex, makeSignAtlas } from "./tex";

export type City = { root: THREE.Group; chunks: { m: THREE.Object3D; cx: number; cz: number; detail: boolean }[]; mats: Record<string, THREE.MeshStandardMaterial>; lampPos: THREE.Vector3[]; foliage: THREE.MeshStandardMaterial[]; wind: { value: number }; time: { value: number }; water: THREE.MeshStandardMaterial; spray: THREE.Points; update: (cam: THREE.Vector3, night: number, wet: number, t: number) => void };

const CELL: Record<number, [number, number]> = { [ST_OFFICE]: [3.6, 3.4], [ST_GLASS]: [3.0, 3.4], [ST_VILLA]: [4.0, 3.4], [ST_APART]: [3.6, 3.4], [ST_SHOP]: [3.6, 3.4], [ST_HOSP]: [3.6, 3.4], [ST_HOTEL]: [3.0, 3.4] };
const BUCK: Record<number, string> = { [ST_OFFICE]: "office", [ST_GLASS]: "glass", [ST_VILLA]: "villa", [ST_APART]: "apart", [ST_SHOP]: "apart", [ST_HOSP]: "office", [ST_HOTEL]: "glass" };

function rep(t: THREE.Texture, n: number): THREE.Texture { const c = t.clone(); c.repeat.set(n, n); c.needsUpdate = true; return c; }

export function buildCity(W: WorldData, T: Tex, font: string): City {
  const root = new THREE.Group();
  const r = rng(1234);
  const M = (o: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial(o);
  const litCol = new THREE.Color("#ffd9a0");
  const mats: Record<string, THREE.MeshStandardMaterial> = {
    office: M({ map: rep(T.office, 0.25), emissiveMap: rep(T.lit, 1 / 16), emissive: litCol, emissiveIntensity: 0, vertexColors: true, roughness: 0.7, metalness: 0.05 }),
    glass: M({ map: rep(T.glass, 0.25), emissiveMap: rep(T.lit, 1 / 16), emissive: litCol, emissiveIntensity: 0, vertexColors: true, roughness: 0.12, metalness: 0.75, envMapIntensity: 1.3 }),
    villa: M({ map: rep(T.villa, 0.25), emissiveMap: rep(T.lit, 1 / 16), emissive: litCol, emissiveIntensity: 0, vertexColors: true, roughness: 0.85 }),
    apart: M({ map: rep(T.apart, 0.25), emissiveMap: rep(T.lit, 1 / 16), emissive: litCol, emissiveIntensity: 0, vertexColors: true, roughness: 0.8 }),
    roof: M({ map: T.roof, vertexColors: true, roughness: 0.95 }),
    wall: M({ map: T.plaster, vertexColors: true, roughness: 0.9 }),
    detail: M({ vertexColors: true, roughness: 0.7, metalness: 0.15 }),
    metal: M({ vertexColors: true, roughness: 0.35, metalness: 0.8 }),
    store: M({ color: "#26333d", emissive: new THREE.Color("#ffe6b8"), emissiveIntensity: 0.15, roughness: 0.08, metalness: 0.6 }),
    asphalt: M({ map: T.asphalt, color: "#ffffff", roughness: 0.92 }),
    sidewalk: M({ map: T.sidewalk, roughness: 0.9 }),
    grass: M({ map: T.grass, roughness: 1 }),
    sand: M({ map: T.sand, roughness: 1 }),
    plaza: M({ map: T.plaza, roughness: 0.85 }),
    lamp: M({ color: "#fff4d6", emissive: new THREE.Color("#ffd27a"), emissiveIntensity: 0.1, roughness: 0.4 }),
    pole: M({ color: "#3d4650", roughness: 0.5, metalness: 0.7 }),
  };
  T.asphalt.repeat.set(1 / 9, 1 / 9); T.sidewalk.repeat.set(1 / 3, 1 / 3); T.grass.repeat.set(1 / 6, 1 / 6); T.sand.repeat.set(1 / 10, 1 / 10); T.plaza.repeat.set(1 / 4, 1 / 4); T.roof.repeat.set(1 / 6, 1 / 6); T.plaster.repeat.set(1 / 3, 1 / 3);
  // --- signs
  const signNames = Array.from(new Set(W.blds.filter((b: Bld) => b.sign).map((b: Bld) => b.sign)));
  const SA = makeSignAtlas(signNames, font);
  mats.sign = M({ map: SA.tex, emissiveMap: SA.tex, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.15, roughness: 0.5 });

  // --- chunked buckets
  const CH = BS * 2, nC = Math.ceil(WORLD / CH);
  const buckets = new Map<string, GB>();
  const bk = (x: number, z: number, name: string): GB => { const cx = Math.min(nC - 1, Math.max(0, Math.floor(x / CH))), cz = Math.min(nC - 1, Math.max(0, Math.floor(z / CH))); const key = cx + "," + cz + "," + name; let b = buckets.get(key); if (!b) { b = new GB(); buckets.set(key, b); } return b; };
  const signGB = new GB();
  const cylG = new THREE.CylinderGeometry(1, 1, 1, 12), sphG = new THREE.SphereGeometry(1, 12, 8), boxG = new THREE.BoxGeometry(1, 1, 1);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  const tm = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0): THREE.Matrix4 => m4.compose(v1.set(x, y, z), q.setFromEuler(e3.set(0, ry, 0)), v2.set(sx, sy, sz));

  for (const b of W.blds) {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, name = BUCK[b.st], [cw, ch] = CELL[b.st];
    const c = col(b.col), uo = Math.floor(b.seed % 16), vo = Math.floor((b.seed * 7) % 16);
    const g = bk(cx, cz, name), roof = bk(cx, cz, "roof"), det = bk(cx, cz, "detail"), roofCol = col(b.col, 0.75);
    const base = b.st === ST_SHOP ? 4.2 : 0;
    if (b.st === ST_SHOP) {
      // storefront glass ground floor + sign band
      const sb = bk(cx, cz, "store"); sb.box(b.x0 + 0.15, 0.15, b.z0 + 0.15, b.x1 - 0.15, 3.4, b.z1 - 0.15, col("#ffffff"), 4, 4, 0, 0, false, false);
      g.box(b.x0, 3.4, b.z0, b.x1, 4.2, b.z1, col(b.col, 0.85), cw, ch, 0, 0, false, false);
      const fz = b.face === 3 ? b.z0 - 0.06 : b.z1 + 0.06, row = SA.idx[b.sign] ?? 0, v0 = 1 - (row + 1) / SA.rows, v1s = 1 - row / SA.rows;
      const w = Math.min(8, b.x1 - b.x0 - 1), sx0 = cx - w / 2, sx1 = cx + w / 2;
      if (b.face === 3) signGB.quad([sx1, 3.45, fz], [sx0, 3.45, fz], [sx0, 4.15, fz], [sx1, 4.15, fz], 0, 0, -1, [0, 1, v0, v1s], col("#ffffff"));
      else signGB.quad([sx0, 3.45, fz], [sx1, 3.45, fz], [sx1, 4.15, fz], [sx0, 4.15, fz], 0, 0, 1, [0, 1, v0, v1s], col("#ffffff"));
      // awning
      det.box(sx0 - 0.5, 3.2, b.face === 3 ? b.z0 - 1.4 : b.z1, sx1 + 0.5, 3.35, b.face === 3 ? b.z0 : b.z1 + 1.4, col(["#b71c1c", "#1b5e20", "#0d47a1", "#4e342e"][Math.floor(b.seed) % 4]), 1, 1, 0, 0, true, true);
    }
    if (b.shape === 1) {
      const rad = Math.min(b.x1 - b.x0, b.z1 - b.z0) / 2;
      g.cyl(cx, cz, rad, base, b.h, 20, c, cw, ch, uo, vo, false); roof.cyl(cx, cz, rad, b.h - 0.01, b.h, 20, roofCol, 6, 6, 0, 0, true);
      det.cyl(cx, cz, rad * 0.25, b.h, b.h + 8, 8, col("#9aa0a6"), 1, 1, 0, 0, true);
    } else if (b.shape === 2) {
      const mx = cx + (b.x1 - b.x0) * 0.1, h2 = b.h * 0.62;
      g.box(b.x0, base, b.z0, mx, b.h, b.z1, c, cw, ch, uo, vo, false, false); roof.top(b.x0, b.h, b.z0, mx, b.z1, roofCol, 6);
      g.box(mx, base, b.z0, b.x1, h2, cz, c, cw, ch, uo, vo, false, false); roof.top(mx, h2, b.z0, b.x1, cz, roofCol, 6);
      g.box(mx, base, cz, b.x1, h2 * 0.5, b.z1, c, cw, ch, uo, vo, false, false); roof.top(mx, h2 * 0.5, cz, b.x1, b.z1, roofCol, 6);
    } else {
      const tiers = b.tiers.length ? b.tiers : [{ i: 0, h: b.h }];
      let y = base;
      for (let ti = 0; ti < tiers.length; ti++) {
        const t = tiers[ti], x0 = b.x0 + t.i, x1 = b.x1 - t.i, z0 = b.z0 + t.i, z1 = b.z1 - t.i, y1 = ti === tiers.length - 1 ? b.h : y + t.h;
        if (x1 - x0 < 2 || z1 - z0 < 2) break;
        const fc = b.st === ST_HOSP && ti === 0 ? col("#e8eef0") : c;
        g.box(x0, y, z0, x1, y1, z1, fc, cw, ch, uo, vo, false, false);
        roof.top(x0, y1, z0, x1, z1, roofCol, 6);
        // parapet / ledge
        det.box(x0 - 0.15, y1, z0 - 0.15, x1 + 0.15, y1 + (b.st === ST_VILLA ? 0.7 : 0.45), z0 + 0.15, col(b.col, 0.8), 1, 1, 0, 0, true, false);
        det.box(x0 - 0.15, y1, z1 - 0.15, x1 + 0.15, y1 + (b.st === ST_VILLA ? 0.7 : 0.45), z1 + 0.15, col(b.col, 0.8), 1, 1, 0, 0, true, false);
        det.box(x0 - 0.15, y1, z0, x0 + 0.15, y1 + (b.st === ST_VILLA ? 0.7 : 0.45), z1, col(b.col, 0.8), 1, 1, 0, 0, true, false);
        det.box(x1 - 0.15, y1, z0, x1 + 0.15, y1 + (b.st === ST_VILLA ? 0.7 : 0.45), z1, col(b.col, 0.8), 1, 1, 0, 0, true, false);
        y = y1;
      }
      // roof clutter
      const tx0 = b.x0 + (b.tiers.length ? b.tiers[b.tiers.length - 1].i : 0), tx1 = b.x1 - (b.tiers.length ? b.tiers[b.tiers.length - 1].i : 0);
      if (b.st === ST_VILLA) { det.geo(cylG, tm(tx0 + 1.2, b.h + 0.6, b.z0 + 1.4, 0.6, 1.2, 0.6), col("#e0e0e0")); }
      else if (b.st === ST_HOSP) { det.geo(cylG, tm(cx, b.h + 0.05, cz, 4, 0.1, 4), col("#455a64")); det.box(cx - 0.4, b.h + 0.1, cz - 2, cx + 0.4, b.h + 0.13, cz + 2, col("#ffffff"), 1, 1, 0, 0, true, false); det.box(cx - 1.5, b.h + 0.1, cz - 0.3, cx + 1.5, b.h + 0.13, cz + 0.3, col("#ffffff"), 1, 1, 0, 0, true, false); }
      else { for (let k = 0; k < 3; k++) if (r() < 0.7) { const ax = tx0 + 1.5 + r() * Math.max(0.5, tx1 - tx0 - 3), az = cz + (r() - 0.5) * (b.z1 - b.z0) * 0.5; det.box(ax - 1, b.h, az - 0.8, ax + 1, b.h + 1.2, az + 0.8, col("#9ea4aa"), 1, 1, 0, 0, true, false); }
        if (b.h > 60 && r() < 0.6) det.geo(cylG, tm(cx, b.h + 6, cz, 0.15, 12, 0.15), col("#c0c4c8")); }
    }
    if (b.bal && b.st !== ST_VILLA) {
      // balconies on the face side
      const fz = b.face === 3 ? b.z0 : b.z1, dz = b.face === 3 ? -1.1 : 1.1;
      for (let y = base + 3.4; y < b.h - 1; y += 3.4) for (let x = b.x0 + 1.2; x < b.x1 - 2.4; x += 3.6 * 2) {
        det.box(x, y - 0.1, Math.min(fz, fz + dz), x + 2.6, y + 0.05, Math.max(fz, fz + dz), col("#cfcac0"), 1, 1, 0, 0, true, true);
        det.box(x, y + 0.05, b.face === 3 ? fz + dz : fz + dz - 0.05, x + 2.6, y + 1.0, b.face === 3 ? fz + dz + 0.05 : fz + dz, col("#5f6b73"), 1, 1, 0, 0, false, false);
      }
    }
    if (b.st === ST_VILLA && b.bal) { const fz = b.face === 3 ? b.z0 : b.z1, dz = b.face === 3 ? -2 : 2; det.box(cx - 3, b.h * 0.5 - 0.15, Math.min(fz, fz + dz), cx + 3, b.h * 0.5 + 0.1, Math.max(fz, fz + dz), col("#ffffff"), 1, 1, 0, 0, true, true); for (const sx of [-2.8, 2.8]) det.geo(cylG, tm(cx + sx, b.h * 0.25, fz + dz * 0.9, 0.2, b.h * 0.5, 0.2), col("#ffffff")); }
    if (b.sign && b.st !== ST_SHOP) {
      // big sign on face
      const fz = b.face === 3 ? b.z0 - 0.1 : b.z1 + 0.1, row = SA.idx[b.sign] ?? 0, v0 = 1 - (row + 1) / SA.rows, v1s = 1 - row / SA.rows;
      const ti = b.tiers.length ? b.tiers[0] : { i: 0, h: b.h }, sy = Math.min(b.h, ti.h || b.h) - 1, w = 10, sx0 = cx - w / 2, sx1 = cx + w / 2;
      signGB.quad([sx1, sy - 2.5, fz], [sx0, sy - 2.5, fz], [sx0, sy, fz], [sx1, sy, fz], 0, 0, -1, [0, 1, v0, v1s], col("#ffffff"));
    }
  }
  for (const w of W.walls) {
    const g = bk((w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2, "wall");
    g.box(w.x0, 0.15, w.z0, w.x1, w.h, w.z1, col(w.col), 3, 3, 0, 0, true, false);
    bk((w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2, "detail").box(w.x0 - 0.06, w.h, w.z0 - 0.06, w.x1 + 0.06, w.h + 0.12, w.z1 + 0.06, col(w.col, 0.8), 1, 1, 0, 0, true, false);
  }
  // props (static, merged)
  for (const p of W.props) {
    const det = bk(p.x, p.z, "detail"), met = bk(p.x, p.z, "metal");
    if (p.k === "gate") {
      for (const s of [-1, 1]) det.box(p.x + s * p.s / 2 - 0.35, 0, p.z - 0.35, p.x + s * p.s / 2 + 0.35, p.h + 0.5, p.z + 0.35, col(p.col, 0.9), 1, 1, 0, 0, true, false);
      for (const s of [-1, 1]) met.box(p.x + s * p.s / 2 - (s > 0 ? 0.12 : -0.05), 0.1, p.z + 0.2, p.x + s * p.s / 2 + (s > 0 ? -0.05 : 0.12), p.h - 0.2, p.z + p.s / 2 - 0.1, col("#2b2b2b"), 1, 1, 0, 0, true, false);
    } else if (p.k === "door") { det.box(p.x - p.w / 2, 0.15, p.z - 0.08, p.x + p.w / 2, p.h, p.z + 0.08, col("#5d3a1a"), 1, 1, 0, 0, true, false); }
    else if (p.k === "bench") {
      const ca = Math.round(p.a / (Math.PI / 2)) % 2 !== 0;
      const bx = ca ? 0.25 : 0.9, bz = ca ? 0.9 : 0.25;
      det.box(p.x - bx, 0.45, p.z - bz, p.x + bx, 0.52, p.z + bz, col("#8d6e63"), 1, 1, 0, 0, true, true);
      if (ca) det.box(p.x + 0.2, 0.52, p.z - bz, p.x + 0.27, 1.0, p.z + bz, col("#8d6e63"), 1, 1, 0, 0, true, false);
      else det.box(p.x - bx, 0.52, p.z + 0.2, p.x + bx, 1.0, p.z + 0.27, col("#8d6e63"), 1, 1, 0, 0, true, false);
      met.box(p.x - bx + 0.1, 0.15, p.z - bz + 0.05, p.x - bx + 0.18, 0.45, p.z + bz - 0.05, col("#333333"), 1, 1, 0, 0, false, false);
      met.box(p.x + bx - 0.18, 0.15, p.z - bz + 0.05, p.x + bx - 0.1, 0.45, p.z + bz - 0.05, col("#333333"), 1, 1, 0, 0, false, false);
    } else if (p.k === "canopy") {
      det.box(p.x - p.w / 2, p.h, p.z - p.d / 2, p.x + p.w / 2, p.h + 0.4, p.z + p.d / 2, col("#f5f5f5"), 1, 1, 0, 0, true, true);
      det.box(p.x - p.w / 2, p.h + 0.4, p.z - p.d / 2, p.x + p.w / 2, p.h + 0.9, p.z - p.d / 2 + 0.1, col(p.col), 1, 1, 0, 0, true, false);
      for (const s of [-1, 1]) det.geo(cylG, tm(p.x + s * (p.w / 2 - 0.4), p.h / 2, p.z - p.d / 2 + 0.4, 0.15, p.h, 0.15), col("#cfd8dc"));
    } else if (p.k === "carport") {
      met.box(p.x - p.w / 2, p.h, p.z - p.d / 2, p.x + p.w / 2, p.h + 0.12, p.z + p.d / 2, col("#e0e0e0"), 1, 1, 0, 0, true, true);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) met.geo(cylG, tm(p.x + sx * (p.w / 2 - 0.2), p.h / 2, p.z + sz * (p.d / 2 - 0.2), 0.08, p.h, 0.08), col("#9e9e9e"));
    } else if (p.k === "pool") {
      det.box(p.x - p.w / 2 - 0.5, 0.15, p.z - p.d / 2 - 0.5, p.x + p.w / 2 + 0.5, 0.3, p.z + p.d / 2 + 0.5, col("#f0f0f0"), 1, 1, 0, 0, true, false);
    } else if (p.k === "path") {
      const ca = Math.abs(Math.sin(p.a)) > 0.5, hx = ca ? p.d / 2 : p.w / 2, hz = ca ? p.w / 2 : p.d / 2;
      bk(p.x, p.z, "plazaG").top(p.x - hx, 0.165, p.z - hz, p.x + hx, p.z + hz, col("#ffffff"), 1);
    } else if (p.k === "fountain") {
      det.geo(cylG, tm(p.x, 0.5, p.z, 4.5, 0.8, 4.5), col("#bdb7ab")); det.geo(cylG, tm(p.x, 1.3, p.z, 0.6, 2.2, 0.6), col("#c8c2b6")); det.geo(cylG, tm(p.x, 2.3, p.z, 1.6, 0.25, 1.6), col("#c8c2b6"));
    }
  }
  // ground: blocks
  for (let i = 0; i < W.B.length; i++) {
    const b = W.B[i], gk = W.grounds[i].k;
    const sw = bk(b.x + b.s / 2, b.z + b.s / 2, "sidewalk");
    sw.box(b.x, 0, b.z, b.x + b.s, 0.15, b.z + b.s, col("#ffffff"), 1, 1, 0, 0, true, false);
    const gname = gk === 1 || gk === 4 ? "grassG" : gk === 3 ? "sandG" : gk === 2 ? "plazaG" : "sidewalk";
    if (gname !== "sidewalk") bk(b.x + b.s / 2, b.z + b.s / 2, gname).top(b.x + 3, 0.16, b.z + 3, b.x + b.s - 3, b.z + b.s - 3, col("#ffffff"), 1);
  }
  const matFor: Record<string, THREE.Material> = { ...mats, grassG: mats.grass, sandG: mats.sand, plazaG: mats.plaza };
  const chunks: City["chunks"] = [];
  for (const [key, g] of buckets) {
    if (g.empty) continue;
    const [cx, cz, name] = key.split(",");
    const mesh = new THREE.Mesh(g.build(), matFor[name]);
    const flat = name === "sidewalk" || name === "grassG" || name === "sandG" || name === "plazaG";
    mesh.castShadow = !flat; mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false; root.add(mesh);
    chunks.push({ m: mesh, cx: (+cx + 0.5) * CH, cz: (+cz + 0.5) * CH, detail: name === "detail" || name === "metal" });
  }
  if (!signGB.empty) { const sm = new THREE.Mesh(signGB.build(), mats.sign); root.add(sm); }
  // road surface + outer desert
  const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), mats.asphalt); road.rotation.x = -Math.PI / 2; road.position.set(WORLD / 2, 0, WORLD / 2); road.receiveShadow = true; root.add(road);
  const uvs = road.geometry.getAttribute("uv") as THREE.BufferAttribute; for (let k = 0; k < uvs.count; k++) uvs.setXY(k, uvs.getX(k) * WORLD, uvs.getY(k) * WORLD); uvs.needsUpdate = true;
  const desertMat = M({ map: T.grass.clone(), color: "#b9b48a", roughness: 1 }); desertMat.map!.repeat.set(1 / 8, 1 / 8); desertMat.map!.needsUpdate = true; // outskirts
  const ds = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), desertMat); ds.rotation.x = -Math.PI / 2; ds.position.set(WORLD / 2, -0.02, WORLD / 2); ds.receiveShadow = true;
  const du = ds.geometry.getAttribute("uv") as THREE.BufferAttribute; for (let k = 0; k < du.count; k++) du.setXY(k, du.getX(k) * 4000, du.getY(k) * 4000); du.needsUpdate = true; root.add(ds);
  // ocean beyond the beach (east and south edges) + a strip of wet sand
  { const om = new THREE.MeshStandardMaterial({ color: "#1f5878", roughness: 0.06, metalness: 0.15, envMapIntensity: 1.2 });
    const o1 = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), om); o1.rotation.x = -Math.PI / 2; o1.position.set(WORLD + 60 + 1500, 0.02, WORLD / 2); root.add(o1);
    const o2 = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), om); o2.rotation.x = -Math.PI / 2; o2.position.set(WORLD / 2 - 1500 + WORLD / 2 + 60, 0.019, WORLD + 60 + 1500); root.add(o2);
    const sm = M({ map: T.sand.clone(), color: "#e8d8b0", roughness: 0.95 }); sm.map!.repeat.set(1 / 6, 1 / 6); sm.map!.needsUpdate = true;
    for (const [x, z, w, d] of [[WORLD + 30, WORLD / 2 + 30, 60, WORLD + 60], [WORLD / 2 + 30, WORLD + 30, WORLD + 60, 60]]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(w, d), sm); b.rotation.x = -Math.PI / 2; b.position.set(x, 0.005, z); b.receiveShadow = true; const bu = b.geometry.getAttribute("uv") as THREE.BufferAttribute; for (let k = 0; k < bu.count; k++) bu.setXY(k, bu.getX(k) * w, bu.getY(k) * d); root.add(b); }
    (root.userData as { ocean?: THREE.MeshStandardMaterial }).ocean = om; }
  // distant hills (west / north only; the ocean is east / south)
  { const g = new GB(), rr = rng(55); for (let i = 0; i < 70; i++) { const a = Math.PI + rr() * Math.PI * 0.5 + (rr() < 0.5 ? -0.3 : 0.3), d = WORLD * 0.75 + 80 + rr() * 600, x = WORLD / 2 + Math.cos(a) * d, z = WORLD / 2 + Math.sin(a) * d; const s = 30 + rr() * 90; g.geo(sphG, tm(x, -s * 0.25, z, s * 1.6, s * (0.25 + rr() * 0.3), s), col(rr() < 0.3 ? "#5f6e4a" : "#7b8a5c")); }
    const dm = new THREE.Mesh(g.build(), M({ vertexColors: true, roughness: 1 })); root.add(dm); }

  // road markings (instanced)
  {
    const dash: THREE.Matrix4[] = [], zebra: THREE.Matrix4[] = [], edge: THREE.Matrix4[] = [];
    for (let i = 0; i <= NB; i++) for (let j = 0; j <= NB; j++) {
      const ox = i * BS, oz = j * BS, c = RW / 2;
      if (i < NB) for (let s = ox + RW + 4; s < ox + BS - 4; s += 5) dash.push(tm(s + 1.25, 0.012, oz + c, 2.5, 1, 0.18).clone());
      if (j < NB) for (let s = oz + RW + 4; s < oz + BS - 4; s += 5) dash.push(tm(ox + c, 0.012, s + 1.25, 0.18, 1, 2.5).clone());
      if (i < NB) { edge.push(tm(ox + RW + (BS - RW) / 2, 0.011, oz + 0.6, BS - RW, 1, 0.14).clone()); edge.push(tm(ox + RW + (BS - RW) / 2, 0.011, oz + RW - 0.6, BS - RW, 1, 0.14).clone()); }
      if (j < NB) { edge.push(tm(ox + 0.6, 0.011, oz + RW + (BS - RW) / 2, 0.14, 1, BS - RW).clone()); edge.push(tm(ox + RW - 0.6, 0.011, oz + RW + (BS - RW) / 2, 0.14, 1, BS - RW).clone()); }
      for (let s = 1.6; s < RW - 1; s += 1.4) {
        if (i < NB) zebra.push(tm(ox + RW + 1.6, 0.013, oz + s, 2.4, 1, 0.7).clone());
        if (i > 0) zebra.push(tm(ox - 1.6, 0.013, oz + s, 2.4, 1, 0.7).clone());
        if (j < NB) zebra.push(tm(ox + s, 0.013, oz + RW + 1.6, 0.7, 1, 2.4).clone());
        if (j > 0) zebra.push(tm(ox + s, 0.013, oz - 1.6, 0.7, 1, 2.4).clone());
      }
    }
    const pl = new THREE.PlaneGeometry(1, 1); pl.rotateX(-Math.PI / 2);
    const mk = (arr: THREE.Matrix4[], c: string): void => { const im = new THREE.InstancedMesh(pl, M({ color: c, roughness: 0.7 }), arr.length); arr.forEach((m: THREE.Matrix4, k: number) => im.setMatrixAt(k, m)); im.receiveShadow = true; root.add(im); };
    mk(dash, "#e8c24a"); mk(zebra, "#e9e9e9"); mk(edge, "#d9d9d9");
  }
  // --- trees (instanced)
  const time = { value: 0 }, wind = { value: 0.2 };
  const sway = (m: THREE.MeshStandardMaterial, amp: number): THREE.MeshStandardMaterial => {
    m.onBeforeCompile = (sh: THREE.WebGLProgramParametersWithUniforms) => {
      sh.uniforms.uTime = time; sh.uniforms.uWind = wind;
      sh.vertexShader = "uniform float uTime; uniform float uWind;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec3 ip = instanceMatrix[3].xyz;
      #else
      vec3 ip = vec3(0.0);
      #endif
      float ph = ip.x * 0.37 + ip.z * 0.21;
      float k = ${amp.toFixed(2)} * (0.25 + uWind) ;
      transformed.x += sin(uTime * (1.4 + uWind * 2.5) + ph) * k * max(0.0, position.y + 0.6);
      transformed.z += cos(uTime * (1.1 + uWind * 2.0) + ph * 1.3) * k * 0.6 * max(0.0, position.y + 0.6);`);
    };
    return m;
  };
  const foliage: THREE.MeshStandardMaterial[] = [];
  {
    const broad = W.trees.filter((t: { k: number }) => t.k === 0 || t.k === 2), palms = W.trees.filter((t: { k: number }) => t.k === 1);
    const bushes = W.props.filter((p: { k: string }) => p.k === "bush");
    const trunkG = new THREE.CylinderGeometry(0.16, 0.28, 1, 7); trunkG.translate(0, 0.5, 0);
    const barkM = M({ map: T.bark, roughness: 0.95 });
    const trunk = new THREE.InstancedMesh(trunkG, barkM, broad.length);
    const blobG = new THREE.IcosahedronGeometry(1, 1);
    const leafM = sway(M({ roughness: 0.85, flatShading: true }), 0.08); foliage.push(leafM);
    const nb = broad.length * 4 + bushes.length;
    const blobs = new THREE.InstancedMesh(blobG, leafM, nb);
    const cc = new THREE.Color(); let bi = 0;
    broad.forEach((t: { x: number; z: number; s: number; k: number; r: number }, k: number) => {
      const h = (t.k === 2 ? 2.6 : 3.2 + t.r * 1.6) * t.s;
      trunk.setMatrixAt(k, tm(t.x, 0.1, t.z, t.s, h, t.s, t.r * 6).clone());
      const base = new THREE.Color().setHSL(0.24 + t.r * 0.08, 0.45 + t.r * 0.2, 0.22 + t.r * 0.08);
      for (let j = 0; j < 4; j++) {
        const a = j * 2.1 + t.r * 6, d = j === 0 ? 0 : 0.9 * t.s, s = (j === 0 ? 1.9 : 1.3 + ((t.r * 13 + j) % 1) * 0.5) * t.s * (t.k === 2 ? 0.7 : 1);
        blobs.setMatrixAt(bi, tm(t.x + Math.cos(a) * d, h + (j === 0 ? 0.6 : -0.2 + j * 0.25) * t.s, t.z + Math.sin(a) * d, s, s * 0.85, s, a).clone());
        blobs.setColorAt(bi++, cc.copy(base).offsetHSL(0, 0, (j - 1.5) * 0.025));
      }
    });
    for (const p of bushes) { blobs.setMatrixAt(bi, tm(p.x, 0.3, p.z, p.s * 1.1, p.s * 0.8, p.s * 1.1, p.a).clone()); blobs.setColorAt(bi++, cc.setHSL(0.27, 0.5, 0.2)); }
    trunk.castShadow = blobs.castShadow = true; trunk.receiveShadow = blobs.receiveShadow = true; root.add(trunk, blobs);
    // palms
    const ptG = new THREE.CylinderGeometry(0.17, 0.26, 1, 8, 6); ptG.translate(0, 0.5, 0);
    const pa = ptG.getAttribute("position") as THREE.BufferAttribute; for (let k = 0; k < pa.count; k++) { const y = pa.getY(k); pa.setX(k, pa.getX(k) + y * y * 0.35); } ptG.computeVertexNormals();
    const pTrunk = new THREE.InstancedMesh(ptG, M({ map: T.palm, roughness: 0.95 }), palms.length);
    // frond geometry: tapered drooping strip with side leaflets
    const fg = new GB(); const fc = new THREE.Color("#ffffff");
    for (let s = 0; s < 8; s++) {
      const t0 = s / 8, t1 = (s + 1) / 8, w0 = 0.42 * Math.sin(Math.PI * (0.15 + t0 * 0.85)), w1 = 0.42 * Math.sin(Math.PI * (0.15 + t1 * 0.85));
      const y0 = 0.5 * t0 - 1.5 * t0 * t0, y1 = 0.5 * t1 - 1.5 * t1 * t1, x0 = t0 * 2.6, x1 = t1 * 2.6;
      fg.quad([x0, y0, -w0], [x1, y1, -w1], [x1, y1 + 0.06, 0], [x0, y0 + 0.06, 0], 0, 1, 0, [0, 1, 0, 1], fc);
      fg.quad([x0, y0 + 0.06, 0], [x1, y1 + 0.06, 0], [x1, y1, w1], [x0, y0, w0], 0, 1, 0, [0, 1, 0, 1], fc);
    }
    const frondG = fg.build(); frondG.computeVertexNormals();
    const frM = sway(M({ color: "#4f7f2a", roughness: 0.8, side: THREE.DoubleSide }), 0.12); foliage.push(frM);
    const fronds = new THREE.InstancedMesh(frondG, frM, palms.length * 10);
    let fi = 0;
    palms.forEach((t: { x: number; z: number; s: number; r: number }, k: number) => {
      const h = (5 + t.r * 3) * t.s, rot = t.r * 6;
      const mm = new THREE.Matrix4().compose(v1.set(t.x, 0.1, t.z), q.setFromEuler(e3.set(0, rot, 0)), v2.set(t.s * 1.1, h, t.s * 1.1)); pTrunk.setMatrixAt(k, mm);
      const top = new THREE.Vector3(0.35 * t.s * 1.1, h, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot).add(new THREE.Vector3(t.x, 0.1, t.z));
      for (let j = 0; j < 10; j++) { const a = (j / 10) * Math.PI * 2 + t.r; const qq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, (j % 2 ? 0.25 : -0.05), "YXZ")); fronds.setMatrixAt(fi, new THREE.Matrix4().compose(top, qq, v2.set(t.s, t.s, t.s))); fronds.setColorAt(fi++, cc.setHSL(0.22 + (j % 3) * 0.02, 0.5, 0.28 + (j % 2) * 0.05)); }
    });
    pTrunk.castShadow = fronds.castShadow = true; pTrunk.receiveShadow = true; root.add(pTrunk, fronds);
  }
  // rocks, dunes (in-city)
  {
    const rocks = W.props.filter((p: { k: string }) => p.k === "rock"), dunes = W.props.filter((p: { k: string }) => p.k === "dune");
    const rk = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), M({ color: "#9c7a55", roughness: 1, flatShading: true }), Math.max(1, rocks.length));
    rocks.forEach((p: { x: number; z: number; s: number; a: number }, k: number) => rk.setMatrixAt(k, tm(p.x, p.s * 0.35, p.z, p.s, p.s * 0.7, p.s * 0.9, p.a).clone())); rk.castShadow = rk.receiveShadow = true; rk.count = rocks.length; root.add(rk);
    const dm = new THREE.InstancedMesh(sphG, M({ map: T.sand, roughness: 1 }), Math.max(1, dunes.length));
    dunes.forEach((p: { x: number; z: number; w: number; h: number; d: number; a: number }, k: number) => dm.setMatrixAt(k, tm(p.x, 0, p.z, p.w, p.h, p.d, p.a).clone())); dm.receiveShadow = dm.castShadow = true; dm.count = dunes.length; root.add(dm);
  }
  // street lamps
  const lampPos: THREE.Vector3[] = [];
  {
    const n = W.lamps.length, poleG = new THREE.CylinderGeometry(0.07, 0.11, 6, 6); poleG.translate(0, 3, 0);
    const armG = new THREE.BoxGeometry(1.4, 0.08, 0.08); armG.translate(0.7, 0, 0);
    const headG = new THREE.BoxGeometry(0.6, 0.14, 0.3);
    const pole = new THREE.InstancedMesh(poleG, mats.pole, n), arm = new THREE.InstancedMesh(armG, mats.pole, n), head = new THREE.InstancedMesh(headG, mats.lamp, n);
    W.lamps.forEach((l: { x: number; z: number; a: number }, k: number) => {
      pole.setMatrixAt(k, tm(l.x, 0.15, l.z, 1, 1, 1).clone());
      arm.setMatrixAt(k, tm(l.x, 6.05, l.z, 1, 1, 1, -l.a).clone());
      const hx = l.x + Math.cos(l.a) * 1.3, hz = l.z + Math.sin(l.a) * 1.3;
      head.setMatrixAt(k, tm(hx, 5.98, hz, 1, 1, 1, -l.a).clone()); lampPos.push(new THREE.Vector3(hx, 5.7, hz));
    });
    pole.castShadow = true; root.add(pole, arm, head);
  }
  // water: fountain + pool
  const water = M({ color: "#2f86b8", roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85 });
  for (const p of W.props) {
    if (p.k === "fountain") { const w = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.1, 0.1, 24), water); w.position.set(p.x, 0.86, p.z); root.add(w); }
    if (p.k === "pool") { const w = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.1, p.d), water); w.position.set(p.x, 0.3, p.z); root.add(w); }
  }
  // fountain spray
  const fnt = W.props.find((p: { k: string }) => p.k === "fountain");
  const NS = 400, sp = new Float32Array(NS * 3), sv = new Float32Array(NS * 3);
  const sprayG = new THREE.BufferGeometry(); sprayG.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const spray = new THREE.Points(sprayG, new THREE.PointsMaterial({ color: "#cfeaff", size: 0.12, transparent: true, opacity: 0.75, depthWrite: false }));
  if (fnt) root.add(spray);
  const fx = fnt ? fnt.x : 0, fz = fnt ? fnt.z : 0;
  for (let k = 0; k < NS; k++) { sp[k * 3 + 1] = -10; }
  boxG.dispose();

  const update = (cam: THREE.Vector3, night: number, wet: number, t: number): void => {
    time.value = t;
    for (const c of chunks) if (c.detail) c.m.visible = Math.hypot(c.cx - cam.x, c.cz - cam.z) < 300;
    const li = night * 1.25;
    for (const k of ["office", "glass", "villa", "apart"]) mats[k].emissiveIntensity = li;
    mats.lamp.emissiveIntensity = 0.1 + night * 3; mats.sign.emissiveIntensity = 0.12 + night * 0.9; mats.store.emissiveIntensity = 0.2 + night * 1.2;
    // wet roads: darker + glossier
    mats.asphalt.roughness = 0.92 - wet * 0.65; mats.asphalt.color.setScalar(1 - wet * 0.45); mats.asphalt.envMapIntensity = 0.3 + wet * 1.4;
    mats.sidewalk.roughness = 0.9 - wet * 0.5; mats.sidewalk.color.setScalar(1 - wet * 0.3);
    // spray
    if (fnt && Math.hypot(fx - cam.x, fz - cam.z) < 160) {
      for (let k = 0; k < NS; k++) {
        const i3 = k * 3;
        if (sp[i3 + 1] < 0.9) { const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 0.9; sp[i3] = fx; sp[i3 + 1] = 2.5; sp[i3 + 2] = fz; sv[i3] = Math.cos(a) * s; sv[i3 + 1] = 2.5 + Math.random() * 1.5; sv[i3 + 2] = Math.sin(a) * s; }
        sv[i3 + 1] -= 9.8 / 60; sp[i3] += sv[i3] / 60; sp[i3 + 1] += sv[i3 + 1] / 60; sp[i3 + 2] += sv[i3 + 2] / 60;
      }
      sprayG.attributes.position.needsUpdate = true;
    }
  };
  return { root, chunks, mats, lampPos, foliage, wind, time, water, spray, update };
}
