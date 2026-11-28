// World generation v2: districts, buildings, villas, shops, parks, desert edge.
import { Block, Rect, NB, BS, RW, SWK, WORLD, rng, HOSP } from "./logic";

export type Tier = { i: number; h: number };
export type Bld = { x0: number; z0: number; x1: number; z1: number; h: number; st: number; col: string; tiers: Tier[]; shape: number; sign: string; face: number; bal: boolean; seed: number };
export type Wall = { x0: number; z0: number; x1: number; z1: number; h: number; col: string };
export type Tree = { x: number; z: number; s: number; k: number; r: number };
export type Lamp = { x: number; z: number; a: number };
export type DoorKind = "market" | "rest" | "hotel" | "home" | "hosp" | "cafe" | "clothes";
export type Door = { x: number; z: number; a: number; kind: DoorKind; name: string; ox: number; oz: number };
export type Prop = { k: string; x: number; z: number; a: number; s: number; h: number; w: number; d: number; col: string };
export type Ground = { x: number; z: number; s: number; k: number };
export type WorldData = { B: Block[]; blds: Bld[]; walls: Wall[]; trees: Tree[]; lamps: Lamp[]; doors: Door[]; props: Prop[]; grounds: Ground[]; home: { x: number; z: number }; garage: { x: number; z: number; a: number } };

// building styles
export const ST_OFFICE = 0, ST_GLASS = 1, ST_VILLA = 2, ST_APART = 3, ST_SHOP = 4, ST_HOSP = 5, ST_HOTEL = 6;
const TOWER_COLS = ["#c9ced6", "#b8c4cf", "#d9d4c7", "#9aa6b2", "#e2ddd2", "#a9b4ad", "#c4b8a8"];
const GLASS_COLS = ["#7fa6c4", "#86b5b8", "#6f8fb0", "#9bb0c9", "#7e9e9a", "#8fa0b8"];
const VILLA_COLS = ["#efe4d0", "#e8d8bd", "#f3ede2", "#e5d3b3", "#dcc7a5", "#f0e6da", "#d9cbb6"];
const APART_COLS = ["#d8c3a5", "#c9b79c", "#e0d6c2", "#bfae96", "#d4a59a", "#c8bfb0"];
const SHOP_NAMES = ["PHARMACY", "BARBER", "PHONE REPAIR", "PAWN SHOP", "BOOKS", "COFFEE", "DONUTS", "BANK", "BAKERY", "JEWELRY", "ELECTRONICS", "LAUNDROMAT", "LIQUOR", "PIZZA", "TATTOO", "HARDWARE"];

export function district(bx: number, by: number): number {
  if (bx === NB - 1 || by === NB - 1) return 5; // desert edge
  if (bx === 6 && by === 2) return 6; // hospital
  if ((bx === 2 && by === 5) || (bx === 8 && by === 4) || (bx === 7 && by === 8) || (bx === 1 && by === 8)) return 7; // parks
  if (bx === 5 && by === 5) return 8; // plaza
  const dc = Math.hypot(bx - 5, by - 5);
  if (dc <= 2.3) return 1; // downtown
  if (by === 7 || (bx === 3 && by >= 2 && by <= 4)) return 2; // commercial street
  if (bx <= 2 || by <= 1) return 3; // residential villas
  return 4; // apartments
}

