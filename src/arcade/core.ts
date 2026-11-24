// Math, WebGL 2 helpers and a small mesh builder. Everything the hall is drawn with, and nothing else.
export type V3 = [number, number, number];
export type M4 = Float32Array;

// ---------- math (column-major, like GLSL) ----------
export const m4 = () => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; };
export function mul(a: M4, b: M4, o: M4 = new Float32Array(16)): M4 {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
export function perspective(fovY: number, aspect: number, near: number, far: number, shiftY = 0, shiftX = 0): M4 {
  const f = 1 / Math.tan(fovY / 2), m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f; m[8] = shiftX; m[9] = shiftY; m[10] = (far + near) / (near - far); m[11] = -1; m[14] = (2 * far * near) / (near - far);
  return m;
}
export function ortho(l: number, r: number, b: number, t: number, n: number, f: number): M4 {
  const m = m4();
  m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n);
  m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n);
  return m;
}
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export function lookAt(eye: V3, at: V3, up: V3 = [0, 1, 0]): M4 {
  const z = norm(sub(eye, at)), x = norm(cross(up, z)), y = cross(z, x), m = m4();
  m[0] = x[0]; m[4] = x[1]; m[8] = x[2];
  m[1] = y[0]; m[5] = y[1]; m[9] = y[2];
  m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
  m[12] = -dot(x, eye); m[13] = -dot(y, eye); m[14] = -dot(z, eye);
  return m;
}
export function invert(a: M4): M4 {
  const o = new Float32Array(16);
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d;
  o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
  o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d;
  o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
  o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d;
  o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
  o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d;
  o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
  return o;
}
export const xform = (m: M4, p: V3): V3 => {
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return [(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w, (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w, (m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]) / w];
};
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const hex = (h: string): V3 => [1, 3, 5].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255) ** 2.2) as V3;

// ---------- GL ----------
export type GL = WebGL2RenderingContext;
export type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation> };
export function program(gl: GL, vs: string, fs: string): Prog {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + "\n" + src.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n"));
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, "aPos");
  gl.bindAttribLocation(p, 1, "aNrm");
  gl.bindAttribLocation(p, 2, "aAux");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
  const u: Record<string, WebGLUniformLocation> = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i)!.name.replace(/\[0\]$/, "");
    u[name] = gl.getUniformLocation(p, name)!;
  }
  return { p, u };
}

export type Mesh = { vao: WebGLVertexArrayObject; count: number; min: V3; max: V3 };
export function upload(gl: GL, g: Geo): Mesh {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.v), gl.STATIC_DRAW);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(g.i), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24);
  gl.bindVertexArray(null);
  const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < g.v.length; k += 10) for (let j = 0; j < 3; j++) { min[j] = Math.min(min[j], g.v[k + j]); max[j] = Math.max(max[j], g.v[k + j]); }
  return { vao, count: g.i.length, min, max };
}

export type Target = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };
export function target(gl: GL, w: number, h: number, fmt: { internal: number; format: number; type: number }, depth = false, mips = false): Target {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internal, w, h, 0, fmt.format, fmt.type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (depth) {
    const rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fb, tex, w, h };
}
export function texture(gl: GL, src: TexImageSource | null, mips = true, w = 1, h = 1): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(w * h * 4));
  if (mips) gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
  if (aniso && mips) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  return t;
}

