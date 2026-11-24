// The hall: ten machines in a row on a polished floor, a slatted wall with clerestory windows and the neon.
// Each game gets the machine that suits how it plays: an upright, a cocktail table, or a pinball table.
import { Geo, norm, type V3, type M4, m4, translate } from "./core";
import { marquee, side, panel, top, type ArtGame, type Rect } from "./art";

export type Kind = "upright" | "table" | "pinball";
export type Part = { geo: Geo; screen: Geo; art: (c: CanvasRenderingContext2D, g: ArtGame) => void; screenAt: V3; screenN: V3; screenAspect: number; foot: [number, number, number, number]; lightAt: V3; lightKind: number; z: number };

export const ART_W = 1024, ART_H = 1344;
export const SPACING = 1.08;
export const WALL_Z = -1.05;
const uvr = ([x, y, w, h]: Rect, u: number, v: number): [number, number] => [(x + u * w) / ART_W, (y + v * h) / ART_H];

// Controls on a panel, in the panel's own frame: x across, y out of the panel, z towards the player.
function controls(g: Geo, slug: string) {
  const joy = (x: number) => {
    g.cyl([x, 0, 0], 0.034, 0.008, 18, 2);
    g.cyl([x, 0.008, 0], 0.007, 0.07, 10, 6);
    g.sphere([x, 0.088, 0], 0.022, 16, 7);
  };
  const btn = (x: number, z = 0, mat = 7) => {
    g.cyl([x, 0, z], 0.02, 0.008, 18, 2);
    g.cyl([x, 0.008, z], 0.015, 0.012, 18, mat);
  };
  switch (slug) {
    case "typester":
      for (let r = 0; r < 3; r++) for (let k = 0; k < 10 - r; k++) g.box([(k - (9 - r) / 2) * 0.031 + r * 0.008, 0.008, (r - 1) * 0.032], [0.026, 0.016, 0.027], r === 1 && (k === 3 || k === 6) ? 7 : 9);
      g.box([0, 0.008, 0.064], [0.16, 0.014, 0.024], 9);
      break;
    case "swish":
      g.cyl([-0.1, 0, 0], 0.052, 0.006, 24, 6);
      g.sphere([-0.1, 0.004, 0], 0.044, 22, 7, 0.75);
      btn(0.1, 0, 9);
      break;
    case "rally":
      g.cyl([-0.12, 0, 0], 0.036, 0.012, 24, 2);
      g.cyl([-0.12, 0.012, 0], 0.03, 0.03, 24, 6, 9);
      btn(0.08);
      btn(0.15, 0, 9);
      break;
    default:
      joy(-0.15);
      btn(0.02, 0.01);
      if (slug !== "coil") btn(0.09, -0.015, slug === "spillway" ? 9 : 7);
      if (slug === "spillway") btn(0.16, -0.02);
  }
}

function frame(o: V3, up: V3, fwd: V3): M4 {
  const m = m4();
  m[4] = up[0]; m[5] = up[1]; m[6] = up[2];
  m[8] = fwd[0]; m[9] = fwd[1]; m[10] = fwd[2];
  m[12] = o[0]; m[13] = o[1]; m[14] = o[2];
  return m;
}

