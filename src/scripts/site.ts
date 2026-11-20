// Everything the pages do, in one small file: clips, shimmers, warm-up of links, the weight meter, the picker.
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

// ---------- the picker: a different game each press, never the same twice running ----------
const pick = document.querySelector<HTMLAnchorElement>("[data-pick]");
const pickName = document.querySelector<HTMLElement>("[data-pick-name]");
const again = document.querySelector<HTMLButtonElement>("[data-pick-again]");
if (pick && pickName && again) {
  const choices = [...document.querySelectorAll<HTMLAnchorElement>(".game__play")].map((a) => ({ url: a.href, name: a.closest(".game")!.querySelector(".game__name")!.textContent! }));
  let last = choices.findIndex((c) => c.url === pick.href);
  const roll = () => {
    let n = Math.floor(Math.random() * (choices.length - 1));
    if (n >= last) n++; // never the same game twice running
    last = n;
    pick.href = choices[n].url;
    pickName.textContent = pick.querySelector("[data-pick-label]")!.textContent = choices[n].name;
    pickName.classList.remove("roll");
    void pickName.offsetWidth; // restart the animation
    pickName.classList.add("roll");
  };
  roll();
  pickName.classList.remove("roll");
  again.hidden = false;
  again.addEventListener("click", () => {
    // Announce picks the visitor asked for, not the silent first one.
    pickName.setAttribute("aria-live", "polite");
    roll();
  });
}

// ---------- the weight meter: what this visit has actually downloaded, read from the browser's own timings ----------
const meter = document.querySelector<HTMLElement>("[data-weight]");
if (meter && "performance" in window) {
  const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;
  const read = () => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (!nav) return;
    const res = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const sum = (k: "transferSize" | "encodedBodySize") => [nav, ...res].reduce((t, r) => t + (r[k] || 0), 0);
    const wire = sum("transferSize");
    const paint = performance.getEntriesByName("first-contentful-paint")[0]?.startTime;
    const when = paint ? ` First paint after ${Math.round(paint)} ms.` : "";
    meter.textContent = wire > 2048
      ? `This visit so far: ${kb(wire)} over the network, clips included.${when}`
      : `This visit came from your browser’s cache: ${kb(sum("encodedBodySize"))}, nothing new downloaded.${when}`;
  };
  addEventListener("load", () => {
    read();
    // Clips keep arriving as tiles come into view.
    new PerformanceObserver(read).observe({ type: "resource" });
  });
}