// ---------- mesh builder ----------
// A vertex is position, normal and aux = (u, v, material, flag). Every face is wound from the normal it is given,
// so callers never think about winding, and back faces can be culled everywhere.
export class Geo {
  v: number[] = [];
  i: number[] = [];
  private m: M4 = m4();
  private stack: M4[] = [];
  push(t: M4) { this.stack.push(this.m); this.m = mul(this.m, t); return this; }
  pop() { this.m = this.stack.pop()!; return this; }
  private vert(p: V3, n: V3, u: number, v: number, mat: number, flag: number) {
    const m = this.m, q = xform(m, p);
    const nn = norm([m[0] * n[0] + m[4] * n[1] + m[8] * n[2], m[1] * n[0] + m[5] * n[1] + m[9] * n[2], m[2] * n[0] + m[6] * n[1] + m[10] * n[2]]);
    this.v.push(q[0], q[1], q[2], nn[0], nn[1], nn[2], u, v, mat, flag);
    return this.v.length / 10 - 1;
  }
  /** A flat polygon (convex, or with tris given) facing n. uv(p) maps each corner. */
  poly(ps: V3[], n: V3, mat: number, uv: (p: V3) => [number, number] = () => [0, 0], flag = 0, tris?: number[]) {
    const ids = ps.map((p) => { const [u, v] = uv(p); return this.vert(p, n, u, v, mat, flag); });
    const t = tris ?? ps.slice(2).flatMap((_, k) => [0, k + 1, k + 2]);
    for (let k = 0; k < t.length; k += 3) {
      const [a, b, c] = [t[k], t[k + 1], t[k + 2]];
      const f = dot(cross(sub(ps[b], ps[a]), sub(ps[c], ps[a])), n) >= 0;
      this.i.push(ids[a], f ? ids[b] : ids[c], f ? ids[c] : ids[b]);
    }
    return this;
  }
  /** Axis-aligned box from its centre and size. mats: one material, or [+x, -x, +y, -y, +z, -z]. */
  box(c: V3, s: V3, mat: number | number[], uv?: (p: V3, face: number) => [number, number], flag = 0) {
    const [x, y, z] = c, [a, b, d] = [s[0] / 2, s[1] / 2, s[2] / 2];
    const mats = typeof mat === "number" ? [mat, mat, mat, mat, mat, mat] : mat;
    const faces: [V3, V3[]][] = [
      [[1, 0, 0], [[x + a, y - b, z - d], [x + a, y + b, z - d], [x + a, y + b, z + d], [x + a, y - b, z + d]]],
      [[-1, 0, 0], [[x - a, y - b, z - d], [x - a, y - b, z + d], [x - a, y + b, z + d], [x - a, y + b, z - d]]],
      [[0, 1, 0], [[x - a, y + b, z - d], [x - a, y + b, z + d], [x + a, y + b, z + d], [x + a, y + b, z - d]]],
      [[0, -1, 0], [[x - a, y - b, z - d], [x + a, y - b, z - d], [x + a, y - b, z + d], [x - a, y - b, z + d]]],
      [[0, 0, 1], [[x - a, y - b, z + d], [x + a, y - b, z + d], [x + a, y + b, z + d], [x - a, y + b, z + d]]],
      [[0, 0, -1], [[x - a, y - b, z - d], [x - a, y + b, z - d], [x + a, y + b, z - d], [x + a, y - b, z - d]]],
    ];
    faces.forEach(([n, ps], f) => {
      if (mats[f] < 0) return;
      // Default uv spans each face 0..1, with v down, as seen from outside.
      const map = uv ? (p: V3) => uv(p, f) : (p: V3) => {
        const ax = f < 2 ? [2, 1] : f < 4 ? [0, 2] : [0, 1];
        const lo = [x - a, y - b, z - d], sz = [s[0], s[1], s[2]];
        const uu = (p[ax[0]] - lo[ax[0]]) / sz[ax[0]], vv = 1 - (p[ax[1]] - lo[ax[1]]) / sz[ax[1]];
        return [f === 1 || f === 4 ? uu : f === 0 || f === 5 ? 1 - uu : uu, vv] as [number, number];
      };
      this.poly(ps, n, mats[f], map, flag);
    });
    return this;
  }
  /** Cylinder along y from its base centre. */
  cyl(c: V3, r: number, h: number, seg: number, mat: number, capMat = mat, top = true, r2 = r) {
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
      const p = (a: number, y: number, rr: number): V3 => [c[0] + Math.cos(a) * rr, c[1] + y, c[2] + Math.sin(a) * rr];
      const slope = (r - r2) / h;
      const n0 = norm([Math.cos((a0 + a1) / 2), slope, Math.sin((a0 + a1) / 2)]);
      this.poly([p(a0, 0, r), p(a1, 0, r), p(a1, h, r2), p(a0, h, r2)], n0, mat);
      if (top) this.poly([[c[0], c[1] + h, c[2]], p(a0, h, r2), p(a1, h, r2)], [0, 1, 0], capMat);
    }
    return this;
  }
  sphere(c: V3, r: number, seg: number, mat: number, squash = 1) {
    const rings = Math.max(3, seg >> 1);
    for (let j = 0; j < rings; j++) for (let k = 0; k < seg; k++) {
      const pt = (jj: number, kk: number): V3 => {
        const th = (jj / rings) * Math.PI, ph = (kk / seg) * Math.PI * 2;
        return [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      };
      const qs = [pt(j, k), pt(j, k + 1), pt(j + 1, k + 1), pt(j + 1, k)];
      const mid = norm(qs.reduce((s, q) => [s[0] + q[0], s[1] + q[1], s[2] + q[2]], [0, 0, 0] as V3));
      // Smooth normals per vertex: write each corner with its own normal.
      const ids = qs.map((q) => this.vert([c[0] + q[0] * r, c[1] + q[1] * r * squash, c[2] + q[2] * r], q, 0, 0, mat, 0));
      const ps = qs.map((q) => [q[0], q[1], q[2]] as V3);
      const f = dot(cross(sub(ps[1], ps[0]), sub(ps[2], ps[0])), mid) >= 0;
      if (j > 0) this.i.push(ids[0], f ? ids[1] : ids[2], f ? ids[2] : ids[1]);
      if (j < rings - 1) this.i.push(ids[0], f ? ids[2] : ids[3], f ? ids[3] : ids[2]);
    }
    return this;
  }
  /**
   * A side profile in (z, y), counter-clockwise, extruded across x from x0 to x1.
   * edgeMat[k] is the material of the face from point k to k+1 (-1 skips it); capMat the two sides.
   * capUV maps a profile point to art coordinates; the cap gets flag 1 so the shader samples the side art.
   */
  extrude(pr: [number, number][], x0: number, x1: number, edgeMat: number[], capMat: number, capUV?: (z: number, y: number, side: number) => [number, number], edgeUV?: (k: number, t: number, x: number) => [number, number]) {
    const n = pr.length;
    for (let k = 0; k < n; k++) {
      const mat = edgeMat[k];
      if (mat < 0) continue;
      const [za, ya] = pr[k], [zb, yb] = pr[(k + 1) % n];
      const nn = norm([0, -(zb - za), yb - ya]);
      const uv = edgeUV ?? (() => [0, 0]);
      const corners: V3[] = [[x0, ya, za], [x1, ya, za], [x1, yb, zb], [x0, yb, zb]];
      const tOf = (p: V3) => (Math.abs(p[1] - ya) + Math.abs(p[2] - za) < 1e-6 ? 0 : 1);
      this.poly(corners, nn, mat, (p) => uv(k, tOf(p), (p[0] - x0) / (x1 - x0)));
    }
    if (capMat >= 0) {
      const tris = earclip(pr);
      for (const x of [x0, x1]) {
        const ps = pr.map(([z, y]) => [x, y, z] as V3);
        this.poly(ps, [x === x0 ? -1 : 1, 0, 0], capMat, (p) => (capUV ? capUV(p[2], p[1], x === x0 ? -1 : 1) : [0, 0]), capUV ? 1 : 0, tris);
      }
    }
    return this;
  }
}