function upright(slug: string): Part {
  const W = 0.66, x0 = -W / 2, x1 = W / 2;
  // Side profile (z forward, y up), counter-clockwise from the back of the base.
  const pr: [number, number][] = [[-0.42, 0], [0.3, 0], [0.3, 0.84], [0.44, 0.9], [0.44, 0.96], [0.16, 1.04], [0.14, 1.06], [0.04, 1.66], [0.18, 1.7], [0.2, 1.92], [-0.42, 1.92]];
  const R = { marquee: [0, 0, 1024, 352] as Rect, sideA: [0, 352, 300, 672] as Rect, sideB: [310, 352, 300, 672] as Rect, panel: [0, 1032, 704, 310] as Rect };
  const g = new Geo();
  g.extrude(pr, x0, x1, [2, 0, 2, 1, 3, 2, 2, 2, 5, 0, 0], 0,
    (z, y, s) => { const t = (z + 0.42) / 0.86; return uvr(s < 0 ? R.sideA : R.sideB, s < 0 ? t : 1 - t, 1 - y / 1.92); },
    (k, t, x) => (k === 8 ? uvr(R.marquee, x, 1 - t) : k === 4 ? uvr(R.panel, x, 1 - t) : [0, 0]));
  // T-moulding: a band round the profile, a little proud of each side.
  const grow = (pr: [number, number][], d: number) => pr.map((p, k) => {
    const a = pr[(k + pr.length - 1) % pr.length], b = pr[(k + 1) % pr.length];
    const n1 = norm([0, -(p[0] - a[0]), p[1] - a[1]]), n2 = norm([0, -(b[0] - p[0]), b[1] - p[1]]);
    const n = norm([0, n1[1] + n2[1], n1[2] + n2[2]]);
    return [p[0] + n[2] * d, p[1] + n[1] * d] as [number, number];
  });
  const band = grow(pr, 0.008);
  for (const x of [x0, x1]) g.extrude(band, x - 0.012, x + 0.012, band.map(() => 1), -1);
  // Coin door, kick plate.
  g.box([0, 0.5, 0.306], [0.3, 0.38, 0.012], 2);
  g.box([-0.07, 0.6, 0.314], [0.045, 0.07, 0.008], 8);
  g.box([0.07, 0.6, 0.314], [0.045, 0.07, 0.008], 8);
  g.box([0, 0.04, 0.304], [W, 0.08, 0.008], 6);
  // Controls on the panel.
  const [p4, p5] = [pr[4], pr[5]];
  const up = norm([0, -(p5[0] - p4[0]), p5[1] - p4[1]]), fwd = norm([0, p4[1] - p5[1], p4[0] - p5[0]]);
  g.push(frame([0, (p4[1] + p5[1]) / 2, (p4[0] + p5[0]) / 2], up, fwd));
  controls(g, slug);
  g.pop();
  // The screen sits in the face from point 6 to 7, a hair in front of the bezel.
  const [a, b] = [pr[6], pr[7]];
  const sn = norm([0, -(b[0] - a[0]), b[1] - a[1]]);
  const at = (t: number): [number, number] => [a[0] + (b[0] - a[0]) * t + sn[2] * 0.006, a[1] + (b[1] - a[1]) * t + sn[1] * 0.006];
  const screen = new Geo();
  const sx = W / 2 - 0.075, t0 = 0.05, t1 = 0.95;
  const c0 = at(t0), c1 = at(t1);
  screen.poly([[-sx, c0[1], c0[0]], [sx, c0[1], c0[0]], [sx, c1[1], c1[0]], [-sx, c1[1], c1[0]]], sn, 4, (p) => [(p[0] + sx) / (2 * sx), Math.abs(p[1] - c1[1]) < 1e-6 ? 0 : 1]);
  const len = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]);
  const mid = at(0.5);
  return {
    geo: g, screen, z: 0,
    art: (c, gm) => { marquee(c, gm, R.marquee); side(c, gm, R.sideA, true); side(c, gm, R.sideB, false); panel(c, gm, R.panel); },
    screenAt: [0, mid[1], mid[0]], screenN: sn, screenAspect: (2 * sx) / len,
    foot: [0, 0.01, W / 2, 0.37], lightAt: [0, mid[1], mid[0] + 0.45], lightKind: 2,
  };
}

