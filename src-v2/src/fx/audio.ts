// audio.ts — procedural WebAudio engine for مدينة الفوضى. No audio files: every sound is synthesized.
// Units: metres, Y-up (same as the three.js world). Self-contained; no three.js dependency.

export type Vec3 = { x: number; y: number; z: number };

export type GunName = "pistol" | "revolver" | "uzi" | "mp5" | "shotgun" | "ak" | "m4" | "sniper" | "lmg" | "rpg";
export type SoundName =
  | GunName
  | "reload" | "empty" | "explosion_near" | "explosion_far" | "grenade_bounce" | "molotov"
  | "tire_screech" | "crash" | "horn"
  | "step_concrete" | "step_sand" | "step_grass" | "punch" | "kick" | "knife"
  | "thunder" | "ui_hover" | "ui_click" | "phone";
export type LoopName =
  | "engine_car" | "engine_truck" | "engine_moto" | "engine_tank"
  | "screech" | "horn" | "siren_police" | "siren_ambulance"
  | "rain" | "wind" | "sandstorm" | "city";
export type BusName = "master" | "sfx" | "music" | "amb" | "ui";

export interface PlayOptions {
  /** linear gain multiplier, default 1 */
  volume?: number;
  /** world position; omit for a 2D (non-positional) sound */
  pos?: Vec3;
  /** optional: update the listener before playing */
  listener?: { pos: Vec3; forward?: Vec3 };
  /** pitch multiplier (default 1, small random variation is added automatically) */
  pitch?: number;
  /** seconds from now */
  delay?: number;
  /** override bus (defaults: ui_* / phone -> "ui", thunder -> "amb", rest -> "sfx") */
  bus?: Exclude<BusName, "master">;
}

export interface LoopParams {
  /** engines: 0..1 (idle..redline). If omitted, derived from speed with a fake gearbox. */
  rpm?: number;
  /** engines: 0..1 accelerator */
  throttle?: number;
  /** m/s (engines, tank tracks) */
  speed?: number;
  /** 0..1 generic intensity (rain, wind, sandstorm, screech, city traffic) */
  intensity?: number;
  /** city: 0 = night (crickets) .. 1 = day (birds) */
  day?: number;
  /** police siren: "wail" | "yelp" */
  mode?: "wail" | "yelp";
  pos?: Vec3;
  volume?: number;
}

export interface LoopOptions extends LoopParams { bus?: Exclude<BusName, "master">; fadeIn?: number }

export interface LoopHandle {
  readonly name: LoopName;
  readonly alive: boolean;
  setParams(p: LoopParams): void;
  setPosition(pos: Vec3): void;
  stop(fade?: number): void;
}

type NoiseKind = "white" | "pink" | "brown";

interface Voice { end: number; out: GainNode; srcs: AudioScheduledSourceNode[]; nodes: AudioNode[]; done: boolean }

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

// ---------------------------------------------------------------- voice builder
class VB {
  maxStop = 0;
  last: AudioScheduledSourceNode | null = null;
  constructor(public ctx: AudioContext, public t: number, public out: AudioNode, public rate: number, public eng: AudioEngine, public voice: Voice) {}

  private env(g: GainNode, t0: number, peak: number, a: number, d: number): number {
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.setTargetAtTime(0, t0 + a, d);
    return t0 + a + d * 7;
  }
  private track(s: AudioScheduledSourceNode, stop: number, nodes: AudioNode[]): void {
    this.voice.srcs.push(s);
    for (const n of nodes) this.voice.nodes.push(n);
    if (stop > this.maxStop) { this.maxStop = stop; this.last = s; }
  }

  noise(kind: NoiseKind, o: { type?: BiquadFilterType; f?: number; f1?: number; glide?: number; q?: number; peak: number; a?: number; d: number; at?: number; rate?: number; dest?: AudioNode }): void {
    const ctx = this.ctx, t0 = this.t + (o.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.eng.noiseBuf(kind);
    src.loop = true;
    src.playbackRate.value = (o.rate ?? 1) * this.rate;
    const g = ctx.createGain();
    let head: AudioNode = g;
    const nodes: AudioNode[] = [g];
    if (o.type) {
      const f = ctx.createBiquadFilter();
      f.type = o.type;
      const f0 = (o.f ?? 1000) * this.rate;
      f.frequency.setValueAtTime(f0, t0);
      if (o.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1 * this.rate), t0 + (o.glide ?? 0.1));
      f.Q.value = o.q ?? 0.7;
      src.connect(f); f.connect(g); nodes.push(f);
      head = g;
    } else src.connect(g);
    head.connect(o.dest ?? this.out);
    const stop = this.env(g, t0, o.peak, o.a ?? 0.001, o.d);
    src.start(t0, Math.random() * 1.5);
    src.stop(stop);
    this.track(src, stop, nodes);
  }

  osc(type: OscillatorType, o: { f: number; f1?: number; glide?: number; peak: number; a?: number; d: number; at?: number; detune?: number; vib?: number; vibDepth?: number; shape?: boolean; lp?: number; dest?: AudioNode }): void {
    const ctx = this.ctx, t0 = this.t + (o.at ?? 0);
    const s = ctx.createOscillator();
    s.type = type;
    s.frequency.setValueAtTime(o.f * this.rate, t0);
    if (o.f1 !== undefined) s.frequency.exponentialRampToValueAtTime(Math.max(10, o.f1 * this.rate), t0 + (o.glide ?? 0.1));
    if (o.detune) s.detune.value = o.detune;
    const g = ctx.createGain();
    const nodes: AudioNode[] = [g];
    let n: AudioNode = s;
    if (o.shape) { const w = this.eng.shaper(); n.connect(w); n = w; }
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; n.connect(f); n = f; nodes.push(f); }
    n.connect(g);
    g.connect(o.dest ?? this.out);
    const stop = this.env(g, t0, o.peak, o.a ?? 0.001, o.d);
    if (o.vib) {
      const l = ctx.createOscillator(); l.frequency.value = o.vib;
      const lg = ctx.createGain(); lg.gain.value = o.vibDepth ?? 20;
      l.connect(lg); lg.connect(s.frequency); l.start(t0); l.stop(stop);
      this.track(l, stop, [lg]);
    }
    s.start(t0); s.stop(stop);
    this.track(s, stop, nodes);
  }
}

