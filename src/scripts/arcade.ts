// The home page: the card and the row drive the hall, and the hall drives them back.
// Without WebGL 2 the cards and the row still work over the photograph of the hall.
import { Hall, type HallGame } from "../arcade/hall";
import type { Best } from "../arcade/art";
import { sfx, setSound, ambience } from "../arcade/sound";

const root = document.documentElement;
const hallEl = document.querySelector<HTMLElement>("[data-hall]")!;
const canvas = hallEl.querySelector<HTMLCanvasElement>(".hall__gl")!;
const games: HallGame[] = JSON.parse(canvas.dataset.games!);
const cards = [...document.querySelectorAll<HTMLElement>("[data-card]")];
const cardBox = hallEl.querySelector<HTMLElement>(".hall__cards")!;
const top = hallEl.querySelector<HTMLElement>(".hall__top")!;
const row = hallEl.querySelector<HTMLElement>(".hall__row")!;
const rowList = row.querySelector<HTMLOListElement>("ol")!;
const rowButtons = [...row.querySelectorAll<HTMLButtonElement>("[data-go]")];
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const coarse = matchMedia("(pointer: coarse)");
const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked: forget it */ } },
};
const playHref = (i: number) => cards[i].querySelector<HTMLAnchorElement>(".card__play")!.href;

// ---------- bests: each game shares the player's best in a cookie on .ashwinsathian.com ----------
function readBests(): (Best | undefined)[] {
  const jar = new Map(document.cookie.split(/;\s*/).map((c) => { const k = c.indexOf("="); return [c.slice(0, k), c.slice(k + 1)] as const; }));
  return games.map((g) => {
    const raw = jar.get(`arcade_best_${g.slug}`);
    if (!raw) return undefined;
    try {
      const o = JSON.parse(decodeURIComponent(raw));
      // Written by our own games, but a cookie is still input: strings only, short, printable.
      const clean = (s: unknown, n: number) => (typeof s === "string" ? s.replace(/[^\p{L}\p{N}\p{P}\p{Zs}]/gu, "").trim().slice(0, n) : "");
      const v = clean(o?.v, 12), l = clean(o?.l, 14);
      return v ? { v, l } : undefined;
    } catch { return undefined; }
  });
}
function applyBests() {
  readBests().forEach((b, i) => {
    games[i].best = b;
    const p = cards[i].querySelector<HTMLElement>("[data-best]")!;
    p.hidden = !b;
    if (b) p.textContent = `Your best: ${b.v}${b.l ? ` (${b.l})` : ""}`;
    hall?.setBest(i, b);
  });
}
applyBests();

// ---------- the machine played last on this device ----------
const lastIdx = () => games.findIndex((g) => g.slug === store.get("games:last"));
function applyLast() {
  const l = lastIdx();
  cards.forEach((c, k) => (c.querySelector<HTMLElement>("[data-last]")!.hidden = k !== l));
  rowButtons.forEach((b, k) => b.classList.toggle("is-last", k === l));
  if (hall) hall.lastPlayed = l;
}
applyLast();

const fromHash = games.findIndex((g) => `#${g.slug}` === location.hash);
let focus = fromHash >= 0 ? fromHash : Math.max(0, lastIdx());
let hall: Hall | undefined;

// ---------- the free part of the hall: the camera frames the machine there, clear of the card ----------
function measure() {
  if (!hall) return;
  const h = hallEl.getBoundingClientRect(), W = h.width, H = h.height;
  // An element with no box (hidden, or not laid out yet) frees its space rather than taking all of it.
  const box = (el: Element) => { const r = el.getBoundingClientRect(); return r.width && r.height ? r : undefined; };
  const card = box(cardBox), bar = box(top), foot = box(row);
  const t = bar ? bar.bottom - h.top + 8 : 0;
  const tall = H > W * 1.05;
  const b = (tall && card ? card.top : foot ? foot.top : h.bottom) - h.top - 8;
  const l = !tall && card ? Math.min(card.right - h.left + 8, W * 0.55) : 0;
  hall.free = { l: l / W, t: t / H, r: 1, b: Math.max(t + 80, b) / H };
  // Hints sit in the middle of the free part, over the hall, never on the card.
  hallEl.style.setProperty("--free-x", `${(l + W) / 2}px`);
  hallEl.style.setProperty("--free-y", `${(t + Math.max(t + 80, b)) / 2}px`);
}
new ResizeObserver(measure).observe(hallEl);
new ResizeObserver(measure).observe(cardBox);
new ResizeObserver(measure).observe(top);

