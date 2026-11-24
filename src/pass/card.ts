// The player card: one cookie on .ashwinsathian.com that every machine reads and writes.
// It is input like any other cookie: parsed defensively, clamped, and never trusted to be well formed.
import { randomTag } from "./tags.ts";

export type LogRow = [at: number, where: string, delta: number, why: string];
export type Card = {
  v: 1;
  tag: string;
  tok: number;
  /** Refill anchor, epoch ms. */
  at: number;
  /** Day of the last daily claim, days since the epoch (UTC). */
  day: number;
  /** Streak of consecutive daily claims. */
  st: number;
  /** Plays left on each machine. */
  cr: Record<string, number>;
  /** Tokens paid per machine today: [day, tokens]. */
  paid: Record<string, [number, number]>;
  log: LogRow[];
  seen: string[];
  /** Personal bests, "slug.mode" → metric. */
  b: Record<string, number>;
  /** Day each machine's daily mode last paid. */
  dd: Record<string, number>;
};

export const WELCOME = 12, FLOOR = 3, EVERY = 15 * 60_000, CAP = 99, LOG = 12;
export const today = (now: number) => Math.floor(now / 86_400_000);

const int = (n: unknown, lo: number, hi: number, d: number) => (typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.floor(n))) : d);
const obj = (o: unknown): Record<string, unknown> => (o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : {});

export function cleanTag(s: unknown): string {
  if (typeof s !== "string") return "";
  const t = s.replace(/[^A-Za-z0-9 '-]/g, "").replace(/\s+/g, " ").trim().slice(0, 20).trim();
  return t.length >= 2 ? t : "";
}
const cleanWhy = (s: unknown) => (typeof s === "string" ? s.replace(/[^A-Za-z0-9 '-]/g, "").slice(0, 24) : "");

export function fresh(now: number, rand: () => number, tag = ""): Card {
  return { v: 1, tag: tag || randomTag(rand), tok: WELCOME, at: now, day: today(now), st: 0, cr: {}, paid: {}, log: [[Math.floor(now / 1000), "hall", WELCOME, "Welcome"]], seen: [], b: {}, dd: {} };
}

/** Reads a card from its cookie value. Anything malformed gives a fresh card, keeping a valid tag.
 *  `modes` is each machine's mode ids: keys for anything else are dropped, so a forged cookie can't grow the card
 *  past what a cookie holds (the browser then refuses every write and the card is stuck). */
export function parse(raw: string | undefined, modes: Record<string, readonly string[]>, now: number, rand: () => number): { card: Card; fresh: boolean } {
  let o: Record<string, unknown> | undefined;
  try { if (raw) o = obj(JSON.parse(atob(raw.replace(/-/g, "+").replace(/_/g, "/")))); } catch { o = undefined; }
  if (!o || o.v !== 1) return { card: fresh(now, rand, cleanTag(o?.tag)), fresh: true };
  const known = new Set(Object.keys(modes));
  const bests = new Set(Object.entries(modes).flatMap(([slug, ms]) => ms.map((m) => `${slug}.${m}`)));
  const pick = <T>(src: unknown, f: (v: unknown) => T | undefined, keys = known) => {
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(obj(src))) {
      if (!keys.has(k)) continue;
      const r = f(v);
      if (r !== undefined) out[k] = r;
    }
    return out;
  };
  const d0 = today(now);
  const card: Card = {
    v: 1,
    tag: cleanTag(o.tag) || randomTag(rand),
    tok: int(o.tok, 0, CAP, 0),
    at: int(o.at, 0, now, now),
    day: int(o.day, 0, d0, d0),
    st: int(o.st, 0, 365, 0),
    cr: pick(o.cr, (v) => int(v, 0, 9, 0) || undefined),
    paid: pick(o.paid, (v) => (Array.isArray(v) ? [int(v[0], 0, d0, 0), int(v[1], 0, 999, 0)] as [number, number] : undefined)),
    log: (Array.isArray(o.log) ? o.log : []).slice(0, LOG).flatMap((r): LogRow[] =>
      Array.isArray(r) && (known.has(r[1]) || r[1] === "hall") ? [[int(r[0], 0, Math.floor(now / 1000), 0), r[1], int(r[2], -CAP, CAP, 0), cleanWhy(r[3])]] : []),
    seen: (Array.isArray(o.seen) ? o.seen : []).filter((s): s is string => typeof s === "string" && known.has(s)),
    b: pick(o.b, (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), 1e9) : undefined), bests),
    dd: pick(o.dd, (v) => int(v, 0, d0, 0) || undefined),
  };
  return { card, fresh: false };
}

/** Base64url of the JSON: cookie-safe, and a third smaller than percent-encoding it. Everything in a card is ASCII. */
const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const MAX = 3200; // of the 4,096 bytes a cookie may hold
/** Always fits in MAX: past it the browser drops the write and the card stops saving. The receipt goes first,
 *  oldest row first, then the smallest bests. */
export function serialise(c: Card): string {
  const c2 = { ...c, log: c.log.slice(0, LOG), b: { ...c.b } };
  const low = Object.keys(c2.b).sort((x, y) => c2.b[x] - c2.b[y]);
  let s = b64(c2);
  while (s.length > MAX && (c2.log.length || low.length)) {
    if (c2.log.length) c2.log.pop(); else delete c2.b[low.shift()!];
    s = b64(c2);
  }
  return s;
}

export function note(c: Card, now: number, where: string, delta: number, why: string) {
  c.log.unshift([Math.floor(now / 1000), where, delta, why]);
  c.log.length = Math.min(c.log.length, LOG);
}

/** Adds tokens up to the cap; returns what fitted. */
export function add(c: Card, n: number) {
  const fit = Math.max(0, Math.min(n, CAP - c.tok));
  c.tok += fit;
  return fit;
}

/** Below the floor, one token comes back every 15 minutes. At or above it, the clock waits. */
export function refill(c: Card, now: number): Card {
  if (c.tok >= FLOOR) { c.at = now; return c; }
  const n = Math.floor((now - c.at) / EVERY);
  if (n <= 0) return c;
  c.tok = Math.min(FLOOR, c.tok + n);
  c.at = c.tok >= FLOOR ? now : c.at + n * EVERY;
  return c;
}
export const refillIn = (c: Card, now: number) => (c.tok >= FLOOR ? 0 : Math.max(0, c.at + EVERY - now));

/** The day's tokens, paid on the first load of a UTC day: 5, rising by one a day to 9 on a streak. */
export function daily(c: Card, now: number): { card: Card; paid: number } {
  const d = today(now);
  if (c.day >= d) return { card: c, paid: 0 };
  c.st = c.day === d - 1 ? c.st + 1 : 1;
  c.day = d;
  const paid = add(c, 4 + Math.min(c.st, 5));
  note(c, now, "hall", paid, c.st > 1 ? `Day ${c.st} streak` : "Daily tokens");
  return { card: c, paid };
}

/** Spends a token on a credit of plays for one machine. The caller checks there is a token. */
export function insert(c: Card, slug: string, plays: number) {
  c.tok -= 1;
  c.cr[slug] = Math.min(9, (c.cr[slug] ?? 0) + plays);
}
