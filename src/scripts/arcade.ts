// The home page: the card and the row drive the hall, and the hall drives them back.
// Without WebGL 2 the cards and the row still work over the photograph of the hall.
import { Hall, type HallGame } from "../arcade/hall";
import { parseBests } from "../arcade/bests";
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

let hall: Hall | undefined;

// ---------- bests: each game shares the player's best in a cookie on .ashwinsathian.com ----------
const readBests = () => parseBests(document.cookie, games.map((g) => g.slug));
function applyBests() {
  readBests().forEach((b, i) => {
    games[i].best = b;
    const p = cards[i].querySelector<HTMLElement>("[data-best]")!;
    p.hidden = !b;
    if (b) p.textContent = `Your best: ${b.v}${b.l ? ` (${b.l})` : ""}`;
    hall?.setArt(i, { best: b });
  });
}
applyBests();

// ---------- the player card, from the arcade pass (/pass.js, loaded in the head) ----------
const pass = () => window.arcadePass;
const clock = (ms: number) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
let outTimer = 0;
function applyCard() {
  const p = pass();
  if (!p) return;
  const c = p.card();
  games.forEach((g, i) => {
    const pr = p.price(g.slug), cr = c.cr[g.slug] ?? 0;
    const el = cards[i].querySelector<HTMLElement>("[data-price]")!;
    el.hidden = false;
    el.textContent = cr ? `Credit ${cr} · ${pr.line}` : pr.line;
    hall?.setArt(i, { tag: c.tag, credit: cr, price: `1 token · ${pr.plays} ${pr.plays === 1 ? "play" : "plays"}` });
  });
  // With no token and no credit on this machine, Play says when the next token comes.
  clearInterval(outTimer);
  cards.forEach((card, i) => {
    const a = card.querySelector<HTMLAnchorElement>(".card__play")!;
    const out = c.tok < 1 && !(c.cr[games[i].slug] > 0);
    a.toggleAttribute("aria-disabled", out);
    if (out) a.setAttribute("aria-disabled", "true");
    a.firstChild!.textContent = out ? `Out of tokens · ${clock(p.refillIn())} ` : `Play ${games[i].name} `;
  });
  if (c.tok < 1) outTimer = window.setInterval(applyCard, 1000);
}
addEventListener("arcade:card", applyCard);

// ---------- the machine played last on this device ----------
const lastIdx = () => games.findIndex((g) => g.slug === store.get("games:last"));
function applyLast() {
  const l = lastIdx();
  cards.forEach((c, k) => (c.querySelector<HTMLElement>("[data-last]")!.hidden = k !== l));
  rowButtons.forEach((b, k) => b.classList.toggle("is-last", k === l));
  if (hall) hall.lastPlayed = l;
}
applyLast();
if (pass()) applyCard(); else addEventListener("load", applyCard, { once: true });

const fromHash = games.findIndex((g) => `#${g.slug}` === location.hash);
let focus = fromHash >= 0 ? fromHash : Math.max(0, lastIdx());

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
  sfx.tick();
  setTimeout(() => show(n), 260);
});

// ---------- playing: the camera flies into the screen, then the game opens ----------
async function play(i: number) {
  const p = pass(), slug = games[i].slug;
  // A credit already on the machine plays at once; otherwise a token goes in, at the coin door.
  const loaded = !p || p.plays(slug) > 0;
  if (p && !loaded && !p.insert(slug)) { p.open(); return; }
  p?.handoff(slug);
  store.set("games:last", games[i].slug);
  sfx.enter();
  ambience.stop();
  root.dataset.entering = "";
  if (hall && !loaded) await hall.insert();
  if (hall && !reduced.matches) await hall.enter();
  location.href = playHref(i);
}
document.addEventListener("click", (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>(".card__play");
  if (!a) return;
  const i = cards.indexOf(a.closest<HTMLElement>("[data-card]")!);
  // A modified click opens the game the usual way, where its own cabinet takes the token; it still counts as played.
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
  applyCard();
  syncAmbience();
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
    cardBox.setAttribute("aria-live", "polite");
    if (hall) hall.calm = false;
  }
  clearTimeout(idleTimer);
  idleTimer = window.setTimeout(attract, IDLE);
}
function attract() {
  // Never while someone is on a control in the hall: moving on would hide what they are focused on.
  const busy = hallEl.contains(document.activeElement) && document.activeElement !== canvas;
  const quiet = reduced.matches || root.hasAttribute("data-still") || document.hidden || !hallInView || root.hasAttribute("data-entering") || busy;
  if (!hall || quiet) { idleTimer = window.setTimeout(attract, IDLE); return; }
  root.dataset.attract = "";
  note.hidden = false;
  // Cards changing by themselves are not news: keep a screen reader quiet until the visitor takes over.
  cardBox.setAttribute("aria-live", "off");
  hall.calm = true;
  stepTimer = window.setInterval(() => show(focus + 1, "attract"), STEP);
}
for (const t of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"]) addEventListener(t, wake, { capture: true, passive: true });
// Scrolling the page wakes it too, but not the row strip scrolling itself on each step, so no capture here.
document.addEventListener("scroll", wake, { passive: true });

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
  hall.onClink = (k) => (k === "slot" ? sfx.drop() : sfx.clink());
  // The change machine in the corner: the camera turns to it, and the player card opens.
  hall.onChanger = () => { hall!.lookAtChanger(true); pass()?.open(); pass()?.onClose(() => hall!.lookAtChanger(false)); };
  applyBests();
  applyCard();
  canvas.addEventListener("webglcontextlost", () => delete root.dataset.hallLive);
  sync();
  measure();
  hall.start();
  requestAnimationFrame(() => requestAnimationFrame(() => (root.dataset.hallLive = "")));
  wake();
  // The day's tokens: the change machine pays them out where you can see it.
  const paid = pass()?.daily ?? 0;
  if (paid && !reduced.matches) setTimeout(() => hall!.dispense(paid), 1200);
  if (coarse.matches && !store.get("games:swiped")) setTimeout(() => { coach.hidden = false; setTimeout(coachDone, 7000); }, 1400);
}
boot();
