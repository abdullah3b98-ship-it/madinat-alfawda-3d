// Optional external assets (GLB models, audio, recorded voice lines). Everything has a procedural fallback.
import * as THREE from "three";
import { GLTFLoader, GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
let RENDERER: THREE.WebGLRenderer | null = null;
export function setLoaderRenderer(r: THREE.WebGLRenderer): void { RENDERER = r; }
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type Manifest = { models: string[]; lazy?: string[]; audio: string[]; voice: Record<string, string>; ui: string[] };
export const A = { man: { models: [], audio: [], voice: {}, ui: [] } as Manifest, gltf: new Map<string, GLTF>(), ready: false };

export async function loadManifest(onProg: (f: number) => void): Promise<void> {
  try {
    const r = await fetch("assets/manifest.json", { cache: "no-cache" }); if (!r.ok) return;
    A.man = await r.json() as Manifest;
  } catch (_e) { return; }
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const draco = new DRACOLoader(); draco.setDecoderPath("decoders/draco/"); loader.setDRACOLoader(draco);
  if (RENDERER) { const k = new KTX2Loader(); k.setTranscoderPath("decoders/basis/"); k.detectSupport(RENDERER); loader.setKTX2Loader(k); }
  // LOD0 only for now (_lod1/_lod2 are switched in lazily later)
  const list = (A.man.models || []).filter((f: string) => !/_lod\d\.(glb|gltf)$/i.test(f));
  let done = 0;
  await Promise.all(list.map(async (f: string) => {
    try { const g = await loader.loadAsync("assets/" + f); A.gltf.set(f, g); regLod(f, g); } catch (_e) { /* skip broken model */ }
    done++; onProg(done / Math.max(1, list.length));
  }));
  A.ready = true; LOADER = loader;
}
let LOADER: GLTFLoader | null = null;
// LOD registry: base name -> [lod0, lod1, lod2]. NPCs boot with LOD1; LOD0/LOD2 stream in after the game starts.
export const LODS = new Map<string, (GLTF | undefined)[]>(); const LBASE = new Map<GLTF, string>();
function regLod(f: string, g: GLTF): void { const m = /_lod(\d)\.(glb|gltf)$/i.exec(f); const lv = m ? +m[1] : 0, b = base(f); let a = LODS.get(b); if (!a) { a = []; LODS.set(b, a); } a[lv] = g; LBASE.set(g, b); }
let lazyStarted = false;
export async function loadLazy(): Promise<number> {
  if (lazyStarted || !LOADER) return 0; lazyStarted = true; let n = 0;
  for (const f of A.man.lazy || []) { try { const g = await LOADER.loadAsync("assets/" + f); regLod(f, g); n++; } catch (_e) { /* keep LOD1 */ } }
  return n;
}
export function lodOf(g: GLTF, level: number): GLTF { const b = LBASE.get(g); const a = b ? LODS.get(b) : undefined; if (!a) return g; return a[level] || a[1] || a[0] || g; }
const base = (f: string): string => f.split("/").pop()!.replace(/\.(glb|gltf)$/i, "").replace(/_lod\d$/i, "").toLowerCase();
export function findModel(re: RegExp, dir?: RegExp): GLTF | null { for (const [f, g] of A.gltf) if (re.test(base(f)) && (!dir || dir.test(f))) return g; return null; }
export function findModels(re: RegExp, dir?: RegExp): GLTF[] { const o: GLTF[] = []; for (const [f, g] of A.gltf) if (re.test(base(f)) && (!dir || dir.test(f))) o.push(g); return o; }
export function hasSkin(g: GLTF): boolean { let s = false; g.scene.traverse((o: THREE.Object3D) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) s = true; }); return s; }