function table(slug: string): Part {
  const W = 0.62, D = 0.84, H = 0.64, y0 = 0.06;
  const R = { top: [0, 0, 600, 810] as Rect, apron: [620, 0, 404, 416] as Rect, sideA: [0, 820, 520, 397] as Rect, sideB: [530, 820, 494, 377] as Rect };
  const g = new Geo();
  const yt = y0 + H;
  g.box([0, y0 + H / 2, 0], [W, H, D], [0, 0, 3, -1, 5, 2], (p, f) => {
    if (f === 0) return uvr(R.sideB, (D / 2 - p[2]) / D, (yt - p[1]) / H);
    if (f === 1) return uvr(R.sideA, (p[2] + D / 2) / D, (yt - p[1]) / H);
    if (f === 2) return uvr(R.top, (p[0] + W / 2) / W, (p[2] + D / 2) / D);
    if (f === 4) return uvr(R.apron, (p[0] + W / 2) / W, (yt - p[1]) / H);
    return [0, 0];
  }, 1);
  g.box([0, y0 / 2, 0], [W - 0.1, y0, D - 0.1], 2);
  for (const s of [-1, 1]) {
    g.box([s * (W / 2 + 0.004), yt + 0.006, 0], [0.012, 0.016, D + 0.02], 1);
    g.box([0, yt + 0.006, s * (D / 2 + 0.004)], [W + 0.02, 0.016, 0.012], 1);
    // A control panel at each end; the far one is the second player's.
    g.box([0, yt - 0.05, s * (D / 2 + 0.06)], [0.42, 0.07, 0.12], 2);
    g.push(translate(0, yt - 0.015, s * (D / 2 + 0.06)));
    g.cyl([-0.1, 0, 0], 0.03, 0.006, 16, 2); g.cyl([-0.1, 0.006, 0], 0.006, 0.055, 8, 6); g.sphere([-0.1, 0.07, 0], 0.019, 14, 7);
    g.cyl([0.06, 0, 0], 0.017, 0.012, 16, 7); g.cyl([0.12, 0, 0], 0.017, 0.012, 16, slug === "noughts" ? 9 : 7);
    g.pop();
  }
  const screen = new Geo();
  const sx = 0.2, sz = 0.27, ys = yt + 0.003;
  screen.poly([[-sx, ys, -sz], [sx, ys, -sz], [sx, ys, sz], [-sx, ys, sz]], [0, 1, 0], 4, (p) => [(p[0] + sx) / (2 * sx), (p[2] + sz) / (2 * sz)]);
  return {
    geo: g, screen, z: 0.02,
    art: (c, gm) => { top(c, gm, R.top); marquee(c, gm, R.apron); side(c, gm, R.sideA, true); side(c, gm, R.sideB, false); },
    screenAt: [0, ys, 0], screenN: [0, 1, 0], screenAspect: sx / sz,
    foot: [0, 0, W / 2, D / 2 + 0.1], lightAt: [0, ys + 0.35, 0.1], lightKind: 0,
  };
}

function pinball(): Part {
  const W = 0.56, x0 = -W / 2, x1 = W / 2, L = 0.62;
  const pr: [number, number][] = [[-L, 0.7], [L, 0.7], [L, 0.96], [-L, 1.1]];
  const R = { back: [0, 0, 634, 704] as Rect, sideA: [0, 712, 1000, 316] as Rect, sideB: [0, 1028, 1000, 316] as Rect };
  const g = new Geo();
  g.extrude(pr, x0, x1, [2, 0, 2, 0], 0, (z, y, s) => { const t = (z + L) / (2 * L); return uvr(s < 0 ? R.sideA : R.sideB, s < 0 ? t : 1 - t, (1.1 - y) / 0.4); });
  // Rails and the lockdown bar in chrome, legs, buttons, plunger, coin door.
  const tilt = Math.atan2(0.14, 2 * L);
  for (const s of [-1, 1]) g.box([s * (W / 2 - 0.012), 1.04, 0], [0.024, 0.03, 2 * L], 6);
  g.box([0, 0.975, L - 0.03], [W + 0.01, 0.03, 0.07], 6);
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.box([lx * (W / 2 - 0.04), 0.35, lz * (L - 0.06)], [0.05, 0.7, 0.05], 6);
    g.box([lx * (W / 2 - 0.04), 0.012, lz * (L - 0.06)], [0.08, 0.024, 0.08], 2);
  }
  for (const s of [-1, 1]) g.box([s * (W / 2 + 0.006), 0.9, L - 0.12], [0.012, 0.03, 0.03], 7);
  g.box([0.2, 0.86, L + 0.04], [0.012, 0.012, 0.08], 6);
  g.sphere([0.2, 0.86, L + 0.085], 0.016, 14, 9);
  g.box([0, 0.8, L + 0.005], [0.24, 0.14, 0.01], 2);
  g.box([-0.05, 0.83, L + 0.012], [0.035, 0.05, 0.006], 8);
  g.box([0.05, 0.83, L + 0.012], [0.035, 0.05, 0.006], 8);
  // Backbox: the backglass faces the player.
  const bh = 0.66, bz = -L + 0.09;
  g.box([0, 1.1 + bh / 2, bz], [W + 0.02, bh, 0.18], [0, 0, 0, 0, 5, 0], (p, f) => (f === 4 ? uvr(R.back, (p[0] + W / 2 + 0.01) / (W + 0.02), (1.1 + bh - p[1]) / bh) : [0, 0]));
  g.box([0, 1.1 + bh + 0.01, bz], [W + 0.04, 0.02, 0.2], 1);
  // The playfield, under glass, sloping up towards the back.
  const screen = new Geo();
  const sx = W / 2 - 0.035, f0 = L - 0.09, b0 = -L + 0.2;
  const yAt = (z: number) => 0.96 + ((L - z) / (2 * L)) * 0.14 + 0.004;
  const n = norm([0, Math.cos(tilt), Math.sin(tilt)]);
  screen.poly([[-sx, yAt(f0), f0], [sx, yAt(f0), f0], [sx, yAt(b0), b0], [-sx, yAt(b0), b0]], n, 4, (p) => [(p[0] + sx) / (2 * sx), (f0 - p[2]) < 1e-6 ? 1 : 0]);
  return {
    geo: g, screen, z: -0.14,
    art: (c, gm) => { marquee(c, gm, R.back); side(c, gm, R.sideA, true); side(c, gm, R.sideB, false); },
    screenAt: [0, yAt(0), (f0 + b0) / 2], screenN: n, screenAspect: 0.62,
    foot: [0, 0, W / 2, L], lightAt: [0, 1.4, 0.1], lightKind: 0,
  };
}