export function genWorld(): WorldData {
  const r = rng(424242);
  const W: WorldData = { B: [], blds: [], walls: [], trees: [], lamps: [], doors: [], props: [], grounds: [], home: { x: 0, z: 0 }, garage: { x: 0, z: 0, a: 0 } };
  const pick = <T,>(a: T[]): T => a[Math.floor(r() * a.length)];
  let shopNameI = 0, markets = 0, rests = 0;
  for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
    const x = bx * BS + RW, z = by * BS + RW, s = BS - RW, cx = x + s / 2, cz = z + s / 2;
    const d = district(bx, by);
    const k = d === 7 ? 1 : d === 8 ? 2 : d === 5 ? 3 : 0;
    const b: Block = { k, x, z, s, solids: [], d };
    const ins = s - 2 * SWK, ix = x + SWK, iz = z + SWK;
    const solid = (q: Rect): void => { b.solids.push(q); };
    const bld = (q: Bld): void => { W.blds.push(q); solid({ x0: q.x0, z0: q.z0, x1: q.x1, z1: q.z1, h: q.h }); };
    const wall = (x0: number, z0: number, x1: number, z1: number, h: number, col: string): void => { W.walls.push({ x0, z0, x1, z1, h, col }); solid({ x0, z0, x1, z1, h }); };
    W.grounds.push({ x, z, s, k: d === 7 ? 1 : d === 8 ? 2 : d === 5 ? 3 : d === 3 ? 4 : d === 6 ? 2 : 0 });
    if (d === 1) {
      // downtown towers
      const cols = r() < 0.5 ? 2 : 1, rows = cols === 1 ? 1 : r() < 0.5 ? 2 : 1, gap = 5, m = SWK + 2;
      const iw = s - 2 * m, cw = (iw - gap * (cols - 1)) / cols, chh = (iw - gap * (rows - 1)) / rows;
      const tall = Math.max(0, 1 - Math.hypot(bx - 5, by - 5) / 3.2);
      for (let c = 0; c < cols; c++) for (let q = 0; q < rows; q++) {
        const x0 = x + m + c * (cw + gap), z0 = z + m + q * (chh + gap);
        const ib = r() * 1.5, w = cw - 2 * ib, dd = chh - 2 * ib;
        const h = 30 + r() * 30 + tall * (30 + r() * 70);
        const glass = r() < 0.6, shape = r() < 0.18 && cols === 1 ? 1 : r() < 0.2 ? 2 : 0;
        const tiers: Tier[] = [];
        if (shape === 0 && r() < 0.7) { tiers.push({ i: 0, h: h * rr2(r, 0.35, 0.55) }); tiers.push({ i: rr2(r, 1.5, 3.5), h: h * rr2(r, 0.25, 0.4) }); if (r() < 0.6) tiers.push({ i: rr2(r, 4, 7), h: h * rr2(r, 0.1, 0.2) }); }
        const hotel = bx === 6 && by === 5 && c === 0 && q === 0;
        bld({ x0: x0 + ib, z0: z0 + ib, x1: x0 + ib + w, z1: z0 + ib + dd, h, st: hotel ? ST_HOTEL : glass ? ST_GLASS : ST_OFFICE, col: glass ? pick(GLASS_COLS) : pick(TOWER_COLS), tiers, shape, sign: hotel ? "GRAND HOTEL" : "", face: 3, bal: false, seed: r() * 1000 });
        if (hotel) W.doors.push({ x: x0 + ib + w / 2, z: z0 + ib - 0.8, a: -Math.PI / 2, kind: "hotel", name: "Grand Hotel", ox: x0 + ib + w / 2, oz: z - 0.5 + 1.5 });
      }
      for (let t = x + 6; t < x + s - 4; t += 9) { W.trees.push({ x: t, z: z + 1.4, s: 0.7, k: 2, r: r() }); W.trees.push({ x: t, z: z + s - 1.4, s: 0.7, k: 2, r: r() }); }
    } else if (d === 2) {
      // commercial: row of shops facing north (z0 side) and south
      const n = 3, w = (ins - 2) / n;
      for (const side of [0, 1]) for (let i = 0; i < n; i++) {
        const x0 = ix + 1 + i * w + 0.3, x1 = x0 + w - 0.6, dd = ins / 2 - 3;
        const z0 = side === 0 ? iz + 1 : iz + ins / 2 + 2, z1 = z0 + dd;
        let sign = SHOP_NAMES[shopNameI++ % SHOP_NAMES.length]; let kind: DoorKind | null = null;
        if (side === 0 && i === 1 && markets < 3) { sign = markets % 2 ? "SUPERMART" : "24/7 STORE"; kind = "market"; markets++; }
        else if (side === 1 && i === 1 && rests < 3) { sign = ["JOE'S DINER", "BURGER JOINT", "PIZZA PALACE"][rests % 3]; kind = "rest"; rests++; }
        else if (side === 0 && i === 2 && bx === 4) { sign = "CLOTHING"; kind = "clothes"; }
        const h = 7 + Math.floor(r() * 3) * 3.4;
        bld({ x0, z0, x1, z1, h, st: ST_SHOP, col: pick(APART_COLS), tiers: [], shape: 0, sign, face: side === 0 ? 3 : 1, bal: r() < 0.4, seed: r() * 1000 });
        if (kind) {
          const dz = side === 0 ? z0 - 0.7 : z1 + 0.7;
          W.doors.push({ x: (x0 + x1) / 2, z: dz, a: side === 0 ? -Math.PI / 2 : Math.PI / 2, kind, name: sign, ox: (x0 + x1) / 2, oz: dz + (side === 0 ? -0.8 : 0.8) });
        }
      }
      for (let t = x + 5; t < x + s - 3; t += 12) { W.trees.push({ x: t, z: z + 1.3, s: 0.8, k: 1, r: r() }); W.trees.push({ x: t, z: z + s - 1.3, s: 0.8, k: 1, r: r() }); }
      for (let t = x + 9; t < x + s - 3; t += 12) { W.props.push({ k: "bench", x: t, z: z + 1.0, a: 0, s: 1, h: 0, w: 0, d: 0, col: "" }); }
    } else if (d === 3) {
      // villas: 2x2 lots with walls and gates, or the player's home
      const isHome = bx === 1 && by === 2;
      const lots = isHome ? [[0, 0, 1, 1]] : [[0, 0, 0.5, 0.5], [0.5, 0, 1, 0.5], [0, 0.5, 0.5, 1], [0.5, 0.5, 1, 1]];
      for (const L of lots) {
        const lx0 = ix + 0.5 + L[0] * (ins - 1), lz0 = iz + 0.5 + L[1] * (ins - 1), lx1 = ix + 0.5 + L[2] * (ins - 1), lz1 = iz + 0.5 + L[3] * (ins - 1);
        const north = L[1] === 0; // gate on the street-facing side
        const wc = pick(["#e9dcc4", "#d8c8a8", "#efe7d8", "#cdb998"]), wh = 2.4, t = 0.3, gw = isHome ? 5 : 3.6;
        const gx = (lx0 + lx1) / 2;
        const gz = north ? lz0 : lz1;
        // walls: front (with gate gap), back, sides
        wall(lx0, gz - t / 2, gx - gw / 2, gz + t / 2, wh, wc); wall(gx + gw / 2, gz - t / 2, lx1, gz + t / 2, wh, wc);
        const bz = north ? lz1 : lz0; wall(lx0, bz - t / 2, lx1, bz + t / 2, wh, wc);
        wall(lx0 - t / 2, lz0, lx0 + t / 2, lz1, wh, wc); wall(lx1 - t / 2, lz0, lx1 + t / 2, lz1, wh, wc);
        W.props.push({ k: "gate", x: gx, z: gz, a: 0, s: gw, h: wh, w: 0, d: 0, col: wc });
        const lw = lx1 - lx0, ld = lz1 - lz0;
        const vw = lw * (isHome ? 0.5 : 0.58), vd = ld * (isHome ? 0.42 : 0.5);
        const vx0 = gx - vw / 2 + (isHome ? 0 : (r() - 0.5) * 2), vz0 = north ? lz1 - 2.2 - vd : lz0 + 2.2;
        const h = isHome ? 8.2 : 6.8 + (r() < 0.5 ? 0 : 0.6);
        bld({ x0: vx0, z0: vz0, x1: vx0 + vw, z1: vz0 + vd, h, st: ST_VILLA, col: isHome ? "#f4efe6" : pick(VILLA_COLS), tiers: [{ i: 0, h: h * 0.5 }, { i: r() * 1.5 + 1, h: h * 0.5 }], shape: 0, sign: "", face: north ? 3 : 1, bal: isHome || r() < 0.4, seed: r() * 1000 });
        const fdz = north ? vz0 - 0.6 : vz0 + vd + 0.6;
        if (isHome) {
          W.doors.push({ x: gx, z: fdz, a: north ? -Math.PI / 2 : Math.PI / 2, kind: "home", name: "My House", ox: gx, oz: fdz + (north ? -1 : 1) });
          W.home = { x: gx, z: fdz - 2 };
          W.props.push({ k: "pool", x: gx + lw * 0.27, z: (lz0 + lz1) / 2 - 2, a: 0, s: 1, h: 0, w: 7, d: 4, col: "" });
          W.props.push({ k: "carport", x: gx - lw * 0.3, z: lz0 + 6, a: 0, s: 1, h: 3, w: 6, d: 7, col: "" });
          W.garage = { x: gx, z: z - 2.2, a: 0 };
          for (const q of [[-0.4, 0.2], [0.42, 0.75], [-0.42, 0.8], [0.38, 0.25]]) W.trees.push({ x: gx + q[0] * lw, z: lz0 + q[1] * ld, s: 1, k: 1, r: r() });
        } else {
          W.props.push({ k: "door", x: gx, z: fdz, a: 0, s: 1, h: 2.4, w: 1.6, d: 0, col: "" });
          if (r() < 0.8) W.trees.push({ x: lx0 + 2 + r() * 2, z: north ? lz0 + 2.5 : lz1 - 2.5, s: 0.8 + r() * 0.4, k: r() < 0.6 ? 1 : 0, r: r() });
          if (r() < 0.6) W.trees.push({ x: lx1 - 2 - r() * 2, z: north ? lz0 + 2.5 : lz1 - 2.5, s: 0.8 + r() * 0.4, k: r() < 0.6 ? 1 : 0, r: r() });
        }
      }
    } else if (d === 4) {
      // apartment blocks
      const two = r() < 0.6, m = SWK + 2, iw = s - 2 * m;
      const parts = two ? [[0, 0, 0.45, 1], [0.55, 0, 1, 1]] : [[0.1, 0.1, 0.9, 0.9]];
      for (const P of parts) {
        const x0 = x + m + P[0] * iw, x1 = x + m + P[2] * iw, z0 = z + m + P[1] * iw + (two ? 4 : 0), z1 = z + m + P[3] * iw - (two ? 4 : 0);
        const h = 3.4 * (4 + Math.floor(r() * 6)) + 1;
        bld({ x0, z0, x1, z1, h, st: ST_APART, col: pick(APART_COLS), tiers: [], shape: 0, sign: "", face: 3, bal: true, seed: r() * 1000 });
      }
      for (let t = x + 6; t < x + s - 4; t += 11) { if (r() < 0.5) W.trees.push({ x: t, z: z + 1.4, s: 0.7, k: 0, r: r() }); if (r() < 0.5) W.trees.push({ x: t, z: z + s - 1.4, s: 0.7, k: 0, r: r() }); }
    } else if (d === 6) {
      // hospital
      const x0 = ix + 4, x1 = ix + ins - 4, z0 = iz + 8, z1 = iz + ins - 3;
      bld({ x0, z0, x1, z1, h: 22, st: ST_HOSP, col: "#f2f4f5", tiers: [{ i: 0, h: 12 }, { i: 5, h: 10 }], shape: 0, sign: "HOSPITAL", face: 3, bal: false, seed: 7 });
      W.props.push({ k: "canopy", x: cx, z: z0 - 2.5, a: 0, s: 1, h: 4, w: 10, d: 5, col: "#e53935" });
      W.doors.push({ x: cx, z: z0 - 0.7, a: -Math.PI / 2, kind: "hosp", name: "Hospital", ox: cx, oz: z0 - 3 });
      HOSP.x = cx - 6; HOSP.z = z + 1.5;
      for (const q of [-1, 1]) W.trees.push({ x: cx + q * 14, z: iz + 4, s: 1, k: 1, r: r() });
    } else if (d === 7) {
      // park
      for (let i = 0; i < 22; i++) { const tx = ix + 3 + r() * (ins - 6), tz = iz + 3 + r() * (ins - 6); if (Math.abs(tx - cx) < 3 || Math.abs(tz - cz) < 3) continue; W.trees.push({ x: tx, z: tz, s: 0.9 + r() * 0.6, k: r() < 0.8 ? 0 : 1, r: r() }); }
      for (let i = 0; i < 14; i++) { const tx = ix + 2 + r() * (ins - 4), tz = iz + 2 + r() * (ins - 4); if (Math.abs(tx - cx) < 3 || Math.abs(tz - cz) < 3) continue; W.props.push({ k: "bush", x: tx, z: tz, a: r() * 6, s: 0.6 + r() * 0.6, h: 0, w: 0, d: 0, col: "" }); }
      for (const q of [[5, 4, 0], [-6, -5, 0], [4, -7, 1], [-5, 6, 1]]) W.props.push({ k: "bench", x: cx + q[0], z: cz + q[1], a: q[2] * Math.PI / 2, s: 1, h: 0, w: 0, d: 0, col: "" });
      W.props.push({ k: "path", x: cx, z: cz, a: 0, s: 1, h: 0, w: ins, d: 3, col: "" });
      W.props.push({ k: "path", x: cx, z: cz, a: Math.PI / 2, s: 1, h: 0, w: ins, d: 3, col: "" });
    } else if (d === 8) {
      W.props.push({ k: "fountain", x: cx, z: cz, a: 0, s: 1, h: 0, w: 0, d: 0, col: "" });
      solid({ x0: cx - 4.5, z0: cz - 4.5, x1: cx + 4.5, z1: cz + 4.5, h: 1 });
      for (const q of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) W.trees.push({ x: cx + q[0] * (ins / 2 - 4), z: cz + q[1] * (ins / 2 - 4), s: 1, k: 1, r: r() });
      for (const q of [[0, -9, 0], [0, 9, 0], [-9, 0, 1], [9, 0, 1]]) W.props.push({ k: "bench", x: cx + q[0], z: cz + q[1], a: q[2] * Math.PI / 2, s: 1, h: 0, w: 0, d: 0, col: "" });
    } else if (d === 5) {
      // beach edge: palms, low sand mounds, rocks
      for (let i = 0; i < 9; i++) { const tx = ix + 2 + r() * (ins - 4), tz = iz + 2 + r() * (ins - 4); W.trees.push({ x: tx, z: tz, s: 0.9 + r() * 0.5, k: 1, r: r() }); }
      for (let i = 0; i < 4; i++) W.props.push({ k: "dune", x: ix + 6 + r() * (ins - 12), z: iz + 6 + r() * (ins - 12), a: r() * 6, s: 1, h: 0.3 + r() * 0.5, w: 8 + r() * 10, d: 5 + r() * 6, col: "" });
      for (let i = 0; i < 5; i++) { const rx0 = ix + 3 + r() * (ins - 6), rz0 = iz + 3 + r() * (ins - 6), rs = 0.6 + r() * 1.2; W.props.push({ k: "rock", x: rx0, z: rz0, a: r() * 6, s: rs, h: 0, w: 0, d: 0, col: "" }); solid({ x0: rx0 - rs * 0.7, z0: rz0 - rs * 0.7, x1: rx0 + rs * 0.7, z1: rz0 + rs * 0.7, h: rs }); }
    }
    // street lamps
    if (d !== 5 || r() < 0.4) for (const q of [[0.6, 0.6], [s - 0.6, 0.6], [0.6, s - 0.6], [s - 0.6, s - 0.6], [s / 2, 0.6], [s / 2, s - 0.6], [0.6, s / 2], [s - 0.6, s / 2]]) {
      const lx = x + q[0], lz = z + q[1];
      const a = q[1] < 1 ? -Math.PI / 2 : q[1] > s - 1 ? Math.PI / 2 : q[0] < 1 ? Math.PI : 0;
      W.lamps.push({ x: lx, z: lz, a });
    }
    W.B.push(b);
  }
  // keep compiler aware of WORLD usage
  if (WORLD <= 0) throw new Error("world");
  return W;
}
function rr2(r: () => number, a: number, b: number): number { return a + r() * (b - a); }

