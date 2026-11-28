import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";

export type Weather = "clear" | "cloudy" | "rain" | "storm" | "sand";
export const WEATHERS: Weather[] = ["clear", "cloudy", "rain", "storm", "sand"];
export const WEATHER_EN: Record<Weather, string> = { clear: "Clear ☀️", cloudy: "Cloudy ☁️", rain: "Rain 🌧️", storm: "Thunderstorm ⛈️", sand: "Dust storm 🌪️" };
export type Quality = "low" | "medium" | "high";
type WP = { cloud: number; rain: number; fog: number; wind: number; sand: number; light: number };
const WPARAM: Record<Weather, WP> = {
  clear: { cloud: 0, rain: 0, fog: 0.0012, wind: 0.15, sand: 0, light: 0 },
  cloudy: { cloud: 0.7, rain: 0, fog: 0.0028, wind: 0.35, sand: 0, light: 0 },
  rain: { cloud: 0.9, rain: 0.7, fog: 0.0045, wind: 0.5, sand: 0, light: 0 },
  storm: { cloud: 1, rain: 1, fog: 0.0062, wind: 1, sand: 0, light: 1 },
  sand: { cloud: 0.4, rain: 0, fog: 0.016, wind: 0.9, sand: 1, light: 0 },
};

export class Env {
  scene: THREE.Scene; renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera;
  sky: Sky; sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight; amb: THREE.AmbientLight; fog: THREE.FogExp2;
  composer: EffectComposer | null = null; bloom: UnrealBloomPass | null = null; ao: GTAOPass | null = null;
  q: Quality = "medium"; tod = 16.5; weather: Weather = "clear"; wNext: Weather = "clear"; wMix = 1; wTimer = 240; autoWeather = true;
  cur: WP = { ...WPARAM.clear }; night = 0; wet = 0; flash = 0; flashT = 4; stars: THREE.Points; moon: THREE.Mesh;
  rain: THREE.LineSegments; rainPos: Float32Array; splash: THREE.Points; splashPos: Float32Array; splashLife: Float32Array; dust: THREE.Points; dustPos: Float32Array;
  pmrem: THREE.PMREMGenerator; envRT: THREE.WebGLRenderTarget | null = null; envT = 0; skyScene: THREE.Scene; lamps: THREE.PointLight[] = [];
  thunder: (d: number) => void = () => undefined;
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", stencil: false });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.9;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1400);
    this.fog = new THREE.FogExp2(0xbfd4e6, 0.0018); this.scene.fog = this.fog;
    this.sky = new Sky(); this.sky.scale.setScalar(1500); const su = this.sky.material.uniforms; su.turbidity.value = 6; su.rayleigh.value = 1.4; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.8;
    this.scene.add(this.sky);
    this.skyScene = new THREE.Scene();
    this.sun = new THREE.DirectionalLight(0xfff1dc, 3); this.sun.castShadow = true;
    const sc = this.sun.shadow.camera; sc.near = 1; sc.far = 600; this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x8a7a60, 0.9); this.scene.add(this.hemi);
    this.amb = new THREE.AmbientLight(0xffffff, 0.08); this.scene.add(this.amb);
    // stars + moon
    const sp = new Float32Array(1500 * 3); for (let i = 0; i < 1500; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, y = Math.abs(u), rr = Math.sqrt(1 - y * y); sp[i * 3] = Math.cos(a) * rr * 1000; sp[i * 3 + 1] = y * 1000 + 30; sp[i * 3 + 2] = Math.sin(a) * rr * 1000; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); this.scene.add(this.stars);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(22, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf4f1e0, fog: false, transparent: true, opacity: 0 })); this.scene.add(this.moon);
    // rain
    const NR = 7000; this.rainPos = new Float32Array(NR * 6);
    for (let i = 0; i < NR; i++) { const x = (Math.random() - 0.5) * 80, y = Math.random() * 40, z = (Math.random() - 0.5) * 80; this.rainPos.set([x, y, z, x, y - 0.6, z], i * 6); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaec4d8, transparent: true, opacity: 0.45, depthWrite: false })); this.rain.frustumCulled = false; this.rain.visible = false; this.scene.add(this.rain);
    const NS = 500; this.splashPos = new Float32Array(NS * 3); this.splashLife = new Float32Array(NS);
    const spg = new THREE.BufferGeometry(); spg.setAttribute("position", new THREE.BufferAttribute(this.splashPos, 3));
    this.splash = new THREE.Points(spg, new THREE.PointsMaterial({ color: 0xdde8f2, size: 0.14, transparent: true, opacity: 0.7, depthWrite: false })); this.splash.frustumCulled = false; this.splash.visible = false; this.scene.add(this.splash);
    const ND = 3000; this.dustPos = new Float32Array(ND * 3); for (let i = 0; i < ND * 3; i++) this.dustPos[i] = (Math.random() - 0.5) * 70;
    const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.BufferAttribute(this.dustPos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xd49a55, size: 0.22, transparent: true, opacity: 0.55, depthWrite: false })); this.dust.frustumCulled = false; this.dust.visible = false; this.scene.add(this.dust);
    this.pmrem = new THREE.PMREMGenerator(r);
    for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffc977, 0, 22, 1.6); l.castShadow = false; this.lamps.push(l); this.scene.add(l); }
  }
  setQuality(q: Quality, W: number, H: number): void {
    this.q = q; const r = this.renderer;
    const dpr = Math.min(window.devicePixelRatio || 1, q === "high" ? 1.5 : q === "medium" ? 1.1 : 0.75);
    r.setPixelRatio(dpr);
    r.shadowMap.enabled = q !== "low"; this.sun.castShadow = q !== "low";
    const ms = q === "high" ? 4096 : 2048; this.sun.shadow.mapSize.set(ms, ms); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); (this.sun.shadow as { map: THREE.WebGLRenderTarget | null }).map = null; }
    const ext = q === "high" ? 110 : 80, sc = this.sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix();
    this.scene.traverse((o: THREE.Object3D) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m && (m as THREE.Material).needsUpdate !== undefined) (m as THREE.Material).needsUpdate = true; });
    if (this.composer) { this.composer.dispose(); this.composer = null; this.bloom = null; this.ao = null; }
    if (q !== "low") {
      const c = new EffectComposer(r); c.addPass(new RenderPass(this.scene, this.camera));
      if (q === "high") { this.ao = new GTAOPass(this.scene, this.camera, W, H); this.ao.output = GTAOPass.OUTPUT.Default; (this.ao as unknown as { blendIntensity: number }).blendIntensity = 0.8; c.addPass(this.ao); }
      c.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (!(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b)) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = vec4(clamp(c.rgb, 0.0, 12.0), clamp(c.a, 0.0, 1.0)); }' }));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.35, 0.5, 0.86); c.addPass(this.bloom);
      c.addPass(new OutputPass());
      this.composer = c;
    }
    this.resize(W, H);
    this.envT = 0;
  }
  resize(W: number, H: number): void {
    this.renderer.setSize(W, H, false); this.camera.aspect = W / Math.max(1, H); this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(W, H); }
  }
  setWeather(w: Weather, instant: boolean): void { if (instant) { this.weather = w; this.wNext = w; this.wMix = 1; this.cur = { ...WPARAM[w] }; } else { this.wNext = w; this.wMix = 0; } this.wTimer = 180 + Math.random() * 240; }
  update(dt: number, focus: THREE.Vector3, timeScale: number, lampPos: THREE.Vector3[]): void {
    // time of day: 1 game hour = 60 s real by default
    this.tod = (this.tod + dt * timeScale / 60) % 24;
    if (this.autoWeather) { this.wTimer -= dt; if (this.wTimer <= 0) { const opts: Weather[] = ["clear", "clear", "clear", "cloudy", "cloudy", "rain", "storm", "sand"]; this.setWeather(opts[Math.floor(Math.random() * opts.length)], false); } }
    if (this.wMix < 1) { this.wMix = Math.min(1, this.wMix + dt / 25); if (this.wMix >= 1) this.weather = this.wNext; }
    const T = WPARAM[this.wNext], k = Math.min(1, dt / 3);
    for (const key of Object.keys(T) as (keyof WP)[]) this.cur[key] += (T[key] - this.cur[key]) * (this.wMix >= 1 ? k : k * 0.5);
    const C = this.cur;
    // sun position
    const h = this.tod, ang = ((h - 6) / 12) * Math.PI; // 6h sunrise, 18h sunset
    const el = Math.sin(ang), az = Math.cos(ang);
    const sunDir = new THREE.Vector3(az * 0.8, el, 0.45).normalize();
    const day = THREE.MathUtils.smoothstep(el, -0.12, 0.18); this.night = 1 - THREE.MathUtils.smoothstep(el, -0.2, 0.05);
    const su = this.sky.material.uniforms; su.sunPosition.value.copy(sunDir.clone().multiplyScalar(1000)); su.turbidity.value = 4 + C.cloud * 14 + C.sand * 10; su.rayleigh.value = 1.2 + C.cloud * 2 + (1 - day) * 1.5; su.mieCoefficient.value = 0.004 + C.cloud * 0.02; if (su.cloudCoverage) { su.cloudCoverage.value = 0.15 + C.cloud * 0.75; su.cloudDensity.value = 0.25 + C.cloud * 0.6; su.time.value += dt * (1 + C.wind * 4); }
    // lights
    const warm = THREE.MathUtils.smoothstep(el, 0, 0.35);
    this.sun.color.setRGB(1, 0.72 + warm * 0.25, 0.5 + warm * 0.42);
    const sunI = day * 2.5 * (1 - C.cloud * 0.72) * (1 - C.sand * 0.5);
    const moonI = this.night * 0.35;
    const useSun = sunI > moonI;
    const L = useSun ? sunDir : new THREE.Vector3(-sunDir.x, Math.max(0.3, -sunDir.y), 0.3).normalize();
    this.sun.intensity = useSun ? sunI : moonI; if (!useSun) this.sun.color.set(0x9fb4ff);
    this.sun.position.copy(focus).addScaledVector(L, 250); this.sun.target.position.copy(focus);
    // stabilize shadow texel to reduce shimmer
    this.hemi.intensity = 0.2 + day * 0.5 * (1 - C.cloud * 0.3) + this.night * 0.12;
    this.hemi.color.setRGB(0.6 + day * 0.2, 0.7 + day * 0.18, 0.85 + day * 0.1).lerp(new THREE.Color(0xd9a060), C.sand * 0.6);
    this.hemi.groundColor.setRGB(0.35 * day + 0.08, 0.3 * day + 0.07, 0.25 * day + 0.08);
    this.amb.intensity = 0.06 + this.night * 0.12;
    // fog color
    const dayFog = new THREE.Color(0xa9bfd3).lerp(new THREE.Color(0x9aa3ac), C.cloud);
    const nightFog = new THREE.Color(0x0b1220).lerp(new THREE.Color(0x1a1f26), C.cloud);
    const dusk = new THREE.Color(0xe0a070);
    const fc = dayFog.clone().lerp(dusk, (1 - warm) * day * 0.6).lerp(nightFog, this.night).lerp(new THREE.Color(0xc98a45).multiplyScalar(0.35 + day * 0.65), C.sand);
    this.fog.color.copy(fc); this.fog.density = C.fog;
    this.renderer.toneMappingExposure = 0.62 + day * 0.06 + this.night * 0.3;
    (this.stars.material as THREE.PointsMaterial).opacity = this.night * (1 - C.cloud) * 0.9; this.stars.position.copy(focus);
    const mm = this.moon.material as THREE.MeshBasicMaterial; mm.opacity = this.night * (1 - C.cloud * 0.8); this.moon.position.copy(focus).addScaledVector(new THREE.Vector3(-sunDir.x, Math.max(0.25, -sunDir.y), 0.3).normalize(), 950);
    this.sky.visible = true; this.sky.position.copy(this.camera.position);
    // lightning
    this.flash = Math.max(0, this.flash - dt * 4);
    if (C.light > 0.5) { this.flashT -= dt; if (this.flashT <= 0) { this.flashT = 3 + Math.random() * 9; this.flash = 1; this.thunder(0.4 + Math.random() * 2); } }
    if (this.flash > 0) { this.hemi.intensity += this.flash * 4 * (Math.random() < 0.7 ? 1 : 0.3); this.fog.color.lerp(new THREE.Color(0xdfe6ff), this.flash * 0.5); }
    // wetness
    this.wet = THREE.MathUtils.clamp(this.wet + (C.rain > 0.3 ? dt / 20 : -dt / 90), 0, 1);
    // rain particles follow camera
    const cam = this.camera.position, rainOn = C.rain > 0.05;
    this.rain.visible = rainOn; this.splash.visible = false;
    if (rainOn) {
      const n = Math.floor((this.rainPos.length / 6) * C.rain), sp = 22 + C.wind * 6, wx = C.wind * 6;
      const RP = this.rainPos;
      for (let i = 0; i < this.rainPos.length / 6; i++) {
        const o = i * 6;
        if (i >= n) { RP[o + 1] = -100; RP[o + 4] = -100; continue; }
        RP[o] += wx * dt; RP[o + 1] -= sp * dt; RP[o + 3] = RP[o] - wx * 0.03; RP[o + 4] = RP[o + 1] - 0.55; RP[o + 5] = RP[o + 2];
        if (RP[o + 1] < 0 || Math.abs(RP[o] - cam.x) > 40 || Math.abs(RP[o + 2] - cam.z) > 40) { RP[o] = cam.x + (Math.random() - 0.5) * 80; RP[o + 1] = cam.y + 5 + Math.random() * 30; RP[o + 2] = cam.z + (Math.random() - 0.5) * 80; RP[o + 3] = RP[o]; RP[o + 4] = RP[o + 1] - 0.55; RP[o + 5] = RP[o + 2]; }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      (this.rain.material as THREE.LineBasicMaterial).opacity = 0.25 + this.night * -0.1 + C.rain * 0.25;
      const SP = this.splashPos, SL = this.splashLife; if (this.splash.visible)
      for (let i = 0; i < SL.length; i++) { SL[i] -= dt; if (SL[i] <= 0) { if (Math.random() < C.rain) { SL[i] = 0.12 + Math.random() * 0.1; SP[i * 3] = cam.x + (Math.random() - 0.5) * 40; SP[i * 3 + 1] = 0.2; SP[i * 3 + 2] = cam.z + (Math.random() - 0.5) * 40; } else SP[i * 3 + 1] = -50; } else SP[i * 3 + 1] += dt * 0.8; }
      this.splash.geometry.attributes.position.needsUpdate = true;
    }
    this.dust.visible = C.sand > 0.05;
    if (this.dust.visible) { const D = this.dustPos; for (let i = 0; i < D.length; i += 3) { D[i] += (8 + C.wind * 10) * dt; D[i + 1] += Math.sin(i + this.tod * 50) * dt * 0.5; if (D[i] - cam.x > 35) D[i] = cam.x - 35; if (Math.abs(D[i + 2] - cam.z) > 35) D[i + 2] = cam.z + (Math.random() - 0.5) * 70; if (D[i] < cam.x - 36) D[i] = cam.x + (Math.random() - 0.5) * 70; if (D[i + 1] < cam.y - 10 || D[i + 1] > cam.y + 20) D[i + 1] = cam.y + (Math.random() - 0.4) * 20; } this.dust.geometry.attributes.position.needsUpdate = true; (this.dust.material as THREE.PointsMaterial).opacity = 0.6 * C.sand; }
    // night lamp lights: nearest N lamps
    if (this.night > 0.1) {
      const sorted = lampPos.map((p: THREE.Vector3) => ({ p, d: p.distanceToSquared(focus) })).sort((a: { d: number }, b: { d: number }) => a.d - b.d);
      this.lamps.forEach((l: THREE.PointLight, i: number) => { const s = sorted[i]; if (s) { l.position.copy(s.p); l.intensity = this.night * 18; } else l.intensity = 0; });
    } else for (const l of this.lamps) l.intensity = 0;
    if (this.bloom) { this.bloom.strength = 0.12 + this.night * 0.38; this.bloom.threshold = 5 - this.night * 4.1; this.bloom.radius = 0.4; }
    // environment map refresh (sky reflections) every few seconds
    this.envT -= dt;
    if (this.envT <= 0) { this.envT = 6; this.skyScene.add(this.sky); if (this.envRT) this.envRT.dispose(); this.envRT = this.pmrem.fromScene(this.skyScene, 0, 1, 5000); this.scene.add(this.sky); this.scene.environment = this.envRT.texture; this.scene.environmentIntensity = 0.25 + 0.4 * day; }
  }
  render(): void { if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera); }
}
