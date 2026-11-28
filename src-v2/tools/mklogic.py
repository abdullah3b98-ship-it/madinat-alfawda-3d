import re,sys
L=open('/workspace/tc/live4.tsx').read().split('\n')
# 1-based line ranges
def rng(a,b): return L[a-1:b]
keep = rng(3,85) + rng(160,1338) + rng(1564,1565) + rng(1354,1540) + rng(1672,1745)
s='\n'.join(keep)
def rep(a,b,cnt=1):
    global s
    assert a in s, a[:80]
    s=s.replace(a,b,cnt)
rep('const NB = 8,','const NB = 11,')
rep('type Block = { k: number; x: number; z: number; s: number; solids: Rect[] };','type Block = { k: number; x: number; z: number; s: number; solids: Rect[]; d: number };')
rep('aimP: number; b: Bud; pv: M4 };','aimP: number; b: Bud; pv: M4; inside: boolean; ui: boolean; menuCam: boolean };')
rep('aimP: 0, b: mkBud(HOSP.x + 1.5, HOSP.z - 2.5), pv: m4() };','aimP: 0, b: mkBud(HOSP.x + 1.5, HOSP.z - 2.5), pv: m4(), inside: false, ui: false, menuCam: true };')
rep('const p = g.p, k = g.keys, st = g.started, pad = g.pad, po = st && pad.on;','const p = g.p, k = g.keys, st = g.started && !g.inside && !g.ui, pad = g.pad, po = st && pad.on;')
# speak volume
rep('u.lang = "ar-SA"; u.rate = 1.05; u.pitch = 0.95;','u.lang = "ar-SA"; u.rate = 1.05; u.pitch = 0.95; u.volume = HOOK.vol;')
# pad hooks
rep('const now: boolean[] = []; for (let i = 0; i < 17; i++) now.push(b(i));','const now: boolean[] = []; for (let i = 0; i < 18; i++) now.push(b(i));')
rep('  if (g.started) {\n    if (edge(3)) toggleCar(g);','  if (g.started && (edge(8) || edge(17))) HOOK.phone();\n  if (g.started && !g.ui && !g.inside) {\n    if (edge(3) && !HOOK.tri()) toggleCar(g);')
# height-aware camera collision
rep('if (solidAt(g.B, qx, qz) && qy < 40)','if (solidAtH(g.B, qx, qz, qy))')
rep('function moveCircle(','function solidAtH(B: Block[], x: number, z: number, y: number): boolean {\n  if (x < 0 || z < 0 || x > WORLD || z > WORLD) return false;\n  const bx = Math.floor(x / BS), bz = Math.floor(z / BS);\n  if (bx >= NB || bz >= NB || x - bx * BS < RW || z - bz * BS < RW) return false;\n  for (const s of B[bz * NB + bx].solids) if (y < s.h + 0.3 && x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return true;\n  return false;\n}\nfunction moveCircle(')
# HOSP mutable already object; keep
rep('const w = window as any, ss = w.speechSynthesis, U = w.SpeechSynthesisUtterance; if (!ss || !U) return;','const w = window as any, ss = w.speechSynthesis, U = w.SpeechSynthesisUtterance;')
rep('if (!t) return;\n    ss.cancel();','if (!t) return;\n    if (HOOK.voiceFile(t)) { VOX.lastSaid = t; VOX.saidAt = Date.now(); return; }\n    if (!ss || !U) return;\n    ss.cancel();')
rep('  const p = g.p;\n  g.shake = Math.max(g.shake, 0.7 *', '  const p = g.p; HOOK.ev("boom", x, y, z, 0);\n  g.shake = Math.max(g.shake, 0.7 *')
rep('if (p.car) return; p.punch = 0.25;', 'if (p.car) return; p.punch = 0.25; HOOK.ev("punch", p.x, 1.4, p.z, 0);')
rep('  p.ammo[p.w]--;', '  p.ammo[p.w]--; HOOK.ev("gun", p.x, 1.5, p.z, p.w);')
rep('if (c === g.p.car) { g.shake = Math.max(g.shake, sp * 0.02); bCrash(g, sp); }', 'if (c === g.p.car) { g.shake = Math.max(g.shake, sp * 0.02); bCrash(g, sp); } HOOK.ev("crash", c.x, 0.6, c.z, sp);')
rep('if (pl) { g.shake = Math.max(g.shake, -rel * 0.02); bCrash(g, -rel * 2); }', 'if (pl) { g.shake = Math.max(g.shake, -rel * 0.02); bCrash(g, -rel * 2); } HOOK.ev("crash", a.x, 0.6, a.z, -rel);')
rep('if (c.cd <= 0) { c.cd = rr(1, 1.8);', 'if (c.cd <= 0) { c.cd = rr(1, 1.8); HOOK.ev("npcgun", c.x, 1.7, c.z, 1);')
rep('if (b.hitCd <= 0) { b.hitCd = rr(1.4, 2.6);', 'if (b.hitCd <= 0) { b.hitCd = rr(1.4, 2.6); HOOK.ev("npcgun", b.thx, 1.7, b.thz, 3);')
rep('  const wi = bw(g), w = WP[wi]; b.cd = w.cd * (wi === 4 ? 2.5 : 1.8);', '  const wi = bw(g), w = WP[wi]; b.cd = w.cd * (wi === 4 ? 2.5 : 1.8); HOOK.ev("gun", b.x, 1.5, b.z, wi);')
exec(open('/workspace/madinat-v2/tools/en_logic.py').read())
for a, b in TR:
    if a in s: s = s.replace(a, b)
    else: print('TR miss', a[:50])
s = 'const HOOK = { vol: 1, phone: (): void => undefined, tri: (): boolean => false, voiceFile: (_t: string): boolean => false, ev: (_n: string, _x: number, _y: number, _z: number, _a: number): void => undefined };\n' + s
# export all top-level decls
s = re.sub(r'^(function|const|let|type) ', r'export \1 ', s, flags=re.M)
s = '/* eslint-disable */\n// Game logic ported from v1 (simulation, سلطان AI, voice, NLU). Rendering lives in render/*.\n' + s
open('/workspace/madinat-v2/src/logic.ts','w').write(s)
print(len(s))
