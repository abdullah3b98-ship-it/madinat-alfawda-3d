// effects.ts — pooled three.js FX for مدينة الفوضى (Y-up, metres).
// One FX manager owns: 2 particle systems (additive + alpha), instanced quads (decals, rings, tracers, lightning),
// instanced meshes (shells, debris) and one optional shared PointLight. Call fx.update(dt) once per frame.
import * as THREE from "three";

export type V3 = { x: number; y: number; z: number };
export type Surface = "concrete" | "metal" | "sand" | "wood" | "glass" | "flesh" | "grass";
export type ShellType = "pistol" | "rifle" | "shotgun";

export interface FXOptions {
  /** terrain height at (x,z). Default: 0 */
  groundHeight?: (x: number, z: number) => number;
  maxParticles?: number; // per particle system (2 systems). default 4000
  maxDecals?: number; // default 1024 (ring buffer)
  maxShells?: number; // default 160
  maxDebris?: number; // default 160
  /** one shared PointLight for muzzle flashes / explosions (added once, never removed → no shader recompiles). default true */
  light?: boolean;
  /** called every frame while a lightning bolt is visible with 0..1, and once with 0 at the end */
  onLightningFlash?: (intensity: number) => void;
  /** called when a spent shell hits the ground hard enough (hook an audio clink here) */
  onShellBounce?: (pos: THREE.Vector3, type: ShellType) => void;
  /** called on explosion (hook camera shake here) */
  onExplosion?: (pos: THREE.Vector3, scale: number) => void;
}

const T_SPLAT = 0, T_POOL = 1, T_SKID = 2, T_SCORCH = 3, T_RING = 4, T_GLOW = 5, T_HOLE = 6, T_SOLID = -1;

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _n = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();
const _e = new THREE.Euler(), _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1);
const _size = new THREE.Vector2();

// ------------------------------------------------------------------ atlas (procedural, 4x4 tiles of 64px)
function makeAtlas(): THREE.Texture {
  const S = 64, cv = document.createElement("canvas");
  cv.width = cv.height = S * 4;
  const g = cv.getContext("2d")!;
  const tile = (i: number, draw: (cx: number, cy: number, r: number) => void): void => {
    const cx = (i % 4) * S + S / 2, cy = Math.floor(i / 4) * S + S / 2;
    g.save(); g.beginPath(); g.rect(cx - S / 2 + 1, cy - S / 2 + 1, S - 2, S - 2); g.clip();
    draw(cx, cy, S / 2 - 3); g.restore();
  };
  const radial = (cx: number, cy: number, r: number, stops: [number, string][]): void => {
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  tile(T_SPLAT, (cx, cy, r) => {
    g.fillStyle = "rgba(255,255,255,0.95)";
    g.beginPath(); g.arc(cx, cy, r * 0.42, 0, 7); g.fill();
    for (let k = 0; k < 9; k++) { const a = Math.random() * 6.28, d = rnd(0.2, 0.55) * r; g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rnd(0.12, 0.25) * r, 0, 7); g.fill(); }
    for (let k = 0; k < 10; k++) { const a = Math.random() * 6.28, d = rnd(0.6, 0.95) * r; g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rnd(0.03, 0.08) * r, 0, 7); g.fill(); }
  });
  tile(T_POOL, (cx, cy, r) => {
    g.fillStyle = "rgba(255,255,255,0.92)"; g.beginPath();
    for (let k = 0; k <= 24; k++) { const a = (k / 24) * 6.283, rr = r * (0.8 + 0.15 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 7)); if (k === 0) g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); else g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    g.fill();
    radial(cx - r * 0.25, cy - r * 0.25, r * 0.3, [[0, "rgba(255,255,255,0.25)"], [1, "rgba(255,255,255,0)"]]);
  });
  tile(T_SKID, (cx, cy, r) => {
    for (let y = -r; y < r; y++) {
      const e = 1 - Math.pow(Math.abs(y) / r, 4);
      for (let x = -r - 3; x < r + 3; x += 2) { g.fillStyle = `rgba(255,255,255,${(e * rnd(0.55, 0.9)).toFixed(3)})`; g.fillRect(cx + x, cy + y, 2, 1); }
    }
  });
  tile(T_SCORCH, (cx, cy, r) => {
    radial(cx, cy, r, [[0, "rgba(255,255,255,0.95)"], [0.5, "rgba(255,255,255,0.7)"], [1, "rgba(255,255,255,0)"]]);
    g.globalCompositeOperation = "destination-out";
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(0,0,0,${rnd(0.1, 0.4).toFixed(2)})`; g.beginPath(); g.arc(cx + rnd(-r, r), cy + rnd(-r, r), rnd(2, 6), 0, 7); g.fill(); }
    g.globalCompositeOperation = "source-over";
  });
  tile(T_RING, (cx, cy, r) => radial(cx, cy, r, [[0, "rgba(255,255,255,0)"], [0.7, "rgba(255,255,255,0.05)"], [0.88, "rgba(255,255,255,1)"], [1, "rgba(255,255,255,0)"]]));
  tile(T_GLOW, (cx, cy, r) => radial(cx, cy, r, [[0, "rgba(255,255,255,1)"], [0.3, "rgba(255,255,255,0.5)"], [1, "rgba(255,255,255,0)"]]));
  tile(T_HOLE, (cx, cy, r) => {
    radial(cx, cy, r * 0.6, [[0, "rgba(255,255,255,1)"], [0.35, "rgba(255,255,255,0.9)"], [1, "rgba(255,255,255,0)"]]);
    g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = 1.5;
    for (let k = 0; k < 6; k++) { const a = Math.random() * 6.28; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r * rnd(0.4, 0.8), cy + Math.sin(a) * r * rnd(0.4, 0.8)); g.stroke(); }
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ------------------------------------------------------------------ instanced alpha quads / meshes
const QUAD_VS = /* glsl */ `
attribute vec3 aColor; attribute float aAlpha; attribute float aTile;
varying vec2 vUv; varying vec3 vColor; varying float vAlpha; varying float vTile;
#include <fog_pars_vertex>
void main() {
  vUv = uv; vColor = aColor; vAlpha = aAlpha; vTile = aTile;
  vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  #endif
  vec4 mvPosition = modelViewMatrix * p;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const QUAD_FS = /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vUv; varying vec3 vColor; varying float vAlpha; varying float vTile;
#include <fog_pars_fragment>
void main() {
  vec4 c = vec4(1.0);
  if (vTile >= 0.0) {
    float col = mod(vTile, 4.0), row = floor(vTile / 4.0);
    c = texture2D(uAtlas, vec2((col + vUv.x) * 0.25, 1.0 - (row + 1.0 - vUv.y) * 0.25));
  }
  float a = c.a * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor * c.rgb, a);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

class QuadPool {
  mesh: THREE.InstancedMesh;
  alpha: THREE.InstancedBufferAttribute;
  color: THREE.InstancedBufferAttribute;
  tile: THREE.InstancedBufferAttribute;
  next = 0;
  constructor(public cap: number, geo: THREE.BufferGeometry, mat: THREE.Material) {
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    this.tile = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    for (const a of [this.alpha, this.color, this.tile]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aAlpha", this.alpha); geo.setAttribute("aColor", this.color); geo.setAttribute("aTile", this.tile);
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < cap; i++) this.mesh.setMatrixAt(i, _m);
  }
  alloc(): number { const i = this.next; this.next = (this.next + 1) % this.cap; return i; }
  set(i: number, m: THREE.Matrix4, color: THREE.Color, alpha: number, tile: number): void {
    this.mesh.setMatrixAt(i, m);
    this.color.setXYZ(i, color.r, color.g, color.b);
    this.alpha.setX(i, alpha); this.tile.setX(i, tile);
  }
  hide(i: number): void { _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); this.alpha.setX(i, 0); }
  commit(): void { this.mesh.instanceMatrix.needsUpdate = true; this.alpha.needsUpdate = true; this.color.needsUpdate = true; this.tile.needsUpdate = true; }
}

function quadMaterial(atlas: THREE.Texture, additive: boolean, decal: boolean): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uAtlas: { value: null } }]),
    vertexShader: QUAD_VS, fragmentShader: QUAD_FS,
    transparent: true, depthWrite: false, fog: !additive,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
    polygonOffset: decal, polygonOffsetFactor: decal ? -2 : 0, polygonOffsetUnits: decal ? -2 : 0,
  });
  m.uniforms.uAtlas.value = atlas; // set after merge (merge clones textures)
  return m;
}