// character: clone skinned scene + mixer, normalized to height h and facing +z
export function cloneChar(g: GLTF, h: number): { obj: THREE.Object3D; mixer: THREE.AnimationMixer; act: Record<string, THREE.AnimationAction>; cur: string; hand: THREE.Object3D | null } {
  const obj = SkeletonUtils.clone(g.scene); const wrap = new THREE.Group(); wrap.add(obj);
  const bb = new THREE.Box3().setFromObject(obj), sz = bb.getSize(new THREE.Vector3()); const s = h / Math.max(0.01, sz.y); obj.scale.setScalar(s); obj.position.y = -bb.min.y * s;
  obj.traverse((o: THREE.Object3D) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
  const mixer = new THREE.AnimationMixer(obj), act: Record<string, THREE.AnimationAction> = {};
  let pre = ""; obj.traverse((o: THREE.Object3D) => { const m = /^(.*)Hips$/.exec(o.name); if (m && !pre) pre = m[1] || ""; });
  const clips = extraClips(pre).concat(g.animations);
  const pick = (re: RegExp): THREE.AnimationClip | undefined => clips.find((c: THREE.AnimationClip) => re.test(c.name));
  const map: Record<string, RegExp> = { idle: /^idle|^stand|breath/i, walk: /walk/i, run: /^run|jog/i, sprint: /sprint/i, death: /death|die|dead/i, punch: /punch|attack/i, jump: /jump/i, sit: /^sit/i, drive: /driv/i, aim: /pistol_idle|aim/i, shoot: /shoot/i, hit: /^hit/i };
  for (const k of Object.keys(map)) { const c = pick(map[k]); if (c) act[k] = mixer.clipAction(c); }
  if (!act.idle && g.animations[0]) act.idle = mixer.clipAction(g.animations[0]);
  if (act.idle) act.idle.play();
  let hand: THREE.Object3D | null = null; obj.traverse((o: THREE.Object3D) => { if (!hand && /righthand$|hand_r$|r_hand$/i.test(o.name)) hand = o; });
  return { obj: wrap, mixer, act, cur: "idle", hand };
}
// extra animation clips from assets/anims/*.glb (Mixamo bone names); clip renamed to the file name, used before built-in clips
const EXTRA = new Map<string, THREE.AnimationClip[]>();
function extraClips(pre: string): THREE.AnimationClip[] {
  let out = EXTRA.get(pre); if (out) return out; out = []; EXTRA.set(pre, out);
  for (const [f, g] of A.gltf) if (/(^|\/)anims\//.test(f)) for (const c of g.animations) {
    const k = c.clone(); k.name = g.animations.length > 1 ? c.name : base(f);
    for (const t of k.tracks) t.name = t.name.replace(/^(mixamorig:?)?/, pre);
    // keep root motion out of the clip (game moves the character)
    k.tracks = k.tracks.filter((t: THREE.KeyframeTrack) => !(/Hips\.position$/.test(t.name) && t.times.length > 2) || (t.name = t.name, false)).concat(k.tracks.filter((t: THREE.KeyframeTrack) => /Hips\.position$/.test(t.name)).map((t: THREE.KeyframeTrack) => { const v = t.values.slice(); for (let i = 0; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; } return new THREE.VectorKeyframeTrack(t.name, Array.from(t.times), Array.from(v)); }));
    out.push(k);
  }
  return out;
}
// vehicle: clone, fit to length L along +x, return wheel nodes
// Draw-call reduction: bake every non-moving part of a vehicle into one mesh per material (wheels/turret/rims stay separate). Cached per GLB.
const VMERGED = new Map<GLTF, THREE.Object3D>();
const MOVING = /wheel|rim|turret|barrel|spoiler|door|rotor/i;
const VC_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35, name: "merged_vc" });
function plainMat(m: THREE.Material): boolean { const s = m as THREE.MeshStandardMaterial; return !!s.isMeshStandardMaterial && !s.map && !s.transparent && !s.emissiveMap && s.emissive.getHex() === 0 && !/paint|body|tail|head|light|glass|lb_|siren/i.test(m.name); }
function addVC(g: THREE.BufferGeometry, c: THREE.Color): void { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3)); }
function normGeo(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const k of Object.keys(geo.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") geo.deleteAttribute(k);
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.uv) geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  for (const k of ["position", "normal", "uv"]) { const a = geo.attributes[k] as THREE.BufferAttribute; if (a.normalized || !(a.array instanceof Float32Array) || (a as unknown as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute) { const f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) f[i * a.itemSize + j] = a.getComponent(i, j); geo.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize)); } }
  geo.morphAttributes = {}; return geo;
}
function mergedVehicle(g: GLTF): THREE.Object3D {
  const hit = VMERGED.get(g); if (hit) return hit;
  const src = g.scene.clone(true); src.updateMatrixWorld(true);
  const root = new THREE.Group(); root.name = g.scene.name;
  const keep: THREE.Object3D[] = []; const groups = new Map<THREE.Material, THREE.BufferGeometry[]>(); const loose: THREE.Mesh[] = [];
  src.traverse((o: THREE.Object3D) => {
    if (o !== src && MOVING.test(o.name) && !keep.some((k: THREE.Object3D) => { let q: THREE.Object3D | null = o.parent; while (q) { if (q === k) return true; q = q.parent; } return false; })) { keep.push(o); return; }
  });
  const inKeep = (o: THREE.Object3D): boolean => { let q: THREE.Object3D | null = o; while (q) { if (keep.indexOf(q) >= 0) return true; q = q.parent; } return false; };
  src.traverse((o: THREE.Object3D) => {
    const m = o as THREE.Mesh; if (!m.isMesh || inKeep(m) || (m as unknown as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (Array.isArray(m.material)) { loose.push(m); return; }
    const geo = normGeo(m.geometry.clone()); geo.applyMatrix4(m.matrixWorld);
    const ng = geo.index ? geo.toNonIndexed() : geo; ng.morphAttributes = {};
    let key = m.material;
    if (plainMat(m.material)) { addVC(ng, (m.material as THREE.MeshStandardMaterial).color); key = VC_MAT; }
    const arr = groups.get(key) || []; arr.push(ng); groups.set(key, arr);
  });
  for (const [mat, geos] of groups) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat); mesh.name = "merged_" + mat.name; mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
  }
  for (const m of loose) { const c = m.clone(); m.matrixWorld.decompose(c.position, c.quaternion, c.scale); root.add(c); }
  for (const k of keep) {
    // collapse a moving part (wheel) into one vertex-coloured mesh if its materials are plain colours
    const parts: THREE.Mesh[] = []; k.traverse((o: THREE.Object3D) => { if ((o as THREE.Mesh).isMesh) parts.push(o as THREE.Mesh); });
    const inv = new THREE.Matrix4().copy(k.matrixWorld).invert();
    if (parts.length > 1 && parts.every((m: THREE.Mesh) => !Array.isArray(m.material) && plainMat(m.material as THREE.Material))) {
      const geos = parts.map((m: THREE.Mesh) => { const g2 = normGeo(m.geometry.clone()); g2.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); const n2 = g2.index ? g2.toNonIndexed() : g2; addVC(n2, (m.material as THREE.MeshStandardMaterial).color); return n2; });
      const mg = mergeGeometries(geos, false);
      if (mg) { const c = new THREE.Group(); c.name = k.name; const mm = new THREE.Mesh(mg, VC_MAT); mm.castShadow = true; c.add(mm); k.matrixWorld.decompose(c.position, c.quaternion, c.scale); root.add(c); continue; }
    }
    const c = k.clone(true); k.matrixWorld.decompose(c.position, c.quaternion, c.scale); root.add(c);
  }
  VMERGED.set(g, root); return root;
}
export function cloneVehicle(g: GLTF, L: number): { obj: THREE.Object3D; wheels: THREE.Object3D[]; front: THREE.Object3D[] } {
  const obj = mergedVehicle(g).clone(true); const wrap = new THREE.Group(); wrap.add(obj);
  let bb = new THREE.Box3().setFromObject(obj); let sz = bb.getSize(new THREE.Vector3());
  if (sz.z > sz.x) { obj.rotation.y = Math.PI / 2; bb = new THREE.Box3().setFromObject(obj); sz = bb.getSize(new THREE.Vector3()); }
  const s = L / Math.max(0.01, sz.x); obj.scale.multiplyScalar(s); bb = new THREE.Box3().setFromObject(obj); obj.position.y -= bb.min.y; obj.position.x -= (bb.min.x + bb.max.x) / 2; obj.position.z -= (bb.min.z + bb.max.z) / 2;
  const wheels: THREE.Object3D[] = [], front: THREE.Object3D[] = [];
  obj.traverse((o: THREE.Object3D) => { const n = o.name.toLowerCase(); if (/wheel[_ -]?(f|r)[_ -]?(l|r)|wheel_?(front|rear)/.test(n)) { wheels.push(o); if (/wheel[_ -]?f|front/.test(n)) front.push(o); } const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return { obj: wrap, wheels, front };
}

// ---- audio (shares the AudioContext of fx/audio.ts)
let AC: AudioContext | null = null, MASTER: GainNode | null = null;
const BUF = new Map<string, AudioBuffer | null>();
export function bindCtx(c: AudioContext, bus: GainNode | null): void { AC = c; MASTER = c.createGain(); MASTER.connect(c.destination); void bus; }
export function ac(): AudioContext | null { return AC; }
export function setFileVolume(v: number): void { if (MASTER) MASTER.gain.value = v; }
export function audioFile(name: string): string | null { const f = (A.man.audio || []).find((x: string) => x.split("/").pop()!.replace(/\.(mp3|ogg|wav|m4a)$/i, "").toLowerCase() === name.toLowerCase()); return f ? "assets/" + f : null; }
export async function buffer(name: string): Promise<AudioBuffer | null> {
  if (BUF.has(name)) return BUF.get(name) || null;
  const url = audioFile(name), c = ac(); if (!url || !c) { BUF.set(name, null); return null; }
  BUF.set(name, null);
  try { const r = await fetch(url); const b = await c.decodeAudioData(await r.arrayBuffer()); BUF.set(name, b); return b; } catch (_e) { return null; }
}
export function playBuf(b: AudioBuffer, vol: number, loop: boolean): { stop: () => void; gain: GainNode; src: AudioBufferSourceNode } | null {
  const c = ac(); if (!c || !MASTER) return null; const s = c.createBufferSource(); s.buffer = b; s.loop = loop; const gn = c.createGain(); gn.gain.value = vol; s.connect(gn); gn.connect(MASTER); s.start();
  return { stop: () => { try { s.stop(); } catch (_e) { /* */ } }, gain: gn, src: s };
}
// recorded voice lines: index maps text -> file
const normV = (s: string): string => s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g, " ").trim();
let VIDX: Map<string, string> | null = null; let VA: HTMLAudioElement | null = null;
export function voiceFor(text: string): string | null {
  if (!VIDX) { VIDX = new Map(); const v = A.man.voice || {}; for (const k of Object.keys(v)) VIDX.set(normV(v[k]), "assets/" + k); }
  return VIDX.get(normV(text)) || null;
}
export function playVoice(text: string, vol: number, busy?: (b: boolean) => void): boolean {
  const u = voiceFor(text); if (!u) return false;
  try {
    if (VA) VA.pause(); const a = new Audio(u); VA = a; a.volume = Math.max(0, Math.min(1, vol));
    if (busy) { busy(true); const off = (): void => { if (VA === a || a.ended || a.paused) busy(false); }; a.addEventListener("ended", off); a.addEventListener("error", off); a.addEventListener("pause", off); }
    a.play().catch(() => { if (busy) busy(false); }); return true;
  } catch (_e) { if (busy) busy(false); return false; }
}
