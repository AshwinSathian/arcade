// The renderer: a shadow map from the sun, the floor's reflection, an MSAA HDR pass, bloom, and a lens.
// Owns the camera on its rail and the pointer, and tells the page when the visitor moves to another machine.
import { type GL, type Mesh, type Prog, type Target, type V3, type M4, program, upload, target, texture, perspective, lookAt, mul, invert, xform, ortho, norm, mix, clamp, smooth, hex, translate, m4 } from "./core";
import { vsMain, fsMain, vsDepth, fsDepth, vsBeam, fsBeam, vsQuad, fsDown, fsUp, fsComposite, NL, NF } from "./shaders";
import { build, room, beams, SPACING, ART_W, ART_H, type Part } from "./scene";
import { neon, vending, type Best } from "./art";

export type HallGame = { slug: string; name: string; kind: string; ground: string; bright: string; poster: string; clip: string; best?: Best };
/** The part of the canvas the page leaves free, as fractions of its width and height from the top left. */
export type Frame = { l: number; t: number; r: number; b: number };
type Cab = {
  g: HallGame; part: Part; body: Mesh; screen: Mesh; model: M4; art: WebGLTexture; scr: WebGLTexture;
  crop: [number, number, number, number]; video?: HTMLVideoElement; fresh: boolean; glow: V3; glowTo: V3; lastSample: number;
  min: V3; max: V3; hover: number; power: number; ground: V3; bright: V3;
};