// ---------------------------------------------------------------- gun recipes
interface GunP { crackF: number; crack: number; bodyF: number; bodyQ: number; body: number; bodyD: number; thumpF: number; thump: number; thumpD: number; tailF: number; tail: number; tailD: number; echo?: number; mech?: "pump" | "bolt" | "hammer" }
const GUNS: Record<Exclude<GunName, "rpg">, GunP> = {
  pistol:   { crackF: 3000, crack: 0.6, bodyF: 1400, bodyQ: 1.2, body: 0.9, bodyD: 0.03, thumpF: 160, thump: 0.7, thumpD: 0.04, tailF: 1200, tail: 0.5, tailD: 0.12 },
  revolver: { crackF: 2500, crack: 0.8, bodyF: 900, bodyQ: 1.0, body: 1.1, bodyD: 0.05, thumpF: 110, thump: 1.0, thumpD: 0.06, tailF: 900, tail: 0.7, tailD: 0.25, echo: 0.35, mech: "hammer" },
  uzi:      { crackF: 4200, crack: 0.5, bodyF: 2100, bodyQ: 1.5, body: 0.7, bodyD: 0.018, thumpF: 210, thump: 0.4, thumpD: 0.025, tailF: 1700, tail: 0.3, tailD: 0.06 },
  mp5:      { crackF: 3500, crack: 0.45, bodyF: 1700, bodyQ: 1.3, body: 0.7, bodyD: 0.022, thumpF: 180, thump: 0.5, thumpD: 0.03, tailF: 1300, tail: 0.35, tailD: 0.08 },
  shotgun:  { crackF: 2000, crack: 0.9, bodyF: 600, bodyQ: 0.7, body: 1.2, bodyD: 0.09, thumpF: 80, thump: 1.2, thumpD: 0.1, tailF: 700, tail: 0.9, tailD: 0.35, echo: 0.4, mech: "pump" },
  ak:       { crackF: 2600, crack: 0.8, bodyF: 1000, bodyQ: 0.9, body: 1.0, bodyD: 0.045, thumpF: 120, thump: 0.9, thumpD: 0.05, tailF: 1000, tail: 0.6, tailD: 0.18 },
  m4:       { crackF: 3200, crack: 0.8, bodyF: 1300, bodyQ: 1.1, body: 0.9, bodyD: 0.035, thumpF: 140, thump: 0.8, thumpD: 0.04, tailF: 1300, tail: 0.55, tailD: 0.15 },
  sniper:   { crackF: 4500, crack: 1.2, bodyF: 1100, bodyQ: 0.8, body: 1.1, bodyD: 0.05, thumpF: 90, thump: 1.1, thumpD: 0.08, tailF: 800, tail: 0.8, tailD: 0.5, echo: 0.55, mech: "bolt" },
  lmg:      { crackF: 2400, crack: 0.8, bodyF: 850, bodyQ: 0.9, body: 1.1, bodyD: 0.05, thumpF: 100, thump: 1.0, thumpD: 0.06, tailF: 900, tail: 0.65, tailD: 0.2 },
};

function click(v: VB, at: number, f: number, peak: number): void {
  v.noise("white", { type: "bandpass", f, q: 3, peak, d: 0.006, at });
  v.osc("square", { f: f * 0.6, peak: peak * 0.12, d: 0.005, at });
}

function gun(v: VB, p: GunP): void {
  v.noise("white", { type: "highpass", f: p.crackF, peak: p.crack, a: 0.0005, d: 0.004 });
  v.noise("white", { type: "bandpass", f: p.bodyF, f1: p.bodyF * 0.6, glide: p.bodyD * 3, q: p.bodyQ, peak: p.body, a: 0.0008, d: p.bodyD });
  v.osc("sine", { f: p.thumpF, f1: p.thumpF * 0.35, glide: 0.08, peak: p.thump, a: 0.001, d: p.thumpD });
  v.noise("brown", { type: "lowpass", f: p.tailF, f1: p.tailF * 0.5, glide: p.tailD * 3, peak: p.tail, a: 0.003, d: p.tailD });
  if (p.echo) v.noise("brown", { type: "lowpass", f: p.tailF * 0.6, peak: p.tail * p.echo, a: 0.02, d: p.tailD * 1.3, at: 0.18 });
  if (p.mech === "pump") { click(v, 0.38, 1800, 0.35); click(v, 0.52, 1400, 0.4); }
  else if (p.mech === "bolt") { click(v, 0.65, 2500, 0.25); click(v, 0.85, 2000, 0.3); }
  else if (p.mech === "hammer") click(v, 0.12, 3200, 0.12);
}

