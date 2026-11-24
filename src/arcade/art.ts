// Cabinet artwork, painted on a canvas when the page opens: marquee, side art, control panel and a motif per game.
// Every function draws into the rectangle it is given, so one painter serves an upright, a table and a pinball.
export type Rect = [number, number, number, number];
import type { Best } from "./bests";
export type ArtGame = { slug: string; name: string; kind: string; ground: string; bright: string; best?: Best };
type C = CanvasRenderingContext2D;

const FONT = "Bricolage, system-ui, sans-serif";
const shade = (hex: string, k: number) => {
  const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const t = k < 0 ? 0 : 255, a = Math.abs(k);
  return `rgb(${n.map((v) => Math.round(v + (t - v) * a)).join(",")})`;
};
function fit(c: C, text: string, weight: number, maxW: number, maxH: number) {
  let size = maxH;
  c.font = `${weight} ${size}px ${FONT}`;
  const w = c.measureText(text).width;
  if (w > maxW) size *= maxW / w;
  c.font = `${weight} ${size}px ${FONT}`;
  return size;
}

/** The picture each game is known by, drawn in its own two colours inside a square of side s centred on (x, y). */
export function motif(c: C, slug: string, x: number, y: number, s: number, fg: string, bg: string) {
  c.save();
  c.translate(x, y);
  c.fillStyle = fg; c.strokeStyle = fg; c.lineCap = "round"; c.lineJoin = "round";
  const u = s / 10;
  switch (slug) {
    case "clover": { // a four-leaf clover over a hedge maze
      c.globalAlpha = 0.35; c.lineWidth = u * 0.5;
      for (let k = -2; k <= 2; k++) { c.strokeRect(-k * u - u * 2.5, -k * u - u * 2.5, (k * 2 + 5) * u, (k * 2 + 5) * u); }
      c.globalAlpha = 1;
      for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(Math.cos(k * Math.PI / 2 + Math.PI / 4) * u * 1.25, Math.sin(k * Math.PI / 2 + Math.PI / 4) * u * 1.25, u * 1.35, 0, Math.PI * 2); c.fill(); }
      c.lineWidth = u * 0.45; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(u * 1.5, u * 3, u * 0.5, u * 4.4); c.stroke();
      break;
    }
    case "coil": { // a block snake coiled into a square spiral
      const path = [[0, 0], [1, 0], [1, 1], [-1, 1], [-1, -1], [2, -1], [2, 2], [-2, 2], [-2, -2], [3, -2], [3, 3]];
      c.lineWidth = u * 0.9; c.lineCap = "square"; c.lineJoin = "miter";
      c.beginPath(); path.forEach(([px, py], k) => (k ? c.lineTo(px * u * 1.2, py * u * 1.2) : c.moveTo(px * u * 1.2, py * u * 1.2))); c.stroke();
      c.fillStyle = bg; c.fillRect(-u * 0.25, -u * 0.25, u * 0.5, u * 0.5);
      break;
    }
    case "lightkeeper": { // a lighthouse throwing its beam
      c.globalAlpha = 0.5;
      c.beginPath(); c.moveTo(0, -u * 3); c.lineTo(u * 5, -u * 4.6); c.lineTo(u * 5, -u * 1.6); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(0, -u * 3); c.lineTo(-u * 5, -u * 4.4); c.lineTo(-u * 5, -u * 2.2); c.closePath(); c.fill();
      c.globalAlpha = 1;
      c.beginPath(); c.moveTo(-u * 1.1, u * 4); c.lineTo(-u * 0.6, -u * 2.3); c.lineTo(u * 0.6, -u * 2.3); c.lineTo(u * 1.1, u * 4); c.closePath(); c.fill();
      c.fillStyle = bg; c.fillRect(-u * 0.85, u * 0.2, u * 1.7, u * 0.6); c.fillRect(-u * 0.72, -u * 1.4, u * 1.44, u * 0.5);
      c.fillStyle = fg; c.beginPath(); c.arc(0, -u * 3, u * 0.75, 0, Math.PI * 2); c.fill();
      c.fillRect(-u * 0.9, -u * 3.9, u * 1.8, u * 0.35);
      break;
    }
    case "minefield": { // a mine, a flag and the numbers around them
      c.beginPath(); c.arc(-u * 1, u * 0.5, u * 2, 0, Math.PI * 2); c.fill();
      c.lineWidth = u * 0.5;
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; c.beginPath(); c.moveTo(-u + Math.cos(a) * u * 2.9, u * 0.5 + Math.sin(a) * u * 2.9); c.lineTo(-u - Math.cos(a) * u * 2.9, u * 0.5 - Math.sin(a) * u * 2.9); c.stroke(); }
      c.fillStyle = bg; c.beginPath(); c.arc(-u * 1.7, -u * 0.2, u * 0.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = fg; c.lineWidth = u * 0.35; c.beginPath(); c.moveTo(u * 2.6, u * 3.8); c.lineTo(u * 2.6, -u * 3.6); c.stroke();
      c.beginPath(); c.moveTo(u * 2.6, -u * 3.6); c.lineTo(u * 4.6, -u * 2.6); c.lineTo(u * 2.6, -u * 1.6); c.closePath(); c.fill();
      c.font = `800 ${u * 2}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("3", u * 3.6, u * 1.8);
      break;
    }
    case "nonet": { // a box of a sudoku, half filled
      c.lineWidth = u * 0.3; c.strokeRect(-u * 4, -u * 4, u * 8, u * 8);
      c.lineWidth = u * 0.12;
      for (let k = 1; k < 3; k++) { c.beginPath(); c.moveTo(-u * 4 + k * u * 8 / 3, -u * 4); c.lineTo(-u * 4 + k * u * 8 / 3, u * 4); c.moveTo(-u * 4, -u * 4 + k * u * 8 / 3); c.lineTo(u * 4, -u * 4 + k * u * 8 / 3); c.stroke(); }
      c.font = `700 ${u * 1.8}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle";
      [[0, 0, "5"], [2, 0, "3"], [1, 1, "9"], [0, 2, "7"], [2, 2, "1"]].forEach(([i, j, d]) => c.fillText(String(d), -u * 4 + (+i + 0.5) * u * 8 / 3, -u * 4 + (+j + 0.55) * u * 8 / 3));
      break;
    }
    case "noughts": { // a cross and a nought, the cross fading
      c.lineWidth = u * 1.1;
      c.beginPath(); c.arc(u * 1.8, u * 1.6, u * 2.1, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 0.45;
      c.beginPath(); c.moveTo(-u * 4, -u * 4); c.lineTo(-u * 0.6, -u * 0.6); c.moveTo(-u * 0.6, -u * 4); c.lineTo(-u * 4, -u * 0.6); c.stroke();
      break;
    }
    case "pinfall": { // a pin with two stripes, and the dotted hook of the ball coming in
      c.setLineDash([u * 0.2, u * 0.55]); c.lineWidth = u * 0.35;
      c.beginPath(); c.moveTo(-u * 4.4, u * 4.6); c.quadraticCurveTo(-u * 3.6, -u * 0.2, -u * 1.2, -u * 2.6); c.stroke(); c.setLineDash([]);
      const prof = [[0, 0.5], [0.4, 0.75], [1.4, 1.15], [2.2, 1.2], [3.2, 0.95], [4.4, 0.5], [5.2, 0.46], [6.2, 0.62], [7, 0.55], [7.6, 0]];
      c.beginPath();
      prof.forEach(([h, r], k) => (k ? c.lineTo(u * (1.3 + r), u * (4.2 - h)) : c.moveTo(u * (1.3 + r), u * (4.2 - h))));
      [...prof].reverse().forEach(([h, r]) => c.lineTo(u * (1.3 - r), u * (4.2 - h)));
      c.closePath(); c.fill();
      c.fillStyle = bg; c.fillRect(u * 0.6, -u * 0.55, u * 1.4, u * 0.22); c.fillRect(u * 0.6, -u * 1.05, u * 1.4, u * 0.22);
      break;
    }
    case "rally": { // a bat and a ball on its arc
      c.save(); c.rotate(-0.5);
      c.beginPath(); c.ellipse(-u * 1.2, -u * 0.6, u * 2.5, u * 2.8, 0, 0, Math.PI * 2); c.fill();
      c.fillRect(-u * 1.75, u * 2, u * 1.1, u * 2.6);
      c.restore();
      c.setLineDash([u * 0.3, u * 0.55]); c.lineWidth = u * 0.3;
      c.beginPath(); c.moveTo(u * 1.2, -u * 1.2); c.quadraticCurveTo(u * 3, -u * 5, u * 4.3, -u * 1.5); c.stroke();
      c.setLineDash([]); c.beginPath(); c.arc(u * 4.3, -u * 1.5, u * 0.7, 0, Math.PI * 2); c.fill();
      break;
    }
    case "spillway": { // a door on a hydrofoil over three waves
      c.lineWidth = u * 0.55;
      for (let k = 0; k < 3; k++) { c.beginPath(); for (let i = 0; i <= 20; i++) { const px = -u * 5 + i * u / 2, py = u * (1.8 + k * 1.3) + Math.sin(i * 0.9 + k) * u * 0.35; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.globalAlpha = 1 - k * 0.3; c.stroke(); }
      c.globalAlpha = 1;
      c.save(); c.rotate(-0.12); c.fillRect(-u * 3.2, -u * 0.4, u * 6.4, u * 1); c.restore();
      c.fillRect(-u * 0.25, u * 0.4, u * 0.5, u * 1.1);
      c.beginPath(); c.arc(u * 0.6, -u * 3.4, u * 0.75, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(-u * 0.2, -u * 2.6); c.lineTo(u * 1.4, -u * 2.6); c.lineTo(u * 0.9, -u * 0.6); c.lineTo(-u * 0.6, -u * 0.6); c.closePath(); c.fill();
      break;
    }
    case "swish": { // the dotted arc into a hoop
      c.setLineDash([u * 0.25, u * 0.5]); c.lineWidth = u * 0.3;
      c.beginPath(); c.moveTo(-u * 4.2, u * 3.4); c.quadraticCurveTo(-u * 1, -u * 6, u * 2.6, -u * 0.6); c.stroke(); c.setLineDash([]);
      c.lineWidth = u * 0.5; c.beginPath(); c.ellipse(u * 3, -u * 0.6, u * 1.6, u * 0.45, 0, 0, Math.PI * 2); c.stroke();
      c.lineWidth = u * 0.18;
      for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(u * (1.5 + k * 0.75), -u * 0.4); c.lineTo(u * (1.9 + k * 0.45), u * 1.7); c.stroke(); }
      c.beginPath(); c.arc(-u * 4.2, u * 3.4, u * 1.2, 0, Math.PI * 2); c.fill();
      c.strokeStyle = bg; c.lineWidth = u * 0.16; c.beginPath(); c.arc(-u * 4.2, u * 3.4, u * 1.2, -0.6, 2.2); c.stroke();
      break;
    }
    case "typester": { // a word as keycaps, two pressed
      const word = "TYPE";
      c.textAlign = "center"; c.textBaseline = "middle"; c.font = `800 ${u * 1.4}px ${FONT}`;
      [...word].forEach((ch, k) => {
        const px = -u * 4.4 + k * u * 2.3, down = k < 2 ? u * 0.3 : 0;
        c.fillStyle = shade(fg, -0.45); c.fillRect(px, -u * 0.8 + u * 0.4, u * 2, u * 2);
        c.fillStyle = k < 2 ? fg : shade(fg, 0.6); c.fillRect(px, -u * 0.8 + down, u * 2, u * 1.95 - down);
        c.fillStyle = bg; c.fillText(ch, px + u, u * 0.2 + down / 2);
      });
      break;
    }
  }
  c.restore();
}

export function marquee(c: C, g: ArtGame, [x, y, w, h]: Rect) {
  const grd = c.createLinearGradient(0, y, 0, y + h);
  grd.addColorStop(0, shade(g.ground, 0.12)); grd.addColorStop(1, shade(g.ground, -0.45));
  c.fillStyle = grd; c.fillRect(x, y, w, h);
  const pad = Math.min(w, h) * 0.07;
  // A ring of chase bulbs, lit by the marquee's own backlight.
  c.fillStyle = shade(g.bright, 0.5);
  const step = h / 7;
  for (let px = x + pad * 0.6; px < x + w - pad * 0.3; px += step) { c.beginPath(); c.arc(px, y + pad * 0.55, h * 0.018, 0, 6.3); c.arc(px, y + h - pad * 0.55, h * 0.018, 0, 6.3); c.fill(); }
  const square = w / h < 1.6;
  const ms = square ? h * 0.45 : h * 0.8;
  motif(c, g.slug, square ? x + w / 2 : x + pad + ms * 0.6, square ? y + h * 0.34 : y + h / 2, ms, g.bright, g.ground);
  const tx = square ? x + w / 2 : x + pad * 2 + ms * 1.2, tw = square ? w - pad * 2 : w - (tx - x) - pad * 1.5;
  c.textAlign = square ? "center" : "left"; c.textBaseline = "alphabetic"; c.fillStyle = g.bright;
  const size = fit(c, g.name, 800, tw, square ? h * 0.22 : h * 0.46);
  const base = square ? y + h * 0.78 : y + h * 0.56;
  c.fillText(g.name, tx, base);
  // The player's own best, when the game has shared one; otherwise what the machine is.
  const sub = g.best ? `YOUR BEST  ${g.best.v}${g.best.l ? `  ·  ${g.best.l.toUpperCase()}` : ""}` : `${g.kind.toUpperCase()}  ·  FREE PLAY`;
  c.fillStyle = g.best ? shade(g.bright, 0.55) : "#f4f1ea";
  fit(c, sub, 700, tw, size * 0.24);
  c.fillText(sub, tx, base + size * 0.36);
}

export function side(c: C, g: ArtGame, [x, y, w, h]: Rect, frontRight = true) {
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = g.ground; c.fillRect(x, y, w, h);
  // A sweep of the bright colour from the base, rising towards the front.
  c.fillStyle = g.bright;
  c.beginPath();
  const f = frontRight ? 1 : -1, x0 = frontRight ? x : x + w, x1 = frontRight ? x + w : x;
  c.moveTo(x0, y + h); c.lineTo(x0, y + h * 0.62); c.bezierCurveTo(x0 + f * w * 0.4, y + h * 0.55, x0 + f * w * 0.6, y + h * 0.38, x1, y + h * 0.28); c.lineTo(x1, y + h); c.closePath(); c.fill();
  c.fillStyle = shade(g.ground, -0.3);
  c.beginPath(); c.moveTo(x0, y + h); c.lineTo(x0, y + h * 0.78); c.bezierCurveTo(x0 + f * w * 0.5, y + h * 0.72, x0 + f * w * 0.7, y + h * 0.6, x1, y + h * 0.5); c.lineTo(x1, y + h); c.closePath(); c.fill();
  const s = Math.min(w, h) * 0.78;
  motif(c, g.slug, x + w * 0.5, y + h * (w / h < 1 ? 0.3 : 0.4), s, g.bright, g.ground);
  // The name runs up the back edge on a tall side, along the foot on a wide one.
  c.fillStyle = g.ground;
  if (w / h < 1) {
    c.translate(frontRight ? x + w * 0.2 : x + w * 0.8, y + h * 0.97); c.rotate(-Math.PI / 2);
    c.textAlign = "left"; c.textBaseline = "middle";
    fit(c, g.name, 800, h * 0.5, w * 0.3); c.fillText(g.name, 0, 0);
  } else {
    c.textAlign = "center"; c.textBaseline = "alphabetic";
    fit(c, g.name, 800, w * 0.6, h * 0.22); c.fillText(g.name, x + w / 2, y + h * 0.93);
  }
  c.restore();
}

export function panel(c: C, g: ArtGame, [x, y, w, h]: Rect) {
  c.fillStyle = "#121212"; c.fillRect(x, y, w, h);
  c.fillStyle = g.bright; c.fillRect(x, y + h * 0.86, w, h * 0.14);
  c.globalAlpha = 0.16; motif(c, g.slug, x + w * 0.82, y + h * 0.45, h * 0.8, g.bright, "#121212"); c.globalAlpha = 1;
  c.fillStyle = "#bfbab0"; c.textBaseline = "middle"; c.textAlign = "left";
  c.font = `700 ${h * 0.09}px ${FONT}`;
  c.fillText("1 PLAYER", x + w * 0.06, y + h * 0.12);
  c.fillStyle = g.ground; c.font = `800 ${h * 0.1}px ${FONT}`;
  c.fillText(g.name.toUpperCase(), x + w * 0.06, y + h * 0.93);
}

/** The neon on the back wall: tubes of light with their glow, on black. */
export function neon(c: C, w: number, h: number) {
  c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
  c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip();
  c.textAlign = "center"; c.textBaseline = "middle";
  const tube = (text: string, px: number, py: number, size: number, col: string, weight = 700) => {
    c.font = `${weight} ${size}px ${FONT}`;
    c.lineWidth = size * 0.05; c.strokeStyle = col; c.shadowColor = col;
    for (const blur of [size * 0.5, size * 0.22, size * 0.08]) { c.shadowBlur = blur; c.strokeText(text, px, py); }
    c.shadowBlur = 0; c.lineWidth = size * 0.018; c.strokeStyle = "#fff"; c.strokeText(text, px, py);
  };
  tube("ARCADE", w / 2, h * 0.4, h * 0.5, "#ff3d8b", 800);
  tube("FREE PLAY ALL NIGHT", w / 2, h * 0.82, h * 0.15, "#3df0ff");
  c.restore();
}

/** A table's glass top: a frame of the game's colours round the screen, the name along the near edge. */
export function top(c: C, g: ArtGame, [x, y, w, h]: Rect) {
  c.fillStyle = "#0d0d0d"; c.fillRect(x, y, w, h);
  c.strokeStyle = g.bright; c.lineWidth = w * 0.025; c.strokeRect(x + w * 0.06, y + h * 0.06, w * 0.88, h * 0.88);
  c.globalAlpha = 0.5;
  for (const [px, py] of [[0.13, 0.11], [0.87, 0.11]]) motif(c, g.slug, x + w * px, y + h * py, w * 0.12, g.bright, "#0d0d0d");
  c.globalAlpha = 1;
  c.fillStyle = g.bright; c.textAlign = "center"; c.textBaseline = "middle";
  fit(c, g.name.toUpperCase(), 800, w * 0.6, h * 0.05); c.fillText(g.name.toUpperCase(), x + w / 2, y + h * 0.95);
}

/** A drinks machine for the corner, its cans in the games' colours. Always lit. */
export function vending(c: C, [x, y, w, h]: Rect, colours: string[]) {
  c.fillStyle = "#0c0d10"; c.fillRect(x, y, w, h);
  const gx = x + w * 0.06, gw = w * 0.62, gy = y + h * 0.12, gh = h * 0.7;
  const glow = c.createLinearGradient(gx, 0, gx + gw, 0);
  glow.addColorStop(0, "#2a2f3a"); glow.addColorStop(0.5, "#454c5c"); glow.addColorStop(1, "#2a2f3a");
  c.fillStyle = glow; c.fillRect(gx, gy, gw, gh);
  const rows = 6, cols = 5, cw = gw / cols, rh = gh / rows;
  for (let r = 0; r < rows; r++) {
    c.fillStyle = "#15171c"; c.fillRect(gx, gy + (r + 1) * rh - rh * 0.08, gw, rh * 0.08);
    for (let k = 0; k < cols; k++) {
      const col = colours[(r * cols + k * 3) % colours.length];
      const px = gx + k * cw + cw * 0.2, py = gy + r * rh + rh * 0.14, pw = cw * 0.6, ph = rh * 0.74;
      c.fillStyle = col; c.beginPath(); c.roundRect(px, py, pw, ph, pw * 0.18); c.fill();
      c.fillStyle = "rgba(255,255,255,0.35)"; c.fillRect(px + pw * 0.18, py + ph * 0.1, pw * 0.14, ph * 0.8);
      c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(px, py + ph * 0.42, pw, ph * 0.16);
    }
  }
  c.fillStyle = "#ffcf3d"; c.fillRect(x, y, w, h * 0.09);
  c.fillStyle = "#241a00"; c.textAlign = "center"; c.textBaseline = "middle";
  fit(c, "COLD DRINKS", 800, w * 0.8, h * 0.06); c.fillText("COLD DRINKS", x + w / 2, y + h * 0.047);
  const kx = x + w * 0.74, kw = w * 0.2;
  c.fillStyle = "#1d2027"; c.fillRect(kx, gy, kw, gh);
  c.fillStyle = "#3df0a0"; c.fillRect(kx + kw * 0.1, gy + kw * 0.12, kw * 0.8, kw * 0.32);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) { c.fillStyle = "#c8c4ba"; c.fillRect(kx + kw * (0.12 + k * 0.28), gy + kw * (0.65 + r * 0.32), kw * 0.2, kw * 0.2); }
  c.fillStyle = "#050506"; c.fillRect(gx, y + h * 0.86, gw, h * 0.1);
}
