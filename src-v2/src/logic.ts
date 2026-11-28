/* eslint-disable */
// Game logic ported from v1 (simulation, سلطان AI, voice, NLU). Rendering lives in render/*.
export const HOOK = { vol: 1, phone: (): void => undefined, tri: (): boolean => false, voiceFile: (_t: string): boolean => false, ev: (_n: string, _x: number, _y: number, _z: number, _a: number): void => undefined };
export const NB = 11, BS = 64, RW = 14, WORLD = NB * BS + RW, SWK = 3, LO = 3.2;
export const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
export const TAU = Math.PI * 2;
export const R = Math.random;
export function rr(a: number, b: number): number { return a + R() * (b - a); }
export function pick<T>(a: T[]): T { return a[Math.floor(R() * a.length)]; }
export function clamp(v: number, a: number, b: number): number { return v < a ? a : v > b ? b : v; }
export function angDiff(a: number, b: number): number { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
export function rng(seed: number): () => number { let s = seed >>> 0; return (): number => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export type V3 = [number, number, number];
export function hex(h: string): V3 { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
export function dk(c: V3, f: number): V3 { return [c[0] * f, c[1] * f, c[2] * f]; }

// ---------- matrices ----------
export type M4 = Float32Array;
export function m4(): M4 { const m = new Float32Array(16); m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1; return m; }
export function mul(a: M4, b: M4): M4 { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
export function ch(...ms: M4[]): M4 { let r = ms[0]; for (let i = 1; i < ms.length; i++) r = mul(r, ms[i]); return r; }
export function tr(x: number, y: number, z: number): M4 { const m = m4(); m[12] = x; m[13] = y; m[14] = z; return m; }
export function ry(t: number): M4 { const m = m4(), c = Math.cos(t), s = Math.sin(t); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
export function rx(t: number): M4 { const m = m4(), c = Math.cos(t), s = Math.sin(t); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
export function rz(t: number): M4 { const m = m4(), c = Math.cos(t), s = Math.sin(t); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
export function sc(x: number, y: number, z: number): M4 { const m = m4(); m[0] = x; m[5] = y; m[10] = z; return m; }
export function persp(fy: number, as: number, n: number, f: number): M4 { const m = new Float32Array(16), t = 1 / Math.tan(fy / 2); m[0] = t / as; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = (2 * f * n) / (n - f); return m; }
export function lookAt(ex: number, ey: number, ez: number, tx: number, ty: number, tz: number): M4 {
  let zx = ex - tx, zy = ey - ty, zz = ez - tz; let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
  let xx = zz, xz = -zx; const xy = 0; l = Math.hypot(xx, xz) || 1; xx /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  const m = new Float32Array(16);
  m[0] = xx; m[1] = yx; m[2] = zx; m[4] = xy; m[5] = yy; m[6] = zy; m[8] = xz; m[9] = yz; m[10] = zz;
  m[12] = -(xx * ex + xy * ey + xz * ez); m[13] = -(yx * ex + yy * ey + yz * ez); m[14] = -(zx * ex + zy * ey + zz * ez); m[15] = 1;
  return m;
}

// ---------- geometry ----------
export const CORN = [1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, 1, -1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1, -1];
export const NRM = [1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1];
export const TRI = [0, 1, 2, 0, 2, 3];
export function pushBox(o: number[], x: number, y: number, z: number, sx: number, sy: number, sz: number, c: V3): void {
  for (let f = 0; f < 6; f++) for (const i of TRI) { const q = (f * 4 + i) * 3; o.push(x + (CORN[q] * sx) / 2, y + (CORN[q + 1] * sy) / 2, z + (CORN[q + 2] * sz) / 2, NRM[f * 3], NRM[f * 3 + 1], NRM[f * 3 + 2], c[0], c[1], c[2]); }
}

// ---------- types ----------
export type Rect = { x0: number; z0: number; x1: number; z1: number; h: number };
export type Block = { k: number; x: number; z: number; s: number; solids: Rect[]; d: number };
export type CT = { n: string; l: number; w: number; h: number; cols: string[]; acc: number; max: number; turn: number; hp: number; slip: number; kind: number };
export type Car = { t: CT; x: number; z: number; a: number; pa: number; vx: number; vz: number; hp: number; col: V3; drv: number; park: boolean; ix: number; iy: number; dir: number; st: number; wx: number; wz: number; dead: number; steer: number; stuck: number; ign: number; rev: number; panic: number; knock: number; brake: boolean; cd: number };
export type Ped = { x: number; z: number; a: number; vx: number; vz: number; hp: number; sh: V3; pa: V3; sk: V3; ha: V3; ph: number; mv: number; bx: number; by: number; k: number; dirs: number; tx: number; tz: number; flee: number; fx: number; fz: number; dead: number; spd: number };
export type Ani = { k: number; x: number; y: number; z: number; a: number; ph: number; st: number; t: number; tx: number; tz: number; hx: number; hz: number; hs: number; fx: number; fz: number; dead: number; c: V3; mv: number };
export type Part = { x: number; y: number; z: number; vx: number; vy: number; vz: number; l: number; ml: number; s: number; c: V3; em: number; g: number };
export type Trc = { x1: number; y1: number; z1: number; x2: number; y2: number; z2: number; l: number; c: V3 };
export type Pick = { x: number; z: number; k: number; w: number; resp: number; tmp: boolean; amt: number };
export type Player = { x: number; y: number; z: number; vy: number; a: number; hp: number; money: number; w: number; ammo: number[]; has: boolean[]; car: Car | null; ph: number; mv: number; cd: number; dead: number; punch: number };
export type Pad = { on: boolean; lx: number; ly: number; rx: number; ry: number; r2: number; l2: number; cross: boolean; square: boolean; l3: boolean; prev: boolean[] };
export type Pt = { x: number; z: number };
export type Game = { B: Block[]; cars: Car[]; peds: Ped[]; ans: Ani[]; parts: Part[]; trc: Trc[]; picks: Pick[]; p: Player; yaw: number; pitch: number; ldx: number; ldy: number; lookT: number; ex: number; ey: number; ez: number; tx: number; ty: number; tz: number; t: number; keys: Set<string>; mDown: boolean; rDown: boolean; locked: boolean; aiming: boolean; fireT: number; jumpReq: boolean; shake: number; hurtT: number; flash: number; msgs: { s: string; l: number }[]; started: boolean; ever: boolean; big: boolean; spawnT: number; polT: number; wanted: number; calm: number; pad: Pad; mini: HTMLCanvasElement; aimP: number; b: Bud; pv: M4; inside: boolean; ui: boolean; menuCam: boolean };

export type Wpn = { n: string; cd: number; dmg: number; spr: number; pel: number; range: number; ammo: number; boom: boolean; len: number };
export const WP: Wpn[] = [
  { n: "Fists", cd: 0.4, dmg: 25, spr: 0, pel: 0, range: 2, ammo: 0, boom: false, len: 0 },
  { n: "Pistol", cd: 0.3, dmg: 30, spr: 0.012, pel: 1, range: 120, ammo: 60, boom: false, len: 0.35 },
  { n: "Uzi", cd: 0.08, dmg: 14, spr: 0.035, pel: 1, range: 90, ammo: 200, boom: false, len: 0.45 },
  { n: "Shotgun", cd: 0.9, dmg: 16, spr: 0.07, pel: 8, range: 40, ammo: 30, boom: false, len: 0.7 },
  { n: "AK-47", cd: 0.11, dmg: 24, spr: 0.018, pel: 1, range: 160, ammo: 180, boom: false, len: 0.8 },
  { n: "Sniper", cd: 1.2, dmg: 160, spr: 0, pel: 1, range: 320, ammo: 20, boom: false, len: 1.0 },
  { n: "RPG", cd: 1.4, dmg: 0, spr: 0.004, pel: 1, range: 200, ammo: 10, boom: true, len: 0.9 },
];
export const CTS: CT[] = [
  { n: "Sedan", l: 4.4, w: 2, h: 1.4, cols: ["#c0392b", "#2980b9", "#27ae60", "#8e44ad", "#ecf0f1", "#34495e", "#d35400", "#7f8c8d"], acc: 9, max: 24, turn: 2.2, hp: 120, slip: 0.82, kind: 0 },
  { n: "Muscle Car", l: 4.3, w: 2, h: 1.15, cols: ["#e74c3c", "#f1c40f", "#1abc9c", "#ff5fa2", "#ff8c00"], acc: 15, max: 38, turn: 2.6, hp: 100, slip: 0.88, kind: 1 },
  { n: "Taxi", l: 4.4, w: 2, h: 1.4, cols: ["#f5c518"], acc: 9, max: 25, turn: 2.2, hp: 120, slip: 0.82, kind: 2 },
  { n: "Police Cruiser", l: 4.6, w: 2.05, h: 1.4, cols: ["#121418"], acc: 13, max: 33, turn: 2.5, hp: 170, slip: 0.83, kind: 3 },
  { n: "Box Truck", l: 7.5, w: 2.5, h: 3.2, cols: ["#7f8c8d", "#a0522d", "#2c3e50"], acc: 5, max: 18, turn: 1.5, hp: 260, slip: 0.78, kind: 4 },
  { n: "School Bus", l: 10, w: 2.6, h: 3.2, cols: ["#f4b400"], acc: 4.5, max: 17, turn: 1.3, hp: 300, slip: 0.78, kind: 5 },
  { n: "SUV", l: 4.7, w: 2.2, h: 1.8, cols: ["#222222", "#ffffff", "#3b5998", "#556b2f"], acc: 10, max: 27, turn: 2.1, hp: 180, slip: 0.8, kind: 6 },
];
export const BCOL = ["#c9b79c", "#a7b8c8", "#d8c3a5", "#b0a8b9", "#9fb8a0", "#d4a59a", "#8fa3b5", "#e0d6c2", "#b5835a", "#7f8fa6", "#c8d6e5", "#9c8fd6", "#e17055", "#7fcfcf", "#dfe6e9", "#f0c27b"];
export const SHIRTS = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22", "#1abc9c", "#ecf0f1", "#34495e", "#ff7eb6", "#f5f5f5"];
export const PANTS = ["#2c3e50", "#34495e", "#5d4037", "#1f3a93", "#222222", "#7f8c8d", "#f5f5f5"];
export const SKIN = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac"];
export const HAIR = ["#2b1b10", "#000000", "#6b4423", "#c0392b", "#fafafa"];

// ---------- world ----------
export function solidAt(B: Block[], x: number, z: number): boolean {
  if (x < 0 || z < 0 || x > WORLD || z > WORLD) return true;
  const bx = Math.floor(x / BS), bz = Math.floor(z / BS);
  if (bx >= NB || bz >= NB || x - bx * BS < RW || z - bz * BS < RW) return false;
  for (const s of B[bz * NB + bx].solids) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return true;
  return false;
}
export function solidAtH(B: Block[], x: number, z: number, y: number): boolean {
  if (x < 0 || z < 0 || x > WORLD || z > WORLD) return false;
  const bx = Math.floor(x / BS), bz = Math.floor(z / BS);
  if (bx >= NB || bz >= NB || x - bx * BS < RW || z - bz * BS < RW) return false;
  for (const s of B[bz * NB + bx].solids) if (y < s.h + 0.3 && x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return true;
  return false;
}
export function moveCircle(B: Block[], o: Pt, dx: number, dz: number, r: number): void {
  const nx = o.x + dx; if (!solidAt(B, nx + Math.sign(dx) * r, o.z)) o.x = nx;
  const nz = o.z + dz; if (!solidAt(B, o.x, nz + Math.sign(dz) * r)) o.z = nz;
}
export function carHit(B: Block[], c: Car, x: number, z: number, a: number): boolean {
  const ca = Math.cos(a), sa = Math.sin(a), hl = c.t.l / 2, hw = c.t.w / 2;
  const pts = [hl, hw, hl, -hw, -hl, hw, -hl, -hw, hl, 0, -hl, 0, 0, hw, 0, -hw];
  for (let i = 0; i < pts.length; i += 2) { const lx = pts[i], lz = pts[i + 1]; if (solidAt(B, x + lx * ca - lz * sa, z + lx * sa + lz * ca)) return true; }
  return false;
}
export function inCar(c: Car, x: number, z: number, m: number): boolean {
  const dx = x - c.x, dz = z - c.z; if (Math.abs(dx) > 8 || Math.abs(dz) > 8) return false;
  const ca = Math.cos(c.a), sa = Math.sin(c.a);
  return Math.abs(dx * ca + dz * sa) < c.t.l / 2 + m && Math.abs(-dx * sa + dz * ca) < c.t.w / 2 + m;
}
export function inG(i: number, j: number): boolean { return i >= 0 && j >= 0 && i <= NB && j <= NB; }
export function lanePt(c: Car, i: number, j: number, d: number, al: number): void { c.wx = i * BS + RW / 2 + DX[d] * al - DY[d] * LO; c.wz = j * BS + RW / 2 + DY[d] * al + DX[d] * LO; }
export function cornX(bx: number, k: number): number { return k === 1 || k === 2 ? (bx + 1) * BS - 1.5 : bx * BS + RW + 1.5; }
export function cornZ(by: number, k: number): number { return k >= 2 ? (by + 1) * BS - 1.5 : by * BS + RW + 1.5; }

// ---------- game helpers ----------
export function addP(g: Game, x: number, y: number, z: number, vx: number, vy: number, vz: number, l: number, s: number, c: V3, em: number, gr: number): void {
  if (g.parts.length > 260) return; g.parts.push({ x, y, z, vx, vy, vz, l, ml: l, s, c, em, g: gr });
}
export function sparks(g: Game, x: number, y: number, z: number, n: number): void { for (let i = 0; i < n; i++) addP(g, x, y, z, rr(-4, 4), rr(1, 5), rr(-4, 4), rr(0.15, 0.35), 0.08, [1, 0.85, 0.3], 1, 12); }
export function msg(g: Game, s: string): void { g.msgs.push({ s, l: 2.6 }); if (g.msgs.length > 3) g.msgs.shift(); }
export function stars(g: Game): number { return Math.ceil(g.wanted - 0.001); }
export function crime(g: Game, a: number): void { const b = stars(g); g.wanted = Math.min(5, g.wanted + a); g.calm = 0; if (stars(g) > b) { msg(g, "Police are after you! ★" + stars(g)); if (b === 0) { g.b.mem.chase++; bLine(g, "chase", 20); } } }
export function noise(g: Game, x: number, z: number, r: number): void {
  for (const e of g.peds) if (e.dead <= 0 && Math.abs(e.x - x) < r && Math.abs(e.z - z) < r) { e.flee = rr(4, 8); e.fx = x; e.fz = z; }
  for (const a of g.ans) if (a.dead <= 0 && Math.abs(a.x - x) < r && Math.abs(a.z - z) < r) { a.st = 1; a.fx = x; a.fz = z; a.t = a.k === 1 ? 0 : rr(2, 4); if (a.k === 1) a.a = Math.atan2(a.z - z, a.x - x) + rr(-0.5, 0.5); }
}
export function copNear(g: Game, r: number): boolean { for (const c of g.cars) if (c.t.kind === 3 && c.dead <= 0 && c.drv !== 2 && Math.hypot(c.x - g.p.x, c.z - g.p.z) < r) return true; return false; }
export function hurtPlayer(g: Game, d: number): void {
  const p = g.p; if (p.dead > 0) return; p.hp -= d; g.hurtT = 0.4;
  if (p.hp <= 0) { p.hp = 0; p.dead = 4; if (p.car) { p.car.drv = 0; p.car = null; } msg(g, "WASTED"); }
}
export function hurtPed(g: Game, e: Ped, d: number, byP: boolean, fx: number, fz: number): void {
  if (e.dead > 0) return; e.hp -= d;
  const dx = e.x - fx, dz = e.z - fz, dd = Math.hypot(dx, dz) || 1, kb = Math.min(8, d / 8);
  e.vx += (dx / dd) * kb; e.vz += (dz / dd) * kb;
  for (let i = 0; i < 4; i++) addP(g, e.x, 1.2, e.z, rr(-2, 2), rr(1, 3), rr(-2, 2), 0.4, 0.12, [1, 0.95, 0.5], 1, 6);
  if (e.hp <= 0) { e.dead = 0.001; if (byP) crime(g, 0.5); if (R() < 0.7) g.picks.push({ x: e.x, z: e.z, k: 2, w: 0, resp: 0, tmp: true, amt: Math.floor(rr(5, 60)) }); noise(g, e.x, e.z, 30); }
  else { if (byP) crime(g, 0.15); e.flee = rr(5, 9); e.fx = fx; e.fz = fz; }
}
export function explode(g: Game, x: number, y: number, z: number, byP: boolean): void {
  const p = g.p; HOOK.ev("boom", x, y, z, 0);
  g.shake = Math.max(g.shake, 0.7 * clamp(1 - Math.hypot(x - p.x, z - p.z) / 90, 0.1, 1)); g.flash = 0.18;
  const fire: V3[] = [[1, 0.7, 0.1], [1, 0.45, 0.05], [1, 0.85, 0.3], [1, 0.25, 0]];
  for (let i = 0; i < 26; i++) { const a = R() * TAU, s = rr(3, 11); addP(g, x, y + 0.5, z, Math.cos(a) * s, rr(1, 8), Math.sin(a) * s, rr(0.4, 0.9), rr(0.5, 1.2), pick(fire), 1, -1); }
  for (let i = 0; i < 14; i++) addP(g, x + rr(-1, 1), y + 1, z + rr(-1, 1), rr(-1.5, 1.5), rr(2, 4), rr(-1.5, 1.5), rr(1.5, 2.5), rr(0.8, 1.6), [0.3, 0.3, 0.3], 0, -0.5);
  for (let i = 0; i < 10; i++) addP(g, x, y + 0.5, z, rr(-8, 8), rr(4, 10), rr(-8, 8), rr(1, 2), rr(0.2, 0.4), [0.15, 0.15, 0.15], 0, 15);
  for (const e of g.peds) { const d = Math.hypot(e.x - x, e.z - z); if (d < 8) hurtPed(g, e, 260 * (1 - d / 8), byP, x, z); }
  for (const a of g.ans) if (a.dead <= 0 && a.y < 1 && Math.hypot(a.x - x, a.z - z) < 7) a.dead = 0.001;
  for (const c of g.cars) { if (c.dead > 0) continue; const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz) || 1; if (d < 9) { c.vx += (dx / d) * 10 * (1 - d / 9); c.vz += (dz / d) * 10 * (1 - d / 9); c.knock = 1; damageCar(g, c, 170 * (1 - d / 9), byP); } }
  const pd = Math.hypot(p.x - x, p.z - z); if (pd < 8) hurtPlayer(g, 90 * (1 - pd / 8));
  bBoom(g, x, z);
  noise(g, x, z, 60);
}
export function damageCar(g: Game, c: Car, d: number, byP: boolean): void {
  if (c.dead > 0) return; c.hp -= d;
  if (byP && c.drv === 1) c.panic = 6;
  if (byP && c.t.kind === 3 && c.drv !== 2) crime(g, 0.08);
  if (c.hp <= 0) { c.dead = 0.001; c.hp = 0; if (byP) crime(g, c.t.kind === 3 ? 1 : 0.4); if (c === g.p.car) g.p.car = null; c.drv = 0; explode(g, c.x, 0.5, c.z, byP); }
}
export function mkCar(ti: number, x: number, z: number, a: number, drv: number): Car {
  const t = CTS[ti];
  return { t, x, z, a, pa: a, vx: 0, vz: 0, hp: t.hp, col: hex(pick(t.cols)), drv, park: false, ix: 0, iy: 0, dir: 0, st: 0, wx: x, wz: z, dead: 0, steer: 0, stuck: 0, ign: 0, rev: 0, panic: 0, knock: 0, brake: false, cd: 1 };
}
export function mkPed(x: number, z: number, bx: number, by: number): Ped {
  return { x, z, a: 0, vx: 0, vz: 0, hp: 60, sh: hex(pick(SHIRTS)), pa: hex(pick(PANTS)), sk: hex(pick(SKIN)), ha: hex(pick(HAIR)), ph: R() * 6, mv: 0, bx, by, k: 0, dirs: R() < 0.5 ? 1 : -1, tx: x, tz: z, flee: 0, fx: 0, fz: 0, dead: 0, spd: rr(1.1, 1.7) };
}
export function resetPath(e: Ped): void {
  const bx = clamp(Math.floor(e.x / BS), 0, NB - 1), by = clamp(Math.floor(e.z / BS), 0, NB - 1);
  let best = 0, bd = 1e9;
  for (let k = 0; k < 4; k++) { const d = Math.hypot(cornX(bx, k) - e.x, cornZ(by, k) - e.z); if (d < bd) { bd = d; best = k; } }
  e.bx = bx; e.by = by; e.k = best; e.tx = cornX(bx, best); e.tz = cornZ(by, best);
}
export function arriveCorner(e: Ped): void {
  const kn = e.k;
  if (R() < 0.25) {
    let nbx = e.bx, nby = e.by, nk = kn;
    if (R() < 0.5) { if (kn === 1 || kn === 2) { nbx++; nk = kn === 1 ? 0 : 3; } else { nbx--; nk = kn === 0 ? 1 : 2; } }
    else { if (kn === 0 || kn === 1) { nby--; nk = kn === 0 ? 3 : 2; } else { nby++; nk = kn === 3 ? 0 : 1; } }
    if (nbx >= 0 && nby >= 0 && nbx < NB && nby < NB) { e.bx = nbx; e.by = nby; e.k = nk; e.tx = cornX(nbx, nk); e.tz = cornZ(nby, nk); return; }
  }
  e.k = (kn + e.dirs + 4) % 4; e.tx = cornX(e.bx, e.k); e.tz = cornZ(e.by, e.k);
}
export function trafficType(): number { const v = R(); return v < 0.33 ? 0 : v < 0.45 ? 1 : v < 0.58 ? 2 : v < 0.63 ? 3 : v < 0.72 ? 4 : v < 0.8 ? 5 : 6; }
export function spawnCar(g: Game, init: boolean, police: boolean, parked: boolean): boolean {
  const p = g.p, pi = Math.round((p.x - RW / 2) / BS), pj = Math.round((p.z - RW / 2) / BS);
  const i = clamp(pi + Math.floor(rr(-3, 4)), 0, NB), j = clamp(pj + Math.floor(rr(-3, 4)), 0, NB);
  const dirs = [0, 1, 2, 3].filter((d: number) => inG(i + DX[d], j + DY[d]));
  const d = pick(dirs);
  const along = parked ? RW / 2 + 6 + R() * (BS - RW - 12) : RW / 2 + 2 + R() * (BS - RW - 4);
  const off = parked ? RW / 2 - 1.2 : LO;
  const x = i * BS + RW / 2 + DX[d] * along - DY[d] * off, z = j * BS + RW / 2 + DY[d] * along + DX[d] * off;
  const pd = Math.hypot(x - p.x, z - p.z);
  if ((!init && pd < 70) || pd > 170) return false;
  for (const o of g.cars) if (Math.abs(o.x - x) < 9 && Math.abs(o.z - z) < 9) return false;
  const ti = police ? 3 : parked ? pick([0, 0, 1, 2, 6]) : trafficType();
  const c = mkCar(ti, x, z, Math.atan2(DY[d], DX[d]), parked ? 0 : police ? 3 : 1);
  c.park = parked; c.ix = i + DX[d]; c.iy = j + DY[d]; c.dir = d; c.st = 0; lanePt(c, c.ix, c.iy, d, -RW / 2 - 1);
  g.cars.push(c); return true;
}
export function snapAI(c: Car): void {
  const d = ((Math.round(c.a / (Math.PI / 2)) % 4) + 4) % 4;
  const fx = (c.x - RW / 2) / BS, fz = (c.z - RW / 2) / BS;
  c.ix = clamp(d === 0 ? Math.ceil(fx + 0.05) : d === 2 ? Math.floor(fx - 0.05) : Math.round(fx), 0, NB);
  c.iy = clamp(d === 1 ? Math.ceil(fz + 0.05) : d === 3 ? Math.floor(fz - 0.05) : Math.round(fz), 0, NB);
  c.dir = d; c.st = 0; lanePt(c, c.ix, c.iy, d, -RW / 2 - 1);
}
export function spawnPed(g: Game, init: boolean): boolean {
  const p = g.p, pbx = Math.floor(p.x / BS), pby = Math.floor(p.z / BS);
  const bx = clamp(pbx + Math.floor(rr(-2, 3)), 0, NB - 1), by = clamp(pby + Math.floor(rr(-2, 3)), 0, NB - 1);
  const k = Math.floor(R() * 4), k2 = (k + 1) % 4, u = R();
  const x = cornX(bx, k) + (cornX(bx, k2) - cornX(bx, k)) * u, z = cornZ(by, k) + (cornZ(by, k2) - cornZ(by, k)) * u;
  const pd = Math.hypot(x - p.x, z - p.z);
  if ((!init && pd < 50) || pd > 150) return false;
  const e = mkPed(x, z, bx, by); e.k = e.dirs === 1 ? k2 : k; e.tx = cornX(bx, e.k); e.tz = cornZ(by, e.k);
  g.peds.push(e); return true;
}
export function spawnAni(g: Game, init: boolean): boolean {
  const p = g.p, pbx = Math.floor(p.x / BS), pby = Math.floor(p.z / BS);
  const bx = clamp(pbx + Math.floor(rr(-2, 3)), 0, NB - 1), by = clamp(pby + Math.floor(rr(-2, 3)), 0, NB - 1);
  const b = g.B[by * NB + bx];
  let k = 0; if (b.k === 0) { if (R() < 0.6) return false; } else k = R() < 0.6 ? 1 : 0;
  const m = b.k === 0 ? 0.8 : SWK, hx = b.x + m, hz = b.z + m, hs = b.s - 2 * m;
  const x = hx + R() * hs, z = hz + R() * hs;
  if (solidAt(g.B, x, z)) return false;
  const pd = Math.hypot(x - p.x, z - p.z); if ((!init && pd < 45) || pd > 150) return false;
  const c = k === 0 ? hex(pick(["#8d6e63", "#d7a86e", "#3e2723", "#f5f5f5"])) : hex(pick(["#78909c", "#5d4037", "#eceff1"]));
  g.ans.push({ k, x, y: 0, z, a: R() * TAU, ph: R() * 6, st: 0, t: rr(1, 4), tx: x, tz: z, hx, hz, hs, fx: 0, fz: 0, dead: 0, c, mv: 0 });
  return true;
}
export const HOSP: Pt = { x: 3 * BS + RW + 1.5, z: 4 * BS + RW + 6 };
export function newGame(B: Block[], mini: HTMLCanvasElement): Game {
  const g: Game = { B, cars: [], peds: [], ans: [], parts: [], trc: [], picks: [], p: { x: HOSP.x, y: 0, z: HOSP.z, vy: 0, a: 0, hp: 100, money: 500, w: 1, ammo: WP.map((w: Wpn, i: number) => (i === 1 ? 60 : 0)), has: WP.map((w: Wpn, i: number) => i < 2), car: null, ph: 0, mv: 0, cd: 0, dead: 0, punch: 0 }, yaw: Math.PI / 2, pitch: 0.3, ldx: 0, ldy: 0, lookT: 9, ex: 0, ey: 0, ez: 0, tx: 0, ty: 0, tz: 0, t: 0, keys: new Set<string>(), mDown: false, rDown: false, locked: false, aiming: false, fireT: 0, jumpReq: false, shake: 0, hurtT: 0, flash: 0, msgs: [], started: false, ever: false, big: false, spawnT: 0, polT: 0, wanted: 0, calm: 0, pad: { on: false, lx: 0, ly: 0, rx: 0, ry: 0, r2: 0, l2: 0, cross: false, square: false, l3: false, prev: [] }, mini, aimP: 0, b: mkBud(HOSP.x + 1.5, HOSP.z - 2.5), pv: m4(), inside: false, ui: false, menuCam: true };
  const r = rng(99);
  for (let i = 0; i < 80; i++) {
    const bx = Math.floor(r() * NB), by = Math.floor(r() * NB), k = Math.floor(r() * 4), u = r();
    const x = cornX(bx, k) + (cornX(bx, (k + 1) % 4) - cornX(bx, k)) * u, z = cornZ(by, k) + (cornZ(by, (k + 1) % 4) - cornZ(by, k)) * u;
    const v = r(); g.picks.push({ x, z, k: v < 0.6 ? 0 : v < 0.8 ? 1 : 2, w: 1 + Math.floor(r() * 6), resp: 0, tmp: false, amt: 0 });
  }
  for (let i = 0; i < 5; i++) g.picks.push({ x: HOSP.x, z: HOSP.z + 4 + i * 3.5, k: 0, w: 2 + i, resp: 0, tmp: false, amt: 0 });
  return g;
}
export function toggleCar(g: Game): void {
  const p = g.p; if (p.dead > 0) return;
  if (p.car) {
    const c = p.car, ca = Math.cos(c.a), sa = Math.sin(c.a); let ok = false;
    for (const s of [-1, 1]) { const ex = c.x - sa * s * (c.t.w / 2 + 1), ez = c.z + ca * s * (c.t.w / 2 + 1); if (!solidAt(g.B, ex, ez)) { p.x = ex; p.z = ez; ok = true; break; } }
    if (!ok) { p.x = c.x - ca * (c.t.l / 2 + 1); p.z = c.z - sa * (c.t.l / 2 + 1); }
    c.drv = 0; p.car = null; p.y = 0; bOnExit(g, c); return;
  }
  let best: Car | null = null, bd = 1e9;
  for (const c of g.cars) { if (c.dead > 0) continue; const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < c.t.l / 2 + 2.5 && d < bd) { bd = d; best = c; } }
  if (!best) return;
  if (best === g.b.car) { bLeaveCar(g, g.b); bLine(g, "snatched", 10); }
  if (best.drv === 1 || best.drv === 3) {
    const e = mkPed(best.x - Math.sin(best.a) * 2.5, best.z + Math.cos(best.a) * 2.5, 0, 0); resetPath(e); e.flee = 6; e.fx = p.x; e.fz = p.z; g.peds.push(e);
    if (best.t.kind === 3 || copNear(g, 40)) crime(g, 1);
  }
  best.drv = 2; best.park = false; p.car = best; msg(g, "Car: " + best.t.n); bOnEnter(g);
}
export function cycleW(g: Game, d: number): void { const p = g.p; for (let i = 1; i <= WP.length; i++) { const n = (p.w + d * i + WP.length * 3) % WP.length; if (p.has[n] && (n === 0 || p.ammo[n] > 0)) { p.w = n; msg(g, WP[n].n); return; } } }
export function selW(g: Game, i: number): void { const p = g.p; if (i >= 0 && i < WP.length && p.has[i] && (i === 0 || p.ammo[i] > 0)) { p.w = i; msg(g, WP[i].n); } }

// ---------- hitscan ----------
export function slab(o: number, d: number, a: number, b: number, r: number[]): boolean {
  if (Math.abs(d) < 1e-8) return o >= a && o <= b;
  let t1 = (a - o) / d, t2 = (b - o) / d; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
  if (t1 > r[0]) r[0] = t1; if (t2 < r[1]) r[1] = t2; return r[0] <= r[1];
}
export function rayBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): number {
  const r = [0, 1e9]; if (!slab(ox, dx, x0, x1, r) || !slab(oy, dy, y0, y1, r) || !slab(oz, dz, z0, z1, r)) return -1; return r[0];
}
export type Hit = { t: number; k: number; ped: Ped | null; car: Car | null; an: Ani | null };
export function hitscan(g: Game, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tmin: number, tmax: number): Hit {
  const h: Hit = { t: tmax, k: 0, ped: null, car: null, an: null };
  if (dy < 0) { const t = -oy / dy; if (t > tmin && t < h.t) { h.t = t; h.k = 1; } }
  for (const b of g.B) for (const s of b.solids) { const t = rayBox(ox, oy, oz, dx, dy, dz, s.x0, 0, s.z0, s.x1, s.h, s.z1); if (t > tmin && t < h.t) { h.t = t; h.k = 1; } }
  for (const e of g.peds) { if (e.dead > 0) continue; const t = rayBox(ox, oy, oz, dx, dy, dz, e.x - 0.4, 0, e.z - 0.4, e.x + 0.4, 1.9, e.z + 0.4); if (t > tmin && t < h.t) { h.t = t; h.k = 2; h.ped = e; } }
  for (const a of g.ans) { if (a.dead > 0) continue; const t = rayBox(ox, oy, oz, dx, dy, dz, a.x - 0.5, a.y, a.z - 0.5, a.x + 0.5, a.y + 1, a.z + 0.5); if (t > tmin && t < h.t) { h.t = t; h.k = 4; h.an = a; } }
  for (const c of g.cars) {
    if (c === g.p.car) continue; const ca = Math.cos(c.a), sa = Math.sin(c.a), rx0 = ox - c.x, rz0 = oz - c.z;
    const lx = rx0 * ca + rz0 * sa, lz = -rx0 * sa + rz0 * ca, ldx = dx * ca + dz * sa, ldz = -dx * sa + dz * ca;
    const t = rayBox(lx, oy, lz, ldx, dy, ldz, -c.t.l / 2, 0, -c.t.w / 2, c.t.l / 2, c.t.h + 0.4, c.t.w / 2);
    if (t > tmin && t < h.t) { h.t = t; h.k = 3; h.car = c; }
  }
  return h;
}
export function shoot(g: Game): void {
  const p = g.p, w = WP[p.w];
  if (p.w > 0 && p.ammo[p.w] <= 0) { msg(g, "Out of ammo!"); p.w = 0; return; }
  p.cd = w.cd; g.fireT = 0.7;
  if (w.pel === 0) {
    if (p.car) return; p.punch = 0.25; HOOK.ev("punch", p.x, 1.4, p.z, 0); p.a = g.yaw;
    const hx = p.x + Math.cos(p.a) * 1.1, hz = p.z + Math.sin(p.a) * 1.1;
    for (const e of g.peds) if (e.dead <= 0 && Math.hypot(e.x - hx, e.z - hz) < 1.2) { hurtPed(g, e, w.dmg, true, p.x, p.z); break; }
    for (const a of g.ans) if (a.dead <= 0 && a.y < 1 && Math.hypot(a.x - hx, a.z - hz) < 1.2) a.dead = 0.001;
    return;
  }
  p.ammo[p.w]--; HOOK.ev("gun", p.x, 1.5, p.z, p.w);
  let dx = g.tx - g.ex, dy = g.ty - g.ey, dz = g.tz - g.ez; const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
  if (!p.car) p.a = g.yaw;
  const aimP = Math.atan2(dy, Math.hypot(dx, dz)); g.aimP = aimP;
  let mx = 0, my = 1.6, mz = 0;
  if (p.car) { mx = p.car.x; mz = p.car.z; }
  else { const q = MZ[p.w], gf = gunFrame(p.x, p.y + 0.1, p.z, p.a, aimP); mx = gf[0] * q[0] + gf[4] * q[1] + gf[12]; my = gf[1] * q[0] + gf[5] * q[1] + gf[13]; mz = gf[2] * q[0] + gf[6] * q[1] + gf[14]; }
  for (let i = 0; i < w.pel; i++) {
    let ddx = dx + rr(-1, 1) * w.spr, ddy = dy + rr(-1, 1) * w.spr, ddz = dz + rr(-1, 1) * w.spr; const l = Math.hypot(ddx, ddy, ddz); ddx /= l; ddy /= l; ddz /= l;
    const h = hitscan(g, g.ex, g.ey, g.ez, ddx, ddy, ddz, dl * 0.8, w.range);
    const hx = g.ex + ddx * h.t, hy = g.ey + ddy * h.t, hz = g.ez + ddz * h.t;
    g.trc.push({ x1: mx, y1: my, z1: mz, x2: hx, y2: hy, z2: hz, l: w.boom ? 0.25 : 0.06, c: w.boom ? [1, 0.6, 0.2] : [1, 0.9, 0.5] });
    if (w.boom) { if (h.k > 0 || h.t < w.range) explode(g, hx, hy, hz, true); continue; }
    if (h.k === 2 && h.ped) { hurtPed(g, h.ped, w.dmg, true, p.x, p.z); g.b.tgtP = h.ped; }
    else if (h.k === 3 && h.car) { damageCar(g, h.car, w.dmg * 0.6, true); sparks(g, hx, hy, hz, 3); }
    else if (h.k === 4 && h.an) h.an.dead = 0.001;
    else if (h.k === 1) sparks(g, hx, hy, hz, 3);
  }
  addP(g, mx, my, mz, 0, 0, 0, 0.05, 0.35, [1, 0.9, 0.5], 1.5, 0);
  g.shake = Math.max(g.shake, w.boom ? 0.25 : w.pel > 1 ? 0.2 : 0.06);
  noise(g, p.x, p.z, 40);
  if (stars(g) === 0 && copNear(g, 40)) crime(g, 1);
}

// ---------- vehicles ----------
export function moveCar(g: Game, c: Car, dt: number): void {
  if (carHit(g.B, c, c.x, c.z, c.a) && !carHit(g.B, c, c.x, c.z, c.pa)) c.a = c.pa;
  const nx = c.x + c.vx * dt, nz = c.z + c.vz * dt;
  if (!carHit(g.B, c, nx, nz, c.a) || carHit(g.B, c, c.x, c.z, c.a)) { c.x = nx; c.z = nz; return; }
  const sp = Math.hypot(c.vx, c.vz);
  if (sp > 8) { damageCar(g, c, (sp - 8) * 3, c === g.p.car); sparks(g, c.x + c.vx * 0.15, 0.7, c.z + c.vz * 0.15, 5); if (c === g.p.car) { g.shake = Math.max(g.shake, sp * 0.02); bCrash(g, sp); } HOOK.ev("crash", c.x, 0.6, c.z, sp); }
  if (!carHit(g.B, c, nx, c.z, c.a)) { c.x = nx; c.vz *= -0.3; c.vx *= 0.9; }
  else if (!carHit(g.B, c, c.x, nz, c.a)) { c.z = nz; c.vx *= -0.3; c.vz *= 0.9; }
  else { c.vx *= -0.35; c.vz *= -0.35; }
}
export function driveCar(g: Game, c: Car, thr: number, st: number, hb: boolean, dt: number): void {
  const t = c.t, ca = Math.cos(c.a), sa = Math.sin(c.a);
  let vf = c.vx * ca + c.vz * sa, vs = -c.vx * sa + c.vz * ca;
  c.brake = false;
  if (thr > 0) vf += (vf < 0 ? t.acc * 2.5 : t.acc) * thr * dt;
  else if (thr < 0) { if (vf > 0.5) { vf -= 22 * dt * -thr; c.brake = true; } else vf -= t.acc * 0.7 * -thr * dt; }
  else vf *= Math.pow(0.7, dt);
  vf = clamp(vf, -t.max * 0.4, t.max);
  if (hb) { vf *= Math.pow(0.3, dt); c.brake = true; }
  vs *= Math.pow(hb ? 0.97 : t.slip, dt * 60);
  c.vx = ca * vf - sa * vs; c.vz = sa * vf + ca * vs;
  const spdN = clamp(Math.abs(vf) / t.max, 0, 1), tgtS = st * (1 - 0.5 * spdN);
  c.steer += (tgtS - c.steer) * Math.min(1, dt * (st === 0 ? 12 : 7));
  c.a += c.steer * t.turn * clamp(vf / 6, -1, 1) * dt * (hb ? 1.5 : 1);
  if ((Math.abs(vs) > 3 || (hb && Math.abs(vf) > 6)) && R() < 0.5) addP(g, c.x - ca * c.t.l * 0.4, 0.2, c.z - sa * c.t.l * 0.4, rr(-0.5, 0.5), rr(0.5, 1.5), rr(-0.5, 0.5), 0.8, 0.5, [0.75, 0.75, 0.75], 0, -0.5);
  moveCar(g, c, dt);
}
export function blockedAhead(g: Game, c: Car, sp: number): boolean {
  const ca = Math.cos(c.a), sa = Math.sin(c.a), look = c.t.l / 2 + 3 + sp * 0.6;
  for (const o of g.cars) {
    if (o === c) continue; const dx = o.x - c.x, dz = o.z - c.z;
    if (Math.abs(dx) > look + 6 || Math.abs(dz) > look + 6) continue;
    const fw = dx * ca + dz * sa; if (fw <= 0 || fw > look + o.t.l / 2) continue;
    if (Math.abs(-dx * sa + dz * ca) < (c.t.w + o.t.w) / 2 + 0.5) return true;
  }
  const chk = (x: number, z: number): boolean => { const dx = x - c.x, dz = z - c.z; if (Math.abs(dx) > 10 || Math.abs(dz) > 10) return false; const fw = dx * ca + dz * sa; return fw > 0 && fw < c.t.l / 2 + 4 && Math.abs(-dx * sa + dz * ca) < c.t.w / 2 + 1; };
  for (const e of g.peds) if (e.dead <= 0 && chk(e.x, e.z)) return true;
  if (!g.p.car && g.p.dead <= 0 && chk(g.p.x, g.p.z)) return true;
  return false;
}
export function nextWp(g: Game, c: Car, chase: boolean): void {
  if (c.st === 0) {
    const d = c.dir; const base = chase ? [d, (d + 1) % 4, (d + 3) % 4, (d + 2) % 4] : [d, (d + 1) % 4, (d + 3) % 4];
    let opts = base.filter((n: number) => inG(c.ix + DX[n], c.iy + DY[n]));
    if (!opts.length) opts = [(d + 2) % 4];
    let nd = opts[0];
    if (chase) { let bd = 1e9; for (const n of opts) { const dd = Math.hypot((c.ix + DX[n]) * BS + RW / 2 - g.p.x, (c.iy + DY[n]) * BS + RW / 2 - g.p.z); if (dd < bd) { bd = dd; nd = n; } } }
    else nd = R() < 0.5 && opts.indexOf(d) >= 0 ? d : pick(opts);
    c.dir = nd; c.st = 1; lanePt(c, c.ix, c.iy, nd, RW / 2 + 1);
  } else { c.ix += DX[c.dir]; c.iy += DY[c.dir]; c.st = 0; lanePt(c, c.ix, c.iy, c.dir, -RW / 2 - 1); }
}
export function aiDrive(g: Game, c: Car, dt: number, chase: boolean): void {
  if (c.knock > 0) { c.knock -= dt; const f = Math.pow(0.1, dt); c.vx *= f; c.vz *= f; moveCar(g, c, dt); if (c.knock <= 0) snapAI(c); return; }
  const p = g.p; let tx = c.wx, tz = c.wz;
  const pd = Math.hypot(p.x - c.x, p.z - c.z), seek = chase && pd < 40;
  if (seek) { tx = p.x; tz = p.z; }
  else { const ah = (c.wx - c.x) * DX[c.dir] + (c.wz - c.z) * DY[c.dir]; if (ah < 1) { nextWp(g, c, chase); tx = c.wx; tz = c.wz; } else if (Math.hypot(c.wx - c.x, c.wz - c.z) > BS * 1.6) { snapAI(c); tx = c.wx; tz = c.wz; } }
  if (c.rev > 0) { c.rev -= dt; c.a += 1.2 * dt; c.vx = -Math.cos(c.a) * 4; c.vz = -Math.sin(c.a) * 4; moveCar(g, c, dt); return; }
  let sp = Math.hypot(c.vx, c.vz);
  const diff = angDiff(Math.atan2(tz - c.z, tx - c.x), c.a), trn = c.t.turn * 1.3 * dt * clamp(sp / 4, 0.3, 1.5);
  c.a += clamp(diff, -trn, trn); c.steer = clamp(diff * 2, -1, 1);
  let tgt = chase ? c.t.max * 0.85 : c.t.max * (c.panic > 0 ? 0.8 : 0.4);
  if (Math.abs(diff) > 0.5) tgt *= 0.5;
  if (seek && !p.car && pd < 9) tgt = 0;
  if (c.ign > 0) c.ign -= dt; else if (!seek && blockedAhead(g, c, sp)) tgt = 0;
  if (sp > tgt) { sp = Math.max(tgt, sp - 18 * dt); c.brake = true; } else { sp = Math.min(tgt, sp + c.t.acc * dt); c.brake = false; }
  if (sp < 0.5) c.stuck += dt; else c.stuck = 0;
  if (c.stuck > 3) { c.stuck = 0; if (seek || tgt > 0) c.rev = 1; else c.ign = 1.5; }
  c.vx = Math.cos(c.a) * sp; c.vz = Math.sin(c.a) * sp;
  moveCar(g, c, dt);
  if (chase && c.drv === 3 && stars(g) >= 2 && pd < 30 && p.dead <= 0) {
    c.cd -= dt;
    if (c.cd <= 0) { c.cd = rr(1, 1.8); HOOK.ev("npcgun", c.x, 1.7, c.z, 1); const hit = R() < 0.45; const ox = p.x + (hit ? 0 : rr(-2, 2)), oz = p.z + (hit ? 0 : rr(-2, 2)); g.trc.push({ x1: c.x, y1: 1.7, z1: c.z, x2: ox, y2: 1.2, z2: oz, l: 0.07, c: [1, 0.5, 0.4] }); addP(g, c.x, 1.7, c.z, 0, 0, 0, 0.05, 0.3, [1, 0.9, 0.5], 1.5, 0); if (hit) { if (p.car) damageCar(g, p.car, 6, false); else hurtPlayer(g, 7); } }
  }
}
export function carPairs(g: Game, list: Car[]): void {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j], dx = b.x - a.x, dz = b.z - a.z, lim = (a.t.l + b.t.l) / 2;
      if (dx > lim || dx < -lim || dz > lim || dz < -lim) continue;
      const ra = a.t.w / 2 + 0.1, rb = b.t.w / 2 + 0.1, oa = Math.max(0, a.t.l / 2 - ra), ob = Math.max(0, b.t.l / 2 - rb);
      const na = a.t.l > 6 ? 3 : 2, nb = b.t.l > 6 ? 3 : 2;
      let best = 0, nx = 0, nz = 0;
      for (let u = 0; u < na; u++) { const ta = -oa + (2 * oa * u) / (na - 1), ax = a.x + Math.cos(a.a) * ta, az = a.z + Math.sin(a.a) * ta;
        for (let v = 0; v < nb; v++) { const tb = -ob + (2 * ob * v) / (nb - 1), bx = b.x + Math.cos(b.a) * tb, bz = b.z + Math.sin(b.a) * tb;
          const ddx = bx - ax, ddz = bz - az, d = Math.hypot(ddx, ddz) || 0.01, pen = ra + rb - d; if (pen > best) { best = pen; nx = ddx / d; nz = ddz / d; } } }
      if (best <= 0) continue;
      const ma = a.t.l * a.t.w * (a.park || a.dead > 0 ? 2 : 1), mb = b.t.l * b.t.w * (b.park || b.dead > 0 ? 2 : 1), fa = mb / (ma + mb), fb = ma / (ma + mb);
      const ax0 = a.x, az0 = a.z, bx0 = b.x, bz0 = b.z;
      a.x -= nx * best * fa; a.z -= nz * best * fa; b.x += nx * best * fb; b.z += nz * best * fb;
      if (carHit(g.B, a, a.x, a.z, a.a)) { a.x = ax0; a.z = az0; }
      if (carHit(g.B, b, b.x, b.z, b.a)) { b.x = bx0; b.z = bz0; }
      const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rel < 0) {
        const jj = (-1.3 * rel) / (1 / ma + 1 / mb);
        a.vx -= (jj / ma) * nx; a.vz -= (jj / ma) * nz; b.vx += (jj / mb) * nx; b.vz += (jj / mb) * nz;
        const pl = a === g.p.car || b === g.p.car;
        if (-rel > 3) for (const c of [a, b]) if (c.drv === 1 || c.drv === 0) { c.knock = 0.8; if (pl && c.drv === 1) c.panic = 6; }
        if (-rel > 5) { damageCar(g, a, -rel * 3, pl); damageCar(g, b, -rel * 3, pl); sparks(g, (a.x + b.x) / 2, 0.8, (a.z + b.z) / 2, 6); if (pl) { g.shake = Math.max(g.shake, -rel * 0.02); bCrash(g, -rel * 2); } HOOK.ev("crash", a.x, 0.6, a.z, -rel); }
      }
    }
  }
}

// ---------- gamepad ----------
export function dz15(v: number): number { const a = Math.abs(v); return a < 0.15 ? 0 : (Math.sign(v) * (a - 0.15)) / 0.85; }
export function pollPad(g: Game): number {
  const pad = g.pad;
  const list = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
  let found: Gamepad | null = null;
  for (const q of list) if (q && q.connected) { found = q; break; }
  if (!found) { pad.on = false; pad.prev = []; return 0; }
  const gp: Gamepad = found;
  pad.on = true;
  const b = (i: number): boolean => i < gp.buttons.length && gp.buttons[i].pressed;
  const v = (i: number): number => (i < gp.buttons.length ? gp.buttons[i].value : 0);
  const ax = (i: number): number => (i < gp.axes.length ? dz15(gp.axes[i]) : 0);
  pad.lx = ax(0); pad.ly = ax(1); pad.rx = ax(2); pad.ry = ax(3);
  const r2 = Math.max(v(7), b(7) ? 1 : 0), l2 = Math.max(v(6), b(6) ? 1 : 0);
  pad.r2 = r2 < 0.05 ? 0 : r2; pad.l2 = l2 < 0.05 ? 0 : l2;
  pad.cross = b(0); pad.square = b(2); pad.l3 = b(10);
  const now: boolean[] = []; for (let i = 0; i < 18; i++) now.push(b(i));
  const edge = (i: number): boolean => now[i] && !pad.prev[i];
  let act = 0;
  if (edge(9)) act = 1; else if (!g.started && edge(0)) act = 2;
  if (g.started && (edge(8) || edge(17))) HOOK.phone();
  if (g.started && !g.ui && !g.inside) {
    if (edge(3) && !HOOK.tri()) toggleCar(g);
    if (edge(4) || edge(14)) cycleW(g, -1);
    if (edge(5) || edge(15)) cycleW(g, 1);
    if (edge(12)) g.big = !g.big;
    if (edge(13)) bMenu(g);
    if (edge(11)) micToggle(g);
    if (edge(0)) { if (g.b.menu >= 0) bConfirm(g); else if (!g.p.car) g.jumpReq = true; }
  }
  pad.prev = now;
  return act;
}

// ---------- buddy سلطان ----------
export type Bud = { x: number; z: number; a: number; ph: number; mv: number; hp: number; dead: number; mode: number; act: number; actT: number; ride: boolean; board: number; car: Car | null; wx: number; wz: number; tx: number; tz: number; cd: number; aimP: number; fireT: number; tgtP: Ped | null; cover: number; fleeT: number; fx: number; fz: number; stuck: number; side: number; hitCd: number; thr: boolean; thx: number; thz: number; crouch: boolean; sit: boolean; seated: boolean; tc: Car | null; tped: Ped | null; tpk: Pick | null; sayS: string; sayT: number; sayCd: number; keyCd: Record<string, number>; idleT: number; banT: number; crashT: number; menu: number; menuT: number; lastBlk: number; greeted: boolean; hold: boolean; guard: number; mem: { crash: number; boom: number; cops: number; money: number; chase: number; top: number } };
export const BUD_MODES = ["Follow me", "Wait here", "Go wander around", "Come here"];
export const BUD_STAT = ["following", "waiting", "wandering", "coming"];
export const BUD_STAT_AR = ["يتبعك", "ينتظر", "يتجوّل", "جايك"];
export const BUD_REPLY: string[][] = [["أبشر، وراك وراك 💪", "تم، أنا معك خطوة بخطوة"], ["تم، بستناك هنا", "طيب، لا تطوّل علي"], ["والله فكرة! بتمشّى شوي بالديرة", "أخيراً حرية 😎 بلف الديرة"], ["جايك جايك!", "لحظة، جاي لك الحين"]];
export const BL: Record<string, string[]> = {
  start: ["يالله نفزع!", "يالله يا بطل، المدينة لنا اليوم"],
  car: ["دعس يا ولد! بس بشويش علي", "ركبنا، خلنا نشوف سواقتك", "حط حزام الأمان... أمزح 😂"],
  chase: ["الشرطة ورانا! دعس!", "الدوريات وصلت! انتبه!", "شرطة! شرطة! يالله اهرب!"],
  crash: ["هدّي هدّي! صدمتنا!", "وش ذا؟! السيارة تكسرت", "يا ساتر! انتبه للطريق"],
  boom: ["انفجار!! انبطح!", "يا ويلي! وش هالانفجار", "ابعد ابعد! بتنفجر!"],
  money: ["فلوس! الله يرزقنا", "زين، عشانا عليك الليلة 💰", "حلو، زِد الرصيد"],
  low: ["دمّك قليل! دوّر لك علاج ❤️", "انتبه على نفسك، تعبان مره"],
  clear: ["هربنا منهم! الحمدلله", "ضيّعناهم، نفّس شوي 😮‍💨"],
  idle: ["وش فيك واقف؟ تبي نشرب قهوة؟", "ترى الوقت يمشي، وين نروح؟", "طفشت... يالله نسوي شي"],
  speed: ["على هونك! وش هالسرعة؟!", "يا رجال خفف، قلبي طاح", "واو، طيارة مو سيارة!"],
  hit: ["آخ! انصبت", "يضربون علي! بتغطّى"],
  back: ["رجعت لك! وش فاتني؟", "سلطان رجع للخدمة 💪"],
  park: ["الحديقة رايقة، نجلس شوي؟", "جو الحديقة يونّس"],
  plaza: ["النافورة هذي حلوة، صوّرني 📸", "الساحة زحمة اليوم"],
  roam: ["بلف شوي على الرصيف", "بشوف وش فيه هناك", "بتمشّى، لا تشيل هم"],
  ped: ["بسلّم على هالرجال", "بسولف مع هذا شوي"],
  bench: ["بجلس على الكرسي شوي، تعبت", "استراحة محارب 😌"],
  grab: ["لقيت سيارة! بلف فيها", "بسوق شوي، لا تعلّم أحد 😅"],
  snatched: ["هيه! هذي سيارتي 😂", "أخذت سيارتي؟! ماشي يا خوي"],
};
export function mkBud(x: number, z: number): Bud {
  return { x, z, a: 0, ph: 0, mv: 0, hp: 100, dead: 0, mode: 0, act: 0, actT: 0, ride: false, board: 0, car: null, wx: x, wz: z, tx: x, tz: z, cd: 0, aimP: 0, fireT: 0, tgtP: null, cover: 0, fleeT: 0, fx: 0, fz: 0, stuck: 0, side: 1, hitCd: 2, thr: false, thx: 0, thz: 0, crouch: false, sit: false, seated: false, tc: null, tped: null, tpk: null, sayS: "", sayT: 0, sayCd: 0, keyCd: {}, idleT: 0, banT: 40, crashT: 0, menu: -1, menuT: 0, lastBlk: -1, greeted: false, hold: false, guard: 0, mem: { crash: 0, boom: 0, cops: 0, money: 0, chase: 0, top: 0 } };
}
export function bSay(g: Game, key: string, s: string, cd: number): void {
  const b = g.b; if (b.dead > 0) return; moodTick(g, key);
  if ((b.keyCd[key] || 0) > g.t) return; if (b.sayCd > g.t && key !== "cmd") return;
  if (b.mode === 2 && !b.ride && Math.hypot(b.x - g.p.x, b.z - g.p.z) > 40 && key !== "voice" && key !== "cmd" && key !== "fill") return;
  b.keyCd[key] = g.t + cd; b.sayCd = g.t + 4; b.sayS = s; b.sayT = 4; if (key !== "fill") remember(s); speak(s);
}
export function bLine(g: Game, key: string, cd: number): void {
  const b = g.b; if (b.dead > 0) return;
  if ((b.keyCd[key] || 0) > g.t || (b.sayCd > g.t && key !== "cmd") || (b.mode === 2 && !b.ride && Math.hypot(b.x - g.p.x, b.z - g.p.z) > 40)) { moodTick(g, key); return; }
  bSay(g, key, line(g, key), cd);
}
export function banter(g: Game): string {
  const m = g.b.mem, o: string[] = [], md = moodOf();
  if (m.crash >= 2) o.push(`صدمت ${m.crash} مرات اليوم، الله يعين التأمين 😂`);
  if (m.boom >= 1) o.push(`شفنا ${m.boom} انفجارات اليوم، يوم ما ينسى`);
  if (m.chase >= 1) o.push(`الشرطة طاردتنا ${m.chase} مرات، صرنا مشاهير`);
  if (m.money >= 200) o.push(`جمعنا $${m.money} اليوم، العشا عليك`);
  if (m.cops >= 2) o.push(`عطّلت ${m.cops} دوريات اليوم، لا تقول لأحد 😬`);
  const f = o.filter((s: string) => recAge(RECENT, normAr(s)) > 20);
  if (f.length && R() < 0.35) { const s = pick(f); remember(s); return s; }
  return line(g, md !== "calm" && R() < 0.6 ? "ban_" + md : "ban");
}
export function bw(g: Game): number { return stars(g) >= 2 ? 4 : 1; }
export function seat(c: Car, side: number): { x: number; z: number; y: number } {
  const k = c.t.kind, lx = k === 4 ? c.t.l / 2 - 1 : k === 5 ? c.t.l * 0.35 : -c.t.l * 0.06, lz = side * c.t.w * 0.22;
  const y = k === 4 ? -0.15 : k === 5 ? 0.35 : 0.3 + c.t.h * 0.55 + c.t.h * 0.42 * 0.55 - 1.86;
  const ca = Math.cos(c.a), sa = Math.sin(c.a);
  return { x: c.x + ca * lx - sa * lz, z: c.z + sa * lx + ca * lz, y };
}
export function bMenu(g: Game): void { const b = g.b; b.menu = b.menu < 0 ? (b.mode + 1) % 4 : (b.menu + 1) % 4; b.menuT = 2.2; }
export function bConfirm(g: Game): void {
  const b = g.b, m = b.menu; b.menu = -1; if (m < 0) return;
  b.mode = m; b.act = 0; b.actT = 0; b.seated = false; if (m === 1) { b.wx = b.x; b.wz = b.z; }
  BM.lastCmd = ["follow", "wait", "roam", "come"][m]; BM.askT = 0; if (m === 2) { BM.splitT = g.t; BM.encCd = g.t + 20; }
  b.sayCd = 0; bSay(g, "cmd", line(g, "m" + m), 0); msg(g, "Sultan: " + BUD_MODES[m] + " ✔");
}
export function bSideOut(g: Game, b: Bud, c: Car, s0: number): void {
  const ca = Math.cos(c.a), sa = Math.sin(c.a);
  for (const s of [s0, -s0]) { const x = c.x - sa * s * (c.t.w / 2 + 1), z = c.z + ca * s * (c.t.w / 2 + 1); if (!solidAt(g.B, x, z)) { b.x = x; b.z = z; return; } }
  b.x = c.x - ca * (c.t.l / 2 + 1.5); b.z = c.z - sa * (c.t.l / 2 + 1.5);
}
export function bLeaveCar(g: Game, b: Bud): void { const c = b.car; if (!c) return; b.car = null; c.drv = 0; c.park = false; bSideOut(g, b, c, -1); if (b.act === 6) { b.act = 0; b.actT = 0; } }
export function bTele(g: Game, b: Bud): void {
  const p = g.p;
  for (let i = 0; i < 14; i++) { const a = g.yaw + Math.PI + rr(-1.3, 1.3), r = rr(3, 6), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; if (!solidAt(g.B, x, z)) { b.x = x; b.z = z; b.stuck = 0; return; } }
  b.x = p.x; b.z = p.z; b.stuck = 0;
}
export function bOnEnter(g: Game): void { const b = g.b; if (b.dead > 0 || b.car || !(b.mode === 0 || b.mode === 3)) return; b.board = 0; bLine(g, "car", 25); }
export function bOnExit(g: Game, c: Car): void { const b = g.b; if (!b.ride) return; b.ride = false; bSideOut(g, b, c, 1); }
export function bCrash(g: Game, sp: number): void {
  const b = g.b; if (sp < 11 || b.crashT > g.t) return; b.crashT = g.t + 2; b.mem.crash++;
  if (!b.ride) return;
  if (b.mem.crash >= 3 && R() < 0.5) bSay(g, "crash", `${pick(BL.crash)} (هذي الصدمة رقم ${b.mem.crash} اليوم!)`, 6); else bLine(g, "crash", 6);
}
export function bBoom(g: Game, x: number, z: number): void {
  const b = g.b, p = g.p; if (Math.hypot(p.x - x, p.z - z) < 70) { b.mem.boom++; bLine(g, "boom", 10); }
  if (b.dead > 0 || b.ride || b.car) return;
  const d = Math.hypot(b.x - x, b.z - z);
  if (d < 8) bHurt(g, 70 * (1 - d / 8));
  if (d < 16) { b.fleeT = 1.6; b.fx = x; b.fz = z; }
}
export function bHurt(g: Game, d: number): void {
  const b = g.b; if (b.dead > 0 || b.ride) return; b.hp -= d; b.cover = 3;
  if (b.hp <= 0) { b.hp = 0; bLeaveCar(g, b); b.dead = 10; b.mv = 0; b.menu = -1; b.sayS = "طحت... كمّل بدوني شوي"; b.sayT = 3; msg(g, "Sultan is down! Back in 10 seconds"); }
  else bLine(g, "hit", 8);
}
export function bWalk(g: Game, b: Bud, tx: number, tz: number, sp: number, dt: number): number {
  const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
  if (d < 0.3) { b.mv = 0; return d; }
  let a = Math.atan2(dz, dx);
  if (solidAt(g.B, b.x + Math.cos(a) * 1.2, b.z + Math.sin(a) * 1.2)) for (const o of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) { const a2 = a + o * b.side; if (!solidAt(g.B, b.x + Math.cos(a2) * 1.4, b.z + Math.sin(a2) * 1.4)) { a = a2; break; } }
  const ox = b.x, oz = b.z, s = Math.min(sp * dt, d);
  moveCircle(g.B, b, Math.cos(a) * s, Math.sin(a) * s, 0.4);
  if (Math.hypot(b.x - ox, b.z - oz) < s * 0.3) { b.stuck += dt; if (b.stuck > 0.7 && R() < dt * 2) b.side = -b.side; } else b.stuck = Math.max(0, b.stuck - dt * 0.5);
  b.a += angDiff(a, b.a) * Math.min(1, dt * 10); b.ph += sp * 2 * dt; b.mv = 1;
  return d;
}
export function bCombat(g: Game, b: Bud, py: number, dt: number): void {
  b.cd -= dt; b.fireT = Math.max(0, b.fireT - dt); b.thr = false;
  b.guard = Math.max(0, b.guard - dt);
  const sN = stars(g); let tc: Car | null = null, tp: Ped | null = null, bd = b.guard > 0 ? 55 : 38;
  if (sN > 0) for (const c of g.cars) { if (c.drv !== 3 || c.dead > 0) continue; const d = Math.hypot(c.x - b.x, c.z - b.z); if (d < bd) { bd = d; tc = c; } }
  if (b.tgtP && (b.tgtP.dead > 0 || Math.hypot(b.tgtP.x - b.x, b.tgtP.z - b.z) > 35)) b.tgtP = null;
  if (!tc) tp = b.tgtP;
  let tx = 0, ty = 0, tz = 0;
  if (tc) { tx = tc.x; ty = 1; tz = tc.z; b.thr = true; b.thx = tc.x; b.thz = tc.z; } else if (tp) { tx = tp.x; ty = 1.1; tz = tp.z; } else return;
  if (b.hold) return;
  b.a = Math.atan2(tz - b.z, tx - b.x); b.fireT = 0.6; b.mv = b.crouch ? 0 : b.mv;
  if (b.cd > 0) return;
  const wi = bw(g), w = WP[wi]; b.cd = w.cd * (wi === 4 ? 2.5 : 1.8); HOOK.ev("gun", b.x, 1.5, b.z, wi);
  const q = MZ[wi], gf = gunFrame(b.x, py, b.z, b.a, b.aimP);
  const mx = gf[0] * q[0] + gf[4] * q[1] + gf[12], my = gf[1] * q[0] + gf[5] * q[1] + gf[13], mz = gf[2] * q[0] + gf[6] * q[1] + gf[14];
  let dx = tx - mx, dy = ty - my, dz = tz - mz; const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
  b.aimP = Math.atan2(dy, Math.hypot(dx, dz));
  dx += rr(-0.04, 0.04); dy += rr(-0.03, 0.03); dz += rr(-0.04, 0.04); const l2 = Math.hypot(dx, dy, dz); dx /= l2; dy /= l2; dz /= l2;
  const h = hitscan(g, mx, my, mz, dx, dy, dz, 0.3, w.range);
  const hx = mx + dx * h.t, hy = my + dy * h.t, hz = mz + dz * h.t;
  g.trc.push({ x1: mx, y1: my, z1: mz, x2: hx, y2: hy, z2: hz, l: 0.06, c: [0.6, 1, 0.6] });
  addP(g, mx, my, mz, 0, 0, 0, 0.05, 0.3, [1, 0.9, 0.5], 1.5, 0);
  if (h.k === 3 && h.car) { const was = h.car.dead > 0; damageCar(g, h.car, w.dmg * 0.6, false); sparks(g, hx, hy, hz, 3); if (!was && h.car.dead > 0 && h.car.t.kind === 3) b.mem.cops++; }
  else if (h.k === 2 && h.ped && h.ped === tp) hurtPed(g, h.ped, w.dmg, false, b.x, b.z);
  else if (h.k === 1) sparks(g, hx, hy, hz, 2);
}
export function bCoverPt(g: Game, b: Bud): Pt | null {
  let best: Car | null = null, bd = 16;
  for (const c of g.cars) { if (c.dead > 0 || c.drv === 3 || c === g.p.car || Math.abs(c.vx) + Math.abs(c.vz) > 2) continue; const d = Math.hypot(c.x - b.x, c.z - b.z); if (d < bd) { bd = d; best = c; } }
  if (!best) return null;
  const dx = best.x - b.thx, dz = best.z - b.thz, d = Math.hypot(dx, dz) || 1, off = best.t.w / 2 + 1;
  const x = best.x + (dx / d) * off, z = best.z + (dz / d) * off;
  return solidAt(g.B, x, z) ? null : { x, z };
}
export function bRoam(g: Game, b: Bud, dt: number): void {
  const p = g.p; b.actT -= dt;
  if (b.act === 0) {
    const r = R(); b.actT = 25; b.seated = false;
    if (r < 0.2) { let bc: Car | null = null, bd = 45; for (const c of g.cars) { if (!c.park || c.drv !== 0 || c.dead > 0 || c.t.kind === 3) continue; const d = Math.hypot(c.x - b.x, c.z - b.z); if (d < bd) { bd = d; bc = c; } } if (bc) { b.tc = bc; b.act = 4; bLine(g, "grab", 30); } }
    else if (r < 0.35) { let be: Ped | null = null, bd = 25; for (const e of g.peds) { if (e.dead > 0 || e.flee > 0) continue; const d = Math.hypot(e.x - b.x, e.z - b.z); if (d < bd) { bd = d; be = e; } } if (be) { b.tped = be; b.act = 2; bLine(g, "ped", 30); } }
    else if (r < 0.5) { const bx = Math.floor(b.x / BS), bz = Math.floor(b.z / BS); for (let i = -2; i <= 2 && b.act === 0; i++) for (let j = -2; j <= 2; j++) { const X = bx + i, Z = bz + j; if (X < 0 || Z < 0 || X >= NB || Z >= NB) continue; const k = g.B[Z * NB + X]; if (k.k !== 1) continue; b.tx = k.x + k.s / 2 + 5; b.tz = k.z + k.s / 2 + 4.6; b.act = 3; bLine(g, "bench", 30); break; } }
    else if (r < 0.62) { let bk: Pick | null = null, bd = 35; for (const pk of g.picks) { if (pk.resp !== 0) continue; const d = Math.hypot(pk.x - b.x, pk.z - b.z); if (d < bd) { bd = d; bk = pk; } } if (bk) { b.tpk = bk; b.act = 5; } }
    if (b.act === 0) { const bx = clamp(Math.floor(b.x / BS) + Math.floor(rr(-1, 2)), 0, NB - 1), bz = clamp(Math.floor(b.z / BS) + Math.floor(rr(-1, 2)), 0, NB - 1), k = Math.floor(R() * 4), u = R(); b.tx = cornX(bx, k) + (cornX(bx, (k + 1) % 4) - cornX(bx, k)) * u; b.tz = cornZ(bz, k) + (cornZ(bz, (k + 1) % 4) - cornZ(bz, k)) * u; b.act = 1; bLine(g, "roam", 35); }
  }
  if (b.stuck > 2.5) { b.stuck = 0; b.act = 0; return; }
  if (b.act === 1) { if (bWalk(g, b, b.tx, b.tz, 4.4, dt) < 1 || b.actT <= 0) b.act = 0; }
  else if (b.act === 2) { const e = b.tped; if (!e || e.dead > 0 || b.actT <= 0) { b.act = 0; return; } const d = Math.hypot(e.x - b.x, e.z - b.z); if (d > 1.8) bWalk(g, b, e.x, e.z, 4.4, dt); else { b.mv = 0; b.a = Math.atan2(e.z - b.z, e.x - b.x); if (!b.seated) { b.seated = true; b.actT = Math.min(b.actT, 6); } } }
  else if (b.act === 3) { if (bWalk(g, b, b.tx, b.tz, 4.4, dt) < 0.7) { b.sit = true; b.mv = 0; b.a = -Math.PI / 2; if (!b.seated) { b.seated = true; b.actT = 12; } } if (b.actT <= 0) b.act = 0; }
  else if (b.act === 4) { const c = b.tc; if (!c || c.dead > 0 || c.drv !== 0 || g.cars.indexOf(c) < 0 || b.actT <= 0) { b.act = 0; return; } if (bWalk(g, b, c.x, c.z, 6, dt) < c.t.l / 2 + 1.5) { b.car = c; c.drv = 5; c.park = false; snapAI(c); b.act = 6; b.actT = rr(25, 45); } }
  else if (b.act === 5) { const pk = b.tpk; if (!pk || pk.resp !== 0 || b.actT <= 0) { b.act = 0; return; } if (bWalk(g, b, pk.x, pk.z, 6, dt) < 1.2) { if (pk.k === 2) { const a = pk.tmp ? pk.amt : Math.floor(rr(40, 150)); p.money += a; b.mem.money += a; bSay(g, "pick", `لقيت $${a} وحوّلتها لك 💸`, 10); } else if (pk.k === 1) { b.hp = 100; bSay(g, "pick", "لقيت علاج، صحتي تمام الحين", 10); } else bSay(g, "pick", `لقيت ${WP[pk.w].n}، بخليه احتياط`, 10); pk.resp = pk.tmp ? -1 : 45; b.act = 0; } }
  else b.act = 0;
}
// ---------- voice: talk to سلطان ----------
export type Vox = { rec: any; on: boolean; want: boolean; tts: boolean; busy: boolean; heard: string; heardT: number; interim: string; err: string; errT: number; note: string; queue: string[][]; voice: any; done: Record<number, boolean>; intIdx: number; intAt: number; lastInt: string; lastSaid: string; saidAt: number; lastProc: string; procAt: number; dbg: string; dbgT: number; dbgOn: boolean; quietT: number };
export const VOX: Vox = { rec: null, on: false, want: false, tts: true, busy: false, heard: "", heardT: 0, interim: "", err: "", errT: 0, note: "", queue: [], voice: null, done: {}, intIdx: -1, intAt: 0, lastInt: "", lastSaid: "", saidAt: 0, lastProc: "", procAt: 0, dbg: "", dbgT: 0, dbgOn: false, quietT: 0 };
export function speak(s: string): void {
  if (!VOX.tts || typeof window === "undefined") return;
  try {
    const w = window as any, ss = w.speechSynthesis, U = w.SpeechSynthesisUtterance;
    const t = s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim(); if (!t) return;
    if (HOOK.voiceFile(t)) { VOX.lastSaid = t; VOX.saidAt = Date.now(); return; }
    if (!ss || !U) return;
    ss.cancel();
    const u = new U(t); u.lang = "ar-SA"; u.rate = 1.05; u.pitch = 0.95; u.volume = HOOK.vol;
    if (!VOX.voice && ss.getVoices) { const vs: any[] = ss.getVoices() || []; VOX.voice = vs.find((v: any) => /^ar[-_]SA/i.test(v.lang)) || vs.find((v: any) => /^ar/i.test(v.lang)) || null; }
    if (VOX.voice) u.voice = VOX.voice;
    u.onstart = () => { VOX.busy = true; }; u.onend = () => { VOX.busy = false; VOX.quietT = Date.now() + 700; }; u.onerror = () => { VOX.busy = false; VOX.quietT = Date.now() + 700; };
    VOX.lastSaid = t; VOX.saidAt = Date.now(); ss.speak(u);
  } catch (_e) { VOX.busy = false; }
}
export function vErr(s: string): void { VOX.err = s; VOX.errT = 6; VOX.note = s; }
export function micToggle(g: Game): void {
  if (VOX.want) { VOX.want = false; VOX.on = false; VOX.interim = ""; try { if (VOX.rec) VOX.rec.stop(); } catch (_e) { /* ignore */ } msg(g, "🎤 Mic off"); return; }
  const w: any = typeof window !== "undefined" ? window : null;
  const SR = w ? w.SpeechRecognition || w.webkitSpeechRecognition : null;
  if (!SR) { vErr("Your browser has no speech recognition — try Chrome or Edge, or use G"); msg(g, VOX.err); VOX.note = ""; return; }
  if (!VOX.rec) {
    try {
      const r = new SR(); r.lang = "ar-SA"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 5;
      r.onstart = () => { VOX.on = true; VOX.err = ""; VOX.done = {}; VOX.intIdx = -1; VOX.lastInt = ""; };
      r.onresult = (e: any) => {
        let tmp = "", tmpIdx = -1;
        // mic is muted while Sultan talks (and briefly after) so he never hears his own voice
        if (VOX.busy || Date.now() < VOX.quietT) { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) VOX.done[i] = true; else VOX.done[i] = true; VOX.interim = ""; VOX.lastInt = ""; return; }
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) {
            if (VOX.done[i]) continue; VOX.done[i] = true;
            const alts: string[] = []; for (let j = 0; j < res.length; j++) { const t = ((res[j] && res[j].transcript) || "").trim(); if (t) alts.push(t); }
            if (alts.length && !vEcho(alts[0])) { VOX.heard = alts[0]; VOX.heardT = 5; VOX.queue.push(alts); }
            if (i === VOX.intIdx) { VOX.lastInt = ""; VOX.interim = ""; }
          } else { tmp += (res[0] && res[0].transcript) || ""; tmpIdx = i; }
        }
        if (tmpIdx >= 0 && !VOX.done[tmpIdx]) { VOX.interim = tmp; if (tmp.trim() !== VOX.lastInt) { VOX.lastInt = tmp.trim(); VOX.intAt = Date.now(); } VOX.intIdx = tmpIdx; } else if (tmpIdx < 0) VOX.interim = "";
      };
      r.onerror = (e: any) => {
        const c = e && e.error;
        if (c === "not-allowed" || c === "service-not-allowed") { VOX.want = false; vErr("Mic blocked — allow the microphone in your browser, or use G"); }
        else if (c === "audio-capture") { VOX.want = false; vErr("No microphone found — use G"); }
        else if (c === "network") { VOX.want = false; vErr("Speech recognition needs internet — use G"); }
      };
      r.onend = () => { VOX.on = false; if (VOX.want) setTimeout(() => { if (VOX.want) { try { r.start(); } catch (_e) { /* already running */ } } }, 350); };
      VOX.rec = r;
    } catch (_e) { vErr("Mic blocked — use G"); msg(g, VOX.err); VOX.note = ""; return; }
  }
  VOX.want = true;
  try { VOX.rec.start(); } catch (_e) { /* already running */ }
  msg(g, "🎤 Sultan is listening — talk in Arabic (V to stop)");
}
export function ttsToggle(g: Game): void {
  VOX.tts = !VOX.tts; msg(g, VOX.tts ? "🔊 Sultan's voice on" : "🔇 Sultan's voice off");
  if (!VOX.tts) { try { const w = window as any; if (w.speechSynthesis) w.speechSynthesis.cancel(); } catch (_e) { /* ignore */ } VOX.busy = false; }
}
export function normAr(s: string): string {
  return s.toLowerCase().replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/[ىی]/g, "ي").replace(/ک/g, "ك").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/[^\u0621-\u064Aa-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
export const INT: [string, string[]][] = [
  ["hold", ["لا تضرب", "لاتضرب", "وقف ضرب", "وقف الضرب", "بطل ضرب", "لا ترمي", "لا تطلق", "لا تطق", "وقف رمي", "لا تقتل", "نزل سلاحك", "نزل السلاح", "هدي", "اهدا", "اهدي"]],
  ["attack", ["اضرب", "اضربهم", "اضربه", "طقه", "طقهم", "طق", "ارمي", "ارم", "ارمي عليهم", "اطلق", "طلق", "هجوم", "اقتلهم", "اقتله", "فزع", "افزع", "دافع", "عليهم", "ولع فيهم", "سطرهم"]],
  ["cover", ["غطيني", "غط علي", "غطي علي", "غطني", "احميني", "احمني", "انتبه لي", "غطي ظهري", "ظهري"]],
  ["out", ["انزل", "نزل", "اطلع من السياره", "انزل من السياره", "اطلع برا", "برا"]],
  ["car", ["اركب", "اركب السياره", "اركب معي", "نركب", "ادخل السياره", "يالله نركب"]],
  ["wait", ["انتظر", "انتظرني", "استنا", "استناني", "استني", "اوقف", "وقف", "وقف هنا", "اثبت", "خلك هنا", "خلك مكانك", "لا تتحرك", "اقعد هنا", "اجلس هنا", "مكانك"]],
  ["roam", ["تجول", "تجوال", "تمشي", "تمشى", "تمشا", "روح براحتك", "براحتك", "فل فيها", "فلها", "روح لف", "لف", "روح العب", "انت حر", "سرح", "روح"]],
  ["come", ["تعال", "تعا", "تعالي", "جيني", "تعال هنا", "ارجع", "ارجع لي", "اقرب", "قرب"]],
  ["follow", ["اتبعني", "تبعني", "اتبع", "وراي", "الحقني", "الحق", "امش معي", "امشي معي", "خلك معي", "معي", "يالله"]],
  ["status", ["شلونك", "شلون", "كيفك", "كيف حالك", "وش العلم", "وش علومك", "علومك", "كيف صحتك", "صحتك", "وش اخبارك", "اخبارك", "عساك طيب", "شخبارك"]],
  ["where", ["وينك", "وين انت", "وين صرت", "فينك", "وين"]],
  ["drive", ["سواقتي", "سياقتي", "اسوق", "وش رايك بسواقتي", "رايك بسواقتي", "رايك في سواقتي", "كيف سواقتي"]],
  ["greet", ["السلام عليكم", "السلام", "سلام", "هلا", "اهلا", "مرحبا", "يا هلا", "صباح الخير", "مساء الخير", "هاي", "هلو"]],
  ["thanks", ["شكرا", "مشكور", "يعطيك العافيه", "تسلم", "الله يعافيك", "ما قصرت", "كفو", "جزاك الله خير"]],
  ["joke", ["نكته", "ضحكني", "نكت", "طقطق", "سولف", "سالفه"]],
  ["praise", ["ذيب", "انت ذيب", "بطل", "اسطوره", "وحش", "رهيب", "احبك", "فنان", "مبدع", "زين", "حلو"]],
  ["insult", ["غبي", "حمار", "تافه", "ما تفهم", "فاشل", "انقلع", "اسكت", "خايس", "ثقيل", "اكرهك"]],
  ["name", ["وش اسمك", "من انت", "اسمك", "مين انت"]],
];
export const INT_X: [string, string[]][] = [
  ["hold", ["لا تطلق النار", "وقف اطلاق النار", "لا تضربهم", "لا ترمي عليهم", "خلاص لا تضرب", "بس لا تضرب", "لا تضرب احد", "hold fire", "stop shooting", "dont shoot", "cease fire", "la tdrb"]],
  ["attack", ["اضرب الشرطه", "اضرب الدوريه", "ارمي عليهم", "طق عليهم", "طقهم كلهم", "اطلق النار", "اطلق عليهم", "فجرهم", "خلصهم", "اقتل", "حاربهم", "دافع عني", "shoot", "attack", "fire", "kill them", "idrb"]],
  ["cover", ["غطني", "غط ظهري", "احمي ظهري", "احرسني", "انتبه علي", "cover me", "protect me", "back me up"]],
  ["out", ["انزل من السياره", "انزل تحت", "انزل هنا", "نزل هنا", "اطلع", "get out", "out of the car"]],
  ["car", ["اركب معي", "ادخل", "اركب بسرعه", "تعال اركب", "يلا اركب", "get in", "get in the car", "ride with me", "irkab"]],
  ["wait", ["اقعد", "اجلس", "استناني هنا", "انطر", "انطرني", "اصبر", "stay", "wait", "stop", "stay here", "hold on", "intazer", "intathir"]],
  ["roam", ["روح تمشى", "روح تمشي", "تمشى شوي", "روح فل", "فل", "تجول بالمدينه", "روح لحالك", "تونس", "روح تونس", "خذ راحتك", "تسكع", "explore", "roam", "go around", "walk around", "free"]],
  ["come", ["تعال عندي", "تعال بسرعه", "تعال لي", "تعالوا", "come", "come here", "ta3al", "taal", "come back"]],
  ["follow", ["تعال ورايا", "ورايا", "تعال وراي", "الحق علي", "امش وراي", "امشي وراي", "تعال معي", "خلك وراي", "يلا نمشي", "يالله نمشي", "مشينا", "يلا", "follow", "follow me", "lets go", "let s go", "yalla"]],
  ["status", ["كيف الحال", "انت بخير", "انت طيب", "عساك بخير", "وش صحتك", "كم صحتك", "اخبارك ايش", "how are you", "status", "kifak", "shlonak"]],
  ["where", ["وين انت فيه", "وين رحت", "وينك فيه", "انت وين", "where are you", "wenak"]],
  ["drive", ["رايك بالسواقه", "اسوق زين", "سواقه", "سواقتي حلوه"]],
  ["opinion", ["وش رايك فيني", "رايك فيني", "ايش رايك فيني", "وش تقول عني", "تحبني", "انا كيف", "what do you think of me"]],
  ["greet", ["سلام عليكم", "هلا والله", "اهلين", "حياك", "هلا بك", "hello", "hi", "hey", "salam", "marhaba"]],
  ["thanks", ["شكرا لك", "الله يعطيك العافيه", "تسلم يدك", "thanks", "thank you", "shukran"]],
  ["joke", ["قول نكته", "عطني نكته", "سولف لي", "قل شي يضحك", "joke", "tell me a joke"]],
  ["praise", ["يا وحش", "يا ذيب", "انت وحش", "كفو عليك", "انت بطل", "شاطر", "عاش", "you are awesome", "good job", "nice"]],
  ["insult", ["يا غبي", "يا حمار", "يا ثقيل", "يا فاشل", "stupid", "idiot", "shut up"]],
  ["name", ["عرف بنفسك", "your name", "who are you"]],
];
export const FILLER = ["يا", "سلطان", "ياسلطان", "طيب", "ابي", "ابغى", "ابغي", "ابا", "لو", "سمحت", "تكفى", "تكفي", "اخوي", "خوي", "ياخوي", "رجال", "يارجال", "ياخي", "والله", "الحين", "please", "sultan", "plz"];
export const IW: Record<string, number> = { hold: 1.3, out: 1.1, thanks: 1.15, insult: 1.1, name: 1.1, opinion: 1.15, drive: 1.1, praise: 0.9, greet: 0.85 };
export let NLU: { k: string; ws: string[] }[] | null = null;
export function nlu(): { k: string; ws: string[] }[] {
  if (NLU) return NLU;
  const m: Record<string, string[]> = {}, order: string[] = [];
  for (const L of [INT, INT_X]) for (const it of L) { if (!m[it[0]]) { m[it[0]] = []; order.push(it[0]); } for (const w of it[1]) { const n = normAr(w); if (n && m[it[0]].indexOf(n) < 0) m[it[0]].push(n); } }
  NLU = order.map((k: string) => ({ k, ws: m[k] })); return NLU;
}
export function vToks(n: string): string[] { return n.split(" ").filter((t: string) => t.length > 0); }
export function tokVars(t: string): string[] {
  const v = [t];
  if (t.length > 3 && t.indexOf("ال") === 0) v.push(t.slice(2));
  if (t.length > 4 && t.indexOf("لل") === 0) v.push(t.slice(2));
  if (t.length > 3 && "وفبل".indexOf(t[0]) >= 0) { const r = t.slice(1); v.push(r); if (r.length > 3 && r.indexOf("ال") === 0) v.push(r.slice(2)); }
  return v;
}
export function lev1(a: string, b: string): boolean {
  if (a === b) return true; const la = a.length, lb = b.length; if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < la && j < lb) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (la > lb) i++; else if (lb > la) j++; else { i++; j++; } }
  return d + (la - i) + (lb - j) <= 1;
}
// negation: "لا تتبعني" must not trigger follow. If removing the negation word gives the same intent, the matcher ignored it -> flip.
export const NEG_W = ["لا", "ما", "مو", "بلاش", "لاتسوي", "dont", "don", "not", "never"];
export const NEG_FLIP: Record<string, string> = { follow: "wait", come: "wait", car: "wait", roam: "follow", wait: "follow", out: "wait", attack: "hold", cover: "wait" };
export function vScore(raw: string): { k: string; s: number } { return vScore0(raw); }
export function vBest0(raw: string): { k: string; s: number; lay: string } {
  const r1 = vScore0(raw); let it = r1.k, sc = r1.s, lay = "nlu";
  if (!it || sc < 1.5) { const r2 = semScore(raw); if (r2.s >= SEM_T && r2.s > sc) { it = r2.k; sc = r2.s; lay = "sem"; } else if (!it) { sc = r2.s; lay = "web"; } }
  return { k: it, s: sc, lay };
}
export function vBest(raw: string): { k: string; s: number; lay: string } {
  const r = vBest0(raw);
  if (r.lay === "nlu" && r.s >= 3.5 && (r.k === "hold" || r.k === "wait")) return r; // explicit negative phrase ("لا تضرب", "لا تتحرك")
  const toks = normAr(raw).replace(/\bdon t\b/g, "dont").split(" ");
  const ni = toks.findIndex((t: string, i: number) => NEG_W.indexOf(t) >= 0 && i < toks.length - 1);
  if (ni < 0) return r;
  const st = vBest0(toks.filter((_t: string, i: number) => i !== ni).join(" "));
  if (st.k && NEG_FLIP[st.k] && st.s >= 1.5) return { k: NEG_FLIP[st.k], s: Math.max(st.s, 1.6), lay: st.lay };
  return r;
}
export function vScore0(raw: string): { k: string; s: number } {
  const n = normAr(raw), toks = vToks(n).filter((t: string) => FILLER.indexOf(t) < 0), full = " " + n + " ", core = " " + toks.join(" ") + " ", vars = toks.map(tokVars);
  let bk = "", bs = 0;
  for (const it of nlu()) {
    let mx = 0, cnt = 0;
    for (const w of it.ws) {
      let sc = 0;
      if (w.indexOf(" ") >= 0) { if (full.indexOf(" " + w + " ") >= 0 || core.indexOf(" " + w + " ") >= 0) sc = 2.6 + 0.5 * w.split(" ").length; }
      else for (const vs of vars) { if (vs[0] === w) { sc = 3; break; } if (vs.indexOf(w) > 0) sc = Math.max(sc, 2.5); else if (w.length >= 4 && vs.some((v: string) => v.length >= 4 && lev1(v, w))) sc = Math.max(sc, 1.2); }
      if (sc > 0) { cnt++; if (sc > mx) mx = sc; }
    }
    if (mx > 0) { const s = (mx + 0.25 * (cnt - 1)) * (IW[it.k] || 1); if (s > bs) { bs = s; bk = it.k; } }
  }
  return { k: bk, s: bs };
}
export function vIntent(raw: string): string { return vScore(raw).k; }
export function vEcho(t: string): boolean {
  if (!VOX.lastSaid || Date.now() - VOX.saidAt > (VOX.busy ? 60000 : 1500)) return false;
  const a = vToks(normAr(t)), s = " " + normAr(VOX.lastSaid) + " "; if (!a.length) return true;
  let k = 0; for (const w of a) if (s.indexOf(" " + w + " ") >= 0) k++;
  return k / a.length >= 0.6;
}
// ---------- سلطان: mind (mood, variety, semantic layer, silent lookup, encounters) ----------
export type Mind = { hap: number; ann: number; fear: number; bor: number; ask: Record<string, number[]>; refT: number; askT: number; encCd: number; splitT: number; lastCmd: string; rt: number; ani: string; evT: Record<string, number> };
export const BM: Mind = { hap: 0.6, ann: 0, fear: 0, bor: 0, ask: Object.create(null), refT: 0, askT: 0, encCd: 0, splitT: 0, lastCmd: "follow", rt: 0, ani: "الكلب", evT: Object.create(null) };
export function c01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }
export function moodEv(k: string): void {
  if (k === "money" || k === "pick") BM.hap = c01(BM.hap + 0.1);
  else if (k === "crash") BM.fear = c01(BM.fear + 0.25);
  else if (k === "boom") BM.fear = c01(BM.fear + 0.35);
  else if (k === "chase" || k === "hit" || k === "low") BM.fear = c01(BM.fear + 0.18);
  else if (k === "speed" || k === "r_fast") BM.fear = c01(BM.fear + 0.08);
  else if (k === "clear") { BM.hap = c01(BM.hap + 0.1); BM.fear = c01(BM.fear - 0.2); }
  else if (k === "snatched") BM.ann = c01(BM.ann + 0.15);
  else if (k === "idle") BM.bor = c01(BM.bor + 0.25);
  else if (k === "praise") { BM.hap = c01(BM.hap + 0.15); BM.ann = c01(BM.ann - 0.15); }
  else if (k === "insult") { BM.ann = c01(BM.ann + 0.35); BM.hap = c01(BM.hap - 0.1); }
}
export function moodTick(g: Game, k: string): void { if ((BM.evT[k] || 0) > g.t) return; BM.evT[k] = g.t + 3; moodEv(k); }
export function moodOf(): string { return BM.ann > 0.5 ? "ann" : BM.fear > 0.45 ? "fear" : BM.bor > 0.6 ? "bor" : BM.hap > 0.72 ? "hap" : "calm"; }
export function bMind(g: Game, dt: number): void {
  const p = g.p, act = p.mv > 0 || stars(g) > 0 || (!!p.car && Math.hypot(p.car.vx, p.car.vz) > 3);
  BM.ann = c01(BM.ann - dt * 0.01); BM.fear = c01(BM.fear - dt * 0.025); BM.hap += (0.6 - BM.hap) * Math.min(1, dt * 0.01);
  BM.bor = c01(BM.bor + (act ? -dt / 40 : dt / 120));
}
// ----- varied lines: openers × bodies × endings, context slots, no repeats in the last 20 -----
export type Tp = { o: string[]; b: string[]; e: string[] };
export const O_GEN = ["", "والله ", "يا رجال، ", "اسمع، ", "تدري؟ "], O_EXC = ["", "يا ساتر! ", "يمه! ", "وش ذا؟! ", "انتبه! "], O_HAP = ["", "هههه ", "حلو! ", "يا سلام، ", "ما شاء الله، "], O_CMD = ["", "أبشر، ", "تم، ", "على هالخشم، ", "حاضر، "], O_SOFT = ["", "امم، ", "والله ", "شف "];
export const E_0 = ["", "!"], E_S = ["", " 😄", " يا الذيب"], E_C = ["", " 💪", " يا الغالي"];
export const MO: Record<string, string[]> = { hap: ["هههه ", "يا حلو الدنيا، ", "مستانس والله، "], ann: ["اف... ", "طيب طيب، ", "هاه... ", "خلاص، "], fear: ["يمه، ", "قلبي يدق، ", "يا ساتر، "], bor: ["اممم، ", "طفشان بس ", "اوهوو، "] };
export const NOMOOD = ["rep1", "rep2", "rep3", "forgive", "forgive0", "ignore", "enc_yes", "enc_no", "joke", "name", "t:time", "t:faith", "t:help"];
export const TP: Record<string, Tp> = {
  start: { o: ["", "يالله ", "هيا "], b: ["نفزع!", "يا بطل، المدينة لنا اليوم", "نبدأ الفوضى 😎", "أنا جاهز وراك", "خلنا نسوي يوم ما ينسى", "اليوم يومنا", "المدينة تنتظرنا"], e: E_0 },
  car: { o: O_GEN, b: ["يالله ورني سواقتك", "سيارة حلوة، لا تخربها", "شغّل المكيف وخلنا نمشي", "لا تسرع علي تكفى", "على وين يا كابتن؟", "دعس بس بعقل"], e: ["", " 🚗"] },
  chase: { o: O_EXC, b: ["دوريات من كل جهة!", "يالله دعس دعس!", "لفّ يمين وضيّعهم", "لا توقف أبد!", "صفارات الشرطة وراك!"], e: E_0 },
  crash: { o: O_EXC, b: ["خفف خفف!", "صدمة ثانية؟! حرام عليك", "رقبتي راحت 😵", "السيارة تبكي منك", "شف الطريق يا رجال"], e: E_0 },
  boom: { o: O_EXC, b: ["الأرض اهتزت!", "وش صار هناك؟!", "دخان بكل مكان!", "أذني صفّرت من الصوت", "هذا انفجار ولا زلزال؟!"], e: E_0 },
  money: { o: O_HAP, b: ["رزق ونعمة", "الجيب امتلى 💸", "صار معنا ${money}!", "خلنا نصرفها صح", "يا زين الفلوس"], e: E_0 },
  low: { o: O_EXC, b: ["صحتك {php}٪ بس! دوّر علاج", "لا تموت علي تكفى", "اهدا شوي لين تتحسن", "ابعد عن الضرب شوي"], e: E_0 },
  clear: { o: O_HAP, b: ["ارتحنا منهم", "ما لحقونا هههه", "نجونا بأعجوبة", "الشرطة ضاعت ورانا", "خلاص أمان، نفّس"], e: E_0 },
  idle: { o: O_GEN, b: ["واقفين ليش؟", "يالله نتحرك، الملل ذبحني", "وش رايك نروح الحديقة؟", "نلف بسيارة؟", "تبي نروح النافورة؟"], e: E_0 },
  speed: { o: O_EXC, b: ["{spd} كم؟! أنت مجنون", "على مهلك يا الطيار", "الطريق مو لك لحالك", "خفف قبل نطير"], e: E_0 },
  hit: { o: ["", "آخ! ", "آه! ", "يا ويلي! "], b: ["جاتني رصاصة", "انصبت بس عادي", "يضربوني! غطّني", "أحتاج أتغطى", "ظهري ظهري!", "تعوّرت"], e: E_0 },
  back: { o: O_GEN, b: ["ما تخلص مني بسهولة 😎", "رجعت أقوى", "اشتقت لي؟", "يالله نكمّل", "وين وصلنا؟"], e: E_0 },
  park: { o: O_SOFT, b: ["الحديقة هادية اليوم", "الشجر هنا يريّح الأعصاب", "خلنا نرتاح شوي هنا", "حديقة حلوة للكشتة", "العشب أخضر يفتح النفس"], e: E_0 },
  plaza: { o: O_SOFT, b: ["النافورة تلمع اليوم", "أحب صوت المويه", "الساحة فيها ناس كثير", "نتصوّر عند النافورة؟", "هنا قلب المدينة"], e: E_0 },
  roam: { o: ["", "امم، ", "يالله ", "اوكي، "], b: ["بروح أشوف الشارع الثاني", "بلف على الحارة", "باخذ لي لفة", "بتمشّى لين أطفش", "بشوف وش الجديد"], e: E_0 },
  ped: { o: O_SOFT, b: ["هذا شكله طيب، بسولف معه", "بسأل هالرجال عن الطريق", "بسلّم وأرجع", "بشوف وش عنده هذا", "خلني أتعرف عليه"], e: E_0 },
  bench: { o: O_SOFT, b: ["رجلي تعبت، بجلس", "بقعد أرتاح شوي", "كرسي فاضي، حلو", "بتأمل الناس شوي", "بجلس دقيقتين"], e: E_0 },
  grab: { o: O_SOFT, b: ["هالسيارة تناديني 😅", "بلفّة صغيرة بس", "مفتاحها فيها؟ يالله", "بجرّب هالسيارة", "بسوق لين أطفش"], e: E_0 },
  snatched: { o: ["", "هيه! ", "يا رجال! ", "افا! "], b: ["سيارتي يا حرامي 😂", "ما عليه، خذها", "كنت ماشي فيها!", "ماشي، أرجع أمشي", "سرقتها مني؟!"], e: E_0 },
  m0: { o: O_CMD, b: ["وراك وراك 💪", "أنا معك خطوة بخطوة", "مشينا", "ظلّك أنا", "معك لين آخر الدنيا", "يالله قدامي"], e: E_0 },
  m1: { o: O_CMD, b: ["بستناك هنا", "لا تطوّل علي", "واقف هنا لين ترجع", "مكاني ما أتحرك", "بنتظرك، بس لا تنساني", "هنا أنا"], e: E_0 },
  m2: { o: ["", "والله فكرة! ", "أخيراً حرية! ", "يا سلام، ", "حلو، "], b: ["بتمشّى شوي بالديرة", "بلف المدينة", "بروح أتفسح", "بشوف وش فيه بالديرة", "إذا احتجتني ناديني", "بتونّس شوي لحالي"], e: E_0 },
  m3: { o: ["", "جايك! ", "لحظة، ", "طيب، "], b: ["جاي لك الحين", "جايك جايك", "ثواني وأنا عندك", "في الطريق لك", "لا تتحرك، جاي", "أركض لك!"], e: E_0 },
  arrive: { o: ["", "وصلت! ", "ها أنا ", "هلا، "], b: ["وش نسوي الحين؟", "آمر؟", "وش الخطة؟", "جاهز", "وش عندك؟", "عندك يالذيب"], e: E_0 },
  greet: { o: ["", "هلا والله! ", "يا هلا ومرحبا! ", "أهلين! ", "يا مرحبا! "], b: ["آمر", "وش نسوي؟", "نوّرت", "وش العلوم؟", "كيفك أنت؟", "حيّ الله من جا"], e: E_0 },
  thanks: { o: ["", "العفو ", "ولا يهمك ", "تامر "], b: ["يا الغالي", "حنا لها", "أنت تستاهل", "واجبي", "ما سوينا شي", "بالخدمة دايم"], e: E_0 },
  joke: { o: ["", "اسمع هذي: ", "هههه ", "خذ عاد: "], b: ["مرة واحد محشش شاف دورية قال: يا شباب، التاكسي هذا ليش يصفّر؟ 😂", "مرة واحد بخيل اشترى سيارة بدون بنزين، قال يمشيها بالدعاء 😂", "مرة واحد دخل مطعم قال: عندكم كبسة؟ قالوا إيه، قال: طيب أنا بجي بكره 😂", "مرة واحد كسلان طاح من الدرج قال: الحمدلله خلصت النزول 😂", "مرة واحد سأل الشرطي: كم الساعة؟ قال: ثلاث نجوم 😂", "مرة سيارة تعبت قالت لصاحبها: ارحمني، أنا مو صاروخ 😂", "مرة واحد اشترى ساعة ذكية، صارت تروح الدوام قبله 😂", "مرة واحد نام بالحديقة، صحى لقى النافورة تسقيه 😂", "مرة واحد سألوه ليش تسوق بسرعة؟ قال: عشان أوصل قبل ما أنسى وين رايح 😂"], e: [""] },
  praise: { o: ["", "تسلم! ", "هههه ", "يا شيخ! "], b: ["أنت الذيب الأصلي 🐺", "أدري أدري 😎", "من بعض ما عندكم", "كلامك يرفع الراس", "والله إنك أطيب خوي", "أنت اللي فنان"], e: E_0 },
  insult: { o: ["", "الله يسامحك، ", "افا! ", "ما توقعتها منك، "], b: ["ترى أنا اللي أحميك", "بعدّيها لك هالمرة", "زعلتني بس بعدني معك", "كلمة ثانية وبزعل صدق", "كذا تقول لخويك؟", "ماشي، نشوف مين يغطّيك بعدين"], e: E_0 },
  name: { o: ["", "أنا ", "يا رجال أنا ", "نسيت؟ أنا "], b: ["سلطان، خويّك وسندك بالمدينة 💪", "سلطان، ولد الديرة", "سلطان، وحارسك الشخصي", "سلطان، أبو الفزعات", "سلطان، وما يحتاج تعريف 😎", "سلطان، والمدينة كلها تعرفني"], e: [""] },
  opinion: { o: ["", "بصراحة؟ ", "والله ", "رايي؟ "], b: ["أنت خويي وأخوي، وأحلى واحد بالمدينة 💪", "رجّال وتنعد عليك الأصابع 👌", "أنت ذيب، بس سواقتك تبي لها شغل 😂", "أحسن خوي ممكن ألقاه", "قلبك طيب بس رجلك ثقيلة على الدعسة 😂", "أنت أسطورة المدينة"], e: E_0 },
  status: { o: ["", "الحمدلله، ", "تمام، ", "ماشي الحال، "], b: ["صحتي {hp}٪ وأنا {moodw}. {state}، واليوم {crash} صدمات و{boom} انفجارات و{chase} مطاردات، وجمعنا ${mmoney}", "{state}، وصحتي {hp}٪. اليوم {crash} صدمات و{chase} مطاردات", "أنا {moodw}، صحتي {hp}٪، وجمعنا ${mmoney} اليوم", "صحتي {hp}٪ ومزاجي {moodw}، {state}", "{moodw} والله، صحتي {hp}٪ وشفنا {boom} انفجارات اليوم", "عايش! صحتي {hp}٪، {state}، وأنا {moodw}"], e: [""] },
  bye: { o: ["", "مع السلامة! ", "فمان الله! ", "الله معك! "], b: ["لا تطوّل", "بس لا تنساني", "ترى بفقدك", "أنا هنا إذا احتجتني", "ارجع بسرعة", "دير بالك على نفسك"], e: E_0 },
  yes: { o: ["", "تمام ", "زين ", "أبشر "], b: ["وش بعد؟ 👍", "على راحتك", "ماشي", "اتفقنا", "حلو، كمّل", "أكيد"], e: E_0 },
  no: { o: ["", "طيب ", "براحتك ", "ماشي "], b: ["ولا يهمك", "على كيفك", "خلاص نسيناها", "نشوف غيرها", "ما فيه مشكلة", "مثل ما تبي"], e: E_0 },
  forgive: { o: ["", "خلاص ", "ما عليه ", "هههه "], b: ["سامحتك، بس لا تعيدها", "القلب أبيض", "نسيت الموضوع", "أنت خويي ما أزعل منك كثير", "يالله نرجع للفوضى", "حقك علي أنا بعد", "صافي يا لبن"], e: E_0 },
  forgive0: { o: ["", "هههه ", "افا! "], b: ["على وش تعتذر؟ ما صار شي", "ما بيننا هالكلام", "أنت ما غلطت", "ولا يهمك أصلاً", "عادي يا الغالي", "اعتذار؟ أنت تعبان؟ 😂", "ما زعلت أصلاً", "خلها على الله"], e: [""] },
  rep1: { o: ["", "ها؟ ", "هههه "], b: ["توك سائلني!", "سألتني قبل شوي!", "نفس السؤال؟", "قلت لك قبل شوي", "نسيت؟ توني قايل لك", "مرة ثانية؟", "حافظ السؤال أنت 😂"], e: [""] },
  rep2: { o: ["", "خلاص ", "يا رجال ", "اف "], b: ["تراك أزعجتني", "كم مرة بتسأل؟", "قلت لك وخلصنا", "بديت أطفش من سؤالك", "ارحمني من هالسؤال", "اسأل شي ثاني تكفى"], e: E_0 },
  rep3: { o: ["", "خلاص! ", "بس! ", "يا شيخ! "], b: ["ما ني رادّ عليك", "زعلت، خلني شوي", "أنا رايح، لا تكلمني", "طفّشتني والله", "بروح أهدّي أعصابي", "لا تكلمني شوي"], e: [" 😤", ""] },
  ignore: { o: ["", "هاه... ", "اف... "], b: ["لا تكلمني الحين", "خلني لحالي شوي", "زعلان", "بعدين بعدين", "مو فاضي لك", "اعتذر أول", "قلت لك زعلان", "سكوت 🤐"], e: [""] },
  lost: { o: ["", "هههه ", "والله ", "امم، ", "تدري؟ "], b: ["ما أدري وش أقولك يا الذيب، خلنا نفلّ بالسيارة", "سالفتك عميقة 😂 خلها بعدين", "أنت وسوالفك! يالله نسوي شي حماسي", "على قولتك 😄 وش الخطة الحين؟", "كلام كبير، خلنا نروح الحديقة نتفلسف هناك", "صدقت والله 😂 يالله نتحرك", "ما عليك منها، وش رايك نلف بالديرة؟", "هذي فوق مستواي 😂 بس أنا معك بكل شي", "خلنا من الفلسفة ونكمّل السوالف بالطريق", "{lostx}"], e: [""] },
  lexT: { o: [""], b: ["وش جاب طاريه الحين؟ 😄", "سمعت عنه من زمان", "تبي نروح نشوف شي مثله؟", "سالفة حلوة، كمّل", "ما توقعتك تعرفه 😄", "أعرفه، بس هنا بمدينة الفوضى الوضع غير", "حلو، بس خلنا بالفوضى اللي هنا 😂"], e: [""] },
  hold: { o: O_CMD, b: ["سلاحي نازل لين تقول اضرب", "ما بطلق ولا رصاصة", "هدوء تام", "نزّلت السلاح", "ما راح أضرب أحد", "وقفت الضرب"], e: E_0 },
  attack: { o: O_CMD, b: ["بطقّهم 🔫", "على أمرك!", "يالله نفزع!", "جاهز للهجوم", "ولا يهمك، بخلّصهم", "غطّني وأنا أضرب"], e: E_0 },
  attack0: { o: ["", "على مين؟ ", "امم، ", "هاه؟ "], b: ["ما فيه أحد يهددنا", "الجو هادي الحين", "ما أشوف عدو", "اضرب أنت وأنا ألحقك", "خلنا نوفّر الرصاص", "إذا جوا بطقّهم"], e: E_0 },
  cover: { o: O_CMD, b: ["غطّيتك! امش وأنا وراك 🔫", "ظهرك علي", "محد يقرب منك", "عيني عليك", "أنا درعك", "امش، أنا أغطي"], e: E_0 },
  enc_yes: { o: ["", "يالله! ", "أبشر! ", "تم! "], b: ["وراك وراك", "مشينا مع بعض", "التمشاية معك أحلى", "رجعنا فريق", "نكمّل سوا", "يالله قدامي"], e: E_C },
  enc_no: { o: ["", "طيب، ", "براحتك، ", "اوكي، "], b: ["بكمّل تمشايتي، ناديني إذا احتجتني", "أشوفك بعدين", "بلف شوي وأرجع", "خذ راحتك وأنا بعد", "ناديني متى ما بغيت", "سلام، بكمّل لفتي"], e: E_0 },
  ban: { o: O_GEN, b: ["أحس اليوم بيصير شي كبير", "لو عندي سيارة رياضية كان سبقتك", "الجو حلو، يبي له كشتة", "ودي بقهوة الحين", "المدينة ما تنام", "نروح النافورة بعدين؟", "أنت أحسن خوي بالدنيا", "متى نسوي مهمة كبيرة؟"], e: E_0 },
  ban_hap: { o: ["", "هههه ", "والله "], b: ["اليوم حلو معك", "مستانس اليوم", "يا حلو الصحبة", "مزاجي عالي اليوم", "أحس إني بطل فيلم", "اليوم يومنا", "كل شي ماشي صح"], e: E_S },
  ban_ann: { o: ["", "اف، ", "بصراحة "], b: ["مزاجي مو رايق", "لا تستفزني اليوم", "ساكت أحسن لي", "خلنا هادين شوي", "ودي أرتاح من الإزعاج", "لا تكثر علي", "منرفز شوي"], e: E_0 },
  ban_fear: { o: ["", "يمه، ", "بصراحة "], b: ["خايف من سواقتك", "قلبي للحين يدق", "خلنا نبعد عن المشاكل", "الشرطة تخوّف اليوم", "ما ودي انفجار ثاني", "خلنا نروح مكان أمان", "حاس بخطر"], e: E_0 },
  ban_bor: { o: ["", "اممم، ", "اوهوو، "], b: ["طفشت، نسوي شي؟", "الملل ذبحني", "يالله حركة", "نلف بسيارة؟", "خلنا نروح الحديقة", "ما فيه شي نسويه؟", "نبي أكشن"], e: E_0 },
  r_pol: { o: O_SOFT, b: ["دورية قريبة، تصرّف طبيعي", "الشرطة هناك 👀", "لا تسوي شي قدام الدورية", "الشرطة تمر، اهدا", "دورية! لا تطالعها", "إن شاء الله ما تشوفنا 😅"], e: E_0 },
  r_ped: { o: O_SOFT, b: ["هالرجال يمشي بسرعة", "الناس اليوم رايقين", "هذا شكله ضايع", "سلّم على الناس يا رجال", "ناس كثير اليوم", "هذا يطالعنا ليش؟"], e: E_0 },
  r_ani: { o: ["", "شف ", "هههه ", "يا حليله "], b: ["{ani} هذا", "{ani} قريب منا", "لا تخوّف {ani}", "{ani} شكله جوعان", "أحب {ani}", "{ani} يطالعنا 😄"], e: E_0 },
  r_fast: { o: O_EXC, b: ["وش هالسرعة؟!", "كاد يدعسني!", "هذا طيارة مو سيارة", "مجنون هذا!", "شف هالمتهور", "يا ساتر من هالسواقة"], e: E_0 },
  r_fount: { o: O_SOFT, b: ["النافورة تلمع", "صوت المويه يريّح", "ودي أرمي فيها ريال وأتمنى", "النافورة أحلى شي بالمدينة", "نتصوّر عند النافورة؟", "مويتها باردة أكيد"], e: E_0 },
  "t:car": { o: O_GEN, b: ["السيارات هنا كثيرة، اختر لك وحدة ونفلّ فيها", "أحب صوت المكينة 🚗", "لو علي، كان أخذنا لنا وحدة رياضية", "{carx}", "أعلى سرعة وصلناها اليوم {top} كم/س", "التفحيط هنا ممنوع... بس من يشوف 😏"], e: E_0 },
  "t:police": { o: O_GEN, b: ["{polx}", "الشرطة هنا ما ترحم، انتبه", "عطّلنا {cops} دوريات اليوم 😬", "لا تقطع الإشارة قدامهم", "طاردونا {chase} مرات اليوم", "أهم شي لا تخليهم يشوفونك"], e: E_0 },
  "t:money": { o: O_HAP, b: ["معك ${money} الحين", "جمعنا ${mmoney} اليوم مع بعض", "الفلوس تجي وتروح، المهم الصحبة", "دوّر على الشنط الخضرا تلقى فلوس", "إذا كثرت الفلوس، العشا عليك", "خلنا نوفّر شوي"], e: E_0 },
  "t:weapon": { o: O_GEN, b: ["معك {wpn} الحين", "سلاحي جاهز، بس لا تبدأ مشكلة", "أنا أحب الهدوء... إلا إذا بدوا 🔫", "الرصاص غالي، اقتصد", "دوّر صناديق الأسلحة الصفرا", "لو تجينا الشرطة أطلّع الثقيل"], e: E_0 },
  "t:food": { o: O_GEN, b: ["جعت والله! كبسة ولا شاورما؟", "بطني يصيح، خلنا ناكل", "العشا عليك اليوم 😋", "مندي بالليل ما يتفوّت", "قهوة وتمر وننطلق", "برجر الحين يسوى الدنيا"], e: E_0 },
  "t:weather": { o: O_GEN, b: ["الجو هنا دايم صحو ☀️", "الحر يذبح بس نتحمل", "الشمس اليوم قوية", "جو يبي له كشتة", "تونا {tod} والجو رايق", "لو تمطر كان طلعنا البر"], e: E_0 },
  "t:time": { o: ["", "امم، ", "شف، "], b: ["الساعة {time} الحين", "الساعة عندك {time}، يعني {tod}", "تونا {tod}، الوقت بدري", "الوقت يطير معك، الساعة {time}", "{time}، والليل لنا", "الساعة {time} بالضبط"], e: [""] },
  "t:city": { o: O_GEN, b: ["مدينة الفوضى! كل زاوية فيها سالفة", "إحنا الحين بـ{place}", "المدينة كبيرة، تبي نلفها؟", "أحب {place} بالذات", "الحديقة والنافورة أحلى شي هنا", "الشوارع زحمة بس حلوة"], e: E_0 },
  "t:football": { o: O_GEN, b: ["الكورة؟ الدوري صار نار", "أحب المباريات الحماسية ⚽", "لو فيه ملعب هنا كان لعبنا", "الهلال ولا النصر؟ لا تسألني 😂", "أهم شي المنتخب", "خلنا نشوف ماتش الليلة"], e: E_0 },
  "t:family": { o: O_GEN, b: ["الله يحفظ الأهل", "سلّم لي عليهم", "الأهل أهم شي", "الله يخليهم لك", "أمي تقول لا تمشي مع المجانين... وأنا معك 😂", "ودك تروح لهم؟ لا تتأخر"], e: E_0 },
  "t:sad": { o: ["", "يا رجال ", "تعال ", "اسمع، "], b: ["لا تشيل هم، أنا معك 💪", "نلف شوي يتغير جوك", "ما تسوى تزعل، الدنيا حلوة", "فضفض لي، أنا معك", "بكره أحلى إن شاء الله", "خلنا نسوي شي يونّسك"], e: E_0 },
  "t:happy": { o: O_HAP, b: ["دوم يا رب 😄", "الله يديم الوناسة", "إذا أنت مبسوط أنا مبسوط", "يوم حلو والله", "هذا الكلام!", "خلها تستمر"], e: E_0 },
  "t:music": { o: O_GEN, b: ["شغّل لنا شيلة ونفلّ 🎶", "صوتي حلو... أمزح 😂", "الشيلات بالسيارة غير", "ودي بأغنية حماسية الحين", "صوت المكينة أحلى موسيقى", "يالله غنّ وأنا أردد"], e: E_0 },
  "t:game": { o: O_GEN, b: ["مهمتنا نعيش الفوضى 😂", "اللعبة؟ أنا عايش فيها صدق", "الهدف؟ نعيش ونستانس", "اسرق، اهرب، استانس 😄", "دوّر على الفلوس والسلاح", "اضغط M تشوف الخريطة"], e: E_0 },
  "t:sleep": { o: O_GEN, b: ["النوم للضعفاء 😂", "إذا تعبان ارتاح شوي", "أنا ما أنام، أنا حارسك", "قهوة وتصحى", "نخلص لفة بعدين نرتاح", "نعست؟ بدري!"], e: E_0 },
  "t:faith": { o: [""], b: ["الله يتقبل منا ومنك", "لا تفوتك الصلاة 🤲", "الحمدلله على كل حال", "إن شاء الله خير", "ما شاء الله تبارك الله", "الله يوفقك"], e: [""] },
  "t:animal": { o: O_SOFT, b: ["الحيوانات هنا تخاف من سواقتك 😂", "شفت القطاوة بالحديقة؟", "الطيور تطير أول ما تقرب", "أحب الحيوانات، لا تأذيها", "مرة كلب لحقني هنا 😅", "الحديقة فيها حيوانات كثير"], e: E_0 },
  "t:love": { o: O_HAP, b: ["الحب؟ خلنا بالفوضى أحسن", "قلبي للمدينة بس 😄", "الله يرزقك باللي يستاهلك", "سالفة الحب طويلة 😂", "أنا مخلص لك يا خوي 😂", "الحب حلو بس الفلوس أحلى 😂"], e: E_0 },
  "t:help": { o: ["", "بسيطة: ", "شف، "], b: ["F تركب، G أوامري، V تكلمني", "دوّر على الفلوس والأسلحة بالخريطة", "اضغط M للخريطة الكبيرة", "قل لي تعال أو انتظر أو تمشّى", "اهرب من الشرطة لين تختفي النجوم", "إذا تعبت دوّر على علاج"], e: [""] },
  "t:you": { o: O_GEN, b: ["أنا ولد هالمدينة 😎", "عمري؟ سر 😂", "أحب السواقة والفوضى", "ساكن بكل شارع هنا", "هوايتي أغطّيك", "أنا بسيط، كبسة وسيارة وخوي مثلك"], e: E_0 },
};
export const RECENT: string[] = [], RECB: string[] = [];
export function recAge(a: string[], n: string): number { for (let i = a.length - 1, k = 1; i >= 0; i--, k++) if (a[i] === n) return k; return 99; }
export function remember(s: string): void { const n = normAr(s); if (!n || RECENT[RECENT.length - 1] === n) return; RECENT.push(n); if (RECENT.length > 30) RECENT.shift(); }
export const PLACE_N: Record<string, string> = { park: "الحديقة", plaza: "النافورة", block: "الحارة", road: "الشارع" };
export function bPlace(g: Game, x: number, z: number): string {
  const bx = Math.floor(x / BS), bz = Math.floor(z / BS);
  if (g.B && g.B.length && bx >= 0 && bz >= 0 && bx < NB && bz < NB && x - bx * BS > RW && z - bz * BS > RW) { const k = g.B[bz * NB + bx].k; return k === 1 ? "park" : k === 2 ? "plaza" : "block"; }
  return "road";
}
export function slots(g: Game, s: string): string {
  if (s.indexOf("{") < 0) return s;
  const p = g.p, b = g.b, m = b.mem, d = new Date(), h = d.getHours(), mi = d.getMinutes(), sN = stars(g);
  const md: Record<string, string> = { hap: "مبسوط", ann: "متنرفز منك شوي", fear: "خايف شوي", bor: "طفشان", calm: "رايق" };
  const V: Record<string, string> = {
    money: String(p.money), mmoney: String(m.money), crash: String(m.crash), boom: String(m.boom), chase: String(m.chase), cops: String(m.cops), top: String(m.top),
    hp: String(Math.round(b.hp)), php: String(Math.round(p.hp)), stars: String(sN), wpn: WP[p.w] ? WP[p.w].n : "سلاحك",
    car: p.car ? p.car.t.n : "سيارة", spd: p.car ? String(Math.round(Math.hypot(p.car.vx, p.car.vz) * 3.6)) : "0",
    time: h + ":" + (mi < 10 ? "0" : "") + mi, tod: h < 5 ? "الليل" : h < 11 ? "الصبح" : h < 14 ? "الظهر" : h < 17 ? "العصر" : h < 19 ? "المغرب" : "الليل",
    place: PLACE_N[bPlace(g, p.x, p.z)], since: String(Math.max(1, Math.round((g.t - BM.splitT) / 60))), moodw: md[moodOf()],
    state: b.ride ? "راكب معك" : b.car ? "أسوق" : BUD_STAT_AR[b.mode],
    carx: p.car ? "سيارتك هذي " + p.car.t.n + " حلوة" : "يالله اختر لك سيارة ونفلّ",
    polx: sN > 0 ? "الحين " + sN + " نجوم وراك! دوّس" : "الدوريات هادية الحين، لا تحرّكها",
    lostx: sN > 0 ? "ركّز ركّز، الشرطة ورانا!" : p.car ? "الطريق قدامك، دعس ونكمّل السوالف بعدين" : "يالله نسوي شي، الوقف ممل", ani: BM.ani,
  };
  return s.replace(/\{(\w+)\}/g, (_a: string, k: string) => (k in V ? V[k] : ""));
}
export function line(g: Game, k: string, plain?: boolean): string {
  const t = TP[k], bl = BL[k] || [], os = t ? t.o : [""], b1 = t ? bl.concat(t.b) : bl.length ? bl : [k], b2 = plain ? b1.filter((x: string) => x.indexOf("{") < 0) : b1, bs = b2.length ? b2 : b1, es = t ? t.e : [""];
  const mops = MO[moodOf()], useM = !!mops && NOMOOD.indexOf(k) < 0 && k.indexOf("ban_") < 0 && R() < 0.45;
  let best = "", bb = "", bsc = -1;
  for (let i = 0; i < 40; i++) {
    const b0 = pick(bs), s = slots(g, (useM && mops ? pick(mops) : pick(os)) + b0 + pick(es)).replace(/\s+/g, " ").trim();
    const a = recAge(RECENT, normAr(s)), ba = recAge(RECB, b0), sc = Math.min(a, 21) * 10 + Math.min(ba, 7);
    if (sc > bsc) { bsc = sc; best = s; bb = b0; } if (a > 20 && ba > 6) break;
  }
  if (recAge(RECENT, normAr(best)) <= 20) {
    const ops = useM && mops ? mops.concat(os) : os, pool: [string, string][] = [];
    for (const o of ops) for (const b0 of bs) for (const e of es) { const s = slots(g, o + b0 + e).replace(/\s+/g, " ").trim(); if (recAge(RECENT, normAr(s)) > 20) pool.push([s, b0]); }
    if (pool.length) { const q = pick(pool); best = q[0]; bb = q[1]; }
  }
  remember(best); RECB.push(bb); if (RECB.length > 12) RECB.shift();
  return best;
}
// ----- offline semantic layer: concept map + roots + char n-grams -----
export const SEM: [string, string[]][] = [
  ["follow", ["امشي", "يلا بينا", "يلا بنا", "هيا", "هيا نمشي", "رافقني", "تعال ورايا", "ورايا", "تعا معي", "خليك معي", "خليك ورايا", "رافقنا", "come with me", "with me", "stick with me"]],
  ["come", ["تعالى", "تعالى هنا", "تعا لهون", "تعال لهون", "اقترب", "اقرب مني", "تعال جنبي", "قرب علي", "تعالو", "get over here", "over here", "hurry up"]],
  ["wait", ["استنى", "استنى هنا", "ضل هون", "خليك هون", "ابق هنا", "ابقى هنا", "توقف", "قف", "وقف عندك", "خليك مكانك", "انطرني هنا", "hold up", "freeze", "don t move"]],
  ["roam", ["روح اتمشى", "اتمشى", "اتفسح", "روح اتفسح", "انطلق", "روح شوف الدنيا", "استكشف", "اكتشف المدينه", "سيبني", "خليني لحالي", "روح عني", "go explore", "wander", "go have fun"]],
  ["car", ["اطلع السياره", "اركب العربيه", "اصعد", "اصعد السياره", "اطلع معي", "hop in", "jump in"]],
  ["out", ["اخرج", "اخرج من السياره", "انزل برا", "انزل يا عم", "hop out", "get out of the car"]],
  ["attack", ["هاجم", "هاجمهم", "قاتل", "قاتلهم", "اقصف", "ولعها", "خلص عليهم", "موتهم", "fight", "attack them", "get them", "take them out"]],
  ["hold", ["كفايه ضرب", "بلاش ضرب", "ما تضرب", "اهدى", "روق", "calm down", "dont fire", "ceasefire"]],
  ["cover", ["احرس ظهري", "شيك ظهري", "خلك حارسي", "watch my back", "guard me"]],
  ["status", ["ازيك", "عامل ايه", "اخبارك ايه", "شو اخبارك", "كيفك اليوم", "منيح", "انت منيح", "شحالك", "شلونك اليوم", "كيف الامور", "how is it going", "whats up", "sup"]],
  ["where", ["انت فين", "فينك يا عم", "وينك يا رجال", "وين مكانك", "مكانك وين", "where r u"]],
  ["greet", ["اهلا وسهلا", "يا مرحبا", "مساء النور", "صباح النور", "صباحو", "هلا هلا", "good morning", "good evening", "yo"]],
  ["thanks", ["ثانكس", "يسلمو", "ميرسي", "تشكر", "الله يجزاك خير", "ممنون", "thx", "appreciate it"]],
  ["joke", ["ضحكني شوي", "عندك نكته", "فرفشني", "خلني اضحك", "funny", "make me laugh"]],
  ["praise", ["عظيم", "ممتاز", "جامد", "خطير", "اسطوري", "كفو والله", "you rock", "legend", "great", "awesome", "cool"]],
  ["insult", ["احمق", "اهبل", "تيس", "بليد", "ما تنفع", "انطم", "اسكت بس", "loser", "dumb", "noob"]],
  ["name", ["ايش اسمك", "شو اسمك", "اسمك ايه", "مين حضرتك", "what is your name"]],
  ["opinion", ["انا عاجبك", "شو رايك فيني", "رايك فيني ايه", "تحبني ولا لا"]],
  ["sorry", ["اسف", "انا اسف", "اسفين", "سامحني", "معليش", "المعذره", "اعتذر", "حقك علي", "لا تزعل", "sorry", "my bad"]],
  ["yes", ["ابشر", "ابشر طال عمرك", "ايه", "اي", "ايوه", "ايوا", "اكيد", "طبعا", "يب", "تمام", "اوكي", "نعم", "اجل", "اوك", "ok", "okay", "yes", "yeah", "sure"]],
  ["no", ["لا", "لاء", "لا شكرا", "كمل", "كمل تمشيتك", "كمل لفتك", "مو لازم", "ما ابي", "ما ابغى", "ما يحتاج", "no", "nope", "nah"]],
  ["bye", ["مع السلامه", "باي", "فمان الله", "في امان الله", "اشوفك", "تصبح على خير", "bye", "goodbye", "see you"]],
  ["t:car", ["سياره", "سيارات", "عربيه", "موتر", "تاكسي", "باص", "شاحنه", "دركسون", "بنزين", "كفر", "تفحيط", "درفت", "هجوله", "لمبرجيني", "فيراري", "كامري", "لكزس", "تويوتا", "car", "cars", "drift", "lamborghini", "ferrari"]],
  ["t:police", ["شرطه", "شرطي", "دوريه", "دوريات", "بوليس", "مرور", "ساهر", "نجوم", "مطلوب", "سجن", "حبس", "police", "cops", "cop", "jail", "wanted"]],
  ["t:money", ["فلوس", "مال", "ريال", "ريالات", "دولار", "بيزات", "مصاري", "راتب", "غني", "فقير", "بنك", "كاش", "money", "cash", "rich", "dollar"]],
  ["t:weapon", ["سلاح", "اسلحه", "مسدس", "رشاش", "بندقيه", "رصاص", "ذخيره", "قنبله", "صاروخ", "كلاشن", "شوزن", "gun", "guns", "pistol", "rifle", "ammo", "weapon"]],
  ["t:food", ["جوعان", "جعت", "اكل", "اكله", "كبسه", "شاورما", "برجر", "بيتزا", "مندي", "قهوه", "شاي", "عشا", "غدا", "فطور", "مطعم", "تمر", "حلا", "food", "hungry", "pizza", "burger", "coffee"]],
  ["t:weather", ["جو", "حر", "حار", "برد", "بارد", "مطر", "شمس", "غيم", "غبار", "عجاج", "رطوبه", "weather", "rain", "hot", "cold", "sunny"]],
  ["t:time", ["ساعه", "كم الساعه", "الساعه كم", "وقت", "الوقت كم", "time", "clock", "what time"]],
  ["t:city", ["مدينه", "ديره", "حي", "شارع", "شوارع", "عماره", "مبنى", "حديقه", "نافوره", "ساحه", "city", "town", "street", "park", "fountain"]],
  ["t:football", ["كوره", "ماتش", "مباراه", "دوري", "الهلال", "النصر", "الاتحاد", "الاهلي", "رونالدو", "ميسي", "منتخب", "هدف", "football", "soccer", "match", "goal"]],
  ["t:family", ["امي", "ابوي", "ابوك", "امك", "اهلي", "اهلك", "اختي", "عيالي", "عيال", "زوجتي", "عايله", "عائله", "family", "mom", "dad"]],
  ["t:sad", ["زعلان", "حزين", "تعبان", "مضايق", "طفشان", "ضايق", "مهموم", "متضايق", "مكتئب", "sad", "tired", "bored", "upset"]],
  ["t:happy", ["مبسوط", "فرحان", "مستانس", "رايق", "سعيد", "happy"]],
  ["t:music", ["اغنيه", "اغاني", "شيله", "شيلات", "موسيقى", "طرب", "song", "music", "sing"]],
  ["t:game", ["لعبه", "قراند", "gta", "game", "مهمه", "مهمات", "mission"]],
  ["t:sleep", ["نوم", "انام", "نعسان", "تعبت", "sleep", "sleepy"]],
  ["t:faith", ["صلاه", "اذان", "مسجد", "الحمدلله", "ان شاء الله", "ماشاء الله", "pray"]],
  ["t:animal", ["قطه", "قطو", "قطاوه", "كلب", "حمامه", "طير", "طيور", "جمل", "حصان", "حيوان", "حيوانات", "cat", "dog", "bird", "camel", "animal"]],
  ["t:love", ["حب", "حبيبتي", "عشق", "زواج", "love", "crush"]],
  ["t:help", ["ساعدني", "مساعده", "وش اسوي", "ايش اسوي", "كيف العب", "help", "how to play"]],
  ["t:you", ["عمرك", "كم عمرك", "من وين انت", "وين ساكن", "وش تحب", "هوايتك", "how old", "where are you from"]],
];
export const SEM_STOP = ["وش", "ايش", "شو", "ما", "من", "في", "على", "عن", "الى", "هو", "هي", "هذا", "هذي", "ذا", "اللي", "يعني", "انت", "انا", "مع", "او", "هل", "شنو", "رايك", "تعرف", "تعرفه", "the", "a", "an", "is", "to", "of", "me", "you", "i", "it", "do"];
export const SEM_T = 1.5;
IW.no = 0.8; IW.yes = 0.85; IW.sorry = 1.2; IW.bye = 1.05;
export function aRoot(t: string): string {
  let w = t;
  if (/[a-z]/.test(w)) return w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "") : w;
  for (const pf of ["وال", "فال", "بال", "كال", "لل", "ال"]) if (w.length - pf.length >= 3 && w.indexOf(pf) === 0) { w = w.slice(pf.length); break; }
  if (w.length > 4 && "وف".indexOf(w[0]) >= 0) w = w.slice(1);
  for (let r = 0; r < 2; r++) for (const sf of ["كما", "هما", "تين", "ات", "ون", "ين", "ان", "ها", "هم", "كم", "نا", "ني", "وا", "يه", "ه", "ي", "ك", "ت", "و"]) if (w.length - sf.length >= 3 && w.slice(-sf.length) === sf) { w = w.slice(0, w.length - sf.length); break; }
  if (w.length > 3 && "يتنا".indexOf(w[0]) >= 0) w = w.slice(1);
  while (w.length > 3) { let k = -1; for (let i = w.length - 2; i >= 1; i--) if ("اوي".indexOf(w[i]) >= 0) { k = i; break; } if (k < 0) break; w = w.slice(0, k) + w.slice(k + 1); }
  return w;
}
export function tri(s: string): Record<string, number> { const t = " " + s + " ", o: Record<string, number> = Object.create(null); for (let i = 0; i < t.length - 2; i++) { const k = t.slice(i, i + 3); o[k] = (o[k] || 0) + 1; } return o; }
export function triN(a: Record<string, number>): number { let n = 0; for (const k in a) n += a[k]; return n; }
export function dice(a: Record<string, number>, na: number, b: Record<string, number>, nb: number): number { let c = 0; for (const k in a) if (b[k]) c += Math.min(a[k], b[k]); return (2 * c) / (na + nb || 1); }
export type SemIdx = { w: Record<string, string>; ph: { k: string; p: string; n: number }[]; rt: Record<string, string>; ex: { k: string; g: Record<string, number>; n: number }[] };
export let SEMI: SemIdx | null = null;
export function semIdx(): SemIdx {
  if (SEMI) return SEMI;
  const I: SemIdx = { w: Object.create(null), ph: [], rt: Object.create(null), ex: [] };
  const add = (k: string, raw: string): void => {
    const n = normAr(raw); if (!n) return;
    if (n.indexOf(" ") >= 0) I.ph.push({ k, p: n, n: n.split(" ").length });
    else { if (!(n in I.w)) I.w[n] = k; if (n.length >= 3) { const r = aRoot(n); if (r.length >= 3) I.rt[r] = r in I.rt && I.rt[r] !== k ? "*" : k; } }
    const j = n.replace(/ /g, ""); if (j.length >= 3) { const g = tri(j); I.ex.push({ k, g, n: triN(g) }); }
  };
  for (const L of [SEM, INT, INT_X]) for (const it of L) for (const w of it[1]) add(it[0], w);
  SEMI = I; return I;
}
export function semScore(raw: string): { k: string; s: number } {
  const I = semIdx(), n = normAr(raw), toks = vToks(n).filter((t: string) => FILLER.indexOf(t) < 0 && SEM_STOP.indexOf(t) < 0), full = " " + n + " ", core = " " + toks.join(" ") + " ";
  const sc: Record<string, number[]> = Object.create(null);
  const put = (k: string, v: number): void => { if (!k || k === "*") return; (sc[k] = sc[k] || []).push(v); };
  for (const p of I.ph) if (full.indexOf(" " + p.p + " ") >= 0 || core.indexOf(" " + p.p + " ") >= 0) put(p.k, 2.2 + 0.4 * p.n);
  for (const t of toks) {
    let hit = false;
    for (const v of tokVars(t)) if (v in I.w) { put(I.w[v], 2.6); hit = true; break; }
    if (hit || t.length < 3) continue;
    const r = aRoot(t); if (r.length >= 3 && r in I.rt && I.rt[r] !== "*") { put(I.rt[r], 1.7); continue; }
    if (t.length >= 5) for (const w in I.w) if (w.length >= 5 && lev1(t, w)) { put(I.w[w], 1.5); break; }
  }
  const cj = toks.join(""); if (cj.length >= 3) { const cg = tri(cj), cn = triN(cg); for (const e of I.ex) { const d = dice(cg, cn, e.g, e.n); if (d >= 0.55) put(e.k, d * 2.6); } }
  let bk = "", bs = 0;
  for (const k in sc) { const a = sc[k].sort((x: number, y: number) => y - x); const s = (a[0] + 0.3 * (a[1] || 0) + 0.15 * (a[2] || 0)) * (IW[k] || 1); if (s > bs) { bs = s; bk = k; } }
  return { k: bk, s: bs };
}
export function semTopic(text: string, title: string): string {
  const I = semIdx(), c: Record<string, number> = Object.create(null);
  const scan = (s: string, w: number): void => { for (const t of vToks(normAr(s))) { let k = ""; for (const v of tokVars(t)) if (v in I.w) { k = I.w[v]; break; } if (!k && t.length >= 3) { const r = aRoot(t); if (r in I.rt) k = I.rt[r]; } if (k && k.indexOf("t:") === 0) c[k] = (c[k] || 0) + w; } };
  scan(title, 2); scan(text, 1);
  let bk = "", bs = 0; for (const k in c) if (c[k] > bs) { bs = c[k]; bk = k; }
  return bs >= 1 ? bk : "";
}
// ----- silent online lookup (Wikipedia REST / opensearch, CORS), cached in memory + localStorage -----
export type Lex = { t: string; d: string; k: string };
export const LEXC: Record<string, Lex | null> = Object.create(null);
export let LEXL = false, LSEQ = 0;
export const LEX_KEY = "sultan_lex_v1";
export function lexLoad(): void {
  if (LEXL) return; LEXL = true;
  try { const ls: any = typeof localStorage !== "undefined" ? localStorage : null; const s = ls ? ls.getItem(LEX_KEY) : null; if (s) { const o = JSON.parse(s); if (o && typeof o === "object") for (const k of Object.keys(o)) LEXC[k] = o[k]; } } catch (_e) { /* ignore */ }
}
export function lexSave(): void {
  try { const ls: any = typeof localStorage !== "undefined" ? localStorage : null; if (!ls) return; const ks = Object.keys(LEXC), o: Record<string, Lex | null> = {}; for (const k of ks.slice(-150)) o[k] = LEXC[k]; ls.setItem(LEX_KEY, JSON.stringify(o)); } catch (_e) { /* ignore */ }
}
async function jget(url: string, until: number): Promise<{ nf: boolean; j: any } | null> {
  const f: any = (globalThis as any).fetch, left = until - Date.now(); if (!f || left < 120) return null;
  const AC: any = (globalThis as any).AbortController, ac = AC ? new AC() : null; let tm: any = 0;
  const to = new Promise<null>((res: (v: null) => void) => { tm = setTimeout(() => { if (ac) ac.abort(); res(null); }, left); });
  const go = (async (): Promise<{ nf: boolean; j: any } | null> => { try { const r = await f(url, ac ? { signal: ac.signal } : {}); if (!r) return null; if (r.status === 404) return { nf: true, j: null }; if (!r.ok) return null; return { nf: false, j: await r.json() }; } catch (_e) { return null; } })();
  try { return await Promise.race([go, to]); } finally { clearTimeout(tm); }
}
export function lexShort(title: string, desc: string, ext: string): string {
  let d = desc && desc.length <= 70 ? desc : (ext.split(/[.!؟?]\s|\n/)[0] || "");
  d = d.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  const esc = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  d = d.replace(new RegExp("^" + esc + "\\s*(هو|هي|هم|is|was|are)?\\s*(a|an|the)?\\s+", "i"), "").replace(/[.。]$/, "");
  if (d.length > 64) { const cm = d.lastIndexOf("،", 64), c = cm > 20 ? cm : d.lastIndexOf(" ", 64); d = d.slice(0, c > 20 ? c : 64).replace(/\s+(و|من|في|على|عن|او|of|the|and|a|in)$/i, ""); }
  return d;
}
async function vLookup(term: string, until: number): Promise<Lex | null | undefined> {
  lexLoad(); const key = normAr(term); if (!key) return null; if (key in LEXC) return LEXC[key];
  const hosts = /^[a-z0-9 ]+$/i.test(term) ? ["en", "ar"] : ["ar"]; let net = false;
  const sum = (h: string, t: string): string => `https://${h}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, "_"))}`;
  for (const h of hosts) {
    let r = await jget(sum(h, term), until);
    if (!r) { net = true; continue; }
    if (r.nf || !r.j || !r.j.extract) {
      const o = await jget(`https://${h}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(term)}&limit=1&namespace=0&format=json&origin=*`, until);
      if (!o) { net = true; continue; }
      const top = o.j && Array.isArray(o.j[1]) ? o.j[1][0] : ""; if (!top) continue;
      r = await jget(sum(h, String(top)), until); if (!r) { net = true; continue; }
    }
    if (r.j && r.j.extract) {
      const j = r.j, title = String(j.title || term), dis = j.type === "disambiguation", ext = String(j.extract || "");
      const d = dis ? "" : lexShort(title, String(j.description || ""), ext);
      const x: Lex = { t: title, d, k: semTopic(d + " " + ext.slice(0, 300), title) };
      LEXC[key] = x; lexSave(); return x;
    }
  }
  if (net) return undefined;
  LEXC[key] = null; lexSave(); return null;
}
export const LK_STOP = ["تعرف", "تعرفه", "تعرفها", "سمعت", "قول", "قل", "لي", "رايك", "تحب", "عندك", "كيف", "ليش", "متى", "وين", "شي", "know", "about", "tell", "what", "think", "like", "does", "who"];
export function vTerms(raw: string): string[] {
  const ws = raw.replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[^\u0621-\u064Aa-zA-Z0-9 ]+/g, " ").split(/\s+/).filter((w: string) => { const n = normAr(w); return w.length > 1 && FILLER.indexOf(n) < 0 && SEM_STOP.indexOf(n) < 0 && LK_STOP.indexOf(n) < 0; });
  if (!ws.length) return [];
  const o: string[] = []; if (ws.length > 1 && ws.length <= 3) o.push(ws.join(" "));
  const lg = ws.slice().sort((a: string, b: string) => b.length - a.length)[0]; if (o.indexOf(lg) < 0) o.push(lg);
  let al = lg; if (al.length > 5 && /^(وال|بال|فال|كال)/.test(al)) al = al.slice(1); else if (al.length > 5 && al.indexOf("لل") === 0) al = "ال" + al.slice(2);
  const bare = al.length > 4 && al.indexOf("ال") === 0 ? al.slice(2) : "";
  for (const v of [bare, al]) if (v && o.indexOf(v) < 0) o.push(v);
  if (bare && o[0] === lg) { o.shift(); o.push(lg); }
  return o.slice(0, 3);
}
export function lexReply(g: Game, x: Lex): string {
  const op = pick(["آه تقصد ", "آه تقصد ", "اها، تقصد ", "ايه، "]), tail = line(g, x.k || "lexT", true);
  if (x.d && /[a-z]/i.test(x.d)) return op + x.t + " (" + x.d + ")؟ " + tail;
  return op + x.t + "؟ " + (x.d ? pick(["هذا ", "يعني "]) + x.d + "، " : "") + tail;
}
export function vOnline(g: Game, raw: string, pre: string, say: (t: string) => void, seq: number): void {
  const terms = vTerms(raw), nav: any = typeof navigator !== "undefined" ? navigator : null;
  if (!terms.length || (nav && nav.onLine === false)) { say(pre + line(g, "lost")); return; }
  let done = false;
  const ft = setTimeout(() => { if (!done && seq === LSEQ) { const b = g.b; b.sayCd = 0; b.keyCd.fill = 0; bSay(g, "fill", pick(["اممم...", "ههه", "امم 🤔", "ايه ايه..."]), 0); } }, 900);
  const until = Date.now() + 2500;
  const run = async (): Promise<Lex | null | undefined> => { let last: Lex | null | undefined = null; for (const t of terms) { const r = await vLookup(t, until); if (r) return r; if (r === undefined) last = undefined; if (Date.now() > until) break; } return last; };
  run().then((r: Lex | null | undefined) => { done = true; clearTimeout(ft); if (seq !== LSEQ) return; VOX.dbg = "🌐 " + (r ? r.t + " → " + (r.k || "-") : String(r)); VOX.dbgT = 4; say(pre + (r ? lexReply(g, r) : line(g, "lost"))); })
    .catch(() => { done = true; clearTimeout(ft); if (seq === LSEQ) say(pre + line(g, "lost")); });
}
// ----- chance encounters while he roams + reactions to surroundings -----
export function encLine(g: Game): string {
  const p = g.p, sN = stars(g), since = g.t - BM.splitT, pl = bPlace(g, p.x, p.z);
  const O = BM.ann > 0.5 ? ["اوه... أنت؟", "هاه، وش تبي؟", "أنت مرة ثانية؟"] : ["اووه وش جابك انت؟!", "لا لا مو معقول شفتك هنا هههه", "هييه! يا هلا بالذيب", "يا صدفة الصدف!", "ما توقعت أشوفك هنا 😂", "الله الله! من وين طلعت؟", "شوف مين جا!", "هاه! لا تقول إنك تتبعني 😏", "يا رجال خوّفتني! طلعت لي فجأة", "يا حيّ الله! الدنيا صغيرة"];
  const T = since < 60 ? ["توني تاركك قبل شوي!", "ما مدى نفترق!", "لحقتني بسرعة!"] : since < 240 ? ["من {since} دقايق ما شفتك", "صار لنا {since} دقايق بعيد", "{since} دقايق وأنت مختفي"] : ["وحشتني يا رجال، صار لنا {since} دقيقة", "من زمان! {since} دقيقة ولا خبر", "{since} دقيقة لحالي، طفشت"];
  const P: Record<string, string[]> = { park: ["حتى أنت جيت الحديقة؟", "الحديقة جمعتنا 😄"], plaza: ["عند النافورة بعد! صدفة حلوة", "النافورة جمعتنا"], road: ["بنص الشارع كذا؟ 😂", "الشارع صغير علينا"], block: ["بهالحارة بعد؟", "حارتنا صغيرة 😄"] };
  const C: string[] = [];
  if (p.car) C.push("وش هالسيارة؟ {car}! ما شاء الله", "نازل بـ{car}؟ 😎");
  if (sN > 0) C.push("والشرطة وراك بعد؟! وش مسوي؟ 😂", "{stars} نجوم؟! وش هببت؟");
  if (BM.lastCmd === "roam") C.push("مو أنت اللي قلت روح تمشّى؟ 😏", "قلت لي فلّ فيها، وها أنت تلحقني 😂");
  const Q = ["تبيني أجي معك ولا أكمل تمشايتي؟", "أمشي معك ولا أكمل لفّتي؟", "نكمّل سوا ولا كل واحد بطريقه؟", "أجي معك؟", "تبيني معك ولا أرجع ألف؟"];
  let best = "", ba = -1;
  for (let i = 0; i < 25; i++) {
    const ctx = C.length && R() < 0.6 ? pick(C) : pick(P[pl] || P.road);
    const s = slots(g, pick(O) + " " + (R() < 0.75 ? pick(T) + "، " : "") + ctx + " " + pick(Q)).replace(/\s+/g, " ").trim();
    const a = recAge(RECENT, normAr(s)); if (a > ba) { ba = a; best = s; } if (a > 20) break;
  }
  remember(best); return best;
}
export function bEnc(g: Game): boolean {
  const b = g.b, p = g.p;
  if (b.mode !== 2 || b.ride || b.dead > 0 || p.dead > 0 || BM.encCd > g.t || g.t - BM.splitT < 20) return false;
  const pd = Math.hypot(b.x - p.x, b.z - p.z), seen = pd < 28 && Math.abs(angDiff(Math.atan2(b.z - p.z, b.x - p.x), g.yaw)) < 0.45;
  if (pd > 12 && !seen) return false;
  BM.encCd = g.t + 75; BM.askT = g.t + 15;
  if (!b.car) { b.act = 0; b.actT = 0; b.mv = 0; b.a = Math.atan2(p.z - b.z, p.x - b.x); }
  b.sayCd = 0; b.keyCd.enc = 0; bSay(g, "enc", encLine(g), 0); return true;
}
export function bReact(g: Game, dt: number): void {
  const b = g.b, p = g.p; BM.rt -= dt; if (BM.rt > 0) return; BM.rt = 0.8;
  if (b.sayCd > g.t || b.dead > 0) return;
  const pd = Math.hypot(b.x - p.x, b.z - p.z); if (!b.ride && pd > 35) return;
  for (const c of g.cars) {
    if (c === p.car || c === b.car || c.dead > 0) continue; const d = Math.hypot(c.x - b.x, c.z - b.z);
    if (c.drv === 3 && d < 30 && stars(g) === 0) { bLine(g, "r_pol", 75); return; }
    if (d < 9 && Math.hypot(c.vx, c.vz) > 18) { bLine(g, "r_fast", 50); return; }
  }
  for (const a of g.ans) if (a.dead <= 0 && Math.hypot(a.x - b.x, a.z - b.z) < 9) { BM.ani = a.k === 1 ? "الطير" : "الكلب"; if (R() < 0.5) { bLine(g, "r_ani", 100); return; } break; }
  if (!b.ride && !b.car) {
    for (const e of g.peds) if (e.dead <= 0 && Math.hypot(e.x - b.x, e.z - b.z) < 3.5) { if (R() < 0.3) bLine(g, "r_ped", 90); break; }
    if (bPlace(g, b.x, b.z) === "plaza" && R() < 0.3) bLine(g, "r_fount", 150);
  }
}
export const CMDI = ["follow", "wait", "roam", "come", "car", "out", "hold", "attack", "cover", "sorry", "yes", "no"];
export function bHear(g: Game, raw: string): void {
  const b = g.b, p = g.p, m = b.mem, seq = ++LSEQ;
  if (b.dead > 0) { msg(g, "Sultan is down and can't answer right now"); return; }
  const rb = vBest(raw); let it = rb.k; const sc = rb.s, lay = rb.lay;
  VOX.dbg = "🧠 " + lay + ":" + (it || "-") + " (" + sc.toFixed(1) + ")"; VOX.dbgT = 4;
  const say = (t: string): void => { if (b.dead > 0) return; b.sayCd = 0; b.keyCd.voice = 0; bSay(g, "voice", t, 0); };
  const L = (k: string): string => line(g, k);
  const setMode = (k: number): void => { b.menu = k; bConfirm(g); };
  if (BM.askT > g.t && b.mode === 2) {
    if (it === "yes" || it === "follow" || it === "come" || it === "car" || it === "cover") { BM.askT = 0; BM.lastCmd = "follow"; b.mode = 0; b.act = 0; b.actT = 0; b.seated = false; msg(g, "Sultan: " + BUD_MODES[0] + " ✔"); say(L("enc_yes")); return; }
    if (it === "no" || it === "roam" || it === "bye") { BM.askT = 0; say(L("enc_no")); return; }
  }
  if (it === "sorry") { const was = BM.ann; BM.ann = c01(BM.ann - 0.6); BM.refT = 0; BM.ask = Object.create(null); BM.hap = c01(BM.hap + 0.1); say(L(was > 0.25 ? "forgive" : "forgive0")); return; }
  if (BM.refT > g.t) { if (R() < 0.5) say(L("ignore")); return; }
  let pre = "";
  if (CMDI.indexOf(it) < 0) {
    const key = it || "?" + normAr(raw), arr = (BM.ask[key] || []).filter((t: number) => g.t - t < 60); arr.push(g.t); BM.ask[key] = arr;
    if (arr.length >= 5) { BM.ann = 1; BM.refT = g.t + rr(6, 10); BM.ask[key] = []; if (!b.ride && !b.car) { b.fleeT = 2.2; b.fx = p.x; b.fz = p.z; } say(L("rep3")); return; }
    if (arr.length === 4) { BM.ann = c01(BM.ann + 0.3); say(L("rep2")); return; }
    if (arr.length === 3) { BM.ann = c01(BM.ann + 0.15); pre = L("rep1") + " "; }
  }
  const S = (t: string): void => say(pre + t);
  if (it === "praise" || it === "insult") moodEv(it);
  if (it === "follow") setMode(0);
  else if (it === "wait") setMode(1);
  else if (it === "roam") setMode(2);
  else if (it === "come") setMode(3);
  else if (it === "car") { if (b.car) bLeaveCar(g, b); if (!p.car) say("أي سيارة؟ اركب أول وأنا أركب وراك"); else if (b.ride) say("أنا راكب معك أصلاً 😅"); else { b.mode = 0; b.board = 4.9; say("جاي أركب، لا تمشي!"); } }
  else if (it === "out") { if (b.ride && p.car) { b.ride = false; bSideOut(g, b, p.car, 1); b.mode = 1; b.wx = b.x; b.wz = b.z; say("نزلت، بستناك هنا"); } else if (b.car) { bLeaveCar(g, b); say("نزلت من سيارتي"); } else say("أنا أصلاً برا يا الذيب!"); }
  else if (it === "hold") { b.hold = true; say(L("hold")); }
  else if (it === "attack") { b.hold = false; b.guard = 15; say(stars(g) > 0 || b.tgtP ? L("attack") : L("attack0")); }
  else if (it === "cover") { b.hold = false; b.guard = 20; if (b.mode !== 0 && !b.ride) setMode(0); say(L("cover")); }
  else if (it === "status") S(L("status"));
  else if (it === "where") {
    if (b.ride) S("جنبك بالسيارة يا رجال! 😂"); else if (b.car) S(`أسوق سيارة، بعيد عنك ${Math.round(Math.hypot(b.x - p.x, b.z - p.z))} متر`);
    else { const d = Math.hypot(b.x - p.x, b.z - p.z), ad = angDiff(Math.atan2(b.z - p.z, b.x - p.x), g.yaw), dir = Math.abs(ad) < 0.8 ? "قدامك" : Math.abs(ad) > 2.3 ? "وراك" : ad > 0 ? "يمينك" : "يسارك"; S(d < 6 ? "أنا جنبك! التفت 😄" : b.mode === 2 ? `أتمشّى بـ${PLACE_N[bPlace(g, b.x, b.z)]}، تقريباً ${Math.round(d)} متر ${dir}` : `أنا ${dir}، على بعد ${Math.round(d)} متر`); }
  }
  else if (it === "drive") S(m.crash === 0 ? `سواقتك نظيفة، ولا صدمة! وأعلى سرعة ${m.top} كم/س 👌` : m.crash <= 3 ? `مقبولة... صدمت ${m.crash} مرات بس، وأعلى سرعة ${m.top} كم/س` : `بصراحة؟ صدمت ${m.crash} مرات! خلني أسوق أنا 😂`);
  else if (it === "greet") S(normAr(raw).indexOf("سلام") >= 0 ? "وعليكم السلام ورحمة الله! " + L("greet") : L("greet"));
  else if (it === "opinion") S(m.crash > 3 && R() < 0.5 ? `أنت ذيب... بس سواقتك تبي لها شغل، ${m.crash} صدمات 😂` : m.chase > 0 && R() < 0.5 ? `أنت أسطورة! هربت من الشرطة ${m.chase} مرات 🔥` : L("opinion"));
  else if (it === "yes" || it === "no" || it === "bye" || it === "thanks" || it === "joke" || it === "praise" || it === "insult" || it === "name" || it.indexOf("t:") === 0) S(L(it));
  else vOnline(g, raw, pre, say, seq);
}
export function vTick(g: Game, dt: number): void {
  VOX.heardT = Math.max(0, VOX.heardT - dt); VOX.errT = Math.max(0, VOX.errT - dt);
  if (VOX.note) { msg(g, VOX.note); VOX.note = ""; }
  VOX.dbgT = Math.max(0, VOX.dbgT - dt);
  if (VOX.lastInt && VOX.intIdx >= 0 && !VOX.done[VOX.intIdx] && Date.now() - VOX.intAt > 1200) { VOX.done[VOX.intIdx] = true; const t = VOX.lastInt; VOX.lastInt = ""; VOX.interim = ""; if (!vEcho(t)) { VOX.heard = t; VOX.heardT = 5; VOX.queue.push([t]); } }
  while (VOX.queue.length) {
    const alts = VOX.queue.shift(); if (!alts || !alts.length || !g.started) continue;
    let best = alts[0], bs = -1, bk = ""; for (const a of alts) { const r = vScore(a); if (r.s > bs) { bs = r.s; best = a; bk = r.k; } }
    const n = normAr(best); if (!n || (n === VOX.lastProc && Date.now() - VOX.procAt < 2500)) continue;
    VOX.lastProc = n; VOX.procAt = Date.now(); VOX.heard = best; if (bk) VOX.dbg = bk; bHear(g, best);
  }
}
export function vHud(c: CanvasRenderingContext2D, W: number, small: boolean): void {
  let y = 24;
  if (VOX.want) { txt(c, VOX.on ? "🎤 Sultan is listening" : "🎤 ...", 14, y, small ? 13 : 15, VOX.on ? "#ff8080" : "#cccccc", "left"); y += 24; }
  if (VOX.heardT > 0) { c.globalAlpha = Math.min(1, VOX.heardT * 2); txt(c, "You: " + VOX.heard, 14, y, small ? 13 : 15, "#ffffff", "left"); c.globalAlpha = 1; y += 24; }
  else if (VOX.interim) { txt(c, "You: " + VOX.interim + "…", 14, y, small ? 12 : 14, "#bbbbbb", "left"); y += 24; }
  if (VOX.dbgOn && VOX.dbgT > 0) { txt(c, VOX.dbg, 14, y, small ? 11 : 13, "#80d8ff", "left"); y += 22; }
  if (VOX.errT > 0) txt(c, VOX.err, 14, y, small ? 12 : 14, "#ffab91", "left");
  if (!VOX.tts) txt(c, "🔇", W - 40, 128, 16, "#ffffff", "right");
}
export function bUpdate(g: Game, dt: number): void {
  const b = g.b, p = g.p;
  b.sayT = Math.max(0, b.sayT - dt);
  vTick(g, dt);
  if (b.menu >= 0) { b.menuT -= dt; if (b.menuT <= 0) bConfirm(g); }
  if (!g.started) return;
  if (!b.greeted) { b.greeted = true; bLine(g, "start", 999); }
  if (b.dead > 0) { b.dead -= dt; if (b.dead <= 0) { b.hp = 100; b.ride = false; b.act = 0; bTele(g, b); if (p.car && (b.mode === 0 || b.mode === 3)) b.ride = true; b.sayCd = 0; bLine(g, "back", 5); msg(g, "Sultan is back 💪"); } return; }
  if (p.dead > 0) { if (b.ride && !p.car) { b.ride = false; } b.mv = 0; return; }
  b.hp = Math.min(100, b.hp + dt * 1.5); b.sit = false; b.fleeT -= dt; b.cover -= dt;
  // context comments
  if (p.car) { const sp = Math.hypot(p.car.vx, p.car.vz) * 3.6; if (sp > 130 && b.ride) bLine(g, "speed", 30); b.mem.top = Math.max(b.mem.top, Math.round(sp)); }
  if (p.hp < 30) bLine(g, "low", 25);
  if (!p.car && p.mv === 0 && !g.mDown) b.idleT += dt; else b.idleT = 0;
  if (b.idleT > 25) { b.idleT = 0; bLine(g, "idle", 40); }
  const pbx = Math.floor(p.x / BS), pbz = Math.floor(p.z / BS);
  if (pbx >= 0 && pbz >= 0 && pbx < NB && pbz < NB && p.x - pbx * BS > RW && p.z - pbz * BS > RW) { const bi = pbz * NB + pbx; if (bi !== b.lastBlk) { b.lastBlk = bi; const kk = g.B[bi].k; if (kk === 1 && Math.hypot(b.x - p.x, b.z - p.z) < 30) bLine(g, "park", 60); else if (kk === 2 && Math.hypot(b.x - p.x, b.z - p.z) < 30) bLine(g, "plaza", 60); } }
  b.banT -= dt; if (b.banT <= 0) { b.banT = rr(45, 75); if (b.sayCd < g.t) bSay(g, "ban", banter(g), 0); }
  bMind(g, dt); bEnc(g); bReact(g, dt);
  const pd = Math.hypot(p.x - b.x, p.z - b.z);
  // riding with player
  if (b.ride) {
    const c = p.car; if (!c) { b.ride = false; bTele(g, b); return; }
    const s = seat(c, 1); b.x = s.x; b.z = s.z; b.mv = 0; b.crouch = false;
    if (b.mode === 1 || b.mode === 2) { b.ride = false; bSideOut(g, b, c, 1); b.wx = b.x; b.wz = b.z; return; }
    b.a = c.a; bCombat(g, b, s.y, dt); return;
  }
  // own car
  if (b.car) {
    const c = b.car;
    if (c.dead > 0 || g.cars.indexOf(c) < 0 || c.drv !== 5) { b.car = null; if (c.dead > 0) { bSideOut(g, b, c, -1); bHurt(g, 40); } b.act = 0; return; }
    b.x = c.x; b.z = c.z; b.a = c.a; b.mv = 0; c.pa = c.a;
    if (b.mode === 2) { aiDrive(g, c, dt, false); if (b.actT <= 0) bLeaveCar(g, b); else b.actT -= dt; }
    else if (b.mode === 1) bLeaveCar(g, b);
    else { aiDrive(g, c, dt, true); if (pd < 12 || (p.car && pd < 16)) { bLeaveCar(g, b); if (p.car) b.ride = true; } }
    return;
  }
  // on foot
  b.crouch = false;
  for (const c of g.cars) { const csp = Math.abs(c.vx) + Math.abs(c.vz); if (csp < 5 || !inCar(c, b.x, b.z, 0.4)) continue; if (b.cover < 2.6) bHurt(g, Math.min(35, csp * 2.2)); const ca = Math.cos(c.a), sa = Math.sin(c.a), lz = -(b.x - c.x) * sa + (b.z - c.z) * ca, push = (lz >= 0 ? 1 : -1) * (c.t.w / 2 + 0.5 - Math.abs(lz)); moveCircle(g.B, b, -sa * push, ca * push, 0.4); if (b.dead > 0) return; }
  if (b.fleeT > 0) { const ax = b.x - b.fx, az = b.z - b.fz, d = Math.hypot(ax, az) || 1; bWalk(g, b, b.x + (ax / d) * 5, b.z + (az / d) * 5, 8.5, dt); return; }
  if (b.thr && stars(g) >= 2) {
    b.hitCd -= dt;
    if (b.hitCd <= 0) { b.hitCd = rr(1.4, 2.6); HOOK.ev("npcgun", b.thx, 1.7, b.thz, 3); g.trc.push({ x1: b.thx, y1: 1.7, z1: b.thz, x2: b.x + rr(-1, 1), y2: 1.2, z2: b.z + rr(-1, 1), l: 0.07, c: [1, 0.5, 0.4] }); if (R() < (b.cover > 0 ? 0.12 : 0.35)) bHurt(g, 8); }
  }
  let busy = false;
  if (b.cover > 0 && b.thr && pd < 25) { const cp = bCoverPt(g, b); if (cp) { busy = true; if (bWalk(g, b, cp.x, cp.z, 8.5, dt) < 0.8) { b.crouch = true; b.mv = 0; } } }
  if (!busy) {
    if (b.mode === 0 || b.mode === 3) {
      if (p.car) { const c = p.car, dc = Math.hypot(c.x - b.x, c.z - b.z); b.board += dt; if (dc < c.t.l / 2 + 2.2 || dc > 45 || b.board > 5) { b.ride = true; b.board = 0; if (b.mode === 3) b.mode = 0; return; } bWalk(g, b, c.x, c.z, 8.5, dt); }
      else {
        b.board = 0;
        if (pd > (b.mode === 3 ? 160 : 70) || (b.stuck > 3 && pd > 6)) { bTele(g, b); if (b.mode === 3) b.mode = 0; }
        else if (b.mode === 3 && pd < 5) { b.mode = 0; b.sayCd = 0; bSay(g, "cmd", line(g, "arrive"), 0); }
        else if (pd > 3.4) bWalk(g, b, p.x, p.z, b.mode === 3 || pd > 9 ? 8.5 : 4.6, dt);
        else { b.mv = 0; b.a += angDiff(p.a, b.a) * Math.min(1, dt * 3); }
      }
    } else if (b.mode === 1) { if (Math.hypot(b.wx - b.x, b.wz - b.z) > 1) bWalk(g, b, b.wx, b.wz, 4.6, dt); else b.mv = 0; }
    else bRoam(g, b, dt);
  }
  if (b.mv === 0 && !b.sit) b.ph = 0;
  bCombat(g, b, b.crouch ? -0.4 : b.sit ? -0.35 : 0.1, dt);
}
export const MZ: number[][] = [[0, 0], [0.27, 0.08], [0.36, 0.08], [0.76, 0.08], [0.72, 0.09], [1.02, 0.08], [0.98, 0.18]];
export function gunFrame(px: number, py: number, pz: number, a: number, ap: number): M4 { return ch(tr(px, py, pz), ry(-a), tr(0, 1.45, 0), rz(ap), tr(0.6, -0.02, 0.06)); }
export function bHud(g: Game, c: CanvasRenderingContext2D, W: number, H: number, small: boolean): void {
  const b = g.b, p = g.p;
  txt(c, b.dead > 0 ? `Sultan: down (${Math.ceil(b.dead)})` : `Sultan: ${b.car ? "driving" : b.ride ? "riding with you" : BUD_STAT[b.mode]}  ❤${Math.round(b.hp)}`, W - 14, 150, small ? 12 : 14, b.dead > 0 ? "#ff8a80" : "#9cff9c", "right");
  if (b.sayT > 0 && b.sayS) {
    c.globalAlpha = Math.min(1, b.sayT * 2);
    txt(c, "Sultan: " + b.sayS, W / 2, H - (p.car ? 58 : 34), small ? 15 : 19, "#ffe082", "center");
    const m = g.pv, hy = (b.ride && p.car ? seat(p.car, 1).y : 0.1) + 2.95, X = m[0] * b.x + m[4] * hy + m[8] * b.z + m[12], Y = m[1] * b.x + m[5] * hy + m[9] * b.z + m[13], Wc = m[3] * b.x + m[7] * hy + m[11] * b.z + m[15];
    if (Wc > 0.5 && Math.hypot(b.x - g.ex, b.z - g.ez) < 45 && !b.car) {
      const sx = (X / Wc * 0.5 + 0.5) * W, sy = (1 - (Y / Wc * 0.5 + 0.5)) * H;
      if (sx > 0 && sx < W && sy > 20 && sy < H) {
        c.font = `bold ${small ? 12 : 14}px system-ui, sans-serif`; const tw = Math.min(260, c.measureText(b.sayS).width + 18);
        c.fillStyle = "rgba(255,255,255,0.92)"; c.beginPath(); c.moveTo(sx - 6, sy - 6); c.lineTo(sx, sy + 4); c.lineTo(sx + 6, sy - 6); c.fill();
        c.fillRect(sx - tw / 2, sy - 32, tw, 26); c.fillStyle = "#1b1b1b"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(b.sayS, sx, sy - 19, tw - 8);
      }
    }
    c.globalAlpha = 1;
  }
  if (b.menu >= 0) {
    const w = 250, h = 34 + BUD_MODES.length * 30, x0 = W / 2 - w / 2, y0 = H * 0.28;
    c.fillStyle = "rgba(0,0,0,0.7)"; c.fillRect(x0, y0, w, h);
    txt(c, "Sultan commands", W / 2, y0 + 16, 15, "#9cff9c", "center");
    BUD_MODES.forEach((s: string, i: number) => { const y = y0 + 34 + i * 30; if (i === b.menu) { c.fillStyle = "rgba(76,175,80,0.85)"; c.fillRect(x0 + 6, y, w - 12, 26); } txt(c, (i === b.mode ? "● " : "") + s, W / 2, y + 13, 15, "#ffffff", "center"); });
    c.fillStyle = "#9cff9c"; c.fillRect(x0, y0 + h - 3, (w * Math.max(0, b.menuT)) / 2.2, 3);
  }
}

