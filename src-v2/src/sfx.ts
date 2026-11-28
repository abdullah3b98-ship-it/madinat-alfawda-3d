// Audio glue: recorded files (assets/audio) when present, otherwise the procedural engine in fx/audio.ts.
import { initAudio, play, loop, setListener, setVolume as busVol, pauseAll, resumeAll, audio, LoopHandle, LoopName } from "./fx/audio";
import { audioFile, buffer, playBuf, bindCtx } from "./assets";

let inited = false;
export function init(): void {
  if (inited) { if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume().catch(() => undefined); return; }
  try { const c = initAudio(); bindCtx(c, audio.musicBus); inited = true; } catch (_e) { /* no audio */ }
}
export function volume(v: number): void { if (inited) busVol("master", v); }
const LP = { x: 0, y: 0, z: 0 };
function att(pos?: { x: number; y: number; z: number }): number { if (!pos) return 1; const d = Math.hypot(pos.x - LP.x, pos.y - LP.y, pos.z - LP.z); return Math.max(0, Math.min(1, 6 / Math.max(6, d)) - 0.04); }
export function listener(p: { x: number; y: number; z: number }, f: { x: number; y: number; z: number }): void { LP.x = p.x; LP.y = p.y; LP.z = p.z; if (inited) setListener(p, f); }
export function pause(on: boolean): void { if (!inited) return; if (on) pauseAll(); else resumeAll(); }
function fileOr(name: string, fallback: () => void, vol = 1): void {
  if (!inited) return;
  if (!audioFile(name)) { fallback(); return; }
  buffer(name).then((b: AudioBuffer | null) => { if (b) playBuf(b, vol, false); else fallback(); });
}
export function click(): void { fileOr("ui_click", () => { play("ui_click"); }, 0.6); }
export function phone(): void { fileOr("phone_notify", () => { play("phone"); }, 0.7); }
export function hover(): void { if (audioFile("ui_hover")) fileOr("ui_hover", () => undefined, 0.35); }
export function thunder(delay: number): void { if (!inited) return; if (audioFile("thunder")) setTimeout(() => fileOr("thunder", () => play("thunder")), delay * 1000); else play("thunder", { delay }); }
export function oneShot(name: Parameters<typeof play>[0], pos?: { x: number; y: number; z: number }, vol = 1, file?: string): void { if (!inited) return; const f = file || name; if (audioFile(f)) { const a = att(pos) * vol; if (a > 0.01) fileOr(f, () => play(name, { pos, volume: vol }), a); } else play(name, { pos, volume: vol }); }

// loops: prefer a recorded "<name>_loop" file, else procedural
type L = { h: LoopHandle | null; file: { stop: () => void; gain: GainNode; src?: AudioBufferSourceNode } | null; tried: boolean };
const loops: Record<string, L> = {};
export function loopSet(key: string, name: LoopName, on: boolean, params: Parameters<LoopHandle["setParams"]>[0], file?: string): void {
  if (!inited) return;
  let l = loops[key]; if (!l) { l = loops[key] = { h: null, file: null, tried: false }; }
  const fname = file || name + "_loop";
  if (on) {
    if (!l.h && !l.file && !l.tried) {
      l.tried = true;
      if (audioFile(fname)) buffer(fname).then((b: AudioBuffer | null) => { if (b && !l!.h) l!.file = playBuf(b, 0, true); else if (!l!.h) l!.h = loop(name, params); });
      else l.h = loop(name, params);
    }
    if (l.h && l.h.alive) l.h.setParams(params);
    if (l.file) { const P = params as { volume?: number; intensity?: number; speed?: number; throttle?: number; pos?: { x: number; y: number; z: number } }; l.file.gain.gain.value = Math.min(1, (P.volume ?? 1) * (P.intensity ?? 1)) * att(P.pos); if (P.speed !== undefined && l.file.src) l.file.src.playbackRate.value = 0.7 + Math.min(1.1, P.speed / 30) + (P.throttle ?? 0) * 0.15; }
  } else if (l.h || l.file) {
    if (l.h) l.h.stop(0.6); if (l.file) l.file.stop(); l.h = null; l.file = null; l.tried = false;
  }
}
// menu music: file menu_theme or a soft procedural pad on the music bus
let pad: { stop: () => void } | null = null;
export function menuMusic(on: boolean): void {
  if (!inited) return; const c = audio.ctx, bus = audio.musicBus; if (!c || !bus) return;
  if (on && !pad) {
    if (audioFile("menu_theme")) { pad = { stop: () => undefined }; buffer("menu_theme").then((b: AudioBuffer | null) => { if (b && pad) { const p = playBuf(b, 0.5, true); if (p) pad.stop = p.stop; } }); return; }
    const g = c.createGain(); g.gain.value = 0; g.connect(bus); g.gain.linearRampToValueAtTime(0.05, c.currentTime + 3);
    const notes = [73.42, 146.83, 220, 277.18]; const os: OscillatorNode[] = [];
    notes.forEach((f: number, i: number) => { const o = c.createOscillator(); o.type = i ? "sine" : "triangle"; o.frequency.value = f; const lf = c.createOscillator(), lg = c.createGain(); lf.frequency.value = 0.05 + i * 0.03; lg.gain.value = 4 + i * 2; lf.connect(lg); lg.connect(o.detune); lf.start(); o.connect(g); o.start(); os.push(o, lf); });
    pad = { stop: () => { g.gain.setTargetAtTime(0, c.currentTime, 0.6); setTimeout(() => os.forEach((o: OscillatorNode) => { try { o.stop(); } catch (_e) { /* */ } }), 2500); } };
  } else if (!on && pad) { pad.stop(); pad = null; }
}