export function mkMini(W: WorldData): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = WORLD; c.height = WORLD;
  const x = c.getContext("2d"); if (!x) return c;
  x.fillStyle = "#4b5058"; x.fillRect(0, 0, WORLD, WORLD);
  const GC = ["#8d8a83", "#4f9a4a", "#c9c3b5", "#d9b77a", "#a6a08c"];
  for (const b of W.B) { x.fillStyle = GC[W.grounds[W.B.indexOf(b)].k] || "#8d8a83"; x.fillRect(b.x, b.z, b.s, b.s); }
  for (const w of W.walls) { x.fillStyle = "#b9ab90"; x.fillRect(w.x0, w.z0, Math.max(0.8, w.x1 - w.x0), Math.max(0.8, w.z1 - w.z0)); }
  for (const b of W.blds) { x.fillStyle = b.st === ST_HOSP ? "#ffffff" : b.st === ST_GLASS ? "#5d7590" : b.st === ST_VILLA ? "#b48a63" : "#3d4a5a"; x.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0); }
  for (const d of W.doors) { x.fillStyle = d.kind === "hosp" ? "#ff1744" : d.kind === "home" ? "#00e5ff" : d.kind === "market" ? "#ffd54f" : d.kind === "rest" ? "#ff9100" : d.kind === "hotel" ? "#b388ff" : "#f48fb1"; x.beginPath(); x.arc(d.x, d.z, 5, 0, Math.PI * 2); x.fill(); }
  return c;
}