// ---------- update ----------
export function update(g: Game, dt: number): void {
  g.t += dt;
  const p = g.p, k = g.keys, st = g.started && !g.inside && !g.ui, pad = g.pad, po = st && pad.on;
  const near = g.cars.filter((c: Car) => Math.abs(c.x - p.x) < 170 && Math.abs(c.z - p.z) < 170);
  if (!g.ever) g.yaw += dt * 0.12;
  if (st) {
    g.yaw += g.ldx * 0.0026; g.pitch = clamp(g.pitch + g.ldy * 0.002, -0.3, 1.25);
    if (g.ldx !== 0 || g.ldy !== 0) g.lookT = 0;
    if (k.has("ArrowLeft")) { g.yaw -= 2 * dt; g.lookT = 0; } if (k.has("ArrowRight")) { g.yaw += 2 * dt; g.lookT = 0; }
    if (k.has("ArrowUp")) g.pitch = clamp(g.pitch - 1.2 * dt, -0.3, 1.25); if (k.has("ArrowDown")) g.pitch = clamp(g.pitch + 1.2 * dt, -0.3, 1.25);
    if (po) { g.yaw += pad.rx * 2.8 * dt; g.pitch = clamp(g.pitch + pad.ry * 1.8 * dt, -0.3, 1.25); if (pad.rx !== 0 || pad.ry !== 0) g.lookT = 0; }
  }
  g.ldx = 0; g.ldy = 0; g.lookT += dt;
  p.cd -= dt; p.punch = Math.max(0, p.punch - dt); g.fireT = Math.max(0, g.fireT - dt); g.hurtT = Math.max(0, g.hurtT - dt); g.flash = Math.max(0, g.flash - dt);
  if (p.dead > 0) {
    p.dead -= dt;
    if (p.dead <= 0) { p.hp = 100; p.x = HOSP.x; p.z = HOSP.z; p.y = 0; p.money = Math.floor(p.money * 0.9); g.wanted = 0; msg(g, "Discharged from the hospital"); }
  } else {
    const kk = (a: string): number => (st && k.has(a) ? 1 : 0);
    let fwd = kk("KeyW") - kk("KeyS"), right = kk("KeyD") - kk("KeyA");
    if (po && (pad.lx !== 0 || pad.ly !== 0)) { right = pad.lx; fwd = -pad.ly; }
    const aiming = st && !p.car && (g.rDown || (po && pad.l2 > 0.3));
    g.aiming = aiming;
    if (p.car) {
      const c = p.car;
      const kThr = kk("KeyW") - kk("KeyS"), kSt = kk("KeyD") - kk("KeyA");
      let thr = kThr, steer = kSt;
      if (po) { thr = clamp(kThr + pad.r2 - pad.l2, -1, 1); if (pad.lx !== 0) steer = Math.sign(pad.lx) * Math.pow(Math.abs(pad.lx), 1.3); }
      c.pa = c.a; driveCar(g, c, thr, steer, st && (k.has("Space") || (po && pad.cross)), dt);
      p.x = c.x; p.z = c.z; p.y = 0;
      if (g.lookT > 1.2) g.yaw += angDiff(c.a, g.yaw) * Math.min(1, dt * 2.5);
    } else {
      const cy = Math.cos(g.yaw), sy = Math.sin(g.yaw);
      let wx = cy * fwd - sy * right, wz = sy * fwd + cy * right; const len = Math.hypot(wx, wz); if (len > 1) { wx /= len; wz /= len; }
      const sprint = st && (k.has("ShiftLeft") || k.has("ShiftRight") || (po && pad.l3));
      const sp = (sprint ? 8.5 : 4.5) * (aiming ? 0.55 : 1);
      moveCircle(g.B, p, wx * sp * dt, wz * sp * dt, 0.4);
      const ml = Math.hypot(wx, wz);
      if (ml > 0.1) { p.ph += dt * sp * 2; p.mv = Math.min(1, ml); } else p.mv = 0;
      if (aiming || g.fireT > 0) p.a = g.yaw; else if (ml > 0.1) p.a += angDiff(Math.atan2(wz, wx), p.a) * Math.min(1, dt * 10);
      if (g.jumpReq && p.y <= 0) p.vy = 6.5;
      p.vy -= 20 * dt; p.y += p.vy * dt; if (p.y < 0) { p.y = 0; p.vy = 0; }
      for (const c of near) {
        const dx = p.x - c.x, dz = p.z - c.z; if (Math.abs(dx) > 8 || Math.abs(dz) > 8 || p.y > 1.5) continue;
        const ca = Math.cos(c.a), sa = Math.sin(c.a), lx = dx * ca + dz * sa, lz = -dx * sa + dz * ca, hl = c.t.l / 2 + 0.5, hw = c.t.w / 2 + 0.5;
        if (Math.abs(lx) < hl && Math.abs(lz) < hw) {
          const csp = Math.hypot(c.vx, c.vz); if (csp > 5 && g.hurtT < 0.1) hurtPlayer(g, Math.min(35, csp * 1.2));
          const push = (lz >= 0 ? 1 : -1) * (hw - Math.abs(lz)), ox = p.x, oz = p.z; p.x += -sa * push; p.z += ca * push; if (solidAt(g.B, p.x, p.z)) { p.x = ox; p.z = oz; }
        }
      }
    }
    g.jumpReq = false;
    const firing = st && (g.mDown || (po && !p.car && pad.r2 > 0.4));
    if (firing && p.cd <= 0) shoot(g);
    else if (po && !p.car && pad.square && p.cd <= 0) { const w0 = p.w; p.w = 0; shoot(g); p.w = w0; }
    for (const pk of g.picks) {
      if (pk.resp !== 0 || Math.abs(pk.x - p.x) > 1.6 || Math.abs(pk.z - p.z) > 1.6) continue;
      if (pk.k === 0) { const fresh = !p.has[pk.w]; p.has[pk.w] = true; p.ammo[pk.w] += Math.ceil(WP[pk.w].ammo * (fresh ? 1 : 0.5)); if (fresh || p.w === 0) p.w = pk.w; msg(g, "Picked up: " + WP[pk.w].n); if (fresh) bSay(g, "wpn", `واو ${WP[pk.w].n}! خلني أجرّبه بعدين 😏`, 10); }
      else if (pk.k === 1) { if (p.hp >= 100) continue; p.hp = Math.min(100, p.hp + 50); msg(g, "+ Health"); }
      else { const a = pk.tmp ? pk.amt : Math.floor(rr(50, 300)); p.money += a; msg(g, "+ $" + a); g.b.mem.money += a; bLine(g, "money", 15); }
      pk.resp = pk.tmp ? -1 : 45;
    }
  }
  for (let i = g.picks.length - 1; i >= 0; i--) { const pk = g.picks[i]; if (pk.resp < 0) { g.picks.splice(i, 1); continue; } if (pk.resp > 0) pk.resp = Math.max(0, pk.resp - dt); }
  // cars
  const sN = stars(g);
  for (const c of g.cars) {
    if (c.dead > 0) {
      c.dead += dt; const f = Math.pow(0.2, dt); c.vx *= f; c.vz *= f; moveCar(g, c, dt);
      if (c.dead < 8 && R() < 0.5) addP(g, c.x + rr(-1, 1), 1, c.z + rr(-1, 1), rr(-0.3, 0.3), rr(1, 3), rr(-0.3, 0.3), rr(0.4, 0.8), rr(0.4, 0.8), [1, 0.5, 0.1], 1, -1);
      if (R() < 0.15) addP(g, c.x, 1.5, c.z, rr(-0.3, 0.3), rr(1.5, 3), rr(-0.3, 0.3), rr(1.5, 2.5), rr(0.6, 1.2), [0.25, 0.25, 0.25], 0, -0.3);
      continue;
    }
    c.panic = Math.max(0, c.panic - dt);
    if (c.hp < c.t.hp * 0.4 && R() < 0.25) { const fx = c.x + Math.cos(c.a) * c.t.l * 0.35, fz = c.z + Math.sin(c.a) * c.t.l * 0.35; addP(g, fx, 1.2, fz, rr(-0.3, 0.3), rr(1, 2.5), rr(-0.3, 0.3), rr(1, 1.8), rr(0.4, 0.7), c.hp < c.t.hp * 0.15 ? [0.15, 0.15, 0.15] : [0.6, 0.6, 0.6], 0, -0.3); }
    if (c.hp < c.t.hp * 0.15) { if (R() < 0.3) addP(g, c.x + Math.cos(c.a) * c.t.l * 0.35, 1.1, c.z + Math.sin(c.a) * c.t.l * 0.35, 0, rr(1, 2), 0, 0.4, 0.4, [1, 0.45, 0.05], 1, -1); damageCar(g, c, dt * 5, false); }
    if (c.drv === 2 || c.drv === 5) continue;
    if (c.t.kind === 3 && c.drv === 1 && sN > 0 && Math.hypot(c.x - p.x, c.z - p.z) < 120) c.drv = 3;
    if (c.drv === 3 && sN === 0) { c.drv = 1; snapAI(c); }
    c.pa = c.a;
    if (c.drv === 1) aiDrive(g, c, dt, false);
    else if (c.drv === 3) aiDrive(g, c, dt, true);
    else { const f = Math.pow(0.3, dt); c.vx *= f; c.vz *= f; if (Math.abs(c.vx) + Math.abs(c.vz) > 0.05) moveCar(g, c, dt); }
  }
  carPairs(g, near);
  // peds
  for (let i = g.peds.length - 1; i >= 0; i--) {
    const e = g.peds[i];
    if (Math.abs(e.vx) + Math.abs(e.vz) > 0.05) { moveCircle(g.B, e, e.vx * dt, e.vz * dt, 0.4); const f = Math.pow(0.02, dt); e.vx *= f; e.vz *= f; }
    if (e.dead > 0) { e.dead += dt; if (e.dead > 20) g.peds.splice(i, 1); continue; }
    let mx = 0, mz = 0, spd = 0;
    if (e.flee > 0) { e.flee -= dt; const dx = e.x - e.fx, dz = e.z - e.fz, d = Math.hypot(dx, dz) || 1; mx = dx / d; mz = dz / d; spd = 4.5; if (e.flee <= 0) resetPath(e); }
    else { const dx = e.tx - e.x, dz = e.tz - e.z, d = Math.hypot(dx, dz); if (d < 0.6) arriveCorner(e); else { mx = dx / d; mz = dz / d; spd = e.spd; } if (d > 120) resetPath(e); }
    if (spd > 0) { e.a += angDiff(Math.atan2(mz, mx), e.a) * Math.min(1, dt * 8); moveCircle(g.B, e, mx * spd * dt, mz * spd * dt, 0.4); e.ph += spd * 2 * dt; e.mv = 1; } else e.mv = 0;
    for (const c of near) {
      if (!inCar(c, e.x, e.z, 0.4)) continue;
      const csp = Math.hypot(c.vx, c.vz);
      if (csp > 4) { hurtPed(g, e, csp * 5, c.drv === 2, c.x - c.vx, c.z - c.vz); e.vx += c.vx * 0.6; e.vz += c.vz * 0.6; }
      const ca = Math.cos(c.a), sa = Math.sin(c.a), lz = -(e.x - c.x) * sa + (e.z - c.z) * ca, push = (lz >= 0 ? 1 : -1) * (c.t.w / 2 + 0.4 - Math.abs(lz));
      e.x += -sa * push; e.z += ca * push;
    }
  }
  bUpdate(g, dt);
  // animals
  for (let i = g.ans.length - 1; i >= 0; i--) {
    const a = g.ans[i];
    if (a.dead > 0) { a.dead += dt; a.y = Math.max(0, a.y - 10 * dt); if (a.dead > 15) g.ans.splice(i, 1); continue; }
    if (a.k === 1) {
      if (a.st === 0) { a.ph += dt * 3; const pd = Math.hypot(a.x - p.x, a.z - p.z); if (pd < 6 || (p.car && pd < 14)) { a.st = 1; a.a = Math.atan2(a.z - p.z, a.x - p.x) + rr(-0.5, 0.5); a.t = 0; } }
      else { a.y = Math.min(25, a.y + 6 * dt); a.x += Math.cos(a.a) * 9 * dt; a.z += Math.sin(a.a) * 9 * dt; a.ph += dt * 25; a.t += dt; if (a.t > 6) { g.ans.splice(i, 1); continue; } }
      continue;
    }
    let spd = 0, mx = 0, mz = 0; a.t -= dt;
    if (a.st === 1) { const dx = a.x - a.fx, dz = a.z - a.fz, d = Math.hypot(dx, dz) || 1; mx = dx / d; mz = dz / d; spd = 6; if (a.t <= 0) { a.st = 0; a.hx = a.x - a.hs / 2; a.hz = a.z - a.hs / 2; } }
    else { if (a.t <= 0) { a.t = rr(2, 6); if (R() < 0.35) { a.tx = a.x; a.tz = a.z; } else { a.tx = a.hx + R() * a.hs; a.tz = a.hz + R() * a.hs; } } const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz); if (d > 0.5) { mx = dx / d; mz = dz / d; spd = 2.2; } }
    if (spd > 0) { a.a += angDiff(Math.atan2(mz, mx), a.a) * Math.min(1, dt * 6); const ox = a.x, oz = a.z; moveCircle(g.B, a, mx * spd * dt, mz * spd * dt, 0.5); if (Math.abs(a.x - ox) + Math.abs(a.z - oz) < 0.001) a.t = 0; a.ph += spd * 3 * dt; a.mv = 1; } else a.mv = 0;
    for (const c of near) if (Math.hypot(c.vx, c.vz) > 4 && inCar(c, a.x, a.z, 0.4)) { a.dead = 0.001; break; }
  }
  // particles / tracers / msgs
  for (let i = g.parts.length - 1; i >= 0; i--) {
    const q = g.parts[i]; q.l -= dt; if (q.l <= 0) { g.parts[i] = g.parts[g.parts.length - 1]; g.parts.pop(); continue; }
    const f = Math.pow(0.4, dt); q.vx *= f; q.vz *= f; q.vy -= q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; if (q.y < 0.05) { q.y = 0.05; q.vy *= -0.3; }
  }
  for (let i = g.trc.length - 1; i >= 0; i--) { g.trc[i].l -= dt; if (g.trc[i].l <= 0) g.trc.splice(i, 1); }
  for (const m of g.msgs) m.l -= dt; g.msgs = g.msgs.filter((m: { s: string; l: number }) => m.l > 0);
  // wanted
  g.calm += dt;
  if (sN > 0) {
    if (copNear(g, 45)) g.calm = Math.min(g.calm, 4);
    if (g.calm > 14) { g.wanted = Math.max(0, sN - 1); g.calm = 0; if (g.wanted === 0) { msg(g, "You lost the cops!"); bLine(g, "clear", 20); } }
    g.polT -= dt;
    if (g.polT <= 0) { g.polT = 2.5; const n = g.cars.filter((c: Car) => c.drv === 3).length; if (n < Math.min(8, sN * 2)) for (let t = 0; t < 8; t++) if (spawnCar(g, false, true, false)) break; }
  }
  // spawn
  g.spawnT -= dt;
  if (g.spawnT <= 0) {
    g.spawnT = 0.3; const init = g.t < 0.5;
    const far = (x: number, z: number): boolean => Math.abs(x - p.x) > 190 || Math.abs(z - p.z) > 190;
    g.cars = g.cars.filter((c: Car) => c === p.car || c === g.b.car || !far(c.x, c.z) && !(c.dead > 40));
    g.peds = g.peds.filter((e: Ped) => !far(e.x, e.z));
    g.ans = g.ans.filter((a: Ani) => !far(a.x, a.z));
    let traffic = 0, parked = 0; for (const c of g.cars) { if (c.park) parked++; else if (c.drv === 1) traffic++; }
    const tries = init ? 300 : 5;
    for (let t = 0; t < tries && traffic < 30; t++) if (spawnCar(g, init, false, false)) traffic++;
    for (let t = 0; t < tries && parked < 18; t++) if (spawnCar(g, init, false, true)) parked++;
    for (let t = 0; t < tries && g.peds.length < 45; t++) spawnPed(g, init);
    for (let t = 0; t < tries && g.ans.length < 14; t++) spawnAni(g, init);
  }
  // camera
  const cy = Math.cos(g.yaw), sy = Math.sin(g.yaw);
  const shoulder = p.car ? 0 : 0.7;
  g.tx = p.x - sy * shoulder; g.tz = p.z + cy * shoulder; g.ty = p.car ? 1.8 : p.y + 1.6;
  const dist = p.car ? 10 : g.aiming ? 3.2 : 5.5, cp = Math.cos(g.pitch);
  let ex = g.tx - cy * cp * dist, ey = g.ty + Math.sin(g.pitch) * dist, ez = g.tz - sy * cp * dist;
  for (let i = 1; i <= 10; i++) { const f = i / 10, qx = g.tx + (ex - g.tx) * f, qz = g.tz + (ez - g.tz) * f, qy = g.ty + (ey - g.ty) * f; if (solidAtH(g.B, qx, qz, qy)) { const f2 = Math.max(0.1, f - 0.12); ex = g.tx + (ex - g.tx) * f2; ey = g.ty + (ey - g.ty) * f2; ez = g.tz + (ez - g.tz) * f2; break; } }
  if (ey < 0.3) ey = 0.3;
  const s = g.shake; g.shake *= Math.pow(0.02, dt);
  g.ex = ex + rr(-s, s); g.ey = ey + rr(-s, s); g.ez = ez + rr(-s, s);
  g.aimP = Math.atan2(g.ty - ey, Math.hypot(g.tx - ex, g.tz - ez));
}
export function txt(c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, col: string, al: CanvasTextAlign): void {
  c.font = `bold ${size}px system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif`; c.textAlign = al; c.textBaseline = "middle";
  c.lineWidth = 4; c.strokeStyle = "rgba(0,0,0,0.75)"; c.strokeText(s, x, y); c.fillStyle = col; c.fillText(s, x, y);
}
export function drawStar(c: CanvasRenderingContext2D, x: number, y: number, r: number): void { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 === 0 ? r : r * 0.45; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); }
export function hud(g: Game, c: CanvasRenderingContext2D, W: number, H: number): void {
  c.clearRect(0, 0, W, H);
  const p = g.p, small = W < 620, t = g.t;
  if (g.flash > 0) { c.fillStyle = `rgba(255,220,150,${g.flash * 2})`; c.fillRect(0, 0, W, H); }
  if (g.hurtT > 0) { c.fillStyle = `rgba(200,0,0,${g.hurtT * 0.6})`; c.fillRect(0, 0, W, H); }
  if (g.started && p.dead <= 0 && (!p.car || g.mDown)) { const s = g.aiming ? 5 : 9; c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2 - s - 4, H / 2); c.lineTo(W / 2 - 4, H / 2); c.moveTo(W / 2 + 4, H / 2); c.lineTo(W / 2 + s + 4, H / 2); c.moveTo(W / 2, H / 2 - s - 4); c.lineTo(W / 2, H / 2 - 4); c.moveTo(W / 2, H / 2 + 4); c.lineTo(W / 2, H / 2 + s + 4); c.stroke(); c.fillStyle = "#fff"; c.fillRect(W / 2 - 1, H / 2 - 1, 2, 2); }
  const ms = small ? 110 : 150, mcx = 14 + ms / 2, mcy = H - 14 - ms / 2, S = 1.1;
  c.save(); c.beginPath(); c.arc(mcx, mcy, ms / 2, 0, Math.PI * 2); c.fillStyle = "#2d6a2d"; c.fill(); c.clip();
  c.translate(mcx, mcy); c.rotate(-g.yaw - Math.PI / 2); c.scale(S, S);
  c.drawImage(g.mini, -p.x, -p.z);
  for (const pk of g.picks) if (pk.resp === 0 && !pk.tmp && pk.k === 0) { c.fillStyle = "#ffd54f"; c.fillRect(pk.x - p.x - 1.5, pk.z - p.z - 1.5, 3, 3); }
  for (const k of g.cars) if (k.drv === 3) { c.fillStyle = Math.floor(t * 6) % 2 ? "#ff1744" : "#2979ff"; c.beginPath(); c.arc(k.x - p.x, k.z - p.z, 3.5, 0, Math.PI * 2); c.fill(); }
  if (g.b.mode !== 2) { const bd = g.b; let ox = bd.x - p.x, oz = bd.z - p.z; const lim = ms / 2 / S - 5, ol = Math.hypot(ox, oz); if (ol > lim) { ox *= lim / ol; oz *= lim / ol; } c.fillStyle = bd.dead > 0 ? "#888888" : "#00e676"; c.strokeStyle = "#000"; c.lineWidth = 1; c.beginPath(); c.arc(ox, oz, 4, 0, Math.PI * 2); c.fill(); c.stroke(); }
  c.restore();
  c.save(); c.translate(mcx, mcy); c.rotate((p.car ? p.car.a : p.a) - g.yaw - Math.PI / 2); c.fillStyle = "#fff"; c.strokeStyle = "#000"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(8, 0); c.lineTo(-6, -6); c.lineTo(-2, 0); c.lineTo(-6, 6); c.closePath(); c.fill(); c.stroke(); c.restore();
  c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 2.5; c.beginPath(); c.arc(mcx, mcy, ms / 2, 0, Math.PI * 2); c.stroke();
  c.direction = "ltr";
  const rx0 = W - 14;
  txt(c, "$" + p.money.toLocaleString("en-US"), rx0, 26, small ? 18 : 24, "#7CFC7C", "right");
  const bw = small ? 110 : 160;
  c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(rx0 - bw, 46, bw, 11); c.fillStyle = p.hp > 35 ? "#43a047" : "#e53935"; c.fillRect(rx0 - bw + 1, 47, ((bw - 2) * p.hp) / 100, 9);
  const sN = stars(g), bl = sN > 0 && Math.floor(t * 4) % 2 === 0;
  for (let i = 0; i < 5; i++) { drawStar(c, rx0 - 10 - i * 24, 76, 10); if (i < sN) { c.fillStyle = bl ? "#fff59d" : "#ffc107"; c.fill(); } c.lineWidth = 2; c.strokeStyle = i < sN ? "#5d4037" : "rgba(255,255,255,0.55)"; c.stroke(); }
  txt(c, WP[p.w].n + (p.w > 0 ? "  " + p.ammo[p.w] : ""), rx0, 104, small ? 15 : 18, "#ffffff", "right");
  if (g.pad.on) txt(c, "🎮", rx0, 128, 16, "#ffffff", "right");
  if (p.car) txt(c, `${p.car.t.n} — ${Math.round(Math.hypot(p.car.vx, p.car.vz) * 2.237)} mph — ${Math.max(0, Math.round((p.car.hp / p.car.t.hp) * 100))}%`, W / 2, H - 26, small ? 14 : 17, "#ffffff", "center");
  bHud(g, c, W, H, small); vHud(c, W, small);
  g.msgs.forEach((m: { s: string; l: number }, i: number) => { c.globalAlpha = Math.min(1, m.l * 2); txt(c, m.s, W / 2, 40 + i * 30, small ? 16 : 21, "#ffffff", "center"); c.globalAlpha = 1; });
  if (g.big) {
    const sz = Math.min(W, H) * 0.86, sc2 = sz / WORLD, x = (W - sz) / 2, y = (H - sz) / 2;
    c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(0, 0, W, H); c.drawImage(g.mini, x, y, sz, sz);
    for (const k of g.cars) if (k.drv === 3) { c.fillStyle = "#ff1744"; c.beginPath(); c.arc(x + k.x * sc2, y + k.z * sc2, 3, 0, Math.PI * 2); c.fill(); }
    if (g.b.mode !== 2) { c.fillStyle = "#00e676"; c.beginPath(); c.arc(x + g.b.x * sc2, y + g.b.z * sc2, 4.5, 0, Math.PI * 2); c.fill(); txt(c, "Sultan", x + g.b.x * sc2, y + g.b.z * sc2 - 12, 12, "#9cff9c", "center"); }
    c.fillStyle = "#fff"; c.beginPath(); c.arc(x + p.x * sc2, y + p.z * sc2, 5, 0, Math.PI * 2); c.fill(); c.strokeStyle = "#e53935"; c.lineWidth = 2; c.beginPath(); c.arc(x + p.x * sc2, y + p.z * sc2, 9 + Math.sin(t * 6) * 2, 0, Math.PI * 2); c.stroke();
  }
  if (p.dead > 0) { c.fillStyle = "rgba(120,0,0,0.35)"; c.fillRect(0, 0, W, H); txt(c, "WASTED", W / 2, H / 2 - 10, small ? 34 : 54, "#ff5252", "center"); txt(c, "Taking you to the hospital...", W / 2, H / 2 + 38, 18, "#ffffff", "center"); }
  c.direction = "ltr";
}

