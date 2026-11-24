// The hall's few sounds, synthesised: a detent as the camera moves on, a coin, the rush into a screen, the lights.
let ctx: AudioContext | undefined;
let out: GainNode | undefined;
export let soundOn = true;
export const setSound = (on: boolean) => { soundOn = on; if (!on) ambience.stop(); };

function ac() {
  if (!soundOn) return undefined;
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return undefined; }
    out = ctx.createGain();
    out.gain.value = 0.32;
    out.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}
function tone(f: number, at: number, dur: number, type: OscillatorType, vol: number, to?: number) {
  const c = ac(); if (!c || !out) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at;
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
}
function noise(at: number, dur: number, vol: number, from: number, to: number) {
  const c = ac(); if (!c || !out) return;
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
  for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + at;
  s.buffer = b; f.type = "bandpass"; f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out); s.start(t);
}
export const sfx = {
  tick: () => { tone(1900, 0, 0.035, "square", 0.05); tone(950, 0.004, 0.05, "triangle", 0.06); },
  coin: () => { tone(1568, 0, 0.12, "triangle", 0.18); tone(2093, 0.07, 0.5, "triangle", 0.16); tone(4186, 0.07, 0.3, "sine", 0.04); },
  enter: () => { noise(0, 0.6, 0.22, 300, 4000); tone(220, 0.05, 0.55, "sawtooth", 0.05, 880); },
  /** A token dropping through a coin mech: a bright clink, then the rattle down the chute. */
  drop: () => { tone(3520, 0, 0.06, "triangle", 0.14); tone(2637, 0.05, 0.08, "triangle", 0.1); noise(0.08, 0.22, 0.05, 1800, 600); tone(110, 0.28, 0.12, "sine", 0.12); },
  /** A token landing in the change machine's tray. */
  clink: () => { const f = 2400 + Math.random() * 1600; tone(f, 0, 0.09, "triangle", 0.09); tone(f * 1.5, 0.01, 0.05, "sine", 0.04); },
  lights: (on: boolean) => { for (let k = 0; k < 4; k++) tone(on ? 7000 - k * 900 : 3000, k * 0.09 + Math.random() * 0.03, 0.05, "square", 0.025); tone(on ? 110 : 90, 0, 0.6, "sine", 0.07); },
};

// The room: a low hum, and now and then a few notes of attract music from a machine near the camera,
// panned to where it stands. Quiet enough to forget; it fades out whenever the hall is not in view.
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
let bed: { src: AudioBufferSourceNode; gain: GainNode } | undefined;
let timer = 0;
export const ambience = {
  start(near: () => { focus: number; count: number; seed: (i: number) => number }) {
    const c = ac();
    if (!c || !out || bed) return;
    const len = c.sampleRate * 4, b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let last = 0;
      for (let k = 0; k < len; k++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[k] = last * 3.5; } // brown noise
    }
    const src = c.createBufferSource(), lp = c.createBiquadFilter(), gain = c.createGain();
    src.buffer = b; src.loop = true;
    lp.type = "lowpass"; lp.frequency.value = 220;
    gain.gain.setValueAtTime(0, c.currentTime); gain.gain.linearRampToValueAtTime(0.16, c.currentTime + 2.5);
    src.connect(lp).connect(gain).connect(out); src.start();
    bed = { src, gain };
    const blip = () => {
      const ctx = ac();
      if (!ctx || !out || !bed) return;
      const { focus, count, seed } = near();
      const i = Math.max(0, Math.min(count - 1, focus + Math.round((Math.random() - 0.5) * 4)));
      const pan = ctx.createStereoPanner(), g = ctx.createGain(), t = ctx.currentTime;
      pan.pan.value = Math.max(-1, Math.min(1, (i - focus) / 2.5));
      g.gain.value = i === focus ? 0.05 : 0.03;
      pan.connect(g).connect(out);
      const root = 330 * 2 ** ((seed(i) % 7) / 12), notes = 3 + (seed(i) % 3);
      for (let n = 0; n < notes; n++) {
        const o = ctx.createOscillator(), e = ctx.createGain(), at = t + n * 0.09;
        o.type = seed(i) % 2 ? "square" : "triangle";
        o.frequency.value = root * 2 ** (SCALE[(seed(i) + n * 3) % SCALE.length] / 12);
        e.gain.setValueAtTime(0, at); e.gain.linearRampToValueAtTime(0.5, at + 0.005); e.gain.exponentialRampToValueAtTime(0.001, at + 0.08);
        o.connect(e).connect(pan); o.start(at); o.stop(at + 0.1);
      }
      timer = window.setTimeout(blip, 1800 + Math.random() * 3200);
    };
    timer = window.setTimeout(blip, 1500);
  },
  stop() {
    clearTimeout(timer);
    if (!bed || !ctx) return;
    const b = bed;
    bed = undefined;
    b.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    setTimeout(() => b.src.stop(), 1500);
  },
  get on() { return !!bed; },
};