const RECIPES: Record<SoundName, { ref: number; dur: number; fn: (v: VB) => void }> = {
  pistol: { ref: 6, dur: 0.6, fn: (v) => gun(v, GUNS.pistol) },
  revolver: { ref: 7, dur: 1.2, fn: (v) => gun(v, GUNS.revolver) },
  uzi: { ref: 5, dur: 0.4, fn: (v) => gun(v, GUNS.uzi) },
  mp5: { ref: 5, dur: 0.5, fn: (v) => gun(v, GUNS.mp5) },
  shotgun: { ref: 8, dur: 1.5, fn: (v) => gun(v, GUNS.shotgun) },
  ak: { ref: 7, dur: 0.9, fn: (v) => gun(v, GUNS.ak) },
  m4: { ref: 7, dur: 0.8, fn: (v) => gun(v, GUNS.m4) },
  sniper: { ref: 10, dur: 2.0, fn: (v) => gun(v, GUNS.sniper) },
  lmg: { ref: 8, dur: 1.0, fn: (v) => gun(v, GUNS.lmg) },
  rpg: { ref: 8, dur: 1.4, fn: (v) => {
    v.osc("sine", { f: 70, f1: 35, glide: 0.15, peak: 1, d: 0.1 });
    v.noise("white", { type: "highpass", f: 2000, peak: 0.6, d: 0.01 });
    v.noise("white", { type: "bandpass", f: 400, f1: 2600, glide: 0.6, q: 1.2, peak: 0.8, a: 0.03, d: 0.3 });
    v.noise("pink", { type: "highpass", f: 3000, peak: 0.3, a: 0.05, d: 0.25 });
  } },
  reload: { ref: 2, dur: 0.9, fn: (v) => {
    click(v, 0, 3000, 0.5);
    v.noise("white", { type: "bandpass", f: 1500, q: 1.5, peak: 0.2, a: 0.04, d: 0.04, at: 0.12 });
    click(v, 0.3, 2400, 0.6);
    click(v, 0.55, 3600, 0.55);
    click(v, 0.62, 2000, 0.4);
  } },
  empty: { ref: 2, dur: 0.2, fn: (v) => { click(v, 0, 3800, 0.4); v.osc("sine", { f: 5200, peak: 0.05, d: 0.01 }); } },
  explosion_near: { ref: 15, dur: 4, fn: (v) => {
    v.osc("sine", { f: 60, f1: 22, glide: 0.6, peak: 1.4, a: 0.002, d: 0.35 });
    v.noise("brown", { type: "lowpass", f: 1000, f1: 160, glide: 1.5, peak: 1.5, a: 0.004, d: 0.8 });
    v.noise("white", { type: "highpass", f: 1500, peak: 0.8, d: 0.03 });
    v.noise("pink", { type: "bandpass", f: 500, q: 0.6, peak: 0.6, a: 0.01, d: 0.25 });
    for (let i = 0; i < 7; i++) v.noise("white", { type: "bandpass", f: rnd(1500, 5000), q: 2, peak: rnd(0.1, 0.35), d: 0.008, at: rnd(0.1, 1.4) });
  } },
  explosion_far: { ref: 30, dur: 4, fn: (v) => {
    v.osc("sine", { f: 45, f1: 25, glide: 0.8, peak: 0.6, a: 0.02, d: 0.5 });
    v.noise("brown", { type: "lowpass", f: 320, f1: 120, glide: 2, peak: 1.1, a: 0.05, d: 1.2 });
    v.noise("brown", { type: "lowpass", f: 200, peak: 0.5, a: 0.2, d: 0.9, at: 0.4 });
  } },
  grenade_bounce: { ref: 3, dur: 0.4, fn: (v) => {
    const b = rnd(800, 1000);
    v.osc("sine", { f: b, peak: 0.35, d: 0.05 });
    v.osc("sine", { f: b * 2.76, peak: 0.2, d: 0.03 });
    v.osc("sine", { f: b * 5.4, peak: 0.1, d: 0.02 });
    v.noise("brown", { type: "lowpass", f: 400, peak: 0.6, d: 0.02 });
  } },
  molotov: { ref: 6, dur: 3, fn: (v) => {
    v.noise("white", { type: "highpass", f: 4000, peak: 0.6, d: 0.08 });
    for (let i = 0; i < 8; i++) v.osc("sine", { f: rnd(3000, 7500), peak: rnd(0.05, 0.15), d: rnd(0.02, 0.06), at: rnd(0, 0.25) });
    v.noise("pink", { type: "bandpass", f: 300, f1: 1400, glide: 0.4, q: 0.9, peak: 1, a: 0.12, d: 0.5, at: 0.05 });
    v.noise("brown", { type: "lowpass", f: 450, peak: 0.7, a: 0.15, d: 0.9, at: 0.05 });
  } },
  tire_screech: { ref: 6, dur: 1.4, fn: (v) => {
    const f = rnd(950, 1250);
    v.osc("sawtooth", { f, f1: f * 0.85, glide: 0.8, peak: 0.25, a: 0.04, d: 0.25, vib: 17, vibDepth: 70, lp: 2600 });
    v.osc("sawtooth", { f: f * 1.5, peak: 0.08, a: 0.04, d: 0.2, vib: 23, vibDepth: 90, lp: 3500 });
    v.noise("white", { type: "bandpass", f: 2500, q: 1, peak: 0.2, a: 0.04, d: 0.25 });
  } },
  crash: { ref: 8, dur: 2.2, fn: (v) => {
    v.noise("brown", { type: "lowpass", f: 1200, f1: 300, glide: 0.5, peak: 1.3, a: 0.002, d: 0.25 });
    v.noise("white", { type: "bandpass", f: 3000, q: 0.7, peak: 0.6, d: 0.12 });
    v.osc("sine", { f: 70, f1: 35, glide: 0.2, peak: 0.9, d: 0.12 });
    for (const m of [340, 517, 890, 1230]) v.osc("triangle", { f: m * rnd(0.9, 1.1), peak: rnd(0.08, 0.18), d: rnd(0.12, 0.3) });
    for (let i = 0; i < 6; i++) v.osc("sine", { f: rnd(4000, 8000), peak: rnd(0.03, 0.09), d: 0.03, at: rnd(0.02, 0.35) });
    for (let i = 0; i < 4; i++) v.noise("brown", { type: "lowpass", f: 900, peak: rnd(0.15, 0.4), d: 0.03, at: rnd(0.1, 0.6) });
  } },
  horn: { ref: 6, dur: 0.8, fn: (v) => {
    v.osc("sawtooth", { f: 415, peak: 0.25, a: 0.01, d: 0.12, at: 0, lp: 1800, shape: true });
    v.osc("sawtooth", { f: 523, peak: 0.22, a: 0.01, d: 0.12, at: 0, lp: 1800, shape: true });
    // sustain: second hit keeps the body for ~0.4s
    v.osc("sawtooth", { f: 415, peak: 0.2, a: 0.25, d: 0.05, lp: 1800 });
    v.osc("sawtooth", { f: 523, peak: 0.18, a: 0.25, d: 0.05, lp: 1800 });
  } },
  step_concrete: { ref: 1.5, dur: 0.2, fn: (v) => {
    v.noise("white", { type: "bandpass", f: rnd(1500, 2100), q: 1, peak: 0.5, d: 0.014 });
    v.osc("sine", { f: 95, f1: 60, glide: 0.04, peak: 0.25, d: 0.02 });
    v.noise("white", { type: "highpass", f: 5000, peak: 0.1, d: 0.004, at: 0.01 });
  } },
  step_sand: { ref: 1.5, dur: 0.3, fn: (v) => {
    v.noise("brown", { type: "lowpass", f: rnd(1000, 1400), peak: 0.6, a: 0.01, d: 0.05 });
    v.noise("white", { type: "bandpass", f: 4200, q: 0.5, peak: 0.12, a: 0.01, d: 0.04 });
  } },
  step_grass: { ref: 1.5, dur: 0.3, fn: (v) => {
    v.noise("pink", { type: "highpass", f: rnd(2300, 2900), peak: 0.3, a: 0.015, d: 0.06 });
    v.noise("brown", { type: "lowpass", f: 300, peak: 0.25, d: 0.02 });
  } },
  punch: { ref: 2, dur: 0.3, fn: (v) => {
    v.osc("sine", { f: 140, f1: 45, glide: 0.08, peak: 1, d: 0.05 });
    v.noise("brown", { type: "lowpass", f: 1500, peak: 0.8, d: 0.03 });
    v.noise("white", { type: "highpass", f: 2000, peak: 0.3, d: 0.01 });
  } },
  kick: { ref: 2, dur: 0.4, fn: (v) => {
    v.noise("pink", { type: "bandpass", f: 600, f1: 1600, glide: 0.07, q: 2, peak: 0.25, a: 0.05, d: 0.03 });
    v.osc("sine", { f: 100, f1: 38, glide: 0.1, peak: 1.2, d: 0.08, at: 0.07 });
    v.noise("brown", { type: "lowpass", f: 900, peak: 0.9, d: 0.06, at: 0.07 });
  } },
  knife: { ref: 2, dur: 0.4, fn: (v) => {
    v.noise("white", { type: "bandpass", f: 800, f1: 4200, glide: 0.14, q: 4, peak: 0.6, a: 0.06, d: 0.05 });
    v.osc("sine", { f: 6200, peak: 0.03, a: 0.05, d: 0.08 });
  } },
  thunder: { ref: 100, dur: 7, fn: (v) => {
    v.noise("white", { type: "highpass", f: 1200, peak: 0.5, d: 0.08 });
    v.noise("brown", { type: "lowpass", f: 260, f1: 120, glide: 3, peak: 1.3, a: 0.25, d: 1.5 });
    for (let i = 0; i < 3; i++) v.noise("brown", { type: "lowpass", f: rnd(140, 220), peak: rnd(0.5, 0.9), a: 0.1, d: 0.6, at: rnd(0.3, 2.2) });
  } },
  ui_hover: { ref: 1, dur: 0.1, fn: (v) => v.osc("sine", { f: 1400, peak: 0.12, a: 0.002, d: 0.02 }) },
  ui_click: { ref: 1, dur: 0.15, fn: (v) => {
    v.osc("square", { f: 900, f1: 600, glide: 0.03, peak: 0.08, d: 0.025, lp: 4000 });
    v.osc("sine", { f: 1800, peak: 0.1, d: 0.015 });
  } },
  phone: { ref: 1, dur: 0.9, fn: (v) => {
    v.osc("sine", { f: 1318.5, peak: 0.3, a: 0.003, d: 0.12 });
    v.osc("sine", { f: 2637, peak: 0.06, a: 0.003, d: 0.06 });
    v.osc("sine", { f: 1975.5, peak: 0.3, a: 0.003, d: 0.16, at: 0.13 });
    v.osc("sine", { f: 3951, peak: 0.06, a: 0.003, d: 0.08, at: 0.13 });
  } },
};

