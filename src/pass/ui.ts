// Everything the pass shows, inside one closed shadow root, so no game's styles reach it and none of its keys
// reach the game. All text from the card goes in through textContent.
import css from "./style.css?inline";
import type { Card } from "./card.ts";
import { CAP, FLOOR } from "./card.ts";

export type Machine = { slug: string; name: string; ground: string; bright: string; n: number; of: number };
export type Price = { plays: number; top: number; pays: string };
export type Actions = {
  card(): Card;
  refillIn(): number;
  insert(): boolean;
  reroll(): void;
  rename(tag: string): boolean;
  forget(): void;
  code(): string;
  use(code: string): boolean;
  /** False when the browser refuses the card cookie, so it lasts only this page. */
  kept(): boolean;
};
type Kids = (Node | string | false | null | undefined)[];

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, ...kids: Kids): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) k === "text" ? (el.textContent = v) : el.setAttribute(k, v);
  for (const k of kids) if (k) el.append(k);
  return el;
};
const svg = (markup: string) => { const t = document.createElement("template"); t.innerHTML = markup; return t.content.firstElementChild!; };
// The token: brass, ringed, with the arcade's A struck into it. Ids are per instance so gradients never collide.
let coinId = 0;
const coin = (cls = "coin") => {
  const id = `g${coinId++}`;
  return svg(`<svg class="${cls}" viewBox="0 0 32 32" aria-hidden="true"><defs><radialGradient id="${id}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#fff2b8"/><stop offset=".45" stop-color="#f6c53d"/><stop offset="1" stop-color="#a86a06"/></radialGradient></defs><circle cx="16" cy="16" r="15" fill="url(#${id})"/><circle cx="16" cy="16" r="11.2" fill="none" stroke="#8a5600" stroke-opacity=".55" stroke-width="1.4"/><path d="M11 21.5 16 9.5l5 12M12.8 17.6h6.4" fill="none" stroke="#7a4a00" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 9a10 10 0 0 1 6-4" stroke="#fff" stroke-opacity=".7" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`);
};
const DICE = `<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="2.5" width="15" height="15" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><g fill="currentColor"><circle cx="7" cy="7" r="1.4"/><circle cx="13" cy="13" r="1.4"/><circle cx="13" cy="7" r="1.4"/><circle cx="7" cy="13" r="1.4"/><circle cx="10" cy="10" r="1.4"/></g></svg>`;
const PEN = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 16 1-4 8-8 3 3-8 8-4 1Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

export const clock = (ms: number) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const priceLine = (p: Price) => `1 token · ${plural(p.plays, "play")} · pays up to ${p.top}`;
const ago = (s: number) => {
  const d = Math.max(0, Date.now() / 1000 - s);
  return d < 60 ? "just now" : d < 3600 ? `${Math.floor(d / 60)} min ago` : d < 86400 ? `${Math.floor(d / 3600)} h ago` : `${Math.floor(d / 86400)} d ago`;
};

export class PassUI {
  private host = document.createElement("arcade-pass");
  private root: ShadowRoot;
  private chip: HTMLButtonElement;
  private count: HTMLElement;
  private tagEl: HTMLElement;
  private credit: HTMLElement;
  private toasts: HTMLElement;
  private dlg: HTMLDialogElement;
  private ticker = 0;
  private closers: (() => void)[] = [];
  private shown = -1;
  private back: Element | null = null;
  private reduced = matchMedia("(prefers-reduced-motion: reduce)");

