import * as THREE from "three";
import { rng } from "../logic";

type C2 = CanvasRenderingContext2D;
function cv(w: number, h: number): [HTMLCanvasElement, C2] { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d") as C2; return [c, x]; }
function tex(c: HTMLCanvasElement, srgb: boolean, aniso: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}
function noise(x: C2, w: number, h: number, base: [number, number, number], amp: number, n: number, r: () => number, size: number): void {
  x.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; x.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) { const v = (r() - 0.5) * amp; x.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`; const s = size * (0.5 + r()); x.fillRect(r() * w, r() * h, s, s); }
}
// window rect within a facade cell (shared by all facades so one lit-map fits all)
export const WIN = { x0: 0.16, x1: 0.84, y0: 0.22, y1: 0.86 };

export type Tex = Record<string, THREE.Texture>;
export function makeTextures(aniso: number): Tex {
  const r = rng(777), T: Tex = {};
  { const [c, x] = cv(512, 512); noise(x, 512, 512, [58, 61, 66], 70, 26000, r, 2); for (let i = 0; i < 2600; i++) { const g = 70 + r() * 60; x.fillStyle = `rgba(${g},${g},${g},0.5)`; x.fillRect(r() * 512, r() * 512, 1.5, 1.5); }
    x.strokeStyle = "rgba(20,20,22,0.35)"; x.lineWidth = 1.2; for (let i = 0; i < 6; i++) { x.beginPath(); let px = r() * 512, py = r() * 512; x.moveTo(px, py); for (let k = 0; k < 8; k++) { px += (r() - 0.5) * 50; py += (r() - 0.5) * 50; x.lineTo(px, py); } x.stroke(); }
    T.asphalt = tex(c, true, aniso); }
  { const [c, x] = cv(512, 512); noise(x, 512, 512, [176, 172, 163], 40, 9000, r, 2); x.strokeStyle = "rgba(90,86,80,0.55)"; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(0, i * 128); x.lineTo(512, i * 128); x.stroke(); x.beginPath(); x.moveTo(i * 128, 0); x.lineTo(i * 128, 512); x.stroke(); } T.sidewalk = tex(c, true, aniso); }
  { const [c, x] = cv(512, 512); noise(x, 512, 512, [198, 186, 160], 35, 8000, r, 2); x.strokeStyle = "rgba(120,105,85,0.5)"; x.lineWidth = 2; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(0, i * 64); x.lineTo(512, i * 64); x.stroke(); } for (let j = 0; j < 8; j++) for (let i = 0; i <= 4; i++) { const ox = (j % 2) * 64; x.beginPath(); x.moveTo(i * 128 + ox, j * 64); x.lineTo(i * 128 + ox, j * 64 + 64); x.stroke(); } T.plaza = tex(c, true, aniso); }
  { const [c, x] = cv(512, 512); noise(x, 512, 512, [74, 122, 52], 50, 14000, r, 3); for (let i = 0; i < 9000; i++) { const gg = 90 + r() * 90; x.strokeStyle = `rgba(${40 + r() * 40},${gg},${30 + r() * 30},0.7)`; x.lineWidth = 1; const px = r() * 512, py = r() * 512; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 4, py - 3 - r() * 6); x.stroke(); } T.grass = tex(c, true, aniso); }
  { const [c, x] = cv(512, 512); noise(x, 512, 512, [214, 178, 122], 35, 16000, r, 2); x.strokeStyle = "rgba(170,130,80,0.25)"; x.lineWidth = 3; for (let i = 0; i < 40; i++) { x.beginPath(); const py = r() * 512; x.moveTo(0, py); for (let k = 0; k <= 16; k++) x.lineTo(k * 32, py + Math.sin(k * 0.8 + i) * 6); x.stroke(); } T.sand = tex(c, true, aniso); }
  { const [c, x] = cv(256, 256); noise(x, 256, 256, [120, 118, 112], 50, 6000, r, 2); T.roof = tex(c, true, aniso); }
  { const [c, x] = cv(256, 256); noise(x, 256, 256, [236, 228, 212], 22, 4000, r, 2); T.plaster = tex(c, true, aniso); }
  // facades: 4x4 cells at 128px each
  const facade = (frame: string, glassA: string, glassB: string, style: number): THREE.CanvasTexture => {
    const [c, x] = cv(512, 512); noise(x, 512, 512, [235, 235, 235], 18, 5000, r, 2);
    if (style === 1) { x.fillStyle = frame; x.fillRect(0, 0, 512, 512); }
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const X = i * 128, Y = j * 128;
      if (style === 1) { const gr = x.createLinearGradient(X, Y, X + 128, Y + 128); gr.addColorStop(0, glassA); gr.addColorStop(1, glassB); x.fillStyle = gr; x.fillRect(X + 3, Y + 3, 122, 122); x.fillStyle = "rgba(255,255,255,0.12)"; x.fillRect(X + 3, Y + 3, 122, 20); x.fillStyle = "rgba(30,40,50,0.6)"; x.fillRect(X, Y + 120, 128, 8); continue; }
      const wx0 = X + WIN.x0 * 128, wy0 = Y + (1 - WIN.y1) * 128, ww = (WIN.x1 - WIN.x0) * 128, wh = (WIN.y1 - WIN.y0) * 128;
      x.fillStyle = "rgba(0,0,0,0.25)"; x.fillRect(wx0 - 4, wy0 - 4, ww + 8, wh + 8);
      x.fillStyle = frame; x.fillRect(wx0 - 3, wy0 - 3, ww + 6, wh + 6);
      const gr = x.createLinearGradient(wx0, wy0, wx0 + ww, wy0 + wh); gr.addColorStop(0, glassA); gr.addColorStop(1, glassB); x.fillStyle = gr; x.fillRect(wx0, wy0, ww, wh);
      x.fillStyle = "rgba(255,255,255,0.15)"; x.beginPath(); x.moveTo(wx0, wy0 + wh * 0.7); x.lineTo(wx0 + ww * 0.45, wy0); x.lineTo(wx0 + ww * 0.6, wy0); x.lineTo(wx0, wy0 + wh); x.fill();
      x.fillStyle = frame; x.fillRect(wx0 + ww / 2 - 1.5, wy0, 3, wh);
      if (style === 2) { x.fillStyle = "rgba(120,80,40,0.9)"; x.fillRect(wx0 - 12, wy0, 9, wh); x.fillRect(wx0 + ww + 3, wy0, 9, wh); }
      if (style === 3) { x.fillStyle = "rgba(60,60,60,0.8)"; x.fillRect(wx0 - 6, wy0 + wh + 4, ww + 12, 5); }
      x.fillStyle = "rgba(0,0,0,0.12)"; x.fillRect(X, Y + 124, 128, 4);
    }
    return tex(c, true, aniso);
  };
  T.office = facade("#8a8f96", "#2a3a4c", "#5a7690", 0);
  T.glass = facade("#3b4650", "#5d7f9c", "#a9c4d8", 1);
  T.villa = facade("#ffffff", "#24323d", "#4d6475", 2);
  T.apart = facade("#d7d2c8", "#2d3b47", "#5e7486", 3);
  // lit windows (16x16 cells, 64px each) for night emissive
  { const [c, x] = cv(1024, 1024); x.fillStyle = "#000"; x.fillRect(0, 0, 1024, 1024);
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { if (r() < 0.42) continue; const X = i * 64, Y = j * 64; const warm = r() < 0.75; const v = 0.55 + r() * 0.45; x.fillStyle = warm ? `rgba(255,${190 + r() * 40},${110 + r() * 50},${v})` : `rgba(${170 + r() * 40},${210 + r() * 30},255,${v})`; x.fillRect(X + WIN.x0 * 64, Y + (1 - WIN.y1) * 64, (WIN.x1 - WIN.x0) * 64, (WIN.y1 - WIN.y0) * 64); }
    T.lit = tex(c, true, aniso); }
  // shemagh red/white checker
  { const [c, x] = cv(128, 128); x.fillStyle = "#f4f1ec"; x.fillRect(0, 0, 128, 128); x.fillStyle = "#c62828"; for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) if ((i + j) % 2 === 0 && (i % 4 !== 3) && (j % 4 !== 3)) x.fillRect(i * 8 + 1, j * 8 + 1, 6, 6); T.shemagh = tex(c, true, aniso); }
  // tree bark
  { const [c, x] = cv(128, 256); noise(x, 128, 256, [96, 72, 52], 60, 3000, r, 2); x.strokeStyle = "rgba(40,28,18,0.6)"; for (let i = 0; i < 30; i++) { x.lineWidth = 1 + r() * 2; x.beginPath(); const px = r() * 128; x.moveTo(px, 0); x.lineTo(px + (r() - 0.5) * 10, 256); x.stroke(); } T.bark = tex(c, true, aniso); }
  { const [c, x] = cv(128, 256); noise(x, 128, 256, [140, 110, 76], 40, 2000, r, 2); x.fillStyle = "rgba(70,50,30,0.55)"; for (let j = 0; j < 256; j += 16) { x.fillRect(0, j, 128, 4); } T.palm = tex(c, true, aniso); }
  return T;
}

// sign atlas: rows of 512x128 labels
export function makeSignAtlas(names: string[], font: string): { tex: THREE.CanvasTexture; rows: number; idx: Record<string, number> } {
  const rows = Math.max(1, names.length), [c, x] = cv(512, 128 * rows), idx: Record<string, number> = {};
  const pal = ["#c62828", "#1565c0", "#2e7d32", "#ef6c00", "#6a1b9a", "#00838f", "#ad1457", "#4e342e", "#283593"];
  names.forEach((n: string, i: number) => {
    idx[n] = i; const Y = i * 128;
    const bg = n === "HOSPITAL" ? "#ffffff" : pal[i % pal.length];
    x.fillStyle = bg; x.fillRect(0, Y, 512, 128); x.fillStyle = "rgba(255,255,255,0.18)"; x.fillRect(0, Y, 512, 10);
    x.direction = "rtl"; x.textAlign = "center"; x.textBaseline = "middle";
    x.font = `800 64px ${font}`; x.fillStyle = n === "HOSPITAL" ? "#d32f2f" : "#ffffff"; x.fillText(n, 256, Y + 68, 480);
    if (n === "HOSPITAL") { x.fillStyle = "#d32f2f"; x.fillRect(48, Y + 34, 24, 64); x.fillRect(28, Y + 54, 64, 24); }
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  return { tex: t, rows, idx };
}