// ---------------------------------------------------------------- loops
class Loop implements LoopHandle {
  alive = true;
  out: GainNode;
  air: BiquadFilterNode;
  panner: PannerNode | null = null;
  srcs: AudioScheduledSourceNode[] = [];
  nodes: AudioNode[] = [];
  vol = 1;
  timer: number | null = null;
  params: LoopParams = {};
  apply: (p: LoopParams, t: number) => void = () => {};
  constructor(public name: LoopName, public eng: AudioEngine, bus: AudioNode, pos: Vec3 | undefined, ref: number) {
    const ctx = eng.ctx!;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.air = ctx.createBiquadFilter();
    this.air.type = "lowpass";
    this.air.frequency.value = 22000;
    this.out.connect(this.air);
    if (pos) {
      this.panner = eng.makePanner(ref);
      this.air.connect(this.panner);
      this.panner.connect(bus);
      this.setPosition(pos);
    } else this.air.connect(bus);
  }
  src<T extends AudioScheduledSourceNode>(s: T): T { this.srcs.push(s); return s; }
  node<T extends AudioNode>(n: T): T { this.nodes.push(n); return n; }
  noise(kind: NoiseKind): AudioBufferSourceNode {
    const s = this.eng.ctx!.createBufferSource();
    s.buffer = this.eng.noiseBuf(kind); s.loop = true;
    return this.src(s);
  }
  osc(type: OscillatorType, f: number): OscillatorNode {
    const o = this.eng.ctx!.createOscillator(); o.type = type; o.frequency.value = f; return this.src(o);
  }
  filt(type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
    const b = this.eng.ctx!.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return this.node(b);
  }
  gain(v: number): GainNode { const g = this.eng.ctx!.createGain(); g.gain.value = v; return this.node(g); }
  start(fadeIn: number): void {
    const ctx = this.eng.ctx!, t = ctx.currentTime;
    for (const s of this.srcs) {
      if (s instanceof AudioBufferSourceNode) s.start(t, Math.random() * 1.5); else s.start(t);
    }
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.linearRampToValueAtTime(this.vol, t + Math.max(0.01, fadeIn));
  }
  setParams(p: LoopParams): void {
    if (!this.alive) return;
    Object.assign(this.params, p);
    const t = this.eng.ctx!.currentTime;
    if (p.volume !== undefined) { this.vol = p.volume; this.out.gain.setTargetAtTime(this.vol, t, 0.05); }
    if (p.pos) this.setPosition(p.pos);
    this.apply(this.params, t);
  }
  setPosition(pos: Vec3): void {
    if (!this.panner || !this.alive) return;
    this.eng.placePanner(this.panner, pos);
    this.air.frequency.setTargetAtTime(this.eng.airCutoff(pos), this.eng.ctx!.currentTime, 0.1);
  }
  stop(fade = 0.15): void {
    if (!this.alive) return;
    this.alive = false;
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    const ctx = this.eng.ctx!, t = ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0, t + Math.max(0.01, fade));
    const end = t + Math.max(0.01, fade) + 0.05;
    for (const s of this.srcs) { try { s.stop(end); } catch { /* already stopped */ } }
    const last = this.srcs[0];
    const cleanup = (): void => {
      for (const n of this.nodes) n.disconnect();
      for (const s of this.srcs) s.disconnect();
      this.out.disconnect(); this.air.disconnect(); this.panner?.disconnect();
    };
    if (last) last.onended = cleanup; else cleanup();
    this.eng.removeLoop(this);
  }
}