  constructor(
    private a: Actions,
    private opts: { machine?: Machine; price?: Price; corner: string; font: string; hall: string; tokens: string; privacy: string; slot?: Element | null; names: Record<string, string> },
  ) {
    this.root = this.host.attachShadow({ mode: "closed" });
    const style = h("style", { text: css });
    this.root.append(style);
    this.host.style.setProperty("--f", opts.font);
    if (opts.machine) { this.host.style.setProperty("--a", opts.machine.bright); this.host.style.setProperty("--ag", opts.machine.ground); }
    this.count = h("b", { class: "n" });
    this.tagEl = h("span", { class: "tag" });
    this.credit = h("span", { class: "cr" });
    this.chip = h("button", { class: `chip ${opts.slot ? "in" : `at ${opts.corner}`}`, type: "button", "aria-haspopup": "dialog" }, coin("coin spin"), this.count, this.tagEl, this.credit);
    this.chip.addEventListener("click", () => this.sheet());
    this.toasts = h("div", { class: "toasts", role: "status", "aria-live": "polite" });
    this.dlg = h("dialog", { class: "dlg", "aria-labelledby": "t" });
    this.dlg.addEventListener("close", () => {
      clearInterval(this.ticker);
      // Back to where focus was, unless that was the pass itself: a focused chip would keep the game's keys.
      const b = this.back as HTMLElement | null;
      if (b && b !== this.host) b.focus?.({ preventScroll: true });
      else (this.root.activeElement as HTMLElement | null)?.blur();
      const f = this.closers; this.closers = []; f.forEach((g) => g());
    });
    this.dlg.addEventListener("click", (e) => { if (e.target === this.dlg) this.dlg.close(); }); // the backdrop
    this.root.append(this.chip, this.toasts, this.dlg);
    const mount = () => (opts.slot ?? document.body).append(this.host);
    if (opts.slot || document.body) mount(); else document.addEventListener("DOMContentLoaded", mount, { once: true });
    // Keys inside the pass are the pass's own. This capture listener on window is registered before the game's
    // script runs, so it goes first and the game never hears Enter on "Insert token". The pass has no key
    // handlers of its own: buttons, forms and Esc work by default action, which stopping propagation keeps.
    for (const t of ["keydown", "keyup", "keypress"]) {
      addEventListener(t, (e) => { if (e.composedPath().includes(this.host)) e.stopImmediatePropagation(); }, { capture: true });
    }
    // Pointers have to reach the pass's buttons, so they are stopped on the way back out instead.
    for (const t of ["pointerdown", "pointerup", "click", "touchstart", "touchend", "mousedown", "mouseup", "wheel"]) {
      this.host.addEventListener(t, (e) => e.stopPropagation());
    }
  }

  get open() { return this.dlg.open; }
  onClose(f: () => void) { if (this.dlg.open) this.closers.push(f); else f(); }

  /** Repaint the chip from the card. */
  paint(c: Card) {
    const slug = this.opts.machine?.slug;
    const cr = slug ? c.cr[slug] ?? 0 : 0;
    if (this.shown >= 0 && c.tok !== this.shown) this.bump(c.tok > this.shown);
    this.shown = c.tok;
    this.count.textContent = String(c.tok);
    this.tagEl.textContent = c.tag;
    this.credit.textContent = cr ? `Credit ${cr}` : "";
    this.credit.hidden = !cr;
    this.chip.setAttribute("aria-label", `Player card: ${c.tag}, ${plural(c.tok, "token")}${cr ? `, ${plural(cr, "play")} on this machine` : ""}`);
    this.chip.classList.toggle("low", c.tok === 0);
  }

  /** During a run the chip steps back: small, dim, and out of the way of the game. */
  running(on: boolean) { this.chip.classList.toggle("run", on); }

  private bump(up: boolean) {
    if (this.reduced.matches) return;
    this.chip.animate([{ transform: "scale(1)" }, { transform: `scale(${up ? 1.12 : 0.94})` }, { transform: "scale(1)" }], { duration: 420, easing: "cubic-bezier(.3,1.6,.5,1)" });
  }

