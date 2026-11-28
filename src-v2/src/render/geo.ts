import * as THREE from "three";

// Geometry bucket with world-scaled UVs and vertex colors; merged into one mesh per chunk/material.
export class GB {
  p: number[] = []; n: number[] = []; u: number[] = []; c: number[] = []; i: number[] = [];
  get empty(): boolean { return this.i.length === 0; }
  quad(a: number[], b: number[], cc: number[], d: number[], nx: number, ny: number, nz: number, ua: number[], col: THREE.Color): void {
    const o = this.p.length / 3;
    for (const v of [a, b, cc, d]) { this.p.push(v[0], v[1], v[2]); this.n.push(nx, ny, nz); this.c.push(col.r, col.g, col.b); }
    this.u.push(ua[0], ua[2], ua[1], ua[2], ua[1], ua[3], ua[0], ua[3]);
    this.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  // axis-aligned box; cw/ch = UV meters per unit; uo/vo = uv offsets; top/bottom flags
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col: THREE.Color, cw: number, ch: number, uo: number, vo: number, top: boolean, bottom: boolean): void {
    const V0 = (y0) / ch + vo, V1 = (y1) / ch + vo;
    // +z face
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1, [x0 / cw + uo, x1 / cw + uo, V0, V1], col);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1, [-x1 / cw + uo, -x0 / cw + uo, V0, V1], col);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0, [-z1 / cw + uo, -z0 / cw + uo, V0, V1], col);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0, [z0 / cw + uo, z1 / cw + uo, V0, V1], col);
    if (top) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 0, 1, 0, [x0 / cw, x1 / cw, -z1 / cw, -z0 / cw], col);
    if (bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0, -1, 0, [x0 / cw, x1 / cw, z0 / cw, z1 / cw], col);
  }
  top(x0: number, y: number, z0: number, x1: number, z1: number, col: THREE.Color, cw: number): void {
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], 0, 1, 0, [x0 / cw, x1 / cw, -z1 / cw, -z0 / cw], col);
  }
  cyl(cx: number, cz: number, rad: number, y0: number, y1: number, seg: number, col: THREE.Color, cw: number, ch: number, uo: number, vo: number, cap: boolean): void {
    const circ = Math.PI * 2 * rad;
    for (let s = 0; s < seg; s++) {
      const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
      const p0 = [cx + Math.cos(a0) * rad, cz + Math.sin(a0) * rad], p1 = [cx + Math.cos(a1) * rad, cz + Math.sin(a1) * rad];
      const u0 = (s / seg) * circ / cw + uo, u1 = ((s + 1) / seg) * circ / cw + uo;
      this.quad([p1[0], y0, p1[1]], [p0[0], y0, p0[1]], [p0[0], y1, p0[1]], [p1[0], y1, p1[1]], Math.cos(am), 0, Math.sin(am), [u1, u0, y0 / ch + vo, y1 / ch + vo], col);
      if (cap) { const o = this.p.length / 3; this.p.push(cx, y1, cz, p0[0], y1, p0[1], p1[0], y1, p1[1]); for (let k = 0; k < 3; k++) { this.n.push(0, 1, 0); this.c.push(col.r, col.g, col.b); } this.u.push(0, 0, 0.1, 0, 0, 0.1); this.i.push(o, o + 2, o + 1); }
    }
  }
  // add arbitrary three geometry (non-indexed or indexed) transformed by matrix with color
  geo(gsrc: THREE.BufferGeometry, m: THREE.Matrix4, col: THREE.Color): void {
    const g = gsrc.index ? gsrc.toNonIndexed() : gsrc;
    const pa = g.getAttribute("position"), na = g.getAttribute("normal"), ua = g.getAttribute("uv");
    const nm = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3(), o = this.p.length / 3;
    for (let k = 0; k < pa.count; k++) {
      v.set(pa.getX(k), pa.getY(k), pa.getZ(k)).applyMatrix4(m); this.p.push(v.x, v.y, v.z);
      v.set(na.getX(k), na.getY(k), na.getZ(k)).applyMatrix3(nm).normalize(); this.n.push(v.x, v.y, v.z);
      this.u.push(ua ? ua.getX(k) : 0, ua ? ua.getY(k) : 0); this.c.push(col.r, col.g, col.b); this.i.push(o + k);
    }
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i); g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}
export function col(h: string, f = 1): THREE.Color { const c = new THREE.Color(h); c.multiplyScalar(f); return c; }