// ------------------------------------------------------------------ points particles
const PTS_VS = /* glsl */ `
attribute vec4 aColor; attribute float aSize; attribute float aKind;
uniform float uScale;
varying vec4 vColor; varying float vKind;
#include <fog_pars_vertex>
void main() {
  vColor = aColor; vKind = aKind;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = aSize * uScale / max(0.05, -mvPosition.z);
  #include <fog_vertex>
}`;
const PTS_FS = /* glsl */ `
varying vec4 vColor; varying float vKind;
#include <fog_pars_fragment>
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  vec3 rgb = vColor.rgb;
  float a;
  if (vKind < 0.5) { a = pow(1.0 - r, 1.6); rgb = mix(rgb, vec3(1.0), pow(1.0 - r, 4.0) * 0.6); }
  else { a = (1.0 - r * r) * (0.8 + 0.2 * sin(d.x * 17.0 + d.y * 13.0)); }
  gl_FragColor = vec4(rgb, vColor.a * a);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const STRIDE = 22; // px py pz vx vy vz age life s0 s1 r0 g0 b0 r1 g1 b1 a0 a1 grav drag kind bounce
interface Emit { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; s0: number; s1: number; c0: THREE.Color; c1: THREE.Color; a0: number; a1: number; grav: number; drag: number; kind: number; bounce: number }

class PointsSys {
  pts: THREE.Points;
  geo = new THREE.BufferGeometry();
  st: Float32Array;
  pos: Float32Array; col: Float32Array; size: Float32Array; kind: Float32Array;
  n = 0;
  mat: THREE.ShaderMaterial;
  constructor(public cap: number, additive: boolean) {
    this.st = new Float32Array(cap * STRIDE);
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 4); this.size = new Float32Array(cap); this.kind = new Float32Array(cap);
    const mk = (a: Float32Array, k: number): THREE.BufferAttribute => new THREE.BufferAttribute(a, k).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute("position", mk(this.pos, 3)); this.geo.setAttribute("aColor", mk(this.col, 4));
    this.geo.setAttribute("aSize", mk(this.size, 1)); this.geo.setAttribute("aKind", mk(this.kind, 1));
    this.geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScale: { value: 500 } }]),
      vertexShader: PTS_VS, fragmentShader: PTS_FS, transparent: true, depthWrite: false, fog: !additive,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.pts = new THREE.Points(this.geo, this.mat);
    this.pts.frustumCulled = false;
    this.pts.renderOrder = additive ? 3 : 2;
    const mat = this.mat;
    this.pts.onBeforeRender = (renderer: THREE.WebGLRenderer, _scene: THREE.Scene, camera: THREE.Camera): void => {
      renderer.getDrawingBufferSize(_size);
      mat.uniforms.uScale.value = _size.y * 0.5 * camera.projectionMatrix.elements[5];
    };
  }
  emit(e: Emit): void {
    if (this.n >= this.cap) return;
    const o = this.n++ * STRIDE, s = this.st;
    s[o] = e.x; s[o + 1] = e.y; s[o + 2] = e.z; s[o + 3] = e.vx; s[o + 4] = e.vy; s[o + 5] = e.vz;
    s[o + 6] = 0; s[o + 7] = e.life; s[o + 8] = e.s0; s[o + 9] = e.s1;
    s[o + 10] = e.c0.r; s[o + 11] = e.c0.g; s[o + 12] = e.c0.b; s[o + 13] = e.c1.r; s[o + 14] = e.c1.g; s[o + 15] = e.c1.b;
    s[o + 16] = e.a0; s[o + 17] = e.a1; s[o + 18] = e.grav; s[o + 19] = e.drag; s[o + 20] = e.kind; s[o + 21] = e.bounce;
  }
  update(dt: number, wind: THREE.Vector3, ground: (x: number, z: number) => number): void {
    const s = this.st;
    let i = 0;
    while (i < this.n) {
      const o = i * STRIDE;
      s[o + 6] += dt;
      if (s[o + 6] >= s[o + 7]) { // swap-remove
        const last = (this.n - 1) * STRIDE;
        if (o !== last) s.copyWithin(o, last, last + STRIDE);
        this.n--; continue;
      }
      const drag = Math.max(0, 1 - s[o + 19] * dt), puff = s[o + 20] > 0.5;
      s[o + 3] = s[o + 3] * drag + (puff ? wind.x * dt * 0.6 : 0);
      s[o + 4] = s[o + 4] * drag - s[o + 18] * dt;
      s[o + 5] = s[o + 5] * drag + (puff ? wind.z * dt * 0.6 : 0);
      s[o] += s[o + 3] * dt; s[o + 1] += s[o + 4] * dt; s[o + 2] += s[o + 5] * dt;
      if (s[o + 21] > 0) {
        const gy = ground(s[o], s[o + 2]);
        if (s[o + 1] < gy) { s[o + 1] = gy; s[o + 4] = -s[o + 4] * s[o + 21]; s[o + 3] *= 0.5; s[o + 5] *= 0.5; }
      }
      const t = s[o + 6] / s[o + 7];
      this.pos[i * 3] = s[o]; this.pos[i * 3 + 1] = s[o + 1]; this.pos[i * 3 + 2] = s[o + 2];
      this.col[i * 4] = s[o + 10] + (s[o + 13] - s[o + 10]) * t;
      this.col[i * 4 + 1] = s[o + 11] + (s[o + 14] - s[o + 11]) * t;
      this.col[i * 4 + 2] = s[o + 12] + (s[o + 15] - s[o + 12]) * t;
      this.col[i * 4 + 3] = (s[o + 16] + (s[o + 17] - s[o + 16]) * t) * (puff ? Math.min(1, t * 8) : 1);
      this.size[i] = s[o + 8] + (s[o + 9] - s[o + 8]) * t;
      this.kind[i] = s[o + 20];
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    for (const k of ["position", "aColor", "aSize", "aKind"]) {
      const a = this.geo.getAttribute(k) as THREE.BufferAttribute;
      a.clearUpdateRanges(); a.addUpdateRange(0, this.n * a.itemSize); a.needsUpdate = true;
    }
  }
  clear(): void { this.n = 0; this.geo.setDrawRange(0, 0); }
}

// ------------------------------------------------------------------ rigid bits (shells/debris)
class BitPool {
  mesh: THREE.InstancedMesh;
  st: Float32Array; // px py pz vx vy vz rx ry rz wx wy wz age life scale rest type
  n = 0; next = 0;
  static S = 17;
  constructor(public cap: number, geo: THREE.BufferGeometry, mat: THREE.Material, colors: boolean) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.st = new Float32Array(cap * BitPool.S);
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < cap; i++) { this.mesh.setMatrixAt(i, _m); if (colors) this.mesh.setColorAt(i, _c.set(0xffffff)); }
    for (let i = 0; i < cap; i++) this.st[i * BitPool.S + 13] = 0; // life 0 => dead
  }
  spawn(p: V3, v: V3, life: number, scale: number, type: number, color?: THREE.Color): void {
    const i = this.next; this.next = (this.next + 1) % this.cap;
    const o = i * BitPool.S, s = this.st;
    s[o] = p.x; s[o + 1] = p.y; s[o + 2] = p.z; s[o + 3] = v.x; s[o + 4] = v.y; s[o + 5] = v.z;
    s[o + 6] = rnd(0, 6.28); s[o + 7] = rnd(0, 6.28); s[o + 8] = rnd(0, 6.28);
    s[o + 9] = rnd(-20, 20); s[o + 10] = rnd(-20, 20); s[o + 11] = rnd(-20, 20);
    s[o + 12] = 0; s[o + 13] = life; s[o + 14] = scale; s[o + 15] = 0; s[o + 16] = type;
    if (color && this.mesh.instanceColor) { this.mesh.setColorAt(i, color); this.mesh.instanceColor.needsUpdate = true; }
  }
  update(dt: number, ground: (x: number, z: number) => number, onBounce?: (i: number, speed: number) => void): void {
    const s = this.st, S = BitPool.S;
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      const o = i * S;
      if (s[o + 13] <= 0) continue;
      any = true;
      s[o + 12] += dt;
      const t = s[o + 12], life = s[o + 13];
      if (t >= life) { s[o + 13] = 0; _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); continue; }
      if (s[o + 15] < 0.5) {
        s[o + 4] -= 9.81 * dt;
        s[o] += s[o + 3] * dt; s[o + 1] += s[o + 4] * dt; s[o + 2] += s[o + 5] * dt;
        s[o + 6] += s[o + 9] * dt; s[o + 7] += s[o + 10] * dt; s[o + 8] += s[o + 11] * dt;
        const r = 0.5 * s[o + 14] * 0.3, gy = ground(s[o], s[o + 2]) + r;
        if (s[o + 1] < gy) {
          const sp = -s[o + 4];
          s[o + 1] = gy;
          if (onBounce && sp > 1) onBounce(i, sp);
          s[o + 4] = sp * 0.35; s[o + 3] *= 0.55; s[o + 5] *= 0.55;
          s[o + 9] *= 0.5; s[o + 10] *= 0.5; s[o + 11] *= 0.5;
          if (sp < 0.6) { s[o + 15] = 1; s[o + 6] = Math.round(s[o + 6] / Math.PI) * Math.PI; s[o + 8] = Math.PI / 2 + Math.round(s[o + 8] / Math.PI) * Math.PI; }
        }
      }
      const sc = s[o + 14] * Math.min(1, (life - t) / 0.6);
      _v.set(s[o], s[o + 1], s[o + 2]); _q.setFromEuler(_e.set(s[o + 6], s[o + 7], s[o + 8])); _s.set(sc, sc, sc);
      this.mesh.setMatrixAt(i, _m.compose(_v, _q, _s));
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear(): void { _m.makeScale(0, 0, 0); for (let i = 0; i < this.cap; i++) { this.st[i * BitPool.S + 13] = 0; this.mesh.setMatrixAt(i, _m); } this.mesh.instanceMatrix.needsUpdate = true; }
}

// ------------------------------------------------------------------ FX manager
interface DecalSt { age: number; life: number; a: number; g0: number; g1: number; gt: number; x: number; y: number; z: number; nx: number; ny: number; nz: number; rot: number; sx: number; sy: number; live: boolean }
interface Tracer { from: THREE.Vector3; dir: THREE.Vector3; dist: number; speed: number; len: number; w: number; t: number; color: THREE.Color; live: boolean }
interface Ring { age: number; life: number; r0: number; r1: number; x: number; y: number; z: number; color: THREE.Color; live: boolean }
interface SmokeCol { x: number; y: number; z: number; age: number; life: number; rate: number; acc: number; scale: number }
interface Bolt { age: number; life: number; first: number; count: number; pos: THREE.Vector3 }

export interface LightningResult { pos: THREE.Vector3; distance: number; thunderDelay: number }

export class FX {
  readonly group = new THREE.Group();
  /** world-space wind (m/s) that drifts smoke / dust puffs */
  readonly wind = new THREE.Vector3(1.2, 0, 0.4);
  /** 0 disables blood entirely, 1 = default amount (use as a settings toggle) */
  bloodLevel = 1;
  /** current lightning flash 0..1 (also delivered through onLightningFlash) */
  flash = 0;
  light: THREE.PointLight | null = null;

  private ground: (x: number, z: number) => number;
  private atlas: THREE.Texture;
  private add: PointsSys; private alpha: PointsSys;
  private decals: QuadPool; private decalSt: DecalSt[];
  private glow: QuadPool; // additive: rings, tracers, lightning
  private tracers: Tracer[] = []; private rings: Ring[] = [];
  private tracerBase: number; private boltBase: number; private boltCap: number;
  private shells: BitPool; private debris: BitPool;
  private smokes: SmokeCol[] = [];
  private bolts: Bolt[] = []; private boltNext = 0;
  private skids = new Map<number, { x: number; y: number; z: number; t: number }>();
  private time = 0;
  private lightT = 0; private lightI = 0; private lightDecay = 1;
  private rain = 0; private rainAcc = 0; private rainCenter = new THREE.Vector3();
  private smokeAcc = new Map<number, number>();
  private e: Emit;
  private opts: FXOptions;
  private disposed = false;

  constructor(private scene: THREE.Scene, opts: FXOptions = {}) {
    this.opts = opts;
    this.ground = opts.groundHeight ?? ((): number => 0);
    this.atlas = makeAtlas();
    const maxP = opts.maxParticles ?? 4000;
    this.add = new PointsSys(maxP, true);
    this.alpha = new PointsSys(maxP, false);
    const dCap = opts.maxDecals ?? 1024;
    this.decals = new QuadPool(dCap, new THREE.PlaneGeometry(1, 1), quadMaterial(this.atlas, false, true));
    this.decals.mesh.renderOrder = 1;
    this.decalSt = Array.from({ length: dCap }, (): DecalSt => ({ age: 0, life: 0, a: 0, g0: 1, g1: 1, gt: 0, x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, rot: 0, sx: 1, sy: 1, live: false }));
    // glow pool layout: [tracers 96][lightning 384]
    this.tracerBase = 0; this.boltBase = 96; this.boltCap = 384;
    const glowGeo = new THREE.BoxGeometry(1, 1, 1);
    glowGeo.translate(0, 0, 0.5);
    this.glow = new QuadPool(this.boltBase + this.boltCap, glowGeo, quadMaterial(this.atlas, true, false));
    this.glow.mesh.renderOrder = 4;
    for (let i = 0; i < 96; i++) this.tracers.push({ from: new THREE.Vector3(), dir: new THREE.Vector3(), dist: 0, speed: 0, len: 0, w: 0, t: 0, color: new THREE.Color(), live: false });
    for (let i = 0; i < 16; i++) this.rings.push({ age: 0, life: 0, r0: 0, r1: 0, x: 0, y: 0, z: 0, color: new THREE.Color(), live: false });
    const shellGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.024, 6);
    shellGeo.rotateZ(Math.PI / 2);
    this.shells = new BitPool(opts.maxShells ?? 160, shellGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.85, roughness: 0.35 }), true);
    this.debris = new BitPool(opts.maxDebris ?? 160, new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), true);
    this.group.add(this.decals.mesh, this.alpha.pts, this.add.pts, this.glow.mesh, this.shells.mesh, this.debris.mesh, this.ringMesh());
    if (opts.light !== false) { this.light = new THREE.PointLight(0xffaa55, 0, 25, 2); this.light.castShadow = false; this.group.add(this.light); }
    this.group.name = "FX";
    scene.add(this.group);
    this.e = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, s0: 1, s1: 1, c0: new THREE.Color(), c1: new THREE.Color(), a0: 1, a1: 0, grav: 0, drag: 0, kind: 0, bounce: 0 };
  }

  // flat additive rings (shockwaves) live in their own small QuadPool with a plane geometry
  private ringPool!: QuadPool;
  private ringMesh(): THREE.InstancedMesh {
    const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    this.ringPool = new QuadPool(16, g, quadMaterial(this.atlas, true, false));
    this.ringPool.mesh.renderOrder = 4;
    return this.ringPool.mesh;
  }

  // ---------------------------------------------------------- helpers
  private P(sys: PointsSys, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, c0: number, c1: number, a0: number, a1: number, grav: number, drag: number, kind: number, bounce = 0): void {
    const e = this.e;
    e.x = x; e.y = y; e.z = z; e.vx = vx; e.vy = vy; e.vz = vz; e.life = life; e.s0 = s0; e.s1 = s1;
    e.c0.setHex(c0); e.c1.setHex(c1); e.a0 = a0; e.a1 = a1; e.grav = grav; e.drag = drag; e.kind = kind; e.bounce = bounce;
    sys.emit(e);
  }
  private flashLight(p: V3, intensity: number, color: number, decay: number): void {
    if (!this.light || intensity < this.lightI * Math.max(0, 1 - this.lightT * this.lightDecay)) return;
    this.light.position.set(p.x, p.y, p.z);
    this.light.color.setHex(color);
    this.lightI = intensity; this.lightT = 0; this.lightDecay = decay;
    this.light.intensity = intensity;
  }

  // ---------------------------------------------------------- weapons
  /** dir = barrel direction (normalised). scale ~1 pistol, 1.5 rifle, 2 shotgun */
  muzzleFlash(pos: V3, dir: V3, scale = 1): void {
    const A = this.add;
    this.P(A, pos.x, pos.y, pos.z, 0, 0, 0, 0.05, 0.35 * scale, 0.5 * scale, 0xffe9a0, 0xff7a20, 1, 0, 0, 0, 0);
    for (let k = 1; k <= 4; k++) {
      const d = k * 0.08 * scale, sz = (0.28 - k * 0.05) * scale;
      this.P(A, pos.x + dir.x * d, pos.y + dir.y * d, pos.z + dir.z * d, dir.x * 3, dir.y * 3, dir.z * 3, 0.045, sz, sz * 0.6, 0xfff0b0, 0xff6010, 0.9, 0, 0, 0, 0);
    }
    for (let k = 0; k < 3; k++) {
      this.P(A, pos.x, pos.y, pos.z, dir.x * 6 + rnd(-2, 2), dir.y * 6 + rnd(-2, 2), dir.z * 6 + rnd(-2, 2), 0.06, 0.08 * scale, 0.02, 0xffd080, 0xff4000, 1, 0, 0, 2, 0);
    }
    this.P(this.alpha, pos.x + dir.x * 0.2, pos.y + dir.y * 0.2, pos.z + dir.z * 0.2, dir.x * 1.5, dir.y * 1.5 + 0.3, dir.z * 1.5, 0.6, 0.15 * scale, 0.6 * scale, 0xbdbdbd, 0xdedede, 0.25, 0, -0.2, 2, 1);
    this.flashLight(pos, 8 * scale, 0xffb060, 18);
  }

  /** Bullet tracer travelling from → to. speed m/s (default 380), len metres (default 5) */
  tracer(from: V3, to: V3, opts: { speed?: number; length?: number; width?: number; color?: number } = {}): void {
    let tr: Tracer | null = null;
    for (let i = 0; i < this.tracers.length; i++) if (!this.tracers[i].live) { tr = this.tracers[i]; break; }
    if (!tr) tr = this.tracers[Math.floor(Math.random() * this.tracers.length)];
    tr.from.set(from.x, from.y, from.z);
    tr.dir.set(to.x - from.x, to.y - from.y, to.z - from.z);
    tr.dist = tr.dir.length();
    if (tr.dist < 0.01) return;
    tr.dir.multiplyScalar(1 / tr.dist);
    tr.speed = opts.speed ?? 380; tr.len = opts.length ?? 5; tr.w = opts.width ?? 0.035; tr.t = 0;
    tr.color.setHex(opts.color ?? 0xffd890); tr.live = true;
  }

  /** Spent casing ejected from pos towards `right` (unit vector, usually the weapon's right side). */
  shell(pos: V3, right: V3, type: ShellType = "pistol"): void {
    const sp = rnd(1.5, 2.6);
    _v2.set(right.x * sp + rnd(-0.3, 0.3), rnd(1.8, 3), right.z * sp + rnd(-0.3, 0.3));
    _c.setHex(type === "shotgun" ? 0xb02020 : 0xd4a640);
    const sc = type === "pistol" ? 1 : type === "rifle" ? 1.5 : 2.2;
    this.shells.spawn(pos, _v2, rnd(5, 8), sc, type === "pistol" ? 0 : type === "rifle" ? 1 : 2, _c);
  }

  /** Bullet impact. normal = surface normal (unit). Adds sparks/dust and a bullet hole decal (not for flesh/grass/sand). */
  impact(pos: V3, normal: V3, surface: Surface = "concrete"): void {
    if (surface === "flesh") { this.bloodHit(pos, { x: -normal.x, y: -normal.y, z: -normal.z }, 0.6); return; }
    const sparks = surface === "metal" ? 14 : surface === "concrete" ? 6 : surface === "glass" ? 4 : 0;
    for (let k = 0; k < sparks; k++) {
      const s = rnd(4, 11);
      this.P(this.add, pos.x, pos.y, pos.z, (normal.x + rnd(-0.7, 0.7)) * s, (normal.y + rnd(-0.3, 0.9)) * s, (normal.z + rnd(-0.7, 0.7)) * s, rnd(0.15, 0.35), 0.05, 0.015, 0xfff2b0, 0xff5a10, 1, 0.6, 9.8, 1.5, 0, 0.3);
    }
    const dustCol = surface === "sand" ? 0xc9a873 : surface === "grass" ? 0x6f6a45 : surface === "wood" ? 0x8a6a48 : surface === "glass" ? 0xe0eef5 : 0xa8a49c;
    const puffs = surface === "metal" ? 2 : 6;
    for (let k = 0; k < puffs; k++) {
      const s = rnd(0.6, 2.2);
      this.P(this.alpha, pos.x, pos.y, pos.z, (normal.x + rnd(-0.5, 0.5)) * s, (normal.y + rnd(-0.2, 0.6)) * s, (normal.z + rnd(-0.5, 0.5)) * s, rnd(0.6, 1.2), 0.12, rnd(0.5, 0.9), dustCol, dustCol, 0.55, 0, 0.6, 3, 1);
    }
    if (surface === "sand" || surface === "grass") return;
    _c.setHex(surface === "metal" ? 0x202020 : surface === "glass" ? 0x9aa8b0 : 0x1a1714);
    this.decal(pos, normal, rnd(0.08, 0.12), T_HOLE, _c, 0.9, 40);
  }

  // ---------------------------------------------------------- blood (stylised)
  /** dir = direction of the bullet / blow. amount 0..2 */
  bloodHit(pos: V3, dir: V3, amount = 1): void {
    const k = amount * this.bloodLevel;
    if (k <= 0) return;
    const n = Math.round(10 * k);
    for (let i = 0; i < n; i++) {
      const s = rnd(1.5, 4);
      this.P(this.alpha, pos.x, pos.y, pos.z, (dir.x + rnd(-0.5, 0.5)) * s, (dir.y + rnd(0, 0.8)) * s, (dir.z + rnd(-0.5, 0.5)) * s, rnd(0.35, 0.6), rnd(0.05, 0.1), 0.03, 0x8a1010, 0x4a0606, 0.9, 0.6, 9.8, 1, 0);
    }
    this.P(this.alpha, pos.x, pos.y, pos.z, dir.x * 0.6, 0.2, dir.z * 0.6, 0.3, 0.12, 0.45, 0x7a0e0e, 0x4a0606, 0.45, 0, 0, 3, 1);
    const drops = Math.max(1, Math.round(2 * k));
    for (let i = 0; i < drops; i++) {
      const d = rnd(0.3, 1.3);
      this.bloodDecal({ x: pos.x + dir.x * d + rnd(-0.2, 0.2), y: 0, z: pos.z + dir.z * d + rnd(-0.2, 0.2) }, rnd(0.25, 0.5));
    }
  }
  /** splat on the ground at (x,z) (y is replaced by the ground height) */
  bloodDecal(pos: V3, size = 0.4): void {
    if (this.bloodLevel <= 0) return;
    _c.setHex(0x5a0808);
    this.decal({ x: pos.x, y: this.ground(pos.x, pos.z), z: pos.z }, UP, size, T_SPLAT, _c, 0.85, 90);
  }
  /** slowly growing pool under a body */
  bloodPool(pos: V3, maxRadius = 0.9, growTime = 5): void {
    if (this.bloodLevel <= 0) return;
    _c.setHex(0x4a0505);
    const i = this.decal({ x: pos.x, y: this.ground(pos.x, pos.z), z: pos.z }, UP, maxRadius * 2 * Math.min(1, this.bloodLevel), T_POOL, _c, 0.88, 120);
    const d = this.decalSt[i]; d.g0 = 0.1; d.g1 = 1; d.gt = growTime;
  }

  // ---------------------------------------------------------- explosions
  explosion(pos: V3, scale = 1, opts: { smoke?: number; debris?: number; scorch?: boolean } = {}): void {
    const A = this.add, B = this.alpha;
    for (let k = 0; k < 28; k++) {
      const s = rnd(2, 7) * scale;
      _v.set(rnd(-1, 1), rnd(-0.2, 1), rnd(-1, 1)).normalize();
      this.P(A, pos.x + _v.x * 0.5, pos.y + _v.y * 0.5 + 0.3, pos.z + _v.z * 0.5, _v.x * s, _v.y * s + 2, _v.z * s, rnd(0.45, 0.9), rnd(1.5, 2.5) * scale, rnd(3.5, 5.5) * scale, 0xfff0a0, 0xd02800, 1, 0, -3, 3.5, 0);
    }
    for (let k = 0; k < 36; k++) {
      const s = rnd(8, 22) * scale;
      _v.set(rnd(-1, 1), rnd(0, 1), rnd(-1, 1)).normalize();
      this.P(A, pos.x, pos.y + 0.3, pos.z, _v.x * s, _v.y * s, _v.z * s, rnd(0.4, 1.1), 0.12, 0.04, 0xffe8a0, 0xff4000, 1, 0.5, 9.8, 1.2, 0, 0.3);
    }
    for (let k = 0; k < 14; k++) {
      const s = rnd(1, 4) * scale;
      _v.set(rnd(-1, 1), rnd(0, 1), rnd(-1, 1)).normalize();
      this.P(B, pos.x, pos.y + 0.5, pos.z, _v.x * s, _v.y * s + 1.5, _v.z * s, rnd(2.5, 4), 2 * scale, 6 * scale, 0x3a3532, 0x6a6560, 0.7, 0, -0.4, 0.9, 1);
    }
    const nd = Math.round((opts.debris ?? 14) * scale);
    for (let k = 0; k < nd; k++) {
      const s = rnd(6, 15) * Math.sqrt(scale);
      _v.set(rnd(-1, 1), rnd(0.4, 1.4), rnd(-1, 1)).normalize();
      _v2.set(_v.x * s, _v.y * s, _v.z * s);
      _c.setHex(Math.random() < 0.5 ? 0x2a2826 : 0x4a4440);
      this.debris.spawn({ x: pos.x, y: pos.y + 0.4, z: pos.z }, _v2, rnd(4, 7), rnd(0.25, 0.8), 0, _c);
    }
    this.shockwave(pos, 12 * scale);
    if (opts.scorch !== false) { _c.setHex(0x0e0c0a); this.decal({ x: pos.x, y: this.ground(pos.x, pos.z), z: pos.z }, UP, 5 * scale, T_SCORCH, _c, 0.85, 120); }
    const smoke = opts.smoke ?? 8;
    if (smoke > 0) this.smokeColumn(pos, smoke, scale);
    this.flashLight({ x: pos.x, y: pos.y + 2, z: pos.z }, 150 * scale, 0xff9040, 2.2);
    this.opts.onExplosion?.(_v3.set(pos.x, pos.y, pos.z), scale);
  }
  shockwave(pos: V3, radius = 12, color = 0xffd8a0): void {
    let r = this.rings.find((x) => !x.live);
    if (!r) r = this.rings[0];
    r.live = true; r.age = 0; r.life = 0.5; r.r0 = 0.5; r.r1 = radius; r.x = pos.x; r.y = this.ground(pos.x, pos.z) + 0.15; r.z = pos.z; r.color.setHex(color);
  }
  /** Lingering black smoke column, e.g. burning car. seconds = duration */
  smokeColumn(pos: V3, seconds = 8, scale = 1): void {
    if (this.smokes.length > 24) this.smokes.shift();
    this.smokes.push({ x: pos.x, y: pos.y, z: pos.z, age: 0, life: seconds, rate: 10 * scale, acc: 0, scale });
  }

  // ---------------------------------------------------------- vehicles
  /** Call per frame per sliding wheel. intensity 0..1 */
  tireSmoke(pos: V3, intensity: number, dt: number, wheelId = 0): void {
    const acc = (this.smokeAcc.get(wheelId) ?? 0) + intensity * 28 * dt;
    let n = Math.floor(acc);
    this.smokeAcc.set(wheelId, acc - n);
    while (n-- > 0) {
      this.P(this.alpha, pos.x + rnd(-0.15, 0.15), pos.y + 0.1, pos.z + rnd(-0.15, 0.15), rnd(-0.6, 0.6), rnd(0.4, 1.2), rnd(-0.6, 0.6), rnd(1.4, 2.4), rnd(0.4, 0.6), rnd(2, 3.2), 0xe8e8e8, 0xd0d0d0, 0.35 + 0.3 * intensity, 0, -0.3, 1.2, 1);
    }
  }
  /** Call per frame per sliding wheel (stable wheelId per wheel, e.g. carId*4+wheel). */
  skid(wheelId: number, pos: V3, intensity = 1, width = 0.22): void {
    const y = this.ground(pos.x, pos.z);
    const last = this.skids.get(wheelId);
    if (last && this.time - last.t < 0.25) {
      const dx = pos.x - last.x, dz = pos.z - last.z, d = Math.hypot(dx, dz);
      if (d < 0.25) return;
      if (d < 3) {
        const i = this.decals.alloc(), s = this.decalSt[i];
        s.live = true; s.age = 0; s.life = 45; s.a = Math.min(1, intensity) * 0.7; s.g0 = 1; s.g1 = 1; s.gt = 0;
        s.x = (pos.x + last.x) / 2; s.z = (pos.z + last.z) / 2; s.y = (y + last.y) / 2 + 0.012 + (i % 8) * 0.0015;
        s.nx = 0; s.ny = 1; s.nz = 0; s.rot = Math.atan2(-dz, dx); s.sx = d + 0.04; s.sy = width;
        _c.setHex(0x111111);
        this.decals.set(i, this.decalMatrix(s, 1), _c, s.a, T_SKID);
      }
    }
    const e = this.skids.get(wheelId);
    if (e) { e.x = pos.x; e.y = y; e.z = pos.z; e.t = this.time; } else this.skids.set(wheelId, { x: pos.x, y, z: pos.z, t: this.time });
  }
  endSkid(wheelId: number): void { this.skids.delete(wheelId); this.smokeAcc.delete(wheelId); }

  // ---------------------------------------------------------- weather
  /** intensity 0..1; splashes spawn within `radius` of center (call setRainCenter with the camera/player each frame). */
  setRain(intensity: number): void { this.rain = Math.max(0, Math.min(1, intensity)); }
  setRainCenter(p: V3): void { this.rainCenter.set(p.x, p.y, p.z); }
  /** Spawns a lightning bolt. Returns where it struck and when to play thunder (distance / 343). */
  lightning(at?: V3, listener?: V3): LightningResult {
    const c = this.rainCenter;
    const pos = at ? new THREE.Vector3(at.x, at.y, at.z) : new THREE.Vector3(c.x + rnd(-1, 1) * 200, 0, c.z + rnd(-1, 1) * 200);
    if (!at) pos.y = this.ground(pos.x, pos.z);
    const top = new THREE.Vector3(pos.x + rnd(-30, 30), pos.y + 220, pos.z + rnd(-30, 30));
    const pts: THREE.Vector3[] = [top, pos.clone()];
    for (let lvl = 0; lvl < 6; lvl++) {
      const off = 40 / Math.pow(1.9, lvl);
      for (let i = pts.length - 1; i > 0; i--) {
        const a = pts[i - 1], b = pts[i];
        pts.splice(i, 0, new THREE.Vector3((a.x + b.x) / 2 + rnd(-off, off), (a.y + b.y) / 2 + rnd(-off, off) * 0.3, (a.z + b.z) / 2 + rnd(-off, off)));
      }
    }
    if (this.bolts.length >= 4) {
      const old = this.bolts.shift()!;
      for (let k = 0; k < old.count; k++) this.glow.hide(this.boltBase + ((old.first + k) % this.boltCap));
    }
    const first = this.boltNext;
    let count = 0;
    _c.setHex(0xcfe0ff);
    const seg = (a: THREE.Vector3, b: THREE.Vector3, w: number): void => {
      if (count >= this.boltCap / 2) return;
      const i = this.boltBase + ((first + count) % this.boltCap);
      _v.subVectors(b, a); const len = _v.length(); _v.multiplyScalar(1 / len);
      _q.setFromUnitVectors(ZAX, _v);
      this.glow.set(i, _m.compose(a, _q, _s.set(w, w, len)), _c, 1, T_SOLID);
      count++;
    };
    for (let i = 1; i < pts.length; i++) seg(pts[i - 1], pts[i], 0.9);
    for (let b = 0; b < 3; b++) { // branches
      let p = pts[Math.floor(rnd(5, pts.length * 0.6))].clone();
      const dir = new THREE.Vector3(rnd(-1, 1), -rnd(0.6, 1.4), rnd(-1, 1)).normalize();
      for (let k = 0; k < 12; k++) {
        const q = p.clone().addScaledVector(dir, rnd(4, 9)).add(_v3.set(rnd(-2, 2), rnd(-1, 1), rnd(-2, 2)));
        seg(p, q, 0.35); p = q;
      }
    }
    this.boltNext = (first + count) % this.boltCap;
    this.bolts.push({ age: 0, life: 0.4, first, count, pos });
    const L = listener ?? this.rainCenter;
    const distance = Math.hypot(pos.x - L.x, pos.y - L.y, pos.z - L.z);
    return { pos, distance, thunderDelay: distance / 343 };
  }

  // ---------------------------------------------------------- decals
  /** Generic oriented decal. Returns its slot index. */
  decal(pos: V3, normal: V3, size: number, tile: number, color: THREE.Color, alpha = 0.9, life = 60): number {
    const i = this.decals.alloc(), s = this.decalSt[i];
    s.live = true; s.age = 0; s.life = life; s.a = alpha; s.g0 = 1; s.g1 = 1; s.gt = 0;
    const lift = 0.01 + (i % 16) * 0.0008;
    s.x = pos.x + normal.x * lift; s.y = pos.y + normal.y * lift; s.z = pos.z + normal.z * lift;
    s.nx = normal.x; s.ny = normal.y; s.nz = normal.z; s.rot = rnd(0, 6.283); s.sx = size; s.sy = size;
    this.decals.set(i, this.decalMatrix(s, 1), color, alpha, tile);
    return i;
  }
  private decalMatrix(s: DecalSt, g: number): THREE.Matrix4 {
    _n.set(s.nx, s.ny, s.nz);
    _q.setFromUnitVectors(ZAX, _n);
    _q2.setFromAxisAngle(ZAX, s.rot);
    _q.multiply(_q2);
    return _m.compose(_v.set(s.x, s.y, s.z), _q, _s.set(s.sx * g, s.sy * g, 1));
  }

  // ---------------------------------------------------------- frame update
  update(dt: number): void {
    if (this.disposed) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    const ground = this.ground;

    // smoke columns
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.age += dt;
      if (s.age > s.life) { this.smokes.splice(i, 1); continue; }
      const fade = 1 - s.age / s.life;
      s.acc += s.rate * dt * (0.4 + 0.6 * fade);
      while (s.acc >= 1) {
        s.acc -= 1;
        this.P(this.alpha, s.x + rnd(-0.6, 0.6) * s.scale, s.y + 0.5, s.z + rnd(-0.6, 0.6) * s.scale, rnd(-0.3, 0.3), rnd(2, 3.5), rnd(-0.3, 0.3), rnd(4, 6), rnd(1.2, 2) * s.scale, rnd(5, 8) * s.scale, 0x1c1a19, 0x5a5856, 0.55 * fade + 0.15, 0, -0.15, 0.25, 1);
        if (fade > 0.6 && Math.random() < 0.3) this.P(this.add, s.x + rnd(-0.5, 0.5), s.y + 0.3, s.z + rnd(-0.5, 0.5), 0, rnd(1.5, 3), 0, rnd(0.3, 0.6), 0.8 * s.scale, 0.3, 0xffa040, 0xa02000, 0.8, 0, -1, 0.5, 0);
      }
    }
    // rain splashes
    if (this.rain > 0) {
      this.rainAcc += this.rain * 450 * dt;
      const c = this.rainCenter;
      while (this.rainAcc >= 1) {
        this.rainAcc -= 1;
        const x = c.x + rnd(-25, 25), z = c.z + rnd(-25, 25), y = ground(x, z) + 0.02;
        for (let k = 0; k < 2; k++) this.P(this.alpha, x, y, z, rnd(-0.6, 0.6), rnd(0.8, 1.6), rnd(-0.6, 0.6), 0.22, 0.04, 0.02, 0xdfe8f0, 0xdfe8f0, 0.55, 0, 9.8, 0, 0);
      }
    }

    this.add.update(dt, this.wind, ground);
    this.alpha.update(dt, this.wind, ground);
    this.shells.update(dt, ground, this.opts.onShellBounce ? (i, sp): void => {
      if (sp < 1.2) return;
      const o = i * BitPool.S, st = this.shells.st;
      const type: ShellType = st[o + 16] === 0 ? "pistol" : st[o + 16] === 1 ? "rifle" : "shotgun";
      this.opts.onShellBounce!(_v3.set(st[o], st[o + 1], st[o + 2]), type);
    } : undefined);
    this.debris.update(dt, ground);

    // decals: grow + fade
    let dDirty = false;
    for (let i = 0; i < this.decalSt.length; i++) {
      const s = this.decalSt[i];
      if (!s.live) continue;
      s.age += dt;
      if (s.age >= s.life) { s.live = false; this.decals.hide(i); dDirty = true; continue; }
      const fadeStart = s.life * 0.8;
      if (s.gt > 0 && s.age <= s.gt + dt) {
        const g = s.g0 + (s.g1 - s.g0) * Math.min(1, Math.sqrt(s.age / s.gt));
        this.decals.mesh.setMatrixAt(i, this.decalMatrix(s, g)); dDirty = true;
      }
      if (s.age > fadeStart) { this.decals.alpha.setX(i, s.a * (1 - (s.age - fadeStart) / (s.life - fadeStart))); dDirty = true; }
    }
    if (dDirty || this.decalsTouched()) this.decals.commit();

    // tracers
    let gDirty = false;
    for (let k = 0; k < this.tracers.length; k++) {
      const tr = this.tracers[k];
      if (!tr.live) continue;
      gDirty = true;
      tr.t += dt;
      const head = Math.min(tr.dist, tr.speed * tr.t), tail = Math.max(0, head - tr.len);
      const idx = this.tracerBase + k;
      if (tail >= tr.dist - 0.01 || tr.t > 3) { tr.live = false; this.glow.hide(idx); continue; }
      _v.copy(tr.from).addScaledVector(tr.dir, tail);
      _q.setFromUnitVectors(ZAX, tr.dir);
      this.glow.set(idx, _m.compose(_v, _q, _s.set(tr.w, tr.w, Math.max(0.01, head - tail))), tr.color, 0.9, T_SOLID);
    }
    // shockwave rings
    let rDirty = false;
    for (let k = 0; k < this.rings.length; k++) {
      const r = this.rings[k];
      if (!r.live) continue;
      rDirty = true;
      r.age += dt;
      if (r.age >= r.life) { r.live = false; this.ringPool.hide(k); continue; }
      const t = r.age / r.life, rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - t) * (1 - t));
      _q.identity();
      this.ringPool.set(k, _m.compose(_v.set(r.x, r.y, r.z), _q, _s.set(rad * 2, 1, rad * 2)), r.color, 0.8 * (1 - t), T_RING);
    }
    if (rDirty) this.ringPool.commit();
    // lightning
    let fl = 0;
    for (let b = this.bolts.length - 1; b >= 0; b--) {
      const bo = this.bolts[b];
      bo.age += dt;
      gDirty = true;
      const t = bo.age / bo.life;
      const a = t >= 1 ? 0 : t < 0.15 ? 1 : t < 0.3 ? 0.25 : t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
      fl = Math.max(fl, a);
      for (let k = 0; k < bo.count; k++) {
        const i = this.boltBase + ((bo.first + k) % this.boltCap);
        if (a <= 0) this.glow.hide(i); else this.glow.alpha.setX(i, a);
      }
      if (t >= 1) this.bolts.splice(b, 1);
    }
    if (fl > 0 || this.flash > 0) { this.flash = fl; this.opts.onLightningFlash?.(fl); }
    if (gDirty) this.glow.commit();

    // shared light
    if (this.light && this.lightI > 0) {
      this.lightT += dt;
      const k = Math.max(0, 1 - this.lightT * this.lightDecay);
      this.light.intensity = this.lightI * k * k;
      if (k <= 0) { this.lightI = 0; this.light.intensity = 0; }
    }
  }
  private lastDecalNext = -1;
  private decalsTouched(): boolean { const t = this.decals.next !== this.lastDecalNext; this.lastDecalNext = this.decals.next; return t; }

  /** stats for debugging */
  get stats(): { additive: number; alpha: number; smokes: number } { return { additive: this.add.n, alpha: this.alpha.n, smokes: this.smokes.length }; }

  /** remove every live effect but keep the pools */
  clear(): void {
    this.add.clear(); this.alpha.clear(); this.shells.clear(); this.debris.clear();
    for (let i = 0; i < this.decalSt.length; i++) { this.decalSt[i].live = false; this.decals.hide(i); }
    this.decals.commit();
    for (let i = 0; i < this.tracers.length; i++) { this.tracers[i].live = false; }
    for (let i = 0; i < this.glow.cap; i++) this.glow.hide(i);
    this.glow.commit();
    for (let i = 0; i < this.rings.length; i++) { this.rings[i].live = false; this.ringPool.hide(i); }
    this.ringPool.commit();
    this.smokes.length = 0; this.bolts.length = 0; this.skids.clear(); this.smokeAcc.clear();
    if (this.light) { this.light.intensity = 0; this.lightI = 0; }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
    });
    this.light?.dispose();
    this.atlas.dispose();
  }
}

export const DECAL_TILES = { SPLAT: T_SPLAT, POOL: T_POOL, SKID: T_SKID, SCORCH: T_SCORCH, RING: T_RING, GLOW: T_GLOW, HOLE: T_HOLE, SOLID: T_SOLID } as const;
