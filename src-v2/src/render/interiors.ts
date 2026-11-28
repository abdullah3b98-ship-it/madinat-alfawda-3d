import * as THREE from "three";
import { GB, col } from "./geo";
import { buildRig, randomLook, Rig } from "./human";
import type { DoorKind } from "../world";

export type Hot = { x: number; z: number; r: number; id: string; label: string };
export type Interior = { kind: DoorKind; scene: THREE.Scene; w: number; d: number; boxes: number[][]; hots: Hot[]; spawn: { x: number; z: number; a: number }; npc: Rig | null; npcPos: { x: number; z: number; a: number }; tv: THREE.MeshStandardMaterial | null; light: THREE.PointLight[] };

function cvTex(w: number, h: number, f: (x: CanvasRenderingContext2D) => void, rep: number): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d") as CanvasRenderingContext2D; f(x);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t;
}
let TX: Record<string, THREE.Texture> | null = null;
function tx(): Record<string, THREE.Texture> {
  if (TX) return TX;
  const tile = cvTex(256, 256, (x) => { x.fillStyle = "#e9e6df"; x.fillRect(0, 0, 256, 256); x.strokeStyle = "#b9b3a8"; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 256); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke(); } for (let i = 0; i < 2000; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } }, 1);
  const wood = cvTex(256, 256, (x) => { x.fillStyle = "#8a5a33"; x.fillRect(0, 0, 256, 256); for (let j = 0; j < 8; j++) { x.fillStyle = `rgba(${90 + Math.random() * 40},${55 + Math.random() * 20},${30},0.6)`; x.fillRect(0, j * 32, 256, 31); x.strokeStyle = "rgba(40,20,10,0.5)"; x.beginPath(); x.moveTo(0, j * 32); x.lineTo(256, j * 32); x.stroke(); x.beginPath(); const o = Math.random() * 256; x.moveTo(o, j * 32); x.lineTo(o, j * 32 + 32); x.stroke(); } for (let i = 0; i < 300; i++) { x.strokeStyle = "rgba(50,25,10,0.15)"; x.beginPath(); const y = Math.random() * 256; x.moveTo(0, y); x.bezierCurveTo(80, y + 4, 160, y - 4, 256, y); x.stroke(); } }, 1);
  const rug = cvTex(256, 256, (x) => { x.fillStyle = "#7b1f1f"; x.fillRect(0, 0, 256, 256); x.strokeStyle = "#e0c080"; x.lineWidth = 8; x.strokeRect(14, 14, 228, 228); x.lineWidth = 3; x.strokeRect(34, 34, 188, 188); for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(128, 128, 20 + i * 14, 0, Math.PI * 2); x.stroke(); } }, 1);
  TX = { tile, wood, rug }; return TX;
}
const Mm = (o: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial(o);

export function buildInterior(kind: DoorKind, signName: string): Interior {
  const T = tx(), scene = new THREE.Scene(); scene.background = new THREE.Color(0x101215);
  const W = kind === "home" ? 18 : kind === "market" ? 18 : 14, D = kind === "home" ? 14 : 12, H = 3.6;
  const boxes: number[][] = [], hots: Hot[] = [];
  const det = new GB(), m4 = new THREE.Matrix4();
  const B = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: string, solid = true): void => { det.box(x0, y0, z0, x1, y1, z1, col(c), 1, 1, 0, 0, true, true); if (solid) boxes.push([x0, z0, x1, z1]); };
  // floor/walls/ceiling
  const floorT = (kind === "home" || kind === "rest" || kind === "hotel" ? T.wood : T.tile).clone(); floorT.repeat.set(W / 3, D / 3); floorT.needsUpdate = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), Mm({ map: floorT, roughness: kind === "market" ? 0.35 : 0.6 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wallC = kind === "home" ? "#efe6d6" : kind === "rest" ? "#e9d2b0" : kind === "hotel" ? "#e8e1d4" : "#f4f4f0";
  const wm = Mm({ color: wallC, roughness: 0.9 });
  const mkWall = (w: number, x: number, z: number, ry: number): void => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), wm); m.position.set(x, H / 2, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); };
  mkWall(W, 0, -D / 2, 0); mkWall(W, 0, D / 2, Math.PI); mkWall(D, -W / 2, 0, Math.PI / 2); mkWall(D, W / 2, 0, -Math.PI / 2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), Mm({ color: "#f7f7f7", roughness: 1 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; scene.add(ceil);
  // skirting + door frame at +z
  B(-W / 2, 0, -D / 2, W / 2, 0.12, -D / 2 + 0.04, "#6d5a48", false);
  B(-0.8, 0, D / 2 - 0.08, 0.8, 2.4, D / 2 - 0.02, kind === "market" ? "#3a4a55" : "#5d3a1a", false);
  hots.push({ x: 0, z: D / 2 - 0.9, r: 1.3, id: "exit", label: "Press E to exit" });
  // lights
  const lights: THREE.PointLight[] = [];
  const amb = new THREE.HemisphereLight(0xfff6e8, 0x6b5a48, 1.0); scene.add(amb);
  const nl = kind === "home" ? 3 : 2;
  for (let i = 0; i < nl; i++) { const l = new THREE.PointLight(0xffe2b8, 14, 16, 1.5); l.position.set(-W / 4 + (i * W) / (2 * Math.max(1, nl - 1)) * (nl > 1 ? 1 : 0), H - 0.3, 0); if (i === 0) { l.castShadow = true; l.shadow.mapSize.set(512, 512); } scene.add(l); lights.push(l); det.geo(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 16), m4.makeTranslation(l.position.x, H - 0.03, 0), col("#fffdf5")); }
  let npc: Rig | null = null, npcPos = { x: 0, z: 0, a: 0 }, tv: THREE.MeshStandardMaterial | null = null;
  const R = Math.random;
  if (kind === "market") {
    // shelves rows with products
    const prod = new GB(); const pcols = ["#e53935", "#1e88e5", "#43a047", "#fdd835", "#fb8c00", "#8e24aa", "#00acc1", "#f4511e", "#ffffff", "#6d4c41"];
    const cats = ["drinks", "snacks", "canned food", "household"];
    for (let r = 0; r < 4; r++) {
      const z = -D / 2 + 2.2 + r * 2.3, x0 = -W / 2 + 3, x1 = W / 2 - 5;
      B(x0, 0, z - 0.35, x1, 1.9, z + 0.35, "#d0d4d8");
      for (let lvl = 0; lvl < 4; lvl++) { const y = 0.25 + lvl * 0.45; for (let x = x0 + 0.15; x < x1 - 0.2; x += 0.22 + R() * 0.06) for (const s of [-1, 1]) { const h = 0.15 + R() * 0.2, c = pcols[Math.floor(R() * pcols.length)]; prod.box(x, y, z + s * 0.36 - (s > 0 ? 0 : 0.0), x + 0.17, y + h, z + s * 0.36 + s * 0.12, col(c), 1, 1, 0, 0, true, false); } }
      hots.push({ x: (x0 + x1) / 2, z: z + 0.85, r: 1.6, id: "shelf:" + r, label: "E buy " + cats[r] + " — R steal" });
      hots.push({ x: (x0 + x1) / 2, z: z - 0.85, r: 1.6, id: "shelf:" + r, label: "E buy " + cats[r] + " — R steal" });
    }
    const pm = new THREE.Mesh(prod.build(), Mm({ vertexColors: true, roughness: 0.5 })); scene.add(pm);
    // fridges wall
    B(W / 2 - 1.1, 0, -D / 2 + 0.5, W / 2 - 0.1, 2.3, D / 2 - 3.5, "#b0bec5");
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(D - 4, 2), Mm({ color: "#bfe6ff", emissive: new THREE.Color("#9fd8ff"), emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.8 })); fg.rotation.y = -Math.PI / 2; fg.position.set(W / 2 - 1.12, 1.2, -1.5); scene.add(fg);
    hots.push({ x: W / 2 - 1.9, z: -1.5, r: 2.2, id: "shelf:0", label: "E buy from the cooler — R steal" });
    // counter + cashier
    B(-W / 2 + 0.5, 0, D / 2 - 3.6, -W / 2 + 4, 1.0, D / 2 - 2.6, "#795548"); B(-W / 2 + 1.2, 1.0, D / 2 - 3.3, -W / 2 + 1.8, 1.3, D / 2 - 2.9, "#222");
    npcPos = { x: -W / 2 + 2.2, z: D / 2 - 4.3, a: Math.PI / 2 };
  } else if (kind === "rest") {
    for (let i = 0; i < 6; i++) { const tx0 = -W / 2 + 2.5 + (i % 3) * 3.8, tz = -1 + Math.floor(i / 3) * 3.4; B(tx0 - 0.6, 0.72, tz - 0.6, tx0 + 0.6, 0.78, tz + 0.6, "#5d4037", false); boxes.push([tx0 - 0.6, tz - 0.6, tx0 + 0.6, tz + 0.6]); det.geo(new THREE.CylinderGeometry(0.06, 0.1, 0.72, 8), m4.makeTranslation(tx0, 0.36, tz), col("#3e2723")); for (const s of [-1, 1]) { B(tx0 - 0.22, 0.42, tz + s * 0.95 - 0.22, tx0 + 0.22, 0.47, tz + s * 0.95 + 0.22, "#8d6e63", false); B(tx0 - 0.22, 0.47, tz + s * 1.15 - 0.03, tx0 + 0.22, 0.95, tz + s * 1.15 + 0.03, "#8d6e63", false); } }
    B(-W / 2 + 0.3, 0, -D / 2 + 0.3, W / 2 - 0.3, 1.05, -D / 2 + 1.4, "#a1887f");
    const menu = cvTex(512, 256, (x) => { x.fillStyle = "#1b1b1b"; x.fillRect(0, 0, 512, 256); x.fillStyle = "#ffcc80"; x.font = "bold 36px Cairo, sans-serif"; x.textAlign = "center"; x.fillText(signName || "MENU", 256, 46); x.font = "28px Cairo, sans-serif"; x.fillStyle = "#fff"; ["Cheeseburger — $14", "Pancakes — $10", "Steak — $32", "Milkshake — $6"].forEach((s: string, i: number) => x.fillText(s, 256, 100 + i * 40)); }, 1);
    const mb = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), Mm({ map: menu, emissiveMap: menu, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.6 })); mb.position.set(0, 2.5, -D / 2 + 0.02); scene.add(mb);
    hots.push({ x: 0, z: -D / 2 + 2.2, r: 1.8, id: "menu", label: "Press E to order food" });
    npcPos = { x: 1.5, z: -D / 2 + 0.85, a: Math.PI / 2 };
  } else if (kind === "hotel") {
    B(-3, 0, -D / 2 + 1.5, 3, 1.1, -D / 2 + 2.3, "#4e342e"); B(-3.1, 1.1, -D / 2 + 1.45, 3.1, 1.16, -D / 2 + 2.35, "#d7ccc8", false);
    for (const s of [-1, 1]) { B(s * 5 - 1, 0, 1, s * 5 + 1, 0.45, 2, "#283593"); B(s * 5 - 1, 0.45, 1.85, s * 5 + 1, 0.95, 2, "#1a237e", false); det.geo(new THREE.CylinderGeometry(0.3, 0.3, 1.8, 10), m4.makeTranslation(s * 6.3, 0.9, -3), col("#2e7d32")); }
    const plant = Mm({ color: "#2e7d32" }); void plant;
    hots.push({ x: 0, z: -D / 2 + 3.2, r: 1.8, id: "room", label: "Press E to rent a room ($120) — sleep & save" });
    npcPos = { x: 0, z: -D / 2 + 0.9, a: Math.PI / 2 };
  } else if (kind === "clothes") {
    for (let i = 0; i < 4; i++) { const rx = -W / 2 + 2.5 + i * 3; B(rx - 0.05, 0, -2, rx + 0.05, 1.6, 2, "#9e9e9e"); for (let k = 0; k < 10; k++) B(rx - 0.25, 0.7, -1.8 + k * 0.4, rx + 0.25, 1.5, -1.8 + k * 0.4 + 0.08, ["#e53935", "#1e88e5", "#f5f5f5", "#212121", "#43a047", "#8d6e63"][k % 6], false); }
    hots.push({ x: 0, z: -D / 2 + 2, r: 2.2, id: "outfits", label: "Press E to try on & buy clothes" });
    B(-1.5, 0, -D / 2 + 0.3, 1.5, 1, -D / 2 + 1, "#5d4037");
    npcPos = { x: 0, z: -D / 2 + 0.6, a: Math.PI / 2 };
  } else if (kind === "home") {
    // living room: L sofa, coffee table, TV, rug
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), Mm({ map: T.rug, roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(-4, 0.01, 1); scene.add(rug);
    B(-7.5, 0, -0.5, -4.5, 0.45, 0.4, "#5d6d7e"); B(-7.5, 0.45, -0.5, -4.5, 0.95, -0.25, "#4f5d6b", false); B(-7.5, 0, 0.4, -6.6, 0.45, 3.0, "#5d6d7e"); B(-7.5, 0.45, 0.4, -7.25, 0.95, 3.0, "#4f5d6b", false);
    for (let i = 0; i < 3; i++) B(-7.3 + i * 0.95, 0.45, -0.2, -6.45 + i * 0.95, 0.62, 0.35, "#6c7b8a", false);
    B(-4.9, 0, 0.8, -3.1, 0.42, 1.8, "#6d4c41");
    B(-4.6, 0, 4.4, -2.4, 0.55, 4.9, "#3e2723"); // TV stand (near front wall)
    const tvm = Mm({ color: "#050505", emissive: new THREE.Color("#3060ff"), emissiveIntensity: 0, roughness: 0.2 }); tv = tvm;
    const scr = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.15, 0.06), tvm); scr.position.set(-3.5, 1.3, 4.75); scene.add(scr);
    hots.push({ x: -5.8, z: 1.0, r: 1.6, id: "sofa", label: "Press E to sit on the couch" });
    hots.push({ x: -3.5, z: 3.7, r: 1.3, id: "tv", label: "Press E to turn the TV on / off" });
    // kitchen: fridge + counters (back-right)
    B(W / 2 - 1, 0, -D / 2 + 0.3, W / 2 - 0.2, 2.1, -D / 2 + 1.2, "#eceff1");
    det.box(W / 2 - 1.02, 1.0, -D / 2 + 0.35, W / 2 - 1.0, 1.9, -D / 2 + 1.15, col("#b0bec5"), 1, 1, 0, 0, false, false);
    B(W / 2 - 5, 0, -D / 2 + 0.3, W / 2 - 1.1, 0.95, -D / 2 + 1.0, "#8d6e63"); B(W / 2 - 5, 0.95, -D / 2 + 0.3, W / 2 - 1.1, 1.0, -D / 2 + 1.0, "#eeeeee", false);
    hots.push({ x: W / 2 - 1.6, z: -D / 2 + 2.0, r: 1.4, id: "fridge", label: "Press E to open the fridge" });
    // dining table + chairs
    B(1.5, 0.74, -2.5, 4.0, 0.8, -1.2, "#5d4037", false); boxes.push([1.5, -2.5, 4, -1.2]);
    for (const q of [[1.9, -3.1], [3.5, -3.1], [1.9, -0.6], [3.5, -0.6]]) { B(q[0] - 0.22, 0.44, q[1] - 0.22, q[0] + 0.22, 0.49, q[1] + 0.22, "#795548", false); B(q[0] - 0.22, 0.49, q[1] + (q[1] < -2 ? -0.22 : 0.19), q[0] + 0.22, 1.0, q[1] + (q[1] < -2 ? -0.19 : 0.22), "#795548", false); }
    // bedroom (back-left): bed, nightstand, wardrobe
    B(-8.7, 0, -D / 2 + 0.3, -6.3, 0.55, -D / 2 + 2.6, "#5d4037"); B(-8.6, 0.55, -D / 2 + 0.4, -6.4, 0.75, -D / 2 + 2.5, "#f5f5f5", false); B(-8.5, 0.75, -D / 2 + 0.45, -7.6, 0.9, -D / 2 + 0.9, "#ffffff", false); B(-7.4, 0.75, -D / 2 + 0.45, -6.5, 0.9, -D / 2 + 0.9, "#ffffff", false); B(-8.6, 0.76, -D / 2 + 1.2, -6.4, 0.82, -D / 2 + 2.5, "#1565c0", false);
    B(-8.7, 0.3, -D / 2 + 0.05, -6.3, 1.5, -D / 2 + 0.3, "#4e342e"); B(-5.9, 0, -D / 2 + 0.3, -5.3, 0.6, -D / 2 + 0.8, "#6d4c41");
    B(-4.6, 0, -D / 2 + 0.2, -2.6, 2.4, -D / 2 + 0.9, "#8d6e63");
    hots.push({ x: -7.5, z: -D / 2 + 3.2, r: 1.5, id: "bed", label: "Press E to sleep (save + pass time)" });
    hots.push({ x: -3.6, z: -D / 2 + 1.6, r: 1.3, id: "wardrobe", label: "Press E to change clothes" });
    // partition wall between living and bedroom
    B(-9, 0, -1.6, -4.8, H, -1.45, wallC); B(-2.4, 0, -1.6, -1.0, H, -1.45, wallC);
    // plants
    for (const q of [[7.8, 5.6], [-8.4, 5.6]]) { det.geo(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 12), m4.makeTranslation(q[0], 0.25, q[1]), col("#6d4c41")); det.geo(new THREE.IcosahedronGeometry(0.55, 1), m4.makeTranslation(q[0], 0.95, q[1]), col("#2e7d32")); boxes.push([q[0] - 0.3, q[1] - 0.3, q[0] + 0.3, q[1] + 0.3]); }
  }
  const dm = new THREE.Mesh(det.build(), Mm({ vertexColors: true, roughness: 0.7 })); dm.castShadow = true; dm.receiveShadow = true; scene.add(dm);
  if (kind !== "home") { npc = buildRig(randomLook(Math.random)); npc.root.position.set(npcPos.x, 0, npcPos.z); npc.root.rotation.y = Math.PI / 2 - npcPos.a; scene.add(npc.root); }
  return { kind, scene, w: W, d: D, boxes, hots, spawn: { x: 0, z: D / 2 - 1.6, a: -Math.PI / 2 }, npc, npcPos, tv, light: lights };
}

export function blockedIn(I: Interior, x: number, z: number, r: number): boolean {
  if (x < -I.w / 2 + r || x > I.w / 2 - r || z < -I.d / 2 + r || z > I.d / 2 - r) return true;
  for (const b of I.boxes) if (x > b[0] - r && x < b[2] + r && z > b[1] - r && z < b[3] + r) return true;
  return false;
}