export const kindOf = (slug: string): Kind => (slug === "lightkeeper" ? "pinball" : ["minefield", "nonet", "noughts"].includes(slug) ? "table" : "upright");
export const build = (slug: string): Part => {
  const k = kindOf(slug);
  return k === "pinball" ? pinball() : k === "table" ? table(slug) : upright(slug);
};

/** Floor, walls, windows, ceiling, cans: the room the row stands in. */
export function room(n: number) {
  const x0 = -3.0, x1 = (n - 1) * SPACING + 2.2, Z = 7, H = 3.5;
  const floor = new Geo().poly([[x0 - 4, 0, WALL_Z], [x1 + 4, 0, WALL_Z], [x1 + 4, 0, Z], [x0 - 4, 0, Z]], [0, 1, 0], 10);
  const g = new Geo();
  g.poly([[x0 - 4, 0, WALL_Z], [x1 + 4, 0, WALL_Z], [x1 + 4, H, WALL_Z], [x0 - 4, H, WALL_Z]], [0, 0, 1], 11);
  g.poly([[x0, 0, WALL_Z], [x0, 0, Z], [x0, H, Z], [x0, H, WALL_Z]], [1, 0, 0], 11);
  g.poly([[x1, 0, WALL_Z], [x1, 0, Z], [x1, H, Z], [x1, H, WALL_Z]], [-1, 0, 0], 11);
  g.poly([[x0 - 4, H, WALL_Z], [x1 + 4, H, WALL_Z], [x1 + 4, H, Z], [x0 - 4, H, Z]], [0, -1, 0], 14);
  // A skirting board and a picture rail.
  g.box([(x0 + x1) / 2, 0.06, WALL_Z + 0.01], [x1 - x0 + 8, 0.12, 0.02], 14);
  g.box([(x0 + x1) / 2, 1.06, WALL_Z + 0.015], [x1 - x0 + 8, 0.03, 0.03], 2);
  // Clerestory windows, in three runs.
  const wy0 = 2.62, wy1 = 3.28, runs: [number, number][] = [];
  const span = (x1 - x0) / 3;
  for (let k = 0; k < 3; k++) runs.push([x0 + k * span + 0.35, x0 + (k + 1) * span - 0.35]);
  for (const [a, b] of runs) g.poly([[a, wy0, WALL_Z + 0.005], [b, wy0, WALL_Z + 0.005], [b, wy1, WALL_Z + 0.005], [a, wy1, WALL_Z + 0.005]], [0, 0, 1], 13, (p) => [(p[0] - a) / (b - a), (p[1] - wy0) / (wy1 - wy0)]);
  // Downlight cans over each machine.
  const cans = new Geo();
  for (let i = 0; i < n; i++) {
    const x = i * SPACING;
    cans.cyl([x, H - 0.07, 0.7], 0.11, 0.07, 20, 14, 14, false);
    cans.poly(Array.from({ length: 20 }, (_, k) => [x + Math.cos(-k / 20 * 6.283) * 0.085, H - 0.068, 0.7 + Math.sin(-k / 20 * 6.283) * 0.085] as V3), [0, -1, 0], 15);
  }
  // The neon, over the middle of the row.
  const sign = new Geo();
  const sx = ((n - 1) * SPACING) / 2, sw = 1.9, sh = sw / 4;
  // The sign texture is 1024 square: the neon in the top quarter, the drinks machine's front below it.
  sign.poly([[sx - sw / 2, 2.12, WALL_Z + 0.02], [sx + sw / 2, 2.12, WALL_Z + 0.02], [sx + sw / 2, 2.12 + sh, WALL_Z + 0.02], [sx - sw / 2, 2.12 + sh, WALL_Z + 0.02]], [0, 0, 1], 12, (p) => [(p[0] - sx + sw / 2) / sw, (1 - (p[1] - 2.12) / sh) * 0.25]);
  const vx = x0 + 0.75, vw = 0.92, vh = 1.86, vd = 0.78, vz = WALL_Z + vd / 2 + 0.06;
  sign.box([vx, vh / 2 + 0.04, vz], [vw, vh, vd], [9, 9, 9, -1, 5, 9], (p, f) => (f === 4 ? [(p[0] - vx + vw / 2) / vw * 0.5, 0.25 + (1 - (p[1] - 0.04) / vh) * 0.75] : [0, 0]));
  sign.box([vx, 0.02, vz], [vw - 0.06, 0.04, vd - 0.06], 2);
  return { floor, walls: g, cans, sign, runs, wy0, wy1, signAt: [sx, 2.12 + sh / 2, WALL_Z + 0.3] as V3, x0, x1, H };
}

