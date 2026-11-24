// The home page: the card and the row drive the hall, and the hall drives them back.
// Without WebGL 2 the cards and the row still work over the photograph of the hall.
import { Hall, type HallGame } from "../arcade/hall";
import { sfx, setSound } from "../arcade/sound";

const root = document.documentElement;
const canvas = document.querySelector<HTMLCanvasElement>(".hall__gl")!;
const games: HallGame[] = JSON.parse(canvas.dataset.games!);
const cards = [...document.querySelectorAll<HTMLElement>("[data-card]")];
const rowButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-go]")];
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;

const fromHash = games.findIndex((g) => `#${g.slug}` === location.hash);
let focus = fromHash >= 0 ? fromHash : 0;
let hall: Hall | undefined;

function show(i: number, from: "hall" | "page" = "page") {
  i = (i + games.length) % games.length;
  if (i === focus && from === "page" && hall?.focus === i) return;
  const moved = i !== focus;
  focus = i;
  cards.forEach((c, k) => (c.hidden = k !== i));
  rowButtons.forEach((b, k) => (k === i ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current")));
  rowButtons[i].scrollIntoView({ block: "nearest", inline: "center", behavior: reduced.matches ? "auto" : "smooth" });
  if (moved || location.hash) history.replaceState(null, "", `#${games[i].slug}`);
  if (from === "page") hall?.go(i);
  hall?.syncVideos();
  if (moved) sfx.tick();
}

rowButtons.forEach((b, k) => b.addEventListener("click", () => show(k)));
document.querySelectorAll<HTMLButtonElement>("[data-step]").forEach((b) => b.addEventListener("click", () => show(focus + Number(b.dataset.step))));
document.querySelector<HTMLButtonElement>("[data-coin]")!.addEventListener("click", () => {
  let n = Math.floor(Math.random() * (games.length - 1));
  if (n >= focus) n++; // never the machine you are at
  sfx.coin();
  setTimeout(() => show(n), 260);
});

// Playing: the camera flies into the screen, then the game opens. A modified click opens it the usual way.
async function play(url: string) {
  sfx.enter();
  root.dataset.entering = "";
  if (hall && !reduced.matches) await hall.enter();
  location.href = url;
}
document.addEventListener("click", (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>(".card__play");
  if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  play(a.href);
});
canvas.addEventListener("arcade:play", () => play(cards[focus].querySelector<HTMLAnchorElement>(".card__play")!.href));
addEventListener("pageshow", (e) => { if (e.persisted) { delete root.dataset.entering; hall?.leave(); } });

document.addEventListener("keydown", (e) => {
  const t = e.target as HTMLElement;
  if (e.altKey || e.ctrlKey || e.metaKey || t.closest("input, textarea, select, [contenteditable]")) return;
  if (canvas.getBoundingClientRect().bottom < innerHeight * 0.4) return; // the hall is scrolled away
  if (e.key === "ArrowRight" || e.key === "d") { show(focus + 1); e.preventDefault(); }
  else if (e.key === "ArrowLeft" || e.key === "a") { show(focus - 1); e.preventDefault(); }
  else if (e.key === "Enter" && (t === document.body || t === canvas)) { play(cards[focus].querySelector<HTMLAnchorElement>(".card__play")!.href); }
});

// A gamepad walks the row too: the stick or the d-pad, and A to play.
let padHeld = 0;
addEventListener("gamepadconnected", function poll() {
  const pad = navigator.getGamepads().find((p) => p);
  if (!pad) return;
  const x = pad.axes[0] ?? 0, right = pad.buttons[15]?.pressed || x > 0.6, left = pad.buttons[14]?.pressed || x < -0.6, a = pad.buttons[0]?.pressed;
  const dir = right ? 1 : left ? -1 : 0;
  if (dir && padHeld !== dir) show(focus + dir);
  if (a && padHeld !== 2) play(cards[focus].querySelector<HTMLAnchorElement>(".card__play")!.href);
  padHeld = a ? 2 : dir;
  requestAnimationFrame(poll);
}, { once: true });

// Sound: on unless turned off, and only ever after the visitor has done something.
const soundBtn = document.querySelector<HTMLButtonElement>("[data-sound]")!;
let sound = true;
try { sound = localStorage.getItem("games:sound") !== "0"; } catch { /* storage blocked */ }
const setSoundUI = () => { setSound(sound); soundBtn.setAttribute("aria-pressed", String(sound)); };
soundBtn.hidden = false;
soundBtn.addEventListener("click", () => {
  sound = !sound;
  try { localStorage.setItem("games:sound", sound ? "1" : "0"); } catch { /* as above */ }
  setSoundUI();
  if (sound) sfx.tick();
});
setSoundUI();

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
      if (m.attributeName === "data-still") sync();
    }
  }).observe(root, { attributes: true, attributeFilter: ["data-theme", "data-still"] });
  hall.onFocus = (i) => show(i, "hall");
  canvas.addEventListener("webglcontextlost", () => delete root.dataset.hallLive);
  sync();
  hall.start();
  requestAnimationFrame(() => requestAnimationFrame(() => (root.dataset.hallLive = "")));
}
boot();