interface EngCfg { idle: number; max: number; cut0: number; cut1: number; depth: number; noise: number; sub: number; top: number; gears: number }
const ENGINES: Record<"engine_car" | "engine_truck" | "engine_moto" | "engine_tank", EngCfg> = {
  engine_car:   { idle: 32, max: 190, cut0: 350, cut1: 2800, depth: 0.45, noise: 0.15, sub: 0.6, top: 55, gears: 5 },
  engine_truck: { idle: 22, max: 95, cut0: 250, cut1: 1500, depth: 0.55, noise: 0.35, sub: 0.8, top: 30, gears: 6 },
  engine_moto:  { idle: 45, max: 330, cut0: 600, cut1: 4200, depth: 0.7, noise: 0.12, sub: 0.35, top: 65, gears: 5 },
  engine_tank:  { idle: 17, max: 70, cut0: 200, cut1: 900, depth: 0.5, noise: 0.6, sub: 1.0, top: 18, gears: 3 },
};

function rpmFromSpeed(speed: number, c: EngCfg): number {
  const s = clamp(Math.abs(speed) / c.top, 0, 1) * c.gears;
  const g = Math.min(Math.floor(s), c.gears - 1);
  const frac = clamp(s - g, 0, 1);
  return g === 0 ? 0.08 + 0.85 * frac : 0.35 + 0.6 * frac;
}

