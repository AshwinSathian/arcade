// The hall's few sounds, synthesised: a detent as the camera moves on, a coin, the rush into a screen, the lights.
let ctx: AudioContext | undefined;
let out: GainNode | undefined;
export let soundOn = true;
export const setSound = (on: boolean) => { soundOn = on; };

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
  lights: (on: boolean) => { for (let k = 0; k < 4; k++) tone(on ? 7000 - k * 900 : 3000, k * 0.09 + Math.random() * 0.03, 0.05, "square", 0.025); tone(on ? 110 : 90, 0, 0.6, "sine", 0.07); },
};
