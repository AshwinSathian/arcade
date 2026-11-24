// Everything every page does, in one small file: clips, shimmers, warm-up of links, the lights.
const root = document.documentElement;
const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
const frugal = !!conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? "");
const still = matchMedia("(prefers-reduced-motion: reduce)");

// ---------- clips: load and play only while on screen; never for Save-Data; on hover only for reduced motion ----------
const clips = [...document.querySelectorAll<HTMLElement>(".game")];
const video = (el: HTMLElement) => el.querySelector("video")!;
function play(el: HTMLElement) {
  const v = video(el);
  if (!v.src) {
    v.src = v.dataset.src!;
    v.addEventListener("playing", () => el.classList.add("is-playing"), { once: true });
  }
  v.play().catch(() => {});
}
const pause = (el: HTMLElement) => video(el).pause();

// The page's own switch (WCAG 2.2.2): stilled clips stay paused, and play only on hover or focus, like reduced motion.
const KEY = "games:still";
let stilled = false;
try { stilled = localStorage.getItem(KEY) === "1"; } catch { /* storage blocked: the switch still works for this page */ }
const quiet = () => still.matches || stilled;
const onScreen = new Set<HTMLElement>();
const toggles = [...document.querySelectorAll<HTMLButtonElement>("[data-still-toggle]")];
function setStill(on: boolean) {
  stilled = on;
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* as above */ }
  if (on) root.dataset.still = "";
  else delete root.dataset.still;
  toggles.forEach((b) => b.setAttribute("aria-pressed", String(on)));
  clips.forEach((el) => (on || !onScreen.has(el) ? pause(el) : play(el)));
}
toggles.forEach((b) => b.addEventListener("click", () => setStill(!stilled)));
setStill(stilled);

if (!frugal) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) onScreen.add(el);
        else onScreen.delete(el);
        if (e.isIntersecting && !quiet()) play(el);
        else pause(el);
      }
    },
    { threshold: 0.35 },
  );
  clips.forEach((el) => {
    io.observe(el);
    el.addEventListener("pointerenter", () => play(el));
    el.addEventListener("focusin", () => play(el));
    el.addEventListener("pointerleave", () => quiet() && pause(el));
    el.addEventListener("focusout", () => quiet() && pause(el));
  });
  // A hidden tab plays nothing.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clips.forEach(pause);
  });
}

// ---------- images: shimmer until each arrives ----------
document.querySelectorAll<HTMLImageElement>("main img").forEach((img) => {
  if (img.complete) return;
  img.classList.add("is-loading");
  const done = () => img.classList.remove("is-loading");
  img.addEventListener("load", done, { once: true });
  img.addEventListener("error", done, { once: true });
});

// ---------- warm the next page as intent shows (Chrome also prerenders through /speculation.json) ----------
const warmed = new Set<string>();
const canPrefetch = document.createElement("link").relList?.supports?.("prefetch");
function warm(e: Event) {
  if (frugal) return;
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a) return;
  const u = new URL(a.href, location.href);
  if (u.pathname === location.pathname && u.origin === location.origin) return;
  const key = u.origin + u.pathname;
  if (warmed.has(key) || /\.(txt|xml|png)$/.test(u.pathname)) return;
  warmed.add(key);
  const own = u.origin === location.origin;
  // A game is one HTML file on its own subdomain: open the connection and fetch the page before the click lands.
  if (!own && !a.hasAttribute("data-play")) return;
  if (!own) {
    const pc = document.createElement("link");
    pc.rel = "preconnect";
    pc.href = u.origin;
    document.head.append(pc);
  }
  if (canPrefetch) {
    const l = document.createElement("link");
    l.rel = "prefetch";
    l.href = u.href;
    document.head.append(l);
  } else if (own) {
    fetch(u.pathname, { priority: "low" } as RequestInit).catch(() => {});
  }
}
for (const t of ["pointerenter", "pointerdown", "focusin"]) document.addEventListener(t, warm, { capture: true, passive: true });

// ---------- navigation: a progress bar and the page's shape, only if the next page is slow ----------
let navTimer: number | undefined;
const clearNav = () => {
  clearTimeout(navTimer);
  delete root.dataset.nav;
};
document.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || (a.target && a.target !== "_self")) return;
  const to = new URL(a.href, location.href);
  if (to.origin !== location.origin || /\.[a-z0-9]+$/i.test(to.pathname) || to.pathname === location.pathname) return;
  root.dataset.nav = "";
  navTimer = window.setTimeout(clearNav, 8000); // never leave it up if the navigation dies
});
addEventListener("pageshow", clearNav);

// ---------- lights: Auto follows the system; Day and Night stick, on every page ----------
const LIGHTS = "games:lights";
const system = matchMedia("(prefers-color-scheme: dark)");
const radios = [...document.querySelectorAll<HTMLInputElement>("[data-lights-switch] input")];
function applyLights() {
  const pick = root.dataset.lights ?? "auto";
  const night = pick === "night" || (pick === "auto" && system.matches);
  root.dataset.theme = night ? "night" : "day";
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => (m.content = night ? "#141412" : "#dfdedb"));
  radios.forEach((r) => (r.checked = r.value === pick));
}
radios.forEach((r) => r.addEventListener("change", () => {
  root.dataset.lights = r.value;
  try { r.value === "auto" ? localStorage.removeItem(LIGHTS) : localStorage.setItem(LIGHTS, r.value); } catch { /* storage blocked: this page still switches */ }
  applyLights();
}));
system.addEventListener("change", applyLights);
applyLights();