function buildLoop(L: Loop, name: LoopName): void {
  if (name.startsWith("engine_")) {
    const c = ENGINES[name as keyof typeof ENGINES];
    const o1 = L.osc("sawtooth", c.idle), o2 = L.osc("square", c.idle * 0.5);
    const g1 = L.gain(0.5), g2 = L.gain(0.5 * c.sub);
    const amp = L.gain(0.6);
    const mod = L.osc("sine", c.idle * 0.5), modG = L.gain(c.depth * 0.6);
    mod.connect(modG); modG.connect(amp.gain);
    const sh = L.node(L.eng.shaper(true));
    const lp = L.filt("lowpass", c.cut0, 1.5);
    o1.connect(g1); o2.connect(g2); g1.connect(amp); g2.connect(amp);
    amp.connect(sh); sh.connect(lp); lp.connect(L.out);
    const n = L.noise("brown"), ng = L.gain(c.noise), nf = L.filt("lowpass", 400);
    n.connect(nf); nf.connect(ng); ng.connect(L.out);
    let clatterG: GainNode | null = null, clatterL: OscillatorNode | null = null;
    if (name === "engine_tank") {
      const w = L.noise("white"), bf = L.filt("bandpass", 1100, 2.5);
      const gate = L.gain(0); clatterL = L.osc("square", 3); const lg = L.gain(0.5);
      clatterL.connect(lg); lg.connect(gate.gain);
      clatterG = L.gain(0);
      w.connect(bf); bf.connect(gate); gate.connect(clatterG); clatterG.connect(L.out);
    }
    L.apply = (p, t) => {
      const rpm = clamp(p.rpm ?? rpmFromSpeed(p.speed ?? 0, c), 0, 1);
      const thr = clamp(p.throttle ?? 0.3, 0, 1);
      const f = c.idle + (c.max - c.idle) * rpm;
      o1.frequency.setTargetAtTime(f, t, 0.04);
      o2.frequency.setTargetAtTime(f * 0.5, t, 0.04);
      mod.frequency.setTargetAtTime(f * 0.5, t, 0.04);
      lp.frequency.setTargetAtTime(c.cut0 + (c.cut1 - c.cut0) * rpm * (0.45 + 0.55 * thr), t, 0.05);
      amp.gain.setTargetAtTime(0.45 + 0.35 * thr, t, 0.05);
      nf.frequency.setTargetAtTime(300 + 900 * rpm, t, 0.05);
      if (clatterG && clatterL) {
        const sp = Math.abs(p.speed ?? 0);
        clatterG.gain.setTargetAtTime(clamp(sp / 6, 0, 1) * 0.5, t, 0.1);
        clatterL.frequency.setTargetAtTime(1 + sp * 2.2, t, 0.1);
      }
    };
  } else if (name === "screech") {
    const o = L.osc("sawtooth", 1100), vib = L.osc("sine", 17), vg = L.gain(70);
    vib.connect(vg); vg.connect(o.frequency);
    const lp = L.filt("bandpass", 1500, 1.5), og = L.gain(0.3);
    o.connect(lp); lp.connect(og); og.connect(L.out);
    const n = L.noise("white"), nf = L.filt("bandpass", 2500, 1), ng = L.gain(0.15);
    n.connect(nf); nf.connect(ng); ng.connect(L.out);
    L.apply = (p, t) => {
      const i = clamp(p.intensity ?? 1, 0, 1);
      og.gain.setTargetAtTime(0.3 * i, t, 0.05); ng.gain.setTargetAtTime(0.15 * i, t, 0.05);
      o.frequency.setTargetAtTime(850 + 400 * i, t, 0.08);
    };
  } else if (name === "horn") {
    const a = L.osc("sawtooth", 415), b = L.osc("sawtooth", 523), sh = L.node(L.eng.shaper()), lp = L.filt("lowpass", 1800), g = L.gain(0.22);
    a.connect(sh); b.connect(sh); sh.connect(lp); lp.connect(g); g.connect(L.out);
  } else if (name === "siren_police") {
    const o = L.osc("sawtooth", 1050), o2 = L.osc("triangle", 1050);
    const lfo = L.osc("triangle", 0.28), lg = L.gain(420);
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const lp = L.filt("lowpass", 2600), g = L.gain(0.12), g2 = L.gain(0.25);
    o.connect(g); o2.connect(g2); g.connect(lp); g2.connect(lp); lp.connect(L.out);
    L.apply = (p, t) => {
      const yelp = p.mode === "yelp";
      lfo.frequency.setTargetAtTime(yelp ? 3.6 : 0.28, t, 0.02);
      lg.gain.setTargetAtTime(yelp ? 350 : 420, t, 0.02);
    };
  } else if (name === "siren_ambulance") {
    const o = L.osc("triangle", 865), o2 = L.osc("square", 865);
    const lfo = L.osc("square", 0.9), lg = L.gain(95);
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const lp = L.filt("lowpass", 3000), g = L.gain(0.3), g2 = L.gain(0.06);
    o.connect(g); o2.connect(g2); g.connect(lp); g2.connect(lp); lp.connect(L.out);
  } else if (name === "rain") {
    const n = L.noise("pink"), hp = L.filt("highpass", 400), lp = L.filt("lowpass", 7000), g = L.gain(0.5);
    n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(L.out);
    const w = L.noise("white"), bf = L.filt("bandpass", 5200, 0.8), wg = L.gain(0.12);
    w.connect(bf); bf.connect(wg); wg.connect(L.out);
    L.apply = (p, t) => {
      const i = clamp(p.intensity ?? 0.6, 0, 1);
      g.gain.setTargetAtTime(0.15 + 0.65 * i, t, 0.3); wg.gain.setTargetAtTime(0.04 + 0.14 * i, t, 0.3);
      lp.frequency.setTargetAtTime(3500 + 5000 * i, t, 0.3);
    };
  } else if (name === "wind" || name === "sandstorm") {
    const storm = name === "sandstorm";
    const n = L.noise("brown"), bp = L.filt("bandpass", storm ? 650 : 420, 0.8), g = L.gain(0.5);
    const l1 = L.osc("sine", 0.13), l1g = L.gain(storm ? 350 : 250); l1.connect(l1g); l1g.connect(bp.frequency);
    const l2 = L.osc("sine", 0.07), l2g = L.gain(0.25); l2.connect(l2g); l2g.connect(g.gain);
    n.connect(bp); bp.connect(g); g.connect(L.out);
    let hissG: GainNode | null = null;
    if (storm) {
      const w = L.noise("white"), hp = L.filt("highpass", 3000);
      hissG = L.gain(0.12);
      const l3 = L.osc("sine", 0.31), l3g = L.gain(0.06); l3.connect(l3g); l3g.connect(hissG.gain);
      w.connect(hp); hp.connect(hissG); hissG.connect(L.out);
    }
    L.apply = (p, t) => {
      const i = clamp(p.intensity ?? 0.6, 0, 1);
      g.gain.setTargetAtTime((storm ? 0.4 : 0.2) + 0.6 * i, t, 0.4);
      bp.frequency.setTargetAtTime((storm ? 500 : 300) + 500 * i, t, 0.4);
      if (hissG) hissG.gain.setTargetAtTime(0.05 + 0.2 * i, t, 0.4);
    };
  } else if (name === "city") {
    const n = L.noise("brown"), lp = L.filt("lowpass", 220), tg = L.gain(0.5);
    n.connect(lp); lp.connect(tg); tg.connect(L.out);
    const pn = L.noise("pink"), bp = L.filt("bandpass", 800, 0.5), pg = L.gain(0.04);
    pn.connect(bp); bp.connect(pg); pg.connect(L.out);
    // crickets: 4.4 kHz carrier gated by two unipolar square LFOs
    const cr = L.osc("sine", 4400), g1 = L.gain(0.5), g2 = L.gain(0.5), night = L.gain(0);
    const lf1 = L.osc("square", 28), lf1g = L.gain(0.5); lf1.connect(lf1g); lf1g.connect(g1.gain);
    const lf2 = L.osc("square", 1.1), lf2g = L.gain(0.5); lf2.connect(lf2g); lf2g.connect(g2.gain);
    cr.connect(g1); g1.connect(g2); g2.connect(night); night.connect(L.out);
    const birdBus = L.gain(1); birdBus.connect(L.out);
    L.apply = (p, t) => {
      const day = clamp(p.day ?? 1, 0, 1), i = clamp(p.intensity ?? 0.6, 0, 1);
      tg.gain.setTargetAtTime(0.15 + 0.6 * i, t, 0.5); pg.gain.setTargetAtTime(0.01 + 0.06 * i, t, 0.5);
      night.gain.setTargetAtTime(0.035 * (1 - day), t, 1);
    };
    L.timer = setInterval(() => {
      const e = L.eng;
      if (!L.alive || e.paused || !e.ctx || e.ctx.state !== "running") return;
      if (Math.random() > 0.35 * clamp(L.params.day ?? 1, 0, 1)) return;
      const t0 = e.ctx.currentTime + Math.random() * 0.2;
      const base = rnd(2500, 4200), notes = 2 + Math.floor(Math.random() * 4);
      for (let k = 0; k < notes; k++) {
        const o = e.ctx.createOscillator(), g = e.ctx.createGain(), at = t0 + k * rnd(0.08, 0.14);
        o.type = "sine";
        o.frequency.setValueAtTime(base * rnd(0.9, 1.2), at);
        o.frequency.exponentialRampToValueAtTime(base * rnd(1.2, 1.6), at + 0.05);
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.025, at + 0.01); g.gain.setTargetAtTime(0, at + 0.03, 0.015);
        o.connect(g); g.connect(birdBus); o.start(at); o.stop(at + 0.2);
        o.onended = (): void => { o.disconnect(); g.disconnect(); };
      }
    }, 350) as unknown as number;
  }
}