export const HELP_KB: [string, string][] = [
  ["WASD", "Move (camera-relative) / drive"],
  ["Mouse", "Look around (click the game to lock the mouse)"],
  ["Left / right click", "Shoot / aim & zoom"],
  ["F or E", "Get in / out of the nearest car"],
  ["Shift", "Sprint"],
  ["Space", "Jump / handbrake"],
  ["1 - 7 / Q / mouse wheel", "Switch weapon"],
  ["Arrow keys", "Rotate camera (mouse alternative)"],
  ["M", "Big map"],
  ["G then Enter", "Sultan commands: follow / wait / wander / come (G cycles, Enter confirms)"],
  ["V", "Mic: talk to Sultan in Arabic (Chrome / Edge) — e.g. تعال، انتظر، اضرب، لا تضرب، شلونك"],
  ["B", "Sultan's voice on / off"],
  ["Esc", "Pause"],
];
export const HELP_PAD: [string, string][] = [
  ["Left stick", "Move / steer"],
  ["Right stick", "Camera"],
  ["R2", "Shoot / gas"],
  ["L2", "Aim / brake & reverse"],
  ["△ Triangle", "Get in / out"],
  ["✕ Cross", "Jump / handbrake"],
  ["□ Square", "Punch"],
  ["L1 / R1", "Switch weapon"],
  ["L3", "Sprint"],
  ["D-pad up", "Map"],
  ["D-pad down / ✕", "Sultan commands (cycle / confirm)"],
  ["R3 (click right stick)", "Mic: talk to Sultan"],
  ["Options", "Pause / resume"],
];