  toast(text: string, kind: "plus" | "minus" | "info" = "info") {
    const t = h("p", { class: `toast ${kind}` }, kind !== "info" && coin(), h("span", { text }));
    this.toasts.append(t);
    while (this.toasts.children.length > 2) this.toasts.firstElementChild!.remove();
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, 2600);
  }

  /** A token flies from where it was put in to the chip. */
  private fly(from: Element) {
    if (this.reduced.matches) return;
    const a = from.getBoundingClientRect(), b = this.chip.getBoundingClientRect();
    const c = coin("flyer");
    this.root.append(c);
    const dx = b.left + 14 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    Object.assign((c as SVGElement).style, { left: `${a.left + a.width / 2 - 14}px`, top: `${a.top + a.height / 2 - 14}px` });
    c.animate([
      { transform: "translate(0,0) rotateY(0) scale(1.4)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 80}px) rotateY(540deg) scale(1.1)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px,${dy}px) rotateY(1080deg) scale(.6)`, opacity: 0.2 },
    ], { duration: 700, easing: "cubic-bezier(.45,0,.2,1)" }).finished.then(() => c.remove());
  }

  private show(kids: Kids, cls: string) {
    clearInterval(this.ticker);
    if (!this.dlg.open) this.back = document.activeElement;
    this.dlg.className = `dlg ${cls}`;
    this.dlg.replaceChildren(...(kids.filter(Boolean) as Node[]));
    if (!this.dlg.open) this.dlg.showModal();
    this.dlg.querySelector<HTMLElement>("[autofocus]")?.focus();
  }
  close() { if (this.dlg.open) this.dlg.close(); }

  private eyebrow() {
    const m = this.opts.machine;
    return h("p", { class: "eyebrow", text: m ? `Cabinet ${String(m.n).padStart(2, "0")} of ${m.of} · The Arcade` : "The Arcade" });
  }
  private hallLink(primary = false) {
    const m = this.opts.machine;
    return h("a", { class: primary ? "btn gold" : "btn ghost", href: m ? `${this.opts.hall}#${m.slug}` : this.opts.hall, text: "Walk the hall" });
  }
  private mini(c: Card) {
    return h("div", { class: "mini" }, coin("coin big"), h("div", {}, h("b", { class: "big", text: String(c.tok) }), h("span", { text: c.tok === 1 ? "token" : "tokens" })), h("span", { class: "who", text: c.tag }));
  }

  /** Arriving at a machine without coming through the hall: it greets you as a cabinet in the arcade. */
  welcome(firstCard: boolean) {
    const m = this.opts.machine!, p = this.opts.price!, c = this.a.card();
    const cr = c.cr[m.slug] ?? 0;
    if (!cr && c.tok < 1) return this.out();
    const go = h("button", { class: "btn gold", type: "button", autofocus: "" }, coin(), h("span", { text: cr ? `Play · ${plural(cr, "play")} loaded` : "Insert token" }));
    go.addEventListener("click", () => {
      if (cr) return this.close();
      if (!this.a.insert()) return this.out();
      this.fly(go);
      setTimeout(() => this.close(), this.reduced.matches ? 0 : 420);
    });
    this.show([
      this.eyebrow(),
      h("h2", { id: "t", class: "name", text: m.name }),
      h("p", { class: "price", text: priceLine(p) }),
      firstCard && h("p", { class: "lede", text: `You're ${c.tag}. Here are ${c.tok} tokens, good in every machine in the arcade.` }),
      this.mini(c),
      h("div", { class: "acts" }, go, this.hallLink()),
      this.notice(),
    ], "welcome");
  }

  out() {
    const next = h("b", { class: "big" });
    const tick = () => {
      const ms = this.a.refillIn();
      next.textContent = ms ? clock(ms) : "now";
      if (!ms && this.a.card().tok > 0) { this.close(); this.toast("A token is back in your cup", "plus"); }
    };
    this.show([
      this.eyebrow(),
      h("h2", { id: "t", text: "Out of tokens" }),
      h("p", { class: "lede", text: `Your cup tops back up to ${FLOOR}, one token every 15 minutes. Tomorrow brings the daily tokens, more on a streak.` }),
      h("div", { class: "mini" }, coin("coin big dim"), h("div", {}, h("span", { text: "Next token in" }), next)),
      h("div", { class: "acts" }, this.hallLink(true), h("button", { class: "btn ghost", type: "button", text: "Close" })),
    ], "out");
    this.dlg.querySelector(".ghost:last-child")!.addEventListener("click", () => this.close());
    tick();
    this.ticker = window.setInterval(tick, 1000);
  }

  /** The player card: tag, tokens, timers and the receipt. */
  sheet(fresh = false) {
    const c = this.a.card(), m = this.opts.machine;
    const tag = h("h2", { id: "t", class: "tagline", text: c.tag });
    const dice = h("button", { class: "icon", type: "button", "aria-label": "New random tag" }, svg(DICE));
    const pen = h("button", { class: "icon", type: "button", "aria-label": "Type your own tag" }, svg(PEN));
    dice.addEventListener("click", () => { this.a.reroll(); tag.textContent = this.a.card().tag; if (!this.reduced.matches) dice.animate([{ transform: "rotate(0)" }, { transform: "rotate(360deg)" }], { duration: 500, easing: "cubic-bezier(.3,1.4,.5,1)" }); });
    pen.addEventListener("click", () => {
      const f = h("form", { class: "rename" });
      const inp = h("input", { value: this.a.card().tag, maxlength: "20", minlength: "2", "aria-label": "Your tag", autocomplete: "off", spellcheck: "false", pattern: "[A-Za-z0-9 '\\-]{2,20}" });
      f.append(inp, h("button", { class: "btn gold sm", type: "submit", text: "Save" }));
      f.addEventListener("submit", (e) => { e.preventDefault(); if (this.a.rename(inp.value)) { tag.textContent = this.a.card().tag; f.replaceWith(row); } else inp.setCustomValidity("2 to 20 letters, numbers, spaces, ' or -"), inp.reportValidity(); });
      inp.addEventListener("input", () => inp.setCustomValidity(""));
      row.replaceWith(f);
      inp.focus(); inp.select();
    });
    const row = h("div", { class: "tagrow" }, tag, dice, pen);
    const timer = h("span", {});
    const tick = () => { const ms = this.a.refillIn(); timer.textContent = ms ? `Next token in ${clock(ms)}` : c.tok >= CAP ? "Your cup is full" : `Tops up to ${FLOOR} when you run low`; };
    const cr = m ? this.a.card().cr[m.slug] ?? 0 : 0;
    const primary = fresh ? h("button", { class: "btn gold", type: "button", autofocus: "", text: "Let’s play" }) : m ? this.hallLink() : h("button", { class: "btn ghost", type: "button", autofocus: "", text: "Close" });
    const log = h("ol", { class: "log" }, ...c.log.slice(0, 8).map(([s, w, d, why]) =>
      h("li", {}, h("b", { class: d > 0 ? "plus" : d < 0 ? "minus" : "", text: d > 0 ? `+${d}` : d < 0 ? `−${-d}` : "0" }), h("span", { text: `${w === "hall" ? "The hall" : this.opts.names[w] ?? w} · ${why}` }), h("time", { text: ago(s) }))));
    this.show([
      h("p", { class: "eyebrow", text: fresh ? "Your player card" : "Player card · The Arcade" }),
      row,
      fresh && h("p", { class: "lede", text: `That's you in here. Here are ${c.tok} tokens, good in every machine; good runs pay more back.` }),
      h("div", { class: "stats" },
        h("div", { class: "stat" }, coin("coin big"), h("b", { class: "big", text: String(c.tok) }), h("span", { text: `of ${CAP}` })),
        h("div", { class: "stat" }, h("b", { class: "big", text: String(Math.max(1, c.st)) }), h("span", { text: c.st > 1 ? "day streak" : "day" })),
        m && h("div", { class: "stat" }, h("b", { class: "big", text: String(cr) }), h("span", { text: `${cr === 1 ? "play" : "plays"} on ${m.name}` })),
      ),
      h("p", { class: "timer" }, timer),
      c.log.length ? h("h3", { text: "Receipt" }) : null,
      log,
      h("div", { class: "acts" }, primary, h("a", { class: "btn ghost", href: this.opts.tokens, text: "How the arcade works" })),
      this.keep(),
      this.notice(),
    ], "card");
    if (primary instanceof HTMLButtonElement) primary.addEventListener("click", () => this.close());
    tick();
    this.ticker = window.setInterval(tick, 1000);
  }

  /** What the card is, said once wherever it appears: a cookie, in this browser, and nothing else. */
  private notice() {
    return h("p", { class: "fine" },
      this.a.kept() ? "Your card is one cookie in this browser, shared by the arcade's machines. No tracking, no ads. " : "Cookies are off in this browser, so this card lasts only until you leave the page. ",
      h("a", { href: this.opts.privacy, text: "Privacy" }));
  }

  /** Moving the card to another browser, or forgetting it. */
  private keep() {
    const box = h("details", { class: "keep" }, h("summary", { text: "Move or forget this card" }));
    const copy = h("button", { class: "btn ghost sm", type: "button", text: "Copy card code" });
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(this.a.code()); copy.textContent = "Copied"; } catch { copy.textContent = "Couldn't copy"; }
      setTimeout(() => (copy.textContent = "Copy card code"), 1600);
    });
    const f = h("form", { class: "rename" });
    const inp = h("input", { placeholder: "Paste a card code", "aria-label": "Card code from another browser", autocomplete: "off", spellcheck: "false" });
    f.append(inp, h("button", { class: "btn ghost sm", type: "submit", text: "Use it" }));
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      if (this.a.use(inp.value.trim())) { this.toast(`Card moved in: ${this.a.card().tag}`, "info"); this.sheet(); }
      else { inp.setCustomValidity("That isn't a card code"); inp.reportValidity(); }
    });
    inp.addEventListener("input", () => inp.setCustomValidity(""));
    const forget = h("button", { class: "btn ghost sm warn", type: "button", text: "Forget my card" });
    forget.addEventListener("click", () => {
      const sure = h("div", { class: "sure" },
        h("p", { text: "This deletes your tag, tokens, plays and receipt from this browser. A new card with 3 tokens starts in their place." }),
        h("div", { class: "acts" }, h("button", { class: "btn ghost sm warn", type: "button", text: "Forget it" }), h("button", { class: "btn ghost sm", type: "button", text: "Keep my card" })));
      const [yes, no] = sure.querySelectorAll("button");
      yes.addEventListener("click", () => { this.a.forget(); this.toast("Card forgotten. Here's a new one.", "info"); this.sheet(); });
      no.addEventListener("click", () => sure.replaceWith(forget));
      forget.replaceWith(sure);
      (no as HTMLElement).focus();
    });
    box.append(h("p", { class: "fine", text: "A card lives in one browser. To carry it to another, copy its code here and paste it there." }), h("div", { class: "acts" }, copy), f, forget);
    return box;
  }
}