const SUN = norm([-0.45, 0.62, -0.64]);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export class Hall {
  gl: GL;
  private cabs: Cab[] = [];
  private P!: { main: Prog; depth: Prog; beam: Prog; down: Prog; up: Prog; comp: Prog };
  private floor!: Mesh; private walls!: Mesh; private cans!: Mesh; private sign!: Mesh; private cones!: Mesh; private shafts!: Mesh;
  private signTex!: WebGLTexture; private blank!: WebGLTexture;
  private shadow!: { fb: WebGLFramebuffer; tex: WebGLTexture; vp: M4; size: number };
  private hdr!: Target; private msaa?: { fb: WebGLFramebuffer; color: WebGLRenderbuffer; depth: WebGLRenderbuffer };
  private refl!: Target; private bloom: Target[] = [];
  private fmt: { internal: number; format: number; type: number };
  private float: boolean;
  private samples: number;
  private w = 0; private h = 0; private scale = 1;
  private signAt: V3 = [0, 0, 0];
  // Camera rail: pos is where the camera is (in machines), focus where it is going.
  focus = 0; private pos = 0; private vel = 0; private dragging = false;
  private night = 0; nightTo = 0;
  private zoom = 0; private zoomTo = 0; private zoomDone?: () => void;
  private ptr = [0, 0]; private ptrS = [0, 0];
  private vp: M4 = m4();
  still = false; frugal = false; reduced = false;
  onFocus: (i: number) => void = () => {};
  free: Frame = { l: 0, t: 0, r: 1, b: 1 };
  /** The machine played last on this device, which glows; -1 for none. */
  lastPlayed = -1;
  /** Attract mode: the camera moves on by itself, so it glides more slowly. */
  calm = false;
  private artCanvas!: HTMLCanvasElement;
  coarse = matchMedia("(pointer: coarse)").matches;
  private t0 = performance.now(); private last = 0; private slow = 0; private raf = 0; private visible = true;
  private probe: CanvasRenderingContext2D;
  private hoverIdx = -1;

  constructor(public canvas: HTMLCanvasElement, games: HallGame[], start: number) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: true, powerPreference: "high-performance", preserveDrawingBuffer: false });
    if (!gl) throw new Error("no webgl2");
    this.gl = gl;
    this.float = !!gl.getExtension("EXT_color_buffer_float");
    gl.getExtension("OES_texture_float_linear");
    this.fmt = this.float ? { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT } : { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };
    this.samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) as number);
    this.probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    this.probe.canvas.width = this.probe.canvas.height = 4;
    this.focus = this.pos = start;
    this.init(games);
  }

  private init(games: HallGame[]) {
    const gl = this.gl;
    this.P = {
      main: program(gl, vsMain, fsMain), depth: program(gl, vsDepth, fsDepth), beam: program(gl, vsBeam, fsBeam),
      down: program(gl, vsQuad, fsDown), up: program(gl, vsQuad, fsUp), comp: program(gl, vsQuad, fsComposite),
    };
    this.blank = texture(gl, null, false);
    const art = (this.artCanvas = document.createElement("canvas"));
    art.width = ART_W; art.height = ART_H;
    const c = art.getContext("2d")!;
    games.forEach((g, i) => {
      const part = build(g.slug);
      c.clearRect(0, 0, ART_W, ART_H);
      part.art(c, g);
      const model = translate(i * SPACING, 0, part.z);
      const body = upload(gl, part.geo), screen = upload(gl, part.screen);
      // Cover-fit the 4:5 clip to the screen's own shape.
      const src = 0.8, dst = part.screenAspect;
      const crop: [number, number, number, number] = g.slug === "lightkeeper" ? [0, 0, 1, 1] : dst > src ? [0, (1 - src / dst) / 2, 1, src / dst] : [(1 - dst / src) / 2, 0, dst / src, 1];
      const off: V3 = [i * SPACING, 0, part.z];
      const min = body.min.map((v, k) => v + off[k]) as V3, max = body.max.map((v, k) => v + off[k]) as V3;
      this.cabs.push({ g, part, body, screen, model, art: texture(gl, art), scr: texture(gl, null, false), crop, fresh: false, glow: hex(g.bright).map((v) => v * 0.3) as V3, glowTo: hex(g.bright).map((v) => v * 0.3) as V3, lastSample: 0, min, max, hover: 0, power: 0, ground: hex(g.ground), bright: hex(g.bright) });
      const img = new Image();
      img.decoding = "async";
      img.onload = () => { const cab = this.cabs[i]; if (cab.fresh) return; this.upload(cab, img); this.sample(cab, img); };
      img.src = g.poster;
    });
    const r = room(games.length);
    this.signAt = r.signAt;
    this.floor = upload(gl, r.floor); this.walls = upload(gl, r.walls); this.cans = upload(gl, r.cans); this.sign = upload(gl, r.sign);
    const b = beams(games.length, r.H, r.runs, r.wy0, r.wy1, SUN);
    this.cones = upload(gl, b.cones); this.shafts = upload(gl, b.shafts);
    const sc = document.createElement("canvas");
    sc.width = 1024; sc.height = 1024;
    const scx = sc.getContext("2d")!;
    neon(scx, 1024, 256);
    vending(scx, [0, 256, 512, 768], games.map((g) => g.bright));
    this.signTex = texture(gl, sc);
    this.makeShadow(r.x0, r.x1);
    this.bindInput();
  }

  /** Repaint one machine's art, for a best that arrived after the page opened. */
  setBest(i: number, best: Best | undefined) {
    const cab = this.cabs[i], gl = this.gl;
    if (JSON.stringify(cab.g.best) === JSON.stringify(best)) return;
    cab.g = { ...cab.g, best };
    const c = this.artCanvas.getContext("2d")!;
    c.clearRect(0, 0, ART_W, ART_H);
    cab.part.art(c, cab.g);
    gl.bindTexture(gl.TEXTURE_2D, cab.art);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, this.artCanvas);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  private upload(cab: Cab, src: TexImageSource) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, cab.scr);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  }
  // The screen's average colour, which is the light it throws on the floor and its neighbours.
  private sample(cab: Cab, src: CanvasImageSource) {
    try {
      this.probe.drawImage(src, 0, 0, 4, 4);
      const d = this.probe.getImageData(0, 0, 4, 4).data;
      const s: V3 = [0, 0, 0];
      for (let k = 0; k < 64; k += 4) for (let j = 0; j < 3; j++) s[j] += (d[k + j] / 255) ** 2.2 / 16;
      cab.glowTo = s;
    } catch { /* a frame that is not ready yet */ }
  }

  private makeShadow(x0: number, x1: number) {
    const gl = this.gl, size = 2048;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    // Fit the light's box round the row, then draw the machines once: nothing in the hall moves.
    const c: V3 = [(x0 + x1) / 2, 1, 0.8];
    const view = lookAt([c[0] + SUN[0] * 10, c[1] + SUN[1] * 10, c[2] + SUN[2] * 10], c);
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const x of [x0, x1]) for (const y of [0, 2.4]) for (const z of [-1.1, 3.2]) {
      const p = xform(view, [x, y, z]);
      lo = lo.map((v, k) => Math.min(v, p[k])); hi = hi.map((v, k) => Math.max(v, p[k]));
    }
    const vp = mul(ortho(lo[0], hi[0], lo[1], hi[1], -hi[2] - 1, -lo[2] + 1), view);
    gl.viewport(0, 0, size, size);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
    const P = this.P.depth;
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.u.uVP, false, vp);
    for (const cab of this.cabs) {
      gl.uniformMatrix4fv(P.u.uModel, false, cab.model);
      gl.bindVertexArray(cab.body.vao);
      gl.drawElements(gl.TRIANGLES, cab.body.count, gl.UNSIGNED_INT, 0);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.shadow = { fb, tex, vp, size };
  }

  resize() {
    const gl = this.gl;
    const dpr = Math.min(devicePixelRatio || 1, 2) * this.scale;
    let w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr);
    // Keep the pixel count in reach of a laptop, and lower on a phone or tablet, where the GPU shares a battery.
    const cap = (this.coarse ? 1.9e6 : 3.2e6) / (w * h);
    if (cap < 1) { w = Math.round(w * Math.sqrt(cap)); h = Math.round(h * Math.sqrt(cap)); }
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.canvas.width = w; this.canvas.height = h;
    const dispose = (t?: Target) => { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } };
    dispose(this.hdr); dispose(this.refl); this.bloom.forEach(dispose);
    this.hdr = target(gl, w, h, this.fmt, !this.float || this.samples < 2);
    if (this.float && this.samples >= 2) {
      if (this.msaa) { gl.deleteRenderbuffer(this.msaa.color); gl.deleteRenderbuffer(this.msaa.depth); gl.deleteFramebuffer(this.msaa.fb); }
      const fb = gl.createFramebuffer()!, color = gl.createRenderbuffer()!, depth = gl.createRenderbuffer()!;
      gl.bindRenderbuffer(gl.RENDERBUFFER, color);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, gl.RGBA16F, w, h);
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, gl.DEPTH_COMPONENT24, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, color);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.msaa = { fb, color, depth };
    }
    this.refl = target(gl, w >> 1, h >> 1, this.fmt, true, true);
    this.bloom = [];
    let bw = w >> 1, bh = h >> 1;
    for (let k = 0; k < 6 && bw > 8 && bh > 8; k++, bw >>= 1, bh >>= 1) this.bloom.push(target(gl, bw, bh, this.fmt));
  }

  // ---------- camera ----------
  private view(f: number, t: number) {
    // The camera frames the machine in the free part of the canvas, not the whole of it:
    // beside the card on a wide screen, above it on a tall one.
    const a = this.w / this.h, fr = this.free, fw = fr.r - fr.l, fh = fr.b - fr.t;
    const k = smooth(1.5, 0.55, (a * fw) / fh); // 0 when the free part is wide, 1 when it is tall
    const x = f * SPACING;
    const drift = this.still || this.reduced ? 0 : 1;
    const eye: V3 = [x + mix(-1.5, -0.5, k) + this.ptrS[0] * 0.18 + Math.sin(t * 0.21) * 0.035 * drift, mix(1.62, 1.7, k) - this.ptrS[1] * 0.07 + Math.sin(t * 0.17) * 0.012 * drift, mix(4.5, 4.7, k)];
    const at: V3 = [x - mix(0.12, 0, k), mix(1.18, 1.1, k), 0];
    const dist = Math.hypot(eye[0] - at[0], eye[1] - at[1], eye[2] - at[2]);
    // About 2.5 m of hall top to bottom in the free part, and at least 2 m across it.
    const half = Math.max(1.25 / (dist * fh), 1.0 / (dist * fw * a));
    let fov = clamp(2 * Math.atan(half), 0.5, 1.4);
    if (this.zoom > 0) {
      const cab = this.cabs[this.focus], z = ease(this.zoom), s = cab.part.screenAt, n = cab.part.screenN;
      const sc: V3 = [s[0] + this.focus * SPACING, s[1], s[2] + cab.part.z];
      const d = 0.32 / Math.tan(fov / 2) * 0.75;
      const target: V3 = [sc[0] + n[0] * d, sc[1] + n[1] * d, sc[2] + n[2] * d];
      for (let j = 0; j < 3; j++) { eye[j] = mix(eye[j], target[j], z); at[j] = mix(at[j], sc[j], z); }
      fov = mix(fov, 40 * Math.PI / 180, z);
    }
    const off = 1 - ease(this.zoom);
    return { eye, at, fov, shift: (fr.t + fr.b - 1) * off, shiftX: (1 - fr.l - fr.r) * off };
  }

  // ---------- input ----------
  private bindInput() {
    const cv = this.canvas;
    let downX = 0, downPos = 0, moved = 0, lastX = 0, lastT = 0, v = 0, id = -1;
    cv.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || this.zoom > 0) return;
      id = e.pointerId; downX = lastX = e.clientX; downPos = this.pos; moved = 0; v = 0; lastT = e.timeStamp;
      this.dragging = true; cv.setPointerCapture(id);
    });
    cv.addEventListener("pointermove", (e) => {
      const r = cv.getBoundingClientRect();
      this.ptr = [((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1];
      if (e.pointerType === "mouse") {
        this.hoverIdx = this.dragging ? -1 : this.pick(e.clientX, e.clientY);
        cv.style.cursor = this.dragging ? "grabbing" : this.hoverIdx >= 0 ? "pointer" : "grab";
      }
      if (!this.dragging || e.pointerId !== id) return;
      const dx = e.clientX - downX;
      moved = Math.max(moved, Math.abs(dx));
      const per = Math.max(120, r.width * 0.28); // pixels per machine
      this.pos = clamp(downPos - dx / per, -0.3, this.cabs.length - 0.7);
      const dt = Math.max(1, e.timeStamp - lastT);
      v = mix(v, -(e.clientX - lastX) / per / (dt / 1000), 0.4);
      lastX = e.clientX; lastT = e.timeStamp;
    });
    const up = (e: PointerEvent) => {
      if (!this.dragging || e.pointerId !== id) return;
      this.dragging = false;
      if (moved < 6) {
        const hit = this.pick(e.clientX, e.clientY);
        if (hit >= 0) { if (hit === this.focus) cv.dispatchEvent(new CustomEvent("arcade:play")); else this.go(hit, true); }
        return;
      }
      // A flick carries on a little before it settles on a machine.
      this.go(Math.round(clamp(this.pos + clamp(v, -6, 6) * 0.18, 0, this.cabs.length - 1)), true);
      this.vel = 0;
    };
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    cv.addEventListener("pointerleave", () => { this.ptr = [0, 0]; this.hoverIdx = -1; });
    let wheelAt = 0;
    cv.addEventListener("wheel", (e) => {
      // Sideways scrolling walks the row; up and down still scrolls the page.
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 4) return;
      e.preventDefault();
      if (e.timeStamp - wheelAt < 260) return;
      wheelAt = e.timeStamp;
      this.go(this.focus + Math.sign(e.deltaX), true);
    }, { passive: false });
  }

  /** The machine under a point on the canvas, or -1. */
  pick(cx: number, cy: number) {
    const r = this.canvas.getBoundingClientRect();
    const nx = ((cx - r.left) / r.width) * 2 - 1, ny = -(((cy - r.top) / r.height) * 2 - 1);
    const inv = invert(this.vp);
    const a = xform(inv, [nx, ny, -1]), b = xform(inv, [nx, ny, 1]);
    const d = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    let best = -1, bt = Infinity;
    this.cabs.forEach((c, i) => {
      let t0 = 0, t1 = Infinity;
      for (let k = 0; k < 3; k++) {
        const inv = 1 / (d[k] || 1e-9);
        let ta = (c.min[k] - a[k]) * inv, tb = (c.max[k] - a[k]) * inv;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      }
      if (t0 <= t1 && t0 < bt) { bt = t0; best = i; }
    });
    return best;
  }

  go(i: number, fromHall = false) {
    i = clamp(Math.round(i), 0, this.cabs.length - 1);
    if (i === this.focus && !fromHall) return;
    const changed = i !== this.focus;
    this.focus = i;
    if (this.reduced) this.pos = i;
    if (changed && fromHall) this.onFocus(i);
  }
  setNight(on: boolean, instant = false) { this.nightTo = on ? 1 : 0; if (instant || this.reduced) this.night = this.nightTo; }
  /** Fly into the machine's screen; resolves when the screen fills the view. */
  enter(): Promise<void> {
    if (this.reduced) return Promise.resolve();
    this.zoomTo = 1;
    return new Promise((r) => (this.zoomDone = r));
  }
  /** Back out, for a page restored from the back-forward cache. */
  leave() { this.zoom = this.zoomTo = 0; }

  start() {
    const loop = (now: number) => { this.raf = requestAnimationFrame(loop); this.frame(now); };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(loop);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.syncVideos(); }).observe(this.canvas);
    document.addEventListener("visibilitychange", () => this.syncVideos());
  }

  // Clips play on the machine in focus and its neighbours; the rest hold their last frame.
  syncVideos() {
    const wide = this.w / Math.max(1, this.h) > 1.2;
    const reach = wide ? 2 : 1;
    this.cabs.forEach((cab, i) => {
      const want = !this.frugal && !this.still && this.visible && !document.hidden && Math.abs(i - this.focus) <= reach;
      if (want && !cab.video) {
        const v = document.createElement("video");
        v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
        v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
        v.src = cab.g.clip;
        const tick = () => { cab.fresh = true; v.requestVideoFrameCallback?.(tick); };
        if ("requestVideoFrameCallback" in v) v.requestVideoFrameCallback(tick);
        cab.video = v;
      }
      if (!cab.video) return;
      if (want) cab.video.play().catch(() => {});
      else cab.video.pause();
    });
  }

  private frame(now: number) {
    const gl = this.gl, t = (now - this.t0) / 1000;
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now;
    if (!this.visible || document.hidden) return;
    // Step down the resolution if frames run long for a couple of seconds.
    if (dt > 0.026) this.slow += dt; else this.slow = Math.max(0, this.slow - dt * 0.5);
    if (this.slow > 2 && this.scale > 0.55) { this.scale *= 0.8; this.slow = 0; this.w = 0; }
    this.resize();

    // Springs: camera rail, night, zoom, pointer.
    if (!this.dragging) {
      const k = this.calm ? 9 : 38, d = 2 * Math.sqrt(k) * 1.05;
      this.vel += (k * (this.focus - this.pos) - d * this.vel) * dt;
      this.pos += this.vel * dt;
    }
    this.night += clamp(this.nightTo - this.night, -dt / 1.8, dt / 1.8);
    if (this.zoomTo > this.zoom) {
      this.zoom = Math.min(1, this.zoom + dt / 0.75);
      if (this.zoom >= 1 && this.zoomDone) { this.zoomDone(); this.zoomDone = undefined; }
    }
    const pk = 1 - Math.exp(-dt * 4);
    this.ptrS = this.ptrS.map((v, j) => v + ((this.reduced ? 0 : this.ptr[j]) - v) * pk);

    // Screens: upload new frames, sample their colour now and then.
    for (const [i, cab] of this.cabs.entries()) {
      const v = cab.video;
      if (v && v.readyState >= 2 && (cab.fresh || !("requestVideoFrameCallback" in v))) {
        this.upload(cab, v); cab.fresh = false;
        if (now - cab.lastSample > 180) { this.sample(cab, v); cab.lastSample = now; }
      }
      for (let j = 0; j < 3; j++) cab.glow[j] += (cab.glowTo[j] - cab.glow[j]) * (1 - Math.exp(-dt * 6));
      cab.hover += ((i === this.hoverIdx ? 1 : 0) - cab.hover) * (1 - Math.exp(-dt * 10));
      // Each screen warms up in turn when the hall first opens.
      const on = clamp((t - 0.25 - i * 0.07) / 0.35);
      cab.power = this.reduced ? 1 : on < 1 ? on * (0.75 + 0.25 * Math.sin(on * 40)) : 1;
    }

    const { eye, at, fov, shift, shiftX } = this.view(this.pos, t);
    const proj = perspective(fov, this.w / this.h, 0.05, 60, shift, shiftX);
    this.vp = mul(proj, lookAt(eye, at));
    const n = this.night;

    // Lights: a screen light per machine, a downlight per machine at night, the neon.
    const LP = new Float32Array(NL * 4), LC = new Float32Array(NL * 4);
    let nl = 0;
    const add = (p: V3, kind: number, c: V3, r: number) => { if (nl >= NL) return; LP.set([...p, kind], nl * 4); LC.set([...c, r], nl * 4); nl++; };
    const flick = (x: number, seed: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * (Math.sin(t * 61 + seed * 13) > -0.2 ? 1 : 0.25));
    this.cabs.forEach((cab, i) => {
      const p = cab.part.lightAt, gain = cab.power * mix(2.2, 3.2, n);
      add([p[0] + i * SPACING, p[1], p[2] + cab.part.z], cab.part.lightKind, cab.glow.map((v) => v * gain) as V3, 2.6);
    });
    const order = (i: number) => clamp(n * 1.7 - i * 0.07);
    this.cabs.forEach((_, i) => { const on = flick(order(i), i); if (on > 0) add([i * SPACING, 3.36, 0.7], 1, [36 * on, 29 * on, 21 * on], 5.2); });
    const neonOn = flick(clamp(n * 2 - 0.6), 99);
    if (neonOn > 0) add([this.signAt[0], this.signAt[1], this.signAt[2]], 0, [1.6 * neonOn, 0.25 * neonOn, 0.7 * neonOn], 4.5);

    const sun: V3 = [mix(3.4, 0.0, n), mix(3.1, 0.0, n), mix(2.7, 0.0, n)];
    const sky: V3 = [mix(0.4, 0.008, n), mix(0.44, 0.009, n), mix(0.5, 0.02, n)];
    const gnd: V3 = [mix(0.2, 0.006, n), mix(0.18, 0.005, n), mix(0.16, 0.008, n)];
    const foot = new Float32Array(NF * 4);
    this.cabs.slice(0, NF).forEach((c, i) => foot.set([c.part.foot[0] + i * SPACING, c.part.foot[1] + c.part.z, c.part.foot[2], c.part.foot[3]], i * 4));

    const M = this.P.main;
    gl.useProgram(M.p);
    gl.uniform1f(M.u.uTime, t); gl.uniform1f(M.u.uNight, n);
    gl.uniform3fv(M.u.uSunDir, SUN); gl.uniform3fv(M.u.uSunCol, sun); gl.uniform3fv(M.u.uSky, sky); gl.uniform3fv(M.u.uGnd, gnd);
    gl.uniformMatrix4fv(M.u.uShadowVP, false, this.shadow.vp); gl.uniform1f(M.u.uShadowTexel, 1 / this.shadow.size);
    gl.uniform4fv(M.u.uLP, LP); gl.uniform4fv(M.u.uLC, LC); gl.uniform1i(M.u.uNL, nl);
    gl.uniform4fv(M.u.uFoot, foot);
    gl.uniform1f(M.u.uNeon, neonOn);
    gl.uniform1i(M.u.uArt, 0); gl.uniform1i(M.u.uScreen, 1); gl.uniform1i(M.u.uShadow, 2); gl.uniform1i(M.u.uRefl, 3);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.shadow.tex);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND);

    // 1. The floor's reflection: the hall drawn upside down from a camera under the floor, at half size.
    const mirror = m4(); mirror[5] = -1;
    const eyeR: V3 = [eye[0], -eye[1], eye[2]];
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.refl.fb);
    gl.viewport(0, 0, this.refl.w, this.refl.h);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.blank);
    gl.cullFace(gl.FRONT);
    this.scene(mul(this.vp, mirror), eyeR, false, n, order);
    gl.cullFace(gl.BACK);
    gl.bindTexture(gl.TEXTURE_2D, this.refl.tex);
    gl.generateMipmap(gl.TEXTURE_2D);

    // 2. The hall, into the multisampled HDR buffer.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaa ? this.msaa.fb : this.hdr.fb);
    gl.viewport(0, 0, this.w, this.h);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(M.p);
    gl.uniform2f(M.u.uRes, this.w, this.h);
    this.scene(this.vp, eye, true, n, order);
    // Light in the air: cones at night, sun shafts by day.
    const B = this.P.beam;
    gl.useProgram(B.p);
    gl.uniformMatrix4fv(B.u.uVP, false, this.vp); gl.uniformMatrix4fv(B.u.uModel, false, m4());
    gl.uniform3fv(B.u.uCam, eye); gl.uniform1f(B.u.uTime, t);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    const cone = 0.045 * clamp(n * 1.7 - 0.3);
    if (cone > 0.001) { gl.uniform3f(B.u.uColor, cone * 1.0, cone * 0.82, cone * 0.62); gl.bindVertexArray(this.cones.vao); gl.drawElements(gl.TRIANGLES, this.cones.count, gl.UNSIGNED_INT, 0); }
    const shaft = 0.07 * (1 - n);
    if (shaft > 0.001) { gl.uniform3f(B.u.uColor, shaft, shaft * 0.93, shaft * 0.8); gl.bindVertexArray(this.shafts.vao); gl.drawElements(gl.TRIANGLES, this.shafts.count, gl.UNSIGNED_INT, 0); }
    gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    if (this.msaa) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msaa.fb);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.hdr.fb);
      gl.blitFramebuffer(0, 0, this.w, this.h, 0, 0, this.w, this.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    }

    // 3. Bloom, then the lens and the tone curve.
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(null);
    const D = this.P.down, U = this.P.up;
    gl.useProgram(D.p);
    gl.activeTexture(gl.TEXTURE0);
    let src = this.hdr;
    this.bloom.forEach((dst, k) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, dst.w, dst.h);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(D.u.uTex, 0); gl.uniform2f(D.u.uTexel, 1 / src.w, 1 / src.h); gl.uniform1f(D.u.uThreshold, k === 0 ? mix(1.5, 0.85, n) : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = dst;
    });
    gl.useProgram(U.p);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let k = this.bloom.length - 1; k > 0; k--) {
      const from = this.bloom[k], to = this.bloom[k - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, to.fb); gl.viewport(0, 0, to.w, to.h);
      gl.bindTexture(gl.TEXTURE_2D, from.tex);
      gl.uniform1i(U.u.uTex, 0); gl.uniform2f(U.u.uTexel, 1 / from.w, 1 / from.h); gl.uniform1f(U.u.uWeight, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);
    const C = this.P.comp;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(C.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.hdr.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.bloom[0].tex);
    gl.uniform1i(C.u.uHdr, 0); gl.uniform1i(C.u.uBloom, 1);
    gl.uniform1f(C.u.uBloomK, mix(0.05, 0.16, n)); gl.uniform1f(C.u.uExposure, mix(0.92, 1.3, n));
    gl.uniform1f(C.u.uTime, t); gl.uniform2f(C.u.uRes, this.w, this.h);
    const fade = smooth(0.55, 1, this.zoom);
    const fc = this.cabs[this.focus].ground;
    gl.uniform3fv(C.u.uFadeCol, fc); gl.uniform1f(C.u.uFade, fade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private scene(vp: M4, eye: V3, withFloor: boolean, n: number, order: (i: number) => number) {
    const gl = this.gl, M = this.P.main, u = M.u;
    gl.uniformMatrix4fv(u.uVP, false, vp);
    gl.uniform3fv(u.uCam, eye);
    const draw = (m: Mesh) => { gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0); };
    const id = m4();
    gl.uniformMatrix4fv(u.uModel, false, id);
    gl.uniform1f(u.uHover, 0); gl.uniform1f(u.uPower, 0);
    if (withFloor) {
      gl.uniform1f(u.uReflOn, 1);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.refl.tex);
      draw(this.floor);
      gl.uniform1f(u.uReflOn, 0);
    }
    gl.uniform1f(u.uReflOn, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.signTex);
    draw(this.walls);
    gl.uniform1f(u.uGlow, 0.7);
    draw(this.sign);
    gl.uniform1f(u.uGlow, clamp(n * 1.7));
    draw(this.cans);
    this.cabs.forEach((cab, i) => {
      gl.uniformMatrix4fv(u.uModel, false, cab.model);
      gl.uniform3fv(u.uGround, cab.ground); gl.uniform3fv(u.uBright, cab.bright);
      const focusGlow = (i === this.focus ? 0.25 : 0) + (i === this.lastPlayed ? 0.35 + 0.25 * Math.sin(performance.now() / 420) : 0);
      gl.uniform1f(u.uGlow, mix(0.18, 1, n) * (0.4 + 0.6 * order(i)) + focusGlow);
      gl.uniform1f(u.uHover, cab.hover);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cab.art);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, cab.scr);
      gl.uniform1f(u.uPower, 0);
      draw(cab.body);
      gl.uniform4fv(u.uCrop, cab.crop); gl.uniform1f(u.uPower, cab.power);
      draw(cab.screen);
    });
  }

  /** Where the machine in focus sits on screen, in CSS pixels, for anything the page wants to pin to it. */
  screenPoint(): [number, number] {
    const c = this.cabs[this.focus], s = c.part.screenAt;
    const p = xform(this.vp, [s[0] + this.focus * SPACING, s[1], s[2] + c.part.z]);
    const r = this.canvas.getBoundingClientRect();
    return [(p[0] * 0.5 + 0.5) * r.width, (1 - (p[1] * 0.5 + 0.5)) * r.height];
  }
}
