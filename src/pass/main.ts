// The arcade pass: the one script every machine and the hall load from arcade.ashwinsathian.com/pass.js.
// Games talk to it with two events, and it fails open: a game whose pass never loads plays free.
//
//   if (!dispatchEvent(new CustomEvent("arcade:start", { cancelable: true, detail: { mode } }))) return;
//   dispatchEvent(new CustomEvent("arcade:end", { detail: { mode, score, won } }));   // or { mode, quit: true }
import { type Card, parse, serialise, refill, refillIn, daily, cleanTag } from "./card.ts";
import { machines, start, end, insert, type Detail } from "./economy.ts";
import { randomTag } from "./tags.ts";
import { list } from "./machines.gen.ts";
import { PassUI, priceLine, type Price } from "./ui.ts";

declare global {
  interface Window {
    arcadePass?: {
      ready: true;
      card(): Card;
      insert(slug: string): boolean;
      plays(slug: string): number;
      refillIn(): number;
      price(slug: string): Price & { line: string };
      handoff(slug: string): void;
      open(): void;
      /** Tokens the day's claim paid on this page load, 0 if none. */
      daily: number;
      fresh: boolean;
    };
  }
}

(() => {
  if (window.arcadePass) return; // loaded twice: the first one owns the page
  const me = document.currentScript as HTMLScriptElement | null;
  const slug = me?.dataset.game && machines[me.dataset.game] ? me.dataset.game : undefined;
  const base = new URL("./", me?.src || location.href);
  const slugs = list.map((g) => g.slug);
  const names = Object.fromEntries(list.map((g) => [g.slug, g.name]));

  // ---------- the card cookie, shared by every *.ashwinsathian.com page ----------
  const shared = location.hostname === "ashwinsathian.com" || location.hostname.endsWith(".ashwinsathian.com");
  const attrs = `${shared ? "; Domain=ashwinsathian.com" : ""}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  const jar = (k: string) => document.cookie.split(/;\s*/).find((c) => c.startsWith(`${k}=`))?.slice(k.length + 1);
  const setCookie = (k: string, v: string, age: number) => { try { document.cookie = `${k}=${v}${attrs}; Max-Age=${age}`; } catch { /* cookies blocked: this page still plays */ } };
  let fresh = false;
  const read = () => { const r = parse(jar("arcade_card"), slugs, Date.now(), Math.random); fresh ||= r.fresh; return r.card; };
  const write = (c: Card) => setCookie("arcade_card", serialise(c), 34_560_000);
  /** Every change re-reads the cookie first, so two open tabs don't undo each other. */
  function change<T>(f: (c: Card, now: number) => T): T {
    const c = read(), out = f(c, Date.now());
    write(c);
    ui.paint(c);
    dispatchEvent(new CustomEvent("arcade:card", { detail: c }));
    return out;
  }

  const price = (s: string) => { const m = machines[s]; const p = { plays: m?.plays ?? 1, top: m?.top ?? 0, pays: m?.pays ?? "" }; return { ...p, line: priceLine(p) }; };
  const idx = slug ? slugs.indexOf(slug) : -1;
  const machine = slug ? { ...list[idx], n: idx + 1, of: list.length } : undefined;
  const font = slug ? "ArcadePass" : "Bricolage";
  if (slug) {
    try { const f = new FontFace(font, `url(${new URL("pass/bricolage.woff2", base)}) format("woff2")`, { weight: "400 800" }); document.fonts.add(f); f.load().catch(() => {}); } catch { /* no FontFace: system face */ }
  }

  const ui = new PassUI({
    card: read,
    refillIn: () => refillIn(refill(read(), Date.now()), Date.now()),
    insert: () => !!slug && change((c, now) => insert(c, slug, now).ok),
    reroll: () => change((c) => { let t; do t = randomTag(Math.random); while (t === c.tag); c.tag = t; }),
    rename: (t) => { const v = cleanTag(t); if (!v) return false; change((c) => (c.tag = v)); return true; },
    forget: () => { setCookie("arcade_card", "", 0); change(() => {}); },
    code: () => serialise(read()),
    use: (code) => {
      if (!/^[A-Za-z0-9_-]{20,4000}$/.test(code)) return false;
      const r = parse(code, slugs, Date.now(), Math.random);
      if (r.fresh) return false;
      write(r.card); ui.paint(r.card);
      dispatchEvent(new CustomEvent("arcade:card", { detail: r.card }));
      return true;
    },
    kept: () => !!jar("arcade_card"),
  }, {
    machine, price: slug ? price(slug) : undefined, corner: me?.dataset.corner || "tr", font,
    hall: new URL("./", base).href, tokens: new URL("tokens", base).href, privacy: new URL("privacy", base).href,
    slot: slug ? null : document.querySelector("[data-arcade-chip]"), names,
  });

  // ---------- arriving ----------
  const paid = change((c, now) => { refill(c, now); return daily(c, now).paid; });
  const card0 = read();
  if (paid) ui.toast(`+${paid} tokens · ${card0.log[0]?.[3] || "Daily tokens"}`, "plus");

  // ---------- runs: one per tab per machine, kept in sessionStorage so a reload mid-run can't pay twice ----------
  const RUN = `arcade:run:${slug}`;
  const getRun = () => { try { const r = JSON.parse(sessionStorage.getItem(RUN) || "null"); return r && typeof r.mode === "string" && typeof r.at === "number" ? r as { mode: string; at: number } : undefined; } catch { return undefined; } };
  const setRun = (r?: { mode: string; at: number }) => { try { r ? sessionStorage.setItem(RUN, JSON.stringify(r)) : sessionStorage.removeItem(RUN); } catch { /* private mode */ } };
  const detail = (e: Event): Detail => { const d = (e as CustomEvent).detail; return d && typeof d === "object" ? d as Detail : {}; };

  if (slug) {
    addEventListener("arcade:start", (e) => {
      const d = detail(e), mode = String(d.mode ?? "");
      const r = change((c, now) => start(c, slug, mode, d, now));
      if (!r.ok) {
        if (e.cancelable) e.preventDefault();
        ui.out();
        return;
      }
      setRun(r.free ? undefined : { mode, at: Date.now() });
      ui.running(true);
      const left = read().cr[slug] ?? 0;
      if (r.charged) ui.toast(`−1 token · ${left} ${left === 1 ? "play" : "plays"} left on ${machine!.name}`, "minus");
    });
    addEventListener("arcade:end", (e) => {
      const d = detail(e), run = getRun();
      setRun(undefined);
      ui.running(false);
      if (!run || d.quit) return;
      const r = change((c, now) => end(c, slug, run, d, now));
      if (r.paid) ui.toast(`+${r.paid} ${r.paid === 1 ? "token" : "tokens"} · ${r.why}`, "plus");
      else if (r.best) ui.toast("New best", "info");
    });
  }

  // Another tab may have spent or won tokens.
  const repaint = () => ui.paint(read());
  addEventListener("pageshow", repaint);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) repaint(); });

  window.arcadePass = {
    ready: true,
    card: read,
    insert: (s) => !!machines[s] && change((c, now) => insert(c, s, now).ok),
    plays: (s) => read().cr[s] ?? 0,
    refillIn: () => refillIn(refill(read(), Date.now()), Date.now()),
    price,
    handoff: (s) => setCookie("arcade_via", s, 120),
    open: () => ui.sheet(),
    daily: paid,
    fresh,
  };

  // ---------- the greeting ----------
  const via = jar("arcade_via");
  if (via) setCookie("arcade_via", "", 0);
  const auto = /[?&](autoplay|bot)\b/.test(location.search);
  const seen = (() => { try { return sessionStorage.getItem(`arcade:hi:${slug}`); } catch { return "1"; } })();
  const greet = () => {
    if (slug && !auto && via !== slug && !seen) {
      try { sessionStorage.setItem(`arcade:hi:${slug}`, "1"); } catch { /* fine */ }
      ui.welcome(fresh);
    } else if (fresh && !slug) ui.sheet(true);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", greet, { once: true });
  else greet();
})();