function centreRow(i: number) {
  const b = rowButtons[i];
  // Scroll the strip sideways only: scrollIntoView would also scroll the page.
  rowList.scrollTo({ left: b.offsetLeft - (rowList.clientWidth - b.offsetWidth) / 2, behavior: reduced.matches ? "auto" : "smooth" });
}

function show(i: number, from: "hall" | "page" | "attract" = "page") {
  i = (i + games.length) % games.length;
  if (i === focus && from !== "hall" && hall?.focus === i) return;
  const moved = i !== focus;
  focus = i;
  cards.forEach((c, k) => (c.hidden = k !== i));
  rowButtons.forEach((b, k) => (k === i ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current")));
  centreRow(i);
  if (moved || location.hash) history.replaceState(null, "", `#${games[i].slug}`);
  if (from !== "hall") hall?.go(i);
  hall?.syncVideos();
  measure();
  if (!moved || from === "attract") return;
  sfx.tick();
  // A detent under the thumb, where the device has one.
  if (from === "hall") { navigator.vibrate?.(8); coachDone(); }
}

rowButtons.forEach((b, k) => b.addEventListener("click", () => show(k)));
document.querySelectorAll<HTMLButtonElement>("[data-step]").forEach((b) => b.addEventListener("click", () => show(focus + Number(b.dataset.step))));
document.querySelector<HTMLButtonElement>("[data-coin]")!.addEventListener("click", () => {
  let n = Math.floor(Math.random() * (games.length - 1));
  if (n >= focus) n++; // never the machine you are at
  sfx.coin();
  setTimeout(() => show(n), 260);
});

// ---------- playing: the camera flies into the screen, then the game opens ----------
async function play(i: number) {
  store.set("games:last", games[i].slug);
  sfx.enter();
  ambience.stop();
  root.dataset.entering = "";
  if (hall && !reduced.matches) await hall.enter();
  location.href = playHref(i);
}
document.addEventListener("click", (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>(".card__play");
  if (!a) return;
  const i = cards.indexOf(a.closest<HTMLElement>("[data-card]")!);
  // A modified click opens the game the usual way, but still counts as played.
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) { store.set("games:last", games[i].slug); return; }
  e.preventDefault();
  play(i);
});
canvas.addEventListener("arcade:play", () => play(focus));
// Back from a game: the best may have changed, and that game is now the last one played.
addEventListener("pageshow", (e) => {
  if (!e.persisted) return;
  delete root.dataset.entering;
  hall?.leave();
  applyBests();
  applyLast();
});

document.addEventListener("keydown", (e) => {
  const t = e.target as HTMLElement;
  if (e.altKey || e.ctrlKey || e.metaKey || t.closest("input, textarea, select, [contenteditable]")) return;
  if (canvas.getBoundingClientRect().bottom < innerHeight * 0.4) return; // the hall is scrolled away
  if (e.key === "ArrowRight" || e.key === "d") { show(focus + 1); e.preventDefault(); }
  else if (e.key === "ArrowLeft" || e.key === "a") { show(focus - 1); e.preventDefault(); }
  else if (e.key === "Enter" && (t === document.body || t === canvas)) play(focus);
});

// A gamepad walks the row too: the stick or the d-pad, and A to play.
let padHeld = 0;
addEventListener("gamepadconnected", function poll() {
  const pad = navigator.getGamepads().find((p) => p);
  if (!pad) return;
  const x = pad.axes[0] ?? 0, right = pad.buttons[15]?.pressed || x > 0.6, left = pad.buttons[14]?.pressed || x < -0.6, a = pad.buttons[0]?.pressed;
  const dir = right ? 1 : left ? -1 : 0;
  if (dir || a) wake();
  if (dir && padHeld !== dir) show(focus + dir);
  if (a && padHeld !== 2) play(focus);
  padHeld = a ? 2 : dir;
  requestAnimationFrame(poll);
}, { once: true });

// ---------- sound: on unless turned off, and only ever after the visitor has done something ----------
const soundBtn = document.querySelector<HTMLButtonElement>("[data-sound]")!;
let sound = store.get("games:sound") !== "0";
let touched = false, hallInView = true;
const seed = (i: number) => [...games[i].slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
function syncAmbience() {
  const want = sound && touched && hallInView && !document.hidden && !root.hasAttribute("data-entering");
  if (want && !ambience.on) ambience.start(() => ({ focus, count: games.length, seed }));
  else if (!want && ambience.on) ambience.stop();
}
const setSoundUI = () => { setSound(sound); soundBtn.setAttribute("aria-pressed", String(sound)); syncAmbience(); };
soundBtn.hidden = false;
soundBtn.addEventListener("click", () => {
  sound = !sound;
  store.set("games:sound", sound ? "1" : "0");
  setSoundUI();
  if (sound) sfx.tick();
});
for (const t of ["pointerdown", "keydown"]) addEventListener(t, () => { if (!touched) { touched = true; syncAmbience(); } }, { capture: true, passive: true });
document.addEventListener("visibilitychange", syncAmbience);
new IntersectionObserver(([e]) => { hallInView = e.isIntersecting; syncAmbience(); }, { threshold: 0.25 }).observe(hallEl);
setSoundUI();

// ---------- attract mode: left alone, the hall shows itself off, as arcades do ----------
const IDLE = 40_000, STEP = 6_000;
const note = document.querySelector<HTMLElement>("[data-attract-note]")!;
let idleTimer = 0, stepTimer = 0;
function wake() {
  if (root.hasAttribute("data-attract")) {
    clearInterval(stepTimer);
    delete root.dataset.attract;
    note.hidden = true;
    if (hall) hall.calm = false;
  }
  clearTimeout(idleTimer);
  idleTimer = window.setTimeout(attract, IDLE);
}
function attract() {
  const quiet = reduced.matches || root.hasAttribute("data-still") || document.hidden || !hallInView || root.hasAttribute("data-entering");
  if (!hall || quiet) { idleTimer = window.setTimeout(attract, IDLE); return; }
  root.dataset.attract = "";
  note.hidden = false;
  hall.calm = true;
  stepTimer = window.setInterval(() => show(focus + 1, "attract"), STEP);
}
for (const t of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"]) addEventListener(t, wake, { capture: true, passive: true });

// ---------- a first-visit hint on touch screens: the hall moves under a swipe ----------
const coach = document.querySelector<HTMLElement>("[data-coach]")!;
function coachDone() {
  if (coach.hidden && store.get("games:swiped")) return;
  store.set("games:swiped", "1");
  coach.classList.add("is-done");
  setTimeout(() => (coach.hidden = true), 400);
}

show(focus);

async function boot() {
  const probe = document.createElement("canvas").getContext("webgl2");
  if (!probe) return;
  // The cabinet art is lettered in the page's own face, so wait for it.
  await Promise.all([document.fonts.load("800 64px Bricolage"), document.fonts.load("700 64px Bricolage")]).catch(() => {});
  try {
    hall = new Hall(canvas, games, focus);
  } catch (err) {
    console.warn("The hall could not start; the photograph stays.", err);
    return;
  }
  hall.frugal = !!conn?.saveData;
  hall.lastPlayed = lastIdx();
  const sync = () => {
    hall!.reduced = reduced.matches;
    hall!.still = root.hasAttribute("data-still") || reduced.matches;
    hall!.syncVideos();
  };
  reduced.addEventListener("change", sync);
  hall.setNight(root.dataset.theme === "night", true);
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.attributeName === "data-theme") { const n = root.dataset.theme === "night"; if (hall!.nightTo !== (n ? 1 : 0)) { hall!.setNight(n); sfx.lights(n); } }
      if (m.attributeName === "data-still") { sync(); if (root.hasAttribute("data-still")) wake(); }
    }
  }).observe(root, { attributes: true, attributeFilter: ["data-theme", "data-still"] });
  hall.onFocus = (i) => show(i, "hall");
  canvas.addEventListener("webglcontextlost", () => delete root.dataset.hallLive);
  sync();
  measure();
  hall.start();
  requestAnimationFrame(() => requestAnimationFrame(() => (root.dataset.hallLive = "")));
  wake();
  if (coarse.matches && !store.get("games:swiped")) setTimeout(() => { coach.hidden = false; setTimeout(coachDone, 7000); }, 1400);
}
boot();