/** Beams: a cone under each can at night, and by day a slab of sun from each window. */
export function beams(n: number, H: number, runs: [number, number][], wy0: number, wy1: number, sun: V3) {
  const cones = new Geo();
  for (let i = 0; i < n; i++) {
    const x = i * SPACING, seg = 28, top = H - 0.07, r0 = 0.08, r1 = 0.95, z = 0.7;
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * 6.283, a1 = ((k + 1) / seg) * 6.283;
      const p = (a: number, y: number, r: number): V3 => [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
      const nn = norm([Math.cos((a0 + a1) / 2), 0.3, Math.sin((a0 + a1) / 2)]);
      cones.poly([p(a0, top, r0), p(a1, top, r0), p(a1, 0, r1), p(a0, 0, r1)], nn, 0, (q) => [-1, 1 - q[1] / top]);
    }
  }
  const shafts = new Geo();
  for (const [a, b] of runs) {
    const t = (wy0 + wy1) / 2 / sun[1];
    const d: V3 = [-sun[0] * t, -sun[1] * t, -sun[2] * t];
    const A: V3[] = [[a, wy0, WALL_Z], [b, wy0, WALL_Z], [b, wy1, WALL_Z], [a, wy1, WALL_Z]];
    const B = A.map((p) => [p[0] + d[0], Math.max(0, p[1] + d[1]), p[2] + d[2]] as V3);
    // The two broad faces of each slab; u runs across the window so the edges fade.
    for (const [k, j] of [[0, 1], [3, 2]]) {
      const face = [A[k], A[j], B[j], B[k]];
      const e1 = [A[j][0] - A[k][0], A[j][1] - A[k][1], A[j][2] - A[k][2]] as V3;
      const nn = norm([e1[1] * d[2] - e1[2] * d[1], e1[2] * d[0] - e1[0] * d[2], e1[0] * d[1] - e1[1] * d[0]]);
      shafts.poly(face, nn, 0, (q) => [q === A[k] || q === B[k] ? 0 : 1, q === A[k] || q === A[j] ? 0 : 1]);
    }
  }
  return { cones, shafts };
}