/** Triangulates a simple counter-clockwise polygon. */
export function earclip(pts: [number, number][]): number[] {
  const idx = pts.map((_, k) => k), out: number[] = [];
  const area = (a: number[], b: number[], c: number[]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let guard = 0;
  while (idx.length > 3 && guard++ < 500) {
    for (let k = 0; k < idx.length; k++) {
      const ia = idx[(k + idx.length - 1) % idx.length], ib = idx[k], ic = idx[(k + 1) % idx.length];
      const [a, b, c] = [pts[ia], pts[ib], pts[ic]];
      if (area(a, b, c) <= 1e-9) continue;
      const inside = idx.some((j) => j !== ia && j !== ib && j !== ic && area(a, b, pts[j]) >= 0 && area(b, c, pts[j]) >= 0 && area(c, a, pts[j]) >= 0);
      if (inside) continue;
      out.push(ia, ib, ic);
      idx.splice(k, 1);
      break;
    }
  }
  out.push(...idx);
  return out;
}
export const translate = (x: number, y: number, z: number) => { const m = m4(); m[12] = x; m[13] = y; m[14] = z; return m; };
export const rotX = (a: number) => { const m = m4(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; };
export const rotZ = (a: number) => { const m = m4(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; };
export const rotY = (a: number) => { const m = m4(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; };