const LOOP_REF: Record<LoopName, number> = {
  engine_car: 5, engine_truck: 7, engine_moto: 5, engine_tank: 10, screech: 6, horn: 6,
  siren_police: 15, siren_ambulance: 15, rain: 1, wind: 1, sandstorm: 1, city: 1,
};

// ---------------------------------------------------------------- engine
export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; sfx!: GainNode; music!: GainNode; amb!: GainNode; ui!: GainNode;
  /** everything that is muted by pauseAll() (sfx + amb). UI and music keep playing. */
  world!: GainNode;
  paused = false;
  maxVoices = 40;
  maxLoops = 24;
  /** sounds farther than refDistance * cullFactor are skipped */
  cullFactor = 60;
  private voices: Voice[] = [];
  private loops: Loop[] = [];
  private noise = new Map<NoiseKind, AudioBuffer>();
  private curve: Float32Array<ArrayBuffer> | null = null;
  private curveHard: Float32Array<ArrayBuffer> | null = null;
  private lp: Vec3 = { x: 0, y: 0, z: 0 };
  private vols: Record<BusName, number> = { master: 0.8, sfx: 1, music: 0.7, amb: 0.8, ui: 0.8 };

  /** Create (first call) and resume the AudioContext. Call from a user gesture (click / keydown / gamepad button). */
  init(): AudioContext {
    if (!this.ctx) {
      const AC: typeof AudioContext = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC({ latencyHint: "interactive" });
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
      this.master = ctx.createGain(); this.master.connect(comp); comp.connect(ctx.destination);
      this.world = ctx.createGain(); this.world.connect(this.master);
      this.sfx = ctx.createGain(); this.sfx.connect(this.world);
      this.amb = ctx.createGain(); this.amb.connect(this.world);
      this.music = ctx.createGain(); this.music.connect(this.master);
      this.ui = ctx.createGain(); this.ui.connect(this.master);
      for (const k of Object.keys(this.vols) as BusName[]) this.bus(k).gain.value = this.vols[k];
      for (const k of ["white", "pink", "brown"] as NoiseKind[]) this.noiseBuf(k);
      this.setListener(this.lp, { x: 0, y: 0, z: -1 });
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  get ready(): boolean { return !!this.ctx && this.ctx.state === "running"; }

  bus(name: BusName): GainNode {
    switch (name) { case "master": return this.master; case "sfx": return this.sfx; case "music": return this.music; case "amb": return this.amb; default: return this.ui; }
  }
  /** connect external music (e.g. an <audio> MediaElementSource) here */
  get musicBus(): GainNode | null { return this.ctx ? this.music : null; }

  setVolume(bus: BusName, v: number): void {
    this.vols[bus] = clamp(v, 0, 1);
    if (this.ctx) this.bus(bus).gain.setTargetAtTime(this.vols[bus], this.ctx.currentTime, 0.03);
  }
  getVolume(bus: BusName): number { return this.vols[bus]; }

  /** Mutes world sounds (sfx + ambience + loops) and ignores new world one-shots. UI and music continue. */
  pauseAll(): void {
    this.paused = true;
    if (this.ctx) this.world.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
  }
  resumeAll(): void {
    this.paused = false;
    if (this.ctx) { this.world.gain.setTargetAtTime(1, this.ctx.currentTime, 0.03); if (this.ctx.state === "suspended") void this.ctx.resume(); }
  }
  /** Full suspend of the AudioContext (e.g. on tab hidden). */
  suspend(): void { void this.ctx?.suspend(); }

  setListener(pos: Vec3, forward: Vec3, up: Vec3 = { x: 0, y: 1, z: 0 }): void {
    this.lp.x = pos.x; this.lp.y = pos.y; this.lp.z = pos.z;
    if (!this.ctx) return;
    const L = this.ctx.listener, t = this.ctx.currentTime;
    if (L.positionX) {
      L.positionX.setValueAtTime(pos.x, t); L.positionY.setValueAtTime(pos.y, t); L.positionZ.setValueAtTime(pos.z, t);
      L.forwardX.setValueAtTime(forward.x, t); L.forwardY.setValueAtTime(forward.y, t); L.forwardZ.setValueAtTime(forward.z, t);
      L.upX.setValueAtTime(up.x, t); L.upY.setValueAtTime(up.y, t); L.upZ.setValueAtTime(up.z, t);
    } else {
      L.setPosition(pos.x, pos.y, pos.z);
      L.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  /** Play a one-shot. Returns false if skipped (not initialised, paused, culled). */
  play(name: SoundName, o: PlayOptions = {}): boolean {
    const ctx = this.ctx;
    if (!ctx) return false;
    const r = RECIPES[name];
    if (!r) return false;
    if (o.listener) this.setListener(o.listener.pos, o.listener.forward ?? { x: 0, y: 0, z: -1 });
    const busName = o.bus ?? (name.startsWith("ui_") || name === "phone" ? "ui" : name === "thunder" ? "amb" : "sfx");
    if (this.paused && busName !== "ui") return false;
    let dist = 0;
    if (o.pos) {
      dist = Math.hypot(o.pos.x - this.lp.x, o.pos.y - this.lp.y, o.pos.z - this.lp.z);
      if (dist > r.ref * this.cullFactor) return false;
    }
    // voice stealing
    this.reap(ctx.currentTime);
    if (this.voices.length >= this.maxVoices) this.kill(this.voices.shift()!, ctx.currentTime);

    const out = ctx.createGain();
    out.gain.value = o.volume ?? 1;
    const voice: Voice = { end: 0, out, srcs: [], nodes: [], done: false };
    let tail: AudioNode = out;
    if (o.pos) {
      const air = ctx.createBiquadFilter();
      air.type = "lowpass"; air.frequency.value = this.airCutoff(o.pos);
      const p = this.makePanner(r.ref);
      this.placePanner(p, o.pos);
      out.connect(air); air.connect(p); tail = p;
      voice.nodes.push(air, p);
    }
    tail.connect(this.bus(busName));
    const t = ctx.currentTime + 0.005 + (o.delay ?? 0);
    const v = new VB(ctx, t, out, (o.pitch ?? 1) * rnd(0.96, 1.04), this, voice);
    r.fn(v);
    voice.end = v.maxStop;
    if (v.last) v.last.onended = (): void => this.cleanup(voice);
    this.voices.push(voice);
    return true;
  }

  /** Start a continuous loop. Keep the handle; call setParams() per frame and stop() when done. */
  loop(name: LoopName, o: LoopOptions = {}): LoopHandle | null {
    if (!this.ctx) return null;
    if (this.loops.length >= this.maxLoops) this.loops[0].stop(0.05);
    const defBus = name === "rain" || name === "wind" || name === "sandstorm" || name === "city" ? "amb" : "sfx";
    const L = new Loop(name, this, this.bus(o.bus ?? defBus), o.pos, LOOP_REF[name]);
    L.vol = o.volume ?? 1;
    buildLoop(L, name);
    L.setParams(o);
    L.start(o.fadeIn ?? 0.2);
    this.loops.push(L);
    return L;
  }

  stopAllLoops(fade = 0.2): void { for (const l of this.loops.slice()) l.stop(fade); }

  get activeVoices(): number { if (this.ctx) this.reap(this.ctx.currentTime); return this.voices.length; }
  get activeLoops(): number { return this.loops.length; }

  // ---- internals (public for helpers in this module)
  removeLoop(l: Loop): void { const i = this.loops.indexOf(l); if (i >= 0) this.loops.splice(i, 1); }

  noiseBuf(kind: NoiseKind): AudioBuffer {
    let b = this.noise.get(kind);
    if (b) return b;
    const ctx = this.ctx!, n = Math.floor(ctx.sampleRate * 2);
    b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    if (kind === "white") for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    else if (kind === "pink") {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
    } else {
      let last = 0;
      for (let i = 0; i < n; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    }
    this.noise.set(kind, b);
    return b;
  }

  shaper(hard = false): WaveShaperNode {
    const ctx = this.ctx!;
    if (!this.curve) {
      const mk = (k: number): Float32Array<ArrayBuffer> => {
        const c = new Float32Array(new ArrayBuffer(1024 * 4));
        for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
        return c;
      };
      this.curve = mk(3); this.curveHard = mk(12);
    }
    const w = ctx.createWaveShaper();
    w.curve = hard ? this.curveHard! : this.curve;
    w.oversample = "none";
    return w;
  }

  makePanner(ref: number): PannerNode {
    const p = this.ctx!.createPanner();
    p.panningModel = "equalpower";
    p.distanceModel = "inverse";
    p.refDistance = ref;
    p.maxDistance = 2000;
    p.rolloffFactor = 1;
    return p;
  }
  placePanner(p: PannerNode, pos: Vec3): void {
    const t = this.ctx!.currentTime;
    if (p.positionX) { p.positionX.setValueAtTime(pos.x, t); p.positionY.setValueAtTime(pos.y, t); p.positionZ.setValueAtTime(pos.z, t); }
    else p.setPosition(pos.x, pos.y, pos.z);
  }
  airCutoff(pos: Vec3): number {
    const d = Math.hypot(pos.x - this.lp.x, pos.y - this.lp.y, pos.z - this.lp.z);
    return clamp(20000 * Math.exp(-d / 120), 700, 20000);
  }

  private reap(now: number): void {
    let w = 0;
    for (let i = 0; i < this.voices.length; i++) { const v = this.voices[i]; if (!v.done && v.end > now) this.voices[w++] = v; }
    this.voices.length = w;
  }
  private kill(v: Voice, now: number): void {
    v.out.gain.cancelScheduledValues(now);
    v.out.gain.setValueAtTime(v.out.gain.value, now);
    v.out.gain.linearRampToValueAtTime(0, now + 0.02);
    for (const s of v.srcs) { try { s.stop(now + 0.03); } catch { /* ignore */ } }
  }
  private cleanup(v: Voice): void {
    if (v.done) return;
    v.done = true;
    for (const s of v.srcs) s.disconnect();
    for (const n of v.nodes) n.disconnect();
    v.out.disconnect();
  }
}

// ---------------------------------------------------------------- default singleton + function API
export const audio = new AudioEngine();
export const initAudio = (): AudioContext => audio.init();
export const play = (name: SoundName, o?: PlayOptions): boolean => audio.play(name, o);
export const loop = (name: LoopName, o?: LoopOptions): LoopHandle | null => audio.loop(name, o);
export const setListener = (pos: Vec3, forward: Vec3, up?: Vec3): void => audio.setListener(pos, forward, up);
export const setVolume = (bus: BusName, v: number): void => audio.setVolume(bus, v);
export const pauseAll = (): void => audio.pauseAll();
export const resumeAll = (): void => audio.resumeAll();
/** Convenience: footstep by surface */
export const step = (surface: "concrete" | "sand" | "grass", o?: PlayOptions): boolean =>
  audio.play(surface === "sand" ? "step_sand" : surface === "grass" ? "step_grass" : "step_concrete", o);
export const SOUND_NAMES = Object.keys(RECIPES) as SoundName[];
export const LOOP_NAMES = Object.keys(LOOP_REF) as LoopName[];
